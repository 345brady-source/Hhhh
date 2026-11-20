---
phase: 12-report-builder
plan: 03
status: in-progress
---

# Phase 12 Plan 03: the PDF composer (evidence as produced)

Nothing here is ready until the owner has checked it. Evidence is pasted the moment it exists (SAVE-RULES rule 5).

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
