# Phase 14 Plan 05: the server data room - Summary (in progress, evidence saved as produced)

Base commit 30293baa89cf2ba6631a853c430d02702d9df2b2; base server tests 422 (all pass).

## Task 1 RED (red-1.txt)
```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../server/lib/dataroom.mjs' imported from .../server/test/dataroom.test.mjs
not ok 1 - test/dataroom.test.mjs
# tests 1
# pass 0
# fail 1
```
Task 1 verify:
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 735.079379
VERIFY1_EXIT=0
```

## Task 2 RED (red-2.txt): six of the eight new tests failed; basis and stamp passed at RED
```
ok 1 - tracer
ok 2 - basis
not ok 3 - exempt          201 !== 409
not ok 4 - openlink        404 !== 422
not ok 5 - tokens          404 !== 201 (link renewal route missing)
not ok 6 - nda             404 !== 200 (new NDA route missing)
not ok 7 - docs            201 !== 422 (30-document limit missing)
ok 8 - stamp
not ok 9 - esign           422 !== 201 ('Add the NDA text.')
# tests 9
# pass 3
# fail 6
```
Task 2 verify:
```
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1450.334464
VERIFY2_EXIT=0
```
