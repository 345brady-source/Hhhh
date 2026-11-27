# Competitors, Prices and a Recommended Price for the Portal

**Researched:** 2026-11-27 (every price and claim below was seen on this date)
**Scope:** white-label investor portals and fund software for real-estate and private-fund sponsors (syndicators, emerging managers), plus the separate tools sponsors combine today
**How the evidence was gathered:** web search only. The session's network rules blocked opening vendor pages directly (investnext.com, cashflowportal.com, syndicationpro.com and covercy.com all failed to resolve). So every figure here comes from search-result extracts of vendor pages, review sites (Capterra, G2, Software Advice, GetApp) and press, not from pages I read in full. The GSD confidence classifier rates all web-search and web-fetch evidence **LOW**. Within that, vendor pages rank above review sites, and review sites rank above blogs and forums. Treat every number as something to confirm before anyone relies on it in a sales conversation.
**Status words for our product:** BUILT AND MERGED (code and plan summaries are on branch `claude/refract-reskin`; the owner has not checked it), BUILDING (some plans merged, others open), PLANNED (no code yet). Nothing here is "ready" or "launched". The owner has signed off on none of it.

## One-screen summary

| Competitor | Typical price (evidence) | White-label | E-sign included | ACH / payments model | Fund accounting | Tax documents |
|---|---|---|---|---|---|---|
| **Our portal (self-serve)** | $0 for 12 months for the first 40 sponsors, then $100/mo (owner's current plan) | Yes: only the sponsor's brand; sponsor can run it on its own server (BUILT) | Yes, no per-envelope fee (engine BUILT; automatic field placement BUILDING, scored 65-96% on 4 unseen agreements, 3 of 4 under the 90% bar) | NACHA file the sponsor uploads to its own bank; $0; no money transmitter; credits only, capital calls by wire (BUILT; upgrades BUILDING) | Double-entry journal, bank reconciliation, CPA year-end package (BUILT, CPA review pending) | K-1 split and delivery, 1099-INT/DIV, IRS IRIS file, withholding (BUILT, not yet tried on real CPA K-1 files) |
| Juniper Square | Not published. Old listed entry price was $18,000/yr for firms under $50M equity | Branded portal; own domain not confirmed | Yes, through DocuSign: 1,000 envelopes/yr included, then $5 each (rate card dated Feb 2024, possibly outdated) | Payments inside the platform, $0.50 per ACH (same rate card) | Yes, plus fund administration services | Not confirmed in the sources found |
| InvestNext | Fundraising $99 or $299/mo (sources conflict); All-In-One from $499/mo billed yearly (up to $10M); Firm about $699/mo; onboarding fee not published | Yes; own domain is a paid add-on | Yes | Inside the platform; 0.03% + $0.25 per payment, capped at $25 (third-party figure) | Waterfalls and cap table; general ledger not found | One .zip of K-1s matched and delivered |
| Agora | From $749/mo (Essential, official page; an older page says $599), priced by equity under management | Yes, including own domain | Yes | Inside the platform; ACH fees waived on Pro and Enterprise | Higher tiers, plus co-sourced fund administration | K-1 delivery (through the administration service) |
| Covercy | Fundraising Starter $498/mo, or $249 per entity per month; banking $79-$799/mo | "White-labeled portal"; own domain not found | Yes (Dropbox Sign integration listed) | Its own banking product (Thread Bank, through Unit); ACH, wire, check | Fund administration tier, quoted on request | K-1 matching, K-1 preparation support |
| Cash Flow Portal | CRM Core $0 (1,500 contacts); Marketing Pro $199/mo; syndication suite price not published (older listings say $99/mo, a review says $699/mo) | Yes: custom URL and logo ("your brand") | Yes, with W-9 and SEC questionnaire | Its own banking product, next-day ACH (it is not a bank) | Not found | Not confirmed |
| SponsorCloud (formerly SyndicationPro) | Not published; based on equity under management; one site estimates $95-600/mo (unverified) | Yes | Yes | ACH and checks inside the platform | Not found | Not confirmed |
| AppFolio Investment Manager | About $650-700/mo (third-party listings) | Custom-branded portal | Yes, built in | ACH contributions and distributions | Property accounting through AppFolio Property Manager | Not confirmed |
| Yardi Investment Suite | Quote only; Capterra shows $749 per user per month (unconfirmed) | Branded portal | Yes, for subscriptions | Not confirmed | Yes (separate Investment Accounting module) | Tax documents shown in the portal |
| Typical do-it-yourself set | Portal $99-$749/mo + DocuSign $25-45/user/mo + accreditation $59-$100 per investor + administrator $19,500-$150,000/yr or a CPA | Depends on the portal | Paid separately | Usually the portal's payment rail, or the bank | Administrator or CPA | CPA, about $150-$300 per investor per year for K-1s (vendor blog figure) |

## Recommendation in five lines

1. Keep a low flat list price: **Starter $99/month** (the owner's $100 plan). It includes e-signature, NACHA files, investor tax documents, fund accounting and reports, for up to 100 investors.
2. Add **Growth at $249/month** for more than 100 investors. Per-use items stay separate at the prices already set in the server: verification package $19 or $99 per investor, Form D $100, amendment $50, state notices $100 plus state fees.
3. Waive the portal fee for any sponsor who buys the firm's fund administration (the managed edition). The portal's job is to bring sponsors to that service, not to earn the most per seat.
4. Do not charge from month 13 until the BUILDING items are owner-checked: server sign-in and storage, email from the sponsor's domain, and automatic field placement. At today's state, $99 is not yet credible against hosted competitors.
5. Uncertainty is high. Nearly all competitor prices are unpublished or come from third parties, and nobody has measured what sponsors will pay. Use the 40 free sponsors to test that before the price is final.

## 1. Our product: what exists, from the repository

Sources: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, the phase folders (count of PLAN vs SUMMARY files), `README.md`, `git log` and the code in `assets/js/` and `server/`. A plan counts as merged when its SUMMARY is on this branch. The owner has checked none of this.

| Capability | Status | Evidence and plain caveats |
|---|---|---|
| Sponsor console, sponsor sign-up, firm branding, white-label investor portal (no vendor name, no "Powered by") | BUILT AND MERGED | Pre-GSD work (`tenants.js`, `brand.js`, `portal.html`), described in README "Two editions" |
| Two editions: self-serve (DIY) and managed (the firm runs it for clients) | BUILT AND MERGED | `edition.js`, README |
| Offerings, offering-document intake that reads PPMs, investor invitations, CSV/Excel import, offering sign-up links | BUILT AND MERGED | `intake.js`, `invitations.js`, README. Intake through the server's model key: plan 01.4-66 merged |
| Guided investor onboarding in one link (login, investor details, identity, accreditation, tax form, bank details, subscription, signing) | BUILT AND MERGED | `onboarding.js`, README "Turnkey investor onboarding" |
| Built-in e-signature: field editor (drag across pages, snapping, undo), six handwriting signature styles, drawn and uploaded signatures, signing inside onboarding, sponsor countersigning, signed PDF with certificate page, audit trail and SHA-256 hashes | BUILT AND MERGED | Commits `feat(02)`, `feat(04)`, `feat(05)` and "Signatures: six handwriting styles" (`fieldeditor.js`, `signature.js`, `signflow.js`, `record.js`). Phases 2-5 have no GSD plan files, and the roadmap's progress table still says "Not started". README lists what is missing before production: signer identity checks, IP capture on the server, and a server-side seal on the certificate |
| Automatic field placement on any subscription agreement | BUILDING | Phase 01.4: 31 of 66 plans have summaries. Measured on 4 unseen agreements (text readings, D-46 scoring): 83.7%, 65.4%, 68.4%, 96.2%; the picture reading of the first scored 91.5%. Three of the four text readings are under the 90% bar (`01.4-BLIND-SUBS-RESULT.md`). Phases 01.2 and 01.3 (picture forms and the owner's three documents) are merged |
| Co-investor (second investor on an account who signs their own places) | BUILT AND MERGED | `coinvestor.js`, commit `feat(co-investor)` |
| Capital calls, distributions, waterfalls (preferred return, catch-up), share classes, structures, investor requests (redemptions), documents, notices, audit schedules | BUILT AND MERGED | Pre-GSD (`structures.js`, `workspace.js`, `audit.js`); PROJECT.md "Validated" |
| W-9, W-8BEN, W-8BEN-E (the official IRS PDFs, filled and e-signed in onboarding); investor-status questions: the Rule 506(b) count against 35, the Reg A Tier 2 10% limit, the ERISA 25% benefit-plan test | BUILT AND MERGED | Phase 06: 38 summaries, 06-VERIFICATION.md present |
| Help chatbot (answers from the portal's own guide, no vendor name) | BUILT AND MERGED, accuracy not measured | Phase 07: 4 of 4 plans, verification present. HELP-06 (measured on unseen questions) is still open |
| Verification package: KYC, sanctions/PEP screening and accreditation, added with one tick box and paid from the sponsor's card ($19 identity and screening, $99 full package, set in server config); continuous monitoring; free re-screen against the U.S. Treasury lists; re-verify request; AML program record | BUILT against stand-ins only | Phase 08: 17 of 20. Not done: 08-03 (accreditation provider plug-in, waiting on the provider's API reference), 08-10 (free methods, deferred), 08-12 (real runs with the owner's provider keys and a test card). No real provider and no real card charge has been run. The ID provider's own page appears for that one step (white-label exception C-01). Separately, the older pluggable-provider connections and the free Treasury screening (README) are BUILT |
| Filings tab: Form D due dates, the Form D builder (validated against the SEC schema), EDGAR access steps, orders (Form D $100, amendment $50, state notices $100 plus state fees), staff upload and result back to the tab | BUILT AND MERGED, filing by staff upload | Phase 09: 8 of 10. Not done: 09-08 (EDGAR API route, needs the owner's SEC set-up) and 09-10 (state fee table, waiting on the official fee matrix from the owner) |
| Investor tax documents: CPA's K-1 file split by investor and matched (sponsor confirms each match), delivery under IRS consent rules, 1042-S/8805 path, withholding (24% backup, 30% foreign), 1099-INT and 1099-DIV Copy B, the file for the IRS IRIS site | BUILT AND MERGED | Phase 10: 13 summaries. Not done: 10-13 (measured on real K-1 files from a CPA, and the IRS file header pinned to the IRS template) |
| Fund accounting: double-entry journal in cents, posting from every money event, bank statement import (CSV, OFX, BAI2) and reconciliation, valuations, month close, trial balance, ledger, cash flows, CPA year-end workbook and PDF | BUILT AND MERGED, CPA review pending | Phase 11: 17 of 18. Not done: 11-17 (a CPA's read of a sample package, Excel and Numbers checks, a masked bank export) |
| Report builder: investor statements, capital-account statements, distribution notices, quarterly and annual letters, performance, tax-season summaries; PDF and spreadsheet; delivered to investors' Documents | BUILT AND MERGED | Phase 12: 9 of 9 summaries |
| Email from the sponsor's own domain: one branded template set, SPF/DKIM/DMARC set-up, sealed sent log, unsubscribe and preferences | BUILDING | Phase 13: 8 of 12. Merged: templates, mail adapters, sending as the sponsor from its own verified domain, the messages route, invitation emails, tax notices. Open: notices and capital-call emails, e-sign notices, the console's Emails page, the proof run. The Integrations page says "Live sending: To be confirmed" |
| Portal messaging and data room (NDA-gated, view tracking, soft commitments, watermark) | BUILDING, logic only | Phase 14: 4 of 13. Merged: the message and data-room records and the server modules (not yet mounted). No screens yet |
| Security: two-step sign-in, five roles, audit log, encryption of tax and bank numbers at rest, backups, password reset, security page | BUILDING | Phase 15: 8 of 20. Merged: server sign-in core, the two-step code module, keys and backups, the role table, the served pages with a content security policy, two-step on the server, roles on every route, the workspace held sealed on the server. Open: the sign-in screens, the console by role, password reset, the console working from the server workspace (15-17), the investor's own server sign-in, the security page. The older admin/team-member roles are BUILT |
| Where the data lives | BUILDING (important) | PROJECT.md: "Data currently lives in the browser (localStorage and IndexedDB), with an optional integration server." Until 15-17 merges, a sponsor's data is not held centrally for a team on several devices the way hosted competitors hold it |
| NACHA/ACH payment files at $0: credit files for distributions and redemptions; the sponsor uploads them to its own bank; no money transmitter, the firm never holds funds | BUILT AND MERGED (base), upgrades BUILDING | `nacha.js` builds PPD/CCD credit batches with an optional offset debit. Its own header says "capital calls go by wire" and "no IAT". Phase 16: 6 of 14 merged (banking days for any year, one record per payment file, fixture hygiene, builder refusals, the books for a returned payment, the return and notification-of-change reader). Open: pre-notes, international wires, matching and applying returns, the Returns screen, redemption files, the investor's side |
| Node server the sponsor can run (`server/`: invitations, mail, billing, filings, tax documents, auth, vault, help) | BUILT AND MERGED | `server/index.mjs`, `server/lib/*.mjs`, its own test suite |
| Investor mobile app ("Shareholder Desk") | Exists in `mobile/`, not checked in this research | README says both editions use it. PROJECT.md puts mobile out of scope for now |
| CRM, fundraising pipeline, email marketing | Not built, not planned | Not in the roadmap. The data room's soft commitments (Phase 14) are the nearest piece |
| Collecting capital by ACH debit, or holding money in the platform | Not built, not planned (by design) | Phase 16's goal: no paid provider, and the firm never holds funds |

## 2. Competitors in detail

Every line was seen on 2026-11-27 in web-search extracts of the page named; I could not open the pages themselves (see the header). "Possibly outdated" marks evidence the source itself dates to more than 12 months before 2026-11-27. "Not found" means the searches did not turn it up, not that the product lacks it.

### 2.1 Juniper Square — the market leader, mid-size and institutional GPs

- **Who it is for:** real-estate and private-fund GPs from emerging managers to institutions. Tiers scale with investor equity; the top tier is described as for firms "over $500M in Investor Equity" (G2, https://www.g2.com/products/juniper-square/pricing).
- **Price:** not published; quote only, priced by equity under management. The figure seen most often, "starting at $18,000 per year" (Capterra https://www.capterra.com/p/171269/Juniper-Square/pricing/, GetApp https://www.getapp.com/all-software/a/juniper-square/), is described by Agora as what Juniper Square "used to advertise", with the entry tier for firms under $50M in equity (https://agorareal.com/compare/juniper-square-pricing/). G2's pricing data was last updated 2019-01-16: **possibly outdated**. A 2026 review calls pricing "quote-only" and the $18,000 figure "historical" (https://www.peony.ink/blog/juniper-square-review).
- **Per-use charges (vendor rate card, rev. 2024-02-01, possibly outdated):** $0.50 per ACH started through its payments; e-signatures: the first 1,000 envelopes free (an older version says 1,000 DocuSign envelopes per annual service period), then $5 per extra envelope (https://www.junipersquare.com/terms-and-policies/rate-card, https://www.junipersquare.com/terms-and-policies/rate-card-v20230517).
- **Set-up fee:** not found.
- **Capabilities:** investor portal, CRM, subscription documents with e-signature, ACH and wire distributions "within Juniper Square", capital balances per investment, fund accounting and fund administration services, and an AI layer (JunieAI) (https://junipersquare.com/pricing, https://www.junipersquare.com/administration, https://www.junipersquare.com/platform/junie-ai).
- **White-label:** branded portal; own domain not confirmed by any source found.
- **ACH model:** payments inside the platform, charged per ACH.

### 2.2 InvestNext — syndicators and small-to-mid funds, the closest published price ladder

- **Who it is for:** real-estate syndicators and fund managers; All-In-One "up to $10 million Funds Under Management"; larger firms get custom pricing.
- **Price (vendor page via search, https://www.investnext.com/pricing):** All-In-One "starts at $499 per month, paid annually, up to $10 million". The Fundraising tier is **conflicting**: one extract says "flat rate of $299 per month", another "30 Days Free and then $99 per month". Firm tier about $699/mo for $10M-$500M (third-party: https://zoftwarehub.com/en-ae/products/investnext/pricing, https://us.fitgap.com/products/024438/investnext). TrustRadius shows "$55 per month, does not include set up fee" and ITQlick "$499/month" (https://www.trustradius.com/products/investnext/pricing, https://www.itqlick.com/investnext/pricing); both look stale.
- **Set-up fee:** yes. "An initial data migration and onboarding fee, which is determined based on your tier and the specific services you select"; amount not published (https://www.investnext.com/pricing).
- **Per-use charges:** "0.03% + 25¢ per individual payment transacted (capped at $25)" (third-party: https://rentalrealestate.com/tools/investnext/). ACH fees waived on the top Institution tier (pricing page).
- **Capabilities:** white-label investor portal; **custom investor portal domain as a paid add-on**, price not disclosed; integrated e-signatures in document management and commitments; ACH in and out up to $1M per transaction; a waterfall builder that calculates and pays distributions ("No third-party payment processors. No NACHA file uploads."); upload one .zip of K-1s, matched and delivered automatically (https://www.investnext.com/platform/distributions/, https://www.investnext.com/?p=706, https://www.investnext.com/?p=4178).
- **ACH model:** money moved inside the platform, priced per payment.

### 2.3 Agora — real-estate GPs, priced by equity under management

- **Who it is for:** real-estate investment managers; pricing "based on equity under management and/or project count" (https://www.itechguides.com/products/agora/).
- **Price:** Essential "starts from $749/month" on the official pricing page (https://agorareal.com/pricing/); Capterra and Software Advice show $749 flat per month (https://www.capterra.com/p/247616/Agora/pricing/). An Agora landing page and SourceForge show "Pay as you grow" from $599/month (https://lp.agorareal.com/cmp_sh, https://sourceforge.net/software/product/Agora-Real-Estate) — likely older. Pro and Enterprise prices are not published. Itechguides says it is billed yearly, paid quarterly.
- **Set-up fee:** not found; Enterprise includes "white-glove onboarding".
- **Capabilities:** investor portal, CRM, fundraising suite, integrated payments (Essential); data room and email marketing (Pro); e-sign on every document, with subscriptions using auto-generated signature fields; accreditation and KYC/AML inside the subscription flow; ACH, wire or check in, ACH out; fund administration co-sourced through partners (fund accounting, capital accounts, financial statements, K-1 delivery) (https://agorareal.com/ach-payments, https://agorareal.com/real-estate-investor-portal/, https://agorareal.com/fund-administration-services/, https://agorareal.com/investor-accreditation/).
- **White-label:** yes, "white-label branding on your domain".
- **ACH model:** inside the platform; ACH fees waived on Pro and Enterprise. Agora's own estimate of outside fund administration minimums: $50K-$150K per year (https://agorareal.com/gp-hub/fund-admin-vs-software/; a competitor's claim).

### 2.4 Covercy — investment management with its own bank accounts

- **Who it is for:** commercial real-estate sponsors; priced per legal entity.
- **Price (vendor page via search, https://www.covercy.com/pricing):** Fundraising Starter $498 per month, or $249 per entity per month (CRM, investor portal, fundraising, distributions, reporting, funds and capital calls). US banking tiers $79-$799 per month (https://www.covercy.com/products/us-banking/). Older third-party figures: Standard $480 and Professional $688 (Capterra https://www.capterra.com/p/173106/Covercy/pricing/); $398 starting (Software Advice, GetApp) — older. 14-day free trial. Fund administration is quoted.
- **Set-up fee:** not found.
- **Capabilities:** e-signed NDAs and subscription documents with GP countersignature; distributions by ACH (1-3 business days), wire, check or SWIFT; multi-tier and custom waterfalls, promote allocations, share classes; K-1 matching and K-1 preparation support (https://covercy.com/product/distributions/). A G2 listing names Dropbox Sign as the e-sign integration.
- **White-label:** "white-labeled, secure portal"; own domain not found.
- **ACH model:** its own banking product. Covercy is "not a bank"; banking is through Thread Bank, Member FDIC, on Unit (https://www.unit.co/case-study/covercy).

### 2.5 Cash Flow Portal — low-cost syndication software with its own banking

- **Who it is for:** new and established real-estate GPs (syndications and funds).
- **Price:** the vendor's pricing page shows CRM "Core $0/mo billed yearly, up to 1,500 contacts" and "Marketing Pro $199/mo billed yearly" (https://www.cashflowportal.com/pricing?tab=crm). The syndication/fund suite price did not appear in any extract (https://www.cashflowportal.com/pricing?tab=funds). Third-party: "starting at $99.00 per month" (SaaSworthy https://www.saasworthy.com/product/cash-flow-portal/pricing, last updated January 2022: **possibly outdated**; Capterra https://www.capterra.com/p/227758/Cash-Flow-Portal/pricing "$99, usage based"); one review says plans start at $699/month (https://www.gappsy.com/tools/cash-flow-portal/). **The real suite price is unknown.**
- **Capabilities:** distributions by ACH or check with waterfalls, hurdles and preferred returns; next-day ACH distributions; e-sign templates pre-filled, a digitized SEC questionnaire and W-9; accreditation through a Parallel Markets integration; 506(b) and 506(c); feeder-fund add-on (https://www.cashflowportal.com/features/real-estate-investor-portal, https://www.cashflowportal.com/products/banking).
- **White-label:** "Our portal, your brand"; set-up includes "selecting a custom URL, uploading your logo". Whether that is a fully own domain is not confirmed.
- **ACH model:** its own banking; "a financial technology platform and not a bank"; FDIC coverage up to $250K per deal entity.

### 2.6 SponsorCloud (formerly SyndicationPro) — syndicators

- **Who it is for:** real-estate sponsors and syndicators. SyndicationPro has been renamed SponsorCloud (https://www.sponsorcloud.io/, https://www.gappsy.com/tools/syndicationpro/, updated 2026-08-15).
- **Price:** not published; "based on Equity Under Management (EUM)" (Gappsy); quote-based (https://www.spotsaas.com/product/sponsor-cloud/pricing). Subscribed.fyi gives "$95-600 / Month" and calls it "only an estimated pricing range" (https://subscribed.fyi/syndicationpro/reviews/) — **unverified**.
- **Per-use charges:** accreditation letter through Parallel Markets $59, renewal $59 (https://help.sponsorcloud.io/investor-platform/how-to-verify-an-investors-accreditation-in-sponsorcloud).
- **Capabilities:** onboarding with e-signatures and 506(c) accreditation checks; white-label investor portal; ACH and check distributions inside the platform (press release https://www.prweb.com/releases/syndicationpro-disrupts-investor-distributions-and-leads-the-way-for-digital-transformation-with-ach-812800525.html, undated in the extract); multi-tier waterfalls with unlimited investor classes (https://www.sponsorcloud.io/platform/investment-distribution-software).
- **Set-up fee:** not found.

### 2.7 AppFolio Investment Manager — sponsors who already use AppFolio for property management

- **Price:** not published by the vendor. Third-party listings: about $650/month (GetApp) or $700/month (Software Advice, Capterra Ireland); Core plan $650/month, Premier custom (https://www.capterra.com/p/186948/AppFolio-Investment-Management/pricing/, https://agorareal.com/compare/appfolio-investment-management-pricing/ — a competitor's page).
- **Capabilities:** built-in e-signatures for subscription agreements, operating agreements and PPMs "without the need for any third-party tools"; ACH contributions and distributions; waterfall calculations; custom-branded portal; integration with AppFolio Property Manager for property accounting (https://appfolio.com/investment-manager/investment-management, https://www.appfolio.com/investment-manager).
- **Set-up fee, per-investor charges:** not found.

### 2.8 Yardi Investment Suite / Investment Manager — large and institutional real-estate managers

- **Price:** "pricing will depend on the needs of your business" (https://www.yardi.com/market/investment-management/). Capterra shows "$749.00 per user, per month" for Yardi Investment Manager but also "contact vendor" (https://www.capterra.com/p/248341/Yardi-Investment-Manager/) — unconfirmed. Investment Accounting is quoted by number of entities and AUM (https://zoftwarehub.com/en-bh/products/yardi-investment-accounting/pricing).
- **Capabilities:** subscription agreements through e-signature, capital calls, waterfall distributions, branded portal and CRM, statements and tax documents in the portal (https://www.yardi.com/product/investment-manager, https://www.yardi.com/blog/yardi-investment-suite/). ACH and own domain: not confirmed.

### 2.9 RealPage Investment Management (RealPage IMS)

- **Price:** "Starting at $1,000.00 per month" (Software Advice https://www.softwareadvice.com/investment-management/investor-management-services-profile/, Capterra https://capterra.com/p/169850/IMS-Platform/). G2's page was last updated 2020-03-03: **possibly outdated** (https://g2.com/products/realpage-ims/pricing). Quote required.
- **Capabilities found:** investor portal with positions, distribution history and performance metrics. E-sign, ACH and white-label: not confirmed.

### 2.10 Avestor — funds and syndications, mid-market

- **Price:** Scalable $600/month, Pro $1,500/month (GetApp https://www.getapp.com/finance-accounting-software/a/avestor); also "$24,000 per year" flat (Capterra https://www.capterra.com/p/10024787/Avestor/). InvestNext says Avestor "starts at $700/month" plus extra costs for administration services (a competitor's claim, https://www.investnext.com/landing/investnext-vs-avestor/).
- **Capabilities:** not researched in detail.

### 2.11 Carta (fund administration and LP portal) and Vauban

- **Who it is for:** venture and private-equity funds, not real-estate syndications. Vauban now operates as part of Carta (https://carta.com/blog/category/vauban/).
- **Price:** fund administration is quote-based (VC Beast benchmark, July 2026, https://vcbeast.com/fund-admin-pricing-benchmark). Reported ranges: $20,000-$30,000 a year for most emerging managers (https://teel.substack.com/p/the-emerging-vc-stack-angellist-vs) and $25,000-$50,000 a year for sub-$100M Fund I and II (https://valueaddvc.com/blog/vc-fund-administration-in-2026-the-best-fund-admins-and-what-they-cost). Both are secondhand; no Carta document was found.
- **Relevance:** a fund-administration competitor to the managed edition more than to the self-serve portal.

### 2.12 Allocations — SPVs and funds, including real estate

- **Price (vendor's own pages):** Standard SPV $9,950 one-time; Premium SPV $19,500 one-time (real estate included, up to 50 investors, extra closes $2,000 each); Fund plan $19,500 a year; $100 per investor above the included count; K-1 preparation is an add-on (https://www.allocations.com/spv-pricing, https://www.allocations.com/insights/how-spv-pricing-works-on-allocations). The pages conflict on some figures.
- **Relevance:** an administration-plus-portal bundle per vehicle; it competes with the managed edition.

### 2.13 Altvia — private-equity and venture CRM and LP portal

- **Price:** "$1,800.00 per year" starting price on directories (Software Advice, GetApp https://www.getapp.com/financial-crm-software/a/aim); otherwise quote through the vendor. Probably not the portal's full price. Weak relevance to syndicators.

### 2.14 Others checked and found not to be direct competitors

- **Passthrough** (the "Passthru" in the brief): investor-onboarding and subscription-document workflow sold to fund administrators and law firms. Its FAQ says it connects to any LP portal and will not build one (https://www.passthrough.com/faqs). No price published.
- **Dealpath:** acquisitions pipeline and deal management, not an investor portal. Pricing not published; Capterra's "$0.01" is a placeholder (https://www.capterra.com/p/164485/Dealpath/).
- **Sydecar:** SPVs, but its FAQ says it "does not currently support real estate" (https://sydecar.io/faq). Price for reference: 2% of capital raised, $2,500-$12,500, plus a $2,000 regulatory fee.
- **Groundbreaker:** real-estate investor management; no real price published (Capterra's "$0.01 per user per year" is a placeholder, https://capterra.com/p/183376/GroundBreaker/).
- **Market range overall:** "investor portal software for real estate sponsors ranges from $150-$3,000+/month depending on features and scale" (GowerCrowd, https://gowercrowd.com/real-estate-syndication/investor-portal-comparison, undated in the extract).

## 3. Capabilities side by side

Key: **Y** yes (source says so) · **P** partial · **A** add-on or charged per use · **N** no · **?** not found in the searches (not the same as "no"). For our column: **B** BUILT AND MERGED (not owner-checked) · **Bg** BUILDING · **Pl** PLANNED · **N** not built and not planned. Competitor cells cite the subsection of section 2 that holds the URL.

| Capability | Ours | Juniper Sq (2.1) | InvestNext (2.2) | Agora (2.3) | Covercy (2.4) | Cash Flow Portal (2.5) | SponsorCloud (2.6) | AppFolio IM (2.7) | Yardi (2.8) |
|---|---|---|---|---|---|---|---|---|---|
| Investor portal in the sponsor's brand | B | Y | Y | Y | Y | Y | Y | Y | Y |
| On the sponsor's own domain | B (the sponsor publishes the page or runs the server) | ? | A (paid add-on) | Y | ? | P (custom URL) | ? | ? | ? |
| E-signature inside onboarding | B, no envelope fee | A (DocuSign; $5 per envelope after 1,000) | Y | Y | Y (Dropbox Sign integration) | Y | Y | Y | Y |
| Signature fields placed automatically on the sponsor's agreement | Bg (65-96% measured; 3 of 4 under the bar) | ? | ? | Y (vendor says "auto-generated signature fields") | ? | P (pre-filled templates) | ? | ? | ? |
| Official W-9 / W-8 filled and signed in onboarding | B (W-9, W-8BEN, W-8BEN-E) | ? | ? | ? | ? | Y (W-9) | ? | ? | ? |
| 506(b) count of 35, Reg A Tier 2 limit, ERISA 25% test | B | ? | ? | ? | ? | P (506(b)/(c) support, SEC questionnaire) | ? | ? | ? |
| KYC and sanctions screening | B against stand-ins; real provider not run | ? | ? | Y | ? | ? | ? | ? | ? |
| Accreditation verification | B against stand-ins; provider plug-in Bg | ? | ? | Y | ? | A (Parallel Markets) | A ($59 per letter) | ? | ? |
| ACH distributions | B ($0 bank file; sponsor uploads) | A ($0.50 per ACH) | A (per-payment fee) | Y (fees waived on Pro and Enterprise) | Y (own banking; banking tiers $79-$799/mo) | Y (own banking) | Y | Y | ? |
| Capital collected by ACH | N (wire) | ? | Y | Y | ? | ? | ? | Y | ? |
| Money held or moved by the vendor or its bank partner | N (by design) | Y | Y | Y | Y | Y | Y | Y | ? |
| Waterfalls, share classes | B | ? | Y | ? | Y | Y | Y | Y | Y |
| Capital calls | B | ? | ? | Y | Y | ? | ? | Y | Y |
| Fund accounting (general ledger) | B | Y | ? | P (higher tiers, co-sourced) | A (administration tier) | ? | ? | P (property accounting) | A (separate module) |
| CPA year-end package | B (CPA review pending) | ? | ? | ? | ? | ? | ? | ? | ? |
| K-1 matched and delivered | B (not tried on real CPA files) | ? | Y | Y (through administration) | Y | ? | ? | ? | Y (tax documents) |
| 1099-INT / 1099-DIV and the IRS file | B | ? | ? | ? | ? | ? | ? | ? | ? |
| Withholding (backup 24%, foreign 30%) | B | ? | ? | ? | ? | ? | ? | ? | ? |
| Form D and state notices | B (staff upload; EDGAR API Pl) | ? | ? | ? | ? | ? | ? | ? | ? |
| Report builder / investor statements | B | Y | ? | ? | Y | ? | ? | Y | Y |
| Portal messaging | Bg | ? | ? | ? | ? | ? | ? | Y | ? |
| Data room | Bg (logic only) | ? | ? | Y (Pro) | ? | ? | ? | ? | ? |
| CRM and email marketing | N | Y | ? | Y | Y | Y (Marketing Pro $199/mo) | ? | ? | Y |
| Two-step sign-in, roles | Bg (older admin/team roles B) | ? | ? | Y (two-factor) | ? | ? | ? | ? | ? |
| Email sent from the sponsor's own domain | Bg | ? | ? | ? | ? | ? | ? | ? | ? |
| Data held centrally for the whole team (hosted) | Bg (browser storage until 15-17) | Y (hosted service) | Y | Y | Y | Y | Y | Y | Y |
| Sponsor can run it on its own server | B | ? | ? | ? | ? | ? | ? | ? | ? |
| Fund administration service from the same company | Managed edition (the firm's service) | Y | ? | Y (co-sourced) | Y (quoted) | ? | ? | ? | ? |

Reading the "?" cells: many are features these vendors probably have but did not show up in search extracts (for example K-1 delivery at Juniper Square). They must not be used as "they don't have it" in any sales material until someone checks the vendor's own page.

## 4. What a sponsor pays today for the same set of tools

### 4.1 Unit prices of the separate tools (seen 2026-11-27)

| Tool | Price evidence | Source |
|---|---|---|
| DocuSign eSignature | Standard $25/user/mo billed yearly ($45 monthly); Business Pro $40/user/mo yearly ($65 monthly); DocuSign's US listing also shows Business Pro at $45/user/mo. 100 envelopes per user per year on yearly plans. Sources conflict by a few dollars | https://www.capterra.com/p/121506/Docusign/pricing/, https://docusign.com/en-gb/products-and-pricing, https://www.docusign.com/blog/docusign-plans-and-pricing |
| signNow | Business $8/user/mo, Business Premium $15, Enterprise $30 (yearly billing); $20/$30/$50 monthly. Some 2026 sources say it moved to per-account pricing with 100 invites a year; unresolved | https://www.signnow.com/help/plans-pricing, https://www.signnow.com/blog/signnow-pricing/ |
| Accreditation letter | Parallel Markets through SponsorCloud $59 per letter; Verivest $75 per accreditation; Platform Eleven $100 per verification; VerifyInvestor not published (third-party estimates $15-$100); a CPA letter about $150 (forum) | https://help.sponsorcloud.io/investor-platform/how-to-verify-an-investors-accreditation-in-sponsorcloud, https://support.verivest.com/knowledge/parallel-markets-faq-verivest-help-center, https://platformeleven.io/506c-accredited-investor-verifications, https://angelinvestorsnetwork.com/regulatory-compliance/accredited-investor-verification-guide-third-party-services-2026, https://biggerpockets.com/forums/12/topics/955852-accredited-investor-online-certification-services |
| Parallel Markets direct | Not per investor: priced per record in the client database, with annual minimums, set by contract | https://support.parallelmarkets.com/hc/en-us/articles/4417810700685 |
| KYC and AML (Didit, the provider our package uses) | 500 full KYC checks free each month, then $0.33 per check; AML $0.20 (pricing page) or $0.30 (docs); conflicting | https://didit.me/pricing, https://docs.didit.me/identity-verification/pricing |
| 1099 e-filing | IRS IRIS portal free; Tax1099 $2.99 per form at 1-20 forms; Track1099 from $0.55 per form at volume | https://www.tax1099.com/tax-1099-efile-pricing, https://track1099.com/info/pricing |
| K-1 preparation | $150-$300 per investor per year (a vendor blog; the search extract did not tie the figure to one URL; probably https://www.cashflowportal.com/blog/guide-to-k-1s-for-real-estate-syndications) | see note |
| Fund administrator | Allocations Fund plan $19,500/yr (K-1 preparation extra); Agora's claim of outside-administrator minimums of $50K-$150K/yr; Carta $20K-$50K/yr for small VC funds (secondhand); "usually under 0.5% per year" (White Coat Investor) | https://www.allocations.com/insights/how-spv-pricing-works-on-allocations, https://agorareal.com/gp-hub/fund-admin-vs-software/, https://teel.substack.com/p/the-emerging-vc-stack-angellist-vs, https://www.whitecoatinvestor.com/private-real-estate-fund-fees/ |
| Form D and state notices | SEC charges no Form D fee; state fees vary (Utah: $600 for a Rule 506 notice); filing services quote case by case. The NASAA fee matrix is dated 2025-04-21 (possibly outdated by now) | https://commerce.utah.gov/securities/securities-library/fees/, https://www.nasaa.org/wp-content/uploads/efd/Form-D-fees-matrix.pdf, https://www.newsfilecorp.com/filing/edgar/formd.php |

### 4.2 A worked example (an illustration, not a quote)

Assumptions: one sponsor user; 60 investors; one 506(c) offering a year with 30 new investors who need accreditation letters; quarterly distributions of about $2,000 per investor; a CPA prepares K-1s either way.

| Line | Stitched together today (per year) | Our portal (per year, after the free year) |
|---|---|---|
| Portal software | InvestNext Fundraising $1,188-$3,588; All-In-One $5,988 plus an unpublished onboarding fee; Covercy Starter $5,976; Agora Essential $8,988 | $1,200 at $100/mo |
| E-signature (if the portal lacks it or charges per envelope) | signNow $96 to DocuSign Business Pro $540; Juniper Square: 1,000 envelopes included, then $5 each | $0 (included) |
| Accreditation, 30 letters | $1,770 (at $59) to $3,000 (at $100) | $2,970 at the $99 package, which also covers KYC and screening; the per-letter price is no better than the market. BUILT against stand-ins only |
| ACH distributions, 240 payments | Juniper Square 240 × $0.50 = $120; InvestNext about 240 × ($0.25 + 0.03% of $2,000) ≈ $204 (third-party fee figure); Agora Pro and Enterprise $0 | $0 from us. The sponsor's bank may charge for ACH origination; that fee was not researched and is not sourced here |
| 1099 forms | $0 (IRIS) to about $179 (Tax1099, 60 × $2.99) | $0: the portal builds the IRIS file and the sponsor uploads it with its own free code |
| Fund administrator | $19,500 to $150,000 (see 4.1) | Not included; the managed edition is the firm's paid service |
| **Software total without an administrator** | **about $3,000 to $12,700** | **about $1,200, or about $4,200 with 30 verification packages** |

What this shows: on software alone, a small sponsor pays roughly $3,000-$12,700 a year to the competitors or the separate tools. At $100/mo our list price is $1,200, the lowest of any full set found. But the competitors' prices buy things we do not have yet: hosted team data, money movement, CRM, and track record (section 5).

## 5. Recommended price, with the reasoning

### 5.1 Where a $99-$100 price sits

- **Published or evidenced prices for a full set** (portal, e-sign, distributions, documents) start at about $499/mo (InvestNext All-In-One, Covercy Starter $498) and go up to $749/mo (Agora Essential), about $650-700/mo (AppFolio), $1,000/mo (RealPage, possibly outdated) and $18,000/yr or more (Juniper Square, historical).
- **Cheaper entry tiers** exist only for fundraising or CRM: InvestNext Fundraising $99 or $299/mo, Cash Flow Portal Marketing Pro $199/mo, Cash Flow Portal CRM Core $0.
- At $99-$100/mo our list price sits **at the very bottom of the market**: level with the cheapest fundraising-only tiers, and about one-fifth of the cheapest all-in-one tiers. No competitor found offers e-signature, tax documents, fund accounting and Form D at that price.

### 5.2 Real differentiators (BUILT capabilities only)

All are BUILT AND MERGED and none is owner-checked. They may be shown to sponsors only after the owner has checked them.

1. **One flat price with e-signature included and no envelope fee.** Juniper Square charges $5 per envelope after 1,000; DocuSign is $25-$45 per user per month on its own.
2. **A $0 payment path with no money transmitter.** Distribution files go straight to the sponsor's own bank, so money never sits with a vendor. Juniper Square charges $0.50 per ACH, InvestNext a per-payment fee, and Covercy charges $79-$799/mo for banking.
3. **Compliance inside onboarding.** The official W-9, W-8BEN and W-8BEN-E are filled and e-signed; the 506(b) count of 35, the Reg A Tier 2 10% limit and the ERISA 25% test are built in. None of this appeared in any competitor material found.
4. **Investor tax work most portals leave to the CPA or administrator:** K-1 split, match and delivery under the IRS consent rules; 1099-INT and 1099-DIV with the IRS IRIS file; backup and foreign withholding.
5. **Double-entry fund accounting and a CPA year-end package** at the portal's price. Elsewhere this is an administration tier or a separate module.
6. **A Form D builder with due dates, and filing orders.** No competitor found offers this.
7. **A report builder** for statements, letters and notices.
8. **Full white-label on the sponsor's own domain with no vendor name anywhere, and a server the sponsor can run itself.** InvestNext charges extra for its own domain.

### 5.3 BUILDING or PLANNED (cannot be sold yet)

Automatic field placement on any agreement (measured 65-96%, 3 of 4 under the bar). Email from the sponsor's domain. Messaging and the data room (logic only, no screens). Security: sign-in screens, the console by role, password reset, server-held workspace. ACH upgrades: pre-notes, wires, returns. Live KYC, screening and accreditation providers, and real card charges. The EDGAR API filing route. The state fee table.

### 5.4 What competitors have that we lack

1. **Hosted, central data for a team.** Today the data lives in the browser unless the sponsor runs the server; plan 15-17 is open. This is the largest gap. A sponsor who loses the browser data, or works from two devices, is exposed. All the major competitors are hosted services.
2. **Money movement.** Competitors collect capital by ACH (InvestNext, Agora, AppFolio) and pay out without a file upload ("No NACHA file uploads", InvestNext). Ours makes the sponsor upload a file to its bank, and capital calls go by wire. Our $0 cost is real, but it is also a convenience gap, and the sponsor needs its bank's ACH origination service (bank fees not researched).
3. **CRM, fundraising pipeline and email marketing** (Juniper Square, Agora, Covercy, Cash Flow Portal, Yardi).
4. **Proven integrations** for accreditation and KYC (Parallel Markets at Cash Flow Portal and SponsorCloud). Ours are stand-ins until 08-03 and 08-12 run.
5. **Track record, support teams and security attestations.** Competitors' attestations were not checked in this research. Ours has no SOC 2, and Phase 15 says to claim none.
6. **E-sign evidence that stands up on its own.** The README lists signer identity checks, server-side IP capture and a server seal on the certificate as missing before production.

### 5.5 How the free year for 40 sponsors and the funnel purpose change the price

- **The price only starts in month 13.** What matters now is (a) whether the 40 sponsors use the portal for real offerings during the free year, and (b) whether the BUILDING items, above all server-held data and sign-in, are owner-checked before anyone is billed. A price on a product that keeps data only in a browser will meet resistance at any level.
- **The portal is a funnel to fund administration.** The managed edition's fee is where the money is: outside administrators charge $19,500 to $150,000 a year (section 4.1). So the portal should be priced to lower the barrier to entry, not to maximise per-seat revenue. That argues for staying at or near $99, not moving to the $499-$749 market band, even though the BUILT scope is wider than many of those tiers.
- **A price that is too low can signal a toy.** At $99 with everything included, sponsors may doubt it. The answer is the owner-checked proof on real documents (CLAUDE.md), not a higher price.
- **The free year costs the owner real money for paid parts:** server hosting and the model calls for the help bot and intake. Those costs were not measured in this research. The verification package and filings are already charged per use, so they do not add to that cost.

### 5.6 Pricing options

**Option A — Flat $100/mo, everything included (the owner's current plan)**
- For: simplest to explain; the lowest full-set price in the market; nothing to meter; fits the funnel.
- Against: a sponsor with 1,000 investors pays the same as one with 20, and server and email costs grow with investors; no upgrade step other than the managed edition.

**Option B — Two tiers by investor count, plus per-use add-ons (recommended)**
- Starter $99/mo: up to 100 investors, unlimited offerings, everything BUILT included (e-sign, NACHA files, tax documents, fund accounting, reports, Form D builder).
- Growth $249/mo: more than 100 investors.
- Annual prepay: 12 months for the price of 10 (common in the market; Agora and InvestNext bill yearly).
- Per-use items kept at the server's current prices: verification package $19 or $99 per investor, Form D order $100, amendment $50, state notices $100 plus state fees at cost.
- Portal fee waived for sponsors who take the managed fund administration.
- For: still the cheapest full set; earns more where costs are higher; investor count is already in the product, so nothing new needs measuring; easy to check.
- Against: one more thing to explain; the 100 limit is a judgement, not a measured figure; a sponsor near the limit may resent the jump.
- Why investor count and not AUM: InvestNext, Agora and SponsorCloud price by equity under management, but a self-serve product cannot verify AUM without asking for it, and sponsors read AUM pricing as a tax on growth. Investor count is visible, honest and matches where our costs come from.

**Option C — Low base plus per-investor fee**
- $49/mo plus $1 per active investor per month.
- For: tracks cost and value closely.
- Against: harder to predict; sponsors see a meter on every investor they add, which works against the funnel.

**Recommendation: Option B,** with the 40 founding sponsors kept at $99 flat at any investor count for 24 months after their free year, which honours the offer. Charge nothing in month 13 until server-held data, sign-in and email from the sponsor's domain are merged and owner-checked. If they are not, extend the free period rather than bill for an unfinished product.

### 5.7 Uncertainty, stated plainly

- Most competitor prices are not published. The figures here come from search extracts of vendor pages and from review sites, several of them dated 2019-2024. None of the vendor pages could be opened directly in this session.
- Nobody has asked sponsors what they would pay. The 40 free sponsors are the cheapest way to find out: ask at month 9 whether they would pay $99 or $249, and record the answers.
- Our hosting, model and email costs per sponsor were not measured, so the margin at $99 is unknown.
- The recommendation assumes the BUILDING items are owner-checked before billing starts. If they are not, the right price is $0.

## 6. Claims that could not be sourced, and open questions

### Could not be sourced (do not repeat them as fact)

- Any competitor's price read on its own live pricing page. Pages were blocked; every price came from search extracts or review sites.
- Juniper Square's current entry price; whether it offers its own domain; K-1 delivery; capital collection by ACH.
- InvestNext's Fundraising price ($99 and $299 both appear); the amount of its onboarding fee and of its custom-domain add-on; its ACH fee (0.03% + $0.25 comes from a third-party review and may be a misprint of 0.3%).
- The price of Cash Flow Portal's syndication/fund suite.
- Any SponsorCloud price (the $95-$600 range is an estimate by a listing site).
- AppFolio Investment Manager, Yardi and RealPage prices from the vendors themselves.
- Passthrough, Dealpath, Groundbreaker and Altvia portal prices.
- Carta's fund-administration price from any Carta document.
- VerifyInvestor's own per-letter price (the project's earlier $69 figure, in 08-CONTEXT, was also read through search results and marked unconfirmed).
- What banks charge sponsors for ACH origination, which is the hidden cost of our $0 bank-file path.
- Competitors' security attestations (SOC 1 or SOC 2).
- The source URL of the $150-$300 per-investor K-1 preparation figure (vendor blog, URL not tied in the extract).
- Our own cost to serve one sponsor (hosting, model calls, email).
- What sponsors will pay. No survey, interview or test exists.

### Open questions for the owner or later research

1. Open the vendor pricing pages directly once the session's network allows these hosts: investnext.com, cashflowportal.com, covercy.com, agorareal.com, sponsorcloud.io, junipersquare.com. Then replace the search-extract figures here.
2. Ask the owner's own bank what it charges for ACH origination and same-day files. That is the true cost of our payment path to a sponsor.
3. Measure hosting, model and email cost per sponsor in the free year, to set the margin.
4. Decide whether the investor-count limit for Starter is 100 or another figure, after seeing the 40 sponsors' real investor counts.
