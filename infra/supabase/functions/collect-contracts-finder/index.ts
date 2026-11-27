import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCE_ID = "uk-contracts-finder";
const SOURCE_NAME = "UK Contracts Finder";
const BASE = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";

function score(x: any) {
  let n = 35; // official government source
  if (x.product) n += 15;
  if (x.market) n += 10;
  if (x.quantity) n += 10;
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

function isFlourTender(release: any) {
  const tender = release?.tender || {};
  const text = JSON.stringify(tender).toLowerCase();
  return text.includes("156121") || text.includes("wheat flour") || text.includes("breadmaking flour") ||
    text.includes("plain flour") || text.includes("wholemeal flour");
}

function sourceUrl(release: any) {
  const docs = [
    ...(release?.tender?.documents || []),
    ...(release?.documents || []),
  ];
  const doc = docs.find((d: any) => typeof d?.url === "string" && d.url.includes("contractsfinder.service.gov.uk"));
  if (doc?.url) return doc.url;
  const id = String(release?.id || "");
  const m = id.match(/^[0-9a-fA-F-]{36}/);
  return m ? `https://www.contractsfinder.service.gov.uk/Notice/${m[0]}` : null;
}

function buyerParty(release: any) {
  return (release?.parties || []).find((p: any) => Array.isArray(p?.roles) && p.roles.includes("buyer")) || null;
}

function market(release: any) {
  const items = release?.tender?.items || [];
  for (const item of items) {
    for (const a of item?.deliveryAddresses || []) {
      const parts = [a?.region, a?.locality, a?.countryName].filter(Boolean);
      if (parts.length) return "United Kingdom — " + parts.join(", ");
    }
  }
  return "United Kingdom";
}

function quantity(release: any) {
  const items = release?.tender?.items || [];
  const vals = items.map((i: any) => {
    if (i?.quantity == null) return null;
    const unit = i?.unit?.name || i?.unit?.id || "";
    return `${i.quantity}${unit ? " " + unit : ""}`;
  }).filter(Boolean);
  return vals.length ? vals.join("; ") : null;
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
      sourceId: SOURCE_ID, status: "SKIPPED", error: "rate_limited",
      finishedAt: new Date().toISOString(),
    });
    return Response.json({ ok: true, skipped: "rate_limited" });
  }

  const { data: run } = await db.from("DemandCollectorRun")
    .insert({ sourceId: SOURCE_ID, status: "RUNNING" })
    .select("id").single();

  const now = new Date();
  const from = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  await db.from("DemandCollectorState").upsert({
    source: SOURCE_NAME, lastAttemptAt: now.toISOString(), lastError: null,
  }, { onConflict: "source" });

  try {
    let scanned = 0;
    let matched = 0;
    let accepted = 0;

    for (let page = 1; page <= 5; page++) {
      const u = new URL(BASE);
      u.searchParams.set("publishedFrom", from);
      u.searchParams.set("publishedTo", to);
      u.searchParams.set("stages", "tender");
      u.searchParams.set("orderBy", "publishedDate");
      u.searchParams.set("order", "DESC");
      u.searchParams.set("size", "100");
      u.searchParams.set("page", String(page));

      const res = await fetch(u, {
        headers: { "Accept": "application/json", "User-Agent": "Septlion-Demand-Intelligence/1.0" },
      });
      if (!res.ok) throw new Error(`source status ${res.status}`);

      const payload = await res.json();
      const releases = Array.isArray(payload?.releases) ? payload.releases : [];
      scanned += releases.length;

      for (const release of releases) {
        if (!Array.isArray(release?.tag) || !release.tag.includes("tender")) continue;
        if (!isFlourTender(release)) continue;

        const tender = release?.tender || {};
        const deadline = tender?.tenderPeriod?.endDate || null;
        if (deadline && new Date(deadline).getTime() <= Date.now()) continue;
        if (tender?.status === "complete" || tender?.status === "cancelled") continue;

        matched++;
        const buyer = buyerParty(release);
        const item: any = {
          source: SOURCE_NAME,
          sourceRecordId: String(release?.ocid || release?.id),
          sourceUrl: sourceUrl(release),
          type: "TENDER",
          market: market(release),
          product: tender?.title || tender?.description || "Wheat flour procurement",
          productKey: "wheat_flour",
          quantity: quantity(release),
          buyerName: release?.buyer?.name || buyer?.name || null,
          publishedAt: release?.date || null,
          deadlineAt: deadline,
          incoterm: null,
          packing: null,
          evidence: {
            officialSource: true,
            ocds: true,
            cpv: tender?.classification?.id || null,
            buyerContact: buyer?.contactPoint || null,
            procurementMethod: tender?.procurementMethod || null,
            procurementMethodDetails: tender?.procurementMethodDetails || null,
            estimatedValue: tender?.value || null,
            sourceLicense: payload?.license || null,
          },
          raw: release,
          verification: "OFFICIAL_SOURCE_SIGNAL",
          lastSeenAt: new Date().toISOString(),
        };

        item.score = score(item);
        Object.assign(item, triage(item.score));
        item.intentPageCandidate = item.score >= 70 && !!item.product && !!item.market;

        const { data: saved, error } = await db.from("DemandSignal")
          .upsert(item, { onConflict: "source,sourceRecordId" })
          .select("id,stage").single();

        if (!error && saved) {
          accepted++;
          await db.from("DemandOpportunityEvent").insert({
            signalId: saved.id,
            stage: saved.stage,
            eventType: "COLLECTOR_REFRESH",
            note: "Signal discovered or refreshed by UK Contracts Finder collector.",
            metadata: { sourceId: SOURCE_ID },
          });
        }
      }

      if (releases.length < 100) break;
    }

    const finished = new Date().toISOString();
    await Promise.all([
      db.from("DemandCollectorState").upsert({
        source: SOURCE_NAME, lastAttemptAt: finished, lastSuccessAt: finished,
        lastAccepted: accepted, lastError: null,
      }, { onConflict: "source" }),
      db.from("DemandSource").update({
        active: true, collector: "collect-contracts-finder", cadenceMinutes: 360,
        lastSuccessAt: finished, lastError: null, updatedAt: finished,
      }).eq("id", SOURCE_ID),
      run?.id ? db.from("DemandCollectorRun").update({
        status: "SUCCESS", scanned, accepted, finishedAt: finished,
      }).eq("id", run.id) : Promise.resolve(null),
    ]);

    return Response.json({ ok: true, scanned, matched, accepted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finished = new Date().toISOString();
    await Promise.all([
      db.from("DemandCollectorState").upsert({
        source: SOURCE_NAME, lastAttemptAt: finished, lastError: message,
      }, { onConflict: "source" }),
      db.from("DemandSource").update({
        lastError: message, updatedAt: finished,
      }).eq("id", SOURCE_ID),
      run?.id ? db.from("DemandCollectorRun").update({
        status: "FAILED", error: message, finishedAt: finished,
      }).eq("id", run.id) : Promise.resolve(null),
    ]);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
});
