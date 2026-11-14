---
status: diagnosed
trigger: "Automatic field placement fails on the owner's real subscription agreement. Owner's report: in the published preview 'it can't analyze', 'it can't place fields anywhere on its own', 'worse than before'; when asked what happened on upload: 'Fields in wrong places'. Owner's rule for the fix: 'you need to notice things about where the signers signature is, and where the counter signature is, it may not have either you need to be able to recognize whether it does or not, only add fields to corresponding fields and boxes on the agreement, don't start adding signature boxes placed randomly like before, it overlays the agreement'."
created: 2026-11-13T15:10:00Z
updated: 2026-11-13T15:46:00Z
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: CONFIRMED for questions 1 and 2 (see Resolution, causes 1 to 5): the code invents a signature block at fixed positions when it finds none, creates fields on underscores that are not blanks, gives no field to a blank under a label outside its vocabulary, and mislabels a blank whose label wraps; the checks could not see any of it. NOT ESTABLISHED for question 3: why the preview looked worse than the local run (cause 6).
test: done: local upload of the real PDF, eight sandbox and policy conditions in Chromium, one-change tests of each rule, the previous version on the same file, a simulated reading failure
expecting: nothing further can be learned from here without the real preview or the owner's answers
next_action: diagnosis complete for this session. Before or as the first step of the fix: get the owner's answers to the four open questions at the end of this file (the number of fields the editor announced after the upload in the preview decides between the three remaining explanations)
bug_class: design assumption (a signature block is always assumed and invented when not found) plus unhandled layout classes; not a crash or a regression of working code
reasoning_checkpoint: null
tdd_checkpoint: null

## Session Loop

goal: find_root_cause_only
tdd_mode: false
tdd_phase: none
resume_count: 0
awaiting: the owner's answers to the open questions (not blocking a fix plan for causes 1 to 5)
question: see "Open questions for the owner" at the end of this file
last_next_action: trace the rule behind each local miss in assets/js/placement.js and check which layouts the fixtures contain

## Symptoms
<!-- Written during gathering, then immutable -->

expected: For the owner's agreement, every tick box is tickable, every blank is fillable, every signature line is signable, each field sits on its own printed line or box and belongs to the right signer (the investor or the firm). The portal must recognise whether the document has an investor signature block and whether it has a countersignature block (it may have either, both or neither) and act on what is actually there. Fields are added only where the document has a corresponding blank or box. No field is ever placed anywhere else, and nothing may overlay the agreement's text.
actual: Fields in wrong places. Signature boxes are placed at spots that are not signature lines and cover the agreement's text. The owner's words: "it can't analyze", "it can't place fields anywhere on its own", "worse than before".
errors: No message was shown.
reproduction: In the published preview (a claude.ai artifact; the app runs in a sandboxed iframe), signed in as the sponsor, open an offering, upload the PDF as the subscription agreement. The document is at /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/real-agreement/agreement.pdf (13 pages, confidential: never copy it into the repository, never commit it, never quote its text in committed files).
started: Since the e-signature rebuild was published (version of 2026-11-13). It has never worked on this document. Every earlier check used agreements generated in code and ran only locally, never in the preview and never on a real agreement.

## Ground truth for the owner's agreement (counted by eye from the pages)

- Page 2: one blank, the capital commitment amount, inline after a two-line bold label (investor; onboarding knows the amount).
- Page 4: two tick boxes (a small square glyph at the start of a statement).
- Page 5: three tick boxes; then three blanks, each on the line BELOW its bold label: country of citizenship or organisation, country of primary residence or principal office, mailing address.
- Page 6: five tick boxes.
- Page 7: five tick boxes; one blank inline at the end of a three-line bold label (a percentage).
- Page 9 (entity subscribers only): five blanks: type of entity (blank below the label), jurisdiction of formation (inline), date of formation (inline), taxpayer identification number (below), name and title of authorised signatory (below).
- Page 11, heading "For Individual Subscribers": Print Name, Signature, Date, Social Security Number, Address, Email Address, Phone Number: seven lines, each a label followed by an underscore line. The Signature line is the investor's signature.
- Page 11, heading "For Entity Subscribers": Entity Name, By (this is the signature), Name, Title, Date, Taxpayer Identification Number (blank below the label), Address, Email Address, Phone Number: nine lines.
- Page 12, the general partner's acceptance (the firm, the countersigner): a short "$" blank for the accepted commitment inside a sentence, then By (the firm's signature), Name, Title, Date of Acceptance, Effective Date of Admission.
- Page 13: a wiring table with bracket placeholders. These are the sponsor's own text to complete before use and take no field.
- Pages 1, 3, 8 and 10 have nothing to fill in and must get no field.
- Totals: 15 tick boxes; 10 investor fill-in blanks on pages 2 to 9; 16 lines on the investor signature page (7 individual, 9 entity); 6 for the firm on page 12. 47 fields, and zero anywhere else.

## Questions the investigation must answer

1. What does the current code (assets/js/placement.js and the upload path in assets/js/esign.js: pageLayout, autoFields, the fallback block) produce for this exact PDF when run locally? Field by field against the ground truth: right, wrong kind, wrong place, wrong signer, missing; and every field placed where there is no blank (the owner saw signature boxes over text).
2. Why: for each class of miss, the rule or code path responsible (for example: tick boxes drawn as a text glyph and not as a square of pixels; a blank on the line below its label; a label that wraps over several lines; a "$" blank inside a sentence; "By:" as a signature; the fallback block that places fields at fixed positions when no signature label is found).
3. Does anything differ inside the preview's sandbox (strict content security policy, sandboxed iframe, the PDF library and its worker loaded from a CDN, canvas pixel reads)? Reproduce under comparable conditions and say whether placement there differs from the local run.

## Owner notes
<!-- APPEND only: relayed by the orchestrator during the session -->

- timestamp: 2026-11-13T15:18:00Z
  note: The owner says of the PDF: "This is just an example of a subscription agreement for a PPM."
  consequence: The root cause report describes each miss as a general class of layout the code cannot read (a blank on the line below its label, a tick box drawn as a text glyph, a signature page split into individual and entity blocks, a general partner acceptance block, and so on), not as a fix for this one document, and says which of those classes the code-generated test agreements never contained.

## Eliminated
<!-- APPEND only -->

- hypothesis: H2 the owner's own firm and fund names (printed in the agreement) change who each block is given to
  evidence: analyze() on the real layout with the names printed in the agreement, and with unrelated names, returns the same 48 fields for the same signers.
  timestamp: 2026-11-13T15:24:00Z

- hypothesis: H1a a sandboxed iframe with allow-same-origin, or a content security policy limited to the three script hosts with blob workers and connections blocked, stops the text or the pixels from being read
  evidence: In Chromium every such condition gives the same 48 fields with the same text items, lines and squares per page and no console error. The PDF library runs on the page (worker file loaded as a script), and the upload path fetches nothing.
  timestamp: 2026-11-13T15:27:00Z

- hypothesis: H4 the fields are stored in the right places but the rebuilt field editor draws them elsewhere
  evidence: Each field's drawn box was measured against its stored fractions on pages 5, 11, 12, 13, on a desktop and a phone viewport: no difference.
  timestamp: 2026-11-13T15:27:00Z

- hypothesis: H3 the browser's drawing of the page changes what the pixel scan finds, and that moves the fields
  evidence: With every line and square from pixels removed, analyze() still places the same 48 fields within 1.3 pt, from the text alone; it only marks them all for review. (Not run in another browser engine: none could be installed.)
  timestamp: 2026-11-13T15:38:00Z

- hypothesis: H5 the preview decodes the scripts in the wrong character set (the wrapper page declares none) and the label patterns stop matching
  evidence: Served as Latin-1 the scripts throw regular expression syntax errors and the app never reaches the console; the owner reached the upload, so the preview decodes them as UTF-8.
  timestamp: 2026-11-13T15:38:00Z

- hypothesis: H1b the text reading fails in the preview for a reason that can be found from here
  evidence: Not eliminated and not confirmed. No condition that could be built here makes getTextContent or pageLayout fail while the page images still render; the path was only shown by simulation. Left open: see Open questions for the owner.
  timestamp: 2026-11-13T15:44:00Z

## Evidence
<!-- APPEND only -->

- timestamp: 2026-11-13T15:20:00Z
  checked: The real PDF through the real upload dialog, locally (headless Chromium, the repository served on a local port, the sample firm of the self-serve edition, "Your firm countersigns" ticked). Script and output are outside the repository: scratchpad/real-agreement/work/run.js, scratchpad/real-agreement/out/local/ (fields.json, layout.json, page-NN.png with every field drawn on its page, scan-NN.png with the lines and squares the pixel scan found). Each page image was looked at.
  found: |
    48 fields, the draft opens in the field editor with 8 marked for review, no error, no fallback block. Against the ground truth (47 blanks):
    - Page 2: the commitment blank has a text field on its line, but it is labelled with the last printed line of its two-line label, is not recognised as the commitment amount and so is not filled in from onboarding (high confidence, not marked).
    - Pages 4, 5, 6, 7: all 15 tick boxes have a checkbox exactly on the printed square (high confidence).
    - Page 5: of the three blanks printed on the line below their label, two get NO field (country of citizenship or organisation, country of residence or principal office); the third (mailing address) gets a field on its line, marked for review, and is set to be filled in from the investor's address.
    - Page 7: the percentage blank has a text field on its line, labelled with the last printed line of its three-line label.
    - Page 9: four of five. The two inline blanks are right; two of the three blanks below their label are on their line and marked for review; the first one (type of entity) gets NO field.
    - Page 11: all 16 lines have a field of the right kind on the line, for the right kind of investor (7 for individuals, 9 for entities), the Signature line and the By line as signatures. The taxpayer number below its label is marked for review. Each signature box (26 pt tall) reaches 2 pt above the line before it and overlaps that line's field.
    - Page 12: all 6 for the firm: the "$" blank, By as the firm's signature, name, title, date of acceptance (a date field), effective date of admission (a text field, required).
    - Page 13: FOUR fields where there is no blank: a 16.5 pt text field, for the investor, required, inside each of the four bracket placeholders of the wiring table (marked for review, "A blank inside a sentence").
    - Pages 1, 3, 8, 10: no field (right).
    Totals: 44 of 47 blanks have a field on them, 3 blanks have none, 4 fields sit where the page has no blank. No signature field anywhere but on the three signature lines.
  implication: Locally the code reads this document far better than the owner describes. What the owner saw (signature boxes away from any line, "it can't analyze") is not what this code does with this file when the page text and the page pixels are both read. Either something in the preview stops one of those two readings, or the conditions of the owner's upload differ (firm and offering names, the countersign box, the browser). Both are tested next.

- timestamp: 2026-11-13T15:24:00Z
  checked: NS.placement.analyze run in Node on the layout read from the real PDF (scratchpad/real-agreement/work/whatif.js), with one condition changed at a time.
  found: |
    - Firm and offering named as printed in the agreement, or any other names: the same 48 fields, same signers.
    - "Your firm countersigns" unticked: analyze proposes the same 48; autoFields drops the 6 for the firm (42 fields).
    - Text read but pages not drawn (no lines, no squares): the same 48 fields within a point or two of the same places, all 48 marked for review ("estimated from the text").
    - Squares not found but lines found: 48 fields, 23 marked. Lines not found but squares found: 48 fields, 33 marked.
    - NO TEXT (pageLayout throws, or returns no pages, or the text of every page comes back empty): 6 fields, all from the fixed block: signature, name and date for the investor and the same three for the firm, on page 13 (the last page, the wiring exhibit) at x 61-241 / 379-489 pt and y 523-725 pt, where this page has no line at all. Every other blank of the agreement gets nothing.
  implication: H2 is eliminated. The only condition that turns this document into "fields in the wrong places and nothing placed on the real lines" is the text reading failing, and it does so without any message (autoFields catches the error, analyze adds the block, the editor opens as usual).

- timestamp: 2026-11-13T15:27:00Z
  checked: The same upload, through the dialog, with the artifact wrapper page (scratchpad/artifact/diy-portal.html) and the repository's assets, a new firm signed up as the owner does, headless Chromium (scratchpad/real-agreement/work/sandbox.js, results in scratchpad/real-agreement/out/sandbox/ and out/editor/). Conditions - wrapper as a top-level page; inside a cross-origin iframe with sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-same-origin"; the same without allow-same-origin; a Content-Security-Policy of default-src 'self', scripts from 'self' 'unsafe-inline' cdnjs.cloudflare.com cdn.jsdelivr.net unpkg.com only (no 'unsafe-eval'), connect-src 'none', worker-src 'none', child-src 'none', img-src 'self' data: blob:; the same policy without blob: for images; the iframe and the policy together; a phone-sized touch viewport.
  found: |
    - Top-level, iframe with allow-same-origin, the policy, both together, phone viewport: identical to the local run. 48 fields, the same 8 marked, text items, lines and squares counted the same on all 13 pages, no console error, no policy violation. The PDF library runs on the page itself (its worker file is loaded as an ordinary script, window.pdfjsWorker), so blocking blob workers changes nothing, and nothing in the upload path fetches anything (connect-src 'none' is never hit).
    - The editor draws every field exactly where its stored fractions say (largest difference 0 on pages 5, 11, 12, 13, desktop and phone). On page 11 the "Review" pill of a marked field covers part of the printed label above it (editor only).
    - Iframe WITHOUT allow-same-origin (opaque origin): localStorage throws SecurityError (the app copes: it starts and signs up in memory), and indexedDB.open throws SecurityError. The upload is refused: the dialog stays open and the toast shows the browser's raw sentence, "Failed to execute 'open' on 'IDBFactory': access to the Indexed Database API is denied in this context." No field is placed and no page is shown. NS.ops.files (operations.js) has no in-memory fallback.
    - Policy without blob: for images: placement is unchanged (48 fields) but none of the 13 page images loads ("Loading the image 'blob:...' violates ... img-src"), so the editor shows the fields over empty pages.
  implication: Under the sandbox conditions that can be built here, placement inside the preview does not differ from the local run, or the upload fails outright with a message. None of them produces misplaced fields. The wrong placement the owner saw was NOT reproduced.

- timestamp: 2026-11-13T15:28:00Z
  checked: What could NOT be reproduced, stated plainly.
  found: The real artifact host cannot be reached from this sandbox, so its true sandbox attribute, its true content security policy and whether it serves the current assets are unknown. Only Chromium is installed; downloading Firefox and WebKit is blocked (tried, into the scratch folder), so no Safari-engine or Firefox run was possible, and the owner's browser and device are unknown. Whether the file the owner uploaded in the preview is byte for byte the file in the scratch folder is unknown.
  implication: Question 3 is answered only for Chromium under comparable conditions. Open questions for the owner are listed under Resolution.

- timestamp: 2026-11-13T15:30:00Z
  checked: The fixed block itself (placement.js analyze(), lines 1209-1224), on this document with a signer's signature line taken away (scratchpad/real-agreement/work/fallback-demo.js, images in scratchpad/real-agreement/out/fallback/).
  found: |
    For each signer with no proposed signature field, block() adds signature (180 x 42 pt), name and date at fixed fractions of the LAST page: x at 10% and 62% of the width, top at the first of 66%, 50%, 34%, 18% (investor) or 82%, 66%, 50%, 34%, 18% (firm) of the height whose band holds no other PROPOSED FIELD. It never looks at the page's text or lines.
    - Pages 1-11 only (no general partner acceptance page) with "Your firm countersigns" ticked, which is the dialog's default: three fields for the firm at y 649-725 pt of the investor's signature page.
    - Pages 1-4 only (no signature page at all): six fields on page 4, a full page of text, at y 269-471 pt, covering 13 pieces of printed text (image no-signature-p4.png: signature, name and date boxes lie across the paragraphs).
  implication: This is the code path behind the owner's rule. The code never decides whether a signature block or a countersignature block EXISTS; it assumes both and, where it finds none, invents one at fixed positions on the last page.

- timestamp: 2026-11-13T15:36:00Z
  checked: The rule behind each local miss, confirmed by changing one thing at a time in the layout read from the real PDF and running analyze() again (scratchpad/real-agreement/work/rules-test.js), and by reading placement.js.
  found: |
    1. A blank on the line BELOW its label (pages 5, 9, 11). pageFields section 3 (lines 927-963) gives such a blank a field only when known() accepts its label (lines 724-728: a kind in the fixed vocabulary KINDS, such as address, taxpayer number, name and title). A label ending in a colon that is not in the vocabulary classifies as 'other' (line 454), a label over 64 characters or 10 words classifies as nothing, and in both cases line 956 returns without a field and without a mark. Test: rewording the two unplaced labels of page 5 to known labels places both; shortening them to short unknown labels still places neither; moving the blank of an unknown label onto the label's own line places it at high confidence (section 2, generic(), line 858). So the same label gets a field beside it and none under it. The known ones under their label are all marked "sits above its line" (line 960) although every label in the stack ends in a colon and nothing is printed under the last line.
    2. A label that wraps over several printed lines, the blank after its last words (pages 2 and 7). Lines 820-826 join a label with the printed line before it only when the last line starts in LOWER CASE, the line before is one piece of text, and the two together are at most 90 characters. On page 2 the second line starts with a capital, so the field is labelled with the tail of the label, is a plain required text field, and is not the commitment amount. Test: the same page with that one letter in lower case gives "Commitment amount" filled in from onboarding. On page 7 the label has three lines and the last two together exceed 90 characters, so the join is refused.
    3. Underscores between square brackets in a table (page 13). PIECE_RE (line 258) reads any run of three or more underscores as a blank, the bracket before it is not a label, so sentence() (lines 759-771, reached from line 860) proposes a required text field labelled "Text"; with no signer in the words, lines 1161-1164 give it to the investor. Nothing treats bracketed underscores, or a page whose own note calls them placeholders, as the sponsor's text. Marked for review, but if the sponsor confirms the marks, every investor must fill four fields in the wiring table.
    4. The signature box (page 11, 12). KINDS.signature (line 378) with boxOn() (lines 641-647) makes the box as tall as the empty paper above the line plus 4 pt: 26 pt here, on lines 23 pt apart, so its top edge lies on the line above and overlaps that line's field by 2 pt.
    5. What works on this document, checked the same way: tick boxes written as a text glyph (found both in the text and as a square of pixels), a signature labelled only "By", the split into individual and entity blocks (taken from the two sub-headings; without them both blocks go to every investor), the firm's acceptance block (given to the firm even with its heading removed), the "$" blank inside a sentence (read as the commitment amount only because a word that the rule excludes falls on an earlier printed line: sentence() reads one printed line back, not the sentence).
    6. Other paths that create a field where the page has no line, from reading the code (not triggered by this document): section 4 (lines 998-1029) puts a field after a signature, name or date label ending in a colon that has no printed line, when 60 pt of room follow it (low confidence), and after name, title and date labels printed under a signature line (lines 1009-1019, high confidence); an empty bracket pair "[ ]" or "( )" anywhere in text becomes a checkbox estimated from the text (PIECE_RE, lines 558-567).
  implication: On this document the misses are three classes of layout (label above its blank with a label outside the vocabulary; a label wrapping over lines; placeholders in brackets) plus the box height. Each is a rule that behaves as written.

- timestamp: 2026-11-13T15:38:00Z
  checked: How far the fields move if the pages cannot be drawn (scratchpad/real-agreement/work/textonly-diff.js), and what happens if the scripts are decoded in the wrong character set.
  found: With no lines and no squares from pixels, the same 48 fields are placed, every one within 1.3 pt of where it is with pixels, all 48 marked for review. Squares lost alone: 23 marked. Lines lost alone: 33 marked. Served as Latin-1 instead of UTF-8, the app's scripts fail with regular expression syntax errors and the console never opens.
  implication: A different browser drawing the page differently cannot move fields on this document; at worst it marks more of them. A wrong character set cannot be what the preview does, since the owner got as far as uploading.

- timestamp: 2026-11-13T15:40:00Z
  checked: The upload dialog with the reading of text made to fail on purpose (getTextContent rejects; SIMULATED, in the same iframe and policy as above), to see what the sponsor is shown on that path.
  found: No error and no message about a failure. The editor opens on page 1 with the note "6 fields were placed for you from the blanks in the PDF", the toast "6 fields need your review before investors can sign", and six fields on page 13 only. Four places swallow the error on the way: pageLayout returns [] when the stored file is missing (esign.js line 2378), its inner catch drops a page that cannot be drawn (lines 2409-2411), autoFields catches anything pageLayout throws and carries on with page sizes only (lines 2430-2436), and analyze() catches any error of a page (placement.js lines 1203-1207).
  implication: If reading fails for any reason, the sponsor is told fields were placed "from the blanks in the PDF" when none was read. This is the one path on which this exact file gives the owner's description; what would make it fail in the preview was not found.

- timestamp: 2026-11-13T15:42:00Z
  checked: The version before placement.js (git archive of e7ff20f^ into the scratch folder, never checked out in the repository), same PDF, same dialog.
  found: 8 fields, saved at once with the toast "Subscription agreement added with 8 signing fields", no editor. For the firm on page 12: signature, name and title beside their labels, and a date field laid over the acceptance sentence (the old date pattern matched a single word of a justified line, each word of which is its own piece of text). For the investor: a commitment field over the second line of its label on page 2, and signature, name and date at fixed positions on page 13, the wiring exhibit. Nothing on the investor's signature page.
  implication: "Signature boxes placed randomly like before, it overlays the agreement" describes exactly what the previous version did with this file. The current code, where it reads the file, does much better than that; where it does not, it puts all six fields on page 13, which is worse than before (the firm's block was at least on page 12).

- timestamp: 2026-11-13T15:44:00Z
  checked: What the Phase 1 checks measured (.planning/phases/01-accurate-field-placement/checks/ and the three plan summaries).
  found: |
    - The fixed block is REQUIRED by the checks: accuracy.js lines 61-62 fail the 'blank' fixture when "no fallback fields were placed"; the 'prose' fixture (two pages with nothing to sign) says "Nothing may be placed on them but the fallback block"; 01-03-SUMMARY records both as "6 (fallback)" with zero mistakes. labels.js filters the block out of nearly every assertion.
    - harness.judge() counts a field on no blank as a mistake only at HIGH confidence. A field on no blank that is marked for review (the four on page 13, the six of the block) is never a failure.
    - A layout held out for measurement does not fail on a missed blank (accuracy.js line 56).
    - Every fixture is HTML printed to PDF by Chromium or drawn with the PDF writing library. No PDF made by a word processor was ever read, none was run in the preview.
    - Classes the generated agreements never contained: a blank under a label that is not in the vocabulary (the only labels above lines were an investor name, a mailing address and city, state and ZIP); a label wrapping over lines with its blank after the last words; underscores in square brackets or any placeholder for the sponsor's own text; an agreement with a signature block for one signer only, judged on "nothing extra may be placed".
    - Classes they did contain, which is why those work on this document: tick boxes as a text glyph, blocks for individuals and for entities, a firm acceptance block, "By" as a signature, a "$" blank in a sentence, runs of underscores as text.
  implication: The behaviour the owner forbids was the specified, checked behaviour, and the measure of success could not see it.

## Resolution

root_cause: |
  Several causes together; none is a crash.
  1. The code has no notion that an agreement may lack a signature block. placement.js analyze() (lines 1209-1224) ends by giving every signer who has no proposed signature a signature, name and date at fixed fractions of the last page, chosen without looking at that page's text or lines. It is reached, with no message, whenever the text cannot be read (four catch points in esign.js pageLayout/autoFields and placement.js analyze) and whenever the document simply has no such block; the upload dialog ticks "Your firm countersigns" by default and the save gate (agreementTodo) demands a signature field for each signer. The Phase 1 checks require this block to appear.
  2. Other rules also create fields where the page has no blank: any run of underscores is a blank (PIECE_RE and sentence()), including placeholders in square brackets, and a blank with no signer in its words goes to the investor as required (lines 1161-1164); a signature, name or date label with no line gets a field after it (section 4, lines 998-1029); an empty bracket pair becomes a checkbox.
  3. A blank on the line below its label gets a field only when the label is in the fixed vocabulary (section 3, lines 927-963 with known(), lines 724-728); any other label gets nothing, silently. Three of the 47 blanks here.
  4. A label wrapping over printed lines is joined only when it has two lines, the second starts in lower case and the whole is under 90 characters (lines 820-826); otherwise the blank is labelled with the tail of its label and loses its kind. Here the commitment amount is not recognised, so onboarding does not fill it in.
  5. The checks could not see any of this: marked fields on no blank were never counted as mistakes, the fixed block was expected, every test agreement was generated in code, and the classes in 2 to 4 were not among them.
  6. NOT ESTABLISHED: why the owner's preview looked worse than the local run. With this file and this code, in Chromium, under a sandboxed iframe with allow-same-origin and a strict content security policy, the result is the local one: 48 fields, 44 on their blanks. The owner's description fits exactly one path of this code on this file: the text not being read, which yields six fields on page 13 and the note "6 fields were placed for you from the blanks in the PDF". What would cause that in the preview was not found.
fix: not applied (this session only diagnoses)
verification: not applicable
files_changed: []

## Open questions for the owner
<!-- The owner was not available during the session; these decide between the remaining explanations of the preview. -->

1. After the upload in the preview, the line under the buttons of the field editor says "N fields were placed for you from the blanks in the PDF". What was N, or did a short message say the agreement was "added with N signing fields" without the editor opening? 48 means the current code read the file (then the complaint is the four fields in the wiring table, the missing blanks and the review marks); 6 means nothing was read and only the fixed block was placed; 8 with no editor means the preview was still running the previous version.
2. Which browser and device was the preview opened in (Safari on a Mac, an iPhone or iPad, Chrome, the Claude app)? Only Chromium could be run here.
3. Was the file uploaded in the preview this exact PDF (13 pages, made with a word processor), or another agreement?
4. When an agreement has no signature line for the investor, or none for the firm, the portal will add nothing there. Should it then tell the sponsor and let the agreement be saved without that signer's signature, or hold the agreement until the sponsor places one by hand? Today the save gate demands one for each signer, and the dialog ticks "Your firm countersigns" before the PDF has been read.
