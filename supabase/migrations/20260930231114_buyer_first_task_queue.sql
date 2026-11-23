
CREATE OR REPLACE FUNCTION public.sync_buyer_first_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link RECORD;
  phase TEXT;
BEGIN
  phase := CASE
    WHEN NEW."verificationStatus" IN ('UNRESOLVED','PROBABLE_MATCH') THEN 'IDENTITY_RESOLUTION'
    WHEN NEW."contactReadinessScore" < 60 THEN 'CONTACT_RESOLUTION'
    ELSE 'BUYER_READY'
  END;

  FOR link IN
    SELECT ds."signalId", d."score", d."deadlineAt", d."market", d."product", d."source"
    FROM "DemandBuyerSignal" ds
    JOIN "DemandSignal" d ON d."id"=ds."signalId"
    WHERE ds."buyerId"=NEW."id"
      AND d."status" <> 'ARCHIVED'
  LOOP
    IF phase <> 'BUYER_READY' THEN
      INSERT INTO "DemandTask"
        ("signalId","taskType","status","priority","dueAt","payload")
      VALUES
        (
          link."signalId",
          'RESOLVE_BUYER',
          'OPEN',
          least(100,greatest(link."score",NEW."executionScore")),
          link."deadlineAt",
          jsonb_build_object(
            'buyerId',NEW."id",
            'buyer',NEW."displayName",
            'phase',phase,
            'market',link."market",
            'product',link."product",
            'source',link."source"
          )
        )
      ON CONFLICT DO NOTHING;
    ELSE
      UPDATE "DemandTask"
      SET "status"='DONE',"updatedAt"=now()
      WHERE "signalId"=link."signalId"
        AND "taskType"='RESOLVE_BUYER'
        AND "status" IN ('OPEN','IN_PROGRESS');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_buyer_first_tasks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "buyer_profile_task_sync" ON "DemandBuyerProfile";
CREATE TRIGGER "buyer_profile_task_sync"
AFTER INSERT OR UPDATE OF "verificationStatus","contactReadinessScore","executionScore"
ON "DemandBuyerProfile"
FOR EACH ROW EXECUTE FUNCTION public.sync_buyer_first_tasks();

-- Seed buyer-first actions for existing profiles.
UPDATE "DemandBuyerProfile"
SET "updatedAt"=now();
