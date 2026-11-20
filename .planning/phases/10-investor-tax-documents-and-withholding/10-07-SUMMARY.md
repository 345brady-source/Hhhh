---
phase: 10-investor-tax-documents-and-withholding
plan: 07
subsystem: distribution screen (tax withheld), offering page, investor tax record, History, investor Distributions headline
tags: [withholding, backup-withholding, foreign, distributions, cancel, tax]
status: complete
requires: ["10-01 (buildLines, recordRun, cancelRun, runRows)", "10-04 (NS.taxUI PARTS loader)", "10-05 (NS.withholding)"]
provides:
  - "NS.withholdingUI (assets/js/withholding-ui.js): block, withheld, blocked, reset, reportingField, paperLine"
  - "console.js: the tax withheld block, net column, net ACH entries, withheld lines into the record, Cancel in History"
  - "checks/withholding-flow.js: WITHHOLDING FLOW, 9 parts"
affects: [10-08, 10-10, 10-11, phase 11]
tech-stack:
  added: []
  patterns: ["the screen draws the module's drafts and records decisions; it works out no amount", "one set of lines for table, file and record"]
key-files:
  created:
    - assets/js/withholding-ui.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/withholding-flow.js
  modified:
    - assets/js/console.js
    - assets/js/data.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
decisions:
  - "Sample W-9s get a signature record { signed: true, source: 'sample' } (C-10): after it, per firm, only investors with no tax form draw a line"
  - "A foreign investor's row offers the 30% amount whatever the W-8's state; it shows the W-8 facts (valid until, expired after, not signed)"
  - "Cancel is offered to the role that may configure in both editions (admin; Carrow & Vale staff)"
  - "The investor's headline line 'Tax withheld $X' is drawn by withholding-ui.js (portal.js belongs to 10-06 in this wave)"
metrics:
  completed: 2026-11-20
  tasks: 3
estimate:
  tokens: 104000
  tasks: 3
actuals:
  tokens: 20700     # chars/4 over the added lines since the merged base, help-guide.mjs (generated) left out
  tasks: 3
  commits: 6        # plan commits (5) and 1 merge, first-parent
plan_head_before: 6061fce0b5d43bced41eb84c3c7c6375d1d97f27
plan_head_after: PENDING
---

# Phase 10 Plan 07: tax withheld at the distribution Summary

GATE: PENDING (filled in below when gate10.sh ends)

## RED outputs (kept in SCRATCH/exec-10-07)

- red-1.txt (Task 1, part propose-phone, before any code): 10 FAIL lines, `WITHHOLDING FLOW: FAIL (parts run: 1) - propose-phone` (no block, buttons not waiting, file credits $10,000.00, A-1002 stored with nothing withheld).
- red-2.txt (Task 2's parts on the tracer's code): 24 FAIL lines, `WITHHOLDING FLOW: FAIL (parts run: 7) - type, foreign, stops, netfile, cancel, paper-w9`. Part propose-desktop passed in RED: Remove, the reset on a new total and the second line for A-1001 were already in the tracer's code.
- red-3.txt (part managed on the tree of 888eeac, before Cancel): `FAIL managed History has Cancel for Carrow & Vale staff`; its git line also failed there only because the extracted tree is not a repository.

## Verify lines

- Task 1: `WITHHOLDING FLOW: PASS (parts run: 1)`, `VERIFY1_EXIT=0`
- Task 2 parts plus paper-w9 on the final code: `WITHHOLDING FLOW: PASS (parts run: 8)` (141 PASS lines)
- managed: `WITHHOLDING FLOW: PASS (parts run: 1)`
- help guide: `# pass 9`, `# fail 0`; `node server/help/build.mjs --verify` in sync
- MEASURED paper-w9 (D2): kestrel-bay 2 of 23, ashwell-ridge 2 of 24, greywater 1 of 23, pellbrook 2 of 24 sample investors still draw a backup line with every offering set to notes; all of them have no tax form; 0 with a W-9 and its last four (10-05 measured 86 of 94 before).
