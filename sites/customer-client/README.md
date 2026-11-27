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
`mode = plan`, then `mode = publish` with that plan id. Uploaded: `index.html`, `septlion-bridge.js` and the root `.htaccess`.
`/new-app/` and the platform pages are untouched.

## Routing (`public/.htaccess`)

Before this client, the root `.htaccess` sent every path to `/new-app/`, so
the platform pages were unreachable. Now:

1. `/` serves this `index.html` (outside `/new-app/`, so the new-app CSP,
   which only allows `connect-src 'self'`, does not block Supabase).
2. Real files at the root (platform `_next/` assets, the bridge) are served.
3. Platform pages such as `/command-center/` and `/account/` are served from
   the root, except the new-app short links (`/discover`, `/requests`,
   `/notifications`), which stay with new-app. `/require/` is the platform's
   smart request composer: the home page box saves the buyer's words in
   `sessionStorage` (`septlion_requirement_seed`) and opens it there.
4. Everything else goes to `/new-app/` as before (photos, admin, 404).

The rules were checked on a local Apache 2.4 with the same layout.
