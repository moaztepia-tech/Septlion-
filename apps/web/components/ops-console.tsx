'use client';
// Shared frame and helpers for the team's console (command center + requests).
import Link from 'next/link';
import {PlatformIcon} from './platform-header';
import '../app/ops-console.css';

export type OpsBuyer={name:string|null;company:string|null;email:string|null;whatsapp:string|null}|null;
export type OpsRequirement={product:string;quantity:number|string|null;unit:string|null;containerCount?:number|null;packing?:string|{display?:string}|null;deliveryPort:string|null;deliveryCountry:string|null;incoterm?:string|null;paymentPreference?:string|null;market?:string;buyer?:OpsBuyer};
export type OpsRfq={id:string;reference:string;status:string;createdAt?:string;incoterm?:string|null;deliveryCountry?:string|null;deliveryPort?:string|null;requirement?:OpsRequirement|null};

const FLAG_ISO:Record<string,string>={'السعودية':'SA','السودان':'SD','الإمارات':'AE','مصر':'EG','تنزانيا':'TZ','كينيا':'KE','اليمن':'YE','غانا':'GH','نيجيريا':'NG','جيبوتي':'DJ','تشاد':'TD','قطر':'QA','الكويت':'KW','عمان':'OM','الأردن':'JO','ليبيا':'LY','إثيوبيا':'ET','الصومال':'SO','إريتريا':'ER'};
export const flag=(country:string|null|undefined)=>{const iso=country&&FLAG_ISO[country.trim()];return iso?String.fromCodePoint(...[...iso].map(c=>0x1F1E6+c.charCodeAt(0)-65)):''};

// Older requests stored "country · port" in one field; newer ones keep them apart.
export function place(r:{deliveryCountry?:string|null;deliveryPort?:string|null}|null|undefined){
 let country=(r?.deliveryCountry||'').trim(),port=(r?.deliveryPort||'').trim();
 if(!country&&port.includes('·')){const[a,...b]=port.split('·');country=a.trim();port=b.join('·').trim();}
 if(!country&&FLAG_ISO[port]){country=port;port='';}
 return{country,port,flag:flag(country),label:[country,port].filter(Boolean).join(' · ')||'—'};
}

export const STATUS:Record<string,{label:string;tone:string}>={OPEN:{label:'جديد',tone:'new'},QUOTED:{label:'أُرسل العرض',tone:'sent'},NEGOTIATING:{label:'تفاوض',tone:'sent'},ACCEPTED:{label:'مقبول',tone:'done'},ISSUED:{label:'صادر',tone:'sent'},DRAFT:{label:'مسودة',tone:'muted'}};
export const statusOf=(s:string)=>STATUS[s]||{label:s,tone:'muted'};

export const isTest=(r:OpsRfq)=>/^TEST(?:\s|—|-|$)/i.test(r.requirement?.product||'');

export function amount(q:OpsRequirement|null|undefined){
 if(!q)return '';const n=Number(q.containerCount||q.quantity||0);const u=(q.unit||'').toUpperCase();
 if(u==='FCL'||q.containerCount)return n===1?'حاوية واحدة':n===2?'حاويتان':n>2&&n<11?`${n} حاويات`:`${n} حاوية`;
 return `${Number(q.quantity||0).toLocaleString('en')} ${q.unit||''}`.trim();
}
export const packingOf=(q:OpsRequirement|null|undefined)=>{const p=q?.packing;const s=typeof p==='string'?p:p?.display||'';return s.replace(/\s*×.*$/,'')};

export function ago(iso?:string){
 if(!iso)return '';const t=new Date(iso.replace(' ','T')+(/[zZ]|[+-]\d\d:?\d\d$/.test(iso)?'':'Z')).getTime();if(!Number.isFinite(t))return '';
 const m=Math.max(0,Math.round((Date.now()-t)/60000));if(m<1)return 'الآن';if(m<60)return `قبل ${m} د`;const h=Math.round(m/60);if(h<24)return `قبل ${h} س`;const d=Math.round(h/24);if(d<30)return d===1?'أمس':`قبل ${d} يوم`;
 return new Date(t).toLocaleDateString('ar-EG-u-nu-latn',{day:'numeric',month:'short'});
}
// One date style for the whole panel, e.g. 5 ديسمبر (the year only when it is not this year).
export function dateAr(iso?:string|null){if(!iso)return '—';const t=new Date(iso);if(!Number.isFinite(t.getTime()))return '—';return t.toLocaleDateString('ar-EG-u-nu-latn',{day:'numeric',month:'short',...(t.getFullYear()!==new Date().getFullYear()?{year:'numeric' as const}:{})});}
export const nNew=(n:number)=>n===0?'لا توجد طلبات جديدة':n===1?'طلب جديد واحد':n===2?'طلبان جديدان':n<11?`${n} طلبات جديدة`:`${n} طلبًا جديدًا`;
export const waLink=(n?:string|null)=>{const d=(n||'').replace(/\D/g,'');return d.length>=8?'https://wa.me/'+d:''};

// One navigation for every team screen. Phone: a slim top bar and a bottom tab bar.
// Desktop: the same items in the top bar. Every screen marks its own tab.
export type OpsTab='home'|'requests'|'work'|'radar'|'stats'|'content'|'account';
const TABS:[OpsTab,string,string][]=[['home','/command-center','الرئيسية'],['requests','/operations','الطلبات'],['work','/demand-intelligence/workbench','التشغيل'],['radar','/demand-intelligence','الرادار']];
const MORE:[OpsTab,string,string,string][]=[['stats','/analytics','الإحصاءات','أرقام المنصة مباشرة من قاعدة البيانات'],['content','/site-content','محتوى الموقع','عدّل نصوص الصفحة الرئيسية'],['account','/account','حسابي','بياناتك وتسجيل الخروج']];
const TAB_ICON:Record<string,React.ReactNode>={
 home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
 requests:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
 work:<><path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/></>,
 radar:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 12 18 6"/></>,
 more:<><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></>,
};
const TabIcon=({name}:{name:string})=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_ICON[name]}</svg>;

export function OpsFrame({active,children}:{active:OpsTab;children:React.ReactNode}){
 const cur=(t:OpsTab)=>active===t?'page' as const:undefined;
 const inMore=MORE.some(([t])=>t===active);
 return <div className="ops" dir="rtl">
  <header className="ops-top"><div className="ops-top-in">
   <Link href="/command-center" className="ops-brand"><b>SEPTLION</b><small>لوحة الفريق</small></Link>
   <nav className="ops-nav" aria-label="أقسام اللوحة">
    {TABS.map(([t,href,label])=><Link key={t} href={href} aria-current={cur(t)}>{label}</Link>)}
    {MORE.slice(0,2).map(([t,href,label])=><Link key={t} href={href} aria-current={cur(t)}>{label}</Link>)}
   </nav>
   <nav className="ops-icons" aria-label="اختصارات">
    <Link href="/discover" aria-label="ما يراه العميل" title="ما يراه العميل"><PlatformIcon name="discover"/></Link>
    <Link href="/account" aria-label="حسابي" title="حسابي" aria-current={cur('account')}><PlatformIcon name="account"/></Link>
   </nav>
  </div></header>
  <main className="ops-main">{children}</main>
  <nav className="ops-tabbar" aria-label="أقسام اللوحة">
   {TABS.map(([t,href,label])=><Link key={t} href={href} aria-current={cur(t)}><TabIcon name={t}/><span>{label}</span></Link>)}
   <details className="ops-more">
    <summary aria-current={inMore?'page':undefined}><TabIcon name="more"/><span>المزيد</span></summary>
    <div className="ops-more-sheet">{MORE.map(([t,href,label,hint])=><Link key={t} href={href} aria-current={cur(t)}><b>{label}</b><small>{hint}</small></Link>)}
     <Link href="/discover"><b>ما يراه العميل</b><small>الموقع كما يظهر للعملاء</small></Link></div>
   </details>
  </nav>
 </div>;
}
