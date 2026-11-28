---
phase: 08-verification-package-and-ongoing-compliance
plan: 17
subsystem: sponsor console (invitations, the verification package box)
tags: [verification-package, billing, invitations, R7, credit-owed, owner-preview, D-01]
status: complete
requires:
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "08-05 package at create (package_used, tier_mismatch); 08-06 the box, gate.sh, frame.js; 08-13 the list form's box; 08-15 the returned-package resend refusal; 08-16 owedCents and credit_owed"
provides:
  - "invitations.js api: err.code from the server's reply"
  - "invitations.js replaceUsed(ws, it, said): on 409 package_used the invitation is closed locally with the server's sentence and a new one (new id, so a new client id; same investor, offering, amount, class, note, tax form choice and package choice) waits unsent; audit 'Invitation replaced'"
  - "invitations.js: a resend the server refuses keeps its sentence on the row (span .inv8-refused, field it.resendError, cleared by a resend that goes through); the resend toast is the sentence alone"
  - "package.js box: switched off with the server's credit_owed sentence while GET /v1/billing owedCents > 0 (single form, list form, and 08-20's dialog through the same box)"
  - "checks/package-console.js: GATE CHECK PACKAGE CONSOLE, 7 parts"
affects: [08-07, 08-09, 08-12, 08-20]
tech-stack:
  added: []
  patterns:
    - "Every refusal sentence a part asserts is captured from the real server's reply in the same run (stubServer amend, or a direct POST with the account token), never typed into the check"
    - "A send that reaches the server while the console hears a refused connection: the check forwards the request to the real server itself, then answers { refuse: true }"
key-files:
  created:
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/package-console.js
  modified:
    - assets/js/invitations.js
    - assets/js/package.js
key-decisions:
  - "A resend refusal is kept in a field the server sync does not touch (it.resendError): the 60-second poll rewrites emailError from the server's row and would erase the sentence"
  - "If no replacement can be made (the offering stopped raising and the investor cannot be re-invited), the used invitation is still closed with the server's sentence and its row offers 'Invite again'"
  - "The resend toast lost its 'Could not resend: ' prefix for every resend error, as 08-CONTEXT's wave-5 Info item reads it"
duration: about 3 h 25 min (15:15 to 18:40 UTC), of which about 2 h 40 min was the phase gate (two runs, see Deviations)
completed: 2026-11-20
plan_head_before: 38ffa1203e1438a640a975df6de4f44f02cd997f
actuals:
  tokens: 13200
  tasks: 3
  commits: 12
plan_head_after: the docs commit that adds this final text (the 12th commit after plan_head_before; d112c8c is the one before it)
---

# Phase 08 Plan 17: the console shows the server's package refusals word for word Summary

**A used package now gives the server's own sentence and a new, unsent invitation for the same investor with a new id, and nothing is charged until the sponsor sends it. tier_mismatch, credit_owed and the returned-package resend refusal read exactly as the server sends them. While the account owes an amount, the package box on the invite form and on the list form is switched off with the server's sentence. The owner's preview is unchanged. Not done until the owner has checked it on his iPhone.**

## Failures and open items first

1. **The plan's final verify (verify-3.sh) exited 1.** Every gate and suite condition holds, but three of its exact-line greps and its names check do not match as written:
   - The first gate run was stopped by the 2-hour background limit after "base is an ancestor of HEAD and HEAD moved", before the phase-4/phase-5 comparisons. The gate resumed in the same folder on the same tree, as gate.sh is built to do, and ended `GATE_EXIT=0`. A resumed gate prints kept steps as `GATE ok   PACKAGE CONSOLE (7) (kept from 2026-11-20 17:32:23 UTC)`, so verify-3's `grep -qx 'GATE ok   PACKAGE CONSOLE (7)'` (and the same for PACKAGE INVITE (12), PACKAGE PANEL (7) and `server tests 368 (found 368)`) does not match the resumed gate.txt. The first run's gate-run1.txt holds all four exact lines (each counted once).
   - The names check lists four paths, not three, because this SUMMARY was committed while the work went on. The owner's save rules require that ("paste RED outputs ... into your SUMMARY as they are produced" and save after every edit round). Without the SUMMARY, the list is exactly the plan's three: `checks/package-console.js assets/js/invitations.js assets/js/package.js`.
2. **CO-INVESTOR SERVER (phase 06-39's check) failed once** in the first gate run: `CO-INVESTOR SERVER: FAIL (parts run: 5) - cosign-forged`. The resumed run reran it and it passed (`GATE ok   CO-INVESTOR SERVER (5)`, on the same tree). It also passed 3 times out of 3 in standalone runs afterwards (`--only cosign-forged`). Measured: 1 failure in 5 runs, on a machine where all three browser slots were busy with other builds. The failing assertion's line was overwritten when the step reran, so it is unknown. The check and its files share nothing with this plan (no resend, no package, no file this plan touched). Logged for the orchestrator as possibly flaky under load.
3. **Found on the owner screens, not fixed:** the closed (never sent) invitation's row reads "Sent Nov 20, 6:26 PM" under Activity. The row's Activity label says "Created" only while the status is `sent`. This was already how any cancelled, never-sent invitation showed; replaceUsed now makes such rows. A one-line fix in the row (`unsent(it) || (!it.serverId && it.emailStatus === 'failed')`) would cost a full gate rerun (about 2.5 hours), so it is left to the orchestrator to decide.
4. Owner check pending (human-check below). The owed and refused states need a connected portal; in the preview only "Checks run once your portal is connected to its server." shows.

## What was built

| Task | What | Commit |
|------|------|--------|
| 1 (tracer) | `api` keeps `.code`; `send`'s package_used branch calls `replaceUsed`; part package-used | b1c0ea8 |
| 2 | package.js `box` switched off with the credit_owed sentence while `owedCents` > 0; the resend refusal kept on the row and the toast without a prefix; parts tier-mismatch, credit-owed, returned | c6aa95a |
| 3 | parts phone, preview-desktop, preview-phone (no product code was needed); the gate | check parts in save commit 315d7cc |

All parts run against the real integration server in the check's own process, on a sponsor account paying from its balance. GET /v1/billing is the real server's answer, not a stand-in. No payment provider is reached, and every part asserts that the server called nothing outside the machine.

## Evidence (pasted as produced)

### Step 0 (G2)
Base commit 38ffa1203e1438a640a975df6de4f44f02cd997f. Server suite `# tests 368`, `# fail 0`. Phase-8 gate checks found: 3 (AML RECORD, PACKAGE INVITE, PACKAGE PANEL). Both numbers match the wave-5 plan-check Info item. The plan's text says 358 because phases 06, 09, 10 and 11 were merged after it was written.

### Task 1 RED (red.txt, unchanged invitations.js; 20 PASS / 10 FAIL)
```
FAIL package-used the old invitation is closed in the console :: {... "status":"sent", "emailStatus":"failed","emailError":"This package belongs to another invitation.","pkg":true ...}
FAIL package-used one new invitation for the same investor, offering, amount and class, with a new id
FAIL package-used the new invitation holds the package choice before it is sent :: {}
FAIL package-used the new invitation reads "Not sent yet" on the list ::
FAIL package-used on "All", the old invitation's row shows the server's sentence word for word :: ... Not sent yet ... Could not send: This package belongs to another invitation. Resend Cancel
FAIL package-used one audit entry "Invitation replaced" with the server's sentence :: 0
FAIL package-used sending the new one posts its own id as the client id, with the package :: null
FAIL package-used the server holds it with a new package of its own :: {"held":null}
FAIL package-used the balance dropped by exactly the tier's price ($99), one new entitlement, no payment to a card
FAIL package-used its row no longer reads "Not sent yet" ::
PACKAGE CONSOLE: FAIL (parts run: 1) - package-used
```
The set-up lines already passed on the base: "the real server stored it and paid its package from the balance", "sent again, the real server answered 409 package_used with a sentence of its own", "the refused send charged nothing".

### Task 1 verify (verify-1.sh, exit 0; tracer.txt 30 PASS, 0 FAIL)
```
PASS package-used every screen of this part: no vendor, library or forbidden word (leak check)
PASS package-used every screen of this part: no provider name or address (vendor scan)
PACKAGE CONSOLE: PASS (parts run: 1)
VERIFY1_EXIT=0
```

### Task 2 RED (red2.txt, against Task 1's commit b1c0ea8; 44 PASS / 7 FAIL)
```
FAIL credit-owed the single form: the box shown, switched off, unticked, with the server's price in its label :: {"present":true,"shown":true,"disabled":false,...}
FAIL credit-owed the single form: its one line is the server's sentence word for word :: {"line":"","OWED":"A refunded payment left an amount owed. Settle it before adding packages."}
FAIL credit-owed the single form: it cannot be ticked :: {... "disabled":false,"checked":true ...}
FAIL credit-owed "Send invitation" still sends: without the package (no flag, no client id), the real server holds it with none :: {"one":{"ticked":true, ... "emailStatus":"failed","emailError":"A refunded payment left a...
FAIL credit-owed the list form: the box shown, switched off, unticked, with the same sentence word for word :: {"shown":true,"disabled":false,...,"label":"Add verification package to 2 invitations ($38)","line":""}
FAIL returned the toast is the server's sentence alone, word for word :: {"shown":[..., "Could not resend: This invitation's package was returned. Send a new invitation."], ...}
FAIL returned the invitation's row shows the server's sentence alone, word for word :: {"line":[],"row":"... Sent Not opened yet ... In the server outbox Copy link Resend Cancel"}
PACKAGE CONSOLE: FAIL (parts run: 3) - credit-owed, returned
```
The first red2 run (red2-first.txt) failed credit-owed's probe because of a bug in the check: the direct POST had no firm.name, and the server answered 400. The check was fixed and red2.txt was run again. The lines above come from that second run.

tier-mismatch already passed on Task 1's code, because the row already shows `it.emailError`, so it stays as a guard. Mutation run (red2-mutation.txt: `it.emailError` removed from the row's Email column, then reverted):
```
FAIL tier-mismatch the invitation's row shows the server's sentence word for word and still reads "Not sent yet" :: Ottilie Varga ... Not sent yet The email could not be sent ... Could not send Resend Cancel
PACKAGE CONSOLE: FAIL (parts run: 1) - tier-mismatch
```

### Task 2 verify (verify-2.sh, exit 0; flow2.txt 81 PASS, 0 FAIL, no part kept)
```
PASS returned every screen of this part: no vendor, library or forbidden word (leak check)
PASS returned every screen of this part: no provider name or address (vendor scan)
PACKAGE CONSOLE: PASS (parts run: 4)
VERIFY2_EXIT=0
```

### Task 3 RED (red3.txt)
The three new parts already passed on Task 2's code (red3-run.txt: `PACKAGE CONSOLE: PASS (parts run: 3)`, 81 PASS), so phone, preview-desktop and preview-phone needed no code. As the plan allows, red3.txt also holds a mutation run with the owed state removed from package.js `box` (reverted after; `git status` clean):
```
FAIL phone an amount owed: the box switched off, unticked, its line the server's sentence word for word :: {"present":true,"shown":true,"disabled":false,"checked":false,"label":"Add verification package ($99)","line":"",...}
FAIL phone a tap does not tick it :: {... "disabled":false,"checked":true ...}
(7 more FAIL lines follow from the box having been ticked)
PACKAGE CONSOLE: FAIL (parts run: 1) - phone
```

### Server suite alone before the gate (`npm --prefix server test`)
```
1..368
# tests 368
# pass 368
# fail 0
```

### Phase gate (P8_SERVER_TESTS=368, P8_OUT = the scratch folder; resumed once, same tree)
verify-3's own suite run (server3.txt): `# tests 368`, `# fail 0`. Last lines of the resumed gate.txt:
```
GATE ok   PACKAGE PANEL (7) (kept from 2026-11-20 17:38:29 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
COUNTS server tests 368; AML RECORD 7; PACKAGE CONSOLE 7; PACKAGE INVITE 12; PACKAGE PANEL 7
GATE_EXIT=0
```
Gate lines in the resumed run: 39 `GATE ok`, 0 `GATE FAIL`. The first run printed `GATE ok   phase-8 gate checks found (4)`, `GATE ok   PACKAGE CONSOLE (7)`, `GATE ok   PACKAGE INVITE (12)` and `GATE ok   PACKAGE PANEL (7)`, plus the one `GATE FAIL CO-INVESTOR SERVER (5)` described under Failures. PACKAGE CONSOLE ran fresh in the gate: 162 PASS lines and no KEPT line.

## Deviations from Plan

1. **[Rule 2 - correctness] The row line for a resend refusal is a new local field, not `emailError`.** The plan describes "one added branch". A sent invitation's row never showed `emailError`, and the 60-second poll (`applyRow`) rewrites `emailError` from the server's row, which would erase the sentence. So: one line in `resend`'s catch (`it.resendError`), one `delete it.resendError` after a resend goes through, and one span in the row's Email cell, shown only while the invitation is open or expired. The toast change is the one the Info item names.
2. **[Rule 2] replaceUsed when no replacement can be made.** It follows `reinvite()`'s rules: the amount and class are dropped if they no longer validate, and the offering is dropped if it is not raising. If the investor still cannot be invited, the old invitation is closed with the server's sentence, no new one is made, and the row's existing "Invite again" is offered. The "Invitation replaced" audit entry is written only when a replacement exists.
3. **Gate run twice.** See Failures 1: the 2-hour background limit stopped the first run, and it resumed on the same tree.
4. **SUMMARY committed during the work** (owner's save rules). This adds a fourth path to verify-3's names check. Pushing the evidence to a separate branch was attempted and refused (pushes go to wip/08-17 only).
5. **Task 3 needed no product code.** Its check parts were committed in save commit 315d7cc. There is no separate feat commit, because nothing in the product changed for Task 3.
6. **The check's own probe bug** (firm.name missing) was fixed between red2-first.txt and red2.txt. Both files are kept.

None of this touched a server file, integrations.js, console.js, server/help, gate.sh or any 08-07 file.

## Threat model

- T-08-51 (mitigate): part package-used asserts that the refused send left the balance, the entitlements and the payments unchanged, that nothing was posted by itself (exactly 2 POSTs), and that the new invitation paid exactly one tier price ($99) from the balance. Part phone asserts the same with taps.
- T-08-52 (mitigate): part credit-owed (box off with the server's sentence; "Send invitation" sends without the package; the server still refuses with credit_owed). Part phone covers 390x844.
- No new security surface: no endpoint, no auth path, no storage change. `it.resendError` holds only the server's own refusal sentence.

## New files a preview build must add

None. Only `assets/js/invitations.js` and `assets/js/package.js` changed, and both are already shipped. `checks/package-console.js` is test-only.

## Owner check (not done until he has checked it)

On the iPhone, in the published preview: Console, Investors, Invite an investor; then Import a list, paste two lines, Check list. Expected: both boxes greyed with "Checks run once your portal is connected to its server.", no error text, and invitations still send from the email app. The owed and refused states need a connected portal; parts credit-owed, returned, package-used and phone prove them against the real server, and the owner screenshots are in the scratchpad's exec-08-17/owner-shots (with index.txt).

## Self-Check
PASSED. Files present: assets/js/invitations.js, assets/js/package.js, checks/package-console.js. Commits b1c0ea8, c6aa95a and 315d7cc are on this branch. Owner screen run (owner-run.txt): `PACKAGE CONSOLE: PASS (parts run: 5)`, 0 FAIL, 10 screens plus index.txt in the scratchpad's exec-08-17/owner-shots.
