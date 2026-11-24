'use client';

import {useEffect,useState} from 'react';
import QuoteSheet,{marketAr,productAr} from '../QuoteSheet';
import '../quote-sheet.css';

type IntentPage={
 id:string;slug:string;title:string;productKey?:string|null;market:string;searchIntent:string;
 content?:{product?:string;quantity?:string|null;packing?:string|null;incoterm?:string|null;deadline?:string|null;cta?:string|null};
};

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://jfbmxowdmfdzyoauqgwn.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';

function Top(){
 return <header className="qs-top" dir="rtl"><a href="/" aria-label="سبتليون — الرئيسية"><img src="/brand/septlion-header-white.png" alt="SEPTLION"/></a><a href="/">الرئيسية ←</a></header>;
}

export default function DemandIntentPage(){
 const [page,setPage]=useState<IntentPage|null|undefined>(undefined);

 useEffect(()=>{
  const slug=new URLSearchParams(window.location.search).get('slug')||'';
  if(!slug){setPage(null);return}
  const url=SUPABASE_URL+'/rest/v1/PublicDemandIntentPage?select=id,slug,title,productKey,market,searchIntent,content&slug=eq.'+encodeURIComponent(slug)+'&limit=1';
  fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
   .then(r=>r.ok?r.json():[])
   .then(rows=>setPage(rows?.[0]||null))
   .catch(()=>setPage(null));
 },[]);

 // A page that is no longer public still takes the request, as a general wheat flour request.
 const product=page?.content?.product||page?.title||'Wheat Flour';
 const slug=page?.slug||'wheat-flour';

 return <main className="qs-page" dir="rtl">
  <Top/>
  {page===undefined?<p className="qs-intro">جارٍ التحميل…</p>:<>
   <div className="qs-intro">
    <h1>{productAr(product)}{page?.market?' إلى '+marketAr(page.market):''}</h1>
    <p style={{margin:0}}>هناك طلب حالي على هذا الصنف في {page?.market?marketAr(page.market):'السوق'}. حدد الكمية والوجهة والشروط، ونرد عليك بعرض سعر واحد واضح.</p>
   </div>
   <div id="live-rfq"><QuoteSheet intentSlug={slug} product={product} market={page?.market}/></div>
  </>}
 </main>;
}
