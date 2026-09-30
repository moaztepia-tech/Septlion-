import Link from 'next/link';

type Signal={id:string;type:string;market:string;product:string;quantity?:string|null;publishedAt?:string|null;published?:string|null;status:string;score?:number};

async function loadSignals():Promise<Signal[]>{
 const base=process.env.API_URL||process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api';
 try{
  const r=await fetch(`${base}/demand-intelligence/signals`,{next:{revalidate:300}});
  if(!r.ok)return [];
  return await r.json();
 }catch{return []}
}

export default async function DemandRadar(){
 const signals=await loadSignals();
 if(!signals.length)return <div className="di-table"><div className="di-row"><strong>RADAR READY</strong><span>Waiting for persisted signals</span><b>Collectors can now feed this view</b><span>—</span><i>LIVE DB</i><span>—</span></div></div>;
 return <div className="di-table"><div className="di-row di-th"><span>Signal</span><span>Market</span><span>Requirement</span><span>Published</span><span>Status</span><span>Score</span></div>{signals.map(s=><div className="di-row" key={s.id}><strong>{s.type}</strong><span>{s.market}</span><b>{s.product}<small style={{display:'block',marginTop:5,fontWeight:500}}>{s.quantity||'Quantity unresolved'}</small></b><span>{(s.publishedAt||s.published||'').slice(0,10)||'—'}</span><i>{s.status}</i><Link href={`/demand-intelligence/opportunity/${s.id}`}>{s.score??'—'} ↗</Link></div>)}</div>
}
