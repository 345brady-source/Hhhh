# Carrow & Vale Investor Portal

A white-label investor portal and sponsor console for Carrow & Vale Shareholder Advisors. Carrow & Vale's clients are investment firms and private placement sponsors; each client's investors see a portal carrying only that client's brand.

It is a static app with no build step:

```sh
python3 -m http.server 8000
# http://localhost:8000/?tenant=ashwell-ridge
```

## Two sides

**Investor portal** (what a client's investors see)

| Page | Contents |
|---|---|
| Investments | Amount invested, distributions received, and time until exit for each investment; exited investments; and, for each investment, its last distribution and next distribution date |
| Investment | One investment's figures, a timeline from closing to projected exit, the key terms the sponsor chose to show, the latest update, its payments and documents |
| Distributions | Totals, received by year, full payment history filterable by year and investment |
| Documents | Updates, tax documents (K-1, grantor trust letter or 1099-INT depending on the investment), statements and agreements, on the client's letterhead |
| Account | Investor details, distribution bank account (update by re-verifying), tax and accreditation status |
| Settings | Light, dark or match the device; saved in the browser and overrides the client default |
| Sign-in and activation | Branded sign-in and a guided first-time activation |

**Sponsor console** (Carrow & Vale and client staff)

| Page | Contents |
|---|---|
| Overview | A five-step setup checklist for new clients, key figures, and items needing attention (investors not activated, investors without bank details, exits or maturities within 12 months) |
| Offerings | Each investment configured separately: type, closing date, how exit is defined, distribution frequency, the key terms investors see, the latest update, and the ACH company name and ID it pays under. A live preview shows what investors will see |
| Investors | Activation status and payment method for every investor; invite one investor or import a list; preview the branded invitation email; open an investor's activation |
| Distributions | Allocate a payment pro rata by amount invested (to the cent), generate the NACHA file, and record the payment so investors see it |
| Notices | Email investors that a quarterly report or new documents are in their portal. Templates, merge fields ({first_name}, {investment}, {quarter}, {documents} and others), audience of all investors, one offering, or any number of specific investors across offerings (separate searchable picker), optional inclusion of investors who have not activated, a branded preview, and a sent history. Each notice also appears in the recipients' portals |
| Reports | Distribution reports for any period (this or last quarter, year to date, last year, last 12 months, since inception, or custom dates), for all offerings or one, viewed by investor, by payment or by offering, with totals and a CSV download. Investor contact lists filtered by offering, account status and payment method, with CSV download and copy-all-emails. Contact exports never include bank account numbers or taxpayer IDs |
| ACH origination | ODFI and file-header values, company name and ID, entry description, and optional balanced files |
| Portal and brand | Logo, colors with an accessibility check, typeface, header style, onboarding requirements, support contact and disclosures |

## Who sees what

| Role | Sees |
|---|---|
| Investor | Only the client's branded portal. No Carrow & Vale name or bar, and no access to the console |
| Sponsor staff | Their own firm's console, in their own colors with their logo, and an unbranded "Investor preview" bar when they view the portal as an investor. No client switching, no "Powered by" setting, no configuration export |
| Carrow & Vale staff | Every client, the operator bar (client switcher, portal/console toggle, view as any investor) and new-client setup |

In production the role comes from sign-in. Because this build has no server, a small "Demo · signed in as" control in the bottom-left corner switches roles. To remove it, set this before the scripts load:

```html
<script>window.CVPortalConfig = { demo: false };</script>
```

With demo mode off and no role supplied, the app defaults to the investor view. A server can pass the signed-in role as `window.CVPortalConfig = { demo: false, role: 'sponsor' }`; enforce access on the server as well, since anything in the browser can be changed by the user.

## Every investment is different

Exit timing is configured per offering with one of five definitions:

| Basis | Typical use | Investors see |
|---|---|---|
| Projected exit date | Funds, energy projects | "Projected exit Sep 2029 · 2 years, 10 months remaining" |
| Projected exit window | Syndications, DSTs, co-investments | "Projected exit 2027–2029 · Exit window opens in 7 months" |
| Maturity date | Notes and private credit | "Maturity Jun 30, 2027 · 7 months remaining" |
| No set term | Royalties, evergreen programs | "No set term" plus the sponsor's note |
| Exited | Sold or repaid | "Exited Aug 15, 2025 · Held 6 years, 3 months" |

## Distribution schedule

Each offering that pays on a regular schedule (monthly, quarterly, semi-annual or annual) has a payment day of the month, set in the offering editor. The next distribution date continues that schedule from the last payment; when the day falls on a weekend or Federal Reserve holiday, payment moves to the next banking day and investors see why. A payment recorded in the console for a future date takes precedence. Investors see each investment’s next date in Recent distributions and on the investment page, and the console's new-distribution form defaults to it.

Offering types (real estate syndication, DST, private equity fund, co-investment, private credit, energy infrastructure, oil and gas royalties) start with sensible defaults for frequency, payment type and key terms; everything can be changed.

## Investor onboarding

An invited investor activates in five steps, configurable per client:

1. Create a login
2. Investor information: entity type (individual, joint, trust, entity, IRA), name on the account, address, taxpayer ID (only the last four digits are kept)
3. Accreditation (can be turned off)
4. Distribution payments: ACH bank details with live ABA routing-number validation and an ACH credit authorization; check by mail can be allowed
5. Review and sign: e-delivery consent, substitute W-9 certification, typed signature

Completing activation updates the investor's record, so their bank account is included in the next NACHA file.

## NACHA files

`assets/js/nacha.js` builds standard ACH files:

- 94-character records, blocking factor 10, padded with `9` filler records
- File header (1), batch header (5), entry detail (6), batch control (8), file control (9)
- Credits use transaction code 22 (checking) or 32 (savings)
- One batch per SEC code: PPD for individuals, joint accounts and trusts; CCD for entities and IRA custodians
- Optional balanced files with an offsetting debit (27/37) to the settlement account
- Entry hash, totals and block count computed per batch and per file
- Checks before download: record length, ABA check digits, account numbers, effective date is a banking day (weekends and Federal Reserve holidays through 2028), totals reconcile, padding
- Entries that fail validation are left out and listed; investors without bank details are listed as check payees

The console shows the file with a field-by-field breakdown of any record. Files download as `.ach`. Inside Claude's artifact viewer they save as `.txt`, because that viewer only allows certain extensions; the content is identical.

Confirm every value against your bank's ACH implementation guide before the first live upload.

## White-label engine

`assets/js/brand.js` turns two brand colors into a full light and dark palette. If a color is too light or too dark to read as text, it steps the OKLCH lightness of the same hue until it meets WCAG AA, while buttons keep the exact brand color. Logos can be uploaded or generated from five marks; the favicon follows.

## Sample data

Kestrel Bay Capital, Ashwell Ridge Real Estate and Greywater Infrastructure Partners are fictional firms. Investors, bank names and account numbers are invented; routing numbers pass the ABA check digit but are not tied to real banks. Every figure reconciles: each investor's distributions are their exact pro-rata share of each payment.

Placeholders such as "[Regulatory disclosures to be provided by counsel.]" are intentional.

## Before production

This build stores everything in the browser for demonstration. A production deployment needs:

- A server-side database and the fund administrator's data in place of `data.js`
- Authentication with two-step verification, and role-based access so the console is staff-only
- Encryption of taxpayer IDs and bank account numbers at rest; never store full numbers in the browser
- Bank-change verification (call-back) before updated ACH details are used
- Secure file transfer (SFTP or the bank's portal) for NACHA uploads, with dual approval
- An email service (for example Amazon SES, SendGrid or Postmark) to deliver invitations and notices; this build records notices and shows them in the portal but sends no email

## Files

```
index.html                 entry point
assets/css/portal.css      investor portal styles and default tokens
assets/css/console.css     sponsor console and operator bar
assets/js/brand.js         white-label engine: color math, token derivation, logos
assets/js/tenants.js       client configs, offering types
assets/js/data.js          sample roster, distribution history, allocation, exit math
assets/js/workspace.js     per-client storage
assets/js/nacha.js         NACHA file builder and validation
assets/js/charts.js        distributions column chart
assets/js/app.js           shell, routing, operator bar, shared helpers
assets/js/documents.js     letterhead document previews
assets/js/portal.js        investor pages
assets/js/onboarding.js    investor activation
assets/js/console.js       sponsor console
```
