'use client';

import {useEffect,useMemo,useState} from 'react';

type Signal={
 id:string;type:string;market:string;product:string;quantity?:string|null;
 publishedAt?:string|null;deadlineAt?:string|null;status:string;stage:string;score:number;sourceUrl?:string|null;
};
type Filter='all'|'qualify'|'resolve';

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
 DETECTED:'تم الرصد',
 BUYER_RESOLUTION:'تحديد المشتري',
 QUALIFICATION:'التأهيل',
 OFFER_BUILD:'بناء العرض',
 INTENT_PAGE:'صفحة طلب',
 RFQ:'طلب عرض سعر',
 ARCHIVED:'مؤرشف'
};
const typeLabel:Record<string,string>={RFQ:'طلب عرض سعر',TENDER:'مناقصة',AUCTION:'مزاد'};
const statusTone=(s:string)=>s==='QUALIFY_NOW'?'new':s==='RESOLVE_BUYER'?'sent':'muted';
const statusLabel:Record<string,string>={QUALIFY_NOW:'جاهزة للتأهيل',RESOLVE_BUYER:'تحتاج تحديد المشتري'};
const day=(x?:string|null)=>x?new Date(x).toLocaleDateString('ar-EG-u-nu-latn',{day:'numeric',month:'short',year:'numeric'}):'—';

export default function DemandRadar(){
 const [signals,setSignals]=useState<Signal[]|null>(null);
 const [filter,setFilter]=useState<Filter>('all');
 const [q,setQ]=useState('');
 useEffect(()=>{let active=true;loadSignals().then(rows=>{if(active)setSignals(rows)});return()=>{active=false}},[]);

 const stats=useMemo(()=>{
  const rows=signals||[];
  const deadlines=rows.map(x=>x.deadlineAt).filter(Boolean).map(x=>new Date(x as string)).filter(x=>x.getTime()>Date.now()).sort((a,b)=>a.getTime()-b.getTime());
  return {
   active:rows.length,
   qualify:rows.filter(x=>x.status==='QUALIFY_NOW').length,
   resolve:rows.filter(x=>x.status==='RESOLVE_BUYER').length,
   markets:new Set(rows.map(x=>x.market)).size,
   next:deadlines[0]?day(deadlines[0].toISOString()):'—'
  };
 },[signals]);

 const shown=useMemo(()=>{
  const t=q.trim().toLowerCase();
  return (signals||[]).filter(s=>(filter==='all'||(filter==='qualify'?s.status==='QUALIFY_NOW':s.status==='RESOLVE_BUYER'))&&(!t||(s.market+' '+s.product).toLowerCase().includes(t)));
 },[signals,filter,q]);

 if(signals===null)return <p className="ops-sub" role="status">جارٍ تحميل إشارات الطلب…</p>;

 return <>
  <div className="ops-stats ops-stats-5">
   <div className="ops-stat"><b>{stats.active}</b><small>إشارات نشطة</small></div>
   <div className="ops-stat hl"><b>{stats.qualify}</b><small>جاهزة للتأهيل</small></div>
   <div className="ops-stat"><b>{stats.resolve}</b><small>تحتاج تحديد المشتري</small></div>
   <div className="ops-stat"><b>{stats.markets}</b><small>سوقًا</small></div>
   <div className="ops-stat"><b style={{fontSize:18}}>{stats.next}</b><small>أقرب موعد نهائي</small></div>
  </div>

  {!signals.length?<div className="ops-empty">الرادار جاهز ولم تُحفظ إشارات بعد. محركات الجمع تعمل وستظهر الإشارات هنا.</div>:<section aria-label="إشارات الطلب">
   <div className="ops-row" style={{marginBottom:10}}>
    <div className="ops-chips">
     {([['all','الكل',stats.active],['qualify','جاهزة للتأهيل',stats.qualify],['resolve','تحتاج تحديد المشتري',stats.resolve]] as const).map(([k,l,n])=><button key={k} className="ops-chip" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}<i>{n}</i></button>)}
    </div>
    <div className="ops-form" style={{display:'block',minWidth:'min(100%,260px)'}}><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث بالسوق أو المنتج" aria-label="ابحث بالسوق أو المنتج"/></div>
   </div>
   {shown.length===0?<div className="ops-empty">لا توجد إشارات تطابق البحث.</div>:
   <div className="ops-grid">{shown.map(s=><article key={s.id} className="ops-item" style={{cursor:'default'}}>
    <div className="ops-item-top"><span className="ops-item-place"><span className="ops-tag">{typeLabel[s.type]||s.type}</span><bdi className="ops-market" title={s.market}>{s.market}</bdi></span><span>{day(s.publishedAt)}</span></div>
    <h3 dir="auto">{s.product}</h3>
    <div className="ops-item-meta">المرحلة: {stageLabel[s.stage]||s.stage}</div>
    <div className="ops-item-meta">{s.quantity?<bdi>{s.quantity}</bdi>:'الكمية غير محددة بعد'}{s.deadlineAt?<> · {new Date(s.deadlineAt).getTime()<Date.now()?'انتهى الموعد في':'آخر موعد'} {day(s.deadlineAt)}</>:null}</div>
    <div className="ops-item-foot">
     <span className={'ops-badge '+statusTone(s.status)}>{statusLabel[s.status]||s.status}</span>
     <span className="ops-actions" style={{alignItems:'center',gap:10}}>
      <span className="ops-score" title="درجة الفرصة">{s.score}</span>
      {s.sourceUrl&&<a className="ops-link" href={s.sourceUrl} target="_blank" rel="noreferrer">المصدر ↗</a>}
     </span>
    </div>
   </article>)}</div>}
  </section>}
 </>;
}
