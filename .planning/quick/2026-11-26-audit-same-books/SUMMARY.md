# Quick task: AUDIT SAME compares the books (2026-11-26/27)

Written by the orchestrator from the executor's report (the executor's Write was refused by the harness; it did not work around it). Branch wip/audit-same-books (371f64f RED, e70d0b7 GREEN save commit), merged 2026-11-27. No product code changed. The owner has not checked this.

## What changed
- load11.js: option `books: true` (off by default, so other phase 11 checks load exactly what they did); when on, the scripts diy.html lists after operations.js that define or extend NS.books (books.js, books-post.js; later books-bank.js) load directly after operations.js, read from the page at run time, each side from its own files. Exports booksScripts and buildsBooks.
- audit-same.js: every part loads through portal() with books on; part `same` checks each side loads its own books scripts in page order and prints the schedules only the tree builds (not compared); new selfcheck `booksRules`: Kestrel Bay compared with itself must report nothing and include `tb`; one manual one-cent journal entry on kb-fund-ii (5900 debit 1, 1000 credit 1, 2025-12-31) must be reported naming kb-fund-ii and the trial balance. 11-18's moved-notice rule (8 reported proofs), the base-lacks-schedule exception and byte-for-byte comparison are kept.

## RED (dfa8299, load11 unchanged)
```
FAIL selfcheck books loaded: ... (none), and NS.books.sync and NS.books.trialBalance exist :: edition.js, ..., audit.js, operations.js
FAIL selfcheck books unchanged: ... (88 schedules, 6 packages); schedules compared: al, ops, chg, rollforward, register, activity, bank, soi, fvh, l3, fees, carry, perf, log, checks, zip :: []
PASS selfcheck books changed: kb-fund-ii: one manual journal entry of one cent dated 2025-12-31 (5900 debit 1, 1000 credit 1)
FAIL selfcheck books reported: the one-cent journal entry is reported naming kb-fund-ii and the trial balance (nothing reported) :: []
AUDIT SAME: FAIL (cases run: 1) - selfcheck
```

## GREEN (GATE_FRESH=1; every run `AUDIT SAME: PASS (cases run: 4)`)
| Base | Holds | Schedules compared | Only in tree | Moved-notice rule |
|---|---|---|---|---|
| 6b3a4a3 | before 11-12 and 11-18 | 928 | tb, gl, cf, bankrec, ratios | on (Kestrel Bay 5, Pellbrook 4) |
| 169b219 | 11-12 head, no 11-18 | 1228 | none | on |
| 085b7ce | 11-18, no 11-12 | 928 | tb, gl, cf, bankrec, ratios | off |
| dfa8299 | start commit | 1228 (60 of 60 packages identical) | none | off |
- Every run: `PASS selfcheck books reported: ... (fy: tb, gl, cf; itd: tb, gl, cf)`. The one cent does not show in schedule 24 (ratios round it away); the proof requires only the trial balance.
- Real difference between base and tree: none found. Case `mutate` is now also caught in the books (tb, gl, cf among the reported schedules).
- Gate: run 1 stopped at the 2-hour limit in phase 10 (37 GATE ok, no FAIL); run 2 into the same folder `GATE_EXIT=0`, server tests 456 = base 456 + 0; AUDIT SAME ran fresh.

## Open
- The phase 6 lib.js part-resume key does not include P11_ROOT (the known kept-results gap in AUTOPILOT): reruns against a different base use GATE_FRESH=1 until the gate tools key parts by the base tree too.
- compare() carries an unused diagnostic field r.sides; remove when next edited.
