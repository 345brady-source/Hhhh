---
phase: 13-email-overhaul
plan: 05
subsystem: console emails (self-serve)
tags: [emails, invitations, co-investor, sent-log, white-label]
status: complete
completed: 2026-11-27
requirements: [EM-01, EM-02, EM-04, EM-08, EM-13, EM-14]
plan_head_before: 56c300d1e17e3643c76459efe6badbfc23978e11
plan_head_after: aa5104b2de893de8800048e8bce9cef103bdd862
actuals:
  tokens: 23500    # chars/4 over the diff 56c300d..aa5104b (94,119 characters)
  tasks: 3
  commits: 8       # git rev-list --count 56c300d..aa5104b; this summary's own commit follows
decisions:
  - "A manual resend keeps the link (30 more days) and shows the same invitation; only a server resend shows 'New link:'"
  - "The postal-address stop applies once the firm record carries a postalAddress field (13-09 adds the setting)"
  - "No 'simulated' co-investor toast or log entry in the self-serve console: its sign-in email is sent by the sponsor (manual)"
  - "snapshot() now tells the server a portal link is one (access), so the server's email is the portal link's"
requires: [13-01]
provides: [invitation and co-investor emails on NS.emails, sent-log entries, row lines, note and postal checks, lib13.js, EMAILS PARITY, INVITE MAIL]
affects: [assets/js/invitations.js, assets/js/coinvestor.js, diy.html, portal.html]
key-files:
  created:
    - .planning/phases/13-email-overhaul/checks/lib13.js
    - .planning/phases/13-email-overhaul/checks/emails-parity.js
    - .planning/phases/13-email-overhaul/checks/invite-mail.js
  modified:
    - assets/js/invitations.js
    - assets/js/coinvestor.js
    - diy.html
    - portal.html
---

# Phase 13 Plan 05: Console invitations and co-investor emails on the renderer Summary

The console's invitation, tax-form, re-verification and co-investor emails are now emails.js renders of the data the console sends the server, so the dialog that says "The email your integration server sends." shows the server's outbox message byte for byte; every email leaves one sent-log entry with the link taken out; rows say plainly when an email came back, waits, or was not sent; a note with a taxpayer number is stopped in the form.

Nothing here is ready for launch until the owner has checked it (13-10). Live sending stays "To be confirmed".

## Failures and things not done as the plan words them (read first)

1. **The co-investor toast does not say "(simulated in this demo)" without a server, and no "simulated" sent-log entry is written.** The plan's part coinvestor-honest asks for both. In the self-serve console the co-investor's sign-in email is not simulated: it opens for the sponsor's email app (Open in your email app, Mark as sent), and PRESS AND CO-INVESTOR (a reference gate step) requires that nothing there says "emailed" or "simulated". A simulated entry would claim the demo sent something the sponsor is asked to send. Built instead: the toast claims no send, Mark as sent leaves one sent-log entry with status manual. The only "(simulated in this demo)" toast is the managed edition's (index.html, unchanged, C-05; it does not load emails.js). lib13.js keeps honest() for later plans.
2. **The postal-address rule (C-06) applies only to a workspace whose firm record has a postalAddress field.** Today no setting lets a sponsor enter the address (the field comes with 13-09's Portal and brand line), so the sentence "Add your firm's postal address under Settings, then Portal and brand, ..." would point to a setting that does not exist and every invitation to an offering without a commitment would be blocked; three reference checks (SERVER MODE, CO-INVESTOR SERVER, PRESS AND CO-INVESTOR) invite exactly that way. With the field present and empty the form stops the invitation with the sentence (proven by commercial-address and nonet); once 13-09 adds `postalAddress: ''` to TENANT_TEMPLATE the rule is live for new portals. Open item for 13-09.
3. **13-11's `needs: ['postalAddress']` is not read yet** (13-11 has not merged); the form computes the same rule from the invitation data, as the plan allows.
4. **Before 13-03 merges, the server drops firm.postalAddress** (cleanFirm), so with an address set the console's footer would show it and the server's would not. No sponsor can set it before 13-09; 13-03 keeps it.

No gate failure: GATE_EXIT=0 on the first gate run.

## Gate (Task 3)

`GATE13_PHASES="08" GATE_OUT=SCRATCH/exec-13-05 bash .planning/phases/13-email-overhaul/checks/gate13.sh`, base-commit.txt = 56c300d1e17e3643c76459efe6badbfc23978e11, HEAD aa5104b, run fresh (no kept step; the gate folder was new). Pre-check: `git diff --stat 56c300d HEAD -- index.html assets/js/onboarding.js assets/js/console.js server` is empty. The gate's last lines, verbatim:
```
GATE ok   PRESS AND CO-INVESTOR (10)
GATE ok   CO-INVESTOR SERVER (5)
GATE ok   HELP PREVIEW (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 544
# pass 544
# fail 0
GATE ok   server tests 544 = base 544 + 0 declared
GATE ok   AML RECORD (7)
GATE ok   MONITORING (9)
GATE ok   PACKAGE CONSOLE (7)
GATE ok   PACKAGE FLOW (10)
GATE ok   PACKAGE INVITE (12)
GATE ok   PACKAGE NAMES (4)
GATE ok   PACKAGE PANEL (7)
GATE ok   REVERIFY (9)
GATE ok   SMALL FIXES (2)
GATE ok   EMAILS PARITY
GATE ok   INVITE MAIL
GATE_EXIT=0
```
Earlier in the same run: SERVER MODE (15), EMAIL DIALOG (3), TWO PERSONS, MEASURE, REAL FIRM (9), PHONE LAYOUT (8), NO NETWORK (3) and the other reference steps all "GATE ok"; 45 "GATE ok" lines, 0 "GATE FAIL". In the gate: `EMAILS PARITY: PASS (parts run: 3)`, `INVITE MAIL: PASS (parts run: 9)`. Task 3 verify: VERIFY3_EXIT=0.

Server tests: 544 at the base commit (measured by the gate on the base tree), 544 on this tree, 0 added (no server file changed).

## Phone and desktop results

- 390x844 with touch, sandboxed frame with every connection refused: manual-phone (dialog, one button, draft = renderer's text, sent-log entry manual with "[personal link]"), note-screen, rows (four lines, no horizontal overflow, badges "Waiting to send" and "Not sent"), nonet (manual, note and postal steps in one frame): each with "the policy refused nothing", "no script error", "no request outside the page's origin".
- 1280x800: resend-same, commercial-address, coinvestor-honest (no server half), managed-same (index.html dialog text equal to the base tree's), server-dialog, server-resend, coinvestor-honest (server half), invite-kinds and coinvestor.
- The owner's iPhone check is pending (13-10).

## What was built

- assets/js/invitations.js: emailFor and mailtoFor render `NS.emails.render(kind, mailData)`; mailData is the data snapshot() posts (firmOf now with postalAddress, investorData, invitationData). kind is 'invitation_resent' only after a server resend (mailKind, mailStarted). The dialog's email card (emailCard) prints the message text block by block, the button block as the button and its link, then the footer, so what the sponsor reads is the message. logMail writes one sent-log entry per email (manual on Mark as sent, else the server's status; unsubscribed is kept as suppressed, the log's nearest status). Row lines for bounced, held, suppressed and unsubscribed; badges and activity never say "Sent" for an email that did not leave; toasts after a send never say "emailed" for those statuses. The note is screened with emails.screen before anything is made (EM-04). validate stops a possibly commercial invitation while the postal address is empty (C-06, see failure 2).
- assets/js/coinvestor.js: the sign-in email is `NS.invitations.coEmail` (render of coMailData, the data coSignIn posts); the dialog uses the same card; Mark as sent leaves a manual sent-log entry. coSignIn (server) logs the server's status.
- diy.html, portal.html: `<script src="assets/js/emails.js"></script>` after data.js. index.html untouched.
- checks: lib13.js (gate: none), emails-parity.js (3 parts), invite-mail.js (9 parts).

## Deviations from Plan

1. [Rule 1 - Bug] snapshot() never told the server that a portal link (Add manually, send link) was one, so the server wrote "set up your investor account" while the old dialog said "your investor portal". invitationData now carries access: true (the server's cleanInvitation already keeps it). Commit f5e41f1.
2. [Rule 1 - Bug] The badge of a held, suppressed or unsubscribed invitation said "Sent"; toasts after such a send said "Invitation emailed to ...". Fixed (f4cbc07, 7155e4a), with the rows assertion added RED first.
3. [Judgment] A manual resend keeps the link and extends it 30 days (it used to make a new token). This makes the plan's "a manual resend that keeps the same link shows the same message" literal: the investor's earlier link keeps working and the email is the same invitation.
4. [Judgment] coinvestor-honest and the postal rule, as described in failures 1 and 2.
5. invite-kinds and server-dialog passed in red-2.txt: they were already green after Task 1, as expected.
6. A sent-log entry is not written when the server refuses the request outright (an error response with no email written); the server's own email statuses, failed included, are logged.

## Guide lines (for GUIDE-PASS.md; no guide byte changed)

- Invitations: "The email shown under Invitation is the email your investor receives, word for word; with an integration server connected it is the server's own message."
- Invitations: "Resend without an integration server keeps the same link for 30 more days. With a server, Resend sends a new link and the earlier one stops working."
- Invitations: "An invitation's row says when its email came back, is waiting for your sending domain, or was not sent because the address bounced before or the investor turned off invitations to new offerings."
- Invitations: "A personal note cannot hold a taxpayer number, a long account number or a password."

## Open items

- 13-09: the Portal and brand postal address field turns on the C-06 stop for new portals; sample tenants and the reference checks that invite to an offering without a commitment then need an address (or a commitment).
- 13-03: cleanFirm keeps postalAddress (until then the server's footer lacks an address the console would print).
- 13-11: once render returns needs, the form can read it instead of its own rule.
- Owner's check at 13-10; live sending stays "To be confirmed".

## Known Stubs

None.

## Threat Flags

None: no route, storage key or trust boundary added; the sent log is the 13-01 ws.mailLog with the link taken out (T-13-16), and the screens state only the server's own statuses (T-13-17).

## RED evidence (as produced)

Task 1, red-1.txt (EMAILS PARITY --only server-dialog on the unchanged code; the subject already matched, the text did not):
```
FAIL server-dialog the dialog text equals the outbox message text, byte for byte :: {"dialog":"Dear Anita,\n\nKestrel Bay Capital has invited you to set up your ...
FAIL server-dialog the text names the commitment of $250,000 :: Dear Anita,
EMAILS PARITY: FAIL (parts run: 1) - server-dialog
```
Task 1 GREEN, tracer.txt: `EMAILS PARITY: PASS (parts run: 1)`; verify: script line once in diy.html and portal.html, 0 in index.html; VERIFY_EXIT=0. EMAIL DIALOG (P6/email-dialog.js) on the new card: `EMAIL DIALOG: PASS (parts run: 3)`.

Task 2, red-2.txt (after Task 1, before Task 2's code; 29 FAIL lines):
```
EMAILS PARITY: FAIL (parts run: 3) - coinvestor
INVITE MAIL: FAIL (parts run: 9) - manual-phone, resend-same, server-resend, note-screen, commercial-address, rows, coinvestor-honest, nonet
FAIL coinvestor its text equals the render, byte for byte
FAIL manual-phone phone: Mark as sent leaves one sent-log entry, status manual, kind invitation
FAIL resend-same the resend keeps the link
FAIL server-resend the dialog subject starts "New link: " and equals the newest outbox message
FAIL server-resend the sent log has the server's status for both messages, link taken out
FAIL note-screen phone: the note is stopped with "Remove the taxpayer number: emails never carry tax numbers." under it
FAIL commercial-address desktop: an investor on file invited to a new offering with no postal address: the postal-address sentence
FAIL rows bounced: the row says "The email to row.bounced.0@investor.example came back. Check the address with the investor, then choose Resend."
FAIL coinvestor-honest Mark as sent leaves one sent-log entry: manual, to the co-investor, the link taken out
FAIL nonet nonet: the note is stopped with "Remove the taxpayer number: emails never carry tax numbers." under it
```
(managed-same passed in RED as it must: index.html is not touched.)

First GREEN run: commercial-address and nonet failed because the check left the earlier attempt's commitment in the form (a check fault, fixed in 0fbcc04); rerun `INVITE MAIL: PASS (parts run: 2)`.

Task 2 verify: `EMAILS PARITY: PASS (parts run: 3)`, `INVITE MAIL: PASS (parts run: 9)`, VERIFY2_EXIT=0.

Added after the verify (seen on the phone screenshot): the badge of a held, suppressed or unsubscribed invitation said "Sent". RED (red-3-rows.txt):
```
FAIL rows held: nothing on the row says the email was sent (badge "Sent", activity "Created Nov 27, 11:28 AM")
FAIL rows suppressed: nothing on the row says the email was sent (badge "Sent", ...)
FAIL rows unsubscribed: nothing on the row says the email was sent (badge "Sent", ...)
```
GREEN: badges "Waiting to send", "Not sent", "Not sent"; `INVITE MAIL: PASS (parts run: 1)`.

Pre-gate runs on this tree: PRESS AND CO-INVESTOR PASS (10), CO-INVESTOR SERVER PASS (5), REVERIFY PASS (9), PACKAGE INVITE PASS (12), PACKAGE CONSOLE PASS (7).

## Commits (wip/13-05)

- 485758e test(13-05): EMAILS PARITY server-dialog part (RED)
- f5e41f1 feat(13-05): the invitation email through NS.emails.render with the server's data (EM-01)
- 485ce77 test(13-05): INVITE MAIL (9 parts) and EMAILS PARITY invite-kinds and coinvestor parts (RED)
- 7155e4a feat(13-05): resends, sent log, row lines, note and postal checks, co-investor on the renderer
- 0fbcc04 test(13-05): invite-mail sets the commitment and note fields on every attempt
- 4642e60 test(13-05): rows part: a held, suppressed or unsubscribed row says nothing was sent (RED)
- f4cbc07 fix(13-05): a held, suppressed or unsubscribed invitation's badge says Waiting to send or Not sent
- aa5104b docs(13-05): summary draft with RED and verify evidence
- this summary's commit

Seen, not changed (outside this plan's words): the code comment on line 3 of assets/js/invitations.js has had the forbidden word since before 56c300d; it is not on any screen.

## Self-Check: PASSED

lib13.js, emails-parity.js and invite-mail.js exist; the 8 commits above are on HEAD (git log 56c300d..HEAD counts 8); GATE_EXIT=0; server/node_modules link removed; screenshots, page captures and the base tree deleted.
