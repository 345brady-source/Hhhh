---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 10
subsystem: fund accounting (valuations, opening balances, closing a month)
status: gate-pending
tags: [ledger, fair-value, opening-balances, closing, change-log, fa-05, fa-07]
requires: ["11-01 (books.js)", "11-05 (books-post.js sync)", "11-07 (the engine reads open:<id>)", "audit.js log/verify/sha256", "app.js can('configure')"]
provides:
  - "NS.books.value, NS.books.opening, NS.books.finalize, NS.books.reopenBooks (assets/js/books-hold.js)"
  - "NS.ops.redemptionAmount returns the finalized req:<id> amount once the dealing month is closed"
  - "checks/holdings.js: HOLDINGS (6 cases)"
affects: [11-13 (the screens for these inputs and the script line that loads books-hold.js), 11-15, 11-16]
tech-stack:
  added: []
  patterns:
    - "posted first, stored after: a mark or start date is written only once the journal has accepted the entry"
    - "owner-only acts check NS.app.can('configure') before anything changes"
key-files:
  created:
    - assets/js/books-hold.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/holdings.js
  modified:
    - assets/js/operations.js
decisions:
  - "An opening entry may hold only asset, liability and equity accounts (a balance sheet); an income, expense or gain line is refused"
  - "value() refuses a date before the holding's latest value (W6); a second value on the same day as the latest is accepted"
  - "'Books closed' and 'Books reopened' are written to the change log with the person passed as by (the actor), the time stamped by the log"
metrics:
  duration: "not measured"
  completed: 2026-11-20
estimate:
  tokens: 70000
  tasks: 2
actuals:
  tokens: 7200
  tasks: 2
  commits: 7
plan_head_before: ad2fc5a78d65cc1aa5b362026c33540dd76340b6
plan_head_after: c584ac835c3b3ac9eb08ce231a454a36b6e77ad5
---

# Phase 11 Plan 10: Valuations, opening balances and closing Summary

A sponsor's fair value for an investment now posts the change since its carrying amount to 1150 and 6100 (nothing when unchanged). A fund that existed before the portal enters its opening balance sheet once. Finalizing a month brings the books up to date from the records, locks them and writes the trial balance's SHA-256 and the person to the hash-chained change log. Only an owner can finalize or reopen, and reopening needs a reason. A redemption's amount is frozen once its dealing month is finalized. Funds A, B and D tie to the cent. The owner has not checked this. The screens for these inputs are plan 11-13, and no page loads books-hold.js yet.

## Failures and weak points first

- **The phase gate did not finish, so there is no GATE_EXIT line.** The run (`GATE_OUT=SCRATCH/exec-11-10`) was stopped when it hit the 2-hour background limit. At that point it had passed the whole reference gate and the server test count. It was stuck in phase 10's browser checks (`p10-dist-flow.txt` was empty), waiting in the shared browser queue (heavy.sh) behind four other gates that were running at the same time (10-10, 08-07 twice, 11-11, 12). No GATE FAIL line was printed. The tool rules say not to restart a command that hit the maximum time limit, so I did not run it again. **The orchestrator should resume it into the same folder**: `GATE_OUT=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-11-10 bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh`. Every step that passed is kept. The gate folder (425 MB, with base-tree) was left in place for that resume, and the gate deletes it when it ends. The server/node_modules link the gate made was removed.
- To cover the gap, every phase 11 node check was run directly against the gate's base tree (same P11_ROOT/P10_BASE as the gate, GATE_FRESH=1). All pass (below). PDF OUT (browser) and phase 10's checks were not run.
- **Not every check failed first:** case `refusals` passed in red-2, because value() and its guards (W6 included) were written in Task 1. A mutation proves the case can fail: with the closed-period and date-order guards removed, 4 of its checks fail (mut-refusals.txt). Case `selfcheck` passes without any plan code, because runParts already enforces it. Its rules are proved by child processes.
- The RED for case `value` (red-1) is a missing file (books-hold.js did not exist), not a wrong figure.

## RED evidence (SCRATCH/exec-11-10)

red-1.txt (case value, before books-hold.js existed):
```
FAIL value ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/books-hold.js'
HOLDINGS: FAIL (cases run: 1) - value
```
red-2.txt (all six cases, before opening, finalize, reopenBooks and the redemptionAmount change):
```
FAIL opening ran to the end :: Error: NS.books.opening is not defined (books-hold.js)
FAIL finalize ran to the end :: Error: NS.books.finalize is not defined (books-hold.js)
FAIL redemption ran to the end :: Error: NS.books.finalize is not defined (books-hold.js)
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
HOLDINGS: FAIL (cases run: 6) - opening, finalize, redemption
```
red-2b.txt (redemption, with finalize in place and before the operations.js change):
```
PASS redemption the engine's February capital for B-1002 is no longer 49,457,616
FAIL redemption redemptionAmount still returns 49,457,616 (the amount posted when February was finalized) :: 49556854
PASS redemption fund.exceptions lists pos:B-1002:2026-02-01:0 and req:req-b-2
HOLDINGS: FAIL (cases run: 1) - redemption
```
mut-refusals.txt (value()'s closed-period and date-order guards removed, then restored from git):
```
FAIL refusals a date in a closed period (2026-06-30, closed through 2026-06-30): throws and stores nothing :: closed
FAIL refusals a date in a closed period with no change (cost 40,000,000): throws and stores nothing :: did not throw
FAIL refusals a date before the latest value (2026-12-31): throws and stores nothing :: did not throw
FAIL refusals a second value on the same day as the latest is accepted and posts the change since it (+1,000,000) :: {... "lines":[["1150",-5000000,"","fa-x"],["6100",5000000]] ...}
HOLDINGS: FAIL (cases run: 1) - refusals
```

## Verify lines (verbatim)

Task 1 (value.txt):
```
PASS value value(fa-x, 2026-09-30, 46,000,000): change +6,000,000 = mark:fa-m1's lines
PASS value the mark is stored { id 'm-1', holding, date, fvCents, doc, at, by }
PASS value value(fa-x, 2026-12-31, 49,000,000): change +3,000,000 = mark:fa-m2's lines
PASS value fund A's trial balance at 2026-12-31 = the research's (ten accounts)
PASS value the same value again: a third mark is stored (change 0) and no entry is posted
HOLDINGS: PASS (cases run: 1)
VERIFY1 OK
```
Task 2: red-2 has a FAIL line, operations.js has exactly one diff hunk against the base, and hold.txt ends `HOLDINGS: PASS (cases run: 6)`. The gate's last lines when it was stopped (gate.txt, 39 lines, no GATE FAIL):
```
GATE ok   STATUS MATH (13)
...
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
```
Direct run of phase 11's node checks against the gate's base tree (direct.out):
```
holdings exit=0 17:27:35-17:27:36 last: HOLDINGS: PASS (cases run: 6)
posting exit=0 17:27:36-17:27:39 last: POSTING: PASS (cases run: 13)
engine-books exit=0 17:27:39-17:27:40 last: ENGINE BOOKS: PASS (cases run: 8)
books-core exit=0 17:27:40-17:27:41 last: BOOKS CORE: PASS (cases run: 8)
bank-rec exit=0 17:27:41-17:27:42 last: BANK REC: PASS (cases run: 10)
bank-files exit=0 17:27:42-17:27:44 last: BANK FILES: PASS (cases run: 12)
workbook exit=0 17:27:44-17:27:49 last: WORKBOOK: PASS (cases run: 7)
audit-same exit=0 17:27:49-17:28:14 last: AUDIT SAME: PASS (cases run: 4)
```

## What the six cases hold

- **value** (fund A): 46,000,000 at 2026-09-30 gives +6,000,000, equal to mark:fa-m1. 49,000,000 at 2026-12-31 gives +3,000,000, equal to mark:fa-m2. The trial balance equals expect.tb. Entering the same value again stores mark m-3 and posts nothing.
- **refusals**: each of these throws and leaves ws.books byte-identical: an unknown holding, -1, 12.5, a value given as text, 2026-02-30, a closed date (with and without a change), and a date before the latest value (`A later value exists (2026-12-31); enter values in date order.`). A same-day revaluation posts +1,000,000.
- **opening** (fund D): the entry equals the fixture's open:fund-d, start becomes 2026-01-01, and the engine's December 2025 capital is 70,000,000 and 35,000,000. Each of these throws and stores nothing: a second opening, unbalanced lines, a 3900 line with no partner, a partner who does not hold the offering, a closed date, and an income line. The two 2023 subscriptions posted before the opening are reversed by the next sync (reversed = 2), and the trial balance at 2025-12-31 equals the opening entry.
- **finalize** (fund A through 2026-06-30): sync ran first (the June fee and the call were posted). The closed record's tb is the SHA-256 of tbText. The change log's last entry is 'Books closed' / 2026-06-30 / 'Trial balance SHA-256 <hash>', with actor 'Check Runner'. NS.audit.verify is ok. A post dated 2026-06-30 throws. Reopening without a reason throws and logs nothing. With a reason it logs 'Books reopened' with that reason. With can('configure') stubbed to false, and again with role 'team', finalize and reopenBooks both throw, and nothing is logged or locked.
- **redemption** (fund B, today 2026-03-05): 49,457,616 before finalize; the req entry is [3100 +49,457,616 B-1002][2200 -49,457,616]. After the correction to 501,000 dollars, the engine gives 49,556,854, redemptionAmount still gives 49,457,616, and exceptions list pos:B-1002:2026-02-01:0 and req:req-b-2. Once February is reopened, the amount is the engine's again. A paid request still returns its paidCents.
- **selfcheck**: an unknown --case name and an empty list each exit 1 with a FAIL line.

## The one function changed in operations.js

`redemptionAmount(ws, r)`: when r.paidCents is null and the fund's closedThrough is on or after r.dealing, it returns the 2200 credit of the live `req:<r.id>` entry, as a positive number. Otherwise it behaves as before. It is one diff hunk (doc comment plus 6 lines). Nothing else in the file changed.

## Deviations from Plan

1. **[Rule 2 - correctness] An opening entry is a balance sheet only.** A line on an income, expense or gain account is refused (T-11-31: such a line would enter as December's result and move capital). The refusal is tested in case opening.
2. **[Rule 2] finalize checks the month-end, the closed date and the person before it syncs.** A refused close then changes nothing. books.js close would refuse these too, but only after sync had already posted.
3. **[Rule 2] value() never reuses a mark id that already appears in the journal** (`mark:<id>`), even when its mark record is missing. Otherwise post() would silently return the old entry.
4. Case refusals adds checks beyond the plan: a value given as text, a date that is not a calendar date, a closed date with no change, and a same-day revaluation. Case finalize also tests the team role, not only the stubbed can().
5. The phase gate was stopped before it finished (see Failures). The direct node-check run stands in for its phase 11 part until the gate is resumed.

## New files a preview build must add

- assets/js/books-hold.js. It loads after books-post.js. No page lists it yet; plan 11-13 adds the script line.

## Commits

694309e test (case value, RED) · 0b8e8eb feat value() · 142ca78 wip save · 7dbea67 test (five cases, RED) · bf6265f feat opening/finalize/reopenBooks · 071ced1 feat redemptionAmount · c584ac8 wip save, plus this summary's commit.

## Self-Check: PASSED (files and commits)

assets/js/books-hold.js, checks/holdings.js and this summary exist. All seven commits are ancestors of HEAD on wip/11-10. The gate is not complete (see above).
