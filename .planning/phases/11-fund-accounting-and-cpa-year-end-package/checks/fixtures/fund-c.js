// gate: none
// Hand-worked fund C (F-3 of 11-CONTEXT: carried interest paid with a distribution), written once for phase 11's checks.
// A closed-end private equity fund of a firm that is not a sample: carried interest 20%, preferred return 0, no
// management fee set, so the tiers are return of capital, then 80% to investors and 20% to the general partner. One
// investor, C-1001 (paid by ACH); one investment, holding fc-y. Calendar 2026, today 2027-01-20.
//
// Every journal amount and every expected figure is an integer number of cents; a position's amount is whole dollars,
// a run's total, gp, gross and lines are cents (the portal's stored types).
'use strict';

const OID = 'fund-c';

const records = {
  v: 2,
  tenant: { id: 'fund-c-sponsor', sample: false, name: 'Fund C Sponsor', shortName: 'Fund C Sponsor', legalName: 'Fund C Sponsor Management, LLC', ach: { companyName: 'FUND C LP', companyId: '1000000003', odfiRouting: '044003186', odfiName: 'Sample Bank' } },
  offerings: [
    {
      id: OID,
      name: 'Fund C, L.P.',
      shortName: 'Fund C',
      type: 'Private equity fund',
      status: 'Active',
      closeDate: '2026-01-15',
      exit: { basis: 'date', date: '2036-01-15', from: '', to: '', note: '' },
      distribution: { frequency: 'As realized', type: 'Realization proceeds', target: '' },
      terms: [],
      accounting: { carry: '20', pref: '0' }
    }
  ],
  investors: [
    {
      id: 'C-1001',
      contact: 'Investor C One',
      title: 'Investor C One',
      type: 'individual',
      email: 'c-1001@example.com',
      taxForm: 'W-9',
      payment: { method: 'ach', bank: { holder: 'Investor C One', routing: '044003186', account: '40010001', type: 'checking' } },
      positions: [{ offeringId: OID, amount: 100000, date: '2026-01-15' }] // 10,000,000 cents
    }
  ],
  calls: [],
  runs: [
    {
      id: 'fc-run-1',
      offeringId: OID,
      date: '2026-05-15',
      type: 'Realization proceeds',
      // the waterfall on 15,000,000: 10,000,000 return of capital, then 5,000,000 split 4,000,000 / 1,000,000
      total: 14000000,
      gp: 1000000,
      gross: 15000000,
      status: 'paid',
      source: 'recorded',
      lines: [{ investorId: 'C-1001', grossCents: 14000000, withheld: [], netCents: 14000000 }],
      linesBasis: 'recorded',
      linesAt: '2026-05-15T15:00:00.000Z',
      linesBy: 'Fund C Sponsor'
    }
  ],
  notices: [],
  audit: [],
  requests: [],
  docs: [],
  books: {
    v: 1,
    funds: {
      [OID]: {
        start: '',
        accounts: [],
        journal: [],
        holdings: [{ id: 'fc-y', name: 'Portfolio Co Y', kind: 'investment', level: 3 }],
        marks: [],
        bank: { accounts: [], imports: [], lines: [], recs: [] },
        closed: [],
        exceptions: []
      }
    }
  }
};

const entries = [
  { date: '2026-01-20', memo: 'Purchase of Portfolio Co Y', src: 'bank:fc-1', lines: [['1100', 10000000, '', 'fc-y'], ['1000', -10000000]] },
  // Y valued at 15,000,000 against cost 10,000,000
  { date: '2026-03-31', memo: 'Portfolio Co Y valued at $150,000.00', src: 'mark:fc-m1', lines: [['1150', 5000000, '', 'fc-y'], ['6100', -5000000]] },
  // Y sold for 15,000,000: realized 5,000,000, and the unrealized 5,000,000 reversed
  {
    date: '2026-04-20',
    memo: 'Sale of Portfolio Co Y',
    src: 'bank:fc-2',
    lines: [['1000', 15000000], ['1100', -10000000, '', 'fc-y'], ['6000', -5000000, '', 'fc-y'], ['6100', 5000000, '', 'fc-y'], ['1150', -5000000, '', 'fc-y']]
  }
];

const expect = {
  offeringId: OID,
  months: {
    // capital before carry 10,000,000 + 5,000,000; the waterfall gives the GP 20% of 5,000,000 = 1,000,000 accrued
    '2026-03': { pre: 15000000, gain: 5000000, carryEnd: 1000000, end: 14000000, gpOut: 0, gpRun: 0, carry: 1000000, nav: 15000000 },
    // realized 5,000,000 and unrealized -5,000,000: gain 0; nothing else moves
    '2026-04': { pre: 15000000, gain: 0, carryEnd: 1000000, end: 14000000, gpOut: 0, gpRun: 0, carry: 0, nav: 15000000 },
    // C-1001 receives 14,000,000 and the general partner 1,000,000: before carry 14,000,000 - 14,000,000 + 1,000,000
    // (accrued) - 1,000,000 (paid) = 0; accrued 0; the GP's distribution 1,000,000, all of it paid with the run; carry
    // allocated in May 1,000,000 paid - 1,000,000 accrued before = 0; NAV 0 = journal cash 0
    '2026-05': { pre: 0, gain: 0, carryEnd: 0, end: 0, gpOut: 1000000, gpRun: 1000000, carry: 0, nav: 0 },
    // quarter-end: nothing left to accrue (1,000,000 already paid)
    '2026-06': { pre: 0, gain: 0, carryEnd: 0, end: 0, gpOut: 0, gpRun: 0, carry: 0, nav: 0 }
  },
  // 2026: contributions, distributions, gains, carried interest, the general partner's distributions, both ends
  year: { contrib: 10000000, dist: 14000000, gain: 5000000, carry: 1000000, gpOut: 1000000, end: 0, gpEnd: 0 },
  // the run's entry carries the GP's share; the gp: entry for May would be 1,000,000 - 1,000,000 = 0, so none is posted
  runLines: [['3100', 14000000, 'C-1001'], ['1000', -14000000], ['3300', 1000000], ['1000', -1000000]]
};

module.exports = { records, entries, expect };
