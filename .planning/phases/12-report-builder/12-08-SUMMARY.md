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

### The part can catch a double count (fault put in a scratch copy of the tree only; SCRATCH/exec-12-08/fault-3.txt; exit 1)

The report hook in a copy of reports-deliver.js was made to also count a tax document's open (a second hook counting
it, T-12-38). managed-taxdocs failed on exactly that, and the copy was put back:
```
FAIL managed-taxdocs opening the tax document counts in its tax.opens (taxdocs-investor.js's hook) and adds no report open :: {"tax":2,"taxReport":false,"rep":0,"reports":0,"taxLog":2,"repLog":0}
FAIL managed-taxdocs a report opened in the same session counts in its report block only :: {"tax":2,"taxReport":false,"rep":1,"reports":1,"taxLog":2,"repLog":1}
DELIVER FLOW: FAIL (parts run: 1) - managed-taxdocs
```

### Task 1 verify (the plan's command, from SCRATCH/exec-12-08/tools/verify-12.sh; VERIFY-1 EXIT=0)
```
PASS investor-phone no vendor, model or library name and no forbidden word on screen
PASS investor-phone a way out of the view is on screen at the top, the middle and the end of the page
DELIVER FLOW: PASS (parts run: 2)
```

### Task 2 verify (the plan's command, same script; VERIFY-2 EXIT=0; 115 PASS lines, 0 FAIL)
First run failed (VERIFY-2 EXIT=1): `FAIL speed-phone ran to the end :: locator.tap: Timeout 10000ms exceeded.` The page was
drawn again after every file, so 'Stop' was replaced before a tap could land. Fixed in c44e546 (only the progress line
changes in place while files are made). Rerun:
```
speed: 23 reports, 1962 ms, 85 ms per report
PASS speed-phone 'Stop' after the second file ends 'Stopped after k of 23' with 2 <= k < 23
PASS speed-phone the stopped run is in the archive with k files (7), stopped
PASS speed-phone a way out of the view is on screen at the top, the middle and the end of the page
DELIVER FLOW: PASS (parts run: 7)
```
