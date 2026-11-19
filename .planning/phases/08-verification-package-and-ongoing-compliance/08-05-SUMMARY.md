---
phase: 08-verification-package-and-ongoing-compliance
plan: 05
subsystem: integration server (invitations, verification package)
tags: [verification-package, billing, invitations, D-01, N1, N2, W5, W9, I1, node-test]
status: complete
requires:
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "08-01 sponsor accounts (auth.account); 08-02 idcheck plug-in; 08-04 billing.mjs (entitle, find, consume, release, available); 08-06 gate.sh and the invite form's package flag"
provides:
  - "server/lib/invitations.mjs: usePackages({ billing, providers, identity, accreditation }) -> { packageState } (08-15 adds its helpers here)"
  - "create's package path: account only, server tier, entitle before the token/record/blobs, already_sent pre-check, consume after store.put with roll-back, email after"
  - "rec.package = { entitlement, tier, account, key }; packageState(rec) -> { tier, status, usable }; rows carry package null or { tier, status }"
  - "server-built connections package-id and package-acc; N1 create part: an account's claimed package connections are dropped"
  - "reply codes on POST /v1/invitations: account_required 403, package_unavailable 409, already_sent 409, tier_mismatch 409, package_used 409, card_declined / authentication_required / no_card 402, billing_unavailable 409, 400 for a bad clientId"
  - "server/test/package.test.mjs: 15 top-level tests"
affects: [08-06, 08-07, 08-09, 08-13, 08-15, 08-16]
tech-stack:
  added: []
  patterns:
    - "Money before storage: entitle is awaited before the token, record or blob; nothing awaits between entitle and consume"
    - "Store wrapper in tests logs every put/remove in order and tracks blob keys, so order and roll-back are asserted directly"
key-files:
  created:
    - server/test/package.test.mjs
  modified:
    - server/lib/invitations.mjs
    - server/index.mjs
key-decisions:
  - "W5 reads the raw request flags (invitation.access or invitation.taxRequest true): no package is ever paid on such a request, even one whose flags the cleaner then drops"
  - "A billing throw without a 4xx status is answered 409 billing_unavailable with billing's 'could not be confirmed' sentence, never 'Nothing was charged'"
  - "usePackages returns { packageState } so 08-15 reads the row state from the same function"
  - "R7 is proved inside the 'already sent' test (no extra top-level test, so the count stays 15)"
requirements-completed: []
requirements-addressed: [VPK-02, VPK-04, VPK-05]
duration: "11 min of code (18:45 to 18:56 UTC), then the phase gate ran 2 h and was stopped at the background limit"
completed: 2026-11-19
actuals:
  tokens: 10769
  tasks: 3
  commits: 3
plan_head_before: 2163866402571e8f8b89e3347a98fce96416d3b4
plan_head_after: f806bfb63a4ff6131a0de494e20dfe25c47550d1
---

# Phase 08 Plan 05: The package attached when an invitation is created, Summary

**When a sponsor account ticks the package, the server works out the tier, takes payment at its own price (credit first, then the card), stores the invitation, ties the package to it and only then prepares the email. A refusal at any step leaves the invitations, files, outbox and billing tables as they were. The investor never sees a price.**

This is not done. The owner has not checked it, and the phase gate did not pass (failures below). The proof so far is the server's own tests, run against a stand-in payment provider. No provider was called and no key was used.

## Failures first

1. **The phase gate ended without GATE_EXIT=0.** The background run hit the 2-hour limit while the shared browser queue was busy with other agents' gates, so it was stopped. It had already printed every step up to the signing comparison. The signing and record base-vs-plan comparisons never finished. It was not restarted, because the run already had the longest limit allowed.
2. **GATE FAIL PACKAGE INVITE (parts single, declined, phone). This plan caused it.** 08-06's browser check (`checks/package-invite.js`) runs the real server with the shared `API_TOKEN`, stubs only `GET /v1/billing`, and lets the ticked `POST /v1/invitations` through to the real server. Before this plan the server ignored the flag. Now a shared-token package invitation is refused with `403 account_required`, as this plan's contract and N1 require (test "shared token:"). Seen on screen: `"emailError":"Card payments need a sponsor account."`, `"serverId":""`. The fix belongs in `package-invite.js`, which this plan may not edit. It is described under "For the orchestrator" below.
3. **GATE FAIL MEASURE was already failing in the base, not caused by this plan.** The leak step reports `1 place(s) with a run of eight words from the owner's documents ... assets/js/taxdocs.js:531` (rule 5.08 text, added by 10-02, commit 324b5ce). Evidence: `assets/` has no change against base 2163866, and `taxdocs.js` is byte-identical to the base copy. walkA, walkB and walkC passed.
4. Six of the seven Task 2 tests and six of the seven Task 3 tests were already green in their RED runs, because Task 1 had already built those rules (the plan put them in Task 1). Each one was then seen failing under a recorded mutation of the one rule it guards (list below), as the plan allows.

## Measured

- Server tests: base 272 (run at 2163866 before any edit). Package tests: 15. Whole suite after (R2): 287 run, 287 pass, 0 fail.
- The final verify's COUNTS line, verbatim: `COUNTS: base 272 + own 15 = 287; run 287`
- `git diff --numstat 2163866 -- server/index.mjs`: `1	0	server/index.mjs`
- Changed files against the base: exactly `server/index.mjs`, `server/lib/invitations.mjs`, `server/test/package.test.mjs`. Lines removed from invitations.mjs: 0. The `investorPath` and `createInvitations` lines are untouched.
- Realized diff: 43,075 characters (10,769 tokens at chars/4), against an estimate of 95,000.
- The N2 race test was run 5 times in a row: 5 passes.

## The gate's last lines, verbatim (`SCRATCH/exec-08-05/gate.txt`, as written when the run was stopped)

```
PACKAGE INVITE: FAIL (parts run: 9) - single, declined, phone
GATE ok   server tests # fail 0
GATE ok   server tests 287 (found 287)
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE FAIL MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   phase-8 gate checks found (1)
GATE FAIL PACKAGE INVITE (not passed)
GATE ok   base is an ancestor of HEAD and HEAD moved
```

No COUNTS line and no GATE_EXIT line were printed. The run was stopped during the signing base comparison, before it printed them.

## RED runs

- Task 1 (`red.txt`): `not ok 1 - tracer: a sponsor account’s package invitation is paid before it is stored and emailed, and its row shows the paid package` (expected 1 charge, actual 0).
- Task 2 (`red2.txt`, against ca131ed): `not ok 8 - already sent: ...`. Result: # tests 8, # pass 7, # fail 1.
- Task 3 (`red3.txt`, against 989fb41): `not ok 10 - claimed connections: ...`. Result: # tests 15, # pass 14, # fail 1.

## Mutation runs (`mutations.txt`: one rule broken in invitations.mjs, the guarding test run, the file restored)

| Rule broken | Test that then failed |
|---|---|
| consume runs before the record is stored | N2 order |
| no roll-back of the record and its files when consume refuses | N2 together (also re-run after the already-sent pre-check: still fails, so the race reaches consume's refusal) |
| the tier ignores the offering's accreditation answer | N2 tier |
| the package is looked up before it is paid (no entitle when the key has an entitlement) | N2 prepaid 25 hours |
| the package is looked up by client id alone, not by account | N2 other account |
| a billing refusal is sent without its code | refused charge |
| the shared token is let through to the payment as if it were an account | shared token |
| the claimed connections are stripped for every caller, the shared token included | shared token |
| the tier's availability is not checked | unavailable |
| the package flag is kept on a portal link and a tax-form request (W5) | W5 flags |
| the investor's view carries the package state | W9 investor view |
| the row reads the key's newest entitlement instead of the invitation's own | rows |
| the level sent in the request is believed | amounts |

## Tasks

| Task | Commit | What |
|---|---|---|
| 1 (tracer) | ca131ed | usePackages, the package path in create (N2 order and roll-back), package-id connection, the row's package line, the one line in index.mjs |
| 2 | 989fb41 | already_sent pre-check and release of an ended package; seven money-rule tests (R7 inside "already sent") |
| 3 | f806bfb | N1 create part (claimed connections dropped for accounts only); seven tests |

## Lines added to shared files

- `server/index.mjs`: one line, directly after `const billing = createBilling(...)`:
  `const pkg = invites.usePackages({ billing, providers: PROVIDERS, identity: env.PACKAGE_IDENTITY_PROVIDER || 'idcheck', accreditation: env.PACKAGE_ACCREDITATION_PROVIDER || 'accredit' }); // the package on invitations (08-05); 08-15 adds its route helpers`
  Nothing was changed at the admin line, at `invites.sponsor` or in the route list.
- `server/lib/invitations.mjs` (all added lines, none removed): the PACKAGE_KEY / PACKAGE_IDS / PACKAGE_SAYS block after `NOTIFICATION_KINDS`; the package block after `dropBlobs` (usePackages, refusePackage, billingRefusal, packageState, packageRow, stripReserved, packageConnections); `package: packageRow(rec),` on its own line in listView, between importedAt and events; in create, the read of the flag and clientId after the taxPrefill line, the strip and the payment block after `consoleUrl`, `if (paid) rec.package = paid;` and the consume-with-roll-back block around `store.put('invitations', rec)`; `usePackages,` on its own line in the returned object, after `vault,`.

## Deviations from Plan

1. **[Rule 2] Unknown billing errors do not claim "Nothing was charged".** A throw without a 4xx status answers 409 `billing_unavailable` with billing's "The payment could not be confirmed. Try again in a few minutes." sentence. billing.mjs catches every provider error itself, so this path is only a safeguard.
2. **W5 reads the raw request flags** (`invitation.access` / `invitation.taxRequest` true). This is stricter than the cleaned object: no request the console marks as a portal link or tax request can ever pay.
3. **R7 has no top-level test of its own.** It is asserted at the end of "already sent" (a started package whose invitation was cancelled: the same client id answers 409 `package_used`, with no charge and nothing stored), so the plan's count of 15 holds.
4. The gate did not run to completion (Failures 1 to 3).

## Known limits

- If a blob write or the seal throws after entitle returns (a disk error), the payment stays paid and unconsumed. A retry with the same client id uses it, and M3 returns it as credit after 24 hours. Nothing is charged twice.
- Cancel, purge and expiry do not yet release a package (W4 is 08-15). Until then, the next create with the same client id releases it through the pre-check.

## For the orchestrator, 08-15 and 08-16

- **To make PACKAGE INVITE pass again (needs a plan that may edit `checks/package-invite.js`):** in `consoleOn`, the default `POST /v1/invitations` handler should stand in for the server's reply when the request carries `invitation.package === true` (for example, forward the request to the real server with `package` and `clientId` removed, and return its reply), or the parts single, declined and phone should check what was sent rather than what the real server holds. The server's refusal of a shared-token package invitation is correct and stays. Show the RED first, with these three parts failing on this tree.
- 08-15: `const pkg` in index.mjs is the object usePackages returns. It holds `packageState`, where `usable` is N3's gate condition (`e.id === rec.package.entitlement && e.status === 'consumed' && e.invitationId === rec.id`). `stripReserved` covers create only; the verification and screening routes and the connector list are still open to accounts. create calls `billing.release` in one place only (the pre-check). W4's helper should release at cancel, purge, authenticate-expiry and complete.
- 08-16 / 08-14: the row maps `refunded`, `disputed`, `refunding` and anything unknown to "refunded" (I1). Only `consumed` is usable.
- 08-07: the server's sentences arrive as `{ error, code }`. `tier_mismatch` and `package_used` (R7) are the two the console must show as sent.
- Base-tree copies, screenshots and the node_modules link were deleted after the gate.

## Self-Check: PASSED

- FOUND: server/test/package.test.mjs, server/lib/invitations.mjs, server/index.mjs
- FOUND commits: ca131ed, 989fb41, f806bfb (ancestors of HEAD)
