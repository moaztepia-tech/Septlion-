'use client';
import { FormEvent, useEffect, useState } from 'react';
import { BuyerShell } from '../../components/buyer-shell';
import {OperatorExecution} from '../../components/operator-execution';
import { edge, hasSession } from '../../lib/api';
type Dashboard={health:Record<string,number>;opportunities:any[];outbox:any[]};
type Rfq={id:string;reference:string;status:string};
type Detail={rfq:Rfq;requirement:{product:string;quantity:number|null;unit:string|null;market:string;deliveryPort:string|null;deliveryCountry:string|null;incoterm:string|null;paymentPreference:string|null};offer:{id:string;status:string}|null};
const counts=[['الطلبات','requirements'],['RFQs المفتوحة','openRfqs'],['العروض','offers'],['صفقات نشطة','activeTransactions'],['صفقات مكتملة','completedTransactions'],['مطالبات مفتوحة','openClaims']] as const;
export default function Operations(){
 const[d,setD]=useState<Dashboard|null>(null),[rfqs,setRfqs]=useState<Rfq[]>([]),[selected,setSelected]=useState(''),[detail,setDetail]=useState<Detail|null>(null);
 const[err,setErr]=useState(''),[formErr,setFormErr]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const[description,setDescription]=useState(''),[quantity,setQuantity]=useState(''),[unit,setUnit]=useState(''),[price,setPrice]=useState('');
 const[currency,setCurrency]=useState('USD'),[incoterm,setIncoterm]=useState(''),[payment,setPayment]=useState(''),[valid,setValid]=useState(''),[evidence,setEvidence]=useState(''),[notes,setNotes]=useState(''),[key,setKey]=useState('');
 async function load(){
  if(!hasSession()){setErr('سجل الدخول بحساب SEPTLION التشغيلي.');return}
  try{const[dashboard,queue]=await Promise.all([edge<Dashboard>('operator.dashboard'),edge<{rfqs:Rfq[]}>('operator.queue')]);setD(dashboard);setRfqs(queue.rfqs);setSelected(x=>x||queue.rfqs[0]?.id||'');setErr('')}
  catch(e){setErr(e instanceof Error?e.message:'تعذر تحميل العمليات')}
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{
  if(!selected)return;let cancelled=false;setDetail(null);setFormErr('');setMessage('');
  edge<Detail>('operator.rfq',{id:selected}).then(x=>{if(cancelled)return;setDetail(x);setDescription(x.requirement.product);setQuantity(String(x.requirement.quantity||''));setUnit(x.requirement.unit||'');setPrice('');setIncoterm(x.requirement.incoterm||'');setPayment(x.requirement.paymentPreference||'');setValid(new Date(Date.now()+7*86400000).toISOString().slice(0,10));setEvidence('');setNotes('');setKey(crypto.randomUUID())}).catch(e=>{if(!cancelled)setFormErr(e.message)});
  return()=>{cancelled=true};
 },[selected]);
 const test=/^TEST(?:\s|—|-|$)/i.test(detail?.requirement.product||'');const total=Number(quantity)*Number(price);
 async function issue(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!detail||detail.offer||busy)return;setBusy(true);setFormErr('');setMessage('');
  try{await edge('offers.issue',{rfqId:detail.rfq.id,currency,validUntil:new Date(valid+'T23:59:59Z').toISOString(),idempotencyKey:key,snapshot:{items:[{description,quantity:Number(quantity),unit,unitPrice:Number(price)}],terms:{incoterm,payment,notes},supplyEvidence:{reference:evidence}}});
   setDetail(await edge<Detail>('operator.rfq',{id:detail.rfq.id}));setMessage('تم إصدار العرض وحفظ بنوده. أصبح المستند متاحًا.');await load()
  }catch(x){setFormErr(x instanceof Error?x.message:'تعذر إصدار العرض')}finally{setBusy(false)}
 }
 return <BuyerShell title="مركز العمليات" eyebrow="SEPTLION OPERATIONS"><section className="buyer-section">
  <div className="section-intro"><small>CONTROL TOWER</small><h1>إدارة الطلبات والعروض</h1><p>تابع الطلب المحفوظ وأصدر عرض Septlion بعد التحقق من بنوده ومصدره.</p></div>
  {err&&<div className="empty-state"><b role="alert">{err}</b><a className="primary-link" href="/account?next=/operations">الحساب</a></div>}
  {!d&&!err&&<p role="status">جارٍ تحميل مركز العمليات…</p>}
  {d&&<>
   <div className="terms-grid">{counts.map(([label,k])=><div key={k}><small>{label}</small><b>{d.health[k]??0}</b></div>)}</div>
   <p className="workspace-muted">الإحصاءات التجارية تستبعد حالات TEST. حالات المحاكاة: {d.health.testTransactions??0}</p>
   <OperatorExecution onChanged={()=>void load()}/>
   <section className="operator-offer-panel" aria-labelledby="offer-editor-title"><div className="section-intro"><small>RFQ → OFFER</small><h2 id="offer-editor-title">إصدار العرض</h2></div>
    {rfqs.length===0?<div className="empty-state"><b>لا توجد طلبات مفتوحة لإصدار عرض</b></div>:<>
     <label className="operator-select">طلب عرض السعر<select disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}>{rfqs.map(x=><option key={x.id} value={x.id}>{x.reference} · {x.status}</option>)}</select></label>
     {!detail&&!formErr&&<p role="status">جارٍ تحميل تفاصيل الطلب…</p>}
     {detail&&<>
      <div className="operator-request"><h3>{detail.requirement.product}</h3><p>{detail.requirement.deliveryPort||detail.requirement.deliveryCountry||detail.requirement.market} · {detail.requirement.quantity} {detail.requirement.unit}</p></div>
      {test&&<p className="test-notice"><b>TEST — اختبار غير تجاري</b><br/>الأرقام والشروط التالية تخص اختبار النظام فقط، ولا تنشئ بيعًا أو التزامًا بالدفع.</p>}
      {detail.offer?<div className="offer-note"><b>العرض محفوظ · {detail.offer.status}</b><p>راجع مستند النسخة المحفوظة ونزّله.</p><a className="primary-link" href={'/offer-document?id='+encodeURIComponent(detail.offer.id)}>فتح مستند العرض</a></div>:<form className="operator-offer-form" onSubmit={issue}>
       <label className="wide">وصف البند<input disabled={busy} required maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
       <label>الكمية<input disabled={busy} required type="number" min="0.001" max="1000000000" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
       <label>الوحدة<input disabled={busy} required maxLength={30} value={unit} onChange={e=>setUnit(e.target.value)}/></label>
       <label>سعر الوحدة<input disabled={busy} required type="number" min="0.01" max="1000000000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
       <label>العملة<select disabled={busy} value={currency} onChange={e=>setCurrency(e.target.value)}>{['USD','EUR','AED','SAR','EGP'].map(x=><option key={x}>{x}</option>)}</select></label>
       <label>شرط التجارة<select disabled={busy} required value={incoterm} onChange={e=>setIncoterm(e.target.value)}><option value="">اختر الشرط</option>{['FOB','CIF','EXW','DAP','FCA'].map(x=><option key={x}>{x}</option>)}</select></label>
       <label>شروط الدفع<select disabled={busy} required value={payment} onChange={e=>setPayment(e.target.value)}><option value="">اختر الدفع</option><option value="LC">LC</option><option value="TT">TT</option><option value="OPEN_ACCOUNT">Open Account</option></select></label>
       <label>صالح حتى<input disabled={busy} required type="date" min={new Date().toISOString().slice(0,10)} value={valid} onChange={e=>setValid(e.target.value)}/></label>
       {!test&&<label>مرجع عرض المورد<input disabled={busy} required maxLength={200} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>}
       <label className="wide">ملاحظات العرض<textarea disabled={busy} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
       <div className="operator-total wide"><span>الإجمالي {test?'التجريبي':''}</span><b>{Number.isFinite(total)&&total>0?total.toLocaleString('en',{maximumFractionDigits:2})+' '+currency:'أدخل السعر والكمية'}</b></div>
       <button className="primary-link wide" disabled={busy}>{busy?'جارٍ الإصدار…':test?'إصدار عرض TEST غير ملزم':'إصدار عرض Septlion'}</button>
      </form>}
     </>}
    </>}
    {formErr&&<p className="operator-error" role="alert">{formErr}</p>}{message&&<p role="status">{message}</p>}
   </section>
   <div className="section-intro"><small>DEMAND → SUPPLY</small><h2>الفرص ومصادر التوريد</h2></div>
   {d.opportunities.length===0?<div className="empty-state"><b>لا توجد فرص تشغيلية بعد</b></div>:<div className="document-list">{d.opportunities.map(x=><div key={x.id}><span><b>{x.title||x.product}</b><small>{x.market} · {x.status} · {x.nextAction||'—'}</small></span></div>)}</div>}
   <div className="section-intro"><h2>متابعة الإشعارات</h2></div>
   {d.outbox.length===0?<div className="empty-state"><b>لا توجد أحداث اتصال معلقة أو فاشلة</b></div>:<div className="document-list">{d.outbox.map(x=><div key={x.id}><span><b>{x.type}</b><small>{x.status} · محاولات {x.attempts}</small></span>{x.status==='FAILED'&&<button onClick={async()=>{try{await edge('outbox.retry',{id:x.id});await load()}catch(e){setErr(e instanceof Error?e.message:'تعذر تكرار الإشعار')}}}>إعادة</button>}</div>)}</div>}
  </>}
 </section></BuyerShell>;
}

