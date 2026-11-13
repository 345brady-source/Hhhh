/*
 * Placement accuracy over generated agreements, through the real upload path.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/accuracy.js
 *   --only a,b     run only these fixtures
 *   --baseline     report without failing (used once against the code as it was before this phase)
 *
 * A field is on its blank when page, type and signer match, its left edge is within 6 pt of the blank's and its
 * bottom edge is between 2 pt above and 7 pt below the printed line. Exit code 1 when a rule fails.
 */
const H = require('./harness');
const { CSS, FIXTURES } = require('./fixtures');

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name) >= 0;
const value = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] || '' : '');
const BASELINE = flag('--baseline');
const ONLY = value('--only').split(',').map((s) => s.trim()).filter(Boolean);

/** Whether a field rests on a printed blank (same page and kind, starting where the line starts, resting on it). */
const sits = (f, e) => f.page === e.page && f.type === e.type && Math.abs(f.x0 - e.x0) <= 6 && f.bottom - e.line >= -2 && f.bottom - e.line <= 7;
const on = (f, e) => sits(f, e) && f.role === e.role;
const where = (e) => `p${e.page} ${e.type}/${e.role}`;

/** The rules a fixture must meet; each returns the sentences that failed. */
const RULES = {
  classic(expect, out) {
    const fails = [];
    const sigs = expect.filter((e) => e.type === 'signature');
    sigs.forEach((e) => {
      const f = out.fields.find((x) => on(x, e));
      if (!f) fails.push(`no signature field on the ${e.role}'s line on page ${e.page}`);
      else if (f.conf !== 'high') fails.push(`the signature field on the ${e.role}'s line on page ${e.page} is ${f.conf || 'unmarked'}, not high`);
    });
    out.fields
      .filter((f) => f.type === 'signature' && !sigs.some((e) => on(f, e)))
      .forEach((f) => fails.push(`a signature field for the ${f.role} is not on a signature line (page ${f.page}, x ${f.x0.toFixed(0)}, y ${f.top.toFixed(0)}-${f.bottom.toFixed(0)})`));
    return fails;
  },
  blank(expect, out) {
    const fails = [];
    out.fields.filter((f) => f.conf !== 'low').forEach((f) => fails.push(`a fallback ${f.type} field is ${f.conf || 'unmarked'}, not low`));
    if (!out.fields.length) fails.push('no fallback fields were placed');
    if (out.saved) fails.push('the agreement was saved for onboarding with nobody looking at it');
    return fails;
  }
};

(async () => {
  const names = Object.keys(FIXTURES).filter((n) => !ONLY.length || ONLY.indexOf(n) >= 0);
  const unknown = ONLY.filter((n) => !FIXTURES[n]);
  if (unknown.length) throw new Error('Unknown fixture: ' + unknown.join(', '));
  const h = await H.start();
  const failed = [];
  const total = { blanks: 0, on: 0, fillIn: 0, fillInOn: 0, savedUnseen: 0 };
  try {
    const page = await H.signUp(h, 'Northgate Capital');
    for (const name of names) {
      const fx = FIXTURES[name];
      const made = await H.makePdf(h, CSS, fx.html);
      const out = await H.upload(page, made.bytes, { countersign: fx.countersign, offering: fx.offering });
      const block = made.expect.filter((e) => !e.fillIn);
      const fill = made.expect.filter((e) => e.fillIn);
      const hit = (e) => out.fields.find((f) => on(f, e));
      const hits = block.filter(hit).length;
      const marks = out.fields.filter((f) => f.conf === 'medium' || f.conf === 'low').length;
      // A confident mistake: a field the portal is sure of that is not on any printed blank for that signer.
      const mistakes = out.fields.filter((f) => f.conf === 'high' && !made.expect.some((e) => on(f, e))).length;
      total.blanks += block.length;
      total.on += hits;
      total.fillIn += fill.length;
      total.fillInOn += fill.filter(hit).length;
      if (out.saved && !out.fields.some((f) => f.conf)) total.savedUnseen += 1;
      console.log(`\n${name}: ${block.length} signature-block blanks, ${out.fields.length} fields placed, ${hits} on their blank, ${mistakes} confident mistakes, ${marks} marked for review, saved without review: ${out.saved}`);
      made.expect.forEach((e) => console.log(`  blank  ${where(e)}  x ${e.x0.toFixed(0)}-${e.x1.toFixed(0)}  line y ${e.line.toFixed(0)}${e.fillIn ? '   (fill-in blank, not measured in this plan)' : hit(e) ? '' : '   <- no field on it'}`));
      out.fields.forEach((f) => console.log(`  field  ${where(f)}  x ${f.x0.toFixed(0)}-${f.x1.toFixed(0)}  y ${f.top.toFixed(0)}-${f.bottom.toFixed(0)}${f.conf ? '  ' + f.conf : ''}${f.why ? '  (' + f.why + ')' : ''}`));
      if (!out.saved && out.todo) console.log(`  not saved: ${out.todo}`);
      const fails = RULES[name] && !BASELINE ? RULES[name](made.expect, out) : [];
      fails.forEach((s) => console.log(`  FAIL  ${s}`));
      if (fails.length) failed.push(name);
    }
  } finally {
    await h.stop();
  }
  console.log(`\nTOTAL: ${total.on} of ${total.blanks} signature-block blanks have a field on them` + (total.fillIn ? `; ${total.fillInOn} of ${total.fillIn} fill-in blanks (not measured in this plan)` : '') + (BASELINE ? `; ${total.savedUnseen} agreements saved with no confidence recorded and nobody looking` : ''));
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
