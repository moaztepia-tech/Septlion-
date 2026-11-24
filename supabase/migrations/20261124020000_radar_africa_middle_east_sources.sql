-- Radar: read TradeWheel's public "wheat flour buyers in <country>" pages for the
-- countries SEPTLION targets in Africa and the Middle East. The global pages the radar
-- already reads are dominated by Europe, North America and Asia; the country pages
-- surface buyers in Nigeria, Ghana, Libya, Jordan, Cameroon, Djibouti, Kenya and others.
--
-- This is a separate collector with its own source row and cron jobs, so the existing
-- platform-buyers collector is not changed. Same rules as that collector: public pages
-- only, no login bypass, contact stays on the platform, leads older than 60 days are
-- skipped, and signals go through public.upsert_platform_buyer_signal.
-- It runs at :17 and :21 every six hours, before the demand clusters refresh at :27.

INSERT INTO public."DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","marketFocus","collector","cadenceMinutes","config")
VALUES (
  'tradewheel-country-buyers',
  'TradeWheel Country Buy Requests — Africa & Middle East',
  'HTML',
  'https://www.tradewheel.com/buyers/wheat-flour/<country>/',
  true,
  80,
  ARRAY['wheat_flour'],
  ARRAY['Africa','Middle East'],
  'pg_net + plpgsql',
  360,
  jsonb_build_object(
    'policy','public pages only; no login bypass',
    'platform',true,
    'contact_gate','platform',
    'public_buy_leads',true,
    -- Country slugs that returned a TradeWheel buyer page on 2026-11-24.
    'countries',jsonb_build_array(
      'egypt','libya','nigeria','kenya','ethiopia','ghana','saudi-arabia','iraq','yemen','jordan',
      'morocco','djibouti','senegal','cameroon','oman','qatar','kuwait','lebanon','uganda','angola'
    )
  )
)
ON CONFLICT ("id") DO NOTHING;

-- Parse one TradeWheel buyer page. Returns the number of signals accepted.
CREATE OR REPLACE FUNCTION public.ingest_tradewheel_buyer_page(p_content TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  accepted INTEGER := 0;
BEGIN
  IF p_content IS NULL THEN RETURN 0; END IF;
  FOR card IN
    SELECT part FROM regexp_split_to_table(p_content, '<div class="col-xs-12 col-sm-6 col-md-4 col-lg-4 buyffer-list">') part
    WHERE part LIKE '%b-info-title-h%' AND lower(part) LIKE '%wheat flour%'
  LOOP
    m := regexp_match(card, '<a href="([^"]+)" title="([^"]+)"');
    IF m IS NULL THEN CONTINUE; END IF;
    source_url := m[1];
    title_text := regexp_replace(m[2], '<[^>]+>', '', 'g');

    m := regexp_match(card, '<div class="b-info-desc"><p>([^<]*)</p>');
    description_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;
    m := regexp_match(card, '<div class="b-info-left">\s*<p>([^<]*)</p>');
    buyer_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;
    m := regexp_match(card, '<div class="b-info-left">\s*<p>[^<]*</p>\s*<p>\s*([^<]*?)\s*</p>');
    country_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;
    m := regexp_match(card, 'Date Posted:\s*([^<]+)</p>');
    posted_text := CASE WHEN m IS NULL THEN NULL ELSE trim(m[1]) END;

    -- Undated or unparseable leads ("Over 1 year ago") are skipped, not stamped as new.
    BEGIN
      published_ts := to_date(replace(replace(posted_text, ',', ''), '-', ' '), 'DD Mon YYYY')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
    IF published_ts IS NULL OR published_ts < now() - interval '60 days' THEN CONTINUE; END IF;

    m := regexp_match(source_url, '/([0-9]+)/?$');
    lead_id := CASE WHEN m IS NULL THEN md5(source_url) ELSE m[1] END;
    m := regexp_match(coalesce(title_text, '') || ' ' || coalesce(description_text, ''),
      '([0-9][0-9,.]*[[:space:]]*(MT|metric tons?|tonnes?|tons?|containers?|twenty-foot container))', 'i');
    quantity_text := CASE WHEN m IS NULL THEN NULL ELSE m[1] END;

    -- Same source name and record id as the global TradeWheel collector, so a lead seen on
    -- both pages is one signal, not two.
    PERFORM public.upsert_platform_buyer_signal(
      'TradeWheel', lead_id, source_url, buyer_text, country_text, title_text, quantity_text,
      published_ts, description_text,
      jsonb_build_object('platform', 'TradeWheel', 'contactViaPlatform', true, 'collector', 'tradewheel-country-buyers')
    );
    accepted := accepted + 1;
  END LOOP;
  RETURN accepted;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_tradewheel_country_fetch()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  run_id UUID;
  slug TEXT;
  req BIGINT;
  ids JSONB := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "DemandSource" WHERE "id" = 'tradewheel-country-buyers' AND "active") THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM "DemandCollectorRun"
    WHERE "sourceId" = 'tradewheel-country-buyers' AND "status" = 'RUNNING' AND "startedAt" > now() - interval '20 minutes'
  ) THEN RETURN NULL; END IF;

  INSERT INTO "DemandCollectorRun" ("sourceId", "status", "metadata")
  VALUES ('tradewheel-country-buyers', 'RUNNING', jsonb_build_object('productKey', 'wheat_flour'))
  RETURNING "id" INTO run_id;

  FOR slug IN
    SELECT jsonb_array_elements_text("config"->'countries') FROM "DemandSource" WHERE "id" = 'tradewheel-country-buyers'
  LOOP
    IF slug !~ '^[a-z-]+$' THEN CONTINUE; END IF;
    SELECT net.http_get(
      url := 'https://www.tradewheel.com/buyers/wheat-flour/' || slug || '/',
      headers := '{"Accept":"text/html","User-Agent":"Septlion-Demand-Intelligence/1.0"}'::jsonb,
      timeout_milliseconds := 15000
    ) INTO req;
    ids := ids || jsonb_build_array(jsonb_build_object('country', slug, 'requestId', req));
  END LOOP;

  UPDATE "DemandCollectorRun"
  SET "externalRequestIds" = (SELECT coalesce(jsonb_agg(x->'requestId'), '[]'::jsonb) FROM jsonb_array_elements(ids) x),
      "metadata" = "metadata" || jsonb_build_object('requests', ids)
  WHERE "id" = run_id;
  RETURN run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_tradewheel_country_fetch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  r RECORD;
  x JSONB;
  http RECORD;
  v_accepted INTEGER := 0;
  pages INTEGER := 0;
  failed TEXT[] := '{}';
BEGIN
  SELECT * INTO r FROM "DemandCollectorRun"
  WHERE "sourceId" = 'tradewheel-country-buyers' AND "status" = 'RUNNING' AND "startedAt" < now() - interval '15 seconds'
  ORDER BY "startedAt" DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR x IN SELECT jsonb_array_elements(coalesce(r."metadata"->'requests', '[]'::jsonb)) LOOP
    SELECT status_code, error_msg, content INTO http
    FROM net._http_response WHERE id = (x->>'requestId')::bigint ORDER BY created DESC LIMIT 1;
    IF FOUND AND http.status_code = 200 AND http.error_msg IS NULL THEN
      pages := pages + 1;
      v_accepted := v_accepted + public.ingest_tradewheel_buyer_page(http.content);
    ELSE
      failed := failed || (x->>'country');
    END IF;
  END LOOP;

  UPDATE "DemandSource"
  SET "lastSuccessAt" = CASE WHEN pages > 0 THEN now() ELSE "lastSuccessAt" END,
      "lastError" = CASE WHEN cardinality(failed) > 0 THEN 'No page for: ' || array_to_string(failed, ', ') ELSE NULL END,
      "updatedAt" = now()
  WHERE "id" = 'tradewheel-country-buyers';

  UPDATE "DemandCollectorRun"
  SET "status" = 'SUCCESS', "scanned" = pages, "accepted" = v_accepted, "finishedAt" = now()
  WHERE "id" = r."id";
  RETURN v_accepted;
EXCEPTION WHEN OTHERS THEN
  UPDATE "DemandCollectorRun" SET "status" = 'FAILED', "error" = SQLERRM, "finishedAt" = now() WHERE "id" = r."id";
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_tradewheel_buyer_page(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_tradewheel_country_fetch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_tradewheel_country_fetch() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('septlion-tradewheel-country-6h', '17 */6 * * *', 'SELECT public.queue_tradewheel_country_fetch();');
SELECT cron.schedule('septlion-tradewheel-country-ingest', '21 */6 * * *', 'SELECT public.ingest_tradewheel_country_fetch();');
