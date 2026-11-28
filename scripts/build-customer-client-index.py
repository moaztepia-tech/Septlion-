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
    "${zoomSpec(p)}<span>السعر: ${esc(p.price||'حسب الطلب')}${fieldsOf(p).some(f=>f.zl==='أقل طلب')?'':' · MOQ والتوريد: حسب الطلب'}</span>")
one("function fieldsOf(p){", """const ZG=[['q','الجودة'],['s','التعبئة والشحن'],['c','المنشأ والشهادات']],ZKEY=['البروتين','الرطوبة','الجلوتين الرطب'];
function zoomSpec(p){
  const fs=fieldsOf(p).filter(f=>f.zoom!==false);
  if(!fs.some(f=>f.zl))return `<span>${esc(fs.map(f=>(f.l?f.l+': ':'')+f.v).join(' · '))}</span>`;
  const k0=ZKEY.map(k=>fs.find(f=>f.zl===k)).filter(Boolean),key=k0.length?k0:fs.filter(f=>f.g==='q'&&f.zoom!==false&&f.zv.length<=14).slice(0,3),rest=fs.filter(f=>!key.includes(f));
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
.zchips i{font-style:normal;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff24}
/* Enlarged view as a spec sheet: a shorter photo, the name on top, the sheet scrolling on
   its own, and the price fixed at the bottom. Each section is one card of label/value rows. */
.zoom:has(.zspec){grid-template-rows:minmax(0,38vh) minmax(0,1fr);gap:12px;place-items:stretch;padding-top:52px}
.zoom:has(.zspec) .zoombox{justify-self:center;width:min(100%,520px)}
.zoom:has(.zspec) .zoomcap{grid-template-rows:auto minmax(0,1fr) auto;min-height:0;gap:8px;justify-self:center;width:min(100%,520px)}
.zoom .zspec{max-height:none;min-height:0;overflow:auto;gap:10px;width:100%;margin:0;padding:0 0 2px;border:0;border-radius:0;background:none;overscroll-behavior:contain}
.zoom:has(.zspec) .zoombox .gslide{padding:4px 0 22px}
.zspec .ztiles b.zlong{font-size:12.5px;white-space:nowrap}
.zspec section{padding:10px 14px 2px;border-radius:14px;background:#ffffff08;border:1px solid #ffffff12}
.zspec h3{color:var(--gold);font-size:11.5px;margin-bottom:8px}
.zspec .ztiles{margin-bottom:4px}
.zspec .ztiles div{background:#ffffff0a}
.zspec dl{grid-template-columns:1fr!important;gap:0!important;margin-top:0!important}
.zspec dl div,.zspec dl .zwide{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:9px 0;border-radius:0;background:none;border-top:1px solid #ffffff10}
.zspec .ztiles+dl div:first-child{border-top:0}
.zspec dl div:first-child{border-top:0}
.zspec dt{flex:none;font-size:12.5px}
.zspec dd{text-align:end;font-size:13.5px;line-height:1.5}
.zspec dd.zchips{justify-content:flex-end;margin-top:0!important}
.zoom:has(.zspec) .zoomcap>span:last-child{justify-self:center;padding:5px 14px;border-radius:999px;background:#ffffff0d;border:1px solid #ffffff14;color:#c9d6ec}
/* Quote sheet: numbered steps, a product box with the real photo and key facts, quick
   quantity picks, and the terms shown open. */
.rfq .qtons{white-space:nowrap;padding:3px 9px;border-radius:999px;background:#d6b25e1f;border:1px solid #d6b25e55;color:#f3dfa6;font:700 12px var(--latin)}
.rfq .qtons:empty{display:none}
.sheet.rfq .terms .seg[data-key=incoterm]{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:1fr}
.rfq .moderow{margin-top:12px;display:grid;gap:6px}
.rfq .moderow .label{font-size:12px;font-weight:700;color:#9db3d6}
.rfq .moderow .seg button{min-height:42px;font-size:13px}
.rfq .qhint{margin:6px 4px 0;font-size:11.5px;color:#9db3d6;text-align:center}
.rfq .qhint:empty{display:none}
.rfq .landnote{margin:2px 4px 0;font-size:12px;font-weight:700;color:#f3dfa6}
.dh .dtag{margin-inline-start:auto;font-style:normal;font-size:11px;font-weight:700;color:#f3dfa6;border:1px solid rgba(243,223,166,.35);border-radius:999px;padding:1px 8px;white-space:nowrap}
/* The quote sheet grew (destination list, sea/land, four steps): keep it inside the screen, scroll its
   middle and keep the title and the send button always in view. */
#rfq.sheet.rfq{max-height:94dvh;overflow:hidden}
#rfq.sheet.rfq .rfq-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:14px;scrollbar-width:thin}
/* Levels: one card with the current level, a 7-step progress track and the step to the next level. */
.rfq .trow{margin-top:10px;padding:12px 12px 10px;border-radius:12px;background:#ffffff08;border:1px solid #ffffff1f}
.rfq .trow .tier{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 0 10px}
.rfq .tier .lvname{font-size:14px;font-weight:800;color:#f3dfa6}
.rfq .tier .lvrange{font-size:12px;font-weight:700;color:#c3d1ee;white-space:nowrap}
.rfq .trow details.opt.lv>.levels.lvtrack{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;direction:rtl}
.sheet.rfq .levels.lvtrack button{min-height:30px;padding:4px 0;border:0;border-radius:0;background:none;display:grid;gap:5px;justify-items:stretch;color:#7f95ba}
.rfq .levels.lvtrack button[aria-pressed=true]{background:none;border:0}
.rfq .lvtrack i{display:block;height:6px;border-radius:99px;background:#ffffff1f;transition:background .2s}
.rfq .lvtrack button.done i{background:#c9a24a99}
.rfq .lvtrack button.cur i{background:#f3dfa6;box-shadow:0 0 0 3px #f3dfa633}
.rfq .trow details.opt.lv{margin:0!important;padding:0!important;border:0;min-height:0}
.rfq .lvtrack b{font:800 10px var(--latin);text-align:center}
.rfq .lvtrack button.cur b{color:#fff}
.rfq .lvnext{margin:10px 0 0;padding-top:8px;border-top:1px solid #ffffff14;font-size:12px;color:#9db3d6}
.rfq .lvnext button{background:none;border:0;padding:4px 0;color:#c3d1ee;font:600 12px var(--font);text-align:start;cursor:pointer}
.rfq .lvnext button b{color:#f3dfa6;font-weight:800}
.rfq #destQuick.dq:not(:empty){display:flex;margin-top:8px}
.rfq .landnote:empty{display:none}
.rfq .rlabel{display:flex;align-items:center;gap:8px;margin:18px 2px 8px;font-size:14px}
.rfq .rlabel i{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--gold);color:#0b1f38;font:800 11px var(--latin);font-style:normal}
.rfq .pbox{align-items:center;gap:12px;padding:8px;background:#ffffff08;border-color:#ffffff1f}
.rfq .pthumb.photo{width:64px;height:64px;border-radius:10px;background:#ffffff10}
.rfq .pthumb.photo img{width:100%;height:100%;object-fit:cover;display:block}
.rfq .pinfo strong{font-size:15px}
.rfq .pmeta{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
.rfq .pmeta span{font-size:11px;padding:2px 8px;border-radius:999px;background:#ffffff10;border:1px solid #ffffff1a;color:#dbe6f8}
.rfq .pmoq{display:block;margin-top:5px;font-size:11px;color:var(--gold)}
.rfq .opt.lv>summary{display:none}
.rfq .opt.lv{margin-top:8px}
.sheet.rfq .levels{gap:4px}
.sheet.rfq .levels button{min-height:52px;padding:4px 1px;border-radius:9px;gap:3px}
.sheet.rfq .levels strong{font-size:10.5px}
.sheet.rfq .levels span{font-size:9px;line-height:1.25}
.rfq .tier{font-size:11.5px;color:#9db3d6;padding-top:6px}
.rfq .terms{padding:12px;border-radius:12px;background:#ffffff08;border:1px solid #ffffff1f}
.sheet.rfq .terms .grid2{grid-template-columns:1fr;gap:12px}
.rfq .terms .label{font-size:12px;font-weight:700;color:#9db3d6}
.rfq .terms .field{margin-top:0!important;gap:6px}
.rfq .terms .tpanel>.grid2{margin-top:0}
.rfq .terms .seg button{min-height:42px;font-size:12px;padding:0 4px;white-space:nowrap}
.rfq .terms .helper{margin:10px 2px 0;font-size:11.5px;line-height:1.7;color:#9db3d6}""")
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
  if(!norm(raw))return dBrowse();
  const src=dOptions0(raw),out=[],li=src.findIndex(o=>o.h==='آخر وجهة استخدمتها');
  if(li>=0)out.push(src[li],src[li+1]);
  const opts=src.filter((o,i)=>!o.h&&!o.free&&!(li>=0&&i===li+1));
  const q=norm(raw),rank=c=>{const n=norm(c);return (n===q?0:n.startsWith(q)?1:2)*100+n.length};
  [...new Set(opts.map(o=>o.c))].sort((x,y)=>q?rank(x)-rank(y):0).forEach(c=>{
    const ports=DEST.filter(d=>d[1]===c),has=o=>Object.prototype.hasOwnProperty.call(o,c);
    if(!ports.length){out.push(...opts.filter(o=>o.c===c));return}
    out.push({h:'<span class="dflag">'+flagC(c)+'</span> '+esc(c)+(has(LAND)?'<em class="dtag">بحراً أو براً</em>':has(TRANSIT)?'<em class="dtag">بحراً ثم براً</em>':'')});
    if(ports.length>1||has(LAND))out.push({c,p:'',g:1});ports.forEach(d=>out.push({c,p:d[0],g:1}));
  });
  return out.concat(src.filter(o=>o.free));
}
function dOptions0(raw){""")
one("<span>${dHl(o.p,q)}</span><small>${dHl(o.c,q)}</small>", "<span>${dHl(o.p,q)}</span>${o.g?'':`<small>${flagC(o.c)} ${dHl(o.c,q)}</small>`}")
one("const destLabel=()=>dest.value?dest.value+(port.value?' — '+port.value:''):'';", "const destLabel=()=>dest.value?flagC(dest.value)+' '+dest.value+(port.value?' — '+port.value:''):'';")
one("${o.last?'آخر وجهة':esc(o.c)}", "${o.last?'آخر وجهة':o.mine?'':flagC(o.c)+' '+esc(o.c)}")
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
# Price wording: the price depends on the buyer's quantity, port and terms, so "حسب الطلب".
every("esc(p.price||'حسب العرض')", "esc(p.price||'حسب الطلب')", 1)
one("['السعر','حسب العرض']", "['السعر','حسب الطلب']")
# Quote sheet, laid out as three numbered steps (quantity, destination, terms) under a product
# box that shows the real photo and the card's key facts; terms open by default.
one('$(\'#pbox\').innerHTML=`<div class="pthumb" aria-hidden="true">${art(p)}</div><div class="pinfo">${p.brand!==NO_BRAND?`<span class="brand-t">${esc(p.brand)}</span>`:\'\'}<strong>${esc(p.name)}</strong><div class="pmeta">${[p.type,p.pack,p.size].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join(\'\')}<span class="sku">${esc(p.sku)}</span></div></div>`;', '$(\'#pbox\').innerHTML=`<div class="pthumb${p.imgs&&p.imgs.length?\' photo\':\'\'}" aria-hidden="true">${p.imgs&&p.imgs.length?`<img src="${esc(p.imgs[0])}" alt="" loading="lazy" decoding="async">`:art(p)}</div><div class="pinfo">${p.brand!==NO_BRAND?`<span class="brand-t">${esc(p.brand)}</span>`:\'\'}<strong>${esc(p.name)} · ${esc(p.size||\'\')}</strong><div class="pmeta">${fieldsOf(p).filter(f=>f.card!==false&&!f.wide).slice(0,3).map(f=>`<span>${esc(f.v)}</span>`).join(\'\')}</div>${(fieldsOf(p).find(f=>f.wide)||{}).v?`<small class="pmoq">${esc(fieldsOf(p).find(f=>f.wide).v)}</small>`:\'\'}</div>`;qty.dataset.tpc=p.tpc||\'\';')
one('<div class="rlabel">كم تحتاج؟</div>', '<div class="rlabel"><i>1</i>كم تحتاج؟</div>')
one('<div class="rlabel">إلى أين؟</div>', '<div class="rlabel"><i>2</i>إلى أين؟</div>')
one('<details class="opt" id="termsD"><summary>الشروط: <b id="termSum">CIF · LC</b><span class="ed">تعديل</span></summary>', '<div class="rlabel"><i>3</i>التسليم والدفع</div>\n    <div class="terms" id="termsD"><b id="termSum" hidden>CIF · LC</b>')
one('data-v="LC — اعتماد مستندي">LC · اعتماد</button>', 'data-v="LC — اعتماد مستندي">اعتماد مستندي</button>')
one('data-v="TT — تحويل بنكي">TT · تحويل</button>', 'data-v="TT — تحويل بنكي">تحويل مقدم</button>')
one('<div class="pop"><div class="grid2">', '<div class="tpanel"><div class="grid2">')
one('<p class="helper" id="termHelp" aria-live="polite"></p></div>\n    </details>', '<p class="helper" id="termHelp" aria-live="polite"></p></div>\n    </div>')
one("const PAYS={LC:'<b>LC</b> — اعتماد مستندي عبر البنك.',TT:'<b>TT</b> — تحويل بنكي مباشر.'};", "const PAYS={LC:'<b>LC</b> — اعتماد مستندي يغطي القيمة كاملة قبل الشحن.',TT:'<b>TT</b> — تحويل بنكي للقيمة كاملة قبل الشحن.'};")
# Automatic tonnage beside the container count for goods sold by weight (tons per container
# comes from the catalog).
one("fields:(Array.isArray(r.fields)?r.fields:[]).map(f=>({ic:str(f&&f.ic)||'dot',l:str(f&&f.l),v:str(f&&f.v),g:", "tpc:Number(r.tpc)>0?Number(r.tpc):0,fields:(Array.isArray(r.fields)?r.fields:[]).map(f=>({ic:str(f&&f.ic)||'dot',l:str(f&&f.l),v:str(f&&f.v),g:")
one('<span>حاوية</span></div>', '<span id="qtyU">حاوية</span><span class="qtons" id="qtyT" aria-live="polite"></span></div>')
one("  $('#tier').textContent=`${l[0]} · ${l[1]} · ${l[3]===null?'501 فأكثر':l[2]+'–'+l[3]} حاوية`;", "  $('#tier').textContent=`${l[0]} · ${l[1]} · ${l[3]===null?'501 فأكثر':l[2]+'–'+l[3]} ${S.mode==='land'?'شاحنة':'حاوية'}`;\n  const tpc=S.mode==='land'?TRUCK_T:Number(qty.dataset.tpc)||0;$('#qtyT').textContent=tpc?`${+(n*tpc).toFixed(1)} طن`:'';")
one('<div class="presets" id="presets" role="group" aria-label="كميات شائعة"></div>', '<p class="qhint" id="qtyHint" aria-live="polite"></p><div class="presets" id="presets" role="group" aria-label="كميات شائعة"></div>')
one("qty:n,incoterm:S.incoterm,", "qty:n,mode:S.mode==='land'?'land':'sea',incoterm:S.incoterm,")
one("L.push(`الكمية: ${x.qty} حاوية`,", "L.push(`الكمية: ${x.qty} ${x.mode==='land'?'شاحنة (≈ 62.5 طن للشاحنة)':'حاوية'}`,`الشحن: ${x.mode==='land'?'بري':'بحري'}`,")
one("${esc(x.qty)} حاوية · ${esc(x.incoterm)}", "${esc(x.qty)} ${x.mode==='land'?'شاحنة':'حاوية'} · ${esc(x.incoterm)}")
# Land shipping, worked out from the destination like the tonnage: countries reached overland
# from Egypt get a third delivery choice "بر · DAP" (trucks to the border or the buyer's city),
# and it is chosen for them when they have no sea port.
one('<button type="button" role="radio" aria-checked="false" data-v="FOB">FOB</button></div></div>', '<button type="button" role="radio" aria-checked="false" data-v="FOB" class="seaopt">FOB</button><button type="button" role="radio" aria-checked="false" data-v="DAP" class="landopt" hidden>تسليم الحدود · DAP</button><button type="button" role="radio" aria-checked="false" data-v="FCA" class="landopt" hidden>تسليم المطحن · FCA</button></div></div>')
one('<button type="button" role="radio" aria-checked="true" data-v="CIF">CIF</button>', '<button type="button" role="radio" aria-checked="true" data-v="CIF" class="seaopt">CIF</button>')
one("function setDest(c,p,keepText){\n  dest.value=c||'';port.value=p||'';\n  if(!keepText)dQ.value=destLabel();\n  dSync();\n}", """Object.assign(FLAG_ISO,{'الكويت':'KW','قطر':'QA','البحرين':'BH','عُمان':'OM','الأردن':'JO','العراق':'IQ','سوريا':'SY','لبنان':'LB','فلسطين':'PS','تركيا':'TR','ليبيا':'LY','تونس':'TN','الجزائر':'DZ','المغرب':'MA','موريتانيا':'MR','إريتريا':'ER','الصومال':'SO','إثيوبيا':'ET','جنوب السودان':'SS','أوغندا':'UG','رواندا':'RW','بوروندي':'BI','جزر القمر':'KM','سيشل':'SC','مدغشقر':'MG','موريشيوس':'MU','السنغال':'SN','غامبيا':'GM','غينيا بيساو':'GW','غينيا':'GN','سيراليون':'SL','ليبيريا':'LR','ساحل العاج':'CI','توغو':'TG','بنين':'BJ','الرأس الأخضر':'CV','مالي':'ML','بوركينا فاسو':'BF','النيجر':'NE','الكاميرون':'CM','أفريقيا الوسطى':'CF','الغابون':'GA','غينيا الاستوائية':'GQ','الكونغو':'CG','الكونغو الديمقراطية':'CD','ساو تومي وبرينسيب':'ST','أنغولا':'AO','جنوب أفريقيا':'ZA','ناميبيا':'NA','موزمبيق':'MZ','زامبيا':'ZM','زيمبابوي':'ZW','ملاوي':'MW','بوتسوانا':'BW','ليسوتو':'LS','إسواتيني':'SZ'});
// Countries a mill in Egypt reaches by truck, with the route used (same routes as the market pages).
const LAND={'السودان':'أرقين أو أشكيت أو أوسيف','ليبيا':'منفذ السلوم','تونس':'ليبيا ومعبر رأس جدير','الأردن':'عبّارة الشاحنات نويبع–العقبة','السعودية':'عبّارة الشاحنات سفاجا–ضبا','الكويت':'السعودية ومنفذ النويصيب','قطر':'السعودية ومنفذ سلوى–أبو سمرة','البحرين':'السعودية وجسر الملك فهد','الإمارات':'السعودية ومنفذ البطحاء–الغويفات','عُمان':'السعودية أو الإمارات','العراق':'الأردن ومنفذ الكرامة–طريبيل','سوريا':'الأردن ومنفذ جابر–نصيب','لبنان':'الأردن وسوريا','اليمن':'السعودية ومنفذ الوديعة'},TRUCK_T=62.5;
// Suggest the buyer's own country, guessed on the phone with no outside service: first from the
// phone's time zone (set by the network, so it follows where the phone is), then from the region
// of the phone's language (ar-SD). Egypt's language code is a common default, so it is not used.
// Only a suggestion: it never fills the field by itself.
const TZ_C={'Africa/Cairo':'مصر','Africa/Khartoum':'السودان','Africa/Tripoli':'ليبيا','Africa/Tunis':'تونس','Africa/Algiers':'الجزائر','Africa/Casablanca':'المغرب','Africa/El_Aaiun':'المغرب','Africa/Nouakchott':'موريتانيا','Asia/Riyadh':'السعودية','Asia/Dubai':'الإمارات','Asia/Kuwait':'الكويت','Asia/Qatar':'قطر','Asia/Bahrain':'البحرين','Asia/Muscat':'عُمان','Asia/Aden':'اليمن','Asia/Amman':'الأردن','Asia/Baghdad':'العراق','Asia/Damascus':'سوريا','Asia/Beirut':'لبنان','Asia/Gaza':'فلسطين','Asia/Hebron':'فلسطين','Europe/Istanbul':'تركيا','Asia/Istanbul':'تركيا','Africa/Asmara':'إريتريا','Africa/Asmera':'إريتريا','Africa/Djibouti':'جيبوتي','Africa/Mogadishu':'الصومال','Africa/Addis_Ababa':'إثيوبيا','Africa/Nairobi':'كينيا','Africa/Dar_es_Salaam':'تنزانيا','Africa/Kampala':'أوغندا','Africa/Kigali':'رواندا','Africa/Bujumbura':'بوروندي','Africa/Juba':'جنوب السودان','Indian/Comoro':'جزر القمر','Indian/Mahe':'سيشل','Indian/Antananarivo':'مدغشقر','Indian/Mauritius':'موريشيوس','Africa/Dakar':'السنغال','Africa/Banjul':'غامبيا','Africa/Bissau':'غينيا بيساو','Africa/Conakry':'غينيا','Africa/Freetown':'سيراليون','Africa/Monrovia':'ليبيريا','Africa/Abidjan':'ساحل العاج','Africa/Accra':'غانا','Africa/Lome':'توغو','Africa/Porto-Novo':'بنين','Africa/Lagos':'نيجيريا','Atlantic/Cape_Verde':'الرأس الأخضر','Africa/Bamako':'مالي','Africa/Timbuktu':'مالي','Africa/Ouagadougou':'بوركينا فاسو','Africa/Niamey':'النيجر','Africa/Ndjamena':'تشاد','Africa/Douala':'الكاميرون','Africa/Bangui':'أفريقيا الوسطى','Africa/Libreville':'الغابون','Africa/Malabo':'غينيا الاستوائية','Africa/Brazzaville':'الكونغو','Africa/Kinshasa':'الكونغو الديمقراطية','Africa/Lubumbashi':'الكونغو الديمقراطية','Africa/Sao_Tome':'ساو تومي وبرينسيب','Africa/Luanda':'أنغولا','Africa/Johannesburg':'جنوب أفريقيا','Africa/Windhoek':'ناميبيا','Africa/Maputo':'موزمبيق','Africa/Lusaka':'زامبيا','Africa/Harare':'زيمبابوي','Africa/Blantyre':'ملاوي','Africa/Gaborone':'بوتسوانا','Africa/Maseru':'ليسوتو','Africa/Mbabane':'إسواتيني'};
const guessC=(()=>{let c='';
  try{c=TZ_C[Intl.DateTimeFormat().resolvedOptions().timeZone]||''}catch{}
  if(!c){try{const iso=Object.fromEntries(Object.entries(FLAG_ISO).map(([k,v])=>[v,k]));
    for(const l of navigator.languages||[]){const r=(l.split('-')[1]||'').toUpperCase();if(r&&r!=='EG'&&iso[r]){c=iso[r];break}}}catch{}}
  return c})();
// Inland countries: containers by sea to a port, then trucks inland. No choice to make, only a note.
const TRANSIT={'تشاد':'بحراً إلى دوالا، ثم بالشاحنات إلى نجامينا','إثيوبيا':'بحراً إلى جيبوتي، ثم بالشاحنات إلى أديس أبابا','جنوب السودان':'بحراً إلى مومباسا، ثم بالشاحنات عبر أوغندا إلى جوبا','أوغندا':'بحراً إلى مومباسا، ثم بالشاحنات إلى كمبالا','رواندا':'بحراً إلى دار السلام أو مومباسا، ثم بالشاحنات إلى كيغالي','بوروندي':'بحراً إلى دار السلام، ثم بالشاحنات إلى بوجومبورا','أفريقيا الوسطى':'بحراً إلى دوالا، ثم بالشاحنات إلى بانغي','مالي':'بحراً إلى داكار أو أبيدجان، ثم بالشاحنات إلى باماكو','بوركينا فاسو':'بحراً إلى أبيدجان أو لومي، ثم بالشاحنات إلى واغادوغو','النيجر':'بحراً إلى كوتونو أو لومي، ثم بالشاحنات إلى نيامي','زامبيا':'بحراً إلى دار السلام أو ديربان، ثم بالشاحنات إلى لوساكا','زيمبابوي':'بحراً إلى بيرا أو ديربان، ثم بالشاحنات إلى هراري','ملاوي':'بحراً إلى ناكالا أو بيرا، ثم بالشاحنات إلى ليلونغوي','بوتسوانا':'بحراً إلى ديربان أو والفيس باي، ثم بالشاحنات إلى غابورون','ليسوتو':'بحراً إلى ديربان، ثم بالشاحنات إلى ماسيرو','إسواتيني':'بحراً إلى مابوتو أو ديربان، ثم بالشاحنات إلى مبابان','فلسطين':'بحراً إلى العقبة، ثم بالشاحنات عبر جسر الملك حسين'};
// Tapping the empty field lists every country by region, so nobody has to type to find theirs.
const REG=[['الخليج والشرق الأوسط',['السعودية','الإمارات','الكويت','قطر','البحرين','عُمان','اليمن','الأردن','العراق','سوريا','لبنان','فلسطين','تركيا']],['شمال أفريقيا',['مصر','السودان','ليبيا','تونس','الجزائر','المغرب','موريتانيا']],['شرق أفريقيا',['إثيوبيا','إريتريا','جيبوتي','الصومال','كينيا','تنزانيا','أوغندا','رواندا','بوروندي','جنوب السودان','جزر القمر','سيشل','مدغشقر','موريشيوس']],['غرب أفريقيا',['نيجيريا','غانا','ساحل العاج','السنغال','غينيا','غينيا بيساو','غامبيا','سيراليون','ليبيريا','توغو','بنين','مالي','بوركينا فاسو','النيجر','الرأس الأخضر']],['وسط أفريقيا',['تشاد','الكاميرون','أفريقيا الوسطى','الغابون','غينيا الاستوائية','الكونغو','الكونغو الديمقراطية','ساو تومي وبرينسيب','أنغولا']],['جنوب أفريقيا',['جنوب أفريقيا','ناميبيا','موزمبيق','زامبيا','زيمبابوي','ملاوي','بوتسوانا','ليسوتو','إسواتيني']]];
function dBrowse(){
  const out=[];let last=null;try{last=JSON.parse(localStorage.getItem(LAST_KEY))}catch{}
  if(last&&last.c)out.push({h:'آخر وجهة استخدمتها'},{c:last.c,p:last.p||''});
  if(guessC&&!(last&&last.c===guessC))out.push({c:guessC,p:'',b:1});
  REG.forEach(([h,cs])=>{out.push({h});cs.forEach(c=>out.push({c,p:'',b:1}))});
  return out;
}
const dTag=c=>Object.prototype.hasOwnProperty.call(LAND,c)?'بحراً أو براً':Object.prototype.hasOwnProperty.call(TRANSIT,c)?'بحراً ثم براً':'';
// A country picked from the full list: with one port it is chosen at once; with several ports (or a
// land route) its ports open, starting with "any port".
const dPick0=dPick;
dPick=function(o){
  if(o&&o.b){const ports=DEST.filter(d=>d[1]===o.c);
    if(ports.length>1||Object.prototype.hasOwnProperty.call(LAND,o.c)){dQ.value=o.c;dAct=-1;dSync();dQ.focus();dOpen();dL.scrollTop=0;return}
    return dPick0({c:o.c,p:ports.length===1?ports[0][0]:''})}
  return dPick0(o);
};
function landUpdate(){
  const c=(dest.value||'').trim(),via=Object.prototype.hasOwnProperty.call(LAND,c)?LAND[c]:'';
  const tr=!via&&Object.prototype.hasOwnProperty.call(TRANSIT,c);
  $('#modeRow').hidden=!via&&!tr;$('#modeL').hidden=$('#modeRow .seg').hidden=!via;
  if(!via&&S.mode!=='sea')setSeg('mode','sea');
  $('#landNote').textContent=via?'يمكن الشحن بحراً، أو براً بالشاحنات عبر '+via+'.':Object.prototype.hasOwnProperty.call(TRANSIT,c)?'الشحن '+TRANSIT[c]+'.':'';
}
function modeApply(){
  const land=S.mode==='land';
  $$('#rfq .seaopt').forEach(b=>b.hidden=land);$$('#rfq .landopt').forEach(b=>b.hidden=!land);
  if(land&&!['DAP','FCA'].includes(S.incoterm))setSeg('incoterm','DAP');
  if(!land&&['DAP','FCA'].includes(S.incoterm))setSeg('incoterm','CIF');
  $('#qtyU').textContent=land?'شاحنة':'حاوية';qty.setAttribute('aria-label',land?'عدد الشاحنات':'عدد الحاويات');
  $('#qtyHint').textContent=land?'الشاحنة ≈ '+TRUCK_T+' طن':'';
  tierUpdate();
}
function setDest(c,p,keepText){
  dest.value=c||'';port.value=p||'';
  if(!keepText)dQ.value=destLabel();
  dSync();landUpdate();
}""")
one('<p class="err" id="destErr" role="alert"></p>', '<p class="err" id="destErr" role="alert"></p><div class="moderow" id="modeRow" hidden><span class="label" id="modeL">طريقة الشحن</span><div class="seg" role="radiogroup" aria-labelledby="modeL" data-key="mode"><button type="button" role="radio" aria-checked="true" data-v="sea">بحراً · حاويات</button><button type="button" role="radio" aria-checked="false" data-v="land">براً · شاحنات</button></div><p class="landnote" id="landNote" aria-live="polite"></p></div>')
one("const TERMS={CIF:'<b>CIF</b> — السعر يشمل الشحن والتأمين حتى ميناء الوصول.',", "const TERMS={DAP:'<b>DAP</b> — نسلّم بالشاحنات عند المنفذ الحدودي، والتخليص في بلد الوصول على المشتري.',FCA:'<b>FCA</b> — تستلم البضاعة محمّلة على شاحنتك من المطحن في مصر.',CIF:'<b>CIF</b> — السعر يشمل الشحن والتأمين حتى ميناء الوصول.',")
# By land each container travels on one truck, so the counter also shows the trucks.
one('function setSeg(key,v){S[key]=v;$$(`.seg[data-key="${key}"] button`).forEach(b=>b.setAttribute(\'aria-checked\',String(b.dataset.v===v)));rfqSum()}', 'function setSeg(key,v){S[key]=v;$$(`.seg[data-key="${key}"] button`).forEach(b=>b.setAttribute(\'aria-checked\',String(b.dataset.v===v)));rfqSum();if(key===\'mode\')modeApply();else if(key===\'incoterm\')tierUpdate()}')
# Destination comes first: it decides sea or land, and so the unit of the quantity.
_q0 = s.index('<div class="rlabel"><i>1</i>كم تحتاج؟</div>'); _d0 = s.index('<div class="rlabel"><i>2</i>إلى أين؟</div>'); _t0 = s.index('<div class="rlabel"><i>3</i>')
assert _q0 < _d0 < _t0
s = s[:_q0] + s[_d0:_t0].replace('<i>2</i>إلى أين؟', '<i>1</i>إلى أين؟') + s[_q0:_d0].replace('<i>1</i>كم تحتاج؟', '<i>2</i>كم تحتاج؟') + s[_t0:]
one("['نجامينا — نقطة تسليم داخلية','تشاد'", "['نجامينا — عبر دوالا','تشاد'")
one("'عدن','نجامينا — نقطة تسليم داخلية'];", "'عدن','نجامينا — عبر دوالا'];")
# A country with no port picked: the first row under each country lets the buyer leave the port to us.
one(":`<span>${dHl(o.c,q)}</span><small>كل الموانئ</small>`}</button>`;", ":o.b?`<span>${flagC(o.c)} ${esc(o.c)}</span>${dTag(o.c)?`<small>${dTag(o.c)}</small>`:''}`:o.g?'<span>أي ميناء — نقترح لك الأنسب</span>':`<span>${dHl(o.c,q)}</span><small>كل الموانئ</small>`}</button>`;")
# Destination search: English names for the first countries too, and no "use as free text" row
# when the buyer typed a country we already list.
one("  [...new Set(DEST.map(x=>x[1]))].forEach(c=>{if(toks.every(t=>norm(c).includes(t))&&!out.some(o=>o.c===c&&!o.p))out.unshift({c,p:''})});", "  const CKW={'مصر':'egypt','السعودية':'saudi arabia ksa المملكه','السودان':'sudan','الإمارات':'uae emirates','تنزانيا':'tanzania','كينيا':'kenya','اليمن':'yemen','غانا':'ghana','نيجيريا':'nigeria','جيبوتي':'djibouti','تشاد':'chad tchad','الكونغو':'congo kongo','الكونغو الديمقراطية':'congo kongo drc zaire زائير'};\n  [...new Set(DEST.map(x=>x[1]))].forEach(c=>{if(toks.every(t=>norm(c+' '+(CKW[c]||'')).includes(t))&&!out.some(o=>o.c===c&&!o.p))out.unshift({c,p:''})});")
one("  if(raw.trim().length>=2)out.push({c:raw.trim(),p:'',free:true});", "  if(raw.trim().length>=2&&!DEST.some(d=>norm(d[1])===q))out.push({c:raw.trim(),p:'',free:true});")
# Suggest the buyer's own country first (guessed from the phone's time zone).
one("    if(last&&last.c)out.push({h:'آخر وجهة استخدمتها'},{c:last.c,p:last.p||''});", "    if(last&&last.c)out.push({h:'آخر وجهة استخدمتها'},{c:last.c,p:last.p||''});\n    if(guessC&&!(last&&last.c===guessC))out.push({c:guessC,p:''});")
one("  const L=[];if(last&&last.c)L.push({c:last.c,p:last.p||'',last:1});", "  const L=[];if(last&&last.c)L.push({c:last.c,p:last.p||'',last:1});\n  if(guessC&&!L.some(o=>o.c===guessC))L.push({c:guessC,p:'',mine:1});")
one("${esc(o.p||o.c)} <small>", "${o.mine?flagC(o.c)+' ':''}${esc(o.p||o.c)} <small>")
# Every country in Africa and the Middle East in the destination search, with its main port
# (inland capitals name the port they are reached through).
one("['ميناء دوالا — عبر الكاميرون','تشاد','douala cameroon الكاميرون']];", "['ميناء دوالا — عبر الكاميرون','تشاد','douala cameroon الكاميرون'],['الشويخ','الكويت','kuwait shuwaikh'],['حمد','قطر','qatar hamad doha الدوحة'],['خليفة بن سلمان','البحرين','bahrain khalifa bin salman'],['صحار','عُمان','oman sohar عمان'],['صلالة','عُمان','salalah'],['العقبة','الأردن','jordan aqaba عمان amman'],['أم قصر','العراق','iraq umm qasr البصرة basra'],['اللاذقية','سوريا','syria latakia'],['طرطوس','سوريا','tartus'],['بيروت','لبنان','lebanon beirut'],['رام الله — عبر العقبة','فلسطين','palestine ramallah aqaba'],['مرسين','تركيا','turkey mersin'],['إسطنبول','تركيا','istanbul ambarli'],['طرابلس','ليبيا','libya tripoli'],['بنغازي','ليبيا','benghazi'],['مصراتة','ليبيا','misrata'],['رادس','تونس','tunisia rades تونس'],['الجزائر العاصمة','الجزائر','algeria algiers'],['وهران','الجزائر','oran'],['الدار البيضاء','المغرب','morocco casablanca'],['طنجة المتوسط','المغرب','tanger med'],['نواكشوط','موريتانيا','mauritania nouakchott'],['مصوع','إريتريا','eritrea massawa'],['مقديشو','الصومال','somalia mogadishu'],['بربرة','الصومال','berbera'],['أديس أبابا — عبر جيبوتي','إثيوبيا','ethiopia addis ababa djibouti'],['جوبا — عبر مومباسا','جنوب السودان','south sudan juba mombasa'],['كمبالا — عبر مومباسا','أوغندا','uganda kampala mombasa'],['كيغالي — عبر دار السلام','رواندا','rwanda kigali'],['بوجومبورا — عبر دار السلام','بوروندي','burundi bujumbura'],['موروني','جزر القمر','comoros moroni'],['فيكتوريا','سيشل','seychelles victoria'],['تاماتاف','مدغشقر','madagascar toamasina tamatave'],['بورت لويس','موريشيوس','mauritius port louis'],['داكار','السنغال','senegal dakar'],['بانجول','غامبيا','gambia banjul'],['بيساو','غينيا بيساو','guinea bissau'],['كوناكري','غينيا','guinea conakry'],['فريتاون','سيراليون','sierra leone freetown'],['مونروفيا','ليبيريا','liberia monrovia'],['أبيدجان','ساحل العاج','ivory coast cote divoire abidjan كوت ديفوار'],['لومي','توغو','togo lome'],['كوتونو','بنين','benin cotonou'],['برايا','الرأس الأخضر','cape verde praia'],['باماكو — عبر داكار أو أبيدجان','مالي','mali bamako'],['واغادوغو — عبر أبيدجان أو لومي','بوركينا فاسو','burkina faso ouagadougou'],['نيامي — عبر كوتونو أو لومي','النيجر','niger niamey'],['دوالا','الكاميرون','cameroon douala'],['كريبي','الكاميرون','kribi'],['بانغي — عبر دوالا','أفريقيا الوسطى','central african republic bangui'],['ليبرفيل — أوويندو','الغابون','gabon libreville owendo'],['مالابو','غينيا الاستوائية','equatorial guinea malabo'],['بوانت نوار','الكونغو','congo brazzaville pointe noire'],['ماتادي','الكونغو الديمقراطية','dr congo drc kinshasa matadi'],['ساو تومي','ساو تومي وبرينسيب','sao tome'],['لواندا','أنغولا','angola luanda'],['ديربان','جنوب أفريقيا','south africa durban'],['كيب تاون','جنوب أفريقيا','cape town'],['والفيس باي','ناميبيا','namibia walvis bay'],['مابوتو','موزمبيق','mozambique maputo'],['بيرا','موزمبيق','beira'],['لوساكا — عبر دار السلام أو ديربان','زامبيا','zambia lusaka'],['هراري — عبر بيرا أو ديربان','زيمبابوي','zimbabwe harare'],['ليلونغوي — عبر ناكالا أو بيرا','ملاوي','malawi lilongwe'],['غابورون — عبر ديربان أو والفيس باي','بوتسوانا','botswana gaborone'],['ماسيرو — عبر ديربان','ليسوتو','lesotho maseru'],['مبابان — عبر مابوتو أو ديربان','إسواتيني','eswatini swaziland mbabane']];")
# Delivery and payment are two separate steps (3 التسليم, 4 الدفع), each with its own explanation.
one('    <div class="rlabel"><i>3</i>التسليم والدفع</div>\n    <div class="terms" id="termsD"><b id="termSum" hidden>CIF · LC</b>\n      <div class="tpanel"><div class="grid2">\n        <div class="field"><span class="label" id="incoL">التسليم</span><div class="seg" role="radiogroup" aria-labelledby="incoL" data-key="incoterm"><button type="button" role="radio" aria-checked="true" data-v="CIF" class="seaopt">CIF</button><button type="button" role="radio" aria-checked="false" data-v="FOB" class="seaopt">FOB</button><button type="button" role="radio" aria-checked="false" data-v="DAP" class="landopt" hidden>تسليم الحدود · DAP</button><button type="button" role="radio" aria-checked="false" data-v="FCA" class="landopt" hidden>تسليم المطحن · FCA</button></div></div>\n        <div class="field"><span class="label" id="payL">الدفع</span><div class="seg" role="radiogroup" aria-labelledby="payL" data-key="payment"><button type="button" role="radio" aria-checked="true" data-v="LC — اعتماد مستندي">اعتماد مستندي</button><button type="button" role="radio" aria-checked="false" data-v="TT — تحويل بنكي">تحويل مقدم</button></div></div>\n      </div>\n      <p class="helper" id="termHelp" aria-live="polite"></p></div>\n    </div>\n\n', '    <div class="rlabel"><i>3</i><span id="incoL">التسليم</span></div>\n    <div class="terms" id="termsD"><b id="termSum" hidden>CIF · LC</b>\n      <div class="tpanel"><div class="seg" role="radiogroup" aria-labelledby="incoL" data-key="incoterm"><button type="button" role="radio" aria-checked="true" data-v="CIF" class="seaopt">CIF</button><button type="button" role="radio" aria-checked="false" data-v="FOB" class="seaopt">FOB</button><button type="button" role="radio" aria-checked="false" data-v="DAP" class="landopt" hidden>تسليم الحدود · DAP</button><button type="button" role="radio" aria-checked="false" data-v="FCA" class="landopt" hidden>تسليم المطحن · FCA</button></div>\n      <p class="helper" id="termHelp" aria-live="polite"></p></div>\n    </div>\n\n    <div class="rlabel"><i>4</i><span id="payL">الدفع</span></div>\n    <div class="terms" id="payD">\n      <div class="tpanel"><div class="seg" role="radiogroup" aria-labelledby="payL" data-key="payment"><button type="button" role="radio" aria-checked="true" data-v="LC — اعتماد مستندي">اعتماد مستندي</button><button type="button" role="radio" aria-checked="false" data-v="TT — تحويل بنكي">تحويل مقدم</button></div>\n      <p class="helper" id="payHelp" aria-live="polite"></p></div>\n    </div>\n\n')
one('  $(\'#termHelp\').innerHTML=`<span style="display:block">${TERMS[S.incoterm]||\'\'}</span><span style="display:block">${PAYS[(S.payment||\'\').split(\' \')[0]]||\'\'}</span>`;', "  $('#termHelp').innerHTML=TERMS[S.incoterm]||'';$('#payHelp').innerHTML=PAYS[(S.payment||'').split(' ')[0]]||'';")
one('.rfq .terms .helper{', '.sheet.rfq .terms .seg[data-key=payment]{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:1fr}\n.rfq .terms .helper{')
# Levels bar: the current level and its range, a progress track of the seven levels, and a tap
# that tells the buyer how many more containers reach the next level.
one('$(\'#levels\').innerHTML=LEVELS.map((l,i)=>`<button type="button" data-act="level" data-i="${i}" aria-pressed="false" aria-label="${l[0]} ${l[1]}"><strong>${l[0]}</strong><span>${l[1]}</span></button>`).join(\'\');', 'const lvU=(n,land)=>land?(n===1?\'شاحنة واحدة\':n===2?\'شاحنتين\':n<=10?n+\' شاحنات\':n+\' شاحنة\'):(n===1?\'حاوية واحدة\':n===2?\'حاويتين\':n<=10?n+\' حاويات\':n+\' حاوية\');\n$(\'#levels\').classList.add(\'lvtrack\');\n$(\'#levels\').innerHTML=LEVELS.map((l,i)=>`<button type="button" data-lv="${i}" aria-pressed="false" aria-label="${l[0]} ${l[1]}"><i></i><b>${l[0]}</b></button>`).join(\'\');\n// Tapping a level (or the hint under the bar) sets the quantity to that level\'s minimum.\n$(\'#rfq\').addEventListener(\'click\',e=>{const t=e.target.closest(\'[data-lv]\');if(!t)return;qty.value=LEVELS[Number(t.dataset.lv)][2];qty.dispatchEvent(new Event(\'input\',{bubbles:true}))});')
one("  $('#tier').textContent=`${l[0]} · ${l[1]} · ${l[3]===null?'501 فأكثر':l[2]+'–'+l[3]} ${S.mode==='land'?'شاحنة':'حاوية'}`;", '  const land=S.mode===\'land\',uw=land?\'شاحنة\':\'حاوية\';\n  $(\'#tier\').innerHTML=`<span class="lvname">${l[0]} · ${l[1]}</span><span class="lvrange">${l[3]===null?l[2]+\' \'+uw+\' فأكثر\':l[2]+\'–\'+l[3]+\' \'+uw}</span>`;')
one("  $$('#levels button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));", '  $$(\'#levels button\').forEach((b,j)=>{b.setAttribute(\'aria-pressed\',String(j===i));b.classList.toggle(\'done\',j<i);b.classList.toggle(\'cur\',j===i)});\n  const nx=LEVELS[i+1];$(\'#lvNext\').innerHTML=nx?`<button type="button" data-lv="${i+1}">أضف ${lvU(nx[2]-n,land)} لتصل إلى <b>${nx[0]} · ${nx[1]}</b></button>`:\'<span>أعلى مستوى طلب</span>\';')
one('aria-label="مستويات الطلب السبعة"></div></details></div>', 'aria-label="مستويات الطلب السبعة"></div></details><p class="lvnext" id="lvNext" aria-live="polite"></p></div>')
# The service worker file lives in /new-app/ and cannot control the root.
s, n = re.subn(r"if\('serviceWorker' in navigator&&!PREVIEW[^\n]*register\('sw\.js'\)\.catch\(\(\)=>\{\}\)\);?", "/* service worker stays with /new-app/ */", s)
assert n == 1, n
# Expose the helpers the bridge needs, then load it before the page script.
i = s.rindex('})();\n</script>')
s = s[:i] + 'window.SeptlionPage={open,closeSheets,toast,sendWA,REQ_KEY,renderOrders};\n' + s[i:]
one('<script type="application/json" id="seed-data">', '<script src="septlion-bridge.js"></script>\n<script type="application/json" id="seed-data">')
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s.encode()))
