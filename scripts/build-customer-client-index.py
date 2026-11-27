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
one("imgs:(Array.isArray(r.imgs)?r.imgs:[]).map(str).filter(Boolean)",
    "imgs:(Array.isArray(r.imgs)?r.imgs:[]).map(str).filter(Boolean).map(u=>/^(https?:|\\/|data:)/.test(u)?u:'/new-app/'+u)")
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
# The service worker file lives in /new-app/ and cannot control the root.
s, n = re.subn(r"if\('serviceWorker' in navigator&&!PREVIEW[^\n]*register\('sw\.js'\)\.catch\(\(\)=>\{\}\)\);?", "/* service worker stays with /new-app/ */", s)
assert n == 1, n
# Expose the helpers the bridge needs, then load it before the page script.
i = s.rindex('})();\n</script>')
s = s[:i] + 'window.SeptlionPage={open,closeSheets,toast,sendWA,REQ_KEY,renderOrders};\n' + s[i:]
one('<script type="application/json" id="seed-data">', '<script src="septlion-bridge.js"></script>\n<script type="application/json" id="seed-data">')
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s.encode()))
