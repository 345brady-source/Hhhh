#!/usr/bin/env node
// Plan 07-03: Help in the browser, under the conditions the owner tests in. Every part loads the portal in a sandboxed
// iframe (as the published preview runs it) whose content security policy refuses every connection, or allows only this
// check's own stand-in server; at 1280x800 with a mouse and at 390x844 with touch.
//   nosrv-desktop    no server address: a sponsor presses Help and reads one plain sentence; nothing is requested;
//                    the dialog closes by its X, by Escape and by browser back
//   investor         the investor's Help in the page footer (Home, Documents, an invitation's page) and their firm's
//                    own team and address as the contact; at both sizes
//   support          the sponsor's contact: the published page's support address, shown only when it is one;
//                    without it a team member is pointed to their administrator and an admin sees no contact line
//   refused-desktop  a server address the frame refuses: one request, never retried, one plain sentence within 2 seconds
//   answers-desktop  a stand-in server that answers: plain text, only the five allowed fields sent, the contact after
//                    an answer that cannot help, the conversation kept while the person and the portal stay the same
//   failures         every kind of failed answer ends in the same sentence
//   nosrv-phone      nosrv-desktop on a phone, by tapping: Help in the bar's first row, nothing wider than the window
//   refused-phone    refused-desktop on a phone, by tapping
//   answers-phone    six long answers read to the oldest with a finger while Close, the field and Send stay on screen;
//                    the keyboard's part of the screen (the top 300px, and a frame shrunk to 420px) keeps them all
//   managed          the managed edition (index.html) has no help control, action or class; help.js names no vendor
//   NODE_PATH=$(npm root -g) node help-chat.js [--only nosrv-desktop,...]
// The last line is "HELP CHAT: PASS (parts run: N)" or "HELP CHAT: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const http = require('http');
const P6 =path.resolve(__dirname, '..', '..', '06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa', 'checks');
const Lib = require(path.join(P6, 'lib.js'));

const OUT = path.join(Lib.OUT, 'help-chat');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-bar\.png$/, 'The console with Help in its bar, the portal in a framed page that refuses connections.'],
  [/-nosrv\.png$/, 'The Help dialog with no server connected: one sentence and, where there is one, the contact.']
]);

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const SCRIPTS = "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
/** The frame's policy: every connection refused, or only those to the given origins allowed. */
const CSP = (allow) => `connect-src ${allow && allow.length ? allow.join(' ') : "'none'"}; ${SCRIPTS}`;
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
const NO_SERVER = 'Help is available once the portal is connected.';
const NOT_NOW = 'Help is not available right now.';
const SUPPORT = 'help@platform.example';
/** The published page's settings, set before the page's own scripts (as a firm sets them where the portal is published). */
const withSupport = (v) => `window.CVPortalConfig = { supportEmail: ${JSON.stringify(v)} };`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The browser's own console notice of a connection its policy refused is not a script error.
const REFUSAL_NOTICE = /Refused to connect|Content Security Policy/;

/**
 * A fresh context whose page holds the portal in a sandboxed iframe served with the policy; resolves to { A, fr, phone }.
 * opts: { file: 'diy.html' | 'index.html', allow: origins the frame may reach, init: a script run before the page's own,
 * height: the iframe's CSS height (the window's by default) }.
 */
async function framed(S, vp, opts) {
  opts = opts || {};
  const file = opts.file || 'diy.html';
  const pages = await pageServer();
  const query = (opts.allow || []).map((a) => 'allow=' + encodeURIComponent(a)).join('&');
  const base = `${pages}/${file}${query ? '?' + query : ''}`;
  const A = await Lib.open(S, { context: VIEW[vp], allow: [pages].concat(opts.allow || []), init: opts.init });
  // every refused request, in every frame, kept where the check can read it
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.page.goto(`${pages}/__frame-host.html?src=${encodeURIComponent(base)}&h=${encodeURIComponent(opts.height || '100vh')}`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  return { A, fr, phone: vp === 'phone', base, pages };
}

/**
 * This check's own page server: the repository's files, the portal's pages sent with the frame's policy as a response
 * header (as the preview's host sends it), and the page that frames them. The policy is asked for in the address:
 * ?allow=<origin> lets the page reach that origin and nothing else; without it every connection is refused. (A page
 * answered by the browser's request router, as no-network.js does it, is not let through to another port of this
 * machine by the browser, so it could never reach the stand-in.) Resolves to the server's origin.
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
      const h = String(u.searchParams.get('h') || '100vh').replace(/[^\w%]/g, '');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${src}" style="border:0;width:100vw;height:${h};display:block"></iframe></body></html>`);
    }
    const p = path.join(Lib.ROOT, name);
    if (!p.startsWith(Lib.ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    const head = { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (/^\/(diy|index|portal)\.html$/.test(name)) head['Content-Security-Policy'] = CSP(u.searchParams.getAll('allow'));
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

/** The frame refuses a fetch of a file that is there (the check's own proof that the policy is in force). */
async function proveRefused(check, A, fr) {
  const r = await fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(r), r);
  await fr.evaluate(() => (window.__cspv = []));
  A.errors.length = 0;
}

/** The self-serve sample portal (Kestrel Bay), fresh. */
async function samplePortal(fr) {
  await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await fr.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
}

const hash = (fr) => fr.evaluate(() => location.hash);
const dlgOpen = (fr) => fr.evaluate(() => !!(document.getElementById('dlg') || {}).open);
const press = (T, sel) => (T.phone ? T.fr.tap(sel) : T.fr.click(sel));
const scriptErrors = (A) => A.errors.filter((e) => !REFUSAL_NOTICE.test(e));

/** Every help control on the page: where it is, what it says, whether it is whole inside the window and what it overlaps. */
function controls(fr) {
  return fr.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const over = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b && a.w > 0 && b.w > 0;
    const name = Array.from(document.querySelectorAll('.cs-client .lockup, .cs-client .cs-client-meta')).filter((e) => e.offsetWidth);
    const bell = document.querySelector('.cs-bell');
    return Array.from(document.querySelectorAll('[data-action="help-open"]')).map((el) => {
      const b = box(el);
      const hit = document.elementFromPoint(b.l + b.w / 2, b.t + b.h / 2);
      return {
        text: el.textContent,
        tag: el.tagName,
        inNav: !!el.closest('.cs-nav'),
        inFoot: !!el.closest('.pt-foot'),
        box: b,
        inside: b.w > 0 && b.h > 0 && b.l >= 0 && b.r <= innerWidth && b.t >= 0 && b.b <= innerHeight,
        onTop: !!hit && (hit === el || el.contains(hit)),
        overBell: !!bell && over(b, box(bell)),
        overName: name.some((n) => over(b, box(n))),
        nameSeen: name.length
      };
    });
  });
}

/** The open dialog: its class, its lines of text, its fields, and whether its Close button is whole on screen and on top. */
function dialogState(fr) {
  return fr.evaluate(() => {
    const d = document.getElementById('dlg');
    if (!d || !d.open) return { open: false };
    const x = d.querySelector('[data-action="close-dialog"][aria-label="Close"]');
    const r = x ? x.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    const dr = d.getBoundingClientRect();
    return {
      open: true,
      cls: d.className,
      heading: (d.querySelector('.dlg-head h2') || {}).textContent || '',
      lines: d.innerText.split('\n').map((l) => l.trim()).filter(Boolean),
      fields: d.querySelectorAll('input, textarea, select').length,
      close: !!r && r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && !!hit && (hit === x || x.contains(hit)),
      box: { l: Math.round(dr.left), t: Math.round(dr.top), r: Math.round(dr.right), b: Math.round(dr.bottom) },
      win: { w: innerWidth, h: innerHeight },
      pageW: document.documentElement.scrollWidth
    };
  });
}

async function openHelp(T) {
  await press(T, '[data-action="help-open"]');
  await T.fr.waitForSelector('#dlg[open].dlg-help', { timeout: 5000 });
  await T.fr.waitForTimeout(250);
}

/** What every part ends with: no script error, nothing sent beyond the check server (and the stand-in), no vendor word. */
async function ending(check, T, screens) {
  check('no script error in the browser', scriptErrors(T.A).length === 0, scriptErrors(T.A));
  check("no request went anywhere but this check's own servers", T.A.net.external.length === 0, T.A.net.external);
  const leak = Lib.leakCheck(screens.join('\n'));
  check('no vendor, model or library name and no forbidden word on the screens read', leak.ok, leak.hits);
}

/**
 * This check's stand-in for the help route (plan 07-02 builds the real one): it speaks the contract, records every
 * request and answers by the question's first word. Resolves to { origin, seen, posts(), close() }.
 */
function standIn() {
  const seen = [];
  let sessions = 0;
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-invite-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
  const LONG = Array.from({ length: 9 }, (_, i) => `Line ${i + 1} of a long answer: open the page named in the menu, choose the row, then press the button at its end.`).join('\n');
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body = null;
      try {
        body = JSON.parse(raw);
      } catch (e) {
        body = null;
      }
      seen.push({ method: req.method, path: req.url, auth: req.headers.authorization || '', invite: req.headers['x-invite-token'] || '', type: req.headers['content-type'] || '', raw, body });
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (req.method !== 'POST' || req.url !== '/v1/help') {
        res.writeHead(404, Object.assign({ 'Content-Type': 'application/json' }, CORS));
        return res.end('{"ok":false}');
      }
      const word = String((body && body.message) || '').trim().split(/\s+/)[0].toLowerCase();
      const session = (body && body.session) || `sess-${++sessions}`;
      const json = (status, o) => {
        res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, CORS));
        res.end(typeof o === 'string' ? o : JSON.stringify(o));
      };
      const answer = (kind, text) => json(200, { ok: true, kind, answer: text, session });
      if (word === 'f500') {
        res.writeHead(500, Object.assign({ 'Content-Type': 'text/plain' }, CORS));
        return res.end('Internal Server Error: upstream exploded at line 42');
      }
      if (word === 'f429') return json(429, { ok: false, reason: 'limit' });
      if (word === 'f402') return json(402, { ok: false, reason: 'budget' });
      if (word === 'garbled') return json(200, '<html>not json</html>');
      if (word === 'noanswer') return json(200, { ok: true });
      if (word === 'number') return json(200, { ok: true, kind: 'answer', answer: 12345, session });
      if (word === 'cut') {
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json', 'Content-Length': '400' }, CORS));
        res.write('{"ok":true,"kind":"answer","answer":"this answer is cut');
        return setTimeout(() => req.socket.destroy(), 50);
      }
      if (word === 'lines') return answer('answer', 'Open Investors.\nPress "Invite an investor".\n\nThen send the link.');
      if (word === 'markup') return answer('answer', '<img src=x onerror="window.__helpx=1"><b>bold</b> stays as characters');
      if (word === 'cannot') return answer('cannot', 'I cannot help with that here.');
      if (word === 'scope') return answer('out_of_scope', 'I can only help with using this portal.');
      if (word === 'long') return answer('answer', LONG);
      if (word === 'slow') return setTimeout(() => answer('answer', 'A slow answer.'), 1200);
      return answer('answer', `An answer to: ${String((body && body.message) || '').slice(0, 60)}`);
    });
  });
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({
        origin: `http://127.0.0.1:${server.address().port}`,
        seen,
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

/** The demo's role control (admin, team or investor), as a person changes it. */
async function signInAs(fr, role) {
  await fr.selectOption('#demo-role', role);
  await fr.waitForFunction((r) => window.CVPortal.state.role === r, role, { timeout: 5000 });
  await fr.waitForTimeout(500);
}

/** A server address (and token) saved under Integrations, as the Integrations page saves it. */
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

/** The conversation as the dialog shows it, newest first, and the form's state. */
function talk(fr) {
  return fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const form = d.querySelector('form[data-form="help-ask"]');
    const input = form ? form.querySelector('input') : null;
    const send = form ? form.querySelector('button[type="submit"]') : null;
    const log = d.querySelector('[role="log"]');
    const text = (e) => (e ? e.textContent : null);
    return {
      open: !!d.open && d.classList.contains('dlg-help'),
      field: input ? { label: input.getAttribute('aria-label'), hint: input.getAttribute('placeholder'), max: input.getAttribute('maxlength'), auto: input.getAttribute('autocomplete'), enter: input.getAttribute('enterkeyhint'), type: input.type, font: parseFloat(getComputedStyle(input).fontSize), value: input.value } : null,
      send: send ? { text: send.textContent.trim(), disabled: send.disabled } : null,
      logAfterForm: !!(form && log && form.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING),
      // anything in the log that is not an exchange or one of its paragraphs was created from somebody's text
      strangers: log ? Array.from(log.querySelectorAll('*')).filter((e) => !e.matches('.help-x, .help-x > p')).map((e) => e.tagName) : ['(no log)'],
      items: log
        ? Array.from(log.querySelectorAll('.help-x')).map((x) => {
            const a = x.querySelector('.help-a');
            return { q: text(x.querySelector('.help-q')), a: text(a), wait: !!x.querySelector('.help-wait'), contact: text(x.querySelector('.help-contact')), space: a ? getComputedStyle(a).whiteSpace : '', aLines: a ? a.innerText.split('\n').length : 0 };
          })
        : [],
      lines: d.innerText.split('\n').map((l) => l.trim()).filter(Boolean)
    };
  });
}

const FIELD = '#dlg form[data-form="help-ask"] input';
const SEND = '#dlg form[data-form="help-ask"] button[type="submit"]';
/** Type a question and press Send; resolves once the answer (or the failure sentence) is in, with the milliseconds it took. */
async function askQ(T, text, opts) {
  opts = opts || {};
  await T.fr.fill(FIELD, text);
  const t0 = Date.now();
  await press(T, SEND);
  if (opts.noWait) return 0;
  await T.fr.waitForFunction(
    () => {
      const x = document.querySelector('#dlg [role="log"] .help-x');
      const b = document.querySelector('#dlg form[data-form="help-ask"] button[type="submit"]');
      return !!x && !x.querySelector('.help-wait') && !!b && !b.disabled;
    },
    null,
    { timeout: opts.timeout || 8000, polling: 50 }
  );
  return Date.now() - t0;
}

/** A server address the frame refuses: one request and one plain sentence, twice over. */
function refusedPart(vp) {
  return async ({ check, S }) => {
    const T = await framed(S, vp, { init: withSupport(SUPPORT) });
    const { A, fr } = T;
    const screens = [];
    const want = `Contact support at ${SUPPORT}.`;
    try {
      await proveRefused(check, A, fr);
      await samplePortal(fr);
      await setServer(fr, 'https://portal-server.example', 'tok-refused');
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await fr.waitForTimeout(1500);
      const quiet = await fr.evaluate(() => window.__cspv.slice());
      check('with a server address saved, the console itself attempts no connection', quiet.length === 0, quiet);
      await fr.evaluate(() => (window.__cspv = []));
      await openHelp(T);
      const s0 = await talk(fr);
      check('the dialog has the field "Ask a question" (500 characters at most, no saved suggestions, Send on the keyboard) and Send', !!s0.field && s0.field.label === 'Ask a question' && s0.field.hint === 'Ask a question' && s0.field.max === '500' && s0.field.auto === 'off' && s0.field.enter === 'send' && s0.field.type === 'text' && !!s0.send && s0.send.text === 'Send' && !s0.send.disabled, s0);
      check(`the field's text is at least 16px (${s0.field ? s0.field.font : '-'}px), so a phone does not zoom the page`, !!s0.field && s0.field.font >= 16, s0.field);
      check('before a question the dialog says nothing but its heading and Send', same(s0.lines, ['Help', 'Send']), s0.lines);
      if (!s0.field) return;
      let n = 0;
      for (const q of ['How do I invite an investor?', 'Where are the tax forms?']) {
        n++;
        const ms = await askQ(T, q, { timeout: 4000 }).catch(() => -1);
        const s = await talk(fr);
        screens.push(await Lib.screenText(fr));
        check(`question ${n}: within 2 seconds (${ms} ms) the question shows with "${NOT_NOW}" and the contact`, ms >= 0 && ms <= 2000 && s.items.length === n && s.items[0].q === q && s.items[0].a === NOT_NOW && s.items[0].contact === want, { ms, items: s.items });
        // the browser reports a refused connection a moment after it refuses it
        await fr.waitForFunction((k) => window.__cspv.length >= k, n, { timeout: 2000 }).catch(() => {});
        await fr.waitForTimeout(400);
        const v = await fr.evaluate(() => window.__cspv.slice());
        check(`question ${n}: exactly one refused connection for it (${v.length} in all)`, v.length === n && v.every((x) => /^connect-src /.test(x)), v);
        check(`question ${n}: Send can be used again`, !!s.send && !s.send.disabled && s.field.value === '', s.send);
        if (n === 1) {
          await fr.waitForTimeout(9500);
          const later = await fr.evaluate(() => window.__cspv.slice());
          check('9.5 seconds later there is still exactly one (no retry)', later.length === 1, later);
          await A.page.screenshot({ path: path.join(OUT, `${vp}-refused.png`), fullPage: false });
        }
      }
      const all = screens.join('\n');
      check('the page nowhere says "Failed to fetch" or names an error', !/Failed to fetch|TypeError|NetworkError|Load failed|refused/i.test(all), all.slice(0, 400));
      const d = await dialogState(fr);
      check('the Close button is whole on screen and on top', d.close, d);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
    }
  };
}

/** The investor's Help at one size: the page footer on Home, on Documents and on an invitation's page. */
async function investorAt(check, S, vp) {
  const T = await framed(S, vp);
  const { A, fr } = T;
  const screens = [];
  const tag = vp === 'phone' ? '390x844' : '1280x800';
  try {
    await proveRefused(check, A, fr);
    const portal = await Lib.setupPortal({ base: T.base }, { page: fr, context: A.context });
    const sup = await fr.evaluate(() => {
      const s = window.CVPortal.state.ws.tenant.support;
      return { team: s.team, email: s.email };
    });
    check(`${tag}: the sample firm has a team name and an address of its own`, !!sup.team && /@/.test(sup.email), sup);
    const firm = `Contact ${sup.team} at ${sup.email}.`;
    await signInAs(fr, 'investor');
    for (const route of ['overview', 'documents']) {
      await fr.evaluate((r) => (location.hash = r), route);
      await fr.waitForFunction((r) => window.CVPortal.state.route === r && !!document.querySelector('.pt-foot'), route, { timeout: 15000 });
      await fr.waitForTimeout(300);
      const c = await controls(fr);
      check(`${tag} ${route}: exactly one Help control, a button in the page footer saying "Help"`, c.length === 1 && c[0].inFoot && c[0].tag === 'BUTTON' && c[0].text === 'Help', c);
      if (c.length !== 1) return;
      if (vp === 'phone') check(`${tag} ${route}: it is at least 40px tall for a finger (${Math.round(c[0].box.h)}px)`, c[0].box.h >= 40, c[0].box);
      await openHelp(T);
      const d = await dialogState(fr);
      screens.push(await Lib.screenText(fr));
      check(`${tag} ${route}: the dialog is the heading, the sentence and the firm's own team and address`, same(d.lines, ['Help', NO_SERVER, firm]) && d.fields === 0, d.lines);
      check(`${tag} ${route}: the dialog is inside the window and its Close button on screen`, d.close && d.box.l >= 0 && d.box.r <= d.win.w && d.box.t >= 0 && d.box.b <= d.win.h, d);
      if (route === 'overview') await A.page.screenshot({ path: path.join(OUT, `${vp}-investor.png`), fullPage: false });
      await press(T, '#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
      check(`${tag} ${route}: the Close button closes it`, !(await dlgOpen(fr)));
    }
    await fr.evaluate(() => (window.CVPortal.state.ws.tenant.support.email = ''));
    await openHelp(T);
    let d = await dialogState(fr);
    check(`${tag}: with the firm's address emptied the contact is "Contact ${sup.team}."`, same(d.lines, ['Help', NO_SERVER, `Contact ${sup.team}.`]), d.lines);
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
    await fr.evaluate(() => (window.CVPortal.state.ws.tenant.support.team = ''));
    await openHelp(T);
    d = await dialogState(fr);
    check(`${tag}: with no team name either it is "Contact the firm that invited you."`, same(d.lines, ['Help', NO_SERVER, 'Contact the firm that invited you.']), d.lines);
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
    await fr.evaluate((s) => Object.assign(window.CVPortal.state.ws.tenant.support, s), sup);
    // an invitation's page, opened in the browser the sponsor is signed in on (as the owner tries his own link)
    await signInAs(fr, 'admin');
    const inv = await Lib.createInvitation(fr, { name: 'Dana Whitfield', email: 'dana.whitfield@example.com', type: 'individual', offeringId: portal.offeringId });
    await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    await fr.waitForSelector('.ivf-form', { timeout: 20000 });
    await fr.waitForTimeout(400);
    const c = await controls(fr);
    check(`${tag} invitation: exactly one Help control, a button in the page footer saying "Help"`, c.length === 1 && c[0].inFoot && c[0].tag === 'BUTTON' && c[0].text === 'Help', c);
    if (c.length === 1) {
      await openHelp(T);
      d = await dialogState(fr);
      screens.push(await Lib.screenText(fr));
      check(`${tag} invitation: the person there is an investor: the firm's own team and address`, same(d.lines, ['Help', NO_SERVER, firm]) && d.close, d.lines);
      await press(T, '#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
      check(`${tag} invitation: the Close button closes it and the step is still there`, !(await dlgOpen(fr)) && (await fr.locator('.ivf-form').count()) === 1);
    }
    const refused = await fr.evaluate(() => window.__cspv.slice());
    check(`${tag}: no connection was attempted`, refused.length === 0, refused);
    check(`${tag}: the page nowhere says "Failed to fetch"`, !/Failed to fetch/i.test(screens.join('\n')));
    await ending(check, T, screens);
  } finally {
    await A.context.close();
  }
}

/** Close, the field, Send and the newest answer: where they are, and whether the first three are whole inside the window. */
function pinned(fr) {
  return fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const whole = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    };
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom) };
    };
    const close = d.querySelector('[data-action="close-dialog"][aria-label="Close"]');
    const field = d.querySelector('form[data-form="help-ask"] input');
    const send = d.querySelector('form[data-form="help-ask"] button[type="submit"]');
    return { ok: whole(close) && whole(field) && whole(send), close: box(close), field: box(field), send: box(send), newest: box(d.querySelector('[role="log"] .help-x .help-a')), focused: document.activeElement === field, win: { w: innerWidth, h: innerHeight }, pageW: document.documentElement.scrollWidth };
  });
}

/**
 * Read the log to its oldest exchange the way a person does on a phone: a finger dragged up over it until it moves no
 * further (raw touch events: this headless browser ignores synthesized scroll gestures). At every step, whether Close,
 * the field and Send are whole inside the window.
 */
async function readLog(T) {
  const { A, fr } = T;
  const LOG = '#dlg [role="log"]';
  const at = await fr.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom - Math.min(30, r.height / 4)), h: r.height };
  }, LOG);
  const dy = Math.max(40, Math.min(120, Math.round(at.h * 0.6)));
  const cdp = await A.page.context().newCDPSession(A.page);
  const steps = [];
  let last = -1;
  for (let i = 0; i < 150; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
    for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x, y: Math.round(at.y - (k * dy) / 8) }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await A.page.waitForTimeout(250);
    steps.push((await pinned(fr)).ok);
    const st = await fr.evaluate((sel) => document.querySelector(sel).scrollTop, LOG);
    if (st === last) break;
    last = st;
  }
  await cdp.detach().catch(() => {});
  const end = await fr.evaluate((sel) => {
    const l = document.querySelector(sel);
    const xs = l.querySelectorAll('.help-x');
    const o = xs[xs.length - 1].getBoundingClientRect();
    const lr = l.getBoundingClientRect();
    return { scrollTop: Math.round(l.scrollTop), max: l.scrollHeight - l.clientHeight, oldestSeen: o.bottom <= lr.bottom + 1 && o.bottom > lr.top, pageY: Math.round(scrollY) };
  }, LOG);
  return { steps, end };
}

/** The sponsor's dialog with no server, as the given role: its lines. */
async function sponsorLines(T, role) {
  await signInAs(T.fr, role);
  await T.fr.waitForSelector('.cs-nav [data-action="help-open"]', { timeout: 15000 });
  await openHelp(T);
  const d = await dialogState(T.fr);
  const text = await Lib.screenText(T.fr);
  await T.fr.evaluate(() => window.CVPortal.ui.closeDialog());
  return { lines: d.lines, text };
}

const parts = {
  'nosrv-desktop': async ({ check, S }) => {
    const T = await framed(S, 'desktop');
    const { A, fr } = T;
    const screens = [];
    try {
      await proveRefused(check, A, fr);
      await samplePortal(fr);
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      const role = await fr.evaluate(() => window.CVPortal.state.role);
      check('signed in as an admin on the console', role === 'admin', role);
      await A.page.screenshot({ path: path.join(OUT, 'desktop-bar.png'), fullPage: false });
      const c = await controls(fr);
      check('exactly one Help control is on the page, in the console bar', c.length === 1 && c[0].inNav && c[0].tag === 'BUTTON', c);
      if (c.length !== 1) return;
      check('it says exactly "Help"', c[0].text === 'Help', c[0].text);
      check('it is whole inside the window and nothing covers it', c[0].inside && c[0].onTop, c[0]);
      check('it overlaps neither the bell nor the firm name', !c[0].overBell && !c[0].overName && c[0].nameSeen >= 1, c[0]);
      const before = await hash(fr);
      await openHelp(T);
      const d = await dialogState(fr);
      screens.push(await Lib.screenText(fr));
      await A.page.screenshot({ path: path.join(OUT, 'desktop-nosrv.png'), fullPage: false });
      check('the click opens the dialog with the class dlg-help', d.open && /\bdlg-help\b/.test(d.cls), d);
      check('an admin with no support address reads exactly the heading and the sentence', d.heading === 'Help' && JSON.stringify(d.lines) === JSON.stringify(['Help', NO_SERVER]), d.lines);
      check('the dialog holds no field', d.fields === 0, d.fields);
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('no connection was attempted', refused.length === 0, refused);
      check('the page nowhere says "Failed to fetch"', !/Failed to fetch/i.test(screens[0]), screens[0].slice(0, 300));
      check('the Close button is whole on screen and on top', d.close, d);
      await fr.click('#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
      check('the Close button closes it, the page unchanged', !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr), before });
      await openHelp(T);
      await A.page.keyboard.press('Escape');
      await fr.waitForTimeout(400);
      check('opened again, Escape closes it', !(await dlgOpen(fr)) && (await hash(fr)) === before, { open: await dlgOpen(fr), hash: await hash(fr) });
      if (await dlgOpen(fr)) await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      await openHelp(T);
      await fr.evaluate(() => history.back());
      await fr.waitForTimeout(800);
      const back = { open: await dlgOpen(fr), hash: await hash(fr) };
      check('opened again, browser back closes it and the page stays', !back.open && back.hash === before, Object.assign({ before }, back));
      check('still no connection attempted', (await fr.evaluate(() => window.__cspv.length)) === 0);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
    }
  },

  investor: async ({ check, S }) => {
    await investorAt(check, S, 'desktop');
    await investorAt(check, S, 'phone');
  },

  support: async ({ check, S }) => {
    const MARKUP = '<img src=x onerror="window.__helpx=1">help@platform.example';
    const cases = [
      { what: 'no support address set', init: undefined, admin: ['Help', NO_SERVER], team: ['Help', NO_SERVER, 'Contact your administrator.'] },
      { what: 'a support address set', init: withSupport(SUPPORT), admin: ['Help', NO_SERVER, `Contact support at ${SUPPORT}.`], team: ['Help', NO_SERVER, `Contact support at ${SUPPORT}.`] },
      { what: 'a value that is not an address and carries markup', init: withSupport(MARKUP), admin: ['Help', NO_SERVER], team: ['Help', NO_SERVER, 'Contact your administrator.'] },
      { what: 'a value that is not text', init: 'window.CVPortalConfig = { supportEmail: { toString: function () { return "x@y.example"; } } };', admin: ['Help', NO_SERVER], team: ['Help', NO_SERVER, 'Contact your administrator.'] }
    ];
    for (const k of cases) {
      const T = await framed(S, 'desktop', { init: k.init });
      const { A, fr } = T;
      try {
        await proveRefused(check, A, fr);
        await samplePortal(fr);
        await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
        const admin = await sponsorLines(T, 'admin');
        check(`${k.what}: an admin reads ${JSON.stringify(k.admin.slice(2))}`, same(admin.lines, k.admin), admin.lines);
        const team = await sponsorLines(T, 'team');
        check(`${k.what}: a team member reads ${JSON.stringify(k.team.slice(2))}`, same(team.lines, k.team), team.lines);
        await openHelp(T);
        const made = await fr.evaluate(() => ({ els: Array.from(document.querySelectorAll('#dlg .dlg-body *')).filter((e) => e.tagName !== 'P').map((e) => e.tagName), ran: window.__helpx, html: document.querySelector('#dlg .dlg-body').innerHTML }));
        check(`${k.what}: no element is created from the value and nothing of it runs`, made.els.length === 0 && made.ran === undefined && !/onerror/.test(made.html), made);
        const refused = await fr.evaluate(() => window.__cspv.slice());
        check(`${k.what}: no connection was attempted`, refused.length === 0, refused);
        await ending(check, T, [admin.text, team.text]);
      } finally {
        await A.context.close();
      }
    }
  },

  'refused-desktop': refusedPart('desktop'),

  'answers-desktop': async ({ check, S }) => {
    const X = await standIn();
    const T = await framed(S, 'desktop', { allow: [X.origin], init: withSupport(SUPPORT) });
    const { A, fr } = T;
    const screens = [];
    const want = `Contact support at ${SUPPORT}.`;
    const KEYS = ['message', 'session', 'page', 'step', 'role'];
    try {
      const portal = await Lib.setupPortal({ base: T.base }, { page: fr, context: A.context });
      await setServer(fr, X.origin, 'tok-help-1');
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      // what must never leave the browser: the firm's names and every investor's name and address
      const secret = await fr.evaluate(() => {
        const ws = window.CVPortal.state.ws;
        const out = [ws.tenant.name, ws.tenant.shortName, ws.tenant.legalName, ws.tenant.support.email];
        ws.investors.forEach((i) => out.push(i.title, i.contact, i.email));
        return out.filter((x) => x && String(x).length > 3);
      });
      await openHelp(T);
      // 1. an answer of several lines, and what was sent for it
      await askQ(T, 'lines for inviting');
      let s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      check('an answer of several lines shows as text with its line breaks', s.items.length === 1 && s.items[0].q === 'lines for inviting' && s.items[0].a === 'Open Investors.\nPress "Invite an investor".\n\nThen send the link.' && /^pre-(wrap|line)$/.test(s.items[0].space) && s.items[0].aLines >= 4, s.items);
      check('an answer that helps is not followed by the contact', s.items.length === 1 && s.items[0].contact === null, s.items);
      check('the log comes after the field and Send', s.logAfterForm, s);
      let p = X.posts();
      check('one POST to /v1/help with the token and a JSON body', p.length === 1 && p[0].path === '/v1/help' && p[0].auth === 'Bearer tok-help-1' && /^application\/json/.test(p[0].type) && !!p[0].body && !p[0].invite, p.map((x) => [x.method, x.path, x.auth, x.type]));
      check('the body holds the question, the page (console-investors) and the role (admin), and no session yet', !!p[0] && !!p[0].body && same(Object.keys(p[0].body).sort(), ['message', 'page', 'role']) && p[0].body.message === 'lines for inviting' && p[0].body.page === 'console-investors' && p[0].body.role === 'admin', p[0] && p[0].raw);
      // 2. markup in an answer and in a question stays characters
      const QM = 'markup <i>please</i> <img src=x onerror="window.__helpq=1">';
      await askQ(T, QM);
      s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      const ran = await fr.evaluate(() => [window.__helpx, window.__helpq]);
      check('markup in an answer and in a question creates no element and shows its characters', s.items.length === 2 && s.items[0].q === QM && s.items[0].a === '<img src=x onerror="window.__helpx=1"><b>bold</b> stays as characters' && s.strangers.length === 0 && ran[0] === undefined && ran[1] === undefined, { items: s.items, strangers: s.strangers, ran });
      p = X.posts();
      check('the second request carries the session the first answer returned', p.length === 2 && p[1].body.session === 'sess-1' && same(Object.keys(p[1].body).sort(), ['message', 'page', 'role', 'session']), p[1] && p[1].raw);
      // 3. answers that cannot help are followed by the contact
      await askQ(T, 'cannot do this');
      await askQ(T, 'scope of advice');
      s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      check('a "cannot" and an "out_of_scope" answer are each followed by the contact, newest first', s.items.length === 4 && s.items[0].a === 'I can only help with using this portal.' && s.items[0].contact === want && s.items[1].a === 'I cannot help with that here.' && s.items[1].contact === want && s.items[2].contact === null && s.items[3].contact === null, s.items);
      await A.page.screenshot({ path: path.join(OUT, 'desktop-answers.png'), fullPage: false });
      // 4. while a question waits: it shows, Send is off, a second submit does nothing
      await askQ(T, 'slow one', { noWait: true });
      await fr.waitForTimeout(250);
      s = await talk(fr);
      check('while the answer is awaited the question shows with a waiting mark and Send is off', s.items.length === 5 && s.items[0].q === 'slow one' && s.items[0].wait && s.items[0].a === '' && s.send.disabled, { item: s.items[0], send: s.send });
      await fr.fill(FIELD, 'slow two');
      await fr.press(FIELD, 'Enter');
      await fr.evaluate(() => document.querySelector('#dlg form[data-form="help-ask"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await fr.waitForTimeout(150);
      check('a second submit meanwhile sends nothing', X.posts().length === 5 && (await talk(fr)).items.length === 5, X.posts().length);
      await fr.waitForFunction(() => !document.querySelector('#dlg .help-wait'), null, { timeout: 5000 });
      s = await talk(fr);
      check('then its answer replaces the mark and Send works again', s.items[0].a === 'A slow answer.' && !s.items[0].wait && !s.send.disabled, s.items[0]);
      await fr.fill(FIELD, '');
      // 5. a reply that arrives after another dialog replaced this one writes nothing into it
      await askQ(T, 'slow again', { noWait: true });
      await fr.evaluate(() => window.CVPortal.actions['inv8-bell']());
      const other = await fr.evaluate(() => document.getElementById('dlg').innerHTML);
      await fr.waitForTimeout(1800);
      const after = await fr.evaluate(() => ({ cls: document.getElementById('dlg').className, same: document.getElementById('dlg').innerHTML }));
      check('a reply arriving after another dialog took its place writes nothing into that dialog', /dlg-ntf/.test(after.cls) && after.same === other && !/slow/.test(after.same), after.cls);
      await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      // 6. kept while the person and the portal stay the same
      await openHelp(T);
      s = await talk(fr);
      check('closed and opened again, the exchanges are still there (the late answer among them)', s.items.length === 6 && s.items[0].q === 'slow again' && s.items[0].a === 'A slow answer.' && !s.send.disabled, s.items.map((x) => x.q));
      await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      await Lib.consoleRoute(fr, '#console-docs', '.cs-nav');
      await openHelp(T);
      s = await talk(fr);
      check('they are still there on another page', s.items.length === 6, s.items.length);
      await askQ(T, 'from documents');
      p = X.posts();
      check('asked from Documents the page is console-docs, in the same session', p[p.length - 1].body.page === 'console-docs' && p[p.length - 1].body.session === 'sess-1', p[p.length - 1].raw);
      // 7. a paste longer than the limit
      await fr.focus(FIELD);
      await A.page.keyboard.insertText('x'.repeat(501));
      s = await talk(fr);
      check(`a 501-character paste is cut to 500 by the field (${s.field.value.length})`, s.field.value.length === 500, s.field.value.length);
      await fr.fill(FIELD, '');
      await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      // 8. another person: the exchanges and the session are gone
      await signInAs(fr, 'team');
      await fr.waitForSelector('.cs-nav [data-action="help-open"]', { timeout: 15000 });
      await openHelp(T);
      s = await talk(fr);
      check('after the role changes the exchanges are gone', s.items.length === 0 && same(s.lines, ['Help', 'Send']), s.lines);
      await askQ(T, 'hello as team');
      p = X.posts();
      check('and the next request starts a new conversation as the new role', !('session' in p[p.length - 1].body) && p[p.length - 1].body.role === 'team', p[p.length - 1].raw);
      await fr.evaluate(() => window.CVPortal.ui.closeDialog());
      // 9. an invitation's page: the page, the step on screen and the investor's role
      await signInAs(fr, 'admin');
      const inv = await Lib.createInvitation(fr, { name: 'Dana Whitfield', email: 'dana.whitfield@example.com', type: 'individual', offeringId: portal.offeringId });
      await fr.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
      await fr.waitForSelector('.ivf-form', { timeout: 20000 });
      await fr.waitForTimeout(400);
      const step = await fr.evaluate(() => window.CVPortal.state.ui.ob.shownKey);
      await openHelp(T);
      s = await talk(fr);
      check("on the invitation page the sponsor's exchanges are not shown", s.items.length === 0, s.items.length);
      await askQ(T, 'scope from the invitation');
      p = X.posts();
      let last = p[p.length - 1];
      s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      const firm = await fr.evaluate(() => {
        const x = window.CVPortal.state.ws.tenant.support;
        return `Contact ${x.team} at ${x.email}.`;
      });
      check(`from an invitation's page the body has the page invite, the step on screen (${step}) and the role investor`, !!step && same(Object.keys(last.body).sort(), ['message', 'page', 'role', 'step']) && last.body.page === 'invite' && last.body.step === step && last.body.role === 'investor', last.raw);
      check("and the contact after an answer that cannot help is the firm's own", s.items[0].contact === firm, s.items[0]);
      // 10. an invitation opened from the server: the investor's invitation token, never the firm's token
      await fr.evaluate((o) => (window.CVPortal.state.ws.invite = { mode: 'server', key: 'k', token: 'invite-token-9', server: o }), X.origin);
      await askQ(T, 'hello from a served invitation');
      await fr.evaluate(() => delete window.CVPortal.state.ws.invite);
      p = X.posts();
      last = p[p.length - 1];
      check('on a server-mode invitation the request carries X-Invite-Token and no Authorization', last.invite === 'invite-token-9' && last.auth === '', { invite: last.invite, auth: last.auth });
      // 11. the bank account update's one step
      await fr.evaluate(() => {
        const st = window.CVPortal.state;
        window.__keep = { route: st.route, ob: st.ui.ob };
        st.route = 'onboarding';
        st.ui.ob = { mode: 'bank' };
      });
      await askQ(T, 'hello from the bank update');
      await fr.evaluate(() => {
        const st = window.CVPortal.state;
        st.route = window.__keep.route;
        st.ui.ob = window.__keep.ob;
      });
      p = X.posts();
      last = p[p.length - 1];
      check('on the bank account update the step is payment', last.body.page === 'onboarding' && last.body.step === 'payment', last.raw);
      // every request, whole
      const bodies = p.map((x) => x.raw).join('\n');
      check('every body has only keys among message, session, page, step, role', p.every((x) => x.body && Object.keys(x.body).every((k) => KEYS.indexOf(k) >= 0)), p.map((x) => Object.keys(x.body || {})));
      const told = secret.filter((x) => bodies.indexOf(x) >= 0);
      check(`no body names the firm or any investor (${secret.length} names and addresses searched)`, secret.length > 20 && told.length === 0 && bodies.indexOf('dana.whitfield') < 0 && bodies.indexOf('Whitfield') < 0, told);
      check('the stand-in was asked for nothing but /v1/help', X.seen.every((x) => x.path === '/v1/help' && (x.method === 'POST' || x.method === 'OPTIONS')), X.seen.filter((x) => x.path !== '/v1/help').map((x) => `${x.method} ${x.path}`));
      const elsewhere = A.net.allowed.filter((u) => u.indexOf(X.origin + '/') < 0 && u.indexOf(T.pages + '/') < 0);
      check("the only origin reached beside this check's page server is the stand-in", elsewhere.length === 0 && A.net.allowed.some((u) => u.indexOf(X.origin + '/v1/help') >= 0), elsewhere.slice(0, 5));
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('no connection was refused (nothing went anywhere else)', refused.length === 0, refused);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
      await X.close();
    }
  },

  failures: async ({ check, S }) => {
    const X = await standIn();
    const T = await framed(S, 'desktop', { allow: [X.origin], init: withSupport(SUPPORT) });
    const { A, fr } = T;
    const screens = [];
    const want = `Contact support at ${SUPPORT}.`;
    const KINDS = [
      ['f500', 'status 500 with a text body'],
      ['f429', 'status 429 with { ok: false, reason: "limit" }'],
      ['f402', 'status 402'],
      ['garbled', 'status 200 that is not JSON'],
      ['noanswer', 'status 200 with { ok: true } and no answer'],
      ['number', 'status 200 with a number as the answer'],
      ['cut', 'a connection cut in the middle of the answer']
    ];
    try {
      await samplePortal(fr);
      await setServer(fr, X.origin, 'tok-help-2');
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await openHelp(T);
      let n = 0;
      for (const [word, what] of KINDS) {
        n++;
        const ms = await askQ(T, `${word} question`).catch(() => -1);
        const s = await talk(fr);
        const text = await Lib.screenText(fr);
        screens.push(text);
        const dlg = s.lines.join('\n');
        check(`${what}: the same sentence and the contact (${ms} ms)`, ms >= 0 && s.items.length === n && s.items[0].q === `${word} question` && s.items[0].a === NOT_NOW && s.items[0].contact === want, s.items[0]);
        check(`${what}: no status number, reason word or error text on screen`, !/\b(500|429|402|12345)\b|limit|budget|Internal Server|exploded|not json|Unexpected|SyntaxError|TypeError|NetworkError|Failed to fetch|JSON|undefined|null|\[object/i.test(dlg), dlg.slice(0, 600));
        check(`${what}: Send can be used again`, !!s.send && !s.send.disabled, s.send);
      }
      const ok = await askQ(T, 'hello after the failures').catch(() => -1);
      const s = await talk(fr);
      check('after all of them a question is answered as usual', ok >= 0 && s.items[0].a === 'An answer to: hello after the failures' && s.items[0].contact === null, s.items[0]);
      check('each question was sent once', X.posts().length === KINDS.length + 1, X.posts().length);
      check('the stand-in was asked for nothing but /v1/help', X.seen.every((x) => x.path === '/v1/help'), X.seen.map((x) => x.path));
      await ending(check, T, screens);
    } finally {
      await A.context.close();
      await X.close();
    }
  },

  'nosrv-phone': async ({ check, S }) => {
    const T = await framed(S, 'phone');
    const { A, fr } = T;
    const screens = [];
    const CLOSE = '#dlg [data-action="close-dialog"][aria-label="Close"]';
    const wide = () => fr.evaluate(() => ({ page: document.documentElement.scrollWidth, win: innerWidth, x: Math.round(scrollX) }));
    try {
      await proveRefused(check, A, fr);
      await samplePortal(fr);
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await fr.evaluate(() => window.scrollTo(0, 0));
      await A.page.screenshot({ path: path.join(OUT, 'phone-bar.png'), fullPage: false });
      const c = await controls(fr);
      check('exactly one Help control, in the console bar, saying "Help"', c.length === 1 && c[0].inNav && c[0].tag === 'BUTTON' && c[0].text === 'Help', c);
      if (c.length !== 1) return;
      check(`it is whole inside the 390-wide window and nothing covers it (${Math.round(c[0].box.l)} to ${Math.round(c[0].box.r)})`, c[0].inside && c[0].onTop, c[0]);
      check(`it is at least 40px tall for a finger (${Math.round(c[0].box.h)}px)`, c[0].box.h >= 40, c[0].box);
      check('it overlaps neither the bell nor the firm name', !c[0].overBell && !c[0].overName && c[0].nameSeen >= 1, c[0]);
      const bell = await fr.evaluate(() => {
        const b = document.querySelector('.cs-bell').getBoundingClientRect();
        const h = document.querySelector('.cs-help').getBoundingClientRect();
        return { sameRow: Math.abs(b.top + b.height / 2 - (h.top + h.height / 2)) <= 2, left: h.right <= b.left };
      });
      check("it is in the bar's first row, to the left of the bell", bell.sameRow && bell.left, bell);
      let w = await wide();
      check('the page is no wider than the window and not scrolled sideways', w.page <= w.win && w.x === 0, w);
      await openHelp(T);
      const d = await dialogState(fr);
      screens.push(await Lib.screenText(fr));
      await A.page.screenshot({ path: path.join(OUT, 'phone-nosrv.png'), fullPage: false });
      check('a tap opens the dialog: the heading and the sentence, no field', d.open && /\bdlg-help\b/.test(d.cls) && same(d.lines, ['Help', NO_SERVER]) && d.fields === 0, d);
      check(`the dialog is inside the window, near its top (top ${d.box.t}px)`, d.box.l >= 0 && d.box.r <= d.win.w && d.box.t >= 0 && d.box.b <= d.win.h && d.box.t <= 60, d.box);
      check('the Close button is whole on screen and on top', d.close, d);
      w = await wide();
      check('with the dialog open the page is no wider than the window', w.page <= w.win && w.x === 0, w);
      await fr.tap(CLOSE);
      await fr.waitForTimeout(300);
      check('a tap on the Close button closes it', !(await dlgOpen(fr)));
      w = await wide();
      check('closed again, the page is no wider than the window', w.page <= w.win && w.x === 0, w);
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('no connection was attempted', refused.length === 0, refused);
      check('the page nowhere says "Failed to fetch"', !/Failed to fetch/i.test(screens.join('\n')));
      await ending(check, T, screens);
    } finally {
      await A.context.close();
    }
  },

  'refused-phone': refusedPart('phone'),

  'answers-phone': async ({ check, S }) => {
    const X = await standIn();
    const T = await framed(S, 'phone', { allow: [X.origin], init: withSupport(SUPPORT) });
    const { A, fr } = T;
    const screens = [];
    const LONGQ = `long ${'and how is each of these steps done when the investor is a trust with two trustees '.repeat(4)}`.trim();
    try {
      await samplePortal(fr);
      await setServer(fr, X.origin, 'tok-help-3');
      await Lib.consoleRoute(fr, '#console-investors', '.cs-nav');
      await fr.evaluate(() => window.scrollTo(0, 0));
      await openHelp(T);
      const during = [];
      for (let i = 1; i <= 6; i++) {
        await askQ(T, i === 6 ? LONGQ : `long question ${i} about inviting investors`);
        during.push((await pinned(fr)).ok);
      }
      let s = await talk(fr);
      screens.push(await Lib.screenText(fr));
      check('six questions asked by tapping, each with its long answer, newest first', s.items.length === 6 && s.items.every((x) => /^Line 1 of a long answer/.test(x.a) && x.aLines >= 9) && s.items[0].q === LONGQ && /question 1 /.test(s.items[5].q), s.items.map((x) => x.q.slice(0, 30)));
      check('after each of them Close, the field and Send were whole inside the window', during.length === 6 && during.every(Boolean), during);
      // (a) the keyboard's part of the screen: everything a person needs is in the top 300px
      await fr.tap(FIELD);
      await fr.waitForTimeout(300);
      const a = await pinned(fr);
      await A.page.screenshot({ path: path.join(OUT, 'phone-answers.png'), fullPage: false });
      check(`with the field focused, Close (${a.close.b}), the field (${a.field.b}) and Send (${a.send.b}) end within the top 300px`, a.focused && a.ok && a.close.b <= 300 && a.field.b <= 300 && a.send.b <= 300, a);
      check(`and the newest answer starts there too (${a.newest && a.newest.t}px), after a question of ${LONGQ.length} characters`, !!a.newest && a.newest.t >= 0 && a.newest.t <= 300, a.newest);
      check(`the field's text is at least 16px (${s.field.font}px)`, s.field.font >= 16, s.field);
      // the log read to its oldest exchange with a finger
      let r = await readLog(T);
      check(`a finger dragged over the log reads it to its end (${r.end.scrollTop} of ${r.end.max}px), the oldest exchange in view`, r.end.max > 200 && r.end.scrollTop >= r.end.max - 1 && r.end.oldestSeen, r.end);
      check(`through all ${r.steps.length} drags Close, the field and Send stayed whole inside the window, and the page behind did not move`, r.steps.length > 3 && r.steps.every(Boolean) && r.end.pageY === 0, { steps: r.steps, pageY: r.end.pageY });
      // (b) the frame shrunk to 420px, as when a host shrinks the page for the keyboard
      await A.page.evaluate(() => (document.getElementById('art').style.height = '420px'));
      await fr.waitForFunction(() => innerHeight === 420, null, { timeout: 5000 });
      await fr.waitForTimeout(400);
      const b = await pinned(fr);
      await A.page.screenshot({ path: path.join(OUT, 'phone-keyboard.png'), fullPage: false });
      check(`in a frame 420px tall Close (${b.close.b}), the field (${b.field.b}) and Send (${b.send.b}) are still whole inside it`, b.ok && b.win.h === 420, b);
      await fr.evaluate(() => (document.querySelector('#dlg [role="log"]').scrollTop = 0));
      r = await readLog(T);
      check(`and the log still scrolls to its end there (${r.end.scrollTop} of ${r.end.max}px) with all three in place`, r.end.max > 200 && r.end.scrollTop >= r.end.max - 1 && r.end.oldestSeen && r.steps.every(Boolean), r);
      await askQ(T, 'long seventh question, typed with the keyboard up');
      const c = await pinned(fr);
      s = await talk(fr);
      check(`a question sent there shows the first line of its answer inside the frame (${c.newest && c.newest.t}px of 420)`, s.items.length === 7 && /seventh/.test(s.items[0].q) && !!c.newest && c.newest.t >= 0 && c.newest.t + 24 <= 420 && c.ok, { newest: c.newest, q: s.items[0].q });
      check('the page is no wider than the window', c.pageW <= c.win.w, c);
      await fr.tap('#dlg [data-action="close-dialog"][aria-label="Close"]');
      await fr.waitForTimeout(300);
      check('a tap on the Close button closes it', !(await dlgOpen(fr)));
      check('seven questions, each sent once, to /v1/help only', X.posts().length === 7 && X.seen.every((x) => x.path === '/v1/help'), X.posts().length);
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('no connection was refused (nothing went anywhere else)', refused.length === 0, refused);
      await ending(check, T, screens);
    } finally {
      await A.context.close();
      await X.close();
    }
  },

  managed: async ({ check, S }) => {
    const T = await framed(S, 'desktop', { file: 'index.html' });
    const { A, fr } = T;
    const screens = [];
    const probe = () =>
      fr.evaluate(() => {
        const NS = window.CVPortal;
        const row = document.querySelector('.pt-foot-row');
        return {
          edition: NS.EDITION.id,
          route: NS.state.route,
          controls: document.querySelectorAll('[data-action="help-open"]').length,
          action: typeof NS.actions['help-open'],
          form: typeof NS.forms['help-ask'],
          hook: (NS.hooks.consoleBar || []).map((f) => String(f())).join('').indexOf('help'),
          classes: document.querySelectorAll('.cs-help, .pt-foot-help, .dlg-help, [class^="help-"], [class*=" help-"]').length,
          footRow: row ? Array.from(row.children).map((e) => e.tagName).join(',') : null
        };
      });
    const clean = (p) => p.edition === 'managed' && p.controls === 0 && p.action === 'undefined' && p.form === 'undefined' && p.hook < 0 && p.classes === 0;
    try {
      await proveRefused(check, A, fr);
      await fr.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
      await fr.goto(T.base);
      await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 20000 });
      const go = async (role, route, sel) => {
        await fr.evaluate(
          ({ role, route }) => {
            const NS = window.CVPortal;
            NS.state.role = role;
            NS.store.set('role', role);
            if (role === 'investor') NS.state.viewer = (NS.state.ws.investors.find((x) => x.onboarding.status === 'complete') || {}).id;
            NS.app.go(route);
            NS.app.render();
          },
          { role, route }
        );
        await fr.waitForSelector(sel, { timeout: 20000 });
        await fr.waitForTimeout(300);
      };
      await go('staff', 'console', '.cs-nav');
      let p = await probe();
      screens.push(await Lib.screenText(fr));
      check('the console has no help control, action, form or class', clean(p) && /^console/.test(p.route), p);
      await go('investor', 'overview', '.pt-foot');
      p = await probe();
      screens.push(await Lib.screenText(fr));
      check("the investor's Home has none, and its footer row is the four details it was", clean(p) && p.route === 'overview' && p.footRow === 'SPAN,SPAN,SPAN,SPAN', p);
      await go('investor', 'sign-in', '.pt-foot');
      p = await probe();
      check('sign-in has none', clean(p) && p.route === 'sign-in' && p.footRow === 'SPAN,SPAN,SPAN,SPAN', p);
      const who = await fr.evaluate(() => {
        const NS = window.CVPortal;
        const i = NS.state.ws.investors.find((x) => x.onboarding.status !== 'complete') || NS.state.ws.investors[0];
        NS.startOnboarding(i.id);
        return { id: i.id, status: i.onboarding.status };
      });
      await fr.waitForFunction(() => window.CVPortal.state.route === 'onboarding' && !!document.querySelector('.ob-note'), null, { timeout: 15000 }).catch(() => {});
      await fr.waitForTimeout(300);
      p = await probe();
      const note = await fr.evaluate(() => (document.querySelector('.ob-note') || {}).textContent || '');
      check('the activation page has none', clean(p) && p.route === 'onboarding' && note === 'Account activation' && (p.footRow === null || p.footRow === 'SPAN,SPAN,SPAN,SPAN'), { p, note, who });
      const refused = await fr.evaluate(() => window.__cspv.slice());
      check('no connection was attempted', refused.length === 0, refused);
      // read from the files
      const src = fs.readFileSync(path.join(Lib.ROOT, 'assets/js/help.js'), 'utf8');
      const named = src.split('\n').filter((l) => Lib.VENDOR_RE.test(l) || Lib.VENDORS.test(l) || Lib.WORD_RE.test(l));
      check('help.js names no vendor, model or library and never uses the forbidden word', src.length > 2000 && named.length === 0, named);
      check('help.js adds no page (no NS.views entry) and does nothing outside the self-serve edition', !/NS\.views/.test(src) && /if \(!NS\.EDITION \|\| !NS\.EDITION\.diy\) return;/.test(src));
      check('help.js keeps nothing in storage and uses the one plain fetch', !/localStorage|sessionStorage|indexedDB|NS\.store|readingFetch|XMLHttpRequest/.test(src) && (src.match(/\bfetch\(/g) || []).length === 1);
      const pages = ['index.html', 'diy.html', 'portal.html'].map((f) => fs.readFileSync(path.join(Lib.ROOT, f), 'utf8'));
      check('each of the three pages loads help.js once, right after coinvestor.js', pages.every((h) => (h.match(/assets\/js\/help\.js/g) || []).length === 1 && /<script src="assets\/js\/coinvestor\.js"><\/script>\s*<script src="assets\/js\/help\.js"><\/script>/.test(h)));
      check('no managed screen has the word Help as a control', screens.every((t) => !/^Help$/m.test(t)), screens.map((t) => (t.match(/^Help$/m) || [])[0]));
      // the managed edition's own screens name its operator, so the white-label search does not apply to them
      await ending(check, T, []);
    } finally {
      await A.context.close();
    }
  }
};

Lib.runParts(parts, { name: 'HELP CHAT', unit: 'parts', flag: '--only', browser: true });
