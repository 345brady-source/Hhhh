---
status: investigating
trigger: "SERVER MODE printed once `SERVER MODE: FAIL (parts run: 15) - tax-request` at 75b2fc5 (after merging 13-03); two immediate reruns PASS; failing run's detail not kept"
created: 2026-11-27T00:00:00Z
updated: 2026-11-27T00:00:00Z
---

## Current Focus

hypothesis: server-mode.js:1596 reads `snaps` right after the first heading, but the listener (1588-1590) pushes each body only after its own `await res.json()`; when the check's node process is late (load, GC pause) the page renders its heading before the body reaches the check and snaps is [] -> "the snapshot is a tax-form request ..." FAILs alone
bug_class: Heisenbug (observed once in 3 runs; first run under 3-4 concurrent gates) - route: stability/stress runs + timing measurement, no SBFL
test: (1) 40+ unmodified runs incl. concurrent and full 15-part runs; (2) instrumented copy measuring heading time vs body time (margin), event-loop lag, heap
expecting: natural margin shrinks under load/full runs; a natural FAIL shows exactly that one line
next_action: finish loop A (runs 3-15) and timing runs 2-21; then 3 unmodified full runs + 3 instrumented full runs through heavy.sh

## Symptoms

expected: `SERVER MODE: PASS (parts run: 15)` on every run of server-mode.js at 75b2fc5
actual: one run printed `SERVER MODE: FAIL (parts run: 15) - tax-request`; two immediate reruns on the same tree PASS
errors: failing check line(s) not kept
reproduction: `node .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js` (through heavy.sh), first failure while 3-4 other gates ran
started: first seen at 75b2fc5 (13-03 merged); 13-03's own gate on base 8efaa5c passed SERVER MODE

## Eliminated

## Evidence

- timestamp: 2026-11-27T14:36Z
  checked: scratchpad mt-1303-out/results.txt, sm1.txt, sm2.txt; exec-06-01/checks-out/.parts/server-mode-731c48c544/*.json (the merged tree mt-1303's part store)
  found: the failing run's lines are gone - runParts saves a failed part (ok:false) to .parts and the rerun sm1 overwrote tax-request-f3ac6a0f.json with ok:true at 14:34:01. sm1/sm2 KEPT the other 14 parts and re-ran only tax-request, so "two reruns PASS" means tax-request alone passed twice. In the failing run the stamps give tax-w8ben 14:27:59 -> include-tax 14:28:26 = 27 s for tax-request + include-tax together; on 7 other trees the same pair takes 13-14 s + 14-16 s = 27-30 s.
  implication: the failing tax-request ran its normal length (~12-13 s): it did not return early at server-mode.js:1609 and did not hit a 30 s wait timeout; the fail was a check line that evaluates and goes on (an assertion on a value read at a moment), not a hang.

- timestamp: 2026-11-27T14:40Z
  checked: server-mode.js:1586-1598 (tax-request: the device's snapshot read) against the same read in serverFlow (server-mode.js:377-415)
  found: the 'response' listener pushes the GET /v1/invite body only after its own `await res.json()` (a second round trip to the browser for the body, after the response event); the part reads `snaps` at line 1596 straight after `waitForSelector('.ivf-form h1')`. Nothing orders the body's arrival in the check before the heading's appearance on the page. serverFlow reads its snaps only after walking the whole flow (seconds later), so the same listener never races there; tax-request is the only part that reads them at the first heading.
  implication: candidate test-side race: if the page renders its first heading before the check process has the body, snaps is [] and "the snapshot is a tax-form request ..." FAILs while every later step passes (a normal-length part, as the failing run's stamps show).

- timestamp: 2026-11-27T14:43Z
  checked: instrumented copy of server-mode.js in scratch (debug-tax-flake/inst/server-mode-timing.js; only the listener and the read after the heading timed), forced 1500 ms before res.json() (TIMING_BODY_DELAY=1500), load 12.4 on 4 cores
  found: `TIMING h1=629 snapsAtH1=0 resp=[473] body=[2181] margin=-1552` -> `SERVER MODE: FAIL (parts run: 1) - tax-request` with exactly one FAIL line: "tax-request: the snapshot is a tax-form request with no offering, ..."; all 19 other checks PASS, part length normal. Without delay the page needs ~150 ms from the response event to the heading.
  implication: the mechanism produces exactly the observed signature (one part FAIL, normal length, rerun PASS). Still to measure: how close the unforced margin gets under load.

- timestamp: 2026-11-27T14:43Z
  checked: repro runs (unmodified check, --only tax-request, GATE_FRESH=1, own P6_OUT each, heavy.sh), 3 loops concurrently, load 5-12 on 4 cores
  found: runs 1-2, 16-19, 30-32 so far: all PASS (in progress)
  implication: low failure rate at --only granularity; continue to 43 runs and add full-check runs

- timestamp: 2026-11-27T14:46Z
  checked: unmodified check, `--only tax-request`, 30 runs (run-1..2, 16..29, 30..43 so far; three loops at once through heavy.sh, other agents' forms-flow holding the other slots), load average 5-12.9 on 4 cores; outputs debug-tax-flake/run-N.txt, summary.txt
  found: 30 of 30 PASS, 14-34 s each
  implication: no natural failure at part granularity yet. The original failure was in a full 15-part run (one node process holding 13 earlier parts' heap and the in-process server, so longer GC pauses are possible); next: full runs, plus the instrumented copy now also records the node event-loop's worst delay and heap between goto and the heading.

- timestamp: 2026-11-27T14:46Z
  checked: other assertions of the part by reading, for a race of the same shape (a value read at a moment, no wait): 1570 row text (after consoleRoute's waitForSelector and fixed waits), 1578/1580 (server awaits mailer.send before replying; no SMTP_HOST, no accounts -> outbox stored synchronously, server/lib/mail.mjs:450-458; lib/invitations.mjs:1260-1266, 1392), 1601-1608 (the tax step renders from ensureFlow synchronously with the prefill already in the workspace, onboarding.js:1371-1395), 1621 (the POST request event precedes the done screen, which needs its response), 1622 (wipeTax awaited before save, onboarding.js:3298-3318), 1629-1631 (merge awaited before importedAt, invitations.js:1664-1667), 1644 (the link's token sits after #invite- and is stripped by PREFIX_TOKEN_RE; the server's emails.js BANNED list is used only by tests; note screen only on a note, and a tax request has none)
  found: none of these reads can see a half-finished state the way 1596 can
  implication: the snapshot read at 1596 is the only race found by reading in this part

- timestamp: 2026-11-27T14:49Z
  checked: every `on('response', async` listener in the checks (grep): server-mode.js:379 (serverFlow, read after the whole walk), server-mode.js:1028 (part clean: read after the first heading plus a fixed waitForTimeout(300)), server-mode.js:1588 (tax-request: read at the first heading, no wait), co-investor-server.js:335 (read much later, with a fallback fetch openLink), phase 8 reverify.js:1219 (read at the part's end)
  found: the same pattern in part clean of the same check, covered only by a fixed 300 ms guess
  implication: fix both reads in server-mode.js the same way (keep each body read as its promise; await at the read). The other files' reads are late and are left alone.

## Resolution

root_cause:
fix:
verification:
files_changed: []
