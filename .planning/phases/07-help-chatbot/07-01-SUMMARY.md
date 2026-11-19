---
phase: 07-help-chatbot
plan: 01
subsystem: help
tags: [help-guide, rules, generator, node-test, white-label]
status: complete
requires: []
provides:
  - "server/lib/help-guide.mjs: VERSION, RULES, MARKER, GUIDE { sponsor, investor }, PAGES (the module plan 07-02 imports)"
  - "server/help/build.mjs: build(), verify(), parse(), parseRules(); --verify for the gate"
  - "eight server tests that fail when a page, step or name on a screen changes without the guide"
affects: [07-02, 07-03, 07-04]
tech-stack:
  added: []
  patterns: ["one source file each for guide and rules, a generated module, a sync test (as phase 06 embed-data)"]
key-files:
  created:
    - server/help/guide.md
    - server/help/rules.md
    - server/help/build.mjs
    - server/lib/help-guide.mjs
    - server/test/help-guide.test.mjs
    - .planning/phases/07-help-chatbot/checks/help-screens.js
  modified: []
decisions:
  - "Pages whose heading is the offering's or document's own name get a fixed title for the page note: Offering, Envelope, Investment, Subscribe, Sign a document, Sign in, Account setup"
  - "The rules' three examples show the form of a reply only (square brackets for the guide's words), so no likely question or expected answer is in the prompt"
  - "The investor guide never uses the word console; a test enforces it"
  - "Text above the first section of guide.md is a note for authors and is not generated"
metrics:
  started: 2026-11-19T15:41:35Z
  completed: 2026-11-19T16:02:00Z
  duration_seconds: 1198
  tasks: 3
  files: 6
actuals:
  tokens: 34586
  tasks: 3
  commits: 5
commits: 5
plan_head_before: f40303f74acb4bcb7601d41b358c4dd7f7bd072a
plan_head_after: fd1a159f23b2cdb3ee667ee7db265f0513b99110
---

# Phase 07 Plan 01: The help guide and its rules Summary

The help guide (47 entries written from the portal's screens) and the assistant's rules, generated into one server module, with eight tests that fail when a page, a step or a quoted name changes without the guide. Nothing here is ready: no model has produced an answer from this guide yet, and the owner has not read it.

## Failures first

Nothing fails in the plan's gate as it stands. What failed on the way, and what was done:

1. **The screen tool's first run failed** (`HELP SCREENS: FAIL (parts run: 4) - console`): the sample portal has no envelope to open. The console part now walks one invited investor to the end first, so an envelope, notifications and a request exist. Second run: PASS, 4 parts.
2. **The "in sync" test failed on its first run** because its one-character change landed on the marker line, which the generator refuses to build. The test now changes the first character of the rules and of the first entry's text. Corrected before the Task 1 commit.
3. **The "names on the screens" test refused eight names** in the first full guide; none was waved through and no test was weakened:
   - "Show pages", "Step N of M": not one string in the source; written without quotes.
   - Two tax-step lines ("Already have a completed form? Upload it instead", "Not a U.S. person for tax purposes? Use the form for foreign investors"): each is a sentence plus a link in the source; now quoted as the two parts they are.
   - Four anchors ("Identity check", "Verify my identity", "Verify my accreditation", "Decline to sign") are in another file than onboarding.js; replaced by anchors that onboarding.js holds.
4. **The read-through against the screens and code found five wrong or unsupported sentences**, all corrected: "Countersign" was placed on the E-sign list (it is on the Investors page's invitation list; an envelope has "Sign as sponsor"); "ACH file" and "Generate NACHA file" were described as downloads (they build the file); the requests row buttons are "Record payment" and "Record funding"; the automatic-acceptance tick box was paraphrased beyond its label; "Forgot your password?" was said to send a reset email, but in this tree the link only shows a message (see the next section), so the guide now names the link and the contact details only.

## Not proven (do not read this as working)

- **No answer has been produced by any model.** Whether an instruction in the guide is the right way to do a task is judged by plan 07-04's measurement and by the owner's check (Investors, the tax step, Documents, beside the portal).
- **Password reset is not built in this tree**: choosing "Forgot your password?" shows the message "A password reset link would be emailed to the address on file." and does nothing else (assets/js/portal.js:1262). The guide does not promise an email. This is a product gap for the owner to know about, not a guide matter.
- **Written from the code, not from a rendered screen** (the tool did not open these states): a draft envelope (placing fields, "Review and send", "Save as template", "Sign as sponsor"); the new capital call form (the sample fund is fully called, so its button is not shown); the redemption and add-to-investment forms under "Liquidity"; the investor's own signing page (`sign`); the subscribe page's other two states; the five invitation error pages; the Import a list and Add manually tabs.
- **A team member's pages were not captured one by one.** The tool proved which four pages send a team member back to Overview (exactly OWNER_ONLY). "Read-only for a team member" comes from the Team page's own role text.
- **The browser gate was not run** (planner's choice 4): no file under assets/, no page and no existing server module changed. Plans 07-02 and 07-03 run it on top of this tree. No screen changed, so there is nothing to prove on the phone in this plan.
- The 4,096-byte minimum for caching is asserted in bytes of RULES plus a guide; whether the service caches the prefix is measured in 07-04.

## The gate (Task 3's verify command, run after the last commit)

```
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# tests 205
# pass 205
# fail 0
```

Base count recorded before any change: 197 (commit f40303f). 197 + 8 = 205.

Other last lines, verbatim:
- Task 1: `# pass 1` / `# fail 0` for "in sync" with one entry; red-1.txt has `# fail 5` and names the routes without an entry (console-offerings among them).
- Task 2: `HELP SCREENS: PASS (parts run: 4)`; 48 screen text files written.
- Each test proven able to fail (a changed guide, then both files put back): `GUIDE MUTATIONS: PASS (cases run: 8)`.

**Lines to add to the gate after merge:** the server suite's expected count becomes `# tests 205` / `# pass 205` / `# fail 0`, and `node server/help/build.mjs --verify` exits 0. `checks/help-screens.js` is the author's tool, not a gate check.

## What was built

| File | What it is |
|------|------------|
| server/help/guide.md | the one source of the guide: 47 sections and a skip list |
| server/help/rules.md | the one source of the rules, with one marker line |
| server/help/build.mjs | the generator; `--verify` writes nothing and exits 1 on a difference |
| server/lib/help-guide.mjs | generated: VERSION, MARKER, RULES, GUIDE, PAGES |
| server/test/help-guide.test.mjs | eight tests |
| .planning/phases/07-help-chatbot/checks/help-screens.js | writes each screen's text for the guide's author |

### Entries

| Audience | Entries | What |
|----------|---------|------|
| sponsor | 21 | 20 console pages (18 of the menu, one offering, one envelope) and the sign-up page |
| investor | 26 | 10 portal pages, sign-in, the offering sign-up link page, the account setup as a whole and its 11 steps, the bank account update and its one step |
| both | 0 | |

The sponsor's guide holds all 47 (sponsors answer their investors' questions); the investor's guide holds the 26.

### Sizes (bytes, measured on the generated module)

| Part | Bytes | Limit in the test |
|------|-------|-------------------|
| GUIDE.sponsor | 32,985 | 48,000 |
| GUIDE.investor | 13,026 | 20,000 |
| RULES | 3,400 | 6,000 |

### Skip list

| Key | Reason |
|-----|--------|
| console-new-client | the managed edition's page for adding a client; the self-serve edition does not have it |
| onboarding/login, onboarding/profile, onboarding/identity, onboarding/accreditation, onboarding/review | a step of the typed activation; a self-serve investor activates through the invitation flow, so this route only updates a bank account (planner's choice 2) |

### Tests (all pass)

| Test | Result | Fails when (proven by a changed guide) |
|------|--------|-----------------------------------------|
| in sync | pass | the guide changed and the module was not regenerated |
| every route | pass | a route's section is removed (36 routes found; fewer than 30 also fails) |
| every step | pass | a step's section is removed |
| no stale entry | pass | a section names a page the portal does not have |
| names on the screens | pass | a quoted name is not in the portal's source, or an anchor is not in the route's file |
| menu labels | pass | a menu label is no longer in its guide |
| white label and sizes | pass | a model name or an email address is in a guide |
| audiences | pass | an investor section speaks of the console |

## Plan-check additions applied (07-CONTEXT.md)

- **07-01:** the "white label and sizes" test applies copies of `VENDORS` and `VENDOR_RE` from phase 06 checks/lib.js to both guides and the rules, next to the read.test.mjs pattern widened with fable and mythos.
- **07-01 budget note:** the plan did not run short; all three tasks were executed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The sample portal has no envelope**
- **Found during:** Task 2. **Fix:** the tool's console part walks one invitation to its end before visiting the pages. **File:** checks/help-screens.js. **Commit:** ffb00f8.

**2. [Rule 2 - Missing check] A guide line that plan 07-02's output guard would refuse**
- **Found during:** Task 1 (07-CONTEXT plan-check addition 07-02 (b) applies the guard to every guide line). **Fix:** the "white label and sizes" test also refuses a guide line longer than 1,000 characters and any long number or tax-number shape. **Commit:** 1459638.

**3. [Rule 2 - Missing check] Stricter than the plan's wording, same intent**
- The email-address check also covers the rules; "audiences" also refuses the word console in the investor guide; "names on the screens" also refuses curly or unpaired double quotes (a name in curly quotes would escape the check). **Commit:** 1459638.

**4. [Rule 1 - Wrong content] The sign-in entry promised a reset email**
- **Found during:** the summary's review. **Fix:** the sentence now names the link and the contact details only. **Commit:** fd1a159 (a fifth commit, after Task 3's).

### Other departures

- build.mjs exports `verify`, `parse` and `parseRules` beside `build` (the plan lists `build`): the "in sync" test needs the verify answer and the other tests need the parsed sources.
- help-screens.js also writes what the first header button of a console page opens (the form or dialog), the menu once per role, and cuts option lists to eight: the guide's steps need the forms' labels.
- The verify commands of Tasks 2 and 3 were run word for word from script files in SCRATCH/exec-07-01/ (the worktree harness refuses long compound commands typed directly).
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (AUTOPILOT: never touch STATE.md or ROADMAP.md from a worktree). HELP-03, HELP-04 and HELP-05 are not marked complete: the measurement and the owner's check come first.

## Commits

| Commit | What |
|--------|------|
| 1459638 | test(07-01): eight guide tests, red before the guide exists |
| 9cbb82c | feat(07-01): the rules, the generator and the first guide entry |
| ffb00f8 | feat(07-01): the screens' own text, and every console page in the guide |
| f7c5730 | feat(07-01): the investor's pages and every flow step; all eight guide tests pass |
| fd1a159 | fix(07-01): the sign-in entry promises no reset email |

## For plan 07-02

- Import `VERSION, RULES, MARKER, GUIDE, PAGES` from `server/lib/help-guide.mjs`. `PAGES[key].where` is the ready phrase for the page note; each guide entry begins with that phrase, capitalized, as its heading.
- Step keys are `invite/<step>` and `onboarding/payment`. The pages with a prefix in the address (`investment-…`, `subscribe-…`, `console-offering-…`, `console-envelope-…`, `sign-…`, `join-…`, `invite-…`) map to the keys `investment`, `subscribe`, `console-offering`, `console-envelope`, `sign`, `join`, `invite`.
- The example answers in the rules contain square brackets and no contact detail, digit run or vendor name.

## Self-Check: PASSED

- Files: server/help/guide.md, server/help/rules.md, server/help/build.mjs, server/lib/help-guide.mjs, server/test/help-guide.test.mjs, .planning/phases/07-help-chatbot/checks/help-screens.js: all present.
- Commits 1459638, 9cbb82c, ffb00f8, f7c5730, fd1a159: all ancestors of HEAD.
- No stub and no new network surface in the files of this plan.
