# Septlion Demand Intelligence Engine

## Operating model

The engine is now implemented as:

**Detect → Resolve Buyer → Qualify → Build Offer → Intent Page → RFQ**

The public website shows only a sanitized demand projection. Buyer resolution, evidence, raw source payloads, qualification notes, task queues and collector telemetry remain private in Supabase.

## Zero-cost production architecture

- **Frontend:** `septlion.com` on the existing Hostinger Premium static deployment.
- **Database / execution layer:** Supabase Free.
- **Collectors:** Supabase Edge Functions.
- **Scheduler:** Supabase `pg_cron` + `pg_net`.
- **No Render service is required for the current Demand Intelligence MVP.**

## Core tables

- `DemandSignal` — canonical normalized signal.
- `PublicDemandSignal` — safe public projection only.
- `DemandBuyerResolution` — private buyer identity / confidence / evidence.
- `DemandQualification` — private eligibility, documents, risks and next action.
- `DemandTask` — private execution queue.
- `DemandOpportunityEvent` — stage/event history.
- `DemandSource` — collector source registry.
- `DemandCollectorRun` — collector run telemetry.
- `DemandCollectorState` — lightweight throttling and last-run state.

## Public/private boundary

Anonymous website users can read **only** `PublicDemandSignal`.

The canonical `DemandSignal` table and all execution tables have RLS enabled and no anonymous read/write grants. A database trigger synchronizes the small safe public projection whenever a signal changes.

The public projection intentionally excludes buyer names and contacts, evidence bundles, raw payloads, qualification notes, internal next actions and collector configuration.

## Pipeline stages

- `DETECTED`
- `BUYER_RESOLUTION`
- `QUALIFICATION`
- `OFFER_BUILD`
- `INTENT_PAGE`
- `RFQ`
- `ARCHIVED`

Triage maps strong structured signals into `QUALIFY_NOW / QUALIFICATION`, partially resolved signals into `RESOLVE_BUYER / BUYER_RESOLUTION`, and weak signals into `WATCH / DETECTED`.

## Execution queue

Whenever a signal enters an actionable stage, the database creates or preserves an active task:

- Buyer resolution → `RESOLVE_BUYER`
- Qualification → `VERIFY_QUALIFICATION`
- Offer build → `BUILD_OFFER`
- Intent page → `PUBLISH_INTENT`

Task priority follows the signal score and the source deadline is used as the due date when available.

## Current production collector

The first production collector is **World Bank Procurement Notices**.

It runs every six hours and filters for flour-related demand terms. Each run is logged in the source registry / collector telemetry tables. Detection never equals verification; buyer identity and commercial eligibility remain separate execution stages.

## Website

`/demand-intelligence` reads from the safe `PublicDemandSignal` projection and displays active signal count, qualify-now count, buyer-resolution count, market count, nearest known deadline, live pipeline stage and score.

## Next implementation milestones

1. Add more high-value source adapters.
2. Build the authenticated internal operator workbench.
3. Add structured offer-building and supplier-fit records.
4. Add intent-page generation rules.
5. Connect qualified opportunities into the existing Septlion RFQ flow.
