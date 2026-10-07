'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {BuyerShell,Stage} from '../../components/buyer-shell';
import {activeRequestId,rememberActiveRequest} from '../../lib/buyer-ui-store';
import {RequestDetail,tradeRequestDetails} from '../../lib/trade-data';
import {acceptBuyerOffer,buyerOffer,BuyerOffer,offerForRequirement} from '../../lib/offer-data';
import {canAcceptOffer} from '../../lib/customer-journey';
import {hasSession} from '../../lib/api';
export default function Offer(){
 const[detail,setDetail]=useState<RequestDetail|null>(null),[offer,setOffer]=useState<BuyerOffer|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false);
 const accepting=useRef(false);
 const load=useCallback(async()=>{setLoading(true);setError('');setReviewed(false);setDetail(null);setOffer(null);try{
   const query=new URLSearchParams(window.location.search),offerId=query.get('id'),requestId=query.get('requirement')||activeRequestId();
   if(!offerId&&!requestId){setDetail(null);setOffer(null);return;}
   const result=offerId?await buyerOffer(offerId):await offerForRequirement(requestId!);
   const requirement=result?.requirementId||requestId;
   if(!requirement)throw new Error('تعذر قراءة الطلب المرتبط بالعرض.');
   const request=await tradeRequestDetails(requirement);rememberActiveRequest(requirement);setDetail(request);setOffer(result);
 }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل العرض.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const snapshot=offer?.revision?.snapshot,items:Array<{description:string;quantity:number;unit:string;unitPrice:number}>=Array.isArray(snapshot?.items)?snapshot.items:[];
 const testOnly=Boolean(snapshot?.testOnly),terms=snapshot?.terms||{},total=items.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unitPrice),0);
 const eligible=offer&&canAcceptOffer(offer.status,offer.validUntil),r=detail?.request,tx=detail?.transaction;
 async function accept(){
   if(!offer||!reviewed||accepting.current)return;
   if(!canAcceptOffer(offer.status,offer.validUntil)){setReviewed(false);setError('انتهت صلاحية هذه النسخة. حدّث العرض قبل المتابعة.');return;}
   accepting.current=true;setBusy(true);setError('');
   try{const result=await acceptBuyerOffer(offer.id,offer.currentRevision,testOnly?'TEST':'COMMERCIAL');if(!result.transactionId)throw new Error('تعذر قراءة مرجع الصفقة.');sessionStorage.setItem('septlion_active_transaction',result.transactionId);window.location.href='/commit?id='+encodeURIComponent(result.transactionId);}
   catch(e){setReviewed(false);setError(e instanceof Error?e.message:'تعذر تثبيت العرض.');}
   finally{accepting.current=false;setBusy(false);}
 }
 return <BuyerShell title="عرض Septlion" eyebrow="OFFER" context={{requestId:r?.id,offerId:offer?.id,transactionId:tx?.id}}><section className="buyer-section">
 {loading?<p className="workspace-loading" role="status">جارٍ تحميل نسخة العرض المحفوظة…</p>:error&&!detail?<div className="empty-state"><b role="alert">{error}</b><div className="two-actions">{hasSession()?<button className="primary-link" onClick={()=>void load()}>إعادة المحاولة</button>:<a className="primary-link" href={'/account?next='+encodeURIComponent('/offer'+(typeof window!=='undefined'?window.location.search:''))}>تسجيل الدخول والمتابعة</a>}<a className="secondary-link" href="/requests">طلباتي</a></div></div>:!r?<div className="empty-state"><b>اختر طلبًا لعرض حالته التجارية</b><a className="primary-link" href="/requests">طلباتي</a></div>:!offer?<><Stage current={0}/><div className="offer-hero"><small dir="ltr">{r.id}</small><h1>{r.product}</h1><p>لم يصدر عرض Septlion لهذا الطلب بعد. سيظهر هنا عند إصداره.</p><button className="secondary-link" onClick={()=>void load()}>تحديث العرض</button></div><div className="terms-grid">{[['الكمية',r.quantityLabel||'—'],['التعبئة',r.packing],['الوجهة',r.destination],['شرط التجارة',r.incoterm],['الدفع',r.payment]].map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div></>:<>
 <Stage current={1}/><div className="workspace-heading"><div className="offer-hero"><small>عرض Septlion · النسخة {offer.currentRevision}</small><h1>{r.product}</h1><p>{testOnly?'TEST — محاكاة غير تجارية. هذا العرض لا يمثل بيعًا أو التزامًا بالدفع.':'راجع هذه النسخة؛ قبولها يثبّت شروطها التجارية ويربطها بالصفقة.'}</p></div><button className="secondary-link" disabled={busy} onClick={()=>void load()}>تحديث النسخة</button></div>
 <div className="terms-grid"><div><small>الإجمالي</small><b dir="auto">{Number.isFinite(total)?total.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+offer.currency:'راجع المستند'}</b></div><div><small>صالح حتى</small><b>{offer.validUntil?new Date(offer.validUntil).toLocaleString('ar'):'غير محدد'}</b></div>{[['شرط التجارة',terms.incoterm],['التسليم',terms.destination],['التعبئة',terms.packing],['شروط الدفع',terms.payment]].map(([label,value])=><div key={label}><small>{label}</small><b>{String(value||'غير محدد')}</b></div>)}</div>
 {items.length>0&&<div className="offer-note"><h2>بنود النسخة {offer.currentRevision}</h2>{items.map((x,i)=><p key={i}>{x.description} · {x.quantity} {x.unit} · {x.unitPrice} {offer.currency}</p>)}</div>}
 <a className="secondary-link" href={'/offer-document?id='+encodeURIComponent(offer.id)}>مراجعة المستند الكامل وتنزيل PDF</a>
 {eligible?<div className="offer-acceptance"><label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/><span>{testOnly?'راجعت نسخة '+offer.currentRevision+' وأريد بدء محاكاة غير تجارية.':'راجعت بنود وشروط وصلاحية نسخة '+offer.currentRevision+'، وأوافق على تثبيتها.'}</span></label><button className="primary-link" disabled={busy||!reviewed} onClick={()=>void accept()}>{busy?'جارٍ التثبيت…':testOnly?'بدء المحاكاة للنسخة '+offer.currentRevision:'قبول النسخة '+offer.currentRevision+' وتثبيت الطلب'}</button></div>:tx?<a className="primary-link wide" href={'/execution?id='+encodeURIComponent(tx.id)}>متابعة الصفقة المرتبطة بهذا العرض</a>:<p className="workspace-muted">هذه النسخة غير متاحة للقبول حاليًا. حدّث حالة العرض لمراجعة آخر نسخة.</p>}
 {error&&<p role="alert" className="workspace-error">{error}</p>}
 </>}
 </section></BuyerShell>;
}
