// gate: node
// last "BANK FILES: PASS (cases run: 12)"
// Reading bank statement files (plan 11-02, assets/js/bankfiles.js): the same 2026 statement of hand-worked fund A,
// written in five formats, must read to the nine lines of fixtures/bank/expect.json to the cent; two real BAI2 files
// (fixtures/bank/real, an open-source project's published test data, Apache-2.0) must read with every trailer agreeing;
// a file whose trailers disagree, or that is too large, or holds something that is not an amount or a date, is refused.
//   node bank-files.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "BANK FILES: PASS (cases run: N)" or
// "BANK FILES: FAIL (cases run: N) - <cases>". Every case loads the modules into a fresh context of its own.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = path.resolve(__dirname, '../../../..');
const BANK = path.join(__dirname, 'fixtures/bank');
const EXPECT = JSON.parse(fs.readFileSync(path.join(BANK, 'expect.json'), 'utf8'));
const read = (name) => fs.readFileSync(path.join(BANK, name), 'utf8');

/**
 * What the two real BAI2 files read to, measured on the first passing run (kept in SCRATCH/exec-11-02/real-base.txt)
 * and checked by hand against the files: lines (16 records), the signed sum of their cents, money in and money out,
 * and the trailers checked.
 */
const REAL = {
  'sample1.txt': { lines: 17, sum: 0, in: 320000, out: -320000, accounts: 1, trailers: { account: 2, group: 1, file: 1 } },
  'sample2.txt': { lines: 4, sum: 30950000, in: 30950000, out: 0, accounts: 5, trailers: { account: 5, group: 4, file: 1 } }
};

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
/** One plain sentence: one line, ends with a full stop, no second sentence, no code words. */
const oneSentence = (s) => typeof s === 'string' && s.length > 10 && s.length < 320 && !/\n/.test(s) && /\.$/.test(s) && !/[.!?] [A-Z]/.test(s) && !/undefined|null|NaN|TypeError|\bat \w+ \(/.test(s);
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
/** parse must throw one plain sentence naming `word`, and return nothing. */
function refused(check, B, label, text, opts, word) {
  let got;
  const why = refusal(() => {
    got = B.parse(text, opts || {});
  });
  check(`${label}: refused with one plain sentence`, oneSentence(why), why || 'not refused');
  if (word) check(`${label}: the sentence names ${word}`, why.indexOf(word) >= 0, why);
  check(`${label}: nothing is returned`, got === undefined, got && { lines: got.lines && got.lines.length });
  return why;
}
const csv1 = (amount, date) => `Date,Description,Amount\n${date || '01/15/2026'},PAYMENT,${amount}\n`;
const MAP1 = { date: 0, text: 1, amount: 2, header: true, order: 'mdy', outNegative: true };

const cases = {
  async detect({ check }) {
    const B = portal().bankFiles;
    const kinds = { 'fund-a-signed.csv': 'csv', 'fund-a-inout.csv': 'csv', 'fund-a.qfx': 'ofx', 'fund-a.ofx': 'ofx', 'fund-a.bai': 'bai2', 'fund-a-bad-trailer.bai': 'bai2' };
    Object.keys(kinds).forEach((n) => check(`${n} is '${kinds[n]}'`, B.detect(read(n)) === kinds[n], B.detect(read(n))));
    check("'%PDF-1.7' is ''", B.detect('%PDF-1.7\n%âã\n1 0 obj, 2 0 obj\n') === '', B.detect('%PDF-1.7\n%âã\n1 0 obj, 2 0 obj\n'));
    check("an empty text is ''", B.detect('') === '', B.detect(''));
    check("one line of words is ''", B.detect('Statement for January') === '', B.detect('Statement for January'));
    check('the file name plays no part: the OFX text under any name is still ofx', B.detect(read('fund-a.qfx').replace(/^\s*/, '')) === 'ofx');
  },

  async 'csv-signed'({ check }) {
    const NS = portal();
    const B = NS.bankFiles;
    const text = read('fund-a-signed.csv');
    const map = B.csvGuess(text);
    const keys = ['date', 'text', 'amount', 'balance', 'header', 'order', 'outNegative'];
    const got = {};
    keys.forEach((k) => (got[k] = map[k]));
    check('csvGuess proposes { date 0, text 1, amount 2, balance 3, header true, order mdy, outNegative true }', same(got, { date: 0, text: 1, amount: 2, balance: 3, header: true, order: 'mdy', outNegative: true }), map);
    check('csvGuess proposes no money in, money out or check column', map.in == null && map.out == null && map.check == null, map);
    check('csvGuess takes the rows as well as the text', same(B.csvGuess(B.csvRows(text)), map), B.csvGuess(B.csvRows(text)));
    const st = compare(check, NS, 'fund-a-signed.csv', { kind: 'csv', map });
    check('the closing balance is the last row’s balance, 3,500,000', st.closingCents === 3500000, st.closingCents);
    const flipped = B.parse(text, { kind: 'csv', map: Object.assign({}, map, { outNegative: false }) });
    check('with "money out shown as negative" switched off every amount turns over', same(flipped.lines.map((l) => l.cents), EXPECT.lines.map((l) => -l.cents)), flipped.lines.map((l) => l.cents));
    const newest = text.split('\n')[0] + '\n' + text.trim().split('\n').slice(1).reverse().join('\n') + '\n';
    const back = B.parse(newest, { kind: 'csv', map });
    check('a file listed newest first reads to the same lines, oldest first, and the same closing balance', same(back.lines.map(plain), want()) && back.closingCents === 3500000, { lines: back.lines.map(plain), closing: back.closingCents });
  },

  async 'csv-inout'({ check }) {
    const NS = portal();
    const st = compare(check, NS, 'fund-a-inout.csv', { kind: 'csv', map: { date: 0, text: 1, check: 2, in: 3, out: 4, order: 'ymd' } });
    check('closingCents is null (no balance column)', st.closingCents === null, st.closingCents);
    check('the empty check numbers give empty references', st.lines.every((l) => l.ref === ''), st.lines.map((l) => l.ref));
    const both = 'Posting Date,Description,Check Number,Credit,Debit\n2026-01-15,ODD,,5.00,5.00\n';
    refused(check, NS.bankFiles, 'a row with money in and money out', both, { kind: 'csv', map: { date: 0, text: 1, check: 2, in: 3, out: 4, order: 'ymd' } });
  },

  async 'csv-guess'({ check }) {
    const B = portal().bankFiles;
    const g = B.csvGuess(read('fund-a-inout.csv'));
    check('fund-a-inout.csv: in 3, out 4, order ymd', g.in === 3 && g.out === 4 && g.order === 'ymd', g);
    check('fund-a-inout.csv: date 0, text 1, check 2, no amount, no balance', g.date === 0 && g.text === 1 && g.check === 2 && g.amount == null && g.balance == null, g);
    const dmy = 'Date,Description,Amount\n12/02/2026,RENT,-100.00\n13/02/2026,BANK FEE,-1.00\n';
    const d = B.csvGuess(dmy);
    check("a three-row file whose dates include 13/02/2026 proposes 'dmy'", d.order === 'dmy', d);
    const ds = B.parse(dmy, { kind: 'csv', map: d });
    check('and reads 12/02/2026 as 12 February', same(ds.lines.map((l) => l.date), ['2026-02-12', '2026-02-13']), ds.lines.map((l) => l.date));
    const nohead = '01/15/2026,WIRE IN,300000.00,300000.00\n01/20/2026,WIRE OUT,-400000.00,-100000.00\n';
    const n = B.csvGuess(nohead);
    check('a file with no header row: header false, date 0, text 1, amount 2, balance 3', n.header === false && n.date === 0 && n.text === 1 && n.amount === 2 && n.balance === 3, n);
    check('and its first row is read as a line', B.parse(nohead, { kind: 'csv', map: n }).lines.length === 2);
    refused(check, B, 'a map pointing the amount at the description column', read('fund-a-signed.csv'), { kind: 'csv', map: { date: 0, text: 1, amount: 1, header: true, order: 'mdy', outNegative: true } }, 'amount');
    refused(check, B, 'a map pointing the date at the amount column', read('fund-a-signed.csv'), { kind: 'csv', map: { date: 2, text: 1, amount: 2, header: true, order: 'mdy', outNegative: true } }, 'date');
  },

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
  },

  async ofx1({ check }) {
    const NS = portal();
    const B = NS.bankFiles;
    const st = compare(check, NS, 'fund-a.qfx');
    const ofx = B.parse(read('fund-a.ofx'), {});
    check('the same ids as fund-a.ofx (the bank’s FITIDs)', same(st.lines.map((l) => l.id), ofx.lines.map((l) => l.id)) && st.lines[0].id === 'f:260115001', st.lines.map((l) => l.id));
    check('the check number is kept as the reference', st.lines[3].ref === '1042', st.lines[3].ref);
    const ent = read('fund-a.qfx').replace('<NAME>WIRE OUT PORTFOLIO CO X', '<NAME>A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos; &#38; &amp;lt; &nbsp;');
    const e = B.parse(ent, {});
    check('only the five named entities are decoded, once', e.lines[2].text === 'A & B <C> "D" \'E\' &#38; &lt; &nbsp;', e.lines[2].text);
    const text = read('fund-a.qfx');
    refused(check, B, 'the older OFX file cut short', text.slice(0, Math.floor(text.length * 0.6)), {}, 'cut short');
    refused(check, B, 'the newer OFX file cut short', read('fund-a.ofx').slice(0, 2500), {}, 'cut short');
    refused(check, B, 'an OFX amount that is not dollars and cents', text.replace('<TRNAMT>-4500.00', '<TRNAMT>-45,00'), {}, '-45,00');
    refused(check, B, 'an OFX date that does not exist', text.replace('<DTPOSTED>20260630', '<DTPOSTED>20260631'), {}, '20260631');
  },

  async bai2({ check }) {
    const NS = portal();
    const st = compare(check, NS, 'fund-a.bai');
    check('opening 0 (summary 010) and closing 3,500,000 (summary 015)', st.openingCents === 0 && st.closingCents === 3500000, [st.openingCents, st.closingCents]);
    check('every trailer agrees: one account, one group, one file checked', same(st.trailers, { account: 1, group: 1, file: 1 }), st.trailers);
    check('ids are the bank references', st.lines[0].id === 'f:BR260115001' && st.lines[8].id === 'f:BR261215009', st.lines.map((l) => l.id));
    check('the customer reference (check 1042) is kept as the reference', st.lines[3].ref === '1042', st.lines[3].ref);
    check('the 88 continuation joins the text: ACH CREDIT PORTFOLIO CO X DIVIDEND', st.lines[5].text === 'ACH CREDIT PORTFOLIO CO X DIVIDEND', st.lines[5].text);
  },

  async 'bai2-real'({ check }) {
    const B = portal().bankFiles;
    Object.keys(REAL).forEach((name) => {
      const text = read('real/' + name);
      let st = null;
      const why = refusal(() => {
        st = B.parse(text, {});
      });
      check(`${name}: read with every 49, 98 and 99 trailer agreeing`, !why && st && st.kind === 'bai2', why);
      if (!st) return;
      const sum = st.lines.reduce((a, l) => a + l.cents, 0);
      const inn = st.lines.filter((l) => l.cents > 0).reduce((a, l) => a + l.cents, 0);
      const out = st.lines.filter((l) => l.cents < 0).reduce((a, l) => a + l.cents, 0);
      console.log(`INFO ${name}: ${st.lines.length} lines, sum ${sum}, in ${inn}, out ${out}, accounts ${st.accounts.length}, trailers ${JSON.stringify(st.trailers)}`);
      const r = REAL[name];
      check(`${name}: ${r.lines} lines`, st.lines.length === r.lines, st.lines.length);
      check(`${name}: the lines' cents add up to ${r.sum} (in ${r.in}, out ${r.out})`, sum === r.sum && inn === r.in && out === r.out, { sum, inn, out });
      check(`${name}: ${r.accounts} account(s)`, st.accounts.length === r.accounts, st.accounts);
      check(`${name}: trailers checked ${JSON.stringify(r.trailers)}`, same(st.trailers, r.trailers), st.trailers);
      check(`${name}: every amount is a whole number of cents and every date exists`, st.lines.every((l) => Number.isSafeInteger(l.cents) && /^20\d\d-\d\d-\d\d$/.test(l.date)), st.lines.map((l) => [l.date, l.cents]));
    });
    const s1 = read('real/sample1.txt');
    check('sample1.txt: currency CAD, account ending 3456, dates 2006-03-16 to 2006-03-17', (() => {
      const st = B.parse(s1, {});
      return st.currency === 'CAD' && st.last4 === '3456' && st.from === '2006-03-16' && st.to === '2006-03-17';
    })());
    const s2 = B.parse(read('real/sample2.txt'), {});
    check('sample2.txt: several accounts, so every line names its account and the top level has none', s2.last4 === '' && s2.lines.every((l) => /^\d{4}$/.test(l.last4)), { last4: s2.last4, lines: s2.lines.map((l) => l.last4) });
    check('sample2.txt: the 88 continuation carries the letter of credit text', s2.lines.some((l) => l.text === 'PROCEEDS OF LETTER OF CREDIT FROM THE ARAMCO OIL CO' && l.ref === 'YRC065321'), s2.lines.map((l) => [l.text, l.ref]));
    const one = B.parse(read('real/sample2.txt'), { account: '1203' });
    check('sample2.txt with account 1203 chosen: its two lines and its own balances', one.last4 === '1203' && one.lines.length === 2 && one.openingCents === 10000000, { last4: one.last4, n: one.lines.length, opening: one.openingCents });
    refused(check, B, 'sample1.txt with one amount changed by a cent', s1.replace('16,409,000000000002500,V,060316,,,,RETURNED CHEQUE', '16,409,000000000002501,V,060316,,,,RETURNED CHEQUE'), {}, 'account trailer');
  },

  async 'bai2-bad'({ check }) {
    const B = portal().bankFiles;
    refused(check, B, 'fund-a-bad-trailer.bai (49 control total one cent higher)', read('fund-a-bad-trailer.bai'), {}, 'account trailer');
    const good = read('fund-a.bai');
    check('fund-a.bai itself carries the trailers changed below', /^49,181300000,12\/\r?$/m.test(good) && /^98,181300000,1,14\/\r?$/m.test(good) && /^99,181300000,1,16\/\r?$/m.test(good));
    refused(check, B, 'the 49 record count one higher', good.replace('49,181300000,12/', '49,181300000,13/'), {}, 'account trailer');
    refused(check, B, 'the 98 control total one cent higher', good.replace('98,181300000,1,14/', '98,181300001,1,14/'), {}, 'group trailer');
    refused(check, B, 'the 99 record count one higher', good.replace('99,181300000,1,16/', '99,181300000,1,17/'), {}, 'file trailer');
    refused(check, B, 'the file without its 99 trailer', good.replace(/99,181300000,1,16\/\r?\n?$/, ''), {}, 'file trailer');
    refused(check, B, 'a 16 record dropped', good.replace(/16,451,450000,V,260930[^\n]*\n/, ''), {}, 'trailer');
    refused(check, B, 'a type code that is neither money in nor money out', good.replace('16,451,600000', '16,890,600000'), {}, '890');
    refused(check, B, 'a value date that does not exist', good.replace('V,261215', 'V,261232'), {}, '261232');
  },

  async ids({ check }) {
    const NS = portal();
    const B = NS.bankFiles;
    const two = B.lineIds([
      { date: '2026-03-31', cents: -450000, text: 'ACH DEBIT MANAGER FEES', ref: '' },
      { date: '2026-03-31', cents: -450000, text: 'ACH DEBIT MANAGER FEES', ref: '' }
    ]);
    const h = (n) => 'h:' + NS.audit.sha256(`2026-03-31|-450000|ACH DEBIT MANAGER FEES|${n}`).slice(0, 16);
    check('two identical lines get the ids of n = 0 and n = 1', two[0].id === h(0) && two[1].id === h(1), two.map((l) => l.id));
    check('and the two ids differ', two[0].id !== two[1].id && /^h:[0-9a-f]{16}$/.test(two[0].id), two.map((l) => l.id));
    const dup = B.lineIds([
      { date: '2026-01-02', cents: 100, text: 'A', bankId: 'X1' },
      { date: '2026-01-03', cents: 200, text: 'B', bankId: 'X1' },
      { date: '2026-01-04', cents: 300, text: 'C', bankId: 'X2' }
    ]);
    check('a bank id two lines share is not used; a bank id of its own is', dup[0].id.startsWith('h:') && dup[1].id.startsWith('h:') && dup[2].id === 'f:X2', dup.map((l) => l.id));
    const map = B.csvGuess(read('fund-a-signed.csv'));
    const a = B.parse(read('fund-a-signed.csv'), { kind: 'csv', map }).lines.map((l) => l.id);
    const b = portal().bankFiles.parse(read('fund-a-signed.csv'), { kind: 'csv', map }).lines.map((l) => l.id);
    check('the same CSV read twice gives the same ids', same(a, b), [a, b]);
    check('the CSV ids are nine different hashed ids', new Set(a).size === 9 && a.every((x) => /^h:[0-9a-f]{16}$/.test(x)), a);
    const bai = B.parse(read('fund-a.bai'), {});
    const csv = B.parse(read('fund-a-signed.csv'), { kind: 'csv', map });
    check('the CSV and BAI2 readings of one statement give the same date, cents and text', same(bai.lines.map(plain), csv.lines.map(plain)), [bai.lines.map(plain), csv.lines.map(plain)]);
    check('and their ids differ (plan 11-08 warns of the overlap)', bai.lines.every((l, i) => l.id !== csv.lines[i].id), [bai.lines.map((l) => l.id), csv.lines.map((l) => l.id)]);
  },

  async limits({ check }) {
    const B = portal().bankFiles;
    check('LIMITS is { bytes: 2000000, lines: 20000 }', same(B.LIMITS, { bytes: 2000000, lines: 20000 }), B.LIMITS);
    // Bytes are UTF-8 bytes: a two-byte letter fills the description, so the text is far shorter in characters.
    const pre = 'Date,Description,Amount\n01/15/2026,';
    const post = ',1.00\n';
    const room = B.LIMITS.bytes - Buffer.byteLength(pre + post, 'utf8');
    const desc = 'a'.repeat(room % 2) + 'é'.repeat(Math.floor(room / 2));
    const atLimit = pre + desc + post;
    check('the at-limit text is exactly LIMITS.bytes UTF-8 bytes and fewer characters', Buffer.byteLength(atLimit, 'utf8') === B.LIMITS.bytes && atLimit.length < B.LIMITS.bytes, [Buffer.byteLength(atLimit, 'utf8'), atLimit.length]);
    check('a text of exactly LIMITS.bytes bytes is read', !refusal(() => B.parse(atLimit, { kind: 'csv', map: MAP1 })), refusal(() => B.parse(atLimit, { kind: 'csv', map: MAP1 })));
    refused(check, B, 'a text of LIMITS.bytes + 1 bytes', pre + 'a' + desc + post, { kind: 'csv', map: MAP1 }, 'MB');
    const rows = (n) => {
      const out = ['Date,Description,Amount'];
      for (let i = 1; i < n; i++) out.push(`01/15/2026,LINE ${i},1.00`);
      return out.join('\n') + '\n';
    };
    const okLines = rows(B.LIMITS.lines);
    check('a text of exactly LIMITS.lines lines is read', B.parse(okLines, { kind: 'csv', map: MAP1 }).lines.length === B.LIMITS.lines - 1);
    refused(check, B, 'a text of LIMITS.lines + 1 lines', rows(B.LIMITS.lines + 1), { kind: 'csv', map: MAP1 }, 'lines');
    const exact = { '$1,234.56': 123456, '1234.5': 123450, '-12.00': -1200, '(12.00)': -1200, '12.00-': -1200, '-200.0000': -20000, '12.340': 1234, '0.10': 10, '+5': 500, '-$7,500.00': -750000, '1234567890123.45': 123456789012345 };
    Object.keys(exact).forEach((t) => check(`cents('${t}') is ${exact[t]}`, B.cents(t) === exact[t], B.cents(t)));
    ['12.345', '1,2,3', '--5', 'abc', '', '12,34', '1e5', '(-5)', '$$5', '12.00 CR', '0x10', '1.2.3'].forEach((t) => check(`cents('${t}') is null`, B.cents(t) === null, B.cents(t)));
    [['12.345', '12.345'], ['1,2,3', '"1,2,3"'], ['--5', '--5'], ['abc', 'abc']].forEach(([t, cell]) => refused(check, B, `parse of the amount '${t}'`, csv1(cell), { kind: 'csv', map: MAP1 }, t));
    refused(check, B, 'the date 02/30/2026', csv1('1.00', '02/30/2026'), { kind: 'csv', map: MAP1 }, '02/30/2026');
    const kept = B.parse(read('fund-a-signed.csv'), { kind: 'csv', map: B.csvGuess(read('fund-a-signed.csv')) }).lines[3].text;
    check("a description starting '=' is kept as text, unchanged", kept === '=SUM(A1) LAW FIRM INV 2231', kept);
    refused(check, B, 'a text that is not a statement', '%PDF-1.7\n1 0 obj\n', {}, 'CSV, OFX, QFX, QBO or BAI2');
    refused(check, B, 'one line of words', 'Statement for January', {}, 'CSV, OFX, QFX, QBO or BAI2');
  },

  async selfcheck({ check }) {
    const run = (arg) => spawnSync(process.execPath, [__filename, '--case', arg], { encoding: 'utf8' });
    const u = run('no-such-case');
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL /m.test(u.stdout), { status: u.status, out: u.stdout });
    const e = run('');
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL /m.test(e.stdout), { status: e.status, out: e.stdout });
    check('the gate marker names twelve cases, as many as the check has', /^\/\/ last "BANK FILES: PASS \(cases run: 12\)"$/m.test(fs.readFileSync(__filename, 'utf8')) && Object.keys(cases).length === 12, Object.keys(cases));
  }
};

if (require.main === module) L.runParts(cases, { name: 'BANK FILES', unit: 'cases', flag: '--case' });
module.exports = { portal, refusal, read, EXPECT };
