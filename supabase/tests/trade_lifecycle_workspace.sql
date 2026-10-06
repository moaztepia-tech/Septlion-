-- Integration verification uses generated fixtures and rolls everything back.
begin;
do $$
declare buyer text:=gen_random_uuid()::text;op text:=gen_random_uuid()::text;stranger text:=gen_random_uuid()::text;org text:=gen_random_uuid()::text;other_org text:=gen_random_uuid()::text;req jsonb;offer jsonb;accepted jsonb;tx text;v int;result jsonb;retry jsonb;claim jsonb;doc jsonb;count_before int;new_req text;key text;stage text;code text;
begin
 insert into core."User"(id,email,"passwordHash","isActive","createdAt","updatedAt") values
 (buyer,buyer||'@fixture.invalid','TEST',true,current_timestamp,current_timestamp),
 (op,op||'@fixture.invalid','TEST',true,current_timestamp,current_timestamp),
 (stranger,stranger||'@fixture.invalid','TEST',true,current_timestamp,current_timestamp);
 insert into core."Organization"(id,name,"organizationType",status,"createdAt","updatedAt") values(org,'TEST lifecycle buyer','BUYER','ACTIVE',current_timestamp,current_timestamp),(other_org,'TEST stranger','BUYER','ACTIVE',current_timestamp,current_timestamp);
 insert into core."Membership"(id,"userId","organizationId",role,"createdAt") values(gen_random_uuid()::text,buyer,org,'BUYER',current_timestamp),(gen_random_uuid()::text,op,'septlion-operator','SALES',current_timestamp),(gen_random_uuid()::text,stranger,other_org,'BUYER',current_timestamp);
 req:=core.create_buyer_requirement(org,buyer,jsonb_build_object('product','TEST — lifecycle fixture','market','TEST destination','quantityNumber',1,'containerCount',1,'unit','FCL','packing',jsonb_build_object('display','TEST'),'knownFacts','{}'::jsonb));
 offer:=core.issue_septlion_offer(req->>'rfqId',op,jsonb_build_object('testOnly',true,'items',jsonb_build_array(jsonb_build_object('description','TEST','quantity',1,'unit','FCL','unitPrice',1)),'terms',jsonb_build_object('notice','TEST non-binding')),'USD',(current_timestamp+interval '7 days')::timestamp);
 begin perform core.accept_trade_offer_v2(offer->>'offerId',other_org,stranger,1,'TEST');raise exception 'expected owner rejection';exception when others then if sqlerrm<>'offer_not_found' then raise;end if;end;
 begin perform core.accept_trade_offer_v2(offer->>'offerId',org,buyer,2,'TEST');raise exception 'expected revision rejection';exception when others then if sqlerrm<>'revision_changed' then raise;end if;end;
 begin perform core.accept_trade_offer_v2(offer->>'offerId',org,buyer,1,'COMMERCIAL');raise exception 'expected mode rejection';exception when others then if sqlerrm<>'acceptance_mode_invalid' then raise;end if;end;
 update core."SeptlionOffer" set "validUntil"=current_timestamp-interval '1 minute' where id=offer->>'offerId';
 begin perform core.accept_trade_offer_v2(offer->>'offerId',org,buyer,1,'TEST');raise exception 'expected expiry rejection';exception when others then if sqlerrm<>'offer_expired' then raise;end if;end;
 update core."SeptlionOffer" set "validUntil"=current_timestamp+interval '7 days' where id=offer->>'offerId';
 accepted:=core.accept_trade_offer_v2(offer->>'offerId',org,buyer,1,'TEST');tx:=accepted->>'transactionId';
 retry:=core.accept_trade_offer_v2(offer->>'offerId',org,buyer,1,'TEST');
 if retry->>'transactionId'<>tx or retry->>'idempotent'<>'true' or accepted->>'testOnly'<>'true' or accepted->>'reference' not like 'TEST-%' then raise exception 'acceptance replay or test isolation failed';end if;
 select version into v from core."TradeTransaction" where id=tx;
 begin perform core.accept_trade_receipt_v2(tx,org,buyer,v);raise exception 'expected premature receipt rejection';exception when others then if sqlerrm<>'receipt_not_available' then raise;end if;end;
 begin perform core.advance_trade_transaction_v2(tx,'IN_EXECUTION','PREPARATION',buyer,v,'fixture-advance-owner','TEST step');raise exception 'expected operator rejection';exception when others then if sqlerrm<>'access_denied' then raise;end if;end;
 begin perform core.advance_trade_transaction_v2(tx,'SHIPPED','READY_TO_SHIP',op,v,'fixture-advance-skip','TEST step');raise exception 'expected skipped stage rejection';exception when others then if sqlerrm<>'invalid_status_transition' then raise;end if;end;
 begin perform core.advance_trade_transaction_v2(tx,'IN_EXECUTION','DELIVERED',op,v,'fixture-wrong-milestone','TEST step');raise exception 'expected milestone rejection';exception when others then if sqlerrm<>'milestone_mismatch' then raise;end if;end;
 begin perform core.prepare_trade_document(tx,other_org,stranger,'test.pdf','application/pdf',20,repeat('a',64),'OTHER',true,'fixture-foreign-document');raise exception 'expected document owner rejection';exception when others then if sqlerrm<>'transaction_not_found' then raise;end if;end;
 doc:=core.prepare_trade_document(tx,'septlion-operator',op,'test.pdf','application/pdf',20,repeat('a',64),'PACKING_LIST',true,'fixture-document-001');
 retry:=core.prepare_trade_document(tx,'septlion-operator',op,'test.pdf','application/pdf',20,repeat('a',64),'PACKING_LIST',true,'fixture-document-001');
 if retry->>'id'<>doc->>'id' or retry->>'idempotent'<>'true' then raise exception 'document replay failed';end if;
 begin perform core.prepare_trade_document(tx,'septlion-operator',op,'different.pdf','application/pdf',20,repeat('a',64),'PACKING_LIST',true,'fixture-document-001');raise exception 'expected changed upload rejection';exception when others then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
 result:=core.finalize_trade_document(doc->>'id','septlion-operator',op,true);
 retry:=core.finalize_trade_document(doc->>'id','septlion-operator',op,true);
 if result->>'status'<>'READY' or retry->>'idempotent'<>'true' then raise exception 'document finalization replay failed';end if;
 foreach stage in array array['IN_EXECUTION','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED'] loop
  select version into v from core."TradeTransaction" where id=tx;
  code:=case stage when 'IN_EXECUTION' then 'PREPARATION' when 'READY_TO_SHIP' then 'PREPARATION' when 'SHIPPED' then 'READY_TO_SHIP' when 'IN_TRANSIT' then 'IN_TRANSIT' else 'DELIVERED' end;
  key:='fixture-advance-'||lower(stage);
  result:=core.advance_trade_transaction_v2(tx,stage,code,op,v,key,'TEST — simulated event');
  select count(*) into count_before from core."TradeEvent" where "transactionId"=tx;
  retry:=core.advance_trade_transaction_v2(tx,stage,code,op,v,key,'TEST — simulated event');
  if retry->>'idempotent'<>'true' or (select count(*) from core."TradeEvent" where "transactionId"=tx)<>count_before then raise exception 'advance replay duplicated an event';end if;
  begin perform core.advance_trade_transaction_v2(tx,stage,code,op,v,key,'TEST — changed event');raise exception 'expected changed retry rejection';exception when others then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
 end loop;
 if (select status from core."TradeTransaction" where id=tx)<>'RECEIPT_REVIEW' or exists(select 1 from core."TradeMilestone" where "transactionId"=tx and status<>'COMPLETED') then raise exception 'delivery or milestones incorrect';end if;
 select version into v from core."TradeTransaction" where id=tx;
 claim:=core.open_trade_claim_v2(tx,org,buyer,'TEST — missing item simulation',v,'fixture-claim-001');
 retry:=core.open_trade_claim_v2(tx,org,buyer,'TEST — missing item simulation',v,'fixture-claim-001');
 if retry->>'claimId'<>claim->>'claimId' or retry->>'idempotent'<>'true' then raise exception 'claim replay failed';end if;
 begin perform core.accept_trade_receipt_v2(tx,org,buyer,v);raise exception 'expected unresolved claim rejection';exception when others then if sqlerrm<>'receipt_not_available' then raise;end if;end;
 select version into v from core."TradeTransaction" where id=tx;
 perform core.resolve_trade_claim_v2(tx,claim->>'claimId',op,'TEST — issue resolution simulation',v);
 select version into v from core."TradeTransaction" where id=tx;
 result:=core.accept_trade_receipt_v2(tx,org,buyer,v);retry:=core.accept_trade_receipt_v2(tx,org,buyer,v);
 if result->>'status'<>'COMPLETED' or retry->>'idempotent'<>'true' or not exists(select 1 from core."TradeMemory" where "transactionId"=tx) then raise exception 'receipt or memory replay failed';end if;
 begin perform core.reorder_trade_transaction_v2(tx,org,buyer,7.5,'fixture-reorder-invalid');raise exception 'expected fractional container rejection';exception when others then if sqlerrm<>'integer_container_required' then raise;end if;end;
 result:=core.reorder_trade_transaction_v2(tx,org,buyer,8,'fixture-reorder-001');new_req:=result->>'id';
 retry:=core.reorder_trade_transaction_v2(tx,org,buyer,8,'fixture-reorder-001');
 if retry->>'id'<>new_req or retry->>'idempotent'<>'true' or (select "containerCount" from core."QualifiedRequirement" where id=new_req)<>8 or (select "septlionScale" from core."QualifiedRequirement" where id=new_req)<>'Nano' or (select status from core."RFQ" where id=result->>'rfqId')<>'OPEN' or exists(select 1 from core."SeptlionOffer" where "requirementId"=new_req) then raise exception 'reorder quantity, scale, replay or fresh pricing failed';end if;
 begin perform core.reorder_trade_transaction_v2(tx,org,buyer,9,'fixture-reorder-001');raise exception 'expected changed reorder rejection';exception when others then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
 -- Commercial execution needs shared documents even for a valid operator.
 req:=core.create_buyer_requirement(org,buyer,jsonb_build_object('product','Integration fixture commercial scope','market','TEST destination','quantityNumber',1,'containerCount',1,'unit','FCL','knownFacts','{}'::jsonb));
 offer:=core.issue_septlion_offer(req->>'rfqId',op,jsonb_build_object('testOnly',false,'items',jsonb_build_array(jsonb_build_object('description','Fixture','quantity',1,'unit','FCL','unitPrice',1))),'USD',(current_timestamp+interval '7 days')::timestamp);
 accepted:=core.accept_trade_offer_v2(offer->>'offerId',org,buyer,1,'COMMERCIAL');
 select version into v from core."TradeTransaction" where id=accepted->>'transactionId';
 perform core.advance_trade_transaction_v2(accepted->>'transactionId','IN_EXECUTION','PREPARATION',op,v,'fixture-commercial-001','Fixture preparation');
 select version into v from core."TradeTransaction" where id=accepted->>'transactionId';
 perform core.advance_trade_transaction_v2(accepted->>'transactionId','READY_TO_SHIP','PREPARATION',op,v,'fixture-commercial-002','Fixture ready');
 select version into v from core."TradeTransaction" where id=accepted->>'transactionId';
 begin perform core.advance_trade_transaction_v2(accepted->>'transactionId','SHIPPED','READY_TO_SHIP',op,v,'fixture-commercial-003','Fixture shipping');raise exception 'expected shipping proof rejection';exception when others then if sqlerrm<>'shipping_evidence_required' then raise;end if;end;
 doc:=core.prepare_trade_document(accepted->>'transactionId','septlion-operator',op,'proof.pdf','application/pdf',20,repeat('b',64),'BILL_OF_LADING',true,'fixture-commercial-proof');
 perform core.finalize_trade_document(doc->>'id','septlion-operator',op,true);
 perform core.advance_trade_transaction_v2(accepted->>'transactionId','SHIPPED','READY_TO_SHIP',op,v,'fixture-commercial-003','Fixture shipping');
 select version into v from core."TradeTransaction" where id=accepted->>'transactionId';
 perform core.advance_trade_transaction_v2(accepted->>'transactionId','IN_TRANSIT','IN_TRANSIT',op,v,'fixture-commercial-004','Fixture transport');
 select version into v from core."TradeTransaction" where id=accepted->>'transactionId';
 begin perform core.advance_trade_transaction_v2(accepted->>'transactionId','DELIVERED','DELIVERED',op,v,'fixture-commercial-005','Fixture delivery');raise exception 'expected delivery proof rejection';exception when others then if sqlerrm<>'delivery_evidence_required' then raise;end if;end;
 if not exists(select 1 from core."AuditLog" where "entityId"=tx and metadata->>'testOnly'='true') then raise exception 'audit missing';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='core' and p.proname in ('accept_trade_offer_v2','advance_trade_transaction_v2','accept_trade_receipt_v2','open_trade_claim_v2','resolve_trade_claim_v2','reorder_trade_transaction_v2','prepare_trade_document','finalize_trade_document') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then raise exception 'RPC exposed directly';end if;
end $$;
rollback;
select jsonb_build_object('passed',true,'generated_fixtures_rolled_back',true,'coverage','ownership, expiry, revision, TEST mode, ordered stages, milestones, replay, document registration, claims, receipt, memory, reorder quantity/scale, server-only RPCs, commercial shipping/delivery evidence') as lifecycle_verification;
