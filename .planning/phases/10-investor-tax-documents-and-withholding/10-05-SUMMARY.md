---
phase: 10-investor-tax-documents-and-withholding
plan: 05
subsystem: withholding rules (pure functions, no screen)
tags: [withholding, backup-withholding, foreign, 1042, deposits, worksheet, tax]
status: complete
requires: ["10-01 (NS.data.buildLines, paidLines, runPaid; the line and w shapes)"]
provides:
  - "NS.withholding (assets/js/withholding.js): REPORTING, reporting, setReporting, RATE, amount, KINDS, STOPS, DEPOSIT_RULES, w8, payee, propose, foreignDraft, enteredDraft, confirm, remove, toWithheld, undecided, addNotice, endNotice, markExempt, unmarkExempt, withheldFor, totals, addDeposit, worksheet"
  - "checks/tax-math.js: TAX MATH, 9 cases (backup, type, never, w8, foreign, stops, totals, worksheet, selfcheck)"
affects: [10-07, 10-08, 10-09, 10-10, 10-11, 10-14]
tech-stack:
  added: []
  patterns: ["drafts only; a person confirms each line", "every sum from NS.data.paidLines", "every function given its own date"]
key-files:
  created:
    - assets/js/withholding.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax-math.js
  modified: []
decisions:
  - "C4 applied exactly: a W-9 counts only when taxOnFile, taxForm W-9, taxCert.signed === true and four digits on record (taxCert.tinLast4, else the record's tinLast4, never a foreign number). An uploaded W-9 and a W-9 record with no taxCert never count."
  - "A deposit is marked for one offering (its payer); totals for an offering subtract only that offering's deposits"
  - "W-8 valid = signed and not expired on the payment date; a missing foreign tax number is flagged for the CPA but does not by itself make the payee undocumented"
  - "Amounts are worked in exact integers (no BigInt, no floating point): half a cent rounds up"
metrics:
  completed: 2026-11-19
  tasks: 2
actuals:
  tokens: 36000
  tasks: 2
  commits: 7
plan_head_before: 5f5e22b6dc61703b884ced939fa7dbc122bacf2e
plan_head_after: b022a4039aa5a7cb321807dc5746e084e915e9cb
---

# Phase 10 Plan 05: the withholding rules Summary

The rules for tax withheld at a distribution, as pure functions in `assets/js/withholding.js`. The portal proposes only the two lines the owner allowed (C-03): backup withholding at 24% on the IRS's listed conditions, and 30% on an amount the sponsor enters for a foreign investor. Every other case is a stop sentence that names the CPA and takes only an entered figure. Nothing is withheld until a person confirms the line. Totals, deposits and the CPA worksheet are read from the stored lines of paid distributions. There is no screen yet (10-07 and 10-08 build them), and no page loads the file yet. The owner has not checked this.

## Failures and weak points first

- **The phase gate did not run.** `gate10.sh` (plan 10-14) is not on claude/refract-reskin. I merged the latest claude/refract-reskin (e3ccadc) into this branch, then ran this plan's own check, the neighbouring node checks and the server tests on the merged tree (results below). No browser check was run. This plan changes no page and no existing file.
- **C4 as written makes 86 of the 94 sample investors draw a backup line** (if an offering they hold were set to notes or to corporation or REIT). The sample firms' records carry `taxForm: 'W-9'` and the last four, but no `taxCert`, so `taxCert.signed === true` is false for all of them (counts below). Investors imported or added in the console without the portal's own signing look the same. The sponsor would see one proposed line per such investor and would have to remove each one. No sample offering has a reporting type set yet, so nothing is proposed today. This needs a decision before 10-07 shows proposals: either the sample data gets a signature record, or the sponsor gets a way to record that a W-9 is signed on paper.
- **C4 as written: an uploaded completed W-9 (06-21) never counts.** The upload stores no `signed` mark, so the "carries the last four" clause in C4 never changes the answer. I built it as written (a check proves it: 24%) and have not loosened it.
- **Not confirmed (owner or CPA items):** (1) research assumption A6: there is no minimum payment before backup withholding on interest or dividends. (2) No CPA has read the eight stop sentences or the two deposit rules. (3) A foreign investor whose W-8 is unsigned or expired is treated as a backup case, with a reason saying which. The IRS presumption rules might treat that payee as foreign (30%) instead (CPA list). (4) A W-8 with no foreign tax number and no "not required" box is flagged but still counted as documented foreign.
- **Three check bugs fixed before GREEN, not code bugs:** in case backup a local `drafts` hid the helper of the same name (fixed before the RED run was kept). The deposit tests gained `offeringId` (see deviations) before any code existed. A wording check was added after GREEN, and its failure on the earlier commit is kept as red-3.txt.

## C4: how many investors of each sample firm would draw a backup line

Measured on the merged tree, clock 2026-11-19, as if each offering were set to notes (SCRATCH/exec-10-05/c4-count.js, output c4-count.txt):

| Firm | Investors | Would draw a backup line | IRA (never) | Reason |
|---|---|---|---|---|
| kestrel-bay | 23 | 20 | 3 | 18 W-9 with no signature record; 2 no tax form |
| ashwell-ridge | 24 | 22 | 2 | 20 W-9 with no signature record; 2 no tax form |
| greywater | 23 | 21 | 2 | 20 W-9 with no signature record; 1 no tax form |
| pellbrook | 24 | 23 | 1 | 21 W-9 with no signature record; 2 no tax form |

Total: 86 of 94. Offerings with a reporting type set: 0 of 15. As things stand, no sample investor is shown a proposal.

## What was built

- **Reporting type** (TAX-07): `offering.tax.reporting` is one of partnership, notes, corp or other, and only `setReporting` sets it (with who and when, plus one change-log entry). Any other key is refused. Until a type is set, and for partnership and other, nothing is proposed and no 1099 form name is offered (`REPORTING[k].form`).
- **Backup, 24%** (D-04, C-03, C4): used only for notes and corp. It is never proposed for an IRA, a payee the sponsor marked exempt, or a payee whose W-8 is valid on the payment date. One draft is proposed when any of these holds on the payment date: (1) no signed W-9 with a number is on file (C4, exactly); (2) item 2 is crossed out (`taxCert.backupWithholding === true`); (3) an IRS notice the sponsor recorded is in effect (it arrived on or before the date and has not ended by it). The reason gives each condition that holds, and two conditions still make one line. A line that would be 0 cents is not offered (W3).
- **Foreign, 30%** (D-04, C-03): `foreignDraft(line, { subjectCents, ratePct })` takes the amount the sponsor enters. A rate other than 30 is marked `source: 'entered'`. It refuses an amount that is not whole, below 2 cents or above the gross; a rate outside 0 to 100; and any line that would be 0 cents.
- **W-8 facts:** `w8(i, date)` returns signed, validUntil, valid (signed and not expired on that date), ftin ('on file', 'not required' or '') and flags ('not signed', 'expired', 'no foreign tax number').
- **Stops** (C-03): `STOPS` holds eight sentences (us-source, portfolio-interest, treaty, partnership, real-property, fatca, state, irs-notice). Each is one sentence that names the CPA, with no rate and no figure. `enteredDraft` is limited to the four stop kinds: it needs a positive whole amount no larger than its basis, a basis no larger than the line's gross (W3), and a reason. It is always `source: 'entered'`, with no rate.
- **Deciding:** `propose` returns drafts only. `confirm` records who, when, the basis, the rate and the reason. `remove` takes a draft off. `toWithheld` refuses anything that lacks who and when, and its output goes into `NS.data.buildLines` unchanged (checked for every kind).
- **Totals and deposits** (TAX-17, C-08): `withheldFor` and `totals` read only `NS.data.paidLines` for 1 January to 31 December, given a `today` (W2). Cancelled runs and runs not yet paid count nowhere. Deposits (`addDeposit`: offering, kind, year, whole cents, date, confirmation number, who) are subtracted to give the amount not yet deposited. `DEPOSIT_RULES` holds one sentence and a source each for backup and foreign. No due date is worked out. A paid run saved before 10-01 is listed in `recomputedRuns`, and items carry `recomputed` (W4).
- **Worksheet** (D-03, TAX-13): one row per foreign investor of the offering, with the W-8 facts on file and each amount paid and withheld in the year. The CSV has one header line and one line per payment, plus an "Amount worked out again" column (W4). Cells that start with =, +, -, @, tab or carriage return get an apostrophe in front (T-10-15).

## Hand-worked numbers the check holds to the cent

- Example B: A-1002 at 24% of 333,333 = 79,999.92, which rounds to **80,000**. A-1003 at 30% of 166,667 = 50,000.1, which rounds to **50,000**; with an entered rate of 10, 16,666.7 rounds to **16,667**. Nets 500,000 / 253,333 / 116,667 = 870,000, and 870,000 + 80,000 + 50,000 = 1,000,000. A-1001 with no form, or with a notice in effect: 24% of 500,000 = **120,000**. An expired or unsigned W-8 paid 2029-03-15: 24% of 166,667 = 40,000.08, which rounds to **40,000**.
- Rounding: 24% of 25 = 6; 30% of 2 = 0.6, so 1; 30% of 5 = 1.5, so 2; 24% of 2 = 0.48, so 0 and no line is offered; 24% of 3 = 0.72, so 1.
- Example C (worked on 2027-01-31): backup 160,000 withheld, 80,000 deposited, 80,000 not yet deposited. Foreign: 100,000, 0 and 100,000. A-1002's 2026 backup is 160,000. Worked on 2026-12-01 instead, backup is 80,000. The worksheet has one row, A-1003, with 1666.67 paid and 500.00 withheld on each of 2026-09-15 and 2026-12-15. A run saved before 10-01 (15 June, 600,000) gives A-1003 100,000 (1000.00), marked worked out again.
- Pinned dates (W2): a notice that ended on 2026-09-14 or on 2026-09-15 gives no line for a 2026-09-15 payment; one ending on 2026-09-16 gives 120,000. A W-8 valid until 2028-12-31 is valid on that day and expired on 2029-01-01.

## RED evidence

- red-1.txt (Task 1, before the module existed): `FAIL backup ran to the end :: Error: ENOENT ... assets/js/withholding.js`. 1 FAIL line.
- red-2.txt (Task 2's cases on Task 1's module): 17 FAIL lines, last line `TAX MATH: FAIL (cases run: 9) - backup, never, w8, foreign, stops, totals, worksheet`.
- red-3.txt (the reason wording, on commit aaf31dd): 2 FAIL lines.
- Mutation run (SCRATCH/exec-10-05/mutate.js): I put 12 bugs into the module one at a time (notice end day, the C4 signed test, a foreign number taken as the last four, a 0-cent line, deposits across offerings, the formula guard, the W4 mark, the W-8 expiry day, backup for partnerships, IRAs, half-up rounding, cancelled or unpaid runs in totals). The check failed on every one: 12 of 12.

## Verify, verbatim (merged tree b022a40)

Task 2's verify without gate10.sh (SCRATCH/exec-10-05/verify2.sh):
```
TAX MATH: PASS (cases run: 9)
gate10.sh not present on this tree (plan 10-14 not merged)
head b022a40
VERIFY2 OK
```
Task 1's verify: `TAX MATH: PASS (cases run: 1)`.
Other checks on the merged tree:
```
DIST RECORD: PASS (cases run: 9)
TAXDOCS MATH: PASS (cases run: 9)
STATUS MATH: PASS (cases run: 13)
# tests 329
# pass 329
# fail 0
```
TAX MATH printed 213 PASS lines and 0 FAIL lines. server/node_modules was linked for the run and then removed.

## Commits (plan base 5f5e22b)

- 029757d test(10-05): the crossed-out W-9 draws one proposed line of $800.00, seen to fail first
- 74718b5 feat(10-05): withholding module: reporting type, 24% backup on a crossed-out W-9, confirm, toWithheld
- b966d2e test(10-05): every condition and refusal, W-8 facts, foreign 30%, stops, totals, deposits, worksheet, seen to fail first
- 0258685 test(10-05): a deposit is marked for one offering (its payer), and another offering's deposit does not lower this one
- aaf31dd feat(10-05): every backup condition (C4 exact), W-8 facts, foreign 30% on an entered amount, stops, totals, deposits, CPA worksheet
- bbb3b8c fix(10-05): a W-9 with no signature record is not called unsigned; the reason says the portal has no record of its signature
- b022a40 Merge claude/refract-reskin (e3ccadc) into 10-05 before the closing checks

## Deviations from Plan

1. **[Rule 2] A deposit carries `offeringId`.** The plan's `ws.taxDeposits` entry had no offering, so a deposit would have lowered every offering's undeposited figure. Forms 945 and 1042 are filed per payer, and each fund vehicle is its own payer. `addDeposit` now requires an offering of the workspace, and `totals` for an offering subtracts only that offering's deposits (commit 0258685, then aaf31dd).
2. **[W2 over the plan text] `propose` takes `{ date }`,** the payment date (the interfaces block said `{ today }`).
3. **[W3] `enteredDraft` takes the gross:** `{ investorId, grossCents }` or `{ line }`. Without it the basis cannot be held to the line's gross. It is limited to the four stop kinds; backup and foreign each have their own function.
4. **Additions beyond the block:** `remove(draft, { by, at })` (so `undecided` can reach false without confirming), `irsNotice.endedBy` and `endedAt`, `recomputedRuns` on each kind in `totals` (W4: lines worked out again carry no tax withheld, so the run itself is named), and `recomputed` on worksheet payments and totals items.
5. **Reason wording [Rule 1]:** a W-9 with no signature record was first described as "not signed". It now reads "the portal has no record of the W-9’s signature". "Not signed" is kept for a W-9 completed without a signature (commit bbb3b8c).
6. The gate is not `gate10.sh` (not yet merged). See the first section.
7. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (AUTOPILOT.md). TAX-07, TAX-13, TAX-15, TAX-16 and TAX-17 stay open until the owner has checked.

## Known Stubs

None. No page loads `withholding.js` yet. 10-07 (distribution screen) and 10-08 (withheld tax, worksheet) add it to the pages, and that is planned, not a stub.

## Threat Flags

None beyond the plan's register. T-10-14 is covered by case `never` and the drafts-only design. T-10-15 is covered by case `worksheet`.

## Owner's check (pending)

There is nothing on screen to check yet. What the owner (and a CPA) can read now: the eight stop sentences and the two deposit rules in `assets/js/withholding.js` (STOPS, DEPOSIT_RULES), and the C4 decision above about W-9s with no signature record.

## Self-Check: PASSED

Files: assets/js/withholding.js and checks/tax-math.js are present. Commits 029757d, 74718b5, b966d2e, 0258685, aaf31dd, bbb3b8c and b022a40 are ancestors of HEAD.
