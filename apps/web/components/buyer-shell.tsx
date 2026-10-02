'use client';
import {ReactNode} from 'react';
import type {UiRequest} from '../lib/buyer-ui-store';
import {usePathname} from 'next/navigation';
const items=[['/','الرئيسية'],['/discover','اكتشف'],['/requests','الطلبات'],['/notifications','التنبيهات'],['/account','الحساب']];
export function BuyerShell({children,title,eyebrow='SEPTLION'}:{children:ReactNode;title?:string;eyebrow?:string}){
 const p=usePathname();
 return <main className="buyer-app ds-app" dir="rtl">
  <header className="buyer-top ds-top"><a href="/" className="buyer-logo"><img src="/brand/septlion-wordmark-navy.png" alt="Septlion"/></a>{title&&<div className="buyer-title"><small>{eyebrow}</small><b>{title}</b></div>}<a className="buyer-ai ds-ai" href="/require">ابدأ بالذكاء الاصطناعي <b>↗</b></a></header>
  <div className="buyer-body">{children}</div>
  <nav className="buyer-nav ds-nav">{items.map(([href,label])=><a key={href} className={(href==='/'?p===href:p.startsWith(href))?'active':''} href={href}>{label}</a>)}</nav>
 </main>
}
export function Stage({current}:{current:number}){const x=['الطلب','العرض','التأكيد','التنفيذ','الاستلام','إعادة الطلب'];return <div className="stagebar">{x.map((s,i)=><span key={s} className={current>=0&&i<=current?'on':''}><i>{current>=0&&i<current?'✓':i+1}</i><small>{s}</small></span>)}</div>}
export function RequestSummary({request}:{request:UiRequest}){return <div className="request-summary"><div><small>{request.id} · SEPTLION SUPPLY</small><h2>{request.product}</h2><p>{request.containers} حاويات · {request.incoterm} · {request.destination} · {request.payment}</p></div><span className="status-pill">{request.status==='DRAFT'?'مسودة':'مسجل'}</span></div>}
