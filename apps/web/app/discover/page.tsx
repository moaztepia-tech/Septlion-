'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {PlatformHeader} from '../../components/platform-header';
import {catalogPreview} from '../../lib/catalog-preview';
import {DesignButton} from '../../components/design-system';

const sectors=['الكل','الأغذية والمشروبات','التغليف','البناء والتشييد','الطاقة','المنسوجات','المعدات والآلات'];
export default function DiscoverPage(){
 const router=useRouter();
 const [sector,setSector]=useState('الكل');
 const [search,setSearch]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const food=sector==='الكل'||sector==='الأغذية والمشروبات';
 const products=food?catalogPreview.filter(p=>(p.name+' '+p.en).toLowerCase().includes(search.trim().toLowerCase())):[];
 function select(id:string){
   try {sessionStorage.setItem('septlion_selected_product',id);router.push('/prepare?product='+encodeURIComponent(id));}
   catch {router.push('/prepare?product='+encodeURIComponent(id));}
 }
 return <main dir="rtl" className="approved-discover">
  <PlatformHeader/>
  <div className="approved-discover-inner">
   <div className="approved-discover-tools">
    <div className="approved-sector-row" aria-label="القطاعات">{sectors.map(s=><button key={s} type="button" className={s===sector?'active':''} aria-pressed={s===sector} onClick={()=>setSector(s)}>{s}</button>)}</div>
    <button type="button" className="approved-search-trigger" aria-label="بحث" onClick={()=>setSearchOpen(v=>!v)}>⌕</button>
   </div>
   {searchOpen&&<label className="approved-search"><span className="sr-only">ابحث عن منتج</span><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن منتج…"/></label>}
   <section className="approved-feed" aria-label="المنتجات">
    {products.map(p=><article className="approved-product" key={p.id}>
      <div className="approved-media" aria-label={'صور '+p.name}>
       <div className="approved-bag" aria-hidden="true"><small>ZOLLANA</small><strong>{p.name}</strong><span>{p.en}</span><em>{p.pack}</em></div>
       <span className="approved-media-notice">صورة توضيحية مؤقتة — ليست صورة المنتج الفعلية</span>
      </div>
      <div className="approved-product-info"><small>{p.eyebrow}</small><h2>{p.name}</h2><p>{p.en}</p><dl><div><dt>التعبئة</dt><dd>{p.pack}</dd></div><div><dt>المواصفة</dt><dd>{p.note}</dd></div></dl><DesignButton className="approved-order" onClick={()=>select(p.id)}>اطلب هذا المنتج</DesignButton></div>
    </article>)}
    {!products.length&&<div className="approved-empty"><p>لا توجد منتجات معروضة لهذه الفئة حاليًا.</p><a href="/require">صف احتياجك وسنتولى البحث عنه ←</a></div>}
   </section>
  </div>
 </main>;
}
