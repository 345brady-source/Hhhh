---
status: awaiting_human_verify
trigger: "Walkthrough 3 (b14): (1) co-investor sign-in link sticks on 'Opening your agreement…' with TypeError null.signedAt at esign.js:3271 mineHTML; (2) N4: W-8BEN Finish redrawn under the press at CPU 4x, press lost."
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

bug_class: Bohrbug (both deterministic; (2) timing-window but reproduced deterministically by holding the page image)
hypothesis: (1) CONFIRMED: esign.js awaitingFor (3255) matches envelopes where ANY signer of the account signed; mineHTML (3270) then looks up the VIEWER's signer via flowSigner (co flag from state.co) -> null for a co-investor on an agreement with no co signer -> TypeError. (2) CONFIRMED: on the phone the guide bar is order:5 sticky-bottom after the document; with the 1-page W-8BEN the image arrives right as Finish appears; pagesOf's NS.app.render() replaces the whole page (new Finish node) and moves Finish from y=586 (after the short 'Loading document...' placeholder) to y=784 (stuck at the screen bottom).
next_action: owner checks on his iPhone (co-investor link on an agreement with no co place; W-8BEN Finish pressed as soon as it appears). Not archived until he has.

reasoning_checkpoint:
  hypothesis: "(1) The crash is esign.js awaitingFor counting any signer of the account as 'signed by you' while mineHTML reads the viewer's own signer (null for a co-investor with no place). (2) The lost press is the W-8BEN step's whole-page redraw when its one page image arrives: the guide bar (phone: after the document, sticky bottom) jumps ~200 px and its Finish node is replaced."
  confirming_evidence:
    - "RED: pageerror TypeError null.signedAt at esign.js:3271:68 <- mineHTML <- investorDocsHTML <- earlyDocuments portal.js:1003, page left on 'Opening your agreement…' (same stack as the walk)."
    - "RED: elementHandle.tap 'Element is not attached to the DOM'; Finish at y=586 when found, y=784 after the redraw."
  falsification_test: "(1) With awaitingFor on the viewer's own signer the Documents render must not throw for the co-investor. (2) With the page's place held while loading, Finish must not move, and with data-keep the found node must stay connected."
  fix_rationale: "(1) awaitingFor/mineHTML now read the same signer (mySigner), so the list and the lookup agree; plus the co link's page says when there is nothing to sign (coTask), the console says why and how, and saving a co place reaches existing agreements from the same file (tplOf + coAttach) so the 'how' works. (2) the loading state reserves each page's size (nothing after the document moves) and render keeps data-keep nodes (Back/Next/Finish) through a redraw."
  blind_spots: "Real WebKit not available (Chromium iPhone emulation). The not-your-turn co page (coTask.before) is drawn by the same code but not exercised by a check. Server mode co sign-in after a template save relies on invitations.js's sync picking up coWaiting (not exercised)."
  candidate_causes:
    - "code: awaitingFor/flowSigner mismatch (confirmed)"
    - "data: an agreement with no co-investor places while a co-investor is on the account (the trigger condition, valid data)"
    - "environment: CPU 4x timing makes the image arrive at the press moment (trigger for (2)), layout: phone CSS order:5 sticky-bottom bar"
  and_gate: "yes for (2): needs the whole-page redraw AND the bar's position depending on the document's height AND the image arriving between Finish appearing and the touch; both the layout shift and the node replacement were fixed. (1) single code cause, triggered by valid data."

## Symptoms

expected: (1) co-investor link never crashes; if nothing to sign, page says so plainly with a way out; console explains (no co-investor places; how to add). (2) W-8BEN Finish pressed the moment it appears works on the first press at CPU 4x.
actual: (1) stuck on "Opening your agreement…", TypeError: Cannot read properties of null (reading 'signedAt') at esign.js:3271 (mineHTML <- investorDocsHTML <- portal.js:1003 earlyDocuments). 4 of 4 tries. (2) iphone-a2: Finish redrawn under the press, second press worked (1 of 1 W-8BEN fast-Finish runs; W-9 fast-Finish runs fine).
errors: TypeError: Cannot read properties of null (reading 'signedAt') at esign.js:3271
reproduction: (1) account investor signed agreement awaiting countersign, agreement has no co-investor places; Investors > Account > Add co-investor > Open the co-investor's link. (2) CPU 4x, foreign individual, W-8BEN answers filled, press Finish the moment it appears.
started: 06-37/06-39 code paths

## Eliminated

- hypothesis: N4 W-8BEN case is only an automation artifact (Playwright's found element detached; a finger would hit the new Finish at the same place)
  evidence: RED NOTE Finish at 259,586 when found and 259,784 after the redraw: the control moves ~200 px on the phone, so a finger aimed at it lands on the page instead
  timestamp: 2026-11-20

## Evidence

- timestamp: 2026-11-20
  checked: code read esign.js 3255-3275, 3037, 76; portal.js 1000-1010; coinvestor.js 410-440
  found: awaitingFor = envs with a signer x.investorId===id && signed (any signer, incl. the investor when the viewer is the co-investor); mineHTML s = flowSigner(e, inv.id) (matches !!x.co === !!state.co) then s.signedAt. coinvestor.js NS.views.co.after sets state.co=true, viewer=inv.id, goes to 'documents' when nothing is pending -> earlyDocuments -> investorDocsHTML -> mineHTML. Same hook also in documentsTop (investor with positions).
  implication: any co-investor viewing an account whose investor signed an agreement awaiting countersignature, where the co is not a signer, crashes the Documents render; the co view's 'Opening your agreement…' stays on screen.
- timestamp: 2026-11-20
  checked: RED run press-and-co-investor.js --only press-w8-phone,co-link-none-phone (unfixed tree 8a76fb2 + new parts)
  found: co-link-none-phone: pageerror TypeError null.signedAt at esign.js:3271:68 <- mineHTML 3269 <- investorDocsHTML 3262 <- earlyDocuments portal.js:1003; page left on 'Opening your agreement…'; toast says 'They sign their own places on each agreement made for it.' (misleading); saving a co place later does not add Ruth to Maya's agreement (co null). press-w8-phone: 'elementHandle.tap: Element is not attached to the DOM'; NOTE Finish at 259,586 when found and 259,784 after the redraw.
  implication: both reproduced. (2) is a real-finger problem too (Finish moves ~200 px), not only an automation artifact.
- timestamp: 2026-11-20
  checked: assets/css/esign.css 443 (phone: .sf-bar order 5, sticky bottom), esign.js pagesHTML/pagesOf (loading placeholder is one short <p>; on load NS.app.render() redraws the whole page)
  found: bar position depends on document height: short placeholder -> bar in flow mid-screen; drawn page -> bar stuck at bottom.
  implication: reserving the page's height while loading removes the shift; keeping the bar's buttons' nodes through a redraw keeps the found control in the page.

## Resolution

root_cause: "(1) assets/js/esign.js:3255 awaitingFor matched agreements where any signer of the account had signed; mineHTML (3270) then took the viewer's own signer via flowSigner, which is null for a co-investor who has no place on the agreement, and read .signedAt (3271) -> TypeError; the co link (coinvestor.js NS.views.co.after) had sent them to Documents, so the render threw and 'Opening your agreement…' stayed. Also: nothing told the firm the co-investor had nothing to sign, and adding a co place later never reached the already-signed agreement (its template was replaced on save, coAttach found no template). (2) On the phone the guide bar sits after the document (esign.css 443: order 5, sticky bottom); while loading, the document was one short 'Loading document…' line, so Finish sat mid-screen (y=586); the one-page W-8BEN's image arrives about when Finish appears and pagesOf's full NS.app.render() replaced the page: Finish moved to y=784 and was a new node, so the press on the Finish found was lost."
fix: "(1) esign.js: awaitingFor and mineHTML use mySigner (the viewer's own signer); coTask (what the co-investor has to do); tplOf (an agreement's template, or the offering's agreement now when it is the same file); saveAgreement attaches co-investors already on accounts (coAttach) and its toast names them. coinvestor.js: the co link's page says 'Nothing for you to sign' (why: the agreement has no place for a co-investor; firm contact; Go to Documents) or 'Not your turn yet'; placeless/placelessHTML: the sign-in email dialog and the Account window say why and how to add a place (Edit fields, 'Co-investor (if any)', save; Open <offering>), the add toast says so (self-serve only; managed unchanged). (2) esign.js pagesHTML(hold) in the signing view: each page's place is a blank page of its size while drawn ('Loading document…' on the first) + esign.css .es-page-blank; app.js drawKeeping: data-keep nodes survive a redraw (attributes/content synced, focus kept); signflow.js: Back, Start/Next, Finish carry data-keep."
verification: "RED (unfixed tree): press-w8-phone FAIL x3 (Finish moved 259,586 -> 259,784; found node not in page; elementHandle.tap: Element is not attached to the DOM); co-link-none-phone FAIL x12 (TypeError null.signedAt at esign.js:3271:68 <- mineHTML <- investorDocsHTML <- earlyDocuments portal.js:1003; stuck on Opening your agreement; no why/how; co not added after the place was saved). GREEN: press-w8-phone PASS (Finish at 259,784 found and after), co-link-none-phone PASS, co-link-wait-desktop PASS (new: Not your turn yet page). Verify: PRESS AND CO-INVESTOR: PASS (parts run: 9) + co-link-wait-desktop PASS (parts run: 1); CO-INVESTOR SERVER: PASS (parts run: 5); RECORD AND LOST AGREEMENT: PASS (parts run: 7); SIGNING DOCUMENTS: PASS (parts run: 8); SAFARI FINISH: PASS (parts run: 6); BANK STEP TYPING: PASS (parts run: 2); server tests 368/368. All in Chromium (iPhone emulation, CPU 4x for the press cases), sandboxed frame refusing connections; real WebKit not available here."
files_changed: [assets/js/esign.js, assets/js/coinvestor.js, assets/js/app.js, assets/js/signflow.js, assets/css/esign.css, .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/press-and-co-investor.js]
