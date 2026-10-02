-- Canonical Septlion commercial commitment and execution core.
CREATE TYPE "TradeTransactionStatus" AS ENUM ('PENDING_COMMIT','COMMITTED','IN_EXECUTION','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','RECEIPT_REVIEW','COMPLETED','ON_HOLD','CLAIM_OPEN','CANCELLED');
CREATE TYPE "ChangeOrderStatus" AS ENUM ('PROPOSED','APPROVED','REJECTED','SUPERSEDED');
CREATE TYPE "TradeEventVisibility" AS ENUM ('INTERNAL','BUYER','COUNTERPARTY');

CREATE TABLE "CommercialLock" (
 "id" TEXT NOT NULL, "quoteId" TEXT NOT NULL, "quoteRevisionId" TEXT NOT NULL, "orderIntentId" TEXT,
 "buyerOrgId" TEXT NOT NULL, "supplierOrgId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "snapshot" JSONB NOT NULL, "snapshotHash" TEXT NOT NULL, "lockedByUserId" TEXT,
 "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CommercialLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommercialLock_quoteId_key" ON "CommercialLock"("quoteId");
CREATE UNIQUE INDEX "CommercialLock_quoteRevisionId_key" ON "CommercialLock"("quoteRevisionId");
CREATE UNIQUE INDEX "CommercialLock_orderIntentId_key" ON "CommercialLock"("orderIntentId");
CREATE INDEX "CommercialLock_buyerOrgId_lockedAt_idx" ON "CommercialLock"("buyerOrgId","lockedAt");
CREATE INDEX "CommercialLock_supplierOrgId_lockedAt_idx" ON "CommercialLock"("supplierOrgId","lockedAt");

CREATE TABLE "TradeTransaction" (
 "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "commercialLockId" TEXT NOT NULL,
 "buyerOrgId" TEXT NOT NULL, "supplierOrgId" TEXT NOT NULL,
 "status" "TradeTransactionStatus" NOT NULL DEFAULT 'PENDING_COMMIT', "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TradeTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradeTransaction_reference_key" ON "TradeTransaction"("reference");
CREATE UNIQUE INDEX "TradeTransaction_commercialLockId_key" ON "TradeTransaction"("commercialLockId");
CREATE INDEX "TradeTransaction_buyerOrgId_status_updatedAt_idx" ON "TradeTransaction"("buyerOrgId","status","updatedAt");
CREATE INDEX "TradeTransaction_supplierOrgId_status_updatedAt_idx" ON "TradeTransaction"("supplierOrgId","status","updatedAt");

CREATE TABLE "TradeEvent" (
 "id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "type" TEXT NOT NULL,
 "visibility" "TradeEventVisibility" NOT NULL DEFAULT 'INTERNAL', "actorOrgId" TEXT, "actorUserId" TEXT,
 "occurredAt" TIMESTAMP(3) NOT NULL, "payload" JSONB NOT NULL, "evidence" JSONB, "idempotencyKey" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TradeEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradeEvent_idempotencyKey_key" ON "TradeEvent"("idempotencyKey");
CREATE UNIQUE INDEX "TradeEvent_transactionId_sequence_key" ON "TradeEvent"("transactionId","sequence");
CREATE INDEX "TradeEvent_transactionId_occurredAt_idx" ON "TradeEvent"("transactionId","occurredAt");
CREATE INDEX "TradeEvent_type_occurredAt_idx" ON "TradeEvent"("type","occurredAt");

CREATE TABLE "ChangeOrder" (
 "id" TEXT NOT NULL, "commercialLockId" TEXT NOT NULL, "number" INTEGER NOT NULL,
 "status" "ChangeOrderStatus" NOT NULL DEFAULT 'PROPOSED', "requestedByOrgId" TEXT NOT NULL,
 "requestedByUserId" TEXT, "reason" TEXT NOT NULL, "patch" JSONB NOT NULL, "impact" JSONB,
 "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChangeOrder_commercialLockId_number_key" ON "ChangeOrder"("commercialLockId","number");
CREATE INDEX "ChangeOrder_commercialLockId_status_idx" ON "ChangeOrder"("commercialLockId","status");

ALTER TABLE "TradeTransaction" ADD CONSTRAINT "TradeTransaction_commercialLockId_fkey" FOREIGN KEY ("commercialLockId") REFERENCES "CommercialLock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeEvent" ADD CONSTRAINT "TradeEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "TradeTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_commercialLockId_fkey" FOREIGN KEY ("commercialLockId") REFERENCES "CommercialLock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
