---
phase: 12-report-builder
plan: 03
status: in-progress
---

# Phase 12 Plan 03: the PDF composer (evidence as produced)

Nothing here is ready until the owner has checked it. Evidence is pasted the moment it exists (SAVE-RULES rule 5).

## RED outputs

### red-1 (Task 1, case compose, before assets/js/reports-pdf.js existed)

```
FAIL compose ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a19edbb0970a5684b/assets/js/reports-pdf.js'
    at Object.readFileSync (node:fs:440:20)
    at /home/user/Hhhh/.claude/worktrees/agent-a19edbb0970a5684b/.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/load11.js:159:24
    ...
REPORTS PDF: FAIL (cases run: 1) - compose
```

## Verify lines

### Task 1 verify (exit 0)

```
PASS compose each page carries 'Page n of N'
PASS compose the recipient and the firm print with their accents and Polish letters
REPORTS PDF: PASS (cases run: 1)
```
