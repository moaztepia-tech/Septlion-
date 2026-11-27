'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {accessToken} from '../../../lib/api';
import {OpsFrame,ago} from '../../../components/ops-console';
import '../workbench/workbench.css';

// The founder's view of the SEPTLION Brain: what needs your decision, what each agent
// is queued to do, and what the brain did last. Nothing here sends or publishes anything.
type Decision={id:string;kind:string;subjectType:string;subjectId:string;titleAr:string;createdAt:string;
 detail:{market?:string;product?:string;quantity?:string|null;deadlineAt?:string|null;sourceUrl?:string|null;blockers?:string[];commercial?:{offerPerMt?:number;currency?:string;landedCostPerMt?:number;marginPct?:number;validUntil?:string}|null}};
type Task={id:string;agentType:string;subjectId:string;status:string;reason:string;createdAt:string;input:{market?:string;product?:string;sourceUrl?:string|null}};
type Agent={agentType:string;titleAr:string;enabled:boolean;dailyBudgetUsd:number};
type Run={id:string;startedAt:string;status:string;summary:{processed?:number;queued?:number;asked?:number;retired?:number};errors:unknown[]};
type BrainEvent={id:number;eventType:string;actor:string;payload:Record<string,unknown>;occurredAt:string};
type Brain={decisions:Decision[];tasks:Task[];agents:Agent[];runs:Run[];events:BrainEvent[];errors:string[]};

const endpoint='https://jfbmxowdmfdzyoauqgwn.supabase.co/functions/v1/demand-operator-workbench';
const kindAr:Record<string,string>={APPROVE_OFFER:'اعتماد عرض',PROVIDE_COST:'تكلفة ومورد',CONFIRM_FACT:'تأكيد معلومة',CHOOSE_PATH:'اختيار مسار'};
const reasonAr:Record<string,string>={
 RESEARCH_COMPANY_AND_DIRECT_CONTACT:'تحديد الشركة وقناة تواصل مباشرة',REVALIDATE_DEMAND:'التأكد أن الطلب ما زال قائمًا',
 COMPLETE_REQUIREMENT:'إكمال الكمية والتعبئة وشرط التسليم',REVIEW_ELIGIBILITY:'مراجعة أهلية الدخول المباشر',RESEARCH_SUPPLY:'إيجاد مورد مناسب'};
const eventAr:Record<string,string>={TASK_QUEUED:'مهمة جديدة',DECISION_REQUESTED:'طلب قرار',DECISION_MADE:'قرار المؤسس',FACT_ASSERTED:'معلومة في الذاكرة',BRAIN_RUN:'دورة المنسّق'};
const choices:Record<string,[string,string][]>={
 APPROVE_OFFER:[['APPROVE','أعتمد'],['REJECT','أرفض']],
 PROVIDE_COST:[['WILL_PROVIDE','سأدخل التكلفة'],['SKIP','تجاهل هذه الفرصة']],
 CONFIRM_FACT:[['CONFIRM','صحيحة'],['REJECT','غير صحيحة']],
 CHOOSE_PATH:[['A','الخيار الأول'],['B','الخيار الثاني']],
};

async function api(init?:RequestInit){
 const token=accessToken();if(!token)throw new Error('UNAUTHORIZED');
 const r=await fetch(endpoint,{...init,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}});
 if(r.status===401)throw new Error('UNAUTHORIZED');
 if(r.status===403)throw new Error('FORBIDDEN');
 if(!r.ok)throw new Error('REQUEST_FAILED');
 return r.json();
}

export default function BrainPage(){
 const [brain,setBrain]=useState<Brain|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState('');

 async function load(){
  try{const snap=await api();setBrain(snap.brain||null);setError(snap.brain?'':'العقل غير مفعّل على قاعدة البيانات بعد.');}
  catch(e){setError(e instanceof Error&&e.message==='UNAUTHORIZED'?'سجّل الدخول بحساب الفريق للمتابعة.':'تعذر تحميل العقل الآن.');}
 }
 useEffect(()=>{if(accessToken())void load();else setError('سجّل الدخول بحساب الفريق للمتابعة.');},[]);

 async function post(body:Record<string,unknown>,key:string){
  setBusy(key);setError('');
  try{await api({method:'POST',body:JSON.stringify(body)});await load();}
  catch(e){setError(e instanceof Error&&e.message==='FORBIDDEN'?'القرار للمؤسس فقط (حساب مدير).':'تعذر تنفيذ الإجراء. أعد المحاولة.');}
  finally{setBusy('');}
 }

 if(!brain)return <OpsFrame active="brain"><section className="ops-card" style={{maxWidth:520,margin:'8vh auto 0',textAlign:'center'}}><h1 className="ops-h1">العقل</h1><p className="ops-sub">{error||'جارٍ التحميل…'}</p>{error.startsWith('سجّل')&&<div className="ops-actions" style={{justifyContent:'center',marginTop:16}}><Link className="ops-btn pri" href="/account?next=/demand-intelligence/brain">تسجيل الدخول</Link></div>}</section></OpsFrame>;

 const byAgent=new Map<string,Task[]>();for(const t of brain.tasks)byAgent.set(t.agentType,[...(byAgent.get(t.agentType)||[]),t]);
 const lastRun=brain.runs[0];

 return <OpsFrame active="brain"><div className="dw">
  <section className="dw-hero shell">
   <h1>العقل</h1>
   <p>ما ينتظر قرارك، وما يعمل عليه كل وكيل، وما فعله المنسّق في آخر دورة.</p>
   <div className="dw-status">
    {lastRun&&<span className={'dw-chip '+(lastRun.status==='SUCCESS'?'dw-chip-ok':'')}>آخر دورة {ago(lastRun.startedAt)} · {lastRun.summary.processed??0} فرصة</span>}
    <button className="dw-primary" disabled={!!busy} onClick={()=>post({action:'run_brain'},'run')}>{busy==='run'?'يعمل…':'شغّل المنسّق الآن'}</button>
   </div>
   {error&&<p role="alert">{error}</p>}
  </section>

  <section className="dw-section dw-first shell">
   <div className="dw-head"><div><h2>ينتظر قرارك {brain.decisions.length>0&&<em>{brain.decisions.length}</em>}</h2></div></div>
   {brain.decisions.length?<div className="dw-alerts">{brain.decisions.map(d=><article key={d.id} className="dw-alert">
    <div>
     <span className="dw-tag dw-tag-warn">{kindAr[d.kind]||d.kind}</span>
     <h3>{d.titleAr}</h3>
     <p>
      {d.detail.quantity&&<>الكمية: {d.detail.quantity}. </>}
      {d.detail.commercial?.offerPerMt!=null&&<>العرض المقترح: {d.detail.commercial.offerPerMt} {d.detail.commercial.currency}/طن (تكلفة {d.detail.commercial.landedCostPerMt}، هامش {d.detail.commercial.marginPct}%). </>}
      {d.detail.blockers?.length?<>العوائق: {d.detail.blockers.join('، ')}</>:null}
     </p>
     <small>{ago(d.createdAt)}{d.detail.sourceUrl&&<> · <a className="dw-link" href={d.detail.sourceUrl} target="_blank" rel="noreferrer">المصدر</a></>}</small>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(choices[d.kind]||[]).map(([c,label])=><button key={c} disabled={!!busy} onClick={()=>post({action:'decide',decisionId:d.id,choice:c},d.id)}>{label}</button>)}</div>
   </article>)}</div>:<div className="dw-empty dw-calm">لا يوجد ما ينتظر قرارك الآن.</div>}
   <p className="ops-sub">اعتماد العرض هنا يسجّل قرارك في الذاكرة فقط. العرض نفسه لا يصبح جاهزًا إلا بتكلفة موثقة سارية ومورد موثّق من سبتليون، من شاشة التشغيل.</p>
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><h2>الوكلاء</h2></div></div>
   <div className="dw-kpis">{brain.agents.map(a=>{const q=byAgent.get(a.agentType)||[];return <article key={a.agentType}>
    <span>{a.titleAr}</span><b>{q.length}</b><small>{a.enabled?'مفعّل':'متوقف حتى تفعّله'}</small>
   </article>})}</div>
   {brain.tasks.length>0&&<div className="dw-alerts" style={{marginTop:16}}>{brain.tasks.slice(0,20).map(t=><article key={t.id} className="dw-alert">
    <div><span className="dw-tag">{brain.agents.find(a=>a.agentType===t.agentType)?.titleAr||t.agentType}</span>
     <h3>{reasonAr[t.reason]||t.reason}</h3>
     <p>{[t.input.product,t.input.market].filter(Boolean).join(' — ')}</p>
     <small>{ago(t.createdAt)}{t.input.sourceUrl&&<> · <a className="dw-link" href={t.input.sourceUrl} target="_blank" rel="noreferrer">المصدر</a></>}</small></div>
   </article>)}</div>}
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><h2>آخر ما حدث</h2></div></div>
   {brain.events.length?<ul className="ops-sub">{brain.events.map(e=><li key={e.id}>{eventAr[e.eventType]||e.eventType} · {e.actor==='FOUNDER'?'المؤسس':e.actor==='ORCHESTRATOR'?'المنسّق':e.actor} · {ago(e.occurredAt)}</li>)}</ul>:<div className="dw-empty">لم يسجّل العقل شيئًا بعد.</div>}
  </section>
 </div></OpsFrame>;
}
