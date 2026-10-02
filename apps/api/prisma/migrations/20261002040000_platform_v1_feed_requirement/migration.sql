-- Platform V1: Feed buyer identity and contextual requirements
CREATE TYPE "RequirementSource" AS ENUM ('AI_COMPOSER','PRODUCT_FEED','REORDER','INTERNAL');
CREATE TYPE "WhatsAppReachability" AS ENUM ('UNCONFIRMED','CONFIRMED','UNREACHABLE');

CREATE TABLE "BuyerContact" (
  "id" TEXT NOT NULL,
  "buyerProfileId" TEXT,
  "name" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "whatsapp" TEXT NOT NULL,
  "email" TEXT,
  "whatsappReachability" "WhatsAppReachability" NOT NULL DEFAULT 'UNCONFIRMED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuyerContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QualifiedRequirement"
  ADD COLUMN "buyerContactId" TEXT,
  ADD COLUMN "source" "RequirementSource" NOT NULL DEFAULT 'AI_COMPOSER',
  ADD COLUMN "sourceContext" JSONB,
  ADD COLUMN "containerCount" INTEGER,
  ADD COLUMN "septlionScale" TEXT,
  ADD COLUMN "destinationCode" TEXT,
  ADD COLUMN "paymentPreference" TEXT,
  ADD COLUMN "fieldStates" JSONB,
  ADD COLUMN "productConfiguration" JSONB;

CREATE INDEX "BuyerContact_whatsapp_idx" ON "BuyerContact"("whatsapp");
CREATE INDEX "BuyerContact_email_idx" ON "BuyerContact"("email");
CREATE INDEX "BuyerContact_buyerProfileId_idx" ON "BuyerContact"("buyerProfileId");
CREATE INDEX "QualifiedRequirement_buyerContactId_idx" ON "QualifiedRequirement"("buyerContactId");
CREATE INDEX "QualifiedRequirement_source_createdAt_idx" ON "QualifiedRequirement"("source","createdAt");

ALTER TABLE "BuyerContact" ADD CONSTRAINT "BuyerContact_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QualifiedRequirement" ADD CONSTRAINT "QualifiedRequirement_buyerContactId_fkey" FOREIGN KEY ("buyerContactId") REFERENCES "BuyerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
