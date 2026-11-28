// gate: node
// last "SECTIONS: PASS (cases run: 2)"
// The workspace's section table on the server (plan 15-06, SE-07) against the portal as it really loads. No browser.
//   node sections.js [--case keys,mask] [--without <key>]
// The portal's own scripts run in Node through phase 11's loader (load11.js, edition 'diy', today 2026-11-26) with
// assets/js/integrations.js added (it makes ws.integrations); server/lib/workspace.mjs is the server's own module.
// Cases:
//   keys   every top-level key of every sample workspace (sampleWorkspaces(NS), after NS.integrations.ensure) and of
//          NS.workspace.create('Harbor Ridge Capital') after NS.integrations.ensure and NS.ops.ensure, and every key a
//          script diy.html loads creates on a workspace (a line that assigns ws.<key> or W().<key> and reads the same key:
//          the "make it when missing" idiom, read from the scripts' text), has a SECTIONS line; 'invite' excepted (the
//          console's own server link, never saved). A key only scripts diy.html does not load yet create is printed as a
//          NOTE line, not a failure. Every line's write is a permission, 'server' or 'never'.
//   mask   for every sample workspace, mask(ws, 'team') leaves no run of five or more digits in any investor's payment,
//          in tenant.ach or in an offering's ACH originator (achOverride), shows each routing and account number as '****' and its last four digits, and leaves the
//          workspace it was given unchanged.
// --without <key> drops that line from this check's in-memory copy of SECTIONS (the proof that "keys" can fail).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
// The loader is required inside each case, so a missing or broken loader is a FAIL line of that case.
const LD = () => require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TODAY = '2026-11-26';
const argv = process.argv.slice(2);
const WITHOUT = argv.indexOf('--without') >= 0 ? String(argv[argv.indexOf('--without') + 1] || '') : '';
const EXCEPT = ['invite'];

let loaded = null;
/** The portal in Node with integrations.js, and the server's module, loaded once for all cases. */
async function portal() {
  if (!loaded) {
    const ld = LD();
    const NS = ld.loadPortal(ROOT, { today: TODAY, edition: 'diy', extra: ['integrations.js'] });
    if (!NS.integrations || typeof NS.integrations.ensure !== 'function') throw new Error('assets/js/integrations.js did not set NS.integrations.ensure');
    const W = await import(pathToFileURL(path.join(ROOT, 'server/lib/workspace.mjs')).href);
    loaded = { NS, ld, W };
  }
  return loaded;
}
/** The table as this run sees it: the server's, with --without's line dropped. */
function sections(W) {
  const s = Object.assign({}, W.SECTIONS);
  if (WITHOUT) delete s[WITHOUT];
  return s;
}

/** Keys a script creates on a workspace: `ws.K = ...` (or W().K) on a line that also reads ws.K (the ensure idiom). */
function createdKeys(src) {
  const out = new Set();
  for (const line of src.split('\n')) {
    const re = /(?:^|[^\w$.])(ws|W\(\))\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
    let m;
    while ((m = re.exec(line))) {
      const recv = m[1].replace(/[()]/g, '\\$&');
      const uses = line.match(new RegExp(`(?:^|[^\\w$.])${recv}\\.${m[2]}(?![\\w$])`, 'g')) || [];
      if (uses.length >= 2) out.add(m[2]);
    }
  }
  return out;
}

const WRITES = (PERMISSIONS) => PERMISSIONS.concat(['server', 'never']);

async function keys({ check }) {
  const { NS, ld, W } = await portal();
  const S = sections(W);
  const perms = require(path.join(ROOT, 'assets/js/roles.js')).PERMISSIONS;
  const bad = Object.keys(W.SECTIONS).filter((k) => !WRITES(perms).includes(W.SECTIONS[k].write));
  check('every SECTIONS line writes with a permission, server or never', !bad.length, bad);
  check('invite has no line (never saved)', !Object.prototype.hasOwnProperty.call(W.SECTIONS, 'invite'));

  const found = new Map(); // key -> where it was seen
  const see = (k, where) => {
    if (!found.has(k)) found.set(k, where);
  };
  const samples = ld.sampleWorkspaces(NS);
  check('the sample workspaces load', samples.length > 0, samples.length);
  for (const ws of samples) {
    NS.integrations.ensure(ws);
    Object.keys(ws).forEach((k) => see(k, `sample ${ws.tenant.id}`));
  }
  let made = NS.workspace.create('Harbor Ridge Capital');
  NS.integrations.ensure(made);
  made = NS.ops.ensure(made) || made;
  Object.keys(made).forEach((k) => see(k, 'a new workspace'));

  const listed = ld.listedScripts(ROOT);
  const later = new Map();
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/js')).filter((x) => x.endsWith('.js')).sort()) {
    const ks = createdKeys(fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8'));
    for (const k of ks) {
      if (listed.includes(f)) see(k, f);
      else if (!later.has(k)) later.set(k, f);
    }
  }
  check('the scripts diy.html loads create sections (the idiom is found)', ['books', 'envelopes', 'achLog'].every((k) => found.has(k)), [...found.keys()].join(', '));
  const missing = [...found.entries()].filter(([k]) => !EXCEPT.includes(k) && !Object.prototype.hasOwnProperty.call(S, k));
  check(`every key found (${found.size}) has a SECTIONS line`, !missing.length, missing.map(([k, w]) => `${k} (${w})`).join(', '));
  for (const [k, f] of later) if (!found.has(k) && !Object.prototype.hasOwnProperty.call(S, k)) console.log(`NOTE ${k} is created only by ${f}, which diy.html does not load yet: the plan that loads it adds its SECTIONS line`);
}

async function mask({ check }) {
  const { NS, ld, W } = await portal();
  const samples = ld.sampleWorkspaces(NS);
  check('the sample workspaces load', samples.length > 0, samples.length);
  for (const ws of samples) {
    const before = JSON.stringify(ws);
    const m = W.mask(ws, 'team');
    check(`${ws.tenant.id}: the workspace given is unchanged`, JSON.stringify(ws) === before);
    const pays = JSON.stringify(m.investors.map((i) => i.payment || null));
    check(`${ws.tenant.id}: no run of five or more digits in any investor's payment`, !/\d{5}/.test(pays), (pays.match(/\d{5,}/g) || []).length + ' runs');
    check(`${ws.tenant.id}: no run of five or more digits in tenant.ach`, !/\d{5}/.test(JSON.stringify(m.tenant.ach)), (JSON.stringify(m.tenant.ach).match(/\d{5,}/g) || []).length + ' runs');
    const overrides = JSON.stringify((m.offerings || []).map((o) => o.achOverride || null));
    check(`${ws.tenant.id}: no run of five or more digits in an offering's ACH originator`, !/\d{5}/.test(overrides), (overrides.match(/\d{5,}/g) || []).length + ' runs');
    const wrong = [];
    let n = 0;
    ws.investors.forEach((i, x) => {
      const b = i.payment && i.payment.bank;
      if (!b) return;
      for (const f of ['routing', 'account']) {
        if (!b[f]) continue;
        n++;
        const got = m.investors[x].payment.bank[f];
        if (got !== `****${String(b[f]).slice(-4)}`) wrong.push(`${i.id} ${f}`);
      }
    });
    check(`${ws.tenant.id}: ${n} bank numbers show '****' and the last four`, n > 0 && !wrong.length, wrong.join(', '));
  }
}

L6.runParts({ keys, mask }, { name: 'SECTIONS', unit: 'cases', flag: '--case' });
