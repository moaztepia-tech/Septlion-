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
  try { const u = new URL(String(v ?? "")); if (!/^https?:$/.test(u.protocol)) return null; const h = u.hostname.replace(/^www\./, ""); return h === "septlion.com" ? null : h.slice(0, 100); } catch { return null; }
}
export function countryOf(h: Headers): string | null {
  const c = (h.get("cf-ipcountry") || h.get("x-country") || "").toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : null;
}
