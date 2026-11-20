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
