# Septlion interface contract

The approved source is `Septlion_Brand_Master_Reference_v1.zip`, version 1, locked 2026-10-05. Its primary navy is `#051945`; it supersedes older PDF palette values. The supplied logo variants are copied as provided. Do not retrace, recolor, crop, stretch or redraw them. Use the wordmark in the desktop header, symbol in the mobile header and primary artwork in offer documents. Product brands such as Zollana retain their own artwork and palette.

## One source of design decisions

- `apps/web/app/design-tokens.css` owns palette, fonts, spacing, radius and motion. Pages consume these variables.
- `globals.css` owns readable typography, native form controls, focus, bidi text and reduced motion.
- `platform-v1.css` owns shared buyer components. `intelligence.css` owns demand/workbench components using the same tokens. Offer and maritime styles use those tokens too.
- `components/platform-header.tsx` owns navigation, supplied brand artwork and mobile navigation. Route-specific actions go through its `actions` prop.
- The static demand-page generator reads the same token file rather than maintaining a second brand palette.

Remove superseded rules when changing a component. Do not append another theme or use `!important` outside print styles. Use logical inline/block properties so RTL and LTR share one layout.

## Interface behavior

Arabic is the primary buyer language. Noto Sans Arabic and Inter are served locally with their licenses. Body and input text use 16px; labels and actions use 14–15px; secondary metadata uses at least 12–13px. Controls use 44–48px target heights. Support visible keyboard focus, mobile stacking and keyboard access to modal dialogs.

The home requirement form places destination, Incoterm, payment (L/C first) and container count before the composer. A single S1–S7 scale sits above the counter. Selected fields travel to `/require`; explicit buyer text overrides starter defaults. Do not silently replace a typed quantity with one container.

The catalog preview contains the established flour ranges: Khabbazo 50/25kg, Asasi 50/25/1kg, Whole Wheat 50/10/1kg. It presents product information without fabricated stock, prices, buyers or verification. A draft stored on the device is not an accepted order. Authentication and existing server authorization still control commercial writes.

## Artwork integrity

SHA-256 of supplied assets used by the interface:

| File | SHA-256 |
| --- | --- |
| `septlion-primary-navy.png` | `9b0e0f088f9ae458edf45b9ae8d0690536aa70da81f213c849482a4014f9f2da` |
| `septlion-wordmark-navy.svg` | `fc10be37bd3379f98472ea37cd29366bf39bb4b5fd005d4e339a99751d230285` |
| `septlion-symbol-navy.svg` | `a869b97ebfd49590d60b72953449e1a9fa7742bc5c4c3d614b45d31fe53856de` |

## Validation before publishing

Run web TypeScript checks, the production Next build, `node --test tests/auth-session.test.mjs tests/offer-document.test.mjs tests/requirement-input.test.mjs`, then check the deployed home, discovery, requirement handoff and trade pages in the browser. Confirm that the production deployment finished successfully before describing the interface as published.
