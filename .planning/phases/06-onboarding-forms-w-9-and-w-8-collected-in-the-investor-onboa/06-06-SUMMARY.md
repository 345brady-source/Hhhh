---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 06
subsystem: investor onboarding in server mode (integration server), sponsor console import
status: complete
tags: [server-mode, integration-server, rule-506b, regulation-a, erisa, d-01, c-01, d-30, white-label, t-06-13, t-06-14]
requires:
  - 06-05 (qual.erisa, investor.erisa, offering.erisaControlling, the Benefit plan investors panel)
  - 06-03 (qual.regA, regAStatus recomputed on render, the Regulation A request flag)
  - 06-01/06-02 (the status step, request.qual, the 506(b) count, checks/lib.js)
provides:
  - checks/lib.js serverPortal(S) (the real integration server in process), open(S, { allow, init }), consoleRoute, inviteFromConsole, importFromConsole, finishAgreement, freePort
  - checks/server-mode.js parts b506 and regA; last line "SERVER MODE: PASS (parts run: N)"
  - server/test/invitations-status.test.mjs (request.qual pass-through, the 256 KB request limit)
affects: [06-07, 06-12]
tech-stack:
  added: []
  patterns: [two browser contexts that share nothing but the in-process server; the stored submission altered in place to prove the console recomputes]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
    - server/test/invitations-status.test.mjs
  modified:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
decisions:
  - "No product change: request.qual (506(b), Regulation A and benefit plan answers) already travels whole through /v1/invite/complete (cleanJson, 256 KB) and the console's merge keeps it; the proof found no fault"
  - "The in-process server runs without DATA_KEY (NODE_ENV test stores the submission as { plain }) so the regA part can alter the stored submission; the server unit test runs with DATA_KEY and checks the answers are not readable at rest"
  - "PUBLIC_URL is set to the server's own address (a free port is taken before it starts), so the link the server builds carries ?server= of this server, not the default localhost:8787"
requirements: [STAT-01, STAT-02, STAT-03, STAT-04, WL-01]
metrics:
  duration: "about 15 minutes from recording the base commit (15:46:09 UTC) to the end of the gate (16:00:56 UTC); reading time before 15:46 not measured"
  completed: 2026-11-15
actuals:
  tokens: 10000
  tasks: 2
  commits: 2
plan_head_before: f7d80ae352f19a398169910abfad6a558c03d9eb
plan_head_after: c3d10a255b2f54b72f1c7f2f71a165bebfd38344
---

# Phase 6 Plan 06: Investor status answers in server mode Summary

This plan shows that the investor status answers travel through the firm's integration server unchanged and are counted there. The run uses the real server code in this process and two browser contexts that share nothing except that server: the sponsor's console in one, the investor's device in the other. The answers are the Rule 506(b) ones, the Regulation A Tier 2 figures and the benefit plan answers (qual.erisa). The console imports with its own "Check now" button. The 506(b) count, the benefit plan figure and the Regulation A flag then come out as they do in local mode. The console recomputes the Regulation A flag itself, even when the stored submission's device flag has been changed to "not over".

The owner has not checked any of this yet. It is not done until he has.

## Failures first

- **No gate failure.** The Task 2 gate ran exactly as written, from SCRATCH/exec-06-06/gate.sh, and exited 0 (GATE_EXIT=0, 15:53:03 to 16:00:56 UTC).
- **One check failed on its first run, and the fault was in the check.** The b506 part's storage check looked for keys starting with `ws:`. The portal stores them under the edition's prefix (for example `cvp2:ws:`). With the corrected pattern, the investor's device holds exactly one workspace, `ws:invite-...`, and never `ws:kestrel-bay`. The product was not at fault.
- **The Task 2 test could not show RED.** The regA part passed on its first run against Task 1's code, because the product already recomputes the flag (06-03). Its RED-capable assertion is the tamper case: the console's own copy holds `overLimit: false` and a $1,000,000 limit, and the console still shows "$60,000 committed in this offering, limit $12,000". No fix commit followed.
- **Out of this plan's scope:** investor.erisa (it does reach the console with the investor record, but this plan does not assert it), offering.erisaControlling in the snapshot, and the purchaser representative's acknowledgment file in server mode. These belong to plan 06-07.

## Gate (Task 2 verify, run verbatim, GATE_EXIT=0)

Last lines, verbatim:

```
==> server.txt <==
# todo 0
# duration_ms 9739.779127

==> math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 13)

==> status.txt <==
PASS flag no request left the check server
STATUS FLOW: PASS (parts run: 24)

==> srvmode.txt <==
PASS regA white label: the investor’s status and subscribe screens and the console pages pass the leak check
SERVER MODE: PASS (parts run: 2)

==> persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> owner.txt <==
PASS leak (2 s): 385 files and 417 commit messages searched: no name of the list, no run of eight words outside the allowed list; ...
MEASURE: PASS
GATE_EXIT=0
```

- server: # tests 174, # pass 174, # fail 0 (the 171 from before plus the 3 new ones)
- status-flow: 316 PASS, 0 FAIL. server-mode: 51 PASS, 0 FAIL
- walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0
- signing-step.js: 75 PASS, 0 FAIL on both the base tree and the plan tree
- record-check.js: 40 PASS, 0 FAIL on both trees

All outputs are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-06/. Screenshots are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-06-01/checks-out/server-shots/ (checks/lib.js's shared OUT): b506-status.png, b506-subscribe.png, b506-done.png, b506-console-offering.png, regA-status.png, regA-subscribe.png, regA-done.png, regA-requests.png, regA-console-offering.png.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | Non-accredited 506(b) investor with plan answers completes in server mode; the console counts them | 6fc9f7f | checks/lib.js, checks/server-mode.js, server/test/invitations-status.test.mjs |
| 2 (tdd) | Regulation A Tier 2 investor over the limit in server mode (stored device flag altered); full gate | c3d10a2 | checks/server-mode.js |

Tracer gate: Task 1's verify was re-run end to end after the last code change (verify1.sh, exit 0): "# fail 0" and "SERVER MODE: PASS (parts run: 1)". An unknown or empty `--only` exits 1.

## What was proved

**Part b506 (27 checks).**
- The console sends the invitation with its own Investors form, and the server holds it. The link carries `?server=` and the console keeps no token.
- The investor's device, in an empty context with the server listed in `window.CVPortalConfig.integrationServers`, loads from the server (`state.remote`).
- The investor answers "not accredited" with experience, education, a purchaser representative and plan 4975, then completes the subscription and the agreement.
- The investor's device called only `/v1/invite`, `/v1/invite/progress` and `/v1/invite/complete`. The console called only send, list, submission and delete.
- The qual is the same at every hop: the device's request.qual equals the server's stored qual, which equals the console's imported qual. That includes the sophistication answers and `erisa {plan '4975', share 1}`.
- The investor's change-log entry reached the console. The console offering page shows "Non-accredited purchasers: 1 of 35" and "0 accepted and 1 more pending".
- In the benefit plan panel, the class reads 0% before acceptance. The request's if-accepted figure equals the share worked out in the check from the holders' commitments (0.9% for $60,000).
- The investor's status screen and the console page pass the leak checks. There were no script errors.

**Part regA (24 checks).**
- The sponsor picks "Regulation A Tier 2" with the console's select.
- The investor gives income $85,000 and net worth $120,000. The device shows "Your investment limit in this offering: $12,000", warns on the subscribe step for $60,000 and does not block.
- The device's qual says over the limit. The server copy before tampering equals the device's qual.
- The check then changes the stored submission (`overLimit: false`, `limitCents: 100000000`), and the console imports that changed copy exactly.
- The request row still reads "Over the Regulation A Tier 2 limit: $60,000 committed in this offering, limit $12,000", and Approve and Decline are still there. The eligibility panel reads "1 non-accredited subscriber, 1 over their 10 percent limit" and "Dana Whitfield: $60,000 committed in this offering, limit $12,000".
- The leak check passes.

**Server tests (3).**
- request.qual with 506(b), Regulation A and plan fields, Unicode included, comes back unchanged at GET /v1/invitations/:id/submission. With DATA_KEY set it is sealed at rest.
- The investorId, offeringId and a locked commitment are still forced (T-06-14).
- A device flag that disagrees with its figures passes through as sent, and the console recomputes.
- A request over 256 KB is refused with 413 and nothing is stored. Just under the limit is accepted whole.

## Deviations from Plan

1. **[Rule 3 - Blocking] The check browser refused the integration server.** checks/lib.js `open()` aborted every request not sent to the check's own origin. It now takes `allow` (extra origins, with the calls recorded in `net.allowed`) and `init` (a script run before the page's scripts). Existing callers pass neither, so their behaviour is unchanged. (6fc9f7f)
2. **PUBLIC_URL added to the server's environment.** It is not in the plan's env list. Without it the server builds links to `http://localhost:8787`, and the investor's device would load from the wrong address.
3. **Extra assertions beyond the plan:**
   - the device-to-server hop of qual (not just server to console)
   - which server calls each side made, and the console's delete after import
   - the limit tamper, alongside overLimit
   - the server test of a locked commitment and of DATA_KEY sealing

## Observations for the owner (not changed)

- On the console's requests page, the new subscription's Date column reads "Sep 30, 2019, Closing". That is the sample offering's closing date, which the check set back to Raising. A real raising offering would have a future date. This is not caused by this plan and is unchanged in local mode.
- The step counter in this server-mode 506(b) flow reads "Step 10 of 10" (there is no verification step under 506(b)).

## Known Stubs

None.

## Threat Flags

None. No product file changed. T-06-13: the 256 KB limit is checked in the server test, and the console recomputes from stored figures, as the regA part shows after the stored copy was altered. T-06-14: the invitation's ids and locked amount are forced, and all 174 server tests are green.

## TDD Gate Compliance

Task 2: test commit c3d10a2. It passed against Task 1's code (see Failures first), so no fix commit followed. Task 1 is a tracer task.

## Self-Check: PASSED

- FOUND: checks/server-mode.js, checks/lib.js, server/test/invitations-status.test.mjs
- FOUND: 6fc9f7f, c3d10a2 (both ancestors of HEAD); 2 commits measured from f7d80ae with `git rev-list --count`
- The server/node_modules link created for the runs was removed afterwards and never staged. It shows as untracked (`??`) while present, so the .gitignore pattern does not cover a symlink. STATE.md and ROADMAP.md were not touched.
