# Phase 11: Fund accounting and the CPA year-end package - Research

**Researched:** 2026-11-19
**Domain:** double-entry fund ledger in the browser, bank statement files, investment-partnership financial statements, Form 1065 inputs, spreadsheet and PDF files written without a server
**Confidence:** HIGH for what the portal holds today and what it derives (files read and run this session). HIGH for the Form 1065 material (IRS files read). LOW for the GAAP statement formats (no accounting-standards source could be opened) and for every outside price (search summaries only).

## What could not be established (read this first)

1. **No accounting-standards text was read.** `asc.fasb.org`, `www.fasb.org`, `www.aicpa-cima.com`, `kpmg.com`, `www.cohnreznick.com`, `www.pwc.com`, `viewpoint.pwc.com`, `dart.deloitte.com`, `www.ey.com` are outside this session's allowed network (proxy answered 403 to CONNECT; WebFetch answered ENOTFOUND). Everything below about FASB ASC 946, ASC 230 and the AICPA guide is from training knowledge or from a search engine's summary of illustrative statements, and is tagged that way. The statement captions proposed here are the ones the portal already prints plus those summaries; **a CPA has to confirm the formats before launch.**
2. **No real audited fund statements were obtained as a model.** `www.sec.gov` answered once and then returned 503 and a timeout; the attempt was dropped.
3. **No outside price was read from a vendor's own page.** Plaid, Teller, Stripe, QuickBooks and every fund-accounting product: search summaries only. Plaid publishes no price list at all. Juniper Square, Carta, Agora, Covercy: no price found.
4. **No bank's own export page was read, and neither file-format specification was read** (`www.ofx.net`, `www.bai.org`, `www.x9.org` unreachable). What is verified: one real OFX 2 sample file and two real BAI2 sample files from open-source projects on `raw.githubusercontent.com`. The older OFX 1 layout (the one most bank downloads use) is described from training knowledge.
5. **The spreadsheet file was proven in two readers, not in Excel or on an iPhone.** A workbook built with the portal's own zip writer opened correctly in openpyxl 3.1.5 and LibreOffice 24.2.7.2 (run this session). Microsoft Excel and Apple Numbers are not on this machine. Whether the Claude app on the iPhone will save an `.xlsx`, `.pdf` or `.zip` from the preview is also unproven: the existing code renames `.ach` to `.txt` for that host (console.js:1309), which suggests it is particular about file types.
6. **The browser's storage limit inside the iPhone preview frame was not measured.** Sizes of today's records were measured (below); the limit itself is assumed to be about 5 MB.
7. **Package download counts could not be read**, so the package check rated every library "suspicious: unknown downloads". No new package is recommended for install, so nothing depends on it.
8. **Tax treatment is not decided here.** Which Schedule K line an amount belongs on, whether a management fee is a guaranteed payment, tax depreciation, tax-basis capital: the CPA decides. The package carries book figures and the inputs.

Hosts to allow for a follow-up pass: `asc.fasb.org`, `kpmg.com`, `www.cohnreznick.com`, `www.aicpa-cima.com`, `www.ofx.net`, `teller.io`, `plaid.com`, `stripe.com`.

## Defects found in what exists (they shape this phase)

These were found by reading and running the code. They are in the portal today, before any phase 11 work.

1. **For a firm that is not a sample firm, the Audit page reports figures nobody entered.** Run this session (`SCRATCH/r11/spike/custom.js`): a new firm, one real estate offering, two investors who contributed $100,000 and $300,000, nothing else recorded. For fiscal 2025 the engine reported a loss on investments of $20,805.98, management fees of $6,000.00 (a 1.5% default nobody set), investments at a fair value of $362,483.20, cash of $11,210.82 and a fee payable of $500.00. The cause: gains and income come from a seeded random generator (audit.js:218-235), the fee rate falls back to the fund type's default (audit.js:59-70, 99), holdings values are net assets times a weight (audit.js:459-466) and cash is whatever makes the balance sheet balance (audit.js:499). [VERIFIED: files read; probe run]
2. **Bank references are invented.** For the same firm, a distribution paid by check showed "Check 38830" and "Check 15414" in the capital activity schedule. The numbers come from a hash (audit.js:648); ACH trace numbers come from a counter (audit.js:646). The schedule is titled "Distribution reconciliation to bank records". [VERIFIED: probe run]
3. **A distribution recorded for a future date never becomes paid.** The status is set once when it is recorded (`status: d.date > today() ? 'scheduled' : 'paid'`, console.js:1321) and nothing changes it afterwards. Every use of `'scheduled'` in `assets/js`: console.js:1045, 1321, 1328; data.js:274, 530, 595; portal.js:774, 828: two writers, six readers, no transition. The capital accounts read only paid runs (audit.js:199). The date field's minimum is today and the bank needs files one or two banking days ahead (console.js:1201), so the normal case is a future date: such a distribution stays "Scheduled" for the investor and is never deducted from capital. [VERIFIED: grep of the directory, lines read]
4. **Carried interest paid with a distribution leaves nobody's capital.** A run stores `gp` and `gross` (console.js:1321). The engine uses `gp` only as "already paid to the GP" inside the waterfall (audit.js:279-286); the distributions list holds investor rows only (audit.js:197-206). With a real cash account the cash goes down by the gross amount, so capital and net assets will disagree until the engine records the GP's part as a GP distribution. [VERIFIED: files read]

Items 1 and 2 are what this phase replaces. Items 3 and 4 must be fixed before or with the ledger, or the ledger inherits them. The orchestrator may want item 3 fixed now as a small debug task: it affects the owner's own tests of distributions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: full fund accounting: general ledger, trial balance, management fees and expenses, NAV for open-ended funds, bank reconciliation, GAAP financial statements. Built before the report builder, which reads from it.
- D-02: the CPA year-end tax package is built as part of this phase (owner: "or while we add fund accounting"): one click gives the sponsor's CPA everything needed to prepare the K-1s and 1099s: investor tax details from the W-9/W-8, ownership and its changes with dates, capital roll-forwards, distributions by type, fees and waterfall results, trial balance, general ledger, income and expenses, property and depreciation inputs; spreadsheet plus PDF.
- D-03: a CPA partner who receives these packages from sponsors who opt in is being looked into (phase 10 D-05); the package must be usable by any CPA without the portal.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; no budget for monthly fees, so a $0 path comes first); white label; lean screens; .planning/AUTOPILOT.md conditions. The preview runs with no server: everything must work from the browser's own storage.

### Claude's Discretion
CONTEXT.md has no such section. Everything not fixed above (ledger shape, module layout, where screens sit, plan split) is recommended below.

### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md has no such section. Out of scope by standing decisions: the report builder itself (launch item 7; only its interface is defined here), preparing K-1s or 1099s (phase 10), moving money and bank connections (launch item 11), the in-house reader (D-33), transfers of interests (conditional item in 01.4-RESUME).
</user_constraints>

## Summary

The portal already has half of fund accounting, and it is the hard half: capital accounts per investor to the cent, share classes, fee steps, waterfalls, high-water marks, side pockets, redemptions at NAV, the schedules an auditor asks for, a tamper-evident change log, a zip writer and a SHA-256 routine. What it does not have is books. Contributions, distributions and redemptions are real stored records; everything else on the Audit page (income, gains, valuations, cash, fees paid, bank references) is generated, for sample firms and real firms alike. The console says so itself: "Valuations and holdings come from the fund’s books once investors are in; until then the offering carries a placeholder portfolio line." (console.js:2622). Phase 11 is those books.

The smallest design that makes D-01 true: **one journal per fund, in whole cents, where every line is a debit or a credit and every entry sums to zero.** One posting function reads the records the portal already keeps (call payments, funded subscriptions, paid distributions, redemptions, the monthly fee the engine already computes) and writes one entry per record, once, keyed by the record's id. The sponsor's only new entry work is (1) uploading a bank statement file and choosing an account for the lines the portal could not match, (2) a fair value per investment at period end, (3) for a fund that existed before, its opening balances once. The existing capital-account engine stays and stops inventing: it takes each month's income and gains from the journal instead of the generator. The existing Audit page then shows real statements, and gains a trial balance, general ledger, cash flows and bank reconciliation. The CPA package is one more button on that page.

Nothing here needs a paid service or a new library. Spreadsheets: a small in-house writer over the zip writer the repository already ships (proven this session). PDFs: the writer the signing step already uses, shipped as a file instead of fetched from a CDN. Bank files: text parsers written in-house against fixtures.

**Primary recommendation:** Build a pure `books.js` (journal, chart, posting from existing records, trial balance, period close) and prove it against the engine's own capital accounts and two hand-worked funds before any screen exists; then re-point the audit engine at it with a regression check that every sample firm's audit package stays identical to the cent; then one Accounting page (bank, journal, valuations, close) and the package button.

<phase_requirements>
## Phase Requirements

ROADMAP.md gives phase 11 no requirement ids ("set by the planner after research"). Proposed, derived from D-01 to D-03 and the carried conditions; rename freely.

| ID | Description | Research support |
|----|-------------|------------------|
| FA-01 | Each fund has one double-entry journal in whole cents. Every entry balances. A chart of accounts comes from a template for the fund type. Trial balance and general ledger for any period. Browser storage only. | "The ledger", "Storage" |
| FA-02 | Every money event the portal already records posts exactly one entry, once, from the stored record: call payment, funded subscription, paid distribution (investors and GP), redemption at the dealing date and its payment, the monthly management fee. History already in a workspace is posted the same way. The sponsor enters none of it again. | "Posting rules", "What exists today" |
| FA-03 | For a fund that is not a sample fund, no figure on any statement or schedule is generated: income, gains, valuations, cash, fees paid and bank references come from recorded entries, and where nothing is recorded the statement shows nothing. Fee terms apply only once the sponsor has set or confirmed them. Sample funds keep their demonstration figures, through the same ledger. | "Defects found", "How the audit engine reads the ledger" |
| FA-04 | Management fees accrue monthly from the offering's terms; expenses and income are recorded from bank lines or a journal entry; payables are tracked until paid. | "Posting rules", "Chart of accounts" |
| FA-05 | A fair value per investment at a period end posts the change in unrealized gain. For open-ended funds the month-end NAV comes from the ledger and is what subscriptions, redemptions, fees and the incentive allocation use. A finalized month cannot change silently. | "Valuations, NAV and period close" |
| FA-06 | Bank reconciliation with no paid service: upload CSV, OFX/QFX/QBO or BAI2; lines are parsed, never duplicated, matched to posted entries; the sponsor decides each unmatched line once; a reconciliation shows statement balance, book balance, outstanding items and a difference of zero. | "Bank reconciliation at $0" |
| FA-07 | A period can be closed. Entries dated in a closed period do not change; a later change to a record inside it is reported, not applied. Closing and reopening are owner-only and logged. | "Valuations, NAV and period close" |
| FA-08 | Financial statements from the ledger: statement of assets and liabilities, schedule of investments, statement of operations, statement of changes in partners' capital, statement of cash flows, financial highlights. Each ties to the others. They replace the generated ones on the Audit page. | "Statements" |
| FA-09 | One click produces the year-end package for the fund and year: a workbook and a PDF holding everything in D-02, readable by a CPA with no access to the portal. | "The CPA year-end package" |
| FA-10 | Workbook and PDF are written in the browser with no network request. Each file is reopened by a check and its totals compared with the ledger. | "What the repository ships", "Code Examples" |
| FA-11 | One read interface over the ledger and the capital accounts, returning the schedule shape the Audit page already uses, for the report builder. | "Interface for the report builder" |
| FA-12 | Every new screen works in the sandboxed frame with no server, at 390x844 with touch and at 1280x800, with a way out on screen; no vendor, model or library name; managed edition menu unchanged. | Project constraints |
| FA-13 | The tie-outs T1 to T15 run as checks and pass; the two hand-worked funds reproduce to the cent; every sample fund's audit package is unchanged by the re-pointing. | "Proving the numbers" |
| FA-14 | A distribution recorded for a future date becomes paid (confirmed by the sponsor or by a matched bank line) or is cancelled; carried interest paid with a distribution is recorded as a GP distribution. | "Defects found" 3 and 4 |
</phase_requirements>

## Project Constraints (from CLAUDE.md and AUTOPILOT.md)

`.planning/config.json` names `./.claude/CLAUDE.md`, which does not exist; the root `CLAUDE.md` is in force.

- An outside service that could do the job better is put to the owner with cost, accuracy, speed and trade-offs before building in-house. No budget for monthly fees: a $0 path first.
- Nothing is called ready, working or done until tested on material it has not seen and checked by the owner. No time that was not measured. Failures first.
- GSD for everything: researcher, planner, plan checker, executors in isolated worktrees, verifier. Plans of about 100k tokens; independent plans in parallel.
- Build only what the law or the task needs; no extra text on screens; nothing mandatory for investors (D-30).
- White label: no vendor, model or library name in anything a sponsor or investor sees; the word the owner banned never appears on a screen.
- Managed (Carrow & Vale) edition unchanged unless a plan says otherwise. The C-03 guard hashes slices of `onboarding.js` and `data.js` (checks/status-math.js:44, 335): a plan that edits `data.js` must run it.
- No work on the in-house reader (D-33). No paid API calls by agents; no keys given to agents.
- The owner tests on an iPhone inside the Claude app: a sandboxed iframe, no server. The check's policy is `connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:` (checks/no-network.js:27). No `fetch()`/XHR on a path that must work there; data ships as script files; no Blob in IndexedDB (store bytes); no browser PDF viewer (draw pages in-page); every view has a way out on screen; dialogs scroll. Screens proven at 390x844 with touch and at 1280x800.
- RED-first: every behaviour change has a check that fails before and passes after. Full gate: `.planning/checks/gate-reference.sh`. Browser checks go through `SCRATCH/exec-011/heavy.sh`.
- Worktree base `claude/refract-reskin`; push only to `wip/<branch>`; never touch STATE.md or ROADMAP.md (a planner may edit its own phase's section). Never commit confidential documents or personal data; never stage `server/node_modules`. Disk: 5.2 GB free (measured this session).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Journal, chart, posting from records, trial balance, close | Browser (pure module, also runs in Node for checks) | - | Must work in the preview with no server; every existing money record is in the browser workspace |
| Capital accounts per investor (allocation of income, fees, carry) | Browser (`audit.js`, existing) | - | Exists and is proven; it becomes the partner sub-ledger that ties to the journal's capital total |
| Bank file parsing and matching | Browser (pure module) | - | Text files read with `File.arrayBuffer()`; no upload to anyone |
| Uploaded statement file kept as evidence | Browser file store (IndexedDB, bytes) | - | `NS.ops.files` already stores bytes, never a Blob (operations.js:437-475) |
| Statements, schedules | Browser (`audit.js` schedules, extended) | - | The Audit page and its CSV/zip export exist |
| Workbook and PDF files | Browser | - | No network in the preview; D-03 needs files that stand alone |
| Bank feed (a live connection to the bank) | Not built | A server, later (launch item 11) | Needs keys, a server and a monthly fee: outside the $0 path |

## What exists today: stored records and what is derived

### Stored records
All in one JSON object per firm in `localStorage` under `ws:<firm id>` (workspace.js:16-52, 100-125), with the edition's prefix (`'sdesk1:'` self-serve, `'cvp2:'` managed; edition.js). [VERIFIED: files read]

| Record | Where | Fields that matter | Money unit |
|--------|-------|--------------------|-----------|
| Position | `ws.investors[].positions[]` | `offeringId`, `amount`, `commitment`, `date`, `ref`, `class`, `feeder`, `redeemed` (operations.js:100-102, 287-288; data.js:235) | dollars as a number; cents are `Math.round(p.amount * 100)` (audit.js:191) |
| Capital call | `ws.calls[]` | `id`, `offeringId`, `number`, `noticeDate`, `due`, `pct`, `total`, `purpose`, `status` (`'open'`, `'complete'`), `items[] { investorId, cents, received, reminders }` (operations.js:160-172, 186) | cents |
| Call payment | `receive()` sets `it.received` and pushes a position with `ref: call.id` (operations.js:179-190) | | cents |
| Distribution | `ws.runs[]` | `id`, `offeringId`, `date`, `type`, `total`, `status` (`'paid'`, `'scheduled'`), `source` (`'console'`, `'history'`), `file`, and with a waterfall `gp`, `gross` (console.js:1321; data.js:274) | cents |
| Request | `ws.requests[]` | `type` (`'redemption'`, `'subscription'`), `dealing`, `cents`, `full`, `status` (`'pending'`, `'approved'`, `'rejected'`, `'paid'`, `'funded'`, `'accepted'`), `decided`, `paid`, `paidCents`, `completed` (operations.js:229, 239, 254-255, 275-277, 289-290) | cents |
| Fund terms | `ws.offerings[].accounting` | `mgmtFee`, `feeBasis`, `carry`, `pref`, `catchUp`, `stepDown`, `stepDownBasis`, `waterfall { type, tiers }`, `auditor`, `administrator`, `otherFees` (audit.js:94-125; console.js:612-624, 2826) | percent |
| Fund structure | `ws.offerings[]` | `type`, `currency`, `classes`, `feeders`, `sidePockets`, `equalization`, `liquidity`, `holdings`, `calls`, `exit`, `closeDate` (audit.js:108-118) | - |
| Investor tax facts | `ws.investors[]` | `taxForm`, `taxType`, `tinLast4`, `taxCert { form, revision, envelopeId, at, signed, signedBy, tinLast4, backupWithholding }` and for W-8 `country, citizenship, ftinLast4, noFtin, treatyCountry, chapter3, chapter4, validUntil` (onboarding.js:2380-2389) | - |
| Change log | `ws.audit[]` | `seq, at, actor, action, fund, record, detail, hash`, each hashed with the one before (audit.js:788-956) | - |
| Files | IndexedDB `cvp-documents`, store `files`, as `{ type, bytes }` (operations.js:400-401, 468) | signed agreements, signed W-9/W-8, published documents | - |

The full taxpayer number is never stored: only its last four digits; the full number exists only inside the signed W-9 or W-8 PDF in the file store (onboarding.js:2372-2374, 774). [VERIFIED]

No fund tax number (EIN) is stored anywhere. No list of investments a sponsor can edit exists: intake creates one placeholder line (intake.js:1167). No expense, income, valuation, bank line or journal entry is stored anywhere. No transfer of an interest between investors exists. [VERIFIED: grep and files read]

### Derived on every render (nothing stored)
`NS.audit.ledger(ws, o)` (audit.js:169-418) rebuilds everything from inception each time, cached in memory until the next save:

| Figure | How it is made today | Real or generated |
|--------|---------------------|-------------------|
| Contributions | From received call items when the fund has calls and is closed-end, else from positions (audit.js:176-193) | Real |
| Distributions per investor | Each paid run split pro rata by amount invested on the run's date, recomputed each time (audit.js:197-206; data.js:409-420) | Real total; the split is recomputed, not frozen |
| Redemptions | Approved or paid redemption requests, at the month-end capital after fees (audit.js:260-263, 382-395) | Real request; amount from derived capital |
| Investment income, gains | A seeded random generator per fund (`rng(hashStr(o.id + ':returns'))`), driven by the fund type's `mu`, `vol`, `yield` (audit.js:218-235) | **Generated** |
| Management fee | Rate times the fee basis, one-twelfth a month, per investor at the class rate (audit.js:332-340); never paid | Computed from terms; default terms if none set |
| Carried interest, incentive | Hypothetical liquidation through the waterfall each quarter; the incentive over a high-water mark each month, crystallized in December (audit.js:353-374) | Computed, on generated gains |
| Holdings' fair value and cost | Net assets times each holding's weight; cost is a fixed fraction of value (audit.js:445-498) | **Generated** |
| Cash | The number that makes the balance sheet balance (audit.js:499) | **Generated** |
| Fee payable | The last month's fee (audit.js:453) | Computed |
| Bank references | Counter and hash (audit.js:646-648) | **Generated** |
| The 16 to 19 schedules, checks, README, manifest | Built from the above (audit.js:959-1464) | Format real, inputs as above |

The engine's own name for its monthly table is "the ledger", but it is a capital-account roll, not a general ledger: there are no accounts, no debits and credits, no cash. [VERIFIED]

Measured this session (`SCRATCH/r11/spike/measure.js`, the four sample firms): workspace JSON 40 to 53 KB before the change log and 137 to 247 KB with it (340 to 721 log entries); 144 to 269 fund-months and 2,124 to 4,253 investor-month rows per firm; up to 127 distributions and 1,879 investor distribution rows in one firm. The existing checks `roll`, `nav`, `soi`, `own`, `bank`, `fees`, `log` pass for all three funds of the first sample firm. [VERIFIED: run]

### What the repository ships for writing files

| Need | What exists | Where | Network at run time |
|------|-------------|-------|---------------------|
| Zip | In-house writer, stored (no compression), UTF-8 names | `NS.audit.zip(files, when)` audit.js:731-786 | None |
| SHA-256 | In-house, synchronous | `NS.audit.sha256` audit.js:672-714 | None |
| CSV | In-house, with a guard against cells that would run as formulas | `NS.audit.toCsv` audit.js:1346-1351; `cellText` 1326-1345 | None |
| Download in the preview | `NS.ui.download(filename, data, opts)`: the host's save prompt when present, else a normal download | app.js:138-169 | None |
| PDF writing | pdf-lib 1.17.1, loaded by a script tag from cdnjs when first needed; helpers `NS.esignKit.writer`, `fontsFor`, `drawText`, `textWidth` | esign.js:25, 258-266, 404; a multi-page text PDF built with it: record.js:297-340 | **Yes: CDN script** |
| Unicode font for PDFs | DejaVu Sans, two weights, shipped as script files; the font embedder (fontkit 1.1.1) still comes from jsDelivr | `assets/vendor/textfont/`; esign.js:30-43, 406-411 | Font: none. Embedder: **CDN script** |
| PDF viewing in-page | pdf.js 3.11.174 from cdnjs, pages drawn as images | esign.js:26-27, 242-257 | **Yes: CDN script** |
| Spreadsheet reading | First worksheet of an `.xlsx`, through JSZip 3.10.1 from cdnjs | invitations.js:1870-1927; intake.js:22, 1419-1421 | **Yes: CDN script** |
| CSV reading | `csvRows(text)`: commas, tabs or semicolons | invitations.js:1699 | None |
| Spreadsheet writing | **Nothing** | - | - |

So: zips, hashes and CSV are already network-free. PDFs work in the preview today only because its policy allows scripts from the two CDNs. There is no spreadsheet writer.

## Standard Stack

No package is installed by this phase. Two files the project already depends on are copied into the repository so they stop coming from a CDN.

### Core
| Piece | Version | Purpose | Why |
|-------|---------|---------|-----|
| In-house journal module | new | Ledger, posting, trial balance, close | About the size of `structures.js`; integer cents; the hard allocation logic already exists in `audit.js` |
| `NS.audit.zip` + in-house worksheet XML | existing + new (about 120 lines) | `.xlsx` workbook | Proven this session: two sheets, numbers, a number format and `SUM` formulas opened in openpyxl 3.1.5 and LibreOffice 24.2.7.2 [VERIFIED: `SCRATCH/r11/spike/xlsx.js`] |
| pdf-lib | 1.17.1 (published 2021-11-06), MIT, `dist/pdf-lib.min.js` 525,099 bytes, sha256 `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f` | PDF | Already the project's PDF writer (esign.js:25); the checks already answer the CDN address from the npm copy of this exact file (checks/lib.js:30) [VERIFIED: file measured in `SCRATCH/vendor`; licence text read] |
| @pdf-lib/fontkit | 1.1.1 (published 2020-11-28), MIT, `dist/fontkit.umd.min.js` 758,440 bytes, sha256 `d8df561b9fba98e24f2e5130e40948809281bbbc55a20c412359f1a0a5eb35a6` | Embeds the shipped Unicode font so a name such as "Łukasz" prints | Already used (esign.js:30); same local copy (checks/lib.js:33) [VERIFIED: file measured] |
| In-house bank file parsers | new (CSV, OFX 1 and 2, BAI2) | Statement import | Text formats; each about 40 to 80 lines; fixtures prove them |

Ship the two library files under `assets/vendor/pdfwrite/` with their licence files and a `SHA256SUMS`, the way `assets/vendor/textfont/` is laid out, and have the loader try the shipped copy first (the font loader already does this: esign.js:32-43). That removes the CDN from signing as well. Cost: 1.28 MB in the repository, no money.

### Alternatives Considered
| Instead of | Could use | Trade-off |
|------------|-----------|-----------|
| In-house `.xlsx` writer | `write-excel-file` 4.1.1, MIT, bundle 70,844 bytes, published 2026-06-08 [VERIFIED: npm registry, tarball measured] | Styling and column widths for free; a new dependency to ship and audit; its bundle carries its own zip code. Not needed for plain tables. `[ASSUMED]` as a package choice |
| In-house `.xlsx` writer | `xlsx` (SheetJS CE) 0.18.5, Apache-2.0, mini build 250,826 bytes; the npm copy has been frozen since 2022-03-24, newer versions are only on the vendor's own site, which was unreachable [VERIFIED: npm registry, tarball measured] | Reads and writes many formats; a stale copy; far more than needed. `[ASSUMED]` |
| In-house `.xlsx` writer | `exceljs` 4.4.0, MIT, 947,702 bytes, last published 2023-10-19 [VERIFIED: npm registry, tarball measured] | Rich formatting; nearly 1 MB. `[ASSUMED]` |
| Shipping pdf-lib | Keep loading it from cdnjs | Zero bytes added; the package then fails wherever the CDN does. The task rules this out. |
| Shipping pdf-lib | An in-house PDF writer on the 14 built-in fonts | Tiny, but cannot print letters outside Western European (the project already had to solve this for signing); embedding a font by hand is a project of its own |
| pdf-lib | `jspdf` 4.2.1, MIT, 420,165 bytes [VERIFIED: npm registry] | A second PDF library beside the one already used. No reason. |
| In-house CSV reading | `papaparse` 5.7.1, MIT, 19,012 bytes [VERIFIED: npm registry] | The repository already has `csvRows`. |
| In-house OFX reading | `ofx-data-extractor` 1.6.0, MIT, 17,818 bytes, published four days ago [VERIFIED: npm registry] | Too new to trust; the format needs about 60 lines. `[ASSUMED]` |
| An accounting engine library | `medici` 7.4.0, MIT: needs MongoDB [VERIFIED: npm registry lists it; its storage need is `[ASSUMED]`] | Cannot run in a browser with no server. |

**Installation:** none. Copy two files from the npm tarballs (integrity `sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==` for pdf-lib 1.17.1 and `sha512-KjMd7grNapIWS/Dm0gvfHEilSyAmeLvrEGVcqLGi0VYebuqqzTbgF29efCx7tvx+IEbG3zQciRSWl3GkUSvjZg==` for fontkit 1.1.1 [VERIFIED: `npm view`]).

## Package Legitimacy Audit

No package is installed. For the record, the seam was run on every library named above (`gsd-tools query package-legitimacy check --ecosystem npm …`): each came back `SUS` with the single reason `unknown-downloads` (the download-count service was unreachable); `papaparse` and `ofx-data-extractor` also `too-new`. None has a postinstall script (`npm view <pkg> scripts.postinstall` empty for pdf-lib, xlsx, write-excel-file).

| Package | Registry | Published | Downloads | Source repo | Verdict | Disposition |
|---------|----------|-----------|-----------|-------------|---------|-------------|
| pdf-lib 1.17.1 | npm | 2021-11-06 | not read | github.com/Hopding/pdf-lib | SUS (unknown downloads) | Already in use by the project; copy the file, pin the hash |
| @pdf-lib/fontkit 1.1.1 | npm | 2020-11-28 | not read | github.com/Hopding/fontkit | SUS (unknown downloads) | Already in use; copy the file, pin the hash |
| write-excel-file, xlsx, exceljs, jspdf, papaparse, ofx-data-extractor | npm | see above | not read | see registry | SUS | Not recommended; if a plan picks one it needs a `checkpoint:human-verify` |

**Packages removed due to [SLOP] verdict:** none. **Flagged [SUS]:** all, for the unreadable download count only.

## Outside services: prices, accuracy, speed, trade-offs

Every price below is from a search summary, not the vendor's page. Treat each as unconfirmed.

| Service | What it would replace | Price found | Works in the no-server preview | Trade-off |
|---------|----------------------|-------------|-------------------------------|-----------|
| Fund accounting products: Fundwave; FundCount; NAVSphere; Repool; AltExchange; InvestNext | The whole phase | Fundwave from $800 a month per fund; FundCount $5,000 per fund a year (one user) or from $21,928 a year; NAVSphere $140 per user a month; Repool from $20,000 a year; AltExchange $375 a month; InvestNext $99 to $499 a month (pages disagree) [LOW: Capterra, Software Advice and vendor pages via search] | No | Monthly fees; their brand, not the sponsor's; the portal's own capital accounts would have to be kept in step with theirs. No embeddable API was found for any. |
| Juniper Square, Carta, Agora, Covercy | The whole phase | **No price found** | No | Sold with their own portals: competitors, not parts |
| General accounting software (QuickBooks Online) | The journal and bank feeds | $38 to $340 a month per company by plan [LOW: third-party pages; Intuit's page not read]; API charges not found | No | The sponsor pays; no partner capital accounts; a server and sign-in flow needed. A sponsor who already keeps books there could instead upload a trial balance: see Optional below. |
| Ledger services and engines (Modern Treasury, Formance, Blnk, TigerBeetle) | The journal | **Prices and licences not read** | No | Server databases. The requirement is a ledger in the browser. |
| Bank feed: Plaid | Statement upload | **No public price.** Third parties cite about $0.25 to $0.30 per connected account a month [LOW] | No | Server, keys, an approval step, a per-account monthly fee |
| Bank feed: Teller | Statement upload | $0.30 per connection a month; 100 live connections free on the developer tier [LOW: search summary of teller.io, which said the page text was garbled] | No | Same; fewer banks |
| Bank feed: Stripe Financial Connections | Statement upload | About $0.30 per institution per account holder a month [LOW: sources disagree] | No | Same |
| Statement file upload (in-house) | - | $0 | Yes | The sponsor downloads a file from the bank each month |

**Accuracy and speed:** none of these was measured, and no vendor accuracy figure was found. For the in-house route accuracy is what the tie-outs prove (below); speed is to be measured by the plans on the sample firms, not estimated here.

**Recommendation:** in-house for all of it. No service found is both free and able to run without a server, and the portal already owns the part of the problem (investor capital accounts) those products charge for. A bank feed is the one outside service worth revisiting, with launch item 11, once a server and a payments decision exist; the bank-line store below is shaped so a feed can write the same lines.

## The ledger (smallest design that makes D-01 true)

### Shape
Proposed; names are suggestions for the planner. Stored in the workspace object so it saves, loads and resets with everything else.

```js
ws.books = {
  v: 1,
  funds: {                               // by offering id, created the first time it is needed
    'off-id': {
      start: '2026-01-01',               // first day the books cover
      accounts: [ { code: '1000', name: 'Cash', type: 'asset' } /* … from the template */ ],
      journal:  [ { id, date, memo, src, lines: [ ['1000', 30000000], ['3000', -30000000, 'PBP-1004'] ], at, by } ],
      holdings: [ { id, name, kind, placed: '', land: 0, building: 0 } ],          // investments; property fields only for real estate
      marks:    [ { id, holding, date, fv, doc, at, by } ],                        // valuations
      bank:     { accounts: [ { id, name, last4, code, map } ], imports: [ /* file facts */ ], lines: [ /* statement lines */ ], recs: [ /* completed reconciliations */ ] },
      closed:   [ { through: '2026-03-31', tb: '<sha256 of the trial balance text>', at, by } ]
    }
  }
};
```

- A line is `[account code, cents, partner id?, holding id?]`. Cents are whole numbers: positive is a debit, negative a credit. An entry is valid only if its lines sum to zero. This is the whole of "double entry".
- `src` says which record the entry came from, and makes posting safe to repeat: `call:<call id>:<investor id>`, `pos:<investor id>:<offering id>:<date>:<ref>`, `run:<run id>`, `req:<request id>`, `reqpaid:<request id>`, `fee:<offering id>:<YYYY-MM>`, `mark:<mark id>`, `bank:<line id>`, `open:<offering id>`, `man:<id>`, `close:<offering id>:<year>`, and for sample funds only `sim:<offering id>:<YYYY-MM>`.
- A posted entry is never edited. A correction is a new entry; an entry made in error is reversed by an equal and opposite one that names it.
- The partner id sits only on lines that are a partner's own cash event (contribution, distribution, redemption). Income, expenses, fees and carried interest are **not** split by partner in the journal: that split is the capital-account engine's job, and its total is tied to the journal (T3). This is why the journal stays small: storing the split would add 2,000 to 4,000 rows per sample firm for nothing the engine cannot recompute and prove.

### Chart of accounts (template; proposed)
One template, with the real estate rows added for real estate fund types. Codes are proposals. The last column is a suggestion printed in the package for the CPA, who decides.

| Code | Account | Type | Form 1065 Schedule L line (suggested) |
|------|---------|------|--------------------------------------|
| 1000 | Cash (one per bank account: 1000, 1001, …) | asset | 1 Cash |
| 1100 | Investments, at cost | asset | 8 Other investments |
| 1150 | Unrealized appreciation (depreciation) on investments | asset | 8 Other investments (book only) |
| 1200 | Interest, dividends and rents receivable | asset | 6 Other current assets |
| 1300 | Prepaid expenses and other assets | asset | 13 Other assets |
| 1400 | Land | asset (real estate) | 11 Land |
| 1410 | Buildings and improvements | asset (real estate) | 9a Buildings and other depreciable assets |
| 1490 | Accumulated depreciation | asset (real estate, optional) | 9b Less accumulated depreciation |
| 2000 | Accounts payable and accrued expenses | liability | 15 Accounts payable |
| 2100 | Management fees payable | liability | 17 Other current liabilities |
| 2200 | Redemptions payable | liability | 17 |
| 2250 | Subscriptions received in advance | liability | 17 |
| 2400 | Tax withheld, payable (for phase 10) | liability | 17 |
| 2500 | Mortgage notes payable | liability (real estate) | 16 / 19b Mortgages, notes, bonds payable |
| 2600 | Due to general partner | liability | 19a Loans from partners |
| 3000 | Partners' capital: contributions | equity | 21 Partners' capital accounts |
| 3100 | Partners' capital: distributions and redemptions | equity | 21 |
| 3300 | Partners' capital: distributions to the general partner | equity | 21 |
| 3900 | Partners' capital: accumulated results of earlier years | equity | 21 |
| 4000 / 4010 / 4020 / 4030 / 4090 | Interest; dividends; rents; royalties; other income | income | - |
| 5000 | Management fees | expense | - |
| 5100 / 5110 / 5120 | Professional fees; administration; organizational costs | expense | - |
| 5200 | Interest expense | expense | - |
| 5300-5390 | Property operating expenses (insurance, repairs, real estate taxes, utilities, property management, other) | expense (real estate) | - |
| 5900 | Other expenses | expense | - |
| 6000 | Net realized gain (loss) on investments | gain | - |
| 6100 | Net change in unrealized appreciation (depreciation) | gain | - |

Keeping unrealized gains in their own two accounts (1150 and 6100) is the one design choice that serves both readers: fair-value statements add them in; the CPA, who needs figures without them, leaves them out, and the amount is exactly what goes on Schedule M-1 line 6.

### Posting rules
One function, `NS.books.sync(ws)`, called where the workspace is saved and loaded. It posts any record that has no entry yet and never touches an entry dated in a closed period. It must take contributions, distributions and redemptions from the engine's own event lists (`L.contribs`, `L.dists`, `L.redemptions`, audit.js:176-206, 394), not re-derive them, so the journal and the capital accounts cannot disagree about which records count. That means splitting the engine's first stage (events) from its second (monthly allocation); the first has no need of the books.

| Record | Entry date | Debit | Credit |
|--------|-----------|-------|--------|
| Call payment received; funded subscription or closing | date received; position date | 1000 Cash | 3000 Contributions (partner) |
| Paid distribution | run date | 3100 (one line per investor, from the split used to pay them, frozen on the entry); 3300 for the run's `gp` | 1000 Cash for `total + gp`; 2400 for tax withheld when phase 10 supplies it |
| Redemption at the dealing date | dealing date | 3100 (partner) | 2200 Redemptions payable |
| Redemption paid | date paid | 2200 | 1000 |
| Management fee for the month (the engine's fund total for that month) | month end | 5000 | 2100 |
| Valuation | valuation date | 1150 (the change since the last one) | 6100 |
| Bank line the sponsor categorized | line date | chosen account (or 1000) | 1000 (or chosen account) |
| Purchase of an investment (a categorized bank line) | line date | 1100 (holding) | 1000 |
| Sale proceeds (a categorized bank line; the sponsor enters the cost given up) | line date | 1000 | 1100 (holding) for the cost, 6000 for the difference; 1150 and 6100 reverse the unrealized gain carried on it |
| Opening balances | day before `start` | the trial balance the sponsor enters | |
| Year-end close | December 31 | each income, expense and gain account | 3900 |

A called but unpaid amount posts nothing: the unfunded commitment is already shown off the books in the investor register. [ASSUMED: that this matches practice; a CPA should confirm]

### How the audit engine reads the ledger
Two lines of the engine carry the generated figures into the capital accounts: `largest(Math.round(r.income * baseSum), bases)` and `largest(Math.round(r.gain * baseSum), bases)` (audit.js:311-312). Replace the two rounded products with amounts from one provider:

- For a fund with books: `income` = the month's income accounts less its expense accounts other than 5000 (the engine computes that fee itself, per investor and class); `gain` = the month's 6000 plus 6100. Whole cents, from the journal.
- For a sample fund: the generator stays as the provider, and writes `sim:` entries so the journal carries the same amounts and its cash equals the engine's. Sample figures do not change.
- For a fund that is not a sample fund and has no entries: zero. No rate, no weight, no generator.

`holdingsAt` (audit.js:445-504) then takes fair value, cost, cash and payables from account balances instead of weights and the balancing figure. The fee rate must not fall back to the fund type's default for a real fund (audit.js:99): an unset fee is no fee until the sponsor sets it. `tenant.sample` tells the two apart: `sample: false` in the template (tenants.js:42), `sample: true` on the four sample firms (tenants.js:84, 196, 305, 410). [VERIFIED: lines read]

The fund types this covers are the engine's ten profiles, by key: `vc`, `pe`, `spv`, `realestate`, `credit`, `realassets`, `other` (structure `'closed'`) and `hedge`, `digital`, `multistrat` (structure `'open'`) (audit.js:59-70), reached from fourteen offering types (tenants.js:21-36). Closed-end real estate and private equity first, as CONTEXT.md asks; open-ended next. Share classes, feeders, side pockets and waterfalls need no ledger work: they live in the allocation, which is unchanged.

### Valuations, NAV and period close
- A valuation is one row: investment, date, fair value, the document it rests on. It posts the change in 1150. Closed-end funds may go a whole year without one: the investment then stays at cost, which is a true statement, not a generated one.
- NAV at a month-end is assets less liabilities in the journal, and it must equal the engine's limited partners' capital plus the GP's accrued share for that month (T3). The portal keeps capital accounts per investor, not units: there is no NAV per share. [VERIFIED: structures.js:157-161 states incentive is computed per investor]
- "Finalize NAV" for a month and "close the period" are the same act: record `through`, a hash of the trial balance, who and when. After it, `sync` leaves entries dated on or before `through` alone. If a record inside the closed period later changes, a check lists the difference; nothing is rewritten. Reopening is owner-only and logged. A redemption's amount is fixed when its dealing month is finalized (today it is "null until that month is closed", operations.js:261-269, with no real closing).
- The fund's currency is the currency of its books (`NS.structures.curOf(o)`, structures.js:30). No translation is built: the reference rates in the code are for summary screens only (structures.js:24-29), and Schedule L must be in U.S. dollars (IRS text below). A fund in another currency gets its package in that currency, clearly marked, for the CPA to translate.

### Storage
The journal goes in the workspace JSON. Estimated from the measured counts: a few hundred entries per fund-year at roughly 150 to 250 bytes each, so tens of kilobytes a year per fund; the largest sample firm's whole history would add about 150 KB to its 247 KB. [ASSUMED: sizes are estimates until built] The first ledger plan must measure the JSON size of every sample firm after posting and fail above a stated budget. Uploaded statement files go to the file store as bytes (operations.js:437-475), not into the JSON; only their parsed lines do.

## Bank reconciliation at $0

### What banks export
[LOW: search summaries of bank help pages and vendor guides; no bank page opened]
- **CSV**: offered by essentially every bank; no standard columns, dates or signs. It can include pending items.
- **OFX, QFX, QBO**: the same format under three names (QFX is the Quicken flavour, QBO the QuickBooks one). Structured: account, dates, each transaction with a bank-assigned id, and the ledger balance. Processed transactions only.
- **BAI2**: offered on banks' business and treasury portals. Structured, with control totals.
- A bank that offers only PDF statements gives nothing to parse. Reading PDFs is the in-house reader's territory (D-33): not built. The sponsor uses the CSV download.

### How each is parsed
**OFX 2** is XML. From a real sample read this session (ofxtools test data):

DATA_p3Zk9wQa_START
<STMTTRN>
    <TRNTYPE>CHECK</TRNTYPE>
    <DTPOSTED>20051004</DTPOSTED>
    <TRNAMT>-200.00</TRNAMT>
    <FITID>00002</FITID>
    <CHECKNUM>1000</CHECKNUM>
</STMTTRN>
…
<LEDGERBAL>
    <BALAMT>200.29</BALAMT>
    <DTASOF>200510291120</DTASOF>
</LEDGERBAL>
DATA_p3Zk9wQa_END

[VERIFIED: file `csingley/ofxtools/master/tests/data/stmtrs.ofx` read] Also present: `<BANKACCTFROM>` with `<BANKID>`, `<ACCTID>`, `<ACCTTYPE>`; `<BANKTRANLIST>` with `<DTSTART>`, `<DTEND>`. `TRNAMT` is signed: negative is money out. `FITID` is the bank's id for the line: the key for never importing a line twice.

**OFX 1** (what most bank downloads are, under `.ofx`, `.qfx` or `.qbo`): the same tags after a plain-text header, but as SGML, where a value tag has no closing tag (`<TRNAMT>-200.00` then a new line). [ASSUMED: training knowledge; the specification was unreachable] One tokenizer that reads `<TAG>value` pairs and tracks open containers handles both. Do not hand the file to the browser's XML parser: OFX 1 is not XML, and a tokenizer cannot be made to expand entities.

**BAI2** is comma-separated records ending in `/`, the first field a record code. From a real sample read this session (moov-io/bai2 test data):

DATA_h7Lm2xVt_START
01,0004,12345,060321,0829,001,80,1,2/
02,12345,0004,1,060317,,CAD,/
03,10200123456,CAD,040,+000000000000,,,045,+000000000000,,/
88,100,000000000208500,00003,V,060316,,400,000000000208500,00008,V,060316,/
16,409,000000000002500,V,060316,,,,RETURNED CHEQUE     /
16,108,000000000203500,V,060316,,,,TFR 1020 0345678    /
49,+00000000000834000,14/
98,+00000000001280000,2,25/
99,+00000000001280000,1,27/
DATA_h7Lm2xVt_END

[VERIFIED: file `moov-io/bai2/master/test/testdata/sample1.txt` read; the project's README says "Both formats use the same 01/02/03/16/88/49/98/99 envelope"] 01 file header, 02 group header (with the as-of date), 03 account (account number, currency, then summary type codes and amounts), 16 a transaction (type code, amount with no sign and no decimal point, funds type, then reference fields and text), 88 a continuation of the record above, 49/98/99 account, group and file trailers with control totals and record counts. The amounts in a 16 record are unsigned; the type code gives the direction. [ASSUMED: codes 100 to 399 are credits and 400 to 699 debits, and summary codes such as 015 and 045 are closing balances; consistent with the sample (108 beside a deposit, 409 beside a returned cheque, summaries 100 and 400 as total credits and debits) but the specification was not read] The parser must check each trailer's control total and record count against what it read and refuse a file that does not agree: that is the format's own proof of a complete read.

**CSV** has to be mapped once per bank account: which column is the date, the description, the amount (one signed column, or separate money-in and money-out columns), the running balance and the check number if any; the date order; whether money out is negative. The portal guesses from the header row, shows the first lines as it reads them, and the sponsor confirms. The mapping is kept with the bank account. `csvRows` (invitations.js:1699) already splits the text. A line's identity is the hash of date, amount, description and its position among identical lines of that day.

### Matching
A statement line becomes `{ id, account, date, cents, text, ref, balance? }`, money in positive.

1. Never twice: a line whose id is already stored is skipped; the import reports how many were new.
2. Suggested matches against posted cash entries that are not yet cleared: same amount, same direction, date within three business days (`NS.ops.businessDays`, operations.js:28-36). A call payment is one credit of that investor's amount. A distribution paid by ACH reaches the bank as one debit of the file's total, and each check clears on its own: the expected amounts are already computed per run as `achCents` and the `chk` rows (audit.js:638-661).
3. One candidate: shown as a suggestion the sponsor accepts in one tap (or all at once). Several: the sponsor picks. A match posts nothing; it marks the entry cleared and links the line. A matched line for a scheduled distribution is what turns it paid (FA-14).
4. No candidate: the sponsor chooses an account (and the investment or investor when the account needs one); that posts the entry. The choice made for a description is offered the next time the same description appears. [optional refinement]
5. Reconcile to a date: the statement's ending balance (from the file for OFX and BAI2, typed or taken from the balance column for CSV), the book cash balance, the entries not yet cleared, and the difference. Zero difference lets the sponsor mark it reconciled; the result is stored and becomes a schedule.

## Statements and what a CPA expects

### The statements a private fund issues
[ASSUMED unless marked: training knowledge; the Codification and the AICPA guide could not be opened. A search summary of KPMG's and CohnReznick's illustrative statements for private equity and hedge funds shows each statement below labelled with ASC 946-205-45-1, which agrees with this list. LOW.]

| Statement | Authoritative source to confirm against | The portal today |
|-----------|-----------------------------------------|------------------|
| Statement of assets and liabilities | FASB ASC 946-210 | Schedule 01, captions at audit.js:1103-1115, generated inputs |
| Schedule of investments (each investment: description, cost, fair value, percent of net assets; condensed form allowed for nonregistered partnerships) | ASC 946-210-50 | Schedule 08, audit.js:1218-1229 |
| Statement of operations (investment income; expenses; net investment income or loss; net realized gain; net change in unrealized; net increase in net assets from operations) | ASC 946-220 | Schedule 02, audit.js:1119-1127 |
| Statement of changes in partners' capital (by general and limited partners) | ASC 946-205-45 | Schedule 03, audit.js:1131-1139 |
| Statement of cash flows | ASC 230; an investment company may omit it only if it meets every condition of ASC 230-10-15-4 (in substance: nearly all investments carried at fair value and highly liquid, little or no debt, and a statement of changes in net assets provided). A fund holding private companies, property or a mortgage does not meet them. | **None** |
| Financial highlights (closed-end: internal rate of return since inception, ratios of expenses and net investment income to average limited partners' capital; open-ended: total return and the same ratios) | ASC 946-205-50 | IRR and multiples in schedule 13; no ratios |
| Fair value hierarchy and Level 3 inputs | ASC 820 | Schedules 09, 10 |
| Notes (policies, related parties, commitments, subsequent events) | - | Not produced, and should not be: they are the preparer's words |

Further sources a CPA would name: the AICPA Audit and Accounting Guide "Investment Companies" (its chapter on financial statements and its illustrative statements for nonregistered investment partnerships), and the AICPA guide on valuing portfolio company investments of venture capital and private equity funds. None was readable.

**A question only a CPA can settle (flagged for the owner):** ASC 946 applies to an entity that is an investment company. A venture, private equity, credit or hedge fund is one. A single-property syndication or a Delaware Statutory Trust is, in common practice, treated as an operating real estate entity instead: property at cost less depreciation, or statements on the income-tax basis, not fair value. [ASSUMED: training knowledge; the scope paragraphs of ASC 946-10-15 were not read] The existing engine presents every fund type, real estate included, as an investment company at fair value. The ledger above keeps cost and the fair-value adjustment apart, so both presentations can come from it; which one a syndication's statements should use is an owner decision below.

### What the partnership return asks for (read from the IRS files this session)
[VERIFIED: `www.irs.gov/pub/irs-pdf/f1065.pdf`, `i1065.pdf`, `f1065sk1.pdf`, `f8825.pdf`, `f4562.pdf`, tax year 2025 forms, saved in `SCRATCH/r11/irs/`]

- Form 1065 page 1, item H: "Check accounting method: (1) Cash (2) Accrual (3) Other". The package must say which the books are on. Recommended: accrual.
- **Schedule L, "Balance Sheets per Books"**, beginning and end of the tax year. The lines, verbatim:

DATA_c5Rn8bYs_START
1 Cash · 2a Trade notes and accounts receivable · 2b Less allowance for bad debts · 3 Inventories · 4 U.S. Government obligations · 5 Tax-exempt securities · 6 Other current assets (attach statement) · 7a Loans to partners (or persons related to partners) · 7b Mortgage and real estate loans · 8 Other investments (attach statement) · 9a Buildings and other depreciable assets · 9b Less accumulated depreciation · 10a Depletable assets · 10b Less accumulated depletion · 11 Land (net of any amortization) · 12a Intangible assets (amortizable only) · 12b Less accumulated amortization · 13 Other assets (attach statement) · 14 Total assets · 15 Accounts payable · 16 Mortgages, notes, bonds payable in less than 1 year · 17 Other current liabilities (attach statement) · 18 All nonrecourse loans · 19a Loans from partners (or persons related to partners) · 19b Mortgages, notes, bonds payable in 1 year or more · 20 Other liabilities (attach statement) · 21 Partners' capital accounts · 22 Total liabilities and capital
DATA_c5Rn8bYs_END

  The instructions: "The balance sheets should agree with the partnership's books and records." and "All amounts on the balance sheet should be reported in U.S. dollars. If the partnership's books and records are kept in a foreign currency, the balance sheet should be translated in accordance with U.S. generally accepted accounting principles (GAAP)."
- **Schedule M-1** reconciles "Net income (loss) per books" (line 1) to the return. Line 6 is "Income recorded on books this year not included on Schedule K, lines 1 through 11 (itemize)": where a fund's unrealized gains go. Line 4 is "Expenses recorded on books this year not included on Schedule K".
- **Schedule M-2**, "Analysis of Partners' Capital Accounts": 1 balance at beginning of year; 2 capital contributed (a cash, b property); 3 net income (loss); 4 other increases; 6 distributions (a cash, b property); 7 other decreases; 9 balance at end of year. The instructions: "Show what caused changes during the tax year in the partners' tax-basis capital accounts." So M-2 and each K-1's item L are on the **tax basis**, which the portal does not keep: the package gives the book roll-forward, and the cash contributed and distributed (which the instructions define as "the amount of cash plus the adjusted tax basis of all property contributed"; cash is the same on either basis).
- **Schedule B question 4**: a partnership with total receipts under $250,000 and total assets under $1 million, that furnishes K-1s on time and files no Schedule M-3, "is not required to complete Schedules L, M-1, and M-2; item F on page 1 of Form 1065; or item L on Schedule K-1." Many small syndications will be under those lines; the package is the same either way.
- **Schedule K-1, Part II**, per partner: E the partner's SSN or TIN; F name and address; G general partner or LLC member-manager, or limited partner or other LLC member; H1 domestic or foreign partner; H2 a disregarded entity's TIN and name; I1 the type of entity; I2 whether the partner is a retirement plan (IRA, SEP, Keogh); J the partner's share of profit, loss and capital, beginning and ending, in percent, with a box for a sale or exchange of the interest; K1 the partner's share of liabilities (nonrecourse, qualified nonrecourse financing, recourse), beginning and ending; L the capital account analysis (beginning; contributed during the year; current year net income (loss); other increase (decrease); withdrawals and distributions; ending); M whether the partner contributed property with a built-in gain or loss.
- **Schedule K** lines the ledger's accounts feed: 2 net rental real estate income (Form 8825); 5 interest income; 6a ordinary dividends, 6b qualified dividends; 7 royalties; 8 net short-term and 9a net long-term capital gain; 13c investment interest expense; 13e other deductions; 19a distributions of cash and marketable securities; 20a investment income, 20b investment expenses; 21 foreign taxes.
- **Form 8825** (rental real estate), per property: the address and type; 2a gross rents; then expenses 3 advertising, 4 auto and travel, 5 cleaning and maintenance, 6 commissions, 7 insurance, 8 interest, 9 legal and other professional fees, 10 real estate taxes, 11 repairs, 12 utilities, 13 wages and salaries, 14 depreciation, 17 other deductions. The real estate expense accounts in the template follow these lines so the CPA can read them straight across.
- **Form 4562**, Part III, per asset: "(a) Classification of property (b) Month and year placed in service (c) Basis for depreciation … (d) Recovery period (e) Convention (f) Method (g) Depreciation deduction". The portal supplies (b) and (c) (cost, split between land and building) and the description; (d) to (g) are the CPA's.

### The CPA year-end package: contents
One workbook, one PDF, in one zip with a README and a SHA-256 manifest (the existing package's pattern, audit.js:1452-1464). Each D-02 item, and where it comes from:

| D-02 item | Sheet | Source |
|-----------|-------|--------|
| - | Cover: fund, year, currency, accounting method, who prepared it and when, the checks and their results, what the sponsor still has open | ledger, checks |
| Trial balance | Trial balance: each account's beginning balance, debits, credits, ending balance, suggested Schedule L line | journal |
| General ledger | General ledger: every line of every entry in the year, with its source | journal |
| Income and expenses | Income and expenses by account by month; real estate by Form 8825 line by property | journal |
| - | Balance sheet at the beginning and end of the year, in Schedule L order | journal |
| Capital roll-forwards | Per partner: beginning, contributions, each class of income allocated (income, expenses, realized, unrealized, fees, carried interest), distributions, ending; percent of capital at the beginning and end | engine (schedule 04, extended) |
| Ownership and its changes with dates | Every commitment, contribution, redemption and distribution with its date and the partner's percentage after it | positions, calls, runs, requests |
| Investor tax details from the W-9/W-8 | Per partner: name, address, account type, U.S. or foreign, IRA or not, form and revision on file, date signed, taxpayer number ending, backup withholding, treaty country, W-8 expiry, general or limited | investor record, `taxCert` |
| Distributions by type | Per partner per payment: date, type as recorded, amount, tax withheld (when phase 10 exists); totals per type | runs |
| Fees and waterfall results | Management fee by partner; carried interest or incentive by partner; each distribution's waterfall tiers | engine (schedules 11, 12), runs |
| Property and depreciation inputs | Per property: address, description, date placed in service, cost split into land and building, additions in the year, mortgage balance, interest paid | holdings, journal |
| - | Investments: cost, fair value, purchases and sales in the year with dates, proceeds and cost given up | holdings, journal |
| - | Bank reconciliation at year end | bank records |
| - | Book figures a preparer usually adjusts, as amounts only: unrealized gain included in book income; expenses accrued and unpaid; organizational costs | journal |

The PDF holds the statements, the trial balance, the capital roll-forward and the checks, for reading and printing. The signed W-9 and W-8 files are the only place the full taxpayer numbers exist; whether they go into the zip is an owner decision below.

The package is book-basis and says so on its cover. It never calls anything a K-1 figure.

## Screens and inputs: why each is needed

| # | Screen or input | The task cannot work without it because | Optional? |
|---|-----------------|------------------------------------------|-----------|
| 1 | One new console page, "Accounting", self-serve edition, with parts: Bank, Entries, Valuations, Close | There is nowhere else to put the four inputs below | Needed |
| 2 | Bank: upload a statement file; list of lines needing a decision; accept suggested matches | Bank reconciliation is in D-01, and bank lines are the only source of expenses, income and investment purchases that needs no typing | Needed |
| 3 | Bank: column mapping, once per bank account, CSV only | CSV has no standard layout | Needed for CSV |
| 4 | Bank: choose an account for an unmatched line (plus investment or investor where the account needs one) | An unmatched line cannot be posted without knowing what it was | Needed |
| 5 | Bank: reconcile to a statement date | D-01; it is the proof that cash in the books is the bank's cash | Needed |
| 6 | Entries: the journal as a list; add an entry (date, memo, lines that must balance); reverse an entry | A general ledger must be visible (D-01); accruals, corrections and non-cash items have no other door | Needed |
| 7 | Valuations: fair value per investment at a date, with its supporting document's name | Fair-value statements and NAV (D-01); without it investments stay at cost | Needed for open-ended funds; for closed-end funds needed only when the sponsor wants statements above cost |
| 8 | Investment details for real estate: date placed in service, land and building cost | D-02 "property and depreciation inputs"; Form 4562 columns (b) and (c) | Needed for real estate types only |
| 9 | Opening balances, once | A fund that existed before using the portal otherwise starts with a wrong balance sheet | Needed only for such a fund; a new fund never sees it |
| 10 | Close a period / finalize the month's NAV | A closed year must not move after the CPA has it; redemptions are paid at a finalized NAV | Needed |
| 11 | Confirm a scheduled distribution was paid, or cancel it | FA-14: without it no distribution dated ahead ever reaches capital | Needed (a matched bank line does it without a click) |
| 12 | Statements, trial balance, general ledger, cash flows, bank reconciliation | D-01 | **No new screen**: more schedules in the Audit page's existing list |
| 13 | "Download year-end package" with fund and year | D-02 | **No new screen**: one button on the Audit page |

Optional, none recommended for this phase: a chart-of-accounts editor beyond "add an account"; remembering a category by description; recurring entries; attaching a receipt to an entry; trial balance import for sponsors who keep books in other software; cash-basis books; book depreciation; NAV per share; currency translation; consolidating feeders with a master fund; budgets.

## Interface for the report builder

The report builder (launch item 7) needs "figures from the ledger (capital account, contributions, distributions, ownership, IRR, multiple, DPI, TVPI)" and "PDF and spreadsheet" (01.4-RESUME, line 98). Give it one read-only surface so it builds nothing of its own:

```js
NS.books.trialBalance(ws, offeringId, from, to)   // [{ code, name, type, begin, debits, credits, end }], cents
NS.books.entries(ws, offeringId, { from, to, account, partner, holding, src })   // journal lines, filtered
NS.books.balance(ws, offeringId, code, asOf)      // cents
NS.books.series(ws, offeringId, codes, from, to, 'month')   // amounts per month, for charts
NS.books.status(ws, offeringId)                   // { start, closedThrough, reconciledThrough, openItems }
NS.audit.period(ws, offering, from, to)           // existing: per-investor capital roll, fund totals, holdings
NS.audit.build(ws, offering, from, to).list       // existing: every schedule as { id, file, title, desc, cols, rows, total }
NS.ops.capital(ws, investor, offering, from, to)  // existing: one investor's account, IRR and multiple
NS.files.workbook(sheets) → Uint8Array            // new: sheets are the same schedule objects
NS.files.pdf(doc) → Promise<Uint8Array>           // new: title, tables (the same schedule objects), page footer
```

The schedule object (`cols` with a type per column: `'text'`, `'money'`, `'pct'`, `'ratio'`, `'price'`, `'int'`, `'date'`, `'qty'`; `rows`; `total`) already drives the on-screen table, the CSV and the README (audit.js:1084-1087, 1326-1371; console.js:2902-2913). Making the workbook and PDF writers take the same object means every statement, the package and every future report share one path. Money stays in whole cents until a writer formats it.

## Architecture Patterns

### System diagram
```
 Records the portal already keeps                 New inputs (Accounting page)
 call payments · subscriptions · paid             bank statement file ─► parse ─► lines ─► match?
 distributions · redemptions · fund terms                                          │ yes: mark cleared (and a
        │                                                                          │      scheduled distribution paid)
        │  engine stage 1: events                                                  │ no:  sponsor picks an account
        ▼                                                                          ▼
   NS.books.sync ───────────────► JOURNAL (per fund, whole cents, each entry sums to zero) ◄── valuations
   (one entry per record, once;         │                    ▲                              ◄── manual entries
    closed periods untouched)           │                    │ month's fee total            ◄── opening balances
                                        │ month's income     │
                                        │ and gains          │
                                        ▼                    │
                         engine stage 2 (audit.js, existing): monthly capital accounts per investor,
                         classes, fee steps, waterfall, high-water mark, side pockets, redemptions at NAV
                                        │
              ┌─────────────────────────┼──────────────────────────────┐
              ▼                         ▼                              ▼
     tie-outs (checks)          schedules (existing shape)      close: lock + hash
     journal total capital      statements, trial balance,
     = investors + GP           general ledger, cash flows,
                                bank reconciliation
                                        │
                     ┌──────────────────┼──────────────────────┐
                     ▼                  ▼                      ▼
              Audit page (in-page   audit package (zip,   year-end package: workbook + PDF + zip
              tables, existing)     existing)             (one button)            ─► report builder (later)
```

### Recommended structure
```
assets/js/
├── books.js          # NS.books: chart templates, journal, sync (posting rules), trialBalance, entries, balance, close (pure; runs in Node)
├── bankfiles.js      # NS.bankFiles: detect, parse CSV / OFX / BAI2, normalize, match (pure; runs in Node)
├── filesout.js       # NS.files: workbook(sheets), pdf(doc) (workbook part pure; PDF part needs the shipped writer)
├── books-ui.js       # NS.views['console-books'], actions, menu count
├── audit.js          # edited: events split from allocation; income, gains, holdings and cash from the journal; new schedules
└── operations.js, console.js   # edited narrowly: paid/cancel for scheduled distributions; GP share of a distribution
assets/vendor/pdfwrite/   # the two library files, licences, SHA256SUMS
.planning/phases/11-…/checks/
├── books-math.js     # T1-T4, T7-T9, T13-T15: journal, posting, ties to the engine, hand-worked funds (Node, no browser)
├── bank-files.js     # T12, T5: every fixture file parsed, control totals, no duplicates, matching, reconciliation
├── files-out.js      # T11: workbook reopened with openpyxl and LibreOffice, PDF text read back, totals compared
├── books-flow.js     # the Accounting page and the package button in the sandboxed frame, both sizes
└── fixtures/         # hand-worked funds (JSON with expected figures), bank files (made up; no real account data)
```
Console facts the page must follow [VERIFIED: 09-RESEARCH.md "How the console is built", and console.js:37-64 read this session]: the menu is `NAV` (console.js:37-56) grouped by `NAV_SECTIONS` (58-64: `''`, `'Raise'`, `'Operate'`, `'Report'`, `'Settings'`); a page is `NS.views['console-x'] = { mode: 'console', edition: 'diy', render() }` built with `NS.consoleKit`; actions go through `NS.actions`; three page shells list every script by hand (`index.html`, `diy.html`, `portal.html`); roles are `can('configure')` (owner) and `can('operate')` (team). `audit.js` is loaded by both editions (index.html:35, diy.html:36): the re-pointing changes the managed edition's Audit page too, which is why its regression check exists.

### Pattern 1: post from records, keyed, in one place
**What:** a pure function turns each stored record into at most one entry with a stable `src` key; `sync` adds the missing ones. Called from the save and load path, not from each button's handler.
**Why:** hooks in every action handler get missed, and history already saved in browsers would have no entries. One function covers both, and running it twice changes nothing (T13).

### Pattern 2: the journal holds fund totals; the engine holds the partner split
**What:** partner ids only on a partner's own cash lines. Allocation of income, fees and carried interest stays in `audit.js`.
**Why:** it is how partnership books are kept (a capital total in the ledger, a capital account schedule beside it), it keeps storage small, and it leaves the proven allocation code alone. The price is one tie-out, T3, which must hold every month.

### Pattern 3: amounts, not rates
**What:** the engine receives each month's income and gains in cents.
**Why:** a rate times a base is a model; a ledger amount is a fact. The largest-remainder split (audit.js:130-150) already allocates any whole amount exactly.

### Pattern 4: closed means frozen and provable
**What:** closing stores a hash of the trial balance text. Any later difference is shown as an exception.
**Why:** today a change to a fee rate rewrites every past month silently (the engine recomputes from inception). A CPA must be able to rely on a year once it is handed over.

### Pattern 5: one schedule shape, three writers
**What:** every table is the existing schedule object; CSV, workbook and PDF writers all take it.
**Why:** the on-screen figure, the file figure and the package figure cannot differ if they are the same rows.

### Anti-Patterns to Avoid
- **Money as a decimal number.** Positions hold dollars as numbers (operations.js:101); convert once with `Math.round(x * 100)` exactly as the engine does and never do arithmetic in dollars.
- **Re-deriving which records count.** Take events from the engine's lists, or T4 will fail on an edge the engine handles (call-based versus position-based contributions, audit.js:179-193).
- **Editing or deleting a posted entry.** Reverse and re-post.
- **Storing the per-investor split of every month.** The engine recomputes it and the tie-out proves it.
- **A default fee, weight or rate for a real fund.** Unset means absent.
- **Parsing OFX with the browser's XML parser.**
- **Importing a statement twice.** Key by the bank's id, or the line hash.
- **A `fetch` anywhere on these paths; a Blob in IndexedDB; opening a PDF in the browser's viewer.** (AUTOPILOT.md)
- **A library, vendor or format name on a sponsor's screen.** "CSV", "OFX" and "BAI2" are what the bank's own download menu says and are needed on the upload control; nothing else.
- **Calling book figures tax figures.**

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Splitting an amount across investors | A new allocator | `largest()` (audit.js:130-150), `NS.data.allocate` (data.js:409-420) | Exact to the cent, already proven by the `roll` check |
| Fees, carried interest, high-water marks, classes, side pockets | Anything | The engine's monthly loop (audit.js:302-416), `NS.structures.waterfall` (structures.js:113-154) | Exists; the ledger only feeds it amounts |
| Zip, SHA-256, CSV with formula guard | New ones | `NS.audit.zip`, `sha256`, `toCsv` | Exist and are used by the audit package |
| PDF pages with Unicode names | A PDF writer | `NS.esignKit` helpers over the shipped writer (esign.js:404; record.js:297-340 is the model) | Solved in phases 3 to 6, including the font |
| Storing an uploaded file | A new store | `NS.ops.files` (operations.js:356-492) | Stores bytes, survives Safari's quirks |
| Change log | A second log | `NS.audit.log` (audit.js:929-945) | Hash-chained; the `log` check reads it |
| Business-day windows | New date math | `NS.ops.businessDays` (operations.js:28-36), `NS.nacha.isBankingDay` | Exist |
| Tax depreciation, K-1 lines, tax-basis capital | Any of it | The CPA | D-01 of phase 10: the portal does not prepare K-1s |
| A bank connection | A scraper or a feed | A file the sponsor downloads | $0, and no credentials ever touch the portal |

**Key insight:** the part of fund accounting that is hard to get right (who gets how much) is already built and checked. What is missing is small and plain: accounts, balanced entries, and real inputs. The risk in this phase is not difficulty; it is building a second copy of something the engine already does, or letting the two disagree.

## Runtime State Inventory

This phase changes how an existing engine gets its inputs, so state outside the repository matters.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | Workspaces already saved in browsers (`localStorage`, `sdesk1:ws:<id>` and `cvp2:ws:<id>`) have no `ws.books`. Saved sample firms carry a seeded change log (`ws.audit`). | Code: create `ws.books` when first needed and let `sync` post the history. No separate migration. A saved real workspace will see its generated figures disappear from the Audit page: say so in the plan and in the owner's walkthrough. |
| Stored data | Distributions saved as `'scheduled'` with a date now in the past | Data: FA-14 must offer "paid" or "cancelled" for each; none may be assumed paid |
| Live service config | None: the integration server stores verifications, screenings, invitations, outbox and events only (09-RESEARCH.md, server/lib/store.mjs:10) | None |
| OS-registered state | None | None |
| Secrets and env vars | None used by this phase | None |
| Build artifacts | The checks answer the two CDN addresses from `SCRATCH/vendor` (checks/lib.js:28-35). Once the writer ships in the repository the loader tries the local file first. | Code: keep the CDN address as the fallback so existing checks still pass; add a check that the shipped files match `SHA256SUMS` (the font files have one: checks/embed-data.js) |

## Common Pitfalls

### Pitfall 1: the tie-out that cannot pass
**What goes wrong:** journal capital and the engine's capital differ by the carried interest paid with distributions.
**Why:** defect 4 above: `run.gp` leaves the bank but no capital account.
**How to avoid:** post `gp` to 3300 and have the engine show it as a GP distribution (it already has a `gpOut` column), in the same plan that introduces T3.
**Warning sign:** T3 fails only for funds with a waterfall distribution.

### Pitfall 2: sample figures drift
**What goes wrong:** after the re-pointing, a sample firm's statements change by cents.
**Why:** the generator's amounts were `Math.round(rate * baseSum)` inside the month loop; computing them anywhere else changes the rounding.
**How to avoid:** keep the generator as the provider inside the same loop and have it emit the amounts it used. The check compares every schedule of every sample fund before and after, byte for byte.

### Pitfall 3: floating-point fees
**What goes wrong:** a fee recomputed outside the engine is one cent off.
**Why:** the engine computes `Math.round((feeBase * rate) / 12)` with a rate stored as a fraction (audit.js:340).
**How to avoid:** the journal takes the fee the engine computed; nothing recomputes it. The existing `fees` check already guards the expression (audit.js:1041-1048).

### Pitfall 4: a distribution's split changes after the fact
**What goes wrong:** an old distribution's per-investor amounts move when a position is later corrected.
**Why:** the split is recomputed from current positions on every render (data.js:409-420).
**How to avoid:** freeze the split on the entry when it is posted; in a closed period report any difference instead of applying it.

### Pitfall 5: every month re-posted on every save
**What goes wrong:** the page slows, or entries are duplicated.
**Why:** `sync` runs on each save and the engine rebuilds from inception.
**How to avoid:** index entries by `src`; post only what is missing; measure on the largest sample firm in the first plan.

### Pitfall 6: storage fills up
**What goes wrong:** the browser refuses to save and the portal falls back to memory only (workspace.js:27-40).
**Why:** journal plus bank lines plus the change log in one JSON value.
**How to avoid:** compact lines (arrays, not objects); statement files in the file store; a size check per sample firm; a cap on one import's size with a plain message.

### Pitfall 7: the same bank file in two formats
**What goes wrong:** a sponsor uploads January as CSV and again as OFX; every line doubles.
**Why:** the ids differ between formats.
**How to avoid:** besides the id, warn when an import's date range and account overlap lines already stored with the same dates and amounts, and ask before adding.

### Pitfall 8: signs
**What goes wrong:** deposits become payments.
**Why:** CSV exports disagree on sign; BAI2 has no sign at all; OFX is signed.
**How to avoid:** normalize in the parser to "money in is positive", show the first lines with words ("in", "out") at mapping time, and check OFX and BAI2 against their own balances and control totals.

### Pitfall 9: a suggested match accepted wrongly
**What goes wrong:** two investors wire the same amount in the same week and are swapped.
**Why:** amount and date are not identity.
**How to avoid:** more than one candidate is never auto-matched; the wire reference the portal tells investors to use (`wire().reference`, operations.js:216) is compared with the line's text to rank candidates.

### Pitfall 10: statements for the wrong kind of entity
**What goes wrong:** a single-property syndication's package shows fair value and no depreciation, and the CPA cannot use it as books.
**Why:** see the question flagged under "Statements".
**How to avoid:** cost and fair-value adjustment kept in separate accounts from the first plan; the trial balance in the package always shows both.

### Pitfall 11: three page shells
**What goes wrong:** the page works in one edition's file and not in the published one.
**Why:** `index.html`, `diy.html` and `portal.html` each list scripts by hand.
**How to avoid:** a check that the three lists agree for the new scripts the plan intends each to have.

### Pitfall 12: the download that the preview refuses
**What goes wrong:** the owner taps the package button on his phone and nothing is saved.
**Why:** unproven host behaviour for `.xlsx`, `.pdf`, `.zip`.
**How to avoid:** every sheet of the package is also a schedule viewable in-page; the orchestrator's owner-path walkthrough tries the save on the real host before the preview is published; if a type is refused, the existing `hostName` option (app.js:147) can offer another name.

### Pitfall 13: a workbook Excel repairs
**What goes wrong:** Excel opens the file with a repair notice.
**Why:** the two readers used here are more forgiving than Excel; openpyxl warned that the test file had no default style.
**How to avoid:** include the `cellStyles` element with the "Normal" style; keep sheet names within 31 characters and free of `: \ / ? * [ ]`; the owner or a CPA opens one real package in Excel and in Numbers before this is called working. [ASSUMED: the sheet-name limits, from training knowledge]

## Code Examples

### A balanced entry and its check (proposed shape)
```js
// a $300,000.00 call payment from PBP-1004 received 2026-01-15
{ id: 'je-000123', date: '2026-01-15', memo: 'Capital call 1', src: 'call:pb-fund-call-1:PBP-1004',
  lines: [ ['1000', 30000000], ['3000', -30000000, 'PBP-1004'] ], at: '2026-01-15T16:02:11Z', by: 'Portal (automatic)' }
// valid if and only if: every amount is a whole number, at least two lines, and the amounts sum to 0
```

### The smallest workbook that opened (run this session)
Seven parts in a stored zip made by `NS.audit.zip`: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheet1.xml`, `xl/worksheets/sheet2.xml`. Cells as written:
```xml
<!-- text: an inline string, so no shared-strings part is needed and nothing is read as a formula -->
<c r="A2" t="inlineStr"><is><t xml:space="preserve">1000 Cash</t></is></c>
<!-- a number with style 1 (number format #,##0.00;(#,##0.00)) -->
<c r="B2" s="1"><v>1250000.55</v></c>
<!-- a formula with its value stored beside it -->
<c r="B4" s="1"><f>SUM(B2:B3)</f><v>1250000.55</v></c>
```
Result: openpyxl 3.1.5 read both sheets, the numbers as numbers, the format string and the formulas; LibreOffice 24.2.7.2 converted both sheets to CSV with the sums shown as 1250000.55; a name containing `&`, `<`, `>` and `’` survived. The file was 5,293 bytes. Script: `SCRATCH/r11/spike/xlsx.js`. [VERIFIED: run] Not verified: Excel, Numbers.

Write money to the sheet as a decimal number of the currency (cents divided by 100) so a CPA can sum it; keep the cents for the check that re-reads the file.

### Reading a file in the preview
```js
// no fetch: the file comes from <input type="file"> exactly as the investor list upload does (invitations.js:1929-1941)
const bytes = new Uint8Array(await file.arrayBuffer());
const text = new TextDecoder('utf-8').decode(bytes);
```

## Proving the numbers

### Tie-outs the plans are measured by
| # | Tie-out | Passes when |
|---|---------|-------------|
| T1 | Every entry balances | Each entry's lines sum to 0; the trial balance sums to 0 at every month-end |
| T2 | Accounting equation | Assets less liabilities equals equity plus the year's income, expenses and gains, at every month-end |
| T3 | Journal capital equals the capital accounts | Net assets in the journal equal `P.fund.end + P.fund.gpEnd` from `NS.audit.period` for every fund and month-end (the existing `nav` check, audit.js:971-973, with real inputs) |
| T4 | Contributions and distributions per investor | For every investor and period, journal lines on 3000 and 3100 carrying that investor's id equal `a.contrib` and `a.dist`; fund totals equal schedule 06's totals |
| T5 | Cash | Book cash at a reconciled date, less outstanding items, equals the statement's ending balance: difference 0 |
| T6 | Statements tie to each other | Net assets on the statement of assets and liabilities = end of period on the changes statement; net increase from operations is the same on both; the schedule of investments' fair value and cost equal accounts 1100 + 1150 and 1100; the change in cash on the cash flow statement equals the change in account 1000 |
| T7 | Allocation is complete | The investors' allocated amounts plus the GP's sum exactly to the journal's income, expenses and gains for the period (no cent left over) |
| T8 | Fees | Account 5000 for the period equals the engine's fees; account 2100 equals fees accrued less fee payments matched at the bank; the existing `fees` check still passes |
| T9 | Sample firms unchanged | For each of the 15 sample funds, every schedule file of the audit package for the last fiscal year and since inception is byte-identical before and after the re-pointing (new schedules aside) |
| T10 | Hand-worked funds | The two examples below, and a third for a property with a mortgage, reproduce to the cent |
| T11 | Files say what the ledger says | The workbook is reopened (openpyxl; LibreOffice) and the PDF's text read back (`pdftotext`); each total found equals the ledger's; the manifest's hashes verify |
| T12 | Bank files | Each fixture parses to its expected lines; BAI2 control totals and record counts agree; OFX ledger balance agrees with the lines |
| T13 | Posting is repeatable | Running `sync` twice adds nothing; importing the same statement twice adds nothing |
| T14 | Closed stays closed | After a close, changing a record dated inside it leaves every entry as it was and raises an exception naming the record |
| T15 | Return crosswalk | The Schedule L-ordered balance sheet's total assets equal its total liabilities and capital; beginning capital + contributions + book net income - distributions = ending capital, and equals T3 |

### Hand-worked fund A (closed-end, calendar 2026)
Worked by hand this session; the arithmetic was re-checked with a short script. The plan turns it into a fixture and has it re-derived independently.

Two limited partners, A committed $600,000 and B $300,000; no GP capital; management fee 2% a year on commitments, charged monthly; no carried interest.

| Date | Event | Amount |
|------|-------|--------|
| Jan 15 | Call 1, 50% of commitments, received: A $300,000, B $150,000 | 450,000.00 |
| Jan 20 | Investment X bought | 400,000.00 |
| each month | Fee: A $1,000.00, B $500.00 | 1,500.00 |
| Mar 31, Jun 30, Sep 30 | Fees paid for the quarter | 4,500.00 each |
| Mar 10 | Legal fees paid | 7,500.00 |
| Jun 30 | Dividend received from X | 12,000.00 |
| Sep 30 | X valued at $460,000 | +60,000.00 |
| Dec 15 | Distribution, pro rata by amount invested: A $6,000, B $3,000 | 9,000.00 |
| Dec 31 | X valued at $490,000 | +30,000.00 |

Trial balance at December 31, before closing:

| Account | Debit | Credit |
|---------|-------|--------|
| 1000 Cash | 32,000.00 | |
| 1100 Investments, at cost | 400,000.00 | |
| 1150 Unrealized appreciation | 90,000.00 | |
| 2100 Management fees payable | | 4,500.00 |
| 3000 Contributions | | 450,000.00 |
| 3100 Distributions | 9,000.00 | |
| 4010 Dividend income | | 12,000.00 |
| 5000 Management fees | 18,000.00 | |
| 5100 Professional fees | 7,500.00 | |
| 6100 Net change in unrealized appreciation | | 90,000.00 |
| Total | 556,500.00 | 556,500.00 |

- Statement of assets and liabilities: investments at fair value $490,000.00 (cost $400,000.00); cash $32,000.00; total assets $522,000.00; liabilities $4,500.00; net assets $517,500.00.
- Statement of operations: income $12,000.00; expenses $25,500.00; net investment loss ($13,500.00); net change in unrealized appreciation $90,000.00; net increase in net assets from operations $76,500.00.
- Changes in partners' capital: 0 + 450,000.00 - 9,000.00 + 76,500.00 = $517,500.00.
- Capital accounts: A = 300,000 - 6,000 + 8,000 - 5,000 - 12,000 + 60,000 = $345,000.00 (66.6667%); B = 150,000 - 3,000 + 4,000 - 2,500 - 6,000 + 30,000 = $172,500.00 (33.3333%). Every month's bases stay exactly 2 to 1, so no rounding choice enters.
- Cash flows: net increase from operations 76,500.00; less unrealized appreciation (90,000.00); purchase of investments (400,000.00); increase in fees payable 4,500.00; net cash used in operating activities (409,000.00); contributions 450,000.00; distributions (9,000.00); net cash from financing 441,000.00; increase in cash 32,000.00.
- Return crosswalk (book figures): Schedule L line 1 cash 32,000; line 8 other investments 490,000; line 14 total assets 522,000; line 17 other current liabilities 4,500; line 21 partners' capital 517,500; line 22 522,000. Book net income 76,500 includes 90,000 of unrealized appreciation, the M-1 line 6 item.

### Hand-worked fund B (open-ended, two months)
Management fee 1.2% a year on NAV (opening capital plus the month's subscriptions), incentive 20% of gains above each investor's high-water mark, accrued monthly. The engine's order for a month is: capital before incentive = opening + subscriptions + income + gain - fee + incentive accrued last month; incentive accrued = 20% of that less the high-water mark, not below zero; ending capital = the difference (audit.js:340-374).

| Month | Event | A | B | Fund |
|-------|-------|---|---|------|
| Jan | A subscribes | 1,000,000.00 | | |
| Jan | Gain for the month | 30,000.00 | | 30,000.00 |
| Jan | Fee: 1,000,000 x 0.1% | (1,000.00) | | (1,000.00) |
| Jan | Capital before incentive | 1,029,000.00 | | |
| Jan | Incentive accrued: 20% x 29,000 | 5,800.00 | | |
| Jan | Ending capital | 1,023,200.00 | | NAV 1,029,000.00 |
| Feb | B subscribes | | 500,000.00 | |
| Feb | Loss for the month, split by 1,023,200 : 500,000 | (10,076.16) | (4,923.84) | (15,000.00) |
| Feb | Fee | (1,023.20) | (500.00) | (1,523.20) |
| Feb | Capital before incentive | 1,017,900.64 | 494,576.16 | |
| Feb | Incentive accrued | 3,580.13 | 0.00 | 3,580.13 |
| Feb | Ending capital | 1,014,320.51 | 494,576.16 | NAV 1,512,476.80 |

The split of the loss shows the largest-remainder rule: A's exact share is 1,007,615.546 cents and B's 492,384.454; the spare cent goes to A. Journal NAV for February: 1,029,000.00 + 500,000.00 - 15,000.00 - 1,523.20 = 1,512,476.80, the same figure.

### What a hand-worked example cannot prove
That the statement formats are what a CPA expects. That needs a CPA reading one real package: the owner's check, ideally with the CPA partner being looked into under D-03.

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| K-1 item L on any method (GAAP, section 704(b), tax) | Tax-basis method required | Tax years from 2020 [ASSUMED: the year; the 2025 instructions read this session state the tax-basis method as the method] | The portal's book capital accounts are not what item L reports; the package must say "book" |
| Bank screen-scraping | Bank data services with a per-connection monthly fee | - | No free feed; file upload is the $0 route |
| Schedule K-1 only | Schedules K-2 and K-3 for international items, with a filing exception (Schedule K line 16) | Tax years from 2021 [ASSUMED: the year; lines 16a and 16b are on the 2025 form read] | Funds with foreign partners or foreign income need more from the CPA; out of the portal's scope |

## Plans (about 100k tokens each)

| # | Plan | Depends on | Wave |
|---|------|-----------|------|
| 01 | The journal: chart templates, entry rules, posting from the engine's events, trial balance, general ledger, close and its hash; `books-math.js` with T1, T2, T4, T13, T14 and hand-worked fund A; storage size measured | - | 1 |
| 02 | Bank files: detect and parse CSV (with mapping), OFX 1 and 2, BAI2; normalize; never twice; matching; reconciliation math; `bank-files.js` with made-up fixture files (T5, T12) | - | 1 |
| 03 | Files out: workbook writer over the existing zip; the PDF writer shipped in the repository with hashes and licences; a table-to-PDF routine on the signing helpers; `files-out.js` (T11) | - | 1 |
| 04 | Distributions made right: a scheduled distribution becomes paid or cancelled; the GP's share is a GP distribution in the capital accounts (FA-14); RED-first checks | - | 1 (touches console.js, operations.js, audit.js: alone among wave-1 plans on those files) |
| 05 | The engine reads the ledger: events split from allocation; income, gains, holdings, cash and payables from the journal; no defaults or generated figures for a real fund; sample funds through the same path; T3, T7, T8, T9; hand-worked fund B | 01, 04 | 2 |
| 06 | Valuations, NAV finalization and year-end close as ledger operations; redemptions fixed at a finalized month (FA-05, FA-07) | 01 | 2 |
| 07 | Statements: cash flows, financial highlights ratios, trial balance, general ledger and bank reconciliation as schedules on the Audit page; statement ties (T6, T15) | 05, 06 | 3 |
| 08 | The Accounting page: bank upload, mapping, matches, categorizing, reconcile; entries; valuations; opening balances; close; self-serve edition; frame check at both sizes | 01, 02, 06 | 3 |
| 09 | The year-end package: sheets, PDF, zip, README, manifest, the button, the choice about signed tax forms; in-page view of every sheet; frame check including the save; the report builder's interface written down and exercised by a check | 03, 07 | 4 |

Nine plans in four waves. Wave 1 is four plans with no shared file between 01, 02 and 03; 04 edits shared files and must not run beside another plan that does. In wave 2, 05 edits `audit.js` and 06 edits `books.js` and `operations.js`. In wave 3, 07 edits `audit.js` and 08 adds new files plus one menu line. Nothing is called working before the owner has opened a real package and a CPA has read one.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The statement set and captions for a nonregistered investment partnership under ASC 946 are as listed | Statements | Statements a CPA or auditor sends back; fixed by a CPA's review before launch |
| A2 | A cash flow statement is required unless every ASC 230-10-15-4 condition is met, and closed-end funds with private holdings do not meet them | Statements | One statement too many, or missing |
| A3 | Financial highlights for a nonregistered partnership are IRR (closed-end) or total return (open-ended) plus expense and net investment income ratios | Statements | Missing or surplus disclosures |
| A4 | A single-property syndication or DST is usually not an investment company and reports at cost or on the tax basis | Statements, Pitfall 10 | The wrong presentation for the portal's most common customer |
| A5 | Carried interest is an allocation of capital between partners, not an expense or a liability | The ledger | The statement of operations would need a carried interest line |
| A6 | A capital call that is issued and unpaid is not recorded as an asset | Posting rules | A receivable and matching capital missing at period end |
| A7 | OFX 1 files use the same tags as OFX 2 without closing tags on values | Bank reconciliation | The tokenizer misreads real bank files; fixed by a real file in the fixtures |
| A8 | BAI2 type codes 100 to 399 are credits and 400 to 699 debits; summary codes give opening and closing balances | Bank reconciliation | Signs or balances wrong; the control-total check does not catch a sign error |
| A9 | U.S. banks' business portals commonly offer CSV, OFX/QFX/QBO, and BAI2 on treasury portals | Bank reconciliation | A sponsor's bank offers only PDF; they cannot reconcile |
| A10 | The preview frame's storage limit is about 5 MB | Storage | Saves refused earlier than expected |
| A11 | Journal sizes (tens of KB per fund-year) | Storage | The journal needs its own store; found by the first plan's measurement |
| A12 | The Claude app's save prompt accepts `.xlsx`, `.pdf` and `.zip` | Pitfall 12 | The owner cannot test the package on his phone; the in-page view remains |
| A13 | Excel and Numbers open the in-house workbook without repair | Standard Stack | A repair notice in front of a CPA; fixed by adding parts Excel wants |
| A14 | The suggested Schedule L line per account | Chart of accounts | A misleading hint; it is labelled a suggestion |
| A15 | Outside prices as listed | Outside services | A cheaper service missed; the no-server requirement rules them out anyway |
| A16 | Tax-basis reporting for item L since 2020; Schedules K-2/K-3 since 2021 | State of the Art | Wrong dates in a README; the requirement itself was read |
| A17 | `write-excel-file`, `xlsx`, `exceljs`, `ofx-data-extractor`, `medici` as described | Alternatives | None recommended |
| A18 | Sheet names: at most 31 characters, none of `: \ / ? * [ ]` | Pitfall 13 | Excel refuses the workbook |

## Open Questions (owner decisions)

1. **Real estate syndications: which statements?**
   - (a) The investment-company format for every fund type, as the Audit page does now; an investment stays at cost until the sponsor enters a value; no depreciation in the books; the package gives the CPA the property's cost, land and building split and placed-in-service date. No extra build.
   - (b) Add a cost-basis set for syndications (balance sheet with accumulated depreciation, income statement, with straight-line book depreciation the sponsor sets). About one more plan.
   - Recommendation: (a) now, with the accounts kept so (b) can follow, and ask a CPA which one their small syndication clients expect before building (b). Cost of either: $0.

2. **The PDF writer: ship it in the repository, or keep fetching it?**
   - (a) Ship the two files (1.28 MB, MIT, $0). Signing stops depending on the CDN too.
   - (b) Keep loading from the CDN: nothing added, and the package fails wherever the CDN is unreachable.
   - Recommendation: (a).

3. **Bank connection.**
   - (a) Statement file upload only: $0, works in the preview.
   - (b) A bank data service later: about $0.30 per connected account a month by the figures found (unconfirmed), plus a server and keys.
   - Recommendation: (a) now; revisit with launch item 11.

4. **Signed W-9 and W-8 files in the package.** They are the only place the full taxpayer numbers exist.
   - (a) Included when the sponsor ticks a box at download (off unless ticked). (b) Always. (c) Never; the CPA asks the sponsor.
   - Recommendation: (a). The cover sheet says whether they are inside.

5. **The existing defects.** Fix "scheduled distributions never become paid" now as a small debug task, or inside plan 04?
   - Recommendation: now. It affects any test of distributions today and is independent of the ledger.

6. **Sponsors who already keep books elsewhere.** A trial balance upload instead of bookkeeping in the portal would serve them, at about one plan.
   - Recommendation: not in this phase; record it as a later option.

7. **A CPA's read before launch.** The statement formats and the package layout rest on unread standards.
   - Recommendation: the owner asks one CPA (the partner under D-03 if there is one by then) to read a sample package; nothing is called ready before that.

8. **What real funds see on the Audit page the day this ships.** Their generated gains, fees and cash disappear, and statements show only what is recorded. That is the correct behaviour and a visible change.
   - Recommendation: accept; the Audit page says what is not yet recorded (no bank statement, no valuation) in one line each.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Checks, pure modules | Yes | v22.23.4 | - |
| Python 3 | Reopening workbooks in checks | Yes | 3.13.18 | - |
| openpyxl | T11 | Yes | 3.1.5 | LibreOffice |
| LibreOffice (headless) | T11 | Yes | 24.2.7.2 | openpyxl |
| pypdf, `pdftotext` | T11 (PDF text) | Yes | pypdf 6.17.0 | - |
| pdf-lib and fontkit files | Plan 03 | Yes, in `SCRATCH/vendor` (same files the checks use) and from `registry.npmjs.org` | 1.17.1, 1.1.1 | - |
| Browser check queue (`SCRATCH/exec-011/heavy.sh`) | Frame checks | Yes, per AUTOPILOT.md | - | - |
| www.irs.gov | Forms and instructions | Yes | 2025 forms | Saved in `SCRATCH/r11/irs/` |
| registry.npmjs.org, raw.githubusercontent.com | Library facts, sample files | Yes | - | - |
| asc.fasb.org, AICPA, audit-firm sites | Statement formats | No | - | A CPA's review |
| www.sec.gov | A real fund's statements as a model | Unreliable this session (503, timeout) | - | - |
| Microsoft Excel, Apple Numbers | Final proof of the workbook | No | - | The owner or a CPA opens one |
| Real bank export files | Parser proof on unseen files | No | - | Made-up fixtures now; the owner's own bank's export (with numbers masked) before this is called working |
| Disk | Fixtures, vendor files | 5.2 GB free | - | Fixtures are kilobytes |

**Missing with no fallback:** none for building. **Missing with fallback:** standards text (a CPA), Excel and Numbers (the owner), real bank files (the owner's bank).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Checks | Node scripts under the phase's `checks/`, last line `NAME: PASS (...)`; they load the browser scripts into a `vm` context (the pattern in phase 6's `status-math.js:21-28`, used this session in `SCRATCH/r11/spike/`) |
| Browser checks | Through `SCRATCH/exec-011/heavy.sh`, in the sandboxed frame with the no-network policy, at 390x844 with touch and 1280x800 |
| Server tests | `node --test` in `server/` (197 in the last passing gate); this phase adds none |
| Quick run | `node .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/books-math.js` and `…/bank-files.js` |
| Full gate | `.planning/checks/gate-reference.sh` plus this phase's checks; counts follow the merged tree |

### Requirements to checks
| Req | Behaviour | Type | Command | Exists? |
|-----|-----------|------|---------|---------|
| FA-01 | Entries balance; trial balance sums to zero at every month-end (T1, T2) | unit | `books-math.js` | No, plan 01 |
| FA-02 | Each record posts once; journal ties to the engine per investor (T4); repeat adds nothing (T13) | unit | `books-math.js` | No, plan 01 |
| FA-03 | A new firm with two contributions shows zero income, gain, fee and no invented reference (the probe in `SCRATCH/r11/spike/custom.js`, turned into a check: fails today) | unit | `books-math.js` | No, plan 05 |
| FA-03 | Sample funds' audit packages byte-identical before and after (T9) | regression | `books-math.js --regress` | No, plan 05 |
| FA-04 | Fee expense equals the engine's fees; payable equals accrued less paid (T8) | unit | `books-math.js` | No, plan 05 |
| FA-05 | NAV in the journal equals the capital accounts every month (T3); hand-worked fund B | unit | `books-math.js` | No, plans 05, 06 |
| FA-06 | Every fixture parses; control totals agree; no duplicates; matching; difference zero (T5, T12) | unit | `bank-files.js` | No, plan 02 |
| FA-07 | A closed period does not move; the change is reported (T14) | unit | `books-math.js` | No, plans 01, 06 |
| FA-08 | Statements tie (T6, T15); hand-worked fund A's statements | unit | `books-math.js` | No, plan 07 |
| FA-09, FA-10 | Package files reopen and agree with the ledger; manifest verifies (T11) | integration | `files-out.js` | No, plans 03, 09 |
| FA-11 | Each interface call returns the documented shape for a sample fund | unit | `books-math.js` | No, plan 09 |
| FA-12 | The page and the button work in the frame at both sizes, no network call, a way out, no banned word or vendor name | browser | `books-flow.js` through heavy.sh | No, plans 08, 09 |
| FA-12 | Managed edition menu unchanged | existing + assertion | `status-math.js`, a menu assertion | Partly |
| FA-14 | A scheduled distribution past its date can be marked paid or cancelled and then reaches (or never reaches) capital; a distribution with a GP share reduces the GP's accrued amount | unit | `books-math.js` | No, plan 04 |

### Sampling Rate
- **Per task commit:** the Node checks (seconds).
- **Per plan merge:** the full gate.
- **Phase gate:** full gate green; the orchestrator's owner-path walkthrough on the preview conditions; then the owner's own check, and a CPA's read of one package, before anything is called done.

### Wave 0 Gaps
- [ ] `checks/books-math.js`, `checks/bank-files.js`, `checks/files-out.js`, `checks/books-flow.js`
- [ ] `checks/fixtures/`: hand-worked funds A and B (above) and a third with a property and a mortgage; made-up bank files in each format, including one CSV per layout seen (signed amount; separate in and out columns; with and without a balance column)
- [ ] A real export from the owner's bank, numbers masked, as the unseen file
- [ ] `assets/vendor/pdfwrite/` with `SHA256SUMS` and licences, and its check

RED first: each check is written and seen to fail before the code it covers.

## Security Domain

`security_enforcement` is on, ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | Nothing added; the console's sign-in stands |
| V3 Session Management | no | Nothing added |
| V4 Access Control | yes | Closing, reopening, opening balances and the package download need the owner role (`can('configure')`); bank upload, categorizing and entries need `can('operate')`; investors see none of it |
| V5 Input Validation | yes | Uploaded files are untrusted: size cap, type sniffed from content, a tokenizer (never `eval`, never the XML parser), whole-cent integers only, dates validated, entries refused unless they balance |
| V6 Cryptography | yes | `NS.audit.sha256` for the trial balance hash and manifest; nothing new |
| V7 Logging | yes | Each import, entry, reversal, match, close, reopen and download in the change log (`NS.audit.log`), without account numbers beyond the last four |
| V8 Data Protection | yes | Taxpayer numbers stay last-four; the signed forms enter the package only by an explicit choice; bank account numbers stored as last four |

### Known Threat Patterns
| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| A bank description beginning with `=` or `+` runs as a formula in the CPA's spreadsheet | Tampering | Text is written as an inline string in the workbook (never a formula); CSV keeps the existing guard (`/^[=+\-@\t\r]/`, audit.js:1341) |
| Markup in a description breaks the worksheet XML or the page | Tampering | Escape `& < > "` in every cell; `h()` on every value shown |
| An oversized or malformed file freezes the page or fills storage | Denial of service | Size and line caps; parse off the stored bytes; refuse on control-total mismatch |
| Entity tricks in an XML-style statement file | Tampering | Tokenizer only |
| Quiet rewriting of last year's books | Tampering / Repudiation | Entries never edited; closed-period hash; hash-chained log; reopening logged and owner-only |
| A team member closes or reopens a year | Elevation of privilege | Owner role on those actions |
| The package, with investor tax facts, saved to a shared phone | Information disclosure | Masked numbers by default; signed forms only on request; the download is logged with its hash |
| Real bank or investor data in fixtures | Information disclosure | Made-up fixtures; a real export only with numbers masked, never committed unmasked |

## Sources

### Primary (read this session)
- `https://www.irs.gov/pub/irs-pdf/f1065.pdf`, `i1065.pdf`, `f1065sk1.pdf`, `i1065sk1.pdf`, `f8825.pdf`, `f4562.pdf` (tax year 2025; Form 8825 Rev. December 2025): Schedule B question 4, Schedules K, L, M-1, M-2, K-1 Part II, item L instructions. Saved in `SCRATCH/r11/irs/`.
- `https://raw.githubusercontent.com/csingley/ofxtools/master/tests/data/stmtrs.ofx`: an OFX 2 statement.
- `https://raw.githubusercontent.com/moov-io/bai2/master/README.md` and `test/testdata/sample1.txt`, `sample2.txt`: BAI2 records (Apache-2.0 project).
- `https://registry.npmjs.org`: versions, licences, publish dates and file sizes of pdf-lib, @pdf-lib/fontkit, xlsx, exceljs, write-excel-file, jspdf, fflate, jszip, papaparse, ofx-data-extractor, medici.
- The codebase at the files and lines cited; three scripts run against it in `SCRATCH/r11/spike/` (`measure.js`, `custom.js`, `xlsx.js`).

### Secondary (search summaries only; pages not opened)
- KPMG and CohnReznick illustrative financial statements for private equity and hedge funds: `https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/illustrative-financial-statement-pe-funds-2025.pdf`, `https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/illustrative-financial-statement-hedge-funds-2025.pdf`, `https://www.cohnreznick.com/-/media/resources/PrivateEquity-Illustrative-Financial-Statement-2024.pdf`, `https://www.cohnreznick.com/-/media/resources/hedge-fund-illustrative-financial-statement-2025.pdf`. These are the first documents to read when the hosts are allowed.
- Deloitte's roadmap chapter on the scope of ASC 230: `https://dart.deloitte.com/USDART/home/codification/presentation/asc230-10/roadmap-statement-cash-flow/chapter-2-scope/chapter-2-scope`
- Plaid: `https://plaid.com/docs/account/billing/`, `https://plaid.com/pricing/`. Teller: `https://teller.io/`. Stripe: `https://stripe.com/pricing`.

### Tertiary (search summaries of third-party pages; leads only)
- Fund software prices: `https://www.capterra.com/p/146519/Fundwave/`, `https://www.softwareadvice.com/hedge-fund/fundcount-profile/`, `https://www.capterra.com/p/10020166/NAVsphere/`, `https://www.altexchange.com/pricing`, `https://vcbeast.com/best-fund-admin-software`
- Bank export formats: `https://cbna.com/faq/what-are-the-different-file-types-used-to-download-transaction-data`, `https://ecorp-fnb.fnb-online.com/ebc_fnb/Help/Content/DownloadTransactions.htm`, `https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1508961121.html`
- Plaid and bank-data price estimates: `https://www.activepieces.com/blog/plaid-pricing-2026-cost-per-connection-and-request`, `https://startupik.com/bank-data-api-cost-startup-2026/`, `https://vertice.one/vendors/stripe`
- QuickBooks Online plan prices: `https://costbench.com/software/accounting/quickbooks-online/free-plan/`, `https://www.certumsolutions.com/library/quickbooks-online-plans-compared`

No fetched page or file contained text addressed to an automated reader or any instruction to act on. (A scan flagged one "invisible character" in `assets/js/audit.js`: it is the byte-order mark the CSV writer puts at the start of each file, audit.js:1350.)

## Metadata

**Confidence breakdown:**
- What is stored and what is derived today; the defects: HIGH - files read at the cited lines; three scripts run.
- File writing with what the repository ships: HIGH for zip and workbook in two readers; MEDIUM until Excel, Numbers and the iPhone save are tried.
- Form 1065 inputs: HIGH - IRS forms and instructions read.
- Ledger design and tie-outs: MEDIUM - reasoned from the code and worked examples; proven only when plan 01 and 05's checks pass.
- GAAP statement formats: LOW - no standards text read.
- Bank file formats: MEDIUM for OFX 2 and BAI2 records (real samples); LOW for OFX 1, BAI2 code meanings and what each bank offers.
- Outside prices: LOW - search summaries.

**Research date:** 2026-11-19
**Valid until:** 2026-12-19 for the code findings (they move with every merge to `audit.js`, `operations.js`, `console.js`); the IRS forms are the 2025 set and change yearly; prices should be re-read on the day a decision depends on them.
