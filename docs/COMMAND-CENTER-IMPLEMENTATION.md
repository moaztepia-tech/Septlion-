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
- `tests/browser/*.spec.mjs`: 360px browser scenario runs the real Next.js application, real Edge handler and actual PostgreSQL RPCs through a local adapter. Only external Auth/WhatsApp delivery is simulated. It covers server gating, publication, guest phone confirmation, Discovery and Composer RFQs, operator offer issuance, buyer acceptance, execution preparation, early receipt denial and logout. This does not prove external provider delivery or a deployed Supabase integration.
- CI runs the new tests, web/API typechecks/builds and dependency audit. The security upgrade moves Next.js to patched 15.5.28 and Nest to the supported 11.x line and locks vulnerable transitive dependencies to patched versions.

## Remaining release checks

Phone ownership is now checked against Supabase Auth `phone` and `phone_confirmed_at`, never user metadata. Guest WhatsApp OTP and signed-in phone-change confirmation run inside Discovery/Composer; no account-page detour is required. Expired, incorrect, mismatched and cancelled challenges cannot create a verified session. Server-side contact normalization binds the submitted number to the verified identity. Auth delivery must be enabled separately: the connected project's public Auth settings reported `phone_enabled:false` on 2026-10-26. Actual WhatsApp delivery has not been tested.

Apply migrations in order after the catalog migration: `20261026000151_atomic_phone_identity.sql` (advisory-lock serialized, audited buyer provisioning) and `20261026001643_catalog_product_media.sql` (optional HTTPS primary SKU image, with admin/audit/version protections). Draft image editing uses a URL; file uploads and editing published product revisions remain separate capabilities.

`render.yaml` prepares a free, manually deployed staging Node service; `Dockerfile.web` provides a full Next runtime alternative. `/api/health`, staging noindex headers and `pnpm release:preflight` support verification. Staging configuration refuses the known production Supabase project and server secrets as browser keys. Set `SEPTLION_DEPLOYMENT=staging`, isolated public Supabase credentials, and server-only `SEPTLION_ALLOWED_ORIGINS` on the staging Edge deployment. The preflight is read-only; it checks Auth configuration, public catalog, CORS and the Next health endpoint.

External release gates remain open: no isolated Supabase branch was created (connector confirmation requests failed), Railway remains unauthorized, and Render requires an explicit workspace selection before resource creation. No production data, Auth settings, domains, deployments or secrets were changed. A staging migration, Edge deployment, real WhatsApp delivery and operator acceptance run are still required. Docker image execution and cloud deployment are not claimed by local tests.

## Recorded results

All checks below ran locally on 2026-10-26. No production credentials, writes or real commercial commitments were used.

| Check | Result |
| --- | --- |
| Node regression/API/PostgreSQL tests | 96 passed, 0 failed |
| Mobile browser scenario | 1 passed locally: real Edge/PostgreSQL full customer/operator scenario at 360px |
| Web TypeScript | Passed |
| API TypeScript and Nest build | Passed |
| Next.js 15.5.28 production build | Passed; protected page and session bridge are dynamic |
| Prisma validation and formatting | Passed; schema unchanged |
| pnpm dependency audit | 0 low, moderate, high or critical advisories across 575 dependencies |
| Render Blueprint official JSON schema | Passed; resource not created |
| Whitespace/diff checks | Passed |

Browser verification also exposed and fixed a delayed autofocus race in contact entry and a CSS theme collision that rendered pale text on a light discovery surface. The original supplied logo assets remain unchanged. The discovery scale track now shares the left-to-right direction of its fixed labels.

Reproduce with the pinned pnpm version: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm db:generate`, `pnpm --filter @septlion/api typecheck`, `pnpm --filter @septlion/api build`, `pnpm typecheck`, `pnpm build`, `pnpm audit --audit-level high`. For the UI contract scenario: `pnpm exec playwright install chromium`, then `pnpm test:browser`. Local sandbox browser checks used an unpacked Chromium executable; CI installs the standard Playwright browser. CI results on GitHub are separate from these recorded local results.

Hosted database verification and remaining external gates: [STAGING-EXECUTION-2026-10-26.md](STAGING-EXECUTION-2026-10-26.md). The later history-preserving migration retains RFQ item/media row identities and removes unnecessary DELETE privileges.
