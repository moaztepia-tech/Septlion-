// UI contract fixture only. Actual Edge authorization and PostgreSQL mutations
// are tested separately by command-center-api/db.test.mjs.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
const sectors=[{id:'food',code:'FOOD',name:'الأغذية',updatedAt:'2026-10-26T00:00:00Z'}];
let products=[];const requests=[];
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end('{}');return}
 if(req.url==='/observations'){res.end(JSON.stringify({requests,products}));return}
 let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw||'{}');
 const role=req.headers.authorization==='Bearer ADMIN'?'ADMIN':req.headers.authorization==='Bearer SALES'?'SALES':null;
 let data={};
 if(b.action==='me')data={isOperator:!!role,operatorRole:role};
 else if(b.action==='catalog.public')data={items:products.filter(p=>p.status==='ACTIVE')};
 else if(!role&&b.action!=='requirements.create'){res.statusCode=403;data={error:'Forbidden'}}
 else if(b.action==='sectors.list')data={items:sectors};
 else if(b.action==='catalog.list')data={items:products};
 else if(b.action==='catalog.save'){
  const p={...b.input,id:'product-1',sector:sectors[0],status:'DRAFT',visibility:'PRIVATE',updatedAt:new Date().toISOString(),skus:b.input.skus.map((s,i)=>({...s,id:'sku-'+i,specifications:{packing:s.packing}}))};products=[p];data={id:p.id};
 }else if(b.action==='catalog.publish'){products[0].status='ACTIVE';products[0].visibility='PUBLIC';products[0].updatedAt=new Date().toISOString();data={id:products[0].id}}
 else if(b.action==='requirements.create'){requests.push(b.input);data={item:{id:'req-'+requests.length},rfq:{id:'rfq-1'}}}
 else if(req.url==='/observations')data={requests,products};
 res.end(JSON.stringify(data));
});
server.listen(3299,'127.0.0.1');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3200','-H','127.0.0.1'],{cwd:new URL('../../apps/web',import.meta.url),env:{...process.env,SEPTLION_TEST_RUNTIME:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3299',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public-key'},stdio:'inherit'});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{child.kill(sig);server.close();process.exit()});
