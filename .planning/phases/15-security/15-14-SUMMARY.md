---
phase: 15-security
plan: 14
status: in-progress
---

# Phase 15 Plan 14: account emails and resets (draft, filled in as the work goes)

## Evidence as produced

Start commit ef87afaff562d58f7b3b414ce57f94b71b709ea0; base server suite measured on it: `# tests 601`, `# pass 601`, `# fail 0`.

### Task 1
RED (red-1.txt, commit 8b3efbf):
```
not ok 1 - reset by email
  expected: 200
  actual: 401
# tests 1
# pass 0
# fail 1
```
Verify (t1.txt, after d2482a7): `# tests 1`, `# pass 1`, `# fail 0`; verify exit 0.
