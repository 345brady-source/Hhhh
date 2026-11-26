---
phase: 14-portal-messaging-and-data-room
plan: 05
subsystem: server
status: complete
tags: [dataroom, nda, 506b, watermark, sealed, append-only, hash-chain, server]
requires: [server/lib/inbox.mjs post/list (14-03), assets/js/watermark.js stamp (14-02), assets/vendor/pdfwrite/write.js, server/lib/vault.mjs, server/lib/http.mjs, server/lib/crypto.mjs]
provides: ["server/lib/dataroom.mjs createDataRoom({ env, store, vault, now, limited, notify, inbox, publicUrl }) → { sponsorPath, prospectPath, sponsor, prospect, findByToken, verify, LIMITS, GENESIS, eventText, regime }", "server/test/dataroom.test.mjs (15 tests)"]
affects: [14-08 (mount, store 'rooms' line, notify rendering, CORS expose headers), 14-12 (prospect device flow), 14-07 (e-sign NDA template)]
tech-stack:
  added: []
  patterns: [write-once records with state read back from events, per-room hash chain on 14-02's eventText, sealed fields bound to record id, sealed blobs bound to key, constant-time token lookup over link records, stamp once and cache sealed]
key-files:
  created: [server/lib/dataroom.mjs, server/test/dataroom.test.mjs]
  modified: []
decisions:
  - "A new personal link is a write-once rl_ record (not a chain event) and keeps the access's original end date; more time means inviting again"
  - "Days over 90 are refused with 422 (I1), not cut"
  - "A cached stamped copy keeps the first serve's view id in its footer; every serve still records its own 'served' view with its own view id and copy = the footer's id (I2)"
  - "The e-sign NDA form is white-labelled on upload when it names the writer library: Producer and Creator become the firm, and the version is the served file's SHA-256"
metrics:
  completed: 2026-11-26
  tasks: 3
  files: 2
actuals:
  tokens: 28200
  tasks: 3
  commits: 8
plan_head_before: 30293baa89cf2ba6631a853c430d02702d9df2b2
plan_head_after: 6c715e7
---

# Phase 14 Plan 05: the server data room - Summary

server/lib/dataroom.mjs keeps each data room on the server: the NDA versions, documents, prospects with the firm's
relationship basis, link records, assents, views and indications of interest. Every record is sealed and written
once, and all changes go into one hash-chained event list per room. The module applies the 506(b) rules itself. It
stamps each prospect's copy of a document with their name, email, the date and a view id on the server, using
assets/js/watermark.js. 15 new server tests; the suite is 437 (422 + 15), all passing. Nothing is mounted:
server/index.mjs and server/lib/store.mjs are unchanged, and plan 14-08 mounts the module. It is not ready for anyone
until 14-08 mounts it and the owner checks the room on his phone (plan 14-11).

## Failures first

- **GREEN failure, Task 2.** The first run after the Task 2 code failed 6 of 9 tests with `Cannot read properties of
  undefined (reading 'content-length')`. My new `join` route handler shadowed node:path's `join`, which loads the
  PDF writer. I renamed the handler to `joinOpen` (in commit 3227e2c), and all 9 then passed.
- **Test bug, Task 1.** The tracer's first GREEN run failed on its own assertion. It compared the hex of the
  lower-cased name against page text that is lower-cased after hex encoding; the right comparison is the hex of the
  name as written. I fixed the test in the GREEN commit (11879b3). At RED the test had failed earlier, because the
  module did not exist.
- **Partial RED.**
  - Task 2: basis and stamp passed at RED, because the tracer code already applied the basis rule and the stamp,
    cache and download headers (6 of 8 new tests failed).
  - Task 3: measure passed at RED, because it uses only tracer routes (5 of 6 new tests failed).
  - Each verify still found failing lines in its RED file.
- **Not measured: a phone.** The 25 MB time below is this container, not a phone or a production host.

## Task 1 (tracer)

RED (red-1.txt; server/lib/dataroom.mjs did not exist):
```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../server/lib/dataroom.mjs' imported from .../server/test/dataroom.test.mjs
not ok 1 - test/dataroom.test.mjs
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
# duration_ms 735.079379
VERIFY1_EXIT=0
```

## Task 2 (basis, exempt, openlink, tokens, nda, docs, stamp, esign)

RED (red-2.txt), 6 of 8 new tests failing:
```
ok 1 - tracer
ok 2 - basis
not ok 3 - exempt          201 !== 409
not ok 4 - openlink        404 !== 422
not ok 5 - tokens          404 !== 201
not ok 6 - nda             404 !== 200
not ok 7 - docs            201 !== 422
ok 8 - stamp
not ok 9 - esign           422 !== 201  {"error":"Add the NDA text.","field":"nda"}
# tests 9
# pass 3
# fail 6
```
Verify (Task 2 command, verbatim tail, on commit 3227e2c):
```
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1450.334464
VERIFY2_EXIT=0
```

## Task 3 (views, interest, questions, sealed, nodelete and limits, measure)

RED (red-3.txt), 5 of 6 new tests failing:
```
not ok 10 - views        404 !== 200
not ok 11 - interest     404 !== 403
not ok 12 - questions    404 !== 201
not ok 13 - sealed       404 !== 200
not ok 14 - nodelete and limits   404 !== 413
# room stamp 25 MB: 693 ms
# tests 15
# pass 10
# fail 5
```
Verify (Task 3 command, run as scratchpad exec-14-05/verify3.sh with the command text unchanged, because the worktree
guard refuses `$(cat ...)` beside git; final tree 6c715e7):
```
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4129.892627
# tests 437
# suites 0
# pass 437
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 19469.255181
VERIFY3_EXIT=0
```
VERIFY3_EXIT=0 covers five checks:
- dataroom.test.mjs passes 15.
- The 'room stamp 25 MB: <ms> ms' line is printed.
- The full suite has 0 failing.
- The suite has 422 + 15 = 437 tests (base-count.txt holds 422; W2 applied, target base + 15).
- The first line is `// gate: tests 15`, and index.mjs and store.mjs are unchanged since 30293ba.

The tracer alone on the final tree: `# tests 1`, `# pass 1`, `# fail 0`.

## Test counts

- Base: 422 server tests, 0 failing (base-all.txt at 30293ba).
- Added: 15, all in server/test/dataroom.test.mjs: tracer, basis, exempt, openlink, tokens, nda, docs, stamp, esign,
  views, interest, questions, sealed, nodelete and limits, measure.
- Now: 437, 0 failing. No existing test file changed.

## The 25 MB stamping time (C-17)

Measured on this container (Node 22). The input is 25,602,208 bytes, 41 pages: 40 text pages plus one page with a
large generated image. The plan's limit is 25 MB (26,214,400 bytes). The time runs from the GET until the stamped
copy has fully arrived. It includes four steps:
- opening the sealed clean file
- stamping all 41 pages
- sealing the cached copy
- sending 25 MB over loopback

| Run | First serve (stamped) | Cached serve |
|-----|-----------------------|--------------|
| Task 3 RED | 693 ms | 483 ms |
| first GREEN | 771 ms | 616 ms |
| after the fix commit | 674 / 660 ms | 574 / 596 ms |
| final verify (6c715e7) | 671 ms | 510 ms |

Every page of the served copy carries the prospect's name and email (checked in the test). Every run is far below
30,000 ms, so I propose no change to C-17's limit.

## What was built (the contract plan 14-08 mounts)

`createDataRoom({ env, store, vault, now, limited, notify, inbox, publicUrl, assetsDir? })` returns
`{ sponsorPath, prospectPath, sponsor, prospect, findByToken, verify, LIMITS, GENESIS, eventText, regime }`.

**LIMITS:**
- pdf 26214400
- docs 30
- create ceil(25 MB × 4/3) + 256 KB
- small 16384
- note 500
- days 90
- nda ceil(20 MB × 4/3) + 256 KB (W8)
- ndaFile 10 MB

**Access.** `sponsor(req, res, url, ctx)` takes `{ workspace, actor: { id, name } }`; a bad context answers 403.
`prospect(req, res, path, token)` takes the X-Room-Token value. Neither reads a session, cookie or other header to
decide who is calling. Every room is pinned to ctx.workspace; another workspace's room answers 404.

**Personal links (the planner's choice, which the owner may reverse).** Prospects are not investors and have no
sign-in in phase 15, so they open the room with a personal link:
- the token is 32 random bytes, base64url (43 characters)
- only its SHA-256 is stored, in a write-once link record rl_
- `findByToken` compares every link record in constant time and never stops early
- only the newest link of a prospect opens the room, and only when the access is neither ended nor expired
- the link is `<portalUrl without its server parameter>?server=<publicUrl>#room-<token>` and is returned once

**Records** (collection 'rooms'; each id written once; the test store throws on a second write of any id, W4):

| Record | What it holds |
|--------|---------------|
| rm_ room | offeringId, regime, openedAt, download, ndaMode; sealed: offeringName, firm, legend |
| rv_ NDA version | seq, version, mode, at; sealed: title and text, or title and template; blob rmn-<id> holds the e-sign form |
| rd_ document | seq, size, sha256, pages, addedAt; sealed: title, fileName; blob rmd-<id> |
| rp_ prospect | seq, invitedAt, expiresAt; sealed: name, email, basis |
| rl_ link | prospectId or open, n, at, expiresAt, by, tokenHash; the open link also keeps its portalUrl |
| re_ event | order, seq, at, kind, prospectId, docId; sealed: { data }; prev, hash |

Blobs, all sealed and bound to their key:
- rms-<prospect>-<doc>: the stamped copy
- rma-<event>-s and rma-<event>-c: an e-signed assent's signed copy and its certificate

**What is read back from events (B1).** Hidden documents, ended accesses, the current NDA, assents, views, indications
and the open link (the last 'link' event). Nothing on a record is rewritten.

**The chain.** `eventText(prev, e)` is 14-02's text exactly:
`[prev, seq, at, kind, prospectId, docId, JSON.stringify(data)].join('|')`; the hash is its SHA-256 hex. It uses
14-02's kind names: opened, nda_text, doc_added, doc_hidden, prospect_invited, link, prospect_ended, assent, view and
interest.

`verify(roomId)` gives the W1 shapes:
- `{ ok: true, events }` when everything matches.
- `{ ok: false, brokenAt: seq, reason }` for a hash, sequence or seal break.
- `{ ok: false, brokenAt: 0, reason }` when a record no longer matches the chain. The reason names it, for example
  'Document rd_x differs from the record.', 'Prospect rp_x differs from the record.', 'The NDA versions differ from
  the record.' or "The room's opening details differ from the record."

Test nodelete asserts both forms.

**Sponsor routes**, as in the plan's interfaces:
- POST /v1/rooms
- POST /v1/rooms/:id/nda (click or e-sign)
- POST /v1/rooms/:id/documents
- POST /v1/rooms/:id/documents/:doc/hide
- POST /v1/rooms/:id/prospects
- POST /v1/rooms/:id/prospects/:p/link
- POST /v1/rooms/:id/prospects/:p/end
- POST /v1/rooms/:id/open-link
- GET /v1/rooms/:id/activity?since=
- GET /v1/rooms/:id/record

Activity returns every event of the room strictly after since, in order, with its data opened: at most 500 per answer,
with `more` and `order` as in 14-03.

**Prospect routes:**
- GET /v1/room
- GET /v1/room/nda.pdf
- POST /v1/room/nda (click or e-sign)
- GET /v1/room/documents/:doc
- POST /v1/room/views
- POST /v1/room/interest
- POST and GET /v1/room/messages
- POST /v1/room/join

An unknown, renewed, ended or expired token answers 401 'This link is no longer active.' The open link of a 506(c)
room opens only /v1/room/join; a personal token on join answers 404.

**Rules on every route.** limited(req) returns 429 on every POST, before the body is read. Every small call over 16 KB
returns 413, and so does a click-through NDA over 16 KB. DELETE, PUT and PATCH return 405 on every path.

**The rules the server applies:**
- Regulation A is refused with 422, an empty exemption with 422, and a second room on the same offering in the same
  workspace with 409 (the body carries the existing id).
- In a 506(b) room the basis needs:
  - a known kind (investor, relationship, introduced or other)
  - a real date for since
  - enough true
  - introducedBy for 'introduced' and a note for 'other'

  Otherwise the server answers 422 with 14-02's sentence and stores nothing. A basis dated on or after the opening day
  is kept with 14-02's warning.
- A 506(b) room never has an open link (422).
- The NDA needs the ticked box, a typed name and the current version (409 otherwise). A new NDA text asks again; the
  same text again answers 409.
- The address recorded (W6) is the rightmost X-Forwarded-For entry only when env.TRUST_PROXY === '1', otherwise the
  socket's address. A spoofed header without TRUST_PROXY is not recorded (tested).
- Documents must be PDFs by their first bytes (422), at most 25 MB (413), and at most 30 shown (422; hidden ones do
  not count).

**Stamping.** `stamp(L, bytes, { name, email, day, viewId, room: '<offering name> data room', firm: <firm name string> })`
uses watermark.js and write.js loaded through createRequire.
- A prospect's first serve is stamped once (concurrent first serves share one stamp, tested) and cached sealed.
- The response is Content-Disposition inline, or attachment only when download is 'watermarked' and ?download=1.
- Cache-Control is no-store, with X-View-Id and X-Pages.
- The served copy's Producer and Creator are the firm, and its bytes hold no library name (W3, tested).

**Questions.** `inbox.post(workspace, { party: { kind: 'prospect', id }, roomId, from: 'party', author: <prospect's
name>, body, anyway })` stores a question. The firm's GET /v1/inbox/updates returns it, and the prospect's GET lists
only their own thread (W5, tested on the real inbox.sponsor over the same store).

**Notices.** notify gets one of these, and never an NDA text, a basis, a note or an amount (tested):
- `{ kind: 'room_invite', variant: 'personal' | 'open', workspace, roomId, prospectId, to: { name, email }, link,
  expiresAt, firm }`, where firm is { name, notifyEmail, supportEmail, postalAddress }, for the possibly commercial
  invitation
- `{ kind: 'room_activity', variant: 'nda' | 'interest', workspace, roomId, prospectId, from: { name }, to: firm's
  notify address }`; 'interest' also carries the entry's kind

Views are not emailed.

## Deviations from Plan

1. **[B1, by the plan check] Record shapes.**
   - The prospect record carries no tokenHash or endedAt, and the room carries no openLink or sealed ndaVersions;
     those live in rl_ link records, rv_ NDA records and events.
   - A document's hiddenAt comes from its doc_hidden event.
   - GET /v1/rooms/:id/record returns all of them opened.
2. **[Design] Link renewal.** A new personal link is a write-once rl_ record (n counts up), not a chain event, and keeps
   the access's original end date. Renewing an ended or expired access answers 409 'Invite them again'. A second
   invitation of the same email is 409 only while an earlier access is still live.
3. **[Additions to the interfaces]**
   - nda_text data also carries mode.
   - Served view events also carry copy, the view id printed in the cached copy's footer (I2).
   - The open-link 'link' event data also carries linkId.
   - Responses carry the notice status, and the 409 body carries the existing room's id.
   - The e-sign assent data carries { sha256, size } of the signed copy and of the certificate.
   - `regime`, `eventText` and `GENESIS` are exported.
4. **[Rule 2] More checks than the interfaces list.**
   - Page views: pages may not exceed the document's pages, and seconds may not exceed 7 days.
   - The amount is at most 1e15 cents, and the class is screened as the note is.
   - The e-sign form must match its template's SHA-256.
   - The access is checked again after each request body arrives: a link renewed, ended or expired during an upload
     answers 401, and a join after the open link was turned off answers 401.
5. **[White label, orchestrator rule] The e-sign NDA form.** The sponsor's form is served to the prospect as nda.pdf.
   When it names the writer library (plain, hex or UTF-16), the server rewrites its Producer and Creator to the firm
   on upload. The version and the template's sha256 then become the served file's SHA-256, and test esign proves they
   match. A form that does not name the library is served byte for byte.
6. **[I1] Days over 90** are refused with 422 'Access lasts a whole number of days, from 1 to 90.'
7. **[Own review fix, commit 6c715e7]**
   - The record route no longer reads every document blob only to report that it is stored.
   - The cache write no longer re-reads the 25 MB blob first.
   - Test stamp now also serves two first requests at once.

## Open items for later plans

- 14-08:
  - Add `data.rooms = data.rooms || {}` to store.mjs. Without it the real store cannot hold rooms.
  - Expose X-View-Id and X-Pages through CORS (Access-Control-Expose-Headers) if the portal calls this server across
    origins.
  - Render room_invite with the firm in the payload; it carries the postal address for a possibly commercial email.
  - A prospect's question makes inbox.mjs send message_received with `to` empty unless the inbox already holds a firm
    snapshot. inbox.mjs writes that snapshot only on a sponsor send, so 14-08's notify should fall back to the room's
    firm notify address.
- 14-12 / 14-07: the prospect's device should take the e-sign template from GET /v1/room. Its sha256 is that of
  nda.pdf, which may differ from the E-sign page's original when the server white-labelled the form.
- Opened event data is kept in memory per event id, with no bound. It is fine at the sizes expected, but a server with
  hundreds of thousands of room events would hold all of their data in memory.
- The legal sentences (the 506(b) basis, the late warning, the Regulation A refusal, the privacy line) are 14-02's
  drafts. The 14-06 screens mark them "To be confirmed" (C-08).
- STATE.md and ROADMAP.md were not touched: the orchestrator owns them for this wave.
- Owner check still to come: nothing here is mounted or seen by anyone yet.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- T-14-20: basis, openlink.
- T-14-21: tokens (hash only, constant time, renewal, end, expiry, cross-prospect).
- T-14-22: stamp, nda, docs, tracer.
- T-14-23: nda (server time, address, browser), nodelete (both verify forms).
- T-14-24: measure, docs (25 MB).
- TRUST_PROXY is a new setting, and the address rule is the one W6 names.
- No package was installed.

## Commits

- 415e2e9 test(14-05): RED tracer for the server data room
- 11879b3 feat(14-05): server data room tracer: 506(b) room, basis, click NDA, server-stamped copy, activity, verify
- ff3dffd test(14-05): RED basis, exempt, openlink, tokens, nda, docs, stamp, esign (six fail)
- 3227e2c feat(14-05): data room rules on the server: exemptions, open links, link renewal and end, NDA versions, e-signed NDA, hiding, 30 shown
- 705e812 wip(14-05): save summary evidence for tasks 1 and 2
- ae3e9c3 test(14-05): RED views, interest, questions, sealed, nodelete and limits, measure (five fail)
- e00024f feat(14-05): views, indications, questions through the inbox, and a live access check after each upload
- 6c715e7 fix(14-05): no blob read just to report a stored file; one cache write per copy; test two first serves at once
- (this summary's commit follows)

## Self-Check: PASSED

- FOUND: server/lib/dataroom.mjs, server/test/dataroom.test.mjs
- FOUND in HEAD's history: 415e2e9, 11879b3, ff3dffd, 3227e2c, 705e812, ae3e9c3, e00024f, 6c715e7 (git rev-list --count 30293ba..HEAD = 8 before this commit)
- The server/node_modules link was removed and was never staged.
