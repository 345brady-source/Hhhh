---
phase: 08-verification-package-and-ongoing-compliance
plan: 19
status: in-progress
---

# Phase 08 Plan 19: R12 role names (in progress, evidence pasted as produced)

## Step 0 (base b90ca2a72407ad17849a314c2831f2d990deacde)

- base server tests: 387 (`# tests 387`, `# fail 0`); the plan text expected 358, 08-CONTEXT wave 6 W1 says 387 today (13-02 and later merges added tests).
- phase-8 gate checks at the base: 4 (aml-record, package-flow, package-invite, package-panel; 08-17's package-console not merged yet).

## Task 1 RED ($O/red.txt, against b90ca2a plus the new test file only)

```
not ok 1 - R12 names: a package screening from the link screens the invitation’s names plus at most 5 stored role names, never a name from the call’s body
not ok 2 - screened: the screening reply says how many names the server screened
# tests 2
# pass 0
# fail 2
```
(both fail on `expected: 200, actual: 400`: the progress route refused a roles-only report.)

## Task 1 verify (verify-1.sh, exit 0)

```
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 410.56182
VERIFY1_EXIT=0
```
Commit 966f955.
