# Customer experience — 2026-10-07

## Approved architecture

- Home starts a need. Product cards belong to the separate Discover Feed.
- Discover: product → container count and scale → Incoterm → destination → payment → buyer contact → Composer. No extra transition button after contact data.
- Composer completes the chosen product's draft or starts the freeform need. It asks for one missing detail, preserves provided facts and allows review before submission.
- One Septlion offer, then a specific accepted revision, execution, private documents, receipt/claims and reorder.
- Preserve the approved logo, navy palette, Noto Sans Arabic and Inter. Preserve the restored Discover layout.

## Changes implemented in this revision

- Product cards removed from Home; Discover remains a separate route with its restored layout and assets.
- Discover configuration persists in the same tab. Contact fields support keyboard progression; completing the final phone field transfers to Composer on Done/Enter or blur outside the contact fields. The optional email remains optional. Contact validation does not claim WhatsApp ownership verification.
- Available pack sizes are choices, not an automatically confirmed pack. Composer asks for the missing choice and retains the selected product variant.
- Home and Composer persist draft data in the same tab. Composer retains edits, notes, conversation and unsent input through refresh and the login return path. Local drafts are scoped to the signed-in user where known and cleared on explicit logout.
- Submitted Feed requests use reviewed values. Tonnage is not converted into an invented container count. Invalid quantities remain available for correction.
- Requests and offers distinguish loading, failure, empty and loaded states. Failures do not silently display unrelated local drafts. The request opens its actual issued offer or associated transaction.
- Stage links carry explicit request/offer/transaction IDs. Unavailable stages stay disabled. A transaction resolves its related request through its own accepted offer.
- Offer acceptance requires review of the displayed revision and valid expiry. The server remains responsible for revision checks and commercial authorization.
- Execution shows an actual next action; open claims take priority over receipt. Receipt has a final review before the stored confirmation.
- Reorder enters Composer before a new RFQ is created. It retains the approved configuration, allows quantity changes in the original unit, and uses the existing idempotent reorder endpoint. Other specification changes start a new requirement. Price and shipping date are not copied into the draft.
- Customer navigation and offer documents link to the customer's trade context.

## Verification

- 69 automated cases pass, including the existing auth, offer/PDF, permission, private-document, claim and reorder regressions and the new draft/context tests.
- Typecheck and production build must pass on the final commit.
- Browser acceptance still needs an actual run on the published final revision: Home input → Composer → reload; Discover → contact keyboard/blur → Composer; mobile review controls; sign-in return; exact request/offer/transaction links; TEST receipt/claim/reorder paths.
- An earlier TEST lifecycle run is evidence for the earlier implementation, not proof of this revision's entire browser journey.

## Gates not closed by this frontend revision

1. Actual WhatsApp ownership verification and its configured provider, cost and delivery behavior.
2. Private specification attachments before offer issuance. Execution-document upload is already available; it does not satisfy the earlier requirement-attachment step.
3. Server-enforced idempotency for initial requirement creation after an ambiguous network timeout. The UI blocks double submission; this is not an atomic server guarantee. Reorder uses its existing server retry key.
4. Cross-device draft synchronization. This revision stores drafts within the current browser tab.
5. A persistent buyer revision-request workflow tied to the existing RFQ and offer version.
6. Measured buyer usability, accessibility and performance acceptance on representative Arabic/mobile devices. No claim of WCAG certification or superiority over competitors is made from unit tests alone.

## Global reference points

These inform acceptance criteria, not promises about Septlion's current guarantees:

- [Alibaba Trade Assurance](https://buyer.alibaba.com/page/tradeassurance/buyer/story.html): review of agreed order terms and traceable transaction evidence. Septlion must not claim an equivalent protection or refund policy without its own approved operational system.
- [SAP Business Network documents](https://help.sap.com/docs/business-network-for-procurement/business-network-buyer-administration/sap-business-network-documents): coherent commercial records across order and fulfillment documents.
- [Global Sources inquiry guide](https://s.globalsources.com/HELP/GSOLHELP/HOW2IB.HTM): carry a product selection into its inquiry context.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): redundant entry, visible focus, input labels and review of financial commitments.

The ambition to exceed major global platforms requires measured completion, error rates and buyer testing; a newly published interface alone does not establish that result.
