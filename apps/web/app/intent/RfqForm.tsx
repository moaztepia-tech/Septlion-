'use client';

import {FormEvent,useState} from 'react';

const ENDPOINT='https://jfbmxowdmfdzyoauqgwn.supabase.co/functions/v1/submit-demand-rfq';

export type Lang='en'|'ar';
type Props={intentSlug:string;product:string;market?:string|null;shownProduct?:string;shownMarket?:string|null;lang?:Lang};

type FormState={
 companyName:string;contactName:string;email:string;phone:string;country:string;city:string;
 destinationPort:string;quantity:string;packing:string;incoterm:string;deliveryWindow:string;notes:string;website:string;
};

const initial:FormState={
 companyName:'',contactName:'',email:'',phone:'',country:'',city:'',destinationPort:'',
 quantity:'',packing:'50kg PP',incoterm:'CIF',deliveryWindow:'',notes:'',website:''
};

// Buyers reach these pages from international B2B marketplaces, so the English page speaks
// English end to end; the Arabic pages for Arab markets (?lang=ar) keep the Arabic form.
const T={
 en:{
  received:'RFQ RECEIVED',thanks:'Your request has been received.',ref:'Reference:',next:'The Septlion team will review it and reply with one clear supply offer.',
  head:'LIVE RFQ',title:'Turn your requirement into a supply request.',route:'Current route: ',
  company:'Company *',contact:'Contact person *',email:'Email',phone:'WhatsApp / phone',country:'Destination country *',city:'City',port:'Destination port',
  qty:'Quantity *',packing:'Packing',incoterm:'Incoterm',window:'Delivery window',notes:'Specification / notes',
  phCompany:'Company name',phContact:'Full name',phEmail:'name@company.com',phPhone:'+971 50 123 4567',phCountry:'e.g. United Arab Emirates',phCity:'City',phPort:'e.g. Jebel Ali',
  phQty:'e.g. 1 × 20ft FCL / 500 MT',phWindow:'e.g. within 30 days',phNotes:'Protein, ash, moisture, fortification, private label, payment terms…',
  reach:'Add an email or a WhatsApp number so we can send you the offer.',busy:'Sending RFQ…',send:'Send RFQ to Septlion ↗',
  note:'Sending this form creates an RFQ in the Septlion pipeline. It is not a final acceptance or a price commitment.',fail:'Could not send the request. Please try again.',
  tbd:'To be discussed',
 },
 ar:{
  received:'تم استلام الطلب',thanks:'تم استلام طلبك.',ref:'مرجع الطلب:',next:'سيراجعه فريق سبتليون ويرد عليك بعرض توريد واحد واضح.',
  head:'طلب عرض سعر',title:'حوّل احتياجك إلى طلب توريد.',route:'المسار الحالي: ',
  company:'الشركة *',contact:'اسم المسؤول *',email:'البريد',phone:'واتساب / الهاتف',country:'دولة الوصول *',city:'المدينة',port:'ميناء الوصول',
  qty:'الكمية *',packing:'التعبئة',incoterm:'شرط التسليم',window:'موعد التسليم',notes:'المواصفة / ملاحظات',
  phCompany:'اسم الشركة',phContact:'الاسم الكامل',phEmail:'name@company.com',phPhone:'+966 50 123 4567',phCountry:'مثال: السعودية',phCity:'المدينة',phPort:'مثال: جدة',
  phQty:'مثال: حاوية 20 قدم / 500 طن',phWindow:'مثال: خلال 30 يومًا',phNotes:'البروتين، الرماد، الرطوبة، التدعيم، علامة خاصة، شروط الدفع…',
  reach:'أضف بريدًا أو رقم واتساب لنرسل لك العرض.',busy:'جارٍ الإرسال…',send:'إرسال الطلب إلى سبتليون ↖',
  note:'إرسال النموذج ينشئ طلبًا لدى سبتليون، ولا يعني قبولًا نهائيًا أو التزامًا بالسعر.',fail:'تعذر إرسال الطلب. حاول مرة أخرى.',
  tbd:'للنقاش',
 },
} as const;

export default function RfqForm({intentSlug,product,market,shownProduct,shownMarket,lang='en'}:Props){
 const t=T[lang];
 const [form,setForm]=useState<FormState>(initial);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [reference,setReference]=useState('');
 const dir=lang==='ar'?'rtl':'ltr';

 function set<K extends keyof FormState>(key:K,value:FormState[K]){setForm(v=>({...v,[key]:value}))}

 async function submit(e:FormEvent){
  e.preventDefault();setError('');
  if(!form.email.trim()&&!form.phone.trim()){setError(t.reach);return}
  setBusy(true);
  try{
   const r=await fetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...form,intentSlug,product,productKey:'wheat_flour'})
   });
   const data=await r.json().catch(()=>({}));
   if(!r.ok){
    const msg=String(data?.error||'');
    // The server answers in English; keep it for English buyers, use our own text for Arabic.
    throw new Error(lang==='en'&&msg?msg:t.fail);
   }
   setReference(data?.reference||'RECEIVED');
  }catch(e){setError(e instanceof Error?e.message:t.fail)}
  finally{setBusy(false)}
 }

 if(reference)return <div className="ir-success" dir={dir}>
  <small>{t.received}</small>
  <h3>{t.thanks}</h3>
  <p>{t.ref} <b dir="ltr">{reference}</b></p>
  <p>{t.next}</p>
 </div>;

 return <form className="ir-form" onSubmit={submit} dir={dir} lang={lang}>
  <div className="ir-form-head">
   <div><small>{t.head}</small><h3>{t.title}</h3></div>
   <p>{t.route+(shownProduct||product)+((shownMarket??market)?' · '+(shownMarket??market):'')}</p>
  </div>

  <input className="ir-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>set('website',e.target.value)} aria-hidden="true"/>

  <div className="ir-grid">
   <label><span>{t.company}</span><input required maxLength={160} value={form.companyName} onChange={e=>set('companyName',e.target.value)} placeholder={t.phCompany} autoComplete="organization"/></label>
   <label><span>{t.contact}</span><input required maxLength={160} value={form.contactName} onChange={e=>set('contactName',e.target.value)} placeholder={t.phContact} autoComplete="name"/></label>
   <label><span>{t.email}</span><input type="email" dir="ltr" maxLength={200} value={form.email} onChange={e=>set('email',e.target.value)} placeholder={t.phEmail} autoComplete="email"/></label>
   <label><span>{t.phone}</span><input type="tel" dir="ltr" maxLength={80} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder={t.phPhone} autoComplete="tel"/></label>
   <label><span>{t.country}</span><input required maxLength={120} value={form.country} onChange={e=>set('country',e.target.value)} placeholder={t.phCountry} autoComplete="country-name"/></label>
   <label><span>{t.city}</span><input maxLength={120} value={form.city} onChange={e=>set('city',e.target.value)} placeholder={t.phCity}/></label>
   <label><span>{t.port}</span><input maxLength={160} value={form.destinationPort} onChange={e=>set('destinationPort',e.target.value)} placeholder={t.phPort}/></label>
   <label><span>{t.qty}</span><input required maxLength={120} value={form.quantity} onChange={e=>set('quantity',e.target.value)} placeholder={t.phQty}/></label>
   <label><span>{t.packing}</span><select value={form.packing} onChange={e=>set('packing',e.target.value)}><option>1kg</option><option>10kg</option><option>25kg PP</option><option>50kg PP</option><option>Bulk</option><option>Custom</option></select></label>
   <label><span>{t.incoterm}</span><select value={form.incoterm} onChange={e=>set('incoterm',e.target.value)}><option>EXW</option><option>FOB</option><option>CFR</option><option>CIF</option><option>DDP</option><option value="To be discussed">{t.tbd}</option></select></label>
   <label className="ir-wide"><span>{t.window}</span><input maxLength={160} value={form.deliveryWindow} onChange={e=>set('deliveryWindow',e.target.value)} placeholder={t.phWindow}/></label>
   <label className="ir-wide"><span>{t.notes}</span><textarea maxLength={2000} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder={t.phNotes}/></label>
  </div>

  {error&&<div className="ir-error" role="alert">{error}</div>}
  <button className="ir-submit" disabled={busy}>{busy?t.busy:t.send}</button>
  <p className="ir-note">{t.note}</p>
 </form>
}
