---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 01
subsystem: fund accounting (journal core)
status: complete
tags: [ledger, double-entry, trial-balance, period-close, cents]
requires: []
provides:
  - "NS.books (assets/js/books.js): chart, accounts, fund, check, post, reverse, live, trialBalance, entries, balance, series, tbText, close, reopen, closedThrough, status, addAccount, addHolding, setHolding"
  - "checks/fixtures/fund-a.js: hand-worked fund A (records, recordEntries, entries, expect), every figure in integer cents"
  - "checks/books-core.js: BOOKS CORE (8 cases)"
affects: [11-05, 11-07, 11-08, 11-10, 11-12, 11-13, 11-16, report builder]
tech-stack:
  added: []
  patterns:
    - "money as integer cents end to end; Number.isSafeInteger on every amount and on the running sum"
    - "read calls work on an unattached empty fund (peek) so they never create ws.books"
    - "returned entries are copies; a stored entry is never edited"
key-files:
  created:
    - assets/js/books.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/books-core.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js
  modified: []
decisions:
  - "A trial balance row is shown for every account with a line dated on or before `to`, or with a non-zero begin (so a 2027 trial balance lists 4010, 5000, 5100, 6100 at begin 0, as the plan requires)"
  - "A reversal cannot be dated before the entry it reverses, and a reversal cannot itself be reversed (re-post the original instead); without a date it takes the original's date (what 11-05's sync needs)"
  - "close and reopen require the person's name (by); post does not"
  - "fund() throws for an offering id the workspace does not hold; read calls on it return empty answers"
  - "status returns counts: { start, closedThrough, entries: journal length, exceptions: exceptions length }"
metrics:
  completed: 2026-11-19
estimate:
  tokens: 72000
  tasks: 2
actuals:
  tokens: 17081
  tasks: 2
  commits: 5
plan_head_before: 211ad705f245243a207f85c8886e43a92bebfdd7
plan_head_after: 38e9969ce5b14948ba96ea209580cfb28b23f5fd
---

# Phase 11 Plan 01: The fund journal (books.js) Summary

One double-entry journal per fund in integer cents: entries must balance to the cent and are never edited (a correction is a reversal that names the entry), a closed month-end stores the SHA-256 of its trial balance and refuses posts, and hand-worked fund A reproduces the research's trial balance (55,650,000 = 55,650,000 cents over ten accounts) and both equations at all twelve month-ends.

The owner has not checked this yet. No page loads books.js yet (plan 11-07 adds the script lines), so nothing on any screen changes.

## Failures first

- **The first full reference-gate run ended GATE_EXIT=1** with two steps failing, `GATE FAIL MEASURE` and `GATE FAIL EMAIL DIALOG (3)` (kept in SCRATCH/exec-11-01/gate-run1.txt). Neither involves this plan's files (the diff from 211ad70 touches only the three new files, and no page loads books.js):
  - MEASURE: the leak step flagged `assets/js/taxdocs.js:531` (a run of eight words; the file came in with 10-02 and is the same at the base and at HEAD). It ran at 19:28. At 20:20 someone else changed the shared allowed list (SCRATCH/owner-set/leak-allowed.json). Run alone afterwards on this tree: `PASS leak (4 s): 609 files and 723 commit messages searched: no name of the list, no run of eight words outside the allowed list; ...`.
  - EMAIL DIALOG: `FAIL phone phone-390x844-frame520px: every paragraph of the email, its footer and the buttons were seen whole (8 of 11)`, during a run with many browser checks queued on the machine. Run alone afterwards: `tree: EMAIL DIALOG: PASS (parts run: 3)` and, on a clean copy of 211ad70, `base: EMAIL DIALOG: PASS (parts run: 3)`. So the failure did not come back on either tree; treat that check as possibly flaky under heavy load.
  - The second full run, with nothing changed in the repository, ended **GATE_EXIT=0** (below).
- My own mechanics wasted queue time: the first gate run was wrapped in SCRATCH/exec-011/heavy.sh, which holds one of the three shared queue slots for the whole gate run. The gate already queues its own browser steps, so other agents had two slots instead of three while it ran. My attempt to stop that run was refused, so it ran to the end. The second run was started without the wrapper.

- One weakness found in my own check during this plan and fixed: a deliberate mutation that removed the per-amount safe-integer rule (I4) still passed, because the running-total guard also refuses 1e300. Case `check` now requires the refusal to name the line ("Line 1: ... too large") for 1e300 and for 2^53; the mutation now fails (commit 38e9969).

## Verify lines (verbatim)

Task 1:
```
PASS fund-a at each month-end net assets equal the fixture's limited partners' capital
PASS fund-a balance(1000, 2026-12-31) is the cash of the fixture
BOOKS CORE: PASS (cases run: 1)
```

Task 2 (BOOKS CORE, then the last 40 lines of the reference gate run through phase 9's gate9.sh):
```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
BOOKS CORE: PASS (cases run: 8)
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
GATE ok   HELP CHAT (10)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 272
# pass 272
# fail 0
GATE ok   server tests 272 = base 272 + 0 declared
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=0
```

## RED evidence

- red-1.txt (Task 1, before books.js existed): `FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/books.js'` then `BOOKS CORE: FAIL (cases run: 1) - fund-a`.
- red-2.txt (Task 2, Task 1's books.js in place): 51 PASS lines, then `FAIL chart ran to the end :: TypeError: NS.books.addAccount is not a function`, `FAIL post ... addHolding is not a function`, `FAIL reverse ... reverse is not a function`, `FAIL closed ... close is not a function`, `FAIL reads ... entries is not a function`, last line `BOOKS CORE: FAIL (cases run: 8) - chart, post, reverse, closed, reads`. Cases check, fund-a and selfcheck already passed on Task 1's code (check and post existed then).
- Mutation run after GREEN (each restored after): safe-integer rule removed -> `FAIL ... - check`; no carry of earlier years into 3900 -> `FAIL ... - reads`; post ignoring the closed period -> `FAIL ... - closed`.

## What was measured

- BOOKS CORE: 8 cases (chart, check, post, fund-a, reverse, closed, reads, selfcheck), 103 PASS lines, 0 FAIL.
- Fund A trial balance at 2026-12-31, read from fixtures/fund-a.js expect.tb: 1000 +3,200,000 · 1100 +40,000,000 · 1150 +9,000,000 · 2100 -450,000 · 3000 -45,000,000 · 3100 +900,000 · 4010 -1,200,000 · 5000 +1,800,000 · 5100 +750,000 · 6100 -9,000,000 (cents). Debits 55,650,000 = credits 55,650,000.
- At each of the twelve 2026 month-ends: the trial balance sums to 0; assets less liabilities equal equity plus income less expenses plus gains; and net assets equal the fixture's month-end limited partners' capital (44,850,000 ... 51,750,000).
- 2027 trial balance: 4010, 5000, 5100, 6100 at begin 0; 3900 begins at -7,650,000; the ends sum to 0; no closing entry is stored.
- The fixture's own arithmetic is checked before anything is compared (its trial balance sums to 0, debits and credits equal the stated totals, its twelve month-end figures add to 555,300,000 and average 46,275,000).

## Scripts the check loads

assets/js/tenants.js (NS.OFFERING_TYPES, for the chart's fund type), assets/js/data.js (NS.dates), assets/js/audit.js (NS.audit.sha256), assets/js/books.js, in that order, in a fresh vm context per case. The context is given TextEncoder (audit.js's sha256 calls it; without it the hash throws "TextEncoder is not defined", measured). NS.dates.today is fixed to 2027-01-20.

## Interfaces as built

Every name of the plan's interfaces block is exported, unchanged: chart, accounts, fund, check, post, reverse, live, trialBalance, entries, balance, series, tbText, close, reopen, closedThrough, status, addAccount, addHolding, setHolding. Stored shapes as the block states (ws.books = { v: 1, funds }, fund keys start, accounts, journal, holdings, marks, bank { accounts, imports, lines, recs }, closed, exceptions; entry { id, date, memo, src, lines, at, by, rev on a reversal only }; line [code, cents, partner, holding] with trailing empty ids left out; added accounts stored as [code, name, type, line]).

Behaviour the block left open, as built:
- post and reverse throw an Error whose message is exactly 'closed' (with e.code 'closed' and e.through) for a closed period; every other refusal is one plain sentence.
- A posted or reversing entry is returned as a copy. live(fund, src) returns the stored entry itself (it is given the fund).
- trialBalance rows also carry `line` (the Schedule L suggestion). from '' means from the first entry; to '' means no end.
- entries accepts account as a code or a list of codes.
- status returns counts for entries and exceptions.
- addHolding defaults: kind 'investment', level 3, address '', placed '', landCents 0, buildingCents 0.
- close and reopen require `by`; reopen trims `why` and refuses an empty one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Refusals beyond the block's list**
- **Found during:** Task 2
- **Issue:** the block does not say what happens when a reversal is itself reversed, when a reversal is dated before its entry, when close or reopen has no person, or when fund() is asked for an offering the workspace does not hold.
- **Fix:** each throws a plain sentence and stores nothing (a reversed reversal would leave the original "not live" while its effect is restored, so a later post of its src would double it). Proven in cases reverse, closed and post.
- **Files modified:** assets/js/books.js
- **Commit:** 6e18318

**2. [Rule 1 - Test gap] I4 assertion tightened** (see Failures first). Commit 38e9969.

**3. Fixture records include the contribution positions receive() writes**
- The plan lists the commitment positions dated 2026-01-10; the records also hold the two positions NS.ops.receive adds when a call payment is recorded (operations.js addContribution: amount 300,000 / 150,000 dollars, dated 2026-01-15, ref fa-call-1), so the workspace is what the portal would hold after the call was received. No journal figure depends on them.

**4. The check also proves things the plan did not list:** month-end net assets against the fixture's limited partners' capital; addHolding and setHolding (in case post: ids h-2 ... h-b, refusals, the id never changes); the returned entry is a copy; reads on a workspace without books create nothing.

## Known Stubs

None.

## Threat Flags

None. books.js has no network, storage or screen surface. T-11-01 (case check), T-11-02 (case closed), T-11-03 (cases reverse and post) are mitigated as the threat register states.

## Commits

- acbdb8e test(11-01): hand-worked fund A fixture and the fund-a journal case (RED)
- bb6c143 feat(11-01): fund journal in whole cents: chart, check, post, trial balance, balance
- 95cd864 test(11-01): chart, check, post, reverse, closed, reads and selfcheck cases (RED)
- 6e18318 feat(11-01): reversal, closing with a trial balance hash, holdings and the report builder's reads
- 38e9969 test(11-01): case check pins I4 on the amount itself (a mutation removing it had passed)
- plus the commit of this summary

The gate's base tree was removed (`test ! -e $O/gate/base-tree` passed) and server/node_modules was linked only for the run, removed afterwards and never staged. STATE.md and ROADMAP.md were not touched. Pushed only to wip/11-01.

## Self-Check: PASSED

- FOUND: assets/js/books.js, checks/books-core.js, checks/fixtures/fund-a.js
- FOUND (ancestors of HEAD): acbdb8e, bb6c143, 95cd864, 6e18318, 38e9969
