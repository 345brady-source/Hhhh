/*
 * Sample investor data.
 *
 * One example limited partner ("Jordan Davis", investing through a family trust)
 * holding three positions with the client. Amounts are scaled per client so each
 * sample firm looks different, and every total is computed from its parts so the
 * rollforward, charts and tables always agree. In production this module is
 * replaced by calls to the fund administrator's data feed.
 */
(function (NS) {
  'use strict';

  const AS_OF = '2026-09-30';
  const QUARTERS = ['Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'];
  const QUARTER_ENDS = ['2023-12-31', '2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'];
  const NAV = [1268400, 1301900, 1352700, 1389200, 1446000, 1478300, 1521600, 1569800, 1624500, 1688900, 1742300, 1794600];
  const CUM_CONTRIB = [1172500, 1210000, 1247500, 1285000, 1360000, 1397500, 1435000, 1472500, 1507500, 1545000, 1545000, 1582500];
  const CUM_DIST = [268000, 295000, 330000, 372000, 410000, 455000, 488000, 520000, 548000, 576000, 606000, 648000];
  const CUM_DIST_BEFORE = 241000; // Sep 30, 2023

  const FUNDS = [
    { commitment: 1000000, contributed: 920000, distributed: 610000, nav: 1045000 },
    { commitment: 750000, contributed: 412500, distributed: 38000, nav: 468200 },
    { commitment: 250000, contributed: 250000, distributed: 0, nav: 281400 }
  ];
  // Q3 2026 rollforward by fund: beginning + contributions - distributions + gain = ending.
  const ROLL = [
    { begin: 1041200, contrib: 0, dist: 30000, gain: 33800 },
    { begin: 425400, contrib: 37500, dist: 12000, gain: 17300 },
    { begin: 275700, contrib: 0, dist: 0, gain: 5700 }
  ];
  // Q2 2026 rollforward by fund (its ending balances are Q3's beginning balances).
  const ROLL_Q2 = [
    { begin: 1012600, contrib: 0, dist: 30000, gain: 58600 },
    { begin: 409300, contrib: 0, dist: 0, gain: 16100 },
    { begin: 267000, contrib: 0, dist: 0, gain: 8700 }
  ];

  const CALLS = [
    { fund: 1, no: 6, notice: '2026-07-31', due: '2026-08-14', amount: 37500, purpose: 'Follow-on investment and partnership expenses' },
    { fund: 1, no: 5, notice: '2026-02-27', due: '2026-03-13', amount: 37500, purpose: 'New investment' },
    { fund: 0, no: 14, notice: '2025-11-07', due: '2025-11-21', amount: 35000, purpose: 'Follow-on investment and partnership expenses' },
    { fund: 1, no: 4, notice: '2025-08-01', due: '2025-08-15', amount: 37500, purpose: 'Follow-on investment' },
    { fund: 0, no: 13, notice: '2025-05-02', due: '2025-05-16', amount: 37500, purpose: 'Follow-on investment' },
    { fund: 1, no: 3, notice: '2025-01-31', due: '2025-02-14', amount: 37500, purpose: 'New investment' },
    { fund: 1, no: 2, notice: '2024-11-01', due: '2024-11-15', amount: 75000, purpose: 'Two new investments' },
    { fund: 0, no: 12, notice: '2024-08-02', due: '2024-08-16', amount: 37500, purpose: 'Follow-on investment' },
    { fund: 0, no: 11, notice: '2024-05-03', due: '2024-05-17', amount: 37500, purpose: 'Partnership expenses and follow-on investment' },
    { fund: 0, no: 10, notice: '2024-02-02', due: '2024-02-16', amount: 37500, purpose: 'Follow-on investment' }
  ];
  const OPEN_CALL = { fund: 1, no: 7, notice: '2026-11-02', due: '2026-11-20', amount: 56250, purpose: 'New investment and partnership expenses' };

  const DISTS = [
    { date: '2026-09-24', fund: 0, type: 'Return of capital', amount: 30000 },
    { date: '2026-09-24', fund: 1, type: 'Income', amount: 12000 },
    { date: '2026-06-26', fund: 0, type: 'Realized gain', amount: 30000 },
    { date: '2026-03-27', fund: 0, type: 'Return of capital', amount: 14000 },
    { date: '2026-03-27', fund: 1, type: 'Income', amount: 14000 },
    { date: '2025-12-19', fund: 0, type: 'Realized gain', amount: 28000 },
    { date: '2025-09-26', fund: 0, type: 'Return of capital', amount: 20000 },
    { date: '2025-09-26', fund: 1, type: 'Income', amount: 12000 },
    { date: '2025-06-27', fund: 0, type: 'Realized gain', amount: 33000 },
    { date: '2025-03-28', fund: 0, type: 'Return of capital', amount: 45000 },
    { date: '2024-12-20', fund: 0, type: 'Realized gain', amount: 38000 },
    { date: '2024-09-27', fund: 0, type: 'Return of capital', amount: 42000 },
    { date: '2024-06-28', fund: 0, type: 'Income', amount: 35000 },
    { date: '2024-03-28', fund: 0, type: 'Return of capital', amount: 27000 },
    { date: '2023-12-21', fund: 0, type: 'Realized gain', amount: 27000 }
  ];

  const CATEGORIES = [
    { id: 'reports', label: 'Reports' },
    { id: 'statements', label: 'Statements' },
    { id: 'tax', label: 'Tax' },
    { id: 'notices', label: 'Notices' },
    { id: 'legal', label: 'Legal' }
  ];

  const DOCS = [
    { id: 'qr-q3-0', title: 'Q3 2026 Quarterly Report', cat: 'reports', kind: 'quarterly', fund: 0, date: '2026-11-03', pages: 24, size: '3.1 MB', isNew: true },
    { id: 'qr-q3-1', title: 'Q3 2026 Quarterly Report', cat: 'reports', kind: 'quarterly', fund: 1, date: '2026-11-03', pages: 22, size: '2.8 MB', isNew: true },
    { id: 'stmt-q3', title: 'Capital Account Statement, Q3 2026', cat: 'statements', kind: 'statement', fund: null, date: '2026-11-03', pages: 4, size: '412 KB', isNew: true },
    { id: 'call-7', title: 'Capital Call Notice No. 7', cat: 'notices', kind: 'call', fund: 1, date: '2026-11-02', pages: 2, size: '188 KB', isNew: true },
    { id: 'mu-oct', title: 'October 2026 Monthly Update', cat: 'reports', kind: 'monthly', fund: null, date: '2026-10-15', pages: 3, size: '640 KB' },
    { id: 'dist-sep', title: 'Distribution Notice, September 2026', cat: 'notices', kind: 'distribution', fund: null, date: '2026-09-22', pages: 2, size: '164 KB' },
    { id: 'mu-sep', title: 'September 2026 Monthly Update', cat: 'reports', kind: 'monthly', fund: null, date: '2026-09-15', pages: 3, size: '598 KB' },
    { id: 'qr-q2-0', title: 'Q2 2026 Quarterly Report', cat: 'reports', kind: 'quarterly', fund: 0, date: '2026-08-12', pages: 23, size: '2.9 MB' },
    { id: 'qr-q2-1', title: 'Q2 2026 Quarterly Report', cat: 'reports', kind: 'quarterly', fund: 1, date: '2026-08-12', pages: 21, size: '2.6 MB' },
    { id: 'stmt-q2', title: 'Capital Account Statement, Q2 2026', cat: 'statements', kind: 'statement', fund: null, date: '2026-08-12', pages: 4, size: '405 KB' },
    { id: 'call-6', title: 'Capital Call Notice No. 6', cat: 'notices', kind: 'call', fund: 1, date: '2026-07-31', pages: 2, size: '182 KB' },
    { id: 'agm-2026', title: '2026 Annual Meeting Presentation', cat: 'reports', kind: 'presentation', fund: null, date: '2026-05-14', pages: 38, size: '6.4 MB' },
    { id: 'afs-2025-0', title: '2025 Audited Financial Statements', cat: 'reports', kind: 'financials', fund: 0, date: '2026-04-20', pages: 31, size: '1.2 MB' },
    { id: 'k1-2025-0', title: '2025 Schedule K-1', cat: 'tax', kind: 'k1', fund: 0, date: '2026-03-12', pages: 14, size: '880 KB' },
    { id: 'k1-2025-1', title: '2025 Schedule K-1', cat: 'tax', kind: 'k1', fund: 1, date: '2026-03-12', pages: 12, size: '812 KB' },
    { id: 'k1-2025-2', title: '2025 Schedule K-1', cat: 'tax', kind: 'k1', fund: 2, date: '2026-03-05', pages: 9, size: '604 KB' },
    { id: 'lpa-1', title: 'Limited Partnership Agreement', cat: 'legal', kind: 'legal', fund: 1, date: '2022-06-30', pages: 86, size: '2.2 MB' },
    { id: 'sub-1', title: 'Subscription Agreement (executed)', cat: 'legal', kind: 'legal', fund: 1, date: '2022-06-30', pages: 42, size: '1.7 MB' }
  ];

  function threads(t, d) {
    return [
      {
        id: 't1',
        subject: 'Wire instructions for Call No. 7',
        topic: 'Capital call',
        status: 'replied',
        unread: true,
        messages: [
          { from: 'investor', at: '2026-11-03T14:12', body: 'Hi, before I send the wire for Call No. 7, can you confirm the instructions are the same as Call No. 6?' },
          {
            from: 'staff',
            name: 'Dana Whitfield',
            at: '2026-11-03T15:40',
            body: `Hi Jordan, the wire instructions are unchanged from Call No. 6. For your security, please call us at ${t.support.phone} to confirm them by phone before you send funds. We will never send changed wire instructions by email.`
          }
        ]
      },
      {
        id: 't2',
        subject: 'Question on the Q3 valuation',
        topic: 'Documents',
        status: 'open',
        unread: false,
        messages: [
          { from: 'investor', at: '2026-11-04T09:05', body: `The Q3 report shows a step-up in ${d.funds[0].short}. Is that mostly from the sale that closed in September?` },
          { from: 'staff', name: 'Marcus Lee', at: '2026-11-04T10:22', body: 'Good question. I have asked the investment team for the Q2-to-Q3 value bridge and will send it to you by Friday.' }
        ]
      },
      {
        id: 't3',
        subject: 'Updated mailing address',
        topic: 'Account',
        status: 'resolved',
        unread: false,
        messages: [
          { from: 'investor', at: '2026-09-02T11:30', body: 'We moved. Please update the mailing address on the trust account to 41 Orchard Lane, Montclair, NJ 07042.' },
          { from: 'staff', name: 'Dana Whitfield', at: '2026-09-02T13:05', body: 'Done. Your mailing address is updated for all accounts, and future notices will go to Orchard Lane. We sent a confirmation to your email on file.' }
        ]
      }
    ];
  }

  NS.buildData = function (t) {
    const s = Number(t.scale) || 1;
    const m = (v) => Math.round(v * s);
    const tf = t.funds && t.funds.length >= 3 ? t.funds : NS.TENANT_TEMPLATE.funds;
    const irr = t.irr && t.irr.length >= 3 ? t.irr : NS.TENANT_TEMPLATE.irr;

    const funds = FUNDS.map((f, i) => {
      const r = ROLL[i];
      const fund = {
        index: i,
        name: tf[i].name,
        short: tf[i].short,
        vintage: tf[i].vintage,
        strategy: tf[i].strategy,
        commitment: m(f.commitment),
        contributed: m(f.contributed),
        distributed: m(f.distributed),
        nav: m(f.nav),
        irr: irr[i],
        roll: { begin: m(r.begin), contrib: m(r.contrib), dist: m(r.dist), gain: m(r.gain), end: m(f.nav) },
        rollQ2: { begin: m(ROLL_Q2[i].begin), contrib: m(ROLL_Q2[i].contrib), dist: m(ROLL_Q2[i].dist), gain: m(ROLL_Q2[i].gain), end: m(r.begin) }
      };
      fund.unfunded = fund.commitment - fund.contributed;
      fund.totalValue = fund.nav + fund.distributed;
      fund.tvpi = fund.totalValue / fund.contributed;
      fund.dpi = fund.distributed / fund.contributed;
      fund.calledPct = fund.contributed / fund.commitment;
      return fund;
    });

    const sum = (k) => funds.reduce((a, f) => a + f[k], 0);
    const totals = {
      commitment: sum('commitment'),
      contributed: sum('contributed'),
      distributed: sum('distributed'),
      nav: sum('nav'),
      unfunded: sum('unfunded')
    };
    totals.totalValue = totals.nav + totals.distributed;
    totals.tvpi = totals.totalValue / totals.contributed;
    totals.dpi = totals.distributed / totals.contributed;
    totals.calledPct = totals.contributed / totals.commitment;

    const roll = ['begin', 'contrib', 'dist', 'gain', 'end'].reduce((o, k) => {
      o[k] = funds.reduce((a, f) => a + f.roll[k], 0);
      return o;
    }, {});

    const navSeries = NAV.map(m);
    const netContrib = CUM_CONTRIB.map((c, i) => m(c - CUM_DIST[i]));
    const distByQuarter = CUM_DIST.map((c, i) => m(c - (i === 0 ? CUM_DIST_BEFORE : CUM_DIST[i - 1])));

    const calls = CALLS.map((c) => ({ ...c, amount: m(c.amount), fundName: funds[c.fund].short }));
    const openFund = funds[OPEN_CALL.fund];
    const openCall = {
      ...OPEN_CALL,
      amount: m(OPEN_CALL.amount),
      fundName: openFund.short,
      fundLong: openFund.name,
      commitment: openFund.commitment,
      calledAfterPct: (openFund.contributed + m(OPEN_CALL.amount)) / openFund.commitment,
      unfundedAfter: openFund.unfunded - m(OPEN_CALL.amount)
    };
    const distributions = DISTS.map((d) => ({ ...d, amount: m(d.amount), fundName: funds[d.fund].short }));
    const ytd = distributions.filter((d) => d.date.startsWith('2026')).reduce((a, d) => a + d.amount, 0);

    const docs = DOCS.map((doc) => ({ ...doc, fundName: doc.fund == null ? 'All investments' : funds[doc.fund].short }));

    const events = [
      { date: OPEN_CALL.due, title: `Capital call No. ${OPEN_CALL.no} due`, meta: openFund.short, amount: openCall.amount, kind: 'due' },
      { date: '2026-12-18', title: 'Expected Q4 distribution', meta: `${funds[0].short} · estimated date`, kind: 'dist' },
      { date: '2027-02-12', title: 'Q4 2026 quarterly reports', meta: 'All investments', kind: 'report' },
      { date: '2027-03-15', title: '2026 Schedule K-1s expected', meta: 'All investments', kind: 'tax' }
    ];

    const d = {
      asOf: AS_OF,
      quarters: QUARTERS,
      quarterEnds: QUARTER_ENDS,
      investor: {
        first: 'Jordan',
        name: 'Jordan Davis',
        initials: 'JD',
        entity: 'Davis Family Trust',
        id: `${t.idPrefix || 'INV'}-10482`,
        email: 'jordan.davis@example.com',
        phone: '(917) 555-0136',
        address: '41 Orchard Lane, Montclair, NJ 07042',
        bank: { name: 'First Harbor Bank', type: 'Checking', last4: '4821', method: 'ACH' },
        accreditation: { status: 'Verified', verified: '2026-03-18', expires: '2027-03-18' },
        authorized: [{ name: 'Maria Chen, CPA', role: 'Tax documents only', since: '2024-02-09' }],
        lastSignIn: 'Nov 5, 2026 at 9:14 a.m. · Chrome on macOS'
      },
      funds,
      totals,
      roll,
      navSeries,
      netContrib,
      distByQuarter,
      calls,
      openCall,
      distributions,
      ytd,
      categories: CATEGORIES,
      docs,
      events
    };
    d.threads = threads(t, d);
    return d;
  };
})(window.CVPortal);
