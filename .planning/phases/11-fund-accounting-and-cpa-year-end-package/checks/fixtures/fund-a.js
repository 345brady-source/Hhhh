// gate: none
// Hand-worked fund A (11-RESEARCH.md "Hand-worked fund A"), written once for every phase 11 check.
// A closed-end private equity fund, calendar 2026: two limited partners, FA-1001 committed $600,000 (paid by ACH) and
// FA-1002 committed $300,000 (paid by check); management fee 2% a year on commitments; no carried interest; one
// investment, Portfolio Co X (holding fa-x).
//
// Every journal amount and every expected figure is an integer number of cents. The workspace records keep the
// portal's existing field types: a position's amount and commitment are whole dollars (operations.js commitOf and
// paidInOf multiply them by 100), a call item and a run's lines are cents.
//
//   records        the workspace as the portal stores it (tenant.sample false)
//   recordEntries  the entries those records give (plan 11-05 must produce exactly these: src, date, lines, in order)
//   entries        the other entries (bank lines, plan 11-08; valuations, plan 11-10), posted directly
//   expect         every figure, worked by hand (the working is in the comments beside each one)
'use strict';

const OID = 'fund-a';
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
const MONTH_ENDS = ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const records = {
  v: 2,
  tenant: {
    id: 'fund-a-sponsor',
    sample: false,
    name: 'Fund A Sponsor',
    shortName: 'Fund A Sponsor',
    legalName: 'Fund A Sponsor Management, LLC',
    ach: { companyName: 'FUND A LP', companyId: '1000000001', odfiRouting: '044003186', odfiName: 'Sample Bank' }
  },
  offerings: [
    {
      id: OID,
      name: 'Fund A, L.P.',
      shortName: 'Fund A',
      type: 'Private equity fund',
      status: 'Active',
      closeDate: '2026-01-15',
      exit: { basis: 'date', date: '2036-01-15', from: '', to: '', note: '' },
      distribution: { frequency: 'As realized', type: 'Realization proceeds', target: '' },
      terms: [],
      accounting: { mgmtFee: '2', feeBasis: 'commitment', carry: '0', pref: '0' }
    }
  ],
  investors: [
    {
      id: 'FA-1001',
      contact: 'Investor One',
      title: 'Investor One',
      type: 'individual',
      email: 'fa-1001@example.com',
      taxForm: 'W-9',
      payment: { method: 'ach', bank: { holder: 'Investor One', routing: '044003186', account: '10010001', type: 'checking' } },
      positions: [
        { offeringId: OID, amount: 0, commitment: 600000, date: '2026-01-10' },
        // written by NS.ops.receive when the call payment is recorded (operations.js addContribution)
        { offeringId: OID, amount: 300000, commitment: 0, date: '2026-01-15', ref: 'fa-call-1' }
      ]
    },
    {
      id: 'FA-1002',
      contact: 'Investor Two',
      title: 'Investor Two',
      type: 'individual',
      email: 'fa-1002@example.com',
      taxForm: 'W-9',
      payment: { method: 'check', bank: null },
      positions: [
        { offeringId: OID, amount: 0, commitment: 300000, date: '2026-01-10' },
        { offeringId: OID, amount: 150000, commitment: 0, date: '2026-01-15', ref: 'fa-call-1' }
      ]
    }
  ],
  calls: [
    {
      id: 'fa-call-1',
      offeringId: OID,
      number: 1,
      noticeDate: '2026-01-05',
      due: '2026-01-15',
      pct: 0.5,
      total: 45000000, // 50% of 900,000.00 = 450,000.00
      purpose: 'Portfolio investments and fund expenses',
      note: '',
      status: 'complete',
      items: [
        { investorId: 'FA-1001', cents: 30000000, received: '2026-01-15', reminders: [] }, // 50% of 600,000.00
        { investorId: 'FA-1002', cents: 15000000, received: '2026-01-15', reminders: [] } // 50% of 300,000.00
      ]
    }
  ],
  runs: [
    {
      id: 'fa-run-1',
      offeringId: OID,
      date: '2026-12-15',
      type: 'Realization proceeds',
      total: 900000, // 9,000.00
      status: 'paid',
      source: 'recorded',
      // 9,000.00 split by amount invested 300,000 : 150,000 = 2 : 1
      lines: [
        { investorId: 'FA-1001', grossCents: 600000, withheld: [], netCents: 600000 },
        { investorId: 'FA-1002', grossCents: 300000, withheld: [], netCents: 300000 }
      ],
      linesBasis: 'recorded',
      linesAt: '2026-12-15T15:00:00.000Z',
      linesBy: 'Fund A Sponsor'
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
        holdings: [{ id: 'fa-x', name: 'Portfolio Co X', kind: 'investment', level: 3 }],
        marks: [],
        bank: { accounts: [], imports: [], lines: [], recs: [] },
        closed: [],
        exceptions: []
      }
    }
  }
};

/* ---------- Entries the records give ---------- */
const recordEntries = [
  { date: '2026-01-15', memo: 'Capital call 1: FA-1001', src: 'call:fa-call-1:FA-1001', lines: [['1000', 30000000], ['3000', -30000000, 'FA-1001']] },
  { date: '2026-01-15', memo: 'Capital call 1: FA-1002', src: 'call:fa-call-1:FA-1002', lines: [['1000', 15000000], ['3000', -15000000, 'FA-1002']] }
];
// Fee for the month: 2% a year of 900,000.00 / 12 = 1,500.00 (FA-1001 1,000.00 + FA-1002 500.00), dated the month-end.
MONTHS.forEach((k, i) =>
  recordEntries.push({ date: MONTH_ENDS[i], memo: `Management fee ${MON[i]} 2026`, src: `fee:${OID}:${k}`, lines: [['5000', 150000], ['2100', -150000]] })
);
// One cash line for the ACH file (no investor on it), one per check (the investor on it).
recordEntries.push({
  date: '2026-12-15',
  memo: 'Distribution fa-run-1',
  src: 'run:fa-run-1',
  lines: [['3100', 600000, 'FA-1001'], ['3100', 300000, 'FA-1002'], ['1000', -600000], ['1000', -300000, 'FA-1002']]
});

/* ---------- Other entries (bank lines and valuations) ---------- */
const entries = [
  { date: '2026-01-20', memo: 'Purchase of Portfolio Co X', src: 'bank:fa-1', lines: [['1100', 40000000, '', 'fa-x'], ['1000', -40000000]] },
  { date: '2026-03-10', memo: 'Legal fees', src: 'bank:fa-2', lines: [['5100', 750000], ['1000', -750000]] },
  { date: '2026-03-31', memo: 'Management fees paid, first quarter', src: 'bank:fa-3', lines: [['2100', 450000], ['1000', -450000]] },
  { date: '2026-06-30', memo: 'Dividend from Portfolio Co X', src: 'bank:fa-4', lines: [['1000', 1200000], ['4010', -1200000]] },
  { date: '2026-06-30', memo: 'Management fees paid, second quarter', src: 'bank:fa-5', lines: [['2100', 450000], ['1000', -450000]] },
  { date: '2026-09-30', memo: 'Management fees paid, third quarter', src: 'bank:fa-6', lines: [['2100', 450000], ['1000', -450000]] },
  // X valued at 460,000.00 against cost 400,000.00: +60,000.00
  { date: '2026-09-30', memo: 'Portfolio Co X valued at $460,000.00', src: 'mark:fa-m1', lines: [['1150', 6000000, '', 'fa-x'], ['6100', -6000000]] },
  // X valued at 490,000.00 against 460,000.00: +30,000.00
  { date: '2026-12-31', memo: 'Portfolio Co X valued at $490,000.00', src: 'mark:fa-m2', lines: [['1150', 3000000, '', 'fa-x'], ['6100', -3000000]] }
];

/* ---------- Every figure, worked by hand ---------- */
const expect = {
  offeringId: OID,
  monthEnds: MONTH_ENDS,
  // Trial balance at 2026-12-31 (debit +, credit -), ten accounts.
  tb: [
    { code: '1000', end: 3200000 }, // 450,000 - 400,000 - 7,500 - 13,500 + 12,000 - 9,000 = 32,000.00
    { code: '1100', end: 40000000 }, // 400,000.00
    { code: '1150', end: 9000000 }, // 60,000 + 30,000 = 90,000.00
    { code: '2100', end: -450000 }, // 12 x 1,500 = 18,000 accrued - 3 x 4,500 = 13,500 paid = 4,500.00 owed
    { code: '3000', end: -45000000 }, // 300,000 + 150,000 = 450,000.00
    { code: '3100', end: 900000 }, // 6,000 + 3,000 = 9,000.00
    { code: '4010', end: -1200000 }, // 12,000.00
    { code: '5000', end: 1800000 }, // 12 x 1,500 = 18,000.00
    { code: '5100', end: 750000 }, // 7,500.00
    { code: '6100', end: -9000000 } // 90,000.00
  ],
  // 3,200,000 + 40,000,000 + 9,000,000 + 900,000 + 1,800,000 + 750,000 = 55,650,000
  tbDebits: 55650000,
  // 450,000 + 45,000,000 + 1,200,000 + 9,000,000 = 55,650,000
  tbCredits: 55650000,
  // Accounting equation at 2026-12-31.
  equation: {
    assets: 52200000, // 3,200,000 + 40,000,000 + 9,000,000
    liabilities: 450000,
    netAssets: 51750000, // 52,200,000 - 450,000
    equity: 44100000, // 45,000,000 - 900,000
    results: 7650000 // 1,200,000 - 1,800,000 - 750,000 + 9,000,000
  },
  // Statements (11-RESEARCH.md).
  statements: {
    investmentsFV: 49000000, // 40,000,000 + 9,000,000
    investmentsCost: 40000000,
    cash: 3200000,
    totalAssets: 52200000,
    liabilities: 450000,
    netAssets: 51750000,
    income: 1200000,
    expenses: 2550000, // 1,800,000 + 750,000
    netInvestmentLoss: -1350000, // 1,200,000 - 2,550,000
    unrealized: 9000000,
    netIncrease: 7650000 // -1,350,000 + 9,000,000
  },
  // Capital accounts at 2026-12-31 (bases stay exactly 2 : 1 every month).
  capital: {
    'FA-1001': 34500000, // 300,000 - 6,000 + 8,000 - 5,000 - 12,000 + 60,000 = 345,000.00
    'FA-1002': 17250000 // 150,000 - 3,000 + 4,000 - 2,500 - 6,000 + 30,000 = 172,500.00
  },
  cashFlows: {
    netIncrease: 7650000,
    lessUnrealized: -9000000,
    purchases: -40000000,
    feesPayableIncrease: 450000,
    operating: -40900000, // 7,650,000 - 9,000,000 - 40,000,000 + 450,000
    contributions: 45000000,
    distributions: -900000,
    financing: 44100000, // 45,000,000 - 900,000
    change: 3200000 // -40,900,000 + 44,100,000
  },
  // Limited partners' capital (= net assets) at each month-end, January to December 2026:
  //   Jan 450,000 - 1,500 = 448,500 · Feb -1,500 · Mar -1,500 - 7,500 legal · Apr, May -1,500 · Jun -1,500 + 12,000 dividend ·
  //   Jul, Aug -1,500 · Sep -1,500 + 60,000 valuation · Oct, Nov -1,500 · Dec -1,500 - 9,000 distribution + 30,000 valuation
  lpCapital: [44850000, 44700000, 43800000, 43650000, 43500000, 44550000, 44400000, 44250000, 50100000, 49950000, 49800000, 51750000],
  lpCapitalSum: 555300000,
  lpCapitalAverage: 46275000, // 555,300,000 / 12
  // A trial balance from 2027-01-01: these begin at 0, and 2026's results are carried in 3900.
  y2027: { zeroBegin: ['4010', '5000', '5100', '6100'], begin3900: -7650000 }
};

module.exports = { records, entries, recordEntries, expect };
