# SEPTLION Brain — phase 1 (memory and orchestrator)

The Brain sits on top of the hourly operations engine (`run_demand_operations`, :35).
Phase 1 adds memory and coordination only. It calls no LLM, sends no message,
publishes nothing and approves no price.

| Part | Where | What it does |
|---|---|---|
| Trade Truth | `BrainFact` | Facts about a buyer, deal, signal, supplier, market or product. `CONFIRMED` needs a public source or the founder. A newer fact supersedes the old one, which is kept. Agents cannot overwrite a confirmed fact. |
| Demand Graph | `BrainEdge` | `SIGNAL SPECIFIES PRODUCT`, `SIGNAL IN_MARKET MARKET`, `BUYER NEEDS PRODUCT`, and later supply, price, shipping and outcome edges. |
| Event log | `BrainEvent` | Append-only record of every fact, task, question, decision and run. |
| Agent queue | `BrainTask`, `BrainPolicy` | One open task per agent and opportunity. All 10 agents are disabled by default. |
| Founder decisions | `BrainDecision` | `PROVIDE_COST`, `APPROVE_OFFER`, `CONFIRM_FACT`, `CHOOSE_PATH`. A recorded approval never bypasses `guard_demand_offer_ready()`. |
| Buyer Twin | `BrainBuyerTwin` view | A buyer's profile, current facts, buying patterns and open work in one row. |
| Orchestrator | `run_brain(200)`, cron `septlion-brain-hourly` at :40 | Maps each in-scope assessment to an agent task or a founder question, and retires work that no longer applies. Foreign-market and test signals get no work. |

How assessments map to work:

| `nextAction` | Brain does |
|---|---|
| `RESEARCH_COMPANY_AND_DIRECT_CONTACT` | queues `BUYER_RESOLVER` |
| `REVALIDATE_DEMAND` | queues `REVALIDATOR` |
| `COMPLETE_REQUIREMENT`, `REVIEW_ELIGIBILITY` | queues `QUALIFIER` |
| `RESEARCH_SUPPLY` | queues `SUPPLY_INTELLIGENCE` |
| `CONFIRM_SUPPLIER_AND_COST` | asks the founder `PROVIDE_COST` |
| `HUMAN_REVIEW` with a costed draft | asks the founder `APPROVE_OFFER` |
| `WATCH_OTHER_MARKET`, `EXCLUDE_TEST` | nothing |

Panel: `/demand-intelligence/brain` (menu "العقل"). The workbench function adds
`brain` to its GET, plus `run_brain`, `decide` and `assert_fact` POST actions;
`decide` and `assert_fact` require an ADMIN membership.

Phase 2 turns agents on one at a time (Buyer Resolver, Revalidator, Qualifier),
each with a daily budget in `BrainPolicy`.
