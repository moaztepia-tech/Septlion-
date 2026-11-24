'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {OperatorExecution} from '../../components/operator-execution';
import { edge, hasSession } from '../../lib/api';
import {OpsFrame,OpsRfq,OpsRequirement,place,statusOf,isTest,amount,packingOf,ago,waLink,nNew} from '../../components/ops-console';

type Dashboard={health:Record<string,number>;opportunities:any[];outbox:any[]};
type Detail={rfq:OpsRfq;requirement:OpsRequirement;offer:{id:string;status:string}|null};
type Tab='requests'|'deals'|'system';
type Filter='new'|'sent'|'all';
const PAY:Record<string,string>={LC:'اعتماد مستندي (L/C)','L/C':'اعتماد مستندي (L/C)',TT:'تحويل بنكي (TT)',OPEN_ACCOUNT:'حساب مفتوح'};

export default function Operations(){
 const[tab,setTab]=useState<Tab>('requests'),[filter,setFilter]=useState<Filter>('new'),[showTest,setShowTest]=useState(false);
 const[d,setD]=useState<Dashboard|null>(null),[rfqs,setRfqs]=useState<OpsRfq[]|null>(null),[selected,setSelected]=useState(''),[detail,setDetail]=useState<Detail|null>(null);
 const[err,setErr]=useState(''),[formErr,setFormErr]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const[description,setDescription]=useState(''),[quantity,setQuantity]=useState(''),[unit,setUnit]=useState(''),[price,setPrice]=useState('');
 const[currency,setCurrency]=useState('USD'),[incoterm,setIncoterm]=useState(''),[payment,setPayment]=useState(''),[valid,setValid]=useState(''),[evidence,setEvidence]=useState(''),[notes,setNotes]=useState(''),[key,setKey]=useState('');
 const load=useCallback(async()=>{
  if(!hasSession()){setErr('سجّل الدخول بحساب فريق سبتليون لرؤية الطلبات.');return}
  try{const[dashboard,queue]=await Promise.all([edge<Dashboard>('operator.dashboard'),edge<{rfqs:OpsRfq[]}>('operator.queue')]);setD(dashboard);setRfqs(queue.rfqs);setErr('')}
  catch(e){setErr(e instanceof Error?e.message:'تعذر تحميل الطلبات')}
 },[]);
 useEffect(()=>{void load();const q=new URLSearchParams(window.location.search);const id=q.get('rfq');if(id)setSelected(id);if(q.get('tab')==='deals'||q.get('transactionId'))setTab('deals')},[load]);
 useEffect(()=>{
  if(!selected){setDetail(null);return}let cancelled=false;setDetail(null);setFormErr('');setMessage('');
  edge<Detail>('operator.rfq',{id:selected}).then(x=>{if(cancelled)return;setDetail(x);setDescription([x.requirement.product,packingOf(x.requirement)].filter(Boolean).join(' — '));setQuantity(String(Number(x.requirement.quantity)||''));setUnit(x.requirement.unit||'');setPrice('');setIncoterm(x.requirement.incoterm||x.rfq.incoterm||'');setPayment((x.requirement.paymentPreference||'').replace('L/C','LC'));setValid(new Date(Date.now()+7*86400000).toISOString().slice(0,10));setEvidence('');setNotes('');setKey(crypto.randomUUID())}).catch(e=>{if(!cancelled)setFormErr(e.message)});
  return()=>{cancelled=true};
 },[selected]);
 const open=(id:string)=>{setSelected(id);try{const u=new URL(window.location.href);if(id)u.searchParams.set('rfq',id);else u.searchParams.delete('rfq');history.replaceState(null,'',u)}catch{};if(id&&window.innerWidth<900)window.scrollTo({top:0})};

 const real=useMemo(()=>(rfqs||[]).filter(r=>showTest||!isTest(r)),[rfqs,showTest]);
 const counts={new:real.filter(r=>r.status==='OPEN').length,sent:real.filter(r=>r.status!=='OPEN').length,all:real.length};
 const shown=real.filter(r=>filter==='all'||(filter==='new'?r.status==='OPEN':r.status!=='OPEN'));
 const testCount=(rfqs||[]).filter(isTest).length;

 const test=/^TEST(?:\s|—|-|$)/i.test(detail?.requirement.product||'');const total=Number(quantity)*Number(price);
 async function issue(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!detail||detail.offer||busy)return;setBusy(true);setFormErr('');setMessage('');
  try{await edge('offers.issue',{rfqId:detail.rfq.id,currency,validUntil:new Date(valid+'T23:59:59Z').toISOString(),idempotencyKey:key,snapshot:{items:[{description,quantity:Number(quantity),unit,unitPrice:Number(price)}],terms:{incoterm,payment,notes},supplyEvidence:{reference:evidence}}});
   setDetail(await edge<Detail>('operator.rfq',{id:detail.rfq.id}));setMessage('تم إصدار العرض وحفظه. يمكنك فتح مستند العرض ومشاركته مع العميل.');await load()
  }catch(x){setFormErr(x instanceof Error?x.message:'تعذر إصدار العرض')}finally{setBusy(false)}
 }

 const q=detail?.requirement;const p=place(q||detail?.rfq);const buyer=q?.buyer||null;const wa=waLink(buyer?.whatsapp);
 return <OpsFrame active="requests">
  <div className="ops-row">
   <div><h1 className="ops-h1">الطلبات</h1><p className="ops-sub">{rfqs?(counts.new?`${nNew(counts.new)} بانتظار عرض سعر`:'لا توجد طلبات جديدة الآن'):'طلبات العملاء الواردة من الموقع'}</p></div>
   <div className="ops-chips" role="tablist" aria-label="عرض">
    {([['requests','الطلبات'],['deals','الصفقات'],['system','النظام']] as const).map(([k,l])=><button key={k} role="tab" className="ops-chip" aria-pressed={tab===k} aria-selected={tab===k} onClick={()=>setTab(k)}>{l}</button>)}
   </div>
  </div>
  {err&&<div className="ops-card ops-row"><p className="ops-alert" role="alert">{err}</p><a className="ops-btn pri" href="/account?next=/operations">تسجيل الدخول</a></div>}
  {!err&&!rfqs&&<p className="ops-sub" role="status">جارٍ تحميل الطلبات…</p>}

  {tab==='requests'&&rfqs&&<div className={'ops-split'+(selected?' has-detail':'')}>
   <section className="ops-split-list" aria-label="قائمة الطلبات">
    <div className="ops-row" style={{marginBottom:10}}>
     <div className="ops-chips">
      {([['new','جديدة'],['sent','أُرسل العرض'],['all','الكل']] as const).map(([k,l])=><button key={k} className="ops-chip" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}<i>{counts[k]}</i></button>)}
     </div>
     {testCount>0&&<button className="ops-link" onClick={()=>setShowTest(x=>!x)}>{showTest?'إخفاء طلبات الاختبار':`طلبات الاختبار (${testCount})`}</button>}
    </div>
    {shown.length===0?<div className="ops-empty">{filter==='new'?'لا توجد طلبات جديدة الآن. ستظهر هنا فور إرسال العميل طلبه.':'لا توجد طلبات هنا.'}</div>:
    <div className="ops-list">{shown.map(r=>{const rq=r.requirement;const pl=place(rq||r);const st=statusOf(r.status);const b=rq?.buyer;return <button key={r.id} className="ops-item" aria-current={selected===r.id} onClick={()=>open(r.id)}>
     <div className="ops-item-top"><span className="ops-item-place">{pl.flag&&<span className="ops-flag" aria-hidden>{pl.flag}</span>}{pl.label}</span><span>{ago(r.createdAt)}</span></div>
     <h3>{rq?.product||r.reference}{isTest(r)&&<span className="ops-test">اختبار</span>}</h3>
     <div className="ops-item-meta">{[amount(rq),packingOf(rq),r.incoterm||rq?.incoterm].filter(Boolean).join(' · ')}</div>
     <div className="ops-item-foot"><span className="ops-item-meta">{b?[b.name,b.company].filter(Boolean).join(' — '):'—'}</span><span className={'ops-badge '+st.tone}>{st.label}</span></div>
    </button>})}</div>}
   </section>
   <section className="ops-split-detail" aria-label="تفاصيل الطلب">
    {!selected?<div className="ops-empty">اختر طلبًا من القائمة لعرض تفاصيله وإرسال عرض السعر.</div>:
    <div className="ops-detail">
     <button className="ops-link ops-detail-back" onClick={()=>open('')}>→ كل الطلبات</button>
     {!detail&&!formErr&&<p className="ops-sub" role="status">جارٍ تحميل الطلب…</p>}
     {detail&&q&&<>
      <div className="ops-card">
       <div className="ops-detail-head"><div><span className="ops-ref">{detail.rfq.reference}</span><h2 className="ops-h1" style={{fontSize:22}}>{q.product}</h2></div><span className={'ops-badge '+statusOf(detail.rfq.status).tone}>{statusOf(detail.rfq.status).label}</span></div>
       <dl className="ops-facts" style={{marginTop:12}}>
        <div><dt>الكمية</dt><dd>{amount(q)||'—'}</dd></div>
        <div><dt>التعبئة</dt><dd>{packingOf(q)||'—'}</dd></div>
        <div><dt>الوجهة</dt><dd>{p.flag&&<span className="ops-flag" aria-hidden>{p.flag} </span>}{p.label}</dd></div>
        <div><dt>شرط التسليم</dt><dd>{q.incoterm||detail.rfq.incoterm||'—'}</dd></div>
        <div><dt>الدفع المفضّل</dt><dd>{PAY[q.paymentPreference||'']||q.paymentPreference||'—'}</dd></div>
        <div><dt>وصل</dt><dd>{ago((detail.rfq as any).createdAt)||'—'}</dd></div>
       </dl>
      </div>
      <div className="ops-card ops-person">
       <div><small>العميل</small><b>{buyer?.name||'غير محدد'}</b><small>{[buyer?.company,buyer?.email].filter(Boolean).join(' · ')}</small></div>
       <div className="ops-actions">
        {wa&&<a className="ops-btn" href={wa} target="_blank" rel="noopener">واتساب</a>}
        {buyer?.email&&<a className="ops-btn" href={'mailto:'+buyer.email+'?subject='+encodeURIComponent('عرض سعر — '+detail.rfq.reference)}>بريد</a>}
       </div>
      </div>
      {test&&<p className="ops-card ops-alert"><b>طلب اختبار.</b> لا يُنشئ بيعًا أو التزامًا بالدفع.</p>}
      {detail.offer?<div className="ops-card ops-row"><div><b>تم إصدار العرض</b><p className="ops-sub">العرض محفوظ ({statusOf(detail.offer.status).label}). افتح المستند لمراجعته أو مشاركته.</p></div><a className="ops-btn pri" href={'/offer-document?id='+encodeURIComponent(detail.offer.id)}>فتح مستند العرض</a></div>:
      <form className="ops-card" onSubmit={issue}>
       <h2 className="ops-h2" style={{marginBottom:12}}>إصدار عرض سعر</h2>
       <div className="ops-form">
        <label className="wide">وصف البند<input disabled={busy} required maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>الكمية<input disabled={busy} required type="number" inputMode="decimal" min="0.001" max="1000000000" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
        <label>الوحدة<input disabled={busy} required maxLength={30} value={unit} onChange={e=>setUnit(e.target.value)}/></label>
        <label>سعر الوحدة<input disabled={busy} required type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00"/></label>
        <label>العملة<select disabled={busy} value={currency} onChange={e=>setCurrency(e.target.value)}>{['USD','EUR','AED','SAR','EGP'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>شرط التسليم<select disabled={busy} required value={incoterm} onChange={e=>setIncoterm(e.target.value)}><option value="">اختر</option>{['FOB','CIF','CFR','EXW','DAP','FCA'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>الدفع<select disabled={busy} required value={payment} onChange={e=>setPayment(e.target.value)}><option value="">اختر</option><option value="LC">اعتماد مستندي (L/C)</option><option value="TT">تحويل بنكي (TT)</option><option value="OPEN_ACCOUNT">حساب مفتوح</option></select></label>
        <label>العرض صالح حتى<input disabled={busy} required type="date" min={new Date().toISOString().slice(0,10)} value={valid} onChange={e=>setValid(e.target.value)}/></label>
        {!test&&<label>مرجع عرض المورد<input disabled={busy} required maxLength={200} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="رقم عرض المصنع أو المورد"/></label>}
        <label className="wide">ملاحظات للعميل<textarea disabled={busy} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <div className="ops-total wide"><span>الإجمالي</span><b>{Number.isFinite(total)&&total>0?total.toLocaleString('en',{maximumFractionDigits:2})+' '+currency:'—'}</b></div>
        <button className="ops-btn pri wide" disabled={busy}>{busy?'جارٍ الإصدار…':test?'إصدار عرض اختبار':'إصدار العرض'}</button>
       </div>
      </form>}
     </>}
     {formErr&&<p className="ops-alert" role="alert">{formErr}</p>}{message&&<p className="ops-ok" role="status">{message}</p>}
    </div>}
   </section>
  </div>}

  {tab==='deals'&&<section className="ops-card command-data"><OperatorExecution onChanged={()=>void load()}/></section>}

  {tab==='system'&&d&&<>
   <div className="ops-stats">{([['الطلبات','requirements'],['طلبات مفتوحة','openRfqs'],['العروض','offers'],['صفقات نشطة','activeTransactions'],['صفقات مكتملة','completedTransactions'],['مطالبات مفتوحة','openClaims']] as const).map(([l,k])=><div key={k} className="ops-stat"><b>{d.health[k]??0}</b><small>{l}</small></div>)}</div>
   <p className="ops-sub">الأرقام لا تشمل طلبات الاختبار ({d.health.testTransactions??0}).</p>
   <section className="ops-card"><h2 className="ops-h2">الفرص ومصادر التوريد</h2>
    {d.opportunities.length===0?<p className="ops-sub">لا توجد فرص بعد.</p>:<div className="ops-list" style={{marginTop:10}}>{d.opportunities.map(x=><div key={x.id} className="ops-item" style={{cursor:'default'}}><b>{x.title||x.product}</b><div className="ops-item-meta">{[x.market,x.status,x.nextAction].filter(Boolean).join(' · ')}</div></div>)}</div>}
   </section>
   <section className="ops-card"><h2 className="ops-h2">الإشعارات</h2>
    {d.outbox.length===0?<p className="ops-sub">لا توجد إشعارات معلّقة أو فاشلة.</p>:<div className="ops-list" style={{marginTop:10}}>{d.outbox.map(x=><div key={x.id} className="ops-item ops-row" style={{cursor:'default'}}><span><b>{x.type}</b><div className="ops-item-meta">{({FAILED:'فشل الإرسال',PENDING:'بانتظار الإرسال',SENT:'أُرسل'} as Record<string,string>)[x.status]||x.status} · محاولات {x.attempts??0}</div></span>{x.status==='FAILED'&&<button className="ops-btn" onClick={async()=>{try{await edge('outbox.retry',{id:x.id});await load()}catch(e){setErr(e instanceof Error?e.message:'تعذر إعادة الإرسال')}}}>إعادة</button>}</div>)}</div>}
   </section>
  </>}
 </OpsFrame>;
}
