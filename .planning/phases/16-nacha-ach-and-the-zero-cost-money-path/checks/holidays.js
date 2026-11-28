// gate: node
// last "HOLIDAYS: PASS (cases run: 10)"
// Banking days by rule for any year (plan 16-01, no browser): assets/js/nacha.js works out the Federal Reserve's eleven
// holidays for any year (a Sunday holiday closes the Monday, a Saturday holiday closes nothing) plus a dated list of
// extra closed days; the distribution schedule (data.js bankingOnOrAfter through NS.nextDistribution) follows it; a file
// built for the next banking day passes the independent reader (checks/achcli.sh, through lib16.validate). The rule is
// compared both ways with the old hand-written 2025-2028 table (read from commit 8d70da8, never typed here) and with an
// independent calendar (fixtures/ach/holidays-2025-2035.txt, generated from moov-io/base v0.68.3 by
// fixtures/ach/make-holidays). The portal is loaded with phase 11's loader inside each case.
//   node holidays.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "HOLIDAYS: PASS (cases run: N)" or
// "HOLIDAYS: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib16.js');

const J = (x) => JSON.stringify(x);
const FIXTURE = path.join(__dirname, 'fixtures/ach/holidays-2025-2035.txt');
const OLD_TABLE_COMMIT = '8d70da8';
const REASON = 'is a Federal Reserve holiday';

/** Every day from a to b inclusive, as 'YYYY-MM-DD' with its weekday (0 Sunday). */
function days(a, b) {
  const out = [];
  const d = new Date(a + 'T00:00:00Z');
  const end = new Date(b + 'T00:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push({ iso: d.toISOString().slice(0, 10), wd: d.getUTCDay() });
  return out;
}
/** a minus b, as a sorted list. */
const minus = (a, b) => {
  const s = new Set(b);
  return Array.from(new Set(a)).filter((x) => !s.has(x)).sort();
};

const parts = {
  // 2029 is past the end of the old hand-written table (2025-2028): its holidays are closed by the rule alone.
  async y2029({ check }) {
    const NS = L.loadPortal(undefined, { today: '2029-06-20' });
    const n = NS.nacha;
    check('2029-07-04 (Independence Day, a Wednesday) is not a banking day', n.isBankingDay('2029-07-04') === false);
    check('2029-12-25 (Christmas, a Tuesday) is not a banking day', n.isBankingDay('2029-12-25') === false);
    check("nextBankingDay('2029-07-03', 1) is 2029-07-05", n.nextBankingDay('2029-07-03', 1) === '2029-07-05', n.nextBankingDay('2029-07-03', 1));
    check(`bankingDayReason('2029-07-04') is '${REASON}'`, n.bankingDayReason('2029-07-04') === REASON, n.bankingDayReason('2029-07-04'));
  },

  // The schedule reads NS.nacha.isBankingDay at call time: a payment due on 2029-07-04 moves to 2029-07-05.
  async schedule({ check }) {
    const NS = L.loadPortal(undefined, { today: '2029-06-20' });
    const monthly = (w, o) => (o.distribution || {}).frequency === 'Monthly' && o.status === 'Active' && w.runs.some((r) => r.offeringId === o.id && !r.cancelled);
    const ws = L.sampleWorkspaces(NS).find((w) => w.offerings.some((o) => monthly(w, o)));
    check('a sample workspace has an active monthly offering with paid runs', !!ws);
    if (!ws) return;
    const o = ws.offerings.find((x) => monthly(ws, x));
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
    const good = L.achFile(NS, { effectiveDate: '2029-07-05', now });
    const v = L.validate(good.text);
    check('a file effective 2029-07-05 passes the independent reader (-validate-file and -validate-totals)', v.ok, v.out);
    const dateCheck = (f) => f.checks.find((c) => /^Effective date/.test(c.label));
    check("the builder's own date check passes for 2029-07-05", !!dateCheck(good) && dateCheck(good).ok === true, dateCheck(good));
    const bad = L.achFile(NS, { effectiveDate: '2029-07-04', now });
    const c = dateCheck(bad);
    check(`the same entries effective 2029-07-04 give a date check that is not ok ('Effective date ${REASON}')`, !!c && c.ok === false && c.label === `Effective date ${REASON}`, c);
    const own = J([v.out, good.checks, c]);
    check('nothing this case prints holds a full routing or account number', L.leaks(own).length === 0, `${L.leaks(own).length} found`);
  },

  // The rule gives exactly the 39 dates of the old hand-written table for 2025-2028, both ways.
  async old({ check }) {
    const text = execFileSync('git', ['-C', L.ROOT, 'show', `${OLD_TABLE_COMMIT}:assets/js/nacha.js`], { encoding: 'utf8' });
    const m = text.match(/const FED_HOLIDAYS = new Set\(\[([\s\S]*?)\]\)/);
    check(`commit ${OLD_TABLE_COMMIT} holds the old table (const FED_HOLIDAYS = new Set([...]))`, !!m);
    if (!m) return;
    const table = Array.from(m[1].matchAll(/'(\d{4}-\d{2}-\d{2})'/g)).map((x) => x[1]);
    check('the old table lists 39 dates, all in 2025-2028', table.length === 39 && table.every((d) => d >= '2025' && d < '2029'), table.length);
    const NS = L.loadPortal(undefined, { today: '2026-11-26' });
    const rule = [2025, 2026, 2027, 2028].reduce((a, y) => a.concat(NS.nacha.fedHolidays(y)), []);
    check('every date of the old table is a rule date', minus(table, rule).length === 0, minus(table, rule));
    check('every rule date of 2025-2028 is in the old table', minus(rule, table).length === 0, minus(rule, table));
  },

  // Every weekday of 2025-2035 is closed exactly when the independent calendar lists it.
  async independent({ check }) {
    const lines = fs.readFileSync(FIXTURE, 'utf8').split('\n');
    const head = lines.filter((l) => /^#/.test(l)).join('\n');
    check('the fixture names its generator, moov-io/base v0.68.3 and the Go version', /make-holidays/.test(head) && /moov-io\/base v0\.68\.3/.test(head) && /Go version: go\d/.test(head), head);
    const listed = lines.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l));
    check('the fixture lists 112 dates', listed.length === 112, listed.length);
    const NS = L.loadPortal(undefined, { today: '2026-11-26' });
    const closed = days('2025-01-01', '2035-12-31')
      .filter((d) => d.wd !== 0 && d.wd !== 6 && !NS.nacha.isBankingDay(d.iso))
      .map((d) => d.iso);
    check('every weekday the independent calendar closes is closed by isBankingDay', minus(listed, closed).length === 0, minus(listed, closed));
    check('every weekday isBankingDay closes is closed by the independent calendar', minus(closed, listed).length === 0, minus(closed, listed));
  },

  // A holiday on a Saturday closes nothing: the Friday before stays a banking day.
  async saturday({ check }) {
    const NS = L.loadPortal(undefined, { today: '2026-11-26' });
    [
      ['2026-07-03', 'Independence Day 2026 falls on a Saturday'],
      ['2027-12-24', 'Christmas 2027 falls on a Saturday']
    ].forEach(([d, why]) => check(`${d} is a banking day (${why})`, NS.nacha.isBankingDay(d) === true && NS.nacha.bankingDayReason(d) === '', NS.nacha.bankingDayReason(d)));
  },

  // A holiday on a Sunday closes the Monday after it.
  async sunday({ check }) {
    const NS = L.loadPortal(undefined, { today: '2026-11-26' });
    [
      ['2027-07-05', 'Independence Day 2027 falls on a Sunday'],
      ['2029-11-12', 'Veterans Day 2029 falls on a Sunday']
    ].forEach(([d, why]) => check(`${d} is closed with '${REASON}' (${why})`, NS.nacha.isBankingDay(d) === false && NS.nacha.bankingDayReason(d) === REASON, NS.nacha.bankingDayReason(d)));
  },

  // The dated list of extra closed days: empty and frozen at launch; one line added closes that day.
  async extra({ check }) {
    const NS = L.loadPortal(undefined, { today: '2026-11-26' });
    const X = NS.nacha.EXTRA_CLOSED;
    check('NS.nacha.EXTRA_CLOSED is an empty frozen list', Array.isArray(X) && X.length === 0 && Object.isFrozen(X), X);
    const DAY = '2031-03-12';
    check(`${DAY} (a Wednesday, no holiday) is a banking day without an extra line`, NS.nacha.isBankingDay(DAY) === true);
    const src = fs.readFileSync(path.join(L.ROOT, 'assets/js/nacha.js'), 'utf8');
    const at = src.search(/const EXTRA_CLOSED = Object\.freeze\(\[/);
    check('nacha.js has the line const EXTRA_CLOSED = Object.freeze([', at >= 0);
    if (at < 0) return;
    const open = src.indexOf('[', at) + 1;
    const edited = src.slice(0, open) + `\n    { date: '${DAY}', why: 'A one-off closure added by the check' },` + src.slice(open);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-hol16-'));
    try {
      fs.copyFileSync(path.join(L.ROOT, 'diy.html'), path.join(tmp, 'diy.html'));
      fs.mkdirSync(path.join(tmp, 'assets/js'), { recursive: true });
      fs.readdirSync(path.join(L.ROOT, 'assets/js')).forEach((f) => {
        const from = path.join(L.ROOT, 'assets/js', f);
        if (f !== 'nacha.js' && fs.statSync(from).isFile()) fs.symlinkSync(from, path.join(tmp, 'assets/js', f));
      });
      fs.writeFileSync(path.join(tmp, 'assets/js/nacha.js'), edited);
      const N2 = L.loadPortal(tmp, { today: '2026-11-26' });
      const X2 = N2.nacha.EXTRA_CLOSED;
      check('with one dated line added, EXTRA_CLOSED holds that one frozen entry', X2.length === 1 && X2[0].date === DAY && Object.isFrozen(X2) && Object.isFrozen(X2[0]), X2);
      check(`with that line, ${DAY} is not a banking day and its reason is '${REASON}'`, N2.nacha.isBankingDay(DAY) === false && N2.nacha.bankingDayReason(DAY) === REASON, N2.nacha.bankingDayReason(DAY));
      check(`with that line, nextBankingDay('2031-03-11', 1) is 2031-03-13`, N2.nacha.nextBankingDay('2031-03-11', 1) === '2031-03-13', N2.nacha.nextBankingDay('2031-03-11', 1));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },

  // Every year 2025-2100: 9 to 11 dates, sorted, no duplicate, every one a weekday of that year.
  async years({ check }) {
    const NS = L.loadPortal(undefined, { today: '2026-11-26' });
    const bad = [];
    for (let y = 2025; y <= 2100; y++) {
      const h = NS.nacha.fedHolidays(y);
      const sorted = h.slice().sort();
      const wdOk = h.every((d) => d.slice(0, 4) === String(y) && [0, 6].indexOf(new Date(d + 'T00:00:00Z').getUTCDay()) < 0);
      if (!(h.length >= 9 && h.length <= 11) || J(sorted) !== J(h) || new Set(h).size !== h.length || !wdOk) bad.push({ y, h });
    }
    check('fedHolidays(2025..2100): 9 to 11 dates each, sorted, no duplicate, every one a weekday of its year', bad.length === 0, bad.slice(0, 3));
    const a = NS.nacha.fedHolidays(2031);
    a.push('2031-03-12');
    check("a caller changing the list it was given does not change the rule's list", NS.nacha.fedHolidays(2031).indexOf('2031-03-12') < 0 && NS.nacha.isBankingDay('2031-03-12') === true);
  },

  // F-18: the mobile copy is the generated copy of the web file.
  async mobile({ check }) {
    const web = fs.readFileSync(path.join(L.ROOT, 'assets/js/nacha.js'), 'utf8');
    const mob = fs.readFileSync(path.join(L.ROOT, 'mobile/src/core/nacha.js'), 'utf8');
    const nl = mob.indexOf('\n');
    const header = mob.slice(0, nl);
    check('mobile/src/core/nacha.js starts with the sync-core header line', /^\/\* Generated by scripts\/sync-core\.js from assets\/js\/nacha\.js\. .*\*\/$/.test(header), header);
    check('the rest of mobile/src/core/nacha.js equals assets/js/nacha.js', mob.slice(nl + 1) === web);
  }
};

L.runParts(parts, { name: 'HOLIDAYS', unit: 'cases', flag: '--case' });
