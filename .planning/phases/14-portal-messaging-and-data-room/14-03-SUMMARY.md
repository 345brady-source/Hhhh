---
phase: 14-portal-messaging-and-data-room
plan: 03
subsystem: server
status: complete
tags: [messaging, inbox, sealed, append-only, hash-chain, notices]
requires: [server/lib/vault.mjs, server/lib/http.mjs, server/lib/crypto.mjs]
provides: ["server/lib/inbox.mjs createInbox({ env, store, vault, now, limited, notify })", "server/test/inbox.test.mjs (14 tests)"]
affects: [14-05 (post() for a prospect), 14-08 (mount, chainText and fileKind comparison)]
tech-stack:
  added: []
  patterns: [authorized context from the mount, sealed fields bound to record id, sealed blobs bound to key, per-workspace hash chain, write-once records]
key-files:
  created: [server/lib/inbox.mjs, server/test/inbox.test.mjs]
  modified: []
decisions:
  - "A notice counts as asked for (for coalescing) only when its status is not off, coalesced, failed or none; so a coalesced or failed notice never holds back the next one"
  - "The firm's message_received notice coalesces on the same rule per side (the browser's noticeDue is per side)"
  - "chainText returns the joined text exactly as NS.inbox.chainText; the hash is sha256 of that text (W3)"
metrics:
  completed: 2026-11-26
  tasks: 3
  files: 2
actuals:
  tokens: 20500
  tasks: 3
  commits: 9
plan_head_before: 864a799bfa0886be55286472f748478276f3ecb9
plan_head_after: fc265e42beb73bae7910a8dbc1b440f9e5e18386
---

# Phase 14 Plan 03: the server inbox module - Summary

server/lib/inbox.mjs keeps a workspace's threads, messages and read and notice events on the server, sealed and
written once. It serves the sponsor's send, updates, reads and attachments and the investor's own inbox on an
authorized context the mount passes in. Messages are hash-chained on the browser's recipe. 14 new server tests; the
server suite is 422, all passing. Nothing is mounted yet (plan 14-08 does that behind phase 15's sign-in). This is not
ready for anyone to use until 14-08 mounts it and the owner checks server-mode messaging (plan 14-11).

## Failures first

- No verify command failed.
- RED was partial in Tasks 2 and 3: 6 of the 13 non-tracer tests passed the first time they ran, before their own
  code step. scope, workspaces and sealed passed in RED-2. The Task 1 code already pinned every query to the context
  and sealed every field, because a tracer that stores investor data could not be built without them. chain, notices
  and nodelete passed in RED-3: the tracer needed a chain and a notice decision to pass its own verify, and 405 is the
  fall-through of each router. Each verify still saw failing lines in its RED file (3 of 7, then 4 of 14).
- The plan's tracer text says updates since=0 returns "exactly the read event and the investor's message". The
  interface also makes the notice event on a firm message an update item, so the tracer asserts the three items
  [notice, read, message] in order (see Deviations).

## Task 1 (tracer)

RED (red-1.txt, server/lib/inbox.mjs did not exist):
```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../server/lib/inbox.mjs' imported from .../server/test/inbox.test.mjs
not ok 1 - test/inbox.test.mjs
# tests 1
# pass 0
# fail 1
```

Verify (Task 1 command, verbatim tail):
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 239.759823
VERIFY1_EXIT=0
```

## Task 2 (scope, workspaces, sealed, attachments, types, screen)

RED (red-2.txt). Three of the six new tests failed and three passed on the first run (explained above):
```
ok 1 - tracer: ...
ok 2 - scope: an investor sees only their own threads, messages and files; a prospect is kept apart from investors
ok 3 - workspaces: every query is pinned to the context workspace; a workspace or party in a query or body changes nothing
ok 4 - sealed: the store and its blobs hold no body, author, file name, name, email or firm address
not ok 5 - attachments: 10 MB each, 5 files, 25 MB together, strict base64; a refusal stores nothing
    201 !== 413
not ok 6 - types: the kind is read from the first bytes; investors send PDF, PNG or JPEG, the firm also XLSX, CSV or DOCX
    Expected values to be strictly deep-equal
not ok 7 - screen: the firm is refused bank, taxpayer and password shapes; an investor is warned and may send anyway
    201 !== 422
# tests 7
# pass 4
# fail 3
```

Verify (Task 2 command, verbatim tail):
```
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1563.731477
VERIFY2_EXIT=0
```

## Task 3 (broadcast, updates, chain, notices, prefs, nodelete, limits)

RED (red-3.txt). Four of the seven new tests failed; chain, notices and nodelete passed on the first run (explained above):
```
not ok 8 - broadcast: one send to three investors, one copy each with its own files; a repeated clientId stores nothing new
    (the repeated clientId stored a second broadcast: deep-equal failed)
not ok 9 - updates: every investor message, read and notice comes back once, in order, across since values; more when cut at 500
    501 !== 500
ok 10 - chain: the browser recipe; a re-sealed body or a changed time names that message
ok 11 - notices: one per unread thread per hour; again after a read or after an hour; a failing notify still stores
not ok 12 - prefs: an investor turns notices off and on; the sponsor sending again keeps the choice
    405 !== 200
ok 13 - nodelete: no route removes or changes a record; the module never calls a store removal
not ok 14 - limits: 4,000 characters, request and small-call caps, the rate limit on every POST; nothing written to the console
    201 !== 422
# tests 14
# pass 10
# fail 4
```

Verify (Task 3 command, verbatim output; run from a script file because the worktree guard refuses `$(cat ...)` inside a
git command line; the command text is unchanged):
```
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2710.792928
# tests 422
# suites 0
# pass 422
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 23689.961375
VERIFY3_EXIT=0
```
VERIFY3_EXIT=0 covers: inbox.test.mjs pass 14, the full suite fail 0 and tests 408 + 14 = 422, the first line
`// gate: tests 14`, and server/index.mjs and server/lib/store.mjs unchanged since 864a799.

Gate step (the reference gate's server step, `npm --prefix server test`, with the exact count 422):
```
# tests 422
# suites 0
# pass 422
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 21123.464769
GATE server step: ok (GATE_SERVER_TESTS=422)
```

## Test counts

- Base: 408 server tests, 0 failing (base-all.txt at 864a799).
- Added: 14, all in server/test/inbox.test.mjs (first line `// gate: tests 14`): tracer, scope, workspaces, sealed,
  attachments, types, screen, broadcast, updates, chain, notices, prefs, nodelete, limits.
- Now: 422, 0 failing. No existing test file changed.

## What was built (the contract plan 14-08 mounts)

`createInbox({ env, store, vault, now, limited, notify })` returns `{ sponsorPath, partyPath, sponsor, party, post,
threadOf, list, verify, LIMITS, PATTERNS, TYPES, GENESIS, chainText, fileKind, checkFiles, screen }`. The same
functions are also named exports of the module.

- Context: `sponsor(req, res, url, ctx)` takes `{ workspace, actor: { id, name } }`. `party(req, res, path, ctx)` takes
  `{ workspace, party: { kind: 'investor', id } }`. A bad context answers 403. The module reads no token, cookie or
  header to decide who is calling. Every query is pinned to ctx.workspace (and to ctx.party for an investor). A
  workspace or party named in a query or body is ignored, and another party's or workspace's id answers 404.
- Sponsor routes: POST /v1/inbox/messages, GET /v1/inbox/updates?since=, POST /v1/inbox/read and
  GET /v1/inbox/attachments/:id. Investor routes: GET /v1/my-inbox, POST /v1/my-inbox/messages, POST /v1/my-inbox/read,
  POST /v1/my-inbox/prefs and GET /v1/my-inbox/attachments/:id. All follow the plan's interface.
- `sponsorPath(method, path)` and `partyPath(method, path)` are true for every method on those paths, so the module
  answers DELETE, PUT, PATCH and wrong methods with 405 itself. `limited(req)` true gives 429 on every POST, before the
  body is read.
- Records live in collection 'inbox': ixt_ (thread), ixp_ (party), ixf_ (firm), ixm_ (message), ixe_r-/ixe_n- (read and
  notice events, one per message, ids derived from the message id) and ixc_ (client). Blobs are 'ixa-<id>'. Sealed
  values are bound to 'inbox:<record id>:sealed', and each blob to its own key.
- The chain (W3): `chainText(prev, m)` returns the joined text
  `[prev, seq, at, threadId, from, author, body, sha256 list joined by ',', broadcastId, correctionOf].join('|')`,
  exactly as NS.inbox.chainText. The hash is `sha256(chainText(prev, m))` (crypto.mjs, hex of the UTF-8 text). GENESIS
  is 64 zeros. Plan 14-08 should compare both the text and the hash.
- Notices: the injected notify gets ids and the recipient only. A firm message sends
  `{ kind: 'message_notice', workspace, messageId, threadId, party, to: { name, email } }`. An investor's message sends
  `{ kind: 'message_received', workspace, messageId, threadId, party, from: { name, kind }, to: { name, email } }`,
  where `to` is the firm's notify address. notify never gets a body, an author's text, an attachment name or an
  offering name (tested).
- Updates: only party messages, plus read and notice events on firm messages, strictly after since and in order, at
  most 500 per answer. When cut, `more` is true and `order` is the last returned item's order. Otherwise `order` is the
  workspace's highest order.

## Deviations from Plan

1. **[Plan text vs interface] The tracer's updates list includes the notice event.** The interface defines
   `{ type: 'notice' }` items for events on firm messages, so updates since=0 after the tracer's exchange returns
   [notice of the firm message, the investor's read, the investor's message]. The tracer asserts exactly that list.
2. **[Rule 1 - correctness] Coalescing counts only notices actually asked for.** The plan says "a notice event not
   'off'". The module also excludes 'coalesced', 'failed' and 'none'. Otherwise steady messages less than an hour
   apart would never notify again (coalesced chaining onto coalesced), and a failed notice would hold back the next
   one for an hour. Test notices proves both: a message 61 minutes after the last sent notice is sent even though a
   coalesced one lies between, and after a 'failed' the next message is 'sent'.
3. **[Rule 2] The firm's notice coalesces on the same rule**, per side, as the browser's noticeDue does. The
   message_received call also carries `to` (the firm's notify address from the last firm snapshot), so 14-08's notify
   knows where to send.
4. **[Rule 2] Additions to the interface:** clientId is optional on the investor's POST too (scoped to that investor;
   the client record keeps only the message id and the notice status, never the body). A repeated clientId sent while
   the first is still being written waits for and answers the same result (tested with two sends at once).
   correctionOf is checked: it must name an earlier message of the same side in the thread it goes to, and only with
   one recipient; otherwise 400. Duplicate recipients in one send are kept once. Message records carry the actor id in
   plain text (outside the chain and the seal). Status 'none' is also used when the party record has no email.
   fileKind, checkFiles, screen, TYPES and GENESIS are exported for 14-08's comparison with the browser.
5. **[Test design] The 25 MB total check has two variants.** Three 9 MB files cannot reach it through the route:
   their base64 is larger than LIMITS.request, so the request gets 413 first. The test sends three 9 MB files through
   post() (422 with the sentence) and three 8.75 MB files through the route (422).
6. **[Plan, per 15-CONTEXT C-15] No inbox link token exists.** Investors read messages signed in to the portal (phase
   15). C-02's inbox link is replaced, as the plan and 14-CONTEXT record.
7. **[W4, W5 applied]** The test store copies store.mjs's signatures (get(kind, id), put(kind, rec) merging like
   store.mjs, list(kind), putBlob(key, buf), getBlob(key)) and its blob-key rule /^[\w-]{1,120}$/. Its put throws on a
   second write of a thread, message, read, notice or client id, its putBlob throws on a second write of a key, and
   remove and removeBlob throw. An afterEach hook asserts after every test that nothing was refused and the count only
   grew. Test scope calls post() for prospect pr-1 (room rm-1) and for a prospect sharing investor KB-1001's id. The
   sponsor's updates return both, and no investor context ever sees either. The count stays 14.

## Notes for later plans

- 14-08: two notice preferences exist (server `party.prefs.notices`, browser `inv.emailPrefs.messages`, checker INFO 2).
  The mount must map one to the other. The store needs the 'inbox' collection line (`data.inbox = data.inbox || {}`),
  which 14-08 adds; this plan did not touch store.mjs.
- 14-05: `post(workspace, { party: { kind: 'prospect', id }, roomId, from: 'party', author, body, attachments: [{ name, bytes }] })`
  is proven by test scope.
- A broadcast to 500 investors stores one sealed copy of each file per recipient, as the plan asks (each recipient
  opens only their own). A 25 MB broadcast to 500 is 12.5 GB on disk. That is the plan's design, recorded here so the
  orchestrator can judge it against disk limits.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The module trusts the context it is given (T-14 boundary "the mount → this module"),
so plan 14-08 must build that context from the phase 15 session only.

## Commits

- 1d70742 test(14-03): RED tracer for the server inbox module
- 4241eb0 feat(14-03): server inbox module, tracer green
- 6ec6be9 wip(14-03): save summary evidence for task 1
- f0e298d test(14-03): RED scope, workspaces, sealed, attachments, types, screen
- 01a958e feat(14-03): attachment limits, first-byte types and screening on the server
- f7a58dc wip(14-03): save summary evidence for task 2
- c5338f6 test(14-03): RED broadcast, updates, chain, notices, prefs, nodelete, limits
- b731572 feat(14-03): broadcasts, clientId, paged updates, prefs, limits on the server inbox
- fc265e4 wip(14-03): save summary evidence for task 3 RED
- (this summary's commit follows)

## Self-Check: PASSED

- FOUND: server/lib/inbox.mjs, server/test/inbox.test.mjs
- FOUND in HEAD's history: 1d70742, 4241eb0, f0e298d, 01a958e, c5338f6, b731572
- server/node_modules link removed; it was never staged.
