---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 03
subsystem: investor onboarding (self-serve invitation flow), sponsor console
status: complete
tags: [regulation-a, tier-2, investment-limit, c-01, c-04, d-01, d-30, white-label]
requires:
  - 06-02 (NS.eligibility place/flags, the status step with corrections, request.qual, the eligibility panel, checks/lib.js)
provides:
  - NS.eligibility regime 'regA1' | 'regA2' | 'regA2listed', figure, regALimitCents, usd, committedCents, regAStatus; flags with the Regulation A sentence
  - Status-step Tier 2 branch (person or organization, figures, live limit) and request.qual.regA
  - Subscribe-step limit line and over-limit warning, updated in place
  - Console exemption tiers, untiered hint, Regulation A eligibility panel, request flag
  - withdrawGround (an investor's "not accredited" answer withdraws a self-certified ground on their record)
  - status-flow.js parts regA, entity, accredited2, tier1, listed, untiered, aggregate, nofigures, flag (18 in all); status-math.js cases regalimit, regastatus, raflags (11 in all)
affects: [06-06, 06-07]
tech-stack:
  added: []
  patterns: [limits and totals recomputed on render from stored figures and requests; device flags kept but never trusted]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-03-SUMMARY.md
  modified:
    - assets/js/eligibility.js
    - assets/js/onboarding.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
decisions:
  - "An investor's 'not accredited' answer withdraws any ground on their record that no connection verified (no verifiedBy): basis and date cleared, the old ground kept under accreditation.superseded {basis, date, at}; a self-certification record (or an on-file record seeded from that ground) becomes not_started with the old method kept under superseded. A ground a connection verified stays. This also applies to an investor on file whose prefilled ground is answered 'no'."
  - "The Regulation A request flag goes on every non-declined subscription of an investor whose total in the offering is above their recomputed limit, including an earlier subscription that carries no status answer of its own (the limit is on the aggregate purchase)."
  - "Untiered means regime 'regA2' and no 'Tier' in the exemption text; the hint sits in the same hint line as the Rule 506(c) note."
  - "The console offering page now redraws when the exemption changes (focus put back on the select), so the eligibility panel and the hint follow the choice at once."
requirements: [STAT-02, STAT-04, WL-01]
metrics:
  duration: "about 24 minutes from recording the base commit (14:26:28 UTC) to the end of the gate (14:50:39 UTC); reading time before 14:26 not measured"
  completed: 2026-11-15
actuals:
  tokens: 15500
  tasks: 2
  commits: 5
plan_head_before: 84396d4f9478aa8473bcc4e8075a965744dc0a55
plan_head_after: 01659b2
---

# Phase 6 Plan 03: Regulation A Tier 2 investment limit Summary

The sponsor now chooses Regulation A Tier 1, Tier 2, or Tier 2 listed on an exchange on the offering page. Under Tier 2, a person who is not accredited gives annual income and net worth; an organization gives revenue and net assets. The step shows their limit (10 percent of the greater figure) while they type. On the subscribe step they get a plain warning when the commitment, together with their earlier subscriptions to the offering, is above that limit, and they can still subscribe. The sponsor's panel and request rows show who is over the limit. These figures are recomputed from the stored numbers, never taken from the investor's device. Also included: the investor record now follows a "yes" corrected to "no" (Rule 1 fix below).

The owner has not checked any of this yet. It is not done until he has.

## Failures first

- **No gate failure.** The Task 2 gate ran verbatim from SCRATCH/exec-06-03/gate.sh (with `tail -n 2`) and exited 0.
- **The Task 2 RED run was partial.** Against Task 1's commit 7e6757c, five of the eight new parts already passed (entity, accredited2, tier1, listed, nofigures), and so did two of the three new math cases (regalimit, regastatus). Task 1 had already built what they test. The failures were the work Task 1 had not done: the untiered hint, the request flag (aggregate and flag parts), and `raflags`. The quoted output is under "RED runs".
- **Not covered by this plan:** server mode. The device adds only the earlier subscriptions it holds. Plan 06-06 is to prove that the console's figure is authoritative there.

## Gate (Task 2 verify, run verbatim, GATE_EXIT=0, 14:43:45 to 14:50:39 UTC)

Last lines, verbatim:

```
==> server.txt <==
# todo 0
# duration_ms 9192.128313

==> math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 11)

==> status.txt <==
PASS flag no request left the check server
STATUS FLOW: PASS (parts run: 18)

==> persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> owner.txt <==
PASS leak (2 s): 380 files and 404 commit messages searched: ...
MEASURE: PASS
```

- server: # pass 171, # fail 0
- status-flow: 229 PASS, 0 FAIL
- walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0
- signing-step.js: 75 PASS, 0 FAIL on both the base and plan trees
- record-check.js: 40 PASS, 0 FAIL on both trees

All outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-03/. Screenshots are in SCRATCH/exec-06-01/checks-out/status-shots/ (the OUT folder checks/lib.js shares): regA-status.png, regA-subscribe.png, regA-console.png, entity-*, accredited2-*, tier1-*, listed-*, untiered-*.png (including untiered-console.png), aggregate-*, nofigures-*.png (including nofigures-console.png), flag-requests.png.

## RED runs (TDD)

- **Rule 1 fix**, against 84396d4 (red-fix.txt): `STATUS FLOW: FAIL (parts run: 1) - back`. The only failures were the four new record checks, for example `FAIL back yes corrected to no: the investor record no longer holds the ground ... :: {"basis":"Income over $200,000 ...","date":"2026-11-15"}`. After the fix, back, existing and accredited passed (green-fix.txt).
- **Task 2**, against 7e6757c (red-math.txt, red-flow.txt): `STATUS MATH: FAIL (cases run: 11) - raflags` and `STATUS FLOW: FAIL (parts run: 8) - untiered, aggregate, flag`.
- **Task 1 (tracer)**: the first run of the verify passed: "STATUS FLOW: PASS (parts run: 1)". That run is also the tracer gate (auto mode: verify re-run end to end after the last code change).

## Tasks

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| Rule 1 fix | the investor record follows yes corrected to no | 19144f7 (test), fcfceff (fix) | checks/status-flow.js, onboarding.js |
| 1 (tracer) | Tier 2 non-accredited person over the limit: warned, subscribes, sponsor sees it | 7e6757c | eligibility.js, onboarding.js, console.js, checks/status-flow.js |
| 2 (tdd) | organizations, accredited, Tier 1, listed, untiered, aggregate, no figures, flag; full gate | 0bf6472 (test), 01659b2 (feat) | eligibility.js, console.js, checks/status-flow.js, checks/status-math.js |

## What was built

**eligibility.js**
- `regime`: any text naming Regulation A (or "Reg A") is 'regA1' with Tier 1/I/one, 'regA2listed' with "exchange-listed" or "listed on a national securities exchange", and 'regA2' otherwise (C-04). Untiered text and "Regulation A+" from the reader map to 'regA2'.
- `figure`: accepts finite numbers from 0 to 1e12. Booleans, blanks and anything else count as not given (T-06-07).
- `regALimitCents`: 10 percent of the greater figure of the pair for the kind, in cents, or null.
- `committedCents`: the investor's non-declined subscriptions to the offering.
- `regAStatus`: rows, over and noFigures. It recomputes the limit from the stored figures and ignores `overLimit` and `limitCents` from the device (T-06-06).
- `flags` adds "Over the Regulation A Tier 2 limit: $X committed in this offering, limit $Y".

**Status step** (onboarding.js)
- Shown for 'regA2'. The lede names "Tier 2 of Regulation A" only when the exemption text names Tier 2.
- On "no": the question "Whose figures are these?" (a person's / an organization's), defaulted from the account type (trust and entity give organization).
- A person gets "Annual income ($)" and "Net worth, not counting your primary residence ($)", with a joint-account hint about a spouse or spousal equivalent. An organization gets "Revenue for the most recent fiscal year ($)" and "Net assets at the end of that year ($)".
- Then "Your investment limit in this offering: $X", redrawn in place by the binder. Focus stays in the field (checked). Nothing shows while the limit is unknown.
- `qualFrom` adds `regA { kind, figures, limitCents, commitmentCents, overLimit }`.
- The change log entry records the figures and the limit, or "not given; investment limit not known" (T-06-08).

**Subscribe step**
- "Your investment limit in this offering under Regulation A: $X", plus "You have already committed $Y to it" when there are earlier subscriptions.
- When the commitment is over the limit, a plain warning (`.wire-warn`) says the investor can still subscribe and the firm reviews every subscription.
- Redrawn in place as the amount is typed. Nothing on the step is required (D-30).

**Console**
- EXEMPTIONS lists the three tiers in place of 'Regulation A'. An untiered stored value stays selectable, with a hint that asks the sponsor to choose a tier.
- The Regulation A panel shows "Regulation A Tier 2: N non-accredited subscriber(s), K over their 10 percent limit". Each over-limit investor gets a red "Over the limit" line with title, amount committed and limit, followed by "J subscriber(s) have not given figures" and a note on how limits are worked out.
- Request rows carry the flag. Approve is unchanged.

**Checks**
- 9 new status-flow parts.
- The back part is extended.
- 3 new math cases, and the regime case covers every new value plus untiered and odd spellings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The investor record kept a self-certified ground after "yes" was corrected to "no"** (from 06-02's report, added at the caller's request)
- **Found during:** 06-02 (reported), fixed before Task 1
- **Issue:** The status save wrote `i.accreditation` on "yes" and never undid it. The request's qual, the count and the done row followed a correction, but the record still read accredited. Every reader of that record takes the basis to mean accredited: the portal's own subscribe form states "is an accredited investor ({ground})" (portal.js line 206 and line 420), and so do the investor profile and the activity log.
- **Fix:** On "no", `withdrawGround` clears `basis` and `date` and keeps the withdrawn ground under `accreditation.superseded {basis, date, at}`. It sets a self-certification record (or an on-file record seeded from the same ground) to `not_started`, keeping the old method under `superseded`, and re-runs the decision. A ground with `verifiedBy` (verified by a connection) is left alone. The "Investor status answered" log adds "the self-certified ground on the record ({ground}) no longer applies".
- **Test:** The back part now turns on self-certification and runs yes, then no while pending, then yes, then no after approval. It asserts the record, the self-certification record, the log, and that each pending correction made exactly one "Investor status updated" entry (three in all). It failed on 84396d4 (quoted above). The part count stays at 18.
- **Files modified:** assets/js/onboarding.js, checks/status-flow.js
- **Commits:** 19144f7, fcfceff

**2. [Rule 2 - Correctness] The offering page redraws when the exemption changes.** Before, choosing an exemption only updated the investor preview. The eligibility panel and the new untiered hint stayed stale until the page was left and opened again. Focus is put back on the select. (7e6757c)

**3. Scope of the request flag.** The plan defines the flag per request. It is applied to every non-declined subscription of the over-limit investor, including the earlier subscription in the aggregate part, which has no status answer of its own, because the limit is on the aggregate purchase. The math case `raflags` pins this.

## Observations for the owner (not changed)

- With the firm's "Ask for accreditation" toggle off, a Tier 1 or exchange-listed offering has no status step, so the subscribe step shows the existing (optional) tick "is an accredited investor, and this remains accurate". 06-02 recorded the same for other exemptions. Non-accredited investors may invest in those offerings without limit, so that sentence may not fit there.
- The console exemption hint still carries the Rule 506(c) note under every exemption (unchanged since before 06-01). The untiered sentence is added in front of it.
- Regulation Crowdfunding stays regime 'other' (deferred, per the plan).
- The figures are the investor's own representation. Rule 251(d)(2)(i)(C) allows the issuer to rely on it, and nothing is verified.

## Known Stubs

None.

## Threat Flags

None beyond the register.
- T-06-06: recomputed on render; the math checks ignore device values that disagree (both directions), and so does the flag part in the browser.
- T-06-07: figure bounds are checked in the math cases.
- T-06-08: the figures, the limit and the time are kept on qual, and the change log entry is checked in the regA and nofigures parts.

## TDD Gate Compliance

- Rule 1 fix: test 19144f7 failed on the base, and fix fcfceff passed.
- Task 2: test 0bf6472 failed against 7e6757c (see "Failures first" for the parts that already passed), and feat 01659b2 passed.
- Task 1 is a tracer task, not TDD.

## Self-Check: PASSED

- FOUND: assets/js/eligibility.js, assets/js/onboarding.js, assets/js/console.js, checks/status-flow.js, checks/status-math.js
- FOUND: 19144f7, fcfceff, 7e6757c, 0bf6472, 01659b2 (all ancestors of HEAD); 5 commits measured from 84396d4 with `git rev-list --count`
- The server/node_modules link the gate created was removed afterwards, and nothing under it was staged. STATE.md and ROADMAP.md were not touched.
