#!/usr/bin/env node
/*
 * The one measure command of Phase 01.3 (scratch: not in the repository).
 *
 *   NODE_PATH=$(npm root -g) node measure.js --root <checkout> [--run <names>] [--places <names>] [--improves <names>] [--holds <names>]
 *   NODE_PATH=$(npm root -g) node measure.js --root <checkout> --baseline --run A,B,C,Bvar,proof1,proof5,leak,stable:A,selftest
 *   node measure.js --rehash          re-record the hash of a deliberately tightened sheet or scorer (needs its line in reasons.txt)
 *
 *   --run       each named measure must end in RESULT: PASS, or in its own pass
 *   --places    PLACES: PASS is enough (documents A, B, C and Bvar)
 *   --improves  no per-place measure higher than in baseline.json and at least one lower
 *   --holds     no per-place measure higher than the best recorded in ratchet.json; on success the bests are updated
 *
 * Names: A, B, C (the three scorers); Bvar (the five made-up variants and the 47-field example, each with its own
 * answer sheet); proof1, proof3, proof4, proof5, proof7 (the proof run, that one step) and proof6 (steps 1 and 6: step 6
 * compares with step 1 on disk); classes (the repository's class-page runner over every page); notpdf (the repository's check for a file
 * that is not a PDF offered as an agreement); leak; selftest;
 * stable:A, stable:B, stable:C (the scorer twice, the two field lists compared in order); hashes;
 * walkA, walkB, walkC (walk.js: the end-to-end walks of plan 01.3-09; walkC runs the individual with a co-investor,
 * then the entity).
 *
 * One browser at a time; --root goes to every scorer and to proof.js. One line per measure beginning PASS, FAIL or
 * NOT RUN, then MEASURE: PASS or MEASURE: FAIL; exit 0 only when every named measure passed. A measure whose script,
 * document or answer sheet is missing is NOT RUN and fails. Before anything else the hash of every answer sheet and
 * scorer is compared with hashes.json: a mismatch prints FAIL hashes and nothing else runs.
 *
 * Do not wrap this command in the shared browser queue: it takes a place in the queue itself for each browser it starts.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');

const HERE = __dirname;
const SCRATCH = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const ROOT = path.resolve(arg('--root', '/home/user/Hhhh'));
const BASELINE = has('--baseline');
const REHASH = has('--rehash');
const PROOF = path.join(SCRATCH, 'build/proof/proof.js');
const EXAMPLE = process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf');
const HEAVY = path.join(SCRATCH, 'exec-011/heavy.sh');
const F = { pins: path.join(HERE, 'pins.json'), baseline: path.join(HERE, 'baseline.json'), ratchet: path.join(HERE, 'ratchet.json'), hashes: path.join(HERE, 'hashes.json'), reasons: path.join(HERE, 'reasons.txt'), names: path.join(HERE, 'names.txt'), start: path.join(HERE, 'start.txt'), allowed: path.join(HERE, 'leak-allowed.json') };
const DOCS = { A: { score: path.join(HERE, 'A/score.js'), pdf: path.join(HERE, 'doc-a.pdf'), truth: path.join(HERE, 'A/truth.json') }, B: { score: path.join(HERE, 'B/score.js'), pdf: path.join(HERE, 'doc-b.pdf'), truth: path.join(HERE, 'B/truth.json') }, C: { score: path.join(HERE, 'C/score.js'), pdf: path.join(HERE, 'doc-c.pdf'), truth: path.join(HERE, 'C/truth.json') } };
const VARIANTS = ['v-control', 'v-president', 'v-bare', 'v-lp-page', 'v-counter', 'example47'];
const variantFiles = (v) => ({ pdf: v === 'example47' ? EXAMPLE : path.join(HERE, 'B/variants', v + '.pdf'), truth: path.join(HERE, 'B/variants', v + '.truth.json') });
const HASHED = ['A/truth.json', 'B/truth.json', 'C/truth.json'].concat(VARIANTS.map((v) => `B/variants/${v}.truth.json`), ['A/score.js', 'B/score.js', 'C/score.js', 'lib-score.js']);
const BASE_SET = ['A', 'B', 'C', 'Bvar', 'proof1', 'proof5', 'leak', 'stable:A', 'selftest'];
const rootKey = path.basename(ROOT).replace(/[^A-Za-z0-9._-]/g, '_') + '-' + crypto.createHash('sha1').update(ROOT).digest('hex').slice(0, 6);
const OUT = path.join(HERE, 'measure-out', rootKey);
const mk = (d) => (fs.mkdirSync(d, { recursive: true }), d);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
const NODE_PATH = process.env.NODE_PATH || (() => { try { return execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(); } catch (e) { return ''; } })();

/* ---------- results ---------- */
const lines = [];
const times = {};
function out(status, name, info, secs) {
  if (secs != null) times[name] = secs;
  const s = `${status} ${name}${secs != null ? ` (${secs} s)` : ''}${info ? ': ' + info : ''}`;
  lines.push({ status, name });
  console.log(s);
}

/* ---------- which measures, in the order they were named ---------- */
const modes = new Map();
['--run', '--places', '--improves', '--holds'].forEach((flag) => {
  argv.forEach((a, i) => {
    if (a !== flag || i + 1 >= argv.length) return;
    argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => { if (!modes.has(n)) modes.set(n, new Set()); modes.get(n).add(flag.slice(2)); });
  });
});

/* ---------- hashes: every answer sheet and scorer, and the pinned values ---------- */
function currentHashes() {
  const cur = {};
  HASHED.forEach((f) => { const p = path.join(HERE, f); cur[f] = fs.existsSync(p) ? sha(fs.readFileSync(p)) : null; });
  const pins = readJson(F.pins, null);
  cur['pins.json (pinned values, without the explained list)'] = pins ? sha(JSON.stringify({ example: pins.example, public: pins.public })) : null;
  return cur;
}
const reasonFor = (file, hash) => {
  let txt = '';
  try { txt = fs.readFileSync(F.reasons, 'utf8'); } catch (e) { return false; }
  return txt.split('\n').some((l) => { const c = l.split('|').map((s) => s.trim()); return c.length >= 4 && /^\d{4}-\d{2}-\d{2}$/.test(c[0]) && c[1] === file && c[2] === hash.slice(0, 12) && c.slice(3).join('|').trim().length >= 12; });
};
/** Returns '' when every hash is as recorded (or was re-recorded with its reason); else what differs. */
function checkHashes() {
  const rec = readJson(F.hashes, null);
  if (!rec) return 'NOT RUN';
  const cur = currentHashes();
  const bad = [];
  let changed = false;
  Object.keys(cur).forEach((f) => {
    const r = rec.files[f];
    if (cur[f] == null) return bad.push(`${f} is missing`);
    if (!r) return bad.push(`${f} has no recorded hash`);
    if (r.sha256 === cur[f]) { if (r.first !== r.sha256 && !reasonFor(f, r.sha256)) bad.push(`${f} was re-recorded with no line in reasons.txt`); return; }
    if (REHASH && reasonFor(f, cur[f])) { r.history = (r.history || []).concat([{ sha256: r.sha256, until: today() }]); r.sha256 = cur[f]; changed = true; console.log(`re-recorded ${f} (${cur[f].slice(0, 12)}): its reason is in reasons.txt`); return; }
    bad.push(`${f} differs from its recorded hash (now ${cur[f].slice(0, 12)})${REHASH ? ': no line "date | ' + f + ' | ' + cur[f].slice(0, 12) + ' | why" in reasons.txt' : ''}`);
  });
  if (changed) fs.writeFileSync(F.hashes, JSON.stringify(rec, null, 1) + '\n');
  return bad.join('; ');
}

/* ---------- running one thing at a time ---------- */
const underQueue = (() => { try { return /heavy\.sh/.test(fs.readFileSync(`/proc/${process.ppid}/cmdline`, 'utf8')); } catch (e) { return false; } })();
/** One command; a browser command takes a place in the shared queue (unless this whole run already holds one). */
function run(cmd, args, o) {
  const t0 = Date.now();
  const queued = o && o.browser && fs.existsSync(HEAVY) && !underQueue;
  const r = spawnSync(queued ? 'bash' : cmd, queued ? [HEAVY, cmd].concat(args) : args, { cwd: (o && o.cwd) || ROOT, encoding: 'utf8', maxBuffer: 1 << 28, timeout: (o && o.timeout) || 1500000, env: Object.assign({}, process.env, { NODE_PATH }, (o && o.env) || {}) });
  return { code: r.status == null ? 99 : r.status, out: (r.stdout || '') + (r.stderr || ''), secs: Math.round((Date.now() - t0) / 1000) };
}
function freePort(from) {
  for (let p = from; p < from + 60; p++) {
    const r = spawnSync(process.execPath, ['-e', `const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen(${p},()=>s.close(()=>process.exit(0)));`]);
    if (r.status === 0) return p;
  }
  return from;
}
const notRunLine = (o) => (o.match(/^NOT RUN.*$/m) || [''])[0];
/** One scorer run. Returns { notRun, m (measure.json), code, secs, text }. */
function scorer(doc, dir, extra) {
  const d = DOCS[doc];
  const miss = [['its script', d.score], ['its document', (extra && extra.pdf) || d.pdf], ['its answer sheet', (extra && extra.truth) || d.truth], ['the proof runner', PROOF]].find((x) => !fs.existsSync(x[1]));
  if (miss) return { notRun: `${miss[0]} is missing` };
  mk(dir);
  const mfile = path.join(dir, 'measure.json');
  if (fs.existsSync(mfile)) fs.unlinkSync(mfile);
  const args = [d.score, '--root', ROOT, '--port', String(freePort(doc === 'A' ? 8931 : doc === 'B' ? 8941 : 8951)), '--out', dir];
  if (extra && extra.pdf) args.push('--pdf', extra.pdf);
  if (extra && extra.truth) args.push('--truth', extra.truth);
  if (extra && extra.noPictures) args.push('--no-pictures');
  const r = run('node', args, { browser: true });
  fs.writeFileSync(path.join(dir, 'run.log'), r.out);
  if (r.code === 3 || notRunLine(r.out)) return { notRun: notRunLine(r.out).replace(/^NOT RUN\s*/, '') || 'the scorer did not run', secs: r.secs };
  const m = readJson(mfile, null);
  if (!m) return { notRun: `the scorer wrote no result (exit ${r.code})`, secs: r.secs };
  return { m, code: r.code, secs: r.secs, text: r.out };
}
const short = (m) => `${m.counts.found} of ${m.counts.places} found, ${JSON.stringify(m.measures)}`;
const resultWords = (m) => `PLACES: ${m.places ? 'PASS' : 'FAIL'}, TOLD: ${m.told ? 'PASS' : 'FAIL'}, RESULT: ${m.result ? 'PASS' : 'FAIL'}`;
const failedTold = (m) => (m.toldLines || []).filter((t) => !t[1]).map((t) => t[0]);

/** Compares per-place measures: { higher: [...], lower: [...] } of cur against ref. */
function compare(cur, ref) {
  const higher = [], lower = [];
  Object.keys(cur).forEach((k) => { const b = ref[k] == null ? 0 : ref[k]; if (cur[k] > b) higher.push(`${k} ${b} -> ${cur[k]}`); if (cur[k] < b) lower.push(`${k} ${b} -> ${cur[k]}`); });
  return { higher, lower };
}
const record = { docs: {}, variants: {} };

function judgeDoc(name, key, m, set) {
  // key: the name in baseline.json and ratchet.json (A, B, C, or Bvar:<variant>); returns true when every asked mode passed
  let ok = true; const why = [];
  if (m.error) { ok = false; why.push('run error: ' + m.error.slice(0, 200)); }
  if (set.has('run') && !m.result) { ok = false; why.push('RESULT: FAIL' + (failedTold(m).length ? ' (told: ' + failedTold(m).join(' | ').slice(0, 300) + ')' : '')); }
  if (set.has('places') && !m.places) { ok = false; why.push('PLACES: FAIL'); }
  if (set.has('improves')) {
    const base = readJson(F.baseline, null);
    const ref = base && (key.startsWith('Bvar:') ? (base.variants[key.slice(5)] || {}).measures : (base.docs[key] || {}).measures);
    if (!ref) { ok = false; why.push('NOT RUN: no baseline for ' + key); }
    else { const c = compare(m.measures, ref); if (c.higher.length) { ok = false; why.push('higher than the baseline: ' + c.higher.join(', ')); } else if (!c.lower.length) { ok = false; why.push('no measure lower than the baseline'); } else why.push('improves: ' + c.lower.join(', ')); }
  }
  if (set.has('holds')) {
    const rat = readJson(F.ratchet, null);
    const ref = rat && rat.best[key];
    if (!ref) { ok = false; why.push('NOT RUN: no best recorded for ' + key); }
    else {
      const c = compare(m.measures, ref.measures);
      if (c.higher.length) { ok = false; why.push('higher than the best recorded: ' + c.higher.join(', ')); }
      else if (c.lower.length && !m.error) { Object.keys(m.measures).forEach((k) => (ref.measures[k] = Math.min(ref.measures[k] == null ? m.measures[k] : ref.measures[k], m.measures[k]))); ref.by = ROOT; ref.on = today(); fs.writeFileSync(F.ratchet, JSON.stringify(rat, null, 1) + '\n'); why.push('holds, new best: ' + c.lower.join(', ')); }
      else why.push('holds');
    }
  }
  return { ok, why: why.join('; ') };
}

/* ---------- the measures ---------- */
function measureDoc(doc, set) {
  const r = scorer(doc, path.join(OUT, doc));
  if (r.notRun) return out('NOT RUN', doc, r.notRun, r.secs);
  record.docs[doc] = { result: r.m.result, places: r.m.places, told: r.m.told, toldFailed: failedTold(r.m), measures: r.m.measures, counts: r.m.counts, secs: r.secs };
  if (BASELINE) {
    // a scorer that passes before the build measures nothing
    if (r.m.error) return out('FAIL', doc, 'run error: ' + r.m.error.slice(0, 300), r.secs);
    if (r.m.result) return out('FAIL', doc, 'RESULT: PASS at baseline: a scorer that passes before the build measures nothing', r.secs);
    return out('BASE', doc, `${resultWords(r.m)} as it must be before the build; ${short(r.m)}`, r.secs);
  }
  const j = judgeDoc(doc, doc, r.m, set);
  out(/NOT RUN/.test(j.why) && !j.ok ? 'NOT RUN' : j.ok ? 'PASS' : 'FAIL', doc, `${resultWords(r.m)}; ${short(r.m)}${j.why ? '; ' + j.why : ''}`, r.secs);
}
function measureVariants(set) {
  let secs = 0; const res = []; let ok = true; let notRun = '';
  for (const v of VARIANTS) {
    const f = variantFiles(v);
    const r = scorer('B', path.join(OUT, 'Bvar', v), { pdf: f.pdf, truth: f.truth, noPictures: true });
    secs += r.secs || 0;
    if (r.notRun) { notRun = `${v}: ${r.notRun}`; break; }
    record.variants[v] = { result: r.m.result, places: r.m.places, told: r.m.told, toldFailed: failedTold(r.m), measures: r.m.measures, counts: r.m.counts };
    if (BASELINE) { if (r.m.error) { ok = false; res.push(`${v} run error`); } else res.push(`${v} ${r.m.places ? 'PLACES: PASS' : 'PLACES: FAIL'}/${r.m.told ? 'TOLD: PASS' : 'TOLD: FAIL'}`); continue; }
    const j = judgeDoc('Bvar', 'Bvar:' + v, r.m, set);
    if (!j.ok) ok = false;
    res.push(`${v} ${j.ok ? 'ok' : 'FAILS (' + j.why + ')'}`);
  }
  if (notRun) return out('NOT RUN', 'Bvar', notRun, secs);
  out(BASELINE ? (ok ? 'BASE' : 'FAIL') : ok ? 'PASS' : 'FAIL', 'Bvar', res.join('; '), secs);
}
function measureProof(name) {
  if (!fs.existsSync(PROOF)) return out('NOT RUN', name, 'proof.js is missing');
  if ((name === 'proof1' || name === 'proof5' || name === 'proof6') && !fs.existsSync(F.pins)) return out('NOT RUN', name, 'pins.json is missing');
  const step = name.slice(5);
  const dir = mk(path.join(OUT, name));
  const r = run('node', [PROOF, '--root', ROOT, '--only', step === '6' ? '1,6' : step, '--out', dir], { browser: true, timeout: 2400000 });
  fs.writeFileSync(path.join(dir, 'run.log'), r.out);
  const tally = (r.out.match(/^\d+ passed, \d+ failed$/m) || [''])[0];
  if (/NOT RUN/.test(r.out)) return out('NOT RUN', name, (r.out.match(/NOT RUN[^\n]*/) || [''])[0].slice(0, 200), r.secs);
  if (!tally) return out('NOT RUN', name, `the proof run printed no table (exit ${r.code}): ${r.out.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`, r.secs);
  const failing = (r.out.match(/^FAIL {2}\[\d+\] .*$/gm) || []).slice(0, 4).map((s) => s.slice(6, 170));
  out(r.code === 0 ? 'PASS' : 'FAIL', name, tally + (failing.length ? ': ' + failing.join(' || ') : ''), r.secs);
}
function measureClasses() {
  const f = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/classes.js');
  if (!fs.existsSync(f)) return out('NOT RUN', 'classes', 'the class-page runner is not in this checkout');
  const r = run('node', [f], { browser: true, env: { VENDOR_DIR: path.join(SCRATCH, 'vendor'), PLACE_VENDOR: path.join(SCRATCH, 'vendor') } });
  mk(path.join(OUT, 'classes'));
  fs.writeFileSync(path.join(OUT, 'classes', 'run.log'), r.out);
  const tally = (r.out.match(/(\d+)\s*\/\s*(\d+) passed/g) || []).pop() || '';
  const failing = (r.out.match(/^FAIL .*$/gm) || []).slice(0, 4).map((s) => s.slice(0, 120));
  if (!tally) return out('NOT RUN', 'classes', `no tally (exit ${r.code})`, r.secs);
  out(r.code === 0 ? 'PASS' : 'FAIL', 'classes', tally + (failing.length ? ': ' + failing.join(' || ') : ''), r.secs);
}
/** The repository's check for a file that is not a PDF offered as an agreement, in both upload dialogs. */
function measureNotPdf() {
  const f = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/notpdf.js');
  if (!fs.existsSync(f)) return out('NOT RUN', 'notpdf', 'the check for a file that is not a PDF is not in this checkout');
  const r = run('node', [f], { browser: true, env: { VENDOR_DIR: path.join(SCRATCH, 'vendor'), PLACE_VENDOR: path.join(SCRATCH, 'vendor') } });
  mk(path.join(OUT, 'notpdf'));
  fs.writeFileSync(path.join(OUT, 'notpdf', 'run.log'), r.out);
  const tally = (r.out.match(/(\d+)\s*\/\s*(\d+) passed/g) || []).pop() || '';
  const failing = (r.out.match(/^FAIL .*$/gm) || []).slice(0, 4).map((s) => s.slice(0, 160));
  if (!tally) return out('NOT RUN', 'notpdf', `no tally (exit ${r.code})`, r.secs);
  out(r.code === 0 ? 'PASS' : 'FAIL', 'notpdf', tally + (failing.length ? ': ' + failing.join(' || ') : ''), r.secs);
}
function measureSelftest() {
  const t0 = Date.now(); const bad = [];
  for (const doc of ['A', 'B', 'C']) {
    const d = DOCS[doc];
    if (!fs.existsSync(d.score) || !fs.existsSync(d.truth)) return out('NOT RUN', 'selftest', `scorer ${doc} or its answer sheet is missing`);
    const whole = run('node', [d.score, '--self-test'], { cwd: HERE });
    const less = run('node', [d.score, '--self-test', '--drop', '1'], { cwd: HERE });
    if (whole.code === 3 || less.code === 3) return out('NOT RUN', 'selftest', notRunLine(whole.out + less.out));
    if (whole.code !== 0) bad.push(`${doc}: the sheet scored against itself does not pass`);
    if (less.code === 0) bad.push(`${doc}: passes with a place taken away`);
  }
  out(bad.length ? 'FAIL' : 'PASS', 'selftest', bad.join('; ') || 'each sheet scored against itself passes, and fails with one place taken away', Math.round((Date.now() - t0) / 1000));
}
function measureStable(name) {
  const doc = name.slice(7);
  if (!DOCS[doc]) return out('NOT RUN', name, 'no such document');
  const a = scorer(doc, path.join(OUT, 'stable-' + doc, '1'), { noPictures: true });
  if (a.notRun) return out('NOT RUN', name, a.notRun, a.secs);
  const b = scorer(doc, path.join(OUT, 'stable-' + doc, '2'), { noPictures: true });
  if (b.notRun) return out('NOT RUN', name, b.notRun, a.secs + (b.secs || 0));
  const secs = a.secs + b.secs;
  if (a.m.error || b.m.error) return out('FAIL', name, 'run error', secs);
  const x = a.m.list, y = b.m.list; const diffs = [];
  if (x.length !== y.length) diffs.push(`${x.length} fields, then ${y.length}`);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const same = x[i][0] === y[i][0] && x[i][1] === y[i][1] && [2, 3, 4, 5].every((k) => Math.abs(x[i][k] - y[i][k]) <= 1) && x[i][6] === y[i][6] && x[i][7] === y[i][7] && x[i][8] === y[i][8];
    if (!same) diffs.push(`field ${i + 1} differs (page ${x[i][0]} ${x[i][1]} / page ${y[i][0]} ${y[i][1]})`);
  }
  out(diffs.length ? 'FAIL' : 'PASS', name, diffs.slice(0, 4).join('; ') || `${x.length} fields twice: the same page, kind, box to the nearest point, owner, required and mark, in the same order`, secs);
}

/** The end-to-end walks through the real screens (walk.js); walkC is the individual with a co-investor, then the entity. */
function measureWalk(name) {
  const doc = name.slice(4);
  const WALK = path.join(HERE, 'walk.js');
  if (!fs.existsSync(WALK)) return out('NOT RUN', name, 'walk.js is missing');
  const runs = doc === 'C' ? ['individual', 'entity'] : [doc === 'B' ? 'firm' : 'individual'];
  let secs = 0; let ok = true; const res = [];
  for (const as of runs) {
    const dir = mk(path.join(OUT, name, as));
    const r = run('node', [WALK, '--root', ROOT, '--doc', doc, '--as', as, '--out', dir], { browser: true, timeout: 900000 });
    secs += r.secs;
    fs.writeFileSync(path.join(dir, 'run.log'), r.out);
    if (r.code === 3 || notRunLine(r.out)) return out('NOT RUN', name, `${as}: ${notRunLine(r.out).replace(/^NOT RUN\s*/, '') || 'the walk did not run'}`, secs);
    const passed = (r.out.match(/^PASS /gm) || []).length;
    const fails = r.out.match(/^FAIL .*$/gm) || [];
    const result = r.code === 0 && /^RESULT: PASS$/m.test(r.out);
    if (!result) ok = false;
    res.push(`${as}: ${passed} PASS, ${fails.length} FAIL, RESULT: ${result ? 'PASS' : 'FAIL'}${fails.length ? ' (' + fails.slice(0, 3).map((x) => x.slice(5, 200)).join(' | ') + ')' : ''}`);
  }
  out(ok ? 'PASS' : 'FAIL', name, res.join('; '), secs);
}

/* ---------- leak: nothing of the owner's documents in the repository ---------- */
const tokenRe = /[\p{L}\p{N}]+/gu;
const RUN = 8;
function measureLeak() {
  const t0 = Date.now();
  const secs = () => Math.round((Date.now() - t0) / 1000);
  const pdfs = ['doc-a.pdf', 'doc-b.pdf', 'doc-c.pdf'].map((f) => path.join(HERE, f));
  const miss = pdfs.find((p) => !fs.existsSync(p));
  if (miss) return out('NOT RUN', 'leak', `${path.basename(miss)} is missing`);
  if (!fs.existsSync(F.names)) return out('NOT RUN', 'leak', 'names.txt is missing');
  if (!fs.existsSync(F.start)) return out('NOT RUN', 'leak', 'start.txt (the commit the phase began from) is missing');
  if (!fs.existsSync(path.join(ROOT, '.git'))) return out('NOT RUN', 'leak', 'not a checkout: ' + ROOT);
  // every run of eight consecutive words of the three documents, in memory only
  const grams = new Set();
  for (const p of pdfs) {
    const r = spawnSync('pdftotext', [p, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) return out('NOT RUN', 'leak', 'pdftotext failed on ' + path.basename(p));
    const w = (r.stdout.toLowerCase().match(tokenRe) || []);
    if (w.length < 200) return out('NOT RUN', 'leak', path.basename(p) + ' gave no text');
    for (let i = 0; i + RUN <= w.length; i++) grams.add(w.slice(i, i + RUN).join(' '));
  }
  const names = fs.readFileSync(F.names, 'utf8').split('\n').map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).filter((s) => s.length >= 4);
  if (!names.length) return out('NOT RUN', 'leak', 'names.txt is empty');
  const allowedRec = readJson(F.allowed, null);
  if (!allowedRec && !BASELINE) return out('NOT RUN', 'leak', 'the allowed list was never recorded (run the baseline first)');
  const allowed = new Set(allowedRec ? allowedRec.runs : []);
  const h1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
  /** Hits in one text: { runs: [{ line, hash }], names: [{ line, n }] } */
  function scan(text) {
    const res = { runs: [], names: [] };
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    const lineOf = (idx) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; };
    const low = text.toLowerCase();
    const toks = []; let m; tokenRe.lastIndex = 0;
    while ((m = tokenRe.exec(low))) toks.push([m[0], m.index]);
    for (let i = 0; i + RUN <= toks.length; i++) {
      let g = toks[i][0];
      for (let k = 1; k < RUN; k++) g += ' ' + toks[i + k][0];
      if (grams.has(g)) res.runs.push({ line: lineOf(toks[i][1]), hash: h1(g) });
    }
    const flat = low.replace(/\s+/g, ' ');
    names.forEach((n, k) => {
      if (flat.indexOf(n) < 0) return;
      const ln = low.split('\n').findIndex((l) => l.replace(/\s+/g, ' ').indexOf(n) >= 0);
      res.names.push({ line: ln + 1, n: k + 1 });
    });
    return res;
  }
  // tracked files and new files that are not ignored
  const ls = spawnSync('git', ['-C', ROOT, 'ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (ls.status !== 0) return out('NOT RUN', 'leak', 'git ls-files failed');
  const files = ls.stdout.split('\0').filter(Boolean);
  const found = { runs: [], names: [] }; const seen = new Set();
  let scanned = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    let buf;
    try { const st = fs.statSync(p); if (!st.isFile() || st.size > 8e6) continue; buf = fs.readFileSync(p); } catch (e) { continue; }
    if (buf.subarray(0, 8000).includes(0)) continue; // a binary file
    scanned++;
    const r = scan(buf.toString('utf8'));
    r.runs.forEach((x) => { seen.add(x.hash); if (!allowed.has(x.hash)) found.runs.push(`${f}:${x.line}`); });
    r.names.forEach((x) => found.names.push(`${f}:${x.line} (name ${x.n} of the list)`));
  }
  // the message of every commit since the commit the phase began from
  const start = fs.readFileSync(F.start, 'utf8').trim();
  const lg = spawnSync('git', ['-C', ROOT, 'log', `${start}..HEAD`, '--format=%H%x00%B%x01'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (lg.status !== 0) return out('NOT RUN', 'leak', 'git log from the starting commit failed');
  const commits = lg.stdout.split('\x01').map((s) => s.trim()).filter(Boolean);
  commits.forEach((c) => { const [hash, body] = c.split('\0'); const r = scan(body || ''); if (r.runs.some((x) => !allowed.has(x.hash))) found.runs.push(`commit ${hash.slice(0, 7)}`); r.names.forEach((x) => found.names.push(`commit ${hash.slice(0, 7)} (name ${x.n} of the list)`)); });
  const vend = vendorLeak(files);
  if (BASELINE && !allowedRec && !found.names.length && !vend.length) {
    // recorded once, on the unchanged checkout: runs of eight words the repository already had (boilerplate older than the owner's documents)
    fs.writeFileSync(F.allowed, JSON.stringify({ recorded: today(), root: ROOT, head: spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), where: Array.from(new Set(found.runs)).slice(0, 400), runs: Array.from(seen) }, null, 1) + '\n');
    const n = found.runs.length;
    return out('PASS', 'leak', `${scanned} files and ${commits.length} commit messages searched; no name of the list; ${seen.size} runs of eight words already in the repository recorded as the allowed list (${n} places)`, secs());
  }
  const uniq = (a) => Array.from(new Set(a));
  const bad = uniq(found.names).concat(uniq(found.runs), vend);
  out(bad.length ? 'FAIL' : 'PASS', 'leak', bad.length ? `${uniq(found.names).length} name hit(s), ${uniq(found.runs).length} place(s) with a run of eight words from the owner's documents, ${vend.length} vendor name or vendored-hash finding(s): ${bad.slice(0, 12).join(', ')}${bad.length > 12 ? ` and ${bad.length - 12} more` : ''}` : `${scanned} files and ${commits.length} commit messages searched: no name of the list, no run of eight words outside the allowed list; no vendor or library name in assets/js, the pages, names under assets/ or our files beside the runtime; the vendored runtime as recorded`, secs());
}

/* ---------- leak, white label: no vendor or library name where a sponsor can see it; the vendored runtime as recorded ---------- */
const VENDOR_RE = /onnx|onnxruntime|microsoft|pytorch|torch|scikit|sklearn/i;
const VENDOR_HASHES = path.join(SCRATCH, 'vendor/hashes.json');
const VENDOR_DIR = 'assets/vendor/formread/';
// the third-party files themselves may carry their own notices; nothing else may
const VENDOR_OWN_TEXT = /^assets\/vendor\/formread\/(runtime[^/]*\.js|LICENSE-runtime\.txt)$/;
/** What names a vendor or library (assets/js/*.js, every .html, names under assets/, our files beside the runtime), and every vendored file whose hash differs. */
function vendorLeak(files) {
  const bad = [];
  const at = (text) => { const m = VENDOR_RE.exec(text); if (!m) return 0; return text.slice(0, m.index).split('\n').length; };
  for (const f of files) {
    if (f.startsWith('assets/') && f.split('/').some((part) => VENDOR_RE.test(part))) bad.push(`name ${f}`);
    const text = /^assets\/js\/[^/]+\.js$/.test(f) || /\.html$/i.test(f) || (f.startsWith(VENDOR_DIR) && !VENDOR_OWN_TEXT.test(f));
    if (!text) continue;
    let s;
    try { s = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
    const ln = at(s);
    if (ln) bad.push(`vendor name ${f}:${ln}`);
  }
  const vendored = files.filter((f) => f.startsWith(VENDOR_DIR));
  if (vendored.length) {
    const rec = readJson(VENDOR_HASHES, null);
    const pkg = rec && Object.values(rec).find((e) => e && e.vendored);
    if (!pkg) bad.push(`vendored runtime has no recorded hashes (${VENDOR_HASHES})`);
    else Object.entries(pkg.vendored).forEach(([f, r]) => {
      if (!r.third_party) return;
      const p = path.join(ROOT, f);
      if (!fs.existsSync(p)) return bad.push(`vendored ${f} is missing`);
      const h = sha(fs.readFileSync(p));
      if (h !== r.sha256) bad.push(`vendored ${f} differs from its recorded hash (now ${h.slice(0, 12)})`);
    });
  }
  return bad;
}

/* ---------- main ---------- */
(function main() {
  mk(OUT);
  if (!fs.existsSync(path.join(ROOT, 'diy.html'))) { console.log(`NOT RUN the checkout: ${ROOT} is not a checkout of the portal`); console.log(BASELINE ? 'BASELINE: FAIL' : 'MEASURE: FAIL'); process.exit(1); }
  // hashes before anything else
  const firstBaseline = BASELINE && !fs.existsSync(F.hashes) && !fs.existsSync(F.baseline);
  if (!firstBaseline) {
    const h = checkHashes();
    if (h === 'NOT RUN') { console.log('NOT RUN hashes: no hashes were recorded (run the baseline first)'); console.log(BASELINE ? 'BASELINE: FAIL' : 'MEASURE: FAIL'); process.exit(1); }
    if (h) { console.log('FAIL hashes: ' + h); console.log(BASELINE ? 'BASELINE: FAIL' : 'MEASURE: FAIL'); process.exit(1); }
  }
  if (REHASH && !modes.size) { console.log('PASS hashes: every answer sheet and scorer is as recorded'); console.log('MEASURE: PASS'); process.exit(0); }
  if (!modes.size) { console.log('nothing to measure: name measures with --run, --places, --improves or --holds'); console.log('MEASURE: FAIL'); process.exit(1); }
  if (BASELINE) {
    const missing = BASE_SET.filter((n) => !(modes.has(n) && modes.get(n).has('run')));
    if (missing.length) { console.log(`NOT RUN baseline: it needs --run ${BASE_SET.join(',')} (missing ${missing.join(',')})`); console.log('BASELINE: FAIL'); process.exit(1); }
  }
  for (const [name, set] of modes) {
    if (DOCS[name]) measureDoc(name, set);
    else if (name === 'Bvar') measureVariants(set);
    else if (/^proof[134567]$/.test(name)) measureProof(name);
    else if (name === 'classes') measureClasses();
    else if (name === 'notpdf') measureNotPdf();
    else if (name === 'leak') measureLeak();
    else if (name === 'selftest') measureSelftest();
    else if (/^stable:[ABC]$/.test(name)) measureStable(name);
    else if (/^walk[ABC]$/.test(name)) measureWalk(name);
    else if (name === 'hashes') out('PASS', 'hashes', firstBaseline ? 'recorded with this baseline' : 'every answer sheet and scorer is as recorded');
    else out('NOT RUN', name, 'no such measure');
  }
  fs.writeFileSync(path.join(OUT, 'times.json'), JSON.stringify(Object.assign(readJson(path.join(OUT, 'times.json'), {}), times), null, 1) + '\n');
  const bad = lines.filter((l) => l.status === 'FAIL' || l.status === 'NOT RUN');
  if (!BASELINE) { console.log(bad.length ? 'MEASURE: FAIL' : 'MEASURE: PASS'); process.exit(bad.length ? 1 : 0); }
  if (bad.length) { console.log(`BASELINE: FAIL (${bad.map((l) => l.name).join(', ')})`); process.exit(1); }
  const pins = readJson(F.pins, null);
  const now = { docs: record.docs, variants: record.variants };
  const strip = (o) => JSON.stringify(o, (k, v) => (k === 'secs' ? undefined : v));
  const prev = readJson(F.baseline, null);
  if (prev) {
    // the baseline is recorded once, before any reader change; a later run may only confirm it
    if (strip({ docs: prev.docs, variants: prev.variants }) !== strip(now)) { console.log('BASELINE: FAIL (a baseline is already recorded with other values; it is never re-recorded after a reader change)'); process.exit(1); }
    console.log('the baseline on record is confirmed: the same values');
    console.log('BASELINE: RECORDED');
    process.exit(0);
  }
  const head = spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  fs.writeFileSync(F.baseline, JSON.stringify({ recorded: new Date().toISOString(), root: ROOT, head, docs: now.docs, variants: now.variants, pins, times }, null, 1) + '\n');
  const best = {};
  Object.keys(now.docs).forEach((d) => (best[d] = { measures: Object.assign({}, now.docs[d].measures), by: ROOT, on: today() }));
  Object.keys(now.variants).forEach((v) => (best['Bvar:' + v] = { measures: Object.assign({}, now.variants[v].measures), by: ROOT, on: today() }));
  fs.writeFileSync(F.ratchet, JSON.stringify({ seeded: today(), best }, null, 1) + '\n');
  const cur = currentHashes();
  const files = {};
  Object.keys(cur).forEach((f) => (files[f] = { sha256: cur[f], first: cur[f] }));
  fs.writeFileSync(F.hashes, JSON.stringify({ recorded: new Date().toISOString(), note: 'taken after the tightening of plan 01.3-01 task 1 step 2; a changed file is re-recorded only with a line in reasons.txt (date | file | first 12 of the new hash | why) and measure.js --rehash', files }, null, 1) + '\n');
  console.log('BASELINE: RECORDED');
  process.exit(0);
})();
