// Local transport around the production Edge handler and real PostgreSQL data.
// Only the outside phone/Auth provider is a fixture. Fixed test OTP never ships.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createEdgePostgres} from '../helpers/edge-postgres.mjs';
const phoneUser={id:'phone-buyer',phone:'201012345678',phone_confirmed_at:'2026-01-01T00:00:00Z'};
const otpChannels=[];
const backend=await createEdgePostgres(token=>token==='ADMIN'?{id:'actor-admin',email:'admin@fixture.invalid'}:token==='PHONE'?phoneUser:null);
const server=createServer(async(req,res)=>{
 try{
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3200');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.end('{}');return}
  let raw='';for await(const c of req)raw+=c;
  if(req.url==='/observations'){
   const requests=(await backend.pg.query('select "knownFacts" as input from core."QualifiedRequirement" order by "createdAt"')).rows.map(r=>r.input);
   const rfqs=(await backend.pg.query('select id,"requirementId",status from core."RFQ"')).rows;const transactions=(await backend.pg.query('select id,status,version from core."TradeTransaction"')).rows;res.end(JSON.stringify({requests,rfqs,transactions,otpChannels,engine:'postgresql'}));return;
  }
  const b=JSON.parse(raw||'{}');
  if(req.url==='/auth/v1/otp'){if(b.channel!=='whatsapp'){res.statusCode=400;res.end('{}');return}otpChannels.push(b.channel);res.end('{}');return}
  if(req.url==='/auth/v1/verify'){if(b.token!=='123456'){res.statusCode=403;res.end(JSON.stringify({message:'Invalid OTP'}));return}res.end(JSON.stringify({access_token:'PHONE',refresh_token:'fixture',expires_at:4102444800,user:phoneUser}));return}
  if(req.url==='/auth/v1/user'){res.end(JSON.stringify(phoneUser));return}
  const result=await backend.handler(new Request('http://127.0.0.1:3299'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:raw}:{})}));
  res.statusCode=result.status;res.end(await result.text());
 }catch(e){console.error(e);res.statusCode=500;res.end(JSON.stringify({error:'Local integration transport failed'}))}
});
await new Promise(resolve=>server.listen(3299,'127.0.0.1',resolve));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3200','-H','127.0.0.1'],{cwd:new URL('../../apps/web',import.meta.url),env:{...process.env,SEPTLION_TEST_RUNTIME:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3299',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public-key'},stdio:'inherit'});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{child.kill(sig);server.close();void backend.close().finally(()=>process.exit())});
