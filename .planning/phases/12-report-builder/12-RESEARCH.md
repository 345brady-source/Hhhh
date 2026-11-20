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

<!-- gsd:write-continue -->
