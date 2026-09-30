import Link from 'next/link';

const signals=[
 {type:'TENDER',market:'Saudi Arabia',product:'Wheat Flour',stage:'Open',intent:'Institutional procurement',action:'Build bid brief'},
 {type:'RFQ',market:'East Africa',product:'Wheat Flour 50kg',stage:'Detected',intent:'Commercial / FCL',action:'Resolve buyer'},
 {type:'AUCTION',market:'MENA',product:'Food & Packaging',stage:'Watch',intent:'Timed opportunity',action:'Qualify opportunity'}
];
const pipeline=['Detect demand','Extract requirement','Resolve buyer','Qualify opportunity','Build exact offer','Attract matching demand','Convert to RFQ'];

export const metadata={title:'Septlion Demand Intelligence — Tenders, RFQs & Auctions',description:'Demand intelligence for tenders, RFQs and auctions. Detect demand, qualify opportunities and turn intent into executable supply briefs.'};

export default function DemandIntelligence(){
 return <main className="di">
  <header className="di-nav shell"><Link href="/" className="brand"><img src="/brand/septlion-primary-navy.png" alt="Septlion"/></Link><div><span>DEMAND INTELLIGENCE</span><Link href="/#contact">Submit requirement ↗</Link></div></header>
  <section className="di-hero shell"><p className="kicker">SEPTLION DEMAND INTELLIGENCE ENGINE</p><h1>Find demand.<br/>Predict demand.<br/><em>Attract demand.</em></h1><p>One operating layer for tenders, RFQs and auctions — turning public buying signals into qualified opportunities, exact offers and buyer-intent pages.</p><div className="di-actions"><a href="#radar">Open demand radar ↓</a><Link href="/#contact">Create supply brief ↗</Link></div></section>
  <section className="di-strip"><div className="shell">{pipeline.map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b></div>)}</div></section>
  <section id="radar" className="di-section shell"><div className="di-head"><div><p className="kicker">LIVE OPERATING VIEW</p><h2>Demand Radar</h2></div><p>The first implementation is focused on wheat flour. Signals are treated as leads until independently verified; the engine separates detection from verification.</p></div>
   <div className="di-table"><div className="di-row di-th"><span>Signal</span><span>Market</span><span>Requirement</span><span>Intent</span><span>Status</span><span>Next action</span></div>{signals.map(s=><div className="di-row" key={s.type+s.market}><strong>{s.type}</strong><span>{s.market}</span><b>{s.product}</b><span>{s.intent}</span><i>{s.stage}</i><button>{s.action} ↗</button></div>)}</div>
  </section>
  <section className="di-section di-dark"><div className="shell"><div className="di-head"><div><p className="kicker">THE DIFFERENCE</p><h2>Not a tender directory.</h2></div><p>Septlion is designed to move beyond discovery. Each signal becomes structured commercial intelligence and, when useful, an intent page capable of attracting buyers with the same requirement.</p></div><div className="di-grid">
   <article><span>01</span><h3>Demand Resolution</h3><p>Product, specification, quantity, destination, deadline, buyer entity and evidence are separated into verifiable fields.</p></article>
   <article><span>02</span><h3>Bid Readiness</h3><p>Eligibility, supply route, manufacturer fit, documents, Incoterm and commercial constraints become a decision brief.</p></article>
   <article><span>03</span><h3>Intent Pages</h3><p>High-value demand patterns become precise search-ready pages: product + market + pack + delivery context, connected directly to RFQ capture.</p></article>
  </div></div></section>
  <section className="di-section shell"><div className="di-head"><div><p className="kicker">PILOT · WHEAT FLOUR</p><h2>One product. Many demand surfaces.</h2></div><p>We start narrow: flour tenders, commercial RFQs and recurring procurement signals. The engine learns the language of the requirement before expanding to other categories.</p></div><div className="di-cards">
   <article><small>SEARCH INTENT</small><h3>Wheat Flour 50kg</h3><p>Commercial supply · FCL / bulk programs</p><b>Product → destination → volume → delivery</b></article>
   <article><small>TENDER INTENT</small><h3>Institutional Flour Supply</h3><p>Eligibility · deadline · documents · delivery schedule</p><b>Tender → qualification → bid brief</b></article>
   <article><small>GEO / SEO / ADS</small><h3>Make buyers find Septlion</h3><p>Demand signals determine what pages and campaigns deserve to exist.</p><b>Signal → exact page → RFQ</b></article>
  </div></section>
  <section className="di-close"><div className="shell"><p className="kicker">START WITH DEMAND</p><h2>The market tells us what to build.</h2><Link href="/#contact">Send a requirement ↗</Link></div></section>
 </main>
}