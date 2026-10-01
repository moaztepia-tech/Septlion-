'use client';
import {useEffect,useState} from 'react';

const API=process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api';
type Center={signals:number;opportunities:Record<string,number>;pendingApprovals:number;agents:Record<string,number>};
type Opp={id:string;reference:string;status:string;title:string;market:string;product:string;nextAction?:string;buyerProfile?:{canonicalName:string;confidence:number};requirement?:{confidence:number;status:string}};
type Approval={id:string;action:string;title:string;summary?:string;opportunity:Opp};

export default function DemandCommand(){
 const[center,setCenter]=useState<Center|null>(null),[ops,setOps]=useState<Opp[]>([]),[approvals,setApprovals]=useState<Approval[]>([]),[error,setError]=useState('');
 async function load(){try{setError('');const [a,b,c]=await Promise.all([fetch(API+'/demand-intelligence/command-center'),fetch(API+'/demand-intelligence/opportunities'),fetch(API+'/demand-intelligence/approvals')]);if(!a.ok||!b.ok||!c.ok)throw new Error('API unavailable');setCenter(await a.json());setOps(await b.json());setApprovals(await c.json())}catch(e){setError(e instanceof Error?e.message:'Unable to load')}}
 useEffect(()=>{void load()},[]);
 async function decide(id:string,decision:'approve'|'reject'){await fetch(API+`/demand-intelligence/approvals/${id}/${decision}`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await load()}
 return <main className="dc"><header className="dc-top"><a href="/"><img src="/brand/septlion-header-white.png" alt="Septlion"/></a><div><span>GLOBAL DEMAND ENGINE</span><button onClick={load}>Refresh</button></div></header><section className="dc-shell dc-hero"><p>SEPTLION COMMAND</p><h1>Demand → Opportunity → Deal</h1><span>لوحة تشغيل داخلية لمحرك الطلب العالمي. لا يتم تنفيذ الالتزامات التجارية الحساسة دون موافقة بشرية.</span></section>
 <section className="dc-shell">{error&&<div className="dc-error">{error}</div>}<div className="dc-stats"><Card n={center?.signals||0} t="Demand signals"/><Card n={Object.values(center?.opportunities||{}).reduce((a,b)=>a+b,0)} t="Opportunities"/><Card n={center?.pendingApprovals||0} t="Pending approvals"/><Card n={(center?.agents?.QUEUED||0)+(center?.agents?.RUNNING||0)} t="Active agent jobs"/></div></section>
 <section className="dc-shell dc-section"><div className="dc-head"><div><p>OPPORTUNITY PIPELINE</p><h2>Commercial queue</h2></div><span>{ops.length} active records</span></div><div className="dc-table">{ops.map(o=><article key={o.id}><div><small>{o.reference} · {o.status}</small><h3>{o.title}</h3><p>{o.buyerProfile?.canonicalName||'Buyer unresolved'} · {o.market}</p></div><div><span>Qualification</span><b>{o.requirement?.confidence??0}%</b></div><div><span>Next action</span><b>{o.nextAction||'—'}</b></div></article>)}{!ops.length&&<div className="dc-empty">No promoted opportunities yet.</div>}</div></section>
 <section className="dc-dark"><div className="dc-shell dc-section"><div className="dc-head"><div><p>HUMAN AUTHORITY</p><h2>Approval gate</h2></div><span>External commitments stop here.</span></div><div className="dc-approvals">{approvals.map(a=><article key={a.id}><small>{a.action}</small><h3>{a.title}</h3><p>{a.summary||a.opportunity?.title}</p><div><button onClick={()=>decide(a.id,'reject')}>Reject</button><button className="primary" onClick={()=>decide(a.id,'approve')}>Approve</button></div></article>)}{!approvals.length&&<div className="dc-empty dark">No approvals waiting.</div>}</div></div></section></main>
}
function Card({n,t}:{n:number;t:string}){return <article><b>{n}</b><span>{t}</span></article>}
