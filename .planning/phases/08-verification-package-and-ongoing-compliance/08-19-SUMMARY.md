---
phase: 08-verification-package-and-ongoing-compliance
plan: 19
subsystem: verification package (server screening route, investor device)
tags: [R12, aml, screening, package, cost-bound]
requires: [08-07, 08-15]
provides: [role names sealed on a package invitation, screened count in the screening reply, server count in the change log]
affects: [08-08 (adds monitoring to the same reply line), 08-12 (whether the provider bills per name)]
tech-stack:
  added: []
  patterns: [roles-only progress report, sealed invitation field, server count carried to the device's change log]
key-files:
  created:
    - server/test/package-names.test.mjs
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-names.js
  modified:
    - server/index.mjs
    - server/lib/invitations.mjs
    - assets/js/integrations.js
decisions:
  - "R12 role names reach the server through PUT /v1/invite/progress { roles } right before each package screening (planner's choice, kept); stored sealed as roleNames, only on an invitation that holds a package, at most 5"
  - "A roles report on an invitation without a package answers 200 and stores nothing (garbage in that case is not validated: nothing is stored)"
  - "The change log's count is the server's when the screenings that report one agree; each connection's count when they differ; the device's own count when none reports one"
metrics:
  started: 2026-11-20
  completed: 2026-11-26
status: complete
actuals:
  tokens: 16700
  tasks: 3
  commits: 13
plan_head_before: b90ca2a72407ad17849a314c2831f2d990deacde
plan_head_after: 86991b3f99bd1358dffd1cc7977202ae68162160
---

# Phase 08 Plan 19: R12 role names Summary

A package screening now screens the invitation's own names plus up to 5 role names the investor's onboarding holds (beneficial owners, a joint account's second holder), stored sealed on the server right before the screening and never taken from the screening call; the reply says how many names the server screened, and the "N names screened" line the console shows is that number. Built and tested against stand-ins only; not done until the owner has checked it.

## Failures first

1. The first full gate run (started 2026-11-20) was killed by the owner's stop of all work; it was resumed into the same folder on 2026-11-26 and passed (GATE_EXIT=0). Steps that passed before the stop on the same tree were kept (25 steps marked "kept from 2026-11-20 ...").
2. The plan's verify-3 condition `grep -qx "GATE ok   server tests 392 (found 392)"` fails on the resumed gate: the kept server step prints `GATE ok   server tests 392 (found 392) (kept from 2026-11-20 18:34:28 UTC)`. The fact holds (392 found, 392 expected, `# fail 0`, same HEAD 0a72858); every other verify-3 condition passes ($O/verify-3-tail.sh, output below).
3. After the gate, the owner's screenshot "owners-audit-line.png" turned out to show the AML/KYC table, not the screening line its description named. The check was corrected (commit 86991b3: it now opens the Integrations page's "Recent verification activity", asserts the line is on screen and screenshots it). The full gate ran on 0a72858, before that change; the corrected check alone passed on 86991b3 (`PACKAGE NAMES: PASS (parts run: 4)`, 83 PASS, 0 FAIL). The product code is identical between the two commits. A full gate rerun on 86991b3 was not done (about 2 hours of shared browser slots); the merge-time gate covers it.
4. Plan-check addition B1 was not applied as written: its premise (the owners do not exist at the first screening) is false on this tree. onboarding.js calls finishOnboarding when the profile step is confirmed (onboarding.js, the profile branch before `refreshSubscription`), which sets `inv.kyc.owners` before the identity step. Measured: when identity passes, round 1 already covers the owners (4 calls, role names stored first); the correction makes round 2 (4 calls, corrected name, old one absent); starts total 2. The check asserts the measured behaviour, which is the plan's original (stronger) version.
5. A test bug in Task 2's first RED run (see below), corrected before the RED that counts.

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

## Task 3 RED ($O/red3.txt: checks/package-names.js against the Task 2 code, integrations.js untouched)

First full run ($O/red3-first.txt, all four parts): owners FAIL, individual PASS (a guard: its screened count equals the device's count at the base too), both preview parts FAIL only on the base-label comparison (the constant was still empty; the run read the base labels, then the label reader was made to drop the select options and the constant filled from the base run). The final RED run, owners and the two preview parts:

```
FAIL owners when identity passes the world records four calls: the controlling person, the entity's name and the two owners :: {"calls":2,"names":["Odalys Vantongeren","Vantongeren Holdings LLC"]}
FAIL owners the server held the two role names before the first screening call :: [[],[]]
FAIL owners a new round of four calls holds the corrected name and not the old one :: {"calls":2,"names":["Odalys Vantongeren","Vantongeren Holdings LLC"]}
FAIL owners the corrected role names were stored before that round's first call :: []
FAIL owners that count is the server's: the number of calls in the last round :: {"line":4,"server":2}
FAIL owners the console screened nothing again on import (eight calls in all) :: 4
FAIL preview-desktop the profile step shows exactly the fields it showed at the base (the same labels) :: [...]
FAIL preview-phone the profile step shows exactly the fields it showed at the base (the same labels) :: [...]
PACKAGE NAMES: FAIL (parts run: 3) - owners, preview-desktop, preview-phone
```
The base run shows the bug this plan fixes: the investor's device logged "4 names screened" while the server screened 2 (the owners were never screened through the package).

## Task 3 GREEN ($O/green3.txt, integrations.js changed, constant set from the base run)

```
PACKAGE NAMES: PASS (parts run: 4)
EXIT=0
```
82 PASS lines, 0 FAIL. Key lines:
```
PASS owners when identity passes the world records four calls: the controlling person, the entity's name and the two owners
PASS owners the server held the two role names before the first screening call
PASS owners a new round of four calls holds the corrected name and not the old one
PASS owners the corrected role names were stored before that round's first call
PASS owners package screening starts total 2 (the limit is 3)
PASS owners the console imports and the investor's last screening line reads "4 names screened"
PASS owners that count is the server's: the number of calls in the last round
PASS owners the console screened nothing again on import (eight calls in all)
```

## Before the gate: `npm --prefix server test` alone ($O/npm-test.txt)

```
1..392
# tests 392
# suites 0
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 18461.738153
```
COUNTS: base 387 + own 5 = 392.

## Full gate (verify-3.sh's gate, resumed into the same folder: $O/gate-resume.sh; the stopped first run is $O/gate-run1-stopped.txt)

Every GATE line, in order (25 marked "(kept from 2026-11-20 ...)" in the file, passed on the same tree before the stop):
```
GATE ok   server tests # fail 0
GATE ok   server tests 392 (found 392)
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE / owner's folder
GATE ok   EMAIL DIALOG (3) · AGREEMENT NAME · TAX REQUEST LEAVE (5) · WAYS OUT (7) · NO NETWORK (3) · EMBED DATA (3)
GATE ok   SAFARI FINISH (6) · BANK STEP TYPING (2) · HELP CHAT (10) · REAL FIRM (9) · SIGNING DOCUMENTS (8) · PHONE LAYOUT (8)
GATE ok   RECORD AND LOST AGREEMENT (7) · SCREEN EDGES (5) · WALK3 FIXES (9) · TITLES AND EDITOR (4)
GATE ok   PRESS AND CO-INVESTOR (10) · CO-INVESTOR SERVER (5) · HELP PREVIEW (6)
```
The gate's last lines, verbatim:
```
GATE ok   phase-8 gate checks found (5)
GATE ok   AML RECORD (7)
GATE ok   PACKAGE FLOW (7)
GATE ok   PACKAGE INVITE (12)
GATE ok   PACKAGE NAMES (4)
GATE ok   PACKAGE PANEL (7)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 392
# pass 392
# fail 0
COUNTS server tests 392; AML RECORD 7; PACKAGE FLOW 7; PACKAGE INVITE 12; PACKAGE NAMES 4; PACKAGE PANEL 7
GATE_EXIT=0
```
verify-3's conditions after the gate ($O/verify-3-tail.sh):
```
ok    GATE_EXIT=0
FAIL  server tests 392 exact line
ok    server tests 392 line, kept form
ok    COUNTS server tests 392
ok    phase-8 gate checks found (5)
ok    PACKAGE NAMES (4)
ok    server/index.mjs numstat 2 2
ok    invitations.mjs no line removed
ok    only the five files (summary filtered, B2)
```
COUNTS: base 387 + own 5 = 392. Server tests: exactly 392, `# fail 0`.

## Owner's screens

/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-08-19/owner-shots/index.txt (5 screens from the check run on 86991b3: the entity profile with two owners at 1280x800, the Integrations page's "Recent verification activity" with "Vantongeren Holdings LLC: 4 names screened.", the individual's profile at 390x844, the preview's entity profile at both sizes).

Owner check (from the plan): in the published preview on the iPhone, open an invitation link for an entity investor and go through the profile step to the identity step: the same fields as before (the second beneficial owner still optional), no error text. The screening itself needs a connected portal (08-12).

## Deviations from Plan

1. [Rule 1 - plan-check premise] B1 not applied as written; the measured behaviour is asserted (see Failures first, 4).
2. [Rule 3] There is no "Change your answers" control on the profile step (that label belongs to the tax step); the owners part corrects the second owner by going Back to the profile step, then continuing.
3. [TDD order] Task 1's "roles must be a list" (400) and "stored only on a package invitation" were built in Task 2, driven by its failing "R12 roles:" test, so invitations.mjs stays additions-only across every commit (numstat deletions 0).
4. [Save rules] Task 2 and Task 3 code landed in "wip(08-19): save" commits (pushed after every edit round); the task commits e088def and 0a72858 record the evidence. The GSD plan ledger could not be written into the shared git dir from the isolated worktree; the base is kept in $O/base-commit.txt.
5. Base server tests 387, not the 358 in the plan text (08-CONTEXT wave 6 W1 says 387); phase-8 gate checks at the base 4, so the gate expects 5.
6. B2 applied: the final file-list comparison filters this plan's summary.
7. The preview parts compare the profile labels with a constant read from the base UI by this check's own first run (integrations.js untouched then; the plan changes no onboarding screen).
8. One assertion added after the gate run (the console shows the line on screen), with the screenshot fix (Failures first, 3).

## Assumed provider behaviours (stand-ins only; nothing confirmed)

- The identity and screening provider screens one name per call (`full_name` in the stand-in's screening call, server/plugins/idcheck.mjs ASSUMED.screen), so one package start costs one call per name: at most the invitation's names (2) plus 5. Whether the provider bills per name is unconfirmed (R11, for 08-12).
- No provider code or fixture was changed; no new ASSUMED entry.

## Threat model

T-08-54 (cost): at most 5 stored role names, body names ignored for a package, 3 starts per kind: tests "R12 names:" and "R12 no leak:" (3 x 7 calls, fourth start 409 with no call). T-08-55 (disclosure): sealed, package-only, in no reply, event, log line, invitation row, GET /v1/invite or outbox: tests "R12 roles:" and "R12 no leak:", eight mutation runs. No new surface beyond the planned roles report.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: server/test/package-names.test.mjs, .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-names.js
- FOUND commits: 966f955, e088def, 0a72858, 86991b3 (ancestors of HEAD, pushed to wip/08-19)
