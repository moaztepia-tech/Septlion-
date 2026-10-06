'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {edge,hasSession} from '../lib/api';
import {TradeSide,TradeWorkspace,statusNames,errorMessage} from '../lib/trade-transaction';

export function useTradeWorkspace(side:TradeSide='BUYER',selectedId?:string) {
 const[id,setId]=useState(''),[data,setData]=useState<TradeWorkspace|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const request=useRef(0);
 useEffect(()=>{const next=selectedId!==undefined?selectedId:new URLSearchParams(window.location.search).get('id')||sessionStorage.getItem('septlion_active_transaction')||'';setId(next);if(next&&side==='BUYER')sessionStorage.setItem('septlion_active_transaction',next);},[side,selectedId]);
 const reload=useCallback(async()=>{
  const sequence=++request.current;setError('');if(!id){setData(null);setLoading(false);return;}
  if(!hasSession()){setData(null);setError('سجل الدخول لعرض الصفقة.');return;}setLoading(true);
  try{const saved=await edge<TradeWorkspace>(side==='OPERATOR'?'operator.transaction':'transactions.get',{id});if(sequence===request.current)setData(saved);}
  catch(e){if(sequence===request.current){setData(null);setError(errorMessage(e));}}
  finally{if(sequence===request.current)setLoading(false);}
 },[id,side]);
 useEffect(()=>{void reload();return()=>{request.current++;};},[reload]);
 return{id,data,loading,error,reload};
}
export function TestNotice({testOnly}:{testOnly:boolean}) {return testOnly?<p className="test-notice"><b>TEST — محاكاة غير تجارية</b><br/>هذه الحالة لا تمثل بيعًا أو دفعًا أو تجهيزًا أو شحنًا أو استلامًا فعليًا. جميع أحداثها مسجلة للاختبار فقط.</p>:null;}
export function WorkspaceFallback({loading,error,onReload}:{loading:boolean;error:string;onReload:()=>void}) {
 return loading?<p role="status" className="workspace-loading">جارٍ تحميل الصفقة المحفوظة…</p>:<div className="empty-state"><b role={error?'alert':undefined}>{error||'لا توجد صفقة محددة'}</b><div className="two-actions">{error&&<button type="button" className="secondary-link" onClick={onReload}>إعادة المحاولة</button>}<a className="primary-link" href="/requests">طلباتي</a></div></div>;
}
export function TransactionTimeline({data}:{data:TradeWorkspace}) {
 return <div className="transaction-progress"><div className="workspace-summary"><b>{statusNames[data.item.status]||data.item.status}</b><span>نسخة {data.item.version} · {new Date(data.item.updatedAt).toLocaleString('ar')}</span></div><ol className="transaction-timeline">{data.milestones.map(m=><li key={m.code} className={m.status==='COMPLETED'?'is-complete':m.status==='IN_PROGRESS'?'is-running':''}><span aria-hidden="true">{m.status==='COMPLETED'?'✓':'•'}</span><div><b>{m.label}</b><small>{m.status==='COMPLETED'?'مكتملة':m.status==='IN_PROGRESS'?'قيد التنفيذ':'بانتظار المرحلة'}{m.completedAt?' · '+new Date(m.completedAt).toLocaleString('ar'):''}</small></div></li>)}</ol></div>;
}
const eventNames:Record<string,string>={TRANSACTION_COMMITTED:'تثبيت الطلب',STATUS_CHANGED:'تحديث التنفيذ',DOCUMENT_READY:'اعتماد مستند',CLAIM_OPENED:'فتح مطالبة',CLAIM_RESOLVED:'معالجة مطالبة',RECEIPT_ACCEPTED:'تأكيد الاستلام',REORDER_CREATED:'إنشاء إعادة الطلب'};
export function TransactionEvents({data}:{data:TradeWorkspace}) {return <details className="transaction-events"><summary>سجل الأحداث · {data.events.length}</summary><ol>{data.events.map(e=><li key={e.id}><b>{eventNames[e.type]||'حدث مسجل'}</b><time>{new Date(e.occurredAt).toLocaleString('ar')}</time><p>{e.payload.input?.note||e.payload.note||e.payload.description||e.payload.fileName||''}</p></li>)}</ol></details>;}
