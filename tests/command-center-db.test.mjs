import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
let db;
const file=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const scalar=async(sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0];
const mutate=(user,action,input,key=crypto.randomUUID())=>scalar('select core.mutate_operator_catalog($1,$2,$3::jsonb,$4)',[user,action,JSON.stringify(input),key]);
const getProduct=id=>scalar('select to_jsonb(p) from core."Product" p where id=$1',[id]);
const version=async id=>(await getProduct(id)).updatedAt;
let sector,product,request,offer,transaction;
const productInput=()=>({name:'TEST — Zollana flour',slug:'test-zollana-flour',sectorId:sector,description:'TEST — noncommercial flour specification',skus:[{skuCode:'TEST-FLOUR-50',name:'50 kg',packing:'50 kg woven bag',unit:'MT',minimumOrderQty:1,currency:'USD'},{skuCode:'TEST-FLOUR-25',name:'25 kg',packing:'25 kg woven bag',unit:'MT',minimumOrderQty:1,currency:'USD'}]});
before(async()=>{
 db=new PGlite({extensions:{pgcrypto}});
 await db.exec('create schema core; create schema extensions; create extension pgcrypto with schema extensions; set search_path=core; create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema core to service_role;');
 const baseline=spawnSync(process.execPath,['apps/api/node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','apps/api/prisma/schema.prisma','--script'],{encoding:'utf8'});
 assert.equal(baseline.status,0,baseline.stderr);
 await db.exec(baseline.stdout.replaceAll('"public"','"core"'));
 await db.exec(await file('supabase/migrations/20261006162903_grant_trade_api_runtime_table_access.sql'));
 await db.exec(await file('tests/fixtures/existing-trade-runtime.sql'));
 await db.exec(await file('tests/fixtures/existing-execution-runtime.sql'));
 let lifecycle=await file('supabase/migrations/20261006182017_complete_trade_lifecycle_and_private_documents.sql');
 // Snapshot statistics call another production-only dashboard function; no
 // lifecycle, authorization, document or mutation function is replaced.
 lifecycle=lifecycle.replace(/create or replace function core.platform_health_snapshot_v2\(\)[\s\S]*?\$\$;/,'');
 await db.exec(lifecycle);
 await db.exec(await file('supabase/migrations/20261025215236_command_center_catalog.sql'));
 await db.exec(await file('supabase/migrations/20261026000151_atomic_phone_identity.sql'));
 await db.exec(await file('supabase/migrations/20261026001643_catalog_product_media.sql'));
 await db.exec(`insert into core."Organization"(id,name,"organizationType",status,"updatedAt") values ('septlion-operator','TEST Septlion','BOTH','ACTIVE',now()),('buyer-org','TEST buyer','BUYER','ACTIVE',now()),('foreign-org','TEST foreign','BUYER','ACTIVE',now());
 insert into core."User"(id,email,"passwordHash","updatedAt") values ('admin','admin@fixture.invalid','TEST',now()),('sales','sales@fixture.invalid','TEST',now()),('buyer','buyer@fixture.invalid','TEST',now()),('foreign','foreign@fixture.invalid','TEST',now());
 insert into core."Membership"(id,"userId","organizationId",role) values ('ma','admin','septlion-operator','ADMIN'),('ms','sales','septlion-operator','SALES'),('mb','buyer','buyer-org','BUYER'),('mf','foreign','foreign-org','BUYER');
 insert into core."Sector"(id,code,name,"updatedAt") values ('sector-general-trade','GENERAL','TEST General',now());`);
}, {timeout:60000});
after(async()=>{await db?.close()});
test('database denies buyer, SALES, nonexistent and revoked administrators',async()=>{
 for(const user of ['buyer','sales','missing'])await assert.rejects(mutate(user,'sectors.save',{code:'BAD',name:'Forbidden'}),/access_denied/);
 await db.exec(`update core."User" set "isActive"=false where id='admin'`);
 await assert.rejects(mutate('admin','sectors.save',{code:'BAD',name:'Forbidden'}),/access_denied/);
 await db.exec(`update core."User" set "isActive"=true where id='admin'`);
 assert.equal(await scalar('select count(*)::int from core."AuditLog"'),0);
});
test('sector and product writes are atomic, private, audited and idempotent',async()=>{
 sector=(await mutate('admin','sectors.save',{code:'TEST-FOOD',name:'TEST food'})).id;
 const input=productInput(),key=crypto.randomUUID();product=(await mutate('admin','catalog.save',input,key)).id;
 assert.equal((await mutate('admin','catalog.save',input,key)).id,product);
 await assert.rejects(mutate('admin','catalog.save',{...input,name:'Changed'},key),/idempotency_conflict/);
 const saved=await getProduct(product);assert.equal(saved.status,'DRAFT');assert.equal(saved.visibility,'PRIVATE');
 assert.equal(await scalar('select count(*)::int from core."SKU" where "productId"=$1',[product]),2);
 const invalid={...input,slug:'invalid',skus:[{...input.skus[0],skuCode:'OTHER-SKU'},{...input.skus[1],minimumOrderQty:-1}]};
 await assert.rejects(mutate('admin','catalog.save',invalid),/invalid_sku_input/);
 assert.equal(await scalar(`select count(*)::int from core."Product" where slug='invalid'`),0);
 await assert.rejects(mutate('admin','catalog.save',{...input,slug:'duplicate'}),/duplicate_sku/);
 assert.equal(await scalar('select count(*)::int from core."AuditLog"'),2);
});
test('publication requires separate verified confirmation and current version',async()=>{
 const input={id:product,expectedUpdatedAt:await version(product)};
 await assert.rejects(mutate('admin','catalog.publish',input),/publication_confirmation_required/);
 await assert.rejects(mutate('admin','catalog.publish',{...input,confirm:true,identityVerified:false}),/publication_confirmation_required/);
 await assert.rejects(mutate('admin','catalog.publish',{...input,expectedUpdatedAt:'2000-01-01',confirm:true,identityVerified:true}),/version_conflict/);
 await mutate('admin','catalog.publish',{...input,confirm:true,identityVerified:true});
 assert.equal((await getProduct(product)).status,'ACTIVE');
 await assert.rejects(mutate('admin','catalog.save',{...productInput(),id:product,expectedUpdatedAt:await version(product)}),/catalog_conflict/);
});
test('catalog buyer request preserves two pack variants and retries create one RFQ',async()=>{
 const skus=(await db.query('select id from core."SKU" where "productId"=$1 order by "skuCode"',[product])).rows;
 const input={product:'TEST — Zollana flour',market:'TEST destination',quantityNumber:3,unit:'FCL',containerCount:3,incoterm:'CIF',paymentPreference:'L/C',catalogProductId:product,variants:[{skuId:skus[0].id,containers:1},{skuId:skus[1].id,containers:2}],source:'PRODUCT_FEED'};
 const key=crypto.randomUUID();const create=(i=input,u='buyer',o='buyer-org',k=key)=>scalar('select core.create_buyer_requirement_v2($1,$2,$3::jsonb,$4)',[o,u,JSON.stringify(i),k]);
 await assert.rejects(create(input,'foreign'),/access_denied/);
 await assert.rejects(create({...input,variants:[{skuId:'foreign-sku',containers:1}]}),/variant_not_found/);
 request=await create();const replay=await create();assert.equal(replay.requirementId,request.requirementId);assert.equal(replay.idempotent,true);
 await assert.rejects(create({...input,market:'Changed'}),/idempotency_conflict/);
 const items=(await db.query('select "skuId",quantity,unit from core."RFQItem" where "rfqId"=$1',[request.rfqId])).rows;
 assert.equal(items.length,2);assert.equal(items.reduce((a,x)=>a+Number(x.quantity),0),3);assert.ok(items.every(x=>x.unit==='FCL'));
 assert.equal(await scalar('select "sectorId" from core."RFQ" where id=$1',[request.rfqId]),sector);
 assert.equal(await scalar('select count(*)::int from core."QualifiedRequirement"'),1);
});
test('the persisted RFQ issues an offer, buyer accepts once, transaction links to requirement',async()=>{
 offer=await scalar(`select core.issue_septlion_offer($1,'sales',$2::jsonb,'USD',(now()+interval '7 days')::timestamp)`,[request.rfqId,JSON.stringify({testOnly:true,items:[{description:'TEST',quantity:3,unit:'FCL',unitPrice:1}],terms:{incoterm:'CIF',payment:'LC'}})]);
 await assert.rejects(scalar(`select core.accept_trade_offer_v2($1,'foreign-org','foreign',1,'TEST')`,[offer.offerId]),/offer_not_found/);
 transaction=await scalar(`select core.accept_trade_offer_v2($1,'buyer-org','buyer',1,'TEST')`,[offer.offerId]);
 const replay=await scalar(`select core.accept_trade_offer_v2($1,'buyer-org','buyer',1,'TEST')`,[offer.offerId]);assert.equal(replay.transactionId,transaction.transactionId);assert.equal(replay.idempotent,true);
 assert.equal(await scalar('select count(*)::int from core."TradeTransaction"'),1);
 assert.equal(await scalar('select "requirementId" from core."SeptlionOffer" where id=$1',[offer.offerId]),request.requirementId);
});
test('archiving preserves historical RFQ/SKU references; stale updates are rejected',async()=>{
 const oldVersion=await version(product);await mutate('admin','catalog.archive',{id:product,expectedUpdatedAt:oldVersion,confirm:true});
 assert.equal((await getProduct(product)).status,'ARCHIVED');
 assert.equal(await scalar('select count(*)::int from core."RFQItem" where "rfqId"=$1',[request.rfqId]),2);
 await assert.rejects(mutate('admin','catalog.archive',{id:product,expectedUpdatedAt:oldVersion,confirm:true}),/version_conflict/);
});
test('anonymous and authenticated database roles cannot execute server-only mutation RPCs',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{await assert.rejects(mutate('admin','sectors.save',{code:'FORGED',name:'Forged'}),/permission denied/)}finally{await db.exec('reset role')}
 }
});
test('full existing lifecycle SQL verifies execution, documents, receipt, claims and reorder with rollback',async()=>{
 await db.exec(await file('supabase/tests/trade_lifecycle_workspace.sql'));
});

test('least-privileged service_role can run the catalog transaction using migration grants',async()=>{
 await db.exec('set role service_role');
 try{const result=await mutate('admin','sectors.save',{code:'RUNTIME',name:'TEST runtime grants'});assert.ok(result.id)}finally{await db.exec('reset role')}
});

test('first-contact identity creates one BUYER organization under concurrent retries and never grants operator rights',async()=>{
 await db.exec('set role service_role');
 try{const result=await Promise.all(Array.from({length:4},()=>scalar('select core.provision_trade_identity($1,$2)',['phone-new-user',null])));assert.equal(new Set(result.map(r=>r.membership.organizationId)).size,1);assert.ok(result.every(r=>r.membership.role==='BUYER'));}finally{await db.exec('reset role')}
 assert.equal(await scalar('select count(*)::int from core."Membership" where "userId"=$1',['phone-new-user']),1);
 assert.equal(await scalar('select count(*)::int from core."AuditLog" where "entityType"=$1 and "entityId"=$2',['BuyerIdentity','phone-new-user']),1);
 await db.exec(`update core."User" set "isActive"=false where id='phone-new-user'`);await assert.rejects(scalar('select core.provision_trade_identity($1,$2)',['phone-new-user',null]),/access_denied/);
});

test('draft packing image URLs are saved with audit, reject unsafe schemes and do not mutate archived history',async()=>{
 const input={...productInput(),slug:'image-product',skus:[{...productInput().skus[0],skuCode:'IMAGE-SKU',imageUrl:'https://assets.fixture.invalid/pack.jpg'}]};
 const id=(await mutate('admin','catalog.save',input)).id;assert.equal(await scalar('select count(*)::int from core."Media" m join core."SKU" s on s.id=m."skuId" where s."productId"=$1',[id]),1);
 await assert.rejects(mutate('admin','catalog.save',{...input,id,expectedUpdatedAt:await version(id),skus:[{...input.skus[0],imageUrl:'javascript:alert(1)'}]}),/invalid_image_url/);
 assert.equal(await scalar('select url from core."Media" m join core."SKU" s on s.id=m."skuId" where s."productId"=$1',[id]),'https://assets.fixture.invalid/pack.jpg');
});
