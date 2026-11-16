---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 29
subsystem: investor signing view, document dialogs, dialog history, invitation flow (short flow, server mode), console invite form
status: complete
tags: [ways-out, tax-forms, w-9, sandboxed-iframe, d-30, c-03, owner-report]
requires: [06-26, 06-27, tax-request-leave fix (637c525)]
provides:
  - "Back in the sticky signing guide (tax forms and agreements, onboarding and tax-form requests), desktop top bar and phone bottom bar"
  - "PDF dialogs (signed W-9/W-8, own signed copy, offering and published PDFs) drawn in the page with pdf.js, no browser PDF viewer"
  - "browser back closes an open dialog; spent dialog history entries are passed over"
  - "Back on the short flow's Welcome; server-mode device portal offers the open request"
  - "invite form hides Investor type for an investor on file"
  - "checks/ways-out.js (7 parts, 102 checks)"
affects: [owner check, phase 6 verification]
tech-stack:
  added: []
  patterns:
    - "a dialog adds one history entry; back from it closes the dialog"
    - "esign.pageImages / esign.viewPdf: one pdf.js page renderer for signing and viewing"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/ways-out.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-29-SUMMARY.md
  modified:
    - assets/js/app.js
    - assets/js/esign.js
    - assets/js/signflow.js
    - assets/js/onboarding.js
    - assets/js/invitations.js
    - assets/js/portal.js
    - assets/css/esign.css
    - assets/css/diy.css
    - assets/css/portal.css
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js
decisions:
  - "The signing view's Back goes into the existing sticky signing guide (beside Start, Finish and the signing progress) rather than a second sticky bar; the copy below the last page is hidden while the guide carries it"
  - "\"Progress\" kept on screen is the signing guide's progress (ring and count); the step list is already sticky on a desktop; the phone's 'Step N of M' line still scrolls with the page"
  - "All PDF dialogs, not only the W-9's, are drawn in the page: the same Chrome block hit offering and published PDFs; this applies to both editions (app and esign code is shared, not a C-03 slice; managed slice guard green)"
  - "Dialog history: a closed dialog leaves a spent entry that later back/forward passes over, instead of calling history.back() on close (measured in Chromium: back() followed by a navigation in the same task undoes the navigation)"
requirements: []
metrics:
  duration: "64 min, from recording the base (06:25:45 UTC) to the gate's end (07:29:38 UTC)"
  completed: 2026-11-16
  tasks: 6
  files: 12
actuals:
  tokens: 9600    # chars/4 over the added lines of 637c525..b0bb301 (about 38,000 characters)
  tasks: 6
  commits: 6      # git rev-list --count 637c525..HEAD before this summary commit
plan_head_before: 637c5253ad9ce5d033c6c25b5753ae995eb6c22b
plan_head_after: b0bb301fb3d8ebbe9b2bd90ed62f413c90e68124
---

# Phase 6 Plan 29: every tax view can be left in one step, desktop and phone, in the sandboxed preview

The owner reported: "when viewing the tax info that was filled in the onboarding workflow you cant leave the page, its broken". All six items are fixed. Each one is proven by a framed browser check at 1280x800 and 390x844 that fails on 637c525 and passes now. The owner has not checked any of this, so nothing here is ready until he has.

## Failures first

1. **My first gate run was killed part-way when the run was interrupted.** It had passed server tests, status-math, form-maps, forms-flow and status-flow. Then server-mode include-tax stopped with "Target page, context or browser has been closed", because the browser was killed underneath it. I set that run aside and ran the full gate again from the start. Everything passed (below), including server-mode include-tax.
2. **My first GREEN run of ways-out failed 2 checks because of a mistake in my check.** The short-flow Welcome's Back sits beside "Get started" at the end of the step, below the fold. My helper only clicked a Back that was already on screen. I fixed it: form steps now scroll to their own Back, and signing views still require Back on screen with no scrolling. I then ran RED again on the base with the final check: 66 PASS, 35 FAIL, the same failure set as the first RED.
3. **My first RED run was contaminated, so it does not count.** I started editing product files while it was running against the live tree. I stopped it and re-ran RED from a `git archive` of 637c525, with only the new check copied in.
4. **Not tested:** WebKit/Safari and real phones. Phones were emulated in Chromium (390x844, touch).
5. **Not fixed: the phone's "Step N of M" line still scrolls away in the signing view.** What does stay on screen is Back and the signing progress, in the bottom bar. On a desktop the step list on the left is already sticky.

## What changed

1. **Signing view (tax forms and agreements, in onboarding and in a tax-form request).**
   - **Before:** the only Back sat below the last page, about 6,700 px down on a desktop.
   - **Now:** the step's Back is in the sticky signing guide, next to Start, Finish and the progress. That is the top bar on a desktop and the bottom bar on a phone (hidden while the phone's typing tray is open).
   - The Back runs the same action as before (`ivf-taxanswers` / `ivf-back`). The copy below the last page is hidden while the guide carries it.
   - The form and the signing are unchanged.
2. **W-9 / W-8 view dialog (and the other PDF dialogs).** The pages are drawn in the dialog with pdf.js, using the renderer the signing pages already use, factored out as `pageImages`. The browser's PDF viewer is gone, so Chrome no longer shows "This page has been blocked". The X and Download stay. If a file cannot be drawn, the dialog says so and points to Download.
3. **Escape and browser back.** With focus inside the viewer, Escape closes the dialog, because the focus no longer goes into an iframe. Browser back with a dialog open closes the dialog and leaves the page unchanged. After a dialog is closed by X or Escape, one back press still leaves the page (the spent history entry is passed over).
4. **Short-flow Welcome.** An investor on file's invitation to subscribe now has Back on its Welcome step, going to the portal. This is the same Back the tax-request step has (`onboarding.js` actions row).
5. **Server mode.**
   - **Before:** after Back from a tax-form request, the device's portal did not offer the request again, because the invitation has no token there.
   - **Now:** the portal shows "Kestrel Bay asked you for your tax form. Complete your tax form", opened by the invitation's key, until the request is finished.
   - "Continue your subscription" works the same way.
6. **Invite form.** For an investor on file's email, "Investor type" is hidden in place while the email is typed. It shows again for a new email.

## RED and GREEN (quoted)

- **RED** (637c525 code plus ways-out.js, full run, red.txt): 66 PASS, 35 FAIL.
  - Signing views: e.g. `[{"y":0,"back":false},{"y":3176,"back":false},{"y":6352,"back":true}]`.
  - W-9 dialog: `{"frames":1,"pages":0}`. Escape: `{"open":true}`. Back: `{"before":"#overview","open":true,"hash":"#invite-…"}`.
  - Console Account dialog with back: `{"open":true,"hash":"#console"}`.
  - The short Welcome had no Back. The invite form showed Investor type for an investor on file.
  - Server: `Back leads to the device's portal page, which offers "Complete your tax form"` FAIL.
  - Last line: `WAYS OUT: FAIL (parts run: 7) - signing-desktop, signing-phone, request-desktop, request-phone, short-desktop, short-phone, server`.
- **GREEN** (in the gate): 102 PASS, 0 FAIL, `WAYS OUT: PASS (parts run: 7)`.

## Gate

SCRATCH/exec-06-29/gate.sh is the 06-27 gate plus email-dialog, agreement-name, tax-request-leave and ways-out. Last lines verbatim:
```
GATE ok   server tests # fail 0
GATE ok   server tests 197
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
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 197
# pass 197
# fail 0
GATE_EXIT=0
```
PASS lines, all with 0 FAIL:
- forms-flow 983 (unchanged)
- status-flow 414
- server-mode 461
- tax-request-leave 43
- email-dialog 54
- ways-out 102

The managed slice guard (STATUS MATH 13) is green.

## Screens to look at

All under SCRATCH/exec-06-29/checks-out/ways-out/ (SCRATCH = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad):
- desktop-tax-sign-mid.png and phone-agr-sign-mid.png: Back and the progress in the guide, mid-document.
- phone-w9-dialog.png: the signed W-9 drawn in the dialog, with Download and X.
- desktop-device-portal.png: server mode, "Complete your tax form" after Back.
- desktop-invite-onfile.png and desktop-short-welcome.png.

## Deviations from Plan

1. **[Rule 2] Every PDF dialog is drawn in the page, not only the W-9's.** The investor's own signed copy and offering or published PDFs hit the same Chrome block. This is shared code, so it applies to both editions (not a C-03 slice).
2. **[Rule 2] Browser back closes every dialog, not only the document dialogs.** It is one mechanism in app.js.
3. **Check support.**
   - forms-flow include-tax: the D-06 control comparison now expects "Investor type" to be removed for an investor on file.
   - lib.js inviteFromConsole: picks a type only when the select is shown.
4. **Commits were made by staging intermediate file versions,** so each fix is its own commit even where one file holds two fixes. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Known Stubs

None.

## Self-Check: PASSED

- **Files present:** ways-out.js, and every modified file listed in key-files.
- **Commits on HEAD:** 414abd9, 5545c92, 9329ae8, ed43dd8, bdec487, b0bb301.
- **Clean-up:** server/node_modules was linked for the runs only, never staged, and removed afterwards. The base-tree copy and the RED outputs were deleted.
