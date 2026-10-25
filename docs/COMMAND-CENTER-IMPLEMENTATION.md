# Command center implementation — PR #51

Branch: `feat/unified-command-center-20261026`. No merge, production deployment, Edge deployment, or live database migration is performed by this work.

## Implemented flow

- `/command-center` is rendered dynamically after server verification through the existing `trade-api` `me` action. The gate uses an HttpOnly, SameSite=Strict, short-lived, path-scoped cookie. A same-origin bridge validates the existing browser access token. Tokens and roles are never decoded or accepted as authorization claims from the browser.
- Existing active `septlion-operator` membership controls access: ADMIN manages the catalog; SALES reads it and uses the existing operations workspace; BUYER has no internal access. Each mutation rechecks active user, organization and ADMIN membership inside PostgreSQL.
- `catalog.save` creates PRIVATE/DRAFT products and their packing SKUs; `catalog.publish` requires a separate explicit confirmation and identity/specification attestation. `catalog.archive` hides a product without removing historical RFQ, quote or execution references. Published products cannot be silently edited. Sector create/update is ADMIN-only. Sector deletion is intentionally unavailable because sectors are shared historical classification records.
- Duplicate SKU codes are rejected per organization. Updates use `expectedUpdatedAt`; stale edits fail with a conflict. Idempotency keys bind actor, action and exact input. Mutation and audit log commit or roll back together. Existing packing rows are preserved when updating drafts, rather than deleting historical references.
- `catalog.public` exposes only published ACTIVE/PUBLIC products owned by SEPTLION, using an explicit field allowlist. Discovery no longer substitutes static preview products when the backend fails. Categories derive from published sectors. Stock and firm prices are not invented.
- Discovery supports multiple packing variants, each with its own container count. It submits the saved product/SKU IDs through `requirements.create`. PostgreSQL revalidates publication and SKU ownership and stores the selected variants in the requirement and RFQ items, rather than attaching the first SKU by product name. Success closes the sheet, shows a short confirmation and keeps the customer on Discovery.
- Composer supplies its retained draft ID as the requirement idempotency key. Requirements and RFQs are audited and created once. Existing `/operations`, offer, commercial lock, execution, documents, receipt, claims and reorder pages remain the single commercial lifecycle. Command center links operators into that workspace.
- Natural-language entry only suggests a workspace. It never executes an inferred mutation. Operators review explicit fields and confirm consequential actions.

## Database and runtime

Apply `supabase/migrations/20261025215236_command_center_catalog.sql` to an isolated staging copy of the existing `core` database first. It adds server-only invoker RPCs and explicit service-role grants, with no new browser-role grants. The existing `require_trade_actor` and `create_buyer_requirement` runtime functions are prerequisites. PostgreSQL tests bootstrap their read-only definitions in `tests/fixtures`; these snapshots contain function definitions, not user records or credentials.

`supabase/config.toml` allows the public catalog to reach `trade-api`; all private actions still authenticate with `getUser`, active stored membership and per-action authorization. Keep the service key on the Edge server only. Frontend environment variables remain the existing public Supabase URL and publishable key.

**Hosting gate:** the existing Hostinger workflow copies generated HTML to static hosting. It cannot run the new server authorization route. That workflow now stops before publishing when the server route is present. Deploy the full Next.js application to a Node.js-capable staging host and verify it before choosing a production hosting change. The public customer pages remain prerenderable, but the command center is deliberately dynamic.

## Verification design

- `tests/command-center-api.test.mjs`: executes the real Edge handler with an isolated database adapter, checking authentication, role enforcement, explicit publication, actor spoofing and public catalog filtering.
- `tests/command-center-db.test.mjs`: actual PostgreSQL via pinned PGlite, bootstrapped from the repository Prisma schema, existing runtime definitions and real migrations. It checks rollback, audit, replay/conflict, stale versions, duplicate SKU, multiple variants, RFQ→offer→acceptance links, archive integrity and service-role grants. It also executes the existing lifecycle SQL test, including execution, documents, receipt, claims and reorder.
- `tests/browser/*.spec.mjs`: 360px browser tests against a local HTTP contract fixture. They verify the real Next.js server gate, cookie settings, draft/publication interaction and Discovery submission/closure. The HTTP fixture is not evidence of a deployed Supabase integration; database and Edge contracts are covered separately above.
- CI runs the new tests, web/API typechecks/builds and dependency audit. The security upgrade moves Next.js to patched 15.5.28 and Nest to the supported 11.x line and locks vulnerable transitive dependencies to patched versions.

## Remaining release checks

No claim of production readiness: apply/verify migrations in staging, deploy the Edge function there, complete the flow against that deployed backend, confirm backups and choose a Node.js-capable host for the protected command center. WhatsApp ownership verification is not implemented by this change: entered numbers remain explicitly UNCONFIRMED. Anonymous visitors can browse and draft; sending a persisted commercial request still uses the existing authenticated account flow. Product media upload and a product revision workflow for already-published products are separate capabilities; current archival preserves historical records.

## Recorded results

All checks below ran locally on 2026-10-26. No production credentials, writes or real commercial commitments were used.

| Check | Result |
| --- | --- |
| Node regression/API/PostgreSQL tests | 85 passed, 0 failed |
| Mobile browser scenario | 1 passed: server gate, draft/publish, buyer RFQ, sheet closure, 360px width and scale-marker direction |
| Web TypeScript | Passed |
| API TypeScript and Nest build | Passed |
| Next.js 15.5.28 production build | Passed; protected page and session bridge are dynamic |
| Prisma validation and formatting | Passed; schema unchanged |
| pnpm dependency audit | 0 low, moderate, high or critical advisories across 575 dependencies |
| Whitespace/diff checks | Passed |

Browser verification also exposed and fixed a delayed autofocus race in contact entry and a CSS theme collision that rendered pale text on a light discovery surface. The original supplied logo assets remain unchanged. The discovery scale track now shares the left-to-right direction of its fixed labels.

Reproduce with the pinned pnpm version: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm db:generate`, `pnpm --filter @septlion/api typecheck`, `pnpm --filter @septlion/api build`, `pnpm typecheck`, `pnpm build`, `pnpm audit --audit-level high`. For the UI contract scenario: `pnpm exec playwright install chromium`, then `pnpm test:browser`. Local sandbox browser checks used an unpacked Chromium executable; CI installs the standard Playwright browser. CI results on GitHub are separate from these recorded local results.
