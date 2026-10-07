'use client';
import {ReactNode} from 'react';
import type {UiRequest} from '../lib/buyer-ui-store';
import {usePathname} from 'next/navigation';
import {PlatformHeader} from './platform-header';
import {TradeContext,tradeNavigation} from '../lib/customer-journey';
const tradePaths=['/request','/offer','/commit','/execution','/documents','/receive','/reorder'];
export function BuyerShell({children,title,eyebrow='SEPTLION',context}:{children:ReactNode;title?:string;eyebrow?:string;context?:TradeContext}){
 const p=(usePathname()||'/').replace(/\/+$/,'')||'/'; const inTrade=p==='/requests'||tradePaths.some(x=>p.startsWith(x));
 return <main className="buyer-app v3-app" dir="rtl">
  <PlatformHeader showOperations={p==='/operations'||p==='/analytics'}/>
  {title&&<div className="v3-context"><div><small>{eyebrow}</small><span>{title}</span></div></div>}
  {inTrade&&p!=='/requests'&&<nav className="trade-subnav" aria-label="مراحل الطلب المحدد">{tradeNavigation(context).map(link=>link.href?<a key={link.path} className={p===link.path?'active':''} aria-current={p===link.path?'page':undefined} href={link.href}>{link.label}</a>:<span key={link.path} aria-disabled="true">{link.label}</span>)}</nav>}
  <div className="buyer-body v3-body">{children}</div>
 </main>
}
export function Stage({current}:{current:number}){const x=['الطلب','العرض','التأكيد','التنفيذ','الاستلام','إعادة الطلب'];return <div className="stagebar v3-stage">{x.map((s,i)=><span key={s} className={current>=0&&i<=current?'on':''}><i>{current>=0&&i<current?'✓':i+1}</i><small>{s}</small></span>)}</div>}
export function RequestSummary({request}:{request:UiRequest}){return <div className="request-summary"><div><small>{request.id} · SEPTLION</small><h2>{request.product}</h2><p>{request.quantityLabel||request.containers+' حاويات'} · {request.incoterm} · {request.destination} · {request.payment}</p></div><span className="status-pill">{request.status==='DRAFT'?'مسودة':'مسجل'}</span></div>}
