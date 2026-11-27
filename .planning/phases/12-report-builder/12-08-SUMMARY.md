# Phase 12 Plan 08: generate, deliver and the archive (in progress)

Start commit: 092d041a9700a8409c872ba8f0c133f0386d8427 (fresh worktree; HEAD contains 092d041, no reset needed).

## Evidence as produced

### RED 1 (Task 1, before reports-ui.js loads the starters, the batch engine and reports-deliver.js; SCRATCH/exec-12-08/red-1.txt; exit 1)

```
PASS deliver-phone the frame refuses fetch() (connect-src none is in force)
PASS deliver-phone the frame is 390x844 with touch
FAIL deliver-phone ran to the end :: frame.selectOption: Timeout 30000ms exceeded.
PASS investor-phone the frame refuses fetch() (connect-src none is in force)
FAIL investor-phone ran to the end :: frame.waitForFunction: Timeout 20000ms exceeded.
DELIVER FLOW: FAIL (parts run: 2) - deliver-phone, investor-phone
```
deliver-phone: 'Start from' does not offer 'Quarterly letter: venture or private equity' (the starters file is not loaded);
investor-phone: the batch engine (NS.reportsRun) is not loaded, so no report can be made.
