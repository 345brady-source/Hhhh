---
quick: 2026-11-27-small-fixes-c
status: paused
plan_head_before: a0d4d821490c80028742deba1c5c52832540b8ac
plan_head_after: 857fd95
---
# Quick 2026-11-27 small fixes C: summary
(Written by the orchestrator from the executor's hand-back; the harness refused the executor's own write.)

## Paused (owner's indefinite pause, 2026-11-27)
- Closing gate unfinished: gate12.sh stopped after 61 `GATE ok`, 0 `GATE FAIL`, inside phase 11's checks after NO ONBOARDING (background time limit, at the pause). No GATE_EXIT; phase 12's own gate steps did not run.
- Gate lines so far: `GATE ok   server tests 585 = base 584 + 1 declared`; HELP CHAT (10), HELP PREVIEW (6), SERVER MODE (15), REPORTS FLOW (8); signing and record base against plan ok.
- Done and pushed on wip/small-fixes-c (head 857fd95): all three fixes, each red first. Nothing uncommitted.
- Resume: in a worktree on wip/small-fixes-c, `ln -s /home/user/Hhhh/server/node_modules server/node_modules`; rerun `GATE_OUT=<scratchpad>/exec-sfc bash .planning/phases/12-report-builder/checks/gate12.sh` in the background (timeout 7200000) into the same folder (the gate folder was kept for the resume; if the scratchpad was cleared, run into a fresh folder with base-commit.txt = a0d4d82); done when the last line is GATE_EXIT=0; then remove the link, delete the gate's base tree, shots and downloads, update this file. Because claude/refract-reskin has moved (base server count now 605+), rebase or merge-test before merging and expect `server tests <B+1> = base <B> + 1 declared`.
- Owner check pending: the empty-chart screenshot on his iPhone (`report-fixes.js --only empty-chart-phone` makes it again). Nothing here is ready until the owner has checked it.

## Failures and open items (first)
- The gate is unfinished (above).
- Wording for the owner: with no distributions the Q4 statement shows two near-identical sentences — "No distributions were paid in this period." (existing distributions section) and "You received no distributions in this period." (new, in the chart's place). The plan fixed this wording; the owner may want only one.

## RED outputs
- Task 1, word scan on the start tree (`# fail 1`): HIT assets/js/console.js:882 and assets/js/invitations.js:3 (comments); EXEMPT the help rule line, server/help/rules.md:17 and server/lib/help-guide.mjs:22 (exact text). Files read 133 (assets/ 96, server/lib/ 29, server/help/ 3, root *.html 4, preview page 1); assets/vendor/ left out and printed.
- Task 2, `REPORTS MODEL: FAIL (cases run: 1) - empty-charts` (investor and letter, distributions and capital: no chart block / one sentence / once all failed on the all-zero series; control passed); `REPORT FIXES: FAIL (parts run: 1) - empty-chart-phone` (Q4 preview and PDF drew the chart; fiscal-year control passed).
- Task 3, self-test on the start lib.js: 13 old cases pass; new cases 1, 2, 3 and 5 fail; case 4 (resume) passes as planned; `GATE RESUME SELF-TEST: FAIL - [...]`.

## GREEN and verify lines
- word.test.mjs `# tests 1 / # pass 1 / # fail 0`; help tests `# tests 29 / # pass 29`; build.mjs --verify in sync; rules.md and help-guide.mjs unchanged since base (PC-C1); T1-VERIFY-OK.
- `REPORTS MODEL: PASS (cases run: 12)`, `REPORT FIXES: PASS (parts run: 6)`, `REPORTS FLOW: PASS (parts run: 8)`, `REPORTS PDF: PASS (cases run: 9)`, `GATE RESUME SELF-TEST: PASS (18)`.
- Server tests: 584 on base a0d4d82; 585 on this tree (measured in the gate).

## What changed
- server/test/word.test.mjs (new, marker `// gate: tests 1`): exact-text exemption of the one help rule line (each must match exactly once); per-root file counts; > 100 files.
- assets/js/invitations.js lines 2-6 and assets/js/console.js:882: comments reworded.
- assets/js/reports.js chartBlock: an all-zero series pushes one note instead of the chart (investor: "You received no distributions in this period." / "Your capital account was zero throughout this period."; fund: "The fund made no distributions in this period." / "The fund had no capital in this period."); the unreachable $0.00 tick branch removed.
- phase 6 checks/lib.js savePart/runParts: a failed part is copied first, whether or not the tree changed, to `<OUT>.failed-parts/<check>-<hash>/<part>-<sha8>.failed-<UTC>-<pid>.json` with `treeChanged`; runParts prints `NOTE part <p> failed: its lines are kept in <path>`; keptPart and the main record unchanged.
- gate-resume-selftest.sh: dummy part b fails while DUMMY_FAIL exists; five new cases (18 in all).

## Commits (wip/small-fixes-c)
7e15fe6 test word scan (red); 4cd438a fix comments; 2a3a698 / 4b3848a / 6b224b7 wip saves (reports-model red, report-fixes red, chartBlock change); f389610 test self-test cases (red); 7027947 fix savePart failed copies; 857fd95 fix empty chart sentence and report-fixes screenshot wait.

## Deviations
1. Output folder exec-sfc (orchestrator's name). 2. node --test prints console lines as `# ...`, so `^EXEMPT` greps read `^# EXEMPT`. 3. PC-C1 followed. 4. The failed copy is placed with link() (falls back to an exclusive copy), so a taken name is never replaced; the self-test uses an absolute work folder. 5. Self-test case 5 deletes b's main record first, then shows none is written when the tree changes. 6. empty-chart-phone waits for passing messages to fade before each screenshot.

Guide line for GUIDE-PASS.md: none.
