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
 useEffect(()=>{try{const raw=sessionStorage.getItem('septlion_order_preparation');if(!raw)return;const s=JSON.parse(raw);if(s.productId!==id)return;setDestination(typeof s.destination==='string'?s.destination.slice(0,120):'');setIncoterm(['CIF','CFR','FOB'].includes(s.incoterm)?s.incoterm:'CIF');setPayment(['L/C','T/T','OTHER'].includes(s.payment)?s.payment:'L/C');setCount(Number.isInteger(s.count)&&s.count>0?Math.min(1000000000,s.count):1);setContainerSize(s.containerSize==='20'?'20':'40');}catch{}},[id]);
 function next(){
  if(!product)return;
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
 return <main dir="rtl" className="approved-prepare"><PlatformHeader/><div className="approved-prepare-inner">
  <div className="approved-prepare-media"><div className="approved-bag"><small>ZOLLANA</small><strong>{product.name}</strong><span>{product.en}</span><em>{product.pack}</em></div></div>
  <div className="approved-prepare-content"><h1>{product.name}</h1><p>{product.pack}</p>
   <label>بلد الوجهة<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="مثال: السعودية" maxLength={120}/></label>
   <label>شرط التسليم<select value={incoterm} onChange={e=>setIncoterm(e.target.value)}><option>CIF</option><option>CFR</option><option>FOB</option></select></label>
   <label>طريقة الدفع<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="L/C">L/C — اعتماد مستندي</option><option value="T/T">T/T — تحويل بنكي</option><option value="OTHER">تُناقش في العرض</option></select></label>
   <div className="approved-container-size" role="group" aria-label="مقاس الحاوية"><span>مقاس الحاوية</span><div><button type="button" aria-pressed={containerSize==='20'} onClick={()=>setContainerSize('20')}>20 قدم</button><button type="button" aria-pressed={containerSize==='40'} onClick={()=>setContainerSize('40')}>40 قدم</button></div></div>
   <div className="approved-quantity"><span>عدد الحاويات</span><div><button type="button" aria-label="تقليل" disabled={count===1} onClick={()=>setCount(c=>Math.max(1,c-1))}>−</button><input aria-label="عدد الحاويات" type="number" min="1" max="1000000000" value={count} onChange={e=>setCount(Math.min(1000000000,Math.max(1,Math.floor(Number(e.target.value)||1))))}/><button type="button" aria-label="زيادة" onClick={()=>setCount(c=>Math.min(1000000000,c+1))}>+</button></div></div>
   <p className="approved-container-hint">مقاس الحاوية تفضيل أولي؛ يُراجع أثناء إعداد العرض.</p>
   {error&&<p role="alert" className="workspace-error">{error}</p>}
   <button type="button" className="approved-next" onClick={next}>متابعة</button>
  </div>
 </div></main>;
}

export default function PreparePage(){return <Suspense fallback={<main dir="rtl"><PlatformHeader/><p>جارٍ تحميل المنتج…</p></main>}><PrepareContent/></Suspense>;}
