'use client';
import {useCallback,useEffect,useState} from 'react';
import {BuyerShell,Stage,RequestSummary} from '../../components/buyer-shell';
import {activeRequestId,rememberActiveRequest} from '../../lib/buyer-ui-store';
import {RequestDetail,tradeRequestDetails} from '../../lib/trade-data';
import {hasSession} from '../../lib/api';
import {statusNames} from '../../lib/trade-transaction';
export default function Request(){
 const[detail,setDetail]=useState<RequestDetail|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const id=new URLSearchParams(window.location.search).get('id')||activeRequestId();if(!id){setDetail(null);return;}const result=await tradeRequestDetails(id);rememberActiveRequest(result.request.id);setDetail(result);}catch(e){setError(e instanceof Error?e.message:'تعذر فتح الطلب.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const r=detail?.request,offer=detail?.offer,tx=detail?.transaction;
 const returnTo='/request'+(r?'?id='+encodeURIComponent(r.id):typeof window!=='undefined'?window.location.search:'');
 return <BuyerShell title="تفاصيل الطلب" context={{requestId:r?.id,offerId:offer?.id,transactionId:tx?.id}}><section className="buyer-section">
 {loading?<p className="workspace-loading" role="status">جارٍ فتح الطلب وحالته التجارية…</p>:error?<div className="empty-state"><b role="alert">{error}</b><div className="two-actions">{hasSession()?<button className="primary-link" onClick={()=>void load()}>إعادة المحاولة</button>:<a className="primary-link" href={'/account?next='+encodeURIComponent(returnTo)}>تسجيل الدخول والمتابعة</a>}<a className="secondary-link" href="/requests">طلباتي</a></div></div>:!r?<div className="empty-state"><b>اختر طلبًا لعرض تفاصيله</b><a className="primary-link" href="/requests">طلباتي</a></div>:<>
 <Stage current={tx?['DELIVERED','RECEIPT_REVIEW'].includes(tx.status)?4:tx.status==='COMPLETED'?5:3:offer?1:0}/><RequestSummary request={r}/>
 <div className="customer-next-action"><div><small>الخطوة التالية</small><h1>{tx?(statusNames[tx.status]||tx.status):offer?'عرض Septlion جاهز للمراجعة':'طلبك لدى Septlion'}</h1><p>{tx?'افتح مساحة التنفيذ لمراجعة آخر تحديث والمستندات والخطوة المطلوبة منك.':offer?'راجع نسخة العرض وشروطها وصلاحيتها قبل القبول.':'المتطلبات مسجلة. سيظهر عرض Septlion هنا عند إصداره.'}</p></div><div className="two-actions">{tx?<a className="primary-link" href={'/execution?id='+encodeURIComponent(tx.id)}>متابعة الصفقة</a>:offer?<a className="primary-link" href={'/offer?requirement='+encodeURIComponent(r.id)}>مراجعة العرض · نسخة {offer.currentRevision}</a>:<button className="secondary-link" onClick={()=>void load()}>تحديث حالة الطلب</button>}<a className="secondary-link" href="/requests">طلباتي</a></div></div>
 <div className="terms-grid">{[['مرجع طلب العرض',detail?.rfq?.reference||'—'],['التعبئة',r.packing],['تاريخ التسجيل',new Date(r.createdAt).toLocaleString('ar')],['طريقة الدفع',r.payment==='OTHER'?'تُناقش في العرض':r.payment]].map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
 </>}
 </section></BuyerShell>;
}
