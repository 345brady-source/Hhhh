---
phase: 08-verification-package-and-ongoing-compliance
plan: 09
subsystem: sponsor console (Investors), invitations, the investor's invitation flow and portal, integration server (invitations, mail), phase checks
status: complete
tags: [accreditation, re-verification, rule-506c, d-04, c-06, d-30, c-03, server-mode, package, white-label]
requires: [08-05, 08-17, 08-18, 08-19]
provides:
  - "Ask to re-verify" on an active investor's Investors row (self-serve edition, staff who may invite) while an offering raising needs verified accreditation and the verification by a third party is missing, lapsed or lapses within 14 days
  - its dialog (the investor's name, "Send request", a close control); NS.invitations.requestReverify / openReverifyRequest; change-log entries "Accreditation re-verification requested" and "Accreditation re-verified"
  - invitation flag reverify (browser and server): the link holds the accreditation step and the done screen only, with its own line; the portal offers "Verify your accreditation"; NS.inviteFlow.reverifyAsk
  - server: reverify kept only for an investor on file with no offering, tax-form request, portal link or co-investor sign-in; such a link runs accreditation only; the summary, the sponsor's notice, the reminder and the emails worded for it; with the package the reverify tier at PACKAGE_PRICE_REVERIFY_CENTS
  - server/test/invitations-reverify.test.mjs (6 tests); checks/reverify.js (GATE CHECK REVERIFY, 4 parts: local, server, leave, button)
affects: [08-20 (the dialog's package box and the subscribe screen's offer), 13-01 (mail.mjs variant "reverify"), the guide pass (three lines below)]
tech-stack:
  added: []
  patterns:
    - "a request for one step is an invitation to an investor on file whose flow holds that step only (as 06-26's tax-form request)"
key-files:
  created:
    - server/test/invitations-reverify.test.mjs
    - .planning/phases/08-verification-package-and-ongoing-compliance/checks/reverify.js
  modified:
    - assets/js/invitations.js
    - assets/js/onboarding.js
    - assets/js/console.js
    - server/lib/invitations.mjs
    - server/lib/mail.mjs
decisions:
  - "The button shows only while an offering with status Raising needs verified accreditation (integrations.js needsAccreditation: Rule 506(c), or the firm's rule), so a firm with only Rule 506(b) offerings under the default rule never sees it"
  - "A re-verification link needs a new check made after the request was sent: a verification still valid within the 14 days shows its date and \"Choose Start again to renew it\"; Continue asks for the check (leaving stays possible at any point, D-30)"
  - "\"Accreditation re-verified\" is written once, when a verified result made after the request is on the record: at finish (local), at import (server), or later when the console's Investors page next renders (a result that arrives after the investor finished)"
  - "The server keeps only the accreditation use of the firm's connections on a re-verification link (T-08-26), with or without the package"
  - "The dialog and its two actions sit in invitations.js directly after the tax-request action (that action lives there, not in console.js); console.js holds only the button block and the row line"
requirements: [VPK-08, VPK-10]
metrics:
  duration: "about 6 h 25 min, from step 0 (23:12 UTC, 2026-11-26) to the gate's GATE_EXIT=0 (05:37 UTC, 2026-11-27); the gate needed three resumes (see Failures)"
  completed: 2026-11-27
  tasks: 3
  files: 7
actuals:
  tokens: 21390    # chars/4 over the 85,560 characters of added lines in 8eff49a..c85dbba (summary excluded)
  tasks: 3
  commits: 12      # git rev-list --count 8eff49a..HEAD before this summary commit
plan_head_before: 8eff49a61ec66c195cc8fae06e067d0fcec68073
plan_head_after: c85dbba527a057bb51eb47204b4d1553d3582c66
---

# Phase 8 Plan 09: Ask to re-verify (D-04, C-06) Summary

**One button asks an investor on file to verify accreditation again; one link holds only the accreditation step; the
renewed verification lifts the Rule 506(c) block on their subscription. Works with no server and through the integration
server; with the package the server charges its own reverify price and runs accreditation only.** Tested on the sample
portal with stand-ins only (the firm's simulated connection, stand-in providers in the server tests, credit instead of a
card). Nothing here is confirmed with a real provider, and the owner has not checked it: it is not done until he has.

## Failures first

1. **The gate did not pass in one run.** Run 1 was stopped by the 2-hour limit after 21 steps, with two failures:
   - MEASURE: walkA spent its whole 900 seconds waiting for a browser slot (its log is empty; 08-08 and 12-08 gates ran at
     the same time). On the rerun it passed.
   - EMAIL DIALOG (3), part phone: "every paragraph ... seen whole (10 of 11)", missing "This link is personal to you; please
     do ...". The part scrolls with timed touch moves and stops when a move does not scroll; it is unchanged by this plan
     (the email dialog of an ordinary invitation). On the rerun it passed. I record it as a timing failure under load, not
     proven further.
   - Run 2 then failed "owner's folder: index.txt and four signed PDFs": **my own verify script's fault**. The plan's
     verify removes $O/owner before the gate; on a resumed gate FORMS FLOW is kept and does not write that folder again.
     Run 3 kept FORMS FLOW's cases too; run 4 (forms-flow's part cache and step removed, the verify without the owner
     removal) ended GATE_EXIT=0. Every other step passed in runs 1 to 3 and is shown as kept.
2. **Two faults of my own in Task 1, found by my own check and fixed before its commit:** the simulated check answers about
   a second after it starts, so "Accreditation re-verified" was never written when the investor finished while it was
   pending (fixed: written once the result is in, see decisions); and the check's subscription had an agreement waiting for
   a signature, so Approve was refused for that reason (the check's fixture).
3. **A fault in my first server test:** "reverify summary:" first failed with 403 because its "firm's own" provider had the
   package provider's name; fixed in the test before GREEN (the RED quoted below is the rerun).
4. **Part server printed Lib.walk's taxpayer number in its own PASS labels** (W3), so flow2.txt held it three times. Fixed
   in the check (the number is built, never printed); the old output was redacted. The gate's output of the check holds it
   0 times; the scan was shown failing on a planted copy first (1 hit).
5. **Push protection refused one save commit** because a stand-in billing value in the new test looked like a provider test
   key; the value is now "stand-in-not-a-key" and the commit was amended before it was ever pushed.
6. **Not built here (by the plan's split or the orchestrator):** the package box in the dialog with its states (08-20), the
   subscribe screen's offer (08-20), phone size and the owner's preview (08-20), the three guide lines (the guide pass).
   The portal's offer is asserted on screen by part leave but has no screenshot in the owner's set.

## RED lines (as produced)

### Task 1, part local, against the base tree (red.txt)

```
PASS local the investor's verification by a third party lapsed yesterday and their Rule 506(c) subscription is pending
PASS local before: Approve is refused with the existing "expired" sentence ("Your accreditation verification expired on ...")
FAIL local the investor's row offers "Ask to re-verify" :: (no button)
REVERIFY: FAIL (parts run: 1) - local
```

### Task 1 verify (verify-1.sh, exit 0)

```
REVERIFY: PASS (parts run: 1)
STATUS MATH: PASS (cases run: 13)
```
Two failures of my own on the way to GREEN, both fixed: the simulated check answers about a second after it starts, so at
Finish the result was still pending and "Accreditation re-verified" was never written (fixed: the entry is written once the
result is in, by `refresh` on the console's Investors page, as well as at finish and at import); and the check's pending
subscription had an agreement waiting for a signature, so Approve was refused for that reason (fixed in the check's fixture:
the subscription is recorded as signed).

### Task 2 RED, against Task 1's code (959392b; server files as at the base)

Server tests (red2.txt):
```
not ok 1 - reverify flag: kept only for an investor on file with no offering, no tax-form request and no portal link; the link carries it
not ok 2 - reverify email: the invitation, the resend and the reminder ask to verify accredited investor status again, for that step only; no vendor word
not ok 3 - reverify summary: the sponsor’s finished summary has a re-verification row with the accreditation result and no onboarding rows
not ok 4 - reverify tier: with the package a sponsor account is charged the server’s reverify price from credit; the link runs accreditation only and is refused identity
not ok 5 - reverify plain: without the package nothing is charged and the firm’s own accreditation connection is used
ok 6 - reverify snapshot: the stored snapshot of a request carries no address, taxpayer number, bank detail or tax pre-fill
# tests 6
# pass 1
# fail 5
```
Test 6 passed before the code: the base already keeps no address, taxpayer number, bank detail or pre-fill on such an
invitation. It stays as a guard; its last assertion proves the scan fails on a planted copy. My first RED run of test 3 failed
for a reason of the test's own (403 "This check is not part of this invitation": its "firm's own" provider had the package
provider's name); the test now uses a separate stand-in for the firm's own connection, and the lines above are the rerun.

Part server (red2-part.txt):
```
FAIL server the server stored the request: an investor on file, no offering, marked reverify :: {"cents":0,"cls":"","note":"","senderName":"Kestrel Bay Investor Relations","existing":true,"expiresAt":"2026-12-27T00:58:59.431Z"}
FAIL server the server's email asks the investor to verify their accredited investor status again :: ["Complete your investor onboarding with Kestrel Bay Capital"]
FAIL server the investor's device opens on step 1 of 2; the steps are accreditation and done; the request's own line :: {"count":"Step 1 of 2: Welcome","steps":["welcome","done"]}
REVERIFY: FAIL (parts run: 1) - server
```

### Task 2 verify (verify-2.sh, exit 0)

```
# tests 6 / # pass 6 / # fail 0        (invitations-reverify.test.mjs)
# tests 462 / # pass 462 / # fail 0    (whole server suite)
REVERIFY: PASS (parts run: 2)
COUNTS: base 456 + own 6 = 462
```
Found after this run and fixed before the commit: part server's own PASS labels printed Lib.walk's taxpayer number (the
scan's label named the number it looked for), so flow2.txt held it three times. The number is now built in the check and
never printed; the gate's run of the check is the evidence that no output holds it (scan below, under the gate).

### Task 3 RED, parts leave and button against Task 2's code (52dbb86) (red3.txt)

```
FAIL button shown: the verification lapses within 14 days (in 10)
FAIL button shown: the verification lapses in exactly 14 days
FAIL button not shown: a lapsed verification where every offering is Rule 506(b) and the rule is the default
FAIL button ran to the end :: page.selectOption: Timeout 30000ms exceeded. (the check's own fault: the managed edition's role control has no "admin"; fixed in the check)
REVERIFY: FAIL (parts run: 2) - button
```
The 14-day window and the "an offering raising needs verified accreditation" rule were left out of Task 1 on purpose so
that this part could fail first; they are Task 3's code. Part leave passed on Task 2's code (13 PASS): Back, the portal's
offer and the resume were built in Task 1. It is kept as a guard and proven by a mutation (below).

Mutation for part leave (a copy of 52dbb86 with the portal's offer line removed from onboarding.js; red3-mut.txt):
```
FAIL leave the portal offers the open request: "<firm> asked you to verify your accreditation again." with "Verify your accreditation" :: null
REVERIFY: FAIL (parts run: 1) - leave
```
Task 3 GREEN (parts leave and button on the Task 3 code): `REVERIFY: PASS (parts run: 2)`, 29 PASS.

## Task 3 verify and the phase gate

The verify is the plan's with the orchestrator's wave-7 changes: no guide steps; `git diff $BASE` of server/help/guide.md,
server/lib/help-guide.mjs and .planning/tools/preview/help-data.js is empty; no added line under assets or server holds the
word the owner forbids (I-1); every exact GATE line allows the "( (kept from ...))?" suffix (B1); the file list uses
`--first-parent` and filters this summary (B2, W2). It ran as verify-3.sh, then (runs 3 and 4) as verify-3b.sh, which is
the same without removing $O/owner and $O/base-tree before a resumed gate. `npm --prefix server test` alone before the
gate: `# tests 462`, `# pass 462`, `# fail 0`. Run 4 exited 0; its GATE lines verbatim:

```
GATE ok   server tests # fail 0 (kept from 2026-11-27 01:32:39 UTC)
GATE ok   server tests 462 (found 462) (kept from 2026-11-27 01:32:39 UTC)
GATE ok   STATUS MATH (13) (kept from 2026-11-27 01:32:40 UTC)
GATE ok   FORM MAPS (3) (kept from 2026-11-27 01:33:09 UTC)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26) (kept from 2026-11-27 01:46:57 UTC)
GATE ok   SERVER MODE (15) (kept from 2026-11-27 01:52:31 UTC)
GATE ok   TWO PERSONS (kept from 2026-11-27 01:52:48 UTC)
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3) (kept from 2026-11-27 03:55:59 UTC)
GATE ok   AGREEMENT NAME (kept from 2026-11-27 02:40:48 UTC)
GATE ok   TAX REQUEST LEAVE (5) (kept from 2026-11-27 03:11:52 UTC)
GATE ok   WAYS OUT (7) (kept from 2026-11-27 03:17:31 UTC)
GATE ok   NO NETWORK (3) (kept from 2026-11-27 03:18:54 UTC)
GATE ok   EMBED DATA (3) (kept from 2026-11-27 03:18:55 UTC)
GATE ok   SAFARI FINISH (6) (kept from 2026-11-27 03:19:38 UTC)
GATE ok   BANK STEP TYPING (2) (kept from 2026-11-27 03:19:56 UTC)
GATE ok   HELP CHAT (10) (kept from 2026-11-27 03:21:32 UTC)
GATE ok   REAL FIRM (9) (kept from 2026-11-27 03:27:55 UTC)
GATE ok   SIGNING DOCUMENTS (8) (kept from 2026-11-27 03:31:09 UTC)
GATE ok   PHONE LAYOUT (8) (kept from 2026-11-27 04:06:00 UTC)
GATE ok   RECORD AND LOST AGREEMENT (7) (kept from 2026-11-27 04:25:52 UTC)
GATE ok   SCREEN EDGES (5) (kept from 2026-11-27 04:27:45 UTC)
GATE ok   WALK3 FIXES (9) (kept from 2026-11-27 04:28:13 UTC)
GATE ok   TITLES AND EDITOR (4) (kept from 2026-11-27 04:29:10 UTC)
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-27 04:31:34 UTC)
GATE ok   CO-INVESTOR SERVER (5) (kept from 2026-11-27 04:38:06 UTC)
GATE ok   HELP PREVIEW (6) (kept from 2026-11-27 04:38:23 UTC)
GATE ok   phase-8 gate checks found (7)
GATE ok   AML RECORD (7) (kept from 2026-11-27 04:38:54 UTC)
GATE ok   PACKAGE CONSOLE (7) (kept from 2026-11-27 04:44:38 UTC)
GATE ok   PACKAGE FLOW (10) (kept from 2026-11-27 04:48:42 UTC)
GATE ok   PACKAGE INVITE (12) (kept from 2026-11-27 04:50:37 UTC)
GATE ok   PACKAGE NAMES (4) (kept from 2026-11-27 04:51:19 UTC)
GATE ok   PACKAGE PANEL (7) (kept from 2026-11-27 04:51:47 UTC)
GATE ok   REVERIFY (4) (kept from 2026-11-27 04:52:33 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing-base (kept from 2026-11-27 04:53:39 UTC)
GATE ok   signing-plan (kept from 2026-11-27 04:54:37 UTC)
GATE ok   record-base (kept from 2026-11-27 04:54:59 UTC)
GATE ok   record-plan (kept from 2026-11-27 04:57:23 UTC)
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
COUNTS server tests 462; AML RECORD 7; PACKAGE CONSOLE 7; PACKAGE FLOW 10; PACKAGE INVITE 12; PACKAGE NAMES 4; PACKAGE PANEL 7; REVERIFY 4
GATE_EXIT=0
COUNTS: base 456 + own 6 = 462
VERIFY3_EXIT=0
```

GATE_EXIT=0, with P8_SERVER_TESTS=462 (gate.sh reads P8_SERVER_TESTS; it is the measured count the orchestrator calls
GATE_SERVER_TESTS). Phase-8 gate checks found: 7 = base 6 + REVERIFY.

Taxpayer-number scan (W3), after the gate: a planted copy of the check's gate output with the number appended: 1 hit;
the gate's REVERIFY output (p8-reverify.txt), tracer.txt, red.txt, red2-part.txt, red3.txt, red3-mut.txt: 0 each;
flow2.txt held it 3 times before the fix (redacted since). forms.txt (phase 6's check, not this plan's) holds a longer
foreign tax ID, "12345678901", that contains the run.

Merge note: the main branch (origin/claude/refract-reskin at 00c32a7) has moved past the base with 11-13, 12-06, 14-01,
16-01 and 16-03; 08-08 has not merged. `git merge-tree --write-tree` of this branch with it reports no conflict. The gate
above ran on this branch alone, as asked; whoever merges re-measures from the merged tip (W2).

## The mail.mjs lines added (for 13-01: the variant is "reverify")

Nothing else in mail.mjs changed: compose, logoPart, supportLine, footerText and STEPS_SENTENCE are untouched.

1. invitationMessage, one added line after the taxRequest line:
   `if (invitation.existing && invitation.reverify) return reverifyMessage({ firm, name, investor, invitation, link, expiresAt });`
2. One new function, built only with `compose`, `supportLine` and `longDate`, as taxRequestMessage:
   `function reverifyMessage({ firm, name, investor, invitation, link, expiresAt, again })`; subject
   `${again ? 'Reminder: ' : ''}${firm.name}: verify your accredited investor status`; first paragraph
   "<firm> asks you to verify your accredited investor status again." (resend: "Here is a new link to verify your accredited
   investor status for <firm>. Any earlier link we sent no longer works."); second paragraph "The link below opens the
   accreditation step only: you verify your status online. Nothing else is asked."; the sponsor's note; one button
   "Verify your accreditation" (the same label as invitations.js emailFor's reverify button); the expiry and support lines.
3. resendMessage, one added line after the taxRequest line:
   `if (invitation.existing && invitation.reverify && !(offering && offering.name)) return reverifyMessage({ firm, name, investor, invitation, link, expiresAt, again: true });`
4. reminderMessage: the signature line gains `reverify` (the one changed line) and one block `if (existing && reverify)`
   after the taxRequest block, subject `Waiting in your console: ${who}’s re-verification`. The purge call in
   server/lib/invitations.mjs passes `reverify: !!(snap.invitation && snap.invitation.reverify)`.
5. notificationMessage: one block `if (summary && summary.reverify)` after the taxRequest block; subject
   `${who} verified their accreditation again` when the server confirmed a verified result (summary.reverified), otherwise
   `${who} finished your re-verification request`.

Subjects stated as literals, each on its own line, in server/test/invitations-reverify.test.mjs:
`'Harbor Ridge Capital: verify your accredited investor status'`,
`'Reminder: Harbor Ridge Capital: verify your accredited investor status'`,
`'Waiting in your console: Dana Whitfield’s re-verification'`,
`'Dana Whitfield verified their accreditation again'`.
Not covered by a test: the notice's second subject, "<who> finished your re-verification request" (no confirmed verified
result). 13-01's golden test of every variant should take it.

## Guide lines for the guide pass

Not added: guide.md, help-guide.mjs and help-data.js are unchanged (orchestrator's decision on wave 7, the guide budget).
One added line per section; every quoted name is literal screen text (console.js "Ask to re-verify", invitations.js
"Send request", onboarding.js "Verify your accreditation"); no vendor, no price. Bytes include the newline; 211 in total
(cap 240, each at most 80):

| Section | Line | Bytes |
|---------|------|-------|
| `## console-investors` | `"Ask to re-verify", then "Send request", asks the investor to verify again.` | 76 |
| `## invite/accreditation` | `A re-verification link holds this step and the done screen only.` | 65 |
| `## investments` | `"Verify your accreditation" opens the firm's re-verification request.` | 70 |

Then `node server/help/build.mjs`, `node .planning/tools/preview/make-help-data.mjs` (B3), the help-guide test and HELP
PREVIEW.

## The console.js lines added

One added block directly after `taxAskButton` (a comment, `reverifyDue` and `reverifyButton`: 12 lines) and one changed
line, the Investors row's actions line, which now reads `${taxAskButton(i)}${reverifyButton(i)}<button ... View portal</button>`.
Nothing else in console.js changed (11-13's and 12-06's hunks are elsewhere; the merge-tree above is clean).

## Deviations from Plan

1. **[Placement] The dialog and its actions are in invitations.js, not console.js.** The plan puts them "directly after the
   tax-request action" in console.js, but that action is in invitations.js (`NS.actions['tax-request']`). They sit directly
   after it there; console.js keeps only the button block and the row line, so its shared hunks stay small.
2. **[Rule 2] The audit entry "Accreditation re-verified" is also written later.** A real check can take days; the entry is
   written once, whenever a verified result made after the request lands (finish, import, or the next render of the
   Investors page through `refresh`). Without this the tracer could not pass and a real letter would never be logged.
3. **[Rule 2, T-08-26] The server keeps only the accreditation use of the firm's connections on a re-verification link**
   (one added line in create), with or without the package; test "reverify plain:" proves the firm's own identity
   connection is refused with 403 and no provider call. The plan named this only for the package.
4. **[Rule 2] A re-verification needs a new check.** Continue on the step asks for a check made after the request was sent;
   a verification still valid shows its date and "Choose Start again to renew it." Leaving is never blocked (D-30).
5. **[Rule 3] onboarding.js got one changed line in Task 2** (the investor's device keeps `reverify` from the server's
   snapshot); without it the server-mode link opened as an invitation to subscribe. Files of the plan only.
6. **[TDD split] The 14-day window and the "offering raising needs verified accreditation" rule went into Task 3**, so part
   button could fail first (it did: three FAIL lines). Task 1's button showed for missing or lapsed verifications only.
7. **[Orchestrator] No guide lines** (above); the guide files are unchanged and the verify asserts it.
8. **[Check] The plan's verify removes $O/owner before the gate**; for a resumed gate that breaks the owner's-folder step
   (Failures 1). verify-3b.sh is the same verify without that removal.
9. Within-row wording beyond the plan's list, each an added branch: the email dialog's title "Re-verification request
   email", the row's "Re-verification only", the header note "Accreditation", the toast "Re-verification finished", the
   notices "finished your re-verification request" / "opened your re-verification request".

## Owner's check (not done: the owner has not checked anything here)

On the iPhone, in the published preview: Console, Investors, an investor whose verification has lapsed (and a Rule 506(c)
offering raising), "Ask to re-verify", "Send request"; then open the link. Expected: the dialog closes with its X; the link
shows only the accreditation step and the done screen ("Step 1 of 2"); Back returns to the portal, which offers
"Verify your accreditation". No error text. The sample portal has no investor in that state by default: one must be set
up (a verification older than 90 days). Phone size is plan 08-20's; it was not checked here.

The owner's screens (a separate run after the gate, P6_SHOTS = the folder below, `REVERIFY: PASS (parts run: 2)`), with
an index.txt: /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-08-09/owner-shots
(the button, the dialog, the email, the two-step link and the done screen in local mode; the investor's device and the
"Re-verification only" row in server mode). The portal's offer has no screenshot. In the button screenshot several rows
offer "Ask to re-verify": with a Rule 506(c) offering raising, every active sample investor without a current verification
by a third party matches the rule (most sample investors are on file from before verification, so theirs reads as lapsed).
That is the rule as planned; if it is too many buttons, the owner may narrow it (for example to investors who hold or were
invited to the Rule 506(c) offering). A toast left by the "before" Approve covers the bottom of two local screenshots.

## Known Stubs

None. The reverify price is a server setting (PACKAGE_PRICE_REVERIFY_CENTS, default the full package's 9900, planner's
choice), not a confirmed provider price. Every provider in the tests is a stand-in.

## Threat Flags

None beyond the plan's register: T-08-26 (mitigated: the flag's rule, accreditation-only links, two steps, tests
"reverify flag:", "reverify tier:" and "reverify plain:"), T-08-27 (mitigated: test "reverify snapshot:").

## Open items

- 08-20: the package box in the dialog with its states (G6), the subscribe screen's offer, phone size, the owner's preview.
- The guide pass: the three lines above.
- 13-01: the notification's second subject has no test yet.
- The EMAIL DIALOG phone part failed once under load (10 of 11 paragraphs seen); watch it in the merged-tree gate.

## Self-Check: PASSED

- FOUND: the seven files (reverify.js, invitations-reverify.test.mjs, invitations.js, onboarding.js, console.js,
  server/lib/invitations.mjs, server/lib/mail.mjs); invitations-reverify.test.mjs has 6 top-level tests; reverify.js holds
  "// GATE CHECK: REVERIFY" in its first five lines.
- FOUND: task commits 959392b, 52dbb86, c85dbba are ancestors of HEAD; base 8eff49a is an ancestor.
- The guide files (guide.md, help-guide.mjs, help-data.js) have no diff from the base.
- STATE.md, ROADMAP.md and REQUIREMENTS.md are not touched here (outside this plan's files; the orchestrator updates them
  at merge).
