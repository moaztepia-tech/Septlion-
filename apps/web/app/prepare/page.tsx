'use client';
import {Suspense,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {catalogPreview} from '../../lib/catalog-preview';
import {COMPOSER_DRAFT_KEY,draftFromFeed} from '../../lib/composer-draft';
import {sessionUserId} from '../../lib/api';
import {PlatformHeader} from '../../components/platform-header';
import {getSeptlionScale} from '../../lib/septlion-scale';

function PrepareContent(){
 const router=useRouter(),params=useSearchParams();
 const id=params.get('product');
 const product=catalogPreview.find(p=>p.id===id);
 const [destination,setDestination]=useState('');
 const [incoterm,setIncoterm]=useState('CIF');
 const [payment,setPayment]=useState('L/C');
 const [count,setCount]=useState(1);
 const [containerSize,setContainerSize]=useState<'20'|'40'>('40');
 const [error,setError]=useState('');
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{setHydrated(false);setDestination('');setIncoterm('CIF');setPayment('L/C');setCount(1);setContainerSize('40');setError('');try{const raw=sessionStorage.getItem('septlion_order_preparation');if(!raw)return;const s=JSON.parse(raw);if(s.productId!==id)return;setDestination(typeof s.destination==='string'?s.destination.slice(0,120):'');setIncoterm(['CIF','CFR','FOB'].includes(s.incoterm)?s.incoterm:'CIF');setPayment(['L/C','T/T','OTHER'].includes(s.payment)?s.payment:'L/C');setCount(Number.isInteger(s.count)&&s.count>0?Math.min(1000000000,s.count):1);setContainerSize(s.containerSize==='20'?'20':'40');}catch{}finally{setHydrated(true)}},[id]);
 function next(){
  if(!product||!hydrated)return;
  if(!destination.trim()){setError('حدد بلد الوجهة أولًا.');return;}
  if(!Number.isInteger(count)||count<1||count>1000000000){setError('راجع عدد الحاويات.');return;}
  if(!['CIF','CFR','FOB'].includes(incoterm)||!['L/C','T/T','OTHER'].includes(payment)){setError('راجع شروط التسليم والدفع.');return;}
  const context={
   version:1,source:'product_feed' as const,createdAt:new Date().toISOString(),
   product:{id:product.id,name:product.name,nameEn:product.en,packing:product.pack},
   containerCount:count,containerSize,septlionScale:getSeptlionScale(count),incoterm,
   destination:{port:'',country:destination.trim(),code:''},
   paymentPreference:payment,
   buyer:{name:'',company:'',whatsapp:'',email:null,whatsappStatus:'UNCONFIRMED'}
  };
  try{
   sessionStorage.removeItem('septlion_requirement_seed');
   sessionStorage.removeItem('septlion_requirement_context');
   sessionStorage.removeItem('septlion_pending_requirement');
   sessionStorage.setItem('septlion_order_preparation',JSON.stringify({productId:id,destination,incoterm,payment,count,containerSize}));
   sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify({...draftFromFeed(context,crypto.randomUUID()),ownerId:sessionUserId()}));
   sessionStorage.setItem('septlion_feed_context',JSON.stringify(context));
   router.push('/require?source=feed');
  }catch{setError('تعذر حفظ الاختيار. تحقق من إعدادات المتصفح ثم حاول مجددًا.');}
 }
 if(!product)return <main dir="rtl"><PlatformHeader/><section className="approved-empty"><h1>المنتج غير متاح</h1><a href="/discover">العودة إلى اكتشف</a></section></main>;
 return <main dir="rtl" className="v3-prepare"><PlatformHeader/><div className="v3-prepare-shell">
  <nav className="v3-breadcrumb" aria-label="مسار الصفحة"><a href="/discover">اكتشف</a><span>/</span><strong>{product.name}</strong></nav>
  <header className="v3-prepare-heading"><span className="v3-section-index">SEPTLION / PRODUCT REQUEST</span><h1>لنجهّز طلبك</h1><p>اختر تفضيلاتك الأولية. سنساعدك على استكمال التفاصيل في محرّر الطلب الذكي.</p></header>
  <div className="v3-prepare-grid">
   <aside className="v3-prepare-summary"><div className="v3-prepare-art"><div className="v3-pack-visual" aria-hidden="true"><span className="v3-pack-brand">ZOLLANA</span><span className="v3-pack-line"/><strong>{product.name}</strong><small>{product.en}</small><span className="v3-pack-footer">FLOUR COLLECTION</span></div><span className="v3-art-disclaimer">تصور توضيحي وليس صورة العبوة المعتمدة</span></div><div className="v3-prepare-product"><span>المنتج المختار</span><h2>{product.name}</h2><p>{product.en}</p><dl><div><dt>التعبئة</dt><dd>{product.pack}</dd></div><div><dt>المواصفة</dt><dd>{product.note}</dd></div></dl></div></aside>
   <section className="v3-prepare-form" aria-label="تفضيلات الطلب"><div className="v3-form-top"><span>01 / 02</span><h2>تفاصيل التوريد</h2><p>هذه تفضيلات أولية وليست شروطًا نهائية أو عرض سعر.</p></div>
    <div className="v3-form-fields"><label>بلد الوجهة <span>مطلوب</span><input value={destination} onChange={e=>{setDestination(e.target.value);setError('');}} placeholder="مثال: تنزانيا" maxLength={120}/></label>
     <div className="v3-form-pair"><label>شرط التسليم<select value={incoterm} onChange={e=>setIncoterm(e.target.value)}><option>CIF</option><option>CFR</option><option>FOB</option></select></label><label>طريقة الدفع<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="L/C">L/C — اعتماد مستندي</option><option value="T/T">T/T — تحويل بنكي</option><option value="OTHER">تُناقش في العرض</option></select></label></div>
     <fieldset className="v3-container-field"><legend>الحاويات</legend><div className="v3-quantity"><span>العدد</span><div><button type="button" aria-label="تقليل العدد" disabled={count===1} onClick={()=>setCount(c=>Math.max(1,c-1))}>−</button><input aria-label="عدد الحاويات" type="number" min="1" max="1000000000" value={count} onChange={e=>setCount(Math.min(1000000000,Math.max(1,Math.floor(Number(e.target.value)||1))))}/><button type="button" aria-label="زيادة العدد" onClick={()=>setCount(c=>Math.min(1000000000,c+1))}>+</button></div></div><div className="v3-container-sizes"><span>المقاس المفضل</span><div><button type="button" aria-pressed={containerSize==='20'} onClick={()=>setContainerSize('20')}>20 قدم</button><button type="button" aria-pressed={containerSize==='40'} onClick={()=>setContainerSize('40')}>40 قدم</button></div></div><p>يُراجع المقاس النهائي وفق المنتج والوجهة.</p></fieldset>
    </div>{error&&<p role="alert" className="v3-form-error">{error}</p>}
    <div className="v3-form-actions"><span>التالي: محرّر الطلب الذكي</span><button type="button" disabled={!hydrated} onClick={next}>متابعة إلى طلبك <span>←</span></button></div>
   </section>
  </div></div></main>;
}

export default function PreparePage(){return <Suspense fallback={<main dir="rtl"><PlatformHeader/><p>جارٍ تحميل المنتج…</p></main>}><PrepareContent/></Suspense>;}
