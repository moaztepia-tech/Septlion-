-- Generated fixtures, no external messages or commercial commitments; all changes roll back.
begin;
do $$
declare buyer text:=gen_random_uuid()::text;op text:=gen_random_uuid()::text;stranger text:=gen_random_uuid()::text;org text:=gen_random_uuid()::text;other_org text:=gen_random_uuid()::text;req jsonb;offer jsonb;accepted jsonb;retry jsonb;input jsonb;plan jsonb;tx text;b text;result jsonb;doc jsonb;v int;idx int;stage text;key text;new_req text;count_before int;
begin
 insert into core."User"(id,email,"passwordHash","isActive","createdAt","updatedAt") values (buyer,buyer||'@fixture.invalid','TEST',true,current_timestamp,current_timestamp),(op,op||'@fixture.invalid','TEST',true,current_timestamp,current_timestamp),(stranger,stranger||'@fixture.invalid','TEST',true,current_timestamp,current_timestamp);
 insert into core."Organization"(id,name,"organizationType",status,"createdAt","updatedAt") values(org,'TEST final buyer','BUYER','ACTIVE',current_timestamp,current_timestamp),(other_org,'TEST stranger','BUYER','ACTIVE',current_timestamp,current_timestamp);
 insert into core."Membership"(id,"userId","organizationId",role,"createdAt") values(gen_random_uuid()::text,buyer,org,'BUYER',current_timestamp),(gen_random_uuid()::text,op,'septlion-operator','SALES',current_timestamp),(gen_random_uuid()::text,stranger,other_org,'BUYER',current_timestamp);
 plan:=jsonb_build_object('version',1,'automaticPurchaseOrders',false,'terms','TEST agreed schedule','batches',jsonb_build_array(jsonb_build_object('sequence',1,'quantity',1,'unit','FCL','plannedDate','2026-11-01','notes','TEST first'),jsonb_build_object('sequence',2,'quantity',1,'unit','FCL','plannedDate','2026-12-01','notes','TEST second')));
 input:=jsonb_build_object('product','TEST — final release fixture','market','TEST destination','quantityNumber',2,'containerCount',2,'unit','FCL','packing',jsonb_build_object('display','TEST'),'knownFacts',jsonb_build_object('supplyPlan',plan));key:=gen_random_uuid()::text;
 req:=core.create_buyer_requirement_v2(org,buyer,input,key);retry:=core.create_buyer_requirement_v2(org,buyer,input,key);
 if req->>'requirementId'<>retry->>'requirementId' or retry->>'idempotent'<>'true' or (select count(*) from core."RFQ" where "buyerOrgId"=org)<>1 then raise exception 'request replay duplicated data';end if;
 begin perform core.create_buyer_requirement_v2(org,buyer,input||'{"quantityNumber":3}'::jsonb,key);raise exception 'expected request conflict';exception when others then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
 begin perform core.create_buyer_requirement_v2(org,stranger,input,gen_random_uuid()::text);raise exception 'expected foreign request denial';exception when others then if sqlerrm<>'access_denied' then raise;end if;end;
 retry:=core.create_buyer_requirement_v2(org,buyer,input||jsonb_build_object('product','TEST — fractional tonnage','quantityNumber',40.5,'containerCount',null,'unit','MT','knownFacts','{}'::jsonb),gen_random_uuid()::text);
 if not exists(select 1 from core."QualifiedRequirement" where id=retry->>'requirementId' and quantity=40.5 and unit='MT' and "containerCount" is null) then raise exception 'tonnage lost';end if;
 result:=core.save_buyer_account_profile(org,buyer,'{"name":"TEST contact","company":"TEST company","whatsapp":"+12025550101","email":"","country":"TEST","website":""}');
 if not exists(select 1 from core."BuyerContact" where id=result->>'contactId' and email is null and "whatsappReachability"='UNCONFIRMED') then raise exception 'profile verification forged';end if;
 begin perform core.save_buyer_account_profile(org,stranger,'{"name":"OTHER","company":"OTHER","whatsapp":"+12025550101"}');raise exception 'expected foreign profile denial';exception when others then if sqlerrm<>'access_denied' then raise;end if;end;
 offer:=core.issue_septlion_offer(req->>'rfqId',op,jsonb_build_object('testOnly',true,'items',jsonb_build_array(jsonb_build_object('description','TEST','quantity',2,'unit','FCL','unitPrice',1)),'terms',jsonb_build_object('notice','TEST non-binding','supplyPlan',plan)),'USD',(current_timestamp+interval '7 days')::timestamp);
 accepted:=core.accept_trade_offer_v3(offer->>'offerId',org,buyer,1,'TEST');tx:=accepted->>'transactionId';
 retry:=core.accept_trade_offer_v3(offer->>'offerId',org,buyer,1,'TEST');if retry->>'transactionId'<>tx or (select count(*) from core."TradeSupplyBatch" where "transactionId"=tx)<>2 then raise exception 'batch acceptance duplicated';end if;
 select count(*) into count_before from core."RFQ" where "buyerOrgId"=org;
 for idx in 1..2 loop
  select id into b from core."TradeSupplyBatch" where "transactionId"=tx and sequence=idx;
  begin perform core.change_trade_supply_batch(tx,b,org,buyer,'IN_EXECUTION',1,'TEST buyer cannot advance',gen_random_uuid()::text);raise exception 'expected operator role denial';exception when others then if sqlerrm<>'access_denied' then raise;end if;end;
  begin perform core.change_trade_supply_batch(tx,b,other_org,stranger,'ACCEPTED',1,'TEST foreign receipt',gen_random_uuid()::text);raise exception 'expected foreign batch denial';exception when others then if sqlerrm<>'transaction_not_found' then raise;end if;end;
  begin perform core.change_trade_supply_batch(tx,b,'septlion-operator',op,'DELIVERED',1,'TEST cannot skip stages',gen_random_uuid()::text);raise exception 'expected stage order denial';exception when others then if sqlerrm<>'invalid_status_transition' then raise;end if;end;
  foreach stage in array array['IN_EXECUTION','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED'] loop
   select version into v from core."TradeSupplyBatch" where id=b;key:=gen_random_uuid()::text;doc:=null;
   if stage in ('SHIPPED','DELIVERED') then
    update core."TradeTransaction" set "testOnly"=false where id=tx;
    begin perform core.change_trade_supply_batch(tx,b,'septlion-operator',op,stage,v,'TEST missing proof',gen_random_uuid()::text);raise exception 'expected proof denial';exception when others then if sqlerrm<>'batch_evidence_required' then raise;end if;end;
    doc:=core.prepare_trade_document(tx,'septlion-operator',op,'TEST-proof.pdf','application/pdf',32,repeat('a',64),case stage when 'SHIPPED' then 'BILL_OF_LADING' else 'DELIVERY_PROOF' end,true,gen_random_uuid()::text);
    update core."CommercialDocument" set status='READY' where id=doc->>'id';
   end if;
   result:=core.change_trade_supply_batch(tx,b,'septlion-operator',op,stage,v,'TEST simulated stage',key,doc->>'id');
   retry:=core.change_trade_supply_batch(tx,b,'septlion-operator',op,stage,v,'TEST simulated stage',key,doc->>'id');if retry->>'idempotent'<>'true' then raise exception 'batch retry lost';end if;
   begin perform core.change_trade_supply_batch(tx,b,'septlion-operator',op,stage,v,'TEST changed retry',key,doc->>'id');raise exception 'expected batch conflict';exception when others then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
   update core."TradeTransaction" set "testOnly"=true where id=tx;
  end loop;
  select version into v from core."TradeSupplyBatch" where id=b;
  if idx=1 then
   perform core.change_trade_supply_batch(tx,b,org,buyer,'CLAIM_OPEN',v,'TEST damaged pack',gen_random_uuid()::text);
   select version into v from core."TradeSupplyBatch" where id=b;
   begin perform core.change_trade_supply_batch(tx,b,org,buyer,'ACCEPTED',v,'TEST premature receipt',gen_random_uuid()::text);raise exception 'expected claim block';exception when others then if sqlerrm<>'invalid_status_transition' then raise;end if;end;
   perform core.change_trade_supply_batch(tx,b,'septlion-operator',op,'CLAIM_RESOLVED',v,'TEST replacement agreed',gen_random_uuid()::text);
   select version into v from core."TradeSupplyBatch" where id=b;
  end if;
  begin perform core.change_trade_supply_batch(tx,b,org,buyer,'ACCEPTED',v-1,'TEST stale receipt',gen_random_uuid()::text);raise exception 'expected version denial';exception when others then if sqlerrm<>'stale_transaction' then raise;end if;end;
  result:=core.change_trade_supply_batch(tx,b,org,buyer,'ACCEPTED',v,'TEST delivery matches',gen_random_uuid()::text);
  if idx=1 and exists(select 1 from core."TradeMemory" where "transactionId"=tx) then raise exception 'completed before all deliveries';end if;
 end loop;
 if not exists(select 1 from core."TradeTransaction" where id=tx and status='COMPLETED') or (select count(*) from core."TradeMemory" where "transactionId"=tx)<>1 or (select count(*) from core."RFQ" where "buyerOrgId"=org)<>count_before then raise exception 'final completion or automatic ordering failure';end if;
 result:=core.reorder_trade_transaction_v3(tx,org,buyer,3,gen_random_uuid()::text);new_req:=result->>'id';
 if not exists(select 1 from core."QualifiedRequirement" where id=new_req and quantity=3 and not ("knownFacts" ? 'supplyPlan')) then raise exception 'manual reorder inherited old dates';end if;
 if has_table_privilege('authenticated','core."TradeSupplyBatch"','SELECT') or has_table_privilege('anon','core."RequirementSubmission"','SELECT') or not has_function_privilege('service_role','core.change_trade_supply_batch(text,text,text,text,text,integer,text,text,text)','EXECUTE') then raise exception 'runtime grants invalid';end if;
end $$;
rollback;
select 'PASS: requests, profile, role isolation, per-delivery proofs, claims, receipts, completion and manual reorder; all fixtures rolled back' as result;
