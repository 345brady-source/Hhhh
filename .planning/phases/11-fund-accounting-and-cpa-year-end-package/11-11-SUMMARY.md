# Phase 11 Plan 11: Real funds' statements from the journal Summary (DRAFT, in progress)

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

AUDIT SAME run directly before the gate (P11_ROOT = base ad2fc5a's diy.html and assets/js): 31 seconds wall time, `AUDIT SAME: PASS (cases run: 4)`, 928 schedules and 60 packages of 15 funds compared.
