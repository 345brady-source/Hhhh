---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 07
subsystem: fund accounting (the capital-account engine reads the journal)
status: complete
tags: [ledger, capital-accounts, nav, carried-interest, opening-balances, fa-03, fa-05, f-3]
requires: ["11-01 (books.js)", "11-04 (load11.js, gate11.sh, AUDIT SAME)", "11-05 (books-post.js)", "10-01 (stored distribution lines)"]
provides:
  - "NS.audit.generated(o), NS.audit.events(ws, o); ledger reading the journal for funds that are not sample funds"
  - "checks/engine-books.js: ENGINE BOOKS (8 cases); fixtures fund-b.js, fund-c.js, fund-d.js"
  - "index.html, diy.html, portal.html load books.js and books-post.js"
affects: [11-08, 11-09, 11-10, 11-11, 11-12, 11-13]
tech-stack:
  added: []
  patterns:
    - "generated(o) (an offering among tenants.js's seeds) is the one switch between the generator and the journal"
    - "every split is largest(); no new allocator"
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/engine-books.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-b.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-c.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-d.js
  modified:
    - assets/js/audit.js
    - assets/js/books-post.js
    - index.html
    - diy.html
    - portal.html
decisions:
  - "Gains are read from every account of type gain (6000 and 6100 in the chart, plus any gain account a fund adds); income from every income account and every expense account except 5000"
  - "A fund that is not a sample fund gets no generated side-pocket return (its gains are the journal's)"
  - "Cases whose behaviour Task 1's code provides (fund-b, terms, probe, t8) were written and run with Task 1's RED, before any engine code"
metrics:
  duration: "not measured"
  completed: 2026-11-20
estimate:
  tokens: 98000
  tasks: 3
actuals:
  tokens: 14100
  tasks: 3
  commits: COMMITS_PLACEHOLDER
plan_head_before: a2f61064cada89902b68aa042ee88d7c85a58f62
plan_head_after: HEAD_PLACEHOLDER
---

# Phase 11 Plan 07: The capital-account engine reads the journal Summary

For every fund that is not a sample fund, the capital accounts now come from the journal: each month's income and gains are the journal's amounts in whole cents, split with the engine's largest-remainder rule. A fee, carried interest or preferred return the sponsor never set is not charged. Carried interest paid with a distribution is now the general partner's distribution in the month it is paid (F-3). An opening entry sets each investor's capital for a fund that existed before its books. Hand-worked funds A, B, C and D tie to the cent at every month-end. The 15 sample funds are unchanged (AUDIT SAME). The owner has not checked this.

## Failures and weak points first

GATE_FAILURES_PLACEHOLDER

- **Not every check failed first.** Case `t8` passed before any code, because fees on commitments are the same under the generator. It guards existing behaviour. A mutation proves it can fail: the engine fee +1 cent in June gives `ENGINE BOOKS: FAIL (cases run: 1) - t8` (mut-t8.txt). The managed-edition check in case `fund-a` was added after the code (commit 2879ea3). The selfcheck child-process rules passed before the code; only the three page checks failed first.
- **Fund C's March and April lines in red-2 failed only because `gpRun` did not yet exist** (the figures matched). The real failures before the code were May and June: May ended with NAV 1,000,000 against the journal's 0; June accrued 200,000 again, with carry -800,000.
- **The probe's "before" figures differ from 11-RESEARCH.md.** The research wrote a loss of $20,805.98 and fees of $6,000.00. The base tree measured on this probe (two investors, $100,000 and $300,000 on 2025-02-03, Real estate fund type, today 2027-01-20) gives gains of -$146.58 and fees of $5,500.00 (11 months at 1.5% of $400,000). The research probe was set up differently. Both "before" figures are invented, and both become 0.
- **Still invented for a real fund until plan 11-11:** holdings, cash and bank references on the Audit page (holdingsAt still splits NAV by weights). Two existing engine rules can also still put a figure into a real fund's capital that is not in the journal: the exit true-up (gain += A - pre in the exit month) and the floor at zero (a loss larger than capital). Neither is exercised by funds A to D. Both are noted for 11-09 and 11-11.
- I1 of 11-CONTEXT: books-post's `plan()` still reads `NS.audit.ledger` for fees, the GP's entries, distributions and redemptions; only contributions come from `NS.audit.events`. There is no loop in the values, because 5000, 2100, 2600 and 3300 are left out of the engine's income and gain reads.

## Verify and gate lines (verbatim)

Task 1 (the plan's verify):
```
PASS fund-a T7: the investors' income, gains, fees and carry plus the general partner's carry = the journal's 2026 results (7,650,000)
PASS fund-a 2026 by investor: income 800,000 - 500,000 legal and 400,000 - 250,000; gains 6,000,000 and 3,000,000; fees 1,200,000 and 600,000
ENGINE BOOKS: PASS (cases run: 1)
VERIFY1 OK
```
Task 2 (`SCRATCH/exec-11-07/verify2.sh`, the plan's command):
```
  probe after (this tree), fiscal 2025: income $0.00, gains $0.00, fees $0.00, carry $0.00, ending capital PR-1 $100,000.00, PR-2 $300,000.00
PASS probe fiscal 2025: income 0, gain 0, fee 0, carry 0
PASS probe ending capital 10,000,000 and 30,000,000
ENGINE BOOKS: PASS (cases run: 7)
VERIFY2 OK
```
Task 3 (`SCRATCH/exec-11-07/verify3.sh`, the plan's command, which runs the full phase gate):
```
GATE_PLACEHOLDER
```

## RED evidence (SCRATCH/exec-11-07)

- red-1.txt (before any engine code; fund-a, fund-b, terms, t8, probe): `FAIL fund-a B2 ... {"before":597174,"after":597174}`, `FAIL fund-a T3 ... {"k":"2026-03","journal":43800000,"lp":52886351,...}`, December capital 36,079,819 / 18,039,909, T7 engine 10,019,728 against journal 7,650,000; fund-b January gain 1,141,706 (want 3,000,000), NAV 101,141,706; terms rate 0.02 when unset, carry 0.2 / pref 0.08 when unset, `generated` missing; probe gain -14,658 and fee 550,000. Last line `ENGINE BOOKS: FAIL (cases run: 5) - fund-a, fund-b, terms, probe`.
- red-1b-nokey.txt (journal reads in, cache key not yet changed, B2): `FAIL fund-a B2 ... {"before":0,"after":0}`. Every other fund-a check passed. Last line `ENGINE BOOKS: FAIL (cases run: 5) - fund-a, terms`.
- red-2.txt (Task 1's code; fund-c, fund-d added): fund-c May `{"pre":1000000,...,"carryEnd":1000000,"gpOut":0,"nav":1000000}`, June carry -800,000 and accrued 200,000, T3 off from May; fund-d December 2025 at 60,000,000 / 30,000,000 (want 70,000,000 / 35,000,000), engine NAV 90,000,000 against journal 105,000,000. Last line `ENGINE BOOKS: FAIL (cases run: 7) - fund-c, fund-d`.
- red-3.txt (selfcheck before the page lines): each page `{"books":0,"post":0,"next":["<script src=\"assets/js/eligibility.js\"></script>",...]}`. Last line `ENGINE BOOKS: FAIL (cases run: 8) - selfcheck`.
- Mutations (each file restored from git afterwards): mut-t8.txt (engine fee +1 cent in June) gives `FAIL (cases run: 1) - t8`; mut-gp.txt (books-post gp: entry posts gpOut, not gpOut - gpRun) gives `FAIL fund-c T3 ... "na":-1000000` and `FAIL fund-c no gp: entry is posted`.

## Hand-worked funds the check holds to the cent

- **Fund A:** journal net assets = LP capital at all twelve 2026 month-ends (44,850,000 ... 51,750,000), GP 0. December FA-1001 34,500,000, FA-1002 17,250,000. T7 = 7,650,000. 2100 at the month-ends 150,000 · 300,000 · 0 · ... · 450,000. 5000 each month = the engine fee, 150,000. B2: posting mark:fa-m2 moves December's gain by 3,000,000 with no cache clear. The managed edition gives identical monthly figures and trial balance.
- **Fund B** (open-ended, today 2026-03-05): January gain 3,000,000, fee 100,000, before incentive 102,900,000, incentive 580,000, B-1001 102,320,000, NAV 102,900,000. February -1,007,616 / -492,384, fees 102,320 / 50,000, B-1001 101,790,064 before incentive, 358,013 incentive, ends 101,432,051; B-1002 49,457,616. NAV 151,247,680 = journal at both month-ends.
- **Fund C** (F-3): March before carry 15,000,000, accrued 1,000,000, C-1001 14,000,000, NAV 15,000,000. April gain 0, NAV 15,000,000. May before carry 0, accrued 0, gpOut 1,000,000 = gpRun, carry allocated 0, NAV 0 = journal. June accrued 0. 2026: contributions 10,000,000, distributions 14,000,000, gains 5,000,000, carry 1,000,000, GP distributions 1,000,000, both ends 0. The roll check passes; T3 holds every month. The run entry is [3100 +14,000,000 C-1001][1000 -14,000,000][3300 +1,000,000][1000 -1,000,000]; no gp: entry is posted.
- **Fund D** (opening balances): 33 months to November 2025 at 60,000,000 / 30,000,000. December 2025 at 70,000,000 / 35,000,000 (gains 10,000,000 / 5,000,000), NAV 105,000,000 = journal. June 2026 dividend 2,000,000 / 1,000,000, capital 72,000,000 / 36,000,000, NAV 108,000,000 = journal. T3 holds December 2025 to December 2026. The only entry before 2026-01-01 is open:fund-d.
- **Terms:** with mgmtFee unset, the rate is 0 and no 5000 entry is posted; '2' charges 100,000 / 50,000 a month. With carry and pref unset, both are 0, and carry is 0 even with 9,000,000 of gains. All 15 sample offerings' settings are JSON-equal to the base tree's. Every sample offering is generated; funds A and B and the probe are not.
- **Probe** (FA-03), fiscal 2025. Before (base tree, measured): income $0.00, gains -$146.58, fees $5,500.00, carry $0.00, ending capital PR-1 $98,588.36 and PR-2 $295,765.06. After: income, gains, fees and carry $0.00; ending capital $100,000.00 and $300,000.00.

## What changes for whom

- Sample funds: nothing. AUDIT SAME covers 15 funds in both editions.
- Every other fund, in both editions: income and gains are the journal's, so they are zero until something is recorded and generated gains disappear. An unset fee, carry or preferred return stops being charged. Holdings, cash and bank references on the Audit page still come from weights until plan 11-11.
- Lines added to each of index.html, diy.html and portal.html, directly after `<script src="assets/js/operations.js"></script>`:
  ```
  <script src="assets/js/books.js"></script>
  <script src="assets/js/books-post.js"></script>
  ```
  No control or menu item is added; nothing calls sync on page load yet.

## Interfaces as built

- `NS.audit.generated(o)`: true when the offering is one of tenants.js's seeds.
- `NS.audit.events(ws, o)` returns `{ S, invs, contribs, dists, strays, gpRuns, now }`. `contribs` keeps L.contribs' shape (`{date, inv, cents, kind, ref, call, pct}`). `strays` is added beyond the plan's block (the ledger needs it). `gpRuns[investorId] = [{date, cents}]` is split over each run's lines with gross > 0 using largest(Math.round(run.gp), ...).
- `ledger`: the cache key adds `:<journal length>` for a fund that is not generated (B2). `L.returns[k]` for those funds is `{ income: 0, gain: 0, sleeves: null, incomeCents, gainCents }`. `F.gpRun` is new on every month (0 for sample funds).
- F-3: `g` comes out of pre; `A = max(0, prevA - g)` unless a waterfall month or the open-ended formula sets it; `out += g`; `carryChg = A - prevA + g`. The accrued share and the open-ended high-water mark reset only on a crystallization (`crystal`, the out before g).
- Opening: the live `open:<offeringId>` entry, read with NS.books.live (a reversed opening entry no longer counts).
- books-post.js: contributions come from `NS.audit.events(ws, o).contribs`; a gp: entry posts `F.gpOut - F.gpRun`.

## Deviations from Plan

1. **[RED order] Cases fund-b, terms, probe and t8 were written in Task 1's check commit** (18dfbb4), with the fund B fixture, not in Task 2. Task 1's code (journal reads and unset terms) is what makes them pass. Written in Task 2, they would have passed without ever failing. Task 2's RED holds fund-c and fund-d.
2. **[Rule 2] Gains read from all accounts of type gain, income from all income accounts and every expense account except 5000.** The plan names 6000 and 6100 only. This is the same set for the template chart, and T3 still holds if a fund adds an account.
3. **[Rule 2] No generated side-pocket return for a fund that is not generated.** The side pocket's random quarterly return was a seeded generator in a real fund's capital (FA-03). A real fund's gains are now only the journal's.
4. **[Rule 1] Guards for a fund whose first contribution falls in the current month** (no completed month): the journal read and the opening rule are skipped when L.keys is empty. The read would otherwise crash.
5. **The t8 list of 2100 balances is written once in engine-books.js**, because fixtures/fund-a.js (not this plan's file) does not hold it. The fixture's `lpCapital` is what the plan calls expect.monthEnd.
6. **Case fund-a also checks the managed edition** (must-have: the managed edition's real firms change exactly as the self-serve edition's). This was added after the code.

## Known Stubs

None.

## Threat Flags

None. T-11-19 is covered by case probe and case terms (generated only for seeds). T-11-20 is covered by T3 and T7 for funds A to D. T-11-21 is covered by AUDIT SAME in the gate. No package is installed.

## Files a preview build must add

assets/js/books.js and assets/js/books-post.js (already in the repository; this plan makes index.html, diy.html and portal.html load them). No other new runtime file.

## Commits

- 18dfbb4 test(11-07): fund A ties to its journal every month; fund B, unset terms, fee accrual and the probe (RED)
- d7c02bf feat(11-07): a fund that is not a sample fund takes its income and gains from its journal
- 04b0389 test(11-07): fund C (the GP's share paid with a distribution) and fund D (opening balances) (RED)
- e0f9068 feat(11-07): the GP's share paid with a distribution leaves capital (F-3); opening balances; the event list
- c3e2f97 test(11-07): selfcheck: the check's own rules and the three pages loading the books (RED)
- 6f838bc feat(11-07): both editions load the journal and the posting module
- 2879ea3 test(11-07): fund A gives the same figures in the managed edition as in the self-serve edition
- plus the commit of this summary

Pushed only to wip/11-07. STATE.md, ROADMAP.md and REQUIREMENTS.md not touched; no 11-08 file edited.
