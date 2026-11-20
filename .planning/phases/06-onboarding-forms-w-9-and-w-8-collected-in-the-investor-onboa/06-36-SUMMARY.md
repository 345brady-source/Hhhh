---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 36
subsystem: offering intake (document titles), field editor (touch selection)
status: complete
tags: [walkthrough-2, failure-7, failure-9, failure-11, titles, field-editor, touch, sandboxed-iframe]
requires: [06-WALKTHROUGH-2, 06-32, 06-33]
provides:
  - "the document the intake recognises as the subscription agreement (as a whole) is titled 'Subscription Agreement' when it is recognised, on every later path; its file name stays"
  - "field editor: finger reach 22 px beside a field; the press's pointer type taken from its pointerdown"
  - "checks/titles-and-editor.js (4 parts)"
affects: [owner check, preview build (intake.js, fieldeditor.js), gate-reference.sh (orchestrator adds TITLES AND EDITOR (4))]
tech-stack:
  added: []
  patterns: ["retitle at recognition, not at save", "pointer type remembered from pointerdown for clicks that carry none"]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/titles-and-editor.js
  modified:
    - assets/js/intake.js
    - assets/js/fieldeditor.js
decisions:
  - "Titling follows the intake's own recognition of the whole file (prepareAgreement kind 'agreement'; readPart's whole-file reuse); a combined file or an unrecognised document keeps its file-name title (D-33: no reader work). Open for the owner."
  - "Finger reach 22 px (every field gets a tap area at least 44 px each way); nothing in the editor is drawn larger."
  - "A click with no pointer type uses the finger rule only when the primary pointerdown before it was not a mouse."
metrics:
  duration: about 75 min
  completed: 2026-11-20
estimate:
  tokens: 90000
actuals:
  tokens: 11742
  tasks: 2
  commits: 4
plan_head_before: 50d2d63a86d6bd324578a1cee37db181652480d1
plan_head_after: e691fcb354e0d620b92826bcb4e92ff782c08adc
---

# Phase 6 Plan 36: the agreement document titled for what it is, and every field within a finger's reach

The intake now titles the stored document it recognises as the subscription agreement "Subscription Agreement" when it
recognises it, so the path where the intake's draft is discarded and the agreement is added from the offering page no longer
shows investors "Document"; and the field editor selects a field when a finger lands up to 22 px beside it, also when the
browser's click carries no pointer type.

## Failures and open items first

- **Owner check pending.** Nothing here is ready until the owner has checked it in the next preview (owner/index.txt).
- **Not changed (decision, D-33):** an agreement inside a larger combined file, and documents the intake did not recognise as
  the agreement, keep the title taken from their file name. No content title is known for them without reader work. Open
  for the owner.
- **Not tested on a real iPhone** (no WebKit here). Touch was Chromium at 390x844 with touch in the refusing sandboxed frame;
  the "plain MouseEvent click" case was simulated by dispatching a click event that has no pointer type after a touch
  pointerdown.
- **Phase-2 field editor check: 3 FAIL lines on the base and the same 3 on the fix, none new (W3 diff):**
  `FAIL EDIT-03 required or optional: the box is ticked and the field is marked required`,
  `FAIL EDIT-05 typing a label is one step: one undo clears the whole label, not a letter`,
  `FAIL the saved agreement still signs: the invited investor reaches it in onboarding with every one of their fields where the editor left it`.
  101/104 on both trees. Pre-existing, outside this plan; not touched.

## RED on the base (50d2d63), red.txt

`TITLES AND EDITOR: FAIL (parts run: 4) - title-discard-desktop, title-discard-phone, editor-reach-phone` (51 PASS, 13 FAIL). Quoted:

- `FAIL title-discard-desktop the investor’s "Offering documents" lists "Subscription Agreement" and "Summary of terms", and no entry titled "Document" :: {"offering":["Document","Summary of terms"],"section":"Offering documents 2 documents Document Northgate Motors Shares Summary of terms Northgate Motors Shares",...`
  (the walkthrough's "Offering documents: Document Elio Motors Shares", reproduced with invented documents)
- `FAIL title-discard-phone the console’s Documents lists "Subscription Agreement" with Document.pdf beneath, ... :: ["Summary of terms Summary of terms.pdf · 19 KB · offering document","Document Document.pdf · 29 KB · offering document"]`
- the same on the Subscription step (`["Document","Summary of terms"]`) and in the stored record (`"title":"Document","fileName":"Document.pdf"`), both devices.
- `FAIL editor-reach-phone a finger tap 20 px beside the field selects it (its toolbar is shown for that field) :: {"s20":null,...}` (field drawn 4.7x4.7 px at Fit)
- `FAIL editor-reach-phone after a touch pointerdown 10 px beside the field, a click delivered as a plain MouseEvent (no pointer type) selects it :: {"cleared":null,"sPlain":null,...,"plain":{"target":"es-page","pointerType":"(none)"}}`
- `FAIL editor-reach-phone the selected field’s Properties opens and its fields measure at least 16 px :: null` (follows from no selection)

Every part behaved on the base as the plan expected: editor-mouse-desktop passed; the download name was already
"Document.pdf"; the agreement saved from the offering page, the envelope and the signed copy were already titled
"Subscription Agreement…" (06-32). The root cause the plan named is confirmed: the intake's stored document is retitled
only by saveAgreement from that document, and on this path the draft made from it is discarded.

## Results on the fix (all run from this worktree)

- Task 1 verify: `TITLES AND EDITOR: PASS (parts run: 2)` (title-discard-desktop, title-discard-phone)
- Task 2 verify (last lines): `TITLES AND EDITOR: PASS (parts run: 4)` (64 PASS), `SIGNING DOCUMENTS: PASS (parts run: 2)`,
  `REAL FIRM: PASS (parts run: 4)`, `AGREEMENT NAME: PASS`; owner/index.txt written.
- Server tests: 358 of 358 pass.
- Phase-2 editor check: 101/104 on base and fix, same 3 FAIL lines (above).
- Full reference gate: not run (gate pacing rule; the orchestrator runs it on the merged tree).

## Gate line for the orchestrator

TITLES AND EDITOR (4): `NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/titles-and-editor.js > $O/titles.txt 2>&1`, expecting `TITLES AND EDITOR: PASS (parts run: 4)`.

## Deviations from Plan

1. **[Rule 3] The check confirms the review mark on screen before saving.** The invented agreement leaves one field
   marked for review (a witness line), as the owner's document did, so the draft stays with "Discard". The agreement added
   from the offering page has the same mark; the check confirms it on screen (desktop: the field, then "Confirm this
   field"; phone: the field, the sliders button, "Confirm this field") before "Save subscription agreement".
2. **[Rule 3] editor parts use the sample firm with an added small tick box.** The phase-4 fields' smallest boxes are
   within 17 px of each other, so the check adds one invented 0.12 in tick box on page 1 (drawn 4.7x4.7 px at Fit on the
   phone, the walkthrough's smallest size) with no field within 30 px.
3. **"The offering page"** was checked as the console offering's Subscription agreement panel and the investor's
   Subscription step document list (the offering page lists no documents by title otherwise).
4. **Plan ledger file** could not be written inside the shared git directory from this isolated worktree; the base is
   recorded in SCRATCH/exec-06-36/base-commit.txt and the commit count was measured with `git rev-list --count 50d2d63..HEAD`.
5. A follow-up test commit (e691fcb) only scrolls the document lists into view for the owner's screenshots; the full check
   was re-run after it (PASS 4).

## Commits

- 1d5951e test(06-36): titles-and-editor check, red on the base
- 4901703 fix(06-36): the document the intake recognised as the agreement is titled Subscription Agreement on every path (failure 7)
- c0d335d fix(06-36): every placed field within a finger's reach in the field editor (failures 9 and 11)
- e691fcb test(06-36): owner screenshots show the document lists (scrolled into view)

## Files a preview build must add

assets/js/intake.js and assets/js/fieldeditor.js (changed). No new runtime file.

## Threat surface

None new. T-06-61: the nearest field within 22 px wins (nearestField); mouse clicks are unchanged (editor-mouse-desktop and
the phase-2 check on the fix).

## Self-Check: PASSED

checks/titles-and-editor.js, intake.js, fieldeditor.js present; commits 1d5951e, 4901703, c0d335d, e691fcb on HEAD.
