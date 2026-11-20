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

## After 11-04 (merged 2026-11-19)
- gate11.sh: later plans add a check by dropping `<name>.js` in this phase's checks folder with `// gate: node` (or `browser`) and `// last "<exact last line>"` in its first lines; helpers carry `// gate: none`; a new server test file declares `// gate: tests N`. Run as `GATE_OUT=<folder with base-commit.txt> bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh`. A direct AUDIT SAME run needs the base's diy.html as well as assets/js.
- AUDIT SAME passed on its base: 928 schedules and 60 whole packages over 15 funds byte-identical; a one-cent change is caught.
- The MEASURE failure it reported (the leak search on taxdocs.js line 531) was the IRS Rev. Proc. 2012-17 section 5.08 wording, now on the leak check's allowed list with the reason; the leak search passes on the merged tree. Its EMAIL DIALOG failure passed when run again alone (timing under the shared queue).
- From 10-01 (merged): one sample fund's current holders change (pb-long-short: a fully redeemed investor no longer counts after the redemption date). A gate whose base predates 10-01 sees that fund differ; gates based on the merged tree do not.

## Plan-check additions, wave 2 (11-05, 11-06; checked 2026-11-19 against 7b560df; 1 blocker fixed here, 5 warnings). Executors apply these with their plan.
- B1 (blocker, 11-05): `desired` returns entries sorted by date, then by src. Case fund-a compares `desired` with `fixture.recordEntries` sorted the same way (date, then src) on src, date and lines; memos are not compared. The fixture file is not edited.
- W1 (11-05): `sync` calls `NS.clearCaches()` (when it exists) before it reads `desired`. Cases closed and open-change edit the records, then call sync, and must fail if the clear is removed: one extra run of each case with the clear stubbed out reports a FAIL (kept in the output folder).
- W2 (11-05): `desired` throws when `opts.today` is given and differs from `NS.dates.today()`; runs are taken from the engine's `L.dists` (grouped by run), with `runLines` used only for the withheld and net amounts, so the journal and the engine count the same events.
- W3 (11-05): a stray line (in `L.strays`) is posted to 3100 with its investor id and listed in `fund.exceptions` as `{ src, kind: 'stray', investorId, cents }`; case samples compares only investors in `L.invs` and prints the number of strays per firm.
- W4 (11-05): case `redeem` with fund B (an open-ended fund): investor B-1 position 100,000.00 dated 2026-01-31 gives `pos:B-1:2026-01-31:0` [1000 +10,000,000][3000 -10,000,000 B-1]; a partial redemption of 2,000.00 at dealing date 2026-06-30, paid 2026-07-10 with paidCents 200,000, gives `req:` [3100 +200,000 B-1][2200 -200,000] and `reqpaid:` [2200 +200,000][1000 -200,000 B-1]; 2200 ends at 0. When paidCents is more than the engine's redemption cents, `reqpaid` posts the engine's cents and the difference is listed in `fund.exceptions`. Keep the case count at 12 by folding selfcheck's two child runs into case selfcheck; if not possible the count becomes 13 and every marker and verify says 13.
- I2 (11-05): `pos:` keys count only positions with amount > 0, so deleting a zero position does not renumber the others; I3: sync compares stored lines with desired lines after books.js's `compact()`; I1: memos follow the fixture's shape; say so in the summary.
- W5 (11-06): case pages counts with `/\bRow k\b/g` and prints the counts for Row 1, Row 150 and Row 300.
- I4 (11-06): negatives are written in parentheses inside `NS.files.pdf` (audit.display writes "−$"); case formats checks "($4,500.00)"; the total row may be regular weight (unicodeFont gives the regular font only).

## Plan-check additions, wave 3 (11-07, 11-08; checked 2026-11-19 against 9e2c45e and origin/wip/11-05; 2 blockers fixed here, 4 warnings). Executors apply these with their plan. Wave 3 starts only after 11-05 is merged with its summary.
- B1 (blocker, 11-08, Task 1): case fund-a posts every entry of `fixture.entries` whose src starts with `mark:` directly with `NS.books.post`, then syncs. The `bank:` entries of `fixture.entries` are never posted; the bank decisions in this case produce them. Cases twice, check-clears, sale, full-sale, uncategorize and refusals start from the books case fund-a leaves. Without the marks, 1150 for fa-x is 0 and the sale entries cannot come out.
- B2 (blocker, 11-07, audit.js `ledger`): for a fund that is not a sample fund (`!generated(o)`), the cache key also includes the fund's journal length: `(ws.books && ws.books.funds && ws.books.funds[o.id] && ws.books.funds[o.id].journal || []).length`. The journal is append-only, so reversals change it too. Case fund-a reads `NS.audit.period` once before and once after posting `mark:fa-m2`, and must see December's gain change by 3,000,000 without calling `NS.clearCaches()`. Shown RED before the key change.
- W1 (11-07, Task 3): case selfcheck also asserts that each of index.html, diy.html and portal.html lists `assets/js/books.js` then `assets/js/books-post.js`, each exactly once, on the two lines directly after the operations.js line. At the base tree this finds 0 matches, which is the RED for `red-3.txt`.
- W2 (11-08, `candidates` ranking): a candidate's `partner` is the cash line's partner, or, when that is empty, the partner of the entry's only 3000/3100 line. 11-05 posts call payments as [1000 +][3000 − investor], so the cash line has no investor. Ranking compares the bank text with that id.
- W3 (11-08, `categorize` kind 'sale'): u is computed with BigInt, half-up with the sign handled: `Number((2n*B1150*BigInt(cost) + B1100) / (2n*B1100))` on absolute values, then the sign put back. The refusals case adds one line with 1100 = 3e12, 1150 = 1e12 + 1 and cost 1e12, and checks it against the BigInt value.
- W4 (both): use 11-05's real signatures, not "see their interfaces blocks": `NS.books.desired(ws, o, {today})` returns entries sorted by date, then src; `NS.books.sync(ws, {today, by})`. `plan()` reads `NS.audit.ledger(ws, o)` for `L.contribs` (`{inv, call, date, cents, kind}`), `L.dists`, `L.strays`, `L.redemptions`, `L.keys` and `L.byKey[k].fee` / `.gpOut`. In 11-07, `events().contribs` keeps exactly the `{inv, call, date, cents, kind}` shape of `L.contribs`, and only the contributions source inside `plan()` changes. 11-05-SUMMARY.md is read from the merged tree.
- I1 (11-07): `plan()` still reads `NS.audit.ledger` for fees, GP entries, distributions and redemptions. There is no loop in the values because 5000, 2100, 2600 and 3300 are left out of the income and gain reads. The summary says this rather than "posting never waits on the books it posts to".

## After 11-05, 11-06, 11-08 (merged a2f6106, 9cec992 and the 11-08 merge, 2026-11-20)
- Shared-code bug, not fixed yet: `NS.ops.businessDays(s, n)` returns `s` itself when n is negative (assets/js/operations.js lines 28-36). `seedCalls` (operations.js line 540, `businessDays(c[0], -10)`) therefore gives seeded sample calls a notice date equal to their due date. books-bank.js counts back on its own. A fix changes the sample data AUDIT SAME compares, so it gets its own small plan, with AUDIT SAME's expected data regenerated and the change named.
- 11-15 (the bank screen) must handle a fund whose first imported statement starts after its books begin. Under the 11-08 formula, every unmatched cash line since the books began counts as outstanding, so the difference can never reach zero. 11-15 takes an opening reconciled balance at the first statement's start date (stored with who entered it), or counts outstanding items only from the first statement on. It says which and tests it.
- A match can go stale. When sync re-posts a matched record (a changed distribution in an open period), the match stays on the reversed entry. The difference is still right, but 11-15 offers to move the match to the new entry. 11-08 added `unmatch(ws, offeringId, lineId)` for that.
- books-bank.js ships after books.js, books-post.js and bankfiles.js when 11-15's screen loads it. Stored line ids are `'<account id>:' + reader id`.
- filesout.js `NS.files.pdf` (11-06) prints sheets that are too wide in parts ("part k of K"), repeating the investor id and name. Producer and Creator are set to the firm's name. Money that is not whole cents throws.
- Fees for a real fund use the engine's default rate until 11-07 lands.

## After 11-07 (merged 2026-11-20)
- A real fund's capital accounts now come from its journal (income, gains, fees and carry), with the cache keyed on journal length (B2). The three pages load books.js and books-post.js after operations.js.
- Still invented for a real fund: holdings, cash and bank references come from weights until 11-11. Two engine rules can still put a figure that is not in the journal into a real fund's capital: the exit true-up (the exit month's gain is forced so capital equals accrued carry) and the floor at zero when a loss exceeds capital. A later plan must take both from the journal, or show them as adjustments the sponsor posts.
- AUDIT SAME and ENGINE BOOKS case terms need P11_ROOT (the base tree); run them through gate11.sh, not alone.
- events() also returns strays. A real fund gets no generated side-pocket return.

## Plan-check additions, wave 4 (11-09, 11-10, 11-11; checked 2026-11-20 against c8b65e7; 1 blocker fixed here, 6 warnings). Executors apply these with their plan. Findings: scratchpad checks-11-wave4.md.
- B1 (blocker, 11-09 Task 1 step 2): in assets/js/books-post.js line 59, `MANAGED` becomes `/^(call|pos|run|req|reqpaid|fee|gp|sim):/`, and `sim:` comes out of the line-58 comment ("never touched"). Without this, every sync posts every sim entry again and never reverses a stale one. Case `repeat` is the RED.
- W1 (11-09 interfaces, the balance-sheet target): subtract the balance of every live, non-reversed journal entry of the fund dated on or before endOf(k), except `sim:` entries for month k and later. Not only desired entries: an edited sample firm can hold `mark:`, `bank:`, `man:` or `open:` entries. Case `edit` adds a `man:` entry.
- W2 (11-11 Task 1): the signature becomes `holdingsAt(L, k, ws)` (audit.js:547), with `ws` passed from `period` (audit.js:678). Sample funds ignore it.
- W3 (11-11 Task 2, runEvidence): for `!generated(o)`, `file = run.file || ''` (audit.js:745 must not invent `${slug}_${date}_A.ach`). Case `refs` adds a run that is not a console run and expects 'No file'.
- W4 (11-11 Task 2, the 'books' check): when last4 is empty (books-bank.js:88), print '<name>: not reconciled through <period end>.'
- W5 (11-11 with 11-09): `build` calls `NS.books.sync(ws)` only when `!NS.audit.generated(o)`. Print the measured AUDIT SAME time in the summary. Merge 11-09 before 11-11; one gate on the merged tree after both.
- W6 (11-10 Task 1, value()): refuse a value dated before the holding's latest mark ("A later value exists (<date>); enter values in date order."). Case `refusals` adds it.
- Line numbers in 11-10 and 11-11 are from 993e568 (redemptionAmount is now operations.js:281, build is audit.js:1549); find by name.
- 11-11's statement labels rest on C-01, which no CPA has confirmed. Its summary says "statement format per C-01, assumption recorded; CPA read pending (C-07)".
- The businessDays fix is a separate small plan after 11-10 merges (11-10's verify requires exactly one change hunk in operations.js). It moves seeded calls' notice dates (operations.js:564), so AUDIT SAME needs an expected-difference list built from the base, naming only the 'Capital call issued' change-log rows (audit.js:926) and their MANIFEST lines. Every other byte stays identical, so a one-cent change is still caught. Also fix the comment at books-bank.js:62.
- Parallel: 11-09 (books-post.js), 11-10 (books-hold.js, operations.js redemptionAmount only) and 11-11 (audit.js) share no file.

## After 11-09 (merged 2026-11-20)
- All 15 sample funds post sample entries (sim:<fund>:<month>) to the journal, and each of 743 fund-month-ends ties to the Audit page to the cent. A second sync posts nothing.
- Known limit: an expense or income entered by hand in a sample fund leaves that month and every later month out of the sample entries (listed in desired().unbalanced and fund.exceptions as kind 'unbalanced'). No balancing line is ever forced. Entries that only move the balance sheet tie fully. Sample funds are demonstration data, so this stays listed, not fixed.
- Sizes: the four sample workspaces measure 758,989 bytes together (books 104-179 KB per firm). Sync on the largest takes 119-205 ms the first time and 64-94 ms after (Node).
- Browser storage in the iPhone preview is not measured (assumed about 5 MB).

## After 11-10 (merged 2026-11-20)
- The gate stopped at the 2-hour background limit under queue congestion; resumed into the same folder (exec-11-10), every step passed: 41 GATE ok lines, GATE_EXIT=0 (server tests 368 at its base; 403 on the merged tree, all pass).
- Next: plan checks for 11-12..11-16 and the businessDays fix plan.
