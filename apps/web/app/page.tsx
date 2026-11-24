'use client';
import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {PlatformHeader} from '../components/platform-header';
import {COMPOSER_DRAFT_KEY} from '../lib/composer-draft';
import {sessionUserId} from '../lib/api';
import {useSiteText} from '../lib/site-content';

export default function Home(){
 const router=useRouter();
 const t=useSiteText();
 const examples=[t('home.example1'),t('home.example2'),t('home.example3')].filter(Boolean);
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
   <div className="v3-overline"><span className="v3-signal"/> {t('home.overline')}</div>
   <section className="v3-hero" aria-labelledby="v3-title">
    <div className="v3-hero-copy">
     <div className="v3-kicker">{t('home.kicker')}</div>
     <h1 id="v3-title">{t('home.title1')}<br/><span>{t('home.title2')}</span></h1>
     <p className="v3-lead">{t('home.lead')}</p>
     <div className="v3-proof"><span><b>01</b> {t('home.step1')}</span><i/><span><b>02</b> {t('home.step2')}</span><i/><span><b>03</b> {t('home.step3')}</span></div>
    </div>
    <div className="v3-hero-panel">
     <div className="v3-panel-top"><span className="v3-panel-mark">S<span>✦</span></span><span>{t('home.panel.title')}</span><span className="v3-live"><i/> {t('home.panel.badge')}</span></div>
     <form onSubmit={submit} className="v3-intent-form">
      <label htmlFor="v3-need">{t('home.form.label')}</label>
      <p>{t('home.form.hint')}</p>
      <textarea id="v3-need" required maxLength={4000} rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder={t('home.form.placeholder')}/>
      <div className="v3-intent-foot"><span>{text.length.toLocaleString('ar-EG')} / ٤٬٠٠٠</span><button type="submit" disabled={!hydrated||!text.trim()}>{t('home.form.button')} <span aria-hidden="true">←</span></button></div>
      {error&&<p role="alert" className="v3-error">{error}</p>}
     </form>
     <div className="v3-examples"><span>{t('home.examples.title')}</span>{examples.map(example=><button key={example} type="button" onClick={()=>setText(example)}>{example}<span aria-hidden="true">↗</span></button>)}</div>
    </div>
   </section>
   <section className="v3-approach" aria-label="ماذا تقدم سبتليون">
    <div><span className="v3-section-index">01 / DISCOVER</span><h2>{t('home.card1.title')}</h2><p>{t('home.card1.text')}</p><Link href="/discover">{t('home.card1.link')} <span>←</span></Link></div>
    <div><span className="v3-section-index">02 / DEFINE</span><h2>{t('home.card2.title')}</h2><p>{t('home.card2.text')}</p><Link href="/require">{t('home.card2.link')} <span>←</span></Link></div>
    <div><span className="v3-section-index">03 / EXECUTE</span><h2>{t('home.card3.title')}</h2><p>{t('home.card3.text')}</p><Link href="/my-septlion">{t('home.card3.link')} <span>←</span></Link></div>
   </section>
   <footer className="v3-home-footer"><span>SEPTLION</span><span>{t('home.footer1')}</span><span>{t('home.footer2')}</span></footer>
  </div>
 </main>;
}
