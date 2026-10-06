'use client';
import { useEffect, useState } from 'react';
import { BuyerShell } from '../../components/buyer-shell';
import { edge, hasSession } from '../../lib/api';
import { activeRequestId } from '../../lib/buyer-ui-store';
import { offerForRequirement, BuyerOffer } from '../../lib/offer-data';
type D={id:string;fileName:string;mimeType:string;byteSize:string|number;createdAt:string};
export default function Documents(){
 const[rows,setRows]=useState<D[]>([]),[tx,setTx]=useState(''),[offer,setOffer]=useState<BuyerOffer|null>(null),[err,setErr]=useState('');
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('id')||sessionStorage.getItem('septlion_active_transaction')||'';setTx(id);
  const request=activeRequestId();if(request)offerForRequirement(request).then(setOffer);
  if(id&&hasSession())edge<{items:D[]}>('documents.list',{entityType:'TRANSACTION',entityId:id}).then(r=>setRows(r.items)).catch(e=>setErr(e.message));
 },[]);
 return <BuyerShell title="المستندات"><section className="buyer-section"><div className="section-intro"><small>TRADE DOCUMENTS</small><h1>مستندات الطلب والصفقة</h1><p>مستند العرض يُعرض من نسخته المحفوظة. تظهر ملفات التنفيذ عند رفعها واعتمادها.</p></div>
 {offer&&<div className="offer-note"><h2>مستند عرض Septlion</h2><a className="primary-link" href={'/offer-document?id='+encodeURIComponent(offer.id)}>فتح العرض وتنزيل PDF</a></div>}
 {err&&<p role="alert">{err}</p>}
 {!tx?<div className="empty-state"><b>لا توجد صفقة محددة لملفات التنفيذ</b><a className="primary-link" href="/requests">الطلبات</a></div>:rows.length===0?<div className="empty-state"><b>لا توجد مستندات تنفيذ جاهزة حتى الآن</b><p>ستظهر الملفات هنا بعد إصدارها ورفعها إلى مساحة الصفقة.</p></div>:<div className="document-list">{rows.map(d=><div key={d.id}><span><b>{d.fileName}</b><small>{d.mimeType} · {new Date(d.createdAt).toLocaleDateString('ar')}</small></span><i title="تم التحقق من السجل">✓</i></div>)}</div>}
 </section></BuyerShell>
}
