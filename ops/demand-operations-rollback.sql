-- Restore prior implementations; retains new audit/data tables for investigation.
CREATE OR REPLACE FUNCTION public.upsert_platform_buyer_signal(p_source text, p_source_record_id text, p_source_url text, p_buyer_name text, p_country text, p_product text, p_quantity text, p_published_at timestamp with time zone, p_description text, p_evidence jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sig_id UUID;
  sig_score INTEGER := 55;
BEGIN
  IF p_published_at >= now() - interval '7 days' THEN sig_score := sig_score + 20;
  ELSIF p_published_at >= now() - interval '30 days' THEN sig_score := sig_score + 12;
  ELSIF p_published_at >= now() - interval '60 days' THEN sig_score := sig_score + 6;
  END IF;

  IF p_quantity IS NOT NULL THEN sig_score := sig_score + 10; END IF;
  IF p_buyer_name IS NOT NULL THEN sig_score := sig_score + 5; END IF;
  sig_score := least(sig_score,90);

  INSERT INTO "DemandSignal"
    ("source","sourceRecordId","sourceUrl","type","status","stage","market","product","productKey",
     "quantity","buyerName","publishedAt","evidence","score","verification",
     "intentPageCandidate","raw","lastSeenAt")
  VALUES
    (
      p_source,p_source_record_id,p_source_url,'RFQ','RESOLVE_BUYER','BUYER_RESOLUTION',
      coalesce(nullif(p_country,''),'Unresolved market'),
      p_product,'wheat_flour',p_quantity,p_buyer_name,p_published_at,
      p_evidence || jsonb_build_object(
        'platformSignal',true,
        'buyerResolutionRequired',true,
        'description',p_description
      ),
      sig_score,'PLATFORM_BUY_SIGNAL_UNVERIFIED_BUYER',
      false,
      jsonb_build_object('description',p_description,'platform',p_source),
      now()
    )
  ON CONFLICT ("source","sourceRecordId") DO UPDATE SET
    "sourceUrl"=excluded."sourceUrl",
    "market"=excluded."market",
    "product"=excluded."product",
    "productKey"=excluded."productKey",
    "quantity"=excluded."quantity",
    "buyerName"=excluded."buyerName",
    "publishedAt"=excluded."publishedAt",
    "evidence"=excluded."evidence",
    "score"=excluded."score",
    "verification"=excluded."verification",
    "lastSeenAt"=now()
  RETURNING "id" INTO sig_id;

  INSERT INTO "DemandBuyerResolution"
    ("signalId","buyerName","country","confidence","verificationStatus","evidence")
  VALUES
    (
      sig_id,p_buyer_name,p_country,45,'PLATFORM_ACCOUNT_UNRESOLVED',
      jsonb_build_object('platform',p_source,'sourceUrl',p_source_url,'publicBuyRequest',true)
    )
  ON CONFLICT ("signalId") DO UPDATE SET
    "buyerName"=excluded."buyerName",
    "country"=excluded."country",
    "confidence"=greatest("DemandBuyerResolution"."confidence",excluded."confidence"),
    "verificationStatus"=CASE
      WHEN "DemandBuyerResolution"."verificationStatus" IN ('VERIFIED','BUYER_SELF_SUBMITTED')
        THEN "DemandBuyerResolution"."verificationStatus"
      ELSE excluded."verificationStatus"
    END,
    "evidence"=coalesce("DemandBuyerResolution"."evidence",'{}'::jsonb) || excluded."evidence",
    "updatedAt"=now();

  PERFORM public.refresh_buyer_profile_for_signal(sig_id);

  INSERT INTO "DemandOpportunityEvent"
    ("signalId","stage","eventType","note","metadata")
  VALUES
    (
      sig_id,'BUYER_RESOLUTION','PLATFORM_BUY_REQUEST_DETECTED',
      'Public B2B platform buy request detected; buyer identity/contact resolution required.',
      jsonb_build_object('platform',p_source,'sourceRecordId',p_source_record_id)
    );

  RETURN sig_id;
END;
$function$
;

SELECT cron.unschedule('septlion-demand-operations-hourly');
REVOKE EXECUTE ON FUNCTION public.run_demand_operations(integer),public.bridge_demand_to_core(uuid) FROM service_role;
REVOKE INSERT,UPDATE ON core."DemandSignal",core."QualifiedRequirement",core."Opportunity" FROM service_role;
REVOKE SELECT,INSERT,UPDATE ON core."AgentRun" FROM service_role;
REVOKE UPDATE ON core."SupplyCandidate" FROM service_role;
DROP TRIGGER IF EXISTS demand_offer_ready_guard ON public."DemandOfferBuild";
CREATE OR REPLACE FUNCTION public.refresh_demand_patterns()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected INTEGER := 0;
BEGIN
  WITH ordered AS (
    SELECT
      d."productKey",
      d."market",
      COALESCE(d."publishedAt", d."firstSeenAt") AS observed_at,
      lag(COALESCE(d."publishedAt", d."firstSeenAt")) OVER (
        PARTITION BY d."productKey", d."market"
        ORDER BY COALESCE(d."publishedAt", d."firstSeenAt")
      ) AS previous_at
    FROM "DemandSignal" d
    WHERE d."status" <> 'ARCHIVED'
      AND d."productKey" IS NOT NULL
  ),
  agg AS (
    SELECT
      "productKey",
      "market",
      count(*)::int AS signal_count,
      min(observed_at) AS first_observed,
      max(observed_at) AS last_observed,
      avg(EXTRACT(EPOCH FROM (observed_at - previous_at)) / 86400.0)
        FILTER (WHERE previous_at IS NOT NULL) AS avg_interval_days
    FROM ordered
    GROUP BY "productKey","market"
  ),
  upserted AS (
    INSERT INTO "DemandPattern"
      ("productKey","market","signalCount","firstObservedAt","lastObservedAt","avgIntervalDays",
       "predictedWindowStart","predictedWindowEnd","confidence","patternStatus","basis","updatedAt")
    SELECT
      a."productKey",
      a."market",
      a.signal_count,
      a.first_observed,
      a.last_observed,
      round(a.avg_interval_days::numeric,2),
      CASE WHEN a.signal_count >= 2 AND a.avg_interval_days IS NOT NULL
        THEN a.last_observed + make_interval(days => greatest(1, floor(a.avg_interval_days * 0.75)::int))
        ELSE NULL END,
      CASE WHEN a.signal_count >= 2 AND a.avg_interval_days IS NOT NULL
        THEN a.last_observed + make_interval(days => greatest(2, ceil(a.avg_interval_days * 1.25)::int))
        ELSE NULL END,
      CASE
        WHEN a.signal_count < 2 THEN 15
        WHEN a.signal_count = 2 THEN 45
        WHEN a.signal_count = 3 THEN 60
        WHEN a.signal_count = 4 THEN 70
        ELSE least(90, 72 + (a.signal_count - 4) * 3)
      END,
      CASE
        WHEN a.signal_count < 2 THEN 'INSUFFICIENT'
        WHEN a.signal_count < 4 THEN 'EMERGING'
        ELSE 'RECURRING'
      END,
      jsonb_build_object(
        'method','observed recurrence interval',
        'warning','This is a recurrence-window estimate from historical signal timing, not an outcome forecast.'
      ),
      now()
    FROM agg a
    ON CONFLICT ("productKey","market") DO UPDATE SET
      "signalCount"=excluded."signalCount",
      "firstObservedAt"=excluded."firstObservedAt",
      "lastObservedAt"=excluded."lastObservedAt",
      "avgIntervalDays"=excluded."avgIntervalDays",
      "predictedWindowStart"=excluded."predictedWindowStart",
      "predictedWindowEnd"=excluded."predictedWindowEnd",
      "confidence"=excluded."confidence",
      "patternStatus"=excluded."patternStatus",
      "basis"=excluded."basis",
      "updatedAt"=now()
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM upserted;

  RETURN affected;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_supplier_fit(target_signal uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d "DemandSignal"%ROWTYPE;
  s RECORD;
  fit_score INTEGER;
  fit_reasons JSONB;
  fit_gaps JSONB;
  count_candidates INTEGER := 0;
BEGIN
  SELECT * INTO d FROM "DemandSignal" WHERE "id"=target_signal;
  IF NOT FOUND THEN RETURN 0; END IF;

  DELETE FROM "DemandSupplierFit"
  WHERE "signalId"=target_signal AND "status"='CANDIDATE';

  FOR s IN
    SELECT * FROM "DemandSupplierProfile"
    WHERE "active"=true
      AND d."productKey" IS NOT NULL
      AND d."productKey" = ANY("productKeys")
  LOOP
    fit_score := LEAST(100, GREATEST(0, s."baseScore"));
    fit_reasons := jsonb_build_array('PRODUCT_MATCH');
    fit_gaps := '[]'::jsonb;

    IF d."incoterm" IS NOT NULL THEN
      IF array_length(s."incoterms",1) IS NULL OR d."incoterm" = ANY(s."incoterms") THEN
        fit_score := LEAST(100, fit_score + 10);
        fit_reasons := fit_reasons || '"INCOTERM_MATCH"'::jsonb;
      ELSE
        fit_score := GREATEST(0, fit_score - 10);
        fit_gaps := fit_gaps || '"INCOTERM_GAP"'::jsonb;
      END IF;
    END IF;

    IF d."packing" IS NOT NULL THEN
      IF array_length(s."packings",1) IS NULL OR EXISTS (
        SELECT 1 FROM unnest(s."packings") p WHERE lower(d."packing") LIKE '%'||lower(p)||'%'
      ) THEN
        fit_score := LEAST(100, fit_score + 10);
        fit_reasons := fit_reasons || '"PACKING_MATCH"'::jsonb;
      ELSE
        fit_gaps := fit_gaps || '"PACKING_UNCONFIRMED"'::jsonb;
      END IF;
    END IF;

    IF s."verificationStatus"='SEPTLION_VERIFIED' THEN
      fit_score := LEAST(100, fit_score + 15);
      fit_reasons := fit_reasons || '"SEPTLION_VERIFIED"'::jsonb;
    ELSIF s."verificationStatus"='SOURCE_VERIFIED' THEN
      fit_score := LEAST(100, fit_score + 8);
      fit_reasons := fit_reasons || '"SOURCE_VERIFIED"'::jsonb;
    ELSE
      fit_gaps := fit_gaps || '"SUPPLIER_NOT_VERIFIED"'::jsonb;
    END IF;

    IF array_length(s."markets",1) IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM unnest(s."markets") m WHERE lower(d."market") LIKE '%'||lower(m)||'%'
      ) THEN
        fit_score := LEAST(100, fit_score + 10);
        fit_reasons := fit_reasons || '"MARKET_MATCH"'::jsonb;
      ELSE
        fit_gaps := fit_gaps || '"MARKET_UNCONFIRMED"'::jsonb;
      END IF;
    END IF;

    INSERT INTO "DemandSupplierFit"
      ("signalId","supplierId","status","score","reasons","gaps")
    VALUES
      (target_signal,s."id",'CANDIDATE',fit_score,fit_reasons,fit_gaps)
    ON CONFLICT ("signalId","supplierId") DO UPDATE SET
      "score"=excluded."score",
      "reasons"=excluded."reasons",
      "gaps"=excluded."gaps",
      "updatedAt"=now();

    count_candidates := count_candidates + 1;
  END LOOP;

  UPDATE "DemandOfferBuild"
  SET "supplierFit"=jsonb_build_object(
        'status',CASE WHEN count_candidates>0 THEN 'CANDIDATES_FOUND' ELSE 'NO_CANDIDATES' END,
        'candidateCount',count_candidates,
        'refreshedAt',now()
      ),
      "updatedAt"=now()
  WHERE "signalId"=target_signal;

  RETURN count_candidates;
END;
$function$
;

