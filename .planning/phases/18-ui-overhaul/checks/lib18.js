// gate: none
// Helpers for every phase 18 check (plan 18-01), built on P6/lib.js, P10/lib10.js and P13/lib13.js. Check files keep their
// own parts; what two or more of them need lives here.
//   ROOT, P6, P10, P13           the repository and the three phases' checks folders
//   L, T, L13                    P6 lib.js, P10 lib10.js, P13 lib13.js
//   baseRoot()                   the base tree: P18_BASE when it holds index.html, else a temporary folder with
//                                `git archive <P18_BASE_COMMIT> index.html diy.html portal.html assets`; without either it
//                                throws (a check that cannot name its base prints FAIL, never a pass). { dir, made, commit }
//   archiveTree(commit)          the same copy of any commit: { dir, made: true, commit }
//   serveDir(dir)                lib13.serveDir: a static server on dir, { origin, close() }
//   framedAt(S, size, o)         lib10.framed with the page's HTML read from o.root (default ROOT) and every origin test on
//                                o.origin (default S.origin); size 'desktop' (T.VIEW.desktop) or 'phone' (PHONE); o.page,
//                                o.clock as lib10; o.freeze: a day, the frozen clock and seeded random numbers (freeze)
//   PHONE                        Playwright's devices['iPhone 13'] profile used with Chromium (the NOTE line, once per process)
//   freeze(context, day)         lib10's clock (the day at noon, running on) and Math.random replaced by mulberry32 seeded 18
//   record(fr, opts)             the screen as a record (screens18.normalize applied), read in the frame; opts.root: a
//                                selector (default the open dialog, else #view); opts.key, opts.size
//   mask(s)                      every run of 6 or more digits replaced by [digits]
//   noVendor(text)               lib13.noVendor after the ID_RE matches are taken out (stripLinkTokens is inside it)
//   style(fr, sel, props), rect(fr, sel), contrast(fg, bg), panelOk(fr, sel)   look helpers for the later plans
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const P6 = path.join(__dirname, '../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks');
const P10 = path.join(__dirname, '../../10-investor-tax-documents-and-withholding/checks');
const P13 = path.join(__dirname, '../../13-email-overhaul/checks');
const L = require(path.join(P6, 'lib.js'));
const T = require(path.join(P10, 'lib10.js'));
const L13 = require(path.join(P13, 'lib13.js'));
const S18 = require('./screens18.js');
const ROOT = L.ROOT;

/* ---------- the base tree ---------- */
const TREE_FILES = ['index.html', 'diy.html', 'portal.html', 'assets'];
function archiveTree(commit, prefix) {
  if (!commit) throw new Error('archiveTree: no commit named');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'p18-tree-'));
  cp.execSync(`git -C ${JSON.stringify(ROOT)} archive ${commit} ${TREE_FILES.join(' ')} | tar -x -C ${JSON.stringify(dir)}`, { stdio: ['ignore', 'ignore', 'pipe'] });
  return { dir, made: true, commit };
}
function baseRoot() {
  const b = process.env.P18_BASE;
  if (b && fs.existsSync(path.join(b, 'index.html'))) return { dir: b, made: false, commit: process.env.P18_BASE_COMMIT || '' };
  const commit = process.env.P18_BASE_COMMIT || '';
  if (!commit) throw new Error('no base tree: set P18_BASE (a folder holding index.html) or P18_BASE_COMMIT');
  return archiveTree(commit, 'p18-base-');
}
const removeTree = (t) => {
  if (t && t.made) fs.rmSync(t.dir, { recursive: true, force: true });
};

/* ---------- the frame ---------- */
let noted = false;
const PHONE = (() => {
  const d = Object.assign({}, require('playwright').devices['iPhone 13']);
  delete d.defaultBrowserType;
  return d;
})();
function notePhone() {
  if (noted) return;
  noted = true;
  console.log("NOTE WebKit not run: Chromium with the iPhone profile stands in; the owner's iPhone check covers Safari");
}

/** lib10's clock: the page's Date starts at noon on `day` ('YYYY-MM-DD') and runs on from there. */
function clockScript(day) {
  return `(() => {
    const R = window.__realDate || Date;
    window.__realDate = R;
    const [y, m, d] = ${JSON.stringify(day)}.split('-').map(Number);
    const shift = new R(y, m - 1, d, 12, 0, 0).getTime() - R.now();
    class D extends R {
      constructor(...a) {
        if (a.length) super(...a);
        else super(R.now() + shift);
      }
      static now() {
        return R.now() + shift;
      }
    }
    window.Date = D;
  })();`;
}
// mulberry32 seeded 18 in every document: ids built from Math.random() are the same on both trees (crypto is left alone)
const RANDOM_SCRIPT = `(() => {
  let a = 18;
  Math.random = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;
async function freeze(context, day) {
  await context.addInitScript(clockScript(day || '2026-11-27'));
  await context.addInitScript(RANDOM_SCRIPT);
}

const SANDBOX = T.SANDBOX;
const CSP = T.CSP;
const CSP_SELF = T.CSP_SELF;
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;
const PAGES = ['diy.html', 'portal.html', 'index.html'];

async function frameOf(A) {
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state));
  fr.p10 = { size: A.p10.size, A };
  A.errors.length = 0;
  A.p10.outside.length = 0;
  return fr;
}

/**
 * lib10.framed (lib10.js lines 64-104) with two changes: the page's HTML is read from o.root (default ROOT) and every
 * origin test uses o.origin (default S.origin). size: 'desktop' or 'phone' (the iPhone 13 profile). o.freeze: a day for
 * freeze(). Resolves to { A, fr, origin, root }.
 */
async function framedAt(S, size, o) {
  o = o || {};
  const origin = o.origin || S.origin;
  const root = o.root || ROOT;
  const view = size === 'phone' ? PHONE : size === 'desktop' ? T.VIEW.desktop : null;
  if (!view) throw new Error(`framedAt: size must be phone or desktop, not ${size}`);
  if (size === 'phone') notePhone();
  const page = o.page || 'diy.html';
  if (PAGES.indexOf(page) < 0) throw new Error(`framedAt: page must be one of ${PAGES.join(', ')}`);
  const self = o.policy === 'self';
  const SX = Object.assign({}, S, { origin });
  const A = await L.open(SX, { context: Object.assign({ acceptDownloads: true }, view) });
  A.p10 = { size: size === 'phone' ? 'phone' : 'desktop', outside: [], page };
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  if (o.freeze) await freeze(A.context, o.freeze);
  else if (o.clock) await A.context.addInitScript(clockScript(o.clock));
  A.context.on('request', (r) => {
    const u = r.url();
    if (!(u.startsWith(origin + '/') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:'))) A.p10.outside.push(u);
  });
  if (self) await A.context.route((u) => CDN.test(u.href), (route) => route.abort());
  await A.context.route(
    (u) => u.origin === origin && u.pathname === '/' + page,
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': self ? CSP_SELF : CSP }, body: fs.readFileSync(path.join(root, page)) })
  );
  await A.context.route(`${origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${origin}/${page}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  A.page.on('dialog', (d) => d.accept().catch(() => {}));
  await A.page.goto(`${origin}/__frame-host.html`);
  A.setClock = async (day) => {
    await A.context.addInitScript(clockScript(day));
    await A.page.goto(`${origin}/__frame-host.html`);
    return frameOf(A);
  };
  A.reload = async () => {
    await A.page.goto(`${origin}/__frame-host.html`);
    return frameOf(A);
  };
  return { A, fr: await frameOf(A), origin, root };
}

/* ---------- the record ---------- */
/**
 * Runs in the frame. Reads the screen as raw lines, actions, heads and charts (screens18.normalize finishes the record).
 * Lines are grouped by the elements' tags, not by the stylesheet (innerText splits by computed display and applies
 * text-transform, so a restyle alone would change it): a run of text inside phrasing elements (span, strong, em …) is one
 * line; every other element, and <br>, ends a line. Text in <svg> and in [role="img"] is left out of lines (charts keep
 * the [role="img"] text). Rendered = not display:none, not visibility:hidden, no closed <details> (its summary aside) or
 * <dialog> ancestor (phone-layout.js vis(), lines 158-166, without its size and opacity tests).
 */
function readScreen(arg) {
  const INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SMALL', 'CODE', 'KBD', 'SAMP', 'VAR', 'MARK', 'ABBR', 'CITE', 'DFN', 'Q', 'SUB', 'SUP', 'TIME', 'DATA', 'BDI', 'BDO', 'WBR', 'FONT', 'INS', 'DEL']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'SELECT', 'OPTION', 'OPTGROUP', 'TEXTAREA', 'DATALIST']);
  const FRAME_SEL = '#view .cs-nav, #view .pt-head, #view header, #view footer, #opbar, #demo, #notes';
  const ACTION_SEL = 'a[href], button, input, select, textarea, summary, [data-action], [tabindex="0"]';
  const cs = (el) => getComputedStyle(el);
  const hiddenSelf = (el) => {
    const s = cs(el);
    return s.display === 'none' || s.visibility === 'hidden';
  };
  const rendered = (el) => {
    if (!el || !el.isConnected) return false;
    if (cs(el).visibility === 'hidden') return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (cs(n).display === 'none') return false;
      if (n.tagName === 'DETAILS' && !n.open && n !== el) {
        const sum = n.querySelector(':scope > summary');
        if (!(sum && sum.contains(el))) return false;
      }
      if (n.tagName === 'DIALOG' && !n.open) return false;
    }
    return true;
  };
  const dlg = document.querySelector('#dlg[open]') || Array.from(document.querySelectorAll('dialog[open]')).pop() || null;
  let root;
  if (arg.root) root = document.querySelector(arg.root);
  else root = dlg || document.getElementById('view');
  const inDialog = !!(root && root.tagName === 'DIALOG');
  const frames = inDialog ? [] : Array.from(document.querySelectorAll(FRAME_SEL)).filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)));
  const inFrame = (el) => frames.some((f) => f.contains(el));
  const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  // the visible text of an element for its name: no svg, no aria-hidden, no hidden part
  const nameText = (el) => {
    let out = '';
    const walk = (n) => {
      if (n.nodeType === 3) {
        out += n.data;
        return;
      }
      if (n.nodeType !== 1) return;
      if (n.namespaceURI === 'http://www.w3.org/2000/svg' || n.getAttribute('aria-hidden') === 'true' || SKIP.has(n.tagName) || hiddenSelf(n)) return;
      if (n.tagName === 'BR') out += ' ';
      if (n.tagName === 'IMG' && n.getAttribute('alt')) out += ' ' + n.getAttribute('alt') + ' ';
      for (const c of n.childNodes) walk(c);
      if (!INLINE.has(n.tagName)) out += ' ';
    };
    walk(el);
    return squash(out);
  };
  // lines of a subtree (in DOM order); skip(el) leaves a subtree out
  const linesOf = (top, skip) => {
    const lines = [];
    let cur = '';
    const flush = () => {
      const t = squash(cur);
      if (t) lines.push(t);
      cur = '';
    };
    const walk = (n) => {
      if (n.nodeType === 3) {
        const p = n.parentElement;
        if (p && cs(p).visibility !== 'hidden') cur += n.data;
        return;
      }
      if (n.nodeType !== 1) return;
      if (n !== top && skip && skip(n)) return;
      if (SKIP.has(n.tagName) || n.namespaceURI === 'http://www.w3.org/2000/svg') return;
      if (n.getAttribute('role') === 'img') return;
      if (cs(n).display === 'none') return;
      if (n.tagName === 'DIALOG' && !n.open && n !== top) return;
      if (n.tagName === 'BR') return flush();
      const inline = INLINE.has(n.tagName);
      if (!inline) flush();
      if (n.tagName === 'DETAILS' && !n.open) {
        const sum = n.querySelector(':scope > summary');
        if (sum) walk(sum);
      } else for (const c of n.childNodes) walk(c);
      if (!inline) flush();
    };
    walk(top);
    flush();
    return lines;
  };
  const labelText = (el) => {
    const by = el.getAttribute('aria-labelledby');
    if (by) return squash(by.split(/\s+/).map((id) => (document.getElementById(id) ? nameText(document.getElementById(id)) : '')).join(' '));
    if (el.getAttribute('aria-label')) return squash(el.getAttribute('aria-label'));
    if (el.labels && el.labels.length) return squash(Array.from(el.labels).map(nameText).join(' '));
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(el.type)) return squash(el.value);
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return '';
    return nameText(el);
  };
  const action = (el) => {
    const tag = el.tagName.toLowerCase();
    const x = { tag };
    const a = (k, v) => {
      if (v !== null && v !== undefined && v !== '' && v !== false) x[k] = v;
    };
    if (tag === 'input' || tag === 'button') a('type', el.getAttribute('type') || (tag === 'button' ? 'submit' : 'text'));
    a('action', el.getAttribute('data-action'));
    const f = el.closest('[data-form]');
    a('form', f ? f.getAttribute('data-form') : '');
    a('change', el.getAttribute('data-change'));
    a('bind', el.getAttribute('data-bind'));
    const data = {};
    Array.from(el.attributes)
      .filter((at) => /^data-/.test(at.name) && ['data-action', 'data-change', 'data-bind'].indexOf(at.name) < 0)
      .sort((p, q) => (p.name < q.name ? -1 : 1))
      .forEach((at) => (data[at.name.slice(5)] = at.value));
    if (Object.keys(data).length) x.data = data;
    a('id', el.id);
    const href = el.getAttribute('href');
    if (href !== null && tag === 'a') x.href = href;
    a('name', labelText(el));
    a('disabled', !!(el.disabled || el.getAttribute('aria-disabled') === 'true'));
    if (tag === 'input' && /^(checkbox|radio)$/.test(el.type)) x.checked = !!el.checked;
    a('pressed', el.getAttribute('aria-pressed'));
    a('expanded', el.getAttribute('aria-expanded'));
    a('current', el.getAttribute('aria-current'));
    a('placeholder', el.getAttribute('placeholder'));
    if (tag === 'input' && el.type !== 'file' && el.type !== 'password') a('value', el.value);
    if (tag === 'input' && el.type === 'password') a('value', el.value ? '<password>' : '');
    if (tag === 'textarea' || tag === 'select') a('value', el.value);
    if (tag === 'select') x.options = Array.from(el.options).map((op) => `${op.value}=${squash(op.textContent)}${op.disabled ? ' (disabled)' : ''}`);
    a('title', el.getAttribute('title'));
    a('alt', el.getAttribute('alt'));
    a('readonly', !!el.readOnly);
    a('required', !!el.required);
    const db = el.getAttribute('aria-describedby');
    if (db) a('described', squash(db.split(/\s+/).map((id) => (document.getElementById(id) ? nameText(document.getElementById(id)) : '')).join(' ')));
    return x;
  };
  const actionsIn = (els) => els.filter(rendered).map(action);
  const all = root ? Array.from(root.querySelectorAll(ACTION_SEL)) : [];
  const contentEls = all.filter((el) => !inFrame(el));
  const frameEls = inDialog ? [] : frames.flatMap((f) => (f.matches(ACTION_SEL) ? [f] : []).concat(Array.from(f.querySelectorAll(ACTION_SEL))));
  const content = { lines: root ? linesOf(root, (n) => inFrame(n) && frames.indexOf(n) >= 0) : [], actions: actionsIn(contentEls) };
  const frame = { lines: frames.filter(rendered).flatMap((f) => linesOf(f)), actions: actionsIn(frameEls) };
  const heads = root
    ? Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'))
        .filter((el) => !inFrame(el) && rendered(el))
        .map((el) => ({ level: Number(el.getAttribute('aria-level')) || Number(el.tagName.slice(1)) || 0, text: nameText(el) }))
    : [];
  const charts = root
    ? Array.from(root.querySelectorAll('[role="img"]'))
        .filter((el) => !inFrame(el) && rendered(el) && !el.parentElement.closest('[role="img"]'))
        .map((el) => {
          const notes = [];
          const walk = (n) => {
            if (n.nodeType === 3) {
              const t = squash(n.data);
              if (t) notes.push(t);
              return;
            }
            if (n.nodeType !== 1 || hiddenSelf(n)) return;
            for (const c of n.childNodes) walk(c);
          };
          walk(el);
          const sec = el.closest('section, .cs-panel, .pt-card, .card, .pf, article') || el.parentElement;
          return { label: squash(el.getAttribute('aria-label')), notes, context: linesOf(sec, (n) => n === el) };
        })
    : [];
  const NS = window.CVPortal || {};
  const st = NS.state || {};
  const meta = {
    hash: location.hash,
    page: location.pathname.split('/').pop(),
    edition: NS.EDITION && NS.EDITION.managed ? 'managed' : 'diy',
    role: st.role || '',
    font: st.ws && st.ws.tenant ? st.ws.tenant.font || '' : '',
    mark: st.ws && st.ws.tenant && st.ws.tenant.logo ? st.ws.tenant.logo.type || '' : '',
    console: !!document.querySelector('#view .cs'),
    root: inDialog ? 'dialog' : arg.root || '#view'
  };
  return { frame, content, heads, charts, dialog: inDialog, meta };
}

async function record(fr, opts) {
  opts = opts || {};
  await fr.waitForTimeout(opts.wait == null ? 250 : opts.wait);
  const raw = await fr.evaluate(readScreen, { root: opts.root || '' });
  raw.key = opts.key || raw.meta.hash || '(no route)';
  raw.size = opts.size || (fr.p10 && fr.p10.size) || '';
  return S18.normalize(raw);
}

/* ---------- text helpers ---------- */
const DIGITS_RE = /\d{6,}/g;
const mask = (s) => String(s === undefined || s === null ? '' : s).replace(DIGITS_RE, '[digits]');
function noVendor(text) {
  const t = String(text || '').replace(S18.ID_RE, '<id>');
  return L13.noVendor(t);
}

/* ---------- look helpers (later plans) ---------- */
const style = (fr, sel, props) =>
  fr.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      const o = {};
      props.forEach((p) => (o[p] = s.getPropertyValue(p)));
      return o;
    },
    { sel, props }
  );
const rect = (fr, sel) =>
  fr.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  }, sel);
/** WCAG contrast ratio of two computed colours ('rgb(r, g, b)' or '#rrggbb'). */
function contrast(fg, bg) {
  const rgb = (c) => {
    const s = String(c).trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s);
    if (m) return [m[1], m[2], m[3]].map(Number);
    throw new Error(`contrast: not a colour: ${c}`);
  };
  const lum = (c) => {
    const [r, g, b] = rgb(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** A complete panel (D-15): a 1px border on all four sides, a radius and a shadow. */
const panelOk = (fr, sel) =>
  fr.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, why: 'not on the page' };
    const s = getComputedStyle(el);
    const sides = ['top', 'right', 'bottom', 'left'].map((k) => ({ k, w: s.getPropertyValue(`border-${k}-width`), st: s.getPropertyValue(`border-${k}-style`) }));
    const borders = sides.every((x) => x.w === '1px' && x.st !== 'none');
    const radius = parseFloat(s.borderTopLeftRadius) > 0;
    const shadow = s.boxShadow && s.boxShadow !== 'none';
    return { ok: borders && radius && !!shadow, borders, radius, shadow: s.boxShadow };
  }, sel);

module.exports = { ROOT, P6, P10, P13, L, T, L13, S18, baseRoot, archiveTree, removeTree, serveDir: L13.serveDir, framedAt, PHONE, notePhone, freeze, clockScript, record, readScreen, mask, noVendor, style, rect, contrast, panelOk, TREE_FILES };
