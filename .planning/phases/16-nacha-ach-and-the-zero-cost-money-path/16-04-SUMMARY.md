---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 04
subsystem: books (assets/js/books-post.js)
tags: [ach, returns, books, reconciliation, AC-10, C-07]
status: complete
requires: [phase 11 books (books.js, books-post.js, books-bank.js)]
provides: [ret:, repaid:, reqret:, reqrepaid: entries posted from the record; checks/posting-returns.js (10 cases)]
affects: [16-08 (writes run.lines[].ach and request.ach), 16-11 and 16-12 (write ach.repaid), 16-14 (owner walk on sample firms)]
tech-stack:
  added: []
  patterns: [entries derived from records only, through NS.books.post and NS.books.reverse]
key-files:
  created:
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/posting-returns.js
  modified:
    - assets/js/books-post.js
decisions:
  - "C-07 as built: a returned distribution line posts [1000 + investor][2000 - investor] on the return day; the run's own entry is never changed"
  - "A returned redemption payment goes back to 2200 ([1000 + investor][2200 -]); its second payment is [2200 +][1000 - investor]"
  - "16-CONTEXT W2: in a sample fund the four return kinds are left out of the balances the sample month is moved from, so they sit on top of the generator's figures and no sample month goes unbalanced"
  - "A return whose date is not a real day is refused and listed as { src, kind: 'date', value } instead of stopping the whole sync"
metrics:
  completed: 2026-11-27
  base_commit: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc
actuals:
  tokens: 12000
  tasks: 2
  commits: 7
plan_head_before: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc
plan_head_after: 0eba8c6 (before this SUMMARY's own commit; that commit is the 7th)
---

# Phase 16 Plan 04: the books for returned payments (account 2000)

A payment the bank sends back now reaches the books from its record, once. A returned distribution line posts cash back in and an amount owed to that investor in 2000. A returned redemption payment posts the same way into 2200. Each one is cleared when the payment is made again. Gross, tax withheld, net and the capital accounts never move. Nothing in the portal writes these records yet: 16-08 writes the return, and 16-11 and 16-12 write the second payment. No screen and no sample package changes.

## Failures first

- **The gate hit the time limit three times before it finished.** gate11.sh ran four times into the same folder. Runs 1 to 3 were stopped at the 2-hour background limit.
  - Run 1 also had browser crashes in FORMS FLOW (12 cases: "page.screenshot: Target crashed", then "browser has been closed") and STATUS FLOW (b506, lean, c506never). It ended in a GATE FAIL for the owner's folder that depends on them.
  - Browser slots are shared with other agents. These were crashes, not failed assertions.
  - On run 2 the same parts passed on the same tree (FORMS FLOW (34), STATUS FLOW (26), owner's folder all ok).
  - Run 4 finished with GATE_EXIT=0.
- **Stale link removed.** Run 1 was killed before its cleanup, so the server/node_modules link it made was left in the tree. I removed it by hand before the final commit.
- **No other failures.**

## RED

Task 1 (red-1.txt, check at 8c30b8b, before any books change):
```
FAIL returned desired holds one ret:fa-run-1:FA-1001 dated 2026-12-17: [1000 +600,000 FA-1001][2000 -600,000 FA-1001] :: []
FAIL returned its memo is 'Returned distribution fa-run-1: FA-1001'
FAIL returned sync posts the 15 record entries and the return, reverses nothing and lists nothing :: {"posted":15,"reversed":0,"exceptions":0}
FAIL returned 2026 trial balance: 2000 is -600,000, all of it owed to FA-1001 :: {...}
FAIL returned cash is 3,800,000: the unreturned 3,200,000 plus the 600,000 that came back :: {"now":3200000,"before":3200000}
POSTING RETURNS: FAIL (cases run: 1) - returned
```

Task 2 (red-2.txt, at 637efae, with only ret: built; this is a selection of red-2.txt's 23 FAIL lines):
```
FAIL repaid desired holds one repaid:fa-run-1:FA-1001 dated 2026-12-23: [2000 +600,000 FA-1001][1000 -600,000 FA-1001] :: []
FAIL cancelled sync reverses the three and posts nothing :: {"posted":0,"reversed":2,"exceptions":0}
FAIL redemption reqret:req-b-1 dated 2027-01-06: [1000 +200,000 B-1][2200 -200,000] :: []
FAIL redemption reqrepaid:req-b-1 dated 2027-01-12: [2200 +200,000][1000 -200,000 B-1] :: []
FAIL amount a redemption return of 199,999 against 200,000 paid: no reqret: entry, listed as 'amount' :: []
FAIL idempotent fund A with ret: and repaid: posted: a second sync posts, reverses and lists nothing; ws.books identical :: {"posted":0,"reversed":0,"exceptions":0}
FAIL sample one more entry is posted than in the unreturned copy :: {"A":{"posted":427,"reversed":0,"exceptions":0},"B":{"posted":405,"reversed":0,"exceptions":23}}
FAIL sample cash is up by the net (875000) and 2000 down by it :: {"A":[29124021,null],"B":[-110295506,-875000]}
FAIL sample no other account moves :: [["1100",660397858,659388197],["1150",281278825,280848788],["2100",-1062500,-25500000],["3900",-477073811,-374316479],["6100",-63414393,0]]
POSTING RETURNS: FAIL (cases run: 10) - repaid, cancelled, redemption, amount, idempotent, sample
```
The sample lines measure the plan checker's W2. With only ret: added, one return in Kestrel Bay left 23 sample months unbalanced and pushed cash to -110,295,506.

## Verify lines

Task 1 (at 348fe6c):
```
POSTING RETURNS: PASS (cases run: 1)
VERIFY1=0
```

Task 2 (at 5047f14; the verify is the plan's, with 9 changed to 10 per W2):
```
PASS sample no other account moves
POSTING RETURNS: PASS (cases run: 10)
PART1=0
```
That run had 67 PASS lines and 0 FAIL. The `date` refusal checks were added afterwards and are in the same commit. Phase 11 POSTING on the same tree: `POSTING: PASS (cases run: 13)`.

Gate: gate11.sh was used, not gate16.sh, as instructed. gate16.sh is being built by 16-01 in parallel, and the books are phase 11's. Command: `GATE_OUT=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-16-04 bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh`, with base-commit.txt = 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc. These are the last 15 lines of the 4th run (64 GATE ok lines, no GATE FAIL):
```
GATE ok   TAXRECORD FLOW (kept from 2026-11-27 03:00:33 UTC)
GATE ok   WITHHOLDING FLOW (kept from 2026-11-27 03:10:37 UTC)
GATE ok   AUDIT SAME (kept from 2026-11-27 03:10:59 UTC)
GATE ok   BANK FILES (kept from 2026-11-27 03:11:01 UTC)
GATE ok   BANK REC (kept from 2026-11-27 03:11:02 UTC)
GATE ok   BOOKS CORE (kept from 2026-11-27 03:11:02 UTC)
GATE ok   ENGINE BOOKS (kept from 2026-11-27 03:11:03 UTC)
GATE ok   HOLDINGS (kept from 2026-11-27 03:11:04 UTC)
GATE ok   NO ONBOARDING (kept from 2026-11-27 03:11:04 UTC)
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE_EXIT=0
```
- Server tests: `GATE ok   server tests 422 = base 422 + 0 declared`.
- AUDIT SAME: "compared 928 schedules and 60 packages (60 byte-identical as whole files) of 15 funds" and `AUDIT SAME: PASS (cases run: 4)`.
- `test "$(tail -n 1 gate.txt)" = 'GATE_EXIT=0' && grep -Eq '^GATE ok .*AUDIT SAME'` holds.

GATE_EXIT=0

## Record shapes as built (for 16-08, 16-11 and 16-12)

- `run.lines[k].ach = { status: 'returned' | 'repaid', code, date, cents, trace, by, at, source, repaid: null | { how, on, by, at, fileId } }`. Only status, date, cents and repaid.on are read.
- `request.ach` has the same block. Its cents must equal request.paidCents.
- These are the entries posted:

| src | dated | lines | memo |
|---|---|---|---|
| `ret:<runId>:<investorId>` | ach.date | [1000 +cents investor][2000 -cents investor] | Returned distribution <runId>: <investorId> |
| `repaid:<runId>:<investorId>` | ach.repaid.on | [2000 +cents investor][1000 -cents investor] | Distribution paid again <runId>: <investorId> |
| `reqret:<requestId>` | ach.date | [1000 +cents investor][2200 -cents] | Returned redemption payment <requestId>: <investorId> |
| `reqrepaid:<requestId>` | ach.repaid.on | [2200 +cents][1000 -cents investor] | Redemption paid again <requestId>: <investorId> |

- A return is posted only for a run NS.data.runPaid counts that has stored lines, and only for a request with status 'paid' and paid set. A repaid: entry needs an ach.repaid object.
- Refusals, where nothing is posted and a live entry is left as it is:
  - `{ src, kind: 'amount', account: '1000', value }` when cents is not a whole number of cents above zero equal to netCents (or paidCents).
  - `{ src, kind: 'date', value }` when the date is not a real day.
- A closed month is listed as `{ kind: 'closed', ... }` by sync, as for every other kind.
- Account for the CPA's read (C-07, 11-17): returned distributions sit in 2000 "Accounts payable and accrued expenses". Returned redemption payments sit in 2200 "Redemptions payable". There is no chart change.

## Deviations from Plan

1. **[Rule 1, fixture realism] Who and when.**
   - Plan: FA-1002's line, returned 2026-12-04. Built: FA-1001's line, returned 2026-12-17.
   - Why: in fund A, FA-1002 is paid by check, and FA-1001 is the ACH payee. fa-run-1 is paid on 2026-12-15, so 2026-12-04 would be a return before the payment. 2026-12-17 is two banking days after it, the R03 window.
   - Knock-on dates in the other cases: repaid by check on 2026-12-23. Fund B's redemption has dealing date 2026-12-31, is paid 2027-01-04, returned 2027-01-06 and repaid by ACH 2027-01-12. This keeps the plan's 2027-01-05/12 order after a real payment day.
   - Commits: 8c30b8b, 637efae.
2. **[16-CONTEXT W2, applied] Case sample added, and sample() changed so the return kinds do not feed the sample month's balances.** POSTING RETURNS has 10 cases. Commit 5047f14.
3. **[Rule 2, missing validation] A return or second payment whose date is not a real day is refused and listed as kind 'date'.** Without this, NS.books.post would throw and stop the sync for every fund. Case amount covers it. Commit 5047f14.
4. **[No bank numbers] Fund B is written in this check without bank numbers** (phase 11's fundB carries a full routing number). The trace is 190000010000001, which uses the never-issued prefix 19.
5. **Case wire also switches FA-1002 to ACH** (bank object without numbers), so the ACH total line is real (-300,000) and shown to leave out the wire. It also proves both statement lines find their candidate.

## Open items (not built here)

- **audit.js (not in this plan's files).** The "records could not be posted" count reads kinds 'amount', 'mismatch' and 'overpaid', so a 'date' refusal is not counted there. 16-08 validates dates when it applies a return, so this should not occur from the portal. A later plan that touches audit.js should add 'date'.
- **A second payment made by check** (repaid: by check) clears in the bank days later. books-bank.js treats only `run:` cash lines as checks, which may clear up to 180 days later. So a repaid: check line is suggested only within 3 business days of its date. books-bank.js is outside this plan (11-18 is editing it). 16-11 should decide this.
- **Sample runs are saved without stored lines**, so a return on a sample firm (16-14's walk) needs NS.data.confirmLines first. Case sample does exactly that. 16-08's apply must store the lines (or refuse) when a run has none.
- Owner check: nothing here is called ready. The owner has not seen it, and it has no screen until 16-08.

## Commits

- 8c30b8b test(16-04): RED case returned for a returned distribution line
- 348fe6c feat(16-04): post a returned distribution line as ret: (C-07)
- 96b5f2d wip(16-04): save
- 637efae test(16-04): RED cases for second payments, redemptions, refusals, closed months, wires, reconciliation and a sample firm
- 5047f14 feat(16-04): second payments, returned redemption payments and returns in sample funds
- 0eba8c6 wip(16-04): save
- (this SUMMARY's commit)

## Self-Check: PASSED

- assets/js/books-post.js and checks/posting-returns.js exist on the tree.
- 8c30b8b, 348fe6c, 637efae and 5047f14 are ancestors of HEAD.
- red-1.txt, red-2.txt, t1.txt, all.txt and gate.txt are in /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-16-04.
