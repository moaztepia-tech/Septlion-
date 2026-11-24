-- Copied from the production migration history. Secret values were removed from the
-- repository copy: set them with `set app.<name> = '...'` before applying to a new
-- project. Production already holds them in Vault and is not re-run.

CREATE TABLE IF NOT EXISTS "DemandOperatorKey" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL UNIQUE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "revokedAt" TIMESTAMPTZ
);

ALTER TABLE "DemandOperatorKey" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandOperatorKey" FROM anon, authenticated;

INSERT INTO "DemandOperatorKey" ("label","keyHash")
VALUES ('primary-operator',current_setting('app.septlion_operator_key_hash'))
ON CONFLICT ("keyHash") DO NOTHING;

CREATE OR REPLACE VIEW public."DemandWorkbenchQueue" AS
SELECT
  t."id" AS "taskId",
  t."taskType",
  t."status" AS "taskStatus",
  t."priority",
  t."dueAt",
  d."id" AS "signalId",
  d."stage",
  d."status" AS "signalStatus",
  d."score",
  d."type",
  d."market",
  d."product",
  d."quantity",
  d."buyerName",
  d."deadlineAt",
  d."source",
  d."sourceUrl",
  br."confidence" AS "buyerConfidence",
  br."verificationStatus" AS "buyerVerificationStatus",
  q."decision" AS "qualificationDecision",
  q."localPartnerRequired",
  q."nextAction"
FROM "DemandTask" t
JOIN "DemandSignal" d ON d."id"=t."signalId"
LEFT JOIN "DemandBuyerResolution" br ON br."signalId"=d."id"
LEFT JOIN "DemandQualification" q ON q."signalId"=d."id";

REVOKE ALL ON TABLE public."DemandWorkbenchQueue" FROM PUBLIC, anon, authenticated;
