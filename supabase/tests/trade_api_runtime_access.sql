-- Run with the migration owner; no production data is changed.
BEGIN;
DO $verify$
DECLARE
  target text;
  expected_reads text[] := ARRAY[
    'User','Membership','Organization','QualifiedRequirement','RFQ',
    'SeptlionOffer','CommercialLock','TradeTransaction','SeptlionOfferRevision',
    'DemandSignal','Opportunity','SupplyCandidate','OutboxEvent','HumanApproval',
    'TradeMilestone','TradeReceipt','TradeEvent','MaritimeRFQ',
    'CommercialDocument','Notification','TradeClaim'
  ];
  expected_inserts text[] := ARRAY['User','Membership','Organization','SupplyCandidate','MaritimeRFQ'];
BEGIN
  IF NOT has_schema_privilege('service_role','core','USAGE') THEN
    RAISE EXCEPTION 'Trade API runtime cannot use core';
  END IF;
  FOREACH target IN ARRAY expected_reads LOOP
    IF NOT has_table_privilege('service_role',format('core.%I',target),'SELECT') THEN
      RAISE EXCEPTION 'Missing server SELECT on %',target;
    END IF;
  END LOOP;
  FOREACH target IN ARRAY expected_inserts LOOP
    IF NOT has_table_privilege('service_role',format('core.%I',target),'INSERT') THEN
      RAISE EXCEPTION 'Missing server INSERT on %',target;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','core."OutboxEvent"','UPDATE') THEN
    RAISE EXCEPTION 'Missing server retry UPDATE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='core' AND c.relkind='r'
    AND (NOT c.relrowsecurity
      OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
  ) THEN
    RAISE EXCEPTION 'Core client isolation regression';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='core' AND p.proname IN (
      'create_buyer_requirement','issue_septlion_offer','accept_septlion_offer',
      'advance_trade_transaction','accept_trade_receipt','reorder_trade_transaction',
      'check_edge_rate_limit','complete_trade_memory','open_trade_claim','platform_health_snapshot',
      'require_trade_actor','accept_trade_offer_v2','advance_trade_transaction_v2',
      'accept_trade_receipt_v2','open_trade_claim_v2','resolve_trade_claim_v2',
      'reorder_trade_transaction_v2','prepare_trade_document','finalize_trade_document',
      'platform_health_snapshot_v2'
    ) AND (
      NOT has_function_privilege('service_role',p.oid,'EXECUTE')
      OR has_function_privilege('anon',p.oid,'EXECUTE')
      OR has_function_privilege('authenticated',p.oid,'EXECUTE')
    )
  ) THEN
    RAISE EXCEPTION 'Trade RPC grant regression';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles r,unnest(coalesce(r.rolconfig,ARRAY[]::text[])) s
    WHERE r.rolname='authenticator'
      AND split_part(s,'=',1)='pgrst.db_schemas'
      AND 'core'=ANY(string_to_array(replace(split_part(s,'=',2),' ',''),','))
  ) THEN
    RAISE EXCEPTION 'Core is not configured for the server Data API';
  END IF;
END
$verify$;
ROLLBACK;

