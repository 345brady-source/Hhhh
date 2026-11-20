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
