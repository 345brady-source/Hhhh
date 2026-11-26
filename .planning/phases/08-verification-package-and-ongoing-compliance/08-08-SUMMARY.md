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

RED check ($O/red2.txt, parts hold-only, monitored-not-due, package-not-run run from an archive of Task 1's commit 307c99d with the new check file):

```
FAIL monitored-not-due the monitored investor has no next re-screen date (nor a next review on the AML/KYC record) :: {"nextScreen":"2026-11-16","nextReview":"2026-11-16"}
FAIL monitored-not-due only the other investor counts as due for re-screening :: ["KBC-1001","KBC-1002"]
FAIL monitored-not-due "Run now" re-screens the other investor only :: {"toast":"2 investors re-screened","other":"2026-12-26","same":false}
FAIL monitored-not-due a screening whose every result is monitored sets no next re-screen date :: {"id":"KBC-1003","next":"2026-12-26","monitoring":[false],"review":"2026-12-26"}
FAIL package-not-run through the Treasury connection only: one list read, one screening asked of the server, for the Treasury lists :: {"reads":1,"posts":["ofac","ownscreen"]}
FAIL package-not-run the package result is kept as it was, the Treasury result is added, the next date moved :: {... "aml":"pending" ...}
FAIL package-not-run with no Treasury connection, the package investor is left out of "Run now" (no line at all) :: [...]
FAIL package-not-run nothing was called for the package investor: no list read, no screening asked of the server, no package provider call :: {"reads":1,"posts":["ofac","ownscreen"],"calls":0}
MONITORING: FAIL (parts run: 3) - monitored-not-due, package-not-run
```

Before the fix, "Run now" on a package investor ran every screening connection the firm had on, the sponsor's own paid connector included (`posts: ["ofac","ownscreen"]`), and replaced the package result.

hold-only passed on Task 1's code (the pull already only held): a guard, shown failing under a mutation ($O/mutations.txt, $O/mut-browser.txt):

```
MUTATION pull (pullChanged writes whatever status a pulled record says, so a clear record clears): FAIL hold-only a server record that reads clear does not clear the held investor
```

## Task 3: RED

RED check ($O/red3.txt, parts auto-free, once, preview-desktop, preview-phone run from an archive of Task 2's commit 4ca1857):

```
FAIL auto-free with no click, the console re-screens the due investor when it loads :: {"moved":false,"clicks":0}
FAIL auto-free one change-log entry "Re-screened automatically", naming the investor :: []
FAIL auto-free the next date moved by the firm's interval (30 days) :: 2026-11-25
FAIL auto-free through the Treasury connection alone: one list read, one screening asked of the server, for the Treasury lists :: {"reads":0,"posts":[]}
FAIL once loads at once start one run: one Treasury screening on the server, one list read, one change-log entry :: {"screenings":0,"reads":0,"posts":[]}
FAIL once a run that got no answer was tried once for that due date and writes nothing :: {"tried":0,"posts":0,"next":"2026-11-24"}
MONITORING: FAIL (parts run: 4) - auto-free, once
```

preview-desktop and preview-phone passed on Task 2's code (nothing ran by itself there before either): guards, shown failing under a mutation:

```
MUTATION preview (resume and ongoing run with no server connected): FAIL preview-desktop and preview-phone: the frame recorded no refused connection (connect-src .../v1/checks/changed)
MONITORING: FAIL (parts run: 3) - hold-only, preview-desktop, preview-phone
```

Before the gate, the whole check on the final tree ($O/full1.txt, a12b2b9's code): `MONITORING: PASS (parts run: 8)`; the whole server suite ($O/server-pre.txt): `# tests 462`, `# fail 0`.

<!-- gsd:write-continue -->
