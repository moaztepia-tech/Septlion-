
CREATE TABLE IF NOT EXISTS "DemandRfqSubmission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL UNIQUE,
  "intentSlug" TEXT,
  "originSignalId" UUID REFERENCES "DemandSignal"("id") ON DELETE SET NULL,
  "signalId" UUID UNIQUE REFERENCES "DemandSignal"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK ("status" IN ('RECEIVED','QUALIFYING','QUALIFIED','REJECTED','CONVERTED')),
  "productKey" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "country" TEXT NOT NULL,
  "city" TEXT,
  "destinationPort" TEXT,
  "quantity" TEXT NOT NULL,
  "packing" TEXT,
  "incoterm" TEXT,
  "deliveryWindow" TEXT,
  "notes" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandRfqSubmission_status_created_idx"
  ON "DemandRfqSubmission"("status","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandRfqSubmission_email_created_idx"
  ON "DemandRfqSubmission"(lower("email"),"createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandRfqSubmission_ip_created_idx"
  ON "DemandRfqSubmission"("ipHash","createdAt" DESC);

ALTER TABLE "DemandRfqSubmission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandRfqSubmission" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "PublicDemandIntentPage" (
  "id" UUID PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "productKey" TEXT,
  "market" TEXT NOT NULL,
  "searchIntent" TEXT NOT NULL,
  "content" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "PublicDemandIntentPage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_intent_pages" ON "PublicDemandIntentPage";
CREATE POLICY "public_read_intent_pages"
ON "PublicDemandIntentPage"
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE "PublicDemandIntentPage" FROM anon, authenticated;
GRANT SELECT ON TABLE "PublicDemandIntentPage" TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_public_demand_intent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "PublicDemandIntentPage" WHERE "id"=OLD."id";
    RETURN OLD;
  END IF;

  IF NEW."status" <> 'PUBLISHED' THEN
    DELETE FROM "PublicDemandIntentPage" WHERE "id"=NEW."id";
    RETURN NEW;
  END IF;

  INSERT INTO "PublicDemandIntentPage"
    ("id","slug","title","productKey","market","searchIntent","content","updatedAt")
  VALUES
    (NEW."id",NEW."slug",NEW."title",NEW."productKey",NEW."market",NEW."searchIntent",NEW."content",now())
  ON CONFLICT ("id") DO UPDATE SET
    "slug"=excluded."slug",
    "title"=excluded."title",
    "productKey"=excluded."productKey",
    "market"=excluded."market",
    "searchIntent"=excluded."searchIntent",
    "content"=excluded."content",
    "updatedAt"=now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_demand_intent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "demand_intent_public_projection" ON "DemandIntentPage";
CREATE TRIGGER "demand_intent_public_projection"
AFTER INSERT OR UPDATE OR DELETE ON "DemandIntentPage"
FOR EACH ROW EXECUTE FUNCTION public.sync_public_demand_intent();

CREATE OR REPLACE FUNCTION public.create_public_demand_rfq(payload JSONB)
RETURNS TABLE (
  submission_id UUID,
  signal_id UUID,
  reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_id UUID := gen_random_uuid();
  sig_id UUID := gen_random_uuid();
  ref TEXT := 'SRFQ-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(sub_id::text,'-',''),1,8));
  origin_signal UUID;
  origin_page RECORD;
  product_key TEXT := nullif(trim(payload->>'productKey'),'');
  product_name TEXT := nullif(trim(payload->>'product'),'');
  company_name TEXT := nullif(trim(payload->>'companyName'),'');
  contact_name TEXT := nullif(trim(payload->>'contactName'),'');
  email_value TEXT := lower(nullif(trim(payload->>'email'),''));
  country_value TEXT := nullif(trim(payload->>'country'),'');
  quantity_value TEXT := nullif(trim(payload->>'quantity'),'');
  intent_slug TEXT := nullif(trim(payload->>'intentSlug'),'');
  score_value INTEGER := 65;
BEGIN
  IF product_key IS NULL OR product_name IS NULL OR company_name IS NULL
     OR contact_name IS NULL OR email_value IS NULL
     OR country_value IS NULL OR quantity_value IS NULL THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;

  IF email_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  IF intent_slug IS NOT NULL THEN
    SELECT ip.*, dip."signalId" AS origin_signal_id
    INTO origin_page
    FROM "PublicDemandIntentPage" ip
    JOIN "DemandIntentPage" dip ON dip."id"=ip."id"
    WHERE ip."slug"=intent_slug
    LIMIT 1;

    IF FOUND THEN
      origin_signal := origin_page.origin_signal_id;
      IF origin_page."productKey" IS NOT NULL THEN product_key := origin_page."productKey"; END IF;
      IF origin_page."title" IS NOT NULL THEN product_name := origin_page."title"; END IF;
    END IF;
  END IF;

  IF nullif(trim(payload->>'phone'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'destinationPort'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'packing'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'incoterm'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  IF nullif(trim(payload->>'deliveryWindow'),'') IS NOT NULL THEN score_value := score_value + 5; END IF;
  score_value := least(score_value,95);

  INSERT INTO "DemandSignal"
    ("id","source","sourceRecordId","sourceUrl","type","status","stage","market","product","productKey",
     "quantity","buyerName","publishedAt","deadlineAt","incoterm","packing","evidence","score","verification",
     "intentPageCandidate","raw","lastSeenAt")
  VALUES
    (
      sig_id,
      'Septlion Intent Page',
      ref,
      CASE WHEN intent_slug IS NULL THEN 'https://septlion.com/intent/wheat-flour/'
           ELSE 'https://septlion.com/intent/demand/?slug=' || intent_slug END,
      'RFQ',
      'QUALIFY_NOW',
      'RFQ',
      country_value ||
        CASE WHEN nullif(trim(payload->>'destinationPort'),'') IS NULL
          THEN '' ELSE ' — ' || trim(payload->>'destinationPort') END,
      product_name,
      product_key,
      quantity_value,
      company_name,
      now(),
      NULL,
      nullif(trim(payload->>'incoterm'),''),
      nullif(trim(payload->>'packing'),''),
      jsonb_build_object(
        'inbound',true,
        'contactName',contact_name,
        'email',email_value,
        'phone',nullif(trim(payload->>'phone'),''),
        'city',nullif(trim(payload->>'city'),''),
        'deliveryWindow',nullif(trim(payload->>'deliveryWindow'),''),
        'originSignalId',origin_signal,
        'intentSlug',intent_slug
      ),
      score_value,
      'BUYER_SELF_SUBMITTED',
      false,
      jsonb_build_object('submission',payload - 'ipHash' - 'userAgent'),
      now()
    );

  INSERT INTO "DemandRfqSubmission"
    ("id","reference","intentSlug","originSignalId","signalId","status","productKey","product",
     "companyName","contactName","email","phone","country","city","destinationPort","quantity",
     "packing","incoterm","deliveryWindow","notes","ipHash","userAgent","metadata")
  VALUES
    (
      sub_id,ref,intent_slug,origin_signal,sig_id,'RECEIVED',product_key,product_name,
      company_name,contact_name,email_value,nullif(trim(payload->>'phone'),''),
      country_value,nullif(trim(payload->>'city'),''),
      nullif(trim(payload->>'destinationPort'),''),
      quantity_value,nullif(trim(payload->>'packing'),''),
      nullif(trim(payload->>'incoterm'),''),
      nullif(trim(payload->>'deliveryWindow'),''),
      nullif(trim(payload->>'notes'),''),
      nullif(trim(payload->>'ipHash'),''),
      left(coalesce(payload->>'userAgent',''),500),
      jsonb_build_object('source','public_intent_form')
    );

  INSERT INTO "DemandBuyerResolution"
    ("signalId","buyerName","legalEntity","country","contactName","businessEmail","businessPhone",
     "confidence","verificationStatus","evidence")
  VALUES
    (
      sig_id,company_name,company_name,country_value,contact_name,email_value,
      nullif(trim(payload->>'phone'),''),
      70,'BUYER_SELF_SUBMITTED',
      jsonb_build_object('rfqReference',ref,'intentSlug',intent_slug)
    )
  ON CONFLICT ("signalId") DO NOTHING;

  INSERT INTO "DemandOpportunityEvent"
    ("signalId","stage","eventType","note","metadata")
  VALUES
    (sig_id,'RFQ','INBOUND_RFQ_RECEIVED',
     'Buyer submitted an RFQ from a Septlion intent page.',
     jsonb_build_object('reference',ref,'originSignalId',origin_signal,'intentSlug',intent_slug));

  RETURN QUERY SELECT sub_id,sig_id,ref;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_demand_rfq(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_demand_rfq(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_demand_execution_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_type TEXT;
  task_priority INTEGER;
BEGIN
  IF NEW."status" = 'ARCHIVED' OR NEW."stage" = 'ARCHIVED' THEN
    UPDATE "DemandTask"
      SET "status"='BLOCKED',"updatedAt"=now()
    WHERE "signalId"=NEW."id" AND "status" IN ('OPEN','IN_PROGRESS');
    RETURN NEW;
  END IF;

  IF NEW."buyerName" IS NOT NULL OR NEW."stage" IN ('BUYER_RESOLUTION','QUALIFICATION','OFFER_BUILD','INTENT_PAGE','RFQ') THEN
    INSERT INTO "DemandBuyerResolution"
      ("signalId","buyerName","confidence","verificationStatus")
    VALUES
      (
        NEW."id",
        NEW."buyerName",
        CASE WHEN NEW."buyerName" IS NULL THEN 0 ELSE 50 END,
        CASE WHEN NEW."buyerName" IS NULL THEN 'UNRESOLVED' ELSE 'SOURCE_IDENTIFIED' END
      )
    ON CONFLICT ("signalId") DO UPDATE SET
      "buyerName" = COALESCE(EXCLUDED."buyerName","DemandBuyerResolution"."buyerName"),
      "updatedAt" = now();
  END IF;

  IF NEW."stage" IN ('QUALIFICATION','OFFER_BUILD','INTENT_PAGE') THEN
    INSERT INTO "DemandQualification"
      ("signalId","decision","deadlineAt","nextAction")
    VALUES
      (NEW."id",'PENDING',NEW."deadlineAt",'Verify eligibility, documents, supply route and commercial viability.')
    ON CONFLICT ("signalId") DO UPDATE SET
      "deadlineAt" = COALESCE(EXCLUDED."deadlineAt","DemandQualification"."deadlineAt"),
      "updatedAt" = now();
  END IF;

  task_type := CASE NEW."stage"
    WHEN 'BUYER_RESOLUTION' THEN 'RESOLVE_BUYER'
    WHEN 'QUALIFICATION' THEN 'VERIFY_QUALIFICATION'
    WHEN 'OFFER_BUILD' THEN 'BUILD_OFFER'
    WHEN 'INTENT_PAGE' THEN 'PUBLISH_INTENT'
    WHEN 'RFQ' THEN 'FOLLOW_UP'
    ELSE NULL
  END;

  task_priority := LEAST(100, GREATEST(0, NEW."score"));

  IF task_type IS NOT NULL THEN
    INSERT INTO "DemandTask"
      ("signalId","taskType","status","priority","dueAt","payload")
    VALUES
      (
        NEW."id",
        task_type,
        'OPEN',
        task_priority,
        NEW."deadlineAt",
        jsonb_build_object('market',NEW."market",'product',NEW."product",'source',NEW."source")
      )
    ON CONFLICT DO NOTHING;
  END IF;

  IF TG_OP = 'INSERT' OR OLD."stage" IS DISTINCT FROM NEW."stage" THEN
    INSERT INTO "DemandOpportunityEvent"
      ("signalId","stage","eventType","note","metadata")
    VALUES
      (
        NEW."id",
        NEW."stage",
        CASE WHEN TG_OP='INSERT' THEN 'SIGNAL_CREATED' ELSE 'STAGE_CHANGED' END,
        CASE WHEN TG_OP='INSERT' THEN 'Signal entered the execution pipeline.' ELSE 'Opportunity stage changed.' END,
        CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE jsonb_build_object('from',OLD."stage",'to',NEW."stage") END
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_demand_execution_pipeline() FROM PUBLIC, anon, authenticated;
