// Sends the team's queued request alerts (public."TeamAlert") by email and WhatsApp.
// Called by the database right after a buyer request is saved, and every 10 minutes
// by cron for retries. It takes no input from the caller: it only flushes the queue.
//
// Secrets (Supabase > Edge Functions > Secrets). A channel without its secret is
// skipped and its alerts wait, so they go out once it is configured.
//   RESEND_API_KEY      email through resend.com
//   ALERT_EMAIL_TO      optional, comma separated; default: info@septlion.com (the
//                       Resend account's own address)
//   ALERT_EMAIL_FROM    optional; default "Septlion <onboarding@resend.dev>" (Resend's
//                       test sender, which delivers only to the Resend account's email
//                       until septlion.com is verified in Resend)
//   TELEGRAM_BOT_TOKEN  phone messages through a Telegram bot (from @BotFather)
//   TELEGRAM_CHAT_ID    optional, comma separated; default: every chat that sent the
//                       bot a message in the last 24 hours (their ids are logged)
//   CALLMEBOT_WHATSAPP  optional WhatsApp through callmebot.com: "phone:apikey", comma
//                       separated for several people, e.g. "+249123456789:123456"
// The queue's "whatsapp" channel means "a message to the team's phone": it goes to
// Telegram and/or CallMeBot, whichever is configured.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseTelegramChats, parseWhatsappTargets, splitEmails } from "./targets.ts";

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
  if (emailTo.length === 0) emailTo = ["info@septlion.com"];
  const emailFrom = Deno.env.get("ALERT_EMAIL_FROM") || "Septlion <onboarding@resend.dev>";

  const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  let telegramChats = parseTelegramChats(Deno.env.get("TELEGRAM_CHAT_ID") || "");
  if (telegramToken && telegramChats.length === 0) telegramChats = await telegramRecentChats(telegramToken);

  const channels: string[] = [];
  if (resendKey && emailTo.length) channels.push("email");
  if (whatsapp.length || (telegramToken && telegramChats.length)) channels.push("whatsapp");

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
      else await sendPhone(telegramToken, telegramChats, whatsapp, alert);
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

async function sendEmail(key: string, from: string, to: string[], alert: Alert) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: alert.subject, text: alert.body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Resend HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// Telegram first, then CallMeBot; the alert counts as sent when any one reached the team.
async function sendPhone(token: string, chats: string[], whatsapp: { phone: string; apikey: string }[], alert: Alert) {
  const errors: string[] = [];
  let delivered = 0;
  for (const chat of token ? chats : []) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: alert.body, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) delivered++;
      else errors.push(`Telegram HTTP ${r.status}`);
    } catch (e) {
      errors.push(`Telegram ${e instanceof Error ? e.name : "error"}`);
    }
  }
  if (whatsapp.length) {
    try {
      await sendCallMeBot(whatsapp, alert);
      delivered++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (!delivered) throw new Error(errors.join("; ") || "no phone target");
}

async function telegramRecentChats(token: string): Promise<string[]> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?allowed_updates=%5B%22message%22%5D`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const data = await r.json();
    const ids = [...new Set((data.result || []).map((u: { message?: { chat?: { id?: number } } }) => u.message?.chat?.id).filter((id: unknown) => typeof id === "number").map(String))] as string[];
    if (ids.length) console.log(JSON.stringify({ event: "notify-team.telegram-chats", chats: ids }));
    return ids;
  } catch {
    return [];
  }
}

async function sendCallMeBot(targets: { phone: string; apikey: string }[], alert: Alert) {
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
