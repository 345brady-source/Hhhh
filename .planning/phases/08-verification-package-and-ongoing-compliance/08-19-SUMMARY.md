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

## Task 2 RED ($O/red2.txt, the three new tests against the Task 1 code)

A first run ($O/red2-first.txt) also failed "R12 outside the package:", from a test bug: a package invitation always screens with the package connection (packageConnections overwrites use.aml), so the firm's own provider is refused there (403 "This screening is not one the firm uses"). The test was corrected to use a shared-token invitation with role names planted sealed on its record, then rerun:

```
ok 1 - R12 names: a package screening from the link screens the invitation’s names plus at most 5 stored role names, never a name from the call’s body
ok 2 - screened: the screening reply says how many names the server screened
not ok 3 - R12 roles: role names are stored sealed, only for a package invitation, replaced by a later report, refused when not a list, never after completion
ok 4 - R12 outside the package: the shared token and a screening provider outside the package screen as before and never add role names; a sponsor account still cannot call the package provider
ok 5 - R12 no leak: no role name in any event, log line, invitation row, GET /v1/invite or the outbox; three starts cost at most 3 x 7 calls, a fourth is refused with none
# tests 5
# pass 4
# fail 1
```
(test 3 fails on `expected: 400, actual: 200`: "roles must be a list" was not enforced; the package-only rule was missing too.)

## Task 2 mutation runs ($O/mutations.txt; guards that passed at the Task 1 code; each mutation restored after its run)

```
## M1 role names also stored unsealed beside the sealed copy (server/lib/invitations.mjs); guard: R12 roles: -> FAILS as required
not ok 3 - R12 roles: ...
# fail 1
## M2 a step report clears the stored role names (server/lib/invitations.mjs); guard: R12 roles: -> FAILS as required
not ok 3 - R12 roles: ...
# fail 1
## M3 role names added to every screening from a link (the firm's own provider too) (server/index.mjs); guard: R12 outside the package: -> FAILS as required
not ok 4 - R12 outside the package: ...
# fail 1
## M4 the package gate removed from the screening route (sponsor account reaches the package provider) (server/index.mjs); guard: R12 outside the package: -> FAILS as required
not ok 4 - R12 outside the package: ...
not ok 5 - R12 no leak: ...
# fail 2
## M5 the progress handler logs the role names (server/lib/invitations.mjs); guard: R12 no leak: -> FAILS as required
not ok 5 - R12 no leak: ...
# fail 1
## M6 the invitation row lists the role names (server/lib/invitations.mjs); guard: R12 no leak: -> FAILS as required
not ok 5 - R12 no leak: ...
# fail 1
## M7 the roles report writes an event with the names (server/lib/invitations.mjs); guard: R12 no leak: -> FAILS as required
not ok 3 - R12 roles: ...
not ok 5 - R12 no leak: ...
# fail 2
## M8 a sixth role name kept (limit 6) (server/lib/invitations.mjs); guard: R12 no leak: -> FAILS as required
not ok 1 .. not ok 5 (all five)
# fail 5
```
(test titles shortened here with "..."; the full lines are in $O/mutations.txt.)

## Task 2 verify (verify-2.sh, exit 0)

```
# tests 392
# suites 0
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15756.121338
COUNTS: base 387 + own 5 = 392
VERIFY2_EXIT=0
```
