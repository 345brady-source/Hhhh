---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 07
subsystem: investor onboarding in server mode (integration server), sponsor console import
status: complete
tags: [server-mode, integration-server, rule-506b, c-01, d-01, d-30, erisa, purchaser-representative, white-label, t-06-15, t-06-16, t-06-17]
requires:
  - 06-06 (checks/lib.js serverPortal, open allow/init, server-mode.js parts b506 and regA, server/test/invitations-status.test.mjs)
  - 06-05 (investor.erisa, qual.erisa)
  - 06-02 (the acknowledgment upload, qual.sophistication.rep)
  - 06-01 (the 506(b) count, the C-01 warning in local mode)
provides:
  - snapshot offering.nonAccreditedFull (one boolean, worked out when the invitation is sent), kept by the server only as true or false
  - on-file summary accBasis and erisa (cleaned on the server), prefilled on the investor's device, taken back by the console's merge
  - the rep- acknowledgment through sendCompletion, the server's allowlist and the console's merge
  - the console sets an imported subscription's submitted and dealing dates itself
  - checks/server-mode.js parts full, existing, repack, clean (6 parts in all)
  - checks/lib.js owner screenshot set (SCRATCH/exec-06-07/shots, index.txt failed parts first)
affects: [06-12]
tech-stack:
  added: []
  patterns: [one boolean worked out on the console instead of a count on the device; the stored submission altered before import to prove the console sets the value itself; every check screenshot copied into one owner folder with an index]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/deferred-items.md
  modified:
    - assets/js/invitations.js
    - assets/js/onboarding.js
    - assets/js/console.js
    - server/lib/invitations.mjs
    - server/test/invitations-status.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
decisions:
  - "nonAccreditedFull uses eligibility.place(ws, offering, investor) > 35, the same test as the local-mode warning, rather than count >= 35: it gives the same result for a new investor (34 counted: false, 35 counted: true) and does not warn an investor who already holds one of the 35 places"
  - "accBasis is sent and kept only when it is not empty, so the summary of an investor with no ground on file is exactly as before (two existing server tests require that)"
  - "The console takes a self-certified ground from the link only when the request's qual records that answer (accredited true, the same ground), no verification was taken, and the console's record has no third-party verification (verifiedBy)"
  - "The acknowledgment goes after the ID and accreditation evidence (the agreement first, then evidence, then the acknowledgment), because the ID matters more for KYC when the 25 MB limit forces a choice"
  - "The requests page's Date column is by design the subscription's closing date (closed-end offering) or effective date (open-ended), not the request's own date (that is the Submitted column)"
requirements: [STAT-01, STAT-03, STAT-04, WL-01]
metrics:
  duration: "about 42 minutes from recording the base commit (16:03:37 UTC) to the end of the passing gate (16:45:06 UTC); the summary and push came after"
  completed: 2026-11-15
actuals:
  tokens: 22500
  tasks: 3
  commits: 7
plan_head_before: 87a6910fc9d9c254556aa3aad55cad9d6d381aec
plan_head_after: e680295e72aa7b3da949ae72f0c20fe8abe66e09
---

# Phase 6 Plan 07: The rest of server mode for the status answers Summary

In server mode the investor's own device now gets three things the shared demo browser already had:

- **The Rule 506(b) warning, from one true or false value.** The console works out "this offering may already be full" when it sends the invitation. The device never learns a count, a name or any other investor's detail.
- **Their own answers prefilled.** An investor on file sees their accreditation ground and benefit plan answers already filled in. The console takes back what they changed.
- **The purchaser representative's acknowledgment.** The file reaches the console, and the console's download returns the same bytes. A file too large to go with the agreement is reported to both sides.

The owner has not checked any of this. It is not done until he has looked at the screenshot set.

## Failures first

1. **The first full gate run failed (GATE_EXIT=1).** The fault was in the test environment, not the product.
   - record-check.js on the plan tree stopped on its first page: `page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:38194/diy.html`.
   - The gate's own `kill` then reported `(22669) - No such process`. That means the python static server for that run had already exited. The most likely cause is that the randomly chosen port was taken at that moment.
   - On the same tree in the same run, signing-step.js passed 75 of 75. record-check.js passed 40 of 40 on the base tree.
   - The whole gate was then re-run unchanged and exited 0 (16:36 to 16:45 UTC). The first run's outputs are kept in SCRATCH/exec-06-07/gate-run1/.
2. **The 06-06 report about the Date column: the column itself is by design, but checking it found a real fault, now fixed.**
   - The fault: in server mode the console took the request's dates exactly as the investor's device sent them.
   - A check altered the stored submission to `submitted 2001-01-02` and `dealing 1999-12-31`. The console imported both as sent, and the requests row read "Jan 2, 2001" (RED run, red-dates.txt).
   - For an open-ended offering, the dealing date becomes the funded position's effective date (operations.js markFunded). So this was more than a display problem.
   - Fixed as a deviation, see below. The column itself is explained under "The Date column" below.
3. **Gaps found in this plan's own work and closed before the gate:**
   - Two existing server tests (invitations-existing.test.mjs 66 and 67) failed on the first implementation, because the summary always carried `accBasis: ''`. The summary now carries it only when there is a ground.
   - Three status-flow parts (other, back, resume) reached status screens but took no screenshot. Screenshots were added and those three parts re-run after the gate: STATUS FLOW PASS (parts run: 3), 0 FAIL. No assertion changed.
4. **Not fixed, recorded in deferred-items.md:**
   - An investor on file who now answers "not accredited" in server mode keeps their old ground on the console's investor record. The request and the 506(b) count are right. In local mode the ground is withdrawn.
   - signedAt and signedBy still come from the device as sent. Both are display fields today.

## Gate (Task 3 verify, run verbatim from SCRATCH/exec-06-07/gate.sh; second run GATE_EXIT=0)

```
==> .../exec-06-07/server.txt <==
# todo 0
# duration_ms 10483.59863

==> .../exec-06-07/math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 13)

==> .../exec-06-07/status.txt <==
PASS flag no request left the check server
STATUS FLOW: PASS (parts run: 24)

==> .../exec-06-07/srvmode.txt <==
PASS clean the investor’s device reached nothing outside but the integration server
SERVER MODE: PASS (parts run: 6)

==> .../exec-06-07/persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> .../exec-06-07/owner.txt <==
PASS leak (3 s): 387 files and 426 commit messages searched: no name of the list, no run of eight words outside the allowed list; ...
MEASURE: PASS
GATE_EXIT=0
```

- server: # tests 177, # pass 177, # fail 0 (174 before, plus 3 new)
- status-flow: 316 PASS, 0 FAIL
- server-mode: 167 PASS, 0 FAIL
- walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0
- signing-step.js: 75 PASS, 0 FAIL on both the base tree and the plan tree
- record-check.js: 40 PASS, 0 FAIL on both trees

## Tasks

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 (tracer) | The 35-count warning in server mode through one boolean | ad24c54 | invitations.js, server invitations.mjs, onboarding.js, server-mode.js |
| 2 (tdd) | On-file answers both ways, the acknowledgment through the server | 10827d3 (RED), c5bfcb8 (GREEN) | the same, plus console.js and invitations-status.test.mjs |
| Rule 2 fix | The console sets an imported subscription's dates | 2b9c56e (RED), 5bc3c3c (fix) | server-mode.js, invitations.js |
| 3 | Part clean, the owner's screenshot set, the gate | eb23928, e680295 | lib.js, server-mode.js, status-flow.js, deferred-items.md |

Tracer gate: part full passed after Task 1 (16:06 UTC). It was re-run after the commit and passed again (exit 0). Run against the base code, the same part failed 5 checks (red-full.txt): the snapshot had no flag, and no warning was shown.

## What each part measured

**full (server mode, C-01).** Two runs.

With 34 non-accredited purchasers counted in the console:
- The snapshot the investor's page receives has `nonAccreditedFull === false`.
- No warning shows, either before or after the investor answers "not accredited".
- After import the console shows "Non-accredited purchasers: 35 of 35" with "At the limit".
- The stored request is backdated before import, and the console still sets submitted to today and the date to the offering's closing date.

With 35 counted:
- The snapshot has `true`, and the device's workspace holds it as a boolean.
- No warning shows before the investor answers. After "not accredited", the warning appears: no number, no "Seeded Purchaser" name, "You can still subscribe".
- The investor completes. The console shows "36 of 35", and the request row carries "Would be non-accredited purchaser 36 of the 35 allowed under Rule 506(b)".

**existing (D-01 both ways).** The investor is an active sample investor on file, with erisa set to title1 and controlling yes, and a self-certified ground dated 2024-01-15.
- The snapshot's summary carries `accBasis` and `erisa {plan 'title1', planPct null, controlling true}`. Its keys are exactly accBasis, accredited, accreditedUntil, erisa and holds: no address, phone, tax ID or bank.
- The device's status step is prefilled with yes, the ground, Title I and control yes.
- The investor changes the plan to "none". The steps are Welcome, Investor status, Subscription, Subscription agreement.
- After import: the console's investor.erisa is plan none, control yes. The ground is the same and is now dated today. The qual reads 506b, accredited true, the ground, plan none, share 0.

**repack (D-30, T-06-16).**
- The investor attaches a PDF. It is stored as `rep-{investor id}-{time}` and named by the device's qual.
- The server holds it byte for byte. The console stores it under the same id, byte for byte.
- The request row shows the representative and "Download the written acknowledgment". The download returns the same bytes, named acknowledgment.pdf.
- A second run attaches 25 MB, which is accepted on the page but does not fit with the agreement:
  - The completion still goes, and the server holds the agreement only.
  - The firm's copy of the request has no fileId, plus a note: "...did not fit in the 25 MB ... Ask the investor for it."
  - The change log records "Uploaded evidence not sent".
  - The done screen tells the investor.
  - The request row shows the note and no download.

**clean (T-06-15).** The check reads, in the investor's own browser, what the page received from the server, with 35 others on the console.
- `nonAccreditedFull` is a boolean.
- No key anywhere could carry a count, a place, investors, requests or positions.
- The offering has only its known fields, and the investor is the invited one alone.
- None of the others' 35 names, emails, investor ids or request ids appears.
- The device's workspace holds one investor and no request.
- The warning shows, with no number and no name.

**b506, regA (06-06).** These run unchanged and pass.

**Server tests (3 new).**
- nonAccreditedFull: true and false are kept. "true", 1, an object or nothing all become false. Unknown offering fields and names never reach the investor.
- The on-file summary: accBasis is clipped to 300 characters and left out when it is not text or is empty. Of erisa, only plan (one of five values, otherwise ''), planPct (a number from 0 to 100, otherwise null) and controlling (true, false or null) are kept. A summary without answers is unchanged.
- rep- files: PDF, PNG and JPEG are kept byte for byte when the qual names them for this investor. A named file that is not one of those formats is refused (400). Another investor's id, an unnamed rep- file, a qual naming another investor's file, uppercase, or an empty suffix: all are dropped, and the completion still succeeds. A disallowed file that is not even base64 is dropped unread.

RED runs, against Task 1's commit ad24c54 (red-srv.txt, red-browser.txt):
- Server tests 5 and 6 failed: the summary was `{accredited, accreditedUntil, holds}` only, and the rep file came back as `undefined`. Test 4 passed because Task 1 had already added the boolean.
- existing failed 6 checks. The prefill was `{acc:'', basis:'', plan:'', ctrl:''}`, and the console's erisa stayed title1 with the old date.
- repack failed 3 checks: the server held only the work copy, the console had no file, and the download timed out.

## The Date column (the 06-06 report)

The requests page has two date columns:
- **Submitted** is the request's own day.
- **Date** is, by design, the subscription's closing date for a closed-end offering (subtitle "Closing"), its effective date for an open-ended one ("Effective"), or a redemption's dealing date (operations.js submitSubscription: `dealing: open ? subscriptionDate(today) : o.closeDate`).

"Sep 30, 2019, Closing" appeared because the check's sample portal has no raising offering. setupPortal therefore takes Fund II, which closed on 2019-09-30, and marks it Raising without moving its closing date. A real raising offering would carry its own future closing date. The screenshot server-mode__full__full34-requests.png shows the column after the fix: Submitted Nov 15, 2026 and Date Sep 30, 2019 Closing, both set by the console.

## Deviations from Plan

1. **[Rule 2 - Security] The console now sets an imported subscription's dates.**
   - Found while checking the Date column.
   - submitted is kept between the invitation's sending day and today.
   - dealing is the offering's closing date, or `ops.subscriptionDate(submitted)` for an open-ended offering.
   - RED assertion: part full, 34-count run (2b9c56e). Fix: 5bc3c3c in assets/js/invitations.js.
2. **[Rule 2 - Correctness] The console's request row shows the note when the acknowledgment could not be sent.** It used to say "no written acknowledgment uploaded". This is assets/js/console.js repLine, a file not in the plan's file list. (c5bfcb8)
3. **[Rule 1 - Bug, own work] accBasis is sent only when there is a ground.** Two existing server tests caught the empty field. (c5bfcb8)
4. **Choice: nonAccreditedFull uses `place() > 35` rather than `count >= 35`.** It matches the local-mode warning; see decisions.
5. **Extra coverage beyond the plan:**
   - the 25 MB acknowledgment case (unsent note, change log, done screen, row)
   - the backdated dates check
   - 35 of 35 "At the limit" on the 34-count run
   - screenshots added to status-flow parts other, back and resume
6. **The verify command for Task 2 uses `tail -3` with two files.** This machine's tail refuses that form ("option used in invalid context"). The script used `tail -n 3`, as instructed. The grep conditions ran as written, and the first run's exit code was 0.

## The owner's screenshot set (pending his check)

Folder: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-07/shots/

- Start with index.txt in that folder (/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-07/shots/index.txt): 87 screenshots from 30 parts, failed parts first (none).
- Server mode (the investor's own device and the console): `server-mode__{b506,regA,full,existing,repack,clean}__*.png`, 33 files.
- Local mode: `status-flow__<part>__*.png`, 54 files.

## Observations for the owner (not changed)

- In server mode the investor's pages show the firm's letters ("KB") rather than the Kestrel Bay logo image that local mode shows. That is how the snapshot carries the logo today (only image logos of 600 KB or less travel). Plan 06-07 did not change it.
- The firm's note for an acknowledgment that could not go reads "The written acknowledgment of their purchaser representative the investor uploaded (...) did not fit...". It is clear, but the wording could be smoother.

## Known Stubs

None.

## Threat Flags

None new.
- T-06-15: part clean and the server boolean test.
- T-06-16: the server allowlist test with forged ids, and repack.
- T-06-17: merge takes only cleaned erisa, and a self-certified ground only when the qual records it and no third-party verification exists.
- The date fix closes a tampering path that was not in the register (the device-supplied dealing date, which an open-ended position takes as its effective date).

## TDD Gate Compliance

Task 2: RED commit 10827d3, GREEN commit c5bfcb8; the RED runs are quoted above. Date fix: RED 2b9c56e, fix 5bc3c3c. Task 1 is a tracer task. Its RED against the base code is in red-full.txt.

## Self-Check: PASSED

- FOUND: assets/js/invitations.js, assets/js/onboarding.js, assets/js/console.js, server/lib/invitations.mjs, server/test/invitations-status.test.mjs, checks/server-mode.js, checks/lib.js, checks/status-flow.js, deferred-items.md, shots/index.txt
- FOUND: ad24c54, 10827d3, c5bfcb8, 2b9c56e, 5bc3c3c, eb23928, e680295, all ancestors of HEAD. 7 commits measured from 87a6910 with `git rev-list --count`, before this summary's commit.
- server/node_modules is a link used only for the runs and was never staged. STATE.md and ROADMAP.md were not touched.
