# Phase 10 Plan 10: Form 1099 on screen Summary (DRAFT, being written as the work runs)

## Evidence as produced

### RED 1 (SCRATCH/exec-10-10/red-1.txt, check committed in 0bebf99)
```
PASS review-phone the frame refuses fetch() (connect-src none is in force)
FAIL review-phone as admin, Tax documents shows a Form 1099 line ::
FAIL review-phone the page for example D and 2026 lists exactly two forms, A-1001 and A-1002 :: []
FAIL review-phone A-1001: interest paid $20,000.00, federal tax withheld empty :: {}
FAIL review-phone A-1002: interest paid $13,333.32, federal tax withheld $1,600.00 :: {}
FAIL review-phone A-1003 is left out with its reason (Form 1042-S from your CPA) and $6,666.68 :: []
FAIL review-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 1) - review-phone
```

### Task 1 verify (SCRATCH/exec-10-10/tracer.txt, code 730e63d)
```
PASS review-phone no script error in the browser
PASS review-phone no request outside the page's origin
TAX1099 FLOW: PASS (parts run: 1)
```
24 PASS, 0 FAIL; no full-number shape in the output. First GREEN run failed 4 checks: one was a bug in the check's seat
(the backup lines were never handed to recordRun, so box 4 read empty), one asked for the sample's admin name instead of
"who", two were missing data-panel markers in the page.

### RED 2 (SCRATCH/exec-10-10/red-2.txt, check committed in ce71e99; 50 PASS, 9 FAIL)
```
FAIL review-desktop one line says the IRS's code for filing can take up to 45 days, with its link to the IRS's IRIS page :: null
FAIL review-desktop one line says not to open the file in a spreadsheet before uploading it :: null
FAIL review-desktop while headerPinned is false, one line says the file's header has not been compared with the IRS's own template :: null
FAIL payer ran to the end :: frame.fill: Timeout 30000ms exceeded.
FAIL copyb ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL file with a period in the last name no file is built
FAIL file the page names the row, the column and the reason :: []
FAIL file that cell is offered for correction
FAIL file ran to the end :: frame.fill: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 5) - review-desktop, payer, copyb, file
```
Part tin PASSED at RED: everything it tests (checkTin's refusals, the numbers forgotten on leaving and after the file,
the payer's kept last four) was already built in the Task 1 commit 730e63d. It has no separate RED.

### Task 2 verify (SCRATCH/exec-10-10/parts.txt, code 735ae58; 135 PASS, 0 FAIL, no full-number shape in the output)
```
PASS file no script error in the browser
PASS file no request outside the page's origin
TAX1099 FLOW: PASS (parts run: 6)
```

### RED 3 (SCRATCH/exec-10-10/red-3.txt, check committed in 450dd83; 7 PASS, 5 FAIL)
```
FAIL stops with every fund not set, the Tax documents page has no Form 1099 line
FAIL stops with a fund set to partnership, still no Form 1099 line
FAIL stops a Distribution payment in the year shows its stop sentence and "Is this payment interest?" with its date and amount :: {"st":[{"code":"kind",...
FAIL stops ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL roles ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 2) - stops, roles
```

### All eight parts on the final code, before the gate (SCRATCH/exec-10-10/all8.txt; 179 PASS, 0 FAIL, no full-number shape)
```
PASS roles no script error in the browser
PASS roles no request outside the page's origin
TAX1099 FLOW: PASS (parts run: 8)
```
