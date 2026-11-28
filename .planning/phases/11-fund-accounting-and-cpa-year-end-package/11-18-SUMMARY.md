---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 18
subsystem: operations (seeded sample calls), phase 11 checks
tags: [businessDays, sample-data, change-log, audit-same, FA-03]
status: complete
requirements: [FA-03]
requires: [11-04, 11-08, 11-10]
decisions:
  - "AUDIT SAME recomputes the change log's Seq, Previous hash and Hash from the base's own entries (the log is a hash chain sorted by time) instead of allowing only the 'Capital call issued' rows (deviation from 11-CONTEXT line 108)"
  - "The console's negative 'Capital call notice (days)' input is left unchanged here; listed for the small-fixes follow-up"
metrics:
  completed: 2026-11-26
  duration: "19:47 to 21:53 UTC (first commit to the gate's last kept step), including two gate runs"
actuals:
  tokens: 10000    # chars/4 over the realized diff (40,021 bytes of git diff 5b85eee..744551b)
  tasks: 3
  commits: 6       # git rev-list --count 5b85eee..744551b at SUMMARY write; this summary's own commit follows
plan_head_after: 744551b8160b4cef676f3f4ea0c3a9157c7552e7
provides:
  - NS.ops.businessDays counts back for n < 0
  - checks/business-days.js (BUSINESS DAYS, 3 cases)
  - AUDIT SAME's moved-notice rule, built from the base
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/business-days.js
  modified:
    - assets/js/operations.js
    - assets/js/books-bank.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/audit-same.js
plan_head_before: 5b85eee7dcadad715c362fd06713095228e212d7
---

# Phase 11 Plan 18: the businessDays fix Summary

Seeded sample capital calls are now noticed ten business days before they are due (they were noticed on their due date), and AUDIT SAME allows exactly that change, built from the base, and still reports everything else. The owner has not checked it.

## Failures first

- Gate run 1 (GATE_EXIT=1): two phase 10 browser checks failed, in parts that do not touch this plan's files:
  `TAXDOCS FLOW: FAIL (parts run: 14) - confirm-phone` (`frame.waitForTimeout: Page crashed`) and
  `WITHHOLDING FLOW: FAIL (parts run: 9) - cancel, paper-w9` (`frame.evaluate: TypeError: Cannot read properties of
  undefined (reading 'abaValid')`, `frame.waitForSelector: Timeout 30000ms exceeded`). The browser slots were shared
  with other builds. Nothing was changed; the gate was run again into the same GATE_OUT and both checks passed in full
  (run 1's output kept in exec-11-18/gate-run1.txt).
- Not proven here: what the owner's stored preview shows. A stored sample workspace keeps its old calls and change log
  until the next preview build's reset (no migration: the log is append-only and never rewritten).

## Gate (GATE_OUT=SCRATCH/exec-11-18, base-commit.txt = 5b85eee, run 2; last lines verbatim)

```
GATE ok   base-server-tests (kept from 2026-11-26 21:16:56 UTC)
GATE ok   server tests 403 = base 403 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-26 21:20:16 UTC)
GATE ok   DIST RECORD (kept from 2026-11-26 21:20:18 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-26 21:20:40 UTC)
GATE ok   SHIPPED LIBS (kept from 2026-11-26 21:23:20 UTC)
GATE ok   TAX 1099 (kept from 2026-11-26 21:23:26 UTC)
GATE ok   TAX FORMS (kept from 2026-11-26 21:23:30 UTC)
GATE ok   TAX MATH (kept from 2026-11-26 21:23:32 UTC)
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH (kept from 2026-11-26 21:37:27 UTC)
GATE ok   TAXLINK FLOW (kept from 2026-11-26 21:40:45 UTC)
GATE ok   TAXRECORD FLOW (kept from 2026-11-26 21:41:33 UTC)
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT SAME (kept from 2026-11-26 21:44:07 UTC)
GATE ok   BANK FILES (kept from 2026-11-26 21:44:09 UTC)
GATE ok   BANK REC (kept from 2026-11-26 21:44:10 UTC)
GATE ok   BOOKS CORE (kept from 2026-11-26 21:44:11 UTC)
GATE ok   BUSINESS DAYS (kept from 2026-11-26 21:44:16 UTC)
GATE ok   ENGINE BOOKS (kept from 2026-11-26 21:44:17 UTC)
GATE ok   HOLDINGS (kept from 2026-11-26 21:44:18 UTC)
GATE ok   NO ONBOARDING (kept from 2026-11-26 21:44:18 UTC)
GATE ok   PDF OUT (kept from 2026-11-26 21:45:41 UTC)
GATE ok   POSTING (kept from 2026-11-26 21:45:43 UTC)
GATE ok   SAMPLES BOOKS (kept from 2026-11-26 21:45:49 UTC)
GATE ok   STATEMENTS (kept from 2026-11-26 21:45:50 UTC)
GATE ok   WORKBOOK (kept from 2026-11-26 21:53:03 UTC)
GATE_EXIT=0
```

64 GATE ok lines, 0 GATE FAIL. Server tests: 403 pass, 0 fail (base 403). Task 3's verify passed (no base tree, no
server/node_modules left).

## The changed sample data

Nine seeded calls, both editions (`kestrel-bay` and `pellbrook`; Ashwell Ridge and Greywater have no calls):

| call | status | due | notice before | notice after |
|------|--------|-----|---------------|--------------|
| kb-fund-ii-call-1 | complete | 2019-09-30 | 2019-09-30 | 2019-09-16 |
| kb-fund-ii-call-2 | complete | 2020-03-31 | 2020-03-31 | 2020-03-17 |
| kb-fund-ii-call-3 | complete | 2020-10-15 | 2020-10-15 | 2020-10-01 |
| kb-fund-ii-call-4 | complete | 2021-06-30 | 2021-06-30 | 2021-06-16 |
| kb-fund-ii-call-5 | complete | 2022-03-31 | 2022-03-31 | 2022-03-17 |
| pb-ventures-i-call-1 | complete | 2023-03-31 | 2023-03-31 | 2023-03-17 |
| pb-ventures-i-call-2 | complete | 2023-10-02 | 2023-10-02 | 2023-09-18 |
| pb-ventures-i-call-3 | complete | 2024-06-28 | 2024-06-28 | 2024-06-14 |
| pb-ventures-i-call-4 | complete | 2025-04-15 | 2025-04-15 | 2025-04-01 |
| pb-ventures-i-call-5 | open | 2026-11-12 | 2026-10-28 | 2026-10-28 (unchanged; from the config's open call) |

No other field of any call changed (AUDIT SAME compares the calls whole, with only these notices moved). Each call's
'Capital call issued' change-log row moved to its new notice date; its time of day is unchanged.

Measured against the base (exec-11-18/measure.js, today 2026-11-19, output measure.txt):

- Change log entries: Kestrel Bay 340 before and after, Pellbrook 509 before and after; none added or removed.
- Hashes differing: Kestrel Bay 339 of 340, Pellbrook 354 of 509 (every row after the first moved one). Rows whose Seq
  changed: Kestrel Bay 32, Pellbrook 40 (my count matches each base row to a tree row by time of day, action, record
  and detail; the planner's count for Kestrel Bay was 33). The same in both editions.
- Packages whose 15_Change_log.csv changed: 34 of 60 (kb-fund-ii, kb-harlow, kb-note-24a, pb-ventures-i,
  pb-long-short, pb-digital, pb-multi, pb-spv-quillon for 'fy' and 'itd', and pb-ventures-ii 'itd', in both editions),
  each with its MANIFEST line. Every other schedule of all 60 packages: 0 changed. The other 26 packages are
  byte-identical as whole files (AUDIT SAME, red-2.txt).
- The README and the readiness rows did not change (entry counts and "Chain verified" stay).
- Real firms are never seeded, so only sample firms change.

AUDIT SAME run time against the base, all four cases: 32.3 s wall clock (Node, this container).

## Deviations from Plan

1. [Plan-recorded] 11-CONTEXT line 108 says the expected difference names "only the 'Capital call issued' rows and
   their MANIFEST lines". The change log is a hash chain sorted by time, so every later row's Seq, Previous hash and
   Hash change too. The rule recomputes those columns from the base's own entries with the chain rule (proven on the
   base's hashes in selfcheck) instead of skipping them, so every byte is still compared with an exact expectation.
2. [Plan-check W1, W2, W3 applied] selfcheck adds "notice rule base: firmExpect of this tree's own Kestrel Bay and
   Pellbrook is null" and reported proof (g); 8 "notice rule reported" PASS lines; the same.txt step ran with
   GATE_FRESH=1.
3. [Additions within the rule, stricter than the plan] firmExpect also reports a moved call whose one base
   'Capital call issued' row is not dated its notice, and expectedLog reports a base log row missing from the base's
   log. firmCheck compares the tree's calls with the moved notices put in place, so a wrong notice is reported once as
   "calls: <id> notice ..." and anything else as "differs beyond the moved notices".
4. [Commit shape] The rule's code landed in a419f2d, a save commit made before the long run (save rule 2); 2fd4f38 is an
   empty commit carrying the feat(11-18) message and the verified result. No force push was used.
5. [Labels] business-days.js also checks that the four sample firms are seeded in each edition (label
   "seeded <edition>: the four sample firms are seeded ...").
6. [Not done here, by instruction] STATE.md, ROADMAP.md and REQUIREMENTS.md were not updated: the orchestrator limited
   this run to the plan's files_modified and this summary.

## Open, for the orchestrator (not changed here)

- The console's suggested due date, `OPS().businessDays(today(), callDays(o))` (console.js callDraft and the
  offering-change handler), takes the offering's "Capital call notice (days)", and intake.js keeps a negative value a
  sponsor types. After this fix, a negative value suggests a due date that many business days before today (before
  the fix it suggested today). The sponsor sees the date and can change it before issuing. Validate the field (whole
  number 1 or more) in the small-fixes follow-up.
- Owner check (the plan's human check): in the published preview, after the next build's reset, the Kestrel Bay sample,
  Capital calls: Fund II call 1 shows notice Sep 16, 2019 and due Sep 30, 2019, in the console and in an investor's
  portal; the other sample calls likewise two weeks before their due dates. Not checked by the owner yet.

## Commits

- 9e2b05e test(11-18): BUSINESS DAYS check for counting back and the seeded notices (RED)
- ee65c5b fix(11-18): businessDays counts back for a negative n
- a4fea72 test(11-18): AUDIT SAME selfcheck proofs for the moved-notice rule (RED)
- a419f2d wip(11-18): save (holds the rule's code)
- 2fd4f38 feat(11-18): AUDIT SAME declares the moved notices, built from the base
- 744551b docs(11-18): summary draft with the RED outputs
- (this summary's final commit follows)

## RED outputs (on the unchanged code, before each fix)

### red-1.txt: `node checks/business-days.js` on 5b85eee (before the operations.js fix)

```
FAIL back businessDays('2026-03-16', -10) is '2026-03-02' (two weeks back, across two weekends) :: got 2026-03-16
FAIL back businessDays('2026-03-16', -1) is '2026-03-13' (Monday to Friday, across a weekend) :: got 2026-03-16
FAIL back businessDays('2026-04-01', -3) is '2026-03-27' (across a month end and a weekend) :: got 2026-04-01
FAIL back businessDays('2026-01-05', -2) is '2026-01-01' (across a year end; no holidays, the same count as audit.js weekdayBack and books-bank.js businessBack) :: got 2026-01-05
FAIL back businessDays('2026-03-15', -1) is '2026-03-13' (from a Sunday) :: got 2026-03-15
PASS sweep forward: n 1 to 15 gives the oracle's day (3287 days, 49305 counts)
FAIL sweep back: n -1 to -15 gives the oracle's day (3287 days, 49305 counts) :: 49305 mismatches; first: (2019-01-01, -1) gave 2019-01-01, expected 2018-12-31; ...
PASS sweep zero: n 0 gives the day itself (3287 days)
FAIL seeded diy kestrel-bay: kb-fund-ii-call-1 (due 2019-09-30) is noticed 2019-09-16, ten business days before it is due :: notice 2019-09-30
FAIL seeded diy kestrel-bay: the change log's one 'Capital call issued' row for kb-fund-ii-call-3 is dated 2020-10-01 :: ["2020-10-15T12:26:36Z"]
... (36 FAIL seeded lines in all: 9 notices and 9 log rows, in each edition; 20 PASS seeded lines: the firm set, the
    complete-call sets, pb-ventures-i-call-5 open with notice 2026-10-28, NS.audit.verify ok for all four firms)
BUSINESS DAYS: FAIL (cases run: 3) - back, sweep, seeded
```

GREEN after the fix (bd.txt): `BUSINESS DAYS: PASS (cases run: 3)`, 64 PASS, 0 FAIL. `git diff --numstat 5b85eee -- assets/js`: `1 1 assets/js/books-bank.js`, `2 1 assets/js/operations.js`.

### red-2.txt: the old audit-same.js `--case same` against the base (5b85eee), on the fixed tree

```
PASS same tree side loads the scripts this tree's page adds after operations.js: none
FAIL same diy: every schedule, period figure and package entry the base builds is the same in this tree (464 schedules, 30 packages of 15 funds) :: ["diy kb-fund-ii fy: log; zip 15_Change_log.csv: bytes differ (base fa452985e725, tree 9706596e984d); zip MANIFEST.sha256: the line for 15_Change_log.csv differs","diy kb-fund-ii itd: log; zip 15_Change_log.csv: bytes differ (base fb97e8782808, tree 6b31c7051824); ...","diy kb-harlow fy: log; ...
FAIL same managed: ... ["managed kb-fund-ii fy: log; zip 15_Change_log.csv: bytes differ (base ba848086d7b3, tree 7c3fb541b86a); zip MANIFEST.sha256: the line for 15_Change_log.csv differs", ...
PASS same diy run twice: the same 494 hashes
compared 928 schedules and 60 packages (26 byte-identical as whole files) of 15 funds
AUDIT SAME: FAIL (cases run: 1) - same
```

### red-2b.txt: `--case selfcheck` with noticeRules added, before the rule existed

```
PASS selfcheck ... (the 14 existing flag and zipRules checks pass)
FAIL selfcheck ran to the end :: ReferenceError: firmExpect is not defined
AUDIT SAME: FAIL (cases run: 1) - selfcheck
```

## Task 2 verify (same.txt, GATE_FRESH=1, against the base 5b85eee; 32.3 s wall clock for all four cases)

```
expected differences built from the base (diy): kestrel-bay 5 (kb-fund-ii-call-1 2019-09-30 -> 2019-09-16, kb-fund-ii-call-2 2020-03-31 -> 2020-03-17, kb-fund-ii-call-3 2020-10-15 -> 2020-10-01, kb-fund-ii-call-4 2021-06-30 -> 2021-06-16, kb-fund-ii-call-5 2022-03-31 -> 2022-03-17); pellbrook 4 (pb-ventures-i-call-1 2023-03-31 -> 2023-03-17, pb-ventures-i-call-2 2023-10-02 -> 2023-09-18, pb-ventures-i-call-3 2024-06-28 -> 2024-06-14, pb-ventures-i-call-4 2025-04-15 -> 2025-04-01)
PASS same diy: every schedule, period figure and package entry the base builds is the same in this tree, or exactly the expected difference above (464 schedules, 30 packages of 15 funds)
(the same line for managed)
PASS same diy run twice: the same 494 hashes
PASS mutate the one-cent change is reported as a mismatch naming the fund, the period and at least one schedule id
PASS selfcheck notice rule base: ... (4 lines), notice rule allowed: ... (5 lines), notice rule reported: (a) to (g) (8 lines)
AUDIT SAME: PASS (cases run: 4)
```

The base code with this tree's checks (unfixed.txt): `AUDIT SAME: FAIL (cases run: 1) - same`, starting `"diy kestrel-bay: calls: kb-fund-ii-call-1 notice 2019-09-30, expected 2019-09-16"`, then the other four calls, `change log: seq 2 at differs from the expected`, and `zip 15_Change_log.csv: not the bytes the expected difference gives (base fa452985e725, expected 9706596e984d, tree fa452985e725)`. The expected hash 9706596e984d is the hash the fixed tree produced in red-2.txt: the rule rebuilt from the base gives the fixed tree's bytes exactly.

## Self-Check: PASSED

All four files exist; all six commits (9e2b05e, ee65c5b, a4fea72, a419f2d, 2fd4f38, 744551b) are ancestors of HEAD; no stub or placeholder in the changed files.
