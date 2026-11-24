'use client';

// Quote request sheet for the published demand pages (/intent/demand/?slug=…).
// Same look and steps as the product quote sheet on the home page: quantity in
// containers with the seven order levels, destination, delivery and payment terms,
// notes, then contact. Every request is saved through submit-demand-rfq first,
// so it reaches the team's workbench even if WhatsApp or email is never opened.

import {useMemo,useState} from 'react';
import './quote-sheet.css';

const ENDPOINT='https://jfbmxowdmfdzyoauqgwn.supabase.co/functions/v1/submit-demand-rfq';
const CONTACT={wa:'201070088181',mail:'info@septlion.com'};

const LEVELS:[string,string,number,number|null][]=[['S-1','الأساسي',1,7],['S-2','المتقدم',8,20],['S-3','الموسّع',21,50],['S-4','التجاري',51,100],['S-5','التوريد المكثف',101,250],['S-6','التوريد المؤسسي',251,500],['S-7','الاستراتيجي',501,null]];
const QUICK=['جدة الإسلامي','بورتسودان','جبل علي'];

const MARKET_AR:Record<string,string>={
 'saudi arabia':'السعودية','united arab emirates':'الإمارات','uae':'الإمارات','oman':'عُمان','qatar':'قطر','bahrain':'البحرين','kuwait':'الكويت',
 'jordan':'الأردن','iraq':'العراق','yemen':'اليمن','lebanon':'لبنان','syria':'سوريا','egypt':'مصر','sudan':'السودان','libya':'ليبيا',
 'tunisia':'تونس','algeria':'الجزائر','morocco':'المغرب','somalia':'الصومال','djibouti':'جيبوتي','turkey':'تركيا','india':'الهند',
 'germany':'ألمانيا','united kingdom':'المملكة المتحدة','united states':'الولايات المتحدة','usa':'الولايات المتحدة','canada':'كندا',
 'malaysia':'ماليزيا','indonesia':'إندونيسيا','thailand':'تايلاند','singapore':'سنغافورة','hong kong':'هونغ كونغ','philippines':'الفلبين',
 'netherlands':'هولندا','belgium':'بلجيكا','spain':'إسبانيا','portugal':'البرتغال','italy':'إيطاليا','poland':'بولندا','ireland':'أيرلندا',
 'finland':'فنلندا','hungary':'المجر','austria':'النمسا','australia':'أستراليا','japan':'اليابان','israel':'إسرائيل',
};
const PRODUCT_AR:[RegExp,string][]=[[/whole wheat/i,'دقيق قمح كامل'],[/durum/i,'دقيق قمح قاسٍ (ديورم)'],[/bakery/i,'دقيق مخابز'],[/all[- ]purpose/i,'دقيق متعدد الاستخدامات'],[/refined/i,'دقيق قمح مكرر'],[/chakki|atta/i,'دقيق أتا (تشاكي)'],[/wheat flour/i,'دقيق قمح']];

export function marketAr(m?:string|null){
 if(!m)return '';
 const parts=m.split(',').map(s=>s.trim()).filter(Boolean);
 const last=(parts[parts.length-1]||'').toLowerCase();
 const ar=MARKET_AR[last];
 if(!ar)return m;
 return parts.length>1?parts[0]+'، '+ar:ar;
}
export function productAr(p:string){for(const [re,ar] of PRODUCT_AR)if(re.test(p))return ar;return p}

const levelOf=(n:number)=>LEVELS.find(([, ,a,b])=>n>=a&&(b===null||n<=b))||LEVELS[0];

type Props={intentSlug:string;product:string;market?:string|null};

export default function QuoteSheet({intentSlug,product,market}:Props){
 const productName=productAr(product);
 const marketName=marketAr(market);
 const [qty,setQty]=useState(1);
 const [dest,setDest]=useState(marketName);
 const [incoterm,setIncoterm]=useState<'CIF'|'FOB'>('CIF');
 const [payment,setPayment]=useState<'LC'|'TT'>('LC');
 const [notes,setNotes]=useState('');
 const [name,setName]=useState('');
 const [company,setCompany]=useState('');
 const [wa,setWa]=useState('');
 const [email,setEmail]=useState('');
 const [hp,setHp]=useState('');
 const [busy,setBusy]=useState<''|'wa'|'mail'>('');
 const [error,setError]=useState('');
 const [reference,setReference]=useState('');

 const level=levelOf(qty);
 const quick=useMemo(()=>[...new Set([marketName,...QUICK].filter(Boolean))].slice(0,4),[marketName]);
 const quantityText=qty+' '+(qty===1?'حاوية':qty===2?'حاويتان':qty<=10?'حاويات':'حاوية')+' · '+level[0]+' '+level[1];
 const paymentText=payment==='LC'?'LC — اعتماد مستندي':'TT — تحويل بنكي';

 function summary(ref:string){
  return ['طلب عرض سعر من سبتليون'+(ref?' · '+ref:''),
   'الصنف: '+productName,
   'الكمية: '+quantityText,
   'الوجهة: '+dest,
   'التسليم: '+incoterm+' · الدفع: '+paymentText,
   notes?'ملاحظات: '+notes:'',
   'الاسم: '+name+(company?' — '+company:'')].filter(Boolean).join('\n');
 }

 async function send(via:'wa'|'mail'){
  setError('');
  if(!dest.trim())return setError('اكتب الدولة أو الميناء الذي نشحن إليه.');
  if(!name.trim())return setError('اكتب اسمك.');
  if(via==='wa'&&!wa.trim())return setError('اكتب رقم واتساب مع رمز الدولة.');
  if(via==='mail'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))return setError('اكتب بريدًا إلكترونيًا صحيحًا.');
  // WhatsApp opens in a new window; open it now, inside the tap, so phones do not block it.
  const waWin=via==='wa'?window.open('about:blank','_blank'):null;
  setBusy(via);
  try{
   const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    website:hp,intentSlug,product,productKey:'wheat_flour',
    companyName:company.trim()||name.trim(),contactName:name.trim(),email:email.trim(),phone:wa.trim(),
    country:dest.trim(),destinationPort:dest.trim(),quantity:quantityText,incoterm,
    notes:['الدفع: '+paymentText,notes.trim()].filter(Boolean).join(' · '),
    channel:via==='wa'?'intent_whatsapp':'intent_email',
   })});
   const data=await r.json().catch(()=>({}));
   if(!r.ok){
    const msg=String(data?.error||'');
    throw new Error(/WhatsApp number/i.test(msg)?'اكتب رقم واتساب كاملًا مع رمز الدولة، مثل ‎+249912345678.':/Too many/i.test(msg)?'أرسلت طلبات كثيرة. حاول بعد ساعة.':'تعذر إرسال الطلب. حاول مرة أخرى.');
   }
   const ref=data?.reference||'';
   setReference(ref||'تم');
   if(via==='wa'){
    const u='https://wa.me/'+CONTACT.wa+'?text='+encodeURIComponent(summary(ref));
    if(waWin)waWin.location.href=u;else window.location.href=u;
   }
  }catch(e){
   waWin?.close();
   setError(e instanceof Error?e.message:'تعذر إرسال الطلب.');
  }finally{setBusy('')}
 }

 if(reference)return <div className="qs qs-done" dir="rtl" role="status">
  <span className="qs-ok" aria-hidden="true">✓</span>
  <h2>وصلنا طلبك</h2>
  {reference!=='تم'&&<p>رقم الطلب: <b dir="ltr">{reference}</b></p>}
  <p>سيراجعه فريق سبتليون ويرد عليك بعرض مناسب{wa?' على واتساب':email?' على بريدك':''}.</p>
  <a className="qs-btn qs-light" href="/">العودة إلى الرئيسية</a>
 </div>;

 return <form className="qs" dir="rtl" onSubmit={e=>{e.preventDefault();send(wa.trim()?'wa':'mail')}}>
  <div className="qs-head"><span className="qs-k">طلب عرض سعر · RFQ</span><h2>اطلب عرض سعر لهذا الصنف</h2></div>

  <div className="qs-pbox">
   <span className="qs-art" aria-hidden="true"><b>SEPTLION</b><i/></span>
   <div><small>SEPTLION SUPPLY</small><strong>{productName}</strong>
    <p>{marketName&&<span className="qs-chip">{marketName}</span>}<span className="qs-chip">شوال 25 / 50 كجم</span></p></div>
  </div>

  <div className="qs-row"><span className="qs-label">الكمية</span><small dir="rtl">{level[0]} · {level[1]} · {level[3]===null?level[2]+'+':level[2]+'–'+level[3]} حاوية</small></div>
  <div className="qs-qty">
   <button type="button" onClick={()=>setQty(q=>Math.max(1,q-1))} aria-label="تقليل عدد الحاويات">−</button>
   <div><input type="number" inputMode="numeric" min={1} value={qty} onChange={e=>setQty(Math.max(1,Math.min(9999,parseInt(e.target.value)||1)))} aria-label="عدد الحاويات"/><span>حاوية</span></div>
   <button type="button" onClick={()=>setQty(q=>Math.min(9999,q+1))} aria-label="زيادة عدد الحاويات">+</button>
  </div>
  <div className="qs-levels" role="group" aria-label="مستويات الطلب">
   {LEVELS.map(l=><button type="button" key={l[0]} aria-pressed={level[0]===l[0]} onClick={()=>setQty(l[2])}><strong>{l[0]}</strong><span>{l[1]}</span></button>)}
  </div>

  <div className="qs-row"><span className="qs-label">وجهة التسليم</span><small>الدولة أو الميناء</small></div>
  <label className="qs-dest">
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg>
   <span><small>إلى أين نشحن؟</small><input value={dest} onChange={e=>setDest(e.target.value)} maxLength={120} placeholder="اكتب الدولة أو الميناء…" autoComplete="off"/></span>
  </label>
  <div className="qs-quick">{quick.map(q=><button type="button" key={q} aria-pressed={dest===q} onClick={()=>setDest(q)}>{q}</button>)}</div>

  <div className="qs-row"><span className="qs-label">شروط التسليم</span><small dir="ltr">{incoterm} · {payment}</small></div>
  <div className="qs-seg" role="radiogroup" aria-label="شروط التسليم">
   {(['CIF','FOB'] as const).map(v=><button type="button" role="radio" key={v} aria-checked={incoterm===v} onClick={()=>setIncoterm(v)}>{v}</button>)}
  </div>
  <div className="qs-row"><span className="qs-label">طريقة الدفع</span></div>
  <div className="qs-seg" role="radiogroup" aria-label="طريقة الدفع">
   <button type="button" role="radio" aria-checked={payment==='LC'} onClick={()=>setPayment('LC')}><bdi>LC</bdi> · اعتماد</button>
   <button type="button" role="radio" aria-checked={payment==='TT'} onClick={()=>setPayment('TT')}><bdi>TT</bdi> · تحويل</button>
  </div>
  <textarea className="qs-input qs-notes" rows={2} maxLength={1500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="ملاحظات: موعد التسليم، مواصفات…" aria-label="ملاحظات"/>

  <div className="qs-row"><span className="qs-label">بيانات التواصل</span><small>نرد عليك بالعرض هنا</small></div>
  <div className="qs-grid">
   <input className="qs-input" value={name} onChange={e=>setName(e.target.value)} maxLength={160} placeholder="الاسم *" autoComplete="name" aria-label="الاسم"/>
   <input className="qs-input" value={company} onChange={e=>setCompany(e.target.value)} maxLength={160} placeholder="الشركة (اختياري)" autoComplete="organization" aria-label="الشركة"/>
   <input className="qs-input" value={wa} onChange={e=>setWa(e.target.value)} maxLength={40} type="tel" inputMode="tel" dir={wa?'ltr':'rtl'} placeholder="رقم واتساب مع رمز الدولة" autoComplete="tel" aria-label="رقم واتساب"/>
   <input className="qs-input" value={email} onChange={e=>setEmail(e.target.value)} maxLength={200} type="email" dir={email?'ltr':'rtl'} placeholder="البريد (اختياري)" autoComplete="email" aria-label="البريد الإلكتروني"/>
  </div>
  <input className="qs-hp" tabIndex={-1} autoComplete="off" value={hp} onChange={e=>setHp(e.target.value)} aria-hidden="true"/>

  {error&&<p className="qs-error" role="alert">{error}</p>}

  <div className="qs-foot">
   <div className="qs-actions">
    <button type="button" className="qs-btn qs-wa" disabled={!!busy} onClick={()=>send('wa')}>
     <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11 11 0 0 0 3.2 17.1L2 22l5-1.2A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-3 .7.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8.9-.3.2-.5 0a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg>
     {busy==='wa'?'جارٍ الإرسال…':'إرسال عبر واتساب'}
    </button>
    <button type="button" className="qs-btn qs-mail" disabled={!!busy} onClick={()=>send('mail')}>
     <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>
     {busy==='mail'?'جارٍ الإرسال…':'إرسال بريد'}
    </button>
   </div>
   <div className="qs-trust"><span>بدون التزام بالشراء</span><span>نرد بعرض مناسب</span></div>
  </div>
 </form>;
}
