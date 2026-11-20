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
- Owner, 2026-11-20 (third loss of the day, verbatim): "you must save everything as you go, as if you can loose usage any second". So, on top of the above:
  - Uncommitted work: every agent saves its uncommitted state to the remote at least after every edit round and before any command longer than a minute, without touching its branch: a save commit on the agent's own wip branch, pushed normally (see .planning/SAVE-RULES.md rule 2; the force-push form was refused by the permission checker).
  - Check runs: gate steps and check parts save each result the moment it ends, stamped to the exact tree, and a rerun keeps what passed on the same tree (quick task wip/gate-resume). Until it merges, agents start long runs only after saving.
  - Evidence: RED outputs and run logs that a SUMMARY quotes are copied into the plan's SUMMARY as they are produced, not only at the end.
  - Orchestrator: "State now" is updated and pushed after every event (merge, launch, failure, owner message), not only after merge rounds.
- Owner, 2026-11-20 (verbatim): "Every builder. Anything you do must be saved as you do it". The orchestrator saves its own work the moment it is made: tools and pages go in .planning/tools/ and are pushed, decisions go in CONTEXT files and are pushed, and "State now" is pushed after every event. Nothing the orchestrator needs lives only in the scratchpad.
- Every agent the orchestrator creates from now on gets the full text of .planning/SAVE-RULES.md in its prompt (owner: "Also tell every agent you create for now on").
- A stopped agent is continued from its pushed branch plus any files in its worktree (SCRATCH/continue-brief.md).

## Usage window (owner, 2026-11-20: "You will likely run out of usage in 24 hrs")
- Priority while usage lasts (default chosen at 15 min if the owner does not answer): the preview first. Finish the 06-34..06-39 fixes, add the gate lines, run the full gate on the merged tree, rebuild, walk Filings, AML program and Tax documents, then publish, so the owner can check. Builds already running are merged as they report. New waves start only with spare capacity. Steps 7-16 are not planned before the cutoff.
- Owner's answer (verbatim): "Yeah don't start any new builds just finish what you have started, feel free to preform fixes". So: no new plan builds and no new waves (11-09 onward, 10-10 onward, 08-07 onward, steps 7-16 all wait). Finish what is running: 11-07, 09-09, 10-06, 10-07, 10-08, 10-09, 06-35, 06-36, 06-38. Fixes go ahead: 06-34, 06-37 and 06-39 (the walkthrough fixes and the co-investor sign-in), any failure found in merges or the full gate, then the preview rebuild, walk and publish.
- "State now" is kept current after every merge round, so the next session resumes without redoing work.

## State now (updated 2026-11-20, after the container restart)
- Merged today: 09-04, 09-06, 09-07, Filings guide entries; 10-04, 10-09; 11-05, 11-06, 11-08; 06-35, 06-36, 06-38; 09-09 and the partly filed fix; 11-07; 10-06; 10-07; 10-08; 06-37; 06-34; help-preview; 06-39; the field editor check fix (3 out-of-date assertions, no product bug); resumable gates and check parts (gate-lib.sh, runParts saves each part). Server tests 368.
- Running: the STATUS FLOW flag debugger (wip/debug-flag). The early full gate on the pre-06-39 tree found two failures: STATUS FLOW flag (Approve stays pending; likely 06-34's unsigned rule vs the check) and MEASURE leak (the host's optional meta tag in two .planning/tools pages; fixed by removing it, and the standalone help chat page left the repo).
- Help in the preview is merged (owner, verbatim: "I want the portal, I want to see how the chat bot is presented in the portal, once finished give it to me": Help answers inside the preview through the artifact's sample capability; the standalone help chat page does not count for him).
- The preview publish must include help-preview's files and declare capabilities {sample: {}}.
- Next: once debug-flag merges, run the full reference gate (GATE_SERVER_TESTS=368) on the merged tree; then python3 .planning/tools/preview/build.py <scratch>/build/b14 fresh-6, walk it, publish with capabilities {sample:{}}. Gate lines added (398c418) except CO-INVESTOR SERVER (5, from 06-39); GATE_SERVER_TESTS 368 unless 06-39 changes it. Then add six gate lines (RECORD AND LOST AGREEMENT 7, SCREEN EDGES 5, TITLES AND EDITOR 4, PRESS AND CO-INVESTOR 7, CO-INVESTOR SERVER 5; GATE_SERVER_TESTS 368 plus any later change), run one full reference gate on the merged tree, rebuild the preview, walk Filings, AML program and Tax documents plus the fixes, and publish to https://claude.ai/artifact/GPhQRgiF3Kkne2A5VHqDxP.
- Owner's choice for this usage window: no new builds; finish what is running, plus fixes.
- Owner's help chat page: https://claude.ai/artifact/Sbf9kfcoaqJd3svbb7tezj (source in the scratchpad's help-chat/; refresh guide.json from server/lib/help-guide.mjs after guide merges).
