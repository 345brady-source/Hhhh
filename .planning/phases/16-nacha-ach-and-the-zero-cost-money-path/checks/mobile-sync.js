// gate: node
// last "MOBILE SYNC: PASS (cases run: 3)"
// AC-14 (F-18): the mobile app's core files are the generated copies of the web core, and they load and seed every
// sample firm as the web files do. No browser, no device.
//   node mobile-sync.js [--case nacha,copies,loads]
// Cases:
//   nacha: mobile/src/core/nacha.js equals the sync-core header line plus assets/js/nacha.js.
//   copies: the same for brand.js, tenants.js and data.js.
//   loads: the four mobile copies run in a fresh vm context in mobile/src/core/index.ts's import order, with window as
//     the context's global and CVPortal {} (as setup.ts makes it); every NS.TENANTS entry seeds with NS.seedWorkspace,
//     each sample firm's workspace equal to the one the web files seed; every NS.<name> that mobile/src/app,
//     mobile/src/lib and mobile/src/components read (found by searching their .ts and .tsx files) exists.
// The header and the file list are read from mobile/scripts/sync-core.js, never typed here.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TODAY = '2026-11-19';

/** sync-core.js's FILES and header template. */
function syncCore() {
  const src = fs.readFileSync(path.join(ROOT, 'mobile/scripts/sync-core.js'), 'utf8');
  const files = (src.match(/const FILES = \[([^\]]*)\]/) || [])[1];
  const header = (src.match(/const header = `([^`]*)`;/) || [])[1];
  if (!files || header === undefined) throw new Error('mobile/scripts/sync-core.js: FILES or the header line not found');
  return {
    files: files.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean),
    header: (f) => header.replace(/\$\{f\}/g, f).replace(/\\n/g, '\n')
  };
}

/** Compares mobile/src/core/<f> with the header plus assets/js/<f>; returns '' or where they first differ. */
function copyDiff(S, f) {
  const want = S.header(f) + fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8');
  const p = path.join(ROOT, 'mobile/src/core', f);
  if (!fs.existsSync(p)) return 'the copy is missing';
  const have = fs.readFileSync(p, 'utf8');
  if (have === want) return '';
  const a = have.split('\n');
  const b = want.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `the copy differs from its source from line ${i + 1} (copy ${a.length} lines, header plus source ${b.length})`;
}

/** The core files in index.ts's import order (after './setup'). */
function importOrder() {
  const src = fs.readFileSync(path.join(ROOT, 'mobile/src/core/index.ts'), 'utf8');
  return Array.from(src.matchAll(/^import '\.\/([^']+\.js)';/gm)).map((m) => m[1]);
}

/** Runs files (absolute paths) in a fresh context, window = the context's global, Date fixed to TODAY 12:00 UTC. */
function run(files) {
  const sb = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder };
  sb.window = sb;
  sb.CVPortal = {};
  const ctx = vm.createContext(sb);
  vm.runInContext(
    `(function (fixed) {
      const RealDate = Date;
      function FixedDate(...a) {
        if (!new.target) return new RealDate(fixed).toString();
        return Reflect.construct(RealDate, a.length ? a : [fixed], new.target);
      }
      FixedDate.prototype = RealDate.prototype;
      Object.defineProperty(RealDate.prototype, 'constructor', { value: FixedDate, writable: true, configurable: true });
      FixedDate.now = () => fixed;
      FixedDate.UTC = RealDate.UTC;
      FixedDate.parse = RealDate.parse;
      globalThis.Date = FixedDate;
    })(${Date.parse(TODAY + 'T12:00:00Z')});`,
    ctx,
    { filename: 'mobile-sync-date.js' }
  );
  files.forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file }));
  return sb.CVPortal;
}

/** Every NS.<name> the app's screens, lib and components read. */
function namesRead() {
  const names = new Set();
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((x) => {
      const p = path.join(d, x.name);
      if (x.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(x.name)) Array.from(fs.readFileSync(p, 'utf8').matchAll(/\bNS\.([A-Za-z_$][\w$]*)/g)).forEach((m) => names.add(m[1]));
    });
  ['app', 'lib', 'components'].forEach((d) => {
    const p = path.join(ROOT, 'mobile/src', d);
    if (fs.existsSync(p)) walk(p);
  });
  return Array.from(names).sort();
}

const parts = {
  async nacha({ check }) {
    const S = syncCore();
    check('sync-core.js copies nacha.js', S.files.indexOf('nacha.js') >= 0, S.files);
    const d = copyDiff(S, 'nacha.js');
    check('mobile/src/core/nacha.js is the sync-core header line plus assets/js/nacha.js', !d, d);
  },
  async copies({ check }) {
    const S = syncCore();
    check(`sync-core.js copies brand.js, tenants.js, data.js and nacha.js (it copies ${S.files.join(', ')})`, ['brand.js', 'tenants.js', 'data.js', 'nacha.js'].every((f) => S.files.indexOf(f) >= 0));
    ['brand.js', 'tenants.js', 'data.js'].forEach((f) => {
      const d = copyDiff(S, f);
      check(`mobile/src/core/${f} is the sync-core header line plus assets/js/${f}`, !d, d);
    });
  },
  async loads({ check }) {
    const order = importOrder();
    check(`index.ts imports the four core files: ${order.join(', ')}`, ['brand.js', 'tenants.js', 'data.js', 'nacha.js'].every((f) => order.indexOf(f) >= 0) && order.length === 4, order);
    let M;
    let W;
    try {
      M = run(order.map((f) => path.join(ROOT, 'mobile/src/core', f)));
      check('the four mobile copies load in that order', true);
    } catch (e) {
      return check('the four mobile copies load in that order', false, String(e && e.stack ? e.stack : e));
    }
    W = run(order.map((f) => path.join(ROOT, 'assets/js', f)));
    const tenants = M.TENANTS || [];
    check(`NS.TENANTS holds the sample firms (${tenants.filter((t) => t.sample).length} of ${tenants.length} entries)`, tenants.filter((t) => t.sample).length > 0);
    tenants.forEach((t) => {
      let ws = null;
      let err = '';
      try {
        ws = M.seedWorkspace(t);
      } catch (e) {
        err = String(e && e.message);
      }
      const ok = !!ws && !err && (!t.sample || (Array.isArray(ws.investors) && ws.investors.length > 0 && Array.isArray(ws.offerings) && ws.offerings.length > 0));
      check(`${t.id}: NS.seedWorkspace seeds it${t.sample ? ` (${ws && ws.investors ? ws.investors.length : 0} investors, ${ws && ws.offerings ? ws.offerings.length : 0} offerings)` : ''}`, ok, err);
      if (!ok || !t.sample) return;
      const wt = (W.TENANTS || []).find((x) => x.id === t.id);
      const same = !!wt && JSON.stringify(W.seedWorkspace(wt)) === JSON.stringify(ws);
      check(`${t.id}: the mobile workspace equals the one the web files seed`, same);
    });
    const names = namesRead();
    const missing = names.filter((n) => typeof M[n] === 'undefined');
    check(`every NS name the app reads exists (${names.join(', ')})`, names.length > 0 && !missing.length, missing);
  }
};

L6.runParts(parts, { name: 'MOBILE SYNC', unit: 'cases', flag: '--case' });
