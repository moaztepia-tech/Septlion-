CREATE TYPE "MaritimeRfqStatus" AS ENUM ('ESTIMATED', 'SUBMITTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "MaritimeRFQ" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "containerCount" INTEGER NOT NULL,
  "containerType" TEXT NOT NULL,
  "teu" INTEGER NOT NULL,
  "pol" TEXT NOT NULL,
  "pod" TEXT NOT NULL,
  "incoterm" TEXT NOT NULL,
  "cargoType" TEXT NOT NULL,
  "shipDate" TIMESTAMP(3) NOT NULL,
  "grossWeight" DECIMAL(18,3),
  "cbm" DECIMAL(18,3),
  "finalDestinations" INTEGER NOT NULL DEFAULT 1,
  "paymentTerm" TEXT,
  "notes" TEXT,
  "sCode" TEXT NOT NULL,
  "exclusiveName" TEXT NOT NULL,
  "maritimeTerm" TEXT NOT NULL,
  "priceMin" DECIMAL(18,2) NOT NULL,
  "priceMax" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "surcharges" JSONB NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "status" "MaritimeRfqStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaritimeRFQ_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaritimeRFQAudit" (
  "id" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaritimeRFQAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaritimeRFQ_reference_key" ON "MaritimeRFQ"("reference");
CREATE UNIQUE INDEX "MaritimeRFQ_idempotencyKey_key" ON "MaritimeRFQ"("idempotencyKey");
CREATE INDEX "MaritimeRFQ_email_createdAt_idx" ON "MaritimeRFQ"("email", "createdAt");
CREATE INDEX "MaritimeRFQ_sCode_idx" ON "MaritimeRFQ"("sCode");
CREATE INDEX "MaritimeRFQ_status_idx" ON "MaritimeRFQ"("status");
CREATE INDEX "MaritimeRFQAudit_rfqId_createdAt_idx" ON "MaritimeRFQAudit"("rfqId", "createdAt");

ALTER TABLE "MaritimeRFQAudit"
  ADD CONSTRAINT "MaritimeRFQAudit_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "MaritimeRFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;
