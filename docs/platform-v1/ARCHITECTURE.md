# Septlion Platform V1 — Architecture Decision Record

## Decision
Keep the existing Next.js + NestJS + Prisma/PostgreSQL foundation. Introduce BuyerRequirement and Feed Draft Context upstream of the existing RFQ/Quote/OrderIntent foundations instead of rewriting the commerce core.

## Experience boundaries
- Public Web: discovery/SEO/GEO.
- Buyer Web App/PWA: Home, Discover, Requests, Notifications, Account.
- Buyer Intelligence: requirement extraction, provenance, next-best-question.
- Septlion Supply Engine: match/verify/cost/comply/risk/select.
- Trade Execution: offer/commit/execute/receive.
- Trade Memory: reusable approved configurations and buyer trade history.

## State ownership
The backend is authoritative for commercial state. Client/session state may optimize UX but must not be the only copy of an identified buyer's RFQ.

## Requirement field provenance
Each requirement field can be CONFIRMED, DERIVED, SUGGESTED, UNKNOWN, or CRITICAL_MISSING.

## Feed draft rule
Before buyer capture, a feed configuration may exist as anonymous session state. Once Name+Company+valid WhatsApp are present, persist buyer identity + draft requirement/RFQ and bind attribution. Email remains optional.

## Notification rule
In-app notifications are canonical. Ask for Web Push permission only after the buyer has created meaningful value (e.g. first RFQ), with a contextual prompt such as quote-ready alerts.

## Trade Memory rule
Separate historical observation/preferences from Approved Product Configuration. A past choice is not automatically a permanent specification.

## Brand rule
Use the approved SEPTLION identity as supplied. Do not redesign the logo. Primary identity is dark navy; derivatives must preserve original artwork.
