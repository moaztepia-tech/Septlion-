'use client';

import {useEffect,useMemo,useState} from 'react';

type Signal={
 id:string;type:string;market:string;product:string;quantity?:string|null;
 publishedAt?:string|null;deadlineAt?:string|null;status:string;stage:string;score:number;sourceUrl?:string|null;
};

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://jfbmxowdmfdzyoauqgwn.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';

async function loadSignals():Promise<Signal[]>{
 const endpoint=`${SUPABASE_URL}/rest/v1/PublicDemandSignal?select=id,type,market,product,quantity,publishedAt,deadlineAt,status,stage,score,sourceUrl&order=score.desc,updatedAt.desc&limit=100`;
 try{
  const r=await fetch(endpoint,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!r.ok)return [];
  return await r.json();
 }catch{return []}
}

const stageLabel:Record<string,string>={
 DETECTED:'Detected',
 BUYER_RESOLUTION:'Buyer resolution',
 QUALIFICATION:'Qualification',
 OFFER_BUILD:'Offer build',
 INTENT_PAGE:'Intent page',
 RFQ:'RFQ',
 ARCHIVED:'Archived'
};

export default function DemandRadar(){
 const [signals,setSignals]=useState<Signal[]|null>(null);
 useEffect(()=>{let active=true;loadSignals().then(rows=>{if(active)setSignals(rows)});return()=>{active=false}},[]);

 const stats=useMemo(()=>{
  const rows=signals||[];
  const deadlines=rows.map(x=>x.deadlineAt).filter(Boolean).map(x=>new Date(x as string)).filter(x=>x.getTime()>Date.now()).sort((a,b)=>a.getTime()-b.getTime());
  return {
   active:rows.length,
   qualify:rows.filter(x=>x.status==='QUALIFY_NOW').length,
   resolve:rows.filter(x=>x.status==='RESOLVE_BUYER').length,
   markets:new Set(rows.map(x=>x.market)).size,
   next:deadlines[0]?.toISOString().slice(0,10)||'—'
  };
 },[signals]);

 if(signals===null)return <div className="di-table"><div className="di-row"><strong>RADAR CONNECTING</strong><span>Loading live demand signals</span><b>Secure public projection</b><span>—</span><i>LIVE</i><span>—</span></div></div>;

 return <>
  <div className="di-stats">
   <article><span>ACTIVE SIGNALS</span><b>{stats.active}</b></article>
   <article><span>QUALIFY NOW</span><b>{stats.qualify}</b></article>
   <article><span>BUYER RESOLUTION</span><b>{stats.resolve}</b></article>
   <article><span>MARKETS</span><b>{stats.markets}</b></article>
   <article><span>NEAREST DEADLINE</span><b>{stats.next}</b></article>
  </div>

  {!signals.length?<div className="di-table"><div className="di-row"><strong>RADAR READY</strong><span>No matching persisted signals yet</span><b>Collectors are active</b><span>—</span><i>LIVE DB</i><span>—</span></div></div>:
  <div className="di-table">
   <div className="di-row di-th"><span>Signal</span><span>Market</span><span>Requirement</span><span>Published</span><span>Stage</span><span>Score</span></div>
   {signals.map(s=><div className="di-row" key={s.id}>
    <strong>{s.type}</strong>
    <span>{s.market}</span>
    <b>{s.product}<small style={{display:'block',marginTop:5,fontWeight:500}}>{s.quantity||'Quantity unresolved'}</small></b>
    <span>{(s.publishedAt||'').slice(0,10)||'—'}</span>
    <i>{stageLabel[s.stage]||s.stage}<small style={{display:'block',marginTop:5,fontStyle:'normal',opacity:.65}}>{s.status}</small></i>
    {s.sourceUrl?<a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.score} ↗</a>:<span>{s.score}</span>}
   </div>)}
  </div>}
 </>;
}
