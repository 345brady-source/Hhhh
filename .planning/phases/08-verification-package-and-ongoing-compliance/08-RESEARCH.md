# Phase 08: Verification package and ongoing compliance - Research

**Researched:** 2026-11-19
**Domain:** provider plug-ins on the integration server (identity, sanctions screening, accreditation), card-on-file billing of sponsors, Rule 506(c) verification law, ongoing sanctions re-screening, AML program records
**Confidence:** code findings HIGH (files read this session); web findings LOW to MEDIUM (see limits below); legal points need counsel

## Read first: limits of this research

1. **No provider page was opened directly.** `didit.me` and `docs.didit.me` failed DNS in this session (network allowlist), the same block the 2026-11-15 research hit. Every web fact below was read through web search results that quote the provider's or regulator's own page. The GSD confidence seam rates that LOW, and MEDIUM where two independent official pages agree. Nothing from the web is tagged VERIFIED.
2. **No provider API was called.** No sandbox was exercised and no key exists. Every request and reply shape for a provider is from documentation as quoted by search, not from a real reply. A plan that builds a plug-in from these shapes must end with a real sandbox run by the orchestrator before anything is called working.
3. **Three prices are still not published:** VerifyInvestor's API price ("on request"), Parallel Markets and InvestReady (quote only). North Capital's $30 figure appears on one of its pages and is contradicted by a third-party review that says its pricing is negotiated.
4. **Hosting was not researched.** A real provider cannot run end to end without the integration server on a public https address (providers call back to it; investors' links open against it). The "$0 monthly" path below covers provider and payment fees only. No hosted server exists in the repository's notes (`.planning/PROJECT.md:58`: "Data currently lives in the browser (localStorage and IndexedDB), with an optional integration server.").
5. **Legal points are research, not advice.** The rule text was read through search summaries of eCFR and Cornell. Sponsor's counsel confirms.

## Summary

The portal's provider-neutral connector layer is real and well tested (197 server tests pass on HEAD 43773a4, run this session: `# tests 197 / # pass 197 / # fail 0`). It can start a check, receive a signed webhook, re-read a result, host a provider page, push results through a results API, and confine an investor's link to the firm's own providers. What it cannot do today is the package itself: there is no payments code anywhere, no sponsor identity on the server (one shared `API_TOKEN`), no notion of a paid entitlement, no plug-in for any real provider, no way for a monitoring alert to reach the console, and no AML program record. The invite form has an exact precedent for the tick box: the "Include tax form" check box added in plan 06-27, which travels form → `create()` → `snapshot()` → `cleanInvitation()` on the server.

Three findings change the 2026-11-15 picture. (1) Didit's white label (own domain, no vendor branding) is now sold only on its Scale plan at $299 a month; on the $0 Free plan the investor sees the vendor's page. That collides with the white-label rule and the no-monthly-fee rule at once, so the owner must choose. (2) Didit sells daily ongoing sanctions/PEP monitoring at $0.07 per person per year, which makes repeat screening of package investors nearly free and removes any reason to build a paid periodic re-check. (3) Rule 506(c) does not require a calendar re-check: verification is needed at each sale, a third-party letter is good for three months, and the rule itself lets the same issuer rely on a written representation for five years after a prior verification. The portal already expires verifications after 90 days and blocks new subscriptions until re-verified, so the "about every 90 days" decision is mostly built; what is missing is a way to ask an investor to re-verify, and the free written-representation route.

**Primary recommendation:** Build the package as server-side plug-ins with neutral names behind a per-invitation paid entitlement, charged to the sponsor's card through Stripe (no monthly fee) with unused packages returned as platform credit; use Didit on its $0 Free plan for identity and screening with ongoing monitoring switched on, VerifyInvestor as the default accreditation provider (no minimum, staging server, third-party use provided for in its API), keep the free U.S. Treasury list re-screen for everyone else, and build everything against recorded fixtures now, with one orchestrator-run sandbox proof per provider once the owner opens the accounts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `08-CONTEXT.md`, "Decisions (owner, 2026-11-15/16, from 01.4-RESUME)":

- D-01: a KYC + AML + accreditation package, completely optional (sponsors may run their own checks); the sponsor adds it per investor when sending the invite; the sponsor's card on file is charged then; Carrow & Vale receives the funds and pays the providers (prepaid credits or a card the provider charges when the investor completes the checks inside the automated onboarding). The investor never pays.
- D-02: Didit for KYC and AML. Accreditation provider and the payments provider are still to choose: research real prices and approval steps, present options, $0-monthly options first.
- D-03: the portal already has provider-neutral connectors (server/providers, server/plugins, assets/js/integrations.js): reuse them.
- D-04: ongoing compliance in the same step: repeat sanctions screening of existing investors, 506(c) accreditation re-checks (about every 90 days while an offering is open), a record of the AML program.
- Open for the owner: the package price; refund or credit when an invited investor never completes the check.
- Carried: white label; D-30; lean screens; .planning/AUTOPILOT.md conditions.

### Claude's Discretion
CONTEXT.md has no such section. Left to research by D-02: which accreditation provider and which payments provider to put to the owner, with a default.

### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md lists none. Out of scope by standing decisions: moving investor money (NACHA step, launch item 11), the in-house reader (D-33), the managed (Carrow & Vale) edition (unchanged unless a plan says otherwise).
</user_constraints>

## Project Constraints (from CLAUDE.md and AUTOPILOT.md)

`.planning/config.json` names `./.claude/CLAUDE.md`, which does not exist; the root `CLAUDE.md` is the one in force.

- Outside service: present the option with cost, accuracy, speed and trade-offs before building in-house. The owner has no budget for monthly fees; a $0 path comes first.
- Nothing is called ready, working or done until tested on unseen material and checked by the owner. No time estimates that were not measured. Failures reported first.
- GSD for everything: researcher, planner, plan checker, executors in isolated worktrees, verifier. Plans sized to about 100k tokens; independent plans in parallel.
- White label: no vendor, model or library names in anything a sponsor or investor sees. The word "basic" never appears.
- D-30: nothing mandatory for investors. Lean screens, no extra text.
- Managed edition unchanged unless a plan says otherwise (C-03 slice guard in status-math).
- No paid API calls by agents; no agent is ever given an API key. Paid or keyed runs are the orchestrator's.
- The owner tests on an iPhone inside the Claude app: a sandboxed iframe, no server, CSP blocking `connect-src`. Every user-facing plan proves its screens there at 390x844 with touch and at 1280x800. No `fetch()`/XHR on any path that must work without a server; no Blob in IndexedDB; no browser PDF viewer; every view has a way out on screen; dialogs scroll.
- RED-first: every behaviour change has a check that fails before and passes after. Full gate: `.planning/checks/gate-reference.sh`. Browser checks go through `SCRATCH/exec-011/heavy.sh`.
- Worktree base `claude/refract-reskin`; push only to `wip/<branch>`; never touch STATE.md or ROADMAP.md (a planner may edit its own phase's section of ROADMAP.md). Never commit confidential documents or personal data; never stage `server/node_modules`.
- Disk is limited (5.9 GB free, measured this session).

<phase_requirements>
## Phase Requirements

ROADMAP.md lists "Requirements: TBD" for phase 8, so no IDs were provided. Proposed IDs for the planner, derived from D-01 to D-04 (rename freely):

| ID | Description | Research support |
|----|-------------|------------------|
| VPK-01 | The sponsor ticks one box on the invite form to add the package for that investor; unticked, nothing changes | Invite form precedent (Include tax form), "How invitations are created" |
| VPK-02 | The sponsor's card on file is charged when the invite is sent; the investor never pays; a failed charge sends nothing | Payments section, charge-before-send pattern |
| VPK-03 | A paid package runs identity, screening and (where the offering needs it) accreditation inside the investor's onboarding, with no vendor name on any portal screen | Plug-in section, neutral naming pitfall |
| VPK-04 | Only a paid invitation can use the package providers | Entitlement gap, `scopeRules` |
| VPK-05 | An unused package is returned as credit (or refunded) by the owner's rule | Refunds and credits |
| VPK-06 | Package investors are re-screened continuously; a new hit holds the investor for review in the console | Ongoing screening section |
| VPK-07 | Investors outside the package are re-screened against the free U.S. Treasury lists when due, at no cost | `ofac` built-in, `rescreenDue` |
| VPK-08 | The sponsor can ask an investor to re-verify accreditation; a lapsed verification blocks a new Rule 506(c) subscription (already built) | Legal basis, `subscribeGate` |
| VPK-09 | The console holds a record of the AML program that can be exported | AML program record section |
| VPK-10 | Without a server (the owner's iPhone preview) every new screen renders and fails soft, with no network call | AUTOPILOT conditions |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|------------|--------------|----------------|-----------|
| Provider keys, starting checks, webhooks | Integration server (`server/`) | — | "The portal runs in the browser and must never hold provider API keys" (`server/README.md:3`) |
| Card on file, charges, credits, ledger | Integration server | Payment provider's hosted card entry | Card numbers must never touch the portal or this server; the price must be the server's, never the browser's |
| Entitlement (paid invitation → package providers) | Integration server | — | The browser's snapshot is the sponsor's claim; today the server trusts it (`scopeRules`) |
| The tick box, card panel, charges list | Browser console (`assets/js/invitations.js`, `integrations.js`) | Integration server | Screens only; all money decisions are the server's |
| The investor's identity and accreditation steps | Browser (`integrations.js` `stepPanel`, `onboarding.js`) | Provider's hosted page in a new tab | Already built; sensitive documents go straight to the provider |
| Decision, approval, re-screen due dates, accreditation expiry | Browser console (workspace data) | — | Already built (`decide`, `due`, `subscribeGate`) |
| Continuous monitoring alerts | Provider → integration server webhook | Console pulls changed screenings | The console has no inbound channel; it polls |
| AML program record | Browser console (workspace data, audit log) | — | Compiled from data the console already holds |

## Code findings: how the connectors work today

All of this was read in full this session.

### The server

- **Registry and three ways to plug in.** Built-ins `sandbox`, `link`, `ofac`; declarative connectors from `connectors.json`; code plug-ins from `server/plugins/*.mjs` loaded at startup, files starting with `_` or `.` skipped. `[VERIFIED: server/providers/index.mjs:81-159]` Ids must match `const ID = /^[a-z0-9]{2,32}$/;` `[VERIFIED: server/providers/index.mjs:85]`.
- **Adapter interface**, verbatim from the README: "`createSession`, `fetchResult`, `handleReturn`, `returnRecordId`, `page`, `hostedPost`, `fetchEvidence`, `screen`, `fetchScreening`, `verifyWebhook`, `parseWebhook`, `webhookResult`" `[VERIFIED: server/README.md:210; interface documented at server/providers/index.mjs:13-69]`.
- **Normalized statuses**, verbatim: `identity: ['pending', 'passed', 'review', 'failed']`, `accreditation: ['pending', 'verified', 'review', 'rejected']`, `aml: ['pending', 'clear', 'potential_match']` `[VERIFIED: server/lib/statuses.mjs:2-6]`. A status outside these is not applied; the raw value is kept as `providerStatus` and an `unmapped_status` event is logged `[VERIFIED: server/index.mjs:193-206]`.
- **Routes** `[VERIFIED: server/index.mjs]`: webhooks `POST /webhooks/:provider` (594-636: signature over raw bytes, duplicate drop by delivery id, `refetch` re-reads the result); return `GET /return/:provider[/:id]` (641-653); hosted pages `GET`/`POST /hosted/:id` (656-681); results API `POST /v1/results` with its own `RESULTS_TOKEN` (702-736); start a check `POST /v1/verifications` (766-785); evidence download `GET /v1/verifications/:id/evidence/:n` (796-806); screening `POST /v1/screenings` (808-830).
- **Webhook signature checker** `verify(v, rawBody, headers, env, query)` is exported and handles header HMAC, `t=…,v1=…` timestamped headers and Standard Webhooks `[VERIFIED: server/providers/connector.mjs:563-603; schemes listed at server/README.md:248-256]`. A declared timestamp header must be part of the signed message or the definition is refused `[VERIFIED: server/providers/connector.mjs:169-170]`.
- **Provider calls** go through `requestJson` with a default `timeoutMs = 15000`, JSON or form bodies, and errors of the form `` `${label} answered ${res.status}…` `` where `label` is the adapter's display name `[VERIFIED: server/lib/request.mjs:22-55]`.
- **Investor links are confined.** A call with `X-Invite-Token` may start a check only for its own investor and only with a provider the firm's snapshot uses: `if (scope && !(invites.scopeRules(scope).providers[body.kind] || []).includes(body.provider)) return send(res, 403, { error: 'This check is not one the firm uses' });` `[VERIFIED: server/index.mjs:776]`. `scopeRules` builds that list from the snapshot the sponsor's console sent: a `server` connection adds its `connector`, a `link` connection adds `link`, the `ofac` built-in adds `ofac` `[VERIFIED: server/lib/invitations.mjs:637-656]`.
- **Results in a submission are re-confirmed** from this server's own check records for that invitation; a browser-reported pass with no server check behind it becomes `review` `[VERIFIED: server/lib/invitations.mjs:657-721]`.
- **Sponsor authentication is one shared token:** `if (!env.API_TOKEN) return true;` then a constant-time compare, under the comment "In production, verify the portal session here (for example a signed session token); API_TOKEN suits server-to-server use." `[VERIFIED: server/index.mjs:64-69]`. The workspace id is whatever the request body says.
- **Storage** is one JSON file with fixed tables: `let data = { verifications: {}, screenings: {}, invitations: {}, outbox: {}, events: [], seen: [] };` `[VERIFIED: server/lib/store.mjs:10]`. `put(kind, rec)` writes `data[kind][rec.id]`, so a new table must be added to that object first `[VERIFIED: server/lib/store.mjs:38-43]`.
- **Free sanctions screening** downloads `SDN.CSV`, `ALT.CSV`, `CONS_PRIM.CSV` and `CONS_ALT.CSV` from `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/`, caches them for a day, and matches names by Jaro-Winkler word similarity against a threshold of `0.9` `[VERIFIED: server/providers/ofac.mjs:14, 123-155, 161-176]`.
- **No dependency beyond the reading client** (`"@anthropic-ai/sdk": "1.8.0"`), `node --test`, Node >= 18 (seen in `server/package.json`).

### The browser

- **Settings model** `ws.integrations = { connections, use, server, rules, configured }`. Built-in connections: `sandbox`, `manual`, `team`, `self`, `ofac` `[VERIFIED: assets/js/integrations.js:44-50]`. Rule defaults, verbatim: `{ autoApprove: true, accreditationFor: '506c', rescreenDays: 30, validDays: 90, holdOnPep: true }` `[VERIFIED: assets/js/integrations.js:103]`. Only the self-serve edition runs any of it: `const active = (ws) => !!(E && E.integrations && ws);` `[VERIFIED: assets/js/integrations.js:119]`.
- **Starting a check** `start(ws, inv, kind, connectionId)`: sandbox and upload stay in the browser; a `server` or `link` connection posts to `/v1/verifications`, records the check as `pending` with `via: x.name`, and the caller opens the returned URL in a new tab `[VERIFIED: assets/js/integrations.js:339-364, 868-898]`.
- **Results arrive by polling only:** every 5 seconds for two minutes, then every 30 seconds for half an hour, and resumed slowly whenever a page that shows verification loads `[VERIFIED: assets/js/integrations.js:936-971]`. The server refreshes a pending check from the provider only when asked, at most every `REFRESH_MS = 20000` `[VERIFIED: server/index.mjs:59, 230-237]`. There is no background job on the server.
- **A verified accreditation is capped** at the earlier of the provider's expiry and today plus `validDays` `[VERIFIED: assets/js/integrations.js:377-384]`. A lapsed one blocks a new subscription to an offering that needs it, with the message "Your accreditation verification expired on …" `[VERIFIED: assets/js/integrations.js:720-741]`. The console lists verifications expiring within 14 days and re-screens due `[VERIFIED: assets/js/integrations.js:622-645, 1310-1326]`.
- **Re-screening** runs every screening connection that is on, when a person clicks "Run now" `[VERIFIED: assets/js/integrations.js:637-645, 1327-1332]`.
- **The investor's steps:** the identity step and (where verified accreditation is required) the accreditation step render `stepPanel`, which shows the connection's name to the investor: `` `Handled by ${h(x.name)} for ${h(t.shortName)}.` `` and `Continue with ${h(x.name)}` `[VERIFIED: assets/js/integrations.js:763, 777]`. Flow order for a new investor: `['welcome', 'login', 'profile', 'identity']`, then `accreditation` when required, then status, tax, payment, subscription `[VERIFIED: assets/js/onboarding.js:1205-1212]`. In server mode the investor's browser rebuilds the firm's settings from the snapshot `[VERIFIED: assets/js/onboarding.js:1022-1027]`.
- **Console Integrations page** `console-integrations`: what runs for each check, the connections table, approval rules, server address and token, recent activity `[VERIFIED: assets/js/integrations.js:1029-1069]`.
- **Evidence is received and never shown.** `poll()` copies `evidence` onto the investor's record `[VERIFIED: assets/js/integrations.js:673]`; a grep of `assets/js` finds no screen that lists or downloads it.

### How invitations are created (where the tick box goes)

- **The form** is `invitePanel()` `[VERIFIED: assets/js/invitations.js:1402-1474]`. Name and email are the only asked fields; everything else is under "More options". The existing precedent sits directly under the email field: `<label class="cs-check cs-wide inv8-tax" id="iv-tax-row" for="iv-includeTax" …><input id="iv-includeTax" name="includeTax" type="checkbox" data-bind="inv8:includeTax"…><span>Include tax form</span></label>` `[VERIFIED: assets/js/invitations.js:1424]`. The bulk tab has its own (`iv-bulkTax`, line 1447).
- **The path of a ticked box:** `readForm()` reads it (1644-1649) → `submitInvite()` passes it to `create(w, {...})` (1669) → `create()` sets a flag on the invitation (183-262) → `send()` (556-594).
- **Local mode** (no server address and token, `serverOn()` at 104-108): `create()` makes a local token, the link opens the portal in the same browser only, and the sponsor sends the email from their own mail app (`emailStatus: 'manual'`). No server is involved, so no real provider and no charge can happen.
- **Server mode:** `send()` builds `snapshot()` (445-499) and posts it to `/v1/invitations`. The snapshot carries `verification: { connections, use, rules, accreditationRequired }` (496) and `invitation: { cents, cls, note, expiresAt, senderName, existing?, taxRequest?, includeTax? }` (495).
- **The server keeps only known flags.** `cleanInvitation` returns `cents`, `cls`, `note`, `senderName`, `expiresAt` and, each only when `existing === true`, `existing`, `access`, `taxRequest`, `includeTax` `[VERIFIED: server/lib/invitations.mjs:172-183]`. A new `package` flag is dropped until it is added there. `create()` stores the snapshot and emails the link (941-988); nothing in it can refuse an invitation for a payment reason today.

## What is missing to run a real provider end to end

Ordered by how much blocks on it.

| # | Gap | Evidence | Needed |
|---|-----|----------|--------|
| 1 | No public server | PROJECT.md:58; README "Before production" list (423-427) | A host with https, `PUBLIC_URL`, `DATA_KEY`, `PORTAL_ORIGIN`. Owner decision; not agent work |
| 2 | No sponsor identity on the server | `authorize()` (index.mjs:64-69) | Per-sponsor tokens that pin every sponsor call to that sponsor's workspace; without this a charge cannot be attributed |
| 3 | No payments code anywhere | `grep -rli "stripe\|card on file\|billing\|paymentintent"` over `assets/js` and `server/` (without `node_modules`) returned no file, run this session | Card on file, charge, ledger, credits, payment webhook |
| 4 | No entitlement | `scopeRules` trusts the snapshot; a sponsor token may call `/v1/verifications` for any provider | Package providers allowed only for an invitation with a paid package; refused from the console without one |
| 5 | No real plug-in | `server/plugins/` holds only `_template.mjs` | One plug-in for identity + screening, one for accreditation, neutral ids, names and env names |
| 6 | Declarative connector cannot do Didit screening | `{names}` is passed as one array (README:184-185); Didit's standalone screen takes one subject per call | A code plug-in that loops over names (see pitfalls) |
| 7 | Monitoring alerts never reach the console | the console polls only checks that are `pending` (`openRemote`, integrations.js:648-652) | A sponsor route that lists screenings changed since a time, and a console pull |
| 8 | Results that take days | no server-side refresh; polling stops after about 32 minutes unless a console page is open | Webhook where the provider has one; otherwise the console's resume-on-load (already there) is the only path. State this to the sponsor |
| 9 | Letters are not shown | evidence never rendered | A download link on the AML/KYC page through the existing evidence route |
| 10 | The flag is dropped | `cleanInvitation` | Add the flag on both sides |
| 11 | No re-verify request | only `taxRequest` exists as a single-step link | An accreditation-only link for an investor on file, built like plan 06-26's tax request |
| 12 | No AML program record | grep finds only an "AML compliance officer" log line (operations.js:341) | A small console view and an export |

## Standard Stack

### Core

No new package is installed in this phase. Every provider and the payment provider are called over https with the server's existing `requestJson` (it already sends form-encoded bodies, which is what Stripe's API takes) and verified with the existing `verify()`.

| Piece | Version | Purpose | Why |
|-------|---------|---------|-----|
| Node built-ins (`node:http`, `node:crypto`, `node:test`) | Node 22.23.4 here; `>=18` declared | Server, HMAC, tests | Already the whole server |
| `server/lib/request.mjs` `requestJson` | in repo | Provider and payment calls | Timeouts, no secrets in errors |
| `server/providers/connector.mjs` `verify` | in repo | Webhook signatures | Covers the payment provider's `t=,v1=` header scheme and plain header HMAC |

### Alternatives considered

| Instead of | Could use | Trade-off |
|------------|-----------|-----------|
| Raw https calls to Stripe | The `stripe` npm package `[ASSUMED]` | A second dependency for five endpoints; the server's rule is one dependency. Not recommended |
| A code plug-in for Didit | A declarative connector | Works for the identity session and its webhook only; cannot loop names for screening, cannot check the signed timestamp, cannot handle monitoring alerts |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed in this phase, so the gate was not run. If a planner adds one (not recommended), it must run `gsd-tools query package-legitimacy check` first and gate the install behind a human check.

## Outside services: options and prices

Prices are list prices in USD as quoted by search results from the provider's own pages on 2026-11-19 unless marked otherwise.

### Identity and sanctions screening: Didit (locked by D-02)

| Item | Finding | Tag |
|------|---------|-----|
| Create a session | `POST https://verification.didit.me/v3/session/`, header `x-api-key`; body `workflow_id` (required), `vendor_data` (our reference, echoed in webhooks), `callback` (where the person is sent afterwards), `metadata`; reply 201 with `session_id`, `session_token`, `url`, `status` starting "Not Started". A blog still shows `/v2/session/`; the docs use v3 | `[CITED: docs.didit.me/sessions-api/create-session]` |
| Read the result | Session decision endpoint returns `status` plus `id_verifications`, `liveness_checks`, `face_matches`, `aml_screenings`, `reviews`, `decision_trace`. Session statuses are exact strings with spaces: Approved, Declined, In Review, Expired, Kyc Expired, Abandoned (final); Not Started, In Progress, Awaiting User, Resubmitted (moving) | `[CITED: docs.didit.me/sessions-api/retrieve-session, docs.didit.me/integration/verification-statuses]` |
| Hosted or embedded | Hosted link (redirect), an in-page iframe (`allow="camera; microphone; fullscreen; autoplay; encrypted-media"` is mandatory), JS SDK, native SDKs. The docs name redirect as the fallback when iframe camera access fails; they do not cover an iframe inside an iOS WKWebView | `[CITED: docs.didit.me/integration/web-sdks/incontext-iframe, .../webview-in-ios-android]` |
| Webhooks | Body: `event_id`, `webhook_type` (for example `status.updated`), `timestamp`, `created_at`, `session_id`, `status`, `vendor_data`, `decision`. Headers `X-Timestamp`, `X-Signature` (HMAC-SHA256 of the raw body), `X-Signature-V2` (HMAC over canonical JSON with sorted keys; Didit's recommended first check), `X-Signature-Simple` (deprecated, envelope only). Reject when the timestamp is more than 300 seconds off. Didit's blog posts describe three other schemes and disagree with the docs | `[CITED: docs.didit.me/integration/webhooks]` |
| Screening on its own | `POST https://verification.didit.me/v3/aml/` with a name, entity type, date of birth, nationality, an adverse-media switch and our reference; reply has `request_id` and `aml` with a status, hit count, `hits` (each with `match_score`, `risk_score`), a score. Adverse media adds up to about 30 seconds; the docs ask for a client timeout of at least 60 seconds. Screening statuses: Not Finished, Approved, Declined, In Review | `[CITED: docs.didit.me/reference/aml-screening-standalone-api, .../report-aml-screening]` |
| Ongoing monitoring | $0.07 per enrolled person per year on top of the $0.20 check; daily re-screen against the same lists; a new hit fires an `aml.new_hit` webhook and moves the session to In Review or Declined; switching off prorates to the day. Enrolled by `include_ongoing_monitoring` (needs `save_api_request=true`) or by `POST /v3/users/aml-monitoring/`. Alert webhooks sign `<X-Timestamp>.<raw body>` in `X-Signature-V2` and send no `X-Signature`: a different scheme from session webhooks | `[CITED: didit.me/blog/ongoing-aml-monitoring-api, docs.didit.me/core-technology/aml-screening/continuous-monitoring-aml-screening, docs.didit.me/integration/alert-webhooks]` |
| Sandbox | A separate sandbox application with its own key; sessions are simulated and never billed; `sandbox_scenario` picks the outcome (`approve`, `decline_document_expired`, `review_*`); a simulate endpoint forces a final status. Missing or bad keys answer 403, not 401 | `[CITED: docs.didit.me/integration/sandbox-testing]` |
| Per-check prices | ID check alone $0.15; ID + passive liveness + face match + IP analysis $0.33; sanctions/PEP/adverse media screening $0.20; business (entity) verification from $2.00 by country, with each owner's check billed separately | `[CITED: didit.me/pricing, didit.me/products/aml-screening, docs.didit.me/business-verification/overview]` |
| Plans (from 2026-11-01) | Free $0 a month with $10 of credit a month for organizations that signed up with a work email (the credit expires at month end); Growth $99 a month ($115 credit, 4% off); Scale $299 a month ($350 credit, 10% off, 14-day trial); Enterprise by contract. Older Didit pages still say "500 free checks a month"; the November docs say the $10 credit replaced it | `[CITED: docs.didit.me/getting-started/pricing, help.didit.me/getting-started/free-plan]` |
| White label | $0.10 per finished session (cut from $0.20 on 2026-11-01), and **only on Scale and Enterprise**. A custom domain needs Scale or Enterprise. Colours, type, logo, layout and domain are set in a style editor and apply only when "Include custom style" is on for the workflow. One Didit page still says white label is available pay-as-you-go: the pages conflict. Even white-labelled, Didit remains the named verification provider in the legal notices | `[CITED: docs.didit.me/getting-started/pricing, docs.didit.me/console/white-label, didit.me/products/white-label]` |
| Reselling | Didit markets reselling under your own brand and a partner programme ("sell Didit under your contract and your margin"); its help centre says an organization cannot create sub-accounts. White label is described as "a per-account feature — talk to sales to enable it" | `[CITED: didit.me/solutions/white-label-kyc, didit.me/partners, help.didit.me/account-organization/organizations-and-applications]` |
| Approval steps | Sign up with a work email, create an organization, a sandbox application and a live application, build a workflow (ID + liveness + face match + screening, with the screening thresholds), copy the key and webhook secret. No underwriting step was found in the docs | `[ASSUMED]` for the absence of an underwriting step |

**What this means for the owner.** On the $0 Free plan a package investor's identity check costs $0.53 (0.33 + 0.20) and the first 18 a month are covered by the $10 credit (10 / 0.53 = 18.8). The investor opens the vendor's page with the vendor's name and domain. Removing that costs $299 a month. A third route, sending photos captured in the portal's own screen to Didit's stand-alone ID and face APIs, would keep the screen white label at $0 a month `[CITED: docs.didit.me/standalone-apis/id-verification exists]`, but then ID photos and selfies pass through Carrow & Vale's server, which the server was designed never to hold, and it adds biometric-data duties; it is not recommended for launch.

### Accreditation verification (to choose)

| Provider | Per verification | Monthly or annual minimum | Turnaround | API and test environment | White label | Platform acting for sponsors | Tag |
|----------|------------------|---------------------------|------------|--------------------------|-------------|------------------------------|-----|
| **VerifyInvestor.com** (majority owned by tZERO) | $69 each; prepaid 50 for $3,105 ($62.10 each); 100 for $5,865 ($58.65 each); API price "on request" | None published | "typically within 1-2 business days" once documents are in; reviewed by a licensed attorney | REST API, an embedded API (a button that opens their pages in a modal iframe "with customized styling"), a LITE API. Free staging server `https://verifyinvestor-staging.herokuapp.com/api/v1`; production `https://www.verifyinvestor.com/api/v1`; staging credentials by email to accounts@verifyinvestor.com; a staging-only call simulates the review. Webhooks and the full status list were not found | Styling only; the letter is the verifier's own, by design | `portal_name` is an "optional parameter if you are providing a white-labeled service or acting on behalf of a 3rd party" | `[CITED: verifyinvestor.com/accredited-investor-verification, docs.verifyinvestor.com, docs.verifyinvestor.com/embedded.html, verifyinvestor.com/support]` |
| **North Capital, Opera IQ** (registered broker-dealer) | "$30 per investor verification request" on one North Capital page; a third-party review says pricing is negotiated and no rate card is published. Bad-actor check $125 a person | Not found | "1 business day" typical | Embeddable micro-portal, email link, or TransactAPI (REST, webhooks) "for high-volume offerings". Test environment not found | Not found | Not found | `[CITED: m.northcapital.com/accredited-investor-verification-opera-iq, northcapital.com/verification]`; price conflict unresolved |
| **Parallel Markets** (iCapital) | Quote only. Reseller price points seen: $59 a letter (SponsorCloud), $75 (Verivest) | Priced on the size of the client database per contract term; the 2026-11-15 research found annual minimums and overages | Letters within about a business day (2026-11-15 research) | JS SDK, REST v2 with a Bearer key, signed webhooks, a sandbox quickstart page | SDK embed | Yes by contract: several investor platforms resell it | `[CITED: support.parallelmarkets.com/hc/en-us/articles/4417810700685, help.sponsorcloud.io]`; sandbox details `[ASSUMED]` |
| **InvestReady / Accredify** | Quote only | Not found | Not found | API and custom verification pages for portals | Partner portals exist (2019 announcements) | Yes by partner agreement | `[CITED: investready-support.groovehq.com]`; all 2019-era |
| **Accredd** | Not published | Not found | "under 12 hours" per a directory listing | An API per directory listings; its own site was not in any result | Not found | Not found | `[ASSUMED]` third-party directories only |
| **Eleven** | $100, no prepay, no platform fee | None | Not found | A competing investor platform; API unclear | No | No | `[CITED: platformeleven.io/506c-accredited-investor-verifications]` |
| **No vendor** | $0 | $0 | Immediate | Portal forms | Full | n/a | See "Legal basis" |

No provider's site states what is charged when an invited investor never finishes or does not qualify. VerifyInvestor says only that unused prepaid credits "remain in your account"; a competitor's blog claims they expire after 12 months `[ASSUMED]`. The owner should ask before buying a bundle.

### Charging the sponsor's card (to choose)

| Option | Fees | Monthly fee | Fit | Tag |
|--------|------|-------------|-----|-----|
| **Stripe** | 2.9% + 30¢ per successful US card charge; ACH debit 0.8% capped at $5; dispute $15; on a refund the original fee is not returned ("For all refunds, payment processing … fees from the original charge are not returned"); a refund can only go back to the original card | None | Save the card with a SetupIntent (or Checkout in setup mode), then charge with a PaymentIntent with `customer`, `payment_method`, `off_session=true`, `confirm=true`; the charge errors if the bank demands authentication, which must be handled | `[CITED: stripe.com/pricing, support.stripe.com/questions/understanding-fees-for-refunded-payments, docs.stripe.com/payments/save-and-reuse-cards-only, docs.stripe.com/refunds]` |
| Square | Card on file 3.5% + 15¢ | None | Dearer on exactly this use | `[CITED: squareup.com/help/us/en/article/5068 via third-party summaries]` |
| Braintree (PayPal) | 2.59% + 49¢ on its pricing page; an older PDF says 2.89% + 29¢ | None | Not re-checked on 2026-11-19; carried from the 2026-11-15 research | `[ASSUMED]` stale |

**Restricted-business rules.** Stripe's list puts "investment and brokerage services, including real estate-based investments", escrow and "other financial services" among regulated financial products that need its approval, and its FAQ says it cannot support many "investment and credit services … or crowdfunding services". The lists are "representative but not exhaustive" and every account is reviewed at activation `[CITED: stripe.com/legal/restricted-businesses, support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs]`. Nothing found addresses software sold to fund sponsors. Carrow & Vale would charge sponsors for software and a compliance check and would never touch investor money, which is a different activity from the listed ones; whether Stripe's reviewers agree is not known until the owner applies `[ASSUMED]`. The application should describe the business as business-to-business software, and say plainly that no investor funds pass through. If Stripe refuses, the fallbacks are Braintree, or invoicing sponsors by bank transfer for prepaid credits (no card on file).

**Card entry and white label.** A Stripe-hosted card page shows Stripe's name to the sponsor. An embedded card field keeps the sponsor inside the console but loads a script from Stripe's domain on that one dialog `[ASSUMED]` for how much branding the embedded field shows. Either way the card number never reaches the portal or the server.

### Ongoing sanctions re-screening: options

| Option | Cost | Covers | Does not cover |
|--------|------|--------|----------------|
| In-house re-screen against the official U.S. Treasury lists (the `ofac` built-in, already in the server) | $0 | The SDN list and the Consolidated (non-SDN) list with alternate names, fuzzy name match, refreshed daily from Treasury's Sanctions List Service (free downloads in CSV, XML and other formats) `[CITED: ofac.treasury.gov/sanctions-list-service]` | Politically exposed persons; adverse media; UN, EU and UK lists; entities owned 50% or more by a listed person but not named themselves; date-of-birth or nationality matching (it matches names only, so every hit needs a person to compare details, as the file's own header says); non-Latin scripts beyond accent folding. It runs only when a console is open and someone presses "Run now" |
| Didit ongoing monitoring | $0.07 a person a year | Daily re-screen against its 1,300+ sanctions, PEP, adverse-media and watchlist sources; alert by webhook | Only people first screened through Didit with the request saved; needs gap 7 closed for the console to see alerts |
| Periodic re-check through Didit | $0.20 a name each time (monthly: $2.40 a year) | Same lists, on our schedule | 34 times the monitoring price for less frequent coverage |

**Recommendation:** monitoring for package investors (cost carried inside the package price); the free Treasury re-screen for everyone else, run automatically when due while a console is open instead of waiting for a click. Never auto-run a sponsor's own paid screening connector.

### Estimated cost per package investor (list prices)

| Component | Free plan | Scale plan ($299 a month) |
|-----------|-----------|---------------------------|
| Identity bundle | $0.33 | $0.297 |
| Screening | $0.20 | $0.18 |
| White label | not available | $0.09 |
| Monitoring, first year | $0.07 | $0.063 |
| Identity + screening + first-year monitoring | **$0.60** | **$0.63** |
| Accreditation (VerifyInvestor, single) | $69.00 | $69.00 |
| **Full package** | **$69.60** | **$69.63** |

Margin = price − (0.029 × price + 0.30) − provider cost. Full package on the Free plan: at $99 the fee is $3.17 and the margin $26.23; at $129, $4.04 and $55.36; at $149, $4.62 and $74.78. Identity + screening only: at $19 the fee is $0.85 and the margin $17.55; at $25, $1.03 and $23.37. Not in the margin: disputes, a refund after the provider has charged (at $99 that loses about $72.77), sales tax on software in some states `[ASSUMED]`, hosting.

## Legal basis (research, not advice)

- **Who must verify.** Under Rule 506(c) the issuer must take reasonable steps to verify that every purchaser is accredited. The listed methods in 17 CFR 230.506(c)(2)(ii) are "non-exclusive and non-mandatory" `[CITED: ecfr.gov/current/title-17/chapter-II/part-230/.../section-230.506, law.cornell.edu/cfr/text/17/230.506]`.
- **The listed methods** `[CITED: same]`: (income) IRS forms for the two most recent years plus a written representation about the current year; (net worth) bank, brokerage and similar statements "dated within the prior three months" plus a consumer report for liabilities and a written representation that all liabilities are disclosed; (third party) a written confirmation from a registered broker-dealer, an SEC-registered investment adviser, a licensed attorney or a CPA that it took reasonable steps "within the prior three months" and determined the purchaser is accredited; (previously verified) for a person the issuer already verified, a written representation at the time of sale, absent contrary information, which "will satisfy the issuer's obligation to verify the person's accredited investor status for a period of five years from the date the person was previously verified". Sub-paragraph letters other than (B) for net worth are `[ASSUMED]`.
- **High minimum investments.** In a no-action letter of 2025-03-12 answering Latham & Watkins, SEC staff agreed that an issuer may treat a minimum investment of $200,000 for a natural person or $1,000,000 for a legal entity as reasonable steps, with written representations that the purchaser is accredited and that the minimum "is not financed in whole or in part by any third party for the specific purpose of making the particular investment", and no knowledge to the contrary. An entity accredited only through its owners needs $200,000 per owner when it has fewer than five. It is a staff position, not a rule; one commentary notes it does not say what happens if the minimum is waived for some investors `[CITED: sec.gov/files/corpfin/no-action/latham-watkins506c-031225-incoming.pdf (not opened), kirkland.com 2025-03, icapital.com, legal500.com]`.
- **Re-verification timing.** Nothing requires a re-check on a calendar. Verification is owed at each sale; a third-party letter is good for three months; and the same issuer can use the five-year written representation for a later sale. The decision "about every 90 days while an offering is open" matches the three-month life of a letter, and the portal already enforces it where it matters: a lapsed verification stops a new Rule 506(c) subscription. A fund is the issuer, so a sponsor with several funds should have counsel confirm whether one fund's verification supports another's five-year representation `[ASSUMED]`.
- **New in 2026.** On 2026-09-30 the SEC issued releases 33-11445 to 33-11448 about new routes to accredited status (a FINRA exam, CPA, CFA and CFP credentials). Whether they are proposals or final was not confirmed, and no change to the verification rule was found `[CITED: sec.gov/files/rules/other/2026/33-11448.pdf (not opened), pryorcashman.com, sheppard.com]`.
- **AML rule for advisers.** FinCEN's rule making most SEC-registered and exempt-reporting advisers adopt a written AML programme and file suspicious activity reports was delayed from 2026-01-01 to **2028-01-01** by a final rule of 2025-12-31, and FinCEN says it will revisit the substance. Two sources disagree on whether an April 2026 FinCEN proposal touches advisers `[CITED: mofo.com 2026-01-08, regulatoryandcompliance.com 2026-01, bdo.com tracker]`. A sponsor that is not an investment adviser is outside that rule altogether `[ASSUMED]`.
- **Sanctions law applies now, to everyone.** OFAC's rules bind every U.S. person regardless of any AML rule `[ASSUMED]`. OFAC's own compliance framework names five parts of a programme: management commitment, risk assessment, internal controls, testing and auditing, training `[CITED: ofac.treasury.gov/system/files/126/framework_ofac_cc.pdf]`. OFAC records must be kept ten years (five before 2025-03-12) `[CITED: gtlaw.com 2025-04, debevoise.com 2024-09]`.
- **Carried from the 2026-11-15 research, not re-checked** `[ASSUMED]`: keep the package fee flat per invitation and independent of whether or how much the investor invests (a fee tied to the transaction is a broker-dealer indicator); present Carrow & Vale as a technology facilitator that passes on the provider's letter, never as the party deciding accreditation; selfie matching is biometric data (Illinois BIPA and similar laws need written consent and a retention schedule); even a white-labelled flow must link the provider's privacy notice.

### What an AML program record should contain (lean)

No rule in force today prescribes the contents for a private fund sponsor, so the record should be the smallest thing a bank, fund administrator, auditor or large investor asks for, and what the delayed adviser rule and OFAC's framework would look for:

1. The policy: a short statement, its scope, the date adopted and who approved it (the adviser rule asks for approval by the board or its equivalent `[CITED: cooley.com 2024-09-20]`).
2. The responsible person: name, title, date designated `[ASSUMED]`.
3. A short risk assessment: investor types, countries, offering types.
4. The procedures in force, read from the settings the console already holds: how identity is checked, which lists are screened and how often (`rescreenDays`), the accreditation rule, the PEP hold, automatic or manual approval.
5. The screening log: per investor, each date screened, lists, result, and for a match the reviewer, decision and note. All of this is already in the audit log and `inv.kyc`.
6. Escalation: who is told about a possible match and what is reported to OFAC `[ASSUMED]`.
7. Training entries (who, when) and independent review entries (who, when, findings) (`[CITED: cooley.com]` for independent testing).
8. Retention: ten years for sanctions records.

Items 1, 2, 3, 6, 7 and 8 are a handful of fields the sponsor types once; items 4 and 5 are compiled.

## Recommended design (one design, $0 monthly)

```
Sponsor console (browser)                Integration server (Carrow & Vale runs it)         Outside
-------------------------                -------------------------------------------         -------
Integrations page
  "Verification package" panel  --POST /v1/billing/card-->  billing: create customer,
     add or replace card                                      hosted or embedded card entry --> payment provider
     price, credit, charges    <--GET /v1/billing----------  ledger, credit balance        <-- payment webhook

Invite form
  [x] Add verification package --POST /v1/invitations {invitation.package:true}-->
                                         1 who is this sponsor? (account token)
                                         2 price from server config (never the browser's)
                                         3 credit first, then charge the card ------------> payment provider
                                            fails -> 402, nothing stored, nothing sent
                                         4 store invitation with package: paid
                                         5 email the link
Investor's link (browser)
  identity step  --POST /v1/verifications (X-Invite-Token)-->
                                         allowed only because this invitation is paid
                                         plug-in "idcheck" creates a session -------------> ID provider page (new tab)
                                 <-- webhook (signed) -----------------------------------  result + screening
  accreditation step (only when the offering needs it)
                                         plug-in "accredit" ------------------------------> accreditation provider
  finish  --POST /v1/invite/complete-->  confirmChecks: results taken from server records
Console
  imports the submission, decide(), AML/KYC page; letter download through the evidence route
  on load: pull screenings changed since last pull  <--- monitoring alert webhook <-------- ID provider (daily)
  invitation ended with no check started -> server credits the sponsor's balance
```

- **One tick box, the content follows the offering.** Identity and screening always; accreditation only when `accreditationRequired` is true (already computed in the snapshot for Rule 506(c) or the firm's rule). Two server-side prices, chosen automatically; the form shows the one that applies.
- **Local mode and the owner's iPhone preview.** With no server the package cannot run. In demo mode (`NS.app.config.demo`; `const config = Object.assign({ demo: true }, window.CVPortalConfig || {});` at `assets/js/app.js:404`, read with sed this session) the box and the panel must still render and walk through with the browser sandbox checks and a ledger entry labelled as a demonstration, with no network call. Outside demo mode with no server, the box is not shown.
- **Edition.** Self-serve edition only (`E.diy`); the managed edition is untouched.
- **Names.** Plug-in ids, display names and env variable names are neutral (for example `idcheck`, `accredit`, `IDCHECK_API_KEY`): the display name is shown to investors, and missing env names are listed to sponsors on the Integrations page.

### Recommended project structure

```
server/
├── lib/accounts.mjs        # sponsor accounts and tokens (new)
├── lib/billing.mjs         # card on file, charge, credit, ledger, payment webhook (new)
├── plugins/idcheck.mjs     # identity + screening + monitoring (new)
├── plugins/accredit.mjs    # accreditation (new)
├── test/fixtures/          # recorded provider and payment replies (new files)
└── test/*.test.mjs         # one test file per new module
assets/js/
├── package.js              # console panel, billing calls, demo ledger (new; add to the three entry pages)
├── invitations.js          # the tick box and the flag
└── integrations.js         # package connection, monitored-screening pull, evidence link
.planning/phases/08-…/checks/  # browser checks for this phase
```

### Anti-patterns to avoid

- **A price or an amount from the browser.** The server holds the price; the browser only displays what `GET /v1/billing` returns.
- **Charging after the email.** Charge first; a failed charge must leave no invitation and send nothing.
- **A second charge on resend or double click.** Use the invitation id as the idempotency key; `resend` never charges.
- **Trusting a webhook body.** Use `refetch: true` and read the result back, as the server already does for token-verified hooks.
- **A vendor name in a plug-in's `name`, `id`, `env` list, error label or README section a sponsor reads.**
- **Building a plug-in from memory of an API.** Fixtures must be transcribed from the provider's reference with its URL beside each, then proven against the sandbox.

## Don't hand-roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Card number entry and storage | Any card field of our own | The payment provider's hosted page or embedded field | Card data on our pages or server brings PCI duties the project cannot carry |
| Webhook signature checks | New HMAC code per provider | `verify()` in `connector.mjs` (and `safeEqual`, `fresh` in `lib/crypto.mjs`) | Raw-byte, constant-time, replay-safe already |
| Provider http calls | `fetch` directly | `requestJson` | Timeouts and secret-free errors |
| ID capture and liveness | Our own camera screen and matching | The provider's flow | Fraud checks and biometric duties |
| Sanctions lists | A scraped or third-party copy | Treasury's Sanctions List Service (already used) | Official, free, current |
| Deciding accreditation | Rules that read tax returns or statements | A licensed third party's letter, or the rule's own written-representation methods | The safe harbour is the third party's confirmation |
| Investor-data encryption | New crypto | `invites.vault` sealing already applied to verification records | Already bound to record and field |

**Key insight:** the phase adds money and entitlement around machinery that exists; almost every new line should be in two new server modules, two plug-ins and one new browser file.

## Common pitfalls

### Pitfall 1: the investor sees the vendor
**What goes wrong:** the plug-in is named after the vendor, or the investor lands on the vendor's page. **Why:** `stepPanel` prints the connection name; Didit's white label needs the $299 plan. **Avoid:** neutral names; get the owner's decision on the vendor's page before building the investor step. **Sign:** a check that greps every rendered screen and email for the vendor names.

### Pitfall 2: screening several names
**What goes wrong:** only the first name is screened, or the call fails. **Why:** the portal screens the investor, the account name, joint owners and beneficial owners together (`screenNames`, integrations.js:434-437); Didit's stand-alone screen takes one subject, with a person or company type. **Avoid:** loop in the plug-in, one call per name, merge hits, and raise the timeout to at least 60 seconds from the 15-second default.

### Pitfall 3: two webhook schemes
**What goes wrong:** monitoring alerts are rejected, or a wrong scheme is accepted. **Why:** session webhooks sign the raw body; alert webhooks sign `<timestamp>.<raw body>` in a different header. **Avoid:** two verifiers in the plug-in, each tested with a recorded delivery; freshness from the signed timestamp.

### Pitfall 4: statuses with spaces and no "expired"
**What goes wrong:** "In Review" or "Kyc Expired" lands as `providerStatus` and the check never moves. **Why:** only four normalized identity statuses exist. **Avoid:** map every listed status; Expired and Abandoned leave the check `pending` so "Start again" makes a new session; a screening "Declined" is a `potential_match` for a person to review, never an automatic rejection.

### Pitfall 5: the sponsor pays and the check cannot start
**What goes wrong:** Carrow & Vale's provider balance is empty, the session call fails, the sponsor was already charged. **Why:** prepaid balance; the $10 credit expires monthly. **Avoid:** on a provider billing error, record an event, tell the sponsor in plain words, and keep the package valid; an owner-facing low-balance signal.

### Pitfall 6: results that arrive a day later
**What goes wrong:** the sponsor's "finished" email says accreditation is waiting and nothing ever updates. **Why:** no server-side refresh; the console polls only while open. **Avoid:** rely on the provider's webhook where one exists; otherwise the console's resume-on-load, and say so on the AML/KYC row.

### Pitfall 7: new store tables
**What goes wrong:** `store.put('accounts', …)` throws on a store file written before the change. **Why:** `data[kind]` is undefined for a table not in the default object. **Avoid:** add every new table to the object at `store.mjs:10`.

### Pitfall 8: refunds cost money
**What goes wrong:** every refund loses the card fee. **Why:** the processor keeps it. **Avoid:** platform credit by default; card refund only on request.

### Pitfall 9: bulk invitations
**What goes wrong:** forty charges of 30¢ fixed fee each, or a partial failure half-way. **Avoid:** one charge for the whole list, then create the invitations; one ledger line per invitation.

### Pitfall 10: the preview with no server
**What goes wrong:** the card panel throws "Failed to fetch" in the owner's iPhone frame. **Avoid:** every billing read behind `serverOn(ws)`; demo data script-loaded; the no-network check extended to the new screens.

## Code examples

Shapes below are from provider documentation as quoted by search, **not from real replies**. They are fixtures to build against, to be confirmed in the sandbox.

### A neutral plug-in skeleton

```js
// server/plugins/idcheck.mjs  (pattern: server/plugins/_template.mjs, server/README.md:212-240)
import { requestJson } from '../lib/request.mjs';
export const name = 'Identity check';            // shown to investors: no vendor name
export const kinds = ['identity', 'aml'];        // statuses: server/lib/statuses.mjs:2-6
export const env = ['IDCHECK_API_KEY', 'IDCHECK_WORKFLOW', 'IDCHECK_WEBHOOK_SECRET'];

const API = 'https://verification.didit.me/v3';  // [CITED: docs.didit.me/sessions-api/create-session]
const call = (ctx, method, path, body, timeoutMs) =>
  requestJson(ctx, API + path, { method, body, timeoutMs, label: name, redirect: 'manual', headers: { 'x-api-key': ctx.env.IDCHECK_API_KEY } });

const IDENTITY = { Approved: 'passed', Declined: 'failed', 'In Review': 'review' };   // everything else stays pending

export async function createSession(ctx) {
  const r = await call(ctx, 'POST', '/session/', { workflow_id: ctx.env.IDCHECK_WORKFLOW, vendor_data: ctx.reference, callback: ctx.returnUrl });
  return { ref: r.session_id, url: r.url, status: 'pending' };
}
export async function fetchResult(ctx) {
  const r = await call(ctx, 'GET', `/session/${encodeURIComponent(ctx.ref)}/decision/`);   // path [ASSUMED]: confirm in the reference
  return { status: IDENTITY[r.status] || 'pending' };
}
export const parseWebhook = ({ body }) => ({ id: body.event_id, ref: body.session_id, event: body.webhook_type, refetch: true });
```

### Charging a saved card (payment provider, form-encoded)

```js
// [CITED: docs.stripe.com/payments/save-and-reuse-cards-only] off_session + confirm; errors when authentication is required
await requestJson(ctx, 'https://api.stripe.com/v1/payment_intents', {
  method: 'POST', label: 'Card payment', redirect: 'manual',
  headers: { Authorization: `Bearer ${ctx.env.BILLING_SECRET_KEY}`, 'Idempotency-Key': invitationId },   // header name [ASSUMED]
  form: { amount: String(cents), currency: 'usd', customer, payment_method, off_session: 'true', confirm: 'true' }
});
```

### The payment webhook with the existing verifier

```js
// server/README.md:251 documents this scheme; the header name is [ASSUMED] until read in the provider's reference
verify({ type: 'hmac', header: 'Stripe-Signature', pattern: 'v1=([0-9a-f]+)', timestampPattern: 't=(\\d+)', signed: '{timestamp}.{body}', secret: '${env.BILLING_WEBHOOK_SECRET}' }, rawBody, headers, env, {});
```

## State of the art (what changed since the 2026-11-15 research)

| 2026-11-15 note | Now | Effect |
|-----------------|-----|--------|
| Didit white label $0.10 a session, implied available pay-as-you-go | $0.10, but only on Scale ($299 a month) or Enterprise; custom domain the same | The $0 path shows the vendor's page; owner decision |
| Identity + screening $0.63 with white label | $0.53 on Free without white label; $0.567 on Scale with it, plus $299 a month | Cost table redone |
| Free tier "contradictory" | $10 credit a month for work-email sign-ups, expiring monthly, per the November docs and help centre; "500 free checks" pages are older | About 18 free package investors a month |
| Ongoing monitoring not priced | $0.07 a person a year, daily, with an alert webhook | Periodic paid re-checks are pointless |
| Session API version not stated | v3 in the docs; v2 only in a blog post | Build to v3 |
| Webhook signing "not confirmed" | Documented: three headers for sessions, a different scheme for alerts; blog posts contradict the docs | Plug-in, not a declarative connector |
| VerifyInvestor $69, bundles | Reconfirmed on its page; API price still on request; free staging server found | Default stands |
| North Capital "$30 not found again" | Three searches now attribute "$30 per investor verification request" to a North Capital page; a review says pricing is negotiated | Worth one email from the owner |
| Parallel Markets quote only | Reseller prices $59 and $75 a letter seen | Market reference for the package price |
| FinCEN adviser AML rule "not researched" | Delayed to 2028-01-01 | No programme duty in force for advisers today |
| — | OFAC record retention is ten years since 2025-03-12 | Retention line in the record |
| — | SEC releases of 2026-09-30 on new accredited-investor credentials, status unconfirmed | Watch; no build |

## Owner decisions, with the default taken if there is no answer

| # | Question | Options | Default |
|---|----------|---------|---------|
| 1 | The ID-check screen | (a) $0 a month: the investor sees the ID provider's own page and name for that one step; (b) $299 a month: the provider's page under Carrow & Vale's or the sponsor's look and domain | (a), recorded as an exception to white label, revisited when package revenue covers $299 a month |
| 2 | Accreditation provider | VerifyInvestor ($69, no minimum); North Capital (possibly $30, terms unknown); Parallel Markets (quote, minimums) | VerifyInvestor; ask North Capital for a written price and whether a platform may order for sponsors |
| 3 | Payments | Stripe (2.9% + 30¢, no monthly fee; its review may question the business); Braintree; bank-transfer invoices for prepaid credits | Stripe |
| 4 | Card entry | The payment provider's hosted page (its name visible to the sponsor) or an embedded field in the console | Embedded field, to keep the white-label rule |
| 5 | Price | Full package $99 / $129 / $149; identity + screening only $19 / $25 | $99 and $19 |
| 6 | Unused package | Credit to the sponsor's balance, or card refund (loses the card fee) | Full credit when the invitation ends with no check started; no credit once a check has started; card refund on request |
| 7 | Hosting the server | Needed before any real check | Not defaulted: the owner decides |
| 8 | Counsel | Flat-fee structure, facilitator wording, the five-year representation across a sponsor's funds, the high-minimum method | Build the free methods switched off until counsel confirms |

## Plan split (about 100k tokens each)

"Fixtures now" means buildable and testable today with an injected `fetch` and recorded replies, the pattern `createServer({ providers, fetch, store })` already used in `test/connectors.test.mjs`. "Owner account" means a real proof needs an account the owner opens and a run by the orchestrator.

| Plan | Scope | Main files | Depends on | Wave | Fixtures now | Owner account for the real proof |
|------|-------|-----------|------------|------|--------------|----------------------------------|
| 08-01 | Sponsor accounts: per-sponsor tokens, every sponsor call pinned to its workspace; the shared `API_TOKEN` keeps working for a single-sponsor server | `server/lib/accounts.mjs`, `authorize()` in `index.mjs`, `store.mjs` table, tests | — | 1 | Yes (no outside service) | No |
| 08-02 | Identity + screening plug-in with neutral names: session, result, several names, both webhook schemes, monitoring enrolment | `server/plugins/idcheck.mjs`, fixtures, tests | — | 1 | Yes, from the documented shapes | Didit sandbox application (free) |
| 08-03 | Accreditation plug-in: order, hosted page for the provider's embedded flow, result, letter through `fetchEvidence` | `server/plugins/accredit.mjs`, fixtures, tests | Decision 2; the provider's reference opened (its webhooks and statuses were not found) | 1 | Partly: blocked until the reference is read | VerifyInvestor issuer account and staging credentials |
| 08-04 | Card on file, ledger, credit balance, payment webhook, `GET /v1/billing` | `server/lib/billing.mjs`, routes in `index.mjs`, tests | 08-01 | 2 | Yes | Payment account in test mode |
| 08-05 | The package on an invitation: flag kept by `cleanInvitation`, server-side price, credit then charge before send, 402 on failure, idempotent, entitlement in `scopeRules` and on `/v1/verifications`, credit when an invitation ends unused, one charge for a list | `server/lib/invitations.mjs`, `index.mjs`, tests | 08-01, 08-04 | 3 | Yes | No more than 08-04 |
| 08-06 | Console: package panel on Integrations (card, price, credit, charges), tick box on the single and list invite forms, demo-mode walk with no network | `assets/js/package.js` (new), `assets/js/invitations.js`, the three entry pages, phase checks | 08-05 for server mode; the demo walk needs nothing | 3 (demo part can start in wave 1) | Yes | No |
| 08-07 | Investor flow and results: package connection in the identity and accreditation steps with neutral wording, letter download on the AML/KYC page, vendor-name leak check | `assets/js/integrations.js`, checks | 08-02, 08-05 | 4 | Yes | No |
| 08-08 | Ongoing screening: sponsor route for screenings changed since a time, console pull on load, a new hit holds the investor; free Treasury re-screen runs by itself when due | `server/index.mjs`, `assets/js/integrations.js`, tests, checks | 08-02; after 08-07 (same browser file) | 5 | Yes | No |
| 08-09 | Ask an investor on file to re-verify accreditation: a single-step link like the tax request, with the package box | `assets/js/invitations.js`, `onboarding.js`, `server/lib/invitations.mjs`, checks | 08-06 | 5 | Yes | No |
| 08-10 | Free methods, off until counsel confirms: written re-representation for an investor verified within five years; high-minimum method with the two representations | `assets/js/integrations.js`, `onboarding.js`, checks | 08-09 | 6 | Yes | No (counsel) |
| 08-11 | AML program record: a small console view, compiled sections, export | `assets/js/amlprogram.js` (new), a schedule in `audit.js`, nav entry in `console.js`, checks | — | 1 (touches no file another wave-1 plan touches except the entry pages) | Yes | No |
| 08-12 | Real proofs, run by the orchestrator with the owner's keys: one sandbox identity session with webhook, one screening with a hit, one monitoring alert, one accreditation on staging, one test-mode card save, charge, decline and refund; then the owner's walk | none (results file) | All above, hosting, the three accounts | 7 | No | Yes: all |

Wave 1 can run 08-01, 08-02, 08-11 and the demo half of 08-06 in parallel today. 08-06 and 08-09 both edit `invitations.js`; 08-07, 08-08 and 08-10 all edit `integrations.js`: keep each pair in sequence.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Didit has no underwriting step for a new account | Didit table | Launch delay |
| A2 | Didit's `X-Signature` is hex and the decision path is `/v3/session/{id}/decision/` | Code examples | Plug-in fails in the sandbox; caught by 08-12 |
| A3 | Didit accepts a platform ordering checks for its sponsors' investors on a normal account | Didit table | Terms breach; ask sales before launch |
| A4 | Stripe will approve software sold to fund sponsors | Payments | No card processor at launch; fall back to Braintree or invoices |
| A5 | Stripe's header names (`Stripe-Signature`, `Idempotency-Key`) and form fields as written | Code examples | Fixture mismatch; caught in test mode |
| A6 | An embedded card field shows no payment-vendor branding | Payments, decision 4 | White-label exception needed |
| A7 | VerifyInvestor consumes a credit only when a verification is ordered or completed, and credits do not expire | Accreditation table | Margin and the credit rule |
| A8 | VerifyInvestor has no webhooks (none found) | Plan 08-03 | Polling design may be unnecessary |
| A9 | Sub-paragraph lettering of Rule 506(c)(2)(ii) other than (B) | Legal basis | Wording only |
| A10 | The five-year representation is per issuer (per fund) | Legal basis | Free re-check used where it does not apply |
| A11 | A sponsor that is not an investment adviser is outside FinCEN's adviser rule; OFAC applies to all U.S. persons | Legal basis | Record contents |
| A12 | Fee structure, facilitator positioning, biometric consent, provider privacy links (carried from 2026-11-15) | Legal basis | Regulatory exposure; counsel |
| A13 | Sales tax may apply to the package in some states | Cost | Margin |
| A14 | Browser checks run Playwright from the global npm root through `heavy.sh` | Validation | Check commands need adjusting |
| A15 | Braintree's rates, Parallel Markets' sandbox, InvestReady and Accredd details | Options tables | Only if one is chosen |

## Open Questions

1. **Does a Didit Free-plan workflow allow any styling (logo, colours) without the Scale plan?** Known: custom domain and "white label" are Scale-only in the November docs; one page says pay-as-you-go. Unclear: whether "Include custom style" works on Free. Recommendation: the owner asks Didit sales in the same message as A3.
2. **What does VerifyInvestor's API cost, and when is a credit consumed?** Known: $69 on the site, API "on request". Recommendation: the owner emails accounts@verifyinvestor.com for the API price, the staging credentials and the rule for unfinished requests.
3. **Is North Capital's $30 real, and may a platform order for sponsors?** One email.
4. **Where does the server run?** Not researched; blocks 08-12.
5. **Does an iframe of the ID provider's flow get camera access inside the owner's test frame?** The docs do not cover it; the redirect (new tab) is the documented fallback and is what the portal already does. The preview has no server, so this only matters on a published page.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node | Server, tests | Yes | v22.23.4 | — |
| Server test suite | RED-first | Yes | 197 pass, 0 fail (run this session) | — |
| `SCRATCH/exec-011/heavy.sh`, `SCRATCH/owner-set/measure.js` | Browser checks, owner walks | Yes (files present) | — | — |
| Network to provider sites | Reading references, sandbox calls | No (`didit.me`, `docs.didit.me` blocked) | — | Recorded fixtures; the orchestrator or owner opens the references |
| Provider and payment accounts, keys | 08-12 | No | — | None: owner opens them |
| Public https server | 08-12, launch | No | — | None: owner decides |
| Disk | Checks, screenshots | 5.9 GB free | — | Delete outputs after the gate |

**Missing with no fallback:** provider and payment accounts; a hosted server. They block only 08-12.
**Missing with fallback:** direct access to provider documentation (fixtures from quoted documentation, confirmed later).

## Validation Architecture

### Test framework
| Property | Value |
|----------|-------|
| Framework | `node --test` (server); phase browser checks as Node scripts through `SCRATCH/exec-011/heavy.sh` |
| Config file | none; `server/package.json` script `"test": "node --test"` |
| Quick run | `npm --prefix server test` |
| Full suite | `.planning/checks/gate-reference.sh` (copy and extend for this phase; counts follow the merged tree) |

### Phase requirements to tests
| Req | Behaviour | Type | Command | Exists? |
|-----|-----------|------|---------|---------|
| VPK-01 | Box shown, flag reaches the server; unticked changes nothing | browser + server | `node …/08-…/checks/package-invite.js`; `node --test server/test/package.test.mjs` | No, Wave 0 |
| VPK-02 | Charge before send; failed charge stores and sends nothing; resend and double submit never charge twice | server | `node --test server/test/billing.test.mjs` | No |
| VPK-03 | Plug-ins map every documented status; no vendor name in any screen or email | server + browser | `node --test server/test/idcheck.test.mjs`; `node …/checks/no-vendor-names.js` | No |
| VPK-04 | Package providers refused without a paid invitation (link and console) | server | `node --test server/test/package.test.mjs` | No |
| VPK-05 | Ended unused invitation credits the balance once | server | `node --test server/test/billing.test.mjs` | No |
| VPK-06 | A monitoring alert becomes a held investor after a console pull | server + browser | `node --test server/test/idcheck.test.mjs`; `node …/checks/monitoring.js` | No |
| VPK-07 | Due investors re-screened against the free lists without a click | browser | `node …/checks/rescreen.js` | No |
| VPK-08 | Re-verify link holds only the accreditation step | browser | `node …/checks/reverify.js` | No |
| VPK-09 | AML program record renders and exports | browser | `node …/checks/aml-record.js` | No |
| VPK-10 | New screens in the sandboxed frame with `connect-src` blocked, 390x844 and 1280x800 | browser | extend `no-network.js`, `ways-out.js` | Partly (phase 06 checks) |

### Sampling rate
- **Per task commit:** `npm --prefix server test` and the plan's own check.
- **Per wave merge:** the full gate.
- **Phase gate:** full gate green, then 08-12's real proofs, then the owner's check.

### Wave 0 gaps
- [ ] `server/test/fixtures/` provider and payment replies, each with the reference URL it was transcribed from
- [ ] `server/test/accounts.test.mjs`, `billing.test.mjs`, `package.test.mjs`, `idcheck.test.mjs`, `accredit.test.mjs`
- [ ] `.planning/phases/08-…/checks/` with `lib.js` reused from phase 06
- [ ] A phase gate script copied from `gate-reference.sh` with the new counts

## Security Domain

### Applicable ASVS categories (level 1)

| Category | Applies | Control |
|----------|---------|---------|
| V2 Authentication | Yes | Per-sponsor tokens stored as hashes, compared in constant time (as invitation tokens already are) |
| V3 Session management | No | Tokens only; no sessions added |
| V4 Access control | Yes | Every sponsor call pinned to its account's workspace; package providers only for a paid invitation; investor tokens can never reach billing routes |
| V5 Input validation | Yes | The existing `clean*` pattern; amounts and prices never taken from a request |
| V6 Cryptography | Yes | Existing HMAC verifier and vault only; nothing new |
| V9 Communications | Yes | https to providers; redirects not followed (`redirect: 'manual'`) |
| V10 / secrets | Yes | Keys in env only; never in settings, logs or errors |

### Threats

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| A sponsor calls the package provider without paying | Elevation | Entitlement on both `/v1/verifications` paths |
| One sponsor charges another's card by naming its workspace | Spoofing | Workspace taken from the token, never the body |
| Forged or replayed payment webhook | Spoofing, Tampering | Signed timestamp, tolerance, duplicate drop by event id |
| Double charge by retry | Tampering | Idempotency key = invitation id |
| Price changed in the browser | Tampering | Server-side price only |
| Forged monitoring alert holds or clears an investor | Tampering | Signature check, then re-read the screening from the provider |
| Card or ID data stored here | Information disclosure | Hosted card entry; provider-hosted ID flow; store only brand, last four digits, expiry |
| Provider or payment key in an error shown to a sponsor or investor | Information disclosure | `requestJson` errors, neutral labels |
| Charge dispute over an unused package | Repudiation | Ledger line per invitation with the invitation's events |

## Sources

### Primary (HIGH: read this session)
- `server/README.md`, `server/index.mjs`, `server/providers/index.mjs`, `connector.mjs`, `ofac.mjs`, `server/lib/statuses.mjs`, `request.mjs`, `store.mjs`, `invitations.mjs` (172-183, 612-721, 905-1004)
- `assets/js/integrations.js` (whole file), `assets/js/invitations.js` (96-265, 396-645, 1362-1474, 1640-1699), `assets/js/onboarding.js` (1010-1044, 1145-1219)
- Server test run: 197 tests, 197 pass

### Secondary (MEDIUM: an official page quoted by search, agreeing with another)
- docs.didit.me: sessions-api/create-session, sessions-api/retrieve-session, integration/webhooks, integration/alert-webhooks, integration/sandbox-testing, getting-started/pricing, console/white-label, reference/aml-screening-standalone-api
- help.didit.me/getting-started/free-plan; didit.me/pricing
- verifyinvestor.com/accredited-investor-verification; docs.verifyinvestor.com (and /embedded.html, /lite.html)
- stripe.com/pricing; stripe.com/legal/restricted-businesses; support.stripe.com (refund fees, restricted-business FAQ); docs.stripe.com (save-and-reuse-cards-only, setup_intents, refunds)
- ecfr.gov and law.cornell.edu for 17 CFR 230.506; sec.gov (no-action letter file name, release 33-11448)
- ofac.treasury.gov (Sanctions List Service, compliance framework)

### Tertiary (LOW: one source, a third party, or conflicting)
- m.northcapital.com (the $30 figure) against altstreet.investments (negotiated pricing)
- support.parallelmarkets.com, help.sponsorcloud.io, support.verivest.com
- Law-firm notes on the no-action letter (Kirkland, Alston & Bird, Legal 500, iCapital), on the FinCEN delay (Morrison Foerster, BDO), on OFAC retention (Greenberg Traurig, Debevoise), on the adviser rule (Cooley)
- Directory listings for Accredd; 2019 coverage of InvestReady; Square fee summaries

## Metadata

**Confidence breakdown:**
- Code findings and gaps: HIGH (files read; tests run)
- Provider API shapes: LOW to MEDIUM (documentation quoted by search; no call made)
- Prices: MEDIUM for Didit, Stripe and VerifyInvestor's list price; LOW for North Capital; none for Parallel Markets, InvestReady, Accredd
- Legal: MEDIUM for the rule text and the no-action letter's terms; counsel decides how they apply
- Plan split: MEDIUM (file overlaps read; sizes not measured)

**Research date:** 2026-11-19
**Valid until:** 2026-11-26 for prices and plan terms (Didit changed its pricing on 2026-11-01); 2026-12-19 for the code findings unless the server or `integrations.js` changes
