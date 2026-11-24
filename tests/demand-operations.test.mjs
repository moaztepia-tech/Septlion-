import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demandDatabase} from './helpers/demand-db.mjs';

test('operations run safely from evidence to costed draft, isolate tests, and stay idempotent',async()=>{
 const pg=await demandDatabase();
 try {
  const [{id}]= (await pg.query(`INSERT INTO "DemandSignal"(source,"sourceRecordId","sourceUrl",type,market,product,"productKey",quantity,packing,incoterm,"buyerName","publishedAt",stage)
   VALUES('fixture','live','https://buyer.example/rfq','RFQ','Sudan','Wheat flour','wheat_flour','25 MT','50 kg','CIF','Fixture Buyer',now()-interval '1 day','BUYER_RESOLUTION') RETURNING id`)).rows;
  const [supplier]=(await pg.query(`INSERT INTO "DemandSupplierProfile"(name,"productKeys","verificationStatus") VALUES('Fixture Mill',ARRAY['wheat_flour'],'SOURCE_VERIFIED') RETURNING id`)).rows;
  let result=(await pg.query('SELECT run_demand_operations(200) AS r')).rows[0].r;
  assert.deepEqual(result.errors,[]);
  let assessment=(await pg.query('SELECT * FROM "DemandAssessment" WHERE "signalId"=$1',[id])).rows[0];
  assert.equal(assessment.nextAction,'RESEARCH_COMPANY_AND_DIRECT_CONTACT');
  assert.equal(assessment.supplierCount,1);
  assert.equal((await pg.query('SELECT count(*)::int n FROM core."Opportunity"')).rows[0].n,1);
  assert.equal((await pg.query('SELECT status FROM core."Opportunity"')).rows[0].status,'BUYER_RESOLUTION');
  assert.equal((await pg.query('SELECT status FROM core."AgentRun"')).rows[0].status,'SUCCEEDED');
  const fit=(await pg.query('SELECT * FROM "DemandSupplierFit" WHERE "signalId"=$1',[id])).rows[0];
  assert.ok(fit.gaps.includes('INCOTERM_UNCONFIRMED'));
  assert.ok(fit.gaps.includes('PACKING_UNCONFIRMED'));
  assert.ok(!fit.reasons.includes('INCOTERM_MATCH'));
  assert.ok(!fit.reasons.includes('PACKING_MATCH'));
  // Verified company + direct public contact unlocks qualification, never an offer approval.
  await pg.query(`UPDATE "DemandBuyerResolution" SET "legalEntity"='Fixture Buyer Ltd',website='https://buyer.example',"businessEmail"='sales@buyer.example',"verificationStatus"='VERIFIED',evidence='{"sourceUrl":"https://buyer.example/contact"}' WHERE "signalId"=$1`,[id]);
  await pg.query('SELECT run_demand_operations(200)');
  assert.equal((await pg.query('SELECT stage FROM "DemandSignal" WHERE id=$1',[id])).rows[0].stage,'QUALIFICATION');
  await pg.query(`UPDATE "DemandQualification" SET "directEligibility"=true,"localPartnerRequired"=false,"riskFlags"='[]' WHERE "signalId"=$1`,[id]);
  await pg.query('SELECT run_demand_operations(200)');
  assert.equal((await pg.query('SELECT status FROM "DemandOfferBuild" WHERE "signalId"=$1',[id])).rows[0].status,'DRAFT');
  await assert.rejects(pg.query(`UPDATE "DemandOfferBuild" SET status='READY',"approvedAt"=now() WHERE "signalId"=$1`,[id]),/Current sourced costs/);
  await pg.query(`UPDATE "DemandSupplierFit" SET status='SELECTED' WHERE "signalId"=$1`,[id]);
  await pg.query(`INSERT INTO "DemandCostInput"("signalId","supplierId",currency,"productPerMt","freightPerMt","marginPct","validUntil",evidence) VALUES($1,$2,'USD',400,50,10,now()+interval '1 day','{"sourceUrl":"https://mill.example/quote/1"}')`,[id,supplier.id]);
  await pg.query('SELECT run_demand_operations(200)');
  let offer=(await pg.query('SELECT * FROM "DemandOfferBuild" WHERE "signalId"=$1',[id])).rows[0];
  assert.equal(offer.commercial.offerPerMt,500);
  assert.equal(offer.commercial.requiresHumanApproval,true);
  assert.equal(offer.status,'DRAFT');
  assert.equal((await pg.query('SELECT count(*)::int n FROM "DemandSupplierFit" WHERE "signalId"=$1',[id])).rows[0].n,1);
  assert.equal((await pg.query('SELECT status FROM "DemandSupplierFit" WHERE "signalId"=$1',[id])).rows[0].status,'SELECTED');
  const taskCount=(await pg.query('SELECT count(*)::int n FROM "DemandTask" WHERE "signalId"=$1',[id])).rows[0].n;
  await pg.query('SELECT run_demand_operations(200)');
  assert.equal((await pg.query('SELECT count(*)::int n FROM "DemandTask" WHERE "signalId"=$1',[id])).rows[0].n,taskCount);
  assert.equal((await pg.query('SELECT count(*)::int n FROM core."Opportunity"')).rows[0].n,1);
  // Expired costs cannot pass approval. Refresh restores a reviewable, never auto-approved draft.
  await pg.query(`UPDATE "DemandCostInput" SET "validUntil"=now()-interval '1 hour' WHERE "signalId"=$1`,[id]);
  await assert.rejects(pg.query(`UPDATE "DemandOfferBuild" SET status='READY',"approvedAt"=now() WHERE "signalId"=$1`,[id]),/Current sourced costs/);
  await pg.query(`UPDATE "DemandCostInput" SET "validUntil"=now()+interval '1 day' WHERE "signalId"=$1`,[id]);
  await assert.rejects(pg.query(`UPDATE "DemandOfferBuild" SET status='READY',"approvedAt"=now() WHERE "signalId"=$1`,[id]),/Current sourced costs/);
  await pg.query(`UPDATE "DemandSupplierProfile" SET "verificationStatus"='SEPTLION_VERIFIED' WHERE id=$1`,[supplier.id]);
  await pg.query(`UPDATE "DemandOfferBuild" SET status='READY',"approvedAt"=now() WHERE "signalId"=$1`,[id]);
  const testRow=(await pg.query(`INSERT INTO "DemandSignal"(source,"sourceRecordId",type,market,product,"productKey","publishedAt",raw)
   VALUES('fixture','test','RFQ','Sudan','Flour','wheat_flour',now(),'{"isTest":true}') RETURNING id`)).rows[0];
  await pg.query(`INSERT INTO "DemandSignal"(source,"sourceRecordId",type,market,product,"productKey","publishedAt")
   VALUES('fixture','stale','RFQ','Sudan','Flour','wheat_flour',now()-interval '60 days'),('fixture','other','RFQ','Germany','Flour','wheat_flour',now())`);
  await pg.query('SELECT run_demand_operations(200)');
  assert.equal((await pg.query('SELECT "nextAction" FROM "DemandAssessment" WHERE "signalId"=$1',[testRow.id])).rows[0].nextAction,'EXCLUDE_TEST');
  const actions=(await pg.query('SELECT "nextAction" FROM "DemandAssessment"')).rows.map(r=>r.nextAction);
  assert.ok(actions.includes('REVALIDATE_DEMAND'));
  assert.ok(actions.includes('WATCH_OTHER_MARKET'));
  assert.equal((await pg.query('SELECT count(*)::int n FROM core."Opportunity"')).rows[0].n,1); // no stale/test/foreign-market imports
  // Alerts are deduplicated even on repeated operations.
  const before=(await pg.query(`SELECT count(*)::int n FROM "DemandAlert" WHERE type='SOURCE_FAILURE'`)).rows[0].n;
  await pg.query('SELECT run_demand_operations(200)');
  assert.equal((await pg.query(`SELECT count(*)::int n FROM "DemandAlert" WHERE type='SOURCE_FAILURE'`)).rows[0].n,before);
  await pg.exec('SET ROLE service_role');
  const backendRun=(await pg.query('SELECT run_demand_operations(200) AS r')).rows[0].r;
  assert.deepEqual(backendRun.errors,[]);
  assert.ok(backendRun.processed>=4);
  await pg.exec('RESET ROLE');
  for(const role of ['anon','authenticated']) {
   await pg.exec('SET ROLE '+role);
   await assert.rejects(pg.query('SELECT run_demand_operations(200)'),/permission denied/);
   await assert.rejects(pg.query('SELECT * FROM "DemandAssessment"'),/permission denied/);
   await pg.exec('RESET ROLE');
  }
 } finally {await pg.close();}
});

test('prediction separates buyers and duplicate dates, requiring a stable verified buyer history',async()=>{
 const pg=await demandDatabase();
 try {
  const buyer=(await pg.query(`INSERT INTO "DemandBuyerProfile"("displayName","legalName",country,"verificationStatus",confidence)
   VALUES('Regular Buyer','Regular Buyer Ltd','Sudan','VERIFIED',95) RETURNING id`)).rows[0];
  for(const [i,days] of [31,21,11,1,1].entries()){
   const row=(await pg.query(`INSERT INTO "DemandSignal"(source,"sourceRecordId",type,market,product,"productKey","publishedAt")
    VALUES('fixture',$1,'RFQ','Sudan','Flour','wheat_flour',now()-make_interval(days=>$2)) RETURNING id`,['regular-'+i,days])).rows[0];
   await pg.query('INSERT INTO "DemandBuyerSignal"("buyerId","signalId") VALUES($1,$2)',[buyer.id,row.id]);
  }
  // Other buyers in the same market must not change the first buyer's interval.
  for(let i=0;i<5;i++)await pg.query(`INSERT INTO "DemandSignal"(source,"sourceRecordId",type,market,product,"productKey","publishedAt","buyerName") VALUES('fixture',$1,'RFQ','Sudan','Flour','wheat_flour',now()-make_interval(days=>$2),$1)`,['other-'+i,i+3]);
  await pg.query('SELECT refresh_demand_patterns()');
  const pattern=(await pg.query('SELECT * FROM "DemandBuyerPattern" WHERE "buyerId"=$1',[buyer.id])).rows[0];
  assert.equal(pattern.observationCount,4);
  assert.equal(Number(pattern.avgIntervalDays),10);
  assert.ok(pattern.predictedWindowStart);
  assert.ok(pattern.predictedWindowEnd);
  assert.equal((await pg.query('SELECT "predictedWindowStart" FROM "DemandPattern" WHERE market=\'Sudan\'')).rows[0].predictedWindowStart,null);
 } finally {await pg.close();}
});
