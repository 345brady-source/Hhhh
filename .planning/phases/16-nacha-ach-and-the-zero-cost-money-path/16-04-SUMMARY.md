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

## RED, Task 2 (red-2.txt, at 637efae; the 23 lines are the FAIL lines, cut at 200 characters)

```
FAIL repaid desired holds one repaid:fa-run-1:FA-1001 dated 2026-12-23: [2000 +600,000 FA-1001][1000 -600,000 FA-1001] :: []
FAIL cancelled sync reverses the three and posts nothing :: {"posted":0,"reversed":2,"exceptions":0}
FAIL redemption reqret:req-b-1 dated 2027-01-06: [1000 +200,000 B-1][2200 -200,000] :: []
FAIL redemption reqrepaid:req-b-1 dated 2027-01-12: [2200 +200,000][1000 -200,000 B-1] :: []
FAIL amount a redemption return of 199,999 against 200,000 paid: no reqret: entry, listed as 'amount' :: []
FAIL idempotent fund A with ret: and repaid: posted: a second sync posts, reverses and lists nothing; ws.books identical :: {"posted":0,"reversed":0,"exceptions":0}
FAIL sample one more entry is posted than in the unreturned copy :: {"A":{"posted":427,"reversed":0,"exceptions":0},"B":{"posted":405,"reversed":0,"exceptions":23}}
FAIL sample cash is up by the net (875000) and 2000 down by it :: {"A":[29124021,null],"B":[-110295506,-875000]}
FAIL sample no other account moves :: [["1100",660397858,659388197],["1150",281278825,280848788],["2100",-1062500,-25500000],["3900",-477073811,-374316479],["6100",-63414393,0]]
POSTING RETURNS: FAIL (cases run: 10) - repaid, cancelled, redemption, amount, idempotent, sample
```
(The sample lines show W2 measured: with only ret: added, a Kestrel Bay return left 23 sample months unbalanced.)

## Verify, Task 2 part 1 (at 5047f14)

```
PASS sample no other account moves
POSTING RETURNS: PASS (cases run: 10)
PART1=0
```
67 PASS lines, 0 FAIL.
