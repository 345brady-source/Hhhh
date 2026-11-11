# Carrow & Vale Investor Portal

A white-label investor portal and sponsor console from Carrow & Vale Shareholder Advisors, in two editions: the managed portal Carrow & Vale runs for its clients (investment firms and private placement sponsors), and the Carrow & Vale (self-serve) that firms sign up for and run themselves. Either way, investors see a portal carrying only their firm's brand.

It is a static app with no build step:

```sh
python3 -m http.server 8000
# http://localhost:8000/?tenant=ashwell-ridge   managed edition
# http://localhost:8000/portal.html             self-serve edition (sign-up)
```

## Two editions

The same code runs as two products. Each keeps its own data in the browser (separate storage), so they can be opened side by side. Both use the same investor mobile app (Shareholder Desk).

| | Carrow & Vale (managed) | Carrow & Vale (self-serve) |
|---|---|---|
| Entry point | `index.html` | `portal.html`, the page firms publish (sets `window.CVPortalEdition = 'selfserve'`). `diy.html` is the same page under its development name: "DIY" is an internal key and must not appear in a published address, because investors see the address in their invitation links |
| Who runs it | Carrow & Vale staff set up and run each client's portal | The firm signs itself up and runs its own portal |
| Roles | Carrow & Vale staff, sponsor staff, investor | Admin, team member, investor |
| Setup | Carrow & Vale's new-client setup and offering intake | Self-serve sign-up (firm name, brand color, logo), then a setup checklist |
| Offerings | Added and configured only by Carrow & Vale | Added by the firm's admins, including offering intake |
| Investor verification | Carrow & Vale's own AML/KYC process | Automated verification through providers the firm plugs in (below) |
| Branding | Investors see only the client's brand; Carrow & Vale staff get an operator bar | Fully white-labeled: investors see only the firm's brand (no Carrow & Vale name and no "Powered by"). The product name appears only on the sign-up page firms use |

Everything else is shared: investor portal, offerings, distributions and NACHA files, capital calls, requests, documents, notices, reports, audit package, structures, offering intake and e-signature.

### Carrow & Vale (self-serve)

- **Sign-up.** Firm name, the admin's first and last name and email, a password, the kind of offerings, a brand color and a logo create the portal. The sign-up page is the only place the product name appears; the header links to a sample portal.
- **Setup checklist.** Brand, verification providers, ACH origination, first offering (from its documents), the offering's subscription agreement, team, investors, first distribution. Each step links to its page and ticks itself off.
- **Names.** Every form that asks for a person's name asks for first name and last name (sign-up, team, invitations, lists, joint owners, beneficial owners, countersigners). Organisation and account names stay one field; a typed signature is one line.
- **Team.** Admins invite team members, change roles and remove people (at least one admin always remains). Team members operate the portal (investors, calls, distributions, documents, notices) but cannot change brand, integrations, offerings intake or the team. Every change is in the change log.
- **Turnkey investor onboarding.** Enter an investor's first name, last name and email and send one link from the console; the link takes them through every step, including signing the offering's subscription agreement, and the console is notified and adds them when they finish (below). Investors can also be imported from a CSV or Excel file, or added manually when they were onboarded on paper.
- **Offering sign-up links.** Each offering that is raising has a link investors can use to join on their own: they enter their details, then follow the same guided onboarding.

## E-signature

A built-in signing module for subscription agreements, side letters and any other PDF, in both editions.

- **Envelopes.** Upload a PDF, pick a template or a published document, add investor signers (and optionally a countersigner from the firm), choose signing in order or in any order, and place fields: signature, initials, date signed, name, text and checkbox. Fields can be dragged, resized and placed with the keyboard.
- **Signing.** Investors see a banner and a "Waiting for your signature" list. They agree to sign electronically (ESIGN and UETA consent), then type, draw or upload a signature that is reused for later fields. Required fields are checked before finishing; investors can decline with a reason.
- **Completion.** Each signer's fields are stamped into the PDF, and the last signature adds a certificate of completion: envelope ID, document SHA-256 before and after, each signer's consent, viewed and signed times and browser, and the full history. The signed PDF is published to the investors' Documents.
- **Tracking.** Status per signer, reminders, voiding, downloads of the signed PDF, the certificate and the original; every step is in the change log.
- **Subscription agreements, set up once on the offering.** Each offering page has a Subscription agreement panel. The firm uploads the agreement (or picks a PDF already on the offering) before any investor exists. The signing fields are placed automatically at the PDF's signature lines: the investor's signature, printed name and date, the commitment amount (filled in for them and locked), and the firm's countersignature block when the firm countersigns. The firm checks and adjusts them in the field editor and saves. From then on every investor invited to the offering signs the agreement online during onboarding, with their name and commitment filled in. Nothing is prepared or sent per investor. The agreement can be edited (Edit fields), replaced or removed at any time; agreements already sent are not affected.
- **Other templates.** Any envelope's fields can be saved as a template for documents that are sent by hand (side letters, amendments).

Before production: verify signers' identities (email codes or sign-in), capture IP addresses on the server and seal the certificate with a server-side signature.

## Investor verification (self-serve edition)

Investors are verified while they onboard: identity (KYC), sanctions and politically exposed person screening (AML), and accredited investor status where an offering requires it (Rule 506(c), or always, or never, as the firm chooses). The portal does not choose providers: the firm plugs in the services it uses, as many as it likes for each check.

- **Built in:** a sandbox (simulated results, to try the flow), upload for the team to review, screening by the team, self-certification (Rule 506(b) only), and the free U.S. Treasury sanctions lists (OFAC SDN and Consolidated), screened on the integration server.
- **Plugged in:** any third-party service, connected either through the integration server (a connector) or as a hosted link from the provider.
- **More than one:** when several identity or accreditation connections are on, investors choose which to use. Every screening connection that is on runs; any potential match holds the investor for review.
- **Decisions:** investors are approved automatically when every required check passes (or held for the team if the firm prefers). Anything flagged waits on the AML/KYC page, where the team records results, approves or declines with a note. Accreditation expires after the firm's validity period (90 days by default) or the provider's date, whichever is earlier. Subscriptions are blocked until the investor is verified and, for 506(c) offerings, currently accredited.

## Turnkey investor onboarding (self-serve edition)

The firm sets up each offering's subscription agreement once (see E-signature), enters a first name, last name and email, and sends one link; the investor does everything else, including signing the agreement; the firm is told when it is done and the investor is already in the portal. When the offering was set up from documents that include the subscription agreement, its signing fields are prepared automatically for the firm to check.

**The firm (Investors page, Invite an investor).** First name, last name and email are all it takes. The offering is preselected when one is raising, and the form says whether the investor will sign its subscription agreement (with a link to add the agreement when it is missing). How they invest, the account name, a different offering, a fixed commitment, the share class and a personal note are under More options.

- **Import a list.** Upload a `.csv` or `.xlsx` file (the first worksheet is read) or paste a list: first name, last name, email, then optionally offering, commitment and how they invest. A header row is recognized, the older `name, email, ...` order still works, and the list is checked and previewed before anything is sent.
- **Add manually.** For an investor onboarded on paper: they are added as an active investor without the onboarding link, optionally with the subscription they signed (recorded as accepted under the team member's name), the team's offline identity, screening and accreditation checks, and a link to sign in to their portal.

Send invitation emails the link from the firm: `From: "<firm name>"`, replies to the firm's support address, the firm's logo and colors, nothing naming this software. The invitations list shows each one's progress (sent, opened, step 4 of 10, completed) with Resend (a new link; the old one stops working), Copy link, Cancel and Invite again. Links expire after 30 days.

**The investor (one link, one progress bar, the firm's brand only).**

1. Welcome: who invited them, the offering and commitment, and consent to sign and receive documents electronically
2. Create a login
3. Investor information: individual, joint, trust, entity or IRA; address; taxpayer ID (only the last four digits are kept); beneficial owners for entities
4. Identity verification, with sanctions and politically exposed person screening in the background
5. Accredited investor verification, when the offering is Rule 506(c) or the firm's rules ask for it
6. Tax certification: W-9, or W-8BEN / W-8BEN-E for non-U.S. investors
7. Distribution payments: ACH bank details with routing-number validation, or check
8. Subscription: the offering documents and the commitment the firm set
9. The subscription agreement, filled in and signed inside the flow
10. Done: a summary and what happens next

They can stop and pick up where they left off, on a phone or a computer. Verification never blocks the paperwork: if a check is held for review, they still finish, and the firm decides. An investor already on file who is invited to another offering gets a short version (the subscription, plus accreditation only when that offering needs it and theirs is not current).

**When they finish.** The firm gets a notification in the console (and an email when the integration server is used), and the investor is added: their record, verification results, tax form, bank account, the subscription request, the signed agreement (waiting for the firm's countersignature), their documents and the full audit trail. When the firm countersigns, the subscription is accepted automatically once the investor is verified (a rule on the Investors page, on by default): a closed-end commitment goes on the investor register, an open-ended subscription is approved for funding.

**On one computer or across devices.** Without a server, invitations work in the same browser (to try the flow): the console shows the email for the firm to send from its own email app, and Open the investor's link walks the journey. For real use, run the integration server (`server/`): set `API_TOKEN`, `DATA_KEY`, `PUBLIC_URL`, `PORTAL_ORIGIN` and the `SMTP_*` settings, enter the server's address and token on the Integrations page, and list the server where the portal is published:

```html
<script>window.CVPortalConfig = { integrationServers: ['https://verify.yourfirm.example'] };</script>
```

The server emails the link, keeps the investor's progress encrypted (AES-256-GCM), confirms verification results against its own checks, and deletes each finished onboarding as soon as the console has imported it (or after 30 days, with a reminder to the firm a week before). See `server/README.md`.

**What the console accepts from an investor's device.** Everything an investor's browser sends could have been altered, so the console takes only what that investor could legitimately produce: their own signed agreement and the evidence files they uploaded (never replacing a file the console already has, and never publishing a document to anyone but that investor), verification results that the integration server's own checks confirm or that the firm's rules accept (self-certification only where verified accreditation is not required, sandbox results only while the sandbox is on), and accreditation valid for no longer than the firm's validity period. A countersignature never comes from the investor's side. Investors already on file keep the record the firm holds; only the new subscription, the signed agreement and any new accreditation result are added.

## Integration server

`server/` is a small Node service (no dependencies) that holds provider credentials and receives their callbacks, so no secret ever reaches the browser. It also carries turnkey invitations across devices: it emails investors and the firm, holds each investor's progress encrypted, and hands finished onboardings to the console. See `server/README.md`.

## Two sides

**Investor portal** (what a client's investors see)

| Page | Contents |
|---|---|
| Investments | Amount invested, distributions received, and time until exit for each investment; completed investments; capital calls due with wire instructions; the investor's requests and their status; offerings open for investment; and, for each investment, its last distribution and next distribution date |
| Investment | One investment's figures, a timeline from closing to projected exit, the investor's capital account (value, net IRR or net return, and a breakdown since inception), capital calls and unfunded commitment, liquidity terms with e-signed redemption and additional-subscription requests (open-ended funds), the key terms the sponsor chose to show, the latest update, its payments and documents |
| Subscribe | Online subscription to an offering that is raising: offering terms, subscription documents, accreditation confirmation and e-signature |
| Distributions | Totals, received by year, full payment history filterable by year and investment |
| Documents | Updates, quarterly capital account statements, tax documents (K-1, grantor trust letter or 1099-INT depending on the investment) and agreements on the client's letterhead, plus files the manager publishes (opened in the browser or downloaded) |
| Account | Investor details, distribution bank account (update by re-verifying), tax and accreditation status |
| Settings | Light, dark or match the device; saved in the browser and overrides the client default |
| Sign-in and activation | Branded sign-in and a guided first-time activation, including identity verification (ID for individuals; beneficial owners for entities and trusts), a politically-exposed-person question, and automatic sanctions screening |

**Sponsor console** (Carrow & Vale and client staff)

| Page | Contents |
|---|---|
| Overview | A five-step setup checklist for new clients, key figures, net asset value, contributed, distributed and unfunded capital by fund, and items needing attention (investors not activated, investors without bank details, exits or maturities within 12 months, open capital calls, requests awaiting approval, screening matches and re-screens due) |
| Offerings | Each investment configured separately: type, closing date, how exit is defined, distribution frequency, the key terms investors see, the latest update, and the ACH company name and ID it pays under. A live preview shows what investors will see |
| Offering intake | Carrow & Vale only. Upload an offering's documents (PDF, Word or text: PPM, partnership or operating agreement, subscription documents, term sheet) and the portal reads them and sets the offering up (see below) |
| Investors | Activation status and payment method for every investor; invite one investor or import a list; preview the branded invitation email; open an investor's activation |
| Capital calls | Issue a call by percentage of commitments or dollar amount, split pro rata to commitments and checked against each investor's unfunded commitment; investors get the notice and wire instructions in their portal; record payments, send reminders, and track open and overdue amounts. Payments flow into capital accounts and the audit schedules |
| Requests | Redemptions and subscriptions investors submit and e-sign in the portal: approve or decline, record redemption payments at the dealing-date net asset value, record subscription funding or countersign commitments. The investor register and capital accounts update automatically |
| Documents | Publish reports, statements, tax documents and notices to one fund, all investors, or individual investors matched by the investor ID in each file name (for example a folder of K-1s); notify recipients; each file's SHA-256 is recorded in the change log |
| AML/KYC | Identity verification status, risk rating, beneficial owners, sanctions and PEP screening results and next review date for every investor; review potential matches (clear as a false positive with a note, or escalate), approve identity, and re-screen investors who are due |
| Distributions | Allocate a payment pro rata by amount invested (to the cent), generate the NACHA file, and record the payment so investors see it. For funds with carry, enter gross proceeds to split them through the offering's waterfall tier by tier; the investors' share is allocated and the GP's share is recorded as carried interest paid |
| Notices | Email investors that a quarterly report or new documents are in their portal. Templates, merge fields ({first_name}, {investment}, {quarter}, {documents} and others), audience of all investors, one offering, or any number of specific investors across offerings (separate searchable picker), optional inclusion of investors who have not activated, a branded preview, and a sent history. Each notice also appears in the recipients' portals |
| Reports | Distribution reports for any period (this or last quarter, year to date, last year, last 12 months, since inception, or custom dates), for all offerings or one, viewed by investor, by payment or by offering, with totals and a CSV download. Investor contact lists filtered by offering, account status and payment method, with CSV download and copy-all-emails. Contact exports never include bank account numbers or taxpayer IDs |
| Audit | Audit-ready records for any fund and period: readiness checks, a preview of every schedule, and a one-click audit package (see below) |
| ACH origination | ODFI and file-header values, company name and ID, entry description, and optional balanced files |
| Portal and brand | Logo, colors with an accessibility check, typeface, header style, onboarding requirements, support contact and disclosures |

## Offering intake

Carrow & Vale staff upload an offering's documents and the portal sets the offering up from them:

1. **Read.** PDFs (with page references), Word files (tables included) and text are read in the browser. Long documents are trimmed to the cover pages plus every passage that mentions terms. When the portal is open in Claude, Claude reads the documents (the viewer is asked to allow it once). Anywhere else, or if Claude is not allowed, the built-in reader does the work (below).
2. **Review.** Every term is shown in an editable form with where it came from (the quoted passage and page) and whether it was stated, inferred or needs checking. Lists (share classes, feeder funds, waterfall tiers, key terms) can be edited, added to or trimmed.
3. **Apply.** The portal creates the offering, or updates an existing one: name, type, status, first close, minimum, currency, term and exit timing, distributions, management fee and basis, carry or incentive, preferred return, catch-up, high-water mark, waterfall tiers, share classes, feeder funds, side pockets, equalization, liquidity (redemption frequency, notice, lock-up, early redemption fee, gate), service providers, the key terms investors see and the description. The documents are kept with the offering, published to its investors and subscription page if chosen, and their SHA-256 fingerprints are recorded in the change log.

Any offering's structure can be reopened in the same editor (Edit structure on the offering). Sponsors see the structure read-only.

**The built-in reader** (`assets/js/reader.js`) works without Claude and is built to be thorough:

- It splits the documents into sections by heading: summary-of-terms entries, memorandum and agreement headings ("4.1 Management Fee."), term-sheet rows (tabs or "Heading: value"), questions and answers. Each term is read from the section that defines it first, then from patterns across the whole text.
- Text is cleaned first: numbers written in words ("two and one-half percent (2.5%)", "sixty (60) days", "seven to ten years"), basis points, fractions, abbreviations (Mgmt Fee, Min., yrs, p.a., $500K), hyphenated and wrapped PDF lines, page numbers, running headers and footers, and tables of contents.
- Waterfalls are read step by step ("first, ... second, ... thereafter", "(i) ... (iv)", "Tier 1 ... Tier 3" tables): return of capital, preferred return (simple or compounding, including steps that only say "any unpaid preferred return"), catch-up and its GP share, and splits that end at an IRR or a multiple of capital. When a deal has separate operating and sale waterfalls, the fuller one is used and the other is noted.
- It also reads the fund name and vehicle, general partner and manager, every service provider it can identify, fund size and hard cap, closings, minimums (initial and additional), management fee basis and step-down after the investment period, fee offsets and other fees, carry or incentive and crystallization, high-water mark, share classes from prose or tables (fees, minimums, currency, founders cut-off), master and feeder funds, side pockets, equalization, redemption terms (frequency, notice, lock-up and type, early redemption fee, fund and investor-level gates, holdbacks, payment timing), term, extensions, investment period, hold period or maturity, distributions (frequency, target, payment day), target returns, leverage, capital call notice, GP commitment, reporting, and facts by fund type (property, location, purchase price and financing; basin and royalty acres; company, security and lead investor; assets and custody).
- Values that differ between passages or documents are flagged for checking, important terms it could not find are listed, and provisions worth knowing (clawback, key person, no-fault removal, advisory committee, side letters, recycling, subscription lines, default remedies, ERISA limits, transfer restrictions, suspension of redemptions) become notes.
- It is measured against sets of offering documents in different styles (PPMs, LPAs, operating agreements, term sheets, Q&A memos, scanned-style PDFs with headers and wrapped lines).

The capital call form uses the notice period the documents give, and a fee step-down after the investment period is applied in the capital accounts and audit schedules.

## Complex fund structures

- **Share classes.** Each class can carry its own management fee, carry or incentive, preferred return, minimum and currency. A founders class can close on a date (for example the first anniversary of the first close); new subscribers choose from the open classes, and each investor is charged at their class's rates.
- **Master-feeder.** Feeder funds with domicile and who each is for; investors are assigned by investor type (tax-exempt investors to the offshore feeder) unless set on the position. The class and feeder appear in the investor register and capital account rollforward.
- **Distribution waterfalls.** Return of capital, preferred return (compounding or simple), GP catch-up, and splits that end when investors reach an IRR or a multiple of their capital, in any order and any number (for example an 8% simple preference paid first, then capital, 70/30 to a 15% IRR, then 50/50). European (whole fund) or American (deal by deal). Carry accrues each quarter through the waterfall.
- **Side pockets.** Illiquid holdings moved into a side pocket at a date belong only to investors in the fund then; they are valued separately, excluded from incentive until realized, and shown to each investor.
- **Equalization.** Incentive is computed on each investor's own gains above their high-water mark (capital accounts, equalization or series of shares give the same result here).
- **Currencies.** Offerings in euros, sterling, Swiss francs, Canadian, Australian, Singapore and Hong Kong dollars and yen show amounts in their currency, and the audit schedules are labeled with it.

The audit package adds share class (17), feeder fund (18) and side pocket (19) schedules when an offering has them.

## Audit-ready data

The Audit page builds what a fund's auditor asks for, for any fund and any period (last fiscal year, year to date, last quarter, inception to date or custom dates). It works for venture capital, private equity, hedge, digital asset, SPV, real estate and multi-strategy funds, plus private credit and real assets. Sponsors and Carrow & Vale staff can both use it.

**Accounting by fund type.** Closed-end drawdown funds (VC, PE, SPV, real estate, credit, real assets) take contributions by capital call, value positions quarterly, and accrue carried interest over a preferred return as if the fund were liquidated at net asset value. Open-ended funds (hedge, digital asset, multi-strategy) take subscriptions at month-end NAV, charge the management fee on NAV, and accrue an incentive allocation over each investor's high-water mark, crystallized every December 31. Capital accounts run monthly in whole cents, so fund totals are always the exact sum of the investors. Carrow & Vale staff set each offering's fee rate, fee basis, carry or incentive, preferred return and auditor under Fund accounting on the offering; sponsors see these read-only.

**The package** is a .zip of CSV files that open in Excel, a README, and a SHA-256 manifest:

| File | Contents |
|---|---|
| 01–03 | Statement of assets and liabilities, statement of operations, statement of changes in partners' capital (limited and general partners) |
| 04 | Capital account rollforward for every investor: beginning, contributions, distributions, income, gains, fees, carry or incentive, ending, ownership |
| 05 | Investor register: commitment, contributed, unfunded, distributed, ending capital, ownership, tax form, masked taxpayer ID, accreditation, portal status, payment method |
| 06 | Capital activity ledger: every contribution and distribution with its bank reference (NACHA file and trace number, or check number) |
| 07 | Distribution reconciliation: each payment's total against investor allocations, ACH entries and checks |
| 08–10 | Schedule of investments with cost, fair value, ASC 820 level, valuation technique, key input and supporting document; fair value hierarchy; Level 3 inputs |
| 11–12 | Management fee calculation; carried interest or incentive allocation by investor |
| 13 | Performance: net IRR, DPI, RVPI and TVPI for closed-end funds; monthly, year-to-date and annualized net returns for open-ended funds |
| 14 | By fund type: custody reconciliation (digital assets: book against custodian quantities by wallet), property schedule (real estate: appraisals, mortgages, loan to value, cap rates), strategy allocation (multi-strategy: allocation and return by strategy) |
| 15 | Change log for the period |
| 16 | Readiness checks |

The investor register also shows each investor's AML/KYC status and next review date, the capital activity ledger includes redemptions, and the statement of assets and liabilities shows redemptions payable. Readiness checks include overdue capital calls, redemptions paid within terms and AML/KYC status.

**Readiness checks** tie the schedules to each other (capital rolls forward, partners' capital equals net assets, the schedule of investments agrees to the balance sheet, ownership totals 100%), match distributions to bank files, and flag what to fix before fieldwork: missing tax forms or accreditation, stale Level 3 valuation support, custodian differences, distributions recorded without a NACHA file, and any break in the change log.

**Change log.** Every distribution, NACHA file, capital call, valuation approval, investor invitation and activation, notice, offering edit, settings change and audit export is appended with who did it and when. Each entry is SHA-256 hashed together with the previous entry's hash, so any later edit is detected and reported. In production each entry carries the signed-in user's name and email.

## iOS app: Shareholder Desk

`mobile/` holds the investor app for iPhone and Android, named **Shareholder Desk** so it carries no Carrow & Vale branding. Investors of both editions use the same app. Investors sign in with their email, password and a 6-digit code; the app opens the account of the firm they invested with, in that firm's branding. It shows investments, time to redemption, distributions with next payment dates, documents, notices, account details and settings (light or dark, Face ID). It is built with Expo (React Native) and shares this portal's core logic, so the figures match. See `mobile/README.md` for running, building and App Store submission.

## Who sees what

| Role | Sees |
|---|---|
| Investor | Only the client's branded portal. No Carrow & Vale name or bar, and no access to the console |
| Sponsor staff | Their own firm's console, in their own colors with their logo, and an unbranded "Investor preview" bar when they view the portal as an investor. Offerings are read-only: only Carrow & Vale adds offerings or changes their exit timing, distribution schedule, terms and ACH originator. The Portal and brand page is hidden. No client switching and no configuration export |
| Carrow & Vale staff | Every client, the operator bar (client switcher, portal/console toggle, view as any investor) and new-client setup |

In the self-serve edition the roles are admin (everything, including brand, integrations, offering intake and the team), team member (day-to-day operations) and investor (only the firm's branded portal; no product name anywhere).

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

In the self-serve edition, invited investors follow the turnkey onboarding above. In the managed edition, an invited investor activates in five steps, configurable per client:

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

A fourth sample client, **Pellbrook Partners**, runs a venture capital fund (with partly called commitments), a long/short hedge fund, a digital asset fund, a multi-strategy fund and an SPV, so every fund type has sample data. Holdings, valuations and auditors for all sample funds are fictional.

Kestrel Bay Capital, Ashwell Ridge Real Estate, Greywater Infrastructure Partners and Pellbrook Partners are fictional firms. Investors, bank names and account numbers are invented; routing numbers pass the ABA check digit but are not tied to real banks. Every figure reconciles: each investor's distributions are their exact pro-rata share of each payment.

Placeholders such as "[Regulatory disclosures to be provided by counsel.]" are intentional.

## Before production

This build stores everything in the browser for demonstration. A production deployment needs:

- A server-side database and the fund administrator's data in place of `data.js`
- Authentication with two-step verification, and role-based access so the console is staff-only
- Encryption of taxpayer IDs and bank account numbers at rest; never store full numbers in the browser
- Bank-change verification (call-back) before updated ACH details are used
- Secure file transfer (SFTP or the bank's portal) for NACHA uploads, with dual approval
- An email service that offers SMTP submission, set on the integration server (`SMTP_*`, `MAIL_FROM` on a domain with SPF and DKIM), to deliver invitations and notifications; notices posted in the portal are shown there but are not emailed yet

## Files

```
index.html                 entry point, managed edition
portal.html                entry point, self-serve edition, as published (same files with window.CVPortalEdition = 'selfserve')
diy.html                   the same page under its development name (tests use it)
assets/css/esign.css       e-signature screens
assets/css/diy.css         DIY sign-up page and verification screens
assets/js/edition.js       which edition is running: roles, storage, product name
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
assets/js/onboarding.js    investor activation and the self-serve edition's guided onboarding from an invitation link
assets/js/audit.js         fund accounting, audit schedules, readiness checks, change log, zip package
assets/js/operations.js    capital calls, redemption and subscription requests, AML/KYC, published documents
assets/js/structures.js    currencies, share classes, feeder funds, distribution waterfalls, equalization
assets/js/reader.js        the built-in offering-document reader (sections, waterfalls, classes, conflicts)
assets/js/intake.js        offering-document intake: PDF and Word reading, Claude or the built-in reader, apply
assets/js/console.js       sponsor console
assets/js/esign.js         e-signature: envelopes, field editor, signing, certificate of completion, templates
assets/js/integrations.js  DIY investor verification: connections, checks, decisions, Integrations page
assets/js/diy.js           DIY sign-up, team and offering sign-up links
assets/js/invitations.js   DIY turnkey invitations: invite form, progress, notifications, import, automatic acceptance
server/                    integration server: provider credentials and callbacks, invitations, email (see server/README.md)
tools/form_d_prospects.py  finds prospective clients in new SEC Form D filings (see below)
```

## Finding clients

`tools/form_d_prospects.py` lists sponsors who have just filed a Form D for a real estate, private equity, venture, hedge, other investment or oil and gas offering. It leaves out platform SPVs, crowdfunding platforms, wealth-platform feeders, large institutional managers and foreign filers, groups vehicles by sponsor, adds each sponsor's address and phone from EDGAR, and scores fit. Run it weekly:

```
SEC_USER_AGENT="Carrow & Vale yourname@yourdomain.com" python3 tools/form_d_prospects.py --days 7 --out new-this-week.csv
```

With a contact in `SEC_USER_AGENT`, add `--details` to read each filing for the amount being raised, the amount sold so far, the number of investors and the minimum.
