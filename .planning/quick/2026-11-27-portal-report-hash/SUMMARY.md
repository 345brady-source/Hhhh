# Quick task 2026-11-27: portal-report-hash (investor Documents viewer checks a report file's SHA-256)

Written by the orchestrator from the executor's hand-back (the Write was refused). Start d73fffe; end d19f002 (wip/portal-report-hash). Merged onto 0125500: server tests 555/555.

## Failures first
1. The fix landed in save commit d19f002 ("wip(portal-report-hash): save"), not a fix(...) commit (save rule).
2. Not changed: a report document with nothing kept still shows the existing "This browser did not keep this document's file. Ask ..." sentence; it is not remade.

## Change (assets/js/portal.js only)
- fileOf(doc), used by openUploaded and up-download, looks up the document's own record in W().docs.
- No report block: unchanged. With a report block: SHA-256 of the kept bytes compared with doc.sha256; equal: as before; not equal: the mismatched bytes are never shown; with NS.reportsRun.fileBytes on the page the file is remade and given only when its SHA-256 equals the record, otherwise fileBytes' own sentence; without it, "The original file is not kept on this device." (the first clause of reports-run.js's CHANGED sentence). Kept bytes never overwritten.
- A failed store read on Download toasts "This browser blocked document storage, so the file cannot be opened here." (was an unhandled rejection).

## Evidence
- RED on start code: REPORT FIXES FAIL, investor-old-id-desktop and -phone, 8 FAIL each (the viewer got Pellbrook's file be91f9b8... instead of the record 53e6e006...; Download gave Pellbrook's bytes).
- GREEN: REPORT FIXES PASS (2 new parts, 50 PASS); through heavy.sh REPORT FIXES 5, DELIVER FLOW 8, SIGNING DOCUMENTS 8, TITLES AND EDITOR 4, REAL FIRM 9, RECORD AND LOST AGREEMENT 7.
- Gate12 run 1 on d19f002: 75 GATE ok, 0 FAIL, GATE_EXIT=0; server 544 = 544; signing 75/0, record 40/0, EMAIL DIALOG (3).

## Guide line (for GUIDE-PASS.md)
portal-documents: a report opens or downloads only when it is exactly the file on record; otherwise the portal says the original is not kept. (143 bytes)

## Open items
1. Chromium only; owner's iPhone check in 12-09.
2. Report document with nothing kept: lost sentence, not remade.
3. The remade file is composed again on Download after View (not timed).
