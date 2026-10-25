import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const file=n=>readFile(new URL('../supabase/functions/trade-api/'+n,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const lifecycle=url((await file('lifecycle-api.ts')).replace("'./lifecycle-input.ts'",JSON.stringify(url(await file('lifecycle-input.ts')))).replace("'./document-input.ts'",JSON.stringify(url(await file('document-input.ts')))));
const source=(await file('index.ts')).replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";','').replace('import { createClient } from "npm:@supabase/supabase-js@2";','const createClient=()=>globalThis.__commandDb;').replace('"./offer-input.ts"',JSON.stringify(url(await file('offer-input.ts')))).replace('"./catalog-api.ts"',JSON.stringify(url(await file('catalog-api.ts')))).replace('"./lifecycle-api.ts"',JSON.stringify(lifecycle)).replace('Deno.serve(async(req)=>{','export const handler=async(req)=>{').replace(/\}\);\s*$/,'};');
globalThis.Deno={env:{get:n=>n==='SUPABASE_SECRET_KEYS'?'{}':'fixture'}};
const {handler}=await import(url(source));
class Query{
 constructor(rows,log){this.rows=rows;this.filters=[];this.log=log;this.max=Infinity}
 select(fields){this.log.fields=fields;return this}eq(k,v){this.log.filters.push([k,v]);this.filters.push(r=>r[k]===v);return this}in(k,v){this.filters.push(r=>v.includes(r[k]));return this}order(){return this}limit(n){this.max=n;return this}
 result(){return this.rows.filter(r=>this.filters.every(f=>f(r))).slice(0,this.max)}
 then(resolve,reject){return Promise.resolve({data:this.result(),error:null}).then(resolve,reject)}
 async maybeSingle(){return{data:this.result()[0]||null,error:null}}
}
function fixture(role='ADMIN',{active=true,valid=true,operatorActive=true}={}){
 const calls=[],reads=[];const tables={User:[{id:'actor',isActive:active}],Membership:[{userId:'actor',organizationId:'buyer-org',role:'BUYER'},...(role?[{userId:'actor',organizationId:'septlion-operator',role}]:[])],Organization:[{id:'buyer-org',status:'ACTIVE'},{id:'septlion-operator',status:operatorActive?'ACTIVE':'SUSPENDED'}],Product:[{id:'public',organizationId:'septlion-operator',status:'ACTIVE',visibility:'PUBLIC'},{id:'draft',organizationId:'septlion-operator',status:'DRAFT',visibility:'PRIVATE'},{id:'foreign',organizationId:'foreign',status:'ACTIVE',visibility:'PUBLIC'}],Sector:[]};
 const db={schema:()=>db,auth:{getUser:async()=>({data:{user:valid?{id:'actor'}:null},error:null})},from:name=>{const log={table:name,filters:[]};reads.push(log);return new Query(tables[name]||[],log)},rpc:async(name,args)=>{if(name==='check_edge_rate_limit')return{data:true,error:null};calls.push({name,args});return{data:{id:'saved'},error:null}}};return{db,calls,reads};
}
async function call(f,action,payload={},auth=true){globalThis.__commandDb=f.db;const r=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{...(auth?{Authorization:'Bearer fixture'}:{}),Origin:'https://septlion.com'},body:JSON.stringify({action,...payload})}));return{status:r.status,body:await r.json()}}
test('catalog mutations reject missing auth, inactive users, buyers and SALES before RPC',async()=>{
 for(const [role,options,status]of [[null,{},403],['SALES',{},403],['ADMIN',{active:false},403],['ADMIN',{valid:false},401],['ADMIN',{operatorActive:false},403]]){
  const f=fixture(role,options);assert.equal((await call(f,'catalog.save',{input:{organizationId:'forged'},key:'fixture-valid-key'})).status,status);assert.equal(f.calls.length,0);
 }
 const f=fixture();assert.equal((await call(f,'catalog.save',{},false)).status,401);assert.equal(f.calls.length,0);
});
test('ADMIN mutation passes verified actor to guarded RPC and ignores forged actor fields',async()=>{
 const f=fixture();const result=await call(f,'catalog.save',{input:{name:'TEST'},key:'fixture-valid-key',userId:'forged',role:'ADMIN'});assert.equal(result.status,200);assert.equal(f.calls[0].name,'mutate_operator_catalog');assert.equal(f.calls[0].args.p_user_id,'actor');
});
test('publication requires explicit confirmation; invalid input and unknown actions do not write',async()=>{
 for(const [action,payload]of [['catalog.publish',{input:{id:'p'},key:'fixture-valid-key'}],['catalog.save',{input:[],key:'fixture-valid-key'}],['catalog.save',{input:{},key:'short'}],['catalog.delete',{input:{},key:'fixture-valid-key'}]]){const f=fixture();assert.equal((await call(f,action,payload)).status,400);assert.equal(f.calls.length,0)}
});
test('public catalog requires no session and filters owner, ACTIVE and PUBLIC',async()=>{
 const f=fixture();const r=await call(f,'catalog.public',{},false);assert.equal(r.status,200);assert.deepEqual(r.body.items.map(x=>x.id),['public']);assert.equal(f.calls.length,0);const read=f.reads.find(x=>x.table==='Product');assert.ok(!read.fields.includes('*'));assert.ok(!read.fields.includes('skuCode'));assert.equal(f.reads.length,1);
});
test('SALES can read the operator catalog and me reports a server-derived role',async()=>{
 const f=fixture('SALES');assert.equal((await call(f,'catalog.list')).status,200);const r=await call(f,'me');assert.equal(r.body.operatorRole,'SALES');assert.equal(f.calls.length,0);
});
