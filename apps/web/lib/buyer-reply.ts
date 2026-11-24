// Ready-to-send replies for buyers the radar found on B2B marketplaces (go4WorldBusiness,
// TradeWheel, ...). Their contact details sit behind the marketplace, so the team replies
// on the marketplace itself with this text. Nothing is sent automatically.

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SITE = 'https://www.septlion.com';

export type DemandPageRef = {slug: string; market: string; productKey: string};

export async function fetchDemandPages(): Promise<DemandPageRef[]> {
 if (!URL_BASE || !KEY) return [];
 const r = await fetch(`${URL_BASE}/rest/v1/PublicDemandIntentPage?select=slug,market,productKey&limit=500`, {headers: {apikey: KEY}, cache: 'no-store'});
 if (!r.ok) return [];
 return await r.json() as DemandPageRef[];
}

const norm = (v?: string | null) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// The demand page for this market, so the buyer lands on a page about exactly what they asked for.
export function replyLink(market: string, pages: DemandPageRef[]): string {
 const m = norm(market);
 if (m) {
  const exact = pages.find(p => norm(p.market) === m);
  const near = exact || pages.find(p => { const pm = norm(p.market); return pm && (m.includes(pm) || pm.includes(m)); });
  if (near) return `${SITE}/demand/${near.slug}/`;
 }
 return `${SITE}/require/`;
}

const ARAB = /(saudi|emirates|uae|oman|qatar|bahrain|kuwait|jordan|iraq|yemen|lebanon|syria|egypt|sudan|libya|tunisia|algeria|morocco|السعودية|الإمارات|عمان|قطر|البحرين|الكويت|الأردن|العراق|مصر|السودان)/i;

export function buyerReply(o: {buyerName?: string | null; product: string; market: string; quantity?: string | null; link: string}): string {
 const name = (o.buyerName || '').trim();
 const product = o.product.replace(/^wanted\s*:\s*/i, '').replace(/^bulk purchase inquiry for\s*/i, '').trim() || o.product;
 const qty = o.quantity ? ` (${o.quantity})` : '';
 const en = [
  `Hello${name ? ' ' + name : ''},`,
  '',
  `We saw your request for ${product}${qty} for ${o.market}. Septlion Supply can quote this on FOB, CFR or CIF terms.`,
  '',
  'To send you a firm offer, please share: destination port, quantity per shipment, packing (e.g. 25 kg / 50 kg bags), specification and delivery window.',
  '',
  `You can also submit the requirement directly here and we will reply with one clear offer: ${o.link}`,
  '',
  'Best regards,',
  'Septlion Supply',
  SITE,
 ].join('\n');
 if (!ARAB.test(o.market)) return en;
 const ar = [
  `مرحبًا${name ? ' ' + name : ''}،`,
  `اطلعنا على طلبك لـ ${product}${qty} إلى ${o.market}. تستطيع سبتليون تقديم عرض بشروط FOB أو CFR أو CIF.`,
  `أرسل لنا ميناء الوصول والكمية والتعبئة وموعد التسليم، أو قدّم طلبك مباشرة هنا: ${o.link}`,
  'مع التحية، فريق سبتليون',
 ].join('\n');
 return en + '\n\n---\n\n' + ar;
}
