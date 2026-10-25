-- Read-only snapshot of existing core execution functions, 2026-10-26.
CREATE OR REPLACE FUNCTION core.advance_trade_transaction(p_transaction_id text, p_status core."TradeTransactionStatus", p_milestone_code text, p_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
declare v_now timestamp(3):=current_timestamp; v_tx core."TradeTransaction"%rowtype; v_seq int;
begin
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and "supplierOrgId"='septlion-operator' for update; if not found then raise exception 'transaction_not_found'; end if;
 if not ((v_tx.status='COMMITTED' and p_status='IN_EXECUTION') or (v_tx.status='IN_EXECUTION' and p_status='READY_TO_SHIP') or (v_tx.status='READY_TO_SHIP' and p_status='SHIPPED') or (v_tx.status='SHIPPED' and p_status='IN_TRANSIT') or (v_tx.status='IN_TRANSIT' and p_status='DELIVERED')) then raise exception 'invalid_status_transition'; end if;
 update core."TradeTransaction" set status=p_status,version=version+1,"updatedAt"=v_now where id=p_transaction_id;
 update core."TradeMilestone" set status='COMPLETED',"startedAt"=coalesce("startedAt",v_now),"completedAt"=v_now,"updatedAt"=v_now where "transactionId"=p_transaction_id and code=p_milestone_code;
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=p_transaction_id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"createdAt") values(gen_random_uuid()::text,p_transaction_id,v_seq,'STATUS_CHANGED','BUYER','septlion-operator',p_user_id,v_now,jsonb_build_object('status',p_status,'milestone',p_milestone_code),v_now);
 if p_status='DELIVERED' then update core."TradeTransaction" set status='RECEIPT_REVIEW',"updatedAt"=v_now where id=p_transaction_id; end if;
 return jsonb_build_object('transactionId',p_transaction_id,'status',case when p_status='DELIVERED' then 'RECEIPT_REVIEW' else p_status::text end);
end $function$;
CREATE OR REPLACE FUNCTION core.complete_trade_memory(p_transaction_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
declare v_id text:=gen_random_uuid()::text; v_tx core."TradeTransaction"%rowtype; v_lock core."CommercialLock"%rowtype; v_req core."QualifiedRequirement"%rowtype; v_hash text;
begin
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and status='COMPLETED';
 if not found then raise exception 'completed_transaction_required'; end if;
 select * into v_lock from core."CommercialLock" where id=v_tx."commercialLockId";
 select qr.* into v_req from core."QualifiedRequirement" qr join core."SeptlionOffer" o on o."requirementId"=qr.id where o.id=v_lock."offerId";
 v_hash:=md5(coalesce(v_lock.snapshot::text,'{}'));
 insert into core."TradeMemory"(id,"transactionId","buyerOrgId","productKey","approvedConfig","commercialHistory","executionHistory","sourceHash","createdAt","updatedAt")
 values(v_id,p_transaction_id,v_tx."buyerOrgId",lower(coalesce(v_req.product,'unknown')),coalesce(v_lock.snapshot,'{}'::jsonb),
 jsonb_build_object('offerId',v_lock."offerId",'lockedAt',v_lock."lockedAt"),
 jsonb_build_object('status',v_tx.status,'completedAt',v_tx."updatedAt"),v_hash,current_timestamp,current_timestamp)
 on conflict ("transactionId") do update set "approvedConfig"=excluded."approvedConfig","commercialHistory"=excluded."commercialHistory","executionHistory"=excluded."executionHistory","sourceHash"=excluded."sourceHash","updatedAt"=current_timestamp returning id into v_id;
 return v_id;
end $function$;
CREATE OR REPLACE FUNCTION core.open_trade_claim(p_transaction_id text, p_buyer_org_id text, p_user_id text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
declare v_now timestamp(3):=current_timestamp; v_id text:=gen_random_uuid()::text; v_ref text;
begin
 if length(btrim(coalesce(p_description,'')))<5 then raise exception 'claim_description_required'; end if;
 if not exists(select 1 from core."TradeTransaction" where id=p_transaction_id and "buyerOrgId"=p_buyer_org_id and status in ('DELIVERED','RECEIPT_REVIEW','CLAIM_OPEN')) then raise exception 'claim_not_available'; end if;
 v_ref:='CLM-'||to_char(v_now,'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_id,'-',''),1,6));
 insert into core."TradeClaim"(id,"transactionId",reference,status,category,description,"openedById","createdAt","updatedAt") values(v_id,p_transaction_id,v_ref,'OPEN','DELIVERY',p_description,p_user_id,v_now,v_now);
 update core."TradeReceipt" set status='ISSUE_REPORTED',notes=p_description,"updatedAt"=v_now where "transactionId"=p_transaction_id;
 update core."TradeTransaction" set status='CLAIM_OPEN',version=version+1,"updatedAt"=v_now where id=p_transaction_id;
 return jsonb_build_object('claimId',v_id,'reference',v_ref);
end $function$;
CREATE OR REPLACE FUNCTION core.reorder_trade_transaction(p_transaction_id text, p_buyer_org_id text, p_user_id text, p_quantity numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
declare v_now timestamp(3):=current_timestamp; v_old_req core."QualifiedRequirement"%rowtype; v_old_rfq core."RFQ"%rowtype; v_new_req text:=gen_random_uuid()::text; v_new_rfq text:=gen_random_uuid()::text; v_ref text;
begin
 if not exists(select 1 from core."TradeTransaction" where id=p_transaction_id and "buyerOrgId"=p_buyer_org_id and status='COMPLETED') then raise exception 'reorder_not_available'; end if;
 select qr.* into v_old_req from core."QualifiedRequirement" qr join core."SeptlionOffer" o on o."requirementId"=qr.id join core."CommercialLock" l on l."offerId"=o.id join core."TradeTransaction" t on t."commercialLockId"=l.id where t.id=p_transaction_id;
 select r.* into v_old_rfq from core."RFQ" r where r."requirementId"=v_old_req.id;
 insert into core."QualifiedRequirement" select v_new_req,"buyerProfileId","buyerContactId",null,p_buyer_org_id,'REORDER',jsonb_build_object('reorderOf',p_transaction_id),'QUALIFIED',product,market,coalesce(p_quantity,quantity),unit,"containerCount","septlionScale","deliveryCountry","deliveryPort","destinationCode",incoterm,"paymentPreference","targetPrice",currency,"requiredDate","knownFacts","inferredFacts","fieldStates","criticalMissing","productConfiguration",specifications,packing,compliance,confidence,v_now,v_now from core."QualifiedRequirement" where id=v_old_req.id;
 v_ref:='RFQ-'||to_char(v_now,'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_new_rfq,'-',''),1,6));
 insert into core."RFQ"(id,"requirementId","buyerOrgId","supplierOrgId","sectorId",reference,status,"deliveryCountry","deliveryPort",incoterm,"requestedDocuments","requestedDate",notes,"createdAt","updatedAt") values(v_new_rfq,v_new_req,p_buyer_org_id,v_old_rfq."supplierOrgId",v_old_rfq."sectorId",v_ref,'OPEN',v_old_rfq."deliveryCountry",v_old_rfq."deliveryPort",v_old_rfq.incoterm,v_old_rfq."requestedDocuments",v_old_rfq."requestedDate",'Reorder of '||p_transaction_id,v_now,v_now);
 insert into core."RFQItem"(id,"rfqId","skuId",quantity,unit,"targetPrice","createdAt") select gen_random_uuid()::text,v_new_rfq,"skuId",coalesce(p_quantity,quantity),unit,"targetPrice",v_now from core."RFQItem" where "rfqId"=v_old_rfq.id;
 insert into core."Notification"(id,"organizationId","userId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'RFQ','تم إنشاء إعادة الطلب','أعدنا فتح RFQ جديدًا من ذاكرة الصفقة السابقة.','RFQ',v_new_rfq,v_now);
 return jsonb_build_object('id',v_new_req,'rfqId',v_new_rfq,'reference',v_ref);
end $function$;
