'use client';
import {useCallback,useEffect,useState} from 'react';
import {BuyerShell} from '../../components/buyer-shell';
import {edge,hasSession} from '../../lib/api';
type Notification={id:string;title:string;body?:string;createdAt:string;readAt?:string|null;entityType?:string|null;entityId?:string|null};
function target(n:Notification){if(n.entityType==='TRANSACTION'&&n.entityId)return '/execution?id='+encodeURIComponent(n.entityId);if(['OFFER','SEPTLION_OFFER'].includes(n.entityType||'')&&n.entityId)return '/offer?id='+encodeURIComponent(n.entityId);if(n.entityType==='QUALIFIED_REQUIREMENT'&&n.entityId)return '/request?id='+encodeURIComponent(n.entityId);return '/requests';}
export default function Notifications(){
 const[rows,setRows]=useState<Notification[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{if(!hasSession())throw new Error('سجل الدخول لعرض تنبيهات مؤسستك.');const result=await edge<{items:Notification[]}>('notifications.list');setRows(result.items);}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل التنبيهات.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <BuyerShell title="التنبيهات"><section className="buyer-section"><div className="section-intro"><small>NOTIFICATIONS</small><h1>تحديثات طلباتك وصفقاتك</h1><p>افتح التنبيه لمراجعة السجل المرتبط به.</p></div>{loading?<p className="workspace-loading" role="status">جارٍ تحميل التنبيهات…</p>:error?<div className="empty-state"><b role="alert">{error}</b>{hasSession()?<button className="primary-link" onClick={()=>void load()}>إعادة المحاولة</button>:<a className="primary-link" href="/account?next=%2Fnotifications">تسجيل الدخول</a>}</div>:rows.length===0?<div className="empty-state"><b>لا توجد تنبيهات محفوظة</b><p>ستظهر هنا التحديثات عند تسجيلها.</p><a className="secondary-link" href="/requests">متابعة طلباتي</a></div>:<div className="document-list">{rows.map(n=><a className="notification-row" href={target(n)} key={n.id}><div><b>{n.title}</b>{n.body&&<p>{n.body}</p>}<time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString('ar')}</time></div><span aria-label={n.readAt?'مقروء':'غير مقروء'}>{n.readAt?'✓':'•'} ←</span></a>)}</div>}</section></BuyerShell>;
}
