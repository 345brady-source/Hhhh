# Autopilot standing brief (owner, 2026-11-19: "continue building the portal, your going to be on complete auto pilot on to the next steps")

Every agent on this project reads this file first. SCRATCH = the session scratchpad (/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad).

## Order of work (launch list)
2 help chatbot (phase 07) · 3 verification package + ongoing compliance (08) · 4 filings tab (09) · 5 investor tax documents and withholding · 6 fund accounting + CPA package · 7 report builder · 8 email overhaul · 9 messaging + data room · 10 security · 11 NACHA/ACH with the $0 money path · 12 reorganize · 13 UI overhaul · 14 final systems check · 15 prospecting workflow · 16 bring to market. Decisions for each are in .planning/phases/01.4-*/01.4-RESUME.md (sections dated 2026-11-15 to 2026-11-17) and each phase's CONTEXT.md.

## How work is done
- GSD: researcher, planner, plan checker, executors in isolated worktrees, verifier. Small bugs: a debugger or quick task with a RED-first check.
- Speed first without losing quality: independent plans run in parallel; plans sized to fit about 100k tokens.
- The owner hates waste and bloat: build only what the law or the task needs; no extra text on screens; nothing mandatory for investors (D-30); white label (no vendor, model or library names in anything a sponsor or investor sees; the word "basic" never appears); managed (Carrow & Vale) edition unchanged unless a plan says otherwise (C-03 slice guard in status-math).
- No work on the in-house reader (D-33). No paid API calls by agents; no agent is ever given an API key. Paid measurements are run by the orchestrator only.
- Outside services: present options with cost, accuracy, speed and trade-offs before building in-house; the owner has no budget for monthly fees, so a $0 path comes first.
- Never open SCRATCH/blind/. Never commit confidential documents or personal data.

## The owner tests on an iPhone inside the Claude app (WKWebView, a sandboxed iframe, no server)
Every user-facing plan must prove its screens there, not only in desktop Chromium:
- Checks run the page inside a sandboxed iframe with a CSP that blocks connect-src (see .planning/phases/06-*/checks/no-network.js and safari-finish.js), at 390x844 with touch, as well as 1280x800.
- No fetch()/XHR on any path that must work without a server; ship data as script-loaded files. No Blob stored in IndexedDB (store bytes); no browser PDF viewer (draw pages in-page); every view has a way out that is on screen (ways-out.js); dialogs scroll (email-dialog.js).
- Before a preview is published the orchestrator runs an owner-path walkthrough under these conditions.

## Mechanics
- Worktree base: latest claude/refract-reskin. Push only to wip/<branch>; never push claude/refract-reskin; never touch STATE.md or ROADMAP.md (planners may edit their own phase's section of ROADMAP.md).
- Commit trailer lines, exactly:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XxJmbg45ft458R18eVN2W2
- RED-first: every behaviour change has a check that fails before and passes after. The full gate is .planning/checks/gate-reference.sh (a copy of the last passing gate: server tests, status-math, form-maps, forms-flow, status-flow, server-mode, two-persons, owner walks and leak (SCRATCH/owner-set/measure.js), email-dialog, agreement-name, tax-request-leave, ways-out, no-network, embed-data, safari-finish, phase-4 signing-step and phase-5 record-check compared with the base). Counts follow the merged tree; keep them exact and honest.
- Browser checks go through SCRATCH/exec-011/heavy.sh (shared queue). Link server/node_modules from /home/user/Hhhh for runs only; never stage it. Run commands containing $(git ...) from script files; use tail -n N.
- Disk is limited (about 5 GB free): keep outputs small and delete base-tree copies, archives and screenshots after the gate.
- Reports: failures first, then the gate's last lines verbatim, commits, deviations. Nothing is "done" until the owner has checked it.

## Model (owner, 2026-11-19, verbatim: "when you run out of fable usage switch to opus 5.5")
- Work runs on the session's current model until its usage is exhausted. When an agent stops on a usage limit for that model, the orchestrator relaunches it on Opus 5.5 (the Agent tool's model override) from the last commit it pushed, and launches every later agent the same way. Nothing is restarted from scratch that was already pushed to a wip branch.
- The orchestrator cannot change the main session's own model; the owner does that with /model claude-opus-5-5.
- 2026-11-19: the Fable limit was reached (it resets Nov 26, 05:00 UTC). From now on every agent runs on Opus 5.5 and commits with the Opus trailer above. An agent that stopped on the limit is continued by a new agent working in the same worktree, from its commits and uncommitted files; nothing already done is redone.


## Save as you go (owner, 2026-11-20, verbatim: "You have to be prepare to run out of usage, always save when possible")
- Executors push their `wip/<plan>` branch after every commit. Work is never left only in a worktree.
- Planners commit and push each PLAN file as soon as it is finished, on claude/refract-reskin, one commit per finished plan. The owner's earlier rule still holds: a plan that is not finished is never committed, by the planner or the orchestrator.
- Researchers write RESEARCH.md in sections and commit and push each finished section.
- Plan checkers and verifiers append each finding to a file in the scratchpad as it is found (`checks-<plan>.md`), so a stop loses nothing already found.
- Orchestrator: merges and pushes as soon as a plan reports; records every decision and open item in CONTEXT files and pushes them at once; keeps "State now" below current after each merge round.
- A stopped agent is continued from its pushed branch plus any files in its worktree (SCRATCH/continue-brief.md).

## Usage window (owner, 2026-11-20: "You will likely run out of usage in 24 hrs")
- Priority while usage lasts (default chosen at 15 min if the owner does not answer): the preview first. Finish the 06-34..06-39 fixes, add the gate lines, run the full gate on the merged tree, rebuild, walk Filings, AML program and Tax documents, then publish, so the owner can check. Builds already running are merged as they report. New waves start only with spare capacity. Steps 7-16 are not planned before the cutoff.
- Owner's answer (verbatim): "Yeah don't start any new builds just finish what you have started, feel free to preform fixes". So: no new plan builds and no new waves (11-09 onward, 10-10 onward, 08-07 onward, steps 7-16 all wait). Finish what is running: 11-07, 09-09, 10-06, 10-07, 10-08, 10-09, 06-35, 06-36, 06-38. Fixes go ahead: 06-34, 06-37 and 06-39 (the walkthrough fixes and the co-investor sign-in), any failure found in merges or the full gate, then the preview rebuild, walk and publish.
- Usage cut (2026-11-20, after the owner said too little was done for the usage): builders no longer run the full reference gate or their phase gate. They run their own checks, the existing checks on code they touch, and the server tests. The orchestrator runs one full reference gate on the merged tree before publishing. Builder reports are 25 lines or fewer. Owner updates go out only on a merge, a failure or a question.
- "State now" is kept current after every merge round, so the next session resumes without redoing work.

## State now (updated 2026-11-20)
- Merged today: 09-04, 09-06, 09-07, Filings guide entries; 10-04; 11-05, 11-06, 11-08. Server tests 358.
- Building: 11-07 (wip/11-07), 09-09 (wip/09-09), 10-06, 10-07, 10-08, 10-09 (wip/10-0x).
- Plan check running: 06-34..06-39 (walkthrough 2 fixes plus the co-investor sign-in). Afterwards: build 06-34..06-38 in parallel, then 06-39; add six gate lines to gate-reference.sh; run one full gate on the merged tree; rebuild the preview from the current tree; walk Filings, AML program and Tax documents; publish to https://claude.ai/artifact/GPhQRgiF3Kkne2A5VHqDxP.
- Next to plan-check: phase 11 wave 4 (11-09..11-11) after 11-07 merges; phase 10 wave 4 (10-10, 10-12) after wave 3; phase 08 wave 5 (08-07, 08-17) when the browser queue allows.
- Owner's help chat page: https://claude.ai/artifact/Sbf9kfcoaqJd3svbb7tezj (source in the scratchpad's help-chat/; refresh guide.json from server/lib/help-guide.mjs after guide merges).
