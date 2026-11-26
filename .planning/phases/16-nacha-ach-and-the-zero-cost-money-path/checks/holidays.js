// gate: node
// last "HOLIDAYS: PASS (cases run: 3)"
// Banking days by rule for any year (plan 16-01, no browser): assets/js/nacha.js works out the Federal Reserve's eleven
// holidays for any year (a Sunday holiday closes the Monday, a Saturday holiday closes nothing) plus a dated list of
// extra closed days; the distribution schedule (data.js bankingOnOrAfter through NS.nextDistribution) follows it; a file
// built for the next banking day passes the independent reader (checks/achcli.sh, through lib16.validate).
// The portal is loaded with phase 11's loader inside each case.
//   node holidays.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "HOLIDAYS: PASS (cases run: N)" or
// "HOLIDAYS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const L = require('./lib16.js');

const J = (x) => JSON.stringify(x);

/** A file of three PPD/CCD credits to never-issued banks, built by the portal's own builder. */
function fixtureFile(NS, effectiveDate, now) {
  return NS.nacha.build({
    origin: { destinationRouting: L.NEVER.odfi, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: L.NEVER.odfi },
    company: { name: 'CHECK FUND LLC', id: '1990000001' },
    entries: [
      { name: 'Ada Check', id: 'INV-1', routing: L.NEVER.rdfi[0], account: L.account(1), accountType: 'checking', cents: 125000, sec: 'PPD' },
      { name: 'Ben Check', id: 'INV-2', routing: L.NEVER.rdfi[1], account: L.account(2), accountType: 'savings', cents: 98000, sec: 'PPD' },
      { name: 'Check Holdings LLC', id: 'INV-3', routing: L.NEVER.rdfi[2], account: L.account(3), accountType: 'checking', cents: 410055, sec: 'CCD' }
    ],
    effectiveDate,
    description: 'DISTRIB',
    now
  });
}

const parts = {
  // 2029 is past the end of the old hand-written table (2025-2028): its holidays are closed by the rule alone.
  async y2029({ check }) {
    const NS = L.loadPortal(undefined, { today: '2029-06-20' });
    const n = NS.nacha;
    check('2029-07-04 (Independence Day, a Wednesday) is not a banking day', n.isBankingDay('2029-07-04') === false);
    check('2029-12-25 (Christmas, a Tuesday) is not a banking day', n.isBankingDay('2029-12-25') === false);
    check("nextBankingDay('2029-07-03', 1) is 2029-07-05", n.nextBankingDay('2029-07-03', 1) === '2029-07-05', n.nextBankingDay('2029-07-03', 1));
    check("bankingDayReason('2029-07-04') is 'is a Federal Reserve holiday'", n.bankingDayReason('2029-07-04') === 'is a Federal Reserve holiday', n.bankingDayReason('2029-07-04'));
  },

  // The schedule reads NS.nacha.isBankingDay at call time: a payment due on 2029-07-04 moves to 2029-07-05.
  async schedule({ check }) {
    const NS = L.loadPortal(undefined, { today: '2029-06-20' });
    const ws = L.sampleWorkspaces(NS).find((w) => w.offerings.some((o) => (o.distribution || {}).frequency === 'Monthly' && o.status === 'Active' && w.runs.some((r) => r.offeringId === o.id && !r.cancelled)));
    check('a sample workspace has an active monthly offering with paid runs', !!ws);
    if (!ws) return;
    const o = ws.offerings.find((x) => (x.distribution || {}).frequency === 'Monthly' && x.status === 'Active' && ws.runs.some((r) => r.offeringId === x.id && !r.cancelled));
    o.distribution = Object.assign({}, o.distribution, { frequency: 'Monthly', day: 4 });
    const runs = ws.runs.filter((r) => r.offeringId === o.id && !r.cancelled).sort((a, b) => (a.date < b.date ? -1 : 1));
    runs[runs.length - 1].date = '2029-06-04';
    const next = NS.nextDistribution(ws, o, '2029-06-20');
    check(`${o.id} paying monthly on the 4th, last paid 2029-06-04: the next payment is 2029-07-05, moved from 2029-07-04`, !!next && next.date === '2029-07-05' && next.nominal === '2029-07-04' && next.moved === true, next && { date: next.date, nominal: next.nominal, moved: next.moved });
  },

  // A file for the next banking day passes the independent reader; the same entries dated the holiday are refused by
  // the builder's own date check.
  async file({ check }) {
    const NS = L.loadPortal(undefined, { today: '2029-07-02' });
    const now = new Date(2029, 6, 2, 10, 0);
    const good = fixtureFile(NS, '2029-07-05', now);
    const v = L.validate(good.text);
    check('a file effective 2029-07-05 passes the independent reader (-validate-file and -validate-totals)', v.ok, v.out);
    const dateCheck = (f) => f.checks.find((c) => /^Effective date/.test(c.label));
    check("the builder's own date check passes for 2029-07-05", !!dateCheck(good) && dateCheck(good).ok === true, dateCheck(good));
    const bad = fixtureFile(NS, '2029-07-04', now);
    const c = dateCheck(bad);
    check("the same entries effective 2029-07-04 give a date check that is not ok ('Effective date is a Federal Reserve holiday')", !!c && c.ok === false && c.label === 'Effective date is a Federal Reserve holiday', c);
    const own = J([v.out, good.checks, c]);
    check('nothing this case prints holds a full routing or account number', L.leaks(own).length === 0, `${L.leaks(own).length} found`);
  }
};

L.runParts(parts, { name: 'HOLIDAYS', unit: 'cases', flag: '--case' });
