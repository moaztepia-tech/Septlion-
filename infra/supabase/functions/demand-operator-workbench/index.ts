import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://septlion.com",
  "Access-Control-Allow-Headers": "content-type,x-operator-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const key = req.headers.get("x-operator-key") || "";
  if (!key || key.length < 20) return json({ error: "Unauthorized" }, 401);

  const keyHash = await sha256(key);
  const { data: operator } = await db
    .from("DemandOperatorKey")
    .select("id,label,active")
    .eq("keyHash", keyHash)
    .eq("active", true)
    .is("revokedAt", null)
    .maybeSingle();

  if (!operator) return json({ error: "Unauthorized" }, 401);

  await db.from("DemandOperatorKey")
    .update({ lastUsedAt: new Date().toISOString() })
    .eq("id", operator.id);

  if (req.method === "GET") {
    const [queue, signals, sources, patterns, runs] = await Promise.all([
      db.from("DemandWorkbenchQueue")
        .select("*")
        .in("taskStatus", ["OPEN","IN_PROGRESS","BLOCKED"])
        .order("priority", { ascending: false })
        .order("dueAt", { ascending: true, nullsFirst: false })
        .limit(100),
      db.from("DemandSignal")
        .select("status,stage,market")
        .neq("status", "ARCHIVED"),
      db.from("DemandSource")
        .select("id,name,sourceType,active,priority,lastSuccessAt,lastError,collector,cadenceMinutes")
        .order("priority", { ascending: false }),
      db.from("DemandPattern")
        .select("productKey,market,signalCount,patternStatus,confidence,predictedWindowStart,predictedWindowEnd")
        .order("confidence", { ascending: false })
        .limit(50),
      db.from("DemandCollectorRun")
        .select("sourceId,status,scanned,accepted,error,startedAt,finishedAt")
        .order("startedAt", { ascending: false })
        .limit(20),
    ]);

    const rows = signals.data || [];
    const stats = {
      activeSignals: rows.length,
      qualifyNow: rows.filter((x: any) => x.status === "QUALIFY_NOW").length,
      buyerResolution: rows.filter((x: any) => x.stage === "BUYER_RESOLUTION").length,
      qualification: rows.filter((x: any) => x.stage === "QUALIFICATION").length,
      offerBuild: rows.filter((x: any) => x.stage === "OFFER_BUILD").length,
      intentPage: rows.filter((x: any) => x.stage === "INTENT_PAGE").length,
      rfq: rows.filter((x: any) => x.stage === "RFQ").length,
      markets: new Set(rows.map((x: any) => x.market)).size,
    };

    return json({
      operator: operator.label,
      stats,
      queue: queue.data || [],
      sources: sources.data || [],
      patterns: patterns.data || [],
      recentRuns: runs.data || [],
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const taskId = String(body?.taskId || "");
    const action = String(body?.action || "");
    const note = body?.note ? String(body.note).slice(0, 2000) : null;

    if (!taskId || !["start","complete","block","reopen","advance"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const { data: task } = await db
      .from("DemandTask")
      .select("id,signalId,taskType,status")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) return json({ error: "Task not found" }, 404);

    const statusMap: Record<string,string> = {
      start: "IN_PROGRESS",
      complete: "DONE",
      block: "BLOCKED",
      reopen: "OPEN",
    };

    if (action !== "advance") {
      await db.from("DemandTask")
        .update({ status: statusMap[action], updatedAt: new Date().toISOString() })
        .eq("id", taskId);

      const { data: signal } = await db.from("DemandSignal")
        .select("stage")
        .eq("id", task.signalId)
        .single();

      await db.from("DemandOpportunityEvent").insert({
        signalId: task.signalId,
        stage: signal?.stage || "DETECTED",
        eventType: "TASK_" + action.toUpperCase(),
        note,
        metadata: { taskId, taskType: task.taskType },
      });
    } else {
      const { data: signal } = await db.from("DemandSignal")
        .select("stage")
        .eq("id", task.signalId)
        .single();

      const next: Record<string,string> = {
        DETECTED: "BUYER_RESOLUTION",
        BUYER_RESOLUTION: "QUALIFICATION",
        QUALIFICATION: "OFFER_BUILD",
        OFFER_BUILD: "INTENT_PAGE",
        INTENT_PAGE: "RFQ",
      };
      const nextStage = next[signal?.stage || ""];
      if (!nextStage) return json({ error: "No next stage" }, 409);

      await db.from("DemandTask")
        .update({ status: "DONE", updatedAt: new Date().toISOString() })
        .eq("id", taskId);

      await db.from("DemandSignal")
        .update({ stage: nextStage })
        .eq("id", task.signalId);

      await db.from("DemandOpportunityEvent").insert({
        signalId: task.signalId,
        stage: nextStage,
        eventType: "OPERATOR_ADVANCE",
        note,
        metadata: { taskId, from: signal?.stage, to: nextStage },
      });
    }

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
});