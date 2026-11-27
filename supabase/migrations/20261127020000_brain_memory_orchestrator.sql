-- SEPTLION Brain, phase 1: memory (Trade Truth + Demand Graph), an append-only event log,
-- an agent task queue, founder decisions, and an hourly orchestrator.
-- Nothing here calls an LLM, sends a message, publishes, or approves a price.
-- Agents are disabled by default; the orchestrator only queues work and asks the founder.

CREATE TABLE public."BrainFact" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subjectType" text NOT NULL CHECK ("subjectType" IN ('BUYER','SIGNAL','DEAL','SUPPLIER','MARKET','PRODUCT')),
  "subjectId" text NOT NULL CHECK (length(trim("subjectId"))>0),
  predicate text NOT NULL CHECK (predicate ~ '^[a-z][a-z0-9_]*$'),
  value jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('CONFIRMED','INFERRED','UNKNOWN','REJECTED')),
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  "sourceUrl" text CHECK ("sourceUrl" IS NULL OR "sourceUrl" ~ '^https?://'),
  evidence jsonb NOT NULL DEFAULT '{}',
  actor text NOT NULL,
  "observedAt" timestamptz NOT NULL DEFAULT now(),
  "validUntil" timestamptz,
  "supersededBy" uuid REFERENCES public."BrainFact"(id) DEFERRABLE INITIALLY DEFERRED,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  -- Trade Truth: a fact is CONFIRMED only with a public source or the founder's own word.
  CONSTRAINT "BrainFact_confirmed_needs_source" CHECK (status<>'CONFIRMED' OR "sourceUrl" IS NOT NULL OR actor='FOUNDER')
);
CREATE UNIQUE INDEX "BrainFact_current" ON public."BrainFact"("subjectType","subjectId",predicate) WHERE "supersededBy" IS NULL;

CREATE TABLE public."BrainEdge" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fromType" text NOT NULL,
  "fromId" text NOT NULL,
  relation text NOT NULL CHECK (relation IN ('NEEDS','SPECIFIES','IN_MARKET','SUPPLIED_BY','PRICED_AT','SHIPPED_VIA','RESULTED_IN','REPEATS')),
  "toType" text NOT NULL,
  "toId" text NOT NULL,
  weight integer NOT NULL DEFAULT 50 CHECK (weight BETWEEN 0 AND 100),
  evidence jsonb NOT NULL DEFAULT '{}',
  "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
  "lastSeenAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("fromType","fromId",relation,"toType","toId")
);

CREATE TABLE public."BrainEvent" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "eventType" text NOT NULL,
  "subjectType" text,
  "subjectId" text,
  actor text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  "occurredAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "BrainEvent_subject" ON public."BrainEvent"("subjectType","subjectId","occurredAt" DESC);

CREATE FUNCTION public.brain_event_append_only() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'BrainEvent is append-only'; END; $$;
CREATE TRIGGER "BrainEvent_append_only" BEFORE UPDATE OR DELETE ON public."BrainEvent"
 FOR EACH ROW EXECUTE FUNCTION public.brain_event_append_only();

CREATE TABLE public."BrainPolicy" (
  "agentType" text PRIMARY KEY,
  "titleAr" text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  "dailyBudgetUsd" numeric(10,2) NOT NULL DEFAULT 0 CHECK ("dailyBudgetUsd">=0),
  guardrails jsonb NOT NULL DEFAULT '[]',
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public."BrainPolicy"("agentType","titleAr",guardrails) VALUES
 ('BUYER_RESOLVER','محدد هوية المشتري','["direct_channel_only","no_platform_reply","source_required"]'),
 ('REVALIDATOR','مدقق حداثة الطلب','["source_required"]'),
 ('QUALIFIER','مؤهل الصفقة','["no_price","human_review"]'),
 ('PRODUCT_ARCHITECT','مهندس المنتج','["human_review"]'),
 ('SUPPLY_INTELLIGENCE','ذكاء التوريد','["source_required","no_supplier_commitment"]'),
 ('COSTING','محلل التكلفة','["sourced_costs_only","no_offer_approval"]'),
 ('DEAL_STRUCTURER','مهيكل الصفقة','["founder_approval"]'),
 ('PREDICTOR','متنبئ الطلب','["inferred_only"]'),
 ('ATTRACTOR','جاذب الطلب','["no_publish_without_approval"]'),
 ('MEMORY','الذاكرة','["no_overwrite_confirmed"]');

CREATE TABLE public."BrainTask" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentType" text NOT NULL REFERENCES public."BrainPolicy"("agentType"),
  "subjectType" text NOT NULL,
  "subjectId" text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','DONE','NEEDS_HUMAN','FAILED','SUPERSEDED')),
  reason text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb,
  attempts integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
-- One open task per agent and subject: repeated orchestration never duplicates work.
CREATE UNIQUE INDEX "BrainTask_open" ON public."BrainTask"("agentType","subjectType","subjectId")
 WHERE status IN ('QUEUED','RUNNING','NEEDS_HUMAN');

CREATE TABLE public."BrainDecision" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('APPROVE_OFFER','PROVIDE_COST','CONFIRM_FACT','CHOOSE_PATH')),
  "subjectType" text NOT NULL,
  "subjectId" text NOT NULL,
  "titleAr" text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DECIDED','WITHDRAWN')),
  choice text,
  note text,
  "decidedBy" text,
  "decidedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "BrainDecision_decided" CHECK (status<>'DECIDED' OR (choice IS NOT NULL AND "decidedBy" IS NOT NULL AND "decidedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "BrainDecision_pending" ON public."BrainDecision"(kind,"subjectType","subjectId") WHERE status='PENDING';

CREATE TABLE public."BrainRun" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "finishedAt" timestamptz,
  status text NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
  summary jsonb NOT NULL DEFAULT '{}',
  errors jsonb NOT NULL DEFAULT '[]'
);

ALTER TABLE public."BrainFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BrainEdge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BrainEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BrainPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BrainTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BrainDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BrainRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."BrainFact",public."BrainEdge",public."BrainEvent",public."BrainPolicy",public."BrainTask",
 public."BrainDecision",public."BrainRun" FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public."BrainFact",public."BrainEdge",public."BrainPolicy",public."BrainTask",
 public."BrainDecision",public."BrainRun" TO service_role;
GRANT SELECT,INSERT ON public."BrainEvent" TO service_role;

CREATE FUNCTION public.brain_log(event_type text, subject_type text, subject_id text, event_actor text, event_payload jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 INSERT INTO public."BrainEvent"("eventType","subjectType","subjectId",actor,payload)
 VALUES(event_type,subject_type,subject_id,event_actor,coalesce(event_payload,'{}'));
$$;

-- Record a fact. The previous current fact for the same subject and predicate is kept and
-- marked superseded, so memory never forgets. An agent cannot overwrite a CONFIRMED fact
-- with a weaker one; only the founder or a sourced confirmation can.
CREATE FUNCTION public.brain_assert_fact(subject_type text, subject_id text, fact_predicate text, fact_value jsonb,
 fact_status text, fact_confidence integer, source_url text, fact_actor text, valid_until timestamptz DEFAULT NULL,
 fact_evidence jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE prev public."BrainFact"%ROWTYPE; new_id uuid;
BEGIN
 SELECT * INTO prev FROM public."BrainFact" WHERE "subjectType"=subject_type AND "subjectId"=subject_id
  AND predicate=fact_predicate AND "supersededBy" IS NULL FOR UPDATE;
 IF FOUND AND prev.value=fact_value AND prev.status=fact_status THEN
  UPDATE public."BrainFact" SET "observedAt"=now() WHERE id=prev.id; RETURN prev.id;
 END IF;
 IF FOUND AND prev.status='CONFIRMED' AND fact_status<>'CONFIRMED' AND fact_actor<>'FOUNDER' THEN
  RAISE EXCEPTION 'Confirmed fact % can only be changed by the founder or a sourced confirmation',fact_predicate;
 END IF;
 new_id:=gen_random_uuid();
 IF FOUND THEN UPDATE public."BrainFact" SET "supersededBy"=new_id WHERE id=prev.id; END IF;
 INSERT INTO public."BrainFact"(id,"subjectType","subjectId",predicate,value,status,confidence,"sourceUrl",evidence,actor,"validUntil")
 VALUES(new_id,subject_type,subject_id,fact_predicate,fact_value,fact_status,coalesce(fact_confidence,0),source_url,coalesce(fact_evidence,'{}'),fact_actor,valid_until);
 PERFORM public.brain_log('FACT_ASSERTED',subject_type,subject_id,fact_actor,
  jsonb_build_object('factId',new_id,'predicate',fact_predicate,'status',fact_status,'supersedes',prev.id));
 RETURN new_id;
END; $$;

CREATE FUNCTION public.brain_link(from_type text, from_id text, edge_relation text, to_type text, to_id text, edge_weight integer DEFAULT 50, edge_evidence jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 INSERT INTO public."BrainEdge"("fromType","fromId",relation,"toType","toId",weight,evidence)
 VALUES(from_type,from_id,edge_relation,to_type,to_id,edge_weight,coalesce(edge_evidence,'{}'))
 ON CONFLICT("fromType","fromId",relation,"toType","toId") DO UPDATE SET "lastSeenAt"=now(),weight=greatest("BrainEdge".weight,excluded.weight);
$$;

CREATE FUNCTION public.brain_queue_task(agent text, subject_type text, subject_id text, task_reason text, task_input jsonb DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE new_id uuid;
BEGIN
 INSERT INTO public."BrainTask"("agentType","subjectType","subjectId",reason,input)
 VALUES(agent,subject_type,subject_id,task_reason,coalesce(task_input,'{}'))
 ON CONFLICT ("agentType","subjectType","subjectId") WHERE status IN ('QUEUED','RUNNING','NEEDS_HUMAN') DO NOTHING
 RETURNING id INTO new_id;
 IF new_id IS NULL THEN RETURN false; END IF;
 PERFORM public.brain_log('TASK_QUEUED',subject_type,subject_id,'ORCHESTRATOR',jsonb_build_object('taskId',new_id,'agentType',agent,'reason',task_reason));
 RETURN true;
END; $$;

CREATE FUNCTION public.brain_ask_founder(decision_kind text, subject_type text, subject_id text, title_ar text, decision_detail jsonb DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE new_id uuid;
BEGIN
 INSERT INTO public."BrainDecision"(kind,"subjectType","subjectId","titleAr",detail)
 VALUES(decision_kind,subject_type,subject_id,title_ar,coalesce(decision_detail,'{}'))
 ON CONFLICT (kind,"subjectType","subjectId") WHERE status='PENDING' DO UPDATE SET detail=excluded.detail
 RETURNING id INTO new_id;
 IF NOT EXISTS(SELECT 1 FROM public."BrainEvent" WHERE "eventType"='DECISION_REQUESTED' AND payload->>'decisionId'=new_id::text) THEN
  PERFORM public.brain_log('DECISION_REQUESTED',subject_type,subject_id,'ORCHESTRATOR',jsonb_build_object('decisionId',new_id,'kind',decision_kind));
  RETURN true;
 END IF;
 RETURN false;
END; $$;

-- The founder's answer. Recording a decision never bypasses the offer guard:
-- an approved offer still has to pass guard_demand_offer_ready() in the workbench.
CREATE FUNCTION public.brain_decide(decision_id uuid, decision_choice text, decided_by text, decision_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE d public."BrainDecision"%ROWTYPE;
BEGIN
 IF nullif(trim(decision_choice),'') IS NULL OR nullif(trim(decided_by),'') IS NULL THEN RAISE EXCEPTION 'Choice and decider are required'; END IF;
 UPDATE public."BrainDecision" SET status='DECIDED',choice=decision_choice,note=decision_note,"decidedBy"=decided_by,"decidedAt"=now()
  WHERE id=decision_id AND status='PENDING' RETURNING * INTO d;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decision is not pending'; END IF;
 PERFORM public.brain_log('DECISION_MADE',d."subjectType",d."subjectId",'FOUNDER',
  jsonb_build_object('decisionId',d.id,'kind',d.kind,'choice',decision_choice,'by',decided_by,'note',decision_note));
 IF d.kind='CONFIRM_FACT' AND decision_choice IN ('CONFIRM','REJECT') AND d.detail ? 'factId' THEN
  PERFORM public.brain_assert_fact(f."subjectType",f."subjectId",f.predicate,f.value,
   CASE WHEN decision_choice='CONFIRM' THEN 'CONFIRMED' ELSE 'REJECTED' END,
   CASE WHEN decision_choice='CONFIRM' THEN 100 ELSE 0 END,f."sourceUrl",'FOUNDER',f."validUntil",
   f.evidence||jsonb_build_object('decisionId',d.id))
  FROM public."BrainFact" f WHERE f.id=(d.detail->>'factId')::uuid;
 END IF;
 RETURN jsonb_build_object('ok',true,'decisionId',d.id,'kind',d.kind,'choice',decision_choice);
END; $$;

-- The orchestrator: reads the operations engine's assessments, writes the Demand Graph,
-- queues the right agent per opportunity, asks the founder where only a human may decide,
-- and retires work that no longer applies. Out-of-scope and test signals get no work.
CREATE FUNCTION public.run_brain(batch_size integer DEFAULT 200) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE run_id uuid; a record; want_agent text; want_decision text; title text; sid text;
 n integer:=0; queued integer:=0; asked integer:=0; retired integer:=0; run_errors jsonb:='[]'; k integer;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('septlion-brain')) THEN RETURN '{"skipped":"already_running"}'; END IF;
 INSERT INTO public."BrainRun"(status) VALUES('RUNNING') RETURNING id INTO run_id;
 FOR a IN SELECT x.*,s.market,s.product,s."productKey",s."sourceUrl",s.quantity,s."deadlineAt",o.commercial
  FROM public."DemandAssessment" x JOIN public."DemandSignal" s ON s.id=x."signalId"
  LEFT JOIN public."DemandOfferBuild" o ON o."signalId"=x."signalId"
  WHERE s.status<>'ARCHIVED'
  ORDER BY x."inScope" DESC,x.fresh DESC,x."assessedAt" DESC,x."signalId"
  LIMIT greatest(1,least(batch_size,500)) LOOP
  BEGIN
   sid:=a."signalId"::text; want_agent:=NULL; want_decision:=NULL;
   IF NOT a."isTest" AND a."inScope" THEN
    IF a."productKey" IS NOT NULL THEN
     PERFORM public.brain_link('SIGNAL',sid,'SPECIFIES','PRODUCT',a."productKey",50,jsonb_build_object('sourceUrl',a."sourceUrl"));
    END IF;
    PERFORM public.brain_link('SIGNAL',sid,'IN_MARKET','MARKET',lower(trim(split_part(a.market,' — ',1))));
    INSERT INTO public."BrainEdge"("fromType","fromId",relation,"toType","toId",weight,evidence)
     SELECT 'BUYER',bs."buyerId"::text,'NEEDS','PRODUCT',a."productKey",bs.confidence,jsonb_build_object('signalId',sid)
     FROM public."DemandBuyerSignal" bs WHERE bs."signalId"=a."signalId" AND a."productKey" IS NOT NULL
     ON CONFLICT("fromType","fromId",relation,"toType","toId") DO UPDATE SET "lastSeenAt"=now();
    want_agent:=CASE a."nextAction"
     WHEN 'RESEARCH_COMPANY_AND_DIRECT_CONTACT' THEN 'BUYER_RESOLVER'
     WHEN 'REVALIDATE_DEMAND' THEN 'REVALIDATOR'
     WHEN 'COMPLETE_REQUIREMENT' THEN 'QUALIFIER'
     WHEN 'REVIEW_ELIGIBILITY' THEN 'QUALIFIER'
     WHEN 'RESEARCH_SUPPLY' THEN 'SUPPLY_INTELLIGENCE'
     ELSE NULL END;
    want_decision:=CASE
     WHEN a."nextAction"='CONFIRM_SUPPLIER_AND_COST' THEN 'PROVIDE_COST'
     WHEN a."nextAction"='HUMAN_REVIEW' AND a.commercial->>'pricing_status'='COSTED_DRAFT' THEN 'APPROVE_OFFER'
     ELSE NULL END;
   END IF;
   IF want_agent IS NOT NULL AND public.brain_queue_task(want_agent,'SIGNAL',sid,a."nextAction",
     jsonb_build_object('market',a.market,'product',a.product,'sourceUrl',a."sourceUrl",'blockers',a.blockers)) THEN
    queued:=queued+1;
   END IF;
   IF want_decision IS NOT NULL THEN
    title:=CASE want_decision
     WHEN 'PROVIDE_COST' THEN 'أدخل تكلفة موثقة واختر المورد: '||coalesce(a.product,'')||' — '||coalesce(a.market,'')
     ELSE 'اعتمد العرض أو ارفضه: '||coalesce(a.product,'')||' — '||coalesce(a.market,'') END;
    IF public.brain_ask_founder(want_decision,'SIGNAL',sid,title,
      jsonb_build_object('market',a.market,'product',a.product,'quantity',a.quantity,'deadlineAt',a."deadlineAt",
       'sourceUrl',a."sourceUrl",'blockers',a.blockers,'commercial',a.commercial)) THEN asked:=asked+1; END IF;
   END IF;
   -- Retire queued work and pending questions that the current assessment no longer needs.
   UPDATE public."BrainTask" SET status='SUPERSEDED',"updatedAt"=now(),output=jsonb_build_object('supersededBy',a."nextAction")
    WHERE "subjectType"='SIGNAL' AND "subjectId"=sid AND status='QUEUED' AND "agentType" IS DISTINCT FROM want_agent;
   GET DIAGNOSTICS k=ROW_COUNT; retired:=retired+k;
   UPDATE public."BrainDecision" SET status='WITHDRAWN',note='No longer needed: '||a."nextAction"
    WHERE "subjectType"='SIGNAL' AND "subjectId"=sid AND status='PENDING' AND kind IN ('PROVIDE_COST','APPROVE_OFFER')
     AND kind IS DISTINCT FROM want_decision;
   GET DIAGNOSTICS k=ROW_COUNT; retired:=retired+k;
   n:=n+1;
  EXCEPTION WHEN OTHERS THEN run_errors:=run_errors||jsonb_build_array(jsonb_build_object('signalId',a."signalId",'sqlstate',SQLSTATE,'error',SQLERRM));
  END;
 END LOOP;
 UPDATE public."BrainRun" SET status=CASE WHEN run_errors='[]' THEN 'SUCCESS' ELSE 'FAILED' END,"finishedAt"=now(),errors=run_errors,
  summary=jsonb_build_object('processed',n,'queued',queued,'asked',asked,'retired',retired) WHERE id=run_id;
 PERFORM public.brain_log('BRAIN_RUN','RUN',run_id::text,'ORCHESTRATOR',jsonb_build_object('processed',n,'queued',queued,'asked',asked,'retired',retired,'errorCount',jsonb_array_length(run_errors)));
 RETURN jsonb_build_object('runId',run_id,'processed',n,'queued',queued,'asked',asked,'retired',retired,'errors',run_errors);
END; $$;

-- Buyer Twin: everything memory holds about one buyer, in one row.
CREATE VIEW public."BrainBuyerTwin" WITH (security_invoker=true) AS
SELECT b.id AS "buyerId",b."displayName",b."legalName",b.country,b.website,b."verificationStatus",b."productKeys",
 b."lastBuyingSignalAt",b."buyingIntentScore",b."contactReadinessScore",b."executionScore",
 coalesce((SELECT jsonb_object_agg(f.predicate,jsonb_build_object('value',f.value,'status',f.status,'confidence',f.confidence,'sourceUrl',f."sourceUrl",'observedAt',f."observedAt"))
  FROM public."BrainFact" f WHERE f."subjectType"='BUYER' AND f."subjectId"=b.id::text AND f."supersededBy" IS NULL),'{}') AS facts,
 coalesce((SELECT jsonb_agg(jsonb_build_object('productKey',p."productKey",'market',p.market,'observations',p."observationCount",
   'confidence',p.confidence,'windowStart',p."predictedWindowStart",'windowEnd',p."predictedWindowEnd"))
  FROM public."DemandBuyerPattern" p WHERE p."buyerId"=b.id),'[]') AS patterns,
 (SELECT count(*)::int FROM public."BrainTask" t JOIN public."DemandBuyerSignal" bs ON t."subjectType"='SIGNAL' AND t."subjectId"=bs."signalId"::text
  WHERE bs."buyerId"=b.id AND t.status IN ('QUEUED','RUNNING','NEEDS_HUMAN')) AS "openTasks"
FROM public."DemandBuyerProfile" b;
REVOKE ALL ON public."BrainBuyerTwin" FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public."BrainBuyerTwin" TO service_role;

REVOKE ALL ON FUNCTION public.brain_event_append_only(),public.brain_log(text,text,text,text,jsonb),
 public.brain_assert_fact(text,text,text,jsonb,text,integer,text,text,timestamptz,jsonb),
 public.brain_link(text,text,text,text,text,integer,jsonb),public.brain_queue_task(text,text,text,text,jsonb),
 public.brain_ask_founder(text,text,text,text,jsonb),public.brain_decide(uuid,text,text,text),public.run_brain(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.brain_log(text,text,text,text,jsonb),
 public.brain_assert_fact(text,text,text,jsonb,text,integer,text,text,timestamptz,jsonb),
 public.brain_link(text,text,text,text,text,integer,jsonb),public.brain_queue_task(text,text,text,text,jsonb),
 public.brain_ask_founder(text,text,text,text,jsonb),public.brain_decide(uuid,text,text,text),public.run_brain(integer)
 TO service_role;

-- Runs five minutes after the operations engine (:35) so it reads fresh assessments.
SELECT cron.schedule('septlion-brain-hourly','40 * * * *','SELECT public.run_brain(200);');
