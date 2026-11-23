
ALTER TABLE "DemandSignal"
  ADD COLUMN IF NOT EXISTS "productKey" TEXT;

UPDATE "DemandSignal"
SET "productKey" = 'wheat_flour'
WHERE "productKey" IS NULL
  AND lower("product") LIKE '%flour%';

ALTER TABLE "PublicDemandSignal"
  ADD COLUMN IF NOT EXISTS "productKey" TEXT;

CREATE TABLE IF NOT EXISTS "DemandPattern" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productKey" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "signalCount" INTEGER NOT NULL DEFAULT 0,
  "firstObservedAt" TIMESTAMPTZ,
  "lastObservedAt" TIMESTAMPTZ,
  "avgIntervalDays" NUMERIC(10,2),
  "predictedWindowStart" TIMESTAMPTZ,
  "predictedWindowEnd" TIMESTAMPTZ,
  "confidence" INTEGER NOT NULL DEFAULT 0 CHECK ("confidence" BETWEEN 0 AND 100),
  "patternStatus" TEXT NOT NULL DEFAULT 'INSUFFICIENT'
    CHECK ("patternStatus" IN ('INSUFFICIENT','EMERGING','RECURRING')),
  "basis" JSONB,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("productKey","market")
);

ALTER TABLE "DemandPattern" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandPattern" FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS "DemandPattern_product_confidence_idx"
  ON "DemandPattern"("productKey","confidence" DESC);

CREATE OR REPLACE FUNCTION public.refresh_demand_patterns()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.refresh_demand_patterns() FROM PUBLIC, anon, authenticated;

-- Keep the public projection synchronized with productKey.
CREATE OR REPLACE FUNCTION public.sync_public_demand_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "PublicDemandSignal" WHERE "id" = OLD."id";
    RETURN OLD;
  END IF;

  IF NEW."status" = 'ARCHIVED' THEN
    DELETE FROM "PublicDemandSignal" WHERE "id" = NEW."id";
    RETURN NEW;
  END IF;

  INSERT INTO "PublicDemandSignal"
    ("id","type","market","product","productKey","quantity","publishedAt","deadlineAt","status","stage","score","sourceUrl","updatedAt")
  VALUES
    (NEW."id",NEW."type"::text,NEW."market",NEW."product",NEW."productKey",NEW."quantity",NEW."publishedAt",NEW."deadlineAt",
     NEW."status"::text,NEW."stage"::text,NEW."score",NEW."sourceUrl",now())
  ON CONFLICT ("id") DO UPDATE SET
    "type"=excluded."type",
    "market"=excluded."market",
    "product"=excluded."product",
    "productKey"=excluded."productKey",
    "quantity"=excluded."quantity",
    "publishedAt"=excluded."publishedAt",
    "deadlineAt"=excluded."deadlineAt",
    "status"=excluded."status",
    "stage"=excluded."stage",
    "score"=excluded."score",
    "sourceUrl"=excluded."sourceUrl",
    "updatedAt"=now();

  RETURN NEW;
END;
$$;

UPDATE "DemandSignal" SET "lastSeenAt"="lastSeenAt" WHERE "productKey" IS NOT NULL;

SELECT public.refresh_demand_patterns();

DO $$
BEGIN
  PERFORM cron.unschedule('septlion-demand-patterns-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'septlion-demand-patterns-daily',
  '41 2 * * *',
  $$SELECT public.refresh_demand_patterns();$$
);
