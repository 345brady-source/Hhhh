---
phase: 13-email-overhaul
plan: 01
subsystem: email
tags: [email, templates, white-label, server, umd]
requires: [08-09]
provides: [assets/js/emails.js, one template set for browser and server, email goldens, guard tests]
affects: [13-03, 13-04, 13-05, 13-07, 13-09, 13-10, 13-11]
tech-stack:
  added: []
  patterns: [UMD module shared by browser and server via createRequire, golden files written only with EMAILS_WRITE_GOLDEN=1]
key-files:
  created: [assets/js/emails.js, server/test/emails-render.test.mjs, server/test/emails-guard.test.mjs, server/test/fixtures/emails/ (37 .txt, 37 .html, base-sponsor.json)]
  modified: [server/lib/mail.mjs, server/test/mail.test.mjs, server/test/invitations.test.mjs, server/test/invitations-existing.test.mjs, server/test/invitations-includetax.test.mjs, server/test/invitations-taxrequest.test.mjs, server/test/invitations-cosign.test.mjs, server/test/invitations-reverify.test.mjs, .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/co-investor-server.js, .planning/phases/13-email-overhaul/checks/gate13.sh]
decisions:
  - "The model maker's two names are not in emails.js BANNED (the reference gate's leak step forbids them on any line of assets/js); the server tests ban them beside BANNED"
  - "A re-sent link the investor already started keeps 'Continue your onboarding' / 'Continue your subscription' as its button (mail.test.mjs asserts it; the plan's table says 'the same button')"
  - "screen() reads a bare nine-digit run as a long number ('emails never carry account or tax numbers'), a dashed or spaced one as a taxpayer number"
  - "Support addresses are printed and linked only when they pass the server's address rule without '&' and '?' in the local part"
metrics:
  completed: 2026-11-27
status: complete
actuals:
  tokens: 85000
  tasks: 3
  commits: 13
plan_head_before: e87b658070a52ee78055d9fcce0fe9d3ef1d6e72
plan_head_after: b5212159171a8f0cd1c688354718c41eb7bd79c1
---

# Phase 13 Plan 01: the one template set Summary

assets/js/emails.js now writes every message the server's four builders send (invitation, new link, sponsor notice,
console reminder, including 08-09's re-verification); server/lib/mail.mjs only hands it the data, so the console's
previews (from 13-05 on) and the server say the same words. Not yet checked by the owner: the wording waits for his read
at 13-10.

## Failures first

1. First gate run: `GATE FAIL MEASURE`. The leak step found a vendor name at assets/js/emails.js:107: the BANNED list
   the plan specifies holds the model maker's two names, and no line of assets/js may spell them. Fixed (RED 0019bce,
   fix b521215): the two entries moved to the server tests (guard MODEL_NAMES, mail.test.mjs's banned loop); every
   render is still checked against them; a new guard assertion fails if emails.js ever spells them.
2. That first run was then stopped at the 2-hour background limit (before the other phases' checks). The rerun into the
   same folder ran every step and passed (below).
3. Task 3 RED found a real hole: a support address ending '&cc=x' became a mailto link (it could add recipients). Fixed
   in a2fe5fe.
4. Not this plan's: server/test/auth-gate.test.mjs "operator" failed once in one full run (`/pw|.../` matched a random
   id); 6 reruns of the file passed, the gate's runs passed. Flaky, out of scope, not touched.

## Gate (GATE_OUT=SCRATCH/exec-13-01, base-commit.txt e87b658, GATE13_PHASES="08 09 10")
Last lines of SCRATCH/exec-13-01/gate.txt:
```
GATE ok   CO-INVESTOR SERVER (5)
GATE ok   HELP PREVIEW (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 490
# pass 490
# fail 0
GATE ok   server tests 490 = base 478 + 12 declared
GATE ok   AML RECORD (7)
GATE ok   PACKAGE CONSOLE (7)
GATE ok   PACKAGE FLOW (10)
GATE ok   PACKAGE INVITE (12)
GATE ok   PACKAGE NAMES (4)
GATE ok   PACKAGE PANEL (7)
GATE ok   REVERIFY (4)
GATE ok   ACCESS FLOW
GATE ok   BLUESKY FLOW
GATE ok   BLUESKY MATH
GATE ok   FILINGS FLOW
GATE ok   FILINGS MATH
GATE ok   FILINGS SERVER
GATE ok   FORMD FLOW
GATE ok   FORMD XML
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
GATE ok   phase 13 checks: none in this tree
GATE_EXIT=0
```
Earlier lines include `GATE ok   SERVER MODE (15)`, `GATE ok   MEASURE`, `GATE ok   EMAIL DIALOG (3)` (phone part
included; no failure), `GATE ok   CO-INVESTOR SERVER (5)`. ACH LEAK (re-check W6): `ACH LEAK: PASS (cases run: 1)`.
VERIFY3=0 (SCRATCH/exec-13-01/verify3.sh: the plan's chain with W1, W2, W6). GATE_EXIT=0.
Server tests: 478 (base) -> 486 (Task 2) -> 490 (Task 3), +12 exact.
The gate removed its base tree, shots, page captures and the node_modules link; SCRATCH/exec-13-01/base (the base
mail.mjs copy) is deleted.

## Messages covered (KINDS, 37 variants, one .txt and one .html golden each)
- invitation: new-offering, new-account, subscribe, subscribe-tax, access, taxRequest-w9, taxRequest-w8ben, coSign, reverify
- invitation_resent: the same nine plus started
- sponsor_notification: onboarding, onboarding-account, subscription, subscription-tax, none, access, coSign-signed,
  coSign-unsigned, taxRequest-signed, taxRequest-notsigned, taxRequest-none, reverify-reverified, reverify-finished
- submission_reminder: onboarding, subscription, taxRequest, reverify, coSign
Out of this plan (W7): taxdocs.mjs noticeMessage/consentMessage (13-07); filing_order and package_alert (staff only).
The goldens are new files (no earlier golden to diff); the full list is the 74 files above plus base-sponsor.json.

Investor golden (invitation-new-offering.txt):
```
Subject: Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund II
Preheader: Harbor Ridge Capital has invited you to invest in Harbor Ridge Fund II and to open your investor account.

Dear Anita,

Harbor Ridge Capital has invited you to invest in Harbor Ridge Fund II and to open your investor account.

A note from Harbor Ridge Capital:
> We are glad to have you with us for Fund II.

Offering: Harbor Ridge Fund II
Commitment: $250,000

The link below takes you through everything in one place, in about 10 to 15 minutes: your login, investor information, identity verification, accreditation, tax certification, where to send distributions, and your subscription documents, which you sign online. Your progress is saved, so you can stop and come back.

Have a government-issued photo ID and your bank account details ready.

Start your onboarding:
https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#invite-sample

This link is personal to you; please do not forward it. It expires on December 10, 2026.

Questions? Contact Investor Relations at ir@harborridge.example or +1 212 555 0100.

--
Harbor Ridge Capital Management LLC

This message is not an offer to sell securities.
```
Sponsor golden (submission_reminder-reverify.txt; text byte-identical to the base builder, test 3):
```
Subject: Waiting in your console: Shah, Anita’s re-verification
Preheader: Shah, Anita finished your request to verify their accreditation again on November 10, 2026, but the console has not added the result to your records yet.

Shah, Anita finished your request to verify their accreditation again on November 10, 2026, but the console has not added the result to your records yet.

Investor: Shah, Anita
Email: anita@investor.example
Finished: November 10, 2026
Deleted on: December 10, 2026

Open the console:
https://portal.example/portal.html#console-investors

Open the console before December 10, 2026: it adds the result as soon as it opens.

After that date the result is deleted from the integration server to protect it, and the investor would have to verify again.

--
Harbor Ridge Capital Management LLC

This message is not an offer to sell securities.
```
For the owner's read at 13-10: sponsor messages name the investor as the console holds the name ('Shah, Anita' when
typed that way), word for word as today; only investor messages greet by given name.

## Deviations from Plan
1. [Rule 3 - Blocking] BANNED without the model maker's two names (gate leak rule; see Failures 1). Interface change:
   later plans that check renders against BANNED add those two from the test side, as emails-guard does.
2. [Interpretation] A resend the investor already started keeps "Continue your onboarding" / "Continue your
   subscription" (mail.test.mjs:229 asserts it and is not on the list of assertions to change).
3. [Interpretation] The investor layout gained a `before` part (after the rows and note, before the button), so "The
   link below ..." always stands above the button and the note sits under the invitation sentence. Sponsor messages
   have none, so their text is unchanged.
4. [Interpretation] The no-offering steps sentence ends "tax certification, and where to send distributions" (the
   browser's emailFor lacks the "and").
5. [Test design] Guard test 2's key rule reads key names word by word: the plan's literal /tin|.../ matches "existing",
   a server field every investor-on-file invitation carries.
6. [Rule 2] Support addresses are printed/linked only when plain (Failures 3).
7. Task 2's code landed in three save commits (b8a6e5e, aeaa5a6, eb3d9d7) under the save rules, not in one feat commit.
8. base-sponsor.json records each sample input next to the base output; test 3 also checks KINDS samples equal those
   inputs, so the base comparison cannot drift.
9. mail.mjs: an `import` and the `emails` constant sit just under the "The firm's messages" line (the part this plan
   owns); its header comment above that line still says "three messages" (13-03 owns it).

## Guide lines (for .planning/GUIDE-PASS.md)
None: no screen changed in this plan.

## Known Stubs
None. `log()`, `SIMULATED`, `screen()` and `opts.preview` have no caller yet; plans 13-03, 13-05 and 13-09 wire them.

## Threat Flags
None beyond the plan's register (T-13-01 escaping kept and tested; T-13-02 guard test 2; T-13-03 guard test 4).

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

### Leak-rule RED after the first gate (SCRATCH/exec-13-01/red-3b.txt)
```
not ok 3 - banned words: no platform, vendor or library name, and never the plain-tier word, in any variant or in the headers
  error: |-
    assets/js/emails.js lines 107
# tests 4
# pass 3
# fail 1
```
After b521215: emails-guard, emails-render and mail.test.mjs 26/26; then the gate rerun above (GATE_EXIT=0).

## Commits (wip/13-01)
- 56a6d7c chore(13-01): gate13 reruns every step when the base commit changes
- 78d7625 test(13-01): RED tracer
- 3ce0cfb feat(13-01): emails.js, the one template set; new-investor invitation through it
- b8a6e5e wip(13-01): save (summary draft)
- 07e8b0f test(13-01): RED tests 2-8 and base-sponsor.json
- aeaa5a6 wip(13-01): save (every variant ported, mail.mjs builders delegate, goldens)
- eb3d9d7 wip(13-01): save (the listed assertion changes, co-investor-server.js)
- ab2e1f9 wip(13-01): save (summary)
- c491d8f test(13-01): RED guard
- a2fe5fe fix(13-01): support address only when plain
- 2ce3b41 wip(13-01): save (summary)
- 0019bce test(13-01): RED guard: no model maker's name in emails.js
- b521215 fix(13-01): BANNED without the two names; the tests ban them

## Self-Check: PASSED
Files: assets/js/emails.js, server/test/emails-render.test.mjs, server/test/emails-guard.test.mjs,
server/test/fixtures/emails/base-sponsor.json present. Commits 56a6d7c..b521215 on this branch (13, measured from
plan_head_before). gate13.sh --self-test: GATE13 SELF-TEST: PASS (8).
