# Phase 09: Filings tab (Form D and blue sky) - Research

**Researched:** 2026-11-19
**Domain:** SEC Form D (EDGAR, EDGAR Next), state notice filings (NASAA EFD), filing reminders, order records
**Confidence:** HIGH for Form D itself, its XML schema and EDGAR Next account rules (read from SEC files this session). LOW for everything about NASAA EFD and state fees (the NASAA sites could not be reached). MEDIUM-LOW for exact EDGAR API endpoint details (the API toolkit could not be reached).

## What could not be established (read this first)

1. **The EDGAR API Development Toolkit was not read.** `api.edgarfiling.sec.gov` and `api-bravo.edgarfiling.sec.gov` are outside this session's allowed network (proxy answered 403 to CONNECT; WebFetch answered ENOTFOUND). Not verified: exact endpoint paths, rate limits, the toolkit's explicit list of submission types the submission API accepts, the beta API base URL. What is verified comes from SEC documents on www.sec.gov (API overview PDF, Filer Manual, adopting release). Whether Form D goes through the submission API is a strong inference from two SEC sources, not a quoted statement (see "Can Form D go through the submission API").
2. **No NASAA page was read.** `www.nasaa.org`, `www.nasaaefd.org`, `nasaaefd.org` are outside the allowed network. No per-state fee table is given here: none could be read from the primary source, and one written from memory would be wrong somewhere. The official matrix exists at a known address; fetching it is the first task of the blue sky plan.
3. **The CFR text of Rule 503 was not read** (ecfr.gov, govinfo.gov, federalregister.gov, law.cornell.edu all unreachable). The amendment rules below are quoted from two SEC documents that restate Rule 503: the Form D General Instructions (inside the official Form D PDF) and the SEC's Form D FAQ (reviewed July 9, 2026).
4. **D-02's "pre-filled Form ID ready to notarize" cannot be built as worded.** The SEC accepts Form ID only when completed online on its dashboard, and the notarized document must be the printout of that online form. The portal can prepare every answer and track the steps; it cannot produce the document that gets notarized. Details under "EDGAR access onboarding".
5. **The EDGAR API needs two people and a monthly manual step.** A filer that connects to the APIs must have at least two technical administrators; the SEC considered and declined an exception for single-member companies. The user API token expires every 30 days and can only be created by a person signing in to the SEC dashboard. Details under "EDGAR Next".
6. **No published prices of comparable filing services were found** (one filing agent found quotes on request only). No comparison is offered.

Hosts to allow for a follow-up pass: `api.edgarfiling.sec.gov`, `api-bravo.edgarfiling.sec.gov`, `www.filermanagement.edgarfiling.sec.gov`, `www.nasaa.org`, `www.nasaaefd.org`, `www.ecfr.gov`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: a new console tab "Filings" holding everything below; all optional (sponsors can still file themselves).
- D-02: Form D filed by the portal through the SEC's EDGAR APIs (EDGAR Next), Carrow & Vale as filing agent. $100 per Form D including EDGAR access setup for new issuers (pre-filled Form ID ready to notarize, a guide for login.gov and naming Carrow & Vale as filing agent, progress tracking). Form D amendments $50.
- D-03: blue sky notice filings done by Carrow & Vale: the portal collects the sponsor's information and each state's fee; $100 per filing covering any number of states; renewals $50; state fees passed through at cost. NASAA EFD has no known public API: research it.
- D-04: reminders when filings are due (first Form D within 15 days of first sale, annual amendment, state deadlines and renewals); the sponsor can silence reminders.
- D-05: payments for these services depend on the payments provider chosen in phase 08; until then the portal records the order and the amount due.
- Carried: white label; lean screens; .planning/AUTOPILOT.md conditions. Filing itself needs Carrow & Vale's EDGAR filing-agent access (the owner is applying); build and test against the SEC's test/beta environment or recorded fixtures, never a live filing.

### Claude's Discretion
CONTEXT.md has no such section. Everything not fixed above (data model, module layout, plan split, where reminders show) is recommended below.

### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md has no such section. Out of scope by the decisions themselves: taking payment (D-05), any live filing, the in-house reader (D-33 in AUTOPILOT.md).
</user_constraints>

## Summary

Form D is fully specified and fully testable today. The SEC publishes the Form D XML schema (three XSD files), two sample submissions and a technical specification; all were downloaded and read this session. Twelve real Form D and D/A filings pulled from EDGAR today validate against that schema with `xmllint`, as do the SEC's two samples. So the builder (form pre-filled from the offering, validation, XML generation) can be built and proven against the official schema and real filings with no EDGAR access at all.

Filing is where the constraints are. EDGAR Next requires: an EDGAR account for the issuer (Form ID, completed on the SEC dashboard, signed and notarized), an EDGAR account for Carrow & Vale as filing agent (its own Form ID), delegation from the issuer to Carrow & Vale, and, for the API, two technical administrators at Carrow & Vale plus a user API token that a person renews on the SEC dashboard every 30 days. The same XML file the portal builds can also be sent by a Carrow & Vale person through "Transmit XML Submission" on the EDGAR Online Forms site, which needs no API and no technical administrators. Both routes end in the same accession number.

Blue sky is manual by design (D-03) and stays manual: nothing found suggests NASAA EFD has an API, and its terms of use were not read, so nothing should automate it. The portal's job is the states picker, the fee total, the package staff type into EFD, the order record and the reminders. The state fee table has to be transcribed from NASAA's official matrix PDF, which must be fetched first.

**Primary recommendation:** Build the Form D builder, due-date engine, Filings tab and order records now, all proven against the SEC schema and real filings. Put EDGAR behind one interface with three transports (recorded double, staff transmit, API) and build the API transport last, after the toolkit has been read and the owner's access exists.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filings tab, reminders, silencing | Browser (console) | - | Must work in the owner's iPhone frame with no server (AUTOPILOT.md); due dates are pure date math over data the workspace already holds |
| Form D draft, pre-fill, validation, XML text | Browser (shared pure module) | Server (re-validates before sending) | Sponsor edits and reviews offline; server never trusts browser XML |
| Issuer CCC, Carrow & Vale API tokens | Server only (sealed) | - | Secrets. The CCC travels inside the submission XML, so the server inserts it; it never reaches the browser |
| Transmitting to EDGAR, status polling | Server | - | Needs the tokens; EDGAR hours and retries are server concerns |
| EDGAR access steps tracker, Form ID answer sheet | Browser | - | A checklist and a data sheet; no secrets |
| Blue sky states picker, fee total, package | Browser | Server (delivers package to staff) | Script-loaded fee table; staff do the EFD entry by hand |
| Orders with amount due | Browser record (`ws.filings.orders`) | Server (staff queue) | D-05: record only; provider comes from phase 08 |
| State fee table | Static data file (script) | - | No fetch in the preview frame |

## Standard Stack

No new library is needed, and none is recommended. [VERIFIED: codebase] The portal is plain browser scripts and a Node server with one dependency.

### Core
| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| SEC Form D XML schema files | file header "Version: X0808"; spec PDF "Version 13, March 2025" | The validation authority | Published by the SEC; EDGAR validates against them [VERIFIED: downloaded from sec.gov] |
| `xmllint` (libxml2) | 2.9.14 on this machine | Schema validation in checks | Already installed; no package [VERIFIED: `xmllint --version`] |
| Node | v22.23.4 | Server and checks | Already in use [VERIFIED: `node --version`] |
| `node:test` | built in | Server tests | `server/package.json` script is `node --test` [VERIFIED: server/package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `xmllint` in checks | An XSD validator from npm | Adds a dependency for something the gate machine already has. Not recommended. |
| Hand-written XML text | An XML builder library | Form D is about 60 fixed elements in a fixed order with no attributes and no namespace; escaping five characters is the only XML subtlety. A library adds weight and must also ship to the browser. Not recommended. |
| In-house filing | An outside filing agent | Found one (Newsfile) with no published price; no measured comparison possible [search result, unverified]. The owner has decided in-house (D-02). |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. Nothing to audit. If a plan later proposes one, it must run `gsd-tools query package-legitimacy check` first.

## Form D: what the SEC requires

Sources: the official form and instructions (`https://www.sec.gov/files/formd.pdf`, OMB 3235-0076, expires July 31, 2027) and the SEC's Form D FAQ (`https://www.sec.gov/about/divisions-offices/division-corporation-finance/frequently-asked-questions-answers-form-d`, reviewed July 9, 2026). Both read this session.

### Deadlines and amendment rules
- File a new notice no later than 15 calendar days after the date of first sale. The date of first sale is the date the first investor is irrevocably contractually committed to invest. A notice may be filed before any sale. [VERIFIED: formd.pdf General Instructions; Form D FAQ]
- If a due date falls on a Saturday, Sunday or holiday, the due date is the first business day following. [VERIFIED: formd.pdf]
- A mandatory capital commitment call is not a new offering; no new Form D. [VERIFIED: formd.pdf]
- No federal filing fee. Paper filings are not accepted. [VERIFIED: Form D FAQ]
- Late filing does not by itself lose the exemption; the SEC says to file as soon as practicable. [VERIFIED: Form D FAQ]
- A Form D generally cannot be withdrawn and cannot be confidential. [VERIFIED: Form D FAQ]
- An amendment must carry current information for every item, whatever the reason for it. [VERIFIED: formd.pdf]

Amendment is required (quoted from the Form D General Instructions):

DATA_k7Qm2xLp_START
An issuer must file an amendment to a previously filed notice for an offering: to correct a material mistake of fact or error in the previously filed notice, as soon as practicable after discovery of the mistake or error; to reflect a change in the information provided in the previously filed notice, except as provided below, as soon as practicable after the change; and annually, on or before the first anniversary of the most recent previously filed notice, if the offering is continuing at that time.
DATA_k7Qm2xLp_END

Amendment is not required for a change after the offering terminates, or a change solely in (same source):

| Change | Not required when |
|--------|-------------------|
| Related person's address or relationship (Item 3) | always |
| Issuer's revenues or aggregate net asset value | always |
| Minimum investment | an increase, or cumulative decrease since the last notice of not more than 10% |
| Any address or state of solicitation in Item 12 | always |
| Total offering amount | a decrease, or cumulative increase of not more than 10% |
| Amount sold or amount remaining | always |
| Number of non-accredited investors | as long as it does not go above 35 |
| Total number of investors | always |
| Sales commissions, finders' fees, use of proceeds to officers/directors/promoters | a decrease, or cumulative increase of not more than 10% |

The annual clock runs from the most recent filed notice, D or D/A, not from the original. [VERIFIED: formd.pdf]

### The items
[VERIFIED: formd.pdf, pages 1-12, item list and instructions read]

| Item | Content |
|------|---------|
| 1 | Issuer's identity: name, previous names (past five years), jurisdiction, entity type, year of organization (within five years: give year; over five years; yet to be formed) |
| 2 | Principal place of business (street address; no P.O. box, no "in care of") and phone |
| 3 | Related persons: each executive officer, director, person with similar functions (general and managing partners, managing members) and each promoter; name, address, relationship(s), optional clarification |
| 4 | Industry group (one) |
| 5 | Issuer size: revenue range, or aggregate net asset value range for hedge and other investment funds |
| 6 | Federal exemptions and exclusions claimed |
| 7 | New notice or amendment; date of first sale or "yet to occur" |
| 8 | Offering to last more than one year? |
| 9 | Types of securities offered |
| 10 | Business combination transaction? |
| 11 | Minimum investment accepted from any outside investor (0 if none) |
| 12 | Sales compensation: each recipient, CRD numbers, broker-dealer, address, states of solicitation |
| 13 | Total offering amount (or Indefinite), total sold, total remaining. Amounts include future payments under mandatory capital commitments |
| 14 | May non-accredited investors be sold to; number of them already invested; total investors already invested |
| 15 | Sales commissions and finders' fees (may be estimates) |
| 16 | Gross proceeds used for payments to executive officers, directors or promoters |
| Signature | Duly authorized person of each issuer; name, title, date; Terms of Submission (consent to service of process; certification of no Rule 506(d) disqualification) |

The signer must be a person duly authorized by the issuer (Rule 503(b)(2)); signatures must comply with Rule 302 of Regulation S-T. [VERIFIED: Form D FAQ] What Rule 302 requires of a typed signature (a signed authentication document kept by the issuer) was not read this session. [ASSUMED]

### The XML schema
Source: `https://www.sec.gov/files/edgar/filer-information/specifications/formdxmltechspec-81_d.zip`, linked from `https://www.sec.gov/submit-filings/technical-specifications` as "Form D Version 12, September 20, 2021". The PDF inside is titled "Version 13, March 2025". Contents: `formDSubmission.xsd.xml`, `formDStateCodes.xsd.xml`, `statesOfSolicitationCodes.xsd.xml`, `SampleFormD.xml`, `SampleFormD_A.xml`, a stylesheet, the specification PDF. [VERIFIED: downloaded and unzipped]

Pins (sha256) for the three schema files, to store beside them:
```
799c31edf928b32b7c1f1e3d96dff25ccf202c750e50da84939d91018758eb1b  formDSubmission.xsd.xml
272042a7b552bf203c15defc3d52cbf2f85985dcf227fece3faf1e03d46301af  formDStateCodes.xsd.xml
ca7d7903fa52ff78ea68a794a788851c73cdba1cf21a59afd4c5facf96c928e9  statesOfSolicitationCodes.xsd.xml
```

Document order, root `edgarSubmission`, no namespace [VERIFIED: formDSubmission.xsd.xml:651-666]:
`schemaVersion?`, `submissionType`, `testOrLive?`, `returnCopy?`, `contactData?`, `notificationAddressList?`, `primaryIssuer`, `issuerList?`, `relatedPersonsList`, `offeringData`.

`offeringData` order [VERIFIED: formDSubmission.xsd.xml:633-650]: `industryGroup`, `issuerSize`, `federalExemptionsExclusions`, `typeOfFiling`, `durationOfOffering`, `typesOfSecuritiesOffered`, `businessCombinationTransaction`, `minimumInvestmentAccepted`, `salesCompensationList`, `offeringSalesAmounts`, `investors`, `salesCommissionsFindersFees`, `useOfProceeds`, `signatureBlock`.

Enumerations, verbatim from the schema [VERIFIED: formDSubmission.xsd.xml, line ranges given]:

DATA_r4Vn8bTz_START
SUBMISSION_TYPE (67-71): pattern D|D/A
LIVE_OR_TEST_TYPE (372-376): pattern LIVE|TEST
ENTITY_TYPE_TYPE (72-81): Corporation; Limited Partnership; Limited Liability Company; General Partnership; Business Trust; Other
RELATIONSHIP_TYPE (92-98): Executive Officer; Director; Promoter
STANDARD_LIST (195-209): 04; 04.1; 04.2; 04.3; 05; 06; 06b; 06c; 46; 4a5; 3C
SECTION_3C_LIST (210-226): 3C.1; 3C.2; 3C.3; 3C.4; 3C.5; 3C.6; 3C.7; 3C.9; 3C.10; 3C.11; 3C.12; 3C.13; 3C.14
INVESTMENT_FUND_LIST (119-126): Hedge Fund; Private Equity Fund; Venture Capital Fund; Other Investment Fund
BANKING_FINANCIAL_INDUSTRY_LIST (109-118): Commercial Banking; Insurance; Investing; Investment Banking; Pooled Investment Fund; Other Banking and Financial Services
REAL_ESTATE_INDUSTRY_LIST (156-164): Commercial; Construction; REITS and Finance; Residential; Other Real Estate
ENERGY_INDUSTRY_LIST (132-141): Coal Mining; Electric Utilities; Energy Conservation; Environmental Services; Oil and Gas; Other Energy
HEALTH_CARE_INDUSTRY_LIST (142-150): Biotechnology; Health Insurance; Hospitals and Physicians; Pharmaceuticals; Other Health Care
TECHNOLOGY_INDUSTRY_LIST (175-181): Computers; Telecommunications; Other Technology
TRAVEL_INDUSTRY_LIST (182-189): Airlines and Airports; Lodging and Conventions; Tourism and Travel Services; Other Travel
Single-value lists (104-108, 127-131, 151-155, 165-174, 190-194): Agriculture; Business Services; Manufacturing; Retailing; Restaurants; Other
REVENUE_RANGE_TYPE (233-244): No Revenues; $1 - $1,000,000; $1,000,001 - $5,000,000; $5,000,001 - $25,000,000; $25,000,001 - $100,000,000; Over $100,000,000; Decline to Disclose; Not Applicable
AGGREGATE_NET_ASSET_VALUE_RANGE_TYPE (245-256): No Aggregate Net Asset Value; $1 - $5,000,000; $5,000,001 - $25,000,000; $25,000,001 - $50,000,000; $50,000,001 - $100,000,000; Over $100,000,000; Decline to Disclose; Not Applicable
STATE_SOLICITATION_CODE (statesOfSolicitationCodes.xsd.xml): AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR
DATA_r4Vn8bTz_END

The exemption codes are lower case in the schema (`06b`, `06c`, `4a5`). `tools/form_d_prospects.py` matches upper case (`'06B'`, `'06C'`) because EDGAR full-text search returns them that way [VERIFIED: tools/form_d_prospects.py:52]. Use the schema's spelling when writing XML. Real filings confirm it: `<item>06b</item>` [VERIFIED: a filing fetched from EDGAR today].

Lengths and patterns [VERIFIED: formDSubmission.xsd.xml, lines given]:

| Field | Rule | Lines |
|-------|------|-------|
| street1, street2 | 1 to 40 characters | 293-298 |
| city | 1 to 30 | 299-304 |
| zipCode | 1 to 10, pattern `[0-9A-Za-z #\-]*` | 275-281 |
| phone | 1 to 20 | 305-315 |
| entity names | 1 to 150 | 321-331 |
| person first, middle name | 1 to 150; last name 1 to 200 | 44-49, 38-43, 487-493 |
| clarification texts | up to 255 | 56-60 |
| signatureName | 1 to 30 | 21-28 |
| signatureTitle | 1 to 60 | 29-36 |
| contactName | 1 to 30; contactPhoneNumber 1 to 20 | 399-419 |
| notificationEmailAddress | up to 3 | 420-424 |
| money (POSITIVE_INTEGER_TYPE) | integer 0 to 999999999999 | 61-66 |
| AMOUNT_OR_INDEFINITE | `Indefinite` or digits, max 12 characters | 269-274 |
| cik | 1 to 10 digits | 332-343 |
| ccc | exactly 8 characters | 344-356 |
| CRD number | `None` or digits, max 9 | 257-262 |
| previousAccessionNumber | `[0-9]{1,10}\-[0-9]{1,2}\-[0-9]{1,6}` or empty | 288-292 |
| relatedPersonInfo | 1 to 100 entries | 502-507 |
| relationship | 1 to 3 per person | 437-441 |
| recipient (sales compensation) | 0 to 100 | 578-583 |
| federal exemption `item` | 1 to 21 | 514-518 |
| signature | 1 to 101 | 627-632 |
| additional issuers | up to 99 | 474-479 |

Rules the schema does not enforce but EDGAR does (specification sections 3.3, 5 and 6) [VERIFIED: spec PDF read]:
- Send the CIK and CCC. Do not send `entityName`, `jurisdictionOfInc`, `edgarPreviousNameList` or `schemaVersion`: EDGAR fills them from its records, and warns or discards if sent.
- `contactData` is optional in the schema but required for processing; missing it suspends the filing.
- `yearOfInc/value` is required when `withinFiveYears` is chosen.
- If `isPooledInvestmentFundType` is true, `investmentFundInfo` is required.
- `aggregateNetAssetValueRange` is required for "Hedge Fund" or "Other Investment Fund"; otherwise `revenueRange`.
- `entityTypeOtherDesc` is required when the entity type is "Other"; a description is required when "Other" securities type is chosen.
- `totalRemaining` must equal `totalOfferingAmount` minus `totalAmountSold`.
- Previous names: give them or the value `None`.
- A D must not carry an accession number; a D/A must carry `isAmendment` true and `previousAccessionNumber`.
- Not both `06b` and `06c` in one submission (suspended).
- No P.O. box as principal place of business (suspended).
- A sales compensation recipient, if present, needs every child filled except street2.
- The issuer name in the signature block must match EDGAR's record; no future signature date; no whitespace-only required field.
- Warnings, not suspensions: more than 35 non-accredited under 506(b); offering amount 0; a 3(c) exclusion without pooled investment fund interests; Rule 504 over $10 million.
- File rules: name ends `.xml`; not compressed; `<?xml version="1.0"?>` optional but must be the very first bytes if present; each tag, value and end tag on one line; one primary document; whole-dollar amounts; a stylesheet reference suspends the filing (stated in the SEC's sample file); a single-line file is discouraged.
- The spec lists these errors as "not an all-inclusive list". A test submission is the only complete check.

### Real filings as fixtures
Fourteen entries from EDGAR's current Form D list were fetched today; two were other form types caught by the list's prefix match and returned 404. The remaining twelve (six D, six D/A, from several filing agents) all validate against `formDSubmission.xsd.xml` with `xmllint --noout --schema`; so do both SEC samples. [VERIFIED: run this session, 12 of 12 and 2 of 2]

Things real filings show [VERIFIED: files read]:
- The public copy has no `ccc` and no `contactData`, and carries `schemaVersion` (value `X0708` in the files fetched, while the downloaded schema file says `X0808`).
- Empty lists appear as empty elements: `<salesCompensationList></salesCompensationList>`, `<clarificationOfResponse></clarificationOfResponse>`.
- Address: `GET https://www.sec.gov/Archives/edgar/data/{cik}/{accession without dashes}/primary_doc.xml`, the same address `tools/form_d_prospects.py` uses [VERIFIED: tools/form_d_prospects.py:38].
- sec.gov was fetched with User-Agent "SubDocResearch research-bot@example.org" at under 3 requests a second with no refusals.

Real filings name real people and their addresses. They are public records, but AUTOPILOT.md says never to commit personal data. **Commit the two SEC samples as they are, and real filings only after a script replaces names, street lines, phone numbers and CIKs with placeholders of the same shape; the check confirms each masked file still validates.**

## What the portal already holds for Form D

The offering record has a little of what Form D needs. Most of the issuer identity is not held anywhere and must be asked once per offering.

| Form D field | In the portal today | Where |
|--------------|--------------------|-------|
| Issuer name | `offering.name` (EDGAR uses its own record of the name anyway) | console.js:657 |
| Exemption | `offering.structure.exemption`, free text; `NS.eligibility.regime(o)` returns `'506c'` or `'506b'` | eligibility.js:21-25 |
| Entity type, jurisdiction | `structure.vehicle`, `structure.domicile`, free text from the documents: a suggestion only | console.js:2539-2540 |
| Related persons | `structure.gp`, `structure.manager`, free-text entity names: a starting hint only | console.js:2543-2544 |
| Minimum investment | `offering.minimum` | console.js:663 |
| Total offering amount | `structure.hardCap` or `structure.targetSize`; else Indefinite | console.js:2532-2533 |
| Amount sold | Sum of accepted subscriptions. For a drawdown fund use `commitment`, not `amount` (the called part): Form D counts future payments under mandatory commitments | operations.js:287-288 |
| Total investors | Distinct investors with a position in the offering | console.js:107-109 |
| Non-accredited count | `NS.eligibility.nonAccredited(ws, o)` (`accepted`, `pending`, `unanswered`) | eligibility.js:95-110 |
| Date of first sale | Earliest accepted subscription: `r.decided` is set when a request is approved; a position's `date` when it is funded or accepted | operations.js:255, 287-288 |
| Investor state (for blue sky) | `investor.address` is text ending "City, ST ZIP"; onboarding collects `st` separately and joins it; `splitAddress(a)` and `splitAddressFor(i)` exist (their bodies were not read: confirm they return the state) | onboarding.js:563, 40, 49 |
| Issuer street address, phone, year formed, previous names | Not held | ask |
| Industry group, issuer size, securities types, duration, business combination | Not held (type of offering gives a suggestion) | ask |
| Sales compensation, commissions, finders' fees, proceeds to insiders | Not held | ask |
| Signer name and title, issuer CIK | Not held | ask |
| Issuer CCC | Not held, and must never be in the browser | server |

[VERIFIED: each file read this session at the lines given; the EXEMPTIONS list is at console.js:441-450: `'Rule 506(b)'`, `'Rule 506(c)'`, `'Regulation A Tier 1'`, `'Regulation A Tier 2'`, `'Regulation A Tier 2, exchange-listed'`, `'Regulation Crowdfunding'`, `'Regulation S'`, `'Section 4(a)(2)'`]

Only Rule 506(b) and Rule 506(c) offerings (and Rule 504, Section 4(a)(5), which the portal's list does not offer) file Form D. The Form D service should be offered only when `regime(o)` is `'506b'` or `'506c'`.

Every pre-filled value is a suggestion the sponsor confirms. The date of first sale in particular is a legal judgment (irrevocable commitment); the portal proposes the earliest acceptance date and the sponsor confirms or changes it.

Amounts are whole US dollars. An offering in another currency needs the sponsor's dollar figure; `FX_USD` in structures.js is described there as reference rates for summary screens only and must not be used for a filing [VERIFIED: structures.js:24-29].

## EDGAR Next: access, roles, delegation, tokens

Sources read this session: EDGAR Filer Manual Volume I (effective March 16, 2026); SEC "How Do I" guides (Form ID, roles, delegation, API tokens, Login.gov, annual confirmation); Overview of EDGAR APIs (EDGAR Business Office, December 22, 2025); adopting release 33-11313; EDGAR Next FAQ; EDGAR Beta page.

### Getting an EDGAR account (Form ID)
- Every new filer applies on Form ID. It is completed online on the EDGAR Filer Management dashboard; paper is not accepted. The dashboard is open 6 a.m. to 10 p.m. ET, Monday to Friday, except federal holidays. [VERIFIED: Form ID guide]
- Whoever fills it in signs in with their own Login.gov credentials. A person authorized by the applicant may complete and submit it on the applicant's behalf. [VERIFIED: Form ID guide]
- Six parts: 1 applicant type and name; 2 company information (tax ID or 00-0000000, optional LEI, fiscal year end, good standing, single-member company yes/no); 3 prospective account administrators (full legal names, emails; employer and its CIK if not an employee of the applicant); 4 billing contact; 5 signature (name and specific title of the authorized individual; generic titles such as "officer" are rejected); 6 documents. [VERIFIED: Form ID guide; Filer Manual Vol. I section 3(b)]
- The authenticating document is the completed online Form ID, printed, signed by an authorized individual of the applicant, notarized (manual, electronic or remote online notarization accepted), saved as PDF and uploaded. The notary must not be one of the account administrators. File name: 32 characters or fewer, lower case, starts with a letter, no spaces. [VERIFIED: Form ID guide; Filer Manual Vol. I section 3(b)]
- A draft can be saved and downloaded as an `.eis` file and restored later, which is how the form waits while the printout is notarized. [VERIFIED: Form ID guide]
- SEC staff review takes "an average of two business days"; approval is not assured. [VERIFIED: Form ID guide, as of the page reviewed December 22, 2025]
- The applicant name is conformed by EDGAR (for example "Company" becomes "CO", "Limited" becomes "LTD" unless followed by "partnership"); a name matching an existing account suspends the application. [VERIFIED: Form ID guide] This matters for Form D: the signature block's issuer name must match EDGAR's version of the name.
- The complete field-by-field Form ID instructions are at `https://www.filermanagement.edgarfiling.sec.gov/assets/Form%20ID%20Instructions.pdf`, not reachable this session.

### Account administrators: one or two
- A company must authorize and keep at least two account administrators. An individual or a "single-member company" needs one. A single-member company has a single individual who is the sole equity holder, director and officer. Maximum 20. [VERIFIED: roles guide; Filer Manual Vol. I; release 33-11313]
- Most sponsors' fund entities (a limited partnership with a general partner and investors) are not single-member companies, so they need two account administrators. [ASSUMED: a legal reading; confirm per issuer]
- An account administrator who is not an employee of the applicant or its affiliate needs a notarized power of attorney from an authorized individual of the applicant, uploaded with Form ID. [VERIFIED: Filer Manual Vol. I section 3(b)] So Carrow & Vale staff can be an issuer's account administrators, with a notarized power of attorney.
- Each filer must confirm its account once a year on the dashboard (quarter-end date the filer picks); failing to do so loses access and means a new Form ID. [VERIFIED: annual confirmation guide; Filer Manual Vol. I section 3]

### Filing agent and delegation
- A filing agent is "any person or entity engaged in the business of making submissions on EDGAR on behalf of electronic filers". It applies on its own Form ID with applicant type filing agent and gets its own CIK. An applicant that files in two capacities submits one Form ID per capacity. [VERIFIED: applicant type guide; Form ID guide]
- Delegation: the issuer's account administrator, on the dashboard, adds a delegation to the filing agent's CIK; any account administrator of the filing agent accepts; the agent becomes the issuer's "delegated entity" and can file for it. The agent may instead send a delegation request that the issuer accepts. Either side can cancel at any time. The SEC says to delegate only where an agreement to file exists, and not to send unsolicited requests. [VERIFIED: delegation guide, updated March 4, 2026]
- The filing agent's account administrators become the issuer's delegated administrators and choose which of the agent's users may file for that issuer. [VERIFIED: roles guide]
- A filing agent, as a company, needs two account administrators unless it is a single-member company. [VERIFIED: roles guide]
- Legal exposure the agent shares: misstatements in a submission can violate 18 U.S.C. 1001; the SEC can block submissions or remove access for unauthorized submissions (Rule 15 of Regulation S-T). No Social Security numbers in any submission. [VERIFIED: Filer Manual Vol. I sections 1 and 7]

### The APIs
- Fourteen APIs: submission, submission status, EDGAR operational status, and eleven account-management APIs (add, remove, view individuals; change roles; send and request delegation invitations; view delegations; view filer account information; generate CCC; create custom CCC; verify filing credentials). All optional. [VERIFIED: API overview PDF]
- To connect, a filer must have at least two technical administrators, who create the filer API token on the dashboard. The SEC was asked to allow one for single-member companies and declined. [VERIFIED: release 33-11313, text at the two-technical-administrators discussion; roles guide] One person may be both account administrator and technical administrator, but two different people are still needed as technical administrators.
- Filer API token: valid one year; any number may exist at once. [VERIFIED: API tokens guide; Filer Manual Vol. I section 8(a)]
- User API token: valid 30 days; created only by the individual (an account administrator or user) on the dashboard; one active per person; creating a new one inactivates the old. It must be the token of the person acting; an organisation-wide user token was proposed to the SEC and declined. [VERIFIED: API tokens guide; EDGAR Next FAQ answer 11]
- Submission API needs both tokens; submission status and operational status need only the filer token. [VERIFIED: API tokens guide; API overview]
- A filing agent submitting for a client presents its own filer API token and the user token of its own delegated user or administrator; one filer token serves all its clients. [VERIFIED: Filer Manual Vol. I section 8]
- Submission API: POST; tokens in the header (both are JWE); optional login CIK in the header; the submission XML in the body. Success body: `"response": "submitted"` with an accession number. Failure: `"response": "rejected"` with messages. [VERIFIED: API overview, Figure B, read as an image]
- Submission status API: GET with the accession number in the path (`/status/{accession number}`); statuses shown: `accepted` (in progress), `disseminated` (complete), `suspended` (with messages of type error or warning, each with a code). Several accession numbers may be sent as a list. [VERIFIED: API overview, Figures C and D]
- Operational status API: GET `/status`; the overview's text lists "Accepting submissions", "Accepting submissions after hours", "Outside hours of operation", "No communication", while its figure shows `ACCEPTING SUBMISSIONS`, `NOT AVAILABLE`, `DOWN`. The two do not match; take the real strings from the toolkit. [VERIFIED: API overview, text and Figure E]
- EDGAR accepts submissions 6 a.m. to 10 p.m. ET on business days. [VERIFIED: Filer Manual Vol. I section 2]
- A submission made through the API goes through the same authentication and validation as one made on the websites. [VERIFIED: EDGAR Next filer testing guidance]
- Base URL `https://api.edgarfiling.sec.gov` and `Authorization` header with a `bearer ` prefix: seen only in a search engine's summary of the toolkit, not read. [CITED: api.edgarfiling.sec.gov/docs, through search summary] Exact paths, rate limits, error codes: not found. [no observation]

### Test environment
- EDGAR Beta is a separate environment that stays open indefinitely; API changes are previewed there; accounts, CIKs, roles and delegations created in Beta are fictitious and do not exist in live EDGAR; Login.gov credentials are shared between the two. Dashboard: `https://filermanagement-bravo.edgarfiling.sec.gov/`. All fourteen APIs are offered in Beta. [VERIFIED: EDGAR Beta page; filer testing guidance]
- Separately, live EDGAR accepts test submissions: `<testOrLive>TEST</testOrLive>` in the file, or "Transmit as a Test Submission" on the site; test submissions are validated and not published. A TEST tag wins even if the file is sent through the live link. [VERIFIED: Filer Manual Vol. II section 9.1]
- A search result showed `https://api-bravo.edgarfiling.sec.gov/` titled "EDGAR API Development Toolkit"; presumably the Beta API host. [ASSUMED]

### Can Form D go through the submission API
Not stated in anything read. The inference:
1. The SEC's adopting release says the submission API "will give filers the option to submit test and live filer-constructed EDGAR submissions", and that about 500 of 525 submission types permit filer construction. [VERIFIED: release 33-11313, section on the submission API and its footnote 146]
2. Form D is a filer-constructed type: its specification exists "for creating XML submissions without the use of the EDGAR OnlineForms/XML Website", and Filer Manual Volume II chapter 9 covers transmitting such files. [VERIFIED: Form D spec section 1.1; efmvol2-c9.pdf]
3. So a Form D XML file should be accepted by the submission API. [ASSUMED until the toolkit's list is read or a Beta test submission succeeds]

One caution: the overview's example body is an EDGARLink Online envelope (`cor:edgarSubmission`, `cor:liveTestFlag`), a different format from Form D's plain `edgarSubmission`. Whether the endpoint tells the two apart by content or needs a parameter is unknown.

**The route that is certain:** a Carrow & Vale person signs in to EDGAR Online Forms, chooses "Transmit XML Submission", picks test or live, and uploads the file the portal built. [VERIFIED: efmvol2-c9.pdf section 9.2] This needs delegation and a Login.gov sign-in, but no API tokens and no technical administrators.

## Blue sky: NASAA EFD and the states

Nothing in this section was read from NASAA. Tags say where each statement came from.

| Statement | Source | Tag |
|-----------|--------|-----|
| EFD's address is `https://nasaaefd.org`; EDGAR's acceptance emails for Form D point filers there for state filings | Filer Manual Vol. II, page 8-19 | [VERIFIED: efmvol2-c8.pdf] |
| Rule 506 offerings are not subject to state registration, but states may require a notice, a consent to service of process and a fee | SEC Form D FAQ | [VERIFIED] |
| Some states require a separate filing per issuer or security | Form D General Instructions | [VERIFIED] |
| Official fee matrix: `https://www.nasaa.org/wp-content/uploads/efd/Form-D-fees-matrix.pdf`. One search summary read its heading as "As of October 1, 2026", another as dated April 2025 | search summaries | [ASSUMED: read the file] |
| States page: `https://www.nasaaefd.org/About/FormDStates` | search result | [ASSUMED] |
| EFD charges a $160 system use fee on the initial notice for an offering; no further system fee to amend or renew | search summary of `nasaaefd.org/FAQ/answer?faq=4` | [ASSUMED] |
| EFD takes payment by ACH only | search summary of EFD's filer walkthrough, undated | [ASSUMED] |
| Each offering gets an EFD ID that follows it through amendments, renewals and terminations; a filing can be found by CIK, accession number or EFD number | search summaries | [ASSUMED] |
| Most states: notice due within 15 days of the first sale in that state | secondary sites | [ASSUMED] |
| Florida requires no Rule 506 notice and no fee | search summary of the matrix and a law site | [ASSUMED] |
| New York: $300 up to $500,000 offered, $1,200 above; its own EFD guidance at `ag.ny.gov/sites/default/files/regulatory-documents/part10-efd-formd-guidance.pdf` | search summaries | [ASSUMED] |
| California: a Form D naming several issuers cannot be filed through EFD | search summary of dfpi.ca.gov | [ASSUMED] |
| Fees are fixed in some states and vary with the amount offered or sold in others | search summary of the matrix | [ASSUMED] |
| Which states are on EFD today, late fees, renewal periods | not found | [no observation] |
| An EFD API or bulk upload | nothing found in any result | [no observation; absence is not proof] |
| EFD terms of use on automated access | not read | [no observation] |
| A machine-readable source of state fees | none found; the matrix is a PDF | [no observation] |

What follows for the design:
- **Manual entry by Carrow & Vale staff, as D-03 says. Build no automation against EFD** (no scripted browser, no scraping): its terms were not read.
- **A maintained table, one row per jurisdiction, each row with its source address and the date it was read.** The check fails if any row lacks a source or date, and the screen shows "fees as of <date>" beside the total.
- **Order of work for staff:** the SEC filing comes first; EFD works from the filed Form D. So a blue sky order depends on an accepted Form D (the portal's or the sponsor's own; record the accession number either way).
- The $160 EFD system fee is a real third-party cost D-03 does not mention. Show it as its own pass-through line; the owner decides whether to pass it on or absorb it.
- Variable-fee states need the offering amount or the amount sold in that state. The portal has the amount sold per investor state; the formula per state comes from the matrix.

## Architecture Patterns

### How the console is built (so the Filings tab fits)
[VERIFIED: files read this session]

- The menu is the `NAV` array in console.js:37-56, entries such as `['console-reports', 'Reports']`, grouped by `NAV_SECTIONS` (console.js:58-64): `''`, `'Raise'`, `'Operate'`, `'Report'`, `'Settings'`. An entry shows only when `NS.views[key]` exists and `NS.app.allowed(key)` is true (console.js:85). A key missing from the sections falls under the last one (console.js:65).
- A page is `NS.views['console-x'] = { mode: 'console', edition?: 'diy', render() { return CK().shell(html, 'console-x') } }`. Pages in other files use `NS.consoleKit = { shell, head, panel, audit, short }` (console.js:101). The pattern to copy is the notifications page (invitations.js:2324-2341), which is registered only `if (E.diy)`.
- Routing is by hash; `parseHash` gives an exact page name priority, then prefixes in `PREFIXED` (app.js:357-372). A per-offering filings page would need a `['console-filings-', 'console-filings']`-style entry there; a single page with in-page state avoids touching app.js.
- Owner-only pages are listed in `OWNER_ONLY = ['console-brand', 'console-intake', 'console-integrations', 'console-team']` (app.js:427). Roles: `can('configure')` is the owner role, `can('operate')` the team (app.js:419-425).
- Menu counts: `NS.navCounts[key] = (ws) => n` (console.js:66-72).
- Overview "Needs attention": `NS.hooks.consoleAttention.push((ws) => '<li>…</li>')` (app.js:204; used at console.js:258; example at integrations.js:1310-1325).
- Actions: `NS.actions['name'] = (el, e) => {…}` bound through `data-action` (app.js:582).
- Workspace data: one JSON object per client in localStorage, saved with `NS.app.save` / `NS.workspace.save` (workspace.js). Other modules add their own keys lazily (`ws.invitations = ws.invitations || []`, invitations.js:70-71) or in `NS.ops.ensure(ws)` (workspace.js load).
- Change log: `NS.audit.log(ws, { action, detail, fund, record })` (console.js:25).
- Notifications: `ws.notifications`, written by `notify(ws, kind, title, detail, route)` (invitations.js:306-313); the route must match `/^console[\w-]*$/` (invitations.js:305). The bell and the Notifications page are self-serve edition only (invitations.js:2267, 2324). "Notices" (`console-notices`) are messages to investors, a different thing.
- Server calls from the browser: `api(ws, method, path, body)` with a bearer token (integrations.js:294-302).
- Three page shells list every script by hand: `index.html`, `diy.html`, `portal.html`. A new script must be added to all three.
- Data that must work with no server is shipped as a script (`assets/forms/forms-data.js`, checked by `checks/embed-data.js`).

### Recommended structure
```
assets/js/
├── filings-data.js     # script-loaded data: Form D choice lists, state table (source + date per row), holiday rule
├── filings.js          # NS.filings: record shape, due dates, reminders, silencing, order math (pure)
├── formd.js            # NS.formD: prefill(ws, offering), validate(draft), toXml(draft, opts), fromXml(text) (pure)
└── filings-ui.js       # NS.views['console-filings'], actions, nav count, attention hook
server/
├── lib/filings.mjs     # createFilings({ store, vault, env, edgar, mail, now }): orders, CCC sealing, re-validation
├── filing/edgar.mjs    # the connector interface and its three transports
└── test/filings*.test.mjs, test/fixtures/formd/  # schema files with pins, SEC samples, masked real filings, recorded API replies
.planning/phases/09-…/checks/
├── filings-math.js     # due dates, amendment triggers, silencing, order totals (node, no browser)
├── formd-xml.js        # builder output and fixtures against the SEC schema with xmllint
└── filings-flow.js     # the tab in the sandboxed frame at 390x844 and 1280x800
```
`filings.js` and `formd.js` must run unchanged in the browser and in Node (the existing checks load browser scripts into a `vm`; see `checks/embed-data.js`).

### System diagram
```
 Sponsor (console, Filings tab)
   │ offering data ──► formd.prefill ──► draft (sponsor confirms each item, signs off)
   │                                      │
   │                         formd.validate (schema rules + EDGAR rules)
   │                                      │ errors by item ──► back to the form
   │                                      ▼
   │                           order recorded: service, amount due, status
   │                                      │
   │   no server ──► stops here: order "recorded", XML and summary viewable in-page
   │                                      │ server
   ▼                                      ▼
 filings.due(ws, today) ──► reminders   Carrow & Vale server: filings.mjs
   (tab, menu count,                      │ re-validate; insert issuer CCC (sealed store)
    Needs attention)                      ▼
                                 edgar connector (one interface)
                    ┌─────────────────────┼──────────────────────┐
              fixture transport      staff transport         api transport
              (recorded replies;     (file handed to a       (tokens; POST; poll
               all tests)             person who transmits     status)
                                      on EDGAR Online Forms;
                                      they enter the result)
                    └─────────────────────┼──────────────────────┘
                                          ▼
                       TEST submission first ──► suspended? ──► messages to staff, fix, repeat
                                          │ accepted
                                          ▼
                       LIVE submission ──► accession number ──► filing record: filed date,
                                          next annual amendment date, blue sky may start

 Blue sky: states picker (from investors' states) ──► fees from the table ──► order
           ──► package for staff ──► staff enter it on EFD by hand ──► staff record EFD ID,
           date and fee paid per state ──► state reminders (renewals)
```

### Pattern 1: one record, computed reminders
**What:** store facts (what was filed, when, where); compute every due date from them on each render. Store only the sponsor's silencing choices.
**Why:** a stored reminder goes stale the moment a date changes; a computed one cannot.

```js
// ws.filings, created lazily the way invitations.js creates ws.invitations
ws.filings = {
  v: 1,
  offerings: {                       // by offering id
    'off-id': {
      mode: 'portal' | 'self' | 'none',      // 'self': the sponsor files; reminders still run. 'none': not applicable; no reminders
      firstSale: '2026-11-02' | '',          // confirmed by the sponsor; '' means use the computed suggestion
      ended: '' | '2027-03-31',              // offering terminated: annual amendments stop
      edgar: { cik: '', steps: { /* step key: { done, at } */ } },
      formD: [ { id, type: 'D' | 'D/A', status, draft, filedOn, accession, snapshot } ],
      states: { NY: { status, filedOn, efdId, feeCents, renewsOn } }
    }
  },
  orders: [ { id, kind, offeringId, lines: [ { label, cents, passThrough } ], dueCents, status, at, by } ],
  silenced: { 'formd-first:off-id': { at, by }, 'state:off-id:NY': { at, by } }
};
```
`status` for a Form D: `draft`, `ordered`, `in_review`, `test_passed`, `submitted`, `accepted`, `suspended`. For an order: `recorded`, `received`, `done`, `cancelled`. `kind`: `formd`, `formd-amendment`, `bluesky`, `bluesky-renewal`. Money in cents, like `r.cents` on requests.

The CCC, tokens and anything else secret are absent from this shape on purpose.

### Pattern 2: due dates as pure functions
```js
// NS.filings.due(ws, today) → [{ key, kind, offeringId, state?, due, basis, level: 'soon' | 'due' | 'overdue', silenced }]
// formd-first:   firstSale + 15 calendar days, moved to the next business day if it lands on a weekend or holiday
// formd-annual:  latest accepted D or D/A filedOn + 1 year, same roll; only while the offering has not ended
// formd-change:  current data differs from the last filed snapshot beyond the exceptions in the Form D instructions
// state-first:   first sale to an investor in that state + the state's days from the table
// state-renewal: the state's renewsOn
```
A silenced reminder is left out of the menu count and the overview, and stays visible in the tab, greyed, with a way to turn it back on. Silencing never changes a due date.

The holiday roll needs the federal holiday calendar (the rule for each holiday and its observed day). The list was not fetched. [ASSUMED: implement the eleven federal holidays from 5 U.S.C. 6103 and have the check compare several years against a published calendar]

### Pattern 3: the amendment test
`formd-change` compares the last filed snapshot with today's data, field by field, using the exceptions table above. Examples for the check, straight from the instructions: minimum investment down 8% needs none, down 12% needs one; offering amount up 10% needs none, up 11% needs one; non-accredited count 34 to 35 needs none, 35 to 36 needs one; amount sold changing needs none; a new related person needs one; a related person's address changing needs none. The 10% tests are cumulative since the last filed notice, which is exactly what comparing against the snapshot gives.

### Pattern 4: the EDGAR connector
```js
// server/filing/edgar.mjs
// transport: { name, submit({ xml, mode: 'TEST' | 'LIVE', filerCik }) → { ok, accession?, messages? },
//              status({ accession }) → { status: 'accepted' | 'disseminated' | 'suspended', messages? },
//              operational() → { open: boolean, raw } }
export function makeEdgar({ transport, now }) { /* TEST before LIVE; never LIVE unless explicitly allowed */ }
```
- `fixture`: answers from recorded files in `server/test/fixtures/edgar/`. The only transport tests use. The reply shapes come from the SEC overview's figures until real ones are recorded in Beta.
- `staff`: `submit` stores the file and returns `{ ok: true, pending: 'staff' }`; a staff person downloads it, transmits it on EDGAR Online Forms and enters the accession number and outcome. This is the transport that works on the day access is granted.
- `api`: built last. Base URL, paths and header format come from environment settings, not constants, because they were not verified. Tokens from the environment, never from a request.
- A guard, covered by a test: `LIVE` is refused unless `EDGAR_ALLOW_LIVE=1` is set, and refused always under `NODE_ENV=test`. This is how "never a live filing" (CONTEXT.md) is enforced in code, not by care.
- The server follows the existing shape: `createServer({ env, store, fetch, providers, now, … })` with `fetch` injectable, `mockFetch(routes)` recording every outbound call (server/test/helpers.mjs). The store's top-level keys today are `{ verifications: {}, screenings: {}, invitations: {}, outbox: {}, events: [], seen: [] }` (server/lib/store.mjs:10); add `filings: {}`. Seal the CCC with the vault exactly as invitations do: `vault.seal(value, `${rec.id}:${field}`)` (server/lib/invitations.mjs:516).

### Pattern 5: the Form D builder
- `prefill(ws, offering)` returns a draft with every value it can suggest and, per field, where it came from, so the screen can say "from the offering" or "please enter".
- `validate(draft)` returns `[{ item, field, level: 'error' | 'warning', message }]`. Two layers: the schema's rules (one table generated by hand from the XSD, lengths and choice lists as quoted above) and EDGAR's rules (the list above). Messages are in plain words and say which item.
- `toXml(draft, { mode, ccc })` writes elements in schema order, one per line, indented, escaping `& < > " '`, omitting `schemaVersion`, `entityName`, `jurisdictionOfInc`, `edgarPreviousNameList`. In the browser it is called without a CCC (for review). The server calls it with the CCC.
- `fromXml(text)` reads a filed Form D back into a draft: it makes round-trip tests on real filings possible, and lets a sponsor who filed elsewhere start an amendment from their last filing's public copy.
- The check proves the hand-made rule table against the real schema: for each generated case, `validate` says valid if and only if `xmllint` says valid.

### EDGAR access onboarding
What the portal can do, given the SEC's rules:
- A steps tracker per issuer: (1) each person creates Login.gov credentials with the email they will use for EDGAR; (2) Form ID completed on the SEC dashboard; (3) printout signed and notarized; (4) PDF uploaded and submitted; (5) SEC grants it and sends the CIK; (6) delegation to Carrow & Vale's CIK added and accepted; (7) ready. Each step: done or not, date, a short how-to. An issuer that already has a CIK starts at 6.
- A Form ID answer sheet: every answer for parts 1 to 5 laid out in the dashboard's order from data the portal holds or asks for, with copy buttons, shown in-page. It includes the name-conformance warning and the file-name rule for the PDF.
- Who types it into the dashboard: either the sponsor, or a Carrow & Vale person on the sponsor's behalf (the SEC allows an authorized person to complete and submit it). In the second case Carrow & Vale saves the draft, sends the sponsor the printout to sign before a notary, and uploads the notarized PDF.
- A power of attorney template when Carrow & Vale staff are to be the issuer's account administrators. Its wording needs a lawyer; the portal can only merge names into approved text. [ASSUMED: wording]
- What the portal cannot do: produce the Form ID that gets notarized, submit Form ID, or create anyone's Login.gov account.

### Blue sky order flow
1. States picker, pre-ticked from the states of investors with accepted subscriptions in the offering, plus any the sponsor adds; states that need no filing shown as such.
2. Fees: each state's fee from the table (variable ones computed from the amount the table says), the EFD system fee as its own line, the service fee ($100, or $50 for a renewal). Total and "fees as of <date>".
3. Order recorded with every line and the amount due.
4. Package for staff: issuer, Form D accession number, per-state first sale date and amount sold, fee per state, contact. In-page view; also delivered to the server when there is one.
5. Staff file on EFD by hand, then record per state: date, EFD ID, fee actually paid. A difference between the quoted and paid fee is shown, not hidden.
6. Renewal dates from the table feed the reminders.

### Where Carrow & Vale staff work
The self-serve edition has no Carrow & Vale role (`roles: ['admin', 'team', 'investor']`, edition.js) and the integration server is described as one a sponsor points their portal at (server/README.md). Carrow & Vale's tokens and the issuers' CCCs must sit only on a server Carrow & Vale runs. **The filings module is switched on by an environment setting on Carrow & Vale's own server; staff see orders through token-protected calls (`GET /v1/filings/orders`, `POST /v1/filings/orders/:id`) and an email of each order through the existing mail module.** A staff screen is a later decision; see Open Questions.

### Anti-Patterns to Avoid
- **Storing due dates:** they drift. Compute them.
- **The CCC or any token in the browser, localStorage or the repository:** the CCC is the issuer's filing password.
- **Trusting browser-built XML on the server:** rebuild it from the draft on the server.
- **Hard-coding unverified API paths:** settings, until the toolkit is read.
- **A `fetch` on the tab's no-server path:** the preview frame refuses it (AUTOPILOT.md).
- **Opening a PDF in the browser's viewer or a new window for review:** render the review in-page.
- **Automating EFD.**
- **Vendor or system names on sponsor screens:** "EDGAR", "SEC", "Form D", "Form ID", "Login.gov" are the government's own names and are needed; no library, model or tool name, and never the word "basic" (AUTOPILOT.md).
- **Touching the managed edition:** register the page for the self-serve edition only unless a plan says otherwise.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding whether XML is valid Form D | Your own judgment of the schema | The SEC's XSD files through `xmllint` in the check; the hand table is tested against it | The XSD is what EDGAR runs |
| The full set of EDGAR rules | A guess at "all" business rules | A TEST submission before every LIVE one | The SEC says its error list is not complete |
| Encryption of the CCC | New crypto | `server/lib/vault.mjs` (AES-256-GCM, already used for invitations) | Exists and is tested |
| Outbound call recording in tests | A new mock | `mockFetch` in server/test/helpers.mjs | Exists |
| Console page chrome | New layout code | `NS.consoleKit` | Every other page uses it |
| State fees | Numbers from memory or blogs | NASAA's matrix, transcribed with source and date | Fees change; a wrong fee is the sponsor's money |
| Investor state | A new address parser | `splitAddress` in onboarding.js | Exists |

**Key insight:** the two things that look hard here (XML and validation) are easy and fully specified; the things that look easy (who may file, with which token, which fee) are where a wrong assumption costs a real filing or real money.

## Common Pitfalls

### Pitfall 1: sending fields EDGAR owns
**What goes wrong:** including `entityName`, `jurisdictionOfInc` or `schemaVersion` draws warnings; real public filings contain them because EDGAR adds them.
**How to avoid:** `toXml` omits them; `fromXml` tolerates them. Check: builder output never contains those tags.

### Pitfall 2: the public copy is not the submitted copy
**What goes wrong:** using a public filing as a template drops `contactData` and `ccc`, and the filing is suspended.
**How to avoid:** the check asserts `contactData` is present and, on the server path, a `ccc` of 8 characters.

### Pitfall 3: issuer name mismatch
**What goes wrong:** the signature block's issuer name differs from EDGAR's conformed name; suspended.
**How to avoid:** store the name exactly as EDGAR shows it once the CIK exists, and use that in the signature block.

### Pitfall 4: sold amount from called capital
**What goes wrong:** a drawdown fund's `amount` is what has been called; Form D wants commitments.
**How to avoid:** use `commitment` where present. Check with a drawdown fixture.

### Pitfall 5: both 506(b) and 506(c)
**What goes wrong:** suspended. The portal's exemption field is free text and could mention both.
**How to avoid:** exactly one of `06b`, `06c`, chosen by the sponsor.

### Pitfall 6: whitespace inside values
**What goes wrong:** a value on its own line counts the line breaks toward its length.
**How to avoid:** tag, value and end tag on one line; trim values.

### Pitfall 7: the annual date
**What goes wrong:** counting the year from the original Form D after an amendment has been filed.
**How to avoid:** latest accepted D or D/A.

### Pitfall 8: the 30-day token
**What goes wrong:** a filing due today and the user token expired yesterday.
**How to avoid:** the server reports token expiry; staff are warned a week ahead; the staff transport is always available as the fallback.

### Pitfall 9: EDGAR hours
**What goes wrong:** a submission at 10:30 p.m. ET or on a holiday is not processed.
**How to avoid:** check the time (and the operational status when the API is used) before sending; tell staff the next opening.

### Pitfall 10: three page shells
**What goes wrong:** a script added to `diy.html` only; the published page (`portal.html`) lacks the tab.
**How to avoid:** the flow check loads the published page name.

### Pitfall 11: a fee table that looks official
**What goes wrong:** a number with no source gets shown to a sponsor as the state's fee.
**How to avoid:** every row carries its source and date; the screen shows the date; the check fails on a row without them.

### Pitfall 12: reminders for sponsors who do not want them
**What goes wrong:** every 506 offering nags from day one.
**How to avoid:** nothing shows until a first sale exists or the sponsor opens the tab for that offering; silence is one tap and per reminder or per offering (D-04, and nothing mandatory).

## Code Examples

### A minimal new notice, as the builder should emit it
Shaped from the SEC's own sample (`SampleFormD.xml`) and a real filing; values invented. `ccc` is inserted on the server only.
```xml
<?xml version="1.0"?>
<edgarSubmission>
    <submissionType>D</submissionType>
    <testOrLive>TEST</testOrLive>
    <contactData>
        <contactName>Filing Desk</contactName>
        <contactPhoneNumber>212-555-0100</contactPhoneNumber>
        <contactEmailAddress>filings@example.com</contactEmailAddress>
    </contactData>
    <primaryIssuer>
        <cik>1234567890</cik>
        <ccc>abcd#123</ccc>
        <issuerAddress>
            <street1>100 Main Street</street1>
            <city>New York</city>
            <stateOrCountry>NY</stateOrCountry>
            <zipCode>10001</zipCode>
        </issuerAddress>
        <issuerPhoneNumber>212-555-0100</issuerPhoneNumber>
        <issuerPreviousNameList>
            <value>None</value>
        </issuerPreviousNameList>
        <entityType>Limited Partnership</entityType>
        <yearOfInc>
            <withinFiveYears>true</withinFiveYears>
            <value>2026</value>
        </yearOfInc>
    </primaryIssuer>
    <relatedPersonsList>
        <relatedPersonInfo>
            <relatedPersonName>
                <firstName>Jane</firstName>
                <lastName>Example</lastName>
            </relatedPersonName>
            <relatedPersonAddress>
                <street1>100 Main Street</street1>
                <city>New York</city>
                <stateOrCountry>NY</stateOrCountry>
                <zipCode>10001</zipCode>
            </relatedPersonAddress>
            <relatedPersonRelationshipList>
                <relationship>Executive Officer</relationship>
            </relatedPersonRelationshipList>
        </relatedPersonInfo>
    </relatedPersonsList>
    <offeringData>
        <industryGroup>
            <industryGroupType>Pooled Investment Fund</industryGroupType>
            <investmentFundInfo>
                <investmentFundType>Private Equity Fund</investmentFundType>
                <is40Act>false</is40Act>
            </investmentFundInfo>
        </industryGroup>
        <issuerSize>
            <revenueRange>Decline to Disclose</revenueRange>
        </issuerSize>
        <federalExemptionsExclusions>
            <item>06b</item>
            <item>3C</item>
            <item>3C.1</item>
        </federalExemptionsExclusions>
        <typeOfFiling>
            <newOrAmendment>
                <isAmendment>false</isAmendment>
            </newOrAmendment>
            <dateOfFirstSale>
                <value>2026-11-02</value>
            </dateOfFirstSale>
        </typeOfFiling>
        <durationOfOffering>
            <moreThanOneYear>true</moreThanOneYear>
        </durationOfOffering>
        <typesOfSecuritiesOffered>
            <isPooledInvestmentFundType>true</isPooledInvestmentFundType>
        </typesOfSecuritiesOffered>
        <businessCombinationTransaction>
            <isBusinessCombinationTransaction>false</isBusinessCombinationTransaction>
        </businessCombinationTransaction>
        <minimumInvestmentAccepted>250000</minimumInvestmentAccepted>
        <salesCompensationList></salesCompensationList>
        <offeringSalesAmounts>
            <totalOfferingAmount>50000000</totalOfferingAmount>
            <totalAmountSold>1250000</totalAmountSold>
            <totalRemaining>48750000</totalRemaining>
        </offeringSalesAmounts>
        <investors>
            <hasNonAccreditedInvestors>false</hasNonAccreditedInvestors>
            <totalNumberAlreadyInvested>3</totalNumberAlreadyInvested>
        </investors>
        <salesCommissionsFindersFees>
            <salesCommissions>
                <dollarAmount>0</dollarAmount>
            </salesCommissions>
            <findersFees>
                <dollarAmount>0</dollarAmount>
            </findersFees>
        </salesCommissionsFindersFees>
        <useOfProceeds>
            <grossProceedsUsed>
                <dollarAmount>0</dollarAmount>
            </grossProceedsUsed>
        </useOfProceeds>
        <signatureBlock>
            <authorizedRepresentative>false</authorizedRepresentative>
            <signature>
                <issuerName>EXAMPLE FUND I LP</issuerName>
                <signatureName>Jane Example</signatureName>
                <nameOfSigner>Jane Example</nameOfSigner>
                <signatureTitle>Managing Member of the General Partner</signatureTitle>
                <signatureDate>2026-11-10</signatureDate>
            </signature>
        </signatureBlock>
    </offeringData>
</edgarSubmission>
```
This example was written by hand and then run through `xmllint` against the SEC schema this session: it validates. [VERIFIED: run this session] That proves the schema's rules only; EDGAR's own rules (name match, CCC) can only be proven by a test submission. Every element name and choice value in it appears in the schema quotes above; `authorizedRepresentative` is at formDSubmission.xsd.xml:629 and appears as `false` in the SEC sample and in the real filings read.

### Validating a file against the SEC schema
```sh
# Source: run this session against 12 real filings and both SEC samples
xmllint --noout --schema "formDSubmission.xsd.xml" primary_doc.xml   # prints "<file> validates"
```
The three schema files must sit in one folder: the main one includes the other two by relative name (formDSubmission.xsd.xml:6-7).

### A console page in another file
```js
// Source: the notifications page, assets/js/invitations.js:2324-2341
if (E.diy) {
  NS.views['console-filings'] = {
    mode: 'console',
    edition: 'diy',
    render() {
      const w = NS.state.ws;
      return NS.consoleKit.shell(`${NS.consoleKit.head('Filings')}${NS.consoleKit.panel('', body(w))}`, 'console-filings');
    }
  };
}
NS.navCounts['console-filings'] = (ws) => NS.filings.due(ws, NS.dates.today()).filter((d) => !d.silenced && d.level !== 'soon').length;
```
Plus one line in `NAV` and one key in a `NAV_SECTIONS` group in console.js.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EDGAR access codes (password, passphrase, PMAC) shared by a firm | Individual Login.gov credentials, roles and delegation on a dashboard (EDGAR Next) | Dashboard live March 24, 2025; filing websites require Login.gov from September 15, 2025 | Anything written about EDGAR passwords is obsolete. The Form D spec's own introduction still mentions a password; ignore that sentence |
| Paper or PDF Form ID | Online Form ID with a notarized printout | With EDGAR Next | The portal cannot generate the notarized document |
| Screen-driven filing only | Optional APIs with filer and user tokens | With EDGAR Next | Machine filing is possible but needs two technical administrators and a monthly token |
| Paper state notices | NASAA EFD | Launched 2014 [search results] | One place for most states; manual |

## Plans (about 100k tokens each)

| # | Plan | Depends on | Testable now | Waits for |
|---|------|-----------|--------------|-----------|
| 01 | Filings record and due-date engine: `filings.js`, the amendment test, holiday roll, silencing, order math; check `filings-math.js` | - | Fully | - |
| 02 | Form D builder core: `formd.js` and the choice lists in `filings-data.js`; schema files, SEC samples and masked real filings as fixtures with pins; check `formd-xml.js` (xmllint) | - | Fully | - |
| 03 | Filings tab: page, menu entry, reminders list, silencing, menu count, overview attention item; self-serve edition; frame check at both sizes | 01 | Fully | Owner's check on his phone |
| 04 | Form D on screen: pre-filled form by item, plain-word validation, in-page review, sign-off, order recorded ($100, amendment $50), amendment started from the last filing | 02, 03 | Fully | Owner's check |
| 05 | Server filing module: orders, sealed CCC, server-side rebuild and validation, connector with `fixture` and `staff` transports, the live guard, staff calls and order email | 02 | Fully, with recorded replies | - |
| 06 | EDGAR access onboarding: steps tracker, Form ID answer sheet, delegation guide, power of attorney merge | 03 | Screens fully | Lawyer's wording for the power of attorney; a real Form ID to prove the answer sheet's order |
| 07 | Blue sky: state table from NASAA's matrix (source and date per row), states picker, fee total, order ($100, renewal $50), staff package, per-state results, renewal reminders | 01, 03, and the matrix file | Fully once the matrix is in hand | Network access to nasaa.org, or the owner supplying the PDF |
| 08 | `api` transport: tokens, POST, status polling, operational status, token-expiry warning; recorded Beta replies replace the hand-made ones | 05 | Against recorded replies only | The toolkit read; Carrow & Vale's Beta account, two technical administrators, tokens |

Plans 01 and 02 touch no shared file and can run in parallel. 03 and 04 both edit the tab's file and run in order. 05 is independent of 03 and 04. 07 can run beside 04 and 05 if it keeps to its own files. Nothing in 01 to 07 needs the owner's EDGAR access to be built and proven; what waits for it is the first real test submission, through the staff transport, which is a one-file upload.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The submission API accepts Form D XML | EDGAR Next | The `api` transport cannot be built; the staff transport still files every Form D |
| A2 | API base URL `https://api.edgarfiling.sec.gov`, `Authorization: bearer` header | EDGAR Next | Wrong calls; kept in settings so a change is a setting, not code |
| A3 | `api-bravo.edgarfiling.sec.gov` is the Beta API host | EDGAR Next | Tests point at the wrong place |
| A4 | Rule 302 of Regulation S-T requires the issuer to keep a signed authentication document for a typed signature | Form D | The sign-off step may need a signed page kept on file; a lawyer should confirm |
| A5 | A typical fund issuer is not a "single-member company" and needs two account administrators | EDGAR Next | The steps tracker asks for one person too many or too few |
| A6 | Federal holiday list and observed-day rules | Patterns | A due date one day off around a holiday |
| A7 | EFD: $160 system fee on the initial notice, none on amendment or renewal | Blue sky | Wrong total shown to a sponsor |
| A8 | EFD payment by ACH only | Blue sky | Staff procedure wrong |
| A9 | Most states: 15 days from first sale in the state | Blue sky | Wrong state reminders; fixed by the table |
| A10 | Florida needs no notice; New York $300 / $1,200; California limit on multi-issuer filings | Blue sky | Wrong rows; fixed by the table |
| A11 | EFD has no API or bulk upload | Blue sky | A cheaper route missed; the manual design is unaffected |
| A12 | The NASAA matrix is current and covers late fees and renewals | Blue sky | Those columns need state-by-state sources |
| A13 | Power of attorney wording | Onboarding | Form ID rejected; needs a lawyer |
| A14 | The staff transport (a Carrow & Vale person uploading the portal's file) is consistent with D-02's "filed by the portal through the SEC's EDGAR APIs" as a fallback | Patterns | The owner may want API only; then nothing can be filed until two technical administrators exist |
| A15 | The server holding Carrow & Vale's tokens is one Carrow & Vale runs, separate from any sponsor-run server | Patterns | Secrets on the wrong machine |

## Open Questions

1. **Does Carrow & Vale have a second person?**
   - Known: the API needs two technical administrators at the filer, no exception for a one-person company; a company filing agent needs two account administrators unless it is a single-member company.
   - Unclear: whether the owner has, or can authorize, a second individual, and whether that person may be a non-employee (not found in what was read).
   - Recommendation: ask the owner. Until answered, plan on the staff transport, which one person can operate.

2. **Is uploading the portal's file by hand acceptable until the API is in place?**
   - It files the same Form D with the same result and needs no tokens.
   - Recommendation: yes, as the first working route; the API replaces it when its prerequisites exist.

3. **Who types Form ID: the sponsor or Carrow & Vale?**
   - Both are allowed. Carrow & Vale doing it is less work for the sponsor and more for staff at $100 a filing.
   - Recommendation: build the tracker and answer sheet so either works; let the owner choose the default.

4. **Pass the EFD system fee through or absorb it?**
   - Recommendation: pass through as its own line (D-03 passes state fees at cost); owner to confirm once the amount is read from NASAA.

5. **Where do staff see and work orders?**
   - Recommendation for this phase: email plus token-protected calls. A staff screen can follow.

6. **The power of attorney and the sign-off wording.**
   - Both are legal text. Recommendation: the owner's lawyer supplies or approves them; plans leave a clearly marked placeholder that blocks launch, not the build.

7. **Amount sold in variable-fee states.**
   - Unclear until the matrix is read which states use amount offered and which amount sold in the state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `xmllint` | Schema checks | Yes | libxml 2.9.14 | Python `lxml` 6.1.3 is also installed |
| Node | Server, checks | Yes | v22.23.4 | - |
| Python 3 | Small scripts, local file server in the gate | Yes | 3.13.18 | - |
| www.sec.gov | Fetching fixtures and specs | Yes | - | Files already downloaded this session can be re-fetched in seconds |
| api.edgarfiling.sec.gov (toolkit) | Plan 08 | No | - | Staff transport; owner or orchestrator reads the toolkit |
| www.nasaa.org, nasaaefd.org | Plan 07's table | No | - | Owner supplies the matrix PDF |
| EDGAR filing-agent access | Any real submission | No (owner applying) | - | Recorded replies |
| Browser check queue (`SCRATCH/exec-011/heavy.sh`) | Frame checks | Yes, per AUTOPILOT.md | - | - |
| Disk | Fixtures | 5.9 GB free | - | Fixtures are a few hundred KB |

**Missing with no fallback:** none for building plans 01 to 06.
**Missing with fallback:** the toolkit (plan 08 waits), the NASAA matrix (plan 07 waits for the file).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Server tests | `node --test` in `server/` (197 tests in the last passing gate) |
| Checks | Node scripts under each phase's `checks/`, last line `NAME: PASS (...)`; browser ones run through `SCRATCH/exec-011/heavy.sh` |
| Quick run | `node .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/filings-math.js` and `…/formd-xml.js` |
| Full gate | `.planning/checks/gate-reference.sh` plus this phase's checks; counts follow the merged tree |

### Decisions to checks
| Decision | Behaviour | Type | Command | Exists? |
|----------|-----------|------|---------|---------|
| D-04 | First Form D due 15 calendar days after first sale, rolled past weekends and holidays | unit | `node …/checks/filings-math.js` | No, plan 01 |
| D-04 | Annual amendment from the latest filed notice; stops when the offering ends | unit | same | No |
| D-04 | Amendment needed or not for each line of the exceptions table, at and past each threshold | unit | same | No |
| D-04 | A silenced reminder leaves the count and the overview, stays in the tab, can be turned back on | unit + browser | `filings-math.js`, `filings-flow.js` | No |
| D-02 | Builder output validates against the SEC schema for each case | integration | `node …/checks/formd-xml.js` | No, plan 02 |
| D-02 | Each masked real filing: read, rebuild, validates, same content | integration | same | No |
| D-02 | `validate` agrees with `xmllint` on valid and deliberately broken cases | integration | same | No |
| D-02 | EDGAR rules: both 506 boxes, P.O. box, remaining amount, missing contact, future date | unit | same | No |
| D-02 | Pre-fill from an offering: sold amount uses commitments; counts match the register | unit | `filings-math.js` | No |
| D-02 | Server refuses LIVE without the setting and always under test | server test | `npm --prefix server test` | No, plan 05 |
| D-02 | The CCC is sealed at rest and never returned by any call | server test | same | No |
| D-02 | TEST before LIVE; a suspended test stops the live step | server test | same | No |
| D-02, D-05 | Order recorded with lines and amount due: $100 Form D, $50 amendment | unit | `filings-math.js` | No |
| D-03 | Fee total: per-state fees, variable ones, system fee line, $100 or $50; every table row has a source and date | unit | `filings-math.js` | No, plan 07 |
| D-01 | The tab opens, shows, and has a way out in the sandboxed frame at 390x844 with touch and at 1280x800; no network call | browser | `filings-flow.js` through heavy.sh | No, plan 03 |
| D-01 | Managed edition menu and pages unchanged | existing | `status-math.js` slice guard, plus a menu assertion | Partly |
| Carried | No vendor, model or library name, nor "basic", on any Filings screen | browser | leak search in the owner walk, extended to the tab | Partly |

### Sampling Rate
- **Per task commit:** the two Node checks (seconds).
- **Per plan merge:** the full gate.
- **Phase gate:** full gate green, then the owner's own check on his phone before anything is called done.

### Wave 0 Gaps
- [ ] `checks/filings-math.js`, `checks/formd-xml.js`, `checks/filings-flow.js`
- [ ] `server/test/fixtures/formd/`: three schema files with `SHA256SUMS`, two SEC samples, masked real filings and the masking script
- [ ] `server/test/fixtures/edgar/`: reply files shaped from the SEC overview's figures, marked as hand-made until replaced by recorded Beta replies
- [ ] The NASAA fee matrix PDF, fetched by someone with access
- [ ] `server/test/filings*.test.mjs`

RED first: each check is written and seen to fail before the code it covers (AUTOPILOT.md).

## Security Domain

`security_enforcement` is on, ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing bearer token (`API_TOKEN`) for portal calls; a separate staff token for staff calls, compared with `safeEqual` (server/lib/crypto.mjs) |
| V3 Session Management | no | No sessions added |
| V4 Access Control | yes | A filing order is tied to its workspace; staff calls need the staff token; in the console, ordering and signing off need the owner role (`can('configure')`) |
| V5 Input Validation | yes | Server rebuilds XML from the draft and validates; lengths and choice lists from the schema; XML escaping of every value |
| V6 Cryptography | yes | `server/lib/vault.mjs` for the CCC and stored drafts; no new crypto |
| V7 Logging | yes | Order and filing events in the change log without secrets |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XML injection through a name or address | Tampering | Escape every value; never concatenate raw input; schema validation after building |
| CCC or token disclosure | Information disclosure | Server only, sealed, never logged, never returned; tokens from the environment |
| An unauthorized filing in an issuer's name | Spoofing / Elevation | Sign-off recorded with who and when; owner role only; server refuses a filing with no recorded sign-off; live guard |
| A live filing made by a test | Tampering | `EDGAR_ALLOW_LIVE` guard with its own test |
| One sponsor reading another's order | Information disclosure | Workspace check on every call |
| Outbound calls to an attacker's host | Tampering | EDGAR host from settings on the server, never from a request |
| Personal data of related persons in the repository | Information disclosure | Masked fixtures only |
| Social Security numbers in a submission | Compliance | Form D asks for none; the Form ID sheet repeats the SEC's instruction not to enter one |

## Project Constraints (from CLAUDE.md)

`.planning/config.json` points at `./.claude/CLAUDE.md`, which does not exist; the project's instructions are in `./CLAUDE.md` and `.planning/AUTOPILOT.md`. Directives that bind plans for this phase:

- Nothing is called ready, working or done until tested on real material and checked by the owner. Report failures first.
- No time estimates that were not measured.
- An outside service that could do the job better is presented to the owner with cost and trade-offs before building in-house.
- GSD for all work: research, plan, plan check, executors in isolated copies, verifier, owner checks.
- No corners cut; work economically; no waste.
- A question to the owner goes with a push notification; after 15 minutes without an answer, choose, record the choice and why, continue.
- AUTOPILOT.md: build only what the law or the task needs; no extra text on screens; nothing mandatory for investors; white label; managed edition unchanged unless a plan says so; no paid API calls by agents and no keys given to agents; never commit confidential documents or personal data; every user-facing plan proves its screens in the sandboxed frame with no network at 390x844 with touch and at 1280x800; no `fetch` on a path that must work without a server; no Blob in IndexedDB; no browser PDF viewer; every view has a way out; dialogs scroll; RED-first checks; worktrees from the latest `claude/refract-reskin`; push only to `wip/<branch>`; never touch STATE.md or ROADMAP.md except a planner's own phase section; keep gate counts exact.

## Sources

### Primary (read this session, www.sec.gov)
- `https://www.sec.gov/files/formd.pdf` - Form D and instructions
- `https://www.sec.gov/files/edgar/filer-information/specifications/formdxmltechspec-81_d.zip` - schema, samples, specification
- `https://www.sec.gov/submit-filings/technical-specifications` - where the above is listed
- `https://www.sec.gov/about/divisions-offices/division-corporation-finance/frequently-asked-questions-answers-form-d` - Form D FAQ, reviewed July 9, 2026
- `https://www.sec.gov/files/edgar/filer-information/api-overview.pdf` - Overview of EDGAR APIs, December 22, 2025 (text and figures)
- `https://www.sec.gov/files/edgar/filer-information/edgarfm-vol1-v43.pdf` - Filer Manual Volume I, effective March 16, 2026
- `https://www.sec.gov/files/edgar/filermanual/efmvol2-c9.pdf`, `efmvol2-c8.pdf`, `efmvol2-c2.pdf` - Filer Manual Volume II chapters, September 14, 2026
- `https://www.sec.gov/files/rules/final/2024/33-11313.pdf` - EDGAR Next adopting release
- `https://www.sec.gov/files/edgar-next-filer-testing-guidance.pdf` - Beta testing guidance
- `https://www.sec.gov/submit-filings/improving-edgar/edgar-next-improving-filer-access-account-management` and its FAQ page
- `https://www.sec.gov/submit-filings/improving-edgar/edgar-beta-environment`
- How Do I guides under `https://www.sec.gov/submit-filings/filer-support-resources/how-do-i-guides/`: `prepare-submit-my-form-id-application`, `understand-edgar-next-roles`, `understand-manage-delegation`, `create-manage-filer-user-api-tokens`, `understand-edgar-application-programming-interfaces-apis`, `obtain-logingov-individual-account-credentials`, `complete-annual-confirmation-edgar-account`, `determine-my-edgar-applicant-type`, `understand-edgar-its-three-websites`, `submit-online-forms`, `observe-data-process-filing-limits`
- Twelve Form D and D/A filings from `https://www.sec.gov/Archives/edgar/data/…/primary_doc.xml`, listed by `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D`
- The codebase at the files and lines cited

### Secondary (search summaries only; not read)
- `https://api.edgarfiling.sec.gov/docs` - API Development Toolkit
- `https://nasaaefd.org/FAQ/answer?faq=4`, `https://www.nasaaefd.org/About/FormDStates`, `https://www.nasaaefd.org/DOCUMENTATION/FILERS/FilerWalkThroughFormD.pdf`
- `https://www.nasaa.org/wp-content/uploads/efd/Form-D-fees-matrix.pdf`

### Tertiary (search summaries of third-party sites; leads only)
- allocations.com, securitieslawyer101.com, comply.com, newsfilecorp.com on blue sky fees and filing services
- `https://dfpi.ca.gov/…/securities-frequently-asked-questions-and-answers/`, `https://ag.ny.gov/sites/default/files/regulatory-documents/part10-efd-formd-guidance.pdf`

No fetched page contained text addressed to an automated reader or any instruction to act on.

## Metadata

**Confidence breakdown:**
- Form D content, schema, amendment rules: HIGH - official files read; real filings validated.
- EDGAR Next accounts, roles, delegation, tokens: HIGH - several SEC documents agree.
- EDGAR API call details and Form D through the API: LOW to MEDIUM - toolkit not read.
- Blue sky, EFD, state fees: LOW - no primary source read.
- Portal structure: HIGH - files read at the cited lines.

**Research date:** 2026-11-19
**Valid until:** 2026-12-19 for SEC material (EDGAR releases are quarterly; the Filer Manual chapters read are dated September 14, 2026). State fees: re-read the matrix on the day the table is built.
