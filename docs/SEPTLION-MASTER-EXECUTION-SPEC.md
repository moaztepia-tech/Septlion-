# SEPTLION — Master Product & Technical Execution Specification
**Status:** Canonical execution specification  
**Version:** 2.0 — 2026-10-02

## Product thesis
Septlion is an AI-native B2B managed-trade platform. It converts incomplete buyer intent into an executable international trade transaction while hiding supplier, quality, compliance, documentation and logistics fragmentation behind one accountable commercial operator: Septlion.

**Buyer journey:** REQUIRE → OFFER → COMMIT → EXECUTE → RECEIVE → REORDER  
**Internal orchestration:** DETECT → QUALIFY → DEFINE → MATCH → VERIFY → COST → STRUCTURE → CONTRACT → PRODUCE → INSPECT → DOCUMENT → SHIP → DELIVER → LEARN  
**Operating principle:** One Requirement. One Counterparty. One Offer. One Transaction. One Accountable Operator.

## Non-negotiable rules
1. The buyer speaks in business language; Septlion resolves trade complexity.
2. Never ask for information that can be safely derived.
3. Ask one decision-critical question at a time.
4. Never fabricate price, freight, availability, lead time, origin, verification, milestones or documents.
5. A buyer receives one Septlion offer, not a marketplace comparison wall.
6. Septlion remains the accountable counterparty.
7. Every commercial mutation is auditable.
8. Accepted commercial terms are immutable; changes create explicit Change Orders.
9. Every completed transaction compounds into Trade Memory.
10. Reorder is a first-class flow, not a copied RFQ.
11. Human approval gates remain for money, legal commitment, compliance exceptions and high-risk actions.
12. Externally exposed commerce objects are machine-readable and human-readable.

## Platform surfaces
**Buyer:** Home, Discover, Composer, Trade, Account.  
**Operator:** qualification queue, supply matching/verification, costing/offer builder, approvals, execution, exceptions/claims, demand intelligence.  
**Supply network:** permissioned factories, inspectors, forwarders, warehouses and packaging partners; never a fragmented buyer interface.

## Canonical domain
Identity: Buyer, Company, ContactChannel, Membership, Consent.  
Demand: BuyerRequirement, RequirementField, Attachment, ProductIntent, ProductConfiguration.  
Commercial: RFQ, Offer, OfferRevision, CommercialLock, ChangeOrder.  
Transaction: Transaction, TransactionEvent, Milestone, Task, Exception.  
Supply: Supplier, SupplierCapability, Verification, SupplyCandidate, CostSheet.  
Quality/compliance: QCPlan, Inspection, ComplianceRequirement, ComplianceEvidence.  
Logistics: LogisticsPlan, Route, Shipment, ShipmentEvent.  
Documents: Document, DocumentVersion, DocumentRequirement.  
Completion: Receipt, Claim, ClaimEvidence, Resolution.  
Compounding: TradeMemory, ApprovedConfiguration, Reorder.  
Intelligence: DemandSignal, Opportunity, Attribution, AgentRun, Recommendation.

## State machines
Requirement: DRAFT → NEEDS_CLARIFICATION → QUALIFIED → PRICING → OFFER_READY → CONVERTED. Terminal: ARCHIVED/CANCELLED.  
Offer: DRAFT → INTERNAL_REVIEW → ISSUED → REVISION_REQUESTED → REVISED → ACCEPTED. Terminal: EXPIRED/REJECTED/WITHDRAWN.  
Transaction: PENDING_COMMIT → COMMITTED → IN_EXECUTION → READY_TO_SHIP → SHIPPED → IN_TRANSIT → DELIVERED → RECEIPT_REVIEW → COMPLETED. Exception: ON_HOLD/CLAIM_OPEN/CANCELLED.

Transitions are policy checked, transactional and event-producing.

## REQUIRE
Inputs: natural text, product selection, image, PDF/specification/COA, later voice.
Every field has provenance and state: CONFIRMED, DERIVED, SUGGESTED, UNKNOWN, CRITICAL_MISSING.
Requirement Intelligence extracts facts, normalizes units/ports/packing/taxonomy, records provenance/confidence, computes critical missing information, asks one Next Best Question, proposes safe domain defaults, and qualifies only when pricing/manufacturability/compliance minimums are met.
Flour is the first deep vertical and adds application/specification intelligence without forcing technical vocabulary.

## OFFER
Supply Engine: Product Configuration → Candidate Supply Routes → Verification → Cost → Logistics → Compliance → Risk → Operator Approval.
Buyer sees one Septlion Offer: product/spec, packing, quantity, origin, Incoterm, price/currency, lead time, payment, validity, documents/conditions.
Every revision is versioned; acceptance pins the exact revision.

## COMMIT
Acceptance creates immutable CommercialLock: specification + quantity + packing + price + currency + origin + Incoterm + payment + timeline + documents + accepted revision.
PI/Contract references the lock. Post-lock changes require ChangeOrder with impact and approval.

## EXECUTE
Transaction is created from CommercialLock.
Milestones: Confirmed → Supply/Production → Quality → Documentation → Ready → Shipped → In Transit → Delivered.
Events are append-only facts; UI status is a projection of evidence-backed events.
Milestones carry owner, target/actual dates, evidence, dependencies, buyer visibility and exception state.

## RECEIVE
Delivery is not completion.
Delivered → buyer quantity/condition/document confirmation → acceptance OR claim.
Claims store category, evidence, requested resolution, owner, timestamps and resolution history. Closure feeds supplier performance.

## REORDER & Trade Memory
Completed transactions produce ApprovedConfiguration: product config, specs, artwork, packing, QC, supply route, origin, Incoterm, logistics route, document set, commercial and lead-time history.
Reorder asks only quantity + destination + required date + changed fields. Price, availability, compliance and freight are revalidated.

## Agentic architecture
AI is orchestration, never commercial truth.
Agents may interpret intent, extract documents, recommend questions, rank supply, detect risk, prepare drafts, summarize execution and recommend reorder.
Agents may not invent facts, accept legal commitments, release payments, bypass compliance, complete physical milestones without evidence, or cross tenant boundaries.
Consequential actions are traceable recommendations/events with evidence and confidence.

## Machine-readable commerce
Products, configurations, availability, offers and policies use stable IDs and explicit schemas. Human copy is presentation over structured truth. External agent-commerce protocols integrate through adapters, never define the core domain.

## Data architecture
PostgreSQL is system of record. Tenant isolation/RLS; UUID identities; transactional transitions; append-only TransactionEvent/AuditLog; typed commercial fields; JSON only for flexible evidence/provenance; idempotency on retryable commands; outbox for integrations; optimistic concurrency; immutable accepted snapshots.
Browser storage is cache/resume only, never authoritative commercial storage.

## Security
Least privilege RBAC; buyer/operator/supply scopes; RLS defense in depth; no service secrets in browser; controlled document access; PII minimization; rate limiting; authentication/commercial audit; secure session rotation; human approval for high-impact actions.

## Experience
Arabic-first RTL + English. Mobile-first. Shared nav: Home → Discover → Trade → Account. Composer distraction-light.
No dead controls or fake live functionality. Loading/empty/error/success are designed states. Core buyer flows target WCAG 2.2 AA.

## Notifications
In-app baseline. Web Push only after meaningful request. WhatsApp is commercial notification, not authentication.
Offer ready, action required, confirmed, production, QC, shipment, document, delivery/claim updates deep-link to exact transaction.

## Demand Intelligence
DemandSignal → verification → buyer resolution → opportunity → requirement/supply action.
Source, timestamp, evidence and verification remain explicit. Signals may become sales opportunities, feed candidates, market intelligence, supply planning or evidence-backed landing content.

## Discover
Product discovery, not supplier marketplace.
Product → container count → scale → Incoterm → destination → payment → buyer identity → contextual Composer.
No static price without current truth. No popularity claim without evidence. Attribution follows every interaction.

## Observability
Funnel: visit → intent → requirement started → qualified → offer issued → accepted → committed → shipped → delivered → completed → reordered.
Business metrics: time-to-qualified, time-to-offer, clarifications, revisions, conversion, exceptions, on-time rate, claims, reorder, supplier performance.
Technical: structured logs, request IDs, error tracking, health checks, workflow/deployment telemetry.

## Current code disposition
**Reuse/harden:** NestJS/Prisma/PostgreSQL; JWT/RBAC/tenant/RLS; RFQ/Quote Revision/Order Intent primitives; Audit/Outbox; Documents/Messaging/Notifications; Demand Intelligence/Supplier Matching; Next buyer shell; Supabase controlled anonymous intake.
**Unify/refactor:** QualifiedRequirement vs legacy RFQ; browser vs server identity; Offer vs supplier Quote; OrderIntent into CommercialLock/Transaction; document scopes; notification links; duplicate legacy routes.
**Build:** Transaction/Event; CommercialLock/ChangeOrder; Requirement Intelligence; buyer Offer projection; milestones; receipt/claim; Trade Memory/Reorder; authenticated buyer queries; attachments; PWA/push; operator workspace; machine-readable adapters.

## Delivery gates
A Canonical Core: schema/state machines, Requirement identity, Offer semantics, CommercialLock, Transaction/Event.
B Real Buyer Journey: Composer persistence, qualification, exact continuity, real Offer, acceptance/commit.
C Execution: milestones, documents, QC, shipment, notifications.
D Completion: receipt, claims, closure.
E Compounding: Trade Memory, Reorder, personalization, attribution.
F Agentic/External: orchestration, structured commerce adapters, advanced supply/pricing intelligence.

## Definition of Done
A real buyer can express an incomplete need; reach a persisted qualified requirement; receive a real Septlion offer; accept the exact version; create immutable commitment; track evidence-backed execution; access real documents; confirm receipt or claim; close; reorder from Trade Memory; resume across devices after authentication; and do so without exposure to internal supply-chain fragmentation.

Every gate requires automated tests, security checks, production readiness, controlled deployment and live smoke verification.
