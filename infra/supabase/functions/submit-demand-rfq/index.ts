import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://septlion.com","https://www.septlion.com"]);
function corsFor(req: Request) {
  const origin = req.headers.get("origin") || "https://septlion.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://septlion.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function text(v: unknown, max = 500) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed" }, 403);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json(req, { error: "Invalid request" }, 400);

  // Honeypot: real users never fill this field.
  if (text((body as any).website, 200)) return json(req, { ok: true }, 202);

  const companyName = text((body as any).companyName, 160);
  const contactName = text((body as any).contactName, 160);
  const email = text((body as any).email, 200).toLowerCase();
  const country = text((body as any).country, 120);
  const quantity = text((body as any).quantity, 120);
  const intentSlug = text((body as any).intentSlug, 220) || "wheat-flour";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);

  if (!companyName || !contactName || !emailOk || !country || !quantity) {
    return json(req, { error: "Please complete company, contact, email, country and quantity." }, 400);
  }

  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await sha256(forwarded.split(",")[0].trim());
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await db
    .from("DemandRfqSubmission")
    .select("id", { head: true, count: "exact" })
    .eq("ipHash", ipHash)
    .gte("createdAt", since);

  if ((count || 0) >= 5) return json(req, { error: "Too many requests. Please try again later." }, 429);

  const normalized: Record<string, unknown> = {
    intentSlug,
    productKey: "wheat_flour",
    product: "Wheat Flour",
    companyName,
    contactName,
    email,
    phone: text((body as any).phone, 80) || null,
    country,
    city: text((body as any).city, 120) || null,
    destinationPort: text((body as any).destinationPort, 160) || null,
    quantity,
    packing: text((body as any).packing, 120) || null,
    incoterm: text((body as any).incoterm, 40) || null,
    deliveryWindow: text((body as any).deliveryWindow, 160) || null,
    notes: text((body as any).notes, 2000) || null,
    ipHash,
    userAgent: text(req.headers.get("user-agent"), 500),
  };

  const { data, error } = await db.rpc("create_public_demand_rfq", { payload: normalized });
  if (error) {
    console.error("create_public_demand_rfq", error);
    return json(req, { error: "Unable to submit RFQ right now." }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return json(req, {
    ok: true,
    reference: row?.reference,
    message: "RFQ received by Septlion Demand Intelligence.",
  }, 201);
});