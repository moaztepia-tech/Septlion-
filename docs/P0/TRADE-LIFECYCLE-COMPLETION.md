# Execution, private documents and receipt workspace

The operator can update only the next permitted execution stage, upload transaction documents, and document claim resolution. The buyer can read saved milestones, download shared documents, confirm receipt after delivery, and open a new RFQ from a completed transaction.

## Saved transitions

| Current state | Operator action | Saved state |
| --- | --- | --- |
| COMMITTED | Start preparation | IN_EXECUTION |
| IN_EXECUTION | Confirm readiness | READY_TO_SHIP |
| READY_TO_SHIP | Record shipping | SHIPPED |
| SHIPPED | Record transport | IN_TRANSIT |
| IN_TRANSIT | Record delivery | RECEIPT_REVIEW |
| RECEIPT_REVIEW | Buyer reports an issue | CLAIM_OPEN |
| CLAIM_OPEN | Operator documents resolution | RECEIPT_REVIEW |
| RECEIPT_REVIEW | Buyer confirms receipt | COMPLETED |

Commercial shipping requires a READY shared BILL_OF_LADING document; delivery requires a READY shared DELIVERY_PROOF document. Uploading an attachment establishes its byte integrity, not the authenticity of its commercial contents. The operator remains responsible for checking evidence before recording an event.

## API and authorization

The existing POST Edge API dispatches `operator.transaction`, `transactions.advance`, `documents.prepare`, `documents.complete`, `documents.list`, `documents.download`, `claims.open`, `claims.resolve`, `receipt.accept` and `reorder.create`. It validates Supabase Auth, active core profiles and organizations. Operator access comes from an active SALES/ADMIN membership in the Septlion organization; email text does not provision permissions.

Every mutation RPC independently checks the actor and transaction scope. State changes lock the aggregate and verify `expectedVersion`. Advance, claim opening, document registration and reorder use stable keys; an exact replay returns the original result and a changed replay is rejected. Receipt and claim resolution also have explicit replay behavior. Receipt and trade memory commit atomically. The reorder retains product configuration, updates quantity/container classification, and clears previous price targets and shipment dates.

RPCs execute only through `service_role`. Client table access remains denied and core RLS remains enabled. The runtime access verification includes TradeClaim and all lifecycle RPC grants.

## Private documents

The `trade-documents` bucket is private, allows PDF/PNG/JPEG only, and limits files to 10 MiB. The server creates a transaction/document-specific storage path and a non-overwriting signed upload URL. Upload completion reads the actual bytes and checks length, MIME signature and SHA-256 before READY; a mismatch becomes QUARANTINED. There is no antivirus scanner or assertion of content authenticity.

Own-organization files and explicitly shared counterparty files are listed. A signed download is issued only after transaction/document authorization and expires after 60 seconds. Storage paths and hashes are not included in list responses. Private document events are not exposed to the counterparty.

## TEST isolation

The server derives test status from the saved issued revision. Acceptance requires matching mode and current revision. TEST transactions have a TEST reference, visible simulation notices, and separate statistics. Simulation does not claim real sale, payment, preparation, shipment or receipt; real shipping-evidence requirements are bypassed only for those saved TEST cases. Reorder preserves TEST provenance. No outbound email is sent by this workspace.

## Verification

- `node --test tests/auth-session.test.mjs tests/offer-document.test.mjs tests/trade-lifecycle.test.mjs`
- `supabase/tests/trade_lifecycle_workspace.sql`: generated fixtures, expiry/revision/mode, ownership, ordered milestones, replay/conflicts, documents, claims, receipt/memory, quantity/scale and commercial evidence requirements; all fixtures roll back.
- `supabase/tests/trade_api_runtime_access.sql`: RLS, client isolation and server grants.
- Required CI, Platform V1 Quality and Production Readiness checks cover web types/build and Prisma schema formatting/validation.
- Production acceptance uses a separate explicitly non-commercial TEST RFQ and offer; document download must match the uploaded byte hash.

## Remaining product scope

This workspace records operator-entered execution evidence. It does not collect carrier telemetry, accept payments, verify supplier document authenticity, generate binding contracts, implement change orders, or send messages to external parties. Those integrations need separately scoped work and verified commercial data.
