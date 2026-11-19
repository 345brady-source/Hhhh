---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 31
subsystem: investor portal (portal.js, documents.js), console (console.js), sign-up (diy.js), workspace data (data.js, workspace.js), intake export (intake.js)
status: awaiting owner check
tags: [owner-walkthrough, real-firm, documents, maturity, support-contact, setup-list, short-name, sandboxed-iframe, phone]
requires: [06-WALKTHROUGH]
provides:
  - "an investor of a firm that signed itself up sees only real documents: what the firm published and the investor's own tax form and signed copies; no generated updates, statements or Note Purchase Agreement"
  - "no 1 January 1900 date and no 'Matured' for an offering with no date entered: 'Not set', and the investment page leaves out an empty term section"
  - "a firm that signed itself up starts with no phone, hours or disclosure; investors see only what it enters; the Brand step is complete once a support phone is entered"
  - "on the offering review screen a corrected Name corrects the Short name until the sponsor types their own"
  - "'Prepare your subscription agreement' stays on the Setup list until an offering has a saved agreement, links to the offering, and comes back after Discard or Remove"
  - "checks/real-firm.js (9 parts: each failure on phone 390x844 with touch and desktop 1280x800 in a sandboxed frame that refuses connections, plus the managed edition)"
affects: [owner check of the preview, 06-WALKTHROUGH failures 2, 4, 6 (second half) and 8]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/real-firm.js
    - .planning/debug/owner-walk-real-firm.md
  modified:
    - assets/js/console.js
    - assets/js/data.js
    - assets/js/portal.js
    - assets/js/diy.js
    - assets/js/workspace.js
    - assets/js/documents.js
    - assets/js/intake.js
decisions:
  - "A 'real firm' is a firm of the self-serve edition that is not a built-in sample (workspace.isBuiltin). The sample firms and the managed edition keep their demo documents and their standard phone, hours and disclosure (checked by the managed part and by reading Kestrel Bay in the contact and documents parts)."
  - "'Saved their support contact' is read as: a support phone entered on Portal and brand (the email comes from sign-up)."
  - "A firm that signed itself up before this fix still holds the template's sample lines in the browser; they are cleared when it is loaded (only values equal to the template's, only in the self-serve edition, never a sample firm)."
  - "Where a sentence needs a contact and no phone was entered, the email is used (Account page, the managed edition's invitation preview, the {phone} field of notices); the wire note keeps 'call the team' without a number (confirming wire instructions by email is what wire fraud relies on)."
  - "Key terms with no value (a 'Private credit' offering gets Coupon, Payment schedule, Security and Maturity, empty) are left as they are: each is shown or hidden by the sponsor on the offering page, and the managed edition shows them the same way. The check requires such a 'Maturity' term to carry no date."
metrics:
  duration: "about 2 h 30 min of the continuation, 17:50 to 20:20 UTC, most of it waiting in the shared browser queue and for the gate"
  completed: 2026-11-19
  product_lines: "7 files, 47 added, 16 removed (a0f0e63..ed1a1c8, assets/)"
  check_lines: 833
plan_head_before: a0f0e63652be8ce5b2a917c41e81ff800318f353
---

# Phase 6 Plan 31: walkthrough failures 2, 4, 6 (second half) and 8 fixed for a firm that signs itself up

Continuation of a stopped debugger (debug session `.planning/debug/owner-walk-real-firm.md`). It had read the code and
written `checks/real-firm.js`, not yet run, with no commit. I ran the check RED on the base, fixed the four causes, ran it
GREEN, merged the current `claude/refract-reskin` and ran the reference gate. Nothing here is ready until the owner has
checked it in the preview.

## Failures first

1. **The gate's MEASURE line fails on the leak search, and the base fails it the same way.** One place, `assets/js/taxdocs.js:531`, holds a run of eight words from the owner's documents. That file arrived with the merge (plan 10-02, commit 324b5ce); this plan does not touch it. The same leak search run on the main checkout at the base `0b5d9a2` gives the same single hit: `FAIL leak (3 s): 0 name hit(s), 1 place(s) with a run of eight words from the owner's documents, 0 vendor name or vendored-hash finding(s): assets/js/taxdocs.js:531`. It needs its own fix by the owner of plan 10-02.
2. **My own check leaked first.** The invented document the check uploads had two lines whose wording matched the owner's documents (lines 86 and 88). I reworded them before anything was pushed, rebuilt my own three unpushed commits so those lines are not in the history, and ran RED and GREEN again with the final check. The leak search then lists only the taxdocs.js line above.
3. **Not tested on a real iPhone.** Chromium at 390x844 with touch and an iOS user agent stands in for WebKit.
4. **Invitations sent before this fix** carry the old phone, hours and disclosure in the snapshot the investor's link opens. They cannot be changed from here; a new invitation carries what the firm has entered.

## What each failure was, and what changed

| Failure | Root cause (file, line on a0f0e63) | Change |
|---|---|---|
| 2, documents | `data.js` 601-622 `NS.investorDocs` built "Q3/Q2 Investor Update", "Capital Account Statement" and "Note Purchase Agreement" from the positions for every firm; `portal.js` 1044 `allDocs` joined them with what was published (Documents, Home "Recent documents", the investment page). | Returns nothing for a self-serve firm that is not a sample. |
| 2, 1900 and "Matured" | `data.js` 30-33 `parse('')` is 1 January 1900; `exitInfo` 439-441 and `portal.js` 482-483 `redemption` formatted an empty maturity date ("Maturity Jan 1, 1900", "Time to redemption: Matured"; a range with no dates the same way). | Both answer "Not set" when the date is missing; the investment page leaves out its term section when it has nothing to say. |
| 4, phone, hours, disclosure | `tenants.js` 56-57 carry a sample phone, hours and a bracketed disclosure; `workspace.js` 152 `create` merges them into every firm; `diy.js` 129 sign-up replaced only the domain and email; `portal.js` 84-85 footer, 541 Home contact, 172 wire note, 1146 Account, 1240 sign-in help and `documents.js` 16 printed them unconditionally. | Sign-up starts them empty; `workspace.js` normalize clears the template's lines from a self-serve firm saved before; each of the six places leaves an empty line out. |
| 4, Brand step | `console.js` 218 judged "Brand the investor portal" on the domain and email only, both set by sign-up. | In the self-serve edition it is complete once a support phone is entered. |
| 6, Short name | `console.js` 2660-2666 `NS.binders.ik` wrote only the edited field; the Short name is derived once when the reading is normalized (`intake.js` 1003, untouched, D-33). | The binder sets the Short name from the corrected Name (the intake's own `shortOf`, now exported) until the sponsor types in the Short name; set in place, so typing in the Name is not interrupted. |
| 8, Setup step | `console.js` 237 kept only steps whose link is a page name; once an offering exists the step's link is `console-offering-<id>` (a prefixed route, `app.js` 357-365), so the step was dropped. | The filter recognises the offering page. Completion was already "a saved agreement"; a draft does not count. |

Functions changed: `console.js` `NS.views.console.render` (Brand rule, step filter), `showInvitation` (managed preview line), `NS.binders.ik`; `data.js` `NS.mergeNotice`, `NS.exitInfo`, `NS.investorDocs`; `portal.js` `footer`, `wireBox`, `redemption`, `overviewHTML`, `NS.views.investment.render`, `NS.views.account.render`, `NS.views['sign-in'].render`; `diy.js` `NS.forms['diy-signup']`; `workspace.js` `normalize`; `documents.js` `head`; `intake.js` export list. No text was added beyond "Not set" (already the portal's word for a missing date), no setting, no vendor name.

## Check: checks/real-firm.js

Every part runs the portal in a sandboxed iframe whose policy refuses every connection (each part first proves a fetch of a file that is there is refused) and does everything on screen: sign-up, the offering from an uploaded document, the agreement, the invitation, onboarding with a signed W-9, Approve and Countersign.

- `setup-desktop`, `setup-phone` (failure 8): 8 steps before and after the offering; the step's link opens the offering with "Add the subscription agreement" on screen; a draft leaves it open; Discard keeps it; Save completes it ("Review", count up by one); Remove reopens it.
- `shortname-desktop`, `shortname-phone` (failure 6): a short name the sponsor typed is kept; otherwise correcting the Name corrects the Short name; the offering, Requests "Fund", the Account dialog and the audit package file name carry the corrected name.
- `contact-desktop`, `contact-phone` (failure 4): invitation email (shown and as handed to the email app), all 11 onboarding screens and their footers, the done screen, Home, Account, sign-in help, the signed W-9's certificate page and the tax-form-request email show no phone, hours or disclosure the firm did not enter; Portal and brand shows the three fields empty; once entered, the step is complete and the footer and Account show exactly what was entered; Kestrel Bay's footer is as it was.
- `documents-desktop`, `documents-phone` (failure 2): Documents, Home and the investment page list only the published summary and the W-9, each opening as the file itself; Home, Investments ("Time to redemption: Not set"), the investment page, Distributions, Updates and the sponsor's Overview, Offerings and offering page print no 1900 and no "Matured"; a maturity date entered by the sponsor is then shown ("Matures Jun 30, 2031"); Kestrel Bay's investor keeps the sample documents and the note's maturity.
- `managed`: a client added in the managed edition keeps the standard phone, hours and disclosure, its footer and invitation email print them, its 5-step list counts Brand complete, and its investor's documents are built as before.

Runs (outputs under `SCRATCH/fix-walk-a/`, through `SCRATCH/exec-011/heavy.sh`):

- RED, final check, on a copy of the base `a0f0e63` (`red3.txt`): 74 PASS, 58 FAIL; last line `REAL FIRM: FAIL (parts run: 9) - setup-desktop, setup-phone, shortname-desktop, shortname-phone, contact-desktop, contact-phone, documents-desktop, documents-phone`. The failures carry the walkthrough's words: "Setup 2 of 7 complete", short name "NORTHGATE MOTORS, INC.,", "(212) 555-0100", "Mon–Fri", "[Regulatory disclosures to be provided by counsel.]", "Note Purchase Agreement", "Q3 2026 Investor Update", "Capital Account Statement, Q3 2026", "Maturity Jan 1, 1900", "Matured". `managed` passes on the base, as it must.
- GREEN, final check, on the merged tree (`green2.txt`): 148 PASS, 0 FAIL; last line `REAL FIRM: PASS (parts run: 9)`.
- Server tests on the merged tree: `# tests 272`, `# pass 272`, `# fail 0`.

## Gate

Run once on HEAD b13c0b0 (the fix merged with `claude/refract-reskin` at `0b5d9a2`), base for the phase-4 and phase-5
comparisons `0b5d9a2`. Outputs in `SCRATCH/fix-walk-a/gate/`. Last lines, verbatim:

```
GATE ok   server tests # fail 0
GATE ok   server tests 272
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
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 272
# pass 272
# fail 0
GATE_EXIT=1
```

The one FAIL is MEASURE, from its leak search (failure 1 above; the base fails it the same way). Its lines:

```
PASS walkA (81 s): individual: 13 PASS, 0 FAIL, RESULT: PASS
PASS walkB (39 s): firm: 10 PASS, 0 FAIL, RESULT: PASS
PASS walkC (85 s): individual: 17 PASS, 0 FAIL, RESULT: PASS; entity: 17 PASS, 0 FAIL, RESULT: PASS
FAIL leak (4 s): 0 name hit(s), 1 place(s) with a run of eight words from the owner's documents, 0 vendor name or vendored-hash finding(s): assets/js/taxdocs.js:531
MEASURE: FAIL
```

## Commits

- `ed86e3a` test(06-31): a firm that signed itself up, walked on screen in the refusing frame, red
- `ed1a1c8` fix(06-31): a firm that signed itself up shows its investors only what it published and entered
- `b13c0b0` Merge claude/refract-reskin into the 06-31 fix (current base for the gate)
- this summary and the debug session's notes

Pushed to `wip/fix-walk-a`.

## Deviations

- The brief's check was finished, not replaced. Two of its assertions were narrowed after reading the code: key terms with no value may stay listed with no date (decision above), and the investment page's term section must be left out or carry text (it was an empty box after the first fix; that is fixed). Screenshots were pointed at the step and field they show.
- `workspace.js` normalize was changed (not named in the brief) so a firm saved before the fix loses the template's lines too.
- The gate is `.planning/checks/gate-reference.sh` with three lines changed for this worktree (the folder, the output folder, server tests 272); REAL FIRM was run separately on the same HEAD.
