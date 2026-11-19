// gate: node
// last "DIST RECORD: PASS (cases run: 9)"
// The distribution record (plan 10-01), no browser: assets/js/data.js run in a sandbox with window.CVPortal = {}, on
// workspaces written out here. Every number is worked by hand below and written out in the case.
//   node dist-record.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "DIST RECORD: PASS (cases run: N)" or
// "DIST RECORD: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
//
// Example A. One fund, three holders since 2 January 2025: A-1001 $300,000, A-1002 $200,000, A-1003 $100,000 (together
// $600,000). A distribution of $10,000.00 (1,000,000 cents) dated 15 June 2026:
//   A-1001: 1,000,000 x 300,000 / 600,000 = 500,000.00         -> 500,000 cents
//   A-1002: 1,000,000 x 200,000 / 600,000 = 333,333.33...      -> 333,333, 0.333 left over
//   A-1003: 1,000,000 x 100,000 / 600,000 = 166,666.66...      -> 166,666, 0.667 left over
//   Whole cents add to 999,999; the one cent left goes to the largest remainder, A-1003: 166,667.
//   Stored lines: 500,000 / 333,333 / 166,667 = 1,000,000.
//
// Example B (item A8: a position redeemed in full). Example A's fund with a fourth holder, A-1004, $400,000 since
// 2 January 2025, redeemed in full at the 31 March 2026 dealing date (together $1,000,000 until then, $600,000 after).
//   $10,000.00 dated 16 March 2026 (before the dealing date), over $1,000,000:
//     A-1001 1,000,000 x 300,000 / 1,000,000 = 300,000; A-1002 200,000; A-1003 100,000; A-1004 400,000. Total 1,000,000.
//   $10,000.00 dated 31 March 2026 (the dealing date; the capital leaves at the end of that day): the same four amounts.
//   $10,000.00 dated 15 June 2026 (after it): A-1004 holds nothing and gets no line; the other three are example A's
//     500,000 / 333,333 / 166,667.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

// P10_ROOT: another checkout's folder to load assets/js from (Task 2's verify runs case sample on the base tree with it).
const SRC = (f, root) => fs.readFileSync(path.join(root || process.env.P10_ROOT || L.ROOT, f), 'utf8');
/**
 * A fresh sandbox whose clock stands at noon on `day`, with the given files of assets/js loaded the way the browser
 * loads them. Called inside each case, so a missing function prints a FAIL line for that case and never a bare stack
 * trace. root: another checkout's folder (case sample compares with the base tree).
 */
function load(day, files, root) {
  const window = { CVPortal: {} };
  // timers that never fire: the change log's write-behind (audit.js) is not part of what is checked
  const ctx = vm.createContext({ window, setTimeout: () => 0, clearTimeout: () => {}, TextEncoder, TextDecoder });
  const [y, m, d] = day.split('-').map(Number);
  vm.runInContext(`(function () { const R = Date; const fixed = new R(${y}, ${m - 1}, ${d}, 12, 0, 0).getTime(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } } globalThis.Date = D; })();`, ctx);
  (files || ['data.js']).forEach((f) => vm.runInContext(SRC('assets/js/' + f, root), ctx, { filename: f }));
  return window.CVPortal;
}

const J = (x) => JSON.stringify(x);
const inv = (id, amount, more) => Object.assign({ id, title: `Investor ${id}`, contact: `Person ${id}`, type: 'individual', onboarding: { status: 'complete' }, payment: { method: 'check', bank: null }, positions: [{ offeringId: 'f1', amount, date: '2025-01-02' }] }, more || {});
/** Example A's workspace. */
const wsA = () => ({
  v: 2,
  tenant: { id: 'example', shortName: 'Example' },
  offerings: [{ id: 'f1', name: 'Fund One, L.P.', shortName: 'Fund One', type: 'Private credit', status: 'Active', closeDate: '2025-01-02', distribution: { frequency: 'Quarterly', type: 'Income' } }],
  investors: [inv('A-1001', 300000), inv('A-1002', 200000), inv('A-1003', 100000)],
  runs: [],
  requests: []
});
/** Example B's workspace: example A with A-1004, $400,000, redeemed in full at 31 March 2026. */
const wsB = () => {
  const w = wsA();
  const d = inv('A-1004', 400000);
  d.positions[0].redeemed = '2026-03-31';
  w.investors.push(d);
  return w;
};
const A_LINES = [
  { investorId: 'A-1001', grossCents: 500000, withheld: [], netCents: 500000 },
  { investorId: 'A-1002', grossCents: 333333, withheld: [], netCents: 333333 },
  { investorId: 'A-1003', grossCents: 166667, withheld: [], netCents: 166667 }
];
const BY = 'Dana Reyes (Example admin)';
const JUNE = { offeringId: 'f1', date: '2026-06-15', type: 'Income', total: 1000000, file: '' };
/** fn must throw and leave the workspace's runs as they were; resolves to the message, or '' when it did not throw. */
function refuses(ws, fn) {
  const before = J(ws.runs);
  let msg = '';
  try {
    fn();
  } catch (e) {
    msg = String((e && e.message) || e) || 'threw';
  }
  // a function that does not exist yet is not a refusal
  return { threw: !!msg && !/is not a function|is not defined|Cannot read/.test(msg), msg, unchanged: J(ws.runs) === before };
}
/** A block of checks that reports one FAIL line when the code it needs is missing. */
function block(check, name, fn) {
  try {
    fn();
  } catch (e) {
    check(`${name}: ran to the end`, false, String(e && e.stack ? e.stack : e).split('\n').slice(0, 3).join(' | '));
  }
}
const shares = (D, ws, date) => D.allocate(ws, { id: 'x-' + date, offeringId: 'f1', date, total: 1000000 }).filter((r) => r.cents > 0).map((r) => `${r.investor.id}=${r.cents}`).join(' ');
const gl = (lines) => (lines || []).map((l) => `${l.investorId}=${l.grossCents}/${l.netCents}`).join(' ');
/** A run saved before the record existed: no lines, its status as it was written then. */
const legacy = (id, date, total, status, offeringId) => ({ id, offeringId: offeringId || 'f1', date, type: 'Income', total, status, source: 'history' });
/** Example A's tax withheld from A-1002: $800.00 (80,000 cents) of its 333,333. */
const W800 = { kind: 'backup', cents: 80000, basisCents: 333333, ratePct: null, source: 'entered', why: 'Entered by the sponsor', confirmedBy: BY, confirmedAt: '2026-06-12T15:00:00.000Z' };
const wOf = (cents, more) => Object.assign({}, W800, { cents }, more || {});

// Case sample: the sample firms' figures, as the base tree gives them (A3). Files loaded the way diy.html loads them.
const SAMPLE_FILES = ['tenants.js', 'data.js', 'nacha.js', 'structures.js', 'audit.js', 'operations.js'];
const crypto = require('crypto');
const digest = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
// Item A8 moves one figure of one sample firm, and nothing else: Pellbrook's Long/Short fund, where PBP-1002 redeemed its
// $500,000 in full at the 31 December 2025 dealing date. Its holders today: 16 investors and $8,625,000 at the base,
// 15 and $8,125,000 once a redeemed position is no longer held (the fund has no distribution, so no payment moves).
const A8_NAMED = { 'pellbrook:pb-long-short': { base: '16/8625000/8625000', now: '15/8125000/8125000' } };
// Recorded from the base tree (commit 3234eb5, clock 2026-11-19) by this case; SCRATCH/exec-10-01/sample-base.txt keeps that run.
const SAMPLE_BASE = {
  'kestrel-bay': { engine: '4251bd8c0700df3c', investors: 'd510b1dc547c7f67', next: '0a7e3d2fe0f2e9cb', holders: '5d2668f43918ccab', rows: [220, 23, 3] },
  'ashwell-ridge': { engine: '0339bafbfe0ac60a', investors: '905750294746738d', next: 'e5f68ebf79c27c55', holders: '5a8e43b9c4a6847d', rows: [1879, 24, 3] },
  greywater: { engine: '90890d31f9d4900b', investors: 'b7005c6c771eae0c', next: 'db7c188f5d38493b', holders: 'a30c432b8c41d1d7', rows: [1000, 23, 3] },
  pellbrook: { engine: 'df7a0364c351841c', investors: '10ea600b06e1a4de', next: 'a27764e8b192999e', holders: 'faaa04d5c1d321ee', rows: [14, 24, 6] }
};
function sampleFigures(root) {
  const NS = load('2026-11-19', SAMPLE_FILES, root);
  const out = {};
  NS.TENANTS.filter((t) => t.sample).forEach((t) => {
    NS.clearCaches();
    const ws = NS.ops.ensure(NS.seedWorkspace(t));
    const engine = [];
    const next = [];
    const holders = [];
    const named = {};
    ws.offerings.forEach((o) => {
      NS.audit.period(ws, o, '2000-01-01', '2026-11-19').L.dists.forEach((d) => engine.push([o.id, d.inv.id, d.date, d.cents]));
      next.push([o.id, NS.nextDistribution(ws, o)]);
      const h = NS.data.holdersAt(ws.investors, o.id, '9999-12-31');
      const fig = `${new Set(h.map((x) => x.investor.id)).size}/${h.reduce((a, x) => a + x.amount, 0)}/${NS.data.investedAt(ws.investors, o.id, '2026-11-19')}`;
      if (A8_NAMED[`${t.id}:${o.id}`]) named[`${t.id}:${o.id}`] = fig;
      else holders.push([o.id, fig]);
    });
    const people = ws.investors.map((i) => {
      const v = NS.investorView(ws, i.id);
      return [i.id, v.totals, v.payments.map((p) => [p.date, p.offeringId, p.cents, p.status])];
    });
    out[t.id] = { engine: digest(engine), investors: digest(people), next: digest(next), holders: digest(holders), rows: [engine.length, people.length, next.length], named };
  });
  return out;
}

const cases = {
  store({ check }) {
    // Item A8 first, on what exists today (NS.data.allocate): a position redeemed in full keeps no share afterwards.
    block(check, 'A8', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsB();
      check('A8: $10,000.00 dated 16 March 2026, before the redemption, is shared by all four (300,000 / 200,000 / 100,000 / 400,000)', shares(D, w, '2026-03-16') === 'A-1001=300000 A-1002=200000 A-1003=100000 A-1004=400000', shares(D, w, '2026-03-16'));
      check('A8: dated the dealing date itself, 31 March 2026, the redeemed investor still has its share (400,000)', shares(D, w, '2026-03-31') === 'A-1001=300000 A-1002=200000 A-1003=100000 A-1004=400000', shares(D, w, '2026-03-31'));
      check('A8: $10,000.00 dated 15 June 2026, after the redemption, gives the redeemed investor nothing (500,000 / 333,333 / 166,667)', shares(D, w, '2026-06-15') === 'A-1001=500000 A-1002=333333 A-1003=166667', shares(D, w, '2026-06-15'));
      check('A8: capital invested is $1,000,000 on the dealing date and $600,000 the day after', D.investedAt(w.investors, 'f1', '2026-03-31') === 1000000 && D.investedAt(w.investors, 'f1', '2026-04-01') === 600000, [D.investedAt(w.investors, 'f1', '2026-03-31'), D.investedAt(w.investors, 'f1', '2026-04-01')]);
    });
    block(check, 'A8 stored', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsB();
      const after = D.recordRun(w, JUNE, { by: BY, today: '2026-06-15', id: 'b-june' });
      check('A8: the run recorded after the redemption stores no line for the redeemed investor', J(after.lines) === J(A_LINES), after.lines);
      const before = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-03-16' }), { by: BY, today: '2026-06-15', id: 'b-march' });
      check('A8: the run dated before the redemption stores its line (A-1004 400,000 of 1,000,000)', J(before.lines.map((l) => [l.investorId, l.grossCents])) === J([['A-1001', 300000], ['A-1002', 200000], ['A-1003', 100000], ['A-1004', 400000]]), before.lines);
    });
    // Example A, to the cent.
    block(check, 'example A', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsA();
      const run = D.recordRun(w, JUNE, { by: BY, today: '2026-06-15', id: 'a-june' });
      check('recordRun stores the three lines 500,000 / 333,333 / 166,667, nothing withheld, net equal to gross', J(run.lines) === J(A_LINES), run.lines);
      check('the gross amounts add up to the total, 1,000,000 cents', run.lines.reduce((a, l) => a + l.grossCents, 0) === 1000000 && run.total === 1000000);
      check('the run says its lines were stored when it was recorded, by whom and when', run.linesBasis === 'recorded' && run.linesBy === BY && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(run.linesAt || ''), { basis: run.linesBasis, by: run.linesBy, at: run.linesAt });
      check('the run keeps the keys it had before (id, offering, date, type, total, status, source, file)', J([run.id, run.offeringId, run.date, run.type, run.total, run.status, run.source, run.file]) === J(['a-june', 'f1', '2026-06-15', 'Income', 1000000, 'paid', 'console', '']), run);
      check('the run is in the workspace', w.runs.length === 1 && w.runs[0] === run);
      const read = D.runLines(w, run);
      check('runLines answers the stored lines as they are', read.stored === true && read.basis === 'recorded' && J(read.lines) === J(A_LINES), read);
      const march = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-03-16', gp: 25000, gross: 1025000 }), { by: BY, today: '2026-06-15', id: 'a-march' });
      const sept = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-09-15', file: 'FUND_ONE_20260915_A.ach' }), { by: BY, today: '2026-06-15', id: 'a-sept' });
      check('runs are kept newest first (15 September, 15 June, 16 March)', J(w.runs.map((r) => r.id)) === J(['a-sept', 'a-june', 'a-march']), w.runs.map((r) => r.id));
      check('a run recorded for a later date is written as scheduled, as before, with its file name', sept.status === 'scheduled' && sept.file === 'FUND_ONE_20260915_A.ach', sept);
      check('carried interest paid to the GP and the gross proceeds are kept when given, and absent otherwise', march.gp === 25000 && march.gross === 1025000 && !('gp' in run) && !('gross' in run), [march.gp, march.gross]);
      check('without an id the run gets one that starts with the offering and the date', /^f1-2026-06-15-/.test(D.recordRun(wsA(), JUNE, { by: BY, today: '2026-06-15' }).id));
    });
    // What is refused stores nothing.
    block(check, 'refusals', () => {
      const NS = load('2026-06-15');
      const D = NS.data;
      const w = wsA();
      const opts = { by: BY, today: '2026-06-15' };
      const zero = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { total: 0 }), opts));
      check('a total of 0 is refused and nothing is stored', zero.threw && zero.unchanged && w.runs.length === 0, zero);
      const frac = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { total: 1000000.5 }), opts));
      check('a total that is not a whole number of cents is refused and nothing is stored', frac.threw && frac.unchanged && w.runs.length === 0, frac);
      const text = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { total: '1000000' }), opts));
      check('a total given as text is refused and nothing is stored', text.threw && text.unchanged && w.runs.length === 0, text);
      const early = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { date: '2024-12-31' }), opts));
      check('a date on which nobody holds the offering is refused and nothing is stored', early.threw && early.unchanged && w.runs.length === 0, early);
      const day = refuses(w, () => D.recordRun(w, Object.assign({}, JUNE, { date: '6/15/2026' }), opts));
      check('a date that is not YYYY-MM-DD is refused and nothing is stored', day.threw && day.unchanged && w.runs.length === 0, day);
      const who = refuses(w, () => D.recordRun(w, JUNE, { today: '2026-06-15' }));
      check('a record with nobody named as recording it is refused and nothing is stored', who.threw && who.unchanged && w.runs.length === 0, who);
      // A5: amounts that cannot add up to the total are never stored. A-1002 carries a correcting position of -$300,000:
      // $300,000 + (-$100,000) + $100,000 = $300,000 in all; A-1001 alone would get 1,000,000 x 300,000 / 300,000 =
      // 1,000,000, A-1003 333,333, and A-1002 a negative amount: the positive lines add to 1,333,333, not 1,000,000.
      const bad = wsA();
      bad.investors[1].positions.push({ offeringId: 'f1', amount: -300000, date: '2025-06-02' });
      const sum = refuses(bad, () => D.buildLines(bad, JUNE));
      check('buildLines refuses when its gross amounts do not add up to the total (a negative holding)', sum.threw && /add up/i.test(sum.msg), sum);
      const sum2 = refuses(bad, () => D.recordRun(bad, JUNE, opts));
      check('and recordRun stores nothing in that case', sum2.threw && sum2.unchanged && bad.runs.length === 0, sum2);
      const nan = wsA();
      nan.investors[0].positions[0].amount = NaN;
      const sum3 = refuses(nan, () => D.buildLines(nan, JUNE));
      check('buildLines refuses when a holding is not a number', sum3.threw, sum3);
    });
  },

  sample({ check }) {
    // P10_ROOT: another checkout's folder (Task 2's verify runs this case on the base tree, where it must pass as well).
    const root = process.env.P10_ROOT || '';
    const onBase = !!root;
    let got = null;
    block(check, 'sample figures', () => {
      got = sampleFigures(root || undefined);
    });
    if (!got) return;
    Object.keys(got).forEach((t) => console.log(`INFO sample ${t} engine=${got[t].engine} investors=${got[t].investors} next=${got[t].next} holders=${got[t].holders} rows=${got[t].rows.join('/')}`));
    check('the four sample firms were built', Object.keys(got).length === 4, Object.keys(got));
    if (!SAMPLE_BASE) return check('the base figures are written into this case', false, 'SAMPLE_BASE is not set');
    Object.keys(SAMPLE_BASE).forEach((t) => {
      const g = got[t] || {};
      const b = SAMPLE_BASE[t];
      check(`${t}: the capital accounts' distribution rows are the base's (${b.rows[0]} rows, every fund)`, g.engine === b.engine, { got: g.engine, want: b.engine });
      check(`${t}: every investor's totals and payments (date, fund, cents, status) are the base's`, g.investors === b.investors, { got: g.investors, want: b.investors });
      check(`${t}: the next distribution of every fund is the base's`, g.next === b.next, { got: g.next, want: b.next });
      check(`${t}: holders and capital invested of every fund are the base's (the fund A8 names aside)`, g.holders === b.holders, { got: g.holders, want: b.holders });
    });
    Object.keys(A8_NAMED).forEach((k) => {
      const [t] = k.split(':');
      const want = onBase ? A8_NAMED[k].base : A8_NAMED[k].now;
      check(`A8 names one figure: ${k} holders today are ${want.replace(/\/(\d+)\/\d+$/, ', $$$1')} ${onBase ? '(the base tree)' : '(redeemed position no longer held)'}`, (got[t] && got[t].named[k]) === want, got[t] && got[t].named);
    });
  },

  frozen({ check }) {
    // Example A recorded, then A-1003's position corrected to $200,000 (together $700,000). Worked out again:
    //   A-1001 1,000,000 x 300,000 / 700,000 = 428,571.43; A-1002 x 200,000 / 700,000 = 285,714.29; A-1003 285,714.29.
    //   Whole cents 428,571 + 285,714 + 285,714 = 999,999; the cent goes to the largest remainder, A-1001: 428,572.
    block(check, 'frozen', () => {
      const D = load('2026-11-19').data;
      const w = wsA();
      const run = D.recordRun(w, JUNE, { by: BY, today: '2026-11-19', id: 'a-june' });
      w.runs.push(legacy('old-june', '2026-06-15', 1000000, 'paid'));
      const before = D.runLines(w, w.runs[1]);
      check('before the edit the run saved earlier works out to example A as well', gl(before.lines) === 'A-1001=500000/500000 A-1002=333333/333333 A-1003=166667/166667', gl(before.lines));
      w.investors[2].positions[0].amount = 200000;
      const s = D.runLines(w, run);
      check('after A-1003 becomes $200,000 the stored lines stay 500,000 / 333,333 / 166,667', s.stored === true && s.basis === 'recorded' && J(s.lines) === J(A_LINES), s);
      check('runRows of the stored run give the same cents', D.runRows(w, run).map((r) => `${r.investor.id}=${r.cents}`).join(' ') === 'A-1001=500000 A-1002=333333 A-1003=166667');
      const r = D.runLines(w, w.runs[1]);
      check('the run saved earlier now works out to 428,572 / 285,714 / 285,714, stored false, basis recomputed', r.stored === false && r.basis === 'recomputed' && gl(r.lines) === 'A-1001=428572/428572 A-1002=285714/285714 A-1003=285714/285714', r);
      check('runRows of an investor no longer on the register answer { id, title: id }', (() => {
        const x = JSON.parse(J(run));
        x.lines[0].investorId = 'A-9999';
        const row = D.runRows(w, x)[0];
        return row.investor.id === 'A-9999' && row.investor.title === 'A-9999' && row.cents === 500000;
      })());
    });
  },

  paid({ check }) {
    block(check, 'paid', () => {
      const D = load('2026-11-19').data;
      const T = '2026-11-19';
      check('a run dated yesterday is paid', D.runPaid({ date: '2026-11-18', status: 'paid' }, T) === true);
      check('a run dated today is paid', D.runPaid({ date: '2026-11-19', status: 'scheduled' }, T) === true);
      check('a run dated tomorrow is not paid, whatever its stored status says', D.runPaid({ date: '2026-11-20', status: 'paid' }, T) === false && D.runState({ date: '2026-11-20', status: 'paid' }, T) === 'scheduled');
      check('a run stored as scheduled whose date has passed is paid', D.runPaid({ date: '2026-03-02', status: 'scheduled' }, T) === true && D.runState({ date: '2026-03-02', status: 'scheduled' }, T) === 'paid');
      const c = { date: '2026-03-02', status: 'paid', cancelled: { at: '2026-03-03T10:00:00.000Z', by: BY, why: 'Recorded twice' } };
      check('a cancelled run is neither paid nor scheduled', D.runPaid(c, T) === false && D.runState(c, T) === 'cancelled' && D.runState(Object.assign({}, c, { date: '2027-01-04' }), T) === 'cancelled');
      check('runState gives the three words', [D.runState({ date: '2026-11-18' }, T), D.runState({ date: '2026-11-20' }, T), D.runState(c, T)].join(' ') === 'paid scheduled cancelled');
      check("without a day given, today is the clock's day (19 November 2026)", D.runPaid({ date: '2026-11-19' }) === true && D.runPaid({ date: '2026-11-20' }) === false);
    });
  },

  legacy({ check }) {
    block(check, 'legacy', () => {
      const D = load('2026-11-19').data;
      const AT = '2026-11-19T15:30:00.000Z';
      const w = wsA();
      w.runs.push(legacy('old-june', '2026-06-15', 1000000, 'paid'));
      const run = D.confirmLines(w, 'old-june', { by: BY, at: AT });
      check('confirmLines stores the shares as worked out (500,000 / 333,333 / 166,667), basis confirmed, who and when', J(run.lines) === J(A_LINES) && run.linesBasis === 'confirmed' && run.linesBy === BY && run.linesAt === AT, run);
      const read = D.runLines(w, run);
      check('runLines then answers them as stored, basis confirmed', read.stored === true && read.basis === 'confirmed');
      const again = refuses(w, () => D.confirmLines(w, 'old-june', { by: BY, at: AT }));
      check('a run that already has lines is refused and nothing changes', again.threw && again.unchanged, again);
      const w2 = wsA();
      w2.runs.push(legacy('old-june', '2026-06-15', 1000000, 'paid'));
      const e = D.confirmLines(w2, 'old-june', { by: BY, at: AT, gross: { 'A-1001': 400000, 'A-1002': 400000, 'A-1003': 200000 } });
      check('with entered amounts it stores those (400,000 / 400,000 / 200,000)', gl(e.lines) === 'A-1001=400000/400000 A-1002=400000/400000 A-1003=200000/200000' && e.linesBasis === 'confirmed', e.lines);
      const w3 = wsA();
      w3.runs.push(legacy('old-june', '2026-06-15', 1000000, 'paid'));
      const short = refuses(w3, () => D.confirmLines(w3, 'old-june', { by: BY, at: AT, gross: { 'A-1001': 400000, 'A-1002': 400000, 'A-1003': 199999 } }));
      check('entered amounts that add up to 999,999 and not the total are refused and nothing changes', short.threw && short.unchanged, short);
      const stranger = refuses(w3, () => D.confirmLines(w3, 'old-june', { by: BY, at: AT, gross: { 'A-1001': 400000, 'A-1002': 400000, 'A-9999': 200000 } }));
      check('an investor who is not on the run is refused and nothing changes', stranger.threw && stranger.unchanged, stranger);
      const frac = refuses(w3, () => D.confirmLines(w3, 'old-june', { by: BY, at: AT, gross: { 'A-1001': 400000.5, 'A-1002': 399999.5, 'A-1003': 200000 } }));
      check('amounts that are not whole cents are refused and nothing changes', frac.threw && frac.unchanged, frac);
      const nobody = refuses(w3, () => D.confirmLines(w3, 'old-june', { at: AT }));
      check('nobody named as confirming is refused and nothing changes', nobody.threw && nobody.unchanged, nobody);
      const none = refuses(w3, () => D.confirmLines(w3, 'no-such-run', { by: BY, at: AT }));
      check('a run that does not exist is refused', none.threw && none.unchanged, none);
    });
  },

  withheld({ check }) {
    block(check, 'withheld', () => {
      const D = load('2026-11-19').data;
      const w = wsA();
      const run = D.recordRun(w, Object.assign({}, JUNE, { withheld: { 'A-1002': [W800] } }), { by: BY, today: '2026-11-19', id: 'a-june' });
      // 333,333 - 80,000 = 253,333; nets 500,000 + 253,333 + 166,667 = 920,000; 920,000 + 80,000 = 1,000,000.
      check('with 80,000 withheld from A-1002 the nets are 500,000 / 253,333 / 166,667', gl(run.lines) === 'A-1001=500000/500000 A-1002=333333/253333 A-1003=166667/166667', gl(run.lines));
      check('the nets add to 920,000 and with the 80,000 withheld to the total, 1,000,000', run.lines.reduce((a, l) => a + l.netCents, 0) === 920000 && run.lines.reduce((a, l) => a + l.grossCents, 0) === 1000000);
      check('the withheld entry is stored in the stored shape, as given', J(run.lines[1].withheld) === J([W800]) && run.lines[0].withheld.length === 0, run.lines[1].withheld);
      const all = D.buildLines(wsA(), JUNE, { 'A-1003': [wOf(166667)] });
      check('tax withheld equal to the whole payment leaves a net of 0', gl(all) === 'A-1001=500000/500000 A-1002=333333/333333 A-1003=166667/0', gl(all));
      const opts = { by: BY, today: '2026-11-19' };
      [
        ['an investor with no share (A-1004)', { 'A-1004': [W800] }],
        ['more than the payment (333,334 of 333,333)', { 'A-1002': [wOf(333334)] }],
        ['two entries that together exceed the payment', { 'A-1002': [wOf(200000), wOf(133334, { kind: 'state' })] }],
        ['zero', { 'A-1002': [wOf(0)] }],
        ['a negative amount', { 'A-1002': [wOf(-80000)] }],
        ['a fractional amount', { 'A-1002': [wOf(80000.5)] }],
        ['an unknown kind', { 'A-1002': [wOf(80000, { kind: 'other' })] }]
      ].forEach(([what, held]) => {
        const x = wsA();
        const b = refuses(x, () => D.buildLines(x, JUNE, held));
        const r = refuses(x, () => D.recordRun(x, Object.assign({}, JUNE, { withheld: held }), opts));
        check(`tax withheld of ${what} is refused and nothing is stored`, b.threw && r.threw && r.unchanged && x.runs.length === 0, { b, r });
      });
    });
  },

  cancel({ check }) {
    block(check, 'cancel', () => {
      const NS = load('2026-11-19');
      const D = NS.data;
      const AT = '2026-11-19T16:00:00.000Z';
      // On example A: the schedule and the GP's carried interest answer as if a cancelled run had never been recorded.
      const w = wsA();
      const o = w.offerings[0];
      const nextBefore = J(NS.nextDistribution(w, o));
      const dayBefore = D.paymentDay(w, o);
      const gpBefore = D.gpPaid(w, 'f1');
      const june = D.recordRun(w, Object.assign({}, JUNE, { gp: 25000, gross: 1025000 }), { by: BY, today: '2026-11-19', id: 'a-june' });
      const dec = D.recordRun(w, Object.assign({}, JUNE, { date: '2026-12-15' }), { by: BY, today: '2026-11-19', id: 'a-dec' });
      check('with the two runs recorded the schedule moves (paying on the 15th; next 15 December 2026, scheduled)', D.paymentDay(w, o) === 15 && NS.nextDistribution(w, o).date === '2026-12-15' && NS.nextDistribution(w, o).scheduled === true, NS.nextDistribution(w, o));
      check("the GP's carried interest paid counts the June run's 25,000", D.gpPaid(w, 'f1') === gpBefore + 25000 && D.gpPaid(w, 'f1', '2026-06-14') === gpBefore, [gpBefore, D.gpPaid(w, 'f1')]);
      const c = D.cancelRun(w, 'a-june', { by: BY, at: AT, why: 'Recorded twice' });
      D.cancelRun(w, 'a-dec', { by: BY, at: AT, why: 'Not approved' });
      check('cancelRun marks the run with who, when and why', c === june && J(c.cancelled) === J({ at: AT, by: BY, why: 'Recorded twice' }), c.cancelled);
      check('its lines are kept', J(june.lines) === J(A_LINES) && J(dec.lines) === J(A_LINES));
      check('it is paid nowhere: runPaid false, runState cancelled, no line in paidLines', D.runPaid(june) === false && D.runState(june) === 'cancelled' && D.paidLines(w, { from: '2026-01-01', to: '2026-12-31' }).length === 0);
      const v = NS.investorView(w, 'A-1001');
      check("it is left out of the investor's payments and totals", v.payments.length === 0 && v.totals.received === 0 && v.totals.scheduled === 0, v.payments.map((p) => p.date));
      check("gpPaid drops by the cancelled run's 25,000", D.gpPaid(w, 'f1') === gpBefore);
      check('paymentDay and the next distribution answer as if the runs had never been recorded', D.paymentDay(w, o) === dayBefore && J(NS.nextDistribution(w, o)) === nextBefore, { day: [dayBefore, D.paymentDay(w, o)], next: [nextBefore, J(NS.nextDistribution(w, o))] });
      const twice = refuses(w, () => D.cancelRun(w, 'a-june', { by: BY, at: AT, why: 'Again' }));
      check('a second cancel is refused and changes nothing', twice.threw && twice.unchanged, twice);
      const nowhy = refuses(w, () => D.cancelRun(w, 'a-june-x', { by: BY, at: AT, why: 'x' }));
      check('a run that does not exist is refused', nowhy.threw && nowhy.unchanged);
      const w2 = wsA();
      D.recordRun(w2, JUNE, { by: BY, today: '2026-11-19', id: 'a-june' });
      const blank = refuses(w2, () => D.cancelRun(w2, 'a-june', { by: BY, at: AT, why: ' ' }));
      const anon = refuses(w2, () => D.cancelRun(w2, 'a-june', { at: AT, why: 'Recorded twice' }));
      check('a cancel without a reason, or without a name, is refused and changes nothing', blank.threw && blank.unchanged && anon.threw && anon.unchanged, { blank, anon });
    });
    block(check, 'cancel engine', () => {
      // The capital-account engine on the Kestrel Bay sample: a run recorded and cancelled with no save in between.
      const NS = load('2026-11-19', SAMPLE_FILES);
      const D = NS.data;
      const ws = NS.ops.ensure(NS.seedWorkspace(NS.TENANTS.find((t) => t.id === 'kestrel-bay')));
      const o = ws.offerings.find((x) => x.id === 'kb-fund-ii');
      const mine = () => NS.audit.ledger(ws, o).dists.filter((x) => x.run.id === 'p10-cancel');
      const n0 = NS.audit.ledger(ws, o).dists.length;
      const run = D.recordRun(ws, { offeringId: o.id, date: '2026-11-02', type: 'Income', total: 1000000, file: '' }, { by: BY, today: '2026-11-19', id: 'p10-cancel' });
      const rows = mine();
      check("the engine's rows take the recorded run at once (no save), at the stored amounts", rows.length === run.lines.length && rows.length > 0 && J(rows.map((x) => [x.inv.id, x.cents])) === J(run.lines.map((l) => [l.investorId, l.grossCents])), rows.length);
      D.cancelRun(ws, 'p10-cancel', { by: BY, at: '2026-11-19T16:00:00.000Z', why: 'Recorded twice' });
      check("once it is cancelled the engine's rows leave it out (no save in between)", mine().length === 0 && NS.audit.ledger(ws, o).dists.length === n0, mine().length);
    });
  },

  readers({ check }) {
    block(check, 'readers', () => {
      const NS = load('2026-11-19');
      const D = NS.data;
      const w = wsA();
      w.offerings.push(Object.assign({}, w.offerings[0], { id: 'f2', name: 'Fund Two, L.P.', shortName: 'Fund Two' }));
      w.investors[1].positions.push({ offeringId: 'f2', amount: 50000, date: '2025-01-02' });
      w.investors[2].positions.push({ offeringId: 'f2', amount: 50000, date: '2025-01-02' });
      const opts = { by: BY, today: '2026-11-19' };
      D.recordRun(w, Object.assign({}, JUNE, { withheld: { 'A-1002': [W800] } }), Object.assign({ id: 'a-june' }, opts));
      D.recordRun(w, Object.assign({}, JUNE, { date: '2026-12-15' }), Object.assign({ id: 'a-dec' }, opts));
      D.recordRun(w, Object.assign({}, JUNE, { date: '2026-09-15' }), Object.assign({ id: 'a-sept' }, opts));
      D.cancelRun(w, 'a-sept', { by: BY, at: '2026-11-19T16:00:00.000Z', why: 'Recorded twice' });
      w.runs.push(legacy('old-march', '2026-03-16', 600000, 'scheduled'));
      w.runs.push(legacy('old-2025', '2025-12-15', 600000, 'paid'));
      w.runs.push(legacy('f2-may', '2026-05-15', 100000, 'paid', 'f2'));
      const v = NS.investorView(w, 'A-1002');
      const p = (date) => v.payments.find((x) => x.date === date && x.offeringId === 'f1') || {};
      check('the investor view gives cents, withheldCents and netCents for each payment (June: 333,333 / 80,000 / 253,333, paid)', p('2026-06-15').cents === 333333 && p('2026-06-15').withheldCents === 80000 && p('2026-06-15').netCents === 253333 && p('2026-06-15').status === 'paid', p('2026-06-15'));
      check('a run saved earlier as scheduled whose date has passed is paid (March: 200,000 of 600,000)', p('2026-03-16').cents === 200000 && p('2026-03-16').status === 'paid' && p('2026-03-16').withheldCents === 0 && p('2026-03-16').netCents === 200000, p('2026-03-16'));
      check('a run dated 15 December is scheduled', p('2026-12-15').status === 'scheduled' && p('2026-12-15').cents === 333333);
      check('the cancelled run is left out', !v.payments.some((x) => x.run.id === 'a-sept'));
      check('each payment carries its run, date, fund, type and the three amounts', v.payments.every((x) => x.run && x.date && x.offeringId && x.type && Number.isInteger(x.cents) && Number.isInteger(x.withheldCents) && Number.isInteger(x.netCents)));
      // received: 2025-12-15 200,000 + 2026-03-16 200,000 + 2026-06-15 333,333 + f2 2026-05-15 50,000 = 783,333; ytd 583,333
      check('totals keep their meaning: received and ytd add the gross of paid runs (783,333 and 583,333), scheduled 333,333', v.totals.received === 783333 && v.totals.ytd === 583333 && v.totals.scheduled === 333333, v.totals);
      const o = w.offerings[0];
      const next = NS.nextDistribution(w, o);
      check('the next distribution is the run recorded for 15 December, scheduled', next && next.date === '2026-12-15' && next.scheduled === true, next);
      const w2 = wsA();
      w2.runs.push(legacy('old-oct', '2026-10-15', 600000, 'scheduled'));
      const n2 = NS.nextDistribution(w2, w2.offerings[0]);
      check('a run saved as scheduled whose date has passed counts as paid: the quarter after it, 15 January 2027', n2 && n2.scheduled === false && n2.nominal === '2027-01-15', n2);
      const year = D.paidLines(w, { from: '2026-01-01', to: '2026-12-31' });
      const key = (x) => `${x.run.id}:${x.line.investorId}:${x.line.grossCents}:${x.stored}`;
      check('paidLines for 2026 returns each line of each paid 2026 run once (f2 May, March, June), oldest first, with stored true or false', J(year.map(key)) === J(['old-march:A-1001:300000:false', 'old-march:A-1002:200000:false', 'old-march:A-1003:100000:false', 'f2-may:A-1002:50000:false', 'f2-may:A-1003:50000:false', 'a-june:A-1001:500000:true', 'a-june:A-1002:333333:true', 'a-june:A-1003:166667:true']), year.map(key));
      const byInv = D.paidLines(w, { from: '2026-01-01', to: '2026-12-31', investorId: 'A-1002' });
      check('narrowed by investor (A-1002): March, May, June', J(byInv.map(key)) === J(['old-march:A-1002:200000:false', 'f2-may:A-1002:50000:false', 'a-june:A-1002:333333:true']), byInv.map(key));
      const byOff = D.paidLines(w, { from: '2026-01-01', to: '2026-12-31', offeringId: 'f2' });
      check('narrowed by offering (f2): the May run only', J(byOff.map(key)) === J(['f2-may:A-1002:50000:false', 'f2-may:A-1003:50000:false']), byOff.map(key));
      const later = D.paidLines(w, { from: '2026-01-01', to: '2026-12-31', today: '2026-12-31' });
      check('with today on 31 December the December run is paid as well', later.filter((x) => x.run.id === 'a-dec').length === 3);
    });
    block(check, 'readers engine', () => {
      // The engine counts a console run recorded for a future date once the clock passes that date, and not before.
      const NS = load('2026-11-19', SAMPLE_FILES);
      const ws = NS.ops.ensure(NS.seedWorkspace(NS.TENANTS.find((t) => t.id === 'kestrel-bay')));
      const o = ws.offerings.find((x) => x.id === 'kb-fund-ii');
      NS.data.recordRun(ws, { offeringId: o.id, date: '2026-11-23', type: 'Income', total: 1000000, file: '' }, { by: BY, today: '2026-11-19', id: 'p10-future' });
      const before = NS.audit.ledger(ws, o).dists.filter((x) => x.run.id === 'p10-future').length;
      const NS2 = load('2026-11-24', SAMPLE_FILES);
      const ws2 = JSON.parse(J(ws));
      const o2 = ws2.offerings.find((x) => x.id === 'kb-fund-ii');
      const after = NS2.audit.ledger(ws2, o2).dists.filter((x) => x.run.id === 'p10-future');
      check('a run recorded on 19 November for 23 November is not in the capital accounts on the 19th', before === 0, before);
      check('on 24 November it is, at its stored amounts', after.length > 0 && after.reduce((a, x) => a + x.cents, 0) === 1000000, after.length);
      // A9: a stored line whose investor does not hold the fund is skipped and reported, never a crash.
      const ws3 = JSON.parse(J(ws2));
      const o3 = ws3.offerings.find((x) => x.id === 'kb-fund-ii');
      NS2.data.recordRun(ws3, { offeringId: o3.id, date: '2026-10-15', type: 'Income', total: 1000000, file: '' }, { by: BY, today: '2026-11-24', id: 'p10-stray' });
      ws3.runs.find((x) => x.id === 'p10-stray').lines[0].investorId = 'KBC-9999';
      NS2.clearCaches();
      // the readiness checks read onboarding.js's one tax-form rule, which needs a page; the same rule, as written there
      NS2.inviteFlow = NS2.inviteFlow || { taxOnFile: (i) => !!(i && i.taxForm) && (i.taxCert || {}).signed !== false && (i.taxCert || {}).received !== false };
      let L3 = null;
      let ready = '';
      let err = '';
      try {
        L3 = NS2.audit.ledger(ws3, o3);
        ready = J(NS2.audit.checks(ws3, NS2.audit.period(ws3, o3, '2026-10-01', '2026-10-31'), { verify: NS2.audit.verify(ws3) }).filter((c) => c.status === 'exception'));
      } catch (e) {
        err = String(e && e.message);
      }
      const stray = ws3.runs.find((x) => x.id === 'p10-stray');
      const want = J(stray.lines.slice(1).map((l) => [l.investorId, l.grossCents]));
      const rows = L3 ? J(L3.dists.filter((x) => x.run.id === 'p10-stray').map((x) => [x.inv.id, x.cents])) : '';
      check('A9: a stored line for an investor who does not hold the fund is skipped by the engine, not a crash; the run’s other stored lines are its rows', !!L3 && !err && rows === want, err || { rows: rows.slice(0, 200), want: want.slice(0, 200) });
      check('A9: and it is reported as a readiness exception for that period', /KBC-9999/.test(ready), ready.slice(0, 400));
    });
  },

  selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const u = run(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with FAIL', u.status === 1 && /^DIST RECORD: FAIL \(cases run: 0\)/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty case list exits 1 with FAIL', e.status === 1 && /^DIST RECORD: FAIL \(cases run: 0\)/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
  }
};

L.runParts(cases, { name: 'DIST RECORD', unit: 'cases', flag: '--case', browser: false });
