---
phase: 01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo
plan: 261114-picture-field-edges
subsystem: document-reading
tags: [picture-pages, box-finder, field-geometry, playwright-checks]

requires:
  - phase: 01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo
    provides: "plan 01's finder (found = the frame's outer edge, one pixel of stroke round the paper inside); plan 07's proof that found the fields inside the printed boxes"
provides:
  - "NS.picturepage.find: every box carries outer, the outer edge of its frame's ink (past found where a stroke is wider than a pixel or falls between two, at most 1.5 pt, never into another box)"
  - "NS.textread.page: found[].outer in points"
  - "NS.placement boxField: a box's field (blank, initials, signature, date, tick box) is the outer ink edge, no longer 0.5 pt inside the frame"
  - "checks/picture-fields.js part edges, and three made-up picture cases in shapes"
affects: [01.2, 01.3]

actuals:
  tokens: 5500
  tasks: 2
  commits: 2
plan_head_before: 3cafd6eedb84ae832e09e16193c113d564efc430
plan_head_after: 7c7cc8106077347d938a8cc01c6da2a8128f3f49

tech-stack:
  added: []
  patterns:
    - "A field's rectangle comes from the ink of its place (outer); every decision about the place (kind, owner, captions, bands, overlaps of places) stays on the frame (found)"

key-files:
  created:
    - .planning/quick/261114-picture-field-edges/261114-SUMMARY.md
  modified:
    - assets/js/picturepage.js
    - assets/js/textread.js
    - assets/js/placement.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/picture-fields.js

key-decisions:
  - "The field is built from the frame's outer INK edge (new found.outer), not from found: on the owner's form the printed stroke is wider than the one pixel the finder assumes, and the pixel past found carries 16 to 24% of the print range on average (up to 70%) on all four sides of the 176 roomy boxes"
  - "found itself is unchanged, so no reading decision, caption band or answer-sheet comparison moves; only the field's rectangle uses outer"
  - "Outer stops where its side would reach into another box: decided first against the other boxes' frames, then against their outer edges, so touching boxes never come to share more than their frames do"
  - "Tick boxes get the same rule (a class rule for every boxed place): their frames also leave ink past found (mean 0.09 to 0.18 of the range)"

patterns-established:
  - "Class rule plus made-up page: the outer ink edge is proved on a picture drawn inside picture-fields.js (a two-pixel stroke, a stroke between two pixels, a one-pixel stroke, two boxes sharing a wall)"

requirements-completed: []

coverage:
  - id: D1
    description: "Every boxed field on the owner's form, tick boxes apart, covers its printed box's outer ink edge on all four sides (inset <= 0 against the finder's outer, never more than 1.5 pt outside the frame); no two fields overlap by more than 0.5 pt. Fails on the code as it was (0 of 176, every side 0.50 pt inside)"
    verification:
      - kind: e2e
        ref: "node .planning/phases/01.2-.../checks/picture-fields.js --only all (part edges)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner's form stays at 241 of 241, 0 strays, 0 overlaps, 0 kind and 0 owner differences, editor pictures present; the normal example untouched"
    verification:
      - kind: e2e
        ref: "node .planning/phases/01.2-.../checks/score.js --only a,e --gate full,pictures (two runs on the final commit)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The editor pictures of pages 4, 5, 7 and 8 no longer show the printed box's frame beside the fields"
    verification:
      - kind: automated_ui
        ref: "SCRATCH/q261114/run3/printed/editor-p04..p08.png; SCRATCH/q261114/halo.py (ink beside fields counted in the editor pictures)"
        status: pass
    human_judgment: true
    rationale: "The owner judges whether the fields look finished; a thin remnant of anti-aliased print and the square printed corners outside the rounded field corners remain on some boxes (see Owner check)"

duration: 31min
completed: 2026-11-14
status: complete
---

# Quick fix 261114: a field read from a picture covers its printed box, ink included

**Every boxed field on a page read from its picture is now built from the printed frame's outer ink edge, which the finder measures from the page picture's own pixels. Fields no longer sit 0.5 pt inside the frame. On the owner's form all 176 boxed fields cover their box's ink on all four sides, and every gate stays green.**

## Gates at the final commit (7c7cc81), last lines verbatim

| Gate | Result |
|------|--------|
| `checks/picture-fields.js --only edges` on the code as it was (b11556a, before the fix) | `PICTURE FIELDS: FAIL - edges every boxed field covers its printed box's outer ink edge (0 of 176` (every side 0.50 pt inside) |
| `checks/picture-fields.js --only all` | `PICTURE FIELDS: PASS` (105 PASS lines; edges: 176 of 176, 168 of them with ink past the frame's edge, largest inset from the ink's edge 0.00 pt on every side; 0 overlaps over 0.5 pt; confirm: every page confirmation, undo, 390 wide and save pass) |
| `checks/score.js --only a,e --gate full,pictures`, run 1 | `GATE full,pictures: PASS` (241 of 241, strays 0, overlaps 0, kind 0, owner 0; reading 30.6 s) |
| `checks/score.js --only a,e --gate full,pictures`, run 2 | `GATE full,pictures: PASS` (241 of 241, strays 0, overlaps 0, kind 0, owner 0; reading 31.0 s) |
| `checks/scanset.js --doc all --nobody` | `SCANSET: PASS` |
| `checks/earlier.js --proof 1,5 --nine` | `EARLIER: PASS` (proof steps 1,5: 22 passed, 0 failed; all nine checks pass) |
| `checks/finder.js --mode pixels --doc all` | `FINDER pixels: PASS` |
| `checks/finder.js --mode browser --doc form` | `FINDER browser: PASS` (241 of 241, false boxes 0) |

The scorer's edge distance to the answer sheet moved from a median of 0.0 pt to 0.6 pt. This is expected: the answer sheet follows the frame's edge, and the fields now reach the ink's edge. `checks/all.js` was not run as a whole. It is not among this plan's gates, and its known red `bands-browser` step (page 3 initials box) reads `found`, which this fix does not change.

## Where the inset came from

- `NS.placement` `boxField` built a typed blank, initials, signature or date field at `found + 0.5 pt` on every side, `w - 1` by `h - 1`. That is exactly the 0.5 pt the edges measure found on all 176 boxes.
- Removing that inset was not enough. `found` is the paper inside the box grown by one pixel, which assumes a one-pixel stroke. On the owner's form the stroke is wider or falls between two pixels. Measured in the page pictures' own pixels: the pixel just past `found` carries on average 0.24, 0.18, 0.18 and 0.16 of the print range (left, top, right, bottom), on 60, 36, 31 and 39 of the 176 boxes at least 0.25, while the next pixel out is paper (about 0.01). Past the new outer edge, the next pixel is paper on every side of every box (0.015 to 0.022 on average, no box at 0.25).

## Functions changed

- `assets/js/picturepage.js`
  - `find` → `boxOf`: computes `outer`. From the frame's rectangle, each side goes out one pixel at a time while the side's next row or column is still ink (mean at least half the stroke level `tau`). Past the first pixel it goes on only while the next row or column is no darker than the one before. It never goes more than 1.5 pt.
  - `find`: after the "a box that holds another box" filter, `takeBack` returns any side of `outer` that would reach into another box to the frame's edge. It runs twice, first against the other boxes' frames, then against their outer edges.
  - The header documents `outer`.
- `assets/js/textread.js` `page`: `found[]` carries `outer` in points (`toPt(r.outer || r)`; a page of drawings has no outer and gets the frame). The header documents it.
- `assets/js/placement.js` `boxField`: the field's rectangle is `b.outer` when present, otherwise the frame. This applies to tick boxes and to every other box. Kind, name and owner are still decided on the frame.
- `checks/picture-fields.js`:
  - New `finderBoxes`: the finder's own boxes of every page, with words off, in the same browser page.
  - New `edges`, the measure.
  - `shapes` gains three cases: the outer ink edge on a made-up picture (a two-pixel stroke, a stroke between two pixels, a one-pixel stroke); two boxes sharing a wall; and the field on a box with and without `outer`.
  - The part list, header and run are updated.

## Task Commits

1. **The measure, failing on the code as it was** - `b11556a` (test)
2. **The fix** - `7c7cc81` (fix)

## Owner check: what the editor pictures show

Pictures: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/q261114/run3/printed/editor-p01.png` to `editor-p08.png`. Enlarged before and after crops: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/q261114/before-after-5-7-8.png` (pages 5, 7 and 8; before on the left) and `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/q261114/p04-before-after.png` (page 4).

- **Pages 7 and 8, initials columns:** before, a grey printed rectangle stood around every field, darkest at both ends. After, the field covers the frame along all four sides. At most a speck of the printed square corner shows outside the field's rounded corner.
- **Page 5, address blanks:** before, the frame's top and ends showed beside the field. After, they are covered.
- **Page 4, initials columns:** the co-investor column is now covered at both ends. In the investor column a thin dark sliver, about 1 to 2 screen pixels, still shows at the right end of each box. The geometry is right there: at the PDF's own resolution the box's ink ends at 457.375 pt and the field ends at 457.39 pt. The sliver comes from how the editor draws. The 107 ppi picture is rendered smoothed at about 2.1 px/pt, which spreads the stroke's edge a little past the ink, and the field's 1 px edge line is drawn inside its rectangle.
- **Counted in the editor pictures:** printed ink showing within 2 px outside the boxed fields (grey pixels darker than 170, middle 80% of each side; script `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/q261114/halo.py`). Before (plan 07's pictures, the base code): 11,587 px beside 78 of 180 boxed fields. After: 1,225 px beside 37. By page:

  | Page | Before (px) | After (px) |
  |------|-------------|------------|
  | 4 | 2582 | 293 |
  | 5 | 142 | 74 |
  | 7 | 5686 | 505 |
  | 8 | 3108 | 259 |

  Pages 1 to 3 and 6 had little before and have little after. The remainder is the anti-aliased edge described for page 4, plus square printed corners outside rounded field corners.
- **Seen, not changed (outside this fix):** on page 8, a lone printed line with an initials caption under it has no field, before and after. The answer sheet does not count it as a place, so the scorer does not either. The owner may want to say whether it is a place.

If the owner wants no trace of the frame at all, two choices are open; this fix makes neither: a fixed outward margin on every picture field (for example 0.5 pt, still inside the 1.5 pt the plan allows), or drawing the field's edge line outside its rectangle in `esign.css`. Both are design decisions for the owner. The second would touch the 01.1 UI-SPEC field look.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The finder's `found` is not the outer ink edge on a picture whose strokes are wider than a pixel**
- **Found during:** the visual check after removing the 0.5 pt inset. Printed ink still showed past the field on 168 of 176 boxes.
- **Fix:** added `outer` in `find` and used it for the field's rectangle, leaving `found` and every decision on it unchanged. Proved on a made-up picture and on the owner's form.
- **Files modified:** `assets/js/picturepage.js`, `assets/js/textread.js`, `assets/js/placement.js`
- **Commit:** `7c7cc81`

**2. [Rule 3 - Blocking] `assets/js/textread.js` is outside the plan's `files_modified`**
- **Issue:** `found` is built field by field in `NS.textread.page`, so the finder's `outer` cannot reach placement without one added property there.
- **Fix:** one property on `found` (`outer`, in points) and two header lines. Nothing else in the file changed.
- **Commit:** `7c7cc81`

**3. Tick boxes also use `outer`.** The plan exempted tick boxes from the measure because they already covered `found`. Their frames also leave ink past `found` (0.09 to 0.18 of the range on average), and the rule is a class rule for every boxed place. The measure still checks roomy boxes as the plan specifies. A `shapes` case checks the tick box field.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: assets/js/picturepage.js, assets/js/textread.js, assets/js/placement.js, checks/picture-fields.js (modified)
- FOUND: b11556a, 7c7cc81 (ancestors of HEAD)
