'use client';

import Link from 'next/link';
import {PlatformHeader} from '../../../components/platform-header';
import {useEffect,useState} from 'react';
import RfqForm,{Lang} from '../RfqForm';

type IntentPage={
 id:string;slug:string;title:string;productKey?:string|null;market:string;searchIntent:string;
 content?:{product?:string;quantity?:string|null;packing?:string|null;incoterm?:string|null;deadline?:string|null;cta?:string|null};
};

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://jfbmxowdmfdzyoauqgwn.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';

// English by default (buyers come from international marketplaces and search);
// the Arabic demand pages for Arab markets link here with ?lang=ar.
const T={
 en:{
  loadingK:'SUPPLY ROUTE',loading:'Loading…',
  goneK:'NOT AVAILABLE',gone1:'This supply route',gone2:'is not public.',goneP:'The page is no longer available. You can still send your requirement for wheat flour.',goneA:'Wheat flour RFQ →',
  heroK:'MARKET-SPECIFIC SUPPLY',heroP:'Recent buyer demand for this product in this market. Send your exact requirement and Septlion replies with one clear supply offer.',
  heroA:'Request an offer ↓',heroB:'All demand routes →',
  structK:'WHAT WE NEED FROM YOU',structH:'Your requirement sets the offer.',
  mK:'MARKET',mP:'Supply to your destination country and port.',mB:'Destination-specific route',
  vK:'VOLUME',vD:'Defined by you',vP:'The final scale comes from your submitted requirement.',vB:'Reviewed before quotation',
  dK:'DELIVERY TERMS',dP:'Packing is set by your requirement.',dPk:'Packing signal: ',dB:'Delivery window required',dDl:'Demand deadline: ',
  rfqK:'REQUEST AN OFFER',rfqH:'Send your requirement to Septlion.',rfqP:'Your request goes straight to the Septlion team, linked to this supply route.',
 },
 ar:{
  loadingK:'مسار توريد',loading:'جارٍ التحميل…',
  goneK:'غير متاح',gone1:'مسار التوريد هذا',gone2:'غير منشور.',goneP:'الصفحة لم تعد متاحة، ويمكنك إرسال طلبك للدقيق مباشرة.',goneA:'طلب عرض للدقيق ←',
  heroK:'توريد مخصص لسوقك',heroP:'هناك طلب حالي على هذا الصنف في هذا السوق. أرسل احتياجك بالتفصيل، وترد عليك سبتليون بعرض توريد واحد واضح.',
  heroA:'اطلب عرضًا ↓',heroB:'كل مسارات الطلب ←',
  structK:'ما نحتاجه منك',structH:'طلبك هو ما يحدد العرض.',
  mK:'السوق',mP:'توريد إلى دولتك وميناء الوصول.',mB:'مسار مخصص للوجهة',
  vK:'الكمية',vD:'تحددها أنت',vP:'الكمية النهائية تأتي من طلبك.',vB:'مراجعة قبل التسعير',
  dK:'شروط التسليم',dP:'التعبئة حسب طلبك.',dPk:'التعبئة المطلوبة: ',dB:'حدد موعد التسليم',dDl:'آخر موعد للطلب: ',
  rfqK:'اطلب عرضًا',rfqH:'أرسل طلبك إلى سبتليون.',rfqP:'يصل طلبك مباشرة إلى فريق سبتليون، مرتبطًا بمسار التوريد هذا.',
 },
} as const;


// Arabic names for the Arabic version (Arab markets only link here with ?lang=ar).
const MARKET_AR:Record<string,string>={'saudi arabia':'السعودية','united arab emirates':'الإمارات','uae':'الإمارات','oman':'عُمان','qatar':'قطر','bahrain':'البحرين','kuwait':'الكويت','jordan':'الأردن','iraq':'العراق','yemen':'اليمن','lebanon':'لبنان','syria':'سوريا','palestine':'فلسطين','egypt':'مصر','sudan':'السودان','libya':'ليبيا','tunisia':'تونس','algeria':'الجزائر','morocco':'المغرب','mauritania':'موريتانيا','somalia':'الصومال','djibouti':'جيبوتي','comoros':'جزر القمر'};
const PRODUCT_AR:[RegExp,string][]=[[/whole wheat/i,'دقيق قمح كامل'],[/durum/i,'دقيق قمح قاسٍ'],[/bakery/i,'دقيق مخابز'],[/all[- ]purpose/i,'دقيق متعدد الاستخدامات'],[/refined/i,'دقيق قمح مكرر'],[/chakki|atta/i,'دقيق أتا'],[/wheat flour/i,'دقيق قمح']];
const marketAr=(m:string)=>{const parts=m.split(',').map(x=>x.trim());const ar=MARKET_AR[(parts[parts.length-1]||'').toLowerCase()];return ar?(parts.length>1?parts[0]+'، '+ar:ar):m};
const productAr=(p:string)=>{for(const [re,ar] of PRODUCT_AR)if(re.test(p))return ar;return p};

export default function DemandIntentPage(){
 const [page,setPage]=useState<IntentPage|null|undefined>(undefined);
 const [lang,setLang]=useState<Lang>('en');

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  if(q.get('lang')==='ar')setLang('ar');
  const slug=q.get('slug')||'';
  if(!slug){setPage(null);return}
  const url=SUPABASE_URL+'/rest/v1/PublicDemandIntentPage?select=id,slug,title,productKey,market,searchIntent,content&slug=eq.'+encodeURIComponent(slug)+'&limit=1';
  fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}})
   .then(r=>r.ok?r.json():[])
   .then(rows=>setPage(rows?.[0]||null))
   .catch(()=>setPage(null));
 },[]);

 const t=T[lang];
 const dir=lang==='ar'?'rtl':'ltr';

 if(page===undefined)return <main className="di" dir={dir} lang={lang}><PlatformHeader lang={lang}/><div className="shell di-section"><p className="kicker">{t.loadingK}</p><h2>{t.loading}</h2></div></main>;

 if(!page)return <main className="di" dir={dir} lang={lang}>
  <PlatformHeader lang={lang}/>
  <section className="di-hero shell"><p className="kicker">{t.goneK}</p><h1>{t.gone1}<br/><em>{t.gone2}</em></h1><p>{t.goneP}</p><div className="di-actions"><Link href="/intent/wheat-flour">{t.goneA}</Link></div></section>
 </main>;

 const product=page.content?.product||page.title;
 const shownProduct=lang==='ar'?productAr(product):product;
 const shownMarket=lang==='ar'?marketAr(page.market):page.market;

 return <main className="di" dir={dir} lang={lang}>
  <PlatformHeader lang={lang}/>

  <section className="di-hero shell">
   <p className="kicker">{t.heroK}</p>
   <h1><bdi>{shownProduct}</bdi><br/><em><bdi>{shownMarket}</bdi></em></h1>
   <p>{t.heroP}</p>
   <div className="di-actions"><a href="#live-rfq">{t.heroA}</a><a href="/demand/">{t.heroB}</a></div>
  </section>

  <section className="di-section shell">
   <div className="di-head"><div><p className="kicker">{t.structK}</p><h2>{t.structH}</h2></div>{lang==='en'&&<p>{page.searchIntent}</p>}</div>
   <div className="di-cards">
    <article><small>{t.mK}</small><h3><bdi>{shownMarket}</bdi></h3><p>{t.mP}</p><b>{t.mB}</b></article>
    <article><small>{t.vK}</small><h3>{page.content?.quantity||t.vD}</h3><p>{t.vP}</p><b>{t.vB}</b></article>
    <article><small>{t.dK}</small><h3 dir="ltr">{page.content?.incoterm||'FOB / CFR / CIF'}</h3><p>{page.content?.packing?t.dPk+page.content.packing:t.dP}</p><b>{page.content?.deadline?t.dDl+page.content.deadline.slice(0,10):t.dB}</b></article>
   </div>
  </section>

  <section className="di-section ir-section" id="live-rfq">
   <div className="shell">
    <div className="di-head"><div><p className="kicker">{t.rfqK}</p><h2>{t.rfqH}</h2></div><p>{t.rfqP}</p></div>
    <RfqForm intentSlug={page.slug} product={product} market={page.market} shownProduct={shownProduct} shownMarket={shownMarket} lang={lang}/>
   </div>
  </section>
 </main>
}
