---
status: investigating
trigger: "Phase 2 field editor check (.planning/phases/02-field-editor/checks/editor.js) ends 101 PASS / 104 with 3 FAIL lines (EDIT-03 required box; EDIT-05 label one undo; saved agreement still signs for the invited investor), same on 50d2d63 and after 06-36."
created: 2026-11-20T00:00:00Z
updated: 2026-11-20T00:00:00Z
---

## Current Focus

bug_class: Bohrbug (deterministic: same 3 FAILs on 50d2d63 and eb0d1f1)
hypothesis: H1 (items 1+2) esign.js:2253 (5f8db30, plan 01.4-69, D-38) deletes `required:false` when an investor's signature is given to the firm, so after the check's signer change the title field (now a signature) is already required: the box starts TICKED, the check's click UNTICKS it (required false). Item 2 then sees required false after the label undo. H2 (item 3) under D-30 (46b1b66, plan 01.4-63) no investor field is required, so the signing bar says "Ready to finish", not "N left"; the field positions/box counts may be fine.
test: debug copy of editor.js (untracked, scratch) printing wasReq, required before/after click, DOM classes; and for item 3 boxes, key matches, count text separately
expecting: H1 -> wasReq true, required after click false, DOM is-opt. H2 -> boxes 12, every key matches, only the / left$/ part false
next_action: write .planning/phases/02-field-editor/checks/editor-dbg.js (copy, extra detail), run it, then delete it

## Symptoms

expected: editor.js 104/104 PASS
actual: 101 PASS / 104; FAIL lines:
  1. "EDIT-03 required or optional: the box is ticked and the field is marked required"
  2. "EDIT-05 typing a label is one step: one undo clears the whole label, not a letter"
  3. "the saved agreement still signs: the invited investor reaches it in onboarding with every one of their fields where the editor left it"
errors: none beyond the FAIL lines (to be captured)
reproduction: python3 -m http.server <port> from repo root; SIGN_PORT=<port> NODE_PATH=$(npm root -g) heavy.sh node .planning/phases/02-field-editor/checks/editor.js
started: same on 50d2d63 and on eb0d1f1 (after 06-36) — predates today's work

## Eliminated

## Evidence

- timestamp: 2026-11-20T01:05Z
  checked: editor.js run on eb0d1f1 (scratch dbg-editor/run0.txt)
  found: 101/104. Item 1 prints no detail. Item 2 detail: title field after one undo has label "Title" (label undo was one step) but required:false (check wants true). Item 3 detail: reached true, mine 12, want 12, count "Ready to finish" (check wants text ending " left").
  implication: item 2's label behaviour is correct; its failure is the required flag, tied to item 1. Item 3 at least fails on the count wording; boxes/positions not yet shown.

- timestamp: 2026-11-20T01:10Z
  checked: assets/js/esign.js:174 isReq (blame 46b1b66 feat(01.4-63) D-30) and esign.js:2249-2253 es-fprop (blame 5f8db30 feat(01.4-69))
  found: isReq: an investor's field is never required (D-30). es-fprop: when an investor signature/initials with required:false is given to a countersigner, `delete f.required` -> required as every firm signature (01.4-69-SUMMARY deviation 2 "[Rule 1 - Bug] An investor signature given to the firm stayed optional", cause of walkC's "nowhere to sign").
  implication: the check's sequence (text->signature on the investor, then signer -> firm) now lands on a REQUIRED firm signature before the Required box is clicked; the click unticks it.

- timestamp: 2026-11-20T01:12Z
  checked: assets/js/signflow.js:28-34, 58-60 (countHTML)
  found: with nothing required (total 0) the bar's head is "Ready to finish" (hint "Nothing is required. Start goes to each empty field."); "N of M left" only when something required is missing.
  implication: under D-30 a fresh investor's bar can never end in " left"; that clause is out of date if the rest holds.

## Resolution

root_cause:
fix:
verification:
files_changed: []
