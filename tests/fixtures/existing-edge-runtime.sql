-- Read-only runtime function definitions; no production records or secrets.
CREATE OR REPLACE FUNCTION core.check_edge_rate_limit(p_user_id text, p_action text, p_limit integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog'
AS $function$
declare v_window timestamp(3):=date_trunc('minute',current_timestamp);v_count integer;
begin
 insert into core."EdgeRateLimit"("userId",action,"windowStart",count) values(p_user_id,p_action,v_window,1) on conflict("userId",action,"windowStart") do update set count=core."EdgeRateLimit".count+1 returning count into v_count;
 if random()<0.02 then delete from core."EdgeRateLimit" where "windowStart"<current_timestamp-interval '1 day'; end if;
 return v_count<=greatest(1,p_limit);
end $function$;
CREATE OR REPLACE FUNCTION core.platform_health_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog', 'public'
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION core.platform_health_snapshot_v2()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog'
AS $function$
 select core.platform_health_snapshot()||jsonb_build_object(
 'requirements',(select count(*) from core."QualifiedRequirement" where product!~*'^TEST([[:space:]—-]|$)'),
 'openRfqs',(select count(*) from core."RFQ" r join core."QualifiedRequirement" q on q.id=r."requirementId" where r.status in ('OPEN','QUOTED','NEGOTIATING') and q.product!~*'^TEST([[:space:]—-]|$)'),
 'offers',(select count(*) from core."SeptlionOffer" o join core."QualifiedRequirement" q on q.id=o."requirementId" where q.product!~*'^TEST([[:space:]—-]|$)'),
 'activeTransactions',(select count(*) from core."TradeTransaction" where status<>'COMPLETED' and not "testOnly"),
 'completedTransactions',(select count(*) from core."TradeTransaction" where status='COMPLETED' and not "testOnly"),
 'openClaims',(select count(*) from core."TradeClaim" c join core."TradeTransaction" t on t.id=c."transactionId" where c.status in ('OPEN','UNDER_REVIEW') and not t."testOnly"),
 'testTransactions',(select count(*) from core."TradeTransaction" where "testOnly"));
$function$;
