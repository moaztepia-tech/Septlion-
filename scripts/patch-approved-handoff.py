#!/usr/bin/env python3
"""Fail-closed patch: retain exact approved SEPTLION homepage; replace only demo submit actions with authenticated Composer handoff."""
from pathlib import Path
import hashlib
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-approved-handoff.py original-index.html output-index.html")
original=Path(sys.argv[1]).read_bytes()
approved_hash="7cae91d2f051aa0656fce02ef0cfea44423b1099235761418a67c72ceec39bc9"
if hashlib.sha256(original).hexdigest()!=approved_hash:
    raise SystemExit("SAFETY STOP: approved homepage changed. Refuse to patch.")
source=original.decode("utf-8")

def replace_region(start,end,replacement,signature):
    global source
    if source.count(start)!=1 or source.count(end)!=1:
        raise SystemExit("SAFETY STOP: "+signature+" is not unique.")
    a=source.index(start)
    b=source.index(end,a)
    old=source[a:b]
    if "store.set(REQ_KEY,list)" not in old:
        raise SystemExit("SAFETY STOP: "+signature+" no longer uses the known preview storage.")
    source=source[:a]+replacement.rstrip()+"\n\n"+source[b:]

replace_region("function submitRfq(){","/* ============ طلباتي والمتابعة ============ */",
r"""function submitRfq(){
  const n=Number(qty.value),p=S.selected;
  if(!dest.value){dest.setAttribute('aria-invalid','true');$('#destErr').textContent='يرجى اختيار دولة الوجهة.';dest.focus();return}
  if(!Number.isSafeInteger(n)||n<1){qty.focus();toast('يرجى تحديد عدد صحيح من الحاويات.');return}
  if(!p){toast('يرجى اختيار المنتج أولًا.');return}
  const payment=/LC|L\/C|اعتماد/i.test(S.payment||'')?'L/C':/T\/T|تحويل/i.test(S.payment||'')?'T/T':'OTHER';
  const context={
    product:String(p.name||'').trim(),
    packing:String(p.size||'').trim(),
    quantity:n+' FCL',
    destination:String(port.value||dest.value).trim(),
    incoterm:['CIF','CFR','FOB'].includes(S.incoterm)?S.incoterm:'',
    payment
  };
  try{
    sessionStorage.setItem('septlion_requirement_context',JSON.stringify(context));
    sessionStorage.setItem('septlion_requirement_seed',context.product+' '+context.quantity+' إلى '+context.destination+' '+context.packing);
    sessionStorage.removeItem('septlion_feed_context');
    window.location.assign('/require/');
  }catch{
    toast('تعذر فتح طلب التوريد. يرجى السماح بحفظ المسودة في المتصفح وإعادة المحاولة.');
  }
}
""","product RFQ")

replace_region("$('#needForm').addEventListener('submit',e=>{","/* ============ تفويض الأحداث ============ */",
r"""$('#needForm').addEventListener('submit',e=>{
  e.preventDefault();
  const ph=$('#fPhone'),err=$('#fPhoneErr'),v=Intake.digits(ph.value).trim();
  if(!/^\+?[0-9\s()\-]{7,20}$/.test(v)){err.textContent='أدخل رقم واتساب صحيحًا مع رمز الدولة.';ph.setAttribute('aria-invalid','true');ph.focus();return}
  err.textContent='';ph.removeAttribute('aria-invalid');ph.value=v;captureNeedDetails();
  const d=Intake.details(needDraft),fields=needDraft.fields||{};
  const context={
    product:String(fields.product||'').trim(),
    quantity:String(d.quantity||fields.quantity||'').trim(),
    destination:String(d.destination||fields.destination||'').trim(),
    packing:String(fields.packaging||fields.packing||'').trim(),
    incoterm:String(fields.incoterm||'').trim(),
    payment:String(fields.payment||'').trim()
  };
  const description=(Array.isArray(needDraft.messages)?needDraft.messages.join('\n'):'').trim()||Intake.summary(needDraft);
  try{
    sessionStorage.setItem('septlion_requirement_context',JSON.stringify(context));
    sessionStorage.setItem('septlion_requirement_seed',description);
    const saved=JSON.parse(sessionStorage.getItem('septlion_buyer_contact')||'{}');
    sessionStorage.setItem('septlion_buyer_contact',JSON.stringify({
      name:typeof saved.name==='string'?saved.name:'',
      company:typeof saved.company==='string'?saved.company:'',
      email:typeof saved.email==='string'?saved.email:'',
      phone:v
    }));
    sessionStorage.removeItem('septlion_feed_context');
    window.location.assign('/require/');
  }catch{
    err.textContent='تعذر حفظ مسودة الطلب. تحقّق من إعدادات تخزين المتصفح وأعد المحاولة.';
  }
});
""","freeform RFQ")

# The existing My Septlion demo must not conceal real saved requests.
old_nav="function go(id){ if(location.hash==='#'+id) show(id); else location.hash=id; }"
new_nav="function go(id){ if(id==='orders'){window.location.assign('/my-septlion/');return} if(location.hash==='#'+id) show(id); else location.hash=id; }"
if source.count(old_nav)!=1:
    raise SystemExit("SAFETY STOP: expected preview navigation not found.")
source=source.replace(old_nav,new_nav)

notices={
  "معاينة تفاعلية · لا تُرسل طلبات حقيقية":"لإرسال طلب حقيقي، أكمل المراجعة والتحقق من بياناتك.",
  "في النسخة التشغيلية سيُستخدم الرقم للتحقق والمتابعة. لا يتم إرسال رمز تحقق في هذه المعاينة.":"سيُطلب منك تأكيد رقم واتساب قبل إرسال طلب عرض السعر الحقيقي.",
  "معاينة تفاعلية — الحفظ محلي فقط.":"تنتقل إلى مراجعة الطلب والتحقق قبل الإرسال النهائي."
}
for old,new in notices.items():
    if source.count(old)!=1:
        raise SystemExit("SAFETY STOP: approved notice not unique or missing: "+old)
    source=source.replace(old,new)

if "store.set(REQ_KEY,list);" in source[source.index("function submitRfq(){"):source.index("/* ============ طلباتي والمتابعة ============ */")]:
    raise SystemExit("SAFETY STOP: demo product submission remains active.")
if "go('needDone')" in source[source.index("$('#needForm').addEventListener('submit',e=>{"):source.index("/* ============ تفويض الأحداث ============ */")]:
    raise SystemExit("SAFETY STOP: demo freeform success remains active.")
if source.count("window.location.assign('/require/')")!=2:
    raise SystemExit("SAFETY STOP: both request handoffs were not connected.")
Path(sys.argv[2]).write_bytes(source.encode("utf-8"))
print("PASS: only approved demo RFQ handlers and truthful notices patched; original layout is untouched.")
print("Original SHA256:",approved_hash)
print("Patched SHA256:",hashlib.sha256(source.encode("utf-8")).hexdigest())
