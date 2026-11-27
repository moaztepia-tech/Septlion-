import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";
import { GEMINI_MODEL, buildGeminiRequest, buildRequest, createRateLimiter, interpretGeminiResponse, interpretResponse, stripContacts, validInput } from "./interpret.ts";

// Optional AI guidance for the public request composer. The browser's local parser stays
// authoritative: any failure here returns no result and the buyer keeps the local answer.
// Provider: Google Gemini (free tier) when GEMINI_API_KEY is set, otherwise Claude when
// ANTHROPIC_API_KEY is set. Contact details are removed before the text leaves SEPTLION.
const allowedOrigins = new Set(["https://septlion.com", "https://www.septlion.com"]);
for (const value of (Deno.env.get("SEPTLION_ALLOWED_ORIGINS") || "").split(",")) {
  try { const u = new URL(value.trim()); if (u.protocol === "https:" && u.origin === value.trim()) allowedOrigins.add(u.origin); } catch {}
}
const withinLimit = createRateLimiter(6);
const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
const client = apiKey ? new Anthropic({ apiKey, timeout: 12000, maxRetries: 1 }) : null;
const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
const geminiModel = (Deno.env.get("GEMINI_MODEL") || GEMINI_MODEL).replace(/[^a-z0-9.\-]/gi, "");

async function askGemini(text: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify(buildGeminiRequest(text)),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) { console.error("[Septlion interpreter] Gemini status:", res.status); return null; }
  return interpretGeminiResponse(await res.json());
}

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
  if (geminiKey) {
    try {
      const interpreted = await askGemini(text);
      return interpreted ? out(interpreted) : out({ result: null, mode: "unavailable" }, 503);
    } catch {
      console.error("[Septlion interpreter] Gemini request failed");
      return out({ result: null, mode: "unavailable" }, 503);
    }
  }
  if (!client) return out({ result: null, mode: "unavailable" }, 503);
  try {
    const message = await client.messages.create(buildRequest(stripContacts(text)));
    const interpreted = interpretResponse(message);
    return interpreted ? out(interpreted) : out({ result: null, mode: "unavailable" }, 503);
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : "network";
    console.error("[Septlion interpreter] provider request failed:", status);
    return out({ result: null, mode: "unavailable" }, 503);
  }
});
