// gate: node
// last "TAX MATH: PASS (cases run: 9)"
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
//   A-1003, foreign: the sponsor enters 166,667 cents as the amount subject to withholding:
//           30% = 166,667 x 30 / 100 = 50,000.1 cents -> 50,000 cents ($500.00).
//           Had the sponsor entered a rate of 10: 166,667 x 10 / 100 = 16,666.7 cents -> 16,667 cents.
//   Both lines confirmed: nets 500,000 / 253,333 / 166,667 - 50,000 = 116,667; 500,000 + 253,333 + 116,667 = 870,000;
//           870,000 + 80,000 + 50,000 = 1,000,000.
//   Variations: A-1001 with no tax form on file: 24% of 500,000 = 500,000 x 24 / 100 = 120,000 cents.
//           A-1001 with an IRS notice recorded and in effect on the payment date: 120,000 cents.
//           The same offering set to partnership or to other, or not set: no backup line for anyone.
//   Rounding: 24% of 25 cents = 6 exactly; 30% of 2 cents = 0.6 -> 1; 30% of 5 cents = 1.5 -> 2 (half a cent up);
//           24% of 2 cents = 0.48 -> 0, so no line is offered; 24% of 3 cents = 0.72 -> 1.
//
// Example C (totals and deposits). The same distribution is paid again on 15 December 2026 with the same confirmed lines.
//   For 2026 (worked on 31 January 2027): backup withheld 80,000 + 80,000 = 160,000; the sponsor marks a deposit of
//   80,000 made on 15 October 2026; not yet deposited 160,000 - 80,000 = 80,000. Foreign withheld 50,000 + 50,000 =
//   100,000; none deposited; not yet deposited 100,000. A-1002's backup for 2026: 160,000.
//   The worksheet for 2026 has one row, A-1003, with two payments of 166,667 and two amounts withheld of 50,000
//   ($1666.67 and $500.00 in the CSV).
//   A run saved before the record existed (15 June 2026, 600,000 cents, no stored lines) works out again to
//   600,000 x 300,000 / 600,000 = 300,000 / 200,000 / 100,000: A-1003's 100,000 ($1000.00) is marked worked out again.
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
/** A block of checks that reports one FAIL line when the code it needs is missing, and lets the case go on. */
function block(check, name, fn) {
  try {
    fn();
  } catch (e) {
    check(`${name}: ran to the end`, false, String(e && e.stack ? e.stack : e).split('\n').slice(0, 3).join(' | '));
  }
}
/** Example B's workspace set to a reporting type (or left unset with ''), A-1001's record replaced by `a1001` when given. */
function setup(NS, key, a1001) {
  const ws = wsB();
  if (a1001) ws.investors[0] = inv('A-1001', 300000, a1001);
  if (key) NS.withholding.setReporting(ws, 'f1', key, { by: BY, at: AT });
  return ws;
}
/** The drafts propose gives on example B's September lines (or on `date`, same shares). */
function drafts(NS, ws, date) {
  const d = date || '2026-09-15';
  return NS.withholding.propose(ws, ws.offerings[0], NS.data.buildLines(ws, Object.assign({}, SEPT, { date: d })), { date: d });
}
const brief = (list) => (list || []).map((d) => `${d.investorId}:${d.kind}:${d.basisCents}x${d.ratePct}=${d.cents}:${d.source}`).join(' ');
/** A record with no tax form at all (invited, never finished the tax step). */
const NOFORM = { taxType: 'us-individual', taxForm: '', tinLast4: '' };
/** Example C, recorded through plan 10-01's recordRun with the confirmed lines; a deposit of 80,000 on 15 October 2026. */
function wsC(NS) {
  const W = NS.withholding;
  const ws = wsB();
  W.setReporting(ws, 'f1', 'notes', { by: BY, at: AT });
  const lines = NS.data.buildLines(ws, SEPT);
  const ds = W.propose(ws, ws.offerings[0], lines, { date: '2026-09-15' });
  const f = W.foreignDraft(lines.find((l) => l.investorId === 'A-1003'), { subjectCents: 166667 });
  const held = W.toWithheld(ds.concat([f]).map((d) => W.confirm(d, { by: BY, at: AT })));
  NS.data.recordRun(ws, Object.assign({}, SEPT, { withheld: held }), { by: BY, today: '2026-09-10', id: 'c-sep' });
  NS.data.recordRun(ws, Object.assign({}, SEPT, { date: '2026-12-15', withheld: held }), { by: BY, today: '2026-12-10', id: 'c-dec' });
  W.addDeposit(ws, { kind: 'backup', year: '2026', cents: 80000, date: '2026-10-15', confirmation: 'EFT-0000000001', by: BY, at: '2026-10-15T16:00:00.000Z' });
  return ws;
}
/** A CSV text read back into rows of cells (cells in double quotes may hold commas, quotes and line breaks). */
function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (q) {
      if (c === '"' && text[k + 1] === '"') {
        cell += '"';
        k++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[k + 1] === '\n') k++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
const HEADER = ['Investor ID', 'Investor', 'Country', 'Form', 'Signed', 'Valid until', 'Foreign tax number', 'Date paid', 'Type', 'Amount paid', 'Tax withheld', 'Kind of tax withheld', 'Amount worked out again'];

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
    const ds = W.propose(ws, o, lines, { date: '2026-09-15' });
    check('propose returns exactly one draft', Array.isArray(ds) && ds.length === 1, ds);
    const d = ds[0] || {};
    check('the draft is A-1002, backup, basis 333,333, rate 24, 80,000 cents, source rule, undecided', d.investorId === 'A-1002' && d.kind === 'backup' && d.basisCents === 333333 && d.ratePct === 24 && d.cents === 80000 && d.source === 'rule' && d.decided === '', d);
    check('its reason names the crossed-out certification (item 2 of the W-9)', /item 2/i.test(d.why || '') && /crossed out/i.test(d.why || ''), d.why);
    check('nothing is withheld while it is a draft: toWithheld refuses an unconfirmed draft', refuses(ws, () => W.toWithheld([d])).threw);
    check('nothing is withheld while it is a draft: undecided says so', W.undecided(ds) === true);
    const w = W.confirm(d, { by: BY, at: AT });
    check('confirm gives a w with who and when, the amount it was worked on, the rate and the reason', w.kind === 'backup' && w.cents === 80000 && w.basisCents === 333333 && w.ratePct === 24 && w.source === 'rule' && w.confirmedBy === BY && w.confirmedAt === AT && w.why === d.why && w.investorId === 'A-1002', w);
    check('once confirmed, nothing is left undecided', W.undecided(ds) === false, ds);
    const held = W.toWithheld([w]);
    check('toWithheld keys the confirmed line by investor', J(Object.keys(held)) === J(['A-1002']) && held['A-1002'].length === 1, held);
    const after = NS.data.buildLines(ws, Object.assign({}, SEPT, { withheld: held }), held);
    check('NS.data.buildLines takes it: nets 500,000 / 253,333 / 166,667', nets(after) === 'A-1001=500000/500000 A-1002=333333/253333 A-1003=166667/166667', nets(after));

    // Each condition alone, with its own reason (Publication 1099 part N; plan-check C4 for the first).
    block(check, 'conditions', () => {
      const one = (a1001, date) => drafts(NS, setup(NS, 'notes', a1001), date).filter((x) => x.investorId === 'A-1001');
      const c1 = one(NOFORM);
      check('condition 1 alone (no tax form on file): A-1001 24% of 500,000 = 120,000', brief(c1) === 'A-1001:backup:500000x24=120000:rule', brief(c1));
      check('its reason: no signed W-9 with a taxpayer number is on file', /no signed W-9 with a taxpayer number/i.test((c1[0] || {}).why || ''), (c1[0] || {}).why);
      const ws3 = setup(NS, 'notes');
      W.addNotice(ws3, 'A-1001', { kind: 'wrong-number', received: '2026-08-03', by: BY, at: AT });
      const c3 = drafts(NS, ws3).filter((x) => x.investorId === 'A-1001');
      check('condition 3 alone (an IRS notice recorded on 2026-08-03, in effect): A-1001 120,000', brief(c3) === 'A-1001:backup:500000x24=120000:rule', brief(c3));
      check('its reason names the IRS notice and the day it arrived', /IRS notice/.test((c3[0] || {}).why || '') && /2026-08-03/.test((c3[0] || {}).why || ''), (c3[0] || {}).why);
      check('condition 2 has its own reason, different from conditions 1 and 3', !!d.why && d.why !== (c1[0] || {}).why && d.why !== (c3[0] || {}).why);
      const ws2 = setup(NS, 'notes');
      W.addNotice(ws2, 'A-1002', { kind: 'underreporting', received: '2026-08-03', by: BY, at: AT });
      const two = drafts(NS, ws2).filter((x) => x.investorId === 'A-1002');
      check('two conditions on one payee (item 2 crossed out and a notice) give one line of 80,000', brief(two) === 'A-1002:backup:333333x24=80000:rule', brief(two));
      check('that one line gives both reasons', /item 2/i.test((two[0] || {}).why || '') && /IRS notice/.test((two[0] || {}).why || ''), (two[0] || {}).why);
      // W2: the notice is tested on the payment date.
      const ended = (end) => {
        const w = setup(NS, 'notes');
        W.addNotice(w, 'A-1001', { kind: 'wrong-number', received: '2026-08-03', by: BY, at: AT });
        W.endNotice(w, 'A-1001', { ended: end, by: BY, at: AT });
        return brief(drafts(NS, w).filter((x) => x.investorId === 'A-1001'));
      };
      check('a notice that ended the day before the payment (2026-09-14) proposes nothing', ended('2026-09-14') === '', ended('2026-09-14'));
      check('a notice that ended on the payment date (2026-09-15) proposes nothing', ended('2026-09-15') === '', ended('2026-09-15'));
      check('a notice that ends the day after (2026-09-16) proposes 24%: 120,000', ended('2026-09-16') === 'A-1001:backup:500000x24=120000:rule', ended('2026-09-16'));
      const late = setup(NS, 'notes');
      W.addNotice(late, 'A-1001', { kind: 'wrong-number', received: '2026-09-16', by: BY, at: AT });
      check('a notice that arrived after the payment date proposes nothing for that payment', brief(drafts(NS, late).filter((x) => x.investorId === 'A-1001')) === '');
      check('addNotice refuses a kind that is not wrong-number or underreporting, and a missing date', refuses(late, () => W.addNotice(late, 'A-1002', { kind: 'letter', received: '2026-08-03', by: BY })).threw && refuses(late, () => W.addNotice(late, 'A-1002', { kind: 'wrong-number', received: '', by: BY })).threw);
      check('endNotice refuses an end before the day the notice arrived', refuses(late, () => W.endNotice(late, 'A-1001', { ended: '2026-09-01', by: BY })).threw);
    });
    block(check, 'rounding', () => {
      check('24% of 25 cents = 6', W.amount(25, 24) === 6, W.amount(25, 24));
      check('30% of 2 cents = 0.6, so 1', W.amount(2, 30) === 1, W.amount(2, 30));
      check('30% of 5 cents = 1.5, so 2 (half a cent up)', W.amount(5, 30) === 2, W.amount(5, 30));
      const ws0 = setup(NS, 'notes', NOFORM);
      const p2 = W.propose(ws0, ws0.offerings[0], [{ investorId: 'A-1001', grossCents: 2, netCents: 2, withheld: [] }], { date: '2026-09-15' });
      const p3 = W.propose(ws0, ws0.offerings[0], [{ investorId: 'A-1001', grossCents: 3, netCents: 3, withheld: [] }], { date: '2026-09-15' });
      check('W3: a 0-cent draft is not offered (24% of 2 cents = 0.48, so 0)', brief(p2) === '', brief(p2));
      check('24% of 3 cents = 0.72, so a line of 1 cent', brief(p3) === 'A-1001:backup:3x24=1:rule', brief(p3));
    });
    // C4: the exact first condition.
    block(check, 'C4', () => {
      const a = (rec) => brief(drafts(NS, setup(NS, 'notes', rec)).filter((x) => x.investorId === 'A-1001'));
      const fw = setup(NS, 'notes', w8ben());
      check('C4: taxOnFile true with a W-8BEN: taxOnFile says on file, no backup line, payee foreign', NS.inviteFlow.taxOnFile(fw.investors[0]) === true && a(w8ben()) === '' && W.payee(fw.investors[0], '2026-09-15') === 'foreign', a(w8ben()));
      const empty = w9('', false);
      check('C4: a signed W-9 with empty last four: 24%, 120,000', a(empty) === 'A-1001:backup:500000x24=120000:rule', a(empty));
      const nosig = w9('4821', false);
      delete nosig.taxCert.signed;
      check('C4: a W-9 with signed missing: taxOnFile still says on file, and 24%, 120,000', NS.inviteFlow.taxOnFile(Object.assign({}, nosig)) === true && a(nosig) === 'A-1001:backup:500000x24=120000:rule', a(nosig));
      const unsigned = w9('4821', false);
      unsigned.taxCert.signed = false;
      check('C4: a W-9 completed without a signature: 24%, 120,000', a(unsigned) === 'A-1001:backup:500000x24=120000:rule', a(unsigned));
      const fallback = w9('4821', false);
      fallback.taxCert.tinLast4 = '';
      check('C4: the last four fall back to the investor record (taxCert empty, record 4821): no line', a(fallback) === '', a(fallback));
      const foreignOnly = w9('', false);
      foreignOnly.taxCert.ftinLast4 = '5521';
      foreignOnly.taxW8 = { ftinLast4: '5521' };
      check('C4: a foreign number is never the last four on record: 24%, 120,000', a(foreignOnly) === 'A-1001:backup:500000x24=120000:rule', a(foreignOnly));
      const up = { taxType: 'us-individual', taxForm: 'W-9', tinLast4: '4821', taxCert: { form: 'W-9', uploaded: true, fileId: 'tax-A-1001-abc', fileName: 'w9.pdf', at: AT } };
      check('C4 as written: an uploaded completed W-9 carries no signed mark, so it does not count: 24%, 120,000', a(up) === 'A-1001:backup:500000x24=120000:rule', a(up));
      const notDigits = w9('48a1', false);
      check('C4: last four that are not four digits do not count: 24%', a(notDigits) === 'A-1001:backup:500000x24=120000:rule', a(notDigits));
      check('corp proposes on the same conditions as notes', brief(drafts(NS, setup(NS, 'corp'))) === 'A-1002:backup:333333x24=80000:rule', brief(drafts(NS, setup(NS, 'corp'))));
    });
  },

  type({ check }) {
    const NS = load(['data.js', 'audit.js', 'withholding.js']);
    const W = NS.withholding;
    const ws = wsB();
    const o = ws.offerings[0];
    check('REPORTING has exactly the four keys partnership, notes, corp, other', J(Object.keys(W.REPORTING)) === J(['partnership', 'notes', 'corp', 'other']), Object.keys(W.REPORTING));
    check('REPORTING form: 1099-int for notes, 1099-div for corp, empty for partnership and other', W.REPORTING.notes.form === '1099-int' && W.REPORTING.corp.form === '1099-div' && W.REPORTING.partnership.form === '' && W.REPORTING.other.form === '');
    check('REPORTING backup: true for notes and corp only', W.REPORTING.notes.backup === true && W.REPORTING.corp.backup === true && W.REPORTING.partnership.backup === false && W.REPORTING.other.backup === false);
    check('reporting is empty until set', W.reporting(o) === '' && W.reporting({}) === '' && W.reporting(null) === '');
    check('a key the module did not set is not read as a type', W.reporting({ tax: { reporting: 'llc' } }) === '');
    ['llc', '', 'Notes', undefined, 'constructor', 'toString'].forEach((k) => {
      const r = refuses(ws, () => W.setReporting(ws, 'f1', k, { by: BY, at: AT }));
      check(`setReporting refuses ${J(k)} and changes nothing`, r.threw && r.unchanged, r);
    });
    check('setReporting refuses without the name of the person', refuses(ws, () => W.setReporting(ws, 'f1', 'notes', { at: AT })).threw);
    check('setReporting refuses an offering that does not exist', refuses(ws, () => W.setReporting(ws, 'nope', 'notes', { by: BY, at: AT })).threw);
    const before = ws.audit.length;
    o.tax = { payer: { einLast4: '0001' } };
    W.setReporting(ws, 'f1', 'corp', { by: BY, at: AT });
    check('setReporting records the key, who and when', o.tax.reporting === 'corp' && o.tax.setBy === BY && o.tax.setAt === AT, o.tax);
    check('and keeps the keys other plans put beside them', !!o.tax.payer && o.tax.payer.einLast4 === '0001', o.tax);
    check('and writes one change-log entry naming the type', ws.audit.length === before + 1 && /Corporation or REIT/.test((ws.audit[ws.audit.length - 1] || {}).detail || ''), ws.audit.slice(-1));
    check('reporting reads it back', W.reporting(o) === 'corp');
  },

  never({ check }) {
    const NS = load();
    const W = NS.withholding;
    // the same payees in every variation: A-1001 with no tax form, A-1002 item 2 crossed out, A-1003 a valid W-8BEN, and a notice on A-1001
    const variant = (key) => {
      const ws = setup(NS, key, NOFORM);
      W.addNotice(ws, 'A-1001', { kind: 'underreporting', received: '2026-08-03', by: BY, at: AT });
      return ws;
    };
    check('under notes these payees draw lines (the conditions are live): A-1001 120,000 and A-1002 80,000', brief(drafts(NS, variant('notes'))) === 'A-1001:backup:500000x24=120000:rule A-1002:backup:333333x24=80000:rule', brief(drafts(NS, variant('notes'))));
    [['', 'not set'], ['partnership', 'set to partnership'], ['other', 'set to other']].forEach(([k, label]) => {
      check(`an offering ${label} gets no backup draft for anyone`, brief(drafts(NS, variant(k))) === '', brief(drafts(NS, variant(k))));
    });
    const ira = setup(NS, 'notes', Object.assign({}, NOFORM, { type: 'ira', taxType: 'us-entity' }));
    check('an IRA with no tax form gets none under notes, and is payee ira', brief(drafts(NS, ira).filter((x) => x.investorId === 'A-1001')) === '' && W.payee(ira.investors[0], '2026-09-15') === 'ira');
    const ex = setup(NS, 'notes', NOFORM);
    W.markExempt(ex, 'A-1001', { by: BY, at: AT });
    check('a payee the sponsor marked exempt gets none under notes, and is payee exempt', brief(drafts(NS, ex).filter((x) => x.investorId === 'A-1001')) === '' && W.payee(ex.investors[0], '2026-09-15') === 'exempt' && ex.investors[0].exempt1099.by === BY);
    check('markExempt refuses without the name of the person', refuses(ex, () => W.markExempt(ex, 'A-1002', {})).threw);
    W.unmarkExempt(ex, 'A-1001');
    check('once the mark is taken off, the line comes back: 120,000', brief(drafts(NS, ex).filter((x) => x.investorId === 'A-1001')) === 'A-1001:backup:500000x24=120000:rule');
    check('a payee with a valid W-8 gets none under notes', brief(drafts(NS, setup(NS, 'notes')).filter((x) => x.investorId === 'A-1003')) === '');
    // no stop kind is ever proposed by rule
    const all = [];
    ['notes', 'corp', 'partnership', 'other', ''].forEach((k) => all.push(...drafts(NS, variant(k))));
    check('propose only ever returns backup lines', all.length > 0 && all.every((x) => x.kind === 'backup'), brief(all));
    const line = NS.data.buildLines(variant('notes'), SEPT).find((l) => l.investorId === 'A-1003');
    const f = W.foreignDraft(line, { subjectCents: 166667 });
    check('foreignDraft only gives kind foreign', f.kind === 'foreign');
    ['partnership', 'real-property', 'fatca', 'state'].forEach((k) => {
      const e = W.enteredDraft(k, { investorId: 'A-1003', grossCents: 166667, cents: 1000, basisCents: 166667, why: 'Figure from the CPA', source: 'rule', ratePct: 30 });
      check(`enteredDraft(${k}) is source entered with no rate, even when asked for rule and a rate`, e.kind === k && e.source === 'entered' && e.ratePct === null, e);
    });
    check('enteredDraft refuses backup and foreign (they have their own rules)', ['backup', 'foreign', 'nope'].every((k) => refuses({}, () => W.enteredDraft(k, { investorId: 'A-1003', grossCents: 166667, cents: 1000, basisCents: 166667, why: 'x' })).threw));
    const dd = drafts(NS, variant('notes'));
    W.remove(dd[0], { by: BY, at: AT });
    check('a removed draft cannot be confirmed', dd[0].decided === 'removed' && refuses({}, () => W.confirm(dd[0], { by: BY, at: AT })).threw);
    check('confirm needs the name of the person', refuses({}, () => W.confirm(dd[1], {})).threw && dd[1].decided === '');
    check('a draft passed to toWithheld as if confirmed, without who and when, is refused', refuses({}, () => W.toWithheld([Object.assign({}, dd[1], { decided: 'confirmed' })])).threw);
  },

  w8({ check }) {
    const NS = load();
    const W = NS.withholding;
    const ben = inv('A-1003', 100000, w8ben());
    const on = W.w8(ben, '2028-12-31');
    check('a signed W-8BEN valid until 2028-12-31 is valid with no flag on 2028-12-31', on.foreign === true && on.form === 'W-8BEN' && on.signed === true && on.validUntil === '2028-12-31' && on.valid === true && J(on.flags) === '[]' && on.ftin === 'on file', on);
    const off = W.w8(ben, '2029-01-01');
    check('and expired on 2029-01-01', off.valid === false && J(off.flags) === J(['expired']), off);
    const uns = inv('A-1003', 100000, w8ben({ signed: false, validUntil: '' }));
    const u = W.w8(uns, '2026-09-15');
    check('an unsigned W-8BEN is flagged not signed and is not valid', u.signed === false && u.valid === false && u.flags.indexOf('not signed') >= 0, u);
    const noNum = W.w8(inv('A-1003', 100000, w8ben({ ftinLast4: '', noFtin: false })), '2026-09-15');
    check('one with no foreign tax number and no box ticked is flagged no foreign tax number', noNum.ftin === '' && J(noNum.flags) === J(['no foreign tax number']), noNum);
    const box = W.w8(inv('A-1003', 100000, w8ben({ ftinLast4: '', noFtin: true })), '2026-09-15');
    check('the box saying none is legally required: no flag, ftin not required', box.ftin === 'not required' && J(box.flags) === '[]' && box.valid === true, box);
    const e = inv('A-1004', 100000, { taxType: 'foreign-entity', taxForm: 'W-8BEN-E', taxCert: { form: 'W-8BEN-E', revision: 'October 2021', envelopeId: 'env-e', at: '2025-03-02T10:00:00.000Z', signed: true, signedBy: 'Signer', chapter3: 'Corporation', chapter4: 'Active NFFE', country: 'Germany', ftinLast4: '7788', noFtin: false, validUntil: '2028-12-31' } });
    const ee = W.w8(e, '2028-12-31');
    const ee2 = W.w8(e, '2029-01-01');
    check('a W-8BEN-E gives the same facts', ee.foreign && ee.form === 'W-8BEN-E' && ee.signed && ee.validUntil === '2028-12-31' && ee.valid && ee.ftin === 'on file' && J(ee.flags) === '[]' && !ee2.valid && J(ee2.flags) === J(['expired']), [ee, ee2]);
    const us = W.w8(inv('A-1001', 300000, w9('4821', false)), '2026-09-15');
    check('a U.S. investor answers foreign false', us.foreign === false && us.valid === false && J(us.flags) === '[]', us);
    const none = W.w8(inv('A-1005', 1, { taxType: 'foreign-individual', taxForm: '', tinLast4: '' }), '2026-09-15');
    check('a foreign investor with no form is foreign, not valid, and flagged not signed', none.foreign === true && none.valid === false && none.flags.indexOf('not signed') >= 0, none);
    check('payee: a valid W-8 is foreign; the same W-8 expired is undocumented', W.payee(ben, '2028-12-31') === 'foreign' && W.payee(ben, '2029-01-01') === 'undocumented');
  },

  foreign({ check }) {
    const NS = load();
    const W = NS.withholding;
    const ws = setup(NS, 'notes');
    const lines = NS.data.buildLines(ws, SEPT);
    const line = lines.find((l) => l.investorId === 'A-1003');
    const f = W.foreignDraft(line, { subjectCents: 166667 });
    check('foreignDraft on A-1003 with 166,667: 30% = 50,000.1, so 50,000, source rule', f.investorId === 'A-1003' && f.kind === 'foreign' && f.basisCents === 166667 && f.ratePct === 30 && f.cents === 50000 && f.source === 'rule' && f.decided === '', f);
    const t = W.foreignDraft(line, { subjectCents: 166667, ratePct: 10 });
    check('with an entered rate of 10: 16,666.7, so 16,667, source entered', t.ratePct === 10 && t.cents === 16667 && t.source === 'entered', t);
    check('an entered rate of 30 is the rule, not a figure entered', W.foreignDraft(line, { subjectCents: 166667, ratePct: 30 }).source === 'rule');
    const bad = [
      ['an amount above the line’s gross (166,668)', { subjectCents: 166668 }],
      ['a rate above 100', { subjectCents: 166667, ratePct: 101 }],
      ['a rate below 0', { subjectCents: 166667, ratePct: -1 }],
      ['W3: an amount below 2 cents (1)', { subjectCents: 1 }],
      ['an amount of 0', { subjectCents: 0 }],
      ['an amount that is not whole (100.5)', { subjectCents: 100.5 }],
      ['an entered rate that gives 0 cents (0%)', { subjectCents: 166667, ratePct: 0 }],
      ['an entered rate that gives 0 cents (10% of 2 cents)', { subjectCents: 2, ratePct: 10 }]
    ];
    bad.forEach(([label, o]) => check(`foreignDraft refuses ${label}`, refuses({}, () => W.foreignDraft(line, o)).threw));
    check('W3: 30% of 2 cents is 1 cent and is offered', W.foreignDraft(line, { subjectCents: 2 }).cents === 1);
    // W3: every confirmed w passes through NS.data.buildLines with no error.
    const wsB2 = setup(NS, 'notes');
    const L2 = NS.data.buildLines(wsB2, SEPT);
    const back = W.propose(wsB2, wsB2.offerings[0], L2, { date: '2026-09-15' });
    const all = back.concat([W.foreignDraft(L2.find((l) => l.investorId === 'A-1003'), { subjectCents: 166667 })]).map((x) => W.confirm(x, { by: BY, at: AT }));
    let got = null;
    let err = '';
    try {
      got = NS.data.buildLines(wsB2, SEPT, W.toWithheld(all));
    } catch (e) {
      err = String(e && e.message);
    }
    check('both confirmed lines pass through NS.data.buildLines: nets 500,000 / 253,333 / 116,667', !err && nets(got) === 'A-1001=500000/500000 A-1002=333333/253333 A-1003=166667/116667', err || nets(got));
    const sum = (got || []).reduce((a, l) => a + l.netCents, 0);
    check('870,000 paid + 80,000 + 50,000 withheld = 1,000,000', sum === 870000 && sum + 80000 + 50000 === 1000000, sum);
    ['partnership', 'real-property', 'fatca', 'state'].forEach((k) => {
      let e2 = '';
      try {
        NS.data.buildLines(wsB2, SEPT, W.toWithheld([W.confirm(W.enteredDraft(k, { line: L2[2], cents: 1000, basisCents: 166667, why: 'Figure from the CPA' }), { by: BY, at: AT })]));
      } catch (e) {
        e2 = String(e && e.message);
      }
      check(`a confirmed entered ${k} line passes through NS.data.buildLines`, !e2, e2);
    });
    // a foreign investor whose W-8 expired is not documented: the first backup condition, saying the W-8 expired and when
    const exp = setup(NS, 'notes');
    const late = drafts(NS, exp, '2029-03-15').filter((x) => x.investorId === 'A-1003');
    check('A-1003 with the W-8BEN expired (valid until 2028-12-31), paid 2029-03-15: backup 24% of 166,667 = 40,000.08, so 40,000', brief(late) === 'A-1003:backup:166667x24=40000:rule', brief(late));
    check('its reason says the W-8 expired and on what date', /expired/i.test((late[0] || {}).why || '') && /2028-12-31/.test((late[0] || {}).why || ''), (late[0] || {}).why);
    const uw = setup(NS, 'notes', null);
    uw.investors[2] = inv('A-1003', 100000, w8ben({ signed: false, validUntil: '' }));
    const un = drafts(NS, uw).filter((x) => x.investorId === 'A-1003');
    check('A-1003 with an unsigned W-8BEN: backup 24% of 166,667 = 40,000, reason says not signed', brief(un) === 'A-1003:backup:166667x24=40000:rule' && /not signed/i.test((un[0] || {}).why || ''), un);
  },

  stops({ check }) {
    const NS = load();
    const W = NS.withholding;
    const stopKinds = ['partnership', 'real-property', 'fatca', 'state'];
    check('KINDS holds backup and foreign as rules and the four stop kinds', J(Object.keys(W.KINDS).sort()) === J(['backup', 'fatca', 'foreign', 'partnership', 'real-property', 'state']) && W.KINDS.backup.rule === true && W.KINDS.foreign.rule === true, Object.keys(W.KINDS));
    stopKinds.forEach((k) => check(`KINDS ${k} carries a label and a stop sentence, and is no rule`, !!W.KINDS[k].label && typeof W.KINDS[k].stop === 'string' && W.KINDS[k].stop.length > 20 && !W.KINDS[k].rule, W.KINDS[k]));
    const keys = ['us-source', 'portfolio-interest', 'treaty', 'partnership', 'real-property', 'fatca', 'state', 'irs-notice'];
    check('STOPS has the eight keys', J(Object.keys(W.STOPS).sort()) === J(keys.slice().sort()), Object.keys(W.STOPS));
    keys.forEach((k) => {
      const s = String(W.STOPS[k] || '');
      const one = /^[A-Z][^]*\.$/.test(s) && !/[.!?]\s/.test(s.slice(0, -1)) && (s.match(/[.!?]/g) || []).length === 1;
      check(`STOPS ${k} is one sentence, names the CPA, holds no rate and no figure`, one && /\bCPA\b/.test(s) && !/\d|%|percent/i.test(s), s);
    });
    stopKinds.forEach((k) => check(`KINDS ${k}'s stop is the STOPS sentence`, W.KINDS[k].stop === W.STOPS[k]));
    stopKinds.forEach((k) => {
      const ok = W.enteredDraft(k, { investorId: 'A-1003', grossCents: 166667, cents: 1000, basisCents: 166667, why: 'Figure from the CPA' });
      check(`enteredDraft(${k}) has source entered, no rate, the amount and the reason`, ok.kind === k && ok.source === 'entered' && ok.ratePct === null && ok.cents === 1000 && ok.basisCents === 166667 && ok.why === 'Figure from the CPA' && ok.decided === '', ok);
      const refusals = [
        ['an amount of 0', { cents: 0 }],
        ['a negative amount', { cents: -5 }],
        ['an amount that is not whole', { cents: 10.5 }],
        ['no reason', { why: '  ' }],
        ['W3: a basis of 0', { basisCents: 0 }],
        ['W3: a basis that is not whole', { basisCents: 1000.5 }],
        ['W3: a basis above the line’s gross', { basisCents: 166668 }],
        ['an amount above its basis', { cents: 2000, basisCents: 1500 }],
        ['no investor', { investorId: '' }],
        ['no gross to hold the basis to', { grossCents: undefined }]
      ];
      refusals.forEach(([label, o]) => check(`enteredDraft(${k}) refuses ${label}`, refuses({}, () => W.enteredDraft(k, Object.assign({ investorId: 'A-1003', grossCents: 166667, cents: 1000, basisCents: 166667, why: 'Figure from the CPA' }, o))).threw));
    });
    check('enteredDraft takes the line itself for the investor and the gross', W.enteredDraft('state', { line: { investorId: 'A-1003', grossCents: 166667 }, cents: 1000, basisCents: 166667, why: 'Figure from the CPA' }).investorId === 'A-1003');
  },

  totals({ check }) {
    const NS = load();
    const W = NS.withholding;
    const ws = wsC(NS);
    const T = W.totals(ws, { offeringId: 'f1', year: '2026', today: '2027-01-31' });
    const b = T.backup || {};
    const f = T.foreign || {};
    check('example C backup for 2026: 160,000 withheld, 80,000 deposited, 80,000 not yet deposited', b.withheldCents === 160000 && b.depositedCents === 80000 && b.undepositedCents === 80000, b);
    check('example C foreign for 2026: 100,000 withheld, 0 deposited, 100,000 not yet deposited', f.withheldCents === 100000 && f.depositedCents === 0 && f.undepositedCents === 100000, f);
    check('backup items: A-1002 80,000 on 2026-09-15 and on 2026-12-15, from stored lines', J((b.items || []).map((x) => [x.runId, x.date, x.investorId, x.cents, x.recomputed])) === J([['c-sep', '2026-09-15', 'A-1002', 80000, false], ['c-dec', '2026-12-15', 'A-1002', 80000, false]]), b.items);
    check('every kind of the record is in totals, the stop kinds at 0', ['partnership', 'real-property', 'fatca', 'state'].every((k) => T[k] && T[k].withheldCents === 0 && T[k].undepositedCents === 0), Object.keys(T));
    check('withheldFor A-1002, 2026, backup = 160,000', W.withheldFor(ws, { investorId: 'A-1002', offeringId: 'f1', year: '2026', kind: 'backup', today: '2027-01-31' }) === 160000);
    check('withheldFor A-1003, 2026, foreign = 100,000; A-1001 = 0', W.withheldFor(ws, { investorId: 'A-1003', offeringId: 'f1', year: '2026', kind: 'foreign', today: '2027-01-31' }) === 100000 && W.withheldFor(ws, { investorId: 'A-1001', offeringId: 'f1', year: '2026', kind: 'backup', today: '2027-01-31' }) === 0);
    check('W2: on 2026-12-01 (the December run not yet paid), backup for 2026 is 80,000', W.totals(ws, { offeringId: 'f1', year: '2026', today: '2026-12-01' }).backup.withheldCents === 80000);
    // a 2027 run, a cancelled run and a run whose date has not arrived add nothing to 2026
    const ws2 = wsC(NS);
    const held = { 'A-1002': [{ kind: 'backup', cents: 80000, basisCents: 333333, ratePct: 24, source: 'rule', why: 'x', confirmedBy: BY, confirmedAt: AT }] };
    NS.data.recordRun(ws2, Object.assign({}, SEPT, { date: '2027-01-15', withheld: held }), { by: BY, today: '2027-01-10', id: 'c-jan' });
    NS.data.recordRun(ws2, Object.assign({}, SEPT, { date: '2026-11-16', withheld: held }), { by: BY, today: '2026-11-10', id: 'c-cancel' });
    NS.data.cancelRun(ws2, 'c-cancel', { by: BY, why: 'Recorded twice' });
    NS.data.recordRun(ws2, Object.assign({}, SEPT, { date: '2026-12-28', withheld: held }), { by: BY, today: '2026-12-10', id: 'c-late' });
    const T2 = W.totals(ws2, { offeringId: 'f1', year: '2026', today: '2026-12-20' });
    check('a 2027 run, a cancelled run and a run dated 2026-12-28 not yet arrived on 2026-12-20 add nothing: backup 160,000', T2.backup.withheldCents === 160000, T2.backup);
    check('the 2027 run counts for 2027 once paid: 80,000', W.totals(ws2, { offeringId: 'f1', year: '2027', today: '2027-01-31' }).backup.withheldCents === 80000);
    check('another offering’s totals are empty', W.totals(ws, { offeringId: 'f2', year: '2026', today: '2027-01-31' }).backup.withheldCents === 0);
    // deposits
    const dep = ws.taxDeposits || [];
    check('the deposit is stored with kind, year, cents, date, confirmation number, who and when', dep.length === 1 && dep[0].kind === 'backup' && dep[0].year === '2026' && dep[0].cents === 80000 && dep[0].date === '2026-10-15' && dep[0].confirmation === 'EFT-0000000001' && dep[0].by === BY && !!dep[0].at && !!dep[0].id, dep);
    const good = { kind: 'foreign', year: '2026', cents: 50000, date: '2026-12-20', confirmation: 'EFT-0000000002', by: BY, at: AT };
    [
      ['an amount of 0', { cents: 0 }],
      ['a negative amount', { cents: -100 }],
      ['an amount that is not whole', { cents: 100.5 }],
      ['an amount given as text', { cents: '50000' }],
      ['a missing date', { date: '' }],
      ['a date not written YYYY-MM-DD', { date: '20/12/2026' }],
      ['a missing confirmation number', { confirmation: ' ' }],
      ['a kind that is not one of the record', { kind: 'other' }],
      ['a year not written YYYY', { year: '26' }],
      ['no name of the person', { by: '' }]
    ].forEach(([label, o]) => {
      const r = refuses(ws, () => W.addDeposit(ws, Object.assign({}, good, o)));
      check(`addDeposit refuses ${label} and stores nothing`, r.threw && r.unchanged, r.msg);
    });
    W.addDeposit(ws, good);
    check('a second deposit of 50,000 for foreign: 100,000 - 50,000 = 50,000 not yet deposited', W.totals(ws, { offeringId: 'f1', year: '2026', today: '2027-01-31' }).foreign.undepositedCents === 50000);
    check('DEPOSIT_RULES holds one sentence and a source for backup and for foreign', ['backup', 'foreign'].every((k) => W.DEPOSIT_RULES[k] && /^[A-Z][^]*\.$/.test(W.DEPOSIT_RULES[k].text) && (W.DEPOSIT_RULES[k].text.match(/\.(\s|$)/g) || []).length === 1 && /Form|Publication|Instructions/.test(W.DEPOSIT_RULES[k].source)), W.DEPOSIT_RULES);
    check('the module works out no due date: no key named due in totals', !/due/i.test(J(Object.keys(T.backup))));
    // W4: a run saved before plan 10-01 (no stored lines) is marked as worked out again
    const ws3 = wsC(NS);
    ws3.runs.push({ id: 'L-jun', offeringId: 'f1', date: '2026-06-15', type: 'Interest', total: 600000, status: 'paid', source: 'history' });
    const T3 = W.totals(ws3, { offeringId: 'f1', year: '2026', today: '2027-01-31' });
    check('W4: the earlier run adds no tax withheld (backup still 160,000) and is named as worked out again', T3.backup.withheldCents === 160000 && J(T3.backup.recomputedRuns) === J(['L-jun']) && J(T3.foreign.recomputedRuns) === J(['L-jun']), T3.backup);
    check('W4: items from stored lines are not marked', (T3.backup.items || []).every((x) => x.recomputed === false));
  },

  worksheet({ check }) {
    const NS = load();
    const W = NS.withholding;
    const ws = wsC(NS);
    const S = W.worksheet(ws, { offeringId: 'f1', year: '2026', today: '2027-01-31' });
    const r = (S.rows || [])[0] || {};
    check('example C: one row, A-1003', (S.rows || []).length === 1 && r.investorId === 'A-1003' && r.name === 'Investor A-1003', (S.rows || []).map((x) => x.investorId));
    check('with the W-8 facts on file: Canada, W-8BEN, signed, valid until 2028-12-31, foreign tax number on file', r.country === 'Canada' && r.form === 'W-8BEN' && r.signed === true && r.validUntil === '2028-12-31' && r.ftinOnFile === 'on file', r);
    check('two payments of 166,667 on 2026-09-15 and 2026-12-15', J((r.paid || []).map((p) => [p.date, p.type, p.grossCents, p.recomputed])) === J([['2026-09-15', 'Interest', 166667, false], ['2026-12-15', 'Interest', 166667, false]]), r.paid);
    check('two amounts withheld of 50,000, kind foreign', J((r.withheld || []).map((p) => [p.date, p.kind, p.cents])) === J([['2026-09-15', 'foreign', 50000], ['2026-12-15', 'foreign', 50000]]), r.withheld);
    check('a U.S. investor is not in it', !(S.rows || []).some((x) => x.investorId === 'A-1001' || x.investorId === 'A-1002'));
    const rows = csvRows(S.csv || '');
    check('the csv has one header line with the columns named', J(rows[0]) === J(HEADER) && rows.filter((x) => J(x) === J(HEADER)).length === 1, rows[0]);
    check('and one line per payment: A-1003, Canada, W-8BEN, yes, 2028-12-31, on file, 2026-09-15, Interest, 1666.67, 500.00, foreign, (not worked out again)', rows.length === 3 && J(rows[1]) === J(['A-1003', 'Investor A-1003', 'Canada', 'W-8BEN', 'yes', '2028-12-31', 'on file', '2026-09-15', 'Interest', '1666.67', '500.00', 'foreign', '']) && rows[2][7] === '2026-12-15' && rows[2][9] === '1666.67' && rows[2][10] === '500.00', rows);
    // an IRA is not in it either
    const ws2 = wsB();
    ws2.investors.push(inv('A-1004', 100000, Object.assign({}, NOFORM, { type: 'ira', taxType: 'us-entity' })));
    const S2 = W.worksheet(ws2, { offeringId: 'f1', year: '2026', today: '2027-01-31' });
    check('an IRA is not in it; the foreign investor is, with no payment in the year', J(S2.rows.map((x) => x.investorId)) === J(['A-1003']) && S2.rows[0].paid.length === 0, S2.rows.map((x) => x.investorId));
    // T-10-15: no cell a spreadsheet would run as a formula
    const ws3 = wsB();
    ['=SUM(A1:A9)', '+1 202 555', '-2 Holdings', '@Trust'].forEach((name, k) => ws3.investors.push(inv(`A-20${k}1`, 1000, Object.assign(w8ben({ country: name }), { title: name }))));
    const S3 = W.worksheet(ws3, { offeringId: 'f1', year: '2026', today: '2027-01-31' });
    const cells = csvRows(S3.csv).reduce((a, x) => a.concat(x), []);
    check('T-10-15: no cell starts with =, +, - or @ (names and countries starting with each)', cells.length > 0 && cells.every((c) => !/^[=+\-@\t\r]/.test(c)), cells.filter((c) => /^[=+\-@]/.test(c)));
    check('and such a name is kept, after an apostrophe', cells.indexOf("'=SUM(A1:A9)") >= 0 && cells.indexOf("'@Trust") >= 0, cells.slice(0, 40));
    // W4: a payment worked out again is marked, in the rows and in the csv's own column
    const ws4 = wsC(NS);
    ws4.runs.push({ id: 'L-jun', offeringId: 'f1', date: '2026-06-15', type: 'Interest', total: 600000, status: 'paid', source: 'history' });
    const S4 = W.worksheet(ws4, { offeringId: 'f1', year: '2026', today: '2027-01-31' });
    const jun = (S4.rows[0].paid || []).find((p) => p.date === '2026-06-15');
    check('W4: the June payment saved before the record is A-1003’s 100,000, marked recomputed', !!jun && jun.grossCents === 100000 && jun.recomputed === true, S4.rows[0].paid);
    const r4 = csvRows(S4.csv);
    const junRow = r4.find((x) => x[7] === '2026-06-15');
    check('W4: its csv line reads 1000.00 and yes in the column "Amount worked out again"; the stored payments read empty there', !!junRow && junRow[9] === '1000.00' && junRow[12] === 'yes' && r4.filter((x) => x[7] === '2026-09-15' || x[7] === '2026-12-15').every((x) => x[12] === ''), r4);
  },

  selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const u = run(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with FAIL', u.status === 1 && /^TAX MATH: FAIL \(cases run: 0\)/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty case list exits 1 with FAIL', e.status === 1 && /^TAX MATH: FAIL \(cases run: 0\)/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
  }
};

L.runParts(cases, { name: 'TAX MATH', unit: 'cases', flag: '--case', browser: false });
