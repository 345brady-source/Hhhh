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
