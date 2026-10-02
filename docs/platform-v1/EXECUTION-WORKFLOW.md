# Septlion Platform V1 — Product Engineering Workflow

## Product contract
Two acquisition paths converge into one trade engine.

1. Home -> AI Composer -> Qualified Requirement
2. Discover -> Product Feed -> Product configuration -> Buyer capture -> automatic Composer handoff

Unified lifecycle:
REQUIRE -> OFFER -> COMMIT -> EXECUTE -> RECEIVE -> REORDER

## Non-negotiable UX rules
- Arabic-first, mobile-first, RTL.
- Product Feed is not a marketplace/catalog. A product is an entry into the managed supply engine.
- No traditional product-detail detour in the primary Feed flow.
- Minimum containerized order: 1 container.
- Septlion Scale: Micro 1–7; Nano 8–19; Zepto 20–49; Yocto 50–99; Ronto 100–299; Quecto 300–999; Septlion 1000+.
- Trade terms are inline single-tap choices: CIF / CFR / FOB.
- Destination is selected after trade term via Bottom Sheet; its semantics adapt to the Incoterm.
- Payment is inline single-tap: L/C / T/T / Other. L/C is first only; no visual preference.
- Feed buyer capture: Name (required), Company (required), WhatsApp (required), Email (optional).
- WhatsApp is normalized/validated silently; never claim WhatsApp verification without evidence; no OTP gate in Feed.
- After required buyer data is valid, save buyer + draft RFQ and automatically transition to Composer. No Continue button.
- Feed-origin Composer never asks "What do you need?" again; it receives full product/RFQ context.
- Home-origin Composer starts from natural-language need discovery.
- Do not request information Septlion can derive safely.
- One requirement, one counterparty, one offer, one transaction, one accountable operator: Septlion.
- Supplier identities/matching complexity stay internal.
- Never invent prices, freight, product claims, destinations, lead times, or trust metrics.

## Feed context contract
Product configuration handed to Composer:
- source / campaign attribution
- productId + product configuration
- specification + packing
- containerCount
- septlionScale
- incoterm
- destination (country/port/identifier/type)
- paymentPreference
- buyer identity reference

## Buyer identity states
Phone validity and WhatsApp reachability are separate:
- phone structural validation
- whatsapp UNCONFIRMED / CONFIRMED / UNREACHABLE
Unconfirmed WhatsApp never blocks the RFQ.

## RFQ lifecycle
DRAFT -> IDENTIFIED -> QUALIFIED -> SUBMITTED -> SOURCING -> OFFER_READY -> OFFER_SENT
Then ACCEPTED / REVISION_REQUESTED / EXPIRED as applicable.

## Releases
### R1 Experience Foundation
Design system, mobile app shell, Home, Discover, product-feed primitives.

### R2 Feed -> RFQ
Product card, container counter, scale engine, inline Incoterm, destination bottom sheet, inline payment, buyer capture, silent phone validation, persistent draft, automatic Composer handoff.

### R3 Intelligence
Unified contextual Composer, BuyerRequirement persistence, field provenance/state, next-best-question logic, attachments, Qualified Requirement.

### R4 Commerce
Supply orchestration, costing, single Septlion OFFER, revisions, acceptance, COMMIT/commercial lock.

### R5 Execution
Transaction workspace, milestones, documents, QC, RECEIVE/claims, in-app + Web Push notification events.

### R6 Compounding Layer
Trade Memory, REORDER, For You personalization, campaign attribution, demand intelligence.

## Engineering workflow per release
1. Contract: acceptance criteria + data/API contract before UI.
2. Implement behind a feature branch/flag where practical.
3. Unit tests for pure business rules (scale, lifecycle, validation).
4. Integration tests for persistence/API boundaries.
5. Mobile-first UI and accessibility review.
6. Build/typecheck/lint/tests must pass.
7. Security/privacy review for PII and commercial data.
8. Draft PR -> review -> production merge only after acceptance.
9. Post-deploy smoke test of Home, Discover, Feed-to-Composer, and existing critical routes.

## Definition of Done for R2
A real mobile user can:
Discover -> understand product -> choose container count -> see scale -> choose CIF/CFR/FOB -> choose destination -> choose L/C/T/T/Other -> enter Name+Company+WhatsApp (email optional) -> be persisted -> automatically enter the same Composer with the exact RFQ context and without re-answering known fields.
