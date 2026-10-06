'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {edge} from '../lib/api';
import {errorMessage,statusNames} from '../lib/trade-transaction';
import {useTradeWorkspace,TestNotice,TransactionTimeline,TransactionEvents,WorkspaceFallback} from './trade-workspace';
import {TransactionDocuments} from './transaction-documents';
type Entry={id:string;reference:string;status:string;testOnly:boolean};
export function OperatorExecution({onChanged}:{onChanged:()=>void}) {
 const[rows,setRows]=useState<Entry[]>([]),[selected,setSelected]=useState(''),[listError,setListError]=useState(''),[listLoading,setListLoading]=useState(true),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[resolution,setResolution]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const workspace=useTradeWorkspace('OPERATOR',selected),w=workspace.data;
 const pending=useRef<{signature:string;key:string}|null>(null),generation=useRef(0);
 async function queue(){const g=++generation.current;setListLoading(true);try{const r=await edge<{transactions:Entry[]}>('operator.queue');if(g!==generation.current)return;setRows(r.transactions);setSelected(x=>x||new URLSearchParams(window.location.search).get('transactionId')||r.transactions[0]?.id||'');setListError('');}catch(e){if(g===generation.current)setListError(errorMessage(e));}finally{if(g===generation.current)setListLoading(false);}}
 useEffect(()=>{void queue();return()=>{generation.current++;};},[]);
 useEffect(()=>{setNote('');setResolution('');setError('');setMessage('');pending.current=null;},[selected]);
 async function changed(){await workspace.reload();await queue();onChanged();}
 async function advance(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!w?.nextAction||busy)return;setBusy(true);setError('');setMessage('');
  try{const action=w.nextAction;const signature=JSON.stringify([w.item.id,w.item.version,action.status,note.trim()]);if(pending.current?.signature!==signature)pending.current={signature,key:crypto.randomUUID()};await edge('transactions.advance',{transactionId:w.item.id,expectedVersion:w.item.version,status:action.status,milestoneCode:action.milestoneCode,note:note.trim(),idempotencyKey:pending.current.key});pending.current=null;setNote('');setMessage(w.item.testOnly?'تم تسجيل حدث المحاكاة.':'تم حفظ تحديث التنفيذ.');await changed();}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function resolve(event:FormEvent<HTMLFormElement>,claimId:string){event.preventDefault();if(!w||busy)return;setBusy(true);setError('');setMessage('');try{await edge('claims.resolve',{transactionId:w.item.id,claimId,expectedVersion:w.item.version,note:resolution.trim()});setResolution('');setMessage('تم توثيق معالجة المطالبة. يمكن للمشتري مراجعة الاستلام.');await changed();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <section className="operator-execution-panel" aria-labelledby="execution-editor-title"><div className="workspace-heading"><div><small>EXECUTION CONTROL</small><h2 id="execution-editor-title">متابعة تنفيذ الصفقات</h2></div><button type="button" className="secondary-link" disabled={busy||listLoading||workspace.loading} onClick={()=>{void queue();void workspace.reload();}}>تحديث التنفيذ</button></div>
  {listError&&<p role="alert" className="workspace-error">{listError}</p>}
  {listLoading&&!rows.length?<p role="status">جارٍ تحميل الصفقات…</p>:!rows.length?<p className="workspace-muted">تظهر الصفقات هنا بعد تأكيد العرض.</p>:<><label className="operator-select">الصفقة<select value={selected} disabled={busy||workspace.loading} onChange={e=>setSelected(e.target.value)}>{rows.map(x=><option key={x.id} value={x.id}>{x.reference} · {statusNames[x.status]||x.status}</option>)}</select></label>
   {!w?<WorkspaceFallback loading={workspace.loading} error={workspace.error} onReload={()=>void workspace.reload()}/>:<><TestNotice testOnly={w.item.testOnly}/><TransactionTimeline data={w}/>
    {w.nextAction&&<form onSubmit={advance} className="execution-update"><h3>الخطوة التالية: {w.nextAction.label}</h3><p>{w.item.testOnly?'سجّل وصفًا واضحًا لحدث المحاكاة.':'سجّل مرجع التنفيذ أو الحدث الذي تحقق. يتطلب تسجيل الشحن والتسليم مستند إثبات مشتركًا.'}</p><label>مرجع التحديث وملاحظاته<textarea disabled={busy||workspace.loading} required minLength={5} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder={w.item.testOnly?'TEST — حدث محاكاة غير تجاري':'مثال: مرجع التجهيز أو الشحن وتاريخ التأكيد'}/></label><button className="primary-link" disabled={busy||workspace.loading||note.trim().length<5}>{busy?'جارٍ الحفظ…':(w.item.testOnly?'محاكاة: ':'')+w.nextAction.label}</button></form>}
    {w.claims.length>0&&<div className="claim-workspace"><h3>المطالبات</h3>{w.claims.map(claim=><article key={claim.id}><b>{['OPEN','UNDER_REVIEW'].includes(claim.status)?'مطالبة مفتوحة':'تمت المعالجة'}</b><p>{claim.description}</p>{claim.resolution?.note&&<p className="claim-resolution">المعالجة: {claim.resolution.note}</p>}{['OPEN','UNDER_REVIEW'].includes(claim.status)&&<form onSubmit={event=>void resolve(event,claim.id)}><label>وصف المعالجة<textarea required minLength={5} maxLength={2000} disabled={busy||workspace.loading} value={resolution} onChange={e=>setResolution(e.target.value)}/></label><button className="primary-link" disabled={busy||workspace.loading||resolution.trim().length<5}>{busy?'جارٍ الحفظ…':w.item.testOnly?'محاكاة معالجة المطالبة':'توثيق معالجة المطالبة'}</button></form>}</article>)}</div>}
    {['RECEIPT_REVIEW','CLAIM_OPEN'].includes(w.item.status)&&<p className="workspace-muted">تأكيد الاستلام يخص المشتري بعد مراجعة التنفيذ ومعالجة أي مطالبة.</p>}
    {w.item.status==='COMPLETED'&&<p className="workspace-success">{w.item.testOnly?'اكتملت حالة المحاكاة غير التجارية.':'اكتملت الصفقة بتأكيد المشتري.'}</p>}
    {error&&<p role="alert" className="workspace-error">{error}</p>}{message&&<p role="status" className="workspace-success">{message}</p>}
    <TransactionDocuments transactionId={w.item.id} side="OPERATOR" onChanged={()=>void workspace.reload()}/><TransactionEvents data={w}/><a className="secondary-link" href={'/execution?id='+encodeURIComponent(w.item.id)}>فتح متابعة المشتري</a>
   </>}
  </>}
 </section>;
}
