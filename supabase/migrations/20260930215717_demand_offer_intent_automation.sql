
CREATE TABLE IF NOT EXISTS "DemandOfferBuild" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL UNIQUE REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK ("status" IN ('DRAFT','READY','SENT','WON','LOST','ARCHIVED')),
  "title" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "quantity" TEXT,
  "incoterm" TEXT,
  "packing" TEXT,
  "buyerName" TEXT,
  "supplierFit" JSONB,
  "commercial" JSONB,
  "delivery" JSONB,
  "documents" JSONB,
  "riskFlags" JSONB,
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "approvedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "DemandIntentPage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL UNIQUE REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK ("status" IN ('DRAFT','READY','PUBLISHED','ARCHIVED')),
  "title" TEXT NOT NULL,
  "productKey" TEXT,
  "market" TEXT NOT NULL,
  "searchIntent" TEXT NOT NULL,
  "content" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "publishedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandOfferBuild_status_idx"
  ON "DemandOfferBuild"("status","updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandIntentPage_status_idx"
  ON "DemandIntentPage"("status","updatedAt" DESC);

ALTER TABLE "DemandOfferBuild" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemandIntentPage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandOfferBuild" FROM anon, authenticated;
REVOKE ALL ON TABLE "DemandIntentPage" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.slugify_demand(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(value,'')), '[^a-z0-9]+', '-', 'g'));
$$;

REVOKE ALL ON FUNCTION public.slugify_demand(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_demand_qualification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d "DemandSignal"%ROWTYPE;
  page_slug TEXT;
BEGIN
  IF NEW."decision" = 'QUALIFIED'
     AND (OLD."decision" IS DISTINCT FROM NEW."decision") THEN

    SELECT * INTO d FROM "DemandSignal" WHERE "id" = NEW."signalId";
    IF NOT FOUND THEN RETURN NEW; END IF;

    page_slug := public.slugify_demand(
      coalesce(d."productKey",'product') || '-' ||
      coalesce(d."market",'market') || '-' ||
      left(d."id"::text,8)
    );

    INSERT INTO "DemandOfferBuild"
      ("signalId","status","title","product","market","quantity","incoterm","packing","buyerName",
       "commercial","delivery","documents","riskFlags")
    VALUES
      (
        d."id",'DRAFT',
        'Offer — ' || d."product" || ' — ' || d."market",
        d."product",d."market",d."quantity",d."incoterm",d."packing",d."buyerName",
        jsonb_build_object(
          'pricing_status','PENDING',
          'currency',NEW."currency",
          'estimated_opportunity_value',NEW."estimatedValue"
        ),
        jsonb_build_object(
          'terms',coalesce(NEW."deliveryTerms",d."incoterm"),
          'deadline',d."deadlineAt"
        ),
        coalesce(NEW."documents",'[]'::jsonb),
        coalesce(NEW."riskFlags",'[]'::jsonb)
      )
    ON CONFLICT ("signalId") DO UPDATE SET
      "title"=excluded."title",
      "product"=excluded."product",
      "market"=excluded."market",
      "quantity"=excluded."quantity",
      "incoterm"=excluded."incoterm",
      "packing"=excluded."packing",
      "buyerName"=excluded."buyerName",
      "commercial"=excluded."commercial",
      "delivery"=excluded."delivery",
      "documents"=excluded."documents",
      "riskFlags"=excluded."riskFlags",
      "updatedAt"=now();

    INSERT INTO "DemandIntentPage"
      ("signalId","slug","status","title","productKey","market","searchIntent","content")
    VALUES
      (
        d."id",page_slug,'DRAFT',
        d."product" || ' — ' || d."market",
        d."productKey",d."market",
        trim(d."product" || ' ' || d."market" || ' supplier RFQ'),
        jsonb_build_object(
          'product',d."product",
          'market',d."market",
          'quantity',d."quantity",
          'packing',d."packing",
          'incoterm',d."incoterm",
          'deadline',d."deadlineAt",
          'cta','Request a Septlion supply offer',
          'source_signal_id',d."id"
        )
      )
    ON CONFLICT ("signalId") DO UPDATE SET
      "title"=excluded."title",
      "productKey"=excluded."productKey",
      "market"=excluded."market",
      "searchIntent"=excluded."searchIntent",
      "content"=excluded."content",
      "updatedAt"=now();

    UPDATE "DemandSignal"
      SET "stage"='OFFER_BUILD'
      WHERE "id"=d."id" AND "stage" <> 'OFFER_BUILD';

    UPDATE "DemandTask"
      SET "status"='DONE',"updatedAt"=now()
      WHERE "signalId"=d."id"
        AND "taskType"='VERIFY_QUALIFICATION'
        AND "status" IN ('OPEN','IN_PROGRESS');

    INSERT INTO "DemandOpportunityEvent"
      ("signalId","stage","eventType","note","metadata")
    VALUES
      (
        d."id",'OFFER_BUILD','QUALIFICATION_PASSED',
        'Qualification passed; offer draft and intent-page draft generated automatically.',
        jsonb_build_object('qualificationId',NEW."id",'intentSlug',page_slug)
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_demand_qualification_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "demand_qualification_generate_assets" ON "DemandQualification";
CREATE TRIGGER "demand_qualification_generate_assets"
AFTER UPDATE OF "decision" ON "DemandQualification"
FOR EACH ROW EXECUTE FUNCTION public.on_demand_qualification_change();

CREATE OR REPLACE VIEW public."DemandWorkbenchQueue" AS
SELECT
  t."id" AS "taskId",
  t."taskType",
  t."status" AS "taskStatus",
  t."priority",
  t."dueAt",
  d."id" AS "signalId",
  d."stage",
  d."status" AS "signalStatus",
  d."score",
  d."type",
  d."market",
  d."product",
  d."quantity",
  d."buyerName",
  d."deadlineAt",
  d."source",
  d."sourceUrl",
  br."confidence" AS "buyerConfidence",
  br."verificationStatus" AS "buyerVerificationStatus",
  q."decision" AS "qualificationDecision",
  q."localPartnerRequired",
  q."nextAction",
  ob."status" AS "offerStatus",
  ip."status" AS "intentStatus",
  ip."slug" AS "intentSlug"
FROM "DemandTask" t
JOIN "DemandSignal" d ON d."id"=t."signalId"
LEFT JOIN "DemandBuyerResolution" br ON br."signalId"=d."id"
LEFT JOIN "DemandQualification" q ON q."signalId"=d."id"
LEFT JOIN "DemandOfferBuild" ob ON ob."signalId"=d."id"
LEFT JOIN "DemandIntentPage" ip ON ip."signalId"=d."id";

REVOKE ALL ON TABLE public."DemandWorkbenchQueue" FROM PUBLIC, anon, authenticated;
