# SEPTLION V1 — End-to-End Integration

## Golden path
1. Buyer signs in and discovers an ACTIVE/PUBLIC SKU.
2. Buyer configures quantity (>= MOQ), destination and Incoterm and creates RFQ.
3. RFQ becomes the transaction root. Supplier matching is evaluated.
4. Supplier signs in and sees only RFQs addressed to its organization.
5. Supplier submits a Quote; every revision is immutable in `QuoteRevision`.
6. Buyer and supplier use a contextual workspace attached to RFQ/Quote for messages and shared document metadata.
7. Buyer accepts a non-expired Quote.
8. Buyer creates an idempotent Order Intent.
9. Audit records remain atomic with business mutations; async side effects use Outbox.

## Security invariants
- Tenant-owned reads/writes run inside `tenantTransaction()` and PostgreSQL RLS.
- Public catalog discovery is isolated behind `septlion_public_skus()`.
- A conversation's participants are derived server-side from RFQ/Quote/OrderIntent; the client cannot invite arbitrary organizations.
- A counterparty-visible document is visible only if the current organization is actually a party to the referenced transaction.
- Document completion is allowed only to the uploading organization.
- Outbox processing must use a dedicated worker DB role. Never expose `WORKER_DATABASE_URL` to the HTTP app/client.

## Failure scenarios to verify
- Quantity below MOQ => 400.
- Invalid sector Incoterm => 400.
- Tenant A reads Tenant B private product/RFQ => no row / 404.
- Unrelated Tenant C attempts to create/read transaction conversation => 403/404.
- Unrelated Tenant C attempts to read a `visibilityToCounterparty=true` document => no row.
- Supplier tries to accept its own Quote => 400/403.
- Buyer accepts expired Quote => 400.
- Order Intent called twice => same record, no duplicate.
- Empty message => 400.
- Document > 50 MiB => 400.

## Production gates still required
- Real S3/R2 StorageAdapter with presigned PUT/GET and object existence verification before `READY`.
- Dedicated worker DB role and grants for Outbox.
- Integration test database that is not owned by the application role.
- Rate limiting, CSRF strategy if cookie auth is enabled, CSP/security headers, secret rotation, observability and backups.
