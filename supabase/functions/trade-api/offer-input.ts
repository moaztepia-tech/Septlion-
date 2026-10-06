type Row = Record<string, any>;
export function sameJson(a: unknown, b: unknown): boolean {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
const INCOTERMS = new Set(['FOB', 'CIF', 'EXW', 'DAP', 'FCA']);
const PAYMENTS = new Set(['LC', 'TT', 'OPEN_ACCOUNT']);
function text(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`بيانات ${label} غير صالحة`);
  return value.trim();
}
function positive(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e9) throw new Error(`قيمة ${label} غير صالحة`);
  return value;
}
export function normalizeOffer(body: Row, requirement: Row, now = Date.now()) {
  const input = body.snapshot;
  if (!input || typeof input !== 'object' || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) throw new Error('أضف من بند واحد إلى 20 بندًا للعرض');
  const issueKey = text(body.idempotencyKey, 'مفتاح الإصدار', 100);
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(issueKey)) throw new Error('مفتاح الإصدار غير صالح');
  const currency = text(body.currency, 'العملة', 3).toUpperCase();
  if (!['USD', 'EUR', 'AED', 'SAR', 'EGP'].includes(currency)) throw new Error('العملة غير مدعومة');
  const valid = typeof body.validUntil === 'string' ? Date.parse(body.validUntil) : NaN;
  if (!Number.isFinite(valid) || valid <= now || valid > now + 31 * 86400000) throw new Error('حدد صلاحية مستقبلية خلال 31 يومًا');
  const items = input.items.map((item: Row) => ({
    description: text(item?.description, 'وصف البند'),
    quantity: positive(item?.quantity, 'الكمية'),
    unit: text(item?.unit, 'الوحدة', 30),
    unitPrice: positive(item?.unitPrice, 'السعر'),
  }));
  const total = items.reduce((sum: number, item: Row) => sum + item.quantity * item.unitPrice, 0);
  if (!Number.isFinite(total) || total > 1e12) throw new Error('إجمالي العرض غير صالح');
  const incoterm = text(input.terms?.incoterm, 'شرط التجارة', 3);
  const payment = text(input.terms?.payment, 'شروط الدفع', 30);
  if (!INCOTERMS.has(incoterm) || !PAYMENTS.has(payment)) throw new Error('اختر شرط التجارة والدفع من القائمة');
  const testOnly = /^TEST(?:\s|—|-|$)/i.test(String(requirement.product || ''));
  const evidence = typeof input.supplyEvidence?.reference === 'string' ? input.supplyEvidence.reference.trim() : '';
  if (!testOnly && (!evidence || evidence.length > 200)) throw new Error('مرجع عرض المورد مطلوب قبل إصدار عرض تجاري');
  const notes = typeof input.terms?.notes === 'string' ? input.terms.notes.trim() : '';
  if (notes.length > 1000) throw new Error('الملاحظات تتجاوز 1000 حرف');
  return {
    currency, validUntil: new Date(valid).toISOString(),
    snapshot: {
      issueKey, testOnly, requirementId: requirement.id, product: String(requirement.product), items,
      terms: {
        incoterm, payment,
        destination: String(requirement.deliveryPort || requirement.deliveryCountry || requirement.market || ''),
        packing: typeof requirement.packing === 'string' ? requirement.packing : String(requirement.packing?.display || ''),
        notes,
        notice: testOnly ? 'TEST — للاختبار التقني فقط. هذا المستند غير ملزم ولا يمثل بيعًا أو شحنة أو التزامًا بالدفع.' : 'العرض صالح حتى التاريخ المحدد، ويخضع لتأكيد التوفر والمواصفات وشروط التسليم المتفق عليها.',
      },
      supplyEvidence: { reference: testOnly ? 'NON-COMMERCIAL TEST' : evidence },
    },
  };
}
