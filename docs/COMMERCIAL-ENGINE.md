# SEPTLION Commercial Engine

## Flow
SKU → RFQ → Supplier Matching → Quote → Revision/Negotiation → Acceptance → Order Intent.

## Rules
- RFQ is buyer-owned.
- Quote is supplier-owned but visible to both transaction parties through RLS.
- Only the buyer can accept a quote.
- Quote acceptance creates/locks the Order Intent path.
- Every state-changing action is audited inside the same transaction.
- Supplier matching uses the public catalog discovery function and never exposes private supplier data.

## Negotiation
Each revision creates a `QuoteRevision` snapshot. The current Quote stores the latest commercial state, while the revision table preserves the negotiation history.
