---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 15
subsystem: ui (self-serve console: the Bank section of the Accounting page)
status: complete
tags: [accounting, bank-reconciliation, statement-files, csv, ofx, bai2, console, self-serve, fa-06, fa-12]
requires: ["11-02 (bankfiles.js)", "11-08 (books-bank.js)", "11-13 (books-ui.js parts, the Accounting page)"]
provides:
  - "NS.booksUI.part('bank'): bank accounts, statement upload read in the page, layout of a CSV kept per account, suggestions, decisions by account (purchase, sale, split), undo, move a stale match, opening balance, reconcile"
  - "books-bank.js: import records keep the file's opening and closing balances; openingOf / setOpening; reconcile() with an opening reconciled balance (B3)"
  - "checks/bank-flow.js: BANK FLOW: PASS (parts run: 8)"
affects: [11-16, 16-04, 16-11]
key-files:
  created: [assets/js/books-bank-ui.js, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/bank-flow.js]
  modified: [assets/js/books-ui.js, assets/js/books-bank.js, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/books-flow.js]
key-decisions:
  - "B3: an opening reconciled balance, dated the first statement line's date (the statement's beginning balance), entered by the sponsor and kept with who and when (account.opening and the change log); until it is entered the difference reads 'To be confirmed: opening balance at <date>' and nothing can be stored"
  - "Everything dated before the opening date is one figure: book balance the day before, less the opening balance, less pre-opening cash lines matched to later statement lines; listed as one outstanding item only when not zero"
  - "A run of nine or more digits in a file name or a line's text is cut to its last four before it is stored or shown"
  - "The file input has no accept list, so the iPhone's picker never greys out a .ofx/.qfx/.bai file; the content decides"
  - "The overlap question also offers 'Add only the <n> other lines' when some lines of the file are new"
requirements-completed: [FA-06, FA-12]
actuals:
  tokens: 24800    # chars/4 over the added lines of c8f922f..HEAD in assets/ and checks/ (99,276 chars)
  tasks: 3
  commits: 9        # git rev-list --count c8f922f..fda7766 (this summary's commit not counted)
plan_head_before: c8f922fcba6be6e6d38809843e01e5a36fafa891
plan_head_after: fda776691e691e126cd6982631fbaeb780f68ffe
---

# Phase 11 Plan 15: the Bank section of the Accounting page Summary

The Accounting page now has a Bank section: a bank account added with its name and last four digits, a statement
file read on the device with no network, a CSV's columns confirmed once per account, suggested matches accepted, every
other line decided once by account (including a purchase, a sale and a split), a decision undone, a stale match moved,
an opening balance for a fund whose first statement starts after its books, and a reconciliation stored only at
$0.00. The checks pass in the sandboxed frame at 390x844 and 1280x800 and on the published page, and the phase gate
passed (GATE_EXIT=0 on its second run into the same folder, HEAD fda7766). **Nobody has checked it on the iPhone yet, and no real bank export has been read**, so it is not done.

## Failures and incidents first

1. **BOOKS FLOW failed after B1** (books-flow.js entries-desktop, 174 passed / 1 failed, O/books-flow-fail-1.txt).
   Once PARTS lists the bank files, a part that reloads the page asks for them twice (once per load), and the check
   compared the asks of both loads with one list. Fixed in books-flow.js (reframe() empties the list before each
   reload): a file outside files_modified, see Deviations. The gate's BOOKS FLOW passed after the fix.
2. **Three check mistakes of my own, caught by the runs:** the check read errors from `.bb-err` and the layout form from
   `.bb-form`, while the section draws `.bk-err` and `.bk-form` (RED-2's four `refused` failures were partly this; the
   refusals themselves were drawn); and undo-roles sold part of Portfolio Co X before its purchase was decided, which
   the books rightly refused ("more than the investment's cost of $0.00"). The check now decides the purchase first.
3. **The opening-balance date is the first statement line's date, not the file's own start date.** The test asked for
   "a statement starting 2026-01-01"; the in-page statement carries DTSTART 20260101, but the statement reader
   (bankfiles.js, not this plan's file) returns no start date, only the dates of its lines. So the opening balance is
   asked "at Jan 15, 2026" (the first line), meaning the statement's beginning balance. The figures are the same, since
   no bank line falls between the file's start and its first line.
4. **Waiting on shared browser slots.** One run of mine (undo-roles alone) was stopped while still queued (its 900 s
   limit would have killed it); the seven-part run replaced it.
5. **The first phase gate run failed one reference step and was then stopped by the 2-hour background limit.**
   EMAIL DIALOG (the invitation email dialog; nothing of this plan runs there) failed one check on the phone at
   520 px frame height: "every paragraph of the email, its footer and the buttons were seen whole (4 of 11)", while
   other executors' gates shared the browser slots. The run was then killed at the time limit mid-way. Rerun into the same folder on
   the same tree (HEAD fda7766, nothing uncommitted): EMAIL DIALOG passed and every other step passed or was kept;
   GATE_EXIT=0. The leftover server/node_modules link of the killed run was removed before the rerun.

## Gate (verbatim, last lines of O/gate.txt; tail -n 45)
```
GATE ok   HELP PREVIEW (6) (kept from 2026-11-27 03:28:53 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-27 03:32:38 UTC)
GATE ok   signing-plan (kept from 2026-11-27 03:34:26 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 456
# pass 456
# fail 0
GATE ok   server tests 456 = base 456 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAX1099 FLOW
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   AUDIT FLOW
GATE ok   AUDIT SAME
GATE ok   BANK FILES
GATE ok   BANK FLOW
GATE ok   BANK REC
GATE ok   BOOKS CORE
GATE ok   BOOKS FLOW
GATE ok   BUSINESS DAYS
GATE ok   ENGINE BOOKS
GATE ok   HOLDINGS
GATE ok   NEW SCHEDULES
GATE ok   NO ONBOARDING
GATE ok   PDF OUT
GATE ok   POSTING
GATE ok   SAMPLES BOOKS
GATE ok   STATEMENTS
GATE ok   WORKBOOK
GATE_EXIT=0
```

## Verify lines
- Task 1: `grep -q "bank: \['bankfiles.js', 'books-bank.js', 'books-bank-ui.js'\]" assets/js/books-ui.js` passes;
  O/tracer.txt ends `BANK FLOW: PASS (parts run: 1)` (42 checks).
- Task 2: O/t2.txt ends `BANK FLOW: PASS (parts run: 7)` (169 checks).
- Task 3: O/flow.txt ends `BANK FLOW: PASS (parts run: 8)` (185 checks: import-phone 42, csv-desktop 25,
  twice-phone 21, file-kept 15, refused 20, split-desktop 17, undo-roles 29, published 16).
- B2: `git diff --quiet c8f922f HEAD -- server/help/guide.md server/lib/help-guide.mjs .planning/tools/preview/help-data.js`
  passes (no guide bytes).
- W4: `git diff --name-only c8f922f HEAD` (SUMMARY filtered) is assets/js/books-bank-ui.js, assets/js/books-bank.js,
  assets/js/books-ui.js, checks/bank-flow.js **and checks/books-flow.js** (the deviation below); fixtures/bank and
  fixtures/bank/real are untouched.
- BANK REC after the reconcile() change: `BANK REC: PASS (cases run: 10)` (run directly, and in the gate).

## What was built
- **assets/js/books-bank-ui.js** (new, shipped; loaded on the Accounting page's first drawing by books-ui.js with
  bankfiles.js and books-bank.js, which now load on demand too; no page's script list changes). Sections: Bank
  accounts (Add bank account: Name, Last four digits, four digits required); Statements (the file control
  "Statement file (CSV, OFX, QFX, QBO or BAI2)", the result line "<n> new lines, <m> already imported.", the layout
  form, the overlap question with Add anyway / Add only the other lines / Cancel); Suggestions (Accept all suggestions
  (n), Accept, Match among several, Not this); Lines to decide (an account, Purchase of an investment, Sale of an
  investment with Cost given up, Split between accounts with Off by; Investment, new or existing; Investor on 3000,
  3100, 3900, 2400 and 2000 (W6); Post); Decided (Undo while the period is open; Move match when the matched entry
  was replaced, W1); Reconcile (Statement date, Statement balance filled from the latest file that carries one,
  Opening balance when needed, the figures, the outstanding items, Mark reconciled only at $0.00).
- The CSV layout form is one function, `layoutHTML(p)` with `formOf` / `mapOf`, for 16-11 to follow.
- Change log: Bank account added, Bank statement imported (file name, SHA-256, lines added, account ending), Bank line
  matched, Bank line posted, Bank decision undone, Bank account reconciled, Bank opening balance entered.
- **assets/js/books-bank.js**: import records keep `openingCents` / `closingCents` from the file (null when it has
  none); `openingOf`, `setOpening`; `reconcile()` with the opening (B3), `markReconciled()` refuses while it is needed
  and stores `opening` on the record when there is one. Without a need for an opening nothing changes (BANK REC passes).
- **assets/js/books-ui.js** line 127: `const PARTS = Object.freeze({ bank: ['bankfiles.js', 'books-bank.js', 'books-bank-ui.js'] });`
  with the comment in the present tense (B1).

## Deviations from Plan
1. [Rule 3, blocking] **books-flow.js changed (outside files_modified).** B1 makes BOOKS FLOW ask for the bank files
   on every page load; its entries-desktop part reloads, so its "asked once" check could not pass. Two lines in
   reframe() count each load's asks. W4's exact file list therefore has one more file.
2. [Rule 2] **books-bank.js also keeps the file's balances on the import** (needed for "Statement balance filled from
   the file"; the import record had no balance). BANK REC passes.
3. [Plan order] Undo and the file store came with Task 1, not Task 2: import-phone's "six kinds of change log entry"
   includes "Bank decision undone", and an import record naming a file id without the file would be false. So
   file-kept already passed at RED-2.
4. [Rule 2] **Long digit runs masked**: nine or more digits in a file name or a line's text are cut to "****" plus the
   last four before anything is stored or shown (T-11-46). The stored file keeps the original bytes as evidence.
5. [Rule 2] **No accept list on the file input**, so the iPhone file picker cannot grey out .ofx, .qfx, .qbo or .bai
   files; the content decides (a PDF is refused with one line).
6. [Rule 2] **"Add only the <n> other lines"** on the overlap question when part of a file is new (otherwise the only
   choices are duplicating the overlap or dropping the new lines too). Not shown when every line overlaps.
7. Outstanding amounts read "−$3,000.00" (the Accounting and Audit pages' own format), not "$(3,000.00)" as the plan's
   example writes them.
8. RED-3 was run by placing the check in an extracted copy of the base tree (the base has no Bank section), as 11-13
   did; the copy was deleted afterwards.

## Guide lines for the guide pass (B2: none added here)
To go inside `## console-books`, after step 4, with the anchor line among the entry's anchors. Each line is ASCII, so
bytes equal characters; 313 bytes in all with line breaks.
```
anchor: Accept all suggestions
5. "Add bank account": a name and the last four digits of its number.
6. "Statement file": choose the file downloaded from the bank.
7. "Accept all suggestions", then choose an account for each line and "Post".
8. "Mark reconciled" at a statement date once the difference is $0.00.
```
(30, 69, 62, 77 and 70 bytes.) Every quoted name is text in books-bank-ui.js.

## Owner check (not done; nothing here is called ready until it is)
On the iPhone, in the published preview: Accounting, Bank; add a bank account; upload a statement file saved on the
phone (fund-a.ofx, or your own bank's export with the numbers masked); accept the suggestions, decide one line,
reconcile. Screens: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-11-15/shots (index.txt lists them). Untried: picking a file inside the Claude app on an iPhone, and any real bank's export.

## Open items
- The Audit page's bank reconciliation schedule (audit.js, not this plan's) prints a stored outstanding item with no
  entry (the pre-opening figure, only when it is not zero) with an empty description; one line there could name it.
- An entry posted from a bank line and then reversed from the Entries section leaves its line marked decided; Undo
  then reports "already been reversed". A small fix belongs with books-bank.js.
- fund.exceptions stay with the planned Accounting-page plan (orchestrator decision).
- bank-flow.js gives captions (describeShots) to two of its six screenshots only; the owner's index.txt was captioned by
  hand after the gate. Four caption lines can be added with the next change to the check.
- The statement reader returns no statement start date (OFX DTSTART, a BAI2 as-of date); if it did, the opening
  balance could be asked at the bank's own start date instead of the first line's.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model (the file upload is T-11-45; last four only is T-11-46; escaping is T-11-47;
roles are T-11-48, proven in undo-roles).

## Self-Check: PASSED
The five files exist; all nine commits (f905bd6, 7b4b08e, 137879c, b88325f, 14cf4f5, 8eb30df, 57e15c5, fcdf872,
fda7766) are on HEAD; books-ui.js holds the B1 line once; base trees deleted (the gate's and the RED-3 copy);
server/node_modules is not in the tree; the owner's six screenshots are kept in SCRATCH/exec-11-15/shots, the rest of
the screenshots and page captures were deleted.

## Evidence as produced (O = SCRATCH/exec-11-15; base-commit.txt = c8f922fcba6be6e6d38809843e01e5a36fafa891).

### RED-1 (import-phone before books-bank-ui.js existed), O/red-1.txt
```
PASS import-phone the frame refuses fetch() (connect-src none is in force)
PASS import-phone fund A seated with only its value entries posted (2, nothing synced)
FAIL import-phone ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded.
  (waiting for locator('[data-bk="part-bank"]') to be visible)
BANK FLOW: FAIL (parts run: 1) - import-phone
```

### Task 1 verify (tracer), O/tracer.txt, HEAD after 7b4b08e plus the layout tweak
42 checks passed, none failed.
```
PASS import-phone phone: every file the parts list names ships
PASS import-phone phone: no request failed or was answered with an error
BANK FLOW: PASS (parts run: 1)
```

### RED-2 (Task 2's six parts against the Task 1 code, HEAD b88325f), O/red-2.txt
54 checks passed, 18 failed; file-kept passed already (the file store came with Task 1, see Deviations). The four
`refused` failures were partly the check's own fault: it read errors from `.bb-err` while the section draws them as
`.bk-err` (fixed in the check after this run; the refusals themselves were drawn).
```
FAIL csv-desktop fund-a-signed.csv shows the layout form and stores nothing yet :: {"layout":false,"errs":[]}
FAIL csv-desktop the first five lines are shown with money in and money out :: []
FAIL twice-phone before the opening balance: "To be confirmed: opening balance at Jan 15, 2026", never $0.00, and nothing can be stored :: {... "openField": false ...}
FAIL twice-phone the opening balance is stored at 2026-01-15 with who entered it and when :: null
FAIL refused a PDF shows one line saying the file cannot be read :: []
FAIL split-desktop ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FAIL undo-roles the matched line offers "Move match" to the new entry :: [... "move":0 ...]
FAIL undo-roles after Move match the line names the new entry, dated 2026-12-14 and not reversed :: {"match":{"entry":"je-000016","line":2},"date":"2026-12-15","src":"run:fa-run-1","reversed":true}
FAIL undo-roles a team member can upload (the layout form, as the account has no kept layout) :: []
BANK FLOW: FAIL (parts run: 6) - csv-desktop, twice-phone, refused, split-desktop, undo-roles

### First run of Task 2's code (O/try2.txt): 108 passed, 4 failed
Three were the check's own selector (it looked for `.bb-form[data-kind="layout"]`; the form is `.bk-form`). The fourth
was the check's own order: the team member sold part of Portfolio Co X before its purchase had been decided, and the
books refused it ("more than the investment's cost of $0.00"). The check now decides the purchase first.

### BOOKS FLOW after B1 (O/books-flow-fail-1.txt): FAIL, 174 passed, 1 failed
```
FAIL entries-desktop the bank files were asked for only as the parts list names them, in order :: {"asked":["/assets/js/bankfiles.js","/assets/js/books-bank.js","/assets/js/books-bank-ui.js","/assets/js/bankfiles.js","/assets/js/books-bank.js","/assets/js/books-bank-ui.js"],"want":[...the three once...]}
BOOKS FLOW: FAIL (parts run: 8) - entries-desktop
```
Cause: with PARTS no longer empty, entries-desktop reloads the page, and the reloaded page asks for the three files
again; the check counted the asks of both loads. Fixed in books-flow.js (outside files_modified, see Deviations):
reframe() empties the list before each reload, so each load's asks are compared with the parts list.

### RED-3 (published, the check run inside an extracted copy of the base tree c8f922f), O/red-3.txt
```
PASS published the frame refuses fetch() (connect-src none is in force)
FAIL published ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded.
  (waiting for locator('[data-bk="part-bank"]') to be visible)
BANK FLOW: FAIL (parts run: 1) - published
```
The extracted base tree was deleted after the run.

### Task 2 verify (O/t2.txt; code of 8eb30df, check of 57e15c5): 169 passed, none failed
Per part: import-phone 42, csv-desktop 25, twice-phone 21, file-kept 15, refused 20, split-desktop 17, undo-roles 29.
```
BANK FLOW: PASS (parts run: 7)
```
