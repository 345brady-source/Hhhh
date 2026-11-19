# Phase 11: Fund accounting and the CPA year-end package - Context

## Decisions (owner, 2026-11-16, from 01.4-RESUME "Roadmap additions" and "CPA year-end tax package")
- D-01: full fund accounting: general ledger, trial balance, management fees and expenses, NAV for open-ended funds, bank reconciliation, GAAP financial statements. Built before the report builder, which reads from it.
- D-02: the CPA year-end tax package is built as part of this phase (owner: "or while we add fund accounting"): one click gives the sponsor's CPA everything needed to prepare the K-1s and 1099s: investor tax details from the W-9/W-8, ownership and its changes with dates, capital roll-forwards, distributions by type, fees and waterfall results, trial balance, general ledger, income and expenses, property and depreciation inputs; spreadsheet plus PDF.
- D-03: a CPA partner who receives these packages from sponsors who opt in is being looked into (phase 10 D-05); the package must be usable by any CPA without the portal.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; no budget for monthly fees, so a $0 path comes first); white label; lean screens; .planning/AUTOPILOT.md conditions. The preview runs with no server: everything must work from the browser's own storage.

## Questions the research must answer
- What already exists: the audit engine (assets/js/audit.js: capital accounts, schedules, checks, change log, zip), operations.js (calls, distributions, requests), waterfalls, share classes, currencies, fund types. What is a real ledger there and what is derived on the fly.
- The smallest ledger design that makes D-01 true for the fund types the portal supports (closed-end real estate and private equity first, open-ended with NAV), with double entry that every existing money event posts to, so nothing is entered twice.
- Bank reconciliation at $0: statement file upload (which formats banks give: CSV, OFX, BAI2) and matching; no paid bank feed.
- GAAP statements a small private fund actually issues (statement of assets and liabilities, operations, changes in partners' capital, cash flows, schedule of investments) and what a CPA expects in a tax package for a partnership return.
- Outside services and libraries with real prices and licences; which are worth it against in-house.
- How to prove the numbers: tie-outs against the existing audit engine and hand-worked examples.
