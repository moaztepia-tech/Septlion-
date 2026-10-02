'use client';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {SCALE_RANGES,getSeptlionScale,scaleProgress} from '../../lib/septlion-scale';

type Incoterm='CIF'|'CFR'|'FOB';
type Payment='L/C'|'T/T'|'OTHER';
type Destination={port:string;country:string;code:string};

const destinations:Destination[]=[
 {port:'Jeddah Islamic Port',country:'Saudi Arabia',code:'SAJED'},
 {port:'Dar es Salaam',country:'Tanzania',code:'TZDAR'},
 {port:'Mombasa',country:'Kenya',code:'KEMBA'},
 {port:'Mogadishu',country:'Somalia',code:'SOMGQ'},
 {port:'Jebel Ali',country:'United Arab Emirates',code:'AEJEA'},
 {port:'Port Sudan',country:'Sudan',code:'SDPZU'},
 {port:'Tema',country:'Ghana',code:'GHTEM'},
 {port:'Lagos / Apapa',country:'Nigeria',code:'NGAPP'},
];

const products=[
 {id:'flour-bakery',eyebrow:'ZOLLANA · FLOUR',name:'دقيق مخابز',en:'Bakery Flour',pack:'50 كجم · 25 كجم',note:'توريد بالحاوية · مواصفة تُثبت في العرض'},
 {id:'flour-basic',eyebrow:'ZOLLANA · FLOUR',name:'دقيق أساسي',en:'Essential Flour',pack:'50 كجم · 25 كجم · 1 كجم',note:'توريد بالحاوية · العلامة والتعبئة حسب التكوين'},
 {id:'flour-complete',eyebrow:'ZOLLANA · FLOUR',name:'دقيق كامل',en:'Complete Flour',pack:'50 كجم · 10 كجم · 1 كجم',note:'توريد بالحاوية · مواصفة تجارية قابلة للتكوين'},
];

function normalizePhone(v:string){return v.replace(/[^\d+]/g,'').replace(/(?!^)\+/g,'')}
function validPhone(v:string){const d=normalizePhone(v).replace('+','');return d.length>=8&&d.length<=15}

export default function DiscoverPage(){
 const router=useRouter();
 const[active,setActive]=useState(0),[count,setCount]=useState(1),[incoterm,setIncoterm]=useState<Incoterm>('CIF'),[payment,setPayment]=useState<Payment>('L/C');
 const[destination,setDestination]=useState<Destination|null>(null),[sheet,setSheet]=useState(false),[query,setQuery]=useState('');
 const[identity,setIdentity]=useState(false),[name,setName]=useState(''),[company,setCompany]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[error,setError]=useState('');
 const product=products[active],scale=getSeptlionScale(count),progress=scaleProgress(count);
 const filtered=useMemo(()=>destinations.filter(d=>(d.port+' '+d.country+' '+d.code).toLowerCase().includes(query.toLowerCase())),[query]);

 function startIdentity(){
  if(!destination){setSheet(true);return}
  setIdentity(true);
  setTimeout(()=>document.getElementById('buyer-name')?.focus(),80);
 }
 function handoff(){
  if(!name.trim()||!company.trim()||!validPhone(phone)){setError('أكمل الاسم والشركة ورقم WhatsApp صحيح.');return}
  const context={
   version:1,source:'product_feed',createdAt:new Date().toISOString(),
   product:{id:product.id,name:product.name,nameEn:product.en,packing:product.pack},
   containerCount:count,septlionScale:scale,incoterm,
   destination,paymentPreference:payment,
   buyer:{name:name.trim(),company:company.trim(),whatsapp:normalizePhone(phone),email:email.trim()||null,whatsappStatus:'UNCONFIRMED'}
  };
  sessionStorage.setItem('septlion_feed_context',JSON.stringify(context));
  const previous=JSON.parse(localStorage.getItem('septlion_draft_requests')||'[]');
  localStorage.setItem('septlion_draft_requests',JSON.stringify([context,...previous].slice(0,20)));
  router.push('/require?source=feed');
 }
 return <main className="v1-app" dir="rtl">
  <header className="v1-topbar"><a href="/" className="v1-wordmark" aria-label="Septlion"><span className="v1-hept">⬡</span><b>سبتليون</b></a><a className="v1-home-ai" href="/require">ماذا تحتاج؟</a></header>
  <div className="v1-tabs" role="tablist"><button className="active">لأجلك</button><button>الأغذية</button><button>التغليف</button><button>المواد الخام</button><button>الصناعة</button></div>
  <section className="v1-feed">
   <div className="v1-section-head"><div><small>DISCOVER</small><h1>اكتشف المنتجات</h1></div><span>منتجات جاهزة لبدء طلب توريد</span></div>
   <article className="v1-product">
    <div className="v1-product-visual"><div className="v1-bag"><span>ZOLLANA</span><b>{product.name}</b><small>{product.en}</small></div><div className="v1-pager">{products.map((_,i)=><button key={i} aria-label={'product '+(i+1)} className={i===active?'active':''} onClick={()=>{setActive(i);setCount(1)}}/> )}</div></div>
    <div className="v1-product-copy"><small>{product.eyebrow}</small><h2>{product.name}</h2><p>{product.en}</p><dl><div><dt>التعبئة</dt><dd>{product.pack}</dd></div><div><dt>التوريد</dt><dd>{product.note}</dd></div></dl></div>

    <div className="v1-config">
     <div className="v1-label-row"><b>كم تحتاج؟</b><span>الحد الأدنى حاوية واحدة</span></div>
     <div className="v1-counter"><button onClick={()=>setCount(Math.max(1,count-1))}>−</button><strong>{count}<small> حاوية</small></strong><button onClick={()=>setCount(count+1)}>+</button></div>
     <div className="v1-scale-current">{scale}</div>
     <div className="v1-scale"><div className="v1-scale-line"/><i style={{insetInlineStart:`calc(${progress}% - 4px)`}}/></div>
     <div className="v1-scale-labels">{SCALE_RANGES.map(x=><span key={x.name}><b>{x.name}</b><small>{x.label}</small></span>)}</div>

     <fieldset className="v1-choice"><legend>شرط التجارة</legend><div>{(['CIF','CFR','FOB'] as Incoterm[]).map(x=><button key={x} className={incoterm===x?'selected':''} onClick={()=>{setIncoterm(x);setDestination(null)}}>{x}</button>)}</div></fieldset>

     <button className={'v1-destination '+(destination?'filled':'')} onClick={()=>setSheet(true)}>
      <span><small>{incoterm==='FOB'?'الميناء':'الشحن إلى'}</small><b>{destination?destination.port:(incoterm==='FOB'?'حدد الميناء المتفق عليه':'حدد ميناء الوصول')}</b>{destination&&<em>{destination.country} · {destination.code}</em>}</span><strong>⌄</strong>
     </button>

     <fieldset className="v1-choice"><legend>طريقة الدفع</legend><div>{([['L/C','L/C'],['T/T','T/T'],['OTHER','أخرى']] as [Payment,string][]).map(([v,l])=><button key={v} className={payment===v?'selected':''} onClick={()=>setPayment(v)}>{l}</button>)}</div></fieldset>

     <button className="v1-primary" onClick={startIdentity}>متابعة الطلب</button>
    </div>
   </article>
  </section>

  <nav className="v1-bottom-nav"><a href="/" >الرئيسية</a><a className="active" href="/discover">اكتشف</a><a href="/require">الطلبات</a><span>التنبيهات</span><span>الحساب</span></nav>

  {sheet&&<div className="v1-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(false)}}><section className="v1-sheet" role="dialog" aria-modal="true"><div className="v1-grab"/><div className="v1-sheet-head"><div><small>{incoterm}</small><h3>{incoterm==='FOB'?'حدد الميناء':'حدد وجهة الشحن'}</h3></div><button onClick={()=>setSheet(false)}>×</button></div><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن دولة أو ميناء"/><div className="v1-destinations">{filtered.map(d=><button key={d.code} onClick={()=>{setDestination(d);setSheet(false);setQuery('')}}><span><b>{d.port}</b><small>{d.country}</small></span><em>{d.code}</em></button>)}</div></section></div>}

  {identity&&<div className="v1-overlay identity"><section className="v1-sheet v1-identity" role="dialog" aria-modal="true"><div className="v1-grab"/><div className="v1-sheet-head"><div><small>خطوة أخيرة</small><h3>بيانات التواصل</h3><p>حتى نحفظ طلبك ونكمل معك من حيث توقفت.</p></div><button onClick={()=>setIdentity(false)}>×</button></div>
   <label>الاسم<input id="buyer-name" value={name} onChange={e=>{setName(e.target.value);setError('')}} autoComplete="name"/></label>
   <label>الشركة<input value={company} onChange={e=>{setCompany(e.target.value);setError('')}} autoComplete="organization"/></label>
   <label>البريد الإلكتروني <small>اختياري</small><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
   <label>رقم WhatsApp<input inputMode="tel" value={phone} onChange={e=>{setPhone(e.target.value);setError('')}} onBlur={()=>{if(name.trim()&&company.trim()&&validPhone(phone))handoff()}} placeholder="+966 5X XXX XXXX" autoComplete="tel"/></label>
   {error&&<p className="v1-error">{error}</p>}
   <p className="v1-auto-note">بعد اكتمال البيانات سينتقل طلبك تلقائيًا إلى Septlion.</p>
  </section></div>}
 </main>
}