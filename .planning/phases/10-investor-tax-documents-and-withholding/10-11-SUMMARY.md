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
