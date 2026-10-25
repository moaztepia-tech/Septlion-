# SEPTLION — Command Center Release Gates

Status: **NOT RELEASED**. This checklist is a release contract, not evidence that tests have passed.

## Architecture
- Customer frontend: existing Next.js application.
- Commercial system of record: existing API and tenant-scoped database.
- Demand intelligence Supabase project is **not** assumed to be the commercial database.
- Internal command center must not write to the database directly from the browser.

## Required authorization
1. Unauthenticated request to /command-center must not expose internal content.
2. Authenticated BUYER must not access internal operations or admin mutations.
3. Authenticated SALES may perform only explicitly permitted actions.
4. ADMIN can stage changes; publication requires a separate explicit confirmation.
5. Server validates identity, organization membership, and permission on every mutation; client-side checks are not sufficient.
6. All mutations write an audit event including actor, action, entity and timestamp.

## Catalog
- Create a DRAFT product with at least one packing variant.
- Reject duplicate SKU codes within an organization.
- Publishing requires verified product identity and mandatory fields.
- PUBLIC catalog exposes only ACTIVE/PUBLIC products.
- Archive instead of deleting a product referenced by historical transactions.
- An unverified product must never imply stock availability or a firm price.

## Customer-to-operations golden path
1. Customer discovers a published product or enters a free-form requirement.
2. Requirement is saved server-side with a stable identifier.
3. Authorized operator sees the same requirement and can qualify it.
4. Operator attaches a supplier verification record and costing evidence.
5. A quote is issued only after explicit commercial approval.
6. Customer accepts an unexpired quote.
7. Repeated order-intent requests with the same idempotency key do not duplicate orders.
8. Buyer sees only their own organization data; other tenants receive no private records.

## Release checks
- TypeScript typecheck and production build pass.
- Automated authorization, RLS, idempotency and lifecycle integration tests pass.
- Arabic mobile layout and keyboard interactions pass at 360px width.
- Production secrets are server-only; no service-role credentials in frontend.
- Migrations and backups are verified in staging.
- An operator manually completes the golden path in staging.
- Only then request merge, deployment and smoke tests.

## Current evidence
- Initial review-only UI exists on feature branch `feat/unified-command-center-20261026`.
- There is no evidence yet of passing build/integration tests or working catalog mutations.
- Do not label the command center production-ready.
