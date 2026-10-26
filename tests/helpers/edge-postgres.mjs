// Local test transport for the REAL Edge handler and PostgreSQL functions.
// Only the external Auth provider is a fixture; trade data is never mocked.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../../',import.meta.url));
const file=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const q=name=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw new Error('Invalid test identifier');return '"'+name+'"'};
function splitFields(value){let level=0,start=0,out=[];for(let i=0;i<value.length;i++){if(value[i]==='(')level++;if(value[i]===')')level--;if(value[i]===','&&level===0){out.push(value.slice(start,i));start=i+1}}return[...out,value.slice(start)].map(x=>x.trim()).filter(Boolean)}
const relations={Product:{SKU:['SKU','productId','id',true],Sector:['Sector','id','sectorId',false]},SKU:{Media:['Media','skuId','id',true]}};
let aliases=0;
function projection(table,alias,fields){
 if(fields==='*')return`to_jsonb(${alias})`;
 return'jsonb_build_object('+splitFields(fields).flatMap(field=>{
  const nested=field.match(/^(\w+):(\w+)\((.*)\)$/);if(!nested)return[`'${field}'`,`${alias}.${q(field)}`];
  const[,key,relation,children]=nested,definition=relations[table]?.[relation];if(!definition)throw new Error('Unknown test relation '+relation);
  const[target,fk,pk,many]=definition,child='r'+(++aliases),expr=projection(target,child,children);
  return[`'${key}'`,many?`coalesce((select jsonb_agg(${expr}) from core.${q(target)} ${child} where ${child}.${q(fk)}=${alias}.${q(pk)}),'[]'::jsonb)`:`(select ${expr} from core.${q(target)} ${child} where ${child}.${q(fk)}=${alias}.${q(pk)})`];
 }).join(',')+')';
}
class Query{
 constructor(db,table){this.db=db;this.table=table;this.fields='*';this.filters=[];this.orders=[];this.maximum=1000}
 select(fields='*'){this.fields=fields;return this}eq(k,v){this.filters.push({k,values:[v],op:'eq'});return this}in(k,v){this.filters.push({k,values:v,op:'in'});return this}order(k,{ascending=true}={}){this.orders.push([k,ascending]);return this}limit(n){this.maximum=Math.min(1000,n);return this}
 async run(){
  try{const values=[],where=this.filters.map(({k,values:items,op})=>{if(!items.length)return'false';const refs=items.map(v=>{values.push(v);return'$'+values.length});return`t.${q(k)} ${op==='in'?'in ('+refs.join(',')+')':'='+refs[0]}`});
   const sql=`select ${projection(this.table,'t',this.fields)} as row from core.${q(this.table)} t${where.length?' where '+where.join(' and '):''}${this.orders.length?' order by '+this.orders.map(([k,a])=>'t.'+q(k)+(a?' asc':' desc')).join(','):''} limit ${Math.max(0,this.maximum)}`;
   const result=await this.db.query(sql,values);return{data:result.rows.map(r=>r.row),error:null};
  }catch(e){return{data:null,error:{message:e.message,code:e.code}}}
 }
 then(resolve,reject){return this.run().then(resolve,reject)}
 async maybeSingle(){const r=await this.run();return{data:r.data?.[0]||null,error:r.error}}
 async single(){return this.maybeSingle()}
}
export async function createEdgePostgres(authGetUser){
 const pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec('create schema core; create schema extensions; create extension pgcrypto with schema extensions; set search_path=core; create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema core to service_role;');
 const generated=spawnSync(process.execPath,[root+'apps/api/node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel',root+'apps/api/prisma/schema.prisma','--script'],{encoding:'utf8',cwd:root});
 if(generated.status!==0)throw new Error(generated.stderr);
 await pg.exec(generated.stdout.replaceAll('"public"','"core"'));
 await pg.exec('create table core."EdgeRateLimit"("userId" text,action text,"windowStart" timestamp,count int,primary key("userId",action,"windowStart"));');
 await pg.exec(await file('tests/fixtures/existing-trade-runtime.sql'));
 await pg.exec(await file('tests/fixtures/existing-execution-runtime.sql'));
 // Load metrics after lifecycle adds its testOnly column.
 let lifecycle=await file('supabase/migrations/20261006182017_complete_trade_lifecycle_and_private_documents.sql');
 lifecycle=lifecycle.replace(/create or replace function core.platform_health_snapshot_v2\(\)[\s\S]*?\$\$;/,'');
 await pg.exec(await file('supabase/migrations/20261006162903_grant_trade_api_runtime_table_access.sql'));
 await pg.exec(lifecycle);await pg.exec(await file('tests/fixtures/existing-edge-runtime.sql'));
 await pg.exec(await file('supabase/migrations/20261010225937_finalize_customer_requests_and_delivery_batches.sql'));
 await pg.exec(await file('supabase/migrations/20261025215236_command_center_catalog.sql'));
 await pg.exec(await file('supabase/migrations/20261026000151_atomic_phone_identity.sql'));
 await pg.exec(await file('supabase/migrations/20261026001643_catalog_product_media.sql'));
 await pg.exec(await file('supabase/migrations/20261026172856_preserve_catalog_and_rfq_history.sql'));
 await pg.exec(`insert into core."Organization"(id,name,"organizationType",status,"updatedAt") values('septlion-operator','TEST Septlion','BOTH','ACTIVE',now());insert into core."User"(id,email,"passwordHash","updatedAt") values('actor-admin','admin@fixture.invalid','TEST',now());insert into core."Membership"(id,"userId","organizationId",role) values('member-admin','actor-admin','septlion-operator','ADMIN');insert into core."Sector"(id,code,name,"updatedAt") values('food','FOOD','الأغذية',now()),('sector-general-trade','GENERAL','General trade',now());`);
 await pg.exec('set role service_role');
 const client={schema:()=>client,auth:{getUser:async token=>({data:{user:authGetUser(token)},error:null})},from:table=>new Query(pg,table),rpc:async(name,args={})=>{
  try{const names=Object.keys(args),values=Object.values(args).map(v=>v&&typeof v==='object'?JSON.stringify(v):v);const sql=`select core.${q(name)}(${names.map((n,i)=>q(n)+' => $'+(i+1)).join(',')}) as result`;return{data:(await pg.query(sql,values)).rows[0].result,error:null}}catch(e){return{data:null,error:{message:e.message,code:e.code}}}
 }};
 const moduleCache=new Map();
 async function moduleUrl(name){
  if(moduleCache.has(name))return moduleCache.get(name);
  let code=await file('supabase/functions/trade-api/'+name);
  for(const match of [...code.matchAll(/from ["']\.\/([^"']+)["']/g)])code=code.replace(match[0],'from '+JSON.stringify(await moduleUrl(match[1])));
  code=code.replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";','').replace('import { createClient } from "npm:@supabase/supabase-js@2";','const createClient=()=>globalThis.__edgePostgres;').replace('Deno.serve(async(req)=>{','export const handler=async(req)=>{').replace(name==='index.ts'?/\}\);\s*$/:/(?!)/,name==='index.ts'?'};':'');
  const url='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:99,target:9}}).outputText).toString('base64');moduleCache.set(name,url);return url;
 }
 globalThis.__edgePostgres=client;globalThis.Deno={env:{get:n=>n==='SUPABASE_SECRET_KEYS'?'{}':n==='SEPTLION_ALLOWED_ORIGINS'?'https://staging.fixture.invalid':'fixture-server-config'}};
 const{handler}=await import(await moduleUrl('index.ts'));
 return{handler,pg,close:()=>pg.close()};
}
