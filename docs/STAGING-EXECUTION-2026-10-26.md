# Isolated staging execution — 2026-10-26

Source application: `24c033d286574d148a776ffd565e22c9419fd5f5`, PR #51. Application CI at that commit passed all four jobs; 95 Node/API/PostgreSQL tests and the full 360px browser scenario passed. This report does not claim a completed cloud acceptance run.

## Created and verified

- User selected organization Septlion and authorized an independent project only at zero cost. The Supabase create-project tool accepted creation without requesting any nonzero cost approval. No paid plan upgrade was performed.
- Project: `septlion-pr51-staging`, ref `vludcbongjozfvpysnuh`, region `eu-central-1`, status `ACTIVE_HEALTHY`.
- Fresh project initially had no public/core tables or migration history.
- Restored existing commercial schema/runtime from the original project's migration definitions, not its data. Excluded the unrelated obsolete public demand-feed RPC revocation. No demand collectors, cron jobs, production users or commercial records were copied.
- Applied `staging_existing_core_runtime_baseline` and `atomic_phone_identity`.
- SQL verification: 47 core tables, zero tables without RLS, zero anon/authenticated direct core table grants, zero users/requirements/transactions. Identity provisioning RPC exists; catalog mutation RPC does not yet exist.
- Deployed `trade-api` from the current source, including `phone-input.ts`, as Edge version 2. `verify_jwt:false` permits the explicitly public catalog; every private action still calls Auth `getUser` and enforces stored membership.
- Security advisor returned informational RLS-without-policy notices on 37 server-only tables; no warning/error-level findings were returned. These tables intentionally have no direct browser grants. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

## Incomplete gates

- Catalog and media migrations did not apply: the connector repeatedly returned `McpServerError: Invalid or expired requestState`. Migration history confirms they remain unapplied. Do not treat this backend as ready for commercial submission or administration.
- No full hosted API/browser acceptance result is claimed. Actual WhatsApp delivery remains unverified and no live OTP was sent.
- Render free-service creation in the user-confirmed My Workspace returned HTTP 402 requiring payment information. Subsequent service listing confirmed none was created. There is no live frontend staging URL.
- Supabase branching on the original project requires Pro; the independent project avoids that branch requirement.
- Production database, domains, Auth settings and hosting were not changed. No merge or production deployment occurred.

Next: complete the two existing catalog/media migrations in the isolated project through a functioning authorized access path; verify API/permissions; configure a real phone provider; provision the Node frontend after resolving Render billing verification; then run the complete external acceptance flow. Keep PR #51 draft.
