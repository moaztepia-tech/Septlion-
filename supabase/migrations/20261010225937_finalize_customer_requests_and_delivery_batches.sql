-- Additive, service-only RPCs. Existing single-delivery trades retain their lifecycle.
create table core."RequirementSubmission" (
 "organizationId" text not null references core."Organization"(id),
 "requestKey" text not null, "inputHash" text not null, result jsonb not null,
 "createdAt" timestamp(3) not null default current_timestamp,
 primary key ("organizationId","requestKey")
);
alter table core."RequirementSubmission" enable row level security;
revoke all on core."RequirementSubmission" from public,anon,authenticated;
grant all on core."RequirementSubmission" to service_role;

create or replace function core.create_buyer_requirement_v2(p_org_id text,p_user_id text,p_input jsonb,p_key text)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_hash text:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');v_old core."RequirementSubmission"%rowtype;v_result jsonb;
begin
 perform core.require_trade_actor(p_user_id,p_org_id);
 if p_key is null or p_key !~ '^[a-zA-Z0-9-]{8,100}$' then raise exception 'request_key_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org_id||':'||p_key,0));
 select * into v_old from core."RequirementSubmission" where "organizationId"=p_org_id and "requestKey"=p_key;
 if found then
  if v_old."inputHash"<>v_hash then raise exception 'idempotency_conflict';end if;
  return v_old.result||jsonb_build_object('idempotent',true);
 end if;
 if not (coalesce(p_input->>'quantityNumber','') ~ '^\d+(\.\d+)?$') or (p_input->>'quantityNumber')::numeric<=0 or (p_input->>'quantityNumber')::numeric>1e9 then raise exception 'quantity_invalid';end if;
 v_result:=core.create_buyer_requirement(p_org_id,p_user_id,p_input);
 insert into core."RequirementSubmission"("organizationId","requestKey","inputHash",result) values(p_org_id,p_key,v_hash,v_result);
 return v_result||jsonb_build_object('idempotent',false);
end $$;

create table core."TradeSupplyBatch" (
 id text primary key default gen_random_uuid()::text,
 "transactionId" text not null references core."TradeTransaction"(id) on delete cascade,
 sequence integer not null check(sequence between 1 and 24),
 quantity numeric not null check(quantity>0 and quantity<=1e9), unit text not null check(unit in ('FCL','MT','KG')),
 "plannedDate" date not null, notes text not null default '',
 status text not null default 'WAITING' check(status in ('WAITING','IN_EXECUTION','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','ACCEPTED','CLAIM_OPEN')),
 version integer not null default 1,
 "claimNote" text, "claimResolution" text, "receivedAt" timestamp(3),
 "shippingDocumentId" text references core."CommercialDocument"(id),
 "deliveryDocumentId" text references core."CommercialDocument"(id),
 "updatedAt" timestamp(3) not null default current_timestamp,
 unique("transactionId",sequence),
 check(unit<>'FCL' or quantity=trunc(quantity))
);
create index on core."TradeSupplyBatch"("shippingDocumentId");
create index on core."TradeSupplyBatch"("deliveryDocumentId");
alter table core."TradeSupplyBatch" enable row level security;
revoke all on core."TradeSupplyBatch" from public,anon,authenticated;
grant all on core."TradeSupplyBatch" to service_role;

create or replace function core.ensure_trade_supply_batches(p_transaction_id text,p_org_id text,p_user_id text)
returns void language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_plan jsonb;v_items jsonb;v_b jsonb;v_count integer;v_sequence integer:=0;v_total numeric:=0;v_expected numeric;v_unit text;v_previous date;v_date date;
begin
 perform core.require_trade_actor(p_user_id,p_org_id,p_org_id='septlion-operator');
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and ("buyerOrgId"=p_org_id or "supplierOrgId"=p_org_id) for update;
 if not found then raise exception 'transaction_not_found';end if;
 if exists(select 1 from core."TradeSupplyBatch" where "transactionId"=v_tx.id) then return;end if;
 select snapshot->'terms'->'supplyPlan',snapshot->'items' into v_plan,v_items from core."CommercialLock" where id=v_tx."commercialLockId";
 if v_plan is null or v_plan='null'::jsonb then return;end if;
 if jsonb_typeof(v_plan->'batches')<>'array' then raise exception 'supply_plan_invalid';end if;
 v_count:=jsonb_array_length(v_plan->'batches');
 if v_count<2 or v_count>24 or v_plan->>'version'<>'1' or v_plan->>'automaticPurchaseOrders'<>'false' then raise exception 'supply_plan_invalid';end if;
 v_unit:=v_plan->'batches'->0->>'unit';
 for v_b in select value from jsonb_array_elements(v_plan->'batches') loop
  v_sequence:=v_sequence+1;v_date:=(v_b->>'plannedDate')::date;
  if v_b->>'unit' is distinct from v_unit or (v_previous is not null and v_date<v_previous) then raise exception 'supply_plan_invalid';end if;
  v_previous:=v_date;v_total:=v_total+(v_b->>'quantity')::numeric;
  insert into core."TradeSupplyBatch"("transactionId",sequence,quantity,unit,"plannedDate",notes) values(v_tx.id,v_sequence,(v_b->>'quantity')::numeric,v_unit,v_date,coalesce(v_b->>'notes',''));
 end loop;
 select sum((value->>'quantity')::numeric) into v_expected from jsonb_array_elements(v_items);
 if v_expected is null or exists(select 1 from jsonb_array_elements(v_items) where value->>'unit' is distinct from v_unit) or abs(v_total-v_expected)>0.0000001*greatest(1,v_expected) then raise exception 'supply_plan_quantity_mismatch';end if;
end $$;

create or replace function core.accept_trade_offer_v3(p_offer_id text,p_buyer_org_id text,p_user_id text,p_revision integer,p_mode text)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_result jsonb;
begin
 v_result:=core.accept_trade_offer_v2(p_offer_id,p_buyer_org_id,p_user_id,p_revision,p_mode);
 perform core.ensure_trade_supply_batches(v_result->>'transactionId',p_buyer_org_id,p_user_id);
 return v_result;
end $$;

create or replace function core.change_trade_supply_batch(p_transaction_id text,p_batch_id text,p_org_id text,p_user_id text,p_action text,p_version integer,p_note text,p_key text,p_document_id text default null)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_tx core."TradeTransaction"%rowtype;v_b core."TradeSupplyBatch"%rowtype;v_old jsonb;v_input jsonb;v_next text;v_rank int;v_seq int;v_result jsonb;v_now timestamp(3):=current_timestamp;v_event_key text:='batch:'||p_transaction_id||':'||p_key;v_op boolean:=p_action in ('IN_EXECUTION','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','CLAIM_RESOLVED');
begin
 perform core.require_trade_actor(p_user_id,p_org_id,v_op);
 select * into v_tx from core."TradeTransaction" where id=p_transaction_id and case when v_op then "supplierOrgId"=p_org_id else "buyerOrgId"=p_org_id end for update;
 if not found then raise exception 'transaction_not_found';end if;
 if p_key is null or p_key !~ '^[a-zA-Z0-9-]{8,100}$' or length(btrim(p_note))<5 or length(p_note)>2000 then raise exception 'batch_input_invalid';end if;
 v_input:=jsonb_build_object('batchId',p_batch_id,'action',p_action,'note',btrim(p_note),'documentId',p_document_id,'actorOrgId',p_org_id);
 select payload into v_old from core."TradeEvent" where "idempotencyKey"=v_event_key;
 if found then if v_old->'batchInput' is distinct from v_input then raise exception 'idempotency_conflict';end if;return v_old->'result'||jsonb_build_object('idempotent',true);end if;
 if v_tx.status in ('COMPLETED','CANCELLED') then raise exception 'invalid_status_transition';end if;
 select * into v_b from core."TradeSupplyBatch" where id=p_batch_id and "transactionId"=v_tx.id for update;
 if not found then raise exception 'batch_not_found';end if;
 if v_b.version is distinct from p_version then raise exception 'stale_transaction';end if;
 v_next:=case v_b.status when 'WAITING' then 'IN_EXECUTION' when 'IN_EXECUTION' then 'READY_TO_SHIP' when 'READY_TO_SHIP' then 'SHIPPED' when 'SHIPPED' then 'IN_TRANSIT' when 'IN_TRANSIT' then 'DELIVERED' end;
 if not ((v_op and p_action=v_next) or (not v_op and v_b.status='DELIVERED' and p_action in ('ACCEPTED','CLAIM_OPEN')) or (v_op and v_b.status='CLAIM_OPEN' and p_action='CLAIM_RESOLVED')) then raise exception 'invalid_status_transition';end if;
 if not v_tx."testOnly" and p_action in ('SHIPPED','DELIVERED') and not exists(select 1 from core."CommercialDocument" where id=p_document_id and "entityType"='TRANSACTION' and "entityId"=v_tx.id and "organizationId"=v_tx."supplierOrgId" and status='READY' and "visibilityToCounterparty" and kind=case p_action when 'SHIPPED' then 'BILL_OF_LADING' else 'DELIVERY_PROOF' end) then raise exception 'batch_evidence_required';end if;
 update core."TradeSupplyBatch" set status=case when p_action='CLAIM_RESOLVED' then 'DELIVERED' else p_action end,version=version+1,"updatedAt"=v_now,
 "claimNote"=case when p_action='CLAIM_OPEN' then btrim(p_note) else "claimNote" end,
 "claimResolution"=case when p_action='CLAIM_RESOLVED' then btrim(p_note) when p_action='CLAIM_OPEN' then null else "claimResolution" end,
 "receivedAt"=case when p_action='ACCEPTED' then v_now else "receivedAt" end,
 "shippingDocumentId"=case when p_action='SHIPPED' then nullif(p_document_id,'') else "shippingDocumentId" end,
 "deliveryDocumentId"=case when p_action='DELIVERED' then nullif(p_document_id,'') else "deliveryDocumentId" end where id=v_b.id;
 select min(case status when 'WAITING' then 0 when 'IN_EXECUTION' then 1 when 'READY_TO_SHIP' then 2 when 'SHIPPED' then 3 when 'IN_TRANSIT' then 4 when 'DELIVERED' then 5 when 'CLAIM_OPEN' then 5 else 6 end) into v_rank from core."TradeSupplyBatch" where "transactionId"=v_tx.id;
 v_next:=case when exists(select 1 from core."TradeSupplyBatch" where "transactionId"=v_tx.id and status='CLAIM_OPEN') then 'CLAIM_OPEN' else case v_rank when 0 then 'COMMITTED' when 1 then 'IN_EXECUTION' when 2 then 'READY_TO_SHIP' when 3 then 'SHIPPED' when 4 then 'IN_TRANSIT' else 'RECEIPT_REVIEW' end end;
 update core."TradeTransaction" set status=v_next::core."TradeTransactionStatus",version=version+1,"updatedAt"=v_now where id=v_tx.id;
 update core."TradeMilestone" set status=case when v_rank>=case code when 'PREPARATION' then 2 when 'READY_TO_SHIP' then 3 else 5 end then 'COMPLETED'::core."MilestoneStatus" when v_rank>=case code when 'PREPARATION' then 1 when 'READY_TO_SHIP' then 2 when 'IN_TRANSIT' then 3 else 4 end then 'IN_PROGRESS'::core."MilestoneStatus" else status end,"completedAt"=case when v_rank>=case code when 'PREPARATION' then 2 when 'READY_TO_SHIP' then 3 else 5 end then coalesce("completedAt",v_now) else "completedAt" end,"updatedAt"=v_now where "transactionId"=v_tx.id and code in ('PREPARATION','READY_TO_SHIP','IN_TRANSIT','DELIVERED');
 if v_rank=6 then perform core.accept_trade_receipt_v2(v_tx.id,v_tx."buyerOrgId",p_user_id,v_tx.version+1);v_next:='COMPLETED';end if;
 v_result:=jsonb_build_object('transactionId',v_tx.id,'batchId',v_b.id,'status',v_next,'version',v_b.version+1,'idempotent',false);
 select coalesce(max(sequence),0)+1 into v_seq from core."TradeEvent" where "transactionId"=v_tx.id;
 insert into core."TradeEvent"(id,"transactionId",sequence,type,visibility,"actorOrgId","actorUserId","occurredAt",payload,"idempotencyKey","createdAt") values(gen_random_uuid()::text,v_tx.id,v_seq,'STATUS_CHANGED','BUYER',p_org_id,p_user_id,v_now,jsonb_build_object('batchInput',v_input,'input',jsonb_build_object('note','الدفعة '||v_b.sequence||' — '||btrim(p_note)),'result',v_result,'testOnly',v_tx."testOnly"),v_event_key,v_now);
 insert into core."Notification"(id,"organizationId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,v_tx."buyerOrgId",'TRANSACTION',case when v_tx."testOnly" then 'TEST — تحديث دفعة' else 'تحديث دفعة التوريد' end,'الدفعة '||v_b.sequence||' — '||btrim(p_note),'TRANSACTION',v_tx.id,v_now);
 return v_result;
end $$;

revoke all on function core.create_buyer_requirement_v2(text,text,jsonb,text),core.ensure_trade_supply_batches(text,text,text),core.accept_trade_offer_v3(text,text,text,integer,text),core.change_trade_supply_batch(text,text,text,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function core.create_buyer_requirement_v2(text,text,jsonb,text),core.ensure_trade_supply_batches(text,text,text),core.accept_trade_offer_v3(text,text,text,integer,text),core.change_trade_supply_batch(text,text,text,text,text,integer,text,text,text) to service_role;

-- A manual reorder starts with a fresh schedule. Old delivery dates never carry over.
create or replace function core.reorder_trade_transaction_v3(p_transaction_id text,p_buyer_org_id text,p_user_id text,p_quantity numeric,p_key text)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_result jsonb;
begin
 v_result:=core.reorder_trade_transaction_v2(p_transaction_id,p_buyer_org_id,p_user_id,p_quantity,p_key);
 update core."QualifiedRequirement" set "knownFacts"=coalesce("knownFacts",'{}'::jsonb)-'supplyPlan' where id=v_result->>'id' and "organizationId"=p_buyer_org_id;
 return v_result;
end $$;
revoke all on function core.reorder_trade_transaction_v3(text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function core.reorder_trade_transaction_v3(text,text,text,numeric,text) to service_role;

create or replace function core.save_buyer_account_profile(p_org_id text,p_user_id text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_profile text;v_now timestamp(3):=current_timestamp;v_name text:=btrim(p_input->>'name');v_company text:=btrim(p_input->>'company');v_phone text:=btrim(p_input->>'whatsapp');v_email text:=nullif(btrim(p_input->>'email'),'');
begin
 perform core.require_trade_actor(p_user_id,p_org_id);
 if p_org_id='septlion-operator' then raise exception 'buyer_profile_only';end if;
 if v_name is null or length(v_name)<1 or length(v_name)>120 or v_company is null or length(v_company)<1 or length(v_company)>200 or v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' or (v_email is not null and (length(v_email)>254 or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$')) then raise exception 'profile_input_invalid';end if;
 if length(coalesce(p_input->>'country',''))>100 or length(coalesce(p_input->>'website',''))>500 or (coalesce(p_input->>'website','')<>'' and p_input->>'website' !~ '^https?://[^ ]+$') then raise exception 'profile_input_invalid';end if;
 insert into core."BuyerProfile"(id,"organizationId","canonicalName",country,website,"verificationStatus",confidence,attributes,provenance,"createdAt","updatedAt") values(gen_random_uuid()::text,p_org_id,v_company,nullif(p_input->>'country',''),nullif(p_input->>'website',''),'UNVERIFIED',0,'{}','{}',v_now,v_now)
 on conflict("organizationId") do update set "canonicalName"=excluded."canonicalName",country=excluded.country,website=excluded.website,"updatedAt"=v_now returning id into v_profile;
 insert into core."BuyerContact"(id,"buyerProfileId",name,company,whatsapp,email,"whatsappReachability","createdAt","updatedAt") values('account:'||p_user_id,v_profile,v_name,v_company,v_phone,v_email,'UNCONFIRMED',v_now,v_now)
 on conflict(id) do update set "buyerProfileId"=excluded."buyerProfileId",name=excluded.name,company=excluded.company,whatsapp=excluded.whatsapp,email=excluded.email,"whatsappReachability"=case when core."BuyerContact".whatsapp=excluded.whatsapp then core."BuyerContact"."whatsappReachability" else 'UNCONFIRMED'::core."WhatsAppReachability" end,"updatedAt"=v_now;
 update core."Organization" set name=v_company,country=nullif(p_input->>'country',''),"updatedAt"=v_now where id=p_org_id;
 update core."User" set "firstName"=v_name,"updatedAt"=v_now where id=p_user_id;
 return jsonb_build_object('profileId',v_profile,'contactId','account:'||p_user_id);
end $$;
revoke all on function core.save_buyer_account_profile(text,text,jsonb) from public,anon,authenticated;
grant execute on function core.save_buyer_account_profile(text,text,jsonb) to service_role;
