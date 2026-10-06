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
6. The current account has BUYER membership, with zero operator memberships. The operator dashboard denies access as intended.

Database access regression checks are in `supabase/tests/trade_api_runtime_access.sql`; they do not modify business data.

## Still pending
- Decide which verified account is the Septlion operator. Do not silently elevate a buyer account.
- Issue a TEST-only offer and verify its document in an authorized operator session.
- Verify commitment, execution, receipt and reorder with a clearly separated non-commercial test case. No real shipment, delivery, payment or completed transaction has been recorded in this test.
