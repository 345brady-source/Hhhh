---
status: awaiting_human_verify
trigger: "Owner-path walkthrough (06-WALKTHROUGH.md) failures 1, 3, 7 and 10: Countersign on Requests does not sign the agreement and the investor's signed copy drops out of Documents; the agreement is titled by its file name; with IndexedDB absent a reload loses the stored PDFs and the screens say the wrong thing; a document opened on the phone cannot be read (no zoom)."
created: 2026-11-19T00:00:00Z
updated: 2026-11-19T20:25:00Z
---

## Current Focus

status_now: fixes committed (efad6f4..a7591a0, merged aae0f5f), gate run, pushed to wip/fix-walk-b; waiting for the owner's check (06-32-SUMMARY.md)

hypothesis: four, from reading the code (each still to be reproduced in a failing check):
  H3a: console.js req-funded calls ops.markFunded (operations.js 283-294), which only sets the request to accepted and pushes a position; it never looks at the request's envelope, so the firm's signer stays unsigned while the toast says "countersigned".
  H3b: portal.js documents view (1013) shows earlyDocuments (with esign.js investorDocsHTML "Signed by you") only while the investor has no position; once markFunded pushes a position the page is the docs table plus the documentsTop hook (esign.js 2732), which lists only "Waiting for your signature", so the copy the investor signed is listed nowhere until the envelope completes.
  H7: intake.js prepareAgreement (1345) passes title: d.title, and d.title is the stored document's title made from the file name (intake.js 1180); esign.js 2817 titles the envelope `${tpl.title} - ${inv.title}`. The stored offering document keeps the file-name title on both paths.
  H1: every reader of a stored file treats "no file" as "stored in a different browser" (esign.js 476, 3628, 2751, 3029; portal.js 1063, 1095; record.js 508); signHTML draws the signing bar whatever the page cache says, so a failed load still shows "Ready to finish" with Finish enabled.
  H10: esign.js viewPdf (454-468) draws each page as an <img> at 100% of the dialog body with no zoom control; the zoom control lives only in signflow.js barHTML and acts on .es-doc-sign.
test: new check checks/signing-documents.js (parts countersign, title, lost-files, viewer; each -desktop 1280x800 and -phone 390x844 touch, in the sandboxed frame with connect-src 'none'), run on the unchanged tree first
expecting: every part FAILS on a0f0e63 on the lines that state the required behaviour
next_action: GREEN run of checks/signing-documents.js all eight parts on the worktree (green.sh all) -> SCRATCH/fix-walk-b/green-all.txt; fixes applied in esign.js (lostText, loadPages/pagesHTML lost, signHTML guide hidden when pages fail, countersign + signed hook, mineHTML in documentsTop, fromDocId retitle in saveAgreement, viewPdf zoom), signflow.js (zoomHTML, sf-doc-zoom), console.js (req-funded, kyc-iv-file), portal.js (openUploaded, up-download), record.js (signedFile), intake.js (prepareAgreement title), portal.css (.doc-page zoom), guide.md Requests step 3

reasoning_checkpoint:
  hypothesis: "(3) req-funded calls markFunded without reading r.envelopeId, so the request is accepted while the firm's signer stays unsigned; the documentsTop hook lists no awaiting copy once a position exists. (7) prepareAgreement passes the file-named doc title and nothing retitles the stored document. (1) every files().get() null branch says 'different browser'; signHTML draws the guide whatever the page cache says. (10) viewPdf has no zoom and .doc-page is fixed at 100%."
  confirming_evidence:
    - "RED: toast 'Subscription countersigned' with env firm 'sent', request accepted, onRegister 1, hash stays #console-requests"
    - "RED: tpl.title 'Document', doc title 'Document'; button path doc title 'Document' with tpl title right"
    - "RED: agreement step text 'This document is stored in a different browser... Ready to finish' with Finish enabled"
    - "RED: zoom [] and page width unchanged after Zoom in presses"
  falsification_test: "After the fixes the same check lines still fail (e.g. Countersign still accepts at once, or titles still 'Document')"
  fix_rationale: "Each change is at the line that produces the wrong state or text: Countersign routes into the firm's real signing and acceptance moves to the signing's completion hook; the agreement's title is fixed at draft creation and copied to its source document at save; the lost-file branches get one honest line by audience and the guide is not drawn for pages that failed; the viewer gets the existing zoom control and steps"
  blind_spots: "Real WebKit not available; co-investor envelopes where the firm is not last in order are handled by a toast only; an agreement replaced later keeps the old document's retitle"
  candidate_causes:
    - "code: the four sites above"
    - "data: titles stored on ws.docs at intake time (d.name) - the stored record carries the wrong title; fixed at save by retitling, not by the reader (D-33)"
    - "environment: IndexedDB refused by the frame (noidb) - not a bug to fix (no new storage layer); only the screens' words and state"
  and_gate: "yes for (3): the wrong toast/acceptance (console.js/operations.js) AND the missing listing (esign.js documentsTop) are two independent causes of the two symptoms; both fixed. no for 7, 1, 10 (single cause each)."

bug_class: Bohrbug x4 (each deterministic under its stated conditions); SBFL skipped (browser checks, no per-test coverage)

## Symptoms

expected: (3) Countersign on Requests really countersigns the agreement; the investor's signed copy never leaves Documents. (7) Envelope and signed copy titled "Subscription Agreement - <investor>", offering document "Subscription Agreement", whatever the file is called. (1) With no IndexedDB after a reload, screens say plainly this browser did not keep the file and what to do; the agreement step's bar is not "Ready to finish"; a Download with no file says so. (10) A document opened on the phone is readable: zoom controls, fits width, scrolls sideways.
actual: (3) Toast "Subscription countersigned. The commitment is on the investor register." while E-sign lists the envelope "Out for signature - 1 of 2 signed"; investor's Documents no longer lists "Signed by you". (7) Intake path titles are "Document - Maya Okonkwo" / "Document". (1) "This document is stored in a different browser. In production, envelopes are kept in the document vault." with bar "Ready to finish" and Finish enabled; Documents says "This file was published from a different browser..."; Download gives nothing; editor draws no pages. (10) Pages drawn 328 px wide, Download and Close only.
errors: none in the console (walkthrough: no console error, no uncaught error in 28 runs)
reproduction: see 06-WALKTHROUGH.md failures 1, 3, 7, 10 (steps listed per failure)
started: found by the owner-path walkthrough of 2026-11-19 on the preview build (base a0f0e63)

## Eliminated

## Evidence

- timestamp: 2026-11-19T00:00:00Z
  checked: knowledge base (.planning/debug/knowledge-base.md)
  found: no knowledge-base.md in this tree; MemPalace not available in this session
  implication: no prior pattern to test first; proceed normally

- timestamp: 2026-11-19T00:00:00Z
  checked: worktree base
  found: HEAD a0f0e63 equals origin/claude/refract-reskin after fetch
  implication: base is as required; no reset needed

- timestamp: 2026-11-19T00:20:00Z
  checked: console.js 2120-2126 (req-funded), operations.js 283-294 (markFunded), esign.js 192-218 (currentSigners, countersignDue), 2101-2118 (es-sign-as)
  found: Countersign on Requests = markFunded: request -> accepted, position pushed, log "commitment countersigned". No read of r.envelopeId. The firm's real signing exists only behind E-sign, Open, "Sign as sponsor" (es-sign-as sets ui.es.signAs and the console-envelope view draws signHTML ctx console).
  implication: two different things are both called countersign; the Requests one never signs (H3a)

- timestamp: 2026-11-19T00:22:00Z
  checked: portal.js 998-1034 (earlyDocuments, documents view), esign.js 2703-2735 (hooks), 2996-3014 (awaitingFor, investorDocsHTML)
  found: "Signed by you" is built only in investorDocsHTML, which only earlyDocuments calls, and earlyDocuments is used only when the investor has no positions. The documentsTop hook for investors with positions returns only waitingHTML.
  implication: any investor with a position (after acceptance, or one who already held something) has no listing of an agreement they signed that still waits for the firm (H3b); this is wider than the walkthrough's path

- timestamp: 2026-11-19T00:25:00Z
  checked: intake.js 1180, 1291, 1345; esign.js 2817, 3647, 3728, 3846
  found: whole-file agreement from the intake: agreementDraft(..., { title: d.title || 'Subscription Agreement' }), d.title = file name without extension. Agreement cut from a combined file: title 'Subscription Agreement' (1291) but the cut document is titled "Subscription Agreement (pages a to b of <file name>)" (1278). The dialog path passes the dialog's Title field, default "Subscription Agreement". Neither path retitles the stored offering document.
  implication: H7 as stated; the cut document's title also carries the file name

- timestamp: 2026-11-19T00:30:00Z
  checked: walkthrough log SCRATCH/walk-owner/out/iphone-noidb-reload/log.jsonl and screenshots 003, 025, 028
  found: "Edit fields" after reload stays on the offering page with the toast "The agreement's file is stored in a different browser."; the agreement step shows the esign.js 476 text with "Try again" above a bar reading "Ready to finish" with Finish enabled; the Documents dialog shows the portal.js 1063 text; the signed W-9's Download toasts "The signed PDF is stored in a different browser." (record.js 508), so every one of these does say something, but the wrong thing
  implication: H1 is a wording and state problem at each reader of files().get(), not a storage bug: operations.js files() already holds files in memory when IndexedDB is absent and app.js storageNote already tells the firm's people

- timestamp: 2026-11-19T00:32:00Z
  checked: diy.css 185-188
  found: `.ivf-agreement:has(.sf-back) > .ob-actions { display: none; }`: the step's own Back row is hidden only while the signing bar (with its Back) is drawn
  implication: when the bar is not drawn for an agreement that cannot be shown, the step's own Back appears by itself; no new control needed

- timestamp: 2026-11-19T00:35:00Z
  checked: esign.js 454-468 (viewPdf), signflow.js 17, 69, 83-87, 357-403 (zoom), esign.css 366-385, 451; portal.css 499-501
  found: viewPdf writes `<div class="doc-pages">` of `<img class="doc-page" style width:100%>`; zoom steps 1, 1.25, 1.5, 2 and the three-button control are private to signflow.js and act on `.es-doc-sign` through --es-zoom; on a phone the middle (percent) button is hidden by esign.css 451
  implication: H10 as stated; the control and steps can be reused by exporting them from signflow.js

- timestamp: 2026-11-19T17:45:00Z
  checked: exploration SCRATCH/fix-walk-b/explore/intake-probe.js (phase 4's generated agreement named Document.pdf through the offering intake, sample firm Kestrel Bay, plain page)
  found: read in 473 ms; the offering is created and the agreement saved ready at once (14 fields, roles Investor and Sponsor, no draft), template title "Document", offering document title "Document" fileName "Document.pdf", recognised kind agreement
  implication: the intake path reproduces failure 7 with a generated PDF; checks/signing-documents.js part title can use it

- timestamp: 2026-11-19T18:30:00Z
  checked: RED run, checks/signing-documents.js all eight parts on the base tree a0f0e63 (SCRATCH/fix-walk-b/red-all.txt)
  found: "SIGNING DOCUMENTS: FAIL (parts run: 8)". countersign: Countersign stays on #console-requests with the toast "Subscription countersigned..." while env firm "sent"; request accepted and on the register; investor Documents mine [] after Countersign and for the holder. title: tpl title "Document", offering doc "Document", envelope "Document - <name>"; button path tpl title right but offering doc "Document". lost-files: agreement step and editor show the esign.js 476 text with "Try again"; agreement step bar "Ready to finish" with Finish enabled; Documents dialogs show portal.js 1063 / esign.js 2751 texts; Downloads toast "This file is stored in a different browser." (portal.js 1095) and "The signed PDF is stored in a different browser." (record.js 508); Edit fields toast esign.js 3628. viewer: zoom [] on all three documents, page 328 of 352 px on the phone, no growth on zoom. Every behaviour line fails as predicted; every frame/setup line passes.
  implication: H3a, H3b, H7, H1, H10 confirmed by observation. One check defect: the check's own fetch probe logs CSP lines that "no script error" counted; the probe is now marked (?frame-probe) and only those lines are left out

- timestamp: 2026-11-19T19:05:00Z
  checked: first GREEN run, all eight parts (SCRATCH/fix-walk-b/green-all.txt)
  found: "SIGNING DOCUMENTS: FAIL (parts run: 8) - countersign-desktop, countersign-phone, viewer-desktop, viewer-phone", 221 PASS. title and lost-files passed. Three causes: (a) viewer pages did not grow: base.css 14 `img, video { max-width: 100% }` capped .doc-page; (b) the finished countersign card left the page scrolled down from signing, "Back to envelope" above the screen (desktop); (c) check defect: the accepted row has no element with the request id, so rowText found no row
  implication: (a) .doc-page max-width: none; (b) esign.js focusPending returns the page to its top when the finished card replaces the document; (c) rowText falls back to the investor's name

- timestamp: 2026-11-19T19:30:00Z
  checked: the lost-agreement screenshot (phone) after the fix
  found: one line "This browser did not keep the agreement’s file. Ask Kestrel Bay Investor Relations at ir@kestrelbaycap.com to send it again." with the step's Back; but the step's lede still said "Select Start to go to each field that needs you, then Finish." and "Decline to sign" was still offered for a document nobody can see
  implication: Decline hidden while the pages failed (signHTML atDoc), the lede hidden by diy.css when .es-doc-sign holds the error note; a check line added for it

- timestamp: 2026-11-19T19:45:00Z
  checked: reruns on the worktree: countersign and viewer parts (green-two.txt), lost-files parts (green-lost.txt)
  found: "SIGNING DOCUMENTS: PASS (parts run: 4)" (138 PASS) and "SIGNING DOCUMENTS: PASS (parts run: 2)" (68 PASS)
  implication: every part passes on the fixed tree; the full run of all eight is in the gate on the merged tree

## Resolution

root_cause: (3) console.js req-funded called operations.js markFunded (283-294), which accepts the request and records the commitment without reading r.envelopeId, so the firm's signer stayed unsigned under a "countersigned" toast; AND esign.js documentsTop hook (2732) listed only documents waiting for a signature for an investor with positions, so their signed copy left Documents once the commitment was recorded. (7) intake.js prepareAgreement 1345 passed the stored document's file-name title (intake.js 1180) as the agreement's title; nothing retitled the offering's stored document on either path. (1) every null branch of files().get() said "stored in a different browser" (esign.js 476, 875, 1214, 1583, 1586, 1677, 2751, 3029, 3069, 3628, 3632; portal.js 1063, 1095; record.js 508; console.js 2399) and signHTML drew the signing guide whatever the page cache said. (10) esign.js viewPdf drew pages at 100% (portal.css .doc-page) with no zoom control; the control was private to signflow.js barHTML.
fix: (3) esign.js countersign() opens the firm's signing (signAs, console-envelope) while the firm's signature is outstanding, a signed hook accepts the request (markFunded) only when that signing completes, console.js req-funded asks it first; mineHTML ("Signed by you") in the documentsTop hook; focusPending returns to the top on the finished card; guide.md Requests step 3. (7) prepareAgreement titles "Subscription Agreement"; agreementDraft records fromDocId; saveAgreement retitles that document. (1) esign.js lostText (one line by audience) at every site; loadPages marks lost; pagesHTML shows the line with no Try again; signHTML draws no guide and no Decline when the pages failed; diy.css hides the step's Start/Finish lede then. (10) signflow.js zoomHTML shared, action sf-doc-zoom; viewPdf puts the control in the dialog head; portal.css .doc-page width by --doc-zoom, max-width none.
verification: RED on a0f0e63 with the final check "SIGNING DOCUMENTS: FAIL (parts run: 8) - countersign-desktop, countersign-phone, title-desktop, title-phone, lost-files-desktop, lost-files-phone, viewer-desktop, viewer-phone" (132 PASS, 96 FAIL); GREEN in the gate on the merged tree (base 0bfddca) "SIGNING DOCUMENTS: PASS (parts run: 8)" (244 PASS, 0 FAIL); server tests 272 pass; every other gate line ok except MEASURE, whose leak finding (assets/js/taxdocs.js:531, plan 10-02) the base 0bfddca has too; signing-step 75/0 and record-check 40/0 on base and plan. Not seen by the owner yet.
files_changed: [assets/js/esign.js, assets/js/signflow.js, assets/js/console.js, assets/js/portal.js, assets/js/record.js, assets/js/intake.js, assets/css/portal.css, assets/css/diy.css, server/help/guide.md, server/lib/help-guide.mjs, checks/signing-documents.js, checks/safari-finish.js]
