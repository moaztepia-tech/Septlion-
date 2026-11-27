'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import CatalogManager from './catalog-manager';
import {edge} from '../../lib/api';
import {OpsFrame,OpsRfq,place,statusOf,isTest,amount,packingOf,ago,nNew} from '../../components/ops-console';

type Mode = 'home' | 'product' | 'sector' | 'request';
type Dashboard={health:Record<string,number>};
const examples = [
  'أضف زيت عباد الشمس زولانا، عبوات 1 لتر و5 لتر',
  'أنشئ قطاع مواد البناء وتصنيف الأسمنت',
];

function classify(value: string): Mode {
  const text = value.trim();
  if (!text) return 'home';
  if (/قطاع|تصنيف|فئة|قسم/.test(text)) return 'sector';
  if (/طلب|عميل|عرض سعر|صفقة|توريد/.test(text) && !/أضف منتج|منتج جديد/.test(text)) return 'request';
  if (/منتج|أضف|عبوة|عبوات|كتالوج|صنف|زيت|دقيق/.test(text)) return 'product';
  return 'home';
}

export default function CommandCenter({role}:{role:'ADMIN'|'SALES'}) {
  const [instruction, setInstruction] = useState('');
  const [review, setReview] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [rfqs, setRfqs] = useState<OpsRfq[]|null>(null);
  const [health, setHealth] = useState<Record<string,number>|null>(null);
  const [err, setErr] = useState('');
  const mode = useMemo(() => classify(instruction), [instruction]);
  useEffect(()=>{
    edge<{rfqs:OpsRfq[]}>('operator.queue').then(q=>setRfqs(q.rfqs.filter(r=>!isTest(r)))).catch(e=>setErr(e instanceof Error?e.message:'تعذر تحميل الطلبات'));
    edge<Dashboard>('operator.dashboard').then(d=>setHealth(d.health)).catch(()=>{});
  },[]);
  const fresh=(rfqs||[]).filter(r=>r.status==='OPEN');
  const waiting=(rfqs||[]).filter(r=>r.status!=='OPEN').length;
  const hello=new Date().getHours()<12?'صباح الخير':'مساء الخير';

  if(catalogOpen)return <OpsFrame active="home">
    <div className="ops-row"><div><h1 className="ops-h1">المنتجات والقطاعات</h1><p className="ops-sub">أضف منتجًا أو عبوة، أو عدّل قطاعًا</p></div><button type="button" className="ops-btn" onClick={()=>setCatalogOpen(false)}>الرئيسية ←</button></div>
    <section className="ops-card">
      <div className="ops-form" style={{marginBottom:14}}>
        <label className="wide" htmlFor="command">صف ما تريد بلغتك (اختياري)
          <textarea id="command" value={instruction} onChange={e=>{setInstruction(e.target.value);setReview(false)}} placeholder="مثال: أضف زيت عباد الشمس عبوة 1 لتر و5 لتر" maxLength={3000} rows={2}/>
        </label>
        <div className="wide ops-row">
          <div className="ops-chips">{examples.map(x=><button key={x} type="button" className="ops-chip" onClick={()=>{setInstruction(x);setReview(false)}}>{x}</button>)}</div>
          <button type="button" className="ops-btn" disabled={!instruction.trim()} onClick={()=>setReview(true)}>تجهيز الحقول</button>
        </div>
        {review&&<p className="wide ops-sub" role="status">التصنيف: {mode==='product'?'منتج أو كتالوج':mode==='sector'?'قطاع أو تصنيف':mode==='request'?'طلبات — افتح صفحة الطلبات':'غير واضح، اختر من الأسفل'}. لا يُحفظ شيء قبل اعتمادك.</p>}
      </div>
      <CatalogManager role={role} mode={review?mode:'home'}/>
    </section>
  </OpsFrame>;

  // Home fits one phone screen: summary numbers, the latest requests, and one tap to every part of the panel.
  return <OpsFrame active="home"><div className="ops-home">
    <div className="ops-home-head">
      <h1 className="ops-h1">{hello}</h1>
      <p className="ops-sub">{rfqs?fresh.length?`لديك ${nNew(fresh.length)} بانتظار عرض سعر.`:'لا توجد طلبات جديدة الآن.':'نجهّز ملخص اليوم…'}</p>
    </div>

    <div className="ops-stats">
      <Link href="/operations" className="ops-stat hl"><b>{rfqs?fresh.length:'–'}</b><small>طلبات جديدة</small></Link>
      <Link href="/operations" className="ops-stat"><b>{rfqs?waiting:'–'}</b><small>أُرسل لها عرض</small></Link>
      <Link href="/operations?tab=deals" className="ops-stat"><b>{health?health.activeTransactions??0:'–'}</b><small>صفقات نشطة</small></Link>
    </div>

    <section className="ops-card ops-home-latest" aria-labelledby="latest">
      <div className="ops-row"><h2 id="latest" className="ops-h2">أحدث الطلبات</h2><Link href="/operations" className="ops-link">كل الطلبات ←</Link></div>
      {err&&<p className="ops-alert" role="alert">{err}</p>}
      {!rfqs&&!err&&<p className="ops-sub" role="status">جارٍ التحميل…</p>}
      {rfqs&&rfqs.length===0&&<p className="ops-sub">لم يصل أي طلب بعد.</p>}
      {rfqs&&rfqs.length>0&&<ul className="ops-mini">{rfqs.slice(0,3).map(r=>{const q=r.requirement;const p=place(q||r);const st=statusOf(r.status);return <li key={r.id}><Link href={'/operations?rfq='+encodeURIComponent(r.id)}>
        <span className="ops-flag" aria-hidden>{p.flag||'•'}</span>
        <span className="ops-mini-main"><b>{q?.product||r.reference}</b><small>{[p.country||p.label,amount(q),ago(r.createdAt)].filter(Boolean).join(' · ')}</small></span>
        <span className={'ops-badge '+st.tone}>{st.label}</span>
      </Link></li>})}</ul>}
    </section>

    <nav aria-label="أقسام اللوحة" className="ops-home-grid">
      <Link href="/operations?tab=deals"><b>الصفقات</b><small>الشحن والمستندات</small></Link>
      <button type="button" onClick={()=>setCatalogOpen(true)}><b>المنتجات والقطاعات</b><small>أضف أو عدّل</small></button>
      <Link href="/analytics"><b>الزوار والإحصاءات</b><small>من يزور الموقع</small></Link>
      <Link href="/site-content"><b>محتوى الموقع</b><small>نصوص الصفحة الرئيسية</small></Link>
      <Link href="/discover"><b>ما يراه العميل</b><small>الموقع كما يظهر</small></Link>
      <Link href="/account"><b>حسابي</b><small>{role==='ADMIN'?'مدير':'مبيعات'}</small></Link>
    </nav>
  </div></OpsFrame>;
}
