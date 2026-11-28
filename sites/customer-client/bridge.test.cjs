// node --test sites/customer-client/bridge.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./public/septlion-bridge.js');

const contact = { name: 'أحمد', company: 'شركة النور', whatsapp: '+249 912 345 678', email: 'Buyer@Example.com ' };
const catalog = [{ id: 'prod-zollana-asasi', skus: [{ id: 'sku-asasi-50' }, { id: 'sku-asasi-25' }] }];

test('quantity text is read in Arabic and Latin', () => {
  assert.deepEqual(B.parseQuantity('3 حاويات'), { amount: 3, unit: 'FCL' });
  assert.deepEqual(B.parseQuantity('١٠٠ طن'), { amount: 100, unit: 'MT' });
  assert.deepEqual(B.parseQuantity('500 كجم'), { amount: 500, unit: 'KG' });
  assert.deepEqual(B.parseQuantity('2 FCL'), { amount: 2, unit: 'FCL' });
  assert.equal(B.parseQuantity('كمية كبيرة'), null);
  assert.equal(B.parseQuantity('100'), null, 'a number without a unit is asked again');
  assert.equal(B.parseQuantity('2.5 حاوية'), null, 'containers are whole numbers');
});

test('payment labels map to platform codes', () => {
  assert.equal(B.paymentCode('LC — اعتماد مستندي'), 'L/C');
  assert.equal(B.paymentCode('TT — تحويل بنكي'), 'T/T');
  assert.equal(B.paymentCode('OTHER'), 'OTHER');
  assert.equal(B.paymentCode(''), 'OTHER');
});

test('catalog ids map to platform SKUs', () => {
  assert.deepEqual(B.catalogRef('asasi50'), { productId: 'prod-zollana-asasi', skuId: 'sku-asasi-50' });
  assert.equal(B.catalogRef('oil-x'), null);
});

test('a product request becomes a linked FCL requirement', () => {
  const x = { id: 'RFQ-1234567', kind: 'sku', productId: 'asasi50', title: 'زولانا أساسي — 50 كجم', description: 'دقيق', dest: 'السعودية', port: 'جدة', qty: 3, incoterm: 'FOB', payment: 'TT — تحويل بنكي', note: 'قبل رمضان' };
  const i = B.buildInput(x, contact, {}, catalog);
  assert.equal(i.product, 'زولانا أساسي — 50 كجم');
  assert.equal(i.destination, 'السعودية · جدة');
  assert.equal(i.deliveryCountry, 'السعودية'); assert.equal(i.deliveryPort, 'جدة');
  assert.equal(i.quantity, 3); assert.equal(i.unit, 'FCL');
  assert.equal(i.incoterm, 'FOB'); assert.equal(i.paymentPreference, 'T/T');
  assert.equal(i.catalogProductId, 'prod-zollana-asasi');
  assert.deepEqual(i.variants, [{ skuId: 'sku-asasi-50', containers: 3 }]);
  assert.deepEqual(i.buyer, { name: 'أحمد', company: 'شركة النور', email: 'buyer@example.com', whatsapp: '249912345678' });
  assert.match(i.idempotencyKey, /^[A-Za-z0-9-]{12,100}$/);
  assert.equal(B.buildInput(x, contact, {}, catalog).idempotencyKey, i.idempotencyKey, 'a retry reuses the key');
});

test('an unknown catalog item is sent without a link', () => {
  const x = { id: 'RFQ-1', kind: 'sku', productId: 'kamel99', title: 'زولانا كامل', dest: 'مصر', qty: 1, incoterm: 'CIF', payment: 'LC — اعتماد مستندي' };
  const i = B.buildInput(x, contact, {}, catalog);
  assert.equal(i.catalogProductId, undefined);
  assert.equal(i.paymentPreference, 'L/C');
});

test('a free need asks for what is missing', () => {
  const x = { id: 'RFQ-2', kind: 'free', title: 'احتياج جديد', description: 'دقيق قمح للمخابز', quantity: 'كمية كبيرة', destination: '', terms: 'شوال 50' };
  assert.deepEqual(B.missing(x), ['destination', 'quantity', 'incoterm', 'payment']);
  assert.throws(() => B.buildInput(x, contact, {}, null), /الكمية/);
  const i = B.buildInput(x, contact, { amount: '٥', unit: 'FCL', destination: 'بورتسودان', incoterm: 'CIF', payment: 'OTHER' }, null);
  assert.equal(i.product, 'دقيق قمح للمخابز');
  assert.equal(i.destination, 'بورتسودان');
  assert.equal(i.quantity, 5); assert.equal(i.unit, 'FCL'); assert.equal(i.containerCount, 5);
  assert.equal(i.paymentPreference, 'OTHER');
  assert.equal(i.knownFacts.terms, 'شوال 50');
});

test('a free need with known quantity and destination only asks for terms', () => {
  const x = { id: 'RFQ-3', kind: 'free', description: 'زيت', quantity: '100 طن', destination: 'جدة' };
  assert.deepEqual(B.missing(x), ['incoterm', 'payment']);
  const i = B.buildInput(x, contact, { incoterm: 'CFR', payment: 'LC' }, null);
  assert.equal(i.unit, 'MT'); assert.equal(i.containerCount, null); assert.equal(i.paymentPreference, 'L/C');
});

test('contact details are checked before any code is sent', () => {
  const x = { id: 'RFQ-4', kind: 'sku', title: 'x', dest: 'مصر', qty: 1 };
  assert.throws(() => B.buildInput(x, { ...contact, email: 'no-at' }, {}, null), /بريد/);
  assert.throws(() => B.buildInput(x, { ...contact, whatsapp: '123' }, {}, null), /واتساب/);
  assert.throws(() => B.buildInput(x, { ...contact, company: ' ' }, {}, null), /الشركة/);
  assert.throws(() => B.buildInput({ ...x, qty: 0 }, contact, {}, null), /الحاويات/);
});

test('phone numbers are split into country and local number', () => {
  assert.deepEqual(B.splitPhone('+249 912 345 678', 'SD'), { iso: 'SD', national: '912345678' });
  assert.deepEqual(B.splitPhone('00966501234567', 'SD'), { iso: 'SA', national: '501234567' });
  assert.deepEqual(B.splitPhone('0912345678', 'SD'), { iso: 'SD', national: '912345678' });
  assert.deepEqual(B.splitPhone('٠٩١٢٣٤٥٦٧٨', 'SD'), { iso: 'SD', national: '912345678' });
  assert.deepEqual(B.splitPhone('249912345678', 'SD'), { iso: 'SD', national: '912345678' });
  assert.deepEqual(B.splitPhone('+20 100 123 4567', 'SD'), { iso: 'EG', national: '1001234567' });
  assert.deepEqual(B.splitPhone('+1 415 555 0100', 'SD'), { iso: 'US', national: '4155550100' });
  assert.deepEqual(B.splitPhone('', 'SA'), { iso: 'SA', national: '' });
});

test('phone numbers are grouped, checked and joined', () => {
  assert.equal(B.formatNational('912345678'), '912 345 678');
  assert.equal(B.formatNational('55123456'), '5512 3456');
  assert.equal(B.formatNational('1001234567'), '100 123 4567');
  assert.equal(B.checkPhone('SD', '912 345 678'), '');
  assert.match(B.checkPhone('SD', '9123'), /ناقص/);
  assert.match(B.checkPhone('QA', '551234567'), /أطول/);
  assert.equal(B.joinPhone('SD', '0912345678'), '+249 912 345 678');
  assert.equal(B.joinPhone('SD', ''), '');
  const i = B.buildInput({ id: 'RFQ-5', kind: 'sku', title: 'x', dest: 'مصر', qty: 1 }, { ...contact, whatsapp: B.joinPhone('QA', '5512 3456') }, {}, null);
  assert.equal(i.buyer.whatsapp, '97455123456');
});

test('home page cards come from the team panel catalog', () => {
  const items = [
    { id: 'prod-zollana-asasi', name: 'زولانا أساسي', description: 'دقيق القمح متعدد الاستخدامات', sector: { id: 'sector-food', name: 'الأغذية' },
      skus: [
        { id: 'sku-asasi-50', name: 'زولانا أساسي 50 كجم', skuCode: 'ZOL-ASASI-50', specifications: { packing: 'شوال منسوج 50 كجم', container: '20 قدماً', perContainer: 'نحو 450 شوالاً' },
          media: [{ url: 'https://www.septlion.com/new-app/uploads/b.webp', type: 'IMAGE', sortOrder: 1 }, { url: 'https://www.septlion.com/new-app/uploads/a.webp', type: 'IMAGE', sortOrder: 0 }, { url: 'http://x/c.webp', type: 'IMAGE', sortOrder: 2 }] },
      ] },
    { id: 'prod-new-rice', name: 'أرز', sector: { name: 'الأغذية' }, skus: [{ id: 'rice-5kg', name: 'أرز 5 كجم', specifications: { packing: 'كيس 5 كجم', sub: 'أرز' } }] },
    { id: 'empty', name: '', skus: [] },
  ];
  const d = B.fromPlatform(items);
  assert.deepEqual(d.sectors, [{ name: 'الأغذية', subs: ['الأغذية', 'أرز'] }]);
  assert.equal(d.products.length, 2);
  const [a, r] = d.products;
  assert.equal(a.id, 'asasi50');
  assert.equal(a.name, 'زولانا أساسي');
  assert.equal(a.size, '50 كجم');
  assert.equal(a.pack, 'شوال منسوج');
  assert.deepEqual(a.imgs, ['https://www.septlion.com/new-app/uploads/a.webp', 'https://www.septlion.com/new-app/uploads/b.webp']);
  assert.deepEqual(a.fields.map(f => f.v), ['شوال 50 كجم', 'أقل طلب: حاوية 20 قدماً · 450 شوالاً · 22.5 طن', 'نحو 450 شوالاً', 'شوال منسوج', '50 كجم']);
  // On the card: the unit, then the minimum load on its own line; the rest is for the enlarged view.
  assert.deepEqual(a.fields.filter(f => f.card !== false).map(f => f.v), ['شوال 50 كجم', 'أقل طلب: حاوية 20 قدماً · 450 شوالاً · 22.5 طن']);
  assert.equal(a.fields[1].wide, true);
  // 450 bags of 50 kg: 22.5 tons per container, for the quote sheet's tonnage.
  assert.equal(a.tpc, 22.5);
  assert.equal(r.tpc, 0);
  assert.deepEqual(B.catalogRef('asasi50'), { productId: 'prod-zollana-asasi', skuId: 'sku-asasi-50' });
  assert.equal(r.id, 'rice-5kg');
  assert.deepEqual(B.catalogRef('rice-5kg'), { productId: 'prod-new-rice', skuId: 'rice-5kg' });
  assert.deepEqual(B.fromPlatform(null), { version: 'platform', sectors: [], products: [] });
});

test('quality facts come first on the card', () => {
  const d = B.fromPlatform([{ id: 'p', name: 'زولانا خبازو', sector: { name: 'الأغذية' }, skus: [{ id: 'sku-khabbazo-50', name: 'زولانا خبازو 50 كجم',
    specifications: { packing: 'شوال منسوج 50 كجم', protein: '12%', moisture: 'حتى 14%', origin: 'مصر', certificates: 'حلال · FSSC 22000 · ISO 22000', payment: 'كاملاً قبل الشحن بتحويل مقدم أو اعتماد مستندي', gluten: '26 – 28%', ash: '0.60 – 0.65%', extraction: '72%', container: '20 قدماً', delivery: 'FOB مصر أو CIF ميناؤك' } }] }]);
  const fs = d.products[0].fields;
  assert.deepEqual(fs.slice(0, 7).map(f => f.v),
    ['بروتين 12%', 'منشأ مصر', 'حلال · FSSC', 'شوال 50 كجم', 'FOB أو CIF', 'الدفع قبل الشحن', 'أقل طلب: حاوية 20 قدماً']);
  assert.equal(fs[4].zv, 'FOB مصر أو CIF ميناؤك');
  assert.equal(fs[5].zv, 'كاملاً قبل الشحن بتحويل مقدم أو اعتماد مستندي');
  assert.equal(fs[6].wide, true);
  // In the enlarged view the packing and size are listed apart, and the short unit is hidden.
  assert.equal(fs[3].zoom, false);
  assert.deepEqual(fs.slice(-2).map(f => f.v), ['شوال منسوج', '50 كجم']);
});

test('any product gets the same card: its own grade, MOQ and specs', () => {
  const d = B.fromPlatform([{ id: 'prod-sugar', name: 'سكر أبيض', sector: { name: 'الأغذية' }, skus: [{ id: 'sku-sugar-50', name: 'سكر أبيض 50 كجم', unit: 'MT', minimumOrderQty: 25,
    specifications: { packing: 'شوال 50 كجم', grade: 'ICUMSA 45', origin: 'البرازيل', certificates: 'حلال', delivery: 'CIF', payment: 'مقدماً', 'الاستقطاب': '99.8%', 'الرطوبة القصوى': '0.04%' } }] }]);
  const fs = d.products[0].fields;
  assert.deepEqual(fs.filter(f => f.card !== false).slice(0, 7).map(f => f.v),
    ['ICUMSA 45', 'منشأ البرازيل', 'حلال', 'شوال 50 كجم', 'CIF', 'الدفع مقدماً', 'أقل طلب: 25 طن']);
  assert.deepEqual(fs.filter(f => f.zl === 'الاستقطاب' || f.zl === 'الرطوبة القصوى').map(f => f.zv), ['99.8%', '0.04%']);
});
