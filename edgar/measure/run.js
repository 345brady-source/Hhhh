#!/usr/bin/env node
/*
 * The measure (Phase 01.4, D-04). Scratch: nothing here is in the repository, and nothing here changes the portal.
 *
 *   NODE_PATH=$(npm root -g) node run.js --root <checkout> --docs <folder | index.json | file.pdf>
 *        [--only id,id] [--port 8971] [--out dir] [--pictures] [--limit 600] [--recycle 8] [--compare older/summary.json]
 *   node run.js --compare-only <older summary.json> <newer summary.json>
 *   node run.js --selftest-offer          (no browser: a made-up row with the offer taken must FAIL offer, exit status 1)
 *   more flags: [--exact] [--final-b] [--heldout-out dir]
 *
 * Phase 01.4-02 (D-13, D-22):
 *   - a document whose editor showed the picture offer is marked "FAIL offer" and the run exits 1 at the end;
 *   - summary.json totals carry p95Seconds, medianSeconds (reading seconds a document) and pictureMedianSeconds
 *     (a document's reading seconds over its picture pages, median over documents with picture pages);
 *   - held-out A documents (../held-out.json) are read like any other, but their results go to <out>/heldout/<id>/
 *     (or --heldout-out) with no picture, no editor screenshot and no compare picture; no held-out row or id appears in
 *     summary.md, summary.json docs or the log; summary.json `heldout` carries their counts only; every held-out file
 *     read or written (the PDF, its candidate cache file, the result folder) gets the read seal back;
 *   - held-out B (../held-out-b.json) prints NOT RUN unless --final-b, and then goes to heldout/ the same way;
 *   - --exact runs exact.py at the end: the held-out A totals gate (builder mode; only when the run read all of A)
 *     and the gold train documents of this run with rows and their gate.
 *
 * Every document goes through the portal's real upload screen as a sponsor (the checkout served on --port, one
 * browser, the signed-in session reused across documents), the offer "Read these pages from their picture" is taken
 * when the portal makes it, and the result is scored with no answer sheet against the printed places measure.py finds
 * in the PDF on its own (see README.md).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const HERE = __dirname;
const SCRATCH = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const mk = (d) => (fs.mkdirSync(d, { recursive: true }), d);
const r1 = (v) => Math.round(v * 10) / 10;

/* ---------- comparing two builds ---------- */
const BETTER_LOW = ['sponsorWork', 'notReady', 'strayOverText', 'strayNoPlace', 'placeNoField', 'overlaps', 'noSignature', 'unreadable', 'consoleErrors', 'timedOut'];
const BETTER_HIGH = ['coverage'];
function compare(oldFile, cur) {
  const old = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
  const L = [`COMPARED WITH ${oldFile} (root ${old.root || '?'}, ${old.when || '?'})`];
  const byId = {};
  (old.docs || []).forEach((d) => (byId[d.id] = d));
  let better = 0, worse = 0;
  const line = (who, k, a, b) => {
    if (a == null || b == null || a === b) return;
    const up = BETTER_HIGH.includes(k) ? b > a : b < a;
    up ? better++ : worse++;
    L.push(`  ${up ? 'BETTER' : 'WORSE '}  ${who}: ${k} ${a} -> ${b}`);
  };
  cur.docs.forEach((d) => {
    const o = byId[d.id];
    if (!o) return L.push(`  NEW     ${d.id}`);
    BETTER_LOW.concat(BETTER_HIGH).forEach((k) => line(d.id, k, o[k], d[k]));
    if (o.fields !== d.fields) L.push(`  changed ${d.id}: fields ${o.fields} -> ${d.fields}`);
  });
  BETTER_LOW.concat(BETTER_HIGH).forEach((k) => line('TOTAL', k, old.totals && old.totals[k], cur.totals[k]));
  L.push(`${better} better, ${worse} worse`);
  return L.join('\n');
}
if (has('--compare-only')) {
  const i = argv.indexOf('--compare-only');
  console.log(compare(argv[i + 1], JSON.parse(fs.readFileSync(argv[i + 2], 'utf8'))));
  process.exit(0);
}

/* ---------- the summary's judgement (pure: also run by --selftest-offer, no browser) ---------- */
const median = (v) => { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : r1((s[m - 1] + s[m]) / 2); };
const p95 = (v) => { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b); return s[Math.max(0, Math.ceil(0.95 * s.length) - 1)]; };
/** D-13: a document whose editor showed the picture offer fails ("FAIL offer"), and the run exits 1 at the end. */
function judgeRows(rows) {
  const failed = [];
  rows.forEach((x) => {
    x.fail = [];
    if (x.offer && x.offer !== 'none') { x.fail.push('offer'); x.readyToSend = false; failed.push(x); }
  });
  return { failed, exitStatus: failed.length ? 1 : 0 };
}
function totalsOf(rows, wallSeconds) {
  const ok = rows.filter((x) => !x.error || x.fields != null);
  const sum = (k) => ok.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  const totals = { documents: rows.length, pages: sum('pages'), textPages: sum('textPages'), picturePages: sum('picturePages'), offersTaken: ok.filter((x) => /^taken/.test(x.offer)).length, offers: ok.filter((x) => x.offer && x.offer !== 'none').length, unreadable: sum('unreadable'), timedOut: sum('timedOut'), fields: sum('fields'), marked: sum('marked'), fillCandidates: sum('fillCandidates'), fillWithField: sum('fillWithField'), strayOverText: sum('strayOverText'), strayNoPlace: sum('strayNoPlace'), placeNoField: sum('placeNoField'), overlaps: sum('overlaps'), noSignature: sum('noSignature'), noSignatureUnknown: ok.filter((x) => x.noSignature === null).length, consoleErrors: sum('consoleErrors'), seconds: wallSeconds };
  totals.sponsorWork = sum('sponsorWork');
  totals.readyToSend = ok.filter((x) => x.readyToSend).length;
  totals.notReady = ok.length - totals.readyToSend;
  totals.coverage = totals.fillCandidates ? r1((100 * totals.fillWithField) / totals.fillCandidates) : null;
  totals.allMarked = totals.fields ? r1((100 * totals.marked) / totals.fields) : 0;
  const secs = ok.filter((x) => x.seconds != null).map((x) => Number(x.seconds));
  totals.p95Seconds = p95(secs); // the reading time a document (upload to editor ready, picture reading included)
  totals.medianSeconds = median(secs);
  // a picture page's reading time: per document with picture pages, its reading seconds over its picture pages
  totals.pictureMedianSeconds = median(ok.filter((x) => x.picturePages > 0 && x.seconds != null).map((x) => r1(Number(x.seconds) / x.picturePages)));
  return totals;
}
/** What the held-out documents add to the run: counts only, never a row (D-22). */
function heldoutCounts(rows) {
  const ok = rows.filter((x) => 'fields' in x);
  return { documents: rows.length, broken: rows.length - ok.length, offers: ok.filter((x) => x.offer && x.offer !== 'none').length, zeroFields: ok.filter((x) => !x.fields).length, unreadable: ok.reduce((a, x) => a + (x.unreadable || 0), 0), timedOut: ok.reduce((a, x) => a + (x.timedOut || 0), 0), noSignature: ok.filter((x) => x.noSignature === 1).length, consoleErrors: ok.reduce((a, x) => a + (x.consoleErrors || 0), 0) };
}
if (has('--selftest-offer')) {
  // one made-up row: the editor showed the picture offer and it was taken; everything else clean
  const row = { id: 'selftest-offer', pages: 2, textPages: 0, picturePages: 2, offer: 'taken', seconds: 4.2, opened: true, unreadable: 0, timedOut: 0, fields: 5, marked: 0, fillCandidates: 5, fillWithField: 5, strayOverText: 0, strayNoPlace: 0, placeNoField: 0, overlaps: 0, noSignature: 0, consoleErrors: 0, sponsorWork: 0, readyToSend: true };
  const clean = Object.assign({}, row, { id: 'selftest-clean', offer: 'none' });
  const j = judgeRows([row, clean]);
  const t = totalsOf([row, clean], 0);
  const ok = j.exitStatus === 1 && row.fail.includes('offer') && row.readyToSend === false && !clean.fail.length && clean.readyToSend === true && t.readyToSend === 1 && t.offers === 1 && t.p95Seconds === 4.2;
  console.log(`made-up row with offer "taken": ${row.fail.length ? 'FAIL ' + row.fail.join(', ') : 'not failed'}, ready to send ${row.readyToSend}; clean row ready ${clean.readyToSend}; run exit status ${j.exitStatus}`);
  console.log(`SELFTEST OFFER: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

/* ---------- options ---------- */
const ROOT = path.resolve(arg('--root', '/home/user/Hhhh'));
const DOCS = path.resolve(arg('--docs', path.join(SCRATCH, 'public-agreements')));
const ONLY = (arg('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const PORT = Number(arg('--port', 8971));
const OUT = path.resolve(arg('--out', path.join(HERE, 'out')));
const PICTURES = has('--pictures');
const LIMIT_MS = Number(arg('--limit', 600)) * 1000; // per document: upload, first reading, reading from pictures
const RECYCLE = Number(arg('--recycle', 8)); // a fresh tab and sign-in after this many documents (memory)
const COMPARE = arg('--compare', '');
const FINAL_B = has('--final-b'); // held-out B is read only here, once, at the end of the phase
const EXACT = has('--exact'); // exact.py at the end: held-out A totals gate (builder mode) and the gold rows and gate
const HELDOUT_OUT = path.resolve(arg('--heldout-out', path.join(OUT, 'heldout'))); // sealed: no pictures, no row in summary.md
const EDGAR = path.dirname(HERE);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const HELD_A = new Set((readJson(path.join(EDGAR, 'held-out.json'), {}).held_out) || []);
const HELD_B = new Set((readJson(path.join(EDGAR, 'held-out-b.json'), {}).held_out_b) || []);
/** The read seal (D-22): access time one second below modification time, on every held-out file read or written. */
function seal(p) {
  try {
    const st = fs.statSync(p, { bigint: true });
    if (st.isDirectory()) return fs.readdirSync(p).forEach((n) => seal(path.join(p, n)));
    const m = st.mtimeNs;
    fs.utimesSync(p, Number(m - 1000000000n) / 1e9, Number(m) / 1e9);
  } catch (e) { /* gone */ }
}
const VENDOR = path.join(SCRATCH, 'vendor');
const CACHE = mk(path.join(HERE, 'cache'));
const OFFER_RE = /read (these|the|those)? ?pages? from (their|its|the) pictures?/i;
const BUSY_RE = /Reading page \d+ of \d+|Finding the boxes on page \d+ of \d+|Reading the PDF…/;

if (!fs.existsSync(path.join(ROOT, 'diy.html'))) { console.error('not a checkout of the portal: ' + ROOT); process.exit(2); }
// the shared proof helpers read --root from the command line when loaded: the same checkout
const P = require(path.join(SCRATCH, 'build/proof/proof.js'));

/* ---------- the documents ---------- */
function listDocs() {
  let docs = [];
  if (/\.json$/i.test(DOCS)) {
    const j = JSON.parse(fs.readFileSync(DOCS, 'utf8'));
    const arr = Array.isArray(j) ? j : Array.isArray(j.docs) ? j.docs : Array.isArray(j.documents) ? j.documents : Object.entries(j).map(([id, pdf]) => ({ id, pdf: typeof pdf === 'string' ? pdf : pdf.pdf }));
    docs = arr.map((d) => ({ id: String(d.id), pdf: path.resolve(path.dirname(DOCS), d.pdf || d.path || path.join(String(d.id), 'doc.pdf')), meta: { form: d.form || '', made: d.pdf_made || '', content: d.page_content || '' } }));
  } else if (/\.pdf$/i.test(DOCS)) {
    docs = [{ id: path.basename(path.dirname(DOCS)) + (path.basename(DOCS) === 'doc.pdf' ? '' : '-' + path.basename(DOCS, '.pdf')), pdf: DOCS }];
  } else {
    fs.readdirSync(DOCS).sort().forEach((n) => {
      const p = path.join(DOCS, n);
      if (n.startsWith('_') || n.startsWith('.')) return;
      if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'doc.pdf'))) docs.push({ id: n, pdf: path.join(p, 'doc.pdf') });
      else if (/\.pdf$/i.test(n)) docs.push({ id: n.replace(/\.pdf$/i, ''), pdf: p });
    });
  }
  docs = docs.filter((d) => fs.existsSync(d.pdf));
  if (ONLY.length) docs = docs.filter((d) => ONLY.includes(d.id));
  // held-out B is read once, at the end of the phase, with --final-b (D-22); never named here
  const b = docs.filter((d) => HELD_B.has(d.id));
  if (b.length && !FINAL_B) { console.log(`NOT RUN: ${b.length} held-out B document${b.length > 1 ? 's' : ''} (held-out B is read only with --final-b, once at the end)`); docs = docs.filter((d) => !HELD_B.has(d.id)); }
  return docs;
}

/* ---------- the measure's own eyes (measure.py), cached per PDF and version ---------- */
const PY = path.join(HERE, 'measure.py');
const sha = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
function py(args) {
  return new Promise((resolve) => {
    const ch = spawn('python3', ['-I', PY].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    ch.stdout.on('data', (b) => (out += b));
    ch.stderr.on('data', (b) => (err += b));
    ch.on('close', (code) => resolve({ code, out, err }));
  });
}
async function candidatesOf(pdf) {
  // the version of the candidate finder only (the checks below it in measure.py may change without a new reading)
  const src = fs.readFileSync(PY, 'utf8');
  const finder = src.slice(0, src.indexOf('# ---------------------------------------------------------------- checks'));
  const key = sha(pdf).slice(0, 16) + '-' + crypto.createHash('sha1').update(finder).digest('hex').slice(0, 8);
  const file = path.join(CACHE, key + '.json');
  if (fs.existsSync(file)) return { file, cached: true, ms: 0 };
  const t = Date.now();
  const r = await py(['candidates', pdf, file + '.tmp']);
  if (r.code !== 0 || !fs.existsSync(file + '.tmp')) return { error: ((r.err || r.out || '') + ` (exit ${r.code})`).slice(-600) };
  fs.renameSync(file + '.tmp', file);
  return { file, cached: false, ms: Date.now() - t, said: r.out.trim() };
}

/* ---------- serving the checkout, the browser ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.traineddata': 'application/octet-stream' };
function serve() {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(ROOT, url);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    s.once('error', reject);
    s.listen(PORT, '127.0.0.1', () => resolve({ appPort: PORT, close: () => { s.close(); s.closeAllConnections && s.closeAllConnections(); } }));
  });
}
const CDNJS = { 'pdf.js/3.11.174/pdf.min.js': 'pdfjs/package/build/pdf.min.js', 'pdf.js/3.11.174/pdf.worker.min.js': 'pdfjs/package/build/pdf.worker.min.js', 'pdf-lib/1.17.1/pdf-lib.min.js': 'pdflib/package/dist/pdf-lib.min.js' };
const JSD = { '@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js': ['fontkit/package/dist/fontkit.umd.min.js', 'application/javascript'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf': ['dejavu/package/ttf/DejaVuSans.ttf', 'font/ttf'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf': ['dejavu/package/ttf/DejaVuSans-Bold.ttf', 'font/ttf'] };
async function session(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const net = { aborted: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith(`http://127.0.0.1:${PORT}/`) || /^(blob|data|about):/.test(u)) return route.continue();
    let m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && CDNJS[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(VENDOR, CDNJS[m[1]])) });
    m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (m && JSD[m[1]] && fs.existsSync(path.join(VENDOR, JSD[m[1]][0]))) return route.fulfill({ status: 200, contentType: JSD[m[1]][1], headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(VENDOR, JSD[m[1]][0])) });
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    net.aborted.push(u.slice(0, 120));
    return route.abort();
  });
  const page = await context.newPage();
  const S = { context, net, page, P: page, errors: [], dialogs: [], docs: 0, pages: 0 };
  page.on('pageerror', (e) => S.errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text()) && S.errors.push('console: ' + m.text().slice(0, 300)));
  page.on('dialog', (d) => { S.dialogs.push(d.type() + ': ' + d.message().slice(0, 120)); d.dismiss().catch(() => {}); });
  await page.goto(`http://localhost:${PORT}/diy.html`);
  S.off = await P.prepare(S); // the sample firm signed in as its sponsor, one offering ready to raise (workspace preparation)
  return S;
}
/** Before the next document: the last draft agreement, its stored file and any template of the offering taken away. */
async function reset(S) {
  return S.P.evaluate(async (oid) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const drop = (ws.envelopes || []).filter((e) => e.agreementFor === oid || e.offeringId === oid);
    for (const e of drop) { try { await NS.ops.files.del(e.docId); } catch (x) { /* already gone */ } }
    ws.envelopes = (ws.envelopes || []).filter((e) => !drop.includes(e));
    ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== oid);
    NS.app.save(true);
    return drop.length;
  }, S.off.id);
}

/* ---------- one document through the screen ---------- */
async function snap(S) {
  return S.P.evaluate((a) => {
    const btn = document.querySelector('[data-action="es-read-pictures"]');
    const body = document.body.innerText;
    const m = body.match(new RegExp(a.busy));
    return { btn: !!btn && btn.offsetParent !== null, disabled: !!(btn && btn.disabled), text: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '', progress: m ? m[0] : '', editor: /^#console-envelope-/.test(location.hash) && !!document.querySelector('.fe-doc .es-page') };
  }, { busy: BUSY_RE.source }).catch(() => null);
}
async function takeOffer(S, deadline) {
  const st0 = await snap(S);
  const loc = S.P.locator('[data-action="es-read-pictures"]:visible').first();
  let btn = (await loc.count().catch(() => 0)) ? loc : S.P.locator('button:visible, a:visible').filter({ hasText: OFFER_RE }).first();
  if (!(await btn.count().catch(() => 0))) return { appeared: false, taken: false };
  const text = ((await btn.innerText({ timeout: 800 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const offerText = ((await S.P.locator('.es-offer').first().innerText({ timeout: 800 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const t0 = Date.now();
  await btn.click();
  let seen = false, last = '', quiet = 0, finished = false;
  while (Date.now() < deadline) {
    await S.P.waitForTimeout(250);
    const st = await snap(S);
    if (!st) continue;
    if (st.progress) { seen = true; last = st.progress; }
    if (st.disabled) seen = true;
    const busy = !!st.progress || st.disabled;
    if (!busy && st.editor && (!st.btn || seen)) {
      quiet = quiet || Date.now();
      if (Date.now() - quiet >= 1000) { finished = true; break; }
    } else quiet = 0;
  }
  return { appeared: true, taken: true, button: text, offer: offerText, ms: Date.now() - t0 - (finished ? 1000 : 0), finished, progressSeen: seen, lastProgress: last, before: st0 };
}
/** Every field as the editor shows it, joined with the draft as the workspace holds it. */
async function readFields(S, sizes) {
  const ed = await P.readEditor(S, sizes);
  const ws = await S.P.evaluate(() => {
    const NS = window.CVPortal;
    const id = location.hash.replace(/^#console-envelope-/, '');
    const env = [].concat(NS.state.ws.envelopes || [], NS.state.ws.esignTemplates || []).find((e) => e && e.id === id);
    if (!env) return null;
    return { signers: (env.signers || []).map((s) => ({ id: s.id, role: s.role || '', name: s.name || '', investorId: s.investorId || '' })), read: env.read ? JSON.parse(JSON.stringify(env.read)) : null, fields: (env.fields || []).map((f) => ({ id: f.id, signerId: f.signerId, type: f.type, required: !!f.required, review: !!f.review, reviewReason: f.reviewReason || '', confidence: f.confidence || '', kind: f.kind || '', other: f.other || '', second: !!f.second, forType: f.forType || '', label: f.label || '', role: (f.placed && f.placed.role) || '' })) };
  }).catch(() => null);
  const byId = {};
  ((ws && ws.fields) || []).forEach((f) => (byId[f.id] = f));
  const sg = {};
  ((ws && ws.signers) || []).forEach((s) => (sg[s.id] = s));
  const fields = ed.fields.map((f) => {
    const w = byId[f.id] || {};
    const s = sg[w.signerId] || {};
    let owner = 'investor';
    if (s.investorId === '__co_investor__' || w.role === 'co') owner = 'co-investor';
    else if (w.other || w.second || /\bis-else\b/.test(f.cls || '') || /someone else/i.test(f.aria || '')) owner = 'someone else';
    else if (s.role === 'countersigner' || (s.id && !s.investorId)) owner = 'firm';
    return { id: f.id, page: f.page, kind: f.kind, x0: r1(f.x0), top: r1(f.top), x1: r1(f.x1), bottom: r1(f.bottom), owner, signer: f.signerName || s.name || '', other: w.other || '', forType: w.forType || '', required: w.required != null ? !!w.required : !!f.required, shownRequired: !!f.required, review: !!f.review || !!w.review, reason: w.reviewReason || '', confidence: w.confidence || '', fine: w.kind || '', label: f.label || w.label || '' };
  });
  return { fields, editorPages: ed.pages, reviewList: ed.reviewList.length, read: ws && ws.read, signers: ws && ws.signers };
}
async function runDoc(S, doc, sizes) {
  const r = { id: doc.id, pdf: doc.pdf, pages: sizes.length, opened: false, offer: { appeared: false, taken: false } };
  const deadline = Date.now() + LIMIT_MS;
  const errMark = S.errors.length;
  const t0 = Date.now();
  const up = await P.uploadDialog(S, S.off, doc.pdf, LIMIT_MS);
  Object.assign(r, { opened: up.opened, uploadMs: up.ms, said: up.said, dialogSays: up.dialogSays || '' });
  if (up.opened) {
    r.summaryBefore = ((await S.P.locator('.es-agr-note').first().innerText({ timeout: 800 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    r.offer = await takeOffer(S, deadline);
    if (r.offer.taken && !r.offer.finished) r.timedOut = true;
    r.opened = (await snap(S) || {}).editor || false;
  } else if (Date.now() >= deadline - 1000) r.timedOut = true;
  r.readingMs = Date.now() - t0;
  if (r.opened) {
    const got = await readFields(S, sizes);
    Object.assign(r, got);
    r.summary = ((await S.P.locator('.es-agr-note').first().innerText({ timeout: 800 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    r.reread = ((await S.P.locator('.es-reread').first().innerText({ timeout: 800 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    r.toasts = await P.toasts(S.P);
  } else r.fields = [];
  r.consoleErrors = S.errors.slice(errMark);
  r.aborted = Array.from(new Set(S.net.aborted)).slice(0, 5);
  return r;
}

/* ---------- the automatic checks ---------- */
const kindsOf = (pages) => pages.reduce((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});
function rowOf(r, chk, cands) {
  const pk = kindsOf(cands.pages);
  const nf = r.fields.length;
  const marked = r.fields.filter((f) => f.review).length;
  const unreadable = !r.opened || !!(r.read && (r.read.error || !r.read.ok));
  return {
    id: r.id, pages: r.pages, textPages: pk.text || 0, picturePages: (pk.picture || 0) + (pk.mixed || 0), emptyPages: pk.empty || 0,
    offer: r.offer.appeared ? (r.offer.taken ? (r.offer.finished ? 'taken' : 'taken, not finished') : 'shown') : 'none',
    seconds: r1(r.readingMs / 1000), opened: r.opened, unreadable: unreadable ? 1 : 0, timedOut: r.timedOut ? 1 : 0,
    fields: nf, marked, allMarked: nf ? r1((100 * marked) / nf) : 0,
    fillCandidates: chk.fillCandidates, fillWithField: chk.fillWithField, coverage: chk.fillCandidates ? r1((100 * chk.fillWithField) / chk.fillCandidates) : null,
    strayOverText: chk.strayOverText.length, strayNoPlace: chk.strayNoPlace.length, placeNoField: chk.placeNoField.length, overlaps: chk.overlaps.length,
    noSignature: chk.noSignature, signatureFields: chk.signatureFields, consoleErrors: r.consoleErrors.length,
    // D-13/D-14/D-20: what the sponsor would have to do before sending; pressing the picture offer is work too
    sponsorWork: chk.sponsorWork.total + (r.offer.appeared ? 1 : 0) + (unreadable ? 1 : 0),
    work: Object.assign({}, chk.sponsorWork, { pressOffer: r.offer.appeared ? 1 : 0, unreadable: unreadable ? 1 : 0 }),
    readyToSend: !unreadable && !r.timedOut && chk.sponsorWork.total + (r.offer.appeared ? 1 : 0) === 0,
    owners: r.fields.reduce((a, f) => ((a[f.owner] = (a[f.owner] || 0) + 1), a), {}),
    summary: (r.reread || r.summary || r.said.join(' | ') || r.dialogSays || '').slice(0, 400)
  };
}
const byPage = (list) => list.reduce((a, x) => ((a[x.page] = a[x.page] || []).push(x), a), {});

/* ---------- main ---------- */
(async () => {
  const docs = listDocs();
  if (!docs.length) { console.error('no documents at ' + DOCS); process.exit(2); }
  mk(OUT);
  const { chromium } = require('playwright');
  const srv = await serve();
  let browser = await chromium.launch();
  say(`serving ${ROOT} on http://localhost:${PORT}; ${docs.length} documents; results in ${OUT}`);
  const rows = [];
  const heldRows = [];
  const T0 = Date.now();
  let S = null;
  let fresh = true;
  let heldN = 0;
  try {
    for (const doc of docs) {
      const held = HELD_A.has(doc.id) || (FINAL_B && HELD_B.has(doc.id));
      const who = held ? `held-out document ${++heldN}` : doc.id; // a held-out id is never printed
      const dir = mk(path.join(held ? HELDOUT_OUT : OUT, doc.id));
      const td = Date.now();
      let cand = null;
      try { // finally: the read seal on everything of a held-out document this run read or wrote
      const candP = candidatesOf(doc.pdf);
      let r;
      try {
        const sizes = P.pageSizes(doc.pdf);
        if (!browser.isConnected()) { browser = await chromium.launch(); S = null; } // the browser itself went away: a new one
        if (!S || fresh || S.docs >= RECYCLE || S.pages > 400) {
          if (S) await S.context.close().catch(() => {});
          S = await session(browser);
          fresh = false;
        } else await reset(S);
        r = await runDoc(S, doc, sizes);
        S.docs++;
        S.pages += sizes.length;
        if (r.timedOut || !r.opened) fresh = true; // a page left reading or stuck: the next document starts on a fresh tab
        if (!held) { // no picture of a held-out document is ever written (D-22)
          if (r.opened) await S.page.screenshot({ path: path.join(dir, 'editor-window.png') }).catch(() => {});
          else await S.page.screenshot({ path: path.join(dir, 'not-opened.png') }).catch(() => {});
        }
      } catch (e) {
        r = { id: doc.id, pdf: doc.pdf, pages: 0, opened: false, offer: { appeared: false, taken: false }, fields: [], said: [], consoleErrors: S ? S.errors.slice(-5) : [], error: String(e && e.stack ? e.stack : e).slice(0, 800), readingMs: Date.now() - td };
        fresh = true;
      }
      cand = await candP;
      const into = held ? heldRows : rows;
      if (cand.error) { say(`${who}: the candidate finder failed${held ? '' : ': ' + cand.error}`); into.push(Object.assign({ id: doc.id, error: 'candidates: ' + cand.error.slice(-200) })); continue; }
      fs.writeFileSync(path.join(dir, 'fields.json'), JSON.stringify({ fields: r.fields }, null, 1));
      const ck = await py(['check', doc.pdf, cand.file, path.join(dir, 'fields.json'), path.join(dir, 'checks.json')].concat(PICTURES && !held ? ['--pictures', path.join(dir, 'pictures')] : []));
      if (ck.code !== 0) { say(`${who}: the checks failed${held ? '' : ': ' + (ck.err || ck.out).slice(-400)}`); into.push({ id: doc.id, error: 'checks: ' + (ck.err || '').slice(-200) }); continue; }
      const chk = JSON.parse(fs.readFileSync(path.join(dir, 'checks.json'), 'utf8'));
      const cands = JSON.parse(fs.readFileSync(cand.file, 'utf8'));
      const row = rowOf(r, chk, cands);
      row.totalSeconds = r1((Date.now() - td) / 1000);
      if (doc.meta) row.meta = doc.meta;
      if (r.error) row.error = r.error.slice(0, 300);
      into.push(row);
      const result = {
        id: doc.id, pdf: doc.pdf, root: ROOT, when: new Date().toISOString(), row,
        portal: { opened: r.opened, uploadMs: r.uploadMs, readingMs: r.readingMs, timedOut: !!r.timedOut, offer: r.offer, summaryBefore: r.summaryBefore || '', summary: r.summary || '', reread: r.reread || '', said: r.said, dialogSays: r.dialogSays, toasts: r.toasts || [], read: r.read || null, signers: r.signers || null, reviewList: r.reviewList, editorPages: r.editorPages, consoleErrors: r.consoleErrors, aborted: r.aborted, error: r.error || '' },
        pageKinds: cands.pages.map((p) => ({ page: p.page, kind: p.kind, words: p.words, size: [p.w, p.h], regions: p.regions })),
        candidates: { total: cands.candidates.length, fill: chk.fillCandidates, byKind: cands.candidates.reduce((a, c) => ((a[c.kind + (c.fill ? '' : ' (not counted)')] = (a[c.kind + (c.fill ? '' : ' (not counted)')] || 0) + 1), a), {}), signatureCaptions: cands.signatureCaptions.slice(0, 20), cached: cand.cached, ms: cand.ms },
        checks: { strayOverText: byPage(chk.strayOverText), strayNoPlace: byPage(chk.strayNoPlace), placeNoField: byPage(chk.placeNoField), overlaps: byPage(chk.overlaps), noSignature: chk.noSignature, perPage: chk.perPage },
        fields: r.fields,
        pictures: held ? [] : chk.pictures || []
      };
      fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 1));
      if (held) { say(`${who}: read; result sealed${row.offer !== 'none' ? '; FAIL offer' : ''}`); continue; }
      say(`${doc.id}: ${row.pages} p (${row.textPages} text, ${row.picturePages} picture), offer ${row.offer}, ${row.seconds} s, ${row.opened ? 'opened' : 'NOT OPENED'}, ${row.fields} fields (${row.allMarked}% marked); places ${row.fillWithField}/${row.fillCandidates}; strays over text ${row.strayOverText}, off any place ${row.strayNoPlace}; places without field ${row.placeNoField}; overlaps ${row.overlaps}; noSignature ${row.noSignature}; console errors ${row.consoleErrors}`);
      } finally {
        if (held) { seal(doc.pdf); seal(dir); if (cand && cand.file) seal(cand.file); }
      }
    }
  } finally {
    if (S) await S.context.close().catch(() => {});
    await browser.close();
    srv.close();
  }
  /* ---------- the summary ---------- */
  const judged = judgeRows(rows.concat(heldRows)); // D-13: an offer fails the document, held-out ones too
  const totals = totalsOf(rows, r1((Date.now() - T0) / 1000)); // train rows only: a held-out row is never in a table
  const summary = { root: ROOT, when: new Date().toISOString(), docsFrom: DOCS, limitSeconds: LIMIT_MS / 1000, totals, docs: rows };
  if (heldRows.length) {
    summary.heldout = heldoutCounts(heldRows);
    summary.heldoutNote = 'held-out rows are in ' + path.relative(OUT, HELDOUT_OUT) + '/rows.json (sealed); totals are over the rows above only';
    mk(HELDOUT_OUT);
    const rp = path.join(HELDOUT_OUT, 'rows.json');
    const prev = readJson(rp, []).filter((x) => !heldRows.some((h) => h.id === x.id));
    fs.writeFileSync(rp, JSON.stringify(prev.concat(heldRows), null, 1));
    seal(rp);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  const cols = [['id', 'document'], ['readyToSend', 'ready to send'], ['fail', 'fail'], ['sponsorWork', 'sponsor work'], ['pages', 'pages'], ['picturePages', 'picture p.'], ['offer', 'offer'], ['seconds', 's'], ['opened', 'opened'], ['fields', 'fields'], ['allMarked', 'marked %'], ['coverage', 'places with a field %'], ['placeNoField', 'place, no field'], ['strayNoPlace', 'stray: no place'], ['strayOverText', 'stray: over text'], ['overlaps', 'overlaps'], ['noSignature', 'no signature'], ['consoleErrors', 'console errors']];
  const cell = (v) => (v === null ? 'unknown' : v === undefined ? '' : Array.isArray(v) ? (v.length ? '**FAIL ' + v.join(', ') + '**' : '') : typeof v === 'boolean' ? (v ? 'yes' : '**NO**') : String(v)).replace(/\|/g, '/');
  const H = summary.heldout;
  const md = [`# Measure: ${path.basename(ROOT)} (${summary.when})`, '', `Root \`${ROOT}\`, documents from \`${DOCS}\`, limit ${LIMIT_MS / 1000} s a document, ${totals.seconds} s in all; reading time a document: median ${totals.medianSeconds} s, 95th percentile ${totals.p95Seconds} s; a picture page: median ${totals.pictureMedianSeconds} s.`, '', '| ' + cols.map((c) => c[1]).join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|']
    .concat(rows.map((x) => '| ' + cols.map((c) => cell(x[c[0]])).join(' | ') + ' |'))
    .concat(['| **total** | ' + [`${totals.readyToSend}/${totals.documents}`, `${rows.filter((x) => x.fail && x.fail.length).length} failed`, totals.sponsorWork, totals.pages, totals.picturePages, `${totals.offers} shown`, totals.seconds, `${totals.documents - totals.unreadable}/${totals.documents}`, totals.fields, totals.allMarked, totals.coverage, totals.placeNoField, totals.strayNoPlace, totals.strayOverText, totals.overlaps, `${totals.noSignature} (${totals.noSignatureUnknown} unknown)`, totals.consoleErrors].join(' | ') + ' |'])
    .concat(H ? ['', `Held-out documents: ${H.documents} read, results sealed (no pictures, no rows here); offers ${H.offers}, zero fields ${H.zeroFields}, unreadable ${H.unreadable}, timed out ${H.timedOut}, broken ${H.broken}, no signature ${H.noSignature}, console errors ${H.consoleErrors}.`] : [])
    .concat(['', '## What the portal said', ''])
    .concat(rows.map((x) => `- **${x.id}**: ${x.error ? 'ERROR ' + x.error.slice(0, 200) : (x.summary || '(nothing)').slice(0, 400)}`));
  fs.writeFileSync(path.join(OUT, 'summary.md'), md.join('\n') + '\n');
  console.log('\n' + md.slice(4, 6 + rows.length + 1).join('\n'));
  if (COMPARE) console.log('\n' + compare(COMPARE, summary));
  const heldFailed = judged.failed.filter((x) => heldRows.includes(x)).length;
  judged.failed.filter((x) => rows.includes(x)).forEach((x) => console.log(`FAIL offer: ${x.id} (the editor showed the picture offer)`));
  if (heldFailed) console.log(`FAIL offer: ${heldFailed} held-out document${heldFailed > 1 ? 's' : ''} (the editor showed the picture offer)`);
  say(`summary: ${path.join(OUT, 'summary.md')}`);
  let status = judged.exitStatus;
  /* ---------- --exact: the exact gates at the end of the run ---------- */
  if (EXACT) {
    const ex = (args) => { try { return { code: 0, out: execFileSync('python3', ['-I', path.join(HERE, 'exact.py')].concat(args), { encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
    const H0 = readJson(path.join(EDGAR, 'held-out.json'), {});
    const scoredA = (H0.held_out || []).filter((i) => !(H0.exact_scoring_excluded || {})[i]);
    const haveA = scoredA.filter((i) => fs.existsSync(path.join(HELDOUT_OUT, i, 'result.json'))).length;
    if (haveA === scoredA.length && haveA) {
      const g = ex(['--set', 'A', '--runs', [OUT, HELDOUT_OUT].join(','), '--gate']); // builder mode: totals only
      console.log(g.out.trim());
      if (g.code === 1) status = 1;
    } else console.log(`EXACT GATE A: NOT RUN (this run read ${haveA} of the ${scoredA.length} held-out A documents; the A gate needs them all: whole.sh)`);
    const ids = rows.filter((x) => !x.error).map((x) => x.id).join(',');
    const g = ex(['--set', 'gold', '--runs', OUT, '--within', ids, '--gate']);
    console.log(g.out.trim());
    if (g.code === 1) status = 1;
    if (!/EXACT GATE gold/.test(g.out)) console.log('EXACT GATE gold: NOT RUN');
  }
  if (status) process.exitCode = status;
})().catch((e) => { console.error(e); process.exit(1); });
