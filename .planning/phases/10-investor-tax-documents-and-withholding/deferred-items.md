# Phase 10: items found outside a plan's scope

- 2026-11-19, found by 10-03's gate: PHONE LAYOUT (reference gate line, plan 06-33) fails parts firms-phone and owner-phone,
  failure 14: on the console's Filings page (phase 9) the offering links are 17 px high on the phone (Pellbrook: Ventures I,
  Long/Short Fund, Digital Assets Fund, SPV I: Quillon, Ventures II; Ashwell Ridge: Cedar Row, Medical Office DST, Larch
  Commons; a new sponsor: "Add an offering"). The same two parts fail the same way on claude/refract-reskin at 8e38555 with
  no 10-03 change, so it comes from the phase 9 filings page meeting the 06-33 phone rules after both merged. Not fixed by
  10-03 (it touches no console or stylesheet file).
- 2026-11-19, 10-03: assets/js/intake.js (the document reader's own loader, D-33, not to be changed by 10-03) still loads
  the PDF reader, its worker and the PDF writer from the outside host, without checking whether they are already on the
  page. The paths that use it (reading an uploaded file in the import and intake screens) still need the network in the
  owner's preview. Every esign.js path (viewing, signing, tax forms, the signed record) no longer does.
- 2026-11-19, 10-03: the page's typography stylesheets (diy.html, index.html, brand.js, and signature.js's handwriting
  faces) come from fonts.googleapis.com. They are not PDF libraries and the frame's policy does not block styles; offline
  they do not load (10-03 did not measure what the page shows instead; in the taxform part the check browser answered them with an empty stylesheet and the signature was adopted and signed). Named here so the owner's iPhone check is read with this in mind.
- 2026-11-20, quick fix walk3-fixes (06-WALKTHROUGH-3 failure 4): NS.taxUI.PARTS in assets/js/taxdocs-ui.js no longer
  lists tax1099-ui.js and taxlink.js, so a page load asks for no file that is not shipped. Plan 10-10 must add
  'tax1099-ui.js' back after 'tax1099.js', and plan 10-12 must add 'taxlink.js' last, in the same commit as the file
  (10-10's interface note "tax1099.js and tax1099-ui.js are in NS.taxUI.PARTS" holds only once 10-10 adds it).
