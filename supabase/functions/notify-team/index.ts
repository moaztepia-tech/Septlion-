// Sends the team's queued request alerts (public."TeamAlert") by email and WhatsApp.
// Called by the database right after a buyer request is saved, and every 10 minutes
// by cron for retries. It takes no input from the caller: it only flushes the queue.
//
// Secrets (Supabase > Edge Functions > Secrets). A channel without its secret is
// skipped and its alerts wait, so they go out once it is configured.
//   RESEND_API_KEY      email through resend.com
//   ALERT_EMAIL_TO      optional, comma separated; default: the team's ADMIN accounts
//   ALERT_EMAIL_FROM    optional; default "Septlion <onboarding@resend.dev>" (Resend's
//                       test sender, which delivers only to the Resend account's email
//                       until septlion.com is verified in Resend)
//   CALLMEBOT_WHATSAPP  WhatsApp through callmebot.com: "phone:apikey", comma separated
//                       for several people, e.g. "+249123456789:123456"
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseWhatsappTargets, splitEmails } from "./targets.ts";

const MAX_ATTEMPTS = 6;

type Alert = { id: string; reference: string; channel: "email" | "whatsapp"; subject: string; body: string; attempts: number };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const whatsapp = parseWhatsappTargets(Deno.env.get("CALLMEBOT_WHATSAPP") || "");
  let emailTo = splitEmails(Deno.env.get("ALERT_EMAIL_TO") || "");
  if (resendKey && emailTo.length === 0) emailTo = await adminEmails(db);
  const emailFrom = Deno.env.get("ALERT_EMAIL_FROM") || "Septlion <onboarding@resend.dev>";

  const channels: string[] = [];
  if (resendKey && emailTo.length) channels.push("email");
  if (whatsapp.length) channels.push("whatsapp");

  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const { data, error } = await db.from("TeamAlert")
    .select("id,reference,channel,subject,body,attempts")
    .eq("status", "PENDING").gte("createdAt", since).lt("attempts", MAX_ATTEMPTS)
    .order("createdAt", { ascending: true }).limit(20);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const result = { sent: 0, failed: 0, waiting: 0, channels };
  for (const alert of (data || []) as Alert[]) {
    if (!channels.includes(alert.channel)) {
      result.waiting++;
      await db.from("TeamAlert").update({ lastError: `${alert.channel} not configured` }).eq("id", alert.id);
      continue;
    }
    try {
      if (alert.channel === "email") await sendEmail(resendKey, emailFrom, emailTo, alert);
      else await sendWhatsapp(whatsapp, alert);
      result.sent++;
      await db.from("TeamAlert").update({ status: "SENT", sentAt: new Date().toISOString(), attempts: alert.attempts + 1, lastError: null }).eq("id", alert.id);
    } catch (e) {
      result.failed++;
      const attempts = alert.attempts + 1;
      await db.from("TeamAlert").update({
        attempts,
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      }).eq("id", alert.id);
    }
  }
  return Response.json({ ok: true, ...result });
});

async function adminEmails(db: ReturnType<typeof createClient>) {
  const { data: members } = await db.schema("core").from("Membership").select("userId").eq("role", "ADMIN");
  const ids = (members || []).map((m: { userId: string }) => m.userId);
  if (!ids.length) return [];
  const { data: users } = await db.schema("core").from("User").select("email,isActive").in("id", ids);
  return splitEmails((users || []).filter((u: { isActive: boolean }) => u.isActive !== false).map((u: { email: string }) => u.email).join(","));
}

async function sendEmail(key: string, from: string, to: string[], alert: Alert) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: alert.subject, text: alert.body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Resend HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function sendWhatsapp(targets: { phone: string; apikey: string }[], alert: Alert) {
  const errors: string[] = [];
  for (const t of targets) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(t.phone)}&text=${encodeURIComponent(alert.body)}&apikey=${encodeURIComponent(t.apikey)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    // CallMeBot answers 200 with an HTML page; success says "queued" or "sent".
    if (!r.ok || !/queued|sent/i.test(text)) errors.push(`…${t.phone.slice(-4)}: HTTP ${r.status}`);
  }
  if (errors.length === targets.length) throw new Error(`CallMeBot failed (${errors.join("; ")})`);
}
