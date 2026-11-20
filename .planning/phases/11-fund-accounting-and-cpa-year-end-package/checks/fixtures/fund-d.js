// gate: none
// Hand-worked fund D (opening balances), written once for phase 11's checks.
// A closed-end private equity fund of a firm that is not a sample, which existed before its books in the portal: the
// books start 2026-01-01 (fund.start) from an opening entry dated 2025-12-31. No fee, carried interest or preferred
// return is set. D-1001 and D-1002 invested 600,000.00 and 300,000.00 on 2023-03-01; one investment, holding fd-z.
// Today 2027-01-20.
//
// Every journal amount and every expected figure is an integer number of cents; a position's amount is whole dollars.
'use strict';

const OID = 'fund-d';

const records = {
  v: 2,
  tenant: { id: 'fund-d-sponsor', sample: false, name: 'Fund D Sponsor', shortName: 'Fund D Sponsor', legalName: 'Fund D Sponsor Management, LLC' },
  offerings: [
    {
      id: OID,
      name: 'Fund D, L.P.',
      shortName: 'Fund D',
      type: 'Private equity fund',
      status: 'Active',
      closeDate: '2023-03-01',
      exit: { basis: 'date', date: '2033-03-01', from: '', to: '', note: '' },
      distribution: { frequency: 'As realized', type: 'Realization proceeds', target: '' },
      terms: [],
      accounting: {}
    }
  ],
  investors: [
    {
      id: 'D-1001',
      contact: 'Investor D One',
      title: 'Investor D One',
      type: 'individual',
      email: 'd-1001@example.com',
      taxForm: 'W-9',
      payment: { method: 'check', bank: null },
      positions: [{ offeringId: OID, amount: 600000, date: '2023-03-01' }] // 60,000,000 cents
    },
    {
      id: 'D-1002',
      contact: 'Investor D Two',
      title: 'Investor D Two',
      type: 'individual',
      email: 'd-1002@example.com',
      taxForm: 'W-9',
      payment: { method: 'check', bank: null },
      positions: [{ offeringId: OID, amount: 300000, date: '2023-03-01' }] // 30,000,000 cents
    }
  ],
  calls: [],
  runs: [],
  notices: [],
  audit: [],
  requests: [],
  docs: [],
  books: {
    v: 1,
    funds: {
      [OID]: {
        start: '2026-01-01',
        accounts: [],
        journal: [],
        holdings: [{ id: 'fd-z', name: 'Portfolio Co Z', kind: 'investment', level: 3 }],
        marks: [],
        bank: { accounts: [], imports: [], lines: [], recs: [] },
        closed: [],
        exceptions: []
      }
    }
  }
};

const entries = [
  // Opening balances at 2025-12-31: cash 5,000,000, Z at cost 90,000,000 and appreciation 10,000,000 = 105,000,000,
  // the partners' capital 70,000,000 and 35,000,000
  {
    date: '2025-12-31',
    memo: 'Opening balances',
    src: 'open:' + OID,
    lines: [['1000', 5000000], ['1100', 90000000, '', 'fd-z'], ['1150', 10000000, '', 'fd-z'], ['3900', -70000000, 'D-1001'], ['3900', -35000000, 'D-1002']]
  },
  { date: '2026-06-30', memo: 'Dividend from Portfolio Co Z', src: 'bank:fd-1', lines: [['1000', 3000000], ['4010', -3000000]] }
];

const expect = {
  offeringId: OID,
  // Through November 2025 nothing is recorded: capital stays as contributed
  untilNov2025: { 'D-1001': 60000000, 'D-1002': 30000000 },
  // December 2025: the opening entry sets capital, the difference being that month's gains (10,000,000 and 5,000,000)
  dec2025: { end: { 'D-1001': 70000000, 'D-1002': 35000000 }, gain: { 'D-1001': 10000000, 'D-1002': 5000000 }, nav: 105000000 },
  // June 2026: the dividend of 3,000,000 splits 2,000,000 / 1,000,000; NAV 108,000,000 = journal 8,000,000 + 90,000,000 + 10,000,000
  jun2026: { end: { 'D-1001': 72000000, 'D-1002': 36000000 }, income: { 'D-1001': 2000000, 'D-1002': 1000000 }, nav: 108000000 }
};

module.exports = { records, entries, expect };
