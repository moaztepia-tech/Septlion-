'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';

type State='confirmed'|'suggested'|'missing';
type Field={key:string;labelAr:string;labelEn:string;value:string;state:State};
type Lang='ar'|'en';

const destinations=['تنزانيا','tanzania','غانا','ghana','كينيا','kenya','السعودية','saudi','مصر','egypt','الصومال','somalia','تشاد','chad','موريتانيا','mauritania','ليبيا','libya','قطر','qatar','السودان','sudan'];
const products:[RegExp,string][]=[
 [/دقيق|flour/i,'Wheat Flour'],[/مكرونة|معكرونة|pasta|spaghetti/i,'Pasta'],[/صلصة|طماطم|tomato paste/i,'Tomato Paste'],
 [/سمسم|sesame/i,'Sesame'],[/كركديه|hibiscus/i,'Hibiscus'],[/صمغ عربي|gum arabic/i,'Gum Arabic'],
 [/كيس|اكياس|أكياس|عبو|packaging|pouch|bag/i,'Custom Packaging'],[/بسكويت|biscuit/i,'Biscuits'],[/زيت|oil/i,'Edible Oil']
];

function extract(text:string){
 const lower=text.toLowerCase(); const out:Record<string,string>={};
 const p=products.find(([r])=>r.test(text)); if(p)out.product=p[1];
 const d=destinations.find(x=>lower.includes(x)); if(d)out.destination=d;
 const fcl=text.match(/(\d+[\s×x]*)?(حاوي(?:ة|ات)|fcl|container(?:s)?)/i);
 if(fcl)out.quantity=(fcl[0].match(/\d+/)?.[0]||'1')+' FCL';
 const mt=text.match(/(\d+(?:[.,]\d+)?)\s*(طن|mt|tons?)/i); if(mt)out.quantity=mt[1]+' MT';
 const kg=text.match(/(\d+(?:[.,]\d+)?)\s*(كجم|كيلو|kg)/i); if(kg)out.packing=kg[1]+'kg';
 if(/مخابز|خبز|bakery|bread/i.test(text))out.application='Bakery';
 if(/علامتي|براند|private label|my brand/i.test(text))out.brand='Private Label';
 if(/zollana|زولانا/i.test(text))out.brand='Zollana';
 if(/cif/i.test(text))out.incoterm='CIF'; else if(/fob/i.test(text))out.incoterm='FOB'; else if(/cfr/i.test(text))out.incoterm='CFR';
 return out;
}

const copy={
 ar:{dir:'rtl' as const,back:'Septlion',kicker:'BUYER INTELLIGENCE',title:'ماذا تحتاج؟',lead:'صف لنا ما تبحث عنه بطريقتك. لا تحتاج لمعرفة جميع المواصفات — نحن نتولى التعقيد.',placeholder:'مثال: أحتاج 5 حاويات دقيق للمخابز إلى تنزانيا، تعبئة 50 كجم…',send:'ابدأ',understand:'ما فهمناه',empty:'ابدأ بوصف احتياجك، وسنبني الطلب معك.',next:'السؤال التالي',ready:'طلبك جاهز للتسعير',progress:'جاهزية الطلب',confirmed:'مؤكد',suggested:'مقترح',missing:'ناقص',why:'نسأل فقط عما يؤثر في السعر أو التوريد أو الجودة أو التسليم.',dontKnow:'لست متأكدًا',answer:'أرسل الإجابة',reset:'طلب جديد',fields:{product:'المنتج',application:'الاستخدام',quantity:'الكمية',packing:'التعبئة',destination:'الوجهة',brand:'مسار العلامة',incoterm:'شرط التسليم',requiredDate:'موعد الاحتياج'}},
 en:{dir:'ltr' as const,back:'Septlion',kicker:'BUYER INTELLIGENCE',title:'What do you need?',lead:'Describe what you need in your own words. You do not need to know every specification — we handle the complexity.',placeholder:'Example: I need 5 FCL of bakery flour to Tanzania, packed in 50kg bags…',send:'Start',understand:'What we understand',empty:'Describe your need and we will structure the requirement with you.',next:'Next question',ready:'Your requirement is ready for pricing',progress:'Requirement readiness',confirmed:'Confirmed',suggested:'Suggested',missing:'Missing',why:'We only ask what materially affects price, supply, quality or delivery.',dontKnow:'I am not sure',answer:'Send answer',reset:'New requirement',fields:{product:'Product',application:'Application',quantity:'Quantity',packing:'Packing',destination:'Destination',brand:'Brand route',incoterm:'Delivery term',requiredDate:'Required date'}}
};

export default function RequirePage(){
 const[lang,setLang]=useState<Lang>('ar'); const[input,setInput]=useState(''); const[data,setData]=useState<Record<string,string>>({});
 const[answer,setAnswer]=useState(''); const[history,setHistory]=useState<string[]>([]); const t=copy[lang];
 const schema=useMemo(()=>[
  ['product',true],['application',data.product==='Wheat Flour'],['quantity',true],['packing',true],['destination',true],['brand',false],['incoterm',false],['requiredDate',false]
 ] as [string,boolean][],[data.product]);
 const critical=schema.filter(([,required])=>required).map(([k])=>k);
 const missing=critical.filter(k=>!data[k]);
 const readiness=Math.round(((critical.length-missing.length)/critical.length)*100);
 const next=missing[0];
 const questions:Record<string,[string,string[]]>=lang==='ar'?{
  product:['ما المنتج الذي تحتاجه؟',[]],application:['ما الاستخدام الأساسي للمنتج؟',['مخابز','استخدام عام','صناعي']],quantity:['ما الكمية التقريبية؟',['1 حاوية','5 حاويات','10 حاويات']],packing:['ما التعبئة التي تفضلها؟',['50kg','25kg','لست متأكدًا']],destination:['إلى أي دولة أو ميناء تريد التوريد؟',[]]
 }:{
  product:['What product do you need?',[]],application:['What is the main application?',['Bakery','General purpose','Industrial']],quantity:['What approximate quantity do you need?',['1 FCL','5 FCL','10 FCL']],packing:['What packing do you prefer?',['50kg','25kg','I am not sure']],destination:['Which country or port should we supply to?',[]]
 };
 function ingest(text:string){if(!text.trim())return;const parsed=extract(text);setData(v=>({...v,...parsed}));setHistory(v=>[...v,text.trim()]);setInput('');}
 function respond(value:string){if(!next||!value.trim())return; let v=value.trim(); if(next==='application'&&/مخابز|bakery/i.test(v))v='Bakery'; if(next==='quantity'&&/حاوي|fcl/i.test(v)){const n=v.match(/\d+/)?.[0]||'1';v=n+' FCL'}; if(next==='packing'&&/غير متأكد|not sure/i.test(v)){v=data.product==='Wheat Flour'?'50kg (Septlion suggestion)':'Septlion-assisted';} setData(d=>({...d,[next]:v}));setHistory(h=>[...h,(lang==='ar'?'إجابة: ':'Answer: ')+value]);setAnswer('');}
 function reset(){setData({});setHistory([]);setInput('');setAnswer('');}
 const fields:Field[]=schema.map(([key])=>({key,labelAr:copy.ar.fields[key as keyof typeof copy.ar.fields],labelEn:copy.en.fields[key as keyof typeof copy.en.fields],value:data[key]||'',state:data[key]?(data[key].includes('suggestion')||data[key].includes('assisted')?'suggested':'confirmed'):'missing'}));
 return <main className="bi" dir={t.dir}>
  <header className="bi-nav"><Link href="/" className="bi-brand"><img src="/brand/septlion-primary-navy.png" alt="Septlion"/></Link><div><span>{t.kicker}</span><button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button></div></header>
  <section className="bi-shell bi-hero"><div><p className="bi-kicker">{t.kicker}</p><h1>{t.title}</h1><p>{t.lead}</p></div><div className="bi-principle">{lang==='ar'?'تحدث بلغتك. Septlion تتولى تعقيد التجارة والتصنيع.':'Speak naturally. Septlion handles the complexity of trade and manufacturing.'}</div></section>
  <section className="bi-shell bi-grid">
   <div className="bi-conversation">
    {!history.length&&<div className="bi-empty">{t.empty}</div>}
    {history.map((h,i)=><div className="bi-bubble" key={i}>{h}</div>)}
    {!history.length&&<div className="bi-start"><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={t.placeholder}/><button onClick={()=>ingest(input)}>{t.send} ↗</button></div>}
    {!!history.length&&missing.length>0&&<div className="bi-question"><small>{t.next}</small><h2>{questions[next]?.[0]}</h2><div className="bi-options">{questions[next]?.[1].map(x=><button key={x} onClick={()=>respond(x)}>{x}</button>)}</div><div className="bi-answer"><input value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==='Enter'&&respond(answer)} placeholder={lang==='ar'?'اكتب إجابتك…':'Type your answer…'}/><button onClick={()=>respond(answer)}>{t.answer}</button></div><p>{t.why}</p></div>}
    {!!history.length&&missing.length===0&&<div className="bi-ready"><span>✓</span><div><small>{lang==='ar'?'QUALIFIED REQUIREMENT':'QUALIFIED REQUIREMENT'}</small><h2>{t.ready}</h2><p>{lang==='ar'?'ستتولى Septlion الآن بناء مسار التوريد والعرض التجاري.':'Septlion can now build the supply route and commercial offer.'}</p></div></div>}
   </div>
   <aside className="bi-memory"><div className="bi-memory-head"><div><small>{t.understand}</small><strong>{t.progress} · {readiness}%</strong></div><button onClick={reset}>{t.reset}</button></div><div className="bi-progress"><i style={{width:readiness+'%'}}/></div><div className="bi-fields">{fields.map(f=><div key={f.key}><span>{lang==='ar'?f.labelAr:f.labelEn}</span><b>{f.value||'—'}</b><em className={'bi-'+f.state}>{f.state==='confirmed'?t.confirmed:f.state==='suggested'?t.suggested:t.missing}</em></div>)}</div></aside>
  </section>
 </main>
}