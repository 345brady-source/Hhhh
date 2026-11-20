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

## Verify lines

### Task 1 verify (exit 0)

```
PASS compose each page carries 'Page n of N'
PASS compose the recipient and the firm print with their accents and Polish letters
REPORTS PDF: PASS (cases run: 1)
```
