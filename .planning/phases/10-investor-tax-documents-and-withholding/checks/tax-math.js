// gate: node
// last "TAX MATH: PASS (cases run: 1)"
// The withholding rules (plan 10-05, assets/js/withholding.js), no browser: assets/js/data.js and withholding.js run in
// one sandbox with window.CVPortal = {}, on workspaces written out here. The sandbox clock stands at noon on
// 19 November 2026 in every case and every function is given its own date, so each case gives the same answer on any day.
//   node tax-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "TAX MATH: PASS (cases run: N)" or
// "TAX MATH: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
//
// The rule for "a tax form is on file" is not copied here: each case reads the line that defines taxOnFile out of
// assets/js/onboarding.js by its name, evaluates that text and gives it to the sandbox as NS.inviteFlow.taxOnFile.
//
// Example A (plan 10-01). One fund, three holders since 2 January 2025: A-1001 $300,000, A-1002 $200,000,
// A-1003 $100,000 (together $600,000). $10,000.00 (1,000,000 cents):
//   A-1001: 1,000,000 x 300,000 / 600,000 = 500,000.00     -> 500,000 cents
//   A-1002: 1,000,000 x 200,000 / 600,000 = 333,333.33...  -> 333,333 cents
//   A-1003: 1,000,000 x 100,000 / 600,000 = 166,666.66...  -> 166,666, plus the one cent left over (largest remainder)
//                                                             = 166,667 cents
//   500,000 + 333,333 + 166,667 = 1,000,000.
//
// Example B (the numbers of this check). The fund is set to notes and pays that $10,000.00 of interest on 15 September 2026.
//   A-1001: signed W-9, number ending 4821, certification item 2 not crossed out: no line.
//   A-1002: signed W-9 (number ending 7310) with item 2 crossed out: backup at 24% of 333,333 cents
//           = 333,333 x 24 / 100 = 79,999.92 cents -> 80,000 cents ($800.00).
//   A-1003: foreign individual, W-8BEN signed, valid until 31 December 2028: no backup line.
//   Confirmed (A-1002's line only), the nets are 500,000 / 333,333 - 80,000 = 253,333 / 166,667.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const SRC = (f) => fs.readFileSync(path.join(L.ROOT, f), 'utf8');
const CLOCK = '2026-11-19';
/** The text after "const taxOnFile =" on its own line in onboarding.js, or a thrown error naming what is missing. */
function taxOnFileText() {
  const line = SRC('assets/js/onboarding.js')
    .split('\n')
    .find((l) => /^\s*const taxOnFile = /.test(l));
  if (!line) throw new Error('onboarding.js has no line "const taxOnFile = ..."');
  return line.replace(/^\s*const taxOnFile = /, '').replace(/;\s*$/, '');
}
/**
 * A fresh sandbox with the clock at noon on CLOCK, the given files of assets/js loaded the way the browser loads them, and
 * onboarding.js's own taxOnFile as NS.inviteFlow.taxOnFile. Called inside each case, so a missing function prints a FAIL
 * line for that case and never a bare stack trace.
 */
function load(files) {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, setTimeout: () => 0, clearTimeout: () => {}, TextEncoder, TextDecoder });
  const [y, m, d] = CLOCK.split('-').map(Number);
  vm.runInContext(`(function () { const R = Date; const fixed = new R(${y}, ${m - 1}, ${d}, 12, 0, 0).getTime(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } } globalThis.Date = D; })();`, ctx);
  (files || ['data.js', 'withholding.js']).forEach((f) => vm.runInContext(SRC('assets/js/' + f), ctx, { filename: f }));
  vm.runInContext(`window.CVPortal.inviteFlow = Object.assign(window.CVPortal.inviteFlow || {}, { taxOnFile: ${taxOnFileText()} });`, ctx);
  return window.CVPortal;
}

const J = (x) => JSON.stringify(x);
const BY = 'Dana Reyes (Example admin)';
const AT = '2026-09-10T15:00:00.000Z';
const pos = (amount, offeringId) => [{ offeringId: offeringId || 'f1', amount, date: '2025-01-02' }];
const inv = (id, amount, more) => Object.assign({ id, title: `Investor ${id}`, contact: `Person ${id}`, type: 'individual', onboarding: { status: 'complete' }, payment: { method: 'check', bank: null }, positions: pos(amount) }, more || {});
/** A signed W-9 as the onboarding leaves it (onboarding.js taxSigned): the form, the last four, item 2. */
const w9 = (last4, crossed) => ({ taxType: 'us-individual', taxForm: 'W-9', tinLast4: last4, taxCert: { form: 'W-9', revision: 'March 2024', envelopeId: 'env-w9', at: '2025-01-02T10:00:00.000Z', signed: true, signedBy: 'Signer', tinLast4: last4, backupWithholding: !!crossed } });
/** A signed W-8BEN as the onboarding leaves it: country, the foreign number's last four (or none required), valid until. */
const w8ben = (more) => ({ taxType: 'foreign-individual', taxForm: 'W-8BEN', tinLast4: '', taxCert: Object.assign({ form: 'W-8BEN', revision: 'October 2021', envelopeId: 'env-w8', at: '2025-03-02T10:00:00.000Z', signed: true, signedBy: 'Signer', country: 'Canada', citizenship: 'Canada', ftinLast4: '5521', noFtin: false, treatyCountry: 'Canada', validUntil: '2028-12-31' }, more || {}) });
/** Example B's workspace: example A's fund (not yet set to any reporting type) and the three payees. */
const wsB = () => ({
  v: 2,
  tenant: { id: 'example', shortName: 'Example' },
  offerings: [{ id: 'f1', name: 'Fund One Notes', shortName: 'Fund One', type: 'Private credit', status: 'Active', closeDate: '2025-01-02', distribution: { frequency: 'Quarterly', type: 'Interest' } }],
  investors: [inv('A-1001', 300000, w9('4821', false)), inv('A-1002', 200000, w9('7310', true)), inv('A-1003', 100000, w8ben())],
  runs: [],
  requests: [],
  audit: []
});
const SEPT = { offeringId: 'f1', date: '2026-09-15', type: 'Interest', total: 1000000 };
const nets = (lines) => (lines || []).map((l) => `${l.investorId}=${l.grossCents}/${l.netCents}`).join(' ');
/** fn must throw a refusal (not a missing function) and leave the workspace as it was. */
function refuses(ws, fn) {
  const before = J(ws);
  let msg = '';
  try {
    fn();
  } catch (e) {
    msg = String((e && e.message) || e) || 'threw';
  }
  return { threw: !!msg && !/is not a function|is not defined|Cannot read/.test(msg), msg, unchanged: J(ws) === before };
}

const cases = {
  backup({ check }) {
    const NS = load();
    const W = NS.withholding;
    const ws = wsB();
    const o = ws.offerings[0];
    W.setReporting(ws, 'f1', 'notes', { by: BY, at: AT });
    check('the offering is set to notes by setReporting', W.reporting(o) === 'notes', o.tax);
    const lines = NS.data.buildLines(ws, SEPT);
    check('example A: the stored lines are 500,000 / 333,333 / 166,667', nets(lines) === 'A-1001=500000/500000 A-1002=333333/333333 A-1003=166667/166667', nets(lines));
    const drafts = W.propose(ws, o, lines, { date: '2026-09-15' });
    check('propose returns exactly one draft', Array.isArray(drafts) && drafts.length === 1, drafts);
    const d = drafts[0] || {};
    check('the draft is A-1002, backup, basis 333,333, rate 24, 80,000 cents, source rule, undecided', d.investorId === 'A-1002' && d.kind === 'backup' && d.basisCents === 333333 && d.ratePct === 24 && d.cents === 80000 && d.source === 'rule' && d.decided === '', d);
    check('its reason names the crossed-out certification (item 2 of the W-9)', /item 2/i.test(d.why || '') && /crossed out/i.test(d.why || ''), d.why);
    check('nothing is withheld while it is a draft: toWithheld refuses an unconfirmed draft', refuses(ws, () => W.toWithheld([d])).threw);
    check('nothing is withheld while it is a draft: undecided says so', W.undecided(drafts) === true);
    const w = W.confirm(d, { by: BY, at: AT });
    check('confirm gives a w with who and when, the amount it was worked on, the rate and the reason', w.kind === 'backup' && w.cents === 80000 && w.basisCents === 333333 && w.ratePct === 24 && w.source === 'rule' && w.confirmedBy === BY && w.confirmedAt === AT && w.why === d.why && w.investorId === 'A-1002', w);
    check('once confirmed, nothing is left undecided', W.undecided(drafts) === false, drafts);
    const held = W.toWithheld([w]);
    check('toWithheld keys the confirmed line by investor', J(Object.keys(held)) === J(['A-1002']) && held['A-1002'].length === 1, held);
    const after = NS.data.buildLines(ws, Object.assign({}, SEPT, { withheld: held }), held);
    check('NS.data.buildLines takes it: nets 500,000 / 253,333 / 166,667', nets(after) === 'A-1001=500000/500000 A-1002=333333/253333 A-1003=166667/166667', nets(after));
  }
};

L.runParts(cases, { name: 'TAX MATH', unit: 'cases', flag: '--case', browser: false });
