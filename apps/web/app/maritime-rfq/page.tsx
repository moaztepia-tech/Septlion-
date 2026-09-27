'use client';

import {FormEvent, useMemo, useRef, useState} from 'react';
import styles from './rfq.module.css';

type Level={code:string;name:string;term:string;min:number;max:number|null;description:string};
const levels:Level[]=[
 {code:'S-1',name:'Micro',term:'Spot FCL',min:1,max:7,description:'حجز فوري للشحنات المحدودة'},
 {code:'S-2',name:'Nano',term:'Scheduled FCL',min:8,max:19,description:'شحن مجدول لتجار الجملة'},
 {code:'S-3',name:'Zepto',term:'Space Allocation',min:20,max:49,description:'تخصيص منتظم للمساحة'},
 {code:'S-4',name:'Yocto',term:'Block Space',min:50,max:99,description:'حجز كتلة مساحية'},
 {code:'S-5',name:'Ronto',term:'Coastal Charter',min:100,max:299,description:'تأجير ساحلي مخصص'},
 {code:'S-6',name:'Quecto',term:'Feeder Charter',min:300,max:999,description:'تأجير سفينة تغذية'},
 {code:'S-7',name:'Septlion',term:'Full Charter & Bulk',min:1000,max:null,description:'تأجير كامل أو شحن سائب'}
];
const ports=['Alexandria, Egypt','Port Said, Egypt','Jeddah, Saudi Arabia','Dammam, Saudi Arabia','Jebel Ali, UAE','Sohar, Oman','Mombasa, Kenya','Dar es Salaam, Tanzania','Djibouti, Djibouti','Mogadishu, Somalia','Shanghai, China','Ningbo, China','Shenzhen, China','Mersin, Türkiye','Rotterdam, Netherlands'];
const baseByType:Record<string,number>={'20FT':1650,'40FT':2600,'REEFER':4300,'OPEN_TOP':3350,'FLAT_RACK':3900,'BULK':5200};

function classify(count:number,type:string){if(type==='BULK')return levels[6];return levels.find(x=>count>=x.min&&(x.max===null||count<=x.max))||levels[6]}
function estimate(count:number,type:string,pol:string,pod:string){const base=baseByType[type]||2200;const longHaul=/China|Rotterdam|Türkiye/.test(`${pol}${pod}`)?1.42:1;const volume=Math.max(.78,1-Math.min(count,300)*.0007);const freight=base*longHaul*volume;const fees=[{code:'BAF',rate:8},{code:'CAF',rate:3},{code:'PSS',rate:5}];const factor=1+fees.reduce((s,x)=>s+x.rate,0)/100;return {min:Math.round(freight*.9*factor/50)*50,max:Math.round(freight*1.18*factor/50)*50,fees}}

export default function MaritimeRfqPage(){
 const[lang,setLang]=useState<'ar'|'en'>('ar');
 const[submitted,setSubmitted]=useState(false);
 const[rfq,setRfq]=useState<{id:string;reference:string}|null>(null);const[serverPrice,setServerPrice]=useState<{min:number;max:number;validUntil:string}|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const idempotencyKey=useRef<string|null>(null);
 const[form,setForm]=useState({customerName:'',company:'',email:'',phone:'',count:'1',type:'20FT',pol:ports[0],pod:ports[2],incoterm:'FOB',shipDate:'',cargo:'GENERAL',weight:'',cbm:'',destinations:'1',payment:'TT',notes:''});
 const count=Number(form.count)||1;const level=useMemo(()=>classify(count,form.type),[count,form.type]);const price=useMemo(()=>estimate(count,form.type,form.pol,form.pod),[count,form.type,form.pol,form.pod]);
 const valid=new Date();valid.setDate(valid.getDate()+7);const validUntil=valid.toISOString().slice(0,10);
 const set=(key:string,value:string)=>setForm(v=>({...v,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const base=process.env.NEXT_PUBLIC_API_URL||'/api';idempotencyKey.current||=crypto.randomUUID();const response=await fetch(`${base}/maritime-rfq/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerName:form.customerName,company:form.company,email:form.email,phone:form.phone,containerCount:count,containerType:form.type,pol:form.pol,pod:form.pod,incoterm:form.incoterm,cargoType:form.cargo,shipDate:form.shipDate,grossWeight:form.weight?Number(form.weight):undefined,cbm:form.cbm?Number(form.cbm):undefined,finalDestinations:Number(form.destinations)||1,paymentTerm:form.payment,notes:form.notes,idempotencyKey:idempotencyKey.current})});if(!response.ok){const b=await response.json().catch(()=>({}));throw new Error(Array.isArray(b.message)?b.message.join('، '):b.message||'تعذر حفظ الطلب')}const data=await response.json();setRfq({id:data.id,reference:data.reference});setServerPrice({min:Number(data.priceMin),max:Number(data.priceMax),validUntil:String(data.validUntil).slice(0,10)});setSubmitted(true)}catch{const localRef=`RFQ-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;setRfq({id:'',reference:localRef});setServerPrice({min:price.min,max:price.max,validUntil});setError(lang==='ar'?'تقدير أولي جاهز. يُحفظ الطلب رسميًا بعد تأكيد فريق Septlion.':'Indicative estimate ready. The request is formally recorded after Septlion confirmation.');setSubmitted(true)}finally{setBusy(false);setTimeout(()=>document.getElementById('result')?.scrollIntoView({behavior:'smooth'}),50)}}
 function printRfq(){if(rfq?.id){const base=process.env.NEXT_PUBLIC_API_URL||'/api';window.open(`${base}/maritime-rfq/${rfq.id}/pdf`,'_blank','noopener,noreferrer')}else window.print()}
 return <main dir={lang==='ar'?'rtl':'ltr'} className={styles.page}>
  <header className={styles.header}><a href="/" className={styles.brand}><img src="/brand/septlion-header-white.png" alt="Septlion"/></a><div><span>{lang==='ar'?'مصفوفة سبتليون الملاحية':'Septlion Maritime Matrix'}</span><button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'EN':'العربية'}</button></div></header>
  <section className={styles.hero}><div><small>MARITIME RFQ · S-1—S-7</small><h1>{lang==='ar'?'حوّل احتياجك الملاحي إلى طلب عرض منظم.':'Turn your shipping requirement into a structured RFQ.'}</h1><p>{lang==='ar'?'أدخل مسار الشحنة وحجمها. سنصنفها فورًا وننشئ نطاقًا تقديريًا صالحًا لمدة 7 أيام.':'Enter the route and volume. We classify it instantly and generate a 7-day indicative range.'}</p></div><Heptagon active={Number(level.code.slice(2))}/></section>
  <section className={styles.workspace}>
   <form className={styles.form} onSubmit={submit}>
    <div className={styles.formHead}><div><small>01 / RFQ INPUT</small><h2>{lang==='ar'?'بيانات طلب الشحن':'Shipment request'}</h2></div><b>{level.code}</b></div>
    <div className={styles.grid}>
     <Field label="اسم العميل / Customer name"><input required value={form.customerName} onChange={e=>set('customerName',e.target.value)}/></Field>
     <Field label="الشركة / Company"><input required value={form.company} onChange={e=>set('company',e.target.value)}/></Field>
     <Field label="البريد الإلكتروني / Email"><input required type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></Field>
     <Field label="الهاتف / Phone"><input required value={form.phone} onChange={e=>set('phone',e.target.value)}/></Field>
     <Field label="عدد الحاويات"><input required min="1" step="1" type="number" value={form.count} onChange={e=>set('count',e.target.value)}/></Field>
     <Field label="نوع الحاوية"><select value={form.type} onChange={e=>set('type',e.target.value)}>{[['20FT','20ft · TEU'],['40FT','40ft · FEU'],['REEFER','Reefer'],['OPEN_TOP','Open Top'],['FLAT_RACK','Flat Rack'],['BULK','سائب · Bulk']].map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></Field>
     <Field label="ميناء التحميل · POL"><select value={form.pol} onChange={e=>set('pol',e.target.value)}>{ports.map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="ميناء الوصول · POD"><select value={form.pod} onChange={e=>set('pod',e.target.value)}>{ports.map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="Incoterm"><select value={form.incoterm} onChange={e=>set('incoterm',e.target.value)}>{['FOB','CIF','EXW','DAP','FCA'].map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="تاريخ الشحن"><input required type="date" value={form.shipDate} onChange={e=>set('shipDate',e.target.value)}/></Field>
     <Field label="نوع البضاعة"><select value={form.cargo} onChange={e=>set('cargo',e.target.value)}>{['GENERAL','DG','REEFER','OOG'].map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="شروط الدفع"><select value={form.payment} onChange={e=>set('payment',e.target.value)}>{['LC','TT','OPEN_ACCOUNT'].map(x=><option key={x}>{x.replace('_',' ')}</option>)}</select></Field>
     <Field label="الوزن الإجمالي (طن)" optional><input min="0" type="number" value={form.weight} onChange={e=>set('weight',e.target.value)}/></Field>
     <Field label="الحجم CBM" optional><input min="0" type="number" value={form.cbm} onChange={e=>set('cbm',e.target.value)}/></Field>
     <Field label="عدد الوجهات النهائية" optional><input min="1" step="1" type="number" value={form.destinations} onChange={e=>set('destinations',e.target.value)}/></Field>
     <Field label="ملاحظات" optional wide><textarea value={form.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    </div>
    {error&&<p role="alert">{error}</p>}<button className={styles.submit} type="submit" disabled={busy}>{busy?(lang==='ar'?'جارٍ حفظ الطلب…':'Submitting…'):(lang==='ar'?'تصنيف وحفظ الطلب':'Classify & submit')} <span>↗</span></button>
   </form>
   <aside className={styles.live}><small>LIVE CLASSIFICATION</small><Heptagon active={Number(level.code.slice(2))}/><div className={styles.resultLine}><strong>{level.code}</strong><b>{level.name}</b><span>{level.term}</span></div><p>{level.description}</p><dl><div><dt>النطاق</dt><dd>{level.min}–{level.max??'∞'} حاوية</dd></div><div><dt>TEU المكافئ</dt><dd>{form.type==='40FT'?count*2:count}</dd></div><div><dt>الصلاحية</dt><dd>{validUntil}</dd></div></dl></aside>
  </section>
  {submitted&&<section id="result" className={styles.quote}>
   <div><small>INDICATIVE FREIGHT RANGE {rfq&&`· ${rfq.reference}`}</small><h2>${(serverPrice?.min??price.min).toLocaleString()} — ${(serverPrice?.max??price.max).toLocaleString()} <em>USD / unit</em></h2><p>تقدير غير ملزم، يخضع لتأكيد الناقل والمساحة والمسار وتاريخ الإبحار. صالح حتى {serverPrice?.validUntil??validUntil}.</p></div>
   <div className={styles.quoteMeta}><span>{form.pol}</span><i>→</i><span>{form.pod}</span><b>{level.term}</b></div>
   <div className={styles.surcharges}>{price.fees.map(x=><span key={x.code}>{x.code} <b>{x.rate}%</b></span>)}</div>
   <button onClick={printRfq}>تحميل / طباعة RFQ الرسمي</button>
  </section>}
  <footer className={styles.footer}><span>Septlion LLC · Maritime RFQ</span><span>Master steps, shorten distances.</span></footer>
 </main>
}

function Field({label,optional,wide,children}:{label:string;optional?:boolean;wide?:boolean;children:React.ReactNode}){return <label className={wide?styles.wide:''}><span>{label}{optional&&<small> اختياري</small>}</span>{children}</label>}
function Heptagon({active}:{active:number}){return <div className={styles.heptagon} style={{'--level':active} as React.CSSProperties}><div><span>S-{active}</span><small>LEVEL</small></div></div>}
