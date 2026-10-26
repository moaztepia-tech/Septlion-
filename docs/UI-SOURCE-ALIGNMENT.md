# Customer UI source alignment

The initial free staging host copied PR #51 correctly, but PR #51 was based on an older customer UI. It did not contain the approved Oct 18 customer changes or their Oct 19 V3 continuation. The user identified the visual mismatch.

This integration merges `design/global-customer-experience-v3` at `b4a730627ab84f097ee966a1557b7a854f2c562b`, which contains `feat/approved-customer-ui-20261018`, into the existing unified-command-center branch. It preserves the current guarded command center, patched dependencies, server Auth proof, stable database mutations, and isolated staging deployment.

Customer screens now use the retained V3 design system, original brand artwork, home/discovery/preparation/Composer/review and My Septlion pages. Discovery and preparation read the real published catalog rather than substituting static preview products. Selected SKU/container allocations survive preparation and review. Phone ownership is verified inside review without a forced account-page detour. Company/profile and scheduled-delivery functionality from the UI branch remain integrated.

Validation recorded so far: native Next production build passed; 112 Node/API/PostgreSQL regressions passed. The browser golden path now follows the retained preparation/Composer/review routes; publication must wait for its CI result. No production deployment is authorized by this source alignment.

Hosted profile/contact reads now have explicit server-role SELECT grants with no browser-role grants. Browser CI uses runner-provided Chrome to avoid the blocked browser-download step; it still executes the full real Edge/PostgreSQL journey.
