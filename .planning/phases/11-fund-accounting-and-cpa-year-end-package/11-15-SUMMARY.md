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

### RED-2 (Task 2's six parts against the Task 1 code, HEAD b88325f), O/red-2.txt
54 checks passed, 18 failed; file-kept passed already (the file store came with Task 1, see Deviations). The four
`refused` failures were partly the check's own fault: it read errors from `.bb-err` while the section draws them as
`.bk-err` (fixed in the check after this run; the refusals themselves were drawn).
```
FAIL csv-desktop fund-a-signed.csv shows the layout form and stores nothing yet :: {"layout":false,"errs":[]}
FAIL csv-desktop the first five lines are shown with money in and money out :: []
FAIL twice-phone before the opening balance: "To be confirmed: opening balance at Jan 15, 2026", never $0.00, and nothing can be stored :: {... "openField": false ...}
FAIL twice-phone the opening balance is stored at 2026-01-15 with who entered it and when :: null
FAIL refused a PDF shows one line saying the file cannot be read :: []
FAIL split-desktop ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL undo-roles the matched line offers "Move match" to the new entry :: [... "move":0 ...]
FAIL undo-roles after Move match the line names the new entry, dated 2026-12-14 and not reversed :: {"match":{"entry":"je-000016","line":2},"date":"2026-12-15","src":"run:fa-run-1","reversed":true}
FAIL undo-roles a team member can upload (the layout form, as the account has no kept layout) :: []
BANK FLOW: FAIL (parts run: 6) - csv-desktop, twice-phone, refused, split-desktop, undo-roles
