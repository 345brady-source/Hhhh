#!/usr/bin/env node
/*
 * The checks that existed before this phase, in one command, against the checkout this file lives in. Every plan
 * from here on that edits anchors.js, placement.js or esign.js runs it last.
 *
 *   node earlier.js [--proof 1,5] [--nine]
 *
 *   --proof <steps>   the proof run (<scratch>/build/proof/proof.js, outside the repository) with --root set to this
 *                     checkout, --only the steps given and --out a folder under <scratch>/exec-012; passes when the
 *                     runner exits 0
 *   --nine            the nine earlier check files, one after another, each from the checkout's root with two plain
 *                     file servers for it on two free ports (SIGN_PORT and PORT), stopped afterwards; each passes when
 *                     it exits 0. Their output is kept under <scratch>/exec-012, never in the repository.
 *
 * One line a step with its result and its seconds. The last line is "EARLIER: PASS" or "EARLIER: FAIL - (the steps
 * that did not pass)"; exit status 0 or 1. When the proof runner or one of the nine files is missing, one line starting
 * "NOT RUN: " says what, and the exit status is 2: that is never a pass. One browser at a time: the steps run in turn.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PROOF = path.join(process.env.PROOF_DIR || path.join(SCRATCH, 'build/proof'), 'proof.js');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const STEPS = arg('--proof', '');
const NINE = process.argv.includes('--nine');
const STEP_MS = 400000; // as the earlier runner allowed each check file
const P1 = '.planning/phases/01-accurate-field-placement/checks';
const FILES = [`${P1}/accuracy.js`, `${P1}/labels.js`, `${P1}/review.js`, `${P1}/prefill.js`, `${P1}/walk.js`, '.planning/phases/02-field-editor/checks/editor.js', '.planning/phases/03-signatures/checks/signatures.js', '.planning/phases/04-signing-inside-onboarding/checks/signing-step.js', '.planning/phases/05-signed-record/checks/record-check.js'];
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
const OUT = path.join(SCRATCH, 'exec-012', `earlier-${stamp}-${process.pid}`);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/plain', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };

const notRun = (what) => {
  console.log('NOT RUN: ' + what);
  process.exit(2);
};

/** A plain file server for the checkout, on a free port. */
function serve() {
  return new Promise((ok, no) => {
    const server = http.createServer((req, res) => {
      let file;
      try {
        file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      } catch (e) {
        res.writeHead(400).end();
        return;
      }
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
      fs.stat(file, (err, st) => {
        if (!err && st.isDirectory()) file = path.join(file, 'index.html');
        fs.readFile(file, (e, data) => {
          if (e) return res.writeHead(404).end();
          res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
          res.end(data);
        });
      });
    });
    server.on('error', no);
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

/** Runs a child to its end (or STEP_MS), its output kept in a file. Resolves { code, s }. */
function run(file, args, env, log) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const out = fs.openSync(log, 'w');
    const child = spawn(process.execPath, [file].concat(args), { cwd: ROOT, env: Object.assign({}, process.env, env), stdio: ['ignore', out, out] });
    const clock = setTimeout(() => child.kill('SIGKILL'), STEP_MS);
    child.on('close', (code, signal) => {
      clearTimeout(clock);
      fs.closeSync(out);
      ok({ code: signal ? `killed (${signal})` : code, s: ((Date.now() - t0) / 1000).toFixed(1) });
    });
  });
}
const lastLine = (log) => {
  const lines = fs.readFileSync(log, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines[lines.length - 1] || '').slice(0, 300);
};

(async () => {
  if (!STEPS && !NINE) notRun('nothing asked: give --proof <steps> and/or --nine');
  if (STEPS && !fs.existsSync(PROOF)) notRun('the proof runner is missing (' + PROOF + ')');
  if (NINE) {
    const gone = FILES.filter((f) => !fs.existsSync(path.join(ROOT, f)));
    if (gone.length) notRun('earlier check files are missing: ' + gone.join(', '));
  }
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`checkout: ${ROOT}`);
  console.log(`logs: ${OUT}`);
  const failed = [];
  if (STEPS) {
    const log = path.join(OUT, 'proof.log');
    const r = await run(PROOF, ['--root', ROOT, '--only', STEPS, '--out', path.join(OUT, 'proof')], {}, log);
    const pass = r.code === 0;
    console.log(`${pass ? 'PASS' : 'FAIL'}  proof run, steps ${STEPS} (${r.s} s) - ${lastLine(log)}`);
    if (!pass) failed.push(`proof run steps ${STEPS} (exit ${r.code})`);
  }
  if (NINE) {
    for (const f of FILES) {
      const name = path.basename(f, '.js');
      const a = await serve();
      const b = await serve();
      const log = path.join(OUT, `nine-${name}.log`);
      let r;
      try {
        r = await run(path.join(ROOT, f), [], { SIGN_PORT: String(a.address().port), PORT: String(b.address().port) }, log);
      } finally {
        a.close();
        b.close();
      }
      const pass = r.code === 0;
      console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} (${r.s} s) - ${lastLine(log)}`);
      if (!pass) failed.push(`${name} (exit ${r.code})`);
    }
  }
  console.log(failed.length ? `EARLIER: FAIL - ${failed.join('; ')}` : 'EARLIER: PASS');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.log(`EARLIER: FAIL - the check itself stopped: ${String((e && e.stack) || e).slice(0, 600)}`);
  process.exit(1);
});
