# Commercial Engine Test Matrix

## Tenant isolation
- Buyer A cannot read Buyer B RFQ.
- Supplier A cannot read Supplier B private Quote.
- Buyer sees a Quote only when it belongs to an RFQ owned by that buyer.
- Public discovery returns only ACTIVE + PUBLIC catalog rows.

## RFQ
- Reject empty RFQ.
- Reject quantity below SKU MOQ.
- Reject mixed suppliers in one RFQ.
- OPEN accepts Quote.
- Invalid state transitions are rejected.

## Supplier matching
- Only public active SKUs are candidates.
- Sector mismatch is excluded.
- MOQ mismatch is excluded.
- Matching never returns private commercial terms.

## Quote / negotiation
- Only assigned supplier can create or revise.
- Quote items must belong to supplier.
- Every revision creates a snapshot.
- Previous proposed revision becomes SUPERSEDED.
- Expired quote cannot be accepted.
- Only buyer can accept.

## Order Intent
- Only ACCEPTED quote can create an Order Intent.
- Same quote is idempotent: repeated request returns the existing intent.
- Creation is audited atomically.
