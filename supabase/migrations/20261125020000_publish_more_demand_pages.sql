-- Publish demand pages for every active cluster with score >= 50 (was >= 65 and seen in the last 30 days).
-- Clusters are already limited to signals from the last 60 days; stale ones are archived by the same function.

CREATE OR REPLACE FUNCTION public.refresh_platform_demand_clusters()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Publish every active demand cluster with a reasonable score. The cluster window
    -- is already limited to the last 60 days; stale clusters are archived below.
    page_status := CASE
      WHEN score_value >= 50 THEN 'PUBLISHED'
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
$function$;

-- Apply the new rule now (the 6-hour cron job runs the same function).
select public.refresh_platform_demand_clusters();
select status, count(*) from public."DemandIntentPage" group by status order by status;
