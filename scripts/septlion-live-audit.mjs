import {writeFile} from 'node:fs/promises';
const BASE='https://www.septlion.com';
const checks=[];
const check=(name,ok,detail)=>checks.push({name,ok,detail});
async function fetchPage(path){
  try {
    const r=await fetch(BASE+path,{redirect:'follow',signal:AbortSignal.timeout(15000)});
    return {code:r.status,html:await r.text()};
  } catch(e){return {code:0,html:'',error:String(e)};}
}
const root=await fetchPage('/');
check('Homepage available',root.code===200,'HTTP '+root.code);
check('Current homepage remains a demo',!root.html.includes('septlion.preview.requests.v3')&&!root.html.includes('لم يُرسل طلب إلى SEPTLION'),root.html.includes('septlion.preview.requests.v3')?'Local-only preview RFQs found':'Preview marker not found');
for(const p of ['/discover/','/require/','/review/','/requests/','/account/','/my-septlion/']){
  const r=await fetchPage(p);
  check('Customer route '+p,r.code===200,'HTTP '+r.code);
}
const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),20000);
try{
  const r=await fetch('https://septlion-web-production.up.railway.app/api/interpret-requirement',{
    method:'POST',headers:{Origin:BASE,'Content-Type':'application/json'},
    body:JSON.stringify({text:'أحتاج حاويتين دقيق قمح إلى مومباسا'}),signal:controller.signal
  });
  const data=await r.json().catch(()=>({}));
  check('Gemini Arabic extraction',r.ok&&!!data.fields?.product&&!!data.fields?.quantity&&!!data.fields?.destination,'HTTP '+r.status+'; provider returned fields: '+Object.keys(data.fields||{}).join(','));
}catch(e){check('Gemini Arabic extraction',false,String(e));}finally{clearTimeout(timer);}
const failures=checks.filter(x=>!x.ok);
const report=['# SEPTLION — production launch read-only audit','','Checked: '+new Date().toISOString(),'No files, requests, accounts or settings were changed by this audit.','','| Check | State | Evidence |','|---|---|---|',...checks.map(x=>'| '+x.name+' | '+(x.ok?'PASS':'FAIL')+' | '+x.detail.replaceAll('|','/').replaceAll('\n',' ')+' |'),'','**Launch gate: '+(failures.length?'BLOCKED':'EXTERNAL SMOKE PASS')+'**','','A passing external audit alone does not prove authenticated RFQ delivery. Before publishing changes, also verify with a consented real buyer account: phone verification, persisted RFQ in Supabase, operator access, and the approved Discover stay-in-place confirmation.'].join('\n');
await writeFile('septlion-live-audit.md',report);
console.log(report);
if(failures.length)process.exitCode=1;
