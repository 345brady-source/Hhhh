# Phase 11 deferred items (found during execution, outside the plan that found them)

## From 11-04 (2026-11-19, base 211ad70)

- **Reference gate MEASURE fails on the base itself (leak part).** `SCRATCH/owner-set/measure.js --run leak` reports 1 place with a run of eight words from the owner's documents: `assets/js/taxdocs.js:531` (the electronic-delivery notice rules, committed in 324b5ce, phase 10). 11-04 changed no product file (its diff is three new files under this phase's checks folder), so every gate run on this base fails MEASURE until the wording is rewritten or the run is judged allowed by whoever owns the leak list. Owner of the fix: phase 10 (taxdocs.js) or the orchestrator.
- **EMAIL DIALOG part `phone` failed once in the gate run** (`phone-390x844-frame520px`: 10 of 11 paragraphs seen whole; the paragraph starting "The link below takes you through everyth" was not). No product file differs from the base; see 11-04-SUMMARY.md for the rerun result.
