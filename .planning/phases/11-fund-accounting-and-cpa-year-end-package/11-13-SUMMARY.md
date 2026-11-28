---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 13
subsystem: ui (self-serve console: the Accounting page)
status: complete
tags: [accounting, journal, investments, opening-balances, close, console, self-serve, fa-01, fa-04, fa-05, fa-07, fa-12]
requires: ["11-01 (books.js)", "11-05 (books-post.js sync)", "11-07 (generated(o))", "11-10 (books-hold.js value, opening, finalize, reopenBooks)", "11-11"]
provides:
  - "NS.views['console-books'] (self-serve only): Entries, Investments, Opening balances (owner, real funds), Close"
  - "NS.booksUI { part, PARTS, refresh }: sections other files add, listed in PARTS only once their files ship"
  - "checks/books-flow.js: BOOKS FLOW: PASS (parts run: 8)"
affects: [11-15, 11-16]
key-files:
  created: [assets/js/books-ui.js, assets/css/books.css, .planning/phases/11-fund-accounting-and-cpa-year-end-package/checks/books-flow.js]
  modified: [assets/js/console.js, diy.html, portal.html, server/help/guide.md, server/lib/help-guide.mjs, .planning/tools/preview/help-data.js]
key-decisions:
  - "PARTS is empty until 11-15: a section is listed only when its files ship, so no visit asks for a missing file"
  - "The page syncs the books on every drawing (B2) and saves only when the sync posted or reversed something"
  - "Opening balances only for a fund that is not a sample fund (I3), as Debit/Credit lines plus one capital field per holder"
requirements-completed: [FA-01, FA-04, FA-05, FA-07, FA-12]
actuals:
  tokens: 23428    # chars/4 over the added lines of 0dd6b3f..HEAD, help-data.js excluded
  tasks: 3
  commits: 8       # git rev-list --count 0dd6b3f..7992bf8 (this summary's commit not counted)
plan_head_before: 0dd6b3f2861ac68f69d5df6800212b1c1c520236
plan_head_after: 7992bf84080b020b652bcff7c8e6219668a7377e
---

# Phase 11 Plan 13: the Accounting page

One new self-serve console page, Accounting (Operate), for the books' only manual inputs: journal entries added and
reversed, investments with cost and value and a value entered at a date, opening balances once (owner, real funds
only), closing a month and reopening it with a reason. The page brings the books up to date on every drawing (B2) and
only calls the ledger's functions. The phase gate passed (GATE_EXIT=0). **The owner has not checked it yet:** the
iPhone check below is pending, so it is not done.

## Failures and incidents first

1. **Shared worktree.** The first run of this plan was given a worktree that held another executor's unfinished 11-12
   commits (63f61ff, audit.js changes). It moved its work onto a clean branch, wip/11-13-iso (029d1fd, built on 0dd6b3f,
   touching only this plan's files). Do not use wip/11-13: it is mixed with 11-12's commits. Its tracer pass (22/22) was
   taken in that shared tree, so it was not counted. This run used a fresh worktree of its own, confirmed
   `git diff --stat 0dd6b3f..HEAD` listed only this plan's 9 files, and ran the tracer again (see Evidence).
2. **A missing file was requested.** books-ui.js listed the bank section (bankfiles.js, books-bank.js, books-bank-ui.js)
   in PARTS before books-bank-ui.js exists (it comes with 11-15), so the first visit asked the server for a file that is
   not there (one 404). Fixed: PARTS lists a section only when its files ship, as taxdocs-ui.js does, and it is empty
   until 11-15. The check now proves on every part that every file PARTS names ships, that the bank files are asked for
   only as PARTS names them, and that no request fails or gets an error response. RED (O/red-4.txt, the new check
   against the old books-ui.js):
   ```
   FAIL published every file the parts list names ships beside books-ui.js :: {"listed":["bankfiles.js","books-bank.js","books-bank-ui.js"],"missing":["books-bank-ui.js"]}
   BOOKS FLOW: FAIL (parts run: 1) - published
   ```
3. **The first phase gate run failed its server tests**, 2 of 403, both in the guide test (GATE_FRESH=1, HEAD f0ba476):
   ```
   GATE FAIL server tests # fail 0
   not ok 129 - no stale entry: every entry and every skip line names a route or step the code still has
     entries or skip lines for routes or steps that no longer exist: console-books
   not ok 130 - names on the screens: every anchor and every quoted name in the guide is text the portal source holds
     console-books: anchor "Add entry" is not in any file
     console-books: anchor "Enter value" is not in any file
   ```
   Cause: books-ui.js registered the page as NS.views[ROUTE], and the test finds pages by NS.views['<route>'] written
   out (the form the plan gives). Fixed in 379bc6a. Server tests after the fix: `# tests 403`, `# pass 403`,
   `# fail 0`. That gate run was stopped once the step had failed and was started again on the fixed tree.
4. **Browser crashes and a timing failure in the reference gate's signing steps** (not this plan's code; recorded so
   nothing is hidden). Run 2 (HEAD 7992bf8) reported GATE FAIL for SIGNING DOCUMENTS, RECORD AND LOST AGREEMENT, SCREEN
   EDGES, PRESS AND CO-INVESTOR and CO-INVESTOR SERVER, every one from "Page crashed" / "Target crashed" / "browser has
   been closed" while several executors' gates shared the three browser slots. Run 2 then hit the 2-hour limit. Run 3
   (same folder, same tree) passed all of them except CO-INVESTOR SERVER, where cosign-forged failed one fixed-wait
   assertion (`said: []` after a 2500 ms wait). Run 4 (same tree) passed it. Nothing in this plan runs on those pages:
   books-hold.js is a pure library, and books-ui.js draws only on #console-books. Other trees pass those steps in the
   same days, and reruns on this unchanged tree passed them too.
5. **Owner's screenshots.** In the first full run the values-phone screenshot showed the Entries list although its
   caption named Investments (on a phone, Investments sits below 23 entries). The check now scrolls each named section
   to the top before its screenshot (02ee07b).

## Gate (verbatim, last lines of O/gate.txt, run 4 at HEAD 7992bf8; tail -n 45)
```
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-26 23:28:27 UTC)
GATE ok   CO-INVESTOR SERVER (5)
GATE ok   HELP PREVIEW (6) (kept from 2026-11-26 21:44:44 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-26 21:48:10 UTC)
GATE ok   signing-plan (kept from 2026-11-26 21:55:35 UTC)
GATE ok   record-base (kept from 2026-11-26 21:56:25 UTC)
GATE ok   record-plan (kept from 2026-11-26 21:58:02 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 15 PASS / 3 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 403
# pass 403
# fail 0
GATE ok   base-server-tests (kept from 2026-11-26 21:58:23 UTC)
GATE ok   server tests 403 = base 403 + 0 declared
GATE ok   DIST FLOW (kept from 2026-11-26 22:01:42 UTC)
GATE ok   DIST RECORD (kept from 2026-11-26 22:01:44 UTC)
GATE ok   K1 SPLIT (kept from 2026-11-26 22:02:06 UTC)
GATE ok   SHIPPED LIBS (kept from 2026-11-26 22:08:00 UTC)
GATE ok   TAX 1099 (kept from 2026-11-26 22:08:03 UTC)
GATE ok   TAX FORMS (kept from 2026-11-26 22:08:05 UTC)
GATE ok   TAX MATH (kept from 2026-11-26 22:08:05 UTC)
GATE ok   TAXDOCS FLOW (kept from 2026-11-26 22:20:55 UTC)
GATE ok   TAXDOCS MATH (kept from 2026-11-26 22:20:56 UTC)
GATE ok   TAXLINK FLOW (kept from 2026-11-26 22:28:36 UTC)
GATE ok   TAXRECORD FLOW (kept from 2026-11-26 22:29:20 UTC)
GATE ok   WITHHOLDING FLOW (kept from 2026-11-26 23:39:57 UTC)
GATE ok   AUDIT SAME (kept from 2026-11-26 23:40:26 UTC)
GATE ok   BANK FILES (kept from 2026-11-26 23:40:29 UTC)
GATE ok   BANK REC (kept from 2026-11-26 23:40:31 UTC)
GATE ok   BOOKS CORE (kept from 2026-11-26 23:40:32 UTC)
GATE ok   BOOKS FLOW (kept from 2026-11-26 23:43:56 UTC)
GATE ok   ENGINE BOOKS (kept from 2026-11-26 23:43:57 UTC)
GATE ok   HOLDINGS (kept from 2026-11-26 23:43:58 UTC)
GATE ok   NO ONBOARDING (kept from 2026-11-26 23:43:59 UTC)
GATE ok   PDF OUT (kept from 2026-11-26 23:54:56 UTC)
GATE ok   POSTING (kept from 2026-11-26 23:55:01 UTC)
GATE ok   SAMPLES BOOKS (kept from 2026-11-26 23:55:08 UTC)
GATE ok   STATEMENTS (kept from 2026-11-26 23:55:09 UTC)
GATE ok   WORKBOOK (kept from 2026-11-26 23:57:01 UTC)
GATE_EXIT=0
```
GATE_EXIT=0. Run 4 has no GATE FAIL line. Every "kept" step was run on this same tree (HEAD 7992bf8, no
uncommitted change) in runs 2 to 4; the gate keys each step on HEAD, the uncommitted changes and the base commit. The
gate's BOOKS FLOW (O/gate/books-flow.txt) ran 176 checks with none failing. That is one more than the run outside the
gate, because with P11_ROOT set the managed part also compares index.html byte for byte with the base tree.
The gate removed the base tree; server/node_modules (linked by this run) is removed.

## Evidence as produced (O = SCRATCH/exec-11-13; base-commit.txt = 0dd6b3f)

### RED-1 (entries-phone, before the page existed), O/red-1.txt
```
PASS entries-phone the frame refuses fetch() (connect-src none is in force)
PASS entries-phone fund A seated with only its directly posted entries (8, nothing synced)
FAIL entries-phone phone: the menu's Operate group has Accounting :: ["Capital calls","Distributions","Requests","Notices","Documents","Tax documents"]
FAIL entries-phone phone: tapping it opens the Accounting page :: Kestrel Bay Capital
FAIL entries-phone ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (waiting for #bk-fund)
BOOKS FLOW: FAIL (parts run: 1) - entries-phone
```

### RED-1b (B2: the page without its sync call), O/red-1b.txt
```
FAIL entries-phone phone: fund A's 23 entries are listed (the page brought its books up to date) :: {"n":8,"count":"8 entries","sync":""}
FAIL entries-phone phone: the newest first :: [... only the value and bank entries ...]
FAIL entries-phone phone: an entry from a record has no Reverse :: ["mark:fa-m2:false","mark:fa-m1:false","bank:fa-6:true",...]
FAIL entries-phone phone: 24 entries are listed :: {"n":9,"count":"9 entries","errs":[]}
BOOKS FLOW: FAIL (parts run: 1) - entries-phone
```

### RED-2 (Task 2's five new parts on the base tree), O/red-2.txt
```
FAIL entries-desktop desktop: the menu's Operate group has Accounting :: ["Capital calls","Distributions","Requests","Notices","Documents","Tax documents"]
FAIL entries-desktop ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (#bk-fund)
FAIL values-phone ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (.bk)
FAIL opening-desktop ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (.bk)
FAIL close-desktop ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (.bk)
FAIL roles ran to the end :: frame.evaluate: TypeError: NS.books.finalize is not a function
BOOKS FLOW: FAIL (parts run: 5) - entries-desktop, values-phone, opening-desktop, close-desktop, roles
```

### RED-3 (Task 3's parts on the base tree), O/red-3.txt
managed already passes on the base. That is expected: the managed edition must be unchanged, so it is green before and
after.
```
FAIL published portal.html: the menu's Operate group has Accounting :: ["Capital calls","Distributions","Requests","Notices","Documents","Tax documents"]
FAIL published portal.html: tapping it opens the Accounting page :: Kestrel Bay Capital
FAIL published ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (#bk-fund)
BOOKS FLOW: FAIL (parts run: 2) - published
```

### RED-4 (the loader fix), O/red-4.txt: quoted under failure 2.

### Tracer, rerun in this run's own worktree (HEAD e9d71da), O/tracer.txt
25 checks passed, none failed (22 before, plus the three request checks of failure 2).
```
PASS entries-phone the bank files were asked for only as the parts list names them, in order
PASS entries-phone no request failed or was answered with an error
BOOKS FLOW: PASS (parts run: 1)
```

### Task 2, six parts, O/t2.txt
145 checks passed, none failed. entries-phone was kept from the tracer run on the same tree.
```
BOOKS FLOW: PASS (parts run: 6)
```

### Full run, eight parts (HEAD 02ee07b), O/flow.txt
175 checks passed, none failed: entries-phone 25, entries-desktop 39, values-phone 22, opening-desktop 21,
close-desktop 18, roles 20, managed 11, published 19.
```
PASS published the bank files were asked for only as the parts list names them, in order
PASS published no request failed or was answered with an error
BOOKS FLOW: PASS (parts run: 8)
```
The only change after this run was 379bc6a (the written-out view key and a comment). The gate's own BOOKS FLOW ran on
that tree (176 passed).

### Help guide
- `node server/help/build.mjs --verify`: `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md`
- `node .planning/tools/preview/make-help-data.mjs`: `wrote .planning/tools/preview/help-data.js (guide a8fd76f0285b, 74254 bytes)`; `--verify`: `help-data.js: current (guide a8fd76f0285b)`
- GUIDE.sponsor (Buffer.byteLength): 46,698 at 0dd6b3f, 47,116 now. **+418 bytes** (cap 450).
- index.html: `git diff --quiet 0dd6b3f HEAD -- index.html` holds (unchanged).

## Exact lines added

assets/js/console.js (one line, directly after the taxdocs splice, W5):
```
  NAV.splice(NAV.findIndex((n) => n[0] === 'console-taxdocs') + 1, 0, ['console-books', 'Accounting']); NAV_SECTIONS.find((g) => g[0] === 'Operate')[1].push('console-books'); // Accounting (books-ui.js) after Tax documents; kept on its own line
```
diy.html and portal.html (identical; books.css directly after console.css, the two scripts directly after console.js, W4):
```
  <link rel="stylesheet" href="assets/css/books.css">
  <script src="assets/js/books-hold.js"></script>
  <script src="assets/js/books-ui.js"></script>
```
server/help/guide.md: in the `## console` entry, the Operate group now reads `(Capital calls, Distributions, Requests,
Notices, Documents, Tax documents, Accounting)`; after the console-taxdocs entry:
```
## console-books
audience: sponsor
kind: console
title: Accounting
menu: Operate, then Accounting
anchor: Add entry
anchor: Enter value

The fund's manual inputs: entries the bank does not show, investment values, opening balances and closing a month.

1. Choose the "Fund".
2. "Add entry": a date, a memo and lines; it saves only when debits equal credits.
3. "Enter value" records an investment's fair value at a date.
4. An owner closes a month with "Close through".
```
server/lib/help-guide.mjs is regenerated by build.mjs only, never edited by hand.

## Owner's check: PENDING
On the iPhone, in the published preview: the console menu, Operate, Accounting; pick a fund; add an entry that balances
and one that does not; enter a value for an investment; as owner, close a month and reopen it with a reason. Expected:
every section says in one line why it is there, nothing asks for more than it needs, an unbalanced entry cannot be
saved, and there is always a visible way back. The check's screens are in SCRATCH/exec-11-13/shots with index.txt
(entries-phone, entries-desktop-offby, values-phone, opening-desktop, close-desktop, published-phone). They are kept for
this check and were not deleted.

## Deviations from Plan
1. [Rule 3] Base is 0dd6b3f (origin/claude/refract-reskin; it differs from 6b3a4a3 in docs only).
2. [Rule 3] This base has no Trial balance schedule (that comes with 11-12). The check reads the 5100 row of the Audit
   page's Trial balance tab when it is there, and otherwise "Professional fees" in the Statement of operations
   ($9,500.00 for 2026 either way).
3. Fund A's two values are seated as marks fa-m1 (2026-09-30, $460,000.00) and fa-m2 (2026-12-31, $490,000.00).
4. Opening balances are entered as Debit/Credit lines plus one capital field per holder, with the same "Off by" line as
   entries.
5. The chosen fund is kept per firm in browser storage (NS.store 'books-fund'). Investor and investment fields appear
   and disappear in place as the account changes.
6. [Rule 1] PARTS is empty until 11-15 (failure 2). The plan's interface showed PARTS.bank listed already, which made
   the first visit ask for a missing file.
7. [Rule 1] The view key is written out as NS.views['console-books'] (failure 3).
8. [Rule 3] The check proves on every part that every PARTS file ships and that no request fails (orchestrator's
   instruction). The published part no longer expects the three bank files to be asked for.
9. .planning/tools/preview/help-data.js was regenerated (make-help-data.mjs); it is a file outside the plan's list,
   rebuilt from the guide.

## Open items
- **11-15 must add one line to books-ui.js**: `const PARTS = Object.freeze({ bank: Object.freeze(['bankfiles.js',
  'books-bank.js', 'books-bank-ui.js']) });`. Its plan's files_modified does not list assets/js/books-ui.js yet, and
  its header says "loaded by books-ui.js's parts loader". books-flow.js's request checks stay valid after that change:
  they compare the requests with whatever PARTS lists.
- Owner's iPhone check (above). Not done until he has checked it.
- STATE.md and ROADMAP.md were not updated on this wip branch (orchestrator's merge does it). Not merged into
  claude/refract-reskin.

## Known Stubs
None. Every figure on the page comes from NS.books. The empty-offerings line ("No offerings yet. The books start with
the first offering.") is real empty-state text, not a placeholder.

## Threat Flags
None beyond the plan's register. T-11-38 is held by the roles part, T-11-39 by values-phone (a name with angle
brackets is shown as text), T-11-40 by entries-desktop (stray characters refused), and T-11-41 by change-log reads in
every part.

## Files a preview build must add
assets/js/books-ui.js, assets/css/books.css (new here); assets/js/books.js, books-post.js, books-hold.js (earlier
plans, now loaded by diy.html and portal.html).

## Commits (0dd6b3f..7992bf8, branch wip/11-13-iso)
- 11184f3 test(11-13): the Accounting page's check, eight parts (RED)
- 029d1fd wip(11-13): save (the page, styles, menu line, page lines, guide entry: previous run)
- e9d71da wip(11-13): save (PARTS listed only when files ship; request checks on every part)
- 24a924c chore(11-13): preview help data rebuilt with the Accounting entry
- 02ee07b test(11-13): owner's screenshots show the section they name
- f0ba476 docs(11-13): summary evidence so far
- 379bc6a fix(11-13): the Accounting view's key written out so the guide test finds the page
- 7992bf8 docs(11-13): summary: the first gate run's failure and its fix

## Self-Check: PASSED
Files: assets/js/books-ui.js, assets/css/books.css, checks/books-flow.js present. Commits 11184f3, 029d1fd, e9d71da,
24a924c, 02ee07b, f0ba476, 379bc6a and 7992bf8 are ancestors of HEAD. index.html is unchanged against 0dd6b3f.
server/node_modules is removed. O/gate/base-tree is absent.
