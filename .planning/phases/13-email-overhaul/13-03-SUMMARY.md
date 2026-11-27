---
phase: 13-email-overhaul
plan: 03
subsystem: server email
status: complete
tags: [email, white-label, sent-log, bounces, suppression, routes]
requires: [13-01, 13-02, 13-11, 15-05, 15-06]
provides: [per-workspace sender in createMailer, server/lib/maillog.mjs, POST /v1/mail/events, GET/PUT /v1/mail/sender, POST /v1/mail/sender/check, GET /v1/messages/log, note screen 422]
affects: [13-04, 13-07, 13-09, 13-10, 13-12, 15-14, 15-17, 14-08]
tech-stack:
  added: []
  patterns: [outbox records held until the sender is ready, sealed log with the link redacted, suppression lists keyed by a hash]
key-files:
  created: [server/lib/maillog.mjs, server/test/mail-sender.test.mjs, server/test/maillog.test.mjs, server/test/mail-events.test.mjs]
  modified: [server/lib/mail.mjs, server/lib/invitations.mjs, server/lib/store.mjs, server/lib/roles.mjs, server/index.mjs, server/README.md]
decisions:
  - "On a server with sponsor accounts (a signed-up firm has one too), a workspace's mail is held, never sent from MAIL_FROM, until its domain is Ready; single-sponsor servers keep MAIL_FROM; staff mail (workspace '') always uses MAIL_FROM"
  - "Delivery events have their own rate limit, MAIL_EVENTS_PER_MIN (default 600), because the provider sends one per message from a few addresses"
  - "A permanent bounce marks the invitation's emailStatus as bounced only for the investor's own messages (invitation, invitation_resent), not for the sponsor's notification"
metrics:
  completed: 2026-11-27
actuals:
  tokens: 25300
  tasks: 3
  commits: 6
plan_head_before: 8efaa5c226fcddb1b9f7d967db606852fe57467a
plan_head_after: 837988a
---

# Phase 13 Plan 03: send as the sponsor, sealed sent log, delivery events Summary

A sponsor's messages now leave from that sponsor's own ready domain. Until Check finds the domain ready, they are held and never sent from another domain. Every message leaves one sealed sent-log entry with the personal link replaced. Signed bounces and complaints from the provider update that entry and stop later mail. A note carrying a taxpayer number, a long number or a password is refused with 422.

All of this was proven against local stand-ins only. Nothing is live. Live sending waits for the owner's provider account at 13-10 and stays "To be confirmed". Nothing here is ready for the owner until he has checked it there.

## Failures and shortfalls first

- **TDD order broke in Task 2.** Task 1's code commit (2928661) already held the Task 2 behaviors: holding, release, suppression, attachments, the note screen and the sender routes. When the Task 2 tests ran against that code, all 6 passed at once, so there was no true RED before the code. To show that each test does catch its behavior, RED 2 was produced two ways:
  - against the base commit, where 5 of 6 fail and 'single sponsor' passes because it checks today's behavior is kept;
  - with each behavior removed from the plan's code, where each test fails alone.
- **One RED removal for 'refused' did nothing at first.** It changed the route's error branch in a way that still answered 401. It was replaced by two removals that work: the route answering 200, and no signature check in the adapter. With either one, 'refused' fails.
- **The tracer matches the bounce by our Message-ID, not the relay id.** The shared fake SMTP server answers "250 2.0.0 Queued", which carries no relay id. Matching by the relay id alone is proven in mail-events 'delivery'. That test uses a small relay stand-in that answers as the provider's relay does ("250 Ok 0100018c7f2a-relay-000000").
- **'single sponsor' tests the staff email through the mailer, not through a placed filing order.** It calls `mailer.send({ kind: 'filing_order', workspace: '' , ... })`, the same call lib/filings.mjs:197 makes.
- **Assumed until 13-10:** the relay's reply format and that its id equals the event's `mail.messageId`. The owner's account run confirms them.

## Evidence (as produced)

RED 1 (red-1.txt, the mail-events.test.mjs tracer before any code):
```
not ok 1 - tracer
  expected: 200
  actual: 404
# pass 0
# fail 1
```
Verify 1 (t1.txt): `# tests 1` `# pass 1` `# fail 0`; base-count.txt 567 (measured at 8efaa5c, `# tests 567 # pass 567 # fail 0`).

RED 2 (red-2.txt):
```
# RED 2 a: mail-sender.test.mjs against the base commit 8efaa5c (no 13-03 code)
not ok 1 - held
ok 2 - single sponsor            (today's behavior, kept)
not ok 3 - suppressed
not ok 4 - attachments
not ok 5 - note screen
not ok 6 - sender routes
# pass 1
# fail 5
# RED 2 b: each test against the plan's code with its behavior removed (each run: # pass 5, # fail 1)
without held (falls back to MAIL_FROM)          -> not ok 1 - held
without the single-sponsor rule (always held)  -> not ok 2 - single sponsor
without the suppression check                  -> not ok 3 - suppressed
without the attachments refusal                -> not ok 4 - attachments
without the note screen                        -> not ok 5 - note screen
without the workspace pin on the sender routes -> not ok 6 - sender routes
without the configure line for PUT             -> not ok 6 - sender routes
```
Verify 2 (t2.txt): `# tests 7` `# pass 7` `# fail 0`; marker `// gate: tests 6`.

RED 3 (red-3.txt):
```
# RED 3 a: maillog.test.mjs + mail-events.test.mjs against the base commit 8efaa5c
not ok 1 - tracer
not ok 2 - refused
not ok 3 - delivery
not ok 4 - transient
not ok 5 - unknown
not ok 2 - test/maillog.test.mjs      (lib/maillog.mjs does not exist)
# pass 0
# fail 6
# RED 3 b: behavior removed from the plan's code
text stored with the link        -> not ok tracer, not ok redacted
list ignores the workspace       -> not ok sealed, not ok workspace
MAIL_LOG_DAYS ignored            -> not ok retention
outbox not logged                -> not ok sealed, workspace, statuses
complaint not per workspace      -> not ok complaint
(error-branch change)            -> # fail 0  (did nothing, see failures above)
route answers 200 to a refusal   -> not ok refused
no signature check in adapter    -> not ok refused
delivered not recorded           -> not ok delivery
transient bounce suppresses      -> not ok transient
unmatched event changes an entry -> not ok unknown
```
Full suite on this tree (suite.txt): `# tests 584` `# pass 584` `# fail 0` (567 + 17).

Verify 3 and gate: `GATE13_PHASES="08 09 10" GATE_OUT=SCRATCH/exec-13-03 bash .planning/phases/13-email-overhaul/checks/gate13.sh`. The verify starts with `rm -f $O/gate.txt;` and checks `[ -f $G ] || exit 1`. It has 65 GATE ok lines and 0 GATE FAIL. Its last lines, verbatim:
```
GATE ok   server tests 584 = base 567 + 17 declared
GATE ok   AML RECORD (7)
GATE ok   MONITORING (9)
GATE ok   PACKAGE CONSOLE (7)
GATE ok   PACKAGE FLOW (10)
GATE ok   PACKAGE INVITE (12)
GATE ok   PACKAGE NAMES (4)
GATE ok   PACKAGE PANEL (7)
GATE ok   REVERIFY (9)
GATE ok   SMALL FIXES (2)
GATE ok   ACCESS FLOW
GATE ok   BLUESKY FLOW
GATE ok   BLUESKY MATH
GATE ok   FILINGS FLOW
GATE ok   FILINGS MATH
GATE ok   FILINGS SERVER
GATE ok   FORMD FLOW
GATE ok   FORMD XML
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAX1099 FLOW
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE ok   TAXLINK FLOW
GATE ok   TAXRECORD FLOW
GATE ok   WITHHOLDING FLOW
GATE ok   phase 13 checks: none in this tree
GATE_EXIT=0
```
It also has `GATE ok   SERVER MODE (15)`, `GATE ok   CO-INVESTOR SERVER (5)`, `GATE ok   EMAIL DIALOG (3)` and `GATE ok   PRESS AND CO-INVESTOR (10)`. **GATE_EXIT=0** on the first run. "phase 13 checks: none in this tree" is expected and is not a gap: at 8efaa5c the folder .planning/phases/13-email-overhaul/checks/ holds only gate13.sh. 13-03 is server-only, and none of its files is a check. The first phase 13 .js checks come with 13-05, 13-06, 13-07, 13-08, 13-09, 13-10 and 13-12, and gate13 picks them up by their markers once they are in the tree. No assets/js file and no page changed (`git diff --quiet 8efaa5c HEAD -- assets/js diy.html portal.html index.html`).

## Tests: +17 (567 -> 584)

- mail-events.test.mjs (5): tracer, refused, delivery, transient, unknown.
- mail-sender.test.mjs (6): held, single sponsor, suppressed, attachments, note screen, sender routes. 'sender routes' includes the 403 for PUT by a signed-in 'team' person (wave 2 B1).
- maillog.test.mjs (6): sealed, redacted, workspace, retention, statuses, complaint.
- No existing test file changed. Note fixtures come from never-issued ranges: '000-12-3456', '991234567890', 'password: x' (B2). No whole-text word scan runs over random content: the vendor scan cuts the DKIM key out first; secret checks use exact strings.

## Interfaces later plans use

**createMailer** (server/lib/mail.mjs)
- Signature: `createMailer({ env, store, vault, now, tls, senders, log })` → `{ configured, send, outbox, purge, release }`.
- `send(m)`: m is `{ kind, invitationId, refId, investorId, workspace, fromName, replyTo, to, toName, subject, text, html, inline, headers, link, optional, commercial, attachments }`. It returns `{ emailStatus: 'sent'|'outbox'|'held'|'failed'|'suppressed', error?, logId? }`; logId is there only when a log is given.
  - Attachments, if any, give `failed` with 'Emails never carry attachments.'.
  - At most one inline part is kept (the logo image).
  - `headers` are passed into the message as they are; 13-04 adds List-Unsubscribe here.
- `release(workspace)` → `{ released, failed, suppressed }`.
- `outbox()` entries carry `held: true` for held ones.
- Also exported: `MAIL_SAYS` (notReady, attachments, bounced, complained), `relayIdOf(response)`, `newMessageId(domain)`. `buildMessage` takes a `messageId`.
- `invitationMessage` and the other builders now also return `commercial`.

**createMailLog** (server/lib/maillog.mjs)
- Signature: `createMailLog({ store, vault, env, now })` → `{ add, update, event, list, suppressed, optionalOff, purge }`.
- `add({...})` → id `mlg_…`.
- `update(id, { status, messageId, relayId, error })`.
- `event({ relayId, messageId, type, permanent, at })` → the entry, or null.
- `list(ws, { investorId, refId, limit })` → `{ id, at, kind, refId, investorId, status, events, to, subject, text }`, newest first. The refId filter is for 13-07, as wave 3 W3 asks.
- `suppressed(address)`, `optionalOff(ws, address)`, `purge(nowMs)`.
- Also exported: `LOG_STATUSES` (sent, outbox, held, failed, suppressed, unsubscribed, delivered, bounced, complained; 'unsubscribed' included per wave 3 W4), `emailHash`, `redactText(text, link)` (also redacts any URL with an #invite-/#taxdoc-/#room-/#signin- fragment or a token= style query), `logDays(env)`.

**Store collections:** `senders`, `maillog`, `mailsuppress`, `mailprefs` (mailprefs is empty, for 13-04).
- A bounce is stored at id = emailHash, `{ reason: 'bounced', at }`.
- A complaint is stored at id `c:<workspace>:<hash>`, `{ reason: 'complained', workspace, emailHash, optionalOff: true, at }`.

**Server:**
- `createServer(opts.mailCtx)` is the adapter context: transport, resolver, fetchCert, keys.
- `server.invitations.senders` and `server.invitations.mailLog`.
- `invitations.purge()` also returns `maillog`.
- An invitation's emailStatus can now be `held`, `suppressed` or `bounced`. A released message sets `sent`. A sponsor notification sets notifyStatus and a reminder sets reminderStatus.

**Routes and ROUTES lines** (server/lib/roles.mjs):

| Route | Permission | Answer |
|---|---|---|
| `GET /v1/mail/sender` | 'view', tokens true | `{ address, domain, status, detail, records, live }` |
| `PUT /v1/mail/sender` | 'configure' | `{ address, domain, status, records, live }` |
| `POST /v1/mail/sender/check` | 'configure' | `{ status, detail, records, released, live }` |
| `GET /v1/messages/log` | 'personal' | `{ entries }` |
| `POST /v1/mail/events` | other(..., 'public', signature checked by the adapter) | `200 { received }` (events verified), 401 `{ error: 'Not authorized' }`, 400, 413 |

- `live` is `env.MAIL_LIVE === '1'`.
- The four sponsor routes are pinned to the account's or session's workspace. The shared token names the workspace.

**Note screen:** POST /v1/invitations with a note that screen() refuses answers `422 { error: <screen()'s sentence> }`, and nothing is stored or sent. 13-12 uses this (wave 3 B4). 15-05's `auth.can('spend')` check in invitations.mjs is kept (W2).

## Deviations from Plan

1. **[Process] TDD order.** See the failures above. RED 2 is shown against the base commit and by removing each behavior.
2. **[Rule 2] `delivered()` in mail.mjs keeps `commercial`.** This is a one-field change below the "firm's messages" line, so the complaint rule reaches invitations to new offerings. No wave-2 plan edits mail.mjs.
3. **[Rule 2] maillog has `update()`, and `list()` takes refId.** update() serves held messages that are released later; the refId filter is for 13-07.
4. **[Rule 2] New setting MAIL_EVENTS_PER_MIN** (default 600) for the events route's own rate limit. It is in the README.
5. **[Rule 2] Redaction fallback for token links the caller does not name.** taxdocs.mjs passes no `link`, and 13-07 owns that file.
6. **[Rule 1] The bounce-to-invitation status applies to invitation kinds only.** A bounced sponsor address no longer marks the investor's email as bounced.
7. **`received` counts the verified events received, not the events matched.** An unknown event answers `{ received: 1 }` and changes nothing.
8. **The README section was found by grep at line 384 (W2).** The new subsection "Sending as each sponsor" lists:
   - every setting the plan names, plus MAIL_EVENTS_PER_MIN;
   - the routes and the events subscription;
   - what is stored sealed and for how long, and what is never stored;
   - "To be confirmed" for live sending.
9. **workspace.mjs was not touched.** 13-03 stores the server log in the store, not in the workspace, so SECTIONS does not need a mailLog line for this plan.

## Open items

- **SECTIONS has no line for the console's browser `mailLog` key** (emails.js log). PUT /v1/workspace will refuse it once 15-17 moves the console onto the workspace routes. This is for 14-08/15-17 (15-06 prints it as NOTE today).
- **Live sending, real bounces and the relay's reply format** wait for the owner's account at 13-10. `MAIL_LIVE=1` is set by the operator only.
- **The bounce and complaint lists use an unsalted SHA-256** of the lower-case address, as the plan says. It survives a DATA_KEY rotation, but someone holding the store can confirm a guessed address.
- **Held messages go out only when Check is called** (the console's setup screen, 13-12). Nothing re-checks on a timer.
- **13-04:** pass the List-Unsubscribe headers through (`m.headers` reaches buildMessage) and log 'unsubscribed'.
- **13-07:** pass `link` and `investorId` from taxdocs.mjs.
- **STATE.md and ROADMAP.md were not updated in this worktree.** The orchestrator updates them at merge.

## Self-Check: PASSED

- Files present: server/lib/maillog.mjs and the three test files. Each test file's marker is its first line.
- Commits present on wip/13-03: 294fdc5, 2928661, 059d1c5, 3ed55a1, f4e36c3, 837988a.
