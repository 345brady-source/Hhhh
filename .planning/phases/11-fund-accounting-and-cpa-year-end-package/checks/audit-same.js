// gate: node
// last "AUDIT SAME: PASS (cases run: 2)"
// T9 of 11-RESEARCH.md, the one definition of "sample funds unchanged" for phase 11 (FA-03): every sample fund's audit
// package, built by the base tree (P11_ROOT) and by this checkout, compared byte for byte. No browser.
//   P11_ROOT=<base tree> node audit-same.js [--case same,mutate] [--firm <tenant id>]
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
// Without P11_ROOT it prints FAIL and exits 1: it never compares a tree with itself silently.
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

/**
 * W4: the two exported zips. base/tree = { bytes, files: [{ name, data }] from unzip, B: build }. Returns mismatch
 * strings (empty when the packages agree under the rules above).
 */
function compareZip(base, tree) {
  const bad = [];
  if (Buffer.compare(Buffer.from(base.bytes), Buffer.from(tree.bytes)) === 0) return bad;
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
function side(root, edition, extra) {
  const NS = LD().loadPortal(root, { today: TODAY, edition, extra });
  const wss = LD().sampleWorkspaces(NS).filter((ws) => !FIRM || ws.tenant.id === FIRM);
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
function compare(base, edition, mutate) {
  const extra = treeExtras(base);
  const A = side(base, edition, []);
  const T = side(ROOT, edition, extra);
  const changed = [];
  if (mutate) {
    T.wss.forEach((ws) => {
      const c = mutate(T.NS, ws);
      if (c) changed.push(c);
    });
    if (T.NS.clearCaches) T.NS.clearCaches();
  }
  const r ={ funds: 0, schedules: 0, zips: 0, zipsWhole: 0, mismatches: [], found: [], hashes: [], mutated: [] };
  r.mutated = changed;
  if (A.wss.length !== T.wss.length || !A.wss.length) r.mismatches.push(`sample firms: base ${A.wss.length}, tree ${T.wss.length}`);
  A.wss.forEach((wa) => {
    const wt = T.wss.find((w) => w.tenant.id === wa.tenant.id);
    if (!wt) return r.mismatches.push(`${wa.tenant.id}: not a sample firm in this tree`);
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
        if (ma.fund !== mt.fund) diff.push('period fund');
        ma.sched.forEach((v, sid) => {
          const w = mt.sched.get(sid);
          r.schedules++;
          if (!w) return diff.push(`${sid} (missing)`);
          let tcsv = w.csv;
          if (sid === 'checks') {
            const keep = new Set(v.s.rows.map((row) => String(row[0])));
            tcsv = T.NS.audit.toCsv(Object.assign({}, w.s, { rows: w.s.rows.filter((row) => keep.has(String(row[0]))) }));
          }
          const hb = sha(v.csv);
          const ht = sha(tcsv);
          r.hashes.push(`${where} ${sid} ${ht}`);
          if (hb !== ht) diff.push(sid);
        });
        const za = exportOf(A.NS, wa, oa, a);
        const zt = exportOf(T.NS, wt, ot, t);
        r.zips++;
        r.hashes.push(`${where} zip ${sha(zt.bytes)}`);
        if (sha(za.bytes) === sha(zt.bytes)) r.zipsWhole++;
        if (za.name !== zt.name) diff.push(`zip name (base ${za.name}, tree ${zt.name})`);
        compareZip(za, zt).forEach((m) => diff.push(`zip ${m}`));
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
    let funds = 0;
    let schedules = 0;
    let zips = 0;
    let whole = 0;
    EDITIONS.forEach((ed) => {
      const r = compare(base, ed);
      funds = Math.max(funds, r.funds);
      schedules += r.schedules;
      zips += r.zips;
      whole += r.zipsWhole;
      check(`${ed}: every schedule, period figure and package entry the base builds is the same in this tree (${r.schedules} schedules, ${r.zips} packages of ${r.funds} funds)`, r.funds > 0 && r.schedules > 0 && !r.mismatches.length, r.mismatches.slice(0, 20));
    });
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
  }
};

L6.runParts(parts, { name: 'AUDIT SAME', unit: 'cases', flag: '--case' });
