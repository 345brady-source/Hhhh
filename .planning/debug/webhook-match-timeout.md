---
status: awaiting_human_verify
trigger: "correctly signed provider webhooks are refused (401) when the machine is busy" (orchestrator, from 08-14's finding: connector.mjs match() runs sponsor-written signature patterns in a vm sandbox with MATCH_MS = 50; under load 26 of 72 stress runs failed)
created: 2026-11-19T19:15:00Z
updated: 2026-11-19T20:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED - vm runInContext's `timeout` is a wall-clock watchdog; on a busy machine the thread loses more than 50 ms inside the window, the watchdog stops a match that needs well under 1 ms of CPU, match() swallows the timeout and returns [], verify() sees no candidates (or no timestamp) and returns false, the route answers 401.
test: done - fix applied, guardrail signals recorded under Resolution.verification
expecting: n/a
next_action: fix is commit 5ec89ad on wip/fix-webhook-match (base 9922642); orchestrator merges it into claude/refract-reskin and runs the full gate (server tests now 286; .planning/checks/gate-reference.sh still says 197 - stale copy); owner check; on "confirmed fixed" move this file to resolved/ and add the knowledge-base entry
bug_class: Heisenbug (load-dependent; mechanism is deterministic once the thread loses >50 ms inside the window)
reasoning_checkpoint:
  hypothesis: "match() gives a single 50 ms wall-clock window (vm timeout) and turns a timeout into 'no match'; on a busy machine the thread is descheduled past 50 ms inside that window, so a genuine signature header yields no candidates and verify() returns false (401)."
  confirming_evidence:
    - "Stress on base: 22 of 72 runs failed, all in scheme 2/3 (the only connectors-test schemes that use pattern/timestampPattern); every failing assertion is a genuine delivery refused."
    - "Instrumented: 20 timeouts, all ERR_SCRIPT_EXECUTION_TIMEOUT, 53-342 ms of wall time with 0.3-17.8 ms of process CPU (14 of 20 under 1 ms) - the pattern did no work, the thread waited."
    - "Deterministic: a pattern whose first use holds the thread past the limit (as a stall does) makes verify() refuse a correct signature on base, 10 of 10 runs."
  falsification_test: "If after the retry the stress still shows a genuine delivery refused, the refusal comes from somewhere other than a single missed window (e.g. a stall longer than the retry limit, or another check such as freshness)."
  fix_rationale: "The refusal is caused by treating one missed wall-clock window as 'no signature'. Giving a genuine match a second, longer window only after a timeout addresses that directly; the cut-off for a slow pattern stays (50 + 500 ms per pattern instead of 50 ms), proven by a test with a validator-accepted pattern that would otherwise run for days."
  blind_spots: "Load on this machine varies (other agents); a stall longer than 500 ms during the retry would still refuse a delivery (not observed: max stall 342 ms in 1210 windows). The deployed server's machine may be idle, where the retry never triggers for ordinary patterns."
  candidate_causes:
    - "code: single wall-clock window in match(); timeout swallowed as no match (CONFIRMED)"
    - "environment: CPU oversubscription (24 processes on 4 cores plus other agents) deschedules the main thread and the watchdog thread; window includes creating/joining the watchdog OS thread (CONFIRMED as the trigger)"
    - "data: header or pattern content making the match slow (ELIMINATED: ordinary patterns, ~100-char headers, under 1 ms CPU in the timed-out windows)"
  and_gate: "yes - needs the 50 ms single-window design (code) AND a stall over 50 ms inside the window (environment); neither alone refuses a delivery. Fixing the code side is the only side under our control."

## Session Loop

goal: find_and_fix (isolated worktree, RED-first, push wip/fix-webhook-match only)
symptoms_prefilled: true
knowledge_base: none exists (.planning/debug/knowledge-base.md absent) - no known-pattern candidate

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A correctly signed provider delivery to POST /webhooks/:provider is accepted (200) whatever the machine's load; a catastrophic sponsor pattern on a long attacker header is still cut off quickly.
actual: Under load (24 processes on 4 cores) a genuine delivery whose connector uses `pattern`/`timestampPattern` is answered 401; 08-14 measured 26 of 72 runs failing on its billing path before it stopped using the matcher.
errors: 401 from POST /webhooks/:provider; event webhook_rejected; in tests "401 !== 200"
reproduction: run the webhook tests in many parallel processes (08-14's SCRATCH/exec-08-14/stress.sh style)
started: since the matcher got its 50 ms limit (review hardening); surfaced by 08-14's parallel gate

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the header or pattern content makes the match genuinely slow (data cause)
  evidence: the failing tests use ordinary linear patterns on ~100-character headers; timed-out windows used 0.3-17.8 ms of process CPU (14 of 20 under 1 ms) against 53-342 ms of wall time
  timestamp: 2026-11-19T19:35:00Z

- hypothesis: a single larger limit (no retry) is enough
  evidence: under 48 processes at once, first windows that timed out lasted up to 579 ms, past a 500 ms single limit; retries (which start just after the thread is rescheduled) never passed 212 ms
  timestamp: 2026-11-19T20:10:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-19T19:15:00Z
  checked: server/providers/connector.mjs lines 517-534 and 563-603
  found: MATCH_MS = 50; match() runs `matcher.runInContext(sandbox, { timeout: MATCH_MS })` and returns [] on ANY exception (timeout included); verify() returns false when `pattern` gives no candidates (line 582) or when `timestampPattern` gives no timestamp and the signed string needs one (line 587).
  implication: a timeout on a genuine header is indistinguishable from "no signature in the header" - the delivery is refused.

- timestamp: 2026-11-19T19:15:00Z
  checked: server/test/review.test.mjs test 11 and server/test/hardening.test.mjs
  found: test 11's pattern '^v1=((a+)+)$' is refused by the load-time validator, so makeConnector throws and the child exits 0 before any match runs; no test runs the time limit with a pattern the validator accepts.
  implication: the time limit itself is unproven by the suite; a catastrophic pattern that passes validation (e.g. three adjacent \w* quantifiers) is needed to prove the cut-off.

- timestamp: 2026-11-19T19:25:00Z
  checked: SCRATCH/dbg-match/stress.sh 24 3 on base 9922642 (connectors.test.mjs, 24 processes at once x 3 rounds, 4 cores, load average 3.6 before start - other agents' work on the same machine)
  found: 72 runs, 22 with a failure, 5 with "401 !== 200". Failing tests only: scheme 2 (15 runs; pattern + timestampPattern) and scheme 3 (10 runs; pattern). Assertion lines: 365 (rotation delivery 401) x4, 367 (`duplicate` undefined: re-delivery answered 401) x11, 388 (401) x1, 391 (duplicate undefined) x9. Scheme 1 and 4 (prefix / whole header, no pattern) never failed.
  implication: failures are confined to the pattern path; every failing assertion is a correctly signed delivery refused. Reproduced at the scale 08-14 measured (26/72).

- timestamp: 2026-11-19T19:35:00Z
  checked: temporary instrumentation of match() (wall ms of the runInContext window, process CPU ms during it, outcome), SCRATCH/dbg-match/instr.sh 24 3 on base (not committed; file restored with git checkout)
  found: 1210 windows, 20 timed out, all ERR_SCRIPT_EXECUTION_TIMEOUT. Timed-out windows lasted 53-342 ms of wall time while the whole process used only 0.3-17.8 ms of CPU in them (14 of 20 under 1 ms). Windows that did not time out: p50 10.5 ms, p90 52 ms, p99 126 ms, p99.9 219 ms, max 231 ms (125 of them over 50 ms survived only because the watchdog thread was itself not scheduled in time). 6 of 72 runs failed in this run (load from other work on the machine varies run to run).
  implication: CONFIRMED - the refusals are the wall-clock watchdog firing while the thread is descheduled; the pattern work is negligible. The window includes creating and joining the watchdog's OS thread, so on a busy machine even an idle-cost match spends tens to hundreds of ms of wall time in it. A retry window must survive about 350 ms of stall under this load to be robust.

- timestamp: 2026-11-19T19:45:00Z
  checked: new tests in server/test/hardening.test.mjs, run on base 9922642
  found: "a correctly signed delivery is accepted when the machine is busy through the pattern time limit" FAILS on base 10 of 10 runs ("a genuine delivery was refused after the first time limit was missed / false !== true"). "a slow pattern on a 2,048-character attacker header is cut off in bounded time" passes on base (50 ms cut-off), and FAILS when the timeout option is removed ("a slow pattern was still running after 6 seconds"). Pattern \w*\w*\w*\w*(z) passes the load-time check yet takes 4.5 s on 200 characters with no limit (grows as n^5).
  implication: deterministic RED exists through the public verify(); the cut-off is now actually proven (review test 11 was vacuous: its pattern is refused at load time and the child exits before matching).

- timestamp: 2026-11-19T20:05:00Z
  checked: fix applied; SCRATCH/dbg-match/stress.sh 24 3, then SCRATCH/dbg-match/paired.sh 24 3 3 (base and fixed matcher alternated so both see the same machine load)
  found: fixed alone 0 of 72. Paired: BASE 18/72 (7 with "401 !== 200") | FIXED 0/72 ; BASE 9/72 (4) | FIXED 0/72 ; BASE 9/72 (2) | FIXED 0/72.
  implication: across all base runs 58 of 288 failed (22+18+9+9); across all fixed runs 0 of 288 (plus 96 more at 0 during the bound-under-load measurement).

- timestamp: 2026-11-19T20:10:00Z
  checked: temporary per-attempt logging on the fixed matcher (removed after), SCRATCH/dbg-match/instr2.sh at 24 and 48 processes at once, machine load average 17-22 from other work before start
  found: 24 at once: 1224 first attempts, 42 timed out, 42 retries all succeeded, longest retry 132 ms, longest timed-out first window 213 ms. 48 at once: 2448 first attempts, 366 timed out (15%), 366 retries all succeeded, longest retry 212 ms, longest timed-out first window 579 ms. 0 failed runs of 216.
  implication: a retry starts just after the thread is scheduled again, so it is much shorter than the stall that killed the first attempt; 500 ms leaves 2.4x headroom over the longest retry seen under twice the stress (250 ms would have left 1.2x).

- timestamp: 2026-11-19T20:15:00Z
  checked: SCRATCH/dbg-match/bound.mjs (verifyWebhook through makeConnector with \w*\w*\w*\w*(z), 2,048-character header), idle-ish (load average 3.8) and while 24 test processes ran (load average 15)
  found: slow `pattern`: 550-561 ms (10 calls) idle, 558-715 ms under load. Fast `pattern` + slow `timestampPattern`: 551-554 ms idle, 578-692 ms under load. Before the fix the same cut-off was about 50 ms. Without any limit the pattern takes 4.5 s on 200 characters and grows as n^5 (days at 2,048).
  implication: the protection holds and is bounded; the cost of a slow sponsor pattern per attacker request rises from about 50 ms to about 550 ms (theoretical worst per request 2 x 550 ms = 1.1 s, only if `pattern` finishes inside its retry and `timestampPattern` is also slow). Ordinary (linear) patterns never reach the retry on an idle machine, so an attacker cannot use them to trigger it.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: server/providers/connector.mjs match() (base lines 518 and 526-534) ran each sponsor pattern in one vm window with `timeout: MATCH_MS` (50) and returned [] on any exception. Node's vm timeout is a wall-clock watchdog thread, and the window also covers creating and joining that thread, so on a busy machine (stress: 24 processes on 4 cores plus other work) the window passes 50 ms while the match itself uses well under 1 ms of CPU (instrumented: 53-342 ms wall, 0.3-17.8 ms process CPU). The timeout was read as "no signature in the header", verify() returned false at line 582 (no candidates) or 587 (no timestamp), and POST /webhooks/:provider answered 401 to a correctly signed delivery. AND-gate: the single-window design (code) plus a stall over 50 ms inside it (environment).
fix: match() now tries limits [50, 500]: the first attempt keeps the old 50 ms limit; only when it ends in ERR_SCRIPT_EXECUTION_TIMEOUT is it tried once more with 500 ms; any other error still returns [] at once. Ordinary patterns on an idle machine behave exactly as before. Alternatives weighed: raising the single limit (a single window still dies to one long stall, and the first window's stalls reached 579 ms under heavy load while retries never passed 212 ms); retrying only when little CPU was used (Node 22 only reports whole-process CPU, which background GC threads inflate - measured up to 17.8 ms - so it could refuse the retry it needs); V8's linear regexp engine flags (experimental, process-wide, a deployment change). README line 268 updated to state the second limit. billing.mjs line 579's comment still describes the old single limit; not edited (out of scope by instruction).
oracle_type: specified (a correctly signed delivery must verify true; a slow pattern must return false within a stated bound)
verification:
  target_test: { result: pass, test: "server/test/hardening.test.mjs: a correctly signed delivery is accepted when the machine is busy through the pattern time limit", red_on_base: "10 of 10 runs, false !== true" }
  bound_test: { result: pass, test: "server/test/hardening.test.mjs: a slow pattern on a 2,048-character attacker header is cut off in bounded time", fails_when_limit_removed: true }
  mutation_check: { result: pass, reason_if_skipped: "Stryker not configured; hand mutants at the fix site instead (SCRATCH/dbg-match/mutate.sh)", mutant_killed: "M1 [50] only - killed by target; M2 retry only on non-timeout errors - killed by target; M3 [50, 5000] - killed by bound test; M4 no timeout - killed by bound test; M5 retry on every error - survives, equivalent (a non-timeout error repeats and still returns [])" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: n/a (adds a bounded second attempt; nothing removed) }
  adjacent_tests: { result: pass, suites_run: ["server full suite: # tests 286 # pass 286 # fail 0", "connectors.test.mjs 19/19", "hardening.test.mjs 8/8", "review.test.mjs (test 11 included)"] }
  stress: { before: "58 of 288 runs failed across 4 base runs (22, 18, 9, 9 of 72)", after: "0 of 288 across 4 fixed runs; also 0/216 at 24 and 48 at once with logging, 0/96 during the bound-under-load run, hardening.test.mjs 0/72 under load" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict: accepted
files_changed: [server/providers/connector.mjs, server/test/hardening.test.mjs, server/README.md]
