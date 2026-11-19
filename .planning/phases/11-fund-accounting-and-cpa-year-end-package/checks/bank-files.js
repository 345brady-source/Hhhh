// gate: node
// last "BANK FILES: PASS (cases run: 1)"
// Reading bank statement files (plan 11-02, assets/js/bankfiles.js): the same 2026 statement of hand-worked fund A,
// written in several formats, must read to the nine lines of fixtures/bank/expect.json to the cent.
//   node bank-files.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "BANK FILES: PASS (cases run: N)" or
// "BANK FILES: FAIL (cases run: N) - <cases>". Every case loads the modules into a fresh context of its own.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = path.resolve(__dirname, '../../../..');
const BANK = path.join(__dirname, 'fixtures/bank');
const EXPECT = JSON.parse(fs.readFileSync(path.join(BANK, 'expect.json'), 'utf8'));
const read = (name) => fs.readFileSync(path.join(BANK, name), 'utf8');

/** A fresh portal context with tenants.js, data.js, audit.js (for sha256) and bankfiles.js. */
function portal() {
  const window = { CVPortal: {} };
  const ctx = vm.createContext({ window, console, TextEncoder, TextDecoder });
  ['tenants.js', 'data.js', 'audit.js', 'bankfiles.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'), ctx, { filename: f }));
  const NS = window.CVPortal;
  if (!NS.bankFiles) throw new Error('NS.bankFiles is not registered');
  return NS;
}
/** The refusal sentence fn throws, or '' when it does not throw. */
function refusal(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e) || 'refused';
  }
}
const plain = (line) => ({ date: line.date, cents: line.cents, text: line.text });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const want = () => EXPECT.lines.map(plain);

/** The file's lines, account and balances against expect.json; returns the parsed statement. */
function compare(check, NS, name, opts) {
  const st = NS.bankFiles.parse(read(name), opts || {});
  const f = EXPECT.files[name];
  check(`${name}: kind ${f.kind}`, st.kind === f.kind, st.kind);
  check(`${name}: the nine lines of expect.json (date, cents, text) in order`, same(st.lines.map(plain), want()), st.lines.map(plain));
  check(`${name}: account ending ${f.last4 || '(none in the file)'}`, st.last4 === f.last4, st.last4);
  check(`${name}: currency ${f.currency || '(none in the file)'}`, st.currency === f.currency, st.currency);
  check(`${name}: opening ${f.openingCents}`, st.openingCents === f.openingCents, st.openingCents);
  check(`${name}: closing ${f.closingCents}`, st.closingCents === f.closingCents, st.closingCents);
  check(`${name}: from ${EXPECT.from} to ${EXPECT.to}`, st.from === EXPECT.from && st.to === EXPECT.to, [st.from, st.to]);
  check(`${name}: every amount is a whole number of cents`, st.lines.every((l) => Number.isSafeInteger(l.cents)), st.lines.map((l) => l.cents));
  return st;
}

const cases = {
  async ofx2({ check }) {
    const NS = portal();
    const B = NS.bankFiles;
    check("detect: fund-a.ofx is 'ofx'", B.detect(read('fund-a.ofx')) === 'ofx', B.detect(read('fund-a.ofx')));
    const st = compare(check, NS, 'fund-a.ofx');
    const ids = st.lines.map((l) => l.id);
    check("each id is 'f:' + its FITID", same(ids, EXPECT.fitids.map((x) => 'f:' + x)), ids);
    check('the check number is kept as the reference', st.lines[3].ref === '1042', st.lines[3].ref);
    const again = NS.bankFiles.parse(read('fund-a.ofx'), {});
    check('parsing again gives the same ids', same(again.lines.map((l) => l.id), ids), again.lines.map((l) => l.id));
    const fresh = portal().bankFiles.parse(read('fund-a.ofx'), { kind: 'ofx' });
    check('a fresh context gives the same ids', same(fresh.lines.map((l) => l.id), ids), fresh.lines.map((l) => l.id));
  }
};

if (require.main === module) L.runParts(cases, { name: 'BANK FILES', unit: 'cases', flag: '--case' });
module.exports = { portal, refusal, read, EXPECT };
