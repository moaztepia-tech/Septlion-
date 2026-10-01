-- Septlion Global Demand Engine core
CREATE TYPE "IntelligenceVerificationStatus" AS ENUM ('UNVERIFIED','SOURCE_CONFIRMED','CROSS_VERIFIED','HUMAN_VERIFIED');
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT','NEEDS_CLARIFICATION','QUALIFIED','SUPPLY_READY','ARCHIVED');
CREATE TYPE "OpportunityStatus" AS ENUM ('DISCOVERED','BUYER_RESOLUTION','QUALIFICATION','SUPPLY_MATCHING','DEAL_BUILDING','AWAITING_APPROVAL','APPROVED','WON','LOST','ARCHIVED');
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED','NEEDS_HUMAN');
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "ApprovalAction" AS ENUM ('START_SUPPLY_MATCHING','BUILD_DEAL','SEND_RFQ','SEND_QUOTE','ACCEPT_COMMERCIAL_TERMS','CREATE_ORDER_INTENT','EXTERNAL_COMMITMENT');

CREATE TABLE "BuyerProfile" ("id" TEXT PRIMARY KEY,"organizationId" TEXT UNIQUE,"canonicalName" TEXT NOT NULL,"country" TEXT,"website" TEXT,"industry" TEXT,"verificationStatus" "IntelligenceVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',"confidence" INTEGER NOT NULL DEFAULT 0,"attributes" JSONB,"provenance" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "QualifiedRequirement" ("id" TEXT PRIMARY KEY,"buyerProfileId" TEXT,"sourceSignalId" TEXT,"status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',"product" TEXT NOT NULL,"market" TEXT NOT NULL,"quantity" DECIMAL(18,4),"unit" TEXT,"deliveryCountry" TEXT,"deliveryPort" TEXT,"incoterm" TEXT,"targetPrice" DECIMAL(18,4),"currency" TEXT,"requiredDate" TIMESTAMP(3),"knownFacts" JSONB NOT NULL,"inferredFacts" JSONB,"criticalMissing" JSONB,"specifications" JSONB,"packing" JSONB,"compliance" JSONB,"confidence" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "Opportunity" ("id" TEXT PRIMARY KEY,"reference" TEXT NOT NULL UNIQUE,"status" "OpportunityStatus" NOT NULL DEFAULT 'DISCOVERED',"sourceSignalId" TEXT,"buyerProfileId" TEXT,"requirementId" TEXT,"rfqId" TEXT,"title" TEXT NOT NULL,"market" TEXT NOT NULL,"product" TEXT NOT NULL,"commercialValue" DECIMAL(18,2),"currency" TEXT,"nextAction" TEXT,"nextActionAt" TIMESTAMP(3),"evidence" JSONB,"risk" JSONB,"economics" JSONB,"humanApproval" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "AgentRun" ("id" TEXT PRIMARY KEY,"opportunityId" TEXT,"agentType" TEXT NOT NULL,"runtime" TEXT,"status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',"input" JSONB NOT NULL,"output" JSONB,"evidence" JSONB,"error" TEXT,"startedAt" TIMESTAMP(3),"finishedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "HumanApproval" ("id" TEXT PRIMARY KEY,"opportunityId" TEXT NOT NULL,"action" "ApprovalAction" NOT NULL,"decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',"title" TEXT NOT NULL,"summary" TEXT,"payload" JSONB,"decidedBy" TEXT,"decidedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "SupplyCandidate" ("id" TEXT PRIMARY KEY,"opportunityId" TEXT NOT NULL,"supplierOrgId" TEXT,"supplierName" TEXT NOT NULL,"country" TEXT,"source" TEXT,"sourceUrl" TEXT,"capability" JSONB,"compliance" JSONB,"commercial" JSONB,"logistics" JSONB,"confidence" INTEGER NOT NULL DEFAULT 0,"verified" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "DealDraft" ("id" TEXT PRIMARY KEY,"opportunityId" TEXT NOT NULL,"version" INTEGER NOT NULL DEFAULT 1,"currency" TEXT NOT NULL DEFAULT 'USD',"exWorks" DECIMAL(18,2),"freight" DECIMAL(18,2),"qc" DECIMAL(18,2),"documents" DECIMAL(18,2),"duties" DECIMAL(18,2),"riskReserve" DECIMAL(18,2),"landedCost" DECIMAL(18,2),"grossMarginPct" DECIMAL(8,4),"offerPrice" DECIMAL(18,2),"assumptions" JSONB,"status" TEXT NOT NULL DEFAULT 'DRAFT',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);

ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
ALTER TABLE "QualifiedRequirement" ADD CONSTRAINT "QualifiedRequirement_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE SET NULL;
ALTER TABLE "QualifiedRequirement" ADD CONSTRAINT "QualifiedRequirement_sourceSignalId_fkey" FOREIGN KEY ("sourceSignalId") REFERENCES "DemandSignal"("id") ON DELETE SET NULL;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_sourceSignalId_fkey" FOREIGN KEY ("sourceSignalId") REFERENCES "DemandSignal"("id") ON DELETE SET NULL;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE SET NULL;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "QualifiedRequirement"("id") ON DELETE SET NULL;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE SET NULL;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE;
ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE;
ALTER TABLE "SupplyCandidate" ADD CONSTRAINT "SupplyCandidate_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE;
ALTER TABLE "SupplyCandidate" ADD CONSTRAINT "SupplyCandidate_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL;
ALTER TABLE "DealDraft" ADD CONSTRAINT "DealDraft_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE;

CREATE INDEX "BuyerProfile_canonicalName_idx" ON "BuyerProfile"("canonicalName");
CREATE INDEX "QualifiedRequirement_status_market_product_idx" ON "QualifiedRequirement"("status","market","product");
CREATE INDEX "Opportunity_status_updatedAt_idx" ON "Opportunity"("status","updatedAt");
CREATE INDEX "AgentRun_status_createdAt_idx" ON "AgentRun"("status","createdAt");
CREATE INDEX "HumanApproval_decision_createdAt_idx" ON "HumanApproval"("decision","createdAt");
CREATE INDEX "SupplyCandidate_opportunityId_confidence_idx" ON "SupplyCandidate"("opportunityId","confidence");
CREATE UNIQUE INDEX "DealDraft_opportunityId_version_key" ON "DealDraft"("opportunityId","version");
