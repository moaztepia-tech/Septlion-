'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import RfqForm from '../RfqForm';

type IntentPage={
 id:string;slug:string;title:string;productKey?:string|null;market:string;searchIntent:string;
 content?:{product?:string;quantity?:string|null;packing?:string|null;incoterm?:string|null;deadline?:string|null;cta?:string|null};
};

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://jfbmxowdmfdzyoauqgwn.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';

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

 if(page===undefined)return <main className="di"><div className="shell di-section"><p className="kicker">INTENT PAGE</p><h2>Loading demand route…</h2></div></main>;

 if(!page)return <main className="di">
  <header className="di-nav shell"><Link href="/" className="brand"><img src="/brand/septlion-primary-navy.png" alt="Septlion"/></Link><span>DEMAND ROUTE</span></header>
  <section className="di-hero shell"><p className="kicker">NOT PUBLISHED</p><h1>This demand route<br/><em>is not public.</em></h1><p>The requested intent page is unavailable or still under internal qualification.</p><div className="di-actions"><Link href="/intent/wheat-flour">Wheat Flour RFQ →</Link></div></section>
 </main>;

 const product=page.content?.product||page.title;

 return <main className="di">
  <header className="di-nav shell"><Link href="/" className="brand"><img src="/brand/septlion-primary-navy.png" alt="Septlion"/></Link><span>DEMAND ROUTE · {page.market}</span></header>

  <section className="di-hero shell">
   <p className="kicker">MARKET-SPECIFIC SUPPLY INTENT</p>
   <h1>{product}<br/><em>{page.market}</em></h1>
   <p>This supply route was created from recent public B2B buying signals. Submit your requirement to turn the route into a live Septlion RFQ.</p>
   <div className="di-actions"><a href="#live-rfq">Create live RFQ ↗</a><Link href="/demand-intelligence">Demand Intelligence →</Link></div>
  </section>

  <section className="di-section shell">
   <div className="di-head"><div><p className="kicker">REQUIREMENT STRUCTURE</p><h2>Built from demand, not catalogue inventory.</h2></div><p>{page.searchIntent}</p></div>
   <div className="di-cards">
    <article><small>MARKET</small><h3>{page.market}</h3><p>Destination-specific route generated from the Demand Intelligence pipeline.</p><b>{page.productKey||'commercial supply'}</b></article>
    <article><small>VOLUME SIGNAL</small><h3>{page.content?.quantity||'Buyer-defined'}</h3><p>Final commercial scale is confirmed from the buyer's submitted requirement.</p><b>Qualification before quotation</b></article>
    <article><small>DELIVERY STRUCTURE</small><h3>{page.content?.incoterm||'FOB / CFR / CIF'}</h3><p>{page.content?.packing?'Packing signal: '+page.content.packing:'Packing configured by requirement.'}</p><b>{page.content?.deadline?'Demand deadline: '+page.content.deadline.slice(0,10):'Delivery window required'}</b></article>
   </div>
  </section>

  <section className="di-section ir-section" id="live-rfq">
   <div className="shell">
    <div className="di-head"><div><p className="kicker">LIVE RFQ</p><h2>Enter the Septlion execution pipeline.</h2></div><p>Your submitted requirement becomes a new RFQ signal linked back to this demand route and appears in the internal operator workbench.</p></div>
    <RfqForm intentSlug={page.slug} product={product} market={page.market}/>
   </div>
  </section>
 </main>
}
