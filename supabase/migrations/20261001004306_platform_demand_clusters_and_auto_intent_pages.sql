
CREATE TABLE IF NOT EXISTS "DemandCluster" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clusterKey" TEXT NOT NULL UNIQUE,
  "productKey" TEXT NOT NULL,
  "variant" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "representativeSignalId" UUID NOT NULL REFERENCES "DemandSignal"("id") ON DELETE CASCADE,
  "signalCount" INTEGER NOT NULL DEFAULT 0,
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "quantityKnownCount" INTEGER NOT NULL DEFAULT 0,
  "latestDemandAt" TIMESTAMPTZ,
  "firstDemandAt" TIMESTAMPTZ,
  "sources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "quantityExamples" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "demandScore" INTEGER NOT NULL DEFAULT 0 CHECK ("demandScore" BETWEEN 0 AND 100),
  "searchPhrase" TEXT NOT NULL,
  "pageSlug" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','STALE','ARCHIVED')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DemandCluster_score_idx"
  ON "DemandCluster"("status","demandScore" DESC,"latestDemandAt" DESC);
CREATE INDEX IF NOT EXISTS "DemandCluster_product_market_idx"
  ON "DemandCluster"("productKey","market");

ALTER TABLE "DemandCluster" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemandCluster" FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS "PublicDemandCluster" (
  "id" UUID PRIMARY KEY,
  "clusterKey" TEXT NOT NULL UNIQUE,
  "productKey" TEXT NOT NULL,
  "variant" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "signalCount" INTEGER NOT NULL,
  "sourceCount" INTEGER NOT NULL,
  "latestDemandAt" TIMESTAMPTZ,
  "sources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "quantityExamples" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "demandScore" INTEGER NOT NULL,
  "searchPhrase" TEXT NOT NULL,
  "pageSlug" TEXT NOT NULL UNIQUE,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "PublicDemandCluster" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_demand_clusters" ON "PublicDemandCluster";
CREATE POLICY "public_read_demand_clusters"
ON "PublicDemandCluster"
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE "PublicDemandCluster" FROM anon, authenticated;
GRANT SELECT ON TABLE "PublicDemandCluster" TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.classify_wheat_flour_variant(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(value,'')) ~ '(chakki|atta)' THEN 'Chakki Atta'
    WHEN lower(coalesce(value,'')) ~ '(whole[ -]?wheat|wholemeal)' THEN 'Whole Wheat Flour'
    WHEN lower(coalesce(value,'')) ~ '(all[ -]?purpose)' THEN 'All Purpose Flour'
    WHEN lower(coalesce(value,'')) ~ '(bread flour|cake flour|japanese flour)' THEN 'Bakery Flour'
    WHEN lower(coalesce(value,'')) ~ '(durum)' THEN 'Durum Wheat Flour'
    WHEN lower(coalesce(value,'')) ~ '(refined|white wheat|white flour)' THEN 'Refined Wheat Flour'
    WHEN lower(coalesce(value,'')) ~ '(specialty|speciality)' THEN 'Specialty Wheat Flour'
    ELSE 'Wheat Flour'
  END;
$$;

REVOKE ALL ON FUNCTION public.classify_wheat_flour_variant(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_platform_demand_clusters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row RECORD;
  current_count INTEGER := 0;
  recency_points INTEGER;
  score_value INTEGER;
  stable_rep UUID;
  cluster_id UUID;
  page_status TEXT;
  page_title TEXT;
  page_content JSONB;
  scale_label TEXT;
BEGIN
  -- Mark everything stale first; current clusters are reactivated below.
  UPDATE "DemandCluster"
  SET "status"='STALE',"updatedAt"=now()
  WHERE "productKey"='wheat_flour'
    AND "status" <> 'ARCHIVED';

  FOR row IN
    WITH recent AS (
      SELECT
        d."id",
        d."productKey",
        d."market",
        public.classify_wheat_flour_variant(
          coalesce(d."product",'') || ' ' ||
          coalesce(d."evidence"->>'description','') || ' ' ||
          coalesce(d."raw"->>'description','')
        ) AS variant,
        d."source",
        d."quantity",
        coalesce(d."publishedAt",d."firstSeenAt") AS observed_at
      FROM "DemandSignal" d
      WHERE d."source" IN ('TradeWheel','go4WorldBusiness','Freshdi','ExportHub')
        AND d."productKey"='wheat_flour'
        AND coalesce(d."publishedAt",d."firstSeenAt") >= now() - interval '60 days'
    ),
    grouped AS (
      SELECT
        "productKey",
        "market",
        variant,
        count(*)::int AS signal_count,
        count(DISTINCT "source")::int AS source_count,
        count("quantity")::int AS qty_count,
        max(observed_at) AS latest_at,
        min(observed_at) AS first_at,
        jsonb_agg(DISTINCT "source") AS sources_json,
        jsonb_agg(DISTINCT "quantity") FILTER (WHERE "quantity" IS NOT NULL) AS qty_json,
        (array_agg("id" ORDER BY observed_at DESC,"id"))[1] AS newest_signal_id
      FROM recent
      GROUP BY "productKey","market",variant
    )
    SELECT * FROM grouped
  LOOP
    recency_points := CASE
      WHEN row.latest_at >= now() - interval '7 days' THEN 32
      WHEN row.latest_at >= now() - interval '14 days' THEN 26
      WHEN row.latest_at >= now() - interval '30 days' THEN 18
      ELSE 8
    END;

    score_value := least(100,
      30
      + recency_points
      + least(20,row.signal_count*7)
      + least(10,row.source_count*5)
      + CASE WHEN row.qty_count>0 THEN 8 ELSE 0 END
    );

    SELECT "representativeSignalId" INTO stable_rep
    FROM "DemandCluster"
    WHERE "clusterKey"=row."productKey"||'|'||lower(row."market")||'|'||lower(row.variant);

    stable_rep := coalesce(stable_rep,row.newest_signal_id);

    INSERT INTO "DemandCluster"
      ("clusterKey","productKey","variant","market","representativeSignalId","signalCount","sourceCount",
       "quantityKnownCount","latestDemandAt","firstDemandAt","sources","quantityExamples","demandScore",
       "searchPhrase","pageSlug","status","updatedAt")
    VALUES
      (
        row."productKey"||'|'||lower(row."market")||'|'||lower(row.variant),
        row."productKey",row.variant,row."market",stable_rep,row.signal_count,row.source_count,row.qty_count,
        row.latest_at,row.first_at,coalesce(row.sources_json,'[]'::jsonb),coalesce(row.qty_json,'[]'::jsonb),
        score_value,
        trim(row.variant||' supplier '||row."market"||' wholesale RFQ import'),
        public.slugify_demand(row.variant||'-'||row."market"),
        'ACTIVE',now()
      )
    ON CONFLICT ("clusterKey") DO UPDATE SET
      "signalCount"=excluded."signalCount",
      "sourceCount"=excluded."sourceCount",
      "quantityKnownCount"=excluded."quantityKnownCount",
      "latestDemandAt"=excluded."latestDemandAt",
      "firstDemandAt"=excluded."firstDemandAt",
      "sources"=excluded."sources",
      "quantityExamples"=excluded."quantityExamples",
      "demandScore"=excluded."demandScore",
      "searchPhrase"=excluded."searchPhrase",
      "status"='ACTIVE',
      "updatedAt"=now()
    RETURNING "id" INTO cluster_id;

    INSERT INTO "PublicDemandCluster"
      ("id","clusterKey","productKey","variant","market","signalCount","sourceCount","latestDemandAt",
       "sources","quantityExamples","demandScore","searchPhrase","pageSlug","updatedAt")
    SELECT
      c."id",c."clusterKey",c."productKey",c."variant",c."market",c."signalCount",c."sourceCount",
      c."latestDemandAt",c."sources",c."quantityExamples",c."demandScore",c."searchPhrase",c."pageSlug",now()
    FROM "DemandCluster" c
    WHERE c."id"=cluster_id
    ON CONFLICT ("id") DO UPDATE SET
      "signalCount"=excluded."signalCount",
      "sourceCount"=excluded."sourceCount",
      "latestDemandAt"=excluded."latestDemandAt",
      "sources"=excluded."sources",
      "quantityExamples"=excluded."quantityExamples",
      "demandScore"=excluded."demandScore",
      "searchPhrase"=excluded."searchPhrase",
      "pageSlug"=excluded."pageSlug",
      "updatedAt"=now();

    scale_label := CASE
      WHEN row.qty_count=0 THEN 'Commercial wholesale / FCL'
      WHEN row.qty_json::text ~* 'container' THEN 'FCL commercial supply'
      WHEN row.qty_json::text ~* '(metric tons|mt|tonnes|tons)' THEN 'Bulk / commercial volume'
      ELSE 'Commercial wholesale'
    END;

    page_status := CASE
      WHEN score_value >= 65 AND row.latest_at >= now() - interval '30 days' THEN 'PUBLISHED'
      ELSE 'READY'
    END;

    page_title := row.variant||' Supply to '||row."market";

    page_content := jsonb_build_object(
      'product',row.variant,
      'market',row."market",
      'variant',row.variant,
      'quantity',scale_label,
      'packing',NULL,
      'incoterm','FOB / CFR / CIF',
      'cta','Request a Septlion supply offer',
      'demandSignalCount',row.signal_count,
      'sourceCount',row.source_count,
      'latestDemandAt',row.latest_at,
      'quantityPatterns',coalesce(row.qty_json,'[]'::jsonb),
      'demandScore',score_value,
      'basis','Recent public B2B buying signals. Buyer identities are excluded from this public page.',
      'seoTitle',row.variant||' Supplier for '||row."market"||' | Septlion Supply',
      'seoDescription','Demand-led '||row.variant||' supply for buyers in '||row."market"||'. Configure volume, packing, destination and delivery terms and submit an RFQ to Septlion.'
    );

    INSERT INTO "DemandIntentPage"
      ("signalId","slug","status","title","productKey","market","searchIntent","content","publishedAt","updatedAt")
    VALUES
      (
        stable_rep,
        public.slugify_demand(row.variant||'-'||row."market"),
        page_status,
        page_title,
        row."productKey",
        row."market",
        trim(row.variant||' supplier '||row."market"||' wholesale flour import RFQ'),
        page_content,
        CASE WHEN page_status='PUBLISHED' THEN now() ELSE NULL END,
        now()
      )
    ON CONFLICT ("slug") DO UPDATE SET
      "status"=excluded."status",
      "title"=excluded."title",
      "productKey"=excluded."productKey",
      "market"=excluded."market",
      "searchIntent"=excluded."searchIntent",
      "content"=excluded."content",
      "publishedAt"=CASE
        WHEN excluded."status"='PUBLISHED'
          THEN coalesce("DemandIntentPage"."publishedAt",now())
        ELSE "DemandIntentPage"."publishedAt"
      END,
      "updatedAt"=now();

    current_count := current_count + 1;
  END LOOP;

  DELETE FROM "PublicDemandCluster" p
  WHERE NOT EXISTS (
    SELECT 1 FROM "DemandCluster" c
    WHERE c."id"=p."id" AND c."status"='ACTIVE'
  );

  -- Hide stale auto-generated pages from the public projection.
  UPDATE "DemandIntentPage" ip
  SET "status"='ARCHIVED',"updatedAt"=now()
  WHERE ip."productKey"='wheat_flour'
    AND ip."content"->>'basis' LIKE 'Recent public B2B buying signals%'
    AND NOT EXISTS (
      SELECT 1 FROM "DemandCluster" c
      WHERE c."pageSlug"=ip."slug" AND c."status"='ACTIVE'
    );

  RETURN current_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_platform_demand_clusters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_platform_demand_clusters() TO service_role;

DO $$
BEGIN PERFORM cron.unschedule('septlion-demand-cluster-refresh');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'septlion-demand-cluster-refresh',
  '27 */6 * * *',
  $$SELECT public.refresh_platform_demand_clusters();$$
);

SELECT public.refresh_platform_demand_clusters();
