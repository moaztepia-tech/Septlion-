'use client';
import {useEffect, useState} from 'react';
import {edge} from '../../lib/api';

type Visits = {now:number; today:number; todayViews:number; week:number;
  days:{day:string; visitors:number}[]; countries:{country:string; visitors:number}[];
  pages:{path:string; views:number}[]; devices:Record<string,number>;
  aiToday?:number; sources?:{source:string; visitors:number}[]; ai?:{name:string; visitors:number}[];
  referrers?:{name:string; source:string; visitors:number}[]};

const isoFlag=(c:string)=>/^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>0x1F1E6+x.charCodeAt(0)-65)):'';
const names=(()=>{try{return new Intl.DisplayNames(['ar'],{type:'region'})}catch{return null}})();
const countryName=(c:string)=>/^[A-Z]{2}$/.test(c)?(names?.of(c)||c):'غير معروف';
const dayName=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('ar',{weekday:'short'});
const PAGE:Record<string,string>={'/':'الصفحة الرئيسية','/discover':'اكتشف','/require':'الطلب','/demand-intelligence':'الرادار'};
const SOURCE:Record<string,string>={ai:'الذكاء الاصطناعي',search:'محركات البحث',whatsapp:'واتساب',social:'مواقع التواصل',direct:'مباشر (كتب الرابط أو من تطبيق)',other:'مواقع أخرى'};
const DEVICE:Record<string,string>={mobile:'جوال',desktop:'كمبيوتر',tablet:'تابلت',other:'غير معروف'};
const pct=(n:number,t:number)=>t?Math.round(n/t*100)+'%':'';
const pageName=(p:string)=>PAGE[p]||(p.startsWith('/demand/')?'صفحة طلب: '+decodeURIComponent(p.slice(8)):p);

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
      {v.week>0&&<div className="ops-visit-ai">
        <div className="ops-row"><h3 className="ops-visit-h" style={{margin:0}}>جاؤوا من الذكاء الاصطناعي</h3><small className="ops-sub">اليوم {v.aiToday??0} · 7 أيام {(v.ai||[]).reduce((a,x)=>a+x.visitors,0)}</small></div>
        {(v.ai||[]).length?<div className="ops-chips" style={{marginTop:8}}>{(v.ai||[]).map(a=><span key={a.name} className="ops-chip">{a.name} <b>{a.visitors}</b></span>)}</div>
          :<p className="ops-sub" style={{marginTop:6}}>لم يأتِ أحد من ChatGPT أو Gemini أو غيرهما بعد.</p>}
      </div>}
      {v.week>0&&<div className="ops-visit-lists">
        <div><h3 className="ops-visit-h">مصدر الزيارة (7 أيام)</h3><ul>{(v.sources||[]).map(x=><li key={x.source}><span>{SOURCE[x.source]||x.source}</span><b>{x.visitors} <small className="ops-sub">{pct(x.visitors,v.week)}</small></b></li>)}</ul></div>
        <div><h3 className="ops-visit-h">نوع الجهاز</h3><ul>{Object.entries(v.devices||{}).sort((a,b)=>b[1]-a[1]).map(([k,n])=><li key={k}><span>{DEVICE[k]||k}</span><b>{n} <small className="ops-sub">{pct(n,v.week)}</small></b></li>)}</ul>
          {(v.referrers||[]).length>0&&<><h3 className="ops-visit-h" style={{marginTop:12}}>أهم المواقع المُحيلة</h3><ul>{(v.referrers||[]).slice(0,5).map(r=><li key={r.name+r.source}><span dir="auto">{r.name}</span><b>{r.visitors}</b></li>)}</ul></>}
        </div>
      </div>}
      {v.week===0?<div className="ops-empty">لم تُسجَّل زيارات بعد. ستظهر هنا فور دخول أول زائر.</div>:<div className="ops-visit-lists">
        <div><h3 className="ops-visit-h">من أين يأتون (7 أيام)</h3><ul>{v.countries.map(c=><li key={c.country}><span>{isoFlag(c.country)} {countryName(c.country)}</span><b>{c.visitors}</b></li>)}</ul></div>
        <div><h3 className="ops-visit-h">أكثر الصفحات زيارة</h3><ul>{v.pages.map(p=><li key={p.path}><span dir="auto">{pageName(p.path)}</span><b>{p.views}</b></li>)}</ul></div>
      </div>}
    </>}
  </section>;
}
