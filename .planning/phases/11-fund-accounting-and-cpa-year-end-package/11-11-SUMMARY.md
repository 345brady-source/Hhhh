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
