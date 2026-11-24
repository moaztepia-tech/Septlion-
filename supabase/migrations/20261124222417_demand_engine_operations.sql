-- Private, evidence-led operations. Does not publish, send messages, or approve prices.
CREATE TABLE public."DemandEngineRun" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "finishedAt" timestamptz,
  status text NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
  processed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]',
  summary jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE public."DemandAssessment" (
  "signalId" uuid PRIMARY KEY REFERENCES public."DemandSignal"(id) ON DELETE CASCADE,
  "inScope" boolean NOT NULL,
  fresh boolean NOT NULL,
  "isTest" boolean NOT NULL,
  "buyerReady" boolean NOT NULL,
  "supplierCount" integer NOT NULL DEFAULT 0,
  blockers jsonb NOT NULL DEFAULT '[]',
  "nextAction" text NOT NULL,
  "assessedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."DemandCostInput" (
  "signalId" uuid PRIMARY KEY REFERENCES public."DemandSignal"(id) ON DELETE CASCADE,
  "supplierId" uuid NOT NULL REFERENCES public."DemandSupplierProfile"(id),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  "productPerMt" numeric(18,4) NOT NULL CHECK ("productPerMt">0),
  "freightPerMt" numeric(18,4) NOT NULL CHECK ("freightPerMt">=0),
  "insurancePerMt" numeric(18,4) NOT NULL DEFAULT 0 CHECK ("insurancePerMt">=0),
  "otherPerMt" numeric(18,4) NOT NULL DEFAULT 0 CHECK ("otherPerMt">=0),
  "marginPct" numeric(8,4) NOT NULL CHECK ("marginPct">=0 AND "marginPct"<100),
  "validUntil" timestamptz NOT NULL,
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object' AND coalesce(evidence->>'sourceUrl','') ~ '^https?://'),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."DemandBuyerPattern" (
  "buyerId" uuid NOT NULL REFERENCES public."DemandBuyerProfile"(id) ON DELETE CASCADE,
  "productKey" text NOT NULL,
  market text NOT NULL,
  "observationCount" integer NOT NULL,
  "avgIntervalDays" numeric,
  "predictedWindowStart" timestamptz,
  "predictedWindowEnd" timestamptz,
  confidence integer NOT NULL,
  basis jsonb NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("buyerId","productKey",market)
);
ALTER TABLE public."DemandEngineRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DemandAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DemandCostInput" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DemandBuyerPattern" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."DemandEngineRun",public."DemandAssessment",public."DemandCostInput",public."DemandBuyerPattern" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."DemandEngineRun",public."DemandAssessment",public."DemandCostInput",public."DemandBuyerPattern" TO service_role;

CREATE FUNCTION public.demand_target_market(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT lower(trim(split_part(coalesce(value,''),' — ',1))) = ANY(ARRAY[
 'algeria','angola','benin','botswana','burkina faso','burundi','cabo verde','cameroon',
 'central african republic','chad','comoros','congo','democratic republic of congo',
 'democratic republic of the congo','republic of the congo','cote d''ivoire','côte d’ivoire',
 'côte d''ivoire','ivory coast','djibouti','egypt','equatorial guinea','eritrea','eswatini',
 'ethiopia','gabon','gambia','ghana','guinea','guinea-bissau','kenya','lesotho','liberia',
 'libya','madagascar','malawi','mali','mauritania','mauritius','morocco','mozambique',
 'namibia','niger','nigeria','rwanda','sao tome and principe','senegal','seychelles',
 'sierra leone','somalia','south africa','south sudan','sudan','tanzania','togo','tunisia',
 'uganda','zambia','zimbabwe','bahrain','iran','iraq','jordan','kuwait','lebanon','oman',
 'palestine','qatar','saudi arabia','syria','turkey','türkiye','united arab emirates','uae','yemen',
 'السودان','جنوب السودان','مصر','الصومال','السعودية','الإمارات','الامارات','قطر','اليمن',
 'الأردن','الاردن','عمان','عُمان','الكويت','البحرين','ليبيا','تشاد','كينيا','تنزانيا','بنين',
 'بورتسودان','port sudan','mombasa','مومباسا','دار السلام','dar es salaam'
 ]);
$$;

CREATE FUNCTION public.demand_is_test(target_signal uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT coalesce((SELECT raw->>'isTest'='true' FROM public."DemandSignal" WHERE id=target_signal),false)
 OR EXISTS(SELECT 1 FROM public."DemandRfqSubmission" r WHERE r."signalId"=target_signal
 AND coalesce(r.notes,'') ~* '(طلب تجريبي|اختبار|(^|[^a-z])(test|e2e|smoke)([^a-z]|$))');
$$;

-- Missing supplier attributes are unknown, never positive matches. Preserve operator selections.
CREATE OR REPLACE FUNCTION public.refresh_supplier_fit(target_signal uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE d public."DemandSignal"%ROWTYPE; s record; n integer:=0; points integer; reasons jsonb; gaps jsonb;
BEGIN
 SELECT * INTO d FROM public."DemandSignal" WHERE id=target_signal;
 IF NOT FOUND THEN RETURN 0; END IF;
 DELETE FROM public."DemandSupplierFit" f WHERE f."signalId"=target_signal AND f.status='CANDIDATE'
 AND NOT EXISTS(SELECT 1 FROM public."DemandSupplierProfile" p WHERE p.id=f."supplierId" AND p.active AND d."productKey"=ANY(p."productKeys"));
 FOR s IN SELECT * FROM public."DemandSupplierProfile" WHERE active AND d."productKey"=ANY("productKeys") LOOP
  points:=least(60,s."baseScore"); reasons:='["PRODUCT_MATCH"]'; gaps:='[]';
  IF cardinality(s.incoterms)>0 AND upper(d.incoterm)=ANY(s.incoterms) THEN
   points:=points+10; reasons:=reasons||'["INCOTERM_MATCH"]';
  ELSE gaps:=gaps||'["INCOTERM_UNCONFIRMED"]'; END IF;
  IF d.packing IS NOT NULL AND cardinality(s.packings)>0 AND EXISTS(
   SELECT 1 FROM unnest(s.packings) p WHERE lower(d.packing) LIKE '%'||lower(p)||'%') THEN
   points:=points+10; reasons:=reasons||'["PACKING_MATCH"]';
  ELSE gaps:=gaps||'["PACKING_UNCONFIRMED"]'; END IF;
  IF s."verificationStatus"='SEPTLION_VERIFIED' THEN points:=points+15; reasons:=reasons||'["SEPTLION_VERIFIED"]';
  ELSIF s."verificationStatus"='SOURCE_VERIFIED' THEN points:=points+5; reasons:=reasons||'["PUBLIC_SOURCE_ONLY"]';
   gaps:=gaps||'["COMMERCIAL_CAPABILITY_UNCONFIRMED"]';
  ELSE gaps:=gaps||'["SUPPLIER_NOT_VERIFIED"]'; END IF;
  IF cardinality(s.markets)>0 AND EXISTS(SELECT 1 FROM unnest(s.markets) m WHERE lower(d.market)=lower(m)) THEN
   points:=points+5; reasons:=reasons||'["MARKET_MATCH"]';
  ELSE gaps:=gaps||'["MARKET_UNCONFIRMED"]'; END IF;
  INSERT INTO public."DemandSupplierFit"("signalId","supplierId",score,reasons,gaps)
  VALUES(target_signal,s.id,least(100,points),reasons,gaps)
  ON CONFLICT("signalId","supplierId") DO UPDATE SET score=excluded.score,reasons=excluded.reasons,gaps=excluded.gaps,"updatedAt"=now();
  n:=n+1;
 END LOOP;
 UPDATE public."DemandOfferBuild" SET "supplierFit"=jsonb_build_object('status',CASE WHEN n>0 THEN 'CANDIDATES_FOUND' ELSE 'NO_CANDIDATES' END,'candidateCount',n,'refreshedAt',now()),"updatedAt"=now()
 WHERE "signalId"=target_signal AND status='DRAFT';
 RETURN n;
END; $$;

-- Market-wide observations are not a buyer's reorder history. Only verified buyers,
-- distinct dated observations, and at least three intervals can produce a window.
CREATE OR REPLACE FUNCTION public.refresh_demand_patterns() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE affected integer;
BEGIN
 DELETE FROM public."DemandBuyerPattern";
 WITH observations AS (
  SELECT DISTINCT b."buyerId",d."productKey",d.market,d."publishedAt"::date AS day
  FROM public."DemandBuyerSignal" b JOIN public."DemandSignal" d ON d.id=b."signalId"
  JOIN public."DemandBuyerProfile" p ON p.id=b."buyerId"
  WHERE p."verificationStatus"='VERIFIED' AND d."productKey" IS NOT NULL
   AND d."publishedAt"<=now() AND d."publishedAt">now()-interval '730 days'
   AND d.status<>'ARCHIVED' AND NOT public.demand_is_test(d.id)
 ), intervals AS (
  SELECT *,day-lag(day) OVER(PARTITION BY "buyerId","productKey",market ORDER BY day) AS gap FROM observations
 ), stats AS (
  SELECT "buyerId","productKey",market,count(*) AS n,max(day) AS latest,avg(gap) AS avg_gap,stddev_samp(gap) AS sd
  FROM intervals GROUP BY "buyerId","productKey",market
 )
 INSERT INTO public."DemandBuyerPattern"("buyerId","productKey",market,"observationCount","avgIntervalDays","predictedWindowStart","predictedWindowEnd",confidence,basis)
 SELECT "buyerId","productKey",market,n,round(avg_gap,2),
 CASE WHEN n>=4 AND avg_gap>=1 AND coalesce(sd/NULLIF(avg_gap,0),1)<=0.5 AND latest::timestamptz+make_interval(days=>ceil(avg_gap*1.5)::int)>now()
 THEN latest::timestamptz+make_interval(days=>greatest(1,floor(avg_gap*0.75)::int)) END,
 CASE WHEN n>=4 AND avg_gap>=1 AND coalesce(sd/NULLIF(avg_gap,0),1)<=0.5 AND latest::timestamptz+make_interval(days=>ceil(avg_gap*1.5)::int)>now()
 THEN latest::timestamptz+make_interval(days=>ceil(avg_gap*1.5)::int) END,
 CASE WHEN n>=4 AND avg_gap>=1 AND coalesce(sd/NULLIF(avg_gap,0),1)<=0.5 THEN least(80,40+n*5)::int ELSE 15 END,
 jsonb_build_object('method','distinct_dates_same_verified_buyer','intervalStddevDays',sd,'warning','Uncalibrated timing heuristic; not a probability or confirmed order')
 FROM stats;
 GET DIAGNOSTICS affected=ROW_COUNT;
 -- Reset all previous market-wide forecasts, including groups no longer represented.
 UPDATE public."DemandPattern" SET "predictedWindowStart"=NULL,"predictedWindowEnd"=NULL,
 "avgIntervalDays"=NULL,confidence=15,"patternStatus"='INSUFFICIENT',
 basis=jsonb_build_object('method','market_signal_volume','warning','Multiple buyers do not establish a reorder cycle'),"updatedAt"=now();
 INSERT INTO public."DemandPattern"("productKey",market,"signalCount","firstObservedAt","lastObservedAt",confidence,"patternStatus",basis)
 SELECT d."productKey",d.market,count(*),min(d."publishedAt"),max(d."publishedAt"),15,'INSUFFICIENT',
 jsonb_build_object('method','market_signal_volume','warning','See private DemandBuyerPattern for buyer-specific timing')
 FROM public."DemandSignal" d WHERE d."productKey" IS NOT NULL AND d.status<>'ARCHIVED' AND NOT public.demand_is_test(d.id)
 GROUP BY d."productKey",d.market
 ON CONFLICT("productKey",market) DO UPDATE SET "signalCount"=excluded."signalCount","firstObservedAt"=excluded."firstObservedAt","lastObservedAt"=excluded."lastObservedAt",basis=excluded.basis,"updatedAt"=now();
 RETURN affected;
END; $$;

CREATE FUNCTION public.run_demand_operations(batch_size integer DEFAULT 200) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE run_id uuid; d record; q public."DemandQualification"%ROWTYPE; br public."DemandBuyerResolution"%ROWTYPE;
 c public."DemandCostInput"%ROWTYPE; blockers jsonb; in_scope boolean; is_fresh boolean; test_signal boolean;
 buyer_ready boolean; candidates integer; action text; n integer:=0; run_errors jsonb:='[]'; src record; health text; cost numeric;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('septlion-demand-operations')) THEN RETURN '{"skipped":"already_running"}'; END IF;
 INSERT INTO public."DemandEngineRun"(status) VALUES('RUNNING') RETURNING id INTO run_id;
 FOR d IN SELECT * FROM public."DemandSignal" WHERE status<>'ARCHIVED'
 ORDER BY public.demand_target_market(market) DESC,"publishedAt" DESC NULLS LAST,score DESC,id
 LIMIT greatest(1,least(batch_size,500)) LOOP
  BEGIN
   in_scope:=public.demand_target_market(d.market); test_signal:=public.demand_is_test(d.id);
   is_fresh:=coalesce(d."publishedAt" BETWEEN now()-interval '7 days' AND now(),false)
    AND (d."deadlineAt" IS NULL OR d."deadlineAt">now());
   SELECT * INTO br FROM public."DemandBuyerResolution" WHERE "signalId"=d.id;
   buyer_ready:=coalesce(br."verificationStatus"='VERIFIED' AND nullif(trim(br."legalEntity"),'') IS NOT NULL
    AND br.website ~ '^https?://' AND (nullif(trim(br."businessEmail"),'') IS NOT NULL OR nullif(trim(br."businessPhone"),'') IS NOT NULL OR nullif(trim(br.whatsapp),'') IS NOT NULL),false);
   blockers:='[]'; candidates:=0;
   IF test_signal THEN blockers:=blockers||'["TEST_SIGNAL"]'; END IF;
   IF NOT in_scope THEN blockers:=blockers||'["OUTSIDE_PRIORITY_MARKETS"]'; END IF;
   IF NOT is_fresh THEN blockers:=blockers||'["STALE_OR_UNDATED_OR_EXPIRED"]'; END IF;
   IF NOT buyer_ready THEN blockers:=blockers||'["VERIFIED_COMPANY_AND_DIRECT_CONTACT_REQUIRED"]'; END IF;
   IF nullif(trim(d.quantity),'') IS NULL THEN blockers:=blockers||'["QUANTITY_REQUIRED"]'; END IF;
   IF nullif(trim(d.packing),'') IS NULL THEN blockers:=blockers||'["PACKING_REQUIRED"]'; END IF;
   IF nullif(trim(d.incoterm),'') IS NULL THEN blockers:=blockers||'["INCOTERM_REQUIRED"]'; END IF;
   IF in_scope AND is_fresh AND NOT test_signal THEN
    candidates:=public.refresh_supplier_fit(d.id);
    IF candidates=0 THEN blockers:=blockers||'["SUPPLIER_REQUIRED"]'; END IF;
    IF buyer_ready AND d.stage IN ('DETECTED','BUYER_RESOLUTION') THEN
     UPDATE public."DemandSignal" SET stage='QUALIFICATION',status='QUALIFY_NOW' WHERE id=d.id;
     UPDATE public."DemandTask" SET status='DONE',"updatedAt"=now() WHERE "signalId"=d.id AND "taskType"='RESOLVE_BUYER' AND status IN ('OPEN','IN_PROGRESS');
    END IF;
    SELECT * INTO q FROM public."DemandQualification" WHERE "signalId"=d.id;
    IF buyer_ready AND d.quantity IS NOT NULL AND d.packing IS NOT NULL AND d.incoterm IS NOT NULL
     AND q."directEligibility" IS TRUE AND q."localPartnerRequired" IS FALSE AND q.decision='PENDING'
     AND jsonb_array_length(coalesce(q."riskFlags",'[]'))=0 THEN
     UPDATE public."DemandQualification" SET decision='QUALIFIED',"nextAction"='Build a costed draft for human review',"updatedAt"=now() WHERE "signalId"=d.id;
    END IF;
    IF q."directEligibility" IS DISTINCT FROM TRUE OR q."localPartnerRequired" IS DISTINCT FROM FALSE THEN
     blockers:=blockers||'["ELIGIBILITY_REVIEW_REQUIRED"]'; END IF;
    SELECT * INTO c FROM public."DemandCostInput" WHERE "signalId"=d.id AND "validUntil">now();
    IF FOUND AND EXISTS(SELECT 1 FROM public."DemandSupplierFit" WHERE "signalId"=d.id AND "supplierId"=c."supplierId" AND status='SELECTED') THEN
     cost:=c."productPerMt"+c."freightPerMt"+c."insurancePerMt"+c."otherPerMt";
     UPDATE public."DemandOfferBuild" SET commercial=coalesce(commercial,'{}')||jsonb_build_object(
      'pricing_status','COSTED_DRAFT','currency',c.currency,'landedCostPerMt',cost,
      'offerPerMt',round(cost/(1-c."marginPct"/100),2),'marginPct',c."marginPct",'validUntil',c."validUntil",'requiresHumanApproval',true),"updatedAt"=now()
     WHERE "signalId"=d.id AND status='DRAFT';
    ELSE
     blockers:=blockers||'["CURRENT_COST_AND_SELECTED_SUPPLIER_REQUIRED"]';
     UPDATE public."DemandOfferBuild" SET commercial=coalesce(commercial,'{}')||'{"pricing_status":"CURRENT_COST_REQUIRED","requiresHumanApproval":true}'::jsonb
      WHERE "signalId"=d.id AND status='DRAFT';
    END IF;
   END IF;
   action:=CASE WHEN test_signal THEN 'EXCLUDE_TEST' WHEN NOT in_scope THEN 'WATCH_OTHER_MARKET'
    WHEN NOT is_fresh THEN 'REVALIDATE_DEMAND' WHEN NOT buyer_ready THEN 'RESEARCH_COMPANY_AND_DIRECT_CONTACT'
    WHEN blockers ? 'QUANTITY_REQUIRED' OR blockers ? 'PACKING_REQUIRED' OR blockers ? 'INCOTERM_REQUIRED' THEN 'COMPLETE_REQUIREMENT'
    WHEN blockers ? 'ELIGIBILITY_REVIEW_REQUIRED' THEN 'REVIEW_ELIGIBILITY'
    WHEN candidates=0 THEN 'RESEARCH_SUPPLY'
    WHEN blockers ? 'CURRENT_COST_AND_SELECTED_SUPPLIER_REQUIRED' THEN 'CONFIRM_SUPPLIER_AND_COST'
    ELSE 'HUMAN_REVIEW' END;
   INSERT INTO public."DemandAssessment"("signalId","inScope",fresh,"isTest","buyerReady","supplierCount",blockers,"nextAction")
   VALUES(d.id,in_scope,is_fresh,test_signal,buyer_ready,candidates,blockers,action)
   ON CONFLICT("signalId") DO UPDATE SET "inScope"=excluded."inScope",fresh=excluded.fresh,"isTest"=excluded."isTest","buyerReady"=excluded."buyerReady","supplierCount"=excluded."supplierCount",blockers=excluded.blockers,"nextAction"=excluded."nextAction","assessedAt"=now();
   IF in_scope AND is_fresh AND NOT test_signal THEN PERFORM public.bridge_demand_to_core(d.id); END IF;
   UPDATE public."DemandTask" SET priority=CASE WHEN test_signal THEN 0 WHEN in_scope AND is_fresh THEN greatest(80,d.score) WHEN in_scope THEN 20 ELSE 5 END,
    payload=coalesce(payload,'{}')||jsonb_build_object('engineNextAction',action,'blockers',blockers),"updatedAt"=now()
   WHERE "signalId"=d.id AND status IN ('OPEN','IN_PROGRESS');
   n:=n+1;
  EXCEPTION WHEN OTHERS THEN run_errors:=run_errors||jsonb_build_array(jsonb_build_object('signalId',d.id,'sqlstate',SQLSTATE,'error',SQLERRM));
  END;
 END LOOP;
 -- Emit one actionable incident per source/reason/day, including inactive access blockers.
 FOR src IN SELECT * FROM public."DemandSource" WHERE id<>'platform-buyers' LOOP
  health:=CASE WHEN NOT src.active THEN coalesce(src."lastError",'INACTIVE_SOURCE')
   WHEN src."lastError" IS NOT NULL THEN src."lastError"
   WHEN src."lastSuccessAt" IS NULL OR src."lastSuccessAt"<now()-make_interval(mins=>greatest(120,src."cadenceMinutes"*2)) THEN 'STALE_COLLECTOR' ELSE NULL END;
  IF health IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."DemandAlert" WHERE type='SOURCE_FAILURE'
   AND metadata->>'sourceId'=src.id AND metadata->>'reason'=health AND "createdAt">now()-interval '24 hours') THEN
   INSERT INTO public."DemandAlert"(type,severity,title,body,metadata) VALUES('SOURCE_FAILURE','HIGH',
    'Source needs attention: '||src.name,health,jsonb_build_object('sourceId',src.id,'reason',health,'automaticBypass',false));
  END IF;
 END LOOP;
 UPDATE public."DemandEngineRun" SET status=CASE WHEN run_errors='[]' THEN 'SUCCESS' ELSE 'FAILED' END,
 "finishedAt"=now(),processed=n,errors=run_errors,summary=jsonb_build_object('processed',n,'errorCount',jsonb_array_length(run_errors)) WHERE id=run_id;
 RETURN jsonb_build_object('runId',run_id,'processed',n,'errors',run_errors);
END; $$;

-- A READY offer requires current, sourced costs and a human-selected supplier.
CREATE FUNCTION public.guard_demand_offer_ready() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='READY' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF NOT EXISTS(SELECT 1 FROM public."DemandCostInput" c JOIN public."DemandSupplierFit" f
   ON f."signalId"=c."signalId" AND f."supplierId"=c."supplierId" AND f.status='SELECTED'
   JOIN public."DemandSupplierProfile" p ON p.id=c."supplierId" AND p.active AND p."verificationStatus"='SEPTLION_VERIFIED'
   JOIN public."DemandQualification" q ON q."signalId"=c."signalId" AND q.decision='QUALIFIED'
   WHERE c."signalId"=NEW."signalId" AND c."validUntil">now())
   OR NEW."approvedAt" IS NULL THEN RAISE EXCEPTION 'Current sourced costs, selected supplier, qualified requirement and human approval are required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER demand_offer_ready_guard BEFORE INSERT OR UPDATE OF status ON public."DemandOfferBuild"
FOR EACH ROW EXECUTE FUNCTION public.guard_demand_offer_ready();

REVOKE ALL ON FUNCTION public.demand_target_market(text),public.demand_is_test(uuid),public.refresh_supplier_fit(uuid),public.refresh_demand_patterns(),public.run_demand_operations(integer),public.guard_demand_offer_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demand_target_market(text),public.demand_is_test(uuid),public.refresh_supplier_fit(uuid),public.refresh_demand_patterns(),public.run_demand_operations(integer) TO service_role;

-- One-way bridge owns only radar-prefixed records, preserving the existing trade workspace.
-- No RFQ, order, approval, payment, or external commitment is fabricated by this bridge.
CREATE FUNCTION public.bridge_demand_to_core(target_signal uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,core AS $$
DECLARE d public."DemandSignal"%ROWTYPE; a public."DemandAssessment"%ROWTYPE;
 br public."DemandBuyerResolution"%ROWTYPE; sig_id text; opp_id text; req_id text; buyer_id text; fit record;
BEGIN
 SELECT * INTO a FROM public."DemandAssessment" WHERE "signalId"=target_signal;
 IF NOT FOUND OR NOT a.fresh OR NOT a."inScope" OR a."isTest" THEN RETURN NULL; END IF;
 SELECT * INTO d FROM public."DemandSignal" WHERE id=target_signal;
 SELECT * INTO br FROM public."DemandBuyerResolution" WHERE "signalId"=target_signal;
 INSERT INTO core."DemandSignal"(id,source,"sourceRecordId","sourceUrl",type,status,market,product,quantity,"buyerName","publishedAt","deadlineAt",incoterm,packing,evidence,score,verification,"lastSeenAt",raw)
 VALUES('radar-'||d.id,d.source,d."sourceRecordId",d."sourceUrl",d.type::text::core."DemandSignalType",d.status::text::core."DemandSignalStatus",d.market,d.product,d.quantity,d."buyerName",d."publishedAt",d."deadlineAt",d.incoterm,d.packing,
  coalesce(d.evidence,'{}')||jsonb_build_object('publicSignalId',d.id,'bridge','radar-v1'),d.score,d.verification,d."lastSeenAt",d.raw)
 ON CONFLICT(source,"sourceRecordId") DO UPDATE SET "lastSeenAt"=excluded."lastSeenAt",evidence=excluded.evidence
 RETURNING id INTO sig_id;
 IF a."buyerReady" THEN
  buyer_id:='radar-buyer-'||d.id;
  INSERT INTO core."BuyerProfile"(id,"canonicalName",country,website,"verificationStatus",confidence,provenance,"updatedAt")
  VALUES(buyer_id,br."legalEntity",d.market,br.website,'SOURCE_CONFIRMED',br.confidence,
   coalesce(br.evidence,'{}')||jsonb_build_object('publicSignalId',d.id,'warning','Source-confirmed identity; independent legal/payment due diligence still required'),now())
  ON CONFLICT(id) DO UPDATE SET website=excluded.website,provenance=excluded.provenance,"updatedAt"=now();
 END IF;
 SELECT id INTO req_id FROM core."QualifiedRequirement" WHERE "sourceSignalId"=sig_id ORDER BY "createdAt" LIMIT 1;
 IF req_id IS NULL THEN
  req_id:='radar-req-'||d.id;
  INSERT INTO core."QualifiedRequirement"(id,"buyerProfileId","sourceSignalId",source,status,product,market,"deliveryCountry",incoterm,"knownFacts","criticalMissing",confidence,"sourceContext","updatedAt")
  VALUES(req_id,buyer_id,sig_id,'INTERNAL','NEEDS_CLARIFICATION',d.product,d.market,d.market,d.incoterm,
   jsonb_build_object('quantityAsPublished',d.quantity,'packingAsPublished',d.packing,'incoterm',d.incoterm,'sourceUrl',d."sourceUrl"),
   jsonb_build_object('fields',a.blockers||'["NORMALIZED_QUANTITY_UNIT","DELIVERY_PORT","PRODUCT_SPECIFICATION"]'),d.score,jsonb_build_object('publicSignalId',d.id),now());
 ELSE
  UPDATE core."QualifiedRequirement" SET "buyerProfileId"=coalesce("buyerProfileId",buyer_id),"criticalMissing"=jsonb_build_object('fields',a.blockers||'["NORMALIZED_QUANTITY_UNIT","DELIVERY_PORT","PRODUCT_SPECIFICATION"]'),"updatedAt"=now()
  WHERE id=req_id AND id LIKE 'radar-req-%' AND status IN ('DRAFT','NEEDS_CLARIFICATION');
 END IF;
 SELECT id INTO opp_id FROM core."Opportunity" WHERE "sourceSignalId"=sig_id ORDER BY "createdAt" LIMIT 1;
 IF opp_id IS NULL THEN
  opp_id:='radar-opp-'||d.id;
  INSERT INTO core."Opportunity"(id,reference,status,"sourceSignalId","buyerProfileId","requirementId",title,market,product,"nextAction",evidence,risk,"updatedAt")
  VALUES(opp_id,'RADAR-'||d.id,CASE WHEN a."buyerReady" THEN 'QUALIFICATION'::core."OpportunityStatus" ELSE 'BUYER_RESOLUTION'::core."OpportunityStatus" END,
   sig_id,buyer_id,req_id,d.product||' — '||d.market,d.market,d.product,a."nextAction",jsonb_build_object('publicSignalId',d.id,'sourceUrl',d."sourceUrl"),a.blockers,now());
 ELSE
  UPDATE core."Opportunity" SET "buyerProfileId"=coalesce("buyerProfileId",buyer_id),"nextAction"=a."nextAction",risk=a.blockers,"updatedAt"=now()
  WHERE id=opp_id AND id LIKE 'radar-opp-%' AND status IN ('DISCOVERED','BUYER_RESOLUTION','QUALIFICATION');
 END IF;
 INSERT INTO core."AgentRun"(id,"opportunityId","agentType",runtime,status,input,output,evidence,"startedAt","finishedAt")
 VALUES('radar-assessment-'||d.id,opp_id,'DEMAND_ASSESSMENT','POSTGRES_OPERATIONS','SUCCEEDED',jsonb_build_object('signalId',d.id),
  jsonb_build_object('nextAction',a."nextAction",'blockers',a.blockers,'buyerReady',a."buyerReady",'supplierCount',a."supplierCount"),jsonb_build_object('engine','run_demand_operations'),now(),now())
 ON CONFLICT(id) DO UPDATE SET output=excluded.output,"finishedAt"=now();
 FOR fit IN SELECT f.*,p.name,p.country,p."verificationStatus",p.capabilities,p.contact FROM public."DemandSupplierFit" f JOIN public."DemandSupplierProfile" p ON p.id=f."supplierId" WHERE f."signalId"=d.id AND f.status<>'REJECTED' AND p.active LOOP
  INSERT INTO core."SupplyCandidate"(id,"opportunityId","supplierName",country,source,"sourceUrl",capability,confidence,verified,"updatedAt")
  VALUES('radar-fit-'||fit.id,opp_id,fit.name,fit.country,'radar-supplier-network',fit.capabilities->>'sourceUrl',fit.capabilities,fit.score,fit."verificationStatus"='SEPTLION_VERIFIED',now())
  ON CONFLICT(id) DO UPDATE SET capability=excluded.capability,confidence=excluded.confidence,"updatedAt"=now();
 END LOOP;
 RETURN opp_id;
END; $$;
REVOKE ALL ON FUNCTION public.bridge_demand_to_core(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_demand_to_core(uuid) TO service_role;
SELECT cron.schedule('septlion-demand-operations-hourly','35 * * * *','SELECT public.run_demand_operations(200);');

-- Preserve evidence-enriched buyer matches across scheduled platform refreshes.
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
      WHEN "DemandBuyerResolution"."verificationStatus" IN ('VERIFIED','BUYER_SELF_SUBMITTED','SELF_SUBMITTED','SOURCE_IDENTIFIED','PROBABLE_MATCH')
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

