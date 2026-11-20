---
phase: 12-report-builder
plan: 03
subsystem: reports
tags: [pdf, white-label, reports, phone-frame]
requires: [shipped PDF writer and fonts (assets/vendor/pdfwrite, assets/vendor/textfont), NS.esignKit, NS.brand.markBody]
provides: [NS.reportsPdf (PAGE, compose, logoFor), checks/lib12.js, checks/fixtures/layout-a.js, REPORTS PDF check (9 cases)]
affects: [12-05, 12-06, 12-07, 12-08, 12-09]
tech-stack:
  added: []
  patterns: [one layout model drawn as given, every string checked against the font before drawing, firm-only file properties, marks drawn from brand.js artwork with drawSvgPath]
key-files:
  created: [assets/js/reports-pdf.js, .planning/phases/12-report-builder/checks/reports-pdf.js, .planning/phases/12-report-builder/checks/lib12.js, .planning/phases/12-report-builder/checks/fixtures/layout-a.js]
  modified: []
decisions:
  - "Chart values already in 0..1 are drawn as fractions of the plot (as ticks' at); any other values are drawn against the largest value. 12-02's shape does not say which; 12-02/12-06 should send fractions for columns and line so the ticks line up."
  - "An uploaded logo on a colored cover band sits on a white plate; the generated mark on the band takes the console's hero colors for that ground (brand.js derive)."
  - "The support contact (legal name, team, email, phone) is drawn at the foot of the cover, or as one line under the title when the cover is off."
metrics:
  completed: 2026-11-20
status: complete
estimate_tokens: 100000
actuals:
  tokens: 22000
  tasks: 3
  commits: 11
plan_head_before: 96bbdf6800f8b9190a02bf66f1483a2884717598
plan_head_after: 5074a807c85d776ef1fcad68bb7e2b904073f5e4
---

# Phase 12 Plan 03: the PDF composer

A layout model becomes a portrait US Letter PDF in the firm's brand (cover band, plain or photo; header with logo and
firm name; "Page n of N" footer; headings, styled paragraphs, lists, key-figure tiles, tables split across pages with the
heading row repeated, vector columns/line/100% bar charts, JPEG/PNG photos), written with the shipped writer and font,
naming only the firm in its file properties, refusing a character the font cannot show, byte-identical for the same
model, and composing inside the owner's sandboxed phone frame with connections refused.

Nothing here is ready until the owner has checked it. Measured in Chromium and Node only; the look of the pages and the
canvas logo path in iPhone Safari are unconfirmed.

(`status: complete` in the frontmatter is the audit scanner's marker that the executor finished the plan; it is not a
claim that the owner has checked anything. Commits counted when this file was written: 11, before the commit that adds it.)

## Failures first

1. **The Task 2 and Task 3 verify commands fail as written** (exit 1), on one test only: `test -z "$(ls -A $O/checks-out)"`.
   The folder holds no PDF and no page image; it holds `.parts/`, the per-case results store that runParts (P6/lib.js,
   merged with the gate-resume work, 1d57f8d) writes into P6_OUT on purpose. The plan was written before that store
   existed. With `.parts` excluded the same commands exit 0. Fixing it would mean changing P6/lib.js (not a new file),
   or changing how the plan's verify reads the folder; I left both for the orchestrator.
2. Three FAIL lines in red-3 came from mistakes in my own check, not the composer (Deviations 2 and 3).
3. Case tables did not go red first: Task 1 had already built the table split, so red-2 shows it passing.

## RED outputs

### red-1 (Task 1, case compose, before assets/js/reports-pdf.js existed)

```
FAIL compose ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a19edbb0970a5684b/assets/js/reports-pdf.js'
    at Object.readFileSync (node:fs:440:20)
    at /home/user/Hhhh/.claude/worktrees/agent-a19edbb0970a5684b/.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/load11.js:159:24
    ...
REPORTS PDF: FAIL (cases run: 1) - compose
```

### red-2 (Task 2, cases compose..repeat on Task 1's composer; 33 FAIL, 27 PASS; exit 1)

Case tables already passed here: Task 1 built the table split with the repeated heading row, so the case proves that
work rather than going red first. Selected lines (full file: SCRATCH/exec-12-03/red-2.txt):

```
FAIL brand Author is the firm's legal name
FAIL brand Producer is the firm's legal name (never the library's own) :: pdf-lib (https://github.com/Hopding/pdf-lib)
FAIL brand Creator is the firm's legal name :: pdf-lib (https://github.com/Hopding/pdf-lib)
FAIL brand Subject is the subtitle
FAIL brand no vendor, library, model or platform name and never the forbidden word in the file properties or the text :: ["{\"Title\":\"Quarterly report - Quarter ended December 31, 2026\",\"Creator\":\"pdf-lib (https://github.com/Hopding/pdf-lib)\",\"Producer\":\"pdf-lib (https://github.com/H"]
PASS brand pdffonts names (the record for C-02): DejaVuSans-Bold-249, DejaVuSans-2035
FAIL images logoFor: a PNG data URL gives its bytes :: name
FAIL images logoFor: a JPEG data URL gives its bytes :: name
FAIL images logoFor: a generated mark gives its type, letters and the console's mark colors :: {"kind":"name","text":"Société Àrbre","color":"#1F3A5F"}
FAIL images a PNG logo is embedded on page 1 and in every page's header (5 pages) :: {"onPages":[],"list":[]}
FAIL images a JPEG logo is embedded on page 1 and in every page's header (5 pages) :: {"onPages":[],"list":[]}
FAIL images the photo p1 is one JPEG image on the page of its caption :: {"list":[],"photoPage":4}
FAIL images the composer reports where the cover mark is drawn
FAIL images the monogram mark composes as vectors (only the photo is an image; its letters are drawn) :: []
FAIL images the wing mark composes as vectors (only the photo is an image) :: []
FAIL images the ridge mark composes as vectors (only the photo is an image) :: []
FAIL images the wave mark composes as vectors (only the photo is an image) :: []
FAIL images the arch mark composes as vectors (only the photo is an image) :: []
FAIL charts the column under $1,500.00 is a filled area in the accent color :: {"page":3,...}
FAIL charts segment 1 of the 100% bar is a filled area in the primary color :: {...}
FAIL charts segment 2 of the 100% bar is a filled area in the accent color :: {...}
FAIL charts the line chart's point under $310,000 is drawn :: {...}
FAIL unicode compose refuses with the plain message naming "漢" (U+6F22) :: no error
FAIL unicode no file is written :: ["refused.pdf"]
FAIL unicode a table cell is checked too (U+1F680 is refused) :: no error
PASS repeat two runs of the same model give the same SHA-256
PASS repeat a fresh load of the portal gives the same SHA-256 too
FAIL repeat a different generation time gives a different SHA-256
REPORTS PDF: FAIL (cases run: 7) - brand, images, charts, unicode, repeat
```

### red-3 (Task 3, cases phone and selfcheck before the canvas path; exit 1)

Two of these FAIL lines were the check's own mistakes, fixed before the code (see Deviations): the outside-request
line counted the sign-up page's own stylesheet fonts loaded before the composer ran, and lib10's screen scan read the
sign-up page (which names the portal's provider by design), not anything the composer produced. selfcheck passed at
RED because runParts already refuses unknown and empty case lists.

```
PASS phone the frame is 390x844 with touch
PASS phone the frame refuses fetch() (connect-src none is in force)
FAIL phone logoFor redraws an SVG logo to PNG on the canvas :: name
FAIL phone logoFor redraws a WebP logo to PNG on the canvas :: name
PASS phone compose of layout-a in the frame took 524 ms (measured, printed, no threshold)
PASS phone the composer, the shipped writer, font embedder and both font data files came from the page's own address
FAIL phone the redrawn logo is an image on page 1 :: [{"page":5,"type":"image","width":160,"height":100,"color":"rgb","enc":"jpeg"}]
PASS phone every string of the model is in the frame's PDF
PASS phone with the canvas refusing, logoFor gives the firm's short name in its primary color
PASS phone that PDF's page headers carry the short name (not an image)
FAIL phone no request outside the page's address :: ["https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500&family=Funnel+Sans:wght@400;500&family=Caveat:wght@500&display=swap","https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500&family=Funnel+Sans:wght@400;500&display=swap"]
PASS phone the policy refused nothing (no fetch, no outside script)
PASS phone no script error in the browser
PASS phone no request outside the page's origin
FAIL phone no vendor, model or library name and no forbidden word on screen :: ["Carrow & Vale","By creating a portal you agree to the Carrow & Vale terms of service. No card is needed to start.","Your investors see only your firm’s brand. Prefer Carrow & Vale to run your portal for you? Ask about the managed service."]
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS PDF: FAIL (cases run: 2) - phone
```

## Verify lines

### Task 1 verify (exit 0)

```
PASS compose each page carries 'Page n of N'
PASS compose the recipient and the firm print with their accents and Polish letters
REPORTS PDF: PASS (cases run: 1)
```

### Task 2 verify: FAILED as written (exit 1), only on the empty-folder test; passes with the results store excluded

The command as written ends with `test -z "$(ls -A $O/checks-out)"`. The folder holds no PDF (0 files named *.pdf);
it holds `.parts/`, the per-part results store that runParts (P6/lib.js, gate-resume 1d57f8d) writes into P6_OUT by
design (small JSON files stamped to the tree, kept so a rerun on the same tree resumes). The plan was written before
that store existed. The same command with `.parts` excluded (`ls -A ... | grep -vx '.parts'`) exits 0.

```
PASS repeat a fresh load of the portal gives the same SHA-256 too
PASS repeat a different generation time gives a different SHA-256
REPORTS PDF: PASS (cases run: 7)
verify exit 1
.parts
verify (results store excluded) exit 0
```
62 PASS lines, 0 FAIL. The C-02 record from case brand:
`PASS brand pdffonts names (the record for C-02): DejaVuSans-Bold-5348, DejaVuSans-5083`

### Task 3 verify (the plan's gate), with plan-check B1 applied: FAILED as written (exit 1) only on the empty-folder test; passes with the results store excluded

Run from SCRATCH/exec-12-03/verify3.sh: the plan's command with `rm -rf $O/shots` moved before the final chain (B1),
and `GATE_FRESH=1` so every case ran now (none kept from an earlier run). The queue script is SCRATCH/exec-011/heavy.sh
as the plan names (byte-identical to .planning/tools/heavy.sh; exec-011's locks are the queue in use).

```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS PDF: PASS (cases run: 9)
verify as written (B1) exit 1
verify with the results store excluded exit 0
```
79 PASS lines, 0 FAIL. checks-out after the run holds only `.parts` (0 PDFs, 0 page images). filesout.js, diy.html,
portal.html and index.html are unchanged from 96bbdf6 (the `git diff --quiet` part of the chain passed).

Measured times (printed, no threshold):
- `PASS compose compose returns bytes starting %PDF- (layout-a in Node took 256 ms; measured, printed, no threshold)`
- `PASS phone compose of layout-a in the frame took 383 ms (measured, printed, no threshold)`

C-02 record for the owner's check (font names inside the PDF's font data, not page text):
`PASS brand pdffonts names (the record for C-02): DejaVuSans-Bold-5348, DejaVuSans-5083`

### Server tests (368)

```
# tests 368
# pass 368
# fail 0
```
(server/node_modules linked from /home/user/Hhhh for the run, removed after.)

## What was built

- `assets/js/reports-pdf.js` (new): `NS.reportsPdf = { PAGE, compose, logoFor }`.
  - `compose(model, { kit, images, logo })` resolves to the PDF bytes with `.pages`, `.missingImages`, and `.logos`
    (where each logo was drawn: page, x, top, w, h, kind; used by the check to prove the mark is vectors).
  - The kit comes from opts.kit, else `NS.esignKit.writer()` and `unicodeFont()`. The bold font comes from kit.boldBytes,
    else NS.fontData.bold, else the shipped text-bold.js loaded with `NS.esignKit.loadScript` (address beside the
    composer); with none, the regular font filled and outlined stands in. The composer itself never fetches.
  - Every string is checked against the font (bold strings against the bold font too) before any page is drawn.
    A miss throws `This report has a character the PDF font cannot show: "<char>" (U+XXXX) in "<first 40>". Change the text and try again.`
  - File properties: Title = meta.title; Author, Producer, Creator = meta.author (legal name); Subject = subtitle;
    CreationDate/ModDate = model.when. The writer's subset names come from its seeded generator, so the same model gives
    the same bytes, also after a fresh load.
  - Marks are drawn from `NS.brand.markBody(type, letters, colors, 'sans')`, parsed (path d, rect with rx, circle, text;
    colors from the style attribute; fill="none", stroke-width, round caps and joins) and drawn with `drawSvgPath`,
    scaled from the 40x40 box (W4). No artwork is copied into the file.
  - `logoFor(tenant)`: PNG and JPEG data URLs give their bytes (checked by their first bytes, so only these two are
    ever embedded); SVG, WebP and GIF are redrawn to PNG on a canvas (a drawing at 600 px on its longest side, a picture
    only ever made smaller), in the browser only; any failure, or Node, gives `{ kind: 'name', text: shortName || name, color: primary }`;
    a generated mark gives `{ kind: 'mark', type, letters, colors: { p, a, ink } }` with the console's mark colors.
- `checks/lib12.js` (new), function list as built: `ROOT, P6, P10, P11, portal, work, save, text, info, images, fonts,
  pixel, xlsx, fundA, leak` (exactly the plan's names). P6 is phase 6's checks folder; P10 and P11 are the phase folders.
  `images()` rows carry `{ page, type, width, height, color, enc }` (enc is 'jpeg' or 'image').
- `checks/fixtures/layout-a.js` (new): the hand-written model of the plan, plus `b64` with the photo (1,853 bytes), the
  PNG logo (188 bytes) and the JPEG logo (1,154 bytes).
- `checks/reports-pdf.js` (new): REPORTS PDF, 9 cases (compose, brand, tables, images, charts, unicode, repeat, phone,
  selfcheck), 79 checks. It also exports `strings, missingIn, imagesFor, load` for later checks.

## Commits

- 0b20c6e test(12-03): case compose, lib12 helpers and the layout-a fixture (RED)
- 1923b2d wip(12-03): save
- 257e2f6 feat(12-03): the report composer draws the layout model as a portrait Letter PDF
- 21c7995 wip(12-03): save
- c818a8f test(12-03): cases brand, tables, images, charts, unicode, repeat (RED)
- 523687d wip(12-03): save
- 465d50f wip(12-03): save
- 24eb4a7 feat(12-03): firm-only file properties, logos, marks as vectors, photos, charts, Unicode refusal
- fbc013d wip(12-03): save
- e5548da test(12-03): cases phone (the owner's frame, canvas logo path) and selfcheck (RED)
- 5074a80 wip(12-03): save (holds Task 3's code, the canvas redraw in logoFor; the feat commit I made next had nothing left to commit)
- plus the commit that adds this summary

All on wip/12-03, pushed after each commit (normal push).

## Deviations from Plan

1. **[Verify vs. merged harness] empty checks-out test.** See Failures first, item 1. No code changed for it.
2. **[Rule 1 - check bug] line chart case.** The top tick label '$345,000' reads the same as the last point's value, and
   it is drawn first. The case now reads the last word with that text. Commit 24eb4a7.
3. **[Rule 1 - check bug] phone case, two lines.** (a) The outside-request line counted the sign-up page's own
   stylesheet fonts (fonts.googleapis.com, loaded by diy.html before the composer ran; the host allows them). It now
   counts only requests made after the composer starts loading. lib10's `quiet` (requests since the frame loaded)
   still passes. (b) lib10's `leak` scans the screen, which here is the self-serve sign-up page; that page names the
   portal's provider by design. The composer puts nothing on screen, so the case runs the leak test on what the
   composer made in the frame instead: both PDFs' text and file properties. Commit e5548da.
4. **[Additive] `.logos` on the compose result,** so the check can sample pixels inside the mark on the cover and prove
   it is drawn as vectors.
5. **[Design choices the plan left open]** recorded under decisions: chart scaling, the white plate under an uploaded
   logo on the band, where the support contact goes. Money column headings get " (EUR)"-style suffixes for non-USD
   tables, as filesout.js does.
6. **Final verify run with GATE_FRESH=1,** so no case was carried over from an earlier run on the same tree.

## Known Stubs

None. No placeholder text, no unwired data. Photos and charts are fully drawn (Task 1's caption-only stand-ins are gone).

## Threat model

- T-12-11: Title/Author/Producer/Creator from the model; case brand reads pdfinfo through the leak test. Mitigated.
- T-12-12: every string checked before drawing; case unicode (a paragraph and a table cell). Mitigated.
- T-12-13: only PNG and JPEG bytes are embedded, checked by their first bytes; SVG/WebP/GIF become canvas pixels. Mitigated.
- T-12-14: no fetch in the composer; case phone with connections refused and scripts from the page's own address only. Mitigated.
- T-12-15: identical bytes for the same model and time, also after a fresh load; case repeat. Mitigated.

No new security surface beyond the plan.

## Not confirmed (the owner's check)

- How the pages look. Page images were rendered here and looked right to me (cover band, plain and photo; the five
  marks on white and on the band; tables; charts; the photo). Only the owner can judge the look.
- The canvas path for SVG/WebP/GIF logos in iPhone Safari. Only Chromium is available here. If Safari refuses, the
  firm's short name is drawn in its brand color, and the phone case proves that fallback in Chromium.
- REQUIREMENTS.md, STATE.md and ROADMAP.md are not touched (orchestrator's instruction); RB-10, RB-14, RB-15 and RB-16
  are not marked complete.

## Self-Check: PASSED

All four created files exist; the commits listed above are on HEAD (checked with git merge-base --is-ancestor).
