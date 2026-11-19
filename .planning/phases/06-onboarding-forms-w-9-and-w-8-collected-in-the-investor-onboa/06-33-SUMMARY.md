---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 33
subsystem: phone layout (stylesheets), console tables, intake, distributions, field editor, investor Account page
status: awaiting owner check
tags: [phone, iphone, layout, tables, font-size, tap-targets, walkthrough, sandboxed-iframe]
requires: [06-WALKTHROUGH]
provides:
  - "console tables whose row actions ran off a phone's screen become labelled blocks at 640 px and under (the investor portal's own pattern)"
  - "one rule: every text field, select and text area 16 px at 640 px and under"
  - "nothing wider than the phone's screen on the walked screens; the connection dialog's X beside its title; the signing hint not cut"
  - "the field editor's Review sentence on the phone says how to confirm a field there"
  - "a missing offering name marks and focuses the field; \"Enter an amount.\" follows the amount; the Account page offers an open tax-form request"
  - "checks/phone-layout.js (8 parts: 390x844 touch and 1280x800, desktop compared element by element with the base)"
affects: [owner check, preview publishing (CSS and JS below)]
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/phone-layout.js
    - .planning/debug/phone-layout-walkthrough.md
  modified:
    - assets/css/base.css
    - assets/css/console.css
    - assets/css/diy.css
    - assets/css/esign.css
    - assets/css/portal.css
    - assets/js/console.js
    - assets/js/esign.js
    - assets/js/invitations.js
    - assets/js/onboarding.js
    - assets/js/portal.js
    - .planning/checks/gate-reference.sh
decisions:
  - "Console tables stack only where their rows carry actions that left the screen (found by measurement); tables without row actions keep their sideways scroll."
  - "The touch-area measure counts what a finger hits: the element's box or the ::before/::after the stylesheets lay over it. Six of the walkthrough's eight 'small' targets already had 41 to 46 px; only the support email (23.7 px) and \"Read the PDF again\" (17.4 px) were short."
  - "At 1280x800 nothing moves (measured); the signing bar's hint stays cut on a desktop, as the brief's rule asks."
plan_head_before: a0f0e63652be8ce5b2a917c41e81ff800318f353
---

# Phase 6 Plan 33: the phone layout of the owner-path walkthrough (failures 5, 9, 11, 12 and 14)

The walkthrough found, on a 390 px touch screen, row actions off the right edge (Approve at 764 px), field text at 12 to 14 px,
three items wider than the screen, a sentence pointing to a list the phone hides, and a set of small items. On the same 147
phone screens the check now measures none of these. Nothing here is ready until the owner has checked it on his iPhone.

## Failures first

1. **The gate ended `GATE_EXIT=1`, with two failures.** (a) `MEASURE` fails on its leak search: one run of eight words from the
   owner's documents in `assets/js/taxdocs.js` line 531. That file is not touched by this fix (no difference between the base
   tip 0bfddca and this branch); it came with plan 10-02 (commit 324b5ce, merged into claude/refract-reskin before the tip), so
   the base branch carries it now. The three owner walks in the same step passed (walkA 13/13, walkB 10/10, walkC 17/17 and
   17/17). (b) `PHONE LAYOUT (8)` failed in the gate's run on one desktop screen because of toast timing (see "At 1280x800"); the
   check was corrected and the step run again: `PHONE LAYOUT: PASS (parts run: 8)`, 213 PASS, 0 FAIL. Every other gate line is ok.
2. **Real WebKit is not installed here.** The check runs Chromium with an iPhone's size, touch and user agent inside a
   sandboxed frame that refuses every connection. The enlargement an iPhone makes when a field under 16 px takes focus is not
   seen; what was measured instead is the computed text size of all 850 fields on the 147 phone screens: 824 were under 16 px
   before, 0 after.
3. **The walkthrough's "eight small tap targets" were measured by their box only.** Measured by what a finger hits, six of
   them already had a touch area of 41 to 46 px laid over them by the stylesheets (Remove, Offerings, Integrations, Update bank
   account, Verify now, Back to console). The check proves it with the browser's own hit test 11.95 px above and below each
   one's middle: those six pass on the base too. The two that were short fail that hit test on the base and pass now: the
   support email (23.7 px; 25.7 px by the new rule) and "Read the PDF again" (17.4 px; 25.4 px by the new rule). The full
   sweep of the 147 phone screens found 52 short touch areas of 19 kinds on the base, now 0.
4. **Not changed, by the brief's rule (nothing changes at 1280x800):** on a desktop the signing bar's hint is still cut
   ("Start goes to each em…"), as the walkthrough saw. Letting it wrap there is one rule; it would change the desktop.
5. **Found, not changed:** between 641 and 1279 px the field editor still says the marked fields are "listed on the left"
   while that list lies across the top. Only the phone and the desktop sizes were in this brief.
6. **The managed edition gets the same phone rules** (the stylesheets are shared): its console tables stack and its fields
   are 16 px at 640 px and under. Its desktop is unchanged (measured). Say if the managed edition's phone layout must stay as
   it was (C-03).
7. **Failure 13 (the preview bar) was left as it is and not measured by this check.** The console keeps 104 px under its
   last control (as before); the walkthrough found every control could be scrolled clear of the bar. With 16 px text its
   selects are wider; the bar still scrolls sideways.
8. **Faults in my own check, found and fixed before the counts below:** the support email is on Home, not Account; "Request
   tax form" only shows for a tax form not on file (the request is now made for a sample investor whose W-9 was finished
   unsigned, as tax-request-leave.js does); the desktop walk read the investor's menu before it was drawn; the editor needed
   a reading's summary on the draft to show its Review sentence; "Read the PDF again" is a phone-only control; and, after the
   gate, toasts are left out of the desktop comparison (their presence depends on the walk's timing).
9. **One RED run was cut by the session's one-hour limit** for background commands (the base tip, after 3 of 8 parts); the
   other 5 parts were run again on the same tree. The gate was run detached, with its browser checks queued together (see
   Deviations).

## Before and after (390x844, touch, the same 147 screens of 4 parts)

| Measure | Base (a0f0e63 and the tip 0bfddca: identical) | Fix (merged) |
|---|---|---|
| Buttons, links or fields inside a table past an edge of the screen | 786 | 0 |
| Items wider than the screen | 7 | 0 |
| Text fields, selects, text areas under 16 px | 824 of 850 | 0 of 850 |
| Touch areas under 24 px (box or the area laid over it) | 52 (19 kinds) | 0 |
| Open dialogs whose close X sits under the title | 1 of 3 | 0 of 3 |

The walkthrough's own items, before → after: Approve at 706 to 739 px on the base (764 px in the walkthrough) → inside the
screen and tapped where it stands; Decline, Countersign, Download, Request tax form, View portal, Account, Copy link, Email, Resend, Cancel, Review match, Re-screen, ACH
file, Remove, CSV, Use, Delete → inside the screen; the intake sample button 446 px wide → wraps; "Add the standard terms for
…" ending at 405 px → wraps; the audit file name and the "Downloading …" toast → wrap inside the screen; the "Add a
connection" X 35 px under the title → beside it; "Nothing is required. Star…" → the whole sentence on two lines; while a
blank is typed the tray's label (it was cut: "Mailing address (…") wraps and the hint that repeats it gives way.

## At 1280x800

Every element on every desktop screen of the four parts (its tag, place, size and text size) was compared with a run of the
same check on the base tip (0bfddca): 146 screens, 27,416 elements: all in the same place, at the same size and text
size, apart from the 4 changes made on purpose below (one element each on 4 screens). In the gate's own run the comparison
failed once, on "investor Account with a tax-form request": three toasts ("Signed in as …") were still on screen when the
fixed tree was measured and had gone when the base was (the base's page has no "Complete your tax form" link, so the walk
waited longer there before measuring). Toasts are passing notices, not layout; the check now leaves them out of the
comparison on both sides, and the same step run again passed.

The changes made on purpose (three kinds, on four screens) are named in the check with their reasons: the "Enter an amount."
line goes once an amount is typed, the Account page shows "Complete your tax form" beside "W-9 not signed" (both failure 14's
behaviour, on every screen size), and the field editor's sentence is held in a span so the phone can show its own (its words
and place unchanged; two screens).

## What changed

Stylesheets, at 640 px and under only:
- `console.css`: `.cs-stack` (the investor portal's `.tbl-stack` pattern with the console's colours: no header row, a
  two-column grid of labelled cells, the row's name, first cell and actions across the width); long buttons in a `.cs-row`
  wrap; a long file name in a hint wraps; touch areas laid over plain links in hints, "Needs attention" and muted lines, and
  over the audit's Exceptions; ACH file lines 24 px high.
- `base.css`: the one field rule (`#app` text fields, selects, text areas, not the blanks on a document's page: 16 px).
- `portal.css`: the toast wraps; the support email's touch area 25.7 px.
- `diy.css`: the "Add a connection" dialog's head keeps the X beside the title (as the email dialog does).
- `esign.css`: the signing hint and the tray's label wrap; the hint gives way while the tray names the field (a nudge is
  always shown); the phone's Review sentence; "Read the PDF again" touch area.

Markup and script (functions changed, for the agents working on the same files):
- `console.js`: `NS.views['console-investors'].render`, `NS.views['console-requests'].render`, `runsTable`,
  `NS.views['console-docs'].render`, `NS.views['console-kyc'].render`, `NS.views['console-audit'].render`, `ikList`
  (data-label on the cells, `cs-stack` on the table); `NS.actions['ik-apply']` and `NS.binders.ik` (the name field marked,
  focused, unmarked once typed); `distWhy` (new), `NS.views['console-distributions'].render` and `NS.binders.dist` (the reason
  beside "Generate NACHA file" follows the amount).
- `invitations.js`: `listPanel` (data-label, `cs-stack`).
- `esign.js`: `tplRow` and the templates table in `NS.views['console-esign'].render` (data-label, `cs-stack`); `editorHTML`
  (the phone's sentence: "Fields marked Review: tap each, then the sliders button and “Confirm this field”, or move it to the
  right place before saving.").
- `onboarding.js`: `taxAsk` (new, on `NS.inviteFlow`: the open tax-form request's link, the same rule Home uses).
- `portal.js`: `NS.views.account.render` ("Complete your tax form" in the Tax form row).

No help-guide sentence was reworded (server/help/guide.md does not quote any of these).

## Verification

- `checks/phone-layout.js` on the base: a0f0e63 `PHONE LAYOUT: FAIL (parts run: 8)` (157 PASS, 51 FAIL); the tip 0bfddca, final
  check, 157 PASS, 50 FAIL over the 8 parts (two runs: 3 parts, then the 5 the time limit cut).
- On the fix before the merge: `PHONE LAYOUT: PASS (parts run: 4)` (phone parts, 115 PASS); after the merge: `PHONE LAYOUT: PASS
  (parts run: 4)` (phone parts); all 8 parts on the merged tree with the desktop comparison: `PHONE LAYOUT: PASS (parts run: 8)`,
  213 PASS, 0 FAIL (the gate's step run again, below).
- `npm --prefix server test` on the merged tree: 272 tests, 272 pass, 0 fail.
- Outputs: `SCRATCH/fix-walk-c/` (red-base, red-base-merged, red-base-merged2, fix1-phone, fix2-phone, fix-merged-phone, gate).

Gate (`.planning/checks/gate-reference.sh` as merged, plus PHONE LAYOUT and 272 server tests), last lines verbatim:

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
GATE ok   HELP CHAT (10)
GATE FAIL PHONE LAYOUT (8)
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

(the PHONE LAYOUT step again, the same command and base, after the check left toasts out of the desktop comparison)
PHONE LAYOUT: PASS (parts run: 8)
```

## Commits

- `5148cfc` test(06-33): phone-layout check for the walkthrough's failures 5, 9, 11, 12 and 14 (red on the base)
- `313ab03` fix(06-33): the phone layout of the owner-path walkthrough (failures 5, 9, 11, 12 and 14)
- `3b54c66` Merge claude/refract-reskin into the 06-33 phone-layout fix (base tip 0bfddca)
- test(06-33): toasts are left out of the desktop comparison (the commit after the merge)
- docs(06-33): this summary, the debug session and the reference gate with PHONE LAYOUT and 272 server tests

Pushed to `wip/fix-walk-c`.

## Deviations

- The gate's steps and verdicts are those of `.planning/checks/gate-reference.sh` (committed here with PHONE LAYOUT and the
  272 server tests); it was run once as `SCRATCH/fix-walk-c/gate-par.sh`, which queues the browser checks together through
  heavy.sh (at most four of its jobs at once, each with its own output folder) instead of one after another, and runs detached
  so the session's two-hour limit for background commands cannot stop it. The first, sequential attempt was stopped while
  still waiting for its first browser check.
- The desktop is compared with the base tip (0bfddca), not a0f0e63: the base branch gained the Help entry (07-03) while this
  work ran, and merging it changed the desktop for reasons that are not this fix.
- The brief's "eight small tap targets" are reported by what a finger hits (failure 2 above), not by their boxes.
