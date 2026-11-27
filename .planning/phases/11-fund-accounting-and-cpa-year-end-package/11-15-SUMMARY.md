---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 15
status: in progress
---

# Phase 11 Plan 15: the Bank section of the Accounting page (in progress)

Evidence as produced (O = SCRATCH/exec-11-15; base-commit.txt = c8f922fcba6be6e6d38809843e01e5a36fafa891).

### RED-1 (import-phone before books-bank-ui.js existed), O/red-1.txt
```
PASS import-phone the frame refuses fetch() (connect-src none is in force)
PASS import-phone fund A seated with only its value entries posted (2, nothing synced)
FAIL import-phone ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded.
  (waiting for locator('[data-bk="part-bank"]') to be visible)
BANK FLOW: FAIL (parts run: 1) - import-phone
```

### Task 1 verify (tracer), O/tracer.txt, HEAD after 7b4b08e plus the layout tweak
42 checks passed, none failed.
```
PASS import-phone phone: every file the parts list names ships
PASS import-phone phone: no request failed or was answered with an error
BANK FLOW: PASS (parts run: 1)
```
