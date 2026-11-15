# Roadmap: Investor Portal E-signature Rebuild

## Overview

The portal's e-signature works but is not market ready. This roadmap rebuilds it in five phases, each fixing one thing the owner named: first the automatic placement of fields on subscription agreements, then the manual field editor, then the signatures themselves, then the investor and sponsor signing steps inside onboarding, and finally the legal-grade signed record. Signing stays a step of onboarding throughout; nobody is ever sent to a separate tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Accurate Field Placement** - The portal finds what the client signs, fills in and initials on a subscription agreement, places the right field on the right line, and flags uncertain ones for the sponsor to confirm
- [ ] **Phase 01.1: Placement reads what the agreement has: fields only on its own blanks, boxes and signature lines**
- [ ] **Phase 01.2: Agreements that are pictures: the reader reads the owner's form**
- [ ] **Phase 01.3: The owner's text agreements are read 100 percent**
- [ ] **Phase 01.4: Every subscription agreement: the reader is trained and measured on a large set of real EDGAR subscription agreements**
- [ ] **Phase 2: Field Editor** - A smooth, polished editor where fields drag cleanly within and across pages
- [ ] **Phase 3: Signatures** - Cursive and other signature styles, a natural drawn signature, upload, adopt once
- [ ] **Phase 4: Signing Inside Onboarding** - A polished, guided signing step for investors and countersigning for sponsors, with no separate tool
- [ ] **Phase 5: Signed Record** - Final signed PDF with certificate page, audit trail and tamper evidence
- [ ] **Phase 6: Onboarding forms: W-9 and W-8 collected in the investor onboarding, plus investor-status questions (506(b) non-accredited count of 35, Reg A Tier 2 10 percent investment limit, ERISA 25 percent benefit-plan test)**

## Phase Details

### Phase 1: Accurate Field Placement
**Goal**: The portal reads a subscription agreement, works out what the client signs, what the client fills in and what needs initials, places each field correctly, and never passes off a guess as certain
**Depends on**: Nothing (first phase)
**Requirements**: PLACE-01, PLACE-02, PLACE-03, PLACE-04, PLACE-05, PLACE-06, PLACE-07
**Success Criteria** (what must be TRUE):
  1. On a set of real-style subscription agreements, signature, date and name fields sit on their printed lines
  2. Investor fields and sponsor countersignature fields are assigned to the right signer
  3. Signature lines become signature fields, initial lines become initials fields, and blanks to complete become fillable fields, all without the sponsor adding them
  4. Fill-in fields the portal already has answers for from onboarding arrive filled in
  5. Fields the portal is unsure about are flagged, and the agreement cannot be used until the sponsor confirms or moves them
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Read the agreement from its printed lines: signature-block fields on their lines, for the right signer, each with a confidence level
- [ ] 01-02-PLAN.md — Initials, fill-in blanks and tick boxes become fields; unsure fields are marked and must be confirmed or moved before the agreement can be used
- [ ] 01-03-PLAN.md — Fill in from onboarding what the portal already knows; each investor gets the block for their kind of account; closing accuracy measurement

### Phase 01.1: Placement reads what the agreement has: fields only on its own blanks, boxes and signature lines (INSERTED)

**Built outside GSD planning (2026-11-13):** after the owner made GSD optional, this phase was built directly from its research, criteria and design contract (reader, field look, read again, co-investor), proven by an independent proof run and reviewer. No PLAN or SUMMARY files exist for it and GSD's verifier has not run on it.

**Goal:** The portal reads an uploaded subscription agreement and places a field only where the agreement itself has a place for one (a printed blank, a printed tick box, a printed signature line, or a form field the PDF already carries); every such place gets its field, of the right kind and for the right person; it recognises whether the agreement has an investor signature block and a countersignature block (both, one or neither) and sets up signing to match; it never invents a position, says what it read, and says so when it could not read
**Requirements**: PLACE-08, PLACE-09, PLACE-10, PLACE-11, PLACE-12, PLACE-13, PLACE-14, LOOK-03
**Depends on:** Phase 1
**Success Criteria** (what must be TRUE):
  1. On agreements made by several layout engines, on public real agreements and on the owner's held-out example, every printed tick box, blank and signature line has its field on it, and no automatic field is anywhere else, over printed words, inside the sponsor's bracketed text or overlapping another field, at any confidence
  2. Each field carries the agreement's own complete label and the right kind, belongs to the right person (the investor, the right kind of investor, or the firm), and arrives filled in where onboarding already holds the answer
  3. The portal recognises an investor signature block and a countersignature block separately (both, one or neither), tells the sponsor in a plain summary, sets up signers to match, and does not let an agreement with no investor signature field be used
  4. When a PDF or some of its pages cannot be read the sponsor is told exactly that, nothing is placed by guesswork, and the sponsor can have the PDF read again without losing fields they placed, moved or changed
  5. All of it works the same inside the published preview's sandbox, with storage and without, with no network request beyond the script loads; a 13-page agreement is read in seconds and a 60-page one shows progress
  6. An individual, an entity and the firm can each complete the agreement end to end, and the finished PDF shows every value on its own line, never a "?" and never a repeated currency sign
  7. Every field box shown on the agreement (sponsor's editor, investor's signing step, firm's countersigning) has rounded corners, an even edge and clear states, and no tag or mark covers the agreement's words, at desktop and phone widths, in light and dark, for each sample firm
  8. The earlier checks of phases 1 to 5 pass without having been loosened, and the owner has checked their own document in the republished preview
**Plans:** 0 plans
**UI hint**: yes

Plans:
- [ ] TBD (run /gsd-plan-phase 01.1 to break down)

### Phase 01.2: Agreements that are pictures: the reader reads the owner's form (INSERTED)

**Goal:** A sponsor can have a subscription agreement whose pages are pictures read by the portal: when the sponsor asks with one click, the portal finds every printed box and line a person completes on each picture, puts one field on each and none anywhere else, gives each field the right kind and the right person from the words printed with it, marks every such field for checking, and says truthfully what it read and what it could not; the owner's own 8-page form is read in full, and the owner has checked it in the preview
**Requirements**: READ-01, READ-02, READ-03, READ-04, READ-05
**Depends on:** Phase 01.1
**Success Criteria** (what must be TRUE):
  1. On the owner's form, through the real upload dialog and the offer, the independent scorer reports 241 of 241 printed places found, 0 stray fields, 0 overlaps, 0 kind differences and 0 owner differences, with the reading time; a field comes only from a box or line found on the picture, never from a recognised word
  2. Each field is the kind its place prints (tick box, initials, signature, date beside a signature, typed blank) and is named from the caption printed with its box as far as the print can be read; a box whose caption cannot be read still has its field, named by its shape and marked
  3. Each field is for the right person: the investor's are the investor's, a second investor's are signed by the co-investor, and a third party's are nobody's required field (optional, marked, named for that party, shown as for someone else, and handed to no signer); the read summary says whose signature lines were found and on which pages, and a third party's signature is never counted as the investor's
  4. Nothing is placed on a page with no text until the sponsor presses "Read these pages from their picture"; every field placed that way is marked for checking and is confirmed before the agreement is used, a page the sponsor has checked with one action and the few fields the portal could not name or whose owner it is unsure of one by one; pages read from their picture are named as such; when the words cannot be read the boxes still get their fields and the summary says exactly that
  5. The other picture documents hold: the scanned and the outlined copy of the example each give the 47 expected fields, the prose copies give none, and the scanned public binder and the completed booklet get no unclean field
  6. Normal PDFs are untouched: the owner's first agreement stays at exactly 47 fields with none marked and no recognition file loaded, prose stays at zero, and the proof run and the nine earlier check files pass
  7. A page is read from its picture in under 6 seconds with progress shown, and at the time limit the sponsor is told truthfully which pages' words were not read
  8. It works inside the hosted preview: the text reader starts from the portal's own files with no request under the preview's rules, every file is of a type the host serves, and where the host refuses the reader the boxes are still found and their fields named by shape
  9. One whole-page picture of each page of the owner's form from the portal's own editor has been looked at and shown to the owner, and the owner has checked their own form in the republished preview
**Plans:** 7 plans

Plans:
- [ ] 01.2-01-PLAN.md — The finder: boxes and lines from the picture's pixels alone, wired through the real upload dialog and proven alone at three ink levels on three documents
- [ ] 01.2-02-PLAN.md — The text reader starts with no request from the portal's own files, proven in the preview's frame, with a probe page for the real host
- [ ] 01.2-03-PLAN.md — Reading the caption bands: only the words round each found box and line, in seconds a page; one stated page shape for placement
- [ ] 01.2-04-PLAN.md — Kind, owner and summary: one field a place, the right kind and person, a third party's places through the owner Phase 01.3's plan 01.3-03 builds (which must be merged first), a truthful summary
- [ ] 01.2-05-PLAN.md — The other picture documents: the scanned and outlined copies, prose, the two public scans through the offer, and whole-page pictures
- [ ] 01.2-06-PLAN.md — What the sponsor does: seconds a page, progress, a truthful time limit, and one action that confirms a page they have checked
- [ ] 01.2-07-PLAN.md — Proof and the owner's check: everything in one run, inside the frame as well, the files to publish, then the owner

### Phase 01.3: The owner's text agreements are read 100 percent (INSERTED)

**Goal:** The three text agreements the owner supplied (document A, the 21-page subscription document; document B, the 32-page partnership agreement; document C, the subscription agreement with questionnaire supplied as a word-processing file and read as its PDF) are each read exactly: every printed place has its field, of the right kind, for the right person, under the document's own label, and nothing else has one; a place meant for somebody else is shown as theirs and asked of nobody; the read summary says truthfully who signs and who does not; a file that is not a PDF offered as an agreement is answered in plain words; and every document the reader already read correctly still is
**Requirements**: SET-01, SET-02, SET-03, SET-04
**Depends on:** Phase 01.1
**Success Criteria** (what must be TRUE):
  1. Through the real upload dialog, documents A, B and C each score 100% against an answer sheet made independently by looking at every page: every place found, no field anywhere else, no overlap, no field over printed words, kinds, owners, required and review marks right
  2. A place for somebody else (a custodian, an adviser, the writer of a letter and the like) is shown as theirs: optional, never filled in from the investor's onboarding, never counted as the investor's or the firm's signature line, asked of nobody at signing, and unmarked where the reader is sure
  3. The read summary counts printed places and says truthfully who signs: no place for the investor or the firm to sign (document A), only the firm signs (document B), an acceptance block in doubt (document C); a place left without a field is always said
  4. A document only the firm signs can be signed by the firm, is never offered to investors as the agreement they sign, and the sponsor is never told to add an investor signature field to it
  5. A word-processing file offered as an agreement is refused in plain, lasting words that name no product and say to save it as a PDF and upload that; nothing is stored
  6. An individual, an entity (where the document provides for one) and the firm complete each document end to end, and the finished PDF shows every value on its own place
  7. The owner's first agreement stays at exactly 47 fields with none marked and with every label unchanged, the seven public documents keep their pinned field counts (38, 0, 0, 64, 58, 0, 147) with zero unclean, the proof run and the nine check files stay green, and every rule is a convention class proved on a made-up page
  8. After the verifier passes and the preview is republished, the owner has checked the three documents in it
**Plans:** 9 plans

Plans:
- [ ] 01.3-01-PLAN.md — Pin what already works, tighten and hash the three scorers, and add the class-page runner with the pages for the owner "somebody else" and for documents A and B (no reader change)
- [ ] 01.3-02-PLAN.md — The made-up pages for document C's conventions, for labels and for a signature page that is not printed, the ordinary-table guard, and the dialog check for a file that is not a PDF (no reader change)
- [ ] 01.3-03-PLAN.md — The owner "somebody else" end to end on one convention: the tracer, and the shared contract Phase 01.2 waits for
- [ ] 01.3-04-PLAN.md — Every class document A needs and the label rule: document A's places all right
- [ ] 01.3-05-PLAN.md — Who completes a place on a form: captions that are not headings, a third party's section, the acceptance block in doubt, the two lists of initials, and the firm's block by its printed name (documents B and C)
- [ ] 01.3-06-PLAN.md — An empty ruled cell is named by the caption over it, with the guard for ordinary tables, and the smaller place-finding classes: document C's places all right
- [ ] 01.3-07-PLAN.md — The read summary counted from printed places, and the plain answer to a file that is not a PDF: documents A and C pass in full
- [ ] 01.3-08-PLAN.md — The way forward for a document only the firm signs: document B passes in full
- [ ] 01.3-09-PLAN.md — End-to-end walks on the three documents, the whole proof in one run, and the owner's check in the republished preview

### Phase 01.4: Every subscription agreement: the reader is trained and measured on a large set of real EDGAR subscription agreements (INSERTED)

**Goal:** A sponsor uploads any subscription agreement, in any format (typed, filed PDF, browser print in portrait or landscape, picture form, tinted form, scan), and it is ready to send with nothing else to do: every place a person completes is found, every field sits on its printed place and nowhere else, with the right kind and person (labels are shown plainly and not judged, D-24); the portal reads it automatically inside its own page with its own rules and small models trained on real EDGAR agreements, white-label, with no document leaving the sponsor's computer; the editor stays for optional changes
**Requirements**: ANY-01, ANY-02, ANY-03, ANY-04, ANY-05, ANY-06
**Depends on:** Phase 1
**Success Criteria** (what must be TRUE):
  1. Held-out A (39 real agreements with exact answer sheets, frozen before any work): 39 of 39 ready to send by the exact scorer: every place found, no stray field, no kind or person difference, no review mark (label differences reported for information only)
  2. Held-out B (63 agreements collected and frozen before work on them, scans, picture prints and broker-dealer forms included, never seen by any builder): at least 95 percent ready to send and at least 99.5 percent of places right first time (found, right kind and person, unmarked; labels not judged), scored once at the end
  3. The whole set of real EDGAR agreements (several hundred): at least 95 percent ready to send; no picture offer, no document with zero fields, unreadable or timed out, no missing signature field; review marks and strays each at most 0.5 percent of fields; at most 60 seconds a document at the 95th percentile with no console error
  4. The sponsor only uploads: no button, confirmation, install or page to check; everything runs in the portal (D-31: the agreement is read through the API from the portal's own server, white-labelled; the in-page reader is the fallback); no vendor or library name is visible anywhere
  5. Nothing that works today regresses: the owner's documents A 29 of 29, B 2 of 2 places, C 138 of 138, the picture form 241 of 241, the first agreement's 47 fields with none marked, the public documents' pins, the nine check files, the class pages and the walks
  6. After the reader is frozen, 100 fresh agreements and 50 more made picture-only (half clean, half with scan effects), drawn at random from EDGAR and new to every set, are read by the frozen reader and scored (the measure on all 150, exact scores on a random 20 and 10), and the results reach the owner failures first
  7. The owner has checked agreements the reader has never seen in the republished preview
**Plans:** 66 plans (4 dropped by D-28: 20, 21, 56, 57; 12 added: 59 to 69 and 71; 70 ran as a quick task)

Plans:
- [ ] 01.4-01-PLAN.md — The measure sees what it was blind to (fallback glyph boxes, letter boxes, dates in parts, shared lines, illustrations), calibrated
- [ ] 01.4-02-PLAN.md — One gate for the phase: exact scoring of every sheeted set with a ratchet, targets in one command; held-out A and B blind to builders by tooling (totals only, read seal, artifact guard)
- [ ] 01.4-03-PLAN.md — Answer-sheet tools and the stratified tranche of 36 train documents (batches of 6), proven on two
- [ ] 01.4-04-PLAN.md — Training environment outside the repository after a human checks every package
- [ ] 01.4-05-PLAN.md — The in-page model runtime, human-checked and vendored as scripts, proven inside the preview frame
- [ ] 01.4-06-PLAN.md — At least 300 more EDGAR agreements; held-out B (63) frozen from metadata; 15 added documents for full sheets, 50 for review
- [ ] 01.4-07-PLAN.md — Picture pages read automatically on upload: no button, nothing to press
- [ ] 01.4-08-PLAN.md — Tracer: a place model trained here runs in the page and turns snapped places into fields, end to end
- [ ] 01.4-09-PLAN.md — Full answer sheets for tranche batch TR01 (6 train documents)
- [ ] 01.4-10-PLAN.md — Full answer sheets for tranche batch TR02 (6 train documents)
- [ ] 01.4-11-PLAN.md — Full answer sheets for tranche batch TR03 (6 train documents)
- [ ] 01.4-12-PLAN.md — Full answer sheets for tranche batch TR04 (6 train documents)
- [ ] 01.4-13-PLAN.md — Full answer sheets for tranche batch TR05 (6 train documents)
- [ ] 01.4-14-PLAN.md — Full answer sheets for tranche batch TR06 (6 train documents)
- [ ] 01.4-15-PLAN.md — Full answer sheets for batch PS01 (5 added picture, scan or broker-dealer train documents)
- [ ] 01.4-16-PLAN.md — Full answer sheets for batch PS02 (5 added picture, scan or broker-dealer train documents)
- [ ] 01.4-17-PLAN.md — Full answer sheets for batch PS03 (5 added picture, scan or broker-dealer train documents)
- [ ] 01.4-18-PLAN.md — Biggest-yield vector classes: fallback-glyph boxes, missed squares, short-rule choices, shared lines, single lines, hyphen blanks
- [ ] 01.4-19-PLAN.md — Dates in parts and letter-box rows end to end (field model, editor, signing, PDF), fill-in cells, signature blocks
- [ ] 01.4-22-PLAN.md — Fast path: automatic labels for every typed train document, quality measured against hand sheets, a small review sample, trust by a fixed rule
- [ ] 01.4-23-PLAN.md — The meaning layer's blocks, features and evaluator in the page; features dumped for train documents
- [ ] 01.4-24-PLAN.md — Adjudicate bootstrap batch BT01 (about 36 train documents, disagreements only)
- [ ] 01.4-25-PLAN.md — Adjudicate bootstrap batch BT02 (about 36 train documents, disagreements only)
- [ ] 01.4-26-PLAN.md — Adjudicate bootstrap batch BT03 (about 36 train documents, disagreements only)
- [ ] 01.4-27-PLAN.md — Adjudicate bootstrap batch BT04 (about 36 train documents, disagreements only)
- [ ] 01.4-28-PLAN.md — Adjudicate review batch AS01 (25 added picture, scan or broker-dealer documents, disagreements only)
- [ ] 01.4-29-PLAN.md — Adjudicate review batch AS02 (25 added picture, scan or broker-dealer documents, disagreements only)
- [ ] 01.4-30-PLAN.md — Variants and the place model trained on one fold to choose, five folds for the chosen, capped detached runs
- [ ] 01.4-31-PLAN.md — The meaning models trained, calibrated and exported, identical in the page
- [ ] 01.4-32-PLAN.md — The trained place model ships and judges every unsure place on every page, inside the time target
- [ ] 01.4-33-PLAN.md — Kind, person and label decided by the models with the rules as guard, person per block
- [ ] 01.4-34-PLAN.md — Review marks as a last resort, no page confirmation, the checks moved to the owner's decision
- [ ] 01.4-35-PLAN.md — Bounded iteration I: corrected labels, both models retrained once, the top four residual classes fixed
- [ ] 01.4-36-PLAN.md — Held-out A sheets audited by an agent who builds nothing (the only audit-mode use)
- [ ] 01.4-37-PLAN.md — Bounded iteration II: the next four classes, models current, every target measured with the next step stated
- [ ] 01.4-38-PLAN.md — Every document within the time target with the same fields; the complete reading proven inside the preview frame
- [ ] 01.4-39-PLAN.md — Held-out B answer sheets, batch B01, by an agent who builds nothing
- [ ] 01.4-40-PLAN.md — Held-out B answer sheets, batch B02, by an agent who builds nothing
- [ ] 01.4-41-PLAN.md — Held-out B answer sheets, batch B03, by an agent who builds nothing
- [ ] 01.4-42-PLAN.md — Held-out B answer sheets, batch B04, by an agent who builds nothing
- [ ] 01.4-43-PLAN.md — Held-out B answer sheets, batch B05, by an agent who builds nothing
- [ ] 01.4-44-PLAN.md — Held-out B answer sheets, batch B06, by an agent who builds nothing
- [ ] 01.4-45-PLAN.md — Held-out B answer sheets, batch B07, by an agent who builds nothing
- [ ] 01.4-46-PLAN.md — Held-out B answer sheets, batch B08, by an agent who builds nothing
- [ ] 01.4-47-PLAN.md — Held-out B answer sheets, batch B09, by an agent who builds nothing
- [ ] 01.4-48-PLAN.md — Held-out B answer sheets, batch B10, by an agent who builds nothing
- [ ] 01.4-49-PLAN.md — Held-out B answer sheets, batch B11, by an agent who builds nothing
- [ ] 01.4-50-PLAN.md — Held-out B scored once, everything in one final run, and the reader frozen at a recorded commit
- [ ] 01.4-51-PLAN.md — Final check (D-25, D-28): 100 fresh typed or filed agreements drawn at random after the freeze, new to every set, read by the frozen reader and measured
- [ ] 01.4-52-PLAN.md — Fresh-check answer sheets, batch F01, by an agent who builds nothing
- [ ] 01.4-53-PLAN.md — Fresh-check answer sheets, batch F02, by an agent who builds nothing
- [ ] 01.4-54-PLAN.md — Fresh-check answer sheets, batch F03, by an agent who builds nothing
- [ ] 01.4-55-PLAN.md — Fresh-check answer sheets, batch F04, by an agent who builds nothing
- [ ] 01.4-58-PLAN.md — Exact scores of the fresh 20 against the D-28 bar, the owner's report failures first, fix and test again (D-27), and the owner's check
- [ ] 01.4-59-PLAN.md — Picture notice on upload and proof step 5 re-pinned at the frozen picture state (D-28)
- [ ] 01.4-60-PLAN.md — set-e: about 2,000 more typed and filed agreements, one shared rate limiter, lean storage, backed up to reader-data
- [ ] 01.4-61-PLAN.md — set-e labelled by three voters, the agreement rule and trust chosen on hand sheets, one review tranche sized
- [ ] 01.4-62-PLAN.md — set-e review tranche ET01 with spot checks of the automatic labels
- [ ] 01.4-63-PLAN.md — D-30: investor or sponsor only, no investor field mandatory, pre-filled investor fields editable; scorers judge two people
- [ ] 01.4-64-PLAN.md — D-31: the API reader from server/ (white-labelled, key on the server only), fields snapped to printed geometry, the in-page reader as fallback, leak row extended to provider and model names
- [ ] 01.4-65-PLAN.md — D-31: the API reader measured on gold and held-out A through the real upload, cost and seconds per agreement, failures first (needs CARROWVALE_API_KEY; NOT RUN without it)
- [ ] 01.4-66-PLAN.md — D-36: offering intake rerouted from the viewer's own model to POST /v1/intake on the owner's key (same prompt, same JSON, every intake function byte-identical); shared SDK install, client module and spend cap that plan 64 reuses; measuring tool proved without spending
- [ ] 01.4-67-PLAN.md — D-34/D-35/D-40/D-42: both blind PPMs, each read exactly once (ppm2.pdf text path, $3.00; ppm.pdf picture path with its frozen key, $8.00): ppm2 key by an agent who builds nothing, zero-spend worst-case probes, one run each by the orchestrator with the key, a score line each against the 90 percent bar, failures first (after 66, 68, 69)
- [ ] 01.4-68-PLAN.md — D-37/D-38: PDF fallback for PPMs whose extracted text is unreadable (readability test tuned on public PDFs; readable PDFs keep the exact D-36 request); PDFs over one request's limits (600 pages, 32 MB encoded, token count) read in page ranges and merged, never cut; measure part fits a test cap by max tokens first
- [ ] 01.4-69-PLAN.md — D-38: subscription API reader reads picture-only and broken-text pages from numbered page images with the picture reader's pixel candidates; long agreements read whole in ranges; silent retries; no dialog or allow step; a firm signature place guaranteed after every reading (walkC); walkA to two people (D-30); owner gate walk rows green; picture-pdf tool for plan 65
- [ ] 01.4-71-PLAN.md — D-44: one PPM upload with the subscription agreement inside does both: the PPM reader reports the agreement's pages, the portal cuts them into their own PDF, makes it the offering's agreement and reads it in the background with no question; review states the pages and lets the sponsor adjust them; fake-mode checks on a public combined PDF; one real run by the orchestrator on the blind combined file (zero-spend probe, $6.00 cap); starts after the queued blind readings

### Phase 2: Field Editor
**Goal**: A sponsor can adjust fields by hand quickly and without frustration, in an editor that looks professionally made
**Depends on**: Phase 1
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, LOOK-01
**Success Criteria** (what must be TRUE):
  1. A field follows the pointer smoothly and can be dragged from one page to another in one movement
  2. Sponsor can add, resize, duplicate, delete, retype and reassign fields, with snapping, keyboard nudging and undo
  3. The editor is usable on a long document and on a touch screen, and matches the portal's design system
**Plans**: TBD
**UI hint**: yes

### Phase 3: Signatures
**Goal**: Signers can create a signature that looks like a real one
**Depends on**: Nothing (independent of Phases 1 and 2)
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04
**Success Criteria** (what must be TRUE):
  1. Signer can pick from several typed styles, including cursive handwriting
  2. A drawn signature looks smooth and natural, and an uploaded image can be used instead
  3. A signature and initials adopted once are applied to all of that signer's fields
**Plans**: TBD
**UI hint**: yes

### Phase 4: Signing Inside Onboarding
**Goal**: Signing is a seamless, good-looking step of onboarding for the investor and of the console for the sponsor
**Depends on**: Phase 2, Phase 3
**Requirements**: SIGN-01, SIGN-02, SIGN-03, SIGN-04, SIGN-05, LOOK-02
**Success Criteria** (what must be TRUE):
  1. An invited investor reaches and completes signing inside onboarding with no extra account, sign-up or tool, and no sponsor action after fields are set
  2. The investor is guided field to field and can see what remains, on a phone as well as a desktop
  3. The sponsor countersigns from the console, and investors see only the sponsor firm's brand
**Plans**: TBD
**UI hint**: yes

### Phase 5: Signed Record
**Goal**: A completed agreement is a document that stands on its own
**Depends on**: Phase 4
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05
**Success Criteria** (what must be TRUE):
  1. Completing signing produces a final PDF with all signatures and values in place and a certificate page
  2. The audit trail lists each event with time and signer, including consent to sign electronically
  3. A later change to the signed PDF can be detected, and investor and sponsor can each download it
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Accurate Field Placement | 0/3 | Not started | - |
| 2. Field Editor | 0/TBD | Not started | - |
| 3. Signatures | 0/TBD | Not started | - |
| 4. Signing Inside Onboarding | 0/TBD | Not started | - |
| 5. Signed Record | 0/TBD | Not started | - |

### Phase 6: Onboarding forms: W-9 and W-8 collected in the investor onboarding, plus investor-status questions (506(b) non-accredited count of 35, Reg A Tier 2 10 percent investment limit, ERISA 25 percent benefit-plan test)

**Goal:** An invited investor answers the investor-status questions their offering's exemption calls for and fills and e-signs the official IRS W-9 or W-8 inside onboarding, with nothing mandatory; the sponsor sees the Rule 506(b) non-accredited count against 35, Regulation A Tier 2 over-limit flags and the benefit-plan percentage per class against 25 percent, and receives the signed tax form
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, FORM-09, WL-01
**Depends on:** Phase 5
**Plans:** 12 plans

Plans:
- [ ] 06-01-PLAN.md — Investor status step, Rule 506(b) slice: accredited or sophisticated non-accredited answers on the request, the forced "accredited" tick removed, sponsor's N of 35, console headings renamed "Offering details" (D-01, C-02, D-30)
- [ ] 06-02-PLAN.md — Every 506(b) case: the 36th warned and flagged never blocked, unanswered, other exemptions, 90-day note and 502(b) reminder, investor on file, corrections, purchaser representative's acknowledgment upload, managed edition proved unchanged (C-01, C-03)
- [ ] 06-03-PLAN.md — Regulation A Tier 1 / Tier 2 split (untiered = Tier 2), Tier 2 income and net worth (or revenue and net assets), the 10 percent limit, over-limit warning and sponsor flag (C-04, C-01)
- [ ] 06-04-PLAN.md — Benefit-plan (ERISA) questions for every offering, per-class percentage against 25 percent with if-accepted flags; every onboarding walker learns the new step
- [ ] 06-05-PLAN.md — The full 25 percent figure: sponsor's controlling-person and affiliate marks, plan-asset entities, several classes, value basis named, unanswered holders
- [ ] 06-06-PLAN.md — Server mode harness: status answers travel through /v1/invite/complete into the console and are counted as in local mode
- [ ] 06-07-PLAN.md — Server mode: the 506(b) warning by one snapshot boolean, the investor on file carries plan answers and basis both ways, the acknowledgment file through the allowlist; owner's screenshot set of the status step
- [ ] 06-08-PLAN.md — Official IRS PDFs pinned by SHA-256, every form field enumerated with pdf-lib, field maps written only from that list, fill and flatten proved (precondition: the PDFs and the owner's in-house choice)
- [ ] 06-09-PLAN.md — Official W-9 end to end for a U.S. individual: filled through its own fields, flattened, e-signed with the signed-electronically caption and certificate; not-signed state everywhere; taxpayer ID only in memory and in the PDF
- [ ] 06-10-PLAN.md — W-8BEN (MM-DD-YYYY date, non-Latin names, treaty lines), W-9 for every U.S. account type, edited answers rebuild the form
- [ ] 06-11-PLAN.md — W-8BEN-E for the supported statuses, upload of a completed form for every other case, sponsor's review mark
- [ ] 06-12-PLAN.md — Tax forms in server mode (allowlist, vault, console import), device copy with the full taxpayer ID deleted after sending, self-serve toggle labels, owner's check of four real signed forms
