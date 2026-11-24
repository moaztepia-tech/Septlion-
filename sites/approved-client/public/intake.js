(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SeptlionIntake = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const labels = {
    product: 'المنتج أو الخدمة', quantity: 'الكمية', packaging: 'التعبئة',
    destination: 'الوجهة', origin: 'نقطة الانطلاق', brand: 'العلامة',
    incoterm: 'التسليم', payment: 'الدفع', deadline: 'الموعد', phone: 'واتساب'
  };
  const intentLabels = { supply: 'توريد منتج', manufacture: 'تصنيع', price: 'استفسار سعر', logistics: 'خدمة لوجستية', service: 'خدمة تجارية' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const digits = value => String(value || '').replace(/[٠-٩۰-۹]/g, c => {
    const a = '٠١٢٣٤٥٦٧٨٩'.indexOf(c); return a < 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : a;
  }).replace(/٫/g, '.');
  const norm = value => digits(value).normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
  const wordValues = { واحد: 1, واحده: 1, اثنين: 2, اثنان: 2, اتنين: 2, اثنتين: 2, اثنتان: 2,
    ثلاثه: 3, ثلاث: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6,
    سبعه: 7, سبع: 7, ثمانيه: 8, ثمان: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10,
    عشرين: 20, عشرون: 20, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60,
    سبعين: 70, ثمانين: 80, تسعين: 90, مائه: 100, مئه: 100, الف: 1000, نصف: 0.5 };
  function numbers(value) {
    let s = norm(value);
    const ones = 'واحد|اثنين|اتنين|ثلاثه|ثلاث|اربعه|اربع|خمسه|خمس|سته|ست|سبعه|سبع|ثمانيه|ثمان|تسعه|تسع';
    s = s.replace(new RegExp('(' + ones + ')\\s*و\\s*(عشرين|ثلاثين|اربعين|خمسين|ستين|سبعين|ثمانين|تسعين)', 'g'), (_, a, b) => String(wordValues[a] + wordValues[b]));
    for (const [word, count] of Object.entries(wordValues).sort((a, b) => b[0].length - a[0].length)) {
      s = s.replace(new RegExp('(^|[^\\p{L}])' + word + '(?=$|[^\\p{L}])', 'gu'), (_, before) => before + count);
    }
    return s;
  }
  function create() {
    return { version: 1, fields: {}, skipped: [], messages: [], pending: null, ambiguity: null, catalogProductId: null };
  }
  const unknown = value => /^(?:(?:لا|ما|مش) (?:اعرف|عارف)|لم احدد|غير محدد(?:ه)?|لاحقا|حسب المتاح|اي وقت|not sure|unknown|later)(?: (?:بعد|الكميه|التعبئه|الوجهه|الموعد|العلامه|بعده))*[.!،\s]*$/i.test(norm(value));
  const greeting = value => /^(?:السلام عليكم|وعليكم السلام|مرحبا|اهلا|اهلا وسهلا|صباح الخير|مساء الخير|hello|hi)[.!،\s]*$/i.test(norm(value));
  const valid = value => /\p{L}/u.test(value) && value.trim().length >= 2;
  const unitName = unit => /حاوي|container/.test(unit) ? 'حاوية' : /طن|ton/.test(unit) ? 'طن' : /كرتون|carton/.test(unit) ? 'كرتونة' : /قط|piece/.test(unit) ? 'قطعة' : /كيلو|كجم|kg/.test(unit) ? 'كجم' : /لتر|lit|liter/.test(unit) ? 'لتر' : 'عبوة';
  function quantityOf(value, existing) {
    let s = numbers(value);
    s = s.replace(/حاويت(?:ين|ان)/g, '2 حاويه').replace(/طنين|طنان/g, '2 طن');
    s = s.replace(/(?:^|\s)(حاويه|طن) (?:واحده?|1)(?=$|[\s،,.])/g, ' 1 $1');
    const matches = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(حاويات|حاويه|اطنان|طن|كرتونه|كرتون|كرتونات|قطعه|قطع|كيلوجرام|كيلوغرام|كيلو|كجم|kg|لتر|liters?|tons?|containers?|cartons?|pieces?)/g)];
    let result = null;
    for (const m of matches) {
      const before = s.slice(Math.max(0, m.index - 24), m.index);
      if (/(?:عبوات|عبوه|شوالات|شوال|جوالات|جوال|كيس|اكياس|حجم|تعبئه|زجاجات|زجاجه|سعه)\s*(?:(?:من|منسوج|بوزن|وزن|حجم|سعه)\s*)?$/.test(before)) continue;
      const count = Number(m[1]);
      if (count > 0 && Number.isFinite(count)) result = count + ' ' + unitName(m[2]);
      else return { invalid: true };
    }
    if (!result && /^(?:حاويه|طن)$/.test(s)) result = '1 ' + unitName(s);
    if (existing && /(?:خليها|اجعلها|الكميه|بدل|بدلا)/.test(s)) {
      const bare = s.match(/(?:خليها|اجعلها|الكميه)\s*(\d+(?:\.\d+)?)(?=$|[،,.])/);
      if (bare && Number(bare[1]) > 0) result = bare[1] + ' ' + existing.replace(/^[\d.]+\s*/, '');
    }
    return result ? { value: result } : null;
  }
  function packagingOf(value) {
    const s = numbers(value);
    const m = s.match(/(?:عبوات|عبوه|شوالات|شوال|جوالات|جوال|اكياس|كيس|تعبئه|حجم|زجاجه|زجاجات|سعه)\s*(?:(?:من|منسوج|بوزن|وزن|حجم|سعه)\s*)?(\d+(?:\.\d+)?)\s*(كجم|كيلوجرام|كيلوغرام|كيلو|kg|جرام|غرام|جم|g|مليلتر|ملليلتر|مل|ml|لتر|liter|l)(?!\p{L})/u);
    if (!m || Number(m[1]) <= 0) return null;
    const u = /كجم|كيلو|kg/.test(m[2]) ? 'كجم' : /جرام|غرام|جم|^g$/.test(m[2]) ? 'جم' : /مل|ml/.test(m[2]) ? 'مل' : 'لتر';
    const prefix = /شوال|جوال/.test(m[0]) ? 'شوال' : /اكياس|كيس/.test(m[0]) ? 'كيس' : 'عبوة';
    return prefix + ' ' + Number(m[1]) + ' ' + u;
  }
  const locations = [
    ['ميناء جدة الإسلامي', ['ميناء جده الاسلامي', 'جده الاسلامي']], ['بورتسودان', ['بورتسودان', 'بورت سودان', 'port sudan']],
    ['دار السلام', ['دار السلام', 'dar es salaam']], ['جبل علي', ['جبل علي', 'jebel ali']],
    ['جدة', ['جده', 'jeddah']], ['دبي', ['دبي', 'dubai']], ['الرياض', ['الرياض', 'riyadh']], ['مومباسا', ['مومباسا', 'mombasa']],
    ['دوالا', ['دوالا', 'douala']], ['نجامينا', ['نجامينا', 'ndjamena']], ['القاهرة', ['القاهره', 'cairo']],
    ['الإسكندرية', ['الاسكندريه', 'alexandria']], ['عدن', ['عدن', 'aden']], ['الخرطوم', ['الخرطوم', 'khartoum']],
    ['السعودية', ['السعوديه', 'saudi arabia']], ['السودان', ['السودان', 'sudan']], ['جنوب السودان', ['جنوب السودان', 'south sudan']],
    ['تشاد', ['تشاد', 'chad']], ['مصر', ['مصر', 'egypt']], ['الإمارات', ['الامارات', 'uae']], ['اليمن', ['اليمن', 'yemen']],
    ['كينيا', ['كينيا', 'kenya']], ['تنزانيا', ['تنزانيا', 'tanzania']], ['الصومال', ['الصومال', 'somalia']],
    ['تركيا', ['تركيا', 'turkey']], ['الصين', ['الصين', 'china']], ['قطر', ['قطر', 'qatar']], ['بوركينا فاسو', ['بوركينا فاسو']]
  ];
  function locationOf(value, direction) {
    const s = norm(value), hits = [];
    for (const [name, aliases] of locations) for (const alias of aliases) {
      let at = s.indexOf(alias);
      while (at >= 0) { hits.push({ name, at, size: alias.length }); at = s.indexOf(alias, at + alias.length); }
    }
    const tagged = direction === 'origin' ? s.match(/(?:من|الانطلاق من)\s+([^،,؛\n]+?)(?=\s+(?:الي|الى)|$)/) : s.match(/(?:الي|الى|الوجهه|تسليم في)\s+([^،,؛\n]+?)(?=\s+(?:cif|fob|cfr|exw|والدفع|الدفع|خلال|بعد)|$)/);
    if (tagged) {
      const part = tagged[1].trim(), inPart = hits.filter(h => part.includes(norm(h.name)) || locations.find(l => l[0] === h.name)[1].some(a => part.includes(a)));
      if (inPart.length) return inPart.sort((a, b) => b.size - a.size)[0].name;
      if (valid(part) && part.length <= 70 && !/\d/.test(part)) return part;
    }
    if (direction === 'origin') return null;
    if (hits.length) return hits.filter(h=>!hits.some(other=>other!==h&&other.at<=h.at&&other.at+other.size>=h.at+h.size&&other.size>h.size)).sort((a, b) => b.at - a.at || b.size - a.size)[0].name;
    return null;
  }
  function productOf(value) {
    const s = norm(value);
    const types = [
      [/دقيق|طحين|flour/g, 'flour'], [/عباد الشمس|دوار الشمس|sunflower/g, 'زيت عباد الشمس'],
      [/زيت|cooking oil|\boil\b/g, 'زيت', 'oil'], [/معجون\s*(?:ال)?طماطم|tomato paste/g, 'معجون طماطم'],
      [/كاتشب|ketchup/g, 'كاتشب'], [/صلصه/g, 'صلصة', 'sauce'],
      [/اسباجيتي|سباجيتي|spaghetti/g, 'مكرونة أسباجيتي'], [/مكرونه|معكرونه|pasta/g, 'مكرونة'],
      [/سمسم|sesame/g, 'سمسم'], [/كركديه|hibiscus/g, 'كركديه'], [/سكر|sugar/g, 'سكر']
    ];
    const hits = types.flatMap(([pattern, name, ambiguity]) => [...s.matchAll(pattern)].map(m => ({ at: m.index, name, ambiguity })));
    const hit = hits.sort((a,b) => b.at - a.at)[0];
    if (!hit) return null;
    if (hit.name === 'flour') hit.name = /كامل|whole/.test(s.slice(hit.at)) ? 'دقيق قمح كامل' : /مخابز|خبازو|bakery/.test(s.slice(hit.at)) ? 'دقيق للمخابز' : 'دقيق قمح';
    return { name: hit.name, ambiguity: hit.ambiguity };
  }
  function genericProduct(value) {
    let s = numbers(value).replace(/^(?:(?:انا\s+)?(?:احتاج|بحتاج|اريد|عايز|عاوز|داير|ابغي|ابي|محتاج|توريد|شراء|استفسار عن|كم سعر|سعر|تصنيع|i need|i want|need|looking for)\s*)+/i, '');
    s = s.replace(/\d+(?:\.\d+)?\s*(?:حاويه|حاويات|طن|اطنان|كرتون|كرتونه|قطعه|قطع|containers?|tons?)\s*/g, '');
    s = s.split(/[,،؛\n]|\s+(?:الي|الى|بميناء|للشحن|خلال|والدفع|بعلامتي|باسمي|بكميه|بكمية|cif|fob)\s*/i)[0].trim();
    if (!valid(s) || s.length > 100 || /^(?:منتج(?: غذائي)?|شي|حاجه|مساعده|طلب|توريد|تصنيع|خدمه|مرحبا|حاويتين|حاويتان|حاويه|طن|\d+[\s\p{L}]{0,8})$/u.test(s)) return null;
    return s;
  }
  function patchFrom(value, draft) {
    const s = norm(value), fields = {}, result = { fields, ambiguity: undefined };
    if (/بعلامتي|باسمي|علامه خاصه|برايفت ليبل|private label|تصنيع|manufactur/.test(s)) fields.intent = 'manufacture';
    else if (/شحن|لوجست|تخليص|freight|shipping|logistics/.test(s)) fields.intent = 'logistics';
    else if (/سعر|اسعار|بكم|\bprice\b/.test(s)) fields.intent = 'price';
    else if (/خدمه|خدمات|تصميم|service/.test(s)) fields.intent = 'service';
    else if (!draft.fields.intent) fields.intent = 'supply';
    if (/بعلامتي|باسمي|علامه خاصه|برايفت ليبل|private label/.test(s)) fields.brand = 'بعلامتي الخاصة';
    else if (/زولانا|zollana/.test(s)) fields.brand = 'ZOLLANA';
    const product = productOf(value);
    if (product) { fields.product = product.name; result.ambiguity = product.ambiguity || null; }
    else if (!draft.fields.product || draft.pending === 'product') {
      const name = genericProduct(value); if (name) { fields.product = name; result.ambiguity = null; }
    }
    if (fields.intent === 'logistics' && !fields.product) fields.product = draft.fields.product || 'خدمة شحن';
    const quantity = quantityOf(value, draft.fields.quantity);
    if (quantity?.invalid) result.invalidQuantity = true;
    else if (quantity) fields.quantity = quantity.value;
    const packaging = packagingOf(value); if (packaging) fields.packaging = packaging;
    const destination = locationOf(value, 'destination'); if (destination) fields.destination = destination;
    if (draft.fields.intent === 'logistics' || fields.intent === 'logistics') { const origin = locationOf(value, 'origin'); if (origin) fields.origin = origin; }
    const incoterms = [...s.matchAll(/\b(cif|fob|cfr|exw|dap|ddp|fca|cip)\b/g)];
    if (incoterms.length) fields.incoterm = incoterms.at(-1)[1].toUpperCase();
    const payments = [...s.matchAll(/\blc\b|اعتماد مستندي|\btt\b|تحويل بنكي/g)].filter(m => !/(?:ليس|بدون|مش|not)\s*$/.test(s.slice(Math.max(0,m.index-12),m.index)));
    if (payments.length) fields.payment = /lc|اعتماد/.test(payments.at(-1)[0]) ? 'LC — اعتماد مستندي' : 'TT — تحويل بنكي';
    const advance = s.match(/\d+(?:\.\d+)?\s*[%٪]\s*(?:مقدم|مقدما)/); if (advance) fields.payment = advance[0];
    const date = s.match(/(?:خلال|بعد)\s+(?:\d+\s*)?(?:يومين|يوم|ايام|اسبوعين|اسبوع|اسابيع|شهرين|شهر|شهور)|نهايه الشهر|الشهر القادم|الاسبوع القادم|في اقرب وقت|با?قرب وقت|غدا|بكره|\d{4}-\d{2}-\d{2}/);
    if (date) fields.deadline = date[0];
    if (draft.pending === 'deadline' && !date && valid(s) && !unknown(s) && !Object.keys(fields).some(k => k !== 'intent')) fields.deadline = value.trim();
    if (draft.pending === 'packaging' && !packaging && valid(s) && !unknown(s) && !product && !destination && !quantity && !date) fields.packaging = value.trim();
    const phone = digits(value).match(/\+[0-9][0-9 ()-]{6,19}[0-9]/); if (phone) fields.phone = phone[0].trim();
    return result;
  }
  function question(draft) {
    const f = draft.fields, missing = key => !f[key] && !draft.skipped.includes(key);
    if (draft.ambiguity === 'oil') return { key: 'product', text: 'ما نوع الزيت الذي تحتاجه؟', options: ['زيت عباد الشمس', 'نوع آخر'] };
    if (draft.ambiguity === 'sauce') return { key: 'product', text: 'ما نوع الصلصة الذي تقصده؟', options: ['معجون طماطم', 'كاتشب', 'نوع آخر'] };
    if (missing('product')) return { key: 'product', text: 'ما المنتج أو الخدمة التجارية التي تحتاجها؟ صفها بطريقتك.', options: [] };
    if (f.intent === 'logistics' && missing('origin')) return { key: 'origin', text: 'من أي بلد أو ميناء ستخرج الشحنة؟', options: ['لا أعرف بعد'] };
    if (f.intent !== 'service' && missing('quantity')) return { key: 'quantity', text: 'ما الكمية التقريبية؟ يمكنك كتابتها بالحاويات أو الطن أو الوحدة المناسبة.', options: ['حاوية واحدة', 'حاويتان', 'لا أعرف بعد'] };
    if (f.intent !== 'service' && missing('destination')) return { key: 'destination', text: 'إلى أي بلد أو مدينة أو ميناء تريد التسليم؟', options: ['لا أعرف بعد'] };
    if (!['service', 'logistics'].includes(f.intent) && missing('packaging')) return { key: 'packaging', text: 'ما التعبئة أو حجم العبوة الذي تحتاجه؟', options: /دقيق/.test(f.product || '') ? ['شوال 50 كجم', 'شوال 25 كجم', 'لا أعرف بعد'] : /زيت/.test(f.product || '') ? ['عبوة 1 لتر', 'عبوة 5 لتر', 'لا أعرف بعد'] : ['لا أعرف بعد'] };
    if (f.intent === 'manufacture' && missing('brand')) return { key: 'brand', text: 'هل تريد التصنيع بعلامتك الخاصة؟', options: ['بعلامتي الخاصة', 'لا أعرف بعد'] };
    if (missing('deadline')) return { key: 'deadline', text: 'هل لديك موعد مطلوب لوصول الشحنة أو إنجاز الخدمة؟', options: ['خلال شهر', 'لا أعرف بعد'] };
    return null;
  }
  function matches(draft, catalog) {
    if (draft.fields.brand === 'بعلامتي الخاصة' || !draft.fields.product || draft.ambiguity) return [];
    const p = norm(draft.fields.product), pack = numbers(draft.fields.packaging || ''), size = pack.match(/\d+(?:\.\d+)?/)?.[0];
    return (catalog || []).map(item => {
      const type = norm(item.type || item.desc || item.name), name = norm(item.name);
      let score = p.includes('دقيق') && /دقيق|طحين/.test(type) ? 2 : p.includes('عباد الشمس') && /عباد الشمس/.test(type) ? 2 : type && (p.includes(type) || type.includes(p)) ? 2 : 0;
      if (!score) return null;
      if (/مخابز/.test(p)) score += /مخابز|خبازو/.test(type + name) ? 4 : -4;
      if (/كامل/.test(p)) score += /كامل/.test(type + name) ? 4 : -4;
      if (size) { if (numbers(item.size || '').match(/\d+(?:\.\d+)?/)?.[0] !== size) return null; score += 2; }
      return score > 0 ? { id: item.id, score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 2).map(x => x.id);
  }
  function consume(previous, value, catalog) {
    const draft = clone(previous || create()), text = String(value || '').trim().slice(0, 2000);
    if (!text) return { draft, reply: '', question: question(draft), matches: matches(draft, catalog) };
    draft.messages.push(text); draft.messages = draft.messages.slice(-30);
    if (norm(text) === 'نوع اخر' && draft.ambiguity) {
      delete draft.fields.product; draft.ambiguity = null; draft.pending = 'product';
      return { draft, reply: 'اكتب اسم النوع أو وصفه، وسنضيفه كاحتياج خاص.', question: question(draft), matches: [] };
    }
    if (greeting(text)) { const q = question(draft); draft.pending = q?.key || null; return { draft, reply: 'أهلًا بك. ' + (q?.text || 'يمكنك مراجعة ملخص احتياجك أو إضافة أي تعديل.'), question: q, matches: matches(draft, catalog) }; }
    if (!valid(text) && !draft.pending) { draft.pending = 'product'; return { draft, reply: 'اكتب المنتج أو الخدمة التي تحتاجها، ولو بكلمات بسيطة.', question: question(draft), matches: [] }; }
    if (unknown(text) && draft.pending) {
      draft.skipped = [...new Set([...draft.skipped, draft.pending])]; delete draft.fields[draft.pending];
      if (draft.pending === 'product') draft.ambiguity = null;
      const q = question(draft); draft.pending = q?.key || null;
      return { draft, reply: 'يمكننا استكمال هذه المعلومة لاحقًا. ' + (q?.text || 'راجع الملخص وأضف وسيلة التواصل في الخطوة التالية.'), question: q, matches: matches(draft, catalog) };
    }
    const patch = patchFrom(text, draft), changed = [];
    if (patch.invalidQuantity) { draft.pending = 'quantity'; return { draft, reply: 'يرجى كتابة كمية أكبر من صفر مع وحدتها، مثل «2 حاوية» أو «100 طن».', question: { key: 'quantity', text: 'ما الكمية المطلوبة؟', options: ['لا أعرف بعد'] }, matches: matches(draft, catalog) }; }
    if (draft.pending === 'origin' && !/(?:الى|الي|الوجهه)/.test(norm(text))) {
      if (!patch.fields.origin && patch.fields.destination) patch.fields.origin = patch.fields.destination;
      if (patch.fields.origin) delete patch.fields.destination;
    }
    if (draft.pending === 'destination' && !patch.fields.destination && valid(text) && !Object.keys(patch.fields).some(k => k !== 'intent')) patch.fields.destination = text;
    if (draft.pending === 'origin' && !patch.fields.origin && valid(text) && !Object.keys(patch.fields).some(k => k !== 'intent')) patch.fields.origin = text;
    if (draft.pending === 'brand' && !patch.fields.brand && valid(text) && !Object.keys(patch.fields).some(k => k !== 'intent')) patch.fields.brand = text;
    const oldProduct = draft.fields.product;
    for (const [key, v] of Object.entries(patch.fields)) {
      if (draft.fields[key] && draft.fields[key] !== v && key !== 'intent') changed.push(key);
      draft.fields[key] = v; draft.skipped = draft.skipped.filter(k => k !== key);
    }
    if (patch.ambiguity !== undefined) draft.ambiguity = patch.ambiguity;
    if (changed.includes('product') && !patch.fields.packaging) {
      const category = p => /دقيق/.test(p || '') ? 'flour' : /زيت/.test(p || '') ? 'oil' : null;
      if (!category(oldProduct) || category(oldProduct) !== category(draft.fields.product)) {
        delete draft.fields.packaging; draft.skipped = draft.skipped.filter(k => k !== 'packaging');
      }
    }
    if (Object.keys(patch.fields).some(k => ['product','packaging','origin','brand','incoterm','payment','deadline'].includes(k))) delete draft.manualTerms;
    if (changed.some(k => ['product', 'packaging', 'brand'].includes(k))) draft.catalogProductId = null;
    const q = question(draft); draft.pending = q?.key || null;
    const correction = changed.length ? 'حدّثت ' + changed.map(k => labels[k]).join(' و') + '. ' : '';
    const reply = correction + (q?.text || 'جمعت تفاصيل احتياجك. راجع الملخص، ويمكنك تعديل أي معلومة قبل استكمال الطلب.');
    return { draft, reply, question: q, matches: matches(draft, catalog) };
  }
  function choose(previous, id, catalog) {
    const item = (catalog || []).find(p => p.id === id); if (!item) return null;
    const draft = clone(previous);
    draft.fields.product = item.type || item.name;
    draft.fields.packaging = [item.pack, item.size].filter(Boolean).join(' ');
    if (item.brand && item.brand !== 'العلامة غير محددة') draft.fields.brand = item.brand;
    draft.catalogProductId = item.id; draft.ambiguity = null;
    draft.skipped = draft.skipped.filter(k => !['product', 'packaging', 'brand'].includes(k));
    const q = question(draft); draft.pending = q?.key || null;
    return { draft, question: q, reply: 'اخترت ' + item.name + '، ' + item.size + '. ' + (q?.text || 'يمكنك الآن مراجعة ملخص الطلب واستكماله.'), matches: [] };
  }
  function rows(draft) {
    return Object.entries(labels).filter(([k]) => draft.fields[k] || draft.skipped.includes(k))
      .map(([key, label]) => ({ key, label, value: draft.fields[key] || 'يُحدد لاحقًا', deferred: !draft.fields[key] }));
  }
  const summary = draft => [intentLabels[draft.fields.intent] || 'احتياج تجاري', ...rows(draft).filter(x => x.key !== 'phone').map(x => x.label + ': ' + x.value)].join('\n');
  function details(draft) {
    return { quantity: draft.fields.quantity || '', destination: draft.fields.destination || '', phone: draft.fields.phone || '',
      terms: draft.manualTerms ?? rows(draft).filter(x => !['product', 'quantity', 'destination', 'phone'].includes(x.key)).map(x => x.label + ': ' + x.value).join('\n'), summary: summary(draft) };
  }
  function review(previous, form) {
    const draft = clone(previous), terms = String(form.terms || '').trim();
    const optional = Object.keys(labels).filter(k => !['product','quantity','destination','phone'].includes(k));
    for (const key of optional) delete draft.fields[key];
    const patch = patchFrom(terms, draft).fields;
    for (const key of optional) if (patch[key]) draft.fields[key] = patch[key];
    for (const line of terms.split('\n')) {
      const colon = line.indexOf(':'); if (colon < 0) continue;
      const name = norm(line.slice(0,colon)), value = line.slice(colon+1).trim();
      const key = optional.find(k => norm(labels[k]) === name);
      if (key && value && !/يحدد لاحقا/.test(norm(value))) draft.fields[key] = value;
    }
    for (const key of ['quantity','destination','phone']) {
      const value = String(form[key] || '').trim();
      if (value) { draft.fields[key] = value; draft.skipped = draft.skipped.filter(k => k !== key); }
      else { delete draft.fields[key]; draft.skipped = [...new Set([...draft.skipped,key])]; }
    }
    draft.manualTerms = terms;
    draft.catalogProductId = null;
    draft.pending = question(draft)?.key || null;
    return draft;
  }
  return { create, consume, choose, review, rows, summary, details, digits, norm, labels, intentLabels, matches };
});
