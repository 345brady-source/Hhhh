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
