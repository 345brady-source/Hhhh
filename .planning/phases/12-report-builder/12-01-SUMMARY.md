---
phase: 12-report-builder
plan: 01
status: in-progress
---

# Phase 12 Plan 01: report figures (in progress; evidence pasted as produced)

## RED outputs

### red-1 (Task 1, case fund-a, before reports-data.js existed; base 96bbdf6)

```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a585f4b4f20977862/assets/js/reports-data.js'
    at Object.readFileSync (node:fs:440:20)
    at .../11-fund-accounting-and-cpa-year-end-package/checks/load11.js:159:24
    ...
REPORTS MATH: FAIL (cases run: 1) - fund-a
```

### red-2 (Task 2 cases written before their adapters; fund-a lines PASS from Task 1, omitted here)

```
FAIL statement ran to the end :: TypeError: D.holders is not a function
FAIL consolidated ran to the end :: TypeError: D.consolidated is not a function
FAIL distribution ran to the end :: TypeError: D.runs is not a function
PASS performance NS.audit.closedPerformance and NS.audit.openPerformance are functions
PASS performance kestrel-bay: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance ashwell-ridge: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance greywater: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance pellbrook: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance both kinds were compared (open and closed funds)
PASS performance no key named gross in any performance result or statement perf (C-07)
FAIL holdings ran to the end :: TypeError: D.holdings is not a function
FAIL fees ran to the end :: TypeError: D.fees is not a function
FAIL noi ran to the end :: TypeError: D.noi is not a function
REPORTS MATH: FAIL (cases run: 8) - statement, consolidated, distribution, holdings, fees, noi
```
Case performance passed at RED because Task 1 built performance() (the plan orders statement, distribution and performance into Task 1); its RED is red-1.

## Verify lines

### Task 1 (verify command run verbatim from a script file, after commit b8b927d)

```
PASS fund-a fund A DPI 0.02, RVPI 1.15, TVPI 1.17 (2 decimals)
PASS fund-a fund A IRR = the check's own Newton IRR to 4 decimals
REPORTS MATH: PASS (cases run: 1)
VERIFY-1 EXIT=0
```
(audit.js diff against base 96bbdf6: `2 0`, checked inside the same command.)

### Task 2 (verify command run verbatim from a script file)

```
PASS noi a holding with no income or property-expense line gives null
PASS noi fa-x in Q3 2026 (a valuation line only) gives null
REPORTS MATH: PASS (cases run: 8)
VERIFY-2 EXIT=0
```
Measured scope behind it: 816 statement rows compared (4 sample firms, 15 funds, 4 presets), 228 paid runs and 3,251 paid lines compared with runRows.
Mutation test (not committed): ytd account set to the period account and the cumulative made strict (`<` for `<=`): statement and distribution FAIL on all four firms; file restored with `git checkout`.
