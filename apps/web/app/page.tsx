'use client';
import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {PlatformHeader} from '../components/platform-header';
import {COMPOSER_DRAFT_KEY} from '../lib/composer-draft';
import {sessionUserId} from '../lib/api';

const examples=['أحتاج 3 حاويات دقيق إلى دار السلام','أريد تصنيع عبوات لعلامتي التجارية','أبحث عن مورد لتغليف منتجات غذائية'];
export default function Home(){
 const router=useRouter();
 const [text,setText]=useState('');
 const [error,setError]=useState('');
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{try{const raw=sessionStorage.getItem('septlion_home_draft');if(raw){const d=JSON.parse(raw);if(!d.ownerId||d.ownerId===sessionUserId())setText(typeof d.text==='string'?d.text.slice(0,4000):'');}}catch{}finally{setHydrated(true)}},[]);
 useEffect(()=>{if(!hydrated)return;try{sessionStorage.setItem('septlion_home_draft',JSON.stringify({text,ownerId:sessionUserId()}));}catch{}},[text,hydrated]);
 function submit(e:FormEvent){e.preventDefault();if(!text.trim())return;try{
  sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
  sessionStorage.removeItem('septlion_feed_context');
  sessionStorage.removeItem('septlion_pending_requirement');
  sessionStorage.removeItem('septlion_requirement_context');
  sessionStorage.setItem('septlion_requirement_seed',text.trim());
  sessionStorage.removeItem('septlion_home_draft');
  router.push('/require');
 }catch{setError('تعذر حفظ الطلب على هذا الجهاز. احتياجك لا يزال ظاهرًا هنا.');}}
 return <main dir="rtl" className="v3-home">
  <PlatformHeader/>
  <div className="v3-home-shell">
   <div className="v3-overline"><span className="v3-signal"/> SEPTLION / GLOBAL TRADE OPERATING SYSTEM</div>
   <section className="v3-hero" aria-labelledby="v3-title">
    <div className="v3-hero-copy">
     <div className="v3-kicker">التجارة العالمية، بطريقة مختلفة</div>
     <h1 id="v3-title">طموحك التجاري.<br/><span>مسؤوليتنا أن يتحقق.</span></h1>
     <p className="v3-lead">أخبرنا بما تريد شراءه أو تصنيعه أو توريده. ننسّق الإمكانات ونحوّل احتياجك إلى مسار تجاري واضح — من الطلب إلى التنفيذ.</p>
     <div className="v3-proof"><span><b>01</b> عبّر عن احتياجك</span><i/><span><b>02</b> نجهّز الحل</span><i/><span><b>03</b> ننفّذ معك</span></div>
    </div>
    <div className="v3-hero-panel">
     <div className="v3-panel-top"><span className="v3-panel-mark">S<span>✦</span></span><span>مساحة الطلب الذكي</span><span className="v3-live"><i/> جاهز لاستقبال طلبك</span></div>
     <form onSubmit={submit} className="v3-intent-form">
      <label htmlFor="v3-need">ما الذي تريد إنجازه؟</label>
      <p>اكتب بلغتك وبطريقتك. لا تحتاج إلى تجهيز مواصفات كاملة الآن.</p>
      <textarea id="v3-need" required maxLength={4000} rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder="مثال: أحتاج 5 حاويات دقيق قمح إلى تنزانيا، التسليم CIF والدفع باعتماد مستندي…"/>
      <div className="v3-intent-foot"><span>{text.length.toLocaleString('ar-EG')} / ٤٬٠٠٠</span><button type="submit" disabled={!hydrated||!text.trim()}>ابدأ طلبك <span aria-hidden="true">←</span></button></div>
      {error&&<p role="alert" className="v3-error">{error}</p>}
     </form>
     <div className="v3-examples"><span>أمثلة للبدء</span>{examples.map(example=><button key={example} type="button" onClick={()=>setText(example)}>{example}<span aria-hidden="true">↗</span></button>)}</div>
    </div>
   </section>
   <section className="v3-approach" aria-label="ماذا تقدم سبتليون">
    <div><span className="v3-section-index">01 / DISCOVER</span><h2>اكتشف الإمكانات</h2><p>استعرض منتجات وعروضًا مؤهلة، أو ابدأ مباشرة باحتياجك.</p><Link href="/discover">استكشف المنتجات <span>←</span></Link></div>
    <div><span className="v3-section-index">02 / DEFINE</span><h2>احتياجك أولًا</h2><p>نحوّل التفاصيل غير المكتملة إلى طلب تجاري قابل للتسعير والتنفيذ.</p><Link href="/require">قدّم احتياجك <span>←</span></Link></div>
    <div><span className="v3-section-index">03 / EXECUTE</span><h2>من الوعد إلى التنفيذ</h2><p>تابع الطلبات والعروض ومراحل التنفيذ في مساحة واحدة.</p><Link href="/my-septlion">مساحتي <span>←</span></Link></div>
   </section>
   <footer className="v3-home-footer"><span>SEPTLION</span><span>Master Steps. Shorten Distances.</span><span>Built for ambitious trade.</span></footer>
  </div>
 </main>;
}
