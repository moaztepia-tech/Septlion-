
-- Buyer-first intelligence layer
DO $$ BEGIN
  CREATE TYPE "BuyerVerificationStatus" AS ENUM (
    'UNRESOLVED',
    'PROBABLE_MATCH',
    'SOURCE_IDENTIFIED',
    'VERIFIED',
    'SELF_SUBMITTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DemandBuyerProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "country" TEXT,
  "city" TEXT,
  "website" TEXT,
  "domain" TEXT,
  "buyerType" TEXT,
  "verificationStatus" "BuyerVerificationStatus" NOT NULL DEFAULT 'UNRESOLVED',
  "confidence" INTEGER NOT NULL DEFAULT 0 CHECK ("confidence" BETWEEN 0 AND 100),
  "productKeys" TEXT[] NOT NULL DEFAULT '{}',
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "signalCount" INTEGER NOT NULL DEFAULT 0,
  "firstSeenAt" TIMESTAMPTZ,
  "lastSeenAt" TIMESTAMPTZ,
  "lastBuyingSignalAt" TIMESTAMPTZ,
  "buyingIntentScore" INTEGER NOT NULL DEFAULT 0 CHECK ("buyingIntentScore" BETWEEN 0 AND 100),
  "contactReadinessScore" INTEGER NOT NULL DEFAULT 0 CHECK ("contactReadinessScore" BETWEEN 0 AND 100),
  "executionScore" INTEGER NOT NULL DEFAULT 0 CHECK ("executionScore" BETWEEN 0 AND 100),
  "evidence" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandBuyerProfile_execution_idx"
  ON "DemandBuyerProfile"("executionScore" DESC,"lastBuyingSignalAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandBuyerProfile_product_gin"
  ON "DemandBuyerProfile" USING gin ("productKeys");
CREATE INDEX IF NOT EXISTS "DemandBuyerProfile_domain_idx"
  ON "DemandBuyerProfile"("domain");

ALTER TABLE "DemandBuyerProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandBuyerProfile" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "DemandBuyerContact" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerId" UUID NOT NULL REFERENCES "DemandBuyerProfile"("id") ON DELETE CASCADE,
  "contactName" TEXT,
  "role" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "sourceUrl" TEXT,
  "isBusinessContact" BOOLEAN NOT NULL DEFAULT true,
  "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "confidence" INTEGER NOT NULL DEFAULT 0 CHECK ("confidence" BETWEEN 0 AND 100),
  "primaryContact" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandBuyerContact_buyer_idx"
  ON "DemandBuyerContact"("buyerId","primaryContact" DESC,"confidence" DESC);
CREATE INDEX IF NOT EXISTS "DemandBuyerContact_email_idx"
  ON "DemandBuyerContact"(lower("email"));

ALTER TABLE "DemandBuyerContact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandBuyerContact" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "DemandBuyerSignal" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerId" UUID NOT NULL REFERENCES "DemandBuyerProfile"("id") ON DELETE CASCADE,
  "signalId" UUID NOT NULL REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "relationship" TEXT NOT NULL DEFAULT 'BUYER',
  "confidence" INTEGER NOT NULL DEFAULT 0 CHECK ("confidence" BETWEEN 0 AND 100),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("buyerId","signalId")
);

CREATE INDEX IF NOT EXISTS "DemandBuyerSignal_signal_idx"
  ON "DemandBuyerSignal"("signalId");
CREATE INDEX IF NOT EXISTS "DemandBuyerSignal_buyer_idx"
  ON "DemandBuyerSignal"("buyerId");

ALTER TABLE "DemandBuyerSignal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandBuyerSignal" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_buyer_name(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(value,'')), '[^a-z0-9]+', ' ', 'g'));
$$;

REVOKE ALL ON FUNCTION public.normalize_buyer_name(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_buyer_profile_for_signal(target_signal UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d "DemandSignal"%ROWTYPE;
  br "DemandBuyerResolution"%ROWTYPE;
  buyer_id UUID;
  normalized TEXT;
  verification "BuyerVerificationStatus";
  confidence_value INTEGER := 0;
  recency_points INTEGER := 0;
  contact_points INTEGER := 0;
  source_points INTEGER := 0;
  volume_points INTEGER := 0;
  intent_score INTEGER := 0;
  contact_score INTEGER := 0;
  exec_score INTEGER := 0;
  product_keys TEXT[];
  primary_email TEXT;
  primary_phone TEXT;
  primary_whatsapp TEXT;
BEGIN
  SELECT * INTO d FROM "DemandSignal" WHERE "id"=target_signal;
  IF NOT FOUND OR d."buyerName" IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO br FROM "DemandBuyerResolution" WHERE "signalId"=target_signal;

  normalized := public.normalize_buyer_name(
    coalesce(nullif(br."legalEntity",''), nullif(br."buyerName",''), d."buyerName")
  );

  verification := CASE
    WHEN coalesce(br."verificationStatus",'') IN ('VERIFIED','BUYER_RESOLVED_TENDER_CORROBORATED') THEN 'VERIFIED'::"BuyerVerificationStatus"
    WHEN coalesce(br."verificationStatus",'') IN ('BUYER_SELF_SUBMITTED','SELF_SUBMITTED') THEN 'SELF_SUBMITTED'::"BuyerVerificationStatus"
    WHEN coalesce(br."verificationStatus",'') IN ('SOURCE_IDENTIFIED') THEN 'SOURCE_IDENTIFIED'::"BuyerVerificationStatus"
    WHEN coalesce(br."verificationStatus",'') LIKE 'PROBABLE%' OR coalesce(br."verificationStatus",'')='PROBABLE_MATCH' THEN 'PROBABLE_MATCH'::"BuyerVerificationStatus"
    ELSE 'UNRESOLVED'::"BuyerVerificationStatus"
  END;

  confidence_value := greatest(coalesce(br."confidence",0),
    CASE verification
      WHEN 'VERIFIED' THEN 95
      WHEN 'SELF_SUBMITTED' THEN 80
      WHEN 'SOURCE_IDENTIFIED' THEN 70
      WHEN 'PROBABLE_MATCH' THEN 55
      ELSE 20
    END);

  product_keys := CASE WHEN d."productKey" IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY[d."productKey"] END;

  -- Deduplicate conservatively: domain first if present, otherwise normalized legal/display name + country.
  SELECT p."id" INTO buyer_id
  FROM "DemandBuyerProfile" p
  WHERE
    (
      br."website" IS NOT NULL
      AND p."domain" IS NOT NULL
      AND p."domain" = regexp_replace(lower(br."website"), '^https?://(www\.)?|/.*$', '', 'g')
    )
    OR
    (
      public.normalize_buyer_name(coalesce(p."legalName",p."displayName")) = normalized
      AND coalesce(lower(p."country"),'') = coalesce(lower(br."country"), lower(split_part(d."market",' — ',1)), '')
    )
  ORDER BY p."confidence" DESC
  LIMIT 1;

  IF buyer_id IS NULL THEN
    INSERT INTO "DemandBuyerProfile"
      ("displayName","legalName","country","website","domain","verificationStatus","confidence",
       "productKeys","sourceCount","signalCount","firstSeenAt","lastSeenAt","lastBuyingSignalAt","evidence")
    VALUES
      (
        coalesce(nullif(br."buyerName",''),d."buyerName"),
        nullif(br."legalEntity",''),
        coalesce(nullif(br."country",''),split_part(d."market",' — ',1)),
        nullif(br."website",''),
        CASE WHEN br."website" IS NULL THEN NULL
             ELSE regexp_replace(lower(br."website"), '^https?://(www\.)?|/.*$', '', 'g') END,
        verification,
        confidence_value,
        product_keys,
        1,1,
        coalesce(d."publishedAt",d."firstSeenAt"),
        d."lastSeenAt",
        coalesce(d."publishedAt",d."firstSeenAt"),
        jsonb_build_object('seedSignalId',d."id",'verification',d."verification")
      )
    RETURNING "id" INTO buyer_id;
  ELSE
    UPDATE "DemandBuyerProfile"
    SET
      "displayName"=coalesce(nullif(br."buyerName",''),"displayName"),
      "legalName"=coalesce(nullif(br."legalEntity",''),"legalName"),
      "country"=coalesce(nullif(br."country",''),"country"),
      "website"=coalesce(nullif(br."website",''),"website"),
      "domain"=coalesce(
        CASE WHEN br."website" IS NULL THEN NULL ELSE regexp_replace(lower(br."website"), '^https?://(www\.)?|/.*$', '', 'g') END,
        "domain"
      ),
      "verificationStatus"=CASE
        WHEN confidence_value > "confidence" THEN verification ELSE "verificationStatus" END,
      "confidence"=greatest("confidence",confidence_value),
      "productKeys"=(SELECT ARRAY(SELECT DISTINCT x FROM unnest("DemandBuyerProfile"."productKeys" || product_keys) x)),
      "lastSeenAt"=greatest(coalesce("lastSeenAt",d."lastSeenAt"),d."lastSeenAt"),
      "lastBuyingSignalAt"=greatest(coalesce("lastBuyingSignalAt",coalesce(d."publishedAt",d."firstSeenAt")),coalesce(d."publishedAt",d."firstSeenAt")),
      "updatedAt"=now()
    WHERE "id"=buyer_id;
  END IF;

  INSERT INTO "DemandBuyerSignal" ("buyerId","signalId","relationship","confidence")
  VALUES (buyer_id,d."id",'BUYER',confidence_value)
  ON CONFLICT ("buyerId","signalId") DO UPDATE SET
    "confidence"=greatest("DemandBuyerSignal"."confidence",excluded."confidence");

  primary_email := nullif(br."businessEmail",'');
  primary_phone := nullif(br."businessPhone",'');
  primary_whatsapp := nullif(br."whatsapp",'');

  IF primary_email IS NOT NULL OR primary_phone IS NOT NULL OR primary_whatsapp IS NOT NULL OR br."contactName" IS NOT NULL THEN
    INSERT INTO "DemandBuyerContact"
      ("buyerId","contactName","role","email","phone","whatsapp","sourceUrl","isBusinessContact","verificationStatus","confidence","primaryContact")
    VALUES
      (
        buyer_id,nullif(br."contactName",''),nullif(br."contactRole",''),
        primary_email,primary_phone,primary_whatsapp,d."sourceUrl",true,
        coalesce(br."verificationStatus",'UNVERIFIED'),confidence_value,true
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Recalculate buyer-level metrics.
  SELECT
    count(DISTINCT ds."signalId")::int,
    count(DISTINCT d2."source")::int,
    min(coalesce(d2."publishedAt",d2."firstSeenAt")),
    max(d2."lastSeenAt"),
    max(coalesce(d2."publishedAt",d2."firstSeenAt"))
  INTO
    source_points, -- temporary reuse for signal count
    volume_points, -- temporary reuse for source count
    d."publishedAt",
    d."lastSeenAt",
    d."firstSeenAt"
  FROM "DemandBuyerSignal" ds
  JOIN "DemandSignal" d2 ON d2."id"=ds."signalId"
  WHERE ds."buyerId"=buyer_id;

  -- recency: current / very recent signals score highest.
  recency_points := CASE
    WHEN d."firstSeenAt" >= now() - interval '7 days' THEN 35
    WHEN d."firstSeenAt" >= now() - interval '30 days' THEN 25
    WHEN d."firstSeenAt" >= now() - interval '90 days' THEN 15
    ELSE 5
  END;

  contact_points := CASE
    WHEN EXISTS (SELECT 1 FROM "DemandBuyerContact" c WHERE c."buyerId"=buyer_id AND c."whatsapp" IS NOT NULL) THEN 30
    WHEN EXISTS (SELECT 1 FROM "DemandBuyerContact" c WHERE c."buyerId"=buyer_id AND c."phone" IS NOT NULL) THEN 25
    WHEN EXISTS (SELECT 1 FROM "DemandBuyerContact" c WHERE c."buyerId"=buyer_id AND c."email" IS NOT NULL) THEN 20
    ELSE 0
  END;

  source_points := least(20, greatest(0, volume_points * 5));
  volume_points := CASE
    WHEN EXISTS (
      SELECT 1 FROM "DemandBuyerSignal" ds
      JOIN "DemandSignal" sx ON sx."id"=ds."signalId"
      WHERE ds."buyerId"=buyer_id AND sx."quantity" IS NOT NULL
    ) THEN 15 ELSE 5 END;

  intent_score := least(100,
    recency_points
    + source_points
    + volume_points
    + CASE verification
        WHEN 'VERIFIED' THEN 25
        WHEN 'SELF_SUBMITTED' THEN 25
        WHEN 'SOURCE_IDENTIFIED' THEN 18
        WHEN 'PROBABLE_MATCH' THEN 10
        ELSE 0
      END
  );

  contact_score := least(100, contact_points + confidence_value/2);
  exec_score := least(100, round((intent_score*0.65 + contact_score*0.35))::int);

  UPDATE "DemandBuyerProfile"
  SET
    "signalCount"=(SELECT count(*) FROM "DemandBuyerSignal" WHERE "buyerId"=buyer_id),
    "sourceCount"=(SELECT count(DISTINCT sx."source")
                   FROM "DemandBuyerSignal" ds
                   JOIN "DemandSignal" sx ON sx."id"=ds."signalId"
                   WHERE ds."buyerId"=buyer_id),
    "firstSeenAt"=(SELECT min(coalesce(sx."publishedAt",sx."firstSeenAt"))
                   FROM "DemandBuyerSignal" ds
                   JOIN "DemandSignal" sx ON sx."id"=ds."signalId"
                   WHERE ds."buyerId"=buyer_id),
    "lastSeenAt"=(SELECT max(sx."lastSeenAt")
                  FROM "DemandBuyerSignal" ds
                  JOIN "DemandSignal" sx ON sx."id"=ds."signalId"
                  WHERE ds."buyerId"=buyer_id),
    "lastBuyingSignalAt"=(SELECT max(coalesce(sx."publishedAt",sx."firstSeenAt"))
                          FROM "DemandBuyerSignal" ds
                          JOIN "DemandSignal" sx ON sx."id"=ds."signalId"
                          WHERE ds."buyerId"=buyer_id),
    "buyingIntentScore"=intent_score,
    "contactReadinessScore"=contact_score,
    "executionScore"=exec_score,
    "updatedAt"=now()
  WHERE "id"=buyer_id;

  RETURN buyer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_buyer_profile_for_signal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_buyer_profile_for_signal(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_buyer_intelligence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."buyerName" IS NOT NULL THEN
    PERFORM public.refresh_buyer_profile_for_signal(NEW."id");
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_buyer_intelligence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "demand_signal_buyer_intelligence" ON "DemandSignal";
CREATE TRIGGER "demand_signal_buyer_intelligence"
AFTER INSERT OR UPDATE OF "buyerName","verification","lastSeenAt" ON "DemandSignal"
FOR EACH ROW EXECUTE FUNCTION public.sync_buyer_intelligence();

-- Seed current resolved / identified buyers.
SELECT public.refresh_buyer_profile_for_signal("id")
FROM "DemandSignal"
WHERE "buyerName" IS NOT NULL;

CREATE OR REPLACE VIEW public."DemandBuyerWorkbench" AS
SELECT
  b."id",
  b."displayName",
  b."legalName",
  b."country",
  b."website",
  b."buyerType",
  b."verificationStatus",
  b."confidence",
  b."productKeys",
  b."signalCount",
  b."sourceCount",
  b."lastBuyingSignalAt",
  b."buyingIntentScore",
  b."contactReadinessScore",
  b."executionScore",
  c."contactName" AS "primaryContactName",
  c."role" AS "primaryContactRole",
  c."email" AS "primaryEmail",
  c."phone" AS "primaryPhone",
  c."whatsapp" AS "primaryWhatsapp",
  c."verificationStatus" AS "contactVerification"
FROM "DemandBuyerProfile" b
LEFT JOIN LATERAL (
  SELECT *
  FROM "DemandBuyerContact" c
  WHERE c."buyerId"=b."id"
  ORDER BY c."primaryContact" DESC,c."confidence" DESC,c."updatedAt" DESC
  LIMIT 1
) c ON true;

REVOKE ALL ON TABLE public."DemandBuyerWorkbench" FROM PUBLIC, anon, authenticated;
