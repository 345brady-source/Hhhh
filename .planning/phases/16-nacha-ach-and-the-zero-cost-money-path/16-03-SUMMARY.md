---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 03
subsystem: fixtures, sample data, mobile core copies
tags: [F-13, F-18, C-09, AC-13, AC-14, routing-numbers, fixtures]
status: complete
requires: []
provides:
  - ".planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/ach-leak.js: ACH LEAK: PASS (cases run: 4)"
  - ".planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/mobile-sync.js: MOBILE SYNC: PASS (cases run: 3)"
affects: [every later phase 16 fixture, AUDIT SAME bases older than this merge, 13-01, 13-06]
tech-stack:
  added: []
  patterns: ["PREFIX_SWAP: first two digits moved to a prefix no routing number has, same (3a+7b) mod 10, so check digit and last seven digits stay"]
key-files:
  created:
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/ach-leak.js
    - .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/mobile-sync.js
  modified:
    - assets/js/data.js
    - assets/js/tenants.js
    - mobile/src/core/brand.js
    - mobile/src/core/data.js
    - mobile/src/core/tenants.js
    - server/test/invitations.test.mjs
    - .planning/phases/01-accurate-field-placement/checks/fixtures.js
    - .planning/phases/04-signing-inside-onboarding/checks/lib.js
    - .planning/phases/05-signed-record/checks/flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/bank-step-typing.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-a.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-b.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/fixtures/fund-c.js
    - .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/posting.js
decisions:
  - "The all-zero 9-digit number is not treated as a bank's routing number (issued to no one; phase 11's OFX/QFX fixtures use it as a blank BANKID)"
  - "ACH LEAK's packages case puts P16_BASE's path and the hash of its diy.html and assets/js on the kept-part command line, so a kept result belongs to one base"
metrics:
  completed: 2026-11-27
  tasks: 3
estimate_vs_actual: "estimate 90000 tokens; actual about 30000 (chars/4 of the diff, 116,420 chars without this summary)"
actuals:
  tokens: 30000
  tasks: 3
  commits: 8
plan_head_before: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc
plan_head_after: see the final commit of wip/16-03 (this summary's own commit)
---

# Phase 16 Plan 03: fixture hygiene (F-13) Summary

Every routing number a bank can have in the portal's sample data, the mobile copies, the server test and the other
phases' checks now carries a prefix no bank has (PREFIX_SWAP); check digits and last seven digits are unchanged, the
mobile core copies are regenerated, and the 15 sample funds' audit packages differ from the base only by those prefixes.
Nothing here is called ready: the owner has not checked it.

Base commit: 4fe3aa08632eff16ce8282480e5fdb29bb3fc2bc (contains 234f2a8). Output folder O = SCRATCH/exec-16-03.

## Failures first

- Gate run 1 (gate11 into O/gate-run, base = the product commit) FAILED six reference-gate browser steps and was then
  killed at the 2-hour background limit before it finished: `GATE FAIL FORMS FLOW (34)`, `GATE FAIL STATUS FLOW (26)`,
  `GATE FAIL SERVER MODE (15)`, `GATE FAIL TWO PERSONS`, `GATE FAIL MEASURE`, `GATE FAIL owner's folder: index.txt and
  four signed PDFs`. Cause measured at the time: the machine's disk was full (`df -h /`: 27M-200M available, 100%);
  the failures are browser crashes (`page.screenshot: Target crashed`, `Page crashed`, `Unable to capture screenshot`).
  Kept in O/gate-1-killed.txt and O/reference-1-killed.txt. Rerun into the same folder once space was back (3.5G free):
  all six passed, nothing changed in the tree between the runs, and the gate ended GATE_EXIT=0 (Task 3 below).
- First RED run of case checks (O/red-2-first-draft.txt) showed two faults of the check itself (fixed before the RED
  that counts; see Task 2 and Deviation 1).
- red-1.txt was overwritten once by a GREEN rerun of the same script; RED was reproduced on the RED commit's own tree
  (7f1fa8f, extracted by git archive into O, removed after) and is identical to the first RED run's output.
- Not done by this executor (outside files_modified, left to the orchestrator): STATE.md, ROADMAP.md and
  REQUIREMENTS.md updates.

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

## Task 3

RED (O/red-3.txt):
```
RED: case packages with no P16_BASE
FAIL packages a base tree to compare with: P16_BASE is not set; this case never compares a tree with itself
ACH LEAK: FAIL (cases run: 1) - packages
exit 1
RED: case packages with this checkout as P16_BASE
FAIL packages a base tree to compare with: P16_BASE (/home/user/Hhhh/.claude/worktrees/agent-aca267dc2cb1953cc) is this checkout; this case never compares a tree with itself
ACH LEAK: FAIL (cases run: 1) - packages
exit 1
```
The case was complete in its RED commit (25771d5): against the base commit's tree it passed at once (O/try3.txt), so
there is no separate Task 3 GREEN commit. What it does (16-CONTEXT W1, the 11-18 expected-difference approach applied
to digits): substitution on the base side only, digit-bounded (a 9-digit run equal to one of the base's 76 bank-like
routing numbers: 4 firm numbers and the sample investors'; the first 8 digits of a 15-digit trace equal to one of the
base's 4 originating-bank prefixes); an entry equal byte for byte or after substitution passes, the README may differ
only in its "Generated:" line, and a substituted entry's MANIFEST line must be that entry's SHA-256 in this tree's
package (the audit-same.js rule). Unlike 11-18, nothing is recomputed from the base's own entries: only the exact
PREFIX_SWAP image is absorbed, which the selfcheck proves by reporting a different prefix.

Verify (Task 3, verbatim block, O/v3.sh; ACH LEAK against the base commit's tree, then gate11 with the product commit
a072fb3 as base). The rerun's ACH LEAK printed KEPT for its four cases, kept from run 1's fresh pass on the same tree
(O/leak-1.txt):
```
PASS packages diy: every entry of the 30 sample packages equals the base's, the swapped prefixes aside (19 entries needed the swap, 3168 digit runs)
PASS packages diy: the base holds 76 bank-like routing numbers and 4 originating prefixes; at least one entry needed the swap, so the proof is not empty
PASS packages managed: every entry of the 30 sample packages equals the base's, the swapped prefixes aside (19 entries needed the swap, 3168 digit runs)
PASS packages managed: the base holds 76 bank-like routing numbers and 4 originating prefixes; at least one entry needed the swap, so the proof is not empty
PASS selfcheck allowed: the copy with its moved prefixes put back: 6 packages equal after the swap (6 entries, 225 digit runs substituted)
PASS selfcheck reported: one cent on a sample fund (kb-fund-ii-2026-09-24 (total one cent larger))
PASS selfcheck reported: one non-prefix trace digit changed (the last digit of the first trace in 06_Capital_activity_ledger.csv)
PASS selfcheck reported: the traces' prefix moved to a prefix that is not the swap image (in 06_Capital_activity_ledger.csv)
PASS selfcheck reported: a substituted entry whose MANIFEST line is not its SHA-256 (06_Capital_activity_ledger.csv)
ACH LEAK: PASS (cases run: 4)
```
gate11 (O/gate.txt, last 15 lines, then the named lines):
```
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
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
GATE_EXIT=0
VERIFY3_EXIT=0
```
```
GATE ok   BANK STEP TYPING (2) (kept from 2026-11-26 22:46:35 UTC)
GATE ok   server tests 422 = base 422 + 0 declared
GATE ok   AUDIT SAME
```
59 `GATE ok` lines, 0 `GATE FAIL`. AUDIT SAME (product commit as base): `compared 928 schedules and 60 packages (60
byte-identical as whole files) of 15 funds`, `AUDIT SAME: PASS (cases run: 4)`. The reference gate's steps that failed in
run 1 passed in the rerun: FORMS FLOW (34), STATUS FLOW (26), SERVER MODE (15), TWO PERSONS, MEASURE, owner's folder.
The gate named is gate11 (not gate16), so gate11 is what ran.

## Every number changed (endings only)

| Ending | Prefix | Image | Files (places) |
|---|---|---|---|
| 5810 | 02 | 13 | assets/js/tenants.js (3: odfiRouting, destinationRouting, offset.routing) |
| 2157 | 06 | 17 | assets/js/tenants.js (3) |
| 0781 | 11 | 88 | assets/js/tenants.js (3) |
| 8639 | 12 | 90 | assets/js/tenants.js (3) |
| 3186 | 04 | 15 | assets/js/data.js:210 (1, the sample trust); P11 fixtures fund-a.js 30, 54; fund-b.js 42, 52; fund-c.js 15, 38; posting.js 70, 93 |
| 0021 | 02 | 13 | server/test/invitations.test.mjs 46, 220, 371; P1 checks/fixtures.js 207; P4 checks/lib.js 303; P5 checks/flow.js 227; P6 checks/lib.js 333; P6 bank-step-typing.js 30 |
| (draws) | 01-12, 21-32 | their 24 images | assets/js/data.js fakeRouting's list, same order and length |

mobile/src/core/tenants.js and data.js carry the same values through sync-core (brand.js only caught up with its
source). mobile/src/core/nacha.js unchanged from the base (16-01's).

## Kept on purpose (C-09, for the owner)

The two BAI2 samples under phase 11's checks/fixtures/bank/real/ (sample1.txt, sample2.txt; endings 9999 and 7890 per
the plan check) are an outside project's published test data (moov-io/bai2), copied byte for byte with SOURCE.txt and
LICENSE. ACH LEAK does not scan that folder and names it in its NOTE line, with assets/vendor/ and assets/forms/
(third-party files pinned by hash, B2).

## Deviations from Plan

1. [Rule 1 - Bug in the plan's scan rule] The rule as written flags phase 11's fund-a.ofx:28 and fund-a.qfx:37
   (`<BANKID>`, ending 0000), which the plan's measured list did not hold. It is the all-zero number: it passes the ABA
   arithmetic with prefix 00 but is issued to no one (a blank bank id), 00 has no PREFIX_SWAP image, and both files are
   outside files_modified. The rule now leaves the all-zero number out; selfcheck plants one under assets/js and proves it
   is not found. Commit 106b67c.
2. [Rule 2 - Completeness] Every finding is printed on its own `found:` line: the reporter cuts a check's detail at
   1,500 characters, which hid the last findings (server/test lines 46 and 220) in the first RED. Commit 106b67c.
3. [Rule 2 - Correctness] runParts' kept-part key holds the command line but not the environment, so a passing packages
   result could have been kept for a different P16_BASE. ach-leak.js adds `--p16-base <path>:<hash of diy.html and
   assets/js>` to its own argv before runParts, so a kept result belongs to exactly one base. Commit 25771d5.
4. [Additions within the plan's files] mobile-sync's loads case also requires each sample firm's mobile workspace to
   equal the one the web files seed (JSON, Date fixed); comments added above data.js fakeRouting and in tenants.js's
   header.
5. Task 2's GREEN content went in as the save commit 03d2bb8 (made before the reruns, as the save rules require);
   nothing changed after it, so no separate GREEN commit exists. Task 3 likewise (see above).

## Open items (for the orchestrator)

- Merged-tree gate: a merged-tree gate whose base is older than this merge must take this plan's product commit
  (a072fb3630a00e2698ee02a15781b45b5f4891d6) as AUDIT SAME's base, or a base after the merge; that base must also hold the
  11-12 and 11-18 merges (16-CONTEXT I4), or AUDIT SAME also reports their package changes.
- Phase 13 plans hold the 0021 bank number as test data: 13-01-PLAN.md:174 (test 1 "patterns", screen() refuses it) and
  13-06-PLAN.md:115 (screen-refused). If they are executed as written, a bank's number goes back into server/test or a
  checks folder; ACH LEAK's checks case finds it only on a line with a routing word. Use the image (prefix 13, same
  ending) when those plans run.
- Planning documents still hold real numbers (outside AC-13, 16-CONTEXT I2): 16-RESEARCH.md (all five), 16-03-PLAN.md,
  06-WALKTHROUGH-2.md, and the two phase 13 plans above. Mask to endings when next edited.
- The machine's disk was full during gate run 1 (other agents' scratch folders, 25G in SCRATCH, the largest edgar 9.1G
  and owner-set 2.5G); browser checks crash when it is. Not touched by this executor.
- Owner check: nothing here has been seen by the owner.

## Threat Flags

None: no new endpoint, auth path or trust boundary; the checks read files and write only temporary folders they remove.

## Commits (wip/16-03)

- 7f1fa8f test(16-03): RED ach-leak product/selfcheck and mobile-sync checks
- a072fb3 feat(16-03): sample firms and investors use routing prefixes no bank has (product commit)
- bca3b13 wip(16-03): save summary draft (Task 1 evidence)
- 106b67c test(16-03): RED ach-leak case checks (server tests, server lib, every phase's checks)
- 03d2bb8 wip(16-03): save Task 2 swap before its reruns (Task 2 GREEN)
- 25771d5 test(16-03): RED ach-leak case packages (sample packages differ only by the swap)
- ca971c2 wip(16-03): save summary (Task 2 evidence); the Task 3 verify and gate11 ran on this HEAD
- this summary's commit

## Self-Check: PASSED

Files: ach-leak.js, mobile-sync.js and the 15 changed files exist (git diff 4fe3aa0 HEAD lists the 17 plan files and
this summary, nothing else). Commits 7f1fa8f, a072fb3, bca3b13, 106b67c, 03d2bb8, ca971c2, 25771d5 are ancestors of HEAD.
server/node_modules link removed.
