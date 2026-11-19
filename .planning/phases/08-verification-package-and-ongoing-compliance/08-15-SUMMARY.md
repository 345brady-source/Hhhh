---
phase: 08-verification-package-and-ongoing-compliance
plan: 15
subsystem: integration server (invitations, verification package)
tags: [verification-package, billing, invitations, D-01, C-05, C-08, N1, N3, W4, I2, I3, node-test]
status: complete
requires:
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "08-05 usePackages/packageState/rec.package; 08-14 billing.hold -> finish(ok), statuses refunded and disputed; 08-06 gate.sh and frame.js; 08-02 idcheck plug-in (providerStatus on its 502)"
provides:
  - "on the object usePackages returns: isPackage, gate(scope, auth, provider, kind), settings(scope, provider, settings), start(scope, provider, fn, kind), connectors(list)"
  - "endPackage(rec) inside createInvitations, called at purge, authenticate (both set expired), cancel and complete"
  - "resend refuses a credited, refunded, disputed or refunding package: 409 \"This invitation's package was returned. Send a new invitation.\""
  - "C-08 start limit: three accepted starts per kind (identity, screening, accreditation) per package, waiting starts counted; a fourth answers 409 \"This check was already started.\""
  - "provider refusal (402/403): 502 \"This check could not start. Please try again later.\", invitation event and store event package_check_failed, operator email (env OPERATOR_EMAIL, outbox kind package_alert, store event package_alert { sentAt }) at most once a day"
  - "invitation field packageStarts { identity, screening, accreditation } (accepted starts)"
  - "server/test/package-checks.test.mjs: 15 top-level tests"
affects: [08-07, 08-09, 08-12, 08-16]
tech-stack:
  added: []
  patterns:
    - "One billing read decides both the row and the gate (packageState); the gate adds no second read"
    - "The start-limit check (gate) and the in-flight count (start) run in one tick with no await between them, so simultaneous starts cannot pass the limit"
key-files:
  created:
    - server/test/package-checks.test.mjs
  modified:
    - server/index.mjs
    - server/lib/invitations.mjs
key-decisions:
  - "Only starts the provider accepted count toward the limit of three; a start the provider refused or failed does not"
  - "The start counter lives on the invitation record (packageStarts), since billing.mjs belongs to 08-16 in this wave"
  - "gate and start take the check's kind as a fourth argument (needed for the per-kind limit); the shared lines keep their count"
requirements-completed: []
requirements-addressed: [VPK-03, VPK-04, VPK-05]
duration: "21:24 to 22:25 UTC (61 min); the phase gate took about 35 min of it"
completed: 2026-11-19
actuals:
  tokens: 11968
  tasks: 3
  commits: 3
plan_head_before: e3ccadc815493c21e08c3f1ad586ed608f765330
plan_head_after: 42687a271357dc498c44c0bf4ed9ac3609e8aba4
---

# Phase 08 Plan 15: Package checks, credit where an invitation ends, the provider's refusal Summary

**A paid check starts only from the invitation that holds its own paid package, and runs with only the firm's name as settings. Sponsor accounts cannot reach the package providers, and do not see them in the list. A package whose check never started comes back as credit once, wherever its invitation ends. A cancel that lands while a start is in progress credits nothing if the check then runs. When the provider refuses a start for its own reasons, the package stays valid and the operator is emailed at most once a day. Each package allows three starts of each kind.**

This is not done until the owner has checked it. The proof is the server's own tests, run against stand-ins for the payment provider and the check provider. No provider was called and no key was used.

## Failures first

1. **The phase gate ended GATE_EXIT=1, with one failure: PACKAGE INVITE. The failure was already in the base tree; this plan did not cause it.** I ran `checks/package-invite.js` on the base tree (e3ccadc, without this plan) the same way the gate runs it. It failed with the same 5 FAIL lines (same names) and 230 PASS. On this plan's tree the result is also 5 FAIL and 230 PASS. Nothing fails here that passes on the base. The cause is the one 08-05 reported. The check sends a ticked invitation with the shared `API_TOKEN`, and since 08-05 the server answers `403 account_required` ("Card payments need a sponsor account."). 08-13 passed the check, but it ran before 08-05 was merged (its gate ran 272 server tests). The fix belongs in `checks/package-invite.js`, which this plan may not edit (see "For the orchestrator").
2. **One RED line is not a true RED.** In `red3.txt`, `not ok 12 - W4 started` failed because the test was wrong, not because the rule was missing. A cancelled invitation's record was deleted by a later purge, 30 days after it ended, before the test read its row. I fixed the test so it reads each row right after its ending. Run against Task 2's code, the fixed test passes (`red3-w4started-fixed.txt`), so "W4 started" is proven by a mutation run instead (below).
3. **Two mutations survived at first, so I made the tests stronger.** (a) "full tier" did not check the accreditation check's stored settings. With the settings rule removed it still passed, so I added that assertion. (b) The first concurrent version of "start limit" hung, rather than failing, when the in-flight count was removed. The fourth start then waited forever on a stand-in that held every call. The stand-in now holds only the first three calls. Both mutations were run again and now fail as they should (lines below).
4. **Found, not fixed (needs a shared-line change in `server/index.mjs`).** An investor's screening call may add up to 25 names of its own (`body.names`) to the names the sponsor entered. Each name is a separate call to the provider. So one of the three screening starts can make up to 25 paid screenings. The route builds the names list before `pkg.start`, and the plan allows exactly 7 added / 2 removed lines in index.mjs. Limiting a package screening to the sponsor's names needs one more changed line there. The orchestrator should decide this, and say whether the provider bills per name.
5. **R3's "the investor's screen shows that sentence with the firm's contact"** is a screen change. This plan touches only server files. The server sends the sentence as `{ error }` with status 409. Showing it with the firm's contact belongs to 08-07 (the console and investor screens).

## Measured

- Server tests at the base (e3ccadc, by a run): `# tests 329`, 329 pass, 0 fail. The plan expected 298 if only 08-05 and 08-14 had merged since 993e568. The base also holds the merges of 08-06, 07-03, 07-05, 10-02, fixes 06-31 and 06-32, 09-03, 09-05, the webhook-retry fix, 10-01, 11-04, 11-02 and 08-13. Those account for the difference.
- This plan's file: 15 top-level tests (14 from the plan, plus "start limit:" from R3).
- The whole suite run by the final verify itself (R2, `server3.txt`): 344 run, 344 pass, 0 fail.
- `git diff --numstat e3ccadc -- server/index.mjs`: `7	2	server/index.mjs`
- Changed files against the base: exactly `server/index.mjs`, `server/lib/invitations.mjs`, `server/test/package-checks.test.mjs`. The `investorPath` and `createInvitations` lines are untouched. The object createInvitations returns is untouched.
- Non-comment lines of invitations.mjs holding `endPackage(`: 5 (the definition and the four call sites, R4).
- Realized diff: 47,873 characters (11,968 tokens at chars/4). The estimate was 95,000.

## Verify lines, verbatim

Task 1 (`SCRATCH/exec-08-15/verify1.sh`, with R4's `-eq 2`):
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 254.101297
VERIFY1 EXIT: 0
```

Task 2 (`verify2.sh`, the plan's command exactly):
```
COUNTS: base 329 + own 8 = 337; run 337
# cancelled 0
# skipped 0
# todo 0
# duration_ms 416.425141
VERIFY2 EXIT: 0
```

Task 3 (`verify3.sh`: the plan's command with R2's whole-suite run, R3's 15 tests, R4's `-eq 5` and the COUNTS line matched as a whole word). It stopped at `grep -qx 'GATE_EXIT=0'`:
```
COUNTS: base 329 + own 15 = 344; run 344
...
VERIFY3 EXIT: 1
```
The conditions after the gate, run on their own (`verify3-rest.sh`):
```
COUNTS word 344: ok
7	2	server/index.mjs
numstat 7/2: ok
investorPath and createInvitations lines untouched: ok
changed files exactly the plan's three: ok
```

## The gate's last lines, verbatim (`SCRATCH/exec-08-15/gate.txt`, P8_SERVER_TESTS=344)

```
GATE ok   server tests # fail 0
GATE ok   server tests 344 (found 344)
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
GATE ok   phase-8 gate checks found (2)
GATE FAIL PACKAGE INVITE (not passed)
GATE ok   PACKAGE PANEL (7)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 344
# pass 344
# fail 0
COUNTS server tests 344; PACKAGE INVITE 0; PACKAGE PANEL 7
GATE_EXIT=1
```

PACKAGE INVITE on the base tree (`base-pi.sh`): `PACKAGE INVITE: FAIL (parts run: 11) - single, declined, phone, list`. On this plan's tree: the same line. The FAIL names in both:
```
FAIL declined the server now holds it and the row no longer reads "Not sent yet"
FAIL list the real server holds the four invitations
FAIL phone the sent request carries the flag and the invitation's id
FAIL single ticked: the box was ticked and the invitation went to the integration server
FAIL single ticked: the real server holds the invitation
```
The gate finished well inside the time limit, so `server-mode.js` and `ways-out.js` were not run alone. Inside the gate they passed: SERVER MODE (15) and WAYS OUT (7).

## RED runs

- Task 1 (`red.txt`, before any code): `not ok 1 - tracer: …`. The stored settings were `{ level: 'x', firm: 'Someone Else' }`, where `{ firm: 'Harbor Ridge Capital' }` was expected.
- Task 2 (`red2.txt`, against a2eb860): # tests 8, # pass 6, # fail 2. `not ok 2 - N3 expired then resent: …` and `not ok 5 - N3 resend: …`, each with `200 !== 409` on the resend.
- Task 3 (`red3.txt`, against 0a7deb5): # tests 15, # pass 8, # fail 7. `not ok 9 - W4 cancel` (0 !== 1900), `not ok 10 - W4 expired` (0 !== 1900), `not ok 11 - W4 completed` (0 !== 1900), `not ok 12 - W4 started` (a test defect, see Failures 2), `not ok 13 - I2 cancel during start` ("the failed start credits the cancelled package", 0 !== 1900), `not ok 14 - provider refusal` (the reply was "Identity check answered 402"), `not ok 15 - start limit` (the fourth start answered 200, not 409).

## Mutation runs (`mutations.txt`: one rule broken in invitations.mjs, the guarding test run, the file restored)

| Rule broken | Test that then failed |
|---|---|
| the gate lets any invitation holding a package through, whatever billing says | N3 refunded |
| the same | N3 credited |
| a sponsor account is let through to the package providers | N1 account calls |
| the account's connector list keeps the package providers | N1 account calls |
| the account rule is applied to the shared and open tokens too | N1 shared token |
| an accepted start does not mark the package started | full tier |
| the full tier's accreditation runs with the sponsor's own settings | full tier (after the assertion was added; it survived before) |
| an accepted start is not recorded as started, so an ending credits it | W4 started |
| cancel does not return the package | W4 cancel |
| purge does not return the package when it sets expired | W4 expired |
| authenticate does not return the package when it sets expired | W4 expired |
| completion does not return the package | W4 completed |
| the start is not held in billing while the provider is called | I2 cancel during start |
| the operator is emailed on every refusal | provider refusal |
| the alert carries a workspace | provider refusal |
| there is no start limit | start limit |
| starts still waiting on the provider are not counted | start limit (after the stand-in fix; it hung before) |

## Tasks

| Task | Commit | What |
|---|---|---|
| 1 (tracer) | a2eb860 | gate, settings, start and connectors on usePackages' object; the 7 added and 2 removed lines of index.mjs; tracer test |
| 2 | 0a7deb5 | resend refuses a returned package; seven tests (N3 x4, N1 x2, full tier) |
| 3 | 42687a2 | endPackage at the four endings, the provider's refusal and the operator's alert, the start limit; seven tests |

## Lines added to shared files

- `server/index.mjs` (7 added, 2 changed away):
  - directly above the connectors answer: `if (req.method === 'GET' && path === '/v1/connectors' && auth && auth.account) return send(res, 200, { connectors: pkg.connectors(describe(env, PROVIDERS)) });` (with a trailing comment)
  - POST /v1/verifications: `pkg.gate(scope, auth, body.provider, body.kind);` directly after the "This check is not one the firm uses" line; `body.settings = pkg.settings(scope, body.provider, body.settings);` above the record put's comment; the createSession line becomes `const r = (await pkg.start(scope, body.provider, () => p.createSession(ctx(body.provider, rec)), body.kind)) || {};`
  - POST /v1/screenings: `pkg.gate(scope, auth, body.provider, 'aml');` directly after the "This screening is not one the firm uses" line; the same settings line directly above the record put; `const r = (await pkg.start(scope, body.provider, () => p.screen(ctx(body.provider, rec, { names })), 'aml')) || {};`
  - Nothing was changed at the admin line, at `invites.sponsor`, in the route list or at the `pkg` line.
- `server/lib/invitations.mjs`: the usePackages return line now lists the helpers. A block of package helpers follows usePackages (isPackage, the start limit, gate, packageSettings, packageStart, alertOperator, endPackage). The four call sites: purge (after the expired put), authenticate (its one expired line now wraps the put and the event in `endPackage(...)`), complete (after the completed put), cancel (after the cancelled put). The resend refusal is three lines after the cancelled check.

## Deviations from Plan

1. **[R3, plan-check addition] The start limit.** It adds the 15th test, so Task 3's verify uses `-eq 15` / `# tests 15` instead of 14. The gate ran with P8_SERVER_TESTS = 329 + 15 = 344.
2. **[R4] Exact counts.** Task 1 checks `-eq 2`, not `-ge 2`. Task 3 checks `endPackage(` with `-eq 5`.
3. **[Rule 2] gate and start take the check's kind as a fourth argument.** The per-kind limit needs it. It adds no line to index.mjs.
4. **[Rule 1] A refused start's event is written on the record as it is at that moment, not on the record read when the request began.** Otherwise a cancel that landed during the start would lose its own `invite_cancelled` event. The start counter is written only if the invitation still exists, so a purged invitation is never brought back as a stub.
5. Two tests were strengthened after a mutation survived, and one test defect was fixed after a false RED (Failures 2 and 3).

## Threat register

T-08-13, T-08-16, T-08-17, T-08-44 and T-08-45 are mitigated by the tests named in the plan. T-08-46 is accepted. **N1 trade-off, recorded as the plan asks:** the shared `API_TOKEN` and an open server belong to the operator, so they still reach the package providers exactly as 08-02 left them ("N1 shared token" proves both). An operator who hands the shared token to a sponsor gives that sponsor the providers for free. The screening-names gap in Failures 4 is a new money surface. The plan's threat model does not list it.

## For the orchestrator

- PACKAGE INVITE needs a plan that may edit `checks/package-invite.js`. Its `consoleOn` should either answer a ticked `POST /v1/invitations` itself, or send it with a sponsor account's token, not the shared one. The parts single, declined, phone and list fail the same way on the base.
- 08-07: show the server's sentences as sent. "This check is not part of this invitation", "This check runs only from an invitation with the verification package.", 502 "This check could not start. Please try again later.", 409 "This check was already started." (with the firm's contact, R3) and 409 "This invitation's package was returned. Send a new invitation.".
- 08-16 / README: the new setting `OPERATOR_EMAIL` (where the "A paid check could not start" alert goes) should be listed in the billing section 08-16 writes.
- Base-tree copies, screenshots, the owner's folder and the node_modules link were deleted after the gate.

## Self-Check: PASSED

- FOUND: server/test/package-checks.test.mjs, server/lib/invitations.mjs, server/index.mjs
- FOUND commits: a2eb860, 0a7deb5, 42687a2 (ancestors of HEAD)
