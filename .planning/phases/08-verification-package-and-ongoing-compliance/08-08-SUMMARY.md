---
phase: 08-verification-package-and-ongoing-compliance
plan: 08
subsystem: verification (ongoing screening)
tags: [D-04, C-06, G3, G4, VPK-06, VPK-07, VPK-10]
status: complete
requires: ["08-02 (monitoring enrolment, alerts hold only)", "08-07 (doubles/world.js)", "08-19 (screened in the screening reply)"]
provides:
  - "GET /v1/checks/changed (server/lib/changed.mjs changedChecks); changedAt in apply; monitoring in POST /v1/screenings replies"
  - "integrations.js: pullChanged, autoRescreen, rescreenWith, settleMonitored; server.pulledAt / pulledFor / confirmed; result field monitoring"
  - "checks/monitoring.js: GATE CHECK MONITORING, 8 parts"
affects: ["08-12 (confirm the provider's alerts and monitoring enrolment)", "queued small fixes (contact line, after this plan)"]
tech-stack:
  added: []
  patterns: ["hold-only pull of server-side changes", "free connection only for unattended runs, once per due date"]
key-files:
  created: [server/lib/changed.mjs, server/test/changed.test.mjs, .planning/phases/08-verification-package-and-ongoing-compliance/checks/monitoring.js]
  modified: [server/index.mjs, assets/js/integrations.js]
decisions:
  - "The console pulls and re-screens by itself only from the server address the sponsor confirmed with Check connection (phase 7's HELP CHAT requires no connection from an address only saved)"
  - "A pulled change is applied only to a result that had come back clear (screening) or passed (identity); a person's decision made after the change stands"
  - "An unattended Treasury re-screen that gets no answer writes nothing and is not retried for that due date; the investor stays due with Run now"
  - "GET /v1/checks/changed answers now = reply time minus 1 ms (a same-millisecond change is listed again, never missed); a cut list continues from just before its last item"
metrics:
  duration: "about 6 h 45 min wall time (2026-11-26 23:10 to 2026-11-27 05:55 UTC), most of it the shared browser queue and three gate runs"
  completed: 2026-11-27
estimate:
  tokens: 100000
  tasks: 3
actuals:
  tokens: 22700    # chars/4 over the lines added to server/, assets/ and checks/ (90,824 chars)
  tasks: 3
  commits: 16      # git rev-list --count 8eff49a..HEAD, this summary's commit included
plan_head_before: 8eff49a61ec66c195cc8fae06e067d0fcec68073
plan_head_after: see the final commit of this summary (the gate ran on bf3f016)
---

# Phase 8 Plan 08: Ongoing screening (monitoring alerts, free re-screen) Summary

A new-hit alert on a package investor now holds them in the sponsor's console the next time it opens, with no button pressed and one "Monitoring alert" entry in the change log. When the firm uses the free Treasury lists, due investors are re-screened through them automatically at console load, once per due date. Paid connections and the package provider never run by themselves, and "Run now" never reaches the package provider. All of this was tested against stand-ins only.

## Failures first

1. **Gate run 1 FAILED: HELP CHAT (phase 7), caused by this plan.** The console's new pull went to a server address that was only saved, and phase 7 requires no connection in that case. Fixed in 68e510d: the pull and the free re-screen use only the address the sponsor confirmed with "Check connection". Details and the failing lines are under "Gate run 1" below.
2. **Gate runs 1 and 2 were cut off by the 2-hour limit** (the browser queue was full). Every GATE line printed is quoted below. Run 2's lines are in $O/gate-run2-cut.txt; up to SAFARI FINISH they were all ok except one.
3. **Gate run 2: MEASURE failed once, from the queue, not the code.** walkA hit measure.js's 900-second limit with "0 PASS, 0 FAIL": that limit counts the time spent waiting for a browser slot. It passed on the rerun (`PASS walkA (780 s): individual: 13 PASS, 0 FAIL`).
4. **Gate run 3 (the rerun into the same folder) ended GATE_EXIT=1 on two lines.**
   - `GATE FAIL owner's folder: index.txt and four signed PDFs`: verify-3.sh as written deletes $O/owner before it starts the gate. On a resumed gate, FORMS FLOW (the step that writes that folder) was kept and did not write it again. This is a fault in the verify on a resume, not in the code. I removed FORMS FLOW's stamp, so it ran again and rebuilt the folder.
   - `GATE FAIL CO-INVESTOR SERVER (5)`, part cosign-forged: the same part 08-CONTEXT already records as failing under a full queue. It passed on the next run. This plan's code does not touch it: no pull runs there, because no server was confirmed.
5. **The final run used a resume form of verify-3.sh.** It is the plan's verify-3 with B1 and B2 applied and the leading `rm -rf` dropped, because the rm destroys what a resumed gate keeps. Its result: `VERIFY3_EXIT=0`, `GATE_EXIT=0`.
6. **Nothing is proven against the real provider.** Alerts, the monitoring enrolment and the Treasury lists were all answered by stand-ins. 08-12 has to show a real alert. Nothing here is called confirmed.

S = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad, O = S/exec-08-08.

## Step 0 (base 8eff49a)

- base-commit.txt: 8eff49a61ec66c195cc8fae06e067d0fcec68073 (claude/refract-reskin tip at start; 8eff49a is HEAD itself)
- base-count.txt: 456 (server suite on the base: `# tests 456`, `# fail 0`). Plan text said 363; plan-check W1 said 456: matches.
- base-checks.txt: 6 phase-8 gate checks (AML RECORD, PACKAGE CONSOLE, FLOW, INVITE, NAMES, PANEL)

## Task 1 (tracer): RED, then GREEN

RED server ($O/red-srv.txt, the tracer test before any code):

```
not ok 1 - changed tracer: a signed monitoring alert on a clear screening is listed once, after the time asked from, with its hits and monitoring
# tests 1
# fail 1
```
(the route answered 404: `expected: 200 actual: 404`)

RED check ($O/red.txt, run from a `git archive` copy of the RED commit 2b6943b so code written meanwhile could not leak into it):

```
FAIL alert with nothing pressed, the console holds the investor for review with the alert's hit :: {"title":"Odalys Vantongeren","identity":"passed","aml":"clear",...
FAIL alert the AML/KYC page reads "Needs review" for the investor :: null
FAIL alert ran to the end :: page.click: Timeout 30000ms exceeded.
MONITORING: FAIL (parts run: 1) - alert
```

GREEN: $O/verify-1.sh exactly as the plan gives it, run in a `git archive` copy of 307c99d (Task 1's code; the worktree had moved on to Task 2's tests): `VERIFY1_EXIT=0`; srv1.txt `# tests 1`, `# fail 0`; tracer.txt last line `MONITORING: PASS (parts run: 1)`.

## Task 2: RED

RED server ($O/red2-srv.txt, the five new tests against Task 1's code):

```
not ok 5 - changed reply: POST /v1/screenings answers monitoring true for a monitored screening and false otherwise
# tests 6
# fail 1
```

Tests 2, 3, 4 and 6 passed on Task 1's code (the route was written whole in Task 1); each is a guard, each shown failing under a mutation ($O/mutations.txt):

```
MUTATION who (the query wins over the account): not ok 1 - changed who: # fail 1
MUTATION rules (no cut at 500): not ok 1 - changed rules: # fail 1
MUTATION rules-pending (pending records listed): not ok 1 - changed rules: # fail 1
MUTATION private (the name screened kept on hits): not ok 1 - changed private: # fail 1
MUTATION verifications (identity checks lose their screening): not ok 1 - changed verifications: # fail 1
MUTATION apply (index.mjs apply sets changedAt on every result written): not ok 1 - changed rules: # fail 1
```

RED check ($O/red2.txt, parts hold-only, monitored-not-due, package-not-run run from an archive of Task 1's commit 307c99d with the new check file):

```
FAIL monitored-not-due the monitored investor has no next re-screen date (nor a next review on the AML/KYC record) :: {"nextScreen":"2026-11-16","nextReview":"2026-11-16"}
FAIL monitored-not-due only the other investor counts as due for re-screening :: ["KBC-1001","KBC-1002"]
FAIL monitored-not-due "Run now" re-screens the other investor only :: {"toast":"2 investors re-screened","other":"2026-12-26","same":false}
FAIL monitored-not-due a screening whose every result is monitored sets no next re-screen date :: {"id":"KBC-1003","next":"2026-12-26","monitoring":[false],"review":"2026-12-26"}
FAIL package-not-run through the Treasury connection only: one list read, one screening asked of the server, for the Treasury lists :: {"reads":1,"posts":["ofac","ownscreen"]}
FAIL package-not-run the package result is kept as it was, the Treasury result is added, the next date moved :: {... "aml":"pending" ...}
FAIL package-not-run with no Treasury connection, the package investor is left out of "Run now" (no line at all) :: [...]
FAIL package-not-run nothing was called for the package investor: no list read, no screening asked of the server, no package provider call :: {"reads":1,"posts":["ofac","ownscreen"],"calls":0}
MONITORING: FAIL (parts run: 3) - monitored-not-due, package-not-run
```

Before the fix, "Run now" on a package investor ran every screening connection the firm had on, the sponsor's own paid connector included (`posts: ["ofac","ownscreen"]`), and replaced the package result.

hold-only passed on Task 1's code (the pull already only held): a guard, shown failing under a mutation ($O/mutations.txt, $O/mut-browser.txt):

```
MUTATION pull (pullChanged writes whatever status a pulled record says, so a clear record clears): FAIL hold-only a server record that reads clear does not clear the held investor
```

## Task 3: RED

RED check ($O/red3.txt, parts auto-free, once, preview-desktop, preview-phone run from an archive of Task 2's commit 4ca1857):

```
FAIL auto-free with no click, the console re-screens the due investor when it loads :: {"moved":false,"clicks":0}
FAIL auto-free one change-log entry "Re-screened automatically", naming the investor :: []
FAIL auto-free the next date moved by the firm's interval (30 days) :: 2026-11-25
FAIL auto-free through the Treasury connection alone: one list read, one screening asked of the server, for the Treasury lists :: {"reads":0,"posts":[]}
FAIL once loads at once start one run: one Treasury screening on the server, one list read, one change-log entry :: {"screenings":0,"reads":0,"posts":[]}
FAIL once a run that got no answer was tried once for that due date and writes nothing :: {"tried":0,"posts":0,"next":"2026-11-24"}
MONITORING: FAIL (parts run: 4) - auto-free, once
```

preview-desktop and preview-phone passed on Task 2's code (nothing ran by itself there before either): guards, shown failing under a mutation:

```
MUTATION preview (resume and ongoing run with no server connected): FAIL preview-desktop and preview-phone: the frame recorded no refused connection (connect-src .../v1/checks/changed)
MONITORING: FAIL (parts run: 3) - hold-only, preview-desktop, preview-phone
```

Before the gate, the whole check on the final tree ($O/full1.txt, a12b2b9's code): `MONITORING: PASS (parts run: 8)`; the whole server suite ($O/server-pre.txt): `# tests 462`, `# fail 0`.

## Gate run 1: FAILED (HELP CHAT), then cut off by the 2-hour limit

The first run of verify-3.sh (tree 04b0243) failed HELP CHAT (phase 7's check) and was stopped by the 2-hour limit after SCREEN EDGES. Every GATE line it printed ($O/gate-run1-cut.txt):

```
GATE ok   server tests # fail 0
GATE ok   server tests 462 (found 462)
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
GATE ok   BANK STEP TYPING (2)
GATE FAIL HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   PHONE LAYOUT (8)
GATE ok   RECORD AND LOST AGREEMENT (7)
GATE ok   SCREEN EDGES (5)
```

The HELP CHAT failure ($O/red-helpchat.txt), a fault of this plan's code:

```
FAIL refused-desktop with a server address saved, the console itself attempts no connection :: ["connect-src https://portal-server.example/v1/checks/changed?since=1970-01-01T00%3A00%3A00.000Z&workspace=kestrel-bay"]
FAIL answers-desktop the stand-in was asked for nothing but /v1/help :: ["GET /v1/checks/changed?since=1970-01-01T00%3A00%3A00.000Z&workspace=kestrel-bay"]
FAIL failures the stand-in was asked for nothing but /v1/help :: ["/v1/checks/changed?...","/v1/help", ...]
FAIL refused-phone with a server address saved, the console itself attempts no connection :: [...]
FAIL answers-phone seven questions, each sent once, to /v1/help only :: 7
HELP CHAT: FAIL (parts run: 10) - refused-desktop, answers-desktop, failures, refused-phone, answers-phone
```

Phase 7 requires that a console with a server address only saved attempts no connection by itself; the pull broke that. Fix (68e510d): the console's own pull and free re-screen use only the server the sponsor confirmed with "Check connection" on the Integrations page (that action now records the address it confirmed; settings checked before this plan count when their status line reads "Connected"). monitoring.js now confirms the server the way the sponsor does and proves, in every server part, that an address only saved is asked nothing (`C.pulls === 0`). Then (00d71df) clearing a monitored investor's calendar date, which makes no connection, moved to resume so it happens without a confirmed server too.

After the fix: HELP CHAT alone ($O/helpchat2.txt) `HELP CHAT: PASS (parts run: 10)`; MONITORING alone on 68e510d ($O/full2.txt) and on 00d71df ($O/full3.txt) `MONITORING: PASS (parts run: 8)`.

## Gate runs 2 to 4 (tree bf3f016, the same HEAD throughout)

- Run 2 (verify-3.sh): cut off by the 2-hour limit after SAFARI FINISH. `GATE FAIL MEASURE` (walkA hit the 900 s limit while it waited for a slot). Lines in $O/gate-run2-cut.txt.
- Run 3 (verify-3.sh again, into the same folder): `GATE FAIL owner's folder: index.txt and four signed PDFs` and `GATE FAIL CO-INVESTOR SERVER (5)`, everything else ok, `GATE_EXIT=1` ($O/gate-run3.txt). The causes are under "Failures first".
- Run 4 ($O/verify-3-resume.sh: verify-3.sh without its leading `rm -rf`, FORMS FLOW's stamp removed first, so FORMS FLOW, the owner's folder step and CO-INVESTOR SERVER ran again). `VERIFY3_EXIT=0`. The gate's last lines, verbatim ($O/gate.txt):

```
GATE ok   server tests # fail 0 (kept from 2026-11-27 02:18:11 UTC)
GATE ok   server tests 462 (found 462) (kept from 2026-11-27 02:18:11 UTC)
GATE ok   STATUS MATH (13) (kept from 2026-11-27 02:18:12 UTC)
GATE ok   FORM MAPS (3) (kept from 2026-11-27 02:18:47 UTC)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26) (kept from 2026-11-27 02:59:35 UTC)
GATE ok   SERVER MODE (15) (kept from 2026-11-27 03:04:53 UTC)
GATE ok   TWO PERSONS (kept from 2026-11-27 03:25:14 UTC)
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3) (kept from 2026-11-27 03:47:57 UTC)
GATE ok   AGREEMENT NAME (kept from 2026-11-27 03:50:32 UTC)
GATE ok   TAX REQUEST LEAVE (5) (kept from 2026-11-27 03:50:59 UTC)
GATE ok   WAYS OUT (7) (kept from 2026-11-27 04:07:48 UTC)
GATE ok   NO NETWORK (3) (kept from 2026-11-27 04:09:10 UTC)
GATE ok   EMBED DATA (3) (kept from 2026-11-27 04:09:10 UTC)
GATE ok   SAFARI FINISH (6) (kept from 2026-11-27 04:09:53 UTC)
GATE ok   BANK STEP TYPING (2) (kept from 2026-11-27 04:45:39 UTC)
GATE ok   HELP CHAT (10) (kept from 2026-11-27 04:47:16 UTC)
GATE ok   REAL FIRM (9) (kept from 2026-11-27 04:49:57 UTC)
GATE ok   SIGNING DOCUMENTS (8) (kept from 2026-11-27 04:53:19 UTC)
GATE ok   PHONE LAYOUT (8) (kept from 2026-11-27 04:58:50 UTC)
GATE ok   RECORD AND LOST AGREEMENT (7) (kept from 2026-11-27 05:05:50 UTC)
GATE ok   SCREEN EDGES (5) (kept from 2026-11-27 05:07:37 UTC)
GATE ok   WALK3 FIXES (9) (kept from 2026-11-27 05:08:03 UTC)
GATE ok   TITLES AND EDITOR (4) (kept from 2026-11-27 05:08:55 UTC)
GATE ok   PRESS AND CO-INVESTOR (10) (kept from 2026-11-27 05:11:08 UTC)
GATE ok   CO-INVESTOR SERVER (5)
GATE ok   HELP PREVIEW (6) (kept from 2026-11-27 05:12:48 UTC)
GATE ok   phase-8 gate checks found (7)
GATE ok   AML RECORD (7) (kept from 2026-11-27 05:13:17 UTC)
GATE ok   MONITORING (8) (kept from 2026-11-27 05:15:09 UTC)
GATE ok   PACKAGE CONSOLE (7) (kept from 2026-11-27 05:21:25 UTC)
GATE ok   PACKAGE FLOW (10) (kept from 2026-11-27 05:25:25 UTC)
GATE ok   PACKAGE INVITE (12) (kept from 2026-11-27 05:27:22 UTC)
GATE ok   PACKAGE NAMES (4) (kept from 2026-11-27 05:28:03 UTC)
GATE ok   PACKAGE PANEL (7) (kept from 2026-11-27 05:28:33 UTC)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
COUNTS server tests 462; AML RECORD 7; MONITORING 8; PACKAGE CONSOLE 7; PACKAGE FLOW 10; PACKAGE INVITE 12; PACKAGE NAMES 4; PACKAGE PANEL 7
GATE_EXIT=0
```

Every "kept" step passed under exactly this HEAD and tree, in run 2 or run 3 (gate-lib's key). The verify's other conditions, each checked: `# tests 462` and `# fail 0` from the whole suite ($O/server3.txt); `GATE ok   server tests 462 (found 462)`; `COUNTS server tests 462;`; `phase-8 gate checks found (7)` (base 6 + 1); `MONITORING (8)`; server/index.mjs numstat over 8eff49a..HEAD `4 1`; the file list (this summary filtered out, B2) is exactly the five planned files; no added line in assets/ or server/ holds the word plan-check I-1 bans.

**COUNTS: base 456 + own 6 = 462.** Gate run with P8_SERVER_TESTS=462 (GATE_SERVER_TESTS from here: 462 on this branch).

## Taxpayer-number scan (plan-check W3)

The alert part walks a package investor with Lib.walk, which types phase 6's number. The part checks that the number is in no world record, no server output (event log and everything the process printed) and no file it writes. Each scan is first shown finding a planted copy. All passed in every run (e.g. $O/full3.txt). After the gate, $O/tin-scan.sh (output in $O/tin-scan.out) repeated the check over the output folder:

```
TIN SCAN: the planted copy is found
TIN SCAN: files holding the nine digits only inside a longer number: 4
TIN SCAN: PASS (none of the 75 .txt files in O and none of the 789 files under O/checks-out hold the number)
```

The 4 files hold phase 6's foreign tax ID fixture 12345678901, which forms-flow.js prints. It contains the nine digits but is not the number. No file held the dashed form either.

## What was built

- **server/lib/changed.mjs** `changedChecks(store, url, auth, now)` answers GET /v1/checks/changed.
  - A sponsor account sees its own workspace whatever the query says, for any auth shape that carries `account` (W4, 15-01's session shape included). The shared token needs `workspace` or gets 400. An invitation's token gets 401, because it is not an investor path.
  - It lists both tables, never a pending record, records changed after `since`, oldest first, at most 500.
  - Each item holds `id, table, investorId, kind, status, hits, screening, monitoring, changedAt`. Hits are stripped to `list, listed, score, detail`: the name screened never leaves.
  - `now` is the time to ask from next (the reply's time minus 1 ms). When the list is cut, it is just before the last listed change.
- **server/index.mjs** gets exactly four lines (numstat `4 1`):
  - the import;
  - `changedAt` in `apply`, set when the status, hits or screening written differ from the record's;
  - the route line below the `/v1/billing` hook;
  - the screening reply with `monitoring: !!r.monitoring` (one changed line).
- **assets/js/integrations.js**:
  - `resume` (the sponsor's console only, never on an invitation's device) clears a monitored investor's calendar date (`settleMonitored`, no connection). Then `ongoing` runs at console load and at most every ten minutes, one run at a time, only for a server confirmed with "Check connection". It does two things:
    - `pullChanged`: asks from `server.pulledAt` (the beginning of time on the first pull or after a change of server) and pages past 500. A change is matched by its ref and applied only toward a hold, and only to a result that had come back clear or passed. A person's decision made after the change stands. Then refreshAml, syncKyc and decide run, with one "Monitoring alert" per investor newly held.
    - `autoRescreen` (C-06): only when the firm's screening uses the free Treasury connection. Each due investor is re-screened through that connection alone (`rescreenWith`), keeping other results as they were, once per due date (`autoFor` is written before the call), with one entry "Re-screened automatically". The sponsor's own connector and team screening never run by themselves.
  - Monitoring and due dates: `screenWith` and `poll` keep `monitoring`. `screen` sets no next date when every result is monitored. `due` leaves monitored investors out.
  - "Run now" (G4): `rescreenDue` and the attention line re-screen an investor screened through the package (`package-id`/`package-acc`) through the free Treasury connection only, or leave them out when the firm has none. "Run now" waits for a running pass.
  - "Check connection" records the address it confirmed (`server.confirmed`).
- **server/test/changed.test.mjs**: 6 top-level tests (tracer, who, rules, private, reply, verifications), all passing.
- **checks/monitoring.js** (GATE CHECK MONITORING, 8 parts): alert, hold-only, monitored-not-due, package-not-run, auto-free, once, preview-desktop, preview-phone. It wraps world.js (not edited) with stand-in Treasury lists, signs alerts as idcheck.test.mjs does, confirms the server the way the sponsor does, and proves that an address only saved is asked nothing.

## Deviations from the plan

1. **[Rule 1, bug] Pulls only from a confirmed server (68e510d).** Without this, HELP CHAT fails. The plan said "with a server connected". It now means a server the sponsor confirmed with "Check connection". A sponsor who saved an address and never pressed "Check connection" gets no alerts in the console until they do. The open items list this.
2. **[Rule 1] Only finished results are held by a pull.** A screening still pending locally, or an identity check not yet passed, is left to `poll` (one "Monitoring alert" per real alert, not per first result). The pull also pages past 500, and the beginning of time is used again after a change of server address. All in integrations.js.
3. **[Rule 2] A failed unattended run is not retried for the same due date** (no loop, T-08-25), and it writes nothing (no error text). Covered by part once.
4. **[Rule 2] `settleMonitored`:** an import (invitations.js `capRescreen`, not this plan's file) gives a monitored investor a date, so the console clears it when it loads. Otherwise the AML/KYC page would show "Re-screening due".
5. **Task boundaries.** Because of the save rules, the code went in through wip save commits, followed by three empty marker commits (bf67785, e6d9332, 04b0243) that carry the trailers and say which save commits hold each task. Tasks 1 and 2 were verified with verify-1.sh and verify-2.sh run in `git archive` copies of their commits (307c99d, 4ca1857), because the worktree had already moved on. RED runs also used archive copies, so code written meanwhile could not leak into them.
6. **verify-3 on a resume.** See "Failures first" item 5. The B1 and B2 additions were applied. `--first-parent` (W2) was not needed: nothing was merged into this branch.
7. **Owner's screens:** $O/owner-shots holds the screens from the full MONITORING run on 00d71df ($O/full3.txt, the same code as the gate's tree), renamed from shots-full instead of a second identical run. Its index.txt still names the old folder name in its header.

## Known stubs

None. No placeholder data flows to a screen.

## Threat flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new read endpoint | server/index.mjs, server/lib/changed.mjs | GET /v1/checks/changed lists one workspace's check results (T-08-23 in the plan, mitigated: workspace from the account, shared token must name one, invitation token refused, no personal details; tests "changed who:" and "changed private:") |

## Open items (for the orchestrator and the owner)

- **Owner's check (not done; nothing is called finished before it).** In the published preview on the iPhone, open Console, Overview, then AML/KYC. Both pages should look as before, nothing should run by itself, and no error text should appear. When an investor is due, "Run now" still re-screens. preview-phone proves this at 390x844 with touch. The alert itself needs a connected portal (08-12).
- **08-12:** show a real monitoring alert reaching the server. Also confirm the provider really monitors the names (idcheck.mjs `ASSUMED`, the two monitoring switches), and the alert's body shape (`caption` as the listed name, `datasets` as the list). Alert hits arrive with no list name today, so the console shows the connection's name as the list.
- **Sponsors who never pressed "Check connection":** no pulls and no unattended Treasury re-screens until they do. A later plan could have the Integrations page check the server when its address is saved.
- **The KYC page's own buttons (console.js, not this plan's file):** "Re-screen" and "Re-screen N due" re-screen through every firm connection that is on, the sponsor's own paid connector included, for package investors too. They never reach the package provider, because the console never holds its connection. The G4 package rule covers "Run now" only.
- **The owner's Overview screenshot** (alert-overview.png) shows the top of the Overview. The attention line "1 investor held for review by automated verification" is below the fold. The check asserted its text, but the screenshot does not show it.
- **The queued small fixes** (contact line in integrations.js, then package-flow `refused`) can start now that 08-08 no longer holds integrations.js, once this branch merges.
- **Whichever of 08-08 and 15-01 merges second re-gates** (W4), and so does whichever of 08-08 and 08-09 merges second (W2: `--first-parent`, base counts measured from the main tip). Expected server tests after both 08-08 and 08-09: 468, plus whatever else merges.

## Self-Check: PASSED

- Files found: server/lib/changed.mjs, server/test/changed.test.mjs, checks/monitoring.js, server/index.mjs, assets/js/integrations.js.
- Commits found on this branch (8eff49a..HEAD, 15 before this summary's commit): 2b6943b, 307c99d, 9067e49, 36301b2, 4ca1857, 1eca29e, b38e188, a12b2b9, ca6f3ec, bf67785, e6d9332, 04b0243, 68e510d, 00d71df, bf3f016.
- Cleaned up after the gate: $O/base-tree, $O/checks-out, $O/shots, $O/owner, the extra check output folders and every archive copy are deleted; the server/node_modules link is removed from the worktree. Kept: the outputs listed above, verify scripts, $O/owner-shots.
- Not merged into claude/refract-reskin (as instructed). STATE.md and ROADMAP.md were not touched (not in this plan's files; the orchestrator records the merge).
