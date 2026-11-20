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

## Verify lines

### Task 1 verify (the plan's command from a script file; VERIFY-1 EXIT=0)

```
PASS open-phone no vendor, model or library name and no forbidden word on screen
PASS open-phone a way out of the view is on screen at the top, the middle and the end of the page
REPORTS FLOW: PASS (parts run: 1)
VERIFY-1 EXIT=0
```
Measured in the part: KBC-1001's Q4 2026 capital account ends at $320,823.87 in the preview, equal to NS.audit.period.
