/*
 * Client (sponsor) configurations.
 *
 * Each Carrow & Vale client is one object: its brand, how its investors are
 * onboarded, the bank details used to originate ACH distributions, and its
 * offerings. Every offering is configured separately because every investment
 * is different: a fund, a syndication, a DST and a note each define "exit" and
 * "distributions" in their own way.
 *
 * The three sample clients are fictional firms. Routing numbers pass the ABA
 * check digit but belong to no real bank; account numbers are invented.
 */
(function (NS) {
  'use strict';

  /* Offering types and the key terms each one starts with. */
  NS.OFFERING_TYPES = {
    'Real estate syndication': { frequency: 'Monthly', distType: 'Income', exit: 'range', terms: ['Property', 'Location', 'Preferred return', 'Target hold'] },
    'Delaware Statutory Trust': { frequency: 'Monthly', distType: 'Income', exit: 'range', terms: ['Property', 'Lease structure', 'Target hold', '1031 eligible'] },
    'Private equity fund': { frequency: 'As realized', distType: 'Realization proceeds', exit: 'date', terms: ['Strategy', 'Fund size', 'Fund term', 'Portfolio companies'] },
    'Co-investment': { frequency: 'At exit', distType: 'Proceeds', exit: 'range', terms: ['Company', 'Industry', 'Lead sponsor'] },
    'Private credit': { frequency: 'Quarterly', distType: 'Interest', exit: 'maturity', terms: ['Coupon', 'Payment schedule', 'Security', 'Maturity'] },
    'Energy infrastructure': { frequency: 'Quarterly', distType: 'Income', exit: 'date', terms: ['Assets', 'Contracted revenue', 'Offtaker'] },
    'Oil and gas royalties': { frequency: 'Monthly', distType: 'Royalty income', exit: 'open', terms: ['Basin', 'Net royalty acres', 'Operators'] },
    Other: { frequency: 'Quarterly', distType: 'Distribution', exit: 'date', terms: ['Description'] }
  };
  NS.FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'As realized', 'At exit'];
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
          distribution: { frequency: 'Quarterly', type: 'Interest', target: '11.0% annual coupon' },
          terms: [
            { label: 'Coupon', value: '11.0% fixed, paid quarterly', show: true },
            { label: 'Payment dates', value: 'Jan 15, Apr 15, Jul 15, Oct 15', show: true },
            { label: 'Security', value: 'First lien on portfolio company equipment', show: true },
            { label: 'Maturity', value: 'June 30, 2027', show: true }
          ],
          update: 'All interest payments have been made on schedule.',
          seed: { rate: 0.11, freq: 'Quarterly', start: '2024-10-15', type: 'Interest' }
        }
      ],
      roster: { size: 26, jordan: { 'kb-fund-ii': 250000, 'kb-harlow': 100000, 'kb-note-24a': 150000 } }
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
          distribution: { frequency: 'Monthly', type: 'Income', target: '6.0% annualized' },
          terms: [
            { label: 'Property', value: '288 units, built 2004', show: true },
            { label: 'Location', value: 'Raleigh, North Carolina', show: true },
            { label: 'Preferred return', value: '7.0% cumulative', show: true },
            { label: 'Target hold', value: '5–7 years', show: true }
          ],
          update: 'Renovations are complete on 212 of 288 units. Occupancy was 95.1% at the end of September.',
          achOverride: { companyName: 'CEDAR ROW APTS', companyId: '1883301246' },
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
          distribution: { frequency: 'Monthly', type: 'Income', target: '5.25% annualized' },
          terms: [
            { label: 'Property', value: 'Three medical office buildings, 118,400 sq ft', show: true },
            { label: 'Lease structure', value: 'Triple net, 8.4 years average remaining', show: true },
            { label: 'Target hold', value: '7–10 years', show: true },
            { label: '1031 eligible', value: 'Yes', show: true }
          ],
          update: 'All three buildings are 100% leased. No tenant renewals are due before 2029.',
          achOverride: { companyName: 'AR MEDICAL DST', companyId: '1883302517' },
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
          distribution: { frequency: 'Monthly', type: 'Income', target: '' },
          terms: [
            { label: 'Property', value: '196 units', show: true },
            { label: 'Location', value: 'Chattanooga, Tennessee', show: true },
            { label: 'Sale price', value: '$34.6 million', show: true }
          ],
          update: 'The property was sold on July 31, 2025. Final proceeds were distributed on August 15, 2025.',
          seed: { rate: 0.06, freq: 'Monthly', start: '2023-01-15', end: '2025-07-15', type: 'Income', final: ['2025-08-15', 1.62, 'Return of capital and gain'] }
        }
      ],
      roster: { size: 28, jordan: { 'ar-cedar-row': 100000, 'ar-mob-dst': 250000, 'ar-larch': 75000 } }
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
          distribution: { frequency: 'Quarterly', type: 'Income', target: '8.0% annualized' },
          terms: [
            { label: 'Assets', value: 'Four solar projects in Colorado and New Mexico, 212 MW', show: true },
            { label: 'Contracted revenue', value: '20-year power purchase agreements', show: true },
            { label: 'Offtaker', value: 'Two investment-grade utilities', show: true }
          ],
          update: 'Generation was 3% ahead of plan for the first nine months of 2026.',
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
          distribution: { frequency: 'Monthly', type: 'Royalty income', target: 'Varies with production and prices' },
          terms: [
            { label: 'Basin', value: 'Delaware Basin, Texas and New Mexico', show: true },
            { label: 'Net royalty acres', value: '1,840', show: true },
            { label: 'Operators', value: '11 operators, 214 producing wells', show: true }
          ],
          update: 'Eighteen new wells were turned to sales on program acreage in the third quarter.',
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
          distribution: { frequency: 'Quarterly', type: 'Income', target: '6.0% annualized' },
          terms: [
            { label: 'Company', value: 'Desert Basin Water Holdings', show: true },
            { label: 'Industry', value: 'Regulated water and wastewater utilities', show: true },
            { label: 'Lead sponsor', value: 'Greywater Infrastructure Fund II, L.P.', show: true }
          ],
          update: 'The Arizona rate case concluded in August with a 9.2% approved return on equity.',
          seed: { rate: 0.06, freq: 'Quarterly', start: '2024-01-15', type: 'Income' }
        }
      ],
      roster: { size: 24, jordan: { 'gw-solar-i': 150000, 'gw-royalty-23': 100000, 'gw-water': 200000 } }
    }
  ];

  NS.DEFAULT_TENANT = 'kestrel-bay';
})(window.CVPortal);
