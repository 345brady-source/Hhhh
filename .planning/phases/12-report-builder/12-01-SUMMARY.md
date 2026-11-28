---
phase: 12-report-builder
plan: 01
subsystem: report builder figures
status: complete
tags: [reports, capital-accounts, distributions, performance, cents]
requires: [NS.audit (period, closedPerformance, openPerformance, events, ledger, build, snap, presets, settings, generated), NS.data (runRows, runPaid), NS.books (trialBalance, entries, status), NS.taxdocs.KINDS, NS.structures.curOf]
provides: [NS.reportsData (fundsOf, holders, statement, consolidated, runs, distribution, distributions, activity, performance, holdings, noi, fees, statements, series, taxYear, taxDocs, firm, investor)]
affects: [12-02, 12-05 (build on the NS.reportsData contract), 12-09 (walkthrough: fund A holdings open item)]
tech-stack:
  added: []
  patterns: [read-only adapters over the engine; engine anchor checks on every sample firm; build on a deep copy of ws (W3)]
key-files:
  created:
    - assets/js/reports-data.js
    - .planning/phases/12-report-builder/checks/reports-math.js
  modified:
    - assets/js/audit.js (two added export lines)
decisions:
  - "Payment method on a distribution follows the payment files' and journal's rule: ACH only with a bank account on file, Wire for method 'wire', otherwise Check; '' when the investor record is missing"
  - "C-07 scan (no key named gross) applies to performance figures (performance() and statement().perf); a distribution's gross amount is money paid, not a gross return, and keeps the name the interface gives it"
  - "fees() engine row carries code '5000' (the management fee account) beside the name 'Management fees'"
metrics:
  started: 2026-11-20T16:25:05Z
  completed: 2026-11-20T16:40:00Z
actuals:
  tokens: 15000      # chars/4 over reports-data.js + reports-math.js (59,672 chars) + 2 audit.js lines
  tasks: 3
  commits: 8         # MEASURED at SUMMARY write: git rev-list --count 96bbdf6..HEAD (this SUMMARY's own commit follows)
plan_head_before: 96bbdf6800f8b9190a02bf66f1483a2884717598
plan_head_after: 5adb8ec4a467d3d6e4a16891c7d7a5f131a5d2f8
---

# Phase 12 Plan 01: report figures Summary

One read-only module, assets/js/reports-data.js (NS.reportsData, 18 adapters), hands every investor-report section its figures in whole cents straight from the engine the audit and CPA packages use. Plus two export lines in audit.js (closedPerformance, openPerformance). Proven against fund A's hand-worked figures and, to the cent, against the engine on every sample firm, fund, investor and preset.

Nothing here is on any screen yet. Nobody sees it until plans 12-02 to 12-08 wire it in, and the owner has to check the finished builder before any of it counts as ready.

## Failures and open items (first)

- **No failure in the final runs.** Every verify passed; the details are below.
- **Failures found during the build, all fixed before commit:**
  1. `statements()` threw inside `NS.audit.build` on fund A's fixture. The cause: fixture investors carry no `onboarding` block, and audit.js:1275 reads `i.onboarding.status`. Every path that adds an investor in the portal sets `onboarding` (console.js:936, diy.js:247, invitations.js:220/1918, onboarding.js:1022/1055, data.js seeds), so real workspaces are not affected. The check seats fund A with the block the portal gives a hand-added investor. Nothing was changed in audit.js. If phase 11 ever builds packages for imported records with no `onboarding`, the audit package itself would throw. This was not fixed because it is outside this plan; it is logged in 12-01-deferred-items.md (a file named for this plan, so it cannot collide with the plans running in parallel).
  2. My check first called the first portal's adapter on a second portal's fund A. The engine's ledger cache is keyed by tenant id + offering id (+ journal length), so it returned the first seat's ledger. This was a check error, not a product bug (a page holds one workspace). The fix: each block uses its own portal.
- **Open item for 12-09 (as the plan states):** fund A's engine holdings at 2026-12-31 are still the one generated row, measured now: `{"id":"","name":"Fund A, L.P.","security":"Private equity fund","level":3,"fv":50343000,"cost":45308700,"debt":0,"equity":50343000,"pctNav":0.9728115942028985}`, NAV 51,750,000. The journal's holding (Portfolio Co X, $490,000.00 at cost $400,000.00) is not what holdings() returns until plan 11-11 moves holdingsAt onto the journal. holdings() is asserted equal to the engine on every fund, so it follows 11-11 automatically.
- **Rerun checks/reports-math.js after 11-11 merges (W3).** statements() already builds on a deep copy of ws, so a sync inside build cannot write the caller's ws.
- **Coverage gap closed in the check:** no sample distribution line carries tax withheld (0 of 3,251 lines), so on its own the withheld comparison could only ever test 0 = 0. The distribution case adds a fund A line with 24% backup withholding (72,000 of 300,000). distribution() and distributions() read withheld 72,000 and net 228,000, equal to runRows.
- **Interface notes for 12-02 and 12-05:** series() returns null for an investor with no row in the fund (the interface gives no shape for that case). For open funds, the engine's monthly `dist` includes redemptions paid (as P.fund.dist does), so series().dist does too. activity() lists redemptions separately. taxDocs() follows the interface literally ("state not 'withdrawn'"), so a document in state 'confirmed' (made but not yet delivered) or 'replaced' is listed with its state. The consumer decides what to show.

## RED outputs

### red-1 (Task 1, case fund-a, before reports-data.js existed; base 96bbdf6)

```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a585f4b4f20977862/assets/js/reports-data.js'
    at Object.readFileSync (node:fs:440:20)
    at .../11-fund-accounting-and-cpa-year-end-package/checks/load11.js:159:24
    ...
REPORTS MATH: FAIL (cases run: 1) - fund-a
```

### red-2 (Task 2 cases written before their adapters; fund-a lines PASS from Task 1, omitted here)

```
FAIL statement ran to the end :: TypeError: D.holders is not a function
FAIL consolidated ran to the end :: TypeError: D.consolidated is not a function
FAIL distribution ran to the end :: TypeError: D.runs is not a function
PASS performance NS.audit.closedPerformance and NS.audit.openPerformance are functions
PASS performance kestrel-bay: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance ashwell-ridge: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance greywater: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance pellbrook: every fund and preset: performance = the engine's closedPerformance or openPerformance
PASS performance both kinds were compared (open and closed funds)
PASS performance no key named gross in any performance result or statement perf (C-07)
FAIL holdings ran to the end :: TypeError: D.holdings is not a function
FAIL fees ran to the end :: TypeError: D.fees is not a function
FAIL noi ran to the end :: TypeError: D.noi is not a function
REPORTS MATH: FAIL (cases run: 8) - statement, consolidated, distribution, holdings, fees, noi
```
Case performance passed at RED because Task 1 built performance() (the plan puts statement, distribution and performance in Task 1); its RED is red-1.

### red-3 (Task 3 cases written before their adapters)

```
FAIL tax ran to the end :: TypeError: D.taxYear is not a function
FAIL activity ran to the end :: TypeError: D.activity is not a function
FAIL series ran to the end :: TypeError: D.series is not a function
FAIL readonly fund A: every adapter leaves JSON.stringify(ws) unchanged and none throws :: {"activity":"threw: D.activity is not a function","series":"threw: D.series is not a function","seriesFund":"threw: D.series is not a function","taxYear":"threw: D.taxYear is not a function","taxDocs":"threw: D.taxDocs is not a function","firm":"threw: D.firm is not a function","investor":"threw: D.investor
FAIL readonly kestrel-bay: every adapter leaves JSON.stringify(ws) unchanged and none throws :: {"activity":"threw: D.activity is not a function", ... same list}
FAIL readonly ran to the end :: TypeError: D.firm is not a function
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
REPORTS MATH: FAIL (cases run: 5) - tax, activity, series, readonly
```
selfcheck tests the check's own runner, so it passes before any adapter exists. The readonly lines already show that none of the Task 1-2 adapters wrote to ws (only the missing functions are listed).

## Verify lines

### Task 1 (verify command run verbatim from a script file, after commit b8b927d)

```
PASS fund-a fund A DPI 0.02, RVPI 1.15, TVPI 1.17 (2 decimals)
PASS fund-a fund A IRR = the check's own Newton IRR to 4 decimals
REPORTS MATH: PASS (cases run: 1)
VERIFY-1 EXIT=0
```
(audit.js diff against base 96bbdf6: `2 0`, checked inside the same command.)

### Task 2 (verify command run verbatim from a script file)

```
PASS noi a holding with no income or property-expense line gives null
PASS noi fa-x in Q3 2026 (a valuation line only) gives null
REPORTS MATH: PASS (cases run: 8)
VERIFY-2 EXIT=0
```
What it measured: 816 statement rows compared (4 sample firms, 15 funds, 4 presets), and 228 paid runs with 3,251 paid lines compared with runRows.
Mutation test (not committed): with the ytd account set to the period account and the cumulative made strict (`<` for `<=`), statement and distribution FAIL on all four firms. The file was then restored with `git checkout`.

### Task 3 (the plan's gate; verify command run verbatim from a script file, on 5adb8ec)

```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
REPORTS MATH: PASS (cases run: 13)
==> .../exec-12-01/same.txt <==
AUDIT SAME: PASS (cases run: 4)

==> .../exec-12-01/eb.txt <==
ENGINE BOOKS: PASS (cases run: 8)

==> .../exec-12-01/sm.txt <==
STATUS MATH: PASS (cases run: 13)
VERIFY-3 EXIT=0
```
No part was KEPT from a cache (0 KEPT lines in all four outputs); REPORTS MATH printed 88 PASS lines and 0 FAIL lines. The base tree was removed afterwards. The counts are the ones the check files declare in their `// last` lines (unchanged).

### Server tests (node_modules linked for the run, removed afterwards)

```
1..368
# tests 368
# pass 368
# fail 0
```

## The exact two lines added to audit.js (C-14, W2: directly after `period,`)

```
+    closedPerformance,
+    openPerformance,
```

## What the 13 cases prove

fund-a (FA-1001/FA-1002 Q4 and 2026 accounts, commitment, unfunded, multiples, IRR against the check's own Newton IRR to 4 decimals, fa-run-1 lines, fund performance, preliminary true) · statement (every sample firm, fund, investor, preset: period/ytd/itd accounts and perf === engine, every account adds up, investors sum to the fund, holders by id) · consolidated (name order, per-currency totals; kb-harlow in EUR gives exactly two totals) · distribution (every paid run and line === runRows, cumulative === events, method, runs newest first, cancelled/future run null, a line with tax withheld) · performance (=== closedPerformance / openPerformance, no gross key) · holdings (=== period().hold on every fund; statements() === the audit package's al/ops/chg on a copy, ws unchanged) · fees (fund A books 2026 and Q4 by hand; ILPA order with 5110/5120/5200/5900 added; engine fee on every sample fund) · noi (1,000,000 / 300,000 / 700,000; null without lines) · tax (one fund 600,000; only the investor's own documents, not withdrawn, not another year; no taxpayer-number shape although the records hold made-up ones) · activity (=== events for fund A; contributions, distributions and redemptions === the engine on every sample fund and investor, redemptions included) · series (quarters 0/0/0/600,000; month-end capital === ledger; fund series === expect.lpCapital) · readonly (all 18 adapters leave JSON.stringify(ws) unchanged for fund A and kestrel-bay; firm and investor blocks) · selfcheck.

## Commits

| Commit | Message |
|--------|---------|
| beea18a | test(12-01): reports-math case fund-a, hand-worked figures (RED) |
| b8b927d | feat(12-01): reports-data statement, distribution, performance; export closedPerformance and openPerformance |
| d704c64 | wip(12-01): save |
| b232e64 | test(12-01): engine anchor cases for every sample fund, consolidated, runs, performance, holdings, fees, NOI |
| e1b67c4 | feat(12-01): reports-data fundsOf, holders, consolidated, runs, distributions, holdings, noi, fees, statements |
| 753e5b9 | wip(12-01): save |
| c8e5292 | test(12-01): tax, activity, series, readonly and selfcheck cases |
| 5adb8ec | feat(12-01): reports-data activity, series, taxYear, taxDocs, firm, investor |

All pushed to wip/12-01.

## Deviations from Plan

1. **[Rule 2 - coverage] Two checks added beyond the plan's behaviour lists:** a tax-withheld line in case distribution (the sample firms have none), and a comparison of statements() with the audit package's own schedules in case holdings (no case covered statements()). The case count stays 13.
2. **[Rule 3 - check setup] Fund A seated with an `onboarding` block** for statements() and readonly, because NS.audit.build reads it and the fixture lacks it (see Failures 1). No product code changed for this.
3. **[Interpretation] C-07 "no key named gross"** is scanned over performance figures (performance() results and statement().perf). A distribution's `gross` is the interface's own field name for the amount paid before withholding.
4. **Tooling:** the plan's verify commands contain `$(git ...)`, so they were run from script files in the scratchpad (AUTOPILOT.md mechanics), unchanged otherwise. The plan ledger file under .git could not be written from this sandbox, so the base 96bbdf6 is recorded in base-commit.txt and in this frontmatter.

## Known Stubs

None.

## Threat Flags

None. There is no new network, file or auth surface: the module only reads the in-memory workspace and the engine.

## Self-Check: PASSED

- FOUND: assets/js/reports-data.js, .planning/phases/12-report-builder/checks/reports-math.js
- FOUND in HEAD history: beea18a, b8b927d, d704c64, b232e64, e1b67c4, 753e5b9, c8e5292, 5adb8ec
