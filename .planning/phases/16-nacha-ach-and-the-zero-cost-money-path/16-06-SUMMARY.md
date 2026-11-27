# Phase 16 Plan 06 (draft, written as the work goes)

Base commit: 00c32a762b9d115b6bdfebfeb7f56b925e6866e6 (fresh worktree; 00c32a7 is HEAD). Branch pushed: wip/16-06.

## Task 1 evidence

RED (O/red-1.txt, commit 2525d5e; lines cut to 240 characters, stack trimmed):
```
FAIL return ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a761df20a43482e28/assets/js/achreturns.js'
PASS fixtures MANIFEST.txt lists exactly the 2 fixtures
PASS fixtures every file's size and SHA-256 equal MANIFEST.txt's
PASS fixtures make-fixtures.js --out <a temporary folder> exits 0
PASS fixtures it writes exactly the fixtures and MANIFEST.txt
PASS fixtures every file it writes is byte-equal to the committed one (MANIFEST.txt too)
PASS fixtures dist-ppd.ach passes the independent reader (-validate-file and -validate-totals)
PASS fixtures ret-r03.ach passes the independent reader (-validate-file and -validate-totals)
PASS fixtures the fixtures hold no routing number with an assigned prefix (leaks() finds nothing)
PASS fixtures every 9-digit number in them that passes the check digit is a never-issued one (prefix 19)
PASS fixtures every entry of every NACHA fixture is to a never-issued bank (prefix 19) and an account starting 99
RETURNS READ: FAIL (cases run: 2) - return
```
Measured (plan-check info): the pinned reader accepts the synthesized return file (code 21, addenda 99): -validate-file and -validate-totals exit 0 with no message; its -mask summary lists the entry under Category "Return" with Addenda99 ReturnCode R03.

Task 1 verify (verbatim block):
```
PASS fixtures every 9-digit number in them that passes the check digit is a never-issued one (prefix 19)
PASS fixtures every entry of every NACHA fixture is to a never-issued bank (prefix 19) and an account starting 99
RETURNS READ: PASS (cases run: 2)
VERIFY1_EXIT=0
```
