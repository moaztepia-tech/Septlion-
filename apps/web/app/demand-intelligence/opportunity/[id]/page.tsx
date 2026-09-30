import Link from 'next/link';
import {notFound} from 'next/navigation';
import {demandSignals} from '../../signals';

export function generateStaticParams(){return demandSignals.map(s=>({id:s.id}))}

export default function OpportunityPage({params}:{params:{id:string}}){
 const s=demandSignals.find(x=>x.id===params.id);
 if(!s) notFound();
 const query=encodeURIComponent(s.product+' '+s.market+' '+s.quantity);
 return <main className="di">
  <header className="di-nav shell"><Link href="/demand-intelligence">← Demand Radar</Link><strong>SEPTLION · OPPORTUNITY BRIEF</strong></header>
  <section className="di-section shell">
   <p className="kicker">{s.type} · {s.published}</p>
   <h1 style={{fontSize:'clamp(48px,7vw,88px)',letterSpacing:'-.055em',margin:'18px 0'}}>{s.product}</h1>
   <p className="lead">{s.market} · {s.quantity}</p>
   <div className="di-cards" style={{marginTop:45}}>
    <article><small>DEMAND SIGNAL</small><h3>{s.status}</h3><p>This record is a commercial signal. Buyer identity and live availability must be verified before commitment.</p><b>Market: {s.market}</b></article>
    <article><small>EXACT OFFER</small><h3>Build the matching supply brief</h3><p>Define specification, packing, origin options, Incoterm, target delivery and commercial constraints.</p><b>Signal → qualified supply → quote</b></article>
    <article><small>ATTRACT DEMAND</small><h3>Turn this intent into acquisition</h3><p>Create a search-ready product-market page from the verified requirement and connect it to Septlion RFQ capture.</p><Link href={`/intent/wheat-flour?d=${query}`}><b>Preview intent page ↗</b></Link></article>
   </div>
  </section>
 </main>
}