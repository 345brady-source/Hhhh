---
phase: 11-fund-accounting-and-cpa-year-end-package
plan: 13
status: in-progress
---

# Phase 11 Plan 13: the Accounting page (in progress)

Base commit: 0dd6b3f (origin/claude/refract-reskin; docs-only over 6b3a4a3). The worktree this run was given held
wip/11-12's unfinished commits (63f61ff); 11-13 is built on the integration branch instead, so wip/11-13 carries none of
11-12's work.

## Evidence as produced

### RED-1 (entries-phone, before the page existed), SCRATCH/exec-11-13/red-1.txt
```
PASS entries-phone the frame refuses fetch() (connect-src none is in force)
PASS entries-phone fund A seated with only its directly posted entries (8, nothing synced)
FAIL entries-phone phone: the menu's Operate group has Accounting :: ["Capital calls","Distributions","Requests","Notices","Documents","Tax documents"]
FAIL entries-phone phone: tapping it opens the Accounting page :: Kestrel Bay Capital
FAIL entries-phone ran to the end :: frame.waitForSelector: Timeout 30000ms exceeded. (waiting for #bk-fund)
BOOKS FLOW: FAIL (parts run: 1) - entries-phone
```
(The page was loaded before the code was written; the run's "tree changed" note is from the edits made while it waited.)

### Guide bytes (GUIDE.sponsor, measured with Buffer.byteLength)
- before: 46,698
- after: 47,116 (+418; cap 450)
