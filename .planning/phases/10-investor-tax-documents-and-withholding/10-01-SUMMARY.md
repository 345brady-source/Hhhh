---
phase: 10-investor-tax-documents-and-withholding
plan: 01
subsystem: distributions (data.js record, console distributions section, capital-account engine, investor payments table)
tags: [distributions, withholding, tax, record, paid-rule]
status: complete
requires: []
provides:
  - "NS.data.runPaid, runState, buildLines, recordRun, runLines, runRows, confirmLines, cancelRun, paidLines (interfaces block of 10-01-PLAN.md), plus gpPaid (A2)"
  - "checks/lib10.js helpers for every phase 10 browser check"
  - "checks/dist-record.js (9 cases), checks/dist-flow.js (7 parts)"
affects: [10-05, 10-07, 10-08, 10-09, 10-10, 10-11, 10-14, phase 11 journal]
tech-stack:
  added: []
  patterns: ["one paid test (runPaid) for every reader", "per-investor lines stored on the run when it is recorded"]
key-files:
  created:
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/lib10.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/dist-record.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/dist-flow.js
  modified:
    - assets/js/data.js
    - assets/js/console.js
    - assets/js/audit.js
    - assets/js/portal.js
decisions:
  - "A8 confirmed and fixed in holdersAt: a position redeemed in full is held through its dealing date and not after; one sample figure moves (Pellbrook Long/Short holders today: 16 investors and $8,625,000 at the base, 15 and $8,125,000 now)"
  - "Capital raised (console raised()) keeps counting a position redeemed in full, so the A8 fix does not lower it"
  - "An ACH file built again for a recorded run pays the stored net amounts; a line with net 0 gets no entry; no ACH file on a cancelled run"
  - "Recording refuses an ACH file built before the register changed, in one line, and records nothing (A5)"
metrics:
  completed: 2026-11-19
  tasks: 2
actuals:
  tokens: 30000
  tasks: 2
  commits: 5
plan_head_before: 3234eb5260e7ebfe4d866997781d9a3ffa8eb2be
plan_head_after: 9196155
---

# Phase 10 Plan 01: the distribution record Summary

What each investor was paid (gross, tax withheld, net) is stored on the run when a distribution is recorded, one function (`NS.data.runPaid`) decides whether a run is paid, and every reader in the portal (console history, overview total, report, ACH file rebuilt, capital-account engine, investor pages, next-distribution date) now reads the record. Tasks 1 and 2 only; Task 3 (`gate10.sh`) is plan 10-14 (A4). The owner has not checked this yet.

## Failures and weak points first

- **Two Task 2 rules did not fail first in the working tree.** Cases `frozen` and `withheld` passed on the tree Task 1 left, because the earlier agent's Task 1 code (`buildLines` with withheld entries, `runLines`) already held those rules before these cases existed. Their failing run is on the base tree instead (`P10_ROOT=<3234eb5>`, both "D.recordRun is not a function"), kept in SCRATCH/exec-10-01/red-2.txt.
- **A9's first assertion as written did not fail first.** On Task 1's code the engine never read stored lines, so "skipped, not a crash" passed. I strengthened it (the run's engine rows must equal its stored lines without the stray one); it then failed on Task 1's code (red-2-a9.txt) and passes now.
- **Three check bugs fixed after the RED run, not code bugs:** part `future` waited for `.cs-kv` on the overview (the figures list is `.cs-figs`), so its last check never ran in RED; part `managed` held a guessed base form (`ds-rate`), replaced by the form the page drew at the base (`ds-total`, `ds-gross`: the console form code was untouched at that point); part `managed` ran the white-label scan, which always flags "Carrow & Vale" on the managed edition by design, so that part now removes the managed firm's own name before scanning.
- **The case sandbox needed more than the plan said:** the readiness checks (A9) need `verify` passed in, inert timers, `TextEncoder`, and a copy of onboarding.js's one tax-form rule (`taxOnFile`) because onboarding.js needs a page. These four lines live in dist-record.js and went into the feat commit, not the test commit.
- **Not done here, by design:** `mobile/src/core/data.js` (a generated copy) was not regenerated (A9). Saved real workspaces that hold a run recorded as scheduled whose date has passed will show it Paid and count it in totals (A9). No control to cancel a run exists yet (10-07 adds it; `cancelRun` exists and is checked). The withheld lines are on the investor's table only; the investor's headline "Total received" stays gross (wording settled in 10-07).
- **The owner has not checked any of this.**

## What the earlier agent had done (agent a8a96e1d1c3d9a7d5, stopped on a usage limit)

- Task 1 complete: base recorded (3234eb5), lib10.js, case `store` and part `record-phone` written and seen failing (red-1.txt), then the code: `buildLines`, `recordRun`, `runLines`, `runRows`, `NS.investorView` reading the record, `dist-record` storing through `recordRun`. Task 1's verify passed: "DIST RECORD: PASS (cases run: 1)" and "DIST FLOW: PASS (parts run: 1)".
- **A8 traced first and confirmed**, in case `store` (example B): A-1004, $400,000 redeemed in full at the 31 March 2026 dealing date, took 400,000 of a 1,000,000 distribution dated 15 June 2026. Fixed in the one function, `holdersAt`: a redeemed position is held through its dealing date and not after (commit 6397878).
- Task 2's checks had been drafted but were not committed and were lost; none of Task 2's code was in the tree.

## What I did

- Reset my worktree to the earlier branch (b02806c), then wrote Task 2's checks: cases `sample`, `frozen`, `paid`, `legacy`, `withheld`, `cancel`, `readers`, `selfcheck`; parts `record-desktop`, `frozen`, `future`, `withheld-phone`, `withheld-desktop`, `managed`. Ran them (40 FAIL lines, red-2.txt), committed them (862f08d), then wrote the code (9196155).
- **A8, every sample figure that moves:** measured holders and capital invested of every fund of the four sample firms on the base tree and on this tree. One fund differs: Pellbrook Long/Short (`pb-long-short`), where PBP-1002 redeemed $500,000 in full at 31 December 2025: today's holders 16 investors / $8,625,000 at the base, 15 / $8,125,000 now. That shows on the console's offerings list and offering page ("15 investors") and on the distribution form's hint and its annualized-rate amount for that fund. The fund has no distribution, so no payment, capital-account row or investor total moves. "Capital raised" would have dropped by $500,000 too; I kept `raised()` counting every subscription, so it does not move. Case `sample` compares every other figure with the base and names this one.
- Sample hashes recorded from the base tree (sample-base.txt, clock 2026-11-19): kestrel-bay engine 4251bd8c0700df3c, investors d510b1dc547c7f67, next 0a7e3d2fe0f2e9cb, holders 5d2668f43918ccab (220 rows); ashwell-ridge 0339bafbfe0ac60a / 905750294746738d / e5f68ebf79c27c55 / 5a8e43b9c4a6847d (1,879 rows); greywater 90890d31f9d4900b / b7005c6c771eae0c / db7c188f5d38493b / a30c432b8c41d1d7 (1,000 rows); pellbrook df7a0364c351841c / 10ea600b06e1a4de / a27764e8b192999e / faaa04d5c1d321ee (14 rows). This tree gives the same values; the base tree passes the same case (A3).

## Hand-worked numbers the checks hold to the cent

- Example A: 1,000,000 cents over $300,000 / $200,000 / $100,000 = 500,000 / 333,333 / 166,667 (the leftover cent to A-1003, the largest remainder). With 80,000 withheld from A-1002: nets 500,000 / 253,333 / 166,667 = 920,000.
- After A-1003 becomes $200,000: stored lines stay 500,000 / 333,333 / 166,667; a run saved without lines works out to 428,572 / 285,714 / 285,714 (stored false, basis recomputed).
- On screen (both sizes, sandboxed frame): A-1002's June payment reads $3,333.33, "Tax withheld $800.00", "Amount paid $2,533.33". The ACH file built again for that run pays A-1002 253,333 cents, 920,000 credits in all; for the September run, where A-1003's whole 166,667 is withheld, A-1003 has no entry and credits are 833,333.
- Investor totals (readers): 200,000 + 200,000 + 50,000 + 333,333 = 783,333 received, 583,333 this year, 333,333 scheduled.
- A run saved as scheduled on 15 October 2026 whose date has passed counts as paid: the next payment is 15 January 2027 (the base said 15 December 2026).

## Plan-check additions applied

A1 (ACH file rebuilt from stored nets; none on a cancelled run; editing a draft drops its link), A2 (`gpPaid`; `paymentDay`, the schedule text and the report skip cancelled runs), A3 (case `sample` on the base tree), A4 (closing gate through gate9.sh; no gate10.sh), A5 (`buildLines` throws on a bad sum; stale ACH file refused at recording in one line), A6 (`recordRun`, `confirmLines`, `cancelRun` clear the caches; the engine's rows change with no save between), A7 (no wording changed; help guide test "# fail 0"), A8 (above), A9 (stray lines skipped and reported in the readiness checks' "Distributions agree to bank records" item; notes above).

New words on screen: `Cancelled`, `Tax withheld`, `Amount paid`, plus the one-line refusal A5 asks for ("The ACH file was built before the investor register changed; generate it again before recording.").

## Verify and gate, verbatim

Task 2's verify (SCRATCH/exec-10-01/verify2.sh, the plan's command plus A3 and A7), tree 9196155:
```
readers comparing a run's stored status: 0
DIST RECORD: PASS (cases run: 9)
STATUS MATH: PASS (cases run: 13)
DIST RECORD: PASS (cases run: 1)          <- case sample on the base tree 3234eb5 (A3)
# fail 0                                  <- server/test/help-guide.test.mjs (A7)
DIST FLOW: PASS (parts run: 7)
VERIFY2 OK
```
index.html: `git diff --quiet 3234eb5 HEAD -- index.html` holds. The baseline count of readers comparing a run's stored status was 11 (audit.js 5, console.js 4, data.js 2); it is 0.

Closing reference gate through phase 9's script (A4: `GATE_OUT=$O bash .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/gate9.sh`), tree 9196155, base 3234eb5, last lines:
```
GATE ok   SAFARI FINISH (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 252
# pass 252
# fail 0
GATE ok   server tests 252 = base 252 + 0 declared
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=0
```
No GATE FAIL line. Beside it, this plan's own two lines: `DIST RECORD: PASS (cases run: 9)` and `DIST FLOW: PASS (parts run: 7)`. The base tree and screenshots were removed after the gate; no server/node_modules link is left.

## Interfaces as built, where they differ from the plan's block

The block in 10-01-PLAN.md is unchanged. Differences in what was built:
- `runPaid(run, now)` and `runState(run, now)`: the second parameter is named `now` in the code (the block says `today`); same meaning, default the clock's day.
- `NS.data.gpPaid(ws, offeringId, onOrBefore)` is exported as well (A2).
- `recordRun` also throws when `opts.by` is empty or the id is already recorded; `confirmLines` throws when `by` is empty, the run does not exist, or an entered amount is not a positive whole number of cents; `cancelRun` throws when `by` or `why` is empty or the run does not exist.
- The capital-account ledger (`NS.audit.ledger(...)`, and so `period(...).L`) carries a new key `strays: [ { date, investorId, cents, run } ]` (A9).
- Console internals: a draft loaded from a recorded run carries `fromRun` (the run id); a built ACH file carries `paid: [ { id, cents } ]`.
- lib10.js: `sample(fr, { role, investor })` also takes `investor` and the role `staff`; `framed` returns `A.setClock(day)`; the module also exports `VIEW, SANDBOX, CSP, CSP_SELF, SAMPLE, Lib`.

## Functions changed in shared files

- assets/js/data.js: `holdersAt` (A8), `allocate` (now calls `shares`), `paymentDay`, `scheduleText`, `NS.nextDistribution`, `NS.investorView`, the `NS.data` export list; new `shares`, `withheldEntry`, `buildLines`, `recordRun`, `runLines`, `runRows`, `runPaid`, `runState`, `runById`, `confirmLines`, `cancelRun`, `paidLines`, `gpPaid`.
- assets/js/console.js (distributions section, plus `raised` and the overview total): `raised`, `NS.views.console` render (12-month total), `runsTable`, `buildFile`, `NS.binders.dist`, `NS.actions['dist-record']`, `NS.actions['dist-load']`, `distRows`, `distTable` (CSV status), `wfBody` (carried interest already paid).
- assets/js/audit.js: `ledger` (dists, strays, carried interest by investor), `runEvidence`, `seedLog`, `checks` (the bank item), `schedules` (reconciliation to bank records).
- assets/js/portal.js: `paymentsTable`.

## Commits (plan base 3234eb5)

- 78325f8 test(10-01): checks for the distribution record, seen to fail first (earlier agent)
- 6397878 fix(10-01): a position redeemed in full takes no share of later distributions (item A8) (earlier agent)
- b02806c feat(10-01): each investor's amount is stored when a distribution is recorded (earlier agent)
- 862f08d test(10-01): checks for the paid rule, runs saved earlier, withheld, cancelling and every reader, seen to fail first
- 9196155 feat(10-01): one paid rule, runs saved earlier, withheld and net, cancelling, and every reader moved to the record

## Deviations from Plan

1. [Rule 1 - Bug] `raised()` in console.js no longer reads `holdersAt`: after the A8 fix it would have lowered "Capital raised" by a redeemed position (Pellbrook, $500,000). It now sums every subscription, as the base did. Commit 9196155.
2. [Rule 2 - Missing functionality] `recordRun`, `confirmLines` and `cancelRun` require the name of the person acting (and `cancelRun` a reason), so the record always says who (T-10-02).
3. Task 3 (`gate10.sh`) is not in this plan (A4: it is plan 10-14). Frontmatter lists it in `files_modified`; it was not created.
4. The managed part's white-label scan removes "Carrow & Vale" before scanning (the managed edition shows its own name by design).
5. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (AUTOPILOT.md); TAX-14 and TAX-18 stay open until the owner has checked.

## Known Stubs

None. The cancel control and the withheld proposal screen are later plans (10-07, 10-05), not stubs of this one.

## Owner's check (pending)

Nothing here is called done until the owner has looked at it: record a distribution on the phone in the sample, open an investor's Distributions page, and see the amount; the withheld lines show only on a payment with tax withheld, which no screen can enter yet (10-07).

## Self-Check: PASSED

Files: checks/lib10.js, checks/dist-record.js, checks/dist-flow.js present; commits 78325f8, 6397878, b02806c, 862f08d, 9196155 are ancestors of HEAD.
