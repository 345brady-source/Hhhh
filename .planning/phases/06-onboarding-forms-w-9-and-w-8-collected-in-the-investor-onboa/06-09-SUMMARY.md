---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 09
subsystem: sponsor console import of a server-mode submission (invitations.js merge)
status: complete
tags: [gap-closure, verifier-gap-2, deferred-1, deferred-2, server-mode, d-01, t-06-17, t-06-20, t-06-21]
requires:
  - 06-07 (merge on-file branch, the console sets submitted and dealing, server-mode parts existing and full)
  - 06-08 (merged; status-flow now has 26 parts)
provides:
  - "merge, on-file branch: a self-certified ground withdrawn on a 'not accredited' import, same rule and record as onboarding.js withdrawGround; a verified ground kept with a console change-log entry 'Accreditation kept'"
  - "merge: the imported request's signedBy and signedAt set by the console"
  - "checks/server-mode.js parts withdraw and signed (8 parts in all)"
affects: [06-12]
tech-stack:
  added: []
  patterns: [one meaning of "withdrawn" in both modes; the stored submission altered before import to prove the console sets the value itself]
key-files:
  created: []
  modified:
    - assets/js/invitations.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
decisions:
  - "The withdrawal on import mirrors withdrawGround exactly: it needs the request's qual to record accredited false, no verification taken on this import, and no verifiedBy on the console's ground. The verification record is touched only when it is a self-certification (or a legacy record with the same method), and the investor is decided again (I.decide, I.syncKyc) when the record was there"
  - "A request tied to a kept envelope takes that envelope's investor signature time (the plan's rule). A request that named an envelope the console did not import gets signedAt ''. Only a request that named no envelope at all takes the integration server's completion time (sub.completedAt, the server's own clock), or the import time when there is none"
  - "signedBy is inv.contact, else inv.title, from the console's record"
requirements: [STAT-01, STAT-04]
metrics:
  duration: "about 19 minutes from recording the base commit (18:04:18 UTC) to the end of the passing gate (18:23:04 UTC); the summary and push came after"
  completed: 2026-11-15
actuals:
  tokens: 4100
  tasks: 2
  commits: 3
plan_head_before: ce4a95ad9fe4711f541dbf51218d626d662dfdc8
plan_head_after: b9eea28adc0b5838ca3d0d33ff708dcaa613e4b5
---

# Phase 6 Plan 09: The console's import follows a "not accredited" answer and sets who signed and when Summary

Server mode now does two things it did not do before:

- **A "not accredited" answer withdraws the investor's self-certified ground on the console's record.** Before, it stayed. The record is now exactly what local mode's withdrawGround leaves: basis and date cleared, the old ground kept as superseded with the day it was given and the day it was withdrawn, and the self-certification verification record withdrawn. A ground a third party verified stays.
- **The console sets the request's signedBy and signedAt itself.** It no longer takes them from the investor's device.

The owner has not checked any of this. It is not done until he has looked at the screenshots listed below.

## Failures first

- **The gate passed on its first run (GATE_EXIT=0).** No product failure was found after the fixes.
- **Both new parts failed on the code before this plan, as intended:**
  - withdraw (red-withdraw.txt, base ce4a95a): 2 FAIL, 25 PASS. The console's record still held `{"basis":"Licensed professional (Series 7, 65 or 82)","date":"2026-04-16"}`, and its verification record still read `"status":"verified","method":"Self-certified: ..."`.
  - signed: 6 FAIL in each of two runs. One run was against the base code (red-signed.txt, a copy of ce4a95a with the new check in it). The other was against Task 1's commit (red-signed-task1.txt). In every run the console kept the altered values `"signedAt":"2001-01-02T00:00:00Z","signedBy":"Someone Else"`.
- **A further fault, found while testing and fixed (deviation 1).** In Run B of withdraw, the investor's ground had been verified by a third party, and the console correctly kept it. But the investor's own device still wrote a change-log entry saying the ground "no longer applies", and that entry reached the console. Measured: `"Daniel Whitaker: not an accredited investor; the self-certified ground on the record (Licensed professional (Series 7, 65 or 82)) no longer applies; ... (from the investor's device)"`. The device cannot tell a verified ground from a self-certified one. The console now adds its own entry, "Accreditation kept", saying the verified accreditation stays. The device's entry is still imported as sent; see Open items.

## Gate (Task 2 verify, run as written from SCRATCH/exec-06-09/gate-body.sh)

Two changes from the plan's text:
- The STATUS FLOW count is **26, not 24**. Plan 06-08 is merged and added the parts portal-506b and portal-other. The merged tree really has 26: the run printed `STATUS FLOW: PASS (parts run: 26)`.
- The plan-check addition was appended: `grep -q '^FAIL' $O/red-signed.txt`. The chain ends in `|| exit 1`, so a failure anywhere stops the script.

Last lines, verbatim:

```
==> .../exec-06-09/server.txt <==
# todo 0
# duration_ms 10209.246321

==> .../exec-06-09/math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 13)

==> .../exec-06-09/status.txt <==
PASS portal-other managed: no request left the check server
STATUS FLOW: PASS (parts run: 26)

==> .../exec-06-09/srvmode.txt <==
PASS clean the investor’s device reached nothing outside but the integration server
SERVER MODE: PASS (parts run: 8)

==> .../exec-06-09/persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> .../exec-06-09/owner.txt <==
PASS leak (3 s): 402 files and 447 commit messages searched: ...
MEASURE: PASS
GATE_EXIT=0
```

Also measured:

| Check | Result |
| --- | --- |
| Server tests | # tests 177, # pass 177, # fail 0 |
| status-flow | 405 PASS, 0 FAIL |
| server-mode | 249 PASS, 0 FAIL |
| walkA | 13 PASS, 0 FAIL |
| walkB | 10 PASS, 0 FAIL |
| walkC | individual 17 PASS, 0 FAIL; entity 17 PASS, 0 FAIL |
| signing-step.js | 75 PASS, 0 FAIL on both the base tree and the plan tree |
| record-check.js | 40 PASS, 0 FAIL on both trees |

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | A self-certified ground withdrawn at import; part withdraw | a2f7d8b | invitations.js, server-mode.js |
| 2 (tdd) RED | Part signed | 65a972b | server-mode.js |
| 2 (tdd) GREEN | The console sets signedBy and signedAt | b9eea28 | invitations.js |

**Tracer gate.** Task 1's verify was run from tracer.sh and gave `SERVER MODE: PASS (parts run: 2)` (withdraw and existing, exit 0). It was then run again after the "Accreditation kept" entry was added: PASS (parts run: 2), 53 PASS. Only after that did the work expand to Task 2.

## What each part measured

**withdraw (server mode, Rule 506(b))**

Run A: an active sample investor on file, self-certified ground dated 2026-04-16. The firm accepts self-certification, and the investor holds the self-certification verification record made from that ground. On their own device they answer "not accredited", give sophistication answers, subscribe and sign. After the console's import:
- accreditation basis is '' and date is ''.
- superseded is {basis: the old ground, date 2026-04-16, at: today}.
- verify.accreditation reads not_started, with superseded {method "Self-certified: <ground>", verifiedAt 2026-04-16, at}.
- qual records regime 506b, accredited false.
- The offering page reads "Non-accredited purchasers: 1 of 35".
- The device's change-log entry says the ground no longer applies.
- All common transport and import checks pass.

Run B: the same answer, but the ground carries verifiedBy "Example Verification Services".
- The console's accreditation record deep-equals what it was before.
- qual records accredited false.
- The console's own "Accreditation kept" entry names the verifier and the ground.
- No script error on either side.

**signed.** Three runs. In each, the stored request was altered before import to signedAt 2001-01-02T00:00:00Z and signedBy "Someone Else".
- **envelope:** signedBy is the console's "Dana Whitfield". signedAt equals the kept envelope's investor signature time, inside the invitation window. In this run the envelope is countersigned by the firm, so its status is "sent".
- **unsigned:** the stored envelope's investor signature was un-made. signedAt is ''.
- **noenvelope:** the request's envelopeId and the envelope were removed. signedAt equals the server's completedAt, inside the window.

**existing, full, b506, regA, repack, clean.** These ran unchanged and passed in the gate.

## Deviations from Plan

1. **[Rule 2 - Correctness] The console logs "Accreditation kept" when the investor answers "not accredited" over a ground a third party verified.** Without it, the firm's change log showed only the device's claim that the ground no longer applies, while the record kept it. Run B asserts the new entry. Files: assets/js/invitations.js, server-mode.js. Commit a2f7d8b.
2. **[Rule 2 - Correctness] A request that named an envelope the console did not import gets signedAt ''.** The plan's text gives two cases: a request tied to the kept envelope, and a request with no envelope. A request whose envelope was refused fits neither. Giving it the server's completion time would date a signature the console does not hold. Commit b9eea28.
3. **The gate's STATUS FLOW count is 26 instead of 24** (06-08 merged), and the plan-check grep on red-signed.txt was appended. Both are described under Gate.
4. **Task 2's RED was run twice:** against the base code, as the plan check asked (red-signed.txt), and against Task 1's commit, as the plan asked (red-signed-task1.txt). Both had 6 FAIL. There is a separate RED commit (65a972b) before GREEN (b9eea28).

## Open items (not changed by this plan)

- **signedAt for a firm-countersigned agreement differs between modes.** In local mode, esign.js sets the request's signedAt when the whole envelope completes, which is the firm's countersignature time. In server mode, by the plan's rule, it is now the investor's own signature time. Because esign.js sets signedAt only when it is empty, the firm's later countersignature does not change it. The owner may want one meaning for both modes. Today the field is not shown anywhere: the requests page shows only "E-signed by <signedBy>".
- **The device's own change-log entry still says a verified ground "no longer applies".** The console's "Accreditation kept" entry now sits beside it. To stop the device writing that entry, the on-file summary would need to say whether the ground is verified, and that touches the server allowlist and onboarding.js. A candidate for the phase's security pass.

## Deferred items closed

deferred-items.md item 1 (the server-mode ground after "not accredited") and item 2 (device-supplied signedAt and signedBy) are closed by this plan. The file itself was not edited, per the plan.

## The owner's screenshot set (pending his check)

Folder: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-09/shots/ (index.txt lists failed parts first; none failed).
- `server-mode__withdraw__withdraw-status.png`, `__withdraw-subscribe.png`, `__withdraw-done.png`: the investor on file answering "not accredited" on their own device.
- `server-mode__withdraw__withdraw-console-offering.png`: "Non-accredited purchasers: 1 of 35" after import.
- `server-mode__withdraw__withdrawB-*.png`: the verified-ground run.
- `server-mode__signed__signed-{envelope,unsigned,noenvelope}-*.png`: the three signed runs.

## Known Stubs

None.

## Threat Flags

None new.
- T-06-20 (mitigated): part signed alters the stored signedAt and signedBy before import.
- T-06-21 (mitigated): part withdraw, Run A withdraws the ground and Run B keeps the verified one.

## TDD Gate Compliance

Task 2 RED commit 65a972b, GREEN commit b9eea28. The RED runs are quoted above. Task 1 is a tracer task; its RED against the base code is red-withdraw.txt.

## Self-Check: PASSED

- FOUND: assets/js/invitations.js, checks/server-mode.js, SCRATCH/exec-06-09/{base-commit.txt, red-withdraw.txt, red-signed.txt, red-signed-task1.txt, tracer.txt, gate.txt}
- FOUND commits: a2f7d8b, 65a972b, b9eea28, all ancestors of HEAD. That is 3 commits measured from ce4a95a with `git rev-list --count`, before this summary's commit.
- server/node_modules is a link used only for the runs, never staged, and removed after. STATE.md and ROADMAP.md were not touched.
