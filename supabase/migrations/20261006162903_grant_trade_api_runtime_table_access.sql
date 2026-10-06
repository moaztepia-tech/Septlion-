-- Runtime table access for the already-authenticated trade-api server.
-- Business mutation RPCs already grant EXECUTE to service_role only.
-- No grants to anon/authenticated and no changes to row-level security.
GRANT USAGE ON SCHEMA core TO service_role;
GRANT SELECT ON TABLE
  core."User", core."Membership", core."Organization",
  core."QualifiedRequirement", core."RFQ", core."SeptlionOffer",
  core."CommercialLock", core."TradeTransaction", core."SeptlionOfferRevision",
  core."DemandSignal", core."Opportunity", core."SupplyCandidate",
  core."OutboxEvent", core."HumanApproval", core."TradeMilestone",
  core."TradeReceipt", core."TradeEvent", core."MaritimeRFQ",
  core."CommercialDocument", core."Notification"
TO service_role;
GRANT INSERT ON TABLE
  core."User", core."Membership", core."Organization",
  core."SupplyCandidate", core."MaritimeRFQ"
TO service_role;
GRANT UPDATE ON TABLE core."OutboxEvent" TO service_role;
NOTIFY pgrst, 'reload schema';
