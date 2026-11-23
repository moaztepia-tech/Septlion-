
ALTER TABLE "DemandCollectorRun"
  ADD COLUMN IF NOT EXISTS "externalRequestIds" JSONB,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE OR REPLACE FUNCTION public.queue_contracts_finder_fetch()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  run_id UUID;
  req_ids JSONB := '[]'::jsonb;
  req_id BIGINT;
  p INTEGER;
  from_date TEXT := to_char((current_date - 14),'YYYY-MM-DD');
  to_date TEXT := to_char(current_date,'YYYY-MM-DD');
  fetch_url TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "DemandCollectorRun"
    WHERE "sourceId"='uk-contracts-finder'
      AND "status"='RUNNING'
      AND "startedAt" > now() - interval '20 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO "DemandCollectorRun" ("sourceId","status","metadata")
  VALUES ('uk-contracts-finder','RUNNING',jsonb_build_object('mode','pg_net','pages',5))
  RETURNING "id" INTO run_id;

  FOR p IN 1..5 LOOP
    fetch_url :=
      'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search'
      || '?publishedFrom=' || from_date
      || '&publishedTo=' || to_date
      || '&stages=tender'
      || '&orderBy=publishedDate'
      || '&order=DESC'
      || '&size=100'
      || '&page=' || p::text;

    SELECT net.http_get(
      url := fetch_url,
      headers := '{"Accept":"application/json","User-Agent":"Septlion-Demand-Intelligence/1.0"}'::jsonb,
      timeout_milliseconds := 15000
    ) INTO req_id;

    req_ids := req_ids || to_jsonb(req_id);
  END LOOP;

  UPDATE "DemandCollectorRun"
  SET "externalRequestIds"=req_ids
  WHERE "id"=run_id;

  INSERT INTO "DemandCollectorState" ("source","lastAttemptAt","lastAccepted","lastError")
  VALUES ('UK Contracts Finder',now(),0,NULL)
  ON CONFLICT ("source") DO UPDATE SET
    "lastAttemptAt"=excluded."lastAttemptAt",
    "lastError"=NULL;

  RETURN run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_contracts_finder_fetch() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ingest_contracts_finder_fetch()
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
BEGIN
  SELECT *
  INTO r
  FROM "DemandCollectorRun"
  WHERE "sourceId"='uk-contracts-finder'
    AND "status"='RUNNING'
    AND "startedAt" < now() - interval '20 seconds'
  ORDER BY "startedAt" DESC
  LIMIT 1;

  IF NOT FOUND OR r."externalRequestIds" IS NULL THEN
    RETURN 0;
  END IF;

  FOR request_id IN
    SELECT (value::text)::bigint
    FROM jsonb_array_elements(r."externalRequestIds")
  LOOP
    SELECT id,status_code,error_msg,content
    INTO http_row
    FROM net._http_response
    WHERE id=request_id
    ORDER BY created DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN 0;
    END IF;

    IF http_row.status_code <> 200 OR http_row.error_msg IS NOT NULL THEN
      UPDATE "DemandCollectorRun"
      SET "status"='FAILED',
          "error"=coalesce(http_row.error_msg,'HTTP '||http_row.status_code::text),
          "finishedAt"=now()
      WHERE "id"=r."id";

      UPDATE "DemandSource"
      SET "lastError"=coalesce(http_row.error_msg,'HTTP '||http_row.status_code::text),
          "updatedAt"=now()
      WHERE "id"='uk-contracts-finder';

      RETURN 0;
    END IF;

    payload := http_row.content::jsonb;
    scanned_count := scanned_count + coalesce(jsonb_array_length(payload->'releases'),0);

    FOR rel IN
      SELECT value
      FROM jsonb_array_elements(coalesce(payload->'releases','[]'::jsonb))
    LOOP
      IF NOT ((rel->'tag') ? 'tender') THEN CONTINUE; END IF;

      IF lower(coalesce(rel->'tender','{}'::jsonb)::text) NOT LIKE '%156121%'
         AND lower(coalesce(rel->'tender','{}'::jsonb)::text) NOT LIKE '%wheat flour%'
         AND lower(coalesce(rel->'tender','{}'::jsonb)::text) NOT LIKE '%breadmaking flour%'
         AND lower(coalesce(rel->'tender','{}'::jsonb)::text) NOT LIKE '%wholemeal flour%'
         AND lower(coalesce(rel->'tender','{}'::jsonb)::text) NOT LIKE '%plain flour%'
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

      source_record_id := coalesce(rel->>'ocid',rel->>'id');
      IF source_record_id IS NULL THEN CONTINUE; END IF;

      buyer_name := coalesce(rel #>> '{buyer,name}',NULL);
      product_text := coalesce(rel #>> '{tender,title}',rel #>> '{tender,description}','Wheat flour procurement');

      IF (rel->>'id') ~ '^[0-9a-fA-F-]{36}' THEN
        source_url := 'https://www.contractsfinder.service.gov.uk/Notice/' || substring(rel->>'id' from 1 for 36);
      ELSE
        source_url := NULL;
      END IF;

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
          'UK Contracts Finder',source_record_id,source_url,'TENDER',signal_status,signal_stage,
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
        (saved_id,signal_stage,'COLLECTOR_REFRESH',
         'Signal discovered or refreshed by UK Contracts Finder pg_net collector.',
         jsonb_build_object('sourceId','uk-contracts-finder'))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  UPDATE "DemandCollectorRun"
  SET "status"='SUCCESS',
      "scanned"=scanned_count,
      "accepted"=accepted_count,
      "finishedAt"=now()
  WHERE "id"=r."id";

  UPDATE "DemandCollectorState"
  SET "lastSuccessAt"=now(),
      "lastAccepted"=accepted_count,
      "lastError"=NULL
  WHERE "source"='UK Contracts Finder';

  UPDATE "DemandSource"
  SET "active"=true,
      "collector"='pg_net + plpgsql',
      "lastSuccessAt"=now(),
      "lastError"=NULL,
      "updatedAt"=now()
  WHERE "id"='uk-contracts-finder';

  RETURN accepted_count;
EXCEPTION WHEN OTHERS THEN
  UPDATE "DemandCollectorRun"
  SET "status"='FAILED',"error"=SQLERRM,"finishedAt"=now()
  WHERE "id"=r."id";

  UPDATE "DemandSource"
  SET "lastError"=SQLERRM,"updatedAt"=now()
  WHERE "id"='uk-contracts-finder';

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_contracts_finder_fetch() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('septlion-contracts-finder-6h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('septlion-contracts-finder-ingest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'septlion-contracts-finder-6h',
  '47 */6 * * *',
  $$SELECT public.queue_contracts_finder_fetch();$$
);

SELECT cron.schedule(
  'septlion-contracts-finder-ingest',
  '49 */6 * * *',
  $$SELECT public.ingest_contracts_finder_fetch();$$
);

UPDATE "DemandSource"
SET "collector"='pg_net + plpgsql',
    "active"=true,
    "lastError"=NULL,
    "updatedAt"=now()
WHERE "id"='uk-contracts-finder';
