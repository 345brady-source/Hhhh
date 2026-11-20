---
phase: 12-report-builder
plan: 02
status: in-progress
---

# Phase 12 Plan 02: Report model (evidence, written as produced)

Base commit: 96bbdf6800f8b9190a02bf66f1483a2884717598

## RED outputs (verbatim)

### Task 1 RED (red-1.txt, `node checks/reports-model.js --case resolve`, before reports.js existed)

```
FAIL resolve ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-ac2f7134af2f3e0d4/assets/js/reports.js'
    at Object.readFileSync (node:fs:440:20)
...
REPORTS MODEL: FAIL (cases run: 1) - resolve
```

### Task 1 verify (verbatim tail, VERIFY_EXIT=0)

```
PASS resolve the last blocks are the disclosures with the tenant disclaimer
PASS resolve no HTML anywhere in the model
REPORTS MODEL: PASS (cases run: 1)
VERIFY_EXIT=0
```

### Task 2 RED (red-2.txt, `--case resolve,template,richtext,merge,split`, before the Task 2 code; FAIL lines and the last line, each cut at 200 characters)

```
FAIL template ran to the end :: TypeError: R.startFrom is not a function
FAIL richtext ran to the end :: TypeError: R.sanitize is not a function
FAIL merge MERGE_FIELDS is exactly the 12 names :: {"expected":["first_name","account_name","investment","firm","team","phone","period","period_end","ending_capital","distributions_period","commitment
FAIL merge ran to the end :: TypeError: Cannot read properties of undefined (reading 'map')
FAIL split SPLIT_LABELS :: {"expected":["Return of capital","Income","Interest","Capital gain","Other"]}
FAIL split ran to the end :: TypeError: R.setSplit is not a function
REPORTS MODEL: FAIL (cases run: 5) - template, richtext, merge, split
```

### Task 2 verify (verbatim tail, VERIFY_EXIT=0)

```
PASS split ws.runs is unchanged (JSON before and after)
PASS split the split lives in ws.reports.splits only
REPORTS MODEL: PASS (cases run: 5)
VERIFY_EXIT=0
```
