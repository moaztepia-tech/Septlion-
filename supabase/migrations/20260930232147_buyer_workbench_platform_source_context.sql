
DROP VIEW IF EXISTS public."DemandBuyerWorkbench";

CREATE VIEW public."DemandBuyerWorkbench" AS
SELECT
  b."id",
  b."displayName",
  b."legalName",
  b."country",
  b."website",
  b."buyerType",
  b."verificationStatus",
  b."confidence",
  b."productKeys",
  b."signalCount",
  b."sourceCount",
  b."lastBuyingSignalAt",
  b."buyingIntentScore",
  b."contactReadinessScore",
  b."executionScore",
  c."contactName" AS "primaryContactName",
  c."role" AS "primaryContactRole",
  c."email" AS "primaryEmail",
  c."phone" AS "primaryPhone",
  c."whatsapp" AS "primaryWhatsapp",
  c."verificationStatus" AS "contactVerification",
  latest."source" AS "latestSource",
  latest."product" AS "latestProduct",
  latest."quantity" AS "latestQuantity",
  latest."sourceUrl" AS "latestSourceUrl",
  (latest."source" IN ('TradeWheel','go4WorldBusiness','Freshdi','ExportHub')) AS "latestIsPlatform",
  src."sources" AS "sources"
FROM "DemandBuyerProfile" b
LEFT JOIN LATERAL (
  SELECT *
  FROM "DemandBuyerContact" c
  WHERE c."buyerId"=b."id"
  ORDER BY c."primaryContact" DESC,c."confidence" DESC,c."updatedAt" DESC
  LIMIT 1
) c ON true
LEFT JOIN LATERAL (
  SELECT d."source",d."product",d."quantity",d."sourceUrl",
         coalesce(d."publishedAt",d."firstSeenAt") AS observed_at
  FROM "DemandBuyerSignal" bs
  JOIN "DemandSignal" d ON d."id"=bs."signalId"
  WHERE bs."buyerId"=b."id"
  ORDER BY coalesce(d."publishedAt",d."firstSeenAt") DESC,d."score" DESC
  LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(DISTINCT d."source") AS sources
  FROM "DemandBuyerSignal" bs
  JOIN "DemandSignal" d ON d."id"=bs."signalId"
  WHERE bs."buyerId"=b."id"
) src ON true;

REVOKE ALL ON TABLE public."DemandBuyerWorkbench" FROM PUBLIC, anon, authenticated;
