---
phase: 01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo
plan: 261114-scan-set-nobody
subsystem: picture-reading
tags: [scan-set, places-nobody-completes, pixels, table-edge, footnote-rule, answered-line, caption-band]

requires:
  - phase: 01.2 plan 06
    provides: "scanset.js --nobody, the record of places nobody completes, the three earlier scan-set class rules"
provides:
  - "assets/js/textread.js: four pixel readings of a picture page (hangs, printUnder, standsOn, joined), carried on lines (hang, under, joined) and found boxes (row)"
  - "assets/js/placement.js fromPicture: a frame's top edge, a footnote rule and a line answered by hand get no field; an empty row of a table gets no box field"
  - "assets/js/picturepage.js bands: a signature line's caption whose letters reach past the under band is read"
  - "checks/picture-fields.js shapes: nine new lines of made-up pictures and pages, each beside its control"
affects: [01.2-07, 01.3-07]

actuals:
  tokens: 6700     # chars/4 over the added lines of the realized diff (26,705 chars)
  tasks: 5         # five classes repaired, one stopped
  commits: 5       # git rev-list --count 9951a2a..HEAD before this SUMMARY commit
plan_head_before: 9951a2aa0af0da24bfe2ea79edc4fa4b36794c4c
plan_head_after: 3a3044e891b552e9adc92533d199886281ed72b8

tech-stack:
  added: []
  patterns:
    - "What a text rule reads from glyphs and their positions (a frame's corner, the print under a footnote rule, characters standing on a line) is read from the picture's pixels on picture pages only, as a flag on the stroke, and decided in fromPicture"

key-files:
  created: []
  modified:
    - assets/js/textread.js
    - assets/js/placement.js
    - assets/js/picturepage.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/picture-fields.js

key-decisions:
  - "A rule something hangs from (an upright stroke going down 10 pt or more from it and up 2 pt or less, at its ends or along it, after following a faint rule to its real ends) is the top edge of a frame, a table or a row of cells: one class covers the table edges, the rule under a heading cell and the top of a ticked box the finder did not take for a box"
  - "A footnote rule is told from a signature line by the print under it: a paragraph that runs on unbroken past the rule's end (by more than its length and 100 pt) under a short rule low on the page, in its left quarter, with nothing read before it. A signature line has a short caption. The booklet's two bare signature lines keep their fields"
  - "An empty box with no word by it is a row of a table when a wall stands on the middle of its top edge; the lines inside it keep their fields"
  - "A line is answered by hand when two strokes of writing or more touch it and reach 2.5 pt away, straight upright walls and the rule's ends left out"
  - "The first line under a free rule an inch long or more, starting within 6 pt of it and cut by the band's far edge, is taken whole (as under a long rule already)"
  - "Class 6b (the firm's 'For Partnership Use Only' blanks given to the investor) STOPPED: no words over those places are read, and the reader has no firm-use rule on any path (see Not done)"

requirements-completed: []

coverage:
  - id: D1
    description: "scanset.js --doc all --nobody: 0 fields on places nobody completes on all 17 recorded pages (binder 15, booklet 2); every field on a found place, marked, no overlap; booklet text pages unchanged"
    verification:
      - kind: e2e
        ref: "node checks/scanset.js --doc all --nobody --root <worktree>"
        status: pass
    human_judgment: true
    rationale: "The owner looks at the scan-set pictures (folder below) to judge that what is left is right"
  - id: D2
    description: "The owner's form 241/241, 0 strays, 0 overlaps, 0 kind and 0 owner differences after every change (11 scorer runs), page confirmation 33 marks left (31 + 2) as before"
    verification:
      - kind: e2e
        ref: "node checks/score.js --only a,b,c,d,e --gate full,speed,pictures; node checks/picture-fields.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Text pages untouched: proof 1 and 5, the nine check files, text scorers A, B, C at PLACES: PASS"
    verification:
      - kind: e2e
        ref: "node checks/earlier.js --proof 1,5 --nine; node SCRATCH/owner-set/measure.js --root <worktree> --places A,B,C"
        status: pass
    human_judgment: false

duration: 64 min
completed: 2026-11-14
status: complete
---

# Quick fix 261114: no field on a place nobody completes, on the two public scans

**On the scanned binder and the completed booklet, 0 fields remain on places nobody completes (13 removed: the 11 the record held, plus 2 on binder page 14 the record had missed). Four new pixel readings in textread.js and five class rules in fromPicture and the band reader do it: a frame's top edge, a footnote rule, an empty row of a table and a line answered by hand get no field. The booklet's individual signature lines are now signatures. One class is stopped: the binder's "For Partnership Use Only" blanks still go to the investor. The owner's form stays at 241/241 with 0 differences in 11 scorer runs, and text pages are untouched.**

## Read first (not done, and one record change)

1. **Class 6b stopped: the firm's "For Partnership Use Only" blanks (binder p66: the acceptance date and "Admitted Investor", the second required) are still given to the investor.** It cannot be fixed as a small local class rule. The heading that decides ("For Partnership Use Only", "Do not write below this point") stands about 100 pt above the first place. The picture reader reads no words that far away: bands reach 20 pt over a rule, a block heading 48 pt over a stack of three or more rules, and p66 has two. The reader has no firm-use rule on any path either; text pages have none, so this would be a new owner class for both paths. A repair needs:
   - a new reading zone for each picture page (more engine time, while the owner's form pages 1 and 2 read in 5.5 to 5.8 s against the 6 s target);
   - a firm-use phrase list in the shared owner (`asOther` with a firm party, nobody's required field).

   That is a decision for the orchestrator or the owner (Rule 4). Binder p65, which plan 05 also listed, holds no "Partnership Use Only" blanks today. Its fields are the witnessed signature block: the spouse's signature, the "By" Name and Title, and the witness's signature and typed name, all the investor's. Witness and spouse lines keep their marks, as the carry-forward rule says.
2. **The record now holds binder page 14.** `SCRATCH/public-agreements/scanset-nobody.json` gained 2 regions there: the rule under the "Additional Information for Individuals" heading cell, read as two blanks. This is the same class as p15's table edge, and the record had missed it. The class rule removed both. This only adds to the measure; nothing was loosened. The file as it was before is kept at `SCRATCH/exec-q1114/scanset-nobody.before-q1114.json`.
3. **TOLD: FAIL on text scorers A, B and C.** `measure.js --places A,B,C` ends `MEASURE: PASS`, with PLACES: PASS on all three. Each line also reads TOLD: FAIL. TOLD is not this plan's gate, and I did not measure it at the base. This plan's diff does not touch the text path: anchors.js and esign.js are untouched, and the placement.js edits are inside `fromPicture`, which runs only `if (pg.pictured)`.

## Gates (last lines verbatim, final code 3a3044e)

| Gate | Last line |
|------|-----------|
| `scanset.js --doc all --nobody --root <worktree>` | `SCANSET: PASS` (binder `fields on places nobody completes: 0 on 15 recorded pages`; booklet `0 on 2 recorded pages`; `pages with text: the 147 fields placed on upload are unchanged (17 pages)`) |
| `picture-fields.js` (all eight parts) | `PICTURE FIELDS: PASS` (100 lines PASS; confirm `marks left after 8 page confirmations: 33 (caption not read: 31, owner in doubt: 2)`) |
| `score.js --only a,b,c,d,e --gate full,speed,pictures` | `GATE full,speed,pictures: PASS` (24 passed, 0 failed) |
| `earlier.js --proof 1,5 --nine` | `EARLIER: PASS` (proof steps 1,5 22 passed; accuracy PASSED; labels 190/190, review 52/52, prefill 34/34, walk 20/20, editor 104/104, signatures 70/70, signing-step 76/76, record-check 40/40) |
| `measure.js --root <worktree> --places A,B,C` | `MEASURE: PASS` (A 29 of 29, B 2 of 2, C 138 of 138, PLACES: PASS, every measure 0) |
| `bands.js --mode pure` | `BANDS pure: PASS` |

**The owner's form was scored 11 times**: twice after each of the five commits, and once in the final run of parts a to e. Every run gave 241 of 241, 0 strays, 0 overlaps, kind differs 0, owner differs 0 and marked 241 of 241. The page 3 initials box held every time. Reading took 28.8 to 30.5 s.

## Scan set, by page (counts and kinds; pictures in SCRATCH/exec-q1114/scanset)

Binder: 296 → 287 fields. Every change was looked at on its picture:

| Page | Fields | What changed |
|------|--------|--------------|
| p7 | 12 → 10 | The table's top edge and the top of the ticked box lost their fields |
| p9 | 18 → 17 | The footnote rule lost its field |
| p14 | 5 → 3 | The rule under the heading cell (two pieces) lost its fields |
| p15 | 23 → 23 | Lost: the rule under the heading cell, and the box over the foot cell. Gained: the cell's two labelled lines ("Registered Address", "Briefly describe … Business") |
| p33 | 5 → 4 | The footnote rule lost its field |
| p35 | 11 → 10 | The footnote rule lost its field |
| p70 | 2 → 0 | The table's top edge (two faint pieces) lost its fields |

No other page changed.

Booklet: 161 → 159 fields. p41 went from 5 to 4 and p43 from 3 to 2: the answered date line lost its field. On p41 the two individual signature lines went from kind Text to signature, and on p43 its one line did the same. Text pages are unchanged at 147.

**No page lost a field on a place someone completes.** Every field that went is a region of the record.

**Still not measured, and not this plan's work:** completeness on the binder. Many empty blanks on pages 6 to 9 and 15 get no field. The third line in p15's foot cell is one. Labels on picture pages remain weak, for example "-", "Text", "v".

## Functions changed (for the hand merge with Phase 01.3 plan 07)

**assets/js/textread.js**
- New: `hangs`, `printUnder`, `standsOn`, `joined`, all placed before `said`.
- Edited in `page`: four lines after the `inBrackets` line set `r.hang`, `r.under`, `r.joined` (rules) and `b.row` (boxes), on picture pages only (`raw.picture`). In the `seen.boxes` loop, `out.found.push` carries `row`. In the `seen.rules` loop, `ln` carries `hang`, `under` and `joined`.
- Edited: the export line `NS.textread` (adds `hangs, printUnder, standsOn, joined`).

**assets/js/placement.js** (picture block only)
- Edited: `fromPicture` only. `edge` also takes `l.hang`. New local helpers `footRule` and `answered` join `edge` in the same filter loop. `emptyCell` also takes `b.row`.
- Not touched: `read()`, the text rules, `boxField`, `owners`, `asOther`, `coInvestor`, labels, and the export line.

**assets/js/picturepage.js**
- Edited: `bands` → its inner `upDown`, one condition. The first line under a rule at least 72 pt long, starting within 6 pt of the rule, is taken whole, as under a long rule.

**checks/picture-fields.js**
- Edited: `shapes` gains five new `page.evaluate` blocks (`hang`, `foot`, `row`, `hand`, `cap`) and their `line` checks: 9 new PASS lines in all.

**Not touched:** anchors.js, esign.js, scanset.js.

## Task Commits

1. `fe15cba` fix(01.2-261114): a rule something hangs from is a frame's top edge, not a line to write on (classes 1 and 4)
2. `d6905e2` fix(01.2-261114): the rule over footnotes on a picture is no line to write on (class 2)
3. `409bda3` fix(01.2-261114): a box with a wall standing on the middle of its top edge is a row of a table (class 3)
4. `8731fc8` fix(01.2-261114): a line answered by hand on a picture gets no field (class 5)
5. `3a3044e` fix(01.2-261114): a signature line's caption whose letters reach past its band is read (class 6a)

## Deviations from Plan

1. **[Measure tightened] binder p14 added to the record** (Read first 2).
2. **Booklet answered date line: two classes reach it.** The handwritten slashes of the date are straight strokes that hang from the rule, so the frame class removes the field too. Class 5 (`joined` = 2 on that line) was built and proved on its own, so the line is read as answered whatever the hand looks like.
3. **Class 6a was repaired in picturepage.js** (the band reader). It is listed in the plan's files_modified. Without the 1-inch limit, the rule's new under band had moved words, so that a blank on binder p15 became a checkbox. With the limit, the binder and the form are unchanged.
4. **Class 6b stopped** (Read first 1).
5. **Process:** commits are counted from the dispatch base 9951a2a. There is no plan-commit ledger file in a worktree.

## Threat Flags

None. No new endpoint, file access or trust boundary. The pixel readings read the page's own drawn picture only.

## Known Stubs

None.

## Scratch (outside the repository)

`SCRATCH/exec-q1114/` holds:
- `dumpgeo.js`: the picture reader's boxes, rules and fields for chosen pages in about 25 s, with hang, under, joined and row.
- `dbgbands.js`: the band parts.
- `cmp.js`, `diff.js`, `hang.js`, `under.js`, `capcase.js`.
- the dumps `b0` to `b9`.
- the final gate outputs `f-*.txt`.
- the scan-set pictures `scanset/`.

## Self-Check: PASSED

- FOUND commits fe15cba, d6905e2, 409bda3, 8731fc8, 3a3044e (all ancestors of HEAD, 5 since 9951a2a).
- FOUND modified files: assets/js/textread.js, assets/js/placement.js, assets/js/picturepage.js, checks/picture-fields.js.
- `git status --short` was empty before this SUMMARY. There is no .pdf, .png or other picture in the repository, and no word of the owner's documents in any committed file.
