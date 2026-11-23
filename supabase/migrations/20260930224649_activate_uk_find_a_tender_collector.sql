
INSERT INTO "DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","marketFocus","collector","cadenceMinutes","lastError","config")
VALUES (
  'uk-find-a-tender',
  'UK Find a Tender',
  'API',
  'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages',
  true,
  88,
  ARRAY['wheat_flour','food_supply'],
  ARRAY['United Kingdom'],
  'pg_net + plpgsql',
  360,
  NULL,
  '{"official":true,"auth_required":false,"format":"OCDS 1.1.5","publisher":"Cabinet Office","license":"Open Government Licence"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "name"=excluded."name",
  "sourceType"=excluded."sourceType",
  "endpoint"=excluded."endpoint",
  "active"=true,
  "priority"=excluded."priority",
  "productFocus"=excluded."productFocus",
  "marketFocus"=excluded."marketFocus",
  "collector"=excluded."collector",
  "cadenceMinutes"=excluded."cadenceMinutes",
  "lastError"=NULL,
  "config"=excluded."config",
  "updatedAt"=now();

CREATE OR REPLACE FUNCTION public.queue_find_tender_fetch()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  run_id UUID;
  req_id BIGINT;
  from_ts TEXT := to_char((current_date - 14),'YYYY-MM-DD') || 'T00:00:00';
  to_ts TEXT := to_char((current_date + 1),'YYYY-MM-DD') || 'T00:00:00';
  fetch_url TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "DemandCollectorRun"
    WHERE "sourceId"='uk-find-a-tender'
      AND "status"='RUNNING'
      AND "startedAt" > now() - interval '20 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO "DemandCollectorRun" ("sourceId","status","metadata")
  VALUES ('uk-find-a-tender','RUNNING',jsonb_build_object('mode','pg_net','window_days',14,'limit',100))
  RETURNING "id" INTO run_id;

  fetch_url :=
    'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages'
    || '?updatedFrom=' || from_ts
    || '&updatedTo=' || to_ts
    || '&stages=tender'
    || '&limit=100';

  SELECT net.http_get(
    url := fetch_url,
    headers := '{"Accept":"application/json","User-Agent":"Septlion-Demand-Intelligence/1.0"}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO req_id;

  UPDATE "DemandCollectorRun"
  SET "externalRequestIds"=jsonb_build_array(req_id)
  WHERE "id"=run_id;

  INSERT INTO "DemandCollectorState" ("source","lastAttemptAt","lastAccepted","lastError")
  VALUES ('UK Find a Tender',now(),0,NULL)
  ON CONFLICT ("source") DO UPDATE SET
    "lastAttemptAt"=excluded."lastAttemptAt",
    "lastError"=NULL;

  RETURN run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_find_tender_fetch() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ingest_find_tender_fetch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  r RECORD;
  request_id BIGINT;
  http_row RECORD;
  payload JSONB;
  rel JSONB;
  scanned_count INTEGER := 0;
  accepted_count INTEGER := 0;
  deadline_text TEXT;
  tender_status TEXT;
  buyer_name TEXT;
  source_record_id TEXT;
  source_url TEXT;
  product_text TEXT;
  signal_score INTEGER;
  signal_status "DemandSignalStatus";
  signal_stage "DemandOpportunityStage";
  saved_id UUID;
  raw_text TEXT;
BEGIN
  SELECT *
  INTO r
  FROM "DemandCollectorRun"
  WHERE "sourceId"='uk-find-a-tender'
    AND "status"='RUNNING'
    AND "startedAt" < now() - interval '10 seconds'
  ORDER BY "startedAt" DESC
  LIMIT 1;

  IF NOT FOUND OR r."externalRequestIds" IS NULL THEN
    RETURN 0;
  END IF;

  SELECT (value::text)::bigint
  INTO request_id
  FROM jsonb_array_elements(r."externalRequestIds")
  LIMIT 1;

  SELECT id,status_code,error_msg,content
  INTO http_row
  FROM net._http_response
  WHERE id=request_id
  ORDER BY created DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN 0; END IF;

  IF http_row.status_code <> 200 OR http_row.error_msg IS NOT NULL THEN
    UPDATE "DemandCollectorRun"
      SET "status"='FAILED',
          "error"=coalesce(http_row.error_msg,'HTTP '||http_row.status_code::text),
          "finishedAt"=now()
    WHERE "id"=r."id";

    UPDATE "DemandSource"
      SET "lastError"=coalesce(http_row.error_msg,'HTTP '||http_row.status_code::text),
          "updatedAt"=now()
    WHERE "id"='uk-find-a-tender';

    RETURN 0;
  END IF;

  payload := http_row.content::jsonb;
  scanned_count := coalesce(jsonb_array_length(payload->'releases'),0);

  FOR rel IN
    SELECT value FROM jsonb_array_elements(coalesce(payload->'releases','[]'::jsonb))
  LOOP
    IF NOT ((rel->'tag') ? 'tender') THEN CONTINUE; END IF;

    raw_text := lower(coalesce(rel::text,''));
    IF raw_text NOT LIKE '%156121%'
       AND raw_text NOT LIKE '%wheat flour%'
       AND raw_text NOT LIKE '%breadmaking flour%'
       AND raw_text NOT LIKE '%wholemeal flour%'
       AND raw_text NOT LIKE '%plain flour%'
    THEN
      CONTINUE;
    END IF;

    tender_status := lower(coalesce(rel #>> '{tender,status}',''));
    IF tender_status IN ('complete','cancelled') THEN CONTINUE; END IF;

    deadline_text := rel #>> '{tender,tenderPeriod,endDate}';
    IF deadline_text IS NOT NULL AND deadline_text <> '' THEN
      BEGIN
        IF deadline_text::timestamptz <= now() THEN CONTINUE; END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    source_record_id := coalesce(rel->>'id',rel->>'ocid');
    IF source_record_id IS NULL THEN CONTINUE; END IF;

    buyer_name := coalesce(rel #>> '{buyer,name}',NULL);
    product_text := coalesce(rel #>> '{tender,title}',rel #>> '{tender,description}',rel->>'description','Wheat flour procurement');
    source_url := 'https://www.find-tender.service.gov.uk/Notice/' || source_record_id;

    signal_score := 60;
    IF buyer_name IS NOT NULL THEN signal_score := signal_score + 10; END IF;
    IF deadline_text IS NOT NULL THEN signal_score := signal_score + 10; END IF;
    IF source_url IS NOT NULL THEN signal_score := signal_score + 10; END IF;
    signal_score := least(signal_score,100);

    signal_status := CASE
      WHEN signal_score >= 75 THEN 'QUALIFY_NOW'::"DemandSignalStatus"
      WHEN signal_score >= 55 THEN 'RESOLVE_BUYER'::"DemandSignalStatus"
      ELSE 'WATCH'::"DemandSignalStatus"
    END;

    signal_stage := CASE
      WHEN signal_score >= 75 THEN 'QUALIFICATION'::"DemandOpportunityStage"
      WHEN signal_score >= 55 THEN 'BUYER_RESOLUTION'::"DemandOpportunityStage"
      ELSE 'DETECTED'::"DemandOpportunityStage"
    END;

    INSERT INTO "DemandSignal"
      ("source","sourceRecordId","sourceUrl","type","status","stage","market","product","productKey",
       "quantity","buyerName","publishedAt","deadlineAt","evidence","score","verification",
       "intentPageCandidate","raw","lastSeenAt")
    VALUES
      (
        'UK Find a Tender',source_record_id,source_url,'TENDER',signal_status,signal_stage,
        'United Kingdom',product_text,'wheat_flour',
        NULL,buyer_name,
        nullif(rel->>'date','')::timestamptz,
        CASE WHEN deadline_text IS NULL OR deadline_text='' THEN NULL ELSE deadline_text::timestamptz END,
        jsonb_build_object(
          'officialSource',true,
          'ocds',true,
          'cpv',rel #>> '{tender,classification,id}',
          'procurementMethod',rel #>> '{tender,procurementMethod}',
          'procurementMethodDetails',rel #>> '{tender,procurementMethodDetails}',
          'estimatedValue',rel #> '{tender,value}',
          'submissionMethodDetails',rel #>> '{tender,submissionMethodDetails}',
          'sourceLicense',payload->>'license'
        ),
        signal_score,'OFFICIAL_SOURCE_SIGNAL',
        signal_score>=70,rel,now()
      )
    ON CONFLICT ("source","sourceRecordId") DO UPDATE SET
      "sourceUrl"=excluded."sourceUrl",
      "status"=excluded."status",
      "stage"=excluded."stage",
      "market"=excluded."market",
      "product"=excluded."product",
      "productKey"=excluded."productKey",
      "buyerName"=excluded."buyerName",
      "publishedAt"=excluded."publishedAt",
      "deadlineAt"=excluded."deadlineAt",
      "evidence"=excluded."evidence",
      "score"=excluded."score",
      "verification"=excluded."verification",
      "intentPageCandidate"=excluded."intentPageCandidate",
      "raw"=excluded."raw",
      "lastSeenAt"=now()
    RETURNING "id" INTO saved_id;

    accepted_count := accepted_count + 1;

    INSERT INTO "DemandOpportunityEvent"
      ("signalId","stage","eventType","note","metadata")
    VALUES
      (
        saved_id,signal_stage,'COLLECTOR_REFRESH',
        'Signal discovered or refreshed by UK Find a Tender collector.',
        jsonb_build_object('sourceId','uk-find-a-tender')
      );
  END LOOP;

  UPDATE "DemandCollectorRun"
  SET "status"='SUCCESS',"scanned"=scanned_count,"accepted"=accepted_count,"finishedAt"=now()
  WHERE "id"=r."id";

  UPDATE "DemandCollectorState"
  SET "lastSuccessAt"=now(),"lastAccepted"=accepted_count,"lastError"=NULL
  WHERE "source"='UK Find a Tender';

  UPDATE "DemandSource"
  SET "active"=true,"lastSuccessAt"=now(),"lastError"=NULL,"updatedAt"=now()
  WHERE "id"='uk-find-a-tender';

  RETURN accepted_count;
EXCEPTION WHEN OTHERS THEN
  UPDATE "DemandCollectorRun"
  SET "status"='FAILED',"error"=SQLERRM,"finishedAt"=now()
  WHERE "id"=r."id";

  UPDATE "DemandSource"
  SET "lastError"=SQLERRM,"updatedAt"=now()
  WHERE "id"='uk-find-a-tender';

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_find_tender_fetch() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('septlion-find-tender-6h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('septlion-find-tender-ingest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'septlion-find-tender-6h',
  '7 */6 * * *',
  $$SELECT public.queue_find_tender_fetch();$$
);

SELECT cron.schedule(
  'septlion-find-tender-ingest',
  '9 */6 * * *',
  $$SELECT public.ingest_find_tender_fetch();$$
);
