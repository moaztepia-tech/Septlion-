# Customer client (www.septlion.com home)

The founder chose (2026-11-23) to keep the interface customers know, the one
built at `www.septlion.com/new-app/` with the flour photos and its own admin
panel, as the face of the site, and to run the SEPTLION platform behind it.

* `public/index.html` is the live `/new-app/index.html`, archived in
  `sites/new-app-live/`, with the edits made by
  `scripts/build-customer-client-index.py`:
  * images, fonts, icons and `data/products.json` load from `/new-app/`, so
    the new-app admin panel keeps managing the catalog and photos;
  * the "request a quote" and "describe your need" buttons call
    `SeptlionBridge.submit()` instead of opening WhatsApp directly.
* `public/septlion-bridge.js` asks for name, company, WhatsApp and email, sends
  a code to the email (Supabase Auth), and then creates the request with
  `trade-api` `requirements.create`. The request shows up in the command center.
  Product requests are linked to the platform SKU (`asasi50` becomes
  `sku-asasi-50`) when it is published. WhatsApp stays available as a fallback.
  The session is stored under `septlion_session`, the same key the platform
  uses, so `/account/` opens signed in.
* Tests: `node --test sites/customer-client/bridge.test.cjs`.

Rebuild after the new-app interface changes: refresh `sites/new-app-live/index.html`
from the live file, run the build script, then update `manifest.json` hashes.

Publish with the Hostinger deploy workflow: `site = customer-client`, first
`mode = plan`, then `mode = publish` with that plan id. Only `index.html` and
`septlion-bridge.js` are uploaded; `/new-app/` and the platform pages are untouched.
