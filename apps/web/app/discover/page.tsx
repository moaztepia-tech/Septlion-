'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {catalogPreview} from '../../lib/catalog-preview';
import {useRouter} from 'next/navigation';
import {SCALE_RANGES,getSeptlionScale,scaleProgress} from '../../lib/septlion-scale';
import {buyerContactProblem,normalizePhone} from '../../lib/buyer-contact';
import {COMPOSER_DRAFT_KEY,draftFromFeed} from '../../lib/composer-draft';
import {sessionUserId} from '../../lib/api';
import {PlatformHeader} from '../../components/platform-header';

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

const destinationNames:Record<string,[string,string]>={
 SAJED:['جدة الإسلامية','السعودية'],TZDAR:['دار السلام','تنزانيا'],
 KEMBA:['مومباسا','كينيا'],SOMGQ:['مقديشو','الصومال'],
 AEJEA:['جبل علي','الإمارات'],SDPZU:['بورتسودان','السودان'],
 GHTEM:['تيما','غانا'],NGAPP:['لاغوس / أبابا','نيجيريا'],
};
const destinationName=(item:Destination)=>destinationNames[item.code]||[item.port,item.country];

const products=catalogPreview;

export default function DiscoverPage(){
 const router=useRouter();
 const[active,setActive]=useState(0),[count,setCount]=useState(1),[incoterm,setIncoterm]=useState<Incoterm>('CIF'),[payment,setPayment]=useState<Payment|null>(null);
 const[destination,setDestination]=useState<Destination|null>(null),[sheet,setSheet]=useState(false),[query,setQuery]=useState('');
 const[identity,setIdentity]=useState(false),[name,setName]=useState(''),[company,setCompany]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[error,setError]=useState('');
 const[category,setCategory]=useState('لأجلك'),[restored,setRestored]=useState(false);
 const handingOff=useRef(false);
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem('septlion_discover_config')||'null');if(saved){if(Number.isInteger(saved.active)&&products[saved.active])setActive(saved.active);if(Number.isInteger(saved.count)&&saved.count>0&&saved.count<=1000000000)setCount(saved.count);if(['CIF','CFR','FOB'].includes(saved.incoterm))setIncoterm(saved.incoterm);if(['L/C','T/T','OTHER'].includes(saved.payment))setPayment(saved.payment);setDestination(destinations.find(d=>d.code===saved.destinationCode)||null)}const raw=sessionStorage.getItem('septlion_discover_product');if(raw!==null){const n=Number(raw);if(Number.isInteger(n)&&n>=0&&n<products.length)setActive(n);sessionStorage.removeItem('septlion_discover_product')}}catch{}setRestored(true)},[]);
 useEffect(()=>{if(restored){try{sessionStorage.setItem('septlion_discover_config',JSON.stringify({active,count,incoterm,payment,destinationCode:destination?.code}))}catch{}}},[active,count,incoterm,payment,destination,restored]);
 useEffect(()=>{
  if(!sheet&&!identity)return;
  const previous=document.activeElement as HTMLElement|null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const dialog=document.querySelector<HTMLElement>('[role="dialog"]');
  dialog?.querySelector<HTMLElement>('input,button')?.focus();
  function keys(event:KeyboardEvent){
   if(event.key==='Escape'){setSheet(false);setIdentity(false);return}
   if(event.key!=='Tab'||!dialog)return;
   const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(x=>!x.hasAttribute('disabled'));
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  document.addEventListener('keydown',keys);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keys);previous?.focus()};
 },[sheet,identity]);
 const product=products[active],scale=getSeptlionScale(count),progress=scaleProgress(count);
 const range=SCALE_RANGES.find(item=>item.name===scale)!;
 function setContainerCount(value:number){setCount(Math.min(1000000000,Math.max(1,Math.floor(Number.isFinite(value)?value:1))))}
 const filtered=useMemo(()=>destinations.filter(d=>([d.port,d.country,d.code,...destinationName(d)].join(' ')).toLowerCase().includes(query.trim().toLowerCase())),[query]);

 function startIdentity(){
  if(!destination){setSheet(true);return}
  setIdentity(true);
  setTimeout(()=>document.getElementById('buyer-name')?.focus(),80);
 }
 function handoff(){
  if(handingOff.current)return;
  const problem=buyerContactProblem({name,company,phone,email});
  if(problem){setError(problem);return}
  if(!destination||!payment){setError('أكمل الوجهة وطريقة الدفع قبل بيانات التواصل.');return}
  const context={
   version:1,source:'product_feed' as const,createdAt:new Date().toISOString(),
   product:{id:product.id,name:product.name,nameEn:product.en,packing:product.pack},
   containerCount:count,septlionScale:scale,incoterm,
   destination,paymentPreference:payment,
   buyer:{name:name.trim(),company:company.trim(),whatsapp:normalizePhone(phone),email:email.trim()||null,whatsappStatus:'UNCONFIRMED'},
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
  <PlatformHeader/>
  <div className="discover-tabs" aria-label="فئات المنتجات">{['لأجلك','الأغذية','التغليف','المواد الخام','الصناعة'].map(c=><button key={c} className={category===c?'active':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <section className="discover-feed">
   <div className="discover-section-head"><div><small>منتجات تناسب احتياجك</small><h1>اكتشف ما يتحرك في السوق.</h1></div><span>اختر المنتج، وحدّد الكمية والوجهة وطريقة الدفع. سنكمل المواصفة والتفاصيل معك داخل الطلب.</span></div>
   {['لأجلك','الأغذية'].includes(category)?<article className="discover-product">
    <div className="discover-product-visual"><div className="discover-visual-meta"><span dir="ltr">{String(active+1).padStart(2,'0')}</span><small>أغذية · دقيق</small></div><div className="discover-bag"><span>ZOLLANA</span><b>{product.name}</b><small lang="en" dir="ltr">{product.en}</small><em>{product.pack}</em></div><div className="discover-pager" role="group" aria-label="أصناف الدقيق">{products.map((item,i)=><button key={item.id} aria-label={'عرض '+item.name} aria-pressed={i===active} className={i===active?'active':''} onClick={()=>{setActive(i);setCount(1)}}>{item.name.replace('دقيق ','')}</button>)}</div></div>
    <div className="discover-product-copy"><small>{product.eyebrow}</small><h2>{product.name}</h2><p>{product.en}</p><dl><div><dt>التعبئة</dt><dd>{product.pack}</dd></div><div><dt>التوريد</dt><dd>{product.note}</dd></div></dl></div>

    <div className="discover-config-head"><small>طلبك يبدأ هنا</small><b>حدّد الأساسيات</b><span>سنكمل التفاصيل داخل الطلب.</span></div><div className="discover-config">
     <div className="discover-label-row"><b>كم تحتاج؟</b><span>الحد الأدنى حاوية واحدة</span></div>
     <div className="discover-scale-current"><b dir="ltr">{scale}</b><span><bdi dir="ltr">{Number.isFinite(range.max)?`${range.min}–${range.max}`:'1000+'}</bdi> حاويات</span></div>
     <div className="discover-scale" dir="ltr" aria-hidden="true"><div className="discover-scale-line"/><i style={{insetInlineStart:`calc(${progress}% - 5px)`}}/></div>
     <div className="discover-scale-labels" dir="ltr" aria-hidden="true">{SCALE_RANGES.map(x=><span key={x.name} className={x.name===scale?'active':undefined}>{x.name}</span>)}</div>
     <div className="discover-counter"><button disabled={count===1} aria-label="تقليل عدد الحاويات" onClick={()=>setContainerCount(count-1)}>−</button><label><span className="sr-only">عدد الحاويات</span><input aria-label="عدد الحاويات" type="number" inputMode="numeric" min="1" max="1000000000" step="1" value={count} onChange={e=>setContainerCount(Number(e.target.value))}/><small>حاوية</small></label><button disabled={count>=1000000000} aria-label="زيادة عدد الحاويات" onClick={()=>setContainerCount(count+1)}>+</button></div>

     <fieldset className="discover-choice"><legend>شرط التجارة</legend><div>{(['CIF','CFR','FOB'] as Incoterm[]).map(x=><button key={x} aria-pressed={incoterm===x} className={incoterm===x?'selected':''} onClick={()=>setIncoterm(x)}>{x}</button>)}</div></fieldset>

     <button className={'discover-destination '+(destination?'filled':'')} onClick={()=>setSheet(true)}>
      <span><small>{incoterm==='FOB'?'الميناء':'الشحن إلى'}</small><b>{destination?destinationName(destination)[0]:(incoterm==='FOB'?'حدد الميناء المتفق عليه':'حدد ميناء الوصول')}</b>{destination&&<em>{destinationName(destination)[1]} · <bdi>{destination.code}</bdi></em>}</span><strong>⌄</strong>
     </button>

     <fieldset className="discover-choice"><legend>طريقة الدفع</legend><div>{([['L/C','L/C'],['T/T','T/T'],['OTHER','أخرى']] as [Payment,string][]).map(([v,l])=><button key={v} aria-pressed={payment===v} className={payment===v?'selected':''} onClick={()=>setPayment(v)}>{l}</button>)}</div></fieldset>

     <button className="discover-primary" disabled={!payment} onClick={startIdentity}><span>{payment?'ابدأ طلب التوريد':'اختر طريقة الدفع للمتابعة'}</span><b>↗</b></button><p className="discover-assurance">طلب واحد · عرض Septlion · تفاصيل التنفيذ تُثبت في العرض</p>
    </div>
   </article>:<div className="discover-category-empty"><h2>{category}</h2><p>لا توجد منتجات منشورة في هذه الفئة حاليًا. صف احتياجك وسنراجع إمكانية توريده معك.</p><a className="discover-home-ai" href="/require">اكتب احتياجك ←</a></div>}
  </section>

  {sheet&&<div className="discover-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(false)}}><section className="discover-sheet" role="dialog" aria-modal="true" aria-label="بيانات الطلب"><div className="discover-grab"/><div className="discover-sheet-head"><div><small>{incoterm}</small><h3>{incoterm==='FOB'?'حدد الميناء':'حدد وجهة الشحن'}</h3></div><button aria-label="إغلاق اختيار الوجهة" onClick={()=>setSheet(false)}>×</button></div><input aria-label="البحث عن دولة أو ميناء" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن دولة أو ميناء"/><div className="discover-destinations">{filtered.length===0&&<p role="status">لا توجد وجهة مطابقة. يمكنك كتابة وجهة أخرى داخل محرّر الطلب.</p>}{filtered.map(d=><button key={d.code} onClick={()=>{setDestination(d);setSheet(false);setQuery('')}}><span><b>{destinationName(d)[0]}</b><small>{destinationName(d)[1]}</small></span><em dir="ltr">{d.code}</em></button>)}</div></section></div>}

  {identity&&<div className="discover-overlay identity"><section className="discover-sheet discover-identity" role="dialog" aria-modal="true" aria-labelledby="contact-title" aria-describedby="contact-hint"><div className="discover-grab"/><div className="discover-sheet-head"><div><small>خطوة أخيرة</small><h3 id="contact-title">بيانات التواصل</h3><p>سنرفق بياناتك بمسودة الطلب.</p></div><button data-close-contact aria-label="إغلاق بيانات التواصل" onClick={()=>setIdentity(false)}>×</button></div>
   <form onSubmit={e=>{e.preventDefault();handoff()}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();const inputs=Array.from(e.currentTarget.querySelectorAll('input'));const index=inputs.indexOf(e.target as HTMLInputElement);if(index>=0&&index<inputs.length-1)inputs[index+1].focus();else handoff()}}}>
   <label>الاسم<input id="buyer-name" required maxLength={120} value={name} onChange={e=>{setName(e.target.value);setError('')}} autoComplete="name" enterKeyHint="next"/></label>
   <label>الشركة<input required maxLength={200} value={company} onChange={e=>{setCompany(e.target.value);setError('')}} autoComplete="organization" enterKeyHint="next"/></label>
   <label>البريد الإلكتروني <small>اختياري</small><input type="email" maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setError('')}} autoComplete="email" enterKeyHint="next" dir="ltr"/></label>
   <label>رقم واتساب مع رمز الدولة<input type="tel" required inputMode="tel" maxLength={30} value={phone} onChange={e=>{setPhone(e.target.value);setError('')}} onBlur={e=>{const target=e.relatedTarget as HTMLElement|null;if(target?.closest('form')===e.currentTarget.form||target?.hasAttribute('data-close-contact'))return;handoff()}} placeholder="+966 5X XXX XXXX" autoComplete="tel" enterKeyHint="done" aria-describedby="contact-hint" dir="ltr"/></label>
   </form>
   {error&&<p className="discover-error" role="alert">{error}</p>}
   <p id="contact-hint" className="discover-auto-note">أكمل البيانات، ثم اضغط «تم» في لوحة المفاتيح أو اخرج من حقل الرقم للانتقال إلى محرّر الطلب. يُراجع الطلب قبل إرساله. إدخال رقم واتساب لا يعني تأكيده.</p>
  </section></div>}
 </main>
}
