'use client';
import {useState} from 'react';
import {BuyerShell,Stage} from '../../components/buyer-shell';
import {useTradeWorkspace,TestNotice,WorkspaceFallback} from '../../components/trade-workspace';
import {COMPOSER_DRAFT_KEY,draftFromReorder} from '../../lib/composer-draft';
import {sessionUserId} from '../../lib/api';
export default function Reorder(){
 const{data:w,requestId,loading,error:loadError,reload}=useTradeWorkspace();const[error,setError]=useState('');
 function review(){if(!w)return;setError('');try{const draft={...draftFromReorder(w,crypto.randomUUID()),ownerId:sessionUserId()};sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify(draft));for(const key of ['septlion_feed_context','septlion_requirement_seed','septlion_requirement_context','septlion_pending_requirement'])sessionStorage.removeItem(key);window.location.href='/require?source=reorder';}catch(e){setError(e instanceof Error?e.message:'تعذر فتح إعادة الطلب.');}}
 const prior=w?.commercialLock?.snapshot.items[0];
 return <BuyerShell context={{requestId,transactionId:w?.item.id,offerId:w?.commercialLock?.offerId}} title="إعادة الطلب" eyebrow="REORDER"><section className="buyer-section"><Stage current={5}/><div className="section-intro"><small>TRADE MEMORY</small><h1>ابدأ الطلب التالي من التكوين المعتمد</h1><p>راجع الكمية داخل Composer أولًا. ينشأ الطلب الجديد بعد إرساله، ويحتاج إلى عرض جديد للسعر والتوفر والشحن.</p></div>{!w?<WorkspaceFallback loading={loading} error={loadError} onReload={()=>void reload()}/>:<><TestNotice testOnly={w.item.testOnly}/>{w.item.status!=='COMPLETED'?<div className="empty-state"><b>إعادة الطلب متاحة بعد اكتمال الصفقة</b></div>:<div className="action-card"><small dir="ltr">{w.item.reference}</small><h2>{prior?.description||'التكوين المعتمد'}</h2><p>الكمية السابقة: {prior?.quantity??'—'} {prior?.unit||''}</p><p>تُستعاد المواصفة والشروط المعتمدة. لن يُنسخ سعر العرض أو موعد الشحن القديم.</p><button className="primary-link" onClick={review}>مراجعة إعادة الطلب في Composer</button>{error&&<p className="workspace-error" role="alert">{error}</p>}</div>}</>}</section></BuyerShell>;
}
