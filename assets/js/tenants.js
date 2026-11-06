/*
 * Client (sponsor) configurations.
 *
 * Each Carrow & Vale client is one object: its brand, how its investors are
 * onboarded, the bank details used to originate ACH distributions, and its
 * offerings. Every offering is configured separately because every investment
 * is different: a fund, a syndication, a DST and a note each define "exit" and
 * "distributions" in their own way.
 *
 * The four sample clients are fictional firms, as are their holdings and auditors. Routing numbers pass the ABA
 * check digit but belong to no real bank; account numbers are invented.
 */
(function (NS) {
  'use strict';

  /*
   * Offering types and the key terms each one starts with. `profile` picks the
   * fund accounting used for audit schedules (see audit.js): closed-end drawdown
   * funds with carried interest, or open-ended NAV funds with an incentive fee.
   */
  NS.OFFERING_TYPES = {
    'Venture capital fund': { frequency: 'As realized', distType: 'Realization proceeds', exit: 'date', terms: ['Strategy', 'Fund size', 'Fund term', 'Portfolio companies'], profile: 'vc' },
    'Private equity fund': { frequency: 'As realized', distType: 'Realization proceeds', exit: 'date', terms: ['Strategy', 'Fund size', 'Fund term', 'Portfolio companies'], profile: 'pe' },
    'Hedge fund': { frequency: 'None', distType: 'Distribution', exit: 'open', terms: ['Strategy', 'Liquidity', 'Lock-up', 'Fees'], profile: 'hedge' },
    'Digital asset fund': { frequency: 'None', distType: 'Distribution', exit: 'open', terms: ['Strategy', 'Assets', 'Custody', 'Liquidity'], profile: 'digital' },
    SPV: { frequency: 'At exit', distType: 'Proceeds', exit: 'range', terms: ['Company', 'Security', 'Lead investor'], profile: 'spv' },
    'Real estate fund': { frequency: 'Quarterly', distType: 'Income', exit: 'date', terms: ['Strategy', 'Fund size', 'Fund term', 'Properties'], profile: 'realestate' },
    'Multi-strategy fund': { frequency: 'None', distType: 'Distribution', exit: 'open', terms: ['Strategies', 'Liquidity', 'Lock-up', 'Fees'], profile: 'multistrat' },
    'Real estate syndication': { frequency: 'Monthly', distType: 'Income', exit: 'range', terms: ['Property', 'Location', 'Preferred return', 'Target hold'], profile: 'realestate' },
    'Delaware Statutory Trust': { frequency: 'Monthly', distType: 'Income', exit: 'range', terms: ['Property', 'Lease structure', 'Target hold', '1031 eligible'], profile: 'realestate' },
    'Co-investment': { frequency: 'At exit', distType: 'Proceeds', exit: 'range', terms: ['Company', 'Industry', 'Lead sponsor'], profile: 'spv' },
    'Private credit': { frequency: 'Quarterly', distType: 'Interest', exit: 'maturity', terms: ['Coupon', 'Payment schedule', 'Security', 'Maturity'], profile: 'credit' },
    'Energy infrastructure': { frequency: 'Quarterly', distType: 'Income', exit: 'date', terms: ['Assets', 'Contracted revenue', 'Offtaker'], profile: 'realassets' },
    'Oil and gas royalties': { frequency: 'Monthly', distType: 'Royalty income', exit: 'open', terms: ['Basin', 'Net royalty acres', 'Operators'], profile: 'realassets' },
    Other: { frequency: 'Quarterly', distType: 'Distribution', exit: 'date', terms: ['Description'], profile: 'other' }
  };
  NS.FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'As realized', 'At exit', 'None'];
  NS.DIST_TYPES = ['Income', 'Interest', 'Return of capital', 'Realization proceeds', 'Proceeds', 'Royalty income', 'Principal', 'Return of capital and gain', 'Distribution'];

  NS.TENANT_TEMPLATE = {
    id: 'new-client',
    sample: false,
    name: 'New Client Capital',
    shortName: 'New Client',
    tagline: 'Capital',
    legalName: 'New Client Capital Management, LLC',
    portalName: 'Investor Portal',
    domain: 'investors.newclient.com',
    logo: { type: 'monogram', letters: 'NC', image: '', plate: false },
    colors: { primary: '#0F2742', accent: '#1F7A8C' },
    font: 'manrope',
    radius: 'sharp',
    nav: 'light',
    appearance: 'system',
    support: { team: 'Investor Relations', email: 'investors@newclient.com', phone: '(212) 555-0100', hours: 'Mon–Fri, 9:00 a.m.–5:00 p.m. ET' },
    disclaimer: 'Information in this portal is provided to existing investors for informational purposes only and is not an offer to sell or a solicitation of an offer to buy any security. [Regulatory disclosures to be provided by counsel.]',
    signin: { headline: 'Investor Portal', sub: 'Sign in to view your investments, distributions and documents.' },
    onboarding: { accreditation: true, taxForm: true, ach: 'required', esign: true },
    ach: {
      odfiName: '',
      odfiRouting: '',
      destinationRouting: '',
      destinationName: '',
      immediateOrigin: '',
      originName: '',
      companyName: '',
      companyId: '',
      entryDescription: 'DISTRIB',
      balanced: false,
      offset: { routing: '', account: '', type: 'checking' }
    },
    idPrefix: 'NC',
    auditor: '',
    offerings: [],
    roster: null
  };

  NS.TENANTS = [
    {
      id: 'kestrel-bay',
      sample: true,
      name: 'Kestrel Bay Capital',
      shortName: 'Kestrel Bay',
      tagline: 'Capital',
      legalName: 'Kestrel Bay Capital Management, LLC',
      portalName: 'Investor Portal',
      domain: 'investors.kestrelbaycap.com',
      logo: { type: 'wing', letters: 'KB', image: '', plate: false },
      colors: { primary: '#14304F', accent: '#B4873F' },
      font: 'serif',
      radius: 'sharp',
      nav: 'light',
      appearance: 'system',
      support: { team: 'Kestrel Bay Investor Relations', email: 'ir@kestrelbaycap.com', phone: '(212) 555-0148', hours: 'Mon–Fri, 8:30 a.m.–6:00 p.m. ET' },
      disclaimer:
        'Information in this portal is provided to investors in Kestrel Bay funds and vehicles for informational purposes only. Projected exit dates are estimates and may change. Past performance is not indicative of future results. [Regulatory disclosures to be provided by counsel.]',
      signin: { headline: 'Investor Portal', sub: 'Sign in to view your investments, distributions and documents.' },
      onboarding: { accreditation: true, taxForm: true, ach: 'required', esign: true },
      ach: {
        odfiName: 'First Harbor Bank',
        odfiRouting: '021305810',
        destinationRouting: '021305810',
        destinationName: 'FIRST HARBOR BANK',
        immediateOrigin: '1834201957',
        originName: 'KESTREL BAY CAPITAL',
        companyName: 'KESTREL BAY CAP',
        companyId: '1834201957',
        entryDescription: 'DISTRIB',
        balanced: false,
        offset: { routing: '021305810', account: '7731004428', type: 'checking' }
      },
      idPrefix: 'KBC',
      auditor: 'Halvorsen Pike LLP',
      offerings: [
        {
          id: 'kb-fund-ii',
          name: 'Kestrel Bay Fund II, L.P.',
          shortName: 'Fund II',
          type: 'Private equity fund',
          status: 'Active',
          summary: 'Lower middle-market buyout fund',
          closeDate: '2019-09-30',
          minimum: 250000,
          exit: { basis: 'date', date: '2029-09-30', from: '', to: '', note: 'End of the 10-year fund term; may be extended up to two years.' },
          distribution: { frequency: 'As realized', type: 'Realization proceeds', target: '' },
          terms: [
            { label: 'Strategy', value: 'Control buyouts of founder-owned industrial and business-services companies', show: true },
            { label: 'Fund size', value: '$310 million', show: true },
            { label: 'Fund term', value: '10 years from final close, plus two 1-year extensions', show: true },
            { label: 'Portfolio companies', value: '9 (2 realized)', show: true }
          ],
          update: 'Fund II completed the sale of Mercer Fluid Systems in September. Proceeds were distributed on September 24, 2026.',
          achOverride: { companyName: 'KB FUND II LP', companyId: '1834209921' },
          calls: [['2019-09-30', 0.25], ['2020-03-31', 0.2], ['2020-10-15', 0.2], ['2021-06-30', 0.2], ['2022-03-31', 0.15]],
          holdings: [
            { name: 'Brightline Packaging Holdings, LLC', security: 'Class A units (control)', level: 3, method: 'Market approach: EV/EBITDA multiple', input: 'EV/EBITDA 9.0x', weight: 19, cost: 0.58, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Corwin Industrial Services, Inc.', security: 'Common stock (control)', level: 3, method: 'Market approach: EV/EBITDA multiple', input: 'EV/EBITDA 8.25x', weight: 16, cost: 0.66, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Dalton Fire & Safety Group, LLC', security: 'Class A units (control)', level: 3, method: 'Income approach: discounted cash flow', input: 'Discount rate 13.5%', weight: 15, cost: 0.71, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Eastfield Metal Finishing, LLC', security: 'Preferred and common units', level: 3, method: 'Market approach: EV/EBITDA multiple', input: 'EV/EBITDA 7.5x', weight: 13, cost: 0.92, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Fairmont Route Logistics, Inc.', security: 'Common stock (control)', level: 3, method: 'Market approach: EV/EBITDA multiple', input: 'EV/EBITDA 8.0x', weight: 14, cost: 0.8, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Granger HVAC Services, LLC', security: 'Class A units (control)', level: 3, method: 'Recent transaction: signed letter of intent', input: 'LOI enterprise value $96 million', weight: 12, cost: 0.55, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Halsey Controls Corp.', security: 'Common stock (control)', level: 3, method: 'Market approach: EV/EBITDA multiple', input: 'EV/EBITDA 8.75x', weight: 11, cost: 0.74, support: { every: 3, doc: 'Quarterly valuation memo' } }
          ],
          seed: { events: [['2023-12-21', 0.04], ['2024-06-28', 0.05], ['2024-12-20', 0.035], ['2025-06-27', 0.06], ['2025-12-19', 0.04], ['2026-06-26', 0.055], ['2026-09-24', 0.03]] }
        },
        {
          id: 'kb-harlow',
          name: 'Harlow Precision Co-Investment, LLC',
          shortName: 'Harlow Co-Invest',
          type: 'Co-investment',
          status: 'Active',
          summary: 'Single-company co-investment alongside Fund III',
          closeDate: '2023-04-14',
          minimum: 100000,
          exit: { basis: 'range', date: '', from: '2027-04-01', to: '2028-12-31', note: 'Exit expected through a sale of the company.' },
          distribution: { frequency: 'At exit', type: 'Proceeds', target: '' },
          terms: [
            { label: 'Company', value: 'Harlow Precision Components', show: true },
            { label: 'Industry', value: 'Aerospace machining', show: true },
            { label: 'Lead sponsor', value: 'Kestrel Bay Fund III, L.P.', show: true }
          ],
          update: 'Revenue grew 14% year over year through September. A sale process is planned for 2027.',
          holdings: [{ name: 'Harlow Precision Components, Inc.', security: 'Series B preferred stock', level: 3, method: 'Market approach: EV/EBITDA multiple, calibrated to entry', input: 'EV/EBITDA 10.5x', weight: 100, cost: 0.83, support: { every: 3, doc: 'Quarterly valuation memo' } }],
          seed: { events: [['2025-11-14', 0.03]] }
        },
        {
          id: 'kb-note-24a',
          name: 'Kestrel Bay Senior Note 2024-A',
          shortName: 'Senior Note 2024-A',
          type: 'Private credit',
          status: 'Active',
          summary: '11.0% fixed-rate senior secured note',
          closeDate: '2024-07-01',
          minimum: 50000,
          exit: { basis: 'maturity', date: '2027-06-30', from: '', to: '', note: 'Principal is repaid in full at maturity.' },
          distribution: { frequency: 'Quarterly', type: 'Interest', target: '11.0% annual coupon', day: 15 },
          terms: [
            { label: 'Coupon', value: '11.0% fixed, paid quarterly', show: true },
            { label: 'Payment dates', value: 'Jan 15, Apr 15, Jul 15, Oct 15', show: true },
            { label: 'Security', value: 'First lien on portfolio company equipment', show: true },
            { label: 'Maturity', value: 'June 30, 2027', show: true }
          ],
          update: 'All interest payments have been made on schedule.',
          holdings: [{ name: 'Equipment-secured term loans (6 borrowers)', security: 'Senior secured first-lien loans, 11.0% fixed', level: 3, method: 'Income approach: yield analysis', input: 'Market yield 10.75%', weight: 100, cost: 1, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } }],
          seed: { rate: 0.11, freq: 'Quarterly', start: '2024-10-15', type: 'Interest' }
        }
      ],
      roster: { size: 26, login: 'jordan.davis@example.com', jordan: { 'kb-fund-ii': 250000, 'kb-harlow': 100000, 'kb-note-24a': 150000 } }
    },
    {
      id: 'ashwell-ridge',
      sample: true,
      name: 'Ashwell Ridge Real Estate',
      shortName: 'Ashwell Ridge',
      tagline: 'Real Estate',
      legalName: 'Ashwell Ridge Real Estate Advisors, LP',
      portalName: 'Investor Portal',
      domain: 'portal.ashwellridge.com',
      logo: { type: 'ridge', letters: 'AR', image: '', plate: false },
      colors: { primary: '#7A2E3A', accent: '#B38B59' },
      font: 'franklin',
      radius: 'sharp',
      nav: 'light',
      appearance: 'system',
      support: { team: 'Ashwell Ridge Investor Services', email: 'investors@ashwellridge.com', phone: '(615) 555-0172', hours: 'Mon–Fri, 8:00 a.m.–5:00 p.m. CT' },
      disclaimer:
        'This portal is provided to investors in Ashwell Ridge programs for informational purposes only. Hold periods and exit timing are projections and are not guaranteed. [Regulatory disclosures to be provided by counsel.]',
      signin: { headline: 'Investor Portal', sub: 'Sign in to view your properties, distributions and tax documents.' },
      onboarding: { accreditation: true, taxForm: true, ach: 'required', esign: true },
      ach: {
        odfiName: 'Cumberland State Bank',
        odfiRouting: '061002157',
        destinationRouting: '061002157',
        destinationName: 'CUMBERLAND STATE BANK',
        immediateOrigin: '1620487715',
        originName: 'ASHWELL RIDGE ADVISORS',
        companyName: 'ASHWELL RIDGE',
        companyId: '1620487715',
        entryDescription: 'DISTRIB',
        balanced: true,
        offset: { routing: '061002157', account: '4400918265', type: 'checking' }
      },
      idPrefix: 'ARR',
      auditor: 'Brandt & Ostrow LLP',
      offerings: [
        {
          id: 'ar-cedar-row',
          name: 'The Residences at Cedar Row',
          shortName: 'Cedar Row',
          type: 'Real estate syndication',
          status: 'Active',
          summary: '288-unit multifamily community, Raleigh, NC',
          closeDate: '2022-06-15',
          minimum: 50000,
          exit: { basis: 'range', date: '', from: '2027-06-15', to: '2029-06-15', note: 'Five-to-seven-year business plan. Timing depends on market conditions.' },
          distribution: { frequency: 'Monthly', type: 'Income', target: '6.0% annualized', day: 15 },
          terms: [
            { label: 'Property', value: '288 units, built 2004', show: true },
            { label: 'Location', value: 'Raleigh, North Carolina', show: true },
            { label: 'Preferred return', value: '7.0% cumulative', show: true },
            { label: 'Target hold', value: '5–7 years', show: true }
          ],
          update: 'Renovations are complete on 212 of 288 units. Occupancy was 95.1% at the end of September.',
          achOverride: { companyName: 'CEDAR ROW APTS', companyId: '1883301246' },
          accounting: { carry: 30, pref: 8, waterfall: { type: 'american', tiers: [{ kind: 'pref', rate: 8, simple: true }, { kind: 'roc' }, { kind: 'split', lp: 70, gp: 30, upTo: 15 }, { kind: 'split', lp: 50, gp: 50 }] } },
          holdings: [{ name: 'The Residences at Cedar Row', security: '288-unit multifamily, built 2004', location: 'Raleigh, North Carolina', acquired: '2022-06-15', level: 3, method: 'Income approach: direct capitalization (third-party appraisal)', input: 'Cap rate 5.40%', weight: 100, cost: 0.86, ltv: 0.58, debtRate: '5.12% fixed', debtMaturity: '2032-07-01', support: { every: 12, anchor: '06-30', doc: 'Appraisal, Hollis Meyer Valuation Group' } }],
          seed: { rate: 0.06, freq: 'Monthly', start: '2022-09-15', type: 'Income' }
        },
        {
          id: 'ar-mob-dst',
          name: 'Ashwell Ridge Medical Office DST',
          shortName: 'Medical Office DST',
          type: 'Delaware Statutory Trust',
          status: 'Active',
          summary: 'Three net-leased medical office buildings, Nashville MSA',
          closeDate: '2023-03-01',
          minimum: 100000,
          exit: { basis: 'range', date: '', from: '2030-03-01', to: '2033-03-01', note: 'Seven-to-ten-year hold, aligned with the remaining lease terms.' },
          distribution: { frequency: 'Monthly', type: 'Income', target: '5.25% annualized', day: 15 },
          terms: [
            { label: 'Property', value: 'Three medical office buildings, 118,400 sq ft', show: true },
            { label: 'Lease structure', value: 'Triple net, 8.4 years average remaining', show: true },
            { label: 'Target hold', value: '7–10 years', show: true },
            { label: '1031 eligible', value: 'Yes', show: true }
          ],
          update: 'All three buildings are 100% leased. No tenant renewals are due before 2029.',
          achOverride: { companyName: 'AR MEDICAL DST', companyId: '1883302517' },
          holdings: [
            { name: 'Brentwood Medical Pavilion', security: 'Medical office, 46,200 sq ft, triple net', location: 'Brentwood, Tennessee', acquired: '2023-03-01', level: 3, method: 'Income approach: direct capitalization (third-party appraisal)', input: 'Cap rate 6.10%', weight: 40, cost: 0.94, ltv: 0.45, debtRate: '4.85% fixed', debtMaturity: '2033-03-01', support: { every: 12, anchor: '03-31', doc: 'Appraisal, Calloway Realty Advisors', missing: ['2026-03-31'] } },
            { name: 'Hendersonville Specialty Clinic', security: 'Medical office, 39,800 sq ft, triple net', location: 'Hendersonville, Tennessee', acquired: '2023-03-01', level: 3, method: 'Income approach: direct capitalization (third-party appraisal)', input: 'Cap rate 6.25%', weight: 33, cost: 0.95, ltv: 0.45, debtRate: '4.85% fixed', debtMaturity: '2033-03-01', support: { every: 12, anchor: '03-31', doc: 'Appraisal, Calloway Realty Advisors' } },
            { name: 'Murfreesboro Outpatient Center', security: 'Medical office, 32,400 sq ft, triple net', location: 'Murfreesboro, Tennessee', acquired: '2023-03-01', level: 3, method: 'Income approach: direct capitalization (third-party appraisal)', input: 'Cap rate 6.40%', weight: 27, cost: 0.97, ltv: 0.45, debtRate: '4.85% fixed', debtMaturity: '2033-03-01', support: { every: 12, anchor: '03-31', doc: 'Appraisal, Calloway Realty Advisors' } }
          ],
          seed: { rate: 0.0525, freq: 'Monthly', start: '2023-04-15', type: 'Income' }
        },
        {
          id: 'ar-larch',
          name: 'Larch Commons Apartments, LLC',
          shortName: 'Larch Commons',
          type: 'Real estate syndication',
          status: 'Exited',
          summary: '196-unit multifamily community, Chattanooga, TN',
          closeDate: '2019-05-01',
          minimum: 50000,
          exit: { basis: 'exited', date: '2025-08-15', from: '', to: '', note: 'Sold for $34.6 million after a 6.3-year hold.' },
          distribution: { frequency: 'Monthly', type: 'Income', target: '', day: 15 },
          terms: [
            { label: 'Property', value: '196 units', show: true },
            { label: 'Location', value: 'Chattanooga, Tennessee', show: true },
            { label: 'Sale price', value: '$34.6 million', show: true }
          ],
          update: 'The property was sold on July 31, 2025. Final proceeds were distributed on August 15, 2025.',
          holdings: [{ name: 'Larch Commons Apartments', security: '196-unit multifamily', location: 'Chattanooga, Tennessee', acquired: '2019-05-01', level: 3, method: 'Income approach: direct capitalization (third-party appraisal)', input: 'Cap rate 5.75%', weight: 100, cost: 0.72, ltv: 0.6, debtRate: '4.10% fixed', debtMaturity: '2029-05-01', support: { every: 12, anchor: '04-30', doc: 'Appraisal, Hollis Meyer Valuation Group' } }],
          seed: { rate: 0.06, freq: 'Monthly', start: '2023-01-15', end: '2025-07-15', type: 'Income', final: ['2025-08-15', 1.62, 'Return of capital and gain'] }
        }
      ],
      roster: { size: 28, login: 'jordan.davis@example.org', jordan: { 'ar-cedar-row': 100000, 'ar-mob-dst': 250000, 'ar-larch': 75000 } }
    },
    {
      id: 'greywater',
      sample: true,
      name: 'Greywater Infrastructure Partners',
      shortName: 'Greywater',
      tagline: 'Infrastructure Partners',
      legalName: 'Greywater Infrastructure Partners, LLC',
      portalName: 'Investor Center',
      domain: 'investors.greywaterinfra.com',
      logo: { type: 'wave', letters: 'GW', image: '', plate: false },
      colors: { primary: '#2F5D3A', accent: '#A8622A' },
      font: 'plex',
      radius: 'sharp',
      nav: 'brand',
      appearance: 'system',
      support: { team: 'Greywater Investor Relations', email: 'ir@greywaterinfra.com', phone: '(303) 555-0119', hours: 'Mon–Fri, 7:30 a.m.–5:30 p.m. MT' },
      disclaimer:
        'Information in this portal is provided to investors in Greywater programs for informational purposes only. Royalty and project income varies with production and market prices. [Regulatory disclosures to be provided by counsel.]',
      signin: { headline: 'Investor Center', sub: 'Sign in to view your investments, distributions and documents.' },
      onboarding: { accreditation: true, taxForm: true, ach: 'optional', esign: true },
      ach: {
        odfiName: 'Front Range National Bank',
        odfiRouting: '112000781',
        destinationRouting: '112000781',
        destinationName: 'FRONT RANGE NATL BANK',
        immediateOrigin: '1471203385',
        originName: 'GREYWATER INFRASTRUCTURE',
        companyName: 'GREYWATER INFRA',
        companyId: '1471203385',
        entryDescription: 'DISTRIB',
        balanced: false,
        offset: { routing: '112000781', account: '6602113790', type: 'checking' }
      },
      idPrefix: 'GIP',
      auditor: 'Whitcombe Hale LLP',
      offerings: [
        {
          id: 'gw-solar-i',
          name: 'Greywater Solar Portfolio I, LLC',
          shortName: 'Solar Portfolio I',
          type: 'Energy infrastructure',
          status: 'Active',
          summary: 'Four operating solar projects, 212 MW',
          closeDate: '2021-10-01',
          minimum: 100000,
          exit: { basis: 'date', date: '2028-12-31', from: '', to: '', note: 'Projected sale of the portfolio to a long-term owner.' },
          distribution: { frequency: 'Quarterly', type: 'Income', target: '8.0% annualized', day: 15 },
          terms: [
            { label: 'Assets', value: 'Four solar projects in Colorado and New Mexico, 212 MW', show: true },
            { label: 'Contracted revenue', value: '20-year power purchase agreements', show: true },
            { label: 'Offtaker', value: 'Two investment-grade utilities', show: true }
          ],
          update: 'Generation was 3% ahead of plan for the first nine months of 2026.',
          holdings: [
            { name: 'Arroyo Seco Solar, LLC', security: '64 MW, Colorado, 20-year PPA', level: 3, method: 'Income approach: discounted cash flow', input: 'Discount rate 7.25%', weight: 31, cost: 0.9, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Pinon Flats Solar, LLC', security: '58 MW, New Mexico, 20-year PPA', level: 3, method: 'Income approach: discounted cash flow', input: 'Discount rate 7.50%', weight: 27, cost: 0.92, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Kiowa Creek Solar, LLC', security: '52 MW, Colorado, 20-year PPA', level: 3, method: 'Income approach: discounted cash flow', input: 'Discount rate 7.25%', weight: 24, cost: 0.88, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Rio Puerco Solar, LLC', security: '38 MW, New Mexico, 20-year PPA', level: 3, method: 'Income approach: discounted cash flow', input: 'Discount rate 7.75%', weight: 18, cost: 0.95, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } }
          ],
          seed: { rate: 0.08, freq: 'Quarterly', start: '2022-04-15', type: 'Income' }
        },
        {
          id: 'gw-royalty-23',
          name: 'Permian Royalty Program 2023, LP',
          shortName: 'Permian Royalty 2023',
          type: 'Oil and gas royalties',
          status: 'Active',
          summary: 'Mineral and royalty interests, Delaware Basin',
          closeDate: '2023-02-01',
          minimum: 50000,
          exit: { basis: 'open', date: '', from: '', to: '', note: 'No set term. Royalties are paid for the producing life of the wells.' },
          distribution: { frequency: 'Monthly', type: 'Royalty income', target: 'Varies with production and prices', day: 20 },
          terms: [
            { label: 'Basin', value: 'Delaware Basin, Texas and New Mexico', show: true },
            { label: 'Net royalty acres', value: '1,840', show: true },
            { label: 'Operators', value: '11 operators, 214 producing wells', show: true }
          ],
          update: 'Eighteen new wells were turned to sales on program acreage in the third quarter.',
          holdings: [{ name: 'Delaware Basin mineral and royalty interests', security: '1,840 net royalty acres, 214 producing wells', level: 3, method: 'Income approach: discounted cash flow of proved reserves', input: 'Discount rate 11%; strip pricing', weight: 100, cost: 0.9, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } }],
          seed: { rate: 0.105, freq: 'Monthly', start: '2023-05-20', type: 'Royalty income', vary: 0.18 }
        },
        {
          id: 'gw-water',
          name: 'Greywater Water Assets Co-Investment, LLC',
          shortName: 'Water Co-Invest',
          type: 'Co-investment',
          status: 'Active',
          summary: 'Regulated water utilities in Arizona and Texas',
          closeDate: '2023-09-01',
          minimum: 100000,
          exit: { basis: 'range', date: '', from: '2030-01-01', to: '2031-12-31', note: 'Exit expected through a sale or recapitalization.' },
          distribution: { frequency: 'Quarterly', type: 'Income', target: '6.0% annualized', day: 15 },
          terms: [
            { label: 'Company', value: 'Desert Basin Water Holdings', show: true },
            { label: 'Industry', value: 'Regulated water and wastewater utilities', show: true },
            { label: 'Lead sponsor', value: 'Greywater Infrastructure Fund II, L.P.', show: true }
          ],
          update: 'The Arizona rate case concluded in August with a 9.2% approved return on equity.',
          holdings: [{ name: 'Desert Basin Water Holdings, LLC', security: 'Class B units', level: 3, method: 'Market approach: enterprise value to rate base', input: '1.65x rate base', weight: 100, cost: 0.88, support: { every: 3, doc: 'Quarterly valuation memo' } }],
          seed: { rate: 0.06, freq: 'Quarterly', start: '2024-01-15', type: 'Income' }
        }
      ],
      roster: { size: 24, login: 'jordan.davis@example.net', jordan: { 'gw-solar-i': 150000, 'gw-royalty-23': 100000, 'gw-water': 200000 } }
    },
    {
      id: 'pellbrook',
      sample: true,
      name: 'Pellbrook Partners',
      shortName: 'Pellbrook',
      tagline: 'Partners',
      legalName: 'Pellbrook Partners Management, LLC',
      portalName: 'Investor Portal',
      domain: 'investors.pellbrookpartners.com',
      logo: { type: 'arch', letters: 'PB', image: '', plate: false },
      colors: { primary: '#33305E', accent: '#3E8E8C' },
      font: 'manrope',
      radius: 'sharp',
      nav: 'light',
      appearance: 'system',
      support: { team: 'Pellbrook Investor Relations', email: 'ir@pellbrookpartners.com', phone: '(415) 555-0163', hours: 'Mon–Fri, 8:00 a.m.–5:00 p.m. PT' },
      disclaimer:
        'Information in this portal is provided to investors in Pellbrook funds for informational purposes only. Fund values are estimates until audited. Past performance is not indicative of future results. [Regulatory disclosures to be provided by counsel.]',
      signin: { headline: 'Investor Portal', sub: 'Sign in to view your investments, capital account and documents.' },
      onboarding: { accreditation: true, taxForm: true, ach: 'required', esign: true },
      ach: {
        odfiName: 'Bayshore Commerce Bank',
        odfiRouting: '121088639',
        destinationRouting: '121088639',
        destinationName: 'BAYSHORE COMMERCE BANK',
        immediateOrigin: '1946205531',
        originName: 'PELLBROOK PARTNERS',
        companyName: 'PELLBROOK PTNRS',
        companyId: '1946205531',
        entryDescription: 'DISTRIB',
        balanced: false,
        offset: { routing: '121088639', account: '5530177204', type: 'checking' }
      },
      idPrefix: 'PBP',
      auditor: 'Calder Reyes LLP',
      offerings: [
        {
          id: 'pb-ventures-i',
          name: 'Pellbrook Ventures I, L.P.',
          shortName: 'Ventures I',
          type: 'Venture capital fund',
          status: 'Active',
          summary: 'Seed and Series A enterprise software',
          closeDate: '2023-03-31',
          minimum: 250000,
          exit: { basis: 'date', date: '2033-03-31', from: '', to: '', note: 'Ten-year fund term, plus up to three one-year extensions.' },
          distribution: { frequency: 'As realized', type: 'Realization proceeds', target: '' },
          terms: [
            { label: 'Strategy', value: 'Seed and Series A enterprise software and data infrastructure', show: true },
            { label: 'Fund size', value: '$120 million', show: true },
            { label: 'Fund term', value: '10 years, plus three 1-year extensions', show: true },
            { label: 'Portfolio companies', value: '14', show: true }
          ],
          update: 'Two portfolio companies raised follow-on rounds in the third quarter. 60% of commitments have been called.',
          calls: [['2023-03-31', 0.15], ['2023-10-02', 0.15], ['2024-06-28', 0.15], ['2025-04-15', 0.15]],
          openCall: { notice: '2026-10-28', due: '2026-11-12', pct: 0.1, purpose: 'Follow-on investments in Quillon Robotics and Lattice Ledger' },
          holdings: [
            { name: 'Quillon Robotics, Inc.', security: 'Series A and B preferred stock', level: 3, method: 'Recent financing round, calibrated', input: 'Series C price $4.12 per share', weight: 21, cost: 0.38, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Lattice Ledger, Inc.', security: 'Series A preferred stock', level: 3, method: 'Market approach: revenue multiple', input: 'EV/ARR 9.0x', weight: 17, cost: 0.62, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Northbeam Data Systems, Inc.', security: 'Series A preferred stock', level: 3, method: 'Recent financing round, calibrated', input: 'Series A-2 price $2.65 per share', weight: 14, cost: 0.81, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Tessellate Security, Inc.', security: 'Seed and Series A preferred stock', level: 3, method: 'Market approach: revenue multiple', input: 'EV/ARR 7.5x', weight: 12, cost: 0.74, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Parcelwise, Inc.', security: 'Seed preferred stock', level: 3, method: 'Option pricing model (backsolve)', input: 'Volatility 70%; 4.0-year term', weight: 9, cost: 0.9, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Brimstone Analytics, Inc.', security: 'Series A preferred stock', level: 3, method: 'Recent financing round (February 2025)', input: 'Series A price $1.80 per share', weight: 8, cost: 1, support: { every: 3, doc: 'Quarterly valuation memo', staleSince: '2025-03-31' } },
            { name: 'Fieldnote Health, Inc.', security: 'Seed preferred stock', level: 3, method: 'Market approach: revenue multiple, with 50% discount', input: 'EV/revenue 3.0x', weight: 5, cost: 2, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { name: 'Seven other seed-stage companies', security: 'Seed preferred stock and SAFEs', level: 3, method: 'Recent financing rounds, calibrated', input: 'Most recent round prices', weight: 14, cost: 0.95, support: { every: 3, doc: 'Quarterly valuation memo' } }
          ],
          seed: { events: [['2026-05-29', 0.025]] }
        },
        {
          id: 'pb-long-short',
          name: 'Pellbrook Long/Short Equity Fund, L.P.',
          shortName: 'Long/Short Fund',
          type: 'Hedge fund',
          status: 'Active',
          summary: 'Global long/short equity, 20–40% net long',
          closeDate: '2021-01-01',
          minimum: 250000,
          exit: { basis: 'open', date: '', from: '', to: '', note: 'Quarterly redemptions on 60 days’ notice after a one-year lock-up.' },
          liquidity: { frequency: 'Quarterly', notice: 60, lockup: 12 },
          requests: [{ who: 'holder', type: 'redemption', full: true, submitted: '2025-10-15', status: 'paid', paid: '2026-01-12' }],
          distribution: { frequency: 'None', type: 'Distribution', target: 'Gains are reinvested' },
          terms: [
            { label: 'Strategy', value: 'Fundamental long/short equity, developed markets', show: true },
            { label: 'Liquidity', value: 'Quarterly on 60 days’ notice', show: true },
            { label: 'Lock-up', value: 'One year from each subscription', show: true },
            { label: 'Fees', value: '1.5% management fee; 20% incentive allocation over a high-water mark', show: true }
          ],
          update: 'Net exposure ended October at 31% long; gross exposure was 182%.',
          holdings: [
            { name: 'Equity long book (46 positions)', security: 'Listed equities, North America and Europe', level: 1, method: 'Quoted price: exchange closing price', input: 'Observable', weight: 104, cost: 0.86 },
            { name: 'Equity short book (31 positions)', security: 'Securities sold short', level: 1, method: 'Quoted price: exchange closing price', input: 'Observable', weight: -73, cost: 1.04 },
            { name: 'U.S. Treasury bills', security: 'Maturities under six months', level: 1, method: 'Quoted price', input: 'Observable', weight: 58, cost: 0.998, income: true },
            { name: 'Total return swaps (2 counterparties)', security: 'Single-name and basket swaps, net unrealized', level: 2, method: 'Model price from observable inputs', input: 'Underlying prices and financing spreads', weight: 2.5, cost: 0 }
          ]
        },
        {
          id: 'pb-digital',
          name: 'Pellbrook Digital Assets Fund, L.P.',
          shortName: 'Digital Assets Fund',
          type: 'Digital asset fund',
          status: 'Active',
          summary: 'Liquid digital assets and staking',
          closeDate: '2022-07-01',
          minimum: 100000,
          exit: { basis: 'open', date: '', from: '', to: '', note: 'Monthly redemptions on 30 days’ notice.' },
          liquidity: { frequency: 'Monthly', notice: 30, lockup: 0 },
          requests: [{ who: 'jordan', type: 'redemption', amount: 25000, submitted: '2026-10-20', status: 'pending' }],
          distribution: { frequency: 'None', type: 'Distribution', target: 'Gains are reinvested' },
          terms: [
            { label: 'Strategy', value: 'Long-biased liquid digital assets, with staking income', show: true },
            { label: 'Assets', value: 'BTC, ETH, SOL, USDC and one locked token position', show: true },
            { label: 'Custody', value: 'Qualified custodian, segregated cold storage', show: true },
            { label: 'Liquidity', value: 'Monthly on 30 days’ notice', show: true }
          ],
          update: 'Staking income was 3.1% annualized on staked ETH and SOL in the third quarter.',
          holdings: [
            { name: 'Bitcoin (BTC)', symbol: 'BTC', security: 'Spot, cold storage', level: 1, method: 'Quoted price: principal market, 23:59:59 UTC', input: 'Observable', weight: 47, cost: 0.52, price: 19500, beta: 1, decimals: 8, custodian: 'Qualified custodian A, cold storage', wallet: 'bc1q8z…4h7k' },
            { name: 'Ether (ETH)', symbol: 'ETH', security: 'Spot, 62% staked', level: 1, method: 'Quoted price: principal market, 23:59:59 UTC', input: 'Observable', weight: 27, cost: 0.61, price: 1050, beta: 1.2, decimals: 8, custodian: 'Qualified custodian A, staking', wallet: '0x71C2…9aE3', custodyDiff: { from: '2026-10-28', qty: 0.4123, note: 'Staking rewards credited by the custodian on Oct 28 are not yet recorded in the books' } },
            { name: 'Solana (SOL)', symbol: 'SOL', security: 'Spot, 80% staked', level: 1, method: 'Quoted price: principal market, 23:59:59 UTC', input: 'Observable', weight: 13, cost: 0.44, price: 33, beta: 1.5, decimals: 8, custodian: 'Qualified custodian A, staking', wallet: '7xKX…q2Lm' },
            { name: 'USD Coin (USDC)', symbol: 'USDC', security: 'Stablecoin', level: 2, method: 'Redemption value with the issuer', input: '1 USDC = $1.00', weight: 6, cost: 1, price: 1, beta: 0, decimals: 2, income: true, custodian: 'Qualified custodian A, hot wallet', wallet: '0x3fA9…77b1' },
            { name: 'Lattice Ledger (LTL) token purchase agreement', security: 'Locked tokens, unlock March 2027', level: 3, method: 'Quoted price less discount for lack of marketability', input: 'DLOM 30%', weight: 4, cost: 0.8, custodian: 'Held by the issuer under the agreement', support: { every: 3, doc: 'Quarterly valuation memo' } }
          ]
        },
        {
          id: 'pb-multi',
          name: 'Pellbrook Multi-Strategy Fund, L.P.',
          shortName: 'Multi-Strategy Fund',
          type: 'Multi-strategy fund',
          status: 'Active',
          summary: 'Equity, credit, macro and event-driven strategies',
          closeDate: '2020-04-01',
          minimum: 250000,
          exit: { basis: 'open', date: '', from: '', to: '', note: 'Quarterly redemptions on 90 days’ notice after a one-year lock-up.' },
          liquidity: { frequency: 'Quarterly', notice: 90, lockup: 12 },
          requests: [{ who: 'holder', type: 'redemption', amount: 150000, submitted: '2026-03-20', status: 'paid', paid: '2026-07-10' }],
          distribution: { frequency: 'None', type: 'Distribution', target: 'Gains are reinvested' },
          terms: [
            { label: 'Strategies', value: 'Equity long/short, credit, global macro and event-driven', show: true },
            { label: 'Liquidity', value: 'Quarterly on 90 days’ notice', show: true },
            { label: 'Lock-up', value: 'One year', show: true },
            { label: 'Fees', value: '1.5% management fee; 15% incentive allocation over a high-water mark', show: true }
          ],
          update: 'All four strategies were positive for the third quarter; credit contributed the most.',
          currency: 'USD',
          classes: [
            { id: 'A', name: 'Class A', mgmtFee: 1.5, carry: 15, minimum: 250000, note: 'Standard terms' },
            { id: 'B', name: 'Class B (founders)', mgmtFee: 1, carry: 10, minimum: 250000, subscribedBy: '2020-06-30', note: 'Investors who subscribed by June 30, 2020; closed to new investors' }
          ],
          feeders: [
            { id: 'onshore', name: 'Pellbrook Multi-Strategy Onshore Fund, L.P.', domicile: 'Delaware', for: 'U.S. taxable investors' },
            { id: 'offshore', name: 'Pellbrook Multi-Strategy Offshore Fund, Ltd.', domicile: 'Cayman Islands', for: 'Non-U.S. and U.S. tax-exempt investors' }
          ],
          sidePockets: { maxPct: 10, pockets: [{ name: 'Side pocket 2023-A', holding: 'Litigation finance claims (3)', created: '2023-06-30', mu: 0.14, vol: 0.07 }] },
          equalization: 'capital accounts',
          sleeves: [
            { name: 'Equity long/short', weight: 34, mu: 0.1, vol: 0.028 },
            { name: 'Credit', weight: 26, mu: 0.075, vol: 0.012 },
            { name: 'Global macro', weight: 20, mu: 0.06, vol: 0.024 },
            { name: 'Event-driven', weight: 15, mu: 0.09, vol: 0.02 },
            { name: 'Cash management', weight: 5, mu: 0.04, vol: 0.001 }
          ],
          holdings: [
            { sleeve: 'Equity long/short', name: 'Equity long/short book (net 33% long)', security: 'Listed equities and index futures', level: 1, method: 'Quoted price: exchange closing price', input: 'Observable', weight: 34, cost: 0.9 },
            { sleeve: 'Credit', name: 'High-yield bonds and leveraged loans (71 positions)', security: 'Corporate credit', level: 2, method: 'Broker quotes and pricing service', input: 'Observable quotes', weight: 18, cost: 0.97, income: true },
            { sleeve: 'Credit', name: 'Direct lending (4 loans)', security: 'Senior secured loans', level: 3, method: 'Income approach: yield analysis', input: 'Market yield 11.5%', weight: 8, cost: 1, income: true, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { sleeve: 'Global macro', name: 'Government bonds, futures and FX forwards', security: 'Rates, currencies and commodities', level: 1, method: 'Quoted price', input: 'Observable', weight: 20, cost: 0.99 },
            { sleeve: 'Event-driven', name: 'Merger arbitrage and special situations (24 positions)', security: 'Listed equities and credit', level: 1, method: 'Quoted price: exchange closing price', input: 'Observable', weight: 12, cost: 0.93 },
            { sleeve: 'Event-driven', name: 'Litigation finance claims (3)', security: 'Contingent claims', level: 3, method: 'Income approach: probability-weighted cash flows', input: 'Probability of success 55–70%', weight: 3, cost: 0.85, support: { every: 3, doc: 'Quarterly valuation memo' } },
            { sleeve: 'Cash management', name: 'U.S. Treasury bills', security: 'Maturities under three months', level: 1, method: 'Quoted price', input: 'Observable', weight: 5, cost: 0.999, income: true }
          ]
        },
        {
          id: 'pb-spv-quillon',
          name: 'Pellbrook SPV I, LLC (Quillon Robotics)',
          shortName: 'SPV I: Quillon',
          type: 'SPV',
          status: 'Active',
          summary: 'Series C preferred stock in Quillon Robotics',
          closeDate: '2024-11-15',
          minimum: 25000,
          exit: { basis: 'range', date: '', from: '2028-01-01', to: '2030-12-31', note: 'Exit expected through an IPO or a sale of the company.' },
          distribution: { frequency: 'At exit', type: 'Proceeds', target: '' },
          terms: [
            { label: 'Company', value: 'Quillon Robotics, Inc.', show: true },
            { label: 'Security', value: 'Series C preferred stock', show: true },
            { label: 'Lead investor', value: 'Pellbrook Ventures I, L.P.', show: true }
          ],
          update: 'Quillon shipped its second-generation picking robot to three new warehouse customers in the third quarter.',
          holdings: [{ name: 'Quillon Robotics, Inc.', security: 'Series C preferred stock', level: 3, method: 'Recent financing round, calibrated', input: 'Series C price $4.12 per share', weight: 100, cost: 0.97, support: { every: 3, doc: 'Quarterly valuation memo' } }]
        },
        {
          id: 'pb-ventures-ii',
          name: 'Pellbrook Ventures II, L.P.',
          shortName: 'Ventures II',
          type: 'Venture capital fund',
          status: 'Raising',
          summary: 'Seed and Series A enterprise software; first close targeted for March 2027',
          closeDate: '2027-03-31',
          minimum: 250000,
          exit: { basis: 'date', date: '2037-03-31', from: '', to: '', note: 'Ten-year fund term from the final close, plus up to three one-year extensions.' },
          distribution: { frequency: 'As realized', type: 'Realization proceeds', target: '' },
          terms: [
            { label: 'Strategy', value: 'Seed and Series A enterprise software and data infrastructure', show: true },
            { label: 'Fund size', value: '$175 million target', show: true },
            { label: 'Fund term', value: '10 years, plus three 1-year extensions', show: true },
            { label: 'Fees', value: '2.5% management fee on commitments; 20% carried interest', show: true }
          ],
          update: 'Ventures II is accepting subscriptions ahead of a first close targeted for March 31, 2027.',
          requests: [{ who: 'new', type: 'subscription', amount: 500000, submitted: '2026-10-30', status: 'pending' }]
        }
      ],
      roster: { size: 24, login: 'davis.trust@example.com', jordan: { 'pb-ventures-i': 250000, 'pb-long-short': 500000, 'pb-digital': 100000, 'pb-multi': 250000, 'pb-spv-quillon': 50000 } }
    }
  ];

  NS.DEFAULT_TENANT = 'kestrel-bay';
})(window.CVPortal);
