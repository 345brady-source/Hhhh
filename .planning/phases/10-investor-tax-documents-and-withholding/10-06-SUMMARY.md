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
  commits: 6        # plan commits d5e55ce..3bf9258 plus the merge 5f05fb9 (first-parent); this summary is the 7th
plan_head_before: 6061fce0b5d43bced41eb84c3c7c6375d1d97f27
plan_head_after: 5f05fb9
---

# Phase 10 Plan 06: delivery and consent Summary

A confirmed K-1 now reaches its one investor in the portal. Deliver first lists who receives what. An investor who has not consented sees only that a tax document is waiting, and the sponsor sees them on the send-on-paper list. The consent is separate, optional, shows the eight disclosures with the firm's contact, and can be withdrawn and given again. Opens are counted on the sponsor's row. An amended K-1 sits beside the earlier one, marked Replaced, until the earlier one's access period ends (C-09). Everything is measured in the sandboxed frame only, on files built from the IRS's blank 2025 form with invented partners. **The owner has not checked any of it yet.**

## Failures and open points first

GATE: see "Gate" below (filled in when the run ends).

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

<!-- gsd:write-continue -->
