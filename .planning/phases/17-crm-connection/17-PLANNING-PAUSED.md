# Phase 17 planning: paused (2026-11-27, owner's indefinite pause)

The planner was stopped by the owner's pause before any PLAN file was finished. Nothing below is a plan; it is the outline the
next planner starts from. No 17-NN-PLAN.md file exists and none was committed.

## Status
- Done (written, committed): none.
- Not started: every plan below (17-01 to 17-07).
- Read before the pause: 17-CONTEXT.md (D-01..D-05, C-01..C-06), 17-RESEARCH.md in full, AUTOPILOT.md, 16-01-PLAN.md (the plan
  and gate shape to copy), 16-CONTEXT.md, 15-CONTEXT.md, 13-CONTEXT.md (plan-check additions), ROADMAP phases 15-17,
  server/lib/roles.mjs (ROUTES), the createServer section of server/index.mjs.
- Server test count: NOT measured. A run on ca037ed was stopped part-way by the pause (no count). The last count recorded in
  the CONTEXT files is 605 (merged tree after 16-02 / 13-07). The next planner measures the base on its own start commit and
  states each plan's exact addition.
- At the pause no build could start anyway: 15-17 and 15-08 are not merged (no SUMMARY), and phase 16's 16-07..16-14 are not
  merged (D-01: build starts only after phase 16's plans are merged).

## Waits for every plan (frontmatter and ROADMAP text)
- Every plan: 15-17 merged (the console saves to the server; before it the server holds no investors: research 7.1, Pitfall 4).
- Every plan: every phase 16 plan merged (D-01), finished before step 12.
- Console plans (17-04, 17-05, 17-06, 17-07's walk): also 15-08 merged.
- A plan editing server/index.mjs (17-01, possibly 17-03): never beside 15-18.
- C-06: whichever of 15-20 and phase 17's server plan (17-03) merges second adds the CRM collections (crm, crmlinks, crmlog)
  to 15-20's purge list (closing.mjs), with a test.
- Soft: 15-14 (C-04, the Owner's notice when a CRM is connected; until it merges the change-log entry is the record).

## Outline of the remaining plans (research 7.2 plus the owner's D-03, D-04, D-05)

17-01 (wave 1) Server core and the phase gate. CRM-01, CRM-02, CRM-03 (server side), CRM-13, CRM-16.
- .planning/phases/17-crm-connection/checks/gate17.sh: gate16.sh's shape (gate-lib.sh resumable steps, base-commit rule with
  GATE_FRESH=1, the reference gate copied with its folder and output lines rewritten, the server count = measured base +
  declared "// gate: tests N" markers, phase 17 checks by marker, GATE17_PHASES for other phases' folders, --only-phase17,
  --self-test on stand-ins); no independent-reader step (phase 16's only). checks/lib17.js (helpers, never-issued fixtures).
- server/test/hubspot-fake.mjs (research 5.1: HTTPS on 127.0.0.1, keys/scopes, 401/403, contacts one per email with 409,
  deals, properties, pipelines, search with lagMs, fail injection, requests with Authorization redacted, validation, markup).
- server/crm/index.mjs (adapter registry), server/crm/hubspot.mjs (VERSION '2026-03', ASSUMED table, no /crm/v3/ path,
  check, ensureProperties incl. the D-03 contact opt-out property (scope crm.schemas.contacts.write), pipelines, errorOf to
  fixed sentences), server/lib/crm.mjs (GET /v1/crm, PUT and DELETE /v1/crm/connection with configure + fresh sign-in,
  GET /v1/crm/pipelines, PUT /v1/crm/settings; key sealed crm:<workspace>:key, refused without DATA_KEY; view() never holds
  the key; change log "CRM connected" account id only), ROUTES lines (team, tokens false, research 3.9), one mounting line in
  index.mjs, base URL override only through a createServer option, redirect 'manual'.
- Tests: crm-connect.test.mjs (connect, missing-scope sentence, properties created, role and fresh refusals, key grep over
  replies, store, blobs, console output; disconnect deletes), crm-roles.test.mjs (route walk, tokens refused, cross-workspace
  404). README "CRM" section (C-05: "Access key" field; scopes; what is sent and never sent).

17-02 (wave 2) The allow-list and the first sync of contacts and deals. CRM-04, CRM-05, CRM-07, CRM-08, CRM-09.
- assets/js/crm-map.js (UMD like roles.js; loaded by the server with createRequire): records(ws, invitations, settings) and
  stageOf(); allow-list only (name, email, phone if given, offering, commitment amount, stage, portal_ref, D-03 opt-out flag).
- D-05: co-investors (second holders and co-signers) become contacts too, matched by email, the same fixed fields, each
  associated with the same deal as the main investor (read coinvestor.js and invitations.mjs cosign records first).
- Reconcile for contacts (link, read by email, PATCH or POST, 409 = found) and deals (upsert by portal_ref, association),
  write-on-change against a sealed snapshot (crmlinks), never blanking a CRM phone, nothing written back, mailprefs never
  written by the CRM module (D-03: the opt-out goes to the CRM property only; never the CRM's "unsubscribe from all").
- Tests: crm-sync.test.mjs (first part), crm-fields.test.mjs (planted taxpayer, bank, routing, ID, accreditation, address,
  birth date, tax form, KYC and notes values absent from every request body, fields compared by keys, never a whole-text
  scan over random ids or tokens); checks/crm-map.js (Node).

17-03 (wave 3) Triggers, retries, the sync log, removals. CRM-06, CRM-10, CRM-11 (and CRM-03's "nothing before Start").
- Triggers: after a successful PUT /v1/workspace (workspace.mjs success path), after an invitation status or step change
  (invitations.mjs), hourly unref'd timer, POST /v1/crm/sync; coalescing touch, one run per workspace, one request at a time.
- Retries and backoff (429 Retry-After, 5xx, timeouts, resets), 401/403 stop with "Needs attention", crmlog sealed person
  parts, CRM_LOG_DAYS, GET /v1/crm/log ('personal'); 404 = "Removed in your CRM", relink; Cancelled mapping; stages never
  backwards; POST /v1/crm/forget; the C-06 purge line if 15-20 merged first.
- Tests: crm-sync.test.mjs (second part).

17-04 (wave 4) D-04's CSV export for any CRM. CRM-07 (file side), plus D-04 itself (no CRM-nn in the research; the planner
adds a requirement id, e.g. CRM-18, defined in its plan, as 16-07 did for AC-16).
- The exact same fixed field list from crm-map.js (names, emails, offerings, amounts, stages, the opt-out flag); never any
  taxpayer, bank, ID, address or accreditation data; the same roles and change-log rules as the sync.
- A check proving no sensitive field is ever in the file (planted values on a workspace, the file's columns compared by name
  and every cell by exact value, never a whole-text scan over random ids).
- Open for the resuming planner: where the button lives (Integrations CRM panel vs Investors page; file overlap with 17-05
  and console.js) and how it works in the no-server preview (download through the existing in-page file path; the change-log
  entry in the console's own log there).

17-05 (wave 4 or 5) The CRM panel on Integrations. CRM-01, CRM-03, CRM-11 (console side), CRM-14, CRM-15.
- crmPanel like mailPanel: connect with the "Access key" field, the connected account shown, pipeline and stage map with a
  suggested map, Start syncing, Needs attention, the sync log, Link again, Disconnect, Forget; D-03's one line about excluding
  opted-out contacts; "Live connection: To be confirmed"; the investor-facing privacy sentence "To be confirmed with counsel"
  (C-03). "HubSpot" only inside this panel (D-02).
- No server: one line, zero requests, zero policy refusals (sandboxed frame). 390x844 touch through Chromium's iPhone profile
  with "NOTE WebKit not installed here: ..." and 1280x800; a way out on screen; no horizontal overflow.
- White label: emails.js BANNED gains /hubspot/i (research CRM-14); vendor scans BANNED.concat(MODEL_NAMES) with
  [/anthropic/i, /claude/i] after stripLinkTokens, JSON by keysDeep. Guide lines within the 48,000-byte cap (measure first;
  overflow to .planning/GUIDE-PASS.md). checks/crm-console.js through SCRATCH/exec-011/heavy.sh.

17-06 (wave 4 or 5) The lead picker and inviting a lead. CRM-12.
- GET /v1/crm/leads ('personal'; C-02: lifecycle stage Lead, text search, 50 per page, linked contacts left out); "Choose from
  your CRM" in the invite dialog when a connection is live; fills name and email; Send needs 'operate' as today;
  crmContactId on the invitation; linked on the next run; deal at Invited; the search-lag line; markup drawn as text; no
  button without a server. Tests: crm-leads.test.mjs; the leads part of crm-console.js.
- 17-05 and 17-06 run in one wave only if they share no file (integrations.js, invitations.js, the guide); else 17-06 after 17-05.

17-07 (last wave, not autonomous) Proof and the owner's checkpoint. CRM-14, CRM-15, CRM-17.
- Reference gate lines for phase 17's checks, the full gate on the merged tree, a local server run transcript against the
  stand-in pasted for the owner, the preview built; the owner's path walked at phone size (connect, map, start, an investor
  moving Invited to Funded, a co-investor, the opt-out, the CSV export, a lead invited), written failures first.
- Checkpoint (checkpoint:human-verify, blocking): the owner's iPhone check, then CRM-17's live run on a free HubSpot account
  first (C-01), every item of research 5.4, the key pasted by the owner into his own server (never given to an agent). Until it
  passes the panel says "Live connection: To be confirmed".

## Requirements coverage in this outline
CRM-01 17-01/17-05 · CRM-02 17-01 · CRM-03 17-01/17-03/17-05 · CRM-04 17-02 · CRM-05 17-02 · CRM-06 17-03 · CRM-07 17-02/17-04 ·
CRM-08 17-02 · CRM-09 17-02 · CRM-10 17-03 · CRM-11 17-03/17-05 · CRM-12 17-06 · CRM-13 17-01 · CRM-14 17-05/17-07 ·
CRM-15 17-05/17-07 · CRM-16 17-01 · CRM-17 17-07 · D-03 17-01/17-02/17-05 · D-04 17-04 · D-05 17-02.

## Rules carried into every plan when written
`rm -f $O/gate.txt;` first in the final verify; `|| exit 1` after each pre-gate check; named RED greps (a RED file counts only
when it fails a named part); the measured base server count with the exact declared addition; never-issued fixtures
('000-12-3456', '00-1234567', accounts starting 99, routing 9 digits starting 19, example.com addresses, 555-01xx phones);
no whole-text scans over random ids or tokens; the forbidden word never written; trailer lines exactly as AUTOPILOT.md.
