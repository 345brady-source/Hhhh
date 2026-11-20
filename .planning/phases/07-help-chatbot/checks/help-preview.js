#!/usr/bin/env node
// Quick task 2026-11-20 help-preview: Help answers inside the owner's preview (a claude.ai artifact: a sandboxed frame
// that refuses every connection), through the artifact's own `sample` capability, shown exactly as the real Help dialog
// shows a server's answer. The page under test is diy.html with the two preview-only script lines that
// .planning/tools/preview/diy-portal.html puts before help.js (taken from that file, so the preview page's own lines are
// what is tested); window.claude is a stand-in whose `sample` records what it is sent and answers what the check says.
//   preview-sponsor   an admin on the console's Investors page: the field and Send; an answer shown as a server answer is;
//                     the stand-in got the rules, the sponsor's guide (not the investor's) and the page note, with the
//                     product's model settings; the earlier exchange goes with the next question; a vendor name in an
//                     answer is replaced; an address in a question is removed before it is sent; a failed call ends in
//                     the one sentence and the contact; nothing is requested over the network
//   preview-investor  an investor on Home, on a phone, by tapping: the investor's guide (not the sponsor's) and note, the
//                     firm as the contact, the product's name in an answer replaced
//   no-adapter        the portal's own diy.html (no preview lines) with window.claude present: the one sentence, unchanged
//   server-wins       the preview page with a server address saved: the server answers, `sample` is never called
//   consent           the first question of a view: when the viewer has not yet allowed the page, the preview asks
//                     once (permissions.request) and only then calls `sample`; a viewer who declines gets the one
//                     sentence and the contact, and `sample` is not called
//   files             the preview page loads help-data.js and help-preview.js right before help.js; the product's pages
//                     do not; help-data.js matches the server's guide (its generator's --verify passes)
//   NODE_PATH=$(npm root -g) node help-preview.js [--only preview-sponsor,...]
// The last line is "HELP PREVIEW: PASS (parts run: N)" or "HELP PREVIEW: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFileSync } = require('child_process');
const P6 = path.resolve(__dirname, '..', '..', '06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa', 'checks');
const Lib = require(path.join(P6, 'lib.js'));

const OUT = path.join(Lib.OUT, 'help-preview');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([[/-preview-answer\.png$/, 'The Help dialog in the preview, answering through the preview frame (no server).']]);

const PREVIEW_DIR = path.join(Lib.ROOT, '.planning', 'tools', 'preview');
const PREVIEW_PAGE = path.join(PREVIEW_DIR, 'diy-portal.html');
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const SCRIPTS = "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const CSP = (allow) => `connect-src ${allow && allow.length ? allow.join(' ') : "'none'"}; ${SCRIPTS}`;
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
const NO_SERVER = 'Help is available once the portal is connected.';
const NOT_NOW = 'Help is not available right now.';
const CANNOT = 'I do not have that information.';
const SUPPORT = 'help@platform.example';
const withSupport = (v) => `window.CVPortalConfig = { supportEmail: ${JSON.stringify(v)} };`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const REFUSAL_NOTICE = /Refused to connect|Content Security Policy/;

/**
 * The stand-in for the artifact's runtime: window.claude.use('sample') resolves a function that records each call (its
 * turns, its options without the signal, whether a signal came) in window.__samples and answers window.__next: an
 * object { kind, answer } (sent back as JSON text), { text } (sent as is) or { fail: code } (rejected with that code).
 * permissions resolves only when window.__perm is set; every other capability resolves null.
 */
const STUB = `(() => {
  window.__samples = [];
  window.__next = { kind: 'answer', answer: 'An answer.' };
  const sample = (input, opts) => {
    const o = Object.assign({}, opts || {});
    const hasSignal = !!o.signal;
    delete o.signal;
    delete o.onText;
    window.__samples.push({ input: JSON.parse(JSON.stringify(input)), opts: o, hasSignal });
    const n = window.__next;
    if (n && n.fail) return Promise.reject({ code: n.fail, message: 'stand-in failure' });
    const text = n && typeof n.text === 'string' ? n.text : JSON.stringify({ kind: n.kind, answer: n.answer });
    return new Promise((r) => setTimeout(() => r({ text, truncated: false, modelApplied: o.model }), 150));
  };
  // window.__perm: null (no permissions namespace) or { state, answer }: state() resolves state, request() records the
  // names asked in window.__permAsked and resolves answer for them.
  window.__perm = null;
  window.__permAsked = [];
  const permissions = {
    state: (n) => Promise.resolve(window.__perm ? window.__perm.state : 'granted'),
    request: (names) => {
      window.__permAsked.push(names);
      const o = {};
      (names || []).forEach((k) => (o[k] = window.__perm.answer));
      return new Promise((r) => setTimeout(() => r(o), 300));
    }
  };
  window.claude = { use: (name) => Promise.resolve(name === 'sample' ? sample : name === 'permissions' && window.__perm ? permissions : null) };
})();`;

/** The preview page's own script lines that come before help.js and are not the product's (help-data.js, help-preview.js). */
function previewLines() {
  const html = fs.readFileSync(PREVIEW_PAGE, 'utf8');
  const before = html.split('<script src="assets/js/help.js"></script>')[0];
  return (before.match(/<script src="(?!assets\/)[^"]+"><\/script>/g) || []).join('\n');
}

/**
 * This check's page server: the repository's files; /diy-preview.html is diy.html with the preview page's own lines put
 * right before help.js; /help-data.js and /help-preview.js come from .planning/tools/preview/ (where the preview build
 * copies them from). The portal's pages are sent with the frame's policy (?allow=<origin> lets one origin through).
 */
let pagesAt = null;
function pageServer() {
  if (pagesAt) return pagesAt;
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://local');
    const name = decodeURIComponent(u.pathname);
    if (name === '/__frame-host.html') {
      const src = String(u.searchParams.get('src') || '').replace(/[^\w:/.?=&%-]/g, '');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${src}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`);
    }
    const csp = CSP(u.searchParams.getAll('allow'));
    if (name === '/diy-preview.html') {
      const html = fs.readFileSync(path.join(Lib.ROOT, 'diy.html'), 'utf8').replace('<script src="assets/js/help.js"></script>', `${previewLines()}\n<script src="assets/js/help.js"></script>`);
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'Content-Security-Policy': csp });
      return res.end(html);
    }
    const p = /^\/help-(data|preview)\.js$/.test(name) ? path.join(PREVIEW_DIR, name.slice(1)) : path.join(Lib.ROOT, name);
    if (!p.startsWith(Lib.ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    const head = { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (/^\/(diy|index|portal)\.html$/.test(name)) head['Content-Security-Policy'] = csp;
    res.writeHead(200, head);
    fs.createReadStream(p).pipe(res);
  });
  pagesAt = new Promise((r) =>
    server.listen(0, '127.0.0.1', () => {
      server.unref();
      r(`http://127.0.0.1:${server.address().port}`);
    })
  );
  return pagesAt;
}

/** A fresh context whose page frames the given file under the policy, with the runtime stand-in; { A, fr, phone }. */
async function framed(S, vp, opts) {
  opts = opts || {};
  const pages = await pageServer();
  const query = (opts.allow || []).map((a) => 'allow=' + encodeURIComponent(a)).join('&');
  const base = `${pages}/${opts.file || 'diy-preview.html'}${query ? '?' + query : ''}`;
  const A = await Lib.open(S, { context: VIEW[vp], allow: [pages].concat(opts.allow || []), init: (opts.init || '') + '\n' + STUB });
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.page.goto(`${pages}/__frame-host.html?src=${encodeURIComponent(base)}`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr, phone: vp === 'phone', base };
}

async function samplePortal(fr) {
  await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
}
async function signInAs(fr, role) {
  await fr.selectOption('#demo-role', role);
  await fr.waitForFunction((r) => window.CVPortal.state.role === r, role, { timeout: 5000 });
  await fr.waitForTimeout(500);
}
const setServer = (fr, url, token) =>
  fr.evaluate(
    ({ url, token }) => {
      const NS = window.CVPortal;
      const s = NS.integrations.ensure(NS.state.ws).server;
      s.url = url;
      s.token = token || '';
      NS.app.save(true);
    },
    { url, token }
  );
const press = (T, sel) => (T.phone ? T.fr.tap(sel) : T.fr.click(sel));
const scriptErrors = (A) => A.errors.filter((e) => !REFUSAL_NOTICE.test(e));
async function openHelp(T) {
  await press(T, '[data-action="help-open"]');
  await T.fr.waitForSelector('#dlg[open].dlg-help', { timeout: 5000 });
  await T.fr.waitForTimeout(250);
}

/** The dialog as a person reads it: its lines, its field and Send, and each exchange with its paragraphs' classes. */
function talk(fr) {
  return fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const form = d.querySelector('form[data-form="help-ask"]');
    const input = form ? form.querySelector('input') : null;
    const send = form ? form.querySelector('button[type="submit"]') : null;
    const log = d.querySelector('[role="log"]');
    const text = (e) => (e ? e.textContent : null);
    return {
      field: input ? { label: input.getAttribute('aria-label'), max: input.getAttribute('maxlength') } : null,
      send: send ? { text: send.textContent.trim(), disabled: send.disabled } : null,
      fields: d.querySelectorAll('input, textarea, select').length,
      strangers: log ? Array.from(log.querySelectorAll('*')).filter((e) => !e.matches('.help-x, .help-x > p')).map((e) => e.tagName) : [],
      items: log
        ? Array.from(log.querySelectorAll('.help-x')).map((x) => ({
            q: text(x.querySelector('.help-q')),
            a: text(x.querySelector('.help-a')),
            contact: text(x.querySelector('.help-contact')),
            classes: Array.from(x.children).map((p) => p.className)
          }))
        : [],
      lines: d.innerText.split('\n').map((l) => l.trim()).filter(Boolean)
    };
  });
}

const FIELD = '#dlg form[data-form="help-ask"] input';
const SEND = '#dlg form[data-form="help-ask"] button[type="submit"]';
/** Set the stand-in's next answer, type the question, press Send and wait for the answer (or the failure sentence). */
async function askQ(T, text, next) {
  await T.fr.evaluate((n) => (window.__next = n), next);
  await T.fr.fill(FIELD, text);
  await press(T, SEND);
  await T.fr.waitForFunction(
    () => {
      const x = document.querySelector('#dlg [role="log"] .help-x');
      const b = document.querySelector('#dlg form[data-form="help-ask"] button[type="submit"]');
      return !!x && !x.querySelector('.help-wait') && !!b && !b.disabled;
    },
    null,
    { timeout: 25000, polling: 50 }
  );
}
const samples = (fr) => fr.evaluate(() => window.__samples.slice());

/** The server's own help data (rules, guides, pages), read from the server module the preview data is made from. */
let dataP = null;
const serverData = () => dataP || (dataP = import(path.join(Lib.ROOT, 'server', 'lib', 'help-guide.mjs')));

/** What one recorded call carried: all of its text, its last turn, its options. */
function carried(call) {
  const turns = (call && call.input) || [];
  const all = Array.isArray(turns) ? turns.map((t) => String(t.content)).join('\n') : String(turns);
  const last = Array.isArray(turns) && turns.length ? turns[turns.length - 1] : null;
  return { turns, all, last, opts: (call && call.opts) || {}, hasSignal: !!(call && call.hasSignal) };
}
const PRODUCT_OPTS = { model: 'claude-haiku-5-5', modelTier: 'quick', effort: 'low', cache: false };
const optsOk = (c) => Object.keys(PRODUCT_OPTS).every((k) => c.opts[k] === PRODUCT_OPTS[k]) && c.hasSignal;

/** What every part ends with: no script error, nothing requested beyond this check's servers, no vendor word on screen. */
async function ending(check, T, screens) {
  check('no script error in the browser', scriptErrors(T.A).length === 0, scriptErrors(T.A));
  check("no request went anywhere but this check's own servers", T.A.net.external.length === 0, T.A.net.external);
  const leak = Lib.leakCheck(screens.join('\n'));
  check('no vendor, model or library name and no forbidden word on the screens read', leak.ok, leak.hits);
}

/** A stand-in for the help route that answers every question (only for server-wins). */
function standIn() {
  const seen = [];
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-invite-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.push({ method: req.method, path: req.url, raw });
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch (e) {
        body = {};
      }
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
      res.end(JSON.stringify({ ok: true, kind: 'answer', answer: `The server answered: ${String(body.message || '').slice(0, 60)}`, session: 'srv-1' }));
    });
  });
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({
        origin: `http://127.0.0.1:${server.address().port}`,
        posts: () => seen.filter((x) => x.method === 'POST'),
        close: () =>
          new Promise((done) => {
            if (server.closeAllConnections) server.closeAllConnections();
            server.close(() => done());
          })
      })
    )
  );
}

const parts = {
  'preview-sponsor': async ({ check, S }) => {
    const D = await serverData();
    const T = await framed(S, 'desktop', { init: withSupport(SUPPORT) });
    const { A, fr } = T;
    const screens = [];
    const want = `Contact support at ${SUPPORT}.`;
    const NOTE = `The person is an admin of the firm, on ${D.PAGES['console-investors'].where}.`;
    try {
      await samplePortal(fr);
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await openHelp(T);
      let s = await talk(fr);
      check('the preview dialog has the field "Ask a question" and Send, as with a server', !!s.field && s.field.label === 'Ask a question' && s.field.max === '500' && !!s.send && s.send.text === 'Send' && !s.send.disabled, s);
      check('before a question it says nothing but its heading and Send (not the "connected" sentence)', same(s.lines, ['Help', 'Send']), s.lines);
      if (!s.field) return;

      // 1. an answer, shown as a server answer is
      const Q1 = 'How do I invite an investor?';
      const A1 = 'Open Investors, then press "Invite an investor".';
      await askQ(T, Q1, { kind: 'answer', answer: A1 });
      s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      check('the answer shows under the question as text, in the same paragraphs a server answer uses, with no contact', s.items.length === 1 && s.items[0].q === Q1 && s.items[0].a === A1 && s.items[0].contact === null && same(s.items[0].classes, ['help-q', 'help-a']) && s.strangers.length === 0, s.items);
      await A.page.screenshot({ path: path.join(OUT, 'desktop-preview-answer.png'), fullPage: false });
      let calls = await samples(fr);
      let c = carried(calls[0]);
      check('the preview asked `sample` exactly once for it', calls.length === 1, calls.length);
      check("the request carries the rules and the sponsor's guide, and not the investor's guide", c.all.includes(D.RULES) && c.all.includes(D.GUIDE.sponsor) && !c.all.includes(D.GUIDE.investor), { len: c.all.length });
      check(`its last turn is the person's, with the question and the note "${NOTE}"`, !!c.last && c.last.role === 'user' && c.last.content.includes(Q1) && c.last.content.includes(NOTE), c.last && c.last.content.slice(-400));
      check("it uses the product's settings (quick tier, the product's model, low effort, no replay) and a stop signal", optsOk(c), c.opts);

      // 2. the earlier exchange goes with the next question; a vendor name in the answer is replaced
      await askQ(T, 'Which assistant are you?', { kind: 'answer', answer: 'I am Claude, made by Anthropic.' });
      s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      check(`an answer naming a vendor is replaced by "${CANNOT}" and followed by the contact`, s.items.length === 2 && s.items[0].a === CANNOT && s.items[0].contact === want && !/claude|anthropic/i.test(s.lines.join(' ')), s.items[0]);
      calls = await samples(fr);
      c = carried(calls[1]);
      check('the second request carries the first exchange (question, then the answer shown) before the new question', c.turns.length === 3 && c.turns[0].role === 'user' && c.turns[0].content.includes(Q1) && c.turns[1].role === 'assistant' && c.turns[1].content.includes(A1) && c.last.role === 'user' && c.last.content.includes('Which assistant are you?'), c.turns.map((t) => [t.role, String(t.content).slice(-80)]));
      check("the rules and the sponsor's guide still go with it", c.all.includes(D.RULES) && c.all.includes(D.GUIDE.sponsor) && !c.all.includes(D.GUIDE.investor));

      // 3. an address and a tax number in a question are removed before they are sent
      await askQ(T, 'I am dana@example.com, tax id 12-3456789: where do I sign?', { kind: 'answer', answer: 'Open E-sign.' });
      calls = await samples(fr);
      c = carried(calls[2]);
      s = await talk(fr);
      check('the address and the number never reach `sample`; "[removed]" stands in their place', !c.all.includes('dana@example.com') && !c.all.includes('12-3456789') && c.last.content.includes('I am [removed], tax id [removed]: where do I sign?'), c.last && c.last.content.slice(-300));
      check('the person still sees their own question as typed, and the answer', s.items[0].q === 'I am dana@example.com, tax id 12-3456789: where do I sign?' && s.items[0].a === 'Open E-sign.', s.items[0]);

      // 4. a failed call: the one sentence and the contact
      await askQ(T, 'Where are the tax forms?', { fail: 'rate_limited' });
      s = await talk(fr);
      check(`a failed call shows "${NOT_NOW}" and the contact`, s.items[0].a === NOT_NOW && s.items[0].contact === want, s.items[0]);
      await askQ(T, 'And the distributions?', { text: 'this is not the answer format' });
      s = await talk(fr);
      check('a reply that is not the answer format shows the same sentence and the contact', s.items[0].a === NOT_NOW && s.items[0].contact === want, s.items[0]);
      screens.push(await Lib.screenText(fr));
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('nothing was requested over the network (the frame refuses every connection)', refused.length === 0, refused);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
    }
  },

  'preview-investor': async ({ check, S }) => {
    const D = await serverData();
    const T = await framed(S, 'phone');
    const { A, fr } = T;
    const screens = [];
    const NOTE = `The person is an investor, on ${D.PAGES.overview.where}.`;
    try {
      await samplePortal(fr);
      await signInAs(fr, 'investor');
      await fr.evaluate(() => (location.hash = 'overview'));
      await fr.waitForFunction(() => window.CVPortal.state.route === 'overview' && !!document.querySelector('.pt-foot [data-action="help-open"]'), null, { timeout: 15000 });
      await fr.waitForTimeout(300);
      const sup = await fr.evaluate(() => {
        const s = window.CVPortal.state.ws.tenant.support;
        return { team: s.team, email: s.email };
      });
      const firm = `Contact ${sup.team} at ${sup.email}.`;
      await openHelp(T);
      let s = await talk(fr);
      check("the investor's dialog has the field and Send", !!s.field && !!s.send && same(s.lines, ['Help', 'Send']), s.lines);
      if (!s.field) return;
      const Q = 'Where do I sign my subscription agreement?';
      const AN = 'Open Documents and press Sign next to the agreement.';
      await askQ(T, Q, { kind: 'answer', answer: AN });
      s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      check('the answer shows under the question, as a server answer does', s.items.length === 1 && s.items[0].q === Q && s.items[0].a === AN && s.items[0].contact === null && same(s.items[0].classes, ['help-q', 'help-a']), s.items);
      await A.page.screenshot({ path: path.join(OUT, 'phone-preview-answer.png'), fullPage: false });
      const calls = await samples(fr);
      const c = carried(calls[0]);
      check("the request carries the rules and the investor's guide, and not the sponsor's guide", calls.length === 1 && c.all.includes(D.RULES) && c.all.includes(D.GUIDE.investor) && !c.all.includes(D.GUIDE.sponsor), { calls: calls.length });
      check(`its last turn holds the question and the note "${NOTE}"`, !!c.last && c.last.role === 'user' && c.last.content.includes(Q) && c.last.content.includes(NOTE), c.last && c.last.content.slice(-300));
      check("it uses the product's settings", optsOk(c), c.opts);
      await askQ(T, 'Who makes this portal?', { kind: 'answer', answer: 'Carrow & Vale makes this portal.' });
      s = await talk(fr);
      check(`for an investor an answer naming the product is replaced by "${CANNOT}", followed by the firm's contact`, s.items[0].a === CANNOT && s.items[0].contact === firm, s.items[0]);
      await askQ(T, 'Can you use another tool?', { kind: 'cannot', answer: 'That is not something this portal does.' });
      s = await talk(fr);
      check("an answer of the kind \"cannot\" is followed by the firm's contact, as with a server", s.items[0].a === 'That is not something this portal does.' && s.items[0].contact === firm, s.items[0]);
      screens.push(await Lib.screenText(fr));
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('nothing was requested over the network', refused.length === 0, refused);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
    }
  },

  'no-adapter': async ({ check, S }) => {
    const T = await framed(S, 'desktop', { file: 'diy.html' });
    const { A, fr } = T;
    try {
      await samplePortal(fr);
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await openHelp(T);
      const s = await talk(fr);
      const text = await Lib.screenText(fr);
      check(`the product's own page (no preview lines) still reads exactly "Help" and "${NO_SERVER}", with no field`, same(s.lines, ['Help', NO_SERVER]) && s.fields === 0, s.lines);
      const calls = await samples(fr);
      check('`sample` was never called', calls.length === 0, calls.length);
      await ending(check, T, [text]);
    } finally {
      await A.context.close();
    }
  },

  'server-wins': async ({ check, S }) => {
    const X = await standIn();
    const T = await framed(S, 'desktop', { allow: [X.origin] });
    const { A, fr } = T;
    try {
      await samplePortal(fr);
      await setServer(fr, X.origin, 'tok-preview');
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await openHelp(T);
      await askQ(T, 'How do I invite an investor?', { kind: 'answer', answer: 'From the preview frame.' });
      const s = await talk(fr);
      check('with a server address saved, the server answers', s.items.length === 1 && s.items[0].a === 'The server answered: How do I invite an investor?', s.items);
      check('exactly one request went to the server', X.posts().length === 1, X.posts().length);
      const calls = await samples(fr);
      check('`sample` was never called', calls.length === 0, calls.length);
      await ending(check, T, [await Lib.screenText(fr)]);
    } finally {
      await A.context.close();
      await X.close();
    }
  },

  consent: async ({ check, S }) => {
    const T = await framed(S, 'desktop', { init: withSupport(SUPPORT) });
    const { A, fr } = T;
    const want = `Contact support at ${SUPPORT}.`;
    try {
      await samplePortal(fr);
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await openHelp(T);
      await fr.evaluate(() => (window.__perm = { state: 'prompt', answer: 'granted' }));
      await askQ(T, 'How do I invite an investor?', { kind: 'answer', answer: 'Open Investors.' });
      let s = await talk(fr);
      let asked = await fr.evaluate(() => window.__permAsked.slice());
      let calls = await samples(fr);
      check('not yet allowed: the preview asks once for `sample`, then asks the question; the answer shows', same(asked, [['sample']]) && calls.length === 1 && s.items[0].a === 'Open Investors.', { asked, calls: calls.length, item: s.items[0] });
      await fr.evaluate(() => (window.__perm = { state: 'granted', answer: 'granted' }));
      await askQ(T, 'And the tax forms?', { kind: 'answer', answer: 'Open Tax documents.' });
      asked = await fr.evaluate(() => window.__permAsked.slice());
      calls = await samples(fr);
      check('allowed: it does not ask again', asked.length === 1 && calls.length === 2, { asked, calls: calls.length });
      await fr.evaluate(() => (window.__perm = { state: 'prompt', answer: 'denied' }));
      await askQ(T, 'And the distributions?', { kind: 'answer', answer: 'never shown' });
      s = await talk(fr);
      calls = await samples(fr);
      check(`declined: "${NOT_NOW}" and the contact; \`sample\` is not called`, s.items[0].a === NOT_NOW && s.items[0].contact === want && calls.length === 2, { item: s.items[0], calls: calls.length });
      await fr.evaluate(() => (window.__perm = { state: 'denied', answer: 'denied' }));
      await askQ(T, 'Once more?', { kind: 'answer', answer: 'never shown' });
      s = await talk(fr);
      asked = await fr.evaluate(() => window.__permAsked.slice());
      calls = await samples(fr);
      check('denied earlier: no new ask, no call, the same sentence', s.items[0].a === NOT_NOW && asked.length === 2 && calls.length === 2, { asked, calls: calls.length });
      await ending(check, T, [await Lib.screenText(fr)]);
    } finally {
      await A.context.close();
    }
  },

  files: async ({ check }) => {
    const html = fs.readFileSync(PREVIEW_PAGE, 'utf8');
    check('the preview page loads help-data.js, then help-preview.js, right before help.js', /<script src="help-data\.js"><\/script>\s*<script src="help-preview\.js"><\/script>\s*<script src="assets\/js\/help\.js"><\/script>/.test(html));
    const product = ['index.html', 'diy.html', 'portal.html'].map((f) => fs.readFileSync(path.join(Lib.ROOT, f), 'utf8'));
    check("none of the product's pages loads either preview file", product.every((h) => !/help-data\.js|help-preview\.js/.test(h)));
    check('both preview files exist in .planning/tools/preview/', ['help-data.js', 'help-preview.js'].every((f) => fs.existsSync(path.join(PREVIEW_DIR, f))));
    let out = '';
    let ok = false;
    try {
      out = execFileSync(process.execPath, [path.join(PREVIEW_DIR, 'make-help-data.mjs'), '--verify'], { cwd: Lib.ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      ok = true;
    } catch (e) {
      out = String((e && (e.stdout || e.stderr || e.message)) || e).split('\n').slice(0, 3).join(' ');
    }
    check('help-data.js matches the server guide (make-help-data.mjs --verify passes)', ok, out.trim());
    const src = fs.readFileSync(path.join(Lib.ROOT, 'assets', 'js', 'help.js'), 'utf8');
    const named = src.split('\n').filter((l) => Lib.VENDOR_RE.test(l) || Lib.VENDORS.test(l) || Lib.WORD_RE.test(l));
    check('help.js still names no vendor or model', named.length === 0, named);
    check('help.js still has the one plain fetch and keeps nothing in storage', (src.match(/\bfetch\(/g) || []).length === 1 && !/localStorage|sessionStorage|indexedDB/.test(src));
  }
};

Lib.runParts(parts, { name: 'HELP PREVIEW', unit: 'parts', flag: '--only', browser: true });
