# Septlion Demand Intelligence Engine

## Operating model

**Detect → Resolve Buyer → Qualify → Build Offer → Intent Page → RFQ**

The public site exposes only a sanitized signal projection. Buyer identity, evidence, raw payloads, qualification notes, task queues, offer drafts, intent-page drafts and collector telemetry stay private.

## Zero-cost production architecture

- **Frontend:** `septlion.com` on the existing Hostinger Premium static deployment.
- **Database / execution layer:** Supabase Free.
- **Collectors:** Supabase Edge Functions and `pg_net + PL/pgSQL` adapters.
- **Scheduler:** Supabase `pg_cron`.
- **Current Demand Intelligence MVP does not require Render.**

## Core tables

- `DemandSignal` — canonical normalized signal.
- `PublicDemandSignal` — safe public projection.
- `DemandBuyerResolution` — private buyer identity / confidence / evidence.
- `DemandQualification` — private eligibility, documents, risks and next action.
- `DemandOfferBuild` — structured offer draft generated after qualification.
- `DemandIntentPage` — structured intent-page draft generated after qualification.
- `DemandTask` — private execution queue.
- `DemandOpportunityEvent` — stage/event history.
- `DemandPattern` — recurrence/prediction layer.
- `DemandSource` — source registry.
- `DemandCollectorRun` — collector telemetry.
- `DemandCollectorState` — throttling / last-run state.
- `DemandOperatorKey` — hashed internal workbench access keys.
- `DemandAlert` — private actionable alert queue.
- `DemandPushSubscription` — private browser push subscriptions.
- `DemandSupplierProfile` — private supplier capability profiles.
- `DemandSupplierFit` — per-opportunity supplier-fit scoring.

## Public/private boundary

Anonymous users can read only `PublicDemandSignal`.

The canonical signal table and all execution tables use RLS and have no anonymous read/write grants. A database trigger maintains the safe public projection.

Public output excludes buyer contacts, evidence bundles, raw payloads, qualification notes, internal actions, offer details and collector configuration.

## Pipeline stages

- `DETECTED`
- `BUYER_RESOLUTION`
- `QUALIFICATION`
- `OFFER_BUILD`
- `INTENT_PAGE`
- `RFQ`
- `ARCHIVED`

## Execution queue

Actionable stages create execution tasks automatically:

- Buyer resolution → `RESOLVE_BUYER`
- Qualification → `VERIFY_QUALIFICATION`
- Offer build → `BUILD_OFFER`
- Intent page → `PUBLISH_INTENT`

Task priority follows signal score; known source deadlines become due dates.

## Automatic post-qualification generation

When an operator changes `DemandQualification.decision` to `QUALIFIED`:

1. a `DemandOfferBuild` draft is created or refreshed;
2. a `DemandIntentPage` draft is created or refreshed;
3. the signal advances to `OFFER_BUILD`;
4. the qualification task is closed;
5. the database creates the next `BUILD_OFFER` task;
6. the transition is written to `DemandOpportunityEvent`.

A rollback test verifies this path: QUALIFIED → OFFER_BUILD + DRAFT offer + DRAFT intent page + open BUILD_OFFER task.

## Production source engine

### World Bank Procurement Notices
- Official procurement source.
- Supabase Edge Function collector.
- Every 6 hours.
- Flour-focused normalization and scoring.

### UK Contracts Finder
- Official UK public procurement OCDS feed.
- No authentication required.
- Uses `pg_net + PL/pgSQL` because the direct Deno/serverless request path is blocked with HTTP 403 while PostgreSQL `pg_net` access succeeds.
- Fetches five 100-release pages from the latest 14-day tender window every 6 hours.
- Filters for wheat-flour CPV/text signals before persistence.
- Latest verified run: 500 releases scanned, zero current wheat-flour matches, successful completion.

### Registered but inactive
- `TED — European Union Procurement`: official open API; adapter remains inactive until the CPV expert-query mapping is validated against live results.
- `UN Global Marketplace`: official source; notice API needs OAuth access.
- `Asian Development Bank`: official page is currently blocked from the serverless collection path by Cloudflare.

## Internal Operator Workbench

`/demand-intelligence/workbench`

The workbench is protected by a custom operator key. Only its SHA-256 hash is stored in the database.

It displays:
- execution queue,
- buyer-resolution confidence,
- qualification status,
- offer / intent status,
- source health,
- collector runs,
- demand-pattern confidence.

Operator actions can start, block, close or advance tasks. Qualification advancement now writes `QUALIFIED`, allowing the database automation to generate the offer and intent-page drafts.

## Instant RFQ alerts

A newly submitted public RFQ now triggers the execution layer immediately:

1. create / refresh a `DemandOfferBuild` draft;
2. run `refresh_supplier_fit(signalId)`;
3. create a `NEW_RFQ` alert;
4. create / preserve the `FOLLOW_UP` task;
5. queue the Web Push dispatcher.

The Workbench polls silently while open and can also register a browser Push subscription. The service worker displays a generic RFQ notification without exposing buyer details in the push payload. Detailed buyer / RFQ data stays behind the operator-key Workbench.

Web Push is opt-in per browser/device and requires the operator to click **Enable RFQ notifications** once.

## Supplier Fit

Supplier profiles are private and product-key driven. The first matching rules score:

- product capability,
- incoterm fit,
- packing fit,
- supplier verification,
- served-market fit.

The offer draft records `CANDIDATES_FOUND` or `NO_CANDIDATES` and the candidate count. No supplier is fabricated when the supplier network is empty.

## Prediction layer

Prediction is based on recurrence timing, not fabricated certainty.

- One observed signal → `INSUFFICIENT`.
- Repeated signals can become `EMERGING` or `RECURRING`.
- A predicted demand window is created only when there is enough historical timing data.

## Next milestones

1. Add verified real supplier profiles to the private supplier network.
2. Add structured commercial pricing / logistics inputs to generated offer drafts.
3. Add an optional external alert channel (email / WhatsApp) without exposing buyer data.
4. Activate additional reliable official collectors.
5. Add source-level health alerts and retry policy.
