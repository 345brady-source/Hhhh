---
phase: 01-accurate-field-placement
plan: 01
status: complete
requirements: [PLACE-01, PLACE-02, PLACE-04]
---

# 01-01 Summary: signature blocks read from the printed page

## What was built

- `assets/js/placement.js` (new, no dependency on the page or the rest of the portal; loads in node): `scan` reads a
  rendered page's pixels for printed lines and squares; `analyze` turns the page's text and those marks into proposed
  fields; `labelOf` says what a short piece of text asks for.
- `assets/js/esign.js`: `pageLayout(docId, textOnly)` (text in displayed points through the viewport transform, so crop
  boxes and rotation are honoured; each page rendered on one reused canvas at scale 2, capped at 1600 px wide, and
  scanned) replaces `pageText`; `autoFields(env)` is rebuilt on `NS.placement.analyze` and keeps its name, signature
  and export; `agreementTodo(env)` refuses to save while any field is marked for review. The old label patterns and the
  old commitment-amount placement are gone.
- `diy.html`, `portal.html`, `index.html`: `placement.js` on its own line before `esign.js`.

How a signature block is read: every printed line with clear paper above it is a candidate blank. Its label is found on
the same printed line to its left (also when one text run holds label and underscores, or two labels and two blanks),
as a caption under it, or printed above it; stacks of lines are read together so a caption is never taken for the label
of the next line. "Name:", "Title:" and "Date:" printed under a signature line with no line of their own get a field
after the label. A line with no label over "Name:" and "Title:" is the signature line. Who signs: the label's own words,
then the nearest heading above in the same column, then a heading at the top of the page, then the firm's or fund's own
name; otherwise the investor at lower confidence. A heading "for individuals" or "for entities" sets who gets the block.

## The contract as built (differs from the plan in naming: see Deviations)

- `NS.placement.scan(rgba, width, height, scale)` returns `{ rules: [{ x0, x1, y, t, clear, drop, rise, cut, cell, table }], boxes: [{ x, y, w, h }] }` in points.
- A page for `analyze`: `{ page, w, h, items: [{ s, x, y, w, h }], rules, boxes }` (x left edge, y baseline, h font height).
- `NS.placement.analyze(pages, { countersign, firmNames, fundNames })` returns proposals
  `{ type, role: 'investor' | 'firm', page, x, y, w, h, label, required, conf: 'high' | 'medium' | 'low', why, forType, prefill, kind }`.
- `NS.placement.labelOf(text)` returns `{ kind, who, forType, optional }` or null.
- On a stored field (`autoFields` writes them; templates and envelopes copy them):
  `auto: true`, `confidence: 'high' | 'medium' | 'low'`, `review: true` while unsettled, `reviewReason` (one sentence),
  `forType: 'person' | 'entity'` when not for everyone, `prefill` (a key) when onboarding has the answer.
- `NS.placement.needsReview(fieldOrAgreement)`, `reviewCount(agreement)`, `reviewFields(agreement)`, `confirm(field)`,
  `statusOf(field)`. A field stored before this phase has none of these properties and never needs review.

## Measurement

Starting point (the code before this phase, `accuracy.js --baseline` on classic, caption and blank): 0 of 15 printed
blanks had a field on them; all 3 agreements were saved for onboarding with nobody looking.

After this plan's rules (final run of the phase, see 01-03-SUMMARY for the whole table): classic 9/9, classic without
countersignature 5/5 (no field on the firm's page), caption 6/6 (left column investor, right column firm), oneline 7/7,
cropped 4/4, entity 11/11, unsure 2/2 with both marked and the agreement held, blank: six low-confidence fallback
fields, held. Zero confident mistakes. `labels.js`: 173 of 173.

## Deviations

- Field properties are `confidence`, `review`, `reviewReason` (not `conf`, `why`, `confirmed`), as the field editor
  built in parallel expects; `needsReview` is simply "review is truthy", and accepts a field or anything with a
  `fields` list. `analyze` itself still returns `conf` and `why` on proposals.
- `DARK` is 176 (not 160) and the half point right above a stroke is not counted as paper: underscore glyphs of
  sans-serif faces do not quite touch in their top pixel row, and at 160 every such blank was "not seen".
- A blank may have as little as 4.5 pt of clear paper when the text itself shows it (a run of underscores).
- The label may be up to 240 pt left of its line (tab-aligned forms), not 36, when it is a known label or ends in a
  colon and the line has no caption of its own.

## Threats

- T-01-01: labels are cut to 60 characters with control characters removed (`clean`); every label and reason is
  printed through `h()`. `review.js` uploads a label made of an image tag with an error handler: no element, no run.
- T-01-02: the 25 MB limit stands; one canvas, at most 1600 px wide; no pattern runs on more than 90 characters of
  label text (hostile input check in `labels.js`). A 72-page agreement is read in about 1.8 s; analysis takes 23 ms.
- T-01-03: `agreementTodo` blocks `saveAgreement` for any marked field; the upload form and document intake both go
  through it.
- T-01-SC: unchanged from the plan (two pinned archives, checks only).
