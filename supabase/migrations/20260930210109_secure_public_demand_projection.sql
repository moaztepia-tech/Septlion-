
CREATE TABLE IF NOT EXISTS "PublicDemandSignal" (
  "id" UUID PRIMARY KEY,
  "type" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "quantity" TEXT,
  "publishedAt" TIMESTAMPTZ,
  "deadlineAt" TIMESTAMPTZ,
  "status" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "sourceUrl" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "PublicDemandSignal" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_demand_projection" ON "PublicDemandSignal";
CREATE POLICY "public_read_demand_projection"
ON "PublicDemandSignal"
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE "PublicDemandSignal" FROM anon, authenticated;
GRANT SELECT ON TABLE "PublicDemandSignal" TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_public_demand_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "PublicDemandSignal" WHERE "id" = OLD."id";
    RETURN OLD;
  END IF;

  IF NEW."status" = 'ARCHIVED' THEN
    DELETE FROM "PublicDemandSignal" WHERE "id" = NEW."id";
    RETURN NEW;
  END IF;

  INSERT INTO "PublicDemandSignal"
    ("id","type","market","product","quantity","publishedAt","deadlineAt","status","stage","score","sourceUrl","updatedAt")
  VALUES
    (NEW."id",NEW."type"::text,NEW."market",NEW."product",NEW."quantity",NEW."publishedAt",NEW."deadlineAt",
     NEW."status"::text,NEW."stage"::text,NEW."score",NEW."sourceUrl",now())
  ON CONFLICT ("id") DO UPDATE SET
    "type"=excluded."type",
    "market"=excluded."market",
    "product"=excluded."product",
    "quantity"=excluded."quantity",
    "publishedAt"=excluded."publishedAt",
    "deadlineAt"=excluded."deadlineAt",
    "status"=excluded."status",
    "stage"=excluded."stage",
    "score"=excluded."score",
    "sourceUrl"=excluded."sourceUrl",
    "updatedAt"=now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_demand_signal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "demand_signal_public_projection" ON "DemandSignal";
CREATE TRIGGER "demand_signal_public_projection"
AFTER INSERT OR UPDATE OR DELETE ON "DemandSignal"
FOR EACH ROW EXECUTE FUNCTION public.sync_public_demand_signal();

INSERT INTO "PublicDemandSignal"
("id","type","market","product","quantity","publishedAt","deadlineAt","status","stage","score","sourceUrl","updatedAt")
SELECT
  d."id",d."type"::text,d."market",d."product",d."quantity",d."publishedAt",d."deadlineAt",
  d."status"::text,d."stage"::text,d."score",d."sourceUrl",now()
FROM "DemandSignal" d
WHERE d."status" <> 'ARCHIVED'
ON CONFLICT ("id") DO UPDATE SET
  "type"=excluded."type",
  "market"=excluded."market",
  "product"=excluded."product",
  "quantity"=excluded."quantity",
  "publishedAt"=excluded."publishedAt",
  "deadlineAt"=excluded."deadlineAt",
  "status"=excluded."status",
  "stage"=excluded."stage",
  "score"=excluded."score",
  "sourceUrl"=excluded."sourceUrl",
  "updatedAt"=now();

DROP FUNCTION IF EXISTS public.get_public_demand_signals();
DROP FUNCTION IF EXISTS public.get_public_demand_stats();
