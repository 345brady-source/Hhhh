// gate: none
// The shared Node loader for phase 11's checks (no browser). It runs the portal's own scripts in a fresh vm context:
//   const { loadPortal, sampleWorkspaces, listedScripts } = require('./load11.js');
//   const NS = loadPortal(root, { today: '2026-11-19', edition: 'diy' | 'managed', extra: ['books.js'], books: true });
//
// - root: a checkout or an extracted base tree holding diy.html and assets/js (default: this checkout).
// - The scripts are read at run time from root/diy.html (11-CONTEXT W6): every src="assets/js/..." entry in the page's
//   order, from edition.js through operations.js (a phase 11 module listed between them is loaded with them), then the
//   file that defines NS.inviteFlow.taxOnFile if it is not already among them (found by searching root/assets/js),
//   then opts.extra in the order given. Never a list typed into this file.
// - books (optional, default off): directly after operations.js, booksScripts(root): every script root/diy.html lists
//   after operations.js whose source defines NS.books (`NS.books = `) or extends it (`const B = NS.books;` then
//   `Object.assign(B, ...)` or `B.<name> = `), in the page's order. A page that lists none loads none. Off, the files
//   are exactly the ones above.
// - today: Date.now() and new Date() answer that day at 12:00 UTC; new Date(x) with an argument is untouched.
// - edition: 'diy' sets window.CVPortalEdition = 'selfserve' before the scripts load; 'managed' leaves it unset.
//   The loaded NS.EDITION.id must be the edition asked for, or loadPortal throws.
// Stand-ins the scripts need to load (and nothing else), each the smallest that works:
//   window (the context's own global), location (empty search and hash, so no ?edition= override), localStorage and
//   sessionStorage (in memory, per context), document (an inert element factory, readyState "loading" so app.js waits
//   for a DOMContentLoaded that never comes and the page itself never starts),
//   history and navigator (inert), TextEncoder/TextDecoder, URLSearchParams, setTimeout/clearTimeout and console.
// sampleWorkspaces(NS) → [ws] for each tenant in NS.TENANTS with sample true, built as NS.workspace.load builds a
// fresh one: NS.seedWorkspace(seed), then NS.ops.ensure(ws).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHECKOUT = path.resolve(__dirname, '..', '..', '..', '..');

/** Every src="assets/js/<file>" of root/diy.html, in order (file names only). */
function listedScripts(root) {
  const html = fs.readFileSync(path.join(root || CHECKOUT, 'diy.html'), 'utf8');
  return Array.from(html.matchAll(/<script\b[^>]*\bsrc="assets\/js\/([^"?#]+)"/g)).map((m) => m[1]);
}

/** True when the source defines NS.books or extends it (assigns onto the object NS.books names). */
function buildsBooks(src) {
  if (/\bNS\.books\s*=(?!=)/.test(src)) return true;
  const m = src.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*NS\.books\s*;/);
  if (!m) return false;
  const id = m[1].replace(/\$/g, '\\$');
  return new RegExp(`Object\\.assign\\(\\s*${id}\\s*,|(^|[^\\w$.])${id}\\.[A-Za-z_$][\\w$]*\\s*=(?!=)`, 'm').test(src);
}

/** The scripts root/diy.html lists after operations.js that build NS.books, in the page's order. */
function booksScripts(root) {
  root = path.resolve(root || CHECKOUT);
  const listed = listedScripts(root);
  const b = listed.indexOf('operations.js');
  if (b < 0) throw new Error(`load11: ${path.join(root, 'diy.html')} does not list operations.js`);
  return listed.slice(b + 1).filter((f) => buildsBooks(fs.readFileSync(path.join(root, 'assets/js', f), 'utf8')));
}

/** The scripts loadPortal runs for root, in order. */
function scriptsFor(root, extra, books) {
  const listed = listedScripts(root);
  const a = listed.indexOf('edition.js');
  const b = listed.indexOf('operations.js');
  if (a < 0 || b < 0 || b < a) throw new Error(`load11: ${path.join(root, 'diy.html')} does not list edition.js before operations.js`);
  const files = listed.slice(a, b + 1);
  if (books) booksScripts(root).forEach((f) => files.indexOf(f) < 0 && files.push(f));
  const dir = path.join(root, 'assets/js');
  const definer = fs
    .readdirSync(dir)
    .filter((f) => /\.js$/.test(f))
    .sort()
    .find((f) => /NS\.inviteFlow\s*=\s*\{[^}]*\btaxOnFile\b/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  if (!definer) throw new Error(`load11: no file in ${dir} defines NS.inviteFlow.taxOnFile`);
  if (files.indexOf(definer) < 0) files.push(definer);
  (extra || []).forEach((f) => {
    if (files.indexOf(f) < 0) files.push(f);
  });
  return files;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: (k) => m.delete(String(k)),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] || null,
    get length() {
      return m.size;
    }
  };
}

/** An inert element: every property read is a no-op function or an empty value, so a script can build one and move on. */
function inertElement() {
  const el = {
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [],
    childNodes: [],
    appendChild: (c) => c,
    removeChild: (c) => c,
    insertBefore: (c) => c,
    setAttribute() {},
    getAttribute: () => null,
    hasAttribute: () => false,
    removeAttribute() {},
    matches: () => false,
    closest: () => null,
    contains: () => false,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    textContent: '',
    innerHTML: ''
  };
  return el;
}

function loadPortal(root, opts) {
  root = path.resolve(root || CHECKOUT);
  opts = opts || {};
  const today = opts.today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) throw new Error(`load11: today must be 'YYYY-MM-DD' (got ${today})`);
  const edition = opts.edition || 'diy';
  if (edition !== 'diy' && edition !== 'managed') throw new Error(`load11: edition must be 'diy' or 'managed' (got ${edition})`);
  const files = scriptsFor(root, opts.extra, !!opts.books);

  const doc = Object.assign(inertElement(), {
    readyState: 'loading', // app.js then waits for DOMContentLoaded, which never comes: the page itself never starts
    documentElement: inertElement(),
    head: inertElement(),
    body: inertElement(),
    createElement: () => inertElement(),
    createElementNS: () => inertElement(),
    createTextNode: () => inertElement(),
    getElementById: () => null,
    title: ''
  });
  const sb = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextEncoder,
    TextDecoder,
    URLSearchParams,
    location: { search: '', hash: '', pathname: '/diy.html', href: 'http://localhost/diy.html', origin: 'http://localhost', protocol: 'http:', host: 'localhost', hostname: 'localhost' },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    document: doc,
    history: { replaceState() {}, pushState() {}, back() {} },
    navigator: { userAgent: 'node', language: 'en-US' },
    addEventListener() {},
    removeEventListener() {}
  };
  sb.window = sb;
  sb.self = sb;
  const ctx = vm.createContext(sb);
  // The context's own Date, fixed to today at 12:00 UTC when called without an argument.
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
    })(${Date.parse(today + 'T12:00:00Z')});`,
    ctx,
    { filename: 'load11-date.js' }
  );
  if (edition === 'diy') sb.CVPortalEdition = 'selfserve';
  files.forEach((f) => {
    const file = path.join(root, 'assets/js', f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  });
  const NS = sb.CVPortal;
  if (!NS || !NS.EDITION || NS.EDITION.id !== edition) throw new Error(`load11: asked for the ${edition} edition, the scripts loaded ${NS && NS.EDITION ? NS.EDITION.id : 'none'}`);
  Object.defineProperty(NS, '__load11', { value: { root, files, today, edition, books: !!opts.books }, enumerable: false });
  return NS;
}

function sampleWorkspaces(NS) {
  return NS.TENANTS.filter((t) => t.sample).map((t) => NS.ops.ensure(NS.seedWorkspace(t)));
}

module.exports = { loadPortal, sampleWorkspaces, listedScripts, scriptsFor, booksScripts, buildsBooks, CHECKOUT };
