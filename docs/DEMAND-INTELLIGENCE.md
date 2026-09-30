# Septlion Demand Intake

The Demand Intelligence Engine now has a normalized intake endpoint:

`POST /api/demand-intelligence/intake`

It accepts one signal or an array (maximum 100). The intake layer does **not** claim a buyer is verified. It normalizes the signal and assigns an operational state.

Example:

```json
{
  "type": "TENDER",
  "market": "Kenya",
  "product": "Wheat Flour 50kg",
  "quantity": "1 x 20ft FCL",
  "published": "2026-09-30",
  "buyer": "Buyer name only when source states it",
  "source": "Public procurement portal",
  "sourceUrl": "https://source.example/tender",
  "deadline": "2026-10-10",
  "incoterm": "CIF Mombasa",
  "packing": "50kg PP"
}
```

Output states:
- QUALIFY_NOW: strong structured signal.
- RESOLVE_BUYER: useful demand, buyer/evidence work still required.
- WATCH: insufficient structure.
- intentPageCandidate: only true when the signal has enough product-market structure.

Next production connector layer: scheduled collectors should transform permitted public-source records into this schema, retain source URLs/evidence, deduplicate, and send them to the intake endpoint. Authentication, persistence, source-specific rate limits/terms, and monitoring are required before exposing ingestion publicly.
