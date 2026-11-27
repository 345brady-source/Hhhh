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

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
