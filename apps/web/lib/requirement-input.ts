// Priority markets first (Africa and the Middle East), then ports. Longer names come first so
// "جنوب السودان" wins over "السودان". Matching is on whole words, so "إجمالي" is not Mali.
const destinations = ['جنوب السودان','south sudan','بورتسودان','port sudan','دار السلام','dar es salaam','ساحل العاج','كوت ديفوار',"cote d'ivoire",'ivory coast','بوركينا فاسو','burkina faso','غينيا بيساو','guinea-bissau','سيراليون','sierra leone','الكونغو','congo','كوتونو','cotonou','لومي','lome','لاغوس','lagos','داكار','dakar','أبيدجان','ابيدجان','abidjan','مومباسا','mombasa','جيبوتي','djibouti','عدن','aden','جدة','jeddah','بنين','benin','مالي','mali','نيجيريا','nigeria','النيجر','niger','السنغال','senegal','الكاميرون','cameroon','توغو','togo','غينيا','guinea','غامبيا','gambia','ليبيريا','liberia','إثيوبيا','اثيوبيا','ethiopia','إريتريا','اريتريا','eritrea','أوغندا','اوغندا','uganda','رواندا','rwanda','بوروندي','burundi','موزمبيق','mozambique','أنغولا','انغولا','angola','زامبيا','zambia','زيمبابوي','zimbabwe','مالاوي','malawi','مدغشقر','madagascar','المغرب','morocco','الجزائر','algeria','تونس','tunisia','اليمن','yemen','العراق','iraq','الأردن','الاردن','jordan','لبنان','lebanon','سوريا','syria','الكويت','kuwait','البحرين','bahrain','عمان','oman','الإمارات','الامارات','uae','تنزانيا','tanzania','غانا','ghana','كينيا','kenya','السعودية','saudi','مصر','egypt','الصومال','somalia','تشاد','chad','موريتانيا','mauritania','ليبيا','libya','قطر','qatar','السودان','sudan'];
const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, name: string) => new RegExp('(?:^|[^\\p{L}])(?:[لبو])?' + escapeRe(name) + '(?:$|[^\\p{L}])', 'iu').test(text);
// Matching runs on a normalised copy: Arabic letter variants, diacritics and tatweel are unified,
// digits become Latin, and number words become digits. Output values keep their canonical form.
export function normalizeForMatch(raw: string) {
  return raw
    .replace(/[٠-٩]/g, n => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/[۰-۹]/g, n => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٬،]/g, '،').toLowerCase();
}
const wordNumbers: [RegExp, string][] = [[/(^|\s)(?:واحده|واحد)(?=\s)/g,'$11'],[/(^|\s)(?:اثنين|اثنان|اتنين)(?=\s)/g,'$12'],[/(^|\s)(?:ثلاثه|ثلاث|تلاته|تلات)(?=\s)/g,'$13'],[/(^|\s)(?:اربعه|اربع)(?=\s)/g,'$14'],[/(^|\s)(?:خمسه|خمس)(?=\s)/g,'$15'],[/(^|\s)(?:سته|ست)(?=\s)/g,'$16'],[/(^|\s)(?:سبعه|سبع)(?=\s)/g,'$17'],[/(^|\s)(?:ثمانيه|ثماني|ثمان|تمانيه)(?=\s)/g,'$18'],[/(^|\s)(?:تسعه|تسع)(?=\s)/g,'$19'],[/(^|\s)(?:عشره|عشر)(?=\s)/g,'$110'],[/(^|\s)عشرين(?=\s)/g,'$120'],[/(^|\s)ثلاثين(?=\s)/g,'$130'],[/(^|\s)خمسين(?=\s)/g,'$150'],[/(^|\s)(?:مائه|مئه|ميه|مية)(?=\s)/g,'$1100']];
const products: [RegExp, string][] = [
  [/دقيق (?:قمح )?كامل|طحين (?:اسمر|كامل)|whole ?wheat flour|wholemeal/, 'Whole Wheat Flour'],
  [/دقيق اساسي|essential flour/, 'Essential Flour'],
  [/سميد|سميذ|semolina/, 'Semolina'],
  [/دقيق|طحين|فرينه|فارينه|فارينا|farine|flour/, 'Wheat Flour'],
  [/مكرونه|معكرونه|باستا|اسباجتي|سباغيتي|pasta|spaghetti|macaroni/, 'Pasta'],
  [/صلصه|معجون طماطم|طماطم|بندوره|tomato paste/, 'Tomato Paste'],
  [/زيت (?:عباد|دوار) الشمس|sunflower oil/, 'Sunflower Oil'],
  [/زيت (?:ال)?نخيل|اولين|palm o(?:il|lein)/, 'Palm Oil'],
  [/زيت (?:ال)?صويا|soy(?:bean)? oil/, 'Soybean Oil'],
  [/(?:حليب|لبن) (?:بودره|مجفف)|milk powder/, 'Milk Powder'],
  [/سكر|sugar|icumsa/, 'Sugar'],
  [/(?:^|[^\p{L}])(?:ال)?(?:ارز|رز)(?:$|[^\p{L}])|(?:^|[^\p{L}])rice(?:$|[^\p{L}])/u, 'Rice'],
  [/(?:^|[^\p{L}])(?:ال)?شاي(?:$|[^\p{L}])|(?:^|[^\p{L}])tea(?:$|[^\p{L}])/u, 'Tea'],
  [/عدس|lentil/, 'Lentils'],
  [/(?:^|[^\p{L}])(?:ال)?فول(?:$|[^\p{L}])|fava|broad beans/u, 'Fava Beans'],
  [/خميره|yeast/, 'Yeast'],
  [/سمسم|sesame/, 'Sesame'],
  [/كركدي|hibiscus/, 'Hibiscus'],
  [/صمغ عربي|gum arabic/, 'Gum Arabic'],
  [/بسكويت|biscuit/, 'Biscuits'],
  [/(?:^|[^\p{L}])(?:ال)?قمح(?:$|[^\p{L}])|(?:^|[^\p{L}])wheat(?:$|[^\p{L}])/u, 'Wheat'],
  [/(?:^|[^\p{L}])(?:ال)?ذره(?:$|[^\p{L}])|maize|(?:^|[^\p{L}])corn(?:$|[^\p{L}])/u, 'Corn'],
  [/زيت|cooking oil|edible oil|(?:^|[^\p{L}])oil(?:$|[^\p{L}])/u, 'Edible Oil'],
];
const normDestinations = destinations.map(d => [d, normalizeForMatch(d)] as const);
// One-letter typos in longer names still match ("نيجيرا", "tanzaniya").
function nearWord(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1 || b.length < 5) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {i++; j++; continue;}
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else {i++; j++;}
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
const toNumber = (value: string) => /^\d{1,3}(?:,\d{3})+$/.test(value) ? value.replace(/,/g, '') : value.replace(',', '.');

export function extractRequirement(raw: string): Record<string,string> {
  let text = ' ' + normalizeForMatch(raw) + ' ';
  for (const [pattern, digit] of wordNumbers) text = text.replace(pattern, digit);
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:الف|آلاف|الاف|k)\s*(?=طن|اطنان|mt|ton)/g, (_, n) => String(Number(toNumber(n)) * 1000) + ' ');
  const out: Record<string,string> = {};
  const product = products.find(([pattern]) => pattern.test(text));
  if (product) out.product = product[1];
  else if (/(?:^|[^\p{L}])(?:اكياس|كيس|تغليف|عبوات فارغه)(?:$|[^\p{L}])|packaging|pouch|empty bags/u.test(text)) out.product = 'Custom Packaging';
  let destination: string | undefined = normDestinations.find(([, n]) => mentions(text, n))?.[0];
  if (!destination) {
    const words = text.split(/[^\p{L}']+/u).filter(w => w.length >= 5).map(w => w.replace(/^[لبو]/, ''));
    destination = normDestinations.find(([, n]) => !n.includes(' ') && words.some(w => nearWord(w, n) || nearWord(w.replace(/^ال/, ''), n.replace(/^ال/, ''))))?.[0];
  }
  if (destination) out.destination = destination;
  const containers = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*(?:x\s*)?(?:حاويات|حاويه|كونتينرات|كونتينر|fcl|containers?|cntrs?)(?:$|[^\p{L}])/u);
  if (containers) out.quantity = toNumber(containers[1]) + ' FCL';
  else if (/حاويتين|حاويتان|كونتينرين/.test(text)) out.quantity = '2 FCL';
  else if (/(?:^|[^\p{L}])(?:حاويه|كونتينر)(?: واحده| واحد)?(?:$|[^\p{L}\d])/u.test(text) && !/\d+\s*(?:طن|اطنان|طنا|mt|tons?|tonnes?)/.test(text) && /(?:احتاج|اريد|نريد|نحتاج|طلب|need|want)/.test(text)) out.quantity = '1 FCL';
  const tons = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*(?:طن|اطنان|طنا|mt|m\/t|tons?|tonnes?)(?:$|[^\p{L}])/u);
  if (tons) out.quantity = toNumber(tons[1]) + ' MT';
  const packing = text.match(/(\d+(?:[.,]\d+)?)\s*(?:كجم|كغ|كيلوجرام|كيلو|kgs?)(?:$|[^\p{L}])/u);
  if (packing) out.packing = packing[1] + 'kg';
  else {
    const litres = text.match(/(\d+(?:[.,]\d+)?)\s*(?:لتر|ltrs?|liters?|litres?|l)(?:$|[^\p{L}])/u);
    if (litres) out.packing = litres[1].replace(',', '.') + ' L';
  }
  if (/مخابز|خبازو|خبز|افران|bakery|bread/.test(text)) out.application = 'Bakery';
  const incoterm = text.match(/(?:^|[^a-z])(cif|cfr|c&f|cnf|fob)(?:$|[^a-z])/) || text.match(/(?:^|[^\p{L}])(سيف|فوب)(?:$|[^\p{L}])/u);
  if (incoterm) out.incoterm = ({'c&f':'CFR','cnf':'CFR','سيف':'CIF','فوب':'FOB'} as Record<string,string>)[incoterm[1]] || incoterm[1].toUpperCase();
  if (/(?:^|[^a-z])l\/?c(?:$|[^a-z])|اعتماد|letter of credit/.test(text)) out.payment = 'L/C';
  else if (/(?:^|[^a-z])t\/?t(?:$|[^a-z])|تحويل بنكي|حواله|wire transfer|bank transfer/.test(text)) out.payment = 'T/T';
  else if (/(?:^|[^a-z])(?:d\/p|cad)(?:$|[^a-z])|مستندات مقابل|مقابل المستندات|cash against documents/.test(text)) out.payment = 'OTHER';
  return out;
}

export function mergeRequirementInput(text: string, context: Record<string,string> = {}) {
  // Explicit buyer text overrides the starter defaults; no quantity is discarded.
  const parsed=extractRequirement(text);
  if(parsed.product==='Wheat Flour'&&/flour/i.test(context.product||'')&&context.product!=='Wheat Flour'&&!parsed.application)delete parsed.product;
  return {...context,...parsed};
}
