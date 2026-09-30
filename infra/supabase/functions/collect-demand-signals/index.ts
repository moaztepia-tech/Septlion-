import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCE_ID = "world-bank-procurement";
const SOURCE_NAME = "World Bank Procurement Notices";
const SOURCE = "https://search.worldbank.org/api/v2/procnotices";
const TERMS = ["wheat flour", "flour", "milling", "maize flour", "fortified flour"];

function value(r: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = r?.[k];
    if (v !== null && v !== undefined) return String(v);
  }
  return "";
}

function isRelevant(r: Record<string, unknown>) {
  const haystack = [
    value(r, "bid_description", "notice_text", "project_name"),
    value(r, "sector"),
    value(r, "procurement_category"),
  ].join(" ").toLowerCase();

  return TERMS.some((term) => haystack.includes(term));
}

function score(x: any) {
  let n = 30;
  if (x.product) n += 15;
  if (x.market) n += 10;
  if (x.quantity) n += 15;
  if (x.buyerName) n += 10;
  if (x.deadlineAt) n += 10;
  if (x.sourceUrl) n += 10;
  return Math.min(n, 100);
}

function triage(n: number) {
  return {
    status: n >= 75 ? "QUALIFY_NOW" : n >= 55 ? "RESOLVE_BUYER" : "WATCH",
    stage: n >= 75 ? "QUALIFICATION" : n >= 55 ? "BUYER_RESOLUTION" : "DETECTED",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: state } = await db
    .from("DemandCollectorState")
    .select("lastAttemptAt")
    .eq("source", SOURCE_NAME)
    .maybeSingle();

  if (state?.lastAttemptAt && Date.now() - new Date(state.lastAttemptAt).getTime() < 30 * 60 * 1000) {
    await db.from("DemandCollectorRun").insert({
      sourceId: SOURCE_ID,
      status: "SKIPPED",
      error: "rate_limited",
      finishedAt: new Date().toISOString(),
    });
    return Response.json({ ok: true, skipped: "rate_limited" });
  }

  const { data: run } = await db
    .from("DemandCollectorRun")
    .insert({ sourceId: SOURCE_ID, status: "RUNNING" })
    .select("id")
    .single();

  await db.from("DemandCollectorState").upsert({
    source: SOURCE_NAME,
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  }, { onConflict: "source" });

  try {
    const u = new URL(SOURCE);
    u.searchParams.set("format", "json");
    u.searchParams.set("rows", "100");
    u.searchParams.set("os", "0");

    const res = await fetch(u);
    if (!res.ok) throw new Error(`source status ${res.status}`);

    const raw = await res.json();
    const rows = Array.isArray(raw?.procnotices)
      ? raw.procnotices
      : Object.values(raw?.procnotices || {});

    const relevant = rows.filter((x: any) => isRelevant(x));
    let accepted = 0;

    for (const r of relevant) {
      const sourceRecordId =
        value(r, "id", "project_id") ||
        [
          value(r, "bid_description", "notice_text"),
          value(r, "country_name", "project_ctry_name"),
          value(r, "publication_date", "noticedate"),
        ].join("|");

      const item: any = {
        source: SOURCE_NAME,
        sourceRecordId,
        sourceUrl: value(r, "url") || null,
        type: "TENDER",
        market: value(r, "country_name", "project_ctry_name") || "Unresolved market",
        product: value(r, "bid_description", "notice_text") || "Flour procurement",
        productKey: "wheat_flour",
        quantity: null,
        buyerName: null,
        publishedAt: value(r, "publication_date", "noticedate") || null,
        deadlineAt: value(r, "deadline_date", "submission_date") || null,
        incoterm: null,
        packing: null,
        evidence: { sourceIndex: true, collector: SOURCE_ID },
        raw: r,
        verification: "SOURCE_SIGNAL",
        lastSeenAt: new Date().toISOString(),
      };

      item.score = score(item);
      Object.assign(item, triage(item.score));
      item.intentPageCandidate = item.score >= 70 && !!item.product && !!item.market;

      const { data: saved, error } = await db
        .from("DemandSignal")
        .upsert(item, { onConflict: "source,sourceRecordId" })
        .select("id,stage")
        .single();

      if (!error && saved) {
        accepted++;
        await db.from("DemandOpportunityEvent").insert({
          signalId: saved.id,
          stage: saved.stage,
          eventType: "COLLECTOR_REFRESH",
          note: "Signal discovered or refreshed by automated collector.",
          metadata: { sourceId: SOURCE_ID },
        });
      }
    }

    const now = new Date().toISOString();
    await Promise.all([
      db.from("DemandCollectorState").upsert({
        source: SOURCE_NAME,
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastAccepted: accepted,
        lastError: null,
      }, { onConflict: "source" }),
      db.from("DemandSource").update({
        lastSuccessAt: now,
        lastError: null,
        updatedAt: now,
      }).eq("id", SOURCE_ID),
      run?.id
        ? db.from("DemandCollectorRun").update({
            status: "SUCCESS",
            scanned: rows.length,
            accepted,
            finishedAt: now,
          }).eq("id", run.id)
        : Promise.resolve(null),
    ]);

    return Response.json({ ok: true, scanned: rows.length, matched: relevant.length, accepted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();

    await Promise.all([
      db.from("DemandCollectorState").upsert({
        source: SOURCE_NAME,
        lastAttemptAt: now,
        lastError: message,
      }, { onConflict: "source" }),
      db.from("DemandSource").update({
        lastError: message,
        updatedAt: now,
      }).eq("id", SOURCE_ID),
      run?.id
        ? db.from("DemandCollectorRun").update({
            status: "FAILED",
            error: message,
            finishedAt: now,
          }).eq("id", run.id)
        : Promise.resolve(null),
    ]);

    return Response.json({ ok: false, error: message }, { status: 502 });
  }
});
