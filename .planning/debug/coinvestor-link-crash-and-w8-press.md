---
status: investigating
trigger: "Walkthrough 3 (b14): (1) co-investor sign-in link sticks on 'Opening your agreement…' with TypeError null.signedAt at esign.js:3271 mineHTML; (2) N4: W-8BEN Finish redrawn under the press at CPU 4x, press lost."
created: 2026-11-20
updated: 2026-11-20
---

## Current Focus

bug_class: Bohrbug (both deterministic; (2) timing-window but reproduced deterministically by holding the page image)
hypothesis: (1) CONFIRMED: esign.js awaitingFor (3255) matches envelopes where ANY signer of the account signed; mineHTML (3270) then looks up the VIEWER's signer via flowSigner (co flag from state.co) -> null for a co-investor on an agreement with no co signer -> TypeError. (2) CONFIRMED: on the phone the guide bar is order:5 sticky-bottom after the document; with the 1-page W-8BEN the image arrives right as Finish appears; pagesOf's NS.app.render() replaces the whole page (new Finish node) and moves Finish from y=586 (after the short 'Loading document...' placeholder) to y=784 (stuck at the screen bottom).
next_action: fix (1) awaitingFor/mineHTML use mySigner; co link page for nothing-to-sign; console why/how; template save attaches co. Fix (2): loading placeholder reserves page space (no shift); render keeps data-keep nodes (bar buttons).

## Symptoms

expected: (1) co-investor link never crashes; if nothing to sign, page says so plainly with a way out; console explains (no co-investor places; how to add). (2) W-8BEN Finish pressed the moment it appears works on the first press at CPU 4x.
actual: (1) stuck on "Opening your agreement…", TypeError: Cannot read properties of null (reading 'signedAt') at esign.js:3271 (mineHTML <- investorDocsHTML <- portal.js:1003 earlyDocuments). 4 of 4 tries. (2) iphone-a2: Finish redrawn under the press, second press worked (1 of 1 W-8BEN fast-Finish runs; W-9 fast-Finish runs fine).
errors: TypeError: Cannot read properties of null (reading 'signedAt') at esign.js:3271
reproduction: (1) account investor signed agreement awaiting countersign, agreement has no co-investor places; Investors > Account > Add co-investor > Open the co-investor's link. (2) CPU 4x, foreign individual, W-8BEN answers filled, press Finish the moment it appears.
started: 06-37/06-39 code paths

## Eliminated

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

root_cause:
fix:
verification:
files_changed: []
