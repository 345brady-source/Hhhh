---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 09
status: in-progress
---

# Phase 11 Plan 09: Sample funds through the same ledger (DRAFT, saved as produced)

## Evidence as produced

### Task 1 RED (SCRATCH/exec-11-09/red-1.txt, base ad2fc5a, check commit 257e190)
```
FAIL kestrel kb-fund-ii ties at all 86 month-ends (2019-09 to 2026-10): T3, 1000, 1100 + 1150, 2100, the trial balance :: 173 problems; first: kb-fund-ii: desired has no unbalanced list | kb-fund-ii 2019-09: 0 sim entries | kb-fund-ii 2019-09: journal {"na":158312500,"cash":159375000,"inv":0,"fee":-1062500,"tb":0} engine {"na":184124841,"cash":5555620,"inv":179631721,"fee":-1062500,"tb":0} | kb-fund-ii 2019-10: 0 sim entries
FAIL repeat the books held sample entries when synced again :: {"sims":0}
SAMPLES BOOKS: FAIL (cases run: 2) - kestrel, repeat
```

### B1 RED (SCRATCH/exec-11-09/red-1b-repeat.txt: sim entries written, MANAGED not yet holding sim)
```
FAIL repeat kestrel-bay: a second sync posts and reverses nothing; the books are identical :: {"posted":157,"reversed":0,"exceptions":0}
FAIL repeat ashwell-ridge: a second sync posts and reverses nothing; the books are identical :: {"posted":173,"reversed":0,"exceptions":0}
FAIL repeat greywater: a second sync posts and reverses nothing; the books are identical :: {"posted":144,"reversed":0,"exceptions":0}
FAIL repeat pellbrook: a second sync posts and reverses nothing; the books are identical :: {"posted":269,"reversed":0,"exceptions":0}
SAMPLES BOOKS: FAIL (cases run: 2) - repeat
```

### Task 1 verify (code commit c331c1d)
```
PASS kestrel the first sync posted entries
PASS kestrel kb-fund-ii ties at all 86 month-ends (2019-09 to 2026-10): T3, 1000, 1100 + 1150, 2100, the trial balance
SAMPLES BOOKS: PASS (cases run: 1)
VERIFY1 OK
```
First sample entry of kb-fund-ii (from the check's output):
```
  first sample entry of kb-fund-ii: sim:kb-fund-ii:2019-09, dated 2019-09-30, memo "Sample fund: Sep 2019"
    6100 credit 25,812,341
    1000 credit 153,819,380
    1100 debit  125,975,727
    1150 debit  53,655,994
    sum 0
```
POSTING after Task 1: `POSTING: PASS (cases run: 13)`.

### Task 2 RED (SCRATCH/exec-11-09/red-2.txt, check commit b33fb06, before the W1 code)
```
FAIL edit kb-fund-ii, an entry made by hand in June 2026: sync reversed and posted the sample entries from June on (5) :: {"posted":0,"reversed":0,"exceptions":0}
FAIL edit kb-fund-ii ties at every month-end after the entry made by hand (T3, 1000, 1100 + 1150, 2100, the trial balance) :: 5 problems; first: kb-fund-ii 2026-06: journal {"na":955480775,"cash":27461731,"inv":929081544,"fee":-1062500,"tb":0} engine {"na":955480775,"cash":28696298,"inv":927846977,"fee":-1062500,"tb":0} | ...
FAIL edit an expense entered by hand: September and October 2026 are reported (September off by the 50,000) and not posted; no line is added :: {"u":[],"live":2,"ex":[]}
SAMPLES BOOKS: FAIL (cases run: 7) - edit
```
In the same run all, storage, speed, repeat and selfcheck passed (Task 1's code already gives them; see deviations).
The first assertion's expected count (5 re-posted months) was wrong arithmetic in the check: a balance-sheet entry
made by hand in June changes June's sample entry only (later months count June's new entry). After the code the run
showed `{"posted":1,"reversed":1}`; the assertion now requires exactly that, and also that June's new entry holds
1000 +1,234,567 and 1100 -1,234,567 against the old one.

### After the W1 code (code commit 1d4a545), full check
```
  fund-months tied: 743
  kestrel-bay: books 104,067 bytes, 427 entries (157 sample entries), workspace 145,239 bytes
  ashwell-ridge: books 178,645 bytes, 518 entries (173 sample entries), workspace 229,774 bytes
  greywater: books 124,784 bytes, 405 entries (144 sample entries), workspace 167,074 bytes
  pellbrook: books 162,781 bytes, 686 entries (269 sample entries), workspace 216,902 bytes
  four sample workspaces together: 758,989 bytes
  pellbrook (269 fund-months, the most): first sync 170.2 ms (686 entries posted), second sync 89.5 ms (0 posted)
  hand-entered expense: unbalanced [{"src":"sim:kb-fund-ii:2026-09","sum":50000},{"src":"sim:kb-fund-ii:2026-10","sum":37682429}]; listed [["sim:kb-fund-ii:2026-09",50000],["sim:kb-fund-ii:2026-10",37682429]]
SAMPLES BOOKS: PASS (cases run: 7)
```
Other checks on this tree: `POSTING: PASS (cases run: 13)`, `BANK REC: PASS (cases run: 10)`, `BOOKS CORE: PASS (cases run: 8)`.

<!-- gsd:write-continue -->
