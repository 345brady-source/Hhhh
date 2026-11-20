---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 08
subsystem: fund accounting (bank reconciliation)
status: complete
tags: [ledger, bank, reconciliation, statement-import, matching]
requires: ["11-01 (books.js)", "11-02 (bankfiles.js)", "11-04 (load11.js)", "11-05 (books-post.js: desired, sync)"]
provides:
  - "NS.books.bank in assets/js/books-bank.js: addAccount, setMap, importLines, undecided, candidates, match, unmatch, autoMatch, categorize, uncategorize, reconcile, markReconciled"
  - "checks/bank-rec.js: BANK REC (10 cases, 76 checks)"
  - "checks/fixtures/bank/fund-a-2027-01.csv"
affects: [11-15, 11-17]
tech-stack:
  added: []
  patterns:
    - "a decision is one journal entry src bank:<lineId> through NS.books.post; undoing it is NS.books.reverse"
    - "a match posts nothing; two or more candidates are never matched automatically"
    - "the unrealized share given up on a sale is worked in BigInt, half-up, sign put back"
key-files:
  created:
    - assets/js/books-bank.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/bank-rec.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/bank/fund-a-2027-01.csv
  modified: []
decisions:
  - "Stored line ids are '<account id>:<reader id>' so one statement imported into two accounts never collides; src is bank:ba-1:f:260120003"
  - "Overlap is counted one-for-one: each stored line is the overlap of at most one new line (two equal debits on one day in a new file against one stored give one overlap, one added)"
  - "Candidates count back three business days in books-bank.js: NS.ops.businessDays returns the same day for a negative count"
  - "unmatch added (not in the plan's list): a wrong match had no way back"
  - "An entry and its reversal, neither in the bank, are left out of the outstanding list together"
metrics:
  duration: "not measured"
  completed: 2026-11-20
estimate:
  tokens: 85000
  tasks: 2
actuals:
  tokens: 14418
  tasks: 2
  commits: 5
plan_head_before: a2f61064cada89902b68aa042ee88d7c85a58f62
plan_head_after: 9017266d562969964c190407eff344b548094bcd
---

# Phase 11 Plan 08: Bank reconciliation in the books Summary

Statement lines are now stored per bank account once, matched to cash lines already posted, decided once by account (which posts the expense, income, purchase, sale or split), and reconciled to a statement date. Fund A's 2026 statement imported, matched and decided gives the research's trial balance to the cent, and the reconciliation at 31 December 2026 comes out at $35,000.00 statement, $32,000.00 books, one outstanding check of $3,000.00, difference $0.00. No page loads books-bank.js yet (plan 11-15). The owner has not checked this.

## Failures and weak points first

- **The phase gate (gate11.sh) and the full browser gate were not run.** This was the orchestrator's pacing rule for a plan that adds files no page loads. In their place: BANK REC, the server tests and every phase 11 `// gate: node` check, run once each (below).
- **Not every case failed first.** In red-2.txt, cases `fund-a` (already passing since Task 1; its RED is red-1.txt) and `selfcheck` (it tests the harness) passed before the Task 2 code.
- **14 checks were written after the code** (commit 9017266): a lone line with two candidates, the wire-reference ranking path, the second account on 1001, setMap, last four only, a statement for another account, an unknown investment, a purchase on money in, a reconciliation stored without a name, and the floating-point sale. **Four of the first checks were weak**, and a mutation run showed it. The different-amount refusal and the unnamed-reconciliation refusal were each hit by another refusal first. The split-sum refusal was backed up by the journal core's balance check. The W3 numbers (1100 = 3e12, 1150 = 1e12 + 1, cost 1e12) give the same u in floating point as in BigInt. All four were fixed. The W3 line is kept, and a second line was added (1150 = 1e12 + 23, 1100 = 2e12, cost 1e12) where BigInt gives 500,000,000,012 and floating point gives 500,000,000,011. With those fixes, 28 mutations each fail their case (table below).
- **A defect found in shared code, not fixed here:** `NS.ops.businessDays(s, n)` (operations.js lines 28-36) returns `s` itself for a negative n, because its loop only runs while `k < n`. books-bank.js counts back on its own. The same call is in `seedCalls` (operations.js line 540, `businessDays(c[0], -10)`), so sample funds' seeded calls carry a notice date equal to their due date. Fixing it changes sample data AUDIT SAME compares, so it needs its own fix. It is not logged in deferred-items.md, so as not to collide with 11-07's edits there.
- **A known limit of the reconciliation formula as planned:** every unmatched cash line since the books began counts as outstanding. A fund whose first imported statement starts after its books do can never reach a zero difference until an opening balance is handled. Plan 11-15's screen needs either an opening-balance line or a rule to import from the first statement.
- **When sync re-posts a matched record**, for example a distribution changed in an open period, the match stays on the reversed entry. The reconciliation still nets to the right difference: the old line is matched, and the reversal and the new line cancel out. The screen should offer to move the match, and nothing does that yet.
- **No bank's own statement file has been tried.** Only the made-up fixtures have been read. The owner's masked export is plan 11-17.

## Verify lines (verbatim)

Task 1 (the plan's command):
```
PASS fund-a markReconciled stores the reconciliation with the outstanding check
PASS fund-a nothing was written to the change log
BANK REC: PASS (cases run: 1)
verify1_exit=0
```
Task 2: the plan's command up to the gate (the gate11.sh half was replaced, as above):
```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
BANK REC: PASS (cases run: 10)
verify2a_exit=0
```
The merge gates (`SCRATCH/exec-11-08/gates.sh`: base a2f6106 extracted for AUDIT SAME, server/node_modules linked for the run and removed):
```
server tests exit=0
# tests 358
# pass 358
# fail 0
ok   audit-same: AUDIT SAME: PASS (cases run: 4)
ok   bank-files: BANK FILES: PASS (cases run: 12)
ok   bank-rec: BANK REC: PASS (cases run: 10)
ok   books-core: BOOKS CORE: PASS (cases run: 8)
ok   posting: POSTING: PASS (cases run: 13)
ok   workbook: WORKBOOK: PASS (cases run: 7)
server/node_modules: not left
GATES_EXIT=0
```

## RED evidence (SCRATCH/exec-11-08)

- red-1.txt: `FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/books-bank.js'`, then `BANK REC: FAIL (cases run: 1) - fund-a`.
- red-2.txt (Task 2's cases against commit 1f4b3d1): twice (`fund-a.ofx a second time ... :: {"added":9,"skipped":0,"overlap":0}`), candidates (`each bank line has the same two candidates`: one candidate, then none), check-clears (`the check line's candidates are exactly FA-1002's check line ... :: []`), sale, full-sale and split (`Choose how the line is decided ...`), uncategorize (`B.uncategorize is not a function`), and refusals (`matching a journal line already matched is refused :: {"threw":false ...}` and five more). Last line: `BANK REC: FAIL (cases run: 10) - twice, candidates, check-clears, sale, full-sale, split, uncategorize, refusals`.
- mutations.txt (each applied to books-bank.js alone, the named case run, the file restored):
```
a stored id is not skipped -> BANK REC: FAIL (cases run: 1) - twice
overlap ignored -> BANK REC: FAIL (cases run: 1) - twice
autoMatch takes the first of several -> BANK REC: FAIL (cases run: 1) - candidates
no ranking -> BANK REC: FAIL (cases run: 1) - candidates
wire reference path removed -> BANK REC: FAIL (cases run: 1) - candidates
no days before the line -> BANK REC: FAIL (cases run: 1) - candidates
W2 partner fallback removed -> BANK REC: FAIL (cases run: 1) - candidates
no 180-day check window -> BANK REC: FAIL (cases run: 1) - check-clears
u in floating point -> BANK REC: FAIL (cases run: 1) - refusals
u truncated, not half-up -> BANK REC: FAIL (cases run: 1) - refusals
zero lines kept -> BANK REC: FAIL (cases run: 1) - full-sale
split sum not checked here -> BANK REC: FAIL (cases run: 1) - split
cash code accepted -> BANK REC: FAIL (cases run: 1) - refusals
reconciliation stored off by any amount -> BANK REC: FAIL (cases run: 1) - refusals
reconciliation stored without a name -> BANK REC: FAIL (cases run: 1) - refusals
reversed pair listed as outstanding -> BANK REC: FAIL (cases run: 1) - uncategorize
matches after asOf count -> BANK REC: FAIL (cases run: 1) - check-clears
undo leaves the entry on the line -> BANK REC: FAIL (cases run: 1) - uncategorize
a matched journal line can be matched again -> BANK REC: FAIL (cases run: 1) - refusals
a different amount can be matched -> BANK REC: FAIL (cases run: 1) - refusals
another account's statement accepted -> BANK REC: FAIL (cases run: 1) - refusals
a full account number kept -> BANK REC: FAIL (cases run: 1) - refusals
an unknown investment accepted -> BANK REC: FAIL (cases run: 1) - refusals
a purchase on money in -> BANK REC: FAIL (cases run: 1) - refusals
a decided line decided again -> BANK REC: FAIL (cases run: 1) - refusals
cost above the holding accepted -> BANK REC: FAIL (cases run: 1) - refusals
setMap does not keep the map -> BANK REC: FAIL (cases run: 1) - refusals
second account not added to the chart -> BANK REC: FAIL (cases run: 1) - refusals
```
On the first mutation run, four of these passed (the weak checks above). They fail now.

## Hand-worked figures the check holds to the cent

- Fund A (B1: the fixture's two mark: entries posted directly, then sync; the fixture's bank: entries are never posted): fund-a.ofx into ba-1 (code 1000) gives 9 added. autoMatch gives 3: the two calls go to their [1000 +] lines, whose investor is on the 3000 line (W2), and the ACH file goes to the run's [1000 -600,000]. Six decisions follow: purchase of fa-x, 5100, 2100 three times and 4010. Each posts exactly the fixture's bank:fa-1 to fa-6 date and lines under src bank:<lineId>. The trial balance at 2026-12-31 equals expect.tb (ten accounts).
- reconcile(2026-12-31, 3,500,000) gives book 3,200,000, outstanding [run entry, line 3, 2026-12-15, -300,000], nothing undecided, difference 0. markReconciled stores { account ba-1, asOf, 3,500,000, 3,200,000, [[run id, 3, -300,000]], at, by }.
- January (fund-a-2027-01.csv): the check's only candidate is FA-1002's check line (20 days, inside 180). The half sale gives [1000 +24,000,000][1100 -20,000,000 fa-x][6000 -4,000,000 fa-x][6100 +4,500,000 fa-x][1150 -4,500,000 fa-x]. reconcile(2027-01-31, 27,200,000) gives book 27,200,000, nothing outstanding, difference 0. At 2026-12-31 the check is still outstanding.
- Full sale at 50,000,000: [1000 +50,000,000][1100 -40,000,000][6000 -10,000,000][6100 +9,000,000][1150 -9,000,000], and fa-x's 1100 and 1150 end at 0. A sale at cost leaves out the 6000 line.
- Split: [5200 +600,000 fa-x][2500 +400,000 fa-x][1000 -1,000,000]. Parts of 999,999 are refused with "The parts add up to $9,999.99, not the line's $10,000.00."
- Twice: ofx again gives 0 added / 9 skipped, and qfx the same. The signed CSV gives 0 added / overlap 9 / no import record. With allowOverlap it gives { added 9, skipped 0, overlap 9 } and a second import record. The CSV again gives 9 skipped.
- Candidates: FA-1002 paid 100,000.00 on 2027-01-11 and FA-1001 the same on 01-12. The line "WIRE IN FA-1002 ..." dated 01-12 ranks FA-1002's call first (rank 0), ahead of FA-1001's, which is dated the same day as the line. "FA1002" and the reordered reference words "1002 FA / FUND A CALL 2" rank it first too. autoMatch gives 0.

## Interfaces as built, where they differ from the plan's block

- Line id is `'<account id>:' + reader id`; categorize's src is `bank:<that id>`.
- importLines also refuses a statement whose last four differ from the account's. A file of several accounts keeps only this account's lines and needs the account's last four. Each line needs an id, a real date and safe-integer cents. With allowOverlap, `overlap` still reports how many of the added lines overlapped.
- candidates also leaves out bank-decided entries, reversed entries and reversals. Ties after rank and days apart are broken by date, then entry id and line.
- match also refuses a journal line that is not on the account's cash code, or an entry that is reversed, a reversal, or posted from a statement line.
- categorize also refuses: a line already posted under its src; an unknown investment or investor; a purchase on money in or a sale on money out; a $0.00 line; a split part that is not whole cents above zero. The memo is the bank line's text.
- uncategorize returns the reversal entry. **unmatch(ws, offeringId, lineId)** was added.
- reconcile refuses a date that is not real or a balance that is not whole cents. An entry and its reversal (both dated by asOf), neither in the bank, are left out of the outstanding list together.
- markReconciled also needs `by`.

## Deviations from Plan

1. **[Orchestrator] gate11.sh was not run.** In its place: BANK REC, the server tests (358) and all six phase 11 node checks, as the orchestrator directed.
2. **[Rule 1 - Bug] A local count-back for the 3-business-day window.** NS.ops.businessDays returns the same day for a negative count. operations.js is shared and was not edited. Commit c67b74f.
3. **[Rule 2 - Correctness] Reversed pairs are left out of the outstanding list,** so an undone decision does not show two phantom items (case uncategorize).
4. **[Rule 2 - Correctness] unmatch was added,** so a wrong match can be undone (case check-clears).
5. **[Rule 2 - Correctness] Refusals beyond the plan's list** (another account's statement, a full account number, an unknown investment, a purchase on money in, a reconciliation stored without a name). Each one is checked and mutation-proven.
6. **[Rule 1] A second BigInt line beside W3's,** because W3's numbers do not tell floating point from BigInt.

## Known Stubs

None.

## Threat Flags

None. T-11-22 (case candidates: autoMatch 0, ranking by investor id), T-11-23 (case twice), T-11-24 (case refusals: 1 cent off refused) and T-11-25 (addAccount refuses anything but four digits; lines keep the bank's text only) are mitigated as the register states. No package was installed. Fixtures hold no real names, account numbers or taxpayer numbers.

## Files a preview build must add

None for this plan: no page loads books-bank.js. When plan 11-15's screen loads it, assets/js/books-bank.js must ship after books.js, books-post.js and bankfiles.js.

## Commits

- 8ae0642 test(11-08): fund A's 2026 statement imported, matched, decided and reconciled to zero (RED)
- 1f4b3d1 feat(11-08): store statement lines per bank account, match them to posted cash, decide the rest, reconcile
- 8c6ac1d test(11-08): never twice, ambiguous matches, a check that clears later, sales, split, undo, refusals; marker at 10 cases (RED)
- c67b74f feat(11-08): overlap across formats, check window, ranking by investor, sale, split, undo and every refusal
- 9017266 test(11-08): hold every refusal and rule to a check that fails without it
- plus the commit of this summary

Pushed only to wip/11-08. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, and neither were audit.js, books-post.js or the pages (plan 11-07).

## Self-Check: PASSED

- FOUND: assets/js/books-bank.js, checks/bank-rec.js, checks/fixtures/bank/fund-a-2027-01.csv
- FOUND (on HEAD's history since a2f6106): 8ae0642, 1f4b3d1, 8c6ac1d, c67b74f, 9017266
