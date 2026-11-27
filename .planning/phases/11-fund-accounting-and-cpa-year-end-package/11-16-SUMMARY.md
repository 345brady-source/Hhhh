---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 16
subsystem: books
tags: [cpa-package, workbook, pdf, zip, sha256, audit-page, c-04]
status: complete
requires:
  - phase: 11-14
    provides: NS.books.package(ws, o, year) and NS.books.packageCsv(sheet)
  - phase: 11-06
    provides: NS.files.pdf (the shipped PDF writer)
  - phase: 11-03
    provides: NS.files.workbook and NS.files.sheetName
provides:
  - NS.books.packageFiles(ws, o, year, { includeForms, actor, now, today, kit }) -> Promise<{ name, bytes, hash, files }>
  - NS.books.signedFormOf(ws, investor) (the stored signed W-9/W-8, by onboarding.js's rule)
  - the 'Year-end package' panel on the Audit page (NS.hooks.auditPanels), self-serve owners only
  - checks/package-files.js (PACKAGE FILES, 6 cases) and checks/package-flow.js (PACKAGE FLOW, 6 parts)
affects: [11-17, 16-02]
actuals:
  tokens: 21000   # chars/4 over the added lines of the hand-written files (84,108 chars); generated help files left out
  tasks: 3
  commits: 11     # git rev-list --count ad252a5..HEAD before this summary update's commit
plan_head_before: ad252a59831d05ce8abaaeb52c71252be485395b
plan_head_after: acbd6da
tech-stack:
  added: []
  patterns: [package files written in the browser from the same sheet objects the screen shows; scripts loaded on demand from beside books-pkg.js]
key-files:
  created: [.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/package-files.js, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/package-flow.js]
  modified: [assets/js/books-pkg.js, assets/js/console.js, diy.html, portal.html, server/help/guide.md, server/lib/help-guide.mjs, .planning/tools/preview/help-data.js, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/audit-flow.js]
key-decisions:
  - "B1: withholding.js loads on demand (NS.esignKit.loadScript, from beside books-pkg.js) when the panel first draws and again before a download; no extra script line on the pages, because phase 10's checks answer withholding.js 404 on diy.html"
  - "PDF Producer and Creator are set to the firm's legal name by reopening the writer's bytes (filesout.js would set the footer text there)"
  - "The plan's hand-worked trial balance total 556,500.00 is the total of debit balances (and of credit balances); the tab's Debits/Credits columns are the year's activity, 1,000,000.00 each. Both are asserted; the PDF's checks table prints the balances"
  - "The guide anchor must be in console.js (the file that registers console-audit, server test 'names on the screens'), so the one hook line carries it in a comment"
metrics:
  duration: about 3 h (05:34 to 08:40 UTC; most of it the gate, run twice)
  completed: 2026-11-27
---

# Phase 11 Plan 16: the CPA year-end package files, the button and the in-preview download proof Summary

One click on the Audit page now gives the fund's CPA a single zip: a README, a workbook with every sheet, a PDF of the cover, statements, trial balance, capital roll-forward and checks, one CSV per sheet, and a SHA-256 manifest. Everything is written in the browser with nothing fetched. The signed W-9 and W-8 files go in only when the sponsor ticks the box for that download. Every sheet can also be read on the page. Fund A's files agree with the ledger to the cent when read back by openpyxl, LibreOffice and pdftotext.

## Failures first

- **Gate run 2: `GATE_EXIT=1`.** Its only failure was `GATE FAIL AUDIT FLOW` (plan 11-12's check), part managed: `FAIL managed index.html and console.js (the menu) have no change since the base commit ad252a5 :: {"base":"ad252a59831d05ce8abaaeb52c71252be485395b","page":0,"console":1}`. That assertion failed any change to console.js; this plan must add exactly one line there (the auditPanels hook), and the menu is untouched. My own attempt to narrow it was refused by the permission checker, so I reported it.
  - **Orchestrator decision during 11-16** (11-CONTEXT, d0012a9): narrow the assertion; audit-flow.js joined this plan's scope for that change only. Done in acbd6da: index.html stays byte-checked; console.js passes when no added or removed line of `git diff -U0 <base> HEAD -- assets/js/console.js` (headers excluded) matches `/\bNAV(_SECTIONS)?\b/`; check text "the menu (NAV, NAV_SECTIONS lines of console.js)"; header comment updated.
  - Proof both ways (`node audit-flow.js --menu-selftest ad252a5 <scratch>`, real git diffs): `PASS menu-selftest RED: a console.js copy with one NAV_SECTIONS line added is reported :: ["+  NAV_SECTIONS.find((g) => g[0] === 'Report')[1].push('console-x');"]` and `PASS menu-selftest GREEN: this tree against ad252a5 changes 1 line of console.js, none of the menu`. The old assertion's RED on this tree is the run 2 failure above. In the browser: `PASS managed index.html and the menu (NAV, NAV_SECTIONS lines of console.js) have no change since the base commit ad252a5` / `AUDIT FLOW: PASS (parts run: 1)`.
  - **Gate run 3** (same GATE_OUT; the commit changed HEAD, so every step ran again, none kept): **`GATE_EXIT=0`**, 67 GATE ok lines, no GATE FAIL, EMAIL DIALOG (3) passed, server tests 472 = base 472.
- **Gate, run 1** stopped at the 2-hour background limit, while the reference gate's steps were waiting on browser slots that other agents held. The reference gate had passed (GATE_EXIT=0 inside it) and server tests were 472 = 472. Run 2 resumed into the same folder (33 steps kept, EMAIL DIALOG among them) and finished with the result above. The interrupted run left its server/node_modules link behind; I removed it by hand. It was never staged.
- **Check faults I found and fixed in my own checks:**
  1. The managed part of package-flow.js ran the leak search. That search flags "Carrow & Vale" on Carrow & Vale's own managed page, so the part now runs way out and quiet only, as books-flow.js does.
  2. button-phone first expected withholding.js to be fetched during the part. The console already had it on the page, from the page's own address. The part now reads the requests and the page's script elements together.
- **Task 2 verify, run 1:** the cases passed, but the plan's test that the output folder is empty failed. It found `.parts` (the store where lib.js keeps each part's result, which postdates the plan) and the Task 3 RED run's folder, which was running at the time. On the rerun only `.parts` was there, and it was excluded.
- **Process deviation:** the forms and change-log code went in with Task 1's commit, before Task 2's cases existed. RED 2 is those cases run against that code. They caught a real bug (the investor id was slugged to `FA_1001`).
- **Not proven, and the owner has not checked anything yet:**
  - Excel and Numbers opening the workbook (openpyxl and LibreOffice read it here).
  - Whether the Claude app on the iPhone saves a .zip from the preview. Every sheet can be read on the page either way.
  - The statement and sheet formats, which a CPA reads in plan 11-17.

## RED lines (each check written and seen failing before its code)

- red-1.txt (Task 1): `FAIL fund-a ran to the end :: Error: NS.books.packageFiles is not a function` / `PACKAGE FILES: FAIL (cases run: 1) - fund-a`
- red-2.txt (Task 2): `FAIL forms forms/FA-1001_W-9.pdf is in it, after the CSVs and before the manifest :: ["csv/13_Investments.csv","forms/FA_1001_W-9.pdf","MANIFEST.sha256"]`, `FAIL forms forms/FA-1001_W-9.pdf is byte for byte the stored signed copy B :: 0`, `FAIL forms the README says 'Signed tax forms included: Yes' and names FA-1002's form as not on this device` / `PACKAGE FILES: FAIL (cases run: 6) - forms`
- red-3.txt (Task 3): `FAIL button-phone the Audit page for fund A has the 'Year-end package' panel with its one line :: null`, `FAIL button-phone ran to the end :: frame.evaluate: TypeError: NS.books.package is not a function` ... / `PACKAGE FLOW: FAIL (parts run: 6) - button-phone, button-desktop, view, sample-phone, managed` (roles passed: nothing to see before the panel existed)

## Verify lines

- Task 1: `PACKAGE FILES: PASS (cases run: 1)` (exec-11-16/fund-a.txt)
- Task 2: `PACKAGE FILES: PASS (cases run: 6)`; checks-out holds only `.parts` (exec-11-16/files.txt)
- Task 3 pre-checks (scratchpad t16/verify3.sh: the plan's command plus B5, B6, B7, W3): red-3 has FAIL lines; index.html unchanged; console.js 1 line added, 0 removed; `anchor: Download year-end package`; `server/lib/help-guide.mjs is in sync`; `help-data.js: current (guide 1b45e3633563)`; `guide sponsor bytes base 44641 now 44766 growth 125`; the changed files are exactly files_modified plus help-data.js.
- Task 3 flow: `PACKAGE FLOW: PASS (parts run: 6)` (75 PASS lines, exec-11-16/flow.txt)
- help-guide server tests: `# pass 9`, `# fail 0`; all server tests in the gate: `# tests 472`, `# pass 472`, `# fail 0`
- Guide: GUIDE.sponsor 44,641 bytes before, 44,766 after: **+125** (cap 160)

## Gate (GATE_OUT=SCRATCH/exec-11-16, base-commit ad252a5), run 2 (before the AUDIT FLOW decision), last lines verbatim

```
GATE ok   base-server-tests (kept from 2026-11-27 08:05:03 UTC)
GATE ok   server tests 472 = base 472 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAX1099 FLOW
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE FAIL AUDIT FLOW
  audit-flow.js: the last line should be: AUDIT FLOW: PASS (parts run: 4)
  audit-flow.js: the last line was:       AUDIT FLOW: FAIL (parts run: 4) - managed
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK FLOW
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   BOOKS FLOW
GATE ok   BUSINESS DAYS
GATE ok   ENGINE BOOKS
GATE ok   HOLDINGS
GATE ok   NEW SCHEDULES
GATE ok   NO ONBOARDING
GATE ok   PACKAGE FILES
GATE ok   PACKAGE FLOW
GATE ok   PACKAGE
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE_EXIT=1
```

(71 GATE ok lines, 1 GATE FAIL; `GATE ok   EMAIL DIALOG (3) (kept from 2026-11-27 07:09:43 UTC)`; the base tree was removed by the gate; server/node_modules removed.)

## Gate run 3 (after the decision), last lines verbatim

```
GATE ok   server tests 472 = base 472 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAX1099 FLOW
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT FLOW
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK FLOW
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   BOOKS FLOW
GATE ok   BUSINESS DAYS
GATE ok   ENGINE BOOKS
GATE ok   HOLDINGS
GATE ok   NEW SCHEDULES
GATE ok   NO ONBOARDING
GATE ok   PACKAGE FILES
GATE ok   PACKAGE FLOW
GATE ok   PACKAGE
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE_EXIT=0
```

(67 GATE ok lines, 0 kept, no GATE FAIL; base tree and server/node_modules absent afterwards. Run 2 printed 71 because a resumed run also prints the kept sub-steps base-server-tests, record-base/plan and signing-base/plan.)

## What was built

- **packageFiles** (assets/js/books-pkg.js). Files, in order:
  - `00_README.txt`
  - `<Firm>_<Fund>_<year>_year_end.xlsx`: every sheet, one tab each
  - `<Firm>_<Fund>_<year>_year_end.pdf`: cover, statement of assets and liabilities, operations, changes in partners' capital, cash flows, schedule of investments, trial balance, capital roll-forward, package checks
  - `csv/<NN>_<Title>.csv`: one per sheet, written with packageCsv. The first line is one quoted cell, `"<Fund>, <year>: <title>. <desc>"`.
  - with the tick: `forms/<investor id>_<form>.<pdf|png|jpg>`
  - `MANIFEST.sha256`

  The zip is `<Firm>_<Fund>_<year>_year_end_package.zip`, and the export is logged as `Year-end package exported` with `<n> files; signed tax forms included (k) | not included; SHA-256 <hash>`.
  - Fund A's zip has 17 files, about 131 KB, and is written in 0.7 s under Node. Kestrel Bay Fund II's 2025 zip has 18 files, 253 KB, a 10-page PDF, and takes 0.8 s.
- **README:**
  - fund and tax year, who prepared it and when, currency, books closed through
  - the book-basis sentence
  - whether signed forms are inside, and each form not on this device
  - the contents, one line per file
  - each workbook tab name beside its full title (B3: three titles are longer than 31 characters)
  - how the sheets tie, and the checks
  - `shasum -a 256 -c MANIFEST.sha256`
  - "Prepared from the portal's records. Unaudited."
- **Signed forms (C-04, W1):** found by onboarding.js's rule. A form signed in the portal is the completed 'tax' envelope's `<id>-signed` copy, signed by this investor. An uploaded form is `taxCert.fileId` matching `^tax-<id>-[a-z0-9]+$`. The file type is read from the bytes. The cover says `Signed tax forms included`:
  - `Yes`, with the tick and at least one form inside
  - `No (none stored on this device)`, with the tick and no form inside
  - `No`, without the tick

  Each form this device does not hold gets a cover row and a README line: `Signed form not on this device: <id> <form>`.
- **The panel**, drawn through `NS.runHooks('auditPanels', w)`, for the fund chosen on the Audit page, only when `NS.EDITION.diy && NS.app.can('configure')`. It holds:
  - the title "Year-end package" and its one line
  - Year: the years the journal has entries in, newest first; the newest year before today is chosen
  - the tick "Include signed W-9 and W-8 forms"
  - the button "Download year-end package"
  - each sheet's name with "View". View draws the sheet under the list with the Audit page's table markup, at most 60 rows, then "Showing 60 of N rows. The file has every row."

  withholding.js and filesout.js load on demand from beside books-pkg.js. The download goes through `NS.ui.download(name, bytes, { mime: 'application/zip' })`.

### Lines added to shared files (exact)

- assets/js/console.js (console-audit render, after the 'Audit package' panel): `        ${NS.runHooks('auditPanels', w) /* the Year-end package panel, "Download year-end package" (books-pkg.js, self-serve owners only) */}`
- diy.html and portal.html, after the last script line: `  <script src="assets/js/books-pkg.js"></script>`
- server/help/guide.md, ## console-audit: `anchor: Download year-end package` and `5. Owners: "Download year-end package" gives the CPA one .zip for the "Year" (workbook, PDF, CSVs); "View" shows each sheet.`; help-guide.mjs and help-data.js regenerated.

### New shipped files

- assets/js/books-pkg.js is now on diy.html and portal.html; filesout.js and withholding.js load on demand from beside it. index.html is unchanged.

### The report builder's read interface, as finally proven (FA-11)

Plan 11-14's list (NS.audit.build / period / schedules, NS.books.package, NS.books.packageCsv, NS.ops.capital), plus NS.files.workbook(sheets) and NS.files.pdf(doc). Both are proven here on the package's own sheets, read back by openpyxl, LibreOffice and pdftotext.

## Plan-check additions applied

- B1: withholding.js on demand, both in the panel's first draw and in 'ye-dl' (ready test `NS.withholding.w8`). load11's extras put withholding.js before books-pkg.js. button-phone was RED without books-pkg.js.
- B2: CSVs `csv/<NN>_<Title>.csv`, written with packageCsv only, each headed by one quoted line. README, PDF title and footer, and the cover's first rows name the fund and year. No NaN in any CSV (fund A and kb-fund-ii). File counts are 4 + sheets, or 5 + sheets with one form. 'ye-view' looks sheets up by index.
- B3: tabs are compared with NS.files.sheetName's own names, and the README lists each tab beside its title.
- B4, with the orchestrator's never-issued numbers: the stand-in W-9 bytes hold '000-65-1234' and '000651234'. Both appear only in forms/FA-1001_W-9.pdf. They are in no other file:
  - README, MANIFEST, CSVs
  - workbook (zip and XML)
  - PDF (bytes, text and metadata)
  - the workspace, the change log, the stored workspace, the return value
  - in button-desktop: the page's text and markup, and localStorage

  Without the tick, nothing in the zip holds them.
- B5: the PACKAGE grep accepts the "(kept from ...)" form. B6: help-data.js regenerated, and both generators pass `--verify`. B7: +125 bytes.
- W1: as above. W2: no product name, 'Powered by', 'pdf-lib', 'fontkit' or the forbidden word in any text of the zip, in both editions; Producer and Creator are 'Fund A Sponsor Management, LLC'. W3: the file list is checked. W4: no policy violation; withholding.js, filesout.js, write.js, fonts.js and text-regular.js came from the page's origin. W5: `(NS.hooks.auditPanels = NS.hooks.auditPanels || []).push(panelHTML)`.

## Deviations from Plan

1. **[Rule 1] Trial balance figure.** As stated in the key decisions. The plan's "Debits 556500.0 and Credits 556500.0" are the debit and credit balances, not the tab's Debits and Credits columns (the year's activity, 1,000,000.00 each). Both are asserted in fund-a and libre. The PDF's text holds '$556,500.00' through the checks table's "Debit balances $556,500.00; credit balances $556,500.00."
2. **[Rule 2] Producer and Creator.** filesout.js sets them to the footer, so packageFiles reopens the PDF and sets both to the firm's legal name (white label).
3. **[Rule 3] The guide anchor in a comment on the console.js hook line.** The server test needs the anchor text in the file that registers console-audit.
4. **[Rule 2] packageCsv-headed CSVs and `package().build`.** package() also returns the Audit page's build, as a non-enumerable property, so the PDF's statements are not built twice. Its JSON is unchanged, and PACKAGE (9 cases) still passes.
5. **Task 2 folder test** excludes lib.js's `.parts` store.
6. **Signed form names** keep the investor id as recorded (`FA-1001`).

## Known stubs

None.

## Threat flags

None beyond the plan's register. The only new file that leaves the portal is the zip, by the owner's click. Signed forms go in only by the tick.

## For the owner's check (human-check of Task 3)

Screens are in SCRATCH/exec-11-16/shots with index.txt (5 screenshots: the panel on a phone, desktop with the tick after the download, Investor tax details and the Schedule L balance sheet viewed on a phone, Kestrel Bay Fund II 2025 on a phone). On the iPhone: Audit, a sample fund, the last year; tap "Download year-end package"; then "View" on three sheets.

## Commits

- d534f4b test(11-16): package files check, case fund-a (RED: NS.books.packageFiles does not exist)
- e84656c feat(11-16): NS.books.packageFiles: README, workbook, PDF, one CSV per sheet and a SHA-256 manifest in one zip
- e3ee859 wip(11-16): save
- 49202f8 test(11-16): cases forms, libre, sample, logged, selfcheck (RED: a signed form was named forms/FA_1001_W-9.pdf); fix the name
- a818f82 wip(11-16): save
- 9c372c8 wip(11-16): save
- ffb6ef1 feat(11-16): the Year-end package panel on the Audit page: year, signed-forms tick, download, every sheet viewable
- c7e6e2d test(11-16): button-phone accepts withholding.js already on the page from the page's own address
- ea64e33 wip(11-16): save
- a54638a docs(11-16): summary (gate run 2)
- acbd6da test(11-16): AUDIT FLOW managed checks the menu lines of console.js (NAV, NAV_SECTIONS), not every line

## Self-Check

- FOUND assets/js/books-pkg.js, checks/package-files.js, checks/package-flow.js; every commit above is in HEAD; server/node_modules absent; base tree removed.
- Self-Check: PASSED. The done criterion is met on gate run 3 (GATE_EXIT=0); the owner has not checked anything yet.
