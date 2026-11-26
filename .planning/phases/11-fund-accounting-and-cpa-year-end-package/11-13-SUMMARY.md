---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 13
subsystem: ui
tags: [accounting, journal, console, self-serve]
status: in-progress
requirements-completed: []
---

# Phase 11 Plan 13: the Accounting page (gate pending; the owner has not checked it)

One new self-serve console page, Accounting (Operate), holding the books' only manual inputs: journal entries added and
reversed, investments with cost and value and a value entered at a date, opening balances once (owner, real funds only),
closing a month and reopening it with a reason. The page brings the books up to date on every drawing (B2) and only
calls the ledger's functions. Not ready until the phase gate passes and the owner has checked it on his iPhone.

## Failures and incidents first

1. Shared worktree. The first run of this plan was given a worktree that held another executor's unfinished 11-12
   commits (63f61ff, audit.js changes). It moved its work onto a clean branch, wip/11-13-iso (029d1fd, built on 0dd6b3f,
   touching only this plan's files). wip/11-13 is mixed with 11-12's commits and must not be used. Its tracer pass
   (22/22) was taken in that shared tree, so it was not counted: the tracer was run again here, in a fresh worktree of
   this run's own (see Evidence).
2. A missing file was requested. books-ui.js listed the bank section (bankfiles.js, books-bank.js, books-bank-ui.js) in
   PARTS before books-bank-ui.js exists (it comes with 11-15), so the first visit asked the server for a file that is
   not there (one 404). Fixed: PARTS lists a section only when its files ship, as taxdocs-ui.js does; it is empty
   until 11-15. The check now proves on every part that every file PARTS names ships, that the bank files are asked for
   only as PARTS names them, and that no request fails or is answered with an error. RED (red-4.txt, the new check
   against the old books-ui.js):
   ```
   FAIL published every file the parts list names ships beside books-ui.js :: {"listed":["bankfiles.js","books-bank.js","books-bank-ui.js"],"missing":["books-bank-ui.js"]}
   BOOKS FLOW: FAIL (parts run: 1) - published
   ```
3. The owner's screenshots of the first full run showed the Entries list where the caption named Investments (the
   section is below 23 entries on a phone). The check now scrolls each named section to the top before its screenshot.

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
managed passes on the base (expected: the managed edition must be unchanged, so it is green before and after).
```
FAIL published portal.html: the menu's Operate group has Accounting :: ["Capital calls","Distributions","Requests","Notices","Documents","Tax documents"]
FAIL published portal.html: tapping it opens the Accounting page :: Kestrel Bay Capital
FAIL published ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (#bk-fund)
BOOKS FLOW: FAIL (parts run: 2) - published
```

### Tracer, rerun in this run's own worktree (HEAD e9d71da), O/tracer.txt
25 checks passed, none failed (22 before, plus the three request checks of failure 2).
```
PASS entries-phone the bank files were asked for only as the parts list names them, in order
PASS entries-phone no request failed or was answered with an error
BOOKS FLOW: PASS (parts run: 1)
```

### Task 2, six parts, O/t2.txt
145 checks passed, none failed (entries-phone kept from the tracer run on the same tree).
```
BOOKS FLOW: PASS (parts run: 6)
```

### Full run, eight parts (HEAD 24a924c), O/flow.txt
175 checks passed, none failed: entries-phone 25, entries-desktop 39, values-phone 22, opening-desktop 21,
close-desktop 18, roles 20, managed 11, published 19.
```
PASS published the bank files were asked for only as the parts list names them, in order
PASS published no request failed or was answered with an error
BOOKS FLOW: PASS (parts run: 8)
```

### Help guide
- node server/help/build.mjs --verify: `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md`
- node .planning/tools/preview/make-help-data.mjs: `wrote .planning/tools/preview/help-data.js (guide a8fd76f0285b, 74254 bytes)`; --verify: `help-data.js: current (guide a8fd76f0285b)`
- GUIDE.sponsor (Buffer.byteLength): 46,698 at 0dd6b3f, 47,116 now: +418 bytes (cap 450).
- index.html: `git diff --quiet 0dd6b3f HEAD -- index.html` holds (unchanged).

<!-- gate pending -->
