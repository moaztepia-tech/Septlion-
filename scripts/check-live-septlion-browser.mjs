import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://www.septlion.com';
await mkdir('test-results/live',{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},locale:'ar-EG'});
const test=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:String(e).slice(0,250)});console.error('FAIL',name,String(e).slice(0,250))}};
await test('Homepage reaches browser',async()=>{
 const r=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
 if(!r?.ok())throw Error('HTTP '+r?.status());
 await page.getByText('من احتياجك',{exact:false}).first().waitFor({timeout:10000});
 await page.screenshot({path:'test-results/live/home.png',fullPage:true});
});
for(const path of ['/require/','/review/','/my-septlion/']){
 await test('Buyer route '+path,async()=>{
  const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:25000});
  if(!response?.ok())throw Error('HTTP '+response?.status());
  await page.screenshot({path:'test-results/live/'+path.replaceAll('/','')+'.png',fullPage:true});
 });
}
await test('Live site retains RFQ review button',async()=>{
 await page.goto(base+'/review/',{waitUntil:'domcontentloaded',timeout:25000});
 const content=await page.locator('body').innerText();
 if(!/مراجعة|طلب/.test(content))throw Error('Expected customer review missing');
});
await browser.close();
await writeFile('test-results/live/report.json',JSON.stringify({base,utc:new Date().toISOString(),results},null,2));
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
