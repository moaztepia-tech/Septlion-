'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import CatalogManager from './catalog-manager';
import {VisitorsCard} from './visitors-card';
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

  return <OpsFrame active="home">
    <div>
      <h1 className="ops-h1">{hello}</h1>
      <p className="ops-sub">{rfqs?fresh.length?`لديك ${nNew(fresh.length)} بانتظار عرض سعر.`:'لا توجد طلبات جديدة الآن.':'نجهّز ملخص اليوم…'}</p>
    </div>

    <div className="ops-stats">
      <Link href="/operations" className="ops-stat hl"><b>{rfqs?fresh.length:'–'}</b><small>طلبات جديدة</small></Link>
      <Link href="/operations" className="ops-stat"><b>{rfqs?waiting:'–'}</b><small>أُرسل لها عرض</small></Link>
      <Link href="/operations?tab=deals" className="ops-stat"><b>{health?health.activeTransactions??0:'–'}</b><small>صفقات نشطة</small></Link>
    </div>

    <section className="ops-card" aria-labelledby="latest">
      <div className="ops-row" style={{marginBottom:10}}><h2 id="latest" className="ops-h2">أحدث الطلبات</h2><Link href="/operations" className="ops-link">كل الطلبات ←</Link></div>
      {err&&<p className="ops-alert" role="alert">{err}</p>}
      {!rfqs&&!err&&<p className="ops-sub" role="status">جارٍ التحميل…</p>}
      {rfqs&&rfqs.length===0&&<div className="ops-empty">لم يصل أي طلب بعد. ستظهر الطلبات هنا فور إرسالها من الموقع.</div>}
      {rfqs&&rfqs.length>0&&<div className="ops-list">{rfqs.slice(0,4).map(r=>{const q=r.requirement;const p=place(q||r);const st=statusOf(r.status);return <Link key={r.id} href={'/operations?rfq='+encodeURIComponent(r.id)} className="ops-item">
        <div className="ops-item-top"><span className="ops-item-place">{p.flag&&<span className="ops-flag" aria-hidden>{p.flag}</span>}{p.label}</span><span>{ago(r.createdAt)}</span></div>
        <h3>{q?.product||r.reference}</h3>
        <div className="ops-item-foot"><span className="ops-item-meta">{[amount(q),packingOf(q),q?.buyer?.name].filter(Boolean).join(' · ')}</span><span className={'ops-badge '+st.tone}>{st.label}</span></div>
      </Link>})}</div>}
    </section>

    <VisitorsCard/>

    <section aria-label="أقسام العمل" className="ops-tiles">
      <Link href="/operations" className="ops-tile"><b>الطلبات وعروض الأسعار</b><small>راجع الطلب وأصدر عرض السعر للعميل</small></Link>
      <Link href="/operations?tab=deals" className="ops-tile"><b>تنفيذ الصفقات</b><small>مراحل الشحن والمستندات بعد قبول العرض</small></Link>
      <Link href="/demand-intelligence/workbench" className="ops-tile"><b>لوحة تشغيل الطلبات</b><small>الطلبات الجديدة والمشترون المحتملون والمهام</small></Link>
      <Link href="/demand-intelligence" className="ops-tile"><b>الفرص والتقييم</b><small>فرص الطلب في الأسواق قبل الالتزام</small></Link>
      <Link href="/discover" className="ops-tile"><b>ما يراه العميل</b><small>معاينة الكتالوج كما يظهر في الموقع</small></Link>
    </section>

    <details className="ops-card ops-fold" open={catalogOpen} onToggle={e=>setCatalogOpen((e.target as HTMLDetailsElement).open)}>
      <summary><span><b className="ops-h2">المنتجات والقطاعات</b><br/><small className="ops-sub">أضف منتجًا أو عبوة، أو عدّل قطاعًا</small></span></summary>
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
      {catalogOpen&&<CatalogManager role={role} mode={review?mode:'home'}/>}
    </details>

    <p className="ops-sub" style={{fontSize:12}}>صلاحيتك: {role==='ADMIN'?'مدير':'مبيعات'}. كل عملية تُراجع صلاحيتها على الخادم.</p>
  </OpsFrame>;
}
