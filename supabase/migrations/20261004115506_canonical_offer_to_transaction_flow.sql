create or replace function core.issue_septlion_offer(p_rfq_id text,p_user_id text,p_snapshot jsonb,p_currency text default 'USD',p_valid_until timestamp default null)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog,public as $$
declare v_now timestamp(3):=current_timestamp; v_rfq core."RFQ"%rowtype; v_offer text; v_rev text; v_hash text;
begin
 select * into v_rfq from core."RFQ" where id=p_rfq_id for update; if not found then raise exception 'rfq_not_found'; end if;
 select id into v_offer from core."SeptlionOffer" where "rfqId"=p_rfq_id;
 if v_offer is not null then raise exception 'offer_already_exists'; end if;
 v_offer:=gen_random_uuid()::text; v_rev:=gen_random_uuid()::text; v_hash:=encode(digest(convert_to(coalesce(p_snapshot,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
 insert into core."SeptlionOffer"(id,"requirementId","rfqId","buyerOrgId","operatorOrgId",status,"currentRevision",currency,"validUntil","createdAt","updatedAt")
 values(v_offer,v_rfq."requirementId",p_rfq_id,v_rfq."buyerOrgId",'septlion-operator','ISSUED',1,coalesce(nullif(p_currency,''),'USD'),p_valid_until,v_now,v_now);
 insert into core."SeptlionOfferRevision"(id,"offerId","revisionNo",status,snapshot,"snapshotHash","issuedById","issuedAt","createdAt")
 values(v_rev,v_offer,1,'ISSUED',coalesce(p_snapshot,'{}'::jsonb),v_hash,p_user_id,v_now,v_now);
 update core."RFQ" set status='QUOTED',"updatedAt"=v_now where id=p_rfq_id;
 insert into core."Notification"(id,"organizationId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,v_rfq."buyerOrgId",'QUOTE','العرض جاهز','تم إصدار عرض SEPTLION لطلبك.','QUOTE',v_offer,v_now);
 return jsonb_build_object('offerId',v_offer,'revisionId',v_rev,'snapshotHash',v_hash);
end $$;
revoke all on function core.issue_septlion_offer(text,text,jsonb,text,timestamp) from public,anon,authenticated;
grant execute on function core.issue_septlion_offer(text,text,jsonb,text,timestamp) to service_role;

create or replace function core.accept_septlion_offer(p_offer_id text,p_buyer_org_id text,p_user_id text)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog,public as $$
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
end $$;
revoke all on function core.accept_septlion_offer(text,text,text) from public,anon,authenticated;
grant execute on function core.accept_septlion_offer(text,text,text) to service_role;
