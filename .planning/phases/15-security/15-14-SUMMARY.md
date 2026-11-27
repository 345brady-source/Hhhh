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

### Task 2
RED (red-2.txt, commit of the tests; emails.js put back to the base for the run):
```
ok 1 - reset by email
ok 2 - same answer
ok 3 - two-step not skipped
ok 4 - single use and expiry
not ok 5 - limits            (expected: 3, actual: 4)
not ok 6 - no readable link  (no 503)
not ok 7 - kinds             ("Cannot read properties of undefined (reading 'variants')")
not ok 8 - guard             (same)
# tests 8
# pass 4
# fail 4
```
Tests 2 to 4 passed already on Task 1's code (its request, check and confirm were built with one answer, single use
and the two-step rule); they are kept as the plan lists them.
Verify (t2.txt, 4ce4cde; W1 adds emails-kinds.test.mjs): `# tests 30`, `# pass 30`, `# fail 0` (8 new + render 8 +
guard 4 + kinds 10, the last three unchanged); verify exit 0.
