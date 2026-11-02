# SEPTLION — one controlled operational launch

**Status: verification in progress; no production deployment approved.**

## Fixed scope
Keep the exact approved Hostinger homepage, logo, typography, product cards, RFQ sheet, seven container tiers, and Discover interaction. Do not replace the homepage with Railway's different interface.

## Verified inventory (November 2, 2026)
- Hostinger: the homepage is an interactive preview; it stores requests under `septlion.preview.requests.v3` in browser localStorage.
- Hostinger also exposes separate Next.js routes for `/discover/`, `/require/`, `/requests/`, `/account/`, and `/offer/`.
- `/review/` and `/my-septlion/` returned HTTP 404 in initial external checks.
- Supabase project `septlion-demand-intelligence` is active; deployed authenticated Edge Function `trade-api`, version 17, handles `requirements.create` and lifecycle actions. Database uses RLS.
- Separate Railway `septlion-web` hosts `/api/interpret-requirement`; last tested Gemini request failed. Do not make Gemini a dependency for submitting RFQs.
- Existing `submit-demand-rfq` function is specific to wheat-flour public demand submissions, not an acceptable generic substitute for the platform's authenticated requirement system.

## Strict release steps
1. Freeze design and audit backups. Keep current Hostinger `index.html` and `intake.js` unchanged.
2. Verify missing routes and restore the appropriate **existing** vetted Next.js route files and assets in a staging location only.
3. Keep the deterministic need parser available when Gemini is unavailable; diagnose and fix the credential independently.
4. Use the existing authenticated `trade-api requirements.create` flow and WhatsApp/phone verification — do not create a parallel unverified database endpoint.
5. Wire the **existing** Hostinger customer experience to that actual transaction flow with no visual changes. Preserve original product, packing, volume, destination, payment and contact context.
6. On a controlled test buyer account, prove that one RFQ is persisted and visible to SEPTLION operator with exact data and stable idempotency. Avoid test data contamination and avoid invented status changes.
7. Verify UX: after successful `طلب عرض سعر`, close the RFQ sheet, remain on Discover at same position and show a concise confirmation; no redirect to My Septlion.
8. Compare production UI snapshots against the approved reference and run smoke, auth, security, build and regression checks.
9. Only after ALL gates pass, obtain explicit owner approval for one atomic production deployment with a rollback snapshot.
10. Observe live post-deploy request and recovery; record exact commit/hash and operator-visible reference.

## Release blockers / do-not-claim
No live endpoint should claim a genuine submitted RFQ while it merely saves to localStorage. No release if routes are missing, the buyer cannot authenticate, or the operator cannot find a persisted request. A successful CI build or Railway deploy alone is not a complete launch.

Audit command: `node scripts/septlion-live-audit.mjs`. The GitHub Actions workflow stores a report artifact.
