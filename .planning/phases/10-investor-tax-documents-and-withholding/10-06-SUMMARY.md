---
phase: 10-investor-tax-documents-and-withholding
plan: 06
subsystem: tax document delivery and the investor's consent (self-serve)
status: complete
tags: [k-1, delivery, consent, rev-proc-2012-17, opens, paper, amended]
requires: [10-02, 10-03, 10-04]
provides:
  - "Tax documents page: Contact for tax documents, Deliver with the list of recipients, each row's state, available-until date and opens, Notice (Copy, Email), Notice came back, Withdraw (admins), Send on paper with Mark sent on paper, the 'replaces' tick box, the Form 8805 line"
  - "assets/js/taxdocs-investor.js: the consent block at the top of Documents (documentsTop) and the documentOpened hook (records the open, shows the date it leaves the portal)"
  - "NS.taxdocs (C-09 block): replaceEarlier, expire(ws, today), opened on a replaced document, lists().replaced and lists().withdrawn, withdrawConsent where 'portal' fills withdrawalConfirmed"
  - "checks/taxdocs-flow.js: 14 parts; checks/taxdocs-math.js: case replaced (11 cases)"
affects: [10-10, 10-11, 10-12, 10-13]
tech-stack:
  added: []
  patterns: ["a hook portal.js runs where an uploaded document opens (documentOpened)", "row forms opened one at a time under a document's row"]
key-files:
  created:
    - assets/js/taxdocs-investor.js
    - .planning/phases/10-investor-tax-documents-and-withholding/10-06-SUMMARY.md
  modified:
    - assets/js/taxdocs-ui.js
    - assets/js/taxdocs.js
    - assets/js/portal.js
    - assets/js/data.js
    - assets/js/onboarding.js
    - server/help/guide.md
    - server/lib/help-guide.mjs
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-flow.js
    - .planning/phases/10-investor-tax-documents-and-withholding/checks/taxdocs-math.js
decisions:
  - "A replaced document's title gains ' (replaced)', so the investor's Documents row reads Replaced without another edit to portal.js"
  - "The consent block is shown only once the firm's contact is complete (the disclosure must name it); Deliver is refused with one line until then"
  - "Opens and consent are recorded only when the person is signed in as the investor (a sponsor's preview never records)"
  - "Notices go by the sponsor's own email (how 'own email') while no server is connected; with NS.taxUI.link connected, how is 'email' and link.send is called for each delivered document"
metrics:
  completed: 2026-11-20
  tasks: 3
estimate:
  tokens: 108000
  tasks: 3
actuals:
  tokens: 19400     # chars/4 over the added lines since 6061fce in the plan's files, help-guide.mjs (generated) left out
  tasks: 3
  commits: 8        # git rev-list --count --first-parent 6061fce..dc3ea63: 6 plan commits, 1 merge, 1 summary draft; this final summary is the 9th
plan_head_before: 6061fce0b5d43bced41eb84c3c7c6375d1d97f27
plan_head_after: dc3ea63
---

# Phase 10 Plan 06: delivery and consent Summary

A confirmed K-1 now reaches its one investor in the portal. Deliver first lists who receives what. An investor who has not consented sees only that a tax document is waiting, and the sponsor sees them on the send-on-paper list. The consent is separate, optional, shows the eight disclosures with the firm's contact, and can be withdrawn and given again. Opens are counted on the sponsor's row. An amended K-1 sits beside the earlier one, marked Replaced, until the earlier one's access period ends (C-09). Everything is measured in the sandboxed frame only, on files built from the IRS's blank 2025 form with invented partners. **The owner has not checked any of it yet.**

## Failures and open points first

- **The phase gate ended `GATE_EXIT=1`.** Three reference steps failed:
  - **STATUS FLOW (lean): caused by this plan.** Its record of onboarding screen items (P6/checks/onboarding-items.json) still held the old words of the welcome tick box. The record was updated in dc3ea63, and `status-flow.js --only lean` then gave `STATUS FLOW: PASS (parts run: 1)`.
  - **FORM MAPS:** `pdftotext failed on .../scratchpad/exec-06-10/filled/W-9-llc-partnership.pdf`, a shared scratch file. Run alone on this tree afterwards it gave `FORM MAPS: PASS (forms run: 3)`.
  - **MEASURE:** walkA ran 900 s with no output while it waited in the shared browser queue; walkB and walkC passed. Run alone afterwards: `PASS walkA (58 s): individual: 13 PASS, 0 FAIL, RESULT: PASS` and `MEASURE: PASS`.
  - The gate was not run a second time: it takes more than two hours on this machine, and each failed step has been rerun alone and passed. The orchestrator's gate on the merged tree is the full proof.

- **RED could not be shown on this tree for three behaviours, so it was shown another way:**
  - deliver-desktop passed in its first run (red-2.txt). Its screens were built in the tracer commit before the part was written.
  - nocdn passed on its first run on this tree. Nothing in the path loads from outside. Its RED (red-3.txt) is the same part run on a copy of the base tree (6061fce), where it fails.
- **One check of mine was wrong at first:** in red-2 the welcome-step check read the managed edition's sentence (onboarding.js line 473, inside a C-03 slice), which is the first match in the file. It now reads the self-serve step (after `id="ivf-consent"`) and also checks that the managed sentence is unchanged. Math case replaced first reused page 1 for two packages; it now uses a second import.
- **Unconfirmed:** a CPA or counsel has not read the consent wording; the delivery rule for Form 8805 was not read (the page says to ask the CPA).
- **Needs the server (plan 10-12):** an investor on another device, and the notice sent as an email by the portal.
- **The sponsor guide's text grew 580 bytes and the investor guide's 420.** The sponsor guide also carries the investor entries, so its total rose 997 bytes, to 43,848 of 48,000. The investor guide is 14,810 of 20,000.

## RED, then GREEN (outputs kept in SCRATCH/exec-10-06)

- red-1.txt: `FAIL deliver-phone the contact for tax documents starts from the firm's support details, with the mailing address empty`, `FAIL deliver-phone ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.`, `TAXDOCS FLOW: FAIL (parts run: 1) - deliver-phone`
- red-2.txt:
  - `FAIL consent-phone the withdrawal is confirmed in the portal: withdrawalConfirmed { at, how: portal } :: {"at":"","how":""}` (consent-desktop the same)
  - `FAIL consent-desktop with the firm marked as not a sample it is gone, and the other generated entries are still there :: {"before":26,"after":26}`
  - `FAIL consent-desktop in the self-serve welcome step the general tick box no longer names tax documents`
  - `FAIL amended ticked, Deliver lists it as replacing that document, and delivers it as the replacement`
  - `FAIL amended the investor sees the amended document and the earlier one beside it marked replaced`
  - `TAXDOCS FLOW: FAIL (parts run: 4) - consent-phone, consent-desktop, amended`
  - `TAXDOCS MATH: FAIL (cases run: 11) - confirm, deliver, amended, replaced`
- red-3.txt (the part on the base tree): `FAIL nocdn ran to the end :: locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.`, `TAXDOCS FLOW: FAIL (parts run: 1) - nocdn`

Verify lines (verbatim):
- Task 1: `TAXDOCS FLOW: PASS (parts run: 1)` (31 PASS lines)
- Task 2: `STATUS MATH: PASS (cases run: 13)`, `TAXDOCS FLOW: PASS (parts run: 5)`, `EXIT=0`; `TAXDOCS MATH: PASS (cases run: 11)`; `K1 SPLIT: PASS (cases run: 7)`
- Task 3: nocdn alone `TAXDOCS FLOW: PASS (parts run: 1)`; `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md`; help-guide tests `# pass 9`, `# fail 0`; index.html and assets/css/tax.css unchanged since both 6061fce and eb0d1f1

## Gate (last lines, verbatim; GATE_OUT=SCRATCH/exec-10-06, base eb0d1f1 = the claude/refract-reskin merged in, P10_ROOT unset)

```
GATE ok   server tests # fail 0
GATE ok   STATUS MATH (13)
GATE FAIL FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE FAIL STATUS FLOW (26)
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
GATE ok   BANK STEP TYPING (2)
GATE ok   HELP CHAT (10)
GATE ok   REAL FIRM (9)
GATE ok   SIGNING DOCUMENTS (8)
GATE ok   PHONE LAYOUT (8)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 368
# pass 368
# fail 0
GATE ok   server tests 368 = base 368 + 0 declared
GATE ok   DIST FLOW
GATE ok   DIST RECORD
GATE ok   K1 SPLIT
GATE ok   SHIPPED LIBS
GATE ok   TAX 1099
GATE ok   TAX FORMS
GATE ok   TAX MATH
GATE ok   TAXDOCS FLOW
GATE ok   TAXDOCS MATH
GATE_EXIT=1
```

The gate's run of this plan's check ended `TAXDOCS FLOW: PASS (parts run: 14)`, which is plan 10-04's 8 parts plus deliver and consent at both sizes, amended and nocdn. The server tests number 368, the same as at the base.

## Commits

| Commit | What |
|---|---|
| d5e55ce | test: part deliver-phone (RED) |
| f4a3763 | feat: delivery, the notice and opens on the Tax documents page; taxdocs-investor.js; the hook call in portal.js (tracer) |
| 9b488e6 | test: parts deliver-desktop, consent-*, amended; math case replaced (RED) |
| 63f8d5b | feat: C-09 replacement, the withdrawal confirmed in the portal, the generated tax entry for sample firms only, the welcome tick box |
| 3bf9258 | feat: part nocdn, the guide lines, help-guide.mjs regenerated, marker 14 parts |
| 5f05fb9 | merge of claude/refract-reskin before the gate (no conflict; module verified in sync) |
| 1446c11 | docs: summary draft |
| dc3ea63 | fix: the recorded welcome-step item follows the tick box's new words |

## Deviations from Plan

1. **[D1/C-09] Existing assertions changed.** In taxdocs-math cases confirm, deliver and amended, the lines that required the earlier document to be hidden now require it to stay shown and marked. In taxdocs.js, the two replacement lines of `deliver` and its doc comment were changed to call `replaceEarlier`. The rest of the C-09 code is a separate block.
2. **[Rule 2] A replaced document's title gains " (replaced)".** The investor's Documents row shows the title, so this is how it reads Replaced without a second change to portal.js.
3. **[Rule 3] P6/checks/onboarding-items.json** (not in the plan's files) follows the new tick-box words, because STATUS FLOW checks them.
4. **[Rule 1] server/help/guide.md, invite/welcome:** one phrase changed, because the guide described the tick box as covering tax documents and that is no longer true. This is outside the plan's two entries.
5. **Removing the second way of loading the reader:** nothing to remove. Plan 10-04 already used `NS.esignKit.reader()` only.
6. **RED order:** deliver-desktop's screens and nocdn's path existed before their checks; see Failures.
7. **Base for the gate:** eb0d1f1, the claude/refract-reskin merged in. The starting base 6061fce is in base-commit-start.txt.

Not touched: STATE.md, ROADMAP.md, REQUIREMENTS.md, index.html, assets/css/tax.css, console.js. No package was installed and no paid call was made.

## Files a preview build must publish

- `assets/js/taxdocs-investor.js` (new). It is loaded by taxdocs-ui.js from its fixed PARTS list, beside the existing taxdocs.js and taxdocs-ui.js.

## Known Stubs

None. `NS.taxUI.link` stays null until plan 10-12. Until then a notice is sent from the sponsor's own email, and the page says so in one line.

## Threat model

- T-10-16: Deliver lists recipients first; the module refuses an unconfirmed document; parts deliver-* open the portal as other investors and find nothing.
- T-10-17: a waiting document stays hidden; the block names no title (parts consent-*).
- T-10-18: consent, withdrawal, delivery, opens, paper, the notice coming back, withdrawal of a document and the end of an access period each write a change-log entry; the consent keeps its text and version.
- T-10-19: Withdraw only with `can('configure')` (a team member has none: deliver-desktop); Deliver needs `can('operate')`; consent and opens are recorded only for an investor signed in as themselves.

## Owner's check (pending)

On the iPhone, in the published preview:
1. On Tax documents, enter the mailing address and deliver the K-1s you confirmed.
2. Open the portal as one of those investors. Read the consent, consent, and open the K-1.
3. Open the portal as another investor who has not consented.
4. Look at the delivered rows and at "Send on paper" in the console.

Expected:
- Each K-1 appears in its own investor's Documents only.
- The investor who has not consented sees that a document is waiting, and nothing of it.
- Nothing forces the consent.
- The console shows who opened what and who needs paper.

## Self-Check: PASSED

- FOUND: assets/js/taxdocs-investor.js, checks/taxdocs-flow.js (14 parts), checks/taxdocs-math.js (11 cases)
- FOUND in HEAD's history: d5e55ce, f4a3763, 9b488e6, 63f8d5b, 3bf9258, 5f05fb9, 1446c11, dc3ea63
