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
next_action: finish the 24 unmodified runs, then copy the verified fix (debug-monitoring/monitoring-fixed.js, made by mkfix.py) into the tree, commit, and run MONITORING full x10 (two loops through heavy.sh) and the server tests

reasoning_checkpoint:
  hypothesis: "package-not-run FAILed because runNow (monitoring.js:457-463) takes any toast on screen as the answer of 'Run now': the 'Signed in as admin of Kestrel Bay' toast Lib.consoleRoute raises (lib.js:480 -> app.js:783, 4.2 s on screen) inside attention() (648) is still there at the click, so waitForSelector returns at once and .last() and the record (651) are read before the in-process server has answered POST /v1/screenings."
  confirming_evidence:
    - "RED: the unfixed check with the server's answer held 1500 ms prints exactly the gate's two FAIL lines (toast text 'Signed in as admin of Kestrel Bay'; the record with only the package result and the old date) while 'one list read, one screening asked of the server' PASSes."
    - "In every instrumented run three sign-in toasts are on screen at the click (atClick), so the wait never waits; the read is 32 ms after the click."
    - "Product order checked by reading: the iv-rescreen action raises its toast only after awaiting rescreenDue, which writes the record (integrations.js:1609-1614, 724-735)."
  falsification_test: "A FAIL of '\"Run now\" re-screened them' with a toast other than a sign-in toast, or with the result toast recorded before the read, or a GREEN failure under the same forced hold, would refute it."
  fix_rationale: "Read the first toast added AFTER the click, recorded in the page as it is added (MutationObserver armed before the click): a toast already on screen can no longer stand in for it, and since the console raises it only after writing the record, the record read after it is the written one. Same assertions (same regex, same record fields)."
  blind_spots: "The failing run's own output was overwritten by the gate rerun, so only its two FAIL lines are known (they match RED exactly). Natural reproduction depends on the in-process server being held up > the natural margin (being measured)."
  candidate_causes:
    - "code (check): runNow takes a toast already on screen (monitoring.js:461-462) - confirmed by RED"
    - "code (product): the console shows the result before writing it - eliminated by reading (toast after await rescreenDue)"
    - "environment: CPU starvation of the check's process, which also hosts the server (the trigger, not a separate cause)"
    - "data: the seeded investor not due / not package-screened - eliminated: the line before (649) PASSed and the list read happened"
  and_gate: "yes: the defect (any-toast wait, made blind by consoleRoute's toast) AND a server answer slower than the few CDP round trips between click and read; the second is why it shows only under load"

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

- timestamp: 2026-11-27T17:07Z
  checked: the same 24 unmodified runs, complete (summary-nat.txt)
  found: 24 of 24 `MONITORING: PASS (parts run: 1)`, 0 FAIL lines, 18-38 s each (78-195 s incl. queue), load 2.3-7.7; heavy.sh's other slots were mostly held by other agents, so the three loops often ran one or two at a time
  implication: measured natural rate of the unmodified part: 0 in 24 at this load

- timestamp: 2026-11-27T17:08Z
  checked: fix applied to the tree (7f5450e, monitoring.js only): toastAfter (MutationObserver armed before the press; first toast added after it, read in the page), runNow and kycPress through it; pulled() waits until the console has applied its GET /v1/checks/changed answer (server.pulledAt >= the answer's now) before its existing 800 ms; part once waits for the run's POST /v1/screenings answer before reading `tried`. `cd server && node --test` on that tree (node_modules linked)
  found: `# tests 601` `# pass 601` `# fail 0` rc=0 (debug-monitoring/server-tests.txt)
  implication: server suite unchanged (the fix touches only the check)

- timestamp: 2026-11-27T17:08Z
  checked: instrumented natural runs of the unfixed check (inst/monitoring-red.js, no forced delay, full 9 parts, three loops; inst-N.txt), first lines
  found: |
    TIMING mnd   atClick=[2 sign-in toasts] resultAfterClick=80 readAfterClick=112 margin=32
    TIMING mnd   atClick=[2 sign-in toasts] resultAfterClick=47 readAfterClick=70  margin=23
    TIMING pnr-A atClick=[3 sign-in toasts] resultAfterClick=99 readAfterClick=133 margin=34
    TIMING pnr-B atClick=[3 sign-in toasts] resultAfterClick=29 readAfterClick=66  margin=37
  implication: every "Run now" press so far has sign-in toasts on screen, so the old wait never waits; the result toast beats the read by only 23-37 ms (the earlier SERVER MODE race had 78-173 ms). A hold-up of the check's process (which also runs the server) of a few tens of ms at that moment gives the gate's failure. monitored-not-due and package-not-run's second press have the same exposure.

- timestamp: 2026-11-27T17:13Z
  checked: instrumented natural runs inst-1, inst-3 (full, PASS 9) and the parts done of inst-2/4/5/6: 16 "Run now" presses timed
  found: |
    every press had sign-in toasts on screen at the click: mnd 2, pnr-A 3, pnr-B 3-4, preview-desktop 1, preview-phone 1
    margin (result toast -> end of the old read), ms: mnd 32 23 27 38 | pnr-A 20 34 28 28 | pnr-B 22 37 28 20 | preview-desktop 36 68 | preview-phone 28 16
    result toast after the click 29-99 ms (sandbox presses included: not synchronous)
  implication: all four callers of runNow (monitored-not-due 601, package-not-run 650 and 667, preview 843 desktop and phone) read a toast and records whose arrival nothing waited for, with 16-68 ms to spare; all are fixed by the same runNow change

- timestamp: 2026-11-27T17:13Z
  checked: the other reads of all 9 parts, by reading, for a positive read with nothing ordering it after what it reads
  found: |
    alert: ordered (server applies the alert before 200; waitDecision before record; hits, log entry, decision written in one step by pullChanged)
    hold-only: 551/557 ordered by waitDecision / pulled; 566 kyc-iv-approve is synchronous (record written before the click returns); 556 reads the answer's own body. Reads after pulled() are negative (the console must NOT clear) bounded only by pulled()'s fixed 800 ms -> strengthened by the pulled() change
    monitored-not-due: 601-604 runNow (fixed); 592-595 settleMonitored runs in the render reopen waits for; 615-631 awaited in the page
    package-not-run: 650-655 and 667-670 runNow (fixed); 644 'the console's own pass at load has run' relied on pulled()'s 800 ms: if the console applies its pull later, its own pass (autoRescreen, which looks for the free connection right after pullChanged in the same task) would find the Treasury connection the part seeds next and re-screen the investor itself -> fixed by the pulled() change
    kyc-buttons: 691/699/710 kycPress read the last toast in two steps after a wait for any toast (it cleared old toasts first) -> moved to toastAfter; 685 same as package-not-run 644 -> pulled() change
    auto-free: 736-753 ordered by the waitForFunction on the moved date (results, log entry written in the same step); 759-762 negative after pulled() -> pulled() change
    once: 787-792 ordered by the moved-date wait; 801-803 `tried = C.posts.length` (a positive count of the run's screening request) read after pulled() + 1500 ms with nothing waiting for the request -> now waits for that request's answer; 804-807 negative
    preview-desktop / preview-phone: 843-845 runNow (fixed); 836-839 negative, no server
  implication: beyond runNow, two more reads of the same kind: pulled()'s callers that seed right after it (package-not-run 644, kyc-buttons 685) and once's `tried` (803). Forced RED/GREEN for both are running (FORCE_PULL_HOLD=3000: the page applies the pull 3 s after it arrived; FORCE_POST_DELAY=5000: the console's run sends its screening 5 s late)

- timestamp: 2026-11-27T17:25Z
  checked: forced runs (force.sh; copies by mkforce.py: an init script wraps the console page's own fetch): red-post = unfixed check (ef87afa) FORCE_POST_DELAY=5000 --only once; green-post = fixed tree, same; green-hold = final fixed tree (instrumented by mkinst.py) FORCE_HOLD_MS=1500 --only package-not-run
  found: |
    red-post   | MONITORING: FAIL (parts run: 1) - once | 9 PASS 1 FAIL: FAIL once a run that got no answer was tried once for that due date and writes nothing :: {"tried":1,"posts":1,"next":"2026-11-25"}
    green-post | MONITORING: PASS (parts run: 1) | 10 PASS 0 FAIL
    green-hold | MONITORING: PASS (parts run: 1) | 17 PASS 0 FAIL; TIMING pnr-A atClick=[3 sign-in toasts] resultAfterClick=1556 readAfterClick=1566 margin=10
  implication: once's `tried` read was racing the run's screening request (RED with it 5 s late); the fixed part waits for it and checks the same count. The final fixed runNow waits for the result toast under the 1.5 s hold.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
