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

<!-- gsd:write-continue -->
