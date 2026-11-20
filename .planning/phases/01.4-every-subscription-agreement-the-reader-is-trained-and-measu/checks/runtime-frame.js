#!/usr/bin/env node
/*
 * The place reader's runtime inside the reproduced preview frame.
 *
 *   node runtime-frame.js
 *
 * The frame is the proof runner's: a host page on one origin, the portal in a sandboxed frame on another, the framed
 * page served with the preview's content policy, every request to another host aborted and listed. The probe network
 * (the same small fully-convolutional shape as the research timing probe, made-up weights from a fixed seed, input
 * 1 x 1 x 1056 x 816, six output maps at a quarter of the size) is written here as a model file, gzip then base64, into
 * a script outside the repository, and the same real local server that serves the checkout answers it under
 * /__probe__/. The framed page starts assets/vendor/formread/places-worker.js as a module worker with that script and
 * runs one made-up page picture six times, then stops, starts afresh and runs it once more.
 *
 * One line each, PASS or FAIL:
 *   started      the worker answered ready within 20 s
 *   requests     from the start on, nothing was asked of any address but the portal's own runtime files and the probe
 *                script (the server's own log and the browser's request log), and nothing to another host all run
 *   one thread   the runtime reports one thread, the page is not cross-origin isolated, one worker runs
 *   time         median of runs 2 to 6 at most 0.3 s
 *   determinism  all six outputs and the output of a fresh start are identical bit for bit (and finite, not all zero)
 *   console      no console message (page, frame or worker) and no error names a vendor or library
 * Then the state upload (01.4-08, see upload() below): a train document of picture pages uploaded through the real
 * dialog in a fresh frame, the place model started by the reading itself: upload model, upload requests, upload
 * console, upload time (the model's seconds per picture page at most 0.3 s at the median).
 * Last line: "RUNTIME FRAME: PASS" or "RUNTIME FRAME: FAIL - ..."; exit 0 only on PASS.
 * When the proof runner, its wrapper page or the browser driver is missing: "NOT RUN: ..." and exit 2.
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PROOF = path.join(process.env.PROOF_DIR || path.join(SCRATCH, 'build/proof'), 'proof.js');
const PROBE_DIR = path.join(SCRATCH, 'exec-0145');
const PROBE_FILE = path.join(PROBE_DIR, 'probe-model.js');
const PROBE_URL = '/__probe__/probe-model.js';
const H = 1056;
const W = 816;
const START_MS = 20000;
const TIME_MS = 300;
const NAMES = /onnx|microsoft|pytorch|torch|scikit|sklearn|ort-wasm|ort\.wasm/i;
const OWN = /^\/assets\/vendor\/formread\/(runtime\.min\.js|runtime-wasm\.js|places-worker\.js)$/;

const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
if (!fs.existsSync(PROOF)) notRun(`the proof runner is missing (${PROOF}); set PROOF_DIR or PICTURE_SCRATCH`);
for (const f of ['runtime.min.js', 'runtime-wasm.js', 'places-worker.js']) if (!fs.existsSync(path.join(ROOT, 'assets/vendor/formread', f))) notRun(`assets/vendor/formread/${f} is missing in ${ROOT}`);
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

/* ---------- the probe network, written as a model file without any library ---------- */
const varint = (n) => {
  const out = [];
  n = BigInt(n);
  do {
    let b = Number(n & 0x7fn);
    n >>= 7n;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
};
const key = (field, wire) => varint((field << 3) | wire);
const num = (field, n) => Buffer.concat([key(field, 0), varint(n)]);
const bytes = (field, b) => Buffer.concat([key(field, 2), varint(b.length), b]);
const str = (field, s) => bytes(field, Buffer.from(s, 'utf8'));
const msg = (field, parts) => bytes(field, Buffer.concat(parts));
const FLOAT = 1;
const tensor = (field, name, dims, f32) => msg(field, [...dims.map((d) => num(1, d)), num(2, FLOAT), str(8, name), bytes(9, Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength))]);
const attrInts = (name, ints) => msg(5, [str(1, name), ...ints.map((i) => num(8, i)), num(20, 7)]);
const attrStr = (name, s) => msg(5, [str(1, name), str(4, s), num(20, 3)]);
const valueInfo = (field, name, dims) => msg(field, [str(1, name), msg(2, [msg(1, [num(1, FLOAT), msg(2, dims.map((d) => msg(1, [num(1, d)])))])])]);

function probeModel() {
  let seed = 12345;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const inits = [];
  const nodes = [];
  const conv = (x, cin, cout, k, s, name, relu = true) => {
    const w = new Float32Array(cout * cin * k * k).map(() => normal() * 0.05);
    inits.push(tensor(5, name + '_w', [cout, cin, k, k], w), tensor(5, name + '_b', [cout], new Float32Array(cout)));
    const p = Math.floor(k / 2);
    nodes.push(msg(1, [str(1, x), str(1, name + '_w'), str(1, name + '_b'), str(2, name), str(3, name), str(4, 'Conv'), attrInts('kernel_shape', [k, k]), attrInts('strides', [s, s]), attrInts('pads', [p, p, p, p])]));
    if (!relu) return name;
    nodes.push(msg(1, [str(1, name), str(2, name + '_r'), str(3, name + '_relu'), str(4, 'Relu')]));
    return name + '_r';
  };
  const a = conv('page', 1, 16, 3, 2, 'e1');
  const b = conv(a, 16, 32, 3, 2, 'e2');
  const c = conv(b, 32, 64, 3, 2, 'e3');
  let d = conv(c, 64, 96, 3, 2, 'e4');
  d = conv(d, 96, 96, 3, 1, 'm1');
  d = conv(d, 96, 96, 3, 1, 'm2');
  inits.push(tensor(5, 'scales', [4], new Float32Array([1, 1, 4, 4])));
  nodes.push(msg(1, [str(1, d), str(1, ''), str(1, 'scales'), str(2, 'up'), str(3, 'up'), str(4, 'Resize'), attrStr('mode', 'nearest')]));
  const u = conv('up', 96, 32, 1, 1, 'u1');
  nodes.push(msg(1, [str(1, u), str(1, b), str(2, 'sk'), str(3, 'sk'), str(4, 'Add')]));
  const s = conv('sk', 32, 32, 3, 1, 'd1');
  const h = conv(s, 32, 6, 1, 1, 'head', false);
  const graph = msg(7, [...nodes, str(2, 'places'), ...inits, valueInfo(11, 'page', [1, 1, H, W]), valueInfo(12, h, [1, 6, H / 4, W / 4])]);
  return Buffer.concat([num(1, 8), graph, msg(8, [str(1, ''), num(2, 17)])]);
}

const model = probeModel();
fs.mkdirSync(PROBE_DIR, { recursive: true });
fs.writeFileSync(PROBE_FILE, 'self.FORMREAD_MODEL_GZ64 = "' + zlib.gzipSync(model, { level: 9 }).toString('base64') + '";\n');

/* ---------- the real local server answers the probe script beside the checkout, and keeps its own log ---------- */
const served = [];
const createServer = http.createServer;
http.createServer = (handler) =>
  createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    served.push({ port: req.socket.localPort, url, at: Date.now() });
    if (url === PROBE_URL) {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(PROBE_FILE));
    }
    return handler(req, res);
  });
process.argv = process.argv.slice(0, 2).concat(['--root', ROOT]);
const P = require(PROOF);
if (path.resolve(P.ROOT) !== ROOT) notRun(`the proof runner serves ${P.ROOT}, not this checkout (${ROOT})`);
const WRAPPER = process.env.WRAPPER || path.join(P.SCRATCH, 'artifact/diy-portal.html');
if (!fs.existsSync(WRAPPER)) notRun(`the preview's wrapper page is missing (${WRAPPER})`);
P.PORTS.from = 8791;
P.PORTS.to = 8799;

const fails = [];
const result = (ok, name, info) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${info}`);
  if (!ok) fails.push(name);
};
const within = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(what + ' did not answer in ' + ms / 1000 + ' s')), ms))]);

/** In the framed page: start the worker, run the picture n times, stop, start afresh, run once. */
const PAGE = async ({ H, W, n, probe, startMs }) => {
  const r = { origin: window.origin, isolated: !!window.crossOriginIsolated, times: [] };
  const url = new URL('assets/vendor/formread/places-worker.js', document.baseURI).href;
  // a made-up page: white, ruled lines, a few boxes and a block of grey "text"
  const px = new Float32Array(H * W).fill(1);
  for (let y = 120; y < H - 80; y += 36) for (let x = 60; x < W - 60; x++) px[y * W + x] = 0;
  for (let k = 0; k < 6; k++) for (let i = 0; i < 18; i++) {
    const x0 = 80 + k * 110, y0 = 60;
    px[(y0 + i) * W + x0] = px[(y0 + i) * W + x0 + 17] = px[y0 * W + x0 + i] = px[(y0 + 17) * W + x0 + i] = 0;
  }
  for (let y = 200; y < 400; y++) for (let x = 100; x < 700; x++) if ((x * 7 + y * 13) % 11 < 4) px[y * W + x] = 0.3;
  const session = () => {
    const w = new Worker(url, { type: 'module' });
    let wait = null;
    w.onmessage = (e) => wait && wait(e.data);
    w.onerror = (e) => wait && wait({ type: 'error', code: 'worker', detail: String(e.message || 'worker error') });
    const ask = (m, ms) => new Promise((ok) => {
      const t = setTimeout(() => ok({ type: 'error', code: 'time', detail: 'no answer in ' + ms + ' ms' }), ms);
      wait = (d) => (clearTimeout(t), ok(d));
      w.postMessage(m);
    });
    return { w, ask };
  };
  const same = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    const x = new Uint32Array(a.buffer), y = new Uint32Array(b.buffer);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  };
  try {
    const t0 = performance.now();
    let s = session();
    const ready = await s.ask({ type: 'start', modelScript: probe }, startMs);
    r.startMs = Math.round(performance.now() - t0);
    r.ready = ready;
    if (ready.type !== 'ready') return r;
    const outs = [];
    for (let i = 0; i < n; i++) {
      const a = performance.now();
      const m = await s.ask({ type: 'run', pixels: px, w: W, h: H, id: i }, 30000);
      r.times.push(performance.now() - a);
      if (m.type !== 'maps') return ((r.runError = m), r);
      outs.push(m.data);
      if (!i) r.dims = [m.classes, m.h, m.w];
    }
    r.allSame = outs.every((o) => same(o, outs[0]));
    r.finite = outs[0].every(Number.isFinite);
    r.nonzero = outs[0].reduce((c, v) => c + (v !== 0), 0);
    r.values = outs[0].length;
    window.__rtStage = 'started';
    await new Promise((ok) => {
      window.__rtGo = ok;
    });
    s.w.postMessage({ type: 'stop' });
    await new Promise((ok) => setTimeout(ok, 500));
    s = session();
    const again = await s.ask({ type: 'start', modelScript: probe }, startMs);
    if (again.type !== 'ready') return ((r.againError = again), r);
    const m = await s.ask({ type: 'run', pixels: px, w: W, h: H, id: 99 }, 30000);
    r.freshSame = m.type === 'maps' && same(m.data, outs[0]);
    s.w.postMessage({ type: 'stop' });
  } catch (e) {
    r.thrown = String((e && e.message) || e);
  }
  return r;
};

/**
 * State upload (01.4-08): a train document whose every page is a picture (a006) uploaded through the real dialog in a
 * fresh frame; the reading runs by itself (D-13). NS.textread.page is watched (its own trace of each page's seconds,
 * nothing else changed) so the place model's seconds per picture page are read from the page results.
 *   upload model     the reading recorded read.modelPlaces above 0, and the model's worker and script were loaded
 *   upload requests  from the upload on, nothing was asked of any address but the portal's own files, the script hosts
 *                    the portal had already used, and the PDF reader the portal loads on its first PDF (its two
 *                    script files, answered from local copies in the frame); nothing aborted
 *   upload console   no console error and no error thrown at the page during the upload
 *   upload time      the place model's seconds per picture page (the page result's model time: reading with the model
 *                    minus without it) at most 0.3 s at the median
 */
async function upload(browser, srv) {
  const DOC = path.join(SCRATCH, 'edgar/set-a/a006/doc.pdf');
  if (!fs.existsSync(DOC)) return result(false, 'upload', `NOT RUN: the train document a006 is missing (${DOC})`);
  const C = await P.newContext(browser, srv);
  try {
    const S = await P.openPortal(C, srv, true, '');
    await S.P.waitForFunction(() => window.CVPortal && window.CVPortal.textread && document.readyState === 'complete', null, { timeout: 30000 });
    const before = new Set();
    const asked = [];
    let watching = false;
    C.context.on('request', (q) => (watching ? asked.push(q.url()) : before.add(new URL(q.url()).origin)));
    const off = await P.prepare(S);
    await S.P.evaluate(() => {
      const NS = window.CVPortal;
      const real = NS.textread.page;
      window.__pages = [];
      NS.textread.page = (pg, raw, o) =>
        real(pg, raw, Object.assign({}, o || {}, { trace: true })).then((r) => {
          window.__pages.push({ ms: r.trace && r.trace.ms, model: r.modelPlaces, added: r.modelAdded, picture: r.pictured === 'picture' });
          return r;
        });
    });
    const errorsFrom = S.errors.length;
    watching = true;
    const t0 = Date.now();
    const up = await P.uploadDialog(S, off, DOC, 240000).catch((e) => ({ opened: false, error: String((e && e.message) || e) }));
    // the reading has finished when the editor shows fields and nothing is busy for a second and a half
    let quiet = 0;
    let finished = false;
    while (up.opened && Date.now() - t0 < 240000) {
      await S.P.waitForTimeout(150);
      const st = await S.P.evaluate(() => ({ busy: !!document.querySelector('[aria-busy=true], #dlg[open] button[type=submit][disabled]') || /Reading page \d+ of \d+|Finding the boxes on page \d+ of \d+|Reading [^.]{0,60}(…|\.\.\.)/.test(document.body.innerText), fields: document.querySelectorAll('.fe-doc .es-page [data-fid]').length })).catch(() => null);
      if (st && !st.busy && st.fields > 0) {
        quiet = quiet || Date.now();
        if (Date.now() - quiet >= 1500) {
          finished = true;
          break;
        }
      } else quiet = 0;
    }
    watching = false;
    const got = await S.P.evaluate(() => {
      const NS = window.CVPortal;
      const id = location.hash.replace(/^#console-envelope-/, '');
      const env = [].concat(NS.state.ws.envelopes || [], NS.state.ws.esignTemplates || []).find((e) => e && e.id === id);
      return { read: env && env.read ? JSON.parse(JSON.stringify(env.read)) : null, fields: env ? (env.fields || []).length : 0, pages: window.__pages || [] };
    });
    const read = got.read || {};
    const pics = got.pages.filter((p) => p.picture && p.ms);
    const own = `http://127.0.0.1:${srv.appPort}`;
    const paths = asked.filter((u) => u.startsWith(own + '/')).map((u) => u.slice(own.length).split('?')[0]);
    // the PDF reader the portal itself loads on its first PDF (pdf.js 3.11.174 from its script host, answered from the
    // proof runner's local copies in the frame) is the portal's, not the model's; every other address counts
    const READER_LIB = /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/pdf(\.worker)?\.min\.js$/;
    const outside = asked.filter((u) => !u.startsWith(own + '/') && !/^(blob|data|about):/.test(u) && !before.has(new URL(u).origin) && !READER_LIB.test(u));
    const readerLib = asked.filter((u) => READER_LIB.test(u)).length;
    const loaded = ['/assets/js/placemodel.js', '/assets/vendor/formread/places-worker.js', '/assets/vendor/formread/places-model.js'].filter((f) => paths.includes(f));
    console.log(`upload: a006 (train, 14 picture pages) through the real dialog; editor ${up.opened ? 'opened' : 'NOT opened'}; reading ${finished ? 'finished' : 'NOT finished'} in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${got.fields} fields`);
    result(up.opened && finished && read.modelPlaces > 0 && loaded.length === 3, 'upload model', `read.modelPlaces ${read.modelPlaces}; places that joined what the rules found ${pics.reduce((a, p) => a + (p.added || 0), 0)}; picture pages read ${pics.length}; the model's files loaded: ${loaded.join(', ') || 'none'}${up.error ? '; upload: ' + up.error : ''}`);
    result(outside.length === 0 && C.net.aborted.length === 0, 'upload requests', `${asked.length} requests from the upload on, ${paths.length} of them to the portal's own server (the model's: ${Array.from(new Set(paths.filter((p) => /formread|placemodel/.test(p)))).join(', ')}); ${readerLib} the portal's own PDF reader files; to other addresses: ${outside.length ? JSON.stringify(outside.slice(0, 4)) : 'none'}; aborted: ${C.net.aborted.length}`);
    const errs = S.errors.slice(errorsFrom);
    result(errs.length === 0, 'upload console', `${errs.length} console errors or errors thrown at the page${errs.length ? ': ' + JSON.stringify(errs.slice(0, 3)).slice(0, 400) : ''}`);
    const ms = pics.map((p) => p.ms.model).sort((a, b) => a - b);
    const median = ms.length ? (ms.length % 2 ? ms[(ms.length - 1) / 2] : (ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2) : NaN;
    const rest = pics.map((p) => p.ms.draw + p.ms.find + p.ms.read).sort((a, b) => a - b);
    result(ms.length > 0 && median <= TIME_MS, 'upload time', `the place model's seconds per picture page (ms): ${pics.map((p) => p.ms.model).join(' ')}; median ${(median / 1000).toFixed(3)} s (at most ${(TIME_MS / 1000).toFixed(1)} s; the first page includes the model's start); the rest of each page's reading, median ${(rest[Math.floor(rest.length / 2)] / 1000).toFixed(3)} s`);
  } catch (e) {
    result(false, 'upload', String((e && e.message) || e).slice(0, 300));
  } finally {
    await C.context.close().catch(() => {});
  }
}

(async () => {
  const srv = await P.startServers();
  const browser = await chromium.launch();
  const consoleLines = [];
  try {
    const C = await P.newContext(browser, srv);
    const requests = [];
    C.context.on('request', (q) => requests.push({ url: q.url(), at: Date.now() }));
    const S = await P.openPortal(C, srv, true, '');
    const listen = (where, m) => consoleLines.push(`${where} ${m.type()}: ${m.text()}`);
    S.page.on('console', (m) => listen('page', m));
    S.page.on('worker', (w) => {
      try {
        w.on('console', (m) => listen('worker', m));
      } catch (e) {}
    });
    await S.P.waitForFunction(() => window.CVPortal && document.readyState === 'complete', null, { timeout: 30000 });
    const servedFrom = served.length;
    const requestsFrom = requests.length;
    const pending = S.P.evaluate(PAGE, { H, W, n: 6, probe: PROBE_URL, startMs: START_MS });
    let r = null;
    let running = -1;
    const stage = (async () => {
      const until = Date.now() + 120000;
      while (Date.now() < until) {
        const st = await S.P.evaluate(() => window.__rtStage || '').catch(() => '');
        if (st === 'started') return true;
        await new Promise((ok) => setTimeout(ok, 100));
      }
      return false;
    })();
    const which = await Promise.race([stage.then((v) => (v ? 'stage' : 'timeout')), pending.then(() => 'done')]);
    if (which === 'stage') {
      running = S.page.workers().length;
      await S.P.evaluate(() => window.__rtGo && window.__rtGo());
    }
    r = await within(pending, 120000, 'the framed page');
    const left = await (async () => {
      const until = Date.now() + 5000;
      while (S.page.workers().length && Date.now() < until) await new Promise((ok) => setTimeout(ok, 100));
      return S.page.workers().length;
    })();
    const own = served.slice(servedFrom).filter((s) => s.port === srv.appPort).map((s) => s.url);
    const other = served.slice(servedFrom).filter((s) => s.port !== srv.appPort).map((s) => s.url);
    const seen = requests.slice(requestsFrom).map((q) => q.url);
    const appOrigin = `http://127.0.0.1:${srv.appPort}`;
    const strange = own.filter((u) => !OWN.test(u) && u !== PROBE_URL).concat(other.map((u) => 'host server: ' + u), seen.filter((u) => {
      if (!u.startsWith(appOrigin + '/')) return true;
      const p = u.slice(appOrigin.length).split('?')[0];
      return !OWN.test(p) && p !== PROBE_URL;
    }).map((u) => 'browser: ' + u));

    console.log(`probe network: ${model.length} bytes as a model file, ${fs.statSync(PROBE_FILE).size} bytes as its script (outside the repository)`);
    console.log(`framed page origin ${r.origin}; cross-origin isolated: ${r.isolated}`);
    result(r.ready && r.ready.type === 'ready' && r.startMs <= START_MS, 'started', r.ready && r.ready.type === 'ready' ? `ready in ${r.startMs} ms` : `answer ${JSON.stringify(r.ready || r.thrown)} after ${r.startMs} ms`);
    result(strange.length === 0 && C.net.aborted.length === 0 && own.length > 0, 'requests', `asked of the portal's server from the start on: ${own.join(', ') || 'nothing'}; browser saw ${seen.length}; other addresses: ${strange.length ? JSON.stringify(strange.slice(0, 6)) : 'none'}; requests to other hosts aborted all run: ${C.net.aborted.length}`);
    const threads = r.ready && r.ready.threads;
    result(!r.isolated && running === 1 && (threads === undefined || threads === 1), 'one thread', `workers running while started: ${running}; runtime threads: ${threads === undefined ? 'not reported' : threads}; workers left after stop: ${left}`);
    const warm = r.times.slice(1).sort((a, b) => a - b);
    const median = warm.length === 5 ? warm[2] : NaN;
    result(r.times.length === 6 && median <= TIME_MS, 'time', `runs (ms): ${r.times.map((t) => t.toFixed(0)).join(' ')}; median of runs 2 to 6 ${(median / 1000).toFixed(3)} s (at most ${(TIME_MS / 1000).toFixed(1)} s); output ${r.dims ? r.dims.join(' x ') : 'none'}${r.runError ? '; run answered ' + JSON.stringify(r.runError) : ''}`);
    result(r.allSame === true && r.freshSame === true && r.finite === true && r.nonzero > 0, 'determinism', `six runs identical: ${r.allSame}; a fresh start identical: ${r.freshSame}${r.againError ? ' (' + JSON.stringify(r.againError) + ')' : ''}; finite: ${r.finite}; non-zero values ${r.nonzero} of ${r.values}`);
    const named = consoleLines.concat(S.errors).filter((l) => NAMES.test(l));
    result(named.length === 0, 'console', `${consoleLines.length} console messages, ${S.errors.length} errors; naming a vendor or library: ${named.length ? JSON.stringify(named.slice(0, 3)) : 'none'}`);
    if (consoleLines.length) console.log('  console (first 5): ' + JSON.stringify(consoleLines.slice(0, 5)).slice(0, 800));
    if (r.thrown) console.log('  thrown in the page: ' + r.thrown);
    await upload(browser, srv);
  } catch (e) {
    fails.push('the run: ' + String((e && e.message) || e).slice(0, 300));
    console.log('FAIL run: ' + String((e && e.message) || e).slice(0, 300));
  } finally {
    await browser.close().catch(() => {});
    srv.close();
  }
  console.log(fails.length ? 'RUNTIME FRAME: FAIL - ' + fails.join(', ') : 'RUNTIME FRAME: PASS');
  process.exit(fails.length ? 1 : 0);
})();
