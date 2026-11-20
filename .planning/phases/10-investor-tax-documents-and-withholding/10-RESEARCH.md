# Phase 10: Investor tax documents and withholding - Research

**Researched:** 2026-11-19
**Domain:** Schedule K-1 delivery, Forms 1099-INT and 1099-DIV, Form 1042-S, IRS e-filing (IRIS), backup and foreign withholding at a distribution
**Confidence:** HIGH for what the IRS requires (current IRS forms, instructions and publications were downloaded from www.irs.gov and read this session). HIGH for what the portal holds today (files read at the lines cited). MEDIUM for splitting a combined K-1 file (measured, but only on a file made from the official IRS form). LOW for every outside price (no vendor site could be read).

## What could not be confirmed (read this first)

1. **No vendor price was read from a vendor's own page.** Every tax-filing and K-1 service site tried is outside this session's network (the proxy answered 403; WebFetch answered ENOTFOUND): www.tax1099.com, www.taxbandits.com, www.track1099.com, www.avalara.com, www.efile4biz.com, www.1099online.com, k1x.io, www.yearli.com, www.1099pro.com, www.complyexchange.com, taina.tech, www.withabound.com. The prices under "Outside services" come from search-engine summaries and are unconfirmed. No K-1 delivery vendor publishes a price that any search result showed.
2. **Splitting a combined K-1 file was measured only on a file built from the official IRS form.** 12 of 12 K-1s were found, cut at the right pages and matched to the right investor, on a 27-page file I made by filling the IRS's 2025 Schedule K-1 (two variants). No file produced by a CPA's tax software was available, so how well this works on real files is unmeasured. A scanned file (pictures, no text) cannot be read by these tools at all. The owner must supply real combined K-1 files before anything is claimed.
3. **The header row of the IRS's upload file for IRIS was not read.** The IRS publishes the column-by-column rules (read), but the template file itself is downloaded from inside the IRIS site after sign-in, and the IRS says only its own template may be used. The rules for tax year 2026 are not published yet; the newest are for tax year 2025 (updated January 14, 2026). The exact header text, and whether money is written with cents, must be taken from a real template.
4. **The XML schema for machine-to-machine filing with IRIS was not read.** The IRS hands it out only through a secure mailbox to approved software developers.
5. **www.ecfr.gov is blocked, so no regulation text was read.** Every rule below is quoted from an IRS form instruction, publication or revenue procedure that restates it. Where only the regulation would settle a point, the point is tagged [ASSUMED].
6. **www.eftps.gov is blocked.** That deposits are made there (or by IRS Direct Pay) at no charge is quoted from IRS Publication 515 and the Form 945 instructions, not from the site.
7. **Documents published in the console do not reach an investor on another device today.** They are kept in the publishing browser's own storage (portal.js:1063 says so on screen). "Delivers each K-1 to its investor" (D-01) is therefore only true inside one browser until the server carries the file. This is the largest gap between D-01 and the code.
8. **The portal does not keep any investor's full taxpayer number** (phase 06 decision; only the last four digits are kept). A 1099 filed with the IRS needs all nine digits. The number is printed on the signed W-9 the portal holds, and can be read back from it; that step is designed below, not built or measured.

Hosts to allow for a follow-up pass: www.ecfr.gov, www.eftps.gov, and any vendor the owner wants priced.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: K-1s by import and deliver. The sponsor's CPA prepares them; the portal takes one combined file (or separate files), splits it by investor, delivers each K-1 to its investor in the portal and tracks opens. The portal does not prepare K-1s.
- D-02: 1099s are produced by the portal only if they can be 100% right. The year-end character split (ordinary, qualified, capital gain, return of capital) is entered or confirmed by the sponsor or the CPA; the portal fills, validates, delivers and e-files (the IRS's IRIS). 1099-INT can be fully automatic.
- D-03: 1042-S for foreign investors.
- D-04: withholding on distributions: backup withholding 24%, foreign 30% or treaty rate, partnership withholding for foreign partners, FIRPTA.
- D-05: look into tax-document APIs, and a CPA partner receiving K-1-ready packages from sponsors who opt in. The package itself is built in phase 11 (fund accounting), not here.
- Carried: outside-API check first (cost, accuracy, speed, trade-offs; the owner has no budget for monthly fees, so a $0 path comes first); white label; lean screens (only what the law or the task needs); D-30; .planning/AUTOPILOT.md conditions. The W-9 and W-8 data collected in phase 06 (taxforms.js, taxmaps.js, the investor's tax record) is the source for names, TINs, classifications and treaty claims.
- Not in scope: the in-house subscription-agreement and PPM reader (D-33). Splitting a K-1 file by investor is its own small job on a standard IRS form and must end with the sponsor confirming each match before anything is delivered: a K-1 delivered to the wrong investor is a disclosure of tax data.

### Claude's Discretion
CONTEXT.md has no such section. Everything not fixed above (data model, module layout, plan split, which pieces are optional) is recommended below.

### Deferred Ideas (OUT OF SCOPE)
CONTEXT.md has no such section. Out of scope by the decisions themselves: preparing K-1s; the CPA year-end package (phase 11); the in-house reader (D-33).
</user_constraints>

<phase_requirements>
## Phase Requirements

ROADMAP.md gives phase 10 no requirement ids. Proposed ids for the planner (rename freely). "Rule" names what makes the piece necessary; where the only reason is the owner's decision, it says so.

| ID | Description | Rule or reason | Research support |
|----|-------------|----------------|------------------|
| TAX-01 | A combined PDF (or several files) is imported and cut into one package per K-1: the K-1 page and the pages that follow it. Nothing is delivered at import. | D-01 | "Splitting a combined K-1 file" |
| TAX-02 | Each package gets a proposed investor from item E's last four digits and item F's name, with the basis shown ("number and name", "number only", "name only"). An ambiguous or unmatched package is left unassigned. A file with no readable text goes to assignment by hand. | D-01; the task cannot work without it | Same section, measurement |
| TAX-03 | The sponsor confirms every match, one at a time, seeing the K-1's own Part II beside the investor's record. Nothing can be delivered unconfirmed. Each confirmation is logged with who and when. An investor in the fund with no K-1, and a K-1 with no investor, are both listed. | CONTEXT.md "must end with the sponsor confirming each match"; a wrong match discloses tax data | "The confirmation step" |
| TAX-04 | A confirmed K-1 appears only in that investor's portal, with the notice the IRS words require; an investor who has not consented is listed for paper; a corrected K-1 replaces the earlier one and is notified again. | Rev. Proc. 2012-17 sections 4, 7, 8, 10 | "Electronic delivery: consent, notice, access" |
| TAX-05 | Opens are recorded (first open, count) and shown to the sponsor. | D-01 only; no IRS rule asks for it | Flagged optional in law |
| TAX-06 | A consent to receive tax documents electronically, separate from the general one, never mandatory, with the disclosures the IRS lists, withdrawable, with the access period kept. | Rev. Proc. 2012-17 sections 4, 5, 9; Publication 1179 section 4.6 | Same section, gap table |
| TAX-07 | Each offering carries a tax reporting type the sponsor or CPA sets once (K-1, 1099-INT, 1099-DIV, other). No 1099 screen, and no backup withholding, is offered until it is set. | The portal cannot decide a vehicle's tax classification; Publication 1099 part B forbids repeating K-1 income on a 1099 | "Which document applies to which fund" |
| TAX-08 | 1099-INT: box 1 and box 4 come from the portal's own recorded payments; every other box stays empty; each investor left out is listed with the reason; conditions the portal cannot handle stop it with "ask your CPA". The sponsor confirms each total before filing. | Instructions for Forms 1099-INT and 1099-OID; D-02 | "1099s: which boxes" |
| TAX-09 | 1099-DIV: built only from a split the sponsor or CPA enters or confirms for each distribution; the portal checks the arithmetic and never proposes a split. | D-02; Instructions for Form 1099-DIV | Same section |
| TAX-10 | The payee's name, address and number come from the W-9 on file. The nine digits are never stored: they are read from the signed form (or typed), checked against the last four on record, used, and dropped. No signed W-9: no form for that investor, and the screen says why. | Phase 06 decision T-06-35; Publication 1099 part J | "Names and taxpayer numbers" |
| TAX-11 | The recipient's copy is the official form's Copy B, filled and flattened, with the number truncated, delivered through the same consent, notice and access rules. | The IRS notice on the form; Publication 1099 part M; Publication 1179 section 4.6 | "The recipient's copy" |
| TAX-12 | A file for the IRS's IRIS site per form type and tax year that meets the IRS's published column rules, downloaded by the sponsor, who uploads it; the receipt number and date are recorded. Blocked from being called right until its header is pinned from a real IRS template. | Publication 1099 part F (10 or more returns must be e-filed; IRIS is the only system from tax year 2026) | "IRIS" |
| TAX-13 | Forms 1042-S and 8805 prepared by the CPA are delivered through the same import, confirm and deliver flow; the CPA gets a worksheet of each foreign investor's W-8 facts and the amounts paid and withheld. | D-03; Instructions for Form 1042-S | "1042-S and Form 1042" |
| TAX-14 | A distribution can carry amounts withheld per investor: gross, withheld by kind, net. The ACH file pays the net. The investor sees all three. Per-investor amounts of a paid distribution are stored, not recomputed. | D-04; without stored amounts no 1099 figure is reliable | "Withholding at the distribution" |
| TAX-15 | Backup withholding at 24% is proposed only for an offering set to 1099-INT or 1099-DIV, only on the conditions the IRS lists, and only after the sponsor confirms each line. Never on a partnership's distributions. | Publication 1099 part N | Same section |
| TAX-16 | For a foreign payee the portal checks the W-8 is signed and not expired, proposes 30% on the amount the sponsor enters as subject to withholding, and uses a lower rate only when the sponsor enters it. Partnership withholding on business income, real property rules, FATCA and state withholding show "ask your CPA" and take only an entered figure. | Publication 515; Instructions for Forms 8804, 8805 and 8813; Instructions for Form 8288 | Same section, stop list |
| TAX-17 | A record of tax withheld: by kind, by investor, marked as deposited by the sponsor (date and confirmation number). The portal never moves tax money. | Form 945 and Form 1042 instructions (the withholder must deposit); D-04 | "Deposits" |
| TAX-18 | Everything above except delivery to another device and email works with no server, in the sandboxed frame at 390x844 and 1280x800, with no network call; the managed edition is unchanged; no vendor or library name on any screen. | AUTOPILOT.md | "With and without a server" |
</phase_requirements>

## Summary

Most private funds are partnerships. A partnership's investors get a Schedule K-1 and nothing else from this list: the IRS says income reported on a K-1 "must not be repeated on Forms 1099", and backup withholding applies only to payments reportable on a 1099. So for the common case the whole phase is one job: take the CPA's K-1 file, cut it by investor, have the sponsor confirm each match, post each K-1 to its investor with the notice and consent the IRS requires, and record opens. That is D-01, and it needs no calculation at all.

1099s apply only when investors hold something other than a partnership interest: notes that pay interest (1099-INT), or shares of a corporation or REIT (1099-DIV). The portal can fill a 1099-INT's interest and withholding boxes from its own payment records once the sponsor confirms each total. It can never work out a 1099-DIV split; it can only carry one the CPA confirms. E-filing costs nothing: the IRS's IRIS site takes an upload file the portal can build, the same pattern as the ACH file. From tax year 2026, IRIS is the only system the IRS accepts. The sponsor needs a free code from the IRS that can take 45 days to arrive.

Withholding is where the owner's list (D-04) and the law part ways. Of the four items, only one is applied at a distribution by a mechanical rule: backup withholding at 24%, and only on interest or dividends, never on a partnership's distributions. Withholding on a foreign investor's share needs figures only the CPA has (how much of the distribution is U.S.-source income; whether an exemption applies). Partnership withholding on business income is not tied to distributions at all: it is four payments a year based on taxable income. The real-property rule (FIRPTA) is met by that same partnership withholding for a domestic partnership. The portal's honest job is to record what the sponsor or CPA decides, pay the net, show the investor, and keep the totals for the forms. It must stop and say "ask your CPA" for the rest.

**Primary recommendation:** Build one import-confirm-deliver path for any tax document a CPA produces (K-1 first; 8805 and 1042-S ride on it), one small record of withholding on a distribution, and the 1099-INT from recorded payments with a sponsor-uploaded IRIS file. Leave 1099-DIV as a confirmed-figures form and leave every tax determination with the CPA.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|------------|--------------|----------------|-----------|
| Reading and cutting a K-1 file, proposing matches | Browser | - | Works in the preview with no server; the file never has to leave the sponsor's device to be split |
| Confirming matches | Browser (console) | - | A person's decision; logged in the change log |
| Posting a document to one investor | Browser record (`ws.docs`) | Server (carries the file to the investor's own device, sends the email) | Today's store is one browser; real delivery needs the server |
| Recording an open | Browser (same-browser preview) | Server (when the investor is on another device) | The opening device is the only one that knows |
| Consent to electronic tax documents | Browser (investor's screen), kept on the investor record | Server (when given on another device) | Same path as the existing consent |
| 1099 figures, checks, recipient copy, IRIS file | Browser (pure modules) | - | No secrets except the taxpayer number, which stays in memory |
| Filing with the IRS | The sponsor, on the IRS site | - | $0; no code or key held by the portal |
| Withholding on a distribution, net ACH file | Browser | - | Same place the distribution is built today |
| Depositing withheld tax | The sponsor, at the Treasury's payment site | - | The portal never holds money |
| Form data (official PDFs) | Static script files | - | No fetch in the preview frame (forms-data.js pattern) |

## Which document applies to which fund

The portal cannot tell from its own data how a vehicle is taxed. `offering.type` is a label (for example `'Private credit'`), and the sample data assumes a credit fund gives a 1099-INT (data.js:614), which is wrong whenever the credit fund is a partnership. **One setting per offering, set by the sponsor or the CPA, decides everything else in this phase.**

| Reporting type | When | Investor gets | Filed by | 1099 screens | Backup withholding |
|---|---|---|---|---|---|
| Partnership | Investors are partners or members of an LLC taxed as a partnership | Schedule K-1 (and Form 8805 or 1042-S if foreign) | The CPA | No | No |
| Notes | Investors hold notes or other debt of the issuer | Form 1099-INT (1042-S if foreign) | The portal builds, the sponsor files | 1099-INT | Yes, where the IRS conditions are met |
| Corporation or REIT | Investors hold shares | Form 1099-DIV (1042-S if foreign) | The portal builds from the CPA's split, the sponsor files | 1099-DIV | Yes, where the IRS conditions are met |
| Other | Grantor trust (for example a Delaware Statutory Trust), anything else | Whatever the CPA produces | The CPA | No | Ask your CPA |

Source for the partnership row [VERIFIED: Publication 1099 (2026), part B]:

DATA_q7Rk2mVx_START
The income information you report on the following forms must not be repeated on Forms 1099 or W-2G. [...] Schedule K-1 or K-3 (Form 1065), reporting distributive shares to members of a partnership.
DATA_q7Rk2mVx_END

The "Other" row matters: a trust's tax letter, a K-1 from a Form 1041 or 1120-S, a Form 8805, a 1042-S made by the CPA are all "a file the CPA made for one investor". The import-confirm-deliver path should take a document kind and a tax year, not be built for K-1 alone. Automatic matching is K-1 (Form 1065) only in this phase; other kinds are assigned by hand or by the investor id in the file name, which the Documents page already does (operations.js:502-506).

## What the law requires of the fund, by document

Dates are for tax year 2026 (calendar year). Weekday rolls were computed here, not read. [VERIFIED for every rule: the document named; dates of the documents are under Sources]

| Document | Who must act | To the investor by | To the IRS by | How it may be delivered | Keep |
|---|---|---|---|---|---|
| Schedule K-1 (Form 1065) | The partnership (the CPA prepares) | The return's due date: March 15, 2027; later if the return is extended | With Form 1065 | Paper, or electronically under Rev. Proc. 2012-17 with consent | A copy with the return; the K-1 stays on the site for 12 months after the tax year ends or 6 months after it was issued, whichever is later |
| Form 1099-INT | The payer of the interest (the issuer of the notes) | January 31; in 2027 that is a Sunday, so February 1, 2027 | March 31, 2027 if e-filed (February 28 on paper) | Copy B on paper, or electronically under Publication 1179 section 4.6 with consent; posted through October 15 | Copies, or the ability to rebuild the data, for 3 years from the due date; 4 years if tax was withheld |
| Form 1099-DIV | The corporation paying the distribution | Same as 1099-INT | Same | Same | Same |
| Form 1042-S | The withholding agent (the fund) | March 15, 2027 | March 15, 2027 | Paper, or electronically under Publication 1179 section 4.6 | 3 years after the due date |
| Form 1042 | The withholding agent | - | March 15, 2027 | - | - |
| Forms 8804 and 8805 | A partnership with business income allocable to a foreign partner | Form 8805 to each foreign partner | March 15, 2027; payments on the 15th of the 4th, 6th, 9th and 12th months | Not read for 8805 electronic delivery [ASSUMED: treat as paper unless the CPA says otherwise] | Withholding certificates as long as they may matter |
| Form 945 | Whoever withheld backup withholding | - | February 1, 2027 | - | 4 years (via the 1099 rule) |

Other facts the plans need:
- **Who must e-file:** anyone required to file 10 or more information returns of all kinds in the year; the count is across form types. [VERIFIED: Publication 1099 (2026) part F] A fund with nine or fewer may file on paper, but only on the IRS's printed red forms: the downloaded Copy A must not be filed. [VERIFIED: notice on Form 1099-INT] E-filing is the simpler route for everyone.
- **From tax year 2026 IRIS is the only e-filing system** for 1099s and 1042-S; the older system (FIRE) is shut. [VERIFIED: Publication 1099 (2026) "What's New"; Publication 5717 (Rev. 9-2026) section 1.1; Instructions for Form 1042-S (2026)]
- **Thresholds:** 1099-INT for $10 or more of interest on notes in registered form or of a type offered to the public; $2,000 (raised from $600 for tax years after 2025, indexed from 2027) for other business interest; any amount if backup withholding was taken. 1099-DIV for $10 or more; $2,000 for liquidations. [VERIFIED: Instructions for Forms 1099-INT and 1099-OID (Rev. January 2024); Publication 1099 (2026) "What's New" and Guide to Information Returns] The 1099-INT instructions still print $600; Publication 1099 is the newer document.
- **Payees no 1099 goes to:** a corporation, a tax-exempt organization, an IRA, and others; and a foreign payee (who gets a 1042-S instead). [VERIFIED: Instructions for Forms 1099-INT and 1099-OID, "Exempt recipients"; Instructions for Form 1099-DIV, "Exceptions"]
- **Penalties** for a statement not furnished, late, or wrong, for returns due in 2027: $60 if corrected within 30 days, $130 through August 1, $340 after; $690 for intentional disregard. [VERIFIED: irs.gov/payments/information-return-penalties] A K-1 not furnished: $340 each. [VERIFIED: Instructions for Form 1065 (2025)] A K-1 delivered electronically without meeting Rev. Proc. 2012-17 "may be deemed" not furnished. [VERIFIED: Rev. Proc. 2012-17 section 12]
- **Extensions:** Form 8809 gives 30 more days to file 1099s and 1042-S; Form 15397 up to 30 more days to furnish copies; both can be sent through IRIS. Form 7004 extends Form 1065 (and with it the K-1 date). [VERIFIED: Publication 1099 (2026) part C; Instructions for Form 1065 (2025)] The length of the Form 7004 extension (six months, to September 15) was not read. [ASSUMED]

## Electronic delivery: consent, notice, access

This is what makes "deliver in the portal" count as delivery in law. Two IRS documents, nearly the same rules.

| Rule | K-1 (Rev. Proc. 2012-17, effective February 13, 2012) | 1099 and 1042-S (Publication 1179, Rev. Proc. 2026-18, section 4.6; Publication 1099 (2026) part M) |
|---|---|---|
| Consent | Affirmative; made electronically "in any manner that reasonably demonstrates that the recipient can access" the document in the format used (section 4.01) | Affirmative; made electronically "in a way that shows" the recipient can access the format |
| No consent, or withdrawn | Paper (sections 5.02, 10) | Paper |
| Disclosures before consent | Paper if no consent; scope and duration; how to get a paper copy afterwards and whether asking counts as withdrawing; how to withdraw (a named person or department with mailing address, phone and email), when it takes effect, that it is confirmed in writing, that it does not undo earlier deliveries; when electronic delivery ends; how to update contact details; hardware and software needed, the date the document leaves the site, and that it may have to be printed and attached to a return (sections 5.02 to 5.08) | The same list without the last sentence |
| Notice | Required when posted to a site; by mail, email or in person; says how to access and print; must carry, in capital letters, the words below; in the subject line if emailed (section 7.01) | "Inform the recipient, electronically or by mail, of the posting and how to access and print the statement" |
| Email bounces | Paper notice within 30 days (section 7.02) | See Regulations section 31.6051-1(j) [not read] |
| Corrected document | Delivered or notified within 30 days (section 8) | Not read |
| Access period | 12 months after the tax year ends, or 6 months after issue, whichever is later (section 9) | Through October 15 of the year it is furnished |
| New consent needed | When a hardware or software change creates a material risk the recipient cannot access it (section 4.03) | After new hardware or software is put into service |

The words the K-1 notice must carry [VERIFIED: Rev. Proc. 2012-17 section 7.01]:

DATA_h3Np9sLe_START
IMPORTANT TAX RETURN DOCUMENT AVAILABLE
DATA_h3Np9sLe_END

**What the portal has today and what is missing** [VERIFIED: onboarding.js:1524-1536, 2716-2721; portal.js:1172]

| Needed | Today | Gap |
|---|---|---|
| A consent that names tax documents | One tick box: "I consent to receive statements, tax documents and notices electronically through this portal. I can withdraw consent at any time by contacting ..." stored as `i.edelivery` (true or false) and `i.esignConsent = { at, scope }` | No scope or duration, no statement of when delivery ends, no access-until date, no "may need to be printed and attached", no statement of whether a paper request withdraws consent, no confirmation of a withdrawal |
| Optional | With the firm setting on, the flow refuses to continue without it: `'Electronic delivery is required for this portal.'` (onboarding.js:538, 2572) | The IRS rules assume paper when there is no consent. A forced tick is weak evidence of consent, and D-30 says nothing is mandatory for investors |
| Withdrawal | Text says to contact the team | No record, no effect on delivery |
| Notice with the required words | The documents notice template (data.js:304) | Subject line is the general one |
| Access period | None | Nothing stops a document being removed early |

**Recommendation:** one short, separate consent for tax documents, shown the first time a tax document is waiting (or in onboarding where the sponsor wants it), never required. It records the date and the exact text agreed to. An investor without it appears on a "send on paper" list for the sponsor; the portal does not mail anything. Withdrawal is one control on the investor's Account page, recorded and confirmed on screen. Because the investor gives the consent inside the same portal that will show the PDF, it matches the revenue procedure's own third example (a secure webpage that delivers the K-1 in the same format as the consent). [VERIFIED: Rev. Proc. 2012-17 section 4.04 example 3]

**Opens (TAX-05):** neither document asks for proof that the investor opened anything; posting, notice and consent are what count. Recording opens is the owner's decision in D-01 and useful to the sponsor; it is optional in law.

## Splitting a combined K-1 file

### The form
[VERIFIED: the official 2025 Schedule K-1 (Form 1065), irs.gov/pub/irs-pdf/f1065sk1.pdf, one page, 612 x 792 points, 137 fields, measured with pdftotext and pypdf this session; sha256 `66098d4d48537ce2dac1f093d6351567957896e5843d8c524823b380068f6547`]

| What | Where on the page (points from the top left) | Field in the IRS file |
|---|---|---|
| The form's code `651123` | x 524.2 to 576.0, y 23.5 to 36.2 | printed |
| "Schedule K-1" and "(Form 1065)" | x 36, y 46.5 to 70.4 | printed |
| Part I item A, partnership's EIN | field top y 168 | `topmostSubform[0].Page1[0].LeftCol[0].f1_6[0]` |
| Part I item B, partnership's name and address | field top y 192 | `...LeftCol[0].f1_7[0]` |
| Part II item E label, "Partner's SSN or TIN" | y 267.3 to 275.5 | printed |
| Item E value | field top y 276, x 36 | `...LeftCol[0].f1_9[0]` |
| Part II item F label, "Name, address, city, state, and ZIP code for partner entered in E" | y 291.3 to 299.5 | printed |
| Item F value | field top y 300, x 38 | `...LeftCol[0].f1_10[0]` |
| Item G label, "General partner or LLC member-manager" | y 338.2 | printed |

A K-1 a CPA's software prints is a "substitute" form. The IRS requires the copy given to the partner to keep the same look [VERIFIED: Publication 1167 (Rev. Proc. 2026-31, October 2026) section 7.1]: the six-digit code `651123` in the upper right, every line of the official form, the name, address and number of both the partnership and the partner, and the year, form number and name "in substantially the same position and format as shown on the official IRS schedule". That is why a first-page detector built on the printed words is sound. It does not promise that every tax program puts the partner's name at the same coordinates, so the reader must find the item E and item F labels on each page and read what lies between them, not use fixed coordinates.

What items E and F hold [VERIFIED: Instructions for Form 1065 (2025), "Items E and F"]:
- An individual's SSN or ITIN; any other partner's EIN.
- **An IRA: the custodian's number**, not the person's. Two IRAs at one custodian show the same number.
- **A disregarded LLC: the owner's number and the owner's name and address**, not the LLC's. The account in the portal is in the LLC's name.
- A foreign partner may have no U.S. number.
- On the partner's copy the number may be truncated to its last four digits (`***-**-1234` or `XXX-XX-1234`).

The portal's record of the last four digits follows the same rule as item E: for a disregarded LLC it keeps the last four of the owner's number that the W-9 carries (onboarding.js:2354-2356). So the last four digits match even when the name does not.

### The measurement
[VERIFIED: run this session; script and both test files under SCRATCH/r10/]

A 27-page file was built from the official form with the portal's own writer library (pdf-lib 1.17.1): a cover page, then 12 K-1s for invented partners, each followed by 0 to 4 statement pages. It was read with the portal's own reader library (pdf.js 3.11.174) in Node. Two variants: values printed on the page (flattened, as printed output is), and values left in the form's fields (as when someone fills the IRS file itself). The 12 partners include the hard cases above: a truncated number, a disregarded LLC under its owner's name, two IRAs at one custodian, a foreign partner with no number, two partners with the same last four digits, "John Smith" and "John Smith Jr", and a name typed surname first.

| | Printed on the page | Left in form fields |
|---|---|---|
| K-1 first pages found | 12 of 12 | 12 of 12 |
| Page ranges right | 12 of 12 | 12 of 12 |
| Item E read exactly | 12 of 12 | 12 of 12 |
| Item F read exactly | 11 of 12 | 12 of 12 |
| Proposed investor right | 12 | 12 |
| Proposed investor wrong | 0 | 0 |
| Reading time, whole file, this machine | 552 ms | 447 ms |

The one miss in item F was a four-line address: the IRS field holds three lines and the fourth was cut off when the form was flattened; the name on line one was read. The disregarded LLC matched on its number alone (the name differs, by rule). The foreign partner matched on name alone.

**What this does and does not show.** It shows the reader library returns the text of this form in a usable order with positions, that field values are reachable when a form was not flattened (through the page's annotations, not its text: a reader that only takes the text would see an empty Part II), and that the matching rule handles the awkward cases. It does not show how real tax software lays out its K-1, whether cover letters or state forms sit between K-1s, or how an iPhone copes with a 300-page file. Those need real files.

### How the split should work
1. Read every page's text with positions and its text-field values.
2. A page is a K-1 first page when it carries the code `651123`, "Schedule K-1", "Form 1065" and "Information About the Partner". (Recipient copies of Form 1041 and 1120-S K-1s carry `661117` and `671124`; they are not matched automatically in this phase.)
3. On a first page, item E is what lies between the item E label and the item F label; item F is what lies between the item F label and the item G label; both in the left half of the page.
4. A package runs from a first page to the page before the next first page. Pages before the first K-1 belong to no one and are shown as such.
5. Proposal: the last four digits of item E against `taxCert.tinLast4` (or `investor.tinLast4`), and the first line of item F against the account name and contact name, among investors holding that offering only. Both agree on one investor: proposed, "number and name". Number points to exactly one and no name agrees: proposed, "number only". No number and the name points to exactly one: proposed, "name only". Anything else: not proposed.
6. Cut each package into its own PDF by copying its pages (the method esign.js already uses at 3354-3358).

A file with almost no text on its pages is a scan. This phase does not read scans: reading pictures of pages is the in-house reader's work (D-33, not to be touched). The sponsor is told in one sentence to ask the CPA for the file as the tax software saves it, or to assign page ranges by hand.

### The confirmation step
This is the control that matters; the proposal is only a convenience.
- One row per package: a picture of that K-1's Part I and Part II cut from its own first page (drawn in the page, never the browser's PDF viewer), the number of pages, and beside it the proposed investor's name, account id and "ending 1234". The sponsor taps Confirm for that row, or picks another investor, or sets it aside.
- No "confirm all" for rows proposed on one signal ("number only", "name only") or not proposed. Whether rows proposed on both signals may be confirmed together is the owner's call; the recommendation is one tap per row for everything, since the number of K-1s per fund is small and the cost of a mistake is high.
- Two packages for the same investor, offering and year cannot both be confirmed without the sponsor saying which stands (an amended K-1 replaces; it does not add).
- A package's partnership EIN (item A) is compared across the file; a K-1 from a different partnership in the same file is flagged.
- Every confirmation writes a change-log entry: who, when, which investor, the proposal's basis, the file's SHA-256 and the page range.
- Deliver is a separate action after confirmation, for the confirmed rows only, and lists by name who is about to receive what.
- After delivery the sponsor can withdraw a document (it leaves the investor's portal; the log keeps the fact that it was there and whether it was opened).
- Investors holding the offering with no K-1 in the file are listed, as are packages left unassigned.

## 1099s: which boxes the portal can fill

### Form 1099-INT (Rev. January 2024, continuous use)
[VERIFIED: Instructions for Forms 1099-INT and 1099-OID (Rev. January 2024); IRIS upload rules for 1099-INT, tax year 2025]

| Box | Fill | Source |
|---|---|---|
| Payer's name, address, phone, TIN | Sponsor enters once per offering | Not held today (the offering has a name only) |
| Recipient's name, address | The portal, from the W-9 on file | Sponsor confirms; see "Names and taxpayer numbers" |
| Recipient's TIN | The portal, read from the signed W-9 or typed | Never stored |
| 1 Interest income | **The portal on its own**: the sum of interest payments recorded as paid to that investor in the calendar year | The sponsor confirms each total against the bank before filing |
| 4 Federal income tax withheld | **The portal on its own**: backup withholding recorded on those payments | Same |
| 2 Early withdrawal penalty; 3 Interest on U.S. Savings Bonds and Treasury obligations | Empty | Do not apply to a fund's notes |
| 5 Investment expenses; 6 Foreign tax paid; 7 Foreign country; 8 Tax-exempt interest; 9 Specified private activity bond interest; 10 Market discount; 11 to 13 Bond premium; 14 CUSIP | **Never guess**: empty unless the CPA gives a figure | |
| FATCA filing requirement; 2nd TIN notice; state boxes 15 to 17 | **Never guess**: empty; a state's own filing rule is a question for the CPA | |

Stops, each with "ask your CPA" and no form built:
- The notes were issued at a discount, or interest is added to principal instead of paid (that is original issue discount and belongs on Form 1099-OID, which this phase does not build).
- The sponsor cannot confirm the notes are "in registered form or of a type offered to the public" (the $10 rule).
- Interest was paid in anything but money.
- The investor's totals do not agree with the bank.

Left out automatically, each shown with its reason: an IRA account (`type` `'ira'`); an investor with a valid W-8 (gets a 1042-S); an investor paid under $10 with nothing withheld. An entity that ticked C corporation or S corporation on its W-9 is an exempt recipient, but the portal does not keep the W-9's classification on the investor record today (only on the PDF), so the sponsor marks those; sending a 1099-INT to a corporation is unnecessary, not wrong.

"Fully automatic" (D-02) holds in this sense: no figure is typed. It still ends with the sponsor confirming each total, because the portal's "paid" is what the sponsor recorded, not what the bank did.

### Form 1099-DIV (Rev. January 2024, continuous use)
[VERIFIED: Instructions for Form 1099-DIV (Rev. January 2024); IRIS upload rules for 1099-DIV, tax year 2025]

| Box | Fill | Source |
|---|---|---|
| Payer and recipient identity | As for 1099-INT | |
| 4 Federal income tax withheld | **The portal on its own** | Recorded withholding |
| 1a Total ordinary dividends; 2a Total capital gain distributions; 3 Nondividend distributions (return of capital) | **Sponsor's or CPA's confirmed figure** | Depends on the corporation's earnings and profits for the year |
| 1b Qualified dividends; 2b Unrecaptured section 1250 gain; 2c Section 1202 gain; 2d Collectibles gain; 2e and 2f Section 897 amounts (REITs); 5 Section 199A dividends (REITs) | **Sponsor's or CPA's confirmed figure**, or empty | |
| 6 Investment expenses; 7 and 8 Foreign tax; 9 and 10 Liquidation distributions; 11 FATCA; 12 and 13 Exempt-interest; state boxes | **Never guess** | |

How the confirmed split is taken, so that no calculation of tax character happens in the portal:
- The CPA gives the split **for each distribution paid in the year** (percent or dollars per box), or states in one tick that one split applies to every distribution in the year. An investor who joined or left mid-year then gets the right mix without the portal deciding anything.
- Each investor's boxes are their recorded amount in each distribution times that distribution's split, rounded to cents with the largest-remainder rule the portal already uses (operations.js:37-55), so the boxes add up to exactly what the investor was paid.
- Checks, all arithmetic: 1a + 2a + 3 (+ 9) equals cash paid; 1b is not more than 1a; 5 is not more than 1a; 2b + 2c + 2d is not more than 2a; no negative box.
- If the CPA cannot determine the split in time, the IRS's own rule is that the whole payment is reported as a dividend. The portal must not apply that by itself; it shows the rule and the sponsor chooses.

DATA_z5Wc1tBu_START
If you make a payment that may be a dividend but you are unable to determine whether any part of the payment is a dividend by the time you must file Form 1099-DIV, the entire payment must be reported as a dividend.
DATA_z5Wc1tBu_END

A corporation that pays a return of capital has filings of its own (the instructions name Form 5452). That is the CPA's; the portal shows one line saying so when box 3 is not zero.

### Names and taxpayer numbers
[VERIFIED: onboarding.js:2353-2361, 2375-2389; taxmaps.js:40-88]

What the investor record keeps after a W-9 is signed:
```js
// onboarding.js:2380 and 2389
base = { form: env.taxForm.form, revision: env.taxForm.revision, envelopeId: env.id, at: signer.signedAt || nowIso(), signed, signedBy: signed ? signer.name : '' };
i.taxCert = Object.assign(base, { tinLast4: fl.taxTinLast4 || '', backupWithholding: !!fl.taxBackup });
```
and after a W-8BEN or W-8BEN-E (onboarding.js:2386-2387): `{ country, citizenship, ftinLast4, noFtin, treatyCountry, validUntil }` or `{ chapter3, chapter4, country, ftinLast4, noFtin, validUntil }`. Also on the investor: `taxForm`, `taxType` (one of `'us-individual'`, `'us-entity'`, `'foreign-individual'`, `'foreign-entity'`, data.js:120-125), `tinLast4`, `address` (free text; `splitAddress` reads "street, city, ST 12345", onboarding.js:40-43), `edelivery`, `esignConsent`.

Not kept: the nine digits (kept in the page's memory only until the form is built, onboarding.js:1676-1678), the W-9's classification box, the exempt payee code, the treaty rate and article.

The signed form itself is kept as a file and listed in `ws.docs` with `cat: 'Tax'` and the envelope's id (esign.js:1258). It is flattened, so its text, including the number, is on the page.

**Recommendation for the nine digits:** when the sponsor builds 1099s, the portal opens each investor's signed W-9 from the file store, reads the number from the place the pinned form prints it, and accepts it only if it has nine digits and ends in the four on record. It is held in memory, written into the IRIS file and (truncated) the recipient copy, and dropped. Where the file is missing (signed on another device and not received, `taxCert.received === false`; or uploaded as a scan), the sponsor types the number and the same last-four check applies. Nothing in storage changes, so phase 06's rule stands. The alternative, keeping numbers sealed on the server, is a larger change with a larger exposure and is not needed.

The W-9's name line may differ from the account name. The form filed must use the name on the W-9 (line 1). For IRIS an individual's name is split into first and last (20 characters each, letters, spaces and hyphens only), which the portal does not hold: it proposes a split of the W-9 name and the sponsor corrects it on the review screen.

### The recipient's copy
The IRS's own PDF of each form says the black copies "may be downloaded and printed and used to satisfy the requirement to provide the information to the recipient". [VERIFIED: notice on Forms 1099-INT and 1099-DIV] Copy B is a fillable page in each file (1099-INT: page 4, 31 fields; 1099-DIV: page 4, 34 fields; measured with pypdf this session). So the recipient's copy is made exactly the way phase 06 makes a W-9: the official file pinned by SHA-256, a map of field names checked against the file by `checks/form-maps.js`, filled and flattened by `NS.taxforms.fill` (taxforms.js:34-114), shipped as script data. The recipient's number may be truncated on Copy B (first five digits replaced by asterisks or Xs); never on what goes to the IRS; the payer's number is never truncated. [VERIFIED: Publication 1099 (2026) part J] The recipient instructions page of the same file goes with it.

A lighter alternative exists and costs nothing to build: IRIS itself produces recipient copies as PDFs the sponsor downloads, and those could be delivered through the import path. It makes delivery wait on filing, and the copies come in one download to be matched to investors again. Filling Copy B in the portal is recommended.

## IRIS: filing with the IRS at $0

[VERIFIED: Publication 5717 (Rev. 9-2026), Publication 5718 (Rev. 11-2026), Publication 1099 (2026), irs.gov IRIS pages, all read this session]

- **What it is:** a free IRS site ("Taxpayer Portal") where a filer keys in forms or uploads a .csv file, and a separate machine-to-machine channel ("A2A", XML). Forms it takes for tax year 2026 include 1099-INT, 1099-DIV and 1042-S. No Form 1096 is needed.
- **What the filer needs:** a Transmitter Control Code (TCC) for the Taxpayer Portal, five characters beginning with "D". Any entity with an EIN can apply. The application is online; a Responsible Official signs in with an IRS account (ID.me or Login.gov), gives their SSN or ITIN and date of birth, and signs with a PIN. A physical business address is required. The role is either Issuer (files only for its own EIN) or Transmitter (files for others; one TCC serves any number of issuers).
- **The wait:** "Allow up to 45 calendar days" (Publication 5717); "within 45 business days, however, processing times may vary" (Publication 1099). A TCC unused for three years in a row is deleted.
- **Limits:** up to 100 forms per submission; an upload file holds one form type and one tax year and at most 250 records; a Transmitter's file may mix issuers; up to 25 saved issuers. The two numbers (100 and 250) are both in Publication 5717 and how they combine is not explained there. Keep each file to 100 rows.
- **Deadline counted at 11:59 p.m. on the due date.** Corrections and extension requests are made on the same site.
- **The file:** "Only CSV templates provided by the IRS can be used." The template is downloaded on the site. The rules for each column are public: irs.gov/pub/irs-efile/ty2025-template-formatting-guidelines.zip (37 PDFs, one per form; tax year 2025, updated January 14, 2026).

Columns, from those rules [VERIFIED: "1099-INT Template Formatting Guidelines.pdf" and "1099-DIV Template Formatting Guidelines.pdf", March 6, 2025; an asterisk marks a required field]:

DATA_m8Jd4yQa_START
A Form Type; B Tax Year; C Payer TIN Type*; D Payer Taxpayer ID Number*; E Payer Name Type*; F Payer Business or Entity Name Line 1*; G Payer Business or Entity Name Line 2; H Payer First Name*; I Payer Middle Name; J Payer Last Name (Surname)*; K Payer Suffix; L Payer Country*; M Payer Address Line 1*; N Payer Address Line 2; O Payer City/Town*; P Payer State/Province/Territory*; Q Payer ZIP/Postal Code*; R Payer Phone Type; S Payer Phone; T Recipient TIN Type; U Recipient Taxpayer ID Number; V Recipient Name Type*; W Recipient Business or Entity Name Line 1; X Recipient Business or Entity Name Line 2; Y Recipient First Name; Z Recipient Middle Name; AA Recipient Last Name (Surname); AB Recipient Suffix; AC Recipient Country*; AD Recipient Address Line 1*; AE Recipient Address Line 2; AF Recipient City/Town*; AG Recipient State/Province/Territory*; AH Recipient ZIP/Postal Code*; AI Office Code; AJ Form Account Number; AK FATCA Filing; AL 2nd TIN Notice
1099-INT continues: AM Payer's RTN; AN Box 1 - Interest Income; AO Box 2; AP Box 3; AQ Box 4 - Federal income tax; AR Box 5; AS Box 6; AT Box 7; AU Box 8; AV Box 9; AW Box 10; AX Box 11; AY Box 12; AZ Box 13; BA Box 14; BB Combined Federal/State; BC to BH State 1; BI to BN State 2
1099-DIV continues: AM Box 1a; AN Box 1b; AO Box 2a; AP Box 2b; AQ Box 2c; AR Box 2d; AS Box 2e; AT Box 2f; AU Box 3; AV Box 4; AW Box 5; AX Box 6; AY Box 7; AZ Box 8; BA Box 9; BB Box 10; BC Box 12; BD Box 13; BE Combined Federal/State; BF to BK State 1; BL to BQ State 2
DATA_m8Jd4yQa_END

Rules that will reject real data unless the portal checks first [VERIFIED: same files]:
- TIN type: payer "SSN" or "EIN"; recipient "SSN", "EIN", "ATIN", "ITIN", "QI-EIN" or "UND". EIN as XX-XXXXXXX, SSN as XXX-XX-XXXX.
- Name type "B" (business) or "I" (individual). Business name lines: 40 characters; letters, numbers, spaces, hyphen, pound, parentheses, ampersand, apostrophe. First and last name: 20 characters; letters, spaces, hyphens. **No accented letters, no periods, no commas.**
- Address line: 35 characters; letters, numbers, hyphen, slash, space. City: 40 characters; letters and spaces only. State: two letters. U.S. ZIP: exactly 5, 9 or 12 digits, no dash.
- No leading, trailing or doubled spaces anywhere. Amounts from 0 to 999,999,999,999,999.
- The examples show amounts both as `847` and as `1500.00`; the cents rule is not stated in what was read. [ASSUMED until a template is in hand]

**The $0 route, recommended:** the sponsor applies for an Issuer TCC (free); the portal builds one file per form type and year, runs every rule above before offering the download, and shows the file's rows on screen for review; the sponsor uploads it on the IRS site, then types the receipt id and date back into the portal, which marks those forms filed and keeps the file's SHA-256. This is the ACH file pattern (console.js:1130-1163, 1306-1310).

**The same file filed by Carrow & Vale:** with a Transmitter TCC, staff could upload for every sponsor. It adds a server, a staff step, and Carrow & Vale handling every investor's taxpayer number. Possible later; not recommended to start.

**Machine-to-machine (A2A):** needs a second TCC application with a Software Developer role, a Software ID renewed every tax year, a client id, schema files from the IRS's secure mailbox, and passing the IRS's test system before production. Not a $0-effort route and nothing in it can be built from what was readable. Not recommended in this phase.

**Fallback when no TCC arrives in time:** the same data as a keying sheet (one screen per form in the IRIS form's order) for manual entry, or Form 8809 for 30 more days.

## 1042-S and Form 1042

[VERIFIED: Instructions for Form 1042-S (2026); Instructions for Form 1042 (2025); Publication 515 (2026)]

- A fund that pays U.S.-source income to a foreign person is a withholding agent. It files a 1042-S for each such investor **even when nothing was withheld** because a treaty or the Code exempted the income, and whoever files a 1042-S must also file Form 1042, the annual return.
- Both are due March 15. A partnership that withholds after March 15 on a foreign partner's share of the prior year's income files and furnishes that 1042-S by September 15.
- Form 1042-S must be e-filed by anyone with 10 or more information returns, by any partnership with more than 100 partners, and by any financial institution. From tax year 2026, through IRIS only. IRIS publishes upload rules for 1042-S (11 pages, October 22, 2025; columns through DE).
- Form 1042 is a tax return. It is e-filed through a different IRS system by approved software when the filer has 10 or more information returns; otherwise mailed. The portal has no route to file it and should not try.
- A 1042-S needs codes the portal cannot choose: income code, chapter 3 and chapter 4 exemption codes, the recipient's chapter 3 and chapter 4 status codes, a limitation-on-benefits code for a treaty claim by an entity. A chapter 3 exemption code is now required whenever less than 30% was withheld. Each is a tax determination.

**What the portal can do without deciding anything:**
1. Hold each foreign investor's W-8 and its facts (already built), and flag one that is unsigned or past `validUntil`.
2. Record amounts paid to them and any tax withheld (TAX-14).
3. Give the CPA a worksheet: investor, country, form on file and its validity, foreign tax number on file or not, amounts paid by date and kind, tax withheld by date.
4. Deliver the 1042-S (and Form 8805) the CPA prepares, through the same import, confirm and deliver path, with the same consent (Publication 1179 section 4.6 lists 1042-S among the forms that may be furnished electronically).

**Recommendation:** that is D-03 for this phase. A portal-built 1042-S with codes chosen by the CPA on a screen, and an IRIS file for it, is possible later; it is optional and not recommended now, because a fund with foreign investors has a CPA filing Form 1042 anyway and the 1042-S figures must agree with it line for line.

## Withholding at the distribution

### What a sponsor actually has to apply, and where the portal must stop

| D-04 item | The rule | Applied at a distribution? | Portal |
|---|---|---|---|
| Backup withholding, 24% | Only on a payment reportable as interest or dividends (or the other 1099 payments), and only when: the payee gave no TIN; the IRS told the payer the TIN is wrong; the IRS told the payer the payee underreported; or the payee did not certify they are not subject to it. [VERIFIED: Publication 1099 (2026) part N] | Yes, for a "Notes" or "Corporation or REIT" offering. **Never for a partnership's distributions.** | Proposes; sponsor confirms each line |
| Foreign, 30% or treaty rate | A U.S. partnership "should withhold when any distributions that include amounts subject to withholding are made", and on an undistributed share by the earlier of the date the K-1 is furnished or due. [VERIFIED: Publication 515 (2026)] A payer of interest or dividends to a foreign payee withholds when it pays. | Yes, but only on the part that is U.S.-source income of the kinds subject to it | Takes the amount subject to withholding from the sponsor; proposes 30%; a lower rate only as entered |
| Partnership withholding for foreign partners (business income) | Four payments a year, on the 15th of the 4th, 6th, 9th and 12th months, on the foreign partners' share of the partnership's taxable business income, at 37% (21% for a corporate partner), "regardless of whether the partnership made any distributions". [VERIFIED: Instructions for Forms 8804, 8805 and 8813 (Rev. December 2026)] | **No.** It follows income, not distributions | "Ask your CPA"; records a figure the sponsor enters |
| FIRPTA | For a domestic partnership the business-income withholding above takes its place. [VERIFIED: Instructions for Form 8288 (Rev. January 2026); Instructions for Forms 8804, 8805 and 8813] Corporations, trusts and transfers of interests have their own rules at 15%, 21% or 10%, with a 20-day deadline. | Not as a separate step for a domestic partnership | "Ask your CPA"; records a figure |

DATA_v2Xf6kPo_START
Because a domestic partnership that disposes of a USRPI is required to withhold under section 1446(a), it is not required to withhold under section 1445(e)(1).
DATA_v2Xf6kPo_END

The stop list. In each case the screen says in one sentence what the question is and that the CPA decides, and takes an amount only as an entered figure:
- How much of a partnership distribution is U.S.-source interest, dividends or rents (the amount subject to 30% withholding).
- Whether interest on the fund's notes paid to a foreign investor is exempt as portfolio interest.
- Whether a treaty rate applies and what it is. The W-8 states a claim; the withholding agent may not rely on a form it "knows or has reason to know" is wrong, and an entity's claim needs a limitation-on-benefits basis. [VERIFIED: Instructions for the Requester of Forms W-8 (Rev. June 2022)] The portal does not keep a table of treaty rates and must not.
- Partnership withholding on business income (the four payments, Forms 8804, 8805, 8813).
- Real property: a corporation's or REIT's distributions to foreign shareholders; a foreign partner's sale of its interest; a distribution to a foreign partner above their basis.
- FATCA (chapter 4): an entity whose W-8BEN-E shows a status that draws 30% withholding.
- State withholding on out-of-state or foreign partners. [ASSUMED: many states have it; none was read]
- Any IRS letter about a payee (wrong number, underreporting): the sponsor records the date it arrived; the rule's clock (withhold no later than 30 business days after receipt) is shown, and the CPA is named for anything unusual.

### What the portal can check about a W-8 by rule
[VERIFIED: Instructions for the Requester of Forms W-8; Instructions for Forms 8804, 8805 and 8813]
- Signed. Not expired: valid through the last day of the third calendar year after signing (already kept as `validUntil`).
- A foreign tax number is on the form, or the "not legally required" box is ticked.
- For a partner in a partnership with U.S. business income, the W-8 must carry a U.S. taxpayer number to be valid for a lower rate.
- A partner who gives no W-9 and no W-8 may be presumed foreign by the partnership. The portal shows that sentence; it does not act on it.

### Backup withholding, as rules the portal can apply
For an offering set to "Notes" or "Corporation or REIT", and a payee who is not an IRA, not marked exempt by the sponsor, and not documented foreign by a valid W-8, propose 24% of the payment when any of these is true:
1. No signed W-9 with a taxpayer number is on file (`taxOnFile(i)` false, or no last four digits).
2. The W-9 on file has certification item 2 crossed out (`taxCert.backupWithholding === true`): the payee has told the payer the IRS notified them.
3. The sponsor has recorded an IRS notice for that payee that is in effect.

The sponsor sees who, why and how much, and confirms or removes each line before the ACH file is built. Whether a minimum payment applies before backup withholding on interest or dividends was not read. [ASSUMED: none; confirm with the CPA]

### Deposits
[VERIFIED: Instructions for Form 945 (2026); Publication 15 (2026); Instructions for Form 1042 (2025); Publication 515 (2026)]
- All deposits are electronic, through the Treasury's payment system or IRS Direct Pay, both free. The portal moves no tax money.
- Backup withholding is reported on Form 945 under the same EIN as the 1099s. Under $2,500 for the year: no deposits during the year. Otherwise a new filer is a monthly depositor: by the 15th of the following month. Past $50,000 in the lookback year, or $100,000 on any day, the schedule tightens.
- Tax withheld on foreign payees (Form 1042): $2,000 or more undeposited at the end of a quarter-monthly period (the 7th, 15th, 22nd and last day): within 3 business days. $200 to under $2,000 at a month's end: within 15 days. Under $200 at year end: with the return.
- Late-deposit penalty: 2%, 5%, 10% by lateness.

**Recommendation:** keep a running record per kind of tax: withheld, when, from whom; and "deposited" with the date and confirmation number the sponsor types. Show the applicable rule beside the undeposited total. Working out the exact due date for each deposit is **optional**: the monthly and quarter-monthly cases are simple, but the right schedule depends on the sponsor's history, and a wrong date is worse than a plain rule.

### Why stored amounts are needed first
A distribution today is one record: `{ id, offeringId, date, type, total, status, source, file }` (console.js:1321; `status` is `'paid'` or `'scheduled'`; `type` is one of `['Income', 'Interest', 'Return of capital', 'Realization proceeds', 'Proceeds', 'Royalty income', 'Principal', 'Return of capital and gain', 'Distribution']`, tenants.js:38). Each investor's share is worked out again every time it is shown, from the positions held on that date (`NS.data.allocate`, data.js:409-420). If a position is corrected later, last year's shares change with it. A 1099 must report what was paid. So a paid distribution must keep its per-investor lines from the moment it is recorded, and the year-end figure must be read from those lines. Distributions recorded before this phase have no lines; for those the year-end screen shows the recomputed share and the sponsor confirms or corrects each.

Also: a distribution dated today or earlier is marked paid when recorded, whether or not a bank file was sent (console.js:1321). The 1099 review screen is where the sponsor attests the totals match the bank.

## Outside services

No vendor page could be opened. Every figure in this table is from a search-engine summary and is **unconfirmed**; "not found" means no result showed a price.

| Service | Does | Price seen (unconfirmed) | Against in-house |
|---|---|---|---|
| IRS IRIS Taxpayer Portal | E-files 1099s and 1042-S; gives recipient copies | $0 [VERIFIED: Publication 5717: "no cost"] | The recommended route. One-time free code, up to 45 days |
| TaxBandits | E-file, mail, recipient site, API | About $2.75 a form for the first 10, falling with volume; recipient online access about $0.50 a form; mailing about $2.50; a 1042-S page showed $9.95 down to $6.55 a form | No TCC wait; a per-form cost each year; investor numbers go to a third party. Summaries disagreed with each other |
| Tax1099 | E-file, API | "From $2.99" a form at low volume; "as low as $0.68" at high volume; API pricing not found | Same trade-off |
| A Sovos e-file site | 1042-S | $5.49 e-file only, $7.29 with print and mail, for 1 to 10 forms | Same |
| K1x, Covercy and similar | K-1 delivery to investors | Not published; quote on request | Cannot compare. The in-house path is D-01 as decided |
| W-8 validation and treaty tools (Comply Exchange, TAINA) | Check W-8s, treaty claims | Not found; sites blocked | Sold to banks; not a fit for a sponsor with a few foreign investors |
| IRS TIN Matching | Checks a name and number pair before filing | $0, but only for a payer that filed 1099s with backup withholding in the last two years [VERIFIED: irs.gov TIN Matching page] | Not open to a first-time filer |

Accuracy and speed of the paid services were not measured and no claim is made. Their one real advantage is skipping the TCC wait. If a sponsor has no TCC by late February, a per-form service is the fallback the portal can serve with the same data as a plain export; that export is optional.

**CPA partner (D-05):** nothing to build here. The package is phase 11. What phase 10 can leave ready is one field per workspace for the CPA's name and email, used to address the worksheets, and that is optional. Points for the owner to settle with a CPA before any arrangement: the sponsor's written opt-in to share investor tax data; who the CPA's client is (the sponsor, not Carrow & Vale); and how the CPA's own rules treat referral fees. [ASSUMED: none of this was researched from a primary source]

## What already exists in the portal

[VERIFIED: files read this session at the lines given]

| Need | Exists | Where |
|---|---|---|
| Publish a file to one investor | Yes. A file whose name contains an investor id goes only to that investor; category `'Tax'` and a tax year are recorded; SHA-256 kept; a notice can be sent | console.js:2129-2231; `DOC_CATS = ['Reports', 'Statements', 'Tax', 'Legal', 'Notices', 'Other']`; `matchIds`, operations.js:502-506 |
| Document record | `{ id, title, fileName, type, size, sha256, cat, offeringId, audience, investors, date, taxYear, publishedAt, publishedBy }` | console.js:2216 |
| Who sees a document | `audience === 'investors'` limits it to the ids in `investors` | operations.js:493-496 |
| File storage in the browser | Bytes in IndexedDB, never a Blob; held in memory when the browser refuses | operations.js:356-492 |
| Investor opens a document, drawn in the page | Yes | portal.js:1050-1075; `NS.esign.viewPdf`, esign.js:454 |
| Record of an open | **No** | - |
| Files reaching another device | **No**: "This file was published from a different browser." | portal.js:1063 |
| PDF reader and writer | Loaded by script from a CDN: pdf.js 3.11.174, pdf-lib 1.17.1. There is no `assets/js/vendor/`; `assets/vendor/` holds the reader's own engines and the fonts | esign.js:25-27, 242-266 |
| Cutting pages into a new PDF | Yes | esign.js:3354-3358 |
| Filling an official IRS form, pinned and checked | Yes | taxforms.js:34-114; taxmaps.js; `checks/form-maps.js` |
| Official forms shipped as script data | Yes | taxforms.js:116-146; assets/forms/forms-data.js |
| W-9, W-8BEN, W-8BEN-E facts on the investor | Yes (see "Names and taxpayer numbers") | onboarding.js:2375-2389 |
| "A tax form is on file" | One rule: `taxOnFile` | onboarding.js:1705 |
| Distributions, pro rata, ACH file, download | Yes | console.js:1040-1329; data.js:409-420; `U.download`, app.js:138 |
| Per-investor amounts kept for a paid distribution | **No** (recomputed) | data.js:409-420 |
| Any withholding | **No** | - |
| Capital accounts | Yes, but valuations, income and gains are generated sample numbers | audit.js:1-22, 218-235. **Not a source for any tax figure** |
| Change log | Yes | `NS.audit.log(ws, { action, detail, fund, record })` |
| Largest-remainder rounding | Yes | operations.js:37-55 |
| Carrying files to an investor's device by emailed link, encrypted at rest, with a status | Yes, for invitations: `STATUSES = ['sent', 'opened', 'in_progress', 'completed', 'cancelled', 'expired']`; `INVITE_LIMITS = { create: 32 * MB, complete: 40 * MB, small: 16 * KB, documents: 10 * MB, esignPdf: 10 * MB, logo: 600 * KB, files: 25 * MB }` | server/lib/invitations.mjs:1-24 |
| Email | Yes, with a server; without one the message is handed to the sponsor's own email | server/lib/mail.mjs; invitations.js |
| Console page in its own file, self-serve edition only | The notifications page is the pattern | invitations.js:2324-2341 (per the phase 09 research) |

## With and without a server

| Piece | No server (the owner's iPhone preview) | Needs the server |
|---|---|---|
| Import, split, proposals, confirmation | Works | - |
| Posting to the investor, seen in the same browser | Works | - |
| The investor on their own device seeing the K-1 | No | Yes |
| Notice email with the required subject | Text produced for the sponsor to send from their own email | Sent by the server |
| Opens | Recorded when opened in the same browser | Reported by the investor's device |
| Tax-document consent | Works | Carried back like the existing consent |
| Offering's reporting type, withholding lines, net ACH file, withholding record | Works | - |
| 1099 figures, checks, Copy B, IRIS file, download | Works | - |
| Reading the number from the signed W-9 | Works when the signed file is in this browser | - |
| Filing with the IRS | The sponsor, on the IRS site | - |

For the preview: the two official forms' bytes ship as script data (no fetch); pages are drawn in the page; every dialog scrolls and has a way out; nothing calls the network. The reader and writer libraries load by script tag, as they do today for signing.

**Carrying a tax document to another device** should reuse the invitation link: a link kind that holds one document and one screen. What must differ from an invitation: the link and the file must live for the IRS access period (the later of 12 months after the tax year and 6 months after issue for a K-1; through October 15 for a 1099), where invitations end after `INVITE_DAYS` (30) and are deleted `SUBMISSION_DAYS` (30) later (server/README.md); the first open is reported back as the open record; a withdrawn document stops opening. A bounce must reach the sponsor so the 30-day paper rule can be met. Whether this is built in this phase or waits for the data room and security phases is an owner decision (Open Questions 4).

## Standard Stack

No new library. [VERIFIED: codebase]

| Tool | Version | Purpose | Note |
|---|---|---|---|
| pdf.js | 3.11.174 | Text with positions; field values; page pictures | Already loaded (esign.js:26-27) |
| pdf-lib | 1.17.1 | Cutting pages; filling Copy B | Already loaded (esign.js:25) |
| Official IRS PDFs | Schedule K-1 2025 (test fixture only); Form 1099-INT Rev. January 2024; Form 1099-DIV Rev. January 2024 | Fixtures and the recipient copy | Pinned by SHA-256, like the W-9 |
| Node `node:test`, the phase checks | Node v22 | Tests | As in earlier phases |

Fingerprints of the files read this session, to compare when they are fetched again for bundling:
```
66098d4d48537ce2dac1f093d6351567957896e5843d8c524823b380068f6547  f1065sk1.pdf  (2025 Schedule K-1)
ee7697c9b29374596fd9645b157b7312d121ae3c2f76bebf68908c3fc2b739e6  f1099int.pdf  (Rev. January 2024)
4ea1de804ff1db921753bd6319beeccfe4647299e03d79816e04d852a9cd1435  f1099div.pdf  (Rev. January 2024)
```
The 2026 Schedule K-1 is not out yet; the detector must not depend on the year.

**Alternatives considered:** a CSV library (not needed: no quoted fields survive IRIS's character rules, so a row is values joined by commas after validation); a paid e-file API (see Outside services).

## Package Legitimacy Audit

No external package is installed by this phase. Nothing to audit.

## Architecture Patterns

### Recommended structure
```
assets/js/
├── taxdocs.js       # NS.taxdocs: pure. Page facts -> packages -> proposals; delivery record; consent text and record; access-period dates
├── taxdocs-ui.js    # the console page (import, confirm, deliver, opens, paper list) and the investor's consent and open hooks
├── withholding.js   # NS.withholding: pure. Reporting type; rules that propose a line; net amounts; the withholding record
├── tax1099.js       # NS.tax1099: pure. Year figures from stored lines; split arithmetic; validation; IRIS rows; Copy B answers
└── tax1099-data.js  # script data: the two official forms' bytes and the IRIS column rules, each with source and date
assets/js/taxmaps.js # two new entries (1099-INT Copy B, 1099-DIV Copy B), same shape as the W-9 entry
server/lib/taxdocs.mjs  # only if the owner chooses delivery to other devices now
.planning/phases/10-.../checks/
├── k1-split.js      # the synthetic combined files (built in the check from the pinned IRS form) and, when present, the owner's real files
├── tax-math.js      # reporting type, withholding proposals, net amounts, 1099 figures, split arithmetic, IRIS rules
├── tax-forms.js     # Copy B maps against the pinned files (extends form-maps)
└── tax-flow.js      # the screens in the sandboxed frame at 390x844 and 1280x800
```
Pure modules must load in the browser and under Node, as the phase checks expect.

**Do not edit or depend on the in-house reader's files** (`intake.js`, `reader.js`, `textread.js`, `textengine.js`, `picturepage.js`, `placement.js`, `placemodel.js`, `anchors.js`, `meaning.js`, `assets/vendor/`). The shared pdf.js loader `NS.pdfLib` is defined in intake.js (line 1423). Load pdf.js through `NS.esignKit.loadScript` (esign.js:413) with the same two addresses instead, so this phase has no tie to that file.

### System diagram
```
 CPA's file(s) ──► import ──► read each page (text + field values)
                                │
                     K-1 first page? ──no──► belongs to the package before it (or to none)
                                │yes
                     item E, item F ──► proposal among the offering's investors
                                │        (number and name / number only / name only / none)
                                ▼
                  Sponsor confirms each row (Part II picture beside the investor)  ──► change log
                                │
                         Deliver (confirmed rows only)
                 ┌──────────────┴──────────────┐
          consent on record                no consent
                 │                              │
   posted to that investor only            "send on paper" list
   notice with the required words
                 │
   no server: visible in this browser     server: link to the investor's device
                 │                              │
              opened ──► open recorded ◄────────┘

 Offering's reporting type (set once by sponsor or CPA)
        │
        ├─ Partnership ──► K-1 path only; no 1099; no backup withholding
        ├─ Notes ────────► distribution: proposed backup lines ──► sponsor confirms ──► net ACH file
        │                  year end: box 1, box 4 from stored lines ──► sponsor confirms totals
        ├─ Corp or REIT ─► same, plus the CPA's split per distribution
        └─ Other ────────► import path only
                                 │ (Notes, Corp or REIT)
                 number read from the signed W-9 (memory only) ──► checks ──► Copy B to the investor
                                 │
                        IRIS file ──► sponsor uploads on the IRS site ──► receipt id typed back

 Foreign investor (valid W-8) ──► amounts and any entered withholding recorded ──► worksheet for the CPA
                                  ──► CPA's 1042-S / 8805 come back through the import path
```

### Pattern 1: one record per delivered document
Extend the existing document record; do not make a second store.
```js
// added to a ws.docs entry (console.js:2216 shape) when it is a confirmed tax document
tax: {
  kind: 'k1-1065' | 'k1-other' | '8805' | '1042-s' | '1099-int' | '1099-div' | 'letter',
  year: '2026',
  batch: 'tb-...',                 // the import it came from
  pages: [3, 5],                   // first and last page in the source file
  sourceSha256: '...',
  match: { basis: 'number and name' | 'number only' | 'name only' | 'by hand', confirmedBy, confirmedAt },
  replaces: 'doc-...' | '',        // an amended document
  notice: { at, how: 'email' | 'own email' | 'paper' , bounced: '' },
  availableUntil: '2027-12-31',    // computed from the rule for its kind when delivered, then kept
  opens: { first: '', last: '', count: 0 },
  withdrawn: { at, by } | null
}
```
`cat` stays `'Tax'`, `audience` `'investors'`, `investors` one id. The `kind` and `basis` strings are proposals; nothing in the code uses them yet.

### Pattern 2: stored lines on a distribution
```js
// added to a run (console.js:1321 shape) when it is recorded
lines: [ { investorId, grossCents, withheld: [ { kind, basisCents, ratePct, cents, why, source, confirmedBy, confirmedAt } ], netCents } ]
// kind: 'backup' | 'foreign' | 'partnership' | 'real-property' | 'fatca' | 'state'
// source: 'rule' (proposed by the portal and confirmed) | 'entered' (typed by the sponsor or CPA)
```
`grossCents` over the lines equals `run.total`; `netCents` is what the ACH file pays. Only `'backup'` and `'foreign'` are ever `'rule'`.

### Pattern 3: proposals are pure functions; decisions are records
`NS.withholding.propose(ws, offering, date, rows)` returns lines with `why`; nothing is applied until the sponsor confirms. `NS.taxdocs.propose(pageFacts, investors)` returns packages with a basis; nothing is delivered until confirmed. The checks drive these functions directly.

### Pattern 4: the taxpayer number never rests
Read at build time from the signed form, compare with the last four on record, use, drop. Never in `ws`, never in `localStorage`, never in a log line, never on screen in full (show `ending 1234`). The IRIS file exists only as the download.

### Anti-Patterns to Avoid
- **Delivering on a proposal.** A match is a person's decision.
- **A "confirm all" that covers weak or missing proposals.**
- **Fixed coordinates for item E and F.** Find the labels.
- **Reading only the page text.** An unflattened form keeps its values in fields.
- **Reading a scan.** That is the in-house reader's work; this phase tells the sponsor and stops.
- **A 1099 for a partnership's investors**, or backup withholding on a partnership's distributions.
- **Proposing a 1099-DIV split, a treaty rate, or an exemption.**
- **Any tax figure from audit.js.** Its income and gains are generated.
- **Recomputing last year's shares** for a tax form.
- **Storing the nine digits**, or writing them to the change log.
- **A fetch on any path that must work in the preview.**
- **The browser's PDF viewer.**
- **Making the tax-document consent a condition of anything.**
- **Calling the IRIS file correct** before its header is taken from a real IRS template.
- **A vendor, library or tool name on a screen.** "IRS", "IRIS", "Form 1099-INT", "Schedule K-1" are the government's own names and are needed.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Reading PDF text and fields | A parser | pdf.js, already loaded | Measured on the form |
| Cutting pages | Byte surgery | pdf-lib `copyPages`, as esign.js does | Exists |
| The recipient's 1099 copy | A drawn look-alike form | The official PDF's Copy B through `NS.taxforms.fill` | The IRS allows its own black copies; a look-alike must meet Publication 1179's layout rules |
| Field maps | Names from memory | The file's own field list, checked by the form-maps check | Phase 06's rule |
| File storage | A new store | `NS.ops.files` | Handles iPhone Safari's losses |
| Drawing a PDF on screen | An iframe or the browser viewer | `NS.esign.viewPdf` | Works in the sandboxed frame |
| Splitting cents | New rounding | `largest` (operations.js:37-55) | Totals stay exact |
| Hashes | New code | `NS.audit.sha256` | Exists |
| Carrying a file to another device | A new link scheme | The invitation link | Tokens, encryption and status exist |
| Treaty rates, exemption tests, earnings and profits, taxable income | Any of it | The CPA's confirmed figure | Not computable from what the portal holds |
| E-filing transport | A client for the IRS | The sponsor's upload on the IRS site | $0, no keys |

**Key insight:** in this phase the code that looks like the product (splitting, filling, building a file) is small. What decides whether it is right is who confirmed what, and that the portal refuses to decide what it cannot know.

## Common Pitfalls

### Pitfall 1: the name on the K-1 is not the account's name
**What goes wrong:** a disregarded LLC's K-1 carries its owner's name; a name-only matcher finds nothing or the wrong person.
**How to avoid:** match the number first; show "number only" as a weaker basis; always confirm.

### Pitfall 2: two IRAs, one number
**What goes wrong:** both K-1s carry the custodian's EIN; matching on the number alone picks one.
**How to avoid:** a number that points to more than one investor proposes nothing unless the name settles it.

### Pitfall 3: values in form fields
**What goes wrong:** Part II reads as empty and every K-1 is "unmatched".
**How to avoid:** read annotations as well as text. Covered by the second test file.

### Pitfall 4: pages that belong to the next partner
**What goes wrong:** a cover letter printed before each K-1 is attached to the previous partner and discloses a name.
**How to avoid:** unknown until real files are seen. The confirmation row shows the page count and lets the sponsor page through the whole package; a check on real files decides whether a "cover page" rule is needed.

### Pitfall 5: an amended K-1 delivered as a second K-1
**How to avoid:** one live K-1 per investor, offering and year; the newer replaces and is notified within 30 days.

### Pitfall 6: 1099s for a partnership
**What goes wrong:** the sample data labels a credit fund's document "Form 1099-INT" (data.js:614); a sponsor follows the label.
**How to avoid:** nothing 1099 appears until the reporting type is set by a person.

### Pitfall 7: last year's shares move
**How to avoid:** stored lines (Pattern 2); sponsor confirmation for older distributions.

### Pitfall 8: names IRIS rejects
**What goes wrong:** "José", "O'Neil & Sons, L.P.", "St. Louis".
**How to avoid:** validate every cell against the column's rule before download; show the row and the reason; propose the plain-letter form and let the sponsor decide (the name must still match the IRS's record for that number).

### Pitfall 9: a spreadsheet reopens the file
**What goes wrong:** leading zeros in ZIP codes and numbers are dropped. The IRS guide warns of exactly this.
**How to avoid:** the sponsor uploads the downloaded file as it is; the screen says not to open it in a spreadsheet; the on-screen review replaces the need to.

### Pitfall 10: the code from the IRS arrives after the deadline
**How to avoid:** the first screen of the 1099 path says the code takes up to 45 days and links the sponsor to the application; the filing date is shown from the day the reporting type is set.

### Pitfall 11: withholding recorded, never deposited
**How to avoid:** the withholding record shows the undeposited total with the rule beside it until the sponsor marks it deposited.

### Pitfall 12: a truncated number sent to the IRS, or a full one shown to the investor's inbox
**How to avoid:** two writers, one for the IRS file (full) and one for Copy B (truncated); a check that Copy B never contains nine digits in a row and the IRIS file never contains an asterisk.

### Pitfall 13: consent taken once, used forever
**How to avoid:** the consent record keeps the text agreed to; a change to how documents are delivered that could stop an investor reaching them asks again (Rev. Proc. 2012-17 section 4.03).

### Pitfall 14: a document removed before the access period ends
**How to avoid:** `availableUntil` is kept on the record; removing a delivered tax document before then asks for a reason and is logged (a withdrawal for a wrong delivery is the legitimate case).

### Pitfall 15: three page shells
`index.html`, `diy.html`, `portal.html` each list scripts by hand; the flow check must load the published page.

### Pitfall 16: a large file on an iPhone
Not measured. The existing upload limit is 25 MB (console.js:2182, 2198). Read pages one at a time and release each; cut packages one at a time. The frame check must use a file of realistic length before the owner's test.

## Code Examples

### Finding a K-1 first page and its Part II (the measured approach, not product code)
```js
// Source: SCRATCH/r10/scripts/k1split.js, run this session against pdf.js 3.11.174
const H = page.getViewport({ scale: 1 }).height;
const items = (await page.getTextContent()).items.filter((it) => it.str && it.str.trim())
  .map((it) => ({ s: it.str, x: it.transform[4], top: H - it.transform[5] - (it.height || 0), bottom: H - it.transform[5] }));
// values of an unflattened form live in the page's annotations, not its text
const fields = (await page.getAnnotations()).filter((a) => a.subtype === 'Widget' && a.fieldType === 'Tx' && a.fieldValue)
  .map((a) => ({ s: String(a.fieldValue), x: a.rect[0], top: H - a.rect[3], bottom: H - a.rect[1] }));
const text = items.map((it) => it.s).join(' ');
const first = /651123/.test(text) && /Schedule\s+K-1/.test(text) && /Form\s+1065/.test(text) && /Information About the Partner\b/.test(text);
const find = (re) => items.find((it) => re.test(it.s));
const lE = find(/Partner.s SSN or TIN/), lF = find(/Name, address, city, state, and ZIP code for partner/), lG = find(/General partner or LLC/);
const between = (a, b) => items.concat(fields)
  .filter((it) => it !== a && it !== b && it.x < 300 && it.top >= a.bottom - 2 && it.bottom <= b.top + 3)
  .sort((p, q) => p.top - q.top || p.x - q.x).map((it) => it.s).join('\n');
const itemE = between(lE, lF), itemF = between(lF, lG);
```
The label texts are those of the 2025 IRS form (quoted in the layout table above). The 300-point column limit and the 2 and 3 point tolerances fit the official layout; real files may need them loosened.

### A console page in its own file
The pattern is the one the phase 09 research quotes from invitations.js:2324-2341: `NS.views['console-...'] = { mode: 'console', edition: 'diy', render() {...} }` inside `if (E.diy)`, one line in `NAV` and one key in a `NAV_SECTIONS` group in console.js (the "Operate" group holds `'console-docs'` today, console.js:61).

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| FIRE for e-filing 1099s and 1042-S | IRIS only | Tax year 2026, filing season 2027 | Any guide that mentions FIRE or Publication 1220 is out of date |
| 250 returns before e-filing is required | 10, counted across all form types | Returns due from January 1, 2024 | Almost every fund must e-file |
| $600 for business payments | $2,000, indexed from 2027 | Tax years after 2025 | Does not change the $10 rule for note interest or dividends |
| "General Instructions for Certain Information Returns" | Publication 1099 | 2026 | The old file name is gone from irs.gov |
| Paper 1042-S through FIRE only | IRIS takes 1042-S, with a published upload format | From January 1, 2026 | A later portal-built 1042-S has a $0 route |

## Required and optional

| Piece | Required by | Status |
|---|---|---|
| Import, split, confirm, deliver | D-01; confirmation by CONTEXT.md | Required |
| Tax-document consent, notice words, paper list, access period | Rev. Proc. 2012-17; Publication 1179 | Required for electronic delivery to count |
| Open tracking | D-01 | Owner's decision; not required by the IRS |
| Reporting type per offering | Needed to offer the right document and no wrong one | Required |
| Stored per-investor lines on a distribution | Without them no year-end figure is reliable | Required for 1099s and withholding |
| Withholding lines and net ACH file | D-04 | Required |
| Backup withholding proposals | D-04; Publication 1099 part N | Required for Notes and Corporation offerings |
| Withholding record with "deposited" | The withholder must deposit | Required (small) |
| Computed deposit due dates | - | Optional |
| 1099-INT figures, checks, Copy B, IRIS file | D-02 | Required where an offering is Notes |
| 1099-DIV | D-02 | Required where an offering is a corporation or REIT; if no sponsor at launch has one, the owner may defer it |
| W-8 validity flags, CPA worksheet | D-03 | Required (small) |
| Portal-built 1042-S and its IRIS file | - | Optional; not recommended now |
| Delivery to another device (server) | D-01 read literally | Owner's decision on timing |
| Keeping the W-9 classification on the investor record | Would let the portal leave out corporations by itself | Optional |
| Export for a paid e-file service | - | Optional |
| CPA contact field | D-05 | Optional |
| State filings, Form 1099-OID, corrections filed through the portal | - | Not in this phase; "ask your CPA" |

## Plans (about 100k tokens each)

| # | Plan | Depends on | Testable now | Waits for |
|---|---|---|---|---|
| 01 | `taxdocs.js`: page facts to packages to proposals; delivery record; consent record; access dates; check `k1-split.js` building both synthetic files from the pinned IRS form | - | Fully, on synthetic files | Real K-1 files from the owner |
| 02 | `withholding.js`: reporting type; proposal rules; net amounts; stored lines; withholding record; check `tax-math.js` | - | Fully | - |
| 03 | Tax documents page: import, confirmation rows with the Part II picture, deliver, paper list, withdraw, amended; investor side: consent, open record; frame check at both sizes | 01 | Fully | Owner's check |
| 04 | Distribution screen: reporting type on the offering; proposed and entered withholding lines; confirmation; net ACH file; investor's gross, withheld and net; the withholding record | 02 | Fully | Owner's check |
| 05 | `tax1099.js` and 1099-INT: year figures; the number read from the signed W-9; checks; Copy B map and fill; IRIS rows and download; review and "filed" record | 02 | Fully except the IRIS header | A real IRIS template |
| 06 | 1099-DIV: the split per distribution; arithmetic; Copy B map; IRIS rows | 05 | Fully except the IRIS header | As 05 |
| 07 | Foreign investors: W-8 validity flags on distributions; the CPA worksheet; document kinds 1042-S and 8805 in the import path | 01, 02 | Fully | - |
| 08 | Delivery to another device: the link kind, retention for the access period, open status, the notice email, bounces | 03 | Fully with the test mail server | Owner's decision |

01 and 02 share no file and can run together. 03 and 04 edit different screens. 05 and 06 run in order.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Real tax software prints the K-1's Part II labels as text that pdf.js returns, close enough to the official wording to anchor on | Splitting | More K-1s land in "assign by hand"; nothing wrong is delivered, since every match is confirmed |
| A2 | Form 7004 extends Form 1065, and so the K-1 date, by six months | What the law requires | A reminder shows the wrong extended date |
| A3 | IRIS amounts may carry cents | IRIS | Files rejected at upload; fixed by the template |
| A4 | The IRIS template's header row is the field names in the published rules | IRIS | Files rejected; fixed by the template |
| A5 | The tax year 2026 IRIS columns for 1099-INT and 1099-DIV match tax year 2025 (both forms are unchanged since January 2024) | IRIS | Column order wrong; the table carries its source and year so a change is one data edit |
| A6 | Backup withholding on interest and dividends has no minimum payment | Withholding | Over-withholding on tiny payments; the sponsor confirms each line |
| A7 | Form 8805 has no electronic-delivery procedure of its own | What the law requires | A foreign partner's 8805 should also go on paper |
| A8 | States have their own 1099 filing and partner withholding rules | Stop list | Sponsor misses a state filing; the screen points to the CPA |
| A9 | The count of "10 or more information returns" for Form 1042 e-filing follows the same list as for 1099s | 1042-S | Only affects what the CPA files |
| A10 | A K-1 for an LLC or trust that is not disregarded carries the entity's name as the account shows it | Splitting | Weaker proposals; confirmation unaffected |
| A11 | The preview frame allows the CDN script tags for pdf.js and pdf-lib, as it does for signing today | With and without a server | The split would not run in the preview; the frame check will show it |
| A12 | CPA partner points (opt-in, who the client is, referral fee rules) | Outside services | Business risk only; nothing is built |
| A13 | Weekday rolls of the 2027 dates | What the law requires | A reminder a day off; compute with the phase 09 holiday function |
| A14 | Rule numbering of the investor's W-9 item 2 cross-out as the payee's own statement that the IRS notified them | Backup withholding | A line proposed for the wrong reason; the sponsor confirms each |

## Open Questions (owner decisions)

1. **Who files with the IRS?**
   - (a) The sponsor uploads the portal's file with their own free IRS code. $0. The sponsor applies once and waits up to 45 days.
   - (b) Carrow & Vale files for sponsors with one code. $0 in fees; needs a server, a staff step, and Carrow & Vale handling investors' numbers.
   - (c) A paid service by the form (about $2.75 to $2.99 each, unconfirmed). No wait; a yearly cost; numbers go to a third party.
   - Recommendation: (a). Keep (c) in reserve as a plain export only if a sponsor asks.

2. **1042-S: delivered, or built?**
   - (a) The CPA prepares it; the portal delivers it and gives the CPA a worksheet. Small.
   - (b) The portal fills it from codes the CPA picks, and builds the IRIS file. Larger; the CPA still files Form 1042 and must agree every figure.
   - Recommendation: (a).

3. **How much does the portal do at a distribution?**
   - (a) Proposes backup withholding by the IRS's listed conditions and 30% on an amount the sponsor enters; everything else is an entered figure with "ask your CPA".
   - (b) Proposes nothing; every withheld amount is typed.
   - Recommendation: (a). Both rules are mechanical and every line is confirmed.

4. **Delivery to the investor's own device: now, or with the data room?**
   - (a) Now, as the last plan, reusing the invitation link. Without it "delivered" is only true in one browser, and K-1s are due March 15, 2027.
   - (b) Later, with the data room and security phases. The preview shows the whole flow meanwhile.
   - Recommendation: (a), kept to one document and one screen.

5. **Where does the nine-digit number come from when a 1099 is built?**
   - (a) Read from the signed W-9 on file, or typed, checked against the last four, never stored.
   - (b) Kept sealed on the server from onboarding onward.
   - Recommendation: (a).

6. **Confirming matches: one tap each, or together when both signals agree?**
   - Recommendation: one tap each.

7. **The tax-document consent replaces the forced tick.** The existing "Electronic delivery is required for this portal" cannot apply to tax documents. Recommendation: tax documents always have a paper list.

8. **1099-DIV now or later?** If no sponsor at launch runs a corporation or REIT, plan 06 can wait.

9. **What the owner needs to supply or start:**
   - Real combined K-1 files from a CPA, from more than one tax program if possible (kept out of the repository).
   - An IRS code application (free) by someone with an EIN, so a real template can be downloaded and a real upload tried. Every week of delay is a week off the 2027 filing date.
   - A CPA's read of the "Notes" case: that a sponsor's notes are in registered form, and the stop list above.

## Environment Availability

| Dependency | Needed by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | Checks | Yes | v22 | - |
| pdf.js, pdf-lib local copies | Checks | Yes, in SCRATCH/vendor | 3.11.174, 1.17.1 | - |
| pdftotext, pypdf | Measuring forms | Yes | pypdf 6.17.0 | - |
| www.irs.gov | Forms, rules | Yes | - | Files are saved under SCRATCH/r10/ |
| cdnjs.cloudflare.com | - | No (blocked here) | - | The checks already serve local copies |
| www.ecfr.gov, www.eftps.gov, vendor sites | Regulations, prices | No | - | IRS publications; owner supplies prices |
| A CPA-made combined K-1 file | Proving the split | No | - | Synthetic files; nothing claimed |
| An IRS TCC and template | Proving the IRIS file | No | - | Published column rules |
| Browser check queue | Frame checks | Yes, per AUTOPILOT.md | - | - |
| Disk | Fixtures | 5.4 GB free | - | Fixtures are under 1 MB |

**Missing with no fallback:** none for building.
**Missing with fallback:** real K-1 files and the IRIS template. Both block the words "works" and "correct", not the build.

## Validation Architecture

### Test framework
| Property | Value |
|---|---|
| Checks | Node scripts under this phase's `checks/`, last line `NAME: PASS (...)`; browser ones through `SCRATCH/exec-011/heavy.sh` |
| Server tests | `node --test` in `server/` (only if plan 08 is built) |
| Quick run | `node .planning/phases/10-investor-tax-documents-and-withholding/checks/k1-split.js` and `.../tax-math.js` |
| Full gate | `.planning/checks/gate-reference.sh` plus this phase's checks; counts follow the merged tree |

### Requirements to checks
| Req | Behaviour | Type | Check | Exists |
|---|---|---|---|---|
| TAX-01 | Both synthetic files: 12 K-1s, page ranges right; pages before the first K-1 belong to none | unit | `k1-split.js` | No |
| TAX-02 | The twelve cases propose as measured; same last four with different names is not proposed on the number; a file with no text goes to "by hand" | unit | `k1-split.js` | No |
| TAX-02 | The owner's real files: every K-1 found, every proposal right or absent, never wrong | unit, files outside the repository | `k1-split.js` with a folder argument | No; waits for files |
| TAX-03 | Deliver is refused for an unconfirmed row; a confirmation writes a log entry; two K-1s for one investor, offering and year cannot both stand | unit + browser | `tax-math.js`, `tax-flow.js` | No |
| TAX-04 | A delivered K-1 is in `docsFor` for its investor and for no other; the notice carries the required words; an investor without consent is on the paper list and sees nothing | unit + browser | same | No |
| TAX-05 | Opening records first, last, count; the sponsor's row shows it | browser | `tax-flow.js` | No |
| TAX-06 | The consent screen holds every disclosure in the table; it is never required to continue; withdrawal moves the investor to the paper list for the next document only | unit + browser | same | No |
| TAX-07 | No 1099 or backup line for a Partnership offering or an unset one | unit | `tax-math.js` | No |
| TAX-08 | Box 1 and box 4 equal the stored lines for the year; IRA, valid W-8 and under $10 are left out with reasons; every other box empty | unit | `tax-math.js` | No |
| TAX-09 | Boxes add to cash paid to the cent for mid-year joiners and leavers; each arithmetic rule fails on a broken split; nothing is proposed without a split | unit | `tax-math.js` | No |
| TAX-10 | A number not ending in the last four on record is refused; nothing with nine digits is in `ws` or the log after a build | unit + browser | `tax-math.js`, `tax-flow.js` | No |
| TAX-11 | Copy B maps match the pinned files' own field lists; Copy B never shows nine digits in a row | integration | `tax-forms.js` | No |
| TAX-12 | Every row passes every published column rule; each deliberate fault (accent, period, long name, bad ZIP, doubled space) is caught and named; at most 100 rows a file | unit | `tax-math.js` | No |
| TAX-13 | A CPA's 1042-S assigned by hand is delivered to one investor only; the worksheet lists each foreign investor's form, validity and amounts | unit + browser | same | No |
| TAX-14 | Gross, withheld and net add up per line and per run; the ACH file's entries equal the net; lines are unchanged after a position is edited | unit | `tax-math.js` | No |
| TAX-15 | Each IRS condition proposes 24%; none proposes for a Partnership; an exempt or foreign payee gets none; an unconfirmed line is not applied | unit | `tax-math.js` | No |
| TAX-16 | An expired or unsigned W-8 is flagged; 30% only on the entered amount; a lower rate only when entered; each stop shows its sentence | unit + browser | same | No |
| TAX-17 | Totals by kind; "deposited" clears the undeposited total; box 4 equals backup lines for the year | unit | `tax-math.js` | No |
| TAX-18 | Every new screen in the sandboxed frame, 390x844 touch and 1280x800, no network call, a way out on every view; the managed edition's menu unchanged; no vendor word | browser + existing guards | `tax-flow.js`, the leak search, the slice guard | Partly |

### Sampling rate
- **Per task commit:** the Node checks.
- **Per plan merge:** the full gate.
- **Phase gate:** full gate, then the owner's own check on his phone with a real K-1 file.

### Wave 0 gaps
- [ ] `checks/k1-split.js`, `tax-math.js`, `tax-forms.js`, `tax-flow.js`
- [ ] The official forms as fixtures with `SHA256SUMS` (the K-1 for the split check only; the two 1099 forms bundled as script data)
- [ ] The IRIS column rules as a data table, each row with its source file and date
- [ ] Real combined K-1 files from the owner, outside the repository
- [ ] A real IRIS template

RED first: each check is written and seen to fail before the code it covers.

## Security Domain

`security_enforcement` is on, ASVS level 1.

| ASVS category | Applies | Control |
|---|---|---|
| V2 Authentication | Only with plan 08 | The invitation link's token (32 random bytes, only its hash stored) and login step |
| V3 Session Management | No | - |
| V4 Access Control | Yes | A tax document is visible to one investor id; confirming and delivering need `can('operate')`; withdrawing and the reporting type need the owner role |
| V5 Input Validation | Yes | Uploaded PDFs are read with `isEvalSupported: false` as today, size-limited, first bytes checked; every IRIS cell validated; entered amounts in whole cents |
| V6 Cryptography | Only with plan 08 | `server/lib/vault.mjs` for the document at rest |
| V7 Logging | Yes | Confirm, deliver, open, withdraw, consent, withholding lines, "filed": all logged, none with a full number |

| Threat | STRIDE | Mitigation |
|---|---|---|
| A K-1 or 1099 reaches the wrong investor | Information disclosure | Confirmation of every match; delivery lists recipients by name; withdraw; log |
| A full taxpayer number at rest in the browser | Information disclosure | Memory only; checks search storage and the log after a build |
| The IRIS file left behind | Information disclosure | Never stored; only its hash and row count |
| A cell that a spreadsheet would run as a formula | Tampering | The IRIS character rules exclude `=`, `+`, `@`; validation rejects them before download |
| A crafted PDF | Tampering | Reader options as today; nothing from the PDF is written to the page as HTML without escaping |
| A document link forwarded or guessed | Spoofing | Token strength as invitations; the login step; truncated numbers on recipient copies the portal makes |
| A sponsor's staff member changing a withheld amount after payment | Repudiation | Lines are fixed once the run is recorded; a correction is a new logged entry |
| Real K-1s in the repository | Information disclosure | Owner's files stay in SCRATCH; fixtures are built from the blank IRS form with invented people |

## Project Constraints (from CLAUDE.md)

`.planning/config.json` points at `./.claude/CLAUDE.md`, which does not exist; the instructions are in `./CLAUDE.md` and `.planning/AUTOPILOT.md`. What binds plans for this phase:

- Nothing is called ready, working or done until tested on documents never seen before and checked by the owner. Failures are reported first.
- No time that was not measured.
- An outside service that could do the job better is put to the owner with cost, accuracy, speed and trade-offs before building in-house; $0 first.
- GSD for all work: research, plan, plan check, executors in isolated copies, verifier, owner checks.
- No corners cut; no waste; only what the law or the task needs; no extra text on screens; nothing mandatory for investors (D-30).
- A question to the owner goes with a push notification; after 15 minutes, choose, record why, continue.
- White label: no vendor, model or library name on any screen; the word "basic" never appears. The managed edition is unchanged unless a plan says so.
- No work on the in-house reader (D-33). No paid API calls by agents; no keys given to agents.
- Every user-facing plan proves its screens in the sandboxed frame with no network at 390x844 with touch and at 1280x800; no fetch on a path that must work without a server; no Blob in IndexedDB; no browser PDF viewer; every view has a way out; dialogs scroll.
- RED-first checks; worktrees from the latest `claude/refract-reskin`; push only to `wip/<branch>`; never touch STATE.md or ROADMAP.md except a planner's own phase section; gate counts exact.
- Never commit confidential documents or personal data; never open SCRATCH/blind/.

## Sources

### Primary (downloaded from www.irs.gov and read this session; file date in brackets)
- Publication 1099 (2026), General Instructions for Certain Information Returns [March 19, 2026] - irs.gov/pub/irs-pdf/p1099.pdf
- Publication 5717 (Rev. 9-2026), IRIS Taxpayer Portal User Guide, processing year 2027 - p5717.pdf
- Publication 5718 (Rev. 11-2026), IRIS A2A Specifications - p5718.pdf
- Publication 1179 (Rev. July 2026), Rev. Proc. 2026-18, IRB 2026-30 - p1179.pdf
- Publication 1167 (Rev. October 2026), Rev. Proc. 2026-31, IRB 2026-44 - p1167.pdf
- Rev. Proc. 2012-17 - irs.gov/pub/irs-drop/rp-12-17.pdf (read in full)
- Instructions for Form 1065 (2025) [January 16, 2026]; Schedule K-1 (Form 1065) 2025 [January 6, 2026]
- Instructions for Forms 1099-INT and 1099-OID (Rev. January 2024); Form 1099-INT (Rev. January 2024)
- Instructions for Form 1099-DIV (Rev. January 2024); Form 1099-DIV (Rev. January 2024) [file of December 30, 2025]
- Instructions for Forms 1099-MISC and 1099-NEC (Rev. December 2026)
- Instructions for Form 1042-S (2026) [December 3, 2025]; Form 1042-S (2026); Instructions for Form 1042 (2025)
- Publication 515 (2026) [March 10, 2026]
- Instructions for Forms 8804, 8805 and 8813 (Rev. December 2026) [October 22, 2026]
- Instructions for Form 8288 (Rev. January 2026)
- Instructions for Form 945 (2026) [November 3, 2026]; Publication 15 (2026)
- Instructions for the Requester of Form W-9 (Rev. March 2024); Instructions for the Requester of Forms W-8 (Rev. June 2022)
- irs.gov/pub/irs-efile/ty2025-template-formatting-guidelines.zip (updated January 14, 2026): the 1099-INT, 1099-DIV and 1042-S files
- irs.gov/filing/e-file-information-returns-with-iris; irs.gov/tax-professionals/iris-application-for-tcc; irs.gov/e-file-providers/iris-schemas-and-business-rules; irs.gov/tax-professionals/taxpayer-identification-number-tin-matching; irs.gov/payments/information-return-penalties
- The codebase at the files and lines cited

### Measured this session
- SCRATCH/r10/scripts/k1split.js and the two files it wrote under SCRATCH/r10/k1out/

### Tertiary (search-engine summaries only; pages not opened; leads, not facts)
- taxbandits.com/pricing and a TaxBandits support article; tax1099.com comparison pages; a Sovos help page on 1042-S pricing; toolradar.com; k1x.io; covercy.com; carta.com on K-1 delivery

No page fetched contained text addressed to an automated reader or any instruction to act on.

## Metadata

**Confidence breakdown:**
- What the IRS requires, dates, thresholds, IRIS rules: HIGH - current IRS documents read; regulation text not read.
- What the portal holds: HIGH - read at the lines cited.
- Splitting a K-1 file: MEDIUM - measured on the official form with the portal's own libraries; no real CPA file.
- The IRIS upload file: MEDIUM - column rules read for tax year 2025; the template itself and tax year 2026 not seen.
- Withholding boundaries: HIGH on what the IRS documents say; the per-fund answers belong to a CPA.
- Outside prices: LOW - nothing read from a vendor.

**Research date:** 2026-11-19
**Valid until:** 2026-12-19. Re-read before building the IRIS table: the IRS publishes tax year 2026 upload rules and the 2026 Schedule K-1 around January 2027.
