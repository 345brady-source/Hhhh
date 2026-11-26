---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 18
subsystem: operations (seeded sample calls), phase 11 checks
tags: [businessDays, sample-data, change-log, audit-same, FA-03]
status: in-progress
requires: [11-04, 11-08, 11-10]
provides:
  - NS.ops.businessDays counts back for n < 0
  - checks/business-days.js (BUSINESS DAYS, 3 cases)
  - AUDIT SAME's moved-notice rule, built from the base
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/business-days.js
  modified:
    - assets/js/operations.js
    - assets/js/books-bank.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/audit-same.js
plan_head_before: 5b85eee7dcadad715c362fd06713095228e212d7
---

# Phase 11 Plan 18: the businessDays fix Summary

Seeded sample capital calls are now noticed ten business days before they are due (they were noticed on their due date), and AUDIT SAME allows exactly that change, built from the base, and still reports everything else. The owner has not checked it.

<!-- gate results follow -->

## RED outputs (on the unchanged code, before each fix)

### red-1.txt: `node checks/business-days.js` on 5b85eee (before the operations.js fix)

```
FAIL back businessDays('2026-03-16', -10) is '2026-03-02' (two weeks back, across two weekends) :: got 2026-03-16
FAIL back businessDays('2026-03-16', -1) is '2026-03-13' (Monday to Friday, across a weekend) :: got 2026-03-16
FAIL back businessDays('2026-04-01', -3) is '2026-03-27' (across a month end and a weekend) :: got 2026-04-01
FAIL back businessDays('2026-01-05', -2) is '2026-01-01' (across a year end; no holidays, the same count as audit.js weekdayBack and books-bank.js businessBack) :: got 2026-01-05
FAIL back businessDays('2026-03-15', -1) is '2026-03-13' (from a Sunday) :: got 2026-03-15
PASS sweep forward: n 1 to 15 gives the oracle's day (3287 days, 49305 counts)
FAIL sweep back: n -1 to -15 gives the oracle's day (3287 days, 49305 counts) :: 49305 mismatches; first: (2019-01-01, -1) gave 2019-01-01, expected 2018-12-31; ...
PASS sweep zero: n 0 gives the day itself (3287 days)
FAIL seeded diy kestrel-bay: kb-fund-ii-call-1 (due 2019-09-30) is noticed 2019-09-16, ten business days before it is due :: notice 2019-09-30
FAIL seeded diy kestrel-bay: the change log's one 'Capital call issued' row for kb-fund-ii-call-3 is dated 2020-10-01 :: ["2020-10-15T12:26:36Z"]
... (36 FAIL seeded lines in all: 9 notices and 9 log rows, in each edition; 20 PASS seeded lines: the firm set, the
    complete-call sets, pb-ventures-i-call-5 open with notice 2026-10-28, NS.audit.verify ok for all four firms)
BUSINESS DAYS: FAIL (cases run: 3) - back, sweep, seeded
```

GREEN after the fix (bd.txt): `BUSINESS DAYS: PASS (cases run: 3)`, 64 PASS, 0 FAIL. `git diff --numstat 5b85eee -- assets/js`: `1 1 assets/js/books-bank.js`, `2 1 assets/js/operations.js`.

### red-2.txt: the old audit-same.js `--case same` against the base (5b85eee), on the fixed tree

```
PASS same tree side loads the scripts this tree's page adds after operations.js: none
FAIL same diy: every schedule, period figure and package entry the base builds is the same in this tree (464 schedules, 30 packages of 15 funds) :: ["diy kb-fund-ii fy: log; zip 15_Change_log.csv: bytes differ (base fa452985e725, tree 9706596e984d); zip MANIFEST.sha256: the line for 15_Change_log.csv differs","diy kb-fund-ii itd: log; zip 15_Change_log.csv: bytes differ (base fb97e8782808, tree 6b31c7051824); ...","diy kb-harlow fy: log; ...
FAIL same managed: ... ["managed kb-fund-ii fy: log; zip 15_Change_log.csv: bytes differ (base ba848086d7b3, tree 7c3fb541b86a); zip MANIFEST.sha256: the line for 15_Change_log.csv differs", ...
PASS same diy run twice: the same 494 hashes
compared 928 schedules and 60 packages (26 byte-identical as whole files) of 15 funds
AUDIT SAME: FAIL (cases run: 1) - same
```

### red-2b.txt: `--case selfcheck` with noticeRules added, before the rule existed

```
PASS selfcheck ... (the 14 existing flag and zipRules checks pass)
FAIL selfcheck ran to the end :: ReferenceError: firmExpect is not defined
AUDIT SAME: FAIL (cases run: 1) - selfcheck
```

## Task 2 verify (same.txt, GATE_FRESH=1, against the base 5b85eee; 32.3 s wall clock for all four cases)

```
expected differences built from the base (diy): kestrel-bay 5 (kb-fund-ii-call-1 2019-09-30 -> 2019-09-16, kb-fund-ii-call-2 2020-03-31 -> 2020-03-17, kb-fund-ii-call-3 2020-10-15 -> 2020-10-01, kb-fund-ii-call-4 2021-06-30 -> 2021-06-16, kb-fund-ii-call-5 2022-03-31 -> 2022-03-17); pellbrook 4 (pb-ventures-i-call-1 2023-03-31 -> 2023-03-17, pb-ventures-i-call-2 2023-10-02 -> 2023-09-18, pb-ventures-i-call-3 2024-06-28 -> 2024-06-14, pb-ventures-i-call-4 2025-04-15 -> 2025-04-01)
PASS same diy: every schedule, period figure and package entry the base builds is the same in this tree, or exactly the expected difference above (464 schedules, 30 packages of 15 funds)
(the same line for managed)
PASS same diy run twice: the same 494 hashes
PASS mutate the one-cent change is reported as a mismatch naming the fund, the period and at least one schedule id
PASS selfcheck notice rule base: ... (4 lines), notice rule allowed: ... (5 lines), notice rule reported: (a) to (g) (8 lines)
AUDIT SAME: PASS (cases run: 4)
```

The base code with this tree's checks (unfixed.txt): `AUDIT SAME: FAIL (cases run: 1) - same`, starting `"diy kestrel-bay: calls: kb-fund-ii-call-1 notice 2019-09-30, expected 2019-09-16"`, then the other four calls, `change log: seq 2 at differs from the expected`, and `zip 15_Change_log.csv: not the bytes the expected difference gives (base fa452985e725, expected 9706596e984d, tree fa452985e725)`. The expected hash 9706596e984d is the hash the fixed tree produced in red-2.txt: the rule rebuilt from the base gives the fixed tree's bytes exactly.
