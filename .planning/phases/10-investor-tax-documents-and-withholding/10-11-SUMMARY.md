# Phase 10 Plan 11: Form 1099-DIV (DRAFT, in progress)

Base commit: d243c4fd5c95ae4a8736ab9b17dd133ba32d821f (SCRATCH/exec-10-11/base-commit.txt).

## Evidence as produced

### RED 1 (SCRATCH/exec-10-11/red-1.txt; checks committed in 514f3c7, before the code)
```
FAIL div-split div-split: ran to the end :: TypeError: NS.tax1099.setSplit is not a function | at splitE (...checks/tax-1099.js:276:14)
FAIL div-split odd line: ran to the end :: TypeError: T.setSplit is not a function | at ...checks/tax-1099.js:773:9
TAX 1099: FAIL (cases run: 1) - div-split
FAIL 1099-DIV the Copy B map exists :: 1099-DIV 2024-01 Copy B
TAX FORMS: FAIL (forms run: 2) - 1099-DIV
```

### Task 1 verify (code e4133b1)
```
TAX 1099: PASS (cases run: 1)        (tracer.txt, case div-split: 28 PASS, 0 FAIL)
TAX FORMS: PASS (forms run: 2)       (forms.txt)
f1099int-2024-01.pdf: OK
f1099div-2024-01.pdf: OK             (pin.txt, sha256sum -c SHA256SUMS)
```
All eleven TAX 1099 cases (plan 10-09's ten plus div-split) passed on e4133b1: `TAX 1099: PASS (cases run: 11)`, 0 FAIL.

### RED 2 (SCRATCH/exec-10-11/red-2.txt; checks in save commit 3730d60, before the screen code)
Cases div-rules, div-stops and div-rows PASSED at RED (`TAX 1099: PASS (cases run: 3)`): Task 1's code commit e4133b1 already
built everything they test. In place of a RED, 12 bugs were planted one at a time in a scratch copy of tax1099.js and
each was caught (SCRATCH/exec-10-11/planted.txt):
```
CAUGHT rule 1b not checked: 13 FAIL
CAUGHT rule 2b+2c+2d not checked: 10 FAIL
CAUGHT odd-cent tie to the later box: 2 FAIL
CAUGHT percent sum not checked: 16 FAIL
CAUGHT five decimals accepted: 1 FAIL
CAUGHT $10 line on 1a instead of cash: 3 FAIL
CAUGHT box 4 not the backup withheld: 1 FAIL
CAUGHT other withholding not stopped (the DIV copy of the line): 1 FAIL
CAUGHT own split loses to the year: 1 FAIL
CAUGHT confirmed ignores the boxes: 1 FAIL
CAUGHT box 4 written in AQ: 1 FAIL
CAUGHT a split stored without a person: 2 FAIL
```
The three browser parts failed at RED:
```
FAIL div-split-phone as admin, Tax documents shows the Form 1099 line for a fund set to corporation or REIT
FAIL div-split-phone before any split, the two distributions are listed with "Split from your CPA" :: []
FAIL div-split-phone the IRS's whole-payment rule is one line with its button :: {"n":0,"text":"","buttons":0}
FAIL div-split-phone the boxes beyond 1a, 2a and 3 are behind "More boxes from your CPA", closed
FAIL div-split-phone ran to the end :: frame.fill: Timeout 30000ms exceeded.
(the same five for div-split-desktop)
FAIL div-file S-2002's number is read from the signed W-9: 'ending 6602'
FAIL div-file ran to the end :: frame.fill: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 3) - div-split-phone, div-split-desktop, div-file
```

### Task 2 verify (screen code in save commit cd03f58, check fixes 20be6fe; SCRATCH/exec-10-11/verify2.txt)
```
TAX 1099: PASS (cases run: 14)          cases.txt: 278 PASS, 0 FAIL
TAX1099 FLOW: PASS (parts run: 3)       parts.txt: 83 PASS, 0 FAIL
VERIFY2_EXIT=0                          (no dashed taxpayer-number shape in either output)
```
Two first GREEN failures were check bugs: the part read example D's fund's year record instead of example E's; and the
year-split box was looked for after every split was saved, when no split form is open any more.

### Task 3 (f09f153)
Sponsor guide (GUIDE.sponsor): 46,698 bytes before, 47,082 after, +384 (cap 400). `node server/help/build.mjs --verify`
in sync; help-data.js regenerated and `--verify` current; `node --test test/help-guide.test.mjs`: 9 pass, 0 fail.
