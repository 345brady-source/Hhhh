---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 12
status: in-progress
---

# Phase 11 Plan 12: new audit schedules (draft, filled in as results come)

Started from 6b3a4a3 (base-commit.txt). The owner has not checked this.

## Evidence so far

Task 1 RED (red-1.txt), on the base tree:
```
FAIL fund-a build returns a trial balance schedule '20_Trial_balance.csv' titled 'Trial balance' :: null
NEW SCHEDULES: FAIL (cases run: 1) - fund-a
```
Task 1 GREEN: `NEW SCHEDULES: PASS (cases run: 1)` (fund-a.txt).

Task 2 RED (red-2.txt):
```
FAIL gl build returns '21_General_ledger.csv' titled 'General ledger' :: null
NEW SCHEDULES: FAIL (cases run: 7) - gl, bankrec, ratios, ties
```
Task 2 RED for B1 (red-2b.txt: gl, bankrec, ratios built, build still syncing only real funds):
```
FAIL ties kb-fund-ii fy (2025-01-01 to 2025-12-31): the statements tie :: ["ops net increase 1594657 != journal results 0","soi total cost 661348935 / fair value 943032847 != 1100 0 / 1100+1150 0","cf cash at end 0 != al cash 29165964"]
NEW SCHEDULES: FAIL (cases run: 1) - ties
```
(28 FAIL lines: every sample fund, both periods.)
Task 2 GREEN: `NEW SCHEDULES: PASS (cases run: 7)` (new.txt); ties over 15 sample funds, two periods each, 4,223 ms.
