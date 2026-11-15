#!/usr/bin/env node
/*
 * Plan 01.4-64: an uploaded agreement read through the portal's reading server (D-31), on the real upload screen.
 *
 *   node server-read.js [--only api,fallback,failures | all]
 *
 *   api       the workspace has a reading server (server/index.mjs in this process, with API_TOKEN and a fake reader
 *             that picks from the numbered places it receives: the first place (page 1's, or the first page with a
 *             place when page 1 has none) as the sponsor's text, then
 *             every place on the last page as the investor's signature, skipping a place whose box overlaps one already
 *             picked). The first agreement is uploaded as a sponsor does: the editor's fields are exactly the picked
 *             places, one each, each on its place's box, each for the picked person (sponsor = the countersigner); the
 *             button said "Finding every place to fill in…" while it waited
 *   fallback  the same upload with no reading server: the in-page reading stands (env.read.server: not used, no-server)
 *             and at least one field is placed (D-33: the in-page output itself is not judged)
 *   failures  the reading server answering 503, 504, 502, a malformed body, a refused connection, and no answer within
 *             the browser's limit (shortened to 3 s, the server waiting 6 s): each upload's fields (count, places, kinds,
 *             signers) and reading note equal the no-server upload's
 *
 * The first agreement lives outside the repository (SCRATCH/real-agreement/agreement.pdf, or EXAMPLE_PDF). A missing
 * harness or document prints "NOT RUN: (what)" and the exit status is 2. Output holds counts only. One line per check;
 * last line "SERVER READ: PASS" or "SERVER READ: FAIL"; exit 0 or 1.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const TEXT = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const WAIT = 'Finding every place to fill in…';
const ALL = ['api', 'fallback', 'failures'];
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if (!fs.existsSync(TEXT)) notRun('the first agreement is missing (' + TEXT + ')');
try {
  require.resolve('playwright');
} catch (e) {
  process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
const H = require(HARNESS);

const fails = [];
const line = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) fails.push(text.split(' ')[0]);
  return ok;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const hit = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;

/** The portal's server in this process (server/index.mjs) with a given reader; resolves to { base, token, close }. */
async function portalServer(reader) {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-check-'));
  const token = crypto.randomBytes(16).toString('hex');
  const env = { NODE_ENV: 'test', STORE_FILE: path.join(dir, 'store.json'), API_TOKEN: token, PORTAL_ORIGIN: '' };
  const server = createServer({ env, reader });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    token,
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}
/** A fake reader: answers with run(req) (a reader result), recording every request. */
function fakeReader(run) {
  const seen = [];
  return { seen, budget: null, maxTokens: () => 64000, count: async () => 1000, available: async () => true, read: async (req) => (seen.push(req), run(req)) };
}
/**
 * The fixed rule: the first numbered place (page 1's first, or the first page with a place when page 1 has none) as the
 * sponsor's text, then every place on the last page as the investor's signature.
 */
function picks(list) {
  const box = (e) => ({ id: e[0], page: e[1], x0: e[2], y0: e[3], x1: e[4], y1: e[5] });
  const last = Math.max.apply(null, list.map((e) => e[1]));
  const order = [list[0]].concat(list.filter((e) => e[1] === last && e !== list[0])).filter(Boolean);
  const out = [];
  order.forEach((e, k) => {
    const b = box(e);
    if (out.some((o) => o.page === b.page && hit(o, b))) return;
    out.push(Object.assign(b, k === 0 ? { kind: 'text', person: 'sponsor' } : { kind: 'signature', person: 'investor' }));
  });
  return out;
}
/** A server that answers every request with a fixed malformed body (CORS open). */
async function malformedServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    req.resume();
    req.on('end', () => res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":tru'));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, token: '', close: () => new Promise((r) => (server.closeAllConnections(), server.close(r))) };
}
/** A port nothing listens on (opened, then closed). */
async function closedBase() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  await new Promise((r) => s.close(r));
  return base;
}

/**
 * The first agreement uploaded as a sponsor does, in a browser of its own (a fresh workspace): the reading server saved
 * as the Integrations screen saves it (none when url is ''), the browser's limit set when given, then the editor read.
 */
async function upload({ url = '', token = '', limitMs = 0 } = {}) {
  const h = await H.start();
  try {
    if (url) await h.context.route(url + '/**', (r) => r.continue()); // the harness aborts every origin but its own
    const page = await H.signUp(h);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const offId = await page.evaluate(
      ({ url, token, limitMs }) => {
        const NS = window.CVPortal;
        const s = NS.integrations.ensure(NS.state.ws).server;
        s.url = url;
        s.token = token;
        if (limitMs) NS.esign.SERVER_LIMIT_MS = limitMs;
        NS.app.save(true);
        const ws = NS.state.ws;
        return ws.offerings[ws.offerings.length - 1].id;
      },
      { url, token, limitMs }
    );
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), offId);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
    await page.waitForSelector('#dlg[open] #es-agr-file');
    // Every text the submit button shows, kept as it appears.
    await page.evaluate(() => {
      window.__said = [];
      const btn = document.querySelector('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
      new MutationObserver(() => window.__said.push(btn.textContent)).observe(btn, { childList: true, characterData: true, subtree: true });
    });
    await page.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(TEXT) });
    await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
    await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 400000 });
    await page.waitForSelector('.es-read .es-agr-note', { timeout: 60000 });
    await page.waitForTimeout(300);
    const seen = await page.evaluate(() => {
      const NS = window.CVPortal;
      const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param) || NS.state.ws.envelopes[NS.state.ws.envelopes.length - 1];
      const role = (id) => (env.signers.find((s) => s.id === id) || {}).role || '';
      const fields = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        return { page: f.page, type: f.type, kind: f.kind || '', role: role(f.signerId), required: !!f.required, x0: f.x * ps.w, y0: f.y * ps.h, x1: (f.x + f.w) * ps.w, y1: (f.y + f.h) * ps.h };
      });
      const note = document.querySelector('.es-read .es-agr-note');
      return { fields, note: note ? note.textContent : '', readNote: NS.esign.readNote(env), server: (env.read && env.read.server) || null, said: window.__said.slice() };
    });
    await page.close();
    return seen;
  } finally {
    await h.stop();
  }
}
/** A field list as compared between uploads: count, places (to 0.1 pt), kinds, signers. */
const shape = (s) =>
  JSON.stringify(
    s.fields
      .map((f) => [f.page, f.type, f.kind, f.role, f.required, ...[f.x0, f.y0, f.x1, f.y1].map((v) => Math.round(v * 10) / 10)])
      .sort((a, b) => a[0] - b[0] || a[6] - b[6] || a[5] - b[5])
  );

(async () => {
  const run = async (part, check) => {
    if (!PARTS.includes(part) && !(part === 'fallback' && PARTS.includes('failures'))) return;
    try {
      await check();
    } catch (e) {
      line(false, `${part} run: ${String((e && e.message) || e).slice(0, 300)}`);
    }
  };

  await run('api', async () => {
    let chose = [];
    const reader = fakeReader(async (req) => {
      chose = picks(req.list);
      return { ok: true, fields: chose.map((c) => ({ id: c.id, kind: c.kind, person: c.person, group: 'all' })), missing: [], reason: '', ms: 5, model: 'fake-model', stopReason: 'end_turn', usage: {} };
    });
    const srv = await portalServer(reader);
    try {
      const s = await upload({ url: srv.base, token: srv.token });
      const req = reader.seen[0];
      line(reader.seen.length === 1 && !!req && req.count === req.list.length && req.list.length > 0 && /=== Page 1 /.test(req.text) && req.pages > 0, `api the reading server got the PDF and ${req ? req.list.length : 0} numbered places over ${req ? req.pages : 0} pages (${reader.seen.length} request(s))`);
      const matched = chose.map((c) => s.fields.filter((f) => f.page === c.page && hit(f, c)));
      const each = chose.every((c, k) => matched[k].length === 1 && matched[k][0].type === c.kind && matched[k][0].role === (c.person === 'sponsor' ? 'countersigner' : 'investor'));
      const sponsor = chose.filter((c) => c.person === 'sponsor').length;
      line(s.fields.length === chose.length && each && sponsor === 1, `api ${s.fields.length} fields for ${chose.length} picked places (${sponsor} the sponsor's); each picked place has exactly one field on its box, of the picked kind and person: ${each ? 'yes' : 'no'}`);
      line(!!s.server && s.server.used === true && s.server.why === 'read' && s.server.fields === chose.length && s.server.dropped === 0, `api env.read.server ${JSON.stringify(s.server)}`);
      const waited = s.said.includes(WAIT);
      line(waited, `api the button said "${WAIT}" while waiting: ${waited ? 'yes' : 'no'}`);
    } finally {
      await srv.close();
    }
  });

  let base = null;
  await run('fallback', async () => {
    base = await upload();
    line(!!base.server && base.server.used === false && base.server.why === 'no-server' && base.fields.length >= 1 && !base.said.includes(WAIT), `fallback no reading server: env.read.server ${JSON.stringify(base.server)}, ${base.fields.length} in-page fields, waiting sentence ${base.said.includes(WAIT) ? 'shown (wrong)' : 'not shown'}`);
  });

  await run('failures', async () => {
    if (!base) return line(false, 'failures no no-server upload to compare with');
    const want = shape(base);
    const same = (name, s, why) => line(shape(s) === want && s.note === base.note && s.readNote === base.readNote && !!s.server && s.server.used === false && s.server.why === why, `failures ${name}: ${s.fields.length} fields (no-server ${base.fields.length}), fields ${shape(s) === want ? 'equal' : 'differ'}, note ${s.note === base.note && s.readNote === base.readNote ? 'equal' : 'differs'}, why ${s.server && s.server.why} (want ${why})`);
    for (const [name, result, why] of [
      ['503', { ok: false, reason: 'unavailable' }, 'unavailable'],
      ['504', { ok: false, reason: 'timeout' }, 'timeout'],
      ['502', { ok: false, reason: 'failed' }, 'failed']
    ]) {
      const srv = await portalServer(fakeReader(async () => Object.assign({ fields: [], missing: [], ms: 1, model: '', stopReason: '', usage: {} }, result)));
      try {
        same(name, await upload({ url: srv.base, token: srv.token }), why);
      } finally {
        await srv.close();
      }
    }
    const bad = await malformedServer();
    try {
      same('malformed body', await upload({ url: bad.base }), 'invalid');
    } finally {
      await bad.close();
    }
    same('refused connection', await upload({ url: await closedBase() }), 'network');
    const slow = await portalServer(fakeReader(async () => (await pause(6000), { ok: true, fields: [], missing: [], ms: 6000, model: '', stopReason: 'end_turn', usage: {} })));
    try {
      const s = await upload({ url: slow.base, token: slow.token, limitMs: 3000 });
      same('past the browser limit', s, 'timeout');
      line(s.said.includes(WAIT), `failures past the browser limit: the waiting sentence was shown: ${s.said.includes(WAIT) ? 'yes' : 'no'}`);
    } finally {
      await slow.close();
    }
  });

  console.log(fails.length ? `SERVER READ: FAIL - ${fails.join('; ')}` : 'SERVER READ: PASS');
  process.exit(fails.length ? 1 : 0);
})();
