/*
 * Placement accuracy over generated agreements, through the real upload path.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/accuracy.js
 *   --only a,b     run only these fixtures
 *   --baseline     report without failing (used once against the code as it was before this phase)
 *   --quiet        the closing table only
 *   --shots dir    write a picture of every page of each failing fixture into dir (places in green, fields in blue,
 *                  mistakes in red)
 *
 * The rule: a field is placed only on something the page prints (a line, a blank, a tick box, a signature line),
 * and every such place gets the right field. For every printed place the report says whether the right kind of field
 * rests on it for the right signer and covers its ink (see on, covers and wrong in harness.js for the exact rule).
 *
 * What fails the run:
 *   - a field on no printed place of the fixture, at ANY confidence (nothing is made up: no block on the last page,
 *     no field after a label with no line), and a field on a place that must stay empty;
 *   - two fields lying over one another;
 *   - a field the reading placed that does not carry its kind and the reading's record of it (placed);
 *   - a field placed at high confidence that is the wrong kind, signer, label or prefill for its place;
 *   - a printed place without its right field in the fixtures the rules were built on (every fixture not marked
 *     heldOut or measured), and more such places in a measured layout than it had when it was measured;
 *   - who signs not following the reading: a field for the firm when the agreement prints no signature line for it
 *     (its blanks stay empty and the reading counts them), the firm missing from the saved agreement when it prints
 *     one, the pages named for each signer's signature line not being the pages that print one;
 *   - an agreement with no signature line for the investor being saved, or not saying so;
 *   - a review mark in a fixture marked clean, a number of marks other than the fixture's `marks`, a field that
 *     should carry a review mark (flag) and does not; an agreement saved, or held back, against its fixture's `saves`.
 * Exit code 1 on any failure.
 */
const H = require('./harness');
const { CSS, FIXTURES } = require('./fixtures');

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name) >= 0;
const value = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] || '' : '');
const BASELINE = flag('--baseline');
const QUIET = flag('--quiet');
const ONLY = value('--only').split(',').map((s) => s.trim()).filter(Boolean);
const SHOTS = value('--shots');
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
      const { expect, out, bytes } = await H.run(h, page, FIXTURES, CSS, name);
      const j = H.judge(expect, out.fields);
      const places = expect.filter((e) => !e.none);
      const sig = j.blanks.filter((b) => !b.e.fillIn);
      const fill = j.blanks.filter((b) => b.e.fillIn);
      const missed = j.blanks.filter((b) => b.state !== 'right');
      rows.push({ name, heldOut: !!fx.heldOut, first: fx.first || null, blanks: places.length, right: j.right, sig: sig.length, sigRight: sig.filter((b) => b.state === 'right').length, fill: fill.length, fillRight: fill.filter((b) => b.state === 'right').length, fields: out.fields.length, mistakes: j.mistakes.length, flagged: j.flagged, strays: j.strays.length, saved: out.saved });
      const fails = [];
      if (!BASELINE) {
        // Nothing is made up: every field rests on a printed place, whatever the portal's confidence in it.
        j.strays.forEach((f) => fails.push(`a ${f.type} field for the ${f.role} is on no printed place (page ${f.page}, ${box(f)}, ${f.conf || 'no'} confidence${f.label ? ', "' + f.label + '"' : ''})`));
        j.empties.filter((x) => x.f).forEach((x) => fails.push(`a ${x.f.type} field for the ${x.f.role} where none belongs: ${x.e.none} (page ${x.f.page}, ${box(x.f)})`));
        j.overlaps.forEach(([a, b]) => fails.push(`two fields lie over one another on page ${a.page}: ${a.type} at ${box(a)} and ${b.type} at ${box(b)}`));
        j.bare.forEach((f) => fails.push(`a ${f.type} field the reading placed does not carry ${f.kindOk ? '' : 'its kind'}${f.kindOk || f.placedOk ? '' : ' and '}${f.placedOk ? '' : 'the reading’s record of it (placed)'} (page ${f.page}, ${box(f)})`));
        j.blanks.filter((b) => b.f && b.state !== 'right' && b.f.conf === 'high').forEach((b) => fails.push(`confident mistake: the ${b.f.type} field at high confidence on ${where(b.e)} at ${spot(b.e)} is ${b.state}`));
        if (!fx.heldOut && !fx.measured) missed.filter((b) => !(b.f && b.f.conf === 'high')).forEach((b) => fails.push(`${where(b.e)} at ${spot(b.e)}: ${b.state === 'none' ? 'no field on it' : b.state}`));
        // A layout left as measured may have no more places without their right field than it had when it was measured.
        if (fx.measured && missed.length > fx.measured) fails.push(`${missed.length} printed places are without their right field; ${fx.measured} were when this layout was measured: ${missed.map((b) => `${where(b.e)} at ${spot(b.e)} (${b.state === 'none' ? 'no field' : b.state})`).join('; ')}`);
        const marks = fx.clean ? 0 : fx.marks;
        if (fx.clean && j.flagged) fails.push(`${j.flagged} field(s) marked for review in a layout the portal should be sure about`);
        else if (marks != null && j.flagged !== marks) fails.push(`${j.flagged} field(s) marked for review, not ${marks}`);
        out.fields.filter((f) => f.review !== (f.conf !== 'high') || (f.review && !f.why)).forEach((f) => fails.push(`a ${f.type} field at ${f.conf} confidence ${f.review ? 'is marked for review with no reason' : 'is not marked for review'} (page ${f.page}, ${box(f)})`));
        if (fx.saves === true && !out.saved) fails.push(`cannot be saved as read: ${out.todo}`);
        if (fx.saves === false && out.saved) fails.push('saved for onboarding although something should hold it');
        if (fx.todo && !out.saved && !fx.todo.test(out.todo)) fails.push(`held, but not for the reason expected: "${out.todo}"`);
        j.blanks.filter((b) => b.e.flag && b.f && !b.f.review).forEach((b) => fails.push(`${where(b.e)} should carry a review mark and does not`));
        // Who signs follows the reading of the agreement.
        const read = out.read || {};
        const sigPages = (role) => Array.from(new Set(places.filter((e) => e.role === role && e.type === 'signature' && !e.second).map((e) => e.page))).sort((a, b) => a - b);
        const same = (a, b) => JSON.stringify((a || []).slice().sort((x, y) => x - y)) === JSON.stringify(b);
        const firmFields = out.fields.filter((f) => f.role === 'firm').length;
        if (!sigPages('firm').length && firmFields) fails.push(`${firmFields} field(s) for the firm although the agreement prints no signature line for it`);
        if (!fx.heldOut && !fx.measured) {
          if (!same(read.investorPages, sigPages('investor'))) fails.push(`the investor’s signature line was read on page(s) [${read.investorPages}], and is printed on [${sigPages('investor')}]`);
          if (!same(read.firmPages, sigPages('firm'))) fails.push(`the firm’s signature line was read on page(s) [${read.firmPages}], and is printed on [${sigPages('firm')}]`);
        }
        if (fx.signs && JSON.stringify(out.roles) !== JSON.stringify(fx.signs)) fails.push(`the saved agreement is signed by [${out.roles}], not [${fx.signs}]`);
        if (out.saved && (out.roles.indexOf('Sponsor') >= 0) !== firmFields > 0) fails.push(`the saved agreement ${out.roles.indexOf('Sponsor') >= 0 ? 'has the firm sign with no field for it' : 'leaves the firm out although it has fields'}`);
        if (fx.firmLeft != null && (read.firmLeft !== fx.firmLeft || !new RegExp(`your firm does not sign this agreement and ${fx.firmLeft} blanks? that reads? as your firm’s got no field`).test(out.note))) fails.push(`the reading should say ${fx.firmLeft} of the firm’s blanks got no field: firmLeft ${read.firmLeft}, note "${out.note}"`);
        // An agreement with no signature line for the investor cannot be used, and says so.
        if (!sigPages('investor').length && !(read.investorPages || []).length) {
          if (out.saved) fails.push('saved although it has no signature line for the investor');
          if (!/No signature line for the investor was found/.test(out.note)) fails.push(`the read summary does not say that no signature line for the investor was found: "${out.note}"`);
          if (!/No signature line for the investor was found/.test(out.settled)) fails.push(`with every review mark confirmed it could be saved although it has no signature line for the investor (what stops it then: "${out.settled}")`);
        }
        if (fx.nothing && out.fields.length) fails.push(`${out.fields.length} field(s) placed on pages that print no place for one`);
        if (fx.nothing && !/no line, blank or tick box to complete was found, so no field was placed/.test(out.note)) fails.push(`the read summary does not say that nothing was found: "${out.note}"`);
        // The read summary counts what got a field, and only that.
        const n = (t) => out.fields.filter(t).length;
        const counts = [n((f) => f.type === 'checkbox'), n((f) => f.type !== 'checkbox' && f.type !== 'signature' && f.type !== 'initials'), n((f) => f.type === 'signature' || f.type === 'initials')];
        if (read.ok && (read.boxes !== counts[0] || read.blanks !== counts[1] || read.signatures !== counts[2])) fails.push(`the read summary counts ${read.boxes} tick boxes, ${read.blanks} blanks and ${read.signatures} signature lines; the fields are ${counts.join(', ')}`);
      }
      if (!QUIET) {
        console.log(`\n${name}: ${places.length} printed places, ${out.fields.length} fields placed, ${j.right} right, ${j.mistakes.length} mistakes, ${j.flagged} marked for review, can be saved as read: ${out.saved}${out.saved ? ' (signed by ' + out.roles.join(' and ') + ')' : ''}`);
        j.blanks.forEach((b) => console.log(`  blank  ${pad(where(b.e), 28)} ${pad(spot(b.e), 34)} ${b.state === 'right' ? 'ok' + (b.f.review ? ' (marked for review)' : '') : b.state === 'none' ? '<- no field on it' : '<- ' + b.state}`));
        j.empties.forEach((x) => console.log(`  empty  ${pad(where(x.e), 28)} ${pad(spot(x.e), 34)} ${x.f ? '<- a field where none belongs (' + x.e.none + ')' : 'ok, no field (' + x.e.none + ')'}`));
        out.fields.forEach((f) => console.log(`  field  ${pad(where(f), 28)} ${pad(box(f), 34)} ${f.conf || 'no confidence'}${f.label ? '  "' + f.label + '"' : ''}${f.prefill ? '  <' + f.prefill + '>' : ''}${f.type !== 'date' && !f.required ? '  optional' : ''}${f.second ? '  second signer' : ''}${f.why ? '  (' + f.why + ')' : ''}${j.strays.indexOf(f) >= 0 ? '   <- on no printed place' : ''}`));
        if (out.note) console.log(`  read: ${out.note}`);
        if (!out.saved && out.todo) console.log(`  not saved: ${out.todo}`);
      }
      fails.forEach((s) => console.log(`  FAIL  ${name}: ${s}`));
      if (fails.length) failed.push(name);
      if (fails.length && SHOTS) (await H.picture(page, bytes, expect, j, out.fields, SHOTS, name)).forEach((f) => console.log(`  picture  ${f}`));
    }
  } finally {
    await h.stop();
  }
  const sum = (k, list) => list.reduce((a, r) => a + r[k], 0);
  const line = (r) => `${pad(r.name, 16)}${pad(r.sigRight + '/' + r.sig, 12)}${pad(r.fillRight + '/' + r.fill, 12)}${pad(r.right + '/' + r.blanks, 10)}${pad(r.mistakes, 10)}${pad(r.flagged, 9)}${pad(r.blanks - r.right, 12)}${r.saved ? 'yes' : 'held'}`;
  console.log(`\n${pad('layout', 16)}${pad('sig block', 12)}${pad('fill-in', 12)}${pad('right', 10)}${pad('mistakes', 10)}${pad('review', 9)}${pad('not placed', 12)}saves`);
  console.log(`${pad('', 16)}${pad('blanks', 12)}${pad('blanks', 12)}${pad('', 10)}${pad('', 10)}${pad('marks', 9)}${pad('right', 12)}as read`);
  const note = (r) => (r.heldOut ? '   (held out: written after the rules, never used to change them)' : r.first ? `   (${r.first.heldOut ? 'the held-out layout' : 'written after the rules'}; first run ${r.first.right}/${r.first.blanks} right, ${r.first.mistakes} confident mistake${r.first.mistakes === 1 ? '' : 's'}, ${r.first.marks} mark${r.first.marks === 1 ? '' : 's'}; rules improved since)` : '');
  rows.forEach((r) => console.log(line(r) + note(r)));
  if (rows.length > 1) console.log(line({ name: 'TOTAL', sig: sum('sig', rows), sigRight: sum('sigRight', rows), fill: sum('fill', rows), fillRight: sum('fillRight', rows), blanks: sum('blanks', rows), right: sum('right', rows), mistakes: sum('mistakes', rows), flagged: sum('flagged', rows), saved: false }).replace(/held$/, ''));
  console.log(`\nBEFORE THIS PHASE (classic, caption, blank as they were then): ${BEFORE.right} of ${BEFORE.blanks} printed blanks had a field on them; ${BEFORE.savedUnseen} of ${BEFORE.of} agreements were saved with nobody looking.`);
  console.log(`NOW: ${sum('right', rows)} of ${sum('blanks', rows)} printed places have the right field on them; ${sum('mistakes', rows)} mistakes (a field on no printed place, on a place that stays empty, over another field, or wrong at high confidence); ${failed.length} of ${rows.length} layouts fail.`);
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
