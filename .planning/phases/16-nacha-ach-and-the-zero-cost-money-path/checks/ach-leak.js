// gate: node
// last "ACH LEAK: PASS (cases run: 4)"
// AC-13 (F-13, C-09): no tracked file of the portal's product, its server tests or any phase's checks holds a routing
// number a bank can have. No browser.
//   [P16_BASE=<base tree>] node ach-leak.js [--case product,checks,packages,selfcheck]
// The scan rule: in a tracked file under assets/, mobile/src/, server/test/, server/lib/ or .planning/phases/*/checks/,
// a run of exactly 9 digits on a line that also matches ROUTING_WORD, passing the ABA check digit, with a prefix a
// routing number can have (00-12, 21-32, 61-72, 80). Not scanned (named in the NOTE lines): assets/vendor/ and
// assets/forms/ (third-party files pinned by hash) and phase 11's checks/fixtures/bank/real/ (an outside project's two
// published BAI2 samples, copied byte for byte with their SOURCE.txt, kept on purpose: C-09).
// The all-zero number is not a bank's (issued to no one; statement fixtures use it as a blank bank id).
// A copy (16-CONTEXT B3): in a scanned file, the same kind of number on a line with no routing word, when that number is
// a hit elsewhere in the file or its PREFIX_SWAP image is in the file (a swap that missed one copy of the number).
// Everything found is printed as 'file:line ending NNNN', never the whole number.
// Cases:
//   product: the scan over assets/ and mobile/src/ finds nothing; NS.data.fakeRouting drawn 2,000 times from a seeded
//     generator gives only valid check digits and prefixes no bank has.
//   checks: the scan over server/test/, server/lib/ and every phase's checks folder finds nothing (copies included).
//   packages: see packagesCase below (P16_BASE).
//   selfcheck: the scan rule, the copy rule and PREFIX_SWAP proven on planted files in a temporary tree (the planted
//     number is assembled at run time from its parts, so no line of this file holds it); the package rules proven on
//     a copy of this tree; an unknown --case exits 1.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const P11_DIR = '.planning/phases/11-fund-accounting-and-cpa-year-end-package';
const ROUTING_WORD = /routing|odfi|rdfi|immediate|destination|aba|bank/i;

/** The first two digits a routing number can have (Federal Reserve districts, thrifts, electronic, Treasury). */
const ASSIGNED = new Set([]
  .concat(Array.from({ length: 13 }, (_, i) => i))
  .concat(Array.from({ length: 12 }, (_, i) => 21 + i))
  .concat(Array.from({ length: 12 }, (_, i) => 61 + i))
  .concat([80])
  .map((n) => String(n).padStart(2, '0')));

/**
 * PREFIX_SWAP: an assigned prefix -> a prefix no routing number can have with the same (3 x first + 7 x second) mod
 * 10, so the ABA check digit of the whole number, and its last seven digits, stay the same. 00, 61-72 and 80 have no
 * image: swapOf throws for them.
 */
const PREFIX_SWAP = {
  '01': '89', '02': '13', '03': '14', '04': '15', '05': '16', '06': '17', '07': '18', '08': '19', '09': '87', '10': '98',
  '11': '88', '12': '90', '21': '43', '22': '99', '23': '34', '24': '91', '25': '81', '26': '82', '27': '83', '28': '84',
  '29': '85', '30': '96', '31': '20', '32': '54'
};

const ending = (n) => `ending ${String(n).slice(-4)}`;

function abaValid(s) {
  if (!/^\d{9}$/.test(String(s))) return false;
  const d = String(s).split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}
/**
 * A 9-digit string a bank can have as its routing number. The all-zero number is left out: it passes the arithmetic
 * with prefix 00 but is issued to no one (statement fixtures use it as a blank bank id, phase 11's fund-a.ofx/.qfx).
 */
const bankLike = (s) => abaValid(s) && ASSIGNED.has(String(s).slice(0, 2)) && !/^0+$/.test(String(s));

/** The PREFIX_SWAP image of a number (9 digits, or the 8-digit originating-bank prefix of a trace). */
function swapOf(n) {
  n = String(n);
  const img = PREFIX_SWAP[n.slice(0, 2)];
  if (!img) throw new Error(`PREFIX_SWAP has no image for the prefix ${n.slice(0, 2)} (${ending(n)})`);
  return img + n.slice(2);
}

/** The scan's areas and what each leaves out. */
const EXCLUDED = ['assets/vendor/', 'assets/forms/', `${P11_DIR}/checks/fixtures/bank/real/`];
const AREAS = {
  product: (rel) => /^(assets|mobile\/src)\//.test(rel),
  checks: (rel) => /^server\/(test|lib)\//.test(rel) || /^\.planning\/phases\/[^/]+\/checks\//.test(rel)
};
const inArea = (area, rel) => AREAS[area](rel) && !EXCLUDED.some((x) => rel.indexOf(x) === 0);
const NOTE_KEPT = `NOTE kept on purpose (C-09): ${P11_DIR}/checks/fixtures/bank/real/ (sample1.txt, sample2.txt: an outside project's published BAI2 test data, copied byte for byte with SOURCE.txt); not scanned: assets/vendor/ and assets/forms/ (third-party files pinned by hash)`;

/** Tracked files of a checkout (git ls-files), or every file under a plain folder. Relative paths, '/'-separated. */
function filesOf(root) {
  try {
    return execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\0')
      .filter(Boolean)
      .filter((rel) => fs.existsSync(path.join(root, rel)));
  } catch (e) {
    const out = [];
    const walk = (d) =>
      fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach((x) => {
        const rel = d ? `${d}/${x.name}` : x.name;
        if (x.isDirectory()) {
          if (x.name !== '.git' && x.name !== 'node_modules') walk(rel);
        } else if (x.isFile()) out.push(rel);
      });
    walk('');
    return out;
  }
}

/**
 * The scan of one area of a tree. Returns { files, hits: [{ file, line, n }], copies: [{ file, line, n }] }.
 */
function scan(root, area, list) {
  const rels = (list || filesOf(root)).filter((rel) => inArea(area, rel));
  const hits = [];
  const copies = [];
  rels.forEach((rel) => {
    const buf = fs.readFileSync(path.join(root, rel));
    if (buf.slice(0, 8000).indexOf(0) >= 0) return; // a binary file
    const text = buf.toString('utf8');
    const lines = text.split('\n');
    const fileHits = new Set();
    const loose = [];
    lines.forEach((l, i) => {
      const word = ROUTING_WORD.test(l);
      (l.match(/(?<!\d)\d{9}(?!\d)/g) || []).forEach((n) => {
        if (!bankLike(n)) return;
        if (word) {
          hits.push({ file: rel, line: i + 1, n });
          fileHits.add(n);
        } else loose.push({ file: rel, line: i + 1, n });
      });
    });
    const has = (n) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text);
    loose.forEach((c) => {
      let img = null;
      try {
        img = swapOf(c.n);
      } catch (e) {}
      if (fileHits.has(c.n) || (img && has(img))) copies.push(c);
    });
  });
  return { files: rels.length, hits, copies };
}
const where = (x) => `${x.file}:${x.line} ${ending(x.n)}`;
/** Prints every finding on its own line (a check's detail is cut at 1,500 characters), then the check. */
function report(check, name, list) {
  list.forEach((x) => console.log(`  found: ${where(x)}`));
  check(name, !list.length, list.length ? `${list.length} found (listed above)` : undefined);
}

/** brand.js, tenants.js and data.js of a tree's assets/js in a fresh context (the files the mobile app loads too). */
function loadCore(root) {
  const sb = { console };
  sb.window = sb;
  sb.CVPortal = {};
  const ctx = vm.createContext(sb);
  ['brand.js', 'tenants.js', 'data.js'].forEach((f) => {
    const file = path.join(root, 'assets/js', f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  });
  return sb.CVPortal;
}

function child(args, env) {
  const r = spawnSync(process.execPath, [__filename].concat(args), { env: env || process.env, encoding: 'utf8', timeout: 1800000, maxBuffer: 1 << 26 });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

/** The planted bank number: a large national bank's published number, assembled from its parts here. */
function plantedNumber() {
  const first8 = ['0', '2'].join('') + '1000' + '0' + '2';
  const d = first8.split('').map(Number);
  const t = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5]);
  return first8 + String((10 - (t % 10)) % 10);
}

const parts = {
  async product({ check }) {
    console.log('NOTE not scanned: assets/vendor/ and assets/forms/ (third-party files pinned by hash)');
    const s = scan(ROOT, 'product');
    check(`the scan covers assets/ and mobile/src/ (${s.files} files)`, s.files > 0);
    report(check, 'the scan over assets/ and mobile/src/ finds no routing number a bank can have', s.hits);
    report(check, 'no copy of such a number on a line without a routing word', s.copies);
    const NS = loadCore(ROOT);
    const fr = NS.data && NS.data.fakeRouting;
    const R = NS.data && NS.data.rng ? NS.data.rng(16003) : null;
    if (typeof fr !== 'function' || !R) return check('NS.data.fakeRouting and NS.data.rng exist', false);
    const bad = [];
    const prefixes = new Set();
    for (let i = 0; i < 2000; i++) {
      const n = fr(R);
      prefixes.add(String(n).slice(0, 2));
      if (!abaValid(n) || ASSIGNED.has(String(n).slice(0, 2))) bad.push(`draw ${i + 1}: ${ending(n)} prefix ${String(n).slice(0, 2)}${abaValid(n) ? '' : ' (check digit wrong)'}`);
    }
    check(`NS.data.fakeRouting drawn 2,000 times: every number passes the ABA check digit and has a prefix no bank has (${prefixes.size} prefixes drawn)`, !bad.length, bad.slice(0, 10));
  }
};

parts.checks = async function ({ check }) {
  console.log(NOTE_KEPT);
  const s = scan(ROOT, 'checks');
  check(`the scan covers server/test/, server/lib/ and every phase's checks folder (${s.files} files)`, s.files > 0);
  report(check, 'the scan over server/test/, server/lib/ and every phase\'s checks folder finds no routing number a bank can have', s.hits);
  report(check, 'no copy of such a number left on a line without a routing word (a number found in the same file, or one whose swap image is in it)', s.copies);
};

/* ---------- selfcheck ---------- */
parts.selfcheck = async function ({ check }) {
  const u = child(['--case', 'nosuchcase']);
  check(`an unknown --case name: a FAIL line and exit 1 (exit ${u.status})`, u.status === 1 && /^FAIL unknown case name: nosuchcase/m.test(u.out), u.out.slice(-400));
  // PREFIX_SWAP: every assigned prefix but 00, 61-72 and 80 has an image; each image keeps the check digit, is a prefix
  // no bank has, and no two prefixes share one.
  const keys = Object.keys(PREFIX_SWAP);
  const want = Array.from(ASSIGNED).filter((p) => p !== '00' && p !== '80' && !(Number(p) >= 61 && Number(p) <= 72));
  check(`PREFIX_SWAP maps exactly the ${want.length} prefixes 01-12 and 21-32`, keys.sort().join() === want.sort().join(), keys.join());
  const w = (p) => (3 * Number(p[0]) + 7 * Number(p[1])) % 10;
  const badImg = keys.filter((k) => w(k) !== w(PREFIX_SWAP[k]) || ASSIGNED.has(PREFIX_SWAP[k]));
  check('each image keeps (3 x first + 7 x second) mod 10 and is a prefix no bank has', !badImg.length, badImg);
  check('no two prefixes share an image', new Set(keys.map((k) => PREFIX_SWAP[k])).size === keys.length);
  ['00', '61', '72', '80'].forEach((p) => {
    let threw = false;
    try {
      swapOf(p + '1234567');
    } catch (e) {
      threw = /no image/.test(e.message);
    }
    check(`a prefix ${p} has no image: the swap refuses it`, threw);
  });
  const real = plantedNumber();
  const img = swapOf(real);
  check(`the planted number (${ending(real)}) passes the ABA check with a bank's prefix; its image (${ending(img)}) passes it with a prefix no bank has`, bankLike(real) && abaValid(img) && !ASSIGNED.has(img.slice(0, 2)) && img.slice(-7) === real.slice(-7));
  // Planted files in a temporary tree.
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ach-leak-'));
  try {
    const put = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(T, rel)), { recursive: true });
      fs.writeFileSync(path.join(T, rel), text);
    };
    put('assets/js/planted.js', `const x = 1;\nconst bank = { routing: "${real}" };\n`);
    put('assets/js/swapped.js', `const bank = { routing: "${img}" };\n`);
    put('assets/js/zero.js', `const bank = { routing: "${'0'.repeat(9)}" };\n`);
    put('assets/vendor/lib/planted.js', `routing: "${real}"\n`);
    put('assets/forms/x/planted.js', `routing: "${real}"\n`);
    put('mobile/src/core/planted.js', `odfiRouting: '${real}',\n`);
    put('server/test/hit.test.mjs', `const p = { routing: '${real}' };\nconst secrets = ['${real}'];\n`);
    put('server/test/leftover.test.mjs', `const p = { routing: '${img}' };\nconst secrets = ['${real}'];\n`);
    put('server/lib/clean.js', `const p = { routing: '${img}' };\nconst secrets = ['${img}'];\n`);
    put('.planning/phases/99-x/checks/planted.js', `destinationRouting: '${real}'\n`);
    put('.planning/phases/99-x/notes.md', `routing ${real}\n`);
    put(`${P11_DIR}/checks/fixtures/bank/real/sample9.txt`, `bank ${real}\n`);
    const list = filesOf(T);
    const p = scan(T, 'product', list);
    const c = scan(T, 'checks', list);
    const names = (xs) => xs.map((x) => `${x.file}:${x.line}`).sort().join(', ');
    check('product scan of the planted tree: assets/js/planted.js:2 and mobile/src/core/planted.js:1 found, nothing in assets/vendor/ or assets/forms/, neither the swap image nor the all-zero blank found', names(p.hits) === 'assets/js/planted.js:2, mobile/src/core/planted.js:1' && !p.copies.length, names(p.hits));
    check('checks scan of the planted tree: the hit and its copy in hit.test.mjs, the leftover copy beside a swapped number, the phase checks file; nothing in the kept BAI2 folder or outside a checks folder', names(c.hits) === '.planning/phases/99-x/checks/planted.js:1, server/test/hit.test.mjs:1' && names(c.copies) === 'server/test/hit.test.mjs:2, server/test/leftover.test.mjs:2', `${names(c.hits)} | ${names(c.copies)}`);
    const printed = c.hits.concat(c.copies).map(where).join('\n');
    check('a finding is printed with the last four digits only', printed.indexOf(real) < 0 && printed.indexOf(ending(real)) >= 0);
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
  const own = fs.readFileSync(__filename, 'utf8');
  check('this check\'s own text holds no 9-digit number', !/(?<!\d)\d{9}(?!\d)/.test(own));
};

module.exports = { PREFIX_SWAP, ASSIGNED, ROUTING_WORD, abaValid, bankLike, swapOf, scan, filesOf, inArea, ending };

if (require.main === module) L6.runParts(parts, { name: 'ACH LEAK', unit: 'cases', flag: '--case' });
