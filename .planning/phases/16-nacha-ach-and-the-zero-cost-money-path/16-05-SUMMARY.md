---
phase: 16-nacha-ach-and-the-zero-cost-money-path
plan: 05
subsystem: nacha-builder
tags: [nacha, ach, prenote, same-day, refusals, mobile-sync]
status: complete
requires: [16-01 lib16.js (achFile, NEVER, account, validate), achcli.sh pinned reader]
provides: [build() kinds credit/prenote, check levels block/warn/ok, result.blocked, result.entries, SAME_DAY_LIMITS, RESERVED_DESCRIPTIONS, checks/nacha-build.js (11 cases)]
affects: [16-02 (Download/Copy wait on ok false), 16-07 and 16-09 (pre-note files), 16-12 (redemption refs via result.entries)]
tech-stack:
  added: []
  patterns: [dated table for a limit that changes on a date, check level derived from ok/warn]
key-files:
  created: [.planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/nacha-build.js]
  modified: [assets/js/nacha.js, mobile/src/core/nacha.js]
decisions:
  - "A red check outranks amber: a check with ok false has warn false and level block (an effective date of today that is a holiday was ok false and warn true)"
  - "An entry kind other than credit or prenote is left out with 'Entry kind <x> is not one these payments use'"
  - "No same-day warning on the offsetting debit; investor entries only"
metrics:
  started: 2026-11-27T01:28:15Z
  completed: 2026-11-27T04:58:00Z
  tasks: 2
  files: 3
actuals:
  tokens: 13000
  tasks: 2
  commits: 4
plan_head_before: 00c32a762b9d115b6bdfebfeb7f56b925e6866e6
plan_head_after: 9ccb9e38b4dac9e04872381aeceb77737504463e
---

# Phase 16 Plan 05: builder refusals, same-day limit and pre-notes Summary

The NACHA builder (both editions) now refuses a bad file ID modifier, leaves out an entry with no SEC type or an unused
one with its reason, flags a same-day entry above the dated limit in amber, makes a bad settlement account, company ID,
company name, reserved description or bank routing number a red check with no broken record written, and builds
pre-notes ($0.00, codes 23/33); every file without a red check passes the independent reader (NACHA BUILD 11 cases,
gate16 GATE_EXIT=0). Not checked by the owner; not ready before he has.

Start commit: 00c32a762b9d115b6bdfebfeb7f56b925e6866e6 (worktree fresh, no other plan's commits).

## Failures and what is not done (read first)

- **The first gate run was stopped at the 2-hour limit** while the reference gate's browser steps were still running
  (disk 8.0G free at the time, no crash). Rerun into the same folder: 29 steps kept, the rest ran, GATE_EXIT=0. The
  killed run left the server/node_modules link it made; removed by hand.
- **Until 16-02 merges, a file with a red check can still be downloaded and copied.** console.js on this tree
  (fileSection, read as the tree has it) only colours the checks; Download file and Copy file stay enabled. A balanced
  file with a bad settlement account would download without its offsetting debit (the builder no longer writes a broken
  offset record, but the console does not stop the download). ok is false exactly for a red check, so 16-02's rule needs
  no change for these refusals. **The owner's check of the builder waits for 16-02.**
- The console shows none of the new field hints yet (offset required in "Ready", the offering's company ID, the
  description field): 16-09.
- Eight of the eleven reserved descriptions are **assumed** (16-RESEARCH F-11, A3): REVERSAL, RETURN FEE, RECLAIM,
  NONSETTLED, RETRY PYMT, AUTOENROLL, REDEPCHECK, HCCLAIMPMT. PAYROLL, PURCHASE and ACCTVERIFY are cited.
- The same-day warning covers investor entries only, not the offsetting debit; whether the bank counts the settlement
  offset against the limit is to be confirmed from its ACH guide.
- Modifier stepping per day and the 37th file (C-02) are 16-02's; the 3-banking-day pre-note wait (C-03) is 16-07's.

## Result fields later plans rely on

- `checks[]`: `{ label, ok, warn, level }`, level `'block' | 'warn' | 'ok'`; ok false exactly for block, warn true exactly
  for warn. `blocked`: the block checks (16-02: Download and Copy wait while it is not empty).
- `entries[]`: `{ id, ref, trace (15 characters as written), cents, code, kind, sec, batch }` in file order, offsetting
  debits not listed (16-02 recordFile, 16-12 matches redemption requests by `ref`).
- `excluded[]`: `{ entry, reason }`, reasons in this order: routing check digit; account; 'No SEC type'; 'SEC type <X> is
  not one these payments use'; 'Entry kind <x> is not one these payments use'; 'Amount is zero' (credits);
  'A pre-note is for $0.00'; the 10-digit limit.
- Entry `kind: 'prenote'` at 0 cents: codes 23/33; a batch of pre-notes alone gets no offset (16-07, 16-09).
- `NS.nacha.SAME_DAY_LIMITS`, `NS.nacha.RESERVED_DESCRIPTIONS` (both frozen).

## Deviations from Plan

1. [Rule 1 - Bug] The effective-date check could be ok false and warn true at once (effective today on a holiday);
   warn is now false whenever ok is false, so the level is block (the console already drew it red). Case levels.
2. [Rule 1 - Bug] "Routing numbers pass the ABA check digit (N of M)" counted entries in the file, so a no-SEC entry
   showed "2 of 4" with all four routing numbers good; N now counts entries whose routing number passes. Label form
   unchanged.
3. [Rule 2] An entry kind other than credit or prenote is left out with 'Entry kind <x> is not one these payments use'
   (not in the interfaces block; otherwise it would be paid as a credit).
4. [Rule 2] The originating routing field is kept 8 characters when the number is bad (it is a red check), so records
   stay 94 characters. SEC values are trimmed and upper-cased ('ppd' is PPD).
5. sync-core run as `node mobile/scripts/sync-core.js` (what `npm run sync-core` runs); only mobile/src/core/nacha.js
   changed and was staged.

## Guide lines for the guide pass (proposed, no guide bytes written)

- "A pre-note is a $0.00 test payment that proves an investor's bank account before the first real payment."
- "A payment above the same-day limit ($1,000,000.00; $10,000,000.00 from 17 September 2027) in a file dated today
  settles the next banking day. The file is not split."
- "A red check means the bank would refuse the file: fix the field it names before you download."
- "The entry description cannot be a word the ACH rules keep for other payments, such as PAYROLL or PURCHASE."

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

## RED 2 (Task 2, on the Task 1 tree: `node checks/nacha-build.js`, exit 1)

84 PASS, 92 FAIL lines. The FAIL lines cut at 200 characters (of the levels case's 58 per-scenario lines only the first two, then the holiday line; full output in the scratchpad, exec-16-05/red-2.txt):

```
FAIL modifier modifier 'a' is refused with "The file ID modifier must be one capital letter A-Z or one digit 0-9." :: built
FAIL modifier modifier '' is refused with "The file ID modifier must be one capital letter A-Z or one digit 0-9." :: built
FAIL modifier modifier 'AA' is refused with "The file ID modifier must be one capital letter A-Z or one digit 0-9." :: built
FAIL modifier modifier '?' is refused with "The file ID modifier must be one capital letter A-Z or one digit 0-9." :: built
FAIL sameday SAME_DAY_LIMITS is the frozen dated table (2022-03-18 $1,000,000.00; 2027-09-17 $10,000,000.00)
FAIL sameday effective today: one warning, for the entry of $1,000,000.01 ($1,000,000.00 exactly does not warn) :: []
FAIL sameday the warning is amber: ok true, warn true, level warn
FAIL sameday 2027-09-16, effective that day: $1,500,000.00 warns (the limit is still $1,000,000.00) :: []
FAIL sameday 2027-09-17, effective that day: $1,500,000.00 and $10,000,000.00 exactly do not warn, $10,000,000.01 does :: []
FAIL offset balanced, offset routing '123': the red check "Settlement account for the offsetting debit: the routing number fails the check digit" :: ["Every record is 94 characters","Routing numbers p
FAIL offset balanced, offset routing '123': no offset entry, every record 94 characters :: 2 offsets; lengths 94,88
FAIL offset balanced, no settlement account given: the red check "Settlement account for the offsetting debit: the routing number fails the check digit" :: ["Every record is 94 characters","Routing nu
FAIL offset balanced, no settlement account number: the red check "Settlement account for the offsetting debit: the account number is missing or longer than 17 characters" :: ["Every record is 94 char
FAIL offset balanced, no settlement account number: no offset entry, every record 94 characters :: 2 offsets; lengths 94
FAIL company a 9-character company ID: the red check "Company ID must be exactly 10 characters" :: ["Every record is 94 characters","Routing numbers pass the ABA check digit (1 of 1)","Account numbers
FAIL company an empty company name: the red check "Company name is missing" :: ["Every record is 94 characters","Routing numbers pass the ABA check digit (1 of 1)","Account numbers present and 17 char
FAIL company an originating bank routing number failing the check digit: the red check "Originating bank routing number fails the check digit" :: ["Every record is 94 characters","Routing numbers pass
FAIL company an immediate destination failing the check digit: the red check "Immediate destination routing number fails the check digit" :: ["Every record is 94 characters","Routing numbers pass the 
FAIL description RESERVED_DESCRIPTIONS holds the 11 words of 16-RESEARCH F-11, frozen
FAIL description description 'PAYROLL': the red check naming PAYROLL :: ["Every record is 94 characters","Routing numbers pass the ABA check digit (1 of 1)","Account numbers present and 17 characters 
FAIL description description 'purchase': the red check naming PURCHASE :: ["Every record is 94 characters","Routing numbers pass the ABA check digit (1 of 1)","Account numbers present and 17 character
FAIL description description 'ACCTVERIFY': the red check naming ACCTVERIFY :: ["Every record is 94 characters","Routing numbers pass the ABA check digit (1 of 1)","Account numbers present and 17 chara
FAIL prenote two pre-notes (checking, savings): codes 23 and 33, amount 0 :: []
FAIL prenote result.entries marks them kind prenote :: []
FAIL prenote a pre-note of 5 cents is left out with 'A pre-note is for $0.00'; the other is in the file :: ["INV-1: Amount is zero"]
FAIL entries each ref is passed through (REQ-1, REQ-2, REQ-4, then the CCD batch REQ-3) :: ["REQ-1","REQ-2","REQ-3"]
FAIL entries codes, kinds, SEC and batch as written (22, 32, 23 in batch 1 PPD; 22 in batch 2 CCD) :: ["22/credit/PPD/1","32/credit/PPD/1","22/credit/CCD/2"]
FAIL entries cents and ids as given :: ["INV-1:10000","INV-2:20000","INV-3:30000"]
FAIL entries the entry with no SEC type is left out with its reason, not listed :: ["Amount is zero","No SEC type"]
FAIL reader offsetBadRouting: every record is 94 characters :: [88,88]
FAIL reader offsetNoAccount: no red check, and the independent reader passes it :: -validate-file: ERROR: file.ach: reading ACH: line:5 record:EntryDetail *ach.FieldError DFIAccountNumber  is a mandat
FAIL reader companyNoName: no red check, and the independent reader passes it :: -validate-file: ERROR: file.ach: reading ACH: line:2 record:BatchHeader *ach.FieldError CompanyName  is a mandatory fie
FAIL reader destinationBad: no red check, and the independent reader passes it :: -validate-file: ERROR: file.ach: reading ACH: line:1 record:FileHeader *ach.FieldError ImmediateDestination ...0090 ro
FAIL levels fixture: every check has level block, warn or ok; ok false exactly for block; warn true exactly for warn :: ["Every record is 94 characters [undefined/true/undefined]","Routing numbers pas
FAIL levels fixture: result.blocked is the block checks
FAIL levels an effective date of today that is a holiday is red (block), not amber :: {"label":"Effective date is a Federal Reserve holiday","ok":false,"warn":true}
NACHA BUILD: FAIL (cases run: 11) - modifier, sameday, offset, company, description, prenote, entries, levels, reader
```

The independent reader refused three files the old builder showed with no red check: an empty settlement account
number (DFIAccountNumber mandatory), an empty company name (CompanyName mandatory) and an immediate destination failing
the check digit. The offset routing '123' gave two 88-character records.

## Task 2 GREEN (first half of the plan's verify)

```
PASS reader at least one file was read by the independent reader
NACHA BUILD: PASS (cases run: 11)
PART1=0
MOBILE=0
```
168 PASS lines, 0 FAIL; 19 files read by the independent reader (every scenario with no red check, plus the offset and
pre-note files); no leak found by lib16.leaks in the output. Also on this tree: INDEPENDENT READER: PASS (cases run: 6),
HOLIDAYS: PASS (cases run: 10), MOBILE SYNC: PASS (cases run: 3).

## Gate (Task 2 verify: `GATE_SERVER_TESTS=456 GATE_OUT=exec-16-05 bash checks/gate16.sh`, second run into the same folder)

Last 15 lines, verbatim:

```
GATE ok   ENGINE BOOKS
GATE ok   HOLDINGS
GATE ok   NEW SCHEDULES
GATE ok   NO ONBOARDING
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE ok   ACH LEAK
GATE ok   HOLIDAYS
GATE ok   MOBILE SYNC
GATE ok   NACHA BUILD
GATE ok   INDEPENDENT READER
GATE_EXIT=0
```

Also in the gate output: `GATE ok   server tests 456 = base 456 + 0 declared`, `GATE ok   DIST FLOW`,
`GATE ok   WITHHOLDING FLOW`; 70 GATE ok lines, no GATE FAIL; 29 steps kept from the first run. Plan verify:
`VERIFY2=0`. `df -h /` before the gate: 8.6G free (78%); after: 9.5G free. The gate removed its base tree, shots and
checks-out; the server/node_modules link was removed by hand.

**GATE_EXIT=0**

## Commits

- 3806d41 test(16-05): RED nacha-build cases sec and reader
- 3044222 feat(16-05): entries with no SEC type or an unused one left out with a reason; result.entries
- 4439f7f test(16-05): RED the other nine nacha-build cases
- 9ccb9e3 feat(16-05): builder refusals, dated same-day limits, pre-notes and check levels

## Threat model

T-16-16 (cases offset, modifier, reader), T-16-17 (case sec, entries), T-16-18 (case sameday), T-16-19 (case
description) mitigated as planned. No new network, auth or storage surface.

## Self-Check: PASSED

checks/nacha-build.js, assets/js/nacha.js, mobile/src/core/nacha.js present; the four commits are on HEAD (git log
00c32a7..HEAD); the mobile copy equals the header line plus the web file (case mobile, MOBILE SYNC).
