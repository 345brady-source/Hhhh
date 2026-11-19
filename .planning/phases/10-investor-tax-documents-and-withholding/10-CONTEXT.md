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

## Research findings the plans must handle (2026-11-19, 10-RESEARCH.md)
- F-1: per-investor amounts of a paid distribution are recomputed from current positions today; they must be stored when the distribution is recorded, or no year-end figure is reliable. Same lines: a distribution recorded for a future date never becomes paid (`console.js` `dist-record` sets the status once). One plan in the first wave owns both, and states the stored shape and the one "is this run paid" test in its interfaces block, because phase 11 (fund accounting) builds on it.
- F-2: a document the sponsor publishes does not reach the investor on another device today (it lives in the publishing browser's storage).
- F-3: the portal keeps only the last four digits of a taxpayer number; a 1099 needs nine.
- F-4: the existing forced "electronic delivery" tick does not meet the IRS rules for tax documents (Rev. Proc. 2012-17 for K-1s; the 1099 consent rules).
- F-5: the capital-account engine's income and gains are generated sample numbers and must never feed a tax figure.
- F-6: the PDF libraries load from a CDN by script tag (phase 11 ships them in the repository, 11-CONTEXT C-02; a plan here that needs them in the preview does the same and says so, so the two phases do not both add them).
- Measured: the K-1 split found 12 of 12 K-1s with 12 of 12 right matches on a file built from the official IRS 2025 Schedule K-1, text and form-field variants. Not measured on any file from a CPA's tax software; scanned files cannot be read.

## Orchestrator choices (2026-11-19; the owner was told by push and may override any of them)
- C-01: the sponsor files with the IRS: the portal builds the IRS upload file and the sponsor uploads it with their own free IRS code (the same pattern as the ACH file). Why: $0, no server, and Carrow & Vale never handles investors' full taxpayer numbers. The wait for the code (up to 45 days) is on the IRS's side; the portal says so.
- C-02: 1042-S and Form 8805 are prepared by the CPA and delivered by the portal on the same path as the K-1, with a worksheet for the CPA. The portal does not build them. Why: the CPA files Form 1042 either way; building it is larger and adds no step the sponsor can skip.
- C-03: at a distribution the portal proposes only two lines, each confirmed by the sponsor: backup withholding at 24% on the IRS's listed conditions, and 30% on an amount the sponsor enters for a foreign investor. Treaty rates, the portfolio interest exemption, partnership withholding on business income, FIRPTA, FATCA and state withholding are "ask your CPA" stops with an entered figure.
- C-04: delivery to the investor's own device is built now, as the last plan, on the invitation link the server already has, kept to one document and one screen. Why: without it D-01 is not true outside one browser; K-1s are due March 15, 2027.
- C-05: the nine-digit number for a 1099 is read from the signed W-9 or typed, checked against the last four on record, used for that file and never stored.
- C-06: matches where the taxpayer number's last four and the name both agree are shown in one list and confirmed together; every other K-1 is confirmed one by one with its own Part II beside the investor. Nothing is delivered unconfirmed. Why: a sponsor with a hundred investors must be able to use it, and a wrong delivery is a disclosure of tax data.
- C-07: 1099-INT and 1099-DIV are both built (the owner decided the character split is entered or confirmed by the sponsor or CPA, which is the 1099-DIV case); 1099-DIV is the later plan. The portal never proposes a split.
- C-08: opens are tracked (D-01). Not built: computed deposit due dates, a portal-built 1042-S, an export for a paid filing service, a CPA contact field.
- For the owner: real combined K-1 files from a CPA (more than one tax program if possible) to measure the split on; the free IRS code application, so the real upload template can be downloaded and an upload tried; a CPA's read of the Notes case and the stop list.
- Not confirmed by the research (blocked sites or sign-in): vendor prices; the IRS's own upload template (column rules were read for tax year 2025; the exact header text and cents are unconfirmed); the regulations' own text. Each plan that depends on one of these says so and proves what it can.

## Plans (2026-11-19): 13 plans in 6 waves (d82a9e3, 9f994d3)
Waves: 1 = 10-01 (distribution record, gate10.sh), 10-02 (K-1 split core) · 2 = 10-03 (PDF libraries shipped in the repository), 10-04 (Tax documents page), 10-05 (withholding rules) · 3 = 10-06 (delivery and consent), 10-07 (distribution screen), 10-08 (withheld tax, worksheet), 10-09 (1099-INT core) · 4 = 10-10 (1099-INT on screen), 10-12 (delivery to the investor's own device; needs the server) · 5 = 10-11 (1099-DIV) · 6 = 10-13 (waits on the owner: real K-1 files, the IRS template, a CPA's read).

## Planner's choices the owner may reverse
- P-1: a recorded distribution can be cancelled by an admin with a reason. Why: with "paid once its date arrives", a mistaken record would otherwise feed a 1099 with no remedy. It is the one control the managed edition gains.
- P-2: the link that delivers a tax document to the investor's own device asks for the last four digits of the tax number on record (five tries, then locked); an investor with no number on record gets paper. Why: the document carries a full taxpayer number and a link in an email is not enough on its own.
- P-3: the payer's own EIN is typed at each build of the IRS file and not stored (only its last four).
- P-4: the self-serve welcome step's general tick loses the words "tax documents", because that tick is not the consent the IRS rules require for them.
- P-5: the shipped PDF library files carry neutral names; bytes unchanged, pinned by SHA-256 (the versions the portal already runs; their hashes match the public registry).
- Found while planning: every investor of every firm, real ones included, is shown a generated "Schedule K-1" or "Form 1099-INT" cover page nobody's CPA prepared (`data.js` `NS.investorDocs`). 10-06 removes it for firms that are not sample firms.
