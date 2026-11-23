
CREATE TABLE IF NOT EXISTS "DemandTask" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "taskType" TEXT NOT NULL CHECK ("taskType" IN (
    'RESOLVE_BUYER',
    'VERIFY_QUALIFICATION',
    'BUILD_OFFER',
    'PUBLISH_INTENT',
    'FOLLOW_UP'
  )),
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','IN_PROGRESS','DONE','BLOCKED')),
  "priority" INTEGER NOT NULL DEFAULT 50 CHECK ("priority" BETWEEN 0 AND 100),
  "dueAt" TIMESTAMPTZ,
  "assignee" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandTask_queue_idx"
  ON "DemandTask"("status","priority" DESC,"dueAt");
CREATE INDEX IF NOT EXISTS "DemandTask_signal_idx"
  ON "DemandTask"("signalId","createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "DemandTask_one_active_type_idx"
  ON "DemandTask"("signalId","taskType")
  WHERE "status" IN ('OPEN','IN_PROGRESS');

ALTER TABLE "DemandTask" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandTask" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_demand_execution_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_type TEXT;
  task_priority INTEGER;
BEGIN
  IF NEW."status" = 'ARCHIVED' OR NEW."stage" = 'ARCHIVED' THEN
    UPDATE "DemandTask"
      SET "status"='BLOCKED',"updatedAt"=now()
    WHERE "signalId"=NEW."id" AND "status" IN ('OPEN','IN_PROGRESS');
    RETURN NEW;
  END IF;

  IF NEW."buyerName" IS NOT NULL OR NEW."stage" IN ('BUYER_RESOLUTION','QUALIFICATION','OFFER_BUILD','INTENT_PAGE','RFQ') THEN
    INSERT INTO "DemandBuyerResolution"
      ("signalId","buyerName","confidence","verificationStatus")
    VALUES
      (
        NEW."id",
        NEW."buyerName",
        CASE WHEN NEW."buyerName" IS NULL THEN 0 ELSE 50 END,
        CASE WHEN NEW."buyerName" IS NULL THEN 'UNRESOLVED' ELSE 'SOURCE_IDENTIFIED' END
      )
    ON CONFLICT ("signalId") DO UPDATE SET
      "buyerName" = COALESCE(EXCLUDED."buyerName","DemandBuyerResolution"."buyerName"),
      "updatedAt" = now();
  END IF;

  IF NEW."stage" IN ('QUALIFICATION','OFFER_BUILD','INTENT_PAGE','RFQ') THEN
    INSERT INTO "DemandQualification"
      ("signalId","decision","deadlineAt","nextAction")
    VALUES
      (NEW."id",'PENDING',NEW."deadlineAt",'Verify eligibility, documents, supply route and commercial viability.')
    ON CONFLICT ("signalId") DO UPDATE SET
      "deadlineAt" = COALESCE(EXCLUDED."deadlineAt","DemandQualification"."deadlineAt"),
      "updatedAt" = now();
  END IF;

  task_type := CASE NEW."stage"
    WHEN 'BUYER_RESOLUTION' THEN 'RESOLVE_BUYER'
    WHEN 'QUALIFICATION' THEN 'VERIFY_QUALIFICATION'
    WHEN 'OFFER_BUILD' THEN 'BUILD_OFFER'
    WHEN 'INTENT_PAGE' THEN 'PUBLISH_INTENT'
    ELSE NULL
  END;

  task_priority := LEAST(100, GREATEST(0, NEW."score"));

  IF task_type IS NOT NULL THEN
    INSERT INTO "DemandTask"
      ("signalId","taskType","status","priority","dueAt","payload")
    VALUES
      (
        NEW."id",
        task_type,
        'OPEN',
        task_priority,
        NEW."deadlineAt",
        jsonb_build_object('market',NEW."market",'product',NEW."product",'source',NEW."source")
      )
    ON CONFLICT DO NOTHING;
  END IF;

  IF TG_OP = 'INSERT' OR OLD."stage" IS DISTINCT FROM NEW."stage" THEN
    INSERT INTO "DemandOpportunityEvent"
      ("signalId","stage","eventType","note","metadata")
    VALUES
      (
        NEW."id",
        NEW."stage",
        CASE WHEN TG_OP='INSERT' THEN 'SIGNAL_CREATED' ELSE 'STAGE_CHANGED' END,
        CASE WHEN TG_OP='INSERT' THEN 'Signal entered the execution pipeline.' ELSE 'Opportunity stage changed.' END,
        CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE jsonb_build_object('from',OLD."stage",'to',NEW."stage") END
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_demand_execution_pipeline() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "demand_signal_execution_pipeline" ON "DemandSignal";
CREATE TRIGGER "demand_signal_execution_pipeline"
AFTER INSERT OR UPDATE ON "DemandSignal"
FOR EACH ROW EXECUTE FUNCTION public.sync_demand_execution_pipeline();

-- Seed active execution tasks for the current queue.
INSERT INTO "DemandTask" ("signalId","taskType","status","priority","dueAt","payload")
SELECT
  d."id",
  CASE d."stage"
    WHEN 'BUYER_RESOLUTION' THEN 'RESOLVE_BUYER'
    WHEN 'QUALIFICATION' THEN 'VERIFY_QUALIFICATION'
    WHEN 'OFFER_BUILD' THEN 'BUILD_OFFER'
    WHEN 'INTENT_PAGE' THEN 'PUBLISH_INTENT'
  END,
  'OPEN',
  LEAST(100,GREATEST(0,d."score")),
  d."deadlineAt",
  jsonb_build_object('market',d."market",'product',d."product",'source',d."source")
FROM "DemandSignal" d
WHERE d."stage" IN ('BUYER_RESOLUTION','QUALIFICATION','OFFER_BUILD','INTENT_PAGE')
ON CONFLICT DO NOTHING;
