create table if not exists core."PlatformMetric"(
 id text primary key default gen_random_uuid()::text,
 name text not null,
 value numeric not null default 0,
 dimensions jsonb not null default '{}'::jsonb,
 "recordedAt" timestamp(3) not null default current_timestamp
);
create index if not exists "PlatformMetric_name_recordedAt_idx" on core."PlatformMetric"(name,"recordedAt" desc);
alter table core."PlatformMetric" enable row level security;
revoke all on core."PlatformMetric" from public,anon,authenticated;

create or replace function core.complete_trade_memory(p_transaction_id text)
returns text language plpgsql security definer set search_path=core,pg_catalog,public as $$
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
end $$;
revoke all on function core.complete_trade_memory(text) from public,anon,authenticated; grant execute on function core.complete_trade_memory(text) to service_role;

create or replace function core.platform_health_snapshot()
returns jsonb language sql security definer set search_path=core,pg_catalog,public as $$
 select jsonb_build_object(
 'requirements',(select count(*) from core."QualifiedRequirement"),
 'openRfqs',(select count(*) from core."RFQ" where status in ('OPEN','QUOTED','NEGOTIATING')),
 'offers',(select count(*) from core."SeptlionOffer"),
 'activeTransactions',(select count(*) from core."TradeTransaction" where status<>'COMPLETED'),
 'completedTransactions',(select count(*) from core."TradeTransaction" where status='COMPLETED'),
 'openClaims',(select count(*) from core."TradeClaim" where status='OPEN'),
 'demandSignals',(select count(*) from core."DemandSignal"),
 'opportunities',(select count(*) from core."Opportunity" where status not in ('LOST','ARCHIVED')),
 'supplyCandidates',(select count(*) from core."SupplyCandidate"),
 'pendingOutbox',(select count(*) from core."OutboxEvent" where status='PENDING'),
 'failedOutbox',(select count(*) from core."OutboxEvent" where status='FAILED'),
 'generatedAt',current_timestamp);
$$;
revoke all on function core.platform_health_snapshot() from public,anon,authenticated; grant execute on function core.platform_health_snapshot() to service_role;
