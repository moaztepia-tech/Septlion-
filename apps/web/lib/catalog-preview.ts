// Product configurations approved for Zollana. Availability is confirmed in the offer.
export const catalogPreview = [
  {id:'flour-bakery',eyebrow:'ZOLLANA · FLOUR',name:'دقيق خبازو',en:'Bakery Flour',pack:'50 كجم · 25 كجم',note:'مواصفة المخابز تُثبت في العرض'},
  {id:'flour-basic',eyebrow:'ZOLLANA · FLOUR',name:'دقيق أساسي',en:'Essential Flour',pack:'50 كجم · 25 كجم · 1 كجم',note:'تكوين التعبئة حسب احتياج السوق'},
  {id:'flour-complete',eyebrow:'ZOLLANA · FLOUR',name:'دقيق كامل',en:'Whole Wheat Flour',pack:'50 كجم · 10 كجم · 1 كجم',note:'المواصفة التجارية تُثبت في العرض'},
] as const;

// Product Details carries the matching Discover selection into Composer.
// Ignore stale selections belonging to a different product and invalid values.
export function restoreCatalogSelection(productId: string, raw: string | null): Record<string, string> {
  try {
    const saved = JSON.parse(raw || 'null');
    if (!saved || !Number.isInteger(saved.active) || catalogPreview[saved.active as 0 | 1 | 2]?.id !== productId) return {};
    const data:Record<string,string> = {};
    if (Number.isInteger(saved.count) && saved.count > 0 && saved.count <= 1000000000) data.quantity = saved.count + ' FCL';
    if (['CIF','CFR','FOB'].includes(saved.incoterm)) data.incoterm = saved.incoterm;
    if (['L/C','T/T','OTHER'].includes(saved.payment)) data.payment = saved.payment;
    const ports:Record<string,string> = {SAJED:'Jeddah Islamic Port',TZDAR:'Dar es Salaam',KEMBA:'Mombasa',SOMGQ:'Mogadishu',AEJEA:'Jebel Ali',SDPZU:'Port Sudan',GHTEM:'Tema',NGAPP:'Lagos / Apapa'};
    if (typeof saved.destinationCode === 'string' && ports[saved.destinationCode]) data.destination = ports[saved.destinationCode];
    return data;
  } catch {return {};}
}
