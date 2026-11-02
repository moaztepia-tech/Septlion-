# SEPTLION — Approved customer UI acceptance criteria

Status: implementation checklist, not a redesign authorization.
Base branch: septlion-customer-v2. Do not modify original brand logo.

## Global
- Arabic RTL first, English LTR; Noto Sans Arabic, original navy/gold/white identity.
- Contextual minimal navigation; no persistent five-item bottom bar.
- Do not show AI / المساعد الذكي labels.
- Never fabricate price, certification, stock, ratings or verified claims.
- Preserve entered context through the entire journey.

## Home (/)
- Compact brand header; immersive port/shipping visual.
- “ماذا تحتاج؟” with primary free-text input, attachments when supported.
- Secondary “استكشف القطاعات” route to /discover.
- Do not make the commercial fields or marketing panels compete with the input.
- Free-text requirement enters Composer without forced product selection.

## Discover (/discover)
- Unified vertical product feed; no separate product detail page.
- Compact horizontal sector navigation starting with “الكل”; secondary row only if needed.
- Search icon, not large search bar or page headline.
- Each product card: media above information, approximately 70% media and 30% commercial detail.
- Swipeable media; product name, origin/packaging/specs only where grounded.
- Exactly one primary CTA: “اطلب هذا المنتج”.
- No comparison CTA, no bottom sheet, no inline commercial configuration.
- Product selection proceeds to order preparation.

## Order preparation
- Selected product gallery and compact summary.
- Destination country, Incoterm, payment (L/C before T/T), container count (+/-) for container-based orders.
- Adapt quantity units for non-container goods.
- One primary “متابعة” button; no progress stepper.
- Preserve data and proceed to Composer.

## Composer (/require)
- Conversational, contextual interface; compact selected product and trade-terms summary.
- Ask only genuinely missing questions; never re-ask answered fields.
- Optional contextual chips and notes, text input, attachment/voice when implemented.
- Preserve the current validated requirement submission and approval rules.
- Do not force a large form to interrupt the chat.

## My Septlion (/my-septlion)
- Trade-focused workspace with requests, quotations, execution and delivery statuses.
- Transaction cards with reference, product, destination, quantity, terms and contextual detail actions.
- No persistent five-item bottom navigation.

## Release gates
- Compare each screen with its last individually approved reference image.
- Mobile viewport and RTL/LTR checks; accessibility and keyboard navigation.
- Confirm route handoffs and draft persistence, especially Discover → preparation → Composer → My Septlion.
- Run typecheck/build and journey tests.
- Do not deploy to production before Preview verification.
