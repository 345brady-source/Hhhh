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
