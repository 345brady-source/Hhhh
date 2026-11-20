---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 09
subsystem: fund accounting (sample funds post to the journal)
status: complete
tags: [ledger, sample-funds, fa-03, t3, storage]
requires: ["11-05 (books-post.js desired/sync)", "11-07 (NS.audit.generated, journal-keyed ledger)"]
provides:
  - "sim:<offeringId>:<YYYY-MM> entries in NS.books.desired for generated offerings; desired(...).unbalanced"
  - "checks/samples-books.js: SAMPLES BOOKS (7 cases)"
affects: [11-11, 11-12, 11-13, 11-15]
tech-stack:
  added: []
  patterns:
    - "the sample entry's balance-sheet lines are targets less what sync leaves in the journal (11-CONTEXT W1)"
    - "an entry that does not balance is left out and listed, never plugged"
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/samples-books.js
  modified:
    - assets/js/books-post.js
decisions:
  - "An unbalanced sample entry is also listed in fund.exceptions as { src, kind: 'unbalanced', cents }, so a person sees it, not only desired()"
  - "An unbalanced month's earlier live sample entry is reversed by sync (it is no longer called for), not held"
  - "The capital-call edit runs in Pellbrook's pb-ventures-i: Kestrel Bay fund ii is 100% called in the seed and issueCall refuses there"
metrics:
  duration: "not measured"
  completed: 2026-11-20
estimate:
  tokens: 72000
  tasks: 2
actuals:
  tokens: 6200
  tasks: 2
  commits: 8
plan_head_before: ad2fc5a78d65cc1aa5b362026c33540dd76340b6
plan_head_after: see the commit of this summary (the last save before it is 835dc18)
---

# Phase 11 Plan 09: Sample funds through the same ledger Summary

Every sample fund now has a full journal that agrees with what its Audit page shows. Each month of each of the 15 sample funds carries one sample entry: the generator's income and gain, plus the balance sheet moved to the one the Audit page already shows. At all 743 sample fund-month-ends, journal net assets equal LP capital plus the GP's accrued share. Cash, investments and fees payable match the Audit page, and the trial balance sums to zero. No sample entry needed a balancing line. Entries made by hand in a sample firm are counted. An expense made by hand, which the generated figures cannot hold, is reported and never forced. The owner has not checked this.

## Failures and weak points first

- **No check failed in the end. The phase gate passed: GATE_EXIT=0, every step run fresh, server tests 368, AUDIT SAME ok.**
- **An expense or income entered by hand in a sample fund breaks that fund's sample entries from that month on.** The generated figures do not know about the entry, so those months cannot balance. They are left out and listed (`desired().unbalanced` and `fund.exceptions`, kind `unbalanced`), never forced. One unbalanced month carries into every later month, because each month counts the one before it. The check measured this: a 50,000-cent legal fee in September 2026 gives September off by exactly 50,000 and October off by 37,682,429. Neither is posted. Balance-sheet-only entries made by hand (cash into investments and back) tie fully. This is the plan's rule ("reported, never forced"). A sample firm is a demonstration, so I left it as it is.
- **The capital-call edit could not be done in Kestrel Bay as the plan words it.** Fund ii's five seeded calls are 100% of commitments, and `NS.ops.issueCall` returns null there. The check asserts that fact. The call is issued in Pellbrook's pb-ventures-i (70% called) on 2026-11-19, and one item is received on 2026-11-25. That receipt is recorded with the portal's day at 2026-12-05, so November is a completed, open month. Kestrel Bay fund ii carries the entry made by hand (W1) and a closed-period test.
- **Not every case failed before its code.** `all`, `storage`, `speed` and `selfcheck` passed on their first run (red-2). Task 1's code is generic for every sample fund, the budgets were met without compaction, and speed only measures. `repeat` failed at the base only through its "the books held sample entries" assertion. Its real RED for 11-CONTEXT B1 is red-1b-repeat.txt: sample entries were in, MANAGED did not yet hold `sim`, and each second sync posted 144-269 entries again.
- **The closed-month branch of `sample()` is not separated by a check.** A closed month keeps its live sample entry, and later months count it (W1: earlier sample entries as they stand in the journal). The close-then-edit case passes with or without that branch, because the computed and live entries agree there.
- **The browser's storage limit inside the iPhone preview has not been measured.** I assume it is about 5 MB. The four sample workspaces together measured 758,989 bytes of JSON after posting.
- The sample generator's own figures are what is posted. For example, kb-fund-ii's first month shows a gain of $258,123.41 on $1,593,750.00 called. Those are the demonstration figures the Audit page already showed (FA-03, AUDIT SAME unchanged). This plan did not judge them.

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

### Task 2 verify (SCRATCH/exec-11-09/verify2.sh, the plan's command, with the node_modules link made and removed)
The samples run ended `SAMPLES BOOKS: PASS (cases run: 7)`. The gate's last lines, verbatim (SCRATCH/exec-11-09/gate.txt; no step was carried over from an earlier run; 0 "GATE FAIL" lines):
```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   BANK STEP TYPING (2)
GATE ok   HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   PHONE LAYOUT (8)
GATE ok   RECORD AND LOST AGREEMENT (7)
GATE ok   SCREEN EDGES (5)
GATE ok   WALK3 FIXES (9)
GATE ok   TITLES AND EDITOR (4)
GATE ok   PRESS AND CO-INVESTOR (10)
GATE ok   CO-INVESTOR SERVER (5)
GATE ok   HELP PREVIEW (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
GATE ok   server tests 368 = base 368 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   ENGINE BOOKS
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   WORKBOOK
GATE_EXIT=0
VERIFY2 OK
```
The gate left no base tree (the gate folder is 1.2 MB) and no server/node_modules.

## Measured

| Sample firm | Books (JSON bytes) | Entries (sample entries) | Whole workspace (bytes) |
|---|---|---|---|
| kestrel-bay | 104,067 | 427 (157) | 145,239 |
| ashwell-ridge | 178,645 | 518 (173) | 229,774 |
| greywater | 124,784 | 405 (144) | 167,074 |
| pellbrook | 162,781 | 686 (269) | 216,902 |
| four together | | | 758,989 |

Budgets 300,000 per firm and 2,500,000 together: met, with no compaction (the compaction rule was not needed and is not built).
Sync time on pellbrook (269 fund-months, the most), node on this machine: first sync 119.2, 135.3, 205.1 and 170.2 ms in four runs (686 entries posted); second sync 64.5, 83.3, 93.6 and 89.5 ms (0 posted). The phone's time is not measured.

**First sample entry of kb-fund-ii, by hand:** sim:kb-fund-ii:2019-09, dated 2019-09-30, memo "Sample fund: Sep 2019".
6100 credit 25,812,341 (the generator's gain) · 1000 credit 153,819,380 · 1100 debit 125,975,727 · 1150 debit 53,655,994.
Sum: -25,812,341 - 153,819,380 + 125,975,727 + 53,655,994 = 0. There is no 4090 line (income 0 that month) and no 2100 line (the fee entry already left 2100 at -1,062,500, the Audit page's fee payable). The call entry put 159,375,000 into 1000. After this entry, 1000 = 5,555,620 = H.cash and 1100 + 1150 = 179,631,721 = H.longFV, which are the engine figures red-1.txt printed for that month.

## Interfaces as built

- `NS.books.desired(ws, o, {today})` also returns sim entries for `NS.audit.generated(o)`, sorted by date then src with all the others. The returned array has `unbalanced` (`[{src, sum}]`, always present, empty for real funds).
- sim lines: [4090 -income][6100 -gain] then 1000, 1100, 1150, 2300, 2100, 2200, 2500, 2600, each target less the projected balance. Zero lines are left out.
- Projected balance (W1): every live journal entry this module does not own (man:, mark:, bank:, open:, ...); for each record it posts, the entry sync will leave live (the desired one, or the live one when held or in a closed period); and the sample entries of earlier months (the live one for a closed month).
- `MANAGED` = `/^(call|pos|run|req|reqpaid|fee|gp|sim):/` (B1), so sync reverses and re-posts a changed sample entry and never posts one twice.
- Real funds: unchanged. No sim entry is made (POSTING fund-a compares desired with the fixture exactly; ENGINE BOOKS ok).

## Deviations from Plan

1. **[RED order] Case `repeat` was written with Task 1's check** (257e190). B1 puts the MANAGED change in Task 1 step 2 and names `repeat` as its RED. Its RED was taken between writing the sample entries and changing MANAGED (red-1b-repeat.txt), and both went in one code commit (c331c1d).
2. **[Plan wording] The capital-call edit runs in Pellbrook's pb-ventures-i**, because Kestrel Bay fund ii has no open call and no commitment left (asserted in the case). Kestrel Bay fund ii carries the man: entry, a close through 2026-06-30 with a later entry made by hand, and the expense-made-by-hand report.
3. **[Rule 2] An unbalanced sample entry is also listed in fund.exceptions** (`{src, kind: 'unbalanced', cents, found}`), so it is visible in the books, not only in desired's return.
4. **[Check correction] The edit case's re-post count was wrong arithmetic** (5 months expected, 1 is right). It now asserts exactly 1 re-posted entry and the exact line change.
5. **The case `edit` also includes a closed period and an expense made by hand.** Neither is in the plan's behaviour list. Both test the "never forced" rule (T-11-27) and W1.

## Known Stubs

None.

## Threat Flags

None. T-11-26: sim entries only when `generated(o)`. T-11-27: unbalanced entries are left out and listed (case edit). T-11-28: storage measured (case storage).

## Files a preview build must add

None new at run time. assets/js/books-post.js is changed and already loaded by index.html, diy.html and portal.html. The check file is not shipped.

## Commits

- 257e190 test(11-09): kb-fund-ii ties to its capital accounts every month; a second sync of the sample firms changes nothing (RED)
- c331c1d feat(11-09): sample funds carry one balancing sample entry per month (FA-03)
- 26a843c wip(11-09): save
- b33fb06 test(11-09): all 15 sample funds, storage, speed, edits in sample firms, selfcheck (RED: entries made by hand)
- 2820743 wip(11-09): save
- 1d4a545 feat(11-09): a sample entry counts every live entry of the fund, entries made by hand included (11-CONTEXT W1)
- 835dc18 wip(11-09): save
- plus the commit of this summary

Pushed only to wip/11-09. STATE.md, ROADMAP.md and REQUIREMENTS.md not touched; no 11-10 or 11-11 file edited.

## Self-Check: PASSED

- FOUND: assets/js/books-post.js, checks/samples-books.js
- FOUND (in `git log ad2fc5a..HEAD`): 257e190, c331c1d, 26a843c, b33fb06, 2820743, 1d4a545, 835dc18
