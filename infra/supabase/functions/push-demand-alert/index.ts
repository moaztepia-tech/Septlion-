import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC = "BH9wlH9Mz0dN8Fc1Nc9EvJG7AASDBHJqhF9guC2Qxoj8EPSf4v94D73i9KN393X6RL66e0RUnmIPHxKLUjmyrnU";

function b64urlBytes(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function vapidToken(audience: string, privateD: string) {
  const pub = b64urlBytes(VAPID_PUBLIC);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("Invalid VAPID public key");

  const x = b64url(pub.slice(1, 33));
  const y = b64url(pub.slice(33, 65));

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateD, ext: true, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:info@septlion.com",
  }));
  const unsigned = `${header}.${payload}`;
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  ));
  return `${unsigned}.${b64url(sig)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: secret, error: secretError } = await db.rpc("get_septlion_vapid_private");
  if (secretError || !secret) {
    console.error("vapid secret", secretError);
    return Response.json({ ok: false, error: "VAPID unavailable" }, { status: 500 });
  }

  const { data: subscriptions, error } = await db
    .from("DemandPushSubscription")
    .select("id,endpoint,active")
    .eq("active", true);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let delivered = 0;
  let failed = 0;

  for (const sub of subscriptions || []) {
    try {
      const audience = new URL(sub.endpoint).origin;
      const token = await vapidToken(audience, secret);
      const response = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `vapid t=${token}, k=${VAPID_PUBLIC}`,
          "TTL": "120",
          "Urgency": "high",
          "Content-Length": "0",
        },
      });

      if (response.status === 201 || response.status === 202) {
        delivered++;
        await db.from("DemandPushSubscription")
          .update({ lastSuccessAt: new Date().toISOString(), lastError: null, updatedAt: new Date().toISOString() })
          .eq("id", sub.id);
      } else {
        failed++;
        const gone = response.status === 404 || response.status === 410;
        await db.from("DemandPushSubscription")
          .update({
            active: gone ? false : true,
            lastError: `HTTP ${response.status}`,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }
    } catch (e) {
      failed++;
      await db.from("DemandPushSubscription")
        .update({
          lastError: e instanceof Error ? e.message : String(e),
          updatedAt: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }
  }

  return Response.json({ ok: true, subscriptions: (subscriptions || []).length, delivered, failed });
});