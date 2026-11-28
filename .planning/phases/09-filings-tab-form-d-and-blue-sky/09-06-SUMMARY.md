---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 06
subsystem: filings
tags: [filings-tab, edgar-access, form-id, delegation, sandboxed-frame, phone]
status: complete

requires:
  - phase: 09-01
    provides: "assets/js/filings.js: rec.edgar, rec.issuer, setEdgar, setIssuer, applies, facts"
  - phase: 09-02
    provides: "assets/js/formd.js: prefill reads rec.edgar.cik and rec.edgar.name for the notice"
  - phase: 09-03
    provides: "assets/js/filings-ui.js: NS.filingsUI.part, the section page under the bar with Back; filings.css fl- classes; checks/lib9.js"
provides:
  - "assets/js/edgar-access.js: part access of the Filings tab, the EDGAR access steps tracker and the Form ID answer sheet"
  - "checks/access-flow.js: ACCESS FLOW, 4 parts"
affects: [09-04, 09-05, 09-09]

actuals:
  tokens: 15034
  tasks: 2
  commits: 5
plan_head_before: 5f5e22b6dc61703b884ced939fa7dbc122bacf2e
plan_head_after: 964f333ae5004e1fbec754b2f600de7e075ab46c

tech-stack:
  added: []
  patterns:
    - "a section with a second page uses the rest of its address (console-filings-access-<id>-sheet) under the same bar"
    - "an answer the record has no place for is kept in NS.state.ui only, never stored"

key-files:
  created:
    - assets/js/edgar-access.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/access-flow.js
  modified: []

key-decisions:
  - "The issuer-already-has-a-CIK path is recorded as steps.existing { done, at } through setEdgar (setEdgar keeps any step key), so filings.js is not edited"
  - "Fiscal year end, the administrators, the billing contact and the applicant name typed on the sheet are kept on screen only: the record has no place for them and no wave 3 plan may edit filings.js (F4)"
  - "Administrators and the billing contact are suggested from the team list, not an invited member and not the '<firm> admin' stand-in the team page makes"
  - "Choices on the dashboard (individual or company, applicant type, non-public drafts, good standing) are shown without Copy; every typed answer has Copy"

requirements-completed: [D-02]

duration: "2h04m wall clock (base recorded 21:14 UTC, last commit 23:18 UTC), much of it waiting in the shared browser queue"
completed: 2026-11-19
---

# Phase 9 Plan 06: EDGAR access for new issuers Summary

The Filings tab gains an EDGAR access line for each Rule 506(b)/506(c) offering ("Step 2 of 7: Form ID", or "Ready to file"). It opens the seven steps an issuer with no EDGAR account takes, each with one or two plain lines from the SEC's own guides, each marked done with its date. The Form ID answer sheet lays out parts 1 to 5 for the sponsor to complete on the SEC dashboard themselves (C-02): nothing claims the portal files Form ID. No sign-in, password, tax number or Social Security number is asked for, stored or shown. The CIK and name entered reach the Form D notice through `NS.formD.prefill`. This is proven inside a sandboxed frame that refuses every connection, at 390x844 with touch and at 1280x800. The managed edition (index.html) is unchanged and never loads the file.

**Not yet checked by the owner.** Nothing here is called done until he has opened it on his iPhone and compared the sheet with the SEC dashboard.

## Failures and open items first

1. **The full gate ended GATE_EXIT=1.** The only failing line is `GATE FAIL REAL FIRM (9)` (phase 6's real-firm.js: the investor footer and the investor's documents after Countersign). This plan did not cause it. Run on an export of the base commit 5f5e22b, the same check prints the same 20 FAIL lines in the same four parts (contact-desktop, contact-phone, documents-desktop, documents-phone) and the same 128 PASS lines. A `diff` of the two FAIL lists, with envelope ids masked, is empty. The check touches no file of this plan. It is out of scope here and needs its own debug task on claude/refract-reskin. Every other reference line, the server test count and all four phase 9 checks passed (quoted below). As a result the plan's verify command exits 1 (`VERIFY_EXIT=1`).
2. **The order of the fields inside each part has been checked against the SEC's Form ID guide only.** The field-by-field Form ID instructions PDF on the filer management site could not be reached. Address, phone and fiscal year end are placed in part 2. The guide names fiscal year end in part 2 but does not say where the address and phone are asked. Only someone signed in to the SEC dashboard can confirm this (the owner's check below).
3. **Not checked against the SEC's site:** an existing filer that is not yet on the new dashboard. The existing-CIK path tells the sponsor in one line that the issuer must first set up account administrators on the SEC's site (F3). It does not walk them through the SEC's "existing EDGAR account" Form ID route (lost access, legal successor). The billing part's fields (name, email, phone) are a best reading of the guide's "identify the individual".
4. **Typed answers that the record has no place for are kept on screen only:** the applicant name if changed, fiscal year end, the administrators and the billing contact. A reload brings back the suggestions, not what was typed. The record (filings.js) has no keys for them, and F4 says no other wave 3 plan edits filings.js. Address, phone, signer name and title, and the single-member answer are saved to the record. Adding keys for the rest is a one-line change to `setEdgar` or `setIssuer` in a later plan, if the owner wants it.
5. Not found on the SEC's site in this run (blocked hosts, see 09-RESEARCH "What could not be established"): the filing agent's own CIK. The delegation step reads it from `window.CVPortalConfig.filingAgent.cik`. Until that is set, the step says the number is sent when the order is reviewed (planner's choice 2).

## The gate (verify command, its last lines verbatim)

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
GATE ok   HELP CHAT (10)
GATE FAIL REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 329
# pass 329
# fail 0
GATE ok   server tests 329 = base 329 + 0 declared
GATE ok   ACCESS FLOW
GATE ok   FILINGS FLOW
GATE ok   FILINGS MATH
GATE ok   FORMD XML
GATE_EXIT=1
VERIFY_EXIT=1
```

`gate/access-flow.txt` ends `ACCESS FLOW: PASS (parts run: 4)`. The gate ran at 7ccae9c and finished at 23:07 UTC, within the limit.

## What was measured

- Task 1 verify (W-8, `verify-1.sh`): `ACCESS FLOW: PASS (parts run: 1)` (31 PASS, 0 FAIL).
- The plan's own full check, run alone before the gate (W-2), at 7ccae9c: `ACCESS FLOW: PASS (parts run: 4)`, 88 PASS, 0 FAIL. The owner's screens were taken after the gate in a separate run (W-7) at 964f333: `ACCESS FLOW: PASS (parts run: 4)`, 88 PASS, 0 FAIL. 964f333 changes only one displayed line (see Deviations 7) and the screenshots' descriptions.
- RED runs (kept in SCRATCH/exec-09-06):
  - red-1.txt (commit 087559e, no edgar-access.js): `FAIL steps-phone the tab shows an EDGAR access line for the offering with how far it is (step 1 of 7)`, `ACCESS FLOW: FAIL (parts run: 1) - steps-phone`.
  - red-2.txt (commit 6cc3fb0, steps without the sheet): 12 FAIL lines, e.g. `FAIL sheet-phone parts 1 to 5 are laid out in the dashboard's order :: []`, `FAIL sheet-phone the cautions are on the sheet once each: ... [["EDGAR shortens company names",0], ...]`; `ACCESS FLOW: FAIL (parts run: 3) - steps-desktop, sheet-phone, sheet-desktop`. The steps-desktop line in it was a fault in the check (it read the oldest change-log entry, not the newest), fixed in 7ccae9c.
  - red-3.txt (the team-list filter taken out): `FAIL sheet-desktop the account administrators and the billing contact are suggested from the team list (not an invited member, not the "<firm> admin" stand-in) ... ["admin1Name=Kestrel Bay admin", ...]`.
  - red-agent.txt (the configured filing agent CIK ignored): `FAIL steps-desktop with the filing agent's CIK configured, the delegation step shows its name inside a data-agent element and that CIK with a copy control :: {"name":"Carrow & Vale","product":"Carrow & Vale","cik":"","copy":false}`. This mutation run proves the check can fail. The code itself was written in Task 1, before its check (see Deviations).
- F8: `NS.formD.prefill(...).draft.primaryIssuer.cik` read in the page equals the CIK entered, on both paths (new issuer `0001234567`, existing `1750`, and `1234567` on the desktop). No input on the section has a name, label or autocomplete matching ssn, social, tax, ein, password, passphrase or one-time code. After every field of the sheet is filled, no new key so named appears anywhere in localStorage or IndexedDB (keys inside stored JSON included), and the filings record holds none at all.
- `git diff --quiet 5f5e22b HEAD -- index.html diy.html portal.html assets/js/filings-ui.js assets/js/filings.js server/help/guide.md` holds: no shared file was edited (W-1: guide.md untouched).

## Tasks

| Task | What | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | On the phone in the frame: the tab's line, the seven steps, a step marked done and kept after a reload, the CIK refused and stored and read by the prefill, an issuer that already has a CIK (F3) | 087559e (RED), 79d3120 |
| 2 | The answer sheet (parts 1 to 5, Copy, the single-member question, the cautions, F8), the delegation step with and without the filing agent's CIK, a team member, the desktop size, the gate | 6cc3fb0 (RED), 7ccae9c, 964f333 (after the gate: one line's wording, the screenshots' descriptions) |

Tracer feedback gate: auto mode. The tracer's verify passed end to end before any expansion.

## New shipped files a preview build must add

- `assets/js/edgar-access.js` (loaded by filings-ui.js from its fixed parts list; no page lists it)

## Deviations from Plan

1. **[Order] The delegation step's filing agent name, CIK and Copy were built in Task 1**, together with the steps. The plan put them in Task 2. Their check (steps-desktop) therefore passed at its first run. The mutation run red-agent.txt shows the check fails without that code.
2. **[Rule 2] The administrators and the billing contact are suggested from the team list.** An invited member and the stand-in "<firm> admin" (which the team page makes for a portal with no team list) are skipped. The sheet says "Filled from your team list". Without this, every sponsor types names the portal already holds.
3. **[Rule 2] An issuer that already has a CIK can be taken back ("Undo" clears the CIK and name entered for it)**, and a step marked done by mistake can be marked not done. Each change is written to the change log.
4. **Dashboard choices are shown without Copy.** These are individual or company, applicant type, non-public drafts and good standing. They are a drop-down or a radio on the dashboard, so there is nothing to paste. Every typed answer has Copy (17 fields).
5. **The page opens at the current step.** The first time the steps page is drawn (not on a redraw), the current step is brought on screen if it is below the fold. This is proven on the phone with five steps done (the delegation step is on screen).
6. **The REAL FIRM failure is recorded here and not in a new `deferred-items.md`.** That avoids an add/add conflict with 09-04 and 09-07, which are built in parallel.
7. **After the gate (964f333):** the screenshot of the existing-CIK path showed "The issuer already has a CIK: CIK 1750". It now reads "The issuer already has CIK 1750 · SECOND FUND LP". The gate ran at 7ccae9c. The plan's own check was run again in full on 964f333 and passed (88 PASS, 0 FAIL). No other gate check loads edgar-access.js: filings-flow answers it 404.

## Known stubs

None. The filing agent's CIK is configuration (`window.CVPortalConfig.filingAgent.cik`), with its intended line until it is set.

## Threat flags

None beyond the register. T-09-19: there is no field for a tax ID, Social Security number, password or passphrase, and the SEC's rule against Social Security numbers is stated once (sheet-desktop proves both). T-09-20: the CIK must be 1 to 10 digits, the name is stored as typed and shown back, and the notice reads both from the record.

## The owner's check (pending)

On the iPhone, in the published preview: Filings, then EDGAR access for an offering. Read the steps, open the Form ID answer sheet and tap Copy on an answer. When he completes Carrow & Vale's own Form ID on the SEC dashboard, he compares the dashboard's fields with the sheet, part by part. Expected: the steps read plainly and in the right order; the sheet's answers match the dashboard's fields in order; Copy either copies or leaves the value selected. The same screens are in SCRATCH/exec-09-06/shots with an index.txt, kept for the orchestrator's walkthrough.

## Self-Check: PASSED

Both created files exist. The five commits 087559e, 79d3120, 6cc3fb0, 7ccae9c and 964f333 are on HEAD (`git rev-list --count 5f5e22b..HEAD` = 5). index.html and every shared file are unchanged since 5f5e22b. The gate's GATE_EXIT=1 comes from REAL FIRM, which fails identically on the base (Failures, item 1).
