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

## Verify lines

### Task 1 (verify command run verbatim from a script file, after commit b8b927d)

```
PASS fund-a fund A DPI 0.02, RVPI 1.15, TVPI 1.17 (2 decimals)
PASS fund-a fund A IRR = the check's own Newton IRR to 4 decimals
REPORTS MATH: PASS (cases run: 1)
VERIFY-1 EXIT=0
```
(audit.js diff against base 96bbdf6: `2 0`, checked inside the same command.)
