-- Execute manually against a non-superuser app role after seeding.
-- Replace UUIDs with the two organization IDs from seed output.
-- These assertions are intentionally explicit: no cross-tenant private rows.

SELECT set_config('app.current_organization_id','ORG_A',true);
SELECT count(*) FROM "Product" WHERE "organizationId"='ORG_B'; -- must be 0
SELECT count(*) FROM "SKU" WHERE "organizationId"='ORG_B' AND EXISTS (SELECT 1 FROM "Product" p WHERE p.id="SKU"."productId" AND p.visibility='PRIVATE'); -- must be 0

SELECT set_config('app.current_organization_id','ORG_B',true);
SELECT count(*) FROM "Product" WHERE "organizationId"='ORG_A'; -- must be 0 unless product is PUBLIC+ACTIVE
SELECT count(*) FROM "RFQ" WHERE "buyerOrgId"='ORG_A' AND "supplierOrgId" <> 'ORG_B'; -- only rows explicitly involving ORG_B may appear
