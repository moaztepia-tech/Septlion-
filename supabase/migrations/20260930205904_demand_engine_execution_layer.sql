
-- Septlion Demand Intelligence v2: private execution layer + safe public radar
DO $$ BEGIN
  CREATE TYPE "DemandOpportunityStage" AS ENUM (
    'DETECTED',
    'BUYER_RESOLUTION',
    'QUALIFICATION',
    'OFFER_BUILD',
    'INTENT_PAGE',
    'RFQ',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DemandSignal"
  ADD COLUMN IF NOT EXISTS "stage" "DemandOpportunityStage" NOT NULL DEFAULT 'DETECTED';

CREATE TABLE IF NOT EXISTS "DemandBuyerResolution" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL UNIQUE REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "buyerName" TEXT,
  "legalEntity" TEXT,
  "country" TEXT,
  "website" TEXT,
  "contactName" TEXT,
  "contactRole" TEXT,
  "businessEmail" TEXT,
  "businessPhone" TEXT,
  "whatsapp" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 0 CHECK ("confidence" BETWEEN 0 AND 100),
  "verificationStatus" TEXT NOT NULL DEFAULT 'UNRESOLVED',
  "evidence" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "DemandQualification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL UNIQUE REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "decision" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("decision" IN ('PENDING','QUALIFIED','PARTNER_REQUIRED','HOLD','REJECT')),
  "directEligibility" BOOLEAN,
  "localPartnerRequired" BOOLEAN,
  "bidBond" TEXT,
  "documentFee" TEXT,
  "documents" JSONB,
  "deliveryTerms" TEXT,
  "estimatedValue" NUMERIC(18,2),
  "currency" TEXT,
  "riskFlags" JSONB,
  "nextAction" TEXT,
  "deadlineAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "DemandOpportunityEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "stage" "DemandOpportunityStage" NOT NULL,
  "eventType" TEXT NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandBuyerResolution_verification_idx"
  ON "DemandBuyerResolution"("verificationStatus","confidence" DESC);
CREATE INDEX IF NOT EXISTS "DemandQualification_decision_idx"
  ON "DemandQualification"("decision","deadlineAt");
CREATE INDEX IF NOT EXISTS "DemandOpportunityEvent_signal_created_idx"
  ON "DemandOpportunityEvent"("signalId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandSignal_stage_score_idx"
  ON "DemandSignal"("stage","score" DESC);

ALTER TABLE "DemandBuyerResolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemandQualification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemandOpportunityEvent" ENABLE ROW LEVEL SECURITY;

-- Remove broad public access to raw intelligence.
DROP POLICY IF EXISTS "public_read_demand_signals" ON "DemandSignal";
REVOKE ALL ON TABLE "DemandSignal" FROM anon, authenticated;
REVOKE ALL ON TABLE "DemandBuyerResolution" FROM anon, authenticated;
REVOKE ALL ON TABLE "DemandQualification" FROM anon, authenticated;
REVOKE ALL ON TABLE "DemandOpportunityEvent" FROM anon, authenticated;
REVOKE ALL ON TABLE "DemandCollectorState" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_demand_signals()
RETURNS TABLE (
  id UUID,
  type TEXT,
  market TEXT,
  product TEXT,
  quantity TEXT,
  published_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  status TEXT,
  stage TEXT,
  score INTEGER,
  source_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d."id",
    d."type"::TEXT,
    d."market",
    d."product",
    d."quantity",
    d."publishedAt",
    d."deadlineAt",
    d."status"::TEXT,
    d."stage"::TEXT,
    d."score",
    d."sourceUrl"
  FROM "DemandSignal" d
  WHERE d."status" <> 'ARCHIVED'
  ORDER BY d."score" DESC, d."lastSeenAt" DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.get_public_demand_stats()
RETURNS TABLE (
  active_signals BIGINT,
  qualify_now BIGINT,
  buyer_resolution BIGINT,
  markets BIGINT,
  nearest_deadline TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE d."status" <> 'ARCHIVED') AS active_signals,
    count(*) FILTER (WHERE d."status" = 'QUALIFY_NOW') AS qualify_now,
    count(*) FILTER (WHERE d."status" = 'RESOLVE_BUYER') AS buyer_resolution,
    count(DISTINCT d."market") FILTER (WHERE d."status" <> 'ARCHIVED') AS markets,
    min(d."deadlineAt") FILTER (WHERE d."deadlineAt" > now() AND d."status" <> 'ARCHIVED') AS nearest_deadline
  FROM "DemandSignal" d;
$$;

REVOKE ALL ON FUNCTION public.get_public_demand_signals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_demand_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_demand_signals() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_demand_stats() TO anon, authenticated;

-- Map current records into the operating pipeline.
UPDATE "DemandSignal"
SET "stage" = CASE
  WHEN "status" = 'QUALIFY_NOW' THEN 'QUALIFICATION'::"DemandOpportunityStage"
  WHEN "status" = 'RESOLVE_BUYER' THEN 'BUYER_RESOLUTION'::"DemandOpportunityStage"
  ELSE 'DETECTED'::"DemandOpportunityStage"
END
WHERE "stage" = 'DETECTED';
