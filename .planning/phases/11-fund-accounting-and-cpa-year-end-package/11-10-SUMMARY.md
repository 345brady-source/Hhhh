---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 10
status: in-progress
---

# Phase 11 Plan 10: Valuations, opening balances and closing (DRAFT, evidence pasted as produced)

## Evidence so far

Base commit: ad2fc5a78d65cc1aa5b362026c33540dd76340b6 (SCRATCH/exec-11-10/base-commit.txt)

### red-1.txt (case value, before books-hold.js existed)
```
FAIL value ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/books-hold.js'
HOLDINGS: FAIL (cases run: 1) - value
```

### Task 1 verify (value.txt)
```
PASS value value(fa-x, 2026-09-30, 46,000,000): change +6,000,000 = mark:fa-m1's lines
PASS value the mark is stored { id 'm-1', holding, date, fvCents, doc, at, by }
PASS value value(fa-x, 2026-12-31, 49,000,000): change +3,000,000 = mark:fa-m2's lines
PASS value fund A's trial balance at 2026-12-31 = the research's (ten accounts)
PASS value the same value again: a third mark is stored (change 0) and no entry is posted
HOLDINGS: PASS (cases run: 1)
VERIFY1 OK
```
Commits: 694309e (check, RED), 0b8e8eb (value()).

### red-2.txt (all six cases, before opening, finalize, reopenBooks and the redemptionAmount change)
```
FAIL opening ran to the end :: Error: NS.books.opening is not defined (books-hold.js)
FAIL finalize ran to the end :: Error: NS.books.finalize is not defined (books-hold.js)
FAIL redemption ran to the end :: Error: NS.books.finalize is not defined (books-hold.js)
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
HOLDINGS: FAIL (cases run: 6) - opening, finalize, redemption
```
value and refusals passed in red-2 (value() and its refusals, W6 included, were written in Task 1).

### red-2b.txt (redemption, after finalize existed, before the operations.js change)
```
PASS redemption the engine's February capital for B-1002 is no longer 49,457,616
FAIL redemption redemptionAmount still returns 49,457,616 (the amount posted when February was finalized) :: 49556854
PASS redemption fund.exceptions lists pos:B-1002:2026-02-01:0 and req:req-b-2
HOLDINGS: FAIL (cases run: 1) - redemption
```

### mut-refusals.txt (value()'s closed-period and date-order guards removed, then restored from git)
```
FAIL refusals a date in a closed period (2026-06-30, closed through 2026-06-30): throws and stores nothing :: closed
FAIL refusals a date in a closed period with no change (cost 40,000,000): throws and stores nothing :: did not throw
FAIL refusals a date before the latest value (2026-12-31): throws and stores nothing :: did not throw
FAIL refusals a second value on the same day as the latest is accepted and posts the change since it (+1,000,000) :: {... "lines":[["1150",-5000000,"","fa-x"],["6100",5000000]] ...}
HOLDINGS: FAIL (cases run: 1) - refusals
```
After the code: `HOLDINGS: PASS (cases run: 6)`. Commits: 7dbea67 (cases), bf6265f (opening/finalize/reopenBooks), 071ced1 (redemptionAmount).
