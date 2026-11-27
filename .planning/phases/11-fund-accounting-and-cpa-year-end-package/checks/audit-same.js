// gate: node
// last "AUDIT SAME: PASS (cases run: 4)"
// T9 of 11-RESEARCH.md, the one definition of "sample funds unchanged" for phase 11 (FA-03): every sample fund's audit
// package, built by the base tree (P11_ROOT) and by this checkout, compared byte for byte. No browser.
//   P11_ROOT=<base tree> node audit-same.js [--case same,mutate,noroot,selfcheck] [--firm <tenant id>]
// For each sample firm, each offering, each edition (diy, managed) and the presets 'fy' and 'itd' of NS.audit.presets
// at 2026-11-19:
//   - every schedule the base's NS.audit.build(...).list holds is in this tree's list with the same id, and its
//     NS.audit.toCsv text has the same SHA-256 (schedule 'checks': only rows whose first cell is a title the base's
//     rows hold);
//   - NS.audit.period(...).fund is JSON-equal;
//   - NS.audit.exportPackage on a deep copy of each side's workspace, unzipped here: every entry byte-identical,
//     except entries for schedules the base does not have, the "Generated:" line of 00_README.txt, the README and
//     MANIFEST lines for those entries, and the rows and README lines a readiness check the base does not have adds
//     (11-CONTEXT W4).
// The one expected difference (plan 11-18, the businessDays fix): before it, every seeded sample call was noticed on
// its due date. For each base firm, every base call with status complete whose notice date equals its due date is
// expected in this tree noticed ten Monday-to-Friday days earlier (this check's own count), with nothing else in the
// calls changed; its 'Capital call issued' change-log row carries the new date, and the log's Seq, Previous hash and
// Hash are recomputed here from the base's own entries with the chain rule (proven on the base's hashes), since the
// log is a hash chain sorted by time. Every byte of the tree's log, its 15_Change_log.csv entries and their MANIFEST
// lines is compared with that exact expectation. With no such base call the rule is off and everything is compared
// as above; a moved row entering or leaving a period is reported, not allowed.
// Each side runs what its own page runs: load11 with books on, so the scripts that side's diy.html lists after
// operations.js that build NS.books (books.js, books-post.js) load on that side, from that side's files, in its page's
// order. build() then syncs every fund's journal (11-12 B1) and the schedules built from the journal (20 to 24) are
// compared like every other; on a base that predates them they are schedules the base does not have.
// Without P11_ROOT (or with this checkout as P11_ROOT) it prints FAIL and exits 1: it never compares a tree with itself.
// Cases: same (the above; then the first edition again in fresh contexts must give the same hashes, I1), mutate (one
// cent on kb-fund-ii's newest paid distribution must be reported, W7), noroot (the refusal above, as child processes),
// selfcheck (the --case flag's rules, the package rules proven on packages rebuilt from one real export, the moved-notice
// rule, and one cent in kb-fund-ii's journal reported when this tree is compared with itself).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
// The loader is required inside each case, so a missing or broken loader is a FAIL line of that case.
const LD = () => require('./load11.js');

const TODAY = '2026-11-19';
const PRESETS = ['fy', 'itd'];
const EDITIONS = ['diy', 'managed'];
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2);
const FIRM = argv.indexOf('--firm') >= 0 ? String(argv[argv.indexOf('--firm') + 1] || '') : '';
const sha = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x)).digest('hex');

/** The base tree, or a FAIL line and exit 1. */
function baseRoot() {
  const b = process.env.P11_ROOT;
  if (!b || !fs.existsSync(path.join(b, 'assets/js/audit.js')) || !fs.existsSync(path.join(b, 'diy.html'))) {
    console.log(`FAIL no base tree: P11_ROOT ${b ? `(${b}) holds no assets/js/audit.js or diy.html` : 'is not set'}; this check never compares a tree with itself`);
    console.log('AUDIT SAME: FAIL (cases run: 0) - no base tree');
    process.exit(1);
  }
  if (fs.realpathSync(b) === fs.realpathSync(ROOT)) {
    console.log(`FAIL no base tree: P11_ROOT (${b}) is this checkout; this check never compares a tree with itself`);
    console.log('AUDIT SAME: FAIL (cases run: 0) - no base tree');
    process.exit(1);
  }
  return path.resolve(b);
}

/**
 * Scripts this tree's diy.html lists after operations.js that the base tree's diy.html does not list at all (a module
 * a later plan adds to the page after operations.js, for example books.js): the tree side loads them too, so the
 * comparison runs what the page runs. Derived from the two pages, never typed.
 */
function treeExtras(base) {
  const t = LD().listedScripts(ROOT);
  const b = LD().listedScripts(base);
  const k = t.indexOf('operations.js');
  return t.slice(k + 1).filter((f) => b.indexOf(f) < 0);
}

/* ---------- unzip (stored or deflated entries, read through the central directory) ---------- */
function unzip(bytes) {
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

/* ---------- CSV rows (quote-aware), for the 'checks' schedule's file ---------- */
function csvRecords(text) {
  // Records as their exact source text, so a kept record is compared byte for byte.
  const recs = [];
  let q = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') q = !q;
    else if (!q && c === '\r' && text[i + 1] === '\n') {
      recs.push(text.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  if (start < text.length) recs.push(text.slice(start));
  return recs;
}
function firstCell(rec) {
  let s = rec.replace(/^\uFEFF/, '');
  if (s[0] !== '"') return s.split(',')[0];
  let v = '';
  for (let i = 1; i < s.length; i++) {
    if (s[i] === '"' && s[i + 1] === '"') {
      v += '"';
      i++;
    } else if (s[i] === '"') break;
    else v += s[i];
  }
  return v;
}

/* ---------- 11-18: the moved notices, the one expected difference, built from the base ---------- */
const GENESIS = '0'.repeat(64);
const LOG_FIELDS = ['seq', 'at', 'actor', 'action', 'fund', 'record', 'detail', 'hash'];
/** n Monday-to-Friday days before iso, one UTC calendar day at a time (this check's own count, never NS.ops). */
function weekdaysBack(iso, n) {
  let t = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  for (let k = 0; k < n; ) {
    t -= 864e5;
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) k++;
  }
  return new Date(t).toISOString().slice(0, 10);
}
const tenBack = (iso) => weekdaysBack(iso, 10);
/** The change log's chain rule (audit.js entryText): seq = place + 1, hash = SHA-256 of the previous hash and the entry. */
function chainOf(list) {
  let prev = GENESIS;
  list.forEach((e, i) => {
    e.seq = i + 1;
    e.hash = sha([prev, e.seq, e.at, e.actor, e.action, e.fund || '', e.record || '', e.detail || ''].join('|'));
    prev = e.hash;
  });
  return list;
}
/**
 * The expected difference for one base firm: every base call with status complete whose notice equals its due date
 * moves to ten business days before it is due. null when there is none (the rule is off). Otherwise { moves, calls (the
 * base's calls as JSON with the moved notices), E (the base's log with the moved rows' dates, sorted and rechained),
 * bySeq (base seq -> E entry), problems }.
 */
function firmExpect(NSa, wa) {
  const all = wa.calls || [];
  const moves = all.filter((c) => c.status === 'complete' && c.noticeDate === c.due).map((c) => ({ id: c.id, offeringId: c.offeringId, due: c.due, from: c.noticeDate, to: tenBack(c.due) }));
  if (!moves.length) return null;
  const by = new Map(moves.map((m) => [m.id, m]));
  const calls = JSON.stringify(all.map((c) => (by.has(c.id) ? Object.assign({}, c, { noticeDate: by.get(c.id).to }) : c)));
  const log = NSa.audit.ensureLog(wa);
  const problems = [];
  const re = chainOf(log.map((e) => Object.assign({}, e)));
  const broken = re.findIndex((e, i) => e.seq !== log[i].seq || e.hash !== log[i].hash);
  if (broken >= 0) problems.push(`the chain rule does not reproduce the base's hash at seq ${broken + 1}`);
  moves.forEach((m) => {
    const rows = log.filter((e) => e.action === 'Capital call issued' && e.record === m.id);
    if (rows.length !== 1 || rows[0].at.slice(0, 10) !== m.from) problems.push(`${m.id}: ${rows.length} base entries with action 'Capital call issued' (${rows.map((e) => e.at).join(', ')}); one dated ${m.from} expected`);
  });
  const E = log.map((e) => {
    const c = Object.assign({}, e, { baseSeq: e.seq });
    const m = e.action === 'Capital call issued' && by.get(e.record);
    if (m) {
      c.at = m.to + e.at.slice(10);
      c.moved = m.id;
    }
    return c;
  });
  E.filter((e) => e.moved).forEach((e) => {
    if (E.some((x) => x !== e && x.at === e.at)) problems.push(`${e.moved}: its moved time ${e.at} equals another entry's; the order would depend on how the log was generated`);
  });
  E.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)); // seedLog's comparator; Array sort is stable
  chainOf(E);
  const bySeq = new Map(E.map((e) => [e.baseSeq, e]));
  return { moves, calls, E, bySeq, problems };
}
/** This tree's firm against the expected difference: mismatch strings (empty when it is exactly that). */
function firmCheck(X, NSt, wt) {
  const out = X.problems.slice();
  const tc = wt.calls || [];
  X.moves.forEach((m) => {
    const c = tc.find((x) => x.id === m.id);
    const n = c ? c.noticeDate : '(no such call)';
    if (n !== m.to) out.push(`calls: ${m.id} notice ${n}, expected ${m.to}`);
  });
  const by = new Map(X.moves.map((m) => [m.id, m]));
  const norm = tc.map((c) => (by.has(c.id) ? Object.assign({}, c, { noticeDate: by.get(c.id).to }) : c));
  if (JSON.stringify(norm) !== X.calls) {
    const xa = JSON.parse(X.calls);
    let k = 0;
    while (k < Math.max(xa.length, norm.length) && JSON.stringify(xa[k]) === JSON.stringify(norm[k])) k++;
    out.push(`calls: ${(norm[k] || xa[k] || {}).id || `entry ${k + 1}`} differs beyond the moved notices`);
  }
  const lt = NSt.audit.ensureLog(wt);
  if (lt.length !== X.E.length) out.push(`change log: ${lt.length} entries, expected ${X.E.length}`);
  for (let i = 0; i < Math.min(lt.length, X.E.length); i++) {
    const f = LOG_FIELDS.find((k) => lt[i][k] !== X.E[i][k]);
    if (f) {
      out.push(`change log: seq ${i + 1} ${f} differs from the expected`);
      break;
    }
  }
  return out;
}
/**
 * The base's 'log' schedule s (fund o, period P) as the expected difference makes it: the same entries (by base seq)
 * with their new Seq, Timestamp, Previous hash and Hash, written by the base's own toCsv. { csv } or { bad } when a
 * moved row would enter or leave the period (not in the expected list).
 */
function expectedLog(NSa, s, X, P, o) {
  const inP = (d) => d >= P.from && d <= P.to;
  const cross = X.moves.filter((m) => m.offeringId === o.id && inP(m.from) !== inP(m.to));
  if (cross.length) return { bad: cross.map((m) => `${m.id} (${m.from} -> ${m.to}) crosses ${P.from} to ${P.to}`).join('; ') + '; a row entering or leaving a period is not in the expected list' };
  const lost = s.rows.filter((r) => !X.bySeq.has(r[0]));
  if (lost.length) return { bad: `base rows ${lost.map((r) => r[0]).join(', ')} are not in the base's log` };
  const rows = s.rows
    .map((r) => X.bySeq.get(r[0]))
    .sort((a, b) => a.seq - b.seq)
    .map((e) => [e.seq, e.at, e.actor, e.action, e.record, e.detail, e.seq > 1 ? X.E[e.seq - 2].hash : GENESIS, e.hash]);
  return { csv: NSa.audit.toCsv(Object.assign({}, s, { rows })) };
}

/**
 * W4: the two exported zips. base/tree = { bytes, files: [{ name, data }] from unzip, B: build }. Returns mismatch
 * strings (empty when the packages agree under the rules above). expect (11-18, optional): Map(entry name -> the bytes
 * the expected difference gives); such an entry must be exactly those bytes, and its MANIFEST line its true SHA-256.
 */
function compareZip(base, tree, expect) {
  const bad = [];
  if (!expect && Buffer.compare(Buffer.from(base.bytes), Buffer.from(tree.bytes)) === 0) return bad;
  const bf = new Map(base.files.map((f) => [f.name, f.data]));
  const tf = new Map(tree.files.map((f) => [f.name, f.data]));
  const baseSchedFiles = new Set(base.B.list.map((s) => s.file));
  const newFiles = tree.B.list.map((s) => s.file).filter((f) => !baseSchedFiles.has(f));
  const baseTitles = new Set(base.B.chk.map((c) => c.title));
  const newChecks = tree.B.chk.filter((c) => !baseTitles.has(c.title));
  const chkS = (B) => B.list.find((s) => s.id === 'checks');
  const checksFile = chkS(base.B) ? chkS(base.B).file : null;
  // Entries: every base entry present, in the base's order; any other entry is a schedule the base lacks.
  const order = tree.files.map((f) => f.name).filter((n) => bf.has(n));
  if (order.join('|') !== base.files.map((f) => f.name).join('|')) bad.push(`entry order differs: base ${base.files.map((f) => f.name).join(', ')}; tree ${order.join(', ')}`);
  tree.files.forEach((f) => {
    if (!bf.has(f.name) && newFiles.indexOf(f.name) < 0) bad.push(`entry ${f.name} is in this tree's package only and is not a schedule the base lacks`);
  });
  base.files.forEach((f) => {
    if (f.data === null) bad.push(`entry ${f.name}: compression method ${f.method} cannot be read`);
  });
  const normalized = new Set(); // entries judged equal under a rule, not byte for byte
  for (const f of base.files) {
    const t = tf.get(f.name);
    if (!t) {
      bad.push(`entry ${f.name} is missing from this tree's package`);
      continue;
    }
    if (f.name === 'MANIFEST.sha256') continue;
    if (expect && expect.has(f.name)) {
      const x = expect.get(f.name);
      if (Buffer.compare(Buffer.from(x), t) === 0) normalized.add(f.name);
      else bad.push(`${f.name}: not the bytes the expected difference gives (base ${sha(f.data).slice(0, 12)}, expected ${sha(x).slice(0, 12)}, tree ${sha(t).slice(0, 12)})`);
      continue;
    }
    if (Buffer.compare(f.data, t) === 0) continue;
    if (f.name === '00_README.txt') {
      const why = compareReadme(f.data.toString('utf8'), t.toString('utf8'), { newFiles, newChecks, checksFile, extraRows: newCheckRows(base.B, tree.B) });
      if (why) bad.push(`00_README.txt: ${why}`);
      else normalized.add(f.name);
      continue;
    }
    if (f.name === checksFile) {
      const keep = new Set(csvRecords(f.data.toString('utf8')).slice(1).map(firstCell));
      const tr = csvRecords(t.toString('utf8'));
      const kept = [tr[0]].concat(tr.slice(1).filter((r) => keep.has(firstCell(r))));
      if (kept.join('\r\n') === csvRecords(f.data.toString('utf8')).join('\r\n')) normalized.add(f.name);
      else bad.push(`${f.name}: the rows the base holds differ`);
      continue;
    }
    bad.push(`${f.name}: bytes differ (base ${sha(f.data).slice(0, 12)}, tree ${sha(t).slice(0, 12)})`);
  }
  // MANIFEST: the base's lines, in order, equal; a line for an entry judged equal under a rule, or a new schedule, must
  // be that entry's true SHA-256 in this tree's package.
  const lines = (d) => (d ? d.toString('utf8').split('\n').filter(Boolean) : []);
  const bm = lines(bf.get('MANIFEST.sha256'));
  const tm = lines(tf.get('MANIFEST.sha256'));
  const tmBy = new Map(tm.map((l) => [l.slice(66), l]));
  bm.forEach((l) => {
    const name = l.slice(66);
    const tl = tmBy.get(name);
    if (!tl) bad.push(`MANIFEST.sha256: no line for ${name}`);
    else if (normalized.has(name)) {
      if (tl !== `${sha(tf.get(name))}  ${name}`) bad.push(`MANIFEST.sha256: the line for ${name} is not that entry's SHA-256`);
    } else if (tl !== l) bad.push(`MANIFEST.sha256: the line for ${name} differs`);
  });
  tm.forEach((l) => {
    const name = l.slice(66);
    if (bm.some((x) => x.slice(66) === name)) return;
    if (newFiles.indexOf(name) < 0) bad.push(`MANIFEST.sha256: a line for ${name}, which is not a schedule the base lacks`);
    else if (l !== `${sha(tf.get(name))}  ${name}`) bad.push(`MANIFEST.sha256: the line for ${name} is not that entry's SHA-256`);
  });
  if (tm.map((l) => l.slice(66)).filter((n) => bf.has(n)).join('|') !== bm.map((l) => l.slice(66)).join('|')) bad.push('MANIFEST.sha256: the base entries are not in the base order');
  return bad;
}
/** Rows of this tree's 'checks' schedule whose first cell the base's rows do not hold. */
function newCheckRows(bB, tB) {
  const b = bB.list.find((s) => s.id === 'checks');
  const t = tB.list.find((s) => s.id === 'checks');
  if (!b || !t) return 0;
  const keep = new Set(b.rows.map((r) => String(r[0])));
  return t.rows.filter((r) => !keep.has(String(r[0]))).length;
}
/**
 * The README: the base's lines (without "Generated:") must appear in this tree's README in the same order. A line only
 * this tree holds is allowed when it names a schedule the base lacks (CONTENTS), is a READINESS line or exception of a
 * readiness check the base lacks, or is the exceptions heading (and its blank line) when the base had none. The
 * CONTENTS line of the 'checks' file may differ only by the rows those new checks add. Returns '' or the reason.
 */
function compareReadme(bt, tt, x) {
  const gen = (l) => /^Generated:/.test(l);
  const B = bt.split('\r\n').filter((l) => !gen(l));
  const T = tt.split('\r\n').filter((l) => !gen(l));
  const baseHasHead = B.indexOf('Exceptions to resolve before fieldwork:') >= 0;
  const items = new Map();
  x.newChecks.forEach((c) => c.items.forEach((it) => items.set(`  - ${it}`, (items.get(`  - ${it}`) || 0) + 1)));
  const extra = (l) => {
    if (x.newFiles.some((f) => l.indexOf(f.padEnd(48) + ' ') === 0)) return true;
    const m = l.match(/^\[(PASS| N\/A|OPEN)\] (.*)$/);
    if (m && x.newChecks.some((c) => m[2] === c.title || m[2].indexOf(c.title + ' (') === 0)) return true;
    if (items.get(l) > 0) {
      items.set(l, items.get(l) - 1);
      return true;
    }
    return !baseHasHead && (l === 'Exceptions to resolve before fieldwork:' || l === '');
  };
  const rowsLine = (l) => (x.checksFile && l.indexOf(x.checksFile.padEnd(48) + ' ') === 0 ? l.match(/^(.*)\((\d+) rows?\)$/) : null);
  let i = 0;
  let j = 0;
  while (i < B.length) {
    if (j >= T.length) return `the base line "${B[i]}" is missing`;
    if (B[i] === T[j]) {
      i++;
      j++;
      continue;
    }
    const rb = rowsLine(B[i]);
    const rt = rowsLine(T[j]);
    if (rb && rt && rb[1] === rt[1] && Number(rt[2]) === Number(rb[2]) + x.extraRows) {
      i++;
      j++;
      continue;
    }
    if (extra(T[j])) {
      j++;
      continue;
    }
    return `the base line "${B[i]}" became "${T[j]}"`;
  }
  for (; j < T.length; j++) if (!extra(T[j])) return `a line only this tree holds: "${T[j]}"`;
  return '';
}

/* ---------- one side: the portal, its sample workspaces ---------- */
/** A portal of root with its page's books scripts (load11 books: true), the way every part of this check loads one. */
const portal = (root, edition, extra) => LD().loadPortal(root, { today: TODAY, edition, extra, books: true });
function side(root, edition, extra, firm) {
  const NS = portal(root, edition, extra);
  const only = firm || FIRM;
  const wss = LD().sampleWorkspaces(NS).filter((ws) => !only || ws.tenant.id === only);
  return { NS, wss };
}
const clone = (NS, ws) => NS.util && NS.util.clone ? NS.util.clone(ws) : JSON.parse(JSON.stringify(ws));
/** Everything compared for one fund and one period on one side. */
function measure(NS, ws, o, p) {
  const B = NS.audit.build(ws, o, p.from, p.to);
  const sched = new Map(B.list.map((s) => [s.id, { s, csv: NS.audit.toCsv(s) }]));
  const fund = JSON.stringify(NS.audit.period(ws, o, p.from, p.to).fund);
  return { B, sched, fund };
}
function exportOf(NS, ws, o, p) {
  const X = NS.audit.exportPackage(clone(NS, ws), o, p.from, p.to);
  return { bytes: X.bytes, files: unzip(X.bytes), B: X.build, name: X.name };
}

/**
 * The comparison over every sample fund of both sides in one edition. mutate(NS, ws) changes the tree side's
 * workspaces before anything is built. Returns { funds, schedules, zips, same, mismatches, hashes }.
 */
function compare(base, edition, mutate, firm) {
  const extra = treeExtras(base);
  const A = side(base, edition, [], firm);
  const T = side(ROOT, edition, extra, firm);
  const changed = [];
  if (mutate) {
    T.wss.forEach((ws) => {
      const c = mutate(T.NS, ws);
      if (c) changed.push(c);
    });
    if (T.NS.clearCaches) T.NS.clearCaches();
  }
  const r = { funds: 0, schedules: 0, zips: 0, zipsWhole: 0, mismatches: [], found: [], hashes: [], mutated: [], moves: [], treeOnly: new Set(), sides: { base: A.NS.__load11.files, tree: T.NS.__load11.files, baseBooks: !!(A.NS.books && A.NS.books.sync), treeBooks: !!(T.NS.books && T.NS.books.sync) } };
  r.mutated = changed;
  if (A.wss.length !== T.wss.length || !A.wss.length) r.mismatches.push(`sample firms: base ${A.wss.length}, tree ${T.wss.length}`);
  A.wss.forEach((wa) => {
    const wt = T.wss.find((w) => w.tenant.id === wa.tenant.id);
    if (!wt) return r.mismatches.push(`${wa.tenant.id}: not a sample firm in this tree`);
    // 11-18: the moved notices of this firm, built from the base side only (null: everything compared exactly).
    const X = firmExpect(A.NS, wa);
    if (X) {
      firmCheck(X, T.NS, wt).forEach((l) => r.mismatches.push(`${edition} ${wa.tenant.id}: ${l}`));
      r.moves.push({ firm: wa.tenant.id, moves: X.moves });
    }
    wa.offerings.forEach((oa) => {
      const ot = wt.offerings.find((o) => o.id === oa.id);
      if (!ot) return r.mismatches.push(`${oa.id}: missing in this tree`);
      r.funds++;
      const pa = A.NS.audit.presets(wa, oa);
      const pt = T.NS.audit.presets(wt, ot);
      PRESETS.forEach((id) => {
        const a = pa.find((p) => p.id === id);
        const t = pt.find((p) => p.id === id);
        const where = `${edition} ${oa.id} ${id}`;
        if (JSON.stringify(a) !== JSON.stringify(t)) return r.mismatches.push(`${where}: preset differs (base ${JSON.stringify(a)}, tree ${JSON.stringify(t)})`);
        const ma = measure(A.NS, wa, oa, a);
        const mt = measure(T.NS, wt, ot, t);
        const diff = [];
        let expect = null;
        if (ma.fund !== mt.fund) diff.push('period fund');
        mt.sched.forEach((v, sid) => ma.sched.has(sid) || r.treeOnly.add(sid));
        ma.sched.forEach((v, sid) => {
          const w = mt.sched.get(sid);
          r.schedules++;
          if (!w) return diff.push(`${sid} (missing)`);
          let tcsv = w.csv;
          if (sid === 'checks') {
            const keep = new Set(v.s.rows.map((row) => String(row[0])));
            tcsv = T.NS.audit.toCsv(Object.assign({}, w.s, { rows: w.s.rows.filter((row) => keep.has(String(row[0]))) }));
          }
          let hb = sha(v.csv);
          const ht = sha(tcsv);
          r.hashes.push(`${where} ${sid} ${ht}`);
          if (sid === 'log' && X) {
            // 11-18: the tree's change log must be exactly the one the expected difference gives.
            const exp = expectedLog(A.NS, v.s, X, a, oa);
            if (exp.bad) {
              diff.push(`${v.s.file}: ${exp.bad}`);
              hb = '';
            } else {
              hb = sha(exp.csv);
              expect = new Map([[v.s.file, Buffer.from(exp.csv, 'utf8')]]);
            }
          }
          if (hb !== ht) diff.push(sid);
        });
        const za = exportOf(A.NS, wa, oa, a);
        const zt = exportOf(T.NS, wt, ot, t);
        r.zips++;
        r.hashes.push(`${where} zip ${sha(zt.bytes)}`);
        if (sha(za.bytes) === sha(zt.bytes)) r.zipsWhole++;
        if (za.name !== zt.name) diff.push(`zip name (base ${za.name}, tree ${zt.name})`);
        (expect ? compareZip(za, zt, expect) : compareZip(za, zt)).forEach((m) => diff.push(`zip ${m}`));
        if (diff.length) {
          r.mismatches.push(`${where}: ${diff.join('; ')}`);
          r.found.push({ edition, fund: oa.id, period: id, schedules: diff.filter((d) => ma.sched.has(d)), diff, logFile: ma.sched.has('log') ? ma.sched.get('log').s.file : '' });
        }
      });
    });
  });
  return r;
}

/** The newest paid distribution of an offering, one cent larger (W7: stored lines and total together when present). */
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

const parts = {
  /** Every sample fund (or the --firm one), both editions, both periods: no mismatch. */
  async same({ check }) {
    const base = baseRoot();
    const extra = treeExtras(base);
    check(`tree side loads the scripts this tree's page adds after operations.js: ${extra.length ? extra.join(', ') : 'none'}`, true);
    // The books: each side loads the books scripts its own page lists, and builds NS.books exactly when it lists some.
    [['base', base], ['tree', ROOT]].forEach(([who, root]) => {
      const bk = LD().booksScripts(root);
      const NS = portal(root, 'diy', who === 'tree' ? extra : []);
      const files = NS.__load11.files;
      const k = files.indexOf('operations.js');
      const has = !!(NS.books && NS.books.sync && NS.books.trialBalance);
      check(`${who} side loads the books scripts its page lists, from its own files, directly after operations.js in the page's order: ${bk.join(', ') || 'none'} (NS.books.sync and trialBalance: ${has})`, NS.__load11.root === path.resolve(root) && bk.every((f, i) => files[k + 1 + i] === f) && has === bk.length > 0, files.join(', '));
    });
    let funds = 0;
    let schedules = 0;
    let zips = 0;
    let whole = 0;
    let first = null;
    EDITIONS.forEach((ed) => {
      const r = compare(base, ed);
      if (!first) first = r;
      funds = Math.max(funds, r.funds);
      schedules += r.schedules;
      zips += r.zips;
      whole += r.zipsWhole;
      console.log(
        `expected differences built from the base (${ed}): ${
          r.moves.length ? r.moves.map((f) => `${f.firm} ${f.moves.length} (${f.moves.map((m) => `${m.id} ${m.from} -> ${m.to}`).join(', ')})`).join('; ') : 'none (no base call has a notice date equal to its due date)'
        }`
      );
      console.log(`schedules only this tree builds (${ed}; not compared, the base does not have them): ${r.treeOnly.size ? Array.from(r.treeOnly).join(', ') : 'none'}`);
      check(`${ed}: every schedule, period figure and package entry the base builds is the same in this tree, or exactly the expected difference above (${r.schedules} schedules, ${r.zips} packages of ${r.funds} funds)`, r.funds > 0 && r.schedules > 0 && !r.mismatches.length, r.mismatches.slice(0, 20));
    });
    // I1: the same comparison run again in fresh contexts gives the same hashes (the comparison is stable).
    const again = compare(base, EDITIONS[0]);
    check(`${EDITIONS[0]} run twice: the same ${first.hashes.length} hashes`, first.hashes.length > 0 && again.hashes.join('\n') === first.hashes.join('\n'), again.hashes.filter((h, i) => h !== first.hashes[i]).slice(0, 3));
    console.log(`compared ${schedules} schedules and ${zips} packages (${whole} byte-identical as whole files) of ${funds} funds`);
  },
  /** The comparison catches one cent on kb-fund-ii's newest paid distribution, naming the fund, period and schedule. */
  async mutate({ check }) {
    const base = baseRoot();
    if (FIRM && FIRM !== 'kestrel-bay') return check('case mutate needs Kestrel Bay (run without --firm or with --firm kestrel-bay)', false);
    const r = compare(base, 'diy', addCent('kb-fund-ii'));
    check(`one distribution was changed: ${r.mutated.join(', ') || 'none'}`, r.mutated.length === 1);
    const hit = r.found.filter((f) => f.fund === 'kb-fund-ii' && f.schedules.length);
    check('the one-cent change is reported as a mismatch naming the fund, the period and at least one schedule id', hit.length > 0, r.mismatches.slice(0, 5));
    // The change log is the firm's, so the firm's other funds may show the changed entry in schedule 'log'; nothing else.
    const others = r.found.filter((f) => f.fund !== 'kb-fund-ii');
    check('any other fund reported differs only in the firm-wide change log (schedule log)', others.every((f) => /^kb-/.test(f.fund) && f.schedules.join() === 'log' && f.diff.every((d) => d === 'log' || (f.logFile && d.indexOf(f.logFile) >= 0))), r.mismatches.filter((m) => !/^diy kb-fund-ii /.test(m)).slice(0, 5));
    hit.forEach((f) => console.log(`  caught: ${f.edition} ${f.fund} ${f.period}: ${f.schedules.join(', ')}`));
  },
  /** Without a base tree (or with this checkout as its own base) the check prints FAIL and exits 1. */
  async noroot({ check }) {
    const env = Object.assign({}, process.env);
    delete env.P11_ROOT;
    const runs = [
      ['P11_ROOT not set', env],
      ['P11_ROOT is this checkout', Object.assign({}, env, { P11_ROOT: ROOT })],
      ['P11_ROOT holds no portal', Object.assign({}, env, { P11_ROOT: __dirname })]
    ];
    runs.forEach(([what, e]) => {
      const c = child(['--case', 'same', '--firm', 'kestrel-bay'], e);
      check(`${what}: a FAIL line and exit 1 (exit ${c.status})`, c.status === 1 && /^FAIL no base tree/m.test(c.out) && !/^PASS /m.test(c.out), c.out.slice(-600));
    });
  },
  /** The flag's rules, and the package rules of compareZip on packages built here from a real export. */
  async selfcheck({ check }) {
    const u = child(['--case', 'nosuchcase']);
    check(`an unknown --case name: a FAIL line and exit 1 (exit ${u.status})`, u.status === 1 && /^FAIL unknown case name: nosuchcase/m.test(u.out), u.out.slice(-400));
    const n = child(['--case', '']);
    check(`an empty --case list: a FAIL line and exit 1 (exit ${n.status})`, n.status === 1 && /^FAIL no cases to run/m.test(n.out), n.out.slice(-400));
    zipRules(check);
    noticeRules(check);
    booksRules(check);
  }
};

/** This check run again as a child process. */
function child(args, env) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [__filename].concat(args), { env: env || process.env, encoding: 'utf8', timeout: 300000 });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

/**
 * compareZip proven on packages rebuilt here from one real export (Kestrel Bay Fund II, fiscal year): what W4 allows
 * passes, and each change it does not allow is reported.
 */
function zipRules(check) {
  const NS = portal(ROOT, 'diy');
  const ws = LD().sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
  const o = ws.offerings.find((x) => x.id === 'kb-fund-ii');
  const p = NS.audit.presets(ws, o).find((x) => x.id === 'fy');
  const X = exportOf(NS, ws, o, p);
  const enc = (s) => Buffer.from(s, 'utf8');
  /** files (without MANIFEST) → a package; man(lines) may change the MANIFEST lines before it is written. */
  const pack = (files, B, man) => {
    const body = files.filter((f) => f.name !== 'MANIFEST.sha256');
    let lines = body.map((f) => `${sha(f.data)}  ${f.name}`);
    if (man) lines = man(lines);
    const all = body.concat([{ name: 'MANIFEST.sha256', data: enc(lines.join('\n') + '\n') }]);
    const bytes = NS.audit.zip(all.map((f) => ({ name: f.name, data: new Uint8Array(f.data) })));
    return { bytes, files: unzip(bytes), B: B || X.B };
  };
  const edit = (name, fn) => X.files.map((f) => (f.name === name ? { name, data: enc(fn(f.data.toString('utf8'))) } : f));
  const readme = (fn) => edit('00_README.txt', (t) => fn(t.split('\r\n')).join('\r\n'));
  const checksS = X.B.list.find((s) => s.id === 'checks');
  const firstS = X.B.list.find((s) => s.id !== 'checks');
  const same = pack(X.files);
  check('a package rebuilt here from the export\'s own entries is byte-identical to the export (the rebuild is faithful)', Buffer.compare(Buffer.from(same.bytes), Buffer.from(X.bytes)) === 0);
  const cases = [];
  // Allowed by W4.
  cases.push(['a changed "Generated:" line', true, pack(readme((ls) => ls.map((l) => (/^Generated:/.test(l) ? 'Generated:      2031-01-01 00:00:00 UTC' : l))))]);
  const nf = '99_New_schedule.csv';
  const withNew = X.files.filter((f) => f.name !== 'MANIFEST.sha256').concat([{ name: nf, data: enc('\uFEFFA,B\r\n1,2\r\n') }]);
  const addContents = (ls) => {
    const k = ls.findIndex((l) => l.indexOf('MANIFEST.sha256 ') === 0);
    return ls.slice(0, k).concat([`${nf.padEnd(48)} New schedule (1 row)`], ls.slice(k));
  };
  const newB = { list: X.B.list.concat([{ id: 'new-schedule', file: nf, rows: [[1, 2]] }]), chk: X.B.chk };
  const withNewReadme = withNew.map((f) => (f.name === '00_README.txt' ? { name: f.name, data: enc(addContents(f.data.toString('utf8').split('\r\n')).join('\r\n')) } : f));
  cases.push(['a schedule the base lacks, with its CONTENTS and MANIFEST lines', true, pack(withNewReadme, newB)]);
  const title = 'A new readiness check';
  const chkFiles = X.files
    .map((f) => (f.name === checksS.file ? { name: f.name, data: enc(f.data.toString('utf8') + `${title},Pass,Detail of the new check,\r\n`) } : f))
    .map((f) => {
      if (f.name !== '00_README.txt') return f;
      const ls = f.data.toString('utf8').split('\r\n');
      const last = ls.map((l, i) => (/^\[(PASS| N\/A|OPEN)\] /.test(l) ? i : -1)).filter((i) => i >= 0).pop();
      const out = ls.slice(0, last + 1).concat([`[PASS] ${title}`], ls.slice(last + 1));
      return { name: f.name, data: enc(out.map((l) => (l.indexOf(checksS.file.padEnd(48) + ' ') === 0 ? l.replace(/\((\d+) rows?\)$/, (m, k) => `(${Number(k) + 1} rows)`) : l)).join('\r\n')) };
    });
  const chkB = { list: X.B.list.map((s) => (s.id === 'checks' ? Object.assign({}, s, { rows: s.rows.concat([[title, 'Pass', 'Detail of the new check', '']]) }) : s)), chk: X.B.chk.concat([{ title, status: 'pass', items: [] }]) };
  cases.push(['a readiness check the base lacks: its row, its READINESS line and the CONTENTS row count', true, pack(chkFiles, chkB)]);
  // Not allowed.
  cases.push([`one changed character in ${firstS.file}`, false, pack(edit(firstS.file, (t) => t.replace(/\d/, (d) => String((Number(d) + 1) % 10))))]);
  cases.push(['a changed README line other than "Generated:"', false, pack(readme((ls) => ls.map((l, i) => (i === 0 ? l + ' ' : l))))]);
  cases.push(['a readiness line no new check explains', false, pack(readme((ls) => ls.concat(['[PASS] Unexplained'])))]);
  cases.push([`${firstS.file} dropped`, false, pack(X.files.filter((f) => f.name !== firstS.file))]);
  cases.push(['an entry that is not a schedule the base lacks', false, pack(X.files.filter((f) => f.name !== 'MANIFEST.sha256').concat([{ name: 'notes.txt', data: enc('x') }]))]);
  cases.push(['a wrong MANIFEST line for a new schedule', false, pack(withNewReadme, newB, (ls) => ls.map((l) => (l.slice(66) === nf ? '0'.repeat(64) + l.slice(64) : l)))]);
  cases.push(['a wrong MANIFEST line for a base entry', false, pack(X.files, null, (ls) => ls.map((l) => (l.slice(66) === firstS.file ? '0'.repeat(64) + l.slice(64) : l)))]);
  cases.push(['a checks row the base holds, changed', false, pack(edit(checksS.file, (t) => t.replace(/,Pass,/, ',Exception,')))]);
  cases.forEach(([what, allowed, tree]) => {
    const m = compareZip(X, tree);
    check(`${allowed ? 'allowed' : 'reported'}: ${what}`, allowed ? m.length === 0 : m.length > 0, m.slice(0, 4));
  });
}

/** files (MANIFEST left out) → a package through NS.audit.zip; man(lines) may change the MANIFEST lines first. */
function repack(NS, files, B, man) {
  const body = files.filter((f) => f.name !== 'MANIFEST.sha256');
  let lines = body.map((f) => `${sha(f.data)}  ${f.name}`);
  if (man) lines = man(lines);
  const all = body.concat([{ name: 'MANIFEST.sha256', data: Buffer.from(lines.join('\n') + '\n', 'utf8') }]);
  const bytes = NS.audit.zip(all.map((f) => ({ name: f.name, data: new Uint8Array(f.data) })));
  return { bytes, files: unzip(bytes), B };
}

/**
 * 11-18: the moved-notice rule proven on this tree alone, so it holds once the fix is in the base too. The base is
 * rebuilt here: Kestrel Bay with every complete call noticed on its due date (the data before the fix) and its change
 * log seeded again from that data. It must be allowed against this tree's Kestrel Bay, and each other change reported.
 */
function noticeRules(check) {
  const KB = 'kestrel-bay';
  const load = () => {
    const NS = portal(ROOT, 'diy');
    return { NS, wss: LD().sampleWorkspaces(NS) };
  };
  const A = load();
  const wa = A.wss.find((w) => w.tenant.id === KB);
  wa.calls.forEach((c) => {
    if (c.status === 'complete') c.noticeDate = c.due;
  });
  delete wa.audit;
  A.NS.clearCaches();
  A.NS.audit.ensureLog(wa);
  const T = load();
  const wt = T.wss.find((w) => w.tenant.id === KB);
  const wp = T.wss.find((w) => w.tenant.id === 'pellbrook');
  T.NS.audit.ensureLog(wt);

  // Base: the rebuilt base gives the five moves, its chain verifies and chainOf reproduces it; a fixed base gives none.
  const X = firmExpect(A.NS, wa);
  check(`notice rule base: the rebuilt base gives five moves for Kestrel Bay (${X ? X.moves.map((m) => `${m.id} ${m.from} -> ${m.to}`).join(', ') : 'none'})`, !!X && X.moves.length === 5 && X.moves.every((m) => m.from === m.due && m.to < m.from), X && X.moves);
  const v = A.NS.audit.verify(wa);
  check(`notice rule base: NS.audit.verify of the rebuilt base's change log is ok (${v.count} entries)`, v.ok === true, v);
  const base = A.NS.audit.ensureLog(wa);
  const re = chainOf(base.map((e) => Object.assign({}, e)));
  check(`notice rule base: chainOf reproduces every seq and hash of the rebuilt base's log (${base.length} entries)`, !!X && !X.problems.length && re.every((e, i) => e.seq === base[i].seq && e.hash === base[i].hash), X && X.problems);
  const fixedKb = firmExpect(T.NS, wt);
  const fixedPb = firmExpect(T.NS, wp);
  const done = (w) => w.calls.filter((c) => c.status === 'complete').length;
  check(`notice rule base: firmExpect of this tree's own Kestrel Bay (${done(wt)} complete calls) and Pellbrook (${done(wp)}) is null: with a base that has the fix, nothing is allowed`, fixedKb === null && fixedPb === null && done(wt) === 5 && done(wp) === 4, [fixedKb && fixedKb.moves, fixedPb && fixedPb.moves]);
  if (!X) return;

  // Allowed: this tree's Kestrel Bay against the rebuilt base.
  const fc = firmCheck(X, T.NS, wt);
  check('notice rule allowed: firmCheck of this tree\'s Kestrel Bay against the rebuilt base gives nothing (calls and the whole change log as expected)', fc.length === 0, fc.slice(0, 4));
  const oa = wa.offerings.find((o) => o.id === 'kb-fund-ii');
  const ot = wt.offerings.find((o) => o.id === 'kb-fund-ii');
  const pkg = {};
  PRESETS.forEach((pid) => {
    const p = A.NS.audit.presets(wa, oa).find((x) => x.id === pid);
    const s = A.NS.audit.build(wa, oa, p.from, p.to).list.find((x) => x.id === 'log');
    const st = T.NS.audit.build(wt, ot, p.from, p.to).list.find((x) => x.id === 'log');
    const exp = expectedLog(A.NS, s, X, p, oa);
    const tcsv = T.NS.audit.toCsv(st);
    check(`notice rule allowed: kb-fund-ii ${pid}: the tree's ${s.file} equals the one expectedLog builds from the rebuilt base (${s.rows.length} rows, base bytes differ: ${sha(A.NS.audit.toCsv(s)) !== sha(tcsv)})`, !exp.bad && exp.csv === tcsv, exp.bad || `expected ${exp.csv && sha(exp.csv).slice(0, 12)}, tree ${sha(tcsv).slice(0, 12)}`);
    const za = exportOf(A.NS, wa, oa, p);
    const zt = exportOf(T.NS, wt, ot, p);
    const expect = exp.csv ? new Map([[s.file, Buffer.from(exp.csv, 'utf8')]]) : null;
    const m = expect ? compareZip(za, zt, expect) : ['no expected bytes'];
    const without = compareZip(za, zt);
    check(`notice rule allowed: kb-fund-ii ${pid}: compareZip of the two packages with the expected bytes gives nothing (without them it reports ${without.length})`, m.length === 0 && without.length > 0, m.slice(0, 4));
    pkg[pid] = { p, s, exp, za, zt, expect };
  });

  // Reported: each change other than the declared one.
  const cloneT = () => {
    const w = clone(T.NS, wt);
    T.NS.audit.ensureLog(w);
    return w;
  };
  const rebuild = (NS, w) => {
    delete w.audit;
    NS.clearCaches();
    NS.audit.ensureLog(w);
  };
  const report = (what, lines, extra) => check(`notice rule reported: ${what}`, lines.length > 0 && extra !== false, lines.length ? lines.slice(0, 3) : 'nothing reported');
  // (a) the tree is the rebuilt base itself (the code without the fix).
  const ra = firmCheck(X, A.NS, wa);
  report(`(a) a tree without the fix (the rebuilt base itself): ${ra.filter((l) => /^calls: \S+ notice /.test(l)).length} "calls:" lines`, ra, ra.filter((l) => /^calls: kb-fund-ii-call-\d notice \S+, expected \S+$/.test(l)).length === 5);
  // (b) one moved call noticed nine business days back, its log seeded again.
  const wb = cloneT();
  const cb = wb.calls.find((c) => c.id === X.moves[0].id);
  cb.noticeDate = weekdaysBack(X.moves[0].due, 9);
  rebuild(T.NS, wb);
  const rb = firmCheck(X, T.NS, wb);
  report(`(b) ${cb.id} noticed nine business days before it is due (${cb.noticeDate}), its log seeded again`, rb, rb.some((l) => l === `calls: ${cb.id} notice ${cb.noticeDate}, expected ${X.moves[0].to}`));
  T.NS.clearCaches();
  // (c) one moved row one second later, the chain rehashed so it verifies (a consistent forged chain).
  const wc = cloneT();
  const ec = wc.audit.find((e) => e.action === 'Capital call issued' && e.record === X.moves[1].id);
  ec.at = new Date(Date.parse(ec.at) + 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  chainOf(wc.audit);
  const vc = T.NS.audit.verify(wc);
  const rc = firmCheck(X, T.NS, wc);
  report(`(c) the 'Capital call issued' row of ${X.moves[1].id} one second later (${ec.at}), the chain rehashed (verify ok: ${vc.ok})`, rc, vc.ok === true);
  // (d) one character of another row's detail, the chain rehashed.
  const wd = cloneT();
  const ed = wd.audit.find((e) => e.action !== 'Capital call issued' && e.detail && e.detail.length > 1);
  ed.detail = ed.detail.slice(0, -1) + (ed.detail.slice(-1) === 'x' ? 'y' : 'x');
  chainOf(wd.audit);
  const rd = firmCheck(X, T.NS, wd);
  report(`(d) one character of the detail of seq ${ed.seq} (${ed.action}), the chain rehashed (verify ok: ${T.NS.audit.verify(wd).ok})`, rd);
  // (e) one cent more on one item of a moved call, nothing else.
  const we = cloneT();
  const ce = we.calls.find((c) => c.id === X.moves[2].id);
  ce.items[0].cents += 1;
  const rE = firmCheck(X, T.NS, we);
  report(`(e) one cent more on the first item of ${ce.id}, nothing else`, rE, rE.some((l) => l === `calls: ${ce.id} differs beyond the moved notices`));
  // (f) kb-fund-ii fy's tree package: a digit of a row that did not move (MANIFEST rewritten to match); a wrong MANIFEST line.
  const F = pkg.fy;
  if (F && F.expect) {
    const name = F.s.file;
    const recs = csvRecords(F.zt.files.find((f) => f.name === name).data.toString('utf8'));
    const k = recs.findIndex((r, i) => i > 0 && r.indexOf('Capital call issued') < 0 && /\d/.test(r));
    const edited = recs.map((r, i) => (i === k ? r.replace(/\d/, (d) => String((Number(d) + 1) % 10)) : r)).join('\r\n') + '\r\n';
    const files = F.zt.files.map((f) => (f.name === name ? { name, data: Buffer.from(edited, 'utf8') } : f));
    const r1 = compareZip(F.za, repack(T.NS, files, F.zt.B), F.expect);
    report(`(f) kb-fund-ii fy: one digit of row ${k} of ${name} (a row that did not move), the MANIFEST rewritten to match`, r1, k > 0);
    const r2 = compareZip(F.za, repack(T.NS, F.zt.files, F.zt.B, (ls) => ls.map((l) => (l.slice(66) === name ? '0'.repeat(64) + l.slice(64) : l))), F.expect);
    const r0 = compareZip(F.za, repack(T.NS, F.zt.files, F.zt.B), F.expect);
    report(`(f) kb-fund-ii fy: the expected ${name} bytes with a wrong MANIFEST line for it (the same package rebuilt faithfully gives ${r0.length})`, r2, r0.length === 0);
  } else check('notice rule reported: (f) kb-fund-ii fy has expected log bytes to test with', false, F && F.exp);
  // (g) a base that has the fix (the rule off): one call noticed one business day earlier in the tree is reported.
  const T2 = load();
  const wg = T2.wss.find((w) => w.tenant.id === KB);
  const cg = wg.calls.find((c) => c.id === X.moves[3].id);
  cg.noticeDate = weekdaysBack(cg.noticeDate, 1);
  rebuild(T2.NS, wg);
  const og = wg.offerings.find((o) => o.id === cg.offeringId);
  const ob = wt.offerings.find((o) => o.id === cg.offeringId);
  const pg = T.NS.audit.presets(wt, ob).find((x) => x.id === 'itd');
  const sb = T.NS.audit.toCsv(T.NS.audit.build(wt, ob, pg.from, pg.to).list.find((x) => x.id === 'log'));
  const sg = T2.NS.audit.toCsv(T2.NS.audit.build(wg, og, pg.from, pg.to).list.find((x) => x.id === 'log'));
  const rg = compareZip(exportOf(T.NS, wt, ob, pg), exportOf(T2.NS, wg, og, pg));
  const off = firmExpect(T.NS, wt);
  report(`(g) this tree's Kestrel Bay as the base (rule off: ${off === null}), ${cg.id} noticed one business day earlier (${cg.noticeDate}) in the tree: the itd log schedule differs (${sha(sb) !== sha(sg)}) and the package is reported`, rg, off === null && sha(sb) !== sha(sg));
}

/** One manual journal entry of one cent (Other expenses debit, Cash credit) in an offering's books, written as stored data. */
function addBookCent(offeringId) {
  return (NS, ws) => {
    const o = (ws.offerings || []).find((x) => x.id === offeringId);
    if (!o) return null;
    const p = NS.audit.presets(ws, o).find((x) => x.id === 'fy');
    if (!ws.books || typeof ws.books !== 'object') ws.books = { v: 1, funds: {} };
    if (!ws.books.funds) ws.books.funds = {};
    const f = (ws.books.funds[offeringId] = ws.books.funds[offeringId] || {});
    if (!Array.isArray(f.journal)) f.journal = [];
    f.journal.push({ id: 'je-' + String(f.journal.length + 1).padStart(6, '0'), date: p.to, memo: 'AUDIT SAME selfcheck: one cent', src: 'manual:audit-same-selfcheck', lines: [['5900', 1], ['1000', -1]], at: TODAY + 'T12:00:00.000Z', by: 'AUDIT SAME selfcheck' });
    return `${offeringId}: one manual journal entry of one cent dated ${p.to} (5900 debit 1, 1000 credit 1)`;
  };
}

/**
 * The books on both sides (11-12 B1: build syncs every fund, and schedules 20 to 24 come from the journal): this tree
 * against itself, Kestrel Bay, diy. With nothing changed nothing is reported and no schedule is this tree's alone; one
 * cent in kb-fund-ii's journal on the tree side must be reported, naming the fund and the trial balance.
 */
function booksRules(check) {
  const KB = 'kestrel-bay';
  const NS = portal(ROOT, 'diy');
  const files = NS.__load11.files;
  const books = LD().booksScripts(ROOT).filter((f) => files.indexOf(f) >= 0);
  check(`books loaded: this tree's side loads the scripts its page lists that build NS.books (${books.join(', ') || 'none'}), and NS.books.sync and NS.books.trialBalance exist`, books.length > 0 && !!(NS.books && NS.books.sync && NS.books.trialBalance), files.join(', '));
  const r0 = compare(ROOT, 'diy', null, KB);
  const ids = new Set();
  r0.hashes.forEach((h) => ids.add(h.split(' ')[3]));
  check(`books unchanged: this tree against itself (Kestrel Bay, diy) reports nothing (${r0.schedules} schedules, ${r0.zips} packages); schedules compared: ${Array.from(ids).join(', ')}`, r0.schedules > 0 && !r0.mismatches.length && ids.has('tb'), r0.mismatches.slice(0, 4));
  const r = compare(ROOT, 'diy', addBookCent('kb-fund-ii'), KB);
  check(`books changed: ${r.mutated.join(', ') || 'nothing changed'}`, r.mutated.length === 1);
  const hit = r.found.filter((f) => f.fund === 'kb-fund-ii' && f.schedules.indexOf('tb') >= 0);
  check(`books reported: the one-cent journal entry is reported naming kb-fund-ii and the trial balance (${r.found.filter((f) => f.fund === 'kb-fund-ii').map((f) => `${f.period}: ${f.schedules.join(', ')}`).join('; ') || 'nothing reported'})`, hit.length > 0, r.mismatches.slice(0, 4));
}

L6.runParts(parts, { name: 'AUDIT SAME', unit: 'cases', flag: '--case' });
