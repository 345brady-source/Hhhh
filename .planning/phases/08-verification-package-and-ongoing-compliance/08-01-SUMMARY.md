---
phase: 08-verification-package-and-ongoing-compliance
plan: 01
subsystem: api
tags: [integration-server, sponsor-accounts, tokens, access-control, node-test]

requires:
  - phase: 06-onboarding-forms
    provides: the integration server's invitation routes and the server-mode browser check (15 parts)
provides:
  - "server/lib/accounts.mjs: createAccounts({ store, now }) with create, rotate, list, find"
  - "store table accounts: { id acct_…, workspace, name, tokenHash (SHA-256 hex), createdAt }"
  - "server/index.mjs: sponsorAuth(req) -> null | { shared: true } | { account: { id, workspace, name, createdAt } }; inside route() the result is `auth`, and `pin` is the account's workspace or null"
  - "admin routes behind ADMIN_TOKEN: POST /v1/admin/accounts, GET /v1/admin/accounts, POST /v1/admin/accounts/:id/token"
  - "server/lib/invitations.mjs: sponsor(req, res, url, auth), create(req, res, auth)"
affects: [08-04, 08-05, 08-06, 07-help-chatbot]

actuals:
  tokens: 13623
  tasks: 2
  commits: 3
plan_head_before: c4f3fb4d79db343178cadbe2fc53ac5632af3bc8
plan_head_after: 2d7e0b84b886c78c23747fe6b8d60720a7f4393f

tech-stack:
  added: []
  patterns:
    - "A sponsor route takes the workspace from `auth.account`, never from the body or the query; another workspace's record answers 404 with the same body as an unknown id"
    - "A route that is off unless its own token is set (ADMIN_TOKEN), as RESULTS_TOKEN already was"

key-files:
  created:
    - server/lib/accounts.mjs
    - server/test/accounts.test.mjs
  modified:
    - server/index.mjs
    - server/lib/invitations.mjs
    - server/lib/store.mjs
    - server/README.md

key-decisions:
  - "A1 applied: the admin routes sit below the invitation token's refusal (the plan text said above it)"
  - "authorize() is kept and called by sponsorAuth for the shared token, so the lines phase 07 edits stay as they were"
  - "Every admin call is rate limited before its token is compared (the pattern of /v1/results), GET included"
  - "Account events (account_created, account_token_replaced) carry the account id and workspace only"

requirements-completed: []  # none claimed: VPK-04 and VPK-02 are worked on here and left for the orchestrator to mark
requirements-addressed: [VPK-04, VPK-02]

duration: 19min
completed: 2026-11-19
status: complete
---

# Phase 08 Plan 01: Sponsor accounts and tokens Summary

**Each sponsor gets its own token on the integration server (stored as a SHA-256 hash, shown once), and every sponsor call made with it reads and writes that sponsor's workspace only; the shared API_TOKEN and the open development server behave as before.**

Nothing here is checked by the owner yet, and nothing was run against a hosted server: the proof is the server's own tests and the server-mode browser check. No screen changed, so there is nothing new to look at on the phone for this plan.

## Failures and limits first

- No verify command failed.
- Of the 10 tests added in Task 2, 3 were RED before the code (pinned, foreign records, the shared-token test's last part). The other 7 were already green at that run because Task 1's step 4 built the admin routes and sponsorAuth; their only RED proof is Task 1's run (the admin route answered 404) plus one mutation run for A1 (below).
- Not covered by this plan, found while reading, left as they are:
  - `POST /v1/results` (RESULTS_TOKEN) and the webhooks act on a check by its reference in any workspace. On a server with several sponsors RESULTS_TOKEN must stay with the operator. No per-sponsor results token exists.
  - `POST /v1/intake` and `POST /v1/read` accept a sponsor account's token and are not attributed to it; the spend cap is one for the whole server.
  - `find(token)` scans the accounts table on each call with an account token (fine for a few hundred accounts; a database index is the README's existing "before production" item).
- Requirement ids VPK-04 and VPK-02 are not marked complete here: the orchestrator said not to touch STATE.md or ROADMAP.md, and I left REQUIREMENTS.md alone for the same reason.

## Measured

- Duration: 19 minutes (start 2026-11-19T15:52:38Z, last code commit 16:10Z; the final re-run of the verify waited on the shared browser queue after that).
- Server tests: base 197 (run at c4f3fb4 before any edit; phase 07 was not in the base), 11 top-level tests in `server/test/accounts.test.mjs`, 208 run, 208 pass, 0 fail.
- Server-mode browser check: `SERVER MODE: PASS (parts run: 15)`.
- Realized diff: 54,493 characters (13,623 tokens at chars/4) against an estimate of 95,000 tokens.

## RED runs

Task 1 (`SCRATCH/exec-08-01/red.txt`, before any code):

```
not ok 1 - tracer: a sponsor’s own token creates an invitation in its own workspace, whatever the body says, and lists only its own
  expected: 200
  actual: 404
# tests 1
# pass 0
# fail 1
```

Task 2 (`SCRATCH/exec-08-01/red2.txt`, against Task 1's commit b434563):

```
not ok 2 - pinned: checks, screenings and the outbox are the token’s workspace, whatever the request says
    'beta' !== 'alpha'
not ok 3 - foreign records: another sponsor’s invitations, submissions, checks, evidence and screenings answer 404 and nothing changes
  expected: 404
  actual: 200
not ok 7 - shared token: with API_TOKEN and no account every call works as before (workspace from the body and the query)
  expected: 404
  actual: 200
# tests 11
# pass 8
# fail 3
```

A1 mutation (`SCRATCH/exec-08-01/mutation-a1.txt`): with the admin routes moved above the invitation token's refusal (where the plan text had them), test 9 fails `expected: 401, actual: 200` (10 pass, 1 fail). The line was removed again before the commit.

## Verify commands, last lines

Task 1:

```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 225.668374
```

Task 2 (with A3's exact count):

Run twice: at a26697c, and again at the final code commit 2d7e0b8 (the second run waited about 10 minutes for a slot in the shared browser queue). Both ended the same; the second run:

```
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10848.285371
PASS include-tax include-tax: white label: the emails, the done screen and the console row pass the leak check
SERVER MODE: PASS (parts run: 15)
COUNTS: base 197 + own 11 = 208; run 208
# tests 208
# pass 208
# fail 0
# cancelled 0
# skipped 0
# todo 0
VERIFY EXIT: 0
```

The `COUNTS` line and the exact-count test are A3's addition to the plan's command (`SCRATCH/exec-08-01/verify2.sh`); the rest of the command is the plan's, unchanged.

## What was built

- **Accounts** (`server/lib/accounts.mjs`): tokens are 32 random bytes as base64url; only the SHA-256 hex is stored; `find` hashes the presented token and compares every stored hash with `safeEqual`. A workspace is 1 to 120 letters, digits, dots, underscores or hyphens and has one account (400 otherwise). The name is clipped to 120.
- **The gate** (`server/index.mjs`): `sponsorAuth(req)` tries the shared API_TOKEN first (constant time), then an account token; an open server passes only while no API_TOKEN is set and the accounts table is empty.
- **Pinning**: with an account, `POST /v1/invitations`, `POST /v1/verifications` and `POST /v1/screenings` store the account's workspace whatever the body says; `GET /v1/invitations` and `GET /v1/outbox` return that workspace only (the query is ignored).
- **Foreign records**: `GET /v1/invitations/:id`, `GET` and `DELETE …/submission` (A2), `POST …/resend`, `POST …/cancel`, `GET /v1/verifications/:id`, `…/evidence/:n` and `GET /v1/screenings/:id` answer 404 with the same body as an unknown id. The test compares the whole store before and after: nothing changes, the provider's letter is not fetched, the submission's files stay.
- **Admin routes**: 404 unless ADMIN_TOKEN is set; then Bearer ADMIN_TOKEN in constant time, rate limited. A call carrying `X-Invite-Token` answers 401 before any admin code runs, also with a valid ADMIN_TOKEN beside it (A1), and the accounts table is unchanged.
- **Older store files** open as before (the defaults object now has `accounts: {}`); a test writes a file without the table and makes an account in it.
- **README**: a "Sponsor accounts" section, `ADMIN_TOKEN` in the settings table and in "Before production", and the "Scope" line under Data protection.

## Task commits

1. **Task 1 (tracer)**: `b434563` feat(08-01): sponsor accounts, a sponsor's own token pins its invitations to its workspace
2. **Task 2**: `a26697c` feat(08-01): every sponsor route pinned to the token's workspace; foreign records answer 404
3. **README sentence**: `2d7e0b8` docs(08-01): README, one account for each portal workspace (investor ids repeat between workspaces)

## Deviations from Plan

1. **[Plan-check A1] Admin routes placed below the invitation token's refusal.** The plan text said "before the invite-token block"; 08-CONTEXT A1 overrides it. Proven by the mutation run above.
2. **[Rule 2] Every admin call is rate limited before the token is compared**, GET included (the plan said "like other POSTs"). A wrong ADMIN_TOKEN guess is then counted too. Commit b434563.
3. **[Merge safety] `authorize()` kept.** The plan said to replace the gate's body; `sponsorAuth` calls the existing `authorize()` for the shared token instead, so that function and the lines around it are untouched for phase 07.
4. **[Rule 2] Two store events added**, `account_created` and `account_token_replaced` (account id and workspace only), so making and replacing a token leaves a trace. A test asserts no token or hash is in any event.
5. **One test beyond the listed behaviours**: a store file written before the accounts table existed (Pitfall 7, Task 1's acceptance line).
6. **README**: besides the section and the production list, the settings table got an `ADMIN_TOKEN` row and the "Scope" line was corrected (it said sponsor routes need API_TOKEN). A third small commit added one sentence: one account for each portal workspace, because investor ids repeat between workspaces and a check is matched to an investor by id within a workspace.
7. **Push**: the plan says no push; the orchestrator's instruction (push to `wip/08-01` only) was followed.
8. **State**: STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (orchestrator's instruction).

## For the merge (orchestrator)

- **A4: phase 07's `POST /v1/help` is not in this base** (no `server/help/`, no such route at c4f3fb4). At merge it must sit below the line `const auth = … sponsorAuth(req)` in `route()` and take its session owner from `auth.account ? auth.account.id : 'sponsor'`. If phase 07's code calls `authorize(req, env)` itself, a sponsor account's token is refused there: use `auth`.
- **`server/index.mjs`**: this plan changed the gate line (old line 751) into five lines and added one admin line above it; `sponsorAuth` and `admin` are defined next to `createInvitations` near the top of `createServer`, away from `route()`. A conflict on the gate line keeps both sides; the gate must end up reading `auth`.
- **`server/lib/invitations.mjs`**: `investorPath` is untouched. Changes are in `requireSponsor`, `create` and `sponsor` only.
- **`server/README.md`**: three places (settings table after `API_TOKEN`, a new section above "Data protection", the second bullet of "Before production") and the "Scope" line.
- **Test count after the merge**: 197 + 11 + whatever phase 07 adds.
- **For 08-04 and 08-05**: the caller is `auth.account.id` inside `route()`; a charge must refuse `auth.shared`.

## Known Stubs

None.

## Self-Check

PASSED. The six server files and this summary exist; commits b434563, a26697c and 2d7e0b8 are ancestors of HEAD; `git diff --stat` against the base shows only the plan's six files; `accounts: {}` is in the store's defaults; `accounts.find` and `invites.sponsor(req, res, url, auth)` are in `server/index.mjs`. No existing test file was modified.
