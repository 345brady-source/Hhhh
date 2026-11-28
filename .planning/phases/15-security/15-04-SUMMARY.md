---
phase: 15-security
plan: 04
subsystem: server sign-in
status: complete
tags: [two-step, totp, recovery-codes, sessions, invite-login, SE-02, SE-03, SE-09]
dependency-graph:
  requires: ["15-01 (sign-in, sessions, people)", "15-02 (assets/js/totp.js)", "15-03 (DATA_KEY_PREVIOUS comma list)", "15-12 (server/lib/roles.mjs)"]
  provides:
    - "POST /v1/auth/two-step/start, /two-step/confirm, /code, /recovery-codes, /two-step/off, /firm/investor-two-step, /confirm-password, /sessions/end-others; GET /v1/auth/sessions"
    - "POST /v1/auth/people/:id/two-step/reset and the operator's POST /v1/admin/people/:id/two-step/reset"
    - "POST /v1/invite/login: the investor's own sign-in made from the invitation"
    - "GET /v1/auth/me adds permissions, recoveryLeft, firm.investorTwoStep, idleMinutes"
  affects: ["15-05 (merges beside it; the second of the two to merge reruns the suite on the merged tree, base + 23)", "15-07, 15-09, 15-14, 15-16 (screens and notices on these routes)", "14-08 (investor accounts from POST /v1/invite/login)"]
tech-stack:
  added: []
  patterns: ["deny by default: every /v1/auth/ path outside the sign-in steps needs a full session before its route runs"]
key-files:
  created: [server/test/auth-twostep.test.mjs, server/test/auth-account.test.mjs]
  modified: [server/lib/auth.mjs]
decisions:
  - "Every /v1/auth/ path except status, signup, signin, signout, me, two-step/start, two-step/confirm and code needs a full session before its route runs; an unknown /v1/auth/ path from a half-done sign-in answers 401 code 'stage'"
  - "A malformed code (neither 6 digits nor a recovery code) answers 400 with the code sentence and is not counted; a wrong code of the right form counts on a half-done sign-in only (5th ends it)"
  - "The code step keeps the password's time as authAt (fresh counts from the password); confirm sets authAt and mfaAt now and ends every session of the person, the current one included"
  - "POST /v1/invite/login answers 201 { stage }; people records carry invitationId, so one invitation makes at most one sign-in"
  - "Email lookup keys: DATA_KEY, then each comma entry of DATA_KEY_PREVIOUS, derived from the keys themselves (never vault.keyIds)"
metrics:
  duration: "about 3 h 45 min wall time (06:24 to 10:13 UTC), of which about 3 h 20 min was the gate (two runs)"
  completed: 2026-11-27
estimate:
  tokens: 105000
  tasks: 3
actuals:
  tokens: 16400
  tasks: 3
  commits: 9
plan_head_before: 4b0aec90882a5efd52320db8805448d1dc753784
plan_head_after: 20d9872
---

# Phase 15 Plan 04: two-step sign-in, recovery codes, POST /v1/invite/login Summary

Server-side two-step sign-in with authenticator-app codes (assets/js/totp.js with Node's HMAC-SHA-1), ten one-time
recovery codes kept only as SHA-256, resets by the firm and by the operator, investors' optional two-step with the
Owner's rule, the sessions list, sign-in that survives a DATA_KEY change with a comma list of previous keys, and the
investor's own sign-in made from the invitation token. Nothing is on screen yet: no page calls these routes (15-07 and
later plans build the screens). Nothing here is ready until the owner has checked it.

## Failures first

1. Gate run 1 was stopped at the 2-hour background limit (started 06:42, stopped 08:51 UTC) after 36 `GATE ok` lines and
   0 `GATE FAIL`; 15-05's gate was running beside it on the shared browser queue. Run 2 into the same folder kept every
   step that had passed and ended `GATE_EXIT=0` (10:12 UTC).
2. My own wrapper script (SCRATCH/exec-15-04/rungate.sh) had a syntax error on its last line after a sed edit (`>>>`),
   so the background job reported exit 2 after the gate had finished. The gate's own result is in gate.txt
   (`GATE_EXIT=0`); only my bookkeeping line was lost.
3. The run 1 kill left the gate's server/node_modules link in the tree (run 2 found it already there and left it); I
   removed it by hand. The gate removed its base tree, screenshots and checks-out folder itself.
4. In Task 3's RED, "secrets" passed already: its behaviour (sealed key, hashed recovery codes, label and issuer) was
   built with Task 1. The RED for Task 3 comes from the other four tests.
5. Not run here: WebKit (orchestrator decision; the TOTP FRAME check prints its NOTE and covers Chromium only).

## Task 1 (tracer): set up and sign in over HTTP
RED (red-1.txt, at 30c3582):
```
not ok 1 - set up and sign in
  expected: 200
  actual: 404
# tests 1
# pass 0
# fail 1
```
GREEN (t1.txt, at 6473bfe), plan verify exit 0:
```
# tests 1
# pass 1
# fail 0
```
Tracer gate: the verify re-run end to end passed; auth.test.mjs + auth-gate.test.mjs 16/16 still pass.

## Task 2: replay, wrong codes, recovery, side doors, investors
RED (red-2.txt, at 1706d91):
```
ok 1 - set up and sign in
not ok 2 - replay and window
  expected: 400
  actual: 401
not ok 3 - wrong codes
  expected: 'Too many wrong codes. Sign in again.'
  actual: 'That code is not right. Check the time on your phone and try the newest code.'
not ok 4 - recovery
  expected: 200
  actual: 401
not ok 5 - side doors
  expected: 401
  actual: 404
not ok 6 - investors
  expected: 401
  actual: 404
# tests 6
# pass 1
# fail 5
```
GREEN (t2.txt, at d7921d2), plan verify exit 0:
```
# tests 6
# pass 6
# fail 0
```

## Task 3: resets, sessions, secrets, key change, invite login
RED (red-3.txt, at ec9c31d):
```
not ok 1 - resets
  expected: 200
  actual: 404
not ok 2 - sessions
  expected: 200
  actual: 404
ok 3 - secrets
not ok 4 - key change
  expected: 200
  actual: 401
not ok 5 - invite login
  expected: 403
  actual: 404
# tests 5
# pass 1
# fail 4
```
GREEN, full server suite (all.txt, at 71716a2), plan verify run from a script file:
```
# tests 513
# suites 0
# pass 513
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 47546.356945
VERIFY3=0
```
513 = base 502 + 11. index.mjs, http.mjs, assets and the pages are unchanged against the start commit (part of VERIFY3).

## Gate (gate15.sh on 20d9872; GATE_OUT=SCRATCH/exec-15-04, base-commit.txt = 4b0aec90882a5efd52320db8805448d1dc753784, GATE_SERVER_TESTS=513, every phase 08 to 14)
101 `GATE ok`, 0 `GATE FAIL`. Lines from run 2 (gate.txt):
```
GATE ok   server tests # fail 0 (kept from 2026-11-27 06:42:46 UTC)
GATE ok   EMAIL DIALOG (3) (kept from 2026-11-27 07:23:13 UTC)
GATE ok   CO-INVESTOR SERVER (5) (kept from 2026-11-27 07:52:50 UTC)
GATE ok   server tests 513 = base 502 + 11 declared
...
GATE ok   phase 13 checks: none in this tree
GATE ok   DATAROOM MODEL
GATE ok   INBOX MODEL
GATE ok   WATERMARK
GATE ok   ROLES TABLE
GATE ok   TOTP FRAME
GATE_EXIT=0
```
GATE_EXIT=0

## Test counts
- Base (4b0aec9): 502 tests, 502 pass.
- Added: 11 (auth-twostep.test.mjs 6, auth-account.test.mjs 5; markers `// gate: tests 6` and `// gate: tests 5`).
- This tree: 513 tests, 513 pass, 0 fail. GATE_SERVER_TESTS=513.

## Routes and the stage rule as built (15-07, 15-09, 15-14, 15-16 rely on these)
All JSON, cookie sessions, 16 KB bodies, every POST under the JSON + own-Origin rule.
- Stages after the password: team with two-step 'code', without 'setup'; investor with two-step 'code'; investor
  without and the firm's rule on 'setup'; without and the rule off 'full'. Only confirm and code make a session 'full'
  for a console person.
- `POST /v1/auth/two-step/start` → `{ key, otpauth }` from 'setup', or from 'full' with a fresh sign-in (else 401
  `{ error: 'Enter your password again to do this.', code: 'fresh' }`). A new pending key each call, sealed with
  additional data `person:<id>:twoStepPending`, 10 minutes. Issuer: the workspace's name; label: the person's email.
- `POST /v1/auth/two-step/confirm { code }` → `{ recoveryCodes: [10] }` + Set-Cookie. From 'setup' or 'full'. A stale or
  missing pending key: 400 `{ error: <code sentence>, code: 'start' }`. Ends every session of the person and issues a
  new full one.
- `POST /v1/auth/code { code }` → `{ stage: 'full' }` (+ `recoveryLeft` after a recovery code) + Set-Cookie; 'code'
  sessions only. Malformed: 400, not counted. Wrong: 401 'That code is not right. Check the time on your phone and try
  the newest code.'; the 5th: 401 'Too many wrong codes. Sign in again.' and the session ends.
- `POST /v1/auth/recovery-codes { code }` → `{ recoveryCodes: [10] }`; a current app code only.
- `POST /v1/auth/two-step/off` → `{ ok: true }`; investors only (team: 403 'Two-step sign-in is required for everyone
  who uses the console.'), not while the firm requires it (403 'Your firm requires two-step sign-in.'), fresh sign-in;
  ends the person's other sessions.
- `POST /v1/auth/firm/investor-two-step { required }` → `{ required }`; `allows(role, 'account')` (else 403
  REFUSALS.account), fresh sign-in.
- `POST /v1/auth/confirm-password { password }` → `{ ok: true }`; sets authAt now; a wrong password counts towards the
  waits and the lock (401 'The email or password is not right.', 423, 429 as at sign-in).
- `GET /v1/auth/sessions` → `[{ handle, device, createdAt, seenAt, current }]` (live sessions, oldest first);
  `POST /v1/auth/sessions/end-others` → `{ ended: n }`.
- `POST /v1/auth/people/:id/two-step/reset` → `{ ok: true }`; same workspace (else 404); a team target needs
  `allows(role, 'team')` (403 REFUSALS.team) and the Owner's needs the Owner (403 'Only the Owner or the operator can
  reset the Owner’s two-step sign-in.'); an investor target needs 'operate'; fresh sign-in; clears two-step, pending and
  recovery codes; ends the target's sessions.
- `POST /v1/admin/people/:id/two-step/reset` (ADMIN_TOKEN) → `{ ok: true }`; any person.
- `POST /v1/invite/login { password }` + `X-Invite-Token` → 201 `{ stage }` + Set-Cookie. Order: JSON + own-Origin
  (403 'This request was refused.', no cookie), the address limit, `invites.authenticate` (its 401/410 sentences), the
  investor password rule (400 'Use at least 15 characters.' ...), the snapshot opened with additional data
  `<invitation id>:snapshot` (as invitations.mjs seals it); the person's email, name and investorId come from the
  snapshot's investor, `co` from `invitation.coSign`; a second sign-in for the invitation or for that email among the
  workspace's investors: 409 'You already have a sign-in for this portal. Sign in instead.'
- `GET /v1/auth/me` adds `permissions` (permissionsOf(role)), `recoveryLeft`, `firm: { investorTwoStep }`,
  `idleMinutes`.
- Change log actions: 'Two-step sign-in turned on', 'Two-step sign-in turned off', 'Recovery codes replaced',
  'Two-step sign-in reset', 'Investor two-step rule changed', 'Investor sign-in created'.

## Deviations from Plan

1. [Rule 2 - Security] Deny by default on /v1/auth/: any path outside the sign-in steps needs a full session before its
   route runs (Pitfall 1), so a route added later cannot answer a half-done sign-in by mistake. Files: server/lib/auth.mjs.
   Commit d7921d2.
2. [Rule 2 - Security] Wrong codes at confirm count on a half-done sign-in like the code step; confirm ends every
   session of the person; two-step/off ends the person's other sessions. Commits 6473bfe, d7921d2.
3. [Rule 2 - Security] POST /v1/invite/login has its own address limit (the sign-in limit) and checks again after the
   password hash, so two calls at once cannot make two sign-ins. Commit 71716a2.
4. [Rule 1 - Clarity] The interfaces did not give an answer for a malformed code (400, not counted) or a stale pending
   key (400 with code 'start'); no new sentence was added for either: both reuse the code sentence.
5. Tests beyond the plan's list: a co-investor invitation makes the co-investor's own sign-in (co true, the
   co-investor's email, the account's investorId); the firm's rule makes a new invitation sign-in start at 'setup';
   "key change" runs both 'X,A' and ' X , A ' (wave 2 B2); invite login runs three refused writes (foreign Origin with
   text/plain, own Origin with text/plain, foreign Origin with JSON), each 403 with no Set-Cookie (wave 2 W3).
6. people records carry a new field `invitationId` ('' unless made by POST /v1/invite/login).

## Open items
- POST /v1/auth/password (15-14) answers 404 from a full session until 15-14 builds it; from a half-done one it answers
  401 'stage' already.
- With PORTAL_ORIGIN set, a portal served by this server still cannot call POST /v1/invite/login until 15-18's cors()
  change (unchanged here).
- The issuer is the workspace's name as typed at sign-up (no short name is stored). An invitation made with the shared
  token for a workspace that has no workspace record (no one signed up for it) makes an investor sign-in whose firm
  rule cannot apply and whose set-up address has an empty issuer.
- The second of 15-04/15-05 to merge reruns the server suite on the merged tree (expected 502 + 23 = 525 if 15-05 adds 12).
- Notices by email for these changes come with 15-14.

## Guide lines (for .planning/GUIDE-PASS.md; not written into any guide file here, and to be used only once the screens exist)
- Sponsor guide: "Everyone who uses the console sets up two-step sign-in at their first sign-in: add the key to an
  authenticator app (type it, or open the set-up address), enter the app's code, and keep the ten recovery codes. Each
  later sign-in asks for the app's code or one unused recovery code."
- Sponsor guide: "Lost phone and recovery codes: an Owner or Admin resets that person's two-step sign-in (an Admin
  never the Owner's); the person sets it up again at their next sign-in. The Owner's own is reset by the operator."
- Sponsor guide: "The Owner can require two-step sign-in for the firm's investors (off by default)."
- Investor guide: "Two-step sign-in is optional unless your firm requires it. You can turn it on or off from your
  account after entering your password again."

## Commits
| Hash | Message |
|------|---------|
| 30c3582 | test(15-04): RED two-step set up and sign in over HTTP |
| 6473bfe | feat(15-04): two-step start, confirm and the code step on the server |
| 934ff28 | wip(15-04): save evidence of task 1 |
| 1706d91 | test(15-04): RED replay, wrong codes, recovery codes, side doors, investors |
| d7921d2 | feat(15-04): recovery codes, 5 wrong codes, two-step off, the firm's investor rule, deny by default |
| dc36201 | wip(15-04): save evidence of task 2 |
| ec9c31d | test(15-04): RED resets, sessions, secrets, key change, invite login |
| 71716a2 | feat(15-04): resets, confirm-password, sessions list, previous-key lookup, POST /v1/invite/login |
| 20d9872 | wip(15-04): save evidence of task 3 |

## Threat Flags
None beyond the plan's threat model: POST /v1/invite/login is the new surface it names (T-15-33), with the write rule,
an address limit and one sign-in per invitation and email.

## Self-Check: PASSED
- server/lib/auth.mjs, server/test/auth-twostep.test.mjs, server/test/auth-account.test.mjs exist.
- Commits 30c3582, 6473bfe, 1706d91, d7921d2, ec9c31d, 71716a2, 20d9872 are ancestors of HEAD.
