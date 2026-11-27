---
phase: 15-security
plan: 01
status: complete
owner_check: "pending (15-11); nothing here is called working before it"
subsystem: server sign-in
tags: [auth, sessions, scrypt, csrf, lockout]
requires: []
provides:
  - "server/lib/auth.mjs createAuth (the contract 15-04, 15-05, 15-06, 15-14, 15-15, 15-17 build on; as built below)"
  - "assets/vendor/pwlist/list.js (UMD, 9,126 entries)"
affects: [server/index.mjs sponsorAuth, admin(), route head, error handler]
tech-stack:
  added: []
  patterns: ["node:crypto only (scrypt, HKDF, HMAC, timingSafeEqual)", "e.body on thrown errors carries { error, code }"]
key-files:
  created: [server/lib/auth.mjs, server/test/auth.test.mjs, server/test/auth-gate.test.mjs, assets/vendor/pwlist/list.js, assets/vendor/pwlist/SOURCE.txt, assets/vendor/pwlist/SHA256SUMS, assets/vendor/pwlist/LICENSE]
  modified: [server/index.mjs]
decisions:
  - "Sign-out marks the session ended (endedAt); purge removes it a day later"
  - "One password check at a time per email: a second try sent at once answers 429 'Wait 1 second'"
  - "People indexed under DATA_KEY_PREVIOUS still sign in and are re-indexed under DATA_KEY"
  - "The email is sealed as typed (NFKC, trimmed); the index is of the lower-cased form"
metrics:
  completed: 2026-11-27
actuals:
  tokens: 16700      # chars/4 over auth.mjs, both tests, SOURCE.txt and the index.mjs diff; list.js is 124,683 bytes of data more
  tasks: 3
  commits: 8         # measured before this summary update: git rev-list --count a1338b4..a2be969
plan_head_before: a1338b462f5be391adca1a3056099d469a91dc2f
plan_head_after: a2be969 (the tree the gate passed on; this summary update is one more docs commit)
---

# Phase 15 Plan 01: the server's own sign-in (people, scrypt passwords, one session cookie, waits and locks, the open server closed)

## Failures first

1. **The first full-gate run failed because the machine ran out of disk, not because of the code. The reruns passed.**
   Task 3's gate (`GATE_OUT=SCRATCH/exec-15-01/gate bash gate13.sh`) first ran its reference part with the disk at 100%
   (`/dev/vda 252G 39G 34M 100% /`; 25 GB of it was other agents' scratch folders, which I did not touch). Every browser
   part failed because the browser itself died:
   `FAIL sign-w9 ran to the end :: page.screenshot: Target crashed`, `FAIL full ran to the end :: page.evaluate: Target crashed`,
   `page.goto: net::ERR_INSUFFICIENT_RESOURCES`, then `browser.newContext: Target page, context or browser has been closed`
   for every later case. The reference lines it printed:
   ```
   GATE ok   server tests # fail 0
   GATE ok   server tests 438
   GATE ok   STATUS MATH (13)
   GATE ok   FORM MAPS (3)
   GATE FAIL FORMS FLOW (34)
   GATE FAIL STATUS FLOW (26)
   GATE FAIL SERVER MODE (15)
   GATE FAIL TWO PERSONS
   GATE FAIL MEASURE
   GATE FAIL owner's folder: index.txt and four signed PDFs
   ```
   I stopped that run (every later browser step would have crashed the same way). Once there was disk again I reran Task 3's
   verify (`bash SCRATCH/exec-15-01/tools/verify3.sh`, the plan's verify with B2 applied) into the same folder, on tree
   a2be969. That run and the next one each hit the 2-hour background limit while waiting for the shared browser slots
   (heavy.sh; up to 30 minutes per step). Each rerun into the same folder kept the steps that had already passed. The
   third run finished:
   ```
   GATE ok   server tests 438 = base 422 + 16 declared
   ...
   GATE ok   phase 13 checks: none in this tree
   GATE_EXIT=0
   VERIFY3_EXIT=0
   ```
   That is 86 `GATE ok` lines and 0 `GATE FAIL` lines across the reference gate (FORMS FLOW (34), STATUS FLOW (26), SERVER
   MODE (15), TWO PERSONS, MEASURE, the owner's folder, EMAIL DIALOG, WAYS OUT, NO NETWORK, SAFARI FINISH, the signing and
   record base comparisons and the rest) and phases 08 to 12 (AML RECORD, PACKAGE *, FILINGS *, FORMD *, DIST *, TAX *,
   books, REPORTS *). Phase 13 has no checks in this tree. The browser steps that crashed in the first run all passed on
   the same code.
2. The plan's numbers that did not hold (measured, not failures of the code):
   - At the base, POST /v1/auth/signup answered **404**, not 401 (the open server reached the invitations module, which
     owns no such path).
   - On an open server GET /v1/invitations?workspace=x answers **400** ("Set API_TOKEN ...", the module's own rule), not 200.
     The "open server closes" test checks it is not 401 there and uses GET /v1/connectors (200) as the open call.
   - The list holds **9,126** entries, not 9,307: 9,307 is the count of lines of 10 or more **bytes**; 9,248 lines have 10
     or more characters; lower-cased and unique, 9,126.

## RED outputs (SCRATCH/exec-15-01)
- red-1.txt (Task 1, at a1338b4): `not ok 1 - sign-up to me` / `expected: 201` / `actual: 404` / `# pass 0` / `# fail 1`
- red-2.txt (Task 2): `ok 1 - sign-up to me`, `ok 2 - https cookie` (the cookie flags were built in Task 1),
  `not ok 3 - password rules`, `not ok 4 - sign-in stages`, `not ok 5 - choose firm`, `not ok 6 - lockout`,
  `not ok 7 - per address`, `not ok 8 - timeouts`, `not ok 9 - sealed and minimal`; `# tests 9` `# pass 2` `# fail 7`
- red-3.txt (Task 3): `not ok 1 - open server closes` (`expected: 401` `actual: 200`), `not ok 2 - session pin`,
  `not ok 3 - stage gates`, `not ok 4 - csrf`, `ok 5 - tokens unchanged`, `ok 6 - status`, `not ok 7 - operator`;
  `# tests 7` `# pass 2` `# fail 5`

## Verify lines
- Task 1 (t1.txt): `# tests 1` `# pass 1` `# fail 0`; verify exit 0.
- Task 2 (t2.txt): `# tests 9` `# suites 0` `# pass 9` `# fail 0`; `list.js: OK` `LICENSE: OK`; the list check
  (more than 9,000, all 10+ characters, holds 1234567890) and W2's `grep -q timingSafeEqual server/lib/auth.mjs` passed; exit 0.
- Full server suite (all.txt, before the gate): `# tests 438` `# pass 438` `# fail 0` `# duration_ms 32994.858935`
  = base 422 (measured at a1338b4: `# tests 422` `# pass 422` `# fail 0`) + 16.
- The diff check: http.mjs, store.mjs, accounts.mjs and README.md unchanged from a1338b4.
- Gate (gate.txt, third run on a2be969): `GATE ok   server tests 438 = base 422 + 16 declared`, 86 `GATE ok`, 0 `GATE FAIL`,
  last line `GATE_EXIT=0`; verify3.sh ended `VERIFY3_EXIT=0` (its own suite run: `# tests 438`, `# fail 0`).
- scrypt (N=2^15, r=8, p=3, 32 bytes): 260 ms for one check run alone on this machine. auth.test.mjs alone takes
  24 to 30 s (lockout 9.1 s, per address 9.0 s: those are real scrypt runs).

## Tests added: +16
- server/test/auth.test.mjs (`// gate: tests 9`): sign-up to me, https cookie, password rules, sign-in stages, choose firm,
  lockout, per address, timeouts, sealed and minimal.
- server/test/auth-gate.test.mjs (`// gate: tests 7`): open server closes, session pin, stage gates, csrf, tokens unchanged,
  status, operator.
- Plan-check additions applied: B2 (verify3.sh starts `rm -f $O/gate.txt;`, `|| exit 1;` before `mkdir -p $O/gate`);
  W1 (the JSON and Origin rule on every POST under /v1/auth/, cookie or not; csrf test: a text/plain sign-in from
  https://evil.example, a JSON one from it, one with no Origin, and a text/plain one from the own origin are each 403 with
  no Set-Cookie; a foreign text/plain sign-up too); W2 (timingSafeEqual on equal-length buffers, grepped); W3
  ('Wait 1 second and try again.' for 1, 'seconds' otherwise, both asserted); W4 (the setup-session-on-invitations
  assertion is in auth-gate "stage gates" only).

## Commits (wip/15-01)
- 5c71184 test(15-01): RED sign-up to me through the real server
- b29cc1f feat(15-01): server sign-up and me through index.mjs (tracer)
- b1a0505 test(15-01): RED sign-in, password rules, lockout, limits, timeouts, sealed
- af02eec feat(15-01): sign-in, sign-out, waits, locks, address limits, purge, common-password list
- 1e65c12 test(15-01): RED sessions at the sponsor gate
- aeb864d feat(15-01): sessions at the sponsor gate; the open server closes once anyone signs up
- e35811c wip(15-01): save summary draft before the gate
- a2be969 docs(15-01): summary, failures first (the tree the gate passed on)

## Interfaces as built (for 15-04, 15-05, 15-06, 15-14, 15-15, 15-17)
As in the plan's interfaces block, with these differences:
- `createAuth({ env, store, vault, now, clientOf, invites, audit, accounts })`: `accounts` (index.mjs passes its own) is
  used to make the workspace's account record; without it auth.mjs makes its own over the same store.
- `people.create(rec)` is **async** (it may hash): pass `password` (plain, hashed here) or `pw` (a hash record). Returns the
  stored record. `people.byEmail` matches the index under DATA_KEY and DATA_KEY_PREVIOUS.
- `sessions.clear()` gives the clearing Set-Cookie; `sessions.end(id)` sets `endedAt` (sessions carry `endedAt: ''`).
- `limits.keys()` (the counter's keys, for tests); `purge(nowMs)`; `cookieName`.
- `sponsor(req)` throws `{ status: 401, body: { error: 'Finish signing in first.', code: 'stage' } }` for a team session
  not at 'full'; `sessionOf` throws `{ status: 403, body: { error: 'This request was refused.' } }` for a cookie write
  that is not JSON from the own origin or a PORTAL_ORIGIN origin. index.mjs's error handler sends `e.body` when a thrown
  error has one.
- `fails` timestamps are milliseconds (numbers); `fails.hour` is cleared when a lock is set.
- Stage for an investor whose firm requires two-step (`workspace.investorTwoStep`, 15-04) but who has none yet: 'setup'.
- Sign-in with a missing or malformed field, or sign-up with a missing firm, name or email: 400 'Fill in every field.'
  (one sentence added; it names no vendor and not the forbidden word).
- GET /v1/admin/people answers a bare array (as the interface says), not `{ people: [...] }`.
- Unchanged and as specified: cookie names and flags, 43-character value, Max-Age 43200 / 0, the strict one-cookie
  parser, 60 min idle / 12 h absolute / 10 min half-done, 20 tries per 15 minutes per address (AUTH_SIGNIN_PER_15MIN),
  5 sign-ups per hour per address (counted once the fields are valid), AUTH_COUNTER_MAX default 10000, the
  1, 2, 4 ... 900 s waits after 5 wrong, the 15-minute lock after 10 wrong in an hour, the exact sentences.

## Deviations from Plan

### Auto-fixed / added (Rules 1-2)
1. [Rule 2 - Security] Unknown emails keep failure counts too (in the evicting counter, keyed by the email's HMAC), so an
   unknown email gets the same waits and lock answers as a known one; otherwise the 429 and 423 answers would tell
   which emails have accounts (T-15-02).
2. [Rule 2 - Security] One password check at a time per email: tries sent all at once could otherwise all be checked
   before the first failure is recorded, getting past the waits and the lock. The second answers 429 'Wait 1 second'
   (asserted in "choose firm").
3. [Rule 2 - Correctness] After DATA_KEY is replaced (old key as DATA_KEY_PREVIOUS) the HMAC email index would no longer
   match and nobody could sign in. byEmail also looks under the previous key and a successful sign-in re-indexes the
   person (asserted at the end of "sealed and minimal").
4. [Rule 2 - Security] A sign-in that carries a live cookie ends that session before issuing the new one (fixation).
5. [Rule 2] The stand-in hash is made on the first /v1/auth/ call, so the first unknown email costs one scrypt run, not two.
6. The email is sealed as typed (NFKC, trimmed) rather than lower-cased; only the index is lower-cased (found by the
   "operator" test, which lists the email back).

### Not done here (by the plan's own scope)
- STATE.md, ROADMAP.md and REQUIREMENTS.md not touched (AUTOPILOT.md: executors never touch them; the orchestrator merges).

## Open items for other plans
- **15-18 (http.mjs CORS):** when PORTAL_ORIGIN is set, `cors()` refuses any Origin not in that list with 403
  'Origin not allowed' before auth.mjs runs, so a portal served by this server itself (C-07, same origin) cannot sign in
  while PORTAL_ORIGIN is set. The server's own origin has to pass cors() too.
- **15-03 (reseal):** the email index is keyed from DATA_KEY. auth.mjs finds people under DATA_KEY_PREVIOUS and re-indexes
  them at sign-in, but a person who has not signed in before the previous key is dropped can no longer be found; the
  reseal tool should recompute `emailIndex` for every person (HKDF from DATA_KEY: salt 'cv-email-index', info 'v1',
  HMAC of `email:<lower-cased NFKC email>`).
- **15-14:** the workspace's `confirmedAt` stays '' until the confirmation email exists.
- ADMIN_TOKEN has no expiry (recorded open item, unchanged).

## Threat surface
New surface is the plan's own (T-15-01..08): /v1/auth/status, signup, signin, signout, me; POST /v1/invite/login (404
until 15-04); GET /v1/admin/people, POST /v1/admin/people/:id/unlock behind ADMIN_TOKEN. No other new surface.

## Known stubs
- POST /v1/invite/login answers 404 by design until 15-04 builds it.

## Nothing here is called working before the owner's check (15-11).

## Self-Check
- Files: server/lib/auth.mjs, server/test/auth.test.mjs, server/test/auth-gate.test.mjs, assets/vendor/pwlist/{list.js,
  SOURCE.txt, SHA256SUMS, LICENSE} exist; commits 5c71184, b29cc1f, b1a0505, af02eec, 1e65c12, aeb864d, e35811c, a2be969
  are on origin/wip/15-01.
- Self-Check: PASSED. The suite is base + 16, the full gate passed with every phase, and the owner's check (15-11) is still to come.
