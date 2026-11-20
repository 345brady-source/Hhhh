# Phase 12 Plan 04: Delivery record and the phase gate Summary (in progress)

Evidence is pasted here as it is produced (SAVE-RULES rule 5).

## RED 1 (Task 1, before assets/js/reports-record.js existed)

`node .planning/phases/12-report-builder/checks/reports-record.js --case deliver` (SCRATCH/exec-12-04/red-1.txt):

```
FAIL deliver ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a842fff1345674961/assets/js/reports-record.js'
    at Object.readFileSync (node:fs:440:20)
    ...
REPORTS RECORD: FAIL (cases run: 1) - deliver
```

## Task 1 verify (after assets/js/reports-record.js)

```
PASS deliver the change log verifies
PASS deliver the run's delivered block names the person and the docs
PASS deliver no vendor name and never the forbidden word in the log
REPORTS RECORD: PASS (cases run: 1)
```
(20 PASS lines, 0 FAIL; SCRATCH/exec-12-04/deliver.txt)

## RED 2 (Task 2, the nine further cases written before the code; SCRATCH/exec-12-04/red-2.txt)

```
FAIL paper ran to the end :: TypeError: R.paperList is not a function
FAIL opens ran to the end :: TypeError: R.opened is not a function
FAIL withdraw ran to the end :: TypeError: R.opened is not a function
FAIL letter ran to the end :: TypeError: R.opened is not a function
FAIL notice a run not delivered is refused :: R.noticeDraft is not a function
FAIL notice ran to the end :: TypeError: R.noticeDraft is not a function
FAIL archive ran to the end :: TypeError: R.verifyFile is not a function
REPORTS RECORD: FAIL (cases run: 10) - paper, opens, withdraw, letter, notice, archive
```
Plainly: cases refuse, replace and selfcheck already passed at this RED. Task 1's deliver was written to the full
interfaces block (its refusals and `replaces`), so those cases exercise code that existed; selfcheck tests the runner.

## Task 2 verify (SCRATCH/exec-12-04/record.txt: 99 PASS lines, 0 FAIL, no part kept from an earlier run)

```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS RECORD: PASS (cases run: 10)
```

## RED 3 (Task 3: gate12.sh with the full self-test of 8 but no phase 11 step and no --only-phase12 mode yet; SCRATCH/exec-12-04/red-3.txt)

```
SELF-TEST FAIL control: the stand-ins pass when nothing is wrong
SELF-TEST ok   a phase 12 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
SELF-TEST FAIL a phase 11 check whose last line differs from its marker
SELF-TEST FAIL a phase-12-only run
GATE12 SELF-TEST: FAIL - control (control) p11 only
```
The control failed because no "GATE ok   ELEVEN STAND IN" line was printed (no phase 11 step); the only-run printed
the reference step and the server test line and ended "GATE_EXIT=0 (stand-in)".

## Task 3 verify (the plan's command, verbatim; VERIFY rc=0)

```
SELF-TEST ok   a phase-12-only run ends 'GATE_EXIT=0 (phase 12 checks only)' with no reference step and no server test line, and 'GATE_EXIT=1' when a phase 12 check fails
GATE12 SELF-TEST: PASS (8)
GATE ok   REPORTS RECORD
GATE_EXIT=0 (phase 12 checks only)
```
SCRATCH/exec-12-04/gate/base-tree is gone after the run. A rerun into the same folder keeps the step:
```
GATE ok   REPORTS RECORD (kept from 2026-11-20 16:29:53 UTC)
GATE_EXIT=0 (phase 12 checks only)
```
