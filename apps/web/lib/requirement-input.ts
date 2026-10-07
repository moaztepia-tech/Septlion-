const destinations = ['تنزانيا','tanzania','غانا','ghana','كينيا','kenya','السعودية','saudi','مصر','egypt','الصومال','somalia','تشاد','chad','موريتانيا','mauritania','ليبيا','libya','قطر','qatar','السودان','sudan'];
const products: [RegExp,string][] = [[/دقيق كامل|whole wheat flour/i,'Whole Wheat Flour'],[/دقيق أساسي|دقيق اساسي|essential flour/i,'Essential Flour'],[/دقيق|flour/i,'Wheat Flour'],[/مكرونة|معكرونة|pasta|spaghetti/i,'Pasta'],[/صلصة|طماطم|tomato paste/i,'Tomato Paste'],[/سمسم|sesame/i,'Sesame'],[/كركدي|hibiscus/i,'Hibiscus'],[/صمغ عربي|gum arabic/i,'Gum Arabic'],[/كيس|اكياس|أكياس|عبو|packaging|pouch|bag/i,'Custom Packaging'],[/بسكويت|biscuit/i,'Biscuits'],[/زيت|oil/i,'Edible Oil']];

export function extractRequirement(raw: string): Record<string,string> {
  const text = raw.replace(/[٠-٩۰-۹]/g, n => String('٠١٢٣٤٥٦٧٨٩'.includes(n) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(n) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(n)));
  const out: Record<string,string> = {};
  const product = products.find(([pattern]) => pattern.test(text));
  if (product) out.product = product[1];
  const destination = destinations.find(d => text.toLowerCase().includes(d));
  if (destination) out.destination = destination;
  const containers = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*(حاوي(?:ة|ات)|fcl|containers?)/i);
  if (containers) out.quantity = containers[1].replace(',', '.') + ' FCL';
  else if (/حاويتين|حاويتان/.test(text)) out.quantity = '2 FCL';
  const tons = text.match(/([+-]?\d+(?:[.,]\d+)?)\s*(طن|mt|tons?)/i);
  if (tons) out.quantity = tons[1].replace(',', '.') + ' MT';
  const packing = text.match(/(\d+(?:[.,]\d+)?)\s*(كجم|كيلو|kg)/i);
  if (packing) out.packing = packing[1] + 'kg';
  if (/مخابز|خبازو|خبز|bakery|bread/i.test(text)) out.application = 'Bakery';
  const incoterm = text.match(/\b(CIF|CFR|FOB)\b/i);
  if (incoterm) out.incoterm = incoterm[1].toUpperCase();
  if (/\bL\/?C\b|اعتماد مستندي/i.test(text)) out.payment = 'L/C';
  else if (/\bT\/?T\b/i.test(text)) out.payment = 'T/T';
  return out;
}

export function mergeRequirementInput(text: string, context: Record<string,string> = {}) {
  // Explicit buyer text overrides the starter defaults; no quantity is discarded.
  const parsed=extractRequirement(text);
  if(parsed.product==='Wheat Flour'&&/flour/i.test(context.product||'')&&context.product!=='Wheat Flour'&&!parsed.application)delete parsed.product;
  return {...context,...parsed};
}
