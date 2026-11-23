
CREATE TYPE "DemandSignalType" AS ENUM ('TENDER','RFQ','AUCTION');
CREATE TYPE "DemandSignalStatus" AS ENUM ('WATCH','RESOLVE_BUYER','QUALIFY_NOW','ARCHIVED');

CREATE TABLE "DemandSignal" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "type" "DemandSignalType" NOT NULL,
  "status" "DemandSignalStatus" NOT NULL DEFAULT 'WATCH',
  "market" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "quantity" TEXT,
  "buyerName" TEXT,
  "publishedAt" TIMESTAMPTZ,
  "deadlineAt" TIMESTAMPTZ,
  "incoterm" TEXT,
  "packing" TEXT,
  "evidence" JSONB,
  "score" INTEGER NOT NULL DEFAULT 0,
  "verification" TEXT NOT NULL DEFAULT 'SOURCE_SIGNAL',
  "intentPageCandidate" BOOLEAN NOT NULL DEFAULT false,
  "raw" JSONB,
  "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "DemandSignal_source_sourceRecordId_key" UNIQUE ("source","sourceRecordId")
);

CREATE INDEX "DemandSignal_status_score_idx" ON "DemandSignal"("status","score");
CREATE INDEX "DemandSignal_market_product_idx" ON "DemandSignal"("market","product");
CREATE INDEX "DemandSignal_publishedAt_idx" ON "DemandSignal"("publishedAt");
CREATE INDEX "DemandSignal_deadlineAt_idx" ON "DemandSignal"("deadlineAt");

ALTER TABLE "DemandSignal" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_demand_signals"
ON "DemandSignal"
FOR SELECT
TO anon, authenticated
USING (true);

CREATE TABLE "DemandCollectorState" (
  "source" TEXT PRIMARY KEY,
  "lastAttemptAt" TIMESTAMPTZ,
  "lastSuccessAt" TIMESTAMPTZ,
  "lastAccepted" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT
);

ALTER TABLE "DemandCollectorState" ENABLE ROW LEVEL SECURITY;
