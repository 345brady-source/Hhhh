# Quick fixes: audit onboarding guard; package start provider failures

**Not yet checked by the owner.** Server tests 389 (387 + 2).

## Failures and open points first
1. Open decision, taken by the orchestrator: on a provider failure the investor sees the plain sentence without the firm's contact. The client (assets/js/integrations.js:920) adds the contact only on a 403 or 409, and package-flow's `refused` part asserts the sentence alone. Adding the contact on every package failure is queued after 08-19 merges (08-19 owns integrations.js this wave).
2. The new server tests went into a save commit (695e748), not their own test commit. RED was still shown before the fix.
3. The timeout test uses an AbortError stand-in (the same path as the 15-second timer); no test waits the full 15 seconds.

## What changed
- assets/js/audit.js: the investor register reads `(i.onboarding || {}).status`, so a missing block shows "Invited" instead of throwing. New check checks/no-onboarding.js (phase 11, 3 cases).
- server/lib/invitations.mjs packageStart: every provider failure (refusal, 5xx, timeout, network error, malformed answer) returns 502 "This check could not start. Please try again later."; the package stays valid and unstarted; the invitation records package_check_failed; the event log keeps the provider's status, never its words. The operator's balance-and-keys email is still only for 402 and 403. Two tests added to server/test/package-checks.test.mjs.

## Verify
NO ONBOARDING: PASS (3); STATEMENTS: PASS (8); SAMPLES BOOKS: PASS (7); AUDIT SAME: PASS (4), 928 schedules and 60 packages identical; REPORTS MATH: PASS (13); PACKAGE INVITE: PASS (12); PACKAGE FLOW: PASS (7); server tests 389 pass, 0 fail.
