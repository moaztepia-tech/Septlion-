
ALTER TABLE "DemandBuyerProfile"
  ADD COLUMN IF NOT EXISTS "platformVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "platformTrustScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "rfqQualityScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "platformContactAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recurrenceEvidenceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "priorityScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DemandBuyerProfile"
  DROP CONSTRAINT IF EXISTS "DemandBuyerProfile_platformTrustScore_check",
  ADD CONSTRAINT "DemandBuyerProfile_platformTrustScore_check"
    CHECK ("platformTrustScore" IS NULL OR "platformTrustScore" BETWEEN 0 AND 100);

ALTER TABLE "DemandBuyerProfile"
  DROP CONSTRAINT IF EXISTS "DemandBuyerProfile_rfqQualityScore_check",
  ADD CONSTRAINT "DemandBuyerProfile_rfqQualityScore_check"
    CHECK ("rfqQualityScore" IS NULL OR "rfqQualityScore" BETWEEN 0 AND 100);

ALTER TABLE "DemandBuyerProfile"
  DROP CONSTRAINT IF EXISTS "DemandBuyerProfile_priorityScore_check",
  ADD CONSTRAINT "DemandBuyerProfile_priorityScore_check"
    CHECK ("priorityScore" BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS "DemandBuyerProfile_priority_idx"
  ON "DemandBuyerProfile"("priorityScore" DESC,"lastBuyingSignalAt" DESC);

CREATE OR REPLACE FUNCTION public.recalculate_buyer_priority(target_buyer UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b "DemandBuyerProfile"%ROWTYPE;
  platform_bonus INTEGER := 0;
  recurrence_bonus INTEGER := 0;
  contact_bonus INTEGER := 0;
  priority_value INTEGER := 0;
BEGIN
  SELECT * INTO b FROM "DemandBuyerProfile" WHERE "id"=target_buyer;
  IF NOT FOUND THEN RETURN 0; END IF;

  platform_bonus := CASE WHEN b."platformVerified" THEN 10 ELSE 0 END;
  recurrence_bonus := least(15,greatest(0,b."recurrenceEvidenceCount"*4));
  contact_bonus := CASE
    WHEN EXISTS (SELECT 1 FROM "DemandBuyerContact" c WHERE c."buyerId"=b."id" AND c."whatsapp" IS NOT NULL) THEN 15
    WHEN EXISTS (SELECT 1 FROM "DemandBuyerContact" c WHERE c."buyerId"=b."id" AND c."phone" IS NOT NULL) THEN 12
    WHEN EXISTS (SELECT 1 FROM "DemandBuyerContact" c WHERE c."buyerId"=b."id" AND c."email" IS NOT NULL) THEN 10
    WHEN b."platformContactAvailable" THEN 6
    ELSE 0
  END;

  priority_value := least(100,
    round(
      b."buyingIntentScore"*0.55 +
      b."executionScore"*0.20 +
      coalesce(b."rfqQualityScore",50)*0.10 +
      platform_bonus +
      recurrence_bonus +
      contact_bonus
    )::int
  );

  UPDATE "DemandBuyerProfile"
  SET "priorityScore"=priority_value,"updatedAt"=now()
  WHERE "id"=target_buyer;

  RETURN priority_value;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_buyer_priority(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_buyer_priority(UUID) TO service_role;

-- Platform verification from go4WorldBusiness pages is only platform-level verification,
-- not Septlion verification of the underlying legal entity.
UPDATE "DemandBuyerProfile" b
SET
  "platformVerified"=true,
  "platformContactAvailable"=true,
  "metadata"=coalesce(b."metadata",'{}'::jsonb) ||
    jsonb_build_object(
      'platformVerificationScope','PLATFORM_ACCOUNT_OR_LEAD_ONLY',
      'platformVerificationNotLegalEntityVerification',true
    ),
  "updatedAt"=now()
WHERE EXISTS (
  SELECT 1
  FROM "DemandBuyerSignal" bs
  JOIN "DemandSignal" d ON d."id"=bs."signalId"
  WHERE bs."buyerId"=b."id"
    AND d."source"='go4WorldBusiness'
);

UPDATE "DemandBuyerProfile" b
SET
  "platformContactAvailable"=true,
  "updatedAt"=now()
WHERE EXISTS (
  SELECT 1
  FROM "DemandBuyerSignal" bs
  JOIN "DemandSignal" d ON d."id"=bs."signalId"
  WHERE bs."buyerId"=b."id"
    AND d."source"='TradeWheel'
);

-- TradeWheel buyer detail currently exposes trust / RFQ quality for Samuel publicly.
UPDATE "DemandBuyerProfile"
SET
  "platformTrustScore"=88,
  "rfqQualityScore"=82,
  "platformContactAvailable"=true,
  "metadata"=coalesce("metadata",'{}'::jsonb) ||
    jsonb_build_object(
      'platform','TradeWheel',
      'memberSince','Sep 2026',
      'trustScoreEvidenceUrl','https://www.tradewheel.com/buyers/buying-all-purpose-wheat-flour-quantity-29/1018578/',
      'companyNameGated',true,
      'contactNumberGated',true
    ),
  "updatedAt"=now()
WHERE lower("displayName")='samuel acquah'
  AND lower(coalesce("country",''))='united kingdom';

-- Recurrence evidence from multiple public go4WorldBusiness listings.
UPDATE "DemandBuyerProfile"
SET
  "recurrenceEvidenceCount"=greatest("recurrenceEvidenceCount",3),
  "metadata"=coalesce("metadata",'{}'::jsonb) ||
    jsonb_build_object(
      'samePlatformNameRecurrence',true,
      'recurrenceEvidenceUrl','https://www.go4worldbusiness.com/buyers/spain/wheat-flour.html',
      'recurrenceCaution','same platform contact name; legal-entity identity still unresolved'
    ),
  "updatedAt"=now()
WHERE lower("displayName")='luis monroy'
  AND lower(coalesce("country",''))='spain';

UPDATE "DemandBuyerProfile"
SET
  "recurrenceEvidenceCount"=greatest("recurrenceEvidenceCount",4),
  "metadata"=coalesce("metadata",'{}'::jsonb) ||
    jsonb_build_object(
      'samePlatformNameRecurrence',true,
      'recurrenceEvidenceUrl','https://www.go4worldbusiness.com/buyers/canada/wheat-flour.html',
      'recurrenceCaution','same platform contact name; legal-entity identity still unresolved'
    ),
  "updatedAt"=now()
WHERE lower("displayName")='vinod verma'
  AND lower(coalesce("country",''))='canada';

UPDATE "DemandBuyerProfile"
SET
  "recurrenceEvidenceCount"=greatest("recurrenceEvidenceCount",3),
  "metadata"=coalesce("metadata",'{}'::jsonb) ||
    jsonb_build_object(
      'samePlatformNameRecurrence',true,
      'recurrenceEvidenceUrl','https://www.go4worldbusiness.com/buyers/canada/wheat-flour.html',
      'recurrenceCaution','same platform contact name; legal-entity identity still unresolved'
    ),
  "updatedAt"=now()
WHERE lower("displayName")='sazzad abir'
  AND lower(coalesce("country",''))='canada';

-- Recalculate all current buyer priorities.
SELECT public.recalculate_buyer_priority("id") FROM "DemandBuyerProfile";

DROP VIEW IF EXISTS public."DemandBuyerWorkbench";
CREATE VIEW public."DemandBuyerWorkbench" AS
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
  b."platformVerified",
  b."platformTrustScore",
  b."rfqQualityScore",
  b."platformContactAvailable",
  b."recurrenceEvidenceCount",
  b."priorityScore",
  c."contactName" AS "primaryContactName",
  c."role" AS "primaryContactRole",
  c."email" AS "primaryEmail",
  c."phone" AS "primaryPhone",
  c."whatsapp" AS "primaryWhatsapp",
  c."verificationStatus" AS "contactVerification",
  latest."source" AS "latestSource",
  latest."product" AS "latestProduct",
  latest."quantity" AS "latestQuantity",
  latest."sourceUrl" AS "latestSourceUrl",
  (latest."source" IN ('TradeWheel','go4WorldBusiness','Freshdi','ExportHub')) AS "latestIsPlatform",
  src."sources" AS "sources"
FROM "DemandBuyerProfile" b
LEFT JOIN LATERAL (
  SELECT *
  FROM "DemandBuyerContact" c
  WHERE c."buyerId"=b."id"
  ORDER BY c."primaryContact" DESC,c."confidence" DESC,c."updatedAt" DESC
  LIMIT 1
) c ON true
LEFT JOIN LATERAL (
  SELECT d."source",d."product",d."quantity",d."sourceUrl",
         coalesce(d."publishedAt",d."firstSeenAt") AS observed_at
  FROM "DemandBuyerSignal" bs
  JOIN "DemandSignal" d ON d."id"=bs."signalId"
  WHERE bs."buyerId"=b."id"
  ORDER BY coalesce(d."publishedAt",d."firstSeenAt") DESC,d."score" DESC
  LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(DISTINCT d."source") AS sources
  FROM "DemandBuyerSignal" bs
  JOIN "DemandSignal" d ON d."id"=bs."signalId"
  WHERE bs."buyerId"=b."id"
) src ON true;

REVOKE ALL ON TABLE public."DemandBuyerWorkbench" FROM PUBLIC, anon, authenticated;
