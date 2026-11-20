---
phase: 01-accurate-field-placement
plan: 02
status: complete
requirements: [PLACE-02, PLACE-03, PLACE-05, PLACE-06]
---

# 01-02 Summary: every kind of blank, and review before use

## What was built

**Kinds of field (`assets/js/placement.js`)**

- Initials: "Initials", "Initial here", "Subscriber's Initials" as a label, a caption or in brackets after the blank,
  also when the label closes a line of running text ("...Rule 501.  Initials: ____"). A short blank before a statement
  is an initials field when an instruction within ten printed lines says "initial" (optional when it says "that
  applies"), a tick box when it says "check", and initials at medium confidence when nothing says which.
- Blanks to complete, each a text field with a fixed label and, where onboarding has the answer, a prefill key:

  | Printed label (examples) | Field label | Prefill key |
  |---|---|---|
  | Name of Subscriber, Investor Name, Name of Entity, Exact name in which the interest is to be held | Investor name | `investorName` |
  | Subscription Amount, Capital Commitment, Amount of Investment, Purchase Price: US$ | Commitment amount (optional: it arrives filled in) | `amount` |
  | Address, Mailing Address, Street address | Address | `street` when city, state or ZIP blanks follow within three printed lines, otherwise `address` |
  | (unlabelled line under an address blank), Apt / Suite | Address line 2 (optional) | none |
  | City / State / Zip Code / City, State, Zip | City / State / ZIP code / City, state and ZIP | `city` / `state` / `zip` / `cityStateZip` |
  | Email, E-mail Address | Email | `email` |
  | Telephone, Phone, Daytime telephone | Phone | `phone` |
  | Social Security Number, Taxpayer Identification No., EIN | Taxpayer ID | none (never filled in) |
  | any other label ending in a colon ("State of organization:", "Number of Units:") | the printed words | none |

  "(entities only)" or ", if signing for an entity" sets `forType`; "if any", "if applicable", "optional" make a field
  optional. A blank inside a sentence is the commitment amount when a currency sign stands before it and the sentence
  is about what the investor commits (or the words after the blank name it); otherwise a text field marked for review.
- Tick boxes: every empty printed square (drawn, or a box character of the text), "[ ]" and "( )" in the text, and a
  symbol-font character where a square is seen. Labelled with the words after the box, or before it on a line that
  reads "Yes [ ] No [ ]". A box that is already ticked, a comb of touching squares and round or bold letters get nothing.
- Tables: in a table with ruled rows the row's empty stretch after its label is the blank and rows start together; in
  a table with every border drawn the empty cell is the blank and the words in the cell to its left are its label; a
  table full of words is not a form.
- Witness, notary, spouse, co-subscriber and joint-subscriber lines get no field.

**Review (`assets/js/esign.js`, block "PLACEMENT REVIEW"; `assets/css/esign.css`, block of the same name at the end)**

- A field that needs review has the class `is-flag` and a "Review" tag; its spoken name gives the reason. The left
  column lists every such field with its page and reason ("To review"); choosing one selects it and brings it into view.
- The selected field's properties show "Placed for you · confidence …", the reason and "Confirm this field".
- A mark is settled by confirming, moving, resizing, retyping or reassigning the field, by saying who gets it or what
  fills it in, or by removing it. Each is a step in the editor's history (undo brings the mark back).
- `agreementTodo` refuses to save with marks left; `templateReady` is false for a stored agreement with marks, so
  onboarding, invitations and the investor portal fall back to the typed form; the offering page says "Fields need
  review". The upload form opens the editor with a toast saying how many need review. An agreement with no marks is
  saved at once, as before. The audit entry of a save says how many placed fields the firm confirmed or adjusted.

## Hooks for the field editor (as merged with the rebuilt editor)

`esign.js` fills the editor's three status slots and one pass-through:
`editorFieldMark(env, f)` → `{ cls: 'is-flag', html: reviewMarkHTML(f), say: reviewSay(f) }`;
`editorPropsStatusHTML(env, f)` → `placementStatusHTML`; `editorRailExtraHTML(env)` → `reviewPanelHTML`;
`placementControlsHTML(env, f)` in `editorPropsHTML`; `editorCtx().setExtra = placementSetProp`.
Actions: `es-flag-go` (`NS.fieldEditor.show(id)`), `es-flag-ok` (`NS.fieldEditor.setProp('review', false)`).
`assets/js/fieldeditor.js` gained three small things: `setProp` passes properties it does not know to `ctx.setExtra`,
a change of type settles a mark, and `show(id)` is exported.

## Checks

- `accuracy.js`: questionnaire 25 of 25 printed blanks with the right kind of field, label, key and required setting;
  the ticked box, the table-of-contents line and the underlined sub-heading get nothing; zero confident mistakes.
- `review.js`: 30 of 30 (marking, the list, each way of settling a mark, undo, the save gate, clean agreements saving at
  once, agreements stored before this phase, a stored agreement with a mark not being ready, markup shown as text).
- `labels.js`: 173 of 173.

## Deviations

- The review marks sit in the rebuilt field editor's slots rather than in the old side panel (the editor was rebuilt in
  parallel and merged here). On screens under 1280 px the list is one row of names; on phones it is hidden (the marks
  on the fields, the line saying how many are left and Confirm moving on to the next do the work there).
- The editor's head note does not count the marks ("Those marked Review are listed on the left"), because the note is
  outside the part of the page the editor redraws; the line under the field types carries the live count.
- A change of type also settles a mark (the plan listed move, resize, signer and remove).
- The check for the editor's own "confirmed by an edit" case (`02-field-editor/checks/editor.js`) used a stand-in for
  placement with the plan's old property names; it now uses the real marks.

## Deferred (owner away)

- Human check: whether the mark is noticeable and the wording clear to a sponsor (plan 02, Task 2).
