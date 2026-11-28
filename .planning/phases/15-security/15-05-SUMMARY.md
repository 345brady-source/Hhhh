---
phase: 15-security
plan: 05
subsystem: server security (roles, team, change log)
tags: [roles, guard, route-table, team, invitations, audit-log, tokens]
status: complete
requires: [15-01, 15-12, 15-02, 15-03, 08-08, 08-09, 10-11]
provides:
  - "server/lib/roles.mjs: ROUTES (a flat frozen array, extended by added lines only), lineMatches, can, plainDay, SAY, createGuards({ signin, store, now, routes }) → { guard, guardInvestor, linesOf }"
  - "server/lib/team.mjs: createTeam({ store, signin, audit, now, env }) → { accept, handle }"
  - "server/index.mjs: the guard on every sponsor route; /v1/team/accept before the sponsor gate; /v1/team and /v1/audit after the guard; server.audit (the change log)"
affects: [15-04, 15-06, 15-08, 15-14, 15-15, 14-08, phase 16]
tech-stack:
  added: []
  patterns: ["one route table walked by a test (15-RESEARCH Pattern 2)", "a floor permission on the line and the narrower one inside the module, both logged the same way"]
key-files:
  created: [server/lib/team.mjs, server/test/roles.test.mjs, server/test/team.test.mjs]
  modified: [server/lib/roles.mjs, server/index.mjs, server/lib/invitations.mjs, server/README.md, server/test/billing.test.mjs, server/test/backup.test.mjs]
decisions:
  - "A path the route table does not name answers 404 for every caller, tokens included. A named path called with a method no line names answers 405 'Use X'."
  - "When several team lines match one request, every one must allow it (for example GET /v1/invitations/:id needs view, and .../submission also needs operate)."
  - "Reading a verification, its evidence or a screening needs 'personal' (Read-only sees KYC results, 15-RESEARCH 4.3); starting one needs 'operate'."
  - "GET /v1/team has the floor 'view': listing the team needs 'team', listing investors' sign-ins needs 'personal'. Invite and resend have the floor 'operate': a team person needs 'team'."
  - "The team routes take only a signed-in person. A token gets 403 'This needs a person signed in.' even while the firm has no people."
  - "Sign-up and sign-in reach the change log as 'Signed up' and 'Signed in', through an adapter in index.mjs (lib/auth.mjs is unchanged). The auth event is kept."
metrics:
  completed: 2026-11-27
  base_commit: 4b0aec90882a5efd52320db8805448d1dc753784
actuals:
  tasks: 3
  commits: 9
  tests_added: 12
plan_head_before: 4b0aec90882a5efd52320db8805448d1dc753784
---

# Phase 15 Plan 05: roles enforced on the server, the Team routes and the change log routes

The server now checks every sponsor route against one route table, `ROUTES` in `server/lib/roles.mjs`, read with the browser's own `roles.js`. It refuses with the table's sentence and writes each refusal to the change log with the person from the session. Static tokens lose people, billing, the change log and the outbox once a firm has people. The five roles are real people: they can be invited, accept, change role, be removed and have an end date, and ownership can be transferred. None of this is on screen yet, and nothing here has been checked by the owner.

## Failures first

- **Gate run 1 stopped at its 2-hour limit** before phase 9 to 15 checks ran. Every step it finished had passed, including `GATE ok   server tests 514 = base 502 + 12 declared`. Run 2 went into the same folder and kept 35 steps (`(kept from …)`). It ended `GATE_EXIT=0` with no `GATE FAIL` line.
- **Task 1 broke two existing tests** in the full suite, and I edited both (see Deviations):
  - `billing.test.mjs` "who": `GET /v1/billing/anything` now answers 404 from the route table, no longer 403 from the billing module.
  - `backup.test.mjs` "reseal people sign in": sign-up and sign-in now add entries to the change log, so its chain counts are 3 and 4, no longer 2.
- **The first Task 2 walk failed on my own table.** The line builder for link, public and operator lines had its arguments swapped, so no prefix line matched. It was fixed in the Task 2 GREEN commit. The walk then found two regular-expression forms in `invitations.mjs`'s invitation-token list, and lines were added for both.

## Evidence (verbatim)

### Task 1 RED (red-1.txt)
```
not ok 1 - tracer
# tests 1
# pass 0
# fail 1
  expected: 403
  actual: 404
```
### Task 1 verify (t1.txt)
```
# tests 1
# pass 1
# fail 0
VERIFY=0
```
### Task 2 RED (red-2.txt)
```
ok 1 - tracer
not ok 2 - walk
not ok 3 - each role
not ok 4 - tokens once people exist
not ok 5 - accountant ends
ok 6 - audit routes
# tests 6
# pass 2
# fail 4
```
"audit routes" already passed at RED because Task 1 built the audit routes together with the tracer.
### Task 2 verify (t2.txt)
```
# tests 6
# pass 6
# fail 0
VERIFY=0   (invitations.mjs: 3 added lines, limit 3)
```
### Task 3 RED (red-3.txt; team.test.mjs and roles.test.mjs, team.mjs not mounted)
```
ok 1 - tracer
not ok 2 - walk
not ok 3 - each role
not ok 4 - tokens once people exist
ok 5 - accountant ends
ok 6 - audit routes
not ok 7 - invite and accept
not ok 8 - roles
not ok 9 - remove
not ok 10 - accountant
not ok 11 - transfer
not ok 12 - tokens
# tests 12
# pass 3
# fail 9
```
### Task 3 verify, pre-gate part (all.txt)
```
# tests 514
# suites 0
# pass 514
# fail 0
PREGATE=0
```
`auth.mjs`, `billing.mjs`, `filings.mjs` and `taxdocs.mjs` are unchanged against the base commit (empty `git diff --stat`).
### Gate (GATE_OUT=SCRATCH/exec-15-05, base-commit.txt = 4b0aec9, GATE_SERVER_TESTS=514)
Run 2, the last lines:
```
GATE ok   server tests 514 = base 502 + 12 declared
...
GATE ok   phase 13 checks: none in this tree
GATE ok   DATAROOM MODEL
GATE ok   INBOX MODEL
GATE ok   WATERMARK
GATE ok   ROLES TABLE
GATE ok   TOTP FRAME
GATE_EXIT=0
```
GATE_EXIT=0. There are 101 `GATE ok` lines and no `GATE FAIL` line. Both checks pass: the B1/W4 server-line grep (`( \(kept from [^)]*\))?$` allowed) and the last-line test.

## Test counts

- Base: 502, measured at 4b0aec9.
- This tree: 514, all passing.
- Added: +12 (roles.test.mjs 6, team.test.mjs 6; markers `// gate: tests 6` on both).
- When this branch and 15-04 are both merged, the suite must be rerun on the merged tree. The expected count there is base + 23.

## What was built

- **`server/lib/roles.mjs`**:
  - `ROUTES`, one line per route and caller kind.
  - `lineMatches`: a prefix matches only itself or anything after a `/` (W1).
  - `can(auth, permission)`.
  - `createGuards`, which holds both guards:
    - `guard(req, path, auth)` answers 404 for an unnamed path and 405 for an unnamed method. For a session it answers 401 `ended` for an Accountant past `endsOn` (the session is ended) and 403 `role` with the `REFUSALS` sentence. For a token: an account token is held to `tokens: true` lines once its own workspace has an active team person, and the shared `API_TOKEN` once `signin.required()` (W2). Otherwise it answers 403 `person`.
    - `guardInvestor(req, path)` returns `{ investor }` for a full investor session, and otherwise 401 `Sign in to your portal first.` with code `investor`. It is not mounted yet, because no investor route exists.
- **`server/index.mjs`**:
  - Plumbing:
    - The change log is passed to `createAuth` through an adapter. Auth's own event is kept, and `signup`, `signin`, `signout`, `locked` and `unlocked` become 'Signed up', 'Signed in', 'Signed out', 'Locked after too many tries' and 'Unlocked by the operator'.
    - `sponsorAuth` results carry `can()`.
  - The guard runs right after the pin and foreign lines. Its 401 and 403 answers are `{ error, code }` and are logged as 'Refused' with detail `<METHOD> <path>: <permission>`.
  - The change log routes:
    - `GET /v1/audit?before=&limit=` → `{ entries }`
    - `GET /v1/audit/verify`
    - `GET /v1/audit/export`: an attachment, and the export itself is logged as 'Change log exported'.
  - The team routes:
    - `/v1/team/accept` is mounted before the sponsor gate and is rate limited.
    - `/v1/team*` is mounted after the guard. Refusals from inside the module are logged too.
- **`server/lib/invitations.mjs`**, 3 lines: the import, the `role` entry in `PACKAGE_SAYS` (`REFUSALS.spend`), and `if (auth && auth.can && !auth.can('spend')) return refusePackage(res, 'role')` before any payment.
- **`server/lib/team.mjs`**:
  - The routes match the plan's interface. The token is 32 random bytes after `#accept-`. Only its SHA-256 is kept, for 7 days and one use.
  - `POST /v1/team/accept` applies the JSON and own-Origin rule (W3). A foreign or text/plain request gets 403 and no cookie.
  - A team person starts at stage 'setup'. An investor starts at 'full', or at 'setup' when the firm requires two-step.
  - Removal sets `status: 'removed'` and ends the sessions. It deletes the sealed email, the email index, the password, two-step, pending, recovery and invite, and keeps the name.
  - Transfer needs the Owner with a sign-in in the last 10 minutes. Without it the answer is 401 `Enter your password again to do this.` with code `fresh`, the same sentence as 15-04.
- **`server/README.md`**: a new section "## Sign-in, two-step and roles", placed after "## Sponsor accounts".

## ROUTES as built (later plans add lines only)

Line shape: `{ method, path | prefix | source, who, permission, tokens, reason? }`. A prefix is allowed only on link, public and operator lines. A reason is required on those three kinds. Permissions:
- `team` lines: one of `PERMISSIONS`, or `person` (any signed-in team person).
- `investor` lines: `portal`.
- link, public and operator lines: `''`.

When several team lines match a request, all of them must allow it.

| who | method | path / prefix / source | permission | tokens |
|---|---|---|---|---|
| public | GET | `/health` | - | - |
| public | * | `/v1/auth` (prefix) | - | - |
| public | POST | `/v1/invite/login` | - | - |
| link | * | `/v1/invite` (prefix) | - | - |
| link | * | `/v1/taxdoc` (prefix) | - | - |
| link | GET, POST | `/v1/team/accept` | - | - |
| operator | POST | `/v1/results` | - | - |
| operator | * | `/v1/admin` (prefix) | - | - |
| operator | * | `/v1/filings/staff` (prefix) | - | - |
| link | * | `/v1/room` (prefix; phase 14 prospects) | - | - |
| public | POST / * | `/webhooks`, `/return`, `/hosted`, `/sandbox`, `/billing` (prefixes) | - | - |
| team | GET | `/v1/invitations` | view | true |
| team | POST | `/v1/invitations` (a paid package also needs spend, checked inside) | operate | true |
| team | GET | `^\/v1\/invitations\/([^/]+)(?:\/(submission\|resend\|cancel))?$` | view | true |
| team | GET | `^\/v1\/invitations\/[^/]+\/submission$` | operate | true |
| team | DELETE, POST | the invitations regex above | operate | true |
| team | GET | `/v1/outbox` | operate | false |
| team | GET | `/v1/checks/changed` | view | true |
| team | GET | `/v1/connectors` | person | true |
| team | POST | `/v1/intake`, `/v1/read` | configure | true |
| team | POST | `/v1/help` | person | true |
| team | POST | `/v1/verifications`, `/v1/screenings` | operate | true |
| team | GET | `^\/v1\/verifications\/(ver_[\w-]+)$`, `…\/evidence\/(\d{1,2})$`, `^\/v1\/screenings\/(scr_[\w-]+)$`, and the two capture-less forms from invitations.mjs | personal | true |
| team | GET / POST | `/v1/taxdocs` | view / operate | true |
| team | POST | `^\/v1\/taxdocs\/([^/]+)\/(withdraw\|resend)$` | operate | true |
| team | GET | `/v1/filings` | view | false |
| team | POST | `/v1/filings/orders`, `^\/v1\/filings\/(staff\/)?orders\/(fil_[\w-]{1,40})(\/[a-z]+)?$` | spend | false |
| team | GET | `/v1/billing` | view | false |
| team | POST / DELETE | `/v1/billing/card/setup`, `/v1/billing/card` | account | false |
| team | POST | `/v1/billing/entitlements` | spend | false |
| team | GET | `/v1/team` (team list needs team, investors personal, inside) | view | false |
| team | POST | `/v1/team/invite`, `^\/v1\/team\/(per_[\w-]{1,64})\/resend$` (a team person needs team, inside) | operate | false |
| team | POST | `^\/v1\/team\/(per_[\w-]{1,64})\/(role\|remove\|renew)$` | team | false |
| team | POST | `/v1/team/transfer` | account | false |
| team | GET | `/v1/audit`, `/v1/audit/verify`, `/v1/audit/export` | audit | false |
| team | POST | `/v1/inbox/messages`, `/v1/inbox/read` | operate | false |
| team | GET | `/v1/inbox/updates`, `^\/v1\/inbox\/attachments\/[^/]+$` | personal | false |
| team | POST | `/v1/rooms`, the rooms action regex, `…\/documents\/[^/]+\/hide$`, `…\/prospects\/[^/]+\/(link\|end)$` | operate | false |
| team | GET | `^\/v1\/rooms\/[^/]+\/(nda\|documents\|prospects\|open-link\|activity\|record)$` | personal | false |
| investor | GET / POST | `/v1/my-inbox`, `/v1/my-inbox/messages`, `/read`, `/prefs`, `^\/v1\/my-inbox\/attachments\/[^/]+$` | portal | false |

The table holds no phase 13 routes (senders, mail log, messages), because none had merged at 4b0aec9.

### What phase 14's 14-08 and phase 16 must know

- **The walk already covers phase 14's modules.** It reads every `server/lib/*.mjs` holding `/v1/`, and `lib/inbox.mjs` and `lib/dataroom.mjs` are already in the tree, unmounted. So this plan added their lines, with 14-08's stated rule: team reads 'personal', writes 'operate', tokens false; investor lines for `/v1/my-inbox*`; a `link` prefix for `/v1/room`.
- **14-08 must not add these lines a second time.** It should check them against the routes as it mounts them. Any route it adds needs a new line: a regular expression is covered only by an identical `source` line, an anchored plain path by its path line, or by a link, public or operator prefix.
- **Mounting phase 14's routes.** The investor routes use `guardInvestor`. The `X-Room-Token` dispatch sits before the sponsor gate, as the 'link' line says.
- **Phase 16** adds its payment-release routes as `team` lines with permission `pay` (I3).

## Deviations from plan

1. **[Rule 1] Two existing test files edited.**
   - `billing.test.mjs`: one assertion. `/v1/billing/anything` is 404 now, because the plan's "never allowed by default" rule applies.
   - `backup.test.mjs`: chain counts 2 → 3 and 4, and the list is checked by action, because the plan's truth "sign-ins reach the same log" applies.
   - The test count is unchanged (502 base). The plan's header said existing files would be unchanged; these edits were needed for its own truths.
2. **Permissions chosen differently from the plan's starting rows**, for 15-RESEARCH 4.2/4.3 reasons:
   - Verification and screening reads need 'personal' rather than 'operate', so Read-only can see KYC results.
   - Listing investors' sign-ins needs 'personal' rather than 'operate'.
   - GET /v1/team has the floor 'view', with 'team' checked inside. This way Read-only gets the team sentence, not "can look at this but not change it".
3. **The guards come from a factory.** `guard` and `guardInvestor` are built by `createGuards({ signin, store, now, routes })`, not exported as bare functions: they need the sign-in, the store and the clock, and the walk test passes stand-in routes.
4. **"tokens once people exist".** The firm signs up through the route, and the operator then replaces its account token (`POST /v1/admin/accounts/:id/token`). This is needed because sign-up always makes its own workspace and account. A second firm ('beta', no people) keeps its token on GET /v1/billing (W2). GET /v1/team was added to the paths refused for tokens.
5. **New sentences beyond the plan's list.** All are plain and contain no vendor names:
   - 'This investor already has a sign-in.'
   - 'Choose a role: Admin, Staff, Read-only or Accountant.'
   - 'Choose an end date from today to 365 days from today.'
   - 'Only an Accountant’s access has an end date.'
   - 'This person has already accepted the invitation.'
   - 'The new Owner must be an Admin who has set up two-step sign-in.'
   - 'Enter your password again to do this.' (the same as 15-04)
   - 'Add ?workspace= to name the workspace' (shared token on /v1/audit, operator only)
   - The change log actor 'Account token' for a refused account-token call.
   - The `Use X` answer for a 405.
   - The end date in the 'ended' sentence is shown as "November 26, 2026".
6. **An Accountant with no valid `endsOn` is treated as ended** (fail closed). A team invitation and a role change always set one.

## Open items

- **README owner-reset procedure.** Sign-up collects no phone number, so the procedure says to call "a number you already held for the firm before the request (from its sign-up or contract records)". If the owner wants a phone number taken at sign-up, that is a later plan (15-14 or 15-11).
- **15-04's routes under the `/v1/auth` prefix** (`POST /v1/auth/people/:id/two-step/reset`, `/v1/auth/firm/investor-two-step`) are covered by the public prefix line. Their role checks live in `auth.mjs`, not in ROUTES. The walk cannot see them as team routes.
- **Merge order.** 15-04 and this plan share no file, but both touch the sign-in flow. The second to merge must rerun the suite on the merged tree (base + 23). If 15-04 changes `log()` to pass `person`, the index.mjs adapter already accepts it.
- **Team invitation links are shown once to the sender** until 15-14 sends them by email. 15-08 adds the console button for investors' access invitations.
- **Not changed here:** `cors()` with `PORTAL_ORIGIN` set still blocks a portal served by this server (15-18).
- Nothing is on screen. Nothing is ready until the owner has checked it.

## Lines for .planning/GUIDE-PASS.md (no guide bytes written here)

- Team page (server mode): invite by email, role and (Accountant) end date. The link is shown once, to the sender, and works for 7 days, once.
- An Accountant's access ends on its date; renew it from the Team page (at most 365 days ahead).
- Only the Owner transfers ownership, to an Admin who has two-step, after entering the password again.
- A refused action shows one sentence ("Only an Admin or the Owner can …") and appears in the change log.
- Once a firm has people, its automation token works only for invitations, checks, reading, help and tax documents.

## Threat flags

None beyond the plan's register. The new public surface is `/v1/team/accept`. It is rate limited, takes a one-time hashed token, and applies the JSON and own-Origin rule on POST.

## Self-Check: PASSED

- Files: server/lib/team.mjs, server/test/roles.test.mjs, server/test/team.test.mjs, server/lib/roles.mjs, server/README.md are all present.
- Commits 35a64d4, 767d25e, ba2d7bc, 38c0c79, 858c093, 95304eb, 03570a8 and 16776ca are on HEAD and pushed to wip/15-05.
- server/node_modules link removed. Base tree, shots and checks-out are removed by the gate. The scratchpad prototype is deleted.
