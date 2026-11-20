---
phase: 10-investor-tax-documents-and-withholding
plan: 09
subsystem: Form 1099-INT core (pure functions, no screen)
tags: [tax, 1099-INT, IRIS, copy-b, w-9, withholding]
status: complete
requires: ["10-01 (NS.data.paidLines, runLines, runPaid, confirmLines)", "10-03 (shipped PDF reader and writer)", "10-05 (NS.withholding.reporting, payee, w8, withheldFor)"]
provides:
  - "NS.tax1099 (assets/js/tax1099.js): interestRuns, setPayer, payerOf, last4Of, figuresInt, STOP_TEXT, LEFT_TEXT, setInterest, confirmTotals, confirmed, w9Rects, readW9, checkTin, splitName, splitCityStateZip, truncate, dashed, copyBAnswers, recipientCopy, textItems, markFiled, iris.{header,row,validate,files}"
  - "NS.tax1099data (assets/js/tax1099-data.js): IRIS (66 columns A to BN with rules and sources; headerPinned false) and MAPS['1099-INT 2024-01 Copy B']"
  - "assets/forms/1099/: f1099int-2024-01.pdf (irs.gov), SHA256SUMS, forms1099-data.js (NS.tax1099formsData)"
  - "checks/tax-1099.js (TAX 1099, 10 cases), checks/tax-forms.js (TAX FORMS, 1 form)"
affects: [10-10, 10-11, 10-13]
tech-stack:
  added: []
  patterns: ["figures only from stored lines of paid runs", "a stop names the CPA and empties the forms", "taxpayer numbers held by the caller, never stored or logged", "every upload rule lives in the data table with its source"]
key-files:
  created:
    - assets/js/tax1099.js
    - assets/js/tax1099-data.js
    - assets/forms/1099/f1099int-2024-01.pdf
    - assets/forms/1099/SHA256SUMS
    - assets/forms/1099/forms1099-data.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax-1099.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax-forms.js
  modified: []
decisions:
  - "The recipient copy has three pages, not two: Copy B (page 4), the recipient's instructions (page 5) and their continuation (page 7, 'Instructions for Recipient (continued)', boxes 11 to 17 and nominees). Page 5 ends '(Continued on the back of Copy 2.)', so two pages would hand the recipient half the instructions."
  - "An investor with no signed W-9 is listed as left out with a reason that says a Form 1099-INT is still due (record the W-9 or ask the CPA); an expired or unsigned W-8 is listed as 'no valid W-8 or signed W-9' and the CPA decides 1099-INT or 1042-S."
  - "Under $10 is tested before the missing-W-9 reason (no form is required at all then); IRA, exempt and valid-W-8 come first."
  - "A cell starting with =, +, - or @ is refused for every column (file rule with its source); an international payer phone would be written without its '+'."
  - "readW9 ignores sideways text (the W-9's margin label 'See Specific Instructions' lies inside the address box)."
  - "Payer's full number never stored: setPayer refuses a nine-digit value in any field; only tinLast4 is kept."
metrics:
  completed: 2026-11-20
  tasks: 3
actuals:
  tokens: 29200
  tasks: 3
  commits: 6
plan_head_before: 6061fce0b5d43bced41eb84c3c7c6375d1d97f27
plan_head_after: 43c124c08c32aa4ad47d4615ca220df948ceb588
---

# Phase 10 Plan 09: Form 1099-INT core Summary

Form 1099-INT worked out from the portal's stored payment lines only (box 1: gross on interest payments paid in the year; box 4: the stored backup withholding; every other box empty), with every leave-out and every stop named, the recipient's number read from the signed W-9 and never kept, the official Copy B filled and flattened with the number truncated, and IRS upload rows checked against all 66 published column rules. No page loads any of it yet (plan 10-10). The owner has not checked this.

## Failures and weak points first

- **Not proven, by design:** no file has been uploaded to the IRS. Word for word, still unconfirmed: the header row's exact text; whether amounts carry cents (written as 13333.32); that tax year 2026's columns equal tax year 2025's; no upload has been tried; no CPA has read the stops. `IRIS.headerPinned` and `IRIS.centsConfirmed` stay false until plan 10-13 compares a real IRS template.
- **Deviation from the plan's page count:** the recipient copy has 3 pages (Copy B and both instruction pages), not 2; reasons in decisions. The check's "Copy A appears nowhere" became: no page carries a Copy A/1/2/C heading, and those words appear only in the instructions' own two sentences ("Continued on the back of Copy 2", a nominee's "File Copy A of the form with the IRS").
- **Check bugs fixed after RED, not code bugs:** the payer's phone was 10 digits in a row, which the taxpayer-number search (correctly) flagged, so it is written 214-555-0100; case leftout's expected total was my arithmetic error (252,998, not 253,998); case rows flattened its cells one level too few; label positions in tax-forms.js were measured (year label is above its field; box 1's label 16 points above). One check was added after GREEN: a mutation (counting a run without stored lines) survived, so case legacy now also requires totalCents to exclude recomputed amounts while the stop stands (it fails on that mutation).
- **Selfcheck passed at RED:** both checks' unknown-name and empty-list behaviour comes from phase 6's runParts, which already existed.
- **setPayer** was needed by case figures, so it was built in Task 1 rather than Task 2.
- **The plan's state abbreviations** come from the USPS list the IRS file links to; that linked PDF itself was not read. Country codes are checked for shape (two capitals) only; the IRS country list is not embedded.
- **gate10.sh was not run:** every file here is new and loaded by no page, so per the gate pacing rule the proof is this plan's checks, the phase 10 node checks and the server tests (below).

## Verify lines (verbatim)

Task 1: `TAX 1099: PASS (cases run: 1)` / `VERIFY1_EXIT=0`. Task 2: `TAX 1099: PASS (cases run: 7)` / `VERIFY2_EXIT=0`. Task 3 (without gate10.sh):
```
D6 ok: 5 own commits, none touches the phase 6 form files or a page
DATA ok: 66 columns, headerPinned false
TAX 1099: PASS (cases run: 10)
TAX FORMS: PASS (forms run: 1)
f1099int-2024-01.pdf: OK
VERIFY3_EXIT=0
```
Phase 10 node checks and server tests on this tree:
```
ok   DIST RECORD: PASS (cases run: 9)
ok   K1 SPLIT: PASS (cases run: 7)
ok   TAX 1099: PASS (cases run: 10)
ok   TAX FORMS: PASS (forms run: 1)
ok   TAX MATH: PASS (cases run: 9)
ok   TAXDOCS MATH: PASS (cases run: 10)
# tests 358
# pass 358
# fail 0
```
Phase 6 reference counts unchanged: `EMBED DATA: PASS (files: 3)`, `FORM MAPS: PASS (forms run: 3)`.

## RED evidence (SCRATCH/exec-10-09)

- red-1.txt: both checks fail, ENOENT on assets/js/tax1099-data.js (2 FAIL lines).
- red-2.txt: 27 FAIL lines, `TAX 1099: FAIL (cases run: 7) - leftout, stops, kinds, legacy, w9read, tincheck`.
- red-3.txt: 27 FAIL lines, `TAX 1099: FAIL (cases run: 3) - rows, faults`.
- mutate.txt: 12 bugs put into tax1099.js one at a time (no under-$10 rule; under-$10 ignoring withholding; no backup-not-interest stop; Principal counted; full number on Copy B; truncated number in the IRS row; no space rule; file rules off; 250-row files; other-withholding off; unstored run counted; checkTin ignoring the last four): 12 of 12 caught after the legacy assertion was added.

## Hand-worked example D, proven to the cent

A-1001 box 1 2,000,000 ($20,000.00), box 4 empty; A-1002 1,333,332 ($13,333.32) and 160,000 ($1,600.00); A-1003 left out, Form 1042-S from the CPA, 666,668; total 4,000,000; the Principal payment adds nothing. IRS rows: A-1002 13333.32 in AN and 1600.00 in AQ, A-1001 20000.00 and an empty AQ. Copy B shows ***-**-7310, 13,333.32, 1,600.00 and the payer's number in full; the recipient's nine digits appear nowhere on it. The $10 line: 999 cents with nothing withheld left out; 1,000 gets a form; 999 with 240 withheld (24% of 999 = 239.76) gets a form with 9.99 and 2.40.

## Plan-check additions applied

D4 (case tincheck searches digits, dashed, first five beside last four, both shapes and nine-digit runs after removing sha256 values and 64-hex runs, over the workspace and its change log, and proves the search finds a planted number); D6 (unchanged files checked by this plan's own commits); D12 (last four from taxCert.tinLast4 then the record, never ftinLast4; an investor whose only four digits are foreign gets "no signed W-9"; case leftout seats its own investors).

## Preview build

No page loads these files yet; 10-10 adds them. When it does, the preview needs assets/js/tax1099-data.js, assets/js/tax1099.js and assets/forms/1099/forms1099-data.js (the form as script data, no fetch). SHA256SUMS (no extension) is not needed by any page: the pin is also in the map (`sha256`) and NS.taxforms.fill checks it on the decoded bytes before filling, so a preview build may leave SHA256SUMS out; the PDF itself is needed only by the checks.

## Self-Check: PASSED

All seven created files exist; commits 5892815, 75dd296, 09e97e2, eac8801, 31173a7, 43c124c are ancestors of HEAD.
