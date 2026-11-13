# Requirements: Investor Portal E-signature Rebuild

**Defined:** 2026-11-12
**Core Value:** A sponsor uploads a subscription agreement once, the signature fields land in the right place, and every investor signs it as a seamless step of onboarding with no extra account, tool or hand-off.

## v1 Requirements

### Field Placement

- [ ] **PLACE-01**: When a sponsor uploads a subscription agreement, the portal places signature, date, name and related fields on the correct line of the correct page
- [ ] **PLACE-02**: Each automatically placed field carries a confidence level, and fields the portal is unsure about are visibly flagged
- [ ] **PLACE-03**: The sponsor must confirm or move every flagged field before the agreement can be used for onboarding
- [ ] **PLACE-04**: The portal tells investor fields apart from sponsor countersignature fields and assigns each to the right signer
- [ ] **PLACE-05**: The portal tells apart what the client signs, what the client fills in, and what needs the client's initials, and creates the right kind of field for each
- [ ] **PLACE-06**: Blanks the client must fill in (name, address, amount, date, checkboxes and similar) become fillable fields automatically, without the sponsor adding them by hand
- [ ] **PLACE-07**: Fill-in fields whose answer the portal already has from onboarding (name, entity, address, commitment amount, date) are filled in automatically; the client only completes what is left
- [ ] **PLACE-08**: The portal adds a field only where the agreement itself has a blank, a tick box or a signature line; it never places a field anywhere else and never over the agreement's text
- [ ] **PLACE-09**: Every tick box printed on the agreement becomes a box the client can tick
- [ ] **PLACE-10**: Every blank printed on the agreement becomes a field the client can fill in, whether the blank is beside its label, under it, at the end of a label that runs over several lines, inside a sentence or in a table cell
- [ ] **PLACE-11**: Every signature line printed on the agreement becomes a field that can be signed by the person the line is for
- [ ] **PLACE-12**: The portal recognises whether the agreement has an investor signature block and whether it has a countersignature block (both, one or neither), tells the sponsor what it found, and sets up signing to match
- [ ] **PLACE-13**: When the portal cannot read an agreement it says so and places nothing by guesswork; the sponsor can always see what was read and have the document read again
- [ ] **PLACE-14**: The reading works on subscription agreements in general and in the published preview exactly as it does locally, proven on real documents and under the preview's own rules

### Field Editor

- [ ] **EDIT-01**: Sponsor can drag a field smoothly anywhere within a page, with the field following the pointer without lag or jumps
- [ ] **EDIT-02**: Sponsor can drag a field from one page to another in a single movement
- [ ] **EDIT-03**: Sponsor can add, resize, duplicate and delete fields, and change a field's type and signer
- [ ] **EDIT-04**: Fields snap into alignment with nearby fields and text lines, and can be nudged with the keyboard
- [ ] **EDIT-05**: Sponsor can undo and redo editing steps
- [ ] **EDIT-06**: The editor works on long documents (zoom, page navigation) and on touch screens

### Signing Experience

- [ ] **SIGN-01**: The investor signs the agreement as a step inside onboarding, with no separate account, sign-up or tool at any point
- [ ] **SIGN-02**: Once fields are set, every invited investor reaches the signing step automatically with no further sponsor action
- [ ] **SIGN-03**: The investor is guided from one required field to the next and can see what remains
- [ ] **SIGN-04**: The sponsor countersigns from the console without leaving the portal
- [ ] **SIGN-05**: The signing screen is clear and comfortable on a phone as well as a desktop

### Signatures

- [ ] **SIG-01**: Signer can choose from several typed signature styles, including cursive handwriting styles
- [ ] **SIG-02**: Signer can draw a signature with a smooth, natural-looking stroke
- [ ] **SIG-03**: Signer can upload an image of their signature
- [ ] **SIG-04**: Signer adopts a signature and initials once and they are applied to every field of theirs

### Signed Record

- [ ] **REC-01**: Completing signing produces a final PDF with every signature and field value placed on the document
- [ ] **REC-02**: The final PDF includes a certificate page naming each signer, when they signed, and their consent to sign electronically
- [ ] **REC-03**: An audit trail records each event (viewed, consented, signed, countersigned) with time and signer
- [ ] **REC-04**: The signed PDF is tamper-evident: a later change to the file can be detected
- [ ] **REC-05**: Investor and sponsor can each download the signed PDF from the portal

### Look and Feel

- [ ] **LOOK-01**: The sponsor's field editor follows the portal's design system and reads as a finished, professional tool
- [ ] **LOOK-02**: The investor's signing screens carry only the sponsor firm's brand and follow the portal's design system
- [ ] **LOOK-03**: Every field box shown on the agreement, for the sponsor, the investor and the firm, has rounded corners and a finished, professional look, and its name tag never covers the agreement's words

## v2 Requirements

### Signers

- **SGNR-01**: Joint investors and multiple signatories for an entity
- **SGNR-02**: Other documents: side letters, amendments

### Delivery

- **DLVR-01**: Server-side signing records with emailed signing links and reminders

## Out of Scope

| Feature | Reason |
|---------|--------|
| A standalone e-sign product or account | Signing is only ever a step of onboarding |
| Further fund management features | Owner has set the current extent as the limit |
| Mobile app changes | Set aside for now by the owner |
| Third-party e-sign vendor branding | White label: investors see only the sponsor's brand |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLACE-01 | Phase 1 | Pending |
| PLACE-02 | Phase 1 | Pending |
| PLACE-03 | Phase 1 | Pending |
| PLACE-04 | Phase 1 | Pending |
| PLACE-05 | Phase 1 | Pending |
| PLACE-06 | Phase 1 | Pending |
| PLACE-07 | Phase 1 | Pending |
| PLACE-08 | Phase 01.1 | Pending |
| PLACE-09 | Phase 01.1 | Pending |
| PLACE-10 | Phase 01.1 | Pending |
| PLACE-11 | Phase 01.1 | Pending |
| PLACE-12 | Phase 01.1 | Pending |
| PLACE-13 | Phase 01.1 | Pending |
| PLACE-14 | Phase 01.1 | Pending |
| LOOK-03 | Phase 01.1 | Pending |
| EDIT-01 | Phase 2 | Pending |
| EDIT-02 | Phase 2 | Pending |
| EDIT-03 | Phase 2 | Pending |
| EDIT-04 | Phase 2 | Pending |
| EDIT-05 | Phase 2 | Pending |
| EDIT-06 | Phase 2 | Pending |
| LOOK-01 | Phase 2 | Pending |
| SIG-01 | Phase 3 | Pending |
| SIG-02 | Phase 3 | Pending |
| SIG-03 | Phase 3 | Pending |
| SIG-04 | Phase 3 | Pending |
| SIGN-01 | Phase 4 | Pending |
| SIGN-02 | Phase 4 | Pending |
| SIGN-03 | Phase 4 | Pending |
| SIGN-04 | Phase 4 | Pending |
| SIGN-05 | Phase 4 | Pending |
| LOOK-02 | Phase 4 | Pending |
| REC-01 | Phase 5 | Pending |
| REC-02 | Phase 5 | Pending |
| REC-03 | Phase 5 | Pending |
| REC-04 | Phase 5 | Pending |
| REC-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-12*
*Last updated: 2026-11-13 after the owner's report on a real agreement: PLACE-08 to PLACE-14 and LOOK-03 added for Phase 01.1*
