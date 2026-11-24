// Privacy-friendly page-view counter for www.septlion.com.
// No cookies, nothing stored in the browser, and the IP address is never saved:
// the visitor id is a daily hash, so a person counts once per day only.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cleanPath, cleanReferrer, deviceOf, isBot, countryOf } from "./visit.ts";

const allowed = new Set(["https://septlion.com", "https://www.septlion.com"]);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const headers = { "Access-Control-Allow-Origin": allowed.has(origin) ? origin : "https://www.septlion.com", "Vary": "Origin" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "content-type" } });
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  if (!allowed.has(origin)) return new Response(null, { status: 204, headers });
  const ua = req.headers.get("User-Agent") || "";
  if (isBot(ua)) return new Response(null, { status: 204, headers });
  let body: Record<string, unknown> = {};
  try { const raw = await req.text(); if (raw.length > 2000) return new Response(null, { status: 413, headers }); body = JSON.parse(raw || "{}"); } catch { /* ignore */ }
  const path = cleanPath(body.p);
  if (!path) return new Response(null, { status: 204, headers });
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}|${ua}|${secret}`));
  const visitor = Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, secret, { auth: { persistSession: false } }).schema("core");
  const { error } = await db.from("SiteVisit").insert({ day, visitor, path, country: countryOf(req.headers), device: deviceOf(ua), referrer: cleanReferrer(body.r) });
  if (error) console.error("[track-visit] insert failed", error.code);
  return new Response(null, { status: 204, headers });
});
