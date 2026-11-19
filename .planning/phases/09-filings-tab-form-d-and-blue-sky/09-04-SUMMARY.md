---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 04
subsystem: filings
tags: [form-d, amendment, sign-off, orders, filings-tab, sandboxed-frame, phone]
status: complete

requires:
  - phase: 09-01
    provides: "assets/js/filings.js (facts, due, rec, setIssuer, setEdgar, addOrder, orderLines, PRICES)"
  - phase: 09-02
    provides: "assets/js/formd.js (prefill, validate, toXml, fromXml, snapshot, LISTS, blank), the pinned SEC schema and the masked filed notices"
  - phase: 09-03
    provides: "assets/js/filings-ui.js (NS.filingsUI.part, refresh, link), assets/css/filings.css, checks/lib9.js"
provides:
  - "assets/js/formd-ui.js: the part formd of the Filings tab (form by item, one message per field, review, sign-off, order, amendment)"
  - "checks/formd-flow.js: FORMD FLOW, 6 parts"
affects: [09-06, 09-07, 09-09]

actuals:
  tokens: 24257
  tasks: 3
  commits: 6
plan_head_before: 5f5e22b6dc61703b884ced939fa7dbc122bacf2e
plan_head_after: 0f413ae271ad86409444edb4e06aa12c1a33749d

tech-stack:
  added: []
  patterns:
    - "the notice on screen is the stored draft with the portal's figures laid over every pre-filled field the sponsor has not changed (entry.touched)"
    - "a signed-off entry is never edited: a change is made on a copy that names it (replaces) and keeps its order"

key-files:
  created:
    - assets/js/formd-ui.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/formd-flow.js
  modified: []

key-decisions:
  - "The order is recorded at sign-off (planner's choice 1); a corrected copy signed off later keeps the order of the notice it replaces, so no second $100 is recorded"
  - "Review shows one message per field; where the schema and an EDGAR rule both speak of one field, the EDGAR rule's sentence (F2)"
  - "Issuer answers Form ID also needs (address, phone, entity type, year, previous names, signer) are written to the offering's record through setIssuer, the CIK and EDGAR name through setEdgar; a stored draft follows them at once"
  - "An Investment Company Act Section 3(c) exclusion can be ticked in Item 6 for a pooled investment fund; the Rule 506 code itself always comes from the offering"
  - "Amounts typed with $ or commas are stored as digits only; Indefinite is accepted where the form allows it"

requirements-completed: [D-02, D-05]

completed: 2026-11-19
---

# Phase 9 Plan 04: Form D on screen Summary

The Form D section of the Filings tab: the notice by item, pre-filled from the offering and its investors (every figure from `NS.filings.facts`), each pre-filled value saying where it came from; what EDGAR would refuse listed in plain words, one sentence per field, each naming its item with a link to it; the whole notice reviewed on the page; the admin's sign-off under the SEC's Terms of Submission; the order recorded with "$100 due" (a Form D) or "$50 due" (an amendment), nothing charged and nothing filed; an amendment started from the last filed notice (the portal's own, or the file or pasted text of one filed elsewhere). Proven inside the sandboxed frame that refuses every connection, at 390x844 with touch and at 1280x800. The managed edition (index.html) is unchanged.

**Not yet checked by the owner.** Nothing here is called done until he has opened it on his iPhone. The sign-off sentence needs his lawyer (below).

## Failures and open items first

1. **The full gate ended `GATE_EXIT=1`, on one reference step this plan cannot reach: `GATE FAIL REAL FIRM (9)`.** The same check fails identically on the untouched base commit 5f5e22b: run on a clean copy of 5f5e22b and on this plan's tree, both end `REAL FIRM: FAIL (parts run: 9) - contact-desktop, contact-phone, documents-desktop, documents-phone`, with the same 20 FAIL lines and 128 PASS lines each (the investor's footer shows more than the check expects; after Approve and Countersign the investor holds no position). This plan adds two files and changes none; its section loads only when the Filings tab opens, which REAL FIRM never does. It needs its own fix on the base branch (not done here: out of this plan's scope). Every other step of the gate passed, including the four phase 9 checks. The verify command's last test (`GATE_EXIT=0`) therefore fails; its two other tests hold.
2. **Two checks failed for reasons in the check, not the page, and were corrected before the code they cover was judged:** amend-phone's first RED run stopped on a check bug (it called `NS.formD` before the tab had loaded formd.js); it was fixed (the filed notice is now read in Node) and run again on the Task 2 code, where it failed as intended (red-3b.txt). The first full run then failed both amend parts on one comparison: the masked fixture's amount sold happens to equal the seeded $500,000, so "today's figure differs from the file's" compared two equal numbers; the check now compares the investor count (file 2, offering 3). Every other value in those two failures was right.
3. **The RED parts of Task 2 and Task 3 were written ahead and first committed with the Task 1 code (62c4af3)**, not in a commit of their own; each was still run and seen failing on the code before its feature (red-2.txt on 62c4af3, red-3.txt and red-3b.txt on ce2ea09) before that feature was written into the tree.
4. **For the owner's lawyer:** `SIGNOFF_SENTENCE` in assets/js/formd-ui.js, the portal's own one sentence under the SEC's Terms of Submission ("I am authorized by each issuer named in this notice to sign it on the issuer's behalf, and I authorize its filing with the SEC as shown above."), is a placeholder for counsel's wording, kept in that one constant. Also for counsel, research assumption A4: whether Rule 302 of Regulation S-T asks the issuer to keep a manually signed page for this typed signature. Neither was settled here.
5. **Not proven until Carrow & Vale has EDGAR filing access:** that EDGAR accepts a notice built from this screen (a TEST upload); the checks prove the file against the SEC's own schema with xmllint, not against EDGAR.
6. **Left as built:** a notice read from a file with additional issuers keeps them and shows their CIKs without an editor (planner's choice 3); their signature rows are kept as read, with their dates cleared and set to the sign-off day.

## The gate (verbatim, verify-3)

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
GATE ok   FILINGS FLOW
GATE ok   FILINGS MATH
GATE ok   FORMD FLOW
GATE ok   FORMD XML
GATE_EXIT=1
VERIFY3_EXIT=1
```

The phase 9 checks inside the gate: `FORMD FLOW: PASS (parts run: 6)`, `FILINGS FLOW: PASS (parts run: 9)`.

## What was measured

- Task 1 verify (verify-1.sh): `FORMD FLOW: PASS (parts run: 1)`, `VERIFY1_EXIT=0`.
- Task 2 verify (verify-2.sh): `FORMD FLOW: PASS (parts run: 4)`, `VERIFY2_EXIT=0`.
- The full check alone before the gate (W-2): `FORMD FLOW: PASS (parts run: 6)`, 136 PASS, 0 FAIL.
- The owner's screens run after the gate (W-7): `FORMD FLOW: PASS (parts run: 6)`, 136 PASS, 0 FAIL; twelve screens and index.txt in SCRATCH/exec-09-04/shots, kept for the orchestrator's walkthrough.
- RED runs, kept in SCRATCH/exec-09-04:
  - red-1.txt (before formd-ui.js existed): `FAIL order-phone the offering shows a Form D line on the tab, and it opens the Form D section`, `FORMD FLOW: FAIL (parts run: 1) - order-phone`.
  - red-2.txt (on 62c4af3): 8 FAIL lines, among them `FAIL errors-phone F2: one message for the street line, the P.O. box sentence (EDGAR's rule), although it is also too long` (the plain validate list showed both "longer than 40 characters" and the P.O. box sentence for street1), the dollar line missing, and no link to the EDGAR access section; `FORMD FLOW: FAIL (parts run: 3) - errors-phone, errors-desktop`.
  - red-3.txt and red-3b.txt (on ce2ea09): `FAIL amend-desktop F1: the Form D line carries the action: "Amendment needed: Start"` and `FAIL amend-phone F1: the Form D line carries the action: "Amendment due Dec 4, 2026: Start"` (the line said "Start").
- F7: every pre-filled figure (amount sold, investors, non-accredited count, total offering amount, minimum, date of first sale) equals the `NS.filings.facts` value read in the page; the seeded sale that is approved and not funded counts (3 investors, $500,000).
- The file built in the page from each signed notice (TEST, an invented CCC and contact) validates with xmllint against `server/test/fixtures/formd/schema/formDSubmission.xsd.xml`: the Form D at both sizes and the D/A at both sizes.
- W-3: a reload half way through the form keeps the typed street, related person and relationship; a reload after Review shows the same review; Back is on screen at the top, middle and end of every view checked.
- `git diff --quiet 5f5e22b HEAD -- index.html` holds; the plan changes exactly two files, both new.

## What was built

- **assets/js/formd-ui.js** (new, registered as part `formd`, order 10): the summary line under each Rule 506 offering ("Due <date>: Start", "Draft saved: Continue", "Signed off: $100 due", "Filed on <date>", and F1's "Amendment due <date>: Start" or "Amendment needed: Start"); the section page by item 1 to 16 and the signature; Review at `console-filings-formd-<id>-review`; the signed view with the order and the one line "Sending it to be filed needs the portal connected to its server."; the amendment start. It edits no shared file, uses the cs- and fl- classes that exist, makes no network call, opens no window and no PDF viewer, and is loaded only by filings-ui.js (self-serve edition).
- **checks/formd-flow.js** (new): FORMD FLOW, six parts; its first two lines are gate9.sh's markers.

## Task commits

| Task | What | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | The pre-filled form completed by touch in the frame, Review, sign-off, the $100 order, xmllint | 484fd3b (RED), 62c4af3 |
| 2 | One message per field (F2), the dollar line, the CIK link; lists, exemption, team member, angle brackets, F6 | ce2ea09 |
| 3 | The amendment (F1, portal's notice, file, pasted text), the six-part marker | ea7fb2c (RED), f268c19 |
| after the gate | Three more screenshots for the owner (no assertion changed) | 0f413ae |

## Deviations from Plan

1. **[Plan-check F1]** The amendment's action is on the Form D line under the offering, not on the reminder row (filings-ui.js is not edited).
2. **[Plan-check F6]** The draft entry also holds `touched` (fields the sponsor changed, never pre-filled again) and `replaces` (the signed entry a copy was made from). A copy signed off later keeps the order of the entry it replaces, so a correction never records a second $100.
3. **[Rule 2] Investment Company Act exclusions:** for a pooled investment fund, Item 6 offers the Section 3(c) paragraphs as boxes to tick; without them a fund relying on 3(c)(1) or 3(c)(7) could not state it, and an amendment read from a filed notice would have dropped it. The Rule 506 code still comes only from the offering.
4. **[Rule 2] A stored draft follows the record at once:** when a field kept on the offering's record (address, CIK, signer) is changed, the stored draft is changed with it, so a cleared value cannot come back from an older draft.
5. **[Rule 2]** Amounts typed with "$", commas or spaces are stored as digits only.
6. **The CIK link** appears when the EDGAR access section's script has loaded (`script[src$="/edgar-access.js"]` is on the page), since filings-ui.js keeps its registry private; the check proves it with a stand-in section on the desktop and its absence on the phone.
7. **The import shows one hint:** "EDGAR lists it with the filed notice as primary_doc.xml."
8. **Planner's choice 1 kept:** the order is recorded at sign-off.

## Shared files

None edited. server/help/guide.md is untouched (W-1). STATE.md and ROADMAP.md untouched.

## New shipped files a preview build must add

- `assets/js/formd-ui.js`
- `assets/js/formd.js` (from 09-02; first loaded by a page through this section)

Both are loaded by filings-ui.js from beside itself, so they must sit in `assets/js/` next to it.

## Known stubs

None. `NS.filingsUI.link` stays null until plan 09-09; until then the signed view shows its one-line notice, which is the intended behaviour.

## Threat flags

None beyond the plan's register: T-09-09 (the sign-off is drawn and accepted only with `NS.app.can('configure')`; errors-desktop proves a team member fills the form and sees no sign-off; the signoff record holds by, name, title and time), T-09-10 (every value through `h`; a related person named `<b>Ann</b>` is shown as text; imports go only through `NS.formD.fromXml`, which refused an invoice file and pasted minutes in one sentence each), T-09-11 (a signed entry stays byte-identical when changes are made; proven in errors-desktop).

## The owner's check (pending)

On the iPhone, in the published preview: Filings, then the Form D line of an offering with accepted subscriptions; complete what is missing, tap Review, sign off. Then start an amendment on an offering with a filed notice. Expected: what the portal knows is filled in and right for the offering; every message reads plainly and points to its item; the review shows the whole notice; the order shows $100 (or $50) due; nothing asks for more than the form needs. The same screens are in SCRATCH/exec-09-04/shots with an index.

## Duration

21:11 to 23:40 UTC wall clock, much of it waiting in the shared browser queue; the gate itself ran 22:43 to 23:29.

## Self-Check: PASSED

- FOUND: assets/js/formd-ui.js, .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/formd-flow.js
- FOUND on HEAD: 484fd3b, 62c4af3, ce2ea09, ea7fb2c, f268c19, 0f413ae (`git log 5f5e22b..HEAD` lists the six)
- index.html unchanged since 5f5e22b; server/node_modules link removed by the gate; the gate's base tree, checks-out and shots removed; the REAL FIRM comparison copies removed. The gate's last line is `GATE_EXIT=1` (see Failures, item 1).
