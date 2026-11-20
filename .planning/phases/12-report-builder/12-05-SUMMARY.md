---
phase: 12-report-builder
plan: 05
status: in progress
---

# Phase 12 Plan 05: starter templates and spreadsheets (in progress)

Evidence is pasted here as it is produced (SAVE-RULES rule 5). Base commit: da1ce239c472d3a0a287571b7b953d0eac780ac8.

## RED outputs

### red-1 (Task 1, case fund-a in both checks, before assets/js/reports-templates.js existed)

```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a4dc0c45bff2a32b0/assets/js/reports-templates.js'
    at Object.readFileSync (node:fs:440:20)
    at .../11-fund-accounting-and-cpa-year-end-package/checks/load11.js:159:24
    ...
REPORTS STARTERS: FAIL (cases run: 1) - fund-a
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a4dc0c45bff2a32b0/assets/js/reports-templates.js'
    ...
REPORTS XLSX: FAIL (cases run: 1) - fund-a
```
