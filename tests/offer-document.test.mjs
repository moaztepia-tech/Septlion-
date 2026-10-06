import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as nodeModule from 'node:module';
import {test} from 'node:test';
let transpile;
try { const {default:ts}=await import('typescript');transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText; }
catch { if(!nodeModule.stripTypeScriptTypes)throw new Error('Use workspace TypeScript or Node 22.13+.');transpile=s=>nodeModule.stripTypeScriptTypes(s,{mode:'strip'}); }
const load=s=>import('data:text/javascript;base64,'+Buffer.from(transpile(s)).toString('base64'));
const helpers=await load(await readFile(new URL('../supabase/functions/trade-api/offer-input.ts',import.meta.url),'utf8'));
const documentApi=await load(await readFile(new URL('../apps/web/lib/offer-document.ts',import.meta.url),'utf8'));
const now=Date.parse('2026-10-06T12:00:00Z');
const requirement={id:'req-1',product:'TEST — غير تجاري',market:'TEST destination',packing:{display:'50kg'}};
const input=()=>({rfqId:'rfq-1',currency:'USD',validUntil:'2026-10-13T23:59:59Z',idempotencyKey:'fixture-issue-001',snapshot:{items:[{description:'TEST — غير تجاري',quantity:1,unit:'FCL',unitPrice:1}],terms:{incoterm:'FOB',payment:'TT',notes:''}}});
test('server derives TEST status and destination from the saved requirement',()=>{
 const x=input();x.snapshot.testOnly=false;x.snapshot.terms.destination='forged';const p=helpers.normalizeOffer(x,requirement,now);
 assert.equal(p.snapshot.testOnly,true);assert.equal(p.snapshot.terms.destination,'TEST destination');assert.match(p.snapshot.terms.notice,/غير ملزم/);assert.equal(p.snapshot.items[0].unitPrice,1);
});
test('real offers require supplier evidence and cannot impersonate a TEST offer',()=>{
 const r={...requirement,product:'Wheat flour'};const x=input();x.snapshot.testOnly=true;assert.throws(()=>helpers.normalizeOffer(x,r,now),/مرجع/);
 x.snapshot.supplyEvidence={reference:'SUPPLIER-QUOTE-01'};assert.equal(helpers.normalizeOffer(x,r,now).snapshot.testOnly,false);
});
test('rejects invalid quantities, prices, currencies, expiry, terms and blank items',()=>{
 for(const change of [x=>x.snapshot.items[0].quantity=-1,x=>x.snapshot.items[0].quantity=1/0,x=>x.snapshot.items[0].unitPrice=NaN,x=>x.snapshot.items[0].description='',x=>x.currency='BTC',x=>x.validUntil='2020-01-01',x=>x.validUntil='2027-01-01',x=>x.snapshot.items=[],x=>x.snapshot.terms.incoterm='INVALID',x=>x.snapshot.terms.payment='UNKNOWN',x=>x.idempotencyKey='bad']){const x=input();change(x);assert.throws(()=>helpers.normalizeOffer(x,requirement,now))}
});
test('JSONB key order preserves retry equivalence while changed prices differ',()=>{
 assert.equal(helpers.sameJson({a:1,items:[{price:2,qty:3}]},{items:[{qty:3,price:2}],a:1}),true);assert.equal(helpers.sameJson({price:2},{price:3}),false);
});
test('document preserves totals, TEST notice and saved revision; omits exclusive labels and private evidence',()=>{
 const p=helpers.normalizeOffer(input(),requirement,now);
 p.snapshot.exclusiveName='Nano';p.snapshot.supplyEvidence.reference='PRIVATE-SUPPLIER-PRICE';
 const m=documentApi.offerDocumentModel({offer:{id:'offer-123',status:'ISSUED',currency:'USD',validUntil:p.validUntil,currentRevision:1},revision:{revisionNo:1,issuedAt:'2026-10-06T12:00:00Z',snapshotHash:'abc',snapshot:p.snapshot},rfq:{reference:'RFQ-001'},buyer:{name:'TEST Buyer'}});
 assert.equal(m.total,1);assert.equal(m.testOnly,true);assert.match(m.reference,/R1$/);assert.match(m.notice,/غير ملزم/);assert.doesNotMatch(JSON.stringify(m.rows),/Nano|PRIVATE-SUPPLIER-PRICE/);
});
test('multipage PDF has byte-accurate xref, page count and binary image lengths',()=>{
 const jpeg=Uint8Array.from([255,216,255,0,128,10,255,217]);const pdf=documentApi.jpegPagesToPdf([jpeg,jpeg],1588,2246),s=Buffer.from(pdf).toString('latin1');
 assert.match(s,/\/Count 2/);assert.match(s,/\/Filter \/DCTDecode \/Length 8/);const xref=Number(s.match(/startxref\n(\d+)/)[1]);assert.equal(s.slice(xref,xref+4),'xref');
 const entries=s.slice(xref).split('\n').slice(3,11);entries.forEach((entry,i)=>{const pos=Number(entry.slice(0,10));assert.equal(s.slice(pos,pos+String(i+1).length+6),(i+1)+' 0 obj')});
 assert.throws(()=>documentApi.jpegPagesToPdf([],1588,2246));
});

// Exercise the real Edge handler with Auth/DB fixtures; no live accounts or tokens.
class Query{
 constructor(rows){this.rows=rows;this.filters=[];this.max=Infinity}
 select(){return this}eq(k,v){this.filters.push(r=>r[k]===v);return this}in(k,v){this.filters.push(r=>v.includes(r[k]));return this}order(){return this}limit(n){this.max=n;return this}
 result(){return this.rows.filter(r=>this.filters.every(f=>f(r))).slice(0,this.max)}
 async maybeSingle(){return{data:this.result()[0]||null,error:null}}async single(){const data=this.result()[0];return{data:data||null,error:data?null:{message:'not_found'}}}
}
function fixture({operator=true,buyer='buyer-1',supplier='septlion-operator',valid=true}={}){
 const user={id:'user-1',email:'fixture@example.invalid'};
 const tables={User:[user],Membership:[{id:'mb',userId:user.id,organizationId:buyer,role:'BUYER'},...(operator?[{id:'mo',userId:user.id,organizationId:'septlion-operator',role:'SALES'}]:[])],RFQ:[{id:'rfq-1',requirementId:'req-1',supplierOrgId:supplier,buyerOrgId:'buyer-1',status:'OPEN',reference:'RFQ-001'}],QualifiedRequirement:[requirement],SeptlionOffer:[],SeptlionOfferRevision:[],Organization:[{id:'buyer-1',name:'TEST Buyer'}]};
 const db={schema:()=>db,auth:{getUser:async()=>({data:{user:valid?user:null},error:valid?null:{message:'invalid'}})},from:name=>new Query(tables[name]||[]),writes:0,
  rpc:async(name,args)=>{if(name==='check_edge_rate_limit')return{data:true,error:null};if(name!=='issue_septlion_offer')throw new Error('unexpected RPC');if(tables.SeptlionOffer.length)return{error:{message:'offer_already_exists'}};
   db.writes++;tables.SeptlionOffer.push({id:'offer-1',rfqId:args.p_rfq_id,requirementId:'req-1',buyerOrgId:'buyer-1',operatorOrgId:'septlion-operator',currency:args.p_currency,validUntil:args.p_valid_until,currentRevision:1,status:'ISSUED'});
   tables.SeptlionOfferRevision.push({id:'revision-1',offerId:'offer-1',revisionNo:1,snapshot:args.p_snapshot,snapshotHash:'fixture-hash',issuedById:args.p_user_id,issuedAt:new Date().toISOString()});return{data:{offerId:'offer-1'},error:null};}};
 return{db,tables};
}
const edgeSource=await readFile(new URL('../supabase/functions/trade-api/index.ts',import.meta.url),'utf8');
const preparedSource=edgeSource.replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";','').replace('import { createClient } from "npm:@supabase/supabase-js@2";','const createClient = () => globalThis.__offerFixtureDb;').replace('import { normalizeOffer, sameJson } from "./offer-input.ts";','const {normalizeOffer,sameJson}=globalThis.__offerFixtureHelpers;').replace('Deno.serve(async(req)=>{','export const handler=async(req)=>{').replace(/\}\);\s*$/,'};');
globalThis.__offerFixtureHelpers=helpers;const oldDeno=globalThis.Deno;globalThis.Deno={env:{get:n=>n==='SUPABASE_SECRET_KEYS'?'{}':'fixture-server-config'}};
const {handler}=await load(preparedSource);
async function call(db,action,payload={}){globalThis.__offerFixtureDb=db;const request=new Request('https://fixture.invalid/trade-api',{method:'POST',headers:{Authorization:'Bearer TEST-FIXTURE',Origin:'https://septlion.com'},body:JSON.stringify({...payload,action})});const r=await handler(request);return{status:r.status,body:await r.json()}}
test('buyer cannot issue an offer by forging operator fields',async()=>{const{db}=fixture({operator:false});const r=await call(db,'offers.issue',{...input(),isOperator:true});assert.equal(r.status,403);assert.equal(db.writes,0)});
test('invalid Auth is rejected before business writes',async()=>{const{db}=fixture({valid:false});assert.equal((await call(db,'offers.issue',input())).status,401);assert.equal(db.writes,0)});
test('operator cannot issue against an RFQ outside Septlion',async()=>{const{db}=fixture({supplier:'foreign-supplier'});assert.equal((await call(db,'offers.issue',input())).status,404);assert.equal(db.writes,0)});
test('real handler issues once, replays the same request and rejects changed retry',async()=>{
 const{db}=fixture();const x=input();x.validUntil=new Date(Date.now()+7*86400000).toISOString();assert.equal((await call(db,'offers.issue',x)).status,201);const replay=await call(db,'offers.issue',x);assert.equal(replay.status,200);assert.equal(replay.body.idempotent,true);assert.equal(db.writes,1);
 x.snapshot.items[0].unitPrice=2;assert.equal((await call(db,'offers.issue',x)).status,409);assert.equal(db.writes,1);
});
test('document read is allowed to its buyer/operator and denied to another buyer',async()=>{
 const{db,tables}=fixture();const x=input();x.validUntil=new Date(Date.now()+7*86400000).toISOString();await call(db,'offers.issue',x);assert.equal((await call(db,'offers.document',{id:'offer-1'})).status,200);
 tables.Membership=[{id:'other',userId:'user-1',organizationId:'other-buyer',role:'BUYER'}];assert.equal((await call(db,'offers.document',{id:'offer-1'})).status,404);
 tables.Membership=[{id:'own',userId:'user-1',organizationId:'buyer-1',role:'BUYER'}];const r=await call(db,'offers.document',{id:'offer-1'});assert.equal(r.status,200);assert.equal(r.body.revision.snapshot.testOnly,true);assert.equal(r.body.buyer.name,'TEST Buyer');
});
test('restore test globals',()=>{globalThis.Deno=oldDeno;delete globalThis.__offerFixtureDb;delete globalThis.__offerFixtureHelpers});
