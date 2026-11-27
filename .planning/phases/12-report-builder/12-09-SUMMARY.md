---
phase: 12-report-builder
plan: 09
subsystem: report builder: closing proof (sweep, owner-path walk, gate)
status: complete
tags: [walkthrough, white-label, gate, phone-frame, rb-15]
requires: [12-08, quick report-fixes, quick portal-report-hash]
provides:
  - checks/walk12.js (WALK12, 28 steps, gate: none)
  - checks/reports-sweep.js (REPORTS SWEEP, 4 parts, gate: browser)
  - gate-reference.sh with REPORTS FLOW (8) and DELIVER FLOW (8)
  - gate12.sh step 5 dedupe and GATE12 SELF-TEST (9)
  - 12-WALKTHROUGH.md
affects: [gate-reference.sh (16-13, 13-10, 14-11, 15-11 edit it next)]
tech-stack:
  added: []
  patterns: [one browser context shared across ordered walk steps, counting off-origin requests per step, words broken across lines measured with Range.getClientRects]
key-files:
  created:
    - .planning/phases/12-report-builder/checks/walk12.js
    - .planning/phases/12-report-builder/checks/reports-sweep.js
    - .planning/phases/12-report-builder/12-WALKTHROUGH.md
  modified:
    - .planning/checks/gate-reference.sh
    - .planning/phases/12-report-builder/checks/gate12.sh
decisions:
  - "Report-module file names that the vendor pattern matches ('reports-pdf.js' holds 'pdf.js') are printed and set aside by the sweep's sources part; only exact names of report scripts in assets/js, and the check fails on anything else"
  - "walk12 counts off-origin requests per step (and prints the walk total), so the load-time font requests fail the step where they happen, not every later step"
  - "The preview-table layout fault found in a screenshot was turned into a walk assertion (cf89610) so the debugger has a RED check; no product file changed"
metrics:
  duration: "about 2 h 30 min wall time; the gate alone 4,819 s"
  completed: 2026-11-27
actuals:
  tokens: 28700
  tasks: 3
  commits: 9
plan_head_before: 5394b73d90d350d1688f45571a108f7023dce0a4
plan_head_after: d6d18e27d6d0788e39689e360c94ba2b007bb312
---

# Phase 12 Plan 09: closing proof (sweep, owner-path walk, gate) Summary

The phase gate passes on this tree: GATE_EXIT=0, with REPORTS FLOW and DELIVER FLOW now steps of the reference gate.
REPORTS SWEEP passes its 4 parts. The 28-step owner walk on the phone frame found two faults in product code, reported
below. Nothing is ready: the owner's iPhone check comes next.

## Failures first

1. **WALK12: FAIL (steps run: 28) - kb-open, kb-preview, ar-letter, ar-preview-pdf, pb-letter, fa-statement,
   fa-holdings** (239 PASS, 8 FAIL; SCRATCH/exec-12-09/walk.txt).
   - **Fault 1: on the 390 px phone, preview tables break words letter by letter.** It happens in steps kb-preview,
     ar-preview-pdf, pb-letter, fa-statement and fa-holdings. Every preview table with 4 or more columns squeezes its
     text columns to 27-36 px. The walk counted 143 broken words:
     - Kestrel Bay: Holdings and Net performance, 60
     - Ashwell Ridge: Distributions, Totals and Net performance, 22
     - Pellbrook: Holdings, 40
     - fund A's statement: Distributions and Totals, 9
     - fund A's summary: Net performance and Holdings, 12

     Holdings and Net performance also scroll sideways (343-544 px in a 308 px box). Screenshot:
     `walk12__fa-holdings__28-fa-holdings.png`. REPORTS FLOW (12-06) did not catch it, because it reads the preview's
     text. I found it by looking at the screenshots. RED check for the debugger:
     `node .planning/phases/12-report-builder/checks/walk12.js`, its 5 preview steps. Probable place: the preview's
     table CSS in assets/css/reports.css or reports-ui.js's table markup. Not changed here.
   - **Fault 2: brand web-font requests leave the page's origin** (W5). It happens in steps kb-open (2 requests when
     the page loads), ar-letter (1, on the switch to Ashwell Ridge) and pb-letter (1, on the switch to Pellbrook). All
     4 go to fonts.googleapis.com, from diy.html line 8 and assets/js/brand.js lines 128-166. These are older than
     phase 12 and are not report builder requests. With no network they fail without any error on screen. The check
     browser answers them locally. RED check: the same walk steps.
2. The first full sweep failed in two parts:
   - screens: the tax editor has no fund picker, so the check waited for `#rb-fund`. This was a check fault, fixed in
     the check.
   - sources: `HIT assets/js/reports-ui.js:41: reports-pdf.js`. The vendor pattern `pdf\.js` matches the report
     module's own file name in the parts loader. I set it aside narrowly (decision above; deviation 3).
3. The first walk run's move-up assertion moved Performance, whose neighbour in q-pe ('distributions') is switched off,
   so the preview could not change. The walk now moves Holdings above Performance. This was a check fault.

## RED outputs

- Task 1, SCRATCH/exec-12-09/red-1.txt, the first walk run: `WALK12: FAIL (steps run: 24) - kb-open, kb-new, ...,
  fa-statement, fa-holdings`. Each of the eight steps not written yet failed `step written :: not written yet`. The
  Kestrel Bay steps also failed the off-origin count, which then ran from the walk's start: `FAIL kb-open no request
  left the page's own origin (2) :: ["https://fonts.googleapis.com/css2?family=Funnel+Display..."]`.
- Task 2, red-2.txt (`--only outputs --plant`): `HIT kestrel-bay st-capital kb-fund-ii KBC-1001 PDF text: Drawn with
  pdf-lib` and then `REPORTS SWEEP: FAIL (parts run: 1) - outputs`.
- Task 3, red-3.txt (self-test with case dedupe, before the step 5 change): `GATE FAIL STAND IN`, `stand-in.js: the
  last line was:       STAND IN: FAIL (cases run: 1)`, `GATE12 SELF-TEST: FAIL - dedupe`.

## Verify lines

- Task 1 (greps of its verify, on the official walk run made by the same command, run-walk.sh):
  `WALK12: FAIL (steps run: 28) - kb-open, kb-preview, ar-letter, ar-preview-pdf, pb-letter, fa-statement, fa-holdings`
  and `TASK 1 VERIFY: PASS` (shots/index.txt there; the walkthrough starts with `## Failures`, quotes the walk line and
  ends with the closing sentence). A WALK12 FAIL completes this task by the plan's own rule.
- Task 2 (verify-2.sh, B1 form: `grep -q '^FAIL' $O/red-2.txt || exit 1;` ... `rc=$?; rm -rf $O/shots-sweep; exit
  $rc`): `REPORTS SWEEP: PASS (parts run: 4)`, VERIFY2 rc=0, run in 41 s. Its parts:
  - outputs: 66 reports (5 firms with fund A), 66 PDFs, 66 workbooks, 621 parts
  - screens: 37 views
  - sources: 2,806 string literals and 100 CSS rules
  - managed: staff and investor
- Task 3, first half (verify-3a.sh, W1 and W2 forms):
  - `GATE12 SELF-TEST: PASS (9)`
  - `reference gate step lines: base 27, this tree 29` (base + 2, both measured)
  - the header lists `REPORTS FLOW (8), DELIVER FLOW (8)`
  - `git log --no-merges` over this plan's commits lists no product file
  - then the full gate, VERIFY3A rc=0

  Second half (verify-post.sh, W3 and I3 forms): `TASK 3 VERIFY: PASS`. It greps:
  - `^GATE ok +REPORTS FLOW (8)` and `DELIVER FLOW (8)`
  - `REPORTS FLOW (run in the reference gate)`
  - REPORTS SWEEP, MATH, STARTERS, RUN and `^GATE ok +REPORT FIXES`
  - `server tests 555 = base 555 + 0 declared`
  - the walkthrough's `## Failures` first, its `## Measured times` quoting walk.txt's first Generate line, and this
    run's `GATE_EXIT=0`
  - no base tree left, no server/node_modules

## Gate

GATE_OUT=SCRATCH/exec-12-09. base-commit.txt is 5394b73 and the gate judged a53448b. It ran 4,819 s, from 12:43:52 to
14:04:11 UTC, and gave 80 GATE ok and 0 GATE FAIL. The reference gate's own last line is GATE_EXIT=0. Signing: base 75
PASS / 0 FAIL, plan 75 / 0. Record: base 40 / 0, plan 40 / 0. The gate's last lines, verbatim:

```
GATE ok   WORKBOOK
GATE ok   DELIVER FLOW (run in the reference gate)
GATE ok   REPORT FIXES
GATE ok   REPORTS FLOW (run in the reference gate)
GATE ok   REPORTS MATH
GATE ok   REPORTS MODEL
GATE ok   REPORTS PDF
GATE ok   REPORTS RECORD
GATE ok   REPORTS RUN
GATE ok   REPORTS STARTERS
GATE ok   REPORTS SWEEP
GATE ok   REPORTS XLSX
GATE_EXIT=0
```

Since the gate, two commits:
- cf89610 changes walk12.js only. It is marked "// gate: none", so the gate never runs it.
- d6d18e2 adds the walkthrough.

Re-check: gate12 is to be rerun into the same folder after 15-06 and 13-05 merge.

## Measured times

All measured in this run.

- Phone frame, from walk.txt:
  - `generate: ... kb-fund-ii, every investor in the fund: 14 files, 1214 ms in the page (87 ms per file, performance.now), 1344 ms from the tap to the last line`
  - `... one letter for everyone: 1 files, 193 ms in the page`
  - `... pb-long-short, every investor in the fund: 16 files, 1102 ms in the page (69 ms per file)`
- The walk: 117 s. The sweep: 41 s. The --plant outputs run: 21 s. The gate: 4,819 s.

No iPhone time has been measured.

## Walk steps (28) and results

Each step has one screenshot, kept in SCRATCH/exec-12-09/shots with index.txt and walk12-index.txt (step order).

- **Kestrel Bay**
  - kb-open: FAIL, fault 2
  - kb-new, kb-sections, kb-letter (bold word and list): PASS
  - kb-asset-photo (B2c): PASS. 7 holdings listed as `kb-fund-ii-<slug>`, never the no-holding line; the photo shows in
    the preview and is in the PDF as an 800x600 JPEG
  - kb-preview: FAIL, fault 1
  - kb-pdf, kb-download, kb-generate (14 of 14), kb-deliver (Pat Admin), kb-paper (C-01 line): PASS
  - kb-mark-paper (W4): PASS. 'Sent on paper Jan 19, 2027 by Kestrel Bay admin', and the change log reads 'Report sent
    on paper'
  - kb-tell (Notices filled, nothing sent): PASS
  - kb-investor-open: PASS. The SHA-256 equals the record
  - kb-opened ('Opened 1 time'): PASS
  - kb-tell-refused (B2a): PASS. The exact sentence shows, and S().ui.notice is unchanged
- **Ashwell Ridge**
  - ar-letter: FAIL, fault 2. 1 property with a photo; NOI 0 of 1, since the journal has no property lines
  - ar-preview-pdf: FAIL, fault 1
- **Pellbrook**
  - pb-letter: FAIL, faults 1 and 2. 'Monthly net return' for Oct, Nov and Dec, and 'Distributions and redemptions'
  - pb-pdf, pb-generate (16 of 16, delivered): PASS
- **Two firms in one browser (B2b, B2d)**
  - two-firms: PASS. 15 ids start `rf-kestrel-bay-` and 16 start `rf-pellbrook-`, none shared; Pellbrook's holder sees
    the record's bytes
  - two-firms-kb: PASS
  - hash-check: PASS. The other firm's bytes are never shown; the file is remade with the record's SHA-256; the kept
    bytes are untouched
  - hash-not-kept: PASS. 'The original file is not kept on this device.'
- **Fund A**
  - fa-statement: FAIL, fault 1. $334,000.00, −$6,000.00, $20,000.00, −$3,000.00, $345,000.00 and the preliminary line
    are all right
  - fa-pdf: PASS. The same figures appear in the PDF; Producer and Creator are 'Fund A Sponsor Management, LLC'
  - fa-holdings: FAIL, fault 1. W6 holds: the engine equals the journal, Portfolio Co X at 49,000,000 cents fair value
    and 40,000,000 cents cost ($490,000.00 / $400,000.00)

## Deviations from Plan

1. **[Save rules]** Most code landed in `wip(12-09): save` commits, under the owner's save rule. The checks were
   written in one edit round and saved before each run, so the RED walk was already in a save commit (241f831) when
   its RED commit was attempted (nothing left to commit). The commits map to tasks as follows:
   - Task 1, walk12.js: 241f831, d1191e5, 62f2eb2 and cf89610
   - Task 2, reports-sweep.js: f53fc68, db3eabc and a53448b
   - Task 3, gate12.sh and gate-reference.sh: bdfbe50
   - the walkthrough: d6d18e2
2. **[Rule 1, check]** Off-origin requests are counted per step rather than cumulatively (W5 still fails a step above
   0, and the total is printed). Cumulative counting failed every step for the 2 requests made at page load.
3. **[Rule 1, check]** The sweep's sources part sets aside a string only when the scan matches it and it is exactly a
   script file name in assets/js. Only 'reports-pdf.js' qualified; it is printed, and the check fails if anything
   other than a report module's own name is set aside.
4. **[Rule 2]** After the gate I added walk12's preview-table assertion (cf89610), because screenshot 28 showed a fault
   no check caught. It gives the debugger a RED check. The walk was then rerun, and walk.txt and the shots are from
   that run.
5. Task 1's and Task 3's verify commands were split in two:
   - verify-3a.sh runs the self-test, the step-count and product-file checks, then the gate.
   - verify-post.sh runs the greps, after the walkthrough could quote this gate's result.

   The walk was not run a third time for Task 1's greps, so the quoted times stay those of the walk.txt shown.
6. The walk has 28 steps, against the interfaces block's list. The additions are the B2 steps, 'Mark sent on paper',
   and separate PDF steps per firm.
7. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, per AUTOPILOT ("never touch STATE.md or ROADMAP.md"). The
   orchestrator records progress.

## Open points (the owner or counsel)

- C-01: the paper list says "To be confirmed with counsel".
- C-02: DejaVuSans and DejaVuSans-Bold are inside each PDF's font data (not page text).
- C-13: the 506 line says "To be confirmed with counsel".
- The default wording and disclosures have not been read by counsel.
- Only Chromium was run, not iPhone Safari in the Claude app.
- Saving files in the Claude app has not been tried.
- portal-report-hash:
  - a report with nothing kept shows the not-kept sentence and is not remade
  - the remade file is composed again on Download after View, and that has not been timed
- The NOI table has not been seen on screen, because the sample journal has no property lines.
- The multi-column tables in the PDFs have not been looked at; the shots show only the first pages.
- Faults 1 and 2 go to a GSD debugger.

## Known Stubs

None. The checks plant nothing in product code. The `--plant` flag changes only a copy of text inside the check.

## Threat Flags

None. No product file was changed.

## Self-Check: PASSED

- The files exist: walk12.js, reports-sweep.js, 12-WALKTHROUGH.md, gate12.sh and gate-reference.sh.
- The commits are ancestors of HEAD: 241f831, d1191e5, 62f2eb2, f53fc68, db3eabc, bdfbe50, a53448b, cf89610 and
  d6d18e2.
- The outputs are in SCRATCH/exec-12-09: walk.txt, sweep.txt, gate.txt, red-1.txt, red-2.txt, red-3.txt, self.txt, and
  shots/ (28 PNG files, index.txt and walk12-index.txt).
- Deleted: the base tree, the gate's shots and checks-out, the dev shots, the probe output and the downloads.
- server/node_modules is not present.

Nothing here is ready until the owner has checked it on his iPhone.
