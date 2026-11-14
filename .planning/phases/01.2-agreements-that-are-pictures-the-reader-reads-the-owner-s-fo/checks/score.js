#!/usr/bin/env node
/*
 * The independent scorer, run against the checkout this file lives in, and a named gate applied to what it wrote.
 *
 *   node score.js --only a,e --gate baseline [--out <folder outside the repository>]
 *   node score.js --self-test     the scorer's own self-test (no browser): passes only when the scorer exits 0
 *
 * The scorer and the documents it reads are outside the repository (PICTURE_SCRATCH, or the session's folder under
 * the system temp folder; PROOF_DIR overrides the scorer's own folder). Nothing is copied and nothing is written
 * inside the repository: the run's evidence goes to a folder under <scratch>/exec-012 named after the parts and the
 * time. When the scorer, the proof runner or a document a requested part needs is missing, one line starting
 * "NOT RUN: " says what, and the exit status is 2: that is never a pass.
 *
 * Gates (--gate takes one or several, separated by commas), read from printed/score.json and results-<parts>.json:
 *   baseline   part a: at least 235 places found, at most 1 stray, no overlap; part e, when it ran, has no failed row
 *   places     part a: 241 of 241 places found, no stray, no overlap
 *   kinds      places, and no kind differs from the answer sheet
 *   owners     kinds, and no owner differs, and every field is marked for review
 *   full       owners; "safe by default" passed; no failed row at all; the read summary says truthfully whose
 *              signature lines were found and on which pages (computed from the answer sheet)
 *   rows       no row of the parts run is marked FAIL
 *   speed      a document is read within its pages x 6 s + 3 s (the form, the scanned example) or its pages x 2 s + 3 s
 *              (the scan of running text), and progress was seen while the form was read
 *   pictures   part a: editor-p01.png to editor-p08.png and compare-p01.png to compare-p08.png are in printed/, each
 *              1440 pixels wide and 1440 x the page's height over its width high within 4 pixels (the page sizes from
 *              the PDF, the picture's size from its own header), and the scorer's row about the editor pictures passed
 * The last line is "GATE <names>: PASS" or "GATE <names>: FAIL - <each failed condition with its numbers>";
 * exit status 0 or 1. A reading that had not finished in the time the scorer allows is not a result: run it again.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const PROOF = process.env.PROOF_DIR || path.join(SCRATCH, 'build/proof');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const list = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const ONLY = list(arg('--only', 'a,e'));
const GATES = list(arg('--gate', ''));
const TAG = ONLY.join('');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
const OUT = path.resolve(arg('--out', path.join(SCRATCH, 'exec-012', `score-${TAG}-${stamp}-${process.pid}`)));

const notRun = (what) => {
  console.log('NOT RUN: ' + what);
  process.exit(2);
};
const TRUTH_DIR = path.join(SCRATCH, 'build/ocr-truth');
const SHEET = path.join(TRUTH_DIR, 'truth-printed.json');
const NEEDS = {
  a: [process.env.PRINTED_PDF || path.join(SCRATCH, 'xx/printed-no-text.pdf')],
  b: [path.join(TRUTH_DIR, 'example-scan.pdf'), path.join(PROOF, 'ref-example-47.json')],
  c: [path.join(TRUTH_DIR, 'example-outlined.pdf'), path.join(PROOF, 'ref-example-47.json')],
  d: [path.join(TRUTH_DIR, 'prose-scan.pdf'), path.join(TRUTH_DIR, 'prose-outlined.pdf')],
  e: [process.env.EXAMPLE_PDF || path.join(SCRATCH, 'real-agreement/agreement.pdf')]
};
// The part a gate reads; a gate named without its part cannot be judged.
const GATE_PART = { baseline: 'a', places: 'a', kinds: 'a', owners: 'a', full: 'a', pictures: 'a' };
const KNOWN = ['baseline', 'places', 'kinds', 'owners', 'full', 'rows', 'speed', 'pictures'];

/* ---------- the scorer's own self-test ---------- */
if (process.argv.includes('--self-test')) {
  if (!fs.existsSync(path.join(PROOF, 'score-notext.js'))) notRun('the scorer is not at ' + path.join(PROOF, 'score-notext.js'));
  if (!fs.existsSync(SHEET)) notRun('the answer sheet is not at ' + SHEET);
  let mods = '';
  try {
    mods = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  } catch (e) {
    notRun('"npm root -g" did not answer, so the browser library cannot be found');
  }
  const st = spawnSync('node', [path.join(PROOF, 'score-notext.js'), '--self-test'], { env: Object.assign({}, process.env, { NODE_PATH: mods }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = String(st.stdout || '').split('\n').filter((l) => /^(PASS|FAIL) /.test(l) || /passed, \d+ failed/.test(l));
  lines.forEach((l) => console.log(l));
  console.log(st.status === 0 ? 'SELF-TEST: PASS' : `SELF-TEST: FAIL - the scorer's self-test exited ${st.status}${st.stderr ? ': ' + String(st.stderr).trim().split('\n').slice(-2).join(' | ').slice(0, 300) : ''}`);
  process.exit(st.status === 0 ? 0 : 1);
}

/* ---------- what must be there ---------- */
if (!ONLY.length || ONLY.some((p) => !NEEDS[p])) notRun(`--only ${arg('--only', '')} names a part that does not exist (a, b, c, d, e)`);
if (GATES.some((g) => !KNOWN.includes(g))) notRun(`--gate ${GATES.join(',')} names a gate that does not exist (${KNOWN.join(', ')})`);
if (!fs.existsSync(path.join(PROOF, 'score-notext.js'))) notRun('the scorer is not at ' + path.join(PROOF, 'score-notext.js'));
if (!fs.existsSync(path.join(PROOF, 'proof.js'))) notRun('the proof runner is not at ' + path.join(PROOF, 'proof.js'));
if (!fs.existsSync(SHEET)) notRun('the answer sheet is not at ' + SHEET);
ONLY.forEach((p) => NEEDS[p].forEach((f) => fs.existsSync(f) || notRun(`part ${p} needs ${f}, which is missing`)));
GATES.forEach((g) => GATE_PART[g] && !ONLY.includes(GATE_PART[g]) && notRun(`the gate "${g}" reads part ${GATE_PART[g]}, which --only ${ONLY.join(',')} does not run`));
if (GATES.includes('speed') && !['a', 'b', 'd'].some((p) => ONLY.includes(p))) notRun('the gate "speed" reads part a, b or d, and none of them is run');
if (OUT === ROOT || OUT.startsWith(ROOT + path.sep)) notRun('--out is inside the repository: evidence is kept outside it');

/* ---------- the run ---------- */
let modules = '';
try {
  modules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
} catch (e) {
  notRun('"npm root -g" did not answer, so the browser library cannot be found');
}
fs.mkdirSync(OUT, { recursive: true });
console.log(`scoring ${ROOT} (parts ${ONLY.join(',')}); evidence in ${OUT}`);
const run = spawnSync('node', [path.join(PROOF, 'score-notext.js'), '--root', ROOT, '--only', ONLY.join(','), '--out', OUT], { env: Object.assign({}, process.env, { NODE_PATH: modules }), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const log = (run.stdout || '') + (run.stderr ? '\n--- what the scorer wrote as errors ---\n' + run.stderr : '');
fs.writeFileSync(path.join(OUT, 'scorer.log'), log);
const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  } catch (e) {
    return null;
  }
};
const table = path.join(OUT, `table-${TAG}.txt`);
const results = read(`results-${TAG}.json`);
if (fs.existsSync(table)) console.log(fs.readFileSync(table, 'utf8').trimEnd());
const names = GATES.join(',') || '(none)';
const done = (fails) => {
  console.log(fails.length ? `GATE ${names}: FAIL - ${fails.join('; ')}` : `GATE ${names}: PASS`);
  process.exit(fails.length ? 1 : 0);
};
if (!results || !Array.isArray(results.rows)) {
  const tail = String(run.stderr || run.stdout || (run.error && run.error.message) || '').trim().split('\n').slice(-6).join(' | ').slice(0, 700);
  done([`the scorer wrote no results (exit status ${run.status}): ${tail || 'it said nothing'}`]);
}
if (!GATES.length) {
  console.log('no gate was named (--gate): the table above is the scorer\'s own, and nothing was judged here');
  process.exit(run.status ? 1 : 0);
}

/* ---------- the gates ---------- */
const rows = results.rows;
const score = ONLY.includes('a') ? read('printed/score.json') : null;
const sheet = JSON.parse(fs.readFileSync(SHEET, 'utf8'));
const fails = [];
const need = (ok, what) => ok || fails.includes(what) || fails.push(what);
const failed = (part) => rows.filter((r) => r.mark === 'FAIL' && (!part || r.part === part));
const short = (r) => `[${r.part}] ${String(r.name).replace(/"[^"]*"/g, '"…"').slice(0, 110)}`;
const total = score && score.total;
const has = (g) => GATES.includes(g);

if (ONLY.includes('a')) {
  if (!total) need(false, 'part a wrote no score for the form (printed/score.json)');
  // A reading cut off by the scorer's own time limit is not a result.
  else if (score.offer && score.offer.found && !score.offer.finished) need(false, `the reading of the form had not finished after ${Math.round(score.offer.ms / 1000)} s (not a result: wait and run again)`);
}
const places = () => {
  need(total.found === 241 && total.places === 241, `found ${total.found} of ${total.places} places, not 241 of 241`);
  need(total.strays.length === 0, `${total.strays.length} stray field${total.strays.length === 1 ? '' : 's'}`);
  need(total.overlaps.length === 0, `${total.overlaps.length} overlapping pair${total.overlaps.length === 1 ? '' : 's'}`);
};
const kindsOk = () => {
  places();
  need(total.kindDiff.length === 0, `the kind differs on ${total.kindDiff.length} of ${total.found} matched`);
};
const owners = () => {
  kindsOk();
  need(total.ownerDiff.length === 0, `the owner differs on ${total.ownerDiff.length} of ${total.found} matched`);
  const fields = total.found + total.strays.length;
  need(total.marked === fields, `${total.marked} of ${fields} fields are marked for review, not all`);
};
// Page numbers as the read summary writes them: "page 5", "pages 5 and 6", "pages 1 to 3, 5 and 7".
const pagesText = (pages) => {
  const runs = [];
  pages.forEach((p) => {
    const last = runs[runs.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else runs.push([p, p]);
  });
  const parts = runs.map((r) => (r[0] === r[1] ? `${r[0]}` : r[1] === r[0] + 1 ? `${r[0]}, ${r[1]}` : `${r[0]} to ${r[1]}`));
  return pages.length === 1 ? `page ${parts[0]}` : parts.length === 1 ? `pages ${parts[0].replace(', ', ' and ')}` : `pages ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};
const signedOn = (whose) => Array.from(new Set(sheet.fields.filter((f) => f.kind === 'signature' && f.whose === whose).map((f) => f.page))).sort((a, b) => a - b);

if (total) {
  if (has('baseline')) {
    need(total.found >= 235, `found ${total.found} of ${total.places} places, under the 235 of the baseline`);
    need(total.strays.length <= 1, `${total.strays.length} stray fields, over the 1 of the baseline`);
    need(total.overlaps.length === 0, `${total.overlaps.length} overlapping pair${total.overlaps.length === 1 ? '' : 's'}`);
    if (ONLY.includes('e')) failed('e').forEach((r) => need(false, 'failed: ' + short(r)));
  }
  if (has('places')) places();
  if (has('kinds')) kindsOk();
  if (has('owners')) owners();
  if (has('full')) {
    owners();
    const safe = rows.find((r) => r.part === 'a' && /safe by default/.test(r.name));
    need(!!safe && safe.mark === 'PASS', 'the row "safe by default" of part a is not marked PASS');
    failed().forEach((r) => need(false, 'failed: ' + short(r)));
    const note = String(score.note || '').replace(/[‘’]/g, "'");
    [
      ['investor', (on) => `The investor's signature line was found on ${on}.`],
      ['co-investor/second signer', (on) => `The co-investor's signature line was found on ${on}.`],
      ['unclear', (on) => `Signature lines for other people (a custodian, a broker, a representative or the like) were found on ${on}. Nobody is asked to sign them.`]
    ].forEach(([whose, say]) => {
      const pages = signedOn(whose);
      if (pages.length) need(note.includes(say(pagesText(pages))), `the read summary does not say: "${say(pagesText(pages))}"`);
    });
  }
}
if (has('rows')) failed().forEach((r) => need(false, 'failed: ' + short(r)));
if (has('pictures') && total) {
  // The size of a PNG from its own header (width and height, big-endian, at bytes 16 to 23).
  const pngSize = (f) => {
    const b = Buffer.alloc(24);
    const fd = fs.openSync(f, 'r');
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    return b.toString('ascii', 12, 16) === 'IHDR' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
  };
  let sizes = [];
  try {
    const pdf = NEEDS.a[0];
    const info = execFileSync('pdfinfo', ['-f', '1', '-l', '8', pdf], { encoding: 'utf8' });
    for (const m of info.matchAll(/Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts/g)) sizes[+m[1] - 1] = { w: +m[2], h: +m[3] };
    for (const m of info.matchAll(/Page\s+(\d+) rot:\s+(\d+)/g)) if (+m[2] % 180 === 90 && sizes[+m[1] - 1]) sizes[+m[1] - 1] = { w: sizes[+m[1] - 1].h, h: sizes[+m[1] - 1].w };
  } catch (e) {
    need(false, 'the page sizes of the form could not be read with pdfinfo');
  }
  const printed = path.join(OUT, 'printed');
  for (let i = 1; i <= 8; i++) {
    const nn = String(i).padStart(2, '0');
    ['editor', 'compare'].forEach((kind) => {
      const f = path.join(printed, `${kind}-p${nn}.png`);
      if (!fs.existsSync(f)) return need(false, `${kind}-p${nn}.png is missing`);
      const sz = pngSize(f);
      if (!sz) return need(false, `${kind}-p${nn}.png is not a PNG`);
      need(sz.w === 1440, `${kind}-p${nn}.png is ${sz.w} pixels wide, not 1440`);
      const pg = sizes[i - 1];
      if (pg) {
        const want = (1440 * pg.h) / pg.w;
        need(Math.abs(sz.h - want) <= 4, `${kind}-p${nn}.png is ${sz.h} pixels high, not ${want.toFixed(1)} (within 4) for its page of ${pg.w} x ${pg.h} pt`);
      } else need(false, `the size of page ${i} is not known`);
    });
  }
  const row = rows.find((r) => r.part === 'a' && /editor pictures, one per page/.test(r.name));
  need(!!row && row.mark === 'PASS', 'the scorer\'s row about the editor pictures is not marked PASS');
  console.log(`pictures: ${printed}`);
}
if (has('speed')) {
  const pagesOf = (file) => {
    const m = new RegExp(`PART \\w\\s+${file.replace('.', '\\.')} \\((\\d+) pages\\)`).exec(run.stdout || '');
    return m ? +m[1] : 0;
  };
  // The time a row of the scorer states for a document: its name ends "reading N s)".
  const rowSecs = (part, name) => {
    const r = rows.find((x) => x.part === part && x.name.indexOf(name + ' ') === 0 && /reading [\d.]+ s\)$/.test(x.name));
    return r ? +/reading ([\d.]+) s\)$/.exec(r.name)[1] : null;
  };
  const within = (what, secs, pages, each) => {
    if (secs == null || !pages) return need(false, `${what}: its reading time or its number of pages was not reported`);
    need(secs <= pages * each + 3, `${what}: read in ${secs.toFixed(1)} s, over the ${pages * each + 3} s allowed for ${pages} pages`);
  };
  if (ONLY.includes('a') && score) {
    within('the form', score.offer && score.offer.found ? score.offer.ms / 1000 : null, sheet.pages || pagesOf('printed-no-text.pdf'), 6);
    need(!!(score.offer && score.offer.progressSeen), 'no progress was seen while the form was read');
  }
  if (ONLY.includes('b')) within('the scanned example', rowSecs('b', 'example-scan'), pagesOf('example-scan.pdf'), 6);
  if (ONLY.includes('d')) within('the scan of running text', rowSecs('d', 'prose-scan'), pagesOf('prose-scan.pdf'), 2);
}
done(fails);
