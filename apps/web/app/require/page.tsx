'use client';
import {useEffect,useRef,useState} from 'react';
import {PlatformHeader} from '../../components/platform-header';
import {extractRequirement as extract, mergeRequirementInput} from '../../lib/requirement-input';
import {accessToken} from '../../lib/api';
import {createTradeRequirement} from '../../lib/trade-data';

type Lang='ar'|'en';
type FeedContext={source:'product_feed';product:{id:string;name:string;nameEn:string;packing:string};containerCount:number;septlionScale:string;incoterm:string;destination:{port:string;country:string;code:string};paymentPreference:string;buyer:{name:string;company:string;whatsapp:string;email:string|null;whatsappStatus:string}};
const ar={hello:'ماذا تحتاج؟',sub:'صف احتياجك بطريقتك. سنحوّله معك إلى طلب توريد واضح.',ph:'اكتب ما تحتاجه…',hint:'مثال: أحتاج 5 حاويات دقيق مخابز إلى تنزانيا',thinking:'فهمت. أحتاج معلومة واحدة فقط لأكمل طلبك.',ready:'طلبك يحتوي الآن على المعلومات الأساسية اللازمة للتأهيل والتسعير.',new:'طلب جديد'};
const en={hello:'What do you need?',sub:'Describe it naturally. You do not need to know the technical specification.',ph:'Describe your requirement…',hint:'Start simply: I need 5 containers of bakery flour in Tanzania',thinking:'Got it. I only need one more detail to complete your requirement.',ready:'Great. I now have the core information needed to prepare your requirement for pricing.',new:'New chat'};
export default function RequirePage(){const[lang,setLang]=useState<Lang>('ar'),[input,setInput]=useState(''),[data,setData]=useState<Record<string,string>>({}),[messages,setMessages]=useState<{role:'user'|'assistant',text:string}[]>([]),[feedContext,setFeedContext]=useState<FeedContext|null>(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');const box=useRef<HTMLTextAreaElement>(null),t=lang==='ar'?ar:en;
useEffect(()=>{
 const pending=sessionStorage.getItem('septlion_pending_requirement');if(pending&&accessToken()){try{const p=JSON.parse(pending);if(p?.source==='product_feed'){setFeedContext(p);setData({product:p.product.nameEn,quantity:p.containerCount+' FCL',packing:p.product.packing,destination:p.destination.port,incoterm:p.incoterm,payment:p.paymentPreference});return}else if(p&&typeof p==='object'){setData(p);return}}catch{}}
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
 if(seed){let context:Record<string,string>={};try{context=JSON.parse(sessionStorage.getItem('septlion_requirement_context')||'{}')}catch{}sessionStorage.removeItem('septlion_requirement_seed');sessionStorage.removeItem('septlion_requirement_context');submit(seed,context)}
},[]);
const required=['product',...(data.product==='Wheat Flour'?['application']:[]),'quantity','packing','destination'];const missing=required.filter(k=>!data[k]);const next=missing[0];
const q:Record<string,string>=lang==='ar'?{product:'ما المنتج الذي تحتاجه؟',application:'هل الدقيق للمخابز أم لاستخدام آخر؟',quantity:'ما الكمية التقريبية التي تحتاجها؟',packing:'ما حجم التعبئة الذي تفضله؟ وإذا لم تكن متأكدًا أخبرني.',destination:'إلى أي دولة أو ميناء تريد التوريد؟'}:{product:'What product do you need?',application:'Is the flour for bakeries or another use?',quantity:'What approximate quantity do you need?',packing:'What packing size do you prefer? If you are unsure, tell me.',destination:'Which country or port should we supply to?'};
function normalize(k:string,v:string){if(k==='application'&&/مخابز|bakery/i.test(v))return'Bakery';if(k==='quantity'&&/حاوي|fcl|container/i.test(v))return(v.match(/\d+/)?.[0]||'1')+' FCL';if(k==='packing'&&/لا اعرف|لا أعرف|غير متأكد|not sure/i.test(v))return data.product==='Wheat Flour'?'50kg (suggested)':'Septlion-assisted';return v}
function submit(raw?:string,context:Record<string,string>={}){const text=(raw??input).trim();if(!text)return;let parsed=extract(text);let nextData=mergeRequirementInput(text,{...data,...context});const currentRequired=['product',...(nextData.product==='Wheat Flour'?['application']:[]),'quantity','packing','destination'];const currentMissing=currentRequired.filter(k=>!nextData[k]);if(messages.length&&next&&!parsed[next])nextData[next]=normalize(next,text);const afterMissing=currentRequired.filter(k=>!nextData[k]);setData(nextData);setMessages(m=>[...m,{role:'user',text},{role:'assistant',text:afterMissing.length?(lang==='ar'?'فهمت. '+(q[afterMissing[0]]||t.thinking):'Got it. '+(q[afterMissing[0]]||t.thinking)):t.ready}]);setInput('');setTimeout(()=>box.current?.focus(),50)}
function reset(){setData({});setMessages([]);setInput('');setFeedContext(null);setSaveError('');sessionStorage.removeItem('septlion_feed_context');sessionStorage.removeItem('septlion_pending_requirement')}
async function saveRequirement(){setSaving(true);setSaveError('');try{
 if(!accessToken()){sessionStorage.setItem('septlion_pending_requirement',JSON.stringify(feedContext||data));window.location.href='/account?next=/require';return}
 let id:string;
 if(feedContext){const r=await createTradeRequirement({product:feedContext.product.nameEn,quantity:feedContext.containerCount+' FCL',containerCount:feedContext.containerCount,packing:feedContext.product.packing,destination:feedContext.destination.port,deliveryCountry:feedContext.destination.country,destinationCode:feedContext.destination.code,incoterm:feedContext.incoterm,paymentPreference:feedContext.paymentPreference,source:'PRODUCT_FEED',sourceContext:feedContext});id=r.item.id}
 else{const r=await createTradeRequirement({...data,source:'AI_COMPOSER'});id=r.item.id}
 sessionStorage.setItem('septlion_active_request',id);sessionStorage.removeItem('septlion_pending_requirement');window.location.href='/request?id='+encodeURIComponent(id)
 }catch(e:any){setSaveError(e?.message||'تعذر حفظ الطلب الآن. حاول مرة أخرى.')}finally{setSaving(false)}}
return <main className="chat-ai" dir={lang==='ar'?'rtl':'ltr'}>
<PlatformHeader lang={lang} actions={<><button className="secondary-link" onClick={reset}>{t.new}</button><button className="platform-action" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={lang==='ar'?'Switch to English':'التبديل إلى العربية'}>{lang==='ar'?'EN':'ع'}</button></>}/>
<section className={'chat-stage '+(messages.length?'has-chat':'')}>
<div className="intent-canvas"><div className="chat-thread">
{!messages.length&&!feedContext&&<div className="chat-welcome"><h1>{t.hello}</h1><p>{t.sub}</p></div>}
{feedContext&&<div className="feed-context-card"><div><small>طلبك الحالي · {feedContext.buyer.company}</small><b>{feedContext.product.name} · {feedContext.containerCount} حاويات</b></div><span>{feedContext.incoterm} · {feedContext.destination.port} · {feedContext.paymentPreference}</span></div>}
{feedContext&&!messages.length&&<div className="chat-msg assistant"><div>طلبك جاهز هنا. يمكنك تعديل أي تفصيل، إضافة ملاحظة أو إرفاق مواصفة، وسأكمل من المعلومات التي أدخلتها بالفعل.</div></div>}
{messages.map((m,i)=><div key={i} className={'chat-msg '+m.role}><div>{m.text}</div></div>)}
{Object.keys(data).length>0&&<div className="intent-context">{Object.entries(data).filter(([k])=>['product','application','quantity','packing','destination','incoterm','payment'].includes(k)).map(([k,v])=><span key={k}>{v}</span>)}</div>}{Object.keys(data).length>0&&missing.length===0&&<div className="qualified-card"><span>✓</span><div><small>QUALIFIED REQUIREMENT</small><b>طلبك جاهز للتسعير</b><p>المعلومات الأساسية مكتملة. يمكن الآن إرسال الطلب إلى Septlion لإعداد العرض.</p></div><button className="primary-link" disabled={saving} onClick={saveRequirement}>{saving?'جارٍ الحفظ…':'حفظ ومتابعة الطلب'}</button>{saveError&&<p role="alert">{saveError}</p>}</div>}</div></div>
<div className="chat-composer-wrap"><div className="chat-composer"><textarea aria-label={lang==='ar'?'احتياجك التجاري':'Your requirement'} ref={box} rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder={feedContext?'اكتب ملاحظتك أو التعديل المطلوب…':t.ph}/><div className="chat-tools"><div><span className="trade-capability">اكتب احتياجك أو التعديل المطلوب</span></div><button className="chat-send" disabled={!input.trim()} onClick={()=>submit()} aria-label={lang==='ar'?'إرسال الاحتياج':'Send requirement'}>↑</button></div></div>{!messages.length&&!feedContext&&<p className="chat-hint">{t.hint}</p>}</div>
</section>
<footer className="chat-foot">SEPTLION · From real demand to executed trade.</footer>
</main>}
