'use client';

import {useEffect,useState} from 'react';

type Signal={
 id:string;type:string;market:string;product:string;quantity?:string|null;
 publishedAt?:string|null;status:string;score?:number;sourceUrl?:string|null;
};

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://jfbmxowdmfdzyoauqgwn.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';

async function loadSignals():Promise<Signal[]>{
 const endpoint=`${SUPABASE_URL}/rest/v1/DemandSignal?select=id,type,market,product,quantity,publishedAt,status,score,sourceUrl&order=score.desc,lastSeenAt.desc&limit=100`;
 try{
  const r=await fetch(endpoint,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!r.ok)return [];
  return await r.json();
 }catch{return []}
}

export default function DemandRadar(){
 const [signals,setSignals]=useState<Signal[]|null>(null);
 useEffect(()=>{let active=true;loadSignals().then(rows=>{if(active)setSignals(rows)});return()=>{active=false}},[]);

 if(signals===null)return <div className="di-table"><div className="di-row"><strong>RADAR CONNECTING</strong><span>Loading live demand signals</span><b>Supabase demand engine</b><span>—</span><i>LIVE</i><span>—</span></div></div>;
 if(!signals.length)return <div className="di-table"><div className="di-row"><strong>RADAR READY</strong><span>No matching persisted signals yet</span><b>Collector runs automatically every 6 hours</b><span>—</span><i>LIVE DB</i><span>—</span></div></div>;

 return <div className="di-table">
  <div className="di-row di-th"><span>Signal</span><span>Market</span><span>Requirement</span><span>Published</span><span>Status</span><span>Score</span></div>
  {signals.map(s=><div className="di-row" key={s.id}>
   <strong>{s.type}</strong>
   <span>{s.market}</span>
   <b>{s.product}<small style={{display:'block',marginTop:5,fontWeight:500}}>{s.quantity||'Quantity unresolved'}</small></b>
   <span>{(s.publishedAt||'').slice(0,10)||'—'}</span>
   <i>{s.status}</i>
   {s.sourceUrl?<a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.score??'—'} ↗</a>:<span>{s.score??'—'}</span>}
  </div>)}
 </div>
}
