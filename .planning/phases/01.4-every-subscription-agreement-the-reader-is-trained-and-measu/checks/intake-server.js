#!/usr/bin/env node
/*
 * The offering intake read through the portal's reading server (D-36), on the real intake screen.
 *
 *   node intake-server.js [--only unchanged,api,fallback,failures,unreadable,retry,wholetext,mixedpages | measure | all]
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
 *   unreadable D-37 and D-38 on public PDFs only (never the blind documents): the readability share of every public PDF,
 *              of a public PPM made into a broken-text PDF (pictures of its first 12 pages with a scrambled invisible text
 *              layer) and of a picture-only PDF, against UNREADABLE_BELOW; the broken PDF and the picture-only PDFs sent as
 *              PDFs with a reading server set (the fictional fund reaches review); without one, today's behaviour exactly;
 *              a readable public PPM sent as { prompt } byte for byte as plan 66 sends it. Made PDFs go to out-68 in SCRATCH.
 *              Then read whole (D-38): mergeAnswers on synthetic answers; with RANGE_PAGES 5 the broken PDF read in three
 *              requests of exactly their pages and the merged answer on review; a request over the byte limit halved; a
 *              413 halved and sent again; a failing range falling back with today's note; no page dropped.
 *   Plan 01.4-69 (D-38), fake intakes only, nothing spent:
 *   retry      a stand-in server answering 503, 503 then 200; 429 then 200; a refused connection then 200: the fictional
 *              fund on review, no note; 503 every time: today's fallback after exactly 3 attempts; 400, 401, 402 and 413
 *              sent once (failures above now also pass through the 3 attempts where the status is transient)
 *   wholetext  with a reading server, the first public PPM with more than 200,000 characters of text: one prompt of the
 *              instructions, DOCUMENTS: and corpus(good, Infinity).text, no trimming note on review; with the fake intake
 *              answering 413 over a threshold: split by document, then by halves at the [p. N] markers, every page sent
 *              once, the answers merged with mergeAnswers; no server: the built-in reader on today's trimmed corpus
 *   mixedpages the RockStep PPM's first 20 pages with pages 5, 6 and 15 made pictures (picture-pdf.js, out-69/mixed.pdf):
 *              per-page scores printed, the picture pages failing and every other page passing; sent on the PDF path with
 *              every page; the unchanged RockStep PPM (every page passing) still sent on the text path
 *   measure    one PDF once through the intake screen against a reading server (D-34 tooling, plan 67 runs it). Real mode
 *              needs CARROWVALE_API_KEY and spawns server/index.mjs on port 8798 with a fresh API_TOKEN, the read log and
 *              store in <dir> (the log is kept, so the cap counts every call made for that folder), the cap and output
 *              limit from the flags (defaults 1.00 and 24000) and NODE_USE_ENV_PROXY 1; a fallback for the network with no
 *              model call is retried once with the server restarted without NODE_USE_ENV_PROXY. --fake uses a server in
 *              this process with a fake intake and a fake token count, no key, nothing spent; it also runs a second time
 *              in the same folder with a cap below the bound (written to <dir>/cap/), which must be refused. Writes
 *              <dir>/raw.json, <dir>/profile.json and <dir>/run.json; prints counts only. run.json also records what was
 *              sent (sent text or pdf, ranges, pdfOf, testPageLimit) and the attempts. Test spend cap: after a refusal that
 *              cost nothing the server restarts with the output limit fitted to what remains of the cap with every page;
 *              only if even 16000 does not fit is the test-only NS.intake.TEST_PAGE_LIMIT set, reported as "test spend
 *              cap: pages 1 to N of M"; at most 3 attempts. The intake returning to upload with "No readable text was
 *              found" stops the run: outcome failed, why no-readable-text. --fake (on the broken PDF) proves a cap that
 *              refuses 64000 output tokens but fits a lower limit (default cap 2.00), a page-limit case (<dir>/pages/,
 *              cap 1.00) and the below-the-cap case.
 *   measure --combined (plan 01.4-71, D-44): one PPM with the subscription agreement inside, once, through the intake
 *              screen: Read documents, the range on review, Create the offering, the done step, then the background
 *              agreement reading awaited (up to 1800 s). One attempt only: no test-cap fitting and no TEST_PAGE_LIMIT
 *              (D-38). Real mode: spawnServer as above (--cap default 6.00, --max-tokens default 64000, both routes on one
 *              server, one budget, one read log in <dir>), with the same one retry without the proxy setting. --fake:
 *              a server in this process with an intake answering the fictional fund plus subscriptionAgreement from
 *              --range a-b and a fake agreement reader (the fixed picks rule, fake usage 50000 in and 5000 out). A PPM
 *              reading that is not read (the probe's refusal) ends there. Writes <dir>/raw.json, profile.json and
 *              result.json (range, reviewLine, ppm, agreement, cost, spent, cap, maxTokens, model, seconds, nameMissing;
 *              counts and page numbers only) and prints one COMBINED line.
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
const ALL = ['unchanged', 'api', 'fallback', 'failures', 'unreadable', 'retry', 'wholetext', 'mixedpages', 'measure'];
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
const COMBINED = flag('combined');
const DOC = arg('doc');
const OUT = arg('out');
if (PARTS.some((p) => ['unreadable', 'wholetext', 'mixedpages'].includes(p))) {
  const pub = path.join(process.env.INTAKE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad'), 'public-agreements');
  ['PPM_RockStep_Hometown_America_Fund_I', 'PPM_Worcester_Fund_LLC'].forEach((d) => fs.existsSync(path.join(pub, d, 'doc.pdf')) || notRun('the public PDF ' + d + ' is missing'));
  ['pdftoppm', 'pdftotext'].forEach((t) => {
    try {
      execFileSync(t, ['-v'], { stdio: 'ignore' });
    } catch (e) {
      if (e.code === 'ENOENT') notRun(t + ' is not installed');
    }
  });
}
if (PARTS.includes('measure')) {
  if (!DOC || !fs.existsSync(DOC)) notRun('the document to measure is missing (--doc ' + (DOC || '') + ')');
  if (!OUT) notRun('no output folder (--out)');
  if (!FAKE && !String(process.env.CARROWVALE_API_KEY || '').trim()) notRun('CARROWVALE_API_KEY is not set (real mode reads on the key; use --fake to prove the tool)');
  if (COMBINED && FAKE && arg('range') && !/^\d+-\d+$/.test(arg('range'))) notRun('--range must be a-b (pages of --doc)');
  if (COMBINED && FAKE) ['pdftotext', 'pdfinfo'].forEach((t) => {
    try {
      execFileSync(t, ['-v'], { stdio: 'ignore' });
    } catch (e) {
      if (e.code === 'ENOENT') notRun(t + ' is not installed');
    }
  });
}

const fails = [];
const line = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) fails.push(text.split(' ')[0]);
  return ok;
};

/* ---------- Part unchanged ---------- */
const SLICES = [
  ['assets/js/intake.js', '  function instructions() {', '87b2745e6c7f7e99'], // plan 71: D-44 adds one shape item (subscriptionAgreement { document, firstPage, lastPage } or null) and one rule line (its page range in the uploaded file's own pages, ending before attached tax forms per D-46); was 39dc2cf7c0171a1e (owner's D-45 rules)
  ['assets/js/intake.js', '  function corpus(docs, limit) {', '09fdeeb8ddad65e2'],
  ['assets/js/intake.js', '  function normalize(raw) {', 'f8b9b49acf5d16fb'],
  ['assets/js/intake.js', '  function fromOffering(ws, o) {', '3a54b2ccc3f83fc5'],
  ['assets/js/intake.js', '  async function apply(ws, prof, opts) {', '795bfb2d7ea5929e'], // plan 71: D-44 its last call passes opts to prepareAgreement (the agreement's pages found inside an uploaded PDF); was 0de69fa96168ce4f
  ['assets/js/intake.js', '  function filled(p) {', 'f02ce693e7be7276'],
  ['assets/js/intake.js', '  async function readFile(file) {', 'ae6aa343b3a8e0e3'],
  ['assets/js/intake.js', '  const TERMS = ', 'bff29f3668ceae40', true],
  ['assets/js/intake.js', '  const readWithRules = ', '954471e2c2951273', true],
  ['assets/js/intake.js', '  NS.intake = {', '48f32cb9213f564a', true], // plan 64 Task 3: white-label renames only (D-16, D-31); intake behaviour unchanged per D-36
  ['assets/js/console.js', "  NS.actions['ik-read'] = async () => {", '71a3c3180bd145c8', false, '  };'], // plan 71: D-44 one statement after normalize: st.agreement from the raw answer (agreementPart), automatic reading only; was b6e0356fd10fd2da (plan 68)
  ['assets/js/console.js', '  function ikUpload() {', '276f15a55bd2a8b9'], // plan 69 Task 3: D-38 removes the allow wording; behaviour unchanged
  ['assets/js/console.js', '  function ikReview() {', '49bec195af63b595'] // plan 71: D-44 the Subscription agreement panel after the head when st.agreement is set (same output as before without it); was 635f88df5f398127
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
async function portalServer(intake, extraEnv, reader) {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-check-'));
  const token = crypto.randomBytes(16).toString('hex');
  const env = Object.assign({ NODE_ENV: 'test', STORE_FILE: path.join(dir, 'store.json'), API_TOKEN: token, PORTAL_ORIGIN: '' }, extraEnv || {});
  const server = createServer(reader ? { env, intake, reader } : { env, intake });
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
    line(r.method === 'auto', `api method is the automatic-reading value (${r.method === 'auto' ? 'yes' : 'no'})`); // plan 64 Task 3: the stored value renamed (white label)
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

/* ---------- Part unreadable (D-37, D-38) ---------- */
/** Public PDFs only (D-34: the blind documents are never used here); the made test PDFs are kept in OUT68. */
const SCRATCH = process.env.INTAKE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PUBLIC = path.join(SCRATCH, 'public-agreements');
const OUT68 = path.join(SCRATCH, 'edgar/measure/out-68');
const ROCKSTEP = path.join(PUBLIC, 'PPM_RockStep_Hometown_America_Fund_I/doc.pdf');
const WORCESTER = path.join(PUBLIC, 'PPM_Worcester_Fund_LLC/doc.pdf');
const NO_TEXT = 'No readable text was found. A scanned PDF needs OCR first, or paste the summary of terms.';
const ATTACHED = 'attached as a PDF because its text layer could not be read';
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
/** Every letter moved 7 places along the alphabet (the scrambled text layer). */
const shift7 = (s) =>
  s.replace(/[A-Za-z]/g, (c) => {
    const b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + 7) % 26) + b);
  });
/**
 * Pages first..last of a public PDF rendered to pictures (pdftoppm, 110 dpi) and laid full-page into a new PDF with pdf-lib
 * in the check browser. With scramble, each page also gets an invisible text layer (opacity 0) holding that page's
 * extracted text with every letter shifted 7 places: the pages look the same while the text layer cannot be read.
 * Made once into `out`.
 */
async function picturePdf(page, src, first, last, scramble, out) {
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(OUT68, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(OUT68, 'render-'));
  try {
    execFileSync('pdftoppm', ['-r', '110', '-jpeg', '-f', String(first), '-l', String(last), src, path.join(tmp, 'p')]);
    const imgs = fs
      .readdirSync(tmp)
      .filter((f) => f.endsWith('.jpg'))
      .sort()
      .map((f) => fs.readFileSync(path.join(tmp, f)).toString('base64'));
    const texts = scramble ? imgs.map((_, i) => shift7(execFileSync('pdftotext', ['-layout', '-f', String(first + i), '-l', String(first + i), src, '-'], { encoding: 'utf8' })).replace(/[^\x20-\x7e\n]/g, ' ')) : null;
    const b64 = await page.evaluate(
      async ({ imgs, texts }) => {
        if (!window.PDFLib)
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
        const { PDFDocument, StandardFonts } = window.PDFLib;
        const doc = await PDFDocument.create();
        const font = texts ? await doc.embedFont(StandardFonts.Helvetica) : null;
        const bin = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
        for (let i = 0; i < imgs.length; i++) {
          const img = await doc.embedJpg(bin(imgs[i]));
          const w = (img.width * 72) / 110;
          const hgt = (img.height * 72) / 110;
          const pg = doc.addPage([w, hgt]);
          pg.drawImage(img, { x: 0, y: 0, width: w, height: hgt });
          if (texts) {
            const lines = texts[i].split('\n').map((l) => l.replace(/\s+$/, ''));
            const step = Math.min(10, (hgt - 40) / Math.max(1, lines.length));
            lines.forEach((l, k) => {
              if (l.trim()) pg.drawText(l, { x: 24, y: hgt - 30 - k * step, size: Math.max(4, step * 0.8), font, opacity: 0 });
            });
          }
        }
        const bytes = await doc.save();
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      { imgs, texts }
    );
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}
/** The readability share NS.intake's helper gives the text readFile extracts from each file. */
async function sharesOf(page, files) {
  const out = [];
  for (const [label, f] of files) {
    const r = await page.evaluate(
      async ({ b64, name }) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const d = await window.CVPortal.intake.readFile(new File([bin], name, { type: 'application/pdf' }));
        return { share: window.CVPortal.intake.unreadableShare(d.text), tokens: (d.text.toLowerCase().match(/[a-z]{2,}/g) || []).length, pages: d.pages };
      },
      { b64: fs.readFileSync(f).toString('base64'), name: path.basename(f) }
    );
    out.push(Object.assign({ label }, r));
  }
  return out;
}
/** A fake intake that records each request's prompt and PDFs; answer(i, prompt, pdfs) gives the reply (null: a failure). */
function recordingIntake(answer, countOf) {
  const seen = [];
  return {
    seen,
    budget: null,
    maxTokens: () => 24000,
    count: countOf || (async (prompt, pdfs) => Math.ceil(prompt.length / 4) + (pdfs || []).reduce((a, p) => a + p.pages * 3000, 0)),
    available: async () => true,
    async run(prompt, { onText, pdfs }) {
      const i = seen.length;
      seen.push({ prompt, pdfs: pdfs || null });
      const json = answer ? answer(i, prompt, pdfs) : FUND;
      if (!json) return { ok: false, json: null, reason: 'failed', ms: 5, model: 'fake-model', stopReason: '', usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
      const text = JSON.stringify(json);
      await pause(50);
      onText(text.slice(0, 30));
      onText(text.slice(30));
      return { ok: true, json: JSON.parse(text), reason: '', ms: 60, model: 'fake-model', stopReason: 'end_turn', usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
    }
  };
}
/** The request bodies the browser sends to POST /v1/intake on srv, kept as sent. */
async function captureBodies(h, srv) {
  const bodies = [];
  await allow(h, srv.base, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && /\/v1\/intake$/.test(req.url())) bodies.push(req.postData() || '');
    return route.continue();
  });
  return bodies;
}
/** One file uploaded on a fresh intake and Read documents pressed; resolves at the review step or the upload step's error. */
async function readOutcome(page, file, timeout) {
  await page.evaluate(() => {
    const NS = window.CVPortal;
    NS.state.ui.intake = null;
    NS.app.render();
    window.__progress = [];
    window.__noText = false;
    if (window.__noTextObs) window.__noTextObs.disconnect();
    window.__noTextObs = new MutationObserver(() => {
      if (document.body.textContent.indexOf('No readable text was found') >= 0) window.__noText = true;
    });
    window.__noTextObs.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.waitForSelector('[data-action=ik-read]');
  await page.setInputFiles('#ik-files', file);
  await page.click('[data-action=ik-read]');
  await page.waitForFunction(
    () => {
      const st = window.CVPortal.state.ui.intake;
      return !!st && (st.step === 'review' || (st.step === 'upload' && !!st.error));
    },
    null,
    { timeout: timeout || 60000 }
  );
  return page.evaluate(() => {
    const NS = window.CVPortal;
    const st = NS.state.ui.intake;
    const good = st.docs.filter((d) => d.text && d.text.trim().length > 40);
    const corp = NS.intake.corpus(good, NS.intake.LIMIT);
    // Plan 69 (D-38): the whole text, as the server path now sends it.
    const whole = NS.intake.corpus(good, Infinity);
    const rules = NS.intake.normalize(NS.intake.readWithRules(corp.text));
    return {
      step: st.step,
      error: st.error || '',
      method: st.method || '',
      profile: st.profile || null,
      rules,
      corp: corp.text,
      trimmed: !!st.trimmed,
      filled: st.profile ? NS.intake.filled(st.profile) : 0,
      noText: !!window.__noText || document.body.textContent.indexOf('No readable text was found') >= 0,
      progress: (window.__progress || []).slice(),
      whole: whole.text,
      names: st.docs.map((d) => d.name),
      pageText: document.body.innerText,
      docs: st.docs.map((d) => ({ chars: d.text ? d.text.trim().length : 0, pages: d.pages, text: d.text || '' })),
      shown: Array.from(document.querySelectorAll('input, textarea')).map((e) => e.value)
    };
  });
}
/** What today's ik-read does with no reading server: a document with more than 40 characters of text goes on to reading. */
const todayWithout = (r) => (r.docs.some((d) => d.chars > 40) ? 'review' : 'message');
async function partUnreadable(h, page) {
  const broken = await picturePdf(page, ROCKSTEP, 1, 12, true, path.join(OUT68, 'broken.pdf'));
  const pictures = await picturePdf(page, WORCESTER, 1, 8, false, path.join(OUT68, 'pictures.pdf'));
  const pictures3 = await picturePdf(page, WORCESTER, 1, 3, false, path.join(OUT68, 'pictures-3.pdf'));
  // The tuning record: every public PDF, the broken one and the picture-only one.
  const T = await page.evaluate(() => window.CVPortal.intake.UNREADABLE_BELOW);
  const publics = fs
    .readdirSync(PUBLIC)
    .filter((d) => fs.existsSync(path.join(PUBLIC, d, 'doc.pdf')))
    .sort()
    .map((d) => [d, path.join(PUBLIC, d, 'doc.pdf')]);
  const shares = await sharesOf(page, publics.concat([['broken', broken], ['pictures', pictures]]));
  for (const s of shares) console.log(`      share ${s.label}: ${s.share.toFixed(4)} (${s.tokens} tokens, ${s.pages} pages)`);
  const pub = shares.filter((s) => s.label !== 'broken' && s.label !== 'pictures');
  const low = pub.reduce((a, s) => Math.min(a, s.share), 1);
  const br = shares.find((s) => s.label === 'broken');
  const pic = shares.find((s) => s.label === 'pictures');
  line(typeof T === 'number' && T > 0, `unreadable threshold UNREADABLE_BELOW ${T}`);
  line(pub.length === 7 && pub.every((s) => s.share >= 2 * T), `unreadable every public PDF at least twice the threshold (${pub.length} PDFs, lowest ${low.toFixed(4)}, needs ${(2 * T).toFixed(4)})`);
  line(br.share <= T / 2 && br.tokens > 1000, `unreadable the broken PDF at most half the threshold (${br.share.toFixed(4)}, needs ${(T / 2).toFixed(4)}; ${br.tokens} scrambled tokens in its text layer)`);
  line(pic.share === 0, `unreadable the picture-only PDF has no letter tokens (share ${pic.share})`);

  const rec = recordingIntake();
  const srv = await portalServer(rec);
  try {
    const bodies = await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    // The page's own instructions, from a readable sample read the plan 66 way.
    const s0 = await readOnce(page);
    const p0 = (rec.seen[0] || {}).prompt || '';
    const tail0 = '\n\nDOCUMENTS:\n' + s0.corp;
    const instr = p0.endsWith(tail0) ? p0.slice(0, p0.length - tail0.length) : '';
    line(!!instr && instr.startsWith('You are setting up a private investment fund') && !rec.seen[0].pdfs, `unreadable the readable sample's prompt is instructions, a blank line, DOCUMENTS: and the corpus (${instr.length} characters of instructions)`);

    // The broken PDF: sent as the PDF itself, its scrambled text nowhere in the prompt.
    let n = rec.seen.length;
    let r = await readOutcome(page, broken);
    let got = rec.seen.slice(n);
    let req = got[0] || {};
    let pdfs = req.pdfs || [];
    const bytes = pdfs[0] ? Buffer.from(pdfs[0].data, 'base64') : Buffer.alloc(0);
    line(got.length === 1 && pdfs.length === 1, `unreadable broken: one request with ${pdfs.length} PDF(s)`);
    line(sha(bytes) === sha(fs.readFileSync(broken)) && pdfs[0].pages === 12 && pdfs[0].of === 12, `unreadable broken: the PDF's bytes hash to the broken file's SHA-256, pages ${pdfs[0] ? pdfs[0].pages : 0} of ${pdfs[0] ? pdfs[0].of : 0} (12 expected)`);
    const prompt = req.prompt || '';
    line(!!instr && prompt.startsWith(instr + '\n\nDOCUMENTS:\n'), 'unreadable broken: the prompt starts with the page\'s instructions, a blank line and DOCUMENTS:');
    line(prompt.endsWith(`=== Document: broken.pdf (12 pages) === ${ATTACHED}`), 'unreadable broken: the prompt carries the attachment line');
    const scrambled = (r.docs[0] ? r.docs[0].text : '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 30 && !/^\[p\. \d+\]$/.test(l));
    const leaked = scrambled.filter((l) => prompt.indexOf(l.slice(0, 30)) >= 0).length;
    line(scrambled.length > 20 && leaked === 0, `unreadable broken: none of the scrambled text is in the prompt (${leaked} of ${scrambled.length} lines found)`);
    const keys = bodies.length ? Object.keys(JSON.parse(bodies[bodies.length - 1])).join(',') : '';
    line(keys === 'prompt,pdfs', `unreadable broken: the request body is { ${keys} }`);
    line(r.step === 'review' && r.method === 'auto' && r.profile.offering.name === FUND.offering.name && r.shown.includes(FUND.offering.name), `unreadable broken: the fictional fund reaches the review screen, method ${r.method === 'auto' ? 'auto' : r.method || 'none'}`);

    // Picture-only PDFs with a reading server (D-38): read from the pages, never "No readable text was found".
    for (const [file, pages] of [
      [pictures, 8],
      [pictures3, 3]
    ]) {
      n = rec.seen.length;
      r = await readOutcome(page, file);
      got = rec.seen.slice(n);
      pdfs = (got[0] && got[0].pdfs) || [];
      line(got.length === 1 && pdfs.length === 1 && pdfs[0].pages === pages && sha(Buffer.from(pdfs[0].data, 'base64')) === sha(fs.readFileSync(file)), `unreadable picture-only ${pages} pages, reading server set: sent as a PDF (${pdfs.length} PDF, ${pdfs[0] ? pdfs[0].pages : 0} pages)`);
      line(r.step === 'review' && r.method === 'auto' && r.profile.offering.name === FUND.offering.name && !r.noText, `unreadable picture-only ${pages} pages, reading server set: the fictional fund reaches review, "No readable text was found" ${r.noText ? 'shown' : 'never shown'}`);
    }

    // Without a reading server, exactly today's behaviour: the 3-page file (40 characters or fewer) stops at today's
    // message; the 8-page file has more than 40 characters of page markers, so today's code reads it with the built-in reader.
    await setServer(page, '', '');
    n = rec.seen.length;
    r = await readOutcome(page, pictures3);
    line(r.step === 'upload' && r.error === NO_TEXT && todayWithout(r) === 'message', `unreadable picture-only 3 pages, no reading server: today's message (${r.error === NO_TEXT ? 'exact' : 'different: ' + (r.error ? 'other text' : 'none')}; ${r.docs[0] ? r.docs[0].chars : 0} characters)`);
    r = await readOutcome(page, pictures);
    const today = todayWithout(r);
    const same = today === 'message' ? r.step === 'upload' && r.error === NO_TEXT : r.step === 'review' && r.method === 'rules' && JSON.stringify(r.profile) === JSON.stringify(r.rules);
    line(same, `unreadable picture-only 8 pages, no reading server: today's behaviour (${today === 'message' ? 'the message' : 'the built-in reader on ' + r.docs[0].chars + ' characters of page markers, no message'}) ${same ? 'kept' : 'changed'}`);
    line(rec.seen.length === n, `unreadable no reading server: ${rec.seen.length - n} request(s) reached a server`);

    // A readable public PPM: exactly plan 66's request.
    await setServer(page, srv.base, srv.token);
    n = rec.seen.length;
    const before = bodies.length;
    r = await readOutcome(page, ROCKSTEP, 120000);
    got = rec.seen.slice(n);
    const body = bodies.slice(before)[0] || '';
    // Plan 69 (D-38 sends the whole text on the server path): the body is { prompt } with corpus(good, Infinity).text in
    // place of corpus(good, LIMIT).text; for a text under the budget the two are identical (this PPM is just over it).
    const want = JSON.stringify({ prompt: `${instr}\n\nDOCUMENTS:\n${r.whole}` });
    line(got.length === 1 && !got[0].pdfs && body === want, `unreadable readable PPM: the body is { prompt } byte for byte, the whole text on the server path (${body.length} characters, ${body === want ? 'identical' : 'different'})`);
    line(r.step === 'review' && r.method === 'auto', `unreadable readable PPM: review reached, method ${r.method || 'none'}`);
  } finally {
    await setServer(page, '', '');
    await srv.close();
  }
}

/* ---------- Part unreadable, continued: read whole (D-38) ---------- */
/** JSON with every object's keys sorted, so two objects compare by content. */
const canonJson = (v) => (Array.isArray(v) ? '[' + v.map(canonJson).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonJson(v[k])).join(',') + '}' : JSON.stringify(v));
/** Synthetic answers with conflicting and overlapping values (fictional; no document text), and their expected merge. */
const MERGE_IN = [
  {
    offering: { name: 'Larkspur Ridge Income Fund, LP', shortName: '', type: 'Real Estate', minimum: null, currency: 'USD' },
    structure: { gp: null, feeders: [{ name: 'Larkspur Offshore', domicile: 'Cayman', for: null }], sidePockets: { allowed: false, maxPct: null } },
    classes: [{ name: 'Class A', mgmtFee: 1.5 }],
    fees: { mgmtFee: 1.5, carry: null, other: ['Acquisition fee 1%'] },
    waterfall: { type: null, tiers: [{ kind: 'roc' }] },
    providers: { auditor: null, others: [{ role: 'escrow agent', name: 'Harbor Escrow' }] },
    investorTerms: [{ label: 'Minimum', value: '$25,000' }],
    update: '',
    sources: { 'offering.name': 'A one [p. 1]', 'fees.mgmtFee': 'A two [p. 3]' },
    confidence: { 'offering.name': 'high', 'fees.mgmtFee': 'medium' },
    notes: ['Key person: J. Doe']
  },
  {
    offering: { name: 'Larkspur Ridge Fund', minimum: 25000, currency: 'EUR' },
    structure: { gp: 'Larkspur GP, LLC', feeders: [{ name: 'larkspur  offshore', domicile: 'BVI' }, { name: 'Larkspur Onshore' }], sidePockets: { allowed: true, maxPct: 10 } },
    classes: [{ name: 'class a', mgmtFee: 2 }, { name: 'Class B', mgmtFee: 1 }],
    fees: { mgmtFee: 2, carry: 20, other: ['acquisition  fee 1%', 'Disposition fee 0.5%'] },
    waterfall: { type: 'european', tiers: [{ kind: 'roc' }, { kind: 'pref', rate: 8 }] },
    providers: { auditor: 'Fictional Audit LLP', others: [{ role: 'lender', name: 'harbor escrow' }] },
    investorTerms: [{ label: 'minimum', value: '25k' }, { label: 'Target  return', value: '12%' }],
    update: 'An income fund.',
    sources: { 'offering.name': 'B one', 'offering.minimum': 'B two [p. 7]', 'fees.carry': 'B three [p. 8]', 'structure.gp': 'B four', 'classes[1].mgmtFee': 'B five' },
    confidence: { 'offering.minimum': 'high', 'fees.carry': 'high', 'structure.gp': 'low' },
    notes: ['key person:  j. doe', 'Clawback applies']
  },
  { offering: { shortName: 'Larkspur' }, update: 'Ignored', notes: [], sources: { 'offering.shortName': 'C one', 'classes[1].mgmtFee': 'C two' }, confidence: {} }
];
const MERGE_OUT = {
  offering: { name: 'Larkspur Ridge Income Fund, LP', shortName: 'Larkspur', type: 'Real Estate', minimum: 25000, currency: 'USD' },
  structure: { gp: 'Larkspur GP, LLC', feeders: [{ name: 'Larkspur Offshore', domicile: 'Cayman', for: null }, { name: 'Larkspur Onshore' }], sidePockets: { allowed: true, maxPct: 10 } },
  classes: [{ name: 'Class A', mgmtFee: 1.5 }, { name: 'Class B', mgmtFee: 1 }],
  fees: { mgmtFee: 1.5, carry: 20, other: ['Acquisition fee 1%', 'Disposition fee 0.5%'] },
  waterfall: { type: 'european', tiers: [{ kind: 'roc' }, { kind: 'pref', rate: 8 }] },
  providers: { auditor: 'Fictional Audit LLP', others: [{ role: 'escrow agent', name: 'Harbor Escrow' }] },
  investorTerms: [{ label: 'Minimum', value: '$25,000' }, { label: 'Target  return', value: '12%' }],
  update: 'An income fund.',
  notes: ['Key person: J. Doe', 'Clawback applies'],
  sources: { 'offering.name': 'A one [p. 1]', 'fees.mgmtFee': 'A two [p. 3]', 'offering.minimum': 'B two [p. 7]', 'fees.carry': 'B three [p. 8]', 'structure.gp': 'B four', 'classes[1].mgmtFee': 'B five', 'offering.shortName': 'C one' },
  confidence: { 'offering.name': 'high', 'fees.mgmtFee': 'medium', 'offering.minimum': 'high', 'fees.carry': 'high', 'structure.gp': 'low' }
};
/** Pages and text of one sent PDF (pdfinfo, pdftotext), through a file in OUT68 that is removed at once. */
function pdfFacts(b64, first, last) {
  const f = path.join(OUT68, 'range-' + crypto.randomBytes(4).toString('hex') + '.pdf');
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  try {
    const pages = Number((/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [f], { encoding: 'utf8' })) || [])[1] || 0);
    const text = execFileSync('pdftotext', ['-q', f, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ').trim();
    return { pages, text };
  } finally {
    fs.rmSync(f, { force: true });
  }
}
const brokenText = (a, b) => execFileSync('pdftotext', ['-q', '-f', String(a), '-l', String(b), path.join(OUT68, 'broken.pdf'), '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ').trim();
const rangeOf = (prompt, of) => {
  const m = /\(pages (\d+) to (\d+) of (\d+)/.exec(prompt) || /test spend cap: pages (1) to (\d+) of (\d+)/.exec(prompt);
  return m ? [Number(m[1]), Number(m[2])] : [1, of];
};
/** Every page 1..M covered exactly once by the ranges. */
const coversOnce = (ranges, M) => {
  const seen = new Array(M + 1).fill(0);
  ranges.forEach(([a, b]) => {
    for (let i = a; i <= b; i++) seen[i] = (seen[i] || 0) + 1;
  });
  return seen.slice(1).length === M && seen.slice(1).every((x) => x === 1);
};
async function partWhole(h, page) {
  const broken = path.join(OUT68, 'broken.pdf');
  // The deterministic merge, on synthetic answers.
  const merged = await page.evaluate((ins) => (typeof window.CVPortal.intake.mergeAnswers === 'function' ? window.CVPortal.intake.mergeAnswers(ins) : null), MERGE_IN);
  line(!!merged && canonJson(merged) === canonJson(MERGE_OUT), `whole mergeAnswers gives exactly the expected object on 3 synthetic answers (${merged ? (canonJson(merged) === canonJson(MERGE_OUT) ? 'same' : 'different') : 'missing'})`);
  const defaults = await page.evaluate(() => ({ range: window.CVPortal.intake.RANGE_PAGES, limit: window.CVPortal.intake.TEST_PAGE_LIMIT === undefined }));
  line(defaults.range === 600 && defaults.limit, `whole RANGE_PAGES ${defaults.range} by default (600 expected), TEST_PAGE_LIMIT ${defaults.limit ? 'unset' : 'set'}`);

  // Three ranges of 5, 5 and 2 pages, each its own request and answer; the merged answer reaches review through normalize.
  const parts = [FUND, { fees: { carry: 25, other: ['Range two fee'] }, notes: ['Range two note'] }, { investorTerms: [{ label: 'Range three term', value: 'Yes' }] }];
  let rec = recordingIntake((i) => parts[i] || FUND);
  let srv = await portalServer(rec);
  try {
    await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    await page.evaluate(() => (window.CVPortal.intake.RANGE_PAGES = 5));
    const r = await readOutcome(page, broken);
    const sent = rec.seen.map((x) => ({ ranges: rangeOf(x.prompt, 12), pages: x.pdfs ? x.pdfs.map((p) => p.pages) : [], of: x.pdfs && x.pdfs[0] ? x.pdfs[0].of : 0, facts: x.pdfs && x.pdfs[0] ? pdfFacts(x.pdfs[0].data) : null, prompt: x.prompt }));
    const ranges = sent.map((x) => x.ranges);
    line(sent.length === 3 && JSON.stringify(ranges) === '[[1,5],[6,10],[11,12]]', `whole RANGE_PAGES 5: ${sent.length} requests, pages ${ranges.map((x) => x.join(' to ')).join(', ')}`);
    line(sent.every((x) => x.pages.length === 1 && x.of === 12 && x.pages[0] === x.ranges[1] - x.ranges[0] + 1), `whole each request carries one PDF of its range's page count, of 12 (${sent.map((x) => x.pages.join('+')).join(', ')})`);
    const exact = sent.filter((x) => x.facts && x.facts.pages === x.ranges[1] - x.ranges[0] + 1 && x.facts.text === brokenText(x.ranges[0], x.ranges[1])).length;
    line(exact === sent.length && sent.length === 3, `whole each sent PDF is a new PDF of exactly its pages (${exact}/${sent.length} by page count and text layer)`);
    const head = sent[0] ? sent[0].prompt.slice(0, sent[0].prompt.indexOf('\n\nDOCUMENTS:\n')) : '';
    line(!!head && sent.every((x) => x.prompt.startsWith(head + '\n\nDOCUMENTS:\n') && x.prompt.indexOf(`(pages ${x.ranges[0]} to ${x.ranges[1]} of 12)`) >= 0), 'whole each request has the same instructions and a line naming its range');
    line(coversOnce(ranges, 12), 'whole the ranges cover every page once; no page dropped');
    const want = await page.evaluate((ps) => window.CVPortal.intake.normalize(window.CVPortal.intake.mergeAnswers(ps)), parts);
    line(r.step === 'review' && r.method === 'auto' && JSON.stringify(r.profile) === JSON.stringify(want), `whole the merged answer reaches review through normalize unchanged (method ${r.method || 'none'})`);
    const most = Math.max(0, ...r.progress.map((t) => Number((/([\d,]+) characters/.exec(t) || [0, '0'])[1].replace(/,/g, ''))));
    const all = parts.reduce((n, p) => n + JSON.stringify(p).length, 0);
    line(most === all, `whole the progress line kept counting across the requests (${most} of ${all} characters)`);
  } finally {
    await page.evaluate(() => (window.CVPortal.intake.RANGE_PAGES = 600));
    await srv.close();
  }

  // A range whose encoded request is over the byte limit is halved until it fits (the limit lowered for the test).
  rec = recordingIntake();
  srv = await portalServer(rec);
  try {
    const bodies = await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    const limit = Math.round(fs.readFileSync(broken).toString('base64').length * 0.7);
    await page.evaluate((n) => (window.CVPortal.intake.RANGE_BYTES = n), limit);
    const r = await readOutcome(page, broken);
    const ranges = rec.seen.map((x) => rangeOf(x.prompt, 12));
    line(rec.seen.length >= 2 && bodies.every((b) => b.length <= limit) && coversOnce(ranges, 12) && r.method === 'auto', `whole a request over the byte limit is halved: ${rec.seen.length} requests (${ranges.map((x) => x.join(' to ')).join(', ')}), every body within ${limit} characters, no failure`);
  } finally {
    await page.evaluate(() => (window.CVPortal.intake.RANGE_BYTES = 31 * 1024 * 1024));
    await srv.close();
  }

  // A range the server answers 413 (over 900000 counted tokens) is halved and sent again.
  rec = recordingIntake(null, async (prompt, pdfs) => (pdfs || []).reduce((a, p) => a + p.pages * 100000, 0));
  srv = await portalServer(rec);
  try {
    const bodies = await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    const r = await readOutcome(page, broken);
    const ranges = rec.seen.map((x) => rangeOf(x.prompt, 12));
    line(bodies.length === 3 && JSON.stringify(ranges) === '[[1,6],[7,12]]' && r.method === 'auto' && r.profile.offering.name === FUND.offering.name, `whole a 413 (1200000 counted tokens) is halved and sent again: ${bodies.length} requests, read ${ranges.map((x) => x.join(' to ')).join(', ')}, method ${r.method || 'none'}`);
  } finally {
    await srv.close();
  }

  // Any range that fails makes the whole reading fail: the built-in result and today's note.
  rec = recordingIntake((i) => (i === 1 ? null : FUND));
  srv = await portalServer(rec);
  try {
    await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    await page.evaluate(() => (window.CVPortal.intake.RANGE_PAGES = 5));
    const r = await readOutcome(page, broken);
    const notes = r.profile ? r.profile.notes.slice() : [];
    const first = notes.shift() || '';
    const same = !!r.profile && JSON.stringify(Object.assign({}, r.profile, { notes })) === JSON.stringify(r.rules);
    line(rec.seen.length === 2 && r.method === 'rules' && same && first === WHY.other + 'The built-in reader was used instead.', `whole a failing second range: ${rec.seen.length} requests, method ${r.method || 'none'}, built-in result ${same ? 'kept' : 'changed'}, note "${first.replace(FALLBACK_NOTE, '').trim()}"`);
  } finally {
    await page.evaluate(() => (window.CVPortal.intake.RANGE_PAGES = 600));
    await setServer(page, '', '');
    await srv.close();
  }
}

/* ---------- Plan 01.4-69 (D-38): silent retries, whole text, per-page readability ---------- */
const OUT69 = path.join(SCRATCH, 'edgar/measure/out-69');
const TRIM_NOTE = '(long documents: the cover pages and every passage that mentions terms were read)';
let firstTry = false;
/**
 * A stand-in reading server for the intake (CORS open): answers POST /v1/intake with the given statuses in turn, then a
 * 200 stream of the fictional fund; attempts() counts the requests. opts.port: listen on that port.
 */
async function scriptedIntake(statuses, opts) {
  const queue = statuses.slice();
  let attempts = 0;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    req.resume();
    req.on('end', () => {
      attempts++;
      const status = queue.length ? queue.shift() : 200;
      if (status !== 200) {
        res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, cors));
        return res.end(JSON.stringify({ ok: false, reason: 'x' }));
      }
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/x-ndjson' }, cors));
      res.end(JSON.stringify({ t: JSON.stringify(FUND) }) + '\n' + JSON.stringify({ ok: true, json: FUND }) + '\n');
    });
  });
  await new Promise((r) => server.listen((opts && opts.port) || 0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, attempts: () => attempts, close: () => new Promise((r) => (server.closeAllConnections(), server.close(r))) };
}
async function partRetry(h, page) {
  const want = await page.evaluate((f) => window.CVPortal.intake.normalize(f), FUND);
  const read = (name, r, attempts, n) => line(r.method === 'auto' && JSON.stringify(r.profile) === JSON.stringify(want) && attempts === n, `retry ${name} then 200: ${attempts} attempts (${n} expected), the fictional fund on review, method ${r.method}, no note added`);
  for (const [name, statuses] of [
    ['503, 503', [503, 503]],
    ['429', [429]]
  ]) {
    const srv = await scriptedIntake(statuses);
    try {
      await allow(h, srv.base);
      await setServer(page, srv.base, 'check-token');
      const r = await readOnce(page);
      read(name, r, srv.attempts(), statuses.length + 1);
    } finally {
      await srv.close();
    }
  }
  // A refused connection: the port opens only once the first attempt has been refused.
  {
    const port = Number((await closedBase()).split(':').pop());
    const url = `http://127.0.0.1:${port}`;
    firstTry = false;
    await allow(h, url, (route) => {
      if (route.request().method() === 'POST') firstTry = true;
      return route.continue();
    });
    await setServer(page, url, 'check-token');
    let srv = null;
    const opener = (async () => {
      for (let k = 0; k < 600 && !firstTry; k++) await pause(100);
      srv = await scriptedIntake([], { port });
    })();
    const r = await readOnce(page);
    await opener;
    read('a refused connection', r, srv ? srv.attempts() + 1 : 0, 2);
    if (srv) await srv.close();
  }
  // Every attempt failing: today's fallback after exactly 3 attempts. 400, 401 and 402: sent once.
  for (const [name, statuses, n, why] of [
    ['503 on every attempt', [503, 503, 503, 503], 3, WHY.other],
    ['400', [400], 1, WHY.other],
    ['401', [401], 1, WHY.denied],
    ['402', [402], 1, WHY.other]
  ]) {
    const srv = await scriptedIntake(statuses);
    try {
      await allow(h, srv.base);
      await setServer(page, srv.base, 'check-token');
      const r = await readOnce(page);
      const notes = r.profile.notes.slice();
      const first = notes.shift() || '';
      const same = JSON.stringify(Object.assign({}, r.profile, { notes })) === JSON.stringify(r.rules);
      line(srv.attempts() === n && r.method === 'rules' && same && first === why + 'The built-in reader was used instead.', `retry ${name}: ${srv.attempts()} attempt(s) (${n} expected), then the built-in result with today's note "${first.replace(FALLBACK_NOTE, '').trim()}"`);
    } finally {
      await srv.close();
    }
  }
  // A 413 is never sent again unchanged: the text is split at its page markers and the parts sent instead.
  {
    const srv = await scriptedIntake([413]);
    const bodies = [];
    try {
      await allow(h, srv.base, (route) => {
        if (route.request().method() === 'POST') bodies.push(route.request().postData() || '');
        return route.continue();
      });
      await setServer(page, srv.base, 'check-token');
      const r = await readOnce(page);
      const again = bodies.slice(1).some((b) => b === bodies[0]);
      line(bodies.length >= 2 && !again && r.method === 'auto', `retry 413: ${bodies.length} requests, the first never sent again unchanged (${again ? 'resent' : 'split'}), method ${r.method}`);
    } finally {
      await srv.close();
    }
  }
  await setServer(page, '', '');
}

/** The first public PPM whose extracted text is over 200,000 characters (sorted by folder name), or null. */
async function longPpm(page) {
  const dirs = fs
    .readdirSync(PUBLIC)
    .filter((d) => /^PPM_/.test(d) && fs.existsSync(path.join(PUBLIC, d, 'doc.pdf')))
    .sort();
  for (const d of dirs) {
    const f = path.join(PUBLIC, d, 'doc.pdf');
    const chars = await page.evaluate(
      async ({ b64, name }) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return (await window.CVPortal.intake.readFile(new File([bin], name, { type: 'application/pdf' }))).text.length;
      },
      { b64: fs.readFileSync(f).toString('base64'), name: 'doc.pdf' }
    );
    if (chars > 200000) return { file: f, chars };
  }
  return null;
}
/** The page markers [p. N] of each document named in a prompt, as { name: [N, ...] }. */
function pagesIn(prompt) {
  const out = {};
  const docs = prompt.split(/^=== Document: /m).slice(1);
  docs.forEach((d) => {
    const name = d.slice(0, d.indexOf(' ('));
    const seen = (d.match(/^\[p\. (\d+)\]$/gm) || []).map((m) => Number(/\d+/.exec(m)[0]));
    out[name] = (out[name] || []).concat(seen);
  });
  return out;
}
async function partWholeText(h, page) {
  const doc = await longPpm(page);
  if (!line(!!doc, `wholetext a public PPM with more than 200,000 characters of text: ${doc ? path.basename(path.dirname(doc.file)) + ' (' + doc.chars + ' characters)' : 'none found'}`)) return;
  // With a reading server: one prompt of instructions, a blank line, DOCUMENTS: and the whole text.
  let rec = recordingIntake();
  let srv = await portalServer(rec);
  try {
    await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    const r = await readOutcome(page, doc.file, 180000);
    const p = (rec.seen[0] || {}).prompt || '';
    const instr = p.slice(0, Math.max(0, p.indexOf('\n\nDOCUMENTS:\n')));
    line(rec.seen.length === 1 && !rec.seen[0].pdfs && instr.startsWith('You are setting up a private investment fund') && p === `${instr}\n\nDOCUMENTS:\n${r.whole}` && r.whole.length > 200000 && r.corp.length < r.whole.length, `wholetext the prompt is the instructions, DOCUMENTS: and corpus(good, Infinity).text (${r.whole.length} characters; the trimmed corpus would be ${r.corp.length})`);
    line(r.step === 'review' && r.method === 'auto' && !r.trimmed && !r.pageText.includes(TRIM_NOTE), `wholetext the review screen shows no trimming note (trimmed ${r.trimmed})`);
  } finally {
    await srv.close();
  }
  // Too large for one request: split by document, then by halves at the page markers; every page sent once, merged.
  // Two documents under names of their own (both public files are called doc.pdf), copied into out-69.
  fs.mkdirSync(OUT69, { recursive: true });
  const two = [[doc.file, 'long-ppm.pdf'], [ROCKSTEP, 'rockstep-ppm.pdf']].map(([f, n]) => {
    const to = path.join(OUT69, n);
    if (!fs.existsSync(to)) fs.copyFileSync(f, to);
    return to;
  });
  const T = 215000;
  const answers = [FUND, { fees: { carry: 25, other: ['Part two fee'] }, notes: ['Part two note'] }, { investorTerms: [{ label: 'Part three term', value: 'Yes' }] }];
  rec = recordingIntake((i) => answers[i] || { notes: ['Part ' + (i + 1)] }, async (prompt) => (prompt.length > T ? 950000 : 1000));
  srv = await portalServer(rec);
  try {
    const bodies = await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    const r = await readOutcome(page, two, 240000);
    const names = r.names;
    const sent = {};
    rec.seen.forEach((x) => Object.entries(pagesIn(x.prompt)).forEach(([n, ps]) => (sent[n] = (sent[n] || []).concat(ps))));
    const once = names.every((n, i) => {
      const N = r.docs[i].pages;
      const ps = (sent[n] || []).slice().sort((a, b) => a - b);
      return ps.length === N && ps.every((p, k) => p === k + 1);
    });
    line(bodies.length > rec.seen.length && rec.seen.length >= 3 && rec.seen.every((x) => x.prompt.length <= T) && once, `wholetext too large for one request (over ${T} characters answered 413): ${bodies.length} requests, ${rec.seen.length} read; every page of ${names.length} documents sent exactly once: ${once ? 'yes' : 'no'}`);
    const merged = await page.evaluate((n) => {
      const I = window.CVPortal.intake;
      return I.normalize(I.mergeAnswers(n));
    }, rec.seen.map((x, i) => answers[i] || { notes: ['Part ' + (i + 1)] }));
    line(r.step === 'review' && r.method === 'auto' && JSON.stringify(r.profile) === JSON.stringify(merged), `wholetext the ${rec.seen.length} answers merged with mergeAnswers reach review (method ${r.method || 'none'})`);
  } finally {
    await srv.close();
  }
  // No reading server: the built-in reader gets exactly today's trimmed corpus.
  await setServer(page, '', '');
  const r = await readOutcome(page, doc.file, 180000);
  line(r.method === 'rules' && r.trimmed && JSON.stringify(r.profile) === JSON.stringify(r.rules) && r.corp.length < r.whole.length, `wholetext no reading server: the built-in reader read today's trimmed corpus(good, LIMIT) (${r.corp.length} characters), trimmed ${r.trimmed}`);
}

async function partMixedPages(h, page) {
  fs.mkdirSync(OUT69, { recursive: true });
  const mixed = path.join(OUT69, 'mixed.pdf');
  const PP = require('./picture-pdf.js');
  if (!fs.existsSync(mixed)) await PP.make({ input: ROCKSTEP, output: mixed, last: 20, only: [5, 6, 15] }, page);
  const scores = await page.evaluate(
    async ({ a, b }) => {
      const I = window.CVPortal.intake;
      const read = async (b64) => (await I.readFile(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'x.pdf', { type: 'application/pdf' }))).text;
      const out = [];
      for (const b64 of [a, b]) {
        const pages = I.pageTexts(await read(b64));
        const flags = I.unreadablePages(pages);
        out.push(pages.map((t, i) => ({ page: i + 1, share: I.unreadableShare(t), fails: flags[i] })));
      }
      return out;
    },
    { a: fs.readFileSync(mixed).toString('base64'), b: fs.readFileSync(ROCKSTEP).toString('base64') }
  );
  const [mx, rs] = scores;
  const T = await page.evaluate(() => window.CVPortal.intake.UNREADABLE_BELOW);
  console.log('      per-page shares, mixed PDF: ' + mx.map((p) => `${p.page}:${p.share.toFixed(3)}${p.fails ? '*' : ''}`).join(' '));
  console.log(`      per-page shares, unchanged PPM (${rs.length} pages): lowest ${Math.min(...rs.map((p) => p.share)).toFixed(3)}, failing pages ${rs.filter((p) => p.fails).length}`);
  const pics = [5, 6, 15];
  line(mx.length === 20 && mx.every((p) => (pics.includes(p.page) ? p.fails && p.share < T : !p.fails && p.share >= T)), `mixedpages the picture pages 5, 6 and 15 are under the threshold ${T} and every other page above it (${mx.filter((p) => p.fails).map((p) => p.page).join(', ')} fail)`);
  line(rs.every((p) => !p.fails), `mixedpages every page of the unchanged PPM passes (${rs.filter((p) => !p.fails).length}/${rs.length})`);
  const rec = recordingIntake();
  const srv = await portalServer(rec);
  try {
    await captureBodies(h, srv);
    await setServer(page, srv.base, srv.token);
    const r = await readOutcome(page, mixed, 120000);
    const req = rec.seen[0] || {};
    const pdfs = req.pdfs || [];
    line(rec.seen.length === 1 && pdfs.length === 1 && pdfs[0].pages === 20 && pdfs[0].of === 20 && sha(Buffer.from(pdfs[0].data, 'base64')) === sha(fs.readFileSync(mixed)) && (req.prompt || '').endsWith(`=== Document: mixed.pdf (20 pages) === ${ATTACHED}`), `mixedpages the mixed PDF is sent on the PDF path with every page (${pdfs.length} PDF, ${pdfs[0] ? pdfs[0].pages : 0} pages), not as text`);
    line(r.step === 'review' && r.method === 'auto', `mixedpages review reached, method ${r.method || 'none'}`);
    // The unchanged PPM (every page passes): the text path, whole (D-38; under the budget identical to D-36's prompt).
    const n = rec.seen.length;
    const r2 = await readOutcome(page, ROCKSTEP, 120000);
    const q = rec.seen[n] || {};
    line(rec.seen.length === n + 1 && !q.pdfs && (q.prompt || '').endsWith('\n\nDOCUMENTS:\n' + r2.whole), 'mixedpages the unchanged PPM sends the text-path prompt (instructions, DOCUMENTS: and its whole text), no PDF');
  } finally {
    await setServer(page, '', '');
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
/** What a request body sent, in numbers only: whether it carried PDFs, each PDF's page range and the document's pages. */
function sentOf(text) {
  let b = null;
  try {
    b = JSON.parse(text);
  } catch (e) {
    b = null;
  }
  const pdfs = b && Array.isArray(b.pdfs) ? b.pdfs : [];
  const prompt = b && typeof b.prompt === 'string' ? b.prompt : '';
  return { pdf: pdfs.length > 0, pages: pdfs.reduce((a, p) => a + (Number(p.pages) || 0), 0), of: pdfs[0] ? Number(pdfs[0].of) || null : null, range: pdfs[0] ? rangeOf(prompt, Number(pdfs[0].of) || 0) : null, cap: /test spend cap: pages 1 to (\d+) of \d+/.test(prompt) };
}
/** The PDF uploaded on a fresh intake against srv, every /v1/intake answer captured unchanged; files written to dir. */
async function measureRun(h, page, srv, dir, readLog, M, maxTokens, testPageLimit) {
  fs.mkdirSync(dir, { recursive: true });
  const captured = [];
  await allow(h, srv.base, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && /\/v1\/intake$/.test(req.url())) {
      const entry = { sent: sentOf(req.postData() || ''), status: 0, body: '' };
      captured.push(entry);
      const resp = await route.fetch({ timeout: 700000 });
      entry.body = await resp.text();
      entry.status = resp.status();
      return route.fulfill({ response: resp, body: entry.body });
    }
    return route.continue();
  });
  await setServer(page, srv.base, srv.token);
  await page.evaluate((n) => {
    if (n) window.CVPortal.intake.TEST_PAGE_LIMIT = n;
    else delete window.CVPortal.intake.TEST_PAGE_LIMIT;
  }, testPageLimit || 0);
  const before = readRows(readLog);
  const t0 = Date.now();
  let r = null;
  try {
    r = await readOutcome(page, DOC, 1800000);
  } catch (e) {
    r = null;
  }
  await page.evaluate(() => delete window.CVPortal.intake.TEST_PAGE_LIMIT);
  const seconds = Math.round((Date.now() - t0) / 100) / 10;
  const rows = readRows(readLog);
  const row = rows.length > before.length ? rows[rows.length - 1] : null;
  const spentOf = (list) => list.reduce((a, x) => a + M.costOf(x.usage, x.model).usd, 0);
  const lastReq = captured.length ? captured[captured.length - 1] : null;
  let last = null;
  if (lastReq && lastReq.status === 200) {
    const ls = lastReq.body.split('\n').filter((l) => l.trim());
    try {
      last = ls.length ? JSON.parse(ls[ls.length - 1]) : null;
    } catch (e) {
      last = null;
    }
    if (last && typeof last.ok !== 'boolean') last = null;
  }
  // The answers of every request, in order (one per page range); raw.json is the one answer, or the list when split.
  const answers = captured.filter((c) => c.status === 200).map((c) => {
    const ls = c.body.split('\n').filter((l) => l.trim());
    try {
      const m = JSON.parse(ls[ls.length - 1]);
      return m && m.ok ? m.json : null;
    } catch (e) {
      return null;
    }
  });
  const noText = !!r && r.step === 'upload' && r.error === NO_TEXT;
  const read = !!r && r.step === 'review' && r.method === 'auto' && answers.length > 0 && answers.every(Boolean);
  const raw = read ? (answers.length === 1 ? answers[0] : answers) : null;
  const capped = captured.some((c) => c.status === 402);
  const outcome = !r || noText ? 'failed' : capped ? 'cap' : read ? 'read' : r.method === 'rules' ? 'fallback' : 'failed';
  const why = noText ? 'no-readable-text' : !r ? 'the review step was not reached' : !lastReq ? 'no request reached the reading server' : lastReq.status !== 200 ? 'http ' + lastReq.status : last ? (last.ok ? '' : String(last.reason || '')) : 'no last line';
  const note = r && r.profile && r.profile.notes && r.profile.notes[0] ? String(r.profile.notes[0]) : '';
  const pdfReqs = captured.filter((c) => c.sent.pdf);
  const run = {
    outcome,
    why,
    seconds,
    readingMs: row ? row.ms : null,
    counted: row ? row.counted : null,
    maxTokens,
    model: row ? row.model : '',
    usage: row ? row.usage : null,
    cost: row ? row.cost : 0,
    spent: spentOf(rows),
    method: r ? r.method : '',
    firstNote: KNOWN_NOTE.test(note) ? note : '',
    trimmed: r ? r.trimmed : null,
    sent: !captured.length ? null : pdfReqs.length ? 'pdf' : 'text',
    ranges: pdfReqs.map((c) => c.sent.range),
    pdfOf: pdfReqs.length ? pdfReqs[0].sent.of : null,
    testPageLimit: testPageLimit || null,
    requests: captured.length
  };
  fs.writeFileSync(path.join(dir, 'raw.json'), JSON.stringify(raw, null, 2));
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(r && r.profile ? r.profile : null, null, 2));
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  // A refusal that cost nothing: refused for the cap, nothing added to the folder's spend.
  const free = capped && Math.abs(spentOf(rows) - spentOf(before)) < 1e-12;
  return { run, raw, r, row, free, refused: capped ? pdfReqs.concat(captured.filter((c) => !c.sent.pdf)).find((c) => c.status === 402) : null };
}
/**
 * The test spend cap (D-38: production never cuts a document). After a refusal that cost nothing, first the output limit
 * is lowered to what fits what remains of the cap with every page: the refusal's counted tokens scaled to all pages,
 * priced at model.mjs's DEAREST prices, times 0.95, used only when that is at least 16000. Only when even 16000 does not
 * fit is the test-only page limit set, to the most pages that fit at 16000. At most 3 attempts; null when nothing fits.
 */
function fitTestCap(M, cap, x) {
  const row = x.row;
  if (!x.free || !row || row.outcome !== 'spend_cap' || typeof row.counted !== 'number' || !x.refused) return null;
  const remaining = Number(cap) - x.run.spent;
  const sentPages = x.refused.sent.pages;
  const of = x.refused.sent.of || 0;
  const allIn = sentPages && of ? (row.counted * of) / sentPages : row.counted;
  const maxTokens = Math.floor((((remaining * 1e6 - allIn * M.DEAREST.input) / M.DEAREST.output) * 0.95));
  if (maxTokens >= 16000) return { maxTokens, testPageLimit: null };
  if (!sentPages || !of) return null;
  const perPage = row.counted / sentPages;
  const pages = Math.floor(((remaining * 1e6 - 16000 * M.DEAREST.output) / M.DEAREST.input / perPage) * 0.95);
  if (pages < 1) return null;
  return { maxTokens: 16000, testPageLimit: Math.min(pages, of) };
}
/** A run, then up to two more fitted to the test cap; the attempts are stated. mk(maxTokens) starts a server. */
async function fittedRun(h, page, mk, dir, readLog, M, cap, maxTokens, tag) {
  const attempts = [];
  let fit = { maxTokens, testPageLimit: null };
  let x = null;
  while (fit && attempts.length < 3) {
    const srv = await mk(fit.maxTokens);
    if (!srv) return { x, attempts, srvFailed: true };
    try {
      x = await measureRun(h, page, srv, dir, readLog, M, fit.maxTokens, fit.testPageLimit);
    } finally {
      await srv.close();
    }
    attempts.push({ maxTokens: fit.maxTokens, testPageLimit: fit.testPageLimit, outcome: x.run.outcome, free: x.free });
    if (x.run.outcome !== 'cap') break;
    fit = fitTestCap(M, cap, x);
  }
  x.run.attempts = attempts;
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(x.run, null, 2));
  const said = attempts.map((a) => `max tokens ${a.maxTokens}${a.testPageLimit ? `, test spend cap: pages 1 to ${a.testPageLimit} of ${x.run.pdfOf}` : ''}: ${a.outcome === 'cap' ? (a.free ? 'refused at no cost' : 'refused') : a.outcome}`);
  console.log(`      measure ${tag} attempts: ${attempts.length} (${said.join('; ')})`);
  if (x.run.testPageLimit) console.log(`      measure ${tag}: test spend cap: pages 1 to ${x.run.testPageLimit} of ${x.run.pdfOf}`);
  return { x, attempts };
}
/** A fake intake for the measure's fake mode: a fake count of 3000 tokens a page, the fictional fund's reply, fake usage. */
function fakeMeasureIntake(budget, maxTokens) {
  const tokens = (prompt, pdfs) => Math.ceil(prompt.length / 4) + (pdfs || []).reduce((a, p) => a + p.pages * 3000, 0);
  return {
    budget,
    maxTokens: () => maxTokens,
    count: async (prompt, pdfs) => tokens(prompt, pdfs),
    available: async () => true,
    async run(prompt, { onText, pdfs }) {
      const text = JSON.stringify(FUND);
      onText(text.slice(0, 40));
      await pause(100);
      onText(text.slice(40));
      return { ok: true, json: JSON.parse(text), reason: '', ms: 150, model: 'fake-model', stopReason: 'end_turn', usage: { input_tokens: tokens(prompt, pdfs), output_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
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
  if (COMBINED) return combinedMeasure(h, page);
  const M = await import(pathToFileURL(path.join(ROOT, 'server/lib/model.mjs')).href);
  fs.mkdirSync(OUT, { recursive: true });
  const say = (tag, x) => `measure ${tag}: outcome ${x.run.outcome}${x.run.why ? ' (' + x.run.why + ')' : ''}, ${x.run.seconds} s, cost $${Number(x.run.cost || 0).toFixed(4)}, ${x.r && x.r.profile ? x.r.filled : 0} terms filled, sent ${x.run.sent || 'nothing'}${x.run.sent === 'pdf' ? ` (ranges ${x.run.ranges.map((g) => g.join(' to ')).join(', ')} of ${x.run.pdfOf})` : ''}`;
  if (FAKE) {
    // The fake cases: a cap that refuses 64000 output tokens but fits a lower limit; a cap where only a page limit fits;
    // and the first folder again with a cap below anything (refused, nothing fits).
    const mkFor = (capValue, log) => (mt) => {
      const env = { CARROWVALE_SPEND_CAP_USD: String(capValue), CARROWVALE_READ_LOG: log, CARROWVALE_READ_MAX_TOKENS: String(mt) };
      return portalServer(fakeMeasureIntake(M.createBudget(env), mt), env);
    };
    const readLog = path.join(OUT, 'read.log');
    const capA = arg('cap') || '2.00';
    const a = (await fittedRun(h, page, mkFor(capA, readLog), OUT, readLog, M, capA, Number(arg('max-tokens') || 64000), 'fake')).x;
    const expected = await page.evaluate((f) => window.CVPortal.intake.normalize(f), FUND);
    const usage = a.row ? a.row.usage : null;
    line(a.run.outcome === 'read', say('fake', a));
    line(a.run.attempts.length === 2 && a.run.attempts[0].outcome === 'cap' && a.run.attempts[0].free && a.run.attempts[1].maxTokens >= 16000 && a.run.attempts[1].maxTokens < 64000 && a.run.testPageLimit === null, `measure fake the cap refused max tokens ${a.run.attempts[0] ? a.run.attempts[0].maxTokens : 0} at no cost; the retry used ${a.run.maxTokens} with every page (test page limit ${a.run.testPageLimit === null ? 'none' : a.run.testPageLimit})`);
    line(a.run.sent === 'pdf' && a.run.pdfOf === 12 && coversOnce(a.run.ranges, 12), `measure fake run.json: sent ${a.run.sent}, ranges ${JSON.stringify(a.run.ranges)}, pdfOf ${a.run.pdfOf}, testPageLimit ${a.run.testPageLimit}`);
    line(!!usage && a.run.cost > 0 && Math.abs(a.run.cost - M.costOf(usage, 'fake-model').usd) < 1e-12, `measure fake usage priced into cost (${usage ? usage.input_tokens + usage.output_tokens : 0} tokens)`);
    line(JSON.stringify(a.raw) === JSON.stringify(FUND), 'measure raw.json equals the fake reply');
    line(JSON.stringify(JSON.parse(fs.readFileSync(path.join(OUT, 'profile.json'), 'utf8'))) === JSON.stringify(expected), 'measure profile.json equals the normalized reply');

    // Only a page limit fits: reported as a test cap, pages 1 to N.
    const pagesDir = path.join(OUT, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    const pagesLog = path.join(pagesDir, 'read.log');
    const b = (await fittedRun(h, page, mkFor('1.00', pagesLog), pagesDir, pagesLog, M, '1.00', 64000, 'fake page limit')).x;
    const n = b.run.testPageLimit;
    line(b.run.outcome === 'read' && b.run.attempts.length === 2 && b.run.maxTokens === 16000 && n > 0 && n < 12 && JSON.stringify(b.run.ranges) === JSON.stringify([[1, n]]), `measure fake page limit: ${b.run.outcome}, max tokens ${b.run.maxTokens}, test spend cap: pages 1 to ${n} of ${b.run.pdfOf}, ranges ${JSON.stringify(b.run.ranges)}`);

    // The first folder again with a cap below the bound: refused before any reading, nothing fits, the built-in result kept.
    const c = (await fittedRun(h, page, mkFor('0.01', readLog), path.join(OUT, 'cap'), readLog, M, '0.01', 64000, 'fake below the cap')).x;
    const notes = c.r && c.r.profile ? c.r.profile.notes.slice() : [];
    const first = notes.shift() || '';
    const same = !!c.r && !!c.r.profile && JSON.stringify(Object.assign({}, c.r.profile, { notes })) === JSON.stringify(c.r.rules);
    line(c.run.outcome === 'cap' && c.run.attempts.length === 1 && same && first === WHY.other + 'The built-in reader was used instead.', say('fake below the cap', c) + (same ? ', built-in profile' : ', profile changed'));
    line(Math.abs(c.run.spent - a.run.cost) < 1e-12, `measure the cap counted the folder's earlier call ($${c.run.spent.toFixed(4)} spent)`);
    return;
  }
  const cap = arg('cap') || '1.00';
  const maxTokens = Number(arg('max-tokens') || 24000);
  const readLog = path.join(OUT, 'read.log');
  let proxy = true;
  let srvOk = true;
  const mk = async (mt) => {
    const s = await spawnServer(OUT, cap, mt, proxy);
    if (!s) srvOk = false;
    return s;
  };
  let out = await fittedRun(h, page, mk, OUT, readLog, M, cap, maxTokens, 'real');
  if (!line(srvOk && !!out.x, 'measure the reading server answered /health with reader true within 20 s')) return;
  let a = out.x;
  const noCall = (x) => x.row && ((['failed', 'timeout'].includes(x.row.outcome) && !x.row.model && !(x.row.usage && x.row.usage.input_tokens)) || (x.row.outcome === 'spend_cap' && x.row.counted === null));
  if ((a.run.outcome === 'fallback' || a.run.outcome === 'cap') && noCall(a)) {
    console.log('measure the network failed before any reading; retried once without the proxy setting');
    proxy = false;
    out = await fittedRun(h, page, mk, OUT, readLog, M, cap, maxTokens, 'real (retry)');
    if (!line(srvOk && !!out.x, 'measure the reading server answered /health with reader true within 20 s (retry)')) return;
    a = out.x;
  }
  console.log(`measure spent in this folder $${a.run.spent.toFixed(4)}, counted ${a.run.counted === null ? 'none' : a.run.counted} tokens`);
  line(a.run.outcome !== 'failed', say('real', a));
}

/* ---------- Plan 01.4-71 (D-44): one upload of a PPM with the subscription agreement inside ---------- */
const OUT71 = path.join(SCRATCH, 'edgar/measure/out-71');
const hitBox = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;
/**
 * server-read.js's fixed rule: the first numbered place as the sponsor's signature, then every place on the last page as
 * the investor's signature (overlapping places once).
 */
function agreementPicks(list) {
  const box = (e) => ({ id: e[0], page: e[1], x0: e[2], y0: e[3], x1: e[4], y1: e[5] });
  const last = Math.max.apply(null, list.map((e) => e[1]));
  const order = [list[0]].concat(list.filter((e) => e[1] === last && e !== list[0])).filter(Boolean);
  const out = [];
  order.forEach((e, k) => {
    const b = box(e);
    if (out.some((o) => o.page === b.page && hitBox(o, b))) return;
    out.push(Object.assign(b, k === 0 ? { kind: 'signature', person: 'sponsor' } : { kind: 'signature', person: 'investor' }));
  });
  return out;
}
/**
 * A fake agreement reader for /v1/read: the fixed rule's picks with fake usage (50000 input, 5000 output tokens), every
 * request recorded. opts.fail: answer unavailable (503) every time; opts.wait: wait that long first (a hang).
 */
function fakeAgreementReader(budget, opts) {
  const o = opts || {};
  const seen = [];
  return {
    seen,
    budget: budget || null,
    maxTokens: () => 64000,
    count: async () => 1000,
    available: async () => true,
    async read(req, ctx) {
      seen.push(req);
      if (o.wait) await new Promise((r) => {
        const t = setTimeout(r, o.wait);
        if (ctx && ctx.signal) ctx.signal.addEventListener('abort', () => (clearTimeout(t), r()), { once: true });
      });
      if (o.fail) return { ok: false, reason: 'unavailable', ms: 5, model: '', usage: { input_tokens: 0, output_tokens: 0 } };
      const chose = agreementPicks(req.list || []);
      return { ok: true, fields: chose.map((c) => ({ id: c.id, kind: c.kind, person: c.person, group: 'all' })), missing: [], ms: 40, model: 'fake-model', stopReason: 'end_turn', usage: { input_tokens: 50000, output_tokens: 5000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
    }
  };
}
/** A PDF's page count (pdfinfo). */
const pdfPageCount = (file) => Number((/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) || [])[1] || 0);
/** One page's text (pdftotext), spacing collapsed. */
const pageTextOf = (file, n) => execFileSync('pdftotext', ['-q', '-f', String(n), '-l', String(n), file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ').trim();
/**
 * The combined flow on the real screens against srv: file(s) uploaded on a fresh intake, Read documents pressed; at review
 * the agreement's pages as found (opts.review may change them); Create the offering pressed (opts.target: apply to that
 * offering instead); the done step, then the background reading awaited. Requests to /v1/intake are captured unchanged
 * (answers) and to /v1/read in numbers only (pages, images). Never prints document text.
 */
async function combinedFlow(h, page, srv, file, opts) {
  const o = opts || {};
  const cap = { intake: [], read: [], readAfterApply: 0 };
  let applied = false;
  await allow(h, srv.base, async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && /\/v1\/intake$/.test(req.url())) {
      const entry = { sent: sentOf(req.postData() || ''), status: 0, body: '' };
      cap.intake.push(entry);
      const resp = await route.fetch({ timeout: 700000 });
      entry.body = await resp.text();
      entry.status = resp.status();
      return route.fulfill({ response: resp, body: entry.body });
    }
    if (req.method() === 'POST' && /\/v1\/read$/.test(req.url())) {
      let b = null;
      try {
        b = JSON.parse(req.postData() || '');
      } catch (e) {
        b = null;
      }
      cap.read.push({ pages: b && Number(b.pages) ? Number(b.pages) : 0, images: b && Array.isArray(b.images) ? b.images.length : 0, range: b && Array.isArray(b.range) ? b.range.slice() : null });
      if (applied) cap.readAfterApply += 1;
    }
    return route.continue();
  });
  await setServer(page, srv.base, srv.token);
  if (o.before) await o.before(page);
  const t0 = Date.now();
  let r = null;
  try {
    r = await readOutcome(page, file, o.timeout || 1800000);
  } catch (e) {
    r = null;
  }
  const ppmSeconds = Math.round((Date.now() - t0) / 100) / 10;
  const answers = cap.intake.filter((c) => c.status === 200).map((c) => {
    const ls = c.body.split('\n').filter((l) => l.trim());
    try {
      const m = JSON.parse(ls[ls.length - 1]);
      return m && m.ok ? m.json : null;
    } catch (e) {
      return null;
    }
  });
  const noText = !!r && r.step === 'upload' && r.error === NO_TEXT;
  const read = !!r && r.step === 'review' && r.method === 'auto' && answers.length > 0 && answers.every(Boolean);
  const capped = cap.intake.some((c) => c.status === 402);
  const outcome = !r || noText ? 'failed' : capped ? 'cap' : read ? 'read' : r.method === 'rules' ? 'fallback' : 'failed';
  const lastReq = cap.intake.length ? cap.intake[cap.intake.length - 1] : null;
  let last = null;
  if (lastReq && lastReq.status === 200) {
    const ls = lastReq.body.split('\n').filter((l) => l.trim());
    try {
      last = ls.length ? JSON.parse(ls[ls.length - 1]) : null;
    } catch (e) {
      last = null;
    }
  }
  const why = noText ? 'no-readable-text' : !r ? 'the review step was not reached' : !lastReq ? 'no request reached the reading server' : lastReq.status !== 200 ? 'http ' + lastReq.status : last && typeof last.ok === 'boolean' ? (last.ok ? '' : String(last.reason || '')) : 'no last line';
  const out = { r, answers, outcome, why, ppmSeconds, cap, read, agreement: null, reviewLine: '', reviewHint: '', panel: false, nameMissing: false, applied: false };
  if (r && r.step === 'review') {
    const rv = await page.evaluate(() => {
      const st = window.CVPortal.state.ui.intake;
      const found = document.getElementById('ika-found');
      const hint = document.getElementById('ika-hint');
      return { agreement: st.agreement ? Object.assign({}, st.agreement) : null, line: found ? found.textContent : '', hint: hint ? hint.textContent : '', panel: !!document.getElementById('ika-use') };
    });
    Object.assign(out, { agreement: rv.agreement, reviewLine: rv.line, reviewHint: rv.hint, panel: rv.panel });
  }
  if (outcome !== 'read' && !o.applyAnyway) return out;
  if (!r || r.step !== 'review') return out;
  if (o.review) await o.review(page);
  // The offering name is the one thing apply asks for: a placeholder through the binder when the reading left it empty.
  out.nameMissing = await page.evaluate(() => {
    const NS = window.CVPortal;
    const st = NS.state.ui.intake;
    if (String(st.profile.offering.name || '').trim()) return false;
    NS.binders.ik('offering.name', 'Measured offering');
    return true;
  });
  if (out.nameMissing) console.log('      combined: nameMissing true (the reading left the offering name empty; a placeholder was entered)');
  if (o.target) await page.evaluate((id) => (window.CVPortal.state.ui.intake.target = id), o.target);
  out.agreementAtApply = await page.evaluate(() => {
    const a = window.CVPortal.state.ui.intake.agreement;
    return a ? Object.assign({}, a) : null;
  });
  out.docsBefore = await page.evaluate(() => (window.CVPortal.state.ws.docs || []).length);
  const t1 = Date.now();
  applied = true;
  out.applied = true;
  await page.click('[data-action=ik-apply]');
  await page.waitForFunction(() => window.CVPortal.state.ui.intake && window.CVPortal.state.ui.intake.step === 'done', null, { timeout: 120000 });
  out.doneMs = Date.now() - t1;
  const oid = await page.evaluate(() => window.CVPortal.state.ui.intake.done);
  out.oid = oid;
  out.atDone = await page.evaluate((oid) => {
    const NS = window.CVPortal;
    const e = NS.intake.agreementReading(oid);
    const o = NS.state.ws.offerings.find((x) => x.id === oid);
    return { state: e ? e.state : null, name: o ? o.name : '', mgmtFee: o && o.accounting ? o.accounting.mgmtFee : null, text: document.getElementById('view').innerText, addButton: !!document.querySelector(`[data-action="es-agreement-new"][data-offering="${oid}"]`), uploadButtons: document.querySelectorAll('#agreement [data-action^="es-agreement"]').length };
  }, oid);
  if (o.atDone) await o.atDone(page, out);
  await page.waitForFunction(
    (oid) => {
      const e = window.CVPortal.intake.agreementReading(oid);
      return !e || e.state !== 'reading';
    },
    oid,
    { timeout: 1800000, polling: 500 }
  );
  out.agreementSeconds = Math.round((Date.now() - t1) / 100) / 10;
  out.after = await page.evaluate((oid) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const o = ws.offerings.find((x) => x.id === oid);
    const e = NS.intake.agreementReading(oid);
    const tpl = NS.esign.subscriptionTemplate(ws, oid);
    const draft = (ws.envelopes || []).find((x) => x.agreementFor === oid && x.status === 'draft');
    const src = tpl || draft || null;
    const fields = src ? src.fields || [] : [];
    const roleOf = (f) => {
      if (f.signerRole) return f.signerRole === 'Investor' ? 'investor' : f.signerRole === 'Sponsor' ? 'sponsor' : 'other';
      const sg = draft ? draft.signers.find((s) => s.id === f.signerId) : null;
      return sg ? (sg.role === 'investor' ? 'investor' : sg.role === 'countersigner' ? 'sponsor' : 'other') : 'other';
    };
    const doc = e && e.docId ? (ws.docs || []).find((d) => d.id === e.docId) : null;
    return {
      name: o ? o.name : '',
      mgmtFee: o && o.accounting ? o.accounting.mgmtFee : null,
      entry: e ? Object.assign({}, e) : null,
      saved: !!tpl,
      tplId: tpl ? tpl.id : null,
      templates: (ws.esignTemplates || []).filter((t) => t.offeringId === oid && t.subscription !== false).length,
      fields: fields.length,
      investor: fields.filter((f) => roleOf(f) === 'investor').length,
      sponsor: fields.filter((f) => roleOf(f) === 'sponsor').length,
      review: src ? NS.placement.reviewCount(src) : 0,
      pages: src ? src.pages : null,
      fieldShape: fields.map((f) => [f.page, f.type, roleOf(f), Math.round(f.x * 1e4), Math.round(f.y * 1e4), Math.round(f.w * 1e4), Math.round(f.h * 1e4)]).sort().map(String),
      doc: doc ? { id: doc.id, offeringDoc: !!doc.offeringDoc, title: doc.title, fileName: doc.fileName, sha256: doc.sha256, hidden: !!doc.hidden } : null,
      docs: (ws.docs || []).length,
      step: NS.state.ui.intake ? NS.state.ui.intake.step : ''
    };
  }, oid);
  if (out.after.doc) {
    out.after.storedSha = await page.evaluate(async (id) => {
      const NS = window.CVPortal;
      const b = await NS.ops.files.get(id);
      return b ? NS.audit.sha256(new Uint8Array(await b.arrayBuffer())) : '';
    }, out.after.doc.id);
  }
  return out;
}
/** The measure in --combined mode (D-44): one PPM with the agreement inside, both readings, result.json and one line. */
async function combinedMeasure(h, page) {
  const M = await import(pathToFileURL(path.join(ROOT, 'server/lib/model.mjs')).href);
  fs.mkdirSync(OUT, { recursive: true });
  const cap = arg('cap') || '6.00';
  const maxTokens = Number(arg('max-tokens') || 64000);
  const readLog = path.join(OUT, 'read.log');
  const before = readRows(readLog);
  let reader = null;
  let x = null;
  const tStart = Date.now();
  if (FAKE) {
    const rg = (arg('range') || '').split('-').map(Number);
    const env = { CARROWVALE_SPEND_CAP_USD: String(cap), CARROWVALE_READ_LOG: readLog, CARROWVALE_READ_MAX_TOKENS: String(maxTokens) };
    const budget = M.createBudget(env);
    const answer = Object.assign({}, FUND, { subscriptionAgreement: rg[0] ? { document: path.basename(DOC), firstPage: rg[0], lastPage: rg[1] } : null });
    const intake = Object.assign(recordingIntake(() => answer), { budget, maxTokens: () => maxTokens });
    reader = fakeAgreementReader(budget);
    const srv = await portalServer(intake, env, reader);
    try {
      x = await combinedFlow(h, page, srv, DOC);
    } finally {
      await srv.close();
    }
  } else {
    // Real mode: server/index.mjs on port 8798 with the key from the inherited environment; one retry without the proxy
    // setting when the network failed before any model call (as partMeasure).
    const noCall = (row) => !!row && ((['failed', 'timeout'].includes(row.outcome) && !row.model && !(row.usage && row.usage.input_tokens)) || (row.outcome === 'spend_cap' && row.counted === null));
    for (const proxy of [true, false]) {
      const srv = await spawnServer(OUT, cap, maxTokens, proxy);
      if (!line(!!srv, 'measure the reading server answered /health with reader true within 20 s' + (proxy ? '' : ' (retry)'))) return;
      const was = readRows(readLog).length;
      try {
        x = await combinedFlow(h, page, srv, DOC);
      } finally {
        await srv.close();
      }
      const fresh = readRows(readLog).slice(was).filter((row) => row.route === 'intake');
      if (proxy && (x.outcome === 'fallback' || x.outcome === 'cap') && fresh.length && noCall(fresh[fresh.length - 1])) {
        console.log('measure the network failed before any reading; retried once without the proxy setting');
        continue;
      }
      break;
    }
  }
  const seconds = Math.round((Date.now() - tStart) / 100) / 10;
  const rows = readRows(readLog);
  const mine = rows.slice(before.length);
  const costIn = (list) => list.reduce((a, row) => a + M.costOf(row.usage, row.model).usd, 0);
  const intakeRows = mine.filter((row) => row.route === 'intake');
  const readRowsOf = mine.filter((row) => row.route === 'read');
  const msIn = (list) => list.reduce((a, row) => a + (Number(row.ms) || 0), 0);
  const firstIntake = intakeRows.find((row) => typeof row.counted === 'number') || intakeRows[0] || null;
  const pdfReqs = x.cap.intake.filter((c) => c.sent.pdf);
  const ag = x.agreementAtApply || x.agreement;
  const e = x.after ? x.after.entry : null;
  const result = {
    range: x.agreement ? { firstPage: x.agreement.foundFirst, lastPage: x.agreement.foundLast, pages: x.agreement.pages } : null,
    reviewLine: x.reviewLine || '',
    ppm: {
      outcome: x.outcome,
      why: x.why,
      method: x.r ? x.r.method : '',
      filled: x.r && x.r.profile ? x.r.filled : 0,
      seconds: x.ppmSeconds,
      readingMs: intakeRows.length ? msIn(intakeRows) : null,
      counted: firstIntake ? firstIntake.counted : null,
      cost: costIn(intakeRows),
      sent: !x.cap.intake.length ? null : pdfReqs.length ? 'pdf' : 'text',
      ranges: pdfReqs.map((c) => c.sent.range),
      pdfOf: pdfReqs.length ? pdfReqs[0].sent.of : null,
      requests: x.cap.intake.length
    },
    agreement: {
      started: !!e,
      state: e ? e.state : 'not started',
      why: e ? e.why || '' : '',
      requests: x.cap.read.length,
      cutPages: x.after && x.after.pages ? x.after.pages : ag && x.applied && e ? ag.lastPage - ag.firstPage + 1 : null,
      images: x.cap.read.reduce((a, q) => a + q.images, 0),
      saved: !!(x.after && x.after.saved),
      fields: x.after ? x.after.fields : 0,
      investor: x.after ? x.after.investor : 0,
      sponsor: x.after ? x.after.sponsor : 0,
      review: x.after ? x.after.review : 0,
      seconds: x.applied ? x.agreementSeconds : null,
      readingMs: readRowsOf.length ? msIn(readRowsOf) : null,
      cost: costIn(readRowsOf)
    },
    cost: costIn(mine),
    spent: costIn(rows),
    cap: Number(cap),
    maxTokens,
    model: (mine.find((row) => row.model) || {}).model || '',
    seconds,
    nameMissing: !!x.nameMissing
  };
  const raw = x.read ? (x.answers.length === 1 ? x.answers[0] : x.answers) : null;
  fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(raw, null, 2));
  fs.writeFileSync(path.join(OUT, 'profile.json'), JSON.stringify(x.r && x.r.profile ? x.r.profile : null, null, 2));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  const usd = (n) => '$' + Number(n || 0).toFixed(4);
  const A = result.agreement;
  const said = `COMBINED: ${result.range ? `range ${result.range.firstPage} to ${result.range.lastPage} of ${result.range.pages}` : 'no subscription agreement found'}; PPM ${result.ppm.outcome}, ${result.ppm.filled} terms filled; agreement ${A.state}, ${A.fields} fields placed (investor ${A.investor}, sponsor ${A.sponsor}, ${A.review} marked for review), saved ${A.saved ? 'yes' : 'no'}; cost ${usd(result.cost)} (PPM ${usd(result.ppm.cost)}, agreement ${usd(A.cost)}) of $${Number(cap).toFixed(2)}; seconds ${seconds} (PPM ${result.ppm.seconds}, agreement ${A.seconds === null ? 0 : A.seconds})`;
  console.log(said);
  if (!FAKE) {
    line(result.ppm.outcome !== 'failed', `measure combined PPM outcome ${result.ppm.outcome}${result.ppm.why ? ' (' + result.ppm.why + ')' : ''}`);
    if (A.started) line(A.state !== 'failed', `measure combined agreement reading ${A.state}${A.why ? ' (' + A.why + ')' : ''}`);
    return;
  }

  // Fake-mode proof: the range came through, the cut has exactly those pages, the reading started by itself with it, and
  // the offering ends with both terms and fields.
  const rg = (arg('range') || '').split('-').map(Number);
  const want = rg[1] - rg[0] + 1;
  line(!!x.agreement && x.agreement.foundFirst === rg[0] && x.agreement.foundLast === rg[1] && x.agreement.name === path.basename(DOC) && x.reviewLine.indexOf(`Subscription agreement found on pages ${rg[0]} to ${rg[1]}`) === 0, `measure combined review: st.agreement ${x.agreement ? `${x.agreement.foundFirst} to ${x.agreement.foundLast} of ${x.agreement.name}` : 'none'}; the screen says "${x.reviewLine.slice(0, 60)}"`);
  line(x.applied && !!x.after && x.after.name === FUND.offering.name && x.after.mgmtFee === FUND.fees.mgmtFee, `measure combined after apply: done step in ${x.doneMs} ms; the offering has the fund's name and management fee ${x.after ? x.after.mgmtFee : 'none'}`);
  const req = reader.seen[0] || null;
  let same = false;
  let pages = 0;
  if (req) {
    const sent = path.join(OUT, 'sent-cut.pdf');
    fs.writeFileSync(sent, Buffer.from(req.pdf, 'base64'));
    pages = pdfPageCount(sent);
    same = pages === want;
    for (let i = 1; same && i <= want; i++) if (pageTextOf(sent, i) !== pageTextOf(DOC, rg[0] - 1 + i)) same = false;
  }
  line(!!req && x.cap.readAfterApply >= 1 && same && Array.isArray(req.images) && req.images.length > 0, `measure combined the reading server received the cut with no action after apply: ${reader.seen.length} request(s), ${pages} pages, page text equal to pages ${rg[0]} to ${rg[1]}: ${same ? 'yes' : 'no'}, ${req && req.images ? req.images.length : 0} pictures`);
  const reqSha = req ? sha(Buffer.from(req.pdf, 'base64')) : '';
  line(!!x.after && !!x.after.doc && x.after.doc.offeringDoc && x.after.storedSha === reqSha && x.after.doc.sha256 === reqSha, `measure combined ws.docs holds the cut (offeringDoc ${x.after && x.after.doc ? x.after.doc.offeringDoc : 'none'}); its stored bytes hash equal to the sent PDF: ${x.after && x.after.storedSha === reqSha ? 'yes' : 'no'}`);
  const nPicks = req ? agreementPicks(req.list || []).length : -1;
  line(!!x.after && x.after.saved && x.after.fields === nPicks && x.after.investor > 0 && x.after.sponsor > 0 && !!e && e.state === 'done' && e.saved === true, `measure combined the agreement is saved: ${x.after ? x.after.fields : 0} fields (the picks: ${nPicks}; investor ${x.after ? x.after.investor : 0}, sponsor ${x.after ? x.after.sponsor : 0}); agreementReading ${e ? e.state : 'none'}, saved ${e ? e.saved : false}`);
  const keys = ['range', 'reviewLine', 'ppm', 'agreement', 'cost', 'spent', 'cap', 'maxTokens', 'model', 'seconds', 'nameMissing'];
  const ppmKeys = ['outcome', 'why', 'method', 'filled', 'seconds', 'readingMs', 'counted', 'cost', 'sent', 'ranges'];
  const agKeys = ['started', 'state', 'why', 'requests', 'cutPages', 'images', 'saved', 'fields', 'investor', 'sponsor', 'review', 'seconds', 'readingMs', 'cost'];
  const written = JSON.parse(fs.readFileSync(path.join(OUT, 'result.json'), 'utf8'));
  const allKeys = keys.every((k) => k in written) && ppmKeys.every((k) => k in written.ppm) && agKeys.every((k) => k in written.agreement);
  const fakeCost = M.costOf({ input_tokens: 1200, output_tokens: 300 }, 'fake-model').usd * intakeRows.length + M.costOf({ input_tokens: 50000, output_tokens: 5000 }, 'fake-model').usd * readRowsOf.filter((row) => row.outcome === 'read').length;
  line(allKeys && intakeRows.length >= 1 && readRowsOf.length >= 1 && Math.abs(written.cost - fakeCost) < 1e-9, `measure combined result.json has every documented field: ${allKeys ? 'yes' : 'no'}; cost $${Number(written.cost).toFixed(4)} = the fake usage priced over both routes ($${fakeCost.toFixed(4)}, ${intakeRows.length} intake and ${readRowsOf.length} read rows)`);
}

(async () => {
  if (PARTS.includes('unchanged')) partUnchanged();
  const browserParts = PARTS.filter((p) => ['api', 'fallback', 'failures', 'unreadable', 'retry', 'wholetext', 'mixedpages', 'measure'].includes(p));
  if (browserParts.length) {
    const h = await browser();
    try {
      const page = await intakePage(h);
      if (PARTS.includes('api')) await partApi(h, page);
      if (PARTS.includes('fallback')) await partFallback(h, page);
      if (PARTS.includes('failures')) await partFailures(h, page);
      if (PARTS.includes('unreadable')) {
        await partUnreadable(h, page);
        await partWhole(h, page);
      }
      if (PARTS.includes('retry')) await partRetry(h, page);
      if (PARTS.includes('wholetext')) await partWholeText(h, page);
      if (PARTS.includes('mixedpages')) await partMixedPages(h, page);
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
