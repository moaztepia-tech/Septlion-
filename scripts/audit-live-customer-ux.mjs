import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://www.septlion.com',pages=['/','/discover/','/require/','/review/','/my-septlion/','/account/','/requests/','/request/','/notifications/','/company/'];
const modes=[{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true},{name:'desktop',viewport:{width:1366,height:900},isMobile:false,hasTouch:false}];
await mkdir('test-results/ux-audit',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const report={timestamp:new Date().toISOString(),base,pages:[],journeys:[]};
for(const mode of modes){
 const context=await browser.newContext({viewport:mode.viewport,isMobile:mode.isMobile,hasTouch:mode.hasTouch,locale:'ar-EG'});
 const tab=await context.newPage();
 for(const url of pages){
  const key=url==='/'?'home':url.replaceAll('/','');
  const record={mode:mode.name,path:url};
  let errors=[];
  tab.on('pageerror',e=>errors.push(String(e).slice(0,260)));
  try{
   const response=await tab.goto(base+url,{waitUntil:'domcontentloaded',timeout:30000});
   await tab.waitForTimeout(650);
   record.status=response?.status()??null;record.finalUrl=tab.url();
   record.metrics=await tab.evaluate(()=>{
    const all=(s)=>[...document.querySelectorAll(s)];
    const visibles=(s)=>all(s).filter(x=>{const r=x.getBoundingClientRect(),css=getComputedStyle(x);return r.width>1&&r.height>1&&css.visibility!=='hidden'&&css.display!=='none'});
    const styles=(el)=>{if(!el)return null;const s=getComputedStyle(el);return {bg:s.backgroundColor,color:s.color,font:s.fontFamily,fontSize:s.fontSize,position:s.position}};
    const nav=visibles('header,nav,.dock,.platform-header,.trade-subnav');
    const text=document.body.innerText||'';
    const links=visibles('a').slice(0,45).map(x=>({text:x.innerText.trim().slice(0,35),href:x.getAttribute('href')}));
    const headers=visibles('header,.platform-header,nav,.dock').map(x=>({class:x.className,style:styles(x),text:x.innerText.slice(0,110)}));
    const elements=all('input,select,textarea,button').filter(x=>{const r=x.getBoundingClientRect();return r.width>1&&r.height>1});
    return {title:document.title,h1:visibles('h1').map(x=>x.innerText.slice(0,140)),body:styles(document.body),main:styles(visibles('main')[0]),navCount:nav.length,headers,links,interactiveCount:elements.length,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,bodyText:text.slice(0,750),demoMentions:/تجريب|محاكاة|preview|demo/i.test(text),missingLogo:!document.querySelector('svg use[href="#lg-sym"],.platform-brand img,.lg,.brand-logo'),hasAppDock:visibles('.dock').length>0,hasNextHeader:visibles('.platform-header').length>0};
   });
   await tab.screenshot({path:'test-results/ux-audit/'+mode.name+'-'+key+'.png',fullPage:true,animations:'disabled',timeout:15000});
  }catch(err){record.error=String(err).slice(0,400)}
  record.errors=errors;report.pages.push(record);console.log('AUDIT_PAGE',JSON.stringify(record));
 }
 await context.close();
}
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ar-EG'});
const tab=await context.newPage();
try{
 await tab.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
 const nav=await tab.evaluate(()=>[...document.querySelectorAll('a[href],button[data-go],button[data-act]')].filter(x=>x.getBoundingClientRect().width>1).map(x=>({label:x.innerText.slice(0,40),href:x.getAttribute('href'),action:x.getAttribute('data-go')||x.getAttribute('data-act')})).slice(0,45));
 report.journeys.push({from:'homepage',actions:nav});
 const discover=tab.locator('[data-go="discover"]').first();
 if(await discover.count()){
  await discover.click();await tab.waitForTimeout(500);
  report.journeys.push({event:'discover navigation',url:tab.url(),hash:new URL(tab.url()).hash,route:await tab.locator('#app').getAttribute('data-route').catch(()=>null)});
 }
 const buttons=tab.getByText('اطلب هذا المنتج',{exact:false});
 report.journeys.push({event:'order button availability',count:await buttons.count()});
}catch(e){report.journeys.push({event:'navigation error',error:String(e).slice(0,350)})}
await context.close();await browser.close();
await writeFile('test-results/ux-audit/report.json',JSON.stringify(report,null,2));
console.log('AUDIT_SUMMARY',JSON.stringify({pages:report.pages.length,failures:report.pages.filter(x=>!x.status||x.status>=400).map(x=>x.path),visualModels:[...new Set(report.pages.map(x=>x.metrics?.hasAppDock?'approved-spa':x.metrics?.hasNextHeader?'nextjs':'other'))],journeys:report.journeys}));
