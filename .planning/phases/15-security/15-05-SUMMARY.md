---
phase: 15-security
plan: 05
status: in-progress
---

# Phase 15 Plan 05: roles on the server, the Team routes and the change log routes (in progress)

Start commit: 4b0aec90882a5efd52320db8805448d1dc753784. Base server tests measured there: 502.

## Evidence as produced

### Task 1 RED (red-1.txt)
```
not ok 1 - tracer
# tests 1
# pass 0
# fail 1
  expected: 403
  actual: 404
```
### Task 1 verify (t1.txt)
```
# tests 1
# pass 1
# fail 0
VERIFY=0
```
### Task 2 RED (red-2.txt)
```
ok 1 - tracer
not ok 2 - walk
not ok 3 - each role
not ok 4 - tokens once people exist
not ok 5 - accountant ends
ok 6 - audit routes
# tests 6
# pass 2
# fail 4
```
(audit routes already passed after Task 1, which built the audit routes with the tracer.)
### Task 2 verify (t2.txt)
```
# tests 6
# pass 6
# fail 0
VERIFY=0   (invitations.mjs: 3 added lines)
```
Full suite after Task 2: 508 tests, 508 pass.
