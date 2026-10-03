-- Defense in depth for tenant-scoped trade data. API transactions set app.current_organization_id.
-- Service/database owner can continue migrations; application role is constrained when RLS applies.
CREATE OR REPLACE FUNCTION current_app_org() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.current_organization_id', true), '') $$;

ALTER TABLE "CommercialLock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChangeOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeptlionOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeptlionOfferRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeMilestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeMemory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_lock_tenant" ON "CommercialLock" FOR ALL USING ("buyerOrgId"=current_app_org() OR "supplierOrgId"=current_app_org()) WITH CHECK ("buyerOrgId"=current_app_org() OR "supplierOrgId"=current_app_org());
CREATE POLICY "trade_transaction_tenant" ON "TradeTransaction" FOR ALL USING ("buyerOrgId"=current_app_org() OR "supplierOrgId"=current_app_org()) WITH CHECK ("buyerOrgId"=current_app_org() OR "supplierOrgId"=current_app_org());
CREATE POLICY "offer_tenant" ON "SeptlionOffer" FOR ALL USING ("buyerOrgId"=current_app_org() OR "operatorOrgId"=current_app_org()) WITH CHECK ("buyerOrgId"=current_app_org() OR "operatorOrgId"=current_app_org());
CREATE POLICY "trade_memory_buyer" ON "TradeMemory" FOR ALL USING ("buyerOrgId"=current_app_org()) WITH CHECK ("buyerOrgId"=current_app_org());

CREATE POLICY "trade_event_parent_tenant" ON "TradeEvent" FOR ALL USING (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org()))) WITH CHECK (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org())));
CREATE POLICY "change_order_parent_tenant" ON "ChangeOrder" FOR ALL USING (EXISTS(SELECT 1 FROM "CommercialLock" l WHERE l.id="commercialLockId" AND (l."buyerOrgId"=current_app_org() OR l."supplierOrgId"=current_app_org()))) WITH CHECK (EXISTS(SELECT 1 FROM "CommercialLock" l WHERE l.id="commercialLockId" AND (l."buyerOrgId"=current_app_org() OR l."supplierOrgId"=current_app_org())));
CREATE POLICY "offer_revision_parent_tenant" ON "SeptlionOfferRevision" FOR ALL USING (EXISTS(SELECT 1 FROM "SeptlionOffer" o WHERE o.id="offerId" AND (o."buyerOrgId"=current_app_org() OR o."operatorOrgId"=current_app_org()))) WITH CHECK (EXISTS(SELECT 1 FROM "SeptlionOffer" o WHERE o.id="offerId" AND (o."buyerOrgId"=current_app_org() OR o."operatorOrgId"=current_app_org())));
CREATE POLICY "milestone_parent_tenant" ON "TradeMilestone" FOR ALL USING (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org()))) WITH CHECK (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org())));
CREATE POLICY "receipt_parent_tenant" ON "TradeReceipt" FOR ALL USING (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org()))) WITH CHECK (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org())));
CREATE POLICY "claim_parent_tenant" ON "TradeClaim" FOR ALL USING (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org()))) WITH CHECK (EXISTS(SELECT 1 FROM "TradeTransaction" t WHERE t.id="transactionId" AND (t."buyerOrgId"=current_app_org() OR t."supplierOrgId"=current_app_org())));
