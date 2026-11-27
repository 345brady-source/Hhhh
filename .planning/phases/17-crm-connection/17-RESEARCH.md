# Phase 17: CRM connection (HubSpot) - Research

**Researched:** 2026-11-27
**Domain:** one-way sync from the integration server to the sponsor's own HubSpot account (contacts, deals, pipeline stages), a lead picker for invitations, a sealed per-sponsor credential
**Confidence:** MEDIUM for the design (it rests on code read this session); LOW to MEDIUM for HubSpot specifics (see the network note below)

**Network note (read first).** `developers.hubspot.com` and `www.hubspot.com` do not resolve in this session (WebFetch: `getaddrinfo ENOTFOUND`, both hosts, 2026-11-27). Every HubSpot fact below comes from search-engine extracts of HubSpot's own pages, seen 2026-11-27, and is tagged `[CITED: <url> (search extract, 2026-11-27)]`. The search tool's confidence class is LOW (`gsd-tools query classify-confidence --provider websearch` → `LOW`). Nothing about HubSpot in this file is called verified. The owner's live run with a sponsor's own account (CRM-17) is where each of these facts is confirmed or corrected, as plan 08-12 does for the identity check's `ASSUMED` table.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `17-CONTEXT.md`:

## Owner decisions (2026-11-27, AskUserQuestion answers)
- D-01: plan now (researcher, planner, plan check), build after phase 16's plans are merged, finished before step 12 (the reorganize step).
- D-02: the sponsor's own Integrations page may name "HubSpot" so the sponsor knows what it is connecting (sponsors only; the same exception as the ID-check provider's own page). Investors never see the CRM's name, and nothing an investor or prospect receives names it.

## Carried rules
- Built in-house at $0 through the integration server's provider-neutral connector framework (task 28); the sponsor connects its own account (HubSpot has a free CRM tier; current plan prices and API limits per plan to be confirmed by the researcher from HubSpot's own pages).
- No taxpayer number, bank or account number, ID document or accreditation evidence is ever sent to the CRM; only name, email, phone (if given), offering, commitment amount and onboarding status, unless the owner decides otherwise.
- Credentials (the sponsor's HubSpot token or OAuth grant) are sealed on the server like other provider credentials; never in the browser workspace, logs or the sent log.
- Roles: connecting and configuring needs 'configure'; reading CRM data in the console needs 'personal'.
- Fixtures use never-issued numbers; no real HubSpot account is used in checks (a local stand-in of the API); a live run with a sponsor's own account is an owner checkpoint.
- Never the owner's forbidden word; white label as in D-02.

### Claude's Discretion
17-CONTEXT.md has no "Claude's Discretion" section. Everything not fixed above (auth method, sync mechanics, conflict rules, routes, plan split) is the researcher's and planner's choice, recorded here with reasons; choices that change what a sponsor or investor experiences are listed under Open Questions with a default.

### Deferred Ideas (OUT OF SCOPE)
17-CONTEXT.md has no "Deferred Ideas" section. This research keeps out of scope: a marketplace-listed HubSpot app with OAuth (see Auth recommendation; a later phase), other CRMs (the adapter interface allows them later), two-way sync of investor details, HubSpot webhooks.
</user_constraints>

## Project Constraints (from CLAUDE.md and AUTOPILOT.md)

Directives the planner must honour (CLAUDE.md is binding like a locked decision):

- Nothing is called ready, working or done until it has been tested on data it has never seen and the owner has checked it. For this phase: the local stand-in proves the code; only the owner's live run with a sponsor's own HubSpot account proves the connection (CRM-17). Screens say "To be confirmed" where they would otherwise claim a live result (AUTOPILOT work-around rule).
- An outside service that could do the job better must be presented with cost, accuracy, speed and trade-offs before building in-house (see "Alternatives the owner should know about"). The owner has no budget for monthly fees: the $0 path comes first.
- GSD agents only: planner, plan checker, executors in isolated worktrees, verifier. RED-first: every behaviour change has a check that fails before and passes after.
- White label (AUTOPILOT): no vendor, model or library names in anything a sponsor or investor sees, except D-02's exception (the CRM's name on the sponsor's Integrations page only). The forbidden word never appears.
- The owner tests on an iPhone in a sandboxed frame with no server: no fetch()/XHR on any path that must work without a server; every view has a way out on screen; checks at 390x844 with touch and 1280x800. The CRM needs the server by nature, so in the preview its panel is one line and makes zero requests (as the "Email sending" panel does, `assets/js/integrations.js:1352-1355`).
- No paid API calls by agents and no API key given to any agent; no real HubSpot account in checks.
- Save as you go (SAVE-RULES): executors push their wip branch after every commit; this research is committed section by section.
- Disk is limited; keep outputs small. Fixtures use never-issued numbers (16-03's rule).
- Never open any blind/ folder; never commit confidential documents or personal data.

## Summary

The integration server already has everything this phase stands on except the CRM itself: sessions and roles on every route (`server/lib/roles.mjs` ROUTES, plans 15-01/15-05/15-12, merged), a vault that seals any value with its own additional data (`server/lib/vault.mjs`, 15-03, merged), the firm's workspace held sealed on the server with a `get(id)` for server-side readers (`server/lib/workspace.mjs`, 15-06, merged), server-held invitations with their statuses (`server/lib/invitations.mjs`), a sealed sent log and the unsubscribe choices (phase 13), and an Integrations page with a server-backed panel pattern ("Email sending", 13-12). What it does not have is a provider kind for a CRM: the connector framework (`server/providers/`, declarative `connectors.json`, code plug-ins, the results API) is built for verification checks only (`kind / kinds 'identity' | 'aml' | 'accreditation'`, `server/providers/index.mjs:14`). Phase 17 adds a CRM kind beside it: a provider-neutral CRM module on the server (`lib/crm.mjs`: credential, settings, reconcile, log, routes) and one adapter for HubSpot behind a small interface, so another CRM later is a second adapter, not a rewrite.

HubSpot changed under us in 2026. Numbered API paths (`/crm/v3/...`) and legacy private and public apps become unsupported with enforcement in September 2027; new legacy private apps cannot be created in existing accounts since 2026-10-26; the replacement for a pasted account token is a **service key** (Settings > Integrations > Service Keys), still in public beta, which cannot receive webhooks. New code should use date-based paths (`/crm/objects/2026-03/contacts`, with 2026-09 the latest release). An OAuth app (the other route) needs a HubSpot developer account run by the operator, is limited to 25 installs until HubSpot lists it on its marketplace, and puts the app's name in front of every sponsor. For 40 sponsors at $0 that is the wrong first step.

**Primary recommendation:** each sponsor pastes a HubSpot **service key** (or, if it already has one, a legacy private-app token) on its Integrations page; the server checks it, seals it per workspace and never returns it. The server reconciles **one way, portal to CRM**, on a level-triggered loop (after each workspace save, each invitation change, hourly, and on "Sync now"): it computes the allowed fields for each investor and commitment from the server-held data, compares them with what it last sent, and sends only the differences, matched by email for contacts and by a unique portal reference for deals. Nothing comes back from the CRM into an investor's record; the only read is the lead picker, which prefills the existing invitation dialog. No webhooks, no new public route, no new dependency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Holding the HubSpot credential | API / Backend (integration server, sealed in the store) | — | Carried rule: never in the browser workspace, logs or the sent log. Same pattern as the filer code (`filings.mjs:506`). |
| Checking the credential and its scopes | API / Backend | External (HubSpot API) | Only the server may call HubSpot with the key. |
| Pipeline and stage mapping (settings) | API / Backend (CRM settings record) | Browser (Integrations panel edits them) | The reconcile loop runs on the server with no console open; settings must live where it runs. |
| Working out each investor's and commitment's CRM fields | API / Backend, from the server-held workspace and invitations | Shared pure module (`assets/js/crm-map.js`, UMD like `roles.js`) | One allow-list function, read by the server and by the Node checks, so the "never sent" rule is enforced in one place. |
| Sending contacts and deals | API / Backend (reconcile loop, HubSpot adapter) | External (HubSpot) | Runs whether or not the console is open (an investor finishing onboarding at night moves the deal). |
| Sync log | API / Backend (sealed collection) | Browser (shown to 'personal') | Same shape and sealing as the sent log (`lib/maillog.mjs`). |
| Lead picker | API / Backend (searches HubSpot on request) | Browser (list, then the existing invitation dialog) | The browser never calls HubSpot; the key stays on the server. |
| Inviting a lead | Browser (existing invitation flow, `assets/js/invitations.js` create/send) | API / Backend (`POST /v1/invitations`, existing) | Reuses phase 13's invitation path; the CRM only supplies name and email. |
| The no-server preview | Browser | — | One line, zero requests (owner's iPhone rule). |

## 1. HubSpot's API for this phase

All rows: seen 2026-11-27 through search extracts (the hosts are blocked here). Confidence LOW to MEDIUM; each is an item for the live run's checklist (CRM-17).

### 1.1 Versions: build on date-based paths, not `/crm/v3/`

| Fact | Source |
|------|--------|
| HubSpot moved to date-based API versions: `GET /crm/objects/2026-03/contacts` replaces `/crm/v3/` paths; the host stays `https://api.hubapi.com/`; releases each March and September; each version supported at least 18 months. | [CITED: developers.hubspot.com/changelog/introducing-date-based-api-versioning (search extract, 2026-11-27)], [CITED: developers.hubspot.com/docs/api-reference/2026-03/overview (search extract)] |
| A 2026-09 version exists and follows 2026-03. From 2026-09, HubSpot enforces the account's own validation rules on API writes (required properties set in "Create record" settings are enforced on POST), effective 2026-09-08. | [CITED: developers.hubspot.com/changelog/crm-api-write-validation-enforcement (search extract)], [CITED: developers.hubspot.com/changelog/fall-2026-spotlight (search extract)] |
| End of support for v1-v3 APIs, legacy public apps and legacy private apps, enforcement September 2027; v4 associations and `/2025-09/` have an earlier deadline (2027-03-30 per the extract). | [CITED: developers.hubspot.com/changelog/legacy-apis-and-legacy-apps-whats-going-unsupported-and-when (search extract)] |
| Path shapes seen in the 2026-03 reference: `/crm/objects/2026-03/contacts`, `/crm/objects/2026-03/contacts/batch/upsert`, `/crm/pipelines/2026-03/{objectType}` (with `/{pipelineId}` and `/stages`), `/crm/associations/2026-03/{fromObjectType}/{toObjectType}/batch/associate/default`, `/crm/properties/2026-03/0-1` (contacts; `0-1` is the contact object type id). | [CITED: developers.hubspot.com/docs/api-reference/2026-03/crm/objects/contacts/batch/upsert-contacts], [CITED: .../2026-03/crm/pipelines/guide], [CITED: .../2026-03/crm/associations/associate-records/guide], [CITED: .../2026-03/crm/understanding-the-crm] (all search extracts) |
| Some early adopters reported 404s on some 2026-03 paths. | [CITED: community.hubspot.com/t/introducing-date-based-api-versioning/147831 (search extract)] |

**Prescription.** The adapter keeps the version in one constant (`VERSION = '2026-03'`, the release whose path shapes the extracts show) and every path in an `ASSUMED` table at the top of the file, exactly like `server/plugins/idcheck.mjs:27-61`. The live run tries each path; any path that answers 404 there is corrected in the table before launch. Do not write any `/crm/v3/` path: it is unsupported within a year of launch.

### 1.2 Records the phase uses

| Need | HubSpot call (2026-03 shape, `[ASSUMED]` where the extract did not show it) | Notes |
|------|------|------|
| Find a contact by email | `GET /crm/objects/2026-03/contacts/{email}?idProperty=email&properties=firstname,lastname,email,phone` [ASSUMED path; `idProperty=email` reads are long-standing v3 behaviour] | Read first, then create or update: see 1.4 on why not email upsert. |
| Create a contact | `POST /crm/objects/2026-03/contacts` `{ properties: { email, firstname, lastname, phone? } }` | A second contact with the same email answers 409 with the existing id in the message [ASSUMED: training knowledge, long-standing v3 behaviour]. |
| Update a contact | `PATCH /crm/objects/2026-03/contacts/{id}` `{ properties }` [ASSUMED] | Only the fields the portal owns, only when they changed. |
| Create or update a deal idempotently | `POST /crm/objects/2026-03/deals/batch/upsert` `{ inputs: [{ idProperty: 'portal_ref', id: '<ref>', properties: { dealname, amount, pipeline, dealstage } }] }` | Upsert by a unique custom property is documented for objects with a unique identifier property [CITED: developers.hubspot.com/docs/api-reference/latest/crm/objects/contacts/batch/upsert-contacts.md (search extract)]; using it for deals is [ASSUMED]. |
| Associate deal and contact | in the create body `associations: [{ to: { id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }]`, or `POST /crm/associations/2026-03/deals/contacts/batch/associate/default` | `associationTypeId 3` appears in HubSpot's deal-create example; that it means deal-to-contact is not stated in the extract [CITED: developers.hubspot.com/docs/api-reference/legacy/crm/objects/deals/guide (search extract)]. Prefer the `associate/default` call: it needs no type id. |
| Pipelines and stages | `GET /crm/pipelines/2026-03/deals` | Readable with `crm.objects.deals.read` [CITED: developers.hubspot.com/docs/api-reference/latest/crm/pipelines/get-pipelines.md (search extract)]. |
| The two custom properties (deal `portal_ref`, unique; contact offering-email choice) | `GET` / `POST /crm/properties/2026-03/deals` and `/0-1` | Creating needs `crm.schemas.deals.write` / `crm.schemas.contacts.write` [CITED: create-pipeline page lists `crm.schemas.deals.write` for schema writes (search extract)]; exact scope per property call [ASSUMED]. |
| Leads for the picker | `POST /crm/objects/2026-03/contacts/search` with a `lifecyclestage EQ lead` filter and a text query [ASSUMED path] | Search: 5 requests per second per account, 200 records per page, no rate-limit headers in replies [CITED: developers.hubspot.com/changelog/crm-search-api-rate-limit-increase (search extract)]. Search results lag new writes by seconds [ASSUMED]. |

### 1.3 Authentication for a product used by many sponsors

| Option | What the sponsor does | Fits a self-hosted server? | Limits | White label | Status (2026-11-27) |
|--------|------|------|------|------|------|
| **Service key** (recommended) | A Super Admin (or a user with Developer tools access) opens Settings > Integrations > Service Keys, ticks the scopes, copies the key, pastes it into the portal. | Yes: a Bearer token, no redirect URL, no developer account, nothing for the operator to register. | Same limits as privately distributed apps; 100 project apps, service keys and MCP connectors per account combined; rotation with a 7-day grace period; **no webhooks**. | The sponsor names the key itself; nothing of ours appears in HubSpot. | **Public beta** [CITED: developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys (search extract)], [CITED: developers.hubspot.com/changelog/service-keys (search extract)], [CITED: developers.hubspot.com/changelog/fall-2026-spotlight (search extract)]. Availability on the free tier: no observation (not found in any extract). |
| Legacy private-app token | Only a sponsor that made one before the cut-off pastes it; same field. | Yes (Bearer). | 100 requests per 10 s per app (Free/Starter), 190 (Professional/Enterprise). | As above. | Creation disabled 2026-09-28 (new accounts) and 2026-10-26 (existing accounts); existing tokens keep working until the September 2027 enforcement [CITED: developers.hubspot.com/changelog/legacy-private-app-creation-sunset (search extract)]. |
| Projects-based private app (static auth) | Install HubSpot's CLI, run `hs project create --distribution private --auth static`, upload, install, copy the token. | Yes (Bearer) but a sponsor will not run a CLI. | One standard account per app. | As above. | Current [CITED: developers.hubspot.com/docs/apps/developer-platform/build-apps/migrate-an-app/migrate-an-existing-private-app (search extract)]. Not offered: too technical for a sponsor. |
| OAuth app (marketplace distribution) | Clicks "Connect", signs in to HubSpot, approves the scopes. | Only with one app registered by the operator, its client secret on the operator's server and one redirect URL; each self-hosting firm would need its own app. | **25 installs until HubSpot lists it on the marketplace**; listing needs review and active installs; private-distribution OAuth apps: 10 accounts [CITED: developers.hubspot.com/docs/apps/developer-platform/build-apps/manage-apps-in-hubspot (search extract)], [CITED: developers.hubspot.com/changelog/new-marketplace-distribution-app-install-limits (search extract)]. Per-install burst 110 requests per 10 s [CITED: developers.hubspot.com/docs/methods/check-daily-api-usage (search extract)]. | The app's name and maker are shown on HubSpot's consent screen and connected-apps list to every sponsor. | Current. Webhooks need a projects-based app [CITED: account-service-keys page (search extract)]. |

**Recommendation: the service key, with the legacy private-app token accepted in the same field.** Reasons, in order: it costs $0 and needs no developer account, app review or redirect URL, so it works the same on the operator's shared server and on a firm's own server; it is not capped at 25 sponsors (the launch plan is 40 free sponsors); it keeps the product's name out of the sponsor's HubSpot; and the sponsor controls and can revoke it. Its costs are honest ones: it is in public beta (its shape may change; the adapter is one file), its availability on HubSpot's free tier was not observed (the live run must check; if a free account has no Service Keys page, the fallback is a legacy token where the sponsor has one, else the OAuth app below), it needs a Super Admin, and it cannot receive webhooks, which this design does not need (2.4). OAuth stays the later step if the 25-install cap or a marketplace listing becomes worth it; the adapter interface (`auth: 'key' | 'oauth'`) leaves room for it. The credential is called "access key" on screen, not "service key", so the field also covers a legacy token without explaining HubSpot's history.

### 1.4 Scopes (least privilege)

The key needs exactly these (names from HubSpot's scope lists as quoted in the extracts; the live run confirms each with a call):

| Scope | Why | Source |
|-------|-----|--------|
| `crm.objects.contacts.read` | find a contact by email; the lead picker | [CITED: account-service-keys page names it as an example scope (search extract)] |
| `crm.objects.contacts.write` | create and update contacts | [CITED: developers.hubspot.com/docs/api/scopes (search extract)] |
| `crm.objects.deals.read` | read pipelines and stages; read deals | [CITED: developers.hubspot.com/docs/api-reference/latest/crm/objects/deals/get-deals.md (search extract)] |
| `crm.objects.deals.write` | create and update deals; associations | [CITED: developers.hubspot.com/docs/api-reference/latest/crm/objects/deals/guide.md (search extract)] |
| `crm.schemas.deals.write` | create the deal property `portal_ref` once, at connect | [CITED: create-pipeline page lists it for schema writes (search extract)] |
| `crm.schemas.contacts.write` | create the contact property for the offering-email choice once, at connect (only if the owner keeps that default, OQ-3) | [ASSUMED] by symmetry with deals |

Not requested: lists, owners, companies, marketing email, communication preferences (see 3.6), files, timeline. On connect the server makes one cheap call per scope and names any that is missing in a plain sentence ("Your key is missing permission to change deals. Add it in HubSpot and paste the key again."). How HubSpot reports a missing scope (status and body) is [ASSUMED: 403 with a category naming the missing scopes]; the stand-in models it and the live run confirms it.

### 1.5 Rate limits per plan

| Plan | Burst | Daily | Source |
|------|-------|-------|--------|
| Free and Starter | 100 requests per 10 s per app | 250,000 per account | [CITED: developers.hubspot.com/docs/methods/check-daily-api-usage (search extract)] |
| Professional | 190 per 10 s per app | 625,000 per account | same |
| Enterprise | 190 per 10 s per app | 1,000,000 per account | same |
| API limit increase add-on | 250 per 10 s (does not stack) | +1,000,000 | [CITED: developers.hubspot.com/changelog/increasing-our-api-limits (search extract)] |
| CRM search (any plan) | 5 requests per second per account, shared with the sponsor's other integrations | — | [CITED: developers.hubspot.com/changelog/crm-search-api-rate-limit-increase (search extract)] |

Service keys share these "privately distributed app" limits [CITED: account-service-keys page (search extract)]. Over a limit HubSpot answers 429; daily quotas reset at midnight in the account's time zone (same extract). Our volume is tiny (a sponsor's whole investor list is hundreds of records, sent once, then only changes), so the design stays far below the burst limit by sending one request at a time per workspace and honouring `Retry-After`.

### 1.6 The free CRM tier

| Question | Answer | Confidence |
|----------|--------|------------|
| Does a free account get the API? | Legacy private apps were available on free accounts [ASSUMED: training knowledge]; service keys on the free tier: no observation. | LOW: the first item of the live run. |
| Deal pipelines on free | The default deal pipeline only: 0 custom pipelines on free tools, 15 on Starter, 100 on Professional (seat-based pricing) [CITED: knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines (search extract)]. | MEDIUM. Design consequence: we never create a pipeline; the sponsor maps our stages to the stages of a pipeline it already has. |
| Custom properties on free | Third-party guides say 10 custom properties in total on free; no HubSpot page confirmed it in the extracts. | LOW. The design uses at most two (one per object), so it fits either way. |
| Contacts and users on free | "Free for up to 2 users" [CITED: hubspot.com/pricing/suite (search extract)]; a third-party guide claims a 1,000-contact cap on free (unconfirmed). | LOW for the contact cap: the console must show HubSpot's own refusal sentence class ("Your CRM refused new contacts: its plan may be full.") rather than retrying forever. |

### 1.7 Webhooks

HubSpot webhooks (for example "contact created") belong to a projects-based app with a client secret; deliveries carry `X-HubSpot-Signature-V3` (base64 HMAC-SHA256 with the app's client secret over method, full URI, raw body and timestamp) and `X-HubSpot-Request-Timestamp`; reject anything older than 5 minutes [CITED: developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/request-validation (search extract)]; the timestamp is in milliseconds [CITED: hookdeck.com/webhooks/hubspot/verify (search extract, third party)]. Service keys cannot receive webhooks [CITED: account-service-keys page (search extract)].

**Prescription: no webhooks in this phase.** The only thing the portal needs from HubSpot is the lead list, which is read on request when the sponsor opens the picker (2.5). This removes a public route, a signature scheme, a client secret and the 25-install app from the phase. The existing `/webhooks/:provider` route (`server/index.mjs:824-861`) is not touched.

### 1.8 Idempotency and de-duplication

- HubSpot has no idempotency key on create calls [ASSUMED: none appears in any extract]. Idempotency therefore comes from natural keys:
- **Contacts by email.** HubSpot keeps one contact per email. Upsert with `idProperty: 'email'` is documented, but partial upserts are not supported with email as the key, and several developers report 400 "Unable to perform update/upsert by non-unique 0-1 property email" in some accounts [CITED: community.hubspot.com/t/contact-batch-upsert-endpoint/111755 and developers.hubspot.com/docs/api-reference/latest/crm/objects/contacts/batch/upsert-contacts.md (search extracts)]. So: read by email, then PATCH the id found, or POST; a 409 on POST (the contact appeared meanwhile) is read for the existing id and treated as found. The server stores the link (investor id → contact id) and uses the id from then on.
- **Deals by a portal reference.** A deal has no natural key. The connector creates one deal property, `portal_ref` (label "Portal reference", unique values), at connect, and upserts deals by it. A retry after a timeout, a restart mid-send or a double "Sync now" then updates the same deal instead of creating a second one. The reference is `<workspace>:<investorId>:<offeringId>` hashed to a short opaque string (no name or amount in it).
- Email matching on our side: trimmed and lower-cased (`emailHash` in `lib/maillog.mjs` already does this for the bounce list).

## 2. Prices and what a sponsor must have

### 2.1 Published prices (search extracts; hubspot.com is blocked here)

| Plan | Price | Source and date |
|------|-------|-----------------|
| Free | $0, up to 2 users | [CITED: hubspot.com/pricing/suite (search extract, seen 2026-11-27)] |
| Starter (Customer Platform / Sales Hub) | "starting at $7/mo/seat, rising to $20/mo/seat"; third-party pages (seen 2026-11-18 by the cited page) say $7 a seat paid annually or $10 paid monthly as new-customer discounts beside a regular $20; no onboarding fee | [CITED: hubspot.com/pricing/suite/starter (search extract)], [CITED: trellus.ai/post/hubspot-sales-hub-pricing (third party)] |
| Professional (Customer Platform) | starts at $1,300/mo with 6 seats; more Core Seats from $45/mo | [CITED: hubspot.com/pricing/suite (search extract)] |
| Professional (Sales Hub) | $90 a seat a month annually or $100 monthly, plus a required one-time $1,500 onboarding fee | [CITED: sybill.ai and docket.io pricing pages (third party, search extracts)] |

Prices are [CITED] from extracts, not read on HubSpot's page; they are context for the owner, not something the product depends on.

### 2.2 What a sponsor must have to use the connection

- Any HubSpot account, free included, **if** the free account offers Service Keys (to be confirmed in the live run) or the sponsor already has a legacy private-app token.
- A person who is a Super Admin in that HubSpot account (or has Developer tools access) to create the key [CITED: account-service-keys page (search extract)].
- In the portal: the integration server (the CRM cannot run in the browser), and an Owner or Admin signed in within the last 10 minutes to connect (CRM-01).
- A deal pipeline in HubSpot whose stages the sponsor maps to ours (every account has the default one).
- No paid HubSpot plan, no add-on, no app install. Nothing from Carrow & Vale is installed in the sponsor's HubSpot.

## 3. The sync design

### 3.0 What the code already holds (read this session)

| Fact | Where (verbatim) |
|------|------------------|
| The connector framework serves verification checks only. | `server/providers/index.mjs:14`: `kind / kinds        'identity' \| 'aml' \| 'accreditation' (kinds when it serves more than one)` |
| Investor onboarding states in the workspace. | `assets/js/data.js:221`: `onboarding = { status: 'invited', step: 0, invited: '2026-10-28', completed: '' }`; `:229`: `onboarding = { status: 'in_progress', step, invited: '2026-10-21', completed: '' }`; `:212`: `onboarding: { status: 'complete', step: 5, invited: '2022-01-10', completed: '2022-01-12' }` |
| Invitation states. | `assets/js/invitations.js:41-42`: `const ENDED = ['completed', 'cancelled', 'expired'];` / `const OPEN = ['sent', 'opened', 'in_progress'];` |
| Subscription request states. | `assets/js/console.js:2412`: `{ pending: badge('warn', 'Pending review'), approved: badge('adj', 'Approved'), rejected: badge('mute', 'Declined'), paid: badge('ok', \`Paid ${date(r.paid)}\`), funded: badge('ok', 'Funded'), accepted: badge('ok', 'Accepted') }` |
| Accreditation result values. | `assets/js/integrations.js:61`: `accreditation: [['verified', 'Verified'], ['review', 'Needs review'], ['rejected', 'Not verified']]` |
| A commitment is a position on the investor. | `assets/js/data.js:241`: `{ offeringId: o.id, amount: Math.round(amt * called), commitment: amt, date } : { offeringId: o.id, amount: amt, date }` |
| The server can read the stored workspace with no request. | `server/lib/workspace.mjs:8`: `get(id)                        → { ws, version } \| null   (the stored workspace, opened, nothing masked; for 15-15)`; `:476`: `return { handle, get, put };` |
| Email matching key already used for the bounce list. | `server/lib/maillog.mjs:26`: `` export const emailHash = (address) => createHash('sha256').update(`mail:${str(address).trim().toLowerCase()}`).digest('hex'); `` |
| A per-firm credential sealed in the store (the precedent). | `server/lib/filings.mjs:497-498`: `// A filer code is a credential: it is stored only sealed, on every server and in every mode.` / `` if (!vault.enabled) throw fail(400, 'Set DATA_KEY on this server (32 random bytes, base64): a CCC is stored only sealed'); ``; `:506`: `` ccc: vault.seal(b.ccc, `issuer:${cik}:ccc`) `` |

The exact "signed" marker (the envelope state that means the investor signed) and "funded" marker are read by the planner from `assets/js/invitations.js` (envelope `status === 'completed'`, around lines 473 and 1226) and `assets/js/operations.js` (`markFunded`, line 313; positions pushed at line 102). They are not quoted here as values to copy: the planner opens those lines and quotes them in the plan.

### 3.1 Shape: level-triggered reconciliation, portal to CRM

Not an event queue. For each workspace with a connection, the server repeatedly answers one question: "what should the CRM show for each investor and commitment, given what the portal holds now, and how does that differ from what we last sent?" It sends only the difference and records what it sent. Every retry, restart, missed event or "Sync now" is just the next run of the same question, so the design is idempotent by construction and there is no queue to lose.

```
 triggers                          reconcile(workspace)                                   HubSpot (sponsor's)
 ─────────                         ────────────────────                                   ───────────────────
 PUT /v1/workspace saved  ──┐      1 load: workspaces.get(ws) + server invitations
 invitation status changed ─┼──►   2 desired = crmMap.records(ws, invitations, settings)   (pure; allow-list)
 hourly timer ──────────────┤      3 last    = sent snapshot per record (sealed)
 "Sync now" (configure) ────┘      4 diff    = fields where desired != last
                                   5 for each record with a diff, one at a time:
                                       contact: link? PATCH : read by email ─► found? PATCH : POST (409 ► found) ──►  contacts
                                       deal:    upsert by portal_ref (stage, amount, name) + associate default ───►  deals
                                   6 outcome  ─► sync log (sealed) ; snapshot updated only on success
                                   7 429/5xx/timeout ─► back off (Retry-After) ; 401/403 ─► connection "needs attention", stop
```

- The desired state comes from **one pure function** in a shared UMD file (`assets/js/crm-map.js`, loaded by the server with `createRequire` as `server/lib/roles.mjs:25` loads `assets/js/roles.js`): `records(ws, invitations, settings) → [{ key, kind: 'contact' | 'deal', fields }]`. It builds each record from an allow-list of fields (3.3) and nothing else, so a field cannot leak by being forgotten in a deny-list. Node checks and server tests call the same function.
- Triggers: after a successful `PUT /v1/workspace` (one line in `workspace.mjs`'s success path calling `crm.touch(id)`), after each change of a server invitation's status or step (`lib/invitations.mjs`), on an hourly timer (the pattern of `lib/invitations.mjs:912-919`, `unref`'d), and on `POST /v1/crm/sync`. A touch only schedules a run a few seconds later and coalesces repeats, so a burst of saves makes one run.
- One run at a time per workspace, one HubSpot request at a time: far below 100 per 10 s, and no two runs race on the same contact.
- Before 15-17 merges, the console still saves to the browser and the server's stored workspace is empty or stale; reconcile then has nothing to send for investors. That is why the build waits for 15-17 (section 8).

### 3.2 Investor to contact (match by email)

1. Linked already (investor id → contact id stored)? PATCH that id with the changed fields.
2. Not linked: read by email. Found: link it, then PATCH only fields that are empty in HubSpot or that the portal owns and changed (3.4). Not found: POST a new contact. POST answers 409 (it appeared meanwhile): read the id from the reply or read by email again, link, continue.
3. The investor's email changed in the portal: PATCH the linked contact's email. If HubSpot refuses because another contact has that address (409), log "Another contact in your CRM already has this address" and change nothing; never merge contacts.
4. One contact per investor, the main investor only (co-investors are not sent in this phase: their own consent and records are a separate question, OQ-6).
5. Names: `firstname` / `lastname` from the invitation's first and last name when the portal has them, else the contact name split at its last space; the account title (for example a trust's name) goes into the deal name, not the contact.

### 3.3 Commitment to deal, and the stage map

One deal per investor and offering (an invitation or subscription to that offering). Fields: `dealname` = "<offering name> · <account title>", `amount` (the commitment, in the offering's currency as a decimal), `pipeline` and `dealstage` from the sponsor's map, `portal_ref` (opaque), associated with the contact.

The portal's stages, computed by `crm-map.js` from the server's data in this order (the deal shows the furthest one reached):

| Portal stage | Reached when | Suggested HubSpot stage (default pipeline) |
|------|------|------|
| Invited | invitation `sent` (or `opened`) | first open stage [ASSUMED: `appointmentscheduled` is the default pipeline's first stage id; read from `GET /crm/pipelines/.../deals`, never hard-coded] |
| Started | invitation `in_progress`, or onboarding `in_progress` | second open stage |
| Signed | the subscription agreement signed by the investor | a middle stage |
| Accredited | signed, and accreditation `verified` (or not required for the offering) | a later stage |
| Funded | the subscription's money recorded (a funded request or a position with an amount) | a won stage |
| Cancelled | invitation `cancelled` or `expired` with nothing signed, or the request `rejected` | a lost stage |

- The sponsor picks a pipeline and maps each portal stage to one of its stages on the Integrations panel; the server suggests a map by stage order and won/lost flags (pipeline stages carry metadata such as a probability or closed flag [ASSUMED]). A portal stage left unmapped moves nothing. Nothing is sent until the sponsor has saved a map ("Start syncing").
- Free accounts have only the default pipeline (1.6), so the design never creates a pipeline or stages.
- The stage is written when the portal stage changes, not on every run: if the sponsor drags a deal in HubSpot, it stays there until the portal's next stage change. Stages never move backwards except to the Cancelled mapping.
- Write validation from 2026-09 (1.1): if the sponsor's HubSpot makes a property required on deal creation, the POST is refused; the log shows the sponsor's own rule as the reason ("Your CRM requires a field this connection does not send: <property label>") and the deal waits.

### 3.4 Which fields go, which never go, direction of truth

| Field | Goes | Direction of truth | Rule |
|------|------|------|------|
| Email | yes | portal | match key; changed on the linked contact when the investor's email changes (3.2) |
| First name, last name | yes | portal | written on create; afterwards only when the portal's value changes |
| Phone | only if the portal has one | portal | never blanks a phone HubSpot has |
| Offering (in the deal name) | yes | portal | deal name written on create and when the offering's name or account title changes |
| Commitment amount | yes | portal | written when it changes |
| Onboarding stage | yes | portal (stage map) | written when the portal stage changes (3.3) |
| Portal reference | yes (deal property) | portal | opaque, written once |
| Offering-email choice | default yes (OQ-3) | **portal, always** | see 3.6 |
| Taxpayer numbers (any of `tin`, `ssn`, `ein`, `ftin`, `usTin`, `w8UsTin`, `ownerTin`, `e8UsTin`, `e8Owner<n>Tin`, `tinLast4`), bank or account numbers, routing numbers, ID documents or their images, accreditation evidence (letters, statements, basis, method, verifier), date of birth, address, tax form type, payment method, KYC/AML results and hits, notes, documents, messages | **never** | — | not in the allow-list; a test sends an investor holding every one of them and asserts that no request body reaching the stand-in contains any of their values (CRM-07). Address is excluded because the carried rule does not list it. |
| Anything from HubSpot into an investor record | **never** | — | the portal never writes CRM data into `ws.investors`; the only read is the lead picker, which prefills a dialog the sponsor confirms |

HubSpot-only fields (owner, notes, lifecycle stage, lead status, tasks, emails) are never read or written. "Write only on change" means a sponsor's edit in HubSpot to one of our fields survives until the portal's own value changes; the portal does not fight the CRM on every run.

### 3.5 Conflicts and deletes

- **Conflict on a portal-owned field**: the portal's value wins, but only at the moment the portal's value changes (3.4). There is no periodic overwrite.
- **Record deleted in HubSpot** (PATCH answers 404): the link is marked "Removed in your CRM" and the record is **not** re-created on its own (the sponsor may have deleted it on purpose, for example on an erasure request). The log row offers "Link again", which clears the link so the next run matches by email or creates.
- **Contacts merged in HubSpot**: reading a merged-away id returns the surviving record [ASSUMED]; the link is updated to the id HubSpot returns.
- **Investor removed in the portal or invitation cancelled**: the deal moves to the Cancelled mapping (if mapped); the portal never deletes a HubSpot record.
- **Disconnect**: the key is deleted at once; links, snapshots and the log stay until the sponsor chooses "Forget this CRM's records" or the portal is closed (15-20 purge). Reconnecting the same HubSpot account (same account id) reuses the links; a different account starts fresh.
- **Duplicate emails inside the portal** (two investor records, one address): both link to the same contact; each keeps its own deal. Logged once as a note.

### 3.6 Unsubscribes: the investor's choice is never overridden by the CRM

- The choice lives where phase 13 put it: the server's `mailprefs` per workspace and address hash (`server/lib/messages.mjs` header lines 26-36, `POST /unsubscribe/<token>`). The CRM module **never writes** `mailprefs` and never reads anything from HubSpot that could change it. A contact re-subscribed in HubSpot changes nothing in the portal. Test: CRM-09.
- Pushing the choice the other way protects the sponsor: if it emails investors from HubSpot about new offerings, an investor who turned offering emails off in the portal should not get them (CAN-SPAM opt-outs are the sender's duty; counsel to confirm, OQ-3). HubSpot's own opt-out call (`/communication-preferences/2026-03/statuses/{email}/unsubscribe-all`) unsubscribes the contact from **all** email, has no undo, and may need a marketing plan [CITED: developers.hubspot.com/docs/api-reference/2026-03/communication-preferences/guide and the v1 page's "NO UNDO" warning (search extracts)]. That is broader than the investor's choice (offering news from one firm), so the connector does not call it.
- Default (OQ-3): the connector creates one contact checkbox property, "Offering emails turned off in the portal", and sets it when the investor turns offering emails off. The Integrations panel says in one line that the sponsor should exclude those contacts from its HubSpot offering emails. Nothing is ever set back to "on" by the CRM.

### 3.7 Retries and the sync log

- Retry: network errors, timeouts, 429 (wait `Retry-After`, else 10 s), 500-504: the record stays unsent and the next run tries again, with backoff per workspace (30 s, 2 min, 10 min, then hourly). The snapshot is updated only after HubSpot accepted the write, so nothing is marked sent that was not.
- Stop: 401 (key revoked or expired) or 403 missing scope: the connection becomes "Needs attention: <sentence>", runs stop, and the Owner and Admins see it on the panel. The key is not deleted (the sponsor may fix the scope in HubSpot). Other 4xx: that record is marked failed with a plain sentence and the run continues with the next record.
- Error text from HubSpot is never shown or stored as is (it can quote record data): the adapter maps status and category to a fixed sentence; the log keeps the HTTP status and HubSpot's category code only.
- **Sync log**, a collection like the sent log (`lib/maillog.mjs`): one entry per record write attempt: `{ id, at, workspace, investorId, offeringId?, kind: contact | deal, action: create | update | link | stage, fields: ['amount', 'dealstage'] (names only), status: sent | failed | waiting | removed, httpStatus? }`; anything that names a person (the email, the contact's name) is sealed with `DATA_KEY` under `crmlog:<id>`; entries kept `CRM_LOG_DAYS` (default 365; deleted by the same hourly run). `GET /v1/crm/log` needs 'personal'.
- The sent log (email) is not touched: the CRM sends no email.

### 3.8 A lead in HubSpot invited from the console

1. On the Investors page's invite dialog (where invitations start today, `assets/js/invitations.js` around line 1940), a person with 'personal' sees "Choose from your CRM" when a connection is live. It opens a list from `GET /v1/crm/leads?q=` (server-side HubSpot search: lifecycle stage Lead, text query on name or email, 50 per page, contacts already linked to an investor left out).
2. Choosing one fills the dialog's name and email (and phone where the dialog has a field); the person still chooses the offering and commitment and presses the existing Send. Inviting needs 'operate' as today (`POST /v1/invitations` is `'operate'`, `server/lib/roles.mjs:72`).
3. The invitation carries `crmContactId`; on the next run the contact is linked by that id (not re-matched), and the deal is created at the Invited stage.
4. Search lag: a lead created in HubSpot seconds ago may not be listed yet [ASSUMED]; the list says "Not listed? Leads added in the last minute can take a moment to appear." Nothing polls.
5. In the preview (no server) the button does not appear.

### 3.9 Routes (every one needs a ROUTES line; an unnamed path answers 404)

ROUTES' rule, verbatim (`server/lib/roles.mjs:5-6`): `ROUTES   one line per route and caller kind, a flat array: a later plan (phase 14's 14-08, phase 16) extends it by` / `adding lines only, never by editing one.` Permissions available (`assets/js/roles.js:37`): `const PERMISSIONS = Object.freeze(['view', 'operate', 'pay', 'spend', 'configure', 'team', 'account', 'personal', 'audit', 'reports']);`. Grants (`assets/js/roles.js:42-46`): `owner: Object.freeze(PERMISSIONS.slice()),` / `admin: Object.freeze(PERMISSIONS.filter((p) => p !== 'account')),` / `team: Object.freeze(['view', 'operate', 'personal', 'audit', 'reports']),` / `readonly: Object.freeze(['view', 'personal', 'audit', 'reports']),` / `accountant: Object.freeze(['view', 'audit', 'reports'])`.

Lines to add (all `team(...)`, `tokens: false`: people only, like the workspace routes, so a leaked account token cannot connect a CRM or read leads):

| Method and path | Permission | What it does |
|------|------|------|
| `GET /v1/crm` | view | `{ connected, provider: 'hubspot', account: { id, domain }, status: ok \| needs_attention \| not_connected, detail, settings: { pipelineId, stages }, counts, lastRunAt, live }`; never the key |
| `PUT /v1/crm/connection` | configure, plus a sign-in in the last 10 minutes | `{ key }` → checks the key (account, scopes), creates the two properties if missing, seals and stores it; change log "CRM connected" (account id only) |
| `DELETE /v1/crm/connection` | configure | deletes the key; change log "CRM disconnected" |
| `GET /v1/crm/pipelines` | configure | the account's deal pipelines and stages, for the map |
| `PUT /v1/crm/settings` | configure | `{ pipelineId, stages: { invited, started, signed, accredited, funded, cancelled }, on }` |
| `POST /v1/crm/sync` | configure | run now; also clears "Removed in your CRM" for one record with `{ relink: <recordKey> }` |
| `POST /v1/crm/forget` | configure | deletes links, snapshots and log for this workspace (after disconnect) |
| `GET /v1/crm/log` | personal | sync log entries, newest first |
| `GET /v1/crm/leads` | personal | the lead picker |

`configure` is Owner and Admin only, so Staff can see the leads and invite (personal + operate) but not connect; Read-only sees leads and the log but cannot invite; the Accountant sees the panel's status only (and the Integrations page is hidden to roles other than Owner and Admin anyway: `assets/js/roles.js:70` `'console-integrations': row('act', 'hidden', 'hidden', 'hidden'),`). No line is needed in `server/lib/workspace.mjs` SECTIONS because nothing of the CRM is stored in the workspace; if the planner keeps any non-secret CRM setting in the workspace instead, it goes under the existing line (`server/lib/workspace.mjs:82`: `integrations: Object.freeze({ write: 'configure' }),`), never under a new top-level key (a key with no line is refused for everyone).

### 3.10 Where things are stored (server collections, all per workspace)

| Collection | Holds | Sealed |
|------|------|------|
| `crm` (one record per workspace) | provider, account id and domain, status, settings, `key` | `key` sealed with `vault.seal(key, 'crm:<workspace>:key')` (a sealed value's additional data is its own record and field, `server/lib/vault.mjs:5-8`); refused when `vault.enabled` is false, as the filer code is |
| `crmlinks` | `{ id, workspace, recordKey, kind, remoteId, removed, sent: <sealed snapshot of the last fields sent> }` | the snapshot (it holds names and emails) |
| `crmlog` | 3.7 | the person-naming part |

`server/tools/reseal.mjs` and `backup.mjs` cover these without change (a sealed value names its own additional data). 15-20's purge must delete all three for a closed portal (section 8).

## Architecture Patterns

### Recommended structure
```
server/
├── lib/crm.mjs            # provider-neutral: routes, key sealing, settings, reconcile loop, log, triggers
├── crm/hubspot.mjs        # the adapter: ASSUMED table, paths, scopes, error mapping (the only file naming the CRM's API)
├── crm/index.mjs          # adapter registry (one entry now; another CRM later is another file)
└── test/
    ├── hubspot-fake.mjs   # local HTTPS stand-in of the API (like ses-fake.mjs)
    ├── crm-connect.test.mjs, crm-sync.test.mjs, crm-fields.test.mjs, crm-roles.test.mjs, crm-leads.test.mjs
assets/js/
├── crm-map.js             # pure UMD: records(ws, invitations, settings) and stageOf(); the allow-list
└── integrations.js        # the CRM panel (crmPanel(ws), like mailPanel), only when the server is connected
```

A separate `server/crm/` folder rather than `providers/` keeps the verification registry's validation (ids, kinds, `env` lists) unchanged; the README gets a "CRM" section in the "Plugging in a provider" style.

### Pattern 1: the CRM adapter interface
```js
// server/crm/index.mjs - Source: modelled on server/providers/index.mjs's adapter interface (read this session)
// Each adapter exports:
//   id, label            'hubspot', 'HubSpot' (label shown on the sponsor's Integrations page only, D-02)
//   scopes               the scopes it needs, for the connect check's sentence
//   check(ctx)           → { account: { id, domain }, missing: [scope...] }      (ctx: { key, fetch, base })
//   ensureProperties(ctx) → creates portal_ref (deal, unique) and the email-choice property if absent
//   pipelines(ctx)       → [{ id, label, stages: [{ id, label, order, closed?, won? }] }]
//   findContact(ctx, email) → { id, fields } | null
//   createContact(ctx, fields) → { id }        (a duplicate → { id, existed: true })
//   updateContact(ctx, id, fields) → {}        (gone → throws { gone: true })
//   upsertDeal(ctx, ref, fields, contactId) → { id }
//   leads(ctx, { q, after }) → { items: [{ id, name, email, phone }], after }
//   errorOf(e)           → { retry: bool, stop: bool, sentence }   (never HubSpot's own text)
```

### Pattern 2: the panel only with a server (copy mailPanel)
`assets/js/integrations.js:1352-1354` (verbatim): `function mailPanel(ws) {` / `const url = serverUrl(ws);` / `// Without a server: one line, and no request is made.`; line 1355 then returns a one-paragraph section whose hint reads `Sending from your own domain needs your integration server.` The CRM panel does the same with "Connecting your CRM needs your integration server." and loads `GET /v1/crm` through `NS.integrations.api` (`assets/js/integrations.js:1796`).

### Anti-patterns to avoid
- **Edge-triggered sync from the browser** (the console calling the CRM route on each click): misses changes made on the server (an investor finishing at night), double-sends on retries, and needs a console open. Use the server loop.
- **A deny-list of sensitive fields**: a new field added next month leaks. Build records from an allow-list only.
- **Writing every field on every run**: overwrites the sponsor's edits in HubSpot and burns rate limit. Write on change.
- **Email upsert for contacts**: unreliable in some accounts (1.8). Read, then create or update.
- **Putting the key in `ws.integrations`**: the workspace is read by the console; the carried rule forbids it.
- **Showing HubSpot's error text**: it can carry record data and vendor wording into the console and logs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP calls with timeouts and provider-named errors | a new fetch wrapper | `server/lib/request.mjs` `requestJson(ctx, url, { method, headers, body, timeoutMs, label, redirect: 'manual' })` | already strips secrets from errors and handles timeouts |
| Encrypting the key and log | new crypto | `server/lib/vault.mjs` `seal(value, aad)` / `open(box, aad)` | key rotation and re-seal already work |
| Role checks | checks inside the module | ROUTES lines + `createGuards` | one table, tested by `roles-table` walk |
| Change log | ad hoc events | `server/lib/auditlog.mjs` via the existing `changeLog` | chained, sealed |
| Email normalisation | a new lower-case/trim | `emailHash` (`server/lib/maillog.mjs:26`) for stored keys | same rule as the bounce list |
| The HubSpot client | `@hubspot/api-client` | the adapter on `requestJson` | the repo has one dependency by policy; the SDK's Node date-version support lagged ("by the end of Q2 2026" [CITED: developers.hubspot.com/blog/a-developers-guide-to-hubspots-date-based-api-versioning (search extract)]); we need about ten calls |
| Scheduling | a job library | `setInterval(...).unref()` plus a coalescing touch | same as `lib/invitations.mjs:912-919` |

## Code Examples

### Sealing and never returning the key (pattern from `filings.mjs:497-506`, read this session)
```js
// lib/crm.mjs - connect
if (!vault.enabled) throw fail(400, 'Set DATA_KEY on this server (32 random bytes, base64): a CRM key is stored only sealed');
const key = String(body.key || '').trim();
if (!/^[\x21-\x7e]{20,512}$/.test(key)) throw fail(400, 'Paste the access key exactly as your CRM shows it.');
const found = await adapter.check({ key, fetch, base });            // never logs or echoes the key
if (found.missing.length) throw fail(400, missingSentence(found.missing));
await adapter.ensureProperties({ key, fetch, base });
store.put('crm', { id: workspace, workspace, provider: adapter.id, account: found.account, status: 'ok', at: iso(), key: vault.seal(key, `crm:${workspace}:key`) });
audit(person, 'CRM connected', `account ${found.account.id}`);      // the account id, never the key
return send(res, 200, view(store.get('crm', workspace)));          // view() drops `key`
```

### The allow-list (shape for `assets/js/crm-map.js`)
```js
// Only these leave the portal. Everything else on the investor is never read here.
function contactFields(inv, it) {
  const [first, last] = splitName(it && it.first ? `${it.first} ${it.last || ''}` : inv.contact);
  const out = { email: String(inv.email || '').trim().toLowerCase(), firstname: first, lastname: last };
  if (String(inv.phone || '').trim()) out.phone = String(inv.phone).trim();
  return out;
}
function dealFields(off, inv, cents, stageId, pipelineId, ref) {
  return { dealname: `${off.name} · ${inv.title}`, amount: (cents / 100).toFixed(2), pipeline: pipelineId, dealstage: stageId, portal_ref: ref };
}
```

## 4. Security and privacy

### 4.1 The key

- Stored only sealed (`crm:<workspace>:key`), refused without `DATA_KEY` on every server and in every mode (the filer-code rule). Opened only inside the adapter call; never in a reply, the change log, the sync log, the sent log, `store.event`, `/health`, console output or an error. A test plants a recognisable key and greps every reply body, the store file, the blobs folder and captured console output for it (CRM-02).
- Replacing the key is a new `PUT /v1/crm/connection`; the old one is overwritten. HubSpot's own rotation (7-day grace) is done by the sponsor in HubSpot, then pasted here.
- The adapter's base URL is a constant (`https://api.hubapi.com`). Tests point it at the stand-in only through an option passed to `createServer` (as `opts.fetch` and `opts.mailCtx` are), never through an environment variable a deployment could set, so no setting can send a sponsor's key to another host.
- Redirects are not followed (`redirect: 'manual'`), so a redirect cannot carry the Authorization header elsewhere.

### 4.2 The exfiltration threat, and why connecting needs a fresh sign-in

Connecting a CRM is a way to copy every investor's name, email, phone and commitment to an outside account. A stolen Admin session, or a person about to leave, could connect their own HubSpot and receive the list within minutes. So:
- Connecting needs 'configure' **and** a sign-in within the last 10 minutes (the same fresh rule as bank changes, `401 code 'fresh'`, `server/lib/workspace.mjs` header).
- The panel shows which HubSpot account is connected (its account id and domain, from the check) so the firm can recognise it.
- "CRM connected", "CRM disconnected", "CRM settings changed" and "CRM records forgotten" go to the server change log with the person.
- The Owner gets a security notice when a CRM is connected or its key replaced, on 15-14's security-notice path when that plan has merged (until then the change-log entry is the record; the plan says which applies).
- No sync starts until a stage map is saved ("Start syncing"), which is a second deliberate step.

### 4.3 Least scopes

Six scopes (1.4), the last two only to create the two properties. The connect check names any missing scope; it does not ask for more. The sponsor can see and change the key's scopes in HubSpot.

### 4.4 What each role may do

| Role | Integrations CRM panel | Connect, settings, sync now, forget | Sync log | Lead picker | Invite a lead |
|------|------|------|------|------|------|
| Owner | yes | yes (fresh sign-in to connect) | yes | yes | yes |
| Admin | yes | yes (fresh sign-in to connect) | yes | yes | yes |
| Staff | page hidden | no (403 `Only an Admin or the Owner can change this.`) | yes (from the investor page, if the planner shows it there) | yes | yes |
| Read-only | page hidden | no | yes | yes | no (403 operate sentence) |
| Accountant | page hidden | no | no (403 personal sentence) | no | no |

Refusal sentences are `REFUSALS` in `assets/js/roles.js:99-111` (for example `configure: 'Only an Admin or the Owner can change this.'`, `personal: 'Your role does not show investors’ personal details.'`).

Note for the firm (one line on the panel and in the guide): people with access to the firm's HubSpot see the synced fields there, whatever their role in the portal. The portal's masking does not reach the CRM. This is why the field list is short.

### 4.5 Data-processing notes for counsel (not legal advice; counsel to confirm)

1. **Who is who.** The sponsor decides to send investor data to its own CRM; the sponsor is responsible for the data; HubSpot is the sponsor's service provider under the sponsor's own HubSpot agreement and data-processing terms; the integration server transmits on the sponsor's instruction. Nothing is sent to a HubSpot account the operator controls.
2. **What is sent.** Name, email, phone (if given), offering name, commitment amount, onboarding stage, an opaque portal reference, and (default) the offering-email opt-out flag. Never taxpayer numbers, bank or account numbers, ID documents or accreditation evidence. HubSpot's own policy prohibits storing financial account numbers, wire instructions and government ID numbers such as Social Security and passport numbers outside its Enterprise sensitive-data features [CITED: policy.hubspot.com/trust-safety and developers.hubspot.com/sensitive-data (search extracts, 2026-11-27)]; the field list keeps the sponsor inside that policy.
3. **Regulation S-P / GLBA.** That someone invested, and how much, is nonpublic personal information for a firm that is covered. For SEC-registered advisers the amended Regulation S-P applies (compliance dates 2025-12-03 for larger entities and 2026-06-03 for smaller ones; service-provider oversight; customer notification of incidents) [CITED: sec.gov/files/rules/final/2024/regulation-s-p-small-entity-compliance-guide.pdf (search extract)]. Whether the 72-hour service-provider notice must be in the contract is disputed between sources (same search). Firms that are not registered advisers may fall under the FTC Safeguards Rule instead [ASSUMED]. Counsel decides what the firm's agreement with HubSpot and its privacy notice need.
4. **The investor-facing privacy wording.** White label forbids naming the CRM to investors. A generic sentence such as "the firm may keep your name, contact details and investment status in its customer relationship tools" is the shape; counsel writes it. The portal does not add it on its own.
5. **Erasure and retention.** Deleting an investor in the portal does not delete the HubSpot copy, and the portal never re-creates a contact the firm deleted there (3.5). An erasure request must be handled in both places; the panel's help line says so.
6. **Opt-outs.** An investor's offering-email opt-out in the portal is the investor's choice and is never changed by the CRM; the firm's own HubSpot emails must honour it (3.6, OQ-3).
7. **Data location.** HubSpot accounts are hosted in the US or the EU depending on the account [ASSUMED]; the sponsor chose that when it opened its account.

## Security Domain

`security_enforcement: true`, ASVS level 1 (`.planning/config.json`).

### Applicable ASVS categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | the server's own sessions (15-01, 15-04); connect needs a fresh sign-in |
| V3 Session Management | yes | unchanged; CRM routes are people-only (`tokens: false`) |
| V4 Access Control | yes | ROUTES lines (3.9) and `createGuards`; workspace scoping by the session's workspace, never a query parameter |
| V5 Input Validation | yes | key format check; settings validated against the pipelines HubSpot returned; lead query length-capped; HubSpot replies treated as untrusted (strings capped, ids `^\d{1,20}$`) |
| V6 Cryptography | yes | `vault.seal` (AES-256-GCM) for the key, snapshots and log details; no new crypto |
| V7 Errors and Logging | yes | fixed sentences, never HubSpot's text or the key; change-log entries |
| V9 Communications | yes | HTTPS only to a constant host; certificate checks on; no redirects followed |
| V10 Malicious Code / V14 Config | yes | no new dependency |

### Known threat patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stolen session connects an outside CRM and copies investors | Information disclosure | configure + fresh sign-in, account shown, change log, Owner notice, explicit "Start syncing" |
| Key leaks through a reply, log or error | Information disclosure | sealed at rest; `view()` drops it; grep test over replies, store and console |
| A sensitive field added to investors later is sent | Information disclosure | allow-list builder; planted-field test over every request body |
| SSRF or key sent to another host | Spoofing / disclosure | constant base URL, test-only override by `createServer` option, `redirect: 'manual'` |
| CRM data overrides an investor's unsubscribe | Tampering | the CRM module never writes `mailprefs`; test |
| Another firm's CRM data | Elevation | every collection keyed by the session's workspace; cross-workspace test answers 404 |
| HubSpot reply with markup shown in the console | Tampering (XSS) | lead names and emails drawn as text (`h()`); a check plants markup in the stand-in |
| Account token used to read leads | Elevation | `tokens: false` on every CRM line |

## 5. Testing without a real account

### 5.1 The local stand-in: `server/test/hubspot-fake.mjs`

Built like `server/test/ses-fake.mjs` (an HTTPS server on 127.0.0.1 with a self-signed certificate from `smtp-fake.mjs`'s `selfSignedCert()`, first line `// gate: tests 1`), and used by server tests and browser checks alike. It answers the calls in 1.2 with the shapes in the adapter's `ASSUMED` table, and keeps state a test can read and set:

| Part | Behaviour |
|------|-----------|
| `keys` | Map key → `{ account: { id, domain }, scopes: [...] }`; an unknown key answers 401; a call outside the key's scopes answers 403 with a missing-scopes category |
| `contacts`, `deals`, `properties`, `associations` | in-memory records with string ids from a counter starting at a never-real value; one contact per email (case-insensitive); POST with a taken email answers 409 with the existing id in the message |
| `pipelines` | the default deal pipeline with seven stages (ids and labels as the extract-era default; the test may replace them) |
| `search` | lifecycle-stage and text filters; an optional `lagMs` so a just-created contact is not listed yet |
| `fail` | `{ code, method?, path?, times?, retryAfter? }`: 429 with `Retry-After`, 500, 502, a hang past the timeout, or a connection reset |
| `requests` | every request with method, path, headers (Authorization redacted to its last 4 characters) and body, so a test can assert what was sent and what was never sent |
| `validation` | optional required deal properties, to model 2026-09 write validation |
| `markup` | lead names containing `<img src=x onerror=...>` for the console's draw-as-text check |

Fixture people use `example.com` / `.example` addresses and never-issued phone numbers (555-01xx); amounts are round; no real HubSpot account id.

### 5.2 Server tests (node --test, no network)

`createServer({ crm: { base: 'https://127.0.0.1:<port>', ca } , fetch })`: the test-only override (4.1). The stand-in's CA is passed through the same route `mailCtx` uses today for the SES stand-in.

### 5.3 Browser checks

Like `.planning/phases/13-email-overhaul/checks/email-sending.js`: the real server in the check's process, the stand-in behind it, the self-serve console connected to it, at 1280x800 and at 390x844 with touch; plus the no-server sandboxed frame (zero requests, zero policy refusals) and the managed edition unchanged. The white-label scan allows "HubSpot" only inside the CRM panel of the Integrations page (D-02) and nowhere else: investor portal, every email kind (`emails.js` `BANNED` gains `/hubspot/i`), help guide text, the invitation dialog, toasts, and server sentences an investor can receive.

### 5.4 What only a live run with the sponsor's own account can prove (owner checkpoint, CRM-17)

1. Whether a **free** HubSpot account has Settings > Integrations > Service Keys, and the exact steps and scope names a sponsor clicks (for the guide and the panel's one-line instruction).
2. Every path and reply shape in the adapter's `ASSUMED` table, on the API version chosen (2026-03 or 2026-09).
3. How a missing scope, a revoked key, a duplicate email (409 body) and a deleted record look.
4. That creating a unique deal property and upserting deals by it works on the free tier, and how many custom properties the free tier allows.
5. Default pipeline stage ids and their won/lost metadata; that associations by the default call show the contact on the deal in HubSpot's own screen.
6. That the lead search finds a lead created in HubSpot's screen, and how long it takes to appear.
7. That a full first sync of a small test list stays inside the burst limit and that `Retry-After` arrives on 429.
8. Seen in HubSpot's own screens: the contact, the deal, its amount and stage moving as the test investor goes Invited → Started → Signed → Accredited → Funded; no field outside the allow-list on the contact or deal.

The live run uses a test investor with `example.com`-style data the owner types, never a real investor, and the key is pasted by the owner into his own server, never given to an agent (AUTOPILOT: no agent is given an API key). Until it passes, the panel shows "Live connection: To be confirmed", as the mail panel shows "Live sending: To be confirmed".

<phase_requirements>
## Phase Requirements

| ID | Description (testable) | Research Support |
|----|-------------|------------------|
| CRM-01 | An Owner or Admin signed in within 10 minutes connects a CRM by pasting an access key on the Integrations page; the server checks the account and scopes against the CRM, names any missing scope in one sentence, creates the two properties if absent, seals and stores the key, and writes "CRM connected" (account id only) to the change log; Staff, Read-only and Accountant are refused with their sentences; a stale sign-in answers 401 `code 'fresh'`. | 1.3, 1.4, 3.9, 4.2 |
| CRM-02 | The key never appears in any reply, the store file or blobs in clear, the change log, the sync log, the sent log, `/health`, console output or an error; a server without `DATA_KEY` refuses to store it. Disconnect deletes it at once. | 3.10, 4.1 |
| CRM-03 | The sponsor picks one of the account's deal pipelines and maps Invited, Started, Signed, Accredited, Funded and Cancelled to its stages (a suggested map is offered; any may be left blank); nothing is sent until the map is saved and syncing started. | 3.3 |
| CRM-04 | Each investor becomes or matches one contact by email (trimmed, case-insensitive): linked contacts are updated, found ones linked, missing ones created; a 409 on create links the existing contact; retries, restarts and two runs at once never create a second contact for one email. | 1.8, 3.2 |
| CRM-05 | Each investor's commitment to an offering becomes exactly one deal (upsert by the opaque portal reference), with the deal name, amount, pipeline and mapped stage, associated with the contact. | 1.8, 3.3 |
| CRM-06 | When an investor moves to a new portal stage (from the console's save or the server's invitation record, whether or not a console is open), the deal moves to the mapped stage on the next run (within a minute of the change, hourly at the latest); an unmapped stage moves nothing; stages never move backwards except to the Cancelled mapping. | 3.1, 3.3 |
| CRM-07 | Only the allow-listed fields leave the portal: a test investor holding taxpayer numbers, bank and routing numbers, ID documents, accreditation evidence, address, date of birth, tax form, KYC results and notes produces CRM requests whose bodies contain none of those values. | 3.4 |
| CRM-08 | Direction of truth: nothing from the CRM is written into any investor record; portal-owned fields are written only when the portal's value changes (an edit made in the CRM survives until then); an existing CRM phone is never blanked; CRM-only fields are never read or written. | 3.4, 3.5 |
| CRM-09 | An investor's offering-email choice is never changed by anything from the CRM (a re-subscribed CRM contact leaves the portal's choice off); by default the choice is written to the contact's opt-out property (OQ-3). | 3.6 |
| CRM-10 | A contact or deal deleted in the CRM is marked "Removed in your CRM" and not re-created until the sponsor chooses "Link again"; removing an investor or cancelling an invitation moves the deal to the Cancelled mapping; the portal never deletes a CRM record; disconnect keeps links until "Forget", and the portal's closing purge (15-20) deletes key, links, snapshots and log. | 3.5, 3.10 |
| CRM-11 | Failed writes are retried with backoff (429 honours `Retry-After`; 5xx, timeouts and resets back off); 401 or a missing scope stops the runs and shows "Needs attention" with a fixed sentence; every attempt leaves one sync-log entry (field names, outcome, HTTP status; person-naming parts sealed; kept `CRM_LOG_DAYS`); the log is shown to roles with 'personal' only; no CRM error text is shown or stored. | 3.7 |
| CRM-12 | From the invite dialog a person with 'personal' lists the CRM's leads not yet investors (text search), chooses one, and the dialog is filled with its name and email; sending needs 'operate' as today; the new investor's contact is linked to that lead (no second contact) and a deal is created at the Invited stage. | 3.8 |
| CRM-13 | Every CRM route has a ROUTES line with the permission in 3.9 and `tokens: false`; an account token or the shared token is refused once the firm has people; another workspace's CRM data answers 404; the route walk test passes. | 3.9, 4.4 |
| CRM-14 | White label: the CRM's name appears only in the CRM panel of the sponsor's Integrations page; never in the investor portal, any email, help answers or guide text, the invite dialog, toasts, or any sentence an investor or prospect can receive. The forbidden word appears nowhere. | D-02, 5.3 |
| CRM-15 | Without a server (the owner's iPhone preview, the sandboxed frame), the CRM panel is one line and the lead button does not appear; zero requests and zero policy refusals; with a server, the panel and the lead list work at 390x844 with touch and at 1280x800 with a way out on screen and no horizontal overflow; lead names with markup are drawn as text. | Project constraints, 5.3 |
| CRM-16 | The HubSpot adapter is one file behind the CRM interface (Pattern 1) with every unconfirmed path and shape in its `ASSUMED` table, and the server README gains a "CRM" section (how a sponsor makes the key, the scopes, what is sent and never sent, the log). | Pattern 1, 1.1 |
| CRM-17 | Owner checkpoint: a live run with the sponsor's own HubSpot account (free tier first) resolves every item of 5.4; until it passes, the panel says "Live connection: To be confirmed". | 5.4 |
</phase_requirements>

## Validation Architecture

### Test framework
| Property | Value |
|----------|-------|
| Framework | `node --test` (Node 22.23.4 here; `server/package.json` `"engines": { "node": ">=18" }`), Playwright from the global install for browser checks |
| Config file | none (each `server/test/*.test.mjs` is one gate test file with a `// gate: tests N` first line) |
| Quick run command | `cd server && node --test test/crm-*.test.mjs` |
| Full suite command | `cd server && npm test`, then the phase gate (`gate17.sh`, modelled on `.planning/phases/13-email-overhaul/checks/gate13.sh`) and the reference gate `.planning/checks/gate-reference.sh` |

### Phase requirements to tests
| Req ID | Behaviour | Test type | Automated command | File exists? |
|--------|-----------|-----------|-------------------|-------------|
| CRM-01 | connect, scopes sentence, properties created, change log, role and fresh refusals | server | `node --test test/crm-connect.test.mjs` | Wave 0 |
| CRM-02 | key grep over replies, store, blobs, console | server | `node --test test/crm-connect.test.mjs` | Wave 0 |
| CRM-03 | pipelines read, map saved, nothing sent before start | server | `node --test test/crm-sync.test.mjs` | Wave 0 |
| CRM-04 | email match, link, 409, concurrent runs, restart | server | `node --test test/crm-sync.test.mjs` | Wave 0 |
| CRM-05 | one deal per investor and offering, association | server | `node --test test/crm-sync.test.mjs` | Wave 0 |
| CRM-06 | stage moves on save and on invitation change, unmapped, no backwards | server + Node check on `crm-map.js` | `node --test test/crm-sync.test.mjs`; `node checks/crm-map.js` | Wave 0 |
| CRM-07 | planted sensitive fields absent from every request body | server | `node --test test/crm-fields.test.mjs` | Wave 0 |
| CRM-08 | nothing written back; write-on-change; phone never blanked | server | `node --test test/crm-fields.test.mjs` | Wave 0 |
| CRM-09 | mailprefs untouched by any CRM path; opt-out property set | server | `node --test test/crm-fields.test.mjs` | Wave 0 |
| CRM-10 | 404 handling, Link again, cancel mapping, forget, purge | server | `node --test test/crm-sync.test.mjs` (purge part after 15-20) | Wave 0 |
| CRM-11 | 429 Retry-After, 5xx backoff, 401 stop, log entries sealed, roles on log | server | `node --test test/crm-sync.test.mjs` | Wave 0 |
| CRM-12 | lead list, lag, markup, invite linking | server + browser | `node --test test/crm-leads.test.mjs`; `node checks/crm-console.js --only leads` | Wave 0 |
| CRM-13 | route lines, tokens refused, cross-workspace 404 | server | `node --test test/crm-roles.test.mjs` plus the existing roles-table walk | Wave 0 |
| CRM-14 | white-label scan | browser + Node | `node checks/crm-console.js --only white-label` | Wave 0 |
| CRM-15 | no-server line, phone and desktop, ways out | browser | `node checks/crm-console.js --only noserver,phone,desktop` | Wave 0 |
| CRM-16 | adapter shape, README section | Node | `node checks/crm-map.js --only adapter` | Wave 0 |
| CRM-17 | live account | manual (owner) | checklist in 5.4 | — |

### Sampling rate
- Per task commit: the task's own test file.
- Per wave merge: `cd server && npm test` plus `gate17.sh`.
- Phase gate: the reference gate green on the merged tree before `/gsd-verify-work`; then the owner's live run.

### Wave 0 gaps
- [ ] `server/test/hubspot-fake.mjs`: the stand-in (5.1)
- [ ] `server/test/crm-connect.test.mjs`, `crm-sync.test.mjs`, `crm-fields.test.mjs`, `crm-roles.test.mjs`, `crm-leads.test.mjs`
- [ ] `.planning/phases/17-crm-connection/checks/crm-map.js` (Node), `crm-console.js` (browser), `gate17.sh`
- [ ] No framework install needed.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | server and checks | yes | v22.23.4 | — |
| Playwright (global) | browser checks | yes (`npm root -g` lists `playwright`) | not probed | — |
| The shared browser queue | browser checks | yes (`SCRATCH/exec-011/heavy.sh` exists) | — | — |
| HubSpot API (`api.hubapi.com`) | only the owner's live run | not reachable from this session (HubSpot hosts do not resolve here) | — | the local stand-in for every check; the live run happens on the owner's server |
| Disk | builds and checks | 9.1 GB free on `/` (2026-11-27) | — | keep outputs small (AUTOPILOT) |

**Missing dependencies with no fallback:** none for building and checking. The live run needs the owner's HubSpot account and a server that can reach `api.hubapi.com`.

## Package Legitimacy Audit

No external package is installed by this phase (no HubSpot SDK, no job or HTTP library: Don't Hand-Roll explains why). `server/package.json` keeps its single dependency.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

<!-- gsd:write-continue -->
