# Quick task: guide trim (2026-11-27)

Written by the orchestrator from the executor's report (the executor's Write of this file was refused by the harness; it did not work around it). Branch wip/guide-trim (wording saves 68c3bc9..65d1e7f, generated files d21684c), merged 2026-11-27. The owner has not read the new text.

## Result
| Guide | Before | After trim | After the orchestrator restored three adviser lines |
|---|---|---|---|
| Sponsor | 47,888 | 44,350 | 44,641 |
| Investor | 15,436 | 14,294 | 14,585 |
Room under the 48,000 sponsor cap: 3,359 bytes (was 112).

## Facts-kept proof (executor's script, scratchpad guide-trim/facts.mjs; parses both versions with the build's own parse())
```
entries: before 52, after 52, same keys in same order: true
titles, menus, anchors, audiences, kinds unchanged: true
skip list unchanged: true
quoted names (per entry and overall): before 479 distinct, after 479 distinct, sets equal: true
numbers before: 42 distinct; numbers after: 42 distinct; sets equal: true
dev question set must patterns found in the guide before: 24; still found after: 24
PASS: no quoted name, number, key, title, menu or anchor lost
```
Sentences removed outright: two filler lines ("The account's details.", "Details of the investor."). Folded or pointed to another entry: console-aml procedures list (points to Integrations), console-kyc re-screen line, console-integrations opening, console-filings repeated "charges nothing and files nothing", invite's two identical error bullets, and joins of neighbouring sentences (esign, envelope, calls, notices, notifications, invite/tax, requests, ach, investor distributions). Full list in the executor's report.

## Orchestrator change after the merge
The trim removed three sentences that told the help not to judge whether someone qualifies (invite/accreditation, invite/status) or which tax form applies (invite/tax). They repeat rules.md, but they sit on the exact steps where investors ask those questions, so they were restored in shorter form (+291 bytes): "Whether a person qualifies is for the investor's own adviser or the firm, not this help." (and the account and tax-form versions).

## Checks
- Server tests 472/472 after the restore (scratchpad st-guide-trim.txt); build --verify and help-data --verify current.
- Executor's runs on the trimmed text: HELP PREVIEW 6 parts PASS; HELP CHAT 10 parts PASS (234 PASS, 0 FAIL). HELP PREVIEW and HELP CHAT rerun after the restore (scratchpad merge-guide-trim/).
- Not proven: no paid model call; no measurement that answers are as good with the shorter wording. The fresh unseen help question set before launch (task #67) covers it.
