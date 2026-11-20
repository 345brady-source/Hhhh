---
quick: "261120-filings-guide"
phase: "09"
plan: "261120-filings-guide"
subsystem: help
tags: [help-guide, filings, form-d, edgar-access, state-notices, W-1]
requires: [09-04, 09-06, 09-07]
provides: [help guide bullets for the three new Filings sections]
key-files:
  created:
    - .planning/quick/261120-filings-guide/names-check.sh
  modified:
    - server/help/guide.md
    - server/lib/help-guide.mjs (generated)
    - server/test/help.test.mjs
decisions:
  - "The daily help cap test derives its cap from the guide's real size instead of a fixed $0.006, which only allowed a sponsor guide of about 40,400 bytes against the 48,000-byte limit."
  - "The EDGAR access bullet says each person's own sign-in rather than naming the sign-in service, to keep provider names out of the guide."
metrics:
  completed: "2026-11-21"
status: complete
actuals:
  tasks: 2
  commits: 3
plan_head_before: 0e0df5c30e3fe9f419039b2f6a20faf4dddaedb4
plan_head_after: 26ff86c
---

# Quick 261120: the help guide names Form D, EDGAR access and State filings (W-1)

## Failures first

1. **The first full server run failed 41 of 358.** Cause: the worktree had no `server/node_modules`, so every test that
   reaches the model client answered 503 `unavailable`. Fixed by linking the main checkout's installed modules
   (gitignored, nothing installed). Not caused by the guide.
2. **The next run failed 1 of 358, and this one was caused by the guide edit:** `help.test.mjs` "the daily help cap ...",
   `a bound of about $0.0051 fits in $0.006`, `402 !== 200`. That test's fixed $0.006 cap fits one question only while the
   rules plus the sponsor guide stay under about 43,900 bytes (sponsor guide about 40,400). The guide went from 39,060 to
   41,611 bytes, still under its 48,000 limit. The cap is now computed in the test from `RULES` and `GUIDE.sponsor`:
   one question's worst case plus $0.0006, less than the first call's real cost, so the same three assertions hold (first
   fits, second 402, next day fits). No test added, none removed: 358.
3. Not checked by the owner. The help chat has not been asked a Filings question with these bullets (no paid run).

## RED, then GREEN

`names-check.sh` (23 names, each literal in assets/js and quoted in `## console-filings`) on the unchanged guide:
`NAMES CHECK: FAIL (23 of 23)`. After the edit: `NAMES CHECK: PASS (23 names)`.

## Verify (verbatim last lines)

- `(cd server && node --test test/help-guide.test.mjs)`: `# tests 9`, `# pass 9`, `# fail 0`
- `npm --prefix server test`: `# tests 358`, `# pass 358`, `# fail 0`
- `help-measure.mjs --lint --set help-questions.dev.json`: `LINT: PASS (cases: 24)`
- `help-measure.mjs --selftest`: `HELP MEASURE SELFTEST: PASS (checks run: 31)`
- Sponsor guide 41,611 bytes (limit 48,000); longest new line 937 characters (limit 1,000).

## Commits

- 64dbf95 test: names check (RED)
- 64c7ed4 fix: the daily help cap test follows the guide's size
- 26ff86c docs: the three bullets, module regenerated with `node server/help/build.mjs`

## Self-Check: PASSED
names-check.sh, guide.md and help-guide.mjs present; 64dbf95, 64c7ed4, 26ff86c are ancestors of HEAD.
