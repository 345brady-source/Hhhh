---
quick: "261114-picture-names"
phase: 01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo
plan: 261114-picture-names
subsystem: placement (picture pages)
tags: [picture-pages, caption-bands, field-names, scorer-gate, firm-use, heading-zone]
requires:
  - phase: 01.2 plans 03, 04 and quick 261114-scan-set-nobody
    provides: "bands(), boxField, fromPicture, checkBy, the scorer wrapper"
provides:
  - "NS.picturepage.attach: print between two stacked boxes goes to the nearer box"
  - "score.js gate `names` (also part of `full`)"
  - "placement.js FIRM_USE / FIRM_USE_PARTY: one phrase list for a block reserved for the firm's use, on text and picture pages"
  - "picturepage.bands heading zone (kind 'use'), textread heads kind 'use'; scanset.js measure of places for the firm's own use"
affects: [01.2 verification gap 1, 01.2 verification gap 2]
key-files:
  modified:
    - assets/js/picturepage.js
    - assets/js/textread.js
    - assets/js/placement.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/score.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/picture-fields.js
    - .planning/phases/01.2-agreements-that-are-pictures-the-reader-reads-the-owner-s-fo/checks/scanset.js
key-decisions:
  - "A caption between two stacked boxes belongs to the box whose edge is nearer (a tie goes to the lower box, whose caption stands over it), whichever band the reading first gave it to"
  - "Under a box, a line of print that mostly stands beside the box is not that box's caption"
  - "An under band that another box below reads as its over band is never this box's caption: the box is named Box and keeps its own mark"
  - "A block under a heading that reserves it for the firm (FIRM_USE) is nobody's who signs in the portal: asOther with the party 'Firm use' (optional, never the investor's, never filled in); the firm's own places stay the firm's"
  - "On a picture the heading zone reads only short lines set apart (a heading's shape), up to 120 pt over a place with 30 pt of clear paper above it, stopped at the nearest box or rule over it, once per block"
  - "The firm-use block runs down to the next heading of any kind (a label aside) or rule that divides sections; under the heading, or across the page from a heading set in its middle"
actuals:
  tokens: 11300    # chars/4 over the added lines of both tasks (16,528 + 28,693 chars)
  tasks: 2
  commits: 4       # git rev-list --count 29ee7e0..HEAD before this SUMMARY update (Task 1, first SUMMARY, Task 2) + this update
plan_head_before: 29ee7e03e57d97fbd008492fff0ad11d3483c954
plan_head_after: 9fd2ec4
duration: about 75 min (Task 1) + about 60 min (Task 2)
completed: 2026-11-14
status: complete
---

# Quick fix 261114-picture-names: no picture field carries another place's caption; a block for the firm's use is nobody's

**On the owner's form, no field now carries another place's caption. This was 9 to 13 fields from run to run (10 and 9 in the two base runs I judged again), and it is 0 in three runs. A new `names` gate in the scorer measures it and is part of `full`. The form stays at 241/241 with 0 strays, 0 overlaps, 0 kind differences and 0 owner differences. Task 2: binder page 66's two "For Partnership Use Only" blanks are now nobody's who signs: optional, not required, not the investor's. Before, both went to the investor and one was required. One phrase list covers text pages and picture pages. A bounded heading zone lets a picture see the heading about 100 pt above the block. The slowest page of the owner's form reads in 5.4 s on two runs, under 6 s.**

## Read first: what is still red, or not proved

1. **`bands.js --mode browser --doc form` is still red:** `BANDS browser: FAIL - initials neither on page 3, initials 1`. This is the same line as at the base, and the verifier judged it a gap in the check, not in the product. Neither task changes it.
2. **The made-up firm-use cases were not run on the old code.** They need the new phrase list to exist. Their failure on the old code follows from that, but I did not run them there. The page 66 measure was run on the old code and is red there (below).
3. **The binder now reads in 120.9 s through the dialog** (113.1 s in an earlier run of this task), for 71 pages: about 1.7 s a page. The binder's reading time before Task 2 was not recorded by any earlier run I can find, so I give no before figure.

## Gates, Task 2 (last lines verbatim, on commit 9fd2ec4)

| Gate | Result |
|------|--------|
| `score.js --only a,e --gate full,pictures,names` (run 1) | `GATE full,pictures,names: PASS` (241 of 241, strays 0, overlaps 0, kind 0, owner 0; names: another place's caption 0; reading 30.7 s) |
| same (run 2) | `GATE full,pictures,names: PASS` (reading 30.6 s) |
| `score.js --only a,b,c,d,e --gate full,speed,pictures,names` (final) | `GATE full,speed,pictures,names: PASS` (24 passed, 0 failed; example-scan 47, example-outlined 47; prose 0 and 0; part e 47) |
| `scanset.js --doc all --nobody` | `SCANSET: PASS`. Binder: `page 66: places for the firm's own use 2: the investor's 0, required 0, with no field 0`; places nobody completes 0 on 15 recorded pages. Booklet: 0 on 2 |
| the same page 66 measure on the Task 1 code (e29b0a9 source files put back for one run, then restored) | `SCANSET: FAIL - binder: page 66: of 2 places for the firm's own use 2 are the investor's, 1 required, 0 with no field` (red, as the verifier found) |
| `picture-fields.js` (all parts) | `PICTURE FIELDS: PASS`; marks left after 8 page confirmations: 27 (caption not read 25, owner in doubt 2), the same as after Task 1 |
| `earlier.js --proof 1,5 --nine` | `EARLIER: PASS` |
| `owner-set/measure.js --run A,C,proof1,proof5,proof7 --places B,Bvar` | `MEASURE: PASS`. Every number is the same as before Task 2: A 29 of 29 and C 138 of 138 give `RESULT: PASS` with 0 in every count; B `PLACES: PASS`; Bvar all ok |
| `bands.js --mode pure` | `BANDS pure: PASS` |
| `bands.js --mode browser --doc form`, two runs | `BANDS browser: FAIL - initials neither on page 3, initials 1` on both runs (the same known line). Page times, run 1 and run 2: p1 5.4 / 5.4 s, p2 5.1 / 5.2 s, p3 4.0 / 4.1 s, p4 3.5 / 3.5 s, p5 2.2 / 2.2 s, p6 2.4 / 2.4 s, p7 1.6 / 1.6 s, p8 1.4 / 1.4 s. No page reaches 6 s, so the speed rule does not stop Task 2 |

## Task 2: binder page 66, the firm's own-use blanks

**The class.** A block of places under a heading that reserves it for the firm or the partnership belongs to nobody who signs in the portal. Such headings say "for ... use only", "do not write below/beneath/under/in this", "office use", or "to be completed by the general partner/manager/managing member/fund/partnership/company/issuer/sponsor". The places get the shared owner `asOther` with the party `Firm use`: optional, never the investor's, never filled in from onboarding. The firm's own places in such a block stay the firm's. The phrase list is one regular expression, `FIRM_USE`, in `placement.js`, used by both paths.

- **Text pages (and line-rule proposals on pictures, whose read words are the page's glyphs).** A line of its own (no blank on it, not going on from the paragraph above it) that `FIRM_USE` holds is a firm-use heading. In the role loop, before a second investor's place is converted, a place it governs is set to the party `Firm use`. It governs down to the next heading of any kind (labels and the firm-use lines aside, footers aside) or rule that divides sections. A place falls under it when it stands under the heading, or anywhere across the page when the heading is set in the page's middle. The "to be completed by" reset of 01.3 no longer clears a firm-use place.
- **Picture pages (the zone).** `bands()` looks over every place (box or free rule) that has at least 30 pt of clear paper above it (`REACH.useNear`). It looks up to 120 pt above it (`REACH.useAbove`), never past the nearest found box or rule over it, across the width beside it (cut at boxes and rules to its left and right). Places whose zones share their rows read one zone, so the zone is read once per block. Only lines of words set apart are read: paper above and below of half a line, at most 60 % of the width (`REACH.useWide`), at most 3 (`REACH.useLines`), nearest first, never a line a strip already reads. A scan's specks are no line: a line is the widest run of print whose pieces part by at most a word gap. `textread.page` gives these as `heads` of kind `use`.
- **Picture boxes.** `firmUse(pg, made)` runs after `owners()`. A box under a `use` head whose words `FIRM_USE` holds is `asOther` with the party `Firm use`, named "Firm use: <caption>", when the head stands under-and-over it or is set in the page's middle, and no other heading stands between. The firm's own boxes are left as they are.

**Proof on made-up pages** (`picture-fields.js shapes`, each beside its control):
- a text page, "For Partnership Use Only" over two blanks: `investor required prefilled, other:Firm use, other:Firm use`. The blank above the heading stays the investor's, and the two under it are optional and not filled in. "Do not write below this point" gives the same. **Control:** an ordinary heading over the same blanks gives `investor required prefilled, investor required, investor prefilled`;
- a picture, a "For Office Use Only" head over two boxes: `investor, other:Firm use, other:Firm use`. **Control:** an ordinary heading gives `investor, investor, investor`;
- the zone on a made-up picture: a short line set apart over a block of two blanks is read once (one zone, rows 188 to 198). Two lines of running text across the page give no zone.

**Owner's form:** no zone line is read as firm use. Owners and kinds are unchanged (0 and 0), names are unchanged, and the 21 third-party places and 52 co-investor places are as before. The zone costs about 0.4 s on page 1 (5.0 to 5.4 s) and 0.2 to 0.3 s on page 2 (4.9 to 5.1 to 5.2 s).

**On the binder,** the zone also reads a few short lines on page 66 below the block (the "By:" lines of the firm's signature block, "Witness:"). These become words the text rules see. The scan-set gates stay green with them: 0 fields on places nobody completes, every field on a found place, all marked.

## Task 1 (merged before as e29b0a9): what stands

**Task 1 gates (last lines verbatim, on commit e29b0a9):**

| Gate | Result |
|------|--------|
| `score.js --only a,e --gate full,pictures,names` (run 1) | `GATE full,pictures,names: PASS` (241 of 241, strays 0, overlaps 0, kind 0, owner 0, reading 29.9 s) |
| same (run 2) | `GATE full,pictures,names: PASS` (reading 30.5 s) |
| `score.js --only a,b,c,d,e --gate full,speed,pictures,names` | `GATE full,speed,pictures,names: PASS` (24 passed, 0 failed) |
| `score.js` gate `names` on the base code's runs (judged again from their `fields.json`) | `GATE names: FAIL - 10 fields are named with another place's caption (p1/tickbox 1, p1/blank 1, p2/blank 5, p5/blank 3)`. After the small-word refinement: 9 (p1/blank 1, p2/blank 5, p5/blank 3) on both base runs |
| `picture-fields.js` (all parts) | `PICTURE FIELDS: PASS` |
| `picture-fields.js --only shapes` on the base code with the new cases | `PICTURE FIELDS: FAIL`: the three new name cases fail (red), all others pass |
| `scanset.js --doc all --nobody` | `SCANSET: PASS` |
| `earlier.js --proof 1,5 --nine` | `EARLIER: PASS` |
| `owner-set/measure.js --run A,C,proof1,proof5,proof7 --places B,Bvar` | `MEASURE: PASS` |
| `bands.js --mode browser --doc form` | `BANDS browser: FAIL - initials neither on page 3, initials 1` (the same as the base); page times p1 5.0 s, p2 4.9 s |

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

**Page timings after Task 1** (`bands.js` browser run on e29b0a9; after Task 2 see the gates above): page 1 5.0 s, page 2 4.9 s, page 3 3.8 s, page 4 3.5 s, page 5 2.3 s, page 6 2.3 s, page 7 1.5 s, page 8 1.3 s. All are under 6 s. Through the dialog the whole form reads in 29.9 s to 32.2 s.

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

- `assets/js/picturepage.js`: added `attach`, exported on the api (Task 1). Edited `bands()` → `upDown` (Task 1: one rule, box under bands only). Also edited in `bands()` (Task 2): the heading zone (`useZones`, `lineIn`, zones of kind `use`) and four `REACH` entries (`useNear`, `useAbove`, `useLines`, `useWide`), with the doc comment for zones. `find`, `near` and every other band are untouched.
- `assets/js/textread.js`: `page()`. Task 1 added one block before `bandsOf` that calls `NS.picturepage.attach`. Task 2 added zones of kind `use` given as `heads` of kind `use`, plus the doc comment.
- `assets/js/placement.js`: `boxField` (Task 1: the `below` / `theirs` guard inside `band()`; constant `MEET`). Added in Task 2: constants `FIRM_USE` and `FIRM_USE_PARTY`, and function `firmUse(pg, made)`. Edited in Task 2: `pageFields` section 6 (the `firmUses` list collected in the headings loop, `usedBy`, the firm-use line in the role loop before `coInvestor`, and `!m.firmUse` on the "to be completed by" reset), and `fromPicture` (calls `firmUse` after `owners`). `owners`, `asOther` and `checkBy` are untouched.
- `checks/score.js`: gate `names` (`nameCheck`), added to `KNOWN` and `GATE_PART`, and run by `full`.
- `checks/picture-fields.js`: Task 1 added three CASES and two `shapes` lines. Task 2 added six `shapes` lines (text page, text page "do not write below", text control, picture, picture control, zone).
- `checks/scanset.js`: the measure of places for the firm's own use, read from `<scratch>/public-agreements/scanset-firmuse.json` (or `SCANSET_FIRMUSE`), part of the `--nobody` gate, and the doc comment. The record of page 66's two places is outside the repository.

## Deviations from Plan

1. **[Rule 1 - Bug] (Task 1) The cause was the page reader's attribution of words, not only `boxField`'s caption order.** The fix belongs where the words are attributed (`attach` in picturepage.js, called by textread.js). The plan's `boxField` rule is kept as well, for print read twice.
2. **[Rule 1 - Bug] (Task 1) Page 1's custodian panel was named by a section heading under it,** which is not another box's over band. The plan's rule alone did not cover it, so I added the "line under a box mostly beside it" rule in `bands()`. `bands.js` itself is untouched and its pure cases pass.
3. **(Task 1) The scorer cuts the spoken name at 300 characters.** For somebody else's shape-named fields, the `names` gate cannot see the reason in `fields.json`, so they are counted apart and the page check proves their mark.
4. **(Task 2) The firm-use rule leaves the firm's own places as the firm's.** The plan says such a block belongs to nobody who signs. A place the firm completes and signs in the portal (its acceptance, its signature) is the firm's in the portal, so only places that would otherwise be the investor's or the co-investor's become `Firm use`.
5. **(Task 2) The page 66 places are recorded outside the repository** (`scanset-firmuse.json`, beside `scanset-nobody.json`), so no document coordinates enter the repository's code.
6. **(Task 2) The zone's line test ignores a scan's specks.** A line is the widest run of print whose pieces part by a word gap. On the binder, the first version found no line at all because specks widened every row.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: commits e29b0a9 (Task 1), 5e752cb (first summary) and 9fd2ec4 (Task 2) on this branch since 29ee7e0. `git status` was clean before this update. The temporary old-code run put back e29b0a9's three source files and restored them with `git checkout` on those files only.
- FOUND: `FIRM_USE` is defined once in placement.js and used by `pageFields` and `firmUse`; `useNear`, `useAbove`, `useLines`, `useWide` are in `REACH`; heads of kind `use` are in textread.js.
- No document text, name or picture is in the repository or in this summary. Places are given by page and kind. The phrase list holds general words of forms, none taken from one document only.
