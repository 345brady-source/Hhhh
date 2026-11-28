---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 10
subsystem: tax-forms
status: complete
tags: [tax-forms, w-9, w-8ben, pdf-fill, pins]
requires: []
provides:
  - assets/forms (W-9 Rev. March 2024, W-8BEN and W-8BEN-E Rev. October 2021, SHA256SUMS)
  - NS.taxmaps['W-9 2024-03'], NS.taxmaps['W-8BEN 2021-10']
  - NS.taxforms { MAPS (live getter), fill(L, bytes, map, answers, opts) }
  - checks/form-maps.js (parts W-9, W-8BEN)
affects: [06-12, 06-13]
tech-stack:
  added: []
  patterns:
    - "maps are data (taxmaps.js), the engine is separate (taxforms.js)"
    - "ticks redrawn as vector lines in the field's own widget before flattening"
    - "every mapped field checked against the words printed beside it on the blank form"
key-files:
  created:
    - assets/forms/fw9-2024-03.pdf
    - assets/forms/fw8ben-2021-10.pdf
    - assets/forms/fw8bene-2021-10.pdf
    - assets/forms/SHA256SUMS
    - assets/js/taxmaps.js
    - assets/js/taxforms.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/form-maps.js
  modified:
    - diy.html
    - index.html
    - portal.html
decisions:
  - "Check boxes are re-drawn with a vector tick (the forms' own ticked look prints a ZapfDingbats glyph the files do not embed; without that font a viewer shows a broken box)"
  - "fill() refuses an answer key the map does not name and a taxpayer number with the wrong digit count, besides a file whose SHA-256 differs from the pin"
  - "W-8BEN caption place is the free band just above the signature place (below it are the printed label and the print-name field)"
metrics:
  duration: "25 min (base recorded 18:13:45 UTC, gate finished 18:37:33 UTC)"
  completed: 2026-11-15
actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: b56c1a52b4cf9a9468f8bf8db57e206b11f0ffba
plan_head_after: 6f25781d40062b1ed359abbb1290058df83efe73
---

# Phase 6 Plan 10: The official IRS forms pinned, W-9 and W-8BEN mapped and filled through their own fields

The three official IRS PDFs are now in the repository and pinned. The W-9 and W-8BEN maps use only names taken from the bundled files' own field lists. A fill engine refuses any file whose SHA-256 does not match its pin, puts each answer only into the field the map names, leaves empty answers empty, embeds DejaVu Sans and flattens the form to zero fields. One repeatable check proves all of this on every run.

## Failures first

- **Found in Task 1: the forms' own check-box tick does not print without a symbol font.** The IRS on-appearance draws the tick as a glyph from the ZapfDingbats font, and the files do not embed that font. The first fill rendered the ticked box as a "NO GLYPH" placeholder on this machine, which has no Dingbats font. Fixed in `taxforms.js`: the tick is now drawn as lines inside the same widget. The rendered pages show a black tick in the right box.
- **Found in Task 1: the first version of the check could not catch swapped maps.** It confirmed that each value lands in the field the map names. A map that swaps two names (address and city, the LLC box and "other") still passed. Fixed by adding printed-label anchors: every mapped field is checked against the words printed above, beside or under it on the blank form. A re-run of the same swap fails, with 5 W-9 label failures. On the W-8BEN, swapping the article and rate fields and the residence and mailing streets gives 9 label failures plus one value outside its field.
- Gate: no failure. GATE EXIT 0.

## Fields per form

| Form | Fields in the file | Mapped | Unused (reason) | Removed before flattening |
|------|--------------------|--------|-----------------|---------------------------|
| W-9 Rev. March 2024 | 23 (15 text of which 5 comb, 8 boxes) | 23 (name, business, 7 classification boxes, LLC letter, other text, 3b box, exempt payee, FATCA code, address, city/state/ZIP, requester, accounts, SSN 3-2-4, EIN 2-7) | 0 | 0 |
| W-8BEN Rev. October 2021 | 23 (20 text, 2 boxes, 1 signature) | 21 (19 text, 2 boxes incl. 6b and the capacity box, print name) | 1: Date[0] (the signing date is stamped by the e-sign date overlay at this rectangle, on the day of signing, after the form is flattened) | 1: f_20 (signature field with no appearance; flatten throws while it is there) |

W-8BEN-E (179 fields) is bundled and pinned only. Plan 06-12 maps it.

## What form-maps.js proves (per form, every run)

- The pins match: the SHA256SUMS line, the map's sha256 and the D-05 value all equal the bundled file's SHA-256.
- The field list is re-read live from the bundled file. Every field is mapped, unused or removed, and none is listed twice. Every name in the map exists in the file, and kinds, MaxLen and on-values match. The live names equal the planner's listing in fields.json.
- Every mapped field sits beside its own printed label (20 labels on the W-9, 21 on the W-8BEN), and the stacked rows keep their order. Comb cells run left to right on one row.
- A copy with one byte changed is refused and nothing is returned. An unknown answer key is refused. A short SSN is refused.
- Sample fills: W-9 individual (accented name, SSN), LLC taxed as a partnership (3b ticked, letter P, EIN), every field. W-8BEN "Zoë Müller-Łukasz" (Germany, treaty claim), noftin (6b ticked), every field. For each fill:
  - zero fields are left
  - each value appears inside its own field's rectangle and nowhere else (pdftotext -bbox against the blank form)
  - the accented names print exactly
  - ticked boxes get new ink and unticked boxes none
  - no other pixel on the page changes (compared with the blank page rendered without its widgets, allowing a 1-pixel raster shift)
- With every answer empty, the output text equals the blank form's text and zero fields are left.
- Overlays:
  - W-9: sign starts after the "Signature of U.S. person" label and ends before "Date". Date starts after "Date". The caption sits under sign. strike2 has one stroke through the middle of each of item 2's three printed lines, end to end.
  - W-8BEN: sign equals f_20's rectangle and date equals Date[0]'s rectangle with fmt MM-DD-YYYY. The printed labels sit just under both.
  - On both forms, no sign, date or caption place covers a printed word.
- Filled pages are written to /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-10/filled/. The W-9 (llc-partnership, every-field) and W-8BEN (w8ben) pages were viewed, and every value sits in its box.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ticks printed as a missing glyph**
- **Found during:** Task 1
- **Issue:** the IRS on-appearance of every check box shows `/ZaDb 5.6 Tf <34> Tj`, a ZapfDingbats tick from a font the file does not embed. Without the font installed, the box renders "NO GLYPH".
- **Fix:** `box.defaultUpdateAppearances()` after `check()` redraws the tick as lines in the field's own widget.
- **Files:** assets/js/taxforms.js. **Commit:** 664585a

**2. [Rule 2 - Missing critical check] Swapped names were not caught**
- **Found during:** Task 1 (a mutation run)
- **Fix:** added printed-label anchors, row order and comb-cell order to form-maps.js. fill() also now refuses unknown answer keys and wrong-length taxpayer numbers.
- **Commits:** 664585a, a848a55

**3. [Rule 3 - Blocking] Pixel comparison reference**
- The blank form rendered with its widgets drew two box borders one pixel row higher than the flattened page. The reference is now the blank page with widgets hidden (`-hide-annotations`). Ink counts as new or lost only when no ink of the other image lies within one pixel.

**4. W-8BEN caption above the signature place, not below**
- Directly below the signature place are the printed signature label and then the print-name field. The caption takes the free band just above (y 699-706 from the top; the capacity line ends by 695).

**5. W-8BEN part of form-maps.js added in Task 2 (test first) rather than Task 1**
- This follows the task's tdd="true": RED was committed as a848a55. The RED output is in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-10/red-w8ben.txt (`FAIL W-8BEN the map exists`, exit 1).

### Plan-check fixes applied (from the orchestrator)

1. The gate requires `STATUS FLOW: PASS (parts run: 26)` (06-08 is merged), and the server-mode line is matched with `grep -Eq '^SERVER MODE: PASS \(parts run: (6|8)\)$'`.
2. In Task 2, form-maps.js --only W-8BEN ran before the map was written. Its output was saved to $O/red-w8ben.txt, which contains FAIL (exit 1), and `grep -q FAIL $O/red-w8ben.txt || exit 1` was satisfied.

## TDD Gate Compliance

- RED: a848a55 `test(06-10): W-8BEN part of the form-maps check (red: no map yet)`. The run exits 1 with FAIL.
- GREEN: 6f25781 `feat(06-10): W-8BEN map ...`. FORM MAPS PASS (forms run: 2).

## Notes for later plans

- The PDF writer prints a console warning when it drops the forms' XFA (console only, never on screen).
- The W-8BEN fields' own default appearance prints values in blue, and some IRS fields center their text (W-9 line 7, W-8BEN 6a and 8). Both are the forms' own field settings and were left as they are.
- NS.taxforms.MAPS is a getter over NS.taxmaps, so 06-12's W-8BEN-E entry appears there without touching taxforms.js.

## Gate

Task 2's verify command (with plan-check fix 1) ran from a script file and exited 0. Its last lines:

```
==> pins.txt <==            fw8ben-2021-10.pdf: OK / fw8bene-2021-10.pdf: OK (fw9-2024-03.pdf: OK above)
==> maps.txt <==            FORM MAPS: PASS (forms run: 2)
==> server.txt <==          # pass 177, # fail 0
==> math.txt <==            STATUS MATH: PASS (cases run: 13)
==> status.txt <==          STATUS FLOW: PASS (parts run: 26)
==> srvmode.txt <==         SERVER MODE: PASS (parts run: 6)
==> persons.txt <==         TWO PERSONS: PASS
==> owner.txt <==           walkA 13/0, walkB 10/0, walkC 17/0 + 17/0, leak PASS (407 files, 448 commit messages); MEASURE: PASS
GATE EXIT 0
```

Phase 4 and phase 5 checks were run on the base tree (b56c1a5) and on this plan's tree. signing-step had 75 PASS and 0 FAIL on both, and record-check had 40 PASS and 0 FAIL on both, so this plan adds no new FAIL. Task 1's verify gave `FORM MAPS: PASS (forms run: 1)`, and `--only W-10` exited 1. server/node_modules was linked for the run, removed afterwards and never staged.

## Self-Check: PASSED

- All seven created files are present: assets/forms (3 PDFs + SHA256SUMS), taxmaps.js, taxforms.js and checks/form-maps.js.
- Commits 664585a, a848a55 and 6f25781 are on HEAD (git log b56c1a5..HEAD).
- No TODO, FIXME or placeholder in taxmaps.js or taxforms.js. No stubs.
