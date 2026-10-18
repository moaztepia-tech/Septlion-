'use client';
import {useEffect,useMemo,useState} from 'react';
import {BuyerShell} from '../../components/buyer-shell';
import {DesignButton,DesignLink} from '../../components/design-system';
import {hasSession,sessionUserId} from '../../lib/api';
import {COMPOSER_DRAFT_KEY,restoreComposerDraft} from '../../lib/composer-draft';
import {tradeRequests} from '../../lib/trade-data';
import type {UiRequest} from '../../lib/buyer-ui-store';

type Filter='all'|'requests'|'quotes'|'orders';
export default function MySeptlion(){
 const [rows,setRows]=useState<UiRequest[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(false),[draft,setDraft]=useState(''),[filter,setFilter]=useState<Filter>('all'),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;const logged=hasSession();setSignedIn(logged);setLoading(logged);setError('');
 try{const d=restoreComposerDraft(sessionStorage.getItem(COMPOSER_DRAFT_KEY),sessionUserId());setDraft(d&&!d.savedRequirementId?d.data.product||'طلب توريد':'');}catch{}
 if(!logged)return()=>{active=false;};
 void tradeRequests().then(r=>{if(active)setRows(r)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'تعذر تحميل الطلبات')}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false};},[refresh]);
 const filtered=useMemo(()=>rows.filter(r=>{if(filter==='all'||filter==='requests')return true;const status=r.status.toUpperCase();return filter==='quotes'?/QUOTE|OFFER/.test(status):/ORDER|COMMIT|EXECUT|DELIVER|COMPLET/.test(status)}),[rows,filter]);
 return <BuyerShell title="My Septlion" eyebrow="مساحتك التجارية"><section className="approved-workspace" dir="rtl">
 <div className="approved-workspace-heading"><small>MY SEPTLION</small><h1>طلباتي</h1><p>احتياجاتك وعروضك ومراحل تنفيذ تجارتك في مكان واحد.</p></div>
 <nav className="approved-workspace-tabs" aria-label="تصفية الطلبات">{([['all','الكل'],['requests','الطلبات'],['quotes','العروض'],['orders','التنفيذ']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</nav>
 {draft&&<a href="/require" className="approved-trade-card"><small>مسودة محفوظة</small><h2>{draft}</h2><span>متابعة الطلب ←</span></a>}
 {!signedIn?<div className="approved-empty"><p>سجّل الدخول لمتابعة طلبات مؤسستك.</p><DesignLink href="/account?next=%2Fmy-septlion">تسجيل الدخول</DesignLink></div>:loading?<p role="status">جارٍ تحميل الطلبات…</p>:error?<div role="alert"><p>{error}</p><DesignButton onClick={()=>setRefresh(n=>n+1)}>إعادة المحاولة</DesignButton></div>:filtered.length?filtered.map(r=><a key={r.id} className="approved-trade-card" href={'/request?id='+encodeURIComponent(r.id)}><div className="approved-trade-top"><small>#{r.id}</small><span>{r.status}</span></div><h2>{r.product}</h2><dl><div><dt>الوجهة</dt><dd>{r.destination||'—'}</dd></div><div><dt>الكمية</dt><dd>{r.quantityLabel||r.containers+' FCL'}</dd></div><div><dt>التسليم</dt><dd>{r.incoterm||'—'}</dd></div><div><dt>الدفع</dt><dd>{r.payment||'—'}</dd></div></dl><strong>عرض التفاصيل ←</strong></a>):<div className="approved-empty"><p>لا توجد معاملات في هذا القسم حاليًا.</p><DesignLink href="/require">ابدأ طلب توريد</DesignLink></div>}
 </section></BuyerShell>;
}