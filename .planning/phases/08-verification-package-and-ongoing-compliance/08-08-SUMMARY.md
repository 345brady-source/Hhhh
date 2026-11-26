---
phase: 08-verification-package-and-ongoing-compliance
plan: 08
status: in-progress
---

# Phase 8 Plan 08: Ongoing screening (monitoring alerts, free re-screen) Summary

Evidence is pasted here as it is produced (save rule 5). The final sections are written at the end.

S = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad, O = S/exec-08-08.

## Step 0 (base 8eff49a)

- base-commit.txt: 8eff49a61ec66c195cc8fae06e067d0fcec68073 (claude/refract-reskin tip at start; 8eff49a is HEAD itself)
- base-count.txt: 456 (server suite on the base: `# tests 456`, `# fail 0`). Plan text said 363; plan-check W1 said 456: matches.
- base-checks.txt: 6 phase-8 gate checks (AML RECORD, PACKAGE CONSOLE, FLOW, INVITE, NAMES, PANEL)

## Task 1 (tracer): RED, then GREEN

RED server ($O/red-srv.txt, the tracer test before any code):

```
not ok 1 - changed tracer: a signed monitoring alert on a clear screening is listed once, after the time asked from, with its hits and monitoring
# tests 1
# fail 1
```
(the route answered 404: `expected: 200 actual: 404`)

RED check ($O/red.txt, run from a `git archive` copy of the RED commit 2b6943b so code written meanwhile could not leak into it):

```
FAIL alert with nothing pressed, the console holds the investor for review with the alert's hit :: {"title":"Odalys Vantongeren","identity":"passed","aml":"clear",...
FAIL alert the AML/KYC page reads "Needs review" for the investor :: null
FAIL alert ran to the end :: page.click: Timeout 30000ms exceeded.
MONITORING: FAIL (parts run: 1) - alert
```

GREEN: $O/verify-1.sh exactly as the plan gives it, run in a `git archive` copy of 307c99d (Task 1's code; the worktree had moved on to Task 2's tests): `VERIFY1_EXIT=0`; srv1.txt `# tests 1`, `# fail 0`; tracer.txt last line `MONITORING: PASS (parts run: 1)`.

## Task 2: RED

RED server ($O/red2-srv.txt, the five new tests against Task 1's code):

```
not ok 5 - changed reply: POST /v1/screenings answers monitoring true for a monitored screening and false otherwise
# tests 6
# fail 1
```

Tests 2, 3, 4 and 6 passed on Task 1's code (the route was written whole in Task 1); each is a guard, each shown failing under a mutation ($O/mutations.txt):

```
MUTATION who (the query wins over the account): not ok 1 - changed who: # fail 1
MUTATION rules (no cut at 500): not ok 1 - changed rules: # fail 1
MUTATION rules-pending (pending records listed): not ok 1 - changed rules: # fail 1
MUTATION private (the name screened kept on hits): not ok 1 - changed private: # fail 1
MUTATION verifications (identity checks lose their screening): not ok 1 - changed verifications: # fail 1
MUTATION apply (index.mjs apply sets changedAt on every result written): not ok 1 - changed rules: # fail 1
```

<!-- gsd:write-continue -->
