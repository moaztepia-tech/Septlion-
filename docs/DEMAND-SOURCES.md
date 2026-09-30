# Automated Sources

## World Bank Procurement Notices

Route: `GET /api/demand-intelligence/sources/world-bank`

Purpose:
- Fetch the official public World Bank procurement notice feed.
- Cache the upstream call for one hour.
- Filter the current batch for flour-related procurement language.
- Normalize matches into Septlion Demand Intelligence signal objects.
- Preserve source status separately from buyer resolution.

Safety / quality rules:
- A notice is not a verified buyer identity.
- Missing quantity remains "Not stated in source index"; it is never inferred.
- The collector does not create an intent page automatically from a source-index match.
- Buyer resolution and live-requirement verification remain downstream gates.
- If the upstream source fails, the route fails closed with a 502 response.

Next:
1. Persist normalized signals and deduplicate by source + source ID.
2. Add a scheduler.
3. Add keyword/category profiles beyond flour.
4. Add official procurement sources one by one after verifying access terms and schemas.
