---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 05
subsystem: sponsor console (benefit plan investors), investor onboarding (subscribe step)
status: complete
tags: [erisa, benefit-plan-investors, 25-percent-test, controlling-persons, d-01, d-30, white-label, regulation-crowdfunding, regulation-s]
requires:
  - 06-04 (bpiShare, erisa() first cut, the Benefit plan investors panel, qual.erisa, investor.erisa, accAsked)
provides:
  - NS.eligibility.erisa(ws, o, opts) with controlling marks, disregarded value, value basis (capital or commitments) and asOf, unanswered holders, per-holder entries; controllingMarks(o)
  - offering.erisaControlling (investor ids), set by the logged console action bpi-ctrl
  - Console Benefit plan investors panel: basis on each class line, a "Left out" line, a "Not answered" line, the controlling persons and affiliates list
  - Subscribe step: no accreditation tick for Regulation Crowdfunding or Regulation S with the toggle off (Rule 1 fix)
  - status-flow parts controlling, planassets, classes, erisa-unanswered, erisa-prefill (24 parts); status-math cases bpishare, erisa (13 cases)
affects: [06-06, 06-07]
tech-stack:
  added: []
  patterns: [one value basis per offering, chosen on every render; if-accepted figures always on commitments]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-05-SUMMARY.md
  modified:
    - assets/js/eligibility.js
    - assets/js/console.js
    - assets/js/onboarding.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
decisions:
  - "The sponsor's controlling marks are kept per offering (offering.erisaControlling), as the planner chose"
  - "A holder has a capital balance when NS.ops.capital gives an end balance above 0 at the last month end; a holder just added with no balance yet, or a subscription accepted but not yet on a position, puts the whole offering on commitments"
  - "If-accepted figures are always worked out on commitments: a subscription has no capital balance until it is funded, so that is the basis once it is accepted"
  - "Percentages are rounded to the nearest tenth (28.57 reads 28.6, as the plan's case expects); a figure under 25 is never shown as 25 (24.96 reads 24.9). This replaces 06-04's rounding down"
  - "A holder is controlling by the sponsor's mark or by its own latest answer (a subscription to the offering that answered the control question, else the investor record)"
  - "Regulation Crowdfunding and Regulation S are recognised from the exemption text only when regime() is 'other'; 'Regulation S-K' or 'S-X' do not match"
requirements: [STAT-03, WL-01]
metrics:
  duration: "about 23 minutes from recording the base commit (15:18:11 UTC) to the end of the gate (15:40:54 UTC); reading time before 15:18 not measured"
  completed: 2026-11-15
actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: a72c72757766676ba17437be6ef0e38126e3dc06
plan_head_after: 88de8471313a8ddcb131fb49ad5920cd154ce04b
---

# Phase 6 Plan 05: Benefit plan investors, the full 25 percent figure Summary

The sponsor can now tick any holder of an offering as a controlling person or affiliate, including its own and its affiliates' holdings recorded as investors. Each tick and untick is logged with the holder's name. The class figure leaves out the value of controlling holders that are not benefit plan investors; a controlling plan investor stays counted. Each class line names its value basis: capital balances at the last month end when every holder has one, otherwise commitments and subscribed amounts. Holders with no answers count as 0 and are listed by name as not answered. Plan-asset entities count at their stated percentage, and a percentage outside 0 to 100 counts as not answered. One more fix: Regulation Crowdfunding and Regulation S offerings no longer show the "is an accredited investor" tick when the firm's toggle is off.

The owner has not checked any of this yet. It is not done until he has.

## Failures first

- **No gate failure.** The Task 2 gate ran as written (with `tail -n 2`) from SCRATCH/exec-06-05/gate.sh and exited 0.
- **One check failed on its first run, and the fault was in the check:** the classes part invited the IRA under the account title, so the tax step's signature did not match the investor's name and the walk stopped there. The invitation now uses the person's name, as the erisa part does. The product was not at fault.
- **The prefill case already passed before Task 2's code.** 06-04 had already built prefill from investor.erisa. The new erisa-prefill part proves it end to end; no code was needed for it.
- **Not covered here:** server mode still does not carry `qual.erisa`, `investor.erisa` or `offering.erisaControlling` to the firm's server (plans 06-06/06-07).

## Gate (Task 2 verify, GATE_EXIT=0, 15:33:18 to 15:40:54 UTC)

Last lines, verbatim:

```
==> server.txt <==
# todo 0
# duration_ms 9402.033397

==> math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 13)

==> status.txt <==
PASS flag no request left the check server
STATUS FLOW: PASS (parts run: 24)

==> persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> owner.txt <==
PASS leak (2 s): 382 files and 413 commit messages searched: no name of the list, no run of eight words outside the allowed list; no vendor or library name in assets/js, the pages, names under assets/ or our files beside the runtime (one line allowed: app.js's test and call of the host runtime's property on window); the vendored runtime as recorded
MEASURE: PASS
GATE_EXIT=0
```

- server: # pass 171, # fail 0
- status-math: 154 PASS, 0 FAIL
- status-flow: 316 PASS, 0 FAIL
- two-persons: 17 PASS, 0 FAIL
- walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0
- signing-step.js: 75 PASS, 0 FAIL on both the base tree and the plan tree
- record-check.js: 40 PASS, 0 FAIL on both trees

All outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-05/. Screenshots are in SCRATCH/exec-06-01/checks-out/status-shots/: controlling-marked.png, controlling-both.png, planassets-status.png, planassets-console.png, classes-console.png, unanswered-console.png, prefill-status.png. In full-page shots the demo role bar and toasts sit over the panel heading; they are fixed on screen and were there before this plan.

## TDD / RED evidence

- **Tracer (Task 1):** `STATUS FLOW: PASS (parts run: 1)` on the first run (17 PASS, 0 FAIL). The figures matched the plan: Class C at 20 percent, 28.6 percent in red once the general partner's holding is marked, 20 percent again when unmarked. The IRA answering "controlling" stays counted. Tracer gate (auto mode): verify passed end to end before expanding.
- **Task 2 math, run against Task 1 plus the fix (808b56e):** `STATUS MATH: FAIL (cases run: 13) - erisa`. The failures were plan-asset 140/''/-5 not listed, unanswered not listed, all five basis checks, and the zero-class check (no `unanswered`). The classes and marks checks already passed (red-math.txt).
- **Task 2 flow on the same code:** `FAIL (parts run: 5) - controlling, planassets, classes, erisa-unanswered`. It failed on the basis not being named, no Not answered line, and the classes walk bug above. erisa-prefill passed (red-flow.txt).
- **GREEN:** math 13 cases PASS. The six ERISA parts (with 06-04's erisa) PASS, 79 checks. Then the full gate.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | The sponsor marks its own holding as controlling and the class percentage changes | c1a4225 | eligibility.js, console.js, checks/status-flow.js |
| Rule 1 fix | No accreditation tick for Reg CF / Reg S with the toggle off | 808b56e | onboarding.js, checks/status-flow.js |
| 2 | Plan-asset entities, several classes, capital basis, unanswered holders, prefill, full gate | 88de847 | eligibility.js, console.js, checks/status-flow.js, checks/status-math.js |

## What was built

**eligibility.js**
- `erisa(ws, o, opts)`: one entry per holder and class.
  - Controlling = sponsor's mark or the holder's own latest answer. `disregarded` = value of controlling holders with share 0. `pct = bpiValue / (total - disregarded)`, 0 when nothing is left.
  - Basis: capital balances at the last month end (`NS.ops.capital`, the call console-requests uses) when every holder is on the books with a balance above 0. Otherwise commitments and subscribed amounts. Rows carry `basis` and `asOf`.
  - `unanswered` lists holders with no share (no answer, or a plan-asset percentage that does not count). Shares are always recomputed from the stored plan and percentage, never from a stored `share` (T-06-12).
  - `holders` gives { investorId, cents, share, answered, controlling, marked, own }.
  - If-accepted figures use commitments and count the request's own control answer. Request flags call `erisa(ws, off, { capital: false })`.
- `controllingMarks(o)`; `pctText` rounds to the nearest tenth and keeps any figure under 25 below 25.

**console.js** (Benefit plan investors panel)
- Each class line ends with "(value by capital balances at October 31, 2026)" or "(value by commitments and subscribed amounts)".
- "Left out of {class} as held by controlling persons or affiliates: $X (names)".
- "Not answered: N holders of {class}, each counted here as not a benefit plan investor: names".
- "Controlling persons and affiliates": a short explanation, then one checkbox per holder, sorted by name. A holder whose own answer says it has control is noted under its name. Checkboxes are disabled for roles that cannot configure.
- `NS.actions['bpi-ctrl']` (staffGuard) toggles the id in `offering.erisaControlling`, saves, and logs "Marked as a controlling person or affiliate for the 25 percent test" / "Unmarked ...". The detail is "{holder} in {offering}"; the team member is recorded by the change log (T-06-11). Then it redraws.
- The value hint was rewritten for the basis rule.

**onboarding.js**: `openKind(c)` and `OPEN_NOTE`. The subscribe step uses them so that Regulation Crowdfunding and Regulation S get a short note of their own in place of the tick when the accredited question is not asked.

**Checks**
- status-flow part controlling. Parts planassets (a real entity walk answering 40 percent; stored 140 and '' then listed as not answered), classes (an IRA chooses Class B on the subscribe step; Class A never moves; Class B reaches 25 percent, red, on Approve), erisa-unanswered (capital basis named; three holders listed, an IRA among them, not guessed) and erisa-prefill (Title I prefilled, changed to "other", carried on the request and the record).
- Part other gains walks for Regulation S, Regulation Crowdfunding and Section 4(a)(2) with the toggle off.
- status-math: cases bpishare (every answer, bad percentages) and erisa (plan assets, unanswered, classes, marks, basis, zero totals). The sandbox can load structures.js and a stand-in capital function.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regulation Crowdfunding and Regulation S offerings showed the optional "is an accredited investor" tick with the toggle off** (included at the caller's request)
- **Fix:** No tick, and a short fresh note instead: "Regulation Crowdfunding is open to investors who are not accredited, so this step asks for no statement on accreditation." / "Regulation S is not limited to accredited investors, so you are not asked to state whether you are one." Nothing is required (D-30). Section 4(a)(2) keeps its optional tick, and a check asserts that.
- **Test:** part other. On the base code both new checks failed with `subAcc: 1` (red-fix.txt), while the 4(a)(2) check passed. After the fix, other, tier1 and listed pass (31 checks).
- **Files:** assets/js/onboarding.js, checks/status-flow.js. **Commit:** 808b56e

**2. [Rule 1 - Bug] Rounding: 06-04's rounding down would show 20 of 70 as 28.5, but the plan's case expects 28.6.** pctText now rounds to the nearest tenth. A figure under 25 still never reads 25 (24.96 shows 24.9), so the red mark and the number agree. 06-04's erisa part still passes. (c1a4225)

**3. Value basis when holders or subscriptions have no capital balance.** The plan says "capital balances when every holder in the offering has one". Here that means an end balance above 0 at the last month end. An accepted subscription not yet on a position has no balance, so it puts the offering on commitments, and if-accepted figures are on commitments. This keeps the pending figure equal to the figure shown after Approve (06-04's erisa part asserts that equality and still passes). On the sample data every holder of Fund II has a capital balance, so the offering page shows capital balances until a new subscription is accepted.

**4. The "second holder answering controlling yes with plan 4975"** in the tracer is the class's IRA: after unmarking, the IRA's answer is set to controlling and Class C stays at 20.0 percent. With the general partner marked again it reads 28.6, with the IRA still counted.

## Known Stubs

None.

## Threat Flags

None beyond the register.
- T-06-11: every mark and unmark is a change-log entry naming the holder and the offering; the log records the team member.
- T-06-12: shares are recomputed from the stored plan and percentage. planassets asserts that a stored share of 0.4 next to a percentage of 140 or '' counts as 0, with the holder listed as not answered.

## Self-Check: PASSED

- FOUND: assets/js/eligibility.js, assets/js/console.js, assets/js/onboarding.js, checks/status-flow.js, checks/status-math.js
- FOUND: c1a4225, 808b56e, 88de847 (all ancestors of HEAD). 3 commits measured from a72c727 with `git rev-list --count`.
- The server/node_modules link the gate created was removed afterwards, and nothing under it was staged. STATE.md and ROADMAP.md were not touched.
