/*
 * Placement accuracy over generated agreements, through the real upload path.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/accuracy.js
 *   --only a,b     run only these fixtures
 *   --baseline     report without failing (used once against the code as it was before this phase)
 *   --quiet        the closing table only
 *
 * For every printed blank the report says whether the right kind of field rests on its line for the right signer
 * (see sits and wrong in harness.js for the exact rule), and it counts confident mistakes: fields the portal placed
 * at high confidence that are on no blank, or are the wrong kind, signer, label or prefill for theirs. A confident
 * mistake anywhere fails the run. Anything the portal could not place correctly has to be marked for review instead.
 *
 * What fails the run besides that: a blank without its field in the fixtures the rules were built on (every fixture
 * not marked heldOut); a review mark in a fixture marked clean; an agreement saved, or held back, against its fixture's
 * `saves`; a field that should carry a review mark (flag) and does not. Exit code 1 on any failure.
 */
const H = require('./harness');
const { CSS, FIXTURES } = require('./fixtures');

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name) >= 0;
const value = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] || '' : '');
const BASELINE = flag('--baseline');
const QUIET = flag('--quiet');
const ONLY = value('--only').split(',').map((s) => s.trim()).filter(Boolean);
// The code as it was before this phase, measured with --baseline on the three fixtures that existed then (classic,
// caption, blank): no blank had a field on it and every agreement was saved for onboarding with nobody looking.
const BEFORE = { blanks: 15, right: 0, savedUnseen: 3, of: 3 };

const where = (e) => `p${e.page} ${e.type}/${e.role}${e.forType ? '/' + e.forType : ''}`;
const spot = (e) => (e.box ? `box x ${e.box.x0.toFixed(0)}-${e.box.x1.toFixed(0)} y ${e.box.y0.toFixed(0)}-${e.box.y1.toFixed(0)}` : `x ${e.x0.toFixed(0)}-${e.x1.toFixed(0)}  line y ${e.line.toFixed(0)}`);
const box = (f) => `x ${f.x0.toFixed(0)}-${f.x1.toFixed(0)}  y ${f.top.toFixed(0)}-${f.bottom.toFixed(0)}`;
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  const names = Object.keys(FIXTURES).filter((n) => !ONLY.length || ONLY.indexOf(n) >= 0);
  const unknown = ONLY.filter((n) => !FIXTURES[n]);
  if (unknown.length) throw new Error('Unknown fixture: ' + unknown.join(', '));
  const h = await H.start();
  const failed = [];
  const rows = [];
  try {
    const page = await H.signUp(h, 'Northgate Capital');
    for (const name of names) {
      const fx = FIXTURES[name];
      const { expect, out } = await H.run(h, page, FIXTURES, CSS, name);
      const j = H.judge(expect, out.fields);
      const sig = j.blanks.filter((b) => !b.e.fillIn);
      const fill = j.blanks.filter((b) => b.e.fillIn);
      const missed = j.blanks.filter((b) => b.state !== 'right');
      rows.push({ name, heldOut: !!fx.heldOut, first: fx.first || null, blanks: expect.length, right: j.right, sig: sig.length, sigRight: sig.filter((b) => b.state === 'right').length, fill: fill.length, fillRight: fill.filter((b) => b.state === 'right').length, fields: out.fields.length, mistakes: j.mistakes.length, flagged: j.flagged, strays: j.strays.length, saved: out.saved });
      const fails = [];
      if (!BASELINE) {
        j.mistakes.forEach((f) => fails.push(`confident mistake: a ${f.type} field for the ${f.role} at high confidence is not right (page ${f.page}, ${box(f)}${f.label ? ', "' + f.label + '"' : ''})`));
        if (!fx.heldOut) missed.forEach((b) => fails.push(`${where(b.e)} at ${spot(b.e)}: ${b.state === 'none' ? 'no field on it' : b.state}`));
        if (fx.clean && j.flagged) fails.push(`${j.flagged} field(s) marked for review in a layout the portal should be sure about`);
        if (fx.saves === true && !out.saved) fails.push(`not saved at once: ${out.todo}`);
        if (fx.saves === false && out.saved) fails.push('saved for onboarding with nobody looking at it');
        j.blanks.filter((b) => b.e.flag && b.f && !b.f.review).forEach((b) => fails.push(`${where(b.e)} should carry a review mark and does not`));
        if (name === 'blank' && out.fields.some((f) => f.conf !== 'low')) fails.push('a fallback field is not low confidence');
        if (name === 'blank' && !out.fields.length) fails.push('no fallback fields were placed');
        if (fx.countersign === false && out.fields.some((f) => f.role === 'firm')) fails.push('a field for the firm although it does not countersign');
      }
      if (!QUIET) {
        console.log(`\n${name}: ${expect.length} printed blanks, ${out.fields.length} fields placed, ${j.right} right, ${j.mistakes.length} confident mistakes, ${j.flagged} marked for review, saved at once: ${out.saved}`);
        j.blanks.forEach((b) => console.log(`  blank  ${pad(where(b.e), 28)} ${pad(spot(b.e), 34)} ${b.state === 'right' ? 'ok' + (b.f.review ? ' (marked for review)' : '') : b.state === 'none' ? '<- no field on it' : '<- ' + b.state}`));
        out.fields.forEach((f) => console.log(`  field  ${pad(where(f), 28)} ${pad(box(f), 34)} ${f.conf || 'no confidence'}${f.label ? '  "' + f.label + '"' : ''}${f.prefill ? '  <' + f.prefill + '>' : ''}${f.type !== 'date' && !f.required ? '  optional' : ''}${f.why ? '  (' + f.why + ')' : ''}${j.strays.indexOf(f) >= 0 ? '   <- on no printed blank' : ''}`));
        if (!out.saved && out.todo) console.log(`  not saved: ${out.todo}`);
      }
      fails.forEach((s) => console.log(`  FAIL  ${name}: ${s}`));
      if (fails.length) failed.push(name);
    }
  } finally {
    await h.stop();
  }
  const sum = (k, list) => list.reduce((a, r) => a + r[k], 0);
  const line = (r) => `${pad(r.name, 16)}${pad(r.sigRight + '/' + r.sig, 12)}${pad(r.fillRight + '/' + r.fill, 12)}${pad(r.right + '/' + r.blanks, 10)}${pad(r.mistakes, 10)}${pad(r.flagged, 9)}${pad(r.blanks - r.right, 12)}${r.saved ? 'yes' : 'held'}`;
  console.log(`\n${pad('layout', 16)}${pad('sig block', 12)}${pad('fill-in', 12)}${pad('right', 10)}${pad('confident', 10)}${pad('review', 9)}${pad('not placed', 12)}saved`);
  console.log(`${pad('', 16)}${pad('blanks', 12)}${pad('blanks', 12)}${pad('', 10)}${pad('mistakes', 10)}${pad('marks', 9)}${pad('right', 12)}at once`);
  const note = (r) => (r.heldOut ? '   (held out: written after the rules, never used to change them)' : r.first ? `   (${r.first.heldOut ? 'the held-out layout' : 'written after the rules'}; first run ${r.first.right}/${r.first.blanks} right, ${r.first.mistakes} confident mistake${r.first.mistakes === 1 ? '' : 's'}, ${r.first.marks} mark${r.first.marks === 1 ? '' : 's'}; rules improved since)` : '');
  rows.forEach((r) => console.log(line(r) + note(r)));
  if (rows.length > 1) console.log(line({ name: 'TOTAL', sig: sum('sig', rows), sigRight: sum('sigRight', rows), fill: sum('fill', rows), fillRight: sum('fillRight', rows), blanks: sum('blanks', rows), right: sum('right', rows), mistakes: sum('mistakes', rows), flagged: sum('flagged', rows), saved: false }).replace(/held$/, ''));
  console.log(`\nBEFORE THIS PHASE (classic, caption, blank as they were then): ${BEFORE.right} of ${BEFORE.blanks} printed blanks had a field on them; ${BEFORE.savedUnseen} of ${BEFORE.of} agreements were saved with nobody looking.`);
  console.log(`NOW: ${sum('right', rows)} of ${sum('blanks', rows)} printed blanks have the right field on them; ${sum('mistakes', rows)} confident mistakes.`);
  const firsts = rows.filter((r) => r.first);
  if (firsts.length) console.log(`FIRST RUNS of the layouts written after the rules, before any rule knew them: ${firsts.map((r) => `${r.name} ${r.first.right}/${r.first.blanks} right with ${r.first.mistakes} confident mistake${r.first.mistakes === 1 ? '' : 's'}`).join('; ')}.`);
  console.log(h.errors.length ? 'PAGE ERRORS ' + h.errors.join(' | ') : 'NO PAGE ERRORS');
  if (h.errors.length && !BASELINE) failed.push('page errors');
  if (failed.length) {
    console.log('FAILED: ' + failed.join(', '));
    process.exit(1);
  }
  console.log(BASELINE ? 'BASELINE REPORTED' : 'PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
