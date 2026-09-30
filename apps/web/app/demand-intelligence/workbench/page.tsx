'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';

type QueueItem={
 taskId:string;taskType:string;taskStatus:string;priority:number;dueAt?:string|null;
 signalId:string;stage:string;signalStatus:string;score:number;type:string;market:string;
 product:string;quantity?:string|null;buyerName?:string|null;deadlineAt?:string|null;
 source:string;sourceUrl?:string|null;buyerConfidence?:number|null;
 buyerVerificationStatus?:string|null;buyerContactName?:string|null;buyerEmail?:string|null;buyerPhone?:string|null;
 qualificationDecision?:string|null;localPartnerRequired?:boolean|null;nextAction?:string|null;
 offerStatus?:string|null;intentStatus?:string|null;intentSlug?:string|null;
 rfqReference?:string|null;rfqSubmissionStatus?:string|null;
};
type Snapshot={
 operator:string;
 stats:{activeSignals:number;qualifyNow:number;buyerResolution:number;qualification:number;offerBuild:number;intentPage:number;rfq:number;markets:number};
 queue:QueueItem[];
 sources:Array<{id:string;name:string;sourceType:string;active:boolean;priority:number;lastSuccessAt?:string|null;lastError?:string|null;collector?:string|null;cadenceMinutes?:number|null}>;
 patterns:Array<{productKey:string;market:string;signalCount:number;patternStatus:string;confidence:number;predictedWindowStart?:string|null;predictedWindowEnd?:string|null}>;
 recentRuns:Array<{sourceId:string;status:string;scanned:number;accepted:number;error?:string|null;startedAt:string;finishedAt?:string|null}>;
};

const endpoint='https://jfbmxowdmfdzyoauqgwn.supabase.co/functions/v1/demand-operator-workbench';

const stageAr:Record<string,string>={
 DETECTED:'تم الرصد',
 BUYER_RESOLUTION:'حل هوية المشتري',
 QUALIFICATION:'التأهيل',
 OFFER_BUILD:'بناء العرض',
 INTENT_PAGE:'صفحة نية الشراء',
 RFQ:'طلب عرض سعر',
 ARCHIVED:'مؤرشف'
};
const taskAr:Record<string,string>={
 RESOLVE_BUYER:'حل المشتري',
 VERIFY_QUALIFICATION:'التحقق من التأهيل',
 BUILD_OFFER:'بناء العرض',
 PUBLISH_INTENT:'نشر صفحة الطلب',
 FOLLOW_UP:'متابعة'
};

async function api(key:string,init?:RequestInit){
 const r=await fetch(endpoint,{...init,headers:{'Content-Type':'application/json','x-operator-key':key,...(init?.headers||{})}});
 if(r.status===401)throw new Error('UNAUTHORIZED');
 if(!r.ok)throw new Error('REQUEST_FAILED');
 return r.json();
}

export default function DemandWorkbench(){
 const [key,setKey]=useState('');
 const [draft,setDraft]=useState('');
 const [data,setData]=useState<Snapshot|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 async function load(k=key){
  setBusy(true);setError('');
  try{
   const snap=await api(k);
   setData(snap);setKey(k);sessionStorage.setItem('septlion_operator_key',k);
  }catch(e){
   if(e instanceof Error&&e.message==='UNAUTHORIZED'){sessionStorage.removeItem('septlion_operator_key');setKey('');setData(null);setError('مفتاح المشغّل غير صحيح أو تم إلغاؤه.');}
   else setError('تعذر تحميل لوحة التشغيل الآن.');
  }finally{setBusy(false)}
 }

 useEffect(()=>{
  const saved=sessionStorage.getItem('septlion_operator_key')||'';
  if(saved){setKey(saved);void load(saved)}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 async function login(e:FormEvent){
  e.preventDefault();
  if(draft.trim())await load(draft.trim());
 }

 async function act(item:QueueItem,action:'start'|'complete'|'block'|'reopen'|'advance'|'publish_intent'){
  setBusy(true);setError('');
  try{
   await api(key,{method:'POST',body:JSON.stringify({taskId:item.taskId,action})});
   await load(key);
  }catch{setError('تعذر تنفيذ الإجراء. أعد المحاولة.');setBusy(false)}
 }

 const sorted=useMemo(()=>[...(data?.queue||[])].sort((a,b)=>(b.priority-a.priority)||((a.dueAt||'9999').localeCompare(b.dueAt||'9999'))),[data]);

 if(!data)return <main className="dw-login" dir="rtl">
  <div className="dw-login-card">
   <Link href="/demand-intelligence" className="dw-wordmark">SEPTLION · DEMAND INTELLIGENCE</Link>
   <p className="kicker">INTERNAL OPERATOR WORKBENCH</p>
   <h1>لوحة تشغيل محرك الطلب</h1>
   <p>هذه المنطقة لا تعرض بياناتها إلا بعد إدخال مفتاح المشغّل الداخلي. المفتاح لا يُحفظ على الخادم ولا في ملفات الموقع.</p>
   <form onSubmit={login}>
    <input type="password" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Operator Key" autoComplete="off"/>
    <button disabled={busy||!draft.trim()}>{busy?'جارٍ التحقق…':'دخول لوحة التشغيل'}</button>
   </form>
   {error&&<div className="dw-error">{error}</div>}
  </div>
 </main>;

 return <main className="dw" dir="rtl">
  <header className="dw-top shell">
   <div><Link href="/demand-intelligence" className="dw-wordmark">SEPTLION · DEMAND INTELLIGENCE</Link><small>INTERNAL WORKBENCH</small></div>
   <div className="dw-top-actions"><span>{data.operator}</span><button onClick={()=>{sessionStorage.removeItem('septlion_operator_key');setData(null);setKey('')}}>قفل اللوحة</button></div>
  </header>

  <section className="dw-hero shell">
   <p className="kicker">DETECT → RESOLVE → QUALIFY → OFFER → INTENT → RFQ</p>
   <h1>غرفة تشغيل الطلب.</h1>
   <p>ترتيب الإشارات والمهام حسب الأولوية، ومراقبة المصادر، وحالة التأهيل، وتراكم أنماط الطلب من مكان واحد.</p>
  </section>

  <section className="dw-stats shell">
   <article><span>الإشارات النشطة</span><b>{data.stats.activeSignals}</b></article>
   <article><span>تأهيل الآن</span><b>{data.stats.qualifyNow}</b></article>
   <article><span>حل المشتري</span><b>{data.stats.buyerResolution}</b></article>
   <article><span>قيد التأهيل</span><b>{data.stats.qualification}</b></article>
   <article><span>بناء العرض</span><b>{data.stats.offerBuild}</b></article>
   <article><span>الأسواق</span><b>{data.stats.markets}</b></article>
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><p className="kicker">EXECUTION QUEUE</p><h2>قائمة التنفيذ</h2></div><button className="dw-refresh" onClick={()=>load(key)} disabled={busy}>{busy?'يتم التحديث…':'تحديث'}</button></div>
   {error&&<div className="dw-error">{error}</div>}
   <div className="dw-queue">
    {sorted.map(item=><article className="dw-task" key={item.taskId}>
     <div className="dw-task-top">
      <span className="dw-priority">{item.priority}</span>
      <div><small>{item.type} · {taskAr[item.taskType]||item.taskType}</small><h3>{item.product}</h3><p>{item.market}{item.quantity?' · '+item.quantity:''}</p></div>
      <i>{stageAr[item.stage]||item.stage}</i>
     </div>
     <div className="dw-task-grid">
      <div><span>المشتري</span><b>{item.buyerName||'غير محلول'}</b><small>{item.buyerContactName||item.buyerVerificationStatus||'UNRESOLVED'}{item.buyerEmail?' · '+item.buyerEmail:''}{item.buyerPhone?' · '+item.buyerPhone:''}{item.buyerConfidence!=null?' · '+item.buyerConfidence+'%':''}</small></div>
      <div><span>التأهيل</span><b>{item.qualificationDecision||'PENDING'}</b><small>{item.localPartnerRequired===true?'شريك محلي مطلوب':item.localPartnerRequired===false?'لا يحتاج شريكًا محليًا':'لم يُحسم'}</small></div>
      <div><span>الموعد</span><b>{item.deadlineAt?.slice(0,10)||'—'}</b><small>{item.source}</small></div>
      <div><span>الخطوة التالية</span><b>{item.rfqReference?item.rfqReference:(item.nextAction||taskAr[item.taskType]||item.taskType)}</b><small>{item.rfqSubmissionStatus?'RFQ: '+item.rfqSubmissionStatus:''}{item.offerStatus?(item.rfqSubmissionStatus?' · ':'')+'Offer: '+item.offerStatus:''}{item.intentStatus?((item.rfqSubmissionStatus||item.offerStatus)?' · ':'')+'Intent: '+item.intentStatus:''}</small></div>
     </div>
     <div className="dw-actions">
      {item.taskStatus==='OPEN'&&<button onClick={()=>act(item,'start')}>بدء المهمة</button>}
      {item.taskStatus==='BLOCKED'&&<button onClick={()=>act(item,'reopen')}>إعادة فتح</button>}
      {item.stage!=='RFQ'&&item.stage!=='INTENT_PAGE'&&<button className="dw-primary" onClick={()=>act(item,'advance')}>{item.stage==='QUALIFICATION'?'اعتماد التأهيل وإنشاء العرض':item.stage==='OFFER_BUILD'?'اعتماد العرض والانتقال لصفحة النية':'إكمال والانتقال للمرحلة التالية'}</button>}
      {item.stage==='INTENT_PAGE'&&item.intentStatus!=='READY'&&item.intentStatus!=='PUBLISHED'&&<button className="dw-primary" onClick={()=>act(item,'advance')}>تجهيز صفحة النية</button>}
      {item.stage==='INTENT_PAGE'&&item.intentStatus==='READY'&&<button className="dw-primary" onClick={()=>act(item,'publish_intent')}>نشر صفحة النية</button>}
      {item.stage==='INTENT_PAGE'&&item.intentStatus==='PUBLISHED'&&item.intentSlug&&<a href={'/intent/demand/?slug='+encodeURIComponent(item.intentSlug)} target="_blank" rel="noreferrer">فتح صفحة النية ↗</a>}
      <button onClick={()=>act(item,'complete')}>إغلاق المهمة</button>
      <button onClick={()=>act(item,'block')}>تعليق</button>
      {item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer">فتح المصدر ↗</a>}
     </div>
    </article>)}
    {!sorted.length&&<div className="dw-empty">لا توجد مهام مفتوحة حاليًا.</div>}
   </div>
  </section>

  <section className="dw-section dw-dark">
   <div className="shell">
    <div className="dw-head"><div><p className="kicker">SOURCE ENGINE</p><h2>صحة المصادر</h2></div></div>
    <div className="dw-source-grid">
     {data.sources.map(s=><article key={s.id}><span>{s.sourceType}</span><h3>{s.name}</h3><p>{s.active?'نشط':'متوقف'} · أولوية {s.priority}{s.cadenceMinutes?' · كل '+s.cadenceMinutes+' دقيقة':''}</p><small>{s.lastError?'آخر خطأ: '+s.lastError:s.lastSuccessAt?'آخر نجاح: '+s.lastSuccessAt.slice(0,16).replace('T',' '):'لم يعمل بعد'}</small></article>)}
    </div>
   </div>
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><p className="kicker">PREDICTION LAYER</p><h2>أنماط الطلب</h2></div><p>لا تُعرض نافذة توقع إلا عندما تتراكم إشارات زمنية كافية. إشارة واحدة تبقى «غير كافية» بدل اختلاق توقع.</p></div>
   <div className="dw-patterns">
    {data.patterns.map((p,i)=><article key={p.productKey+'-'+p.market+'-'+i}><span>{p.patternStatus}</span><h3>{p.market}</h3><p>{p.productKey} · {p.signalCount} إشارات</p><b>{p.confidence}% ثقة</b><small>{p.predictedWindowStart?p.predictedWindowStart.slice(0,10)+' → '+(p.predictedWindowEnd?.slice(0,10)||'—'):'لا توجد نافذة توقع بعد'}</small></article>)}
   </div>
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><p className="kicker">COLLECTOR TELEMETRY</p><h2>آخر جولات الجمع</h2></div></div>
   <div className="dw-runs">
    {data.recentRuns.map((r,i)=><div key={r.sourceId+'-'+r.startedAt+'-'+i}><b>{r.sourceId}</b><span>{r.status}</span><span>فحص {r.scanned}</span><span>قبل {r.accepted}</span><small>{r.startedAt.slice(0,16).replace('T',' ')}</small></div>)}
   </div>
  </section>
 </main>
}
