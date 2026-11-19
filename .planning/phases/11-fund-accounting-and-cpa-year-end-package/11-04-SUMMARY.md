---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 04
subsystem: checks
tags: [gate, regression, audit-package, fund-accounting]
status: complete
requires: []
provides:
  - "checks/gate11.sh: the phase 11 gate (reference gate, server count against the base measured in the run, phase 10 checks, phase 11 checks), --self-test ending GATE11 SELF-TEST: PASS (6)"
  - "checks/load11.js: loadPortal(root, { today, edition, extra }) and sampleWorkspaces(NS) for every phase 11 Node check"
  - "checks/audit-same.js: AUDIT SAME (4 cases), T9: the 15 sample funds' audit packages compared byte for byte with the base tree"
affects: [11-05, 11-06, 11-07, 11-08, 11-09, 11-10, 11-11, 11-12, 11-13, 11-14, 11-15, 11-16, 11-17]
tech-stack:
  added: []
  patterns: ["vm-loaded portal scripts read from diy.html at run time", "base tree against this tree, byte for byte"]
key-files:
  created:
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/load11.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/audit-same.js
  modified: []
decisions:
  - "AUDIT SAME's tree side also loads the scripts this tree's diy.html lists after operations.js that the base's diy.html does not list (derived from the two pages), so the comparison runs what the page runs once a later plan adds books.js after operations.js"
  - "The package comparison allows, beyond W4's list, only what a readiness check the base lacks adds (its checks row, its README READINESS line and exception items, the checks file's CONTENTS row count), matching the interfaces block's rule for schedule 'checks'; each allowance and each refusal is proven in case selfcheck"
  - "P11_ROOT equal to this checkout is refused like a missing P11_ROOT"
metrics:
  duration: "build 18:50-19:03 UTC; full gate 19:03:00-20:19:41 UTC (76 min 41 s, mostly waiting in the shared browser queue)"
  completed: 2026-11-19
estimate:
  tokens: 62000
actuals:
  tokens: 12059
  tasks: 2
  commits: 3
plan_head_before: 211ad705f245243a207f85c8886e43a92bebfdd7
plan_head_after: 0dfa16e971d7cbc436df4aef8237fe1117780c12
---

# Phase 11 Plan 04: gate11.sh, load11.js and AUDIT SAME Summary

One command now judges every later phase 11 plan (reference gate, server count measured against the base tree, phase 10's checks, phase 11's checks), and every sample fund's whole audit package (each schedule, the period figures and every entry of the exported zip) is compared byte for byte with the base tree; both are proven able to fail. The owner has not checked this.

## Failures first

**The full gate ended `GATE_EXIT=1`, not `GATE_EXIT=0`.** Two reference steps failed; every phase 10 and phase 11 check, the server count and the other reference steps passed. This plan changed no product file (its diff from 211ad70 is three new files in this phase's checks folder), so both failures belong to the base tree:

1. **`GATE FAIL MEASURE`**: walks A, B and C pass; the `leak` part reports `1 place(s) with a run of eight words from the owner's documents ... assets/js/taxdocs.js:531` (phase 10's electronic-delivery notice wording, commit 324b5ce). Every gate run on this base will fail MEASURE until that wording is rewritten or the run is put on the leak allow-list by whoever owns it. Logged in `deferred-items.md`. Not fixed here: outside this plan's files and a product-text decision.
2. **`GATE FAIL EMAIL DIALOG (3)`**: part `phone`, `phone-390x844-frame520px`: 10 of 11 paragraphs seen whole (the paragraph starting "The link below takes you through everyth" was not). Rerun alone through heavy.sh on the same tree: `EMAIL DIALOG: PASS (parts run: 3)`. A timing failure under queue load, not a code difference.

So the plan's verify line `test "$(tail -n 1 gate.txt)" = 'GATE_EXIT=0'` does not hold on this base, and it will not hold for any phase 11 plan until item 1 is resolved.

The cleanup commit 0dfa16e (gate11 also removes `checks-out` and the owner's folder) came after the full run. It was checked with the self-test (`GATE11 SELF-TEST: PASS (6)`) and on a stand-in folder (every listed folder gone), not with a second full gate run.

## Gate lines (verbatim)

`GATE_OUT=SCRATCH/exec-11-04 bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh`, its whole output (32 lines):

```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE FAIL MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE FAIL EMAIL DIALOG (3)
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
GATE ok   K1 SPLIT
GATE ok   TAXDOCS MATH
GATE ok   AUDIT SAME
GATE_EXIT=1
```

Self-test (after the cleanup commit):

```
SELF-TEST ok   control: the stand-ins pass when nothing is wrong (base tree passed as P10_ROOT and P11_ROOT; never the line of a real gate)
SELF-TEST ok   a phase 11 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
GATE11 SELF-TEST: PASS (6)
```

## What was measured

- AUDIT SAME, full run (`P11_ROOT=SCRATCH/exec-11-04/base-src`): 928 schedules and 60 packages compared, 60 of 60 packages byte-identical as whole zip files, over 15 funds (4 sample firms: Kestrel Bay 3, Ashwell Ridge 3, Greywater 3, Pellbrook 6), both editions, presets fy (2025-01-01 to 2025-12-31) and itd, today 2026-11-19. Per edition: 464 schedules, 30 packages. I1: the diy comparison run a second time in fresh contexts gave the same 494 hashes. Last line `AUDIT SAME: PASS (cases run: 4)`.
- Case mutate: kb-fund-ii-2026-09-24's total one cent larger (the sample runs have no stored lines yet, so W7's "otherwise" branch). Reported: `diy kb-fund-ii itd: al, chg, rollforward, register, activity, bank, soi, fvh, l3, carry, perf, log, checks`. The fy preset does not contain that date, so only itd is hit. Kestrel Bay's two other funds differ only in the firm-wide change log (schedule `log` and its zip entry), which the case allows and nothing else.
- Case selfcheck: an unknown `--case` name and an empty list each exit 1 with a FAIL line; a package rebuilt from a real export's own entries is byte-identical to the export (the rebuild is faithful); allowed: a changed "Generated:" line, a schedule the base lacks with its CONTENTS and MANIFEST lines, a readiness check the base lacks; reported: one changed character in 01_Statement_of_assets_and_liabilities.csv, a changed README line, a readiness line no new check explains, a dropped entry, an entry that is not a new schedule, a wrong MANIFEST line for a new schedule and for a base entry, a changed checks row the base holds.
- Case noroot: P11_ROOT unset, P11_ROOT equal to this checkout and P11_ROOT holding no portal each print `FAIL no base tree ...` and exit 1.
- Gate self-test: `GATE11 SELF-TEST: PASS (6)`. The control's W5 claim was also proven by mutation: a copy of gate11.sh with `P10_ROOT=` removed, and one with `P11_ROOT=` removed, each end `GATE11 SELF-TEST: FAIL - control`.
- Phase 10 checks the tree holds: k1-split.js (`K1 SPLIT: PASS (cases run: 7)`), taxdocs-math.js (`TAXDOCS MATH: PASS (cases run: 9)`); k1-build.js is marked none and skipped.
- Scripts load11.js loads (read from diy.html at run time, same list on both sides today): edition.js brand.js tenants.js data.js workspace.js nacha.js charts.js app.js documents.js portal.js engrave.js onboarding.js structures.js audit.js operations.js. The file that defines NS.inviteFlow.taxOnFile (onboarding.js, found by search) is already among them. Stand-ins: window (the context's global), location, localStorage and sessionStorage in memory, an inert document with readyState "loading" (app.js waits for a DOMContentLoaded that never comes, so the page never starts), history, navigator, TextEncoder/TextDecoder, URLSearchParams, timers, console.

## RED evidence

- `SCRATCH/exec-11-04/red-1.txt` (Task 1, before load11.js existed): `FAIL same ran to the end :: Error: Cannot find module './load11.js'`, `FAIL mutate ran to the end :: ...`, `AUDIT SAME: FAIL (cases run: 2) - same, mutate`.
- `SCRATCH/exec-11-04/red-2.txt` (Task 2, before the self-compare refusal): `FAIL noroot P11_ROOT is this checkout: a FAIL line and exit 1 (exit 0)`, `AUDIT SAME: FAIL (cases run: 4) - noroot`.
- The gate script itself has no separate RED file: its six stand-in faults are its proof that it fails, and the two mutated copies above prove the control catches a missing base-tree variable.

## Commits

- c5a9031 test(11-04): load11.js loader and AUDIT SAME tracer on Kestrel Bay
- 26ad698 feat(11-04): gate11.sh and AUDIT SAME over all 15 sample funds (4 cases)
- 0dfa16e fix(11-04): gate11 also removes checks-out and the owner's folder after the verdict
- (this summary and deferred-items.md: a separate docs commit)

## Deviations from Plan

**1. [Rule 3 - Blocking] The extracted base for the Task 1/Task 2 runs also holds diy.html.**
- Found during: Task 1, step 0.
- Issue: the plan extracts only `assets/js` into `SCRATCH/exec-11-04/base-src`, but W6 requires the base side to read the base tree's own diy.html.
- Fix: `git archive <base> assets/js diy.html`. The gate's base tree (full archive) already has it. Later plans that extract a base for a direct run (for example 11-07's verify) must extract diy.html too, or AUDIT SAME prints `FAIL no base tree ... holds no assets/js/audit.js or diy.html`.

**2. [Rule 2 - Correctness] The package comparison carries the interfaces block's 'checks' rule into the zip.**
- Found during: Task 1.
- Issue: W4 lists the zip entries allowed to differ but not what a new readiness check adds (plan 11-11 adds a 'books' check), while the interfaces block allows new rows in schedule 'checks'. Without this, the first plan to add a readiness check would fail AUDIT SAME on figures that did not change.
- Fix: only the rows, README READINESS lines, exception items and CONTENTS row count that come from a check title the base lacks are allowed; every allowance and the refusals around it are proven in case selfcheck.

**3. [Rule 2 - Correctness] P11_ROOT pointing at this checkout is refused.**
- The plan says the check never compares a tree with itself silently; an unset P11_ROOT was the only case named. Case noroot covers both, plus a P11_ROOT with no portal in it.

**4. Case mutate's extra assertion allows the firm-wide change log.**
- The change log schedule is the firm's, so Kestrel Bay's other two funds' `log` schedule (ITD) shows the changed distribution. The case requires that any other fund reported differs only there.

**6. [Rule 3 - Disk] gate11 also removes `checks-out` and the owner's folder after the verdict.**
- Found during: the full gate run (about 216 MB left behind, with about 4.4 GB free on a disk shared by about ten agents).
- Fix: commit 0dfa16e. Text outputs stay in GATE_OUT/gate.

**5. Tree-side extras.**
- AUDIT SAME's tree side loads scripts this tree's diy.html lists after operations.js that the base's diy.html does not list at all (none today; printed by case same). This keeps W6 (nothing typed) and makes the check run what the page runs after 11-07 adds books.js and books-post.js after operations.js.

## How later plans add their checks to gate11

- Put the check directly in `.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/` as `<name>.js` with its first lines `// gate: node` (or `// gate: browser`) and `// last "<exact last line of a full run>"`. A helper is `// gate: none`. The gate finds it on its own; no edit to gate11.sh is needed. Browser checks go through heavy.sh automatically.
- In a check: `const { loadPortal, sampleWorkspaces } = require('./load11.js'); const NS = loadPortal(root, { today: 'YYYY-MM-DD', edition: 'diy' | 'managed', extra: ['books.js', ...] });` (root defaults to this checkout). Use `process.env.P11_ROOT` for the base tree when comparing with the base; the gate sets it (and P10_ROOT) to `GATE_OUT/gate/base-tree`.
- Run the gate: `GATE_OUT=SCRATCH/exec-11-NN bash .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/gate11.sh` from the checkout root after the plan's first commit (the reference step requires HEAD to have moved), with `SCRATCH/exec-11-NN/base-commit.txt` holding the plan's base commit. The last line must be `GATE_EXIT=0`.
- A plan that adds a server test file declares it with a first line `// gate: tests N`.
- A plan whose change makes a sample fund's package differ does not loosen AUDIT SAME; the figures must stay the same (FA-03).

## Cleanup

- After the gate: `gate/base-tree`, `gate/shots` and `gate/reference-run.sh` were gone (the gate removed them); no `server/node_modules` link left in the checkout.
- The gate also left `gate/checks-out` (203 MB: page captures, PNG screenshots, PDFs from the reference's browser checks) and `gate/owner` (13 MB). Removed by hand, and gate11 now removes both after the verdict (commit 0dfa16e; deviation 6).
- `SCRATCH/exec-11-04/base-src`, the rerun folders and probe scripts removed. What is left in `SCRATCH/exec-11-04` is 552 KB of text outputs (red-1.txt, red-2.txt, kb.txt, same.txt, selftest.txt, gate.txt, gate/*.txt). Disk free after: 4.4 GB.

## Known Stubs

None.

## Threat Flags

None: three check files, no product code, no network, no package installed.

## Self-Check: PASSED

- Files: checks/gate11.sh, checks/load11.js, checks/audit-same.js, 11-04-SUMMARY.md, deferred-items.md all present.
- Commits c5a9031, 26ad698, 0dfa16e are on HEAD (git log 211ad70..HEAD).
- Plan verify: Task 1 passed (`AUDIT SAME: PASS (cases run: 2)` for Kestrel Bay). Task 2: AUDIT SAME (4) over 15 funds and the self-test pass; the full gate ends `GATE_EXIT=1` on the two base-tree failures above, so that part of the verify does not hold.
