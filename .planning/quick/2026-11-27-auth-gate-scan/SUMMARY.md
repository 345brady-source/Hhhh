# Quick task auth-gate-scan: secret-field scan reads field names, not random ids

Written by the orchestrator from the executor's hand-back (the Write was refused). Start 8100e81; commit f216e30 (wip/auth-gate-scan). Tests only.

## Failures first
- Before the fix, auth-gate "operator" failed by chance in about 1.1% of runs: measured with crypto.id('per'), 2195 of 200000 real person ids matched `/pw|emailIndex|salt|hash|session/i` over the response text with no secret field. That was today's two failures.

## Fix
- server/test/helpers.mjs: keysDeep(value), every key at any depth.
- auth-gate "operator": the regex runs over the field names; the exact-shape deepEqual stays. New test "operator scan" (gate: tests 7 -> 8) keeps the RED/GREEN/negative proof.
- accounts.test.mjs:281: /token/i over field names; the real token and its hash are still checked over the whole text.
- Other whole-text scans reviewed and left, with reasons (pinned bodies, hex-only random values, or real-content checks): see the executor's list in the hand-back (roles.test 388, auth-account 167, idcheck, package-checks, read, help, intake, billing).

## Proof
RED old assertion on a clean planted body (id per_Q3pwX9aK_rHL): FAIL. GREEN new assertion: PASS. NEG pwHash key: FAIL; nested session key: FAIL.
Full suite 3 runs: 555/555 each. Merged tree: 555/555.
