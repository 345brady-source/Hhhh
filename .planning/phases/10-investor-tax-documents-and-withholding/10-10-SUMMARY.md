---
phase: 10-investor-tax-documents-and-withholding
plan: 10
subsystem: Form 1099 section of the Tax documents page (self-serve console)
status: complete
tags: [tax, 1099-INT, IRIS, copy-b, w-9, delivery, c-01, c-05, d-02]
requires: ["10-04 (NS.taxUI)", "10-06 (NS.taxdocs delivery and consent)", "10-09 (NS.tax1099, NS.tax1099data)"]
provides:
  - "assets/js/tax1099-ui.js: part '1099' of the Tax documents page (console-taxdocs-1099)"
  - "checks/tax1099-flow.js: TAX1099 FLOW, 8 parts"
  - "NS.taxUI.part spec.shown(ws) (optional): no list line when false; part keys may start with a digit"
affects: [10-11, 10-12, 10-13]
tech-stack:
  added: []
  patterns: ["taxpayer numbers held in one variable of the UI file, emptied after the file, on leaving and on a fund or year change", "screenshots only of views showing 'ending' and four digits"]
key-files:
  created:
    - assets/js/tax1099-ui.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/tax1099-flow.js
  modified:
    - assets/js/taxdocs-ui.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/walk3-fixes.js
decisions:
  - "The address is asked of nobody: the recipient's address comes from the signed W-9 (or the investor record) and is shown as text; only the name split (name type, first and last, or business name) is a field. A cell that breaks a published rule is offered as a field in the fault list."
  - "Recipient copies are delivered from the Form 1099 section itself with the same list-first Deliver and NS.taxdocs.deliver (same consent, notice, access period, send-on-paper list); taxdocs-ui.js's Deliver is bound to an import and a copy has no import."
  - "After the file is made the numbers are forgotten and the signed W-9s are not read again until a person asks (Check numbers, Create recipient copies or Download the IRS file)."
  - "The file record on the year record also keeps the investor ids in it, so Record the IRS receipt marks exactly those forms filed."
metrics:
  completed: 2026-11-26
  tasks: 3
estimate:
  tokens: 114000
  tasks: 3
actuals:
  tokens: 27000     # chars/4 over the added lines: tax1099-ui.js 41.7k chars, tax1099-flow.js 57.7k, small edits in two files, this summary
  tasks: 3
  commits: 12       # git rev-list --count plan_head_before..plan_head_after; this summary is the 13th
plan_head_before: 92fda021277ede4bc2e72f777829e331dd0597a7
plan_head_after: 7edc3ba8752ac799268f9cf262a35ab325027641
---

# Phase 10 Plan 10: Form 1099 on screen Summary

A sponsor whose fund is set to notes opens Tax documents, then Form 1099. The section shows each Form 1099-INT's interest paid and federal tax withheld, taken from the stored payment lines. It also lists every investor left out, with the reason, and every stop as one sentence naming the CPA. The sponsor confirms each form against the bank. After that, the recipients' numbers are read from the signed W-9 or typed, and are checked against the last four digits on record. The recipients' Copy B documents are made and delivered through the consent path. The sponsor then downloads the file for the IRS's IRIS site and records the receipt. Everything was measured in the sandboxed frame at 390x844 with touch and at 1280x800, on hand-worked example D and invented numbers only. **The owner has not checked any of it.**

## Failures and unconfirmed points first

- **The first gate run failed: `GATE_EXIT=1`, on WALK3 FIXES (9), part parts-load.** The phase 6 check required `tax1099-ui.js` to be *absent* from NS.taxUI.PARTS. B1 of this plan adds it, so the assertion was out of date, not the product. It was fixed in 7edc3ba: each of `tax1099-ui.js` and `taxlink.js` must be listed exactly when its file ships, so 10-12's `taxlink.js` passes too. The failing line, verbatim:
  `FAIL parts-load every file in NS.taxUI.PARTS is in assets/js (tax1099-ui.js and taxlink.js are not listed until plans 10-10 and 10-12 add them) :: {"parts":[...,"tax1099.js","tax1099-ui.js"],"absent":[]}`
- **The second gate run (on 7edc3ba) was killed by the owner's stop on 2026-11-20** after the reference gate's steps. It was resumed into the same folder on 2026-11-26. The steps marked "kept" below passed on the same commit in that killed run; the rest ran on 2026-11-26. It ended `GATE_EXIT=0`.
- **Part tin passed at RED.** Everything it tests was already built in the Task 1 commit 730e63d: checkTin's refusals, the numbers forgotten on leaving and after the file, and the payer's kept last four. It has no RED of its own.
- **Not proven, stated plainly:**
  - No file has been uploaded to the IRS, so nothing says the IRS accepts it.
  - The file's header row and cents have not been compared with a real IRS template (`IRIS.headerPinned` and `centsConfirmed` stay false; plan 10-13).
  - No CPA has read the stop sentences or the Notes case.
  - Nothing has been run on an iPhone.
  - Saving the file from the phone's frame was not tried; the check's browser saves it as a normal download.
- **Two RED/GREEN failures were check bugs:**
  - The seat never handed the backup lines to recordRun, so box 4 read empty.
  - The tin part's storage search could not use "no nine-digit run anywhere", because the sample firm itself holds nine-digit bank routing numbers. It requires instead that none of the invented numbers appears anywhere, and that no nine-digit run or dashed shape appears that was not there before the numbers were typed.
- **Not built here (open items):**
  - The help guide has no Form 1099 entry: server/help/guide.md is not in this plan's files.
  - An amended 1099 is not built: Create recipient copies makes a copy only for a form that has no live copy.
  - The preview's demo bar covers the bottom of the desktop view until scrolled (the known open item).

## Evidence as produced

### RED 1 (SCRATCH/exec-10-10/red-1.txt, check committed in 0bebf99)
```
PASS review-phone the frame refuses fetch() (connect-src none is in force)
FAIL review-phone as admin, Tax documents shows a Form 1099 line ::
FAIL review-phone the page for example D and 2026 lists exactly two forms, A-1001 and A-1002 :: []
FAIL review-phone A-1001: interest paid $20,000.00, federal tax withheld empty :: {}
FAIL review-phone A-1002: interest paid $13,333.32, federal tax withheld $1,600.00 :: {}
FAIL review-phone A-1003 is left out with its reason (Form 1042-S from your CPA) and $6,666.68 :: []
FAIL review-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 1) - review-phone
```

### Task 1 verify (SCRATCH/exec-10-10/tracer.txt, code 730e63d)
```
PASS review-phone no script error in the browser
PASS review-phone no request outside the page's origin
TAX1099 FLOW: PASS (parts run: 1)
```
24 PASS, 0 FAIL; no full-number shape in the output. First GREEN run failed 4 checks: one was a bug in the check's seat
(the backup lines were never handed to recordRun, so box 4 read empty), one asked for the sample's admin name instead of
"who", two were missing data-panel markers in the page.

### RED 2 (SCRATCH/exec-10-10/red-2.txt, check committed in ce71e99; 50 PASS, 9 FAIL)
```
FAIL review-desktop one line says the IRS's code for filing can take up to 45 days, with its link to the IRS's IRIS page :: null
FAIL review-desktop one line says not to open the file in a spreadsheet before uploading it :: null
FAIL review-desktop while headerPinned is false, one line says the file's header has not been compared with the IRS's own template :: null
FAIL payer ran to the end :: frame.fill: Timeout 30000ms exceeded.
FAIL copyb ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL file with a period in the last name no file is built
FAIL file the page names the row, the column and the reason :: []
FAIL file that cell is offered for correction
FAIL file ran to the end :: frame.fill: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 5) - review-desktop, payer, copyb, file
```
Part tin PASSED at RED: everything it tests (checkTin's refusals, the numbers forgotten on leaving and after the file,
the payer's kept last four) was already built in the Task 1 commit 730e63d. It has no separate RED.

### Task 2 verify (SCRATCH/exec-10-10/parts.txt, code 735ae58; 135 PASS, 0 FAIL, no full-number shape in the output)
```
PASS file no script error in the browser
PASS file no request outside the page's origin
TAX1099 FLOW: PASS (parts run: 6)
```

### RED 3 (SCRATCH/exec-10-10/red-3.txt, check committed in 450dd83; 7 PASS, 5 FAIL)
```
FAIL stops with every fund not set, the Tax documents page has no Form 1099 line
FAIL stops with a fund set to partnership, still no Form 1099 line
FAIL stops a Distribution payment in the year shows its stop sentence and "Is this payment interest?" with its date and amount :: {"st":[{"code":"kind",...
FAIL stops ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL roles ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
TAX1099 FLOW: FAIL (parts run: 2) - stops, roles
```

### All eight parts on the final code, before the gate (SCRATCH/exec-10-10/all8.txt; 179 PASS, 0 FAIL, no full-number shape)
```
PASS roles no script error in the browser
PASS roles no request outside the page's origin
TAX1099 FLOW: PASS (parts run: 8)
```

## Gate (GATE_OUT=SCRATCH/exec-10-10, base 92fda02, P10_ROOT unset, the gate offering P10_BASE; resumed run, last lines verbatim)

```
GATE ok   WALK3 FIXES (9) (kept from 2026-11-20 18:53:20 UTC)
GATE ok   TITLES AND EDITOR (4) (kept from 2026-11-20 18:54:11 UTC)
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-20 18:56:23 UTC)
GATE ok   CO-INVESTOR SERVER (5) (kept from 2026-11-20 18:57:46 UTC)
GATE ok   HELP PREVIEW (6) (kept from 2026-11-20 18:57:59 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-20 18:59:00 UTC)
GATE ok   signing-plan (kept from 2026-11-20 19:00:53 UTC)
GATE ok   record-base (kept from 2026-11-20 19:01:49 UTC)
GATE ok   record-plan (kept from 2026-11-20 19:02:30 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
GATE ok   base-server-tests (kept from 2026-11-20 19:02:50 UTC)
GATE ok   server tests 368 = base 368 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-20 19:05:20 UTC)
GATE ok   DIST RECORD (kept from 2026-11-20 19:05:22 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-20 19:05:42 UTC)
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAX1099 FLOW
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE_EXIT=0
```
- Every reference line above WALK3 FIXES also reads `GATE ok`: server tests, STATUS MATH (13), FORM MAPS (3), FORMS FLOW (34), STATUS FLOW (26), SERVER MODE (15), TWO PERSONS, MEASURE, the owner's folder, EMAIL DIALOG (3), AGREEMENT NAME, TAX REQUEST LEAVE (5), WAYS OUT (7), NO NETWORK (3), EMBED DATA (3), SAFARI FINISH (6), BANK STEP TYPING (2), HELP CHAT (10), REAL FIRM (9), SIGNING DOCUMENTS (8), PHONE LAYOUT (8), RECORD AND LOST AGREEMENT (7) and SCREEN EDGES (5).
- The gate's run of this plan's check ended `TAX1099 FLOW: PASS (parts run: 8)`, with 179 PASS lines and no dashed taxpayer-number shape in its output.
- First run (on 7627605): `GATE FAIL WALK3 FIXES (9)`, every other line ok, `GATE_EXIT=1` (see Failures).
- `git diff --quiet 92fda02 HEAD -- index.html diy.html portal.html assets/css/tax.css assets/js/console.js assets/js/tax1099.js` gives UNCHANGED.

## What the eight parts prove

Every part runs in the sandboxed frame that refuses every connection, with scripts from the portal only, the clock on 2027-01-20, and withholding-ui.js, taxrecord-ui.js and taxlink.js answered 404.

- **review-phone / review-desktop**
  - The Form 1099 line is on Tax documents.
  - Example D to the cent:
    - A-1001: $20,000.00, box 4 empty.
    - A-1002: $13,333.32 and $1,600.00.
    - A-1003 is left out, "Form 1042-S from your CPA", $6,666.68.
  - There are no inputs for the figures, and no copy or file is offered until both forms are confirmed.
  - A-1002 reads "ending 7730 · read from the signed W-9" without typing. A-1001's typed number is accepted ("ending 4821").
  - The .csv has the header line and two rows: AN 20000.00 with AQ empty, and AN 13333.32 with AQ 1600.00.
  - The SHA-256 and the row count 2 are on the year record.
  - Desktop also shows the three one-line notices: the 45 days with the link to the IRS's IRIS page, the spreadsheet line, and the header line.
- **payer**
  - Admin entry is saved with who and when, no number is stored, and the change is logged.
  - A team member sees the details with no field and no Save.
  - Either box unticked shows that stop's sentence and no Confirm.
- **tin**
  - Wrong last four: refused with one line that shows no five digits.
  - Eight digits: refused.
  - Leaving the page empties the numbers.
  - After the file: localStorage, the workspace, the change log, the page's text and the page's fields hold none of the invented numbers, and no new nine-digit run or dashed shape. The search is shown to find a planted number.
  - The file store has no new record.
  - Only the payer's last four (4321) are kept, and they refuse a later payer number with a different end.
  - After a reload the step is empty again.
- **copyb**
  - Two 1099-int documents for 2026, confirmed by the person who confirmed each total, hidden and not delivered.
  - The year record's copyB holds each copy's document id.
  - The file store gained exactly the two documents.
  - Deliver shows the list first.
  - A-1002 (consented) has the copy delivered, available until 2027-10-15. A-1001 waits and is on the send-on-paper list.
  - The copy is three pages and holds ***-**-7730, 13,333.32 and 1,600.00, with no recipient's full number.
  - As A-1002: listed in Documents, first page drawn, "October 15, 2027" shown.
- **file**
  - "Sample." builds no file. Row 1 (A-1001), column AA (Recipient Last Name (Surname)) and the rule are named, and the cell is offered as a field.
  - Corrected, the file downloads with no asterisk.
  - A missing receipt number or date is refused with one line and nothing stored.
  - The receipt marks both forms "Filed January 21, 2027" and is logged.
- **stops**
  - With no notes fund, or with a fund set to partnership, there is no list line, and the address shows only the CPA sentence.
  - One more interest payment withdraws both confirmations ($25,000.00, Not confirmed).
  - A Distribution payment asks "Is this payment interest?" with November 2, 2026 and $300.00, and there is no Confirm until answered. No adds nothing; Yes counts it ($25,003.00). Both answers are logged with who.
  - A payment with no stored amounts offers Confirm amounts with $300.00, $200.00 and $100.00, and counts once confirmed ($25,303.00).
  - Foreign withholding on A-1001 shows the other-withholding stop.
- **roles**
  - Exempt recipient moves A-1001 to the left-out list with that reason, and Not exempt brings it back; both are logged.
  - A team member confirms totals and has no payer fields, exempt, numbers, copies, file or receipt controls.
  - An investor cannot open the address.
  - portal.html at 390x844 shows the same forms.
- **Every part:** quiet, leak (no vendor name, never the forbidden word) and a way out on screen.

## Commits

- 0bebf99: test (RED 1, committed as a save)
- 730e63d: feat (tracer)
- ce71e99: test (RED 2, a save)
- 735ae58: feat (Task 2, a save)
- 450dd83: test (RED 3)
- 7627605: feat (Task 3)
- 7edc3ba: fix (WALK3 assertion)
- Plus five "wip(10-10): save" commits (fc9e175, 0633634, c298d85, eb9c15c, 98c27dc) holding summary drafts and work in progress. They are all on wip/10-10.

## Deviations from Plan

1. **[Rule 3] taxdocs-ui.js, beyond the PARTS item (B1):** NS.taxUI.part refused a key starting with a digit, so the address console-taxdocs-1099 could not exist. The two key patterns now accept `[a-z0-9]+`. Separately, the truth "a fund not set has no 1099 screen" needed an optional `shown(ws)`, so the list line is drawn only when a fund is set to notes. The PARTS line holds only my item, as 10-12 also edits it.
2. **[Rule 3] walk3-fixes.js (phase 6 check):** the out-of-date assertion was corrected (see Failures).
3. Delivery of the copies happens in the Form 1099 section through NS.taxdocs.deliver (see decisions).
4. Address cells are not fields unless a rule names them (the plan's "nothing else is asked").
5. The base branch moved only in .planning docs (phases 12 and 13), so it was not merged.
6. Commits are mixed with "wip(10-10): save" commits because of save rule 2. Two RED checks and the Task 2 code landed in save commits.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: outbound-link | assets/js/tax1099-ui.js | One link to https://www.irs.gov/filing/e-file-information-returns-with-iris (target _blank). It is a link only: no fetch, and nothing is sent. |

The threat register's T-10-29 to T-10-32 are mitigated as planned:
- One `held` variable is emptied after the file, on leaving and on a fund or year change. Part tin searches every store, and screenshots are taken only of "ending" views.
- No file is stored (part tin: no new file-store record).
- There is no copy or file while a form is unconfirmed or a stop stands (review and stops).
- Admin-only controls (roles).

## New shipped files a preview build must add

- **assets/js/tax1099-ui.js** (new). It is loaded through NS.taxUI.PARTS.
- At runtime it loads files that 10-09 shipped and no page loaded until now: **assets/js/tax1099-data.js**, **assets/forms/1099/forms1099-data.js** and **assets/js/tax1099.js** (already on PARTS). It also loads assets/forms/forms-data.js (already shipped).
- build.py copies every tracked file under assets/, so all of these are included.

## Owner's check (pending)

On the iPhone, in the published preview:
1. Set a fund's Tax reporting to Notes and record an interest payment for it.
2. On Tax documents open Form 1099 and enter the payer's details.
3. Confirm a form.
4. Type a made-up payer number, and a made-up recipient number whose last four match.
5. Create the copies, deliver one, and open it as the investor.
6. Download the IRS file.

Expected:
- The two figures are what you recorded, and nothing asks you to type a figure into a box.
- A number with the wrong last four is refused.
- The investor's copy shows the last four only.
- The file saves.
- After you leave the page, the numbers are gone.

## Self-Check: PASSED

- FOUND: assets/js/tax1099-ui.js and checks/tax1099-flow.js.
- FOUND as ancestors of HEAD: 0bebf99, 730e63d, ce71e99, 735ae58, 450dd83, 7627605, 7edc3ba.
