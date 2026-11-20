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
