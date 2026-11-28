// gate: none
// Hand-worked fund B (11-RESEARCH.md "Hand-worked fund B"), written once for phase 11's checks.
// An open-ended fund (an offering type with the hedge profile) of a firm that is not a sample: management fee 1.2% a year
// on net asset value, incentive allocation 20% over each investor's high-water mark, no preferred return set. Today is
// 2026-03-05, so only January and February 2026 are complete. One investment, holding fb-w.
//
// Every journal amount and every expected figure is an integer number of cents; a position's amount is whole dollars
// (the portal's stored type).
//
//   records   the workspace as the portal stores it (tenant.sample false)
//   entries   the bank lines and valuations, posted directly
//   expect    every figure, worked by hand (the working is beside each one)
'use strict';

const OID = 'fund-b';

const records = {
  v: 2,
  tenant: { id: 'fund-b-sponsor', sample: false, name: 'Fund B Sponsor', shortName: 'Fund B Sponsor', legalName: 'Fund B Sponsor Management, LLC' },
  offerings: [
    {
      id: OID,
      name: 'Fund B, L.P.',
      shortName: 'Fund B',
      type: 'Hedge fund',
      status: 'Open',
      closeDate: '2026-01-01',
      exit: { basis: 'open', date: '', from: '', to: '', note: '' },
      distribution: { frequency: 'None', type: 'Distribution', target: '' },
      terms: [],
      accounting: { mgmtFee: '1.2', feeBasis: 'nav', carry: '20' }
    }
  ],
  investors: [
    {
      id: 'B-1001',
      contact: 'Investor B One',
      title: 'Investor B One',
      type: 'individual',
      email: 'b-1001@example.com',
      taxForm: 'W-9',
      payment: { method: 'ach', bank: { holder: 'Investor B One', routing: '154003186', account: '30010001', type: 'checking' } },
      positions: [{ offeringId: OID, amount: 1000000, date: '2026-01-01' }] // 100,000,000 cents
    },
    {
      id: 'B-1002',
      contact: 'Investor B Two',
      title: 'Investor B Two',
      type: 'individual',
      email: 'b-1002@example.com',
      taxForm: 'W-9',
      payment: { method: 'ach', bank: { holder: 'Investor B Two', routing: '154003186', account: '30010002', type: 'checking' } },
      positions: [{ offeringId: OID, amount: 500000, date: '2026-02-01' }] // 50,000,000 cents
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
        start: '',
        accounts: [],
        journal: [],
        holdings: [{ id: 'fb-w', name: 'Fund B portfolio', kind: 'investment', level: 3 }],
        marks: [],
        bank: { accounts: [], imports: [], lines: [], recs: [] },
        closed: [],
        exceptions: []
      }
    }
  }
};

const entries = [
  { date: '2026-01-02', memo: 'Purchase of the portfolio', src: 'bank:fb-1', lines: [['1100', 100000000, '', 'fb-w'], ['1000', -100000000]] },
  { date: '2026-01-31', memo: 'Portfolio valued at month-end', src: 'mark:fb-m1', lines: [['1150', 3000000, '', 'fb-w'], ['6100', -3000000]] },
  { date: '2026-02-02', memo: 'Purchase of the portfolio', src: 'bank:fb-2', lines: [['1100', 50000000, '', 'fb-w'], ['1000', -50000000]] },
  { date: '2026-02-28', memo: 'Portfolio valued at month-end', src: 'mark:fb-m2', lines: [['1150', -1500000, '', 'fb-w'], ['6100', 1500000]] }
];

const expect = {
  offeringId: OID,
  today: '2026-03-05',
  months: {
    '2026-01': {
      rows: {
        // gain 3,000,000 (B-1001 alone); fee 100,000,000 x 0.012 / 12 = 100,000;
        // before incentive 100,000,000 + 3,000,000 - 100,000 = 102,900,000; incentive 20% x 2,900,000 = 580,000
        'B-1001': { gain: 3000000, fee: 100000, pre: 102900000, carryEnd: 580000, end: 102320000 }
      },
      nav: 102900000 // 102,320,000 + 580,000 = journal 100,000,000 + 3,000,000 - 100,000
    },
    '2026-02': {
      rows: {
        // the loss of 1,500,000 over bases 102,320,000 : 50,000,000 is exactly 1,007,615.546 : 492,384.454, so
        // -1,007,616 and -492,384 (the spare cent to the larger remainder); fee 102,320,000 x 0.012 / 12 = 102,320;
        // before incentive 102,320,000 - 1,007,616 - 102,320 + 580,000 = 101,790,064; incentive 20% x 1,790,064 =
        // 358,012.8 -> 358,013; ends 101,790,064 - 358,013 = 101,432,051
        'B-1001': { gain: -1007616, fee: 102320, pre: 101790064, carryEnd: 358013, end: 101432051 },
        // fee 50,000,000 x 0.012 / 12 = 50,000; ends 50,000,000 - 492,384 - 50,000 = 49,457,616, below its high-water mark
        'B-1002': { gain: -492384, fee: 50000, pre: 49457616, carryEnd: 0, end: 49457616 }
      },
      nav: 151247680 // 101,432,051 + 49,457,616 + 358,013 = journal 150,000,000 + 1,500,000 - (100,000 + 152,320)
    }
  }
};

module.exports = { records, entries, expect };
