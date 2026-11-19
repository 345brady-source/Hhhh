# Phase 11: Fund accounting and the CPA year-end package - Context

## Decisions (owner, 2026-11-16, from 01.4-RESUME "Roadmap additions" and "CPA year-end tax package")
- D-01: full fund accounting: general ledger, trial balance, management fees and expenses, NAV for open-ended funds, bank reconciliation, GAAP financial statements. Built before the report builder, which reads from it.
- D-02: the CPA year-end tax package is built as part of this phase (owner: "or while we add fund accounting"): one click gives the sponsor's CPA everything needed to prepare the K-1s and 1099s: investor tax details from the W-9/W-8, ownership and its changes with dates, capital roll-forwards, distributions by type, fees and waterfall results, trial balance, general ledger, income and expenses, property and depreciation inputs; spreadsheet plus PDF.
- D-03: a CPA partner who receives these packages from sponsors who opt in is being looked into (phase 10 D-05); the package must be usable by any CPA without the portal.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; no budget for monthly fees, so a $0 path comes first); white label; lean screens; .planning/AUTOPILOT.md conditions. The preview runs with no server: everything must work from the browser's own storage.

## Questions the research must answer
- What already exists: the audit engine (assets/js/audit.js: capital accounts, schedules, checks, change log, zip), operations.js (calls, distributions, requests), waterfalls, share classes, currencies, fund types. What is a real ledger there and what is derived on the fly.
- The smallest ledger design that makes D-01 true for the fund types the portal supports (closed-end real estate and private equity first, open-ended with NAV), with double entry that every existing money event posts to, so nothing is entered twice.
- Bank reconciliation at $0: statement file upload (which formats banks give: CSV, OFX, BAI2) and matching; no paid bank feed.
- GAAP statements a small private fund actually issues (statement of assets and liabilities, operations, changes in partners' capital, cash flows, schedule of investments) and what a CPA expects in a tax package for a partnership return.
- Outside services and libraries with real prices and licences; which are worth it against in-house.
- How to prove the numbers: tie-outs against the existing audit engine and hand-worked examples.

## Research findings the plans must fix (2026-11-19, 11-RESEARCH.md; defects in the portal today)
- F-1: a real firm's Audit page shows figures nobody entered (gains from a seeded generator, a default-rate management fee, cash as a balancing figure, invented check numbers). After this phase a real fund shows only recorded figures; sample funds keep their generated data (FA-03).
- F-2: a distribution recorded for a future date never becomes paid (status is set once when recorded, `console.js` `dist-record`), so it never reaches the capital accounts (FA-14). Fixed in this phase's first wave.
- F-3: carried interest paid with a distribution (`run.gp`) is deducted from nobody's capital (FA-14).

## Orchestrator choices (2026-11-19; the owner was told by push and may override any of them)
- C-01: one statement format for every fund type (the investment-company format); property stays at cost until the sponsor enters a value; the CPA package carries cost, the land and building split and the placed-in-service date. A cost-basis set with book depreciation is not built now. Why: $0, no extra build, and the statement formats could not be read from the standards (those sites are blocked), so a CPA must confirm them before a second format is built.
- C-02: the PDF writer the signing step already uses is shipped inside the repository (two files, 1.28 MB, both MIT) and no longer fetched from a CDN. Why: the owner's preview has no network; a fetched library fails there.
- C-03: bank reconciliation by statement file upload only. Why: $0 and it works in the preview; a bank data service needs a server, keys and a monthly cost. Revisit with the NACHA step.
- C-04: signed W-9 and W-8 files go into the CPA package only when the sponsor ticks a box for that export. Why: they are the only place full taxpayer numbers exist; nothing sensitive leaves by default.
- C-05: F-2 (a scheduled distribution becoming paid) is fixed in phase 10's distribution-record plan, which also stores each investor's amounts on the distribution; phase 11's plans depend on that plan and do not edit the same lines. F-3 (the GP's share) is fixed here, in the posting to the journal. Why: phase 10 needs stored per-investor amounts in the very lines F-2 lives in; one plan owns them.
- C-06: no trial-balance upload for sponsors who keep books elsewhere. Why: not needed for D-01 or D-02; about one more plan; can be added later.
- C-07: a CPA reads one sample package before the package is called ready (owner item).
- C-08: real firms' Audit pages change when this ships: generated gains, fees and cash disappear and only recorded figures show, with one line naming each missing input. Why: the current figures are invented, which is wrong for a real fund.
- Not confirmed by the research (blocked sites): the accounting standards' own text, real audited fund statements, vendor prices, the older bank file layout, Excel/Numbers opening the workbook, saving files from the iPhone preview. Each plan that depends on one of these says so and proves what it can.

## From phase 10's plan check (2026-11-19)
- The audit engine's bank evidence (the "Distribution reconciliation to bank records" schedule) stays at gross after 10-01, while the ACH file pays net once tax is withheld (10-07). This phase's bank work compares like with like: net paid against the bank, tax withheld as a liability.
- `holdersAt` ignoring fully redeemed positions is traced and, if confirmed, fixed in 10-01 (its addition A8); this phase's tie-outs assume the fixed behaviour.

## Plan-check additions, wave 1 (executors apply these with their plan; checked 2026-11-19 against 2163866; 1 blocker fixed here, 7 warnings)

### 11-01 (journal core)
- I4: `check()` requires `Number.isSafeInteger` for every amount (not only `Number.isInteger`), so a hand-edited workspace cannot hold 1e300.

### 11-02 (bank files)
- W1: case `bai2-bad` also reads three more copies of fund-a.bai, built inside the case from its text: the 49 record count +1, the 98 control total +1 cent, and the 99 record count +1. Each throws a sentence naming its trailer ("account", "group", "file"), and nothing is returned.
- W2: `fixtures/bank/real/LICENSE` holds the full Apache License 2.0 text, copied from `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/r11/license/LICENSE-2.0.txt` (fetched by the orchestrator from apache.org, 11,358 bytes, 202 lines). SOURCE.txt names the project, the original paths, the copyright holder from the moov-io repository and the two SHA-256 values.
- I2: `LIMITS.bytes` counts UTF-8 bytes; say so in the module.
- I3: duplicate-import detection belongs to 11-08; this plan gives stable ids only.

### 11-03 (workbook writer)
- B1 (blocker): case `libre` converts with `timeout 120 soffice --headless -env:UserInstallation=file://<tmp>/lo --convert-to 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1' --outdir <tmp> <file>` (the last field, -1, writes one CSV per sheet; `false` at position 9 writes raw values, not as shown). Expected: the Trial balance CSV's row 2 holds 32000 in column B, and its total row (row 5) holds exactly 32001.23 and 7500.01. The large sheet's last line holds 20010. If LibreOffice writes the values another way, the executor records the exact output in the summary and compares with what the hand-worked sheet says. The expected values are never loosened.
- W3: case `selfcheck` (or a new part counted in the seven) asserts that `assets/js/filesout.js` contains none of: `fetch(`, `XMLHttpRequest`, `import(`, `require(`, `new Worker`, `createElement('script')`, `http://`, `https://` (the parts' XML namespace strings are the only exceptions, listed by value). Byte conversion uses its own UTF-8 encoder (`NS.audit` exports only zip, crc32 and sha256). Plan 11-16 owns the in-preview download proof.

### 11-04 (gate11 and AUDIT SAME)
- W4: audit-same also calls `NS.audit.exportPackage` on a deep copy of each side's workspace (Date fixed by load11, a download stub if needed), unzips it in the check and requires every entry to be byte-identical between base and tree, except entries for schedules the base does not have, the "Generated:" line of 00_README.txt, and the MANIFEST lines for those entries. If exportPackage cannot run in the vm, call readme through the same path the export uses, or record why in the summary as a deviation.
- W5: gate11 step 3 also sets `P10_ROOT` to the root of the base tree the reference step extracted, as phase 10's `dist-record.js` case `sample` expects (10-CONTEXT A3). The self-test control proves the variable is passed.
- W6: load11.js reads `<root>/diy.html` at run time and takes the `src="assets/js/..."` entries in order, from edition.js through operations.js, plus any phase 11 module listed between them; never a list typed into the file. The base side reads the base tree's diy.html, the tree side its own.
- W7: case `mutate`: when the run has stored lines (after 10-01), add one cent to the first line's grossCents and netCents and to the run's total together; otherwise add one cent to the amount. Call `NS.clearCaches()` when it exists before building. Either way the case must report the mismatch.
- I1: case `same` is run twice on one side and requires equal hashes (proves the comparison is stable).
