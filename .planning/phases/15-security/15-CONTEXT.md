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

## After planning (2026-11-26; 20 plans, 9 waves; ROADMAP 765ce23, c3a157a)
- Owner decisions (2026-11-26): D-04 an investor's own bank account change (after a fresh sign-in) is held: the new account gets a pre-note and the sponsor confirms before money goes there; investor (old address) and sponsor are both notified. The plan that builds investor bank changes applies this, replacing the planner's "no hold" choice; phase 16's pre-note rules (C-03) apply on top. D-05 the QR library qrcode-generator 2.0.4 (MIT) is allowed, pinned to that exact version and file hash, checked into the repo, never fetched at run time (15-19).
- Orchestrator choices (owner may reverse): integrity hashes on outside library loads (W-07) added later, outside intake.js's protected sections (D-33); ADMIN_TOKEN (operator) keeps no expiry for now, recorded as an open item for bring-to-market hosting; the planner's other choices kept (billing and filing records stay after a closed portal is deleted; CORS never allows credentials; backups on the operator's timer; cookie name and flags by whether PUBLIC_URL is https).
- For counsel ("To be confirmed" on screen): the disclosure page's promise and its numbers (3 business days, 90 days), anything relying on the Safeguards Rule or Regulation S-P. Security contact address and domain wait for the owner at 15-11.

## Plan-check additions, wave 1 (15-01, 15-02, 15-03, 15-12, 15-13; checked 2026-11-26 against c0c683a; 4 blockers fixed here, 7 warnings). Executors apply these with their plan. Findings: scratchpad checks-15-wave1.md.
- B1 (15-02): gate15.sh sets GATE_FRESH=1 with a note when GATE_OUT/gate/base-commit.txt differs from GATE_OUT/base-commit.txt (before the cp); self-test stays 9; Task 3 verify greps for GATE_FRESH=1.
- B2 (15-01 Task 3, 15-03 Task 3): the verify starts with `rm -f $O/gate.txt;` and ends the pre-gate chain with `|| exit 1;` before `mkdir -p $O/gate`, so a stale gate.txt can never pass it.
- B3 (15-12, 15-03): auditlog entries keep dh = sha256 of the sealed plaintext (which carries a 16-byte random salt) and the chain hashes dh, not the box; list/exportAll check box against dh; tamper adds a swapped valid box. 15-03 adds the convention `audit:<workspace>:<seq>` and its reseal test proves an auditlog chain still verifies after reseal.
- B4 (15-13): script-src includes 'wasm-unsafe-eval' (never 'unsafe-eval'), so the reader's WebAssembly runs on served pages; the headers test asserts both.
- W1 (15-01): the JSON + Origin rule applies to every POST under /v1/auth/, cookie or not; csrf test adds a foreign text/plain sign-in refused with no Set-Cookie. W2: password.check uses timingSafeEqual (verify greps it). W3: 'Wait 1 second and try again.' for 1. W4: the setup-session-on-invitations assertion lives in auth-gate only (or Task 2 wires the stage refusal).
- W5 (15-12): roles.js exports DEFAULT_PAGES (read by the check) and has rows for the books (11-13) and report-builder (12-06) view keys with the Accountant 'read'.
- W6 (15-06): its gate run adds a browser check of the served portal (Chromium, WebKit; e-sign preview and a document read) with 0 securitypolicyviolation events. W7: 15-05 also waits for 15-02 (it runs gate15.sh).

## After 15-13 (merged 2026-11-26)
- server/lib/pages.mjs merged (fixed file list, O_NOFOLLOW, security headers incl. CORP same-site and HSTS on https, CSP with 'wasm-unsafe-eval' and never 'unsafe-eval', security.txt builder, /health warnings); 7 tests; not mounted until 15-06. Server tests 444 on the merged tree, all pass; GATE_SERVER_TESTS=444 from here.
- Chromium loaded the served portal.html under the policy with 0 violations at load; not yet run: e-sign preview, a document read, WebKit. 15-06's gate must run them (W6).
- Open: the policy is built at server start (a page edited on disk needs a restart); esign.js's jsdelivr font fallback is refused by connect-src 'self' (only used if the shipped font fails); `CVPortalConfig.signInServer` is injected but read by no page yet (a later sign-in plan reads it).

## After 15-12 (merged 2026-11-26)
- assets/js/roles.js, server/lib/roles.mjs, server/lib/auditlog.mjs merged; 12 tests; ROLES TABLE check 3 cases. Server tests 456 on the merged tree, all pass; GATE_SERVER_TESTS=456 from here.
- Change log entry: dh = SHA-256 of the sealed plaintext JSON { s (16 random bytes), personName, record, detail }; chain hash = sha256(JSON [prev, workspace, seq, at, personId, action, dh]); additional data audit:<workspace>:<seq>; id aud_<workspace>_<seq>. A reseal leaves the chain intact (15-03 proves it).
- DEFAULT_PAGES exported (empty: all 21 menu pages have explicit rows). console-books has the Accountant on 'read'; the report builder is a tab inside console-reports (Accountant 'read'; 12-06's own can('operate') decides the tab). Extra rows console-offering (as Offerings) and console-envelope (as E-sign).
- When 11-13 and 12-06 merge, rerun ROLES TABLE on the merged tree.

## After 15-01 (merged 2026-11-27)
- Server sign-up, sign-in, sign-out, password rules (scrypt N=2^15 r=8 p=3, 260 ms here; timingSafeEqual; 9,126-entry common-password list in assets/vendor/pwlist/), waits and locks (same answer for unknown emails; one password check at a time per email), address limits, purge, sessions at the sponsor gate; the open server closes once anyone signs up. 16 tests; server tests 472 on the merged tree, all pass; GATE_SERVER_TESTS=472 from here. Gate (gate13.sh with every phase) GATE_EXIT=0 on its fourth run (first run: disk at 100%, every browser step crashed; two reruns hit the time limit waiting for browser slots).
- Interface facts for later plans: people.create is async; sessions.clear(), limits.keys(), purge, cookieName, optional `accounts` argument to createAuth; sessions have endedAt (purged a day after sign-out); index.mjs's error handler sends e.body when a thrown error carries one; sentence 'Fill in every field.'; an investor whose firm requires two-step but has none starts at 'setup'; email sealed as typed, index lower-cased; people indexed under DATA_KEY_PREVIOUS still sign in and are re-indexed.
- Open for later plans: 15-18 must let cors() pass the server's own origin when PORTAL_ORIGIN is set (otherwise a portal served by this server cannot sign in); 15-03's reseal tool must recompute every person's emailIndex; POST /v1/invite/login answers 404 until 15-04; ADMIN_TOKEN expiry (recorded).
- 08-08 also edits server/index.mjs (separate hunks): it merges second and re-runs its gate on the merged tree.

## Plan-check additions, wave 2 (15-04, 15-05; checked 2026-11-27 against 45e1783; 3 blockers fixed here, 4 warnings). Executors apply these with their plan. Findings: scratchpad checks-15-wave2.md.
- B1 (15-05 Task 3): the verify starts with `rm -f $O/gate.txt;` and ends the pre-gate chain with `|| exit 1;` before `mkdir -p $O/gate`.
- B2 (15-04): the email lookup derives index keys from DATA_KEY then each comma-separated DATA_KEY_PREVIOUS entry (15-03's list form), never from vault.keyIds (ids, not keys); "key change" also passes with DATA_KEY_PREVIOUS 'X,A'.
- B3 (15-05): starts only when 15-02, 15-03, 08-08, 08-09 and 10-11 are merged (index.mjs, invitations.mjs, README, gate15.sh). 15-04 starts when 15-02 is merged.
- W1 (15-05): prefix lines match only an exact path or prefix + '/'; the walker stand-in proves '/v1/invitations/zzz' is not covered by a '/v1/invite' line. W2: for an account token the C-09 rule applies when its own workspace has an active team person (shared API_TOKEN: signin.required()); test that another firm's token still reaches GET /v1/billing. W3 (15-04, 15-05): POST /v1/invite/login and POST /v1/team/accept get the JSON + own-Origin rule; foreign text/plain refused 403 with no Set-Cookie. W4 (15-05): the gate grep allows `( \(kept from [^)]*\))?$`.
- The second of 15-04/15-05 to merge reruns the suite on the merged tree (base + 23). cors() own-origin stays 15-18's.

## Orchestrator decision (2026-11-27): no WebKit in this container
- 15-02's frame check failed only because WebKit is not installed here (Playwright 1.63.0 has Chromium only; WebKit would also need about ten missing system libraries via apt, and the environment says not to run `playwright install`). Choice (Option B): Chromium with the iPhone profile stands in, as phase 6 did. Every phase 15 check that names WebKit runs its Chromium iPhone-profile part, prints one line "NOTE WebKit not installed here: the owner's iPhone check covers <what>", and its `// last` marker counts only the parts that run here. Plans 15-07, 15-09, 15-10, 15-11, 15-16, 15-18, 15-19 and 15-20 apply the same rule.
- 15-11 (the owner's checkpoint) adds to its iPhone list: two-step set-up and sign-in codes in Safari (WebCrypto present in the preview frame), and the TOTP fallback.
- Why not install: the environment forbids reinstalling Playwright browsers here and the extra system libraries are not present; the owner's iPhone is the real WebKit and is checked anyway.

## After 15-03 (merged 2026-11-27)
- DATA_KEY_PREVIOUS takes a comma list (a wrong entry named by position, never value); sealed values carry their additional data ("a" field, refused if it differs); the store holds <file>.lock and flushes a pending write on exit, SIGTERM and SIGINT; tools/reseal.mjs (all or nothing, refuses while a server holds the store, recomputes each person's emailIndex exactly as auth.mjs, covers audit:<ws>:<seq> and rooms:<id>:sealed); tools/backup.mjs (create, verify, restore into an empty folder only, prune 7d/4w/12m; a blob removed mid-read stops create with a sentence and no archive); README "Keys and backups". 10 tests; server tests 494 on the merged tree, all pass; GATE_SERVER_TESTS=494. Gate (gate13.sh, every phase) GATE_EXIT=0 on run 4 (run 1 crashed seven browser steps under load; time limits).
- Open: auth.mjs reads DATA_KEY_PREVIOUS as one string, so with a comma list only the first entry is used and between a rotation and the reseal a person indexed under an older previous key cannot sign in: 15-04 fixes it (wave 2 B2: lookup keys from DATA_KEY then each comma entry; test with DATA_KEY_PREVIOUS='X,A'). store.mjs exits right after flushing on SIGTERM: a later graceful-shutdown handler in index.mjs must be combined with it. A full disk at exit loses the pending change (as before). server/README.md "basic-auth" in Security notes (pre-existing wording; reword when next edited). Restore drill on the merged tree: 15-11, then the owner.

## After 15-02 (merged 2026-11-27)
- assets/js/totp.js (RFC 6238 Appendix B and RFC 4226 Appendix D values exact; WebCrypto and the preview's own HMAC fallback) and gate15.sh (self-test 9; base-change rule; empty phase folders print "none in this tree") merged; 8 tests; server tests 502 on the merged tree. Gate GATE_EXIT=0 on 5b0146f (earlier runs: TOTP FRAME failed only for the missing WebKit; EMAIL DIALOG and CO-INVESTOR SERVER failed under load before their check fixes merged).
- totp-frame.js per the WebKit decision: Chromium parts use phase 6's iPhone profile; "NOTE WebKit not installed here: the owner's iPhone check covers WebCrypto and the fallback in the frame"; marker counts 2 parts here (4 with WebKit). A planted hotp bug is caught by both Chromium parts.
- Measured note: gate steps are kept per HEAD, so a commit between runs reruns every step.
- 15-04 and 15-05 start now (their wave 2 additions in this file).

## Plan-check additions, wave 3 (15-06, 15-14), checked against 392bbbc, 2026-11-27
Binding on the executors (full text: scratchpad checks-15-wave3.md).
- B1 (15-06 Task 3 verify): start with `rm -f $O/gate.txt;`; add `|| exit 1;` after the `git diff --quiet ... index.html` step, before `mkdir -p $O/gate`.
- B2 (15-14 Task 3 verify): same; `|| exit 1;` after `git diff --quiet ... server/index.mjs server/lib/mail.mjs`.
- B3 (15-06): add `.planning/phases/15-security/checks/served-portal.js` (`// gate: browser`) to 15-06's files and Task 3: server with SERVE_PORTAL=1 loads portal.html, opens the e-sign preview, reads one document, 0 securitypolicyviolation events; two parts (Chromium desktop, Chromium with phase 6's iPhone profile); prints "NOTE WebKit not installed here: the owner's iPhone check covers the served portal under the policy (e-sign preview, document read)"; marker `// last "...: PASS (parts run: 2)"`; RED with a planted policy missing 'wasm-unsafe-eval'; Task 3 gate grep adds `^GATE ok +<NAME>`.
- B4 (D-04, the owner's decision; no plan held it):
  - (a) 15-14: `notify` takes an explicit recipient list; `bankChanged` goes to the investor's address as stored before the save (also when the same save changes the email); a sponsor variant goes to the Owner and Admins: "<firm>: an investor's bank account was changed, confirm it before paying". Last four digits only. Covered by the kinds and guard tests.
  - (b) 15-15, before wave 4: "no hold for review" is removed. An account the investor changes is stored as pending; no payment uses it; the pre-note follows phase 16's C-03; it applies only after a person with the pay permission confirms with a fresh sign-in; a test proves a payment run is held until then. The wave 4 plan check checks this.
- W1 (15-14 Task 2): also run server/test/emails-kinds.test.mjs (13-11) in Task 2's verify.
- W2 (15-14 frontmatter): requirements [SE-01, SE-02, SE-04, SE-05, SE-14].
- W3 (15-14), orchestrator's choice: firms signed up before 15-14 (confirmedAt '') are offered the confirmation resend from sign-in and from `me`; a test with such a firm proves it can confirm and then invite.
- I7 recorded: an Owner or Admin changing an investor's bank account with a fresh sign-in is the firm's own confirmation; phase 16's pre-note rule still applies.
- Start: 15-06 when 15-04 and 15-05 are merged (fresh pull) and no plan editing server/index.mjs or server/README.md runs (13-03, 13-04, 14-08). 15-14 also after 13-01, 13-11 and 13-03 merge, while no plan edits emails.js or invitations.mjs.

## After 15-05 (merged e703292, 2026-11-27)
- Gate GATE_EXIT=0 on run 2 (run 1 hit the 2-hour limit with every finished step passing). Plan tree 514 = 502 + 12. Merged tree 521 of 521 (509 + 12).
- Every server request goes through ROUTES (server/lib/roles.mjs): lines `{ method, path | prefix | source, who: team|investor|link|public|operator, permission, tokens, reason? }`, a flat frozen array extended by adding lines only. A path the table does not name answers 404 for every caller; when several lines match, all must allow it. The walk test fails on any route in index.mjs or a lib module with no line.
- Deviations: reading a verification, evidence or screening needs 'personal'; listing investors' sign-ins 'personal'; GET /v1/team floor 'view' with 'team' checked inside team.mjs; invite/resend floor 'operate', 'team' inside. guard/guardInvestor come from createGuards({signin, store, now, routes}). An Accountant without a valid end date is treated as ended. Two existing tests changed: billing.test (unknown billing path now 404) and backup.test (sign-up/sign-in now write the change log: chain counts 3 and 4).
- For 14-08: lines for the unmounted inbox.mjs and dataroom.mjs are already in ROUTES (team reads 'personal', writes 'operate', tokens false; investor /v1/my-inbox*; link prefix /v1/room). 14-08 checks them, does not add them again.
- For phase 16: payment-release routes add team lines with permission 'pay'. For 13-03: its routes add lines (13 wave 2 B1).
- Open: sign-up collects no phone, so the README's Owner-reset procedure calls a number already held for the firm; 15-04's /v1/auth/* routes are covered by the public prefix line with role checks in auth.mjs; 15-04 merges second and reruns the suite (expected 521 + 11 = 532).
- Merged-tree reruns of server-backed browser checks and the gate15 self-test: running.

## After 15-04 (merged 2026-11-27, after 13-01)
- Gate GATE_EXIT=0 on run 2 (run 1 hit the 2-hour limit at 36 ok, 0 FAIL). Plan tree 513 = 502 + 11. Merged tree 544 of 544 (after 15-05 521, 13-01 +12 = 533, 15-04 +11).
- Wave 2 checks applied: B2 (email lookup keys from DATA_KEY then each comma entry of DATA_KEY_PREVIOUS; 'X,A' and ' X , A ' tested); W3 (invite/login refuses foreign-Origin or non-JSON posts 403 with no Set-Cookie).
- Deviations: deny by default on /v1/auth/ for half-done sign-ins (401 'stage'); confirm ends every session; two-step/off ends others; the fresh window counts from the password; invite/login has its own per-address limit, answers 201; people records carry `invitationId`; a malformed code is 400 and not counted.
- Open: POST /v1/auth/password is 404 until 15-14; with PORTAL_ORIGIN set a served portal cannot call invite/login until 15-18; an invitation made with the shared token for a workspace with no record gives an investor sign-in with no firm rule and an empty issuer (for 15-06/15-14 to close). Four guide lines in 15-04-SUMMARY for GUIDE-PASS once the screens exist.
- Wave 3 can start: 15-06 now (fresh pull; 13-03/13-04/14-08 not running). 15-14 after 13-11 and 13-03.
