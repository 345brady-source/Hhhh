---
phase: 13-email-overhaul
plan: 12
subsystem: console / Integrations page
status: complete
tags: [email, dkim, dmarc, integrations, white-label, phone]
requires: ["13-03 (GET/PUT /v1/mail/sender, POST /v1/mail/sender/check, note screen 422)", "13-05 (lib13.js serverConsole, framedConsole)"]
provides: ["Email sending section (EM-06, C-01, C-11)", "NS.integrations.api for 13-06, 13-08, 13-09", "checks/email-sending.js EMAIL SENDING (7 parts)"]
affects: ["13-10 (owner's live check; guide line for this section)", "13-06, 13-08, 13-09 (use NS.integrations.api)"]
tech-stack:
  added: []
  patterns: ["section state in pageState().mail; load once per server address; every server value drawn through h()"]
key-files:
  created: [.planning/phases/13-email-overhaul/checks/email-sending.js]
  modified: [assets/js/integrations.js]
decisions:
  - "Check releases the waiting emails: shown plainly with one hint while not Ready ('Once the status is Ready, Check releases them.') and one line after a check that released any ('N waiting email(s) released for sending.')"
  - "The check runs the console with a sponsor account token: only a server with sponsor accounts holds mail (13-03); a single-sponsor server sends from MAIL_FROM"
metrics:
  completed: 2026-11-27
  tasks: 3
estimate:
  tokens: 80000
actuals:
  tokens: 10150
  tasks: 3
  commits: 8
plan_head_before: 75b2fc5e6d774cdbd74370c34b8c7e445b6b8415
plan_head_after: 34db30da
---

# Phase 13 Plan 12: Email sending section Summary

The self-serve console's Integrations page now has an "Email sending" section: From address (suggested as notices@ the firm's domain), Set up, the DNS records (type, name, value, each with Copy), Check, a plain status (Not set up / Waiting for DNS records / Ready / the server's own sentence when a record is wrong), "Until then, emails wait on your integration server and are not sent." while not Ready, and "Live sending: To be confirmed" until the server reports live. NS.integrations.api is exported. Nothing here is called working before the owner's live check at 13-10.

## Failures and open items (first)

1. **Gate run 1 stopped at the 2-hour background limit** (shared machine) during the phase 08 checks, with 42 GATE ok and 0 GATE FAIL. Rerun into the same folder: every passed step kept, the rest ran, GATE_EXIT=0.
2. **The "Until then" line is true only on a server with sponsor accounts.** 13-03's mailer holds a workspace's mail only when the server has sponsor accounts (a signed-up firm has one). A single-sponsor server (shared API_TOKEN, no accounts) sends from MAIL_FROM while the domain is not Ready. GET /v1/mail/sender does not say which kind of server it is, so the screen cannot tell the two apart. My first RED run showed this: with the shared token the invitation went out ("emailStatus":"sent"). The check now uses a sponsor account token, which is the real self-serve setup. A fix needs a server field (for example `holds: true` on the sender answer). That is a server change, which this plan is not allowed to make, so it is queued for the orchestrator.
3. **RED-2 partly passed before its code.** setup-phone, bad-address, live and managed-same already passed on Task 1's code. Only noserver and api-export failed. Both are quoted below.
4. **Words beyond the plan's list.** At the orchestrator's instruction (show plainly that Check releases held mail), the section adds 'Once the status is Ready, Check releases them.' and 'N waiting email(s) released for sending.'. It also adds a reachability sentence, 'The integration server could not be reached.', used when no reply came. Copy's fallback reuses the existing 'Selected: copy it from the menu.'. The plan forbids guide edits, so the guide line for this section goes to 13-10, and the guide must name these words.
5. **Not owner-checked.** Live sending stays "To be confirmed" until the owner's account run (13-10). Everything here ran against stand-ins.
6. STATE.md and ROADMAP.md were not updated (parallel wave; the orchestrator merges them).

## RED evidence (as produced)

red-1.txt (Task 1, before the code):
```
PASS setup-desktop an invitation made before the address is set up is held, and nothing reaches the relay
FAIL setup-desktop ran to the end :: page.waitForSelector: Timeout 20000ms exceeded.
  - waiting for locator('#iv-mail') to be visible
EMAIL SENDING: FAIL (parts run: 1) - setup-desktop
```
red-2.txt (Task 2, before the code):
```
FAIL noserver without a server the section is its heading and one line: "Sending from your own domain needs your integration server." :: null
FAIL api-export NS.integrations.api is exported
FAIL api-export a note holding 000-12-3456: api rejects with the server's 422 sentence ("Remove the taxpayer number: emails never carry tax numbers."), not a status number :: {"message":"NS.integrations.api is not a function"}
FAIL api-export a note holding 991234567890: api rejects with the server's 422 sentence ("Remove the long number: emails never carry account or tax numbers."), not a status number :: {"message":"NS.integrations.api is not a function"}
EMAIL SENDING: FAIL (parts run: 6) - noserver, api-export
```

## Verify lines

- Task 1 tracer: `EMAIL SENDING: PASS (parts run: 1)` (24 PASS, 0 FAIL)
- Task 2: `NOTE WebKit not installed here: the phone parts run in Chromium with the iPhone profile; the owner's iPhone check covers Safari` then `EMAIL SENDING: PASS (parts run: 7)` (68 PASS, 0 FAIL)
- Task 3: `git diff --quiet 75b2fc5 HEAD -- assets/js/console.js assets/js/onboarding.js index.html diy.html portal.html server` → unchanged

## Gate (GATE13_PHASES="08", base 75b2fc5), last lines verbatim

```
GATE ok   server tests 584 = base 584 + 0 declared
GATE ok   AML RECORD (7) (kept from 2026-11-27 16:29:10 UTC)
GATE ok   MONITORING (9) (kept from 2026-11-27 16:31:22 UTC)
GATE ok   PACKAGE CONSOLE (7) (kept from 2026-11-27 16:32:37 UTC)
GATE ok   PACKAGE FLOW (10) (kept from 2026-11-27 16:36:36 UTC)
GATE ok   PACKAGE INVITE (12) (kept from 2026-11-27 16:38:31 UTC)
GATE ok   PACKAGE NAMES (4) (kept from 2026-11-27 16:39:11 UTC)
GATE ok   PACKAGE PANEL (7)
GATE ok   REVERIFY (9)
GATE ok   SMALL FIXES (2)
GATE ok   EMAIL SENDING
GATE ok   EMAILS PARITY
GATE ok   INVITE MAIL
GATE_EXIT=0
```
REAL FIRM (9) ok. The run had 53 GATE ok lines and 0 GATE FAIL. Server tests: 584 of 584 pass (base 584 + 0; this plan adds no server test).

## What the check proves (checks/email-sending.js, 7 parts)

- **setup-desktop** (1280x800, account token, provider and relay stand-ins): an invitation made before setup is held. The From address is suggested as notices@kestrelbaycap.com. Set up gives a DKIM TXT row and a DMARC TXT row, drawn exactly as the server holds them, each with Copy. The status reads "Waiting for DNS records" and the "Until then" line shows. With FAILED at the provider, Check shows the server's sentence. With SUCCESS, Check shows "Ready", the "Until then" line goes away, "Live sending: To be confirmed" stays, and "1 waiting email released for sending." appears; the relay stand-in receives the invitation from notices@harborridge.example. White label: the section, the whole page and the server's sentences pass BANNED.concat([/anthropic/i, /claude/i]), the vendor lists and the forbidden word, with record names and values cut out first (W8, W9). T-13-27: a record value holding `<img onerror>` and a sentence holding `<b>` are drawn as text.
- **setup-phone** (390x844, touch, Chromium with the iPhone profile): every name, value and Copy button sits inside the screen, values wrap, and the page has no horizontal overflow. Tapping Copy puts the DKIM value on the clipboard (read back) and says "Copied". Check then shows Ready. A way out is on screen at the top, middle and end.
- **bad-address**: 'not an address' shows the server's sentence ("Enter an email address such as notices@yourfirm.com.") under the field, with aria-invalid and focus back on the field. The status stays "Not set up", no record is drawn, the server has no sender and the provider got no call.
- **live** (MAIL_LIVE=1, ready sender): the status is "Ready", and the page shows no "To be confirmed" and no "Until then" line.
- **noserver** (sandboxed frame, phone): the section is its heading plus "Sending from your own domain needs your integration server.", with no controls, zero requests and zero policy refusals.
- **api-export** (B4, B5): `NS.integrations.api(ws, 'POST', '/v1/invitations', …)` with a note holding 000-12-3456, and again with 991234567890, rejects with screen()'s sentence: status 422, server true, and no "422" in the message. Nothing is stored.
- **managed-same**: index.html's #console-integrations text equals the base tree's byte for byte, and the managed page has no section.

## NS.integrations.api interface (for 13-06, 13-08, 13-09)

```
NS.integrations.api(ws, method, path, body?) → Promise<JSON answer>
  calls serverUrl(ws) + path with the console's access token (Bearer), JSON body when given
  on a non-OK answer rejects with Error:
    message = the server's own sentence (data.error) when it gave one; else
              'The integration server did not accept the access token.' (401) or 'The integration server answered N.'
    err.status (HTTP status), err.code (data.code or ''), err.server (true when the message is the server's)
  a network failure rejects with the browser's TypeError (no err.status)
```

## Deviations from Plan

1. **[Rule 1/2: honesty] The check uses a sponsor account token** (ADMIN_TOKEN, POST /v1/admin/accounts) instead of the shared token. On the shared token, 13-03's server sends rather than holds, which would have made the C-11 line false in the test. See open item 2.
2. **[Orchestrator instruction] Check-releases wording** added (open item 4). The audit log records "Email sending address set up" and "Email sending checked" (with the released count).
3. Commits: the code went in through save commits (save rules), so the feat/test commits after them carry the messages and are empty markers.

## Known Stubs

None. Live sending is intentionally "To be confirmed" (C-01) until 13-10.

## Threat Flags

None. No new endpoint, and every server value is drawn through the page's escaping.

## Self-Check: PASSED

- FOUND assets/js/integrations.js (mailPanel, ms-* actions, NS.integrations.api)
- FOUND .planning/phases/13-email-overhaul/checks/email-sending.js
- FOUND commits 901ec7c, d569388, 31af3cd, 08fc591, 64e6a82, 8095f9f, 25bc522, 34db30d
