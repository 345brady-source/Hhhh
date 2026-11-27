// gate: none
// Helpers for the phase 13 browser checks (plan 13-05), built on P6/lib.js and P10/checks/lib10.js. Check files keep their
// own parts; what two or more of them need lives here.
//   framedConsole(S, size, opts)       the self-serve console (diy.html) in the sandboxed frame that refuses every connection,
//                                      the Kestrel Bay sample signed in as admin: { A, fr }
//   serverConsole(S, { env, opts, context })  the real integration server in this process and a console page connected to it:
//                                      { srv, A, page, close() }
//   outbox(srv, q)                     the server's outbox messages (GET /v1/outbox), q: { invitation, workspace }
//   renderNode(kind, data, opts)       assets/js/emails.js render, run in Node
//   dialogMail(frame)                  the email dialog on screen, read back: { heading, lead, subject, text, buttons, mailto }
//   honest(text)                       the one simulated sentence and no bare claim of a send outside it
//   noVendor(text)                     no vendor, model or library name and no form of the forbidden word
//   baseRoot(), serveDir(dir)          the base tree (P13_BASE, else a copy of the base commit) and a static server on it
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const L10 = require('../../10-investor-tax-documents-and-withholding/checks/lib10.js');
const L = L10.Lib;

const EMAILS = path.join(L.ROOT, 'assets/js/emails.js');
const emails = () => require(EMAILS);

/** The self-serve console in the sandboxed frame (connections refused), signed in as the sample firm's admin. */
async function framedConsole(S, size, opts) {
  const o = Object.assign({ page: 'diy.html' }, opts || {});
  const { A, fr } = await L10.framed(S, size, o);
  await L10.sample(fr, { role: o.role || 'admin' });
  return { A, fr };
}

/**
 * The firm's integration server (server/index.mjs, the real code, in this process) and a console page that uses it. env:
 * more server settings; opts: more createServer options (13-02's fakes, when given); context: the browser context's options
 * (default 1280x800). The page is diy.html with the Kestrel Bay sample, a raising offering with a minimum of 50,000, and
 * the server set on its Integrations settings.
 */
async function serverConsole(S, o) {
  o = o || {};
  let srv;
  if (o.opts && Object.keys(o.opts).length) srv = await ownServer(S, o.env, o.opts);
  else srv = await L.serverPortal(S, o.env);
  const A = await L.open(S, { allow: [srv.base], init: srv.init, context: o.context || { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } });
  const page = A.page;
  await page.goto(S.base);
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await page.goto(S.base);
  await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
  const off = await page.evaluate(() => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    let x = ws.offerings.find((y) => y.status === 'Raising');
    if (!x) {
      x = ws.offerings[0];
      x.status = 'Raising';
    }
    x.minimum = 50000;
    NS.app.save(true);
    return { offeringId: x.id, offeringName: x.name };
  });
  const on = await srv.configure(page);
  return {
    srv,
    A,
    page,
    off,
    on,
    close: async () => {
      await A.context.close().catch(() => {});
      await srv.close();
    }
  };
}

/** serverPortal with createServer options (the same settings, token and helpers as P6/lib.js serverPortal). */
async function ownServer(S, extraEnv, opts) {
  const { pathToFileURL } = require('url');
  const crypto = require('crypto');
  const { createServer } = await import(pathToFileURL(path.join(L.ROOT, 'server/index.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p13-server-'));
  const token = crypto.randomBytes(24).toString('hex');
  const port = await L.freePort();
  const base = `http://127.0.0.1:${port}`;
  const env = Object.assign({ NODE_ENV: 'test', STORE_FILE: path.join(dir, 'store.json'), API_TOKEN: token, PORTAL_ORIGIN: S.origin, PUBLIC_URL: base }, extraEnv || {});
  const server = createServer(Object.assign({ env }, opts));
  await new Promise((r, j) => {
    server.once('error', j);
    server.listen(port, '127.0.0.1', r);
  });
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: Object.assign({ Authorization: `Bearer ${token}` }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return { status: res.status, body: data };
  };
  return {
    base,
    token,
    server,
    init: `window.CVPortalConfig = Object.assign({}, window.CVPortalConfig || {}, { integrationServers: [${JSON.stringify(base)}] });`,
    configure: (page) =>
      page.evaluate(
        ({ base, token }) => {
          const NS = window.CVPortal;
          const s = NS.integrations.ensure(NS.state.ws).server;
          s.url = base;
          s.token = token;
          NS.app.save(true);
          return NS.invitations.serverOn(NS.state.ws);
        },
        { base, token }
      ),
    call,
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** The server's outbox, newest last: [{ id, at, kind, invitationId, workspace, from, to, toName, replyTo, subject, text, html }]. */
async function outbox(srv, q) {
  q = q || {};
  const qs = [];
  if (q.invitation) qs.push(`invitation=${encodeURIComponent(q.invitation)}`);
  if (q.workspace) qs.push(`workspace=${encodeURIComponent(q.workspace)}`);
  const r = await srv.call('GET', `/v1/outbox${qs.length ? `?${qs.join('&')}` : ''}`);
  const list = (r.body && r.body.messages) || [];
  return list.slice().sort((a, b) => (String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0));
}

const renderNode = (kind, data, opts) => emails().render(kind, data, opts);

/**
 * The email dialog read back as a reader sees it. Each paragraph of .email-body is one block of the message's text (the
 * button's paragraph is its label, a colon and a line break, then the link, as the text part writes a button); the
 * footer's paragraphs follow "--". Line breaks are kept as written (white-space: pre-wrap), so the result is compared
 * byte for byte with the message the server keeps.
 */
async function dialogMail(frame) {
  return frame.evaluate(() => {
    const d = document.getElementById('dlg');
    if (!d || !d.open) return null;
    const q = (s) => d.querySelector(s);
    const blocks = Array.from(d.querySelectorAll('.email-body > p')).map((p) => {
      const b = p.querySelector('.email-btn');
      const raw = p.querySelector('.inv8-raw');
      return b && raw ? `${b.textContent}:\n${raw.textContent}` : p.textContent;
    });
    const foot = Array.from(d.querySelectorAll('.email-foot > p')).map((p) => p.textContent);
    const mt = q('#inv8-mailto') || q('#co-mailto');
    return {
      heading: (q('.dlg-head h2') || {}).textContent || '',
      lead: (q('.dlg-head p') || {}).textContent || '',
      subject: (q('.inv8-subject') || {}).textContent || '',
      text: blocks.join('\n\n') + (foot.length ? `\n\n--\n${foot.join('\n\n')}` : ''),
      buttons: d.querySelectorAll('article.email .email-btn').length,
      mailto: mt ? mt.getAttribute('href') : '',
      all: d.innerText
    };
  });
}
/** A mailto: link's subject and body, decoded (CRLF read back as LF). */
function mailtoParts(href) {
  const m = String(href || '').match(/^mailto:([^?]*)\?subject=([^&]*)&body=(.*)$/);
  if (!m) return null;
  return { to: decodeURIComponent(m[1]), subject: decodeURIComponent(m[2]), body: decodeURIComponent(m[3]).replace(/\r\n/g, '\n') };
}

/** The one simulated sentence, and no "sent" or "emailed" claim outside it. */
function honest(text) {
  const s = String(text || '');
  const SIM = emails().SIMULATED;
  if (s.indexOf(SIM) < 0) return false;
  // the claim the simulated sentence qualifies is the clause it closes; anything after it, or in another sentence, is bare
  const parts = s.split(/(?<=[.!?])\s+/);
  return parts.every((p) => p.indexOf(SIM) >= 0 || !/\b(sent|emailed)\b/i.test(p));
}

/** White label: none of P6/lib.js VENDORS, VENDOR_RE, WORD_RE or emails.js BANNED in the text (links' random parts aside). */
function noVendor(text) {
  const lines = String(text || '').split('\n');
  const hits = lines.filter((l) => {
    const t = L.stripLinkTokens(l);
    return L.VENDORS.test(t) || L.VENDOR_RE.test(t) || L.WORD_RE.test(l) || emails().BANNED.some((re) => re.test(t));
  });
  return { ok: hits.length === 0, hits: hits.map((l) => l.trim().slice(0, 160)) };
}

/**
 * The base tree: P13_BASE when the gate set it, else a copy of the base commit's index.html and assets (P13_BASE_COMMIT,
 * else the merge base with the integration branch) in a temporary folder. Resolves to { dir, made }.
 */
function baseRoot() {
  if (process.env.P13_BASE && fs.existsSync(path.join(process.env.P13_BASE, 'index.html'))) return { dir: process.env.P13_BASE, made: false };
  const cp = require('child_process');
  const git = (args) => cp.execFileSync('git', args, { cwd: L.ROOT, encoding: 'utf8' }).trim();
  let commit = process.env.P13_BASE_COMMIT || '';
  if (!commit) {
    try {
      commit = git(['merge-base', 'HEAD', 'origin/claude/refract-reskin']);
    } catch (e) {
      commit = git(['rev-parse', 'HEAD']);
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p13-base-'));
  cp.execSync(`git -C ${JSON.stringify(L.ROOT)} archive ${commit} index.html diy.html portal.html assets | tar -x -C ${JSON.stringify(dir)}`);
  return { dir, made: true, commit };
}

/** A static server on dir (no caching): resolves to { origin, close() }. */
function serveDir(dir) {
  const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((d) => server.close(d))
      })
    )
  );
}

module.exports = { framedConsole, serverConsole, outbox, renderNode, dialogMail, mailtoParts, honest, noVendor, baseRoot, serveDir, emails, L, L10 };
