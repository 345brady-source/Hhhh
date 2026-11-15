# The measure (Phase 01.4, D-04)

Scores any subscription agreement PDF the way a sponsor meets it, with no answer sheet. Scratch only: nothing here
is in the repository and nothing here changes the portal.

## Run

```
cd /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/measure
NODE_PATH=$(npm root -g) node run.js --root /home/user/Hhhh --docs <folder | index.json | file.pdf> \
    [--only id,id] [--port 8971] [--out dir] [--pictures] [--limit 600] [--recycle 8] [--compare <older summary.json>]
node run.js --compare-only <older summary.json> <newer summary.json>
```

- `--docs`: a folder whose subfolders each hold `doc.pdf` (the id is the subfolder's name), a folder of PDFs (the id is
  the file name), an index (`{"docs":[{"id":..,"pdf":..}]}`, a list of the same, or `{"id": "path"}`), or one PDF.
  `calibration.json` here is the calibration set: the owner's picture form, d1 and the seven public documents.
- `--root`: the checkout to measure. It is served on `--port` (default 8971) and the server is stopped at the end.
- `--limit`: seconds a document may take, upload plus reading from pictures (default 600). A document over it is
  recorded as `timedOut`, what is on screen is still read, and the next document starts on a fresh tab.
- `--recycle`: a fresh tab and sign-in after this many documents (or 400 pages), so the browser's memory stays small.
  Between documents the session is reused: the last draft agreement and its stored file are taken away and the next
  PDF is uploaded through the same screen.
- `--pictures`: one `pictures/compare-pNN.png` per page (see below). Costs about half a second a page.
- `--compare`: prints, per document and in total, which checks got better and which got worse against an older run.

One browser, one tab. The candidate finder (Python) for a document runs while the browser reads it, and is cached
per PDF and per version of `measure.py` in `cache/`.

## What happens to each document

1. `measure.py candidates` reads the PDF on its own (pdfplumber for text and drawing, rendered pixels for pictures;
   nothing of the portal's reader is used) and lists the **printed candidate places** (below).
2. The portal: the sample firm's sponsor opens an offering, "Add the subscription agreement", chooses the PDF, presses
   "Continue to place fields" (the real dialog). When the editor shows "Read these pages from their picture", the
   runner records the offer and the summary shown before it, clicks it, and waits until no progress text is shown and
   the button is gone for one second (or the limit). Then every field is read from the editor (box in PDF points, kind,
   review mark, label) and joined with the draft as the workspace holds it (signer, required, someone else, co-investor,
   reason for the mark), with the summary sentences, the toasts, the reader's own `read` record and every browser
   console error and page error raised during that document.
3. `measure.py check` scores the fields against the candidates and draws the pictures.

Outputs: `<out>/<id>/result.json` (everything above, checks listed by page), `fields.json`, `checks.json`,
`editor-window.png` (or `not-opened.png`), `pictures/compare-pNN.png`; `<out>/summary.md` and `<out>/summary.json`
(one row per document and the totals).

## The candidate places

Text and drawing (any page): runs of `_` (10 pt or more) and of hyphens typed as a blank (6 or more, 24 pt or more;
plain-text filings); `[ ]` and `( )` typed as tick boxes (nothing printed inside); drawn horizontal rules of 18 pt or more. A rule counts when it leaves room to write: its longest stretch with no print
standing on it is 18 pt and 30 % of its length or more (so `City: ________` counts, an answered line or underlined words do
not). A rule across more than 72 % of the page counts only when a caption stands on its start and 40 % of it is free;
otherwise it is a separator. A rule in the top/bottom margin and a short rule over a wider paragraph with nothing on its
own line are not counted; closed rectangles built from drawn horizontals and
the verticals spanning them (table cells and drawn boxes: a cell holding print is not counted, a small square is a
tick box); light filled rectangles inside a tinted fill (white boxes on grey); box glyphs (☐ □ ❑, Wingdings/ZapfDingbats
boxes); AcroForm widgets.

Pictures (any page where a picture covers 25 % or more; the page rendered at the picture's own resolution, 100 to 300
pixels an inch): connected regions lighter than paper minus 25 (edges thickened by one pixel against the soft fringe of
a compressed picture), enclosed on all sides, at least 85 % of their bounding box, sides straight to the corners: an
**enclosed light rectangle** (drawn edge) or a **light rectangle on a tinted ground** (no drawn edge; the d1 case);
small round regions of the same kind whose ring stands alone are **round tick boxes**; a region holding 6 square points
of print or more is not counted. Light rectangles on a tinted ground that hold print are listed (not counted).
Horizontal strokes darker than paper minus 45 (a light grey writing line included), 18 pt or longer, at most 3.2 pt thick, with paper just above and below
(a row of small letters run together is not a stroke); a stroke that is a box's edge is dropped; one across the picture,
with no room left to write, ending in a dark bar, or a short one over a paragraph is not counted (the same room and
caption rules as for drawn rules).

Each candidate carries `conf` (high, medium, low), `textOn` and `fill` (= high confidence, no print on it, a fill-in
kind). Only `fill` candidates are counted by `placeNoField` and the coverage; every candidate counts as a place for
`strayNoPlace`.

Rows of four or more equal small boxes a little apart (one box a letter) are one place, kind **comb**; it counts as
filled when 80 % of its boxes lie half or more under a field (one field across it or one in each box both fill it).
Boxes touching edge to edge in a run (3 stacked, or 4 side by side) are the cells of a grid (a chart, a ruled table) and
are not counted. A blank in square brackets (`[______]`) is a template placeholder for the fund's own words and is not
counted. On scans, pieces of a line broken by the skew (each 10 pt or more, end to end) are joined; strokes at the sheet's
edge and the top or foot of a frame drawn round printed words are not counted.

### Places added in plan 01.4-01 (finder f01586d5; the earlier finder was 978d303e)

Every rule below was designed by eye on train documents only (never an id of held-out.json) and proved on a made-up
page (`SCRATCH/exec-0141/madeup.py`, three pages, no real text). Example train documents per rule:

| kind | rule | counted | example train ids |
|---|---|---|---|
| `glyphbox` | a tick box whose symbol font was not embedded, so the filing prints its fallback glyph: a lone `¨` or `q` (a word of that one character, upright, text font) is a box, conf high; a lone `o`, `c`, `i` or apostrophe is a box (conf medium, still counted) only in a choice column: another lone glyph of the same character on another line has its left edge within 4 pt, and each is followed on its own line by option words. A fixed-width `o` (the word processor's second-level bullet) is not a box. The box is the glyph's box made square on its height. Not read on picture pages (their text layer is a recognition) | yes | b091 (327 `¨`), a007, a041, b025 (`o` columns); b063 (mono bullets, refused) |
| `typedcomb` | a typed row of three or more `|_|` / `|__|` cells sharing their bars is ONE place carrying `cells`; it is filled like a drawn comb (80 % of its cells under a field). One or two typed cells are tick boxes (kind `tick`, "typed tick box"); their underscores are not counted as blanks | yes | no train document has a typed row of three or more cells: proved on the made-up page; typed tick boxes b050, a088 |
| `dateparts` | underscore runs on one line with only date words between them (day, of, a month, 19/20 printed before a run, a comma, a slash after the word Date) and at least one date anchor are ONE date place carrying `parts` (the box of each run); the runs are not counted alone | yes | a014, a028, a030, a041, a047 |
| `captionsplit` | a drawn rule or a typed run with two or more captions directly under it (caption = a group of words 12 pt or more from the next, at most 6 words and 40 characters, not an enumerator or bullet), when the writing room above the line is clear and the words under it are not a paragraph (fill at most 75 % of it, do not run on past its ends): one place per caption, split at the midpoints between the captions. A drawn rule with two or more one-line captions standing on it (`City ____ State ____ Zip ____` drawn as one rule, which the 30 % room rule used to drop): one place per free stretch of 18 pt or more after a caption. The rule itself stays a candidate, not counted | yes | b082, b087, b050, a028 (column headings standing on a rule refused), a047 (headings under a separator refused) |
| `illustration` (flag) | a picture region whose text-layer words carry a sample or example marker in capitals or as a short label line (SAMPLE, VOID, Specimen, Example), or where more than half of the enclosed boxes found in it (four or more) hold print, is a cheque, a filled example or a printed table: every candidate in it gets `illustration: true` and is not counted | no | b046 page 33 (a printed table picture, 11 of 12 boxes hold print); the marker branch on the made-up page (a046 has no illustration picture; d1 is held out and was not opened) |
| table frame | a grid of ruled cells (cells sharing edges) where more than half of the rows have print in every cell is a printed table: its empty cells are table frame (conf medium, not counted) | no | b037 |

The owner's picture form is unchanged by these rules: 240 of 241 sheet places with a candidate, 239 counted, 3 extras.

## The checks

A field is **on** a candidate when its centre lies in the candidate's box grown by 3 pt, or the two boxes overlap by
40 % of the smaller one (the rule of the earlier scorers). The box of a rule or a row of underscores is the writing
space: from 14 pt above the line to 1.5 pt under it.

| check | meaning |
|---|---|
| `strayOverText` | a field covering printed words: on a page with text, a word with a letter or digit lies half or more inside the field (`Name:____` counts as the word `Name:` only); on a picture page (its text layer, if any, is ignored: a recognition layer reads a tick box as "CJ"), 5 % or more of the field (1.5 pt in from its edges, long straight lines left out) is ink |
| `strayNoPlace` | a field on no candidate at all |
| `placeNoField` | a counted candidate with no field on it |
| `coverage` | counted candidates with a field, in % |
| `noSignature` | 1 when the text prints a signature caption ("Signature", "By:", "Signed", "/s/", "Initials"...) within 30 pt of a printed place and the portal placed no signature field; `unknown` when the document's captions are only on pictures |
| `overlaps` | two fields on a page sharing more than 0.5 pt both ways |
| `unreadable` | the editor never opened, or the portal's own record says the reading failed |
| `allMarked` | share of fields marked for review |
| `consoleErrors` | browser console errors and page errors during the document |
| `sponsorWork` | **the main number (D-13, D-14, D-20)**: what the sponsor would have to do before sending. One for each field to remove or move (either kind of stray), each field marked for review, each overlap not already counted, each counted place without a field, a missing signature field, pressing "Read these pages from their picture", and an unreadable document. A field is counted once whatever is wrong with it. Broken down in `row.work` |
| `readyToSend` | yes when the editor opened, the reading finished in time and `sponsorWork` is 0 |

## Calibration (how far to trust it)

- On the owner's picture form (8 pages, 241 places on its answer sheet `build/ocr-truth/truth-printed.json`), the
  candidate finder puts a candidate on **240 of 241** places; 3 counted candidates lie on no place of the sheet (two
  letters of the logo on page 5 taken for tick boxes, one 19 pt stroke on page 1). The missed place is one small tick box
  (page 2, co-investor "Resident Alien").
- The answer sheet's own 241 places fed in as fields give: strayOverText 0, strayNoPlace 1 (the missed box),
  placeNoField 3 (the three extras), overlaps 0. That is the floor of the measure's own error on this kind of page.
- The answer sheet is not used anywhere in a run.
- The portal's own fields on the owner's form give exactly the same numbers as the answer sheet fed in (241 fields,
  236 of 239 counted places with a field, strayNoPlace 1, placeNoField 3, strayOverText 0, overlaps 0): the portal
  matches the sheet there, and the measure reports it as such. Its sponsorWork is 245 = 241 review marks + 3 + the
  picture offer pressed.
- Against the 39 exact-scored held-out answer sheets (`python3 -I calibrate.py [--finder <8 hex>] [--json out]`,
  totals only; table in `calibration-978d303e-to-f01586d5.md`):

  | finder | recall (sheet places with a counted candidate) | precision (counted candidates on a sheet place) |
  |---|---|---|
  | 978d303e | 2,326 / 3,711 = 62.7 % | 2,944 / 3,688 = 79.8 % |
  | f01586d5 | 2,557 / 3,711 = 68.9 % | 3,193 / 3,977 = 80.3 % |

  Recall by kind at f01586d5: blank 67.2 %, tickbox 70.6 %, initials 69.2 %, signature 73.5 %, date 73.2 %.
  A third of real places is still invisible to the measure: it is not the phase gate; the exact scores are.
- The read seal (D-22): measure.py, calibrate.py and warm.py restore the access-time seal on every held-out PDF,
  sheet and candidate file they read or write (`measure.seal_heldout`, `exact.seal`).

## Runs on disk

- `out-cal-final/`: the calibration set with pictures (`calibration.json`).
- `out-set-b/`, `out-set-a/`: the 110 + 110 EDGAR documents (no pictures; make them for one document with
  `--only <id> --pictures`). `baseline.md` holds both sets' tables from `tables.py`.
- `run-all.sh` runs all three one after the other.
- `python3 -I tables.py B=out-set-b/summary.json A=out-set-a/summary.json` prints the totals, the breakdown by how the
  PDF was made and by page content, and the documents with most sponsor work.

## Known weaknesses

- **Illustrations.** A picture region is not counted when its text layer carries a SAMPLE/VOID/Example marker or more
  than half of its boxes hold print. A picture of a cheque or filled example with no text layer and mostly empty boxes
  is still counted (no text recognition in the measure).
- **Fallback glyphs.** A lone `o`, `c`, `i` or apostrophe is a box only in a column of two or more before option words;
  a single one, or a row of them on one line ("o Yes o No" with no partner below), is missed. A proportional-font `o`
  used as a bullet in a column before short lines would be taken for a box.
- **Typed combs** were designed on a made-up page only (no train document has one).
- **Dates in parts** are joined only when made of underscore runs; dates in parts on drawn rules or hyphen runs stay
  one place per piece.
- **Captions under a line** are found only when the writing room above the line is clear and the captions are short
  groups 12 pt or more apart; captions closer together than 12 pt stay one place.
- **Round tick boxes** touching their label or a rule are missed; a round letter or a logo letter can be taken for one.
- **Signature captions on pictures** are not read (no text recognition in the measure): `noSignature` is `unknown` for
  a document whose captions are only on pictures. On text pages it relies on caption words next to a place.
- **Table cells**: an empty cell of a grid is a counted place even where the grid is decoration (a schedule with
  blank columns); a cell holding a caption and room to write is not counted (its writing room is not a candidate).
- **One line, several places**: handled by `captionsplit` when two or more captions stand on a drawn rule or sit under
  it; a rule with one caption on it and no single stretch of 30 % free is still not counted.
- **Rules** at fill-in length that are decoration (signature-block rules above printed names, rules in a letterhead)
  are counted; underlined words are not counted only when the print stands on the rule.
- **Scans**: speckle, skew and broken edges cut boxes; a scan with an invisible text layer is treated as a picture page
  with words (both passes run).
- **sponsorWork is a floor, not the whole truth**: a field on the right place with the wrong kind, person or label
  costs the sponsor work too, and the checks cannot see it without an answer sheet. On the owner's form the measure's own
  floor is 4 (3 extra candidates, 1 missed box).
- **Ownership and kind** are not judged: the checks say whether a field is on a printed place, not whether it is the
  right kind or the right person's (that needs the answer sheets of D-04's stratified sample). The fields' kinds and
  owners are recorded for that.
- Page boxes: coordinates assume the crop box equals the media box; a rotated page is handled by pdfplumber and
  pdfinfo, not tested on a rotated document yet.
