// Arabic versions of the demand pages for Arab markets (Middle East and North/East Africa).
// Buyers there search in Arabic, so each Arab-market route also gets /demand/<slug>/ar/,
// linked to the English page with hreflang. Facts come from the same row as the English page.

const MARKETS = [
  ['saudi arabia', 'السعودية'], ['united arab emirates', 'الإمارات'], ['uae', 'الإمارات'], ['oman', 'عُمان'],
  ['qatar', 'قطر'], ['bahrain', 'البحرين'], ['kuwait', 'الكويت'], ['jordan', 'الأردن'], ['iraq', 'العراق'],
  ['yemen', 'اليمن'], ['lebanon', 'لبنان'], ['syria', 'سوريا'], ['palestine', 'فلسطين'], ['egypt', 'مصر'],
  ['sudan', 'السودان'], ['libya', 'ليبيا'], ['tunisia', 'تونس'], ['algeria', 'الجزائر'], ['morocco', 'المغرب'],
  ['mauritania', 'موريتانيا'], ['somalia', 'الصومال'], ['djibouti', 'جيبوتي'], ['comoros', 'جزر القمر'],
];

const CITIES = [['doha', 'الدوحة'], ['muscat', 'مسقط'], ['jebel ali', 'جبل علي'], ['dubai', 'دبي'], ['abu dhabi', 'أبوظبي'], ['riyadh', 'الرياض'], ['jeddah', 'جدة'], ['dammam', 'الدمام'], ['manama', 'المنامة'], ['amman', 'عمّان'], ['cairo', 'القاهرة'], ['alexandria', 'الإسكندرية'], ['khartoum', 'الخرطوم'], ['port sudan', 'بورتسودان'], ['tripoli', 'طرابلس'], ['benghazi', 'بنغازي']];

const PRODUCTS = [
  ['all purpose flour', 'دقيق القمح متعدد الاستخدامات'], ['all-purpose flour', 'دقيق القمح متعدد الاستخدامات'],
  ['whole wheat flour', 'دقيق القمح الكامل'], ['refined wheat flour', 'دقيق القمح الأبيض المكرر'],
  ['bakery flour', 'دقيق المخابز'], ['bread flour', 'دقيق الخبز'], ['wheat flour', 'دقيق القمح'], ['flour', 'الدقيق'],
];

const word = (text, key) => new RegExp('(^|[^a-z])' + key.replace(/[-\s]/g, '[-\\s]') + '([^a-z]|$)').test(text);

/** Arabic country name for a market string such as "Doha, Qatar, Qatar", or null when it is not an Arab market. */
export function arabicMarket(market = '') {
  const m = String(market).toLowerCase();
  if (word(m, 'south sudan')) return null; // English-speaking market
  const country = MARKETS.find(([en]) => word(m, en));
  if (!country) return null;
  const city = CITIES.find(([en]) => word(m, en));
  return city && city[1] !== country[1] ? city[1] + '، ' + country[1] : country[1];
}

export function arabicProduct(product = '') {
  const p = String(product).toLowerCase();
  return (PRODUCTS.find(([en]) => p.includes(en)) || [null, product])[1];
}

const quantityAr = q => String(q || '')
  .replace(/(\d+)\s*Twenty-Foot Containers?/gi, (_, n) => n === '1' ? 'حاوية 20 قدم واحدة' : n + ' حاويات 20 قدم')
  .replace(/(\d+)\s*Forty-Foot Containers?/gi, (_, n) => n === '1' ? 'حاوية 40 قدم واحدة' : n + ' حاويات 40 قدم')
  .replace(/FCL commercial supply/i, 'توريد تجاري بالحاويات الكاملة')
  .replace(/Commercial \/ FCL volume/i, 'كميات تجارية بالحاويات الكاملة');

export function arabicDemandPage({beacon, p, c = {}, product, englishUrl, intentUrl, signals, latest, quantities, shellCss, esc, json}) {
  const market = arabicMarket(p.market);
  const prod = arabicProduct(product);
  const url = englishUrl + 'ar/';
  const qty = quantityAr(quantities);
  const title = `توريد ${prod} إلى ${market} | SEPTLION`;
  const description = `مورد ${prod} للمستوردين وتجار الجملة في ${market}. حدّد الكمية والتعبئة وميناء الوصول وشروط التسليم، وأرسل طلب عرض سعر إلى SEPTLION.`;
  const summary = `تستطيع SEPTLION دراسة توريد ${prod} للمشترين في ${market}. تُظهر طلبات الشراء العامة الأخيرة اهتماماً تجارياً فعلياً بهذا السوق، ويتم تأكيد السعر النهائي والتعبئة والكمية وشروط التسليم من خلال طلب عرض السعر.`;
  const service = {
    '@context': 'https://schema.org', '@type': 'Service', name: `توريد ${prod} إلى ${market}`, inLanguage: 'ar',
    serviceType: 'توريد تجاري بين الشركات وإدارة الإمداد', areaServed: {'@type': 'Place', name: p.market},
    provider: {'@type': 'Organization', name: 'SEPTLION LLC', url: 'https://www.septlion.com/'}, url, description,
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'ar', mainEntity: [
      {'@type': 'Question', name: `هل تورّد SEPTLION ${prod} إلى ${market}؟`, acceptedAnswer: {'@type': 'Answer', text: 'نعم. أرسل ميناء الوصول والكمية والتعبئة والمواصفات وشروط التسليم، وتتحقق SEPTLION من مسار التوريد قبل إصدار عرض تجاري.'}},
      {'@type': 'Question', name: 'ما الكميات التي يمكن طلبها؟', acceptedAnswer: {'@type': 'Answer', text: 'كميات الجملة، وتبدأ من حاوية 20 قدم كاملة، ويمكن دراسة البرامج الأكبر حسب الطلب والوجهة.'}},
      {'@type': 'Question', name: 'ما شروط التسليم المتاحة؟', acceptedAnswer: {'@type': 'Answer', text: 'يمكن دراسة FOB وCFR وCIF بعد تأكيد الوجهة ومسار التوريد.'}},
      {'@type': 'Question', name: 'هل السعر ثابت؟', acceptedAnswer: {'@type': 'Answer', text: 'لا. السعر يُبنى على الطلب الفعلي: الكمية والتعبئة والوجهة وشروط التسليم.'}},
    ],
  };
  const signalLine = signals ? (signals === 1 ? 'طلب شراء عام واحد' : `${signals} طلبات شراء عامة`) : 'طلبات شراء عامة حديثة';
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ar" href="${url}"><link rel="alternate" hreflang="en" href="${englishUrl}"><link rel="alternate" hreflang="x-default" href="${englishUrl}">
<meta property="og:type" content="website"><meta property="og:locale" content="ar_AR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<script type="application/ld+json">${json(service)}</script>
<script type="application/ld+json">${json(faq)}</script>
<style>${shellCss}
body{font-family:"IBM Plex Sans Arabic","Noto Kufi Arabic",Tahoma,var(--font-ui)}h1,h2{letter-spacing:0}</style></head><body>
<header class="nav shell"><a class="brand" href="/" aria-label="SEPTLION الرئيسية"><img src="/brand/septlion-wordmark-navy.svg" alt="SEPTLION" width="144" height="52"></a><nav aria-label="القائمة الرئيسية"><a href="/">المنتجات</a><a href="/require">ابدأ طلباً</a><a href="${englishUrl}" hreflang="en" lang="en">English</a></nav></header>
<main>
<section class="hero shell"><p class="kicker">مسار توريد مبني على طلب السوق</p><h1>${esc(prod)}<br><em>${esc(market)}</em></h1><p class="lead">${esc(description)}</p><a class="cta" href="${intentUrl}">اطلب عرض توريد ↖</a></section>
<section class="shell"><div class="grid">
<div class="card"><small>السوق</small><b>${esc(market)}</b><p>مسار توريد مخصص لهذا السوق، وليس قائمة منتجات عامة.</p></div>
<div class="card"><small>الطلب في السوق</small><b>${esc(signalLine)}</b><p>آخر طلب رُصد بتاريخ ${esc(String(latest || '').slice(0, 10) || 'حديث')}.</p></div>
<div class="card"><small>الكمية المعتادة</small><b>${esc(qty)}</b><p>الكمية والتعبئة وطريقة الشحن النهائية تتأكد من طلب عرض السعر.</p></div>
</div></section>
<section class="section"><div class="shell"><p class="kicker">ملخص</p><h2>توريد ${esc(prod)} إلى ${esc(market)}</h2><p class="copy">${esc(summary)}</p></div></section>
<section class="section soft"><div class="shell"><p class="kicker">أسئلة شائعة</p><h2>كيف يتم الطلب؟</h2>
<div class="faq"><article><h3>ماذا أرسل؟</h3><p>ميناء الوصول، والكمية، والتعبئة المفضلة، ومواصفات المنتج، وموعد التسليم، وشرط الشحن (FOB أو CFR أو CIF).</p></article><article><h3>ماذا يحدث بعد ذلك؟</h3><p>يراجع فريق SEPTLION طلبك، ويختار مسار التوريد المناسب، ثم يرسل لك عرضاً تجارياً واحداً واضحاً.</p></article><article><h3>هل السعر ثابت؟</h3><p>لا. السعر يُبنى على طلبك الفعلي والوجهة وطريقة التوريد.</p></article></div>
<a class="cta" href="${intentUrl}">أرسل طلب عرض سعر لـ${esc(market)} ↖</a></div></section>
</main><footer class="footer shell">SEPTLION LLC · مسجلة في الولايات المتحدة · <a href="${englishUrl}" hreflang="en" lang="en">English version</a></footer>
${beacon||''}</body></html>`;
}
