---
phase: 08-verification-package-and-ongoing-compliance
plan: 02
subsystem: integration server (code plug-in for identity and sanctions screening)
status: complete
tags: [identity, sanctions-screening, monitoring, webhooks, plug-in, white-label, unconfirmed-shapes]
requires: []
provides:
  - "server/plugins/idcheck.mjs: id idcheck, name Identity check, kinds identity and aml, env IDCHECK_API_KEY, IDCHECK_WORKFLOW, IDCHECK_WEBHOOK_SECRET; exports createSession, fetchResult, screen, verifyWebhook, parseWebhook, webhookResult, ASSUMED"
  - "a screening hit never rejects an investor: fetchResult answers failed only when the ID, liveness or face part itself was declined"
  - "two webhook schemes on the existing POST /webhooks/idcheck route (no server change): session deliveries re-read the decision, monitoring alerts hold only"
  - "eight fixtures in server/test/fixtures/idcheck/, each naming its documentation source and marked unconfirmed"
affects: [08-04, 08-05, 08-07, 08-12, 08-13]
tech-stack:
  added: []
  patterns:
    - "every detail the documentation left open sits in one exported ASSUMED block that the code and the tests both read, so plan 08-12 corrects a constant in one place"
    - "the test file takes the provider's name and domain from a fixture's source line, so the file itself holds no provider word and can assert none leaks"
key-files:
  created:
    - server/plugins/idcheck.mjs
    - server/test/idcheck.test.mjs
    - server/test/fixtures/idcheck/session-created.json
    - server/test/fixtures/idcheck/decision-approved.json
    - server/test/fixtures/idcheck/decision-in-review.json
    - server/test/fixtures/idcheck/decision-declined-screening.json
    - server/test/fixtures/idcheck/webhook-status-updated.json
    - server/test/fixtures/idcheck/webhook-new-hit.json
    - server/test/fixtures/idcheck/aml-clear.json
    - server/test/fixtures/idcheck/aml-hit.json
  modified: []
decisions:
  - "A delivery names one record, not two: our own id when the provider echoes it, otherwise the provider's session id. The server loops over every ref it is given without de-duplicating records, so returning both (as the plan wrote) read the decision twice per delivery."
  - "A session the provider declined with no ID, liveness or face part declined reads review, whether or not a screening is flagged. B1 says failed only when a non-screening part is declined; this also keeps a wrong guess about the per-part field name from ever turning into an automatic rejection."
  - "An alert that holds nothing names no record, so the server touches none (not even the record's updated date). webhookResult still answers only holds."
  - "A new-hit alert whose detail cannot be read still holds the record (the stored hits stay). Only an alert whose body plainly says clear does nothing."
  - "A reply with hits is a potential match even when the provider itself approved the name (the plan's rule). Plan 08-12 should look at whether approved replies carry low-score hits; if they do, every common name would go to a person."
  - "The provider's request ids are stored in order with no name beside them: names on a screening are sealed elsewhere on the server and must not sit in plain text in the record's private data."
requirements: [VPK-03, VPK-06]
metrics:
  duration: "30 min, from recording the base (15:55:28 UTC) to this summary (16:26 UTC)"
  completed: 2026-11-19
  tasks: 2
  files: 10
actuals:
  tokens: 12600   # chars/4 over the ten files changed (50,451 characters)
  tasks: 2
  commits: 2      # git rev-list --count c4f3fb4..HEAD before this summary commit
plan_head_before: c4f3fb4d79db343178cadbe2fc53ac5632af3bc8
plan_head_after: 8aa2a62bd5fe9be948521298e0c4b1a8956f083c
---

# Phase 8 Plan 02: the identity and sanctions screening plug-in, built against recorded replies only

One code plug-in on the existing connector server starts an ID check, reads its decision, screens several names with ongoing monitoring, and takes both kinds of signed delivery. Nothing in it was ever sent to the real service.

## Failures and limits first

1. **Nothing here is proven against the real service.** No call was made and no key exists. Every request and reply shape is documentation as quoted by search. All eight fixtures say unconfirmed. The plug-in is not working until plan 08-12 runs it in the provider's sandbox.
2. **The monitoring alert's body is the weakest guess.** The research quotes the alert's type (`aml.new_hit`) and how it is signed. Where the hits sit in the body, and whether the alert echoes our own id for a stand-alone screening, are assumptions. If the alert carries neither our id nor a session id we stored, it is accepted and changes nothing.
3. **Three field names of the screening request are guesses** (name, entity type, our reference): the research describes them in words only. The matched name and the list name inside a hit come from no cited source at all. If those two are wrong, a hit still holds the investor; it just shows the name screened without the name as listed.
4. **Not run: the full gate.** I ran the plug-in's tests, the whole server suite, `server-mode.js` and `ways-out.js`, as the plan and B3 say. The orchestrator runs the full gate at the wave merge.
5. **The second verify run exceeded ten minutes** (`server-mode.js` under machine load from other executors). It was left to finish and ended with exit 0. The first run of the same command finished within the limit.

## What was built

- **Start and read.** `POST /v1/verifications { kind: identity, provider: idcheck }` makes one call (session path, key in `x-api-key`, `workflow_id`, our `ver_` id as `vendor_data`, our return address as `callback`) and answers the provider's page. A reply with no page, or a page that is not https, starts nothing.
- **Statuses.** All ten session statuses and all four screening statuses are mapped. An unknown one leaves the check as it is and the server logs `unmapped_status`.
- **A hit never rejects (B1).** `failed` only when the ID, the liveness check or the face match itself was declined. A session declined for any other reason reads `review`, with screening `potential_match` when a screening is flagged.
- **Several names.** One call per name, 60 second limit each, the account name of an entity, trust or IRA sent as a company, every call enrolled in monitoring, hits merged.
- **Two delivery schemes**, chosen by which signature header is present, both over the exact bytes, constant-time, with a signed time within 300 seconds. An empty secret refuses. A delivery with no event id is known by the SHA-256 of its bytes (B6).
- **Alerts hold only.** An alert can move a screening to `potential_match` or an identity check to `review`. Nothing an alert says clears or passes a record.
- **White label (B4).** Provider errors are rethrown as `Identity check answered <status>` or `Identity check could not be reached`, status 502, with none of the provider's text. The provider's address is one constant in the plug-in; the test file holds no provider word.

## RED runs

- Task 1 (`red.txt`), before the plug-in existed: `not ok 1 - tracer…`, `exactly one provider call starts a session`, expected 1, actual 0.
- Task 2 (`red2.txt`), against Task 1's commit: 11 tests, 2 pass, 9 fail. Among them: `declined by screening only` got `failed` where it must never; `provider errors` got `Identity check answered 403: <the provider's name, its docs address and its support address>`; `names` saw 0 timers of 60000.

## Verify, last lines

Task 1:
```
# tests 1
# suites 0
# pass 1
# fail 0
```
Task 2 (final run, after the last edit):
```
# tests 11
# suites 0
# pass 11
# fail 0
# tests 208
# suites 0
# pass 208
# fail 0
SERVER TESTS: 208 (base 197 + 11 top-level tests in idcheck.test.mjs = 208)
FIXTURES: 8 checked (each _source https, each _status unconfirmed)
SERVER MODE: PASS (parts run: 15)
WAYS OUT: PASS (parts run: 7)
TASK 2 VERIFY EXIT: 0
```
The base count was 197 at c4f3fb4 (no phase 07 plan in the base). No existing test failed because a new default plug-in is listed.

A further check, not in the plan: 17 guarantees were broken one at a time in the plug-in (freshness from the unsigned header, empty secret accepted, a clear alert clears, provider text passed on, declined by screening rejects, and so on). The tests caught 17 of 17.

## Commits

- 5a3657d feat(08-02): identity check plug-in tracer (session, signed status delivery, decision re-read)
- 8aa2a62 feat(08-02): identity check plug-in: every status, several names, monitoring, alerts, forged deliveries

Only `server/plugins/idcheck.mjs`, `server/test/idcheck.test.mjs` and `server/test/fixtures/idcheck/` changed. `server/index.mjs` needed no change.

## Deviations from Plan

1. **[Rule 1 - Bug] One ref per delivery, not two.** The plan wrote `ref: session_id and vendor_data`. The server's webhook route reads the decision once per ref, so both refs meant two provider calls per delivery for the same record. The plug-in returns our own id when the delivery echoes it, otherwise the session id. The tracer asserts exactly one decision read. Commit 5a3657d.
2. **[RED-first] Task 1 exported `kinds: ['identity']`; `aml` came with `screen` in Task 2.** The loader refuses an `aml` plug-in without `screen`, and writing `screen` in Task 1 would have left Task 2's screening tests with nothing to fail against.
3. **[B1, from 08-CONTEXT] `Declined` no longer maps straight to `failed`.** As written in the plan-check addition; see Decisions for the case B1 does not spell out (declined, nothing declined, no screening flagged: `review`).
4. **[Rule 2 - Missing check] A session reply without an https page is refused** (`Identity check did not start the check`, 502). Without it the investor would be sent nowhere, or to whatever address the reply held. Commit 8aa2a62.
5. **[Rule 2 / B4] Network errors are neutral too.** `requestJson` puts the fetch error's text in its message, and that text can hold the provider's host name. The plug-in keeps only `(timed out)`.
6. **`ASSUMED` is exported** (the plan lists it as a constants block, not an export) so the tests and plan 08-12 read the same constants.
7. **The plan said "No push"; the orchestrator's brief said push to `wip/08-02`.** Pushed there only.
8. **Fixture count is eight, not seven:** B1's `decision-declined-screening.json`.
9. **Not done: STATE.md, ROADMAP.md and the WINDOWS.md ledger** were left alone, as the brief says (shared files, parallel worktrees).

## For the orchestrator (edges this plan cannot close)

- **An alert naming a failed or unfinished identity check reads `review`** until the next decision read. `webhookResult` is given the kind, not the record, so it cannot keep `failed`. In practice the provider monitors finished sessions and also sends a status delivery, whose re-read sets the status from the decision.
- **Screening is by name only.** The research says the provider also takes a date of birth and a nationality; the server holds neither for an investor. Expect more potential matches than a provider's own flow would give.
- **A multi-name screening that fails part-way** answers 502 and leaves the record pending. The calls already made were billed; a retry screens every name again.
- **Monitoring of names inside an ID session** is switched on in the provider's workflow, not by this plug-in. Stand-alone screenings ask for it in each request.
- **`monitoring: true` means the plug-in asked.** No documented field confirms the enrolment.
- As 08-CONTEXT already notes for 08-05 or 08-13: every server-connected sponsor now sees an "Identity check" row they cannot use.

## Assumptions waiting for plan 08-12 (`ASSUMED` in server/plugins/idcheck.mjs)

| Constant | Value | What 08-12 confirms |
|---|---|---|
| `decisionPath` | `/session/{id}/decision/` | the exact path that reads a session's decision (research A2) |
| `signatureEncoding` | `hex` | signatures are lower-case hex, not base64 (A2) |
| `sessionSignatureHeader` | `x-signature` | session deliveries: HMAC-SHA256 of the raw body |
| `alertSignatureHeader` | `x-signature-v2` | alerts: HMAC of `<timestamp header>.<raw body>`, and no first header is sent |
| `timestampHeader` | `x-timestamp` | the header that is part of an alert's signed message |
| `alertSecretEnv` | `IDCHECK_WEBHOOK_SECRET` | alerts are signed with the same secret as session deliveries |
| `bodyTimestampField`, `timestampsPerSecond` | `timestamp`, `1` | a session delivery's signed body carries its time in this field, in seconds; the header counts seconds too |
| `partStatusField`, `partDeclined` | `status`, `Declined` | each part of a decision (`id_verifications`, `liveness_checks`, `face_matches`, `aml_screenings`) carries its own status under this name, in the session's words (B1) |
| `partHitsField` | `hits` | each screening inside a decision carries its hits as the stand-alone reply does |
| `screen.path` | `/aml/` | the stand-alone screening path (cited, unconfirmed) |
| `screen.name`, `screen.entityType`, `screen.reference` | `full_name`, `entity_type`, `vendor_data` | the request's field names (described in words only) |
| `screen.person`, `screen.company` | `person`, `company` | the two entity type values |
| (literals) | `include_ongoing_monitoring: true`, `save_api_request: true` | the two monitoring switches as the research names them, and that they enrol the name |
| `hit.score`, `hit.scoreMax` | `match_score`, `100` | the score's scale (a value above 1 is read as out of 100) |
| `hit.risk` | `risk_score` | shown to the reviewer as "Risk score N" |
| `hit.listed`, `hit.list` | `caption`, `datasets` | the matched name and the list name: from no cited source |
| `alertType` | `aml.new_hit` | the alert's type |
| `referenceField` | `vendor_data` | an alert for a stand-alone screening echoes our `scr_` id here |
| `alertScreenings` | `decision.aml_screenings`, `aml` | where an alert's screenings and hits sit in its body |

Also unconfirmed, held by the fixtures rather than by `ASSUMED`: the session reply (`session_id`, `session_token`, `url`, `status`), the ten session status words, the four screening status words, the delivery body (`event_id`, `webhook_type`, `timestamp`, `created_at`, `session_id`, `status`, `vendor_data`), the screening reply (`request_id`, `aml.status`, `aml.hits`), that parts of a decision are lists, and that a wrong key answers 403 and an empty balance 402.

## Self-Check: PASSED

All ten created files exist; commits 5a3657d and 8aa2a62 are ancestors of HEAD.
