import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const supplyUrl=url(await readFile(new URL('../apps/web/lib/supply-plan.ts',import.meta.url),'utf8'));
const {normalizeSupplyPlan}=await import(supplyUrl);
const {normalizeRequirement}=await import(url((await readFile(new URL('../supabase/functions/trade-api/requirement-input.ts',import.meta.url),'utf8')).replace("'./supply-plan.ts'",JSON.stringify(supplyUrl))));
const {normalizeOffer}=await import(url((await readFile(new URL('../supabase/functions/trade-api/offer-input.ts',import.meta.url),'utf8')).replace("'./supply-plan.ts'",JSON.stringify(supplyUrl))));
const plan=()=>({version:1,batches:[{sequence:1,quantity:2,unit:'FCL',plannedDate:'2026-11-01',notes:''},{sequence:2,quantity:3,unit:'FCL',plannedDate:'2026-12-01',notes:'Second delivery'}],terms:'Same specification',automaticPurchaseOrders:false});
const input=()=>({idempotencyKey:'fixture-request-001',product:'TEST — bakery flour',quantity:'5 FCL',unit:'FCL',destination:'Dar es Salaam',incoterm:'CFR',paymentPreference:'L/C',packing:'50kg',knownFacts:{supplyPlan:plan()}});
test('scheduled delivery quantities, dates and terms survive the normalized request without creating extra orders',()=>{
 const r=normalizeRequirement(input());assert.equal(r.key,'fixture-request-001');assert.equal(r.payload.quantityNumber,5);assert.equal(r.payload.knownFacts.supplyPlan.automaticPurchaseOrders,false);assert.deepEqual(r.payload.knownFacts.supplyPlan.batches,plan().batches);
});
test('rejects inconsistent totals, mixed units, fractional containers, impossible dates and automatic purchase orders',()=>{
 for(const change of [p=>p.batches[0].quantity=2.5,p=>p.batches[1].unit='MT',p=>p.batches[0].plannedDate='2026-02-30',p=>p.batches[1].plannedDate='2026-01-01',p=>p.automaticPurchaseOrders=true,p=>p.batches.pop()]){const p=plan();change(p);assert.throws(()=>normalizeSupplyPlan(p,{amount:5,unit:'FCL'}));}
});
test('server rejects manipulated container count and inconsistent or negative quantities before a write',()=>{
 for(const changes of [{quantity:'-5 FCL'},{quantity:'5.5 FCL'},{quantity:'5 MT',unit:'FCL'},{quantity:'Infinity FCL'},{quantity:'0 FCL'}])assert.throws(()=>normalizeRequirement({...input(),...changes}));
 assert.equal(normalizeRequirement({...input(),containerCount:999}).payload.containerCount,5);
 assert.throws(()=>normalizeRequirement({...input(),idempotencyKey:'bad'}));
});
test('an offer preserves the requested delivery schedule and rejects a different commercial quantity',()=>{
 const r=normalizeRequirement(input()).payload;
 const offer={idempotencyKey:'fixture-offer-001',currency:'USD',validUntil:'2026-10-20',snapshot:{items:[{description:'TEST',quantity:5,unit:'FCL',unitPrice:1}],terms:{incoterm:'CFR',payment:'LC'}}};
 const result=normalizeOffer(offer,{id:'req-1',...r,quantity:5},Date.parse('2026-10-11'));
 assert.deepEqual(result.snapshot.terms.supplyPlan,plan());
 offer.snapshot.items[0].quantity=6;assert.throws(()=>normalizeOffer(offer,{id:'req-1',...r,quantity:5},Date.parse('2026-10-11')));
});
