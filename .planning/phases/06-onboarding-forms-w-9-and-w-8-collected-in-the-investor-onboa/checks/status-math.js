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
