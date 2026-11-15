---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 02
subsystem: investor onboarding (self-serve invitation flow), sponsor console
status: complete
tags: [rule-506b, investor-status, purchaser-representative, rule-501i, c-01, c-02, c-03, d-30, white-label]
requires:
  - 06-01 (NS.eligibility, the status step, request.qual, the eligibility panel, checks/lib.js)
provides:
  - NS.eligibility.place(ws, o, investorId) and flags(ws, r); nonAccredited(...).ranked and .holders
  - Limit warning on the status step; panel badges, unanswered line, Rule 502(b) reminder, 90-day note
  - Status step for an investor on file; corrections while pending; resume from the old Accreditation step
  - Purchaser representative's written acknowledgment upload (rep-<investor id>-<time>) and its download in the console
  - status-flow.js parts full, accredited, unanswered, other, existing, back, repack, resume; status-math.js cases flags, holders, managed
affects: [06-03, 06-04, 06-06, 06-07]
tech-stack:
  added: []
  patterns: [places under the limit ranked accepted-first then by first subscription, slice hashes pinned to a named base commit]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-02-SUMMARY.md
  modified:
    - assets/js/eligibility.js
    - assets/js/onboarding.js
    - assets/js/console.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
decisions:
  - "Who is 'the 36th': non-accredited investors take places accepted first, then pending, each in the order they first subscribed; a request is flagged when its investor's place is after 35. Declining anyone ahead moves the others up"
  - "The unanswered line counts investors (one per purchaser, like the count), not subscriptions, and names how many are holders with no subscription made here (planner's choice: they count as without an answer)"
  - "An investor on file whose record holds a ground worded by the earlier list (NS.data.ACCRED) sees that ground first on the status step, selected, marked 'The ground on your record'"
  - "A refused acknowledgment file shows a message but is not a field error: Continue still works (D-30); a refused replacement leaves an earlier accepted file in place"
requirements: [STAT-01, STAT-04, WL-01]
metrics:
  duration: "about 24 minutes from recording the base commit (13:59:21 UTC) to the end of the gate (14:23:44 UTC); reading time before 13:59 not measured"
  completed: 2026-11-15
actuals:
  tokens: 15200
  tasks: 3
  commits: 5
plan_head_before: 555d09ac4da03aee034b7845b16f0d425e30793f
plan_head_after: ce17e79fbe390213b13baf85f7a621a6715a08e8
---

# Phase 6 Plan 02: Every Rule 506(b) status case Summary

What this adds on top of 06-01: the 36th non-accredited purchaser now sees a plain warning and can still subscribe. The sponsor sees "36 of 35" with a red badge and a flag on that request. Investors who leave the question open, accredited investors, other exemptions, investors already on file, answers corrected while pending, and flows saved before 06-01 are all handled. An investor can upload their purchaser representative's written acknowledgment, and the sponsor can download it. The managed edition's onboarding code hashes exactly as it did at the 06-01 base.

The owner has not checked any of this yet. It is not done until he has.

## Failures first

- **No gate failure.** The Task 3 gate ran verbatim from SCRATCH/exec-06-02/gate.sh and exited 0.
- **The Task 2 verify command prints a usage error** (`tail: option used in invalid context -- 2`): `tail -2` with two files is refused by this machine's tail. Its pass decision comes from the two greps, and both passed: "STATUS MATH: PASS (cases run: 7)" and "STATUS FLOW: PASS (parts run: 8)". The Task 3 gate uses `tail -n 2` and is not affected.
- **The managed slice case cannot show RED.** It is a guard: the slices were already unchanged at Task 2's commit. Instead the case includes a self-test showing that a one-character change to stepsFor gives a different hash.

## Gate (Task 3 verify, run verbatim, GATE_EXIT=0)

```
==> server.txt <==   # todo 0 / # duration_ms 9561.668463   (# pass 171, # fail 0)
==> math.txt <==     STATUS MATH: PASS (cases run: 8)
==> status.txt <==   STATUS FLOW: PASS (parts run: 9)
==> persons.txt <==  TWO PERSONS: PASS
==> owner.txt <==    PASS walkA (16 s) 13/0; PASS walkB (37 s) 10/0; PASS walkC (78 s) individual 17/0, entity 17/0; PASS leak (2 s); MEASURE: PASS
signing-step.js: base tree 75 PASS 0 FAIL, plan tree 75 PASS 0 FAIL
record-check.js: base tree 40 PASS 0 FAIL, plan tree 40 PASS 0 FAIL
```

All outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-02/. Screenshots are in SCRATCH/exec-06-01/checks-out/status-shots/, because checks/lib.js's OUT default is shared with 06-01: full-status-warning.png, full-console-36.png, full-requests.png, accredited-*.png, unanswered-console.png, existing-status.png, repack-refused.png, repack-attached.png, repack-requests.png.

## RED runs (TDD)

- Task 2, against 786f572 (red-math.txt, red-flow.txt): `STATUS MATH: FAIL (cases run: 7) - holders`. `STATUS FLOW: FAIL (parts run: 8) - full, accredited, unanswered, other, existing, back, resume` (b506 passed). The failures were: missing 90-day and 502(b) notes; done rows still read "Self-certified"/"Not provided"; the investor on file got "Step 1 of 4" with no status step; request.qual was unchanged after Back; the old saved step resumed at "Welcome, Dana".
- Task 3, against 167f0e3 (red3-flow.txt): `FAIL repack ran to the end :: page.setInputFiles: Timeout 30000ms exceeded.` (there was no upload input yet). `STATUS FLOW: FAIL (parts run: 1) - repack`.
- Task 1 (tracer): its first run passed. Tracer gate: re-run after the last Task 1 code change gave "STATUS FLOW: PASS (parts run: 1)".

## Tasks

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 (tracer) | 36th non-accredited purchaser warned, subscribes; sponsor sees 36 of 35 and the flag | 786f572 | eligibility.js, onboarding.js, console.js, checks/status-flow.js |
| 2 (tdd) | accredited, unanswered, other, notes, done row, on file, corrections, resume | d9387e2 (test), 167f0e3 (feat) | the same, plus checks/status-math.js |
| 3 (tdd) | purchaser representative's acknowledgment, managed edition proved unchanged, full gate | 0b00aed (test), ce17e79 (feat) | onboarding.js, console.js, checks/status-flow.js, checks/status-math.js |

## What was built

- **eligibility.js**:
  - `tally` per investor (declined left out).
  - `nonAccredited` now also returns `ranked` (places: accepted first, then pending, each by first subscription) and `holders` (investors holding the offering with no subscription made here). These holders are counted in `unanswered`.
  - `place(ws, o, id)` gives the investor's own place, or the next one.
  - `flags(ws, r)` returns "Would be non-accredited purchaser {n} of the 35 allowed under Rule 506(b)" for a 506(b) request answered not accredited whose investor's place is after 35. No flag for declined, accredited or unanswered requests, for redemptions, or for any other exemption.
- **Status step** (onboarding.js):
  - Limit warning (local mode, answer "no", place after 35). Its text: "This offering may already have as many investors who are not accredited as it is able to accept. You can still subscribe: {firm} reviews every subscription and will let you know if yours cannot be accepted." It contains no number and no name (T-06-04).
  - A ground worded by the earlier list is shown and selected.
  - Optional acknowledgment upload: PDF, PNG or JPEG by first bytes (`sendable`), at most 25 MB, stored as `rep-{investor id}-{Date.now() base 36}`. Anything else gets a plain message and nothing is stored (T-06-05).
- **Flow**:
  - The existing-investor branch adds 'status' when `statusStep(c)`.
  - The subscribe tick follows the status answer for investors on file too.
  - Saving the status step while the request is pending sets `request.qual = qualFrom(...)` and logs "Investor status updated" under the request id. A decided request keeps its qual.
  - `currentKey` maps a saved 'accreditation' to 'status'.
  - The done row reads "Accredited (self-certified)", "Not accredited" or "Not answered" whenever the flow has the status step. Verified flows keep today's row.
- **Console**:
  - Panel badge "At the limit" (warn) at 35 and "Over the limit" (red) above 35.
  - Unanswered line, for example: "15 investors have no status answer on file and are not in the count; 14 of them hold the offering without a subscription made here."
  - Rule 502(b) reminder when the count is above 0, and the 90-day integration note always.
  - Request rows show flags as warn lines, plus "Purchaser representative: {name}, {firm}" with "Download the written acknowledgment" (the existing kyc-iv-file action) or "; no written acknowledgment uploaded". Approve is unchanged (C-01).
- **Checks**:
  - status-flow.js: 9 parts, 125 checks in the gate run, 0 FAIL.
  - status-math.js: 8 cases, including `flags` (13 checks on hand-built workspaces), `holders`, and `managed` (7 slice hashes pinned to 06-01's base commit 414fd9a2 plus the self-test).

## Deviations from Plan

1. **[Rule 1 - Bug] Who counts as "the 36th".** The plan defines the flag as "investor not already counted and the count without them is 35 or more". Read literally with all 36 pending, every one of the 36 would be flagged, because each has 35 others. Places are therefore ranked (accepted first, then pending, by first subscription), and only places after 35 are flagged. The plan's cases hold: 35 plus one flags only the new one, 34 plus one flags nothing, declining one clears the flag, and a counted investor's second subscription flags nothing. (786f572)
2. **[Rule 2 - Correctness] Prefill for investors on file.** Sample records hold grounds in NS.data.ACCRED wording, which is not among BASES. The prefilled answer would have been invisible (no radio selected) while still recorded. The on-file ground is now listed first and selected. (167f0e3)
3. **Unanswered wording.** The plan quotes "1 subscription has no status answer". The sample offering already has 14 holders, which count as unanswered under the planner's choice, so the line counts investors and names the holders. The check asserts the baseline plus one.
4. **Self-certification record in the accredited part.** The firm's default accreditation connection is the sandbox, which makes no self-certification record (that existing rule is unchanged). The part turns on the firm's "Self-certification (Rule 506(b) only)" connection, then checks the record's method "Self-certified: {ground}" and i.accreditation's ground and date.
5. **Console warn lines use existing classes** (`.sub` wrapping `.iv-warn`, `.cs-badge-warn/-bad`), and the investor warning uses `.wire-warn`. No CSS file was changed.

## Observations for the owner (not changed)

- An investor who first answers "yes" and later corrects it to "no" keeps the self-certified ground on their investor record (from 06-01's save). The request's qual, the count and the done row all follow the correction. Clearing the record's ground on such a correction is not built.
- Server mode: the acknowledgment file stays in the investor's browser storage. Sending it to the firm's integration server belongs to plans 06-06/06-07 (the rep- naming is ready for 06-07's allowance). The 36th warning is local mode only, because a server-mode browser holds no other investor's subscription.
- The console's exemption hint ("Rule 506(c) offerings take verified accredited investors only...") still shows under a Rule 506(b) selection. This was already the case before this plan.
- The 501(e) exclusion (relatives sharing a home) is not asked, so the count errs on the high side (planner's choice).

## Known Stubs

None.

## Threat Flags

None beyond the register. T-06-04: the warning shows no count or name (checked). T-06-05: first-byte check, 25 MB cap, investor's own rep- id, nothing stored on refusal (checked by reading the browser's file store).

## TDD Gate Compliance

- Task 2: test commit d9387e2 failed against 786f572 (quoted above), then feat commit 167f0e3 made it pass.
- Task 3: the repack part failed against 167f0e3 (code restored from HEAD for the run, then put back), with test commit 0b00aed and feat commit ce17e79. The managed slice case is a guard and passes at both points (see Failures first).

## Self-Check: PASSED

- FOUND: assets/js/eligibility.js, assets/js/onboarding.js, assets/js/console.js, checks/status-flow.js, checks/status-math.js
- FOUND: 786f572, d9387e2, 167f0e3, 0b00aed, ce17e79 (all ancestors of HEAD); 5 commits measured from 555d09a
- server/node_modules link created by the gate was removed afterwards; nothing under it was staged. STATE.md and ROADMAP.md not touched.
