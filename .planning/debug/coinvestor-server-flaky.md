---
status: investigating
trigger: "CO-INVESTOR SERVER (5) (06-39's check) fails part cosign-forged about 1 run in 5 when several gates share the browser slots, and passes when rerun unchanged. Seen in 08-17's gate and 11-13's gate run 3 (one cosign-forged assertion failed after a fixed 2500 ms wait)."
created: 2026-11-27T00:00:00Z
updated: 2026-11-27T00:00:00Z
start_commit: 63d6bdf
---

## Current Focus

hypothesis: (H1) cosign-forged's replay() clicks the console's "Check now" and reads the console's state after a fixed 2500 ms (checks/co-investor-server.js:747); under load the check-now's import of the replayed submission has not finished by then, so said1 is empty; the still-running first check then finishes after the void and writes the "no longer out for signature" line, so said2 has 1 line instead of 2.
test: read the product's Check now path (busy guard, what it does per submission) to rule out a product race; then reproduce under heavy.sh load / CDP CPU throttling and count.
expecting: failures only in the two replay assertions, with said1 = [] (late), never with forged values accepted.
next_action: read the console's inv8-check handler and the co-investor import path (esign.js / portal) to see if a click during a running check is dropped or queued.

## Symptoms

expected: CO-INVESTOR SERVER: PASS (parts run: 5) on every run, loaded or not.
actual: about 1 run in 5 under shared browser slots, part cosign-forged fails; rerun unchanged passes.
errors: (scratchpad exec-15-02/coserver-run1.txt, a third occurrence)
  FAIL cosign-forged the same submission arriving again changes nothing: the co-investor already signed, and an audit line says so :: {"said":[],"same":true}
  FAIL cosign-forged after the firm voided the agreement, the submission changes nothing and the audit line says it is no longer out for signature :: {"said":["Co-investor signature not used: <investor>: the agreement signed on <co-investor>'s device came back, but the agreement is no longer out for signature (voided); nothing was changed"],"status":"voided"}
reproduction: run the check (--only cosign-forged) while other browser checks hold the heavy.sh slots, or with CPU throttling.
started: since 06-39; seen in 08-17's gate, 11-13's gate run 3, exec-15-02 run 1.

## Eliminated

## Evidence

- timestamp: 2026-11-27T00:05Z
  checked: worktree HEAD
  found: HEAD = 63d6bdf (docs(11): after 11-13; state), equal to the required commit; no reset needed. Start commit 63d6bdf.
  implication: fresh tree.

- timestamp: 2026-11-27T00:08Z
  checked: .planning/phases/06-*/checks/co-investor-server.js, part cosign-forged (lines 707-769)
  found: replay() (line 742-749) puts the stored submission back on the server, clicks [data-action=inv8-check], then `await F.cp.waitForTimeout(2500)` and reads consoleState. No wait on the condition the assertions need (the "Co-investor signature not used:" audit line). Other fixed waits in the check: saveCo 800 ms (line 171), removeCo 800 ms (181), cosign-change-remove 1500 ms after removeCo (696), countersign 300/500/900 ms (473-483), coSigns 500/300/200/800 ms (366, 388, 401, 410), investorSigns 200/300 ms.
  implication: the 2500 ms wait is the only fixed wait directly ahead of an assertion that needs an async import to have finished.

- timestamp: 2026-11-27T00:10Z
  checked: past outputs in the scratchpad: every coserver*.txt grep for FAIL
  found: one saved failing output, exec-15-02/coserver-run1.txt: said1 = [] (no line yet after 2500 ms) and said2 holds only ONE line, the "no longer out for signature (voided)" one. The forged values were not taken (same: true, status voided).
  implication: consistent with H1: the first replay's import finished after the 2500 ms read and after the void, so it wrote the voided line; the second replay produced no line of its own. Need the product code to tell whether the second click was dropped (busy guard) or found no submission (deleted by the first check).

- timestamp: 2026-11-27T00:30Z
  checked: assets/js/invitations.js importCompleted (1541-1592), inv8-check action (2617-2622), coRow (855-881), coMerge (829-853), tick (2814-2832)
  found: importCompleted is single-flight: `if (check.busy) return check.busy;` a "Check now" click while a check runs joins that check (it does not start another after it). Per co-investor row with a submission, coRow does GET submission -> coMerge (importSignature, audit) -> DELETE submission -> save. The co-investor's signer turns "signed" inside coMerge, BEFORE that check's DELETE. A background poll (tick) also calls importCompleted every 60 s (POLL_MS) on console routes.
  implication: the check's consoleChecks() resolves on "co signed", i.e. while that Check now is still running and its DELETE is still to come. replay() then writes the submission straight into the server store; the earlier check's late DELETE can wipe it, or replay's click can join the still-running check whose list was read before the write. Either way the replay is not processed: said1 = []. New hypothesis H2 (check-side ordering race), alongside H1 (2500 ms too short).

- timestamp: 2026-11-27T00:33Z
  checked: server/lib/invitations.mjs POST /v1/invite/complete (1130-1136) and DELETE submission (1399-1404)
  found: a completion for an invitation already completed answers 200 {already: true} and stores nothing; DELETE submission clears whatever submission is stored, unconditionally.
  implication: in the product a second submission cannot land between the console's GET and DELETE for a completed co-investor sign-in; "the same submission arriving again" exists only as the check's direct store.put. So the DELETE-wipes-replay ordering is not reachable in the product: no product race on this path.

- timestamp: 2026-11-27T00:37Z
  checked: one traced run, unthrottled, through heavy.sh (scratchpad coflaky/run0-plain.txt; wrapper coflaky/trace.js logs the console's /v1 calls, the check's store.put of a submission, and the 2500 ms waits)
  found: PASS, 13 checks. The forged import (consoleChecks) sent DELETE at +15.50 s; replay #1's store.put was logged at +15.51 s, BEFORE that DELETE's response (+15.51 s). Replay #1's own Check now ran at +16.70 s and found the submission. Unloaded, a whole Check now takes ~30 ms; the 2500 ms wait is ~80x what it needs.
  implication: H2's window is real and observed: replay #1 writes while the previous check's DELETE is in flight. It passed only because the server handled the DELETE before the write. H1 alone would need an ~80x slowdown.

- timestamp: 2026-11-27T00:50Z
  checked: E2 fault injection (DELAY_DELETE_MS=400: the console's DELETE of a submission is held 400 ms before it goes on, as a starved browser network process would hold it), unfixed check, through heavy.sh (scratchpad coflaky/e2-delay400.txt)
  found: FAIL, and the two FAIL lines are character for character the ones of the real failure in exec-15-02/coserver-run1.txt (said [] with same:true; said holding only the "no longer out for signature (voided)" line). Trace: forged import's DELETE sent +16.41 s and held; replay #1's store.put +16.43 s; the held DELETE lands +16.82 s and wipes the replayed submission; replay #1's Check now (+17.76 s) lists the row and makes NO submission GET (nothing left to process); replay #2's put +20.31 s is processed and gives the voided line, alone.
  implication: H2 reproduced deterministically with exactly the observed signature. Root cause is in the check: replay() starts before the previous Check now has finished (consoleChecks resolves on "co signed", before that check's DELETE). The fixed 2500 ms wait is a second weakness of the same kind (reads the result after a guessed time).

- timestamp: 2026-11-27T00:55Z
  checked: assets/js/invitations.js awaiting (940), tick (2814)
  found: the 60 s poll only calls importCompleted while awaiting(ws) is true; after the co-investor's signature is imported (si.importedAt set) and the investor's invitation imported, awaiting is false, so no background check runs during the replays.
  implication: once each replay waits for its own click's check to end, nothing else touches the server row between the put and the read.

- timestamp: 2026-11-27T00:57Z
  checked: side finding, not the flake: invitations.js coMerge (829-853) with esign.js applySignature (1329-1386)
  found: coMerge captures coS = env.signers.find(...) BEFORE importSignature; applySignature works on a deep copy and ends with Object.assign(env, next), replacing env.signers with new objects, so `si.signedAt = coS.signedAt` reads the stale object (undefined). coSweep then sees !si.signedAt and cancels the finished sign-in ("the agreement no longer waits for the co-investor"): the trace shows a POST .../cancel right after every successful co-investor import (run0 +15.53 s, e2 +16.84 s); the server answers 409 (completed) and the console logs "Co-investor sign-in cancelled: ... had already ended on the server".
  implication: a separate product defect (a misleading audit line and cancelledAt on a signed sign-in). It does not cause this flake (no timing dependence; the replays are judged by importSignature's own checks). Reported, not fixed here (outside this task's lines).
