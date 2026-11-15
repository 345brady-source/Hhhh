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
 *   failures   every way the reading server can fail leaves the built-in result with today's note (added in plan 66 task 2)
 *   measure    one PDF once through the intake screen against a reading server (added in plan 66 task 2)
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

(async () => {
  if (PARTS.includes('unchanged')) partUnchanged();
  const browserParts = PARTS.filter((p) => ['api', 'fallback'].includes(p));
  if (browserParts.length) {
    const h = await browser();
    try {
      const page = await intakePage(h);
      if (PARTS.includes('api')) await partApi(h, page);
      if (PARTS.includes('fallback')) await partFallback(h, page);
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
