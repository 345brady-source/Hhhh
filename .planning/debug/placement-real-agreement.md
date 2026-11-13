---
status: investigating
trigger: "Automatic field placement fails on the owner's real subscription agreement. Owner's report: in the published preview 'it can't analyze', 'it can't place fields anywhere on its own', 'worse than before'; when asked what happened on upload: 'Fields in wrong places'. Owner's rule for the fix: 'you need to notice things about where the signers signature is, and where the counter signature is, it may not have either you need to be able to recognize whether it does or not, only add fields to corresponding fields and boxes on the agreement, don't start adding signature boxes placed randomly like before, it overlays the agreement'."
created: 2026-11-13T15:10:00Z
updated: 2026-11-13T15:10:00Z
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: none yet (observation first)
test: run the current placement code on the owner's real PDF, locally, through the real upload dialog, and compare its output field by field with the ground truth below
expecting: a list of every printed blank, tick box and signature line with what the code placed there (right field on the line, wrong kind, wrong place, missing) and every field placed where the page has no blank
next_action: write a scratch script (scratchpad/real-agreement/work/run.js) that starts the Phase 1 check harness (harness.js start()), uploads agreement.pdf through the #es-agr-file dialog as walk.js does, dumps env.fields and the pageLayout output to JSON, and renders each page with its fields drawn on it to PNG
bug_class: null
reasoning_checkpoint: null
tdd_checkpoint: null

## Session Loop

goal: find_root_cause_only
tdd_mode: false
tdd_phase: none
resume_count: 0
awaiting: none
question: none
last_next_action: gather initial evidence

## Symptoms
<!-- Written during gathering, then immutable -->

expected: For the owner's agreement, every tick box is tickable, every blank is fillable, every signature line is signable, each field sits on its own printed line or box and belongs to the right signer (the investor or the firm). The portal must recognise whether the document has an investor signature block and whether it has a countersignature block (it may have either, both or neither) and act on what is actually there. Fields are added only where the document has a corresponding blank or box. No field is ever placed anywhere else, and nothing may overlay the agreement's text.
actual: Fields in wrong places. Signature boxes are placed at spots that are not signature lines and cover the agreement's text. The owner's words: "it can't analyze", "it can't place fields anywhere on its own", "worse than before".
errors: No message was shown.
reproduction: In the published preview (a claude.ai artifact; the app runs in a sandboxed iframe), signed in as the sponsor, open an offering, upload the PDF as the subscription agreement. The document is at /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/real-agreement/agreement.pdf (13 pages, confidential: never copy it into the repository, never commit it, never quote its text in committed files).
started: Since the e-signature rebuild was published (version of 2026-11-13). It has never worked on this document. Every earlier check used agreements generated in code and ran only locally, never in the preview and never on a real agreement.

## Ground truth for the owner's agreement (counted by eye from the pages)

- Page 2: one blank, the capital commitment amount, inline after a two-line bold label (investor; onboarding knows the amount).
- Page 4: two tick boxes (a small square glyph at the start of a statement).
- Page 5: three tick boxes; then three blanks, each on the line BELOW its bold label: country of citizenship or organisation, country of primary residence or principal office, mailing address.
- Page 6: five tick boxes.
- Page 7: five tick boxes; one blank inline at the end of a three-line bold label (a percentage).
- Page 9 (entity subscribers only): five blanks: type of entity (blank below the label), jurisdiction of formation (inline), date of formation (inline), taxpayer identification number (below), name and title of authorised signatory (below).
- Page 11, heading "For Individual Subscribers": Print Name, Signature, Date, Social Security Number, Address, Email Address, Phone Number: seven lines, each a label followed by an underscore line. The Signature line is the investor's signature.
- Page 11, heading "For Entity Subscribers": Entity Name, By (this is the signature), Name, Title, Date, Taxpayer Identification Number (blank below the label), Address, Email Address, Phone Number: nine lines.
- Page 12, the general partner's acceptance (the firm, the countersigner): a short "$" blank for the accepted commitment inside a sentence, then By (the firm's signature), Name, Title, Date of Acceptance, Effective Date of Admission.
- Page 13: a wiring table with bracket placeholders. These are the sponsor's own text to complete before use and take no field.
- Pages 1, 3, 8 and 10 have nothing to fill in and must get no field.
- Totals: 15 tick boxes; 10 investor fill-in blanks on pages 2 to 9; 16 lines on the investor signature page (7 individual, 9 entity); 6 for the firm on page 12. 47 fields, and zero anywhere else.

## Questions the investigation must answer

1. What does the current code (assets/js/placement.js and the upload path in assets/js/esign.js: pageLayout, autoFields, the fallback block) produce for this exact PDF when run locally? Field by field against the ground truth: right, wrong kind, wrong place, wrong signer, missing; and every field placed where there is no blank (the owner saw signature boxes over text).
2. Why: for each class of miss, the rule or code path responsible (for example: tick boxes drawn as a text glyph and not as a square of pixels; a blank on the line below its label; a label that wraps over several lines; a "$" blank inside a sentence; "By:" as a signature; the fallback block that places fields at fixed positions when no signature label is found).
3. Does anything differ inside the preview's sandbox (strict content security policy, sandboxed iframe, the PDF library and its worker loaded from a CDN, canvas pixel reads)? Reproduce under comparable conditions and say whether placement there differs from the local run.

## Eliminated
<!-- APPEND only -->

## Evidence
<!-- APPEND only -->

## Resolution

root_cause:
fix:
verification:
files_changed: []
