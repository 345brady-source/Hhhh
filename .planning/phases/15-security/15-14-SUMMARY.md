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

### Task 3
RED (red-3.txt, f5fd5a8; auth-notices.test.mjs 5 and auth-carried.test.mjs 2):
```
not ok 1 - invite login workspace record        ('the sign-in made the workspace record': actual ~)
not ok 2 - confirm a firm made before confirmations ('sign-in offers the link')
not ok 3 - password change                      ('two-step turned on: one notice')
not ok 4 - confirmation                         ('sign-up emails a #confirm- link': actual '')
not ok 5 - new device                           ('the first full sign-in sets the device cookie': actual '')
not ok 6 - lock                                 ('one notice for the lock, not one per try')
not ok 7 - invitations emailed and ended access
# tests 7
# pass 0
# fail 7
```
First full suite after the code (all-a.txt): `# tests 616`, `# pass 614`, `# fail 2`: roles.test.mjs "each role" (an
unconfirmed firm's Owner now gets 403 'Confirm your email address first: ...' on POST /v1/invitations) and "accountant
ends" (the ended Accountant's sign-in itself is now refused 403, so the test's member() could not sign in). Both are
this plan's rules; the two tests were adapted (deviations below), then all-b.txt: `# tests 616`, `# pass 616`, `# fail 0`.
