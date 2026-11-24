// Pure helpers for track-visit (tested in tests/track-visit.test.mjs).
const BOT = /bot|crawl|spider|slurp|bing|facebookexternalhit|preview|headless|lighthouse|curl|wget|python|node-fetch|deno|monitor|uptime/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);
export const deviceOf = (ua: string) => /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
export function cleanPath(v: unknown): string | null {
  const s = String(v ?? "");
  if (!s.startsWith("/") || s.length > 200) return null;
  const p = s.split(/[?#]/)[0].replace(/\/{2,}/g, "/");
  return /^[\w\-./%]*$/.test(p) ? (p.length > 1 ? p.replace(/\/$/, "") : "/") : null;
}
export function cleanReferrer(v: unknown): string | null {
  try {
    const u = new URL(String(v ?? ""));
    // Android apps (WhatsApp, Gmail...) send android-app://com.whatsapp/
    if (!/^(https?|android-app):$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return !h || h === "septlion.com" ? null : h.slice(0, 100);
  } catch { return null; }
}
export const cleanTag = (v: unknown) => { const s = String(v ?? "").trim().toLowerCase().slice(0, 60); return /^[a-z0-9._-]+$/.test(s) ? s : null; };

// Where the visit came from. AI assistants are their own group.
const AI: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$|^chatgpt/, "ChatGPT"],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$|^gemini/, "Gemini"],
  [/(^|\.)perplexity\.ai$|^perplexity/, "Perplexity"],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.com$|^copilot/, "Copilot"],
  [/(^|\.)claude\.ai$|^claude/, "Claude"],
  [/(^|\.)deepseek\.com$|^deepseek/, "DeepSeek"],
  [/(^|\.)(grok\.com|x\.ai)$|^grok/, "Grok"],
  [/(^|\.)meta\.ai$|^meta\.ai/, "Meta AI"],
  [/(^|\.)(chat\.mistral\.ai|you\.com|phind\.com|poe\.com|kimi\.com|chat\.qwen\.ai)$/, "مساعد آخر"],
];
const SEARCH: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android/, "Google"], [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)(duckduckgo\.com|yahoo\.com|search\.yahoo\.com|yandex\.[a-z]+|baidu\.com|ecosia\.org|search\.brave\.com)$/, "بحث آخر"],
];
const SOCIAL: [RegExp, string][] = [
  [/whatsapp|^wa\.me$|(^|\.)wl\.co$/, "WhatsApp"], [/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^com\.facebook/, "Facebook"],
  [/(^|\.)instagram\.com$|^com\.instagram/, "Instagram"], [/(^|\.)(t\.me|telegram\.org)$|^org\.telegram/, "Telegram"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X"], [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)tiktok\.com$/, "TikTok"], [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
];
export function classifySource(ref: string | null, tag: string | null): { source: string; name: string | null } {
  // ChatGPT and others add ?utm_source=chatgpt.com to links even when the referrer is hidden.
  for (const v of [tag, ref]) {
    if (!v) continue;
    for (const [re, name] of AI) if (re.test(v)) return { source: "ai", name };
  }
  for (const v of [ref, tag]) {
    if (!v) continue;
    if (/whatsapp/.test(v) || /^wa\.me$/.test(v)) return { source: "whatsapp", name: "WhatsApp" };
    if (/^com\.google\.android\.gm$|(^|\.)mail\.google\.com$/.test(v)) return { source: "other", name: "Gmail" };
    for (const [re, name] of SEARCH) if (re.test(v)) return { source: "search", name };
    for (const [re, name] of SOCIAL) if (re.test(v)) return { source: "social", name };
  }
  if (ref) return { source: "other", name: ref };
  if (tag) return { source: "other", name: tag };
  return { source: "direct", name: null };
}
export function countryOf(h: Headers): string | null {
  const c = (h.get("cf-ipcountry") || h.get("x-country") || "").toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : null;
}
