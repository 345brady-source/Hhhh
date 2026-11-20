---
phase: 13-email-overhaul
plan: 02
subsystem: server mail (domain setup, delivery events) and the phase 13 gate
status: complete
tags: [email, dkim, dmarc, sigv4, sns, white-label, gate]
requires: []
provides:
  - server/mailers/{index,smtp,ses}.mjs (adapter interface, pick(env) by MAIL_PROVIDER)
  - server/lib/senders.mjs (createSenders: set, check, get, ready; collection 'senders')
  - .planning/phases/13-email-overhaul/checks/gate13.sh (phase gate, self-test PASS (8))
affects: [13-03 (mounts routes, adds the 'senders' store collection, documents settings), 13-10 (owner's account run)]
tech-stack:
  added: []
  patterns: [adapter registry like server/providers, own-key DKIM TXT record, SNS signature check with host allow-list, injectable ctx for every outside call]
key-files:
  created:
    - server/mailers/index.mjs
    - server/mailers/ses.mjs
    - server/mailers/smtp.mjs
    - server/lib/senders.mjs
    - server/test/ses-fake.mjs
    - server/test/senders.test.mjs
    - server/test/mailers-ses.test.mjs
    - server/test/mailers-smtp.test.mjs
    - .planning/phases/13-email-overhaul/checks/gate13.sh
  modified: []
decisions:
  - "Server test count is 387, not 386: node --test counts every file under server/test as one test, so the helper ses-fake.mjs adds 1 (it carries // gate: tests 1, as filings-kit.mjs does)"
  - "A domain that another workspace already sends from is refused with 409 (one sponsor cannot replace another's DKIM key)"
  - "An identity the provider already holds (a sponsor coming back to an earlier domain) gets the new key through PUT .../dkim/signing"
  - "DMARC is offered only when the lookup proves there is no DMARC record (ENOTFOUND/ENODATA), never after a timeout, so the sponsor is never told to add a second DMARC record"
  - "The generic smtp adapter tries common DKIM selectors when none is given"
metrics:
  completed: 2026-11-20
  tasks: 3
  files: 9
actuals:
  tokens: 22200
  tasks: 3
  commits: 10
plan_head_before: 55f811fa8581b63c5598bb61f82dcdf131d44521
plan_head_after: 468c359
---

# Phase 13 Plan 02: Mail adapters and the phase gate Summary

The provider-neutral mail adapters were built and tested against local stand-ins only. The default provider's adapter signs its calls itself (Signature Version 4 from node:crypto) and has the sponsor publish its own DKIM key as a TXT record, so no record the sponsor copies names a vendor. The generic SMTP adapter gives DNS guidance and checks the records. senders.mjs takes a workspace from an address to Ready. The phase 13 gate proves it can fail: `GATE13 SELF-TEST: PASS (8)`. Nothing has touched a live provider, and nothing here shows that live delivery works. That waits for the owner's account run (13-10).

## Failures and departures, first

1. **The server test count is 387, not the expected 386.** The plan assumed `ses-fake.mjs` would not count because its name does not end in `.test.mjs`. But `node --test` (server's `npm test`) runs every `.mjs` under `server/test/`, and a file with no test of its own counts as one passing test, the same way `helpers.mjs`, `smtp-fake.mjs` and `filings-kit.mjs` already count. So the total is 368 + 18 new tests + 1 helper file = 387. `ses-fake.mjs` now carries `// gate: tests 1` (the precedent is `filings-kit.mjs`), so the gate's count rule comes out exact: `server tests 387 = base 368 + 19 declared`. The plan's literal Task 3 verify (base + 18) **exits 1** for this reason alone. The same verify judged by the gate's own rule (v3b.sh) exits 0. Downstream: whoever sets GATE_SERVER_TESTS after this plan merges should use 387 plus later plans, not 386.
2. At RED 2, six of the new tests already passed (sigv4, records, status, and senders tests 2-5), because the Task 1 tracer code already did those things. They were shown able to fail by the mutation runs below.
3. The first RED 2 run failed "records" because of a fault in the test, not in the code. It looked for base64 characters 20-80 of the private key, but those characters encode the public modulus, which the DKIM record rightly carries. The test now looks only at private parts of the key.
4. The first mutation round missed two faults: DMARC offered when the lookup result is unknown, and TXT pieces not joined (W6). Both tests were made stronger (a9101c9) and now catch these faults.

## Evidence as produced

Base commit 55f811fa8581b63c5598bb61f82dcdf131d44521; base server suite (`node --test` in server/):
```
# tests 368
# pass 368
# fail 0
```

### RED 1 (Task 1, `node --test test/senders.test.mjs`, red-1.txt)
```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../server/lib/senders.mjs' imported from .../server/test/senders.test.mjs
not ok 1 - test/senders.test.mjs
# tests 1
# pass 0
# fail 1
```
Commit 77728ea.

### Verify 1 (Task 1, plan's automated verify, exit 0)
```
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 218.120084
VERIFY1 exit=0
```
Commit b7c4973. Tracer gate: the verify was run again end to end and passed, so the remaining tasks went ahead.

### RED 2 (Task 2, the three test files, red-2.txt)
```
ok 1 - sigv4: the published example request signs to the published signature; a changed body changes it
ok 2 - records: one DKIM TXT record holding the key sent to the provider, DMARC only when none exists, no vendor word, private key kept nowhere
ok 3 - status: SUCCESS and verified is ready, PENDING pending, FAILED failed with its sentence, a 403 holds no key or secret
not ok 4 - confirm: a subscription is confirmed only at an https sns host for the configured topic
not ok 5 - signature: versions 1 and 2 verify; a changed Message, no Signature, a certificate on another host or a two-hour-old Timestamp is refused
not ok 6 - bounce: a permanent bounce maps to bounced/permanent, a transient one to permanent false
not ok 7 - complaint and delivery: notificationType and eventType forms both map
not ok 8 - malformed: not JSON or no Type is 400; a body over 256 KB is refused before it is parsed
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../server/mailers/smtp.mjs' imported from .../server/test/mailers-smtp.test.mjs
not ok 2 - test/mailers-smtp.test.mjs
ok 10 - tracer: ...
ok 11 - bad address: ...
ok 12 - change address: ...
ok 13 - workspaces: ...
ok 14 - nothing secret: ...
# tests 14
# pass 8
# fail 6
```
Commit d77a01d. The sigv4 test matched the provider's published example signature `5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7` and its canonical-request hash `f536975d...` on its first run.

### Verify 2 (Task 2, plan's automated verify, exit 0; rerun after the tests were made stronger in a9101c9)
```
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1362.299057
VERIFY2 exit=0
```
Commits b721684 (code) and a9101c9 (stronger tests).

### Mutation runs (the tests that passed at RED can fail; mutations.txt)
Each mutation was put into the code, the named test was run, and the code was put back:
```
caught: workspaces        (another workspace's domain no longer refused)
caught: change address    (same domain sets up again)
caught: bad address       (validAddress skipped)
caught: nothing secret    (private key leaked into the stored ref)
caught: sigv4             (wrong signing-key scope)
caught: status            (FAILED no longer recognised)
caught: records           (DMARC offered when the lookup is unknown)
caught: check ready       (TXT pieces not joined, W6)
caught: records           (TXT pieces not joined, W6)
```

### RED 3 (Task 3, gate11.sh copied with the phase renamed plus the new self-test, red-3.txt)
```
SELF-TEST FAIL control: the stand-ins pass when nothing is wrong
SELF-TEST FAIL control: GATE13_PHASES=none and no phase 13 check
SELF-TEST ok   a phase 13 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
SELF-TEST FAIL a phase 08 gate check that prints no PASS line
SELF-TEST FAIL GATE13_PHASES naming a phase (12) whose check's last line differs
GATE13 SELF-TEST: FAIL - control none p08 phases
```
Commit 2b98689.

### Verify 3 (Task 3, final tree 468c359; v3b.sh = the plan's verify with the count judged by the gate's rule)
```
SELF-TEST ok   control: the stand-ins pass when nothing is wrong (base tree passed as P13_BASE and P10_BASE, P10_ROOT unset, phase 8 through the heavy queue, phase 12 not named and not run; never the line of a real gate)
SELF-TEST ok   control: GATE13_PHASES=none runs no other phase, and a tree with no phase 13 check says so and passes
SELF-TEST ok   a phase 13 check whose last line differs from its marker
SELF-TEST ok   a check file with no marker
SELF-TEST ok   a reference whose folder line is missing (and nothing was run)
SELF-TEST ok   a reference that prints one GATE FAIL line
SELF-TEST ok   a tree whose test count differs from the base plus the markers
SELF-TEST ok   a phase 10 check whose last line differs from its marker
SELF-TEST ok   a phase 08 gate check that prints no PASS line
SELF-TEST ok   GATE13_PHASES naming a phase (12) whose check's last line differs
GATE13 SELF-TEST: PASS (8)
# tests 387
# suites 0
# pass 387
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16703.929154
marker: server/test/mailers-ses.test.mjs 8 (base 0)
marker: server/test/mailers-smtp.test.mjs 5 (base 0)
marker: server/test/senders.test.mjs 5 (base 0)
marker: server/test/ses-fake.mjs 1 (base 0)
server tests 387 = base 368 + 19 declared (plan's literal expectation base + 18 = 386)
VERIFY3B exit=0
VERIFY3 (plan literal) exit=1
```
server/index.mjs, server/lib/store.mjs and server/lib/mail.mjs are unchanged since the base commit (part of v3b's last test). No full gate run was made: the plan does not ask for one, because this plan mounts nothing and adds nothing that a page loads.

## What was built

- **server/mailers/ses.mjs**: `signRequest` (SigV4). Setup makes a 2048-bit RSA key pair and a selector `cv` + 8 characters, sends the private key once in `POST /v2/email/identities` (`PUT .../dkim/signing` when the identity already exists) and keeps it nowhere. It returns the DKIM TXT record `v=DKIM1; k=rsa; p=<public key>` at `<selector>._domainkey.<domain>`, plus `_dmarc` `v=DMARC1; p=none` only when there is surely no DMARC record. Status: SUCCESS + VerifiedForSendingStatus → ready; FAILED → failed with the plan's sentence; anything else → pending. Events: refused over 256 KB (413), 400 for bad JSON, no Type or an unknown Type, 401 unless the TopicArn is MAIL_EVENTS_TOPIC_ARN, the Timestamp is within one hour and the SignatureVersion 1/2 signature verifies with a certificate from `https://sns.<region>.amazonaws.com/...pem` (no port or user part; checked before any fetch; certificates cached per fetcher). Subscriptions are confirmed by one GET through ctx.transport at an allowed host. Bounce, Complaint and Delivery events map to `{ relayId, messageId, type, permanent, at }`; other event kinds give []. Errors carry an HTTP status and a plain sentence, never a key, a secret or a provider host. No open or click tracking is requested (C-10).
- **server/mailers/smtp.mjs**: guidance records (SPF/DKIM placeholders that say what to copy from the sponsor's own mail provider, and DMARC `v=DMARC1; p=none`). Checks run through an injectable resolver with TXT pieces joined (W6). Each missing record is named in the pending sentence. ENOTFOUND on the domain or a timeout → pending with "The DNS records are not visible yet.", never a thrown error. No events.
- **server/mailers/index.mjs**: `MAILERS = { smtp, ses }`; `pick(env)` (smtp when unset; prototype keys refused).
- **server/lib/senders.mjs**: `createSenders({ store, vault, env, adapter, now, ctx })` with set/check/get/ready, using store.get/put/list only. It stores `{ id: workspace, workspace, address, domain, selector, records, status, detail, checkedAt, provider, ref }`. The `vault` parameter is accepted and unused: nothing secret is kept.
- **gate13.sh**: gate11 with step 3 (GATE13_PHASES over 08-12; phase 08 by `// GATE CHECK:` lines through heavy.sh) and step 4 (phase 13 checks with P13_BASE; "none in this tree"), as the plan describes. GATE13_HEAVY is a stand-in-only setting that lets the self-test prove phase 8 runs through the heavy queue without waiting on the shared browser slots.

## Deviations from Plan

**1. [Rule 1 - Bug in the plan] The server count is 387 (helper file counted by the runner).** See Failures 1. Fix: `// gate: tests 1` on ses-fake.mjs. Commit 05072ff.

**2. [Rule 2 - Security] Cross-workspace domain refusal (409).** Without it, workspace B could set an address on workspace A's domain, and B's setup would replace the identity's DKIM key, breaking A's sending. Tested in "workspaces". Commit b7c4973.

**3. [Rule 1 - Bug] Existing identity handled.** A sponsor who switches domains and comes back would get a 409 from the provider. The adapter now gives the existing identity the new key (`PUT /v2/email/identities/{domain}/dkim/signing`). Tested in "change address".

**4. [Rule 2 - White label] Settings errors name no vendor.** The first version named the operator settings (`SES_REGION ...`) in error messages that 13-03 might show to a sponsor. Commit 468c359.

**5. File-list order.** index.mjs was written in Task 1 with only `ses` and gained `smtp` in Task 2 (smtp.mjs is a Task 2 file). The ctx gained `selector` and `publicKey` (they pass the stored selector to status, and the key to records). No other interface changed.

**6. Stronger tests than listed:** the tracer checks that the stand-in received exactly the bytes and headers that were signed. Records checks that the published key is the public half of the key the provider received. Signature also refuses a non-.pem certificate path, another topic and a forger's key. Confirm also refuses the cloud metadata address.

## [ASSUMED] about the provider (only the owner's account run, 13-10, can confirm)

- The v2 paths and bodies: `POST /v2/email/identities` with `DkimSigningAttributes { DomainSigningSelector, DomainSigningPrivateKey }` and `ConfigurationSetName`; `GET /v2/email/identities/{domain}` answering `VerifiedForSendingStatus` and `DkimAttributes.Status`; `PUT /v2/email/identities/{domain}/dkim/signing` with `SigningAttributesOrigin: 'EXTERNAL'`; 409 for an existing identity.
- `DomainSigningPrivateKey` as base64 PKCS#1 DER (the PEM body without its header lines).
- SigV4 service name `ses` and host `email.<region>.amazonaws.com`.
- The event message shapes: `eventType` (configuration-set publishing) or `notificationType` (identity notifications); `bounce.bounceType 'Permanent'`; `mail.messageId`; `mail.commonHeaders.messageId` holding our Message-ID with its angle brackets.
- SNS certificate hosts match `sns.<region>.amazonaws.com`, and the string to sign is as documented.
- Note for 13-10 (from the plan check): with bring-your-own-key DKIM and no custom MAIL FROM, raw headers carry the provider's Return-Path and a second DKIM signature in the provider's domain. The visible message and the copied DNS records stay white label.

## Planner's choice the owner may reverse

The sponsor publishes its own DKIM key as a TXT record, so no copied record names a vendor. The alternative is the provider's three CNAME records, which name the provider.

## Known Stubs

None. `pick`'s message 'MAIL_PROVIDER must be smtp or ses' is an operator start-up message, worded as the plan's interface specifies.

## Threat Flags

None beyond the plan's threat model. T-13-04/05/06/07/08 are mitigated and tested (signature, confirm, records, nothing secret, malformed, workspaces). No route is mounted (13-03).

## Commits

77728ea, b7c4973, d77a01d, b721684, a9101c9, 6d9ab2a (save), 2b98689, 57e868b, 05072ff, 468c359 (all on wip/13-02).

## Self-Check: PASSED

All 9 created files exist at 468c359. All 10 commits are ancestors of HEAD. server/node_modules link removed.
