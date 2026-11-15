# Phase 6: Onboarding forms (W-9 / W-8 and investor-status questions) - Research

**Researched:** 2026-11-15
**Domain:** IRS withholding certificates (W-9, W-8BEN, W-8BEN-E) filled from the official fillable PDFs with pdf-lib and e-signed inside the invitation flow; securities-exemption investor-status questions (Rule 506(b), Regulation A Tier 2, ERISA plan-asset 25 percent test) with sponsor-side tracking
**Confidence:** MEDIUM overall. The in-repo integration findings are HIGH: every file was read this session. The legal rules are MEDIUM, cited from primary-source text through search results; irs.gov, ecfr.gov and other sites could not be opened from this session. The IRS PDF field names are LOW until enumerated (see the blocker below).

> **BLOCKER (read first):** This session cannot reach `www.irs.gov` or `www.ecfr.gov` (bash: `curl: (56) CONNECT tunnel failed, response 403`; WebFetch: `getaddrinfo ENOTFOUND www.irs.gov`). So the three official PDFs could **not** be downloaded and their AcroForm field names could **not** be enumerated. The coordinator asked for the W-9 field names to be confirmed. They are **not confirmed** here. Wave 0 of the plan must get the PDFs into the repository and enumerate their fields with pdf-lib before any mapping is written. Two ways to do that: the owner allows `www.irs.gov` in the session network settings, or the owner downloads `https://www.irs.gov/pub/irs-pdf/fw9.pdf`, `.../fw8ben.pdf` and `.../fw8bene.pdf` and drops them in. Everything below that names a field is tagged `[ASSUMED]`.

## Summary

Onboarding today already has a **Tax certification** step in the invitation flow (`fTax`, assets/js/onboarding.js). It is an HTML *substitute* certification: the perjury wording is shown, the investor ticks a box and types their name, and the record keeps only `taxForm` ('W-9' / 'W-8BEN' / 'W-8BEN-E') plus a `taxCert` summary. **No form PDF is produced. The full TIN is thrown away after the last four digits are kept.** So the sponsor today never gets a usable W-9 (it needs the full TIN for K-1 and 1099 reporting). There are also no 506(b) non-accredited, Regulation A or ERISA questions. The subscribe step *requires* the investor to tick "is an accredited investor" (`subAcc`), so a 506(b) sophisticated non-accredited investor or a Reg A non-accredited investor cannot subscribe at all today.

The recommended build reuses the e-signature pipeline the portal already has, end to end:

1. Bundle the three official IRS PDFs as static assets.
2. Fill **their own AcroForm fields** with pdf-lib from a per-revision field map (owner decision: "for the w-9 use a fillable version of the form if possible").
3. Flatten the filled form.
4. Hand the flat PDF to a new small `NS.esign.createFromPdf(...)`. It builds an investor-only envelope with one signature field and one date field at the form's signature line. The existing `embed` / adopt-signature / `finishSigning` / certificate / seal / Documents-listing code then signs it unchanged.

The investor-status questions become one **Investor status** step, driven by the offering's exemption. It replaces today's self-certified accreditation step; Rule 506(c) verification stays exactly as it is. The answers are stored on the subscription request, so they travel through the existing server submission and console merge with no new transport. The sponsor console derives three figures from requests and investor records: the non-accredited purchaser count against 35, Reg A over-limit flags, and the benefit-plan percentage per class against 25 percent.

**Primary recommendation:** Build in-house on the existing esign pipeline. Fill and flatten the official fillable PDFs with pdf-lib 1.17.1 (already loaded by esign.js) through a per-revision JSON field map. Support W-9, W-8BEN and a limited W-8BEN-E. Route W-8ECI, W-8IMY, W-8EXP, custodian-signed IRA forms and unusual W-8BEN-E statuses to "upload your completed form". Never block the investor: a missing or unsigned form, or an unanswered question, shows as a status for the sponsor (D-30). Outside W-9/W-8 services cost about $2-3 per form, carry their own branding and data handling, and mostly add value through IRS TIN matching, which the owner excluded. Present them to the owner as the alternative; do not build them.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Choose the form (W-9 / W-8BEN / W-8BEN-E / upload) and ask its questions | Browser (invitation flow, onboarding.js) | — | All onboarding UI lives in the static app; the answers are prefilled from the profile step already in the browser |
| Fill the AcroForm, flatten, sign, certificate, hash, seal | Browser (esign.js + pdf-lib + record.js) | — | The existing signing pipeline runs in the browser; the PDF never needs a server to be produced |
| Store the signed tax form | Browser IndexedDB (local mode) / integration server vault (server mode) | Console import (invitations.js merge) | Same path as the signed subscription agreement; the server seals PDFs with AES-256-GCM (server/lib/vault.mjs) |
| Accept the tax envelope and its file from the investor's device | API (server/lib/invitations.mjs `cleanSubmission`) | — | The server allowlists file ids per envelope; the tax envelope needs its own allowlist entry |
| Investor-status answers (506(b), Reg A, ERISA) | Browser (flow step) stored on the subscription request | Server passes them through (cleanJson) | Per offering and per subscription, so they belong on the request, not only on the investor |
| 35-count, Reg A flags, ERISA percent per class | Browser (sponsor console, console.js) | — | The console holds every investor, request and ledger figure; derived on render, never stored as a counter |

## User Constraints

There is no CONTEXT.md for phase 6 (it has not been through discuss-phase). The constraints below are copied verbatim from the owner's recorded decisions and the coordinator's messages. Treat them as locked.

### Locked decisions

From `.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/01.4-RESUME.md`, "Owner's next work list (2026-11-15)", item 2 (verbatim):
> 2. Added to the automated onboarding workflow (owner: "make sure these are planned"): W-9 for US investors and W-8BEN / W-8BEN-E for foreign investors, filled in the portal with known answers pre-filled and e-signed; investor-status questions by offering type: 506(b) accredited or sophisticated non-accredited (count kept against the 35 limit), Reg A Tier 2 self-certification of the 10 percent investment limit for non-accredited investors, benefit-plan investor (ERISA) questions with the 25 percent-of-class count tracked for the sponsor.

From 01.4-CONTEXT.md D-46 (verbatim):
> **D-46 (owner, 2026-11-15, verbatim: "it should be skipped entirely its not a ppm or sub doc and will be included elsewhere in the work flow"):** Tax forms attached to a subscription agreement (W-9, W-8BEN, W-8BEN-E and the rest of the W-8 series, with their instruction pages) are not places and get no fields; the portal collects them in its own onboarding step (task: onboarding forms).

From 01.4-CONTEXT.md D-30 (verbatim excerpt):
> **Investor fields are never mandatory:** no investor-side field is required to complete signing (the investor can leave any of them empty). Sponsor fields keep their current behaviour.
> **Auto-fill:** every investor field the portal can fill from information it already holds (name, entity name, address, email, phone, commitment amount, date, tax id where held) is filled automatically; the investor can still change it.

From the coordinator's brief (owner decisions for this phase):
- TIN matching with the IRS is left out (owner decision).
- Two people only, investor and sponsor (D-30); investor fields are never mandatory, including signatures; auto-fill is editable.
- White label: no provider, model or vendor names in anything sponsors or investors see. The word "basic" is never used.

From the coordinator, mid-research (owner, verbatim): **"for the w-9 use a fillable version of the form if possible"**. The coordinator's instruction: fill the official IRS fillable W-9's own AcroForm fields with pdf-lib, then e-sign and flatten; do not draw values over a flat page or rebuild the form. Confirm the field names and whether the same holds for W-8BEN and W-8BEN-E; record any field that cannot be filled programmatically, and the fallback.

### Claude's discretion
Where the steps go, the sponsor-console presentation, which W-8 variants are supported and which go to upload, the counting method, and the test design.

### Deferred / out of scope
IRS TIN matching. Regulation Crowdfunding investment limits (not asked). Form D and state notice filings (a separate later item on the owner's list). The verification package (KYC/accreditation provider choice; a separate item).

## Project Constraints (from CLAUDE.md)

- GSD flow for all work: research, plan, plan check, build by executors in isolated copies, verifier, owner check. Never call anything done before the owner has checked it.
- Test on real documents and show the owner the real result. Failures are reported first and plainly.
- Never give a time that has not been measured.
- An outside API or service that could do the job must be presented to the owner with cost, accuracy, speed and trade-offs before building in-house. (This is done in "Outside services" below; the planner must surface it to the owner as a decision checkpoint.)
- Work economically: no waste, no features or gates that were not asked for (also PROJECT.md "Scope discipline").
- Questions to the owner get a push notification. With no answer within the owner's window, choose, record the choice and why, and carry on. (The latest commit says 15 minutes; CLAUDE.md says 1 hour. Follow the latest owner instruction.)
- White label (PROJECT.md): investors see only the sponsor's brand. No product or vendor names in the UI.
- Security (PROJECT.md): no provider secrets in the browser.
- Imagery: no AI-generated or stock images.
- Do not apologize; do not say "you're right"; do not comment on the owner's emotional state.

## How onboarding works today (read this session)

The invitation flow (self-serve edition, route `#invite-<token>`) is one link through every step. Step keys and labels: [VERIFIED: assets/js/onboarding.js:707-718]
```
welcome: 'Welcome', login: 'Create your login', profile: 'Investor information', identity: 'Identity verification',
accreditation: 'Accreditation', tax: 'Tax certification', payment: 'Distribution payments', subscribe: 'Subscription',
agreement: 'Subscription agreement', done: 'Done'
```
Step order for a new investor: [VERIFIED: assets/js/onboarding.js:1107-1111]
```js
const s = ['welcome', 'login', 'profile', 'identity'];
if (accVerifiedFor(c) || c.ws.tenant.onboarding.accreditation) s.push('accreditation');
s.push('tax', 'payment');
subSteps(c, s);
s.push('done');
```
An existing investor invited to a new offering gets `['welcome', (accreditation if 506(c) needs it), 'subscribe', 'agreement', 'done']`. There is no tax step, because the tax form is already on file. [VERIFIED: assets/js/onboarding.js:1086-1106]

What the tax step saves today: [VERIFIED: assets/js/onboarding.js:1644-1654]
```js
const form = usp ? 'W-9' : d.type === 'entity' || d.type === 'trust' ? 'W-8BEN-E' : 'W-8BEN';
...
i.taxCert = usp
  ? { form, at: nowIso(), signedBy: d.taxSig.trim(), tinLast4: i.tinLast4, backupWithholding: !!d.backup }
  : { form, at: nowIso(), signedBy: d.taxSig.trim(), country: d.taxCountry, ftinLast4: ..., noFtin: !!d.noFtin, treatyCountry: d.treaty || '' };
d.tin = d.ftin = '';
```
Full TINs are never persisted: [VERIFIED: assets/js/onboarding.js:727] `const SECRET = ['password', 'password2', 'tin', 'ftin', 'routing', 'account', 'account2'];`

The tax step **blocks** the investor today (`validate` requires `usPerson`, `tin`, `w9`/`w8`, `taxCountry`, `ftin`, and a typed name matching the contact). That conflicts with D-30 and must change. [VERIFIED: assets/js/onboarding.js:1563-1576]

The subscribe step requires the accredited tick: [VERIFIED: assets/js/onboarding.js:1407 and 1584] `check('subAcc', `${h(c.inv.title)} is an accredited investor...`)` / `if (!d.subAcc) e.subAcc = 'Confirm your accreditation to continue.';`

Investor types: [VERIFIED: assets/js/data.js:108-114]
```
individual: { label: 'Individual', sec: 'PPD' }, joint: { label: 'Joint account', sec: 'PPD' }, trust: { label: 'Trust', sec: 'PPD' },
entity: { label: 'LLC, partnership or corporation', sec: 'CCD' }, ira: { label: 'IRA (through a custodian)', sec: 'CCD' }
```
Accreditation bases offered for self-certification: [VERIFIED: assets/js/data.js:106]
`const ACCRED = ['Income over $200,000 (or $300,000 jointly)', 'Net worth over $1 million, excluding primary residence', 'Licensed professional (Series 7, 65 or 82)', 'Entity with assets over $5 million', 'All equity owners are accredited'];`
This is narrower than Rule 501(a) as amended in 2020 (Rel. 33-10824, effective 2020-12-08), which added knowledgeable employees of private funds, family offices, entities owning more than $5 million in investments, and others [CITED: govinfo.gov/content/pkg/FR-2020-10-09/html/2020-19189.htm; exact category list ASSUMED].

Exemption choices on the offering page: [VERIFIED: assets/js/console.js:386-393]
```js
['Rule 506(b)', 'Rule 506(b)'], ['Rule 506(c)', 'Rule 506(c): verified accredited investors only'], ['Regulation A', 'Regulation A'],
['Regulation Crowdfunding', 'Regulation Crowdfunding'], ['Regulation S', 'Regulation S'], ['Section 4(a)(2)', 'Section 4(a)(2)']
```
"Regulation A" has **no tier**. The 10 percent limit applies only to Tier 2, so a tier choice is needed (see Pattern 4). A value read from documents that is not in the list stays selectable (`exemptionOptions`, console.js:394-398).

Firm-level onboarding toggles: [VERIFIED: assets/js/tenants.js:61] `onboarding: { accreditation: true, taxForm: true, ach: 'required', esign: true }`. The console labels the `taxForm` toggle "Collect a substitute W-9 certification" [VERIFIED: assets/js/console.js:2949]. The label must change once the official forms are collected.

The esign field types: [VERIFIED: assets/js/esign.js:37-44] `signature`, `initials`, `date`, `name`, `text`, `checkbox`. Investor signatures are already optional under D-30: `isReq` returns false for investor fields [VERIFIED: assets/js/esign.js:145]. `date` fields fill themselves with `usDate(NS.dates.today())` at signing [VERIFIED: assets/js/esign.js:2219].

The PDF writer is pdf-lib 1.17.1 plus fontkit 1.1.1, loaded from CDN: [VERIFIED: assets/js/esign.js:25,30]
`'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'`, `'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'`

`finishSigning` (esign.js:1067-1158) already does the following: stamps fields, locks the PDF's own AcroForm (`lockOwnFields`, which also deletes `/XFA`), appends the certificate (`NS.record.certify`), seals, hashes, stores `<env.id>-signed`, publishes a `ws.docs` entry to the investor, and calls `onSigned` hooks.

Public esign API: [VERIFIED: assets/js/esign.js:3798] `{ saveAgreement, pendingFor, createFromTemplate, send, statusLabel, signedBlob, remind, void: voidEnvelope, currentSigners, subscriptionTemplate, templateReady, embed, embedAfter, recordConsent, onSigned, refreshSubscription, canResign, resign, investorDocsHTML, agreementPanel, agreementDraft, autoFields, agreementTodo, pageLayout, fieldsOf, readNote }`. There is no way to create an envelope from an arbitrary PDF without a sponsor template. A small `createFromPdf` is the one new esign function needed.

The server accepts only the subscription envelope's files: [VERIFIED: server/lib/invitations.mjs:221-226]
```js
const allowed = Object.create(null); // file id -> 'agreement' (a PDF) or 'evidence' (a PDF, PNG or JPEG)
let signedId = '';
if (env && /^[\w.-]{1,70}$/.test(String(env.id || ''))) {
  if (env.workDocId === `${env.id}-work`) allowed[env.workDocId] = 'agreement';
  if (env.status === 'completed' && env.signedDocId === `${env.id}-signed`) allowed[(signedId = env.signedDocId)] = 'agreement';
}
```
Any other file is dropped unread (invitations.mjs:255-259). A signed tax form sent today would be silently dropped, so server mode needs a `taxEnvelope` allowance (Pattern 6). The investor record and request objects pass through `cleanJson` without a field allowlist (invitations.mjs:187, 210), so new answer fields on them arrive unchanged. The console's `merge` copies every investor key except `BAD_KEYS` for a new investor, and keeps an on-file investor's tax form as held (assets/js/invitations.js:782-805).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | 1.17.1 (already loaded, esign.js:25) | `PDFDocument.load`, `getForm()`, `getTextField/getCheckBox`, `setText`, `check`, `updateFieldAppearances(font)`, `flatten()` | Already the portal's PDF writer; supports AcroForm fill and flatten [ASSUMED: API names from pdf-lib docs, not fetched this session] |
| @pdf-lib/fontkit | 1.1.1 (already loaded, esign.js:30) | Embed DejaVu Sans so non-Latin names on W-8 forms render in field appearances | Already used by `fontsFor` in esign.js |
| Official IRS PDFs | W-9 Rev. March 2024; W-8BEN Rev. October 2021; W-8BEN-E Rev. October 2021 | The forms themselves, bundled as static files | Owner decision: fill the official fillable form |

No new packages are installed in this phase.

### IRS form revisions (state on 2026-11-15)
- **W-9 Rev. March 2024** is the current final form. A **draft Rev. June 2026** exists, marked "DRAFT — DO NOT FILE": it adds a digital-asset broker certification and exempt payee code 14, and keeps the sole-proprietor EIN option. Practitioners say to keep using March 2024 until the final is posted. [CITED: irs.gov/pub/irs-dft/fw9--dft.pdf, as shown in search results; kpmg.com 051426 alert; complyexchange.com] Earlier W-9s do not expire because a new revision is published [CITED: taxnews.ey.com/news/2024-0584]. **Design consequence:** the form map must be per revision, so swapping in the June 2026 final is a data change (new PDF plus new map), not a code change.
- **W-8BEN and W-8BEN-E Rev. October 2021** are current. No newer final was found [CITED: search results citing the IRS forms index; LOW-MEDIUM]. A W-8BEN or W-8BEN-E generally stays valid until the last day of the third calendar year after the year it is signed, unless circumstances change [CITED: secondary sources (iofm.com, omnivoo.com); rule text Treas. Reg. 1.1441-1(e)(4)(ii) not opened, ASSUMED citation].
- Official URLs (standard IRS paths; not reachable from this session): `https://www.irs.gov/pub/irs-pdf/fw9.pdf`, `https://www.irs.gov/pub/irs-pdf/fw8ben.pdf`, `https://www.irs.gov/pub/irs-pdf/fw8bene.pdf`; instructions `iw9.pdf` (requester), `iw8ben.pdf`, `iw8bene.pdf`. [ASSUMED: path pattern; the draft form path irs.gov/pub/irs-dft/fw9--dft.pdf appeared in search results]

### Alternatives considered (in-house variants)
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Filling the AcroForm and flattening before signing (recommended) | Turning AcroForm widgets into envelope text fields and writing values back at finish | Edits happen on the form itself, but this needs a new write-back path inside `finishSigning` and comb handling. More code, same legal result |
| Official PDFs | Today's HTML substitute certification | A substitute form is legal, but the owner chose the official fillable form, and the sponsor gets nothing printable with the full TIN today |
| Flattening at fill time | Flattening after signing | Same visible result. Flattening first means the existing signing code never touches AcroForm fields, and `lockOwnFields` becomes a no-op |

## Outside services (project rule: present to the owner before building in-house)

| Option | Cost | Accuracy / coverage | Speed | Trade-offs |
|--------|------|---------------------|-------|-----------|
| **In-house (recommended)**: official PDFs filled with pdf-lib, signed with the portal's own e-signature | No per-form fee; build cost only | Exactly the official form; W-9, W-8BEN, W-8BEN-E (limited); others go to upload | Instant (in the browser) | Fully white-label; data stays in the portal and the sponsor's server; the portal owns keeping up with new revisions (a data swap) |
| TaxBandits W-9/W-8 API (hosted forms, e-sign, webhook with the completed PDF) | $2.99/form for the first 49, down to $1.99/form at 501-1000 (pricing page as reported by search; confirm live) [CITED: taxbandits.com/pricing-comparison via search] | W-9 and all W-8 variants (W-8BEN-E, ECI, IMY, EXP through its WhCertificate endpoint) [CITED: developer.taxbandits.com docs via search] | Depends on the hosted flow plus webhook | Investor leaves for a vendor-hosted page or embed (white-label risk); TINs go to a third party; prepaid credits; needs a server integration; adds a vendor name risk in emails and pages |
| Avalara 1099 & W-9 (formerly Track1099) API | TIN matching $0.45/check; W-9 collection fee unclear from the pricing page [CITED: avalara.com/us/en/products/1099/pricing.html via search] | W-9 focus plus TIN matching | Hosted | Main value is TIN matching (owner excluded it); vendor branding; data leaves the portal |
| Tax1099 / Zenwork, Comply Exchange, Tipalti | Custom or enterprise pricing (Tax1099 API plan reported at about $349) [CITED: toolradar/tax1099 via search, LOW] | Broad W-8 coverage, treaty validation | Hosted | Enterprise-oriented, expensive at a 40-sponsor scale, vendor-facing UI |

**Recommendation to put to the owner:** in-house. The portal already has a legal-grade e-signature with a certificate, audit trail and seal. The forms are fixed public documents. The thing outside services do best (IRS TIN matching, broad W-8 validation) is either excluded by the owner or rare among this portal's investors (US-heavy private funds). An outside service would cost about $2-3 per investor, break white label, and send full SSNs to a third party.

## Package Legitimacy Audit

No external packages are installed in this phase. pdf-lib 1.17.1 and @pdf-lib/fontkit 1.1.1 are already in use (esign.js:25,30) and are not new installs. The test harness uses the Playwright already present (`/opt/node22/lib/node_modules/playwright`).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none new) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Investor opens invitation link (#invite-<token>)
  -> profile step (name, type, address, country, DOB, TIN typed here)
  -> identity step (unchanged)
  -> [Investor status] step  (shown by offering exemption; 506(c) keeps verification as today)
        506(b): accredited? -> basis | not accredited -> sophistication answers / purchaser representative
        Reg A Tier 2 (not listed): accredited? -> no -> income + net worth (entity: revenue + net assets) -> limit = 10% of greater
        ERISA (every equity offering): plan type? IRA => benefit plan investor (prefilled, editable); entity => plan-asset %; controlling person?
        answers -> ob().d -> saved on the subscription request (request.status_answers) and the investor (erisa)
  -> [Tax form] step
        decide form: US person? (prefilled from citizenship/country) -> W-9
                     foreign individual -> W-8BEN ; foreign entity -> W-8BEN-E (supported statuses)
                     other (ECI/IMY/EXP, custodian form, unsupported W-8BEN-E status) -> upload a completed form
        questions prefilled + editable (classification, 3b foreign owners, exempt payee code, treaty, FATCA status ...)
        -> taxforms.fill(): load bundled IRS PDF -> getForm() -> set fields from the revision map -> updateFieldAppearances(font) -> flatten
        -> NS.esign.createFromPdf(): investor-only envelope (signature + date at the form's signature line), docId in IndexedDB
        -> NS.esign.embed() signing view (existing) -> finishSigning (existing): signature stamped, certificate appended, sealed, SHA-256
        -> onSigned hook: investor.taxForm / taxCert {form, revision, envelopeId, signed: true|false, validUntil}
  -> payment -> subscribe (Reg A: commitment checked against the limit; warn, do not block) -> agreement -> done
        server mode: sendCompletion adds the tax envelope + its signed PDF -> server allowlist (taxEnvelope) -> vault -> console merge
Sponsor console
  offering page "Investor eligibility" panel <- derived from requests + investors + ledger:
     506(b) non-accredited purchasers N of 35 (accepted / pending)
     Reg A Tier 2: non-accredited subscribers, limit vs amount, over-limit flags
     ERISA: per class, benefit-plan % (value basis shown) vs 25%, and what a pending subscription would make it
  requests (accept) view: flags on each pending subscription
  investor record: "W-9 signed 2026-11-15" -> download signed PDF (ws.docs entry, cat 'Tax')
```

### Recommended file structure
```
assets/forms/                     # NEW: official IRS PDFs, byte-for-byte as downloaded (public domain), with SHA-256 recorded
  fw9-2024-03.pdf
  fw8ben-2021-10.pdf
  fw8bene-2021-10.pdf
assets/js/taxforms.js             # NEW: revision maps (portal key -> AcroForm field name), form choice, fill + flatten, signature-line geometry
assets/js/onboarding.js           # EDIT: tax step becomes questions + "Review and sign"; Investor status step; no blocking validation
assets/js/esign.js                # EDIT: export createFromPdf(ws, opts) (~40 lines, reuses makeEnvelope/investorSigner/send)
assets/js/console.js              # EDIT: exemption tiers; offering "Investor eligibility" panel; request flags; tax-form download on the investor record
assets/js/invitations.js          # EDIT: merge imports the tax envelope + signed copy (as the subscription envelope is imported)
server/lib/invitations.mjs        # EDIT: allow taxEnvelope's <id>-signed file (PDF only), sealed like the agreement
diy.html / index.html             # EDIT: <script src="assets/js/taxforms.js">
.planning/phases/06-.../checks/   # NEW: Playwright + node checks (see Validation Architecture)
```

### Pattern 1: Revision map, filled by field name (owner decision)
**What:** One JSON-like map per form revision: `{ file, sha256, revision, fields: { portalKey: { name: '<full AcroForm field name>', kind: 'text'|'check'|'comb' , onValue? } }, sign: { page, x, y, w, h }, date: { page, x, y, w, h } | { field: '<name>' } }`. Fill only by exact name. Abort if the bundled file's SHA-256 differs from the map's (a revision swapped without a new map).
**When to use:** Every form fill.
**Field names:** **not enumerated this session (blocker).** Search results consistently report the W-9 naming pattern as `topmostSubform[0].Page1[0].f1_01[0]` for line 1, with classification boxes as `c1_1[n]` checkboxes whose on-values are box-specific strings ("1"…"7"), not `true` [CITED: apify.com/ely_source/pdf-form-filler; intl-spectrum.com; LOW]. The W-8BEN and W-8BEN-E names are expected to follow the same `topmostSubform[0].PageN[0].f_N[0]` / `c1_N[0]` XFA-derived pattern [ASSUMED]. Wave 0 enumerates them with:
```js
// Wave 0 enumeration (node, run against the bundled file). pdf-lib API [ASSUMED: from pdf-lib docs]
const { PDFDocument, PDFName } = require(VENDOR + '/pdflib/package/cjs/index.js');
const pdf = await PDFDocument.load(fs.readFileSync(file));
const form = pdf.getForm();               // logs a warning and drops XFA: expected for IRS forms
for (const f of form.getFields()) {
  const w = f.acroField.getWidgets().map((x) => { const r = x.getRectangle(); return { r, page: pdf.getPages().findIndex((p) => p.ref === x.P()) }; });
  console.log(f.constructor.name, f.getName(), f.acroField.dict.get(PDFName.of('MaxLen')) || '', JSON.stringify(w));
}
```
Every field is then tied to the printed label beside it on the rendered page (screenshot plus label text), and the map is written by hand from that list. The map is never guessed from names alone.

### Pattern 2: Fill, set appearances, flatten, then sign with the existing envelope
```js
// Source: pattern [ASSUMED: pdf-lib API]; field names come ONLY from the Wave 0 map
async function fillForm(L, map, answers, fontBytes) {
  const bytes = await (await fetch(map.file)).arrayBuffer();
  if (map.sha256 && NS.audit.sha256(new Uint8Array(bytes)) !== map.sha256) throw new Error('This tax form file is not the expected revision.');
  const pdf = await L.PDFDocument.load(bytes);
  pdf.catalog.delete(L.PDFName.of('Perms'));   // drop any usage-rights signature that the change would invalidate
  const form = pdf.getForm();
  for (const [key, spec] of Object.entries(map.fields)) {
    const v = answers[key];
    if (v == null || v === '' || v === false) continue;          // never mandatory (D-30): empty stays empty
    if (spec.kind === 'check') form.getCheckBox(spec.name).check();
    else form.getTextField(spec.name).setText(String(v).slice(0, spec.max || 999));
  }
  pdf.registerFontkit(window.fontkit);
  form.updateFieldAppearances(await pdf.embedFont(fontBytes, { subset: true }));  // DejaVu: non-Latin names
  form.flatten();
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
```
Then `NS.esign.createFromPdf(ws, { blob, title: 'Form W-9 - ' + inv.title, investorId, kind: 'tax', fields: [signature at map.sign, date at map.date] , quiet: true })` builds the envelope with `makeEnvelope` + `investorSigner` and stores the blob under `docId`, then calls `send`. The flow shows `NS.esign.embed(env.id, inv.id)` exactly as `fAgreement` does. If the investor goes back and changes an answer before signing, the unsigned envelope is voided and a new one is built (same as `resign`).

### Pattern 3: Choosing the form
| Investor (onboarding answers) | Form | Notes |
|---|---|---|
| Individual or joint, US citizen or resident alien (citizen = 'us', or the investor answers "yes, U.S. person") | W-9 | Joint: the W-9 is for the holder whose SSN is given (line 1 first holder) [ASSUMED] |
| Entity or trust organized in the US (country = US) | W-9 | Line 3a classification from the questions; line 3b (new in 2024) for partnerships, trusts or estates with foreign partners, owners or beneficiaries [CITED: taxnews.ey.com/news/2024-0584; bdo.com] |
| Single-member LLC disregarded for tax | W-9 of the **owner** (line 1 = owner, line 2 = LLC name) | One question: "Is the LLC disregarded for U.S. tax?" [ASSUMED] |
| IRA | W-9 for the IRA (exempt payee code 1 covers "any IRA") prefilled, **or** upload of the custodian's own W-9 | Custodians usually sign their own forms; offer both [ASSUMED] |
| Individual, not a US person | W-8BEN | DOB (line 8) prefilled from the profile step; FTIN or the "not legally required" box |
| Foreign corporation, foreign simple or complex trust, foreign estate (beneficial owner) | W-8BEN-E (limited) | Supported chapter 4 statuses: Active NFFE, Passive NFFE (with substantial US owners or a statement of none), Participating FFI / Reporting Model 1 or 2 FFI (GIIN). Anything else -> upload |
| Foreign partnership, foreign grantor trust, foreign intermediary or nominee | **Upload** a completed W-8IMY with its withholding statement | Needs underlying owners' forms; not suitable for a prefilled form [ASSUMED] |
| Income effectively connected with a US trade or business claimed by the investor | **Upload** W-8ECI | Rare for fund investors [ASSUMED] |
| Foreign government, international organization, foreign central bank, foreign tax-exempt organization | **Upload** W-8EXP | Rare [ASSUMED] |

The decisive questions, each prefilled from earlier answers and editable: (1) U.S. person for tax purposes? (2) Investing as which type (already asked)? (3) Entity: country of organization and U.S. tax classification (C corp, S corp, partnership, trust or estate, LLC taxed as C/S/P, disregarded)? (4) Flow-through with foreign partners, owners or beneficiaries (W-9 line 3b)? (5) Foreign: country of tax residence, FTIN, treaty country (and for W-8BEN-E, limitation-on-benefits line 14b and chapter 4 status)? (6) "Upload a completed form instead" is always offered.

### Pattern 4: Investor status step, by exemption
- **Rule 506(c):** unchanged (verified accreditation through the connections, integrations.js).
- **Rule 506(b):** "Is [account] an accredited investor?" Yes -> basis (from the 501(a) list, expanded). No -> sophistication answers: years and kinds of investing experience, education or profession, whether a purchaser representative is advising (name and firm; their written acknowledgment is uploaded). The request stores `{ exemption: '506(b)', accredited: false, sophisticated: <investor's answer>, rep: {...} }`.
  - Rule: no more than (or the issuer reasonably believes no more than) **35 purchasers** "in offerings under this section in any 90-calendar-day period". Accredited investors are excluded from the count under Rule 501(e), and so is a relative, spouse or spouse's relative who shares the purchaser's primary residence. Each non-accredited purchaser, alone or with a purchaser representative, must have the knowledge and experience to evaluate the merits and risks, or the issuer must reasonably believe so immediately before the sale. [CITED: law.cornell.edu/cfr/text/17/230.506 (506(b)(2)(i)-(ii)); govinfo CFR 230.501(e)]
  - Issuer duty when any non-accredited purchaser is present: Rule 502(b) information (disclosure documents and financial statements before the sale, and the chance to ask questions) [ASSUMED: rule from training; verify at law.cornell.edu/cfr/text/17/230.502]. The console shows the sponsor a reminder; it is not a gate.
- **Regulation A Tier 2** (offering not listed on a national securities exchange at qualification): "Accredited investor?" No -> natural person: annual income and net worth; non-natural person: revenue and net assets for the most recent fiscal year. Limit = **10 percent of the greater** of the two. It applies to the aggregate purchase price paid by the purchaser in the offering. Income and net worth are calculated as for the accredited-investor definition in Rule 501(a). The issuer may rely on the purchaser's representation unless it knows the representation is untrue. The limit does not apply to accredited investors or to securities listed on a national securities exchange on qualification. [CITED: law.cornell.edu/cfr/text/17/230.251 (251(d)(2)(i)(C)-(D)), as shown in search results] The subscribe step shows "Your limit in this offering: $X" and warns if the commitment is higher; the request stores `{ exemption: 'Reg A Tier 2', accredited: false, income, netWorth (or revenue, netAssets), limitCents, overLimit }`.
  - **Exemption list change:** split `'Regulation A'` into `'Regulation A Tier 1'` and `'Regulation A Tier 2'`, plus a "Listed on a national securities exchange" checkbox for Tier 2. A plain `'Regulation A'` already on an offering (from intake) is treated as Tier 2 (it asks the questions), and the offering page asks the sponsor to choose a tier.
- **ERISA benefit plan investor** (asked for every equity offering; answers on the investor record and copied onto the request):
  1. Is the investor an employee benefit plan subject to Part 4 of Title I of ERISA?
  2. A plan subject to Section 4975 of the Code (including an **IRA**, prefilled "yes" for the IRA type, editable, and Keogh plans)?
  3. An entity whose underlying assets include plan assets because of plan investment (for example an insurance company general account or a fund with 25 percent or more benefit plan investors)? If yes: what percentage of its equity is held by benefit plan investors? It counts only to that extent.
  4. A governmental, church or non-US plan (not a benefit plan investor, but often subject to similar laws)?
  5. Is the investor (or an affiliate) a person with discretionary authority or control over the fund's assets, or who gives investment advice for a fee? Their interests are disregarded in the test.
  - Rule: participation is "significant" if, immediately after the most recent acquisition of any equity interest, benefit plan investors hold **25 percent or more of the value of any class of equity interests**. The value held by non-benefit-plan persons with discretionary authority or control, or who give investment advice for a fee, and their affiliates, is disregarded. [CITED: law.cornell.edu/cfr/text/29/2510.3-101 (f)(1); govinfo CFR 2012 edition] "Benefit plan investor" is defined by ERISA section 3(42): plans subject to Title I Part 4, plans subject to Code 4975, and entities whose assets include plan assets, counted only to the extent of their plan-investor percentage [CITED: same; 3(42) statutory text ASSUMED from training].

### Pattern 5: Derived sponsor figures (computed on render, never stored as counters)
```js
// 506(b): one count per investor per offering (a second subscription by the same purchaser is not a second purchaser)
const nonAccredited = (ws, o) => new Set(ws.requests.filter((r) => r.type === 'subscription' && r.offeringId === o.id
  && r.status !== 'rejected' && r.qual && r.qual.accredited === false && !r.qual.excluded501e).map((r) => r.investorId));
// split into accepted (approved) and pending for the panel: "12 of 35 (2 more pending)"

// ERISA per class: value basis = ledger capital balance where the offering has one, else commitment; label which
// pct = sum(value_i * bpiShare_i) / (classTotal - sum(value_j for controlling non-BPI j))
//   bpiShare_i = 1 for plans and IRAs, planPct/100 for plan-asset entities, 0 otherwise
// show the current % and the % if each pending subscription is accepted; mark >= 25% red
```
Classes come from `o.classes` (`structures.classOf` resolves an investor's class; console.js and structures.js:52-61). An offering with no classes is one class.

### Pattern 6: Server-mode transport of the tax form (least new code)
- `sendCompletion` (onboarding.js:1756-1834): add `taxEnvelope: clone(taxEnv)` to the payload and its `<id>-signed` blob to `files`.
- `cleanSubmission` (invitations.mjs): accept `body.taxEnvelope` (investor-only; any countersigner marked signed is reset, as `cleanEnvelope` does). Allow exactly `` `${taxEnv.id}-signed` `` as a PDF, and only for a completed envelope. Store and seal it like the agreement.
- Console `merge` (invitations.js:768+): import the tax envelope with the same id checks as `envelopeCheck`, and list the signed copy in `ws.docs` as `cat: 'Tax'`, `investors: [inv.id]`. Set `inv.taxForm`/`inv.taxCert` only for a new investor (an investor on file keeps theirs, as today).
- After a successful send, the investor's device deletes its copy of the tax PDF. The full TIN must not stay on a shared device; the code already wipes `tinLast4` and `taxCert` there (onboarding.js:1840).

### Anti-patterns to avoid
- **Drawing values over the page or rebuilding the form in HTML:** rejected by the owner.
- **Guessing field names from their order or from a third-party copy:** fill only from the Wave 0 map built against the bundled file, which is SHA-256 pinned.
- **Blocking the investor** for an unsigned form, a missing TIN or an unanswered status question: D-30 forbids it. Show the state to the sponsor instead ("W-9 not signed", "Status not answered").
- **Storing the full TIN on the investor record:** it lives only inside the signed PDF (sealed on the server). The record keeps the last four digits.
- **Storing a 35-counter or a percentage:** derive them every render from requests, so declines, withdrawals and corrections are always reflected.
- **Calling an unsigned form "on file":** `taxForm` must say signed or not signed.
- **Vendor or library names** in any investor or sponsor text (e.g. "pdf-lib", "XFA"). The record-check VENDORS regex from phase 5 must pass on the new screens and PDFs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The tax form layout | An HTML or drawn replica | The official IRS PDF with its AcroForm | Owner decision; exact form; perjury text sits right above the signature by construction |
| Signing, certificate, audit trail, hash, seal, Documents listing | A tax-only signing screen | `NS.esign.createFromPdf` + `embed` + `finishSigning` | Already legal-grade (phase 5) and tested |
| Field appearances for non-Latin names | Custom glyph drawing | `updateFieldAppearances(embeddedDejaVu)` with fontkit (already loaded) | pdf-lib's standard fonts only encode WinAnsi |
| Comb boxes (SSN 3-2-4, EIN 2-7) | Manual digit spacing | The PDF's own comb fields (MaxLen) filled with the digit groups | The form defines them; pdf-lib lays out comb fields [ASSUMED] |
| Transport and storage in server mode | A new endpoint | The existing `/v1/invite/complete` payload plus the vault | Already sealed, size-limited and allowlisted |
| Counting and percentages | Stored counters | Derived functions over `ws.requests` and the ledger | Always consistent after edits |

**Key insight:** The legal weight of an electronic W-9 or W-8 comes from the system around it: authentication, perjury text immediately before the signature, electronic signature as the final act, a record of access, and a printable copy on request. The portal already has every one of these through its e-signature record. The only new parts are the forms themselves and the questions.

## Electronic signature, retention and the original

- **W-9 (Announcement 98-27, reflected in the requester instructions):** a requester may run an electronic system for Forms W-9. The electronic signature must identify the payee and authenticate and verify the submission, and it must be the **final entry**. It must be made under penalties of perjury, and the perjury statement must contain the paper form's language, immediately following the certifications and immediately preceding the signature. The requester must be able to supply a **hard copy** to the IRS on request. "An electronic signature can be in any form that satisfies the foregoing requirements." [CITED: eitc.irs.gov/pub/irs-drop/a-98-27.pdf and requester instructions, as quoted in search results] The system must also ensure the information received is the information sent, and document all access that results in a submission [ASSUMED: wording from the current requester instructions, not opened].
- **W-8 series (Treas. Reg. 1.1441-1(e)(4)(iv)):** an electronic withholding certificate can be relied on if the system makes reasonably certain the person submitting is the person named, the form carries an electronic signature under penalties of perjury, it contains the same information as the paper form, and a hard copy can be supplied on IRS request [CITED: IRS Chief Counsel memo AM 2012-008 (irs.gov/pub/irs-counsel/am2012008.pdf) via search]. A typed name alone in the signature line, with nothing else showing it was signed electronically, is not sufficient. A sufficient block shows the name, a **date and time stamp and a statement that it was signed electronically** [CITED: KPMG FATCA report Jan 2017 via search; later rules T.D. 9890 referenced in the W-8BEN instructions, not opened, MEDIUM-LOW].
- **What the plan must therefore do:**
  - Stamp a short caption beside the signature on the form page itself: "Signed electronically <date> <time> UTC". This is in addition to the certificate page, so the form page stands alone.
  - Keep the official perjury text unaltered.
  - Make the signature the investor's last act on the form.
  - Record view, consent and sign events (already in the envelope events).
  - Offer the signed PDF for download to the investor and the sponsor (printable copy).
- **The original:** W-9 and W-8 forms are kept by the requester (the sponsor or fund) and are not filed with the IRS. The electronically signed PDF collected under such a system *is* the record; no wet-ink original is needed [ASSUMED: inference from Ann. 98-27 and 1.1441-1(e)(4)(iv)].
- **Retention:** keep for as long as the form may be relevant, and at least 4 years after the last payment or reporting it supports (a conservative reading). Secondary sources conflict between 3 years (the section 3406 account-opening rule) and 4 years [CITED: search results; LOW]. W-8: track `validUntil` = 31 December of the third calendar year after signing, and flag renewal [CITED: secondary sources]. The portal never deletes these automatically.

## Fields that can be pre-filled (from what onboarding already holds)

The "Field" column uses the printed line labels. The AcroForm names come from Wave 0.

| Form | Field (printed line) | Source in the portal | Notes |
|---|---|---|---|
| W-9 | 1 Name | `inv.title` (entity or trust) or the person's name (individual or joint) | Disregarded LLC: owner's name |
| W-9 | 2 Business / disregarded entity name | LLC name when disregarded | Question |
| W-9 | 3a Federal tax classification (checkboxes + LLC letter + Other text) | Type: individual -> Individual/sole proprietor; trust -> Trust/estate; entity -> question | Checkbox on-values are box-specific [CITED, LOW] |
| W-9 | 3b Foreign partners/owners/beneficiaries | Question (flow-throughs only) | New in Rev. 2024 |
| W-9 | 4 Exempt payee code / FATCA code | IRA -> 1 [ASSUMED]; otherwise empty, editable | |
| W-9 | 5 Address; 6 City, state, ZIP | `inv.address` split (placement.values regex) / `d.street`, `d.city`, `d.st`, `d.zip` | |
| W-9 | Requester's name and address (optional box) | Tenant (sponsor) name and address | Sponsor's own data |
| W-9 | 7 Account numbers (optional) | Offering name or investor id | Optional |
| W-9 | Part I SSN (3-2-4 comb) or EIN (2-7 comb) | TIN typed in the profile step, held in memory for the session only (`SECRET`), or typed again on the tax step | Never persisted outside the signed PDF |
| W-9 | Part II signature, date | Envelope signature + date fields at the signature line | [ASSUMED] no AcroForm fields exist for these (see below) |
| W-8BEN | 1 Name; 2 Country of citizenship; 3 Permanent residence (street, city/state/postal, country); 4 Mailing address; 5 US TIN; 6a FTIN / 6b not required; 7 Reference; 8 DOB (MM-DD-YYYY) | Contact name; `d.citizen`/country; address; TIN; `d.ftin`/`d.noFtin`; offering; `d.dob` | DOB format MM-DD-YYYY, not the app's `usDate` |
| W-8BEN | 9 Treaty country; 10 Special rates (article, %, income type, explanation) | `d.treaty`; questions | Partnership income is often not treaty-eligible; leave 10 to the investor |
| W-8BEN | Part III capacity checkbox, signature, date, print name | Checkbox: investor ticks; signature: envelope; date and print name: AcroForm text fields if they exist, else envelope fields | [ASSUMED] |
| W-8BEN-E | 1 Name; 2 Country of organization; 4 Chapter 3 status; 5 Chapter 4 status; 6 Permanent residence; 7 Mailing; 8 US TIN; 9a GIIN; 9b FTIN; 10 Reference; 14a/14b treaty and LOB; Parts for the chosen chapter 4 status (Active NFFE / Passive NFFE + Part XXIX owners); Part XXX signature, print name, date, capacity box | `inv.title`, `d.formation`, type, questions, address, TIN, `d.ftin`, `owner1/owner2` for substantial US owners | 8 pages; signature on the last page [ASSUMED] |

**Fields that cannot be filled programmatically, with the fallback (expected; confirm in Wave 0):**
1. **Signature lines on all three forms.** The IRS PDFs are not expected to carry signature AcroForm fields (they are paper-signature forms) [ASSUMED]. Fallback: an envelope signature field placed over the signature line, using geometry measured once per revision from the printed "Signature of U.S. person" / "Sign Here" text position (pdf.js text layer). The image is stamped by `stampFields`, the existing code.
2. **Date next to the W-9 signature.** If there is no AcroForm field, an envelope `date` field (auto-filled at signing). For W-8 forms, an AcroForm date field is filled at signing time in MM-DD-YYYY if it exists; otherwise an envelope text field with that format.
3. **Checkboxes whose on-value pdf-lib cannot resolve** (widgets without an `/AP /N` on-state) [ASSUMED risk]. Fallback: set the field's `/V` and the widget's `/AS` to the on-name read from the widget during Wave 0. If that still fails, an envelope checkbox field over the box, recorded in the map as `kind: 'overlay'`.
4. **Comb fields whose MaxLen pdf-lib rejects** (setText throws when text exceeds MaxLen). Fallback: strip non-digits and split into the defined groups before setting.
5. **XFA:** the forms are expected to be XFA-hybrid. `getForm()` drops the XFA and the AcroForm fills normally [CITED: activepieces PR #17112 via search, LOW]. Removing XFA is already done by `lockOwnFields`.

## Common Pitfalls

### Pitfall 1: An unsigned form reported as "on file"
**What goes wrong:** D-30 makes the investor signature optional, so `finishSigning` completes even with the signature empty. The console then says "W-9 on file" (audit.js:1022 counts `investor.taxForm`).
**How to avoid:** `taxCert.signed = !!signatureField.value`. The console shows "W-9 not signed" and the audit check counts only signed forms.
**Warning signs:** the audit "Tax forms on file" check passes for a record whose envelope signature value is ''.

### Pitfall 2: Full TIN lingering in the browser
**What goes wrong:** The signed PDF in IndexedDB holds the full SSN. In server mode it stays on a shared device after sending.
**How to avoid:** delete the tax PDF blobs after a confirmed send (alongside the existing wipe at onboarding.js:1840). Never put the TIN in `fl.d` (it is in `SECRET`).
**Warning signs:** `files().get('<taxenv>-signed')` still returns a blob after `ws.invite.sentAt` is set.

### Pitfall 3: Silent drop of the tax PDF by the server
**What goes wrong:** invitations.mjs drops unlisted file ids unread (line 255-259), so the console gets a W-9 envelope with no file.
**How to avoid:** add the taxEnvelope allowlist entry and a server test (server/test style).

### Pitfall 4: Flatten failures on IRS forms
**What goes wrong:** `form.flatten()` can throw on widgets without appearance streams, or a field references a font missing from `/DR` [ASSUMED from known pdf-lib issues]. esign.js deliberately avoids flattening ("flattening damages some files", line 895-898).
**How to avoid:** call `updateFieldAppearances(embeddedFont)` before `flatten()`. Because each form is one fixed, SHA-pinned file, the check script proves fill + flatten once per revision on all three files. If flatten still fails, fall back to `lockOwnFields` (fields kept, made read-only) and record it.

### Pitfall 5: Adobe "extended features" warning
**What goes wrong:** some IRS PDFs carry usage rights (`/Perms`). Editing them makes Adobe Reader warn the document was changed [ASSUMED].
**How to avoid:** delete `/Perms` from the catalog before saving. The check opens the output with pdf.js and pdftotext without errors.

### Pitfall 6: Non-Latin names on W-8 forms
**What goes wrong:** standard Helvetica cannot encode accented-plus or CJK characters, so setText or the appearance generation throws.
**How to avoid:** embed DejaVu Sans with fontkit for appearances (esign.js already fetches it). The check includes a name like "Zoë Müller-Łukasz".

### Pitfall 7: Treating plain "Regulation A" as having no limit
**What goes wrong:** offerings created from intake carry `'Regulation A'`, so no Tier 2 questions are asked.
**How to avoid:** treat an untiered Reg A as Tier 2 and prompt the sponsor to choose a tier.

### Pitfall 8: IRA and plan-asset entities not counted as benefit plan investors
**What goes wrong:** the 25 percent figure is understated because IRAs are Code 4975 plans.
**How to avoid:** prefill "yes" for the `ira` type, and count plan-asset entities at their stated percentage.

### Pitfall 9: The 25 percent test run on commitments when capital balances differ
**How to avoid:** use the ledger's capital balance where the offering has one, show which basis was used, and recompute after every acceptance, redemption or transfer.

### Pitfall 10: Status questions shown to an existing investor's new subscription skipped
**What goes wrong:** the existing-investor branch of `flowSteps` has no status step, but the status answers are per offering.
**How to avoid:** add the status step to both branches whenever the invited offering's exemption calls for it (or ERISA applies).

### Pitfall 11: Today's blocking validation left in place
**What goes wrong:** `validate('tax')` and `subAcc` block D-30-optional answers and non-accredited 506(b) or Reg A investors.
**How to avoid:** remove the blocks. The subscribe tick becomes exemption-aware: no accredited claim is required when the status step said "not accredited" under 506(b) or Reg A.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| W-9 Rev. Oct 2018 | W-9 Rev. March 2024 (line 3b for flow-throughs with foreign owners) | 2024-03-06 | Map line 3b; partnerships and trusts are asked |
| — | Draft W-9 Rev. June 2026 (digital asset broker box, exempt payee code 14) | Draft 2026-05; not final | Revision map must be swappable |
| Rule 506(b) "35 purchasers" | "...in offerings under this section in any 90-calendar-day period" | 2021 integration amendments [CITED: Cornell text vs 2018 govinfo text] | Count per offering; flag the 90-day window to the sponsor |
| Accredited investor list pre-2020 | Rule 501(a) as amended (professional certifications, knowledgeable employees, family offices, $5M-in-investments entities, spousal equivalent) | 2020-12-08 | Expand `ACCRED` for the 506(b) and Reg A questions |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | AcroForm field names follow `topmostSubform[0].Page1[0].f1_NN[0]` / `c1_N[n]`; W-8 forms similar | Pattern 1 | Map wrong; caught in Wave 0 by enumeration (no executor may write the map without it) |
| A2 | No signature AcroForm fields on the three forms; W-9 has no date field | Fields table | Minor: use the form's field instead of an overlay |
| A3 | pdf-lib API names and behavior (updateFieldAppearances, flatten, comb, XFA drop) | Patterns 1-2 | Fill code adjusts; proven by the checks on the fixed files |
| A4 | Official URLs irs.gov/pub/irs-pdf/fw9.pdf, fw8ben.pdf, fw8bene.pdf | Standard Stack | Owner downloads from irs.gov pages instead |
| A5 | IRA W-9 uses exempt payee code 1; custodians often sign their own | Pattern 3 | Investor edits; the upload route covers it |
| A6 | Joint account W-9 is for the holder whose SSN is given | Pattern 3 | Sponsor asks for a second form |
| A7 | W-8IMY / ECI / EXP rare for this portal's investors; upload route adequate | Pattern 3 | More foreign entity investors than expected; add later |
| A8 | Rule 502(b) information requirement when non-accredited purchasers present | Pattern 4 | Reminder wording only |
| A9 | ERISA 3(42) definition details; redemptions treated as acquisitions for re-testing | Pattern 4/5 | Percent shown at wrong times; recompute on every change avoids it |
| A10 | Retention 4 years conservative; W-8 validity to end of third calendar year | E-signature section | Sponsor policy wording |
| A11 | Electronic signature caption (date, time, "signed electronically") on the form page satisfies W-8 practice | E-signature section | Low; the certificate page adds the full trail |
| A12 | Adobe usage-rights `/Perms` present on IRS PDFs | Pitfall 5 | None if absent |
| A13 | 501(a) category list as amended 2020 | How it works today | Wording of the basis list |
| A14 | Value basis for ERISA percent (capital balance, else commitment) | Pattern 5 | Sponsor's counsel may prefer another basis; shown and labelled |

## Open Questions (for the owner, through the planner's checkpoint)

1. **OPEN (owner item a; blocks only plans 06-08 to 06-12).** **In-house versus outside service** (project rule). Recommendation: in-house (cost $0 per form, white-label, no third-party SSN exposure). Alternative: a hosted W-9/W-8 API at about $2-3 per form.
2. **RESOLVED by C-01 (warn the investor, flag the sponsor, never block).** **What happens when a commitment exceeds the Reg A Tier 2 limit, or a 506(b) subscription would be the 36th non-accredited purchaser?** Recommendation: warn the investor (Reg A) and flag the sponsor clearly on the request and in the offering panel. No hard block (D-30 and scope discipline); the sponsor declines at acceptance.
3. **RESOLVED by C-02 (per offering, with the 90-day note).** **Count the 35 per offering or per issuer across offerings?** The portal does not know which offerings share an issuer. Recommendation: per offering for its life (conservative for that offering), with a note about the 90-day window across the same issuer's offerings.
4. **RESOLVED by C-03 (managed edition unchanged this phase).** **Managed edition** (the non-invitation onboarding in onboarding.js with the substitute W-9 checkbox at the review step): leave it as is this phase, or apply the same forms? Recommendation: invitation flow only (the turnkey flow the owner named); the managed edition keeps its substitute certification.
5. **OPEN (owner item b; blocks only plans 06-08 to 06-12).** **Network access:** allow `www.irs.gov` for the build session, or the owner supplies the three PDFs (blocker for Wave 0).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | checks | yes | v22.23.4 | — |
| Playwright | browser checks | yes | global `/opt/node22/lib/node_modules/playwright` | — |
| pdf-lib / pdf.js / fontkit / DejaVu local copies | checks (CDN blocked) | yes | scratchpad `vendor/` (pdflib 1.17.1, pdfjs 3.11.174) | — |
| pdftotext | checking text in the output PDFs | yes | /usr/bin/pdftotext | pdf.js text layer |
| python3 http.server | serving the app for checks | yes | — | `http-server` (global) |
| **Official IRS PDFs** | the whole tax-form part | **no** (irs.gov blocked: 403 / ENOTFOUND) | — | **None in-session**: the owner allows www.irs.gov or uploads fw9.pdf, fw8ben.pdf, fw8bene.pdf |

**Missing dependencies with no fallback:** the official IRS PDFs (Wave 0 checkpoint).
**Missing with fallback:** none.

## Validation Architecture

### Test framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with Playwright (the phase 4/5 style: `.planning/phases/05-signed-record/checks/flow.js`, `record-check.js`; PASS/FAIL lines, failures listed first) and `node --test` for server/test |
| Config file | none; each check serves the repo with `python3 -m http.server <port>` and routes CDN requests to `VENDOR_DIR` |
| Quick run command | `node .planning/phases/06-*/checks/status-math.js` (pure functions, < 5 s) |
| Full suite command | `python3 -m http.server 8961 & node .planning/phases/06-*/checks/forms-flow.js && node .planning/phases/06-*/checks/console-eligibility.js && (cd server && node --test test/)` |

### Phase requirements -> test map (proposed IDs; the planner may rename)
| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| FORM-01 | US individual: W-9 PDF filled by field name (name, address, SSN combs, 3a), flattened (0 AcroForm fields left), signature image on page 1, "Signed electronically" caption, certificate appended, listed in Documents and the console | e2e | `node checks/forms-flow.js --case us-individual` | no, Wave 0 |
| FORM-02 | US LLC (partnership) with foreign partners: 3a LLC "P", 3b ticked; EIN combs | e2e | `--case us-llc` | no |
| FORM-03 | Foreign individual: W-8BEN with DOB MM-DD-YYYY, FTIN, treaty country, non-Latin name rendered | e2e | `--case foreign-individual` | no |
| FORM-04 | Foreign corporation, Active NFFE: W-8BEN-E lines 1, 2, 4, 5 and Part XXV, signature on the last page | e2e | `--case foreign-entity` | no |
| FORM-05 | Upload route (W-8IMY) stores the investor's file; the console shows "Uploaded W-8IMY, not reviewed" | e2e | `--case upload` | no |
| FORM-06 | Nothing mandatory: investor skips the signature; flow continues; the console shows "W-9 not signed"; the audit check counts it as missing | e2e | `--case unsigned` | no |
| FORM-07 | Edit after prefill: a changed answer before signing voids and rebuilds the envelope with the new value | e2e | `--case edit` | no |
| FORM-08 | Server mode: the tax PDF reaches the console through `/v1/invite/complete`; other ids are still dropped; the device copy is deleted after the send | integration | `cd server && node --test test/invitations-taxform.test.mjs` + `--case server` | no |
| FORM-09 | Bundled PDFs match the pinned SHA-256; the map covers every field enumerated (each is either mapped or listed as intentionally unused) | unit | `node checks/form-maps.js` | no |
| STAT-01 | 506(b): accredited/not accredited answers; count "N of 35" with accepted/pending split; one investor counted once; declined not counted | unit + e2e | `node checks/status-math.js`; `node checks/console-eligibility.js` | no |
| STAT-02 | Reg A Tier 2: limit = 10% of greater (person: income/net worth; entity: revenue/net assets); accredited or listed means no limit; over-limit warning and flag | unit + e2e | same | no |
| STAT-03 | ERISA: IRA prefilled as a benefit plan investor; plan-asset entity counted at its %; controlling persons disregarded; per-class %; ≥25% flagged; "if accepted" % | unit + e2e | same | no |
| WL-01 | No vendor or library names, and never the word "basic", in investor or sponsor screens and the generated PDFs (phase 5 VENDORS regex plus /\bbasic\b/i) | e2e | in every check | no |

The investor-facing result must also be checked by the owner on real forms. The planner adds an end-of-phase `checkpoint:human-verify` with the four signed PDFs and console screenshots, failures first.

### Sampling rate
- **Per task commit:** `node checks/status-math.js` and `node checks/form-maps.js`
- **Per wave merge:** the full suite above
- **Phase gate:** full suite green, then the owner's check of the real signed PDFs before `/gsd-verify-work`

### Wave 0 gaps
- [ ] Official PDFs in `assets/forms/` with SHA-256 recorded (blocked: owner or network)
- [ ] `checks/enumerate-fields.js`: field list plus a rendered page with each widget outlined and named (evidence for the maps)
- [ ] `checks/lib.js`: reuse phase 5 `flow.js` helpers (setupPortal, createInvitation, walk), extended with tax-step and status-step answers
- [ ] `server/test/invitations-taxform.test.mjs`

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (existing) | Invitation token plus created login; the signer is the authenticated invitee (the basis of the e-signature's validity) |
| V3 Session Management | no change | — |
| V4 Access Control | yes | Server allowlist: only `<taxEnvelope.id>-signed` as a PDF; the console imports it for that investor only; the Documents listing is rebuilt server-side for `investors: [rec.investorId]` |
| V5 Input Validation | yes | TIN digits only and comb lengths; country from the fixed list; numeric income, net worth and percentage fields bounded; every displayed value escaped with `h()` |
| V6 Stored Cryptography | yes | Server vault AES-256-GCM (`DATA_KEY`) for the signed PDF; SHA-256 seal on the record; no new crypto |
| V8 Data Protection | yes | The full TIN exists only inside the signed PDF; the device copy is deleted after a server send; the record keeps the last four; the TIN is never in logs or audit details |

### Known threat patterns
| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Investor's browser sends a forged "completed" tax envelope with someone else's file | Spoofing / Tampering | Server id pattern checks; investor-only envelope; the file must be this envelope's `-signed` copy |
| SSN left on a shared computer | Information disclosure | Delete the blobs after send; never in `fl.d` |
| Swapped or altered form PDF in assets | Tampering | SHA-256 pin checked before every fill |
| Vendor names leaking (white label) | — | VENDORS regex check on screens and PDFs |
| Investor misstates accreditation, income or plan status | Repudiation | Self-certification under the rules' reliance provisions; answers timestamped in the audit log and on the request |

## Sources

### Primary (in-repo, read this session; HIGH)
- assets/js/onboarding.js (lines 380-404, 690-1230, 1280-1480, 1540-1700, 1738-1845, 1923-1993)
- assets/js/esign.js (25-44, 145, 440-670, 852-1160, 2209-2232, 2660-2800, 3798)
- assets/js/console.js (378-545, 2068-2110, 2935-2960); assets/js/data.js (106-114); assets/js/tenants.js (61); assets/js/placement.js (2830-2857); assets/js/structures.js (45-61); assets/js/operations.js (235-249); assets/js/invitations.js (768-852)
- server/lib/invitations.mjs (160-300); server/lib/vault.mjs (1-40)
- .planning/phases/01.4-.../01.4-RESUME.md (94-130); 01.4-CONTEXT.md (D-30, D-46); .planning/PROJECT.md; phase 4/5 check harnesses

### Secondary (MEDIUM, primary-source text as shown in search results)
- [17 CFR 230.506 (Cornell LII)](https://www.law.cornell.edu/cfr/text/17/230.506); [eCFR 230.506](https://www.ecfr.gov/current/title-17/chapter-II/part-230/subject-group-ECFR6e651a4c86c0174/section-230.506); [govinfo CFR 230.501](https://www.govinfo.gov/content/pkg/CFR-2022-title17-vol3/pdf/CFR-2022-title17-vol3-sec230-501.pdf)
- [17 CFR 230.251 (Cornell LII)](https://www.law.cornell.edu/cfr/text/17/230.251); [SEC Reg A guidance](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/regulation-guidance-issuers)
- [29 CFR 2510.3-101 (Cornell LII)](https://www.law.cornell.edu/cfr/text/29/2510.3-101); [govinfo CFR 2012 edition](https://www.govinfo.gov/content/pkg/CFR-2012-title29-vol9/pdf/CFR-2012-title29-vol9-sec2510-3-101.pdf); [DOL AO 2005-19A](https://www.dol.gov/sites/dolgov/files/EBSA/about-ebsa/our-activities/resource-center/advisory-opinions/2005-19a.pdf)
- [Announcement 98-27](https://www.eitc.irs.gov/pub/irs-drop/a-98-27.pdf); [Announcement 2001-91](https://www.stayexempt.irs.gov/pub/irs-drop/a-01-91.pdf); [IRS Chief Counsel AM 2012-008](https://www.irs.gov/pub/irs-counsel/am2012008.pdf)
- [Draft Form W-9 (Rev. June 2026)](https://www.irs.gov/pub/irs-dft/fw9--dft.pdf); [EY on W-9 Rev. March 2024](https://taxnews.ey.com/news/2024-0584-irs-finalizes-revised-form-w-9-with-new-requirement-for-flow-through-entities); [KPMG on the June 2026 draft](https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2026/051426-irs-updated-draft-version-form-w9.pdf); [Comply Exchange on the January 2026 draft](https://www.complyexchange.com/post/irs-releases-draft-form-w-9-rev-january-2026)
- [Federal Register 85 FR 64234 (accredited investor amendments)](https://www.govinfo.gov/content/pkg/FR-2020-10-09/html/2020-19189.htm)

### Tertiary (LOW, search only; validate)
- W-9 field-name pattern: [Apify PDF form filler](https://apify.com/ely_source/pdf-form-filler), [intl-spectrum](http://www.intl-spectrum.com/Article/r858/Populating_PDF_Forms_with_MultiValue_Data), [activepieces PR #17112 (XFA)](https://github.com/activepieces/activepieces/pull/17112), [DocSpring](https://docspring.com/blog/posts/best-pdf-filling-apis/), [dev.to](https://dev.to/david_benzaken_1cce7fd85/how-to-autofill-pdf-forms-with-ai-25mh)
- W-8 electronic signature practice: [KPMG FATCA regs report](https://assets.kpmg.com/content/dam/kpmg/us/pdf/2017/01/tnf-report-fatca-regs-jan16-2017.pdf); [Gunster](https://gunster.com/alerts/financial-institutions-are-you-ready-to-receive-w-8-forms-electronically/)
- Vendors: [TaxBandits pricing](https://www.taxbandits.com/pricing-comparison/), [TaxBandits W-9/W-8 API](https://developer.taxbandits.com/docs/2.0/FormW9W8/Overview), [Avalara 1099 & W-9 pricing](https://www.avalara.com/us/en/products/1099/pricing.html), [Tax1099 pricing](https://guide.tax1099.com/pricing_information.htm)
- Retention and validity: [iofm W-8BEN expiration](https://iofm.com/ask-the-expert/w-8ben-expiration), [omnivoo](https://www.omnivoo.com/blog/w-8ben-expiration-when-to-recollect), [businessmanagementdaily](https://businessmanagementdaily.com/16284/backup-withholding-required-even-after-w-9s-are-tossed)

## Metadata

**Confidence breakdown:**
- Integration with existing code: HIGH (every cited line read this session)
- Standard stack: HIGH for pdf-lib/esign reuse; LOW for IRS field names (not enumerable here)
- Legal rules: MEDIUM (primary text through search snippets; eCFR and irs.gov unreachable)
- Outside services: LOW-MEDIUM (vendor pages through search)
- Pitfalls: MEDIUM

**Research date:** 2026-11-15
**Valid until:** 2026-12-15. Re-check sooner if the IRS finalizes the June 2026 W-9.
