'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';

type Lang='ar'|'en';
type FeedContext={source:'product_feed';product:{id:string;name:string;nameEn:string;packing:string};containerCount:number;septlionScale:string;incoterm:string;destination:{port:string;country:string;code:string};paymentPreference:string;buyer:{name:string;company:string;whatsapp:string;email:string|null;whatsappStatus:string}};
const destinations=['تنزانيا','tanzania','غانا','ghana','كينيا','kenya','السعودية','saudi','مصر','egypt','الصومال','somalia','تشاد','chad','موريتانيا','mauritania','ليبيا','libya','قطر','qatar','السودان','sudan'];
const products:[RegExp,string][]=[[/دقيق|flour/i,'Wheat Flour'],[/مكرونة|معكرونة|pasta|spaghetti/i,'Pasta'],[/صلصة|طماطم|tomato paste/i,'Tomato Paste'],[/سمسم|sesame/i,'Sesame'],[/كركديه|hibiscus/i,'Hibiscus'],[/صمغ عربي|gum arabic/i,'Gum Arabic'],[/كيس|اكياس|أكياس|عبو|packaging|pouch|bag/i,'Custom Packaging'],[/بسكويت|biscuit/i,'Biscuits'],[/زيت|oil/i,'Edible Oil']];
function extract(text:string){const lower=text.toLowerCase(),o:Record<string,string>={};const p=products.find(([r])=>r.test(text));if(p)o.product=p[1];const d=destinations.find(x=>lower.includes(x));if(d)o.destination=d;const f=text.match(/(\d+[\s×x]*)?(حاوي(?:ة|ات)|fcl|container(?:s)?)/i);if(f)o.quantity=(f[0].match(/\d+/)?.[0]||'1')+' FCL';const mt=text.match(/(\d+(?:[.,]\d+)?)\s*(طن|mt|tons?)/i);if(mt)o.quantity=mt[1]+' MT';const kg=text.match(/(\d+(?:[.,]\d+)?)\s*(كجم|كيلو|kg)/i);if(kg)o.packing=kg[1]+'kg';if(/مخابز|خبز|bakery|bread/i.test(text))o.application='Bakery';return o}
const ar={hello:'ماذا تحتاج؟',sub:'صف ما تبحث عنه بطريقتك. لا تحتاج لمعرفة المواصفات الفنية.',ph:'اكتب احتياجك هنا…',hint:'يمكنك أن تبدأ بجملة بسيطة مثل: أريد 5 حاويات دقيق للمخابز في تنزانيا',thinking:'فهمت. أحتاج معلومة واحدة فقط لأكمل طلبك.',ready:'ممتاز. لدي الآن المعلومات الأساسية لإعداد طلبك للتسعير.',new:'محادثة جديدة'};
const en={hello:'What do you need?',sub:'Describe it naturally. You do not need to know the technical specification.',ph:'Describe your requirement…',hint:'Start simply: I need 5 containers of bakery flour in Tanzania',thinking:'Got it. I only need one more detail to complete your requirement.',ready:'Great. I now have the core information needed to prepare your requirement for pricing.',new:'New chat'};
export default function RequirePage(){const[lang,setLang]=useState<Lang>('ar'),[input,setInput]=useState(''),[data,setData]=useState<Record<string,string>>({}),[messages,setMessages]=useState<{role:'user'|'assistant',text:string}[]>([]),[feedContext,setFeedContext]=useState<FeedContext|null>(null);const box=useRef<HTMLTextAreaElement>(null),t=lang==='ar'?ar:en;
useEffect(()=>{
 const raw=sessionStorage.getItem('septlion_feed_context');
 if(raw){
  try{
   const ctx=JSON.parse(raw) as FeedContext;
   if(ctx?.source==='product_feed'){
    setFeedContext(ctx);
    setData({product:ctx.product.nameEn,quantity:ctx.containerCount+' FCL',packing:ctx.product.packing,destination:ctx.destination.port,incoterm:ctx.incoterm,payment:ctx.paymentPreference});
    return;
   }
  }catch{}
 }
 const seed=sessionStorage.getItem('septlion_requirement_seed');
 if(seed){sessionStorage.removeItem('septlion_requirement_seed');submit(seed)}
},[]);
const required=['product',...(data.product==='Wheat Flour'?['application']:[]),'quantity','packing','destination'];const missing=required.filter(k=>!data[k]);const next=missing[0];
const q:Record<string,string>=lang==='ar'?{product:'ما المنتج الذي تحتاجه؟',application:'هل الدقيق للمخابز أم لاستخدام آخر؟',quantity:'ما الكمية التقريبية التي تحتاجها؟',packing:'ما حجم التعبئة الذي تفضله؟ وإذا لم تكن متأكدًا أخبرني.',destination:'إلى أي دولة أو ميناء تريد التوريد؟'}:{product:'What product do you need?',application:'Is the flour for bakeries or another use?',quantity:'What approximate quantity do you need?',packing:'What packing size do you prefer? If you are unsure, tell me.',destination:'Which country or port should we supply to?'};
function normalize(k:string,v:string){if(k==='application'&&/مخابز|bakery/i.test(v))return'Bakery';if(k==='quantity'&&/حاوي|fcl|container/i.test(v))return(v.match(/\d+/)?.[0]||'1')+' FCL';if(k==='packing'&&/لا اعرف|لا أعرف|غير متأكد|not sure/i.test(v))return data.product==='Wheat Flour'?'50kg (suggested)':'Septlion-assisted';return v}
function submit(raw?:string){const text=(raw??input).trim();if(!text)return;let parsed=extract(text);let nextData={...data,...parsed};const currentRequired=['product',...(nextData.product==='Wheat Flour'?['application']:[]),'quantity','packing','destination'];const currentMissing=currentRequired.filter(k=>!nextData[k]);if(messages.length&&next&&!parsed[next])nextData[next]=normalize(next,text);const afterMissing=currentRequired.filter(k=>!nextData[k]);setData(nextData);setMessages(m=>[...m,{role:'user',text},{role:'assistant',text:afterMissing.length?(lang==='ar'?'فهمت. '+(q[afterMissing[0]]||t.thinking):'Got it. '+(q[afterMissing[0]]||t.thinking)):t.ready}]);setInput('');setTimeout(()=>box.current?.focus(),50)}
function reset(){setData({});setMessages([]);setInput('')}
return <main className="chat-ai" dir={lang==='ar'?'rtl':'ltr'}>
<header className="chat-top"><Link href="/" className="chat-logo"><img src="/brand/septlion-primary-navy.png" alt="Septlion"/></Link><div><button onClick={reset}>＋ {t.new}</button><button onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'EN':'ع'}</button></div></header>
<section className={'chat-stage '+(messages.length?'has-chat':'')}>
<div className="chat-thread">
{!messages.length&&!feedContext&&<div className="chat-welcome"><div className="chat-mark">S</div><h1>{t.hello}</h1><p>{t.sub}</p></div>}
{feedContext&&<div className="feed-context-card"><div><small>طلبك الحالي · {feedContext.buyer.company}</small><b>{feedContext.product.name} · {feedContext.containerCount} حاويات</b></div><span>{feedContext.incoterm} · {feedContext.destination.port} · {feedContext.paymentPreference}</span></div>}
{feedContext&&!messages.length&&<div className="chat-msg assistant"><span className="chat-avatar">S</span><div>طلبك جاهز هنا. يمكنك تعديل أي تفصيل، إضافة ملاحظة أو إرفاق مواصفة، وسأكمل من المعلومات التي أدخلتها بالفعل.</div></div>}
{messages.map((m,i)=><div key={i} className={'chat-msg '+m.role}>{m.role==='assistant'&&<span className="chat-avatar">S</span>}<div>{m.text}</div></div>)}
</div>
<div className="chat-composer-wrap"><div className="chat-composer"><textarea ref={box} rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder={feedContext?'اكتب ملاحظتك أو التعديل المطلوب…':t.ph}/><div className="chat-tools"><div><button type="button" title="Attach">＋</button><button type="button" title="Voice">◉</button></div><button className="chat-send" onClick={()=>submit()} aria-label="Send">↑</button></div></div>{!messages.length&&!feedContext&&<p className="chat-hint">{t.hint}</p>}</div>
</section>
<footer className="chat-foot">{lang==='ar'?'Septlion تساعدك في تحويل احتياجك إلى طلب توريد واضح وقابل للتنفيذ.':'Septlion turns your need into a clear, executable supply requirement.'}</footer>
</main>}