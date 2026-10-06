'use client';
import { useEffect, useState } from 'react';
import { BuyerShell } from '../../components/buyer-shell';
import { edge, hasSession } from '../../lib/api';
import { OfferDocument, offerDocumentModel, downloadOfferPdf } from '../../lib/offer-document';
export default function OfferDocumentPage(){
  const[d,setD]=useState<OfferDocument|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('id');if(!id){setErr('اختر عرضًا لعرض مستنده.');return}if(!hasSession()){setErr('سجل الدخول لفتح مستند العرض.');return}edge<OfferDocument>('offers.document',{id}).then(setD).catch(e=>setErr(e.message))},[]);
  const m=d?offerDocumentModel(d):null;
  async function download(){if(!d||busy)return;setBusy(true);setErr('');try{await downloadOfferPdf(d)}catch(e){setErr(e instanceof Error?e.message:'تعذر تنزيل المستند')}finally{setBusy(false)}}
  return <BuyerShell title="مستند العرض"><section className="buyer-section offer-document-workspace">
    <div className="offer-document-actions"><a href="/operations">مركز العمليات</a>{d&&<><button className="primary-link" disabled={busy} onClick={download}>{busy?'جارٍ تجهيز PDF…':'تنزيل PDF'}</button><button onClick={()=>window.print()}>طباعة / حفظ PDF نصي</button></>}</div>
    {err&&<p role="alert">{err}</p>}{!d&&!err&&<p role="status">جارٍ تحميل المستند المحفوظ…</p>}
    {d&&m&&<article className="offer-document-sheet" dir="rtl">
      <header><img src="/brand/septlion-primary-navy.png" alt="Septlion"/><div><small>SEPTLION</small><h1>{m.testOnly?'عرض TEST غير ملزم':'عرض سعر'}</h1></div></header>
      <div className="offer-document-reference" dir="ltr">{m.reference}</div>
      {m.testOnly&&<p className="test-notice">{m.notice}</p>}
      <dl className="offer-document-meta">{[['مرجع الطلب',d.rfq.reference],['العميل',d.buyer.legalName||d.buyer.name],['تاريخ الإصدار',m.date(d.revision.issuedAt)],['صالح حتى',m.date(d.offer.validUntil)],['الحالة',d.offer.status],['المنتج',d.revision.snapshot.product||'حسب البنود']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <table><thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>{m.items.map((x,i)=><tr key={i}><td>{x.description}</td><td>{x.quantity} {x.unit}</td><td>{m.money(x.unitPrice)}</td><td>{m.money(x.quantity*x.unitPrice)}</td></tr>)}</tbody></table>
      <div className="offer-document-total"><span>إجمالي العرض</span><strong dir="ltr">{m.money(m.total)}</strong></div>
      <h2>الشروط</h2><dl className="offer-document-meta">{m.conditions.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {m.notes&&<><h2>ملاحظات</h2><p>{m.notes}</p></>}<h2>الشروط العامة</h2><p>{m.notice}</p>
      <footer><span>septlion.com</span><span>نسخة العرض {d.revision.revisionNo} · {m.testOnly?'غير تجاري':'عرض محفوظ'}</span></footer>
    </article>}
  </section></BuyerShell>;
}
