# Production journey verification — 2026-10-06

The first authenticated buyer test failed to save a requirement with `Core profile lookup failed`. SQL-only lifecycle tests had not verified the service-role Data API path.

## Fix
- Grant the trade-api service role SELECT on its 20 referenced tables, INSERT on the 5 directly inserted tables, and UPDATE only on OutboxEvent for retries.
- Grant schema USAGE to the service role and configure PostgREST to include core alongside public and graphql_public.
- Keep RLS enabled on all core tables and keep direct anon/authenticated table grants absent.
- Business mutation RPCs remain restricted to service_role. The Edge Function validates the user through Auth before provisioning or handling any action.
- Synchronize the already-running trade-api CORS implementation with source control and log profile lookup error codes on the server, without credentials.

The two migration filenames use the versions returned by the production Supabase migration history. They have already been applied through the connected project. Do not re-run them as new timestamped migrations.

## Verified through the production UI
1. User-created Auth account exists and email is confirmed.
2. Secure email/password login redirects to the requirement composer; the account page shows Sign out.
3. The server provisions a buyer profile and organization.
4. An explicitly non-commercial TEST requirement qualifies, saves, and opens its request page.
5. Reloading the request and opening Trade reads the same persisted requirement and its OPEN RFQ.
6. Before operator enrollment, the account had BUYER membership and the operator dashboard denied access as intended.

## Approved operator enrollment
The account owner explicitly approved operator access on 2026-10-06. The verified Auth account associated with the existing TEST requirement received a second SALES membership in the active Septlion operator organization. Its original BUYER membership remains intact. An AuditLog record identifies the account, new membership, approval source and operational scope. No account identifiers or enrollment seeds are committed as a migration.

The production operations page was verified to open successfully after enrollment.

## Offer and document implementation
- Operations reads Septlion's RFQ queue and saved requirement, then issues a validated offer through the authenticated Edge API.
- The server enforces operator membership, Septlion RFQ ownership, valid line items/terms/expiry, supplier evidence for real offers and an idempotency key. Retrying the same saved payload returns the existing offer; changed retries conflict.
- TEST status derives from the persisted requirement, not client-supplied flags. TEST offers and documents are explicitly non-commercial and non-binding.
- The document endpoint checks buyer ownership or Septlion operator membership and loads the saved revision. PDF content omits exclusive classification labels and internal supplier evidence.
- The Arabic document preview supports a high-resolution image PDF download with pagination and a browser print view for selectable-text PDF. It uses the existing Cairo font and original master artwork. No new dependency, paid PDF service or external messaging is introduced.
- The deployment workflow includes the authenticated offer-document route. The new regression suite covers input validation, request replay, cross-buyer access, operator authorization and PDF structure.

Database access regression checks are in `supabase/tests/trade_api_runtime_access.sql`; they do not modify business data.

## Production offer verification
The deployed operator page issued one non-commercial TEST offer for the already-saved TEST requirement. The RFQ became QUOTED; the offer is ISSUED at revision 1. The stored snapshot identifies it as test-only, contains the entered test price and terms, and records the authorized issuing user. No CommercialLock or execution transaction was created.

The authenticated document page displayed the same saved revision. Its PDF download completed through the website and was independently parsed as a valid one-page A4 PDF. Visual inspection identified a portrait-logo header overlap; the renderer now fits the unchanged master artwork inside a bounded 185 × 100 px header box. The final production download must be visually checked after this layout correction.

## Still pending
- Verify commitment, execution, receipt and reorder with a clearly separated non-commercial test case. No real shipment, delivery, payment or completed transaction has been recorded in this test.
