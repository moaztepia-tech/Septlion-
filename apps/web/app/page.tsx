'use client';
import {DesignField, DesignLink, DesignButton, DesignLayers} from "../components/design-system";
import {FormEvent, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {PlatformHeader, PlatformIcon} from '../components/platform-header';
import {COMPOSER_DRAFT_KEY, restoreComposerDraft} from '../lib/composer-draft';
import {sessionUserId} from '../lib/api';
import {getSeptlionScale, scaleProgress} from '../lib/septlion-scale';
import {catalogPreview} from '../lib/catalog-preview';

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
  const [homeReady,setHomeReady] = useState(false);
  const [startError,setStartError] = useState('');
  useEffect(() => {
    try {
      const saved=JSON.parse(sessionStorage.getItem('septlion_home_draft') || 'null');
      if (saved && (!saved.ownerId || saved.ownerId===sessionUserId())) {
        if (typeof saved.text==='string') setText(saved.text);
        if (typeof saved.destination==='string') setDestination(saved.destination);
        if (['CIF','CFR','FOB'].includes(saved.incoterm)) setIncoterm(saved.incoterm);
        if (['L/C','T/T','OTHER'].includes(saved.payment)) setPayment(saved.payment);
        if (Number.isInteger(saved.count)&&saved.count>0&&saved.count<=1000000000) setCount(saved.count);
      }
      const draft=restoreComposerDraft(sessionStorage.getItem(COMPOSER_DRAFT_KEY),sessionUserId());
      setRecent(draft && Object.keys(draft.data).length ? [draft] : []);
    } catch {}
    setHomeReady(true);
  }, []);
  useEffect(() => {if(homeReady){try{sessionStorage.setItem('septlion_home_draft',JSON.stringify({text,destination,incoterm,payment,count,ownerId:sessionUserId()}));}catch{}}},[text,destination,incoterm,payment,count,homeReady]);
  const safeCount = (value: number) => setCount(Math.min(1000000000,Math.max(1,Math.floor(Number.isFinite(value) ? value : 1))));
  function start(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const context = {quantity:count + ' FCL',incoterm,payment,...(destination ? {destination} : {})};
    try {
    sessionStorage.removeItem('septlion_home_draft');
    sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
    sessionStorage.removeItem('septlion_feed_context');
    sessionStorage.removeItem('septlion_pending_requirement');
    sessionStorage.setItem('septlion_requirement_context',JSON.stringify(context));
    sessionStorage.setItem('septlion_requirement_seed',text.trim());
    router.push('/require');
    } catch {setStartError('تعذر حفظ احتياجك على هذا الجهاز. بياناتك ما زالت في النموذج.');}
  }
  return <main className="product-home" dir="rtl">
    <PlatformHeader/>
    <section className="product-hero" aria-labelledby="home-title">
      <div className="product-hero-copy"><small>من احتياجك إلى التوريد</small><h1 id="home-title">ماذا تحتاج؟</h1><p>صف احتياجك. سنرتّب المواصفة والتوريد والخطوة التالية معك.</p><ol className="home-journey" aria-label="رحلة التوريد"><li><div><b>حدّد احتياجك</b><p>المنتج، الكمية والوجهة، في طلب واحد.</p></div></li><li><div><b>راجع عرض Septlion</b><p>السعر والمواصفة وشروط التوريد قبل الاتفاق.</p></div></li><li><div><b>تابع التنفيذ</b><p>مراحل الصفقة ومستنداتها حتى الاستلام.</p></div></li></ol></div>
      <form className="home-composer-panel layer-4" onSubmit={start}><DesignLayers sheen/><div className="card-content">
        <div className="home-commercial-fields">
          <label><span>الوجهة</span><DesignField><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">حدّد دولة أو ميناء</option>{ports.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></DesignField></label>
          <label><span>شرط التجارة</span><DesignField><select value={incoterm} onChange={e=>setIncoterm(e.target.value)}>{['CIF','CFR','FOB'].map(x=><option key={x}>{x}</option>)}</select></DesignField></label>
          <label><span>طريقة الدفع</span><DesignField><select value={payment} onChange={e=>setPayment(e.target.value)}><option value="L/C">L/C — اعتماد مستندي</option><option value="T/T">T/T — تحويل بنكي</option><option value="OTHER">تُناقش في العرض</option></select></DesignField></label>
          <div className="home-volume"><div className="home-volume-label"><span>عدد الحاويات</span><small dir="ltr">{getSeptlionScale(count)}</small></div><div className="home-scale" dir="ltr" aria-hidden="true"><i style={{insetInlineStart:`calc(${scaleProgress(count)}% - 5px)`}}/></div><div className="home-volume-counter"><DesignButton type="button" disabled={count===1} aria-label="تقليل عدد الحاويات" onClick={()=>safeCount(count-1)}>−</DesignButton><input aria-label="عدد الحاويات" type="number" inputMode="numeric" min="1" max="1000000000" step="1" value={count} onChange={e=>safeCount(Number(e.target.value))}/><DesignButton type="button" disabled={count>=1000000000} aria-label="زيادة عدد الحاويات" onClick={()=>safeCount(count+1)}>+</DesignButton></div></div>
        </div>
        <label className="home-compose-input"><span>احتياجك التجاري</span><DesignField multiline><textarea required value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب المنتج والمواصفة التي تحتاجها…" rows={2} maxLength={4000}/></DesignField></label>
        {startError&&<p role="alert" className="workspace-error">{startError}</p>}
        <div className="home-composer-actions"><span>يمكنك البدء بالمعلومات المتاحة لديك.</span><DesignButton className="primary-link" type="submit">ابدأ طلب التوريد <PlatformIcon name="arrow"/></DesignButton></div>
      </div></form>
      <div className="home-starts"><span>ابدأ مثلًا:</span><DesignButton onClick={()=>setText('أحتاج 5 حاويات دقيق مخابز بتعبئة 50 كجم إلى تنزانيا')}>دقيق مخابز إلى تنزانيا</DesignButton><DesignButton onClick={()=>setText('أحتاج عبوة خاصة لمنتج غذائي')}>تغليف لمنتج غذائي</DesignButton></div>
    </section>
    <section className="home-discover" aria-labelledby="discover-title">
      <div className="home-section-title"><div><small>لأجلك · منتجات زولانا</small><h2 id="discover-title">تفضّل البدء من منتج؟</h2></div><a href="/discover">اكتشف المنتجات ←</a></div><div className="home-feed">{catalogPreview.map(product=><a className="home-catalog-card" key={product.id} href={'/product?id='+encodeURIComponent(product.id)}><small>ZOLLANA · FLOUR</small><div><h3>{product.name}</h3><p lang="en" dir="ltr">{product.en}</p></div><span>{product.pack}</span><i>تفاصيل المنتج ←</i></a>)}</div>
    </section>
    <section className="home-work" aria-labelledby="trade-title">
      <div className="home-section-title"><div><small>مساحة تجارتك</small><h2 id="trade-title">{recent.length ? 'تابع مسوداتك' : 'كل طلب في مكانه'}</h2></div><a href="/requests">كل الطلبات ←</a></div>
      {recent.length ? <div className="home-recents">{recent.map((draft,index)=><a href={draft.savedRequirementId ? '/request?id='+encodeURIComponent(draft.savedRequirementId) : '/require'} key={index}><small>{draft.savedRequirementId ? 'طلب أُرسل' : 'مسودة محفوظة في هذا التبويب'}</small><b>{draft.feed?.product.name || draft.data.product || 'طلب توريد'}</b><p>{draft.data.quantity || 'الكمية تُحدد'} · {draft.data.incoterm || 'الشروط تُحدد'}{draft.data.destination ? ' · ' + draft.data.destination : ''}</p><span>متابعة الطلب ←</span></a>)}</div> : <div className="home-empty"><div><b>من الطلب إلى العرض والتنفيذ.</b><p>تابع حالة طلبك ومستنداته والخطوة التالية من «مساحتي».</p></div><DesignLink className="secondary-link" href="/my-septlion">افتح مساحتي</DesignLink></div>}
    </section>
    <footer className="product-footer"><span>SEPTLION LLC</span><p>أتقن الخطوات، قصّر المسافات.</p></footer>
  </main>;
}
