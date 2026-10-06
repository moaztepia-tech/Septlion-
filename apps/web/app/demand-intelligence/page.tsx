import Link from 'next/link';
import {PlatformHeader} from '../../components/platform-header';
import DemandRadar from './DemandRadar';

const pipeline=['Detect demand','Extract requirement','Resolve buyer','Qualify opportunity','Build exact offer','Attract matching demand','Convert to RFQ'];

export const metadata={title:'Septlion Demand Intelligence — Tenders, RFQs & Auctions',description:'Demand intelligence for tenders, RFQs and auctions. Detect demand, qualify opportunities and turn intent into executable supply briefs.'};

export default function DemandIntelligence(){
 return <main className="di" dir="ltr">
  <PlatformHeader lang="en"/>
  <section className="di-hero shell"><p className="kicker">SEPTLION DEMAND INTELLIGENCE ENGINE</p><h1>Find demand.<br/>Predict demand.<br/><em>Attract demand.</em></h1><p>Public buying requests become demand clusters, market-specific search pages and live RFQ routes — so matching buyers can discover Septlion from the requirement itself.</p><div className="di-actions"><Link href="/demand/">Open live demand routes ↗</Link><a href="#radar">Open demand radar ↓</a></div></section>
  <section className="di-strip"><div className="shell">{pipeline.map((x,i)=><div key={x}><span>0{i+1}</span><b>{x}</b></div>)}</div></section>
  <section id="radar" className="di-section shell"><div className="di-head"><div><p className="kicker">LIVE OPERATING VIEW</p><h2>Demand Radar</h2></div><p>The first implementation is focused on wheat flour. Signals are treated as leads until independently verified; the engine separates detection from verification.</p></div>
   <DemandRadar/>
  </section>
  <section className="di-section di-dark"><div className="shell"><div className="di-head"><div><p className="kicker">THE DIFFERENCE</p><h2>Not a tender directory.</h2></div><p>Septlion is designed to move beyond discovery. Each signal becomes structured commercial intelligence and, when useful, an intent page capable of attracting buyers with the same requirement.</p></div><div className="di-grid">
   <article><span>01</span><h3>Demand Resolution</h3><p>Product, specification, quantity, destination, deadline, buyer entity and evidence are separated into verifiable fields.</p></article>
   <article><span>02</span><h3>Bid Readiness</h3><p>Eligibility, supply route, manufacturer fit, documents, Incoterm and commercial constraints become a decision brief.</p></article>
   <article><span>03</span><h3>Demand Pages</h3><p>Recent platform requests are clustered into crawlable product + market pages with structured data and a direct RFQ route — without publishing buyer identities.</p><Link href="/demand/">Open demand routes ↗</Link></article>
  </div></div></section>
  <section className="di-section shell"><div className="di-head"><div><p className="kicker">PILOT · WHEAT FLOUR</p><h2>One product. Many demand surfaces.</h2></div><p>We start narrow: flour tenders, commercial RFQs and recurring procurement signals. The engine learns the language of the requirement before expanding to other categories.</p></div><div className="di-cards">
   <article><small>SEARCH INTENT</small><h3>Wheat Flour 50kg</h3><p>Commercial supply · FCL / bulk programs</p><b>Product → destination → volume → delivery</b></article>
   <article><small>TENDER INTENT</small><h3>Institutional Flour Supply</h3><p>Eligibility · deadline · documents · delivery schedule</p><b>Tender → qualification → bid brief</b></article>
   <article><small>GEO / SEO / ADS</small><h3>Make buyers find Septlion</h3><p>Demand signals determine what pages and campaigns deserve to exist.</p><b>Signal → exact page → RFQ</b></article>
  </div></section>
  <section className="di-close"><div className="shell"><p className="kicker">START WITH DEMAND</p><h2>The market tells us what to build.</h2><Link href="/require">ابدأ طلبًا ↗</Link></div></section>
 </main>
}