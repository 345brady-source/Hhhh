---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 11
subsystem: fund accounting (the Audit page's statements read the journal)
status: complete
tags: [statements, balance-sheet, schedule-of-investments, bank-evidence, readiness, fa-03, fa-08, c-08]
requires: ["11-01 (books.js)", "11-05 (books-post.js sync)", "11-07 (engine reads the journal, generated(o))", "11-08 (books-bank.js store shape)", "10-01 (runRows netCents)"]
provides:
  - "holdingsAt(L, k, ws) from the journal for a fund that is not a sample fund; statement of operations by account"
  - "build() syncs the books first (real funds only, W5); 'books' readiness check; no invented bank references; net bank evidence"
  - "checks/statements.js: STATEMENTS (8 cases)"
affects: [11-12, 11-13, 11-15, 11-16]
tech-stack:
  added: []
  patterns:
    - "every change sits behind !generated(o), except schedule 07's net amounts (equal to gross with no tax withheld) and build's sync (real funds only)"
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/statements.js
  modified:
    - assets/js/audit.js
decisions:
  - "A holding's value support is its latest stored mark or live 'mark:' entry on or before the month-end (doc = the mark's document, else the entry's memo)"
  - "Asset or liability accounts added beyond the template get a row under their own name, so the statement always adds up to its totals; a gain account beyond 6000/6100 likewise on the statement of operations"
  - "'books' check counts bank lines dated on or before the period end; closed-period changes are the fund.exceptions of kind 'closed'; records that could not be posted as recorded (amount, mismatch, overpaid) are a line of their own; a sync failure is the first line"
  - "A fund with no completed month still shows its books at the period end (period passes tk to holdingsAt for real funds)"
metrics:
  duration: "2026-11-20 15:21:57 to 17:57 UTC (measured; the gate ran 15:32-17:57 with one resume after the 2-hour background limit)"
  completed: 2026-11-20
estimate:
  tokens: 90000
  tasks: 2
actuals:
  tokens: 9300
  tasks: 2
  commits: 6
plan_head_before: ad2fc5a78d65cc1aa5b362026c33540dd76340b6
plan_head_after: 69301beb12934d84a4a05e12cdb2e5c62de3fe21
---

# Phase 11 Plan 11: Real funds' statements from the journal Summary

For every fund that is not a sample fund, the Audit page's statement of assets and liabilities, statement of operations and schedule of investments now take every figure from the books. The Audit page and the package bring the books up to date first. Bank references are only what was recorded: the run's file or "No file" for ACH, "Check" with no number. Schedule 07 shows what was paid, net of tax withheld. A new readiness check, "Books recorded for the period", names each missing input on its own line. Hand-worked fund A ties to the cent, as do fund C and the probe, in both editions. Sample funds are unchanged: AUDIT SAME passed inside the gate in about 28.5 seconds, and in 31 seconds run alone. Statement format per C-01, assumption recorded; CPA read pending (C-07). The owner has not checked this.

## Failures and weak points first

- **The first gate run was stopped at the 2-hour background limit** (15:32 to 17:32 UTC), while it was running phase 10's TAXDOCS FLOW. Every step it had finished passed. It was resumed into the same folder on the same tree: the passed steps were kept, the rest ran, and the result was `GATE_EXIT=0` at 17:57. Because of the interruption, the server/node_modules link the first run made was left behind. The resumed gate did not own it, so the verify's last condition failed (`verify2_exit=1`). I removed the link and checked the verify's conditions again on the same outputs: `VERIFY2 OK` (SCRATCH/exec-11-11/verify2-tail.sh).
- **Not every case failed first.** In red-2, fund-c, managed and selfcheck passed, because Task 1's code provides fund-c's and managed's figures and selfcheck tests the harness. Run against the base audit.js, fund-c and managed fail (red-2-base.txt below).
- **The probe crashed before the code instead of showing its figures** (`ws.tenant.ach` undefined in runEvidence). The probe tenant has no `ach` block; the portal's tenant template always has one. After the change a real fund's runEvidence no longer reads it. The probe's "before" figures were measured separately with the base audit.js and an empty ach block (below).
- **The probe's "before" differs from 11-RESEARCH.md** (investments $362,483.20, cash $11,210.82, fee payable $500.00, check numbers 38830 and 15414). The research measured a probe set up differently, before 11-07. The base of this plan (after 11-07) measured investments $384,120.00 at a cost of $345,708.00, cash $11,880.00, and check numbers 60597 and 37181. All of these were invented. After: investments $0.00, cash $396,000.00, net assets $396,000.00, bank references exactly "Check".
- **Saved real workspaces will see their Audit page change in both editions (C-08):** the generated holdings, cash and check numbers disappear, and only recorded balances show. Until a sponsor records purchases and values, a real fund shows its contributions as cash, with no investments.
- **The fixtures' investors have no onboarding record.** The register schedule reads `i.onboarding.status`, which every portal path that adds an investor stores. The check adds `{ status: 'complete' }` when it is missing. The fixtures (not this plan's files) were not edited.
- **Two of the 'missing' sub-checks write fund.exceptions directly** (an 'amount' and a 'stray' item), instead of producing them through sync. The closed-period item is produced for real: the books are closed through 2026-06-30, a call's received date is then changed, and sync lists it.
- Still open from 11-07: the exit true-up and the floor at zero can still put a figure that is not in the journal into a real fund's capital. The 'nav' check now catches that as a difference between capital and the journal's balance sheet. Neither is exercised by funds A to D.
- fund.exceptions only grows (books-post `note`), so an exception stays listed in the 'books' check after its cause is fixed. The bank screen (11-15) or a later plan needs a way to dismiss one.

## Gate (verbatim, last lines of SCRATCH/exec-11-11/gate.txt from the resumed run; tail -n 45)
```
GATE ok   PHONE LAYOUT (8) (kept from 2026-11-20 16:40:36 UTC)
GATE ok   RECORD AND LOST AGREEMENT (7) (kept from 2026-11-20 16:42:46 UTC)
GATE ok   SCREEN EDGES (5) (kept from 2026-11-20 16:44:30 UTC)
GATE ok   WALK3 FIXES (9) (kept from 2026-11-20 16:44:55 UTC)
GATE ok   TITLES AND EDITOR (4) (kept from 2026-11-20 16:45:46 UTC)
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-20 16:50:26 UTC)
GATE ok   CO-INVESTOR SERVER (5) (kept from 2026-11-20 16:51:53 UTC)
GATE ok   HELP PREVIEW (6) (kept from 2026-11-20 16:52:07 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-20 16:58:01 UTC)
GATE ok   signing-plan (kept from 2026-11-20 17:07:00 UTC)
GATE ok   record-base (kept from 2026-11-20 17:07:47 UTC)
GATE ok   record-plan (kept from 2026-11-20 17:13:25 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
GATE ok   base-server-tests (kept from 2026-11-20 17:13:42 UTC)
GATE ok   server tests 368 = base 368 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-20 17:26:39 UTC)
GATE ok   DIST RECORD (kept from 2026-11-20 17:26:41 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-20 17:27:02 UTC)
GATE ok   SHIPPED LIBS (kept from 2026-11-20 17:27:48 UTC)
GATE ok   TAX 1099 (kept from 2026-11-20 17:27:50 UTC)
GATE ok   TAX FORMS (kept from 2026-11-20 17:27:52 UTC)
GATE ok   TAX MATH (kept from 2026-11-20 17:27:53 UTC)
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   ENGINE BOOKS
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE_EXIT=0
```
Also in gate.txt: `GATE ok   MEASURE (kept from 2026-11-20 16:08:13 UTC)`; no `GATE FAIL` line. AUDIT SAME inside the gate: its step finished at 17:47:15.39 UTC, 28.5 seconds after the step before it (WITHHOLDING FLOW, 17:46:46.89). Its last line: `AUDIT SAME: PASS (cases run: 4)`. W5's precondition: this tree has no 11-09 change (books-post.js is untouched here). The gate on the merged tree after 11-09 is the orchestrator's.

Task 2 verify: `STATEMENTS: PASS (cases run: 8)` (st.txt), `GATE_EXIT=0`, then `VERIFY2 OK` / `verify2_tail_exit=0` after the leftover link was removed.

## Evidence as produced

Task 1 RED (SCRATCH/exec-11-11/red-1.txt, before any audit.js change):
```
FAIL fund-a build brought the books up to date first (the call and distribution entries are in the journal) :: ["bank:fa-1","bank:fa-2","bank:fa-3","bank:fa-4","bank:fa-5","bank:fa-6","mark:fa-m1","mark:fa-m2"]
FAIL fund-a statement of assets and liabilities at 2026-12-31 is the research's, label by label, to the cent :: {"got":[["Investments, at fair value (cost $453,087.00)",50343000],["Cash and cash equivalents",1557000],["Total assets",51900000],["Management fees payable",150000],["Total liabilities",150000],...
FAIL fund-a statement of operations for 2026 is the research's, label by label, to the cent :: {"got":[["Investment income",450000],["Management fees",-1800000],["Net investment income (loss)",-1350000],["Net realized and unrealized gain (loss) on investments",9000000],...
FAIL fund-a schedule of investments: one row, fa-x (Portfolio Co X), cost 40,000,000, fair value 49,000,000, 94.6860% of net assets, Level 3 :: {"rows":[["","Fund A, L.P.","Private equity fund","",null,45308700,50343000,0.9728115942028985,"Level 3","Per the fund’s valuation policy","See valuation memo","Quarterly valuation memo, Dec 31, 2026",""]]}
FAIL fund-a schedule of investments total: cost 40,000,000, fair value 49,000,000 :: [...,45308700,50343000,...]
PASS fund-a the 'nav' tie (partners' capital agrees to net assets) passes
PASS fund-a the 'soi' tie (schedule of investments agrees to the balance sheet) passes
STATEMENTS: FAIL (cases run: 1) - fund-a
```

Task 1 verify (the plan's command):
```
PASS fund-a the 'nav' tie (partners' capital agrees to net assets) passes
PASS fund-a the 'soi' tie (schedule of investments agrees to the balance sheet) passes
STATEMENTS: PASS (cases run: 1)
VERIFY1 OK
```

Task 2 RED (SCRATCH/exec-11-11/red-2.txt; check committed in 7a299a0 before the Task 2 code in a90903b; non-PASS lines, cut):
```
FAIL probe ran to the end :: TypeError: Cannot read properties of undefined (reading 'companyName')   (runEvidence, audit.js:838)
FAIL refs fa-run-1 (a console run with its file): FA-1001 'ACH' with the file name, FA-1002 'Check' with 'Check' :: {"got":[{"inv":"FA-1001","method":"ACH","ref":"FUND_A_LP_20261215_A.ach · trace 044003180000001"},{"inv":"FA-1002","method":"Check","ref":"Check 55240"}],...
FAIL refs fa-run-2 (not a console run, no file): FA-1001 'ACH' with 'No file', FA-1002 'Check' with 'Check' :: {"got":[{"inv":"FA-1001","method":"ACH","ref":"FUND_A_LP_20261220_A.ach · trace 044003180000001"},{"inv":"FA-1002","method":"Check","ref":"Check 53547"}],...
FAIL refs schedule 07: fa-run-2 has no invented file name ('Missing') :: ["2026-12-20","fa-run-2","Realization proceeds",300000,300000,0,1,200000,1,100000,"FUND_A_LP_20261220_A.ach","Agrees"]
FAIL net schedule 07's row for fa-run-1: total 900,000, allocated 900,000, ACH 1 entry 600,000, checks 1 for 220,000 :: {"got":["2026-12-15","fa-run-1","Realization proceeds",900000,900000,0,1,600000,1,300000,"FUND_A_LP_20261215_A.ach","Agrees"],...
FAIL missing fund A before any bank import: exactly 'No bank account added.' (fa-x has a value in 2026; fee terms are set) :: null
FAIL missing after the import, the six decisions and markReconciled at 2026-12-31 the 'books' check passes :: null
FAIL missing one line undecided: the not-reconciled line for each account (no 'ending' without last four digits) and '1 bank lines not yet decided.' :: {"got":null,...
FAIL missing no value in 2026, fee terms unset and a change inside the closed period: one line each, in order :: {"got":null,...
FAIL missing a record that could not be posted as recorded is its own line ('1 records could not be posted to the books as recorded.') :: null
FAIL missing when the books cannot be brought up to date the 'books' check says so first :: null
STATEMENTS: FAIL (cases run: 8) - probe, refs, net, missing
```
fund-c, managed and selfcheck passed in red-2: Task 1's code provides fund-c's and managed's figures; selfcheck tests the harness. Run against the base audit.js (SCRATCH/exec-11-11/red-2-base.txt):
```
FAIL fund-c statement of operations for 2026: ... :: {"got":[["Investment income",0],["Management fees",0],["Net investment income (loss)",0],["Net realized and unrealized gain (loss) on investments",5000000],...
FAIL managed managed: build brought the books up to date first (the call and distribution entries are in the journal) :: ["bank:fa-1",...,"mark:fa-m2"]
FAIL managed managed: statement of assets and liabilities at 2026-12-31 ... :: {"got":[["Investments, at fair value (cost $453,087.00)",50343000],["Cash and cash equivalents",1557000],...
FAIL managed managed: statement of operations for 2026 ...
FAIL managed managed: schedule of investments: one row, fa-x ...
FAIL managed managed: schedule of investments total: ...
STATEMENTS: FAIL (cases run: 2) - fund-c, managed
```

Probe, fiscal 2025, measured with the base audit.js (tenant given an empty ach block, as the portal's tenant template has) and with this tree (SCRATCH/exec-11-11/probe-before.txt, probe-after.txt):
```
before al [["Investments, at fair value (cost $345,708.00)",38412000],["Cash and cash equivalents",1188000],["Total assets",39600000],["Management fees payable",0],["Total liabilities",0],["Net assets (partners’ capital)",39600000],...]
before soi [["","Probe Real Estate Fund, L.P.","Real estate fund","",null,34570800,38412000,0.97,"Level 3","Per the fund’s valuation policy","See valuation memo","Quarterly valuation memo, Dec 31, 2025",""]]
before activity ["Check 60597","Check 37181"]
after  al [["Investments, at fair value",0],["Cash and cash equivalents",39600000],["Total assets",39600000],["Management fees payable",0],["Total liabilities",0],["Net assets (partners’ capital)",39600000],...]
after  soi []
after  activity ["Check","Check"]
```

AUDIT SAME run directly before the gate (P11_ROOT = base ad2fc5a's diy.html and assets/js): 31 seconds wall time, `AUDIT SAME: PASS (cases run: 4)`, 928 schedules and 60 packages of 15 funds compared. Before the gate, also run alone: ENGINE BOOKS (8), POSTING (13), BANK REC (10), BOOKS CORE (8) and WORKBOOK (7), all PASS.

## What the check holds (STATEMENTS, 8 cases)

- **fund-a:** A&L at 2026-12-31: 'Investments, at fair value (cost $400,000.00)' 49,000,000 · cash 3,200,000 · total assets 52,200,000 · fees payable 450,000 · total liabilities 450,000 · net assets 51,750,000 · LP 51,750,000 · GP 0. Operations 2026: dividend income 1,200,000 · total income 1,200,000 · management fees -1,800,000 · professional fees -750,000 · total expenses -2,550,000 · NII -1,350,000 · realized 0 · unrealized 9,000,000 · net increase 7,650,000 · GP change 0 · LP 7,650,000. Schedule of investments: one row, fa-x, cost 40,000,000, fair value 49,000,000, 94.6860%, Level 3, total 49,000,000. The 'nav' and 'soi' ties pass. build put the call: and run: entries into the journal itself.
- **fund-c:** realized 5,000,000, unrealized 0, net increase 5,000,000, GP change -1,000,000, LP 4,000,000. A&L all 0, no investment rows. In the changes statement, GP distributions are -1,000,000 and the reallocation +1,000,000. 'roll' and 'nav' pass.
- **probe** (fiscal 2025): cash 39,600,000, investments 0, net assets 39,600,000. The statement of operations has only totals, all 0. No investment rows. Both distribution rows read 'Check' / 'Check'. The 'books' check lists exactly 'No bank account added.' and 'Management fee terms not set.'.
- **refs:** a console run with its file gives FA-1001 'ACH' with the file name and FA-1002 'Check' / 'Check'. A recorded run with no file gives 'ACH' / 'No file', and schedule 07 shows 'Missing'. Whole strings are compared.
- **net:** schedule 07's row is `['2026-12-15','fa-run-1','Realization proceeds',900000,900000,0,1,600000,1,220000,'Missing','Exception: no bank file']`. The A&L adds 'Tax withheld, payable' 80,000, and cash is 3,280,000.
- **missing:** fund A before any import lists exactly 'No bank account added.'. After 11-08's flow and markReconciled at 2026-12-31 the check passes. With one line undecided and a second account with no last four digits, it lists 'Operating ending 6789: not reconciled through December 31, 2026.', 'Reserve: not reconciled through December 31, 2026.' and '1 bank lines not yet decided.'. With no value in 2026, the fee unset and a change inside a closed period, it lists one line each, in the plan's order. An unpostable record gets its own line, and a stray is not counted. A sync failure is the first line. A sample fund (kb-fund-ii) has no 'books' check, and build leaves its books untouched.
- **managed:** every fund-a assertion holds with the managed edition loaded.
- **selfcheck:** an unknown --case name and an empty list each exit 1 with a FAIL line (child processes).

## Deviations from Plan

1. **[Rule 2] Accounts beyond the template keep their own row.** This covers asset and liability accounts other than the named ones, and gain accounts other than 6000 and 6100. Without it, a fund that adds an account would show totals its rows do not add up to.
2. **[Rule 2] The 'books' check has two lines the plan does not list.** If sync throws, the check says so first ('The books could not be brought up to date (...).') and the page still opens. Records the books could not post as recorded (fund.exceptions of kind amount, mismatch or overpaid) are counted on their own line. The closed-period line counts only kind 'closed', which is what its wording says. Strays are left to the existing 'bank' check.
3. **[Rule 1] A real fund with no completed month still shows its balance sheet at the period end.** period passes tk instead of null. Before, its statement showed nothing even when entries existed.
4. **Bank lines counted as undecided are those dated on or before the period end.** Lines after the period do not affect its statements.
5. **The value-support doc for a value recorded only as a journal entry is the entry's memo.** Fund A's fixture values are entries with no stored mark. The fallback text is 'Value entered'.
6. **The 'Investments' row** (1100 or 1150 lines on no known holding) is Level 3 with missing support, so the fair value hierarchy still adds up and the 'val' check flags it.
7. runEvidence no longer reads `ws.tenant.ach` for a real fund. That read was only for the invented file name and trace numbers.

## Known Stubs

None.

## Threat Flags

None new. T-11-33 is covered by case refs (whole strings, no counter or hash for a real fund). T-11-34 is covered by fund-a and fund-c (nav stays the capital accounts', compared with the journal's balance sheet). T-11-35 is covered by case missing. No package was installed.

## Files a preview build must add

None new at run time. Only assets/js/audit.js changed, and it is already loaded. The new file is the check, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/statements.js.

## Commits

- e58f736 test(11-11): fund A's 2026 statements from its journal, to the cent (RED)
- 1cb19a7 feat(11-11): a real fund's statements come from its journal
- 3916e47 wip(11-11): save (summary draft)
- 7a299a0 test(11-11): fund C, the probe, bank references, net bank evidence, missing inputs, the managed edition, selfcheck (RED)
- a90903b feat(11-11): no invented bank references, net bank evidence, and the missing inputs named
- 69301be wip(11-11): save (summary draft)
- plus the commit of this summary

Pushed only to wip/11-11. STATE.md, ROADMAP.md, books-post.js, books-hold.js and operations.js were not touched. server/node_modules is not left.

## Self-Check: PASSED

- FOUND: assets/js/audit.js, checks/statements.js, 11-11-SUMMARY.md
- FOUND in `git log ad2fc5a..HEAD`: e58f736, 1cb19a7, 3916e47, 7a299a0, a90903b, 69301be
