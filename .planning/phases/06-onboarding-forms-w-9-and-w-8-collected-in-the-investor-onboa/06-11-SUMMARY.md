---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 11
subsystem: Regulation A Tier 2 investor status step and the sponsor's Regulation A panel
status: complete
tags: [gap-closure, verifier-gap-3, verifier-warning-1, d-07, d-08, c-01, d-30, d-06, rule-251-d-2-i-c, white-label]
requires:
  - 06-03 (Regulation A Tier 2 status step and panel)
  - 06-08 (self-serve portal subscribe route through the status step)
provides:
  - "Tier 2, not accredited: one optional attestation on the status step (stRaAttest); request.qual.regA = { attested: true | false | null }"
  - "eligibility.regAStatus(ws, o) -> { rows: [{ investorId, attested }], notAttested, unanswered: [{ investorId }] }"
  - "eligibility.RA_NOT_ATTESTED: the request flag for a Tier 2 subscription without the attestation"
  - "console regAPanel: not attested (named, warning badge), attested (one line), accredited question unanswered (one line, only when any)"
affects: [06-14 (its server-mode Tier 2 total is no longer needed: there is no total), 06-09, 06-10 (status-flow and server-mode part counts)]
tech-stack:
  added: []
  patterns: [RED against a scratch tree of the base commit with the new checks copied in]
key-files:
  created: []
  modified:
    - assets/js/onboarding.js
    - assets/js/eligibility.js
    - assets/js/console.js
    - server/test/invitations-status.test.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-math.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js
decisions:
  - "D-07 (owner, relayed by the coordinator mid-plan): Regulation A Tier 2 asks the investor who is not accredited to attest that the total they invest in the offering is within 10 percent of the greater of income or net worth (organizations: revenue or net assets). No figures, no limit math, no over-limit flag. Replaces Task 1's holdings total."
  - "D-08 (owner, relayed mid-plan): the ERISA part of this plan (each position counted in its own class) is dropped; the ERISA panel code is untouched."
  - "The attestation wording counts 'anything already held or subscribed' in the offering, so an earlier holding is covered by the investor's own statement (verifier gap 3)."
  - "attested null (an answer saved by the earlier version, with figures and no attestation) is treated as not attested: flagged and named. Figures on old records are not read."
  - "A Tier 2 subscriber whose latest answer has no accredited value, or who has no answers on file, is listed as unanswered; they are not flagged on the request row."
requirements: [STAT-02]
metrics:
  duration: "about 1 hour 50 minutes from recording the base commit to the end of the passing gate, including the abandoned holdings work before D-07 arrived"
  completed: 2026-11-15
actuals:
  tokens: 18034
  tasks: 2
  commits: 2
plan_head_before: b56c1a52b4cf9a9468f8bf8db57e206b11f0ffba
plan_head_after: 2cdc33081edf04f628675276c3a254af7afaa4eb
---

# Phase 6 Plan 11: Regulation A Tier 2 by the investor's attestation, unanswered subscribers named Summary

Under a Regulation A Tier 2 offering, an investor who answers "not accredited" no longer types income, net worth, revenue or net assets and no longer sees a limit worked out. They see one optional statement to tick: "The total I am investing in this offering, counting anything I already hold or have subscribed for in it, is not more than 10 percent of my annual income or my net worth (not counting my primary residence), whichever is greater." (an organization gets the revenue or net assets wording, a joint account "we/our"). If they leave it unticked, the subscribe step warns them and they can still subscribe. The sponsor's Regulation A panel shows who has not attested and who has, with no amounts. The request rows of those who did not attest are flagged, and Approve and Decline stay. The panel also names, in one line shown only when there are any, the Tier 2 subscribers who left the accredited question unanswered.

The owner has not checked any of this. It is not done until he has looked at the screenshots listed at the end.

## Failures first

- **The plan as written was not built.** The coordinator relayed two owner decisions mid-run. D-07: replace the figures and limit with an attestation, and do not extend the holdings total. D-08: drop the ERISA per-class part. Before D-07 arrived I had written the holdings-total checks (status-math `rega-positions`, status-flow `rega-holding`), run them RED on the base code (the verifier's probe: $10,000 held plus $5,000 counted as $5,000, not over) and changed `committedCents`. All of that was reverted without being committed. The RED files from that run were overwritten by the attestation RED runs.
- **The plan's exact counts no longer hold.** The verify command expects `STATUS FLOW: PASS (parts run: 28)`. The real count is 26: the `nofigures` part was removed (there are no figures now) and `rega-unanswered` was added. `rega-holding` was never kept. The gate script checks for 26.
- No other failure. Every rewritten check failed on the base code, and the gate passed on its first run.

## RED runs

Attestation (Task 1). The new checks were run against a scratch tree of base b56c1a5 with the new check files copied in.

`SCRATCH/exec-06-11/red-math.txt`: `STATUS MATH: FAIL (cases run: 3) - rega-attest-api, regastatus, raflags` (15 FAIL lines).

`SCRATCH/exec-06-11/red-flow.txt` (24 FAIL lines, abridged):
```
FAIL regA after "not accredited" the status step shows the one statement for a person, not ticked :: {"attestQ":0,...,"figFields":4,...
FAIL regA request.qual: regime regA2, accredited false, regA exactly { attested: false } :: {..."regA":{"kind":"person","income":null,"netWorth":nul...
FAIL regA the request row carries the "has not attested" flag; Approve and Decline kept :: Nov 15, 2026	Dana Whitfield
FAIL entity the LLC sees the statement for an organization, naming it: revenue or net assets for the most recent fiscal year
FAIL untiered left unticked: the subscribe step warns
FAIL aggregate request.qual.regA is exactly { attested: true }
FAIL flag exactly two request rows are flagged :: []
STATUS FLOW: FAIL (parts run: 6) - regA, entity, accredited2, untiered, aggregate, flag
```

`SCRATCH/exec-06-11/red-srv.txt`: `SERVER MODE: FAIL (parts run: 1) - regA` (7 FAIL lines: no statement on the device, regA still figures, no flag, no panel line).

Unanswered subscribers (Task 2), run on Task 1's commit e3d704f before the code change:
`SCRATCH/exec-06-11/red2-math.txt`: `STATUS MATH: FAIL (cases run: 1) - rega-unanswered` (7 FAIL lines).
`SCRATCH/exec-06-11/red2-flow.txt`: `FAIL rega-unanswered the panel names the subscriber in one line: "Left the accredited question unanswered, so not asked about the 10 percent limit: Dana Whit...` / `STATUS FLOW: FAIL (parts run: 1) - rega-unanswered`.

## Gate (Task 2 verify, run from SCRATCH/exec-06-11/scripts/gate.sh)

Last lines, verbatim:
```
==> server.txt <==
# todo 0
# duration_ms 9727.665137

==> math.txt <==
PASS gate a case list of blanks exits 1 with FAIL
STATUS MATH: PASS (cases run: 14)

==> status.txt <==
PASS portal-other managed: no request left the check server
STATUS FLOW: PASS (parts run: 26)

==> srvmode.txt <==
PASS clean the investor's device reached nothing outside but the integration server
SERVER MODE: PASS (parts run: 6)

==> persons.txt <==
PASS  errors signing: no page errors (0)
TWO PERSONS: PASS

==> owner.txt <==
PASS leak (3 s): 402 files and 446 commit messages searched: ...
MEASURE: PASS
GATE EXIT: 0
```
Also measured: server tests 177 pass, 0 fail. status-flow 400 PASS, 0 FAIL. server-mode 167 PASS, 0 FAIL. status-math 149 PASS, 0 FAIL (the managed-edition slice hashes unchanged, C-03). walkA 13/0, walkB 10/0, walkC individual 17/0 and entity 17/0. signing-step 75/0 and record-check 40/0 on both the base tree and this tree (no new FAIL).

## Deviations from Plan

### Owner-directed changes (relayed by the coordinator during execution)

**1. D-07: the Regulation A Tier 2 limit is the investor's attestation**
- **Replaces:** Task 1 (adding open positions to `committedCents`) and the gap-3 tracer part `rega-holding`.
- **Built:** onboarding.js drops the person/organization choice, the four figure fields, the live limit line, `raFigures`, `raLimitLine` and the amount and figure re-render in the binder. It adds `stRaAttest` with fresh wording, sets `qual.regA = { attested }`, records the answer in the change log, and shows the subscribe-step warning only when the statement is not ticked. eligibility.js drops `figure`, `regALimitCents`, `committedCents` and the over-limit flag; `regAStatus` returns rows with `attested`, `notAttested`, and a not-attested flag through `RA_NOT_ATTESTED`. console.js `regAPanel` shows not attested and attested, with no amounts.
- **Server-mode path:** the server stores qual as sent, so no server code changed. The server test fixture (`invitations-status.test.mjs`) now uses the new shape, and server-mode `regA` proves `{ attested: false }` goes device -> server -> console unchanged and is flagged. The old tampering step (overLimit altered on the server) was removed: there is no device-computed figure left to distrust.
- **Checks:** status-math `regalimit` was replaced by `rega-attest-api`, and `regastatus` and `raflags` were rewritten. In status-flow, `regA`, `entity`, `accredited2`, `untiered`, `aggregate`, `flag` and `portal-other` (rega) were rewritten; `tier1` and `listed` now also assert that no statement is shown; `nofigures` was removed. Server-mode `regA` was rewritten.
- **Commit:** e3d704f

**2. D-08: the ERISA part is dropped**
- `erisa()` and the benefit plan panel were not touched. No `erisa-two-classes` case was written.

### Plan-check fixes applied
1. Task 2's verify has no form-maps run or grep, and accepts `SERVER MODE: PASS (parts run: 6|8)`. This tree has 6; 06-09 and 06-10 add theirs elsewhere.
2. The RED files are named red-math.txt and red-flow.txt, and both were checked for `^FAIL`. Task 1's verify command (`--case rega-positions`, `--only rega-holding`) was not run as written, because D-07 removed those checks. Its RED/GREEN intent was met by the attestation checks above.

### Auto-fixed issues
None.

## Known Stubs
None.

## Threat Flags
None. No new endpoint or trust boundary. T-06-25 (understated total) no longer applies: the portal computes no total, and the issuer relies on the investor's statement as Rule 251(d)(2)(i)(C) permits. A false statement is the investor's, and the sponsor sees who did not make it.

## For the owner to check (screenshots, SCRATCH/exec-06-11/shots/)

- `status-flow__regA__regA-status.png`: the status step with the one statement, unticked, and no figure fields.
- `status-flow__regA__regA-subscribe.png`: the warning when not attested, which does not block.
- `status-flow__regA__regA-console.png`: the panel, "1 not attested to the 10 percent limit", Dana Whitfield named.
- `status-flow__entity__entity-status.png`: the organization wording.
- `status-flow__flag__flag-requests.png`: two rows flagged (unticked, earlier answer), the attested $5,000,000 row not flagged, Approve and Decline on every row.
- `status-flow__rega-unanswered__rega-unanswered-console.png`: the unanswered line.
- `server-mode__regA__regA-*.png`: the same in server mode, on the investor's own device and the console.

The wording of the statement and the panel lines is new, for counsel review.

## Self-Check: PASSED
- FOUND: assets/js/onboarding.js, assets/js/eligibility.js, assets/js/console.js, the three check files, server/test/invitations-status.test.mjs
- FOUND: e3d704f, 2cdc330 (ancestors of HEAD)
