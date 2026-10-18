'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Link from 'next/link';
import {PlatformHeader} from '../../components/platform-header';
import {catalogPreview} from '../../lib/catalog-preview';

const sectors=['الكل','الأغذية والمشروبات','التغليف','البناء والتشييد','الطاقة','المنسوجات','المعدات والآلات'];
export default function DiscoverPage(){
 const router=useRouter();
 const [sector,setSector]=useState('الكل');
 const [search,setSearch]=useState('');
 const food=sector==='الكل'||sector==='الأغذية والمشروبات';
 const products=food?catalogPreview.filter(p=>(p.name+' '+p.en+' '+p.pack).toLowerCase().includes(search.trim().toLowerCase())):[];
 function select(id:string){try{sessionStorage.setItem('septlion_selected_product',id);}catch{}router.push('/prepare?product='+encodeURIComponent(id));}
 return <main dir="rtl" className="v3-discover">
  <PlatformHeader/>
  <div className="v3-discover-shell">
   <div className="v3-breadcrumb"><Link href="/">الرئيسية</Link><span>/</span><strong>اكتشف</strong></div>
   <header className="v3-discover-head"><div><span className="v3-section-index">SEPTLION / DISCOVER</span><h1>اكتشف فرص التوريد</h1><p>منتجات محددة بوضوح. وطلباتك لا تتوقف عند حدود المعروض.</p></div><Link className="v3-discover-cta" href="/require">لدي احتياج مختلف <span>←</span></Link></header>
   <div className="v3-discover-toolbar"><div className="v3-search-field"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="v3-search">البحث في المنتجات</label><input id="v3-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن منتج أو تعبئة…"/></div><span className="v3-result-count">{products.length} منتجات معروضة</span></div>
   <nav className="v3-sectors" aria-label="القطاعات">{sectors.map(s=><button key={s} type="button" className={sector===s?'active':''} aria-pressed={sector===s} onClick={()=>setSector(s)}>{s}</button>)}</nav>
   <section className="v3-catalog" aria-label="كتالوج المنتجات">
    {products.map((p,i)=><article className="v3-product" key={p.id}>
     <div className="v3-product-art"><span className="v3-product-category">ZOLLANA / FLOUR</span><div className="v3-pack-visual" aria-hidden="true"><span className="v3-pack-brand">ZOLLANA</span><span className="v3-pack-line"/><strong>{p.name}</strong><small>{p.en}</small><span className="v3-pack-footer">FLOUR COLLECTION</span></div><span className="v3-art-disclaimer">تصور بصري توضيحي، وليس صورة عبوة معتمدة</span></div>
     <div className="v3-product-body"><div className="v3-product-meta"><span>منتجات زولانا</span><span>0{i+1} / 03</span></div><h2>{p.name}</h2><p className="v3-product-en">{p.en}</p><div className="v3-product-spec"><span>خيارات التعبئة</span><strong>{p.pack}</strong></div><p className="v3-product-note">{p.note}</p><button type="button" onClick={()=>select(p.id)}>ابدأ طلب هذا المنتج <span>←</span></button></div>
    </article>)}
   </section>
   {!products.length&&<div className="v3-no-results"><span>لا توجد نتائج مطابقة في الكتالوج المعروض</span><h2>احتياجك لا يتوقف هنا.</h2><p>قدّم طلبك وسنعمل على دراسة إمكانات تلبيته دون الوعد بتوفر غير مؤكد.</p><Link href="/require">صف احتياجك <span>←</span></Link></div>}
   <aside className="v3-custom-request"><div><span className="v3-section-index">BEYOND THE CATALOG</span><h2>لم تجد ما تبحث عنه؟</h2><p>أخبرنا بالمنتج أو الخدمة أو المواصفات المطلوبة. نقطة البداية هي احتياجك، وليس ما يظهر في الكتالوج.</p></div><Link href="/require">قدّم طلب توريد <span>←</span></Link></aside>
  </div>
 </main>;
}