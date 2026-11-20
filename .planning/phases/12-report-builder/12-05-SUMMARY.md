---
phase: 12-report-builder
plan: 05
subsystem: report builder (starter templates, end-to-end proof)
tags: [reports, starters, xlsx, pdf, white-label, wording]
status: complete
requires: ["12-01 NS.reportsData", "12-02 NS.reports (addStarter, startFrom, resolve, sheets)", "12-03 NS.reportsPdf.compose", "filesout.js NS.files.workbook"]
provides: ["assets/js/reports-templates.js (18 starters)", "checks/reports-starters.js (REPORTS STARTERS, 8 cases)", "checks/reports-xlsx.js (REPORTS XLSX, 4 cases)"]
affects: ["12-06 (loads reports-templates.js after reports.js; asset-item editor needs holding ids)", "12-07 (batch runs on starters)", "12-08 (starter picker applies pe/vc)", "12-09 (walkthrough)"]
tech-stack:
  added: []
  patterns: ["starters carry only added disclosure paragraphs; startFrom keeps the tenant disclaimer first (B2)", "PDF read back in two orders (pdftotext -layout and -raw) so cells wrapped in their column count"]
key-files:
  created: [assets/js/reports-templates.js, .planning/phases/12-report-builder/checks/reports-starters.js, .planning/phases/12-report-builder/checks/reports-xlsx.js, .planning/phases/12-report-builder/12-05-deferred-items.md]
  modified: [assets/js/reports.js (startFrom, B2: 2 lines), assets/js/tenants.js (one Pellbrook sample sentence)]
decisions:
  - "Cover and disclosures are on in every starter; dn-notice's cover is the plain style"
  - "dn-letter is letter + notice: the catalogue has no distributions section for a distribution notice"
  - "q-open's disclosure says net of fees and incentive allocation; q-firm's says it is for investors in the funds named in it (no investor is named on a letter to everyone)"
  - "Letters promise only sections that always print (no 'update on each property': the asset section is empty until the sponsor types it)"
  - "Default wording is marked in every blurb (sponsor-facing only): 'Default wording, not yet read by counsel.'"
metrics:
  completed: 2026-11-20
actuals:
  tokens: 16000      # chars/4 over the files changed (58,902 chars + 5 changed lines), this SUMMARY excluded
  tasks: 3
  commits: 10        # MEASURED: git rev-list --count da1ce23..HEAD before this SUMMARY's own commit
plan_head_before: da1ce239c472d3a0a287571b7b953d0eac780ac8
plan_head_after: f2463e99b82ba1a19e397f5ad07aa8400daad802
---

# Phase 12 Plan 05: starter templates and spreadsheets Summary

18 starter templates (assets/js/reports-templates.js) run end to end for the first time through the real figures, the
model and the PDF composer: fund A's hand-worked figures print to the cent, every starter prints for every matching fund
of all four sample firms (336 PDFs) with only its recipient's data, and every report type's spreadsheet reopens with money
as numbers equal to the model's cents. Measured in Node only. Nothing here is on a page yet (12-06 wires it in). The
wording is default text that neither the owner nor any counsel has read, and nothing here is ready until the owner has
checked it.

## Failures and open items (first)

1. **Task 3's cases had no true RED.** All five passed on their first run because they test what wave 1 and Tasks 1-2
   had already built. red-3.txt holds the same cases failing on four temporary mutations instead (details under red-3).
2. **Asset updates cannot attach to any holding today** (12-05-deferred-items.md item 1). Every holding row of all 15
   sample funds and of fund A has `id: ''` (generated rows until 11-11 moves holdings onto the journal), and `normalise`
   drops asset items with no holding id. The four starters with an asset section (q-realestate, q-spv, a-realestate,
   p-property) print it only once holdings carry ids. The inject case wraps the real figures to give holding rows ids.
   Recheck both checks after 11-11 merges; 12-06's asset editor needs the same ids.
3. **The sample Pellbrook disclaimer said "estimates until audited"**, and B2 rightly prints the tenant disclaimer first on
   every report, so every Pellbrook report said "audited". Reworded the one sample sentence in assets/js/tenants.js
   ("estimates until the annual financial statements are final"). A real sponsor's disclaimer prints as typed, with no
   warning (deferred item 2). mobile/src/core/tenants.js keeps the old sentence (separate app, deferred item 3).
4. **Wording faults I made and fixed before commit** (found by reading PDFs by eye): q-firm said "each fund named on the
   cover", but the cover reads "All investments" for an investor across funds; the real estate, SPV and annual real estate
   letters promised "an update on each property", which prints only when the sponsor types one.
5. **Chart line-up (After 12-03):** every columns and line chart in the 336 models lines up with its ticks (case
   every-sample asserts it), so the model was not changed. They would not line up for a series with a negative value: the
   composer clamps negatives to zero while the ticks start at the least value. No sample series is negative today.
6. **Verify commands run with one recorded change each:** Task 2's empty-folder test excludes `.parts` (12-CONTEXT,
   "After 12-03"). All three ran from script files, because the worktree guard refuses inline `$(git ...)`.
7. Not checked here: the look of these pages on an iPhone (12-06 and 12-09 cover the phone frame). The sample firms'
   disclaimers end with "[Regulatory disclosures to be provided by counsel.]", which prints on every sample report.

Base commit: da1ce239c472d3a0a287571b7b953d0eac780ac8. Evidence was pasted below as it was produced (SAVE-RULES rule 5).

## RED outputs

### red-1 (Task 1, case fund-a in both checks, before assets/js/reports-templates.js existed)

```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a4dc0c45bff2a32b0/assets/js/reports-templates.js'
    at Object.readFileSync (node:fs:440:20)
    at .../11-fund-accounting-and-cpa-year-end-package/checks/load11.js:159:24
    ...
REPORTS STARTERS: FAIL (cases run: 1) - fund-a
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a4dc0c45bff2a32b0/assets/js/reports-templates.js'
    ...
REPORTS XLSX: FAIL (cases run: 1) - fund-a
```

### red-2 (Task 2, cases fund-a, catalogue, every-sample, rega, words, consolidated; only the 4 tracer starters, before the B2 change; FAIL lines and the last line, each cut at 260 characters; 82 PASS lines omitted)

```
FAIL catalogue 18 starters, every id once :: ["st-capital","dn-notice","p-summary","t-season"]
FAIL catalogue reports-templates.js registers each id once :: ["st-capital","dn-notice","p-summary","t-season"]
FAIL catalogue the starters are exactly the plan’s list :: {"missing":["st-consolidated","st-yearend","dn-letter","q-realestate","q-credit","q-pe","q-spv","q-open","q-firm","a-review","a-realestate","a-rega","p-property","t-documents"],"extra":[]}
FAIL catalogue statement: at least two starters (1) :: 1
FAIL catalogue distribution: at least two starters (1) :: 1
FAIL catalogue quarterly: at least two starters (0) :: 0
FAIL catalogue annual: at least two starters (0) :: 0
FAIL catalogue performance: at least two starters (1) :: 1
FAIL catalogue tax: at least two starters (1) :: 1
FAIL catalogue a quarterly letter for fund type realestate
FAIL catalogue a quarterly letter for fund type credit
FAIL catalogue a quarterly letter for fund type pe
FAIL catalogue a quarterly letter for fund type spv
FAIL catalogue a quarterly letter for fund type open
FAIL catalogue kestrel-bay: every starter's disclosures start with the tenant's disclaimer, then the starter's own paragraphs :: [["st-capital",4,"Figures are unaudited and prepared from the fund’s books as "],["dn-notice",3,"Figures are unaudited and prepar
FAIL catalogue ashwell-ridge: every starter's disclosures start with the tenant's disclaimer, then the starter's own paragraphs :: [["st-capital",4,"Figures are unaudited and prepared from the fund’s books as "],["dn-notice",3,"Figures are unaudited and prep
FAIL catalogue greywater: every starter's disclosures start with the tenant's disclaimer, then the starter's own paragraphs :: [["st-capital",4,"Figures are unaudited and prepared from the fund’s books as "],["dn-notice",3,"Figures are unaudited and prepared
FAIL catalogue pellbrook: every starter's disclosures start with the tenant's disclaimer, then the starter's own paragraphs :: [["st-capital",4,"Figures are unaudited and prepared from the fund’s books as "],["dn-notice",3,"Figures are unaudited and prepared
FAIL every-sample kestrel-bay: every PDF holds every table cell string and tile value of its model :: [{"what":"p-summary kb-fund-ii KBC-1001","lost":["Preferred and common units"]},{"what":"p-summary kb-fund-ii KBC-1026","lost":["Preferred and common units"]}
FAIL every-sample ashwell-ridge: every PDF holds every table cell string and tile value of its model :: [{"what":"p-summary ar-cedar-row ARR-1001","lost":["288-unit multifamily, built 2004"]},{"what":"p-summary ar-cedar-row ARR-1028","lost":["288-unit multifam
FAIL every-sample greywater: every PDF holds every table cell string and tile value of its model :: [{"what":"p-summary gw-solar-i GIP-1001","lost":["64 MW, Colorado, 20-year PPA","58 MW, New Mexico, 20-year PPA","52 MW, Colorado, 20-year PPA","38 MW, New Mexi
FAIL every-sample pellbrook: every PDF holds every table cell string and tile value of its model :: [{"what":"p-summary pb-ventures-i PBP-1001","lost":["Series A and B preferred stock","Seed and Series A preferred stock","Seed preferred stock and SAFEs"]},{"wh
PDFs made: 104 of 104 reports
FAIL rega ran to the end :: Error: No such starter
FAIL consolidated ran to the end :: Error: No such starter
REPORTS STARTERS: FAIL (cases run: 6) - catalogue, every-sample, rega, consolidated
```
words passed at red-2 because the four tracer starters already kept the wording rules. The every-sample failure was the check, not the product: holdings "Security" cells that wrap inside their column ("64 MW, Colorado, 20-year" / "PPA") were not found by pdftotext -layout. The PDF draws them correctly (read by eye). The check now also reads the PDF in drawing order (pdftotext -raw) and counts a string as present if either reading holds it.

## Verify lines

### Task 1 verify (the plan's command, run verbatim from SCRATCH/exec-12-05/verify-1.sh with GATE_FRESH=1)

```
==> .../exec-12-05/t1a.txt <==
PASS fund-a t-season: no vendor, library or model name, never audited or the forbidden word (text and properties)
REPORTS STARTERS: PASS (cases run: 1)

==> .../exec-12-05/t1b.txt <==
PASS fund-a no cell holds a formula (openpyxl)
REPORTS XLSX: PASS (cases run: 1)
VERIFY-1 EXIT=0
```
Tracer feedback gate: verify rerun end to end and passed; expansion continued. The st-capital PDF text for FA-1001 was also read by eye (capital table, commitment tiles, activity, distributions, chart): figures as worked by hand.

### Task 2 verify (SCRATCH/exec-12-05/verify-2.sh with GATE_FRESH=1: the plan's command, with the empty-folder test excluding runParts' results store `.parts` as 12-CONTEXT "After 12-03" directs)

```
PASS consolidated each fund name is in the PDF
PASS consolidated no single total of all three funds (in the model or the PDF)
REPORTS STARTERS: PASS (cases run: 6)
VERIFY-2 EXIT=0
```
120 PASS lines, 0 FAIL. checks-out afterwards holds only `.parts`. every-sample printed `PDFs made: 336 of 336 reports` (4 sample firms, 18 starters, every matching fund, first and last holder, plus one multi-fund investor for st-consolidated and q-firm). The six cases took 87 s in Node (measured once by the run script).

Mutation test (not committed; reverted with `git checkout`, diff empty afterwards): NET disclosure changed to "Performance is shown as gross performance." and the consolidated summary grouped without currency:
```
FAIL words no starter's name, blurb or wording says the forbidden word, audited, ILPA compliant, gross performance or asks for more investment :: ["st-capital","st-consolidated",...
FAIL words every starter's disclosures say net :: ["st-capital","st-consolidated",...
FAIL words none of the 62946 model strings every-sample makes breaks a wording rule :: [{"what":"st-capital kb-fund-ii KBC-1001","s":"Performance is shown as gross performance. ...
FAIL consolidated Summary (USD) total ending capital = kb-fund-ii + kb-note-24a :: {"want":47374273}
FAIL consolidated the PDF holds the USD total $473,742.73 and the EUR total €102,092.95 :: ["$473,742.73","Summary (USD)"]
REPORTS STARTERS: FAIL (cases run: 2) - words, consolidated
```

### red-3 (Task 3: cases speed, selfcheck of REPORTS STARTERS and types, inject, selfcheck of REPORTS XLSX)

Not a true RED, stated plainly: on their first run all five new cases passed (`speed: 14 reports, 2321 ms, 166 ms per
report`; REPORTS STARTERS: PASS (cases run: 2); REPORTS XLSX: PASS (cases run: 3)). They test behaviour that wave 1 (the
workbook writer and `NS.reports.sheets`) and Tasks 1-2 had already built, so Task 3 had nothing left to build. Instead,
red-3.txt holds the same cases run against four temporary mutations, reverted with `git checkout` (status empty after):
a label starting with `=` written as a formula (filesout.js), a `docProps/app.xml` part naming an application
(filesout.js), money rounded to whole dollars in `sheets()` (reports.js), and the q-pe starter missing. FAIL lines and
last lines, cut at 260 characters:

```
FAIL speed ran to the end :: Error: No such starter
REPORTS STARTERS: FAIL (cases run: 2) - speed
FAIL types st-capital: no document-properties part naming an application :: ["[Content_Types].xml","_rels/.rels","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","docProps/app.xml",...
FAIL types dn-notice: no document-properties part naming an application :: [...,"docProps/app.xml",...
FAIL types q-realestate: every money cell (45) is a number equal to the model's cents / 100 in #,##0.00;(#,##0.00); every percent cell (3) is the model's fraction :: [{"sheet":"Your capital account","ref":"B2","want":107525.65,"got":{"v":107526,"t":"n",...
FAIL types q-realestate: no document-properties part naming an application :: [...
FAIL types a-review: every money cell (94) is a number equal to the model's cents / 100 in #,##0.00;(#,##0.00); every percent cell (11) is the model's fraction :: [{"sheet":"Your capital account","ref":"B2","want":343419.96,"got":{"v":343420,"t":"n",...
FAIL types a-review: no document-properties part naming an application :: [...
FAIL types p-summary: no document-properties part naming an application :: [...
FAIL types t-season: no document-properties part naming an application :: [...
FAIL inject the label "=HYPERLINK(\"http://x\",\"y\")" is a text cell equal to the typed text :: {"v":"=HYPERLINK(\"http://x\",\"y\")","t":"f","fmt":"General","f":true,"b":false}
FAIL inject raw formulas stay 0 :: 1
REPORTS XLSX: FAIL (cases run: 3) - types, inject
```
The whole-dollar mutation does not show on the fund A workbooks because fund A's figures are whole dollars; it shows on
Ashwell Ridge and Kestrel Bay. The selfcheck cases test the shared runner and pass with or without any mutation.

### Task 3 verify (the plan's gate; SCRATCH/exec-12-05/verify-3.sh, the plan's command unchanged, run with GATE_FRESH=1)

```
==> .../exec-12-05/st.txt <==
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS STARTERS: PASS (cases run: 8)

==> .../exec-12-05/xl.txt <==
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS XLSX: PASS (cases run: 4)
GATE ok   REPORTS MATH
GATE ok   REPORTS MODEL
GATE ok   REPORTS PDF
GATE ok   REPORTS RECORD
GATE ok   REPORTS STARTERS
GATE ok   REPORTS XLSX
GATE_EXIT=0 (phase 12 checks only)
VERIFY-3 EXIT=0
```
REPORTS STARTERS 123 PASS, REPORTS XLSX 49 PASS, 0 FAIL, 0 KEPT. No gate step was kept from a cache (0 "kept from" lines).
diy.html, portal.html, index.html and console.js are unchanged from the base (part of the command). The full reference
gate was not run, as instructed: this plan adds files no page loads.

Measured build time (case speed: q-pe for each of kb-fund-ii's 14 holders, resolve then compose, timed with Date.now(),
no threshold):
```
speed: 14 reports, 2846 ms, 203 ms per report
```
(The first run of the same case, before the mutations, measured `speed: 14 reports, 2321 ms, 166 ms per report`.)

### Server tests (server/node_modules linked for the run, removed afterwards)

```
1..387
# tests 387
# pass 387
# fail 0
```

## Starters as built (assets/js/reports-templates.js)

Cover and disclosures are on in all of them. Every other catalogue section of the type is present and off.

| id | name | type | fund type | sections on (print order) | chart |
|----|------|------|-----------|---------------------------|-------|
| st-capital | Capital account statement | statement | any | capital (ytd), commitment (activity), distributions, chart | dist |
| st-consolidated | Consolidated statement | statement | any | summary, capital, commitment, distributions, chart | allocation |
| st-yearend | Year-end statement | statement | any | letter, capital (itd), commitment, distributions, performance | none |
| dn-notice | Distribution notice | distribution | any | notice (plain cover) | none |
| dn-letter | Distribution notice with cover letter | distribution | any | letter, notice | none |
| q-realestate | Quarterly letter: real estate | quarterly | realestate | letter, capital, distributions, performance, assets, fees, chart, outlook | dist |
| q-credit | Quarterly letter: private credit or income | quarterly | credit | letter, capital, distributions, performance, holdings, fees, chart, outlook | dist |
| q-pe | Quarterly letter: venture or private equity | quarterly | pe (12-08 offers it for vc) | letter, capital, commitment, performance, holdings, fees, chart, outlook | capital |
| q-spv | Quarterly letter: single asset | quarterly | spv | letter, capital, distributions, assets, performance, chart | dist |
| q-open | Quarterly letter: open-ended fund | quarterly | open | letter, capital, performance, holdings, fees, chart, outlook | capital |
| q-firm | Quarterly letter: every fund | quarterly | any | letter, summary, capital, performance, chart, outlook | allocation |
| a-review | Annual review | annual | any | letter, capital (itd), distributions, performance, holdings, fees, statements, chart, outlook | capital |
| a-realestate | Annual review: real estate | annual | realestate | as a-review plus assets | capital |
| a-rega | Annual report to investors (Regulation A) | annual | any | as a-review; title from the model (C-09) | capital |
| p-summary | Performance and holdings summary | performance | any | performance, holdings, fees, chart | allocation |
| p-property | Property summary | performance | realestate | holdings, assets, performance | none |
| t-season | Tax-season summary | tax | any | letter, taxsummary, taxdocs (expected '') | none |
| t-documents | Tax documents notice | tax | any | taxdocs | none |

Disclosures, in order: the tenant's disclaimer, then "Figures are unaudited and prepared from the fund’s books as of the
date shown.", then "Performance is shown net of fees and carried interest. Past performance does not guarantee future
results." (q-open: "net of fees and incentive allocation"), then "This report is for the investor named on it and is not
an offer to sell or a solicitation of an offer to buy any security." (q-firm: "for investors in the funds named in it").
Statements and tax summaries add "Book capital, not tax capital. Your tax documents are authoritative for tax purposes."

Letters use only {first_name}, {investment}, {distributions_period}, {period_end} and {firm}. Investor fields appear only
in statement, notice and tax letters, which always go to one investor. q-firm uses only {period_end} and {firm}. No letter
is longer than three paragraphs, and none forecasts anything or asks for more investment. Outlook sections are on but
empty: the sponsor writes them, and an empty outlook prints nothing.

**Neither the owner nor any counsel has read this wording.** It is default text the sponsor edits. Each starter's blurb
(seen by the sponsor, never by investors) ends with "Default wording, not yet read by counsel."

## Deviations from Plan

1. **[B2, planned] reports.js startFrom** (2 lines): a starter's disclosures are added after the tenant's disclaimer
   instead of replacing it. Case catalogue checks that the disclaimer comes first for every starter on every sample firm.
2. **[Rule 3] assets/js/tenants.js: one Pellbrook sample sentence reworded** so that no report says "audited" (C-13).
   every-sample and words prove it.
3. **[Plan text] dn-letter is letter + notice.** The plan also lists a distributions section, but the catalogue has none
   for the distribution type, so normalise would drop it.
4. **[Plan order] q-spv and p-property print their sections in the order the plan lists** (q-spv: assets before
   performance; p-property: holdings, assets, performance). The sections that are on fill the catalogue places of the
   sections that are on, in the listed order; the check works out the same order on its own.
5. **[Wording rule: every sentence true] two disclosure variants:** q-open (incentive allocation) and q-firm (no investor
   is named).
6. **[Rule 1, check] wrapped table cells:** the checks read each PDF with both pdftotext -layout and -raw, and a string
   counts as present if either reading holds it (see the red-2 note).
7. **[Interface] case inject wraps the real figures** so that holding rows have ids, because no holding has one before
   11-11 (open item 2).
8. selfcheck was added in Task 3. Its RED is the runner's own behaviour, as in 12-01 to 12-03. The `.parts` results store
   is kept on purpose (12-CONTEXT).

## Threat surface

Nothing new beyond the plan's threat model. T-12-21: every-sample runs othersIn and searches every PDF for the names of
the firm's other investors (336 PDFs, none found). T-12-22: case words and the wording rules. T-12-23: case inject
(= + - @). T-12-24: lib12 leak on every PDF's text and pdfinfo; Author, Producer and Creator are the firm's name in every
PDF.

## Commits (wip/12-05)

- b0fa2eb test(12-05): RED checks for the starters and their workbooks, case fund-a
- a87512f feat(12-05): starter templates tracer - st-capital, dn-notice, p-summary, t-season
- 5dfe7e6, 5a19e8e, f6adf9f, 44617af, 6f02a3c wip(12-05): save
- e15028a feat(12-05): all 18 starters, tenant disclaimer kept first, every sample firm end to end
- baa5d14 wip(12-05): save
- f2463e9 test(12-05): workbooks of every report type, typed labels kept as text, measured build time
- this SUMMARY's commit follows

## Known Stubs

None. Outlook text is empty on purpose: the sponsor writes it, and an empty outlook prints nothing. taxdocs `expected` is
'' on purpose: the sponsor types when the documents are expected.

## Self-Check: PASSED

- FOUND: assets/js/reports-templates.js, checks/reports-starters.js, checks/reports-xlsx.js, 12-05-deferred-items.md
- FOUND commits b0fa2eb, a87512f, e15028a, f2463e9 on HEAD (`git log da1ce23..HEAD`: 10 commits before this SUMMARY's)
