---
phase: 01-accurate-field-placement
plan: 03
status: complete
requirements: [PLACE-04, PLACE-07]
---

# 01-03 Summary: filled in from onboarding, the block for each kind of investor, the closing measurement

## What was built

- `assets/js/placement.js`: `values(investor, offering, opts)` (what onboarding knows, by key: investorName,
  signerName, address, street, city, state, zip, cityStateZip, email, phone, amount, date, offering, shareClass; never
  a taxpayer ID), `groupOf(type)`, `fits(field, type)`, and the lists `PREFILL` and `FOR_TYPES` for the editor.
- `assets/js/esign.js`:
  - `prefillValues(inv, o, opts)` beside `subscriptionPrefill`; both callers (the `ops.submitSubscription` wrapper and
    `resign`) pass it as `values`.
  - `fillIn(env, signer, labels, values, fresh)`: a text field of the investor with a `prefill` key gets the answer and
    is locked; with no answer it is left empty and open; an answer too long for its blank is filled in but left open.
    Fields without a key are filled by label exactly as before.
  - `createFromTemplate`: the investor gets only the fields that fit their kind of account (`forType`), and the
    envelope remembers the group (`investorGroup`).
  - `refreshSubscription`: values follow a correction; a change of kind swaps in the other block's fields; the signing
    page's session entries follow; one "Details updated" event, and `false` with no event when nothing changed.
  - Editor: "Filled in from onboarding" and "Who gets this field" in the selected field's properties;
    `agreementTodo` refuses an agreement that leaves individuals, or entities, with no signature field; the offering
    page's summary counts keyed blanks as filled in.
- `assets/js/onboarding.js` `refreshSubscription`: the early return on name, account and email is gone.

## Checks

- `prefill.js`: 31 of 31. `walk.js` (the real flow once: upload through the dialog, 36 fields placed in under a second,
  two marks confirmed, saved, investor invited, onboarding walked, name, street, city, state, ZIP, email, phone and
  commitment arrive filled in and locked, the rest fillable, signed with the guide): 17 of 17.
- Other phases' checks on this branch: field editor 104 of 104, signatures 70 of 70, signing step 71 of 71,
  signed record 40 of 40.

## Closing accuracy table

"right" = the right kind of field rests on the printed line (or box) for the right signer, with the right label,
prefill key and required setting where the fixture states them.

| Layout | Signature-block blanks | Fill-in blanks | Right | Confident mistakes | Review marks | Saved at once |
|---|---|---|---|---|---|---|
| classic (underscores, investor page then firm page) | 8/8 | 1/1 | 9/9 | 0 | 0 | yes |
| classicSolo (no countersignature) | 4/4 | 1/1 | 5/5 | 0 | 0 | yes |
| caption (two columns, captions under drawn lines) | 6/6 | – | 6/6 | 0 | 0 | yes |
| oneline (two labels on a line; labels with no line) | 7/7 | – | 7/7 | 0 | 0 | yes |
| cropped (crop box) | 4/4 | – | 4/4 | 0 | 0 | yes |
| entity (individual page, entity page, acceptance) | 11/11 | – | 11/11 | 0 | 0 | yes |
| unsure (no heading) | 2/2 | – | 2/2 | 0 | 5 | held |
| questionnaire (blanks, tick boxes, initials) | – | 25/25 | 25/25 | 0 | 8 | held |
| full (questionnaire + entity pages) | 11/11 | 25/25 | 36/36 | 0 | 2 | held |
| markup | 2/2 | 1/1 | 3/3 | 0 | 0 | yes |
| grid (bordered tables) | 8/8 | – | 8/8 | 0 | 0 | yes |
| prose (nothing to fill in) | – | – | – | 0 | 6 (fallback) | held |
| blank (no text) | – | – | – | 0 | 6 (fallback) | held |
| heldout (A4, sans-serif, ruled table) | 7/7 | 15/15 | 22/22 | 0 | 0 | yes |
| heldout2 (drawn with the PDF writer) | 10/10 | 16/16 | 26/26 | 0 | 0 | yes |
| heldout3 (labels above lines, underlined spaces) | 8/8 | 14/14 | 22/22 | 0 | 6 | held |
| heldout4 (Legal, compact data sheet) | 4/5 | 13/14 | 17/19 | 0 | 6 | held |
| **Total** | **92/93** | **111/112** | **203/205** | **0** | | |

Before this phase: 0 of 15 printed blanks had a field on them, and 3 of 3 agreements were saved with nobody looking.

## What the layouts nobody tuned for showed (as measured)

Four layouts were written after the rules, each committed before its first run. First runs:

| Layout | Right | Confident mistakes | Review marks |
|---|---|---|---|
| heldout | 20/22 | 2 (letters read as tick boxes) | 7 |
| heldout2 | 24/26 | 1 (a text field named after a whole sentence where initials were asked for) | 1 |
| heldout3 | 20/22 | 0 | 7 |
| heldout4 | 15/19 | 5 (a heading's rule read as the amount; "Initial each:" as text; a co-investor's block given to the investor, twice; "For the Company: ____ (authorized officer)" as text) | 11 |

So on an agreement it has not seen, the portal got 79 of 89 blanks right on the first run (89%) and was confidently
wrong 8 times across three of the four layouts. Every confident mistake was traced to a rule and fixed; this went
beyond the plan's "one round of changes", so none of the four is untouched any more, and the table above is not a
prediction for new layouts. The two blanks still not right on heldout4 (the second of two initials blanks on one
printed line, and a blank whose label ends the line before) are both marked for review and are left as measured.

## What a real agreement can contain that the rules do not cover yet

- A blank whose label ends the previous printed line; a second initials blank on the same printed line.
- Scanned agreements (no text): fallback block only; no reading of the image.
- Pages with a /Rotate entry: handled through the viewport transform but not exercised by a fixture.
- Fillable PDF form fields already in the file are ignored.
- Tick boxes drawn as circles, or as brackets with no scanned square, are estimated and marked.
- Headings set in mixed case with no colon are recognised only when alone on their line; a block whose only heading
  is a company name the portal does not know is given to the investor or the firm at medium confidence.
- Joint investors, witnesses and notaries get no field by decision.

## Deviations

- The closing measurement used four late layouts instead of one, and rules were improved after each (see above).
- An answer too long for its blank is filled in but not locked (a locked value that cannot be printed would stop the
  investor from finishing).
- Prefill keys `signerName`, `date`, `offering` and `shareClass` are offered in the editor although placement never
  assigns them itself.
- This branch also carries the merge with the rebuilt field editor and signatures (see 01-02-SUMMARY).
- ROADMAP.md, STATE.md and REQUIREMENTS.md were left alone (shared with the other phases' branches).

## Deferred (owner away)

- Human check with the owner's own subscription agreement PDF (plan 03, Task 2): only that shows whether placement
  holds on the documents sponsors actually use.
