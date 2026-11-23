import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";
import { buildRequest, createRateLimiter, interpretResponse, validInput } from "./interpret.ts";

// Optional AI guidance for the public request composer. The browser's local parser stays
// authoritative: any failure here returns no result and the buyer keeps the local answer.
const allowedOrigins = new Set(["https://septlion.com", "https://www.septlion.com"]);
for (const value of (Deno.env.get("SEPTLION_ALLOWED_ORIGINS") || "").split(",")) {
  try { const u = new URL(value.trim()); if (u.protocol === "https:" && u.origin === value.trim()) allowedOrigins.add(u.origin); } catch {}
}
const withinLimit = createRateLimiter(6);
const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
const client = apiKey ? new Anthropic({ apiKey, timeout: 12000, maxRetries: 1 }) : null;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const allowed = allowedOrigins.has(origin);
  const headers = {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!allowed) return out({ error: "الطلب غير مسموح" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!withinLimit(ip)) return out({ error: "حاول بعد دقيقة" }, 429);
  if (Number(req.headers.get("Content-Length")) > 16000) return out({ error: "Request too large" }, 413);
  let text: unknown;
  try { const raw = await req.text(); if (raw.length > 16000) return out({ error: "Request too large" }, 413); text = JSON.parse(raw)?.text; }
  catch { return out({ error: "بيانات غير صالحة" }, 400); }
  if (!validInput(text)) return out({ error: "اكتب وصفًا لا يتجاوز ٤٠٠٠ حرف" }, 400);
  if (!client) return out({ result: null, mode: "unavailable" }, 503);
  try {
    const message = await client.messages.create(buildRequest(text));
    const interpreted = interpretResponse(message);
    return interpreted ? out(interpreted) : out({ result: null, mode: "unavailable" }, 503);
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : "network";
    console.error("[Septlion interpreter] provider request failed:", status);
    return out({ result: null, mode: "unavailable" }, 503);
  }
});
