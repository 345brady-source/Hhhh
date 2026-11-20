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

## Verify lines

### Task 1 verify (the plan's command, run verbatim from SCRATCH/exec-12-05/verify-1.sh with GATE_FRESH=1)

```
==> .../exec-12-05/t1a.txt <==
PASS fund-a t-season: no vendor, library or model name, never audited or the forbidden word (text and properties)
REPORTS STARTERS: PASS (cases run: 1)

==> .../exec-12-05/t1b.txt <==
PASS fund-a no cell holds a formula (openpyxl)
REPORTS XLSX: PASS (cases run: 1)
VERIFY-1 EXIT=0
```
Tracer feedback gate: verify rerun end to end and passed; expansion continued. The st-capital PDF text for FA-1001 was also read by eye (capital table, commitment tiles, activity, distributions, chart): figures as worked by hand.
