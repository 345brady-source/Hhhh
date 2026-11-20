---
phase: 12-report-builder
plan: 04
subsystem: report builder (delivery record, phase gate)
status: complete
tags: [reports, delivery, documents, change-log, gate]
requires: [10-06 document record shape, NS.audit.log/verify/sha256, NS.ops.docsFor, gate-lib.sh, gate11.sh pattern]
provides: [NS.reportRecord, checks/reports-record.js (10 cases), checks/gate12.sh (self-test 8, --only-phase12)]
affects: [12-06, 12-07, 12-08 (screens call NS.reportRecord; every later phase 12 plan runs gate12.sh)]
tech-stack:
  added: []
  patterns: [pure functions over ws.reports.runs and ws.docs; 10-06 doc record plus a report block; resumable gate steps]
key-files:
  created:
    - assets/js/reports-record.js
    - .planning/phases/12-report-builder/checks/reports-record.js
    - .planning/phases/12-report-builder/checks/gate12.sh
  modified: []
decisions:
  - "A replaced report gets ' (replaced)' added to its title, as taxdocs.js replaceEarlier does, so an investor holding both can tell them apart"
  - "deliver checks every refusal (person, state, investors, replaces pairs) before it writes anything"
  - "the phase-12-only line wins over the stand-in line, so an --only-phase12 run never ends with any full-gate line"
metrics:
  completed: 2026-11-20
  duration: not measured
requirements: [RB-13, RB-16]
actuals:
  tokens: 16000
  tasks: 3
  commits: 7
plan_head_before: 96bbdf6800f8b9190a02bf66f1483a2884717598
plan_head_after: 462efc7a591361ad13d794a3b7e99affe2a530ed
---

# Phase 12 Plan 04: Delivery record and the phase gate Summary

NS.reportRecord keeps every report run (a copy of the template as used, the period, the audience, every file's size and
SHA-256) and carries it into investors' Documents as the 10-06 document record plus a `report` block: paper list (C-01),
opens per investor, withdraw with person and reason, replacement, a Notices page draft. Every step is on the hash-chained
change log. gate12.sh is the phase gate on the gate11.sh pattern, with a phase-12-only form that can never pass as the
full gate.

Nothing here is on screen. Nothing is shown to anyone until plan 12-08 and the owner's check, and nothing here is called
ready before the owner has checked the finished builder.

## Failures first

- No failure is open. Every check this plan names passes on this tree (lines below).
- RED 2 was partial: cases refuse, replace and selfcheck passed before the Task 2 code existed (see RED 2). The six cases
  that needed new functions failed as expected.
- The full reference gate and a full gate12 run were not run (orchestrator instruction; the full gate first runs in plan 12-06).
- checks/reports-record.js loads the portal through phase 11's load11.js (diy.html's list from edition.js through
  operations.js). If 12-01..12-03 change that list, rerun it after the merge.

## Server tests

`npm --prefix server test` with server/node_modules linked (link removed afterwards):
```
# tests 368
# pass 368
# fail 0
```

## The record functions as built (plans 12-07 and 12-08 rely on them)

| Function | What it does |
|----------|--------------|
| `ensure(ws)` | makes `ws.reports = { v: 1, templates: [], runs: [], splits: {} }` or fills only the missing keys |
| `CATS` | statement Statements, distribution Notices, quarterly/annual/performance Reports, tax Tax |
| `newRun(ws, { template, title, period, audience, spec, by, at })` | run `rr-<n>`, state generating, deep copies; nothing logged |
| `addFile(ws, runId, { investorIds, offeringId, name, size, sha256, pages })` | file `rf-<n>-<k>`; refuses a size that is not a positive safe integer, a hash that is not 64 lower-case hex characters, no investors, a run not generating |
| `finish(ws, runId, { by, at, stopped })` | generated or stopped; logs 'Report generated' / 'Report generation stopped' (title, period, files, investors, template name and version) |
| `runsOf(ws)`, `runOf(ws, id)` | newest first; by id |
| `docTitle(run, file, ws?)` | `title + ', ' + period label`, plus ' - ' + the fund's name when the run's files span several funds (the optional ws gives the name) |
| `edelivery(inv)` | the onboarding consent with "electronic delivery" in its scope; never `inv.taxDelivery` |
| `deliver(ws, runId, { by, at, replaces })` returns `{ docs, paper }` | the messages of the interfaces block; one doc per file, id = file id; 'Report replaced' per pair, then 'Report delivered'; `run.delivered = { at, by, docs }` |
| `paperList(ws, runId)` | `[{ investorId, name, address, fileId, sentOn, sentBy }]` for investors without edelivery |
| `markPaper(ws, runId, investorId, { sentOn, by, at })` returns the doc | `report.paper[investorId] = { sentOn, by }`; logs 'Report sent on paper' |
| `opened(ws, docId, investorId, at)` returns the doc | only for a shown doc in state delivered or replaced that lists the investor; `report.opens[id] = { first, last, count }`; logs 'Report opened' as '<title> (investor)' |
| `opensOf(doc)` | `{ investors, count }` |
| `withdraw(ws, docId, { by, why, at })` returns the doc | delivered or replaced report docs only; hidden, state withdrawn, opens kept; logs 'Report withdrawn' with the opens so far. Screens limit it to admins (C-04) |
| `verifyFile(ws, runId, fileId, bytes)` | `NS.audit.sha256(bytes) === file.sha256`; false for an unknown file |
| `noticeDraft(ws, runId)` | exactly the 13 keys of console.js `ui.notice = {`; quarterly for a quarterly run, else documents; audience 'all'; investors the delivered (not withdrawn) ones; refused for an undelivered run. Never sends. |

Messages a screen can show: 'The person delivering must be named.', 'Only a generated report can be delivered.',
'This report has already been delivered.', 'An investor of this report (<id>) is not in this workspace.',
'The report it replaces must be one this investor has now.', 'Give the date it was sent on paper.',
'The person who sent it must be named.', 'This investor is not on the paper list of this report.',
'This report cannot be withdrawn.', 'The person withdrawing it must be named.', 'Say why it is withdrawn.',
'This report has not been delivered yet.'

Fund A's sample investors carry no esignConsent.scope, so all of them land on the paper list (C-01, plan-check Info).

## Deviations from Plan

1. **[Rule 2 - correctness] A replaced report's title gets ' (replaced)'**, as taxdocs.js replaceEarlier does, so an
   investor who sees both in Documents can tell the corrected one apart. File: assets/js/reports-record.js. Commit 4114643.
2. **[Rule 2 - correctness] deliver refuses a file id already in ws.docs** and a run with no files, and checks every
   refusal before writing, so a refused delivery never leaves a half-written record. Commit 4114643.
3. **docTitle takes an optional third argument ws** to print the fund's name (the run holds only offering ids). Called
   with two arguments it prints the offering id in that one case. Commit 4114643.
4. **Extra assertions beyond the behaviour list**: the tax consent (`inv.taxDelivery`) alone never counts as e-delivery;
   a stopped run is logged and cannot be delivered; withdrawing a non-report doc is refused; ensure keeps existing keys;
   every 'Report ...' log entry is swept for vendor names and the forbidden word (P6 lib VENDORS, VENDOR_RE, WORD_RE).
5. gate12.sh rejects an unknown argument with a GATE FAIL line (gate11.sh ignored it).

## Threat model

T-12-16 (case deliver: docsFor lists exactly its own), T-12-17 (refuse, withdraw, replace: named person, logged in the
chain), T-12-18 (archive: verifyFile false for one changed byte), T-12-19 (opens: another investor's open changes
nothing), T-12-20 (gate self-test 'only'). No package installed. No new network, auth or file-access surface. No
taxpayer number is read, stored or logged.

## Commits (pushed to wip/12-04)

- 7eb51b0 test(12-04): case deliver for the report delivery record (RED)
- 4114643 feat(12-04): report runs, files and delivery into investors' Documents
- 2aa3829 test(12-04): refusals, paper, opens, withdraw, replace, letter, notice, archive, selfcheck (RED)
- bc9ef74 feat(12-04): paper list, opens, withdraw, file check and the Notices draft
- 580644a test(12-04): gate12.sh self-test of 8 before the phase 11 step and the phase-12-only mode (RED)
- 9435248 feat(12-04): the phase 12 gate with the phase 11 step and the phase-12-only mode
- 462efc7 wip(12-04): save (summary evidence)

## Evidence as produced

## RED 1 (Task 1, before assets/js/reports-record.js existed)

`node .planning/phases/12-report-builder/checks/reports-record.js --case deliver` (SCRATCH/exec-12-04/red-1.txt):

```
FAIL deliver ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a842fff1345674961/assets/js/reports-record.js'
    at Object.readFileSync (node:fs:440:20)
    ...
REPORTS RECORD: FAIL (cases run: 1) - deliver
```

## Task 1 verify (after assets/js/reports-record.js)

```
PASS deliver the change log verifies
PASS deliver the run's delivered block names the person and the docs
PASS deliver no vendor name and never the forbidden word in the log
REPORTS RECORD: PASS (cases run: 1)
```
(20 PASS lines, 0 FAIL; SCRATCH/exec-12-04/deliver.txt)

## RED 2 (Task 2, the nine further cases written before the code; SCRATCH/exec-12-04/red-2.txt)

```
FAIL paper ran to the end :: TypeError: R.paperList is not a function
FAIL opens ran to the end :: TypeError: R.opened is not a function
FAIL withdraw ran to the end :: TypeError: R.opened is not a function
FAIL letter ran to the end :: TypeError: R.opened is not a function
FAIL notice a run not delivered is refused :: R.noticeDraft is not a function
FAIL notice ran to the end :: TypeError: R.noticeDraft is not a function
FAIL archive ran to the end :: TypeError: R.verifyFile is not a function
REPORTS RECORD: FAIL (cases run: 10) - paper, opens, withdraw, letter, notice, archive
```
Plainly: cases refuse, replace and selfcheck already passed at this RED. Task 1's deliver was written to the full
interfaces block (its refusals and `replaces`), so those cases exercise code that existed; selfcheck tests the runner.

## Task 2 verify (SCRATCH/exec-12-04/record.txt: 99 PASS lines, 0 FAIL, no part kept from an earlier run)

```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS RECORD: PASS (cases run: 10)
```

## RED 3 (Task 3: gate12.sh with the full self-test of 8 but no phase 11 step and no --only-phase12 mode yet; SCRATCH/exec-12-04/red-3.txt)

```
SELF-TEST FAIL control: the stand-ins pass when nothing is wrong
SELF-TEST ok   a phase 12 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
SELF-TEST FAIL a phase 11 check whose last line differs from its marker
SELF-TEST FAIL a phase-12-only run
GATE12 SELF-TEST: FAIL - control (control) p11 only
```
The control failed because no "GATE ok   ELEVEN STAND IN" line was printed (no phase 11 step); the only-run printed
the reference step and the server test line and ended "GATE_EXIT=0 (stand-in)".

## Task 3 verify (the plan's command, verbatim; VERIFY rc=0)

```
SELF-TEST ok   a phase-12-only run ends 'GATE_EXIT=0 (phase 12 checks only)' with no reference step and no server test line, and 'GATE_EXIT=1' when a phase 12 check fails
GATE12 SELF-TEST: PASS (8)
GATE ok   REPORTS RECORD
GATE_EXIT=0 (phase 12 checks only)
```
SCRATCH/exec-12-04/gate/base-tree is gone after the run. A rerun into the same folder keeps the step:
```
GATE ok   REPORTS RECORD (kept from 2026-11-20 16:29:53 UTC)
GATE_EXIT=0 (phase 12 checks only)
```

## Self-Check: PASSED

FOUND: assets/js/reports-record.js, checks/reports-record.js, checks/gate12.sh. FOUND in HEAD: 7eb51b0, 4114643, 2aa3829, bc9ef74, 580644a, 9435248, 462efc7. server/node_modules link removed.
