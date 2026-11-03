import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='test-results/variant-audit'; await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const urls=['https://septlion.com/','https://www.septlion.com/','http://septlion.com/','http://www.septlion.com/','https://www.septlion.com/discover/','https://www.septlion.com/require/'];
const observations=[];
for(const mode of ['mobile-android','desktop']){
 const context=await browser.newContext(mode==='mobile-android'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',locale:'ar-EG'}:{viewport:{width:1365,height:850},locale:'ar-EG'});
 for(let i=0;i<urls.length;i++){
  const url=urls[i],page=await context.newPage(),record={mode,url};
  try{
   const resp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForTimeout(1000);
   const html=await page.content();
   Object.assign(record,{status:resp?.status(),finalUrl:page.url(),sha256:createHash('sha256').update(html).digest('hex'),title:await page.title(),h1:await page.locator('h1').allTextContents(),cacheControl:resp?.headers()['cache-control'],etag:resp?.headers()['etag'],server:resp?.headers()['server'],contentLength:html.length,serviceWorkers:await page.evaluate(async()=>({controllers:!!navigator.serviceWorker?.controller,registrations:navigator.serviceWorker?((await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.scriptURL}))):[],caches:typeof caches!=='undefined'?await caches.keys():[],manifest:[...document.querySelectorAll('link[rel="manifest"]')].map(x=>x.href),scripts:[...document.scripts].filter(x=>x.src).slice(0,7).map(x=>x.src),css:[...document.querySelectorAll('link[rel="stylesheet"]')].slice(0,7).map(x=>x.href)}))});
   if(i<2||i===4||i===5)await page.screenshot({path:dir+'/'+mode+'-'+i+'.png',fullPage:true,timeout:30000});
  }catch(e){record.error=String(e).slice(0,500)}
  observations.push(record);console.log('VARIANT_AUDIT',JSON.stringify({...record,serviceWorkers:record.serviceWorkers&&{controllers:record.serviceWorkers.controllers,registrations:record.serviceWorkers.registrations,caches:record.serviceWorkers.caches,manifest:record.serviceWorkers.manifest}}));
  await page.close();
 }
 await context.close();
}
await browser.close();
await writeFile(dir+'/report.json',JSON.stringify({generated:new Date().toISOString(),observations},null,2));
