# Quick task small-fixes-a: queued small fixes from phases 8, 11, 14

Written by the orchestrator from the executor's hand-back (the executor's Write of this file was refused).

**Start:** f3bcf91. **End:** 27c19a8 (wip/small-fixes-a). **Merged:** becfd21.
**Server tests:** 484 on the start tree, 488 at the end (+4). On the merged tree (base 502): 506 of 506.
**Gate:** phase 8 gate.sh, run 2 resumed into run 1's folder, GATE_EXIT=0.
COUNTS server tests 488; AML RECORD 7; MONITORING 9; PACKAGE CONSOLE 7; PACKAGE FLOW 10; PACKAGE INVITE 12; PACKAGE NAMES 4; PACKAGE PANEL 7; REVERIFY 4; SMALL FIXES 2. Signing base 75/0, plan 75/0; record base 40/0, plan 40/0.

Every RED ran on the untouched start tree with only the new check files copied in; every GREEN on an archive of the commit being proven.

1. **Package start failure shows the contact line** (integrations.js iv-start). RED: PACKAGE FLOW refused/phone failed (raw "Failed to fetch" on screen). GREEN: PACKAGE FLOW --only refused,phone,start-limit PASS (3).
2. **"Created <time>" for an invitation never sent** (invitations.js, neverSent rule). RED: "Sent Nov 27, 6:07 AM" shown. GREEN: PACKAGE CONSOLE --only package-used,phone PASS (2).
3. **confirmChecks copies the check's letters as {type,label}; the browser's evidence is dropped** (server/lib/invitations.mjs; server/test/invitations-evidence.test.mjs, 2 tests). RED both failed; GREEN 8/8.
4. **Access-Control-Expose-Headers: Content-Disposition** (server/lib/http.mjs; server/test/http-expose.test.mjs, 2 tests). RED both failed; browser RED saved the fallback name. GREEN 11/11; PACKAGE FLOW full PASS on rerun (first run hit the onnx leak-scan flake below).
5. **Capital call notice days: only a whole number of 1 or more** (console.js ik-apply, callDays falls back to 10). RED: -5 stored. GREEN: SMALL FIXES notice-days PASS; -5, 0, 2.5 refused, 15 applied. Not proven RED: the due-date sub-check.
6. **KYC Re-screen follows the package rule** (integrations.js rescreenOne, rescreenable; console.js). RED: package investor re-screened through ofac and ownscreen. GREEN: MONITORING --only kyc-buttons,package-not-run PASS (2).
7. **Documents "Remove" hides** (console.js, esign.js). hidden/hiddenAt/hiddenBy; record and file kept; row reads "Hidden from investors <date>"; log "Document hidden". RED: document deleted. GREEN: SMALL FIXES PASS (2).

## Guide lines (for GUIDE-PASS.md)
- Documents: "Remove" hides a document from investors' portals; it stays in the list marked "Hidden from investors", with its file.
- Offering structure: "Capital call notice (days)" takes a whole number of days, 1 or more.

## Open items
- Leak-scan flake: phase 6 lib.js VENDOR_RE matches inside words, so a random invite token containing "onnx" fails the email leak scan (seen once).
- Other deletions remain (out of scope; 14-CONTEXT says nothing is deleted): esign.js unsigned/discarded envelope files; onboarding.js voided unsigned tax forms.
- The AML/KYC menu badge still counts a package investor that cannot be re-screened (Treasury off) as due.
- Fix 4 tested against a stand-in file name only (real provider name unconfirmed, 08-12).
- FORMS FLOW reference check output prints the invented foreign tax ID 12345678901.
- Owner checks: iPhone package start failure shows the contact line; Documents Remove leaves a "Hidden from investors" row; -5 notice days refused; AML/KYC Re-screen on a package investor.
