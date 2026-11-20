---
status: investigating
trigger: "Phase 2 field editor check (.planning/phases/02-field-editor/checks/editor.js) ends 101 PASS / 104 with 3 FAIL lines (EDIT-03 required box; EDIT-05 label one undo; saved agreement still signs for the invited investor), same on 50d2d63 and after 06-36."
created: 2026-11-20T00:00:00Z
updated: 2026-11-20T00:00:00Z
---

## Current Focus

bug_class: Bohrbug (deterministic: same 3 FAILs on 50d2d63 and eb0d1f1)
status_note: H1 and H2 CONFIRMED by the instrumented run (see Evidence 01:40Z, 01:48Z). All three are out-of-date checks, no product fault.
next_action: update only the three assertions in editor.js (with comments citing 5f8db30/01.4-69 and 46b1b66/01.4-63), run editor.js in full, then a mutation run (Required box ignored; investor fields required again) on a scratch copy to prove the new assertions bite
reasoning_checkpoint:
  hypothesis: "Items 1+2 fail because esign.js:2253 (5f8db30, 01.4-69) makes an investor signature given to the firm required, so the check's click unticks a ticked box; item 3 fails only because D-30 (46b1b66, 01.4-63, esign.js:174) leaves the investor nothing required, so the bar reads 'Ready to finish'."
  confirming_evidence:
    - "dbg1.txt: before click wasReq true, required key absent, role countersigner, DOM is-req; after click required false, DOM is-opt"
    - "dbg1.txt DBG3: boxes 12 = want 12, missing [], extra [] (exact type/page/x/y/w/h), count 'Ready to finish'"
  falsification_test: "If the Required box were broken, the pre/post DOM would not flip; if a field moved on the way to onboarding, DBG3 missing/extra would be non-empty. Neither happened."
  fix_rationale: "No product change: the product does what D-30 and 01.4-69 decided. Only the three stale clauses change, each to the state those decisions produce, keeping (and adding) the discriminating clauses."
  blind_spots: "Ticking an unticked Required box on a firm field is no longer exercised by this exact step (same setProp path as unticking); covered by the mutation run only for the untick direction."
  candidate_causes:
    - "code: Required box handler / undo coalescing in fieldeditor.js (eliminated: DOM flips, label is one step)"
    - "data/config: D-30/D-38 product decisions changed the starting state the check assumes (confirmed)"
  and_gate: "yes for items 1+2: D-30 (investor signature optional) AND 01.4-69 (given to the firm becomes required) together put the box in the ticked state; item 3 needs D-30 alone."
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

- hypothesis: the Required box in the field editor does not change the field (product fault)
  evidence: dbg1.txt: one click flips box checked->unchecked, model required (absent)->false, DOM is-req->is-opt
  timestamp: 2026-11-20T01:40Z

- hypothesis: typing a label is stored letter by letter (undo takes one letter)
  evidence: after one undo the label is exactly "Title" (run0.txt and dbg1.txt item 2 detail)
  timestamp: 2026-11-20T01:40Z

- hypothesis: the sponsor's edited agreement reaches the investor with fields moved, lost or added (launch blocker)
  evidence: DBG3: 12 of 12 boxes, exact type/page/x/y/w/h match for every field, missing [] extra []
  timestamp: 2026-11-20T01:48Z

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

- timestamp: 2026-11-20T01:40Z
  checked: instrumented desktop pass (untracked editor-dbg.js; scratch dbg-editor/dbg1.txt) at the Required box
  found: BEFORE the click: title field is a signature, its signer's role "countersigner", the `required` key absent (deleted by esign.js:2253), box checked (wasReq true), DOM "es-fld es-fld-signature is-sel is-req is-thin". AFTER the click: required false, box unchecked, DOM "... is-opt ...".
  implication: H1 CONFIRMED. The Required box works both ways in the product: it shows the firm signature as required and one click makes it optional. The check assumed the field was still optional before the click (true before 5f8db30). Item 2's required:false after the label undo is the same untick, not an undo fault: the label came back as "Title" in one undo.

- timestamp: 2026-11-20T01:42Z
  checked: precedent for item 3's wording in 01.4-63-SUMMARY "Every changed expectation" item 9 and 04 checks/signing-step.js:134,189,230
  found: 01.4-63 changed signing-step.js's investor expectations from "5 of 6 left" to "Ready to finish" under D-30; editor.js was not in that list and was never updated (git log of editor.js: last change 3bf7f1f 2026-11-13, before 46b1b66 2026-11-15).
  implication: item 3's / left$/ clause is a missed D-30 expectation, provided boxes and positions match.

- timestamp: 2026-11-20T01:48Z
  checked: instrumented desktop pass, item 3 (DBG3 line, scratch dbg-editor/dbg1.txt)
  found: {"reached":true,"mine":12,"boxes":12,"want":12,"missing":[],"extra":[],"count":"Ready to finish"}: the invited investor reaches the agreement in onboarding; all 12 of their fields are drawn as theirs; every field's type, page, x, y, w, h equals exactly what the editor saved; none missing, none extra. Only the count clause fails.
  implication: H2 CONFIRMED. No launch-blocking bug: the sponsor's edited agreement reaches the investor with every field where the editor left it. The bar says "Ready to finish" because of D-30.

## Resolution

root_cause:
fix:
verification:
files_changed: []
