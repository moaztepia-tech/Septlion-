-- Run after Prisma migrations.
-- App DB role should NOT be superuser and should not have BYPASSRLS.

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_read_write_policy ON "Product";
CREATE POLICY product_read_write_policy ON "Product"
USING (
  "organizationId" = current_setting('app.current_organization_id', true)
  OR ("visibility" = 'PUBLIC' AND "status" = 'ACTIVE')
)
WITH CHECK (
  "organizationId" = current_setting('app.current_organization_id', true)
);

ALTER TABLE "SKU" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SKU" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sku_read_write_policy ON "SKU";
CREATE POLICY sku_read_write_policy ON "SKU"
USING (
  "organizationId" = current_setting('app.current_organization_id', true)
  OR EXISTS (
    SELECT 1 FROM "Product" p
    WHERE p.id = "SKU"."productId"
      AND p.visibility = 'PUBLIC'
      AND p.status = 'ACTIVE'
  )
)
WITH CHECK (
  "organizationId" = current_setting('app.current_organization_id', true)
);

ALTER TABLE "RFQ" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RFQ" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfq_select_policy ON "RFQ";
CREATE POLICY rfq_select_policy ON "RFQ" FOR SELECT USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS rfq_insert_policy ON "RFQ";
CREATE POLICY rfq_insert_policy ON "RFQ" FOR INSERT WITH CHECK (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS rfq_update_policy ON "RFQ";
CREATE POLICY rfq_update_policy ON "RFQ" FOR UPDATE USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
) WITH CHECK (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS rfq_delete_policy ON "RFQ";
CREATE POLICY rfq_delete_policy ON "RFQ" FOR DELETE USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
);

ALTER TABLE "RFQItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RFQItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rfq_item_select_policy ON "RFQItem";
CREATE POLICY rfq_item_select_policy ON "RFQItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id = "RFQItem"."rfqId" AND (
    r."buyerOrgId" = current_setting('app.current_organization_id', true)
    OR r."supplierOrgId" = current_setting('app.current_organization_id', true)
  ))
);
DROP POLICY IF EXISTS rfq_item_insert_policy ON "RFQItem";
CREATE POLICY rfq_item_insert_policy ON "RFQItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id = "RFQItem"."rfqId" AND r."buyerOrgId" = current_setting('app.current_organization_id', true))
);
DROP POLICY IF EXISTS rfq_item_update_policy ON "RFQItem";
CREATE POLICY rfq_item_update_policy ON "RFQItem" FOR UPDATE USING (
  EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id = "RFQItem"."rfqId" AND (
    r."buyerOrgId" = current_setting('app.current_organization_id', true)
    OR r."supplierOrgId" = current_setting('app.current_organization_id', true)
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id = "RFQItem"."rfqId" AND (
    r."buyerOrgId" = current_setting('app.current_organization_id', true)
    OR r."supplierOrgId" = current_setting('app.current_organization_id', true)
  ))
);

ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_select_policy ON "Quote";
CREATE POLICY quote_select_policy ON "Quote" FOR SELECT USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS quote_insert_policy ON "Quote";
CREATE POLICY quote_insert_policy ON "Quote" FOR INSERT WITH CHECK (
  "supplierOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS quote_update_policy ON "Quote";
CREATE POLICY quote_update_policy ON "Quote" FOR UPDATE USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
) WITH CHECK (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
);

ALTER TABLE "QuoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_item_select_policy ON "QuoteItem";
CREATE POLICY quote_item_select_policy ON "QuoteItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Quote" q WHERE q.id = "QuoteItem"."quoteId" AND (
    q."buyerOrgId" = current_setting('app.current_organization_id', true)
    OR q."supplierOrgId" = current_setting('app.current_organization_id', true)
  ))
);
DROP POLICY IF EXISTS quote_item_insert_policy ON "QuoteItem";
CREATE POLICY quote_item_insert_policy ON "QuoteItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "Quote" q WHERE q.id = "QuoteItem"."quoteId" AND q."supplierOrgId" = current_setting('app.current_organization_id', true))
);

ALTER TABLE "OrderIntent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderIntent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_intent_select_policy ON "OrderIntent";
CREATE POLICY order_intent_select_policy ON "OrderIntent" FOR SELECT USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS order_intent_insert_policy ON "OrderIntent";
CREATE POLICY order_intent_insert_policy ON "OrderIntent" FOR INSERT WITH CHECK (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS order_intent_update_policy ON "OrderIntent";
CREATE POLICY order_intent_update_policy ON "OrderIntent" FOR UPDATE USING (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
) WITH CHECK (
  "buyerOrgId" = current_setting('app.current_organization_id', true)
  OR "supplierOrgId" = current_setting('app.current_organization_id', true)
);

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_select_policy ON "AuditLog";
CREATE POLICY audit_select_policy ON "AuditLog" FOR SELECT USING (
  "organizationId" = current_setting('app.current_organization_id', true)
);
DROP POLICY IF EXISTS audit_insert_policy ON "AuditLog";
CREATE POLICY audit_insert_policy ON "AuditLog" FOR INSERT WITH CHECK (
  "organizationId" = current_setting('app.current_organization_id', true)
);


-- ============================================================================
-- PUBLIC CATALOG DISCOVERY
-- ============================================================================
--
-- Public discovery is intentionally separate from tenant-private access.
-- The application should call this function instead of querying Product/SKU
-- directly when discovering another supplier's public catalog.
-- In production, own this function with a dedicated DB role that is allowed
-- to bypass RLS and grant EXECUTE only to the API role.
--
CREATE OR REPLACE FUNCTION septlion_public_skus(
  p_sector_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  sku_id uuid,
  organization_id uuid,
  product_id uuid,
  sector_id uuid,
  sku_code text,
  sku_name text,
  unit text,
  minimum_order_qty numeric,
  currency text,
  product_name text,
  organization_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s."organizationId", s."productId", p."sectorId",
    s."skuCode", s.name, s.unit, s."minimumOrderQty", s.currency,
    p.name, o.name
  FROM "SKU" s
  JOIN "Product" p ON p.id = s."productId"
  JOIN "Organization" o ON o.id = p."organizationId"
  WHERE p.status = 'ACTIVE'
    AND p.visibility = 'PUBLIC'
    AND (p_sector_id IS NULL OR p."sectorId" = p_sector_id)
  ORDER BY p."updatedAt" DESC, s."updatedAt" DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

REVOKE ALL ON FUNCTION septlion_public_skus(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION septlion_public_skus(uuid, integer) TO septlion;

ALTER TABLE "QuoteRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteRevision" FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_revision_tenant_policy
ON "QuoteRevision"
USING (
  EXISTS (
    SELECT 1 FROM "Quote" q
    WHERE q.id = "QuoteRevision"."quoteId"
      AND (
        q."buyerOrgId" = current_setting('app.current_organization_id', true)
        OR q."supplierOrgId" = current_setting('app.current_organization_id', true)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Quote" q
    WHERE q.id = "QuoteRevision"."quoteId"
      AND q."supplierOrgId" = current_setting('app.current_organization_id', true)
  )
);


-- TRANSACTION WORKSPACE RLS
-- الوصول إلى المستندات والمحادثات مربوط بأطراف المعاملة نفسها، لا بمجرد flag عام.
ALTER TABLE "CommercialDocument" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CommercialDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commercial_document_policy ON "CommercialDocument";
CREATE POLICY commercial_document_policy ON "CommercialDocument"
USING (
  "organizationId" = current_setting('app.current_organization_id',true)
  OR (
    "visibilityToCounterparty" = true AND (
      ("entityType"='RFQ' AND EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id="CommercialDocument"."entityId"::uuid AND (r."buyerOrgId"=current_setting('app.current_organization_id',true) OR r."supplierOrgId"=current_setting('app.current_organization_id',true))))
      OR ("entityType"='QUOTE' AND EXISTS (SELECT 1 FROM "Quote" q WHERE q.id="CommercialDocument"."entityId"::uuid AND (q."buyerOrgId"=current_setting('app.current_organization_id',true) OR q."supplierOrgId"=current_setting('app.current_organization_id',true))))
      OR ("entityType"='ORDER_INTENT' AND EXISTS (SELECT 1 FROM "OrderIntent" oi WHERE oi.id="CommercialDocument"."entityId"::uuid AND (oi."buyerOrgId"=current_setting('app.current_organization_id',true) OR oi."supplierOrgId"=current_setting('app.current_organization_id',true))))
    )
  )
)
WITH CHECK ("organizationId"=current_setting('app.current_organization_id',true));

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY; ALTER TABLE "Conversation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_policy ON "Conversation";
DROP POLICY IF EXISTS conversation_insert_policy ON "Conversation";
CREATE POLICY conversation_policy ON "Conversation" FOR SELECT USING (
  EXISTS(SELECT 1 FROM "ConversationParticipant" cp WHERE cp."conversationId"="Conversation".id AND cp."organizationId"=current_setting('app.current_organization_id',true))
);
CREATE POLICY conversation_insert_policy ON "Conversation" FOR INSERT WITH CHECK (
  ("entityType"='RFQ' AND EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id="Conversation"."entityId"::uuid AND (r."buyerOrgId"=current_setting('app.current_organization_id',true) OR r."supplierOrgId"=current_setting('app.current_organization_id',true))))
  OR ("entityType"='QUOTE' AND EXISTS (SELECT 1 FROM "Quote" q WHERE q.id="Conversation"."entityId"::uuid AND (q."buyerOrgId"=current_setting('app.current_organization_id',true) OR q."supplierOrgId"=current_setting('app.current_organization_id',true))))
  OR ("entityType"='ORDER_INTENT' AND EXISTS (SELECT 1 FROM "OrderIntent" oi WHERE oi.id="Conversation"."entityId"::uuid AND (oi."buyerOrgId"=current_setting('app.current_organization_id',true) OR oi."supplierOrgId"=current_setting('app.current_organization_id',true))))
);

ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY; ALTER TABLE "ConversationParticipant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_participant_policy ON "ConversationParticipant";
CREATE POLICY conversation_participant_policy ON "ConversationParticipant"
USING ("organizationId"=current_setting('app.current_organization_id',true))
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Conversation" c WHERE c.id="ConversationParticipant"."conversationId" AND (
      (c."entityType"='RFQ' AND EXISTS (SELECT 1 FROM "RFQ" r WHERE r.id=c."entityId"::uuid AND (r."buyerOrgId"=current_setting('app.current_organization_id',true) OR r."supplierOrgId"=current_setting('app.current_organization_id',true))))
      OR (c."entityType"='QUOTE' AND EXISTS (SELECT 1 FROM "Quote" q WHERE q.id=c."entityId"::uuid AND (q."buyerOrgId"=current_setting('app.current_organization_id',true) OR q."supplierOrgId"=current_setting('app.current_organization_id',true))))
      OR (c."entityType"='ORDER_INTENT' AND EXISTS (SELECT 1 FROM "OrderIntent" oi WHERE oi.id=c."entityId"::uuid AND (oi."buyerOrgId"=current_setting('app.current_organization_id',true) OR oi."supplierOrgId"=current_setting('app.current_organization_id',true))))
    )
  )
);

ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY; ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_policy ON "Message";
CREATE POLICY message_policy ON "Message" USING (EXISTS(SELECT 1 FROM "ConversationParticipant" cp WHERE cp."conversationId"="Message"."conversationId" AND cp."organizationId"=current_setting('app.current_organization_id',true))) WITH CHECK ("senderOrgId"=current_setting('app.current_organization_id',true));
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY; ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_policy ON "Notification";
CREATE POLICY notification_policy ON "Notification" USING ("organizationId"=current_setting('app.current_organization_id',true)) WITH CHECK ("organizationId"=current_setting('app.current_organization_id',true));
ALTER TABLE "OutboxEvent" ENABLE ROW LEVEL SECURITY; ALTER TABLE "OutboxEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_tenant_policy ON "OutboxEvent";
CREATE POLICY outbox_tenant_policy ON "OutboxEvent" USING ("organizationId"=current_setting('app.current_organization_id',true)) WITH CHECK ("organizationId"=current_setting('app.current_organization_id',true));
