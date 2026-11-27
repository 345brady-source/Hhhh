---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 14
subsystem: books
tags: [cpa-package, schedule-l, form-8825, k1-inputs, tax-details]
status: complete
requires:
  - phase: 11-12
    provides: the Audit page's schedules 20-24 (trial balance, general ledger, bank reconciliation) and build() syncing every fund
  - phase: 11-10
    provides: holdings (kind property, address, placed, landCents, buildingCents) and fair-value marks
provides:
  - NS.books.package(ws, o, year, { today, actor }) -> { sheets, checks } (assets/js/books-pkg.js)
  - NS.books.packageCsv(sheet): a package sheet as CSV, with 'To be confirmed' cells in money columns written as text
  - checks/package.js, PACKAGE: PASS (cases run: 9)
affects: [11-16, 11-17]
actuals:
  tokens: 17499   # chars/4 over books-pkg.js (31,228) and package.js (38,768)
  tasks: 3
  commits: 6      # git rev-list --count a999e49..HEAD before this summary's commit
plan_head_before: a999e491503783cdece47f3ed594829cad5ab7de
plan_head_after: 7f36a92a39d13c568a81278563228800a83e9621
tech-stack:
  added: []
  patterns: [package sheets reuse the Audit page's schedule objects; every missing input reads 'To be confirmed' and is named again on the cover]
key-files:
  created: [assets/js/books-pkg.js, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/package.js]
  modified: []
key-decisions:
  - "Fund A's tax facts are written onto the loaded copy inside package.js; fixtures/fund-a.js is untouched (B1, the preferred way)"
  - "The cover has three columns (Item, Value, Amount): with two, a cents figure would sit in a text column and print as 900000000 in the CSV"
  - "NS.books.packageCsv is added because NS.audit.toCsv prints NaN for 'To be confirmed' in a money column; 11-16 must write package CSVs with it"
  - "A sample fund's properties and investments held at the year's beginning and gone at its end are listed, with the sale 'To be confirmed'"
metrics:
  duration: about 3 h 0 min (02:25 to 05:27 UTC, most of it the gate's three runs)
  completed: 2026-11-27
---

# Phase 11 Plan 14: The CPA year-end package's contents Summary

One pure function, `NS.books.package(ws, o, year)`, returns every sheet a CPA needs for a fund's partnership return, plus five checks. The sheets are the cover, the trial balance, the general ledger, the bank reconciliation, income and expenses by month, Form 8825 lines, a Schedule L balance sheet, the capital roll-forward, ownership and its changes, investor tax details (last four digits only), distributions by type, fees, carried interest, the waterfall, property and depreciation inputs, and investments. Fund A's figures match the hand-worked package to the cent. The Schedule L, capital and net-asset crosswalk ties on funds A, C and D and on all 15 sample funds.

## Failures first

- **Gate, run 1:** stopped at the 2-hour background limit while phase 10's checks were running. 40 steps had passed and one had failed: `GATE FAIL EMAIL DIALOG (3)`, phone part, "every paragraph of the email, its footer and the buttons were seen whole (4 of 11)". That is a phase 6 browser check, and no page loads books-pkg.js.
- **Gate, run 2** (same folder; passed steps kept): `GATE_EXIT=1`. The only failure was EMAIL DIALOG phone again, this time 10 of 11 paragraphs seen ("p: The link below takes you through everyth"). Every phase 10 and phase 11 check passed, PACKAGE included.
- **Gate, run 3** (same folder, nothing changed): EMAIL DIALOG passed (`EMAIL DIALOG: PASS (parts run: 3)`), `GATE_EXIT=0`. The changing count (4, then 10, then 11 of 11) points to timing on the shared browser slots, as in earlier plans (11-CONTEXT "After 11-04").
- **Leftover link:** run 1 was killed before it could remove its own server/node_modules link, so runs 2 and 3 did not remove it either. I removed it by hand after run 3; it was never staged.
- **RED 3 found a real gap in my own first build:** ar-larch, a sample real estate fund that sold its only property in August 2025, got an empty property sheet for 2025. Fixed: properties and investments held at the year's beginning and gone at its end are now listed, with the sale 'To be confirmed'.
- **Not checked yet:** the owner has not checked this, and no CPA has read the layout (plan 11-17 has one read a sample package). This plan builds no files and no button; plan 11-16 adds them, so none of this shows in the preview yet.

## RED lines (each check written and seen failing before its code)

- red-1.txt (Task 1): `FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-ac3c9730b43cd1e95/assets/js/books-pkg.js'` / `PACKAGE: FAIL (cases run: 1) - fund-a`
- red-2.txt (Task 2): 34 FAIL lines, e.g. `FAIL sheets fund A's package holds, in order, cover, tb, gl, bankrec, ie, bs, roll, own, tax, dist, fees, waterfall, inv (13: no carry, f8825 or property sheet) :: ["cover","tb","gl","bankrec","bs","r…` and `FAIL sheets fund C's package also holds carry, after fees and before waterfall :: ["cover","tb","gl","bankrec","bs","roll"]` / `PACKAGE: FAIL (cases run: 6) - sheets, tax, own, dist, property`
- red-3.txt (Task 3): `FAIL t15 ar-larch (real estate sample): a property sheet from the generated properties, 0 rows, placed in service, land and building 'To be confirmed', cost from the books :: []` / `PACKAGE: FAIL (cases run: 3) - t15`

## Verify lines

- Task 1: `PACKAGE: PASS (cases run: 1)` (exec-11-14/fund-a.txt)
- Task 2: `PACKAGE: PASS (cases run: 6)` (exec-11-14/t2.txt)
- Task 3: `PACKAGE: PASS (cases run: 9)` (exec-11-14/pkg.txt); gate last line `GATE_EXIT=0`; GATE ok lines for PACKAGE, NEW SCHEDULES and AUDIT SAME; no base tree and no server/node_modules left.

## Gate (GATE_OUT=SCRATCH/exec-11-14, base-commit a999e49), run 3, last lines verbatim

```
GATE ok   base-server-tests (kept from 2026-11-27 04:23:55 UTC)
GATE ok   server tests 456 = base 456 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-27 04:33:26 UTC)
GATE ok   DIST RECORD (kept from 2026-11-27 04:33:28 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-27 04:33:49 UTC)
GATE ok   SHIPPED LIBS (kept from 2026-11-27 04:36:18 UTC)
GATE ok   TAX 1099 (kept from 2026-11-27 04:36:22 UTC)
GATE ok   TAX FORMS (kept from 2026-11-27 04:36:23 UTC)
GATE ok   TAX MATH (kept from 2026-11-27 04:36:23 UTC)
GATE ok   TAX1099 FLOW (kept from 2026-11-27 05:00:29 UTC)
GATE ok   TAXDOCS FLOW (kept from 2026-11-27 05:05:43 UTC)
GATE ok   TAXDOCS MATH (kept from 2026-11-27 05:05:44 UTC)
GATE ok   TAXLINK FLOW (kept from 2026-11-27 05:06:49 UTC)
GATE ok   TAXRECORD FLOW (kept from 2026-11-27 05:07:34 UTC)
GATE ok   WITHHOLDING FLOW (kept from 2026-11-27 05:09:30 UTC)
GATE ok   AUDIT FLOW (kept from 2026-11-27 05:09:54 UTC)
GATE ok   AUDIT SAME (kept from 2026-11-27 05:11:16 UTC)
GATE ok   BANK FILES (kept from 2026-11-27 05:11:18 UTC)
GATE ok   BANK REC (kept from 2026-11-27 05:11:19 UTC)
GATE ok   BOOKS CORE (kept from 2026-11-27 05:11:20 UTC)
GATE ok   BOOKS FLOW (kept from 2026-11-27 05:18:40 UTC)
GATE ok   BUSINESS DAYS (kept from 2026-11-27 05:18:46 UTC)
GATE ok   ENGINE BOOKS (kept from 2026-11-27 05:18:47 UTC)
GATE ok   HOLDINGS (kept from 2026-11-27 05:18:48 UTC)
GATE ok   NEW SCHEDULES (kept from 2026-11-27 05:18:55 UTC)
GATE ok   NO ONBOARDING (kept from 2026-11-27 05:18:56 UTC)
GATE ok   PACKAGE (kept from 2026-11-27 05:19:01 UTC)
GATE ok   PDF OUT (kept from 2026-11-27 05:20:48 UTC)
GATE ok   POSTING (kept from 2026-11-27 05:20:52 UTC)
GATE ok   SAMPLES BOOKS (kept from 2026-11-27 05:20:59 UTC)
GATE ok   STATEMENTS (kept from 2026-11-27 05:21:01 UTC)
GATE ok   WORKBOOK (kept from 2026-11-27 05:25:00 UTC)
GATE_EXIT=0
```

(69 GATE ok lines and no GATE FAIL; server tests 456, all pass.)

## Sheets (in order; ids)

| id | Title | When |
|----|-------|------|
| cover | Cover | always. Fund; tax year; currency (plus a translation line when not USD); Accrual; 'Book basis. No figure here is a tax-basis or K-1 figure.'; fund type; prepared by (actor, firm); prepared at; books closed through; signed tax forms included 'No'; one row per package check; one row per open item of the Audit page's 'books' check; unrealized appreciation; accrued and unpaid expenses (2000 lines with no investor); distributions returned and owed to investors (2000 lines with an investor, only when nonzero); organizational costs; then one 'Missing input: <sheet>, <record>: <field>' row per gap |
| tb, gl, bankrec | the Audit page's schedules 20, 21 and 23 | always (the same objects, not rebuilt) |
| ie | Income and expenses by month | always |
| f8825 | Rental real estate by property | a real fund that holds a property |
| bs | Balance sheet in Schedule L order | always: lines 1, 6, 8, 9a, 9b, 11, 13, 14, 15, 16, 17, 19a, 19b, 20, 21, 22 |
| roll | Capital roll-forward by partner | always (the rollforward with 'Ownership, beginning' and 'Ownership, end') |
| own | Ownership and changes | always |
| tax | Investor tax details | always (16 columns, including 'Chapter 3 status') |
| dist | Distributions by type | always |
| fees | the Audit page's management fee schedule | always |
| carry | the Audit page's carried interest or incentive schedule | when the fund has carry or incentive |
| waterfall | Distributions through the waterfall | always (no rows when no distribution paid the GP) |
| property | Property and depreciation inputs | a real fund that holds a property, or a sample real estate fund |
| inv | Investments | always |

Checks: tb_zero, nav, sch_l, capital, closed. closed stays an exception until the books are closed through year-12-31.

Measured: fund A's package builds in 42 ms and kb-fund-ii's 2025 package in 461 ms (Node). The nine cases take about 6 s.

## What a CPA must confirm (C-07, plan 11-17)

1. The sheet layout and wording, and whether a preparer needs anything for the 1065 and the K-1s that is not here.
2. The Schedule L mapping. Accounts go to the chart's suggested lines. Line 21 carries the year's book net income, because the books keep no closing entry. The whole mortgage is on line 19b; any part due within a year belongs on line 16.
3. The Form 8825 line numbers: 2a rents, 7 insurance, 8 interest, 9 legal and professional, 10 taxes, 11 repairs, 12 utilities, 17 other. These follow the plan checker's reading of the Rev. December 2025 form. I could not read the form myself, and the older revision I know numbered these lines differently, so the CPA must confirm them against the form in use.
4. Fund-level 5100 and 5200 lines that carry no property are listed under 'Not assigned to a property'. Whether they are rental or portfolio deductions is the preparer's call.
5. Everything is a book figure. The cover's unrealized appreciation, accrued expenses and organizational costs are the book-to-tax items the preparer adjusts. Nothing in the package is a tax-basis or K-1 figure.
6. Ownership is the share of limited partners' capital at a month's end. The K-1's profit, loss and capital percentages are the preparer's.

## Deviations from Plan

1. **[Rule 1 - Bug] Three cover columns: Item, Value, Amount (money).** The plan had two, Item and Value. With two, the amounts would sit as cents in a text column, and the Audit page's CSV writer would print 9,000,000.00 as "900000000".
2. **[Rule 2 - Missing critical] Added `NS.books.packageCsv(sheet)`.** `NS.audit.toCsv` prints "NaN" for a text cell ('To be confirmed', 'At cost (no value entered)') in a money column, and audit.js is outside this plan's files. toCsv still accepts every sheet without throwing, as the interface requires, but 11-16 must write package CSVs with packageCsv. The workbook and PDF writers in filesout.js already write a text cell in a money column as text.
3. **[Rule 2] An 'Account name' column on f8825** (Property, Form 8825 line, Account, Account name, Amount), so the sheet stands alone.
4. **[Rule 2] 'Opening capital' events on the ownership sheet,** from 3900 lines that carry an investor. Without them, fund D's sheet (books start in 2026 with opening balances) would show no one's capital.
5. **[Rule 2] 'Not recorded' for what the portal has no record of.** This covers the revision, signature and backup withholding of a sample or legacy W-9 (taxCert `{ signed: true, source: 'sample' }`). Those cells read 'Not recorded', not blank, and are not counted as sponsor inputs on the cover. Inputs the sponsor must give read 'To be confirmed' and get a cover row: no form, no address, no taxpayer number, an unsigned form, no chapter 3 status, no foreign taxpayer number, an expired W-8.
6. **[Rule 2] Property cost and additions also count accounts 1400 and 1410** (land, buildings) when they carry the property, as well as 1100.
7. **[Rule 1] Sample funds' sales (red-3).** A property or investment held at the year's beginning and gone at its end gets a property row (cost and mortgage 0 at year end) and an inv 'Sale' row reading 'To be confirmed', with cover rows naming the gap.
8. **The check also loads withholding.js,** because `w8()` lives there (B1). books-pkg.js throws a plain sentence when withholding.js or onboarding.js is missing. 11-16 must load withholding.js with books-pkg.js; today only taxdocs-ui loads it, on demand.
9. **Interface case: the change log is seeded before the snapshot.** A freshly seeded sample workspace has no change log until the Audit page's first build seeds one (audit.js ensureLog, existing behaviour). So the case makes one sync and calls `NS.audit.ensureLog` before taking its "before" snapshot. After that, every read, the package included, leaves the workspace byte-identical.

Plan-check additions applied:
- B1: facts on the loaded copy in the persisted shape; read through taxOnFile and w8(); 'Chapter 3 status' column; treaty country only from a W-8BEN; validUntil 2029-12-31; fund-a.js untouched (routing '154003186' stays).
- B2: 'To be confirmed' cells and cover rows; case property's second property; case tax's copy without FA-1002's form; still 9 cases.
- W1: kind 'foreign' with its KINDS label.
- W2: numeric cells dropped on every sheet and all strings searched, over kb-fund-ii too; the search is proven to find '123456789', '000-12-3456' and '00-1234567'.
- W3: only 3000/3100 investor lines; 'req:' lines as Redemption; commitments x100.
- W4: 2000 split by whether the line carries an investor.
- W5: no product name, 'Powered by' or the forbidden word, in diy and managed.
- W6: sample real estate property sheets, asserted in t15 for all three.
- W7: NS.audit.period's 11 keys exactly.

## Open items for later plans

- 11-16: write package CSVs with `NS.books.packageCsv`; load withholding.js with books-pkg.js; head each file with the fund and the year (the Audit page's tb, gl and bankrec descriptions do not name the fund); set 'Signed tax forms included' to 'Yes' only on the sponsor's tick (C-04); keep the package's file names distinct from the Audit page's (both have an id 'property').
- 11-17: a CPA reads a sample package (above).

## Guide lines for the guide pass

None. This plan adds no screen; plan 11-16 adds the button.

## Commits

- b7c8d6d test(11-14): package check, case fund-a (RED: books-pkg.js does not exist)
- 1299dbd feat(11-14): books-pkg.js package(): cover, trial balance, ledger, bank rec, Schedule L balance sheet, roll-forward and checks
- 0720798 test(11-14): cases sheets, tax, own, dist, property (RED: the sheets do not exist yet)
- 73e05ad feat(11-14): every D-02 sheet: income and expenses by month, Form 8825 lines, ownership, tax details, distributions, fees, carry, waterfall, property inputs, investments
- a00db27 test(11-14): cases t15, interface, selfcheck (RED: a sample real estate fund that sold its property in 2025 gets an empty property sheet)
- 7f36a92 feat(11-14): a sample fund's property and investments held at the year's beginning are named when sold in the year

## Self-Check: PASSED

- FOUND assets/js/books-pkg.js, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/package.js
- FOUND all six commits above in HEAD; `git diff --name-only a999e49 HEAD` lists only those two files; fixtures/fund-a.js unchanged.
