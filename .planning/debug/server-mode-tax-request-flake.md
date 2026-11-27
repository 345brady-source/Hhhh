---
status: awaiting_human_verify
trigger: "SERVER MODE printed once `SERVER MODE: FAIL (parts run: 15) - tax-request` at 75b2fc5 (after merging 13-03); two immediate reruns PASS; failing run's detail not kept"
created: 2026-11-27T14:35:00Z
updated: 2026-11-27T15:57:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: server-mode.js:1588-1596 (tax-request) reads `snaps` right after the first heading, but the listener pushes each GET /v1/invite body only after its own `await res.json()`, a second round trip to the browser after the response event; when the check's node process is held up for longer than the ~80-130 ms margin (load, GC), the heading wins and snaps is [] -> only "the snapshot is a tax-form request ..." FAILs
bug_class: Heisenbug (1 failure seen in 3 runs under 3-4 gates; 0 in 45 unmodified reruns)
test: done - server tests 584/584, SERVER MODE x10 full PASS, CO-INVESTOR SERVER PASS, EMAIL DIALOG PASS on d146e80
next_action: owner check; then merge wip/debug-tax-request-flake into claude/refract-reskin and archive this session to resolved/

reasoning_checkpoint:
  hypothesis: "The tax-request part FAILed once because the check read the snapshot list at the device's first heading while the body of GET /v1/invite was still on its way to the check (server-mode.js:1589 pushes after await res.json(); 1596 reads with no wait for it)."
  confirming_evidence:
    - "Forcing the body 1500 ms late at the check gives exactly the observed signature: SERVER MODE FAIL - tax-request, one FAIL line (the snapshot check), the part's normal length, every later step PASS (rg-red-tax)."
    - "The failing gate run's part stamps show tax-request ran its normal length (tax-w8ben 14:27:59 -> include-tax 14:28:26 = 27 s for both parts, 27-30 s on 7 other trees): an assertion failed and the flow went on; no wait timed out, no early return."
    - "Measured margin in natural runs is only 78-133 ms (body at the check 10-40 ms after the response event, heading 80-130 ms later); a 100+ ms hold-up of the check's process on a 4-core machine running 3-4 gates is enough."
    - "Every other read in the part was checked and waits for what it reads (Evidence 14:46)."
  falsification_test: "A natural failure whose FAIL line is any other check of the part, or a failure of the snapshot check with snapsAtH1=1 in the instrumented copy, would refute it. In 45 unmodified + 7 instrumented natural runs no failure occurred, so the single failure's own line is not available."
  fix_rationale: "Keep each body read as its promise and await all of them where the snapshot is read: the check then reads the same snapshot fields (taxRequest, offering null, taxPrefill address, no TIN run, no bank words) whatever the timing. At the heading the page has already consumed the body, so the awaited read returns after one round trip; nothing is skipped or loosened."
  blind_spots: "The failing run's own lines were overwritten by the rerun (lib.js savePart), so it is not proven that this race, and not another one-off, produced that failure. Natural reproduction not achieved at load 2.4-12.9."
  candidate_causes:
    - "code (check): snapshot body read races the first heading (server-mode.js:1588-1596) - ranked 1"
    - "code (check): same race in part clean (server-mode.js:1027-1039), covered by a fixed 300 ms wait - same defect, different part (would have printed '- clean')"
    - "environment: CPU starvation / GC pause in the check's process (the trigger of the race, not a separate cause)"
    - "code (product, 13-03): mail held/logged asynchronously -> outbox empty at 1580 - eliminated (mailer.send awaited before the reply; no SMTP_HOST, no accounts -> stored synchronously)"
    - "data: random token matching the leak scan at 1644 - eliminated (token after #invite- stripped; probability of a vendor word elsewhere ~1e-7)"
  and_gate: "yes: the defect (unordered read) AND a hold-up of the check's process > ~100 ms at that moment are both needed; the second explains why it showed once under 3-4 gates and never in 45 reruns at lower load"

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

- timestamp: 2026-11-27T14:55Z
  checked: unmodified `--only tax-request` runs 1-14, 16-43 (42 runs, three loops at once, heavy.sh shared with other agents' forms-flow / status-flow / report checks, load 4.6-12.9); instrumented copy, full 15-part run tfull-1
  found: 42 of 42 PASS. tfull-1 PASS (parts run: 15), `TIMING h1=380 snapsAtH1=1 resp=[264] body=[276] margin=104 lagMaxMs=13 heapMB=108`: in a full run the check had the body 12 ms after the response event and 104 ms before it saw the heading; worst event-loop delay 13 ms, heap 108 MB after 13 parts
  implication: the check wins the race by ~100 ms in a normal full run; it loses when its process is held up for longer than that between the response event and the heading (a GC pause or CPU starvation in a 4-core machine running 3-4 gates). Next: runs pinned to one CPU (taskset; the check and its own browser share it, no code delay) to stress the order without code changes.

- timestamp: 2026-11-27T15:14Z
  checked: 3 unmodified full SERVER MODE runs (run-101..103, all 15 parts, GATE_FRESH=1, heavy.sh, 4 other agents' gates running) and instrumented runs tfull-2 (full), timing-2..5 (--only tax-request)
  found: run-101/102/103 `SERVER MODE: PASS (parts run: 15)` (316-786 s incl. queue). Instrumented: tfull-2 margin=116 lagMaxMs=18 heapMB=65; timing-2..5 margins 133, 78, 126, 125 ms, lagMaxMs 10-28; in every run respEventsAtH1=1 (the response event had reached the listener before the heading was seen) and snapsAtH1=1
  implication: no natural failure in 45 unmodified runs (42 --only tax-request incl. three at once, 3 full); measured margin 78-133 ms; the response event always precedes the heading, only the body read after it races

- timestamp: 2026-11-27T15:12Z
  checked: RED/GREEN with the body forced 1500 ms late at the check (scratch copies: RED = unfixed check with the delay before res.json()/res.text(); GREEN = fixed check with the same delay inside the kept promise), --only each part
  found: |
    rg-red-tax (TIMING_BODY_DELAY=1500) | SERVER MODE: FAIL (parts run: 1) - tax-request | 19 PASS, 1 FAIL: FAIL tax-request tax-request: the snapshot is a tax-form request with no offering, carrying the form's pre-fill and no taxpayer ID, bank o...
    rg-green-tax (TIMING_BODY_DELAY=1500) | SERVER MODE: PASS (parts run: 1) | 20 PASS, 0 FAIL
    rg-red-clean (TIMING_CLEAN_DELAY=1500) | SERVER MODE: FAIL (parts run: 1) - clean | 11 PASS, 2 FAIL: FAIL clean the investor's page received the snapshot from the server :: 0; FAIL clean the investor in the snapshot is the invited investor alone
    rg-green-clean (TIMING_CLEAN_DELAY=1500) | SERVER MODE: PASS (parts run: 1) | 13 PASS, 0 FAIL
  implication: the fix makes both reads independent of when the body reaches the check, and checks the same snapshot fields as before

- timestamp: 2026-11-27T15:15Z
  checked: fix committed d146e80 (server-mode.js only, the verified scratch copy byte for byte); `cd server && node --test` on the fixed tree (node_modules linked)
  found: `# tests 584` `# pass 584` `# fail 0` rc=0 (debug-tax-flake/server-tests.txt)
  implication: server suite unchanged (the fix touches only the check)

- timestamp: 2026-11-27T15:27Z
  checked: instrumented (unfixed) copy: tfull-3 (full), pin-1..6 (--only tax-request, the check's node process and its browser pinned to CPU 0 with taskset), timing-6; fixed tree: run-201, run-202 (full SERVER MODE), coinv-1 (CO-INVESTOR SERVER)
  found: tfull-3 PASS (15) margin=173. Pinned: margins 141-172 ms, lagMaxMs 24-41, all PASS (one CPU lets the check run while the page renders, so it widens the margin rather than closing it; stopped after 6). Fixed: run-201 and run-202 `SERVER MODE: PASS (parts run: 15)`, coinv-1 `CO-INVESTOR SERVER: PASS (parts run: 5)`
  implication: natural runs of the unfixed check: 0 failures in 58 (45 unmodified + 13 instrumented natural). The race needs the check's own process held up >~80 ms while the browser keeps running (other gates' load), which these runs did not reach.

- timestamp: 2026-11-27T15:37Z
  checked: fixed tree (d146e80): run-203, run-204, run-206 (full SERVER MODE); emaildlg-1 (EMAIL DIALOG)
  found: run-201/202/203/204/206 `SERVER MODE: PASS (parts run: 15)` (5 of 10 so far); `CO-INVESTOR SERVER: PASS (parts run: 5)`; `EMAIL DIALOG: PASS (parts run: 3)`
  implication: verification in progress (5 more full runs)

- timestamp: 2026-11-27T15:56Z
  checked: fixed tree d146e80: run-201..210 (full SERVER MODE, two loops at once through heavy.sh alongside other agents' gates, load 2.7-4.4); stragglers of the unfixed instrumented copy (timing-6, pin-7)
  found: 10 of 10 `SERVER MODE: PASS (parts run: 15)`, 0 FAIL lines (307-906 s incl. queue). timing-6 margin=115, pin-7 margin=145, both PASS
  implication: verification complete on the fixed tree. Unfixed natural runs in total: 0 failures in 60 (45 unmodified, 15 instrumented); measured margin 78-173 ms over the 15 instrumented runs

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "In the check, not the product (ranked first; the failing run's own lines were overwritten by the rerun, so this is the cause the evidence points to, not one observed in that run). server-mode.js:1588-1596 (part tax-request): the device's response listener pushed each GET /v1/invite body only after its own `await res.json()`, a second round trip to the browser after the response event, and the part read the list at the device's first heading with nothing ordering the two. The check wins by 78-173 ms in measured runs; with its process held up longer than that (a 4-core machine running 3-4 gates) the heading comes first, snaps is [], and only 'the snapshot is a tax-form request ...' FAILs while every later step passes - the observed signature (one part FAIL, normal length, reruns PASS). Part clean (server-mode.js:1027-1039) had the same read behind a fixed 300 ms wait. No product race found: every other read of the part waits for what it reads, and 13-03's mailer stores the outbox message before the server replies."
fix: "server-mode.js only: both listeners keep each body read as its promise (`snaps.push(res.json().catch(() => null))`, `bodies.push(res.text().catch(() => ''))`); tax-request reads `(await Promise.all(snaps)).find(...)`, clean `const raw = await Promise.all(bodies)` after its existing wait. Same fields checked, nothing skipped; at the heading the page has consumed the body, so the awaited read returns after one round trip."
oracle_type: specified (the snapshot's fields as the plan states them; unchanged)
verification:
  target_test: { result: pass, detail: "GREEN: fixed check with the body forced 1500 ms late - tax-request PASS 20/20, clean PASS 13/13" }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker for the check scripts; the revert below is the mutant at the fix site and it is killed (FAIL) under the forced delay" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: n/a, detail: "no assertion removed or loosened; two reads now await the body they read; clean keeps its 300 ms wait" }
  adjacent_tests: { result: pass, detail: "server tests 584/584; SERVER MODE full x10 PASS (15) on d146e80; CO-INVESTOR SERVER PASS (5); EMAIL DIALOG PASS (3)" }
  revert_reconfirm: { result: pass, detail: "unfixed (reverted) check with the same forced delay: tax-request FAIL 19/1 (the snapshot check), clean FAIL 11/2; fixed: PASS" }
  natural_repro: "not achieved: 0 failures in 60 natural runs of the unfixed check (42 --only tax-request incl. three at once at load 4.6-12.9; 3 full; 15 instrumented: 3 full, 5 --only, 7 pinned to one CPU). Measured margin 78-173 ms."
files_changed: [.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/server-mode.js]
