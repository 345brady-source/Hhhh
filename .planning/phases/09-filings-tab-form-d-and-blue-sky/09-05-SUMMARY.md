---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 05
subsystem: filings
tags: [form-d, edgar, ccc, live-guard, staff-calls, sponsor-accounts, state-notices, server]
requires:
  - phase: 09-filings-tab-form-d-and-blue-sky
    provides: "09-01: assets/js/filings.js (PRICES, orderLines, holidays); 09-02: assets/js/formd.js (validate, toXml, fromXml, LISTS) and the pinned SEC schema"
  - phase: 08-verification-package-and-ongoing-compliance
    provides: "08-01: sponsor accounts (a token per sponsor, sponsorAuth's { account }, /v1/admin/accounts)"
provides:
  - "server/lib/filings.mjs: createFilings({ env, store, vault, mailer, limited, now, accounts, transport }) → { handle(req, res, url, auth), staff(req, res, url) }"
  - "server/filing/edgar.mjs: makeEdgar({ transport, env, now, holidays }) → { allowLive, submit, status, openAt, filingDay }, staffTransport, recordedTransport (code only)"
  - "/v1/filings (portal: API_TOKEN or a sponsor account's token) and /v1/filings/staff (FILINGS_STAFF_TOKEN only)"
  - "server/test/fixtures/edgar: seven recorded replies, hand-made from the SEC's API overview and marked unconfirmed"
  - "server/README.md: the Filings section and two security notes"
affects: [09-08, 09-09]
tech-stack:
  added: []
  patterns:
    - "the server rebuilds the Form D file from the stored answers with the same rule table the browser uses, never a browser-built file"
    - "a credential (the CCC) is opened in exactly one function and leaves the server in exactly one answer, proven by searching every other answer, the store, the outbox and recorded console lines"
key-files:
  created:
    - server/lib/filings.mjs
    - server/filing/edgar.mjs
    - server/test/filings.test.mjs
    - server/test/filings-edgar.test.mjs
    - server/test/filings-kit.mjs
    - server/test/fixtures/edgar/ (seven .json replies)
  modified:
    - server/index.mjs (4 lines)
    - server/lib/store.mjs (1 line)
    - server/README.md (Filings section, 2 security notes)
key-decisions:
  - "One CCC per issuer (E1): the server always passes ccc to validate and toXml as a map by CIK from the sealed filingIssuers records; the file and submit calls answer 409 naming each CIK with no CCC"
  - "The staff file call is the only answer that carries a CCC; it answers 403 to any request with Origin or Sec-Fetch-Mode, sends Cache-Control: no-store and an attachment, and writes filing_file_downloaded { order, mode } with no CCC (E2)"
  - "Orders are pinned to the sponsor account (E3): with an account's token the workspace is the account's whatever the body says, and another account's order answers 404 even with its key"
  - "FILINGS_STAFF_TOKEN must be at least 24 characters and differ from API_TOKEN, ADMIN_TOKEN, RESULTS_TOKEN, every account token and every invitation token, or the module reports itself off with the reason"
  - "A CCC needs DATA_KEY in every mode (also under NODE_ENV=test): it is never stored in plain form"
  - "State notice orders: the service line at its price, each state's fee and the filing system's fee as pass-through lines with no amount until staff record what was paid; the order is done when every state is filed and every fee is known"
  - "Staff cancel with { cancelled: true } on the outcome call, only for an order nothing was filed for (added; not in the interfaces block)"
requirements-completed: [D-02, D-03, D-05]
status: complete
duration: "17:20Z to 20:10Z, 2026-11-19 (both agents, including two full gate runs)"
completed: 2026-11-19
plan_head_before: f76e3f500ceb215ec728c8e3367250c4fa07ff5c
plan_head_after: 218fa06370651f29b8cd651a35a4908a759f2fb1
commits: 4
actuals:
  tokens: 36000
  tasks: 3
  commits: 4
---

# Phase 9 Plan 05: the filings server side Summary

**A Form D or state notice order placed from a portal is checked again on the server, emailed to staff and worked with a staff-only token; the server rebuilds the Form D file with one sealed CCC per issuer, makes the TEST file before any LIVE one, and refuses LIVE unless EDGAR_ALLOW_LIVE=1 outside tests. No filing of any kind was made; the transport in tests is a recorded stand-in.**

## Failures first

1. **The first full gate run ended GATE_EXIT=1** on two browser steps that the plan's files cannot reach: `GATE FAIL MEASURE` (walkC's entity walk produced 0 PASS, 0 FAIL after 938 s) and `GATE FAIL signing: no FAIL the base lacks` (signing-step at 390 px stuck at "Distribution payments", 60 PASS / 2 FAIL against the base's 75 / 0). This plan changes only files under server/ (the signing check serves the static pages with python's http.server and never starts the Node server). Both steps were run again alone on the same tree: `signing: 75 PASS / 0 FAIL` and `PASS walkC (85 s): individual: 17 PASS, 0 FAIL, RESULT: PASS; entity: 17 PASS, 0 FAIL, RESULT: PASS` / `MEASURE: PASS`. The full gate was then run a second time on the same tree and ended `GATE_EXIT=0` (below). Outputs: SCRATCH/exec-09-05/gate-run1.txt, owner-run1.txt, signing-plan-run1.txt, rerun/.
2. **RED for Task 2b was partial:** of the 10 tests added in 2b, 6 failed before the 2b code (red-2b.txt: `# pass 5`, `# fail 6`, the tracer included); the other 4 (`pinned:` staff calls take only the staff token, `keys:`, `off:`, `orders:` lines worked out by the server) already passed on Task 1 and 2a's code. Those 4 are covered by the broken-rule runs instead (mutations-2b.txt: 42 of 42 caught).
3. **EDGAR's acceptance of a real TEST upload is not proven.** That is the owner's first step once Carrow & Vale's EDGAR access exists, by the README's staff procedure. The recorded replies are hand-made from the SEC's overview (22 December 2025) and marked unconfirmed until plan 09-08 records real Beta replies.
4. **The hosting question (planner's choice 1) is open for the owner:** orders go to the server the portal is connected to, and the module is on only where FILINGS=1 (servers Carrow & Vale runs). A sponsor running their own server cannot order filings through it; that would need a separate filing address, which is not planned.

## What was built

- **Task 1 (tracer, commit 28deea9, earlier agent):** one Form D order end to end: received (201, $100 line), emailed to the staff address with no CCC and no investor's or related person's name, listed and opened by staff, the issuer's CCC sealed, TEST through the recorded transport (test_passed), read back by the portal with its key, LIVE refused with the reason. RED: red-1.txt (`# fail 1`).
- **Task 2a (commit 7767454, earlier agent):** the staff file call (the stored notice rebuilt, each issuer's CCC under its own CIK, each issuer's EDGAR name in the signature block, the filer contact, testOrLive), validated by xmllint against the pinned schema; 409 naming each CIK with no CCC; the live guard in every case (unset, NODE_ENV=test, allowed outside tests with the recorded route, TEST before LIVE, live outcomes, accession and date checks, EDGAR_TRANSPORT other than staff); EDGAR's hours in winter and summer time; the CCC proven to leave only in the staff file and the transport's text (every other answer, the store, the outbox and console lines searched, including a run outside tests with a transport that throws); 403 to Origin or Sec-Fetch-Mode. 16 tests in filings-edgar.test.mjs, 14 RED before the code (red-2.txt); 28 of 28 broken-rule runs caught.
- **Task 2b (commit 7370e1e, finished and committed by this agent from the earlier agent's uncommitted files):** orders pinned to the sponsor account; the staff token refused when it is any other token of the server or short; the module off outside tests with no API_TOKEN and no account; one order per clientId and key with one email, 409 for another key or kind; a corrected notice returns the order to review and LIVE waits for a test of the new notice; state notice orders (bluesky $100, bluesky-renewal $50) with the package sealed, pass-through lines with no amount, per-state results recorded by staff and returned to the portal, unknown state codes and future dates refused; staff cancel; the staff email in no sponsor's outbox listing. 10 tests added to filings.test.mjs (11 with the tracer).
- **Task 3 (commit 218fa06, this agent):** server/README.md "## Filings" after "Sponsor accounts", with its own settings table, every call with its token, the seven-step Form D procedure, state notices by hand, EDGAR's hours, what is sealed; two security notes at the end of the notes list.

## Verify and gate lines (verbatim)

Task 1 verify (earlier agent, tracer.txt): `# fail 0`.

Task 2 verify with E5's checks (this agent, on this worktree):

```
# tests 27
# suites 0
# pass 27
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 910.900466
VERIFY2_OK
```

Test names by E5 prefix: 9 `guard:` (filings-edgar 8, filings 1), 3 `ccc:`, 3 `pinned:`, 1 `issuers:`, plus `recorded:` 2, `staff file:` 1, `hours:` 1, `tracer:` 1, `keys:` 1, `off:` 1, `orders:` 3, `states:` 1.

Server test count: **255 = base 227 + 28 declared**. The 28 are this plan's 27 top-level tests (filings.test.mjs 11, filings-edgar.test.mjs 16) plus 1 for server/test/filings-kit.mjs, which `node --test` runs as a file of its own (as it does helpers.mjs) and which carries the marker `// gate: tests 1`.

Gate run 1 (SCRATCH/exec-09-05/gate-run1.txt):

```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE FAIL MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE FAIL signing: no FAIL the base lacks
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
GATE ok   server tests 255 = base 227 + 28 declared
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=1
```

Gate run 2 (the same tree, SCRATCH/exec-09-05/gate.txt; Task 3's verify printed `VERIFY3_OK`):

```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
GATE ok   server tests 255 = base 227 + 28 declared
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=0
```

## Lines added to the shared files

server/index.mjs (4 lines, as E6 asks):

```
import { createFilings } from './lib/filings.mjs';
  const filings = createFilings({ env, store, vault: invites.vault, mailer: invites.mailer, limited, now, accounts, transport: opts.edgarTransport });
    if (/^\/v1\/filings\/staff(\/|$)/.test(path)) return filings.staff(req, res, url);
    if (/^\/v1\/filings(\/|$)/.test(path)) return filings.handle(req, res, url, auth);
```

(the import after `createAccounts`'s import; `createFilings` after `accounts`; the staff line right after the `/v1/admin` line; the portal line just before `invites.sponsor`.)

server/lib/store.mjs (1 line, after the file is read):

```
  data.filings = data.filings || {}; data.filingIssuers = data.filingIssuers || {};
```

server/README.md: a new "## Filings" section between "## Sponsor accounts" and "## Data protection", and two bullets at the end of the "## Security notes" list (after the Invitations bullet, before "Before production").

## Deviations from Plan

1. **[Rule 2] Staff token strength:** FILINGS_STAFF_TOKEN shorter than 24 characters leaves the module off; it opens the only answer that carries a CCC.
2. **[Rule 2] DATA_KEY for a CCC in every mode:** the issuer call answers 400 without DATA_KEY even under NODE_ENV=test (the plan said "outside tests"); a CCC is never stored in plain form anywhere. Tests set an invented DATA_KEY.
3. **[Rule 2] Staff cancel:** `{ cancelled: true }` on the outcome call cancels an order nothing was filed for; without it a wrong order could not be closed. Documented in the README.
4. **[Rule 2] State packages are kept as plain data** with any key named like ccc, token, secret or password dropped, and at most 500 entries per list.
5. **filings-kit.mjs** (a shared helper for the two test files, not in the plan's file list) carries `// gate: tests 1` because the test runner counts it as one test.
6. **Continuation:** the earlier agent stopped on a usage limit with Task 2b written, green (27 of 27) and mutation-tested but uncommitted; this agent reset to its branch, copied the three files, re-ran the verify, committed 2b, wrote Task 3 and ran the gate. The trailer of the two earlier commits names Fable 5.2; the last two name Opus 5.5.

## Threat surface

No surface outside the plan's threat register: the new addresses are the ones the plan names, behind the tokens the register gives. T-09-12 to T-09-18 are each covered by a named test and by the broken-rule runs (70 in all, 70 caught).

## Owner check

Nothing here is ready until the owner has checked it. What the owner can check now: the README's Filings section reads as a procedure staff can follow. What needs EDGAR access first: a real TEST upload of a server-built file.

## Self-Check: PASSED

- FOUND: server/lib/filings.mjs, server/filing/edgar.mjs, server/test/filings.test.mjs, server/test/filings-edgar.test.mjs, server/test/filings-kit.mjs, server/test/fixtures/edgar/ (7 files)
- FOUND in HEAD's history: 28deea9, 7767454, 7370e1e, 218fa06
- No invented test CCC appears in this summary or the README; STATE.md and ROADMAP.md untouched (AUTOPILOT.md)
