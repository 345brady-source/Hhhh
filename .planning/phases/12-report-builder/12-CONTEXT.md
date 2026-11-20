# Phase 12 context: Report builder

Why this is built: the self-serve portal is the funnel that brings sponsors to Carrow & Vale. Investor reports are a premium feature a sponsor pays for and shows to investors, so they carry the firm's brand (white label) and must be right to the cent.

Owner instruction (2026-11-20, verbatim): "work around whatever bullshit you think you need me for". Every open question takes the researcher's recommended default below, recorded here; anything that needs counsel or a CPA shows "To be confirmed with counsel" (or CPA) on screen and is never called confirmed.

## Choices (orchestrator, 2026-11-20, from 12-RESEARCH.md open questions)
- C-01 Investors with no e-delivery consent on record: post the report to their Documents anyway, and list them on a "Send on paper" list with a PDF download, marked "To be confirmed with counsel".
- C-02 The font name DejaVuSans inside the PDF's font data is accepted (not page text; phases 10 and 11 already ship it). Record it for the owner's check.
- C-03 Where: a new tab "Investor reports" on the existing Reports page; no new menu entry.
- C-04 Who: the sponsor's team builds and generates; withdrawing follows the Tax documents page rule (admins).
- C-05 Any paid distribution run can produce notices, past ones included.
- C-06 Character split on distribution notices: optional, sponsor-typed, must add up exactly to the gross.
- C-07 Gross performance is never shown; net only.
- C-08 Self-serve edition only; the managed edition is unchanged.
- C-09 Reg A issuers: the annual review layout titled "Semiannual/Annual report to investors", with a note that the SEC filing is separate.
- C-10 Phase 11 is still merging: wave 1 starts now; if 11-16 is not merged when wave 2 starts, load filesout.js through a parts loader the way taxdocs-ui.js loads its parts.
- C-11 Photos: up to 12 per template, each redrawn to at most 1,600 px as JPEG.
- C-12 The PDF composer sets Producer and Creator to the firm's name (pdf-lib writes its own name otherwise), as filesout.js does.
- C-13 Nothing is ever labelled "audited"; the 506 "no periodic federal reporting" statement shows "To be confirmed with counsel".
- C-14 Fixed by research, to apply in 12-01: export closedPerformance and openPerformance from audit.js (one line); use NS.books.status() as it is actually shaped ({start, closedThrough, entries, exceptions}).

## Plan-check additions, wave 1 (12-01..12-04; checked 2026-11-20 against e74497e; 1 blocker, 4 warnings). Executors apply these with their plan. Findings: scratchpad checks-12-wave1.md. All four may start now; 12-01 does not wait for 11-11 (11-11 does not touch the export object).
- B1 (blocker, 12-03 Task 3 verify): the command must be able to fail. Run `rm -rf $O/shots` right after the heavy.sh run and before `tail -n 3 $O/pdf.txt`, so the `grep ... && test ... && git diff --quiet ...` chain runs last (or end with `; rc=$?; rm -rf $O/shots; exit $rc`).
- W1 (12-02, interfaces lines 90-91): every NS.reportsData call takes ws first, exactly as 12-01's interfaces: `D.holders(ws, offeringId, to)` and `D.fundsOf(ws, recipient)`. The stand-in D takes ws as the first argument of every function.
- W2 (12-01 Task 1 step 2): insert `closedPerformance,` and `openPerformance,` as two new lines directly after the `period,` line (audit.js:1578), changing no existing line, so the diff is exactly 2 added and 0 removed.
- W3 (12-01, statements): always call NS.audit.build on a deep copy of ws (JSON round trip), so a sync inside build (11-11 adds NS.books.sync there) never writes the caller's ws. The summary records "rerun checks/reports-math.js after 11-11 merges", and the orchestrator reruns it then.
- W4 (12-03, interfaces line 87): marks from brand.js markBody carry colours in the style attribute (fill:, stroke:), with fill="none" and stroke-width as attributes, and paths use Q, T and arc commands. Draw each path's d with pdf-lib's page.drawSvgPath, y flipped and scaled from the 40x40 box.
- Info: build is at audit.js:1549 and the esignConsent scope at onboarding.js:2833 (find by name). Sample investors have edelivery true but no esignConsent.scope, so all of them land on the paper list (C-01); 12-08 and the walkthrough expect that.

## Plan-check additions, wave 2 (12-05, 12-06, 12-07; checked 2026-11-20 against a1069c0 + origin/wip/12-03; 3 blockers fixed here, 3 warnings). Executors apply these with their plan. Findings: scratchpad checks-12-wave2.md. All three start after 12-03 merges; merge order 12-05, 12-07, 12-06. 12-07 needs no change.
- B1 (blocker, 12-05 interfaces and Tasks 1-2): register each starter as `NS.reports.addStarter({ id, name, type, fundType, blurb, template: { cover: { style, accent: '', photoId: '' }, chart, sections: [{ key, on, opts, text }], disclosures } })`. The as-built addStarter (reports.js:438) stores only spec.template. "chart X" means `template.chart = 'X'` plus `{ key: 'chart', on: true }` (reports.js:1137, 1141). Replace the catalogue check with: for every starter, `t = NS.reports.startFrom(ws, id)`; `normalise(t)` deep-equals `t`; the listed sections are on and all others off, in catalogue order.
- B2 (blocker, 12-05 disclosures, white label): in reports.js `startFrom` (lines 481-484), make the smallest change and list it as a deviation: `if (k === 'disclosures') base.disclosures = base.disclosures.concat(tp.disclosures); else base[k] = tp[k];`. Starters carry only the added paragraphs. Case words (or catalogue) asserts that `startFrom(ws, id).disclosures[0]` is the tenant's disclaimer for every starter on every sample firm. reports.js joins 12-05's files.
- B3 (blocker, 12-06 Task 3 verify): the console.js bound becomes `$1 <= 4 && $2 <= 3` (head, the tab bar and ${body} are three separate lines at 1975-1977). Update <fails_when> ("more than 4 / more than 3; baseline 0 and 0") and the frontmatter comment.
- W1 (12-05 Task 2, every-sample): pass `{ kind: 'investor', investorId, offeringId }` for single-fund starters. For st-consolidated and q-firm on the investor holding several funds, use `{ kind: 'investor', investorId }` with no offering. Pass the same spec.audience to othersIn.
- W2 (12-06 Task 2, rich-text editor): the input handler calls `NS.app.save()` without rendering, then replaces only the preview container's innerHTML (and the three buttons' disabled state) in place. It never calls NS.app.render() while the editor has focus (follow the typing()/focusout pattern at taxdocs-ui.js:185-200). Toolbar buttons call preventDefault on pointerdown so the selection survives a tap. Part editor-phone asserts the caret stays after the typed text (document.getSelection()).
- W3 (12-06 Task 3, help guide): the sponsor guide is 46,286 of 48,000 bytes, and the remaining room is shared. On a conflict in server/lib/help-guide.mjs, take either side, then run `node server/help/build.mjs` and `--verify`; never hand-merge it. Record the measured sponsor size in the summary. The stop rule stands.
- Info: addStarter takes one fundType, so 12-08's starter picker applies the pe/vc mapping.

## After 12-03 (merged 2026-11-20)
- The shared check runner keeps each part's result in checks-out/.parts on purpose (resumable checks). Any "checks-out is empty" verify excludes `.parts`.
- The composer draws chart values between 0 and 1 as fractions of the chart height, and scales any other values against the largest. 12-05 and 12-06 check that the model's column and line values and its ticks (`at`) line up on the drawn chart (fractions from 12-02's model), and fix the model side if they do not.
- compose also returns `.logos` (where each logo was drawn). An uploaded logo on a coloured band sits on a white plate. The support contact goes at the foot of the cover, or under the title when there is no cover.
- Font names inside the PDF data: DejaVuSans-Bold-5348 and DejaVuSans-5083 (C-02, for the owner's check). Measured: layout-a composes in 256 ms in Node and 383 ms in the phone frame.
