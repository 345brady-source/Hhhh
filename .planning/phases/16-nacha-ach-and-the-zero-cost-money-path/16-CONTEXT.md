# Phase 16: NACHA/ACH upgrades and the $0 money path - Context

## Decisions (owner)
- D-01 (2026-11-15, 01.4-RESUME build order 9): fixes: bank holidays computed for any year, file ID modifier stepping (A-Z, 0-9 per day), entries with no SEC type, the same-day ACH $1M per-entry warning; plus international ACH (IAT) or wire instructions for foreign investors; pre-notes; reading bank return and notification-of-change (NOC) files back in.
- D-02 (2026-11-16, verbatim: "Ok let's go with the 0$ launch path you recommended"): no paid provider at launch. The portal builds the NACHA file, the sponsor uploads it to its own bank; bank accounts checked with pre-notes; return files uploaded back and matched to investors. Carrow & Vale never holds funds. Later, with revenue: Stripe (capital calls) and Dwolla (both directions), fees passed to sponsors.
- D-03 (2026-11-16): transfers and secondary sales only if a transfer agent offers an API; research it when this step is done (recorded, not built here).
- Carried: outside-API check first; white label; works in the no-server preview; never the word "basic"; full bank numbers never in logs, events, fixtures or summaries (fixtures use never-issued routing and account numbers); nothing called ready before the owner checks it.
- Owner (2026-11-26): build everything through step 11 that can be built without him; ask with a push notification and take the default after 15 minutes.

## Questions the research must answer
- What exists: the NACHA builder (assets/js), distributions and capital calls, phase 10 withholding (net paid), phase 11 bank reconciliation (statement upload, C-03), the ACH settings and their current defects.
- The NACHA Operating Rules as they apply: file and batch headers, SEC codes (PPD, CCD, WEB for investor-authorized debits), pre-note timing, return reason codes (R01-R85 that matter) and NOC codes (C01-C14), same-day limits and windows, the Federal Reserve holiday rules for any year, IAT for foreign accounts (and when a wire is the honest answer instead).
- Debits for capital calls: authorization requirements (WEB/PPD), what the investor must agree to, and whether the portal should build debit files at launch.
- Return and NOC file formats banks give back (NACHA return entries, CSV exports) and matching them to the investor and the distribution.
- Outside services with real prices for later (bank file transfer, Dwolla, Stripe, Modern Treasury, Moov) vs the $0 path.

## Owner decisions (2026-11-26, after 16-RESEARCH.md)
- D-04 (C-04): foreign investors are paid by international wire from the sponsor's own bank, listed in the portal ("Wire list"); no IAT at launch.
- D-05 (C-06): no ACH debit files for capital calls at launch; calls stay on wire.
- D-06 (C-13): redemption payment files are built in this phase, on the same builder as distributions.

## Orchestrator choices (2026-11-26, research defaults adopted; the owner may override)
- C-01 holidays by rule plus an empty one-off list; C-02 modifier used only on download/copy, counted per origin, destination and day, 37th file refused; C-03 pre-notes on by default for new or changed accounts with a 3-banking-day wait, accounts already paid exempt, sponsor can turn off; C-05 per entry trace, amount and last four stored, never the file text; C-07 returned distributions in account 2000; C-08 no routing first-digit check (fixtures still use never-issuable numbers); C-09 every real bank number in fixtures and sample data replaced in one plan with its gate run, phase 11's two BAI2 samples (outside project test data) kept and the owner told; C-10 uploaded return file keeps only name, size and SHA-256; C-11 no return-rate figure; C-12 builder fixes in both editions, pre-notes, returns and wires self-serve only; C-14 other business-day helpers left; C-15 pre-notes in their own file; C-16 investor notice in the portal now, email through phase 13 later.
- Owner inputs worked around ("To be confirmed"): his bank's ACH implementation guide; a masked return/NOC report export from his bank.
