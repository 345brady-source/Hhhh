---
phase: 12-report-builder
plan: 07
subsystem: report builder (batch generation and archive)
status: complete
tags: [reports, batch, archive, sha256, white-label]
requires: [NS.reports (recipients, resolve, othersIn, normalise), NS.reportsPdf (compose, logoFor), NS.reportRecord (newRun, addFile, finish, runOf, verifyFile), NS.reportsData, NS.audit.sha256, NS.ops.files]
provides: [assets/js/reports-run.js (NS.reportsRun.generate, NS.reportsRun.fileBytes), checks/reports-run.js (REPORTS RUN, 8 cases)]
affects: [12-08 (Generate and Archive panels call these), 12-09 (walkthrough)]
tech-stack:
  added: []
  patterns: [every recipient resolved and checked before anything is recorded or kept; one PDF at a time, each kept before the next; archive served only when its SHA-256 equals the record]
key-files:
  created: [assets/js/reports-run.js, .planning/phases/12-report-builder/checks/reports-run.js]
  modified: []
decisions:
  - "A failure part-way through a batch (a composer refusal, for example) finishes the run as 'stopped' with the files already made recorded and kept, and passes the reason to the caller with err.run"
  - "The logo is worked out once per run with the composer's own default (logoFor of the model's firm), not once per report"
  - "A remade archive file that differs while a photo it used is missing gets its own sentence ('... a photo it used is no longer on this device.') instead of the changed-figures one"
  - "The run check measures afresh every run (GATE_FRESH), so a kept case never replays without the speed line"
metrics:
  completed: 2026-11-20
  duration: not measured
requirements: [RB-13, RB-14, RB-16]
estimate_tokens: 85000
actuals:
  tokens: 7800       # chars/4 over the two new files (31,043 chars), plus this summary
  tasks: 3
  commits: 10        # MEASURED at SUMMARY write: git rev-list --count da1ce23..HEAD (this SUMMARY's own commit follows)
plan_head_before: da1ce23
plan_head_after: afd1bb3
---

# Phase 12 Plan 07: batch generation and archive Summary

NS.reportsRun.generate makes a report for one investor, every investor of a fund, every investor across all their
funds, or one letter for everyone (or one per holder with statements), one PDF at a time, each file kept in the store
before the next is composed, every file recorded with its SHA-256; it refuses before writing anything when any report
has an unknown field, another investor's details or a missing photo. NS.reportsRun.fileBytes gives an archived file back
byte-identical, from the store or remade from the run's own snapshot, or says in one plain sentence why it cannot.

Proven in Node only, on fund A's hand-worked figures and the Kestrel Bay sample firm. Nothing is on screen until plan
12-08, and nothing here is ready until the owner has checked it there.

## Failures first

1. **The first run of the Task 3 verify failed (VERIFY_EXIT=1), and the gate did not start.** The run.txt step replayed
   six cases as KEPT from an earlier passing run on the same tree (the shared runner keeps passing parts per tree), and a
   kept case replays only its PASS lines, not the `speed:` line, so `grep -q '^speed: '` failed. Fixed in afd1bb3: the
   check now always runs fresh, so the speed is measured on every run. The rerun passed (lines below).
2. **The plan's empty-folder test fails as written** (`test -z "$(ls -A $O/checks-out)"`): the folder holds only
   `.parts`, the runner's results store. 12-CONTEXT "After 12-03" says such tests exclude `.parts`; the verify was run
   with that exclusion, and the as-written folder listing is printed in its output (`[.parts ]`). No PDF was left behind.
3. **Two cases did not go red first:** batch and selfcheck passed in red-3. batch tests generate, already built in Tasks
   1-2; selfcheck tests the shared runner. Only archive needed new code, and it failed first.
4. **Task 3's code has no separate feat commit:** fileBytes was saved in the save commit 7c17a65 (SAVE-RULES rule 2)
   before the run that proved it, so there was nothing left to commit as feat.

## RED outputs (verbatim)

### red-1 (Task 1, `node checks/reports-run.js --case fund-a`, before assets/js/reports-run.js existed; exit 1)
```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a875045333c30a74b/assets/js/reports-run.js'
REPORTS RUN: FAIL (cases run: 1) - fund-a
```

### red-2 (Task 2, `--case fund-a,order,stop,refuse,letter` on Task 1's code, GATE_FRESH=1; exit 1; 21 PASS, 12 FAIL; FAIL lines cut at 260 characters)
```
FAIL order onEach is called once per file, done 1..N, total N, with that file :: []
FAIL stop the run is 'stopped' with exactly two files :: {"state":"generated","files":14}
FAIL stop it was stopped part-way (more than two holders) :: 0
FAIL stop both files are kept and match their records :: 14
FAIL stop the change log's last entry is 'Report generation stopped' :: Report generated
FAIL refuse a letter holding {frist_name} is refused, naming it, for both reports :: Unknown field {frist_name} in Letter
FAIL refuse a letter to everyone without statements holding {first_name} is refused, naming it :: The field {first_name} in Letter needs an investor, and this goes to everyone without a statement
FAIL refuse a photo id not in the store is refused with the photo sentence :: 
FAIL refuse a report naming another investor is refused: 'A report would show another investor's details. Nothing was generated.' :: 
FAIL refuse after each refusal no run is recorded and nothing is logged :: {"ws":"{\"runs\":[{\"id\":\"rr-1\",\"type\":\"quarterly\",\"title\":\"Quarterly report\",\"templateId\":\"rt-1\",\"template\":{\"id\":\"rt-1\",\"name\":\"Quarterly report\",\"title\":\"
FAIL refuse after each refusal the store is exactly as before (empty) :: 4
FAIL letter ran to the end :: Error: The file needs the investors it is for.
REPORTS RUN: FAIL (cases run: 5) - order, stop, refuse, letter
```

### red-3 (Task 3, all 8 cases on Task 2's code, GATE_FRESH=1; exit 1; 44 PASS, 1 FAIL)
Cases batch and selfcheck passed here: batch proves generate (built in Tasks 1-2) on a whole firm, and selfcheck proves
the shared runner's refusal of an unknown or empty --case. Only archive needed new code (fileBytes).
```
FAIL archive ran to the end :: TypeError: NS.reportsRun.fileBytes is not a function
speed: 23 reports, 5989 ms, 260 ms per report
REPORTS RUN: FAIL (cases run: 8) - archive
```

### The check can fail
Two faults put into reports-run.js at once (every file composed from the first recipient's model; a remade file
served without comparing its hash), run with `--case fund-a,archive`, then reverted with `git checkout -- assets/js/reports-run.js`:
```
FAIL fund-a FA-1002's file holds $172,500.00 and 'Investor Two' and not 'Investor One' ::              Fund A Sponsor
FAIL archive after the figures changed: the plain sentence, no bytes :: remade
REPORTS RUN: FAIL (cases run: 2) - fund-a, archive
```

## Verify lines (verbatim)

### Task 1 verify (the plan's command, run from a script file; exit 0)
```
PASS fund-a the change log verifies
PASS fund-a no vendor name and never the forbidden word in the files or their names
REPORTS RUN: PASS (cases run: 1)
VERIFY_EXIT=0
```

### Task 2 verify (the plan's command, from a script file; exit 0)
The five cases first ran fresh (GATE_FRESH=1) on this same tree: 38 PASS, 0 FAIL, exit 0. The verify run below then
printed them as KEPT (the shared runner keeps a passing part per exact tree; 5 KEPT lines). This was before afd1bb3.
```
PASS letter with statements: one file per holder
PASS letter with statements: each file holds the letter and its own title only
REPORTS RUN: PASS (cases run: 5)
VERIFY_EXIT=0
```

### Task 3 verify (the plan's gate), on afd1bb3, `.parts` excluded from the empty-folder test (12-CONTEXT "After 12-03"); exit 0
Script: SCRATCH/exec-12-07/tools/verify3.sh. All five phase 12 checks ran fresh in the gate (0 KEPT, 0 FAIL in each).
```
PASS selfcheck an unknown --case name exits 1 with a FAIL line
PASS selfcheck an empty --case list exits 1 with a FAIL line
REPORTS RUN: PASS (cases run: 8)
as written, ls -A checks-out: [.parts ]
GATE ok   REPORTS MATH
GATE ok   REPORTS MODEL
GATE ok   REPORTS PDF
GATE ok   REPORTS RECORD
GATE ok   REPORTS RUN
GATE_EXIT=0 (phase 12 checks only)
VERIFY_EXIT=0
```
Last lines of each check in the gate: REPORTS MATH: PASS (cases run: 13); REPORTS MODEL: PASS (cases run: 11);
REPORTS PDF: PASS (cases run: 9); REPORTS RECORD: PASS (cases run: 10); REPORTS RUN: PASS (cases run: 8).
`git diff --quiet <base> HEAD -- diy.html portal.html index.html assets/js/console.js` passed: no page loads the new file.

### Speed (Node in this container, measured with Date.now(), all 23 Kestrel Bay investors, quarterly report, one PDF each)
```
speed: 23 reports, 6315 ms, 275 ms per report      (verify run.txt)
speed: 23 reports, 7175 ms, 312 ms per report      (the same check inside the gate run)
```
The phone's speed is not measured here; plan 12-08 measures it in the phone frame.

### Server tests (`npm --prefix server test`, server/node_modules linked for the run and removed afterwards)
```
# tests 387
# pass 387
# fail 0
```
The full reference gate was not run (instruction): the new file is loaded by no page until plan 12-08.

## What the check proves (REPORTS RUN, 8 cases, 53 PASS lines)
- fund-a: two files (FA-1001, FA-1002), each kept, its SHA-256 equal to the record; FA-1001's PDF holds $345,000.00 and
  Investor One, not Investor Two; FA-1002's holds $172,500.00; last log entry 'Report generated'; the log verifies.
- order (kb-fund-ii, 14 holders): onEach once per file, done 1..14, after its file is kept, ms a measured whole number;
  at the start of each compose the store already holds every earlier file.
- stop: shouldStop after two files gives a 'stopped' run with exactly two kept files and 'Report generation stopped'.
- refuse: {frist_name} ("2 reports cannot be made: Unknown field {frist_name} in Letter"), {first_name} in a letter to
  everyone, no holder ('No investor gets this report for that choice.'), a missing photo, and (added) a letter naming
  another investor's id; after each, no run, no log entry and an empty store.
- letter: without statements one file for all 14 holders of kb-fund-ii, named `..._All.pdf`, no investor title in it;
  with statements one file per holder, each with its own title only.
- archive: 'kept' with the recorded hash; after the store loses it, 'remade' and byte-identical; after a balanced entry
  dated 2026-11-30 changes FA-1001's capital, the changed-figures sentence; one changed byte, 'The kept file does not
  match its record.'; an unknown file, a plain sentence.
- batch (all 23 Kestrel Bay investors): every PDF holds its own investor's title and no other investor's title or id
  (titles contained in the recipient's own are not counted); multi-fund investors' files name no single fund.
- selfcheck: an unknown or empty --case exits 1 with a FAIL line.

## Commits (wip/12-07)
- 2fed175 test(12-07): RED check for batch generation, case fund-a
- 9ed99c3 feat(12-07): batch generation tracer - one PDF per recipient, kept, hashed and recorded
- d5eb962 wip(12-07): save
- 38e7992 test(12-07): RED cases order, stop, refuse, letter
- e97072f wip(12-07): save
- 17daf81 feat(12-07): stop, refusals before anything is written, the letter for everyone
- be487ed wip(12-07): save
- eef8c9a test(12-07): RED cases archive, batch, selfcheck
- 7c17a65 wip(12-07): save (holds fileBytes, Task 3's code)
- afd1bb3 fix(12-07): the run check measures afresh every run, so the speed line is never dropped by a kept case
- the commit that adds this summary follows

## Deviations from Plan

1. **[Rule 2 - correctness] A failure part-way through a batch** (a character the font cannot show, for example)
   finishes the run as 'stopped' with the files already made recorded and kept, and rethrows the reason with `err.run`.
   Without this the run would stay 'generating' for ever. File: assets/js/reports-run.js. Commit 17daf81.
2. **[Rule 2 - correctness] fileBytes says why when a photo is gone:** a remade file that differs while a photo it used
   is not in the store gets 'The original file is not kept on this device, and a photo it used is no longer on this
   device.' instead of the changed-figures sentence, which would be wrong. An unknown file gets 'That report file is not
   in this workspace.' A store that cannot read the kept file falls through to the remade path (served only if its hash
   matches). Commit 7c17a65.
3. **The logo is worked out once per run** (NS.reportsPdf.logoFor of the model's firm, exactly the composer's own
   default when no logo is given), so an uploaded SVG logo is not redrawn on a canvas for every investor. Commit 7c17a65.
4. **The othersIn sentence uses a typographic apostrophe** ('investor’s'), as reports.js writes its notes. The check
   accepts either form.
5. **Photos the template uses:** the cover photo when the cover is on and its style is 'photo', and every photo of an
   asset update in an 'on' section. A cover photo id left over on a band cover is not drawn, so it is not required.
6. **[Rule 3 - blocking] The check gives the portal sandbox Node's Blob** (`G.Blob = Blob`), as a browser has one;
   load11's stand-ins have none.
7. **[Rule 3 - blocking] The check sets GATE_FRESH=1 for itself** (afd1bb3; Failures first, item 1).
8. **Added assertions beyond the behaviour list:** the othersIn refusal, the change log verifying, no vendor name or the
   forbidden word in files, names and sentences, and file names holding the investor id.

No wave 1 file was changed. 12-05's and 12-06's files were not touched.

## Known Stubs
None.

## Threat Flags
None beyond the plan's register (T-12-30..33 are covered by the cases batch, refuse, archive, order and stop).

## Self-Check: PASSED
- FOUND: assets/js/reports-run.js
- FOUND: .planning/phases/12-report-builder/checks/reports-run.js
- FOUND: 2fed175, 9ed99c3, 38e7992, 17daf81, eef8c9a, 7c17a65, afd1bb3 (ancestors of HEAD)
