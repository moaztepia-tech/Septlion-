-- Copied from the production migration history. Secret values were removed from the
-- repository copy: set them with `set app.<name> = '...'` before applying to a new
-- project. Production already holds them in Vault and is not re-run.

-- Instant RFQ alerts + supplier fit engine
CREATE TABLE IF NOT EXISTS "DemandAlert" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "submissionId" UUID REFERENCES "DemandRfqSubmission"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL CHECK ("type" IN ('NEW_RFQ','HIGH_SCORE_SIGNAL','SOURCE_FAILURE','SYSTEM')),
  "severity" TEXT NOT NULL DEFAULT 'INFO' CHECK ("severity" IN ('INFO','HIGH','CRITICAL')),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandAlert_unread_created_idx"
  ON "DemandAlert"("readAt","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandAlert_signal_idx"
  ON "DemandAlert"("signalId","createdAt" DESC);

ALTER TABLE "DemandAlert" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandAlert" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "DemandPushSubscription" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSuccessAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "DemandPushSubscription" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandPushSubscription" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "DemandSupplierProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "country" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "productKeys" TEXT[] NOT NULL DEFAULT '{}',
  "markets" TEXT[] NOT NULL DEFAULT '{}',
  "incoterms" TEXT[] NOT NULL DEFAULT '{}',
  "packings" TEXT[] NOT NULL DEFAULT '{}',
  "ports" TEXT[] NOT NULL DEFAULT '{}',
  "certifications" TEXT[] NOT NULL DEFAULT '{}',
  "minOrderMt" NUMERIC(18,3),
  "maxOrderMt" NUMERIC(18,3),
  "leadTimeDays" INTEGER,
  "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK ("verificationStatus" IN ('UNVERIFIED','SOURCE_VERIFIED','SEPTLION_VERIFIED')),
  "baseScore" INTEGER NOT NULL DEFAULT 50 CHECK ("baseScore" BETWEEN 0 AND 100),
  "contact" JSONB,
  "capabilities" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandSupplierProfile_active_idx"
  ON "DemandSupplierProfile"("active","verificationStatus");
CREATE INDEX IF NOT EXISTS "DemandSupplierProfile_product_gin"
  ON "DemandSupplierProfile" USING gin ("productKeys");

ALTER TABLE "DemandSupplierProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandSupplierProfile" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "DemandSupplierFit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "supplierId" UUID NOT NULL REFERENCES "DemandSupplierProfile"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'CANDIDATE'
    CHECK ("status" IN ('CANDIDATE','SHORTLISTED','SELECTED','REJECTED')),
  "score" INTEGER NOT NULL CHECK ("score" BETWEEN 0 AND 100),
  "reasons" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "gaps" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("signalId","supplierId")
);

CREATE INDEX IF NOT EXISTS "DemandSupplierFit_signal_score_idx"
  ON "DemandSupplierFit"("signalId","score" DESC);

ALTER TABLE "DemandSupplierFit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandSupplierFit" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_supplier_fit(target_signal UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d "DemandSignal"%ROWTYPE;
  s RECORD;
  fit_score INTEGER;
  fit_reasons JSONB;
  fit_gaps JSONB;
  count_candidates INTEGER := 0;
BEGIN
  SELECT * INTO d FROM "DemandSignal" WHERE "id"=target_signal;
  IF NOT FOUND THEN RETURN 0; END IF;

  DELETE FROM "DemandSupplierFit"
  WHERE "signalId"=target_signal AND "status"='CANDIDATE';

  FOR s IN
    SELECT * FROM "DemandSupplierProfile"
    WHERE "active"=true
      AND d."productKey" IS NOT NULL
      AND d."productKey" = ANY("productKeys")
  LOOP
    fit_score := LEAST(100, GREATEST(0, s."baseScore"));
    fit_reasons := jsonb_build_array('PRODUCT_MATCH');
    fit_gaps := '[]'::jsonb;

    IF d."incoterm" IS NOT NULL THEN
      IF array_length(s."incoterms",1) IS NULL OR d."incoterm" = ANY(s."incoterms") THEN
        fit_score := LEAST(100, fit_score + 10);
        fit_reasons := fit_reasons || '"INCOTERM_MATCH"'::jsonb;
      ELSE
        fit_score := GREATEST(0, fit_score - 10);
        fit_gaps := fit_gaps || '"INCOTERM_GAP"'::jsonb;
      END IF;
    END IF;

    IF d."packing" IS NOT NULL THEN
      IF array_length(s."packings",1) IS NULL OR EXISTS (
        SELECT 1 FROM unnest(s."packings") p WHERE lower(d."packing") LIKE '%'||lower(p)||'%'
      ) THEN
        fit_score := LEAST(100, fit_score + 10);
        fit_reasons := fit_reasons || '"PACKING_MATCH"'::jsonb;
      ELSE
        fit_gaps := fit_gaps || '"PACKING_UNCONFIRMED"'::jsonb;
      END IF;
    END IF;

    IF s."verificationStatus"='SEPTLION_VERIFIED' THEN
      fit_score := LEAST(100, fit_score + 15);
      fit_reasons := fit_reasons || '"SEPTLION_VERIFIED"'::jsonb;
    ELSIF s."verificationStatus"='SOURCE_VERIFIED' THEN
      fit_score := LEAST(100, fit_score + 8);
      fit_reasons := fit_reasons || '"SOURCE_VERIFIED"'::jsonb;
    ELSE
      fit_gaps := fit_gaps || '"SUPPLIER_NOT_VERIFIED"'::jsonb;
    END IF;

    IF array_length(s."markets",1) IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM unnest(s."markets") m WHERE lower(d."market") LIKE '%'||lower(m)||'%'
      ) THEN
        fit_score := LEAST(100, fit_score + 10);
        fit_reasons := fit_reasons || '"MARKET_MATCH"'::jsonb;
      ELSE
        fit_gaps := fit_gaps || '"MARKET_UNCONFIRMED"'::jsonb;
      END IF;
    END IF;

    INSERT INTO "DemandSupplierFit"
      ("signalId","supplierId","status","score","reasons","gaps")
    VALUES
      (target_signal,s."id",'CANDIDATE',fit_score,fit_reasons,fit_gaps)
    ON CONFLICT ("signalId","supplierId") DO UPDATE SET
      "score"=excluded."score",
      "reasons"=excluded."reasons",
      "gaps"=excluded."gaps",
      "updatedAt"=now();

    count_candidates := count_candidates + 1;
  END LOOP;

  UPDATE "DemandOfferBuild"
  SET "supplierFit"=jsonb_build_object(
        'status',CASE WHEN count_candidates>0 THEN 'CANDIDATES_FOUND' ELSE 'NO_CANDIDATES' END,
        'candidateCount',count_candidates,
        'refreshedAt',now()
      ),
      "updatedAt"=now()
  WHERE "signalId"=target_signal;

  RETURN count_candidates;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_supplier_fit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_supplier_fit(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.on_inbound_rfq_execute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  d "DemandSignal"%ROWTYPE;
  candidate_count INTEGER;
BEGIN
  SELECT * INTO d FROM "DemandSignal" WHERE "id"=NEW."signalId";
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO "DemandOfferBuild"
    ("signalId","status","title","product","market","quantity","incoterm","packing","buyerName",
     "supplierFit","commercial","delivery","documents","riskFlags")
  VALUES
    (
      d."id",'DRAFT',
      'Inbound RFQ — '||NEW."reference"||' — '||d."product",
      d."product",d."market",d."quantity",d."incoterm",d."packing",d."buyerName",
      jsonb_build_object('status','MATCHING','candidateCount',0),
      jsonb_build_object('pricing_status','PENDING','currency',NULL,'target_price',NULL),
      jsonb_build_object('destinationPort',NEW."destinationPort",'deliveryWindow',NEW."deliveryWindow",'terms',d."incoterm"),
      '[]'::jsonb,
      '[]'::jsonb
    )
  ON CONFLICT ("signalId") DO UPDATE SET
    "title"=excluded."title",
    "product"=excluded."product",
    "market"=excluded."market",
    "quantity"=excluded."quantity",
    "incoterm"=excluded."incoterm",
    "packing"=excluded."packing",
    "buyerName"=excluded."buyerName",
    "delivery"=excluded."delivery",
    "updatedAt"=now();

  candidate_count := public.refresh_supplier_fit(d."id");

  INSERT INTO "DemandAlert"
    ("signalId","submissionId","type","severity","title","body","metadata")
  VALUES
    (
      d."id",NEW."id",'NEW_RFQ',
      CASE WHEN d."score">=90 THEN 'CRITICAL' ELSE 'HIGH' END,
      'New RFQ — '||NEW."reference",
      NEW."companyName"||' · '||NEW."country"||' · '||NEW."quantity"||' · '||d."product",
      jsonb_build_object(
        'reference',NEW."reference",
        'companyName',NEW."companyName",
        'country',NEW."country",
        'quantity',NEW."quantity",
        'supplierCandidates',candidate_count
      )
    );

  PERFORM net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='septlion_project_url' order by created_at desc limit 1)
      || '/functions/v1/push-demand-alert',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1),
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1)
    ),
    body := jsonb_build_object('event','NEW_RFQ','reference',NEW."reference")
  );

  INSERT INTO "DemandOpportunityEvent"
    ("signalId","stage","eventType","note","metadata")
  VALUES
    (
      d."id",'RFQ','SUPPLIER_FIT_STARTED',
      'Inbound RFQ created offer draft and supplier-fit matching automatically.',
      jsonb_build_object('reference',NEW."reference",'candidateCount',candidate_count)
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_inbound_rfq_execute() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "inbound_rfq_execute" ON "DemandRfqSubmission";
CREATE TRIGGER "inbound_rfq_execute"
AFTER INSERT ON "DemandRfqSubmission"
FOR EACH ROW EXECUTE FUNCTION public.on_inbound_rfq_execute();

-- VAPID private key in Vault; public key is safe for browser use.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='septlion_vapid_private') THEN
    PERFORM vault.create_secret(current_setting('app.septlion_vapid_private'),'septlion_vapid_private');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_septlion_vapid_private()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name='septlion_vapid_private'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_septlion_vapid_private() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_septlion_vapid_private() TO service_role;

DROP VIEW IF EXISTS public."DemandWorkbenchQueue";
CREATE VIEW public."DemandWorkbenchQueue" AS
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
  br."contactName" AS "buyerContactName",
  br."businessEmail" AS "buyerEmail",
  br."businessPhone" AS "buyerPhone",
  q."decision" AS "qualificationDecision",
  q."localPartnerRequired",
  q."nextAction",
  ob."status" AS "offerStatus",
  ob."supplierFit" AS "supplierFit",
  ip."status" AS "intentStatus",
  ip."slug" AS "intentSlug",
  rs."reference" AS "rfqReference",
  rs."status" AS "rfqSubmissionStatus"
FROM "DemandTask" t
JOIN "DemandSignal" d ON d."id"=t."signalId"
LEFT JOIN "DemandBuyerResolution" br ON br."signalId"=d."id"
LEFT JOIN "DemandQualification" q ON q."signalId"=d."id"
LEFT JOIN "DemandOfferBuild" ob ON ob."signalId"=d."id"
LEFT JOIN "DemandIntentPage" ip ON ip."signalId"=d."id"
LEFT JOIN "DemandRfqSubmission" rs ON rs."signalId"=d."id";

REVOKE ALL ON TABLE public."DemandWorkbenchQueue" FROM PUBLIC, anon, authenticated;
