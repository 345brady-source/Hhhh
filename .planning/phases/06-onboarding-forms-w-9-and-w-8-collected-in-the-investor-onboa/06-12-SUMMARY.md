---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 12
subsystem: tax-forms
status: complete
tags: [tax-forms, w-8ben-e, pdf-fill, field-map]
requires:
  - 06-10 (assets/forms, NS.taxmaps, NS.taxforms.fill, checks/form-maps.js)
provides:
  - NS.taxmaps['W-8BEN-E 2021-10'] (116 mapped, 62 unused in 25 groups by Part, 1 removed = 179)
  - checks/form-maps.js part W-8BEN-E; every page of every form checked
affects: [06-20, 06-21]
tech-stack:
  added: []
  patterns:
    - "unused fields grouped by the Part they lie in, with the Part proven from the printed form's own Part headers"
    - "table rows without their own printed label checked as the row under the anchored row, in the same column"
key-files:
  created: []
  modified:
    - assets/js/taxmaps.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/form-maps.js
decisions:
  - "Every chapter 3 and chapter 4 box of Part I is mapped and keyed by its printed status (plan 06-20 chooses which statuses the portal offers; the rest go to upload)"
  - "The W-8BEN-E caption goes in the free band under the printed signature label (page 8, y 695-702 from the top): directly under the signature field the form prints that label"
  - "Part II (disregarded entity or branch receiving payment) is unused: the portal fills the form for the entity itself"
metrics:
  duration: "22 min (base recorded 18:40:29 UTC, gate finished 19:02:02 UTC)"
  completed: 2026-11-15
actuals:
  tokens: 13450
  tasks: 2
  commits: 3
plan_head_before: 3d1997dded96d1f457b003a45c328f294fbba70a
plan_head_after: f2eeaf85db5d5e9a8081f7c32a32f3ea547d21c8
---

# Phase 6 Plan 12: W-8BEN-E map from its own 179 fields, five entity types filled and flattened

The W-8BEN-E map is written using only the bundled file's own field list. Every one of its 179 fields is accounted for: mapped, listed as unused with the Part it lies in and a reason, or removed before flattening. Eight sample entities fill and flatten to zero fields, and every value lands inside its own field on the right page. form-maps.js now checks every page of every form, not only page 1.

## Failures first

- **Found in Task 1: the check only looked at page 1.** form-maps.js read words, labels and ink from page 1 only. Run on the 8-page W-8BEN-E, it would have missed anything filled or changed on pages 2 to 8. Fixed: printed words, label anchors, filled-text placement, stray text, tick ink and the "nothing else changed" pixel comparison now run on every page. The W-9's 5 instruction pages are checked too. W-9 and W-8BEN still pass.
- **Found in Task 1: label text read out of order.** On the W-8BEN-E, words on one printed line differ in top by up to 0.2 pt, so sorting by top then left mixed two lines together (for example "6 Permanent Restricted residence distributor."). Fixed: the text above and under a field is now read line by line, in reading order. The W-9 and W-8BEN labels still match.
- **Found in Task 2: two of my own anchors were wrong on the first run** (Nonparticipating FFI wording, the 14a "within the meaning of the income tax" line ending). I corrected both against the printed words. The fields themselves were right.
- **Viewed images were briefly from a mutation run.** The first page images I opened for Task 2 came from the deliberate swap test: owner rows 2 and 3 had their TINs swapped, and the active-trade and discretionary boxes were swapped. The check failed on both swaps. A clean re-run regenerated the images, and on those every value is in its own place (viewed: treaty page 2, passive-owners page 8).
- Gate: no failure. GATE EXIT 0.

## Fields

| | Count |
|---|---|
| Fields in the file | 179 (66 text, 112 boxes, 1 signature) |
| Mapped | 116 (49 text, 67 boxes) |
| Unused, by Part with a reason | 62 in 25 groups |
| Removed before flattening | 1 (f8_30, the signature field) |

**Mapped:**
- Part I lines 1 to 10. This includes all 13 chapter 3 boxes and all 32 chapter 4 boxes, each keyed by its printed status and on-value, plus the hybrid yes/no, the addresses, U.S. TIN (max 11), GIIN, foreign TIN, 9c and reference (max 19).
- Part III: 14a box and country; 14b box, its 11 limitation-on-benefits boxes and the "other" text; 14c; line 15 article, rate, income type and 3 explanation lines.
- Part XXV: 39.
- Part XXVI: 40a, 40b and 40c.
- Part XXIX: 9 rows of name, address and TIN (max 11).
- Part XXX: capacity box and print name.

**Unused, each reason starting with its Part:**
- Part II, disregarded entity or branch receiving payment (9 fields). The portal fills the form for the entity itself.
- Parts IV to XXIV, XXVII and XXVIII (52 fields). None is a status the portal fills in; an investor in one of them uploads a completed form instead (plan 06-21).
- Part XXX's date field f8_32. The e-sign date overlay stamps the date at that rectangle.

**Overlays, page 8:**
- sign = f8_30's rectangle
- date = f8_32's rectangle, MM-DD-YYYY
- caption at y 695-702 from the top, under the printed signature label

## What form-maps.js proves for the W-8BEN-E (137 checks, every run)

- **Pins.** SHA256SUMS, the map and D-05 all equal the file's SHA-256.
- **Coverage.** The live field list matches the map in both directions, with no duplicates and no missing or extra names. It also equals the planner's listing. Kinds, MaxLen and on-values match the file.
- **Parts.** Part headers I to XXX are read from the blank form in order. Every unused reason starts with "Part N". Each listed field lies inside that Part on the printed page; a Part can run across pages, as Parts X and XV do.
- **Labels.** 91 printed-label anchors are checked; every chapter 4 box is matched against its whole label. Some fields have two anchors, such as the line number plus the Part numeral for 39 and 40a. Another 30 fields are checked as the row under an anchored one, in the same column: Part XXIX rows 2 to 9 by column, plus the address and explanation lines.
- **Mutation runs:**
  - Swapping Active/Passive NFFE and the residence/mailing streets fails on labels and on-values.
  - Swapping owner rows 2 and 3's TIN fields and two limitation-on-benefits boxes fails.
  - Moving a Part XXIV field into the Part XXII group fails with "lies in Part XXIV".
  - Putting f8_32 into another group also fails.
- **Refusals.** A copy with one byte changed is refused, and so is an unknown answer key.
- **Sample fills.** Each one flattens to zero fields, keeps every printed word on all 8 pages, has each value inside its own field and no text anywhere else, ink in ticked boxes and none in the others, and no other pixel changed on any page:
  - active-nffe: a Cayman corporation
  - passive-owners: a French SAS with two U.S. owners in Part XXIX rows 1 and 2
  - passive-none: a Singapore company with 40b ticked and Part XXIX empty
  - ffi-model1: GIIN 98Q96B.00000.LE.250
  - ffi-participating
  - ffi-model2
  - treaty: Germany, 14b with the active trade box, line 15
  - every-text-field: all 48 text fields of the map, including all 9 owner rows
- **Accents.** Accented names print exactly (Les Érables, Søren Kjær, Jürgen Weiß, Düsseldorf, Tomáš Dvořák, Nádražní).
- **Empty fill.** With every answer empty, the text equals the blank form's and zero fields are left.
- **Overlays:**
  - Sign and date equal the field rectangles on page 8.
  - The labels "Signature of individual authorized to sign for beneficial owner" and "Date (MM-DD-YYYY)" are printed just under them.
  - No overlay covers a printed word.
  - Only the signature label lies between sign and the caption.
- **Images.** Pages 1, 2, 7 and 8 of each fill are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-12/filled/. Viewed: active-nffe pages 1 and 8, treaty page 2, passive-owners page 8.

## Deviations from Plan

**1. [Rule 1 - Bug] form-maps.js checked page 1 only.** It now checks every page; details are under Failures first. The 8-page form needed this. Commit db65da7.

**2. [Rule 1 - Bug] Label text read out of line order.** Fixed by reading line by line. Commit db65da7.

**3. Caption under the printed label, not directly under the signature place.** Directly under f8_30 (y 684) the form prints the signature label (y 685.8-694). A caption there would cover printed words. It takes the free band just under that label (y 695-702, gap 11 pt). The generic "caption against sign" limit is 12 pt for this form only (spec.captionGap). A W-8BEN-E check proves that only that label lies between them.

**4. Rows without a printed label.** Part XXIX rows 2 to 9 have no words of their own. The check counts them as anchored when they are the row under an anchored field. The row check now also requires the same column, so a row or column swap fails.

**5. The anchor format was extended.** An anchor can now be several anchors, all of which must hold, and a "right" label can have a longer reach than 90 pt. These are needed for the long chapter 4 and Part III labels.

**6. The Part rule checks positions, not only names.** The plan asked that each reason name its Part. The check also proves from the blank form's own Part headers that every listed field lies in that Part.

**7. The full phase gate was run as well.** On the orchestrator's instruction, I ran the phase checks from plan 06-10's gate (pins, status math, status flow, server mode, two persons) as well as Task 2's verify command, which ran as written from a script file.

## TDD Gate Compliance (Task 2)

- RED: 5f9edf8 `test(06-12): ...(red)`. Its run exits 1 with FAIL: the temporary group from Task 1 has no Part, the new keys are not in the map, and 4 fills are refused. The output is in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-12/red-w8bene.txt.
- GREEN: f2eeaf8 `feat(06-12): ...`. FORM MAPS PASS (forms run: 3).

## Gate

The gate ran from /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-12/gate.sh and exited 0. Its last lines:

```
FORM MAPS: PASS (forms run: 3)
# pass 177 / # fail 0
MEASURE: PASS            (leak: 409 files, 462 commit messages)
PLAN VERIFY OK
fw8ben-2021-10.pdf: OK / fw8bene-2021-10.pdf: OK
STATUS MATH: PASS (cases run: 13)
STATUS FLOW: PASS (parts run: 26)
SERVER MODE: PASS (parts run: 8)
TWO PERSONS: PASS
signing base: 75 PASS 0 FAIL; plan: 75 PASS 0 FAIL
record base: 40 PASS 0 FAIL; plan: 40 PASS 0 FAIL
GATE EXIT 0
```

Task 1's verify gave `FORM MAPS: PASS (forms run: 1)`, and the tracer was re-verified end-to-end before expanding. server/node_modules was linked for the run, removed afterwards and never staged.

## Notes for plan 06-20

- Keys follow the printed statuses: `ch3Corporation`, `ch4ActiveNffe`, `ch4PassiveNffe`, `ch4ParticipatingFfi`, `ch4ReportingModel1Ffi`, `ch4ReportingModel2Ffi`, and so on. Part keys are `activeNffe`, `passiveNffe`, `passiveNoOwners`, `passiveOwnersListed`, `owner1Name` to `owner9Tin`, `treaty*` and `lob*`.
- fill() does not enforce "check one box only". The screen must offer one chapter 3 status and one chapter 4 status.
- The W-8BEN-E fields print in the form's own blue, like the W-8BEN.

## Self-Check: PASSED

- assets/js/taxmaps.js and checks/form-maps.js are modified, and both are present.
- Commits db65da7, 5f9edf8 and f2eeaf8 are on HEAD (git rev-list 3d1997d..HEAD = 3).
- There is no TODO, FIXME or placeholder in the map. No stubs.
