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

### RED 2 (Task 2's five parts, on the same tree as RED 1: reports-ui.js not yet loading the new parts; SCRATCH/exec-12-08/red-2.txt; exit 1; PASS lines omitted)

```
FAIL notice ran to the end :: frame.selectOption: Timeout 30000ms exceeded.
FAIL withdraw-replace ran to the end :: frame.waitForFunction: Timeout 20000ms exceeded.
FAIL archive-desktop ran to the end :: frame.waitForFunction: Timeout 20000ms exceeded.
FAIL starters-phone statement: 'Start from' lists at least two starters and 'Blank' (0) :: ["Blank"]
FAIL starters-phone distribution: 'Start from' lists at least two starters and 'Blank' (0) :: ["Blank"]
FAIL starters-phone quarterly: 'Start from' lists at least two starters and 'Blank' (0) :: ["Blank"]
FAIL starters-phone annual: 'Start from' lists at least two starters and 'Blank' (0) :: ["Blank"]
FAIL starters-phone performance: 'Start from' lists at least two starters and 'Blank' (0) :: ["Blank"]
FAIL starters-phone tax: 'Start from' lists at least two starters and 'Blank' (0) :: ["Blank"]
FAIL starters-phone ran to the end :: frame.selectOption: Timeout 30000ms exceeded.
FAIL speed-phone ran to the end :: frame.selectOption: Timeout 30000ms exceeded.
DELIVER FLOW: FAIL (parts run: 5) - notice, withdraw-replace, archive-desktop, starters-phone, speed-phone
```

### RED 3 (Task 3's part managed-taxdocs, same tree; SCRATCH/exec-12-08/red-3.txt; exit 1)

```
PASS managed-taxdocs the frame refuses fetch() (connect-src none is in force)
FAIL managed-taxdocs ran to the end :: frame.waitForFunction: Timeout 20000ms exceeded.
DELIVER FLOW: FAIL (parts run: 1) - managed-taxdocs
```
(no report can be made without the batch engine, so no report open can be counted beside the tax document's)
