/* SEPTLION bridge: the customer interface stays as it is, and every request it
   saves is also sent to the SEPTLION team. A buyer sends it with a name, company
   and WhatsApp number only (email optional), straight to the public intake
   (submit-demand-rfq); a buyer already signed in with a confirmed email keeps
   the platform path (trade-api).
   The pure helpers are exported for node tests; the UI part runs only in a browser. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SeptlionBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const SUPABASE_URL = 'https://jfbmxowdmfdzyoauqgwn.supabase.co';
  // Publishable (public) key, the same one the platform build ships to browsers.
  const SUPABASE_KEY = 'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';
  const SESSION_KEY = 'septlion_session';
  const INCOTERMS = ['CIF', 'CFR', 'FOB'];

  const digits = v => String(v == null ? '' : v).replace(/[٠-٩۰-۹]/g, c => {
    const a = '٠١٢٣٤٥٦٧٨٩'.indexOf(c); return String(a < 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : a);
  }).replace(/٫/g, '.').replace(/٬/g, ',');
  const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 500);

  /** "LC — اعتماد مستندي" -> "L/C", "TT — تحويل بنكي" -> "T/T", anything else -> "OTHER". */
  function paymentCode(v) {
    const s = String(v || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (s.startsWith('LC')) return 'L/C';
    if (s.startsWith('TT')) return 'T/T';
    return 'OTHER';
  }

  /** Reads "3 حاويات", "100 طن", "500 كجم", "2 FCL" into {amount, unit}; null when unclear. */
  function parseQuantity(text) {
    const t = digits(text).toLowerCase();
    const m = t.match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const amount = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return null;
    let unit = null;
    if (/حاوي|كونتين|fcl|container/.test(t)) unit = 'FCL';
    else if (/طن|ton|\bmt\b/.test(t)) unit = 'MT';
    else if (/كجم|كيلو|kg/.test(t)) unit = 'KG';
    if (!unit) return null;
    if (unit === 'FCL' && !Number.isInteger(amount)) return null;
    return { amount, unit };
  }

  /** Catalog ids such as "asasi50" map to platform SKU "sku-asasi-50" of product "prod-zollana-asasi". */
  function catalogRef(productId) {
    const m = String(productId || '').match(/^([a-z]+)(\d+)$/);
    return m ? { productId: 'prod-zollana-' + m[1], skuId: 'sku-' + m[1] + '-' + m[2] } : null;
  }

  /** What the request still needs from the customer before it can be sent. */
  function missing(x) {
    if (x.kind === 'sku') return [];
    const need = [];
    if (!clean(x.destination)) need.push('destination');
    if (!parseQuantity(x.quantity)) need.push('quantity');
    need.push('incoterm', 'payment');
    return need;
  }

  /**
   * Builds the trade-api requirements.create input from a saved request (x),
   * the confirmed contact and any extra answers. Throws an Arabic message when
   * something required is absent.
   */
  function buildInput(x, contact, extra, catalog) {
    extra = extra || {};
    const buyer = {
      name: clean(contact.name, 120), company: clean(contact.company, 200),
      email: clean(contact.email, 254).toLowerCase(),
      whatsapp: digits(contact.whatsapp).replace(/[\s()-]/g, '').replace(/^\+/, '').replace(/^00/, ''),
    };
    if (!buyer.name) throw new Error('اكتب اسمك.');
    if (!buyer.company) throw new Error('اكتب اسم الشركة، أو اسمك إن لم تكن شركة.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) throw new Error('اكتب بريدًا إلكترونيًا صحيحًا.');
    if (!/^[1-9]\d{7,14}$/.test(buyer.whatsapp)) throw new Error('اكتب رقم واتساب صحيحًا مع رمز الدولة.');
    const key = 'web-' + String(x.id || '').replace(/[^A-Za-z0-9-]/g, '') + '-' + buyer.email.replace(/[^a-z0-9]/g, '').slice(0, 24);
    const base = { buyer, idempotencyKey: key.slice(0, 100), sourceContext: { channel: 'septlion.com', localId: x.id, buyer } };
    if (x.kind === 'sku') {
      const n = Number(x.qty);
      if (!Number.isSafeInteger(n) || n < 1) throw new Error('حدد عدد الحاويات.');
      const destination = [clean(x.dest, 200), clean(x.port, 90)].filter(Boolean).join(' · ');
      if (!destination) throw new Error('حدد وجهة التسليم.');
      const input = Object.assign(base, {
        product: clean(x.title, 500), destination, quantity: n,
        // Country and port in their own fields: the port prices CIF/CFR, the country sets documents.
        deliveryCountry: clean(x.dest, 120) || null, deliveryPort: clean(x.port, 90) || null, unit: 'FCL', containerCount: n,
        incoterm: INCOTERMS.includes(x.incoterm) ? x.incoterm : 'CIF', paymentPreference: paymentCode(x.payment),
        packing: clean(x.description, 300) || null,
        knownFacts: { note: clean(x.note, 1000) || undefined, localProductId: x.productId || undefined },
      });
      const ref = catalogRef(x.productId);
      const sku = ref && catalog && catalog.find(p => p.id === ref.productId && (p.skus || []).some(s => s.id === ref.skuId));
      if (sku) { input.catalogProductId = ref.productId; input.variants = [{ skuId: ref.skuId, containers: n }]; }
      return input;
    }
    const q = parseQuantity(x.quantity) || (extra.amount ? { amount: Number(digits(extra.amount)), unit: extra.unit } : null);
    if (!q || !Number.isFinite(q.amount) || q.amount <= 0 || !['FCL', 'MT', 'KG'].includes(q.unit)) throw new Error('حدد الكمية ووحدتها.');
    if (q.unit === 'FCL' && !Number.isInteger(q.amount)) throw new Error('عدد الحاويات يكون رقمًا صحيحًا.');
    const destination = clean(x.destination, 300) || clean(extra.destination, 300);
    if (!destination) throw new Error('حدد بلد أو مدينة التسليم.');
    if (!INCOTERMS.includes(extra.incoterm)) throw new Error('اختر شرط التسليم.');
    const product = clean(x.description, 500) || clean(x.title, 500);
    if (!product) throw new Error('صف المنتج الذي تحتاجه.');
    return Object.assign(base, {
      product, destination, quantity: q.amount, unit: q.unit, containerCount: q.unit === 'FCL' ? q.amount : null,
      incoterm: extra.incoterm, paymentPreference: paymentCode(extra.payment),
      knownFacts: { terms: clean(x.terms, 1000) || undefined, quantityText: clean(x.quantity, 200) || undefined },
    });
  }

  /**
   * Builds the public intake payload (submit-demand-rfq) from a saved request,
   * the contact and the extra answers. No email code: the WhatsApp number is
   * required, the email optional. Throws an Arabic message when something is absent.
   */
  function buildIntake(x, contact, extra) {
    extra = extra || {};
    const name = clean(contact.name, 120), company = clean(contact.company, 160);
    const email = clean(contact.email, 200).toLowerCase();
    const wa = digits(contact.whatsapp).replace(/[\s()-]/g, '').replace(/^\+/, '').replace(/^00/, '');
    if (!name) throw new Error('اكتب اسمك.');
    if (!company) throw new Error('اكتب اسم الشركة، أو اسمك إن لم تكن شركة.');
    if (!/^[1-9]\d{7,14}$/.test(wa)) throw new Error('اكتب رقم واتساب صحيحًا مع رمز الدولة.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('البريد غير صحيح. صحّحه أو اتركه فارغًا.');
    const base = { contactName: name, companyName: company, phone: '+' + wa, email: email || undefined, channel: 'customer_site' };
    const pay = { LC: 'اعتماد مستندي', TT: 'تحويل بنكي' }[String(extra.payment || x.payment || '').toUpperCase().slice(0, 2)] || '';
    if (x.kind === 'sku') {
      const n = Number(x.qty);
      if (!Number.isSafeInteger(n) || n < 1) throw new Error('حدد عدد الحاويات.');
      const country = clean(x.dest, 120);
      if (!country) throw new Error('حدد وجهة التسليم.');
      return Object.assign(base, {
        product: clean(x.title, 300), country, destinationPort: clean(x.port, 160) || undefined,
        quantity: n + ' FCL', packing: clean(x.description, 120) || undefined,
        incoterm: INCOTERMS.includes(x.incoterm) ? x.incoterm : 'CIF',
        notes: [pay && 'الدفع: ' + pay, clean(x.note, 1000)].filter(Boolean).join(' · ') || undefined,
      });
    }
    const q = parseQuantity(x.quantity) || (extra.amount ? { amount: Number(digits(extra.amount)), unit: extra.unit } : null);
    if (!q || !Number.isFinite(q.amount) || q.amount <= 0 || !['FCL', 'MT', 'KG'].includes(q.unit)) throw new Error('حدد الكمية ووحدتها.');
    const country = clean(x.destination, 120) || clean(extra.destination, 120);
    if (!country) throw new Error('حدد بلد أو مدينة التسليم.');
    const product = clean(x.description, 300) || clean(x.title, 300);
    if (!product) throw new Error('صف المنتج الذي تحتاجه.');
    return Object.assign(base, {
      product, country, quantity: clean(x.quantity, 120) || (q.amount + ' ' + q.unit),
      incoterm: INCOTERMS.includes(extra.incoterm) ? extra.incoterm : undefined,
      notes: [pay && 'الدفع: ' + pay, clean(x.terms, 1000)].filter(Boolean).join(' · ') || undefined,
    });
  }

  /* ------------------------------------------------------------ phone numbers */
  // [iso, dial code, Arabic name, national length min, max]. Sudan first: most buyers start there.
  const COUNTRIES = [
    ['SD', '249', 'السودان', 9, 9], ['SA', '966', 'السعودية', 9, 9], ['EG', '20', 'مصر', 10, 10],
    ['AE', '971', 'الإمارات', 8, 9], ['QA', '974', 'قطر', 8, 8], ['KW', '965', 'الكويت', 8, 8],
    ['OM', '968', 'عُمان', 8, 8], ['BH', '973', 'البحرين', 8, 8], ['JO', '962', 'الأردن', 8, 9],
    ['IQ', '964', 'العراق', 10, 10], ['LY', '218', 'ليبيا', 9, 9], ['YE', '967', 'اليمن', 7, 9],
    ['TD', '235', 'تشاد', 8, 8], ['SS', '211', 'جنوب السودان', 9, 9], ['ET', '251', 'إثيوبيا', 9, 9],
    ['ER', '291', 'إريتريا', 7, 7], ['DJ', '253', 'جيبوتي', 8, 8], ['SO', '252', 'الصومال', 7, 9],
    ['KE', '254', 'كينيا', 9, 9], ['NG', '234', 'نيجيريا', 10, 10], ['TR', '90', 'تركيا', 10, 10],
    ['GB', '44', 'بريطانيا', 10, 10], ['US', '1', 'أمريكا وكندا', 10, 10], ['MY', '60', 'ماليزيا', 9, 10],
  ];
  const countryOf = iso => COUNTRIES.find(c => c[0] === iso) || COUNTRIES[0];
  const flagOf = iso => String.fromCodePoint.apply(null, iso.split('').map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
  const onlyDigits = v => digits(v).replace(/\D/g, '');

  /** "+966 50 123 4567" -> {iso:'SA', national:'501234567'}; a number without a code stays in the default country. */
  function splitPhone(value, defaultIso) {
    const raw = digits(value).trim();
    let d = onlyDigits(raw);
    const intl = /^\s*(\+|00)/.test(raw);
    if (intl && raw.trim().startsWith('00')) d = d.slice(2);
    if (intl) {
      const c = COUNTRIES.filter(k => d.startsWith(k[1])).sort((a, b) => b[1].length - a[1].length)[0];
      if (c) return { iso: c[0], national: d.slice(c[1].length).replace(/^0+/, '') };
    }
    const def = countryOf(defaultIso);
    // "249912345678" typed without "+": take the code off when what remains fits that country.
    const c = COUNTRIES.filter(k => d.startsWith(k[1]) && d.length - k[1].length >= k[3] && d.length - k[1].length <= k[4])
      .sort((a, b) => (b[0] === def[0]) - (a[0] === def[0]) || b[1].length - a[1].length)[0];
    if (c && d.length > def[4]) return { iso: c[0], national: d.slice(c[1].length) };
    return { iso: def[0], national: d.replace(/^0+/, '') };
  }
  /** Groups the national digits the way people read them: 912 345 678, 5012 3456, 100 123 4567. */
  function formatNational(national) {
    const d = onlyDigits(national);
    const g = d.length === 8 ? [4, 4] : d.length === 10 ? [3, 3, 4] : d.length === 7 ? [3, 4] : [3, 3, 3, 3, 3];
    const out = []; let i = 0;
    for (const n of g) { if (i >= d.length) break; out.push(d.slice(i, i + n)); i += n; }
    if (i < d.length) out.push(d.slice(i));
    return out.join(' ');
  }
  /** Empty string when the number is fine, otherwise a short Arabic hint. */
  function checkPhone(iso, national) {
    const c = countryOf(iso), n = onlyDigits(national).replace(/^0+/, '');
    if (!n) return 'اكتب رقم واتساب.';
    if (n.length < c[3]) return 'الرقم ناقص: ' + (c[3] === c[4] ? c[3] : c[3] + ' إلى ' + c[4]) + ' أرقام بعد +' + c[1] + '.';
    if (n.length > c[4]) return 'الرقم أطول من المعتاد لـ' + c[2] + '. تأكد منه.';
    return '';
  }
  /** "+249 912 345 678" from a country and the digits the customer typed. */
  function joinPhone(iso, national) {
    const n = onlyDigits(national).replace(/^0+/, '');
    return n ? '+' + countryOf(iso)[1] + ' ' + formatNational(n) : '';
  }

  const api = { parseQuantity, paymentCode, catalogRef, missing, buildInput, buildIntake, splitPhone, formatNational, checkPhone, joinPhone, COUNTRIES };
  if (typeof document === 'undefined') return api;

  /* ------------------------------------------------------------------ browser */
  const $ = s => document.querySelector(s);
  // The page exposes its sheet, toast and storage helpers as window.SeptlionPage.
  const page = () => root.SeptlionPage || {};
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const headers = token => Object.assign({ 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, token ? { Authorization: 'Bearer ' + token } : {});
  const body = async r => { try { return await r.json(); } catch (e) { return null; } };
  // Show the server's own message only when it is written for customers (Arabic).
  const errText = (b, fallback) => b && typeof b.error === 'string' && /[\u0600-\u06FF]/.test(b.error) ? b.error : fallback;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  function saveSession(s) {
    const expires_at = s.expires_at || (s.expires_in ? Math.floor(Date.now() / 1000) + s.expires_in : undefined);
    const prev = store.get(SESSION_KEY, null);
    store.set(SESSION_KEY, Object.assign({}, s, { expires_at, session_key: (prev && prev.session_key) || (root.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) }));
    try { localStorage.setItem('septlion_access', s.access_token); localStorage.setItem('septlion_refresh', s.refresh_token); } catch (e) { /* ignore */ }
  }
  async function currentSession() {
    const s = store.get(SESSION_KEY, null);
    if (!s || !s.refresh_token) return null;
    if (s.access_token && s.expires_at && s.expires_at > Date.now() / 1000 + 60) return s;
    const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: s.refresh_token }) });
    const b = await body(r);
    if (!r.ok || !b || !b.access_token) return null;
    saveSession(b); return store.get(SESSION_KEY, null);
  }
  async function confirmedEmailOf(session) {
    if (!session) return null;
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: headers(session.access_token) });
    const u = await body(r);
    return r.ok && u && u.email && u.email_confirmed_at ? String(u.email).toLowerCase() : null;
  }
  async function sendCode(email) {
    const r = await fetch(SUPABASE_URL + '/auth/v1/otp', { method: 'POST', headers: headers(), body: JSON.stringify({ email, create_user: true }) });
    if (!r.ok) throw new Error(r.status === 429 ? 'طلبت رموزًا كثيرة. انتظر دقيقة ثم أعد المحاولة.' : 'تعذر إرسال الرمز إلى بريدك. تأكد من العنوان وحاول مجددًا.');
  }
  async function verifyCode(email, code) {
    const r = await fetch(SUPABASE_URL + '/auth/v1/verify', { method: 'POST', headers: headers(), body: JSON.stringify({ email, token: code, type: 'email' }) });
    const b = await body(r);
    if (!r.ok || !b || !b.access_token) throw new Error('الرمز غير صحيح أو انتهت صلاحيته.');
    saveSession(b); return b;
  }
  async function fetchCatalog() {
    try {
      const r = await fetch(SUPABASE_URL + '/functions/v1/trade-api', { method: 'POST', headers: headers(), body: JSON.stringify({ action: 'catalog.public' }) });
      const b = await body(r); return r.ok && b && Array.isArray(b.items) ? b.items : [];
    } catch (e) { return []; }
  }
  async function sendIntake(payload) {
    const r = await fetch(SUPABASE_URL + '/functions/v1/submit-demand-rfq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const b = await body(r);
    if (!r.ok) throw new Error(r.status === 429 ? 'طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.' : 'تعذر إرسال الطلب الآن. طلبك محفوظ؛ يمكنك إرساله عبر واتساب.');
    return b || {};
  }
  async function createRequirement(session, input) {
    const r = await fetch(SUPABASE_URL + '/functions/v1/trade-api', { method: 'POST', headers: headers(session.access_token), body: JSON.stringify({ action: 'requirements.create', input }) });
    const b = await body(r);
    if (!r.ok) throw new Error(errText(b, r.status === 429 ? 'طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.' : 'تعذر إرسال الطلب الآن. طلبك محفوظ؛ يمكنك إرساله عبر واتساب.'));
    return b;
  }


  let styled = false;
  function ensureStyle() {
    if (styled) return; styled = true;
    const style = document.createElement('style');
    style.textContent = '#sbVerify .sheet-body{padding-bottom:18px}#sbVerify .sb-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}#sbVerify .sb-seg{display:flex;gap:8px;flex-wrap:wrap}#sbVerify .sb-seg label{flex:1;min-width:72px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border:1px solid #3b5780;border-radius:11px;background:#0b2037;font-size:13px;cursor:pointer}#sbVerify .sb-seg input{accent-color:#b9cde3}#sbVerify .sb-seg label:has(input:checked){border-color:#b9cde3;background:#162d4d}#sbVerify .sb-code{letter-spacing:.4em;text-align:center;font-size:22px;direction:ltr}#sbVerify .sb-alt{display:block;margin:12px auto 0;background:none;border:0;color:var(--sky,#9db3d6);font-size:13px;text-decoration:underline;cursor:pointer}#sbVerify .err{margin-top:10px;font-size:12px}#sbVerify .sb-ok{font-size:13px;color:#cfe3c9;margin-top:10px}' + '.sb-phone{display:flex;gap:8px;direction:ltr}.sb-cc{position:relative;flex:0 0 auto;min-width:104px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:50px;padding:0 12px;background:#0b2037;border:1px solid #3b5780;border-radius:11px;font-size:16px;font-variant-numeric:tabular-nums}.sb-cc:focus-within{border-color:#c1d6ff;box-shadow:0 0 0 3px #8fa6d62e}.sb-cc .sb-flag{font-size:20px;line-height:1}.sb-cc .sb-chev{opacity:.7;font-size:11px}.sb-cc select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:16px}.sb-phone .sb-num{flex:1;min-width:0;letter-spacing:.04em;font-variant-numeric:tabular-nums}.sb-phone .sb-num[aria-invalid=true]{border-color:#e58b8b}.sb-phone-ok{position:absolute;inset-inline-end:12px;top:50%;transform:translateY(-50%);color:#9fd49a;font-size:16px;pointer-events:none;opacity:0;transition:opacity .2s}.sb-numwrap{position:relative;flex:1;min-width:0;display:flex}.sb-numwrap.ok .sb-phone-ok{opacity:1}.sb-phone-hint{margin:6px 0 4px;font-size:12px;color:#9db3d6}.sb-phone-hint.bad{color:#f0a3a3}';
    document.head.appendChild(style);
  }

  /**
   * Turns a plain "phone with country code" input into a country picker plus
   * the local number. The original input stays (hidden) and always holds the
   * full number, so the code that reads it does not change.
   */
  function enhancePhone(input) {
    if (!input || input.dataset.sbPhone) return;
    input.dataset.sbPhone = '1'; ensureStyle();
    const saved = store.get('septlion.bridge.contact', {});
    const first = splitPhone(input.value || '', saved.countryIso || 'SD');
    const id = input.id + 'Num';
    const box = document.createElement('div'); box.className = 'sb-phone';
    box.innerHTML = '<label class="sb-cc" title="رمز الدولة"><span class="sb-flag" aria-hidden="true"></span><span class="sb-code-txt"></span><span class="sb-chev" aria-hidden="true">▾</span>' +
      '<select aria-label="الدولة">' + COUNTRIES.map(c => '<option value="' + c[0] + '"' + (c[0] === 'SD' ? ' selected' : '') + '>' + flagOf(c[0]) + ' ' + escH(c[2]) + '  +' + c[1] + '</option>').join('') + '</select></label>' +
      '<span class="sb-numwrap"><input class="input sb-num" id="' + id + '" type="tel" inputmode="numeric" autocomplete="tel-national" dir="ltr" maxlength="18"><span class="sb-phone-ok" aria-hidden="true">✓</span></span>';
    const hint = document.createElement('p'); hint.className = 'sb-phone-hint'; hint.setAttribute('aria-live', 'polite');
    input.insertAdjacentElement('afterend', box); box.insertAdjacentElement('afterend', hint);
    input.type = 'hidden';
    const sel = box.querySelector('select'), num = box.querySelector('.sb-num'), wrap = box.querySelector('.sb-numwrap');
    const label = input.id && document.querySelector('label[for="' + input.id + '"]');
    if (label) { label.htmlFor = id; label.innerHTML = 'رقم واتساب'; }
    if (input.getAttribute('aria-describedby')) num.setAttribute('aria-describedby', input.getAttribute('aria-describedby'));
    input.focus = () => num.focus(); // the page focuses the field on a mistake
    let touched = false;
    function sync(fromTyping) {
      const c = countryOf(sel.value);
      box.querySelector('.sb-flag').textContent = flagOf(c[0]);
      box.querySelector('.sb-code-txt').textContent = '+' + c[1];
      num.placeholder = formatNational('912345678123'.slice(0, c[3]));
      if (fromTyping) {
        // A pasted "+966 …" or "00966 …" picks the country by itself.
        const typed = digits(num.value);
        if (/^\s*(\+|00)/.test(typed)) {
          const code = typed.trim().startsWith('00') ? onlyDigits(typed).slice(2) : onlyDigits(typed);
          const hit = COUNTRIES.find(k => code.startsWith(k[1])); // dial codes in the list are prefix-free
          if (!hit) { input.value = ''; wrap.classList.remove('ok'); return; } // still typing the code
          sel.value = hit[0]; num.value = formatNational(code.slice(hit[1].length).replace(/^0+/, '')); return sync(false);
        }
        const f = formatNational(onlyDigits(typed).replace(/^0+/, ''));
        if (num.value !== f) {
          // Keep the caret after the same digit it followed before regrouping.
          const before = onlyDigits(num.value.slice(0, num.selectionStart == null ? num.value.length : num.selectionStart)).length - (onlyDigits(num.value).length - onlyDigits(num.value).replace(/^0+/, '').length);
          num.value = f;
          let pos = 0, seen = 0; while (pos < f.length && seen < Math.max(0, before)) { if (/\d/.test(f[pos])) seen++; pos++; }
          try { num.setSelectionRange(pos, pos); } catch (e) { /* not focusable yet */ }
        }
      }
      const problem = checkPhone(c[0], num.value);
      input.value = problem ? (onlyDigits(num.value) ? '+' + c[1] + ' ' + num.value + '?' : '') : joinPhone(c[0], num.value);
      wrap.classList.toggle('ok', !problem);
      const show = touched && problem && onlyDigits(num.value);
      num.setAttribute('aria-invalid', show ? 'true' : 'false');
      hint.className = 'sb-phone-hint' + (show ? ' bad' : '');
      hint.innerHTML = escH(show ? problem : (problem ? 'اختر الدولة ثم اكتب رقمك بدون الصفر الأول.' : 'سنتواصل معك عبر واتساب على ')) + (show || problem ? '' : '<bdi dir="ltr">' + escH(joinPhone(c[0], num.value)) + '</bdi>');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    sel.value = first.iso; num.value = formatNational(first.national); sync(false);
    num.addEventListener('input', () => sync(true));
    num.addEventListener('blur', () => { touched = true; sync(false); });
    sel.addEventListener('change', () => { store.set('septlion.bridge.contact', Object.assign(store.get('septlion.bridge.contact', {}), { countryIso: sel.value })); sync(false); num.focus(); });
    const form = input.form;
    if (form) form.addEventListener('reset', () => setTimeout(() => { sel.value = store.get('septlion.bridge.contact', {}).countryIso || 'SD'; num.value = ''; touched = false; sync(false); }, 0));
  }

  /* ---------------------------------------------------------------- the sheet */
  let sheet = null, current = null, step = 'contact';
  function ensureSheet() {
    if (sheet) return sheet;
    ensureStyle();
    sheet = document.createElement('div');
    sheet.className = 'sheet'; sheet.id = 'sbVerify';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'sbTitle'); sheet.setAttribute('aria-hidden', 'true'); sheet.inert = true;
    sheet.innerHTML = '<div class="sheet-head"><strong id="sbTitle">أرسل طلبك إلى سبتليون</strong><button class="x" data-act="close-sheet" aria-label="إغلاق">×</button></div><div class="sheet-body"><form id="sbForm" novalidate></form></div>';
    document.body.appendChild(sheet);
    sheet.querySelector('#sbForm').addEventListener('submit', onSubmit);
    sheet.addEventListener('click', e => { if (e.target.closest('[data-sb="wa"]') && current && page().sendWA) { track('/e/request-whatsapp'); page().sendWA(current); } if (e.target.closest('[data-sb="back"]')) { step = 'contact'; render(); } });
    return sheet;
  }
  const field = (id, label, attrs, value) => '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" ' + attrs + ' value="' + escH(value || '') + '"></div>';
  const seg = (name, label, options, value) => '<div class="field"><span class="label">' + label + '</span><div class="sb-seg">' + options.map(o => '<label><input type="radio" name="' + name + '" value="' + escH(o[0]) + '"' + (o[0] === value ? ' checked' : '') + '>' + escH(o[1]) + '</label>').join('') + '</div></div>';
  function render(message) {
    const x = current, f = sheet.querySelector('#sbForm'), need = missing(x), saved = store.get('septlion.bridge.contact', {});
    let h = '';
    if (step === 'contact') {
      h += '<p class="hint">يصل طلبك مباشرة إلى فريق سبتليون، ونرد عليك عبر واتساب بعرض واضح.</p>';
      h += field('sbName', 'الاسم', 'autocomplete="name" required', saved.name);
      h += field('sbCompany', 'الشركة <small>أو اسمك إن لم تكن شركة</small>', 'autocomplete="organization" required', x.company || saved.company);
      h += field('sbWa', 'رقم واتساب', 'type="tel" inputmode="tel" dir="ltr" autocomplete="tel" required', x.phone || saved.whatsapp);
      h += field('sbEmail', 'البريد الإلكتروني <small>اختياري</small>', 'type="email" inputmode="email" dir="ltr" autocomplete="email" placeholder="name@company.com"', saved.email);
      if (need.includes('destination')) h += field('sbDest', 'بلد أو مدينة التسليم', 'autocomplete="off" required', '');
      if (need.includes('quantity')) h += '<div class="sb-row">' + field('sbAmount', 'الكمية', 'inputmode="decimal" dir="ltr" required', '') + '<div class="field"><label for="sbUnit">الوحدة</label><select class="input" id="sbUnit"><option value="FCL">حاوية</option><option value="MT">طن</option><option value="KG">كجم</option></select></div></div>';
      if (need.includes('incoterm')) h += seg('sbInco', 'التسليم', [['CIF', 'CIF · إلى ميناء الوصول'], ['CFR', 'CFR'], ['FOB', 'FOB · من ميناء الشحن']], saved.incoterm || 'CIF');
      if (need.includes('payment')) h += seg('sbPay', 'الدفع', [['LC', 'اعتماد مستندي'], ['TT', 'تحويل بنكي'], ['OTHER', 'نتفق لاحقًا']], saved.payment || 'OTHER');
      h += '<p class="err" id="sbErr" role="alert">' + escH(message || '') + '</p>';
      h += '<button class="btn btn-primary" type="submit" style="margin-top:14px">أرسل الطلب <span class="arrow">←</span></button>';
    } else {
      h += '<p class="hint">أرسلنا رمزًا إلى <b dir="ltr">' + escH(api._pending.contact.email) + '</b>. اكتبه هنا. قد يصل إلى مجلد الرسائل غير المرغوبة.</p>';
      h += field('sbCode', 'رمز التحقق', 'class="input sb-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required', '');
      h += '<p class="err" id="sbErr" role="alert">' + escH(message || '') + '</p>';
      h += '<button class="btn btn-primary" type="submit" style="margin-top:14px">تأكيد وإرسال الطلب <span class="arrow">←</span></button>';
      h += '<button class="sb-alt" type="button" data-sb="back">تعديل البريد أو إعادة إرسال الرمز</button>';
    }
    h += '<button class="sb-alt" type="button" data-sb="wa"' + (message ? '' : ' hidden') + '>أو أرسل الطلب عبر واتساب</button>'; // only after a failure
    f.innerHTML = h;
    enhancePhone(f.querySelector('#sbWa'));
  }
  const val = id => { const el = sheet.querySelector('#' + id); return el ? el.value : ''; };
  const radio = name => { const el = sheet.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; };
  function busy(on) { const b = sheet.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.style.opacity = on ? .6 : 1; } }
  function showErr(m) { const e = sheet.querySelector('#sbErr'); if (e) e.textContent = m; const w = sheet.querySelector('[data-sb="wa"]'); if (w && m) w.hidden = false; }

  async function onSubmit(e) {
    e.preventDefault(); showErr(''); busy(true);
    try {
      if (step === 'contact') {
        const contact = { name: val('sbName'), company: val('sbCompany'), whatsapp: val('sbWa'), email: val('sbEmail') };
        const extra = { destination: val('sbDest'), amount: val('sbAmount'), unit: val('sbUnit'), incoterm: radio('sbInco'), payment: radio('sbPay') };
        const intake = buildIntake(current, contact, extra); // validates before anything is sent
        store.set('septlion.bridge.contact', { countryIso: (store.get('septlion.bridge.contact', {}) || {}).countryIso, name: contact.name, company: contact.company, whatsapp: contact.whatsapp, email: contact.email.trim().toLowerCase(), incoterm: extra.incoterm, payment: extra.payment });
        api._pending = { contact, extra };
        // Already signed in with this confirmed email: keep the platform path, so the
        // request also shows in the buyer's account. Everyone else sends it directly.
        const email = contact.email.trim().toLowerCase();
        const session = email ? await currentSession().catch(() => null) : null;
        if (session && await confirmedEmailOf(session).catch(() => null) === email) return await finish(session);
        const res = await sendIntake(intake);
        done(res && res.reference ? String(res.reference) : '');
      } else {
        const code = digits(val('sbCode')).replace(/\D/g, '');
        if (!/^\d{6,10}$/.test(code)) throw new Error('اكتب الرمز كما وصلك.');
        const s = await verifyCode(api._pending.contact.email.trim().toLowerCase(), code);
        await finish(s);
      }
    } catch (err) { track('/e/request-error'); showErr(err && err.message ? err.message : 'حدث خطأ. حاول مجددًا.'); }
    finally { busy(false); }
  }

  async function finish(session) {
    const catalog = await fetchCatalog();
    const input = buildInput(current, api._pending.contact, api._pending.extra, catalog);
    const res = await createRequirement(session, input);
    done(res && res.rfq && res.rfq.reference ? String(res.rfq.reference) : '');
  }
  function done(ref) {
    track('/e/request-sent');
    markSent(current.id, ref);
    if (page().closeSheets) page().closeSheets(true);
    const box = $('#doneBox');
    if (box && $('#needDone') && current.kind === 'free') {
      box.innerHTML = '<div class="mk">✓</div><h1>تم استلام طلبك.</h1><p>' + (ref ? 'رقم الطلب <b class="latin">' + escH(ref) + '</b>. ' : '') + 'سيتواصل معك فريقنا عبر واتساب أو البريد بعرض مناسب.</p><button class="btn btn-ghost" data-go="orders" style="margin-top:8px">طلباتي</button><button class="btn btn-ghost" data-go="home">العودة للرئيسية</button>';
    }
    if (page().toast) page().toast('تم استلام طلبك' + (ref ? ' — رقم الطلب ' + ref : ''), { label: 'طلباتي', go: 'orders' });
    step = 'contact'; current = null;
  }

  // Mark the page's saved request as sent, so «طلباتي» no longer offers to send it.
  function markSent(id, ref) {
    const k = page().REQ_KEY; if (!k) return;
    store.set(k, store.get(k, []).map(r => r && r.id === id ? Object.assign({}, r, { sent: true, ref, sentVia: 'platform' }) : r));
    if (page().renderOrders) try { page().renderOrders(); } catch (e) { /* view not mounted */ }
  }

  const hookPage = () => enhancePhone(document.getElementById('fPhone'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookPage); else hookPage();
  // Visitor counter: no cookies, nothing stored, the server never keeps the IP address.
  // Steps of a request are counted as paths under /e/ so the team sees where buyers stop.
  function track(path) {
    try {
      if (navigator.doNotTrack === '1' || !/(^|\.)septlion\.com$/.test(location.hostname)) return;
      const body = JSON.stringify({ p: path, r: path === location.pathname ? document.referrer || '' : '' });
      const url = SUPABASE_URL + '/functions/v1/track-visit';
      if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))))
        fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    } catch (e) { /* counting must never break the page */ }
  }
  track(location.pathname);

  api.submit = function (x) {
    current = x; step = 'contact'; ensureSheet(); render(); track('/e/request-open');
    if (page().open) page().open(sheet, document.activeElement);
    else { sheet.inert = false; sheet.setAttribute('aria-hidden', 'false'); sheet.classList.add('open'); }
  };
  return api;
});
