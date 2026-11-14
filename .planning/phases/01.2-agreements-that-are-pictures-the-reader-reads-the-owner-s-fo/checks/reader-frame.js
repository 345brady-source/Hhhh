#!/usr/bin/env node
/*
 * The text reader's engine inside the reproduced preview frame.
 *
 *   node reader-frame.js [--probe] [--strict-only] [--opaque] [--shots <folder outside the repository>]
 *   node reader-frame.js --form
 *
 * The frame is the proof runner's: a host page on one origin, the portal in a sandboxed frame on another, the framed
 * page served with the preview's content policy, every request to another host aborted and listed. Here every request
 * for a .gz or .gz.txt file is also answered 404, and assets/js/textengine.js is added to the framed page by a script
 * element of its own origin (no page links it yet).
 *
 *   pass 1  worker files served plainly (as the reproduced preview serves them): the engine starts, reads a drawn
 *           line exactly, reads a blank strip as no word, stops twice; no request to another host, no policy refusal
 *   pass 2  the same worker files answered with the page's policy as their own header (the state the real host may be
 *           in): start() rejects with code load, why compile, within 20 seconds, and a second start tries afresh
 *   pass 3  the frame without allow-same-origin (the page may start no worker): start() rejects with code load, why
 *           worker, within 20 seconds; nothing thrown at the page; no request to another host. The proof runner
 *           decides the frame's sandbox when it is loaded, so this pass runs as a child process with --opaque.
 *
 * In pass 1 a blank strip is also read (no word), the worker is counted (one while started, none after stop), and
 * each of the reader's own two small files is answered 404 once (code load, why file).
 *
 * --probe runs the same three states on reader-probe.html instead: the page is opened in the same frame, answered
 * with the framed portal page's policy, and must show the sentence for the state within 25 seconds (it works; it could
 * not start, with the fixed sentence for compile; it could not start, with the fixed sentence for worker). Its
 * visible text may hold only the fixed sentences and the seconds: what the engine itself said is on the console only.
 * --shots saves a picture of the probe page in each state.
 *
 * --form reads the owner's form inside the same frame (worker files served plainly, .gz and .gz.txt answered 404,
 * nothing added to the framed page: the portal loads its reader itself): the sample firm's offering is made ready,
 * the form goes through the real upload dialog, "Read these pages from their picture" is pressed and the reading is
 * waited for, then the fields are read from the editor. Required: the count of fields by kind, by owner and by kind
 * and owner together equals the answer sheet's (computed from the sheet; the kinds and owners told by the scorer's
 * own rules, taken from its source); every field is marked; no request to another host was aborted; the frame holds
 * no policy refusal; every reader file answered came from the framed portal's own origin and folder (assets/) and
 * the reader's module was among them; no .gz file was answered; nothing was thrown at the page. Printed are counts,
 * kinds and seconds only. The owner's form, the answer sheet and the scorer are outside the repository
 * (PICTURE_SCRATCH; PRINTED_PDF overrides the form); when one is missing: "NOT RUN: ..." and exit 2.
 *
 * --strict-only runs pass 2 alone, --opaque pass 3 alone; with neither, all three run, one browser at a time.
 * The test line is made up and comes from no document. Last line: "READER FRAME: PASS" or "READER FRAME: FAIL - ...";
 * exit 0 or 1. When the proof runner or the browser driver is missing: "NOT RUN: ..." and exit 2.
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PROOF = path.join(process.env.PROOF_DIR || path.join(SCRATCH, 'build/proof'), 'proof.js');
const OPAQUE = process.argv.includes('--opaque');
const STRICT_ONLY = process.argv.includes('--strict-only');
const PROBE = process.argv.includes('--probe');
const FORM = process.argv.includes('--form');
const FORM_PDF = process.env.PRINTED_PDF || path.join(SCRATCH, 'xx/printed-no-text.pdf');
const SHEET = path.join(SCRATCH, 'build/ocr-truth/truth-printed.json');
const SCORER = path.join(path.dirname(PROOF), 'score-notext.js');
const OFFER_RE = /read (these|the|those)? ?pages? from (their|its|the) pictures?/i;
const BUSY_RE = /Reading page \d+ of \d+|Finding the boxes on page \d+ of \d+|Reading [^.]{0,60}(…|\.\.\.)/;
const FORM_MS = 240000;
const READER_FILE = /\/assets\/vendor\/textread\/[^/]+$|\/assets\/js\/(textengine|textread|picturepage)\.js$/;
const SHOTS = process.argv.includes('--shots') ? path.resolve(process.argv[process.argv.indexOf('--shots') + 1] || '') : '';
const LINE = 'Reader test line 123 INITIALS';
const TITLE = 'Text reader check';
const SAYS = {
  works: 'The text reader works here.',
  cannot: 'The text reader could not start here. Boxes are still found on a picture page; the words by them are not read.',
  unread: 'The text reader started but did not read the test line.'
};
const WHY = {
  worker: 'This page is not allowed to start the reader’s background worker.',
  compile: 'This host does not allow the reader’s code to be prepared for running.',
  file: 'One of the reader’s own files could not be loaded.',
  time: 'The reader did not answer within 20 seconds.'
};
const SECONDS = /^The (start|attempt) took (under 0\.1|\d+\.\d) seconds\.$/;
const PROBE_MS = 25000;
const LOAD_MS = 20000;
const WORKER_FILES = ['textread-boot.js', 'language-data.js', 'textread-worker.min.js', 'textread-core.wasm.js'];

const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
if (!fs.existsSync(PROOF)) notRun(`the proof runner is missing (${PROOF}); set PROOF_DIR or PICTURE_SCRATCH`);
if (FORM) {
  if (!fs.existsSync(FORM_PDF)) notRun(`the owner's form is missing (${FORM_PDF}); set PRINTED_PDF or PICTURE_SCRATCH`);
  if (!fs.existsSync(SHEET)) notRun(`the answer sheet is missing (${SHEET})`);
  if (!fs.existsSync(SCORER)) notRun(`the scorer is missing (${SCORER}); its rules tell kinds and owners`);
}
let chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  try {
    process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    require('module').Module._initPaths();
    chromium = require('playwright').chromium;
  } catch (e2) {
    notRun('the browser driver (playwright) cannot be loaded');
  }
}
// the runner reads its checkout and the frame's sandbox from the command line when it is loaded
process.argv = process.argv.slice(0, 2).concat(['--root', ROOT], OPAQUE ? ['--opaque'] : []);
const P = require(PROOF);
if (path.resolve(P.ROOT) !== ROOT) notRun(`the proof runner serves ${P.ROOT}, not this checkout (${ROOT})`);
const WRAPPER = process.env.WRAPPER || path.join(P.SCRATCH, 'artifact/diy-portal.html');
if (!fs.existsSync(WRAPPER)) notRun(`the preview's wrapper page is missing (${WRAPPER})`);
P.PORTS.from = 8760;
P.PORTS.to = 8790;

const fails = [];
const need = (ok, what) => (ok ? true : (fails.push(what), console.log('  FAIL: ' + what), false));
const within = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(what + ' did not answer in ' + ms / 1000 + ' s')), ms))]);
const one = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/** One browser, the portal in the frame, the reader's module added to it. opts.strict: the worker files carry the page's policy. */
async function frame(opts, body) {
  const srv = await P.startServers();
  const browser = await chromium.launch();
  try {
    const C = await P.newContext(browser, srv);
    const seen = [];
    const answered = [];
    let policy = '';
    C.context.on('response', (r) => {
      const u = r.url().split('?')[0];
      if (READER_FILE.test(u) || /\.gz(\.txt)?$/.test(u)) answered.push({ url: u, status: r.status() });
      if (/\/diy-portal\.html$/.test(u)) policy = r.headers()['content-security-policy'] || policy;
      if (/\/assets\/vendor\/textread\/|\/assets\/js\/textengine\.js$|\/reader-probe\.html$/.test(u) || (opts.probe && /\/assets\/css\/tokens\.css$/.test(u))) seen.push(`${r.status()} ${u.split('/').pop()}`);
    });
    C.context.on('requestfailed', (q) => seen.push(`FAILED ${q.url().split('?')[0].split('/').pop()} (${(q.failure() || {}).errorText || 'no reason given'})`));
    await C.context.route(/\.gz(\.txt)?(\?.*)?$/, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not served' }));
    if (opts.strict)
      await C.context.route(/\/assets\/vendor\/textread\/[^/?]+\.js(\?.*)?$/, (route) => {
        const name = route.request().url().split('?')[0].split('/').pop();
        if (!WORKER_FILES.includes(name)) return route.fallback();
        return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Content-Security-Policy': policy }, body: fs.readFileSync(path.join(ROOT, 'assets/vendor/textread', name)) });
      });
    const S = await P.openPortal(C, srv, true, '');
    await S.P.waitForFunction(() => window.CVPortal && document.readyState === 'complete', null, { timeout: 30000 });
    need(!!policy, 'the framed page carried no content policy');
    if (opts.probe || opts.form) return await body({ S, C, seen, answered, srv, policy: () => policy });
    await within(
      S.P.evaluate(
        () =>
          window.CVPortal.textengine ||
          new Promise((ok, no) => {
            const s = document.createElement('script');
            s.src = new URL('assets/js/textengine.js', document.baseURI).href;
            s.onload = () => ok(true);
            s.onerror = () => no(new Error('assets/js/textengine.js was refused'));
            document.head.appendChild(s);
          })
      ),
      30000,
      'adding the module'
    );
    return await body({ S, C, seen, srv, policy: () => policy });
  } finally {
    await browser.close().catch(() => {});
    srv.close();
  }
}

/** In the framed page: start, read the drawn line as a line and as a block, read a blank strip, stop twice. */
const READS = async (line) => {
  const E = window.CVPortal.textengine;
  const said = (blocks) => {
    const out = [];
    (blocks || []).forEach((b) => (b.paragraphs || []).forEach((p) => (p.lines || []).forEach((l) => (l.words || []).forEach((w) => String(w.text || '').trim() && out.push(String(w.text).trim())))));
    return out;
  };
  const strip = (text) => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 900, 160);
    if (text) {
      x.fillStyle = '#000';
      x.font = '34px Arial, Helvetica, sans-serif';
      x.fillText(text, 20, 90);
    }
    return c;
  };
  const r = { origin: window.origin };
  const t0 = performance.now();
  try {
    await E.start();
    r.loaded = Math.round(performance.now() - t0);
    const t1 = performance.now();
    r.line = said(await E.read(strip(line), 'line')).join(' ');
    r.lineMs = Math.round(performance.now() - t1);
    r.block = said(await E.read(strip(line), 'block')).join(' ');
    r.blank = said(await E.read(strip(''), 'line'));
    r.blankBlock = said(await E.read(strip(''), 'block'));
  } catch (e) {
    r.error = { code: e && e.code, why: e && e.why, detail: e && e.detail, message: String((e && e.message) || e) };
  }
  r.ms = Math.round(performance.now() - t0);
  r.csp = (window.__csp || []).slice();
  return r;
};

/** In the framed page: start() n times, each timed; a refused start must end by itself. */
const STARTS = async (n) => {
  const E = window.CVPortal.textengine;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    try {
      await E.start();
      out.push({ started: true, ms: Math.round(performance.now() - t0) });
      E.stop();
    } catch (e) {
      out.push({ code: e && e.code, why: e && e.why, detail: e && e.detail, message: String((e && e.message) || e), ms: Math.round(performance.now() - t0) });
    }
  }
  let stops = 'nothing raised';
  try {
    E.stop();
  } catch (e) {
    stops = 'raised: ' + String((e && e.message) || e);
  }
  return { out, stops, origin: window.origin, csp: (window.__csp || []).slice() };
};

/** In the framed page: stop() with an engine, then stop() with none. */
const STOPS = () => {
  try {
    window.CVPortal.textengine.stop();
    window.CVPortal.textengine.stop();
    return 'nothing raised';
  } catch (e) {
    return 'raised: ' + String((e && e.message) || e);
  }
};

/** Waits (at most ms) until the page has n workers running; returns how many it has. */
async function workers(page, n, ms) {
  const until = Date.now() + ms;
  while (page.workers().length !== n && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  return page.workers().length;
}

/** One of the reader's own files answered 404: the start must end as code load, why file. */
async function missing(S, C, seen, name) {
  const pattern = '**/assets/vendor/textread/' + name;
  const gone = (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not served' });
  await C.context.route(pattern, gone);
  const from = seen.length;
  const o = (await within(S.P.evaluate(STARTS, 1), 60000, 'the framed page')).out[0];
  await C.context.unroute(pattern, gone);
  console.log(`  with ${name} answered 404: ${o.started ? 'started' : `start() rejected with code ${o.code}, why ${o.why}, after ${o.ms} ms`} (answered meanwhile: ${seen.slice(from).join(' | ')})`);
  if (!o.started) console.log(`    said (terminal only): ${o.detail}`);
  need(o.code === 'load' && o.why === 'file' && o.ms < LOAD_MS, `pass 1: with ${name} missing, start() gave code ${o.code}, why ${o.why}, after ${o.ms} ms (wanted load, file, under ${LOAD_MS} ms)`);
  need((await workers(S.page, 0, 5000)) === 0, `pass 1: with ${name} missing, a worker was left running`);
}

async function plain() {
  console.log('PASS 1: worker files served plainly (as the reproduced preview serves its files); .gz and .gz.txt answered 404');
  await frame({}, async ({ S, C, seen }) => {
    const r = await within(S.P.evaluate(READS, LINE), 90000, 'the framed page');
    if (r.error) {
      console.log(`  start or read failed: code ${r.error.code}, why ${r.error.why}, after ${r.ms} ms; the engine said: ${r.error.detail}`);
      need(false, `pass 1: the engine did not start and read (code ${r.error.code}, why ${r.error.why})`);
    } else {
      console.log(`  the start took ${r.loaded} ms`);
      console.log(`  drawn line:     "${LINE}"`);
      console.log(`  read as a line: "${r.line}" (${r.lineMs} ms)`);
      console.log(`  read as a block: "${r.block}"`);
      console.log(`  blank strip: ${r.blank.length} words as a line ${JSON.stringify(r.blank)}, ${r.blankBlock.length} as a block ${JSON.stringify(r.blankBlock)}`);
      need(one(r.line) === LINE, `pass 1: the line was read as "${one(r.line)}"`);
      need(one(r.block) === LINE, `pass 1: the block was read as "${one(r.block)}"`);
      need(r.blank.length === 0 && r.blankBlock.length === 0, `pass 1: a blank strip read as ${r.blank.length} words (line), ${r.blankBlock.length} (block)`);
      const running = await workers(S.page, 1, 3000);
      const stops = await S.P.evaluate(STOPS);
      const left = await workers(S.page, 0, 5000);
      console.log(`  workers running while the engine is started: ${running}; stop() then stop(): ${stops}; workers left: ${left}`);
      need(running === 1, `pass 1: ${running} workers running while the engine is started (wanted 1)`);
      need(stops === 'nothing raised', 'pass 1: stop() ' + stops);
      need(left === 0, `pass 1: ${left} workers left running after stop()`);
    }
    console.log('  files answered: ' + seen.join(' | '));
    await missing(S, C, seen, 'textread-boot.js');
    await missing(S, C, seen, 'language-data.js');
    console.log('  requests to other hosts aborted: ' + C.net.aborted.length + (C.net.aborted.length ? ' ' + JSON.stringify(C.net.aborted.slice(0, 4)) : ''));
    console.log('  policy refusals in the frame: ' + JSON.stringify(r.csp));
    console.log('  errors at the page: ' + JSON.stringify(S.errors.slice(0, 4)));
    need(!seen.some((s) => /\.gz(\.txt)?$/.test(s) && !/^404 /.test(s)), 'pass 1: a .gz file was answered');
    need(C.net.aborted.length === 0, `pass 1: ${C.net.aborted.length} requests to other hosts`);
    need(r.csp.length === 0, `pass 1: ${r.csp.length} policy refusals`);
    need(!S.errors.some((e) => /^pageerror/.test(e)), 'pass 1: an error was thrown at the page');
  });
}

async function strict() {
  console.log("PASS 2: worker files answered with the page's policy as their own header");
  await frame({ strict: true }, async ({ S, C, seen }) => {
    const r = await within(S.P.evaluate(STARTS, 2), 90000, 'the framed page');
    r.out.forEach((o, i) => {
      if (o.started) return console.log(`  start ${i + 1}: started in ${o.ms} ms`);
      console.log(`  start ${i + 1}: start() rejected with code ${o.code}, why ${o.why}, after ${o.ms} ms`);
      console.log(`    the engine said (terminal only): ${o.detail}`);
    });
    const boots = seen.filter((s) => / textread-boot\.js$/.test(s)).length;
    console.log(`  the worker's first file was answered ${boots} times (a failed start is forgotten; the next one tries afresh)`);
    console.log('  files answered: ' + seen.join(' | '));
    console.log('  requests to other hosts aborted: ' + C.net.aborted.length);
    const left = await workers(S.page, 0, 5000);
    console.log('  workers left running: ' + left);
    console.log('  errors at the page: ' + JSON.stringify(S.errors.slice(0, 4)).slice(0, 600));
    r.out.forEach((o, i) => need(o.code === 'load' && o.why === 'compile' && o.ms < LOAD_MS, `pass 2: start ${i + 1} gave code ${o.code}, why ${o.why}, after ${o.ms} ms (wanted load, compile, under ${LOAD_MS} ms)`));
    need(boots === 2, `pass 2: the second start did not try afresh (first file answered ${boots} times)`);
    need(r.stops === 'nothing raised', 'pass 2: stop() ' + r.stops);
    need(left === 0, `pass 2: ${left} workers left running after the failed starts`);
    need(C.net.aborted.length === 0, `pass 2: ${C.net.aborted.length} requests to other hosts`);
    need(!S.errors.some((e) => /^pageerror/.test(e)), 'pass 2: an error was thrown at the page');
  });
}

async function opaque() {
  console.log('PASS 3: the frame without allow-same-origin (the page may start no worker)');
  await frame({}, async ({ S, C, seen }) => {
    const before = S.errors.length;
    const r = await within(S.P.evaluate(STARTS, 1), 60000, 'the framed page');
    const o = r.out[0];
    console.log(`  the framed page's origin: ${r.origin}`);
    if (o.started) console.log(`  start() started in ${o.ms} ms`);
    else {
      console.log(`  start() rejected with code ${o.code}, why ${o.why}, after ${o.ms} ms`);
      console.log(`    the browser said (terminal only): ${o.detail}`);
    }
    const thrown = S.errors.slice(before).filter((e) => /^pageerror/.test(e));
    console.log('  files answered: ' + seen.join(' | '));
    console.log('  requests to other hosts aborted: ' + C.net.aborted.length);
    console.log('  thrown at the page during the start: ' + JSON.stringify(thrown));
    need(r.origin === 'null', `pass 3: the framed page has an origin of its own (${r.origin}); the frame is not the one meant`);
    need(o.code === 'load' && o.why === 'worker' && o.ms < LOAD_MS, `pass 3: start() gave code ${o.code}, why ${o.why}, after ${o.ms} ms (wanted load, worker, under ${LOAD_MS} ms)`);
    need(r.stops === 'nothing raised', 'pass 3: stop() ' + r.stops);
    need(thrown.length === 0, 'pass 3: an error was thrown at the page');
    need(C.net.aborted.length === 0, `pass 3: ${C.net.aborted.length} requests to other hosts`);
  });
}

/**
 * A server of this checkout's files for the probe page, on a port of its own: reader-probe.html carries the framed
 * portal page's policy as its header, every other file is served plainly (as the reproduced preview serves them).
 */
function probeServer(policy) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
  const handler = (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(ROOT, url);
    if (!p.startsWith(ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404), res.end();
    const head = { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (url === '/reader-probe.html') head['Content-Security-Policy'] = policy;
    res.writeHead(200, head);
    fs.createReadStream(p).pipe(res);
  };
  return new Promise((resolve, reject) => {
    let port = 8791;
    const next = () => {
      if (port > 8799) return reject(new Error('no free port in 8791-8799 for the probe page'));
      const s = http.createServer(handler);
      s.once('error', () => (port++, next()));
      s.listen(port, () => resolve(s));
    };
    next();
  });
}

/**
 * The probe page in one state: opened in the frame the portal was in, answered with the framed portal page's policy.
 * want.say: the sentence it must show; want.why: the fixed detail sentence it must show with it (or none).
 */
async function probe(state, head, opts, want) {
  console.log(head);
  await frame(Object.assign({ probe: true }, opts), async ({ S, C, seen, srv, policy }) => {
    const notes = [];
    S.page.on('console', (m) => /^Text reader check: /.test(m.text()) && notes.push(m.text()));
    const own = await probeServer(policy());
    const before = S.errors.length;
    const t0 = Date.now();
    let answered = false;
    try {
      await S.P.goto(`http://127.0.0.1:${own.address().port}/reader-probe.html`);
      answered = await S.P.waitForFunction(() => document.getElementById('say') && document.getElementById('say').textContent !== 'Checking the text reader…', null, { timeout: PROBE_MS }).then(
        () => true,
        () => false
      );
    } finally {
      own.close();
      own.closeAllConnections && own.closeAllConnections();
    }
    const ms = Date.now() - t0;
    const r = await S.P.evaluate(() => ({
      say: document.getElementById('say').textContent,
      role: document.getElementById('say').getAttribute('role'),
      title: document.title,
      origin: window.origin,
      lines: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean),
      csp: (window.__csp || []).slice()
    }));
    const fixed = [TITLE].concat(Object.values(SAYS), Object.values(WHY));
    const other = r.lines.filter((l) => !fixed.includes(l) && !SECONDS.test(l));
    // what the engine or the browser itself said: the last part of the page's console line
    const raw = notes.map((n) => n.split(' / ').slice(3).join(' / ')).filter(Boolean).join(' ');
    const vocabulary = new Set(fixed.join(' ').toLowerCase().match(/[a-z]{4,}/g));
    const leaked = Array.from(new Set(raw.toLowerCase().match(/[a-z]{4,}/g) || [])).filter((w) => !vocabulary.has(w) && r.lines.join(' ').toLowerCase().includes(w));
    const thrown = S.errors.slice(before).filter((e) => /^pageerror/.test(e));
    console.log(`  the framed page's origin: ${r.origin}; title "${r.title}"; the sentence came after ${ms} ms`);
    r.lines.forEach((l) => console.log('  shown: ' + l));
    console.log('  on the console only: ' + (notes.length ? notes.join(' | ').slice(0, 420) : '(nothing)'));
    console.log('  files answered: ' + seen.join(' | '));
    console.log('  requests to other hosts aborted: ' + C.net.aborted.length + (C.net.aborted.length ? ' ' + JSON.stringify(C.net.aborted.slice(0, 4)) : ''));
    console.log('  policy refusals at the page: ' + JSON.stringify(r.csp));
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await S.page.screenshot({ path: path.join(SHOTS, `probe-${state}.png`) });
      await S.page.emulateMedia({ colorScheme: 'dark' });
      await S.page.screenshot({ path: path.join(SHOTS, `probe-${state}-dark.png`) });
      console.log(`  pictures: ${path.join(SHOTS, `probe-${state}.png`)} and probe-${state}-dark.png`);
    }
    need(answered, `probe (${state}): no sentence within ${PROBE_MS / 1000} seconds`);
    need(r.say === want.say, `probe (${state}): the page said "${r.say}"`);
    need(r.role === 'status' && r.title === TITLE, `probe (${state}): the sentence's role is ${r.role}, the title "${r.title}"`);
    need(r.lines.filter((l) => Object.values(SAYS).includes(l)).length === 1, `probe (${state}): the page does not show exactly one of the three sentences`);
    need(want.why ? r.lines.includes(want.why) : !r.lines.some((l) => Object.values(WHY).includes(l)), `probe (${state}): the detail sentence is not the one for this state`);
    need(r.lines.filter((l) => Object.values(WHY).includes(l)).length <= 1, `probe (${state}): more than one detail sentence is shown`);
    need(r.lines.some((l) => SECONDS.test(l)), `probe (${state}): the seconds are not shown`);
    need(other.length === 0, `probe (${state}): the page shows text that is neither a fixed sentence nor the seconds: ${JSON.stringify(other).slice(0, 200)}`);
    if (want.why) {
      need(raw.length > 0, `probe (${state}): what the engine said was not written to the console`);
      need(leaked.length === 0, `probe (${state}): words of the engine's own message are on the page: ${leaked.join(', ')}`);
    } else need(r.csp.length === 0, `probe (${state}): ${r.csp.length} policy refusals at the page`);
    need(thrown.length === 0, `probe (${state}): an error was thrown at the page`);
    need(C.net.aborted.length === 0, `probe (${state}): ${C.net.aborted.length} requests to other hosts`);
  });
}

/** The scorer's own rules for kinds and owners, taken from its source (one set of rules, not a copy). */
function scorerRules() {
  const src = fs.readFileSync(SCORER, 'utf8');
  const parts = [/^const KIND_MAP = .*;$/m, /^const OWNER_RULES = \[[\s\S]*?^\];$/m, /^const ownerOf = .*;$/m, /^const OWNER_OK = .*;$/m].map((re) => (src.match(re) || [])[0]);
  if (parts.some((x) => !x)) return null;
  return new Function(parts.join('\n') + '\nreturn { KIND_MAP, OWNER_RULES, ownerOf, OWNER_OK };')();
}

/** Counts of a list by a key, compared and printed sorted. */
const tally = (list, key) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
const sameTally = (a, b) => Object.keys(Object.assign({}, a, b)).every((k) => (a[k] || 0) === (b[k] || 0));
const showTally = (t) =>
  Object.keys(t)
    .sort()
    .map((k) => `${k} ${t[k]}`)
    .join(', ');

/** The owner's form read inside the frame: the real upload dialog, the offer, the editor's fields against the sheet. */
async function form() {
  console.log("FORM: the owner's form inside the frame, through the upload dialog and the offer; worker files served plainly; .gz and .gz.txt answered 404");
  const R = scorerRules();
  if (!R) notRun(`the scorer's rules for kinds and owners (KIND_MAP, OWNER_RULES, ownerOf, OWNER_OK) were not found in ${SCORER}`);
  const sheet = JSON.parse(fs.readFileSync(SHEET, 'utf8'));
  const places = sheet.fields || [];
  if (!places.length) notRun(`the answer sheet holds no places (${SHEET})`);
  const sizes = P.pageSizes(FORM_PDF);
  const kindOf = (k) => (R.KIND_MAP[k] ? `${k} (${R.KIND_MAP[k].join(' or ')})` : `${k} (not a kind of the sheet)`);
  const ownerName = (w) => (R.OWNER_OK[w] ? `${w} (${R.OWNER_OK[w].join(' or ')})` : `${w} (not an owner of the sheet)`);
  const fieldKind = (f) => kindOf(Object.keys(R.KIND_MAP).find((k) => R.KIND_MAP[k].includes(f.kind)) || 'portal ' + (f.kind || 'none'));
  const fieldOwner = (f) => ownerName(Object.keys(R.OWNER_OK).find((w) => R.OWNER_OK[w].includes(f.owner)) || 'portal ' + f.owner);
  const want = { kind: tally(places, (p) => kindOf(p.kind)), owner: tally(places, (p) => ownerName(p.whose)) };
  want.both = tally(places, (p) => kindOf(p.kind) + ' / ' + ownerName(p.whose));
  await frame({ form: true }, async ({ S, C, answered }) => {
    const origin = await S.P.evaluate(() => window.origin);
    const off = await P.prepare(S);
    let up = null;
    const upload = P.uploadDialog(S, off, FORM_PDF, FORM_MS).then(
      (r) => (up = r),
      (e) => (up = { opened: false, error: String((e && e.message) || e) })
    );
    // the offer: in the dialog or in the editor, once it can be pressed
    const t0 = Date.now();
    let btn = null;
    while (Date.now() - t0 < FORM_MS) {
      const b = S.P.locator('button:visible, a:visible, [role=button]:visible').filter({ hasText: OFFER_RE }).first();
      if ((await b.count().catch(() => 0)) && !(await b.isDisabled().catch(() => true))) {
        btn = b;
        break;
      }
      if (up && !up.opened) break;
      await S.P.waitForTimeout(200);
    }
    const before = await S.P.evaluate(() => document.querySelectorAll('.fe-doc .es-page [data-fid]').length).catch(() => -1);
    if (!btn) {
      need(false, `form: the offer "Read these pages from their picture" did not appear (${up ? (up.error || 'the dialog said: ' + (up.said || []).join(' | ')).slice(0, 300) : 'still uploading after ' + FORM_MS / 1000 + ' s'})`);
      return;
    }
    const where = await btn.evaluate((e) => (e.closest('#dlg') ? 'the upload dialog' : 'the editor')).catch(() => '?');
    console.log(`  upload: the offer appeared in ${where} after ${((Date.now() - t0) / 1000).toFixed(1)} s, with ${Math.max(0, before)} fields on the pages before it was pressed`);
    need(before <= 0, `form: ${before} fields were on the pages before the offer was pressed`);
    const snap = () =>
      S.P.evaluate(
        (busy) => {
          const m = document.body.innerText.match(new RegExp(busy));
          return {
            progress: m ? m[0] : '',
            busy: !!m || !!document.querySelector('[aria-busy=true], #dlg[open] button[type=submit][disabled]'),
            editor: /^#console-envelope-/.test(location.hash) && !!document.querySelector('.fe-doc .es-page'),
            fields: document.querySelectorAll('.fe-doc .es-page [data-fid]').length
          };
        },
        BUSY_RE.source
      ).catch(() => null);
    const t1 = Date.now();
    await btn.click();
    let quiet = 0;
    let progress = 0;
    let finished = false;
    while (Date.now() - t1 < FORM_MS) {
      await S.P.waitForTimeout(150);
      const st = await snap();
      if (!st) continue;
      if (st.progress || st.busy) progress++;
      if (!st.busy && st.editor && st.fields > 0) {
        quiet = quiet || Date.now();
        if (Date.now() - quiet >= 1500) {
          finished = true;
          break;
        }
      } else quiet = 0;
    }
    const ms = Date.now() - t1 - (finished ? 1500 : 0);
    await Promise.race([upload, new Promise((r) => setTimeout(r, 5000))]);
    console.log(`  the reading from pictures took ${(ms / 1000).toFixed(1)} s${finished ? '' : ' and had NOT finished'}; progress was ${progress ? '' : 'NOT '}seen while it ran`);
    need(finished, `form: the reading had not finished after ${FORM_MS / 1000} s`);
    const ed = await P.readEditor(S, sizes);
    ed.fields.forEach((f) => (f.owner = /\bis-else\b/.test(f.cls || '') || /someone else/i.test(f.aria || '') ? 'third party' : R.ownerOf(f.signerName)));
    const got = { kind: tally(ed.fields, fieldKind), owner: tally(ed.fields, fieldOwner) };
    got.both = tally(ed.fields, (f) => fieldKind(f) + ' / ' + fieldOwner(f));
    const marked = ed.fields.filter((f) => f.review).length;
    console.log(`  fields: ${ed.fields.length} on ${ed.pages} pages (the answer sheet: ${places.length} places); marked for review: ${marked}`);
    console.log(`  by kind, the portal:  ${showTally(got.kind)}`);
    console.log(`  by kind, the sheet:   ${showTally(want.kind)}`);
    console.log(`  by owner, the portal: ${showTally(got.owner)}`);
    console.log(`  by owner, the sheet:  ${showTally(want.owner)}`);
    console.log(`  by kind and owner, the portal: ${showTally(got.both)}`);
    console.log(`  by kind and owner, the sheet:  ${showTally(want.both)}`);
    need(ed.fields.length === places.length, `form: ${ed.fields.length} fields, the sheet has ${places.length} places`);
    need(sameTally(got.kind, want.kind), 'form: the count of fields by kind differs from the sheet');
    need(sameTally(got.owner, want.owner), 'form: the count of fields by owner differs from the sheet');
    need(sameTally(got.both, want.both), 'form: the count of fields by kind and owner together differs from the sheet');
    need(ed.fields.length > 0 && marked === ed.fields.length, `form: ${ed.fields.length - marked} fields are not marked for review`);
    const csp = await S.P.evaluate(() => (window.__csp || []).slice()).catch(() => ['(could not be read)']);
    const own = (u) => {
      try {
        const x = new URL(u);
        return x.origin === origin && x.pathname.startsWith('/assets/');
      } catch (e) {
        return false;
      }
    };
    const files = answered.filter((a) => READER_FILE.test(a.url));
    const foreign = files.filter((a) => !own(a.url) || !(a.status === 200 || a.status === 304));
    const gz = answered.filter((a) => /\.gz(\.txt)?$/.test(a.url) && a.status !== 404);
    const names = Array.from(new Set(files.map((a) => `${a.status} ${a.url.replace(/^.*\/assets\//, 'assets/')}`)));
    const thrown = S.errors.filter((e) => /^pageerror/.test(e));
    console.log(`  the framed portal's origin: ${origin}`);
    console.log(`  reader files answered: ${names.join(' | ')}`);
    console.log(`  reader files not from the portal's own folder, or not answered: ${foreign.length}${foreign.length ? ' ' + JSON.stringify(foreign.slice(0, 4)) : ''}`);
    console.log(`  .gz files answered other than 404: ${gz.length}`);
    console.log('  requests to other hosts aborted: ' + C.net.aborted.length + (C.net.aborted.length ? ' ' + JSON.stringify(C.net.aborted.slice(0, 4)) : ''));
    console.log('  policy refusals in the frame: ' + JSON.stringify(csp));
    console.log('  errors at the page: ' + JSON.stringify(thrown.slice(0, 4)).slice(0, 600));
    need(origin !== 'null' && /^http:\/\/127\.0\.0\.1:/.test(origin), `form: the framed portal's origin is ${origin}; the frame is not the one meant`);
    need(files.some((a) => /\/assets\/js\/textengine\.js$/.test(a.url) && a.status === 200), "form: the reader's module (assets/js/textengine.js) was not loaded by the portal");
    need(foreign.length === 0, `form: ${foreign.length} reader files did not come from the portal's own folder`);
    need(gz.length === 0, 'form: a .gz file was answered');
    need(C.net.aborted.length === 0, `form: ${C.net.aborted.length} requests to other hosts were aborted`);
    need(csp.length === 0, `form: ${csp.length} policy refusals in the frame`);
    need(thrown.length === 0, 'form: an error was thrown at the page');
    const dir = path.join(SCRATCH, 'exec-012', `frame-form-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '')}-${process.pid}`);
    fs.mkdirSync(dir, { recursive: true });
    await S.page.screenshot({ path: path.join(dir, 'editor-window.png') }).catch(() => {});
    console.log(`  picture of the framed editor (outside the repository): ${path.join(dir, 'editor-window.png')}`);
  });
}

/** Pass 3 as a child process of this file: the runner fixes the frame's sandbox when it is loaded. */
function opaqueChild() {
  const r = spawnSync(process.execPath, [__filename, '--opaque'].concat(PROBE ? ['--probe'] : [], SHOTS ? ['--shots', SHOTS] : []), { encoding: 'utf8', env: process.env, maxBuffer: 1 << 24 });
  const lines = String(r.stdout || '').split('\n').filter(Boolean);
  lines.filter((l) => !/^READER FRAME: /.test(l)).forEach((l) => console.log(l));
  if (r.stderr && r.stderr.trim()) console.log(r.stderr.trim().split('\n').map((l) => '  ' + l).join('\n'));
  const last = lines[lines.length - 1] || '';
  if (r.status !== 0 || last !== 'READER FRAME: PASS') fails.push(/^READER FRAME: FAIL - /.test(last) ? last.replace('READER FRAME: FAIL - ', '') : `pass 3 ended with status ${r.status}`);
}

const probePlain = () => probe('plain', 'PROBE 1: reader-probe.html in the frame, worker files served plainly', {}, { say: SAYS.works });
const probeStrict = () => probe('strict', "PROBE 2: reader-probe.html in the frame, worker files answered with the page's policy as their own header", { strict: true }, { say: SAYS.cannot, why: WHY.compile });
const probeOpaque = () => probe('opaque', 'PROBE 3: reader-probe.html in the frame without allow-same-origin', {}, { say: SAYS.cannot, why: WHY.worker });

(async () => {
  if (FORM) await form();
  else if (OPAQUE) await (PROBE ? probeOpaque() : opaque());
  else if (STRICT_ONLY) await (PROBE ? probeStrict() : strict());
  else {
    await (PROBE ? probePlain() : plain());
    await (PROBE ? probeStrict() : strict());
    opaqueChild();
  }
  console.log(fails.length ? 'READER FRAME: FAIL - ' + fails.join('; ') : 'READER FRAME: PASS');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.log('READER FRAME: FAIL - ' + String((e && e.message) || e));
  process.exit(1);
});
