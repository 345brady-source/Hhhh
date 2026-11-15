#!/usr/bin/env node
/*
 * Plan 01.4-64: an uploaded agreement read through the portal's reading server (D-31), on the real upload screen.
 *
 *   node server-read.js [--only api,fallback,failures | all]
 *
 *   api       the workspace has a reading server (server/index.mjs in this process, with API_TOKEN and a fake reader
 *             that picks from the numbered places it receives: the first place (page 1's, or the first page with a
 *             place when page 1 has none) as the sponsor's signature, then
 *             every place on the last page as the investor's signature, skipping a place whose box overlaps one already
 *             picked). The first agreement is uploaded as a sponsor does: the editor's fields are exactly the picked
 *             places, one each, each on its place's box, each for the picked person (sponsor = the countersigner); the
 *             button said "Finding every place to fill in…" while it waited
 *   fallback  the same upload with no reading server: the in-page reading stands (env.read.server: not used, no-server)
 *             and at least one field is placed (D-33: the in-page output itself is not judged)
 *   failures  the reading server answering 503, 504, 502, a malformed body, a refused connection, and no answer within
 *             the browser's limit (shortened to 3 s, the server waiting 6 s): each upload's fields (count, places, kinds,
 *             signers) and reading note equal the no-server upload's (plan 69: 503, 504, 502 and the refused connection
 *             are each tried 3 times first, D-38)
 *
 * Plan 01.4-69 (D-38), fake readers only, nothing spent:
 *   picture   the first agreement rendered to pictures (picture-pdf.js, into SCRATCH/edgar/measure/out-69) and the owner's
 *             picture form: one numbered image per picture page whose marks are exactly the list's numbers for that
 *             page, the page's words replaced by "(read the page image)", the fields exactly the fixed rule's picks on
 *             their candidates' pixel boxes, the picture notice once; the first agreement as it is sends plan 64's
 *             request (the uploaded file, { pdf, pages, text, list }, no image)
 *   broken    the first agreement rendered with a scrambled invisible text layer: every page flagged and sent as an image,
 *             the fields the picks
 *   long      NS.esign.RANGE_PAGES 3: consecutive ranges, each a new PDF of exactly its pages with its own places
 *             (numbered across the agreement), the fields equal to the one-request reading's; RANGE_BYTES lowered: halved
 *             until each body fits; a 413 (over 900000 counted tokens) halved and sent again, never unchanged
 *   retry     a stand-in server answering 503, 503 then 200; 429 then 200; a refused connection then 200: read, no added
 *             note; 503 every time: today's fallback after exactly 3 attempts; 400, 401 and 402: never sent again
 *   firmsign  a reading that gives the firm a field and no signature: one firm signature field added on the firm's
 *             acceptance block or directly below its last field, inside the page, and the agreement saves; a reading with a
 *             firm signature is unchanged
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
const ALL = ['api', 'fallback', 'failures', 'picture', 'long', 'broken', 'retry', 'firmsign'];
const FORM = process.env.PRINTED_PDF || path.join(SCRATCH, 'xx/printed-no-text.pdf');
const OUT69 = path.join(SCRATCH, 'edgar/measure/out-69');
const NOTICE = 'This document was read from page pictures, which is common when a document is printed to PDF. For better accuracy, upload a PDF with selectable text.';
const PP = require('./picture-pdf.js');
const i = process.argv.indexOf('--only');
const want = i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
if (!fs.existsSync(TEXT)) notRun('the first agreement is missing (' + TEXT + ')');
if (PARTS.includes('picture') && !fs.existsSync(FORM)) notRun("the owner's picture form is missing (" + FORM + ')');
if (PARTS.some((p) => ['picture', 'long', 'broken'].includes(p)))
  ['pdftoppm', 'pdftotext', 'pdfinfo'].forEach((t) => {
    try {
      execFileSync(t, ['-v'], { stdio: 'ignore' });
    } catch (e) {
      if (e.code === 'ENOENT') notRun(t + ' is not installed');
    }
  });
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
 * sponsor's signature, then every place on the last page as the investor's signature. (A sponsor field needs a sponsor
 * signature on the agreement, as for the in-page reading, so the sponsor's pick is a signature.)
 */
function picks(list) {
  const box = (e) => ({ id: e[0], page: e[1], x0: e[2], y0: e[3], x1: e[4], y1: e[5] });
  const last = Math.max.apply(null, list.map((e) => e[1]));
  const order = [list[0]].concat(list.filter((e) => e[1] === last && e !== list[0])).filter(Boolean);
  const out = [];
  order.forEach((e, k) => {
    const b = box(e);
    if (out.some((o) => o.page === b.page && hit(o, b))) return;
    out.push(Object.assign(b, k === 0 ? { kind: 'signature', person: 'sponsor' } : { kind: 'signature', person: 'investor' }));
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
/**
 * A stand-in reading server (CORS open) that answers POST /v1/read with the given statuses in turn, then 200 with the
 * fixed rule's picks from the request's list; attempts() counts the requests. opts.port: listen on that port.
 */
async function scriptedServer(statuses, opts) {
  const queue = statuses.slice();
  let attempts = 0;
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => {
      attempts++;
      const status = queue.length ? queue.shift() : 200;
      if (status !== 200) return res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, reason: status === 413 ? 'too_large' : status === 503 ? 'unavailable' : 'failed' }));
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(parts).toString('utf8'));
      } catch (e) {
        body = { list: [] };
      }
      const chose = picks(body.list || []);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, fields: chose.map((c) => ({ id: c.id, kind: c.kind, person: c.person, group: 'all' })), missing: [], ms: 1 }));
    });
  });
  await new Promise((r) => server.listen((opts && opts.port) || 0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, token: '', attempts: () => attempts, close: () => new Promise((r) => (server.closeAllConnections(), server.close(r))) };
}
/** The number of pages of a base64 PDF (pdfinfo, through a file in OUT69 removed at once). */
function pdfPages(b64) {
  fs.mkdirSync(OUT69, { recursive: true });
  const f = path.join(OUT69, 'range-' + crypto.randomBytes(4).toString('hex') + '.pdf');
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  try {
    return Number((/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [f], { encoding: 'utf8' })) || [])[1] || 0);
  } finally {
    fs.rmSync(f, { force: true });
  }
}
let refusedOnce = false;
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
async function upload({ url = '', token = '', limitMs = 0, file = TEXT, set = null, bodies = null, save = false } = {}) {
  const h = await H.start();
  try {
    // The harness aborts every origin but its own. Plan 69: the bodies sent to /v1/read are kept when asked.
    if (url)
      await h.context.route(url + '/**', (r) => {
        const q = r.request();
        if (q.method() === 'POST' && /\/v1\/read$/.test(q.url())) {
          if (bodies) bodies.push(q.postData() || '');
          refusedOnce = true;
        }
        return r.continue();
      });
    const page = await H.signUp(h);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const offId = await page.evaluate(
      ({ url, token, limitMs, set }) => {
        const NS = window.CVPortal;
        const s = NS.integrations.ensure(NS.state.ws).server;
        s.url = url;
        s.token = token;
        if (limitMs) NS.esign.SERVER_LIMIT_MS = limitMs;
        Object.assign(NS.esign, set || {});
        NS.app.save(true);
        const ws = NS.state.ws;
        return ws.offerings[ws.offerings.length - 1].id;
      },
      { url, token, limitMs, set }
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
    await page.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(file) });
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
      return { fields, note: note ? note.textContent : '', readNote: NS.esign.readNote(env), server: (env.read && env.read.server) || null, said: window.__said.slice(), sizes: env.pageSizes.map((p) => ({ w: p.w, h: p.h })), docId: env.docId, todo: NS.esign.agreementTodo(env) };
    });
    // Plan 69: the firm's acceptance block on the page of the firm's last non-signature field, when it prints one.
    const firmLast = seen.fields.filter((f) => f.role === 'countersigner' && f.type !== 'signature').sort((a, b) => a.page - b.page || a.y1 - b.y1).pop();
    seen.block = firmLast
      ? await page.evaluate(
          async ({ docId, n }) => {
            const NS = window.CVPortal;
            const pages = await NS.esign.pageLayout(docId, { kept: true });
            const b = NS.placement.acceptanceBlock(pages.find((p) => p.page === n));
            return b ? { x0: b.x0, x1: b.x1, base: b.base } : null;
          },
          { docId: seen.docId, n: firmLast.page }
        )
      : null;
    if (save) {
      await page.click('[data-action="es-agreement-save"]');
      seen.saved = await page.waitForFunction((id) => location.hash === '#console-offering-' + id, offId, { timeout: 8000 }).then(
        () => page.evaluate((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), offId),
        () => false
      );
    }
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

  // ---------- D-38: picture pages read from numbered page images ----------
  let apiNote = null;
  /** Checks one upload's requests against the picture rule: one image per picture page, its marks the list's ids there. */
  const imagesMatch = (req) => {
    const imgs = req.images || [];
    const ok = imgs.every((im) => {
      const want = req.list.filter((e) => e[1] === im.page).map((e) => e[0]).sort((a, b) => a - b);
      const got = (im.marks || []).slice().sort((a, b) => a - b);
      return JSON.stringify(want) === JSON.stringify(got) && /^image\/(jpeg|png)$/.test(im.media_type) && im.data.length > 1000;
    });
    return { ok, pages: imgs.map((im) => im.page) };
  };
  /** A fake reader that picks by the fixed rule from each request's list and records every request. */
  const pickingReader = (rule) => {
    const state = { chose: [] };
    const reader = fakeReader(async (req) => {
      // SERVER_READ_DUMP=<dir>: the page images are also written there, for a person to look at (never into the repository).
      if (process.env.SERVER_READ_DUMP) (req.images || []).forEach((im) => fs.writeFileSync(path.join(process.env.SERVER_READ_DUMP, `p${im.page}-${reader.seen.length}.jpg`), Buffer.from(im.data, 'base64')));
      const chose = (rule || picks)(req.list, req);
      state.chose = state.chose.concat(chose);
      return { ok: true, fields: chose.map((c) => ({ id: c.id, kind: c.kind, person: c.person, group: 'all' })), missing: [], reason: '', ms: 5, model: 'fake-model', stopReason: 'end_turn', usage: {} };
    });
    reader.state = state;
    return reader;
  };
  /** Fields exactly the picks: one field each, on its candidate's box, of the picked kind and person. */
  const exactlyPicks = (s, chose) => {
    const matched = chose.map((c) => s.fields.filter((f) => f.page === c.page && hit(f, c)));
    return s.fields.length === chose.length && chose.every((c, k) => matched[k].length === 1 && matched[k][0].type === c.kind && matched[k][0].role === (c.person === 'sponsor' ? 'countersigner' : 'investor'));
  };
  const count = (text, sub) => text.split(sub).length - 1;

  await run('picture', async () => {
    fs.mkdirSync(OUT69, { recursive: true });
    const pictures = path.join(OUT69, 'agreement-pictures.pdf');
    if (!fs.existsSync(pictures)) await PP.make({ input: TEXT, output: pictures });
    const pages = PP.pageSizes(pictures).length;
    for (const [name, file] of [
      ['the first agreement rendered to pictures', pictures],
      ["the owner's picture form", FORM]
    ]) {
      const reader = pickingReader();
      const srv = await portalServer(reader);
      try {
        const s = await upload({ url: srv.base, token: srv.token, file });
        const n = PP.pageSizes(file).length;
        const req = reader.seen[0] || { list: [], images: [] };
        const im = imagesMatch(req);
        const listPages = new Set(req.list.map((e) => e[1]));
        line(reader.seen.length === 1 && (req.images || []).length >= listPages.size && [...listPages].every((p) => im.pages.includes(p)) && im.pages.length === n, `picture ${name}: ${(req.images || []).length} page images for ${n} pages (${listPages.size} pages with numbered places), one request`);
        line(im.ok, `picture ${name}: every image carries exactly the numbers the list gives for its page (${req.list.length} places)`);
        line(/\(read the page image\)/.test(req.text || '') && count(req.text || '', '(read the page image)') === im.pages.length, `picture ${name}: the text replaces each picture page's words with "(read the page image)" (${count(req.text || '', '(read the page image)')} pages)`);
        const chose = reader.state.chose;
        line(chose.length > 0 && exactlyPicks(s, chose), `picture ${name}: ${s.fields.length} fields for ${chose.length} picks, each on its candidate's pixel box with the picked kind and person`);
        line(count(s.note, NOTICE) === 1, `picture ${name}: the picture notice is in the reading note ${count(s.note, NOTICE)} time(s) (1 expected)`);
        if (file === pictures) line(n === pages, `picture the picture copy has ${n} pages (${pages} made)`);
      } finally {
        await srv.close();
      }
    }
    // A text agreement: no images, and the request is plan 64's (the uploaded file itself, the four keys in order).
    const reader = pickingReader();
    const srv = await portalServer(reader);
    try {
      const bodies = [];
      const s = await upload({ url: srv.base, token: srv.token, bodies });
      const b = bodies[0] ? JSON.parse(bodies[0]) : {};
      const req = reader.seen[0] || {};
      line(bodies.length === 1 && Object.keys(b).join(',') === 'pdf,pages,text,list' && b.pdf === fs.readFileSync(TEXT).toString('base64') && b.pages === 13 && b.list.every((e, k) => e[0] === k + 1) && !/read the page image/.test(b.text), `picture text pages unchanged: the request is { ${Object.keys(b).join(', ')} } with the uploaded file itself and no image`);
      line(!req.images && exactlyPicks(s, reader.state.chose), `picture text pages unchanged: no image reached the reader, ${s.fields.length} fields are the picks`);
      apiNote = s.readNote;
    } finally {
      await srv.close();
    }
  });

  await run('broken', async () => {
    fs.mkdirSync(OUT69, { recursive: true });
    const broken = path.join(OUT69, 'agreement-scrambled.pdf');
    if (!fs.existsSync(broken)) await PP.make({ input: TEXT, output: broken, scramble: true });
    const reader = pickingReader();
    const srv = await portalServer(reader);
    try {
      const s = await upload({ url: srv.base, token: srv.token, file: broken });
      const req = reader.seen[0] || { list: [] };
      const im = imagesMatch(req);
      const n = PP.pageSizes(broken).length;
      line(reader.seen.length === 1 && im.pages.length === n && im.ok, `broken every page of the scrambled copy is sent as a numbered image (${im.pages.length} of ${n} pages, marks ${im.ok ? 'match' : 'differ'})`);
      line(!!s.server && s.server.used && (s.server.pictures || []).length === n, `broken every page flagged unreadable (${(s.server && s.server.pictures ? s.server.pictures.length : 0)} of ${n})`);
      line(reader.state.chose.length > 0 && exactlyPicks(s, reader.state.chose), `broken ${s.fields.length} fields are the ${reader.state.chose.length} picks`);
    } finally {
      await srv.close();
    }
  });

  await run('long', async () => {
    // The picks of the one-request reading, answered by each range for the ids it carries.
    const one = pickingReader();
    let srv = await portalServer(one);
    let whole = null;
    try {
      whole = await upload({ url: srv.base, token: srv.token });
    } finally {
      await srv.close();
    }
    const P = new Map(one.state.chose.map((c) => [c.id, c]));
    const subset = (list) => list.filter((e) => P.has(e[0])).map((e) => P.get(e[0]));
    const ranged = pickingReader((list) => subset(list));
    srv = await portalServer(ranged);
    try {
      const s = await upload({ url: srv.base, token: srv.token, set: { RANGE_PAGES: 3 } });
      const ranges = ranged.seen.map((q) => q.range || [1, q.pages, q.pages]);
      const want = [];
      for (let a = 1; a <= 13; a += 3) want.push([a, Math.min(13, a + 2), 13]);
      const withPlaces = want.filter(([a, b]) => one.seen[0].list.some((e) => e[1] >= a && e[1] <= b));
      line(JSON.stringify(ranges) === JSON.stringify(withPlaces), `long RANGE_PAGES 3: ${ranged.seen.length} requests, pages ${ranges.map((r) => r[0] + '-' + r[1]).join(', ')} (every range with numbered places, in order)`);
      const own = ranged.seen.every((q) => q.list.every((e) => e[1] >= q.range[0] && e[1] <= q.range[1]) && pdfPages(q.pdf) === q.range[1] - q.range[0] + 1 && q.pages === q.range[1] - q.range[0] + 1);
      line(own, 'long each request carries only its range: a new PDF of exactly its pages and its own numbered places');
      const ids = ranged.seen.flatMap((q) => q.list.map((e) => e[0]));
      line(ids.length === one.seen[0].list.length && ids.every((id, k) => id === one.seen[0].list[k][0]), `long the numbers run across the agreement: ${ids.length} places sent once each (${one.seen[0].list.length} in the one-request reading)`);
      line(shape(s) === shape(whole), `long the fields equal the one-request reading's (${s.fields.length} and ${whole.fields.length})`);
    } finally {
      await srv.close();
    }
    // Over the byte limit (shortened for the test): halved until each request fits; never a fallback for size.
    const halves = pickingReader((list) => subset(list));
    srv = await portalServer(halves);
    try {
      const bodies = [];
      const limit = Math.round(fs.readFileSync(TEXT).toString('base64').length * 0.6);
      const s = await upload({ url: srv.base, token: srv.token, set: { RANGE_BYTES: limit }, bodies });
      const ranges = halves.seen.map((q) => q.range || [1, 13, 13]);
      line(halves.seen.length >= 2 && bodies.every((b) => b.length <= limit) && s.server.used && shape(s) === shape(whole), `long a request over the byte limit is halved: ${halves.seen.length} requests (${ranges.map((r) => r[0] + '-' + r[1]).join(', ')}), every body within ${limit} characters, fields equal`);
    } finally {
      await srv.close();
    }
    // A request the server answers 413 (over 900000 counted tokens) is halved and sent again, never unchanged.
    const pictures = path.join(OUT69, 'agreement-pictures.pdf');
    if (!fs.existsSync(pictures)) await PP.make({ input: TEXT, output: pictures });
    const big = pickingReader();
    big.count = async (q) => ((q.images || []).length > 7 ? 950000 : 1000);
    srv = await portalServer(big);
    try {
      const bodies = [];
      const s = await upload({ url: srv.base, token: srv.token, file: pictures, bodies });
      const sent = bodies.map((b) => JSON.parse(b)).map((b) => (b.range ? b.range.slice(0, 2) : [1, b.pages]));
      const unchanged = sent.some((r, k) => k > 0 && JSON.stringify(r) === JSON.stringify(sent[k - 1]));
      line(bodies.length === 3 && JSON.stringify(sent) === '[[1,13],[1,7],[8,13]]' && !unchanged && s.server.used, `long a 413 is halved and sent again: requests ${sent.map((r) => r.join('-')).join(', ')}, read ${s.server.used ? 'yes' : 'no'}`);
    } finally {
      await srv.close();
    }
  });

  await run('retry', async () => {
    if (!base) base = await upload();
    const want = shape(base);
    const ok200 = async (name, statuses, extra) => {
      const srv = await scriptedServer(statuses, extra);
      try {
        const s = await upload({ url: srv.base });
        line(s.server && s.server.used && srv.attempts() === statuses.length + 1 && s.fields.length > 0 && (apiNote === null || s.readNote === apiNote), `retry ${name} then 200: ${srv.attempts()} attempts, the reader's ${s.fields.length} fields, ${apiNote === null || s.readNote === apiNote ? 'no added note' : 'the note differs'}`);
      } finally {
        await srv.close();
      }
    };
    await ok200('503, 503', [503, 503]);
    await ok200('429', [429]);
    // A refused connection: the port opens only after the first attempt has failed.
    {
      const port = Number((await closedBase()).split(':').pop());
      refusedOnce = false;
      const pending = upload({ url: `http://127.0.0.1:${port}` });
      let srv = null;
      const opener = (async () => {
        await pause(400);
        // Opened once the first attempt was refused (the upload reads the PDF first: wait for the first try).
        for (let k = 0; k < 600 && !refusedOnce; k++) await pause(100);
        srv = await scriptedServer([], { port });
      })();
      const s = await pending;
      await opener;
      line(s.server && s.server.used && s.fields.length > 0, `retry a refused connection then 200: read by the server (${s.server && s.server.why}), ${s.fields.length} fields`);
      if (srv) await srv.close();
    }
    // Every attempt 503: today's fallback after exactly 3 attempts.
    {
      const srv = await scriptedServer([503, 503, 503, 503]);
      try {
        const s = await upload({ url: srv.base });
        line(srv.attempts() === 3 && shape(s) === want && s.server.why === 'unavailable', `retry 503 on every attempt: ${srv.attempts()} attempts (3 expected), then the in-page result (fields ${shape(s) === want ? 'equal' : 'differ'}), why ${s.server.why}`);
      } finally {
        await srv.close();
      }
    }
    for (const status of [400, 401, 402]) {
      const srv = await scriptedServer([status, 200]);
      try {
        const s = await upload({ url: srv.base });
        line(srv.attempts() === 1 && shape(s) === want && !s.server.used, `retry ${status} is never sent again: ${srv.attempts()} attempt, the in-page result kept`);
      } finally {
        await srv.close();
      }
    }
  });

  await run('firmsign', async () => {
    // The sponsor's place picked as a name (not a signature): the firm has a field and nowhere to sign.
    const rule = (list) => picks(list).map((c, k) => (k === 0 ? Object.assign({}, c, { kind: 'name' }) : c));
    const reader = pickingReader(rule);
    const srv = await portalServer(reader);
    try {
      const s = await upload({ url: srv.base, token: srv.token, save: true });
      const chose = reader.state.chose;
      const firm = s.fields.filter((f) => f.role === 'countersigner');
      const sig = firm.filter((f) => f.type === 'signature');
      const named = firm.filter((f) => f.type !== 'signature');
      line(sig.length === 1 && named.length === 1 && s.fields.length === chose.length + 1, `firmsign one firm signature field added (${sig.length}) beside the firm's ${named.length} other field; ${s.fields.length} fields for ${chose.length} picks`);
      const f = sig[0];
      const last = named[0];
      const ps = s.sizes[f ? f.page - 1 : 0];
      const inside = !!f && f.x0 >= 0 && f.y0 >= 0 && f.x1 <= ps.w && f.y1 <= ps.h;
      const block = s.block;
      const onBlock = !!f && !!block && f.page === last.page && f.y1 > block.base && f.y0 - block.base <= 160;
      const below = !!f && !block && f.page === last.page && f.y0 >= last.y1 - 1 && f.y0 - last.y1 <= 70;
      line(inside && (onBlock || below), `firmsign it sits ${block ? 'on the firm\'s acceptance block' : 'directly below the firm\'s last field'} on page ${f ? f.page : 0}, inside the page: ${inside && (onBlock || below) ? 'yes' : 'no'}`);
      line(s.saved === true, `firmsign the agreement saves after the reading (${s.saved ? 'saved' : 'refused: ' + String(s.todo).slice(0, 120)})`);
    } finally {
      await srv.close();
    }
    // A reading that already has a firm signature is unchanged (nothing added).
    const plain = pickingReader();
    const srv2 = await portalServer(plain);
    try {
      const s = await upload({ url: srv2.base, token: srv2.token });
      line(s.fields.length === plain.state.chose.length && exactlyPicks(s, plain.state.chose), `firmsign a reading with a firm signature is unchanged (${s.fields.length} fields for ${plain.state.chose.length} picks)`);
    } finally {
      await srv2.close();
    }
  });

  console.log(fails.length ? `SERVER READ: FAIL - ${fails.join('; ')}` : 'SERVER READ: PASS');
  process.exit(fails.length ? 1 : 0);
})();
