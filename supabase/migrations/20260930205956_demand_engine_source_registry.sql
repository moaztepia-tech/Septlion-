
CREATE TABLE IF NOT EXISTS "DemandSource" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "sourceType" TEXT NOT NULL CHECK ("sourceType" IN ('API','HTML','FEED','MANUAL','PARTNER')),
  "endpoint" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 50 CHECK ("priority" BETWEEN 0 AND 100),
  "productFocus" TEXT[] NOT NULL DEFAULT '{}',
  "marketFocus" TEXT[] NOT NULL DEFAULT '{}',
  "collector" TEXT,
  "cadenceMinutes" INTEGER CHECK ("cadenceMinutes" IS NULL OR "cadenceMinutes" >= 60),
  "lastSuccessAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "config" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "DemandCollectorRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId" TEXT NOT NULL REFERENCES "DemandSource"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL CHECK ("status" IN ('RUNNING','SUCCESS','FAILED','SKIPPED')),
  "scanned" INTEGER NOT NULL DEFAULT 0,
  "accepted" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "finishedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "DemandSource_active_priority_idx"
  ON "DemandSource"("active","priority" DESC);
CREATE INDEX IF NOT EXISTS "DemandCollectorRun_source_started_idx"
  ON "DemandCollectorRun"("sourceId","startedAt" DESC);

ALTER TABLE "DemandSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemandCollectorRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandSource" FROM anon, authenticated;
REVOKE ALL ON TABLE "DemandCollectorRun" FROM anon, authenticated;

INSERT INTO "DemandSource"
("id","name","sourceType","endpoint","active","priority","productFocus","collector","cadenceMinutes","config")
VALUES (
  'world-bank-procurement',
  'World Bank Procurement Notices',
  'API',
  'https://search.worldbank.org/api/v2/procnotices',
  true,
  70,
  ARRAY['wheat flour','flour','milling','maize flour','fortified flour'],
  'collect-demand-signals',
  360,
  '{"verification":"official_source","scope":"procurement notices"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "name"=excluded."name",
  "endpoint"=excluded."endpoint",
  "active"=excluded."active",
  "priority"=excluded."priority",
  "productFocus"=excluded."productFocus",
  "collector"=excluded."collector",
  "cadenceMinutes"=excluded."cadenceMinutes",
  "updatedAt"=now();

INSERT INTO "DemandBuyerResolution"
("signalId","buyerName","confidence","verificationStatus","evidence")
SELECT d."id", d."buyerName",
  CASE
    WHEN d."verification" LIKE 'BUYER_RESOLVED%' THEN 95
    WHEN d."verification" LIKE 'PROBABLE_%' THEN 65
    WHEN d."buyerName" IS NOT NULL THEN 80
    ELSE 0
  END,
  CASE
    WHEN d."verification" LIKE 'BUYER_RESOLVED%' THEN 'VERIFIED'
    WHEN d."verification" LIKE 'PROBABLE_%' THEN 'PROBABLE_MATCH'
    WHEN d."buyerName" IS NOT NULL THEN 'SOURCE_IDENTIFIED'
    ELSE 'UNRESOLVED'
  END,
  jsonb_build_object('seeded_from_signal_verification', d."verification")
FROM "DemandSignal" d
WHERE d."buyerName" IS NOT NULL
ON CONFLICT ("signalId") DO UPDATE SET
  "buyerName"=excluded."buyerName",
  "confidence"=excluded."confidence",
  "verificationStatus"=excluded."verificationStatus",
  "evidence"=excluded."evidence",
  "updatedAt"=now();

INSERT INTO "DemandQualification"
("signalId","decision","directEligibility","localPartnerRequired","nextAction","deadlineAt")
SELECT d."id",'PENDING',NULL,NULL,
  CASE
    WHEN d."stage"='QUALIFICATION' THEN 'Verify current eligibility, mandatory documents, supply route and commercial viability.'
    ELSE 'Resolve buyer identity and evidence before qualification.'
  END,
  d."deadlineAt"
FROM "DemandSignal" d
WHERE d."status" IN ('QUALIFY_NOW','RESOLVE_BUYER')
ON CONFLICT ("signalId") DO NOTHING;

INSERT INTO "DemandOpportunityEvent" ("signalId","stage","eventType","note")
SELECT d."id", d."stage", 'PIPELINE_INITIALIZED', 'Signal migrated into Septlion execution pipeline.'
FROM "DemandSignal" d
WHERE NOT EXISTS (
  SELECT 1 FROM "DemandOpportunityEvent" e
  WHERE e."signalId"=d."id" AND e."eventType"='PIPELINE_INITIALIZED'
);
