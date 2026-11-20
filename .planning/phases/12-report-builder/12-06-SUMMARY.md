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

## Verify lines

### Task 1 verify (the plan's command from a script file; VERIFY-1 EXIT=0)

```
PASS open-phone no vendor, model or library name and no forbidden word on screen
PASS open-phone a way out of the view is on screen at the top, the middle and the end of the page
REPORTS FLOW: PASS (parts run: 1)
VERIFY-1 EXIT=0
```
Measured in the part: KBC-1001's Q4 2026 capital account ends at $320,823.87 in the preview, equal to NS.audit.period.
