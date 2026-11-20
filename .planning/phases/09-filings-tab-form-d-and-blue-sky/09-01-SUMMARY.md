---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 01
subsystem: filings
tags: [form-d, blue-sky, due-dates, federal-holidays, orders, gate]
status: complete

requires:
  - phase: 06-onboarding-forms
    provides: "checks/lib.js (runParts), the reference gate"
provides:
  - "assets/js/filings.js: NS.filings (record, offering facts, holidays, due dates, amendment test, silencing, prices, orders); loads in the browser and under Node"
  - "checks/filings-math.js: FILINGS MATH, 10 cases"
  - "checks/gate9.sh: the phase 9 gate and its --self-test"
affects: [09-02, 09-03, 09-04, 09-05, 09-06, 09-07, 09-09, 09-10]

actuals:
  tokens: 25249
  tasks: 3
  commits: 5
plan_head_before: 76cf3bb6082afa5bde3c8a4ace3dcf76a0ecee54
plan_head_after: 8a462ba08d46d8dda2d9f8f51599917ca7d77f90

tech-stack:
  added: []
  patterns:
    - "reminders are computed from stored facts on every call; only facts and silencing choices are stored"
    - "a phase 9 check declares its own last line in its first lines; gate9.sh runs it and compares"

key-files:
  created:
    - assets/js/filings.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-math.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/gate9.sh
  modified: []

key-decisions:
  - "A related person no longer named needs an amendment, like a new one: the Form D instructions exempt only a related person's address or relationship"
  - "The offering record's figures are laid over the filed snapshot only where the record holds a number: a blank cap or minimum in the portal is not a change in the offering"
  - "Investors whose state cannot be read from the address are reported in facts.unplaced and never silently treated as outside the U.S."
  - "A state table row is relied on only when it is confirmed, also when it says no notice is required"
  - "A reminder's level is measured to the calendar deadline before it is moved off a weekend or holiday, so a first notice is due from the day of the first sale; overdue is measured from the moved date"

requirements-completed: [D-04, D-05]

coverage:
  - id: D1
    description: "First Form D due 15 calendar days after the first sale, moved past weekends and federal holidays; nothing before a first sale, for mode none, or outside Rule 506"
    requirement: D-04
    verification:
      - kind: unit
        ref: "checks/filings-math.js --case first"
        status: pass
  - id: D2
    description: "Annual amendment from the latest accepted D or D/A; amendment for a change by the Form D instructions' thresholds; both stop once the offering has ended"
    requirement: D-04
    verification:
      - kind: unit
        ref: "checks/filings-math.js --case annual,change"
        status: pass
  - id: D3
    description: "Silencing per reminder and per offering; state first-notice and renewal reminders"
    requirement: D-04
    verification:
      - kind: unit
        ref: "checks/filings-math.js --case silence,states"
        status: pass
  - id: D4
    description: "Orders recorded with lines and the amount due at the fixed prices, pass-through fees as their own lines"
    requirement: D-05
    verification:
      - kind: unit
        ref: "checks/filings-math.js --case orders"
        status: pass
  - id: D5
    description: "Federal holidays: the rule of 5 U.S.C. 6103 (NOT compared with the published schedule: the host was blocked)"
    requirement: D-04
    verification:
      - kind: unit
        ref: "checks/filings-math.js --case holidays"
        status: pass
  - id: D6
    description: "Phase gate script that runs the reference gate and every phase 9 check, proven able to fail"
    verification:
      - kind: integration
        ref: "GATE_OUT=<folder> bash checks/gate9.sh --self-test; GATE_OUT=<folder> bash checks/gate9.sh"
        status: pass
---

# Phase 9 Plan 01: Filings record and due dates Summary

One pure module (`assets/js/filings.js`) that holds what was filed and ordered and works out every Form D and state reminder from those facts on each call, with its 10-case check and the phase gate script. No screen yet: the owner has seen none of this, and nothing here is called done.

## Failures and things not proven (first)

1. **The holiday dates were not read from the published schedule.** `www.opm.gov` is blocked from this session (the proxy refused the connection on 2026-11-19); `www.sec.gov` answered 403. Case `holidays` therefore proves the rule only (the eleven holidays of 5 U.S.C. 6103, Saturday observed on Friday, Sunday on Monday) against 33 dates for 2026 to 2028 typed by hand, and it prints a NOTE line saying so on every run. Someone with access to the page still has to compare those 33 dates (they are in the case, in `TYPED`) with https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/.
2. **Two of the nine Task 2 cases were not RED.** In the RED run `holidays` and `selfcheck` already passed: Task 1 had built the holiday rule (the tracer needs Thanksgiving), and `selfcheck` tests the runner. The other seven failed as required.
3. **A run of the extra sample test timed out once** waiting 15 minutes for a slot in the shared browser queue while the gate held it. It was run again after the gate and passed (below).
4. No check fails on this tree. No time estimate is given anywhere; measured wall-clock time for the plan, gate included: 75 minutes (15:57 to 17:12 UTC).

## Results, verbatim

Task 1 verify (`--case first`), last line:

```
FILINGS MATH: PASS (cases run: 1)
```

Task 2 verify (all cases), last lines:

```
PASS selfcheck a case list of blanks exits 1 with FAIL
PASS selfcheck the gate markers are the first two lines, and the second gives the last line of a full run
FILINGS MATH: PASS (cases run: 10)
```

186 PASS lines, 0 FAIL, and the NOTE line of item 1.

Task 3 verify, self-test last lines:

```
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
GATE9 SELF-TEST: PASS (5)
```

Task 3 verify, the full gate (`gate9.sh`), whole output:

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
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 197
# pass 197
# fail 0
GATE ok   server tests 197 = base 197 + 0 declared
GATE ok   FILINGS MATH
GATE_EXIT=0
```

RED runs kept in SCRATCH/exec-09-01:

- `red-1.txt` (before `filings.js` existed): `FAIL first ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/filings.js'`, last line `FILINGS MATH: FAIL (cases run: 1) - first`.
- `red-2.txt` (before the Task 2 code): 14 FAIL lines, last line `FILINGS MATH: FAIL (cases run: 10) - record, facts, annual, change, silence, states, orders`.

Two proofs beyond the plan, both in SCRATCH/exec-09-01 and neither committed:

- **Broken rules are caught** (`mutations.txt`, `gate-mutations.txt`). 16 rules in `filings.js` were broken one at a time (14 days instead of 15, a limit of 36, a rise of exactly 10 percent flagged, an approved subscription not a sale, pending investors counted, a holding and its request both counted, called capital instead of commitments, a Saturday holiday on the Monday, and so on): `MUTATIONS: 16 of 16 caught`. Six weakened copies of the gate script: `GATE MUTATIONS: 6 of 6 caught`.
- **The portal's own sample workspace, in the real page** (`smoke.txt`, `SAMPLE SMOKE: PASS`). Kestrel Bay, 23 investors, 3 offerings: every investor of every offering was placed in a U.S. state (11, 9 and 8 states; none unplaced, none abroad); reading wrote nothing to the workspace. The sample offerings name no exemption, so they have 0 reminders. With an exemption set in memory: 3 first Form D reminders (due 2019-10-15, 2023-05-01, 2024-07-16, all overdue) and 28 state reminders, 31 counted; a Form D recorded as filed took the count to 30 and gave an annual amendment due 2027-11-19; silencing one state took it to 29; an order was recorded at 10000 cents.

## What was built

- **`assets/js/filings.js`** (new shipped file; not yet in any page's script list, plan 09-03 adds it). `NS.filings`: `ensure`, `rec`, `applies`, `facts`, `holidays`, `businessDay`, `due`, `count`, `changeNeeded`, `silence`, `unsilence`, `PRICES`, `orderLines`, `addOrder`, `cancelOrder`, `setIssuer`, `setEdgar`, `recordFiled`, `recordState`. The header documents every shape. It touches no existing file, so the managed edition is unchanged (STATUS MATH's slice guard is green in the gate).
- **A1 (one definition of a sale)**: one list, built once per call, from which `firstSale`, `sold`, `investors`, `byState`, `outsideUS` (and `unplaced`) are all worked out. A subscription that is approved, funded or accepted counts at `r.cents / 100` on `r.decided`; a holding whose `ref` is not such a request counts at its commitment where it has one, otherwise its amount, on its date. Never both; redeemed holdings count; declined and pending subscriptions and redemptions never. Case `facts` holds the A1 case (an approved, unfunded subscription: `sold` 150,000, `investors` 1).
- **A2**: `nonAccredited: { count: accepted, pending, unanswered }`. Case: one accepted and one pending gives count 1, pending 1; and in `change`, 35 accepted plus 1 pending against 35 on the filed notice raises no reminder, 36 accepted does.
- **A3**: the annual and the change reminder are both absent once `rec.ended` is set and not after today (the day itself included); an end date still ahead changes nothing.
- **A4**: every row is in case `change`, including the base of 0 (written as multiplications, so nothing is divided).
- **A5**: `businessDay('2027-12-31')` is `2028-01-03`; `holidays(2027)` includes `2027-12-31` and has 12 days, `holidays(2028)` has 10.
- **A6, A7**: the gate drops the reference's own `server tests N` line without counting it, measures the base tree instead, and the self-test has the fifth stand-in; `GATE_OUT/gate/base-tree` and `GATE_OUT/gate/shots` are removed before the last line is printed.
- **A8**: every case loads the module itself, so a missing module prints a `FAIL` line.
- **Prices (D-05)**: Form D 10000, amendment 5000, state notices 10000 for any number of states, renewal 5000 (cents), frozen in `PRICES`; pass-through fees are their own lines at cost; a fee not yet confirmed has `cents: null`, adds nothing to `dueCents` and sets `openFees`.

## Task Commits

1. **Task 1 (tracer)**: `ceb5f34` (test, RED) and `87c3717` (feat)
2. **Task 2**: `8985881` (test, RED) and `1b6f3d5` (feat)
3. **Task 3**: `8a462ba` (gate script)

## Deviations from Plan

**1. [The instructions decide] A related person no longer named needs an amendment.** The plan lists only "a new related person". The Form D General Instructions exempt only "the address or relationship to the issuer of a related person", so a removal is a change that is not exempt. `changeNeeded` reports `relatedPersons` with `added` and `removed`. Commit `1b6f3d5`.

**2. [Rule 2] `facts.unplaced`.** An investor with a sale whose state cannot be read (no address, or a ZIP code with no state) would otherwise raise no state reminder and appear nowhere. They are counted in `unplaced` (same shape as a state's entry), so plan 09-07 can say so on screen. The state is read as a code or a full name, with or without the ZIP code, before a trailing "USA". `outsideUS` has the same shape `{ firstSale, sold, investors }`.

**3. [Rule 2] A blank in the offering record is not laid over the filed figures.** The plan lays the live minimum and total offering over the snapshot. Where the offering record holds no cap or no minimum, that item is left as filed: otherwise every sponsor who typed a total into the Form D without also typing it into the offering record would get a permanent, false "amendment needed".

**4. [Rule 2, T-09-01] The writers remove secret-like keys.** Beyond "no place for a CCC", anything stored through `recordFiled` (snapshot, draft, signoff), `addOrder` (package), `setIssuer` and `setEdgar` loses any key containing ccc, token, secret or password, at any depth. After every case the check also scans every workspace it built.

**5. An unconfirmed state row is never relied on**, also when it says no notice is required: the reminder stays, with no date.

**6. Levels with a moved date.** "Due from the first sale" cannot hold if the lead is measured to a date moved to Monday (17 days away). The lead is measured to the calendar deadline, overdue to the moved date.

**7. Small additions to the interface**: `facts.firstSaleSuggested` (the computed date beside the confirmed one); `orderLines` returns `{ lines, dueCents, openFees }`; a pass-through line keeps its `state`; `cancelOrder` also writes a change-log entry; a sale whose request has no `decided` date falls back to its `completed`, then `submitted` date; silence keys are refused when they name no known kind, offering or state.

**8. The gate script.** Beyond the plan: a stand-in run that passes ends `GATE_EXIT=0 (stand-in)`, so the self-test's switches can never produce the passing line of a real gate; the self-test runs a passing control beside the five failing stand-ins; a base tree left by an earlier run is removed before the reference runs; the gate fails when the reference prints no `GATE_EXIT` line or passes no step; the reference's count lines (`signing:`, `record:`, `# tests`) are passed through with its GATE lines.

**9. Orchestrator's instructions over the executor defaults**: STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched; nothing was written to the cross-phase ledger; the branch is pushed to `wip/09-01` only.

## Left for a follow-up

- Compare the 33 typed holiday dates with the published schedule (item 1 above).
- For plan 09-03, from the sample test: the sample offerings name no exemption, so the tab will be empty on the sample portal until one is set; and a long-running offering given an exemption shows a first Form D overdue since its first sale plus one reminder per state (31 counted on the sample). A sponsor who filed long ago needs a short way to record that (their own Form D, their own state notices) or the menu count is noise.
- State renewals keep showing after an offering has ended (the plan is silent; the annual and change reminders stop). To settle with plan 09-07's state data.
- Address reading has a limit worth knowing: a two-letter code with no ZIP code at the end of an address is read as a U.S. state unless the investor's record names another country.
- `rec.opened` is stored and not used by `due` (plan 09-03 uses it to list an offering before its first sale).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: assets/js/filings.js
- FOUND: .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-math.js
- FOUND: .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/gate9.sh
- FOUND commits: ceb5f34, 87c3717, 8985881, 1b6f3d5, 8a462ba (all ancestors of HEAD)
- Working tree clean after the gate; server/node_modules link removed; base tree and screenshots removed.
