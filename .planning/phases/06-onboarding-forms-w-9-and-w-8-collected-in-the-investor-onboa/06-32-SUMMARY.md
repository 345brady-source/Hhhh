---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 32
subsystem: signing (esign.js, signflow.js), investor documents (portal.js, record.js), requests (console.js), intake (intake.js)
status: awaiting owner check
tags: [walkthrough, countersign, agreement-title, lost-files, document-viewer, sandboxed-iframe, iphone]
requires: [06-WALKTHROUGH]
provides:
  - "Countersign on Requests opens the firm's signing of the agreement; the commitment is recorded only when that signing is finished"
  - "the investor's signed copy stays in Documents (Signed by you) for every investor, then the fully signed copy"
  - "the subscription agreement, its envelopes and the offering's document are titled Subscription Agreement, never by the file name"
  - "one honest line wherever this browser no longer has a stored file, with what to do; no guide, Finish or Decline for pages that cannot be shown"
  - "the investor's document viewer has the signing views' zoom control and scrolls sideways when zoomed"
  - "checks/signing-documents.js (8 parts)"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/signing-documents.js
  modified:
    - assets/js/esign.js
    - assets/js/signflow.js
    - assets/js/console.js
    - assets/js/portal.js
    - assets/js/record.js
    - assets/js/intake.js
    - assets/css/portal.css
    - assets/css/diy.css
    - server/help/guide.md
    - server/lib/help-guide.mjs
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/safari-finish.js
functions-changed:
  console.js: "NS.actions['req-funded'] (asks esign.js countersign first), NS.actions['kyc-iv-file'] (message only)"
  portal.js: "openUploaded (message only), NS.actions['up-download'] (message only)"
  record.js: "signedFile (message only)"
  intake.js: "prepareAgreement (the title passed)"
  signflow.js: "zoomHTML (new, used by barHTML), applyZoom/markZoom, NS.actions['sf-doc-zoom'] (new)"
  esign.js: "viewPdf, lostText (new), loadPages, pagesHTML, focusPending, signHTML, the documentsTop hook, countersign (new) and its signed hook, investorDocsHTML/mineHTML (new), agreementDraft, saveAgreement, and the file-missing messages in signedBlob, finishSigning, es-create, es-dl-orig, es-open-doc, es-open-mine, pageLayout"
---

# Phase 6 Plan 32: four walkthrough failures around signing and documents (1, 3, 7, 10)

The owner-path walkthrough of 2026-11-19 found these four in the preview. Each now has a check that failed on the
unchanged tree and passes on the fixed one, in the host's sandboxed frame that refuses every connection, at 390x844 with
touch and at 1280x800. Chromium stands in for the iPhone (no WebKit here). The owner has not checked any of it, so none
of it is done until he has.

## Failures first

0. **The gate's MEASURE line fails, on the base too.** The leak search finds "1 place with a run of eight words from the
   owner's documents" at `assets/js/taxdocs.js:531` (the electronic-delivery consent text of plan 10-02, merged into
   claude/refract-reskin before this plan's merge; this plan does not touch that file). The same search on a checkout
   of the base 0bfddca gives the same finding and `MEASURE: FAIL`. The three owner walks pass (walkA 13, walkB 10, walkC
   17 + 17). Left for the orchestrator: it is plan 10-02's text.
1. **My first GREEN run failed four of eight parts.** (a) Zoom in did nothing in the viewer: base.css line 14 caps every
   image at `max-width: 100%`, which my page rule did not override. (b) On the desktop, after the firm finished signing,
   "Back to envelope" was scrolled off the top of the screen: the page stayed where the signer had scrolled. (c) A defect
   in my check: an accepted request has no button, so the check could not find its row. Fixed (a) and (b) in the product,
   (c) in the check; the reruns passed (countersign and viewer 138 PASS, lost-files 68 PASS), and the full run of all
   eight parts is in the gate below.
2. **A screenshot showed a dishonest line the check had not asked about.** With the agreement's file gone, the step still
   said "Select Start to go to each field that needs you, then Finish." and offered "Decline to sign". Both are now hidden
   while the pages cannot be shown, and the check has a line for it (fails on the base, passes now).
3. **A defect in the check the earlier agent wrote:** its own fetch probe (proving the frame refuses connections) put two
   policy lines in the browser console, which "no script error" counted. The probe is now marked and only its lines are
   left out.
4. **Not tested:** real WebKit / the iPhone, the Claude app's own frame policy, a pinch on the viewer.
5. **Not changed:** the invitations list's own "Countersign" link (it opens the envelope's page, where "Sign as sponsor"
   is); a subscription whose agreement is not yet the firm's turn now answers Countersign with "The subscription
   agreement is waiting for <name> to sign first." instead of recording it.

## What each fix does

**3. Countersign really countersigns.** Root cause: `console.js` `req-funded` called `operations.js` `markFunded`
(lines 283-294), which accepts the request and puts the commitment on the register without looking at the request's
envelope, so the firm's signer stayed unsigned under the toast "Subscription countersigned."; and the `documentsTop` hook
in `esign.js` (line 2732) listed only documents waiting for a signature for an investor who holds an investment, so the
copy they signed vanished from Documents once the commitment was recorded. Now Countersign opens the agreement's firm
signing (the view of E-sign, Open, "Sign as sponsor"); the request is accepted and the commitment recorded only when that
signing is finished; "Back to envelope" without finishing leaves it approved with Countersign. With no agreement, or no
field for the firm, Countersign records at once as before. "Signed by you" is listed for every investor until the firm
signs, then the fully signed copy. The help guide's Requests step now describes Countersign.

**7. The agreement is never titled by its file name.** Root cause: `intake.js` `prepareAgreement` (line 1345) passed the
stored document's title, made from the file name (line 1180), as the agreement's title; neither path retitled the
offering's stored document. Now the intake titles it "Subscription Agreement", and saving an agreement made from a
document on the offering gives that document the agreement's title (the file name stays its file name). The reader and
agreement recognition were not touched (D-33).

**1. Honest screens when this browser did not keep a file.** Root cause: every place that reads a stored file treated "no
file" as "stored in a different browser" (`esign.js` 476 and ten more, `portal.js` 1063 and 1095, `record.js` 508,
`console.js` 2399), and `signHTML` drew the signing guide whatever the page cache said. Now one line says "This browser
did not keep the agreement’s file." (or "this document’s file", "the signed PDF") and what to do: an investor is told
"Ask <team> at <email> to send it again" (or "for a copy"), the firm "Add the agreement again from the offering page."
The agreement step shows no guide, no Finish, no Decline and no "Try again" for a file that is gone; its own Back is on
screen. A Download with no file says the same line. No storage layer was added.

**10. Documents can be read on the phone.** Root cause: `esign.js` `viewPdf` drew each page at 100% of the dialog
(`portal.css` `.doc-page`) with no zoom control; the control was private to `signflow.js` `barHTML`. The control is now
shared (`zoomHTML`) and sits in the viewer's head beside Download and Close; pages open fitting the width (328 px on the
phone), are twice as wide at full zoom (the check requires 2x within 3% and over 600 px on the phone) and scroll sideways
by finger or wheel.

## Checks

- RED on the base a0f0e63 with the final check: `SIGNING DOCUMENTS: FAIL (parts run: 8) - countersign-desktop,
  countersign-phone, title-desktop, title-phone, lost-files-desktop, lost-files-phone, viewer-desktop, viewer-phone`
  (132 PASS, 96 FAIL; every FAIL is a line stating the required behaviour).
- GREEN on the merged tree (in the gate): `SIGNING DOCUMENTS: PASS (parts run: 8)` (244 PASS, 0 FAIL).
- Gate (`.planning/checks/gate-reference.sh` adapted to this worktree, plus SIGNING DOCUMENTS (8)), base 0bfddca:

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
GATE ok   SIGNING DOCUMENTS (8)
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

## Commits

- efad6f4 test(06-32): signing and documents check for walkthrough failures 1, 3, 7 and 10, red
- fa4329e fix(06-32): a document opened from the investor's Home or Documents can be zoomed and scrolled sideways (failure 10)
- 6c0baf3 fix(06-32): the subscription agreement is never titled by its file name (failure 7)
- 94ad59f fix(06-32): a file this browser did not keep is said so plainly, with what to do (failure 1)
- a7591a0 fix(06-32): Countersign on Requests signs the agreement as the firm before the commitment is recorded (failure 3)
- aae0f5f Merge claude/refract-reskin (0bfddca) into this branch before the gate
- this summary and the debug session notes (.planning/debug/walk-b-signing-documents.md)

## Deviations

- The cut agreement's document ("Subscription Agreement (pages a to b of <file>)", plan 01.4-71) is also retitled
  "Subscription Agreement" when it is saved as the agreement, since its title carried the file name.
- The finished signing card now returns the page to its top (all signing views, not only Countersign), so its way out is
  on screen.
- "Decline to sign" and the step's Start/Finish line are hidden while a document cannot be shown (not in the brief; found
  on the screenshot).
