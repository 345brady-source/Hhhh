---
phase: 13-email-overhaul
plan: 05
subsystem: console emails (self-serve)
tags: [emails, invitations, co-investor, sent-log, white-label]
status: in-progress
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

<!-- gate section filled after the run -->

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
