'use client';
import {ReactNode} from 'react';
import {usePathname} from 'next/navigation';
const items=[['/','الرئيسية'],['/discover','اكتشف'],['/requests','الطلبات'],['/notifications','التنبيهات'],['/account','الحساب']];
export function BuyerShell({children,title,eyebrow='SEPTLION'}:{children:ReactNode;title?:string;eyebrow?:string}){
 const p=usePathname();
 return <main className="buyer-app" dir="rtl">
  <header className="buyer-top"><a href="/" className="buyer-logo"><img src="/brand/septlion-wordmark-navy.png" alt="Septlion"/></a>{title&&<div className="buyer-title"><small>{eyebrow}</small><b>{title}</b></div>}<a className="buyer-ai" href="/require">ماذا تحتاج؟</a></header>
  <div className="buyer-body">{children}</div>
  <nav className="buyer-nav">{items.map(([href,label])=><a key={href} className={(href==='/'?p===href:p.startsWith(href))?'active':''} href={href}>{label}</a>)}</nav>
 </main>
}
export function Stage({current}:{current:number}){const x=['الطلب','العرض','التأكيد','التنفيذ','الاستلام','إعادة الطلب'];return <div className="stagebar">{x.map((s,i)=><span key={s} className={i<=current?'on':''}><i>{i<current?'✓':i+1}</i><small>{s}</small></span>)}</div>}
export function RequestSummary(){return <div className="request-summary"><div><small>RFQ · SEPTLION SUPPLY</small><h2>دقيق مخابز</h2><p>3 حاويات · CIF · Dar es Salaam · L/C</p></div><span className="status-pill">قيد المعالجة</span></div>}
