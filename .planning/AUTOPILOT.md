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
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XxJmbg45ft458R18eVN2W2
- RED-first: every behaviour change has a check that fails before and passes after. The full gate is .planning/checks/gate-reference.sh (a copy of the last passing gate: server tests, status-math, form-maps, forms-flow, status-flow, server-mode, two-persons, owner walks and leak (SCRATCH/owner-set/measure.js), email-dialog, agreement-name, tax-request-leave, ways-out, no-network, embed-data, safari-finish, phase-4 signing-step and phase-5 record-check compared with the base). Counts follow the merged tree; keep them exact and honest.
- Browser checks go through SCRATCH/exec-011/heavy.sh (shared queue). Link server/node_modules from /home/user/Hhhh for runs only; never stage it. Run commands containing $(git ...) from script files; use tail -n N.
- Disk is limited (about 5 GB free): keep outputs small and delete base-tree copies, archives and screenshots after the gate.
- Reports: failures first, then the gate's last lines verbatim, commits, deviations. Nothing is "done" until the owner has checked it.

## Model (owner, 2026-11-19, verbatim: "when you run out of fable usage switch to opus 5.5")
- Work runs on the session's current model until its usage is exhausted. When an agent stops on a usage limit for that model, the orchestrator relaunches it on Opus 5.5 (the Agent tool's model override) from the last commit it pushed, and launches every later agent the same way. Nothing is restarted from scratch that was already pushed to a wip branch.
- The orchestrator cannot change the main session's own model; the owner does that with /model claude-opus-5-5.

