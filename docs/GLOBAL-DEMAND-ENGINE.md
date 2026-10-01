# Septlion Global Demand Engine

The repository now treats demand intelligence as a first-class commercial workflow rather than a list of leads.

## Operating loop

1. **Collect** — persist source-backed demand signals with provenance.
2. **Promote** — sufficiently complete signals become an Opportunity.
3. **Resolve buyer** — attach a BuyerProfile and verification evidence.
4. **Qualify** — build a QualifiedRequirement with known, inferred and critically missing fields.
5. **Orchestrate agents** — AgentRun is runtime-neutral. OpenDots can be used without coupling Septlion data to it.
6. **Match supply** — attach SupplyCandidate records with capability, compliance, commercial and logistics evidence.
7. **Build deal** — DealDraft versions calculate landed cost, margin and offer price.
8. **Human approval** — external commercial commitments stop at HumanApproval.
9. **Execute** — approved work can continue through the existing RFQ → Quote → Order Intent transaction workspace.
10. **Learn** — source evidence, agent outputs and commercial outcomes remain linked to the Opportunity.

## Core graph

DemandSignal → QualifiedRequirement → Opportunity
                 ↑                 ↓
             BuyerProfile      AgentRun
                                  ↓
                           SupplyCandidate
                                  ↓
                              DealDraft
                                  ↓
                           HumanApproval
                                  ↓
                        RFQ → Quote → OrderIntent

## API

- GET /api/demand-intelligence/command-center
- GET /api/demand-intelligence/signals
- POST /api/demand-intelligence/signals
- GET /api/demand-intelligence/opportunities
- GET /api/demand-intelligence/opportunities/:id
- POST /api/demand-intelligence/opportunities/:id/agents
- POST /api/demand-intelligence/opportunities/:id/supply-candidates
- POST /api/demand-intelligence/opportunities/:id/deal-drafts
- POST /api/demand-intelligence/opportunities/:id/approval
- GET /api/demand-intelligence/approvals
- POST /api/demand-intelligence/approvals/:id/approve
- POST /api/demand-intelligence/approvals/:id/reject

## Safety / authority boundary

Agents may research, normalize, compare, enrich, calculate and draft. Sending a binding quote, accepting commercial terms, creating an external commitment, or similar sensitive actions must pass a HumanApproval gate.

## Runtime principle

Septlion owns the graph and commercial state. Agent runtimes are replaceable workers. Do not put the system of record inside OpenDots or any other agent vendor.
