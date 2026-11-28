---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 05
subsystem: fund accounting (posting from records)
status: complete
tags: [ledger, posting, distributions, withholding, redemptions, period-close]
requires: ["11-01 (books.js)", "11-04 (load11.js, gate11.sh)", "10-01 (stored distribution lines, runPaid, runRows, cancelRun)"]
provides:
  - "NS.books.desired(ws, o, { today }) and NS.books.sync(ws, { today, by, at }) in assets/js/books-post.js"
  - "checks/posting.js: POSTING (13 cases)"
affects: [11-07, 11-08, 11-10, 11-11, 11-12, 11-13]
tech-stack:
  added: []
  patterns:
    - "which records count is the engine's (NS.audit.ledger) and 10-01's (runRows); never decided again here"
    - "every write through NS.books.post / reverse; a closed period is listed, never rewritten"
key-files:
  created:
    - assets/js/books-post.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/posting.js
  modified: []
decisions:
  - "13 cases, not 12: fund B's redemptions (W4) are their own case 'redeem'; the marker and the verify lines say 13"
  - "A record that cannot be posted as it stands (an amount that is not whole cents, or a stored line whose net is above its gross or does not add up to the engine's gross) is listed in fund.exceptions and its live entry, if any, is left as it is"
  - "Closed-period items carry kind 'closed' and both dates: { kind, src, date (new, or old when now is null), wasDate, was, now, found }"
  - "Memos follow the fixture's shape (I1): 'Capital call 1: FA-1001', 'Subscription: B-1', 'Distribution fa-run-1', 'Management fee Jan 2026'"
metrics:
  duration: "full gate 23:00:00-00:04:53 UTC (build time not measured)"
  completed: 2026-11-20
estimate:
  tokens: 92000
  tasks: 3
actuals:
  tokens: 11910
  tasks: 3
  commits: 8
plan_head_before: 3e3ac3295538bf15137bce15ea208cf3d1af155e
plan_head_after: 2d1202d297cc99bf0173066ab4367f56688bef65
---

# Phase 11 Plan 05: Posting every money record into the journal Summary

Every money event the portal already records (call payments, funded subscriptions and closings, paid distributions with tax withheld and the general partner's share, redemptions and their payment, monthly fees, crystallized carry) now becomes one journal entry keyed by its record, in whole cents; fund A posted from its records gives the research's trial balance to the cent, the journal ties to the capital-account engine for fund A and all 15 sample funds, and a closed period is listed, never rewritten. No page loads books-post.js yet (plan 11-07). The owner has not checked this.

## Failures and weak points first

- **Not every case failed first.** In Task 2, cases `t4`, `fees` and `nolog` passed on Task 1's code (contributions, runs and fees were already posted, and nothing wrote a log). In Task 3, `repeat` and `selfcheck` passed before the code (books.js's post already refuses a second entry for a live src; selfcheck tests the harness). Each was then proven able to fail by mutation (table below).
- **Three parts were written after the code**, not before: the stray line (W3) in case `withheld`, and the `amount` and `mismatch` holds in cases `gp` and `withheld`. Mutations removing each branch fail them.
- **A weakness found by the W1 run and fixed:** with the clear in sync removed, the stale engine gross was mixed with the fresh stored net and produced a debit on 2400 (`["2400",150000,"FA-1002"]`). Now a run whose engine gross does not equal its stored withheld plus net is not posted, its live entry is left alone, and it is listed as `mismatch`.
- **Fees for a real fund still follow the engine's default rate** (settings: the offering's `accounting.mgmtFee`, else the profile's rate) until plan 11-07; they are posted as the engine charges them.
- The overpaid example of W4 cannot be worked by hand: fund B's capital at 30 June 2026 includes the engine's generated return. The check reads it from the engine (9,657,456 cents) and proves the rule against it.

## Verify and gate lines (verbatim)

Task 1 (`SCRATCH/exec-11-05/verify1.sh`, the plan's command):
```
PASS fund-a after the fixture's other entries, the 2026 trial balance is the research's to the cent (ten accounts, 55,650,000 each side)
PASS fund-a debits and credits are the fixture's totals
POSTING: PASS (cases run: 1)
VERIFY1 OK
```
Task 2 (`verify2.sh`, the plan's command with `redeem` added, so 9 cases):
```
PASS nolog the workspace without ws.books is exactly as before
POSTING: PASS (cases run: 9)
VERIFY2 OK
```
Task 3 (`verify3.sh`: a fresh full run, then the gate's output checked by the plan's conditions; the W1 run's FAIL is required too):
```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty list exits 1 with a FAIL line
POSTING: PASS (cases run: 13)
VERIFY3 OK
```
`GATE_OUT=SCRATCH/exec-11-05 bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh`, whole output (base 3e3ac32, HEAD 2d1202d):
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
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 358
# pass 358
# fail 0
GATE ok   server tests 358 = base 358 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX MATH
GATE ok   TAXDOCS MATH
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BOOKS CORE
GATE ok   POSTING
GATE ok   WORKBOOK
GATE_EXIT=0
```
AUDIT SAME: `AUDIT SAME: PASS (cases run: 4)` (nothing a sample firm shows has changed; no page loads the new file). The gate removed its base tree; no server/node_modules link is left.

## RED evidence (SCRATCH/exec-11-05)

- red-1.txt: `FAIL fund-a ran to the end :: Error: ENOENT: ... assets/js/books-post.js` then `POSTING: FAIL (cases run: 1) - fund-a`.
- red-2.txt: `FAIL withheld ran to the end :: Error: The lines do not balance: they are off by $800.00.`, gp (no 3300 lines, cash 3,200,000), start (call entries present, 15 entries), redeem (no req or reqpaid entry), samples (`pb-long-short PBP-1002: journal 50000000/0, engine 50000000/69603074`, `pb-multi PBP-1002: journal 25000000/0, engine 25000000/10000000`); last line `POSTING: FAIL (cases run: 9) - withheld, gp, start, redeem, samples`.
- red-3.txt: closed (no exception listed) and open-change (no reversal, cash 3,200,000, the old 600,000 / 300,000 lines kept); last line `POSTING: FAIL (cases run: 13) - closed, open-change`.
- noclear.txt (W1, `POSTING_NO_CLEAR=1`: books-post.js run with its one `NS.clearCaches()` removed): `FAIL closed fund.exceptions holds one item ... :: []`, `FAIL open-change the position edit gives one reversal and one new run entry :: {"posted":0,"reversed":0,"exceptions":1}`, last line `POSTING: FAIL (cases run: 2) - closed, open-change`.
- mutations.txt (each applied to books-post.js alone, the named case run, the file restored):
```
stray branch removed -> POSTING: FAIL (cases run: 1) - withheld
mismatch guard removed -> POSTING: FAIL (cases run: 1) - withheld
hold ignored (a held record is reversed) -> POSTING: FAIL (cases run: 1) - gp
run gross posted without the investor -> POSTING: FAIL (cases run: 1) - t4
fees dated the first of the month -> POSTING: FAIL (cases run: 1) - fees
sync writes a change-log entry -> POSTING: FAIL (cases run: 1) - nolog
closed-period rule removed -> POSTING: FAIL (cases run: 1) - closed
reqpaid posts paidCents -> POSTING: FAIL (cases run: 1) - redeem
start rule removed -> POSTING: FAIL (cases run: 1) - start
a changed open record is not reversed -> POSTING: FAIL (cases run: 1) - open-change
```

## Hand-worked examples the check holds to the cent

- Fund A: desired = the fixture's 15 record entries (2 calls, 12 fees, 1 run), compared on src, date and lines after sorting both by date then src (B1). After sync and the fixture's 8 other entries, the 2026 trial balance is expect.tb: 1000 +3,200,000 · 1100 +40,000,000 · 1150 +9,000,000 · 2100 -450,000 · 3000 -45,000,000 · 3100 +900,000 · 4010 -1,200,000 · 5000 +1,800,000 · 5100 +750,000 · 6100 -9,000,000; 55,650,000 each side.
- T4, 2026: FA-1001 3000 -30,000,000 = engine 30,000,000; FA-1002 -15,000,000 = 15,000,000; 3100 FA-1001 +600,000 = 600,000; FA-1002 +300,000 = 300,000. Q4 2026: contributions 0, distributions the same. Schedule 06's total row: 45,000,000 and -900,000 (2026), 0 and -900,000 (Q4).
- Fees: twelve entries [5000 +150,000][2100 -150,000] dated the month-ends; each month's 5000 equals the engine's fee.
- Withheld ($800.00 from FA-1002): [3100 +600,000 FA-1001][3100 +300,000 FA-1002][2400 -80,000 FA-1002][1000 -600,000][1000 -220,000 FA-1002]; 2400 ends -80,000; cash 3,280,000.
- Carried interest (gp 100,000): the run's entry adds [3300 +100,000][1000 -100,000]; cash 3,100,000; 3300 +100,000.
- Stray (a stored line of 50,000 for FA-1003, not on the register): [3100 +50,000 FA-1003][1000 -50,000 FA-1003] in the run's entry; listed once as { src: 'run:fa-run-1', kind: 'stray', investorId: 'FA-1003', cents: 50000 }.
- Start 2026-02-01: no call entry, eleven fee entries, the run; 12 entries.
- Fund B (W4): pos:B-1:2026-01-31:0 [1000 +10,000,000][3000 -10,000,000 B-1]; req:req-b-1 dated 2026-06-30 [3100 +200,000 B-1][2200 -200,000]; reqpaid:req-b-1 dated 2026-07-10 [2200 +200,000][1000 -200,000 B-1]; 2200 is -200,000 at 30 June and 0 at the end; no exception. With paidCents 20,000,000: the engine redeems 9,657,456 (B-1's whole capital); reqpaid posts 9,657,456; listed { kind: 'overpaid', cents: 10,342,544 }; 2200 ends 0.
- Closed (through 2026-06-30, FA-1002's payment moved to 2026-01-16): the journal's JSON identical; one item { kind: 'closed', src: 'call:fa-call-1:FA-1002', date: '2026-01-16', wasDate: '2026-01-15', was: [["1000",15000000],["3000",-15000000,"FA-1002"]], now: the same lines, found: '2027-01-20' }; a second sync adds none. Closed through 2026-12-31 and fa-run-1 cancelled: nothing changes; one item with now null.
- Open (cancelRun on fa-run-1): one reversal dated 2026-12-15 by 'Portal (automatic)'; 3100 ends 0; cash 4,100,000. A run saved before 10-01 (no stored lines) after FA-1002 gains 150,000.00 dated 2026-11-01: one reversal and [3100 +450,000 FA-1001][3100 +450,000 FA-1002][1000 -450,000][1000 -450,000 FA-1002]; T4 holds again (450,000 each).

## Sample funds (today 2026-11-19; case samples)

| Firm | Entries | ws.books (bytes) | Stray lines | Redemptions | Investor accounts tied |
|------|---------|------------------|-------------|-------------|------------------------|
| kestrel-bay | 270 | 66,085 | 0 | 0 | 40 |
| ashwell-ridge | 345 | 131,080 | 0 | 0 | 45 |
| greywater | 261 | 87,484 | 0 | 0 | 44 |
| pellbrook | 417 | 90,090 | 0 | 2 | 75 |

Every entry passes books.js's check on the fund's chart; each fund's journal holds exactly the srcs desired holds; inception to date, every investor's 3000 and 3100 lines equal the engine's contributions and distributions (including redemptions); pellbrook's two paid redemptions each have one req and one reqpaid entry. A second sync of kestrel-bay posts and reverses nothing and leaves ws.books identical. Sync of pellbrook leaves ws.audit (length and last entry) and everything outside ws.books byte-identical, and NS.audit.log is not called.

## Interfaces as built, where they differ from the plan's block

- `desired(ws, o, opts)`: o may be the offering or its id. Entries sorted by date, then src (B1). Throws when opts.today differs from NS.dates.today() (W2). Memos follow the fixture (I1), not the block's 'Capital call <n>' / 'Distribution: <type>'.
- Runs come from the engine's L.dists and L.strays grouped by run (W2); gross from the engine; 2400 is the stored line's withheld (gross less net, runRows' withheldCents); cash is the stored net. A stray is posted to 3100 with its investor (W3).
- reqpaid always posts the engine's redemption cents; a paidCents above them is listed as 'overpaid' (W4; the block said paidCents when set).
- pos: counts only positions above zero (I2). Stored and desired lines are compared after the same compacting books.js applies (I3); memos are not compared.
- `sync(ws, { today, by, at })` returns counts { posted, reversed, exceptions } (exceptions: items newly added). It calls NS.clearCaches() before reading (W1), saves through NS.workspace.save only when something changed, never calls NS.audit.log.
- fund.exceptions items: { kind: 'closed', src, date, wasDate, was, now, found } (the block's { src, date, was, now, found } plus kind and wasDate); { src, kind: 'stray' | 'overpaid', investorId, cents, found }; { src, kind: 'amount', account, value, found }; { src, kind: 'mismatch', investorId, cents, recorded, found }. An identical item (ignoring found) is never added twice.
- A call src that would repeat (the same investor twice in one call) gets ':2', ':3' appended.

## Deviations from Plan

1. **[Plan-check W4] 13 cases instead of 12.** `redeem` is its own case; the marker is `// last "POSTING: PASS (cases run: 13)"`, Task 2's verify ran 9 cases and Task 3's 13.
2. **[Rule 2 - Correctness] Records that cannot be posted are held and listed** ('amount', 'mismatch'), so one bad record never stops the rest from posting and a stale or hand-edited line never puts a wrong figure on 2400. Commits 366626d, 0ceffc3; tests 2d1202d.
3. **[Rule 3] Case t4 gives fund A's two investors `onboarding: { status: 'complete' }`** before building schedule 06, which reads each investor's portal account; the fixture has none. The fixture file is not edited.
4. **[Rule 2] Exceptions carry `kind` and `wasDate`**, so the closed item holds both dates (the plan's closed example asks for both).

## Known Stubs

None.

## Threat Flags

None. T-11-13 (case closed), T-11-14 (case repeat), T-11-15 (by 'Portal (automatic)', src names the record) and T-11-16 (lines hold investor ids only; no bank or taxpayer number is read) are mitigated as the register states. No package installed.

## Commits

- b7cebd7 test(11-05): fund A posted from its records gives the research's trial balance (RED)
- fe4d4a6 feat(11-05): post calls, positions, paid distributions and monthly fees from their records
- 94d7128 test(11-05): engine tie, fees, withheld, the GP's share, start date, fund B redemptions, samples, no change log (RED)
- 366626d feat(11-05): post tax withheld, the GP's share, redemptions and their payment, crystallized carry; start date
- 1ca9708 test(11-05): case withheld also holds a stray line (11-CONTEXT W3)
- 85d8e10 test(11-05): repeat, changes in closed and open periods, selfcheck; marker at 13 cases (RED)
- 0ceffc3 feat(11-05): sync follows records in open periods and never rewrites a closed one
- 2d1202d test(11-05): records that cannot be posted as they stand are listed and leave the books alone
- plus the commit of this summary

Pushed only to wip/11-05. STATE.md, ROADMAP.md and REQUIREMENTS.md not touched. SCRATCH/exec-11-05 holds 860 KB of text outputs.

## Self-Check: PASSED

- FOUND: assets/js/books-post.js, checks/posting.js
- FOUND (ancestors of HEAD): b7cebd7, fe4d4a6, 94d7128, 366626d, 1ca9708, 85d8e10, 0ceffc3, 2d1202d
