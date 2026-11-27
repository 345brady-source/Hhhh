# Phase 15 Plan 04: two-step sign-in, recovery codes, POST /v1/invite/login (in progress)

Evidence as produced (save rule 5). Start commit 4b0aec90882a5efd52320db8805448d1dc753784; base suite 502 tests, 502 pass.

## Task 1 (tracer)
RED (red-1.txt, at 30c3582):
```
not ok 1 - set up and sign in
  expected: 200
  actual: 404
# tests 1
# pass 0
# fail 1
```
GREEN (t1.txt, at 6473bfe), plan verify exit 0:
```
# tests 1
# pass 1
# fail 0
```
Tracer gate: verify re-run end to end passed; auth.test.mjs + auth-gate.test.mjs 16/16 still pass.

## Task 2
RED (red-2.txt, at 1706d91):
```
ok 1 - set up and sign in
not ok 2 - replay and window
  expected: 400
  actual: 401
not ok 3 - wrong codes
  expected: 'Too many wrong codes. Sign in again.'
  actual: 'That code is not right. Check the time on your phone and try the newest code.'
not ok 4 - recovery
  expected: 200
  actual: 401
not ok 5 - side doors
  expected: 401
  actual: 404
not ok 6 - investors
  expected: 401
  actual: 404
# tests 6
# pass 1
# fail 5
```
GREEN (t2.txt, at d7921d2), plan verify exit 0:
```
# tests 6
# pass 6
# fail 0
```

## Task 3
RED (red-3.txt, at ec9c31d; "secrets" already passed: its behaviour was built with Task 1):
```
not ok 1 - resets
  expected: 200
  actual: 404
not ok 2 - sessions
  expected: 200
  actual: 404
ok 3 - secrets
not ok 4 - key change
  expected: 200
  actual: 401
not ok 5 - invite login
  expected: 403
  actual: 404
# tests 5
# pass 1
# fail 4
```
GREEN, full server suite (all.txt, at 71716a2), plan verify (run from a script file) VERIFY3=0:
```
# tests 513
# suites 0
# pass 513
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 47546.356945
VERIFY3=0
```
513 = base 502 + 11.
