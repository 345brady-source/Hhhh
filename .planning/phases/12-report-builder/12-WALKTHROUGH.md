# Phase 12 walkthrough: the report builder on the owner's path (plan 12-09)

Run 2026-11-27 on wip/12-09 (start commit 5394b73). Chromium phone frame, not an iPhone. Nothing here is called ready.

## Failures

The walk's last line, this run (SCRATCH/exec-12-09/walk.txt):

```
WALK12: FAIL (steps run: 28) - kb-open, kb-preview, ar-letter, ar-preview-pdf, pb-letter, fa-statement, fa-holdings
```

239 checks passed and 8 failed. There are two faults. Both are in product code, and neither was fixed here (this plan
changes no product file). Each goes to a GSD debugger with the failing walk steps as its RED check:
`node .planning/phases/12-report-builder/checks/walk12.js` (the steps run in order; the walk takes 117 s).

1. **Preview tables break words letter by letter on the phone (steps kb-preview, ar-preview-pdf, pb-letter,
   fa-statement, fa-holdings).** At 390 px, every preview table with 4 or more columns squeezes its text columns to
   27-36 px. Words then wrap one or two letters per line: 'Investment' runs over 8 lines, 'Brightline' over 7, and so
   do 'Fund A, L.P.', 'December 15, 2026' and 'Total'. The walk counted 143 broken words in five previews:
   - Kestrel Bay: Holdings and Net performance, 60
   - Ashwell Ridge: Distributions, Totals and Net performance, 22
   - Pellbrook: Holdings, 40
   - fund A's statement: Distributions and Totals, 9
   - fund A's summary: Net performance and Holdings, 12

   Holdings and Net performance are also wider than the preview and scroll sideways: 343-544 px in a 308 px box.
   Expected: every word whole on one line, as in the 3-column tables (Your capital account, Monthly net return), which
   are fine. Screenshot `walk12__fa-holdings__28-fa-holdings.png` shows it: the 'Investment' column of Net performance
   reads one letter per line, and the Holdings header is cut off at '% of net as'.

   The PDFs have their own composer. REPORTS FLOW's preview-pdf part passed in this run's gate: it finds every word of
   the preview in the PDF's words, counted. The PDF screenshots (07, 18, 20, 27) show only the first pages, where the
   tables have 3 columns. So the multi-column tables in the PDF have not been looked at; that is for the owner's check.

   No earlier check caught this. REPORTS FLOW reads the preview's text, not how it is drawn. I found it by looking at
   the walk's screenshots, then added the assertion to walk12.js (commit cf89610) so it fails on screen.
2. **Web font requests leave the page's origin (steps kb-open, ar-letter, pb-letter).** W5 counts every request
   outside the page's own origin from the first request of the walk. The count was 4, all to fonts.googleapis.com:
   - 2 when the page loads: the stylesheet link in diy.html and brand.js's font for the firm, step kb-open
   - 1 on switching to Ashwell Ridge (Public Sans), step ar-letter
   - 1 on switching to Pellbrook (Funnel Display and Funnel Sans), step pb-letter

   Expected: 0. These are not report builder requests. They are the portal's brand fonts (diy.html line 8 and
   assets/js/brand.js lines 128-166), so they are older than phase 12. In a frame with no network they fail without
   any error on screen, and the page falls back to its other fonts. Nothing a sponsor or investor reads names the font
   host. The check browser answers them with an empty style sheet, so nothing left this machine during the run.

Not failures, but reported plainly:
- Ashwell Ridge's Cedar Row has one property. The sample journal holds no property income or expense lines for it in
  Q4 2026 (0 of 1), so its asset page shows the photo and no 'Net operating income' table. The NOI path was not shown on
  screen by this walk.
- The sweep needed one decision of mine, recorded as a deviation. In assets/js/reports-ui.js line 41, the string
  'reports-pdf.js' contains 'pdf.js', which the vendor pattern matches. It is the report module's own file name in the
  parts loader: a file the page loads, which no one sees. The sweep prints it and sets it aside. Only a string that is
  exactly the name of a report script in assets/js is set aside, and the check fails if anything else is.

## The steps

Phone frame 390x844 with touch, inside a sandboxed frame whose policy refuses every connection and loads scripts from the
page's own address only; Chromium, not iPhone Safari; clock 2027-01-20. One browser for the whole walk, so the two firms
share one file store. Every step: one screenshot, then the screen checks (the policy refused nothing, no new script
error, requests outside the page's own origin counted, no vendor, model or library name and never the forbidden word on
screen, a way out of the view on screen; for a dialog, its Close button on screen). Screenshot files are in
SCRATCH/exec-12-09/shots, named `walk12__<step>__<file>`; walk12-index.txt there lists them in step order.

### Kestrel Bay (sample firm, venture fund kb-fund-ii)

1. **kb-open**: signed in as admin, Reports, tab 'Investor reports'. The 506 line ends 'To be confirmed with counsel.'
   Frame measured 390x844 with touch; fetch() refused. Shot `01-list.png`.
    **FAIL:** 2 requests to fonts.googleapis.com when the page loads (Failure 2). The step's other 7 checks passed.
2. **kb-new**: New report from 'Quarterly letter: venture or private equity', named 'Q4 2026 letter', for Kestrel Bay
   Fund II, Q4 2026, every investor in the fund. The editor opened with the starter's sections on. Shot `02-editor.png`.
3. **kb-sections**: 'Fees and expenses' switched off (its table and its no-fees line left the preview); 'Holdings'
   moved up one place, above 'Performance', in the editor and in the preview. Shot `03-sections.png`.
4. **kb-letter**: the letter typed by touch: 'Highlights' made bold with the toolbar, and a two-item list ('Two new
   portfolio companies', 'One follow-on round'); both show in the preview, no error. Shot `04-letter.png`.
5. **kb-asset-photo**: Asset updates switched on. It lists Kestrel Bay Fund II's 7 sample holdings, each under
   `kb-fund-ii-<slug of its name>`, and never 'No holding in the books for this fund yet.' An 800 x 600 JPEG made in
   the page went on 'Brightline Packaging Holdings, LLC', kept by that holding's id, and shows in the preview.
   Shot `05-asset-photo.png`.
6. **kb-preview**: the preview, prepared for Davis Family Trust (KBC-1001), no error, all three buttons on, the photo,
   the bold word and the list in it. Shot `06-preview.png`.
    **FAIL:** 60 words broken across lines in Holdings and Net performance (Failure 1). The step's other checks passed.
7. **kb-pdf**: 'See the PDF': 5 pages drawn inside the page. Shot `07-pdf.png`.
8. **kb-download**: 'Download PDF' gave Kestrel_Bay_Quarterly_report_Q4_2026_KBC_1001.pdf (42,534 bytes, 5 pages). It
   holds the 800 x 600 photo as a JPEG image, 'Highlights', the list and the first holder's name, no 'Fees and expenses'
   table; Producer and Creator are the firm's name; no vendor, library or model name, never audited or the forbidden
   word in its text or properties. Shot `08-download.png`.
9. **kb-generate**: 'Save' showed Version 2; 'Generate for 14 investors' ended 'Made 14 of 14'; the run is recorded
   with one file per holder. Shot `09-generate.png`.
10. **kb-deliver**: 'Deliver' as Pat Admin: 'Delivered by Pat Admin', 14 documents. Shot `10-deliver.png`.
11. **kb-paper**: 'Send on paper' shows the counsel line (C-01) and all 14 holders once, each with 'Download PDF' and
    'Mark sent on paper'. Shot `11-paper.png`.
12. **kb-mark-paper**: 'Mark sent on paper' for KBC-1001 with the date 2027-01-19: recorded with the person signed in,
    the row reads 'Sent on paper Jan 19, 2027 by Kestrel Bay admin' and the button is gone; the change log's last entry
    is 'Report sent on paper'. (The point 12-08 left unproven on screen.) Shot `12-mark-paper.png`.
13. **kb-tell**: 'Tell investors' opened Notices with the quarterly template filled in for the 14 investors; the button
    still reads 'Send to 14 investors'; no 'Notice sent', no notice recorded. Shot `13-tell.png`.
14. **kb-investor-open**: as KBC-1001: Documents lists the report under Reports; opened, its pages drawn in the page;
    the bytes shown have the SHA-256 of the record. Shot `14-investor-open.png`.
15. **kb-opened**: back as admin, that file reads 'Opened 1 time'. Shot `15-opened.png`.
16. **kb-tell-refused**: 'One letter for everyone' generated (Made 1 of 1), delivered, its only file withdrawn with the
    reason 'Sent in error'; 'Tell investors' then shows exactly 'Every file of this report is withdrawn; there is no
    one to tell.', stays on Reports, and the Notices draft is unchanged. Shot `16-tell-refused.png`.

### Ashwell Ridge (sample firm, real estate, ar-cedar-row)

17. **ar-letter**: 'Quarterly letter: real estate' for Cedar Row. Asset updates lists its 1 property ('The Residences
    at Cedar Row') under `ar-cedar-row-<slug>`; a photo went on it and shows in the preview. NOI: the journal holds no
    property income or expense lines for it in Q4 2026 (0 of 1), so no 'Net operating income' table, as built.
    Shot `17-ar-assets.png`.
    **FAIL:** 1 request to fonts.googleapis.com when the firm changed (Failure 2). The step's other checks passed.
18. **ar-preview-pdf**: 'See the PDF': 4 pages drawn; 'Download PDF' gave Ashwell_Ridge_Quarterly_report_Q4_2026_ARR_1001.pdf
    (39,807 bytes) holding the photo as a JPEG; no vendor name. Shot `18-ar-pdf.png`.
    **FAIL:** 22 words broken across lines in Distributions, Totals and Net performance (Failure 1). The step's other checks passed.

### Pellbrook (sample firm, open-ended, pb-long-short)

19. **pb-letter**: 'Quarterly letter: open-ended fund': the table 'Monthly net return' with Oct 2026 1.2%, Nov 2026 3.6%,
    Dec 2026 −1.6%, and 'Distributions and redemptions' in the capital account. Shot `19-pb-preview.png`.
    **FAIL:** 40 words broken across lines in Holdings, and 1 request to fonts.googleapis.com when the firm changed (Failures 1 and 2). The step's other checks passed.
20. **pb-pdf**: 'See the PDF': 3 pages drawn; the downloaded PDF holds 'Monthly net return', 'Distributions and
    redemptions' and the three monthly figures. Shot `20-pb-pdf.png`.
21. **pb-generate**: Save (Version 2), 'Made 16 of 16', delivered by Pat Admin, in the same browser as Kestrel Bay.
    Shot `21-pb-deliver.png`.

### Two firms in one browser, and the investor viewer's hash check

22. **two-firms**: all 15 Kestrel Bay report document ids start `rf-kestrel-bay-`, all 16 Pellbrook ids start
    `rf-pellbrook-`, none shared. Pellbrook's first holder (PBP-1001) opened the report: SHA-256 equal to doc.sha256,
    drawn in the page. Shot `22-pb-investor.png`.
23. **two-firms-kb**: Kestrel Bay's first holder (KBC-1001), after Pellbrook generated: still Kestrel Bay's own file,
    SHA-256 equal to doc.sha256, never one of Pellbrook's. Shot `23-kb-investor-again.png`.
24. **hash-check**: test setup only: KBC-1002's kept file overwritten in the file store with Pellbrook's bytes. Opened as
    KBC-1002: Pellbrook's bytes never shown; the file remade, SHA-256 equal to the record, drawn in the page; the kept
    bytes left as they were. Shot `24-hash-remade.png`.
25. **hash-not-kept**: the same file with the remake taken off the page: the viewer says exactly 'The original file is
    not kept on this device.' and shows no bytes. Shot `25-hash-not-kept.png`.

### Fund A (a real fund with hand-worked figures, seated as its own firm with no sample flag)

26. **fa-statement**: 'Capital account statement' for FA-1001, 2026-10-01 to 2026-12-31: the preview shows $334,000.00,
    −$6,000.00, $20,000.00, −$3,000.00, $345,000.00 and 'Preliminary: the books are not closed for this period.',
    prepared for Investor One, no other investor named. Shot `26-fa-statement.png`.
    **FAIL:** 9 words broken across lines in Distributions and Totals (Failure 1). The figures and the preliminary line are right.
27. **fa-pdf**: 3 pages drawn in the page; the downloaded PDF shows the same five figures and the preliminary line;
    Producer and Creator 'Fund A Sponsor Management, LLC'. Shot `27-fa-pdf.png`.
28. **fa-holdings**: 'Performance and holdings summary' for Fiscal year 2026: the engine's holdings are exactly one row,
    Portfolio Co X, fair value 49,000,000 cents, cost 40,000,000 cents, equal to the journal's 1100 and 1150 lines for
    holding fa-x ($490,000.00 at cost $400,000.00); the preview's Holdings row shows $490,000.00 and $400,000.00.
    Shot `28-fa-holdings.png`.
    **FAIL:** 12 words broken across lines in Net performance and Holdings (Failure 1). The engine equals the journal.

## Measured times

Measured in this run, from walk.txt. These are the Chromium phone frame on this machine, not an iPhone:

```
generate: Kestrel Bay, 'Quarterly letter: venture or private equity', kb-fund-ii, every investor in the fund: 14 files, 1214 ms in the page (87 ms per file, performance.now), 1344 ms from the tap to the last line
generate: Kestrel Bay, 'Quarterly letter: venture or private equity', kb-fund-ii, one letter for everyone: 1 files, 193 ms in the page (193 ms per file, performance.now), 306 ms from the tap to the last line
generate: Pellbrook, 'Quarterly letter: open-ended fund', pb-long-short, every investor in the fund: 16 files, 1102 ms in the page (69 ms per file, performance.now), 1204 ms from the tap to the last line
```

- The whole walk: 117 s, 28 steps. The walk run before the layout check was added also took 117 s; its three
  Generate times were 1021 ms, 143 ms and 992 ms.
- REPORTS SWEEP (4 parts): 41 s.
- The full gate: 4,819 s (12:43:52 to 14:04:11 UTC).
- Earlier plans, quoted from their summaries:
  - Node (12-05): `speed: 14 reports, 2321 ms, 166 ms per report` and `speed: 14 reports, 2846 ms, 203 ms per report`
  - Node (12-07): `speed: 23 reports, 5989 ms, 260 ms per report`, `6315 ms, 275 ms per report` and `7175 ms, 312 ms
    per report` (inside a gate)
  - Phone frame (12-08): `speed: 23 reports, 1962 ms, 85 ms per report` and `3173 ms, 138 ms per report` (inside a gate)
  - Composing layout-a (12-03): 256 ms in Node and 383 ms in the phone frame

No time on an iPhone has been measured.

## The sweep (RB-15)

`REPORTS SWEEP: PASS (parts run: 4)` (SCRATCH/exec-12-09/sweep.txt). It checks four things:
- **outputs:** 66 reports, one per starter for each firm that has a fund of the starter's type: Kestrel Bay, Ashwell
  Ridge, Greywater, Pellbrook, and fund A as FA-1001. That is 66 PDFs and 66 workbooks (621 workbook parts). It scans
  the PDF text, the PDF properties and every string of every workbook part. It found no vendor, library or model name,
  never the forbidden word, never "audited" or "ILPA compliant", and no gross IRR, return, performance or multiple.
  24 pairs of starter and firm have no fund of the starter's type, and are listed in sweep.txt.
- **screens:** 37 views read on the phone frame:
  - the list
  - the editor of four report types, with each section's options opened in turn
  - the preview and the PDF panel
  - Generate while it runs
  - the archive, opened and delivered
  - Send on paper and the withdraw form
  - an investor's Documents, with the report open
- **sources:** 2,806 string literals in the 8 report scripts and 100 rules of reports.css. One file name was set aside,
  as described under Failures.
- **managed:** index.html, as staff and as an investor, asks for no reports script, shows no 'Investor reports' and
  shows no error.

The fonts inside the PDFs' font data are DejaVuSans and DejaVuSans-Bold, each with a number that differs per file (C-02).
They are printed once in sweep.txt for the owner's check. They are not page text.

## The gate

GATE_OUT=SCRATCH/exec-12-09. The base is 5394b73 and the gate judged a53448b. The gate's last line in this run
(SCRATCH/exec-12-09/gate.txt): `GATE_EXIT=0`. It has 80 GATE ok lines and 0 GATE FAIL lines. Server tests: 555 on this
tree, 555 on the base, 0 declared.

The reference gate has 29 step lines, the base's 27 plus 2 (both measured). Its own last line is `GATE_EXIT=0`. It now
runs REPORTS FLOW (8) and DELIVER FLOW (8), and gate12's step 5 reports those two as 'run in the reference gate'.
Signing: base 75 PASS / 0 FAIL, plan 75 PASS / 0 FAIL. Record: base 40 PASS / 0 FAIL, plan 40 PASS / 0 FAIL.

Since then, the only commits are cf89610 (walk12.js, which is marked "// gate: none" and never run by the gate) and the
written reports.

The gate's last 40 lines, verbatim:

```
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
GATE ok   DELIVER FLOW (run in the reference gate)
GATE ok   REPORT FIXES
GATE ok   REPORTS FLOW (run in the reference gate)
GATE ok   REPORTS MATH
GATE ok   REPORTS MODEL
GATE ok   REPORTS PDF
GATE ok   REPORTS RECORD
GATE ok   REPORTS RUN
GATE ok   REPORTS STARTERS
GATE ok   REPORTS SWEEP
GATE ok   REPORTS XLSX
GATE_EXIT=0
```

## RED outputs (the checks seen to fail first)

- Task 1, red-1.txt, the first walk run, before the other firms' steps existed:
  `WALK12: FAIL (steps run: 24) - kb-open, kb-new, ... , fa-statement, fa-holdings`. The eight steps not written yet
  each failed `step written`. Every Kestrel Bay step also failed the off-origin count at that point, because it was
  counted from the walk's start.
- Task 2, red-2.txt, the sweep's outputs part with --plant:
  `HIT kestrel-bay st-capital kb-fund-ii KBC-1001 PDF text: Drawn with pdf-lib` and
  `REPORTS SWEEP: FAIL (parts run: 1) - outputs`.
- Task 3, red-3.txt, the self-test's dedupe case before the step 5 change:
  `GATE FAIL STAND IN` (the stand-in ran and printed `STAND IN: FAIL (cases run: 1)`) and
  `GATE12 SELF-TEST: FAIL - dedupe`. After the change: `GATE12 SELF-TEST: PASS (9)`.

## Open points for the owner or counsel

- **C-01:** the paper list for investors with no e-delivery consent on record shows "To be confirmed with counsel." The
  walk showed it, and 'Mark sent on paper' now works on screen (step 12).
- **C-02:** the font names DejaVuSans and DejaVuSans-Bold are inside each PDF's font data. They are not page text.
- **C-13:** the 506 line "Rule 506 offerings have no federal duty to send periodic reports; ..." shows "To be confirmed
  with counsel."
- The starters' default wording and disclosures have not been read by counsel. The editor says "Starting wording; to be
  confirmed with counsel."
- Measured in Chromium only (390x844 with touch, and 1280x800 for the managed check). iPhone Safari inside the Claude app
  has not been run here.
- Saving a downloaded PDF or spreadsheet inside the Claude app on the iPhone has not been tried.
- From portal-report-hash:
  - A report document with nothing kept shows the "not kept" sentence and is not remade.
  - A remade file is composed again on Download after View, and that has not been timed.
- Ashwell Ridge's sample journal has no property lines, so the NOI table was not seen on screen.
- The multi-column tables inside the PDFs have not been looked at on a screen; only the first pages were shot.
- The two faults under Failures go to a GSD debugger.

Nothing here is ready until the owner has checked it on his iPhone.
