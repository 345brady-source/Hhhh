# Phase 12: Report builder - Research

**Researched:** 2026-11-20
**Domain:** investor reporting for private funds and real-estate sponsors; in-browser report composition, PDF and spreadsheet output, delivery to the investor portal
**Confidence:** see Metadata at the end (section by section)

Notes for readers: this file is written section by section and pushed after each one (owner's save rule). A section marked "(pending)" has not been written yet.

## Summary

(pending: written last, from the sections below)

<user_constraints>
## User Constraints

There is no 12-CONTEXT.md yet (no discuss-phase was run). The constraints below are the owner's own decisions, copied verbatim from the files named, and the standing rules every agent works under. The planner treats them as locked.

### Locked decisions (owner, verbatim)

From .planning/phases/01.4-*/01.4-RESUME.md line 98 (owner, 2026-11-15):
> Premium report builder (owner, 2026-11-15; about one day of build, about 10 percent of weekly usage; no API; the word "basic" is never used): a few templates for each report type (quarterly letters by fund type such as real estate, private credit or income, venture or private equity, single-asset; annual review; other report types sponsors send), in the sponsor's brand; research real published investor reports on the web first for inspiration and a side-by-side comparison. Section builder, chart choices, cover and accents, saved templates per offering or firm, editable disclosures; figures from the ledger (capital account, contributions, distributions, ownership, IRR, multiple, DPI, TVPI); asset pages with photos; the sponsor's letter in a rich-text editor; batch generate, preview, publish with email; PDF and spreadsheet; archive.

From the same file, line 99:
> Owner: most quarterly reports cover several funds of different types. The builder makes a consolidated report per investor across all their holdings with the sponsor (summary totals plus one section per fund, each laid out for its fund type) and a sponsor-wide letter covering every fund; research focuses on real multi-fund reports.

From .planning/ROADMAP.md, Phase 12 goal:
> A premium report builder inside the portal: report templates per report type (investor statements, capital account statements, distribution notices, quarterly and annual investor letters, fund performance and holdings summaries, tax-season summaries), each built from the data the portal already holds (capital accounts, journal, distributions, calls, holdings, tax documents), highly customizable by the sponsor (sections on or off and reordered, the firm's branding, wording blocks, date range, per-fund or per-investor), previewed on screen and exported as PDF and spreadsheet with the shipped writers, and delivered to investors through the portal's documents; no outside API; all in the browser with no server, proven in the owner's iPhone conditions. Nothing is called ready before the owner has checked it.

Launch list task (orchestrator brief): "Premium report builder: templates per report type, highly customizable (no API)".

Owner's scope rule (orchestrator brief): "only what is legally required / 100% necessary", plus what makes the product sellable.

### Standing rules (.planning/AUTOPILOT.md, CLAUDE.md)
- White label: no vendor, model or library names in anything a sponsor or investor sees (this includes PDF metadata fields Producer and Creator, and spreadsheet properties). The word "basic" never appears.
- Nothing mandatory for investors (D-30). No extra text on screens; build only what the law or the task needs.
- Managed (Carrow & Vale) edition unchanged unless a plan says otherwise (C-03 slice guard in status-math).
- The owner tests on an iPhone inside the Claude app (WKWebView, sandboxed iframe, no server): checks run at 390x844 with touch and at 1280x800, inside a sandboxed frame whose CSP blocks connect-src; no fetch()/XHR on any path that must work without a server; no Blob stored in IndexedDB (store bytes); no browser PDF viewer (draw pages in-page); every view has a way out on screen; dialogs scroll.
- No paid API calls by agents; no outside service with a monthly fee unless the owner chooses it; the $0 path first.
- RED-first checks; every behaviour change has a check that fails before and passes after; the full gate is .planning/checks/gate-reference.sh.
- Save rules (.planning/SAVE-RULES.md) apply to every agent; commit trailer lines exactly as in AUTOPILOT.md.
- Never call anything ready, working or done before it has been tested and the owner has checked it.

### Claude's discretion
Everything not fixed above: the section catalogue per template, the storage shape of templates and runs, the PDF layout writer, the rich-text subset, chart forms, file ownership and plan breakdown. Recommendations are made below.

### Deferred ideas (out of scope for phase 12)
- Sending email from a server: phase 13 (email overhaul) owns the mail path. Phase 12 uses the portal's existing Notices page and its no-server behaviour ("own email" / simulated).
- Investor messaging and the data room: launch item 9.
- Preparing K-1s or 1099s: phase 10 (the report builder only summarises what phase 10 holds).
- Any outside reporting API or service (owner: "no API").
- The in-house reader (D-33).
</user_constraints>

## Part 1. What sponsors send, what investors expect, what the law requires

Sources for this part are web searches run this session (titles and addresses in Sources). Several primary sites (ilpa.org, law.cornell.edu) could not be fetched from this session (the host is outside the session's allowed network), so statements resting on them are tagged by what was actually read: a search digest that two or more independent sources agree on is `[CITED: ...]` (MEDIUM); a single source or training knowledge is `[ASSUMED]`. Nothing in this part is legal advice; the product shows "To be confirmed with counsel" where a sponsor relies on a legal point (AUTOPILOT rule for owner inputs).

### 1.1 Legally required versus customary (by offering type)

| Offering or investor type | Periodic investor reporting the law itself requires | Source and confidence |
|---|---|---|
| Rule 506(b) / 506(c) private placement (most sponsors on this portal) | None. The only SEC filing is Form D (filings tab, phase 9). Rule 502(b) information goes to non-accredited purchasers at the time of sale, not periodically. | `[CITED: sec.gov/smallbusiness/rule506b; sec.gov overview-exemptions-chart]` — the "no ongoing reporting" reading is an inference from Form D being the only listed filing, so it is a present fact about what is listed, not an affirmative statement; treat as `[ASSUMED]` for on-screen wording. |
| Regulation A Tier 2 | Form 1-K annual report within 120 days of fiscal year-end; Form 1-SA semiannual report within 90 days of the end of the first half; Form 1-U current reports within 4 business days of listed events; Form 1-Z exit report. These are SEC filings, not investor letters. | `[CITED: sec.gov/rules/final/2015/33-9741.pdf (adopting release, via search digest); investor.gov Reg A bulletin]` MEDIUM |
| Regulation A Tier 1 | No ongoing reports; Form 1-Z exit report only. | `[ASSUMED]` |
| Fund managed by an SEC-registered adviser that has custody (every GP of its own fund) | Custody rule 206(4)-2(b)(4) "audit approach": the pooled vehicle's audited GAAP financial statements are distributed to every investor within 120 days of fiscal year-end (180 days for a fund of funds; staff no-action position up to 260 days for top-tier funds of funds of funds). Otherwise quarterly account statements from a qualified custodian. | `[CITED: Winston & Strawn and Proskauer summaries via search; eCFR 17 CFR 275.206(4)-2 not fetched]` MEDIUM. The 260-day figure is `[ASSUMED]`. |
| Private fund adviser quarterly statement rule (Rule 211(h)(1)-2, adopted 2023) | None: vacated in full by the Fifth Circuit on 5 June 2024 (National Association of Private Fund Managers v. SEC). Its content list (fees, expenses, IRR and multiple with and without subscription facilities) still shapes what institutional investors ask for. | `[CITED: Morrison Foerster, Morgan Lewis, Mayer Brown, Holland & Knight summaries]` MEDIUM-HIGH (four firms agree) |
| Exempt reporting advisers and state-registered or unregistered sponsors (typical syndicator) | No federal periodic investor reporting. State law: the Delaware LP Act section 17-305 and LLC Act section 18-305 give a limited partner or member the right to obtain information (financial condition, tax returns, list of partners) on reasonable written demand for a proper purpose; it is on demand, not a schedule. | `[ASSUMED]` (training knowledge; not fetched) |
| Every partnership or LLC taxed as a partnership | Schedule K-1 to each partner by the due date of Form 1065 including extensions (calendar-year funds: 15 March, or 15 September when extended); penalties per late K-1. Phase 10 owns K-1 delivery; the report builder's tax-season summary only tells investors what is coming and when. | `[CITED: multiple tax-preparer sources via search; they conflict on whether the extension also moves the K-1 date]` — the "including extensions" reading is `[ASSUMED]` (IRC 6031(b), training) |
| ERISA benefit-plan investors | The plan (not the fund) files Form 5500 and needs the current (fair) value of its interest at the start and end of the plan year (Schedule H). A fund that holds plan assets must be ready to disclose holdings and values. In practice: a year-end statement of the plan's capital at fair value, delivered in time for the plan's audit. | `[CITED: DOL 2025 Form 5500 instructions and Ropes & Gray ERISA handbook via search]` MEDIUM |
| Fund documents (LPA / operating agreement / PPM) | This is where most reporting duties actually live: typical clauses require unaudited quarterly reports within 45 or 60 days of quarter-end (often not for Q4), annual audited or reviewed statements within 90 or 120 days, tax information within 75 to 90 days, and a notice for every capital call and distribution. | `[CITED: LawInsider sample clauses via search]` MEDIUM (samples, not a market standard) |
| SEC Marketing Rule (registered advisers) | Account statements, transaction reports and periodic reports to existing investors are generally not "advertisements", unless they also carry promotional content offering new or additional investment (then net performance must accompany gross, subscription-line effects must not mislead). | `[CITED: Morgan Lewis, Sidley, Willkie summaries of Release IA-5653 via search; sec.gov marketing FAQ fetched: subscription-facility net IRR answer]` MEDIUM |

What this means for the builder (the owner's rule "only what is legally required / 100% necessary"):
- The law requires very little periodic reporting from a 506 sponsor. What a sponsor is actually bound to send comes from its own fund documents (LPA notice and reporting clauses) and, for registered advisers, the custody rule's audited statements. The builder therefore must let the sponsor send exactly what its documents promise, on its schedule, and nothing forces a report the sponsor does not owe.
- Truly necessary for every sponsor (sellable floor): capital account statement per investor per period; distribution notice per payment; capital call notice (already shipped in operations.js `callNotice`, see Part 2); a periodic letter (quarterly or semiannual) with the fund's figures; a year-end statement (doubles as the ERISA plan investor's fair-value statement); a tax-season notice of when K-1s will arrive (phase 10 delivers the K-1 itself).
- Not built: Reg A Form 1-K / 1-SA filings (SEC filings with audited financials; outside a report builder and outside phase 9's Form D scope). The builder may produce a "semiannual report to investors" letter for a Reg A issuer, but it never claims to be the SEC filing. The audited financial statements under the custody rule are prepared by the fund's auditor; the builder can attach and deliver the auditor's PDF (existing Documents upload) but never generates "audited" statements.
- Any report shown to existing investors that also solicits a new or additional investment becomes an advertisement for a registered adviser. Rule for the builder: no "invest more" or new-offering section in an investor report template; performance sections that show gross figures always show net beside them. `[CITED: marketing rule summaries]`

### 1.2 What investors and their advisers expect (customary content)

Capital account statement (also called partner capital statement): beginning capital (equal to the prior period's ending), contributions, distributions, allocated income, realized and unrealized gain or loss, management fees, carried interest or incentive allocation, ending capital; ownership percentage; commitment, contributed to date, unfunded commitment, distributed to date (often split into return of capital and income/gain); both the period and year-to-date or inception-to-date columns. Book capital, not tax capital (the statement says so). `[CITED: Carta PCAP guide, StartEngine, Allocations, ILPA definitions via search]` MEDIUM

Distribution notice: the ILPA notice package is a cover letter (short narrative), a description, and a template with the accounting figures; per investor the gross amount, its character (return of capital, income, gain, interest), tax withheld, net paid, payment date and method, and cumulative distributions. The ILPA Capital Call and Distribution Template was updated in 2025 and applies to funds launched on or after Q1 2026 that adopt the new Performance Template (implementation Q1 2027 per one source). `[CITED: ILPA best practices v1.1 and 2025 template news via search; Katten, PERE]` MEDIUM. The per-line character and withholding detail is `[ASSUMED]` from practice, but it matches the data the portal already stores (runRows: gross, withheld, net, run.type).

Quarterly and annual letters: a sponsor letter (market and portfolio narrative), fund-level key figures, performance (net IRR, TVPI, DPI, RVPI for closed-end funds; monthly and year-to-date net returns for open-ended funds), the investor's own capital summary, a schedule of investments or property pages (real estate: occupancy, NOI, rent roll highlights, debt, LTV; credit: loans, coupon, maturities, defaults; venture/PE: company, cost, fair value, multiple), capital activity, outlook, and disclosures. Investors in syndications commonly expect a trailing-twelve-month P&L and rent roll per property. `[CITED: BiggerPockets threads, Starlight Q2 2026 LP newsletter (occupancy 95.0%, NOI margin, collections) via search]` LOW-MEDIUM (practice, not standard).

ILPA Reporting Template (institutional LPs): the updated template (released January 2025) is expected for funds in their investment period in Q1 2026 and funds starting on or after 1 January 2026; it breaks fees and expenses out in detail (internal chargebacks, partnership expenses aligned to the ledger, subscription line interest separate from bank fees, management fee gross-to-net with offsets). The new Performance Template applies to new funds: data captured from Q1 2026, first delivery Q1 2027, gross and net IRR and multiples with and without subscription facilities. `[CITED: ILPA hub, RSM, BDO, Proskauer, Alston via search digest]` MEDIUM. Consequence: a sellable builder offers a fees-and-expenses schedule laid out in the ILPA order from the ledger's expense accounts, and an ILPA-shaped spreadsheet export; it does not claim "ILPA compliant" on screen (not certified; the template's line items were not read this session).

Timing investors expect: quarterly reports 45 to 60 days after quarter-end, annual reports 90 to 120 days after year-end, K-1s by March 15 or a notice of the extended date. The builder shows the period end and the sponsor-set due date; it does not compute legal deadlines (they come from the fund documents). `[CITED: LawInsider samples]`

Multi-fund reality (owner, line 99): one investor holds several funds of different types. The customary institutional answer is a consolidated statement: a summary page with totals across holdings, then one section per fund laid out for its type. `[ASSUMED]` that this is customary in syndication portals; it is the owner's own decision, so it is locked regardless.

### 1.3 What competing sponsor portals offer for reports (features only; no vendor name ever on screen)

From vendor pages and comparison articles (self-reported marketing, LOW-MEDIUM):
- Per-fund report templates, several per fund, because investors ask for the same data in different layouts.
- Drag-and-drop report builder with designer templates; automatic capital account and NAV statements from the general ledger.
- Batch generation of personalized statements and notices for every investor in a fund, one-click publish to each investor's portal, email notice of the new document.
- Branding: logo, colors, reusable content blocks; custom one-page tear sheets for portfolio companies or properties.
- Report archive and a document-access audit trail (who opened or downloaded what, when).
- K-1 bulk delivery with matching (already phase 10 here).
- Pricing for the institutional tools is quote-based, one comparison lists about $35,000 a year and up. `[CITED: gitnux/fundcount comparison via search]` LOW

What the portal can offer that is a selling point against these: everything runs inside the sponsor's own portal at no extra fee, figures come from the same engine as the audit package and the CPA package (one source of truth, proven to the cent), and every report is delivered with the open record the tax documents already have.

### 1.4 Report types the builder ships (scope decision, traced to 1.1 to 1.3)

| # | Report type | Why it is in (law / necessity / sellable) | Frequency |
|---|---|---|---|
| T1 | Capital account statement (per investor; one fund or consolidated across funds) | Necessary: LPAs require it; every competitor ships it; ERISA year-end value | Quarterly, annual, any range |
| T2 | Distribution notice (per investor per payment run) | Necessary: LPA notice duty; ILPA notice practice | Per distribution |
| T3 | Quarterly investor letter (fund or sponsor-wide; templates by fund type: real estate, private credit or income, venture or private equity, single asset, open-ended) | Customary and owner-required; LPA quarterly reports | Quarterly (or semiannual) |
| T4 | Annual review (letter plus year statements; the Reg A semiannual or annual investor letter uses this layout) | LPA annual report; owner-required | Annual / semiannual |
| T5 | Performance and holdings summary (fund-level: performance metrics, schedule of investments or properties, fees and expenses in ILPA order) | Institutional expectation; owner's figures list (IRR, multiple, DPI, TVPI) | Any period |
| T6 | Tax-season summary (per investor: distributions in the year by type, tax withheld, which tax documents are coming and their status from phase 10, expected date) | Owner's list; reduces "where is my K-1" questions; never a tax form itself | Annual (Jan-Mar) |

Not shipped as builder templates: capital call notice (already shipped in operations.js callNotice and the Notices page; the builder may reuse its figures later but adding a second call notice path would duplicate a working one), audited financial statements (the auditor's), Reg A Forms 1-K/1-SA/1-U (SEC filings), K-1s and 1099s (phase 10).

## Part 2. The data the portal already holds, and where each report reads it

All file references below were opened with Read/sed this session on commit c8b65e7 (claude/refract-reskin). Values are quoted verbatim where they are discrete.

### 2.1 Read surfaces (what exists today)

| Surface | File:lines | Shape (verbatim where discrete) | Notes for the builder |
|---|---|---|---|
| `NS.audit.events(ws, o)` | assets/js/audit.js:185-241 | returns `{ S, invs, contribs, dists, strays, gpRuns, now }`; contribs `{ date, inv, cents, kind, ref }` with kind `` `Capital call ${c.number}` `` / `'Subscription'` / `'Capital contribution at closing'`; dists `{ date, inv, cents, run }` | Money events only; no allocation. Distribution notices and the capital activity list read this. |
| `NS.audit.ledger(ws, o)` | audit.js:243-521 | `L = { o, S, invs, contribs, dists, strays, redemptions, keys, months, byKey, prices, exitKey, inception, returns, terms, sidePocket }`; each month `F.rows[investorId] = { begin, contrib, dist, redeem, income, gain, fee, feeBase, feeRate, cls, carry, gpOut, end, sp, carryBegin, carryEnd, contribCum, distCum, hwm, hurdle, profit, pre }` (line 491) | Monthly capital accounts per investor in whole cents; fund totals are exact sums (largest remainder). A fund that is not a sample reads its journal (lines 260-301). Cached by tenant + offering + journal length. |
| `NS.audit.period(ws, o, from, to)` | audit.js:636-681 | `{ L, o, S, from, to, ms, inv, fund, hold, empty, before }`; `inv[i] = { investor, begin, contrib, dist, income, gain, fee, carry, gpOut, end, carryBegin, carryEnd, contribCum, distCum, commit, hwm, hurdle, profit, feeBase, feeRate, sp, cls, feeder, own }`; `fund = { begin, contrib, dist, income, gain, fee, carry, gpOut, end, gpBegin, gpEnd, contribCum, distCum, commit, sp }` (line 677) | The capital account statement's source (T1). Periods snap to month-ends: `snap()` lines 627-633 ("periods start on the 1st and end on the last completed month-end"). A period ending after today is cut back to the last month-end. |
| `holdingsAt(L, k)` (inside period → `P.hold`) | audit.js:547-606 | `{ key, date, rows, cash, feePayable, redemptionsPayable, debt, longFV, longCost, shortFV, shortProceeds, nav, totalAssets, totalLiabilities }`; row `{ h, name, security, sleeve, level, method, input, qty, price, fv, cost, debt, equity, support, pctNav }` | Schedule of investments and property values (T5, asset pages). Not exported on its own; reached through `period().hold`. |
| `closedPerformance(P)` / `openPerformance(P)` | audit.js:704-735 | closed: `{ fund: row, investors: [{ a, paid, dist, nav, dpi, rvpi, tvpi, irr }] }`; open: `{ monthly, period, ytd, itd, itdAnnual }` | **Not exported** (`NS.audit = {...}` at lines 1571-1596 lists `xirr` but not these). The builder needs them: export both (one-line change in audit.js) rather than re-deriving. IRR is `xirr` on dollars (`c.cents / 100`), a float; multiples are floats. |
| `NS.audit.build(ws, o, from, to).list` | audit.js:1197-1430, 1549 | schedule objects `{ id, file, title, desc, cols: [{h,t}], rows, total }`; ids include `'al'`, `'ops'`, `'chg'`, `'rollforward'`, `'register'`, `'activity'`, `'fvh'`, `'l3'`, `'fees'`, `'carry'`, `'perf'`, `'custody'`, `'property'`, `'sleeves'`, `'classes'`, `'feeders'`, `'sidepocket'`, `'log'`, `'checks'` (sched() calls, lines 1221-1425) | Ready-made tables: statement of assets and liabilities, operations, changes in partners' capital, rollforward, performance, property schedule. The spreadsheet export of a fund-level report reuses these objects as they are. The `'register'` schedule holds masked TIN text and KYC state: never put it in an investor-facing report. |
| `NS.ops.capital(ws, inv, o, from, to)` | assets/js/operations.js:533-549 | `{ a, P, irr, tvpi, paid, asOf }` | One investor's account with IRR and multiple, including redemptions in the flows. Already used by the sample capital account statement. |
| `NS.ops.callNotice`, `callsFor`, `unfunded`, `commitOf`, `paidInOf` | operations.js:97-163, 704-735 | call `{ number, items: [{ investorId, cents, received }], due, pct }` | Capital calls already have a notice (subject/body with merge fields `{call_number}`, `{call_amount}`, `{due_date}`). Unfunded commitment for statements. |
| `NS.data.runRows(ws, run)` | assets/js/data.js:601-609 | `{ investor, cents: line.grossCents, withheldCents: line.grossCents - line.netCents, netCents: line.netCents, line }` | Distribution notice lines (T2): gross, withheld, net. Run fields used: `run.date`, `run.type`, `run.gp`, `run.id`. Paid state: `NS.data.runPaid(r, now)`. |
| `NS.DIST_TYPES` | assets/js/tenants.js:38 | `['Income', 'Interest', 'Return of capital', 'Realization proceeds', 'Proceeds', 'Royalty income', 'Principal', 'Return of capital and gain', 'Distribution']` | The character of a distribution as the sponsor labelled the run. It is a label, not a tax determination (the year-end character split is phase 10's, confirmed by the CPA). |
| `NS.books.trialBalance / entries / balance / series / status / accounts` | assets/js/books.js:121-126, 364-471; export line 473 | `status()` returns `{ start, closedThrough, entries, exceptions }` (lines 468-470) | Journal reads for fund-level income and expense (T3/T5 fees-and-expenses schedule, NOI per property via `entries(..., { holding })`). **Discrepancy:** 11-RESEARCH.md line 479 documents `status` as `{ start, closedThrough, reconciledThrough, openItems }`; the code returns `{ start, closedThrough, entries, exceptions }`. The builder reads the code's shape (or 11-14 changes it; check at plan time). |
| Chart of accounts | books.js:34-75 | e.g. `['4020', 'Rental income', 'income', '']`, `['5000', 'Management fees', 'expense', '']`, `['5300', 'Insurance', 'expense', '', true]` ... `['5390', 'Other property expenses', 'expense', '', true]`, `['6000', 'Net realized gain (loss) on investments', 'gain', '']`, `['6100', 'Net change in unrealized appreciation (depreciation)', 'gain', '']` | Real-estate NOI from the ledger = minus (4020 + other income lines on the property) minus (5300..5390 on the property). Fees and expenses in ILPA order: 5000 management fees, 5100 professional, 5110 administration, 5120 organizational, 5200 interest, 5900 other. |
| `NS.structures` | assets/js/structures.js:163 | `{ CURRENCIES, FX_USD, curOf, fmt, fmtWhole, toUSD, classOf, termsFor, feederOf, defaultTiers, tierLabel, waterfall, shortfall, EQUALIZATION, pct }` | Currency formatting per fund (`fmt(c, CUR)`), share class and feeder of an investor, waterfall tiers for a "how distributions are split" section. A consolidated statement across funds in different currencies must not add them (see Pitfalls). |
| `NS.files.workbook(sheets, opts)` | assets/js/filesout.js:206-243 | sheets are schedule objects; money in whole cents written as numbers with format `#,##0.00;(#,##0.00)`; no formula is ever written | The spreadsheet export for every report. Proven by phase 11 checks (workbook.js reopened with openpyxl). |
| `NS.files.pdf(doc, kit)` | filesout.js:276-561 | `doc = { title, subtitle, sheets, footer, when }`; US Letter **landscape** (`PG = { W: 792, H: 612, M: 36 }`, line 247); tables only; sets Producer and Creator to the footer (lines 551-553) | Right for table appendices; **not** a report layout: no portrait page, no logo, no paragraphs, no charts, no photos. The builder needs its own page composer on the same shipped writer and font (Part 3). |
| PDF kit | assets/js/esign.js:296-305, 442-453 | `NS.esignKit.writer()` (shipped `assets/vendor/pdfwrite/write.js`, then an outside address), `NS.esignKit.unicodeFont()` → `{ fontkit, fontBytes }`, `NS.fontData.bold` (base64) | Shipped first; the outside address is only a fallback. In the no-network frame only the shipped copy loads. |
| Brand | assets/js/brand.js:433-452, 511-514; tenants.js:41-60 | tenant `{ name, shortName, legalName, portalName, logo: { type, letters, image, plate }, colors: { primary, accent }, font, support: { team, email, phone, hours }, disclaimer }`; `safeImage()` accepts `data:image/(png\|jpeg\|webp\|gif\|svg+xml);base64` | Letterhead for every report. pdf-lib embeds only PNG and JPEG: a webp/gif/svg logo and the generated mark (an SVG) must be drawn to a canvas and embedded as PNG. |
| Documents to investors | operations.js:517-525 (`docsFor`, `recipientsOf`), 400-516 (`NS.ops.files` bytes store); portal.js:1045-1051 (`allDocs`) | a doc `{ id, title, fileName, type, size, sha256, cat, offeringId, audience: 'investors', investors: [id], date, hidden, publishedAt, publishedBy }` (the taxdocs record shape, taxdocs.js:455-457) | The investor sees `ws.docs` filtered by `docsFor` (not hidden; audience 'investors' lists them). Bytes live in IndexedDB as `{ type, bytes }`, never a Blob (operations.js:470-475 comment). Opening draws PDF pages in the page (`NS.esign.viewPdf`, portal.js:1068). |
| Generated sample documents | data.js:799-822 (`NS.investorDocs`), documents.js:28-101 (`NS.paper`) | `if (NS.EDITION && NS.EDITION.diy && !(NS.workspace && NS.workspace.isBuiltin(ws.tenant.id))) return docs;` (line 801) | In the self-serve edition a real firm gets **no** generated statements today; only sample firms do. The sample statement is hard-coded to Q3 of the current year (`const from = \`${year}-07-01\`;` documents.js:40). The report builder replaces this demonstration with real documents. |
| Investor e-delivery consent | assets/js/onboarding.js:1573, 2678, 2833 | `i.esignConsent = { at: fl.consentAt, scope: \`Electronic records and signatures (ESIGN Act, UETA)${d.edelivery ? ' and electronic delivery' : ''}\` }` | General consent to electronic delivery of statements and notices, given at onboarding. Separate from the tax-document consent `inv.taxDelivery` (taxdocs.js:558-568), which is Rev. Proc. 2012-17 specific and must not be reused for reports. |
| Tax document delivery (10-06) | assets/js/taxdocs.js:455-470, 594-716 | `release()` sets `doc.hidden = false`, `publishedAt`, `publishedBy`, logs `'Tax document delivered'`; `opened()` counts `{ first, last, count }`; documentOpened hook in taxdocs-investor.js | Pattern to reuse: a confirmed hidden doc, a deliver step naming the person, opens counted through the `documentOpened` hook, withdraw with a reason, every step in the change log. Not reusable as is: its states, kinds and consent are tax specific. |
| Notices (email to investors) | data.js:311-339 (`NS.NOTICE_TEMPLATES`, `NS.MERGE_FIELDS`, `NS.mergeNotice`); console.js:1528-1700 (Notices page) | `NS.MERGE_FIELDS = ['first_name', 'account_name', 'investment', 'quarter', 'documents', 'portal_name', 'firm', 'team', 'phone']`; template `quarterly: { label: 'Quarterly report available', subject: '{quarter} report for {investment} is now available', ... }` | The "publish with email" step reuses this page and its `quarterly` template; with no server the notice goes by the sponsor's own email (10-06 decision). Phase 13 rebuilds email; phase 12 only hands the notice to the existing path. |
| Change log | audit.js:1012-1060 (`append`, `log`, `verify`) | entry `{ seq, at, actor, action, fund, record, ... hash }`, SHA-256 chained | Every template save, generation, delivery, withdrawal and open goes here (sponsor-visible history; the audit package's `'log'` schedule picks it up). |
| Existing Reports page | console.js:1917-1981 | tabs `dist` (Distributions, CSV) and `contacts` (Contacts, CSV) | The builder joins this page (Report section of the menu, console.js:64) rather than adding a menu entry. |
| Tax documents state (for T6) | taxdocs.js:452-457, 716-746 | `doc.tax = { kind, year, state, deliveredAt, availableUntil, ... }`; states include `'confirmed'`, `'waiting'`, `'delivered'`, `'paper'`, `'withdrawn'`, `'replaced'` (LIVE/GIVEN lists, lines 501-503) | The tax-season summary lists which documents an investor has or will receive, by state. |

### 2.2 Report type to data map, with gaps

| Report | Figures and where they come from | Gap (what the portal does not hold) | Plan for the gap |
|---|---|---|---|
| T1 Capital account statement (per investor, one fund or all of an investor's funds) | `period()` investor row for the period and for year-to-date or inception-to-date; `ops.capital()` for IRR and TVPI; commitment and unfunded from `period().inv[i].commit - contribCum`; ownership `own`; class and feeder | None for the figures. Missing only: a capital account for a fund whose books do not start at inception (handled by the opening-balance entry `open:<offeringId>`, audit.js:268-276) | Statement footnote when `NS.books.status().closedThrough < period end`: "Preliminary: the books are not closed for this period." |
| T2 Distribution notice | `runRows(ws, run)` (gross, withheld, net), `run.date`, `run.type`, payment method (`inv.payment.method`), cumulative distributions from `period().inv[i].distCum` at the run date | Character split beyond the run's single label (a run labelled "Return of capital and gain" has no amounts per character) | Show the run's label as entered; one optional sponsor-typed split per run (cents, must add to gross exactly) in the notice's own record, never written back to tax data. |
| T3 Quarterly letter (fund or sponsor-wide) | Sponsor letter (rich text, merge fields); fund key figures from `period().fund`; performance from closed/openPerformance; capital activity from `events()`; holdings from `period().hold`; fees and expenses from `trialBalance` or the `'fees'` schedule; investor's own summary from T1 | Narrative, outlook, market commentary, property operating figures (occupancy, leasing, rent roll), photos | Wording blocks typed by the sponsor; per-asset page with sponsor-typed operating figures marked as provided by the sponsor (not from the books); photos uploaded into the builder (bytes in `NS.ops.files`). |
| T4 Annual review | As T3 for the year; statement of changes in partners' capital (`'chg'`), statement of operations (`'ops'`), assets and liabilities (`'al'`); year statements per investor | Audited statements (auditor's) | Attach the auditor's PDF as a separate document through the existing Documents upload; the annual review never says "audited". |
| T5 Performance and holdings summary | closedPerformance (fund and per investor: paid-in, distributions, NAV, DPI, RVPI, TVPI, net IRR) or openPerformance (monthly, period, YTD, ITD annualized); `period().hold.rows` (name, security, level, fair value, cost, debt, equity, % of NAV); `'property'` schedule for real estate; `'sleeves'` for multi-strategy | Gross IRR (before fees and carry) and with/without subscription facility (no facility data) | Net only, labelled "net of fees and carried interest" (the engine's own wording, audit.js:1374); gross is not shown, so the marketing rule's gross-with-net point does not arise. No subscription-facility figures (portal holds none). |
| T6 Tax-season summary | distributions in the tax year per investor and fund from `events().dists` and `runRows` (gross, withheld, net, run type); tax documents from `ws.docs[].tax` (kind, year, state, availableUntil); expected date typed by the sponsor | Final character of distributions (phase 10, CPA-confirmed) | Shows cash distributed and tax withheld only, with the sentence that the tax documents are authoritative; never shows a TIN beyond the last four (and the report does not need even that). |

Gaps that are bugs or blockers found while reading:
1. `closedPerformance` and `openPerformance` are not exported (audit.js:1571-1596). Needed by T3/T5. One-line export.
2. `NS.books.status()` shape differs from 11-RESEARCH's documented interface (above). Read the code's shape.
3. `filesout.js` and `books-bank.js` are not in diy.html's script list (grep of diy.html this session: the list ends at taxdocs-ui.js, line 68). Phase 11 plans 11-09..11-17 (not merged at c8b65e7) wire the Books UI and the package button. Phase 12 depends on NS.files being on the page: either load it the way taxdocs-ui.js loads its parts (`PARTS` list, taxdocs-ui.js:158, `script(name)` lines 167-185) or add it to diy.html once 11-16 has done so. Check at plan time which has merged.
4. The demonstration statement in documents.js is fixed to Q3 of the current year and only appears for sample firms; real self-serve firms have no statements. The builder is the fix; documents.js stays for the managed edition (C-03).

## Part 3. Customization model, architecture and phone constraints

### 3.1 Architectural responsibility map

There is no server in the owner's conditions; every tier below is the browser page. "Tier" here means the module that owns the work.

| Capability | Owner (module) | Secondary | Rationale |
|---|---|---|---|
| Figures (capital accounts, performance, holdings, journal amounts) | Engine: audit.js, books.js, operations.js, data.js (existing) | reports-data (new, read-only adapter) | One source of truth; the builder never recomputes a figure the engine has (FA-11 contract). |
| Report model (which sections, in which order, with which words, for whom, for which period) | reports.js (new, pure functions over `ws.reports`) | — | Pure and testable in Node with load11.js, like books.js. |
| Layout (page composition: cover, headings, paragraphs, key-figure tiles, tables, charts, photos, footers) | reports-pdf.js (new) on the shipped pdf-lib 1.17.1 and DejaVu Sans | filesout.js for table appendices and the workbook | filesout.pdf is landscape tables only; a report needs portrait pages. A separate composer leaves phase 11's proven writer untouched. |
| On-screen preview | reports-ui.js (new): HTML rendering of the same layout model | NS.esign.viewPdf for the "see the PDF" view | The preview must be quick to update while editing; the PDF view proves the file. |
| Storage of templates and runs | `ws.reports` in the workspace (localStorage, saved with everything else) | `NS.ops.files` (IndexedDB bytes) for photos and generated PDFs | The workspace holds small JSON only; bytes never go in localStorage and never as a Blob in IndexedDB. |
| Delivery to investors | reports.js deliver/withdraw/opened over `ws.docs` | portal.js Documents (existing), Notices page (existing) | Same record shape as tax documents so the investor's Documents list needs no change. |
| Change log | NS.audit.log (existing) | — | Tamper-evident chain already exported in the audit package. |

### 3.2 System architecture (data flow)

```
 Sponsor (console > Reports > Investor reports)
        │ picks: report type ─► starter template (built in, per fund type) or a saved template
        │ edits: sections on/off + order, wording blocks (rich text + merge fields), cover/accent, disclosures
        │ picks: period (preset or range), audience (one investor | one fund's investors | every investor | sponsor-wide)
        ▼
 reports.js  ── resolve(template, period, audience) ──►  report model per recipient
        │                                                   (sections with resolved figures, text with merge fields filled,
        │                                                    unknown merge field = error shown before generation)
        │        reads only ▲
        │   audit.period / closedPerformance / openPerformance / events, ops.capital, data.runRows,
        │   books.trialBalance / entries / status, structures.fmt, ws.docs[].tax, tenant brand
        ▼
   ┌───────────────────────────┬────────────────────────────┬─────────────────────────────┐
   │ preview (HTML, in page)   │ PDF (reports-pdf.js)       │ spreadsheet (files.workbook) │
   │ same model, same strings  │ portrait Letter, logo PNG, │ one sheet per table section, │
   │                           │ text, tiles, tables,       │ whole cents as numbers,      │
   │                           │ vector charts, JPEG photos │ no formulas                  │
   └───────────────────────────┴─────────────┬──────────────┴──────────────┬──────────────┘
                                              │ bytes + sha256               │ download
                                              ▼                              ▼
                       run record (ws.reports.runs) + bytes (NS.ops.files) ── archive (re-download, sha256)
                                              │ Deliver (named person)
                                              ▼
              ws.docs entry per investor (hidden → shown) ── investor's Documents (existing list, in-page PDF view)
                                              │                                   │ open → documentOpened hook → opens count
                                              ▼                                   ▼
                       Notices page (existing, 'quarterly' template prefilled)     change log (every step)
                       investors without e-delivery consent on record → "send on paper" list (PDF download)
```

### 3.3 The customization model (recommended shape)

Stored in `ws.reports = { v: 1, templates: [], runs: [] }` (new key: a grep of assets/js and server/lib for `ws.reports` and `.reports =` this session found no match, so the name is free; the shape is a recommendation).

Template:
```js
{ id: 'rt-<n>', name, type: 'statement' | 'distribution' | 'quarterly' | 'annual' | 'performance' | 'tax',
  fundType: 'realestate' | 'credit' | 'pe' | 'vc' | 'spv' | 'realassets' | 'open' | 'any',   // the audit PROFILES keys grouped
  scope: { firm: true } | { offeringIds: [...] },          // saved per firm or per offering (owner)
  cover: { on, style: 'band' | 'plain' | 'photo', accent: '#RRGGBB' | '', photoId: '' },
  sections: [ { key, on, opts: { ... }, text: <rich text model> } ],   // array order is the order
  disclosures: <rich text model>,                          // editable (owner); starts from tenant.disclaimer
  version: n, updatedAt, updatedBy }
```
Built-in starter templates live in code (not stored): one or more per report type and fund type (owner: "a few templates for each report type", quarterly letters "by fund type such as real estate, private credit or income, venture or private equity, single-asset"). "Start from" copies one into `ws.reports.templates`. A template never holds a figure; figures are resolved at generation.

Section catalogue (each section knows which report types and fund types it fits; the planner fixes the final list):
- Cover (firm lockup, report title, period, fund or "All investments", optional photo)
- Sponsor letter (rich text; merge fields)
- Summary across holdings (consolidated: one row per fund, totals only where currencies match)
- Your capital account (T1 table: period and year-to-date/inception columns)
- Commitment and capital activity (commitment, contributed, unfunded, distributed; activity list with dates)
- Distributions (this period, year to date, since inception; by run with type, gross, withheld, net)
- Fund performance (closed-end: paid-in, distributions, NAV, DPI, RVPI, TVPI, net IRR; open-ended: monthly table, period, YTD, since inception annualized)
- Holdings / schedule of investments (from `period().hold`)
- Asset pages (one per holding or property: photo, description, sponsor-typed operating figures, ledger NOI for real estate when books exist)
- Fees and expenses (ledger expense accounts in ILPA order; management fee from the engine)
- Fund financial statements (the `'al'`, `'ops'`, `'chg'` schedules, for annual review)
- Chart (choice: distributions by quarter as columns; capital account or NAV over time as a line; allocation by fund or by property as one 100% bar)
- Outlook / other wording block (free rich text)
- Tax documents status (T6)
- Disclosures (always last; can be edited, cannot be removed from investor-facing reports: a report without disclosures is a compliance risk; the sponsor's own words)

Wording blocks and merge fields: the rich text model is a short list of blocks `[{ t: 'p' | 'h' | 'ul', runs: [{ s, b, i }] }]` (paragraph, heading, bulleted list; bold, italic). No raw HTML is stored, so the PDF and the preview draw the same thing and no script can be injected. Merge fields reuse the Notices convention `{name}` and extend it: `{first_name}`, `{account_name}`, `{investment}`, `{firm}`, `{team}`, `{phone}`, `{period}`, `{period_end}`, `{ending_capital}`, `{distributions_period}`, `{commitment}`, `{unfunded}` (figures formatted from the same resolved model as the tables). An unknown field blocks generation and is shown on the preview, unlike `NS.mergeNotice`, which leaves unknown fields as typed (data.js:325) — a report sent to 200 investors with `{frist_name}` in it is the kind of failure the owner will see.

Branding: from the tenant (logo, colors, legal name, support contact); per template a cover style and an accent color (contrast-checked with `NS.brand.contrast`/`ensureContrast`, brand.js:84-101). PDF text is always DejaVu Sans (the only shipped Unicode font); the web font the portal uses is not embedded (no network, licence and size). `[VERIFIED: assets/vendor/textfont/ listing this session: DejaVuSans.ttf, DejaVuSans-Bold.ttf, text-regular.js, text-bold.js]`

Period: presets from `NS.audit.presets` (audit.js:609-625: `'fy'`, `'ytd'`, `'q'`, `'itd'`) plus a custom range; the engine snaps to month-ends, and the report shows the snapped dates (never the typed ones).

Audience: one investor; every investor of one fund (one PDF each); every investor of the firm, consolidated per investor (owner, line 99); sponsor-wide letter (one document, the same for everyone, optionally followed by each investor's own statement pages).

Saved templates per firm or per offering, preview on screen, export PDF and xlsx, deliver, archive, change log: as in the diagram.

### 3.4 Phone constraints (the owner's iPhone, sandboxed frame, no server, no network)

| Constraint (AUTOPILOT.md) | What it means for the builder |
|---|---|
| No fetch()/XHR on a path that must work without a server | The PDF writer, font embedder and font data load from the shipped files (esign.js `shippedFirst`, lines 280-295). Check: the builder's path in the no-network frame (06 checks no-network.js pattern) produces a PDF. |
| No Blob in IndexedDB | Photos and generated PDFs go through `NS.ops.files.put(id, blob)`, which stores `{ type, bytes }` (operations.js:476-494). |
| No browser PDF viewer | "See the PDF" uses `NS.esign.viewPdf(body, blob, title, true)` (portal.js:1068), which draws pages in the page. Download uses `U.download`. |
| Every view has a way out on screen; dialogs scroll | The builder is a page (not a full-screen dialog); the section editor opens inline rows like the Tax documents page (one at a time). ways-out.js and email-dialog.js checks cover it. |
| 390x844 with touch | Section reordering by up/down buttons (44px targets), not drag-and-drop (touch drag in a sandboxed WKWebView is unreliable and inaccessible). Owner asked for a "section builder", not drag: buttons satisfy it. |
| Rich text on iPhone | A `contenteditable` area with a 4-button toolbar (bold, italic, heading, list) and paste as plain text; the DOM is read back into the block model on each input. `document.execCommand('bold')` still works in Safari but is deprecated `[ASSUMED]`; implement marks by wrapping the selection range directly or keep execCommand behind one function so it can be replaced. |
| Photos from the iPhone camera roll | `<input type="file" accept="image/*">`; Safari hands HEIC as JPEG for `image/*` in most cases `[ASSUMED]`; the builder always redraws the image on a canvas (max 1600 px long side, JPEG quality about 0.82) and stores those bytes, so any format Safari can decode becomes a JPEG pdf-lib can embed. |
| Memory and storage | localStorage (the workspace) is small (a few MB on iPhone Safari `[ASSUMED]`): templates and runs are JSON only; bytes go to IndexedDB. A batch of PDFs is generated one at a time, each written to the store before the next starts, with a progress line and a way to stop. |
| Time | No time is promised. The batch speed on the phone frame is measured by a check and printed (no threshold), like phase 11's speed case. |
| Logo formats | pdf-lib embeds PNG and JPEG only (`embedPng`, `embedJpg` present in the shipped write.js this session). A webp/gif/svg logo or the generated mark (brand.js `markSVG`, an SVG) is drawn to a canvas and embedded as PNG. Canvas of a data-URL SVG is not tainted in current Safari `[ASSUMED]`; a check must prove the logo appears in the PDF in the phone frame; if the canvas refuses, the lockup falls back to the firm name in the brand color. |

### 3.5 Recommended project structure (new files; one owner each)

```
assets/js/
├── reports.js        # model: templates (starters + saved), resolve(template, period, audience) → per-recipient model,
│                     # merge fields, runs, deliver / withdraw / replace / opened, change-log entries (pure; Node-testable)
├── reports-data.js   # read-only adapters over audit/books/ops/data/taxdocs → section data (whole cents, dates)
├── reports-pdf.js    # page composer on NS.esignKit (pdf-lib 1.17.1 + DejaVu): cover, headings, paragraphs, tiles,
│                     # tables (shared measuring with filesout), vector charts, photos, footer "Page n of N"
├── reports-ui.js     # console > Reports > "Investor reports": template list, editor, preview, generate, deliver, archive;
│                     # documentOpened hook for report opens
.planning/phases/12-report-builder/checks/
├── reports-math.js   # Node: every figure equals the engine/journal to the cent (fund A hand-worked + samples)
├── reports-pdf.js    # Node + pdftotext/pdfinfo: text read-back, page count, metadata, no vendor names
├── reports-xlsx.js   # Node + python3 -I read-xlsx.py (phase 11): numbers to the cent, no formulas
├── reports-flow.js   # Playwright: phone frame 390x844 and 1280x800, no network, sandboxed iframe
└── gate12.sh         # the phase gate (pattern: phase 11 gate11.sh)
```
Small edits elsewhere (one line each, named in the plan): audit.js export of `closedPerformance`/`openPerformance`; console.js Reports page gains the "Investor reports" tab (or a hook, like `NS.navCounts`); diy.html/portal.html script list (or a parts loader like taxdocs-ui.js); server/help/guide.md entries (the help guide covers every screen).

### 3.6 Patterns to follow

- **One model, two renderers.** `resolve()` produces a plain object per recipient with every string and every figure already formatted; the HTML preview and the PDF composer only draw it. The validation (Part 4) compares the PDF's text with the model's strings, and the model's cents with the engine's.
- **Figures as cents until drawn.** Money stays an integer number of cents through the model (`Number.isSafeInteger` is asserted, as filesout.pdfCell does, filesout.js:256-264); formatting happens once, in the model, with the fund's currency (`NS.structures.fmt`).
- **Snapshot on generation.** A run stores a copy of the template as used, the period after snapping, the audience, and each PDF's SHA-256 (NS.audit.sha256). An archived report can be re-downloaded byte-identical, and the record shows exactly what was sent.
- **Delivery reuses the document record.** A delivered report is a `ws.docs` entry with `cat: 'Reports' | 'Statements' | 'Notices'`, `audience: 'investors'`, `investors: [id]`, `hidden` until delivered, `publishedAt/By`, `sha256`, plus `report: { run, state, opens: { first, last, count }, withdrawn, replaces }`. portal.js `allDocs` already lists such entries (portal.js:1046-1051) and opens PDFs in the page.
- **Starter templates per fund type in code, saved templates in the workspace** (owner: saved per offering or firm).

### 3.7 Anti-patterns to avoid

- Recomputing a figure in the builder (IRR, ownership, NAV) instead of reading the engine: two numbers for the same thing will disagree in some fund.
- Storing HTML from the editor and drawing it in the PDF: script injection risk and preview/PDF drift.
- Adding totals across funds in different currencies.
- Extending `NS.files.pdf` in place for portrait reports: phase 11's checks pin its layout; build the composer beside it and share only measuring helpers.
- A full-screen modal editor on the phone (no way out, no scroll): use the page.
- Drag-and-drop as the only way to reorder.
- Any wording that calls a report "audited", "ILPA compliant" or a tax form.

## Part 4. Validation Architecture

`workflow.nyquist_validation` is true in .planning/config.json, so this section is required.

### 4.1 Test framework (existing; nothing to install)

| Property | Value |
|---|---|
| Framework | Plain Node scripts with the phase 6 harness `runParts` (.planning/phases/06-*/checks/lib.js) and phase 11's loader `load11.js` (runs the portal's own scripts in a vm context, today fixed, edition chosen); Playwright (Chromium) for page checks through the shared queue `SCRATCH/exec-011/heavy.sh` |
| Independent readers | `pdftotext -layout`, `pdfinfo`, `pdftotext -bbox` (poppler 24.02.0, present); `python3 -I .planning/phases/11-*/checks/read-xlsx.py <file>` (openpyxl 3.1.5, present) |
| Fixture with hand-worked figures | `.planning/phases/11-*/checks/fixtures/fund-a.js` (exports `records, entries, recordEntries, expect`): two investors, FA-1001 and FA-1002; capital at 2026-12-31 `'FA-1001': 34500000` and `'FA-1002': 17250000` (cents); LP capital per month `lpCapital: [44850000, ... 51750000]`; distributions on 2026-12-15 of 600,000 and 300,000 cents (fund-a.js:205-227 and 11-14-PLAN.md hand-worked package) |
| Config file | none; each check starts with `// gate: node` or `// gate: browser` and `// last "<NAME>: PASS (...)"` (phase 11 convention) |
| Quick run command | `node .planning/phases/12-report-builder/checks/reports-math.js --case <name>` |
| Full suite command | `bash .planning/phases/12-report-builder/checks/gate12.sh` then the reference gate `.planning/checks/gate-reference.sh` with the new lines added |

### 4.2 How each report's figures are proven (whole cents)

Two independent anchors, both required:
1. **Hand-worked anchor (fund A):** every figure the T1, T2, T5 and T6 reports print for fund A is compared with the number written by hand in fund-a.js `expect` (or worked in the check's comments from it), not with the engine. Example: FA-1001's year statement ends at 34500000 cents; begins at 0; contributions 30000000; distributions 600000; DPI = 600000 / 30000000 = 0.02; TVPI = (600000 + 34500000) / 30000000 = 1.17; ownership 2 : 1 (66.6667% / 33.3333%).
2. **Engine anchor (every sample firm, every fund, every investor):** for each report the model's cents equal `NS.audit.period(...)` / `NS.ops.capital(...)` / `NS.data.runRows(...)` / `NS.books.trialBalance(...)` exactly (`===` on integers), and fund totals in a consolidated or fund report equal the sum of the investor rows exactly. IRR and multiples (floats) are compared to the engine's values rounded the way the report prints them (e.g. 0.1 percentage point, 2 decimals for multiples) and, for fund A, to an IRR recomputed in the check by a different method (Newton iteration on the same flows) to 4 decimals.
3. **Identity checks on every statement:** begin + contributions - distributions + income + gain - fees - carry = end, to the cent, per investor and per fund; consolidated summary row per fund equals that fund's own section; a report period ending after today shows the snapped month-end.

### 4.3 PDF read-back and white label

- Every generated PDF is read with `pdftotext -layout`; the check finds every money string of the model in the text (formatted as the model formatted it), the investor's name, the period, the firm's legal name, "Page n of N" on every page (`pdfinfo` Pages = N).
- `pdfinfo` Producer, Creator and Title equal the firm's name or report title; never `pdf-lib`, `fontkit`, a vendor, model or platform name. (pdf-lib writes its own Producer unless set; filesout.js sets it at lines 551-553, the composer must too.)
- A banned-words scan over the PDF text, the preview HTML, the spreadsheet's shared text and every new screen: no vendor or library names (pdf-lib, fontkit, DejaVu, pdf.js, openpyxl, Claude, Anthropic, Carrow & Vale in the self-serve edition's investor-facing output) and never the word "basic" (case-insensitive, whole word). The font's internal name inside the PDF font dictionary (`DejaVuSans`, shown by `pdffonts`) is not page text; whether it counts as "a name a sponsor sees" is an open question (below).
- Characters the font lacks: the composer counts them like filesout (`bytes.missing`); a report with missing characters is refused with a plain message. A test investor name with `Ł` and an accented firm name proves the Unicode path.
- Logo and photos: `pdfimages -list` (poppler, same package as pdftotext `[ASSUMED]` present; check at plan time) shows the logo image and each photo on the expected pages.

### 4.4 Spreadsheet reopened

- `python3 -I read-xlsx.py` opens every exported workbook: sheet names, every money cell is a number equal to the model's cents / 100 with the money format, raw formulas 0, no cell starts with `=`, `+`, `-` or `@` as text from a typed wording block (formula injection: the writer stores text as inline strings, filesout.js header lines 9-11, which a spreadsheet never reads as a formula; the check proves it with a wording block that starts with `=HYPERLINK(`).

### 4.5 Phone conditions (owner's iPhone)

- reports-flow.js runs in the sandboxed iframe with connect-src blocked (pattern: 06 checks no-network.js, safari-finish.js), at 390x844 with touch and at 1280x800: open Reports > Investor reports, start from a starter template, turn a section off, move one up, edit the letter (bold and a list), pick a period, preview, generate for one fund's investors, see the PDF drawn in the page, download, deliver; then sign in as an investor and open the report from Documents (opens count 1). No refused connection, no error on screen, a way out visible on every view (ways-out.js), the dialog scrolls (email-dialog.js).
- The batch speed on the phone frame is printed (no threshold) so the owner sees a measured number, never an estimate.
- Managed edition unchanged: the C-03 slice guard in status-math stays green; the builder's tab appears only in the self-serve edition unless a plan says otherwise.

### 4.6 Phase requirements to test map (IDs from Part 5)

| Req | Behaviour | Type | Automated command | File exists? |
|---|---|---|---|---|
| RB-01 | Six report types with starter templates per fund type | unit | `node checks/reports-math.js --case starters` | Wave 0 |
| RB-02 | Template editing: sections on/off, order, wording, cover, disclosures; saved per firm/offering | unit + flow | `node checks/reports-math.js --case template`; `reports-flow.js --part editor-phone` | Wave 0 |
| RB-03 | Merge fields filled; unknown field blocks generation | unit | `--case merge` | Wave 0 |
| RB-04 | T1 figures equal engine and fund A by hand, to the cent | unit | `--case statement,fund-a` | Wave 0 |
| RB-05 | Consolidated statement: one section per fund, totals per currency | unit | `--case consolidated` | Wave 0 |
| RB-06 | T2 distribution notice equals runRows (gross, withheld, net) | unit | `--case distribution` | Wave 0 |
| RB-07 | T3/T4 letters by fund type: sections per type, figures from engine | unit | `--case letters` | Wave 0 |
| RB-08 | T5 performance and holdings equal engine; net only | unit | `--case performance` | Wave 0 |
| RB-09 | T6 tax summary: cash and withholding from runs, documents' states from phase 10 | unit | `--case tax` | Wave 0 |
| RB-10 | PDF read back: text, pages, metadata, logo, photos, Unicode | node + poppler | `node checks/reports-pdf.js` | Wave 0 |
| RB-11 | Spreadsheet reopened: numbers to the cent, no formulas | node + openpyxl | `node checks/reports-xlsx.js` | Wave 0 |
| RB-12 | Preview equals PDF text | browser | `reports-flow.js --part preview` | Wave 0 |
| RB-13 | Delivery, consent list, opens, withdraw, replace, change log | unit + flow | `--case deliver`; `reports-flow.js --part deliver-phone,investor-phone` | Wave 0 |
| RB-14 | Phone frame, no network, ways out | browser | `reports-flow.js --part nocdn,phone,desktop` | Wave 0 |
| RB-15 | White label and no "basic" | node + browser | `node checks/reports-pdf.js --case brand`; flow banned-words part | Wave 0 |
| RB-16 | Archive: runs re-download byte-identical (sha256) | unit | `--case archive` | Wave 0 |

### 4.7 Sampling rate
- Per task commit: the plan's own case (`--case <name>`), under 30 seconds in Node.
- Per wave merge: gate12.sh (all reports checks) plus the steps of the reference gate the plan touches.
- Phase gate: the full reference gate on the merged tree with the new lines, then the owner-path walkthrough in the phone conditions before a preview is published.

### 4.8 Wave 0 gaps
- [ ] checks/reports-math.js (cases above), using load11.js with `extra: ['books.js', 'books-post.js', 'reports-data.js', 'reports.js']`
- [ ] checks/reports-pdf.js and reports-xlsx.js (copy the folder-per-process and clean-up pattern of phase 11's pdf-out.js)
- [ ] checks/reports-flow.js (Playwright parts; phone and desktop; no-network frame)
- [ ] checks/gate12.sh and the new reference-gate lines
- [ ] A multi-fund, multi-currency sample investor for RB-05 (check whether a sample firm already holds such an investor; else a fixture beside fund A)

## Security Domain

`security_enforcement` is true (ASVS level 1, block on high).

| ASVS category | Applies | Control |
|---|---|---|
| V2 Authentication | no (no new sign-in) | existing |
| V3 Session management | no | existing |
| V4 Access control | yes | Building and generating: the sponsor's team per the existing role check (`NS.app.can`, app.js:428); delivering and withdrawing: admins, as on the Tax documents page; an investor sees only `ws.docs` entries that list them (`docsFor`, operations.js:517-520). A consolidated report for investor A must never include investor B's rows: the check asserts every investor-facing model holds only its recipient's ids. |
| V5 Input validation | yes | Rich text stored as the block model (no HTML), escaped on render (`NS.brand.esc`); merge fields from a fixed list; photos redrawn through a canvas (strips metadata such as GPS EXIF and any non-image payload); colors through `NS.brand.normHex`; text lengths capped. |
| V6 Cryptography | yes (integrity only) | SHA-256 of each PDF with the existing `NS.audit.sha256`; no hand-rolled crypto. |
| V8 Data protection | yes | Investor reports carry no taxpayer number, bank number or date of birth; the investor register schedule (masked TIN, KYC) is never an investor-facing section; photos lose EXIF location by redraw. |
| V12 Files | yes | Downloads only of generated bytes; uploads limited to images and redrawn. |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Report for one investor delivered to another (wrong id in a batch) | Information disclosure | Recipient id written into the model and into the doc record from the same loop variable; the check generates a batch and reads every PDF back for exactly one investor name. |
| Script in a wording block or an investor name | Tampering | Block model, escaping, no innerHTML of stored text. |
| Formula injection in the spreadsheet | Tampering | Inline strings only (filesout.js), proven by a check. |
| A delivered report changed afterwards without trace | Repudiation | Run snapshot, SHA-256 per file, change log entries for generate, deliver, withdraw and replace. |
| Photo with GPS location of a property owner's home | Information disclosure | Canvas redraw drops EXIF. |

<phase_requirements>
## Part 5. Requirements and recommended plan breakdown

### 5.1 Requirements (RB-01 ... RB-16)

| ID | Requirement | Traced to | Research support |
|---|---|---|---|
| RB-01 | Six report types (capital account statement, distribution notice, quarterly letter, annual review, performance and holdings summary, tax-season summary), each with starter templates; quarterly letters by fund type (real estate, private credit or income, venture or private equity, single asset, open-ended). | Owner line 98 ("a few templates for each report type", fund types); ROADMAP goal list | 1.4, 3.3 |
| RB-02 | A sponsor edits a template: sections on or off, reordered (buttons, phone-safe), wording blocks in a rich-text editor (paragraphs, headings, bold, italic, lists), cover style and accent, chart choice, editable disclosures; saves it for the firm or for chosen offerings; a saved template has a version and a change-log entry. | Owner line 98 (section builder, chart choices, cover and accents, saved templates per offering or firm, editable disclosures, rich-text letter); ROADMAP ("sections on or off and reordered ... wording blocks") | 3.3, 3.4 |
| RB-03 | Merge fields in wording blocks are filled per recipient from the resolved model; an unknown merge field blocks generation and is shown in the preview. | ROADMAP ("wording blocks"); Notices convention data.js:324-339 | 3.3 |
| RB-04 | Capital account statement per investor for any period (period and year-to-date or inception-to-date columns): every figure equals the engine to the cent and fund A's hand-worked figures; preliminary note when the books are not closed through the period end. | ROADMAP; owner figures list (capital account, contributions, distributions, ownership, IRR, multiple, DPI, TVPI); 1.2 | 2.1, 2.2, 4.2 |
| RB-05 | Consolidated report per investor across all their holdings: summary totals (per currency) plus one section per fund laid out for its fund type; sponsor-wide letter covering every fund. | Owner line 99 | 1.2, 3.3 |
| RB-06 | Distribution notice per investor per paid run: gross, tax withheld, net, type as labelled, payment date and method, cumulative distributions; optional sponsor-typed character split that must add to gross exactly. | 1.1 (LPA notice duty), 1.2 (ILPA notice practice) | 2.2 |
| RB-07 | Quarterly letter and annual review: sponsor letter, fund key figures, investor's own summary, capital activity, holdings or asset pages (photos, sponsor-typed operating figures marked as provided by the sponsor, ledger NOI for real estate when books exist), outlook, disclosures; annual review adds the fund statements (assets and liabilities, operations, changes in partners' capital). Never labelled audited. | Owner line 98 (asset pages with photos, annual review); 1.1 | 2.2, 3.3 |
| RB-08 | Performance and holdings summary: closed-end paid-in, distributions, NAV, DPI, RVPI, TVPI, net IRR (fund and per investor); open-ended monthly, period, YTD, since-inception annualized; schedule of investments; fees and expenses from the ledger in ILPA order. Net figures only, labelled net. | Owner figures list; 1.2 (ILPA), 1.1 (marketing rule) | 2.1 (closedPerformance/openPerformance export), 2.2 |
| RB-09 | Tax-season summary per investor: cash distributed and tax withheld in the tax year by fund, which tax documents exist and their state (from phase 10), expected date typed by the sponsor; never a tax form, never a full taxpayer number. | ROADMAP ("tax-season summaries"); 1.1 (K-1 timing) | 2.1 (ws.docs[].tax), 2.2 |
| RB-10 | PDF in the firm's brand (logo, colors, legal name, support contact), portrait Letter, cover, headings, paragraphs, key-figure tiles, tables that split across pages with repeated headings, vector charts, photos, "Page n of N"; written in the browser with the shipped writer and font; read back by pdftotext with every figure present; metadata names the firm only. | ROADMAP ("exported as PDF ... with the shipped writers"); AUTOPILOT white label | 2.1 (kit), 3.4, 4.3 |
| RB-11 | Spreadsheet export of every report's tables with NS.files.workbook: money as numbers to the cent, no formulas, text never read as a formula; reopened by an independent reader. | ROADMAP ("and spreadsheet"); owner line 98 | 2.1, 4.4 |
| RB-12 | On-screen preview of the report as it will print, updated while editing, with the PDF itself viewable in the page; preview text equals the PDF's text. | ROADMAP ("previewed on screen"); AUTOPILOT (no browser PDF viewer) | 3.2, 3.6 |
| RB-13 | Batch generate for one investor, one fund's investors, every investor (consolidated) or a sponsor-wide letter; deliver to each investor's Documents (named person); investors with no electronic-delivery consent on record listed for paper with a PDF download; opens counted; withdraw with a reason; a corrected report replaces the earlier one (marked replaced); the existing Notices page prefilled to tell investors; every step in the change log. | ROADMAP ("delivered to investors through the portal's documents"); owner line 98 (batch generate, publish with email, archive); 10-06 pattern | 2.1, 3.6 |
| RB-14 | Everything works in the owner's iPhone conditions: sandboxed frame, connect-src blocked, 390x844 touch and 1280x800, bytes (not Blobs) in IndexedDB, PDF drawn in the page, a way out on every view, dialogs scroll; batch speed measured and printed. | AUTOPILOT; ROADMAP ("proven in the owner's iPhone conditions") | 3.4, 4.5 |
| RB-15 | White label: no vendor, library, model or platform name in any screen, PDF (text and metadata) or spreadsheet a sponsor or investor sees; the word "basic" never appears; managed edition unchanged. | AUTOPILOT; owner line 98 | 4.3 |
| RB-16 | Archive: every run keeps its template snapshot, period, audience and each file's SHA-256; any archived report re-downloads byte-identical. | Owner line 98 ("archive") | 3.6 |

Not in scope (traced): capital call notices (exist), audited statements, Reg A SEC filings, K-1/1099 preparation, server email (phase 13), any outside API (owner).
</phase_requirements>

### 5.2 Recommended plans, waves and file ownership

Dependencies outside the phase: phase 10-06 (merged); phase 11 plans 11-14 (read interface written down) and 11-16 (NS.files wired into the page) are not merged at c8b65e7. Wave 1 below does not need them (Node checks load filesout.js directly, as phase 11's checks do). Wave 2's UI plan needs NS.files on the page: either 11-16 has merged, or the UI plan loads filesout.js with a parts loader like taxdocs-ui.js. The planner checks which is true when it plans.

| Wave | Plan | Delivers (requirements) | Files it owns (only it edits them) | Depends on |
|---|---|---|---|---|
| 1 | 12-01 Report data | reports-data.js: read-only adapters returning section data in cents (statement, consolidated, distribution, performance, holdings, fees and expenses, tax status); export of closedPerformance/openPerformance from audit.js; checks/reports-math.js cases statement, fund-a, consolidated, distribution, performance, tax; gate12.sh created (RB-04, RB-05, RB-06, RB-08, RB-09) | assets/js/reports-data.js; assets/js/audit.js (the export line only); checks/reports-math.js (its cases); checks/gate12.sh | — |
| 1 | 12-02 Report model | reports.js: template shape, section catalogue, resolve(template, period, audience) → per-recipient model (strings formatted once), rich-text block model, merge fields with unknown-field refusal, runs with snapshot and SHA-256, archive (RB-02 model side, RB-03, RB-16) | assets/js/reports.js; checks/reports-model.js | 12-01's adapter signatures (fixed in the plan text so both run in parallel) |
| 1 | 12-03 PDF composer | reports-pdf.js on NS.esignKit: portrait pages, letterhead (logo PNG; SVG/webp/gif logo and generated mark drawn to canvas in the browser, firm-name fallback), headings, paragraphs from the block model, tiles, tables with repeated headings, column/line/100% bar charts as vectors, JPEG photos, footer, metadata = firm; missing-character refusal; checks/reports-pdf.js with pdftotext/pdfinfo/pdfimages on a fixture model (RB-10, RB-15 PDF side) | assets/js/reports-pdf.js; checks/reports-pdf.js; checks/fixtures/model-*.json | the model shape (fixed in 12-02's plan text) |
| 2 | 12-04 Starter templates and spreadsheet | reports-templates.js: starter templates for the six types and the fund types, default wording and disclosures (from tenant.disclaimer), chart defaults; spreadsheet export per report through NS.files.workbook; checks starters and reports-xlsx.js (RB-01, RB-07, RB-11) | assets/js/reports-templates.js; checks/reports-xlsx.js | 12-01, 12-02 |
| 2 | 12-05 Builder screens | reports-ui.js: Reports page "Investor reports" tab (template list, start from a starter, editor with on/off, up/down, rich text, cover, accent, chart, disclosures, period, audience), HTML preview, PDF view in page, downloads; script lines in diy.html and portal.html (or parts loader); help guide entries; checks/reports-flow.js parts editor-phone, editor-desktop, preview, nocdn (RB-02, RB-12, RB-14) | assets/js/reports-ui.js; console.js (the tab hook line only); diy.html, portal.html (script lines); server/help/guide.md + server/lib/help-guide.mjs (its entries); checks/reports-flow.js (its parts) | 12-01, 12-02, 12-03; NS.files on the page |
| 3 | 12-06 Delivery and archive screens | reports-deliver.js: generate in batches with progress and stop, deliver, paper list, opens via documentOpened hook, withdraw, replace, Notices prefill, archive list with re-download; change-log entries; flow parts deliver-phone, investor-phone, archive (RB-13, RB-14, RB-16) | assets/js/reports-deliver.js; checks/reports-flow.js (its parts) | 12-04, 12-05 |
| 3 | 12-07 Phase gate and walkthrough | the white-label and "basic" sweep across every new screen and file; reference-gate lines; gate12.sh complete; an owner-path walkthrough in the phone conditions with real sample firms; summary of measured batch speed (RB-14, RB-15) | .planning/checks/gate-reference.sh (new lines); checks/gate12.sh (final lines); walkthrough report | 12-06 |

Plans sized to the project's rule of about 100k tokens each. No time estimate is given: the speed check measures and prints.

## Part 6. Outside options (CLAUDE.md rule) — recommendation: build in-house

The owner's note for this task says "no API". The rule still asks for the options with cost, accuracy, speed and trade-offs:

| Option | Cost | Accuracy | Speed | Trade-offs |
|---|---|---|---|---|
| A. In-house in the browser (recommended) | $0 per month; build usage only | Figures come from the same engine as the audit and CPA packages, proven to the cent by checks | Measured on the phone frame by a check (no estimate) | Works in the owner's iPhone conditions with no network; no investor data leaves the portal; no vendor name can leak; layout limited to what the composer draws (one shipped font family). |
| B. HTML-to-PDF or template API (e.g. DocRaptor, PDFMonkey) | About $15/month for 125 documents up to about $1,000/month for 40,000 (DocRaptor); PDFMonkey about EUR 60/month for 5,000 `[CITED: softwaresuggest, pdfmonkey.io pricing via search]` LOW-MEDIUM | Same figures (we still compute them); typography richer | Network round trip per document | Needs a server and network (fails in the sandboxed frame, refused by connect-src); investor statements sent to a third party; a monthly fee the owner has no budget for; a vendor name in PDF metadata unless scrubbed. |
| C. Investor-reporting platform or fund administrator producing the reports | Quote-based; one comparison lists about $35,000 a year and up for institutional tools `[CITED: comparison article via search]` LOW; administrators charge per fund or basis points `[ASSUMED]` | Depends on their books, not ours (two sources of truth) | Days per cycle | Defeats the product's purpose (the portal is the sponsor's tool); data duplication; not white label inside the portal. |

Recommendation: A. B and C are recorded here so the owner can see they were considered; neither works without a network, and both cost money every month.

<!-- gsd:write-continue -->
