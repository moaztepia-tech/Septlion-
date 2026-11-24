// Search and AI-search layer for the customer home page (run after the platform
// package and the customer client are in deploy/). It does not change how the
// page looks:
//  - deploy/index.html gets hreflang links, schema.org data (Organization,
//    WebSite, Product list) and the product cards as plain HTML inside #feed,
//    so crawlers that do not run JavaScript can read them. The page's own script
//    replaces that HTML with the interactive cards as soon as it runs.
//  - deploy/en/index.html: an English home page (same products, same contacts).
//  - deploy/sitemap.xml and deploy/llms.txt are rebuilt from what is actually
//    being published, including every demand page in deploy/demand/feed.json.
//  - deploy/markets/: one page per target country in Africa and the Middle East
//    (scripts/market-pages.mjs), in Arabic, French or English.
// Prices are never published: there is no price in the product data.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {allMarketPages, pageHead, topBar, productGrid, stepsList, faqList, footer, dock, MARKETS, marketUrl} from './market-pages.mjs';
import {ICON_WA} from './seo-theme.mjs';

export const SITE = 'https://www.septlion.com';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_URL = SITE + '/new-app/data/products.json';
const WHATSAPP = '+201070088181', EMAIL = 'info@septlion.com';

export const esc = (v = '') => String(v).replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[m]));
const ld = v => JSON.stringify(v).replace(/</g, '\\u003c');
const latin = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٬/g, ',');
const img = u => !u ? null : /^https?:/.test(u) ? u : SITE + '/new-app/' + String(u).replace(/^\/?(new-app\/)?/, '');
const field = (p, label) => (p.fields || []).find(f => f.l === label)?.v || '';

// Arabic catalog wording -> English. Unknown values fall back to a neutral English label.
const NAMES = {'زولانا أساسي': 'Zollana Asasi', 'زولانا خبازو': 'Zollana Khabbazo', 'زولانا كامل': 'Zollana Kamel'};
const TYPES = {'دقيق القمح متعدد الاستخدامات': 'All-purpose wheat flour', 'دقيق القمح للمخابز': 'Bakery wheat flour', 'دقيق القمح الكامل': 'Whole wheat flour'};
const USES = {'للطهي والخبز': 'Cooking and baking', 'للخبز والمخبوزات': 'Bread and bakery products', 'للخبز الكامل': 'Whole-grain bread'};
const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
export function englishProduct(p) {
  const size = latin(p.size).replace(/كجم/g, 'kg').replace(/لتر/g, 'L').trim();
  const pack = /شرنك|ورقي/.test(p.pack || '') ? 'Paper bags, shrink-wrapped 10 × 1 kg' : /شوال|منسوج/.test(p.pack || '') ? 'Woven PP sack' : latin(p.pack);
  const qty = latin(field(p, 'كمية الحاوية'));
  const n = qty.match(/[\d,]+/)?.[0];
  const unit = /شوال/.test(qty) ? 'sacks' : /مجموعة/.test(qty) ? 'shrink packs' : 'units';
  return {
    id: p.id, brand: p.brand || '', image: img((p.imgs || [])[0]),
    name: NAMES[p.name] || [p.brand, titleCase(p.tag)].filter(Boolean).join(' '),
    type: TYPES[p.type] || titleCase(p.tag) || 'Product', use: USES[field(p, 'الاستخدام')] || '',
    size, pack, moq: 'One 20 ft container',
    perContainer: n ? `About ${n} ${unit} per 20 ft container` : 'Confirmed in the quotation',
  };
}

function organization() {
  return {
    '@type': 'Organization', '@id': SITE + '/#organization', name: 'SEPTLION', alternateName: ['Septlion', 'سبتليون', 'Septlion Supply'],
    legalName: 'SEPTLION LLC', url: SITE + '/', logo: SITE + '/brand/septlion-primary-navy.png', email: EMAIL, telephone: WHATSAPP,
    address: {'@type': 'PostalAddress', addressCountry: 'US'}, areaServed: ['Middle East', 'Africa'],
    description: 'SEPTLION is a B2B managed-trade company: it turns a buyer requirement into a quotation and coordinates supply, manufacturing and logistics through to delivery.',
    contactPoint: [{'@type': 'ContactPoint', contactType: 'sales', telephone: WHATSAPP, email: EMAIL, availableLanguage: ['ar', 'en']}],
    brand: {'@type': 'Brand', name: 'ZOLLANA'},
  };
}
export function structuredData(products, lang) {
  const en = lang === 'en', page = en ? SITE + '/en/' : SITE + '/';
  const items = products.map((p, i) => {
    const e = englishProduct(p);
    return {'@type': 'ListItem', position: i + 1, item: {
      '@type': 'Product', '@id': SITE + '/#product-' + p.id, sku: p.id,
      name: en ? `${e.name} ${e.size}` : `${p.name} ${p.size || ''}`.trim(),
      description: en ? [e.type, e.use, e.pack].filter(Boolean).join(' · ') : [p.type, field(p, 'الاستخدام'), p.pack].filter(Boolean).join(' · '),
      brand: {'@type': 'Brand', name: p.brand || 'ZOLLANA'}, category: en ? 'Wheat flour' : 'دقيق القمح',
      ...(e.image ? {image: e.image} : {}),
      manufacturer: {'@id': SITE + '/#organization'},
      additionalProperty: [
        {'@type': 'PropertyValue', name: en ? 'Pack size' : 'وزن العبوة', value: en ? e.size : p.size},
        {'@type': 'PropertyValue', name: en ? 'Packing' : 'التعبئة', value: en ? e.pack : p.pack},
        {'@type': 'PropertyValue', name: en ? 'Minimum order' : 'أقل طلب', value: en ? e.moq : 'حاوية واحدة ٢٠ قدمًا'},
        {'@type': 'PropertyValue', name: en ? 'Per container' : 'كمية الحاوية', value: en ? e.perContainer : field(p, 'كمية الحاوية') || 'تُحدد بعرض السعر'},
      ],
    }};
  });
  return {'@context': 'https://schema.org', '@graph': [
    organization(),
    {'@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'SEPTLION', inLanguage: ['ar', 'en'], publisher: {'@id': SITE + '/#organization'}},
    {'@type': 'WebPage', '@id': page + '#webpage', url: page, inLanguage: en ? 'en' : 'ar', isPartOf: {'@id': SITE + '/#website'}, about: {'@id': SITE + '/#organization'},
      name: en ? 'SEPTLION — B2B supply from requirement to delivery' : 'سبتليون — توريد تجاري من الاحتياج إلى التنفيذ'},
    {'@type': 'ItemList', '@id': page + '#products', name: en ? 'ZOLLANA flour range' : 'منتجات زولانا', numberOfItems: items.length, itemListElement: items},
  ]};
}

const HREFLANG = `<link rel="alternate" hreflang="ar" href="${SITE}/">\n<link rel="alternate" hreflang="en" href="${SITE}/en/">\n<link rel="alternate" hreflang="x-default" href="${SITE}/">`;
export function staticCards(products) {
  return products.map(p => {
    const facts = [p.pack, field(p, 'أقل طلب') && 'أقل طلب: ' + field(p, 'أقل طلب'), field(p, 'كمية الحاوية') && 'الحاوية: ' + field(p, 'كمية الحاوية')].filter(Boolean).join(' · ');
    const src = img((p.imgs || [])[0]);
    return `<article class="gcard" data-id="${esc(p.id)}"><div class="gmeta"><strong>${esc(p.name)}</strong><small>${esc([p.type, p.size].filter(Boolean).join(' · '))}</small></div>` +
      (src ? `<img src="${esc(src)}" alt="${esc(`${p.name} ${p.size || ''} — ${p.brand || ''}`.trim())}" loading="lazy" width="320" height="320">` : '') +
      `<p>${esc(facts)}</p></article>`;
  }).join('');
}
export function homepageSeo(html, products) {
  let out = html;
  const feed = '<div class="feed" id="feed" aria-label="بطاقات الأصناف، اسحب للأعلى للتالي" tabindex="0"></div>';
  if (out.split(feed).length !== 2) throw new Error('Home page: product feed container not found exactly once');
  if (out.split('<link rel="canonical" href="https://www.septlion.com/">').length !== 2) throw new Error('Home page: canonical link not found exactly once');
  out = out.replace(feed, feed.replace('></div>', '>' + staticCards(products) + '</div>'));
  out = out.replace('<link rel="canonical" href="https://www.septlion.com/">', '<link rel="canonical" href="https://www.septlion.com/">\n' + HREFLANG);
  out = out.replace('<meta property="og:locale" content="ar_AR">', '<meta property="og:locale" content="ar_AR"><meta property="og:locale:alternate" content="en_US">');
  out = out.replace('</head>', `<script type="application/ld+json">${ld(structuredData(products, 'ar'))}</script>\n</head>`);
  return out;
}

export function englishHome(products, demand = []) {
  const url = SITE + '/en/';
  const wa = `https://wa.me/${WHATSAPP.slice(1)}?text=${encodeURIComponent('Hello SEPTLION,\nI need a quotation for ZOLLANA wheat flour.\nProduct and bag size: …\nQuantity (containers): …\nDestination port: …')}`;
  const alternates = [{lang: 'ar', href: SITE + '/'}, {lang: 'en', href: url}, {lang: 'x-default', href: SITE + '/'}];
  const routes = demand.slice(0, 12).map(p => `<li><a href="/demand/${esc(p.slug)}/">${esc(p.title || (p.product + ' — ' + p.market))}</a></li>`).join('');
  const markets = MARKETS.map(m => `<li><a href="${marketUrl(m, m.langs[0])}">${esc(m.names.en)}</a></li>`).join('');
  const faq = [
    ['What does SEPTLION sell?', 'ZOLLANA wheat flour: all-purpose, bakery and whole wheat flour, in 50 kg, 25 kg and 10 kg sacks and 1 kg packs.'],
    ['What is the minimum order?', 'One 20 ft container of any product.'],
    ['Where do you deliver?', 'To buyers across the Middle East and Africa, under FOB, CFR or CIF terms to the port you name.'],
    ['How is the price set?', 'Each quotation is priced for the destination, volume, packing, Incoterm and payment terms. Prices are not published.'],
    ['Who is SEPTLION?', 'SEPTLION LLC is a US-registered B2B managed-trade company. It turns a buyer requirement into one quotation and coordinates supply, manufacturing, documents and logistics to delivery.'],
  ];
  const jsonld = [structuredData(products, 'en'), {'@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'en', mainEntity: faq.map(([q, a]) => ({'@type': 'Question', name: q, acceptedAnswer: {'@type': 'Answer', text: a}}))}];
  return pageHead({lang: 'en', title: 'SEPTLION — Wholesale Wheat Flour Supply to the Middle East and Africa',
    desc: 'SEPTLION is a US-registered B2B managed-trade company. Send your requirement and receive one clear quotation for ZOLLANA wheat flour, with supply and logistics coordinated to the Middle East and Africa.',
    url, alternates, jsonld}) + topBar('en', {home: '/en/', wa, alt: [{lang: 'ar', href: '/', label: 'العربية'}]}) + `
<main>
<section class="hero wrap"><span class="eyebrow">Global commerce · Est. USA</span><h1>From your requirement <em>to delivery.</em></h1><p class="lead">ZOLLANA wheat flour for importers, mills, bakeries and wholesalers across the Middle East and Africa. Tell us what you need and SEPTLION returns one clear quotation, then coordinates supply, manufacturing and logistics to your port.</p>
<div class="cta"><a class="btn pri" href="${esc(wa)}">${ICON_WA}Request a quotation on WhatsApp</a><a class="btn" href="mailto:${EMAIL}">Email ${EMAIL}</a></div>
<div class="facts"><div><span>Minimum order</span><b>One 20 ft container</b></div><div><span>Incoterms</span><b>FOB · CFR · CIF</b></div><div><span>Markets</span><b>Middle East · Africa</b></div><div><span>Packing</span><b>1 kg to 50 kg</b></div></div></section>
<section class="block wrap" id="products" aria-labelledby="pH"><div class="head"><div><span class="eyebrow">ZOLLANA</span><h2 id="pH">ZOLLANA flour range</h2><p class="sub">Minimum order is one 20 ft container. Prices are given in the quotation for your destination, volume and terms.</p></div></div>${productGrid(products, 'en')}</section>
<section class="block wrap" id="how" aria-labelledby="hH"><div class="head"><div><span class="eyebrow">SEPTLION</span><h2 id="hH">How it works</h2></div></div>${stepsList('en')}</section>
<section class="block wrap" aria-labelledby="mH"><div class="head"><div><span class="eyebrow">Markets</span><h2 id="mH">Where we supply</h2><p class="sub">A page for each market, in Arabic, French or English.</p></div><a class="btn" href="/markets/">All markets</a></div><ul class="chips">${markets}</ul></section>
${routes ? `<section class="block wrap" aria-labelledby="dH"><div class="head"><div><span class="eyebrow">Demand radar</span><h2 id="dH">Live demand routes</h2><p class="sub">Market pages built from recent public B2B buying signals. Each one has its own RFQ form.</p></div><a class="btn" href="/demand/">All routes</a></div><div class="panel"><ul class="routes">${routes}</ul></div></section>` : ''}
<section class="block wrap" aria-labelledby="fH"><div class="head"><h2 id="fH">Frequently asked questions</h2></div>${faqList(faq)}</section>
<section class="wrap"><div class="band"><div><h2>Ready for a quotation?</h2><p>Send your requirement on WhatsApp and receive one clear offer.</p></div><div class="cta"><a class="btn pri" href="${esc(wa)}">${ICON_WA}Request a quotation</a><a class="btn" href="mailto:${EMAIL}">Email</a></div></div></section>
</main>
${footer('en', '/en/')}${dock('en', wa)}
</body></html>
`;
}

export function sitemapXml(entries) {
  const alt = e => (e.alternates || []).map(a => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.map(e => `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}${alt(e)}</url>`).join('\n') + '\n</urlset>\n';
}
export function siteEntries({demand = [], hasRadarEn = false, markets = [], now = new Date().toISOString()}) {
  const home = [{lang: 'ar', href: SITE + '/'}, {lang: 'en', href: SITE + '/en/'}, {lang: 'x-default', href: SITE + '/'}];
  const radar = hasRadarEn ? [{lang: 'ar', href: SITE + '/demand-intelligence/'}, {lang: 'en', href: SITE + '/demand-intelligence/en/'}] : [];
  const day = now.slice(0, 10);
  const latest = demand.map(p => String(p.updatedAt || '').slice(0, 10)).filter(Boolean).sort().pop() || day;
  return [
    {loc: SITE + '/', lastmod: day, alternates: home}, {loc: SITE + '/en/', lastmod: day, alternates: home},
    {loc: SITE + '/demand-intelligence/', lastmod: latest, alternates: radar},
    ...(hasRadarEn ? [{loc: SITE + '/demand-intelligence/en/', lastmod: latest, alternates: radar}] : []),
    {loc: SITE + '/intent/wheat-flour/', lastmod: day}, {loc: SITE + '/demand/', lastmod: latest},
    ...demand.flatMap(p => {
      const loc = `${SITE}/demand/${p.slug}/`, lastmod = String(p.updatedAt || '').slice(0, 10) || latest;
      if (!p.arUrl) return [{loc, lastmod}];
      const alternates = [{lang: 'en', href: loc}, {lang: 'ar', href: p.arUrl}, {lang: 'x-default', href: loc}];
      return [{loc, lastmod, alternates}, {loc: p.arUrl, lastmod, alternates}];
    }),
    ...markets.map(m => ({loc: m.url, lastmod: day, alternates: m.alternates})),
  ];
}
export function llmsTxt(products, demand = [], markets = []) {
  const list = products.map(englishProduct).map(e => `- ${e.name} ${e.size} (${e.brand}): ${e.type}; ${e.pack}; minimum order ${e.moq.toLowerCase()}; ${e.perContainer.toLowerCase()}.`);
  return [
    '# SEPTLION', '',
    '> SEPTLION LLC is a US-registered B2B managed-trade company. A buyer describes a requirement; SEPTLION returns one quotation and, after agreement, coordinates supply, manufacturing, documents and logistics to delivery. Focus: wheat flour, the Middle East and Africa.', '',
    '## Key pages',
    `- Arabic home and product catalogue: ${SITE}/`, `- English home: ${SITE}/en/`,
    `- Demand radar (live public tenders and RFQs): ${SITE}/demand-intelligence/`,
    `- Wheat flour supply programme: ${SITE}/intent/wheat-flour/`, `- Market demand routes: ${SITE}/demand/`,
    `- Machine-readable demand index: ${SITE}/demand/ai-index.json`,
    ...(markets.length ? [`- Market pages for Africa and the Middle East: ${SITE}/markets/`] : []), '',
    '## Products (ZOLLANA brand)', ...list,
    '- Prices are not published; each quotation is priced for the destination, volume, Incoterm and payment terms.', '',
    '## How to buy',
    '1. Send the requirement on the site, on WhatsApp or by email: product, quantity (containers), packing, destination port.',
    '2. Receive one SEPTLION quotation (specification, quantity, destination, Incoterm, payment).',
    '3. After acceptance, follow execution: production, inspection, documents, shipment, delivery.', '',
    '## Demand intelligence',
    '- SEPTLION collects public tenders, RFQs and B2B buy requests every six hours, clusters them by product and market, and publishes market pages without exposing buyer identities.', '',
    ...(markets.length ? ['## Target markets (Africa and the Middle East)', ...markets.filter(m => m.market).map(m => `- ${m.market} (${m.lang}): ${m.url}`), ''] : []),
    ...(demand.length ? ['## Live demand routes', ...demand.map(p => `- ${p.title || p.product + " — " + p.market}: ${SITE}/demand/${p.slug}/` + (p.arUrl ? ` (Arabic: ${p.arUrl})` : '')), ''] : []),
    '## Contact', `- WhatsApp: ${WHATSAPP}`, `- Email: ${EMAIL}`, '',
  ].join('\n');
}

export async function loadProducts(fetchImpl = globalThis.fetch) {
  try {
    const r = await fetchImpl(PRODUCTS_URL, {signal: AbortSignal.timeout(8000)});
    if (r.ok) { const d = await r.json(); if (Array.isArray(d?.products) && d.products.length) return {products: d.products, source: 'live'}; }
  } catch { /* fall back to the snapshot */ }
  const d = JSON.parse(await readFile(path.join(ROOT, 'sites/customer-client/seo/products.snapshot.json'), 'utf8'));
  return {products: d.products, source: 'snapshot'};
}

export async function applySeo(deployDir = path.join(ROOT, 'deploy'), {fetchImpl} = {}) {
  const {products, source} = await loadProducts(fetchImpl);
  const feedFile = path.join(deployDir, 'demand/feed.json');
  const demand = existsSync(feedFile) ? (JSON.parse(await readFile(feedFile, 'utf8')).pages || []) : [];
  const home = path.join(deployDir, 'index.html');
  await writeFile(home, homepageSeo(await readFile(home, 'utf8'), products));
  await mkdir(path.join(deployDir, 'en'), {recursive: true});
  await writeFile(path.join(deployDir, 'en/index.html'), englishHome(products, demand));
  const markets = allMarketPages(products);
  for (const m of markets) {
    await mkdir(path.dirname(path.join(deployDir, m.path)), {recursive: true});
    await writeFile(path.join(deployDir, m.path), m.html);
  }
  const hasRadarEn = existsSync(path.join(deployDir, 'demand-intelligence/en/index.html'));
  await writeFile(path.join(deployDir, 'sitemap.xml'), sitemapXml(siteEntries({demand, hasRadarEn, markets})));
  await writeFile(path.join(deployDir, 'llms.txt'), llmsTxt(products, demand, markets));
  console.log(`Search layer: ${products.length} products (${source}), ${demand.length} demand pages and ${markets.length} market pages in sitemap and llms.txt, English home at /en/.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await applySeo(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
