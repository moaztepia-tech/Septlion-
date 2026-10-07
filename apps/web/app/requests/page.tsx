'use client';
import {useCallback,useEffect,useState} from 'react';
import {BuyerShell} from '../../components/buyer-shell';
import {rememberActiveRequest,UiRequest} from '../../lib/buyer-ui-store';
import {tradeRequests} from '../../lib/trade-data';
import {hasSession} from '../../lib/api';
export default function Requests(){
 const[rows,setRows]=useState<UiRequest[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await tradeRequests());}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل الطلبات.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <BuyerShell title="التجارة" eyebrow="TRADE"><section className="buyer-section"><div className="section-intro"><small>YOUR TRADE</small><h1>كل طلب، من الاحتياج حتى الاستلام.</h1><p>افتح طلبك لمراجعة التفاصيل، والعرض الصادر، وحالة التنفيذ المرتبطة به.</p></div>
 {loading?<p role="status" className="workspace-loading">جارٍ تحميل طلبات مؤسستك…</p>:error?<div className="empty-state"><b role="alert">{error}</b><div className="two-actions">{hasSession()?<button className="primary-link" onClick={()=>void load()}>إعادة المحاولة</button>:<a className="primary-link" href="/account?next=%2Frequests">تسجيل الدخول</a>}<a className="secondary-link" href="/require">متابعة مسودة Composer</a></div></div>:rows.length===0?<div className="empty-state"><b>ابدأ أول طلب توريد</b><p>صف ما تحتاجه أو اختر منتجًا من «اكتشف»، ثم راجع الطلب داخل Composer.</p><div className="two-actions"><a className="secondary-link" href="/discover">اكتشف المنتجات</a><a className="primary-link" href="/require">ماذا تحتاج؟</a></div></div>:<div className="request-list">{rows.map(r=><a className="request-row" key={r.id} href={'/request?id='+encodeURIComponent(r.id)} onClick={()=>rememberActiveRequest(r.id)}><div><small dir="ltr">{r.id}</small><b>{r.product}</b><p>{r.quantityLabel} · {r.incoterm} · {r.destination}</p></div><span>فتح الطلب <i>←</i></span></a>)}</div>}
 </section></BuyerShell>;
}
