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
