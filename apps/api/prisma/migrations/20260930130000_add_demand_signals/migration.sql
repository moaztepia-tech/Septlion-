-- Septlion Demand Intelligence
CREATE TYPE "DemandSignalType" AS ENUM ('TENDER','RFQ','AUCTION');
CREATE TYPE "DemandSignalStatus" AS ENUM ('WATCH','RESOLVE_BUYER','QUALIFY_NOW','ARCHIVED');

CREATE TABLE "DemandSignal" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "type" "DemandSignalType" NOT NULL,
  "status" "DemandSignalStatus" NOT NULL DEFAULT 'WATCH',
  "market" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "quantity" TEXT,
  "buyerName" TEXT,
  "publishedAt" TIMESTAMP(3),
  "deadlineAt" TIMESTAMP(3),
  "incoterm" TEXT,
  "packing" TEXT,
  "evidence" JSONB,
  "score" INTEGER NOT NULL DEFAULT 0,
  "verification" TEXT NOT NULL DEFAULT 'SOURCE_SIGNAL',
  "intentPageCandidate" BOOLEAN NOT NULL DEFAULT false,
  "raw" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemandSignal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemandSignal_source_sourceRecordId_key" ON "DemandSignal"("source","sourceRecordId");
CREATE INDEX "DemandSignal_status_score_idx" ON "DemandSignal"("status","score");
CREATE INDEX "DemandSignal_market_product_idx" ON "DemandSignal"("market","product");
CREATE INDEX "DemandSignal_publishedAt_idx" ON "DemandSignal"("publishedAt");
CREATE INDEX "DemandSignal_deadlineAt_idx" ON "DemandSignal"("deadlineAt");
