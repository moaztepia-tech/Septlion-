'use client';
import {useEffect, useState} from 'react';
import {edge} from '../../lib/api';

type Visits = {now:number; today:number; todayViews:number; week:number;
  days:{day:string; visitors:number}[]; countries:{country:string; visitors:number}[];
  pages:{path:string; views:number}[]; devices:Record<string,number>;
  steps?:{requestOpen:number; requestSent:number; requestError:number; whatsapp:number; email:number}};

const isoFlag=(c:string)=>/^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>0x1F1E6+x.charCodeAt(0)-65)):'';
const names=(()=>{try{return new Intl.DisplayNames(['ar'],{type:'region'})}catch{return null}})();
const countryName=(c:string)=>/^[A-Z]{2}$/.test(c)?(names?.of(c)||c):'غير معروف';
const dayName=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('ar',{weekday:'short'});
const PAGE:Record<string,string>={'/':'الصفحة الرئيسية','/discover':'اكتشف','/require':'الطلب','/demand-intelligence':'الرادار','/markets':'فهرس الأسواق','/en':'الصفحة الإنجليزية'};
const pageName=(p:string)=>PAGE[p]||(p.startsWith('/demand/')?'صفحة طلب: '+decodeURIComponent(p.slice(8)):p.startsWith('/markets/')?'سوق: '+decodeURIComponent(p.slice(9)):p);

export function VisitorsCard(){
  const [v,setV]=useState<Visits|null>(null);
  const [err,setErr]=useState(false);
  useEffect(()=>{edge<Visits>('operator.visits').then(setV).catch(()=>setErr(true))},[]);
  const max=Math.max(1,...(v?.days||[]).map(d=>d.visitors));
  return <section className="ops-card" aria-labelledby="visitors">
    <div className="ops-row" style={{marginBottom:10}}><h2 id="visitors" className="ops-h2">زوار الموقع</h2><small className="ops-sub">بدون كوكيز · كل شخص يُحسب مرة في اليوم</small></div>
    {err&&<p className="ops-sub">تعذر تحميل أرقام الزوار الآن.</p>}
    {!v&&!err&&<p className="ops-sub" role="status">جارٍ التحميل…</p>}
    {v&&<>
      <div className="ops-stats">
        <div className="ops-stat hl"><b>{v.now}</b><small>الآن (آخر 5 دقائق)</small></div>
        <div className="ops-stat"><b>{v.today}</b><small>زائر اليوم · {v.todayViews} مشاهدة</small></div>
        <div className="ops-stat"><b>{v.week}</b><small>زيارة في 7 أيام</small></div>
      </div>
      <div className="ops-visit-bars" role="img" aria-label={'الزوار يوميًا: '+v.days.map(d=>`${dayName(d.day)} ${d.visitors}`).join('، ')}>
        {v.days.map(d=><div key={d.day} className="ops-visit-bar"><span className="n">{d.visitors||''}</span><i style={{height:`${Math.max(4,d.visitors/max*64)}px`}}/><small>{dayName(d.day)}</small></div>)}
      </div>
      {v.steps&&<div className="ops-stats" aria-label="خطوات الطلب في 7 أيام" style={{marginTop:12}}>
        <div className="ops-stat"><b>{v.steps.requestOpen}</b><small>فتح نموذج الطلب</small></div>
        <div className="ops-stat hl"><b>{v.steps.requestSent}</b><small>أرسل الطلب</small></div>
        <div className="ops-stat"><b>{v.steps.whatsapp}</b><small>ضغط واتساب</small></div>
        <div className="ops-stat"><b>{v.steps.requestError}</b><small>واجه خطأ</small></div>
      </div>}
      {v.week===0?<div className="ops-empty">لم تُسجَّل زيارات بعد. ستظهر هنا فور دخول أول زائر.</div>:<div className="ops-visit-lists">
        <div><h3 className="ops-visit-h">من أين يأتون (7 أيام)</h3><ul>{v.countries.map(c=><li key={c.country}><span>{isoFlag(c.country)} {countryName(c.country)}</span><b>{c.visitors}</b></li>)}</ul></div>
        <div><h3 className="ops-visit-h">أكثر الصفحات زيارة</h3><ul>{v.pages.map(p=><li key={p.path}><span dir="auto">{pageName(p.path)}</span><b>{p.views}</b></li>)}</ul></div>
      </div>}
    </>}
  </section>;
}
