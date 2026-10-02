'use client';
import {ReactNode} from 'react';
import type {UiRequest} from '../lib/buyer-ui-store';
import {usePathname} from 'next/navigation';
const items=[['/','الرئيسية'],['/discover','اكتشف'],['/requests','التجارة'],['/account','الحساب']];
export function BuyerShell({children,title,eyebrow='SEPTLION'}:{children:ReactNode;title?:string;eyebrow?:string}){
 const p=usePathname();
 return <main className="buyer-app v3-app" dir="rtl">
  <header className="v3-top"><a href="/" className="v3-brand"><img src="/brand/septlion-wordmark-navy.png" alt="Septlion"/></a><nav>{items.slice(0,3).map(([href,label])=><a key={href} className={(href==='/'?p===href:p.startsWith(href))?'active':''} href={href}>{label}</a>)}</nav><div className="v3-actions"><a href="/notifications" aria-label="التنبيهات">التنبيهات</a><a className="v3-ask" href="/require">ماذا تحتاج؟ <b>↗</b></a></div></header>
  {title&&<div className="v3-context"><div><small>{eyebrow}</small><span>{title}</span></div></div>}
  <div className="buyer-body v3-body">{children}</div>
  <nav className="v3-mobile-nav">{items.map(([href,label])=><a key={href} className={(href==='/'?p===href:p.startsWith(href))?'active':''} href={href}>{label}</a>)}</nav>
 </main>
}
export function Stage({current}:{current:number}){const x=['الطلب','العرض','التأكيد','التنفيذ','الاستلام','إعادة الطلب'];return <div className="stagebar v3-stage">{x.map((s,i)=><span key={s} className={current>=0&&i<=current?'on':''}><i>{current>=0&&i<current?'✓':i+1}</i><small>{s}</small></span>)}</div>}
export function RequestSummary({request}:{request:UiRequest}){return <div className="request-summary"><div><small>{request.id} · SEPTLION SUPPLY</small><h2>{request.product}</h2><p>{request.containers} حاويات · {request.incoterm} · {request.destination} · {request.payment}</p></div><span className="status-pill">{request.status==='DRAFT'?'مسودة':'مسجل'}</span></div>}
