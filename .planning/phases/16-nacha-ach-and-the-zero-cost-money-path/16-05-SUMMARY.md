---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 05
status: in-progress
---

# Phase 16 Plan 05: builder refusals, same-day limit and pre-notes (draft, evidence as it is produced)

Start commit: 00c32a762b9d115b6bdfebfeb7f56b925e6866e6

## RED 1 (Task 1, at the start commit: `node checks/nacha-build.js --case sec,reader`, exit 1)

```
PASS sec the two PPD/CCD entries are in the file (INV-1, INV-4)
FAIL sec the entry with no SEC type is left out with "No SEC type" :: []
FAIL sec the WEB entry is left out with "SEC type WEB is not one these payments use" :: []
FAIL sec every entry given is either in the file or left out (4 = 2 + 2) :: 2 + 0
FAIL sec the totals check is ok :: {"label":"Batch and file totals equal the sum of entries","ok":false}
FAIL sec result.entries lists the two entries with their refs (REQ-1, REQ-4)
PASS reader fixture: every record is 94 characters
PASS reader fixture: no red check, and the independent reader passes it
PASS reader fixtureBalanced: every record is 94 characters
PASS reader fixtureBalanced: no red check, and the independent reader passes it
PASS reader fixtureSameDay: every record is 94 characters
PASS reader fixtureSameDay: no red check, and the independent reader passes it
PASS reader sec: every record is 94 characters
PASS reader at least one file was read by the independent reader
NACHA BUILD: FAIL (cases run: 2) - sec
```

At the start commit the entry with no SEC type and the WEB entry vanished from the file with no reason, and the totals
check turned red without saying why.

## Task 1 verify (GREEN, `--case sec,reader`; plan's automated verify exit 0)

```
NACHA BUILD: PASS (cases run: 2)
VERIFY=0
```
(all 15 check lines PASS, among them "sec ... left out with \"No SEC type\"" and "reader sec: no red check, and the independent reader passes it"). Tracer re-run: same result; expanding.
