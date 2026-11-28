---
phase: 13-email-overhaul
plan: 09
subsystem: self-serve console emails
status: complete
tags: [emails, console, white-label, postal-address, sent-log, help-guide]
requires: [13-03, 13-05, 13-08, 13-11, 16-02, small-fixes-c]
provides:
  - "NS.views['console-emails'] (Settings, then Emails); NS.emailsUI { sample, firmOf, rows, logSection, merge, SAYS }"
  - "Postal address on Portal and brand (self-serve only); TENANT_TEMPLATE.postalAddress ''"
  - "The investor's sent emails on their Account record, merged with GET /v1/messages/log"
affects: [13-06, 13-10, own-fonts, 15-14 (merged-tree EMAILS PAGE rerun), 15-17, phase 18 restyle]
tech-stack:
  added: []
  patterns:
    - "previews are emails.js render(kind, sample, { preview: true }) bodies drawn in the page, links made inert"
    - "workspace + server sent-log merge: same kind, same investor, within 10 minutes = one message; the server's status wins"
key-files:
  created:
    - assets/js/emails-ui.js
    - .planning/phases/13-email-overhaul/checks/emails-page.js
  modified:
    - assets/js/console.js (2 lines)
    - assets/js/tenants.js, mobile/src/core/tenants.js
    - assets/js/coinvestor.js (1 line)
    - assets/js/invitations.js (1 line, B1a)
    - assets/js/roles.js (1 row)
    - diy.html, portal.html (1 line each)
    - server/help/guide.md, server/lib/help-guide.mjs, .planning/tools/preview/help-data.js
    - 10 phase 6 and 8 checks (one setup line each, B1b) and P11 audit-flow.js (menu rule)
decisions:
  - "Previews use the workspace's firm and first offering; the sample firm's names, team, phone and email in the sample text become the firm's, so no other firm's name ever shows"
  - "One message is listed once: a workspace entry the server handled (any status but simulated or manual) and a server entry of the same kind for the same investor within 10 minutes are one; the server's status and time are shown"
  - "The postal stop never applies in the managed edition (one line in invitations.js, B1a)"
  - "AUDIT FLOW's menu rule excuses an added menu line for a page whose module index.html does not load (needs the orchestrator's acceptance)"
  - "console-emails role row: Owner/Admin act, Staff act, Read-only read, Accountant hidden"
metrics:
  completed: 2026-11-28
  tasks: 3
actuals:
  tokens: 60000
  tasks: 3
  commits: 16
plan_head_before: 3f8e3d1a51f340bfaf0d9d3570241b27a58f0865
plan_head_after: "the commit that adds this summary (code and gates judged at 59a6fef's tree minus this file)"
---

# Phase 13 Plan 09: Emails page, postal address, sent emails on the record

The self-serve console has an Emails page (Settings, then Emails) that previews all 18 rows (every investor, sponsor and team
message of emails.js) at phone width, at desktop width and as text, in the firm's brand. The page comes from emails.js's own
render, and no other firm's name appears. The firm's postal address is a field on Portal and brand and is printed in every
email footer. Each investor's Account record lists their emails, newest first, joined with the integration server's log.
The managed edition is unchanged. Nothing here is ready for launch until the owner has checked it on his iPhone (13-10).

## Failures first

1. Gate13 run 1 failed: `GATE FAIL HELP CHAT (10)`, `FAIL managed each of the three pages loads help.js once, right after
   coinvestor.js`. My script line sat between coinvestor.js and help.js. Fixed in f29a9c2: emails-ui.js now loads right after
   help.js. I stopped that run at its first failure, because every later step had to run again on the fixed tree anyway.
2. Gate16 run 1 failed twice:
   - `GATE FAIL ROLES TABLE`: "console-emails has no row and is not in DEFAULT_PAGES". This was my change. Fixed in 756488d
     (one row in assets/js/roles.js).
   - `GATE FAIL SERVER MODE (15)`, part include-tax: "the snapshot carries the flag, the offering and the form's pre-fill, and
     no taxpayer ID, bank or other record detail". The only change I made to that check is the B1b setup line. I reran the part
     alone twice on the same tree: `SERVER MODE: PASS (parts run: 1)` both times. It also passed in batch 2, in gate13 runs 2
     and 3 and in gate16 run 2. This is an intermittent failure whose cause I have not found. The printed line does not say
     which condition failed (`!!snap.offering`, no '7318' in the snapshot, or no routing/"account"/tinLast4). It stays open.
3. Turning the postal stop on (B1) broke 10 existing checks, each waiting for an invitation the stop refused. Each is fixed
   with one setup line that gives the firm an address. No assertion was weakened. The full list is under B1b below.
4. The plan's own AUDIT FLOW `managed` part failed on the plan's menu line (its NAV diff rule). I narrowed the rule. See
   Deviations; this needs the orchestrator's acceptance.

## Gate lines (final tree)

Gate13, every phase (GATE13_PHASES unset), run 3: 103 "GATE ok", 0 FAIL.
```
GATE ok   SERVER MODE (15)
GATE ok   WAYS OUT (7)
GATE ok   HELP CHAT (10)
GATE ok   HELP PREVIEW (6)
GATE ok   server tests 607 = base 607 + 0 declared
GATE ok   AUDIT FLOW
GATE ok   EMAILS PAGE
GATE ok   INVITE MAIL
GATE ok   PORTAL MAIL
GATE ok   TAX NOTICE
GATE_EXIT=0
```
Gate16, GATE16_PHASES="15" (W2), run 2: 84 "GATE ok", 0 FAIL.
```
GATE ok   SERVER MODE (15)
GATE ok   server tests 607 = base 607 + 0 declared
GATE ok   ROLES TABLE
GATE ok   SECTIONS
GATE ok   SERVED PORTAL
GATE ok   TOTP FRAME
GATE ok   MOBILE SYNC
GATE_EXIT=0
```
Task 3 verify: `## console-emails` present; `build.mjs --verify` in sync; MOBILE SYNC PASS (3); diff guard (index.html,
onboarding.js, server/lib except help-guide.mjs, server/index.mjs) unchanged since 3f8e3d1. invitations.js left the guard, as
B1 allows. Server tests 607 = 607 + 0.

## Guide size (W3)

GUIDE.sponsor: 44,766 bytes before, 45,802 after (+1,036, limit 48,000). No lines went to GUIDE-PASS.md.

## Phone results

- list-phone and record-log ran at 390x844 with touch, in Chromium with playwright's iPhone profile. `NOTE WebKit not run`.
  The preview stays inside the screen with no sideways scroll, the email button is at least 44 px tall, and a way out is on
  screen at the top, middle and end of the page. The Account dialog fits, scrolls to its last entry, and Close is on screen at
  its top and its end.
- The owner's iPhone look at the Emails page and at the Account record is pending (13-10).

## Checks given an address or a commitment (B1b)

Every line added is the same: `await <page>.evaluate((a) => { window.CVPortal.state.ws.tenant.postalAddress = a;
window.CVPortal.app.save(true); }, '1 Harbor Way, Boston, MA 02110');` (emails.js SAMPLE_ADDRESS). It goes right after the
named setup line. None of these checks needed a commitment instead.
- P6 forms-flow.js: after `setupPortal` in investorType (line 516) and in includeTaxCase (line 3377).
- P6 ways-out.js: after `setupPortal` in shortPart (line 394).
- P6 server-mode.js: after the three `setupPortal` calls (lines 355, 1013, 1559).
- P6 co-investor-server.js: after `setupPortal` (line 118).
- P6 record-and-lost-agreement.js: first line of inviteOnFile (line 215).
- P8 monitoring.js boot (225), package-flow.js boot (122), package-names.js boot (113), package-console.js consoleOn (87),
  package-invite.js consoleOn (107).
- The checks B1 named that passed with no change: P6 real-firm, titles-and-editor; P10 taxdocs-flow, taxrecord-flow; P11
  audit-flow (postal-wise) and package-flow; P13 invite-mail (it already sets its own address).
- B1a: managed-same in index.html creates an invitation to an offering with no commitment and gets no postal stop.
- B1c: the postal part shows that a self-serve workspace with an empty address gets the "Add your firm's postal address under
  Settings, then Portal and brand, ..." sentence, and that the same invitation goes once the address is saved.

## Wording for the owner to read

- Page heading and line: "Emails". "Every email your portal sends, in your brand. Open a preview to see it as your investors
  and your team receive it."
- Sections: "Before you send", "To investors", "To your team", "Sent". Buttons: "Phone", "Desktop", "Text". Filter:
  "Investor", "All investors". Empty list: "No emails yet."
- "Your firm's postal address is needed before invitations to a new offering: add it under Settings, then Portal and brand.
  (To be confirmed with counsel)"
- "Your logo appears as your firm's name in emails."
- On password reset and team invitation: "Sent once sign-in accounts are connected."
- Portal and brand: "Postal address", hint "Printed in your emails' footer."
- Account record: heading "Emails". Statuses: "Simulated in this demo", "Sent from your email app", "Kept on your
  integration server", "Waiting for your domain", "Sent", "Not sent", "Not sent: turned off by the investor", "Delivered",
  "Came back", "Marked as spam".
- Server lines: "Sent emails could not be loaded from your integration server." "Your role cannot see sent emails from your
  integration server."
- Help guide entry `console-emails` and the added "Postal address" in the console-brand entry (server/help/guide.md).

## Deviations

- [Rule 2, white label] The plan swapped only the firm into the sample. The sample text also names "Harbor Ridge Fund II",
  "Investor Relations at +1 212 555 0100" and "Harbor Ridge Capital". Those would show another firm's name in the sponsor's
  previews, so emails-ui.js also swaps the sample firm's names, team, phone and email for the firm's, and the sample
  offering's name for the workspace's first offering. The preview is still emails.js's render of that data: list-phone
  checks the text word for word against render, and every-kind finds no "Harbor Ridge" in any preview.
- [Rule 3] AUDIT FLOW's managed part fails on any added or removed NAV/NAV_SECTIONS line since the base. The plan requires a
  menu line. I narrowed its menuChanges rule: an added line is excused only when it adds ['console-<key>', ...], names its
  module "(<file>.js)", that file registers NS.views['console-<key>'] = {, and index.html does not load the file. Removed
  lines, lines for files index.html loads, and keys the file does not register are still reported (`--menu-selftest`: RED
  for 1 + 3 lines, GREEN on this tree). The managed menu is also checked by behaviour: managed-same and AUDIT FLOW's "no
  Accounting entry". Earlier narrowings of this rule were orchestrator decisions (11-16, 16-02); this one needs the same.
- [Rule 3] emails-ui.js registers `NS.views['console-emails']` by name, not through a constant, because the help guide test
  finds routes by that literal.
- [Rule 3] The owner's preview data (.planning/tools/preview/help-data.js) was regenerated: HELP PREVIEW requires it to match
  the guide.
- [Rule 3] assets/js/roles.js gains one row for the new page (ROLES TABLE). It is not in 15-14's list; 15-14 may touch the same
  table, so the merge needs a look.
- Script line: right after help.js (still after coinvestor.js), not directly after coinvestor.js.
- Task 1 and Task 2 code landed in save commits (ab19e41, 06f3d4f). The empty "feat" commits 177515a and 88425a4 name them.
- Rows are one per kind and show its first variant (password reset twice: its investor and team versions). The other
  variants of a kind (for example the nine invitation variants) are not listed one by one.

## Open items

- SERVER MODE include-tax intermittent (above): needs a debugger run to name the condition that failed.
- After 15-14 merges: rerun EMAILS PAGE on the merged tree (15-14 may add kinds to emails.js, and may make password reset and
  team invitation real sends, which would make "Sent once sign-in accounts are connected." untrue).
- 13-04's open item stays open: the invitation dialog says "reply to this email." while the server sends a link (13-06 B6).
- /tmp holds about 84 p13-base-*, p6-server-* and p13-server-* folders, some left when I stopped gate13 run 1. Others may
  belong to running agents, so I left them.
- The owner's checks at 13-10: the Emails page and the Account record on his iPhone, and the wording above.

## Evidence as produced

### Task 1 RED (red-1.txt)
```
PASS list-phone the frame refuses fetch() (connect-src none is in force)
FAIL list-phone the menu has "Emails" under Settings, right after "Portal and brand" :: [["#console-integrations","Integrations"],["#console-ach","ACH origination"],["#console-brand","Portal and brand ...
FAIL list-phone ran to the end :: frame.waitForSelector: Timeout 20000ms exceeded.
EMAILS PAGE: FAIL (parts run: 1) - list-phone
```

### Task 1 verify (tracer.txt)
```
EMAILS PAGE: PASS (parts run: 1)
VERIFY_OK (script line once in diy.html and portal.html, 0 in index.html)
```

### Task 2 RED (red-2.txt, before any Task 2 code)
```
FAIL postal the sample's firm record has the postal address field, empty (the template's) :: {"has":false}
FAIL postal the page's line about invitations to a new offering names the postal address and ends "(To be confirmed with counsel)" :: []
FAIL postal an invitation to an offering with no commitment and no postal address: the postal sentence, nothing made :: {"said":"","made":{"investorId":"KBC-1027","invitations":1}}
FAIL postal Portal and brand has "Postal address" in "Support and disclosures" with the hint "Printed in your emails' footer." :: null
FAIL logo SVG logo: the page says "Your logo appears as your firm's name in emails." :: []
FAIL logo WebP logo: the page says "Your logo appears as your firm's name in emails." :: []
FAIL record-log ran to the end :: frame.waitForSelector: Timeout 15000ms exceeded.
FAIL record-server ran to the end :: TypeError: sc.call is not a function   (the check's own helper; fixed to sc.srv.call before the RED commit)
EMAILS PAGE: FAIL (parts run: 7) - postal, logo, record-log, record-server
```
every-kind and desktop passed in RED (Task 1's page already drew every kind); managed-same passed in RED (no template
field yet; it guards the state after the field).

### Task 2 verify (page.txt)
```
EMAILS PAGE: PASS (parts run: 8)
console.js changed lines vs base: 2
MOBILE SYNC: PASS (cases run: 3)
```

### B1b: checks that broke once the postal stop was on (batch run on the plan tree, before any check change)
```
FORMS FLOW: FAIL (cases run: 34) - investor-type, include-tax
RECORD AND LOST AGREEMENT: FAIL (parts run: 7) - request-desktop, request-phone, unsigned-twice-desktop, signed-kept-desktop, import-desktop
WAYS OUT: FAIL (parts run: 7) - short-desktop, short-phone
CO-INVESTOR SERVER: FAIL (parts run: 5) - cosign-desktop, cosign-phone, cosign-later, cosign-change-remove, cosign-forged
SERVER MODE: FAIL (parts run: 15) - full, b506, regA, existing, withdraw, signed, repack, clean, tax-w9, tax-unsigned, tax-wipe, tax-upload, tax-w8ben, include-tax
MONITORING: FAIL (parts run: 9) - alert
PACKAGE FLOW (08): FAIL (parts run: 10) - identity, refused, start-limit, phone, leak, full, letter-phone
PACKAGE NAMES: FAIL (parts run: 4) - owners, individual
PACKAGE CONSOLE: FAIL (parts run: 7) - tier-mismatch, credit-owed, phone
PACKAGE INVITE: FAIL (parts run: 12) - single, notoffered, account, phone, list
AUDIT FLOW: FAIL (parts run: 4) - managed   (menu rule, not the postal stop; see Deviations)
```
Passed in the same batch with no change: REAL FIRM 9, TITLES AND EDITOR 4, PRESS AND CO-INVESTOR 10, REVERIFY 9,
SMALL FIXES 2, TAXDOCS FLOW 14, TAXRECORD FLOW 5, PACKAGE FLOW (11) 6, INVITE MAIL 9, EMAIL SENDING 7, PORTAL MAIL 9.

After the setup lines (commit 77a3f25) and the AUDIT FLOW rule (f9fc06a), batch 2 on the plan tree: FORMS FLOW 34, RECORD AND
LOST AGREEMENT 7, WAYS OUT 7, CO-INVESTOR SERVER 5, SERVER MODE 15, MONITORING 9, PACKAGE FLOW 10, PACKAGE NAMES 4, PACKAGE
CONSOLE 7, PACKAGE INVITE 12, AUDIT FLOW 4, EMAILS PAGE 8, STATUS FLOW 26, EMAIL DIALOG 3, TAX REQUEST LEAVE 5, SAFARI FINISH 6,
WALK3 FIXES 9, PHONE LAYOUT 8, SCREEN EDGES 5, SIGNING DOCUMENTS 8 all PASS; HELP PREVIEW FAIL (preview-sponsor, files:
"help-data.js: STALE"), PASS after make-help-data.mjs (commit after 6e0787c).

### Gate13 run 1 (every phase, HEAD 6e0787c..help-data commit): stopped by me after its first failure
```
GATE FAIL HELP CHAT (10)
FAIL managed each of the three pages loads help.js once, right after coinvestor.js
```
Server tests in that run: 607 of 607 (# tests 607, # pass 607, # fail 0). Steps before HELP CHAT passed. Fixed in f29a9c2
(emails-ui.js now loads right after help.js); HELP CHAT 10, HELP PREVIEW 6, EMAILS PAGE 8 PASS on f29a9c2. The run was stopped
there rather than left two more hours, because every later step would have to run again on the fixed tree anyway.

### Gate13 run 2 (every phase, HEAD 6655644): GATE_EXIT=0, 103 "GATE ok", 0 FAIL
```
GATE ok   server tests 607 = base 607 + 0 declared
GATE ok   WAYS OUT (7)
GATE ok   HELP PREVIEW (6)
GATE ok   EMAILS PAGE
GATE_EXIT=0
```

### Gate16 run 1 (GATE16_PHASES="15", HEAD 6655644): GATE_EXIT=1
```
GATE FAIL SERVER MODE (15)
GATE FAIL ROLES TABLE
```
- ROLES TABLE (my change): "FAIL pages every menu page has a row or is listed as taking the default :: console-emails has no
  row and is not in DEFAULT_PAGES". Fixed in 756488d (one row in assets/js/roles.js); ROLES TABLE: PASS (cases run: 3); server
  tests 607/607.
- SERVER MODE include-tax (a check I touched only with the B1b setup line): "FAIL include-tax include-tax: the snapshot carries
  the flag, the offering and the form's pre-fill, and no taxpayer ID, bank or other record detail" (the printed invitation and
  investor satisfy the visible conditions, so one of !!snap.offering, sj without '7318', or sj without routing/"account"/
  tinLast4 failed; the line does not say which). Rerun alone twice on the same tree: "SERVER MODE: PASS (parts run: 1)" both
  times; it also passed in batch 2 and in gate13 run 2. Intermittent; the postal address the setup adds
  ('1 Harbor Way, Boston, MA 02110') holds none of those strings. Not fixed here; reported as open.

## Self-Check: PASSED

- FOUND assets/js/emails-ui.js, .planning/phases/13-email-overhaul/checks/emails-page.js
- Commits c16e23b, ab19e41, 177515a, 1f6d902, 06f3d4f, 88425a4, 77a3f25, f9fc06a, 6e0787c, 59f59ba, f29a9c2, 756488d are on this branch (15 commits since 3f8e3d1 before this summary)
- Final gates: gate13 GATE_EXIT=0 (103 ok), gate16 GATE_EXIT=0 (84 ok); server tests 607/607
