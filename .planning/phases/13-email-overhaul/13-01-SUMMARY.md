---
phase: 13-email-overhaul
plan: 01
status: in-progress
---

# Phase 13 Plan 01: the one template set (draft, written as the work goes)

Start commit (base): e87b658070a52ee78055d9fcce0fe9d3ef1d6e72. Base server tests: 478.

## Evidence as produced

### gate13.sh base-change rule (re-check B1)
`GATE_OUT=<scratch> bash .planning/phases/13-email-overhaul/checks/gate13.sh --self-test` last line after the edit:
```
GATE13 SELF-TEST: PASS (8)
```

### Task 1 RED (SCRATCH/exec-13-01/red-1.txt)
```
not ok 1 - tracer: the invitation the server keeps in its outbox is emails.js’s render of the same snapshot
    Cannot find module '../../assets/js/emails.js'
# tests 1
# pass 0
# fail 1
```

### Task 1 verify (t1.txt)
```
# tests 1
# pass 1
# fail 0
```
VERIFY1=0 (base-count.txt 478 >= 478; red-1.txt has a failing line; first line "// gate: tests 8").

### Task 2 RED (SCRATCH/exec-13-01/red-2.txt)
```
ok 1 - tracer: the invitation the server keeps in its outbox is emails.js’s render of the same snapshot
not ok 2 - every variant has a golden, and the server’s builders return exactly what emails.js renders
not ok 3 - sponsor text unchanged: every sponsor variant’s subject and text are the base tree’s builder output
not ok 4 - wording: subjects, the greeting by given name, New link:, one expiry and one support sentence
not ok 5 - one button, its link also printed (investor messages); at most one, to the console, for the sponsor
not ok 6 - structure: lang, title, color-scheme, presentation tables, a 44 px button cell, the logo’s alt, inline styles, under 100 KB
ok 7 - contrast: the button text is white or ink, whichever reads at 4.5:1 or more on the firm’s colour
ok 8 - logos and footer: a PNG logo inline as cid:logo@firm, an SVG or WebP logo as the firm’s name, the postal address in the footer
# tests 8
# pass 3
# fail 5
```
Tests 7 and 8 passed at RED: what they cover (contrastText, the logo part, the footer with the postal address) is the
layout core the plan puts in Task 1's GREEN step, written before them. Both fail on the base tree (no emails.js).

base-sponsor.json: built by SCRATCH/exec-13-01/make-base-sponsor.mjs from SCRATCH/exec-13-01/base/lib/mail.mjs and
crypto.mjs, written by `git show e87b658:server/lib/mail.mjs` and `git show e87b658:server/lib/crypto.mjs` (re-check B2);
13 sponsor_notification and 5 submission_reminder variants, each with the input it was given.

### Task 2 verify (t2.txt, SCRATCH/exec-13-01/verify2.sh = the plan's verify)
```
# tests 486
# suites 0
# pass 486
# fail 0
```
VERIFY2=0: 478 + 8; invitations.mjs, filings.mjs, index.mjs, onboarding.js unchanged from the base; 37 text goldens; none
says "Dear investor" or starts a line "Reminder: ".

### Assertion changes (old -> new), the only edits to existing test files and checks
- mail.test.mjs: `'Harbor Ridge Fund II: complete your investor onboarding'` -> `'Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund II'`
- mail.test.mjs: `'Dear Ann Lee,'` -> `'Dear Ann,'`; `'Investor Relations: ir@harborridge.example, +1 212 555 0100'` -> `'Questions? Contact Investor Relations at ir@harborridge.example or +1 212 555 0100.'`
- mail.test.mjs: `'Reminder: complete your investor onboarding with Harbor Ridge Capital'` -> `'New link: Harbor Ridge Capital: set up your investor account'`
- mail.test.mjs: banned loop `[/carrow/i, /vale\b/i, /powered by/i, /DIY Portal/i]` -> the same `.concat(BANNED)` (BANNED read from assets/js/emails.js; two import lines added for it)
- invitations.test.mjs: `'Harbor Ridge Fund II: complete your investor onboarding'` -> `'Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund II'`
- invitations.test.mjs: `/^Reminder: Harbor Ridge Fund II/` -> `/^New link: Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund II/`
- invitations-existing.test.mjs: `'Harbor Ridge Fund III: your subscription'` -> `'Harbor Ridge Capital: your subscription to Harbor Ridge Fund III'`
- invitations-existing.test.mjs: `'Reminder: Harbor Ridge Fund III: your subscription'` -> `'New link: Harbor Ridge Capital: your subscription to Harbor Ridge Fund III'`
- invitations-existing.test.mjs: `'Harbor Ridge Fund III: complete your investor onboarding'` -> `'Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund III'`
- invitations-existing.test.mjs: `'Reminder: Harbor Ridge Capital: your investor portal'` -> `'New link: Harbor Ridge Capital: your investor portal'`
- invitations-existing.test.mjs: `/Complete your investor onboarding/` -> `/: set up your investor account$/`
- invitations-includetax.test.mjs: `'Harbor Ridge Fund III: your subscription'` -> `'Harbor Ridge Capital: your subscription to Harbor Ridge Fund III'`
- invitations-taxrequest.test.mjs: `'Reminder: Harbor Ridge Capital: your Form W-9'` -> `'New link: Harbor Ridge Capital: your Form W-9'`
- invitations-cosign.test.mjs: ``new RegExp(`^Dear ${CO.name},`)`` -> `/^Dear Rowan,/`
- invitations-cosign.test.mjs: `/Questions\? Reply to this email or contact Investor Relations: ir@lanternpoint\.example, \+1 208 555 0142\./` -> `/Questions\? Contact Investor Relations at ir@lanternpoint\.example or \+1 208 555 0142\./`
- invitations-cosign.test.mjs: `` `Reminder: Lantern Point Partners: sign the subscription agreement for ${ACCOUNT}` `` -> `` `New link: Lantern Point Partners: ...` ``
- invitations-reverify.test.mjs: `'Reminder: Harbor Ridge Capital: verify your accredited investor status'` -> `'New link: Harbor Ridge Capital: verify your accredited investor status'`
- .planning/phases/06-*/checks/co-investor-server.js:535: ``text.indexOf(`Dear ${F.coName}`)`` -> ``text.indexOf(`Dear ${F.coFirst},`)`` (wave-1 B1, re-check W5)

Every existing test file keeps its number of tests.

### Task 3 RED (SCRATCH/exec-13-01/red-3.txt)
```
ok 1 - patterns: screen() refuses taxpayer numbers, long numbers and passwords with one sentence each; the first three are the help desk’s
ok 2 - no sensitive data in any render: no pattern in what is sent, no field for one in the data, the note screened
ok 3 - banned words: no platform, vendor or library name, and never the plain-tier word, in any variant or in the headers
not ok 4 - links: only the investor’s own link and the firm’s support address; redactLink and log() keep no link
  error: 'ir@harborridge.example&cc=x'
# tests 4
# pass 3
# fail 1
```
The failure was real: a support address ending '&cc=x' was turned into a mailto link (it could add recipients). Fixed in
a2fe5fe (emails.js now uses the server's address rule). Tests 1 to 3 passed at RED: PATTERNS, screen(), BANNED and the
sample data were written in Task 1 and Task 2 to these rules; they fail on the base tree (no emails.js).
After the fix: emails-guard 4/4, emails-render 8/8.
