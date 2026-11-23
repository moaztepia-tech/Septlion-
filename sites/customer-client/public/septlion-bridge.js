/* SEPTLION bridge: the customer interface stays as it is, and every request it
   saves is also sent to the SEPTLION platform (Supabase trade-api), after the
   customer confirms an email address with a one-time code.
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
        product: clean(x.title, 500), destination, quantity: n, unit: 'FCL', containerCount: n,
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

  const api = { parseQuantity, paymentCode, catalogRef, missing, buildInput };
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
  async function createRequirement(session, input) {
    const r = await fetch(SUPABASE_URL + '/functions/v1/trade-api', { method: 'POST', headers: headers(session.access_token), body: JSON.stringify({ action: 'requirements.create', input }) });
    const b = await body(r);
    if (!r.ok) throw new Error(errText(b, r.status === 429 ? 'طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.' : 'تعذر إرسال الطلب الآن. طلبك محفوظ؛ يمكنك إرساله عبر واتساب.'));
    return b;
  }

  /* ---------------------------------------------------------------- the sheet */
  let sheet = null, current = null, step = 'contact';
  function ensureSheet() {
    if (sheet) return sheet;
    const style = document.createElement('style');
    style.textContent = '#sbVerify .sheet-body{padding-bottom:18px}#sbVerify .sb-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}#sbVerify .sb-seg{display:flex;gap:8px;flex-wrap:wrap}#sbVerify .sb-seg label{flex:1;min-width:72px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border:1px solid #3b5780;border-radius:11px;background:#0b2037;font-size:13px;cursor:pointer}#sbVerify .sb-seg input{accent-color:#b9cde3}#sbVerify .sb-seg label:has(input:checked){border-color:#b9cde3;background:#162d4d}#sbVerify .sb-code{letter-spacing:.4em;text-align:center;font-size:22px;direction:ltr}#sbVerify .sb-alt{display:block;margin:12px auto 0;background:none;border:0;color:var(--sky,#9db3d6);font-size:13px;text-decoration:underline;cursor:pointer}#sbVerify .err{margin-top:10px;font-size:12px}#sbVerify .sb-ok{font-size:13px;color:#cfe3c9;margin-top:10px}';
    document.head.appendChild(style);
    sheet = document.createElement('div');
    sheet.className = 'sheet'; sheet.id = 'sbVerify';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'sbTitle'); sheet.setAttribute('aria-hidden', 'true'); sheet.inert = true;
    sheet.innerHTML = '<div class="sheet-head"><strong id="sbTitle">أكّد بريدك ليصلنا طلبك</strong><button class="x" data-act="close-sheet" aria-label="إغلاق">×</button></div><div class="sheet-body"><form id="sbForm" novalidate></form></div>';
    document.body.appendChild(sheet);
    sheet.querySelector('#sbForm').addEventListener('submit', onSubmit);
    sheet.addEventListener('click', e => { if (e.target.closest('[data-sb="wa"]') && current && page().sendWA) page().sendWA(current); if (e.target.closest('[data-sb="back"]')) { step = 'contact'; render(); } });
    return sheet;
  }
  const field = (id, label, attrs, value) => '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" ' + attrs + ' value="' + escH(value || '') + '"></div>';
  const seg = (name, label, options, value) => '<div class="field"><span class="label">' + label + '</span><div class="sb-seg">' + options.map(o => '<label><input type="radio" name="' + name + '" value="' + escH(o[0]) + '"' + (o[0] === value ? ' checked' : '') + '>' + escH(o[1]) + '</label>').join('') + '</div></div>';
  function render(message) {
    const x = current, f = sheet.querySelector('#sbForm'), need = missing(x), saved = store.get('septlion.bridge.contact', {});
    let h = '';
    if (step === 'contact') {
      h += '<p class="hint">نرسل رمزًا إلى بريدك للتأكد أن الطلب منك، ثم يصل الطلب مباشرة إلى فريق سبتليون.</p>';
      h += field('sbName', 'الاسم', 'autocomplete="name" required', saved.name);
      h += field('sbCompany', 'الشركة <small>أو اسمك إن لم تكن شركة</small>', 'autocomplete="organization" required', x.company || saved.company);
      h += field('sbWa', 'رقم واتساب مع رمز الدولة', 'type="tel" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="+249 …" required', x.phone || saved.whatsapp);
      h += field('sbEmail', 'البريد الإلكتروني', 'type="email" inputmode="email" dir="ltr" autocomplete="email" placeholder="name@company.com" required', saved.email);
      if (need.includes('destination')) h += field('sbDest', 'بلد أو مدينة التسليم', 'autocomplete="off" required', '');
      if (need.includes('quantity')) h += '<div class="sb-row">' + field('sbAmount', 'الكمية', 'inputmode="decimal" dir="ltr" required', '') + '<div class="field"><label for="sbUnit">الوحدة</label><select class="input" id="sbUnit"><option value="FCL">حاوية</option><option value="MT">طن</option><option value="KG">كجم</option></select></div></div>';
      if (need.includes('incoterm')) h += seg('sbInco', 'التسليم', [['CIF', 'CIF · إلى ميناء الوصول'], ['CFR', 'CFR'], ['FOB', 'FOB · من ميناء الشحن']], saved.incoterm || 'CIF');
      if (need.includes('payment')) h += seg('sbPay', 'الدفع', [['LC', 'اعتماد مستندي'], ['TT', 'تحويل بنكي'], ['OTHER', 'نتفق لاحقًا']], saved.payment || 'OTHER');
      h += '<p class="err" id="sbErr" role="alert">' + escH(message || '') + '</p>';
      h += '<button class="btn btn-primary" type="submit" style="margin-top:14px">أرسل رمز التحقق <span class="arrow">←</span></button>';
    } else {
      h += '<p class="hint">أرسلنا رمزًا إلى <b dir="ltr">' + escH(api._pending.contact.email) + '</b>. اكتبه هنا. قد يصل إلى مجلد الرسائل غير المرغوبة.</p>';
      h += field('sbCode', 'رمز التحقق', 'class="input sb-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required', '');
      h += '<p class="err" id="sbErr" role="alert">' + escH(message || '') + '</p>';
      h += '<button class="btn btn-primary" type="submit" style="margin-top:14px">تأكيد وإرسال الطلب <span class="arrow">←</span></button>';
      h += '<button class="sb-alt" type="button" data-sb="back">تعديل البريد أو إعادة إرسال الرمز</button>';
    }
    h += '<button class="sb-alt" type="button" data-sb="wa">أو أرسل الطلب عبر واتساب</button>';
    f.innerHTML = h;
  }
  const val = id => { const el = sheet.querySelector('#' + id); return el ? el.value : ''; };
  const radio = name => { const el = sheet.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; };
  function busy(on) { const b = sheet.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.style.opacity = on ? .6 : 1; } }
  function showErr(m) { const e = sheet.querySelector('#sbErr'); if (e) e.textContent = m; }

  async function onSubmit(e) {
    e.preventDefault(); showErr(''); busy(true);
    try {
      if (step === 'contact') {
        const contact = { name: val('sbName'), company: val('sbCompany'), whatsapp: val('sbWa'), email: val('sbEmail') };
        const extra = { destination: val('sbDest'), amount: val('sbAmount'), unit: val('sbUnit'), incoterm: radio('sbInco'), payment: radio('sbPay') };
        buildInput(current, contact, extra, null); // validates before any code is sent
        store.set('septlion.bridge.contact', { name: contact.name, company: contact.company, whatsapp: contact.whatsapp, email: contact.email.trim().toLowerCase(), incoterm: extra.incoterm, payment: extra.payment });
        api._pending = { contact, extra };
        const session = await currentSession().catch(() => null);
        if (session && await confirmedEmailOf(session).catch(() => null) === contact.email.trim().toLowerCase()) return await finish(session);
        await sendCode(contact.email.trim().toLowerCase());
        step = 'code'; render();
        setTimeout(() => { const c = sheet.querySelector('#sbCode'); c && c.focus(); }, 60);
      } else {
        const code = digits(val('sbCode')).replace(/\D/g, '');
        if (!/^\d{6,10}$/.test(code)) throw new Error('اكتب الرمز كما وصلك.');
        const s = await verifyCode(api._pending.contact.email.trim().toLowerCase(), code);
        await finish(s);
      }
    } catch (err) { showErr(err && err.message ? err.message : 'حدث خطأ. حاول مجددًا.'); }
    finally { busy(false); }
  }

  async function finish(session) {
    const catalog = await fetchCatalog();
    const input = buildInput(current, api._pending.contact, api._pending.extra, catalog);
    const res = await createRequirement(session, input);
    const ref = res && res.rfq && res.rfq.reference ? String(res.rfq.reference) : '';
    markSent(current.id, ref);
    if (page().closeSheets) page().closeSheets(true);
    const done = $('#doneBox');
    if (done && $('#needDone') && current.kind === 'free') {
      done.innerHTML = '<div class="mk">✓</div><h1>وصل طلبك إلى سبتليون.</h1><p>' + (ref ? 'رقم الطلب <b class="latin">' + escH(ref) + '</b>. ' : '') + 'سيتواصل معك فريقنا عبر واتساب أو البريد بعرض مناسب.</p><button class="btn btn-ghost" data-go="orders" style="margin-top:8px">طلباتي</button><button class="btn btn-ghost" data-go="home">العودة للرئيسية</button>';
    }
    if (page().toast) page().toast('وصل طلبك إلى سبتليون' + (ref ? ' — ' + ref : ''), { label: 'طلباتي', go: 'orders' });
    step = 'contact'; current = null;
  }

  // Mark the page's saved request as sent, so «طلباتي» no longer offers to send it.
  function markSent(id, ref) {
    const k = page().REQ_KEY; if (!k) return;
    store.set(k, store.get(k, []).map(r => r && r.id === id ? Object.assign({}, r, { sent: true, ref, sentVia: 'platform' }) : r));
    if (page().renderOrders) try { page().renderOrders(); } catch (e) { /* view not mounted */ }
  }

  api.submit = function (x) {
    current = x; step = 'contact'; ensureSheet(); render();
    if (page().open) page().open(sheet, document.activeElement);
    else { sheet.inert = false; sheet.setAttribute('aria-hidden', 'false'); sheet.classList.add('open'); }
  };
  return api;
});
