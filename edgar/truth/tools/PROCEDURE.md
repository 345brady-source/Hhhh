# Writing a full answer sheet (Phase 01.4, D-04, D-22)

Format and rules: `SCRATCH/edgar/truth/BRIEF.md`. Scratch only: no sheet, overlay, crop or note is ever committed,
and no text, name or number from a document goes into the repository, a commit message or a SUMMARY.

`T=SCRATCH/edgar/truth/tools`; run every tool as `python3 -I $T/<tool> ...`.

## Per document

1. **Pre-fill.** `prefill_sheet.py --id <id>` (train) or `--id <id> --mode B` (held-out B only; candidates only).
   Prints places and how many carry a doubt. Held-out A ids are refused; nothing of them is ever opened.
2. **Contact sheet.** `overlay.py --id <id> --contact` and look at `truth/<id>/contact.png`: which pages have form
   content, whether any page with places has no box at all, picture pages (`page_kinds` in the sheet).
3. **Every page with places, at full size.** `overlay.py --id <id> --cands` writes `truth-overlay-pNN.png` (100 dpi;
   grey = measure candidates nobody placed). Look at each one, with `sheet_edit.py --id <id> list --page N` beside it.
   For small boxes or dense rows: `overlay.py --id <id> --page N --crop x0,y0,x1,y1` (200 dpi crop of that region).
   Also look at every page the contact sheet shows with form content but no box (a missed place).
4. **Correct**, page by page, deciding from the printed page only (never from what the reader did):
   - not a place (decoration, underlined heading, filled-in or bracketed issuer text, a frame) -> `del <placeId>`;
   - a place missing -> `add <page> x0 y0 x1 y1 <kind> <owner> --what W --label "..." --printed "..." [--must] --snap`
     (read the coordinates off the overlay: pixel / 100 * 72 = points; `--snap` moves the box onto the printed
     evidence within 6 pt: underscore run or rule with its 14 pt writing room, drawn rectangle, box glyph, widget,
     measure candidate; on picture pages the strokes in the picture's own pixels);
   - kind, owner, what, label, must wrong -> `set <placeId> kind=tickbox owner=co-investor what=name label="..." printed_label="..." must=true`;
   - box off its printed place -> `snap <placeId>` or `set <placeId> x0=.. y0=.. x1=.. y1=..`;
   - every pre-fill doubt ("candidate only", "check", "field only") is resolved: `set <placeId> doubt=` once decided,
     or a real doubt in words (`doubt="split by page break"`, `doubt="executed copy"`, `doubt="owner: issuer or dealer"`).
   - `printed_label` = the document's own short caption words (as printed, trimmed), empty when none is printed.
5. **Executed copies.** The printed place still counts; mark it `doubt="executed copy"`. Never copy a name, signature,
   address, number or email that was written in. `check_sheet.py` rejects an email-shaped string or a social security
   number anywhere in the sheet.
6. **Sheet facts.** `meta signing.kind="who signs this document" signing.third_parties=custodian,broker-dealer
   sure.<page>="sure | why not" not.<page>="what must not get a field"` (one `not.` per item, appended).
7. **Done.** `sheet_edit.py --id <id> done`: removes `draft`, recounts, runs `check_sheet.py` (refuses on any failure),
   draws overlays and the contact sheet, writes `truth.md`, records the sha256 in `truth/sheet-hashes.json`. On a B
   sheet it then seals the sheet, its folder and the document's PDF and source files. Look at the final overlays once.
8. **Record the cost.** `sheet_edit.py --id <id> stats` gives places and edits (added, deleted, changed).

## When unsure

- Whose a place is cannot be told from the page: `owner=unclear` with a `doubt` saying between whom. Never a guess.
- Whether something is a place at all: decide from the printed page; if still unsure, keep it with a `doubt` in words.
- `date` is a kind only beside a signature; any other date is `kind=blank what=date`.

## Changing a done sheet

Only after a second look at the document, never to fit the reader: every command on a done sheet needs
`--why "<what the page shows>"`; the reason, the old and the new hash go to `truth/sheet-reasons.txt`. A done sheet
whose hash no longer matches `sheet-hashes.json` fails `check_sheet.py`.

## Checks

`check_sheet.py --id <id>`, `--batch TR01 [--done-only] [--complete] [--part i/n]`, `--all` (train sheets only).

## Faster ways (learned on the first two sheets)

- **Batch the edits.** Write one command per line into a file (outside the repository) and run
  `run_edits.py <id> <file>`: one call per page instead of one per place. Lines are the same as the
  `sheet_edit.py` commands without `--id`.
- **Picture pages have no caption words**, so the pre-fill labels are empty: crop each page in two halves at 150 dpi
  (`--crop 60,60,560,400 --dpi 150`; about 500 x 340 pt, readable) and read the captions there. A crop pixel is
  `x0 + px * 72 / dpi` points (and the same for y).
- **Row-cell forms** (caption printed small at the foot of a row between two rules; several captions on one row):
  each caption's stretch of the row is one place, split where the next caption starts. Read the rule positions
  once per page off the crop and add the cells with exact coordinates; `--snap` on a picture page then moves a
  writing room onto the stroke under it (or each edge of a box onto its drawn line). Check the first snapped
  row on a crop: a snap can grab a full-width rule; set the coordinates by hand then.
- **The measure misses short lines on pictures** ("State of: ____", "Specify ____", a lone pair of Initials boxes,
  the co-signer's row): look along every caption that ends in a colon or sits over a rule.
- `sheet_edit.py stats` reports places added, deleted and changed against the pre-fill (kind, owner, box).

## Cost per document (measured on TR01, 2026-11-15)

Tokens are estimates from the work done (pictures looked at, commands written, outputs read), not a counter.
Minutes are wall clock from the edit logs (pre-fill to done).

| doc | how made | pages / with places | pre-fill places | done places | added | deleted | kind changed | owner changed | box moved | tokens (approx.) | minutes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b016 | browser print, text | 12 / 4 | 92 (reader 90 fields) | 92 | 0 | 0 | 33 | 32 | 0 | 25k | 5 |
| b108 | pictures printed | 15 / 7 | 140 (no reader field) | 189 | 61 | 12 | 57 | 37 | 3 | 60k (6k of it a fix to the picture snap) | 13 |

Text documents with reader fields: mostly label, kind (short check lines are tick boxes) and person (joint
column = co-investor) corrections; boxes were right. Picture documents: every label is read from crops, and a
third of the places had to be added by hand (row cells, short lines, a missed pair of Initials). Budget about
25k tokens for a text document and 60k for a picture document of this size.
