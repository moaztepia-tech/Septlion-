# Demand operations — 25 November 2026

The production radar database and the application trade graph now share an evidence-led operating loop. `public.DemandSignal` remains the raw signal record; `core.Opportunity` receives only fresh, non-test signals in Africa and the Middle East. A signal is not an order.

## Live components

- Existing six-hour public-platform and procurement collectors remain scheduled.
- World Bank collector v5 searches eight commodity terms, sorts by notice date, deduplicates notice IDs, and accepts current, identifiable commodity tenders only. It rejects awards, equipment, expired/undated notices, and non-wheat flours misclassified as wheat flour. An empty match set is a valid result, not a buyer.
- `run_demand_operations(200)` runs at minute 35 hourly. It uses an advisory transaction lock, bounded batches, per-signal error isolation, source incident deduplication, and private run telemetry.
- Runtime grants allow the existing authenticated Edge backend to run the invoker-based bridge without database-owner privileges. Anonymous and ordinary authenticated database roles remain denied.
- `DemandAssessment` records scope, seven-day freshness, test exclusion, buyer readiness, supplier candidates, blockers and the next action. It prioritizes operator tasks without deleting historical signals or automatically messaging anyone.
- A buyer can advance automatically only with a verified status, legal entity, website, and direct business contact. Qualification additionally requires complete published quantity/packing/incoterm and an operator-recorded eligible supply route without unresolved risk flags.
- Private supplier matching preserves selected/rejected statuses. Unknown incoterms, packing, markets, or commercial capability are gaps, never positive matches.
- `DemandCostInput` accepts sourced, currency-specific, expiring costs per metric tonne. A draft uses landed cost divided by `(1 - marginPct/100)`. The formula is gross margin, not markup. Values must represent the agreed incoterm and route; absent costs remain missing, never zero estimates.
- READY offers require a qualified requirement, current sourced costs, a selected active SEPTLION-verified supplier, and human approval. The workbench requires ADMIN to approve and stops on database errors.
- Market-level signal counts no longer masquerade as a single buyer's reorder cycle. `DemandBuyerPattern` requires distinct dated observations for the same verified buyer and at least four stable observations for an uncalibrated timing window. It is not a purchase probability.
- `bridge_demand_to_core` upserts a signal, clarification-stage requirement, opportunity, assessment AgentRun and research supply candidates. It never creates a customer RFQ, contract, payment, or order. Radar-prefixed record IDs identify bridge-owned records; existing application records are preserved.
- The authenticated workbench API returns assessments, engine runs and buyer patterns, and supports `run_operations`. Existing frontend assets still use their prior layout.
- A separate scheduled ChatGPT research worker is enabled every six hours at 03:15, 09:15, 15:15 and 21:15 Africa/Cairo. It researches up to three eligible signals, saves direct-contact evidence conservatively, adds limited new signals/supply candidates, and reruns assessment. Creation confirms scheduling; its first future run must still be observed. No research, delivery or notification success is assumed from scheduling alone.

## Production verification

- First manual operations run: 104 signals processed, zero signal errors.
- Live backend-role verification: `SET LOCAL ROLE service_role; SELECT run_demand_operations(200)` also processed 104 signals with zero errors. Anonymous workbench HTTP access returns 401; an invalid public RFQ returns 400 without creating a record.
- First live v5 World Bank call: HTTP 200; 616 unique notices examined, zero current eligible matches. No leads were manufactured to fill the result.
- Two supplier research profiles were seeded from official public websites; neither is an approved commercial partner and neither has a current quote.
- One fresh target-market signal was bridged to the application graph with two supplier candidates. Its buyer remains unverified.
- One existing RFQ and offer are test records and are excluded from opportunity promotion.
- Five registered sources remain inactive for access/authentication/query blockers. Do not set `active=true` without a working collector or bypass access controls. The research worker can investigate publicly available alternatives.

Counts are a deployment-time snapshot, not a lasting guarantee. Query current telemetry before reporting status.

## Research worker contract

1. Read private assessments and recent collector/engine telemetry. Revalidate dates from original sources.
2. Research fresh target-market signals first; deduplicate research by `DemandTask.payload.lastResearchAt` and new evidence.
3. Store company identity and published direct contacts in `DemandBuyerResolution`, with sources, timestamp and reasoning. An exact personal name + country + activity is only `PROBABLE_MATCH`, not a proven RFQ/company connection. A website's licence claim is not independent registry verification.
4. Call `refresh_buyer_profile_for_signal(uuid)` after identity enrichment. Platform refreshes preserve `PROBABLE_MATCH` and `SOURCE_IDENTIFIED` instead of erasing research.
5. Save correctly classified, dated new signals only after cross-source/source-URL deduplication. Never reuse the wheat-flour-only platform ingest function for another commodity.
6. Do not invent price, production availability, certification, capacity, specifications, payment acceptance or eligibility. Do not send messages, publish offers, approve deals, or buy access.
7. Call the operations/pattern functions and read the results. Report actual new opportunities or actionable faults, distinguishing a scheduled worker from observed execution.

## What still depends on external evidence

- Current supplier quotations and freight/insurance/other route costs.
- Commercial verification of research supplier candidates.
- Independent buyer identity/RFQ linkage and confirmation that demand remains open.
- OAuth or account access for restricted data providers, where direct ingestion is required.
- Enough actual buyer-specific history to validate forecasts, plus backtesting before interpreting confidence as probability.
- Broader source adapters for every product and market; the scheduled research worker supplements, rather than impersonates, unavailable API adapters.
- Full core trade execution and external agent runtime integration remain separate from the completed radar-to-opportunity bridge. No external agent runtime was claimed active.

## Validation and rollback

Tests rebuild the entire database migration history and exercise identity gating, supplier uncertainty, cost arithmetic, expiry, approval, idempotency, test isolation, core bridging, source incident deduplication, anonymous access denial, and buyer-specific recurrence. Collector tests cover provenance, dates, awards, machinery and wrong-flour classification.

`ops/demand-operations-rollback.sql` disables the new hourly scheduler, removes its offer guard and restores prior function implementations. New private audit/data tables and bridge-created records are retained for investigation; rollback does not delete commercial records. Edge Functions can be redeployed from the pre-change Git revision. `ops/demand-supplier-seed.sql` is idempotent and contains public research only.
