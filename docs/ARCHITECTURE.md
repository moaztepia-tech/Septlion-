# SEPTLION Architecture

## Core flow
Catalog Discovery → SKU → RFQ → Quote → Order Intent.

## Tenant isolation
Every tenant-owned table has organization ownership. PostgreSQL RLS is enabled and forced.
Tenant services use a transaction that sets `app.current_organization_id` with `SET LOCAL`.
Public catalog rows are an explicit exception: only ACTIVE + PUBLIC Product/SKU rows are readable cross-tenant.
Writes always require the current organization.

## Roles
- BUYER: create/manage RFQs and accept Quotes into Order Intent.
- SALES: view assigned RFQs and create Quotes.
- ADMIN: operational control within the organization.

## Important invariant
A Quote belongs to one RFQ and one supplier. A RFQ currently supports one supplier to keep commercial negotiation coherent.
Multi-supplier RFQ fan-out can be added as a separate `RFQRecipient` model later without changing the Quote domain.

## Security
- Short-lived access JWT.
- Rotating refresh tokens stored as hashes.
- Session version invalidates all access tokens when incremented.
- Membership is checked at token validation.
- RBAC is enforced server-side.
- RLS is enforced in PostgreSQL.
- Audit events are written in the same transaction as mutations.
