---
phase: 10-investor-tax-documents-and-withholding
plan: 14
subsystem: phase gate (checks only)
tags: [gate, checks]
status: complete
requires: [10-01, 10-02]
provides:
  - "checks/gate10.sh: reference gate, server count against the base tree measured in the run, every phase 10 check found by marker; --self-test ending GATE10 SELF-TEST: PASS (5)"
affects: [10-03, 10-04, 10-05, 10-06, 10-07, 10-08, 10-09, 10-10, 10-11, 10-12, 10-13]
key-files:
  created:
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/gate10.sh
  modified: []
decisions:
  - "Phase 10 checks are judged on this checkout: gate10 unsets P10_ROOT for them (dist-record.js loads every case from P10_ROOT when set); the base tree is offered as P10_BASE"
  - "Base commit for this run: 5806681 (the commit this plan started from)"
metrics:
  completed: 2026-11-19
  tasks: 1
actuals:
  tasks: 1
  commits: 2
plan_head_before: 5806681e1f74c9f9c1540923d84c51590ade27bb
plan_head_after: see the docs commit of this summary
---

# Phase 10 Plan 14: gate10.sh Summary

Task 3 of 10-01-PLAN.md, split out by the plan checker (A4). One file: `checks/gate10.sh`. The owner has not checked this.

## Failures first

The full gate on tree e8e464b (base 5806681, the merged 10-01 + 10-02 + phase 11 tree) ended **`GATE_EXIT=1`**. Both failures are in the reference gate. This plan changed no product file.

1. **`GATE FAIL REAL FIRM (9)`**: this is the known check-side failure another agent is fixing. Parts contact-desktop and contact-phone fail because the footer now holds "Help". Parts documents-desktop and documents-phone fail because "after Approve and Countersign the investor holds the offering" (positions 0), and the six lines after it depend on that. Last line: `REAL FIRM: FAIL (parts run: 9) - contact-desktop, contact-phone, documents-desktop, documents-phone`. real-firm.js was not touched.
2. **`GATE FAIL EMAIL DIALOG (3)`**: the phone part saw 7 of 11 paragraphs whole in the frame. Run again alone through heavy.sh on the same tree, it ended `EMAIL DIALOG: PASS (parts run: 3)`. This is a timing failure under queue load, the same kind 11-04 recorded.

**Found in gate11.sh (phase 11's file, not changed here):** gate11 runs phase 10's checks with `P10_ROOT` set to the base tree. When `P10_ROOT` is set, dist-record.js loads assets/js for *every* case from it. So gate11 tests the base tree's data.js instead of this tree's. On any base that already holds 10-01, gate11 also fails case `sample`. Measured on 5806681 with `P10_ROOT=<extracted 5806681>`: `DIST RECORD: FAIL (cases run: 9) - sample` (`A8 names one figure: pellbrook:pb-long-short holders today are 16 ... (the base tree)`, got 15). Without P10_ROOT it ends `DIST RECORD: PASS (cases run: 9)`. K1 SPLIT and TAXDOCS MATH ignore P10_ROOT. Fix for phase 11: drop `P10_ROOT=` from gate11's run line and pass the base tree as `P10_BASE`, as gate10 does. Its self-test's phase 10 stand-in must change to match.

## Self-test (verbatim)

```
SELF-TEST ok   control: the stand-ins pass when nothing is wrong (judged on this checkout, base tree as P10_BASE; never the line of a real gate)
SELF-TEST ok   a check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
GATE10 SELF-TEST: PASS (5)
```

The control runs with `P10_ROOT` set by the caller. Two mutated copies were also run: one with the `env -u P10_ROOT` removed and one with the `P10_BASE=` removed. Each ended `GATE10 SELF-TEST: FAIL - control`.

## Full gate, last lines (verbatim)

```
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 314
# pass 314
# fail 0
GATE ok   server tests 314 = base 314 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   TAXDOCS MATH
GATE_EXIT=1
```

Earlier lines: every other reference step was ok, MEASURE included (the taxdocs.js leak that 11-04 reported no longer fails). The only GATE FAIL lines were EMAIL DIALOG (3) and REAL FIRM (9). After the run, `gate/base-tree`, the screenshots, `checks-out`, the owner's folder and the reference copy were gone, and no `server/node_modules` link was left. 680 KB of text output stays in SCRATCH/exec-10-14.

## What gate10.sh does

It is modelled on gate11.sh and gate9.sh (both carry the A6/A7 fixes): the same reference step, the same count step and the same marker rules.
1. It runs the reference gate itself. Only its `cd` and `O=` lines are rewritten, and each must appear exactly once or nothing is run. The reference's own "server tests N" line is dropped (so its `GATE_SERVER_TESTS` has no effect here), and every other GATE line passes through.
2. Server tests on this tree must equal the base tree's count, measured in the same run, plus the `// gate: tests N` markers of the server/test files changed since the base (markers at HEAD minus markers at the base).
3. It runs every `.js` file directly in `checks/` by its markers. `P10_ROOT` is unset and `P10_BASE=GATE_OUT/gate/base-tree`; `P6_OUT=GATE_OUT/checks-out` and `P6_SHOTS=GATE_OUT/shots`; browser checks go through heavy.sh. Each check's output goes to `GATE_OUT/gate/<name>.txt`.
4. After the verdict it cleans up, then prints `GATE_EXIT=0|1`.

## How later phase 10 plans add their checks (no edit to gate10.sh)

- Put the check directly in `.planning/phases/10-investor-tax-documents-and-withholding/checks/<name>.js`. Its first lines are `// gate: node` (or `// gate: browser`) and, within the first five lines, `// last "<exact last line of a full run>"`. Update that quoted line whenever cases are added. Helpers are marked `// gate: none`.
- A check that compares with the base reads the base tree from `process.env.P10_BASE`. Never read `P10_ROOT` for that: it means "load the code from here", and the gate leaves it unset so the code tested is this tree's.
- A new server test file declares itself with a first line `// gate: tests N`.
- Run the gate from the checkout root after the plan's first commit (the reference requires HEAD to have moved), with `SCRATCH/exec-10-NN/base-commit.txt` holding the plan's base commit: `GATE_OUT=SCRATCH/exec-10-NN bash .planning/phases/10-investor-tax-documents-and-withholding/checks/gate10.sh`. The last line must be `GATE_EXIT=0`. A full run takes a long time through the shared queue: run it in the background.

## Commits

- e8e464b feat(10-14): gate10.sh, the phase 10 gate, proven able to fail
- (this summary: a docs commit)

## Deviations from Plan

1. **[Rule 1 - Bug] P10_ROOT is unset for each check, and P10_BASE is added.** Task 3 does not mention P10_ROOT. The brief asked to stay consistent with gate11, but gate11's way of running dist-record.js judges the base's code and fails case `sample` (see above). I kept gate11's step rules and changed only how the base tree is passed. The self-test control proves it.
2. **Cleanup follows gate11.** Besides the plan's base-tree and shots folders, the gate also removes `checks-out` (both under GATE_OUT and GATE_OUT/gate), the owner's folder and the reference copy.
3. Not touched: STATE.md, ROADMAP.md, REQUIREMENTS.md, real-firm.js, gate11.sh.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: checks/gate10.sh; commit e8e464b is an ancestor of HEAD.
