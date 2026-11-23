'use client';
// Shared frame and helpers for the team's console (command center + requests).
import Link from 'next/link';
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
export const nNew=(n:number)=>n===0?'لا توجد طلبات جديدة':n===1?'طلب جديد واحد':n===2?'طلبان جديدان':n<11?`${n} طلبات جديدة`:`${n} طلبًا جديدًا`;
export const waLink=(n?:string|null)=>{const d=(n||'').replace(/\D/g,'');return d.length>=8?'https://wa.me/'+d:''};

export function OpsFrame({active,children}:{active:'home'|'requests';children:React.ReactNode}){
 return <div className="ops" dir="rtl">
  <header className="ops-top"><div className="ops-top-in">
   <Link href="/command-center" className="ops-brand"><b>SEPTLION</b><small>لوحة الفريق</small></Link>
   <nav className="ops-nav" aria-label="أقسام اللوحة">
    <Link href="/command-center" aria-current={active==='home'?'page':undefined}>الرئيسية</Link>
    <Link href="/operations" aria-current={active==='requests'?'page':undefined}>الطلبات</Link>
   </nav>
  </div></header>
  <main className="ops-main">{children}</main>
 </div>;
}
