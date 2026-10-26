'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import './discover-previous.css';
import {publicCatalog,CatalogProduct} from '../../lib/catalog-data';
import {createTradeRequirement} from '../../lib/trade-data';
import {PhoneVerification} from '../../components/phone-verification';
import {useRouter} from 'next/navigation';
import {SCALE_RANGES,getSeptlionScale,scaleProgress} from '../../lib/septlion-scale';
import {buyerContactProblem,normalizePhone} from '../../lib/buyer-contact';
import {COMPOSER_DRAFT_KEY,draftFromFeed} from '../../lib/composer-draft';
import {sessionUserId} from '../../lib/api';

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



export default function DiscoverPage(){
 const router=useRouter();
 const[records,setRecords]=useState<CatalogProduct[]>([]),[catalogError,setCatalogError]=useState(''),[catalogLoading,setCatalogLoading]=useState(true);
 const[variants,setVariants]=useState<Record<string,number>>({}),[saving,setSaving]=useState(false),[received,setReceived]=useState('');
 const requestKey=useRef(''),lastPayload=useRef('');
 const products=records.map(p=>({id:p.id,name:p.name,en:p.name,eyebrow:p.sector?.name||'SEPTLION',pack:p.skus.map(s=>s.specifications?.packing||s.name).join(' · '),note:'التوفر والسعر والمواصفات النهائية تثبت في العرض'}));
 useEffect(()=>{let cancelled=false;publicCatalog().then(p=>{if(!cancelled)setRecords(p)}).catch(e=>{if(!cancelled)setCatalogError(e.message)}).finally(()=>{if(!cancelled)setCatalogLoading(false)});return()=>{cancelled=true}},[]);
 const[active,setActive]=useState(0),[count,setCount]=useState(1),[incoterm,setIncoterm]=useState<Incoterm>('CIF'),[payment,setPayment]=useState<Payment|null>(null);
 const[destination,setDestination]=useState<Destination|null>(null),[sheet,setSheet]=useState(false),[query,setQuery]=useState('');
 const[identity,setIdentity]=useState(false),[name,setName]=useState(''),[company,setCompany]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[error,setError]=useState('');
 const[category,setCategory]=useState('الكل'),[restored,setRestored]=useState(false);
 const[failedImage,setFailedImage]=useState('');
 const handingOff=useRef(false);
 const[verifiedContact,setVerifiedContact]=useState('');
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem('septlion_discover_config')||'null');if(saved){if(saved.variants&&typeof saved.variants==='object')setVariants(saved.variants);if(saved.contact){setName(saved.contact.name||'');setCompany(saved.contact.company||'');setPhone(saved.contact.phone||'');setEmail(saved.contact.email||'')}if(Number.isInteger(saved.active)&&saved.active>=0)setActive(saved.active);if(Number.isInteger(saved.count)&&saved.count>0&&saved.count<=1000000000)setCount(saved.count);if(['CIF','CFR','FOB'].includes(saved.incoterm))setIncoterm(saved.incoterm);if(['L/C','T/T','OTHER'].includes(saved.payment))setPayment(saved.payment);setDestination(destinations.find(d=>d.code===saved.destinationCode)||null)}const raw=sessionStorage.getItem('septlion_discover_product');if(raw!==null){const n=Number(raw);if(Number.isInteger(n)&&n>=0&&n<100)setActive(n);sessionStorage.removeItem('septlion_discover_product')}}catch{}setRestored(true)},[]);
 useEffect(()=>{if(restored){try{sessionStorage.setItem('septlion_discover_config',JSON.stringify({active,count,incoterm,payment,destinationCode:destination?.code,variants,contact:{name,company,phone,email}}))}catch{}}},[active,count,incoterm,payment,destination,restored,variants,name,company,phone,email]);
 useEffect(()=>{
  if(!sheet&&!identity)return;
  const previous=document.activeElement as HTMLElement|null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const dialog=document.querySelector<HTMLElement>('[role="dialog"]');
  dialog?.querySelector<HTMLElement>('input,button')?.focus();
  function keys(event:KeyboardEvent){
   if(event.key==='Escape'&&!saving){setSheet(false);setIdentity(false);return}
   if(event.key!=='Tab'||!dialog)return;
   const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(x=>!x.hasAttribute('disabled'));
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  document.addEventListener('keydown',keys);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keys);previous?.focus()};
 },[sheet,identity,saving]);
 const product=products[active]||products[0],record=records[active]||records[0],scale=getSeptlionScale(count),progress=scaleProgress(count);
 const primaryImage=record?.skus.flatMap(s=>s.media||[]).filter(m=>m.type==='IMAGE'&&/^https:\/\//.test(m.url)).sort((a,b)=>a.sortOrder-b.sortOrder)[0]?.url||'';
 const filtered=useMemo(()=>destinations.filter(d=>(d.port+' '+d.country+' '+d.code).toLowerCase().includes(query.toLowerCase())),[query]);

 function startIdentity(){
  if(!product)return;
  if(!destination){setSheet(true);return}
  setIdentity(true);
 }
 async function handoff(){
  if(!product||saving)return;
  if(handingOff.current)return;
  const problem=buyerContactProblem({name,company,phone,email});
  if(problem){setError(problem);return}
  if(!destination||!payment){setError('أكمل الوجهة وطريقة الدفع قبل بيانات التواصل.');return}
  const selected=Object.entries(variants).filter(([id,n])=>record?.skus.some(s=>s.id===id)&&Number.isInteger(n)&&n>0).map(([skuId,containers])=>({skuId,containers}));
  if(!selected.length){setError('اختر تعبئة واحدة على الأقل وحدّد حاوياتها.');return}
  if(verifiedContact!==normalizePhone(phone)){setError('أكد رقم واتساب أولًا حتى نربط الطلب بك.');return}
  const input={product:product.name,catalogProductId:product.id,variants:selected,quantity:count+' FCL',unit:'FCL',containerCount:count,destination:destination.port,deliveryCountry:destination.country,destinationCode:destination.code,incoterm,paymentPreference:payment,source:'PRODUCT_FEED',buyer:{name,company,whatsapp:normalizePhone(phone),email:email||null,whatsappStatus:verifiedContact===normalizePhone(phone)?'VERIFIED':'UNCONFIRMED'}};
  const signature=JSON.stringify(input);if(lastPayload.current!==signature){try{const saved=JSON.parse(sessionStorage.getItem('septlion_discover_retry')||'null');requestKey.current=saved?.signature===signature?saved.key:crypto.randomUUID();sessionStorage.setItem('septlion_discover_retry',JSON.stringify({signature,key:requestKey.current}))}catch{requestKey.current=crypto.randomUUID()}lastPayload.current=signature}
  setSaving(true);setError('');handingOff.current=true;
  try{const result=await createTradeRequirement({...input,idempotencyKey:requestKey.current});setReceived('تم استلام طلب عرض السعر · '+result.item.id);setIdentity(false);setSheet(false);requestKey.current='';lastPayload.current='';try{sessionStorage.removeItem('septlion_discover_retry')}catch{}}catch(e){setError(e instanceof Error?e.message:'تعذر إرسال الطلب')}finally{setSaving(false);handingOff.current=false}
 }
 function composerHandoff(){
  if(!product||!destination||!payment)return;
  const context={
   version:1,source:'product_feed' as const,createdAt:new Date().toISOString(),
   product:{id:product.id,name:product.name,nameEn:product.en,packing:product.pack},
   containerCount:count,septlionScale:scale,incoterm,
   destination,paymentPreference:payment,
   buyer:{name:name.trim(),company:company.trim(),whatsapp:normalizePhone(phone),email:email.trim()||null,whatsappStatus:verifiedContact===normalizePhone(phone)?'VERIFIED':'UNCONFIRMED'},
   sourceContext:{path:'discover',campaignId:new URLSearchParams(window.location.search).get('campaign_id'),utmSource:new URLSearchParams(window.location.search).get('utm_source')}
  };
  try{
   const draft={...draftFromFeed(context,crypto.randomUUID()),ownerId:sessionUserId()};
   sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify(draft));
   sessionStorage.setItem('septlion_feed_context',JSON.stringify(context));
   handingOff.current=true;router.push('/require?source=feed');
  }catch{setError('تعذر حفظ اختيارك على هذا الجهاز. حاول مجددًا.');}
 }
 return <main className="discover-page" dir="rtl">
  <header className="discover-top"><a href="/" className="discover-brand" aria-label="Septlion"><img src="/brand/septlion-wordmark-navy.svg" alt="Septlion"/></a><nav aria-label="التنقل الرئيسي"><a href="/">الرئيسية</a><a className="active" aria-current="page" href="/discover">اكتشف</a><a href="/requests">التجارة</a></nav><div><a className="discover-muted" href="/notifications">التنبيهات</a><a className="discover-home-ai" href="/require">ماذا تحتاج؟ <b>↗</b></a></div></header>
  <div className="discover-tabs" aria-label="فئات المنتجات">{['الكل',...Array.from(new Set(records.map(p=>p.sector?.name).filter(Boolean)))].map(c=><button key={c} className={category===c?'active':''} aria-pressed={category===c} onClick={()=>{setCategory(c);const i=records.findIndex(p=>p.sector?.name===c);if(i>=0){setActive(i);setVariants({})}}}>{c}</button>)}</div>
  <section className="discover-feed">
   <div className="discover-section-head"><div><small>DISCOVER</small><h1>اكتشف ما يتحرك في السوق.</h1></div><span>ابدأ من إشارة طلب أو منتج مناسب، ثم حوّله مباشرة إلى احتياج تجاري قابل للتنفيذ.</span></div>
   {received&&<p role="status">{received}</p>}{catalogLoading&&<p role="status">جارٍ تحميل المنتجات…</p>}{catalogError&&<p role="alert">{catalogError}</p>}{product?<article className="discover-product">
    <div className="discover-product-visual"><div className="discover-visual-meta"><span>01</span><small>{product.eyebrow}</small></div>{primaryImage&&primaryImage!==failedImage?<img className="discover-product-image" src={primaryImage} alt={product.name} onError={()=>setFailedImage(primaryImage)}/>:(<div className="discover-bag"><span>{product.eyebrow}</span><b>{product.name}</b><small>{product.en}</small><em>{product.pack}</em></div>)}<div className="discover-pager">{products.map((_,i)=><button key={i} aria-label={'عرض '+products[i].name} aria-pressed={i===active} className={i===active?'active':''} onClick={()=>{setActive(i);setCount(1);setVariants({})}}/> )}</div></div>
    <div className="discover-product-copy"><small>{product.eyebrow}</small><h2>{product.name}</h2><p>{product.en}</p><dl><div><dt>التعبئة</dt><dd>{product.pack}</dd></div><div><dt>التوريد</dt><dd>{product.note}</dd></div></dl></div>

    <div className="discover-config-head"><small>YOUR REQUIREMENT</small><b>حدّد الأساسيات</b><span>سنكمل التفاصيل داخل الطلب.</span></div><div className="discover-config">
     <div className="discover-label-row"><b>كم تحتاج؟</b><span>الحد الأدنى حاوية واحدة</span></div>
     <div className="discover-counter"><strong>{count}<small> حاوية · مجموع التعبئات المختارة</small></strong></div>
     <div className="discover-scale-current">{scale}</div>
     <div className="discover-scale"><div className="discover-scale-line"/><i style={{insetInlineStart:`calc(${progress}% - 4px)`}}/></div>
     <div className="discover-scale-labels">{SCALE_RANGES.map(x=><span key={x.name}><b>{x.name}</b><small>{x.label}</small></span>)}</div>

     <fieldset className="discover-choice"><legend>التعبئات · حاويات كل تعبئة</legend>{record?.skus.map(s=><label key={s.id}>{s.specifications?.packing||s.name}<input aria-label={'حاويات '+s.name} type="number" min="0" max="999999999" step="1" value={variants[s.id]||0} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=999999999){const next={...variants,[s.id]:n};setVariants(next);setCount(Object.values(next).reduce((a,b)=>a+b,0)||1)}}}/></label>)}</fieldset>
     <fieldset className="discover-choice"><legend>شرط التجارة</legend><div>{(['CIF','CFR','FOB'] as Incoterm[]).map(x=><button key={x} aria-pressed={incoterm===x} className={incoterm===x?'selected':''} onClick={()=>setIncoterm(x)}>{x}</button>)}</div></fieldset>

     <button className={'discover-destination '+(destination?'filled':'')} onClick={()=>setSheet(true)}>
      <span><small>{incoterm==='FOB'?'الميناء':'الشحن إلى'}</small><b>{destination?destination.port:(incoterm==='FOB'?'حدد الميناء المتفق عليه':'حدد ميناء الوصول')}</b>{destination&&<em>{destination.country} · {destination.code}</em>}</span><strong>⌄</strong>
     </button>

     <fieldset className="discover-choice"><legend>طريقة الدفع</legend><div>{([['L/C','L/C'],['T/T','T/T'],['OTHER','أخرى']] as [Payment,string][]).map(([v,l])=><button key={v} aria-pressed={payment===v} className={payment===v?'selected':''} onClick={()=>setPayment(v)}>{l}</button>)}</div></fieldset>

     <button className="discover-primary" disabled={!payment} onClick={startIdentity}><span>{payment?'اطلب هذا الصنف':'اختر طريقة الدفع للمتابعة'}</span><b>↗</b></button><p className="discover-assurance">طلب واحد · عرض Septlion · تفاصيل التنفيذ تُثبت في العرض</p>
    </div>
   </article>:<div className="discover-category-empty"><h2>الكتالوج</h2><p>لا توجد بطاقات منشورة لهذه الفئة حاليًا. يمكنك وصف احتياجك في صفحة تقديم الاحتياج.</p><a className="discover-home-ai" href="/require">اكتب احتياجك ←</a></div>}
  </section>
  <nav className="discover-bottom-nav" aria-label="التنقل السريع"><a href="/">الرئيسية</a><a className="active" aria-current="page" href="/discover">اكتشف</a><a href="/requests">التجارة</a><a href="/notifications">التنبيهات</a><a href="/account">الحساب</a></nav>

  {sheet&&<div className="discover-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(false)}}><section className="discover-sheet" role="dialog" aria-modal="true" aria-label="بيانات الطلب"><div className="discover-grab"/><div className="discover-sheet-head"><div><small>{incoterm}</small><h3>{incoterm==='FOB'?'حدد الميناء':'حدد وجهة الشحن'}</h3></div><button aria-label="إغلاق اختيار الوجهة" onClick={()=>setSheet(false)}>×</button></div><input aria-label="البحث عن دولة أو ميناء" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن دولة أو ميناء"/><div className="discover-destinations">{filtered.length===0&&<p role="status">لا توجد وجهة مطابقة. يمكنك كتابة وجهة أخرى في صفحة تقديم الاحتياج.</p>}{filtered.map(d=><button key={d.code} onClick={()=>{setDestination(d);setSheet(false);setQuery('')}}><span><b>{d.port}</b><small>{d.country}</small></span><em>{d.code}</em></button>)}</div></section></div>}

  {identity&&<div className="discover-overlay identity"><section className="discover-sheet discover-identity" role="dialog" aria-modal="true" aria-labelledby="contact-title" aria-describedby="contact-hint"><div className="discover-grab"/><div className="discover-sheet-head"><div><small>خطوة أخيرة</small><h3 id="contact-title">بيانات التواصل</h3><p>سنرفق بياناتك بطلب عرض السعر.</p></div><button data-close-contact aria-label="إغلاق بيانات التواصل" disabled={saving} onClick={()=>setIdentity(false)}>×</button></div>
   <form onSubmit={e=>{e.preventDefault();void handoff()}}>
   <label>الاسم<input id="buyer-name" disabled={saving} required maxLength={120} value={name} onChange={e=>{setName(e.target.value);setError('')}} autoComplete="name" enterKeyHint="next"/></label>
   <label>الشركة<input required maxLength={200} value={company} onChange={e=>{setCompany(e.target.value);setError('')}} autoComplete="organization" disabled={saving} enterKeyHint="next"/></label>
   <label>البريد الإلكتروني <small>اختياري</small><input type="email" maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setError('')}} autoComplete="email" disabled={saving} enterKeyHint="next" dir="ltr"/></label>
   <label>رقم WhatsApp مع رمز الدولة<input type="tel" disabled={saving} required inputMode="tel" maxLength={30} value={phone} onChange={e=>{setPhone(e.target.value);setError('')}} placeholder="+966 5X XXX XXXX" autoComplete="tel" enterKeyHint="done" aria-describedby="contact-hint" dir="ltr"/></label>
   <PhoneVerification phone={phone} onVerified={setVerifiedContact} disabled={saving}/>
   <button className="discover-primary" disabled={saving||!verifiedContact||verifiedContact!==normalizePhone(phone)}>{saving?'جارٍ الإرسال…':'طلب عرض سعر'}</button>
   <button type="button" disabled={saving} onClick={composerHandoff}>متابعة تخصيص الاحتياج</button>
   </form>
   {error&&<p className="discover-error" role="alert">{error}</p>}
   <p id="contact-hint" className="discover-auto-note">بعد تأكيد الرقم وإرسال الطلب تواصل التصفح من الموضع نفسه. البريد الإلكتروني اختياري.</p>
  </section></div>}
 </main>
}
