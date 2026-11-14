---
quick: "261114-picture-names"
phase: 01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo
plan: 261114-picture-names
subsystem: placement (picture pages)
tags: [picture-pages, caption-bands, field-names, scorer-gate]
requires:
  - phase: 01.2 plans 03, 04 and quick 261114-scan-set-nobody
    provides: "bands(), boxField, fromPicture, checkBy, the scorer wrapper"
provides:
  - "NS.picturepage.attach: print between two stacked boxes goes to the nearer box"
  - "score.js gate `names` (also part of `full`)"
affects: [01.2 verification gap 1]
key-files:
  modified:
    - assets/js/picturepage.js
    - assets/js/textread.js
    - assets/js/placement.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/score.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/picture-fields.js
key-decisions:
  - "A caption between two stacked boxes belongs to the box whose edge is nearer (a tie goes to the lower box, whose caption stands over it), whichever band the reading first gave it to"
  - "Under a box, a line of print that mostly stands beside the box is not that box's caption"
  - "An under band that another box below reads as its over band is never this box's caption: the box is named Box and keeps its own mark"
  - "Task 2 (binder page 66, firm-use blanks) NOT DONE: not started, for lack of time (see Not done)"
actuals:
  tokens: 4100     # chars/4 over the added lines of the realized diff (16,528 chars)
  tasks: 1         # of 2; Task 2 not started
  commits: 1       # git rev-list --count 29ee7e0..HEAD before this SUMMARY commit
plan_head_before: 29ee7e03e57d97fbd008492fff0ad11d3483c954
plan_head_after: e29b0a9
duration: about 75 min
completed: 2026-11-14
status: partial
---

# Quick fix 261114-picture-names: no picture field carries another place's caption (Task 1); binder page 66 (Task 2) not done

**On the owner's form, no field now carries another place's caption. This was 9 to 13 fields from run to run (10 and 9 in the two base runs I judged again), and it is 0 in three runs. A new `names` gate in the scorer measures it and is part of `full`. The form stays at 241/241 with 0 strays, 0 overlaps, 0 kind differences and 0 owner differences. Task 2 (binder page 66, the firm-use blanks) was not started, so verification gap 2 is still open.**

## Read first: what is not done

1. **Task 2 is NOT DONE.** I did not start it. With Task 1 built and checked, the time aim (about 75 minutes) was used up. Task 2 adds a new class on both reading paths: the firm-use phrase list in `placement.js`, a firm-use owner through `asOther` on text pages and on picture pages, and a heading zone on picture pages that reaches up to 120 pt and is read once per block. It also needs its own proofs: made-up text and picture pages with controls, a `scanset.js` measure for binder page 66, and timing runs. Doing it in a hurry across two reading paths would have cut corners. A search confirms that no firm-use rule exists on any path today. The only firm words are `FIRM_WORDS` (placement.js line 148), and they decide nothing about "for ... use only". Binder page 66's two blanks still go to the investor, and the second is still required.
2. **`bands.js --mode browser --doc form` is still red:** `BANDS browser: FAIL - initials neither on page 3, initials 1`. This is the same line as at the base, and the verifier judged it a gap in the check, not in the product. This fix does not change it.

## Gates (last lines verbatim, on commit e29b0a9)

| Gate | Result |
|------|--------|
| `score.js --only a,e --gate full,pictures,names` (run 1) | `GATE full,pictures,names: PASS` (241 of 241, strays 0, overlaps 0, kind 0, owner 0, reading 29.9 s) |
| same (run 2) | `GATE full,pictures,names: PASS` (reading 30.5 s) |
| `score.js --only a,b,c,d,e --gate full,speed,pictures,names` (final) | `GATE full,speed,pictures,names: PASS` (24 passed, 0 failed; example-scan 47, example-outlined 47, 0 differences, 0 strays; prose 0 and 0) |
| `score.js` gate `names` on the base code's runs (judged again from their `fields.json`) | `GATE names: FAIL - 10 fields are named with another place's caption (p1/tickbox 1, p1/blank 1, p2/blank 5, p5/blank 3)`. After the small-word refinement: 9 (p1/blank 1, p2/blank 5, p5/blank 3) on both base runs |
| `picture-fields.js` (all parts, page confirmation included) | `PICTURE FIELDS: PASS` |
| `picture-fields.js --only shapes` on the base code with the new cases | `PICTURE FIELDS: FAIL`: the three new name cases fail (red), all others pass |
| `scanset.js --doc all --nobody` | `SCANSET: PASS` |
| `earlier.js --proof 1,5 --nine` | `EARLIER: PASS` |
| `owner-set/measure.js --run A,C,proof1,proof5,proof7 --places B,Bvar` | `MEASURE: PASS` (A and C `RESULT: PASS`, 0 in every count; B `PLACES: PASS`, as before; Bvar all ok) |
| `bands.js --mode pure` | `BANDS pure: PASS` |
| `bands.js --mode browser --doc form` | `BANDS browser: FAIL - initials neither on page 3, initials 1` (the same as the base) |

## Names: before and after (owner's form, page and kind only)

| | Before (base run, `names` gate) | After (three runs) |
|---|---|---|
| Another place's caption | 9 to 10 (page 1: the custodian's panel; page 2: 5 blanks; page 5: 3 to 4 adviser blanks). The verifier counted 13 on its run | **0** |
| Own caption | 106 | 119 to 120 |
| Kind's word (Initials, Signature, Date on a field of that kind) | 68 | 68 |
| Shape name with its own mark | 24 + 7 (somebody else's) | 14 + 10 to 11 (somebody else's) |
| Own caption misread past the tolerance (shown, not failed) | 25 | 25 to 26 |

The verifier's script (`SCRATCH/v-names.js`) on the final run finds 1 "another place's caption": a middle-initial blank on page 2 whose own caption was misread by one letter. That script compares letter fragments, so the misread matches the letters "me" inside another place's "NAME". The `names` gate compares whole words within the band reader's tolerance and counts this field as its own caption misread.

**Marks left after 8 page confirmations: 27** (caption not read 25, owner in doubt 2). It was 33. Fewer boxes now lack their own caption, because the caption over each box is no longer taken by the box above it.

**Page timings** (`bands.js` browser run on the final code): page 1 5.0 s, page 2 4.9 s, page 3 3.8 s, page 4 3.5 s, page 5 2.3 s, page 6 2.3 s, page 7 1.5 s, page 8 1.3 s. All are under 6 s. Through the dialog the whole form reads in 29.9 s to 32.2 s.

## The cause, and the class rules

The cause is in the page reader, not only in `boxField`. When the under band of a box and the over band of the box below it overlap, they are one strip. Each word read in a strip goes to the first part that holds its centre, and the upper box's under part comes first. So the caption printed over a box was given to the box above it. That box, with its over band now empty, fell to its own under band, which held the next row's caption. This cascade explains every case of gap 1.

1. **`picturepage.attach(parts, heard, boxes)` (new, pure).** When the print between two stacked boxes is read for both bands, it goes to one of them. The words are grouped into blocks of lines, and each block goes to the box whose edge is nearer. A tie goes to the lower box, whose caption stands over it. The block is taken out of the other band. This works the same whether the two bands were one strip or two readings. `textread.page` calls it once on every page before the bands are attached. It costs no reading time.
2. **`bands()` (picturepage.js, inside `upDown`).** Under a box, a line of print most of which stands beside the box is not a caption of that box. This covers a section heading that runs in under a panel, which named page 1's custodian panel. That panel is now "Custodian: Box", with its own mark.
3. **`boxField` (placement.js).** An under band whose letters are read as the over band of a found box below it (the two bands meet within `MEET` = 24 pt) is never this box's caption. A box left with no caption of its own is named "Box", or by its kind's word through the existing rules, and gets `WHY_UNREAD` with `checkBy` 'field'. One page confirmation never takes that mark away.

Proved on made-up pages in `picture-fields.js shapes`, each red on the base code:
- the caption over the lower box, read for both boxes, leaves the upper box "Box", unread, checkBy 'field', and names the lower box. There are two controls: a caption under a box with no box close under it stays its own, and a box close above another keeps its own different caption under it;
- `attach` on made-up words covers four cases: the caption over the lower box given to the upper band, one caption each, a caption under the upper box read twice, and a caption midway;
- `bands` on a made-up picture: a line under a box that begins far to its left is not a caption, and a caption under the box is.

## The `names` gate (score.js)

It reads `printed/fields.json` from part a and the answer sheet. For each field matched to its place, it takes off the party prefix ("Co-investor: ", "<Party>: "). A shape name ("Box", "Tick box") must carry its own mark: a reason that its words could not be read or that its owner is in doubt. The kind's word on a field of that kind is accepted. Every other name is compared word by word with the labels of every place on its page, each word within `NS.picturepage.near`, ignoring small joining words and counting each word once. A name that matches another place's label better than its own, in at least half its words, fails the gate.

The scorer keeps only the first 300 characters of a spoken name. For somebody else's fields that cut can fall before the reason, so those are counted apart. `picture-fields.js confirm` proves on the page itself that they keep their own mark (27 marks left, confirmed one by one).

## Functions changed

- `assets/js/picturepage.js`: added `attach`, exported on the api. Edited `bands()` → `upDown` (one rule, box under bands only). `find`, `near`, `REACH` and every other band are untouched.
- `assets/js/textread.js`: `page()`: one block before `bandsOf` that calls `NS.picturepage.attach` on the box over and under parts in points.
- `assets/js/placement.js`: `boxField` (the `below` / `theirs` guard inside `band()`), and the new constant `MEET`. `fromPicture`, `owners`, `checkBy` and the text paths are untouched.
- `checks/score.js`: gate `names` (`nameCheck`), added to `KNOWN` and `GATE_PART`, and run by `full`. The doc comment was updated.
- `checks/picture-fields.js`: three new CASES and two new `shapes` lines (`attach`, a line under a box).

## Deviations from Plan

1. **[Rule 1 - Bug] The cause was the page reader's attribution of words, not only `boxField`'s caption order.** The fix belongs where the words are attributed (`attach` in picturepage.js, called by textread.js). The plan's `boxField` rule is kept as well, for print read twice.
2. **[Rule 1 - Bug] Page 1's custodian panel was named by a section heading under it, which is not another box's over band.** The plan's rule alone did not cover it, so I added the "line under a box mostly beside it" rule in `bands()`. `bands.js` itself is untouched and its pure cases pass.
3. **The scorer cuts the spoken name at 300 characters.** For somebody else's shape-named fields, the `names` gate cannot see the reason in `fields.json`, so they are counted apart and the page check proves their mark.
4. **Task 2 not started** (see Read first).

## Not done (Task 2), for the orchestrator

Still open: verification gap 2 (SC5 / READ-03), binder page 66. Design as planned: one phrase list in `placement.js`; an owner through `asOther` with the firm's-use party (optional, never prefilled) on both paths; on picture pages, a heading zone above each block of places, bounded to 120 pt and stopped at the next found box or rule, read once per block. The page budget leaves room on the owner's form: pages 1 and 2 now read in 5.0 s and 4.9 s, against 5.5 to 5.8 s before. It needs a fresh executor run of about an hour.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: commit e29b0a9 on this branch since 29ee7e0. The five modified files are in it, and `git status` was clean before this SUMMARY.
- No document text, name or picture is in the repository or in this summary. Places are given by page and kind.
