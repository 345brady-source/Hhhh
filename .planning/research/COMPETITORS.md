# Competitors, Prices and a Recommended Price for the Portal

**Researched:** 2026-11-27 (every price and claim below was seen on this date)
**Scope:** white-label investor portals and fund software for real-estate and private-fund sponsors (syndicators, emerging managers), plus the separate tools sponsors combine today
**How the evidence was gathered:** web search only. The session's network rules blocked opening vendor pages directly (investnext.com, cashflowportal.com, syndicationpro.com and covercy.com all failed to resolve). So every figure here comes from search-result extracts of vendor pages, review sites (Capterra, G2, Software Advice, GetApp) and press, not from pages I read in full. The GSD confidence classifier rates all web-search and web-fetch evidence **LOW**. Within that, vendor pages rank above review sites, and review sites rank above blogs and forums. Treat every number as something to confirm before anyone relies on it in a sales conversation.
**Status words for our product:** BUILT AND MERGED (code and plan summaries are on branch `claude/refract-reskin`; the owner has not checked it), BUILDING (some plans merged, others open), PLANNED (no code yet). Nothing here is "ready" or "launched". The owner has signed off on none of it.

## One-screen summary

| Competitor | Typical price (evidence) | White-label | E-sign included | ACH / payments model | Fund accounting | Tax documents |
|---|---|---|---|---|---|---|
| **Our portal (self-serve)** | $0 for 12 months for the first 40 sponsors, then $100/mo (owner's current plan) | Yes: only the sponsor's brand; sponsor can run it on its own server (BUILT) | Yes, no per-envelope fee (engine BUILT; automatic field placement BUILDING, scored 65-96% on 4 unseen agreements, 3 of 4 under the 90% bar) | NACHA file the sponsor uploads to its own bank; $0; no money transmitter; credits only, capital calls by wire (BUILT; upgrades BUILDING) | Double-entry journal, bank reconciliation, CPA year-end package (BUILT, CPA review pending) | K-1 split and delivery, 1099-INT/DIV, IRS IRIS file, withholding (BUILT, not yet tried on real CPA K-1 files) |
| Juniper Square | Not published. Old listed entry price was $18,000/yr for firms under $50M equity | Branded portal; own domain not confirmed | Yes, through DocuSign: 1,000 envelopes/yr included, then $5 each (rate card dated Feb 2024, possibly outdated) | Payments inside the platform, $0.50 per ACH (same rate card) | Yes, plus fund administration services | K-1 delivery |
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

<!-- gsd:write-continue -->
