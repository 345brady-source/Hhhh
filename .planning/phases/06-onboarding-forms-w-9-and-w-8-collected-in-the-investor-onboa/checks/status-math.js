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
  /** D-01 (plans 06-04, 06-05): how much of each answer counts as held by benefit plan investors. */
  bpishare({ check }) {
    const E = eligibility();
    const W = { title1: 1, '4975': 1, other: 0, none: 0 };
    Object.keys(W).forEach((k) => check(`bpiShare plan "${k}" is ${W[k]}`, E.bpiShare({ plan: k }) === W[k], E.bpiShare({ plan: k })));
    const PA = [[40, 0.4], ['40', 0.4], ['40%', 0.4], [0, 0], [100, 1], ['12.5', 0.125]];
    PA.forEach(([v, want]) => check(`bpiShare planAssets at ${JSON.stringify(v)} is ${want}`, E.bpiShare({ plan: 'planAssets', planPct: v }) === want, E.bpiShare({ plan: 'planAssets', planPct: v })));
    const BAD = [140, '140', -1, '', '  ', null, undefined, 'abc', true, NaN, Infinity];
    BAD.forEach((v) => check(`T-06-12: bpiShare planAssets at ${String(JSON.stringify(v))} is null (not answered)`, E.bpiShare({ plan: 'planAssets', planPct: v }) === null, E.bpiShare({ plan: 'planAssets', planPct: v })));
    check('bpiShare with no answer, an empty plan or an unknown plan is null', [null, undefined, {}, { plan: '' }, { plan: 'x' }, 'title1'].every((e) => E.bpiShare(e) === null));
  },

  /** D-01, D-30 (plan 06-05): erisa() on workspaces built by hand. */
  erisa({ check }) {
    const E = eligibility({ structures: true });
    const o = (extra) => Object.assign({ id: 'o1', structure: { exemption: 'Rule 506(b)' } }, extra || {});
    const holder = (id, dollars, erisa, extra) => Object.assign({ id, positions: [Object.assign({ offeringId: 'o1', amount: dollars, date: '2024-01-01' }, (extra && extra.pos) || {})] }, erisa === undefined ? {} : { erisa });
    const row = (rows, id) => rows.find((r) => r.classId === (id || '')) || {};
    const near = (a, b) => Math.abs(a - b) < 1e-6;

    // Plan-asset entities.
    let ws = { investors: [holder('pa', 100000, { plan: 'planAssets', planPct: 40 }), holder('n1', 100000, { plan: 'none' })], requests: [] };
    let r = row(E.erisa(ws, o()));
    check('planassets: an entity answering 40 percent counts at 0.4 of its value (20 percent of the class)', near(r.pct, 20) && r.bpiValue === 4000000 && r.total === 20000000, r);
    ['140', '', 140, -5].forEach((bad) => {
      ws = { investors: [holder('pa', 100000, { plan: 'planAssets', planPct: bad }), holder('n1', 100000, { plan: 'none' })], requests: [] };
      r = row(E.erisa(ws, o()));
      check(`planassets: at ${JSON.stringify(bad)} the entity counts as 0 and is listed as not answered`, r.pct === 0 && Array.isArray(r.unanswered) && r.unanswered.length === 1 && r.unanswered[0] === 'pa', r);
    });

    // Unanswered holders.
    ws = { investors: [holder('i1', 100000, { plan: '4975' }), holder('u1', 100000), holder('u2', 200000, { plan: '' }), holder('u3', 100000, { plan: 'none' })], requests: [] };
    r = row(E.erisa(ws, o()));
    check('unanswered: holders with no answers count as 0 (20 percent of the class) and are listed, with their count', near(r.pct, 20) && Array.isArray(r.unanswered) && same(r.unanswered, ['u1', 'u2']), r);
    ws.requests = [Object.assign(sub('u1', 'o1', 'approved'), { cents: 0, qual: { erisa: { plan: 'none', share: 0 } } })];
    r = row(E.erisa(ws, o()));
    check('unanswered: an answer on a subscription to the offering takes the holder off the list', same(r.unanswered || [], ['u2']), r);

    // Several classes.
    const two = [{ id: 'A', name: 'Class A' }, { id: 'B', name: 'Class B' }];
    ws = {
      investors: [holder('a1', 300000, { plan: '4975' }, { pos: { class: 'A' } }), holder('a2', 700000, { plan: 'none' }, { pos: { class: 'A' } }), holder('b1', 400000, { plan: 'none' }, { pos: { class: 'B' } })],
      requests: []
    };
    const before = E.erisa(ws, o({ classes: two }));
    check('classes: two classes give two lines', before.length === 2 && row(before, 'A').name === 'Class A' && row(before, 'B').name === 'Class B' && near(row(before, 'A').pct, 30) && row(before, 'B').pct === 0, before);
    ws.requests = [Object.assign(sub('ira', 'o1', 'pending'), { cents: 40000000, cls: 'B', qual: { erisa: { plan: '4975', share: 1 } } })];
    const pend = E.erisa(ws, o({ classes: two }));
    check('classes: a pending request for Class B gives Class B an if-accepted figure (50 percent) and Class A none', row(pend, 'B').ifAccepted.length === 1 && near(row(pend, 'B').ifAccepted[0].pct, 50) && row(pend, 'A').ifAccepted.length === 0, pend);
    ws.requests[0].status = 'approved';
    const after = E.erisa(ws, o({ classes: two }));
    check('classes: the Class B request, accepted, moves Class B to 50 percent and never changes Class A', near(row(after, 'B').pct, 50) && row(after, 'A').pct === row(before, 'A').pct && row(after, 'A').total === row(before, 'A').total, after);

    // The sponsor's marks and the holder's own answer.
    const ctl = () => ({ investors: [holder('ira', 200000, { plan: '4975' }), holder('gp', 300000, { plan: 'none' }), holder('x', 500000, { plan: 'none' })], requests: [] });
    r = row(E.erisa(ctl(), o({ erisaControlling: ['gp'] })));
    check('marks: a marked holder that is not a benefit plan investor is left out (20 of 70)', near(r.pct, (20 / 70) * 100) && r.disregarded === 30000000, r);
    r = row(E.erisa(ctl(), o({ erisaControlling: ['ira'] })));
    check('marks: a marked benefit plan investor is counted (20 percent)', near(r.pct, 20) && r.disregarded === 0, r);
    const both = ctl();
    both.investors[1].erisa = { plan: 'none', controlling: true };
    r = row(E.erisa(both, o({ erisaControlling: ['gp'] })));
    check('marks: a holder both marked and answering controlling is left out once', near(r.pct, (20 / 70) * 100) && r.disregarded === 30000000 && r.holders.filter((x) => x.investorId === 'gp').length === 1, r);
    r = row(E.erisa(both, o()));
    check('marks: a holder answering controlling is left out without a mark', near(r.pct, (20 / 70) * 100) && r.holders.find((x) => x.investorId === 'gp').own === true, r);
    r = row(E.erisa(ctl(), o({ erisaControlling: ['gp', 'x', 'ira'] })));
    check('marks: a mark on every holder leaves only the plan investor (100 percent)', near(r.pct, 100), r);
    r = row(E.erisa(ctl(), o({ erisaControlling: ['gp', 'x'] , classes: undefined })));
    check('marks: the class total less what is left out is the base', r.total === 100000000 && r.disregarded === 80000000 && near(r.pct, 100), r);
    const allLeft = { investors: [holder('gp', 300000, { plan: 'none' })], requests: [] };
    r = row(E.erisa(allLeft, o({ erisaControlling: ['gp'] })));
    check('marks: nothing left after the controlling holders gives 0 percent, not a division by zero', r.pct === 0 && Number.isFinite(r.pct), r);

    // The value basis.
    const caps = { ira: 25000000, gp: 25000000, x: 50000000 };
    const capE = eligibility({ structures: true, capital: (ws, inv) => (caps[inv.id] != null ? { a: { end: caps[inv.id] } } : null) });
    r = row(capE.erisa(ctl(), o()));
    check('basis: every holder has a capital balance, so capital balances are the basis, named, with the date', r.basis === 'capital' && r.asOf === '2026-10-31' && near(r.pct, 25) && r.total === 100000000, r);
    const noCap = ctl();
    noCap.investors.push(holder('y', 100000, { plan: 'none' }));
    r = row(capE.erisa(noCap, o()));
    check('basis: one holder without a capital balance, so commitments and subscribed amounts are the basis, named', r.basis === 'commitments' && near(r.pct, (200000 / 1100000) * 100), r);
    const appr = ctl();
    appr.requests = [Object.assign(sub('z', 'o1', 'approved'), { cents: 10000000 })];
    r = row(capE.erisa(appr, o()));
    check('basis: an accepted subscription not yet on a position has no capital balance, so commitments are the basis', r.basis === 'commitments' && r.total === 110000000, r);
    r = row(E.erisa(ctl(), o()));
    check('basis: without the capital accounts loaded, commitments are the basis', r.basis === 'commitments' && near(r.pct, 20), r);
    const pendCap = ctl();
    pendCap.requests = [Object.assign(sub('n', 'o1', 'pending'), { cents: 100000000, qual: { erisa: { plan: '4975', share: 1 } } })];
    r = row(capE.erisa(pendCap, o()));
    check('basis: on capital balances, an if-accepted figure uses commitments, the basis once the subscription is accepted (60 percent)', r.basis === 'capital' && near(r.ifAccepted[0].pct, 60), r);

    // A class total of 0.
    r = row(E.erisa({ investors: [], requests: [] }, o()));
    check('a class with no value gives 0 percent', r.pct === 0 && r.total === 0 && Array.isArray(r.unanswered) && r.unanswered.length === 0, r);
    r = row(E.erisa({ investors: [holder('z0', 0, { plan: '4975' })], requests: [] }, o()));
    check('a class whose holders hold 0 gives 0 percent', r.pct === 0, r);
  },
  managed({ check }) {
    // C-03: the managed edition's onboarding is left as it is in phase 6. Each slice runs from its first line to the next
    // line that closes it at the same indent; the recorded hashes are those of plan 06-01's base commit,
    // 414fd9a2b6eb4e423e1a41fed9a21935c724ea47 (sha256 of the slice's lines joined with \n, first 16 hex digits).
    const SLICES = [
      ['assets/js/onboarding.js', '  const LABELS = {', '4fa6f6fc0b8759be', false, '  };'],
      ['assets/js/onboarding.js', '  function stepsFor(mode) {', '0fa03c54b5cc28dd'],
      ['assets/js/onboarding.js', '  function stepAccreditation(verified, opts) {', '73e617b210a0b0dd'],
      ['assets/js/onboarding.js', '  function stepReview() {', '3f94f46405a65dfa'],
      ['assets/js/onboarding.js', '  function validate(step) {', '756467c16d196fc5'],
      ['assets/js/onboarding.js', '  NS.views.onboarding = {', '777c8ec499ced579', false, '  };'],
      ['assets/js/data.js', '  const ACCRED = ', 'c5ec1b6df6b607c1', true]
    ];
    const hashOf = (file, start, single, end) => {
      const lines = SRC(file).split('\n');
      const a = lines.findIndex((l) => l.startsWith(start));
      if (a < 0) return 'missing';
      const z = single ? a : lines.findIndex((l, i) => i > a && l === (end || '  }'));
      if (z < 0) return 'unterminated';
      return require('crypto').createHash('sha256').update(lines.slice(a, z + 1).join('\n')).digest('hex').slice(0, 16);
    };
    SLICES.forEach(([file, start, want, single, end]) => {
      const got = hashOf(file, start, single, end);
      check(`managed edition unchanged: ${path.basename(file)} "${start.trim()}" hashes as at the base commit`, got === want, { got, want });
    });
    check('the slice test notices a change (a copy of stepsFor with one character altered hashes differently)', (() => {
      const lines = SRC('assets/js/onboarding.js').split('\n');
      const a = lines.findIndex((l) => l.startsWith('  function stepsFor(mode) {'));
      const z = lines.findIndex((l, i) => i > a && l === '  }');
      const body = lines.slice(a, z + 1).join('\n');
      const h = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 16);
      return h(body) === '0fa03c54b5cc28dd' && h(body.replace('mode', 'Mode')) !== '0fa03c54b5cc28dd';
    })());
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
