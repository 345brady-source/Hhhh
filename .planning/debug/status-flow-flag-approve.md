---
status: awaiting_human_verify
trigger: "status-flow.js part flag: FAIL flag Approve works as before on the flagged request :: pending (full reference gate, merged tree, STATUS FLOW: FAIL (parts run: 26) - flag)"
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

hypothesis: CONFIRMED H1 - fa-req genuinely carries an unsigned subscription agreement envelope (esign.js wraps ops.submitSubscription), so decide() rightly refuses (06-34 B2). The check is out of date; the product rule stays.
bug_class: Bohrbug (deterministic, fails every run of --only flag)
reasoning_checkpoint:
  hypothesis: "the flag part's Approve click is refused by operations.js decide() (unsignedAgreement) because esign.js:2963 wraps submitSubscription and sends the offering's subscription agreement, so fa-req has envelopeId env-..., signedAt '' and the investor's signer is not signed"
  confirming_evidence:
    - "probe: fa-req before the click = {envelopeId: env-mwohqg78n33ro, signedAt: '', status: pending}"
    - "probe: the toast after the click is exactly 'The subscription agreement is not signed yet.' (operations.js NOT_SIGNED); subscribeGate is null so the DIY second-click gate is not involved"
    - "toasts 'Signature request emailed to Avery Unticked / Blake / Casey (simulated in this demo)' = createFromTemplate sent one envelope per request"
  falsification_test: "after the investor signs fa-req's envelope from their portal, Approve still leaves it pending -> H1 wrong (something else refuses)"
  fix_rationale: "the part tests that the Reg A flag blocks nothing; it must not approve an unsigned subscription. Signing first keeps the tested behaviour and the 06-34 rule"
  blind_spots: "signing could trigger automatic acceptance (no firm field) - guarded by asserting still pending + flagged before the click"
  candidate_causes:
    - "code: decide() 06-34 rule refuses (confirmed)"
    - "code/config: DIY subscribeGate second-click (refuted: gate null)"
    - "data: check builds requests with an envelope via the esign wrapper (confirmed - this is the cause the check did not account for)"
  and_gate: "yes, two conditions together: (1) 06-34 added the refusal, (2) setupPortal gives the offering a ready agreement so the esign wrapper sends an envelope for every submitSubscription; 06-34 ran only --only back,erisa so flag was never re-measured"
next_action: orchestrator reviews and merges wip/debug-flag; owner check. Not moved to resolved/ (no human confirmation yet).

## Symptoms

expected: clicking Approve on the flagged (Reg A Tier 2, not attested) request fa-req sets its status to approved
actual: status stays "pending" after one click (check output `:: pending`)
errors: FAIL flag Approve works as before on the flagged request :: pending
reproduction: node status-flow.js --only flag (through .planning/tools/heavy.sh)
started: seen on the merged tree after plan 06-34 (and 06-35..06-39) merged today

## Eliminated

- hypothesis: H2 the DIY verification gate (console.js:2255 subscribeGate) swallows the first Approve click
  evidence: probe shows subscribeGate(ws, fa-inv, offering) === null and the toast is the 06-34 NOT_SIGNED text
  timestamp: 2026-11-20

## Evidence

- timestamp: 2026-11-20
  checked: status-flow.js flag part (line ~1535) - how fa-req is made
  found: fa-req comes from NS.ops.submitSubscription(ws, i, o, { cents, signature: name }) with no opts.envelopeId, so the request has no envelopeId and signedAt is set to now (operations.js:238)
  implication: operations.js unsignedAgreement() returns false at its first test (`!r.envelopeId` -> false), so the 06-34 rule cannot refuse this request. H1 is refuted by reading; to be confirmed by running.

- timestamp: 2026-11-20
  checked: console.js:2252 req-approve handler
  found: before decide(), when NS.integrations.active(ws) and subscribeGate(ws, inv, o) returns a gate, the first click only sets ui.reqOverride and toasts "... is not fully verified: ... Click Approve again to approve anyway." and returns; decide() runs on the second click
  implication: H2 candidate - the check clicks once; if the integrations are active and the cloned investor is not verified for this offering, status stays pending after one click

- timestamp: 2026-11-20
  checked: RED reproduction - heavy.sh node status-flow.js --only flag
  found: "FAIL flag Approve works as before on the flagged request :: pending" / "STATUS FLOW: FAIL (parts run: 1) - flag" (deterministic, 5.7 s)
  implication: Bohrbug, reproduces alone

- timestamp: 2026-11-20
  checked: scratch probe copy of the flag part (scratchpad/debug-flag/probe.js) logging fa-req, integrations gate and toasts around the click
  found: fa-req {envelopeId: "env-mwohqg78n33ro", signedAt: "", status: pending}; integrations active, subscribeGate null; toast after click "The subscription agreement is not signed yet."; earlier toasts "Signature request emailed to Avery Unticked ... (simulated in this demo)"
  implication: the first Evidence entry was wrong about the request (read from operations.js only): esign.js:2963 wraps ops.submitSubscription and, with the offering's agreement ready (L.setupPortal), sends an envelope and passes opts.envelopeId, so signedAt is ''. decide() refuses per 06-34. H2 (DIY second click) refuted.

- timestamp: 2026-11-20
  checked: 06-34-SUMMARY.md failures-first item 2 and its run lines
  found: 06-34 changed status-flow `back` (approved an unsigned subscription -> now declines) but ran status-flow only with --only back,erisa; `flag` was never re-run on 06-34
  implication: the flag part is an out-of-date check of the same class as back and signing-documents countersign; product rule is right

- timestamp: 2026-11-20
  checked: falsification test - status-flow --only flag on the check fix (Avery signs from their portal, then Approve)
  found: "PASS flag Avery signs the agreement first (plan 06-34 B2); the request is still pending, flagged, with Approve" / "PASS flag Approve works as before on the flagged request" / "STATUS FLOW: PASS (parts run: 1)"
  implication: once the investor's signer is signed, decide() allows the approve; nothing else refuses. H1 holds.

- timestamp: 2026-11-20
  checked: server tests (server/, npm test, node_modules linked)
  found: # tests 368 / # pass 368 / # fail 0
  implication: no server regression (no product file changed)

## Resolution

root_cause: out-of-date check, not a product bug. status-flow.js part flag (Approve click, was line 1571) approved fa-req, a subscription made with NS.ops.submitSubscription, which esign.js:2963-2989 wraps to send the offering's subscription agreement (envelopeId set, signedAt ''). Plan 06-34 B2 (merge 1b9eacb) made operations.js decide() (lines 263-276, unsignedAgreement at 251-256) refuse an approve while the investor's own signer has not signed, which is the intended rule. 06-34 updated status-flow `back` but ran only --only back,erisa, so `flag` kept approving an unsigned subscription.
fix: status-flow.js flag part - before the Approve click, Avery signs fa-req's agreement from their own portal (asInvestor -> #sign-<envelopeId>, consent, signature, Finish); a new line asserts the investor's signer is signed and the request is still pending, flagged and offers Approve; the Approve assertion itself is unchanged. Reason and plan written above it. operations.js untouched (the rule stays).
oracle_type: specified (status === 'approved' after the documented approve action; precondition investor signer === 'signed')
verification:
  red: "FAIL flag Approve works as before on the flagged request :: pending" / "STATUS FLOW: FAIL (parts run: 1) - flag" (base 50b29d7, --only flag)
  falsification: probe toast "The subscription agreement is not signed yet."; after Avery signs, Approve works (H1 holds)
  status_flow_full: "STATUS FLOW: PASS (parts run: 26)" - 415 PASS / 0 FAIL / 0 KEPT (GATE_FRESH=1)
  record_and_lost_agreement: "RECORD AND LOST AGREEMENT: PASS (parts run: 7)" - 180 PASS / 0 FAIL
  forms_flow: "FORMS FLOW: PASS (cases run: 2)" --case editsigned,unsigned - 30 PASS / 0 FAIL (forms-flow's flag is --case, not --only; --only would be ignored and run all 34)
  signing_documents: "SIGNING DOCUMENTS: PASS (parts run: 1)" --only countersign-desktop - 33 PASS / 0 FAIL
  server_tests: "# tests 368 / # pass 368 / # fail 0"
  guardrail_note: check-only change; operations.js decide() rule unchanged, still guarded by record-and-lost-agreement (lost-* B2 lines) and signing-documents countersign (B2 refusal line)
  guardrail_verdict: accepted
files_changed: [.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js]
