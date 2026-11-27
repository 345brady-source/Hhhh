---
phase: 15-security
plan: 14
status: paused
---

# Phase 15 Plan 14: account emails and resets (paused by the owner before the gate finished)

## Paused (2026-11-27, owner's indefinite pause)

**Not finished: the done criterion is not met.** The full phase gate (gate15.sh, every phase, as the plan names it) was
stopped by hand at the coordinator's pause order before it printed GATE_EXIT. No GATE_EXIT exists for this plan. Nothing
here is called ready; live email stays "To be confirmed" (13-10).

**Done (all committed and pushed on wip/15-14):**
- Task 1: password reset by email: POST /v1/auth/reset/request (same answer for every address), /reset/check,
  /reset/confirm (two-step code or unused recovery code required; 5 wrong codes end the link; every session ends).
- Task 2: 503 code 'mail' for every address alike when the link cannot be sent now; limits 10/hour per network address
  and 3/hour per email address; emails.js kinds security_notice (9 variants, incl. D-04 bankChanged and the sponsor
  variant bankChangedFirm "<firm>: an investor's bank account was changed, confirm it before paying", last four digits
  only) and portal_access, with goldens written by EMAILS_WRITE_GOLDEN=1.
- Task 3: POST /v1/auth/password; Owner email confirmation (sign-up link, /v1/auth/confirm-email, /confirm-email/resend,
  me emailConfirmed); invitations.mjs refuses a session's POST /v1/invitations until confirmed (and team.mjs refuses an
  investor access invitation until confirmed); notify(to[], variant, data) with explicit recipient lists (B4a) and the
  notices for password, two-step on/off/reset, recovery codes replaced, a recovery code used, a new console device
  (__Host-device / device cookie, SHA-256 kept, at most 20), the lock (once per lock); team invite and resend emailed
  (team_invitation, portal_access) when the server can send, else the link once (sent: false); an Accountant past
  endsOn refused 403 at sign-in after the right password.
- Empty-issuer fix: **in** (POST /v1/invite/login gives a workspace with no record its record, named from the
  invitation; issuer never empty; a sign-up cannot take that workspace id). Test: auth-carried.test.mjs
  "invite login workspace record" (RED first, then GREEN).
- W3: **in** (a firm with no confirmation link ever made is offered `confirmEmail: 'resend'` at sign-in and
  `emailConfirm: { resend, reason }` in me; test "confirm a firm made before confirmations" proves resend, confirm, then
  invite).
- Firm-name argument to unsub.urls (coordinator's 13-08 item): **in**, commit a7c31c5. messages.mjs on this tree takes
  four arguments, so the fifth is ignored until 13-08 merges; unsubscribe, messages, invitations and emails-kinds tests
  pass with it (39/39). The merged tree's 13-08 test must cover it.

**Last lines:**
- RED-3 (red-3.txt): `# tests 7`, `# pass 0`, `# fail 7`.
- GREEN, full suite in the rerun verify on a7c31c5 (all.txt): `# tests 616`, `# pass 616`, `# fail 0`; `PRE-GATE OK`
  (count 601 + 15, marker, invitations.mjs at most 3 added lines, index.mjs and mail.mjs unchanged).
- Server tests: base 601 (measured at ef87afa, and again by the gate: server-base.txt `# tests 601`), plan tree 616
  (gate server.txt `# tests 616`, `# pass 616`, `# fail 0`) = 601 + 15 declared (plan's 13 + auth-carried.test.mjs 2).

**Gate state when stopped (run 2, on a7c31c5, GATE_OUT=SCRATCH/exec-15-14):** reference gate 36 "GATE ok" lines, 0
"GATE FAIL"; server tests step done (616 = 601 + 15); phase 08 checks: AML RECORD PASS (7), MONITORING PASS (9),
PACKAGE CONSOLE PASS (7), PACKAGE FLOW was running (stopped mid-check); phases 09 to 14 and phase 15's own checks not
run yet. Run 1 (on 0c044a1) was stopped by me after about 25 minutes to add the coordinator's unsub.urls argument (a new
commit reruns every step). The base tree, shots and downloads were deleted; step results stay in SCRATCH/exec-15-14/gate.

**Next step to resume:** from the worktree root (or a fresh worktree reset to the wip/15-14 head), link
server/node_modules, then run `bash SCRATCH/exec-15-14/verify3.sh > SCRATCH/exec-15-14/verify3.out 2>&1` in the
background (timeout 7200000) into the same folder; it reruns the suite, the pre-gate checks and gate15.sh with
GATE_OUT=SCRATCH/exec-15-14 (finished steps on the same HEAD are kept). Pass = last line GATE_EXIT=0 and
`GATE ok   server tests 616 = base 601 + 15 declared`. If the head moved (this SUMMARY commit moves it), every step reruns.
Then finish this SUMMARY (gate lines, GATE_EXIT), remove the link, commit, push. Do not merge.

## Evidence as produced

Start commit ef87afaff562d58f7b3b414ce57f94b71b709ea0; base server suite measured on it: `# tests 601`, `# pass 601`, `# fail 0`.

### Task 1
RED (red-1.txt, commit 8b3efbf):
```
not ok 1 - reset by email
  expected: 200
  actual: 401
# tests 1
# pass 0
# fail 1
```
Verify (t1.txt, after d2482a7): `# tests 1`, `# pass 1`, `# fail 0`; verify exit 0.

### Task 2
RED (red-2.txt, commit of the tests; emails.js put back to the base for the run):
```
ok 1 - reset by email
ok 2 - same answer
ok 3 - two-step not skipped
ok 4 - single use and expiry
not ok 5 - limits            (expected: 3, actual: 4)
not ok 6 - no readable link  (no 503)
not ok 7 - kinds             ("Cannot read properties of undefined (reading 'variants')")
not ok 8 - guard             (same)
# tests 8
# pass 4
# fail 4
```
Tests 2 to 4 passed already on Task 1's code (its request, check and confirm were built with one answer, single use
and the two-step rule); they are kept as the plan lists them.
Verify (t2.txt, 4ce4cde; W1 adds emails-kinds.test.mjs): `# tests 30`, `# pass 30`, `# fail 0` (8 new + render 8 +
guard 4 + kinds 10, the last three unchanged); verify exit 0.

### Task 3
RED (red-3.txt, f5fd5a8; auth-notices.test.mjs 5 and auth-carried.test.mjs 2):
```
not ok 1 - invite login workspace record        ('the sign-in made the workspace record': actual ~)
not ok 2 - confirm a firm made before confirmations ('sign-in offers the link')
not ok 3 - password change                      ('two-step turned on: one notice')
not ok 4 - confirmation                         ('sign-up emails a #confirm- link': actual '')
not ok 5 - new device                           ('the first full sign-in sets the device cookie': actual '')
not ok 6 - lock                                 ('one notice for the lock, not one per try')
not ok 7 - invitations emailed and ended access
# tests 7
# pass 0
# fail 7
```
First full suite after the code (all-a.txt): `# tests 616`, `# pass 614`, `# fail 2`: roles.test.mjs "each role" (an
unconfirmed firm's Owner now gets 403 'Confirm your email address first: ...' on POST /v1/invitations) and "accountant
ends" (the ended Accountant's sign-in itself is now refused 403, so the test's member() could not sign in). Both are
this plan's rules; the two tests were adapted (deviations below), then all-b.txt: `# tests 616`, `# pass 616`, `# fail 0`.

## Deviations
- Declared tests +15, not +13: auth-carried.test.mjs ("// gate: tests 2") holds the empty-issuer fix and W3 tests.
- invitations.mjs: 3 added lines, not 2: the confirmation rule, `firmRecord` exposed (auth.mjs's messages use the firm's
  stored brand without editing index.mjs), and the coordinator's unsub.urls fifth argument.
- Other plans' tests adapted to this plan's rules (one line each, marked "C-16 (15-14)"): auth-gate.test.mjs csrf (the
  firm confirmed before its POST /v1/invitations), team.test.mjs (confirmed before the investor access invitation),
  roles.test.mjs signedUp() (confirmed) and "accountant ends" (the end date now passes during an open session, since the
  sign-in itself is refused once it has passed).
- [Rule 2] team.mjs also refuses an investor access invitation until the Owner's email is confirmed (C-16, T-15-56).
- [Rule 2] 5 wrong codes on one reset link end it (no unlimited code guessing with a link).
- [Rule 2] freeWorkspaceId treats a workspace that has people as taken.
- Sender per audience: a team person's messages (reset, notices, confirmation, team invitation) go with workspace ''
  (MAIL_FROM, 13-03's rule for mail with no workspace, From name = the firm); an investor's from the firm's own ready
  address, or MAIL_FROM on a server with no sponsor accounts. canSend() is true only when the mailer would send now.
- Refusal sentence without a workspace: 'Email is not set up on this server; contact its operator.'; with the portal's
  workspace: '... contact <supportTeam> at <firm>.'
- Task 2 tests 2 to 4 passed already on Task 1's code; Task 3's code landed in wip saves b24b52e, 78f5f9f with the
  record commit 0c044a1.

## Interfaces (for 15-15, 15-17, 16-07)
- `signin.notify(to, variant, data)` → `Promise<{ results: [{ personId, status }] }>`. `to` is an explicit list: person
  records (address as stored now) or `{ email, name, audience: 'team'|'investor', workspace, investorId, personId }`
  (an address as stored before a save). bankChanged: pass the investor's pre-save address; bankChangedFirm: pass
  `signin.firmAdmins(workspace)` (active Owner and Admins) with `{ last4, investor: { name } }`. status is the mailer's,
  or 'not_sent'; any notice not sent is logged 'Notice not sent' with the variant only.
- `signin.canSend(audience, workspace)`, `signin.settled()` (tests: waits for mail sent after an answer),
  `signin.mailLink(person, kind, data, link)`, `signin.confirmed(workspace)`; `sponsor(req).confirmed`.
- Reset flow for the pages (15-07, 15-09): link `<PUBLIC_URL>/#reset-<token>`; POST /v1/auth/reset/check { token } →
  { firm, twoStep } | 404; POST /v1/auth/reset/confirm { token, password, code? } → { ok } | 401 code 'code' | 404.
  Confirmation link `<PUBLIC_URL>/#confirm-<token>` → POST /v1/auth/confirm-email { token }. POST /v1/auth/password
  { current, next } from a full session. Team/investor invitation answers carry `sent`.
