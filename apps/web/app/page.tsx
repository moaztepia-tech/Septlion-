'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Home(){
 const router=useRouter();
 const[recent,setRecent]=useState<any[]>([]);
 function start(seed:string){sessionStorage.setItem('septlion_requirement_seed',seed);router.push('/require')}
 useEffect(()=>{try{setRecent(JSON.parse(localStorage.getItem('septlion_draft_requests')||'[]').slice(0,3))}catch{}},[]);
 return <main className="product-home" dir="rtl">
  <header className="product-top"><a href="/" className="product-brand"><img src="/brand/septlion-primary-navy.png" alt="Septlion"/></a><nav><a className="active" href="/">الرئيسية</a><a href="/discover">اكتشف</a><a href="/requests">التجارة</a></nav><div><a className="product-muted" href="/notifications">التنبيهات</a><a className="product-account" href="/account">الحساب</a></div></header>
  <section className="product-hero">
   <div className="product-hero-copy"><small>SEPTLION</small><h1>ماذا تحتاج؟</h1><p>صف احتياجك التجاري بطريقتك. SEPTLION تحوّله إلى مسار قابل للتنفيذ.</p></div>
   <button className="home-composer" onClick={()=>router.push('/require')}><span>اكتب ما تحتاجه…</span><div><em>ابدأ بطريقتك</em><b>↑</b></div></button>
   <div className="home-starts"><span>ابدأ مثلًا:</span><button onClick={()=>start('5 حاويات دقيق مخابز إلى تنزانيا')}>5 حاويات دقيق مخابز إلى تنزانيا</button><button onClick={()=>start('أحتاج عبوة خاصة لمنتج غذائي')}>أحتاج عبوة خاصة لمنتج غذائي</button></div>
  </section>
  <section className="home-work">
   <div className="home-section-title"><div><small>YOUR TRADE</small><h2>{recent.length?'تابع من حيث توقفت':'ابدأ تجارتك مع SEPTLION'}</h2></div><a href="/requests">كل التجارة ←</a></div>
   {recent.length?<div className="home-recents">{recent.map((r:any,i)=><a href="/request" key={i}><small>{r.requirementId||'DRAFT REQUIREMENT'}</small><b>{r.product?.name||r.product?.nameEn||'طلب توريد'}</b><p>{r.containerCount?r.containerCount+' حاويات · ':''}{r.incoterm||''}{r.destination?.port?' · '+r.destination.port:''}</p><span>متابعة ←</span></a>)}</div>:<div className="home-empty"><div><b>طلب واحد. مسار واحد مسؤول.</b><p>ابدأ باحتياجك، وستبني SEPTLION المتطلبات والعرض والتنفيذ معك.</p></div><a href="/require">ابدأ طلبًا</a></div>}
  </section>
  <section className="home-discover"><div className="home-section-title"><div><small>DISCOVER</small><h2>أو ابدأ من منتج.</h2></div><a href="/discover">استكشف المنتجات ←</a></div><div className="home-categories"><a href="/discover"><span>01</span><b>الأغذية</b><small>دقيق · مكرونة · منتجات غذائية</small></a><a href="/discover"><span>02</span><b>التغليف</b><small>عبوات · أكياس · طباعة مخصصة</small></a><a href="/discover"><span>03</span><b>المواد الخام</b><small>منتجات منشأ وتوريد صناعي</small></a></div></section>
  <footer className="product-footer"><span>SEPTLION LLC</span><p>The operating system for demand-led global trade.</p></footer>
 </main>
}