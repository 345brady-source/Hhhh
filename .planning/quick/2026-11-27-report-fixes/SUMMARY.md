# Quick task 2026-11-27: three report-builder fixes before 12-09's owner walk

Written by the orchestrator from the executor's hand-back (the executor's Write of this file was refused). Raw outputs: scratchpad exec-report-fixes/.

Start c1e613c; end 88ede13 (wip/report-fixes, 6 commits). Merged onto d9edb09: server tests 544/544.

## Failures first
1. Gate run 1 hit the 2-hour limit; EMAIL DIALOG (3) failed on phone timing (7 of 11 paragraphs whole), passed on run 2, same tree.
2. Gate run 2: GATE FAIL ENGINE BOOKS (terms: sample offerings' settings now carry holding ids) and GATE FAIL REPORTS XLSX (inject used a stand-in id). Both fixed in the checks: ENGINE BOOKS declares the holding ids as its one expected difference (fault run proves it still catches a changed id); REPORTS XLSX uses the seeded id.
3. AUDIT SAME shows no difference at all (no compared schedule or package holds a holding id).
4. Not fixed, outside the brief: the investor's Documents viewer (portal.js openUploaded / up-download) reads a report file with no hash check, so an old-style id written by two firms in one browser before this fix could show another firm's PDF. New files cannot collide.

## Changes
1. Tell investors with every file withdrawn refuses: "Every file of this report is withdrawn; there is no one to tell." (reports-record.js; reports-deliver.js shows it, Notices draft untouched).
2. Report file ids `rf-<tenant id>-<run>-<file>`; fileBytes remakes a file from the run's snapshot when kept bytes do not match the record, never overwriting kept bytes.
3. All 45 seeded sample holdings carry `<offering id>-<slug of name>` ids (tenants.js; mobile copy synced); workspace.js normalize gives a saved sample workspace the ids from its seed.

## Evidence
- RED on start code: REPORTS RECORD FAIL (notice, archive), REPORTS RUN FAIL (archive), REPORT FIXES FAIL (3 parts).
- GREEN: REPORTS RECORD PASS (10), REPORTS RUN PASS (8), REPORT FIXES PASS (3, 42 PASS lines), MOBILE SYNC 3, ACH LEAK 4, NACHA BUILD 11, POSTING RETURNS 10, HOLIDAYS 10, INDEPENDENT READER 6, AUDIT SAME PASS (4).
- Gate12 run 3 on 88ede13: 74 GATE ok, 0 GATE FAIL, GATE_EXIT=0; server tests 472 = base 472; signing 75/0 both, record 40/0 both; EMAIL DIALOG (3).

## Guide line (for GUIDE-PASS.md)
console-reports: If every file of a report is withdrawn, "Tell investors" says so and fills in nothing. (87 bytes)

## Open items
1. Investor Documents viewer hash check (above): orchestrator decision below.
2. Measured in Chromium only (390x844 touch, 1280x800); owner's iPhone check in 12-09.
3. 'Mark sent on paper' still not pressed on screen by any check.
4. reports-flow.js `holdingIds` shim no longer does anything.
