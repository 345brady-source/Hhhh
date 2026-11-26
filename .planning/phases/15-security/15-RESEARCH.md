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
