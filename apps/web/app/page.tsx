'use client';
import {FormEvent, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {PlatformHeader, PlatformIcon} from '../components/platform-header';
import {catalogPreview} from '../lib/catalog-preview';
import {getSeptlionScale, scaleProgress} from '../lib/septlion-scale';

const ports = [
  ['Jeddah Islamic Port','جدة — السعودية'],
  ['Dar es Salaam','دار السلام — تنزانيا'],
  ['Mombasa','مومباسا — كينيا'],
  ['Jebel Ali','جبل علي — الإمارات'],
  ['Port Sudan','بورتسودان — السودان'],
  ['Tema','تيما — غانا'],
  ['Lagos / Apapa','لاغوس — نيجيريا'],
];

export default function Home() {
  const router = useRouter();
  const [text,setText] = useState('');
  const [destination,setDestination] = useState('');
  const [incoterm,setIncoterm] = useState('CIF');
  const [payment,setPayment] = useState('L/C');
  const [count,setCount] = useState(1);
  const [recent,setRecent] = useState<any[]>([]);
  useEffect(() => {try {setRecent(JSON.parse(localStorage.getItem('septlion_draft_requests') || '[]').slice(0,3));} catch {}}, []);
  const safeCount = (value: number) => setCount(Math.max(1,Math.floor(Number.isFinite(value) ? value : 1)));
  function start(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const context = {quantity:count + ' FCL',incoterm,payment,...(destination ? {destination} : {})};
    sessionStorage.removeItem('septlion_feed_context');
    sessionStorage.removeItem('septlion_pending_requirement');
    sessionStorage.setItem('septlion_requirement_context',JSON.stringify(context));
    sessionStorage.setItem('septlion_requirement_seed',text.trim());
    router.push('/require');
  }
  function continueDraft(draft: any) {
    sessionStorage.removeItem('septlion_requirement_seed');
    sessionStorage.removeItem('septlion_requirement_context');
    sessionStorage.setItem('septlion_feed_context',JSON.stringify(draft));
  }
  return <main className="product-home" dir="rtl">
    <PlatformHeader/>
    <section className="product-hero" aria-labelledby="home-title">
      <div className="product-hero-copy"><small>FROM DEMAND TO TRADE</small><h1 id="home-title">ماذا تحتاج؟</h1><p>ابدأ باحتياجك. سنرتّب المواصفة والتوريد والخطوة التالية معك.</p></div>
      <form className="home-composer-panel" onSubmit={start}>
        <div className="home-commercial-fields">
          <label><span>الوجهة</span><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">حدّد دولة أو ميناء</option>{ports.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>شرط التجارة</span><select value={incoterm} onChange={e=>setIncoterm(e.target.value)}>{['CIF','CFR','FOB'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label><span>طريقة الدفع</span><select value={payment} onChange={e=>setPayment(e.target.value)}><option value="L/C">L/C — اعتماد مستندي</option><option value="T/T">T/T — تحويل بنكي</option><option value="OTHER">تُناقش في العرض</option></select></label>
          <div className="home-volume"><div className="home-volume-label"><span>عدد الحاويات</span><small>{getSeptlionScale(count)}</small></div><div className="home-scale" aria-hidden="true"><i style={{insetInlineStart:`calc(${scaleProgress(count)}% - 5px)`}}/></div><div className="home-volume-counter"><button type="button" aria-label="تقليل عدد الحاويات" onClick={()=>safeCount(count-1)}>−</button><input aria-label="عدد الحاويات" type="number" min="1" step="1" value={count} onChange={e=>safeCount(Number(e.target.value))}/><button type="button" aria-label="زيادة عدد الحاويات" onClick={()=>safeCount(count+1)}>+</button></div></div>
        </div>
        <label className="home-compose-input"><span className="sr-only">احتياجك التجاري</span><textarea required value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب المنتج والمواصفة التي تحتاجها…" rows={2}/></label>
        <div className="home-composer-actions"><span>يمكنك البدء بالمعلومات المتاحة لديك.</span><button className="primary-link" type="submit">ابدأ طلب التوريد <PlatformIcon name="arrow"/></button></div>
      </form>
      <div className="home-starts"><span>ابدأ مثلًا:</span><button onClick={()=>setText('أحتاج 5 حاويات دقيق مخابز بتعبئة 50 كجم إلى تنزانيا')}>دقيق مخابز إلى تنزانيا</button><button onClick={()=>setText('أحتاج عبوة خاصة لمنتج غذائي')}>تغليف لمنتج غذائي</button></div>
    </section>
    <section className="home-discover" aria-labelledby="feed-title">
      <div className="home-section-title"><div><small>منتجات يمكن تكوين طلبك منها</small><h2 id="feed-title">لأجلك</h2></div><a href="/discover">اكتشف المنتجات ←</a></div>
      <div className="home-feed">{catalogPreview.map((product,index)=><a className="home-product-card" href="/discover" key={product.id} onClick={()=>sessionStorage.setItem('septlion_discover_product',String(index))}><small>{product.eyebrow}</small><h3>{product.name}</h3><p>{product.en}</p><dl><div><dt>التعبئة</dt><dd>{product.pack}</dd></div><div><dt>الشروط</dt><dd>تُثبت في العرض</dd></div></dl><span>كوّن طلب التوريد <PlatformIcon name="arrow"/></span></a>)}</div>
    </section>
    <section className="home-work" aria-labelledby="trade-title">
      <div className="home-section-title"><div><small>مساحة تجارتك</small><h2 id="trade-title">{recent.length ? 'تابع مسوداتك' : 'كل طلب في مكانه'}</h2></div><a href="/requests">كل الطلبات ←</a></div>
      {recent.length ? <div className="home-recents">{recent.map((draft,index)=><a href="/require" onClick={()=>continueDraft(draft)} key={index}><small>مسودة طلب</small><b>{draft.product?.name || draft.product?.nameEn || 'طلب توريد'}</b><p>{draft.containerCount || 1} حاويات · {draft.incoterm || 'CIF'}{draft.destination?.port ? ' · ' + draft.destination.port : ''}</p><span>متابعة الطلب ←</span></a>)}</div> : <div className="home-empty"><div><b>من الطلب إلى العرض والتنفيذ.</b><p>تابع حالة طلبك ومستنداته والخطوة التالية من مساحة التجارة.</p></div><a className="secondary-link" href="/requests">افتح مساحة التجارة</a></div>}
    </section>
    <footer className="product-footer"><span>SEPTLION LLC</span><p>أتقن الخطوات، قصّر المسافات.</p></footer>
  </main>;
}
