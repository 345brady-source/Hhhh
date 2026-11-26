# Phase 15: Security - Research

**Researched:** 2026-11-26
**Domain:** Sign-in, two-step sign-in, roles, sessions, encryption at rest, backups, data minimization, password reset and public security pages for a zero-dependency Node integration server and a no-server browser preview
**Confidence:** HIGH for the in-repo findings (every file and line cited was opened this session); MEDIUM for outside prices (search excerpts of vendor pages this session; vendor pages themselves could not be opened, see section 1); LOW where tagged [ASSUMED].

<user_constraints>
## User Constraints (from 15-CONTEXT.md, verbatim)

### Locked Decisions
- D-01 (2026-11-15, 01.4-RESUME 5c; before the reorganization): two-factor sign-in, roles and permissions, audit log, session protection, encryption and backups, data minimization, a public security page, a responsible-disclosure page; an optional penetration-test letter; SOC 2 later. The product must not read as cheap (40 free sponsors for 12 months, then $100/month self-serve; it funnels business to Carrow & Vale).
- Known gap (2026-11-19): "Forgot your password?" in assets/js/portal.js only shows a placeholder; no reset email is sent. Built in this phase unless phase 13 (13-11 password reset template) already delivers the flow; the research says which.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; $0 path first); white label; the preview runs with no server and must stay honest about what only the server does; never the word "basic"; nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

### Questions the research must answer (15-CONTEXT.md)
- What exists today: the server's auth (server/), sessions, team members and their roles in the DIY console, the change log in audit.js, what is stored where (browser storage in the preview, the server's store), which secrets and taxpayer numbers are held and how.
- Two-factor: TOTP (authenticator app, $0, no SMS cost) vs passkeys (WebAuthn) vs SMS/email codes; recovery codes; what investors vs sponsors get by default.
- Roles a small sponsor needs (owner, admin, staff, read-only, CPA/auditor access) mapped to the console's pages and actions.
- Encryption at rest for taxpayer numbers and bank numbers on the server, key handling, backups, retention and data minimization.
- Security page and responsible-disclosure page content (security.txt, RFC 9116); what can honestly be claimed without SOC 2.
- Outside services (auth providers, pen-test firms) with real prices vs in-house.

### Claude's Discretion
- 15-CONTEXT.md has no Discretion section. Everything not locked above (module shapes, defaults, plan split) is offered to the orchestrator as choices C-01 to C-14 (section 9), each with a recommended default.

### Deferred Ideas (OUT OF SCOPE)
- SOC 2 audit itself ("SOC 2 later", D-01). This phase only makes sure nothing claims it.
- The in-house reader (D-33). Portal messaging and the data room (phase 14) and NACHA/ACH (phase 16), except where their sign-in depends on this phase (C-12).
- Step 12 reorganize and later steps (owner, 2026-11-26: "stop at step 12").
</user_constraints>

## Project Constraints (from CLAUDE.md and AUTOPILOT.md)

- GSD agents for every step; RED-first checks; test on real material and show the owner the real result; never call anything ready, working or done before the owner has checked it.
- Outside API or service that could do the job better: present cost, accuracy, speed and trade-offs before building in-house; the owner has no budget for monthly fees, so the $0 path comes first (section 1).
- Work economically: build only what the law or the task needs; no extra text on screens; nothing mandatory for investors (D-30).
- White label: no vendor, model or library name in anything a sponsor or investor sees; never the word "basic"; the managed (Carrow & Vale) edition unchanged unless a plan says so (C-03 slice guard).
- The owner tests on an iPhone inside the Claude app (WKWebView, sandboxed iframe, no server, connect-src blocked): no fetch()/XHR on a no-server path; every view has a way out; dialogs scroll; checks at 390x844 and 1280x800.
- No paid API calls by agents; no agent gets an API key; never print a real secret. Never open SCRATCH/blind/.
- Save rules: commit and push each finished section; executors push wip branches after every commit.

## Summary

There is no sign-in anywhere in the product today. The server knows three kinds of caller: a shared `API_TOKEN`, one bearer token per sponsor workspace (`lib/accounts.mjs`, "each sponsor has its own token"), and per-link tokens for investors (invitations, tax documents). It has no people, no passwords, no sessions, no two-step sign-in and no roles; with no `API_TOKEN` and no account it treats every caller as the sponsor (index.mjs:191). The console keeps that sponsor token in the workspace in browser storage (integrations.js:298), so everyone who opens the console in that browser is the same "sponsor". In the browser, the investor sign-in accepts any password (portal.js:1257-1265), the sign-up password is checked for length and then dropped (diy.js:114, 142), roles are two (`admin`, `team`) and enforced only by hiding pages (app.js:429-446), and four screens say things that are not true: "You will add a second sign-in step after this." (diy.js:66), "They get an email to set a password and turn on two-step sign-in." (diy.js:324), "Two-step verification: On" (portal.js:1177) and "Each time you sign in from a new device you will also enter a 6-digit code ..." (onboarding.js:331).

What is good already and should be reused, not rebuilt: AES-256-GCM sealing with record-bound additional data (`lib/vault.mjs`), hashed one-time link tokens compared in constant time, short retention with automatic purge (submissions and invitations 30 days, outbox 30 days), a hash-chained change log in the browser (audit.js:1000-1167), and the rule that the full taxpayer number is never saved in the browser's answers (onboarding.js:774) and lives only inside the signed W-9 file. The weak spot is that the system of record for a self-serve sponsor is the sponsor's browser storage: full bank routing and account numbers (onboarding.js:2926, copied into the console by invitations.js:1226-1228) and the change log sit there in plain text, and no server can enforce a role on data it never holds.

**Primary recommendation:** build sign-in in-house on the existing server with Node's own crypto ($0, no new server package): people with scrypt-hashed passwords, opaque session cookies, authenticator-app codes (TOTP, RFC 6238) plus ten one-time recovery codes, required for every console person and offered (never required) to investors; five console roles (Owner, Admin, Staff, Read-only, Accountant) checked on every server route; the sponsor's workspace held on the server sealed with the existing vault in server mode (so bank numbers and the change log are encrypted at rest and role rules are enforced on writes); an encrypted backup tool with a restore check; the password reset sent with phase 13's `password_reset` template; and a public security page plus `/.well-known/security.txt` that claim only what tests prove. The preview shows the same screens, with two-step set-up working on the device and labelled as a demo.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Passwords, sessions, two-step check, lockout, reset tokens | API / Backend (server/lib/auth.mjs, new) | Browser (forms only) | A check done in the browser can be skipped; secrets and counters must live where the caller cannot change them |
| Role permissions | API / Backend (server/lib/roles.mjs, new) | Browser (hides what a role cannot use) | "Enforced on the server, not only hidden in the UI" (task brief); the browser copy is for display only |
| Sponsor workspace (investors, bank numbers, offerings, change log) in server mode | Database / Storage (sealed record per workspace on the server) | Browser (memory while signed in) | Encryption at rest and role-checked writes are only possible where the data is held |
| Change log | Browser (writes entries, shows them) | Server (appends its own chained log; refuses rewrites of the workspace log) | Today the browser alone holds it and can recompute the chain |
| Encryption keys, re-sealing, backups | Server operator (env secrets, tools/) | — | Keys never reach a browser |
| Password reset email | API / Backend (mail path of phase 13) | Browser (request and new-password pages) | The email must come from the server; the preview simulates it |
| Security page, disclosure page, security.txt | CDN / Static (repo root pages) | Server (/.well-known/security.txt route) | Public, no sign-in, no data |
| Preview two-step demo | Browser only | — | No server exists in the owner's test environment; labelled demo |

<!-- section summary done -->

## 1. Outside services first (owner rule): prices, fit, speed, trade-offs

How the prices were read: web search excerpts of the vendors' own pages this session. Opening the pages themselves failed for workos.com, auth0.com, pages.nist.gov and rfc-editor.org ("getaddrinfo ENOTFOUND": those hosts are outside this session's allowed network), so each price below is tagged [CITED: search excerpt of <page>] and should be confirmed on the live page before anyone pays. Where no excerpt gave a number, the table says "could not be read".

Size used for the comparison: 40 free sponsors, about 3 console people each and up to a few thousand investors in total, so about 2,000 to 5,000 monthly active people at launch [ASSUMED: from the 40-sponsor launch plan; no measured count exists].

### 1.1 Sign-in providers (two-step and passkeys)

| Option | Price at launch size | Two-step | Passkeys | White label fit | Trade-offs |
|--------|---------------------|----------|----------|-----------------|------------|
| **In-house on the existing server (recommended)** | **$0**; no new server package (Node's own `crypto`: scrypt, HMAC, random bytes) | Authenticator-app codes (TOTP) and recovery codes, built here | Not in this phase (C-02) | Full: every screen is the portal's own, in the firm's brand | We own the security of the code: needs RFC test vectors, RED checks and an outside look later (section 1.4); no SSO |
| WorkOS AuthKit | Free up to 1 million monthly active users; $2,500/month per further million [CITED: search excerpt of workos.com/pricing] | Included [CITED: same] | Included [CITED: same] | Hosted sign-in pages; custom domains are "separate pricing", price could not be read | Strongest free outside option; a second processor holding every email; per-firm branding of 40 portals on hosted pages not confirmed; no use in the no-server preview |
| Auth0 | Free plan up to 25,000 monthly active users; B2C Essentials from $35/month for 500 [CITED: search excerpt of auth0.com blog and pricing] | Whether the free plan includes it could not be read; Essentials include "Pro MFA" [CITED: same] | Passwordless on free [CITED: same] | Hosted pages, vendor domain unless custom domain set | Price steps up fast past free; vendor lock-in |
| Clerk | Free tier 50,000 retained users (older pages say 10,000) [CITED: search excerpt of clerk.com pricing] | Only in Pro, from $20/month billed yearly (about $25 monthly) [CITED: search excerpt of clerk.com changelog 2026-02-05] | Pro [CITED: same] | Components inside our pages, but their scripts and domain | Monthly fee for two-step: fails the $0 rule |
| Amazon Cognito | 10,000 monthly active users free (Lite and Essentials), then $0.015 each on Essentials [CITED: search excerpt of aws.amazon.com/cognito/pricing] | Offered; its price could not be read | Essentials [ASSUMED] | Hosted pages need custom domain set-up per pool | Needs an AWS account and SDK calls; brings AWS into the sign-in path |
| Supabase Auth | Free 50,000 monthly active users; Pro $25/month; text-message two-step $75/month [CITED: search excerpt of supabase.com/pricing] | App codes free [CITED: same] | Not confirmed | Brings a hosted database we do not use | Free projects can be paused when idle [ASSUMED] |
| Text-message codes (e.g. a verify API) | $0.05 per successful check plus about $0.0083 per text in the U.S. [CITED: search excerpt of twilio.com/verify/pricing] | Text codes only | — | Sender name is a short code, not the firm | A per-use cost on every sign-in; SIM-swap risk; not recommended (section 3) |

**Speed:** an outside provider adds a redirect and a network round trip to each sign-in; in-house adds one local scrypt check (tens of milliseconds) [ASSUMED: typical scrypt cost; measure in 15-01]. **Accuracy:** not applicable (no reading involved).

**Recommendation:** in-house. It is the only $0 path that keeps every screen in the firm's brand and works the same in the no-server preview. If the owner later wants passkeys or single sign-on for a large sponsor without building them, the WorkOS free tier is the outside option to revisit (C-01).

### 1.2 Encryption key services

| Option | Price | What it adds | Trade-offs |
|--------|-------|--------------|------------|
| **`DATA_KEY` in the host's secret settings, as today (recommended now)** | **$0** | Already in place (vault.mjs); this phase adds re-sealing and more than one previous key | The key sits in the server's environment; a stolen server image with its environment exposes it |
| AWS KMS (envelope encryption: the data key is itself sealed by a key that never leaves the service) | $1 per key per month, 20,000 requests free, then $0.03 per 10,000 [CITED: search excerpt of aws.amazon.com/kms/pricing] | Key never in the environment; every use logged by the service | About $1 a month plus an AWS account and a network call at start-up |
| Google Cloud KMS | Price could not be read (excerpt had no figures) | Same idea | Same |
| A self-hosted secrets server | $0 licence, needs its own host | Central secrets | Another server to run and back up: not worth it for one process |

**Recommendation:** keep `DATA_KEY` in the host's secrets for launch, add the re-seal tool and multi-key rotation (section 5.2), and move to envelope encryption with a key service when the first sponsor pays (C-05).

### 1.3 Backup storage (off the server)

| Option | Price | Trade-offs |
|--------|-------|------------|
| **Encrypted archive made by the server's own tool, copied to the operator's own computer (recommended for launch)** | **$0** | Manual or scheduled copy; one more thing the operator must do |
| Cloudflare R2 | 10 GB-month free each month, then $0.015 per GB-month; no download fees [CITED: search excerpt of developers.cloudflare.com/r2/pricing] | Free account; S3-style upload needs signed requests (the server already signs SES calls in phase 13's adapter, so the signing code exists) |
| Backblaze B2 | First 10 GB free, then $6.95 per TB per 30 days; downloads free up to 3 times the stored amount [CITED: search excerpt of backblaze.com/pricing] | Same as above |

**Recommendation:** the backup tool writes one encrypted, checked archive ($0); where it is copied is the operator's choice, with R2's free tier as the default off-site place (C-06). The archive is sealed before it leaves the server, so the storage company never sees data.

### 1.4 Penetration tests, disclosure programs and SOC 2

| Option | Price | What the owner gets | Trade-offs |
|--------|-------|---------------------|------------|
| **$0 path (recommended before revenue)** | **$0** | Our own RED checks for every control in this phase, a free automated web scan run by the proof plan [ASSUMED: a free scanner such as the OWASP project's runs offline], a disclosure page and security.txt | No independent letter to show a sponsor |
| One-off web application test by a firm, with a letter | Typically $5,000 to $15,000 for a small web app, other guides $10,000 to $30,000; SOC 2-scoped tests $8,000 to $25,000 [CITED: search excerpts of softwaresecured.com, blazeinfosec.com, soc2auditors.org] | Findings report and an attestation letter (commonly included) [CITED: same] | Price grows with roles and API endpoints in scope |
| Astra (test platform) | Manual test $5,999 per target per year; automated tier quoted as $1,999 or $2,999 per year (sources disagree); scanner $199 per month [CITED: search excerpts of getastra.com and review sites] | Yearly testing of one app | Yearly fee; conflicting price sources |
| Cobalt (test platform) | Sold in credits of 8 test hours; price per credit not published; a competitor claims about $1,800 per credit (unverified) [CITED: search excerpt of docs.cobalt.io; synack.com claim] | Booked tests | Yearly subscription |
| HackerOne "Essential VDP" | Free tier launched September 2024 [CITED: search excerpt of hackerone.com press release]; paid tiers $8,000 to $50,000 a year per third parties (unverified) | A hosted disclosure inbox | A vendor name researchers see; free-tier terms not re-checked |
| SOC 2 (later, D-01) | Compliance platform about $7,200 to $14,000 a year for 1 to 20 people, plus the auditor $8,000 to $50,000 [CITED: search excerpts of getagency.com, startupik.com, vanta.com cost page] | A report sponsors' counsel recognise | Out of this phase's scope |

**Recommendation:** no paid test before revenue; the disclosure page and security.txt go live now (email inbox, $0); the security page says plainly that an independent test has not been done yet (or says nothing about one). Buy a one-off test with a letter when a sponsor asks for it or revenue allows (C-13: the owner decides; the default is "not now").

<!-- section 1 done -->

## 2. What the code has today, every weakness found, and the smallest design

### 2.1 Who can call what (server)

| Caller | How it proves itself | Source |
|--------|---------------------|--------|
| Operator | `ADMIN_TOKEN` bearer, constant-time compare; makes sponsor accounts, replaces their tokens, refunds | index.mjs:193-197, accounts.mjs:24-49 |
| Sponsor (whole workspace) | `API_TOKEN` (shared) or one account token per workspace: "each sponsor has its own token for this server" (accounts.mjs:1-3); the token is 32 random bytes, only its SHA-256 stored | accounts.mjs:12, 30, 43-47 |
| Nobody | With no `API_TOKEN` and no account, every caller counts as the sponsor: `return !env.API_TOKEN && !store.list('accounts').length ? { shared: true } : null;` [VERIFIED: server/index.mjs:187-191] | index.mjs:191 |
| Investor during onboarding | `X-Invite-Token` (link token, hashed, scoped to one investor) | index.mjs:857-867, invitations.mjs:7 |
| Investor opening a tax document | `X-Doc-Token` plus the last four digits of the taxpayer number on record | index.mjs:846-854, README.md:354 |
| Filing staff | `FILINGS_STAFF_TOKEN` (at least 24 characters, must differ from every other token) | filings.mjs:21, 87-93 |
| Provider automation | `RESULTS_TOKEN` | index.mjs:85-89 |

There are no people, passwords, sessions, cookies, roles or two-step codes on the server [VERIFIED: grep of server/ for "session", "cookie", "password" found only provider sessions, connector auth and mail credentials; accounts.mjs read in full].

### 2.2 Who can do what (browser)

- Roles: `roles: diy ? ['admin', 'team', 'investor'] : ['staff', 'sponsor', 'investor'],` and `owner: diy ? 'admin' : 'staff',` [VERIFIED: assets/js/edition.js:43, 46].
- The rule is one function: `if (what === 'configure') return role === E.owner;` and `return what === 'portal' || what === 'console' || what === 'operate';`, with `const OWNER_ONLY = ['console-brand', 'console-intake', 'console-integrations', 'console-team'];` [VERIFIED: assets/js/app.js:429-437]. The role is whatever the demo bar's "Signed in as" select says (app.js:485), saved in browser storage (app.js:416-421).
- Team page roles: `admin: ['Admin', 'Everything: offerings, brand, integrations, team, plus all operations.']`, `team: ['Team member', 'Operations: investors, e-sign, capital calls, distributions, requests, documents, notices, reports, audit and AML/KYC review. Offerings, brand and integrations are read-only.']` [VERIFIED: assets/js/diy.js:280-283]. The page keeps at least one admin, marks the owner, and logs invites, role changes and removals (diy.js:302-385).
- Change log: browser only, "append-only, each entry hashed with the one before" with `const GENESIS = '0'.repeat(64);` [VERIFIED: assets/js/audit.js:1000-1001]; the actor is the demo role's person (app.js:793-808).

### 2.3 What is stored where

| Data | No-server preview | Server mode today |
|------|-------------------|-------------------|
| The sponsor's workspace (offerings, investors with their bank accounts, runs, notices, team, change log) | Browser storage, key prefix `storagePrefix: diy ? 'sdesk1:' : 'cvp2:'` [VERIFIED: assets/js/edition.js:42] plus `ws:<id>` (workspace.js:125-129) | **The same browser storage.** The server never receives the workspace; it holds only invitations (30 days), tax documents, filings, billing, checks |
| Full bank routing and account number of an investor | `bank: { holder: bankHolder(d), routing: digitsOf(d.routing), account: digitsOf(d.account), type: d.acctType }` [VERIFIED: assets/js/onboarding.js:2926] on the record, copied into the console's workspace on import (invitations.js:1226-1228); plain text | Inside the sealed submission for up to 30 days, then only in the sponsor's browser |
| The sponsor's own ACH origination numbers | `ws.tenant.ach` in browser storage (console.js:3212-3220) | Same |
| Full taxpayer number | Never in saved answers: `const SECRET = ['password', 'password2', 'tin', 'ftin', 'w8UsTin', 'ownerTin', 'e8UsTin', 'routing', 'account', 'account2']` [VERIFIED: assets/js/onboarding.js:774, grep]; in memory during the flow (onboarding.js:1715); inside the signed W-9 PDF, which the 1099 builder reads back (tax1099.js:288-311); `tinLast4` on the record | Inside the sealed W-9 blob of the invitation for up to 30 days; tax documents open with the last four digits |
| Signed documents (W-9 with full number, agreements) | IndexedDB `cvp-documents`, store `files` (operations.js:434-435) | Sealed blobs while the invitation lives |
| The server token | `ws.integrations.server.token`, sent as `headers.Authorization = \`Bearer ${s.token}\`` [VERIFIED: assets/js/integrations.js:298] | Same |
| Server store | — | JSON file with sealed fields; blobs sealed; events plain (ids and types) |
| Secrets | — | Environment: `DATA_KEY`, `DATA_KEY_PREVIOUS`, `API_TOKEN`, `ADMIN_TOKEN`, `RESULTS_TOKEN`, `FILINGS_STAFF_TOKEN`, mail and reading keys (README.md:39-41, 497-513) |

### 2.4 Weaknesses (each with where it is)

| # | Weakness | Where | Severity |
|---|----------|-------|----------|
| W-01 | No sign-in for people at all; a sponsor is one static bearer token that never expires, shared by the whole team | accounts.mjs:1-3, index.mjs:187-191 | High |
| W-02 | Open server: with no `API_TOKEN` and no account every caller is the sponsor, including `GET /v1/outbox`, whose messages "carry live links" | index.mjs:191; mail.mjs:396 | High (a set-up mistake away) |
| W-03 | The sponsor token sits in browser storage, readable by any script on the page and by anyone at that browser | integrations.js:102, 298, 1089 | High |
| W-04 | CORS answers `Access-Control-Allow-Origin: *` when `PORTAL_ORIGIN` is unset: `const ok = !list.length \|\| list.includes('*') \|\| list.includes(origin);` [VERIFIED: server/lib/http.mjs:57-59] | http.mjs:53-65 | Medium now; High once cookies exist |
| W-05 | The rate limiter trusts the first `X-Forwarded-For` entry: `String(header(req.headers, 'x-forwarded-for') \|\| '').split(',')[0].trim()` [VERIFIED: server/index.mjs:134]; a proxy appends the real address at the end, so the first entry is whatever the client typed | index.mjs:133-134 | Medium |
| W-06 | All counters are dropped when more than 10,000 addresses are seen (`if (hits.size > 10000) hits.clear();` [VERIFIED: server/index.mjs:147]); only writes are limited; no per-account failure count or lockout | index.mjs:137-152 | Medium |
| W-07 | No security headers on API answers (`send()` sets only `Content-Type` and `Cache-Control`, http.mjs:46-50); server pages have only nosniff and no-referrer (index.mjs:160); the portal pages have no content security policy and load outside fonts and libraries without integrity hashes (diy.html:8-10, esign.js:25-27, intake.js:20-21) | as listed | Medium |
| W-08 | Investor sign-in accepts any password and is prefilled with `value="sample-password"`; "Forgot your password?" answers `'A password reset link would be emailed to the address on file.'` [VERIFIED: assets/js/portal.js:1257-1266; 1237 by grep] | portal.js:1237, 1257-1266 | High in server mode (there is no investor sign-in on the server); demo-only today |
| W-09 | The sign-up password is checked for 10 characters and dropped; no account exists anywhere | diy.js:114, 136-142 | High in server mode |
| W-10 | Screens claim what does not happen: "At least 10 characters. You will add a second sign-in step after this." [VERIFIED: assets/js/diy.js:66]; "They get an email to set a password and turn on two-step sign-in." [VERIFIED: assets/js/diy.js:324]; `row('Two-step verification', 'On')` [VERIFIED: assets/js/portal.js:1177]; "Each time you sign in from a new device you will also enter a 6-digit code from an authenticator app or a text message." [VERIFIED: assets/js/onboarding.js:331]; the change log writes "Investor login created" when no login exists (onboarding.js:2838) | as listed | High (owner rule: nothing claimed that is not true) |
| W-11 | Two console roles, enforced only by hiding pages in the browser; nothing on the server knows a role | app.js:429-446, console.js:30-33 | High |
| W-12 | The change log names whoever the demo role is, and the chain can be recomputed by anyone holding the storage: it shows accidental edits, not a deliberate rewrite | app.js:793-808; audit.js:1000-1167 | Medium |
| W-13 | Server events are a plain list capped at 5,000 (`if (data.events.length > 5000) data.events.splice(0, data.events.length - 5000);` [VERIFIED: server/lib/store.mjs:72]), not chained, with no person | store.mjs:70-74 | Medium |
| W-14 | Full bank numbers (investors' and the sponsor's own) and signed W-9 files with full taxpayer numbers sit unencrypted in the sponsor's browser | onboarding.js:2926; invitations.js:1226-1228; console.js:3212-3220; operations.js:434 | High (the main data-at-rest gap) |
| W-15 | Key rotation: one previous key only (`const old = parseKey(env.DATA_KEY_PREVIOUS); if (old) previous.push(old);` [VERIFIED: server/lib/vault.mjs:36-37]) and no tool that re-seals records, so an old key can never be retired | vault.mjs:30-43 | Medium |
| W-16 | No backup or restore: the store file and its blob folder are the only copy | store.mjs:1-3 ("Replace with your database in production") | High for a launch |
| W-17 | `ADMIN_TOKEN`, `API_TOKEN` and account tokens never expire and carry everything | index.mjs:80-89, 193-197 | Medium |
| W-18 | A co-investor sees the main investor's signed W-9, which shows the full taxpayer number, on Documents (AUTOPILOT.md open item for the owner) | AUTOPILOT.md "State now" | Medium (privacy) |
| W-19 | Store writes are debounced 50 ms in one process; a crash loses the last write | store.mjs:29-32 | Low |
| W-20 | No security page, disclosure page or `/.well-known/security.txt` | repo root (`ls`: no `.well-known`) | Medium (D-01) |

### 2.5 The smallest design that delivers D-01 in server mode

Everything below is server code with Node's own `crypto` (no new server package) plus browser screens. Each part names the weakness it closes.

1. **People and sessions** (`server/lib/auth.mjs`, new; W-01, W-08, W-09, W-17). A `people` collection per workspace: kind (`team` or `investor`), role, `investorId` for an investor, the email sealed with an HMAC lookup index (so the store holds no plain email), scrypt password hash, sealed two-step secret, hashed recovery codes, status (`invited`, `active`, `disabled`), failure count and lock time. A `sessions` collection keyed by the SHA-256 of a 32-byte random id carried in one cookie (section 5.4). Routes under `/v1/auth/`: sign-up (creates the workspace account and its Owner), sign-in, code, two-step set-up start and confirm, recovery codes, sign-out, me, password change, reset request and confirm, team invite, accept, role change, remove, reset another person's two-step; plus `POST /v1/invite/login` so the onboarding's login step creates the investor's account with the invitation token. When any person exists (or `AUTH_REQUIRED=1`), the open-server fallback (W-02) is off and account tokens remain only for server-to-server automation (C-09).
2. **Roles on every route** (`server/lib/roles.mjs`, new; W-11). One permission table (section 4) and one guard before each sponsor route in index.mjs, invitations.mjs `sponsor()`, taxdocs.mjs, filings.mjs, billing.mjs and phase 13's `/v1/messages`.
3. **The workspace held on the server, sealed** (`server/lib/workspace.mjs`, new; W-03, W-12, W-14). In server mode the console loads and saves its workspace through `GET/PUT /v1/workspace` instead of browser storage; the server seals it with the existing vault (record-bound additional data), keeps a version for conflict refusal, refuses a write that changes a section the person's role cannot change, refuses a change to any investor's bank account unless the role may release payments, masks bank and taxpayer fields for roles that do not need them, and refuses a change-log rewrite (the new log must start with the stored one). Signed documents go to sealed blobs the same way. The browser keeps nothing in storage in server mode (C-04).
4. **A server change log** (`server/lib/auditlog.mjs`, new; W-12, W-13). Append-only, hash-chained, the person from the session (never from the request), details sealed; read and export by the Audit permission.
5. **Hardening** (`server/lib/http.mjs`, index.mjs; W-04 to W-07). Security headers on every answer, CORS credentials only for listed origins (never `*` with sessions), the rightmost proxy address, counters that are not wiped wholesale, per-account and per-address failure limits.
6. **Keys and backups** (`server/tools/reseal.mjs`, `server/tools/backup.mjs`, vault.mjs; W-15, W-16). Several previous keys, a re-seal tool, an encrypted backup archive with a verify and restore command.
7. **Password reset** (section 7) through phase 13's `password_reset` template and mail path.
8. **Public pages** (W-20): a security page, a disclosure page, `/.well-known/security.txt` (section 6).
9. **Truthful screens** (W-10): every claim in W-10 is rewritten by the plan that rebuilds that screen.

### 2.6 What the no-server preview can honestly show

| Shown working in the preview | How it stays honest |
|------------------------------|---------------------|
| Console sign-in, two-step set-up with a real authenticator app on the owner's iPhone, sign-in with a code, a recovery code, sign-out | The secret and the check live in this browser; the set-up screen carries one sentence such as "Demo: two-step sign-in is checked on this device only." [ASSUMED wording; the planner fixes it once]. The owner adds the key by typing it (a QR code on the same phone cannot be scanned; tapping an `otpauth:` link is likely blocked in the sandboxed frame [ASSUMED]); a QR code is shown for desktop |
| Five roles through the demo bar: menus, read-only pages, refused actions, masked bank numbers | The Team page says the server enforces these in a live portal; the preview cannot prove refusal on a server |
| "Forgot your password?" | Phase 13's sentence: "Password reset email (simulated in this demo). If you cannot sign in, contact <team>." (13-08-PLAN.md must_haves); the new-password page opens from the Emails page preview link |
| The investor Account page's two-step row | Shows "Off" with "Turn on" (or "On" only after the demo set-up), never a fixed "On" |
| Security page and disclosure page | Static pages; true in every mode |
| Change log | As today |

Not shown in the preview, and never implied there: encryption at rest, backups, server refusals, lockout across devices, real emails. The owner sees those in the proof plan as a local server run with its output pasted (section 8, plan 15-10).

<!-- section 2 done -->
