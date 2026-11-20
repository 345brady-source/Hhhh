---
phase: 12-report-builder
plan: 05
status: in progress
---

# Phase 12 Plan 05: starter templates and spreadsheets (in progress)

Evidence is pasted here as it is produced (SAVE-RULES rule 5). Base commit: da1ce239c472d3a0a287571b7b953d0eac780ac8.

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
