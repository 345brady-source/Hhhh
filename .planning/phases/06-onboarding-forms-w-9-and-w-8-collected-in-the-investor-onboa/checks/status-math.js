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
function eligibility() {
  const window = { CVPortal: {} };
  vm.runInNewContext(SRC('assets/js/eligibility.js'), { window }, { filename: 'eligibility.js' });
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
    const EXPECT = { 'Rule 506(b)': '506b', 'Rule 506(c)': '506c', 'Regulation A': 'other', 'Regulation Crowdfunding': 'other', 'Regulation S': 'other', 'Section 4(a)(2)': 'other' };
    const offered = consoleExemptions();
    check('the console offers exemption values to test (EXEMPTIONS read from console.js)', offered.length >= 6, offered);
    offered.forEach((v) => check(`regime("${v}") is ${EXPECT[v] || '(no expectation written for this value)'}`, EXPECT[v] !== undefined && E.regime(off('o', v)) === EXPECT[v], E.regime(off('o', v))));
    check('regime of an empty exemption is ""', E.regime(off('o', '')) === '' && E.regime(off('o', '   ')) === '' && E.regime({ id: 'o' }) === '' && E.regime(null) === '');
    check('regime of unknown text is "other"', E.regime(off('o', 'Exempt under some other rule')) === 'other');
    check('regime of a combined reader value "Rule 506(b); Section 3(c)(7)" is 506b', E.regime(off('o', 'Rule 506(b); Section 3(c)(7)')) === '506b');
    check('regime of a combined reader value "Rule 506(c); Section 3(c)(1)" is 506c', E.regime(off('o', 'Rule 506(c); Section 3(c)(1)')) === '506c');
    check('regime of a value naming both 506(b) and 506(c) is 506c (verification wins, as integrations.js reads it)', E.regime(off('o', 'Rule 506(b) and Rule 506(c)')) === '506c');
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
