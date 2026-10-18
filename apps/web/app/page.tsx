'use client';
import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {PlatformHeader} from '../components/platform-header';
import {COMPOSER_DRAFT_KEY} from '../lib/composer-draft';
import {sessionUserId} from '../lib/api';

export default function Home(){
 const router=useRouter();
 const [text,setText]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{try{const raw=sessionStorage.getItem('septlion_home_draft');if(raw){const d=JSON.parse(raw);if(!d.ownerId||d.ownerId===sessionUserId())setText(d.text||'');}}catch{}},[]);
 useEffect(()=>{try{sessionStorage.setItem('septlion_home_draft',JSON.stringify({text,ownerId:sessionUserId()}));}catch{}},[text]);
 function submit(e:FormEvent){e.preventDefault();if(!text.trim())return;try{
  sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
  sessionStorage.removeItem('septlion_feed_context');
  sessionStorage.removeItem('septlion_pending_requirement');
  sessionStorage.removeItem('septlion_requirement_context');
  sessionStorage.setItem('septlion_requirement_seed',text.trim());
  router.push('/require');
 }catch{setError('تعذر حفظ الطلب على هذا الجهاز. احتياجك لا يزال ظاهرًا هنا.');}}
 return <main dir="rtl" className="approved-home"><PlatformHeader/>
  <section className="approved-home-hero">
   <div className="approved-home-visual" aria-hidden="true"><span>SEPTLION</span><div className="approved-port-silhouette"><i/><i/><i/></div></div>
   <div className="approved-home-content"><small>MASTER STEPS, SHORTEN DISTANCES</small><h1>ماذا تحتاج؟</h1><p>صف احتياجك، وسنتولى الباقي.</p>
    <form onSubmit={submit}><label className="sr-only" htmlFor="home-need">احتياجك التجاري</label><textarea id="home-need" required maxLength={4000} rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="أخبرنا بما تحتاجه من منتج أو توريد أو تصنيع…"/>
     {error&&<p role="alert">{error}</p>}<button type="submit" className="approved-next">متابعة ←</button>
    </form><a href="/discover" className="approved-explore">استكشف القطاعات ←</a>
   </div>
  </section>
 </main>;
}