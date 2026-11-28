// gate: node
// last "ROLES TABLE: PASS (cases run: 3)"
// The one permission table (plan 15-12, SE-05, SE-06 groundwork) against the portal as it really loads. No browser.
//   node roles-table.js [--case keys,pages,words] [--without <page key>]
// The portal's own scripts run in Node through phase 11's loader (load11.js, edition 'diy', today 2026-11-26) with
// assets/js/roles.js added, so the table is read exactly as a page reads it (NS.roles).
// Cases:
//   keys   LABELS, LINES and every PAGES row have exactly the keys of ROLES; every PAGES value is 'act', 'read' or
//          'hidden'; the copy the page loads is the copy Node's require loads (the server's, server/lib/roles.mjs);
//          today's self-serve role keys and every team member's role in the sample workspaces are in ROLES.
//   pages  every view key of console.js's NAV (read from the file's text, its added lines included) has an explicit
//          PAGES row or is listed in DEFAULT_PAGES; no key is in both; every console page a script of diy.html
//          registers for the self-serve edition (read from the scripts' text) is covered the same way.
//   words  LABELS, LINES and REFUSALS hold no match for phase 06's VENDORS, VENDOR_RE or WORD_RE.
// --without <key> drops that row from this check's in-memory copy of PAGES (the proof that "pages" can fail).
const fs = require('fs');
const path = require('path');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
// The loader is required inside each case, so a missing or broken loader is a FAIL line of that case.
const LD = () => require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TODAY = '2026-11-26';
const argv = process.argv.slice(2);
const WITHOUT = argv.indexOf('--without') >= 0 ? String(argv[argv.indexOf('--without') + 1] || '') : '';
const VALUES = ['act', 'read', 'hidden'];

let loaded = null;
/** The portal in Node with roles.js, loaded once for all cases. */
function portal() {
  if (!loaded) {
    const ld = LD();
    const NS = ld.loadPortal(ROOT, { today: TODAY, edition: 'diy', extra: ['roles.js'] });
    if (!NS.roles) throw new Error('assets/js/roles.js did not set NS.roles when loaded in the portal');
    loaded = { NS, ld };
  }
  return loaded;
}

/** The table as this run sees it: the page's copy, with --without's row dropped. */
function table() {
  const R = portal().NS.roles;
  const pages = Object.assign({}, R.PAGES);
  if (WITHOUT) delete pages[WITHOUT];
  return { R, pages };
}

/** console.js's NAV keys, from the file's text: every ['console…', 'Label'] pair (a menu label starts with a capital). */
function navKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/console.js'), 'utf8');
  const keys = Array.from(src.matchAll(/\['(console(?:-[a-z]+)*)',\s*'[A-Z][^']*'\]/g)).map((m) => m[1]);
  return Array.from(new Set(keys));
}

/**
 * Every console page a script of diy.html registers (NS.views['console…'] = {), read from the scripts' text, without
 * those marked edition: 'managed'. Read as text because the rest of the page's scripts need a real browser to load.
 */
function registeredViews(ld) {
  const keys = new Set();
  ld.listedScripts(ROOT).forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8');
    for (const m of src.matchAll(/NS\.views\[['"](console(?:-[a-z]+)*)['"]\]\s*=\s*\{/g)) {
      const head = src.slice(m.index, m.index + 400).split(/\brender\b/)[0];
      if (!/edition:\s*['"]managed['"]/.test(head)) keys.add(m[1]);
    }
  });
  return Array.from(keys);
}

const sameKeys =(o, keys) => JSON.stringify(Object.keys(o).sort()) === JSON.stringify(keys.slice().sort());

const parts = {
  keys({ check }) {
    const { NS, ld } = portal();
    const { R, pages } = table();
    const roles = Array.from(R.ROLES);
    check('ROLES are the five console roles', JSON.stringify(roles) === JSON.stringify(['owner', 'admin', 'team', 'readonly', 'accountant']), roles);
    check('LABELS has exactly the keys of ROLES', sameKeys(R.LABELS, roles), Object.keys(R.LABELS));
    check('LINES has exactly the keys of ROLES', sameKeys(R.LINES, roles), Object.keys(R.LINES));
    const badRows = Object.keys(pages).filter((k) => !sameKeys(pages[k], roles));
    check(`every PAGES row (${Object.keys(pages).length}) has exactly the keys of ROLES`, badRows.length === 0, badRows);
    const badValues = [];
    Object.keys(pages).forEach((k) => Object.keys(pages[k]).forEach((r) => VALUES.indexOf(pages[k][r]) < 0 && badValues.push(`${k}.${r}=${pages[k][r]}`)));
    check("every PAGES value is 'act', 'read' or 'hidden'", badValues.length === 0, badValues);
    const node = require(path.join(ROOT, 'assets/js/roles.js'));
    const same = JSON.stringify([node.ROLES, node.LABELS, node.LINES, node.PERMISSIONS, node.PAGES, node.DEFAULT_PAGES, node.REFUSALS]) ===
      JSON.stringify([R.ROLES, R.LABELS, R.LINES, R.PERMISSIONS, R.PAGES, R.DEFAULT_PAGES, R.REFUSALS]);
    check('the page loads the same table as Node (the server reads this file)', same);
    const grid = (T) => T.ROLES.map((r) => T.PERMISSIONS.map((p) => (T.allows(r, p) ? 1 : 0)).join('')).join('/');
    check('allows() gives the same grid in the page and in Node', grid(R) === grid(node), [grid(R), grid(node)]);
    const today = (NS.EDITION.roles || []).filter((r) => r !== 'investor');
    check(`today's self-serve role keys (${today.join(', ')}) are in ROLES`, today.length > 0 && today.every((r) => roles.indexOf(r) >= 0), today);
    const wss = ld.sampleWorkspaces(NS);
    const members = [];
    wss.forEach((w) => (w.team || []).forEach((m) => members.push(`${(w.tenant && w.tenant.id) || '?'}:${m.role}`)));
    const strays = members.filter((m) => roles.indexOf(m.split(':')[1]) < 0 && ['investor'].indexOf(m.split(':')[1]) < 0);
    check(`the sample workspaces (${wss.length}) hold no team role the table lacks (${members.length} members)`, wss.length > 0 && strays.length === 0, strays);
  },

  pages({ check }) {
    const { NS } = portal();
    const { R, pages } = table();
    const defaults = Array.from(R.DEFAULT_PAGES || []);
    check('DEFAULT_PAGES is exported as a list', Array.isArray(R.DEFAULT_PAGES), typeof R.DEFAULT_PAGES);
    const nav = navKeys();
    check(`console.js's NAV was read (${nav.length} pages)`, nav.length >= 20 && nav.indexOf('console') >= 0 && nav.indexOf('console-team') >= 0, nav);
    const missing = nav.filter((k) => !Object.prototype.hasOwnProperty.call(pages, k) && defaults.indexOf(k) < 0);
    check('every menu page has a row or is listed as taking the default', missing.length === 0, missing.map((k) => `${k} has no row and is not in DEFAULT_PAGES`).join('; '));
    const both = defaults.filter((k) => Object.prototype.hasOwnProperty.call(pages, k));
    check('no page is both a row and listed as taking the default', both.length === 0, both);
    const views = registeredViews(portal().ld);
    const uncovered = views.filter((k) => !Object.prototype.hasOwnProperty.call(pages, k) && defaults.indexOf(k) < 0);
    check(`every self-serve console page a script of diy.html registers (${views.length}) is covered`, views.length >= 20 && uncovered.length === 0, uncovered.map((k) => `${k} has no row and is not in DEFAULT_PAGES`).join('; '));
    check('the loaded portal registered the self-serve pages of its scripts', Object.keys(NS.views || {}).length > 0);
    check('the Accountant reads the books and the reports (W5)', R.pageAccess('accountant', 'console-books') === 'read' && R.pageAccess('accountant', 'console-reports') === 'read');
    check('a page the table does not name is hidden from the Accountant', R.pageAccess('accountant', 'console-not-a-page') === 'hidden' && R.pageAccess('readonly', 'console-not-a-page') === 'read');
  },

  words({ check }) {
    const { R } = table();
    const texts = [].concat(
      Object.keys(R.LABELS).map((k) => [`LABELS.${k}`, R.LABELS[k]]),
      Object.keys(R.LINES).map((k) => [`LINES.${k}`, R.LINES[k]]),
      Object.keys(R.REFUSALS).map((k) => [`REFUSALS.${k}`, R.REFUSALS[k]])
    );
    check(`${texts.length} labels, lines and sentences read`, texts.length === 5 + 5 + 11 && texts.every(([, s]) => typeof s === 'string' && s.length > 0));
    const hits = texts.filter(([, s]) => L6.VENDORS.test(s) || L6.VENDOR_RE.test(s)).map(([k]) => k);
    check('no vendor, library or model name', hits.length === 0, hits);
    const word = texts.filter(([, s]) => L6.WORD_RE.test(s)).map(([k]) => k);
    check('never the forbidden word', word.length === 0, word);
  }
};

L6.runParts(parts, { name: 'ROLES TABLE', unit: 'cases', flag: '--case' });
