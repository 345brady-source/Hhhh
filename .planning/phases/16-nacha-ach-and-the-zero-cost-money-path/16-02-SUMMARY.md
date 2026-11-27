---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 02
status: in-progress
---

# Phase 16 Plan 02: payment file record (in progress)

Start commit: 38a85ea0f5f3c62e74a629ef7589a67846d6751f

## Evidence (pasted as produced)

### RED 1 (Task 1, `node file-record.js --case record`, before achrecord.js exists; O/red-1.txt)

```
FAIL record NS.achRecord is loaded with the portal
PASS record the fixture file has no red check
FAIL record B4: a recorded run with no file record is refused a file without a reason :: Cannot read properties of undefined (reading 'recordFile')
FAIL record ran to the end :: TypeError: Cannot read properties of undefined (reading 'ensure')
FILE RECORD: FAIL (cases run: 1) - record
```

### Task 1 verify (verify1.sh = the plan's Task 1 automated line)

```
PASS record a second file for that run without a reason is refused with the sentence
PASS record and nothing more is stored
FILE RECORD: PASS (cases run: 1)
VERIFY1_EXIT=0
```
