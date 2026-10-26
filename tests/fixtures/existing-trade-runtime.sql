-- Read-only snapshot of existing core runtime functions, 2026-10-26.
-- Test bootstrap only; production changes are in supabase/migrations.
CREATE OR REPLACE FUNCTION core.accept_septlion_offer(p_offer_id text, p_buyer_org_id text, p_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
declare v_now timestamp(3):=current_timestamp; v_offer core."SeptlionOffer"%rowtype; v_rev core."SeptlionOfferRevision"%rowtype; v_lock text; v_tx text; v_ref text;
begin
 select * into v_offer from core."SeptlionOffer" where id=p_offer_id and "buyerOrgId"=p_buyer_org_id for update; if not found then raise exception 'offer_not_found'; end if;
 select "commercialLockId" into v_lock from core."TradeTransaction" where "commercialLockId" in (select id from core."CommercialLock" where "offerId"=p_offer_id) limit 1;
 if v_lock is not null then select id,reference into v_tx,v_ref from core."TradeTransaction" where "commercialLockId"=v_lock; return jsonb_build_object('transactionId',v_tx,'reference',v_ref,'idempotent',true); end if;
 if v_offer.status not in ('ISSUED','REVISED') then raise exception 'offer_not_acceptible'; end if;
 select * into v_rev from core."SeptlionOfferRevision" where "offerId"=p_offer_id and "revisionNo"=v_offer."currentRevision" for update; if not found then raise exception 'offer_revision_not_found'; end if;
 update core."SeptlionOffer" set status='ACCEPTED',"updatedAt"=v_now where id=p_offer_id;
 update core."SeptlionOfferRevision" set status='ACCEPTED',"acceptedById"=p_user_id,"acceptedAt"=v_now where id=v_rev.id;
 update core."RFQ" set status='ACCEPTED',"updatedAt"=v_now where id=v_offer."rfqId";
 v_lock:=gen_random_uuid()::text;
 insert into core."CommercialLock"(id,"offerId","offerRevisionId","buyerOrgId","supplierOrgId",version,snapshot,"snapshotHash","lockedByUserId","lockedAt") values(v_lock,p_offer_id,v_rev.id,p_buyer_org_id,'septlion-operator',1,v_rev.snapshot,v_rev."snapshotHash",p_user_id,v_now);
 v_tx:=gen_random_uuid()::text; v_ref:='TX-'||to_char(v_now,'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_tx,'-',''),1,6));
 insert into core."TradeTransaction"(id,reference,"commercialLockId","buyerOrgId","supplierOrgId",status,version,"createdAt","updatedAt") values(v_tx,v_ref,v_lock,p_buyer_org_id,'septlion-operator','COMMITTED',1,v_now,v_now);
 insert into core."TradeMilestone"(id,"transactionId",code,label,sequence,status,"buyerVisible","createdAt","updatedAt") values
 (gen_random_uuid()::text,v_tx,'CONFIRMED','Commercial terms confirmed',1,'COMPLETED',true,v_now,v_now),
 (gen_random_uuid()::text,v_tx,'PREPARATION','Order preparation',2,'PENDING',true,v_now,v_now),
 (gen_random_uuid()::text,v_tx,'READY_TO_SHIP','Ready to ship',3,'PENDING',true,v_now,v_now),
 (gen_random_uuid()::text,v_tx,'IN_TRANSIT','In transit',4,'PENDING',true,v_now,v_now),
 (gen_random_uuid()::text,v_tx,'DELIVERED','Delivered',5,'PENDING',true,v_now,v_now);
 insert into core."TradeReceipt"(id,"transactionId",status,"createdAt","updatedAt") values(gen_random_uuid()::text,v_tx,'PENDING',v_now,v_now);
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,v_tx,1,'TRANSACTION_COMMITTED','BUYER',p_buyer_org_id,p_user_id,v_now,jsonb_build_object('offerId',p_offer_id),'accept:'||p_offer_id,v_now);
 insert into core."Notification"(id,"organizationId","userId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'TRANSACTION','تم اعتماد العرض','تم إنشاء الصفقة وبدأ مسار التنفيذ.','TRANSACTION',v_tx,v_now);
 return jsonb_build_object('transactionId',v_tx,'reference',v_ref,'idempotent',false);
end $function$;

CREATE OR REPLACE FUNCTION core.create_buyer_requirement(p_org_id text, p_user_id text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
declare
 v_now timestamp(3):=current_timestamp; v_req text:=gen_random_uuid()::text; v_product_id text; v_sku_id text; v_rfq text:=gen_random_uuid()::text;
 v_name text:=nullif(btrim(p_input->>'product'),''); v_market text:=nullif(btrim(coalesce(p_input->>'market',p_input->>'destination')),'');
 v_qty numeric; v_containers integer; v_unit text:=coalesce(nullif(p_input->>'unit',''),'UNIT'); v_scale text; v_ref text;
begin
 if v_name is null or v_market is null then raise exception 'product_and_market_required'; end if;
 if nullif(p_input->>'quantityNumber','') is not null then v_qty:=(p_input->>'quantityNumber')::numeric; end if;
 if nullif(p_input->>'containerCount','') is not null then v_containers:=greatest(0,(p_input->>'containerCount')::integer); end if;
 v_scale:=case when v_containers is null or v_containers=0 then null when v_containers<=7 then 'S-1' when v_containers<=19 then 'S-2' when v_containers<=49 then 'S-3' when v_containers<=99 then 'S-4' when v_containers<=299 then 'S-5' when v_containers<=999 then 'S-6' else 'S-7' end;
 insert into core."QualifiedRequirement"("id","organizationId","source","sourceContext","status","product","market","quantity","unit","containerCount","septlionScale","deliveryCountry","deliveryPort","destinationCode","incoterm","paymentPreference","knownFacts","packing","confidence","createdAt","updatedAt")
 values(v_req,p_org_id,case when p_input->>'source'='PRODUCT_FEED' then 'PRODUCT_FEED'::core."RequirementSource" else 'AI_COMPOSER'::core."RequirementSource" end,coalesce(p_input->'sourceContext','{}'::jsonb),'QUALIFIED',v_name,v_market,v_qty,v_unit,nullif(v_containers,0),v_scale,p_input->>'deliveryCountry',coalesce(p_input->>'deliveryPort',p_input->>'destination'),p_input->>'destinationCode',p_input->>'incoterm',coalesce(p_input->>'paymentPreference',p_input->>'payment'),coalesce(p_input->'knownFacts',p_input),p_input->'packing',100,v_now,v_now);
 select id into v_product_id from core."Product" where "organizationId"='septlion-operator' and lower(name)=lower(v_name) limit 1;
 if v_product_id is null then
   v_product_id:=gen_random_uuid()::text;
   insert into core."Product"(id,"organizationId","sectorId",name,slug,status,visibility,"createdAt","updatedAt") values(v_product_id,'septlion-operator','sector-general-trade',v_name,'managed-'||substr(replace(v_product_id,'-',''),1,12),'ACTIVE','PRIVATE',v_now,v_now);
 end if;
 select id into v_sku_id from core."SKU" where "productId"=v_product_id order by "createdAt" limit 1;
 if v_sku_id is null then
   v_sku_id:=gen_random_uuid()::text;
   insert into core."SKU"(id,"organizationId","productId","skuCode",name,unit,"minimumOrderQty",currency,specifications,shipping,"createdAt","updatedAt") values(v_sku_id,'septlion-operator',v_product_id,'M-'||upper(substr(replace(v_sku_id,'-',''),1,10)),v_name,v_unit,1,coalesce(nullif(p_input->>'currency',''),'USD'),coalesce(p_input->'specifications','{}'::jsonb),jsonb_build_object('packing',p_input->'packing'),v_now,v_now);
 end if;
 v_ref:='RFQ-'||to_char(v_now,'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_rfq,'-',''),1,6));
 insert into core."RFQ"(id,"requirementId","buyerOrgId","supplierOrgId","sectorId",reference,status,"deliveryCountry","deliveryPort",incoterm,notes,"createdAt","updatedAt")
 values(v_rfq,v_req,p_org_id,'septlion-operator','sector-general-trade',v_ref,'OPEN',p_input->>'deliveryCountry',coalesce(p_input->>'deliveryPort',p_input->>'destination'),p_input->>'incoterm','Created from qualified SEPTLION requirement',v_now,v_now);
 insert into core."RFQItem"(id,"rfqId","skuId",quantity,unit,"createdAt") values(gen_random_uuid()::text,v_rfq,v_sku_id,coalesce(v_qty,v_containers::numeric,1),v_unit,v_now);
 insert into core."Notification"(id,"organizationId","userId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,p_org_id,p_user_id,'RFQ','تم تسجيل طلبك','تم تأهيل طلبك وفتح RFQ لإعداد العرض.','RFQ',v_rfq,v_now);
 return jsonb_build_object('requirementId',v_req,'rfqId',v_rfq,'reference',v_ref,'scale',v_scale);
end $function$;

CREATE OR REPLACE FUNCTION core.issue_septlion_offer(p_rfq_id text, p_user_id text, p_snapshot jsonb, p_currency text DEFAULT 'USD'::text, p_valid_until timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public', 'extensions'
AS $function$
declare v_now timestamp(3):=current_timestamp; v_rfq core."RFQ"%rowtype; v_offer text; v_rev text; v_hash text;
begin
 select * into v_rfq from core."RFQ" where id=p_rfq_id for update; if not found then raise exception 'rfq_not_found'; end if;
 select id into v_offer from core."SeptlionOffer" where "rfqId"=p_rfq_id; if v_offer is not null then raise exception 'offer_already_exists'; end if;
 v_offer:=gen_random_uuid()::text; v_rev:=gen_random_uuid()::text; v_hash:=encode(extensions.digest(convert_to(coalesce(p_snapshot,'{}'::jsonb)::text,'UTF8'),'sha256'::text),'hex');
 insert into core."SeptlionOffer"(id,"requirementId","rfqId","buyerOrgId","operatorOrgId",status,"currentRevision",currency,"validUntil","createdAt","updatedAt") values(v_offer,v_rfq."requirementId",p_rfq_id,v_rfq."buyerOrgId",'septlion-operator','ISSUED',1,coalesce(nullif(p_currency,''),'USD'),p_valid_until,v_now,v_now);
 insert into core."SeptlionOfferRevision"(id,"offerId","revisionNo",status,snapshot,"snapshotHash","issuedById","issuedAt","createdAt") values(v_rev,v_offer,1,'ISSUED',coalesce(p_snapshot,'{}'::jsonb),v_hash,p_user_id,v_now,v_now);
 update core."RFQ" set status='QUOTED',"updatedAt"=v_now where id=p_rfq_id;
 insert into core."Notification"(id,"organizationId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,v_rfq."buyerOrgId",'QUOTE','العرض جاهز','تم إصدار عرض SEPTLION لطلبك.','QUOTE',v_offer,v_now);
 return jsonb_build_object('offerId',v_offer,'revisionId',v_rev,'snapshotHash',v_hash);
end $function$;

