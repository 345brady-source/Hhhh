# Quick task small-fixes-b: four small books fixes

Written by the orchestrator from the executor's hand-back (the executor's Write of this file was refused).

**Start:** f3bcf91. **End:** 6b20682 (wip/small-fixes-b). **Merged** onto d0012a9.
**Server tests:** 484 = base 484 (no new server tests). Merged tree: 506 of 506.
**Gate:** run 1 hit the 2-hour limit; run 2 resumed into the same folder, GATE_EXIT=0. AUDIT SAME PASS (4): 1228 schedules and 60 packages compared, all byte-identical. RETURNS READ 12, POSTING RETURNS 10, STATEMENTS 8 PASS on the final tree.

1. **'date' refusals counted on the Audit page** (audit.js counting line). RED: POSTING RETURNS amount failed (2 checks). GREEN: POSTING RETURNS PASS (10).
2. **Before-opening figure on the bank reconciliation schedule described** (audit.js): "Before the opening balance on <date>: in the books, not yet in the bank". RED/GREEN: NEW SCHEDULES bankrec; PASS (7).
3. **Reversing an entry from Entries frees its bank line** (books.js reverse(), 2 lines; books-bank.js uncategorize says "This decision is already undone; its entry has been reversed."). RED: line stayed decided. GREEN: BANK REC PASS (10); BOOKS CORE 8, POSTING 13 pass.
4. **Semicolon statements split at semicolons only** (bankfiles.js csvRows). RED: "$1,250.00" split. GREEN: BANK FILES PASS (12), RETURNS READ PASS (12).

## Open items
- A bank line reversed from Entries before this fix still points at its reversed entry (only preview test data can have one; no repair built).
- The before-opening row's Date column is still empty (the record does not keep the date).
- achreturns.js comment about the comma splitter is now out of date (code correct).
- invitations.js csvRows (pasted invitation lists) still splits semicolon lists at commas.
- Owner check pending for all four.

## On the merged tree (6e01bb7)
NEW SCHEDULES PASS (7), BANK REC PASS (10), BANK FILES PASS (12), POSTING RETURNS PASS (10), RETURNS READ PASS (12), AUDIT SAME PASS (4; base d0012a9 from a separate worktree). Server tests 506/506.
