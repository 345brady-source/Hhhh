---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 09
status: in-progress
---

# Phase 11 Plan 09: Sample funds through the same ledger (DRAFT, saved as produced)

## Evidence as produced

### Task 1 RED (SCRATCH/exec-11-09/red-1.txt, base ad2fc5a, check commit 257e190)
```
FAIL kestrel kb-fund-ii ties at all 86 month-ends (2019-09 to 2026-10): T3, 1000, 1100 + 1150, 2100, the trial balance :: 173 problems; first: kb-fund-ii: desired has no unbalanced list | kb-fund-ii 2019-09: 0 sim entries | kb-fund-ii 2019-09: journal {"na":158312500,"cash":159375000,"inv":0,"fee":-1062500,"tb":0} engine {"na":184124841,"cash":5555620,"inv":179631721,"fee":-1062500,"tb":0} | kb-fund-ii 2019-10: 0 sim entries
FAIL repeat the books held sample entries when synced again :: {"sims":0}
SAMPLES BOOKS: FAIL (cases run: 2) - kestrel, repeat
```

### B1 RED (SCRATCH/exec-11-09/red-1b-repeat.txt: sim entries written, MANAGED not yet holding sim)
```
FAIL repeat kestrel-bay: a second sync posts and reverses nothing; the books are identical :: {"posted":157,"reversed":0,"exceptions":0}
FAIL repeat ashwell-ridge: a second sync posts and reverses nothing; the books are identical :: {"posted":173,"reversed":0,"exceptions":0}
FAIL repeat greywater: a second sync posts and reverses nothing; the books are identical :: {"posted":144,"reversed":0,"exceptions":0}
FAIL repeat pellbrook: a second sync posts and reverses nothing; the books are identical :: {"posted":269,"reversed":0,"exceptions":0}
SAMPLES BOOKS: FAIL (cases run: 2) - repeat
```

### Task 1 verify (code commit c331c1d)
```
PASS kestrel the first sync posted entries
PASS kestrel kb-fund-ii ties at all 86 month-ends (2019-09 to 2026-10): T3, 1000, 1100 + 1150, 2100, the trial balance
SAMPLES BOOKS: PASS (cases run: 1)
VERIFY1 OK
```
First sample entry of kb-fund-ii (from the check's output):
```
  first sample entry of kb-fund-ii: sim:kb-fund-ii:2019-09, dated 2019-09-30, memo "Sample fund: Sep 2019"
    6100 credit 25,812,341
    1000 credit 153,819,380
    1100 debit  125,975,727
    1150 debit  53,655,994
    sum 0
```
POSTING after Task 1: `POSTING: PASS (cases run: 13)`.

<!-- gsd:write-continue -->
