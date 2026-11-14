#!/usr/bin/env node
/*
 * The whole proof of this phase in one command, against the checkout this file lives in.
 *
 *   node all.js [--only <step>,<step>,...] [--list]
 *   node all.js --publish-list
 *
 * The steps, run one child process at a time from the checkout's root (NODE_PATH set to the output of "npm root -g"):
 *   self            checks/score.js --self-test
 *   score           checks/score.js --only a,b,c,d,e --gate full,speed,pictures
 *   finder-pixels   checks/finder.js --mode pixels --doc all
 *   finder-browser  checks/finder.js --mode browser --doc form
 *   bands-pure      checks/bands.js --mode pure
 *   bands-browser   checks/bands.js --mode browser --doc all
 *   picture-fields  checks/picture-fields.js (all eight parts)
 *   frame           checks/reader-frame.js (the engine in the preview's frame, three passes)
 *   probe           checks/reader-frame.js --probe
 *   form            checks/reader-frame.js --form (the owner's form read inside the frame)
 *   scanset         checks/scanset.js --doc all --nobody
 *   proof           checks/earlier.js --proof 1,3,4,5,6 (the proof run's five steps, each reported apart)
 *   nine            checks/earlier.js --nine (the nine earlier check files, each reported by name)
 *   walk            Phase 01.3's class check for the owner both phases share: classes.js --walk otherHeading
 *   types           every tracked file under assets/ and the pages index.html, portal.html, diy.html and
 *                   reader-probe.html is of a type the preview's host serves (.html .css .js .mjs .wasm .json .txt .md,
 *                   images, fonts)
 *   library         the recognition library's name (its global identifier as assets/js/textengine.js calls it),
 *                   compared without regard to case, is in neither assets/js/picturepage.js nor
 *                   assets/vendor/textread/textread-boot.js, and in assets/js/textengine.js only on lines that use the
 *                   global identifier
 *
 * A step is PASS when its child exits 0 and prints no line starting "NOT RUN"; NOT RUN when the child exits 2 or
 * prints such a line; FAIL otherwise. NOT RUN is never green. One line a step with its result and its seconds, a few
 * lines of the child's own output under it; every child's whole output is kept in a folder under
 * <scratch>/exec-012 (PICTURE_SCRATCH, or the session's folder under the system temp folder), never in the
 * repository. The last line is "ALL: PASS (N of N)" or "ALL: FAIL - (the steps that did not pass)"; exit 0 only
 * when every step run is PASS. --only runs the steps named; an unknown name exits 2. --list prints the step names.
 *
 * --publish-list prints, one path a line, every tracked file the published portal serves (the four pages and
 * everything under assets/), and nothing else.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HERE = path.relative(ROOT, __dirname);
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PAGES = ['index.html', 'portal.html', 'diy.html', 'reader-probe.html'];
const SERVED = /\.(html|css|js|mjs|wasm|json|txt|md|png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|otf)$/i;
const STEP_MS = 30 * 60 * 1000;
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};

/** Tracked files the published portal serves: the four pages and everything under assets/. */
function published() {
  const out = execFileSync('git', ['ls-files', '-z', '--', 'assets', ...PAGES], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  return out.split('\0').filter(Boolean).sort();
}

if (process.argv.includes('--publish-list')) {
  published().forEach((f) => console.log(f));
  process.exit(0);
}

const C = (f) => path.join(HERE, f);
// pick: the lines of the child's output shown under its step line (the whole output is in its log)
const STEPS = [
  { name: 'self', file: C('score.js'), args: ['--self-test'], pick: /^(SELF-TEST|PASS|FAIL) / },
  { name: 'score', file: C('score.js'), args: ['--only', 'a,b,c,d,e', '--gate', 'full,speed,pictures'], pick: /evidence in |^NO-TEXT SCORE|^\d+ passed, \d+ failed|^FAIL  / },
  { name: 'finder-pixels', file: C('finder.js'), args: ['--mode', 'pixels', '--doc', 'all'], pick: /^FAIL/ },
  { name: 'finder-browser', file: C('finder.js'), args: ['--mode', 'browser', '--doc', 'form'], pick: /^FAIL/ },
  { name: 'bands-pure', file: C('bands.js'), args: ['--mode', 'pure'], pick: /^FAIL/ },
  { name: 'bands-browser', file: C('bands.js'), args: ['--mode', 'browser', '--doc', 'all'], pick: /^FAIL/ },
  { name: 'picture-fields', file: C('picture-fields.js'), args: [], pick: /marks left after|^FAIL/ },
  { name: 'frame', file: C('reader-frame.js'), args: [], pick: /FAIL:|the start took/ },
  { name: 'probe', file: C('reader-frame.js'), args: ['--probe'], pick: /FAIL:/ },
  { name: 'form', file: C('reader-frame.js'), args: ['--form'], pick: /took|fields: |by kind, the portal|by owner, the portal|aborted|policy refusals|FAIL:/ },
  { name: 'scanset', file: C('scanset.js'), args: ['--doc', 'all', '--nobody'], pick: /places nobody completes|evidence in |FAIL/ },
  { name: 'proof', file: C('earlier.js'), args: ['--proof', '1,3,4,5,6'], pick: /^(PASS|FAIL)  proof|^logs: /, after: proofSteps },
  { name: 'nine', file: C('earlier.js'), args: ['--nine'], pick: /^(PASS|FAIL)  / },
  { name: 'walk', file: '.planning/phases/01-accurate-field-placement/checks/classes.js', args: ['--walk', 'otherHeading'], pick: /^FAIL/ },
  { name: 'types', run: types },
  { name: 'library', run: library }
];

if (process.argv.includes('--list')) {
  STEPS.forEach((s) => console.log(s.name));
  process.exit(0);
}
const ONLY = arg('--only')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const unknown = ONLY.filter((n) => !STEPS.some((s) => s.name === n));
if (process.argv.includes('--only') && (!ONLY.length || unknown.length)) {
  console.log(`NOT RUN: unknown step${unknown.length === 1 ? '' : 's'} ${unknown.join(', ') || '(none given)'}; the steps are ${STEPS.map((s) => s.name).join(', ')}`);
  process.exit(2);
}
const RUN = ONLY.length ? STEPS.filter((s) => ONLY.includes(s.name)) : STEPS;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
// a scratch folder that does not exist is not made: its steps are NOT RUN, and their logs go to the system temp folder
const LOGS = path.join(fs.existsSync(SCRATCH) ? path.join(SCRATCH, 'exec-012') : os.tmpdir(), `all-${stamp}-${process.pid}`);

/** The proof run's table, one line a step: read from the proof log that earlier.js names. */
function proofSteps(lines) {
  const at = lines.map((l) => /^logs: (.+)$/.exec(l)).find(Boolean);
  const log = at && path.join(at[1], 'proof.log');
  if (!log || !fs.existsSync(log)) return ['  (the proof log was not found: its steps cannot be shown one by one)'];
  const by = {};
  fs.readFileSync(log, 'utf8')
    .split('\n')
    .forEach((l) => {
      const m = /^(PASS|FAIL) {2}\[(\d+)\] {2}/.exec(l);
      if (!m) return;
      const s = (by[m[2]] = by[m[2]] || { pass: 0, fail: 0 });
      s[m[1] === 'PASS' ? 'pass' : 'fail']++;
    });
  return ['1', '3', '4', '5', '6'].map((n) => {
    const s = by[n];
    if (!s) return `  NOT RUN  proof step ${n}: no row of it in the proof's table`;
    return `  ${s.fail ? 'FAIL' : 'PASS'}  proof step ${n}: ${s.pass} passed, ${s.fail} failed`;
  });
}

/** Every file on the publish list is of a type the host serves. */
function types() {
  const list = published();
  const bad = list.filter((f) => !SERVED.test(f));
  const lines = [`  ${list.length} tracked files the portal serves; of a type the host does not serve: ${bad.length}${bad.length ? ' (' + bad.join(', ') + ')' : ''}`];
  const missing = PAGES.filter((p) => !list.includes(p));
  if (missing.length) lines.push(`  pages not tracked: ${missing.join(', ')}`);
  return { result: list.length && !bad.length && !missing.length ? 'PASS' : 'FAIL', lines };
}

/** The library's name only where it must be: on the lines of textengine.js that call its global identifier. */
function library() {
  const read = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : null);
  const engine = read('assets/js/textengine.js');
  if (engine == null) return { result: 'NOT RUN', lines: ['  NOT RUN: assets/js/textengine.js is missing'] };
  const id = (/window\.([A-Za-z_$][\w$]*)\.createWorker\b/.exec(engine) || [])[1];
  if (!id) return { result: 'FAIL', lines: ["  the library's global identifier was not found in assets/js/textengine.js (window.<identifier>.createWorker)"] };
  const name = new RegExp(id, 'i');
  const global = new RegExp('window\\.' + id + '\\b');
  const lines = [];
  let ok = true;
  ['assets/js/picturepage.js', 'assets/vendor/textread/textread-boot.js'].forEach((f) => {
    const src = read(f);
    if (src == null) {
      ok = false;
      return lines.push(`  ${f} is missing`);
    }
    const n = src.split('\n').filter((l) => name.test(l)).length;
    lines.push(`  ${f}: lines naming the library ${n}`);
    if (n) ok = false;
  });
  const naming = engine.split('\n').map((l, i) => ({ l, i: i + 1 })).filter((x) => name.test(x.l));
  const other = naming.filter((x) => !global.test(x.l));
  lines.push(`  assets/js/textengine.js: lines naming the library ${naming.length}, each using its global identifier: ${other.length ? 'no (lines ' + other.map((x) => x.i).join(', ') + ')' : 'yes'}`);
  if (other.length) ok = false;
  return { result: ok ? 'PASS' : 'FAIL', lines };
}

/** One child to its end (or STEP_MS); its output kept in a log. Resolves { code, lines }. */
function child(step, modules) {
  return new Promise((ok) => {
    const log = path.join(LOGS, step.name + '.log');
    const out = fs.openSync(log, 'w');
    const env = Object.assign({}, process.env, { NODE_PATH: [modules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter) });
    const p = spawn(process.execPath, [path.join(ROOT, step.file)].concat(step.args), { cwd: ROOT, env, stdio: ['ignore', out, out] });
    const clock = setTimeout(() => p.kill('SIGKILL'), STEP_MS);
    p.on('close', (code, signal) => {
      clearTimeout(clock);
      fs.closeSync(out);
      const lines = fs.readFileSync(log, 'utf8').split('\n').map((l) => l.replace(/\s+$/, '')).filter(Boolean);
      ok({ code: signal ? `killed (${signal})` : code, lines, log });
    });
  });
}

(async () => {
  fs.mkdirSync(LOGS, { recursive: true });
  let modules = '';
  try {
    modules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  } catch (e) {
    modules = '';
  }
  console.log(`checkout: ${ROOT}`);
  console.log(`logs (outside the repository): ${LOGS}`);
  const results = [];
  for (const step of RUN) {
    const t0 = Date.now();
    let result;
    let lines = [];
    let last = '';
    if (step.run) {
      const r = step.run();
      result = r.result;
      lines = r.lines;
    } else if (!fs.existsSync(path.join(ROOT, step.file))) {
      result = 'NOT RUN';
      last = `NOT RUN: ${step.file} is missing`;
    } else {
      const r = await child(step, modules);
      const notRun = r.code === 2 || r.lines.some((l) => /^NOT RUN/.test(l));
      result = notRun ? 'NOT RUN' : r.code === 0 ? 'PASS' : 'FAIL';
      last = (r.lines[r.lines.length - 1] || '(no output)').slice(0, 400);
      if (notRun) last = (r.lines.find((l) => /^NOT RUN/.test(l)) || last).slice(0, 400);
      lines = r.lines.filter((l) => step.pick && step.pick.test(l) && l !== last).slice(0, 24).map((l) => '  ' + l.trim().slice(0, 400));
      if (step.after) lines = lines.concat(step.after(r.lines));
      if (result !== 'PASS' && r.code !== 0 && r.code !== 1 && r.code !== 2) last += ` (exit ${r.code})`;
    }
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${result.padEnd(7)}  ${step.name} (${s} s)${last ? ' - ' + last : ''}`);
    lines.forEach((l) => console.log(l));
    results.push({ name: step.name, result });
  }
  const bad = results.filter((r) => r.result !== 'PASS');
  console.log(bad.length ? `ALL: FAIL - ${bad.map((r) => `${r.name} (${r.result})`).join('; ')}` : `ALL: PASS (${results.length} of ${results.length})`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => {
  console.log(`ALL: FAIL - the check itself stopped: ${String((e && e.stack) || e).slice(0, 600)}`);
  process.exit(1);
});
