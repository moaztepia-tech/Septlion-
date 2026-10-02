ALTER TABLE "RFQ" ADD COLUMN "requirementId" TEXT;
CREATE UNIQUE INDEX "RFQ_requirementId_key" ON "RFQ"("requirementId");
CREATE INDEX "RFQ_requirementId_idx" ON "RFQ"("requirementId");
