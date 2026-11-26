# Phase 16 Plan 01 - draft (evidence pasted as produced; not finished)

Base commit: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc (fresh worktree; 234f2a8 is an ancestor).

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
