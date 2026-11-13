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
- [ ] **Phase 2: Field Editor** - A smooth, polished editor where fields drag cleanly within and across pages
- [ ] **Phase 3: Signatures** - Cursive and other signature styles, a natural drawn signature, upload, adopt once
- [ ] **Phase 4: Signing Inside Onboarding** - A polished, guided signing step for investors and countersigning for sponsors, with no separate tool
- [ ] **Phase 5: Signed Record** - Final signed PDF with certificate page, audit trail and tamper evidence

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
