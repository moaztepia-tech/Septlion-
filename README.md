# SEPTLION

B2B Operating Infrastructure: Discovery → RFQ → Quote → Order Intent.

## Stack
- API: NestJS + Prisma + PostgreSQL 16 + PostgreSQL RLS
- Web: Next.js 14 App Router + TypeScript + Tailwind
- Auth: JWT access/refresh rotation, organization membership and RBAC
- Audit: transactional audit log

## Run
1. Copy `.env.example` to `.env` and change secrets.
2. `docker compose up -d`
3. `pnpm install`
4. `pnpm db:generate`
5. `pnpm db:migrate`
6. `pnpm db:seed`
7. `pnpm dev`

API: http://localhost:4000/api
Web: http://localhost:3000

## Security model
Tenant-owned entities contain `organizationId`. Every tenant transaction establishes
`SET LOCAL app.current_organization_id`, and PostgreSQL RLS uses both USING and WITH CHECK.
Public catalog reads only expose products/SKUs marked PUBLIC and ACTIVE through a dedicated query.

## Production hardening still expected
Use a managed secret store, TLS, object storage/CDN for media, rate limiting/WAF,
email verification, OAuth provider credentials, observability, backups, migrations review,
and a separate restricted DB role for migrations. Do not run the app with a superuser.


## Commercial Engine implemented
- Supplier matching
- Quote revisions / negotiation history
- Quote acceptance
- Order Intent idempotency
- Public catalog discovery via controlled PostgreSQL function

## V1 End-to-End Transaction Workspace
The RFQ and Quote detail screens now include a contextual Transaction Workspace for messages and shared document metadata. See `docs/E2E-V1.md` for the golden path, security invariants, failure scenarios, and remaining production gates.
