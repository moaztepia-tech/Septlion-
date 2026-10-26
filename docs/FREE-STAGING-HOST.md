# Free staging host — 2026-10-26

URL: https://septlion-command-staging.moaztepia.chatgpt.site

The original SEPTLION application is published as a private Sites deployment on Cloudflare Workers. No card, paid subscription, Render service, temporary tunnel or production-domain change was used. This is an isolated testing host, not a claim of a completed public commercial launch.

## Source and architecture

- Original source: this repository, branch `feat/unified-command-center-20261026`, application commit `391d9fa8891db4d424c725b3cb052140752edacb`.
- Existing `apps/web/app`, `components`, `lib` and `public` files were copied without a UI redesign. Native Next build remains the main repository runtime.
- The hosting checkout uses the supported Sites Vinext/Cloudflare build adapter (Vinext 1.0.0-beta.5, React 19.2.6). This is a different hosting runtime and requires separate acceptance; it is not a new product implementation. Original CSS uses Tailwind 3.4.17, PostCSS 8.4.49 and Autoprefixer 10.4.20 in this adapter.
- The adapter source is retained in the Site's managed source repository. `SOURCE.md` records the original commit. The native Sites workflow pushes the exact source before packaging and publishes its matching archive. No Supabase service key or provider credentials are in client code or hosting source.
- Site ID: `appgprj_6adf90ca2120819180f3766ddb79beca`. Access remains owner-private and requires ChatGPT sign-in. Existing server-side SEPTLION operator authorization remains a separate, required gate.
- Backend remains the real Supabase staging project `vludcbongjozfvpysnuh`; trade-api Edge version 3 adds this exact staging origin only when running in that isolated project. Production API origins are unchanged.

## Verification

- Sites production build succeeded. Hosted health endpoint returns HTTP 200, `environment:staging`, `configured:true`.
- Hosted `/command-center` returns its login gate, not internal contents, without a SEPTLION operator session.
- Hosted `/require` and `/discover` return HTTP 200. Public catalog returns HTTP 200 with `items:[]`, and the response CORS origin matches this Site exactly.
- Local browser confirmed the existing home screen and command gate. Interactive Composer QA was blocked on the internal HTTP preview because browser `crypto.randomUUID` requires a secure context. Application code was not weakened to bypass that environment limit. The published host is HTTPS; a complete interactive hosted browser acceptance run is still pending authenticated access to the private Site.
- Local regression: 96 passed after the staging-only CORS change. Previous hosted SQL acceptance and GitHub build/security/browser evidence are in `STAGING-EXECUTION-2026-10-26.md` and PR #51.
- Runtime settings are stored through Sites, not in the hosting manifest. Only the public Supabase URL/key are embedded in the browser build. The staging Worker applies `X-Robots-Tag:noindex, nofollow` to all responses.

## Remaining commercial release gates

The catalog is empty; no products, verified stock, prices or administrator accounts were invented. WhatsApp Auth/provider is still disabled and actual delivery has not been demonstrated. Private staging publication does not resolve those gates. Preserve its audience and isolated database until operator acceptance and actual provider verification are complete. Production `septlion.com` and its database were not modified.
