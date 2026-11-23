# Live client archive (www.septlion.com home today)

This folder keeps the exact client that is live on www.septlion.com, so it can
never be lost by a release and can be published again at any time.

* `public/` holds the 10 files that the "Publish approved SEPTLION client"
  workflow put live on 2026-11-01 (run 41303830388, branch
  `deploy/approved-client-20261101`). Every file matches the SHA-256 in
  `manifest.json`. `index.html` is `7cae91d2…c39bc9`, the same fingerprint the
  2026-11-02 Smart Need run read from the live server.
* `intake.test.cjs` is that release's Arabic intake test (26 cases):
  `node --test sites/approved-client/intake.test.cjs`.
* `smart-need/` is the Gemini "Smart Need" patch for the composer's `send()`.
  **It never went live.** Every Smart Need run (250–259) stopped before upload,
  the last one because the Railway interpreter returned 502. It is kept here
  for reference; the platform now uses the `interpret-requirement` function.

To publish this client again, run the Hostinger deploy workflow with
`site = approved-client` (see `docs/DEPLOY.md`).
