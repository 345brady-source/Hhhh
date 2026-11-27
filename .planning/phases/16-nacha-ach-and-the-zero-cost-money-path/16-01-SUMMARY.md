---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 01
subsystem: nacha builder, phase 16 checks and gate
status: complete
tags: [nacha, ach, holidays, banking-days, independent-reader, gate]
requires: []
provides:
  - "NS.nacha.fedHolidays(year), NS.nacha.EXTRA_CLOSED; isBankingDay / nextBankingDay / bankingDayReason by rule for any year"
  - "checks/achcli.sh: the pinned independent reader (moov-io/ach achcli v1.69.1, module hash pinned)"
  - "checks/lib16.js: loadPortal, NEVER, account, achFile, reader, validate, masked, leaks, runParts"
  - "checks/holidays.js HOLIDAYS (10), checks/reader.js INDEPENDENT READER (6)"
  - "checks/gate16.sh: the phase 16 gate, GATE16 SELF-TEST: PASS (9)"
affects: [16-02, 16-03, 16-04, 16-05, 16-06, 16-07, 16-08, 16-09, 16-10, 16-11, 16-12, 16-13, 16-14]
tech-stack:
  added: ["moov-io/ach achcli v1.69.1 (checks only, never shipped; Go module through the checksum database)", "moov-io/base v0.68.3 (once, to generate the holiday fixture)"]
  patterns: ["holiday rule per year kept in a Map", "reader only through achcli.sh; SKIP is a failure"]
key-files:
  created:
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/achcli.sh
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/lib16.js
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/holidays.js
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/reader.js
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/gate16.sh
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/fixtures/ach/holidays-2025-2035.txt
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/fixtures/ach/make-holidays/main.go
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/fixtures/ach/make-holidays/go.mod
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/fixtures/ach/make-holidays/go.sum
  modified:
    - assets/js/nacha.js
    - mobile/src/core/nacha.js
decisions:
  - "Record length is the builder's own check: the independent reader right-pads a short record, so a 93-character record is read as valid (measured); reader.js proves refusal on a record cut to 79 characters and a 95-character one instead"
  - "gate16.sh's RED renames the stand-in variables in the body first, so no self-test run is ever a real gate"
metrics:
  completed: 2026-11-27
  tasks: 3
estimate:
  tokens: 100000
  tasks: 3
actuals:
  tokens: 21000
  tasks: 3
  commits: 8
plan_head_before: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc
plan_head_after: 58ea765d1207dfc871033dab05117ff3d61b5330
---

# Phase 16 Plan 01: the independent reader, banking days by rule, the phase gate - Summary

Banking days are now worked out by rule for any year (the Federal Reserve's eleven holidays, Sunday closes the Monday, Saturday closes nothing, plus an empty dated list of extra closures); the rule equals the old 2025-2028 table (39 dates) and an independent calendar (112 dates, 2025-2035) both ways; the pinned independent reader is reproducible by exact version and module hash; gate16.sh passes in full on this tree (GATE_EXIT=0). Nothing here is called ready: the owner checks phase 16 at 16-14.

Base commit: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc (fresh worktree, no other plan's commits; 234f2a8 is an ancestor). Branch pushed: wip/16-01. Not merged.

## Failures first

1. The plan's reader case was wrong: "with one entry record cut to 93 characters it fails" is false for this reader. moov-io/ach v1.69.1 right-pads a short record before parsing it (reader.go readLine), so a 93-character record (it loses only the last trace digit) is read as valid; so are 92 and 90, with CRLF or LF. Case refused now proves a record cut to 79 characters (TraceNumber) and a 95-character record ("must be 94 characters") are refused and prints a NOTE that the 93-character one is read. Record length stays the builder's own check ("Every record is 94 characters"); later phase 16 plans must not count on the reader for it.
2. My first RED self-test of gate16.sh ran real gates. The plan said to copy gate12.sh and write the new self-test first; its stand-in variables (GATE16_*) were not read by the copied body (GATE12_*), so the control run was a real gate on this tree (the reference gate started server tests and a phase 6 browser check through heavy.sh). I stopped it by hand after about 5 minutes, killed its process tree, removed the server/node_modules link and folder it left, and used nothing from it. The RED that counts renames only the stand-in variables in the body first.
3. The first Task 3 verify run failed in the self-test, once: case only, with an empty output from its third sub-run (onlyreader). Not reproduced in 12 runs since (4 in the foreground, 6 in the background with the verify's environment, both verify reruns); it had passed once before too. The cause is not known; another agent's process cleanup or the full disk at that moment are possible, not shown. The failure branch now prints each sub-run's output with its line count (commit 58ea765). Kept: O/self-fail-1.txt.
4. The first full gate run failed six reference lines (FORMS FLOW, STATUS FLOW, SERVER MODE, TWO PERSONS, MEASURE, owner's folder) with browser crashes, "net::ERR_INSUFFICIENT_RESOURCES" and closed browsers while the machine's disk had 15 MB to 38 MB free (df: /dev/vda 100%; other agents' data, not this plan's 2.4 MB). That run then stopped at the 2-hour background limit during phase 10's checks. The rerun into the same folder (disk 3-4 GB free) ran those six again and they passed; every step that had passed was kept. Kept: O/gate-full-1.txt.

## Task 1 evidence

achcli.sh --path (first run, installed into the cache folder):
```
/root/.cache/cv-checks/achcli-v1.69.1/achcli
```
install.log: `go: github.com/moov-io/ach@v1.69.1 requires go >= 1.26.0; switching to go1.26.11`

achcli.sh --mod-line:
```
	mod	github.com/moov-io/ach	v1.69.1	h1:v+nHTd9qN4vYBmp+4mRf+8E/yztxoxxUtgMxgTGGtbo=
```

RED (O/red-1.txt, base tree nacha.js, commit 5bb8259):
```
FAIL y2029 2029-07-04 (Independence Day, a Wednesday) is not a banking day
FAIL y2029 2029-12-25 (Christmas, a Tuesday) is not a banking day
FAIL y2029 nextBankingDay('2029-07-03', 1) is 2029-07-05 :: 2029-07-04
FAIL y2029 bankingDayReason('2029-07-04') is 'is a Federal Reserve holiday' :: 
PASS schedule a sample workspace has an active monthly offering with paid runs
FAIL schedule ar-cedar-row paying monthly on the 4th, last paid 2029-06-04: the next payment is 2029-07-05, moved from 2029-07-04 :: {"date":"2029-07-04","nominal":"2029-07-04","moved":false}
PASS file a file effective 2029-07-05 passes the independent reader (-validate-file and -validate-totals)
PASS file the builder's own date check passes for 2029-07-05
FAIL file the same entries effective 2029-07-04 give a date check that is not ok ('Effective date is a Federal Reserve holiday') :: {"label":"Effective date is a future banking day","ok":true,"warn":false}
PASS file nothing this case prints holds a full routing or account number
HOLIDAYS: FAIL (cases run: 3) - y2029, schedule, file
```

Refusal paths of achcli.sh (measured, empty ACHCLI_HOME each time): GOSUMDB=off, GONOSUMDB=github.com/moov-io, GOPRIVATE=*.com, GOINSECURE=github.com/moov-io/ach, GOFLAGS=-insecure each print one SKIP line and exit 3; GONOSUMDB=github.com/other installs (exit 0); ACHCLI=/bin/ls prints "FAIL independent reader: /usr/bin/ls is not moov-io/ach v1.69.1 with the pinned module hash" (exit 4); no go on PATH prints SKIP (exit 3).

Task 1 verify (verbatim block, run from a script file): tail lines
```
PASS file the builder's own date check passes for 2029-07-05
PASS file the same entries effective 2029-07-04 give a date check that is not ok ('Effective date is a Federal Reserve holiday')
PASS file nothing this case prints holds a full routing or account number
HOLIDAYS: PASS (cases run: 3)
VERIFY1_EXIT=0
```

## Task 2 evidence

Fixture: `GOFLAGS=-mod=mod go run .` in fixtures/ach/make-holidays (go switched to go1.26.0 for the module's go line) wrote 112 dates; header lines name make-holidays, moov-io/base v0.68.3 (Apache-2.0) and `# Go version: go1.26.0`. Commit ace4810.

RED (O/red-2.txt; FAIL and last lines, each cut to 240 characters). The third run puts the base commit's nacha.js (the old table) into the working tree for the run and restores it after:
```
=== reader.js on this tree (lib16.achFile not written yet)
FAIL valid ran to the end :: TypeError: L.achFile is not a function
FAIL refused ran to the end :: TypeError: L.achFile is not a function
FAIL mask ran to the end :: TypeError: L.achFile is not a function
FAIL noreader it names the SKIP sentence ("SKIP independent reader: ...") :: FAIL valid ran to the end :: TypeError: L.achFile is not a function |     at files (...)
INDEPENDENT READER: FAIL (cases run: 6) - valid, refused, mask, noreader
exit 1
=== holidays.js on this tree (lib16.achFile not written yet)
FAIL file ran to the end :: TypeError: L.achFile is not a function
HOLIDAYS: FAIL (cases run: 10) - file
exit 1
=== holidays.js with the base commit's assets/js/nacha.js (the old 2025-2028 table) in the working tree
FAIL old ran to the end :: TypeError: NS.nacha.fedHolidays is not a function
FAIL independent every weekday the independent calendar closes is closed by isBankingDay :: ["2029-01-01","2029-01-15","2029-02-19","2029-05-28","2029-06-19","2029-07-04","2029-09-03","2029-10-08","2029-11-12","2029-11-22","2029-12-25","203
FAIL sunday 2029-11-12 is closed with 'is a Federal Reserve holiday' (Veterans Day 2029 falls on a Sunday) :: 
FAIL extra NS.nacha.EXTRA_CLOSED is an empty frozen list
FAIL extra nacha.js has the line const EXTRA_CLOSED = Object.freeze([
FAIL years ran to the end :: TypeError: NS.nacha.fedHolidays is not a function
FAIL mobile the rest of mobile/src/core/nacha.js equals assets/js/nacha.js
HOLIDAYS: FAIL (cases run: 7) - old, independent, sunday, extra, years, mobile
exit 1
```

Failure found while going GREEN (the plan's assumption was wrong): the plan's case refused says "with one entry record cut to 93 characters it fails". Measured: the independent reader accepts it. moov-io/ach v1.69.1 reader.go readLine right-pads any short record with spaces before parsing it; a 93-character record loses only the last trace digit and is read as valid (also 92 and 90, with CRLF or LF). Probed: a record cut to 35 or 60 or 79 characters, a 95-character record and a letter in the amount field are each refused. Case refused now proves: FileIDModifier lower-case refused (message names FileIDModifier); a record cut to 79 characters (trace number gone) refused (message names TraceNumber); a 95-character record refused (message "must be 94 characters"); and it prints a NOTE line that a 93-character record is read as valid. Record length is the builder's own check ("Every record is 94 characters"); later plans must not rely on the reader for it.

Task 2 verify (verbatim block from a script file):
```
==> .../exec-16-01/hol.txt <==
PASS mobile the rest of mobile/src/core/nacha.js equals assets/js/nacha.js
HOLIDAYS: PASS (cases run: 10)

==> .../exec-16-01/reader.txt <==
PASS selfcheck an empty --case list exits 1 with a FAIL line
INDEPENDENT READER: PASS (cases run: 6)
VERIFY2_EXIT=0
```

## Task 3 evidence

Failure (mine, found and stopped): the first RED self-test was gate12.sh copied with only the self-test rewritten. Its stand-in variables were GATE16_* while the body still read GATE12_*, so each stand-in run was a REAL gate run: the control started the real reference gate (server tests and a phase 6 browser check through heavy.sh) on this tree. Stopped by hand after about 5 minutes (process tree killed; the server/node_modules link and the self-test folder it left removed). No result of it was used. The RED below renames only the stand-in variables in the body (GATE12_* to GATE16_*), so every self-test run is a stand-in, and leaves every step as gate12.sh has it.

RED (O/red-3.txt; gate12.sh's steps with the new self-test):
```
SELF-TEST FAIL control: the stand-ins pass when nothing is wrong
    GATE ok   stand-in step
    GATE ok   server tests 197 = base 197 + 0 declared
    GATE ok   TEN STAND IN
    GATE ok   ELEVEN STAND IN
    GATE FAIL STAND IN
      stand-in.js: the last line should be: STAND IN: PASS (cases run: 1)
      stand-in.js: the last line was:       FAIL P16_BASE is not the base tree
    GATE_EXIT=1
SELF-TEST FAIL a tree without the independent reader
    (the same lines: no reader step, P16_BASE not passed)
SELF-TEST ok   a phase 16 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing after the reader step was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
SELF-TEST ok   a phase 11 check whose last line differs from its marker
SELF-TEST FAIL a phase-16-only run
    GATE FAIL unknown argument --only-phase16 (none, --self-test or --only-phase12)
    GATE_EXIT=1
GATE16 SELF-TEST: FAIL - control reader only
```

GREEN self-test (O/self.txt):
```
SELF-TEST ok   control: the stand-ins pass when nothing is wrong (reader step ok; base tree passed as P16_BASE, P11_ROOT and P10_BASE, P10_ROOT unset; never the line of a real gate)
SELF-TEST ok   a tree without the independent reader (its SKIP line fails the gate; every other step still runs)
SELF-TEST ok   a phase 16 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing after the reader step was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
SELF-TEST ok   a phase 11 check whose last line differs from its marker
SELF-TEST ok   a phase-16-only run ends 'GATE_EXIT=0 (phase 16 checks only)' with the reader step, no reference step and no server test line, and 'GATE_EXIT=1' when a phase 16 check fails or the reader cannot be had
GATE16 SELF-TEST: PASS (9)
```

B1 (base commit changed) proved on stand-ins (scratchpad b1.sh, --only-phase16, a check printing GATE_FRESH): base aaa, then aaa again (the step is "kept from ..."), then bbb:
```
NOTE base commit changed (aaa -> bbb): every step runs again
GATE ok   independent reader achcli v1.69.1
GATE ok   B1
GATE_EXIT=0 (phase 16 checks only)
-- FRESH=1
```

Phase-16-only run on this tree (`GATE_OUT=O bash gate16.sh --only-phase16`, O/gate-only.txt):
```
GATE ok   independent reader achcli v1.69.1
GATE ok   HOLIDAYS
GATE ok   INDEPENDENT READER
GATE_EXIT=0 (phase 16 checks only)
```

Full gate: the Task 3 verify block verbatim (scratchpad e1601/verify3.sh, with GATE_SERVER_TESTS=422 and the B1 grep added), in the background, GATE_OUT=O. Run 1 (21:29 UTC) failed six reference lines on the full disk and stopped at the time limit (failure 4); run 2 (23:38 to 01:09 UTC), into the same folder, ended:
```
GATE16 SELF-TEST: PASS (9)
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   ENGINE BOOKS
GATE ok   HOLDINGS
GATE ok   NO ONBOARDING
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE ok   HOLIDAYS
GATE ok   INDEPENDENT READER
GATE_EXIT=0
VERIFY3_EXIT=0
```
In O/gate-full.txt: 67 "GATE ok" lines, no "GATE FAIL", no NOTE line. Among them: "GATE ok   independent reader achcli v1.69.1"; the reference gate's 29 steps (server tests 422, # fail 0; STATUS MATH 13 through HELP PREVIEW 6; signing base 75 PASS / 0 FAIL and plan 75 / 0; record base 40 / 0 and plan 40 / 0; its own GATE_EXIT=0); "GATE ok   server tests 422 = base 422 + 0 declared"; phase 10's 13 checks (DIST FLOW through WITHHOLDING FLOW); phase 11's 12 checks, AUDIT SAME among them (the sample funds' year-end packages are byte-identical to the base's); HOLIDAYS; INDEPENDENT READER. The base tree, shots, checks-out, the owner folder, the reference copy and the node_modules link were removed (verified: `test ! -e O/gate/base-tree`, no server/node_modules in the worktree). No 99-prefixed run of 8 or more digits in any O/gate/*.txt.

GATE_EXIT=0.

## Commits (wip/16-01)

- 5bb8259 test(16-01): RED holidays.js y2029/schedule/file with the pinned reader achcli.sh and lib16.js
- 00f4a9a feat(16-01): Federal Reserve holidays by rule for any year in nacha.js
- ace4810 test(16-01): independent holiday fixture 2025-2035 from moov-io/base v0.68.3
- 983092f test(16-01): RED holidays.js 10 cases and reader.js 6 cases
- 8293f3b test(16-01): GREEN HOLIDAYS (10) and INDEPENDENT READER (6)
- 0a6a8ce test(16-01): RED gate16.sh self-test (reader case, P16_BASE, --only-phase16)
- 7ca9424 feat(16-01): gate16.sh steps 0-5, P16_BASE, GATE16_PHASES, --only-phase16 (self-test 9)
- 58ea765 fix(16-01): gate16 self-test names each phase-16-only output when the only case fails
- then this summary's commit

## Deviations from plan

1. [Rule 1 - the plan's check was wrong] reader.js case refused: a record cut to 79 characters and a 95-character record instead of a 93-character one (failure 1). Files: checks/reader.js. Commit 8293f3b.
2. [Rule 3 - blocking] gate16.sh RED: the stand-in variables are renamed in the body before the RED run, so the RED is gate12.sh's steps under the new self-test with no real gate started (failure 2). Commit 0a6a8ce.
3. [Rule 2] lib16.js has one helper more than the interfaces list: achFile(NS, opts), the fixture file (two PPD, one CCD credit to NEVER banks; balanced on request), shared by holidays.js and reader.js so no check types its own fixture. validate() also cuts every 5+ digit run in the reader's messages to its last four (a field error names the field's value). Commit 8293f3b, 5bb8259.
4. [Rule 2] gate16.sh passes P12_BASE to P15_BASE as well as P16_BASE to every check (for the GATE16_PHASES checks); GATE16_PHASES rejects a value outside 12-15 with a GATE FAIL line. Commit 7ca9424.
5. [Rule 2] achcli.sh also refuses GONOSUMDB, GONOSUMCHECK, GOPRIVATE and GOINSECURE matching github.com/moov-io/ach (checker I1); all five refusals measured (Task 1 evidence).
6. Executor state updates skipped: AUTOPILOT.md says executors never touch STATE.md or ROADMAP.md, and REQUIREMENTS.md is outside this plan's files; the orchestrator records AC-01 and AC-14.

## The reader choice (AC-14)

Downloaded by exact version and checksum: achcli.sh installs github.com/moov-io/ach/cmd/achcli@v1.69.1 with Go's checksum database on, into $HOME/.cache/cv-checks/achcli-v1.69.1 (outside the repository and the scratchpad), and accepts a binary only when `go version -m` shows the pinned module line. The first install here fetched nothing new (module and toolchain go1.26.11 were in the cache). Without a verified binary every check that needs it fails with the SKIP line (reader.js case noreader proves no PASS), and gate16.sh's step 0 fails the gate. The binary is never shipped and never committed; nothing a sponsor or investor sees names it.

## Known stubs

None. EXTRA_CLOSED is empty on purpose (C-01: empty at launch; one dated line closes a day, proven by case extra).

## Open items

- The independent reader does not check record length (it pads); phase 16 checks that need it must use the builder's own check or test the text themselves.
- One unexplained self-test failure (failure 3); diagnosis output added; not reproduced in 12 runs.
- The machine's disk was full (15-38 MB free) for part of the run, from other agents' scratchpad data (largest: edgar 9.1 GB, owner-set 2.5 GB, train 1.6 GB, exec-06-10 1.6 GB); browser checks of every running gate fail while it lasts. Nothing of it was deleted by this plan.
- The fixture's provenance line names go1.26.0 (the toolchain the module's go line chose for `go run`); achcli itself was built with go1.26.11.
- Not ready for anyone's use until the owner checks phase 16 (16-14).

## Threat flags

None beyond the plan's register (T-16-01 to T-16-04 mitigated as written: pinned hash and refusals, step 0 and case noreader, scrubbed messages and -mask only, the rule compared both ways with two sources).

## Self-Check: PASSED

- All nine created files and both modified files exist on HEAD 58ea765 (git ls-tree).
- All eight commits are ancestors of HEAD and on origin wip/16-01.
