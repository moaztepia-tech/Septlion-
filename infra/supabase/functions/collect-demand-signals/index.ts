import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {SEARCH_TERMS,normalizeNotice} from "./normalize.ts";

const SOURCE_ID = "world-bank-procurement";
const SOURCE_NAME = "World Bank Procurement Notices";
const SOURCE = "https://search.worldbank.org/api/v2/procnotices";
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
    // Query each commodity instead of scanning an arbitrary first page of all procurement.
    const pages = await Promise.all(SEARCH_TERMS.map(async term => {
      const u = new URL(SOURCE);
      u.searchParams.set("format", "json"); u.searchParams.set("rows", "200");
      u.searchParams.set("os", "0"); u.searchParams.set("qterm", term);
      u.searchParams.set("srt", "noticedate"); u.searchParams.set("order", "desc");
      const res=await fetch(u,{signal:AbortSignal.timeout(20000)});
      if(!res.ok)throw new Error(`source status ${res.status}`);
      const raw=await res.json();
      return Array.isArray(raw?.procnotices)?raw.procnotices:Object.values(raw?.procnotices||{});
    }));
    const rows=[...new Map(pages.flat().map((r:any)=>[String(r.id),r])).values()];
    const relevant=rows.map((r:any)=>normalizeNotice(r)).filter(Boolean);
    let accepted=0;
    for(const normalized of relevant){
      const item:any={...normalized};
      const {data:existing,error:lookupError}=await db.from("DemandSignal")
        .select("id,stage,status,verification,evidence,quantity,packing,incoterm")
        .eq("source",SOURCE_NAME).eq("sourceRecordId",item.sourceRecordId).maybeSingle();
      if(lookupError)throw new Error("Signal lookup failed");
      // A source refresh must preserve work performed by operators and downstream stages.
      Object.assign(item,{
        stage:existing?.stage||"BUYER_RESOLUTION",status:existing?.status||"RESOLVE_BUYER",
        verification:existing?.verification||item.verification,
        evidence:{...(existing?.evidence||{}),...item.evidence},
        quantity:existing?.quantity||item.quantity,packing:existing?.packing||item.packing,
        incoterm:existing?.incoterm||item.incoterm,
      });
      const {error}=await db.from("DemandSignal").upsert(item,{onConflict:"source,sourceRecordId"});
      if(error)throw new Error("Signal persistence failed: "+error.code);
      accepted++;
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
