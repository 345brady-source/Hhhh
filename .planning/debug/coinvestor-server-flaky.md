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
