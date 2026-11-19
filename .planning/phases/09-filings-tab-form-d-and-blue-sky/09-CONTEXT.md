# Phase 09: Filings tab - Context

## Decisions (owner, 2026-11-16, from 01.4-RESUME "Step 4")
- D-01: a new console tab "Filings" holding everything below; all optional (sponsors can still file themselves).
- D-02: Form D filed by the portal through the SEC's EDGAR APIs (EDGAR Next), Carrow & Vale as filing agent. $100 per Form D including EDGAR access setup for new issuers (pre-filled Form ID ready to notarize, a guide for login.gov and naming Carrow & Vale as filing agent, progress tracking). Form D amendments $50.
- D-03: blue sky notice filings done by Carrow & Vale: the portal collects the sponsor's information and each state's fee; $100 per filing covering any number of states; renewals $50; state fees passed through at cost. NASAA EFD has no known public API: research it.
- D-04: reminders when filings are due (first Form D within 15 days of first sale, annual amendment, state deadlines and renewals); the sponsor can silence reminders.
- D-05: payments for these services depend on the payments provider chosen in phase 08; until then the portal records the order and the amount due.
- Carried: white label; lean screens; .planning/AUTOPILOT.md conditions. Filing itself needs Carrow & Vale's EDGAR filing-agent access (the owner is applying); build and test against the SEC's test/beta environment or recorded fixtures, never a live filing.

## Orchestrator choices (2026-11-19; asked by push, no answer within 15 minutes; the owner may override any of them)
- C-01: the first working filing route is a Carrow & Vale person uploading the portal-built Form D file on EDGAR. Why: the SEC's API needs two technical administrators and a manual token renewal every 30 days; the upload route needs neither and can be proven now. The API route stays planned behind the same interface.
- C-02: the sponsor completes Form ID on the SEC's site from the portal's answer sheet. Why: the SEC accepts Form ID only when typed into its own dashboard, and doing it on a sponsor's behalf needs a notarized power of attorney and a lawyer's wording.
- C-03: the EFD system fee is passed through at cost with the state fees. Why: consistent with D-03 (state fees at cost).
- C-04: Carrow & Vale staff see and work orders by email plus token-protected server calls. Why: the self-serve edition has no staff role, and a staff console is out of scope for this phase.
- Open for the owner: a second person for Carrow & Vale's EDGAR account (opens the API route); the official NASAA fee matrix (network host blocked from this session).
