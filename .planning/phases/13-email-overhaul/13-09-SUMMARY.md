---
phase: 13-email-overhaul
plan: 09
status: in-progress
---

# Phase 13 Plan 09: Emails page, postal address, sent emails on the record (draft, filled as the work goes)

Start commit: 3f8e3d1a51f340bfaf0d9d3570241b27a58f0865

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
