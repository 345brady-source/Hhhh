---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 01
subsystem: investor onboarding (self-serve invitation flow), sponsor console
status: complete
tags: [rule-506b, investor-status, accreditation, white-label, d-30]
requires: []
provides:
  - NS.eligibility (assets/js/eligibility.js) regime, LIMIT_506B, BASES, qualOf, nonAccredited
  - Investor status step (FL.status, statusStep, fStatus, qualFrom) and request.qual on subscriptions
  - Console "Investor eligibility" panel and the "Offering details" headings
  - Phase-6 check browser (checks/lib.js), status-flow.js part b506, status-math.js
affects: [06-02, 06-03, 06-04, 06-06]
tech-stack:
  added: []
  patterns: [derived counts computed on render from requests, parts runner with fail-closed gate rules, own static server on a free port per check run]
key-files:
  created:
    - assets/js/eligibility.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
  modified:
    - assets/js/onboarding.js
    - assets/js/console.js
    - diy.html
    - index.html
    - portal.html
decisions:
  - "stAcc and stBasis are prefilled only when the investor record already holds an accreditation basis; otherwise both start empty, so an investor who skips the question is recorded as not answered (accredited null), never as accredited"
  - "The N in 'Non-accredited purchasers: N of 35' counts accepted plus pending (declined left out); the line under it reads '<a> accepted and <p> more pending'"
  - "An investor on file (existing branch) keeps today's accreditation sentence on the subscribe step, now optional; plan 06-02 adds the status step to that branch"
requirements: [STAT-01, STAT-04, WL-01]
metrics:
  duration: "about 14 minutes from recording the base commit (13:42:55) to the end of the gate (13:56:56), file timestamps; reading time before that not measured"
  completed: 2026-11-15
actuals:
  tokens: 14100
  tasks: 2
  commits: 2
plan_head_before: 414fd9a2b6eb4e423e1a41fed9a21935c724ea47
plan_head_after: 3beec83d4b9c27552ecbed5d74f2139f18ced534
---

# Phase 6 Plan 01: Investor status step for Rule 506(b) Summary

A non-accredited investor in a Rule 506(b) offering now answers an "Investor status" step (accredited or not, the Rule 501(a) ground, or experience, education and purchaser representative), subscribes without ticking a false "accredited" statement, the answers ride on the subscription request as `request.qual`, and the sponsor's offering page shows "Non-accredited purchasers: 1 of 35".

Nothing here has been checked by the owner yet. It is not done until he has.

## Failures first

- No gate failure. Every check named in the plan's gate passed (last lines below).
- The TDD RED step for Task 2 did not produce a failing run against Task 1's code: Task 1 had already built eligibility.js, so the new pure cases all passed on the first run and eligibility.js needed no fix. The panel-title scan was shown to catch the fault by running the same regex over the base commit's console.js: it finds the two old headings ("Basics", twice).

## Gate (Task 2 verify, run verbatim from SCRATCH/exec-06-01/gate.sh, exit 0)

```
==> server.txt <==   # todo 0 / # duration_ms 9203.247954   (# pass 171, # fail 0)
==> math.txt <==     STATUS MATH: PASS (cases run: 5)
==> status.txt <==   STATUS FLOW: PASS (parts run: 1)
==> persons.txt <==  TWO PERSONS: PASS
==> owner.txt <==    PASS walkA (15 s) individual 13 PASS 0 FAIL; PASS walkB (36 s) firm 10 PASS 0 FAIL;
                     PASS walkC (75 s) individual 17/0, entity 17/0; PASS leak (2 s); MEASURE: PASS
signing-step.js: base tree 75 PASS 0 FAIL, plan tree 75 PASS 0 FAIL
record-check.js: base tree 40 PASS 0 FAIL, plan tree 40 PASS 0 FAIL
```

All outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-01/. Screenshots of the status step, the subscribe step and the console offering page: SCRATCH/exec-06-01/checks-out/status-shots/.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | Non-accredited investor subscribes to a 506(b) offering; sponsor sees 1 of 35 | a97f0c1 | eligibility.js, onboarding.js, console.js, diy/index/portal.html, checks/lib.js, checks/status-flow.js |
| 2 | Pure checks, panel-title scan, full gate with the base comparison | 3beec83 | checks/status-math.js, checks/lib.js |

Tracer gate: Task 1's verify re-run end to end after the last code change: "STATUS FLOW: PASS (parts run: 1)", unknown part exits 1.

## What was built

- **assets/js/eligibility.js** (NS.eligibility): `regime(o)` ('506c' when the exemption names Rule 506(c), '506b', 'other', ''), `LIMIT_506B = 35`, `BASES` (twelve Rule 501(a) grounds as amended in 2020, wording written fresh), `qualOf(r)`, `nonAccredited(ws, o)` (one per investor, declined left out, accepted vs pending, latest answer decides, unanswered counted apart). Loaded after operations.js in all three pages.
- **Investor status step** (onboarding.js): shown after identity verification when accreditation is not verified and the invited offering is Rule 506(b) or the firm's "Ask for accreditation" toggle is on (then the accredited question only). The self-certified Accreditation step no longer appears in the invitation flow; the verified (506(c)) step is unchanged. stepAccreditation and NS.data.ACCRED are untouched (managed edition, C-03). No field on the step is required (D-30). Saving logs "Investor status answered" under the investor; yes with a ground sets `i.accreditation` and runs `finishOnboarding` as the old step did.
- **Subscribe step**: the accreditation tick follows the answer (accredited or verified: today's sentence; not accredited: a sentence saying so; unanswered: no tick) and is no longer required. Amount minimum, offering-documents tick and typed signature keep their checks. `request.qual = { regime, at, accredited, basis, sophistication? }`.
- **Console**: both offering panels renamed "Offering details" (editable and read-only, managed view included). "Investor eligibility" panel after it in the DIY editable view for 506(b): "Non-accredited purchasers: N of 35" and "<a> accepted and <p> more pending. Declined subscriptions are not counted.", values escaped with h().
- **Checks**: lib.js starts its own static server on a free port, serves the CDN libraries and fonts from SCRATCH/vendor, aborts anything else, and implements the gate rules (unknown or empty part list exits 1, missing vendor file prints NOT RUN and exits 2). status-flow.js part b506 has 20 checks, including leak checks on the status, subscribe and console screens. status-math.js has 5 cases (36 checks).

## Deviations from Plan

1. **[Rule 1 - Bug] Offering name lost its final period in the status-step text.** Found in the Task 1 screenshot: "Kestrel Bay Fund II, L.P is offered..." (the welcome step strips a trailing period). The status text now uses the full name. Fixed before the Task 1 commit (a97f0c1).
2. **[Rule 3 - Blocking] lib.js loads playwright and phase 4's helpers only when needed.** The gate runs status-math.js with plain `node` and no NODE_PATH, and status-math.js needs lib.js's runner and word check. Loading the browser package at the top would have broken that run. Commit 3beec83.
3. **Reading of the stAcc default.** The plan says "ensureFlow defaults stAcc 'yes' and stBasis from i.accreditation.basis when the record has one, else empty". I read "when the record has one" as covering both keys: 'yes' plus the ground when the record holds a basis, otherwise both empty. A blanket 'yes' would record an investor who never answered as accredited (radios cannot be cleared), which would contradict D-30 and plan 06-02's "unanswered" case (qual.accredited null).
4. **Wording of the pending count.** With one pending investor the plan asks for both "1 of 35" and "1 more pending". So N counts accepted plus pending, and the second line reads "0 accepted and 1 more pending", which adds up instead of suggesting two purchasers.

## Observations for the owner (not changed, out of scope)

- The console's exemption hint ("Rule 506(c) offerings take verified accredited investors only...") shows whatever exemption is selected, 506(b) included. This was already the case before this plan.
- Two code comments (console.js line 693, invitations.js line 3) contain the forbidden word. Neither appears on any screen.
- Server mode does not yet carry `request.qual` to the firm's server. Plan 06-06 covers that.

## Known Stubs

None. The panel's 90-day integration note and the Rule 502(b) reminder belong to plan 06-02.

## Threat Flags

None. No new endpoint, storage or trust boundary. Investor-typed values reach the console only as counts, and the status step escapes everything it echoes back (T-06-02).

## TDD Gate Compliance

Task 2 (tdd="true"): the test commit 3beec83 holds status-math.js. No fix commit followed because no case failed against Task 1's code. RED evidence for the title rule comes from running the scan regex over the base commit's console.js (two hits). Task 1 is a tracer task, not TDD.

## Self-Check: PASSED

- FOUND: assets/js/eligibility.js, checks/lib.js, checks/status-flow.js, checks/status-math.js
- FOUND: a97f0c1, 3beec83 (both ancestors of HEAD)
- server/node_modules link the gate created was removed after the run; nothing under it was staged.
