---
status: investigating
trigger: "During plan 13-04's gate (several other gates running on 4 cores), phase 08's check monitoring.js ended `MONITORING: FAIL (parts run: 9) - package-not-run` with exactly two failing lines: `\"Run now\" re-screened them :: Signed in as admin of Kestrel Bay` and `the package result is kept as it was, the Treasury result is added, the next date moved`. In the same part \"one list read, one screening asked of the server, for the Treasury lists\" passed. The part alone passed twice afterwards; a rerun of the gate passed."
created: 2026-11-27T16:00:00Z
updated: 2026-11-27T16:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: H1 - runNow (monitoring.js:457-463) waits for ANY toast; the sign-in toast that consoleRoute (lib.js:480, called by attention() at monitoring.js:648) raised ~0.7 s earlier is still in #toasts (4.2 s life), so the wait returns at once and .last() is read before "1 investor re-screened" is appended; record() at 651 is then read before rescreenWith wrote the result
bug_class: Heisenbug (timing race in the check; 1 failure seen under load, part alone PASS twice)
test: instrumented scratch copy recording the toasts present at the click and at the read, and the ms from click to the result toast; then force the server's POST /v1/screenings answer 1500 ms late and look for the same two FAIL lines
expecting: sign-in toast present at every click (so the wait never waits); natural margin small; with the forced delay exactly the two FAIL lines
next_action: write scratch copy debug-monitoring/inst/monitoring-inst.js (requires made absolute) with a delay hook on POST /v1/screenings in the in-process server, run --only package-not-run

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `MONITORING: PASS (parts run: 9)` on every run
actual: one run under load printed `MONITORING: FAIL (parts run: 9) - package-not-run` with two FAIL lines: (1) `"Run now" re-screened them :: Signed in as admin of Kestrel Bay` (the check read the sign-in toast, not the result toast); (2) `the package result is kept as it was, the Treasury result is added, the next date moved` (the record read before the update arrived). In the same part `one list read, one screening asked of the server, for the Treasury lists` PASSED, so the screening ran.
errors: the two FAIL lines above
reproduction: `node .planning/phases/08-verification-package-and-ongoing-compliance/checks/monitoring.js` through heavy.sh while several other gates run on 4 cores; part alone passed twice afterwards; gate rerun passed
started: seen during plan 13-04's gate (base ef87afa area)

## Eliminated
<!-- APPEND only -->

## Evidence
<!-- APPEND only -->

- timestamp: 2026-11-27T16:00Z
  checked: .planning/debug/server-mode-tax-request-flake.md (the earlier flake of the same class)
  found: there the check read a list filled by an async body read at the first heading; fixed by keeping each read as a promise and awaiting it at the read; RED/GREEN proven by forcing the body 1500 ms late in a scratch copy
  implication: same method here: force the screening answer / the save late in a scratch copy and look for the same two FAIL lines

- timestamp: 2026-11-27T16:10Z
  checked: scratch exec-13-04/notes.txt, gate-run1.txt, gate/p08-monitoring.txt, rerun/monitoring-1.txt, monitoring-2.txt
  found: gate run 1 (75b2fc5 base, HEAD e54c2d8) GATE FAIL MONITORING with the two lines as reported; the failing run's own output file was overwritten by gate run 2 (gate/p08-monitoring.txt now PASS, 148 PASS lines, 16:47); the two lone reruns PASS (parts run: 1)
  implication: only the two FAIL lines survive (notes.txt); the toast text read was "Signed in as admin of Kestrel Bay"

- timestamp: 2026-11-27T16:12Z
  checked: monitoring.js:457-463 runNow, 641-679 part package-not-run, 347-354 attention, lib.js:476-486 consoleRoute, assets/js/app.js:59-68 toast, 770-784 demo-role change, assets/js/integrations.js:1609-1614 iv-rescreen, 724-735 rescreenDue, 516-531 rescreenWith
  found: |
    (1) every consoleRoute call does page.selectOption('#demo-role','admin') (lib.js:480); the select's change handler (app.js:783) raises the toast "Signed in as admin of Kestrel Bay" every time (selectOption always fires change), and a toast stays in #toasts for 4200 ms (app.js:66-67; #toasts is made once at boot, render never clears it).
    (2) part package-not-run calls attention() (monitoring.js:648) right before runNow (650); attention runs consoleRoute('console'), which raises that toast ~0.7 s before attention returns.
    (3) runNow clicks "Run now", then waitForSelector('#toasts .toast') (461), which the sign-in toast already satisfies, then reads .last() (462) at that instant: nothing waits for the "N investor(s) re-screened" toast.
    (4) product: the iv-rescreen action awaits rescreenDue (which writes the record in memory and saves) BEFORE render and the "re-screened" toast (integrations.js:1609-1614). So the result toast always follows the written record; the console does not show the result before writing it.
    (5) record(C.cp, pk.id) (651) is read right after runNow returns, so when runNow returns early, the record is read before rescreenWith wrote it.
  implication: one defect explains both FAIL lines: runNow does not wait for the toast its click raises. The list-read / POST check (653) passes because the POST /v1/screenings request and the server's list read happen before the console has the answer (the server runs in the check's own process). Same shape, unchecked toast: package-not-run's second runNow (667, r2/r3 read at once), monitored-not-due's runNow (601, toast + records read at once), preview's runNow (843).

- timestamp: 2026-11-27T17:01Z
  checked: RED, scratch copy debug-monitoring/inst/monitoring-red.js (built by mkinst.py from the unfixed check: requires made absolute; in-page recorder armed before the click; FORCE_HOLD_MS=1500 sets the world's list hold, so the in-process server answers POST /v1/screenings 1500 ms late), --only package-not-run, GATE_FRESH=1, heavy.sh, load 12.4
  found: |
    TIMING pnr-A atClick=["Signed in as admin of Kestrel Bay","Signed in as admin of Kestrel Bay","Signed in as admin of Kestrel Bay"] resultAfterClick=none readAfterClick=32 recordAfterClick=34 margin=none
    FAIL package-not-run "Run now" re-screened them :: Signed in as admin of Kestrel Bay
    FAIL package-not-run the package result is kept as it was, the Treasury result is added, the next date moved :: {"title":"Davis Family Trust",...,"nextScreen":"2026-11-26","results":[{"connection":"package-id",...,"ref":"scr_seedpackage"}],...}
    PASS package-not-run through the Treasury connection only: one list read, one screening asked of the server, for the Treasury lists
    MONITORING: FAIL (parts run: 1) - package-not-run   (15 PASS, 2 FAIL)
  implication: exactly the gate's signature: the same two FAIL lines, the list-read line PASS. Three sign-in toasts are on screen at the click (errorLines' two consoleRoutes and attention's one), so runNow's wait returned at once and the toast and the record were read 32-34 ms after the click, before the answer.

- timestamp: 2026-11-27T17:05Z
  checked: server/index.mjs:824-862 (POST /webhooks/:provider), server/lib/changed.mjs:44-66, integrations.js:1116-1141 (ongoing), 1150-1166 (autoRescreen), 1203-1248 (pullChanged), console.js:2571-2584 (kyc-screen, kyc-screen-due), 2610-2618 (kyc-iv-approve)
  found: the server applies a webhook before it answers 200; pullChanged applies every listed check, writes hits, the "Monitoring alert" entry and the decision in one synchronous step after its last await, then sets server.pulledAt = the answer's `now` (server time - 1 ms); autoRescreen follows in the same task when it has nothing to run; kyc-screen and kyc-screen-due raise their toast only after awaiting the re-screen and render; kyc-iv-approve is synchronous (record written before the click returns)
  implication: product order is sound everywhere the check reads (result written before the toast; alert applied before 200). The defects are only in the check's waits.

- timestamp: 2026-11-27T17:06Z
  checked: GREEN, debug-monitoring/inst/monitoring-green.js (the fixed check, same instrumentation, FORCE_HOLD_MS=1500), --only package-not-run
  found: |
    TIMING pnr-A atClick=["Signed in as admin of Kestrel Bay","Signed in as admin of Kestrel Bay","Signed in as admin of Kestrel Bay"] resultAfterClick=1618 readAfterClick=1640 recordAfterClick=1643 margin=22
    MONITORING: PASS (parts run: 1)   (17 PASS, 0 FAIL)
  implication: with the same three sign-in toasts on screen and the answer 1.6 s late, the fixed runNow waits for the result toast and reads the record after it; same assertions

- timestamp: 2026-11-27T17:05Z
  checked: unmodified monitoring.js --only package-not-run, three loops at once through heavy.sh (loop.sh nat 1-8, 9-16, 17-24; GATE_FRESH=1, own P6_OUT each), other agents holding heavy.sh slots, load 2.5-7.7
  found: 20 of 20 PASS so far (summary-nat.txt), 18-38 s each (170-195 s incl. queue)
  implication: natural rate at part granularity is low, as with the earlier SERVER MODE flake; the instrumented natural runs will give the margin

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
