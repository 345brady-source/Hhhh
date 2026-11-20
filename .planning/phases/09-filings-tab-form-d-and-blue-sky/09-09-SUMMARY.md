---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 09
subsystem: filings
tags: [form-d, state-notices, filing-server, edgar, link, sandboxed-frame, phone]
status: complete
requires:
  - phase: 09-04
    provides: "assets/js/formd-ui.js (the signed-off notice entry under its order)"
  - phase: 09-05
    provides: "server/lib/filings.mjs (/v1/filings, orders, status, staff calls)"
  - phase: 09-07
    provides: "assets/js/bluesky.js (placeOrder, recordResult)"
provides:
  - "assets/js/filings-remote.js: NS.filingsUI.link = { connected, orderLine, send, check }"
  - "checks/filings-server.js: FILINGS SERVER, 7 parts"
affects: [09-10]
tech-stack:
  added: []
  patterns:
    - "a server answer is applied only when it reads as known statuses, an accession number of the SEC's form and a real date"
key-files:
  created:
    - assets/js/filings-remote.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-server.js
  modified: []
key-decisions:
  - "connected(ws) is true when a server address is set and its filings call has not answered off (404 or on:false); while unknown or unreachable, Send stays offered and its own failure is the one line"
  - "A state order with some states filed reads filed while the server still holds it as received"
  - "The filing system's fee paid is read from the server's line (the status answer carries no systemFeeCents)"
requirements-completed: [D-02, D-03]
completed: 2026-11-20
plan_head_before: d12a501
actuals:
  tokens: 16600
  tasks: 3
---

# Phase 9 Plan 09: the Filings tab's link to the filing server Summary

An admin sends a signed-off Form D order (or a state notice order with its package) from the Filings tab to the server
the portal is connected to; what staff record there comes back with Check now (and once when the tab opens): received,
test passed, suspended with EDGAR's messages as text and the way to correct, filed with its accession number, date and the
next annual amendment date; per-state results with date, filing ID, fee paid and renewal. Proven against the real server
code in the check's own process (invented tokens, invented CCCs, no outside call), at 390x844 touch and 1280x800, and the
no-connection case inside the sandboxed frame.

**Not yet checked by the owner. No EDGAR upload of any kind happened: staff outcomes were recorded with the outcome call
on a local server; a real TEST upload by a Carrow & Vale person is still unproven (needs the owner's EDGAR access).**

## Failures and open items first

GATE_PENDING

## RED runs (kept in SCRATCH/exec-09-09)

red-1.txt (before filings-remote.js existed):
```
FAIL send-phone the tab shows the order with a Send control
FAIL send-phone no notice about connecting the portal is shown :: Sending an order to be filed needs the portal connected to its server.
FAIL send-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.
FILINGS SERVER: FAIL (parts run: 1) - send-phone
```
red-2.txt (on Task 1's code; send-desktop already passed, and in offline-framed only one check failed, on the check's own pattern for Chrome's console wording, fixed before the code):
```
FAIL outcome after Check now the tab shows the notice filed, with its accession number and date :: Received by the filing team.
FAIL outcome the offering's record holds the notice as accepted, with its date, accession number and a snapshot :: [{"id":"fd-check-1","status":"ordered",...
FAIL suspended after Check now the tab says the test was suspended and shows both messages as plain text (angle brackets as text) :: {"line":"Received by the fi...
FAIL guard with another portal's key the tab says the order could not be found, and nothing changes :: {"wrong":"The server could not say where the order stands...
FILINGS SERVER: FAIL (parts run: 5) - outcome, suspended, guard, offline-framed
```
(10 FAIL lines in all.) red-3.txt (on Task 2's code; a first run, red-3-first.txt, stopped earlier on a check bug: the page was not redrawn after the order was placed):
```
FAIL states after Check now the record shows both states filed with date, filing ID and fee paid :: {"NY":{"status":"ordered","filedOn":"",...
FAIL states New York's renewal reminder appears with its date; no state is still to file :: [{"kind":"formd-first",...
FAIL states the tab shows the renewal reminder with its date, the order done and both states filed :: {"line":"Filed.",...
FAIL states the State filings section shows each state with its date, filing ID and fee paid :: Back
FILINGS SERVER: FAIL (parts run: 1) - states
```

## Verify lines

- Task 1 (verify-1.sh): `FILINGS SERVER: PASS (parts run: 1)`, VERIFY1_EXIT=0
- Task 2 (verify-2.sh): `FILINGS SERVER: PASS (parts run: 6)`, VERIFY2_EXIT=0
- The full check alone before the gate: `FILINGS SERVER: PASS (parts run: 7)` (98 PASS, 0 FAIL)
- CCC scan (scan-ccc.mjs over every output, the shipped file, the check and this summary): `CCC SCAN: 21 files, 0 holding a CCC`

GATE_LINES

## Commits

9d77ff3 (RED 1), d3b864b (Task 1), 5f773c5 (RED 2), e283ed4 (Task 2), 9899de7 (RED 3), 8a3d77f (Task 3), and this summary.

## Deviations

1. connected() is not "last answered on" literally: an unknown or unreachable server keeps Send on offer so the failure is said in one line under the order (inside the frame the tab otherwise showed two lines). A 404 or on:false makes it false (W3).
2. In offline-framed the tab's own probe and Send each make one refused connection; the check asserts every policy report is a refused connection to the server's address and that Send added one.
3. The check's pinned clock is 15:00 UTC on the latest business day on or before the run's day (not one fixed date), so the page's today and the server's agree on any run day; filedOn uses that day (B1's reason, EDGAR's hours, does not apply to the outcome path).
4. A cancelled order leaves the tab's order list (filings-ui.js filters it, not edited here); it reads Cancelled on its Form D section and in storage.
5. Staff state lines from the server keep the portal's state names; the filing system's fee comes from the server's line.
6. The masked fixture's draft has no entityName (EDGAR fills it for a CIK); the check's first run expected one (check mistake, fixed).

## New shipped file a preview build must add

- `assets/js/filings-remote.js` (loaded by filings-ui.js from beside itself)

No shared file edited; STATE.md, ROADMAP.md, server/help/guide.md untouched.

## Owner check (pending)

Screens in SCRATCH/exec-09-09/shots with index.txt: before sending, received, test passed, suspended, filed, offline, states. In the iPhone preview (no server) the tab shows its one line about connecting.
