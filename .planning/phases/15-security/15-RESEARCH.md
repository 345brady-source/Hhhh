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

**Speed:** an outside provider adds a redirect and a network round trip to each sign-in; in-house adds one local scrypt check: measured this session on the build machine at 224 ms for N=2^15, r=8, p=3 and 333 ms for N=2^17, r=8, p=1 (`crypto.scryptSync`, one run each; the server must use the asynchronous `crypto.scrypt` so the wait does not block other requests) [VERIFIED: measured with node v22.23.4 this session]. **Accuracy:** not applicable (no reading involved).

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

## 3. Two-step sign-in

### 3.1 The four ways compared

| Way | Cost | Stops a stolen password | Stops a fake sign-in page | Works in the no-server preview | Build | Verdict |
|-----|------|-------------------------|---------------------------|-------------------------------|-------|---------|
| **Authenticator-app code (TOTP, RFC 6238)** | $0 | Yes | No: a fake page can pass the code on within 30 seconds [ASSUMED: well-known limit of one-time codes] | Yes: the code can be checked in the browser | In-house: about 80 lines on `crypto.createHmac('sha1')`, proved with the RFC's own test values | **Build now** |
| Passkeys (WebAuthn) | $0 | Yes | Yes (bound to the site) [CITED: search excerpt of NIST SP 800-63B-4 commentary: "AAL2 verifiers ... offer at least one phishing-resistant authentication option"; the NIST page itself could not be opened] | No: the browser's passkey prompt is not expected to open inside the owner's sandboxed frame [ASSUMED: it needs the frame's permission policy to allow it] | Server checks need CBOR, COSE keys and signature checks: not to be written by hand; the usual package `@simplewebauthn/server` 14.1.0 brings about ten further packages and is flagged by the legitimacy check (see audit) | **Later** (C-02) |
| Email code | $0 | Partly | No | Simulated only | Small | **No**: email is also the reset path, so code plus reset by email is one factor (the mailbox) |
| Text-message code | About $0.058 per check [CITED: section 1.1] | Partly (SIM swap) | No | Simulated only | Outside service | **No**: a cost on every sign-in, against the $0 rule |

### 3.2 The authenticator-app code, exactly

- Algorithm HMAC-SHA-1, 6 digits, 30-second steps (the settings every common authenticator app reads from the set-up code) [ASSUMED: default parameters of the `otpauth://` key format]; the server accepts the current step and one step either side, and refuses a step it already accepted for that person (no replay).
- Secret: 20 random bytes, shown base32 in groups of four, sealed with the vault, never shown again after set-up.
- Set-up code: `otpauth://totp/<label>?secret=<base32>&issuer=<issuer>&algorithm=SHA1&digits=6&period=30`, with issuer and label the firm's short name and the person's email (white label: never the platform's or a vendor's name; the self-serve edition is "fully white-labeled", edition.js:39).
- The code is proved against RFC 6238's SHA-1 test values. Computed this session with `node:crypto` (secret `12345678901234567890`, 8 digits): T=59 → 94287082, T=1111111109 → 07081804, T=1111111111 → 14050471, T=1234567890 → 89005924, T=2000000000 → 69279037, T=20000000000 → 65353130 [VERIFIED: computed this session; these match the RFC's Appendix B SHA-1 column as remembered, and the test file must quote the RFC's table, not this list].
- QR code for desktop set-up: drawn in the page by a small vendored encoder under `assets/vendor/` (the repo already vendors libraries this way, with SOURCE.txt, SHA256SUMS and a licence file: assets/vendor/pdfwrite/, pdfview/). The phone path is the key typed into the app; both are offered.

### 3.3 Recovery codes

Ten codes, each 10 characters from an alphabet without look-alike characters, shown once at set-up with "Download" and "Copy", stored only as SHA-256 hashes (they are long random values, so a fast hash is enough), each usable once in place of an app code. Using one tells the person how many are left and offers new ones; making new ones needs a current code and replaces all ten.

When a person has lost both the phone and the codes:
- Staff, Read-only, Accountant, Admin: an Owner or Admin chooses "Reset two-step sign-in" on the Team page; the person sets it up again at next sign-in; logged and emailed to the person.
- Owner: Carrow & Vale support resets it through an operator route behind `ADMIN_TOKEN` after confirming the person by phone (written procedure in the server README).
- Investor: the firm's team resets it from the investor's record; logged and emailed.

### 3.4 Defaults

| Who | Two-step | Why |
|-----|----------|-----|
| Every console person (Owner, Admin, Staff, Read-only, Accountant) | **Required**: set up at first sign-in; the console does not open until it is done | The console holds every investor's bank and tax data. The FTC Safeguards Rule requires "multi-factor authentication for any individual accessing any information system" at the financial institutions it covers [CITED: search excerpt of 16 CFR 314.4(c)(5), law.cornell.edu]; SEC Regulation S-P's 2024 amendments reach registered advisers (smaller ones from June 3, 2026) [CITED: search excerpts of sec.gov small entity guide, Sidley, Holland & Knight]. Whether a given sponsor is covered is for its counsel ("To be confirmed with counsel" wherever a screen relies on it) |
| Investors | **Offered, off by default, never required** (D-30), one line on the Account page ("Two-step sign-in: Off" with "Turn on") and once after first sign-in | Owner rule D-30: nothing mandatory for investors |
| Sponsor setting | An Owner may require it for the firm's investors (default off) | Some sponsors' compliance will ask for it (C-03) |
| Emails | A notice to the person when a password, two-step sign-in or recovery codes change, and when a console sign-in comes from a new device | These are the moments an account takeover shows; they need three small templates beside phase 13's `password_reset` (section 7) |

<!-- section 3 done -->

## 4. Roles a small sponsor needs, enforced on the server

### 4.1 Five console roles (self-serve edition; the managed edition keeps `staff`, `sponsor`, `investor` unchanged)

| Role | For | In one line on the Team page |
|------|-----|------------------------------|
| Owner | The person who created the portal (one; can hand it to an Admin) | Everything, including billing, sign-in rules and closing the portal |
| Admin | Partners, the CFO | Everything except billing and ownership |
| Staff | Investor relations, operations (today's "Team member") | Day-to-day work; payments are released by an Admin or the Owner |
| Read-only | A partner who only looks, compliance review | Sees everything, changes nothing; bank numbers show the last four digits |
| Accountant | The firm's CPA or fund auditor | Reports, the audit file, capital accounts and tax documents only; access ends on a date |

### 4.2 Permissions

| Permission | What it covers | Owner | Admin | Staff | Read-only | Accountant |
|------------|----------------|:-----:|:-----:|:-----:|:---------:|:----------:|
| view | Open the console and its pages | yes | yes | yes | yes | Report pages only |
| operate | Investors, invitations, e-sign, notices, documents, requests, capital calls and distributions (prepare), tax documents, AML/KYC results, messages | yes | yes | yes | no | no |
| pay | See full bank numbers, change an investor's bank account, build and download a payment file, record a payment | yes | yes | no (C-10) | no | no |
| spend | Anything that charges the firm's card: verification packages on invitations, filing orders | yes | yes | no | no | no |
| configure | Offerings, offering intake, portal and brand, integrations, ACH origination, email sending | yes | yes | no | no | no |
| team | Invite, remove, change roles (an Admin cannot change or remove the Owner) | yes | yes | no | no | no |
| account | Billing, the firm's sign-in rules, transfer ownership, full backup export, close the portal | yes | no | no | no | no |
| personal | Investor contact details, identity and verification documents | yes | yes | yes | yes | no (names, amounts and tax-form status only) |
| audit | Read and export the change logs | yes | yes | yes | yes | yes |
| reports | Read and download reports and the year-end package | yes | yes | yes | yes | yes |

### 4.3 Console pages by role (keys from console.js:36-57)

| Page | Owner, Admin | Staff | Read-only | Accountant |
|------|--------------|-------|-----------|------------|
| Overview, Notifications | open | open | open, no actions | Overview only |
| Offerings | change | read | read | read |
| Offering intake, Portal and brand, Integrations, ACH origination, Team | open | hidden | hidden | hidden |
| Investors | change; bank changes | change except bank | read, bank masked | names, commitments, capital accounts; contact masked |
| E-sign, Notices, Requests, AML/KYC | act | act | read | hidden |
| Capital calls, Distributions | act; release payment files | prepare | read | read |
| Documents, Tax documents | act | act | read | read and download |
| Reports, Audit (and phase 11-12 pages for the books and the report builder) | open | open | open | open |
| AML program | change | read | read | hidden |
| Filings | order (spend) | prepare, read | read | read |
| Sign-in and security (new: one's own password, two-step, recovery codes, sessions; the Owner also sees the firm's rule) | open | open | open | open |

### 4.4 How the server enforces it

- `server/lib/roles.mjs` holds the two tables above as data and one function `allows(role, permission)`. The session gives the person and role; the request never does.
- Every sponsor route names its permission next to it (one table in roles.mjs, checked by a test that walks every route in index.mjs and fails on a route with none): invitations create, resend, cancel and submission delete → operate (with a paid package → spend); `GET /v1/outbox` → operate (live links); tax documents send and withdraw → operate; filings orders → spend; billing → account (card) or spend (packages); verifications and screenings → operate; intake and read → configure; help → any signed-in person; phase 13's messages → operate; workspace read → view, write → by section (below); people and roles → team; server change log → audit; backup export → account with a sign-in in the last 10 minutes.
- Workspace writes are checked by section: `tenant`, `offerings`, `integrations`, `invitationRules`, `amlProgram`, `esignTemplates` → configure; `investors` → operate, except any investor's `payment` → pay; `runs`, `calls`, `requests`, `notices`, `docs`, `envelopes`, `taxdocs`, `taxDeposits`, `books`, `reports`, `notifications`, `invitations`, `filings` → operate; `achLog` → pay; `team` is read from the server's people, never written by the browser; `audit` may only grow; any key not in the table → configure (refuse by default). [ASSUMED: section names collected this session by a scan of `ws.<key> =` writes in assets/js; the planner re-scans on the tree it builds from.]
- Masking on read: for a role without pay, `payment.bank.routing` and `.account` come back as `****` plus the last four, and a write that sends the masked value back keeps the stored value; for the Accountant, contact fields and verification documents are removed.
- Refusals answer 403 with one plain sentence ("Only an Admin or the Owner can change bank accounts.") and are written to the server change log.
- The browser copy of the same tables (edition.js, app.js `can()`, `allowed()`) only hides and disables; a check proves the server refuses even when the browser is bypassed.

<!-- section 4 done -->

## 5. Encryption, keys, backups, retention, data minimization, sessions

### 5.1 Encryption at rest (server mode)

Reuse the vault as it is: AES-256-GCM, a fresh 12-byte IV per value, the record id and field bound in as additional data, a key id in each sealed value (vault.mjs header comment and lines 50-99). New things sealed with it:

| What | How | Bound to |
|------|-----|----------|
| The sponsor's workspace (investors with bank accounts, offerings, runs, notices, the change log) | One sealed blob per version, kept as a blob file so store.json stays small; the last 10 versions kept (C-04) | `workspace:<id>:<version>` |
| Signed documents (W-9 with the full taxpayer number, agreements) the console keeps today in IndexedDB | Sealed blobs, as invitations already do (`putBlob` in invitations.mjs:606) | the blob key |
| People: email, name, two-step secret | Sealed fields; the email is also kept as an HMAC-SHA-256 lookup value under a key derived from `DATA_KEY` with HKDF (`crypto.hkdfSync`), so sign-in can find a person without a plain email in the file | `person:<id>:<field>` |
| Server change log details | Sealed per entry; the chain hashes the sealed value, so the log can be checked without the key | `audit:<seq>` |
| Sessions, reset tokens, recovery codes | Only SHA-256 hashes are stored (as invitation tokens are) | — |

The taxpayer and bank numbers are therefore encrypted twice over in server mode: inside the sealed workspace or document, and never kept by the browser (section 5.4). Without `DATA_KEY` the new routes refuse, exactly as invitations do today (vault.mjs:41-42: `if (!key && !problem && !plainOk) problem = 'Set DATA_KEY on the integration server ...'`).

### 5.2 Keys and rotation

- `DATA_KEY`: 32 random bytes from the host's secret settings (`openssl rand -base64 32`, README.md:39). The operator keeps an offline copy (password manager and a paper copy in a safe); it is never in the repo, a backup, a log or an email.
- Rotation (W-15): `DATA_KEY_PREVIOUS` accepts a comma-separated list; `node server/tools/reseal.mjs` re-seals every sealed field and blob with the current key, recomputes the email lookup values, prints counts per collection and refuses to run while the server is running (it checks a lock file). After a clean run the operator removes the old key. Rotate yearly, and at once when someone with server access leaves or a leak is suspected.
- `BACKUP_KEY`: a second 32-byte key, kept apart from `DATA_KEY`, seals backup archives, so one leaked key does not open a stolen backup (C-06).
- A key service (envelope encryption) is the later upgrade (section 1.2, C-05).

### 5.3 Backups

- `node server/tools/backup.mjs create --out <dir>`: flushes the store, writes one archive holding store.json and every blob with a manifest of SHA-256 hashes, sealed with `BACKUP_KEY` in 1 MiB pieces (each piece's number bound in as additional data, so pieces cannot be reordered or dropped unseen) [ASSUMED: piece size; the planner may pick another].
- `verify <file>`: opens every piece, checks every hash, prints counts; exits non-zero on any mismatch.
- `restore <file> --to <empty dir>`: never over a live store.
- `prune --keep 7d,4w,12m`: keeps 7 daily, 4 weekly and 12 monthly archives.
- Schedule: the operator's timer (cron or systemd) daily; or `BACKUP_DIR` set and the server makes one daily itself (C-06). Off-site copy: the operator's own computer or the free object-storage tier (section 1.3).
- Restore drill: the proof plan creates an archive, wipes a test store, restores it, starts the server and opens a sealed invitation and a sealed workspace from it; the output goes in the summary for the owner.

### 5.4 Retention and data minimization

Kept as today (README.md:574): submissions deleted on import or after 30 days (`SUBMISSION_DAYS`), invitations 30 days after they end, outbox 30 days (`OUTBOX_DAYS`), tax documents until their available-until date.

New:

| Record | Kept | Then |
|--------|------|------|
| Sessions | Until sign-out, 60 minutes idle or 12 hours (section 5.5) | Deleted a day later |
| Reset and team-invitation tokens | 30 minutes (reset), 7 days (team invitation) | Deleted on use or a day after expiry |
| Failed sign-in counts | 30 days | Deleted |
| Workspace versions | Last 10 | Older versions deleted |
| Server change log | As long as the portal exists; exported by the Owner when closing | Deleted with the portal |
| A closed portal | 30 days to change one's mind, with an export | Deleted; backups age out within 12 months (the security page says so) |
| A removed team member | Disabled at once (sessions ended); name kept for the change log | Email and two-step secret deleted |
| Addresses (IP) | Never stored raw: a keyed hash for failure counting; the "Sessions" list shows device type and time only | — |

Minimization rules the checks enforce:
- The full taxpayer number stays only inside the signed tax-form file (already true: onboarding.js:774, tax1099.js:288-311). A check scans the stored workspace (opened with the test key) and fails on any 9-digit taxpayer-shaped value.
- Full bank numbers reach only roles with pay; the investor's device keeps the last four (onboarding.js:3271-3273, already); in server mode the console keeps no workspace copy in browser storage (it lives in memory while signed in).
- No taxpayer, bank or password value in any email (phase 13's guard), any log line, any event, any error.
- W-18: the co-investor's Documents show "Tax form on file" for the main investor's signed W-9, not the file (C-14).

### 5.5 Session protection

| Control | Setting | Source |
|---------|---------|--------|
| Cookie | `__Host-session=<43 characters>; Path=/; Secure; HttpOnly; SameSite=Strict` when the pages and the server share one origin; one cookie, no session data in it | `__Host-` rules [ASSUMED: RFC 6265bis cookie prefixes] |
| One origin | The server serves the portal's own pages (`SERVE_PORTAL=1`: a fixed list of files read at start-up, so no path from a request can reach another file) so the cookie never crosses sites (C-07) | Safari blocks cookies sent to another site [ASSUMED: Safari's tracking prevention] |
| Idle timeout | 60 minutes, with a "Stay signed in" prompt 2 minutes before | NIST SP 800-63B-4 at AAL2: inactivity "SHOULD be no more than 1 hour" [CITED: search excerpt of pages.nist.gov/800-63-4/sp800-63b/aal] |
| Absolute timeout | 12 hours (console and investors) | Same source: overall "SHOULD be no more than 24 hours" [CITED: same] (C-08) |
| Fresh sign-in for sensitive actions | Password and code within the last 10 minutes to: change a bank account, release a payment file, change roles, change one's own email, password or two-step, export a backup, transfer ownership | [ASSUMED: common practice] |
| Session id | New id at sign-in and after the code; all of a person's sessions end on password change or reset, two-step reset, removal; "Sign out everywhere else" on the Sign-in and security page | |
| CSRF | SameSite cookie; every state-changing call must be `Content-Type: application/json` (a plain HTML form cannot send it to another site without the browser asking first); `Origin` must be the server's own or one listed in `PORTAL_ORIGIN`; no GET changes anything | [ASSUMED: OWASP guidance] |
| CORS | With sessions on, never `*`: credentials only for listed origins (W-04) | http.mjs:53-65 |
| Rate limits | Sign-in: 20 tries per 15 minutes per address (the rightmost address a trusted proxy added, W-05); counters evicted oldest-first, never wiped (W-06) | |
| Lockout | After 5 wrong passwords each try waits longer (1, 2, 4 ... up to 15 minutes); after 10 in an hour the account is locked for 15 minutes and the person is emailed; 5 wrong codes end the half-done sign-in; counts kept on the person record so a restart does not clear them | NIST caps consecutive failures at 100 [ASSUMED: 800-63B rate-limiting text, page not opened] |
| Passwords | scrypt (N=2^15, r=8, p=3: 224 ms measured, section 1.1); no composition rules; up to 128 characters; paste allowed; refused when on a bundled list of common passwords; minimum 10 characters for console people (two-step always on) and 15 for investors, who may sign in with the password alone | NIST: "SHALL require passwords that are used as a single-factor authentication mechanism to be a minimum of 15 characters in length" [CITED: search excerpt of pages.nist.gov/800-63-4/sp800-63b/authenticators] (C-08) |
| Headers (W-07) | Every answer: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=31536000` when `PUBLIC_URL` is https, `Cross-Origin-Resource-Policy: same-site`; server-served pages also `Content-Security-Policy` with `frame-ancestors 'none'` for sign-in pages (the preview's own frame is a different build) | [ASSUMED: OWASP secure headers] |

<!-- section 5 done -->

## 6. The public security page and the disclosure page

### 6.1 What can honestly be claimed without SOC 2

Each claim may appear only when its evidence exists; a check scans both pages for the banned words below.

| Claim (plain wording) | Evidence that must exist | Shown when |
|-----------------------|--------------------------|------------|
| Everyone who uses the console signs in with a password and a code from an authenticator app. | Server test: sign-in without a code is refused for every console role | Always (server mode is the product) |
| Investors can turn on two-step sign-in. | Server and browser tests | Always |
| Each person has their own sign-in and a role, and the server checks the role on every request. | The route walk in 4.4 | Always |
| Investors' bank account and taxpayer numbers are encrypted at rest (AES-256-GCM), and the key is kept apart from the data. | Vault and sealed-workspace tests; the server refuses to store them without a key | Always |
| Every change is written to a change log that shows any later alteration. | Chain tests on the server log | Always |
| Backups are encrypted and restored in a test before they are relied on. | The restore drill output | After the first drill on the real deployment |
| Connections use HTTPS only. | A deployment check that `PUBLIC_URL` is https and HSTS is sent | Only on a deployment that passes it |
| How long each kind of record is kept (the table in 5.4, with the numbers from the server's settings) | Purge tests | Always |
| We never send taxpayer numbers, bank numbers or passwords by email. | Phase 13's guard tests | Always |
| How to report a security problem, and what we promise in return | The disclosure page and security.txt | Always |

Never on either page (banned-claims check): SOC 2, ISO 27001, "certified", "audited", "bank-level", "bank-grade", "military-grade", "unhackable", "100% secure", "fully compliant", "compliant with" any law, "approved by" any regulator, "penetration tested" (until a letter exists, C-13), insurance, any vendor or library name, and the word "basic". SOC 2 is not mentioned at all; if a sponsor asks, the honest answer is "not yet" [recommendation; C-13].

### 6.2 Pages and audiences

- `security.html` and `disclosure.html` at the site root, in the platform's own brand: they are read by sponsors and their counsel before signing up (the sign-up page already shows the platform's name to sponsors, diy.js:46). Linked from the sign-up page and the console footer.
- Investors: the firm's portal footer gets "Security", a firm-branded page built from the same facts with no platform name (white label) (C-12 covers whether this ships now).
- In the no-server preview both pages open as they are; the facts describe a live portal, and the preview bar already says it is a demo.

### 6.3 Disclosure page (content outline)

1. What to report: problems in the portal's pages, the server and anything listed in security.txt.
2. How: the security email address (`Contact:`), what to include (steps, what was reached, how to reach the reporter).
3. Our promise: an answer within 3 business days, updates until it is fixed, credit on request [ASSUMED: common practice; the owner may change the numbers].
4. Rules for researchers: test only with accounts you own; stop and report as soon as you reach someone else's data; do not keep, share or change it; no denial of service, social engineering, spam or physical tests; give us 90 days before publishing [ASSUMED: common coordinated-disclosure practice].
5. Good-faith promise not to pursue legal action for research within these rules: "To be confirmed with counsel".
6. Not in scope: missing headers with no shown effect, self-inflicted script injection, reports from automated scanners with no proof, third-party services.
7. No reward money (a thank-you is offered).

### 6.4 security.txt (RFC 9116)

Served by the server at `/.well-known/security.txt` and as a static file at the site root's `.well-known/security.txt`, over HTTPS:

```
Contact: mailto:<security address, To be confirmed>
Expires: <a date less than one year after the file was last reviewed, ISO 8601 with time zone>
Policy: https://<portal host>/disclosure.html
Preferred-Languages: en
Canonical: https://<portal host>/.well-known/security.txt
```

`Contact` and `Expires` are required [CITED: search excerpt of specification.website/spec/security/security-txt]; the file belongs at `/.well-known/security.txt` over HTTPS and may be signed with an inline OpenPGP signature [CITED: same and search excerpt of datatracker.ietf.org/doc/rfc9116]; "less than a year" for `Expires` is from memory of RFC 9116 section 2.5.5 [ASSUMED: the RFC page could not be opened]. The server builds the file from `SECURITY_CONTACT` and `SECURITY_TXT_EXPIRES`; `/health` warns 30 days before the date and the route answers 404 after it, so a stale file is never served [recommendation]. The security address and domain are owner inputs ("To be confirmed" until he gives them, C-13).

<!-- section 6 done -->

## 7. The password reset: what phase 13 delivers and what this phase adds

### 7.1 Answer: phase 13 does not deliver the flow

- 13-11 adds only the template: `password_reset (investor or team); data { firm, person: { name }, link, expiresAt }; subject \`${firm}: reset your password\`; button 'Choose a new password'` [VERIFIED: .planning/phases/13-email-overhaul/13-11-PLAN.md:86], and states "EM-12 and C-03: password reset and team invitation templates exist for the previews; nothing sends them in this phase" [VERIFIED: 13-11-PLAN.md:35].
- 13-08 makes the toast honest: "'Forgot your password?' answers 'Password reset email (simulated in this demo). If you cannot sign in, contact <team>.'" [VERIFIED: 13-08-PLAN.md:33].
- 13-CONTEXT.md: "C-03 Password reset and team invitation: templates, previews and honest toasts now; real sending comes with the security step's sign-in accounts." [VERIFIED: 13-CONTEXT.md:10].
- On this tree only 13-02 is merged (git log: "e1953d9 Merge plan 13-02"); `assets/js/emails.js` does not exist yet (`ls`: "No such file or directory").

So phase 15 builds the flow, and waits for 13-01 and 13-11 (the renderer and the template), 13-03 (the server sends as the sponsor from its own domain, the sent log) and 13-08 (the same toasts in diy.js and portal.js).

### 7.2 The flow

1. "Forgot your password?" opens a page with "Email" → `POST /v1/auth/reset/request { email }` → always the same answer, whether or not the address has an account: "If an account uses that address, we emailed a link to choose a new password. It works for 30 minutes." Limits: 3 per hour per address of email, 10 per hour per network address.
2. The server, when an active person has that email: a 32-byte token, only its SHA-256 stored with the person and a 30-minute expiry; any earlier unused reset token for that person is cancelled; the email is rendered with `password_reset` and sent by phase 13's mail path. The link carries the token after `#` so it never reaches a server log or another site's Referer.
3. The new-password page: "New password" and "Confirm password"; when the person has two-step on, also "Code from your authenticator app" (or a recovery code): a reset never skips two-step. `POST /v1/auth/reset/confirm { token, password, code }`.
4. On success: new scrypt hash, token marked used, every session of the person ended, a "Your password was changed" notice emailed, a change-log entry (the person and the time, never the password), then the sign-in page.
5. Lost app and recovery codes as well: the page says to contact the firm's team (or Carrow & Vale support for an Owner) and the reset of two-step follows section 3.3.
6. Team invitations use the same token mechanism with 13-11's `team_invitation` template: accept page → name and password → two-step set-up → console.
7. No-server preview: 13-08's simulated sentence; the new-password page opens from the Emails page's preview link, labelled demo.

### 7.3 What the server must add (beyond phase 13)

- The people store, the reset and team-invitation token stores, the two routes, the limits (section 5.5).
- One more template kind with variants, `security_notice`: passwordChanged, twoStepChanged, recoveryCodeUsed, newDevice, locked (one kind keeps emails.js small; same layout and guard as phase 13).
- **The outbox must never hold a readable reset or team-invitation link.** Today, with no mail server set, messages wait in `GET /v1/outbox` (README.md:354), which Staff can read; a reset link there would let Staff take over the Owner's account. With no mail server, a reset request is refused with "Email is not set up on this server; contact <team>", and team invitation links are shown once to the Admin who made them instead of being kept (pitfall 2).
- Real sending is proven only at 13-10's owner checkpoint (his sending account, a test domain, real inboxes); until then the proofs use the local mail stand-ins of 13-02 (smtp-fake.mjs, ses-fake.mjs).

<!-- section 7 done -->

## 8. Requirements and recommended plan breakdown

<phase_requirements>
### 8.1 Phase Requirements (SE-01 ... SE-15)

| ID | Description | Research Support |
|----|-------------|------------------|
| SE-01 | Console people sign in on the server with their own email and password (scrypt), a session cookie and sign-out; self-serve sign-up creates the workspace and its Owner; once any person exists the open-server fallback is off | D-01 "two-factor sign-in", "session protection"; W-01, W-02, W-09; 2.5(1), 5.5 |
| SE-02 | Two-step sign-in with an authenticator app (TOTP, RFC 6238 test values), required for every console person, set up with a typed key or a QR code, replayed codes refused; ten one-time recovery codes; resets of two-step by an Admin/Owner, by the operator for an Owner | D-01; 3.1-3.4 |
| SE-03 | Investors: the onboarding's login step creates their server account with the invitation token; portal sign-in goes through the server; two-step offered, off by default, never required, and an Owner may require it | D-01, D-30; W-08, W-10; 3.4 |
| SE-04 | Password reset and team-invitation acceptance by email: same answer whether or not an account exists, 30-minute single-use token, two-step not skipped, all sessions ended, a notice email, no readable link in the outbox | Known gap (15-CONTEXT); 7.1-7.3 |
| SE-05 | Five console roles (Owner, Admin, Staff, Read-only, Accountant) and the permission table, enforced on every server route (a test walks every route); the Team page invites, changes and removes people through the server; Accountant access ends on a date | D-01 "roles and permissions"; W-11; 4.1-4.4 |
| SE-06 | The console by role: pages hidden or read-only, actions disabled with one plain sentence, bank numbers masked for roles without pay; managed edition unchanged | 4.3; AUTOPILOT C-03 slice guard |
| SE-07 | In server mode the workspace and its documents are held on the server, sealed, versioned; writes checked by section; bank-account changes need pay; masked reads; the change log may only grow; the browser keeps no copy in storage | D-01 "encryption", "data minimization"; W-03, W-12, W-14; 2.5(3), 4.4, 5.1 |
| SE-08 | A server change log: append-only, hash-chained, the person from the session, details sealed, read and export with the audit permission, a verify call | D-01 "audit log"; W-12, W-13; 2.5(4) |
| SE-09 | Session protection: cookie flags, idle and absolute timeouts, fresh sign-in for sensitive actions, CSRF rules, CORS with credentials only for listed origins, rightmost proxy address, counters evicted not wiped, per-account lockout, security headers | D-01 "session protection"; W-04 to W-07; 5.5 |
| SE-10 | Keys and backups: several previous keys, the re-seal tool, `BACKUP_KEY`, backup create, verify, restore and prune, and a restore drill | D-01 "encryption and backups"; W-15, W-16; 5.2, 5.3 |
| SE-11 | Retention and data minimization as in 5.4, enforced by purge tests; no taxpayer-shaped value in the stored workspace; no secret in logs, events, errors or emails; the co-investor sees "Tax form on file", not the main investor's W-9 | D-01 "data minimization"; W-18; 5.4 |
| SE-12 | Public security page, disclosure page and `/.well-known/security.txt` (Contact, Expires, Policy, Preferred-Languages, Canonical), each claim backed by a check, banned claims refused; a firm-branded investor version | D-01; W-20; 6.1-6.4 |
| SE-13 | Truthful screens: every claim in W-10 rewritten; the preview shows two-step set-up working on the device with one demo sentence, never a fixed "On", and makes no request | Owner rule; W-10; 2.6 |
| SE-14 | White label and wording: no platform, vendor, model or library name on any investor-facing screen, email or page; the firm's name as the two-step issuer; never the word "basic" | AUTOPILOT; 3.2, 6.2 |
| SE-15 | Proof and the owner's check: gate lines for every new check, the full reference gate, the preview built and walked under phone conditions, a local server run with its output pasted; the owner sets up two-step with his own iPhone app, walks the roles and reads the security page; the live reset email waits for 13-10's sending account | CLAUDE.md "never call something done before the owner has checked it" |
</phase_requirements>

### 8.2 Plans, waves and files

Each plan is sized for about 100k tokens. Plans in one wave share no file.

| Wave | Plan | What | Files (new unless marked edit) | Depends on |
|------|------|------|-------------------------------|------------|
| 1 | **15-01** Server sign-in core | People store, scrypt passwords, sessions and the cookie, sign-up (Owner), sign-in, sign-out, me, password change, lockout and limits, CSRF and Origin rule, CORS credentials, headers, rightmost proxy address, evicting counters, open server off once people exist, `SERVE_PORTAL` fixed file list, the security.txt route (SE-01, SE-09) | server/lib/auth.mjs, server/lib/http.mjs (edit), server/index.mjs (edit), server/test/auth.test.mjs, server/test/headers.test.mjs | — (waits while any plan editing index.mjs or http.mjs runs: 13-03, 13-04, phase 14 server plans) |
| 1 | **15-02** Two-step code module | One UMD file used by browser and server: base32, TOTP given an HMAC function (WebCrypto in the browser, `node:crypto` on the server), recovery-code format; RFC 6238 test values; the vendored QR encoder (SOURCE.txt, SHA256SUMS, licence) (SE-02) | assets/js/totp.js, assets/vendor/qr/, server/test/totp.test.mjs | — |
| 1 | **15-03** Keys and backups | Several previous keys in vault.mjs, `tools/reseal.mjs`, `tools/backup.mjs` (create, verify, restore, prune), a store snapshot hook, README "Keys and backups" (SE-10) | server/lib/vault.mjs (edit), server/lib/store.mjs (edit), server/tools/reseal.mjs, server/tools/backup.mjs, server/test/backup.test.mjs, server/README.md (edit: its own section) | — |
| 2 | **15-04** Two-step, recovery, reset | Server two-step set-up and check, recovery codes, two-step reset routes, password reset request and confirm, `POST /v1/invite/login`, the `security_notice` email kind, no reset link in the outbox (SE-02, SE-03, SE-04) | server/lib/auth.mjs (edit), server/lib/invitations.mjs (edit: the login route only), assets/js/emails.js (edit: one kind), server/test/auth-twostep.test.mjs, server/test/auth-reset.test.mjs | 15-01, 15-02; 13-01, 13-11, 13-03 merged |
| 2 | **15-05** Roles, team and the server change log | roles.mjs tables, the guard on every sponsor route and the route-walk test, team.mjs (invite with `team_invitation`, accept, role change, remove, Accountant end date), auditlog.mjs (SE-05, SE-08) | server/lib/roles.mjs, server/lib/team.mjs, server/lib/auditlog.mjs, server/index.mjs (edit), server/lib/taxdocs.mjs, filings.mjs, billing.mjs (edits: guard calls), server/test/roles.test.mjs, server/test/auditlog.test.mjs | 15-01; 13-11 merged |
| 3 | **15-06** Workspace on the server | workspace.mjs (GET/PUT, versions, section rules, bank rule, masking, append-only log, sealed documents), the console's server persistence in workspace.js, signed documents to the server in operations.js (SE-07, SE-11) | server/lib/workspace.mjs, server/index.mjs (edit), assets/js/workspace.js (edit), assets/js/operations.js (edit: file store only), server/test/workspace.test.mjs, phase check workspace-server.js | 15-05 |
| 3 | **15-07** Console sign-in screens | signin.js (sign-in, code, two-step set-up with key and QR, recovery codes download, Sign-in and security page, idle prompt, reset and accept pages), the boot gate in app.js, sign-up through the server, the Team page with five roles, truthful hints (W-10 for diy.js), edition.js roles, script tags; preview demo on the device (SE-01, SE-02, SE-05, SE-13) | assets/js/signin.js, assets/css/signin.css, assets/js/app.js (edit), assets/js/diy.js (edit), assets/js/edition.js (edit), diy.html, portal.html, index.html (edit: script tags), phase check signin-flow.js | 15-02, 15-04, 15-05 (contracts); 13-08 merged (diy.js) |
| 4 | **15-08** The console by role | `can()` and `allowed()` for five roles, read-only pages, disabled actions with the reason, masked bank numbers, payments released by pay only; managed edition byte-identical (SE-06) | assets/js/app.js (edit), assets/js/console.js (edit), assets/js/filings-ui.js, taxdocs-ui.js, integrations.js, esign.js (edits: action guards only), phase check roles-flow.js | 15-07 |
| 4 | **15-09** Investor sign-in | Portal sign-in through the server, "Forgot your password?" page, the new-password page, Account "Two-step sign-in" with Turn on, the onboarding login step posting to `/v1/invite/login` and its sentence fixed (W-08, W-10), the co-investor's "Tax form on file" (C-14) (SE-03, SE-04, SE-11, SE-13) | assets/js/portal.js (edit), assets/js/onboarding.js (edit), phase check investor-signin.js | 15-04, 15-07; 13-08 merged (portal.js) |
| 5 | **15-10** Public pages and guide | security.html, disclosure.html, .well-known/security.txt, the firm-branded investor page and footer link, the banned-claims check, guide entries (SE-12, SE-14) | security.html, disclosure.html, .well-known/security.txt, assets/js/portal.js (edit: footer link), server/help/guide.md (edit), server/lib/help-guide.mjs (regenerated), phase check pages.js | 15-08, 15-09 |
| 6 | **15-11** Proof and the owner's check (not autonomous) | Gate lines for every check above, the full reference gate, the preview build and walk at 390x844 in the sandboxed frame, a local server run (sign-up, two-step, roles refused, sealed workspace, reset through the mail stand-in, backup and restore) with output pasted; checkpoint: the owner (SE-15) | .planning/checks/gate-reference.sh (edit), phase 15 checks, 15-11-SUMMARY.md | all |

Shared files to watch at plan time (other phases' plans that list them): server/index.mjs (13-03, 13-04, phase 14), server/lib/invitations.mjs (phase 8 and 13 plans), assets/js/emails.js (every phase 13 plan; phase 14's new-message notice), assets/js/diy.js and portal.js (13-08; 08-20; phase 14), assets/js/app.js (13-08, 10-12, phase 14), assets/js/console.js (phases 8 to 14), server/help/guide.md (13-09, 13-10, 10-11, 11-15, 11-16, 12-08 and the guide-trim quick task). Each plan's header names its waits.

### 8.3 The help guide (at its limit)

- Measured this session on this tree: sponsor guide 46,698 of 48,000 bytes, investor guide 15,436 of 20,000 (`GUIDE.sponsor`/`GUIDE.investor` from server/lib/help-guide.mjs; limits at server/test/help-guide.test.mjs:130-131) [VERIFIED: measured with node]. AUTOPILOT.md expects about 480 bytes to remain after the pending guide plans, and a guide-trim quick task runs before later guide plans.
- Phase 15 sponsor guide budget: **net +360 bytes or less** (source bytes measured this session on draft text):
  - console-team: step 2 shortened to `2. Choose the "Role".` (47 → 21 bytes, −26) and the roles paragraph rewritten for five roles (279 → 285 bytes, +6): `Roles: "Owner" has everything, including billing. "Admin" has everything but billing. "Staff" runs day-to-day work; an Admin or the Owner releases payments. "Read-only" sees everything and changes nothing. "Accountant" sees reports, the audit file and tax documents until the date set.`
  - New `console-security` entry, 380 source bytes: title "Sign-in and security", anchor "Two-step sign-in", two sentences on the password, two-step, recovery codes and devices, and who resets a lost phone.
  - If the trim has not freed the room when 15-10 runs, `console-security` goes to the guide's `## skip` list with a reason and only the Team edit ships (net −20 bytes).
- Investor guide (4,564 bytes free): the `sign-in` entry gains the reset steps and the `account` entry's "two-step verification" line says how to turn it on; budget +500 bytes.
- The guide is rebuilt with `node server/help/build.mjs` and checked with `--verify`; the paid help measurement is not rerun (AUTOPILOT: no paid calls by agents).

<!-- section 8 done -->

## 9. Choices for the orchestrator (each with a recommended default)

| # | Choice | Recommended default | Why |
|---|--------|--------------------|-----|
| C-01 | Sign-in built in-house or with an outside provider | **In-house** on the server with Node's own crypto | $0; firm-branded screens; works in the no-server preview; the WorkOS free tier is the outside option to revisit for passkeys or single sign-on (section 1.1) |
| C-02 | Passkeys in this phase | **Later** | Server verification must not be hand-written; the usual package adds about ten packages and is flagged; it cannot be shown in the owner's sandboxed frame (3.1) |
| C-03 | Two-step for investors | **Offered, off by default, never required; an Owner may require it for the firm's investors** | D-30 nothing mandatory for investors; some sponsors' compliance will want the switch |
| C-04 | Where the workspace lives in server mode | **On the server, sealed, last 10 versions kept; the browser keeps no copy in storage** | The only way to encrypt bank numbers at rest and enforce roles on writes (W-14, W-11); the preview keeps browser storage |
| C-05 | Key service (envelope encryption) | **Not now**: `DATA_KEY` in the host's secrets, the re-seal tool, yearly rotation | About $1 a month plus an AWS account; revisit when the first sponsor pays |
| C-06 | Backups | **The backup tool with its own `BACKUP_KEY`, daily on the operator's timer, 7 daily, 4 weekly, 12 monthly; off-site copy to the operator's computer, with the free object-storage tier offered** | $0; restore proven by a drill |
| C-07 | Deployment shape for cookies | **The server serves the portal's pages (`SERVE_PORTAL=1`), one origin, `__Host-` cookie with SameSite=Strict** | Cookies across sites fail in Safari; one origin also removes most CSRF risk |
| C-08 | Timeouts and passwords | **60 minutes idle, 12 hours absolute; minimum 10 characters for console people (two-step always on), 15 for investors; a bundled common-password list; scrypt N=2^15, r=8, p=3** | NIST 800-63B-4 figures (5.5); 224 ms measured per check |
| C-09 | Sponsor account tokens once people exist | **Kept for server-to-server automation only: they cannot reach people, roles, the workspace, billing or backups; the console no longer stores one** | Removes W-03 without breaking existing automation |
| C-10 | Who releases payments | **Owner and Admin (pay); Staff prepares** | A real control against a changed bank account; one switch could later let Staff release |
| C-11 | Accountant access | **Ends on a date, 90 days by default, renewable by an Admin; two-step required; every export logged** | Outside people should not keep access by default |
| C-12 | Investor-facing security page in this phase | **Yes, small, firm-branded, from the same facts** | Investors are asked for bank and tax numbers; one footer link answers "is this safe" without the platform's name |
| C-13 | Owner inputs | **The security email address and domain: "To be confirmed" placeholders until he gives them; paid penetration test: not now; SOC 2: not mentioned** | Owner has no budget for fees; claims stay honest (6.1) |
| C-14 | The co-investor and the main investor's signed W-9 | **Hide the file from the co-investor; show "Tax form on file"** | The file shows the full taxpayer number of another person (W-18); an open privacy decision for the owner: ask him, and take this default if he has not answered in 15 minutes |
| C-15 | Order with phase 14 | **15-01, 15-04 and 15-05 (server sign-in, two-step, roles) merge before phase 14's investor-facing server routes, which then use sessions** | Messages and the data room need a signed-in investor; building them on link tokens first would be redone |
| C-16 | Who may sign up on the server | **Anyone, with the email confirmed by link before investors can be invited (a `security_notice` variant with a button), and per-address limits** | Self-serve is the funnel; confirmation stops sign-ups with someone else's address |

<!-- section 9 done -->
