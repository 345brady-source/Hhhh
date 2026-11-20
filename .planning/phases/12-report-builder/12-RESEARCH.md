# Phase 12: Report builder - Research

**Researched:** 2026-11-20
**Domain:** investor reporting for private funds and real-estate sponsors; in-browser report composition, PDF and spreadsheet output, delivery to the investor portal
**Confidence:** see Metadata at the end (section by section)

Notes for readers: this file is written section by section and pushed after each one (owner's save rule). A section marked "(pending)" has not been written yet.

## Summary

(pending: written last, from the sections below)

<user_constraints>
## User Constraints

There is no 12-CONTEXT.md yet (no discuss-phase was run). The constraints below are the owner's own decisions, copied verbatim from the files named, and the standing rules every agent works under. The planner treats them as locked.

### Locked decisions (owner, verbatim)

From .planning/phases/01.4-*/01.4-RESUME.md line 98 (owner, 2026-11-15):
> Premium report builder (owner, 2026-11-15; about one day of build, about 10 percent of weekly usage; no API; the word "basic" is never used): a few templates for each report type (quarterly letters by fund type such as real estate, private credit or income, venture or private equity, single-asset; annual review; other report types sponsors send), in the sponsor's brand; research real published investor reports on the web first for inspiration and a side-by-side comparison. Section builder, chart choices, cover and accents, saved templates per offering or firm, editable disclosures; figures from the ledger (capital account, contributions, distributions, ownership, IRR, multiple, DPI, TVPI); asset pages with photos; the sponsor's letter in a rich-text editor; batch generate, preview, publish with email; PDF and spreadsheet; archive.

From the same file, line 99:
> Owner: most quarterly reports cover several funds of different types. The builder makes a consolidated report per investor across all their holdings with the sponsor (summary totals plus one section per fund, each laid out for its fund type) and a sponsor-wide letter covering every fund; research focuses on real multi-fund reports.

From .planning/ROADMAP.md, Phase 12 goal:
> A premium report builder inside the portal: report templates per report type (investor statements, capital account statements, distribution notices, quarterly and annual investor letters, fund performance and holdings summaries, tax-season summaries), each built from the data the portal already holds (capital accounts, journal, distributions, calls, holdings, tax documents), highly customizable by the sponsor (sections on or off and reordered, the firm's branding, wording blocks, date range, per-fund or per-investor), previewed on screen and exported as PDF and spreadsheet with the shipped writers, and delivered to investors through the portal's documents; no outside API; all in the browser with no server, proven in the owner's iPhone conditions. Nothing is called ready before the owner has checked it.

Launch list task (orchestrator brief): "Premium report builder: templates per report type, highly customizable (no API)".

Owner's scope rule (orchestrator brief): "only what is legally required / 100% necessary", plus what makes the product sellable.

### Standing rules (.planning/AUTOPILOT.md, CLAUDE.md)
- White label: no vendor, model or library names in anything a sponsor or investor sees (this includes PDF metadata fields Producer and Creator, and spreadsheet properties). The word "basic" never appears.
- Nothing mandatory for investors (D-30). No extra text on screens; build only what the law or the task needs.
- Managed (Carrow & Vale) edition unchanged unless a plan says otherwise (C-03 slice guard in status-math).
- The owner tests on an iPhone inside the Claude app (WKWebView, sandboxed iframe, no server): checks run at 390x844 with touch and at 1280x800, inside a sandboxed frame whose CSP blocks connect-src; no fetch()/XHR on any path that must work without a server; no Blob stored in IndexedDB (store bytes); no browser PDF viewer (draw pages in-page); every view has a way out on screen; dialogs scroll.
- No paid API calls by agents; no outside service with a monthly fee unless the owner chooses it; the $0 path first.
- RED-first checks; every behaviour change has a check that fails before and passes after; the full gate is .planning/checks/gate-reference.sh.
- Save rules (.planning/SAVE-RULES.md) apply to every agent; commit trailer lines exactly as in AUTOPILOT.md.
- Never call anything ready, working or done before it has been tested and the owner has checked it.

### Claude's discretion
Everything not fixed above: the section catalogue per template, the storage shape of templates and runs, the PDF layout writer, the rich-text subset, chart forms, file ownership and plan breakdown. Recommendations are made below.

### Deferred ideas (out of scope for phase 12)
- Sending email from a server: phase 13 (email overhaul) owns the mail path. Phase 12 uses the portal's existing Notices page and its no-server behaviour ("own email" / simulated).
- Investor messaging and the data room: launch item 9.
- Preparing K-1s or 1099s: phase 10 (the report builder only summarises what phase 10 holds).
- Any outside reporting API or service (owner: "no API").
- The in-house reader (D-33).
</user_constraints>

<!-- gsd:write-continue -->
