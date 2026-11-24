'use client';

import {useEffect,useMemo,useState} from 'react';
import {accessToken} from '../../../lib/api';
import Link from 'next/link';
import {OpsFrame} from '../../../components/ops-console';
import {DemandPageRef,buyerReply,fetchDemandPages,replyLink} from '../../../lib/buyer-reply';
import './workbench.css';

type QueueItem={
 taskId:string;taskType:string;taskStatus:string;priority:number;dueAt?:string|null;
 signalId:string;stage:string;signalStatus:string;score:number;type:string;market:string;
 product:string;quantity?:string|null;buyerName?:string|null;deadlineAt?:string|null;
 source:string;sourceUrl?:string|null;buyerConfidence?:number|null;
 buyerVerificationStatus?:string|null;buyerContactName?:string|null;buyerEmail?:string|null;buyerPhone?:string|null;
 qualificationDecision?:string|null;localPartnerRequired?:boolean|null;nextAction?:string|null;
 offerStatus?:string|null;intentStatus?:string|null;intentSlug?:string|null;
 rfqReference?:string|null;rfqSubmissionStatus?:string|null;
 supplierFit?:{status?:string;candidateCount?:number;refreshedAt?:string}|null;
};
type AlertItem={
 id:string;type:string;severity:string;title:string;body:string;metadata?:Record<string,unknown>|null;createdAt:string;readAt?:string|null;
};
type BuyerItem={
 id:string;displayName:string;legalName?:string|null;country?:string|null;website?:string|null;buyerType?:string|null;
 verificationStatus:string;confidence:number;productKeys:string[];signalCount:number;sourceCount:number;
 lastBuyingSignalAt?:string|null;buyingIntentScore:number;contactReadinessScore:number;executionScore:number;
 primaryContactName?:string|null;primaryContactRole?:string|null;primaryEmail?:string|null;primaryPhone?:string|null;
 primaryWhatsapp?:string|null;contactVerification?:string|null;
 latestSource?:string|null;latestProduct?:string|null;latestQuantity?:string|null;latestSourceUrl?:string|null;latestIsPlatform?:boolean|null;sources?:string[]|null;
 platformVerified?:boolean|null;platformTrustScore?:number|null;rfqQualityScore?:number|null;
 platformContactAvailable?:boolean|null;recurrenceEvidenceCount?:number|null;priorityScore?:number|null;
};
type Snapshot={
 operator:string;
 stats:{activeSignals:number;qualifyNow:number;buyerResolution:number;qualification:number;offerBuild:number;intentPage:number;rfq:number;markets:number;unreadAlerts:number;activePushSubscriptions:number;supplierProfiles:number;buyers:number;buyerVerified:number;buyerExecutable:number;buyerContactReady:number};
 queue:QueueItem[];
 sources:Array<{id:string;name:string;sourceType:string;active:boolean;priority:number;lastSuccessAt?:string|null;lastError?:string|null;collector?:string|null;cadenceMinutes?:number|null}>;
 patterns:Array<{productKey:string;market:string;signalCount:number;patternStatus:string;confidence:number;predictedWindowStart?:string|null;predictedWindowEnd?:string|null}>;
 recentRuns:Array<{sourceId:string;status:string;scanned:number;accepted:number;error?:string|null;startedAt:string;finishedAt?:string|null}>;
 alerts:AlertItem[];
 buyers:BuyerItem[];
};

const endpoint='https://jfbmxowdmfdzyoauqgwn.supabase.co/functions/v1/demand-operator-workbench';
const VAPID_PUBLIC='BH9wlH9Mz0dN8Fc1Nc9EvJG7AASDBHJqhF9guC2Qxoj8EPSf4v94D73i9KN393X6RL66e0RUnmIPHxKLUjmyrnU';

function urlBase64ToUint8Array(base64String:string){
 const padding='='.repeat((4-base64String.length%4)%4);
 const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(base64);
 return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

const stageAr:Record<string,string>={
 DETECTED:'تم الرصد',
 BUYER_RESOLUTION:'تحديد المشتري',
 QUALIFICATION:'التأهيل',
 OFFER_BUILD:'بناء العرض',
 INTENT_PAGE:'صفحة الطلب',
 RFQ:'طلب عرض سعر',
 ARCHIVED:'مؤرشف'
};
const taskAr:Record<string,string>={
 RESOLVE_BUYER:'تحديد هوية المشتري',
 VERIFY_QUALIFICATION:'التحقق من التأهيل',
 BUILD_OFFER:'بناء العرض',
 PUBLISH_INTENT:'نشر صفحة الطلب',
 FOLLOW_UP:'متابعة'
};

const verifyAr:Record<string,string>={
 VERIFIED:'موثّق',SELF_SUBMITTED:'قدّمه المشتري بنفسه',PROBABLE_MATCH:'تطابق محتمل',SOURCE_IDENTIFIED:'معروف من المصدر',
 PLATFORM_ACCOUNT_UNRESOLVED:'حساب على منصة خارجية',UNRESOLVED:'غير محدد بعد',PARTIAL:'محدد جزئيًا'
};
const qualAr:Record<string,string>={PENDING:'بانتظار القرار',QUALIFIED:'مؤهل',REJECTED:'مرفوض',DISQUALIFIED:'غير مؤهل'};
const typeAr:Record<string,string>={TENDER:'مناقصة',RFQ:'طلب شراء'};
const severityAr:Record<string,string>={CRITICAL:'عاجل جدًا',HIGH:'عاجل',MEDIUM:'متوسط',LOW:'عادي'};
const alertTypeAr:Record<string,string>={NEW_RFQ:'طلب جديد من مشترٍ'};
const patternAr:Record<string,string>={RECURRING:'طلب متكرر',EMERGING:'طلب ناشئ',INSUFFICIENT:'بيانات غير كافية'};
const runAr:Record<string,string>={SUCCESS:'نجح',FAILED:'فشل',RUNNING:'يعمل الآن',PARTIAL:'جزئي'};
const statusAr:Record<string,string>={NEW:'جديد',DRAFT:'مسودة',READY:'جاهز',PUBLISHED:'منشور',PENDING:'قيد الانتظار',APPROVED:'معتمد'};
const tr=(m:Record<string,string>,v?:string|null)=>v?(m[v]||v):'';
const day=(v?:string|null)=>v?v.slice(0,10):'—';
const PAGE=8;

async function api(init?:RequestInit){
 const token=accessToken();if(!token)throw new Error('UNAUTHORIZED');
 const r=await fetch(endpoint,{...init,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,...(init?.headers||{})}});
 if(r.status===401)throw new Error('UNAUTHORIZED');
 if(!r.ok)throw new Error('REQUEST_FAILED');
 return r.json();
}

export default function DemandWorkbench(){
 const [data,setData]=useState<Snapshot|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [pushState,setPushState]=useState<'idle'|'working'|'enabled'|'unsupported'|'denied'>('idle');
 const [stageFilter,setStageFilter]=useState('ALL');
 const [taskLimit,setTaskLimit]=useState(PAGE);
 const [buyerLimit,setBuyerLimit]=useState(PAGE);
 const [demandPages,setDemandPages]=useState<DemandPageRef[]>([]);
 const [replyFor,setReplyFor]=useState('');
 const [copied,setCopied]=useState('');
 useEffect(()=>{fetchDemandPages().then(setDemandPages).catch(()=>{});},[]);
 async function copyReply(id:string,text:string){
  try{await navigator.clipboard.writeText(text);setCopied(id);setTimeout(()=>setCopied(c=>c===id?'':c),2500);}catch{setCopied('');}
 }

 async function load(silent=false){
  if(!silent)setBusy(true);setError('');
  try{
   const snap=await api();
   setData(snap);
  }catch(e){
   if(e instanceof Error&&e.message==='UNAUTHORIZED'){setData(null);setError('يلزم تسجيل الدخول بحساب SEPTLION التشغيلي.');}
   else setError('تعذر تحميل لوحة التشغيل الآن.');
  }finally{if(!silent)setBusy(false)}
 }

 useEffect(()=>{
  if(accessToken())void load();else setError('يلزم تسجيل الدخول بحساب SEPTLION التشغيلي.')
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 useEffect(()=>{
  if(!accessToken())return;
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load(true)},15000);
  return()=>window.clearInterval(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 async function enablePush(){
  if(!accessToken())return;
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){setPushState('unsupported');return}
  setPushState('working');setError('');
  try{
   const permission=await Notification.requestPermission();
   if(permission!=='granted'){setPushState('denied');return}
   const registration=await navigator.serviceWorker.register('/demand-sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription){
    subscription=await registration.pushManager.subscribe({
     userVisibleOnly:true,
     applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC)
    });
   }
   await api({method:'POST',body:JSON.stringify({action:'register_push',subscription:subscription.toJSON()})});
   setPushState('enabled');
   await load(true);
  }catch{setPushState('idle');setError('تعذر تفعيل إشعارات RFQ على هذا الجهاز.')}
 }

 async function markAlert(alertId:string){
  await api({method:'POST',body:JSON.stringify({action:'mark_alert_read',alertId})});
  await load(true);
 }

 async function markAllAlerts(){
  await api({method:'POST',body:JSON.stringify({action:'mark_all_alerts_read'})});
  await load(true);
 }

 async function act(item:QueueItem,action:'start'|'complete'|'block'|'reopen'|'advance'|'publish_intent'){
  setBusy(true);setError('');
  try{
   await api({method:'POST',body:JSON.stringify({taskId:item.taskId,action})});
   await load();
  }catch{setError('تعذر تنفيذ الإجراء. أعد المحاولة.');setBusy(false)}
 }

 const sorted=useMemo(()=>[...(data?.queue||[])].sort((a,b)=>(b.priority-a.priority)||((a.dueAt||'9999').localeCompare(b.dueAt||'9999'))),[data]);
 const stageCounts=useMemo(()=>{const m=new Map<string,number>();for(const t of sorted)m.set(t.stage,(m.get(t.stage)||0)+1);return [...m.entries()]},[sorted]);
 const filtered=useMemo(()=>stageFilter==='ALL'?sorted:sorted.filter(t=>t.stage===stageFilter),[sorted,stageFilter]);

 if(!data)return <OpsFrame active="work"><div className="dw-login"><div className="dw-login-card"><p className="kicker">لوحة التشغيل الداخلية</p><h1>لوحة تشغيل الطلبات</h1><p>{error||'جارٍ التحقق من صلاحية حسابك…'}</p>{error&&<Link href="/account?next=/demand-intelligence/workbench"><button>تسجيل الدخول</button></Link>}</div></div></OpsFrame>;

 const st=data.stats;
 const pushOn=pushState==='enabled'||st.activePushSubscriptions>0;
 const pipeline:[string,number][]=[['تحديد المشتري',st.buyerResolution],['التأهيل',st.qualification],['بناء العرض',st.offerBuild],['صفحة الطلب',st.intentPage],['طلب عرض سعر',st.rfq]];
 const sourcesOk=data.sources.filter(s=>s.active&&!s.lastError).length;
 const sourcesErr=data.sources.filter(s=>s.lastError).length;
 const today=new Date().toISOString().slice(0,10);
 const shownPatterns=data.patterns.filter(p=>p.patternStatus!=='INSUFFICIENT').slice(0,6);
 const hiddenPatterns=data.patterns.length-shownPatterns.length;

 return <OpsFrame active="work"><div className="dw">

  <section className="dw-hero shell">
   <p className="kicker">لوحة التشغيل الداخلية</p>
   <h1>لوحة تشغيل الطلبات</h1>
   <p>كل طلب يصل، وكل مشترٍ محتمل، والخطوة التالية لكل صفقة، في مكان واحد.</p>
   <div className="dw-status">
    <span className="dw-chip dw-chip-live"><i/> تتحدث تلقائيًا</span>
    {pushOn
     ?<span className="dw-chip dw-chip-ok">✓ التنبيهات على الجوال مفعّلة</span>
     :<button className="dw-primary" onClick={enablePush} disabled={pushState==='working'}>{pushState==='working'?'جارٍ التفعيل…':pushState==='denied'?'الإذن مرفوض من المتصفح':pushState==='unsupported'?'المتصفح لا يدعم التنبيهات':'فعّل التنبيهات على جوالك'}</button>}
   </div>
  </section>

  <section className="dw-section dw-first shell">
   <div className="dw-head"><div><p className="kicker">يحتاج انتباهك الآن</p><h2>طلبات جديدة {data.alerts.length>0&&<em>{data.alerts.length}</em>}</h2></div>{data.alerts.length>1&&<button className="dw-link" onClick={markAllAlerts}>تمت مراجعة الكل</button>}</div>
   {data.alerts.length>0?<div className="dw-alerts">
    {data.alerts.map(a=><article key={a.id} className={'dw-alert dw-alert-'+a.severity.toLowerCase()}>
     <div><span className="dw-tag dw-tag-warn">{tr(severityAr,a.severity)} · {tr(alertTypeAr,a.type)}</span><h3>{a.title}</h3><p>{a.body}</p><small>{a.createdAt.slice(0,16).replace('T',' ')}</small></div>
     <button onClick={()=>markAlert(a.id)}>تمت المراجعة</button>
    </article>)}
   </div>:<div className="dw-empty dw-calm">لا توجد طلبات جديدة الآن. سيصلك تنبيه على الجوال فور وصول أي طلب.</div>}
  </section>

  <section className="dw-section shell">
   <div className="dw-kpis">
    <article><span>مهام مفتوحة</span><b>{sorted.length}</b></article>
    <article><span>مشترون محتملون</span><b>{st.buyers}</b></article>
    <article><span>جاهزون للتواصل</span><b>{st.buyerContactReady}</b></article>
    <article><span>جاهزون للتنفيذ</span><b>{st.buyerExecutable}</b></article>
   </div>
   <div className="dw-pipeline">
    <p>مسار الصفقات</p>
    <ol>{pipeline.map(([label,n])=><li key={label} className={n>0?'on':''}><b>{n}</b><span>{label}</span></li>)}</ol>
    <small>{st.activeSignals} إشارة شراء نشطة في {st.markets} سوقًا · {st.supplierProfiles} مورد في القاعدة</small>
   </div>
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><p className="kicker">ما يجب عمله</p><h2>المهام</h2></div><button className="dw-link" onClick={()=>load()} disabled={busy}>{busy?'يتم التحديث…':'تحديث'}</button></div>
   {stageCounts.length>1&&<div className="dw-filters">
    <button className={stageFilter==='ALL'?'on':''} onClick={()=>{setStageFilter('ALL');setTaskLimit(PAGE)}}>الكل <b>{sorted.length}</b></button>
    {stageCounts.map(([stage,n])=><button key={stage} className={stageFilter===stage?'on':''} onClick={()=>{setStageFilter(stage);setTaskLimit(PAGE)}}>{stageAr[stage]||stage} <b>{n}</b></button>)}
   </div>}
   {error&&<div className="dw-error">{error}</div>}
   <div className="dw-queue">
    {filtered.slice(0,taskLimit).map(item=>{
     const late=!!item.deadlineAt&&item.deadlineAt.slice(0,10)<today;
     const statusLine=[item.rfqSubmissionStatus&&'الطلب: '+tr(statusAr,item.rfqSubmissionStatus),item.offerStatus&&'العرض: '+tr(statusAr,item.offerStatus),item.intentStatus&&'صفحة الطلب: '+tr(statusAr,item.intentStatus),item.supplierFit&&'موردون مناسبون: '+(item.supplierFit.candidateCount||0)].filter(Boolean).join(' · ');
     return <article className="dw-task" key={item.taskId}>
     <div className="dw-task-top">
      <span className="dw-priority" title="الأولوية">{item.priority}</span>
      <div className="dw-task-title"><small>{tr(typeAr,item.type)} · {taskAr[item.taskType]||item.taskType}{item.taskStatus==='IN_PROGRESS'?' · قيد العمل':item.taskStatus==='BLOCKED'?' · معلّقة':''}</small><h3>{item.product}</h3><p>{item.market}{item.quantity?' · '+item.quantity:''}</p></div>
      <i>{stageAr[item.stage]||item.stage}</i>
     </div>
     <dl className="dw-task-facts">
      <div><dt>المشتري</dt><dd>{item.buyerName||'غير محدد بعد'}<small>{[tr(verifyAr,item.buyerVerificationStatus),item.buyerConfidence!=null?'ثقة '+item.buyerConfidence+'%':'',item.buyerContactName,item.buyerPhone,item.buyerEmail].filter(Boolean).join(' · ')}</small></dd></div>
      <div><dt>الموعد</dt><dd className={late?'dw-late':''}>{day(item.deadlineAt)}{late&&<small>انتهى الموعد</small>}</dd></div>
      <div><dt>التأهيل</dt><dd>{tr(qualAr,item.qualificationDecision)||'لم يبدأ'}<small>{item.localPartnerRequired===true?'يحتاج شريكًا محليًا':item.localPartnerRequired===false?'لا يحتاج شريكًا محليًا':''}</small></dd></div>
      <div><dt>المصدر</dt><dd>{item.sourceUrl?<a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source} ↗</a>:item.source}</dd></div>
     </dl>
     {(item.rfqReference||item.nextAction||statusLine)&&<div className="dw-next"><span>الخطوة التالية</span><b>{item.rfqReference||item.nextAction||taskAr[item.taskType]}</b>{statusLine&&<small>{statusLine}</small>}</div>}
     {replyFor===item.taskId&&item.sourceUrl&&(()=>{const text=buyerReply({buyerName:item.buyerName,product:item.product,market:item.market,quantity:item.quantity,link:replyLink(item.market,demandPages)});return <div className="dw-reply">
      <span>الرد على المشتري</span>
      <p>انسخ الرد، وافتح الطلب في {item.source}، ثم الصقه في خانة الرد هناك. بعد الإرسال اضغط «تم، انقل للمرحلة التالية».</p>
      <textarea readOnly value={text} rows={9} dir="auto" aria-label="نص الرد على المشتري"/>
      <div className="dw-reply-actions"><button className="dw-primary" onClick={()=>copyReply(item.taskId,text)}>{copied===item.taskId?'تم النسخ ✓':'نسخ الرد'}</button><a className="dw-btn" href={item.sourceUrl} target="_blank" rel="noreferrer">فتح الطلب في {item.source} ↗</a></div>
     </div>})()}
     <div className="dw-actions">
      {item.stage==='BUYER_RESOLUTION'&&item.sourceUrl&&<button className={replyFor===item.taskId?'':'dw-primary'} onClick={()=>setReplyFor(replyFor===item.taskId?'':item.taskId)}>{replyFor===item.taskId?'إخفاء الرد':'تجهيز رد للمشتري'}</button>}
      {item.stage!=='RFQ'&&item.stage!=='INTENT_PAGE'&&<button className="dw-primary" onClick={()=>act(item,'advance')}>{item.stage==='QUALIFICATION'?'اعتماد التأهيل وبناء العرض':item.stage==='OFFER_BUILD'?'اعتماد العرض':'تم، انقل للمرحلة التالية'}</button>}
      {item.stage==='INTENT_PAGE'&&item.intentStatus!=='READY'&&item.intentStatus!=='PUBLISHED'&&<button className="dw-primary" onClick={()=>act(item,'advance')}>تجهيز صفحة الطلب</button>}
      {item.stage==='INTENT_PAGE'&&item.intentStatus==='READY'&&<button className="dw-primary" onClick={()=>act(item,'publish_intent')}>نشر صفحة الطلب</button>}
      {item.stage==='INTENT_PAGE'&&item.intentStatus==='PUBLISHED'&&item.intentSlug&&<a className="dw-btn" href={'/intent/demand/?slug='+encodeURIComponent(item.intentSlug)} target="_blank" rel="noreferrer">فتح صفحة الطلب ↗</a>}
      {item.taskStatus==='OPEN'&&<button onClick={()=>act(item,'start')}>بدء العمل</button>}
      {item.taskStatus==='BLOCKED'&&<button onClick={()=>act(item,'reopen')}>إعادة فتح</button>}
      <span className="dw-actions-minor">
       <button className="dw-link" onClick={()=>act(item,'block')}>تعليق</button>
       <button className="dw-link" onClick={()=>act(item,'complete')}>إغلاق</button>
      </span>
     </div>
    </article>})}
    {!filtered.length&&<div className="dw-empty">لا توجد مهام مفتوحة حاليًا.</div>}
   </div>
   {filtered.length>taskLimit&&<button className="dw-more" onClick={()=>setTaskLimit(taskLimit+PAGE)}>عرض {Math.min(PAGE,filtered.length-taskLimit)} مهام أخرى <small>({filtered.length-taskLimit} متبقية)</small></button>}
  </section>

  <section className="dw-section shell">
   <div className="dw-head"><div><p className="kicker">من يشتري</p><h2>المشترون المحتملون</h2></div><p>مرتبون حسب الأولوية: قوة نية الشراء وسهولة الوصول إلى المشتري.</p></div>
   <div className="dw-buyers">
    {data.buyers.slice(0,buyerLimit).map(b=><article className="dw-buyer" key={b.id}>
     <div className="dw-buyer-score"><b>{b.priorityScore??b.executionScore}</b><span>أولوية</span></div>
     <div className="dw-buyer-main">
      <small>{[b.verificationStatus!=='UNRESOLVED'?tr(verifyAr,b.verificationStatus):'',b.latestIsPlatform?'عبر منصة تجارية'+(b.platformVerified?' موثّقة':''):''].filter(Boolean).join(' · ')}</small>
      <h3>{b.displayName}</h3>
      <p>{[b.country,b.latestProduct||(b.productKeys||[]).join(', '),b.latestQuantity].filter(Boolean).join(' · ')||'—'}</p>
      <div className="dw-buyer-metrics"><span>نية الشراء <b>{b.buyingIntentScore}</b></span><span>جاهزية التواصل <b>{b.contactReadinessScore}</b></span><span>إشارات <b>{b.signalCount}</b></span>{(b.recurrenceEvidenceCount||0)>0&&<span>تكرار <b>{b.recurrenceEvidenceCount}</b></span>}{b.rfqQualityScore!=null&&<span>جودة الطلب <b>{b.rfqQualityScore}</b></span>}</div>
     </div>
     <div className="dw-buyer-contact">
      <span>التواصل · آخر طلب {day(b.lastBuyingSignalAt)}</span>
      {b.primaryContactName&&<b>{b.primaryContactName}</b>}
      {b.primaryWhatsapp&&<a href={'https://wa.me/'+b.primaryWhatsapp.replace(/\D/g,'')} target="_blank" rel="noreferrer">واتساب {b.primaryWhatsapp} ↗</a>}
      {!b.primaryWhatsapp&&b.primaryPhone&&<a href={'tel:'+b.primaryPhone}>{b.primaryPhone}</a>}
      {b.primaryEmail&&<a href={'mailto:'+b.primaryEmail}>{b.primaryEmail}</a>}
      {b.latestSourceUrl&&<a href={b.latestSourceUrl} target="_blank" rel="noreferrer">{b.platformContactAvailable?'تواصل عبر '+(b.latestSource||'المنصة'):'المصدر: '+(b.latestSource||'')} ↗</a>}
      {b.website&&<a href={b.website} target="_blank" rel="noreferrer">الموقع ↗</a>}
      {!b.primaryContactName&&!b.primaryWhatsapp&&!b.primaryPhone&&!b.primaryEmail&&!b.latestSourceUrl&&<b>لا توجد وسيلة تواصل بعد</b>}
     </div>
    </article>)}
    {!data.buyers.length&&<div className="dw-empty">لا يوجد مشترون محددون بعد.</div>}
   </div>
   {data.buyers.length>buyerLimit&&<button className="dw-more" onClick={()=>setBuyerLimit(buyerLimit+PAGE)}>عرض {Math.min(PAGE,data.buyers.length-buyerLimit)} مشترين آخرين <small>({data.buyers.length-buyerLimit} متبقين)</small></button>}
  </section>

  <section className="dw-section shell">
   <details className="dw-engine">
    <summary><div><p className="kicker">خلف الكواليس</p><h2>صحة محركات الرصد</h2><small>{data.sources.length} مصدر · {sourcesOk} يعمل{sourcesErr>0?' · '+sourcesErr+' فيه خطأ':''} · {data.patterns.length} نمط طلب</small></div><span className="dw-engine-toggle">عرض التفاصيل</span></summary>
    <h4>المصادر</h4>
    <div className="dw-rows">
     {data.sources.map(s=><div key={s.id} className={s.lastError?'err':''}><b>{s.name}</b><span className="dw-state">{s.active?(s.lastError?'خطأ':'يعمل'):'متوقف'}</span><small>{s.lastError?s.lastError:s.lastSuccessAt?'آخر نجاح '+s.lastSuccessAt.slice(0,16).replace('T',' '):'لم يعمل بعد'}</small></div>)}
    </div>
    <h4>أنماط الطلب</h4>
    <p className="dw-note">لا نعرض توقعًا إلا بعد تراكم إشارات كافية، فالإشارة الواحدة تبقى «بيانات غير كافية».</p>
    <div className="dw-patterns">
     {shownPatterns.map((p,i)=><article key={p.productKey+'-'+p.market+'-'+i}><span>{tr(patternAr,p.patternStatus)}</span><h3>{p.market}</h3><p>{p.signalCount} إشارات · ثقة {p.confidence}٪ · <bdi>{p.productKey.replace(/_/g,' ')}</bdi></p><small>{p.predictedWindowStart?'النافذة المتوقعة: '+day(p.predictedWindowStart)+' ← '+day(p.predictedWindowEnd):'لا توجد نافذة متوقعة بعد'}</small></article>)}
    </div>
    <h4>آخر جولات الجمع</h4>
    <div className="dw-rows">
     {data.recentRuns.slice(0,8).map((r,i)=><div key={r.sourceId+'-'+r.startedAt+'-'+i}><b>{r.sourceId}</b><span className={'dw-state'+(r.status==='FAILED'?' bad':'')}>{tr(runAr,r.status)}</span><small>فحص {r.scanned} · قُبل {r.accepted} · {r.startedAt.slice(0,16).replace('T',' ')}</small></div>)}
    </div>
   </details>
  </section>
 </div></OpsFrame>
}
