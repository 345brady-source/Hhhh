// gate: node
// last "RETURNS READ: PASS (cases run: 12)"
// Reading what the sponsor's bank sends back (plan 16-06, assets/js/achreturns.js, no browser): a NACHA return or
// notification-of-change file, a CSV returns report through a column map, or one return entered by hand, each read to
// plain items with the bank's reason in words and no full account number. The fixtures (fixtures/ach, written by
// make-fixtures.js from the portal's own builder output) use only never-issued routing numbers and accounts starting
// 99; every NACHA fixture but the deliberately broken one passes the independent reader. A file's text is never
// printed (the reader's masked summary is the only file summary a check may print).
//   node returns-read.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "RETURNS READ: PASS (cases run: N)" or
// "RETURNS READ: FAIL (cases run: N) - <failed cases>". The two marker lines above are read by the phase gate.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const L = require('./lib16.js');

const NAME = 'RETURNS READ';
const TODAY = '2026-12-08';
const F = path.join(__dirname, 'fixtures/ach');
const MAKE = path.join(F, 'make-fixtures.js');
/** The fixtures make-fixtures.js writes, besides MANIFEST.txt. */
const FIXTURES = ['dist-ppd.ach', 'ret-r03.ach', 'noc-c01.ach', 'prenote-r03.ach', 'mixed.ach', 'bad-93.ach', 'returns-a.csv', 'returns-b.csv', 'report.pdf.txt'];
/** The action classes of 16-RESEARCH 3.4, each with exactly the codes it holds. */
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => 'R' + String(a + i).padStart(2, '0'));
const CLASSES = {
  'needs-details': ['R02', 'R03', 'R04', 'R12', 'R13', 'R20', 'R28'].concat(range(80, 85)),
  contact: ['R14', 'R15'],
  frozen: ['R16'],
  flagged: ['R17'],
  refused: ['R23'],
  'no-change': ['R06', 'R24'],
  format: ['R18', 'R19', 'R25', 'R26', 'R27'],
  'text-only': ['R61', 'R62'].concat(range(67, 77)),
  'debit-only': ['R01', 'R05', 'R07', 'R08', 'R09', 'R10', 'R11', 'R29']
};
/** The change codes and the fields each corrects (16-RESEARCH 3.5); C61-C69 are refused changes between banks. */
const NOC_FIELDS = { C01: ['account'], C02: ['routing'], C03: ['routing', 'account'], C04: ['holder'], C05: ['type'], C06: ['account', 'type'], C07: ['routing', 'account', 'type'], C09: ['id'], C13: [], C14: [] };
const NOC_IGNORED = ['C61', 'C62', 'C63', 'C64', 'C65', 'C66', 'C67', 'C68', 'C69'];
/** A plain message: one line, a capital first, a full stop last, no code words (Error, undefined, null, a stack). */
const sentence = (s) => typeof s === 'string' && /^[A-Z][^\n]*\.$/.test(s) && !/undefined|null|NaN|Error|at .*\.js/.test(s);
/** The message of what fn throws, or null when it does not throw. */
const thrown = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return String((e && e.message) || e);
  }
};
const key = (it) => `${it.code}|${it.individualId}|${it.cents}|${it.originalTrace}`;
/** Every item of every readable fixture, with the map guess() gives for the CSV ones. */
function allItems(R) {
  const out = [];
  ['ret-r03.ach', 'noc-c01.ach', 'prenote-r03.ach', 'mixed.ach'].forEach((n) => out.push(...R.parse(read(n)).items));
  ['returns-a.csv', 'returns-b.csv'].forEach((n) => out.push(...R.parseCsv(read(n), R.guess(read(n)).map).items));
  return out;
}

const read = (name) => fs.readFileSync(path.join(F, name), 'utf8');
const portal = () => L.loadPortal(undefined, { today: TODAY, extra: ['bankfiles.js', 'achreturns.js'] });
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
/** The entry records of a NACHA text (record type 6), as written. */
const entries = (text) => text.split(/\r?\n/).filter((l) => l[0] === '6');
/** A short, safe description of an item for a FAIL line: no account number, no routing number. */
const brief = (it) => (it ? { kind: it.kind, code: it.code, action: it.action, individualId: it.individualId, cents: it.cents, effective: it.effective, sec: it.sec, last4: it.accountLast4, source: it.source } : it);

const parts = {
  // A return the bank would send for the portal's own file is read back to the entry it returns.
  async return({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    check('NS.achReturns is registered with detect and parse', !!R && typeof R.detect === 'function' && typeof R.parse === 'function');
    const text = read('ret-r03.ach');
    check("detect() reads ret-r03.ach as 'nacha'", R.detect(text) === 'nacha', R.detect(text));
    const r = R.parse(text);
    check("parse() gives kind 'nacha' and one item", r.kind === 'nacha' && r.items.length === 1, r.items.length);
    const it = r.items[0] || {};
    const orig = entries(read('dist-ppd.ach'))[1];
    check("the item is kind 'return', code R03, action 'needs-details', source 'nacha'", it.kind === 'return' && it.code === 'R03' && it.action === 'needs-details' && it.source === 'nacha', brief(it));
    check("its words are the R03 sentence of RETURN_CODES", typeof it.words === 'string' && it.words.length > 0 && it.words === R.RETURN_CODES.R03.words);
    check("originalTrace is dist-ppd.ach's second entry's trace", it.originalTrace === orig.slice(79, 94));
    check("individualId, name and cents are that entry's (INV-102, INVESTOR TWO, 98000)", it.individualId === 'INV-102' && it.individualId === orig.slice(39, 54).trim() && it.name === 'INVESTOR TWO' && it.cents === 98000 && it.cents === Number(orig.slice(29, 39)), brief(it));
    check("effective is the original batch's effective date (2026-12-03), sec PPD, companyId 1990000001", it.effective === '2026-12-03' && it.sec === 'PPD' && it.companyId === '1990000001', brief(it));
    check("accountLast4 is the last four of that entry's account, txCode 21, rdfi8 its receiving bank", it.accountLast4 === L.account(2).slice(-4) && it.txCode === '21' && it.rdfi8 === orig.slice(3, 11), brief(it));
    check("date is the return file's creation date (2026-12-07); line is the entry's line (3)", it.date === '2026-12-07' && r.fileDate === '2026-12-07' && it.line === 3, { date: it.date, fileDate: r.fileDate, line: it.line });
    check('the item holds no full account number', JSON.stringify(r.items).indexOf(L.account(2)) < 0);
  },

  // A notification of change gives the change code and the corrected data, the old account's last four only; the
  // corrected data is split as the open-source reader does (C07: routing is the first 9 characters).
  async noc({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const r = R.parse(read('noc-c01.ach'));
    const it = r.items[0] || {};
    const orig = entries(read('dist-ppd.ach'))[0];
    check("noc-c01.ach gives one item: kind 'noc', code C01, sec COR, cents 0, source 'nacha'", r.items.length === 1 && it.kind === 'noc' && it.code === 'C01' && it.sec === 'COR' && it.cents === 0 && it.source === 'nacha', brief(it));
    check('its words are the C01 sentence of NOC_CODES; originalTrace is the first entry\'s trace; individualId INV-101', !!R.NOC_CODES && it.words === R.NOC_CODES.C01.words && it.originalTrace === orig.slice(79, 94) && it.individualId === 'INV-101', brief(it));
    check("corrected.account is the fixture's new number account(21), with no problem", !!it.corrected && it.corrected.account === L.account(21) && !it.corrected.problem, it.corrected ? Object.keys(it.corrected) : it.corrected);
    check("accountLast4 is the old account's last four (account(1))", it.accountLast4 === L.account(1).slice(-4), it.accountLast4);
    const c = R.corrected;
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const acct4 = L.account(4);
    const c07 = c('C07', '190000033' + acct4 + '      22');
    check("corrected('C07', '190000033' + account(4) + spaces + '22') = routing 190000033, account account(4), type checking", eq(c07, { routing: '190000033', account: acct4, type: 'checking' }), Object.keys(c07));
    const c07bad = c('C07', '190000034' + acct4 + '      32');
    check('a C07 whose routing fails the check digit is marked with the problem, never offered as good', c07bad.problem === 'The corrected routing number fails the check digit.' && c07bad.type === 'savings', c07bad.problem);
    check("C03 by parts: '190000033   ' + account(4) = routing and account", eq(c('C03', '190000033   ' + acct4), { routing: '190000033', account: acct4 }));
    check("C06 by parts: account(4) + '  32' = account and type savings", eq(c('C06', acct4 + '            32'), { account: acct4, type: 'savings' }));
    check("C05 '32' is savings, '22' is checking; C04 gives the holder; C09 the id", c('C05', '32').type === 'savings' && c('C05', '22').type === 'checking' && c('C04', 'INVESTOR ONE JONES').holder === 'INVESTOR ONE JONES' && c('C09', 'INV-101X').id === 'INV-101X');
    check("C02 '190000034' (fails the check digit) is marked; '190000033' is not", c('C02', '190000034').problem === 'The corrected routing number fails the check digit.' && !c('C02', '190000033').problem && c('C02', '190000033').routing === '190000033');
    check('C01 with no corrected data is marked as missing the account number', /missing the account number/.test(c('C01', '').problem || ''), c('C01', '').problem);
  },

  // A returned pre-note is a return item of $0 with the pre-note's own trace.
  async prenote({ check }) {
    const NS = portal();
    const r = NS.achReturns.parse(read('prenote-r03.ach'));
    const it = r.items[0] || {};
    check("prenote-r03.ach gives one return item, code R03, cents 0", r.items.length === 1 && it.kind === 'return' && it.code === 'R03' && it.cents === 0, brief(it));
    check("originalTrace is the pre-note's trace (the originating bank's 8 digits, sequence 0000011)", it.originalTrace === L.NEVER.odfi.slice(0, 8) + '0000011', it.originalTrace && it.originalTrace.slice(-7));
    check("effective is the pre-note batch's date (2026-11-24); individualId INV-101; txCode 21", it.effective === '2026-11-24' && it.individualId === 'INV-101' && it.txCode === '21', brief(it));
  },

  // Two returns and a change in one file come out in file order; the C02's corrected routing passes the check digit.
  async mixed({ check }) {
    const NS = portal();
    const r = NS.achReturns.parse(read('mixed.ach'));
    const d = entries(read('dist-ppd.ach'));
    const got = r.items.map((i) => `${i.kind}:${i.code}:${i.individualId}:${i.cents}`).join(', ');
    check('three items in file order: return R02 INV-101 125000, return R16 INV-103 41005, noc C02 INV-102 0', got === 'return:R02:INV-101:125000, return:R16:INV-103:41005, noc:C02:INV-102:0', got);
    const [a, b, c] = r.items;
    check('their traces are the first, third and second original entries\' and their lines increase', !!c && a.originalTrace === d[0].slice(79, 94) && b.originalTrace === d[2].slice(79, 94) && c.originalTrace === d[1].slice(79, 94) && a.line < b.line && b.line < c.line);
    check("R02 is 'needs-details', R16 'frozen' (savings return, txCode 31), the C02 batch is COR", !!c && a.action === 'needs-details' && b.action === 'frozen' && b.txCode === '31' && c.sec === 'COR');
    check("the C02's corrected routing is 190000033, passes the check digit and has no problem", !!c && c.corrected && c.corrected.routing === '190000033' && NS.nacha.abaValid(c.corrected.routing) && !c.corrected.problem, c && c.corrected);
  },

  // A comma CSV report: guess maps its six columns; parseCsv gives the same items as the NACHA files.
  async 'csv-a'({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const text = read('returns-a.csv');
    check("detect() reads returns-a.csv as 'csv'", R.detect(text) === 'csv', R.detect(text));
    const g = R.guess(text);
    check('guess maps date 0, code 1, investorId 2, name 3, amount 4, trace 5, no corrected column; 4 rows', JSON.stringify(g.map) === JSON.stringify({ date: 0, code: 1, investorId: 2, name: 3, amount: 4, trace: 5, corrected: -1 }) && g.rows === 4 && g.header.length === 6, g);
    const r = R.parseCsv(text, g.map);
    const nacha = R.parse(read('ret-r03.ach')).items.concat(R.parse(read('mixed.ach')).items);
    check('parseCsv gives the same codes, investor ids, cents and traces as ret-r03.ach and mixed.ach hold', r.kind === 'csv' && r.items.map(key).sort().join(';') === nacha.map(key).sort().join(';'), r.items.map((i) => `${i.code}:${i.individualId}:${i.cents}`));
    check("every item has source 'csv', date 2026-12-07 and its row's words and action", r.items.length === 4 && r.items.every((i) => i.source === 'csv' && i.date === '2026-12-07' && i.words && i.action), r.items.map(brief));
    const p = R.parse(text, { map: g.map });
    check('parse(text, { map }) gives the same items', p.kind === 'csv' && p.items.map(key).join(';') === r.items.map(key).join(';'));
    check("parse(text) with no map is refused: 'Choose which column holds the date first.'", thrown(() => R.parse(text)) === 'Choose which column holds the date first.', thrown(() => R.parse(text)));
    const noCode = Object.assign({}, g.map, { code: -1 });
    check("a map with no code column is refused: 'Choose which column holds the return or change code first.'", thrown(() => R.parseCsv(text, noCode)) === 'Choose which column holds the return or change code first.', thrown(() => R.parseCsv(text, noCode)));
  },

  // A semicolon CSV with dollar amounts and a change row.
  async 'csv-b'({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const text = read('returns-b.csv');
    const g = R.guess(text);
    check('guess maps the semicolon header: date 0, code 1, investorId 2, name 3, amount 4, no trace, corrected 5', JSON.stringify(g.map) === JSON.stringify({ date: 0, code: 1, investorId: 2, name: 3, amount: 4, trace: -1, corrected: 5 }), g.map);
    const r = R.parseCsv(text, g.map);
    const [a, b] = r.items;
    check("two items; the total row (no code) is skipped and counted (skipped: 1)", r.items.length === 2 && r.skipped === 1, { items: r.items.length, skipped: r.skipped });
    check("'$1,250.00' is 125000 cents (R02, INV-101, 2026-12-07)", !!a && a.code === 'R02' && a.cents === 125000 && a.individualId === 'INV-101' && a.date === '2026-12-07', brief(a));
    check("the change row is kind 'noc' C01 dated 12/08/26 = 2026-12-08, its corrected account account(21)", !!b && b.kind === 'noc' && b.code === 'C01' && b.date === '2026-12-08' && b.corrected && b.corrected.account === L.account(21) && !b.corrected.problem, brief(b));
  },

  // One return entered by hand; what it cannot be is refused with a sentence.
  async 'by-hand'({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const it = R.byHand({ code: 'R03', date: '2026-12-07', investorId: 'INV-102', cents: 98000, runId: 'run-1' });
    check("byHand R03 gives one return item with source 'hand', its words and action, the date and cents", it.kind === 'return' && it.code === 'R03' && it.source === 'hand' && it.action === 'needs-details' && it.words === R.RETURN_CODES.R03.words && it.date === '2026-12-07' && it.cents === 98000 && it.individualId === 'INV-102' && it.runId === 'run-1', brief(it));
    const n = R.byHand({ code: 'C01', date: '2026-12-08', investorId: 'INV-101', cents: 0, corrected: L.account(21) });
    check("byHand C01 gives a 'noc' item whose corrected account is the one entered", n.kind === 'noc' && n.corrected && n.corrected.account === L.account(21), brief(n));
    const bad = [
      ['an unknown code (R99)', { code: 'R99', date: '2026-12-07', investorId: 'INV-102', cents: 0 }],
      ["the date '2026/12/04'", { code: 'R03', date: '2026/12/04', investorId: 'INV-102', cents: 0 }],
      ['-1 cents', { code: 'R03', date: '2026-12-07', investorId: 'INV-102', cents: -1 }],
      ['1.5 cents', { code: 'R03', date: '2026-12-07', investorId: 'INV-102', cents: 1.5 }],
      ['no investor', { code: 'R03', date: '2026-12-07', cents: 0 }]
    ];
    const msgs = bad.map(([, o]) => thrown(() => R.byHand(o)));
    bad.forEach(([what], i) => check(`${what} is refused with a sentence`, sentence(msgs[i]), msgs[i]));
    check('each of those refusals has its own sentence', new Set(msgs).size === msgs.length, msgs);
  },

  // Everything the reader cannot read is refused with its own sentence; nothing is read over the network.
  async refusals({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const pdf = 'This is a PDF. Download the returns report from your bank as a CSV or a NACHA file, or enter the return by hand.';
    const report = read('report.pdf.txt');
    check("detect() reads report.pdf.txt as 'pdf' (string and bytes)", R.detect(report) === 'pdf' && R.detect(new TextEncoder().encode(report)) === 'pdf');
    check('report.pdf.txt is refused: ' + pdf, thrown(() => R.parse(report)) === pdf, thrown(() => R.parse(report)));
    check('its bytes are refused the same way', thrown(() => R.parse(new TextEncoder().encode(report))) === pdf);
    check('LIMITS are 2,000,000 bytes and 20,000 lines (the statement reader\'s)', R.LIMITS.bytes === 2000000 && R.LIMITS.lines === 20000 && R.LIMITS === NS.bankFiles.LIMITS);
    const big = '101' + 'x'.repeat(R.LIMITS.bytes);
    check("a string over LIMITS.bytes: 'This file is larger than 2,000,000 bytes.'", thrown(() => R.parse(big)) === 'This file is larger than 2,000,000 bytes.', thrown(() => R.parse(big)));
    const many = '101\n'.repeat(R.LIMITS.lines + 1);
    check("a string over LIMITS.lines: 'This file has more than 20,000 lines.'", thrown(() => R.parse(many)) === 'This file has more than 20,000 lines.', thrown(() => R.parse(many)));
    const bad = read('bad-93.ach');
    const n = bad.split('\r\n').findIndex((l) => l.length === 93) + 1;
    const want = `Line ${n} has 93 characters; a NACHA file has 94 on every line.`;
    check(`bad-93.ach: '${want}'`, n > 0 && thrown(() => R.parse(bad)) === want, thrown(() => R.parse(bad)));
    check("dist-ppd.ach (the portal's own credits): 'This file holds no returns or notices of change.'", thrown(() => R.parse(read('dist-ppd.ach'))) === 'This file holds no returns or notices of change.', thrown(() => R.parse(read('dist-ppd.ach'))));
    check("'' : 'This file is empty.' (also only blanks)", thrown(() => R.parse('')) === 'This file is empty.' && thrown(() => R.parse(' \r\n ')) === 'This file is empty.');
    check("a string holding a NUL byte: 'This file is not text.'", thrown(() => R.parse('101\u0000abc')) === 'This file is not text.', thrown(() => R.parse('101\u0000abc')));
    check("bytes that are not UTF-8: 'This file is not text.'", thrown(() => R.parse(new Uint8Array([0x31, 0x30, 0x31, 0xff, 0xfe]))) === 'This file is not text.');
    const other = 'just a note\nnothing else';
    check('text that is neither a NACHA file nor a CSV is refused with a sentence', R.detect(other) === null && sentence(thrown(() => R.parse(other))), thrown(() => R.parse(other)));
    const all = [pdf, thrown(() => R.parse(big)), thrown(() => R.parse(many)), thrown(() => R.parse(bad)), thrown(() => R.parse(read('dist-ppd.ach'))), thrown(() => R.parse('')), thrown(() => R.parse('101\u0000abc'))];
    check('each refusal is its own plain sentence', all.every(sentence) && new Set(all).size === all.length, all);
    const src = fs.readFileSync(path.join(L.ROOT, 'assets/js/achreturns.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const net = src.match(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|DOMParser|\beval\s*\(|new Function|import\s*\(|importScripts/g) || [];
    check('achreturns.js has no fetch, XHR, socket, beacon, DOM parser, eval or dynamic import', net.length === 0, net);
  },

  // Every code of the tables has its title, words and action; an unknown code is shown with its code, 'unknown'.
  async codes({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const listed = Object.keys(CLASSES).reduce((a, k) => a.concat(CLASSES[k]), []);
    const missing = listed.filter((c) => !R.RETURN_CODES[c]);
    check(`RETURN_CODES holds all ${listed.length} return codes of 16-RESEARCH 3.4`, missing.length === 0, missing);
    const wrong = listed.filter((c) => R.RETURN_CODES[c] && CLASSES[R.RETURN_CODES[c].action].indexOf(c) < 0);
    check('each has the action class 16-RESEARCH 3.4 gives it', wrong.length === 0, wrong);
    const extra = Object.keys(R.RETURN_CODES).filter((c) => listed.indexOf(c) < 0);
    check('RETURN_CODES holds no other code', extra.length === 0, extra);
    const nocs = Object.keys(NOC_FIELDS);
    const nocWrong = nocs.filter((c) => !R.NOC_CODES[c] || JSON.stringify(R.NOC_CODES[c].fields) !== JSON.stringify(NOC_FIELDS[c]));
    check('NOC_CODES holds C01-C07, C09, C13 and C14 with the fields each corrects', nocWrong.length === 0, nocWrong);
    check("C61-C69 are in NOC_CODES with no fields and the action 'ignored'", NOC_IGNORED.every((c) => R.NOC_CODES[c] && R.NOC_CODES[c].fields.length === 0 && R.NOC_CODES[c].action === 'ignored'));
    const rows = Object.keys(R.RETURN_CODES).map((c) => [c, R.RETURN_CODES[c]]).concat(Object.keys(R.NOC_CODES).map((c) => [c, R.NOC_CODES[c]]));
    const thin = rows.filter(([, v]) => !(typeof v.title === 'string' && v.title.length > 3 && sentence(v.words) && v.words.length <= 120)).map(([c]) => c);
    check('every code has a title and one short plain sentence for the sponsor', thin.length === 0, thin);
    const words = rows.map(([, v]) => `${v.title}\n${v.words}`).join('\n');
    check('no title or sentence names a vendor or tool or uses the forbidden word', !L.WORD_RE.test(words) && !L.VENDOR_RE.test(words) && !L.VENDORS.test(words), (words.match(L.WORD_RE) || words.match(L.VENDOR_RE) || words.match(L.VENDORS) || [''])[0]);
    const r99 = read('ret-r03.ach').replace(/^799R03/m, '799R99');
    const it = R.parse(r99).items[0] || {};
    check("a return with code R99 gives action 'unknown', code R99, and words that name the code", it.code === 'R99' && it.action === 'unknown' && /R99/.test(it.words || '') && sentence(it.words), brief(it));
  },

  // No item holds a full account number outside its corrected block; nothing in the reader stores or logs anything.
  async privacy({ check }) {
    const NS = portal();
    const R = NS.achReturns;
    const items = allItems(R);
    check('every readable fixture gives items (12 in all)', items.length === 12, items.length);
    const bare = JSON.stringify(items.map((i) => Object.assign({}, i, { corrected: undefined })));
    const accounts = [1, 2, 3, 4, 21].map(L.account);
    const shown = accounts.filter((a) => bare.indexOf(a) >= 0);
    check('the JSON of every item, without the corrected block, holds no fixture account number in full', shown.length === 0, `${shown.length} shown`);
    check('leaks() finds nothing in it', L.leaks(bare).length === 0, `${L.leaks(bare).length} found`);
    check('no item holds a run of 5 or more digits that starts 99 (an account number)', !/(?<!\d)99\d{3,}/.test(bare.replace(/"originalTrace":"\d+"/g, '')));
    const withC = items.filter((i) => i.kind === 'noc' && i.corrected && i.corrected.account);
    check("only a change's corrected block holds a full account number (the corrected one, for the sponsor to confirm)", withC.length === 2 && withC.every((i) => i.corrected.account === L.account(21)), withC.length);
    const src = fs.readFileSync(path.join(L.ROOT, 'assets/js/achreturns.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const stores = src.match(/\bconsole\.|localStorage|sessionStorage|indexedDB|document\.cookie|NS\.(audit|changeLog|store|save)\b|\.log\s*\(/g) || [];
    check('achreturns.js stores and logs nothing (no console, storage, cookie or change log)', stores.length === 0, stores);
  },

  // The fixtures are what make-fixtures.js writes (byte for byte), MANIFEST.txt matches them, and every NACHA
  // fixture but the deliberately broken one passes the independent reader.
  async fixtures({ check }) {
    const man = read('MANIFEST.txt')
      .split('\n')
      .filter((l) => l && l[0] !== '#')
      .map((l) => l.split(' '));
    const listed = man.map((m) => m[0]);
    check(`MANIFEST.txt lists exactly the ${FIXTURES.length} fixtures`, listed.slice().sort().join(',') === FIXTURES.slice().sort().join(','), listed);
    const wrong = man.filter((m) => {
      const b = fs.readFileSync(path.join(F, m[0]));
      return Number(m[1]) !== b.length || m[2] !== sha(b);
    });
    check("every file's size and SHA-256 equal MANIFEST.txt's", man.length > 0 && wrong.length === 0, wrong.map((m) => m[0]));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-fixtures16-'));
    try {
      const r = spawnSync(process.execPath, [MAKE, '--out', tmp], { encoding: 'utf8' });
      check('make-fixtures.js --out <a temporary folder> exits 0', r.status === 0, String(r.stdout || '').split('\n').slice(-2).join(' | ') + String(r.stderr || '').slice(0, 300));
      const made = fs.existsSync(tmp) ? fs.readdirSync(tmp).sort() : [];
      const want = FIXTURES.concat(['MANIFEST.txt']).sort();
      check('it writes exactly the fixtures and MANIFEST.txt', made.join(',') === want.join(','), made);
      const differ = want.filter((n) => !fs.existsSync(path.join(tmp, n)) || !fs.readFileSync(path.join(tmp, n)).equals(fs.readFileSync(path.join(F, n))));
      check('every file it writes is byte-equal to the committed one (MANIFEST.txt too)', differ.length === 0, differ);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    const ach = FIXTURES.filter((n) => /\.ach$/.test(n) && n !== 'bad-93.ach');
    ach.forEach((n) => {
      const v = L.validate(read(n));
      check(`${n} passes the independent reader (-validate-file and -validate-totals)`, v.ok, v.out);
    });
    // bad-93.ach (plan check B1): the independent reader pads a short record (measured in 16-01), so no reader result
    // is asserted for it; the case proves the file is ret-r03.ach with one trailing blank removed from one record.
    const lens = read('bad-93.ach').split('\r\n').slice(0, -1).map((l) => l.length);
    const at = lens.indexOf(93);
    check('bad-93.ach has exactly one line of 93 characters and every other line 94', lens.length === 10 && lens.filter((n) => n === 93).length === 1 && lens.filter((n) => n === 94).length === lens.length - 1, lens);
    const back = read('bad-93.ach').split('\r\n');
    if (at >= 0) back[at] += ' ';
    check('bad-93.ach with that one blank put back is ret-r03.ach byte for byte (nothing else changed)', at >= 0 && back.join('\r\n') === read('ret-r03.ach') && read('ret-r03.ach').split('\r\n')[at].slice(-1) === ' ');
    const v93 = L.validate(read('bad-93.ach'));
    console.log(`NOTE bad-93.ach is ${v93.ok ? 'read as valid by the independent reader (it pads short records); the portal\'s own reader refuses it (case refusals)' : 'refused by the independent reader: ' + v93.out}`);
    const all = FIXTURES.map(read).join('\n');
    check('the fixtures hold no routing number with an assigned prefix (leaks() finds nothing)', L.leaks(all).length === 0, `${L.leaks(all).length} found`);
    const nines = Array.from(all.matchAll(/(?<!\d)\d{9}(?!\d)/g)).map((m) => m[0]).filter((s) => NS_ABA(s));
    check('every 9-digit number in them that passes the check digit is a never-issued one (prefix 19)', nines.every((s) => s.slice(0, 2) === '19'), nines.filter((s) => s.slice(0, 2) !== '19').length);
    const acctFields = ach.concat(FIXTURES.indexOf('bad-93.ach') >= 0 ? ['bad-93.ach'] : []).reduce((a, n) => a.concat(entries(read(n)).map((l) => l.slice(12, 29).trim())), []);
    check('every entry of every NACHA fixture is to a never-issued bank (prefix 19) and an account starting 99', acctFields.length > 0 && acctFields.every((s) => /^99\d{8}$/.test(s)) && ach.every((n) => entries(read(n)).every((l) => l.slice(3, 5) === '19')), acctFields.filter((s) => !/^99\d{8}$/.test(s)).length);
  },

  // The case runner itself: an unknown case name and an empty list each fail.
  async selfcheck({ check }) {
    const child = (args) => {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-returns16-out-'));
      try {
        const r = spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, { GATE_FRESH: '1', P6_OUT: out }) });
        return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
      } finally {
        fs.rmSync(out, { recursive: true, force: true });
      }
    };
    const last = (s) => s.trim().split('\n').pop();
    const u = child(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nosuchcase/m.test(u.out) && last(u.out).indexOf(`${NAME}: FAIL`) === 0, last(u.out));
    const e = child(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.out) && last(e.out).indexOf(`${NAME}: FAIL`) === 0, last(e.out));
  }
};

/** The ABA check digit (weights 3, 7, 1), as the builder computes it. */
function NS_ABA(s) {
  if (!/^\d{9}$/.test(s) || /^0{9}$/.test(s)) return false;
  const d = s.split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
