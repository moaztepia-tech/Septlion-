# Septlion interface contract

The approved source is `Septlion_Brand_Master_Reference_v1.zip`, version 1, locked 2026-10-05. Its primary navy is `#051945`; it supersedes older PDF palette values. The supplied logo variants are copied as provided. Do not retrace, recolor, crop, stretch or redraw them. Use the wordmark in the desktop header, symbol in the mobile header and primary artwork in offer documents. Product brands such as Zollana retain their own artwork and palette.

## One source of design decisions

`apps/web/app/septlion-design-system.css` is the single customer stylesheet, based on the user's `deepseek_css_20261010_30e46c.css` (Design System v1.0, approved 2026-10-10). Its missing alert tail and shared cards/navigation/utilities are completed with the same tokens. The root layout imports this file once; customer pages do not import their own CSS.

- Palette: #051945 / #030D26 / #0A1838 / #3D5185 / #8FA6D6 / #E9EDF5.
- Arabic: Noto Sans Arabic. English and numeric data: Montserrat. Both served locally with licenses.
- RTL and dark first; a 4px spacing grid, nine reference text sizes, four depth layers, and 150/250/400ms transitions.
- Components use the reference edge, inner-edge, fill and sheen layers. Keep native form semantics, accessible labels, focus, and reduced motion.
- The original navy logo remains on a light plate; do not recolor, redraw, crop or stretch it.

## Responsive customer presentation

The customer presentation keeps the supplied reference prefix, brand palette, local fonts and component layers in the same shared stylesheet. Depth is restrained: thin borders, calm surfaces, clear selected states and one prominent action per panel. Fields retain native semantics and visible focus.

Desktop uses a 1120px content area and top navigation. Home pairs the request form with a concise journey explanation; Discover separates product information from request configuration. Phones use a single column, a compact brand header and bottom navigation. Native fields use 16px text, and interactive controls keep 44px targets. The home product feed uses the actual catalog definitions, without invented price or availability claims. All product entries continue through Product Details and Composer.

## Customer journey

Home → Discover → Product Details → AI Composer → Request Review → My Septlion → My Requests → Request Details → Quotation → Deal Details → Documents → Company Profile.

All new requests and reorders pass through `/require`, then the dedicated `/review` page. A review page cannot send a draft that has not visited Composer. There is no separate Cart or customer RFQ flow. `/maritime-rfq` forwards to Composer; original RFQ compatibility redirects remain.

Existing server authorization still controls requests, offers, acceptance, execution, documents and receipts. `My Septlion` shows server requests only when authenticated; failures stay explicit. Company Profile reuses the current authenticated profile.get/profile.update service. Preserve delivery schedules, stable request retry keys, tonnage and per-batch execution/receipt from the latest branch. WhatsApp input is not confirmation; the existing available-login check controls the verification flow.

The catalog keeps Khabbazo 50/25kg, Asasi 50/25/1kg, Whole Wheat 50/10/1kg. Price, stock and shipping dates are confirmed in an issued offer; never fabricate these facts. A local draft is not an accepted order.

Preview publishing is limited to branch `septlion-customer-v2` and `/preview/septlion-customer-v2/` on the existing Hostinger hosting. Do not update `main` or the production root in this task.

## Artwork integrity

SHA-256 of supplied assets used by the interface:

| File | SHA-256 |
| --- | --- |
| `septlion-primary-navy.png` | `9b0e0f088f9ae458edf45b9ae8d0690536aa70da81f213c849482a4014f9f2da` |
| `septlion-wordmark-navy.svg` | `fc10be37bd3379f98472ea37cd29366bf39bb4b5fd005d4e339a99751d230285` |
| `septlion-symbol-navy.svg` | `a869b97ebfd49590d60b72953449e1a9fa7742bc5c4c3d614b45d31fe53856de` |

## Validation before publishing

Run web TypeScript checks, the production Next build, `node --test tests/auth-session.test.mjs tests/offer-document.test.mjs tests/requirement-input.test.mjs`, then check home, discovery, requirement handoff and trade pages in the browser. Check the responsive layout at phone width as well as desktop width. Confirm that the Preview deployment finished successfully before describing the interface as published.
