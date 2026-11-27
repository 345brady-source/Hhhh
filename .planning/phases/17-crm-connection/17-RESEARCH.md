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

<!-- gsd:write-continue -->
