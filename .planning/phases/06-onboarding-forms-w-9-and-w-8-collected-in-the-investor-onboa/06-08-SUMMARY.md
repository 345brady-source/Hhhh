---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 08
subsystem: self-serve investor portal subscribe entry points; owner gate picture comparison
status: complete
tags: [gap-closure, verifier-gap-1, verifier-gap-4, c-05, d-30, d-01, c-03, rule-506b, regulation-a, erisa, white-label, t-06-18, t-06-19]
requires:
  - 06-01 (the 506(b) count, qual at the subscribe step)
  - 06-03 (Regulation A Tier 2 limit and warning)
  - 06-05 (qual.erisa, investor.erisa)
  - 06-07 (on-file prefill, withdrawGround in the invitation flow)
provides:
  - "NS.inviteFlow.selfInvite(ws, inv, o, { existing: true }): the investor's open invitation for this same offering, or a new one marked existing (sentBy 'Investor portal')"
  - "portal action sub-start (self-serve edition): Investments 'Review and subscribe' and the subscribe address box start the guided subscription"
  - "diy.js offering-link sign-in of a complete account goes to the guided subscription"
  - "checks/status-flow.js parts portal-506b and portal-other (26 parts in all)"
  - "SCRATCH/owner-set/walk_diff.py renders fresh pictures on every run"
affects: [06-09, 06-10, 06-12]
tech-stack:
  added: []
  patterns: [route to the existing guided flow instead of copying the status rules; a render never creates records (the address shows a button, the action creates the invitation); a scratch tree of the base commit with the new check copied in, to prove a RED against the base code]
key-files:
  created: []
  modified:
    - assets/js/onboarding.js
    - assets/js/portal.js
    - assets/js/diy.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - SCRATCH/owner-set/walk_diff.py (outside the repository)
    - SCRATCH/owner-set/reasons.txt (outside the repository)
decisions:
  - "The self-serve Investments list now offers raising offerings to investors on file with no accreditation ground (the old list required one, so a not-accredited investor never saw the offering); the managed edition keeps its accredited-only list (C-03)"
  - "A self-serve investor whose account is not complete and who has no invitation, reaching a subscribe address, also gets a box with the sub-start button (selfInvite without existing, i.e. account setup then the subscription), so no self-serve path shows the typed form with the accredited statement"
  - "The address box for an investor on file reads 'Your subscription takes you through the documents and the subscription agreement.' with the button 'Continue your subscription'; the open-invitation box's 'invited you' wording was not reused because nobody invited them"
  - "selfInvite with existing never returns an invitation for another offering (T-06-19); the invitation for the other offering is left open and unchanged"
requirements: [STAT-01, STAT-02, STAT-03, WL-01]
metrics:
  duration: "about 18 minutes from recording the base commit (17:43:53 UTC) to the end of the passing gate (18:01:44 UTC); the summary and push came after"
  completed: 2026-11-15
actuals:
  tokens: 9100
  tasks: 2
  commits: 2
plan_head_before: d6ae579f34676fb6f266b2b72ac6100d27296e0c
plan_head_after: cfb4ff66617e57aa01e6e5775054794c58e9b756
---

# Phase 6 Plan 08: Self-serve portal subscriptions go through the investor status step Summary

In the self-serve portal, an investor on file who subscribes from the firm's offering link, from Investments or from a typed or bookmarked subscribe address no longer sees the old form that made them tick "is an accredited investor ... and this remains accurate". They go through the same guided subscription an invitation gives an investor on file: Welcome, Investor status (by the offering's exemption), Subscription, Subscription agreement. So every such subscription now records the status answers (request.qual) and counts toward the 35. The managed edition's subscribe page is unchanged.

The owner gate's picture comparison now renders fresh pages on every run, so a picture left behind by an earlier run can no longer cause a false failure.

The owner has not checked any of this. It is not done until he has looked at the screenshots listed below.

## Failures first

- **Task 2's first RED run failed for the wrong reason.** I ran it after Task 1, so the route already worked (`SCRATCH/exec-06-08/red-other-wording.txt`). The only FAIL was my own check: it looked for "$12,000" inside the warning sentence, but the product shows the limit on the line above the warning ("Your investment limit in this offering under Regulation A: $12,000"). I fixed the check, not the product (the status rules are not to change). To get a real RED, I then ran the finished part against a copy of the base commit (`SCRATCH/exec-06-08/red-base-tree`). That run is `SCRATCH/exec-06-08/red-other.txt`: 17 FAIL lines, quoted below. The managed run passed on the base code too, as it should (C-03).
- No other failure. The gate passed on its first run (GATE EXIT: 0).

## RED runs (base code d6ae579)

`SCRATCH/exec-06-08/red.txt` (portal-506b, Task 1, run before any code change):

```
FAIL portal-506b Run A (offering link): no "is an accredited investor" statement and no #sb-acc on the screen the entry point opens :: {"sbAcc":1,...
FAIL portal-506b Run A (offering link): the entry point opens the guided subscription :: ... Subscribe to Kestrel Bay Fund II, L.P. ...
FAIL portal-506b Run B: the Investments page offers the offering to an investor on file who is not accredited
FAIL portal-506b Run C: the subscribe address shows no "is an accredited investor" statement and no #sb-acc :: {"sbAcc":1,...
FAIL portal-506b Run C: the "Continue your subscription" box with its button is shown
FAIL portal-506b the console offering page reads "Non-accredited purchasers: 3 of 35" :: Non-accredited purchasers: 0 of 35
STATUS FLOW: FAIL (parts run: 1) - portal-506b
```

`SCRATCH/exec-06-08/red-other.txt` (portal-other, against the base tree; abridged):

```
FAIL portal-other rega (offering link): no "is an accredited investor" statement and no #sb-acc on the screen the entry point opens :: {"sbAcc":1,...
FAIL portal-other rega: request.qual.regA keeps the figures, the $12,000 limit and over-limit :: {}
FAIL portal-other erisa: the Investments page offers the offering
FAIL portal-other empty: the Investments page offers the offering
FAIL portal-other withdraw (Investments): no "is an accredited investor" statement and no #sb-acc ...
FAIL portal-other withdraw: the record no longer holds the ground (basis empty, kept as superseded) :: {"basis":"Income over $200,000 ...","date":"2026-11-15"}
FAIL portal-other the console counts the two "not accredited" answers (2 of 35) :: ... Non-accredited purchasers: 0 of 35 ...
STATUS FLOW: FAIL (parts run: 1) - portal-other
```

## Gate (Task 2 verify, run as written from SCRATCH/exec-06-08/gate.sh, plus plan-check addition 4)

Last lines, verbatim:

```
==> server.txt <==
# todo 0
# duration_ms 9479.581544

==> math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 13)

==> status.txt <==
PASS portal-other managed: no request left the check server
STATUS FLOW: PASS (parts run: 26)

==> srvmode.txt <==
PASS clean the investor’s device reached nothing outside but the integration server
SERVER MODE: PASS (parts run: 6)

==> persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> owner.txt <==
PASS leak (3 s): 401 files and 442 commit messages searched: ...
MEASURE: PASS
GATE EXIT: 0
```

Also measured: server tests `# pass 177`, `# fail 0`. status-flow 405 PASS, 0 FAIL. walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0, all on fresh pictures. signing-step.js and record-check.js have a PASS on both trees and no FAIL line on either tree (so no new FAIL).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | Self-serve subscribe entry points go through the guided subscription; part portal-506b | 428262a | onboarding.js, portal.js, diy.js, status-flow.js |
| 2 (tdd) | Part portal-other; walk_diff.py fresh pictures; the gate | cfb4ff6 | status-flow.js (walk_diff.py and reasons.txt are outside the repository) |

Tracer gate: Task 1's verify was re-run end to end after the code change: `STATUS FLOW: PASS (parts run: 2)` (portal-506b and existing). Expansion went ahead after that.

## What each part measured

**portal-506b** (fresh self-serve portal, a Rule 506(b) offering with its agreement, three active investors on file with no accreditation ground):
- Run A, the firm's offering link (#join-<offering>), signed up with the email of a complete account. No "is an accredited investor" text and no #sb-acc. The flow opens on the investor's own invitation for this offering, marked existing. Steps: Welcome, Investor status, Subscription, Subscription agreement. The investor answers "not accredited" with sophistication answers, and the subscribe step says "is not an accredited investor". request.qual is regime 506b, accredited false, with the experience answer. The agreement is signed (done screen). Every screen passes the leak check.
- Run B, Investments: the offering is now listed for this investor, and "Review and subscribe" (sub-start) opens the same flow. Same checks as Run A.
- Run C, the subscribe address (plan-check additions 1 and 2). The investor also holds an open invitation for a different offering. The address shows no accredited text, no #sb-acc, and only the "Continue your subscription" box. Its button opens the flow for THIS offering, not the other one. The investor reaches Investor status, subscribes, and the request carries qual. The other offering's invitation is left open and unchanged. No code fix was needed for addition 2: selfInvite with existing already selects by offering.
- The console offering page reads "Non-accredited purchasers: 3 of 35". No script error, no request leaves the check server.

**portal-other**:
- rega, from the offering link, Regulation A Tier 2 (chosen with the console's select). Income $85,000 and net worth $120,000: the status step shows $12,000. With a $60,000 commitment, the subscribe step names the $12,000 limit and warns that the commitment is above it, and the agreement is still reached. qual.regA is kind person, income 85000, netWorth 120000, limitCents 1200000, overLimit true. The console's request row reads "Over the Regulation A Tier 2 limit: $60,000 committed in this offering, limit $12,000".
- erisa, from Investments: Title I answered on the status step. qual.erisa.plan and investor.erisa.plan are both 'title1'.
- empty, from Investments: nothing on the status step is pre-answered and nothing is answered. The subscription is made with qual.accredited null (regime 506b).
- withdraw, from Investments: the firm accepts self-certification and the investor holds a self-certified ground. They answer "not accredited". The record's basis becomes '' and superseded.basis holds the old ground. qual.accredited is false.
- The console panel moves from N to N+2 of 35, and the not-answered count goes up by one.
- managed (plan-check addition 3, C-03): index.html (managed edition), an accredited investor on file. The subscribe page still has #sb-acc and its "is an accredited investor" statement. Without the tick it still says "Confirm your accreditation to continue.". With the tick, the request is submitted (pending), as before.

**walk_diff.py (verifier gap 4)**: scratch config with doc-a.pdf against itself, whole page 1. Before the change: empty folder `{"boxes": [0], "whole": {"1": 0}}`; folder holding a blank orig-p001.png `{"boxes": [136211], "whole": {"1": 136211}}`. After: both `{"boxes": [0], "whole": {"1": 0}}`. Pictures are rendered into a tempfile.mkdtemp folder inside cfg['dir'] and deleted after scoring. The old picture is left untouched and never read. walk_diff.py is not in hashes.json; reasons.txt has its line (hash f268c98aa6d8). Proof files: `SCRATCH/exec-06-08/fresh-before.txt`, `fresh-after.txt`, `probe/fresh.sh`; backup `SCRATCH/owner-set/walk_diff.py.bak-0608`.

## Plan-check additions (all included)

1. Run C in portal-506b: subscribe address, not-accredited complete investor with no invitation for this offering. No accredited text and no #sb-acc, the "Continue your subscription" button, Investor status, subscribe, request carries qual. Console count "3 of 35".
2. In that run the investor also holds an open invitation for a different offering. The button opens the flow for this offering. No code fix was needed.
3. portal-other has a managed-edition run: #sb-acc is still present and a request is submitted as before (C-03).
4. Task 2's RED output is saved as `SCRATCH/exec-06-08/red-other.txt`. The gate script ends with `grep -q '^FAIL' $O/red-other.txt`.

## Deviations from Plan

1. **[Rule 1 - Bug] The self-serve Investments list hid every offering from investors with no accreditation ground** (found in Task 1, Run B RED). The plan's Run B could not happen while openOfferings required `inv.accreditation.basis`. In the self-serve edition it no longer does; the managed edition keeps it. File: assets/js/portal.js. Commit 428262a.
2. **[Rule 2 - Missing critical] A self-serve investor without a complete account and without an invitation** would still have seen the old form at a subscribe address. They now get the box with the sub-start button (account setup, then the subscription). portal.js, 428262a.
3. **Gate script form:** the verify command was run from a script file as instructed. Inside the script function, the plan's `exit 1` in the signing/record loop became `return 1` (same effect), and plan-check addition 4's grep was appended.
4. **Task 2 RED:** see Failures first. The meaningful RED is the run against the base tree.

## The owner's screenshot set (pending his check)

All in `SCRATCH/exec-06-08/shots` (index.txt lists them, failed parts first):
- `status-flow__portal-506b__portal-link-status.png`, `__portal-investments-status.png`, `__portal-address-status.png`: the Investor status step reached from each entry point.
- `status-flow__portal-506b__portal-address-box.png`: the subscribe address showing only the "Continue your subscription" box.
- `status-flow__portal-506b__portal-console-3.png`: "Non-accredited purchasers: 3 of 35".
- `status-flow__portal-other__portal-other-rega-subscribe.png`, `__portal-other-erisa-status.png`, `__portal-other-console.png`.
- `status-flow__portal-other__portal-managed-subscribe.png`: the managed page unchanged.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. sub-start creates the investor's own invitation from their portal session, for the offering they chose only (T-06-19, checked by Run C).

## TDD Gate Compliance

Task 2 (tdd): the test was written first and committed with the passing run, in one commit (cfb4ff6). RED evidence: red-other.txt against the base code, and red-other-wording.txt against Task 1's code (a wrong check expectation, fixed in the check). There is no separate RED commit, because the behaviors were already provided by Task 1's route.

## Self-Check: PASSED

- FOUND: assets/js/onboarding.js, assets/js/portal.js, assets/js/diy.js, checks/status-flow.js, SCRATCH/owner-set/walk_diff.py, SCRATCH/exec-06-08/red.txt, red-other.txt, gate.txt
- FOUND commits: 428262a, cfb4ff6 (ancestors of HEAD)
