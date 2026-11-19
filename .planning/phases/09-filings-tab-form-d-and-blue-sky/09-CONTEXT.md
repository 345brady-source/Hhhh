# Phase 09: Filings tab - Context

## Decisions (owner, 2026-11-16, from 01.4-RESUME "Step 4")
- D-01: a new console tab "Filings" holding everything below; all optional (sponsors can still file themselves).
- D-02: Form D filed by the portal through the SEC's EDGAR APIs (EDGAR Next), Carrow & Vale as filing agent. $100 per Form D including EDGAR access setup for new issuers (pre-filled Form ID ready to notarize, a guide for login.gov and naming Carrow & Vale as filing agent, progress tracking). Form D amendments $50.
- D-03: blue sky notice filings done by Carrow & Vale: the portal collects the sponsor's information and each state's fee; $100 per filing covering any number of states; renewals $50; state fees passed through at cost. NASAA EFD has no known public API: research it.
- D-04: reminders when filings are due (first Form D within 15 days of first sale, annual amendment, state deadlines and renewals); the sponsor can silence reminders.
- D-05: payments for these services depend on the payments provider chosen in phase 08; until then the portal records the order and the amount due.
- Carried: white label; lean screens; .planning/AUTOPILOT.md conditions. Filing itself needs Carrow & Vale's EDGAR filing-agent access (the owner is applying); build and test against the SEC's test/beta environment or recorded fixtures, never a live filing.
