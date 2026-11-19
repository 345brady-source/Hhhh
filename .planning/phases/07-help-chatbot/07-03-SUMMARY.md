---
phase: 07-help-chatbot
plan: 03
subsystem: help
tags: [help, dialog, fail-soft, sandboxed-frame, phone, white-label, self-serve]
status: complete
requires:
  - "07-01: the page keys of server/lib/help-guide.mjs PAGES (the page and step the browser sends are those keys)"
provides:
  - "assets/js/help.js: Help in the console bar (sponsor) and in the page footer (investor), the dialog, ask() as the one transport to POST {server}/v1/help, one sentence for every failure, the support contact"
  - ".planning/phases/07-help-chatbot/checks/help-chat.js: the framed check, ten parts"
affects: [07-04]
tech-stack:
  added: []
  patterns: ["a consoleBar hook and a footer button sharing one NS.actions entry", "one plain fetch, never repeated, every failure the same fixed sentence", "a stand-in server in the check that speaks the route's contract"]
key-files:
  created:
    - assets/js/help.js
    - .planning/phases/07-help-chatbot/checks/help-chat.js
  modified:
    - assets/js/portal.js
    - assets/css/diy.css
    - index.html
    - diy.html
    - portal.html
decisions:
  - "An admin with no valid supportEmail sees no contact line (plan-check addition); a team member sees 'Contact your administrator.'"
  - "On a wide screen the console's Help is a quiet underlined word under the bell at the end of the address row; at 900px and narrower it is a 40px button left of the bell"
  - "On an invitation's page the person asking is always the investor, whatever this browser is signed in as"
  - "The field is focused on open only with a mouse or trackpad; on a touch screen the keyboard waits for a tap"
metrics:
  started: 2026-11-19T16:05:00Z
  completed: 2026-11-19T18:22:21Z
  duration: "about 2h17m wall clock across two agents (the first stopped on a usage limit), most of it waiting in the shared browser queue"
  tasks: 3
  files: 7
actuals:
  tokens: 20100
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 14d352286e92e39c54bd6c12a350a0e33a160d48
plan_head_after: 024cad622f851da91ab4dd2dc2c080dbe0e2ac05
---

# Phase 7 Plan 3: Help in the portal, browser side, Summary

One Help word in the console bar for sponsors and one Help button in the page footer for investors (self-serve edition only). Both open the same dialog. With no server it shows one plain sentence and the contact and makes no request. With a server, a question goes out in one request that is never retried. Answers are shown as plain text, and every failure ends in the same sentence plus the contact. Proven in a sandboxed frame that refuses connections, at 1280x800 and at 390x844 with touch.

## Failures and what is not proven

- **No failures in the final runs.** The first full run of the ten parts (earlier agent) failed six parts: Help overlapped the bell, the browser's loopback rule blocked the stand-in, the phone log had no scroll room, and the managed part timed out. All six were fixed in the code or the check's own server setup before commit 024cad6. Seven parts have a saved first failing run (red.txt, red-investor/support/refused-desktop/answers-desktop/failures.txt, and refused-phone, answers-phone and managed in first10.txt). nosrv-phone passed on its first run because the styles written for Task 2 already met it.
- **Not proven:** a real iPhone keyboard. The check used two stand-ins: the field, Send and Close end within the top 300px, and they stay whole in a frame 420px tall. WebKit was not run (Chromium only). No real answer was shown; a stand-in server answered. **Nothing here is ready until the owner has pressed Help on his phone in the published preview.**
- The full gate was run once, by the earlier agent at 17:45, in its worktree, on commit 024cad6. That is the same tree (c8541fec) this worktree holds. The continuation re-ran only help-chat.js (all ten parts) and the managed case of status-math here, not the whole gate.

## What the earlier agent did, and the continuation

- Earlier agent (stopped on a usage limit): wrote all three tasks. Commits 41aca20 (RED check), b12fd3e (Task 1), 024cad6 (Task 2, plus the Task 3 parts and the fixes they needed, in one commit). It also ran the ten parts, the managed case and the gate copy: VERIFY_EXIT=0.
- Continuation (this agent): reset to that branch and confirmed nothing was left uncommitted. Re-ran the ten parts in this worktree (pass, 234 PASS lines, the same counts as before). Compared the client with the real route merged from 07-02. Deleted the gate's base-tree copy and screenshots (340 MB). Wrote this summary.

## The real server route (07-02) against this client

Compared with `server/lib/help.mjs` and `server/index.mjs` on origin/claude/refract-reskin (merge f915696). **They match. No change was needed.**
- A 200 reply is `{ ok: true, kind: 'answer'|'cannot'|'out_of_scope', answer, session }`. That is the stand-in's shape and what `ask()` accepts.
- Every other reply is non-200 `{ ok: false, reason }`, for example 503 `unavailable` when the server has no key. The client shows it as "Help is not available right now." plus the contact.
- The server reads only message, session, page, step and role, the same five fields the client sends. The page keys the client sends (the route name, e.g. `console-investors`, `console-docs`, `invite` + step, `onboarding` + `payment`) are keys of `PAGES` in server/lib/help-guide.mjs.
- A session belongs to the account or invitation that opened it. If the server does not recognise the session it was sent, it returns a new id, and the client always adopts the session the server returns.

## Results (this worktree, HEAD 024cad6, tree c8541fec)

```
HELP CHAT: PASS (parts run: 10)
STATUS MATH: PASS (cases run: 1)
```

| Part | PASS lines |
|------|-----------|
| nosrv-desktop | 19 |
| investor | 42 |
| support | 32 |
| refused-desktop | 17 |
| answers-desktop | 31 |
| failures | 27 |
| nosrv-phone | 18 |
| refused-phone | 17 |
| answers-phone | 17 |
| managed | 14 |

Measured in the refusing frame: a refused question shows the sentence and contact in 52 to 64 ms (limit 2,000 ms). There is exactly one refused connection per question, still one 9.5 s later. On the phone, Help is 40px tall, inside the 390-wide window and left of the bell. With the field focused, Close ends at 56px and the field and Send at 121px; the newest answer starts at 206px. In a 420px frame all three stay whole, and the log scrolls to its end.

## The gate (earlier agent's run on the same tree; last lines verbatim)

```
GATE ok   server tests # fail 0
GATE ok   server tests 205
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   HELP CHAT (10)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 205
# pass 205
# fail 0
GATE_EXIT=0
```

205 server tests is the count at this plan's base (14d3522, before 07-02 was merged). The merged tree's count follows 07-02.

**Lines to add to .planning/checks/gate-reference.sh after merge** (not edited here). After the SAFARI FINISH run:
```
NODE_PATH=$GN bash $S/exec-011/heavy.sh node .planning/phases/07-help-chatbot/checks/help-chat.js > $O/helpchat.txt 2>&1
tail -n 2 $O/helpchat.txt
```
and after the SAFARI FINISH `ok` line:
```
ok 'HELP CHAT (10)' "grep -qx 'HELP CHAT: PASS (parts run: 10)' $O/helpchat.txt"
```

## Files a preview build must publish

- New: `assets/js/help.js`
- Changed: `assets/js/portal.js`, `assets/css/diy.css`, `index.html`, `diy.html`, `portal.html`

## Deviations from Plan

1. **[Plan-check addition] An admin with no support address sees no contact line.** Task 1 as written expected "Contact your administrator." for the admin. The plan-check addition in 07-CONTEXT.md overrides that, so nosrv-desktop asserts the admin dialog is exactly the heading and the sentence. The support part asserts the team role ("Contact your administrator.") as well as the admin role.
2. **[Process] Task 3's code and parts landed in Task 2's commit (024cad6), not in a commit of their own.** The earlier agent wrote the phone and managed parts alongside Task 2. Their first failing runs are in first10.txt.
3. **[Rule 3 - Blocking] The check serves the portal from its own small HTTP page server.** no-network.js answers pages through the browser's request router. A page served that way cannot reach another port on this machine (Chromium's loopback rule), so it could never reach the stand-in. The page server sends the frame's policy as a response header, as the preview's host does. The refusing frame and the `window.__cspv` proof are unchanged. This is in the check only; help.js was not changed for it.
4. **[Wide-screen placement]** The bar's first row (236px) is filled by the firm's name beside the bell. So on a wide screen Help sits as a quiet word under the bell, at the end of the address row, rather than to the left of the bell. At 900px and narrower it is a 40px button left of the bell, as planned.

## Threat model

T-07-14 to T-07-19 are mitigated as planned and each has a part asserting it: answers-desktop sends markup, the body's keys and planted names; failures and leakCheck; support; refused-desktop counts the requests; managed. No new surface beyond the plan.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: assets/js/help.js, .planning/phases/07-help-chatbot/checks/help-chat.js
- FOUND in HEAD's history: 41aca20, b12fd3e, 024cad6
