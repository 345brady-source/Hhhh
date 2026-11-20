---
phase: 12-report-builder
plan: 06
status: in-progress
---

# Phase 12 Plan 06: the builder screens (evidence saved as produced)

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
