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
    "<h1>طلبك محفوظ.</h1><p>أكّد بريدك ليصل الطلب إلى فريق سبتليون، أو أرسله عبر واتساب أو البريد.</p>")
one("go('needDone'); sendWA(x);", "go('needDone'); SeptlionBridge.submit(x);")
one("إرسال الطلب عبر واتساب</button>", "إرسال الطلب</button>")
one("يصلنا الطلب عند إرساله عبر واتساب أو البريد.", "يصلنا الطلب بعد تأكيد بريدك، أو عند إرساله عبر واتساب أو البريد.")
one("'يُرسل الطلب إلى SEPTLION عبر واتساب أو البريد'", "'يصل الطلب إلى SEPTLION بعد تأكيد بريدك'")
# The service worker file lives in /new-app/ and cannot control the root.
s, n = re.subn(r"if\('serviceWorker' in navigator&&!PREVIEW[^\n]*register\('sw\.js'\)\.catch\(\(\)=>\{\}\)\);?", "/* service worker stays with /new-app/ */", s)
assert n == 1, n
# Expose the helpers the bridge needs, then load it before the page script.
i = s.rindex('})();\n</script>')
s = s[:i] + 'window.SeptlionPage={open,closeSheets,toast,sendWA,REQ_KEY,renderOrders};\n' + s[i:]
one('<script type="application/json" id="seed-data">', '<script src="septlion-bridge.js"></script>\n<script type="application/json" id="seed-data">')
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s.encode()))
