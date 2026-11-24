
-- Platform buying requests: buyer-first collectors for public B2B buy-lead pages.

INSERT INTO "DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","marketFocus","collector","cadenceMinutes","lastError","config")
VALUES
(
  'tradewheel-buyers',
  'TradeWheel Buy Requests',
  'HTML',
  'https://www.tradewheel.com/buyers/wheat-flour/',
  true,
  92,
  ARRAY['wheat_flour'],
  ARRAY['Global'],
  'pg_net + plpgsql',
  360,
  NULL,
  '{"platform":true,"public_buy_leads":true,"contact_gate":"platform","policy":"public pages only; no login bypass"}'::jsonb
),
(
  'go4worldbusiness-buyers',
  'go4WorldBusiness Buy Leads',
  'HTML',
  'https://www.go4worldbusiness.com/buyers/wheat-flour.html',
  true,
  94,
  ARRAY['wheat_flour'],
  ARRAY['Global'],
  'pg_net + plpgsql',
  360,
  NULL,
  '{"platform":true,"public_buy_leads":true,"contact_gate":"platform","policy":"public pages only; no login bypass"}'::jsonb
),
(
  'freshdi-buyers',
  'Freshdi Buy Requests',
  'HTML',
  'https://freshdi.com/request/',
  false,
  90,
  ARRAY['wheat_flour'],
  ARRAY['Global'],
  NULL,
  360,
  'SERVER_FETCH_403',
  '{"platform":true,"public_buy_leads":true,"note":"Individual public request pages are indexed externally, but direct server fetch currently returns 403; no bypass attempted."}'::jsonb
),
(
  'exporthub-buyers',
  'ExportHub RFQs',
  'HTML',
  'https://www.exporthub.com/importers/wheat-flour/',
  false,
  82,
  ARRAY['wheat_flour'],
  ARRAY['Global'],
  NULL,
  360,
  'SERVER_FETCH_TIMEOUT',
  '{"platform":true,"public_buy_leads":true,"note":"Public buyer page is externally discoverable; server fetch timed out during validation."}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "name"=excluded."name",
  "sourceType"=excluded."sourceType",
  "endpoint"=excluded."endpoint",
  "active"=excluded."active",
  "priority"=excluded."priority",
  "productFocus"=excluded."productFocus",
  "marketFocus"=excluded."marketFocus",
  "collector"=excluded."collector",
  "cadenceMinutes"=excluded."cadenceMinutes",
  "lastError"=excluded."lastError",
  "config"=excluded."config",
  "updatedAt"=now();

CREATE OR REPLACE FUNCTION public.queue_platform_buyers_fetch()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  run_id UUID;
  tw_req BIGINT;
  g4_req BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "DemandCollectorRun"
    WHERE "sourceId"='platform-buyers'
      AND "status"='RUNNING'
      AND "startedAt" > now() - interval '20 minutes'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO "DemandCollectorRun" ("sourceId","status","metadata")
  VALUES (
    'platform-buyers',
    'RUNNING',
    jsonb_build_object('sources',jsonb_build_array('tradewheel-buyers','go4worldbusiness-buyers'),'productKey','wheat_flour')
  )
  RETURNING "id" INTO run_id;

  SELECT net.http_get(
    url := 'https://www.tradewheel.com/buyers/wheat-flour/',
    headers := '{"Accept":"text/html","User-Agent":"Septlion-Demand-Intelligence/1.0"}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO tw_req;

  SELECT net.http_get(
    url := 'https://www.go4worldbusiness.com/buyers/wheat-flour.html',
    headers := '{"Accept":"text/html","User-Agent":"Septlion-Demand-Intelligence/1.0"}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO g4_req;

  UPDATE "DemandCollectorRun"
  SET "externalRequestIds"=jsonb_build_array(tw_req,g4_req),
      "metadata"="metadata" || jsonb_build_object('tradewheelRequestId',tw_req,'g4wbRequestId',g4_req)
  WHERE "id"=run_id;

  RETURN run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_platform_buyers_fetch() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_platform_buyer_signal(
  p_source TEXT,
  p_source_record_id TEXT,
  p_source_url TEXT,
  p_buyer_name TEXT,
  p_country TEXT,
  p_product TEXT,
  p_quantity TEXT,
  p_published_at TIMESTAMPTZ,
  p_description TEXT,
  p_evidence JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.upsert_platform_buyer_signal(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ingest_platform_buyers_fetch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  r RECORD;
  tw_req BIGINT;
  g4_req BIGINT;
  tw_http RECORD;
  g4_http RECORD;
  card TEXT;
  m TEXT[];
  source_url TEXT;
  title_text TEXT;
  description_text TEXT;
  buyer_text TEXT;
  country_text TEXT;
  posted_text TEXT;
  quantity_text TEXT;
  lead_id TEXT;
  published_ts TIMESTAMPTZ;
  accepted_count INTEGER := 0;
  scanned_count INTEGER := 0;
  platform_verified BOOLEAN;
BEGIN
  SELECT * INTO r
  FROM "DemandCollectorRun"
  WHERE "sourceId"='platform-buyers'
    AND "status"='RUNNING'
    AND "startedAt" < now() - interval '15 seconds'
  ORDER BY "startedAt" DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN 0; END IF;

  tw_req := nullif(r."metadata"->>'tradewheelRequestId','')::bigint;
  g4_req := nullif(r."metadata"->>'g4wbRequestId','')::bigint;

  SELECT id,status_code,error_msg,content INTO tw_http
  FROM net._http_response WHERE id=tw_req ORDER BY created DESC LIMIT 1;
  SELECT id,status_code,error_msg,content INTO g4_http
  FROM net._http_response WHERE id=g4_req ORDER BY created DESC LIMIT 1;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- TradeWheel cards
  IF tw_http.status_code=200 AND tw_http.error_msg IS NULL THEN
    FOR card IN
      SELECT part
      FROM regexp_split_to_table(
        tw_http.content,
        '<div class="col-xs-12 col-sm-6 col-md-4 col-lg-4 buyffer-list">'
      ) part
      WHERE part LIKE '%b-info-title-h%'
        AND lower(part) LIKE '%wheat flour%'
    LOOP
      scanned_count := scanned_count + 1;

      m := regexp_match(card,'<a href="([^"]+)" title="([^"]+)"');
      IF m IS NULL THEN CONTINUE; END IF;
      source_url := m[1];
      title_text := regexp_replace(m[2],'<[^>]+>','','g');

      m := regexp_match(card,'<div class="b-info-desc"><p>([^<]*)</p>');
      description_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;

      m := regexp_match(card,'<div class="b-info-left">\s*<p>([^<]*)</p>');
      buyer_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;

      m := regexp_match(card,'<div class="b-info-left">\s*<p>[^<]*</p>\s*<p>\s*([^<]*?)\s*</p>');
      country_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;

      m := regexp_match(card,'Date Posted:\s*([^<]+)</p>');
      posted_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;

      BEGIN
        published_ts := to_date(replace(replace(posted_text,',',''),'-',' '),'DD Mon YYYY')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        published_ts := now();
      END;

      IF published_ts < now() - interval '60 days' THEN CONTINUE; END IF;

      m := regexp_match(source_url,'/([0-9]+)/?$');
      lead_id := CASE WHEN m IS NULL THEN md5(source_url) ELSE m[1] END;

      m := regexp_match(coalesce(title_text,'')||' '||coalesce(description_text,''),
        '([0-9][0-9,.]*[[:space:]]*(MT|metric tons?|tonnes?|tons?|containers?|twenty-foot container))','i');
      quantity_text := CASE WHEN m IS NULL THEN NULL ELSE m[1] END;

      PERFORM public.upsert_platform_buyer_signal(
        'TradeWheel',
        lead_id,
        source_url,
        buyer_text,
        country_text,
        title_text,
        quantity_text,
        published_ts,
        description_text,
        jsonb_build_object('platform','TradeWheel','contactViaPlatform',true)
      );
      accepted_count := accepted_count + 1;
    END LOOP;

    UPDATE "DemandSource"
    SET "lastSuccessAt"=now(),"lastError"=NULL,"updatedAt"=now()
    WHERE "id"='tradewheel-buyers';
  ELSE
    UPDATE "DemandSource"
    SET "lastError"=coalesce(tw_http.error_msg,'HTTP '||coalesce(tw_http.status_code::text,'NO_RESPONSE')),
        "updatedAt"=now()
    WHERE "id"='tradewheel-buyers';
  END IF;

  -- go4WorldBusiness cards
  IF g4_http.status_code=200 AND g4_http.error_msg IS NULL THEN
    FOR card IN
      SELECT part
      FROM regexp_split_to_table(
        g4_http.content,
        '<!-- Top row - Membership type, Verified/Archived and date -->'
      ) part
      WHERE part LIKE '%/buylead/view/%'
        AND lower(part) LIKE '%wheat flour%'
    LOOP
      scanned_count := scanned_count + 1;

      m := regexp_match(card,'href="(/buylead/view/([0-9]+)/[^"]+)"');
      IF m IS NULL THEN CONTINUE; END IF;
      source_url := 'https://www.go4worldbusiness.com'||m[1];
      lead_id := m[2];

      m := regexp_match(card,'entity-row-title[^>]*>\s*<span>\s*([^<]+)');
      title_text := CASE WHEN m IS NULL THEN 'Wheat Flour Buy Lead' ELSE trim(regexp_replace(m[1],'\s+',' ','g')) END;

      m := regexp_match(card,'Buyer From\s*([^<]+)</span>');
      country_text := CASE WHEN m IS NULL THEN NULL ELSE trim(regexp_replace(m[1],'\s+',' ','g')) END;

      m := regexp_match(card,'Quantity Required:\s*</span>\s*<span[^>]*>\s*([^<]+)');
      quantity_text := CASE WHEN m IS NULL THEN NULL ELSE trim(regexp_replace(m[1],'\s+',' ','g')) END;

      m := regexp_match(card,'Contact\s*:\s*([^<\r\n]+)');
      buyer_text := CASE WHEN m IS NULL THEN NULL ELSE trim(regexp_replace(m[1],'\s+',' ','g')) END;

      m := regexp_match(card,'<small>\s*([A-Z][a-z]{2}-[0-9]{2}-[0-9]{2})\s*</small>');
      posted_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;

      BEGIN
        published_ts := to_date(posted_text,'Mon-DD-YY')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        published_ts := now();
      END;

      IF published_ts < now() - interval '60 days' THEN CONTINUE; END IF;

      platform_verified := card LIKE '%item-verified-div%';

      m := regexp_match(card,'Product Description\s*</div>.*?<div[^>]*entity-row-description-search[^>]*>\s*([^<]+)','is');
      description_text := CASE WHEN m IS NULL THEN title_text ELSE trim(regexp_replace(m[1],'\s+',' ','g')) END;

      PERFORM public.upsert_platform_buyer_signal(
        'go4WorldBusiness',
        lead_id,
        source_url,
        buyer_text,
        country_text,
        title_text,
        quantity_text,
        published_ts,
        description_text,
        jsonb_build_object(
          'platform','go4WorldBusiness',
          'platformVerifiedBadge',platform_verified,
          'contactViaPlatform',true,
          'platformVerificationIsNotSeptlionVerification',true
        )
      );
      accepted_count := accepted_count + 1;
    END LOOP;

    UPDATE "DemandSource"
    SET "lastSuccessAt"=now(),"lastError"=NULL,"updatedAt"=now()
    WHERE "id"='go4worldbusiness-buyers';
  ELSE
    UPDATE "DemandSource"
    SET "lastError"=coalesce(g4_http.error_msg,'HTTP '||coalesce(g4_http.status_code::text,'NO_RESPONSE')),
        "updatedAt"=now()
    WHERE "id"='go4worldbusiness-buyers';
  END IF;

  UPDATE "DemandCollectorRun"
  SET "status"='SUCCESS',
      "scanned"=scanned_count,
      "accepted"=accepted_count,
      "finishedAt"=now()
  WHERE "id"=r."id";

  RETURN accepted_count;
EXCEPTION WHEN OTHERS THEN
  UPDATE "DemandCollectorRun"
  SET "status"='FAILED',"error"=SQLERRM,"finishedAt"=now()
  WHERE "id"=r."id";

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_platform_buyers_fetch() FROM PUBLIC, anon, authenticated;

-- Collector run registry needs a synthetic source row for the combined platform sweep.
INSERT INTO "DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","marketFocus","collector","cadenceMinutes","config")
VALUES
(
  'platform-buyers',
  'B2B Platform Buyer Sweep',
  'FEED',
  'multiple-public-platforms',
  true,
  96,
  ARRAY['wheat_flour'],
  ARRAY['Global'],
  'pg_net + plpgsql',
  360,
  '{"children":["tradewheel-buyers","go4worldbusiness-buyers"],"purpose":"buyer-first public buy-request discovery"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "active"=true,"priority"=excluded."priority","collector"=excluded."collector",
  "cadenceMinutes"=excluded."cadenceMinutes","config"=excluded."config","updatedAt"=now();

DO $$
BEGIN PERFORM cron.unschedule('septlion-platform-buyers-6h');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN PERFORM cron.unschedule('septlion-platform-buyers-ingest');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'septlion-platform-buyers-6h',
  '23 */6 * * *',
  $$SELECT public.queue_platform_buyers_fetch();$$
);

SELECT cron.schedule(
  'septlion-platform-buyers-ingest',
  '25 */6 * * *',
  $$SELECT public.ingest_platform_buyers_fetch();$$
);
