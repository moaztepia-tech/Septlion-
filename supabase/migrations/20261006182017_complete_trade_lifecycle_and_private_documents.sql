-- Atomic server-only lifecycle mutations. The Edge API authenticates the user;
-- each RPC independently checks active membership and transaction ownership.
alter table core."TradeTransaction" add column if not exists "testOnly" boolean not null default false;
alter table core."CommercialDocument" add column if not exists kind text not null default 'OTHER';
alter table core."CommercialDocument" add column if not exists "idempotencyKey" text;
create unique index if not exists "CommercialDocument_idempotencyKey_key" on core."CommercialDocument"("idempotencyKey");
alter table core."CommercialDocument" add constraint "CommercialDocument_kind_check" check (kind in ('INVOICE','PACKING_LIST','BILL_OF_LADING','QUALITY_REPORT','DELIVERY_PROOF','OTHER'));
update core."TradeTransaction" t set "testOnly"=true
from core."CommercialLock" l where t."commercialLockId"=l.id and l.snapshot->>'testOnly'='true';

create or replace function core.require_trade_actor(p_user_id text,p_org_id text,p_operator boolean default false)
returns void language plpgsql security invoker set search_path=core,pg_catalog as $$
begin
 if not exists(select 1 from core."Membership" m join core."User" u on u.id=m."userId" join core."Organization" o on o.id=m."organizationId"
  where m."userId"=p_user_id and m."organizationId"=p_org_id and u."isActive" and o.status='ACTIVE'
  and (not p_operator or (p_org_id='septlion-operator' and m.role in ('SALES','ADMIN'))))
 then raise exception 'access_denied'; end if;
end $$;

create or replace function core.accept_trade_offer_v2(p_offer_id text,p_buyer_org_id text,p_user_id text,p_revision integer,p_mode text)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_offer core."SeptlionOffer"%rowtype;v_rev core."SeptlionOfferRevision"%rowtype;v_result jsonb;v_test boolean;v_tx text;v_ref text;
begin
 perform core.require_trade_actor(p_user_id,p_buyer_org_id);
 select * into v_offer from core."SeptlionOffer" where id=p_offer_id and "buyerOrgId"=p_buyer_org_id for update;
 if not found then raise exception 'offer_not_found'; end if;
 if p_revision is distinct from v_offer."currentRevision" then raise exception 'revision_changed'; end if;
 select * into v_rev from core."SeptlionOfferRevision" where "offerId"=v_offer.id and "revisionNo"=p_revision;
 if not found then raise exception 'offer_not_found'; end if;
 v_test:=coalesce(v_rev.snapshot->>'testOnly','false')='true';
 if (v_test and p_mode is distinct from 'TEST') or (not v_test and p_mode is distinct from 'COMMERCIAL') then raise exception 'acceptance_mode_invalid'; end if;
 if v_offer.status<>'ACCEPTED' and (v_offer."validUntil" is null or v_offer."validUntil"<=current_timestamp) then raise exception 'offer_expired'; end if;
 v_result:=core.accept_septlion_offer(p_offer_id,p_buyer_org_id,p_user_id);v_tx:=v_result->>'transactionId';
 update core."TradeTransaction" set "testOnly"=v_test,reference=case when v_test and reference not like 'TEST-%' then 'TEST-'||reference else reference end where id=v_tx;
 update core."TradeMilestone" set label=case code when 'CONFIRMED' then 'تثبيت الطلب' when 'PREPARATION' then 'تجهيز الطلب' when 'READY_TO_SHIP' then 'جاهزية الشحن' when 'IN_TRANSIT' then 'النقل' when 'DELIVERED' then 'التسليم' else label end where "transactionId"=v_tx;
 if not coalesce((v_result->>'idempotent')::boolean,false) then
  if v_test then update core."Notification" set title='TEST — بدء محاكاة التنفيذ',body='حالة اختبار غير تجارية؛ لا تمثل بيعًا أو دفعًا أو شحنًا فعليًا.' where "entityId"=v_tx and type='TRANSACTION';end if;
  insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",after,metadata,"createdAt")
  values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'CREATE','TradeTransaction',v_tx,jsonb_build_object('status','COMMITTED'),jsonb_build_object('testOnly',v_test,'offerId',p_offer_id,'revision',p_revision),current_timestamp);
 end if;
 select reference into v_ref from core."TradeTransaction" where id=v_tx;
 return v_result||jsonb_build_object('testOnly',v_test,'reference',v_ref);
end $$;

create or replace function core.reorder_trade_transaction_v2(p_transaction_id text,p_buyer_org_id text,p_user_id text,p_quantity numeric,p_key text)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_req core."QualifiedRequirement"%rowtype;v_event core."TradeEvent"%rowtype;v_input jsonb;v_key text;v_result jsonb;v_qty numeric;v_cc int;v_scale text;v_seq int;v_now timestamp:=current_timestamp;
begin
 perform core.require_trade_actor(p_user_id,p_buyer_org_id);
 if p_key is null or p_key!~'^[a-zA-Z0-9_-]{12,100}$' or (p_quantity is not null and (p_quantity<=0 or p_quantity>1000000000 or p_quantity::text in ('NaN','Infinity','-Infinity'))) then raise exception 'invalid_reorder_input';end if;
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and "buyerOrgId"=p_buyer_org_id for update;
 if not found then raise exception 'transaction_not_found';end if;
 v_key:='reorder:'||p_transaction_id||':'||p_user_id||':'||p_key;v_input:=jsonb_build_object('quantity',p_quantity);
 select * into v_event from core."TradeEvent" where "idempotencyKey"=v_key;
 if found then if v_event.payload->'input' is distinct from v_input then raise exception 'idempotency_conflict';end if;return (v_event.payload->'result')||jsonb_build_object('idempotent',true);end if;
 if v_tx.status<>'COMPLETED' then raise exception 'reorder_not_available';end if;
 select qr.* into v_req from core."QualifiedRequirement" qr join core."SeptlionOffer" o on o."requirementId"=qr.id join core."CommercialLock" l on l."offerId"=o.id where l.id=v_tx."commercialLockId";
 if not found then raise exception 'requirement_not_found';end if;
 v_qty:=coalesce(p_quantity,v_req.quantity);
 if upper(coalesce(v_req.unit,'')) in ('FCL','CONTAINER','CONTAINERS','TEU','FEU') and v_qty is not null and trunc(v_qty)<>v_qty then raise exception 'integer_container_required';end if;
 v_cc:=case when upper(coalesce(v_req.unit,'')) in ('FCL','CONTAINER','CONTAINERS') then coalesce(v_qty,v_req."containerCount")::int else v_req."containerCount" end;
 v_scale:=case when v_cc is null then v_req."septlionScale" when v_cc<=7 then 'Micro' when v_cc<=19 then 'Nano' when v_cc<=49 then 'Zepto' when v_cc<=99 then 'Yocto' when v_cc<=299 then 'Ronto' when v_cc<=999 then 'Quecto' else 'Septlion' end;
 v_result:=core.reorder_trade_transaction(p_transaction_id,p_buyer_org_id,p_user_id,p_quantity);
 update core."QualifiedRequirement" set "containerCount"=v_cc,"septlionScale"=v_scale,"targetPrice"=null,"requiredDate"=null,
  "knownFacts"=(coalesce("knownFacts",'{}'::jsonb)-'quantity'-'containerCount'-'requiredDate'-'targetPrice')||jsonb_build_object('quantity',v_qty,'containerCount',v_cc,'testOnly',v_tx."testOnly"),
  "sourceContext"=coalesce("sourceContext",'{}'::jsonb)||jsonb_build_object('reorderOf',p_transaction_id,'testOnly',v_tx."testOnly") where id=v_result->>'id';
 update core."RFQ" set "requestedDate"=null where id=v_result->>'rfqId';
 update core."RFQItem" set "targetPrice"=null where "rfqId"=v_result->>'rfqId';
 v_result:=v_result||jsonb_build_object('testOnly',v_tx."testOnly",'idempotent',false);
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=p_transaction_id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,p_transaction_id,v_seq,'REORDER_CREATED','BUYER',p_buyer_org_id,p_user_id,v_now,jsonb_build_object('input',v_input,'result',v_result,'testOnly',v_tx."testOnly"),v_key,v_now);
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",metadata,"createdAt") values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'RFQ_CREATED','RFQ',v_result->>'rfqId',jsonb_build_object('reorderOf',p_transaction_id,'testOnly',v_tx."testOnly"),v_now);
 return v_result;
end $$;

create or replace function core.prepare_trade_document(p_transaction_id text,p_org_id text,p_user_id text,p_file_name text,p_mime text,p_size bigint,p_sha text,p_kind text,p_visibility boolean,p_key text)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_doc core."CommercialDocument"%rowtype;v_key text;v_id text:=gen_random_uuid()::text;v_extension text;v_now timestamp:=current_timestamp;
begin
 perform core.require_trade_actor(p_user_id,p_org_id,p_org_id='septlion-operator');
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and ("buyerOrgId"=p_org_id or ("supplierOrgId"='septlion-operator' and p_org_id='septlion-operator'));
 if not found then raise exception 'transaction_not_found';end if;
 if p_size is null or p_size not between 1 and 10485760 or p_sha is null or p_sha!~'^[a-f0-9]{64}$' or p_key is null or p_key!~'^[a-zA-Z0-9_-]{12,100}$' or p_visibility is null then raise exception 'invalid_document_input';end if;
 if p_file_name is null or length(p_file_name) not between 1 and 180 or p_file_name~'[[:cntrl:]/\\]' or p_kind is null or p_kind not in ('INVOICE','PACKING_LIST','BILL_OF_LADING','QUALITY_REPORT','DELIVERY_PROOF','OTHER') then raise exception 'invalid_document_input';end if;
 v_extension:=case p_mime when 'application/pdf' then 'pdf' when 'image/png' then 'png' when 'image/jpeg' then 'jpg' else null end;
 if v_extension is null then raise exception 'invalid_document_input';end if;
 v_key:='document:'||p_user_id||':'||p_key;
 perform pg_advisory_xact_lock(hashtextextended(v_key,0));
 select * into v_doc from core."CommercialDocument" where "idempotencyKey"=v_key;
 if found then
  if v_doc."entityId" is distinct from p_transaction_id or v_doc."organizationId" is distinct from p_org_id or v_doc."fileName" is distinct from p_file_name or v_doc."mimeType" is distinct from p_mime or v_doc."byteSize" is distinct from p_size or v_doc.sha256 is distinct from p_sha or v_doc.kind is distinct from p_kind or v_doc."visibilityToCounterparty" is distinct from p_visibility then raise exception 'idempotency_conflict';end if;
  if v_doc.status not in ('PENDING','READY') then raise exception 'document_not_available';end if;
  return jsonb_build_object('id',v_doc.id,'storageKey',v_doc."storageKey",'status',v_doc.status,'idempotent',true);
 end if;
 insert into core."CommercialDocument"(id,"organizationId","uploadedById","entityType","entityId","fileName","mimeType","byteSize","storageKey",sha256,status,"visibilityToCounterparty",kind,"idempotencyKey","createdAt","updatedAt")
 values(v_id,p_org_id,p_user_id,'TRANSACTION',p_transaction_id,p_file_name,p_mime,p_size,'transactions/'||p_transaction_id||'/'||v_id||'.'||v_extension,p_sha,'PENDING',p_visibility,p_kind,v_key,v_now,v_now);
 return jsonb_build_object('id',v_id,'storageKey','transactions/'||p_transaction_id||'/'||v_id||'.'||v_extension,'status','PENDING','idempotent',false);
end $$;

create or replace function core.finalize_trade_document(p_document_id text,p_org_id text,p_user_id text,p_valid boolean)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_doc core."CommercialDocument"%rowtype;v_tx core."TradeTransaction"%rowtype;v_seq int;v_now timestamp:=current_timestamp;
begin
 perform core.require_trade_actor(p_user_id,p_org_id,p_org_id='septlion-operator');
 -- Always lock transaction before document: stage/proof reads follow the same
 -- transaction ordering, avoiding a race with document completion.
 select t.* into v_tx from core."TradeTransaction" t join core."CommercialDocument" d on d."entityId"=t.id and d."entityType"='TRANSACTION'
 where d.id=p_document_id and d."organizationId"=p_org_id and d."uploadedById"=p_user_id and (t."buyerOrgId"=p_org_id or (t."supplierOrgId"='septlion-operator' and p_org_id='septlion-operator')) for update of t;
 if not found then raise exception 'document_not_found';end if;
 select * into v_doc from core."CommercialDocument" where id=p_document_id for update;
 if v_doc.status='READY' then return jsonb_build_object('id',v_doc.id,'status','READY','idempotent',true);end if;
 if v_doc.status<>'PENDING' or p_valid is null then raise exception 'document_not_available';end if;
 update core."CommercialDocument" set status=case when p_valid then 'READY'::core."DocumentStatus" else 'QUARANTINED'::core."DocumentStatus" end,"updatedAt"=v_now where id=p_document_id;
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",metadata,"createdAt") values(gen_random_uuid()::text,p_org_id,p_user_id,'DOCUMENT_UPLOADED','CommercialDocument',p_document_id,jsonb_build_object('transactionId',v_tx.id,'sha256',v_doc.sha256,'byteSize',v_doc."byteSize",'valid',p_valid,'testOnly',v_tx."testOnly"),v_now);
 if p_valid then
  select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=v_tx.id;
  insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,v_tx.id,v_seq,'DOCUMENT_READY',case when v_doc."visibilityToCounterparty" then 'BUYER'::core."TradeEventVisibility" else 'INTERNAL'::core."TradeEventVisibility" end,p_org_id,p_user_id,v_now,jsonb_build_object('documentId',v_doc.id,'fileName',v_doc."fileName",'kind',v_doc.kind,'testOnly',v_tx."testOnly"),'document-ready:'||v_doc.id,v_now);
 end if;
 return jsonb_build_object('id',v_doc.id,'status',case when p_valid then 'READY' else 'QUARANTINED' end,'idempotent',false);
end $$;

create or replace function core.platform_health_snapshot_v2()
returns jsonb language sql security definer set search_path=core,pg_catalog as $$
 select core.platform_health_snapshot()||jsonb_build_object(
 'requirements',(select count(*) from core."QualifiedRequirement" where product!~*'^TEST([[:space:]—-]|$)'),
 'openRfqs',(select count(*) from core."RFQ" r join core."QualifiedRequirement" q on q.id=r."requirementId" where r.status in ('OPEN','QUOTED','NEGOTIATING') and q.product!~*'^TEST([[:space:]—-]|$)'),
 'offers',(select count(*) from core."SeptlionOffer" o join core."QualifiedRequirement" q on q.id=o."requirementId" where q.product!~*'^TEST([[:space:]—-]|$)'),
 'activeTransactions',(select count(*) from core."TradeTransaction" where status<>'COMPLETED' and not "testOnly"),
 'completedTransactions',(select count(*) from core."TradeTransaction" where status='COMPLETED' and not "testOnly"),
 'openClaims',(select count(*) from core."TradeClaim" c join core."TradeTransaction" t on t.id=c."transactionId" where c.status in ('OPEN','UNDER_REVIEW') and not t."testOnly"),
 'testTransactions',(select count(*) from core."TradeTransaction" where "testOnly"));
$$;


create or replace function core.advance_trade_transaction_v2(p_transaction_id text,p_status text,p_milestone_code text,p_user_id text,p_expected_version integer,p_key text,p_note text)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_event core."TradeEvent"%rowtype;v_key text;v_input jsonb;v_expected text;v_code text;v_status core."TradeTransactionStatus";v_result jsonb;v_seq int;v_now timestamp:=current_timestamp;
begin
 perform core.require_trade_actor(p_user_id,'septlion-operator',true);
 if p_key is null or p_key!~'^[a-zA-Z0-9_-]{12,100}$' or length(btrim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'invalid_execution_input'; end if;
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and "supplierOrgId"='septlion-operator' for update;
 if not found then raise exception 'transaction_not_found'; end if;
 v_key:='advance:'||p_transaction_id||':'||p_user_id||':'||p_key;
 v_input:=jsonb_build_object('status',p_status,'milestone',p_milestone_code,'note',btrim(p_note),'expectedVersion',p_expected_version);
 select * into v_event from core."TradeEvent" where "idempotencyKey"=v_key;
 if found then if v_event.payload->'input' is distinct from v_input then raise exception 'idempotency_conflict'; end if;return (v_event.payload->'result')||jsonb_build_object('idempotent',true);end if;
 if p_expected_version is distinct from v_tx.version then raise exception 'stale_transaction'; end if;
 v_expected:=case v_tx.status when 'COMMITTED' then 'IN_EXECUTION' when 'IN_EXECUTION' then 'READY_TO_SHIP' when 'READY_TO_SHIP' then 'SHIPPED' when 'SHIPPED' then 'IN_TRANSIT' when 'IN_TRANSIT' then 'DELIVERED' else null end;
 v_code:=case v_tx.status when 'COMMITTED' then 'PREPARATION' when 'IN_EXECUTION' then 'PREPARATION' when 'READY_TO_SHIP' then 'READY_TO_SHIP' when 'SHIPPED' then 'IN_TRANSIT' when 'IN_TRANSIT' then 'DELIVERED' else null end;
 if v_expected is null or p_status is distinct from v_expected then raise exception 'invalid_status_transition'; end if;
 if p_milestone_code is distinct from v_code or not exists(select 1 from core."TradeMilestone" where "transactionId"=p_transaction_id and code=v_code) then raise exception 'milestone_mismatch';end if;
 if not v_tx."testOnly" and p_status in ('SHIPPED','DELIVERED') and not exists(select 1 from core."CommercialDocument" where "entityType"='TRANSACTION' and "entityId"=p_transaction_id and status='READY' and "visibilityToCounterparty" and kind=case p_status when 'SHIPPED' then 'BILL_OF_LADING' else 'DELIVERY_PROOF' end) then if p_status='SHIPPED' then raise exception 'shipping_evidence_required';else raise exception 'delivery_evidence_required';end if;end if;
 v_status:=case when p_status='DELIVERED' then 'RECEIPT_REVIEW'::core."TradeTransactionStatus" else p_status::core."TradeTransactionStatus" end;
 update core."TradeTransaction" set status=v_status,version=version+1,"updatedAt"=v_now where id=p_transaction_id;
 if p_status='IN_EXECUTION' then
  update core."TradeMilestone" set status='IN_PROGRESS',"startedAt"=coalesce("startedAt",v_now),"updatedAt"=v_now where "transactionId"=p_transaction_id and code='PREPARATION';
 elsif p_status in ('READY_TO_SHIP','SHIPPED','DELIVERED') then
  update core."TradeMilestone" set status='COMPLETED',"startedAt"=coalesce("startedAt",v_now),"completedAt"=v_now,evidence=jsonb_build_object('note',btrim(p_note),'testOnly',v_tx."testOnly"),"updatedAt"=v_now where "transactionId"=p_transaction_id and code=v_code;
  if p_status='READY_TO_SHIP' then update core."TradeMilestone" set status='IN_PROGRESS',"startedAt"=v_now,"updatedAt"=v_now where "transactionId"=p_transaction_id and code='READY_TO_SHIP';end if;
  if p_status='SHIPPED' then update core."TradeMilestone" set status='IN_PROGRESS',"startedAt"=v_now,"updatedAt"=v_now where "transactionId"=p_transaction_id and code='IN_TRANSIT';end if;
  if p_status='DELIVERED' then update core."TradeMilestone" set status='COMPLETED',"completedAt"=v_now,"updatedAt"=v_now where "transactionId"=p_transaction_id and code='IN_TRANSIT';end if;
 end if;
 v_result:=jsonb_build_object('transactionId',p_transaction_id,'status',v_status,'version',v_tx.version+1,'testOnly',v_tx."testOnly",'idempotent',false);
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=p_transaction_id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt")
 values(gen_random_uuid()::text,p_transaction_id,v_seq,'STATUS_CHANGED','BUYER','septlion-operator',p_user_id,v_now,jsonb_build_object('input',v_input,'result',v_result,'testOnly',v_tx."testOnly"),v_key,v_now);
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",before,after,metadata,"createdAt")
 values(gen_random_uuid()::text,'septlion-operator',p_user_id,'STATUS_CHANGE','TradeTransaction',p_transaction_id,jsonb_build_object('status',v_tx.status,'version',v_tx.version),v_result,jsonb_build_object('note',btrim(p_note),'testOnly',v_tx."testOnly"),v_now);
 insert into core."Notification"(id,"organizationId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,v_tx."buyerOrgId",'TRANSACTION',case when v_tx."testOnly" then 'TEST — تحديث المحاكاة' else 'تحديث تنفيذ الطلب' end,btrim(p_note),'TRANSACTION',p_transaction_id,v_now);
 return v_result;
end $$;

create or replace function core.accept_trade_receipt_v2(p_transaction_id text,p_buyer_org_id text,p_user_id text,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_now timestamp:=current_timestamp;v_seq int;v_memory text;
begin
 perform core.require_trade_actor(p_user_id,p_buyer_org_id);
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and "buyerOrgId"=p_buyer_org_id for update;
 if not found then raise exception 'transaction_not_found';end if;
 if v_tx.status='COMPLETED' and exists(select 1 from core."TradeReceipt" where "transactionId"=p_transaction_id and status='ACCEPTED') then return jsonb_build_object('transactionId',p_transaction_id,'status','COMPLETED','idempotent',true,'testOnly',v_tx."testOnly");end if;
 if v_tx.status not in ('DELIVERED','RECEIPT_REVIEW') then raise exception 'receipt_not_available';end if;
 if p_expected_version is distinct from v_tx.version then raise exception 'stale_transaction';end if;
 if exists(select 1 from core."TradeClaim" where "transactionId"=p_transaction_id and status in ('OPEN','UNDER_REVIEW')) then raise exception 'claim_pending';end if;
 update core."TradeReceipt" set status='ACCEPTED',"confirmedById"=p_user_id,"confirmedAt"=v_now,"updatedAt"=v_now where "transactionId"=p_transaction_id;
 if not found then raise exception 'receipt_not_found';end if;
 update core."TradeTransaction" set status='COMPLETED',version=version+1,"updatedAt"=v_now where id=p_transaction_id;
 v_memory:=core.complete_trade_memory(p_transaction_id);
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=p_transaction_id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,p_transaction_id,v_seq,'RECEIPT_ACCEPTED','BUYER',p_buyer_org_id,p_user_id,v_now,jsonb_build_object('testOnly',v_tx."testOnly",'tradeMemoryId',v_memory),'receipt:'||p_transaction_id,v_now);
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",after,metadata,"createdAt") values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'STATUS_CHANGE','TradeTransaction',p_transaction_id,jsonb_build_object('status','COMPLETED'),jsonb_build_object('testOnly',v_tx."testOnly"),v_now);
 return jsonb_build_object('transactionId',p_transaction_id,'status','COMPLETED','idempotent',false,'testOnly',v_tx."testOnly");
end $$;

create or replace function core.open_trade_claim_v2(p_transaction_id text,p_buyer_org_id text,p_user_id text,p_description text,p_expected_version integer,p_key text)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_event core."TradeEvent"%rowtype;v_key text;v_result jsonb;v_seq int;v_now timestamp:=current_timestamp;
begin
 perform core.require_trade_actor(p_user_id,p_buyer_org_id);
 if length(btrim(coalesce(p_description,''))) not between 5 and 2000 or p_key is null or p_key!~'^[a-zA-Z0-9_-]{12,100}$' then raise exception 'invalid_claim_input';end if;
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and "buyerOrgId"=p_buyer_org_id for update;
 if not found then raise exception 'transaction_not_found';end if;
 v_key:='claim:'||p_transaction_id||':'||p_user_id||':'||p_key;
 select * into v_event from core."TradeEvent" where "idempotencyKey"=v_key;
 if found then if v_event.payload->>'description' is distinct from btrim(p_description) then raise exception 'idempotency_conflict';end if;return (v_event.payload->'result')||jsonb_build_object('idempotent',true);end if;
 if v_tx.status not in ('DELIVERED','RECEIPT_REVIEW') then raise exception 'claim_not_available';end if;
 if p_expected_version is distinct from v_tx.version then raise exception 'stale_transaction';end if;
 if exists(select 1 from core."TradeClaim" where "transactionId"=p_transaction_id and status in ('OPEN','UNDER_REVIEW')) then raise exception 'claim_already_open';end if;
 v_result:=core.open_trade_claim(p_transaction_id,p_buyer_org_id,p_user_id,btrim(p_description));
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=p_transaction_id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,p_transaction_id,v_seq,'CLAIM_OPENED','BUYER',p_buyer_org_id,p_user_id,v_now,jsonb_build_object('description',btrim(p_description),'result',v_result,'testOnly',v_tx."testOnly"),v_key,v_now);
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",after,metadata,"createdAt") values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'CREATE','TradeClaim',v_result->>'claimId',jsonb_build_object('status','OPEN'),jsonb_build_object('transactionId',p_transaction_id,'testOnly',v_tx."testOnly"),v_now);
 return v_result||jsonb_build_object('idempotent',false,'testOnly',v_tx."testOnly");
end $$;

create or replace function core.resolve_trade_claim_v2(p_transaction_id text,p_claim_id text,p_user_id text,p_note text,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_claim core."TradeClaim"%rowtype;v_seq int;v_now timestamp:=current_timestamp;
begin
 perform core.require_trade_actor(p_user_id,'septlion-operator',true);
 if length(btrim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'resolution_required';end if;
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and "supplierOrgId"='septlion-operator' for update;
 if not found then raise exception 'transaction_not_found';end if;
 select * into v_claim from core."TradeClaim" where id=p_claim_id and "transactionId"=p_transaction_id for update;
 if not found then raise exception 'claim_not_found';end if;
 if v_claim.status='RESOLVED' then if v_claim.resolution->>'note' is distinct from btrim(p_note) then raise exception 'idempotency_conflict';end if;return jsonb_build_object('claimId',p_claim_id,'status','RESOLVED','idempotent',true);end if;
 if v_tx.status<>'CLAIM_OPEN' or v_claim.status not in ('OPEN','UNDER_REVIEW') then raise exception 'claim_not_available';end if;
 if p_expected_version is distinct from v_tx.version then raise exception 'stale_transaction';end if;
 update core."TradeClaim" set status='RESOLVED',resolution=jsonb_build_object('note',btrim(p_note),'testOnly',v_tx."testOnly"),"resolvedById"=p_user_id,"resolvedAt"=v_now,"updatedAt"=v_now where id=p_claim_id;
 if not exists(select 1 from core."TradeClaim" where "transactionId"=p_transaction_id and status in ('OPEN','UNDER_REVIEW')) then
  update core."TradeTransaction" set status='RECEIPT_REVIEW',version=version+1,"updatedAt"=v_now where id=p_transaction_id;
  update core."TradeReceipt" set status='PENDING',"updatedAt"=v_now where "transactionId"=p_transaction_id;
 end if;
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=p_transaction_id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,p_transaction_id,v_seq,'CLAIM_RESOLVED','BUYER','septlion-operator',p_user_id,v_now,jsonb_build_object('claimId',p_claim_id,'note',btrim(p_note),'testOnly',v_tx."testOnly"),'resolve:'||p_claim_id,v_now);
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",after,metadata,"createdAt") values(gen_random_uuid()::text,'septlion-operator',p_user_id,'UPDATE','TradeClaim',p_claim_id,jsonb_build_object('status','RESOLVED'),jsonb_build_object('transactionId',p_transaction_id,'note',btrim(p_note),'testOnly',v_tx."testOnly"),v_now);
 return jsonb_build_object('claimId',p_claim_id,'status','RESOLVED','idempotent',false);
end $$;

grant select on core."TradeClaim" to service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='core' and p.proname in ('require_trade_actor','accept_trade_offer_v2','advance_trade_transaction_v2','accept_trade_receipt_v2','open_trade_claim_v2','resolve_trade_claim_v2','reorder_trade_transaction_v2','prepare_trade_document','finalize_trade_document','platform_health_snapshot_v2') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
