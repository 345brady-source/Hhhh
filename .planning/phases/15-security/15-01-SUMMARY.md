---
phase: 15-security
plan: 01
status: in-progress
---

# Phase 15 Plan 01: server sign-in (draft, saved while the gate runs)

## Failures first
- None so far in the plan's own checks. The full gate (gate13.sh with every phase) is running; its result goes here.

## RED outputs (saved in SCRATCH/exec-15-01)
- red-1.txt (Task 1, at a1338b4): `not ok 1 - sign-up to me` / `expected: 201` / `actual: 404` / `# pass 0` / `# fail 1`
- red-2.txt (Task 2): `ok 1 - sign-up to me`, `ok 2 - https cookie`, `not ok 3 - password rules` ... `not ok 9 - sealed and minimal`; `# tests 9` `# pass 2` `# fail 7`
- red-3.txt (Task 3): `not ok 1 - open server closes` (`expected: 401` `actual: 200`), `not ok 2 - session pin`, `not ok 3 - stage gates`, `not ok 4 - csrf`, `ok 5 - tokens unchanged`, `ok 6 - status`, `not ok 7 - operator`; `# tests 7` `# pass 2` `# fail 5`

## Verify lines
- Task 1 t1.txt: `# tests 1` `# pass 1` `# fail 0` (VERIFY=0)
- Task 2 t2.txt: `# tests 9` `# pass 9` `# fail 0`; `list.js: OK` `LICENSE: OK`; list check and `grep -q timingSafeEqual` passed (VERIFY=0)
- Full suite all.txt: `# tests 438` `# pass 438` `# fail 0` (base 422 at a1338b4 + 16)
- scrypt N=2^15, r=8, p=3: 260 ms for one check on this machine (one run timed alone).
