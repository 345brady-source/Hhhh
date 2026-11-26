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
