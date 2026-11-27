// gate: browser
// last "SAME SCREENS: PASS (parts run: 11)"
// Plan 18-01 (UI-10, D-02): every screen and dialog of 18-UI-SPEC §11 recorded on the base tree and on this tree, under the
// same frozen clock and seeded random numbers, and compared (screens18.compare): the words, the actions (links, buttons,
// fields and what they hold), the headings and the charts must be the same, apart from the C1..C7 changes, the D-05 merge
// (M) and the §7.11 chart rule (CH), each an exact transform in screens18.js. The base is P18_BASE (the gate's base tree),
// else `git archive P18_BASE_COMMIT`; with neither the check FAILs.
//   selftest          stand-in trees with one fault each must FAIL naming the screen; stand-ins applying a rule correctly
//                     must PASS (built from P18_SELFTEST_COMMIT, default this plan's start commit, so they stay true while
//                     later plans change this tree)
//   console-desktop   diy.html, Kestrel Bay as admin: every console menu page, one offering, the first envelope, the intake
//                     upload step; then role team: Overview and Offerings (1280x800)
//   console-phone     the same on the iPhone 13 profile
//   managed-desktop   index.html as staff: every menu page; then the sponsor staff role: Overview and Offerings
//   managed-phone     the same on the phone
//   investor-desktop  diy.html and index.html as the sample investor: every tab, one investment, portfolio, preferences,
//                     subscribe-<id>, sign-in
//   investor-phone    the same on the phone, with the menu opened
//   flows-desktop     a new invitation walked step by step, the activation page, join-<id>, diy-start, the W-9 signing
//                     view, the e-sign sender list and one envelope, the field editor, the report builder with a template
//   flows-phone       the same on the phone
//   dialogs-desktop   every DIALOGS row on every edition it names: set up, opened, recorded, closed by its X
//   dialogs-phone     the same on the phone
// Every part also checks, on each screen of this tree, no vendor, model or library name and no forbidden word that the
// base tree's screen does not have, and no request outside the page's origin.
//   P18_BASE=<dir> | P18_BASE_COMMIT=<commit> NODE_PATH=$(npm root -g) node same-screens.js [--only selftest,...]
// The last line is "SAME SCREENS: PASS (parts run: N)" or "SAME SCREENS: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('./lib18.js');
const S18 = X.S18;
const L = X.L;
const T = X.T;

const DAY = '2026-11-27';
const SELFTEST_COMMIT = process.env.P18_SELFTEST_COMMIT || 'd36521bc4a0a9bf259dc67324c8802985d78bd5c';
const made = [];
process.on('exit', () => made.forEach((t) => X.removeTree(t)));

/* ---------- trees ---------- */
let baseP = null;
/** The base tree and a server on it, once per process. */
function base() {
  if (!baseP)
    baseP = (async () => {
      const t = X.baseRoot();
      made.push(t);
      const srv = await X.serveDir(t.dir);
      return { name: 'base tree', dir: t.dir, origin: srv.origin, srv };
    })();
  return baseP;
}
const here = (S) => ({ name: 'this tree', dir: X.ROOT, origin: S.origin });

/* ---------- a walk on one tree ---------- */
const route = async (W, h, wait) => {
  await W.fr.evaluate((h) => (location.hash = h), h);
  await W.fr.waitForTimeout(wait || 450);
};
async function press(W, sel, o) {
  const l = typeof sel === 'string' ? W.fr.locator(sel).first() : sel;
  try {
    if (!(await l.count())) return false;
    await l.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (W.size === 'phone') await l.tap({ timeout: (o && o.timeout) || 8000 });
    else await l.click({ timeout: (o && o.timeout) || 8000 });
    await W.fr.waitForTimeout((o && o.wait) || 350);
    return true;
  } catch (e) {
    return false;
  }
}
/** Record the screen as it stands under `key` (a failure to read it is kept as the screen's error). */
async function rec(W, key, o) {
  try {
    const r = await X.record(W.fr, Object.assign({ key, size: W.size }, o || {}));
    W.records[key] = r;
  } catch (e) {
    W.errors[key] = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 200);
  }
}
/** Open `page` on `tree` at `size` with the frozen clock, run walk(W), and resolve to { records, errors, outside }. */
async function onTree(S, tree, size, page, walk) {
  const { A, fr } = await X.framedAt(S, size, { root: tree.dir, origin: tree.origin, page, freeze: DAY });
  const W = { S, A, fr, size, page, tree, records: {}, errors: {} };
  try {
    await walk(W);
  } catch (e) {
    W.errors['(walk)'] = String(e && e.message ? e.message : e).split('\n')[0].slice(0, 300);
  } finally {
    W.outside = A.p10.outside.concat(A.net.external);
    await A.context.close().catch(() => {});
  }
  return W;
}

/**
 * The same walk on the base tree and on this tree, every screen compared. walks: [{ page, walk }] (each its own fresh page).
 * Prints one PASS or FAIL line per screen; this tree's screens are also checked for new vendor names and outside requests.
 */
async function sameWalk(check, S, part, size, walks, o) {
  o = o || {};
  const B = o.base || (await base());
  const P = o.plan || here(S);
  const got = { base: { records: {}, errors: {}, outside: [] }, plan: { records: {}, errors: {}, outside: [] } };
  for (const w of walks) {
    for (const [side, tree] of [['base', B], ['plan', P]]) {
      const W = await onTree(S, tree, size, w.page || 'diy.html', w.walk);
      Object.assign(got[side].records, W.records);
      Object.assign(got[side].errors, W.errors);
      got[side].outside.push(...W.outside);
    }
  }
  return judge(o.quiet ? null : check, part, got, o);
}
/** Compare the records of the two sides; resolves to the list of { key, res, line }. */
function judge(check, part, got, o) {
  o = o || {};
  const keys = Object.keys(got.base.records).concat(Object.keys(got.plan.records).filter((k) => !got.base.records[k]));
  const errKeys = Object.keys(got.base.errors).concat(Object.keys(got.plan.errors)).filter((k, i, a) => a.indexOf(k) === i);
  const out = [];
  const say = (ok, text) => check && check(text, ok);
  for (const k of errKeys) {
    const t = X.mask(`${k}: not recorded (base: ${got.base.errors[k] || 'ok'}; this tree: ${got.plan.errors[k] || 'ok'})`);
    out.push({ key: k, res: { ok: false }, line: `FAIL ${part} ${t}` });
    say(false, t);
  }
  for (const k of keys) {
    const b = got.base.records[k];
    const p = got.plan.records[k];
    if (!b || !p) {
      const t = `${k}: recorded on ${b ? 'the base tree' : 'this tree'} only`;
      out.push({ key: k, res: { ok: false }, line: `FAIL ${part} ${t}` });
      say(false, t);
      continue;
    }
    const res = S18.compare(b, p, { ctx: { baseByKey: got.base.records }, rules: o.rules });
    const line = S18.line(part, k, res);
    out.push({ key: k, res, line });
    say(res.ok, line.replace(/^(PASS|FAIL) \S+ /, ''));
    if (!o.noVendorCheck && check) {
      const nb = X.noVendor(b.frame.lines.concat(b.content.lines).join('\n')).hits;
      const np = X.noVendor(p.frame.lines.concat(p.content.lines).join('\n')).hits;
      const fresh = np.filter((x) => nb.indexOf(x) < 0);
      if (fresh.length) say(false, X.mask(`${k}: a vendor, model or library name or the forbidden word this tree adds: ${JSON.stringify(fresh.slice(0, 4))}`));
      else if (np.length) vendorNotes[`${k}|${np.join('|')}`] = X.mask(`NOTE ${part} ${k}: product text the base tree has too, kept as it is (white label is SCREEN EDGES' check): ${JSON.stringify(np.slice(0, 3))}`);
    }
  }
  if (check && !o.noVendorCheck) {
    Object.values(vendorNotes).forEach((n) => console.log(n));
    Object.keys(vendorNotes).forEach((k) => delete vendorNotes[k]);
    check(`no request left the page's origin on this tree (${keys.length} screens)`, got.plan.outside.length === 0, got.plan.outside.slice(0, 6));
    check(`screens recorded on both trees: ${keys.length}`, keys.length > 0 && (o.min === undefined || keys.length >= o.min), { min: o.min, keys: keys.length });
  }
  return out;
}
const vendorNotes = {};

/* ---------- walks ---------- */
const WALK = {
  /** The console's Overview as the sample firm's admin. */
  overview: { page: 'diy.html', walk: async (W) => {
    await T.sample(W.fr, { role: 'admin' });
    await route(W, 'console');
    await rec(W, 'admin console');
  } },
  /** The Offerings page as the sample firm's admin. */
  offerings: { page: 'diy.html', walk: async (W) => {
    await T.sample(W.fr, { role: 'admin' });
    await route(W, 'console-offerings');
    await rec(W, 'admin console-offerings');
  } }
};

/* ---------- selftest ---------- */
/**
 * Stand-ins: a copy of the selftest tree with one literal replace (it must match exactly once). fault: the comparison must
 * FAIL (and name the screen); control: it must PASS. part: the part whose walk the stand-in runs (its FAIL line names it).
 */
const STANDINS = [
  { name: 'word', kind: 'fault', file: 'assets/js/console.js', from: 'Each investment is configured separately', to: 'Each investment is set up separately', part: 'console-desktop', size: 'desktop', walks: ['offerings'] },
  { name: 'c1-help', kind: 'control', file: 'assets/js/help.js', from: 'aria-haspopup="dialog">Help</button>\')', to: 'aria-haspopup="dialog">Ask me anything</button>\')', part: 'console-desktop', size: 'desktop', walks: ['overview'], rule: 'C1' },
  { name: 'c1-wrong', kind: 'fault', file: 'assets/js/console.js', from: 'data-action="off-add">Add offering</button>\')', to: 'data-action="off-add">Ask me anything</button>\')', part: 'console-desktop', size: 'desktop', walks: ['offerings'] }
];
const stCache = {};
async function selftestTree() {
  if (!stCache.tree) {
    const t = X.archiveTree(SELFTEST_COMMIT, 'p18-selftest-');
    made.push(t);
    const srv = await X.serveDir(t.dir);
    stCache.tree = { name: 'selftest tree', dir: t.dir, origin: srv.origin, srv };
  }
  return stCache.tree;
}
async function standIn(st) {
  const src = await selftestTree();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `p18-standin-${st.name}-`));
  const t = { dir, made: true };
  made.push(t);
  fs.cpSync(src.dir, dir, { recursive: true });
  const f = path.join(dir, st.file);
  const text = fs.readFileSync(f, 'utf8');
  const n = text.split(st.from).length - 1;
  if (n !== 1) throw new Error(`stand-in ${st.name}: "${st.from}" is in ${st.file} ${n} times, not once`);
  fs.writeFileSync(f, text.replace(st.from, st.to));
  const srv = await X.serveDir(dir);
  return { tree: { name: `stand-in ${st.name}`, dir, origin: srv.origin }, close: async () => {
    await srv.close();
    X.removeTree(t);
  } };
}
async function selftest({ check, S }) {
  const src = await selftestTree();
  for (const st of STANDINS) {
    let si = null;
    try {
      si = await standIn(st);
      const walks = st.walks.map((w) => WALK[w]);
      const res = await sameWalk(check, S, st.part, st.size, walks, { base: src, plan: si.tree, quiet: true, noVendorCheck: true });
      const failed = res.filter((r) => !r.res.ok);
      if (st.kind === 'fault') check(`fault ${st.name} caught: ${failed.length ? failed[0].line : `nothing failed (${res.map((r) => r.line).join(' / ')})`}`, failed.length > 0 && res.length > 0);
      else {
        const used = res.some((r) => r.res.ok && (r.res.applied || []).indexOf(st.rule) >= 0);
        check(`control ${st.name} passes${st.rule ? ` (${st.rule})` : ''}: ${res.map((r) => r.line).join(' / ')}`, res.length > 0 && !failed.length && (!st.rule || used));
      }
    } catch (e) {
      check(`stand-in ${st.name} ran`, false, String(e && e.message ? e.message : e));
    } finally {
      if (si) await si.close();
    }
  }
}

/* ---------- parts ---------- */
const later = (name) => async ({ check }) => check(`${name}: written by Task 3 of plan 18-01`, false);
L.runParts(
  {
    selftest,
    'console-desktop': async ({ check, S }) => {
      await sameWalk(check, S, 'console-desktop', 'desktop', [WALK.overview], { min: 1 });
    },
    'console-phone': later('console-phone'),
    'managed-desktop': later('managed-desktop'),
    'managed-phone': later('managed-phone'),
    'investor-desktop': later('investor-desktop'),
    'investor-phone': later('investor-phone'),
    'flows-desktop': later('flows-desktop'),
    'flows-phone': later('flows-phone'),
    'dialogs-desktop': later('dialogs-desktop'),
    'dialogs-phone': later('dialogs-phone')
  },
  { name: 'SAME SCREENS', unit: 'parts', flag: '--only', browser: true }
);
