---
status: investigating
trigger: "status-flow.js part flag: FAIL flag Approve works as before on the flagged request :: pending (full reference gate, merged tree, STATUS FLOW: FAIL (parts run: 26) - flag)"
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

hypothesis: H1 (orchestrator's lead) decide() refuses the approve because fa-req has an unsigned agreement envelope (plan 06-34 B2)
test: read how the flag part creates fa-req and what unsignedAgreement() needs to refuse
expecting: fa-req has envelopeId and the investor's signer is not signed -> H1 true; otherwise H1 refuted
next_action: reproduce the part alone through heavy.sh with --only flag and capture the toast text after the click

## Symptoms

expected: clicking Approve on the flagged (Reg A Tier 2, not attested) request fa-req sets its status to approved
actual: status stays "pending" after one click (check output `:: pending`)
errors: FAIL flag Approve works as before on the flagged request :: pending
reproduction: node status-flow.js --only flag (through .planning/tools/heavy.sh)
started: seen on the merged tree after plan 06-34 (and 06-35..06-39) merged today

## Eliminated

## Evidence

- timestamp: 2026-11-20
  checked: status-flow.js flag part (line ~1535) - how fa-req is made
  found: fa-req comes from NS.ops.submitSubscription(ws, i, o, { cents, signature: name }) with no opts.envelopeId, so the request has no envelopeId and signedAt is set to now (operations.js:238)
  implication: operations.js unsignedAgreement() returns false at its first test (`!r.envelopeId` -> false), so the 06-34 rule cannot refuse this request. H1 is refuted by reading; to be confirmed by running.

- timestamp: 2026-11-20
  checked: console.js:2252 req-approve handler
  found: before decide(), when NS.integrations.active(ws) and subscribeGate(ws, inv, o) returns a gate, the first click only sets ui.reqOverride and toasts "... is not fully verified: ... Click Approve again to approve anyway." and returns; decide() runs on the second click
  implication: H2 candidate - the check clicks once; if the integrations are active and the cloned investor is not verified for this offering, status stays pending after one click

## Resolution

root_cause:
fix:
verification:
files_changed: []
