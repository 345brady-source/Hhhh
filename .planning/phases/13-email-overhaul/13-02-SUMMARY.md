---
phase: 13-email-overhaul
plan: 02
status: in-progress
---

# Phase 13 Plan 02: Mail adapters and the phase gate (in progress)

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
Commit b7c4973. Tracer gate: verify re-run end to end, passed; expanding.

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
Failed at RED, as expected: all of events (5 tests) and the generic adapter (5 tests, file fails to load). Passed at RED, reported plainly: sigv4, records and status (the Task 1 signer and setup already did these; sigv4 reproduced the published signature 5d672d79... on its first run) and senders tests 2-5 (the Task 1 senders.mjs already held those rules). Their power to fail is shown by the mutation runs further down. A first RED run also failed "records" because of a fault in the test itself: it looked for base64 characters 20-80 of the private key, which hold the modulus, and the modulus is public and sits in the DKIM record too. The test now looks only at private parts of the key. Commit d77a01d.

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
The first mutation round did not catch two faults: DMARC offered when the lookup result is unknown, and TXT pieces left unjoined (that one was not tried in the first round). Both tests were made stronger (a9101c9) and now catch these faults.

<!-- gsd:write-continue -->
