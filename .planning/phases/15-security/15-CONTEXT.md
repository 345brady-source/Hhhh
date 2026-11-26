# Phase 15: Security - Context

## Decisions (owner)
- D-01 (2026-11-15, 01.4-RESUME 5c; before the reorganization): two-factor sign-in, roles and permissions, audit log, session protection, encryption and backups, data minimization, a public security page, a responsible-disclosure page; an optional penetration-test letter; SOC 2 later. The product must not read as cheap (40 free sponsors for 12 months, then $100/month self-serve; it funnels business to Carrow & Vale).
- Known gap (2026-11-19): "Forgot your password?" in assets/js/portal.js only shows a placeholder; no reset email is sent. Built in this phase unless phase 13 (13-11 password reset template) already delivers the flow; the research says which.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; $0 path first); white label; the preview runs with no server and must stay honest about what only the server does; never the word "basic"; nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

## Questions the research must answer
- What exists today: the server's auth (server/), sessions, team members and their roles in the DIY console, the change log in audit.js, what is stored where (browser storage in the preview, the server's store), which secrets and taxpayer numbers are held and how.
- Two-factor: TOTP (authenticator app, $0, no SMS cost) vs passkeys (WebAuthn) vs SMS/email codes; recovery codes; what investors vs sponsors get by default.
- Roles a small sponsor needs (owner, admin, staff, read-only, CPA/auditor access) mapped to the console's pages and actions.
- Encryption at rest for taxpayer numbers and bank numbers on the server, key handling, backups, retention and data minimization.
- Security page and responsible-disclosure page content (security.txt, RFC 9116); what can honestly be claimed without SOC 2.
- Outside services (auth providers, pen-test firms) with real prices vs in-house.

## Owner decisions (2026-11-26, after 15-RESEARCH.md)
- D-02 (C-01): sign-in built in-house at $0 (passwords, authenticator-app two-step codes, sessions, roles on our server); no outside sign-in service.
- D-03 (C-14): the main investor's signed W-9 is hidden from the co-investor (the co-investor sees that one is on file, never the file or the number).

## Orchestrator choices (2026-11-26, research defaults adopted; the owner may override)
- C-02 passkeys later; C-03 investor two-step offered, off by default, an Owner may require it; C-04 workspace held sealed on the server in server mode (last 10 versions), no browser copy there; C-05 no key service now (DATA_KEY in the host's secrets plus a re-seal tool); C-06 backup tool with its own BACKUP_KEY, daily, pruned 7 daily / 4 weekly / 12 monthly, off-site copy, free storage tier offered; C-07 the server serves the portal pages (one origin, __Host- SameSite=Strict cookie); C-08 sessions 60 minutes idle / 12 hours absolute, passwords 10+ for console people and 15+ for investors plus a common-password list; C-09 account tokens for automation only; C-10 Owner and Admin release payments; C-11 accountant access ends after 90 days; C-12 a small firm-branded security page; C-13 security contact address and domain "To be confirmed", no paid penetration test now, SOC 2 not mentioned; C-15 phase 15's server sign-in merges before phase 14's investor-facing server routes; C-16 open sign-up with email confirmation.
- Every false claim on screen the research lists (W-01..W-20: "two-step On", the 6-digit code promise, "Investor login created", the prefilled sample password) is corrected in this phase.
