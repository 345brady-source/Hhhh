# Phase 10: Investor tax documents and withholding - Context

## Decisions (owner, 2026-11-16, from 01.4-RESUME "Roadmap additions" and "Tax step decisions")
- D-01: K-1s by import and deliver. The sponsor's CPA prepares them; the portal takes one combined file (or separate files), splits it by investor, delivers each K-1 to its investor in the portal and tracks opens. The portal does not prepare K-1s.
- D-02: 1099s are produced by the portal only if they can be 100% right. The year-end character split (ordinary, qualified, capital gain, return of capital) is entered or confirmed by the sponsor or the CPA; the portal fills, validates, delivers and e-files (the IRS's IRIS). 1099-INT can be fully automatic.
- D-03: 1042-S for foreign investors.
- D-04: withholding on distributions: backup withholding 24%, foreign 30% or treaty rate, partnership withholding for foreign partners, FIRPTA.
- D-05: look into tax-document APIs, and a CPA partner receiving K-1-ready packages from sponsors who opt in. The package itself is built in phase 11 (fund accounting), not here.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; the owner has no budget for monthly fees, so a $0 path comes first); white label; lean screens (only what the law or the task needs); D-30; .planning/AUTOPILOT.md conditions. The W-9 and W-8 data collected in phase 06 (taxforms.js, taxmaps.js, the investor's tax record) is the source for names, TINs, classifications and treaty claims.
- Not in scope: the in-house subscription-agreement and PPM reader (D-33). Splitting a K-1 file by investor is its own small job on a standard IRS form and must end with the sponsor confirming each match before anything is delivered: a K-1 delivered to the wrong investor is a disclosure of tax data.

## Questions the research must answer
- What the law requires of the fund (not the CPA) for each document: who must file, by when, how it must be delivered (electronic delivery consent rules for K-1 and 1099), and what the portal must keep.
- IRIS: what Carrow & Vale or the sponsor needs to e-file (transmitter code, application, wait), whether a file can be built by the portal and uploaded by the sponsor at $0 (the same pattern as the NACHA file), and the schema.
- 1042-S and Form 1042 filing routes and what a withholding agent must deposit and when; what the portal can do without holding money.
- Which withholding rules a private fund sponsor actually has to apply at the distribution, and what can only be decided by the CPA; where the portal must stop and say "ask your CPA".
- Outside services with real prices; which are worth it against in-house.
- What already exists in the portal (distributions, capital accounts, operations.js, audit.js, taxforms.js) that this builds on.
