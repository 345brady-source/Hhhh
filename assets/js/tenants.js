/*
 * Client (tenant) brand configurations.
 *
 * Each client firm gets one object. The portal resolves which one to show from
 * ?tenant=<id>, then from the request hostname (matched against `domain`), then
 * from the last client opened in Brand Studio. Everything an investor sees, from
 * the logo to who signs support replies, comes from this file.
 *
 * The three sample clients below are fictional firms used to demonstrate the platform.
 */
(function (NS) {
  'use strict';

  NS.TENANT_TEMPLATE = {
    id: 'your-firm',
    sample: false,
    name: 'Your Firm Capital Partners',
    shortName: 'Your Firm',
    tagline: 'Capital Partners',
    legalName: 'Your Firm Capital Management, LLC',
    portalName: 'Investor Portal',
    domain: 'investors.yourfirm.com',
    logo: { type: 'monogram', letters: 'YF', image: '', plate: false },
    colors: { primary: '#0F2742', accent: '#1F7A8C' },
    font: 'manrope',
    radius: 'soft',
    nav: 'brand',
    appearance: 'system',
    modules: { capitalCalls: true, tax: true, messages: true, opportunities: true },
    showPoweredBy: false,
    support: {
      team: 'Investor Relations',
      email: 'investors@yourfirm.com',
      phone: '(212) 555-0100',
      hours: 'Mon–Fri, 8:30 a.m.–6:00 p.m. ET',
      response: 'one business day'
    },
    disclaimer:
      'This portal is provided to existing investors for informational purposes only. Values are unaudited unless noted and may change. Past performance is not indicative of future results. [Regulatory disclosures to be provided by counsel.]',
    signin: {
      headline: 'Your investments, in one secure place.',
      sub: 'Statements, distributions, tax documents and a direct line to our investor relations team.'
    },
    scale: 1,
    idPrefix: 'YF',
    funds: [
      { name: 'Your Firm Fund II, L.P.', short: 'Fund II', vintage: 2019, strategy: 'Buyout' },
      { name: 'Your Firm Fund III, L.P.', short: 'Fund III', vintage: 2022, strategy: 'Buyout' },
      { name: 'Your Firm Co-Investment I, LLC', short: 'Co-Invest I', vintage: 2023, strategy: 'Co-investment' }
    ],
    irr: [14.2, 11.6, 9.8],
    letter: {
      title: 'Q3 2026 letter to investors',
      excerpt: 'Fund II returned capital from one realization during the quarter, and Fund III ended September 55% called with two new platform investments.'
    },
    offering: {
      name: 'Your Firm Fund IV, L.P.',
      short: 'Fund IV',
      target: '$400 million',
      minimum: '$250,000',
      firstClose: '2027-01-29',
      strategy: 'Continuation of the Fund II and III strategy with the same investment team.',
      highlights: [
        'Same team, sectors and check size as Funds II and III',
        'Existing investors receive priority allocation through first close',
        'Licensed representatives available to walk through the materials'
      ]
    }
  };

  NS.TENANTS = [
    {
      id: 'kestrel-bay',
      sample: true,
      name: 'Kestrel Bay Capital',
      shortName: 'Kestrel Bay',
      tagline: 'Capital',
      legalName: 'Kestrel Bay Capital Management, LLC',
      portalName: 'LP Portal',
      domain: 'investors.kestrelbaycap.com',
      logo: { type: 'wing', letters: 'KB', image: '', plate: false },
      colors: { primary: '#14304F', accent: '#B4873F' },
      font: 'serif',
      radius: 'soft',
      nav: 'brand',
      appearance: 'system',
      modules: { capitalCalls: true, tax: true, messages: true, opportunities: true },
      showPoweredBy: false,
      support: {
        team: 'Kestrel Bay Investor Relations',
        email: 'lp@kestrelbaycap.com',
        phone: '(212) 555-0148',
        hours: 'Mon–Fri, 8:30 a.m.–6:00 p.m. ET',
        response: 'one business day'
      },
      disclaimer:
        'Information in this portal is provided to limited partners of Kestrel Bay funds for informational purposes only. Capital account values are unaudited until the annual audit is complete. Past performance is not indicative of future results. [Regulatory disclosures to be provided by counsel.]',
      signin: {
        headline: 'Your Kestrel Bay partnership, in one place.',
        sub: 'Capital account statements, distributions, K-1s and a direct line to our investor relations team.'
      },
      scale: 1,
      idPrefix: 'KBC',
      funds: [
        { name: 'Kestrel Bay Fund II, L.P.', short: 'Fund II', vintage: 2019, strategy: 'Lower middle-market buyout' },
        { name: 'Kestrel Bay Fund III, L.P.', short: 'Fund III', vintage: 2022, strategy: 'Lower middle-market buyout' },
        { name: 'Kestrel Bay Co-Invest (Harlow Precision), LLC', short: 'Harlow Co-Invest', vintage: 2023, strategy: 'Single-company co-investment' }
      ],
      irr: [14.2, 11.6, 9.8],
      letter: {
        title: 'Q3 2026 letter from the managing partners',
        excerpt: 'Fund II completed the sale of Mercer Fluid Systems in September, returning 1.9× invested capital on the position. Fund III closed two add-on acquisitions for its packaging platform and ended the quarter 55% called.'
      },
      offering: {
        name: 'Kestrel Bay Fund IV, L.P.',
        short: 'Fund IV',
        target: '$450 million',
        minimum: '$250,000',
        firstClose: '2027-01-29',
        strategy: 'Control buyouts of founder-owned industrial and business-services companies with $5–25 million of EBITDA.',
        highlights: [
          'Same investment team and sector focus as Funds II and III',
          'Existing limited partners receive priority allocation through first close',
          'Series 7 and Series 63 registered representatives available to walk through the materials'
        ]
      }
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
      colors: { primary: '#7A2E3A', accent: '#C9A77C' },
      font: 'franklin',
      radius: 'sharp',
      nav: 'light',
      appearance: 'system',
      modules: { capitalCalls: true, tax: true, messages: true, opportunities: true },
      showPoweredBy: false,
      support: {
        team: 'Ashwell Ridge Investor Services',
        email: 'investors@ashwellridge.com',
        phone: '(615) 555-0172',
        hours: 'Mon–Fri, 8:00 a.m.–5:00 p.m. CT',
        response: 'one business day'
      },
      disclaimer:
        'This portal is provided to investors in Ashwell Ridge funds and programs for informational purposes only. Property values reflect the most recent appraisals and internal estimates and are unaudited. [Regulatory disclosures to be provided by counsel.]',
      signin: {
        headline: 'Every property, every distribution, one login.',
        sub: 'Quarterly reports, distribution history, tax documents and our investor services team.'
      },
      scale: 0.5,
      idPrefix: 'ARR',
      funds: [
        { name: 'Ashwell Ridge Multifamily Fund I, LP', short: 'Multifamily I', vintage: 2019, strategy: 'Multifamily value-add' },
        { name: 'Ashwell Ridge Value-Add Fund II, LP', short: 'Value-Add II', vintage: 2022, strategy: 'Multifamily value-add' },
        { name: 'Cedar Row Apartments, LLC', short: 'Cedar Row', vintage: 2023, strategy: 'Single-asset co-investment' }
      ],
      irr: [12.8, 10.4, 8.9],
      letter: {
        title: 'Q3 2026 portfolio update',
        excerpt: 'Same-store occupancy across Multifamily I held at 95.1%. Renovations at Cedar Row reached 212 of 288 units, and renovated units are leasing at a 14% premium to classic units.'
      },
      offering: {
        name: 'Ashwell Ridge Value-Add Fund III, LP',
        short: 'Value-Add III',
        target: '$300 million',
        minimum: '$100,000',
        firstClose: '2027-02-26',
        strategy: 'Acquisition and renovation of 150–400 unit apartment communities in Southeastern growth markets.',
        highlights: [
          'Same acquisitions and asset-management team as Funds I and II',
          'Existing investors receive priority allocation through first close',
          'Series 7 and Series 63 registered representatives available to walk through the materials'
        ]
      }
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
      colors: { primary: '#2F5D3A', accent: '#C46A2B' },
      font: 'plex',
      radius: 'round',
      nav: 'brand',
      appearance: 'system',
      modules: { capitalCalls: true, tax: true, messages: true, opportunities: true },
      showPoweredBy: false,
      support: {
        team: 'Greywater Investor Relations',
        email: 'ir@greywaterinfra.com',
        phone: '(303) 555-0119',
        hours: 'Mon–Fri, 7:30 a.m.–5:30 p.m. MT',
        response: 'four business hours'
      },
      disclaimer:
        'Information in this portal is provided to limited partners of Greywater funds for informational purposes only. Valuations are prepared quarterly and are unaudited until year end. [Regulatory disclosures to be provided by counsel.]',
      signin: {
        headline: 'Long-lived assets. Clear reporting.',
        sub: 'Capital account statements, distributions, K-1s and a direct line to our investor relations team.'
      },
      scale: 1.5,
      idPrefix: 'GIP',
      funds: [
        { name: 'Greywater Infrastructure Fund I, L.P.', short: 'Infrastructure I', vintage: 2019, strategy: 'Core-plus infrastructure' },
        { name: 'Greywater Energy Transition Fund II, L.P.', short: 'Energy Transition II', vintage: 2022, strategy: 'Energy transition' },
        { name: 'Greywater Water Assets Co-Investment, LLC', short: 'Water Co-Invest', vintage: 2023, strategy: 'Single-asset co-investment' }
      ],
      irr: [11.1, 9.7, 8.4],
      letter: {
        title: 'Q3 2026 quarterly commentary',
        excerpt: 'Contracted cash flows across Infrastructure I came in 3% ahead of plan. Energy Transition II reached commercial operation on its 140 MW solar-plus-storage project in West Texas.'
      },
      offering: {
        name: 'Greywater Infrastructure Fund III, L.P.',
        short: 'Infrastructure III',
        target: '$1.2 billion',
        minimum: '$500,000',
        firstClose: '2027-03-19',
        strategy: 'Mid-market water, power and digital infrastructure in North America with long-term contracted revenue.',
        highlights: [
          'Same investment and operating team as Funds I and II',
          'Existing limited partners receive priority allocation through first close',
          'Series 7 and Series 63 registered representatives available to walk through the materials'
        ]
      }
    }
  ];

  NS.DEFAULT_TENANT = 'kestrel-bay';
})(window.CVPortal);
