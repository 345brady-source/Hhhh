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

/* ---------- packages ---------- */
// The sample firms' originating bank numbers feed the trace numbers of their audit packages (audit.js: the first eight
// digits of ach.odfiRouting), so a base tree from before the swap builds packages that differ in those digits. This case
// proves the packages differ from the base ONLY by the swap (16-CONTEXT W1; the expected-difference approach of 11-18):
// with P16_BASE (a base tree), for each sample firm, each offering, editions diy and managed and the presets fy and itd
// at 2026-11-19, every entry of NS.audit.exportPackage, unzipped as audit-same.js unzips, is compared:
//   - substitution on the base side only, digit-bounded: a 9-digit run equal to one of the base's bank-like routing
//     numbers (its sample firms' ach numbers and every sample investor's bank) becomes its PREFIX_SWAP image; the first
//     8 digits of a 15-digit run equal to a base originating-bank prefix become that prefix's image;
//   - an entry equal byte for byte, or equal after substitution, passes; 00_README.txt may differ only in its
//     'Generated:' line (as AUDIT SAME); any other difference is reported;
//   - MANIFEST.sha256: the base's lines in the base's order; a line for an entry judged equal under a rule (substituted,
//     or the README) must be that entry's true SHA-256 in this tree's package (the audit-same.js rule), any other line
//     equal to the base's.
// While the base holds a number PREFIX_SWAP moves, at least one entry must have needed a substitution (the sample
// traces), so the proof is not empty; a base holding none (after this plan merges) is compared as it is.
// Without P16_BASE, or with this checkout as P16_BASE, the case FAILs: it never compares a tree with itself.
const TODAY = '2026-11-19';
const PRESETS = ['fy', 'itd'];
const EDITIONS = ['diy', 'managed'];
const LD = () => require(path.join(ROOT, P11_DIR, 'checks/load11.js'));
const sha = (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
const UNSWAP = Object.keys(PREFIX_SWAP).reduce((m, k) => ((m[PREFIX_SWAP[k]] = k), m), {});

/** Stored or deflated entries, read through the central directory (as audit-same.js). */
function unzip(bytes) {
  const zlib = require('zlib');
  const b = Buffer.from(bytes);
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('no end of central directory record');
  const n = b.readUInt16LE(e + 10);
  let p = b.readUInt32LE(e + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error(`central directory entry ${k} is malformed`);
    const method = b.readUInt16LE(p + 10);
    const csize = b.readUInt32LE(p + 20);
    const nlen = b.readUInt16LE(p + 28);
    const xlen = b.readUInt16LE(p + 30);
    const clen = b.readUInt16LE(p + 32);
    const off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nlen).toString('utf8');
    const lnl = b.readUInt16LE(off + 26);
    const lxl = b.readUInt16LE(off + 28);
    const raw = b.slice(off + 30 + lnl + lxl, off + 30 + lnl + lxl + csize);
    out.push({ name, data: method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null, method });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/** The base's bank-like numbers: { nine: Set of 9-digit routing numbers, eight: Set of originating-bank prefixes }. */
function baseNumbers(wss) {
  const nine = new Set();
  const eight = new Set();
  wss.forEach((ws) => {
    const a = (ws.tenant && ws.tenant.ach) || {};
    [a.odfiRouting, a.destinationRouting, a.offset && a.offset.routing].forEach((n) => bankLike(String(n || '')) && nine.add(String(n)));
    if (bankLike(String(a.odfiRouting || ''))) eight.add(String(a.odfiRouting).slice(0, 8));
    (ws.investors || []).forEach((i) => {
      const r = i.payment && i.payment.bank && i.payment.bank.routing;
      if (bankLike(String(r || ''))) nine.add(String(r));
    });
  });
  return { nine, eight };
}

/** The base-side substitution: (bytes) -> { data, places }. Byte-preserving (latin1). */
function substituter(nums) {
  return (bytes) => {
    let places = 0;
    let t = Buffer.from(bytes).toString('latin1');
    if (nums.eight.size)
      t = t.replace(/(?<!\d)\d{15}(?!\d)/g, (m) => {
        if (!nums.eight.has(m.slice(0, 8))) return m;
        places++;
        return swapOf(m.slice(0, 8)) + m.slice(8);
      });
    if (nums.nine.size)
      t = t.replace(/(?<!\d)\d{9}(?!\d)/g, (m) => {
        if (!nums.nine.has(m)) return m;
        places++;
        return swapOf(m);
      });
    return { data: Buffer.from(t, 'latin1'), places };
  };
}

/**
 * One package pair. A, T = { name, files: [{ name, data }] }. Returns { bad: [reasons], substituted: entries equal
 * only after substitution, places: digit runs substituted in them }.
 */
function comparePackage(A, T, sub) {
  const bad = [];
  let substituted = 0;
  let places = 0;
  if (A.name !== T.name) bad.push(`package name differs (base ${A.name}, tree ${T.name})`);
  const tf = new Map(T.files.map((f) => [f.name, f.data]));
  if (A.files.map((f) => f.name).join('|') !== T.files.map((f) => f.name).join('|')) bad.push(`entries differ: base ${A.files.map((f) => f.name).join(', ')}; tree ${T.files.map((f) => f.name).join(', ')}`);
  const normalized = new Set();
  A.files.forEach((f) => {
    const t = tf.get(f.name);
    if (f.data === null || t === null) return bad.push(`${f.name}: compression method ${f.method} cannot be read`);
    if (t === undefined || f.name === 'MANIFEST.sha256') return;
    if (Buffer.compare(f.data, t) === 0) return;
    if (f.name === '00_README.txt') {
      const strip = (b) => b.toString('utf8').split('\r\n').filter((l) => !/^Generated:/.test(l)).join('\r\n');
      if (strip(f.data) === strip(t)) normalized.add(f.name);
      else bad.push('00_README.txt: a line other than "Generated:" differs');
      return;
    }
    const s = sub(f.data);
    if (s.places && Buffer.compare(s.data, t) === 0) {
      normalized.add(f.name);
      substituted++;
      places += s.places;
      return;
    }
    bad.push(`${f.name}: bytes differ${s.places ? ` after ${s.places} substitution${s.places === 1 ? '' : 's'}` : ''} (base ${sha(f.data).slice(0, 12)}, tree ${sha(t).slice(0, 12)})`);
  });
  const lines = (d) => (d ? d.toString('utf8').split('\n').filter(Boolean) : []);
  const bm = lines(A.files.filter((f) => f.name === 'MANIFEST.sha256').map((f) => f.data)[0]);
  const tm = lines(tf.get('MANIFEST.sha256'));
  if (bm.map((l) => l.slice(66)).join('|') !== tm.map((l) => l.slice(66)).join('|')) bad.push('MANIFEST.sha256: its entries are not the base\'s, in the base\'s order');
  bm.forEach((l, i) => {
    const name = l.slice(66);
    const tl = tm[i];
    if (tl === undefined) return;
    if (normalized.has(name)) {
      if (!tf.has(name) || tl !== `${sha(tf.get(name))}  ${name}`) bad.push(`MANIFEST.sha256: the line for ${name} is not that entry's SHA-256`);
    } else if (tl !== l) bad.push(`MANIFEST.sha256: the line for ${name} differs`);
  });
  return { bad, substituted, places };
}

/** Scripts this tree's diy.html lists after operations.js that the base's diy.html does not list (as AUDIT SAME). */
function treeExtras(base) {
  const t = LD().listedScripts(ROOT);
  const b = LD().listedScripts(base);
  return t.slice(t.indexOf('operations.js') + 1).filter((f) => b.indexOf(f) < 0);
}
const clone = (NS, ws) => (NS.util && NS.util.clone ? NS.util.clone(ws) : JSON.parse(JSON.stringify(ws)));
function exportOf(NS, ws, o, p) {
  const X = NS.audit.exportPackage(clone(NS, ws), o, p.from, p.to);
  return { name: X.name, files: unzip(X.bytes) };
}

/**
 * Every sample package of one edition, base against tree. opts: { firm, unswapBase (the base side's sample firms'
 * ach numbers moved back to bank prefixes in memory, for the self-check), mutateTree(NS, ws) -> description,
 * editTree(where, files) -> files }. Returns { packages, substituted, places, nums, mismatches, mutated }.
 */
function compareTrees(base, edition, opts) {
  opts = opts || {};
  const A = LD().loadPortal(base, { today: TODAY, edition });
  if (opts.unswapBase)
    A.TENANTS.filter((t) => t.sample).forEach((t) => {
      const a = t.ach;
      ['odfiRouting', 'destinationRouting'].forEach((k) => (a[k] = UNSWAP[String(a[k]).slice(0, 2)] + String(a[k]).slice(2)));
      a.offset.routing = UNSWAP[String(a.offset.routing).slice(0, 2)] + String(a.offset.routing).slice(2);
    });
  const T = LD().loadPortal(ROOT, { today: TODAY, edition, extra: treeExtras(base) });
  const pick = (wss) => wss.filter((w) => !opts.firm || w.tenant.id === opts.firm);
  const wa = pick(LD().sampleWorkspaces(A));
  const wt = pick(LD().sampleWorkspaces(T));
  const r = { packages: 0, substituted: 0, places: 0, nums: baseNumbers(wa), mismatches: [], mutated: [] };
  if (opts.mutateTree) {
    wt.forEach((ws) => {
      const c = opts.mutateTree(T, ws);
      if (c) r.mutated.push(c);
    });
    if (T.clearCaches) T.clearCaches();
  }
  const sub = substituter(r.nums);
  if (!wa.length || wa.length !== wt.length) r.mismatches.push(`sample firms: base ${wa.length}, tree ${wt.length}`);
  wa.forEach((a) => {
    const t = wt.find((w) => w.tenant.id === a.tenant.id);
    if (!t) return r.mismatches.push(`${a.tenant.id}: not a sample firm in this tree`);
    if (a.offerings.map((o) => o.id).join() !== t.offerings.map((o) => o.id).join()) r.mismatches.push(`${a.tenant.id}: offerings differ`);
    a.offerings.forEach((oa) => {
      const ot = t.offerings.find((o) => o.id === oa.id);
      if (!ot) return;
      PRESETS.forEach((id) => {
        const pa = A.audit.presets(a, oa).find((p) => p.id === id);
        const pt = T.audit.presets(t, ot).find((p) => p.id === id);
        const at = `${edition} ${oa.id} ${id}`;
        if (JSON.stringify(pa) !== JSON.stringify(pt)) return r.mismatches.push(`${at}: preset differs`);
        const xa = exportOf(A, a, oa, pa);
        const xt = exportOf(T, t, ot, pt);
        if (opts.editTree) xt.files = opts.editTree(at, xt.files);
        r.packages++;
        const c = comparePackage(xa, xt, sub);
        r.substituted += c.substituted;
        r.places += c.places;
        if (c.bad.length) r.mismatches.push(`${at}: ${c.bad.join('; ')}`);
      });
    });
  });
  return r;
}

function baseTree() {
  const b = process.env.P16_BASE;
  if (!b) return { why: 'P16_BASE is not set' };
  if (!fs.existsSync(path.join(b, 'assets/js/audit.js')) || !fs.existsSync(path.join(b, 'diy.html'))) return { why: `P16_BASE (${b}) holds no assets/js/audit.js or diy.html` };
  if (fs.realpathSync(b) === fs.realpathSync(ROOT)) return { why: `P16_BASE (${b}) is this checkout` };
  return { root: path.resolve(b) };
}

parts.packages = async function ({ check }) {
  const B = baseTree();
  if (!B.root) return check(`a base tree to compare with: ${B.why}; this case never compares a tree with itself`, false);
  check(`base tree ${B.root}; this tree's page adds after operations.js: ${treeExtras(B.root).join(', ') || 'nothing'}`, true);
  let moved = 0;
  EDITIONS.forEach((ed) => {
    const r = compareTrees(B.root, ed);
    moved = Math.max(moved, r.nums.nine.size + r.nums.eight.size);
    r.mismatches.forEach((m) => console.log(`  differs: ${m.slice(0, 600)}`));
    check(`${ed}: every entry of the ${r.packages} sample packages equals the base's, the swapped prefixes aside (${r.substituted} entries needed the swap, ${r.places} digit runs)`, r.packages > 0 && !r.mismatches.length, r.mismatches.length ? `${r.mismatches.length} packages differ (listed above)` : undefined);
    if (r.nums.nine.size + r.nums.eight.size) check(`${ed}: the base holds ${r.nums.nine.size} bank-like routing numbers and ${r.nums.eight.size} originating prefixes; at least one entry needed the swap, so the proof is not empty`, r.substituted > 0);
  });
  if (!moved) console.log('NOTE the base holds no number PREFIX_SWAP moves: its packages are compared as they are');
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
  packageRules(check);
  const own = fs.readFileSync(__filename, 'utf8');
  check('this check\'s own text holds no 9-digit number', !/(?<!\d)\d{9}(?!\d)/.test(own));
};

/** The newest paid distribution of an offering, one cent larger (as audit-same.js addCent). */
function addCent(offeringId) {
  return (NS, ws) => {
    const run = (ws.runs || [])
      .filter((x) => x.offeringId === offeringId && x.date <= TODAY && x.status === 'paid' && !x.cancelled)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
    if (!run) return null;
    const lines = Array.isArray(run.lines) && run.lines.length;
    if (lines) {
      run.lines[0].grossCents += 1;
      run.lines[0].netCents += 1;
    }
    run.total += 1;
    return `${run.id} (${lines ? 'first stored line and total' : 'total'} one cent larger)`;
  };
}

/**
 * W1: the package rules proven on a copy of this tree (diy.html and assets/js copied to a temporary folder) whose
 * sample firms' ach numbers are moved back to bank prefixes in memory, as the base before this plan held them (nothing
 * holding a bank's number is written to disk). Kestrel Bay, edition diy, both presets.
 */
function packageRules(check) {
  const C = fs.mkdtempSync(path.join(os.tmpdir(), 'ach-leak-tree-'));
  try {
    fs.copyFileSync(path.join(ROOT, 'diy.html'), path.join(C, 'diy.html'));
    fs.cpSync(path.join(ROOT, 'assets/js'), path.join(C, 'assets/js'), { recursive: true });
    const firm = 'kestrel-bay';
    const base = { firm, unswapBase: true };
    const r0 = compareTrees(C, 'diy', base);
    check(`allowed: the copy with its moved prefixes put back: ${r0.packages} packages equal after the swap (${r0.substituted} entries, ${r0.places} digit runs substituted)`, r0.packages > 0 && r0.substituted > 0 && !r0.mismatches.length, r0.mismatches.slice(0, 3));
    const r1 = compareTrees(C, 'diy', Object.assign({ mutateTree: addCent('kb-fund-ii') }, base));
    check(`reported: one cent on a sample fund (${r1.mutated.join(', ') || 'nothing changed'})`, r1.mutated.length === 1 && r1.mismatches.some((m) => /^diy kb-fund-ii /.test(m)), r1.mismatches.slice(0, 3));
    // Edits of the tree's kb-fund-ii itd package: an entry holding traces, its MANIFEST line kept true unless the edit
    // is the MANIFEST line itself, so only the rule under test can report it.
    const edit = (fn, manifest) => {
      let done = '';
      const editTree = (at, files) => {
        if (done || at !== 'diy kb-fund-ii itd') return files;
        const k = files.findIndex((f) => f.name !== 'MANIFEST.sha256' && /(?<!\d)\d{15}(?!\d)/.test(f.data.toString('latin1')));
        if (k < 0) return files;
        const name = files[k].name;
        const data = manifest ? files[k].data : Buffer.from(fn(files[k].data.toString('latin1')), 'latin1');
        done = name;
        return files.map((f, i) => {
          if (i === k) return { name, data, method: f.method };
          if (f.name !== 'MANIFEST.sha256') return f;
          const ls = f.data.toString('utf8').split('\n').map((l) => (l.slice(66) === name ? (manifest ? '0'.repeat(64) : sha(data)) + '  ' + name : l));
          return { name: f.name, data: Buffer.from(ls.join('\n'), 'utf8'), method: f.method };
        });
      };
      return { editTree, done: () => done };
    };
    const lastDigit = edit((t) => t.replace(/(?<!\d)(\d{14})(\d)(?!\d)/, (m, a, d) => a + String((Number(d) + 1) % 10)));
    const r2 = compareTrees(C, 'diy', Object.assign({ editTree: lastDigit.editTree }, base));
    check(`reported: one non-prefix trace digit changed (the last digit of the first trace in ${lastDigit.done() || 'no entry'})`, !!lastDigit.done() && r2.mismatches.some((m) => /^diy kb-fund-ii itd: /.test(m) && m.indexOf(lastDigit.done()) >= 0), r2.mismatches.slice(0, 3));
    const otherPrefix = edit((t) => t.replace(/(?<!\d)(\d{2})(\d{13})(?!\d)/g, (m, p, rest) => (p === '55' ? '56' : '55') + rest));
    const r3 = compareTrees(C, 'diy', Object.assign({ editTree: otherPrefix.editTree }, base));
    check(`reported: the traces' prefix moved to a prefix that is not the swap image (in ${otherPrefix.done() || 'no entry'})`, !!otherPrefix.done() && r3.mismatches.some((m) => /^diy kb-fund-ii itd: /.test(m) && m.indexOf(otherPrefix.done()) >= 0), r3.mismatches.slice(0, 3));
    const staleLine = edit(null, true);
    const r4 = compareTrees(C, 'diy', Object.assign({ editTree: staleLine.editTree }, base));
    check(`reported: a substituted entry whose MANIFEST line is not its SHA-256 (${staleLine.done() || 'no entry'})`, !!staleLine.done() && r4.mismatches.some((m) => /^diy kb-fund-ii itd: /.test(m) && m.indexOf(`MANIFEST.sha256: the line for ${staleLine.done()} is not`) >= 0), r4.mismatches.slice(0, 3));
  } finally {
    fs.rmSync(C, { recursive: true, force: true });
  }
}

/** The hash of a base tree's diy.html and assets/js, for the kept-part key. */
function baseHash(root) {
  const h = crypto.createHash('sha256');
  const files = ['diy.html'].concat(fs.readdirSync(path.join(root, 'assets/js')).sort().map((f) => `assets/js/${f}`));
  files.forEach((f) => {
    const p = path.join(root, f);
    if (fs.statSync(p).isFile()) h.update(f + '\0').update(fs.readFileSync(p));
  });
  return h.digest('hex');
}

module.exports = { PREFIX_SWAP, ASSIGNED, ROUTING_WORD, abaValid, bankLike, swapOf, scan, filesOf, inArea, ending };

if (require.main === module) {
  // The packages case depends on P16_BASE, which runParts' kept-part key does not hold: the base's path and the hash of
  // its diy.html and assets/js go on the command line the key is made from, so a result is kept only for that base.
  const B = baseTree();
  if (B.root) process.argv.push('--p16-base', `${fs.realpathSync(B.root)}:${baseHash(B.root)}`);
  L6.runParts(parts, { name: 'ACH LEAK', unit: 'cases', flag: '--case' });
}
