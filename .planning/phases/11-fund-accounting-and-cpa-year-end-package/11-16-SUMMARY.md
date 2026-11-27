# Phase 11 Plan 16: the CPA year-end package files, the button and the in-preview download proof (draft, in progress)

## Evidence as produced

- Start commit: ad252a59831d05ce8abaaeb52c71252be485395b (base-commit.txt in SCRATCH/exec-11-16)
- red-1.txt (Task 1): `FAIL fund-a ran to the end :: Error: NS.books.packageFiles is not a function` / `PACKAGE FILES: FAIL (cases run: 1) - fund-a`
- Task 1 verify: `PACKAGE FILES: PASS (cases run: 1)` (exec-11-16/fund-a.txt)
- Plan figure corrected (not loosened): the trial balance tab's Debits and Credits columns are the year's activity (1,000,000.00 each, as new-schedules.js asserts); 556,500.00 is the total of the debit balances and of the credit balances (fixture tbDebits/tbCredits). The check asserts both; the PDF's checks table states "Debit balances $556,500.00; credit balances $556,500.00."
- red-2.txt (Task 2): `FAIL forms forms/FA-1001_W-9.pdf is in it, after the CSVs and before the manifest :: ["csv/13_Investments.csv","forms/FA_1001_W-9.pdf","MANIFEST.sha256"]`, `FAIL forms forms/FA-1001_W-9.pdf is byte for byte the stored signed copy B :: 0`, `FAIL forms the README says 'Signed tax forms included: Yes' ...` / `PACKAGE FILES: FAIL (cases run: 6) - forms`. The forms and log code had gone in with Task 1's commit (e84656c), so this RED is the new cases run against that code: they found a real bug (the investor id slugged to FA_1001). libre, sample, logged and selfcheck passed on first run.
- Task 2 verify, run 1: `PACKAGE FILES: PASS (cases run: 6)`, but the folder test failed: checks-out held `.parts` (the gate-resume store lib.js runParts writes there) and `package-flow-17049` (the Task 3 RED run going on at the same time). Rerun after RED 3 (below).
- red-3.txt (Task 3): `FAIL button-phone the Audit page for fund A has the 'Year-end package' panel with its one line :: null`, `FAIL button-phone ran to the end :: frame.evaluate: TypeError: NS.books.package is not a function` (books-pkg.js not on the page).
- Guide: GUIDE.sponsor 44,641 bytes before, 44,766 after: +125 (cap 160).
