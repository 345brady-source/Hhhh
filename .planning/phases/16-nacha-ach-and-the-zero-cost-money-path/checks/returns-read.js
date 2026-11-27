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
const FIXTURES = ['dist-ppd.ach', 'ret-r03.ach'];

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
    const all = FIXTURES.map(read).join('\n');
    check('the fixtures hold no routing number with an assigned prefix (leaks() finds nothing)', L.leaks(all).length === 0, `${L.leaks(all).length} found`);
    const nines = Array.from(all.matchAll(/(?<!\d)\d{9}(?!\d)/g)).map((m) => m[0]).filter((s) => NS_ABA(s));
    check('every 9-digit number in them that passes the check digit is a never-issued one (prefix 19)', nines.every((s) => s.slice(0, 2) === '19'), nines.filter((s) => s.slice(0, 2) !== '19').length);
    const acctFields = ach.concat(FIXTURES.indexOf('bad-93.ach') >= 0 ? ['bad-93.ach'] : []).reduce((a, n) => a.concat(entries(read(n)).map((l) => l.slice(12, 29).trim())), []);
    check('every entry of every NACHA fixture is to a never-issued bank (prefix 19) and an account starting 99', acctFields.length > 0 && acctFields.every((s) => /^99\d{8}$/.test(s)) && ach.every((n) => entries(read(n)).every((l) => l.slice(3, 5) === '19')), acctFields.filter((s) => !/^99\d{8}$/.test(s)).length);
  }
};

/** The ABA check digit (weights 3, 7, 1), as the builder computes it. */
function NS_ABA(s) {
  if (!/^\d{9}$/.test(s) || /^0{9}$/.test(s)) return false;
  const d = s.split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

L.runParts(parts, { name: NAME, unit: 'cases', flag: '--case' });
