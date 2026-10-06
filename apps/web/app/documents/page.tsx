'use client';
import {useEffect,useState} from 'react';
import {BuyerShell} from '../../components/buyer-shell';
import {useTradeWorkspace,TestNotice,WorkspaceFallback} from '../../components/trade-workspace';
import {TransactionDocuments} from '../../components/transaction-documents';
import {activeRequestId} from '../../lib/buyer-ui-store';
import {offerForRequirement} from '../../lib/offer-data';
export default function Documents(){const{data:w,loading,error,reload}=useTradeWorkspace();const[offerId,setOfferId]=useState('');useEffect(()=>{let cancelled=false;const id=activeRequestId();if(id)offerForRequirement(id).then(offer=>{if(!cancelled)setOfferId(offer?.id||'');});return()=>{cancelled=true;};},[]);const offer=w?.commercialLock?.offerId||offerId;return <BuyerShell title="المستندات"><section className="buyer-section"><div className="section-intro"><small>TRADE DOCUMENTS</small><h1>مستندات الطلب والصفقة</h1><p>راجع العرض المحفوظ وملفات التنفيذ، وحدد مشاركة كل مستند عند رفعه.</p></div>{offer&&<div className="offer-note"><h2>مستند عرض Septlion</h2><a className="primary-link" href={'/offer-document?id='+encodeURIComponent(offer)}>فتح العرض وتنزيل PDF</a></div>}{!w?<WorkspaceFallback loading={loading} error={error} onReload={()=>void reload()}/>:<><TestNotice testOnly={w.item.testOnly}/><p dir="ltr" className="workspace-reference">{w.item.reference}</p><TransactionDocuments transactionId={w.item.id} side="BUYER" onChanged={()=>void reload()}/><a className="secondary-link" href={'/execution?id='+encodeURIComponent(w.item.id)}>العودة للتنفيذ</a></>}</section></BuyerShell>;}
