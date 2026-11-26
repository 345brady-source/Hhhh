---
phase: 12-report-builder
plan: 06
subsystem: report builder (screens)
status: complete
tags: [reports, builder, rich-text, photos, preview, pdf, xlsx, phone]
requires: [12-01 NS.reportsData, 12-02 NS.reports, 12-03 NS.reportsPdf, 12-04 NS.reportRecord, esign.js viewPdf, filesout.js workbook]
provides: [assets/js/reports-ui.js (NS.reportsUI = { PARTS, part, refresh, state }), assets/css/reports.css, checks/reports-flow.js (REPORTS FLOW, 8 parts)]
affects: [12-08 (adds reports-templates.js, reports-run.js, reports-deliver.js to PARTS and its sections through NS.reportsUI.part), 12-09 (walkthrough, publish)]
tech-stack:
  added: []
  patterns: [parts loaded from beside the file in order (taxdocs-ui.js pattern), preview redrawn in place while typing, Range wrapping for bold and italic (no execCommand), canvas redraw of photos to JPEG kept as bytes]
key-files:
  created: [assets/js/reports-ui.js, assets/css/reports.css, .planning/phases/12-report-builder/checks/reports-flow.js]
  modified: [assets/js/console.js (4 added, 3 removed), diy.html, portal.html, server/help/guide.md, server/lib/help-guide.mjs (rebuilt), .planning/tools/preview/help-data.js (rebuilt)]
decisions:
  - "The quarterly type is labelled 'Quarterly letter' in the picker (plan wording); the report keeps the model's title 'Quarterly report'"
  - "Photo file ids are rp-<tenant id>-<n>: the browser's file store (cvp-documents) is shared by every portal in the browser, so a bare rp-<n> could overwrite another firm's photo"
  - "The 12-photo cap counts asset photos, as NS.reports.normalise does; the cover photo is separate"
  - "Move buttons show 'Move up' and 'Move down'; their accessible names add the section ('Move up: Performance')"
  - "Edits are a draft until Save; Back with unsaved changes asks first ('Changes are not saved.', Save or 'Leave without saving')"
metrics:
  completed: 2026-11-26
estimate_tokens: 105000
actuals:
  tokens: 30000      # chars/4 over reports-ui.js (65,223 chars), reports.css (11,374), reports-flow.js (43,740) and the small html/console/guide lines
  tasks: 3
  commits: 15        # MEASURED: git rev-list --count da1ce23..HEAD --first-parent at 9804289 (the gated tree), before this summary's commit
plan_head_before: da1ce239c472d3a0a287571b7b953d0eac780ac8
plan_head_after: 9804289
---

# Phase 12 Plan 06: the builder screens

The self-serve Reports page has a third tab, "Investor reports". A sponsor's team member creates a report from a type and a starter (only 'Blank' until 12-08 loads 12-05's starters), turns sections on and off, moves them, writes the letter, outlook and disclosures in a small rich-text editor with merge fields, and sets the cover style, accent and photo, the photos and figures for asset updates, the chart and the capital and commitment options. They choose what the preview is for (fund, period or payment or tax year, who), see the preview drawn from the same model as the PDF, see the PDF drawn in the page, and download the PDF and the spreadsheet. Measured in Chromium only, at 390x844 with touch and at 1280x800, inside the sandboxed frame with connections refused. Nothing here is ready until the owner has checked it on his iPhone.

## Failures first

1. **Final gate: passed, but only on its third run.** Run 2 (on 9804289) was stopped by the 2-hour limit and resumed. Run 3 then failed four steps with browser crashes ("Target crashed"; "Target page, context or browser has been closed"). Those were DIST FLOW, SHIPPED LIBS, TAXDOCS FLOW and the signed-record comparison ("NEW FAIL in record: FAIL run finished without an exception :: page.click: Target crashed"). At that moment the machine's disk had 621 MB free (99% full). My own folder holds 2.4 MB; the scratchpad holds 25 GB, mostly edgar (9.1 GB), owner-set (2.5 GB), train and exec-06-10 (1.6 GB each), so I did not delete anything. On the resume (disk at 4.5 GB free) all four passed, unchanged: `GATE ok   DIST FLOW`, `GATE ok   SHIPPED LIBS`, `GATE ok   TAXDOCS FLOW`, `record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL`. The same three phase 10 checks had also passed in the first gate run on my earlier tree.
2. **Gate run 1 (on 576b0f9) failed HELP PREVIEW (6) because of my change.** The guide step made the preview's copy of the guide (.planning/tools/preview/help-data.js) stale. I rebuilt it with its own tool, make-help-data.mjs (ee5cc61). After that HELP PREVIEW passed alone and in the gate.
3. **A gap I found myself, now fixed:** 'Back to reports' threw away unsaved edits with one tap. RED (red-4) came first, then the fix (ee5cc61).
4. **Not proven, and needs a decision:** the sample firms' holdings have no id until plan 11-11 moves holdings onto the journal. Asset updates keeps photos, wording and figures per holding id, so with sample data the Asset updates options say "No holding in the books for this fund yet." Part cover-photos-desktop gives the engine's rows ids inside the page (a stand-in, documented in the check) to prove the 12-photo cap and storage. Real holdings from the books have ids (books.js addHolding).
5. **Desktop way out:** at 1280x800, mid-page, wayOut passes because of the demo bar's fixed role control. Without the demo bar, the editor keeps a sticky bar with 'Back to reports', but wayOut does not count a button. The list page has no sticky bar. This is the same open limit as the rest of the console on desktop.

## Final gate (Task 3 verify, the plan's command with plan-check B3, from a script file; VERIFY-3 EXIT=0)

Base for the gate is 0dd6b3f, the claude/refract-reskin tip merged into this branch (see Deviations; the plan's own base was da1ce23). Last lines of gate.txt, verbatim:

```
GATE ok   STATEMENTS (kept from 2026-11-26 22:12:18 UTC)
GATE ok   WORKBOOK (kept from 2026-11-26 22:28:45 UTC)
GATE ok   REPORTS FLOW (kept from 2026-11-26 22:30:29 UTC)
GATE ok   REPORTS MATH (kept from 2026-11-26 22:30:43 UTC)
GATE ok   REPORTS MODEL (kept from 2026-11-26 22:30:44 UTC)
GATE ok   REPORTS PDF (kept from 2026-11-26 22:45:56 UTC)
GATE ok   REPORTS RECORD (kept from 2026-11-26 22:45:58 UTC)
GATE ok   REPORTS RUN (kept from 2026-11-26 22:46:25 UTC)
GATE ok   REPORTS STARTERS (kept from 2026-11-26 22:48:19 UTC)
GATE ok   REPORTS XLSX (kept from 2026-11-26 22:48:24 UTC)
GATE_EXIT=0
VERIFY-3 EXIT=0
```
70 GATE ok lines and 0 GATE FAIL. Among them: `GATE ok   server tests 403 = base 403 + 0 declared`, `GATE ok   PHONE LAYOUT (8)`, `GATE ok   DIST FLOW`, `GATE ok   HELP PREVIEW (6)`, `signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL`, `record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL`. REPORTS FLOW alone on 9804289: `REPORTS FLOW: PASS (parts run: 8)`, with 125 PASS lines and 0 FAIL on its first run on that tree. The base tree and the server/node_modules link were removed.

Measured in the parts: KBC-1001's Q4 2026 capital account ends at $320,823.87 in the preview, equal to NS.audit.period. All 202 distinct words of the preview are in the PDF's words, with their counts. All 53 money strings of the model are in both. All 53 money cells of the spreadsheet equal the cents / 100, with no formula. The 3000 x 2000 cover photo is kept as a 1600 x 1067 JPEG.

## Exact lines added

console.js (numstat 4 3):
```
+      const hooked = NS.runHooks('reportTab', r.tab, w);
-        `${head('Reports', 'Distribution reports ... open in Excel.')}
+        `${head('Reports', hooked ? '' : 'Distribution reports ... open in Excel.')}
   the tab bar line: + ${NS.runHooks('reportTabs', r.tab)} after the Contacts button
-        ${body}`,
+        ${hooked || body}`,
```
diy.html and portal.html: `<link rel="stylesheet" href="assets/css/reports.css">` after tax.css; `<script src="assets/js/reports-ui.js"></script>` after taxdocs-ui.js.
guide.md (console-reports only): step 1 now says `Choose "Distributions", "Contacts" or "Investor reports" at the top.` I added step 4: `In "Investor reports", choose the "Report type" and "Start from", then "Create". Turn sections on or off, use "Move up", and check the preview. "See the PDF" shows the file; "Download PDF" saves it.` That adds 222 bytes. **Sponsor guide measured: 46,508 bytes on my tree; 46,920 of 48,000 after merging 10-12 and 08-17** (investor guide 15,436).

## New shipped files a preview build must add

assets/js/reports-ui.js, assets/css/reports.css. reports-ui.js loads these as parts from beside itself: assets/js/reports-data.js, reports.js, reports-pdf.js, reports-record.js. The first spreadsheet download loads assets/js/filesout.js. reports-pdf.js uses assets/vendor/pdfwrite/* and assets/vendor/textfont/text-regular.js and text-bold.js. The PDF view uses the shipped page viewer already in the build. I found no raw control bytes and no U+FFFD in the two new files.

## Unconfirmed until the owner checks

iPhone Safari editing (selection, bold, list, paste), a camera-roll photo (decode, orientation, canvas redraw), the save prompt in the Claude app, and the look of every screen. Screens are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-12-06/shots with index.txt. That folder is kept on purpose for the owner's check, although the plan's command would remove it.

## Deviations

1. [B3] console.js bound 4/3 (plan-check), met exactly.
2. [Rule 3] .planning/tools/preview/help-data.js rebuilt by make-help-data.mjs after the guide change (HELP PREVIEW needs it current); help-guide.mjs rebuilt by build.mjs on each merge conflict (W3), never hand-merged.
3. [Rule 2] Back asks before unsaved changes are lost (red-4, ee5cc61).
4. [Rule 2] Photo ids carry the tenant id (shared file store).
5. Gate base moved to the merged reskin tip (4fa273e, then 0dd6b3f) after rebase-merging 12-05, 12-07, 11-09, 10-12, 08-17, small fixes and 11-10. Measured against da1ce23, audit.js shows 201/13 lines changed by those plans and 16 server tests declared by them. Against the merged tip, my own diff on index.html, audit.js and server/test is empty, and console.js is 4/3.
6. Verify commands contain `$(git ...)`, so they ran from script files (scratchpad exec-12-06/tools/verify-1.sh, -2, -3). Some part runs used .planning/tools/heavy.sh (the same script as exec-011/heavy.sh, with its own lock folder). The gate used the shared queue.
7. Check corrections, not product bugs (t2a: a 'Totals' table instead of 'Distributions', and the offered file name; red-3: the role switch flow).

## Known stubs

None. Asset updates with sample data shows the no-holding line (Failures 4).

## Threat flags

None beyond the plan's register. T-12-25: paste is plain text, and the preview is drawn from strings with NS.brand.esc (part editor-phone pastes markup). T-12-26: photos are redrawn on a canvas, and the check finds no Exif. T-12-27: Delete appears only for configure, and investors cannot open the page (roles-managed). T-12-28: parts and filesout.js load from the page's own address; policy 'self' applies in every part. T-12-29: index.html is untouched and its Reports page is checked.

## Evidence as produced

## RED outputs

### red-1 (Task 1, part open-phone, before reports-ui.js existed; base da1ce23)

```
PASS open-phone the frame refuses fetch() (connect-src none is in force)
PASS open-phone the frame is 390x844 with touch
FAIL open-phone ran to the end :: frame.waitForSelector: Timeout 20000ms exceeded.
  - waiting for locator('[data-action=rep-tab][data-t=investor]') to be visible
REPORTS FLOW: FAIL (parts run: 1) - open-phone
```

### red-2 (Task 2, parts editor-phone, cover-photos-desktop, preview-pdf, split, logo-canvas, on Task 1's code 7753913; finished 17:27:40, before the Task 2 code at 17:28:14)

```
PASS editor-phone the frame refuses fetch() (connect-src none is in force)
PASS editor-phone with Holdings on, the preview has the table 'Holdings'
FAIL editor-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
PASS cover-photos-desktop the frame refuses fetch() (connect-src none is in force)
FAIL cover-photos-desktop ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
PASS preview-pdf the frame refuses fetch() (connect-src none is in force)
FAIL preview-pdf ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
PASS split the frame refuses fetch() (connect-src none is in force)
PASS split 'Payment' starts on the fund's newest paid run
FAIL split ran to the end :: frame.selectOption: Timeout 30000ms exceeded.
PASS logo-canvas the frame refuses fetch() (connect-src none is in force)
PASS logo-canvas with an SVG logo the PDF has an image on page 1 (redrawn on the canvas)
PASS logo-canvas with the generated mark the PDF has no image and the firm's name (Kestrel Bay) in its text
PASS logo-canvas the policy refused nothing (no fetch, no outside script)
PASS logo-canvas no script error in the browser
PASS logo-canvas no request outside the page's origin
REPORTS FLOW: FAIL (parts run: 5) - editor-phone, cover-photos-desktop, preview-pdf, split
```
logo-canvas passed at RED: the logo paths are 12-03's composer (logoFor), and the screens it needs (Create, the preview, Download PDF) came with Task 1. It proves the screens hand the tenant's logo to the composer.

### red-3 (Task 3, parts roles-managed and ways-out, on 9fb85c7 plus the check)

```
PASS roles-managed the frame refuses fetch() (connect-src none is in force)
PASS roles-managed a team member sees the tab Investor reports
PASS roles-managed a team member creates and saves a template (version 2)
PASS roles-managed a team member sees no 'Delete'
FAIL roles-managed ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded.
PASS ways-out the frame refuses fetch() (connect-src none is in force)
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out phone, the list: the page does not scroll sideways (width 390 <= 390)
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out phone, the editor with the letter open: the page does not scroll sideways (width 390 <= 390)
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out phone, the preview: the page does not scroll sideways (width 390 <= 390)
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out phone, the PDF panel: the page does not scroll sideways (width 390 <= 390)
PASS ways-out the policy refused nothing (no fetch, no outside script)
PASS ways-out no script error in the browser
PASS ways-out no request outside the page's origin
PASS ways-out no vendor, model or library name and no forbidden word on screen
PASS ways-out the frame refuses fetch() (connect-src none is in force)
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out a way out of the view is on screen at the top, the middle and the end of the page
PASS ways-out the policy refused nothing (no fetch, no outside script)
PASS ways-out no script error in the browser
PASS ways-out no request outside the page's origin
PASS ways-out no vendor, model or library name and no forbidden word on screen
REPORTS FLOW: FAIL (parts run: 2) - roles-managed
```
ways-out passed at RED: the views it walks were built in Tasks 1 and 2 (the editor bar is sticky, the phone menu row is sticky, and at 1280x800 the frame's fixed role control stays on screen). roles-managed failed on my own check's flow: after switching to admin the check waited for the list without opening the tab again (the role switch draws the role's home page). Fixed in the check (it opens the tab again); no product change.

## Verify lines

### Task 1 verify (the plan's command from a script file; VERIFY-1 EXIT=0)

```
PASS open-phone no vendor, model or library name and no forbidden word on screen
PASS open-phone a way out of the view is on screen at the top, the middle and the end of the page
REPORTS FLOW: PASS (parts run: 1)
VERIFY-1 EXIT=0
```
Measured in the part: KBC-1001's Q4 2026 capital account ends at $320,823.87 in the preview, equal to NS.audit.period.

### Task 2 verify (the plan's command from a script file, on 9fb85c7; VERIFY-2 EXIT=0; 86 PASS lines, 0 FAIL)

```
PASS logo-canvas no script error in the browser
PASS logo-canvas no request outside the page's origin
REPORTS FLOW: PASS (parts run: 6)
VERIFY-2 EXIT=0
```
Before it passed, one run (t2a) failed on two mistakes in my own check, not the screens: 'Move up' was asserted against a 'Distributions' table that this period does not have (no distribution was paid in Q4 2026, so the section shows a line and its 'Totals' table), and the PDF's offered name was read from the saved copy instead of the name the page offered. Both assertions were corrected (now 'Totals', and the exact offered name 'Kestrel_Bay_Quarterly_report_Q4_2026_KBC_1001.pdf').

### Task 3 verify, first run (on 576b0f9, the merged tree with 12-05, 12-07 and 11-09): FAILED in the reference gate, stopped

REPORTS FLOW on the merged tree: `REPORTS FLOW: PASS (parts run: 8)` (123 PASS lines, 0 FAIL, 0 kept).
The full gate then failed one reference step:

```
GATE FAIL HELP PREVIEW (6)
FAIL preview-sponsor the request carries the rules and the sponsor's guide, and not the investor's guide :: {"len":49958}
FAIL preview-sponsor the rules and the sponsor's guide still go with it
FAIL files help-data.js matches the server guide (make-help-data.mjs --verify passes) :: help-data.js: STALE (server guide 21883f5cfd44); run node .planning/tools/preview/make-help-data.mjs
```
Cause: my guide step changed the server guide, and the preview's copy of it (.planning/tools/preview/help-data.js) is built from it by make-help-data.mjs. Fixed by running that tool (ee5cc61). Every other reference step passed (27 ok), the server tests were `GATE ok   server tests 387 = base 387 + 0 declared`, and the ten phase 10 checks that finished passed (DIST FLOW, DIST RECORD, K1 SPLIT, SHIPPED LIBS, TAX 1099, TAX FORMS, TAX MATH, TAXDOCS FLOW, TAXDOCS MATH, TAXRECORD FLOW). I stopped the run during WITHHOLDING FLOW (its 'managed' part shows 'Target page, context or browser has been closed', which is my stop, not a failure), because the gate could no longer pass and its 7,000-second limit would have cut it off.

### red-4 (a gap I found: Back threw away unsaved edits; Rule 2), on c1e7b2e

```
FAIL editor-phone Back with a change not saved stays in the editor and says 'Changes are not saved.' :: {"editor":false,"line":""}
FAIL editor-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
REPORTS FLOW: FAIL (parts run: 1) - editor-phone
```

## Commits (wip/12-06, first-parent from da1ce23)

a31863c test RED open-phone; 3eaddcd save; 7753913 feat tab, loader, list, Create, preview, PDF panel; 728205e, 4689f46 saves; 9fb85c7 save holding the Task 2 editor code (VERIFY-2 ran on it); c03b645 save; 64694ef docs guide step; 60d8b09 test roles-managed and ways-out; 576b0f9 merge (12-05, 12-07, 11-09); c1e7b2e test RED unsaved-changes guard; ee5cc61 fix guard and help-data.js; e1a8abf save; bedc99c merge (10-12, 08-17, small fixes); 9804289 merge (11-10); then this summary's commit.

## Self-Check: PASSED

Files present: assets/js/reports-ui.js, assets/css/reports.css, checks/reports-flow.js. All commits above are on HEAD (git log da1ce23..HEAD). STATE.md and ROADMAP.md untouched.
