'use client';
import {useEffect,useState} from 'react';
import {OpsFrame} from '../../components/ops-console';
import {edge,accessToken} from '../../lib/api';

type Snapshot=Record<string,number|string>;
const groups:[string,[string,string,boolean?][]][]=[
 ['الطلبات والصفقات',[['requirements','احتياجات العملاء'],['openRfqs','طلبات مفتوحة'],['offers','عروض أسعار'],['activeTransactions','صفقات نشطة'],['completedTransactions','صفقات مكتملة'],['openClaims','مطالبات مفتوحة',true]]],
 ['الرصد والموردون',[['demandSignals','إشارات طلب'],['opportunities','فرص'],['supplyCandidates','موردون محتملون']]],
 ['صحة النظام',[['pendingOutbox','رسائل بانتظار الإرسال'],['failedOutbox','رسائل فشل إرسالها',true]]],
];

export default function Analytics(){
 const [h,setH]=useState<Snapshot|null>(null);
 const [e,setE]=useState('');
 useEffect(()=>{if(accessToken())edge<Snapshot>('analytics.snapshot').then(setH).catch(x=>setE(x instanceof Error?x.message:'تعذر تحميل المؤشرات'));else setE('سجّل الدخول بحساب الفريق لعرض المؤشرات.')},[]);
 return <OpsFrame active="home">
  <div>
   <h1 className="ops-h1">صحة المنصة</h1>
   <p className="ops-sub">أرقام مباشرة من قاعدة البيانات، وليست أرقامًا تسويقية.</p>
  </div>
  {e&&<p className="ops-alert" role="alert">{e}</p>}
  {!h&&!e&&<p className="ops-sub" role="status">جارٍ التحميل…</p>}
  {h&&groups.map(([title,rows])=><section key={title} className="ops-card" aria-label={title}>
   <h2 className="ops-h2" style={{marginBottom:12}}>{title}</h2>
   <div className="ops-metrics">{rows.map(([k,label,alarm])=>{const v=Number(h[k]??0);return <div key={k} className={'ops-stat'+(alarm&&v>0?' warn':'')}><b>{v}</b><small>{label}</small></div>})}</div>
  </section>)}
  {h?.generatedAt&&<p className="ops-sub">آخر قراءة: {new Date(String(h.generatedAt)).toLocaleString('ar')}</p>}
 </OpsFrame>;
}
