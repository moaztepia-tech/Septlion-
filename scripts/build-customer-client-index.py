"""Builds sites/customer-client/public/index.html from the live new-app snapshot (sites/new-app-live/index.html).

Usage: python3 scripts/build-customer-client-index.py sites/new-app-live/index.html sites/customer-client/public/index.html
"""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
def one(a, b):
    global s
    n = s.count(a)
    assert n == 1, (n, a[:80])
    s = s.replace(a, b)
def every(a, b, expect):
    global s
    n = s.count(a)
    assert n == expect, (n, a[:80])
    s = s.replace(a, b)
# Assets stay in /new-app/ (its admin panel keeps managing them); the page now lives at /.
every('url(fonts/', 'url(/new-app/fonts/', 11)
one('href="fonts/cairo-arabic-700-normal.woff2"', 'href="/new-app/fonts/cairo-arabic-700-normal.woff2"')
one('href="fonts/cairo-arabic-800-normal.woff2"', 'href="/new-app/fonts/cairo-arabic-800-normal.woff2"')
one('href="favicon.ico"', 'href="/new-app/favicon.ico"')
one('href="favicon.svg"', 'href="/new-app/favicon.svg"')
one('href="icons/apple-touch-icon-180.png"', 'href="/new-app/icons/apple-touch-icon-180.png"')
one('href="manifest.webmanifest"', 'href="/new-app/manifest.webmanifest"')
every('https://www.septlion.com/icons/og-image.png', 'https://www.septlion.com/new-app/icons/og-image.png', 2)
one("new URL('data/products.json',location.href)", "new URL('/new-app/data/products.json',location.href)")
# One place for products (founder, 2026-11-27): the cards come from the team panel catalog
# ("المنتجات والقطاعات"); the new-app file is used only when the platform cannot be reached.
one("async function loadCatalog(){\n  try{", "async function loadCatalog(){\n  try{const d=await SeptlionBridge.platformCatalog();if(d){store.set(CATALOG_KEY,d);return d}}catch{}\n  try{")
one("imgs:(Array.isArray(r.imgs)?r.imgs:[]).map(str).filter(Boolean)",
    "imgs:(Array.isArray(r.imgs)?r.imgs:[]).map(str).filter(Boolean).map(u=>/^(https?:|\\/|data:)/.test(u)?u:'/new-app/'+u)")
# Enlarged card (founder, 2026-11-27): the full specification as a short list in three groups
# (quality, packing and shipping, origin and certificates) instead of one run-on line.
one("<span>${esc(fieldsOf(p).map(f=>(f.l?f.l+': ':'')+f.v).join(' · '))}</span><span>السعر: ${esc(p.price||'حسب عرض السعر')} · MOQ والتوريد: حسب عرض السعر</span>",
    "${zoomSpec(p)}<span>السعر: ${esc(p.price||'حسب عرض السعر')}${fieldsOf(p).some(f=>f.zl==='أقل طلب')?'':' · MOQ والتوريد: حسب عرض السعر'}</span>")
one("function fieldsOf(p){", """const ZG=[['q','الجودة'],['s','التعبئة والشحن'],['c','المنشأ والشهادات']],ZKEY=['البروتين','الرطوبة','الجلوتين الرطب'];
function zoomSpec(p){
  const fs=fieldsOf(p).filter(f=>f.zoom!==false);
  if(!fs.some(f=>f.zl))return `<span>${esc(fs.map(f=>(f.l?f.l+': ':'')+f.v).join(' · '))}</span>`;
  const key=ZKEY.map(k=>fs.find(f=>f.zl===k)).filter(Boolean),rest=fs.filter(f=>!key.includes(f));
  const tiles=key.length?`<div class="ztiles">${key.map(f=>`<div><b${f.zv.length>6?' class="zlong"':''}><bdi>${esc(f.zv)}</bdi></b><small>${esc(f.zl)}</small></div>`).join('')}</div>`:'';
  const wide=f=>f.zl==='الشهادات'||f.zv.length>22;
  const fill=r=>{let run=0;return r.map((f,i)=>{if(wide(f)){run=0;return Object.assign({},f,{w:1})}run++;const nx=r[i+1];return Object.assign({},f,{w:run%2===1&&(!nx||wide(nx))?1:0})})};
  const row=f=>f.zl==='الشهادات'?`<div class="zwide"><dt>${esc(f.zl)}</dt><dd class="zchips">${f.zv.split(/\\s*[·،,]\\s*/).filter(Boolean).map(c=>`<i><bdi>${esc(c)}</bdi></i>`).join('')}</dd></div>`:`<div${f.w?' class="zwide"':''}><dt>${esc(f.zl)}</dt><dd><bdi${/[\u0600-\u06FF]/.test(f.zv)?' dir="rtl"':''}>${esc(f.zv)}</bdi></dd></div>`;
  return `<div class="zspec">${ZG.map(([g,t])=>{const r=rest.filter(f=>f.g===g),top=g==='q'?tiles:'';return r.length||top?`<section><h3>${t}</h3>${top}${r.length?`<dl>${fill(r).map(row).join('')}</dl>`:''}</section>`:''}).join('')}</div>`;
}
function fieldsOf(p){""")
one(".zoomcap span{font-size:12px;color:var(--muted)}", """.zoomcap span{font-size:12px;color:var(--muted)}
/* Card facts in one compact framed panel: three columns sized to their text with hairline
   dividers, and the minimum load as a slim footer, so the photo keeps its room. */
.fields.w3{grid-template-columns:repeat(3,auto)!important;grid-template-rows:repeat(2,19px) auto;height:auto;gap:3px 0;padding:5px 2px 0;margin-top:2px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);border-radius:11px;overflow:hidden}
.fields.w3 li:not(.wide){padding-inline:6px;gap:4px;font-size:11.5px}
.fields.w3 li:not(.wide):not(:nth-child(3n+1)){border-inline-start:1px solid rgba(255,255,255,.09)}
.fields.w3 svg{width:13px;height:13px}
.fields li.wide{grid-column:1/-1;margin:2px -2px 0;padding:3px 10px;background:rgba(214,178,94,.09);border-top:1px solid rgba(255,255,255,.09);line-height:19px}
.zspec{display:grid;gap:12px;max-height:min(36vh,320px);overflow:auto;text-align:start;width:min(100%,520px);margin:4px auto 2px;padding:12px;border:1px solid #ffffff1f;border-radius:16px;background:#0b1f38b3}
.ztiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ztiles div{display:grid;gap:2px;justify-items:center;padding:10px 6px;border-radius:12px;background:#ffffff0d;border:1px solid #ffffff14;text-align:center}
.ztiles b{font-size:17px;font-weight:800;color:#f2f6fd;line-height:1.3}
.ztiles b.zlong{font-size:13px;line-height:1.5}
.ztiles small{font-size:11px;color:#9db3d6}
.ztiles+dl{margin-top:6px!important}
.zspec h3{margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.02em;color:#9db3d6}
.zspec dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.zspec dl div{display:grid;gap:1px;padding:7px 10px;border-radius:10px;background:#ffffff08;min-width:0}
.zspec dl .zwide{grid-column:1/-1}
.zspec dt{font-size:11px;color:#9db3d6}
.zspec dd{margin:0;font-size:13px;font-weight:700;color:#f2f6fd;overflow-wrap:anywhere}
.zchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px!important}
.zchips i{font-style:normal;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff24}""")
one("fields:(Array.isArray(r.fields)?r.fields:[]).map(f=>({ic:str(f&&f.ic)||'dot',l:str(f&&f.l),v:str(f&&f.v)})).filter(f=>f.v)};",
    "fields:(Array.isArray(r.fields)?r.fields:[]).map(f=>({ic:str(f&&f.ic)||'dot',l:str(f&&f.l),v:str(f&&f.v),g:str(f&&f.g),zl:str(f&&f.zl),zv:str(f&&f.zv)||str(f&&f.v),zoom:!(f&&f.zoom===false),card:!(f&&f.card===false),wide:!!(f&&f.wide)})).filter(f=>f.v)};")
# Requests go to the SEPTLION platform after an email code (septlion-bridge.js); WhatsApp stays as a fallback.
one("const x={id:'RFQ-'+Date.now().toString().slice(-7),kind:'sku',", "const x={id:'RFQ-'+Date.now().toString().slice(-7),kind:'sku',productId:p?p.id:'',")
one("""  sendWA(x);
  toast('جهّزنا طلبك في واتساب — اضغط «إرسال» ليصلنا',{label:'طلباتي',go:'orders'});""", "  SeptlionBridge.submit(x);")
one("<h1>طلبك جاهز للإرسال.</h1><p>فتحنا واتساب برسالة جاهزة — اضغط «إرسال» ليصلنا الطلب. إن لم يفتح واتساب استخدم الأزرار أدناه.</p>",
    "<h1>طلبك محفوظ.</h1><p>أكّد بريدك ليصل الطلب إلى فريق سبتليون.</p>")
one("go('needDone'); sendWA(x);", "go('needDone'); SeptlionBridge.submit(x);")
one('<button class="btn btn-primary" data-act="submit-rfq"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/><path d="M9.3 8.8c.2 2.6 3.1 5.4 5.9 5.9l1-1.3-2-1-.9.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.9-1-2z"/></svg>إرسال الطلب عبر واتساب</button>',
    '<button class="btn btn-primary" data-act="submit-rfq"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg>إرسال الطلب</button>')
one("يصلنا الطلب عند إرساله عبر واتساب أو البريد.", "يصلنا الطلب بعد تأكيد بريدك.")
one("'يُرسل الطلب إلى SEPTLION عبر واتساب أو البريد'", "'يصل الطلب إلى SEPTLION بعد تأكيد بريدك'")
# The platform is the main way to send; WhatsApp stays as a small fallback link.
one("""const reqBtns=x=>`<div class="sendbox">${cbtn('pri wa',ICO_WA,'الأسرع — رسالة جاهزة','إرسال عبر واتساب',`type="button" data-act="send-wa" data-id="${esc(x.id)}"`)}${cbtn('ml',ICO_ML,'نسخة مكتوبة','إرسال عبر البريد',`type="button" data-act="send-mail" data-id="${esc(x.id)}"`)}${x.sent?'':`<button class="btn-link" data-act="mark-sent" data-id="${esc(x.id)}">أرسلتُ الطلب بالفعل</button>`}</div>`;""",
    """const ICO_SEND='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg>';
const reqBtns=x=>`<div class="sendbox">${cbtn('pri ml',ICO_SEND,'يصل مباشرة إلى فريق سبتليون','إرسال الطلب',`type="button" data-act="send-platform" data-id="${esc(x.id)}"`)}<button class="btn-link" style="justify-self:center;color:var(--sky,#9db3d6);font-weight:500" data-act="send-wa" data-id="${esc(x.id)}">أو أرسله عبر واتساب</button></div>`;""")
one("case 'send-wa':{", "case 'send-platform':{const x=reqById(a.dataset.id);x&&SeptlionBridge.submit(x);break}\n    case 'send-wa':{")
one("سيُفتح واتساب برسالة جاهزة؛ اضغط «إرسال» ليصلنا الطلب.", "نؤكد بريدك مرة واحدة، ثم يصل طلبك مباشرة إلى فريق سبتليون.")
one("طلبك محفوظ على جهازك ولم يصلنا بعد. أرسله عبر واتساب أو البريد لنبدأ المراجعة.", "طلبك محفوظ على جهازك ولم يصلنا بعد. اضغط «إرسال الطلب» لنبدأ المراجعة.")
# Destination search: each country with its flag, its ports listed under it.
one("function dOptions(raw){", """const FLAG_ISO={'السعودية':'SA','السودان':'SD','الإمارات':'AE','مصر':'EG','تنزانيا':'TZ','كينيا':'KE','اليمن':'YE','غانا':'GH','نيجيريا':'NG','جيبوتي':'DJ','تشاد':'TD'};
const flagC=c=>{const i=FLAG_ISO[c];return i?String.fromCodePoint(...[...i].map(x=>0x1F1E6+x.charCodeAt(0)-65)):'🌍'};
function dOptions(raw){
  const src=dOptions0(raw),out=[],li=src.findIndex(o=>o.h==='آخر وجهة استخدمتها');
  if(li>=0)out.push(src[li],src[li+1]);
  const opts=src.filter((o,i)=>!o.h&&!o.free&&!(li>=0&&i===li+1));
  [...new Set(opts.map(o=>o.c))].forEach(c=>{
    const ports=DEST.filter(d=>d[1]===c);
    if(!ports.length){out.push(...opts.filter(o=>o.c===c));return}
    out.push({h:'<span class="dflag">'+flagC(c)+'</span> '+esc(c)});
    ports.forEach(d=>out.push({c,p:d[0],g:1}));
  });
  return out.concat(src.filter(o=>o.free));
}
function dOptions0(raw){""")
one("<span>${dHl(o.p,q)}</span><small>${dHl(o.c,q)}</small>", "<span>${dHl(o.p,q)}</span>${o.g?'':`<small>${flagC(o.c)} ${dHl(o.c,q)}</small>`}")
one("const destLabel=()=>dest.value?dest.value+(port.value?' — '+port.value:''):'';", "const destLabel=()=>dest.value?flagC(dest.value)+' '+dest.value+(port.value?' — '+port.value:''):'';")
one("${o.last?'آخر وجهة':esc(o.c)}", "${o.last?'آخر وجهة':flagC(o.c)+' '+esc(o.c)}")
one(".dh{padding:8px 10px 4px;font-size:10.5px;font-weight:700;color:#8da4c9}", ".dh{padding:10px 10px 4px;font-size:13px;font-weight:800;color:#c9d8f0;display:flex;align-items:center;gap:6px}.dh .dflag{font-size:18px;line-height:1}")
# Smart request (founder, 2026-11-27): the buyer writes the need in their own words on the
# home page, and the platform composer at /require/ understands it, asks one question at a
# time and sends it for a single Septlion offer.
one(".cta{display:grid;gap:10px}", """.ask{display:grid;gap:8px;margin:0 0 14px}
.ask label{font-size:13px;font-weight:800;color:#f2f6fd}
.ask-box{position:relative;display:flex;align-items:flex-end;gap:8px;padding:8px;background:#0b1f38;border:1px solid #8fb0d6;border-radius:14px;box-shadow:inset 0 1px 0 #ffffff12,0 8px 22px #0004}
.ask-box:focus-within{border-color:#eaf1fb;box-shadow:0 0 0 3px #b5c7e633,0 8px 22px #0004}
.ask textarea{flex:1;min-height:58px;max-height:150px;resize:none;background:transparent;border:0;outline:0;color:#f2f6fd;font-family:inherit;font-size:14px;font-weight:600;line-height:1.8;padding:4px 6px}
.ask textarea::placeholder{color:#8ea6c4;font-weight:500}
.ask-send{flex:none;width:46px;height:46px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#f1f6fc,#b9cde3);color:var(--ink);border:1px solid #fff;font-size:20px;font-weight:800}
.ask-send:disabled{opacity:.45}
.ask small{font-size:11px;line-height:1.9;color:#b8cbe1}
.cta{display:grid;gap:10px}""")
one('<p class="desc">ننسّق التوريد والتصنيع والخدمات اللوجستية، من تحديد الاحتياج إلى عرض السعر ثم التنفيذ وفق الاتفاق.</p>',
    '<p class="desc">ننسّق التوريد والتصنيع والخدمات اللوجستية، من تحديد الاحتياج إلى عرض السعر ثم التنفيذ وفق الاتفاق.</p>\n      <form class="ask" id="askForm" novalidate><label for="askInput">اكتب ما تحتاجه بكلامك</label><div class="ask-box"><textarea id="askInput" rows="2" maxlength="4000" enterkeyhint="send" placeholder="مثال: أحتاج 5 حاويات دقيق مخابز بتعبئة 50 كجم إلى كوتونو، بنين"></textarea><button class="ask-send" type="submit" aria-label="ابدأ الطلب">←</button></div><small>نفهم طلبك ونسألك سؤالًا واحدًا في كل مرة، ثم يصلك عرض واحد من سبتليون.</small></form>')
one('<strong>أخبرنا بما تحتاجه</strong><small>صف احتياجك، وسنبدأ منه</small>', '<strong>أخبرنا بما تحتاجه</strong><small>محرّر الطلب الذكي</small>')
one("  if(!NEED_ON&&/^need/.test(id)){id='discover';history.replaceState(null,'','#discover')}",
    "  if(/^need/.test(id)){history.replaceState(null,'','#home');return openComposer(S.prefill?'أحتاج '+S.prefill:'')}")
one("function go(id){", """function openComposer(text){try{if(text&&text.trim())sessionStorage.setItem('septlion_requirement_seed',text.trim().slice(0,4000))}catch(e){}location.href='/require/'}
function go(id){""")
one("$('#chatSend').addEventListener('click',()=>send());", """$('#chatSend').addEventListener('click',()=>send());
const askIn=$('#askInput');
$('#askForm').addEventListener('submit',e=>{e.preventDefault();const t=askIn.value.trim();if(!t){askIn.focus();return}openComposer(t)});
askIn.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#askForm').requestSubmit()}});
askIn.addEventListener('input',()=>{askIn.style.height='auto';askIn.style.height=Math.min(askIn.scrollHeight,150)+'px'});""")
# Icons a trader reads at a glance: a wheat ear for protein, a ship for delivery terms,
# a container for the minimum load.
one("const ico=k=>", """Object.assign(ICONS,{
 wheat:'<path d="M12 21V6M12 6c-1.6-.8-2.5-2.2-2.5-3.5 1.6.2 2.5 1.6 2.5 3.5zM12 6c1.6-.8 2.5-2.2 2.5-3.5-1.6.2-2.5 1.6-2.5 3.5zM12 11c-2.2-.4-3.5-2-3.5-3.8 2.2.2 3.5 1.8 3.5 3.8zM12 11c2.2-.4 3.5-2 3.5-3.8-2.2.2-3.5 1.8-3.5 3.8zM12 16c-2.2-.4-3.5-2-3.5-3.8 2.2.2 3.5 1.8 3.5 3.8zM12 16c2.2-.4 3.5-2 3.5-3.8-2.2.2-3.5 1.8-3.5 3.8z"/>',
 ship:'<path d="M3 15h18l-2.5 5h-13zM6 15v-4h12v4M12 11V4l5 3-5 2"/>',
 box:'<path d="M3 7h18v11H3zM7.5 9.5v6M12 9.5v6M16.5 9.5v6"/>',
 cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>'});
const ico=k=>""")
# Card facts: hide enlarged-only details and give the minimum load its own full line.
one('const fieldsHTML=p=>{const f=fieldsOf(p).slice(0,6),cols=Math.max(1,Math.ceil(f.length/2));return `<ul class="fields" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${f.map(x=>`<li title="${esc(x.l||\'\')}">${ico(x.ic)}<span class="sr-only">${esc(x.l||\'\')}: </span><span class="v${/^[A-Za-z0-9 .\\-\\/]+$/.test(x.v)?\' lat\':\'\'}" dir="auto">${esc(x.v)}</span></li>`).join(\'\')}</ul>`};', 'const fieldsHTML=p=>{const a=fieldsOf(p).filter(x=>x.card!==false),w=a.filter(x=>x.wide).slice(0,1),f=a.filter(x=>!x.wide).slice(0,6).concat(w),cols=Math.max(1,Math.ceil((f.length-w.length)/2));return `<ul class="fields${w.length?\' w3\':\'\'}" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${f.map(x=>`<li${x.wide?\' class="wide"\':\'\'} title="${esc(x.l||\'\')}">${ico(x.ic)}<span class="sr-only">${esc(x.l||\'\')}: </span><span class="v${/^[A-Za-z0-9 .\\-\\/]+$/.test(x.v)?\' lat\':\'\'}" dir="auto">${esc(x.v)}</span></li>`).join(\'\')}</ul>`};')
# The service worker file lives in /new-app/ and cannot control the root.
s, n = re.subn(r"if\('serviceWorker' in navigator&&!PREVIEW[^\n]*register\('sw\.js'\)\.catch\(\(\)=>\{\}\)\);?", "/* service worker stays with /new-app/ */", s)
assert n == 1, n
# Expose the helpers the bridge needs, then load it before the page script.
i = s.rindex('})();\n</script>')
s = s[:i] + 'window.SeptlionPage={open,closeSheets,toast,sendWA,REQ_KEY,renderOrders};\n' + s[i:]
one('<script type="application/json" id="seed-data">', '<script src="septlion-bridge.js"></script>\n<script type="application/json" id="seed-data">')
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s.encode()))
