#!/usr/bin/env node
/*
 * The offering intake read through the portal's reading server (D-36), on the real intake screen.
 *
 *   node intake-server.js [--only unchanged,api,fallback,failures | measure | all]
 *   node intake-server.js --only measure --doc <pdf> --out <dir> [--cap 1.00] [--max-tokens 24000] [--fake]
 *
 *   unchanged  every protected slice of intake.js and console.js hashes to the value recorded at planning (D-36: only the
 *              two reading functions and the comments that described the old path change)
 *   api        a sample added and Read documents pressed with a reading server set: the server receives the page's own
 *              prompt (instructions, a blank line, DOCUMENTS:, the corpus as computed in the page), the progress line
 *              counts characters, the fictional fund reaches the review screen, method is automatic reading
 *   fallback   the same with no reading server and a stub of the host runtime's property on the window: the profile is
 *              exactly the built-in reader's, method rules, no note added, the stub never touched
 *   failures   the reading server answering 503, 401, 402, 413, 429, a failed last line, no last line, a refused
 *              connection, a reply past the browser's limit, and Stop pressed: each leaves the built-in result with
 *              today's note and method rules
 *   measure    one PDF once through the intake screen against a reading server (D-34 tooling, plan 67 runs it). Real mode
 *              needs CARROWVALE_API_KEY and spawns server/index.mjs on port 8798 with a fresh API_TOKEN, the read log and
 *              store in <dir> (the log is kept, so the cap counts every call made for that folder), the cap and output
 *              limit from the flags (defaults 1.00 and 24000) and NODE_USE_ENV_PROXY 1; a fallback for the network with no
 *              model call is retried once with the server restarted without NODE_USE_ENV_PROXY. --fake uses a server in
 *              this process with a fake intake and a fake token count, no key, nothing spent; it also runs a second time
 *              in the same folder with a cap below the bound (written to <dir>/cap/), which must be refused. Writes
 *              <dir>/raw.json, <dir>/profile.json and <dir>/run.json; prints counts only.
 *
 * A missing harness or document prints "NOT RUN: (what)" and the exit status is 2. Output holds counts and the fictional
 * fund's name only. One line per check; last line "INTAKE SERVER: PASS" or "INTAKE SERVER: FAIL"; exit 0 or 1.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const ALL = ['unchanged', 'api', 'fallback', 'failures', 'measure'];
const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const flag = (name) => process.argv.includes('--' + name);
const want = (arg('only') || 'all').split(',').map((s) => s.trim());
const PARTS = want.includes('all') ? ALL.filter((p) => p !== 'measure') : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
const FAKE = flag('fake');
const DOC = arg('doc');
const OUT = arg('out');
if (PARTS.includes('measure')) {
  if (!DOC || !fs.existsSync(DOC)) notRun('the document to measure is missing (--doc ' + (DOC || '') + ')');
  if (!OUT) notRun('no output folder (--out)');
  if (!FAKE && !String(process.env.CARROWVALE_API_KEY || '').trim()) notRun('CARROWVALE_API_KEY is not set (real mode reads on the key; use --fake to prove the tool)');
}

const fails = [];
const line = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) fails.push(text.split(' ')[0]);
  return ok;
};

/* ---------- Part unchanged ---------- */
const SLICES = [
  ['assets/js/intake.js', '  function instructions() {', '837d6c8d55e3899b'],
  ['assets/js/intake.js', '  function corpus(docs, limit) {', '09fdeeb8ddad65e2'],
  ['assets/js/intake.js', '  function normalize(raw) {', 'f8b9b49acf5d16fb'],
  ['assets/js/intake.js', '  function fromOffering(ws, o) {', '3a54b2ccc3f83fc5'],
  ['assets/js/intake.js', '  async function apply(ws, prof, opts) {', 'd80760ab0ec45dcf'],
  ['assets/js/intake.js', '  function filled(p) {', 'f02ce693e7be7276'],
  ['assets/js/intake.js', '  async function readFile(file) {', 'ae6aa343b3a8e0e3'],
  ['assets/js/intake.js', '  const TERMS = ', 'bff29f3668ceae40', true],
  ['assets/js/intake.js', '  const readWithRules = ', '954471e2c2951273', true],
  ['assets/js/intake.js', '  NS.intake = {', 'fa7805f3ed7a6e4e', true],
  ['assets/js/console.js', "  NS.actions['ik-read'] = async () => {", '60ae8c3670613f7b', false, '  };'],
  ['assets/js/console.js', '  function ikUpload() {', 'bb1ff38b75e42a3a'],
  ['assets/js/console.js', '  function ikReview() {', '635f88df5f398127']
];
/** The slice from the first line starting with `start` to the first later line equal to `end` (or that line alone). */
function sliceHash(file, start, single, end) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  const a = lines.findIndex((l) => l.startsWith(start));
  if (a < 0) return 'missing';
  let z = a;
  if (!single) {
    z = lines.findIndex((l, i) => i > a && l === (end || '  }'));
    if (z < 0) return 'unterminated';
  }
  return crypto.createHash('sha256').update(lines.slice(a, z + 1).join('\n')).digest('hex').slice(0, 16);
}
function partUnchanged() {
  let same = 0;
  for (const [file, start, want, single, end] of SLICES) {
    const got = sliceHash(file, start, single, end);
    if (got === want) same += 1;
    else line(false, `unchanged ${path.basename(file)} "${start.trim()}" hashes ${got}, recorded ${want}`);
  }
  line(same === SLICES.length, `unchanged ${same}/${SLICES.length} protected slices byte-identical`);
}

/* ---------- The browser and the reading server ---------- */
let H = null;
function harness() {
  if (H) return H;
  try {
    require.resolve('playwright');
  } catch (e) {
    process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    require('module').Module._initPaths();
  }
  H = require(HARNESS);
  return H;
}

/** A fictional fund's reply (a test aid, no document text). */
const FUND = {
  offering: { name: 'Larkspur Ridge Income Fund, LP', shortName: 'Larkspur Ridge', type: 'Real Estate', summary: 'Fictional fund for the check', status: 'Raising', firstClose: '2027-03-01', minimum: 25000, targetSize: 40000000, currency: 'USD' },
  fees: { mgmtFee: 1.5, feeBasis: 'contributed', carry: 20, pref: 8, other: [] },
  investorTerms: [{ label: 'Minimum', value: '$25,000' }],
  sources: { 'fees.mgmtFee': 'a 1.5% annual fee [p. 2]' },
  confidence: { 'fees.mgmtFee': 'high' },
  notes: []
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** The portal's server in this process (server/index.mjs) with a given intake; resolves to { base, token, close }. */
async function portalServer(intake, extraEnv) {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-check-'));
  const token = crypto.randomBytes(16).toString('hex');
  const env = Object.assign({ NODE_ENV: 'test', STORE_FILE: path.join(dir, 'store.json'), API_TOKEN: token, PORTAL_ORIGIN: '' }, extraEnv || {});
  const server = createServer({ env, intake });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    token,
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** A fake intake that records the prompt and streams the fictional fund's JSON in a few delayed pieces. */
function fakeFundIntake(budget, count) {
  const seen = [];
  return {
    seen,
    budget: budget || null,
    maxTokens: () => 24000,
    count: count || (async () => 1000),
    available: async () => true,
    async run(prompt, { onText }) {
      seen.push(prompt);
      const text = JSON.stringify(FUND);
      const n = 4;
      const size = Math.ceil(text.length / n);
      for (let i = 0; i < n; i++) {
        await pause(150);
        onText(text.slice(i * size, (i + 1) * size));
      }
      return { ok: true, json: JSON.parse(text), reason: '', ms: 600, model: 'fake-model', stopReason: 'end_turn', usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
    }
  };
}

/** The browser, with a stub of the host runtime's property counting every call of its use function. */
async function browser() {
  const h = await harness().start();
  await h.context.addInitScript(() => {
    window.__hostCalls = 0;
    window.claude = {
      use: function () {
        window.__hostCalls += 1;
        return Promise.resolve({ json: () => ((window.__hostCalls += 1), Promise.resolve({})) });
      }
    };
  });
  return h;
}
/** Let the browser reach a server on this machine (the harness aborts every origin but its own). */
async function allow(h, base, handler) {
  await h.context.route(base + '/**', handler || ((r) => r.continue()));
}

/** The workspace's reading server saved as the Integrations screen saves it (url '' for none). */
async function setServer(page, url, token) {
  await page.evaluate(
    ({ url, token }) => {
      const NS = window.CVPortal;
      const s = NS.integrations.ensure(NS.state.ws).server;
      s.url = url;
      s.token = token;
      NS.app.save(true);
    },
    { url, token }
  );
}
/** A new firm (signed up once per browser) on the intake screen. */
async function intakePage(h) {
  const page = await harness().signUp(h);
  await page.evaluate(() => (location.hash = 'console-intake'));
  await page.waitForSelector('[data-action=ik-read]');
  // Every progress text the page shows, kept as it appears.
  await page.evaluate(() => {
    window.__progress = [];
    new MutationObserver((recs) =>
      recs.forEach((r) => {
        const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const p = el && el.closest ? el.closest('#ik-progress') : null;
        if (p) window.__progress.push(p.textContent);
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 3 && n.parentElement && n.parentElement.id === 'ik-progress') window.__progress.push(n.data);
          if (n.nodeType === 1 && n.querySelector && n.querySelector('#ik-progress')) window.__progress.push(n.querySelector('#ik-progress').textContent);
        });
      })
    ).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  return page;
}
/** The hedge sample added with its button (or a file set), Read documents pressed, the review step awaited. */
async function readOnce(page, opts) {
  const o = opts || {};
  await page.evaluate(() => {
    window.CVPortal.state.ui.intake = null;
    window.CVPortal.app.render();
    window.__progress = [];
  });
  await page.waitForSelector('[data-action=ik-read]');
  if (o.file) await page.setInputFiles('#ik-files', o.file);
  else await page.click('[data-action=ik-sample][data-s=hedge]');
  await page.click('[data-action=ik-read]');
  if (o.during) await o.during(page);
  await page.waitForFunction(() => window.CVPortal.state.ui.intake && window.CVPortal.state.ui.intake.step === 'review', null, { timeout: o.timeout || 60000 });
  return page.evaluate(() => {
    const NS = window.CVPortal;
    const st = NS.state.ui.intake;
    const good = st.docs.filter((d) => d.text && d.text.trim().length > 40);
    const corp = NS.intake.corpus(good, NS.intake.LIMIT);
    const rules = NS.intake.normalize(NS.intake.readWithRules(corp.text));
    return {
      profile: st.profile,
      method: st.method,
      trimmed: !!st.trimmed,
      corp: corp.text,
      rules,
      types: Object.keys(NS.OFFERING_TYPES),
      filled: NS.intake.filled(st.profile),
      progress: window.__progress.slice(),
      hostCalls: window.__hostCalls,
      shown: Array.from(document.querySelectorAll('input, textarea')).map((e) => e.value)
    };
  });
}

/* ---------- Part api ---------- */
async function partApi(h, page) {
  const intake = fakeFundIntake();
  const srv = await portalServer(intake);
  try {
    await allow(h, srv.base);
    await setServer(page, srv.base, srv.token);
    const r = await readOnce(page);
    const prompt = intake.seen[0] || '';
    line(intake.seen.length === 1, `api the reading server was asked ${intake.seen.length} time(s) (1 expected)`);
    line(prompt.startsWith('You are setting up a private investment fund'), 'api the prompt starts with the page\'s own instructions');
    const missing = r.types.filter((t) => !prompt.includes(JSON.stringify(t)));
    line(r.types.length > 0 && !missing.length, `api the prompt names every offering type in quotes (${r.types.length - missing.length}/${r.types.length})`);
    line(prompt.endsWith('\n\nDOCUMENTS:\n' + r.corp), `api the prompt ends with a blank line, DOCUMENTS: and the page's corpus (${r.corp.length} characters)`);
    const counted = r.progress.filter((t) => /characters/.test(t)).length;
    line(counted > 0, `api the progress line counted characters ${counted} time(s)`);
    line(r.shown.includes(FUND.offering.name) && r.profile.offering.name === FUND.offering.name, `api the review screen shows the fictional fund's name (${FUND.offering.name})`);
    line(r.method === 'claude', `api method is the automatic-reading value (${r.method === 'claude' ? 'yes' : 'no'})`);
    line(r.hostCalls === 0, `api the host runtime stub was touched ${r.hostCalls} time(s)`);
  } finally {
    await srv.close();
  }
}

/* ---------- Part fallback ---------- */
async function partFallback(h, page) {
  await setServer(page, '', '');
  const r = await readOnce(page);
  line(JSON.stringify(r.profile) === JSON.stringify(r.rules), `fallback the profile equals the built-in reader's (${r.filled} terms)`);
  line(r.method === 'rules', `fallback method rules (${r.method === 'rules' ? 'yes' : 'no'})`);
  line(r.profile.notes.length === r.rules.notes.length, `fallback no note added (${r.profile.notes.length - r.rules.notes.length})`);
  line(r.hostCalls === 0, `fallback the host runtime stub was touched ${r.hostCalls} time(s)`);
}

/* ---------- Part failures ---------- */
const WHY = {
  stopped: 'Reading was stopped. ',
  denied: 'Reading was not allowed. ',
  long: 'The documents were too long to read at once. ',
  busy: 'Reading is busy right now. ',
  other: 'Reading could not finish. '
};
const FALLBACK_NOTE = / ?The built-in reader was used instead\.$/;
/** A stand-in reading server that fails in the way `mode` names. */
async function failingServer() {
  const st = { mode: '' };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const nd = Object.assign({ 'Content-Type': 'application/x-ndjson' }, cors);
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    req.resume();
    req.on('end', () => {
      const m = /^status(\d+)$/.exec(st.mode);
      if (m) {
        res.writeHead(Number(m[1]), Object.assign({ 'Content-Type': 'application/json' }, cors));
        return res.end(JSON.stringify({ ok: false, reason: 'x' }));
      }
      if (st.mode === 'lastFailed') {
        res.writeHead(200, nd);
        return res.end(JSON.stringify({ t: '{"offering":' }) + '\n' + JSON.stringify({ ok: false, reason: 'failed' }) + '\n');
      }
      if (st.mode === 'noLast') {
        res.writeHead(200, nd);
        return res.end(JSON.stringify({ t: '{"offering":' }) + '\n');
      }
      if (st.mode === 'slow') {
        const t = setTimeout(() => {
          if (res.destroyed) return;
          res.writeHead(200, nd);
          res.end(JSON.stringify({ ok: true, json: FUND }) + '\n');
        }, 6000);
        res.on('close', () => clearTimeout(t));
        return;
      }
      if (st.mode === 'hold') {
        res.writeHead(200, nd);
        res.write(JSON.stringify({ t: '{"offering":' }) + '\n');
        return; // held open until the browser stops it
      }
      res.writeHead(500, cors);
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    st,
    base: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  };
}
/** A port nothing listens on (opened, then closed). */
async function closedBase() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  await new Promise((r) => s.close(r));
  return base;
}
async function partFailures(h, page) {
  const srv = await failingServer();
  const refused = await closedBase();
  await allow(h, srv.base);
  await allow(h, refused);
  const cases = [
    ['503', 'status503', WHY.other],
    ['401', 'status401', WHY.denied],
    ['402', 'status402', WHY.other],
    ['413', 'status413', WHY.long],
    ['429', 'status429', WHY.busy],
    ['failed-last-line', 'lastFailed', WHY.other],
    ['no-last-line', 'noLast', WHY.other],
    ['refused-connection', 'refused', WHY.other],
    ['browser-limit', 'slow', WHY.other],
    ['stop', 'hold', WHY.stopped]
  ];
  try {
    for (const [name, mode, why] of cases) {
      srv.st.mode = mode;
      await setServer(page, mode === 'refused' ? refused : srv.base, 'check-token');
      if (mode === 'slow') await page.evaluate(() => (window.CVPortal.intake.SERVER_LIMIT_MS = 3000));
      const during =
        mode === 'hold'
          ? async (pg) => {
              await pg.waitForSelector('[data-action=ik-stop]', { timeout: 20000 });
              await pg.waitForTimeout(300);
              await pg.click('[data-action=ik-stop]');
            }
          : null;
      const r = await readOnce(page, { during });
      if (mode === 'slow') await page.evaluate(() => (window.CVPortal.intake.SERVER_LIMIT_MS = 630000));
      const notes = r.profile.notes.slice();
      const first = notes.shift() || '';
      const rest = Object.assign({}, r.profile, { notes });
      const same = JSON.stringify(rest) === JSON.stringify(r.rules);
      line(first === why + 'The built-in reader was used instead.' && same && r.method === 'rules' && r.hostCalls === 0, `failures ${name}: note "${first.replace(FALLBACK_NOTE, '').trim()}", built-in result ${same ? 'kept' : 'changed'}, method ${r.method === 'rules' ? 'rules' : 'not rules'}`);
    }
  } finally {
    await page.evaluate(() => (window.CVPortal.intake.SERVER_LIMIT_MS = 630000));
    await srv.close();
  }
}

/* ---------- Part measure ---------- */
const readRows = (file) => {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  } catch (e) {
    return [];
  }
};
const KNOWN_NOTE = /^(Reading was stopped|Reading was not allowed|The documents were too long to read at once|Reading is busy right now|Reading could not finish)\. The built-in reader was used instead\.$/;
/** The PDF uploaded on a fresh intake against srv, the /v1/intake answer captured unchanged; files written to dir. */
async function measureRun(h, page, srv, dir, readLog, M) {
  fs.mkdirSync(dir, { recursive: true });
  let captured = null;
  await allow(h, srv.base, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && /\/v1\/intake$/.test(req.url())) {
      const resp = await route.fetch({ timeout: 700000 });
      const body = await resp.text();
      captured = { status: resp.status(), body };
      return route.fulfill({ response: resp, body });
    }
    return route.continue();
  });
  await setServer(page, srv.base, srv.token);
  const before = readRows(readLog).length;
  const t0 = Date.now();
  let r = null;
  try {
    r = await readOnce(page, { file: DOC, timeout: 700000 });
  } catch (e) {
    r = null;
  }
  const seconds = Math.round((Date.now() - t0) / 100) / 10;
  const rows = readRows(readLog);
  const row = rows.length > before ? rows[rows.length - 1] : null;
  let last = null;
  if (captured && captured.status === 200) {
    const ls = captured.body.split('\n').filter((l) => l.trim());
    try {
      last = ls.length ? JSON.parse(ls[ls.length - 1]) : null;
    } catch (e) {
      last = null;
    }
    if (last && typeof last.ok !== 'boolean') last = null;
  }
  const raw = last && last.ok && last.json ? last.json : null;
  const outcome = !r ? 'failed' : captured && captured.status === 402 ? 'cap' : r.method === 'claude' && raw ? 'read' : r.method === 'rules' ? 'fallback' : 'failed';
  const why = !r ? 'the review step was not reached' : !captured ? 'no request reached the reading server' : captured.status !== 200 ? 'http ' + captured.status : last ? (last.ok ? '' : String(last.reason || '')) : 'no last line';
  const note = r && r.profile && r.profile.notes && r.profile.notes[0] ? String(r.profile.notes[0]) : '';
  const run = {
    outcome,
    why,
    seconds,
    readingMs: row ? row.ms : null,
    counted: row ? row.counted : null,
    maxTokens: Number(arg('max-tokens') || 24000),
    model: row ? row.model : '',
    usage: row ? row.usage : null,
    cost: row ? row.cost : 0,
    spent: rows.reduce((a, x) => a + M.costOf(x.usage, x.model).usd, 0),
    method: r ? r.method : '',
    firstNote: KNOWN_NOTE.test(note) ? note : '',
    trimmed: r ? r.trimmed : null
  };
  fs.writeFileSync(path.join(dir, 'raw.json'), JSON.stringify(raw, null, 2));
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(r ? r.profile : null, null, 2));
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  return { run, raw, r, row };
}
/** A fake intake for the measure's fake mode: a fake token count, the fictional fund's reply, fake usage. */
function fakeMeasureIntake(budget, maxTokens) {
  const tokens = (prompt) => Math.ceil(prompt.length / 4);
  return {
    budget,
    maxTokens: () => maxTokens,
    count: async (prompt) => tokens(prompt),
    available: async () => true,
    async run(prompt, { onText }) {
      const text = JSON.stringify(FUND);
      onText(text.slice(0, 40));
      await pause(100);
      onText(text.slice(40));
      return { ok: true, json: JSON.parse(text), reason: '', ms: 150, model: 'fake-model', stopReason: 'end_turn', usage: { input_tokens: tokens(prompt), output_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
    }
  };
}
/** server/index.mjs as its own process on port 8798, as plan 67 runs it; resolves once /health shows reader true. */
async function spawnServer(dir, cap, maxTokens, proxy) {
  const { spawn } = require('child_process');
  const token = crypto.randomBytes(16).toString('hex');
  const env = Object.assign({}, process.env, { PORT: '8798', API_TOKEN: token, PORTAL_ORIGIN: '', STORE_FILE: path.join(dir, 'store.json'), CARROWVALE_READ_LOG: path.join(dir, 'read.log'), CARROWVALE_SPEND_CAP_USD: String(cap), CARROWVALE_READ_MAX_TOKENS: String(maxTokens) });
  if (proxy) env.NODE_USE_ENV_PROXY = '1';
  else delete env.NODE_USE_ENV_PROXY;
  const err = fs.openSync(path.join(dir, 'server-err.txt'), 'a');
  const child = spawn(process.execPath, [path.join(ROOT, 'server/index.mjs')], { env, stdio: ['ignore', 'ignore', err] });
  const base = 'http://127.0.0.1:8798';
  const close = () =>
    new Promise((r) => {
      if (child.exitCode !== null) return r();
      child.once('exit', () => r());
      child.kill();
    });
  for (let i = 0; i < 80; i++) {
    try {
      const h = await (await fetch(base + '/health')).json();
      if (h && h.reader === true) return { base, token, close };
    } catch (e) {
      /* not listening yet */
    }
    await pause(250);
  }
  await close();
  return null;
}
async function partMeasure(h, page) {
  const M = await import(pathToFileURL(path.join(ROOT, 'server/lib/model.mjs')).href);
  fs.mkdirSync(OUT, { recursive: true });
  const cap = arg('cap') || '1.00';
  const maxTokens = Number(arg('max-tokens') || 24000);
  const readLog = path.join(OUT, 'read.log');
  const say = (tag, x) => `measure ${tag}: outcome ${x.run.outcome}, ${x.run.seconds} s, cost $${Number(x.run.cost || 0).toFixed(4)}, ${x.r ? x.r.filled : 0} terms filled`;
  if (FAKE) {
    const mk = (capValue) => {
      const env = { CARROWVALE_SPEND_CAP_USD: String(capValue), CARROWVALE_READ_LOG: readLog, CARROWVALE_READ_MAX_TOKENS: String(maxTokens) };
      return portalServer(fakeMeasureIntake(M.createBudget(env), maxTokens), env);
    };
    let srv = await mk(cap);
    let a;
    try {
      a = await measureRun(h, page, srv, OUT, readLog, M);
    } finally {
      await srv.close();
    }
    const expected = await page.evaluate((f) => window.CVPortal.intake.normalize(f), FUND);
    const usage = a.row ? a.row.usage : null;
    line(a.run.outcome === 'read', say('fake', a));
    line(!!usage && a.run.cost > 0 && Math.abs(a.run.cost - M.costOf(usage, 'fake-model').usd) < 1e-12, `measure fake usage priced into cost (${usage ? usage.input_tokens + usage.output_tokens : 0} tokens)`);
    line(JSON.stringify(a.raw) === JSON.stringify(FUND), 'measure raw.json equals the fake reply');
    line(JSON.stringify(JSON.parse(fs.readFileSync(path.join(OUT, 'profile.json'), 'utf8'))) === JSON.stringify(expected), 'measure profile.json equals the normalized reply');
    // The same folder again with a cap below the bound: refused before any reading, the built-in result kept.
    srv = await mk('0.01');
    let b;
    try {
      b = await measureRun(h, page, srv, path.join(OUT, 'cap'), readLog, M);
    } finally {
      await srv.close();
    }
    const notes = b.r ? b.r.profile.notes.slice() : [];
    const first = notes.shift() || '';
    const same = !!b.r && JSON.stringify(Object.assign({}, b.r.profile, { notes })) === JSON.stringify(b.r.rules);
    line(b.run.outcome === 'cap' && same && first === WHY.other + 'The built-in reader was used instead.', say('fake below the cap', b) + (same ? ', built-in profile' : ', profile changed'));
    line(Math.abs(b.run.spent - a.run.cost) < 1e-12, `measure the cap counted the folder's earlier call ($${b.run.spent.toFixed(4)} spent)`);
    return;
  }
  let srv = await spawnServer(OUT, cap, maxTokens, true);
  if (!line(!!srv, 'measure the reading server answered /health with reader true within 20 s')) return;
  let a;
  try {
    a = await measureRun(h, page, srv, OUT, readLog, M);
  } finally {
    await srv.close();
  }
  const noCall = (x) => x.row && ((['failed', 'timeout'].includes(x.row.outcome) && !x.row.model && !(x.row.usage && x.row.usage.input_tokens)) || (x.row.outcome === 'spend_cap' && x.row.counted === null));
  if ((a.run.outcome === 'fallback' || a.run.outcome === 'cap') && noCall(a)) {
    console.log('measure the network failed before any reading; retried once without the proxy setting');
    srv = await spawnServer(OUT, cap, maxTokens, false);
    if (!line(!!srv, 'measure the reading server answered /health with reader true within 20 s (retry)')) return;
    try {
      a = await measureRun(h, page, srv, OUT, readLog, M);
    } finally {
      await srv.close();
    }
  }
  console.log(`measure spent in this folder $${a.run.spent.toFixed(4)}, counted ${a.run.counted === null ? 'none' : a.run.counted} tokens`);
  line(a.run.outcome !== 'failed', say('real', a));
}

(async () => {
  if (PARTS.includes('unchanged')) partUnchanged();
  const browserParts = PARTS.filter((p) => ['api', 'fallback', 'failures', 'measure'].includes(p));
  if (browserParts.length) {
    const h = await browser();
    try {
      const page = await intakePage(h);
      if (PARTS.includes('api')) await partApi(h, page);
      if (PARTS.includes('fallback')) await partFallback(h, page);
      if (PARTS.includes('failures')) await partFailures(h, page);
      if (PARTS.includes('measure')) await partMeasure(h, page);
      line(!h.errors.length, `page errors ${h.errors.length}`);
    } finally {
      await h.stop();
    }
  }
  console.log(fails.length ? 'INTAKE SERVER: FAIL' : 'INTAKE SERVER: PASS');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.log('FAIL  check crashed: ' + ((e && e.message) || e).toString().split('\n')[0]);
  console.log('INTAKE SERVER: FAIL');
  process.exit(1);
});
