---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 04
subsystem: investor onboarding (self-serve invitation flow), sponsor console
status: complete
tags: [erisa, benefit-plan-investors, 25-percent-test, rule-506c, regulation-a, d-01, d-30, white-label]
requires:
  - 06-03 (NS.eligibility regimes and flags, the status step, request.qual, the eligibility panel, checks/lib.js)
provides:
  - NS.eligibility BPI_LIMIT, planPct, bpiShare, pctText, erisa(ws, o) (per-class rows with pct and if-accepted figures); flags with the benefit plan sentence
  - Benefit plan questions on the status step for every invitation with an offering (stPlan, stPlanPct, stCtrl), request.qual.erisa, investor.erisa, IRA prefill
  - Console "Benefit plan investors" panel for every DIY offering
  - Every onboarding walker continues through "Investor status"; phase 4's SIGN-02 expects "Step 10 of 11"
  - status-flow.js part erisa (19 parts in all)
affects: [06-05, 06-06, 06-07]
tech-stack:
  added: []
  patterns: [per-class figures recomputed on render from positions and requests; accAsked (the accredited question) kept apart from statusStep (the step itself)]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-04-SUMMARY.md
  modified:
    - assets/js/eligibility.js
    - assets/js/onboarding.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/04-signing-inside-onboarding/checks/lib.js
    - .planning/phases/04-signing-inside-onboarding/checks/signing-step.js
    - .planning/phases/05-signed-record/checks/flow.js
    - SCRATCH/owner-set/walk.js (outside the repository)
    - SCRATCH/build/proof/proof.js (outside the repository)
    - SCRATCH/owner-set/reasons.txt (outside the repository)
decisions:
  - "Value counted per holder is the app's commitOf rule (a position's commitment, or its amount where it has none), so a partly called commitment is not counted twice; fully redeemed positions are left out; subscriptions approved but not yet on a position count at their amount"
  - "A holder's share comes from their latest subscription to the offering that answered the benefit plan question, else investor.erisa, else 0"
  - "Percentages are shown rounded down to one decimal place, so a figure under 25 never reads as 25; red at 25 or more on the unrounded figure"
  - "The benefit plan section is its own console panel, 'Benefit plan investors', so the 'Investor eligibility' panel stays absent for Regulation S, Tier 1 and listed offerings as before"
  - "The accredited answer counts (qual.accredited, i.accreditation, the done row, the change log) only where the step asks the accredited question (accAsked); a ground prefilled from the record is not an answer under Rule 506(c) or where no question is asked"
  - "An IRA starts at '4975' the first time the status step is drawn in a session, unless the record already holds an answer; the investor can change it"
  - "Regulation A Tier 1 and exchange-listed Tier 2 without the accredited question: no accreditation tick on the subscribe step, and a short note says why (Rule 1 fix 2)"
requirements: [STAT-03, WL-01]
metrics:
  duration: "about 21 minutes from recording the base commit (14:53:41 UTC) to the end of the gate (15:14:30 UTC); reading time before 14:53 not measured"
  completed: 2026-11-15
actuals:
  tokens: 9700
  tasks: 2
  commits: 2
plan_head_before: 6aa44f7
plan_head_after: 3d121170ef7efd22549e2d7085a7782461db14ab
---

# Phase 6 Plan 04: Benefit plan investors (ERISA), first cut Summary

Every invitation with an offering now asks the benefit plan (ERISA) questions on the Investor status step, under every exemption. Under Rule 506(c) the verification step is unchanged and the status step shows only these questions. An IRA starts as a Code section 4975 plan. No question is required. The answers are kept on the request (with the share counted) and on the investor record. The sponsor's offering page shows, for each class, the percentage of value held by benefit plan investors against 25 percent, red at 25 or more, and the figure each pending subscription would bring if accepted. Such a request is flagged on its row and never blocked. Two earlier-reported faults are fixed: the console's Rule 506(c) hint, and the accreditation tick under Regulation A Tier 1 and exchange-listed Tier 2.

The owner has not checked any of this yet. It is not done until he has.

## Failures first

- **No gate failure.** The Task 2 gate ran verbatim from SCRATCH/exec-06-04/gate.sh (with `tail -n 2`) and exited 0.
- **The first tracer run failed one check, in the check itself:** the step-count pattern expected "Step N of 11 |", but the counter reads "Step N of 11: <step>". The regex was corrected before the commit. The flow had shown 11 steps, as intended.
- **Not covered by this plan (plan 06-05's scope):** plan-asset entities' controlling persons, the sponsor's own marking, several classes in one walk, capital-balance value basis, and a line for holders who have not answered. Server mode does not yet carry `qual.erisa` or `investor.erisa` to the firm's server (plans 06-06/06-07).

## Gate (Task 2 verify, run verbatim, GATE_EXIT=0, 15:07:18 to 15:14:30 UTC)

Last lines, verbatim:

```
==> server.txt <==
# todo 0
# duration_ms 9546.317187

==> math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 11)

==> status.txt <==
PASS flag no request left the check server
STATUS FLOW: PASS (parts run: 19)

==> persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> owner.txt <==
PASS leak (3 s): 381 files and 407 commit messages searched: no name of the list, no run of eight words outside the allowed list; ...
MEASURE: PASS
GATE_EXIT=0
```

- server: # pass 171, # fail 0
- status-flow: 259 PASS, 0 FAIL
- walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0
- signing-step.js: 75 PASS, 0 FAIL on both the base tree and the plan tree. "PASS SIGN-02 the invited investor reaches the signing step with no action by the sponsor" on the plan tree, at "Step 10 of 11"
- record-check.js: 40 PASS, 0 FAIL on both trees

All outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-04/. Screenshots from the gate run are in SCRATCH/exec-06-01/checks-out/status-shots/ (checks/lib.js's shared OUT): erisa-status.png, erisa-subscribe.png, erisa-console-pending.png, erisa-requests.png, erisa-console-approved.png, tier1-subscribe.png, listed-subscribe.png. Copies from an earlier erisa-only run are in SCRATCH/exec-06-04/checks-out/status-shots/.

## RED runs (the two Rule 1 fixes)

The new checks were run against the base code 6aa44f7 (a copy of the base tree with this plan's status-flow.js and lib.js; red-fixes.txt). Result: `STATUS FLOW: FAIL (parts run: 3) - tier1, listed, untiered`. The failing checks were:
- tier1 and listed: "the exemption hint carries no Rule 506(c) note". It failed because the hint showed "Rule 506(c) offerings take verified accredited investors only: ...".
- untiered: "the hint carries no Rule 506(c) note". It failed because the untiered sentence was followed by the 506(c) note.
- tier1 and listed: "the subscribe step offers no 'is an accredited investor' tick and says why". It failed with `subAcc: 1`.
- tier1 and listed: "the status step asks only the benefit plan questions". It failed because there was no status step on the base, which is the feature itself.

Tracer gate (auto mode): Task 1's verify was re-run end to end after the last code change. Result: "STATUS FLOW: PASS (parts run: 4)" (53 PASS, 0 FAIL).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | IRA in a 506(c) offering answers the plan questions; the sponsor sees the class reach 25 percent; plus the two Rule 1 fixes | ce8e107 | eligibility.js, onboarding.js, console.js, checks/status-flow.js, checks/lib.js |
| 2 | Every onboarding walker learns the step, the phase 4 step count, the full gate | 3d12117 | 04 checks/lib.js, 04 checks/signing-step.js, 05 checks/flow.js (plus walk.js, proof.js, reasons.txt outside the repository) |

## What was built

**eligibility.js**
- `bpiShare(e)` gives 1 for 'title1' and '4975', planPct/100 for 'planAssets' (null when the percentage is missing or outside 0 to 100), 0 for 'other' and 'none', and null when unanswered. `planPct` validates the percentage.
- `erisa(ws, o)` returns rows `{ classId, name, total, bpiValue (cents), pct, ifAccepted: [{ requestId, investorId, cents, pct }] }`. An offering without classes gets one class, "All interests". Holders are assigned a class by `structures.classOf`. Pending requests use r.cls, else the investor's class.
- `flags` now joins the exemption flags with "If accepted, benefit plan investors would hold {pct}% of {class} (25 percent or more)" for a pending request at 25 or more. Nothing is blocked.

**Status step** (onboarding.js)
- `statusStep(c)` is true whenever the invitation has an offering, in addition to the earlier cases. The new `accAsked(c)` holds the earlier rule: the step asks the accredited question only when there is no verification step and the offering is 506(b), Reg A Tier 2, or the firm's toggle is on.
- Without the accredited question, the step shows only the benefit plan questions, with a lede that says so. Under Rule 506(c) the lede also says the accreditation is verified in its own step.
- The questions:
  - plan type (five choices, fresh wording, short hints; the 4975 choice names an IRA or a Keogh plan)
  - on 'planAssets', the percentage of the entity's equity held by benefit plan investors
  - whether the account or an affiliate has discretionary authority or control over the offering's assets, or gives paid investment advice about them
- A short paragraph explains the 25 percent point. stPlan and stCtrl redraw the step.
- `qualFrom` adds `erisa { plan, planPct, controlling, share }`.
- The status save writes `investor.erisa { plan, planPct, controlling, at }` when anything was answered, and the change log records the answers (T-06-01).
- The accredited answer is saved, withdrawn or logged only where it was asked.

**Console**
- A "Benefit plan investors" panel for every DIY offering, with one line per class: "{class}: {pct}% of value held by benefit plan investors".
- At 25 or more: a red "25 percent or more" badge and the sentence "... the offering's assets may be treated as plan assets under ERISA".
- One line per pending request with its if-accepted figure (warn badge at 25 or more), plus a note saying how value and unanswered holders are counted. Values are escaped with h().

**Checks**
- Part erisa (26 checks). It sets up a fresh portal with a 506(c) offering of one class, "Class A Interests", whose sample holders have investor.erisa 'none'. An IRA investor goes through the unchanged verification step (11 steps). The status step offers only the plan questions, with '4975' prefilled and left as is. The commitment is at least a third of the class's value, so the class goes from 0 to 25 percent or more (25.6 percent in the screenshots inspected).
- What the part asserts:
  - qual.erisa.share is 1, and investor.erisa is saved.
  - Before approval, the class line reads 0% (not red), the if-accepted figure is at or above 25 percent with a badge, and the request row carries the flag.
  - Approve works. After it, the class line reads the same figure with the red badge.
  - Nothing about the class reaches the investor's screens (T-06-09), and the leak checks pass.
- Parts other, tier1 and listed: the toggle-off flow now expects the status step with the plan questions only. Each change has a comment naming plan 06-04 and D-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The exemption hint showed the Rule 506(c) note under every exemption** (reported by 06-01, 06-02 and 06-03; included at the caller's request)
- **Fix:** `exemptionHint` returns the untiered sentence for an untiered Regulation A value, the Rule 506(c) note only for regime '506c', and nothing otherwise.
- **Test:** tier1 and listed assert there is no 506(c) note. The untiered part's earlier check, "the hint keeps the existing Rule 506(c) note", is inverted with a comment naming the fix. Erisa asserts the note is present under 506(c). All of them failed on the base (see RED runs).
- **Files:** assets/js/console.js, checks/status-flow.js. **Commit:** ce8e107

**2. [Rule 1 - Bug] Reg A Tier 1 and exchange-listed Tier 2 showed the optional "is an accredited investor" tick** (reported by 06-03; included at the caller's request)
- **Fix:** Without the accredited question (the firm's toggle off), these offerings get no accreditation tick on the subscribe step. In its place is the note "Regulation A does not limit this offering to accredited investors, so no statement about accreditation is asked for here." (fresh wording; the leak row passed). No investor field is mandatory (D-30). With the toggle on, the tick still follows the investor's answer, as before.
- **Test:** tier1 and listed assert there is no #ob-subAcc, no "is an accredited investor" text, and that the note is present. Both failed on the base with `subAcc: 1`.
- **Files:** assets/js/onboarding.js, checks/status-flow.js. **Commit:** ce8e107

**3. [Rule 1 - Bug] A ground prefilled from the record would have counted as an answer where none was asked.** stAcc is prefilled 'yes' from a record's ground. Now that the status step also appears under Rule 506(c) and with the toggle off, saving the step would have re-saved the ground with today's date and run `finishOnboarding` with it. The prefill would also have been written to `qual.accredited`/`basis`. All of these now require `accAsked(c)`. The done row uses the same rule, so its "Accreditation" row is unchanged for flows that do not ask. (ce8e107)

**4. [Rule 3 - Blocking] The phase 6 walker could not walk an IRA.** checks/lib.js filled `#ob-dob`, which an IRA's information step does not have, and left the custodian empty. It now fills the date of birth only when the field exists, and fills an empty custodian or formation field. No other walk behaviour changed. (ce8e107)

**5. Reading of "value (positions' amount plus commitment)".** Adding a position's amount to its commitment would count a partly called commitment twice (sample positions hold both the called amount and the commitment). Value uses the app's `commitOf` rule instead: the commitment, or the amount where there is no commitment. This matches the planner's choice ("commitments and subscribed amounts"). Approved subscriptions not yet on a position are counted, so the class line turns red on Approve, as the plan's case requires.

**6. Panel placement.** The plan calls the benefit plan section a "section" of eligibilityPanel. It is rendered by eligibilityPanel as its own panel, "Benefit plan investors", so that the existing checks "no Investor eligibility panel" for Regulation S, Tier 1 and listed offerings keep their meaning.

## Observations for the owner (not changed)

- Regulation Crowdfunding, Regulation S and Section 4(a)(2) offerings with the toggle off keep today's optional "is an accredited investor" tick. Reg CF in particular is open to investors who are not accredited. Only Tier 1 and listed Tier 2 were in scope for fix 2.
- The 25 percent figure counts a holder who has not answered as not a benefit plan investor (planner's choice). Plan 06-05 adds the line for unanswered holders and the controlling-person adjustment.

## Known Stubs

None.

## Threat Flags

None beyond the register.
- T-06-09: the figures are computed and shown only in the console. The erisa part asserts that no class figure, flag or holder reaches the status or subscribe screens.
- T-06-10: the walkers were changed additively only (one branch each), each with a line in reasons.txt (hashes 247148bba014, 8971d269af4a, f5773da45c80, e01d44fda151, fe4a8d4a7820). The owner gate's walk rows passed after the change.

## Self-Check: PASSED

- FOUND: assets/js/eligibility.js, assets/js/onboarding.js, assets/js/console.js, checks/status-flow.js, checks/lib.js, 04 checks/lib.js, 04 checks/signing-step.js, 05 checks/flow.js
- FOUND: ce8e107, 3d12117 (both ancestors of HEAD). 2 commits measured from 6aa44f7 with `git rev-list --count`.
- The server/node_modules link the gate created was removed afterwards, and nothing under it was staged. STATE.md and ROADMAP.md were not touched.
