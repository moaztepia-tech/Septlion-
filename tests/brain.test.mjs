import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demandDatabase} from './helpers/demand-db.mjs';

const one=async(pg,sql,args=[])=>(await pg.query(sql,args)).rows[0];
const num=async(pg,sql,args=[])=>(await one(pg,sql,args)).n;

test('brain queues the right agent, asks the founder only where a human must decide, and never duplicates work',async()=>{
 const pg=await demandDatabase();
 try {
  const {id}=await one(pg,`INSERT INTO "DemandSignal"(source,"sourceRecordId","sourceUrl",type,market,product,"productKey",quantity,packing,incoterm,"buyerName","publishedAt",stage)
   VALUES('fixture','live','https://buyer.example/rfq','RFQ','Benin','Wheat flour','wheat_flour','25 MT','50 kg','CFR','Fixture Buyer',now()-interval '1 day','BUYER_RESOLUTION') RETURNING id`);
  await pg.query(`INSERT INTO "DemandSignal"(source,"sourceRecordId",type,market,product,"productKey","publishedAt")
   VALUES('fixture','other','RFQ','Germany','Flour','wheat_flour',now())`);
  const testRow=await one(pg,`INSERT INTO "DemandSignal"(source,"sourceRecordId",type,market,product,"productKey","publishedAt",raw)
   VALUES('fixture','test','RFQ','Sudan','Flour','wheat_flour',now(),'{"isTest":true}') RETURNING id`);
  const supplier=await one(pg,`INSERT INTO "DemandSupplierProfile"(name,"productKeys","verificationStatus") VALUES('Fixture Mill',ARRAY['wheat_flour'],'SEPTLION_VERIFIED') RETURNING id`);
  await pg.query('SELECT run_demand_operations(200)');
  let r=(await one(pg,'SELECT run_brain(200) AS r')).r;
  assert.deepEqual(r.errors,[]);
  assert.equal(r.queued,1);
  const task=await one(pg,`SELECT * FROM "BrainTask" WHERE "subjectId"=$1`,[id]);
  assert.equal(task.agentType,'BUYER_RESOLVER');
  assert.equal(task.status,'QUEUED');
  // Foreign-market and test signals get no work and stay out of the graph.
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainTask"`),1);
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainEdge" WHERE "fromId"=$1`,[testRow.id]),0);
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainEdge" WHERE "fromId"=$1`,[id]),2);
  assert.equal((await one(pg,`SELECT "toId" FROM "BrainEdge" WHERE "fromId"=$1 AND relation='IN_MARKET'`,[id])).toId,'benin');
  // Idempotent: a second run adds nothing.
  r=(await one(pg,'SELECT run_brain(200) AS r')).r;
  assert.equal(r.queued,0);
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainTask"`),1);
  // Buyer verified + qualified: buyer work is retired, the founder is asked for a sourced cost.
  await pg.query(`UPDATE "DemandBuyerResolution" SET "legalEntity"='Fixture Buyer Ltd',website='https://buyer.example',"businessEmail"='sales@buyer.example',"verificationStatus"='VERIFIED' WHERE "signalId"=$1`,[id]);
  await pg.query('SELECT run_demand_operations(200)');
  await pg.query(`UPDATE "DemandQualification" SET "directEligibility"=true,"localPartnerRequired"=false,"riskFlags"='[]' WHERE "signalId"=$1`,[id]);
  await pg.query(`UPDATE "DemandSupplierFit" SET status='SELECTED' WHERE "signalId"=$1`,[id]);
  await pg.query('SELECT run_demand_operations(200)');
  assert.equal((await one(pg,`SELECT "nextAction" FROM "DemandAssessment" WHERE "signalId"=$1`,[id])).nextAction,'CONFIRM_SUPPLIER_AND_COST');
  r=(await one(pg,'SELECT run_brain(200) AS r')).r;
  assert.equal(r.asked,1);
  assert.equal((await one(pg,`SELECT status FROM "BrainTask" WHERE id=$1`,[task.id])).status,'SUPERSEDED');
  let decision=await one(pg,`SELECT * FROM "BrainDecision" WHERE "subjectId"=$1 AND status='PENDING'`,[id]);
  assert.equal(decision.kind,'PROVIDE_COST');
  assert.match(decision.titleAr,/تكلفة موثقة/);
  // A sourced cost turns the question into an offer approval; the old question is withdrawn.
  await pg.query(`INSERT INTO "DemandCostInput"("signalId","supplierId",currency,"productPerMt","freightPerMt","marginPct","validUntil",evidence) VALUES($1,$2,'USD',400,50,10,now()+interval '1 day','{"sourceUrl":"https://mill.example/quote/1"}')`,[id,supplier.id]);
  await pg.query('SELECT run_demand_operations(200)');
  await pg.query('SELECT run_brain(200)');
  assert.equal((await one(pg,`SELECT status FROM "BrainDecision" WHERE id=$1`,[decision.id])).status,'WITHDRAWN');
  decision=await one(pg,`SELECT * FROM "BrainDecision" WHERE "subjectId"=$1 AND status='PENDING'`,[id]);
  assert.equal(decision.kind,'APPROVE_OFFER');
  assert.equal(decision.detail.commercial.offerPerMt,500);
  await pg.query('SELECT run_brain(200)');
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainDecision" WHERE status='PENDING'`),1);
  // The founder's approval is recorded, but never approves the offer by itself.
  await pg.query(`SELECT brain_decide($1,'APPROVE','founder',null)`,[decision.id]);
  assert.equal((await one(pg,`SELECT status FROM "DemandOfferBuild" WHERE "signalId"=$1`,[id])).status,'DRAFT');
  await assert.rejects(pg.query(`SELECT brain_decide($1,'APPROVE','founder',null)`,[decision.id]),/not pending/);
  assert.ok(await num(pg,`SELECT count(*)::int n FROM "BrainEvent" WHERE "eventType"='DECISION_MADE'`)===1);
  // No agent is switched on by default.
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainPolicy" WHERE enabled`),0);
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainPolicy"`),10);
 } finally {await pg.close();}
});

test('memory keeps history, protects confirmed facts, and the event log is append-only',async()=>{
 const pg=await demandDatabase();
 try {
  const assert_=(status,actor,url,value)=>pg.query(`SELECT brain_assert_fact('DEAL','benin-ejibe','price_per_mt',$1::jsonb,$2,80,$3,$4) AS id`,[JSON.stringify(value),status,url,actor]);
  // Trade Truth: CONFIRMED needs a source or the founder.
  await assert.rejects(assert_('CONFIRMED','BUYER_RESOLVER',null,{usd:470}),/BrainFact_confirmed_needs_source/);
  const first=(await assert_('CONFIRMED','FOUNDER',null,{usd:470,incoterm:'CFR Cotonou'})).rows[0].id;
  await assert.rejects(assert_('INFERRED','PREDICTOR',null,{usd:455}),/only be changed by the founder/);
  const same=(await assert_('CONFIRMED','FOUNDER',null,{usd:470,incoterm:'CFR Cotonou'})).rows[0].id;
  assert.equal(same,first);
  const second=(await assert_('CONFIRMED','FOUNDER',null,{usd:465,incoterm:'CFR Cotonou'})).rows[0].id;
  assert.notEqual(second,first);
  assert.equal((await one(pg,`SELECT "supersededBy" FROM "BrainFact" WHERE id=$1`,[first])).supersededBy,second);
  assert.equal(await num(pg,`SELECT count(*)::int n FROM "BrainFact" WHERE "supersededBy" IS NULL`),1);
  // A founder CONFIRM decision turns an inferred fact into a confirmed one.
  const inferred=(await pg.query(`SELECT brain_assert_fact('BUYER','b1','annual_volume_mt','12500'::jsonb,'INFERRED',40,null,'PREDICTOR') AS id`)).rows[0].id;
  await pg.query(`INSERT INTO "BrainDecision"(kind,"subjectType","subjectId","titleAr",detail) VALUES('CONFIRM_FACT','BUYER','b1','أكد الكمية',$1)`,[{factId:inferred}]);
  const d=await one(pg,`SELECT id FROM "BrainDecision" WHERE kind='CONFIRM_FACT'`);
  await pg.query(`SELECT brain_decide($1,'CONFIRM','founder','seen the contract')`,[d.id]);
  const current=await one(pg,`SELECT * FROM "BrainFact" WHERE "subjectId"='b1' AND "supersededBy" IS NULL`);
  assert.equal(current.status,'CONFIRMED');
  assert.equal(current.actor,'FOUNDER');
  await assert.rejects(pg.query(`UPDATE "BrainEvent" SET actor='x'`),/append-only/);
  await assert.rejects(pg.query(`DELETE FROM "BrainEvent"`),/append-only/);
  // Backend only.
  await pg.exec('SET ROLE service_role');
  assert.deepEqual((await one(pg,'SELECT run_brain(10) AS r')).r.errors,[]);
  await pg.exec('RESET ROLE');
  for(const role of ['anon','authenticated']) {
   await pg.exec('SET ROLE '+role);
   await assert.rejects(pg.query('SELECT run_brain(10)'),/permission denied/);
   await assert.rejects(pg.query('SELECT * FROM "BrainFact"'),/permission denied/);
   await assert.rejects(pg.query('SELECT * FROM "BrainBuyerTwin"'),/permission denied/);
   await pg.exec('RESET ROLE');
  }
 } finally {await pg.close();}
});
