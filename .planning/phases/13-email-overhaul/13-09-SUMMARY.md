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
