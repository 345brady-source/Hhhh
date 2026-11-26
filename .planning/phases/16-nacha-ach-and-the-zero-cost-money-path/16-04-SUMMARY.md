# Phase 16 Plan 04 (draft, in progress)

Base commit: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc

## RED, Task 1 (red-1.txt, at 8c30b8b)

```
FAIL returned desired holds one ret:fa-run-1:FA-1001 dated 2026-12-17: [1000 +600,000 FA-1001][2000 -600,000 FA-1001] :: []
FAIL returned its memo is 'Returned distribution fa-run-1: FA-1001'
FAIL returned sync posts the 15 record entries and the return, reverses nothing and lists nothing :: {"posted":15,"reversed":0,"exceptions":0}
FAIL returned 2026 trial balance: 2000 is -600,000, all of it owed to FA-1001 :: {...}
FAIL returned cash is 3,800,000: the unreturned 3,200,000 plus the 600,000 that came back :: {"now":3200000,"before":3200000}
POSTING RETURNS: FAIL (cases run: 1) - returned
```

## Verify, Task 1 (at 348fe6c)

```
POSTING RETURNS: PASS (cases run: 1)
VERIFY1=0
```
Phase 11 POSTING on the same tree: `POSTING: PASS (cases run: 13)`.
