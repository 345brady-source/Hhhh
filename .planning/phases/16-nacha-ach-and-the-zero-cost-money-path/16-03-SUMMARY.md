---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 03
status: in-progress
---

# Phase 16 Plan 03: fixture hygiene (F-13) Summary (in progress)

Base commit: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc (contains 234f2a8). Output folder O = SCRATCH/exec-16-03.

## Failures first

- red-1.txt was overwritten once by a GREEN rerun of the same script; RED was reproduced on the RED commit's own tree
  (7f1fa8f, extracted by git archive into O, removed after) and is identical to the first RED run's output.

## Task 1 (tracer)

RED (O/red-1.txt, on the tree of 7f1fa8f = the base plus the new checks):

```
FAIL product the scan over assets/ and mobile/src/ (103 files) finds no routing number a bank can have :: ["assets/js/data.js:210 ending 3186","assets/js/tenants.js:105 ending 5810","assets/js/tenants.js:106 ending 5810","assets/js/tenants.js:114 ending 5810","assets/js/tenants.js:217 ending 2157","assets/js/tenants.js:218 ending 2157","assets/js/tenants.js:226 ending 2157","assets/js/tenants.js:326 ending 0781","assets/js/tenants.js:327 ending 0781","assets/js/tenants.js:335 ending 0781","assets/js/tenants.js:431 ending 8639","assets/js/tenants.js:432 ending 8639","assets/js/tenants.js:440 ending 8639","mobile/src/core/data.js:174 ending 3186","mobile/src/core/tenants.js:102 ending 5810","mobile/src/core/tenants.js:103 ending 5810","mobile/src/core/tenants.js:111 ending 5810","mobile/src/core/tenants.js:213 ending 2157","mobile/src/core/tenants.js:214 ending 2157","mobile/src/core/tenants.js:222 ending 2157","mobile/src/core/tenants.js:321 ending 0781","mobile/src/core/tenants.js:322 ending 0781","mobile/src/core/tenants.js:330 ending 0781","mobile/src/core/tenants.js:425 ending 8639","mobile/src/core/tenants.js:426 ending 8639","mobile/src/core/tenants.js:434 ending 8639"]
FAIL product NS.data.fakeRouting drawn 2,000 times: every number passes the ABA check digit and has a prefix no bank has (24 prefixes drawn) :: ["draw 1: ending 3917 prefix 31","draw 2: ending 5392 prefix 06", ...]
ACH LEAK: FAIL (cases run: 2) - product
FAIL copies mobile/src/core/brand.js is the sync-core header line plus assets/js/brand.js :: the copy differs from its source from line 122 (copy 445 lines, header plus source 517)
FAIL copies mobile/src/core/tenants.js is the sync-core header line plus assets/js/tenants.js :: the copy differs from its source from line 51 (copy 620 lines, header plus source 627)
FAIL copies mobile/src/core/data.js is the sync-core header line plus assets/js/data.js :: the copy differs from its source from line 116 (copy 592 lines, header plus source 827)
FAIL loads kestrel-bay: the mobile workspace equals the one the web files seed
FAIL loads ashwell-ridge: the mobile workspace equals the one the web files seed
FAIL loads greywater: the mobile workspace equals the one the web files seed
FAIL loads pellbrook: the mobile workspace equals the one the web files seed
MOBILE SYNC: FAIL (cases run: 3) - copies, loads
```
(selfcheck passed at RED: 14 PASS lines; it proves the rule, not the tree.)

GREEN: the swap script (O/swap.js) printed (O/swap-1.txt):
```
assets/js/data.js: ending 3186: prefix 04 -> 15 at 1 place; fakeRouting district list: 24 prefixes -> their images, same order
assets/js/tenants.js: ending 5810: prefix 02 -> 13 at 3 places; ending 2157: prefix 06 -> 17 at 3 places; ending 0781: prefix 11 -> 88 at 3 places; ending 8639: prefix 12 -> 90 at 3 places
```
Diff read with `git diff --word-diff` (numbers masked to endings when read): with the first two digits of every 9-digit
run masked, the removed and added lines of both files (the district list line aside) are identical (md5 93dd01d2...
both sides). Comments added: tenants.js header (prefixes no bank has), data.js above fakeRouting. sync-core run;
mobile/src/core/nacha.js restored (16-01's).

Verify (Task 1, verbatim block, O/v1.sh):
```
ACH LEAK: PASS (cases run: 2)
MOBILE SYNC: PASS (cases run: 3)
VERIFY1_EXIT=0
```
Product commit (Task 3's gate base): a072fb3630a00e2698ee02a15781b45b5f4891d6.

## Task 2

First RED run (O/red-2-first-draft.txt) showed two faults of the check itself, fixed before the RED below:
- the plan's scan rule flagged phase 11's fund-a.ofx:28 and fund-a.qfx:37 (`<BANKID>`, ending 0000): the all-zero
  number, which passes the arithmetic with prefix 00 but is issued to no one (a blank bank id). Those two files are not
  in files_modified and 00 has no PREFIX_SWAP image, so the rule now leaves the all-zero number out; selfcheck plants
  one and proves it is not found. (Deviation 1.)
- the finding list was cut at the reporter's 1,500 characters; every finding is now printed on its own `found:` line.

RED (O/red-2.txt, the base's ten files):
```
  found: .planning/phases/01-accurate-field-placement/checks/fixtures.js:207 ending 0021
  found: .planning/phases/04-signing-inside-onboarding/checks/lib.js:303 ending 0021
  found: .planning/phases/05-signed-record/checks/flow.js:227 ending 0021
  found: .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/bank-step-typing.js:30 ending 0021
  found: .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js:333 ending 0021
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js:30 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js:54 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-b.js:42 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-b.js:52 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-c.js:15 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-c.js:38 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/posting.js:70 ending 3186
  found: .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/posting.js:93 ending 3186
  found: server/test/invitations.test.mjs:46 ending 0021
  found: server/test/invitations.test.mjs:220 ending 0021
FAIL checks the scan over server/test/, server/lib/ and every phase's checks folder finds no routing number a bank can have :: 15 found (listed above)
  found: server/test/invitations.test.mjs:371 ending 0021
FAIL checks no copy of such a number left on a line without a routing word (a number found in the same file, or one whose swap image is in it) :: 1 found (listed above)
ACH LEAK: FAIL (cases run: 1) - checks
```

GREEN: the same swap script (O/swap-2.txt):
```
server/test/invitations.test.mjs: ending 0021: prefix 02 -> 13 at 3 places
.planning/phases/01-accurate-field-placement/checks/fixtures.js: ending 0021: prefix 02 -> 13 at 1 place
.planning/phases/04-signing-inside-onboarding/checks/lib.js: ending 0021: prefix 02 -> 13 at 1 place
.planning/phases/05-signed-record/checks/flow.js: ending 0021: prefix 02 -> 13 at 1 place
.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js: ending 0021: prefix 02 -> 13 at 1 place
.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/bank-step-typing.js: ending 0021: prefix 02 -> 13 at 1 place
.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js: ending 3186: prefix 04 -> 15 at 2 places
.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-b.js: ending 3186: prefix 04 -> 15 at 2 places
.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-c.js: ending 3186: prefix 04 -> 15 at 2 places
.planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/posting.js: ending 3186: prefix 04 -> 15 at 2 places
```
(invitations.test.mjs: lines 46, 220 and 371, B3.) Each diff read with `git diff --word-diff` (masked): 16 lines, with the
first two digits of every 9-digit run masked the removed and added lines are identical (md5 6106d7a2... both sides).
Repo-wide after the swap, the five old numbers remain only in planning documents (outside AC-13; see Open items).

Verify (Task 2, verbatim block plus B3 and the server count, O/v2.sh):
```
ACH LEAK: PASS (cases run: 3)
BANK STEP TYPING: PASS (parts run: 2)
VERIFY2_EXIT=0
POSTING: PASS (cases run: 13)
B3_LINE371_EXIT=0
SERVER_TEST_EXIT=0
# tests 422
# pass 422
# fail 0
```
Task 2 GREEN commit: 03d2bb8 (made as the save commit before the reruns; nothing changed after it).

<!-- gsd:write-continue -->
