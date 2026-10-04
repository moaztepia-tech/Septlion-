import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://septlion.com","https://www.septlion.com"]);
function corsFor(req: Request) {
  const origin = req.headers.get("origin") || "https://septlion.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://septlion.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type,authorization,apikey",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsFor(req) });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(req, { error: "Unauthorized" }, 401);
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json(req, { error: "Unauthorized" }, 401);
  const { data: coreUser } = await db.schema("core").from("User").select("id").eq("id", user.id).maybeSingle();
  if (!coreUser) return json(req, { error: "Operator access required" }, 403);
  const { data: memberships } = await db.schema("core").from("Membership").select("role").eq("userId", user.id).in("role", ["ADMIN","SALES"]);
  if (!memberships?.length) return json(req, { error: "Operator access required" }, 403);
  const operator = { id: user.id, label: user.email || "SEPTLION Operator", active: true };

  if (req.method === "GET") {
    const [queue, signals, sources, patterns, runs, alerts, pushSubscriptions, supplierProfiles, buyers] = await Promise.all([
      db.from("DemandWorkbenchQueue")
        .select("*")
        .in("taskStatus", ["OPEN","IN_PROGRESS","BLOCKED"])
        .order("priority", { ascending: false })
        .order("dueAt", { ascending: true, nullsFirst: false })
        .limit(100),
      db.from("DemandSignal")
        .select("status,stage,market", { count: "exact", head: false })
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
      db.from("DemandAlert")
        .select("id,type,severity,title,body,metadata,createdAt,readAt")
        .is("readAt", null)
        .order("createdAt", { ascending: false })
        .limit(20),
      db.from("DemandPushSubscription")
        .select("id", { count: "exact", head: false })
        .eq("active", true),
      db.from("DemandSupplierProfile")
        .select("id", { count: "exact", head: false })
        .eq("active", true),
      db.from("DemandBuyerWorkbench")
        .select("*")
        .order("priorityScore", { ascending: false })
        .order("lastBuyingSignalAt", { ascending: false, nullsFirst: false })
        .limit(100),
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
      unreadAlerts: (alerts.data || []).length,
      activePushSubscriptions: (pushSubscriptions.data || []).length,
      supplierProfiles: (supplierProfiles.data || []).length,
      buyers: (buyers.data || []).length,
      buyerVerified: (buyers.data || []).filter((x: any) => ["VERIFIED","SELF_SUBMITTED"].includes(x.verificationStatus)).length,
      buyerExecutable: (buyers.data || []).filter((x: any) => x.executionScore >= 70).length,
      buyerContactReady: (buyers.data || []).filter((x: any) => x.contactReadinessScore >= 60).length,
    };

    return json(req, {
      operator: operator.label,
      stats,
      queue: queue.data || [],
      sources: sources.data || [],
      patterns: patterns.data || [],
      recentRuns: runs.data || [],
      alerts: alerts.data || [],
      buyers: buyers.data || [],
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const taskId = String(body?.taskId || "");
    const action = String(body?.action || "");
    const note = body?.note ? String(body.note).slice(0, 2000) : null;

    if (action === "register_push") {
      const subscription = body?.subscription || {};
      const endpoint = String(subscription?.endpoint || "");
      const p256dh = String(subscription?.keys?.p256dh || "");
      const auth = String(subscription?.keys?.auth || "");
      if (!endpoint.startsWith("https://") || !p256dh || !auth) {
        return json(req, { error: "Invalid push subscription" }, 400);
      }

      const now = new Date().toISOString();
      const { error } = await db.from("DemandPushSubscription").upsert({
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent") || null,
        active: true,
        lastError: null,
        updatedAt: now,
      }, { onConflict: "endpoint" });

      if (error) return json(req, { error: "Unable to register push subscription" }, 500);
      return json(req, { ok: true, push: "enabled" });
    }

    if (action === "mark_alert_read") {
      const alertId = String(body?.alertId || "");
      if (!alertId) return json(req, { error: "Alert id required" }, 400);
      await db.from("DemandAlert")
        .update({ readAt: new Date().toISOString() })
        .eq("id", alertId);
      return json(req, { ok: true });
    }

    if (action === "mark_all_alerts_read") {
      await db.from("DemandAlert")
        .update({ readAt: new Date().toISOString() })
        .is("readAt", null);
      return json(req, { ok: true });
    }

    if (!taskId || !["start","complete","block","reopen","advance","publish_intent"].includes(action)) {
      return json(req, { error: "Invalid action" }, 400);
    }

    const { data: task } = await db
      .from("DemandTask")
      .select("id,signalId,taskType,status")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) return json(req, { error: "Task not found" }, 404);

    const statusMap: Record<string,string> = {
      start: "IN_PROGRESS",
      complete: "DONE",
      block: "BLOCKED",
      reopen: "OPEN",
    };

    if (action === "publish_intent") {
      const { data: signal } = await db.from("DemandSignal")
        .select("stage")
        .eq("id", task.signalId)
        .single();

      if (signal?.stage !== "INTENT_PAGE") return json(req, { error: "Intent page is not the current stage" }, 409);

      const { data: intent } = await db.from("DemandIntentPage")
        .select("id,status,slug")
        .eq("signalId", task.signalId)
        .maybeSingle();

      if (!intent) return json(req, { error: "Intent draft not found" }, 404);
      if (!["READY","PUBLISHED"].includes(intent.status)) return json(req, { error: "Intent page must be READY before publishing" }, 409);

      const now = new Date().toISOString();
      await db.from("DemandIntentPage")
        .update({ status: "PUBLISHED", publishedAt: now, updatedAt: now })
        .eq("id", intent.id);

      await db.from("DemandTask")
        .update({ status: "DONE", updatedAt: now })
        .eq("id", taskId);

      await db.from("DemandOpportunityEvent").insert({
        signalId: task.signalId,
        stage: "INTENT_PAGE",
        eventType: "INTENT_PUBLISHED",
        note,
        metadata: { taskId, slug: intent.slug },
      });

      return json(req, { ok: true, stage: "INTENT_PAGE", intentStatus: "PUBLISHED", slug: intent.slug });
    }

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

      const currentStage = signal?.stage || "";

      if (currentStage === "QUALIFICATION") {
        await db.from("DemandQualification")
          .update({ decision: "QUALIFIED", updatedAt: new Date().toISOString() })
          .eq("signalId", task.signalId);
      } else if (currentStage === "OFFER_BUILD") {
        await db.from("DemandOfferBuild")
          .update({ status: "READY", approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
          .eq("signalId", task.signalId);

        await db.from("DemandTask")
          .update({ status: "DONE", updatedAt: new Date().toISOString() })
          .eq("id", taskId);

        await db.from("DemandSignal")
          .update({ stage: "INTENT_PAGE" })
          .eq("id", task.signalId);

        await db.from("DemandOpportunityEvent").insert({
          signalId: task.signalId,
          stage: "INTENT_PAGE",
          eventType: "OFFER_READY",
          note,
          metadata: { taskId, from: "OFFER_BUILD", to: "INTENT_PAGE" },
        });
      } else if (currentStage === "INTENT_PAGE") {
        await db.from("DemandIntentPage")
          .update({ status: "READY", updatedAt: new Date().toISOString() })
          .eq("signalId", task.signalId);

        return json(req, { ok: true, stage: "INTENT_PAGE", intentStatus: "READY", note: "RFQ requires a buyer submission." });
      } else {
        const next: Record<string,string> = {
          DETECTED: "BUYER_RESOLUTION",
          BUYER_RESOLUTION: "QUALIFICATION",
        };
        const nextStage = next[currentStage];
        if (!nextStage) return json(req, { error: "No next stage" }, 409);

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
          metadata: { taskId, from: currentStage, to: nextStage },
        });
      }
    }

    return json(req, { ok: true });
  }

  return json(req, { error: "Method not allowed" }, 405);
});