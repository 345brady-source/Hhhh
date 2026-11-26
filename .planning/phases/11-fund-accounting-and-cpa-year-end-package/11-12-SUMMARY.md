---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 12
subsystem: audit engine (assets/js/audit.js)
tags: [fund-accounting, audit-package, trial-balance, general-ledger, cash-flows, bank-reconciliation, highlights]
status: complete
requires: [11-09, 11-11]
provides: [schedules tb, gl, cf, bankrec, ratios (files 20 to 24) for every fund]
affects: [Audit page and its package (console.js unchanged), 11-16 CPA package, 11-17 CPA read]
tech-stack:
  added: []
  patterns: [schedules read the journal through NS.books.trialBalance / entries; cash flows built so that every non-cash account appears exactly once]
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/new-schedules.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/audit-flow.js
  modified:
    - assets/js/audit.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/statements.js
decisions:
  - "build() brings every fund's books up to date before period(), sample funds too (wave 5 B1); sample figures still come from the generator"
  - "Highlights never show NaN, Infinity or 0 for a figure that cannot be computed: empty value and a '(not available: ...)' line naming the missing input (W3)"
  - "Fund A's general ledger and trial balance gross debits are 100,000,000 cents, not the plan's 55,650,000 (that figure is the sum of debit balances)"
metrics:
  completed: 2026-11-26
estimate_ref: {tokens: 95000, tasks: 3}
actuals:
  tokens: 14200
  tasks: 3
  commits: 13
plan_head_before: 6b3a4a30437dee708fae6fb9c9794699011cf557
plan_head_after: 4be87ad
---

# Phase 11 Plan 12: new audit schedules Summary

Five new schedules for every fund, read from the journal: trial balance (20), general ledger (21), statement of cash flows (22), bank reconciliation (23) and financial highlights (24). They appear on the existing Audit page and in its package after every existing schedule. The phase 11 gate passes on this tree: GATE_EXIT=0. The owner has not checked this. The statement formats follow the research and C-01. No accounting-standards text could be read, so they stay unconfirmed until a CPA reads them (plan 11-17, C-07).

## Failures and problems first

1. **The first gate run hit the 2-hour limit and had three phase 10 browser failures.** TAXLINK FLOW, TAXRECORD FLOW and WITHHOLDING FLOW failed with browser timeouts and "Target crashed" while five gates from other builds ran on the machine at once (load average 6.6, 21 browser processes). The gate was rerun into the same folder (exec-11-12) and all three passed. Every other step was kept. First run's output: exec-11-12/gate-run1.txt.
2. **AUDIT SAME does not exercise this plan's sync or the new schedules.** load11 loads diy.html's scripts from edition.js through operations.js. books.js and books-post.js come after operations.js and the base lists them too, so audit-same.js's `treeExtras` adds nothing. As a result neither side has NS.books, and build() neither syncs nor builds schedules 20 to 24 there. Its green line ("464 schedules, 30 packages of 15 funds" per edition) is real, but it does not prove B1. **What does prove B1:** a separate probe ran AUDIT SAME's schedule comparison with books.js and books-post.js loaded on both sides (exec-11-12/probe-b1.js, output probe-b1.txt). The tree side synced 14 sample funds' journals; pb-ventures-ii has no activity. The base side synced none. Result: "compared 928 existing schedules and 60 fund-period period figures; 0 differ; 14165 ms". The change logs are identical too. The probe was not mutation-tested and does not unzip packages. **Open:** audit-same.js (plan 11-04's file) should load books.js and books-post.js on both sides. That belongs to the orchestrator or its plan's owner, not to this plan.
3. **Another executor shared this worktree.** The resumed 11-13 executor committed into this worktree's branch (6e3585d, 85f72b8, dcfc0a0, cd6c193). As the coordinator asked, each was reverted with `git revert --no-edit`: a321c8c (reverts 6e3585d), 5e67232 (85f72b8), 16c5acc (dcfc0a0) and c86f9a8 (cd6c193). `git diff --stat 0dd6b3f..HEAD` now lists only this plan's files and its summary. Before that instruction arrived I had pushed a clean copy as **wip/11-12-only** (e38a9a6). It is now obsolete: merge **wip/11-12**, not wip/11-12-only.
4. **The worktree was also reset under this run.** Something reset it to FETCH_HEAD (0dd6b3f) after the orchestrator's save commit 63f61ff. The fix was non-destructive: 63f61ff was merged back as fbb8de9, so wip/11-12 fast-forwards and holds 0dd6b3f's AUTOPILOT.md lines.

## Gate (GATE_OUT=exec-11-12, base 6b3a4a3, tree 4be87ad), last lines verbatim

```
GATE ok   server tests 403 = base 403 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-26 21:24:48 UTC)
GATE ok   DIST RECORD (kept from 2026-11-26 21:24:50 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-26 21:25:12 UTC)
GATE ok   SHIPPED LIBS (kept from 2026-11-26 21:34:21 UTC)
GATE ok   TAX 1099 (kept from 2026-11-26 21:34:25 UTC)
GATE ok   TAX FORMS (kept from 2026-11-26 21:34:27 UTC)
GATE ok   TAX MATH (kept from 2026-11-26 21:34:28 UTC)
GATE ok   TAXDOCS FLOW (kept from 2026-11-26 21:43:01 UTC)
GATE ok   TAXDOCS MATH (kept from 2026-11-26 21:43:02 UTC)
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT FLOW (kept from 2026-11-26 21:56:02 UTC)
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   ENGINE BOOKS
GATE ok   HOLDINGS
GATE ok   NEW SCHEDULES
GATE ok   NO ONBOARDING
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE_EXIT=0
```
The reference gate's steps before these were all "GATE ok": WAYS OUT (7), NO NETWORK (3), HELP CHAT (10), REAL FIRM (9), PHONE LAYOUT (8), signing and record base/plan, and the rest. There were 65 GATE ok lines and 0 GATE FAIL. Server tests: 403 pass, 0 fail (base 403). The gate left no base tree. I removed server/node_modules, a link that was in the worktree before my gate started.

**Measured AUDIT SAME time (B1):** 25,085 ms on a direct run against the base tree (`P11_ROOT=<base 6b3a4a3> node audit-same.js`, "AUDIT SAME: PASS (cases run: 4)", exec-11-12/audit-same-timed.txt). See problem 2 for what that run does and does not cover. The books-loaded probe took 14,165 ms.

## RED and GREEN, in order

- Task 1 RED (red-1.txt, base audit.js): `FAIL fund-a build returns a trial balance schedule '20_Trial_balance.csv' titled 'Trial balance' :: null` ... `NEW SCHEDULES: FAIL (cases run: 1) - fund-a`. GREEN: `NEW SCHEDULES: PASS (cases run: 1)` (fund-a.txt).
- Task 2 RED (red-2.txt): `FAIL gl build returns '21_General_ledger.csv' titled 'General ledger' :: null` ... `NEW SCHEDULES: FAIL (cases run: 7) - gl, bankrec, ratios, ties`.
- B1 RED (red-2b.txt, with gl/bankrec/ratios built and build still syncing only real funds): 28 FAIL lines, one per sample fund and period, e.g. `FAIL ties kb-fund-ii fy (2025-01-01 to 2025-12-31): the statements tie :: ["ops net increase 1594657 != journal results 0","soi total cost 661348935 / fair value 943032847 != 1100 0 / 1100+1150 0","cf cash at end 0 != al cash 29165964"]` ... `NEW SCHEDULES: FAIL (cases run: 1) - ties`.
- Task 2 GREEN: `NEW SCHEDULES: PASS (cases run: 7)`, 84 PASS lines. The ties case covered 15 fresh sample funds × 2 periods plus funds A and C in 4,223 ms.
- Task 3 RED (red-3.txt): the check was run on the base tree extracted to the scratchpad. `FAIL real-phone the schedule tabs include Trial balance, General ledger, Statement of cash flows, Bank reconciliation and Financial highlights, after the existing ones`, `FAIL managed the five new tabs are present`, `FAIL sample-desktop ran to the end :: locator.scrollIntoViewIfNeeded: Timeout` (no Trial balance tab) ... `AUDIT FLOW: FAIL (parts run: 4) - real-phone, real-desktop, sample-desktop, managed`. GREEN: `AUDIT FLOW: PASS (parts run: 4)`, 53 PASS lines; nothing needed changing for it.

## What was measured (hand-worked figures, to the cent)

- **Fund A trial balance 2026:** expect.tb's ten accounts, each beginning at 0. Total row ['', 'Total', '', '', 0, 100,000,000, 100,000,000, 0]. Debit balances sum to 55,650,000 and credit balances to 55,650,000 (the fixture's).
- **Fund A cash flows:** net increase 7,650,000; unrealized -9,000,000; purchases -40,000,000; fees payable +450,000; operating -40,900,000; contributions 45,000,000; distributions -900,000; financing 44,100,000; increase 3,200,000; cash 0 to 3,200,000.
- **Fund C cash flows:** net increase 5,000,000; realized -5,000,000; purchases -10,000,000; proceeds 15,000,000; operating 5,000,000; contributions 10,000,000; distributions -14,000,000; general partner -1,000,000; financing -5,000,000; change 0.
- **General ledger:** 48 rows for fund A's 23 entries; every Source is its entry's src; debits = credits = 100,000,000. A memo starting with '=' is written with a leading apostrophe in the CSV.
- **Bank reconciliation:** before any import, 'No bank account added'. After plan 11-08's flow, 'Not reconciled through 2026-12-31'. After markReconciled the four rows read: statement 3,500,000; outstanding 'Distribution fa-run-1' -300,000; book 3,200,000; difference 0. A reconciliation dated after the period end is not used. A second account with no last four digits gives its own 'Reserve' line.
- **Highlights:** fund A's average capital is 46,275,000, the average of the engine's twelve month-ends (expect.lpCapital exactly). Expenses read 5.5105 and net investment loss -2.9173 in the CSV. The IRR equals schedule 13's fund IRR. For a real fund with no call, each value is empty and each measure ends with ' (not available: no limited partners’ capital in the period)' or ' (not available: no cash flows to the period end)'; the CSV holds no NaN or Infinity. An open-ended fund (pb-long-short) shows 'Total return for the period' = openPerformance's period.
- **T6 ties:** funds A and C and all 15 sample funds, built fresh with no sync before build, for 'fy' and 'itd'. Each tie held: net assets = end of period; ops net increase = journal results; schedule of investments vs 1100 and 1100+1150; cf change in cash = change in cash accounts; cf end = al cash; trial balance ending balances sum to 0.
- **On screen** (sandboxed frame, connect-src none, 390x844 touch and 1280x800, clock 2027-01-20): fund A reads Net assets $517,500.00, Contributions $450,000.00, Distributions $9,000.00, Net increase from operations $76,500.00. The five tabs come after the existing ones. The Trial balance total shows $1,000,000.00 debits and credits and $0.00 ending. Cash flows end at $32,000.00. Highlights read 5.51% and -2.92%. Bank reconciliation reads 'No bank account added'. The readiness list shows 'No bank account added.' kb-fund-ii's trial balance debits equal its credits and are not $0.00; its general ledger shows "Showing 60 of N rows. The CSV has every row." In the managed edition the tabs are present, the menu has no Accounting entry, and index.html and console.js have no change since 6b3a4a3. On every part: no script error, no outside request, a way out at the top, middle and end, and no vendor name or forbidden word.
- **All sample funds × 4 presets** (300 new schedules): no NaN, Infinity, 'undefined' or 'null' in any CSV (exec-11-12/probe-nan.js).

The five new files in the audit package: 20_Trial_balance.csv, 21_General_ledger.csv, 22_Statement_of_cash_flows.csv, 23_Bank_reconciliation.csv, 24_Financial_highlights.csv.

Screens for the owner: exec-11-12/shots (index.txt names each). They cover the phone and desktop shots of all five tabs for fund A, kb-fund-ii's trial balance and general ledger, and the managed page.

## Deviations from Plan

1. **[Rule 1 - plan figure] General ledger and trial balance gross debits.** The plan's gl behavior says "debits total 55,650,000 = credits total". 55,650,000 is the fixture's tbDebits, the sum of debit *balances*. Fund A's gross 2026 debits, worked by hand (in the check's comment), are 45,000,000 + 1,800,000 + 900,000 + 40,000,000 + 750,000 + 1,350,000 + 1,200,000 + 9,000,000 = 100,000,000. The check asserts 100,000,000 for the GL and the trial balance's Debits/Credits columns. It also asserts 55,650,000 as the sum of debit balances, so the fixture's figure is still checked where it applies.
2. **[Rule 1 - plan tie] Schedule of investments with short positions.** For pb-long-short, "soi total = 1100 and 1100 + 1150" cannot hold. The schedule's total is net of shorts (cost less short proceeds, fair value less short fair value), while the journal carries shorts at fair value in 2300. The tie now works per side: long rows to 1100 and 1100+1150, short rows to 2300, and the total's fair value to 1100+1150+2300. Funds with no short keep the plan's tie exactly. Measured on pb-long-short fy 2025: 1100 = 1,233,437,001, 1150 = 143,802,191, 2300 = -611,176,055, total fair value 766,063,137 = 1,377,239,192 - 611,176,055.
3. **[Rule 3 - wave 5 B1 overrides wave 4 W5] checks/statements.js case missing**, a file outside files_modified. Its last check asserted that build does not touch a sample fund's books, which B1 reverses. It now asserts: no 'books' check, build posts the sample entries, and a second build changes nothing. STATEMENTS: PASS (cases run: 8).
4. **Task 1's code commit is 63f61ff "wip(11-12): save".** The orchestrator made it when usage ran out. I verified its content was exactly the intended edit and did not rewrite it, since that would have needed a force push.
5. **Plan wording:** the bank reconciliation's "a fund with no bank account" row is ['', 'No bank account added', '', '', empty]. A sample fund also shows it, because sample funds have no bank account in their books.
6. **I2 (info):** an opening entry dated inside an 'itd' period shows its cash as 'Opening balances' under financing. In a 'fy' period it is in cash at the beginning. This is accepted as the plan check says.

## Commits (0dd6b3f..HEAD on wip/11-12)

- 2442c77 test(11-12): fund A's trial balance and cash flow statement (RED)
- 63f61ff wip(11-12): save (Task 1 code: tb and cf)
- fbb8de9 Merge commit '63f61ff' (restores the work after the worktree was reset)
- 36d04cb test(11-12): general ledger, bank reconciliation, ratios, fund C and the ties (RED)
- d506274 feat(11-12): general ledger, bank reconciliation and financial highlights; build syncs every fund
- 800adf2 wip(11-12): save summary draft
- 9181bfd wip(11-12): save audit-flow check (checks/audit-flow.js)
- c86f9a8, 16c5acc, 5e67232, a321c8c: reverts of 11-13's commits cd6c193, dcfc0a0, 85f72b8, 6e3585d
- 4be87ad test(11-12): the Audit page's new schedules in the owner's conditions (AUDIT FLOW 4 parts)
- this summary

## Known Stubs

None.

## Threat Flags

None. No new endpoint or storage surface; memo and bank text reach the page only through console.js's escaped audTable (T-11-37) and the CSV keeps its formula guard (tested).

## Self-Check: PASSED

The files exist: assets/js/audit.js (booksSchedules, cashFlows), checks/new-schedules.js and checks/audit-flow.js. Commits 2442c77, 63f61ff, 36d04cb, d506274, 9181bfd and 4be87ad are ancestors of HEAD. GATE_EXIT=0.
