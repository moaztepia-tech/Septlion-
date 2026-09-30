'use client';

import {FormEvent,useState} from 'react';

const ENDPOINT='https://jfbmxowdmfdzyoauqgwn.supabase.co/functions/v1/submit-demand-rfq';

type Props={intentSlug:string;product:string;market?:string|null};

type FormState={
 companyName:string;contactName:string;email:string;phone:string;country:string;city:string;
 destinationPort:string;quantity:string;packing:string;incoterm:string;deliveryWindow:string;notes:string;website:string;
};

const initial:FormState={
 companyName:'',contactName:'',email:'',phone:'',country:'',city:'',destinationPort:'',
 quantity:'',packing:'50kg PP',incoterm:'CIF',deliveryWindow:'',notes:'',website:''
};

export default function RfqForm({intentSlug,product,market}:Props){
 const [form,setForm]=useState<FormState>(initial);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [reference,setReference]=useState('');

 function set<K extends keyof FormState>(key:K,value:FormState[K]){setForm(v=>({...v,[key]:value}))}

 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await fetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...form,intentSlug,product,productKey:'wheat_flour'})
   });
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data?.error||'تعذر إرسال الطلب');
   setReference(data?.reference||'RECEIVED');
  }catch(e){setError(e instanceof Error?e.message:'تعذر إرسال الطلب')}
  finally{setBusy(false)}
 }

 if(reference)return <div className="ir-success" dir="rtl">
  <small>RFQ RECEIVED</small>
  <h3>تم استلام طلبك.</h3>
  <p>مرجع الطلب: <b dir="ltr">{reference}</b></p>
  <p>سيدخل الطلب مباشرة إلى Septlion Demand Intelligence للمراجعة والتأهيل التجاري.</p>
 </div>;

 return <form className="ir-form" onSubmit={submit} dir="rtl">
  <div className="ir-form-head">
   <div><small>LIVE RFQ</small><h3>حوّل احتياجك إلى طلب توريد.</h3></div>
   <p>{market?'المسار الحالي: '+product+' · '+market:'المسار الحالي: '+product}</p>
  </div>

  <input className="ir-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>set('website',e.target.value)} aria-hidden="true"/>

  <div className="ir-grid">
   <label><span>الشركة *</span><input required maxLength={160} value={form.companyName} onChange={e=>set('companyName',e.target.value)} placeholder="Company name"/></label>
   <label><span>اسم المسؤول *</span><input required maxLength={160} value={form.contactName} onChange={e=>set('contactName',e.target.value)} placeholder="Contact person"/></label>
   <label><span>البريد *</span><input required type="email" maxLength={200} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="name@company.com"/></label>
   <label><span>الهاتف / واتساب</span><input maxLength={80} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+..."/></label>
   <label><span>الدولة *</span><input required maxLength={120} value={form.country} onChange={e=>set('country',e.target.value)} placeholder="Destination country"/></label>
   <label><span>المدينة</span><input maxLength={120} value={form.city} onChange={e=>set('city',e.target.value)} placeholder="City"/></label>
   <label><span>ميناء الوصول</span><input maxLength={160} value={form.destinationPort} onChange={e=>set('destinationPort',e.target.value)} placeholder="e.g. Mombasa"/></label>
   <label><span>الكمية *</span><input required maxLength={120} value={form.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="e.g. 1 × 20ft FCL / 500 MT"/></label>
   <label><span>التعبئة</span><select value={form.packing} onChange={e=>set('packing',e.target.value)}><option>1kg</option><option>10kg</option><option>25kg PP</option><option>50kg PP</option><option>Bulk</option><option>Custom</option></select></label>
   <label><span>شرط التسليم</span><select value={form.incoterm} onChange={e=>set('incoterm',e.target.value)}><option>EXW</option><option>FOB</option><option>CFR</option><option>CIF</option><option>DDP</option><option>To be discussed</option></select></label>
   <label className="ir-wide"><span>نافذة التسليم</span><input maxLength={160} value={form.deliveryWindow} onChange={e=>set('deliveryWindow',e.target.value)} placeholder="e.g. within 30 days"/></label>
   <label className="ir-wide"><span>المواصفة / ملاحظات إضافية</span><textarea maxLength={2000} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Protein, ash, moisture, fortification, private label, payment terms..."/></label>
  </div>

  {error&&<div className="ir-error">{error}</div>}
  <button className="ir-submit" disabled={busy}>{busy?'جارٍ إرسال RFQ…':'إرسال RFQ إلى Septlion ↗'}</button>
  <p className="ir-note">إرسال النموذج ينشئ RFQ مباشرة داخل محرك الطلب، ولا يعني قبولًا نهائيًا أو التزامًا بالسعر قبل التأهيل.</p>
 </form>
}
