#!/usr/bin/env node
// Pure checks for phase 6 (no browser): assets/js/eligibility.js run in a sandbox with window.CVPortal = {}, and the
// console's panel titles read from console.js's text.
//   node status-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "STATUS MATH: PASS (cases run: N)" or
// "STATUS MATH: FAIL (cases run: N) - <failed cases>".
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const L = require('./lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
/**
 * eligibility.js in a fresh sandbox. opts.structures: structures.js loaded first (share classes); opts.capital: a stand-in
 * for NS.ops.capital(ws, inv, o, from, to), with the last month end fixed at 2026-10-31 (plan 06-05's value basis).
 */
function eligibility(opts) {
  opts = opts || {};
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window });
  if (opts.structures) vm.runInContext(SRC('assets/js/structures.js'), ctx, { filename: 'structures.js' });
  if (opts.capital) {
    window.CVPortal.ops = { capital: opts.capital };
    window.CVPortal.audit = { lastMonthEnd: () => '2026-10-31' };
    window.CVPortal.dates = { today: () => '2026-11-15' };
  }
  vm.runInContext(SRC('assets/js/eligibility.js'), ctx, { filename: 'eligibility.js' });
  return window.CVPortal.eligibility;
}
const off = (id, exemption) => ({ id, structure: { exemption } });
const sub = (investorId, offeringId, status, qual) => Object.assign({ id: `req-${investorId}-${Math.random().toString(36).slice(2, 7)}`, type: 'subscription', investorId, offeringId, status }, qual === undefined ? {} : { qual });
const na = { regime: '506b', accredited: false };
const ac = { regime: '506b', accredited: true, basis: 'x' };
const same = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());

/** The exemption values the console's offering page offers (EXEMPTIONS in console.js). */
function consoleExemptions() {
  const m = SRC('assets/js/console.js').match(/const EXEMPTIONS = \[([\s\S]*?)\n\s*\];/);
  return m ? Array.from(m[1].matchAll(/\[\s*'([^']+)'\s*,/g)).map((x) => x[1]) : [];
}

const cases = {
  regime({ check }) {
    const E = eligibility();
    check('eligibility.js exports regime, LIMIT_506B, BASES, qualOf, nonAccredited', !!E && typeof E.regime === 'function' && E.LIMIT_506B === 35 && Array.isArray(E.BASES) && typeof E.qualOf === 'function' && typeof E.nonAccredited === 'function', E && Object.keys(E));
    const EXPECT = { 'Rule 506(b)': '506b', 'Rule 506(c)': '506c', 'Regulation A Tier 1': 'regA1', 'Regulation A Tier 2': 'regA2', 'Regulation A Tier 2, exchange-listed': 'regA2listed', 'Regulation Crowdfunding': 'other', 'Regulation S': 'other', 'Section 4(a)(2)': 'other' };
    const offered = consoleExemptions();
    check('the console offers exemption values to test (EXEMPTIONS read from console.js)', offered.length >= 8, offered);
    check('C-04: the console offers the three Regulation A choices and no untiered "Regulation A"', ['Regulation A Tier 1', 'Regulation A Tier 2', 'Regulation A Tier 2, exchange-listed'].every((v) => offered.indexOf(v) >= 0) && offered.indexOf('Regulation A') < 0, offered);
    check('the exchange-listed value fits the 60-character clip the invitation snapshot applies', 'Regulation A Tier 2, exchange-listed'.length <= 60);
    offered.forEach((v) => check(`regime("${v}") is ${EXPECT[v] || '(no expectation written for this value)'}`, EXPECT[v] !== undefined && E.regime(off('o', v)) === EXPECT[v], E.regime(off('o', v))));
    check('regime of an empty exemption is ""', E.regime(off('o', '')) === '' && E.regime(off('o', '   ')) === '' && E.regime({ id: 'o' }) === '' && E.regime(null) === '');
    check('regime of unknown text is "other"', E.regime(off('o', 'Exempt under some other rule')) === 'other');
    check('regime of a combined reader value "Rule 506(b); Section 3(c)(7)" is 506b', E.regime(off('o', 'Rule 506(b); Section 3(c)(7)')) === '506b');
    check('regime of a combined reader value "Rule 506(c); Section 3(c)(1)" is 506c', E.regime(off('o', 'Rule 506(c); Section 3(c)(1)')) === '506c');
    check('regime of a value naming both 506(b) and 506(c) is 506c (verification wins, as integrations.js reads it)', E.regime(off('o', 'Rule 506(b) and Rule 506(c)')) === '506c');
    const RA = { 'Regulation A': 'regA2', 'Regulation A+': 'regA2', 'Regulation A, Tier II': 'regA2', 'Reg A Tier 1': 'regA1', 'Regulation A Tier I': 'regA1', 'Regulation A, Tier 2; listed on a national securities exchange': 'regA2listed', 'regulation a tier 2': 'regA2', 'Regulation ATS': 'other', 'Regulation Crowdfunding': 'other' };
    Object.keys(RA).forEach((v) => check(`regime("${v}") is ${RA[v]}${RA[v] === 'regA2' && !/Tier/i.test(v) ? ' (untiered is treated as Tier 2: C-04)' : ''}`, E.regime(off('o', v)) === RA[v], E.regime(off('o', v))));
    check('twelve Rule 501(a) grounds, none empty, none repeated', E.BASES.length === 12 && E.BASES.every((b) => typeof b === 'string' && b.trim()) && new Set(E.BASES).size === 12);
  },
  qualOf({ check }) {
    const E = eligibility();
    check('qualOf returns the plain object on the request', E.qualOf({ qual: na }) === na);
    check('qualOf is null for no request, no qual, null, a string or an array', E.qualOf(null) === null && E.qualOf({}) === null && E.qualOf({ qual: null }) === null && E.qualOf({ qual: 'yes' }) === null && E.qualOf({ qual: [1] }) === null);
  },
  count({ check }) {
    const E = eligibility();
    const o = off('o1', 'Rule 506(b)');
    const z = E.nonAccredited({ requests: [] }, o);
    check('no requests: nothing counted', z.count === 0 && z.accepted.length === 0 && z.pending.length === 0 && z.unanswered === 0, z);
    check('no requests array at all: nothing counted, no error', E.nonAccredited({}, o).count === 0);
    const r1 = E.nonAccredited({ requests: [sub('a', 'o1', 'rejected', na)] }, o);
    check('a declined subscription is not counted', r1.count === 0 && r1.pending.length === 0 && r1.accepted.length === 0, r1);
    const r2 = E.nonAccredited({ requests: [sub('a', 'o1', 'pending', na), sub('a', 'o1', 'pending', na)] }, o);
    check('one count per investor across two subscriptions', r2.count === 1 && same(r2.pending, ['a']), r2);
    const r3 = E.nonAccredited({ requests: [sub('a', 'o1', 'approved', na), sub('b', 'o1', 'pending', na), sub('c', 'o1', 'funded', na), sub('d', 'o1', 'accepted', na), sub('e', 'o1', 'paid', na)] }, o);
    check('accepted (approved, funded, accepted, paid) versus pending', same(r3.accepted, ['a', 'c', 'd', 'e']) && same(r3.pending, ['b']) && r3.count === 5, r3);
    const r4 = E.nonAccredited({ requests: [sub('a', 'o1', 'approved', na), sub('a', 'o1', 'pending', na)] }, o);
    check('an investor with one accepted and one pending subscription is accepted, once', same(r4.accepted, ['a']) && r4.pending.length === 0 && r4.count === 1, r4);
    const r5 = E.nonAccredited({ requests: [sub('a', 'o1', 'rejected', na), sub('a', 'o1', 'pending', na)] }, o);
    check('declined then subscribed again: pending, once', same(r5.pending, ['a']) && r5.count === 1, r5);
    const r6 = E.nonAccredited({ requests: [sub('a', 'o1', 'pending'), sub('b', 'o1', 'pending', { regime: '506b', accredited: null }), sub('c', 'o1', 'pending', na), sub('d', 'o1', 'pending', ac)] }, o);
    check('unanswered counted apart (no qual, or accredited null); accredited not counted', r6.unanswered === 2 && r6.count === 1 && same(r6.pending, ['c']), r6);
    const r7 = E.nonAccredited({ requests: [sub('a', 'o2', 'pending', na), sub('b', 'o1', 'pending', na), sub('c', 'o2', 'approved', na)] }, o);
    check('other offerings ignored', r7.count === 1 && same(r7.pending, ['b']), r7);
    const r8 = E.nonAccredited({ requests: [{ id: 'x', type: 'redemption', investorId: 'a', offeringId: 'o1', status: 'pending', qual: na }, sub('b', 'o1', 'pending', na)] }, o);
    check('requests that are not subscriptions ignored', r8.count === 1 && same(r8.pending, ['b']), r8);
    const r9 = E.nonAccredited({ requests: [sub('a', 'o1', 'pending', na), sub('a', 'o1', 'pending', ac)] }, o);
    check('the latest answer decides (not accredited, then accredited: not counted)', r9.count === 0, r9);
    const many = [];
    for (let i = 0; i < 36; i++) many.push(sub('p' + i, 'o1', i < 30 ? 'approved' : 'pending', na));
    const r10 = E.nonAccredited({ requests: many }, o);
    check('36 purchasers: 30 accepted, 6 pending, count 36', r10.count === 36 && r10.accepted.length === 30 && r10.pending.length === 6, { count: r10.count, a: r10.accepted.length, p: r10.pending.length });
  },
  flags({ check }) {
    const E = eligibility();
    check('eligibility.js exports place and flags', typeof E.place === 'function' && typeof E.flags === 'function');
    const o = off('o1', 'Rule 506(b)');
    const seq = (n, status) => Array.from({ length: n }, (_, k) => Object.assign(sub('p' + (k + 1), 'o1', status || 'pending', na), { id: 'r' + (k + 1) }));
    const MSG = (n) => `Would be non-accredited purchaser ${n} of the 35 allowed under Rule 506(b)`;
    // 35 counted plus one new.
    let reqs = seq(36);
    let ws = { offerings: [o], requests: reqs };
    check('35 counted plus one new: the 36th request is flagged "36 of the 35"', JSON.stringify(E.flags(ws, reqs[35])) === JSON.stringify([MSG(36)]), E.flags(ws, reqs[35]));
    check('35 counted plus one new: a request within the first 35 is not flagged', E.flags(ws, reqs[0]).length === 0 && E.flags(ws, reqs[34]).length === 0, E.flags(ws, reqs[34]));
    check('place: the 36th investor holds place 36; an investor not yet counted would take place 37', E.place(ws, o, 'p36') === 36 && E.place(ws, o, 'nobody') === 37 && E.place(ws, o, 'p1') === 1);
    // 34 plus one.
    reqs = seq(35);
    ws = { offerings: [o], requests: reqs };
    check('34 counted plus one new: nothing flagged (35 is within the limit)', reqs.every((r) => E.flags(ws, r).length === 0));
    check('34 plus one: a further investor would take place 36', E.place(ws, o, 'nobody') === 36);
    // The 36th declined.
    reqs = seq(36);
    reqs[35].status = 'rejected';
    ws = { offerings: [o], requests: reqs };
    check('the 36th declined: its request is not flagged and the count is 35', E.flags(ws, reqs[35]).length === 0 && E.nonAccredited(ws, o).count === 35);
    // One of the first 35 declined: the 36th moves into place 35.
    reqs = seq(36);
    reqs[3].status = 'rejected';
    ws = { offerings: [o], requests: reqs };
    check('one of the first 35 declined: the 36th is no longer flagged', reqs.every((r) => E.flags(ws, r).length === 0) && E.place(ws, o, 'p36') === 35);
    // Accepted purchasers take their places first.
    reqs = seq(35).concat([Object.assign(sub('late', 'o1', 'approved', na), { id: 'rl' })]);
    ws = { offerings: [o], requests: reqs };
    check('an accepted purchaser who subscribed last takes a place ahead of pending ones; the last pending one is flagged', E.flags(ws, reqs[35]).length === 0 && E.place(ws, o, 'late') === 1 && JSON.stringify(E.flags(ws, reqs[34])) === JSON.stringify([MSG(36)]), { late: E.place(ws, o, 'late'), p35: E.flags(ws, reqs[34]) });
    // A second subscription by a counted investor.
    reqs = seq(35).concat([Object.assign(sub('p2', 'o1', 'pending', na), { id: 'again' })]);
    ws = { offerings: [o], requests: reqs };
    check('a second subscription by a counted investor: count stays 35 and nothing is flagged', E.nonAccredited(ws, o).count === 35 && reqs.every((r) => E.flags(ws, r).length === 0));
    // Requests that are never flagged.
    reqs = seq(36);
    ws = { offerings: [o], requests: reqs.concat([Object.assign(sub('acc', 'o1', 'pending', ac), { id: 'ra' }), Object.assign(sub('none', 'o1', 'pending'), { id: 'rn' })]) };
    check('an accredited request and one without answers are never flagged', E.flags(ws, ws.requests[36]).length === 0 && E.flags(ws, ws.requests[37]).length === 0);
    const o2 = off('o1', 'Rule 506(c)');
    check('no flag when the offering is not Rule 506(b)', E.flags({ offerings: [o2], requests: seq(36) }, seq(36)[35]).length === 0);
    check('no flag for a redemption, a missing request or a missing offering', E.flags(ws, { type: 'redemption', investorId: 'p36', offeringId: 'o1', status: 'pending', qual: na }).length === 0 && E.flags(ws, null).length === 0 && E.flags({ requests: seq(36) }, seq(36)[35]).length === 0);
  },
  /** D-07 (owner, plan 06-11): Regulation A Tier 2 takes the investor's attestation; no figures, no limit worked out. */
  'rega-attest-api'({ check }) {
    const E = eligibility();
    check('eligibility.js exports regAStatus, RA_NOT_ATTESTED and usd', typeof E.regAStatus === 'function' && typeof E.RA_NOT_ATTESTED === 'string' && typeof E.usd === 'function');
    check('no figure or limit arithmetic is left: regALimitCents, committedCents and figure are gone', E.regALimitCents === undefined && E.committedCents === undefined && E.figure === undefined, Object.keys(E));
    check('usd: "$40,000", "$1,234.50", "$0", "$1,000,000"', E.usd(4000000) === '$40,000' && E.usd(123450) === '$1,234.50' && E.usd(0) === '$0' && E.usd(100000000) === '$1,000,000', [E.usd(4000000), E.usd(123450), E.usd(0), E.usd(100000000)]);
  },
  regastatus({ check }) {
    const E = eligibility();
    const o = off('o1', 'Regulation A Tier 2');
    const qa = (attested, extra) => Object.assign({ regime: 'regA2', accredited: false, basis: '' }, attested === undefined ? {} : { regA: { attested } }, extra || {});
    const c = (r, cents) => Object.assign(r, { cents });
    const ws = {
      offerings: [o],
      requests: [
        c(sub('a', 'o1', 'approved', qa(true)), 3000000),
        c(sub('a', 'o1', 'pending', qa(true)), 2000000),
        c(sub('b', 'o1', 'pending', qa(false)), 15000000),
        c(sub('n', 'o1', 'pending', qa(null)), 5000000),
        c(sub('z', 'o1', 'pending', qa(undefined)), 5000000),
        c(sub('old', 'o1', 'pending', qa(undefined, { regA: { kind: 'person', income: 1, limitCents: 10, overLimit: false } })), 5000000),
        c(sub('d', 'o1', 'rejected', qa(false)), 9000000),
        c(sub('acc', 'o1', 'pending', { regime: 'regA2', accredited: true, basis: 'x' }), 99000000),
        c(sub('q', 'o1', 'pending'), 99000000),
        c(sub('x', 'o2', 'pending', qa(false)), 99000000)
      ]
    };
    const s = E.regAStatus(ws, o);
    const row = (id) => s.rows.find((r) => r.investorId === id) || {};
    check('one row per investor who said not accredited (a, b, n, z, old); accredited, unanswered, declined and other offerings left out', same(s.rows.map((r) => r.investorId), ['a', 'b', 'n', 'z', 'old']), s.rows);
    check('a ticked attestation reads attested true; left unticked reads false', row('a').attested === true && row('b').attested === false, s.rows);
    check('no attestation on the answer (null, missing, or an earlier answer with figures) reads null', row('n').attested === null && row('z').attested === null && row('old').attested === null, s.rows);
    check('rows carry no amount and no limit (the portal works none out)', s.rows.every((r) => Object.keys(r).sort().join() === 'attested,investorId'), s.rows);
    check('notAttested counts every row that does not attest (4)', s.notAttested === 4, s);
    ['Regulation A Tier 1', 'Regulation A Tier 2, exchange-listed', 'Rule 506(b)', ''].forEach((ex) => {
      const r = E.regAStatus(Object.assign({}, ws, { offerings: [off('o1', ex)] }), off('o1', ex));
      check(`no rows when the offering is "${ex || 'not set'}" (no limit applies)`, r.rows.length === 0 && r.notAttested === 0, r);
    });
    const u = E.regAStatus(ws, off('o1', 'Regulation A'));
    check('an untiered "Regulation A" offering is worked out as Tier 2', u.rows.length === 5 && u.notAttested === 4, u);
    check('the latest answer decides: an investor who later said accredited has no row', E.regAStatus({ offerings: [o], requests: [c(sub('x', 'o1', 'pending', qa(false)), 100), c(sub('x', 'o1', 'pending', { regime: 'regA2', accredited: true }), 100)] }, o).rows.length === 0);
    check('the latest answer decides: a later attestation replaces an earlier one left unticked', E.regAStatus({ offerings: [o], requests: [c(sub('x', 'o1', 'pending', qa(false)), 100), c(sub('x', 'o1', 'pending', qa(true)), 100)] }, o).rows[0].attested === true);
  },
  /** Verifier warning 1 (plan 06-11): Tier 2 subscribers who left the accredited question unanswered, listed apart. */
  'rega-unanswered'({ check }) {
    const E = eligibility();
    const o = off('o1', 'Regulation A Tier 2');
    const ws = {
      offerings: [o],
      requests: [
        sub('a', 'o1', 'pending', { regime: 'regA2', accredited: false, basis: '', regA: { attested: true } }),
        sub('u1', 'o1', 'pending', { regime: 'regA2', accredited: null, basis: '' }),
        sub('u2', 'o1', 'approved'),
        sub('u3', 'o1', 'pending', { regime: 'regA2', basis: '' }),
        sub('acc', 'o1', 'pending', { regime: 'regA2', accredited: true, basis: 'x' }),
        sub('d', 'o1', 'rejected', { regime: 'regA2', accredited: null }),
        sub('x', 'o2', 'pending', { regime: 'regA2', accredited: null }),
        sub('later', 'o1', 'pending', { regime: 'regA2', accredited: null }),
        sub('later', 'o1', 'pending', { regime: 'regA2', accredited: false, regA: { attested: false } })
      ]
    };
    const s = E.regAStatus(ws, o);
    check('unanswered lists the Tier 2 subscribers with no accredited answer (null, missing, or no answers at all), once each', Array.isArray(s.unanswered) && same(s.unanswered.map((x) => x.investorId), ['u1', 'u2', 'u3']), s.unanswered);
    check('unanswered entries carry the investor only (no amount, no limit)', Array.isArray(s.unanswered) && s.unanswered.every((x) => Object.keys(x).join() === 'investorId'), s.unanswered);
    check('declined subscriptions, other offerings, accredited investors and an investor whose latest answer is "no" are not listed', Array.isArray(s.unanswered) && !s.unanswered.some((x) => ['d', 'x', 'acc', 'later', 'a'].indexOf(x.investorId) >= 0), s.unanswered);
    check('the rows are unchanged: a and later, apart from the unanswered', same(s.rows.map((r) => r.investorId), ['a', 'later']) && s.notAttested === 1, s);
    check('an untiered "Regulation A" offering lists them too', (E.regAStatus(ws, off('o1', 'Regulation A')).unanswered || []).length === 3);
    ['Regulation A Tier 1', 'Regulation A Tier 2, exchange-listed', 'Rule 506(b)'].forEach((ex) => {
      const r = E.regAStatus(ws, off('o1', ex));
      check(`nothing listed when the offering is "${ex}"`, Array.isArray(r.unanswered) && r.unanswered.length === 0, r);
    });
  },
  raflags({ check }) {
    const E = eligibility();
    const o = off('o1', 'Regulation A Tier 2');
    const qa = (attested) => ({ regime: 'regA2', accredited: false, basis: '', regA: { attested } });
    const FLAG = 'Not accredited and has not attested to the Regulation A Tier 2 limit (10 percent of income or net worth)';
    const r1 = Object.assign(sub('a', 'o1', 'pending', qa(false)), { cents: 5000000 });
    const r2 = Object.assign(sub('b', 'o1', 'pending', qa(true)), { cents: 500000000 });
    const r3 = Object.assign(sub('n', 'o1', 'pending', qa(null)), { cents: 5000000 });
    const ws = { offerings: [o], requests: [r1, r2, r3] };
    check(`not attested: the request reads "${FLAG}"`, E.flags(ws, r1).join() === FLAG && E.RA_NOT_ATTESTED === FLAG, E.flags(ws, r1));
    check('attested: no flag, whatever the amount', E.flags(ws, r2).length === 0, E.flags(ws, r2));
    check('no attestation on the answer: flagged', E.flags(ws, r3).join() === FLAG, E.flags(ws, r3));
    const earlier = Object.assign(sub('a', 'o1', 'approved'), { cents: 1000000 });
    const ws2 = { offerings: [o], requests: [earlier, r1] };
    check('each subscription of an investor who has not attested carries the flag', E.flags(ws2, earlier).join() === FLAG && E.flags(ws2, r1).join() === FLAG, [E.flags(ws2, earlier), E.flags(ws2, r1)]);
    const declined = Object.assign({}, r1, { status: 'rejected' });
    check('a declined request is not flagged', E.flags({ offerings: [o], requests: [declined] }, declined).length === 0);
    const acc = Object.assign(sub('c', 'o1', 'pending', { regime: 'regA2', accredited: true, basis: 'x' }), { cents: 5000000 });
    check('an accredited investor is not flagged', E.flags({ offerings: [o], requests: [acc] }, acc).length === 0);
    ['Regulation A Tier 1', 'Regulation A Tier 2, exchange-listed'].forEach((ex) => {
      const ox = off('o1', ex);
      check(`no Regulation A flag under "${ex}"`, E.flags({ offerings: [ox], requests: [r1] }, r1).length === 0);
    });
  },
  holders({ check }) {
    const E = eligibility();
    const o = off('o1', 'Rule 506(b)');
    const inv = (id, offs) => ({ id, positions: offs.map((x) => ({ offeringId: x, amount: 1, date: '2024-01-01' })) });
    const ws = {
      offerings: [o],
      investors: [inv('h1', ['o1']), inv('h2', ['o1', 'o1']), inv('h3', ['o2']), inv('h4', ['o1']), inv('h5', [])],
      requests: [sub('h4', 'o1', 'pending', na), sub('n1', 'o1', 'pending')]
    };
    const r = E.nonAccredited(ws, o);
    check('holders of the offering with no subscription made here are counted as without an answer, once each', r.unanswered === 3 && r.holders === 2 && r.count === 1, r);
    check('a holder of another offering is not counted', E.nonAccredited({ offerings: [o], investors: [inv('x', ['o2'])], requests: [] }, o).unanswered === 0);
  },
  /**
   * D-08 (1) (owner, plan 06-15): the sponsor's benefit plan panel is a plain list of the investors whose latest answer says
   * they are benefit plan investors, with what each has committed (and, apart, what is pending), for the sponsor's own
   * judgment. No per-class percentages, no if-accepted figures, no value basis, no controlling marks.
   */
  'erisa-list'({ check }) {
    const E = eligibility();
    check('eligibility.js exports planInvestors', !!E && typeof E.planInvestors === 'function', E && Object.keys(E));
    if (!E || typeof E.planInvestors !== 'function') return;
    const o = off('o1', 'Rule 506(b)');
    const holder = (id, dollars, erisa) => Object.assign({ id, title: id.toUpperCase(), positions: dollars ? [{ offeringId: 'o1', amount: dollars, date: '2024-01-01' }] : [] }, erisa ? { erisa } : {});
    const q = (erisa) => ({ regime: '506b', accredited: true, basis: 'x', erisa });
    const req = (inv, status, cents, erisa, offeringId) => Object.assign(sub(inv, offeringId || 'o1', status, erisa === undefined ? undefined : q(erisa)), { cents });
    const ws = {
      offerings: [o],
      investors: [holder('h1', 100000, { plan: '4975' }), holder('h2', 200000, { plan: 'none' }), holder('h3'), holder('h4'), holder('h5'), holder('h6'), holder('h7', 100000, { plan: 'title1' }), holder('h8')],
      requests: [
        req('h3', 'pending', 5000000, { plan: 'planAssets', planPct: 40 }),
        req('h4', 'approved', 7500000, { plan: 'title1', planPct: null }),
        req('h5', 'pending', 5000000, { plan: 'other', planPct: null }),
        req('h6', 'rejected', 5000000, { plan: 'title1', planPct: null }),
        req('h7', 'approved', 1000000, { plan: 'none', planPct: null }),
        req('h8', 'pending', 5000000, { plan: 'title1', planPct: null }, 'o2')
      ]
    };
    const rows = E.planInvestors(ws, o);
    const by = (id) => rows.find((x) => x.investorId === id);
    check('the list holds exactly the investors whose latest answer is yes (h1, h3, h4)', Array.isArray(rows) && same(rows.map((x) => x.investorId), ['h1', 'h3', 'h4']), rows);
    check('a holder answering on their record (a section 4975 plan): its commitment on the books, nothing pending', !!by('h1') && by('h1').plan === '4975' && by('h1').cents === 10000000 && by('h1').pendingCents === 0, by('h1'));
    check('an entity holding plan assets: its stated share (40) and its pending subscription apart', !!by('h3') && by('h3').plan === 'planAssets' && by('h3').planPct === 40 && by('h3').cents === 0 && by('h3').pendingCents === 5000000, by('h3'));
    check('an accepted subscription not yet on the books counts as committed', !!by('h4') && by('h4').plan === 'title1' && by('h4').cents === 7500000 && by('h4').pendingCents === 0, by('h4'));
    check('"none", an old "governmental, church or non-U.S. plan" answer, a declined request and another offering are not listed', !by('h2') && !by('h5') && !by('h6') && !by('h8'));
    check('a later "none" on a subscription replaces a "yes" on the record (h7 not listed)', !by('h7'));
    const bad = E.planInvestors({ offerings: [o], investors: [holder('pa')], requests: [req('pa', 'pending', 100, { plan: 'planAssets', planPct: '140' })] }, o);
    check('a plan-asset entity with a share that does not count is still listed (it answered yes), its share null', bad.length === 1 && bad[0].planPct === null, bad);
    check('no request flag from a benefit plan answer (no if-accepted figure)', E.flags(ws, ws.requests[0]).length === 0, E.flags(ws, ws.requests[0]));
    check('the per-class figures are gone: no erisa(), bpiShare, pctText, controllingMarks or BPI_LIMIT', ['erisa', 'bpiShare', 'pctText', 'controllingMarks', 'BPI_LIMIT'].every((k) => E[k] === undefined), Object.keys(E));
    check('an empty workspace gives an empty list, no error', E.planInvestors({}, o).length === 0 && E.planInvestors(null, o).length === 0);
  },
  titles({ check }) {
    const text = SRC('assets/js/console.js');
    const titles = [];
    const re = /\bpanel\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`\s*,)/g;
    let m;
    while ((m = re.exec(text))) titles.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    check('console.js panel titles found to scan', titles.length >= 20, titles.length);
    const bad = titles.filter((t) => L.WORD_RE.test(t));
    check('no panel title in console.js uses the forbidden word (whole word, with -s or -ally)', bad.length === 0, bad);
    check('both offering views headed "Offering details"', titles.filter((t) => t === 'Offering details').length === 2, titles.filter((t) => /Offering details/.test(t)));
    check('the eligibility panel is headed "Investor eligibility"', titles.indexOf('Investor eligibility') >= 0);
    check('the word check matches what it must and nothing else', ['Basic', 'basics', 'BASICALLY', 'a basic step'].every((x) => L.WORD_RE.test(x)) && ['basis', 'basin', 'Basicity'].every((x) => !L.WORD_RE.test(x)));
  },
  gate({ check }) {
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const u = run(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with FAIL', u.status === 1 && /^STATUS MATH: FAIL \(cases run: 0\)/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty case list exits 1 with FAIL', e.status === 1 && /^STATUS MATH: FAIL \(cases run: 0\)/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
    const e2 = run(['--case', ' , ']);
    check('a case list of blanks exits 1 with FAIL', e2.status === 1, { status: e2.status, out: e2.stdout.slice(-300) });
  }
};

L.runParts(cases, { name: 'STATUS MATH', unit: 'cases', flag: '--case', browser: false });
