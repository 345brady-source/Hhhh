// gate: browser
// last "WITHHOLDING FLOW: PASS (parts run: 9)"
// Tax withheld at a distribution on screen (plan 10-07, D-04, C-03, TAX-07, TAX-14), the way the owner sees it: the portal
// inside a sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address only, at
// 390x844 with touch or 1280x800, on the Kestrel Bay sample with the page's clock on 19 November 2026 (a Thursday). The
// part files of the other phase 10 plans (NS.taxUI PARTS other than withholding.js and withholding-ui.js) are answered 404
// in every part, so this measures the distribution screen alone.
//   propose-phone   390x844: a fund set to notes; $10,000.00 drafted: one proposed backup line for A-1002 (24%, $800.00,
//                   its reason); both buttons wait with one line; Confirm; the table shows $3,333.33, $800.00 withheld and
//                   $2,533.33 net; the ACH file pays A-1002 253,333 cents, $9,200.00 in all; the recorded run stores the
//                   withheld entry with the signed-in person and the net
//   type            the offering's page: an admin sets Tax reporting (Not set and the four labels), saved with who and when
//                   and logged; a team member sees the label and no select; not set, partnership and other propose nothing
//   propose-desktop propose-phone at 1280x800; Remove frees the buttons with nothing withheld; a new total after Confirm
//                   drops the decision; with A-1001's W-9 taken off file a second line of $1,200.00 with its own reason
//   foreign         390x844: A-1003's row "W-8BEN valid until Dec 31, 2028"; $1,666.67 entered proposes $500.00 at 30%; a
//                   rate of 10 makes it $166.67, the CPA's rate; more than the share is refused in one line; an expired
//                   W-8 says so and since when; each line waits for Confirm
//   stops           a partnership fund: the foreign row and Add tax withheld, never a backup line; the four kinds the
//                   portal never proposes, each with its one stop sentence and the investor, an amount and a reason, no
//                   rate; an entered line is confirmed like any other
//   netfile         both lines of example B confirmed: the file pays 500,000, 253,333 and 116,667 cents ($8,700.00); the
//                   record stores gross, each withheld entry in full and net; A-1002's Distributions page shows the
//                   amount, the tax withheld and the amount paid, the headline gross with "Tax withheld $800.00" under it;
//                   after A-1003's position changes, ACH file on that run builds the same three entries
//   cancel          390x844: Cancel on a History row asks for a reason, then the row reads Cancelled, the investor no
//                   longer sees the payment and the change log has it; a team member has no Cancel
//   paper-w9        a W-9 with the last four and no signature record draws a 24% line; "W-9 signed on paper" (who, when,
//                   logged, can be undone) takes it away; an uploaded W-9 with the last four offers the same; every sample
//                   investor of every firm is run through the proposal with every offering set to notes (counts printed)
//   managed         index.html at 1280x800: Record distribution as before; no Tax reporting field; no tax withheld block for
//                   a fund whose investor has a crossed-out W-9, recorded with nothing withheld; Cancel for Carrow & Vale
//                   staff and not for the sponsor's staff; neither withholding file named or asked for; index.html unchanged
//   NODE_PATH=$(npm root -g) node withholding-flow.js [--only part1,part2]
// The last line is "WITHHOLDING FLOW: PASS (parts run: N)" or "WITHHOLDING FLOW: FAIL (parts run: N) - <failed parts>".
//
// Hand-worked example B (10-05-PLAN.md), seeded on a fund added to the sample: three holders A-1001 $300,000, A-1002
// $200,000, A-1003 $100,000, each with a bank account on file; $10,000.00 gives 500,000 / 333,333 / 166,667 cents.
// A-1002's W-9 has item 2 crossed out: 24% of 333,333 = 79,999.92, so 80,000 ($800.00); net 253,333 ($2,533.33).
// A-1003 is a foreign individual with a signed W-8BEN valid until 2028-12-31: 30% of an entered 166,667 = 50,000 ($500.00),
// net 116,667; with a rate of 10 entered, 16,667. With both lines confirmed the file pays 500,000 + 253,333 + 116,667 =
// 870,000 and 870,000 + 80,000 + 50,000 = 1,000,000. Every taxpayer number here is a last four only, invented.
const path = require('path');
const fs = require('fs');
const T = require('./lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'withholding-flow');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-proposed\.png$/, 'Distributions, a notes fund, $10,000.00 drafted: the proposed backup line for A-1002 and the two buttons waiting.'],
  [/-confirmed\.png$/, 'The same after Confirm: A-1002 shows $3,333.33, $800.00 withheld and $2,533.33 net.'],
  [/-file\.png$/, 'The ACH file built from the net amounts: total credits $9,200.00.']
]);

const TODAY = '2026-11-19';
const J = (x) => JSON.stringify(x);
// The files of the other phase 10 plans beside taxdocs-ui.js: answered 404 in every part.
const OTHERS = /\/assets\/js\/(taxdocs-investor|taxrecord-ui|tax1099|tax1099-ui|taxlink)\.js$/;

/* ---------- the frame ---------- */
/** lib10's frame (scripts from the portal only), the other plans' files answered 404, withholding-ui.js given time to load. */
async function open(S, size, opts) {
  const { A } = await T.framed(S, size, Object.assign({ policy: 'self', clock: TODAY }, opts || {}));
  await A.context.route((u) => u.origin === S.origin && OTHERS.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' }));
  await A.page.reload();
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state));
  fr.p10 = { size, A };
  await loaded(fr);
  A.errors.length = 0;
  A.p10.outside.length = 0;
  return { A, fr };
}
/** Waits (a while, not for ever) for the withholding screen's script; resolves to whether it is there. */
const loaded = (fr) =>
  fr
    .waitForFunction(() => !!(window.CVPortal.withholdingUI && window.CVPortal.withholding), null, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);

async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 15000 });
  await fr.waitForTimeout(300);
}

/* ---------- example B ---------- */
/**
 * Example B on a fund added to the Kestrel Bay sample: three investors copied from activated ACH investors, with the tax
 * records the part needs. arg: { reporting: '' | key, a1001: 'signed' | 'none', expired: bool }. Resolves to the ids.
 */
function seedExampleB(w, arg) {
  const src = w.offerings.find((o) => o.status !== 'Exited') || w.offerings[0];
  const o = JSON.parse(JSON.stringify(src));
  Object.assign(o, { id: 'p10-b', name: 'Example Fund B, L.P.', shortName: 'Example Fund B', status: 'Active' });
  delete o.seed;
  delete o.tax;
  if (arg.reporting) o.tax = { reporting: arg.reporting, setBy: 'Plan 10-07 check', setAt: '2026-11-19T15:00:00.000Z' };
  w.offerings.push(o);
  const ach = w.investors.filter((i) => i.onboarding.status === 'complete' && i.payment && i.payment.method === 'ach' && i.payment.bank && i.type !== 'ira');
  const w9 = (last4, extra) => Object.assign({ form: 'W-9', signed: true, at: '2026-01-05T15:00:00.000Z', tinLast4: last4 }, extra || {});
  const recs = [
    ['A-1001', 300000, arg.a1001 === 'none' ? { taxForm: '', taxCert: null } : { taxForm: 'W-9', taxType: 'us-individual', taxCert: w9('0101') }],
    ['A-1002', 200000, { taxForm: 'W-9', taxType: 'us-individual', taxCert: w9('0202', { backupWithholding: true }) }],
    ['A-1003', 100000, { taxForm: 'W-8BEN', taxType: 'foreign-individual', taxCert: { form: 'W-8BEN', signed: true, at: '2025-02-03T15:00:00.000Z', validUntil: arg.expired ? '2025-12-31' : '2028-12-31', ftinLast4: '0303', country: 'Canada' } }]
  ];
  recs.forEach(([id, amount, tax], k) => {
    const c = JSON.parse(JSON.stringify(ach[k]));
    Object.assign(c, { id, title: `Example investor ${id}`, type: 'individual', tinLast4: '', positions: [{ offeringId: 'p10-b', amount, date: '2025-01-02' }] });
    ['taxCert', 'taxW8', 'exempt1099', 'irsNotice'].forEach((key) => delete c[key]);
    Object.assign(c, tax);
    if (!c.taxCert) delete c.taxCert;
    w.investors.push(c);
  });
  return recs.map((r) => r[0]);
}

/** On the Distributions page: Example Fund B, total amount, today, $10,000.00 typed the way a person does it. */
async function draftB(fr, dollars) {
  await go(fr, 'console-distributions', '[data-action=dist-record]');
  await fr.selectOption('#ds-off', 'p10-b');
  await fr.waitForFunction(() => (window.CVPortal.state.ui.dist || {}).offeringId === 'p10-b');
  await fr.waitForTimeout(200);
  if (!(await fr.evaluate(() => !!document.getElementById('ds-total')))) await T.press(fr, 'input[name=ds-mode][value=total]');
  await fr.waitForSelector('#ds-total');
  await fr.fill('#ds-date', TODAY);
  await fr.waitForFunction((day) => (document.getElementById('ds-date') || {}).value === day && !!document.getElementById('ds-total'), TODAY);
  await fr.fill('#ds-total', dollars);
  await fr.waitForTimeout(400);
}
/** What the tax withheld block and the buttons show now. */
const screen = (fr) =>
  fr.evaluate(() => {
    const t = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
    const box = document.getElementById('ds-tax');
    const rows = box ? Array.from(box.querySelectorAll('[data-wh]')).map((el) => ({ key: el.getAttribute('data-wh'), investor: el.getAttribute('data-investor'), kind: el.getAttribute('data-kind'), text: t(el), confirm: !!el.querySelector('[data-action=wh-confirm]'), remove: !!el.querySelector('[data-action=wh-remove]') })) : [];
    const file = document.querySelector('[data-action=nacha-build]');
    const rec = document.querySelector('[data-action=dist-record]');
    const bar = rec && rec.parentElement;
    const why = bar ? Array.from(bar.querySelectorAll(':scope > .cs-hint')).map(t) : [];
    const alloc = Array.from(document.querySelectorAll('#ds-alloc tbody tr')).map(t);
    return { block: t(box), rows, fileOff: !!(file && file.disabled), recOff: !!(rec && rec.disabled), why, alloc };
  });
const proposed = (s, kind) => s.rows.filter((r) => (!kind || r.kind === kind) && r.confirm);
/** The ACH file of the draft, read from its own entry records (amount in positions 30-39, the id in 40-54). */
const fileOf = (fr) =>
  fr.evaluate(() => {
    const f = (window.CVPortal.state.ui.dist || {}).file;
    if (!f) return null;
    const entries = {};
    f.lines.filter((l) => l[0] === '6').forEach((l) => (entries[l.slice(39, 54).trim()] = Number(l.slice(29, 39))));
    const dt = Array.from(document.querySelectorAll('#ds-file dt')).find((x) => x.innerText.trim() === 'Total credits');
    return { entries, credit: f.totals.credit, shown: dt && dt.nextElementSibling ? dt.nextElementSibling.innerText.trim() : '' };
  });
async function pressRecord(fr) {
  const before = await fr.evaluate(() => window.CVPortal.state.ws.runs.map((r) => r.id));
  await T.press(fr, '[data-action=dist-record]');
  await fr.waitForTimeout(500);
  return fr.evaluate((before) => {
    const NS = window.CVPortal;
    const runs = NS.state.ws.runs;
    const key = Object.keys(localStorage).find((k) => /ws:kestrel-bay$/.test(k)) || '';
    return { added: runs.length - before.length, run: runs.find((r) => before.indexOf(r.id) < 0) || null, actor: NS.app.actor(), saved: JSON.parse(localStorage.getItem(key) || 'null'), said: ((document.getElementById('toasts') || {}).innerText || '').trim() };
  }, before);
}
const lineOf = (run, id) => ((run && run.lines) || []).find((l) => l.investorId === id) || null;

/** One size: the notes fund, the proposed line, Confirm, the table, the file and the record (example B, A-1002 only). */
async function proposeAt(size, ctx, more) {
  const { check, S } = ctx;
  const { A, fr } = await open(S, size);
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  const there = await loaded(fr);
  check('the withholding screen’s script is loaded in the self-serve console', there);
  const ids = await T.ws(fr, seedExampleB, { reporting: 'notes' });
  check('example B is seeded on a fund set to notes', J(ids) === J(['A-1001', 'A-1002', 'A-1003']), ids);
  await draftB(fr, '10000.00');
  let s = await screen(fr);
  const p = proposed(s);
  check('the tax withheld block lists one proposed line', p.length === 1, s.rows);
  const b = p[0] || { text: '' };
  check('it is A-1002’s backup withholding at 24%, $800.00, with the reason (item 2 crossed out)', b.investor === 'A-1002' && b.kind === 'backup' && /A-1002/.test(b.text) && /Backup withholding/.test(b.text) && /\b24%/.test(b.text) && /\$800\.00/.test(b.text) && /item 2 crossed out/.test(b.text) && b.remove, b);
  check('nothing is proposed for A-1001 (signed W-9) or as backup for A-1003 (valid W-8BEN)', !s.rows.some((r) => r.kind === 'backup' && r.investor !== 'A-1002'), s.rows);
  check('Generate NACHA file and Record distribution both wait', s.fileOff && s.recOff, { file: s.fileOff, rec: s.recOff });
  check('one line says a proposed line is waiting', s.why.length === 1 && /proposed/i.test(s.why[0]) && /waiting/i.test(s.why[0]), s.why);
  await A.page.screenshot({ path: path.join(OUT, `${size}-proposed.png`) });
  if (b.key) await T.press(fr, `[data-action=wh-confirm][data-key="${b.key}"]`);
  await fr.waitForTimeout(300);
  s = await screen(fr);
  const row = s.alloc.find((t) => /A-1002/.test(t)) || '';
  check('after Confirm the table shows A-1002 with $3,333.33, $800.00 withheld and $2,533.33 net', row.indexOf('$3,333.33') >= 0 && row.indexOf('$800.00') >= 0 && row.indexOf('$2,533.33') >= 0, row || s.alloc);
  check('the line reads confirmed, and both buttons can be pressed', !proposed(s).length && /Confirmed/.test(s.block) && !s.fileOff && !s.recOff && !s.why.some((x) => /waiting/i.test(x)), s);
  await A.page.screenshot({ path: path.join(OUT, `${size}-confirmed.png`) });
  await T.press(fr, '[data-action=nacha-build]');
  await fr.waitForFunction(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file), null, { timeout: 10000 }).catch(() => {});
  const f = await fileOf(fr);
  check('the ACH file pays A-1002 its net, 253,333 cents, and A-1001 500,000, A-1003 166,667', !!f && f.entries['A-1002'] === 253333 && f.entries['A-1001'] === 500000 && f.entries['A-1003'] === 166667, f && f.entries);
  check('its total credits are $9,200.00 ($10,000.00 less the one confirmed line of $800.00)', !!f && f.credit === 920000 && f.shown === '$9,200.00', f && { credit: f.credit, shown: f.shown });
  await A.page.screenshot({ path: path.join(OUT, `${size}-file.png`) });
  const r = await pressRecord(fr);
  const l = lineOf(r.run, 'A-1002');
  const w = l && l.withheld && l.withheld[0];
  check('Record distribution stores one run', r.added === 1, { added: r.added, said: r.said });
  check('its line for A-1002: gross 333,333, one withheld entry of 80,000 cents (backup, 24%, rule) confirmed by the signed-in person, net 253,333', !!l && l.grossCents === 333333 && l.withheld.length === 1 && w.kind === 'backup' && w.cents === 80000 && w.basisCents === 333333 && w.ratePct === 24 && w.source === 'rule' && /item 2/.test(w.why) && w.confirmedBy === r.actor && /^2026-11-19T/.test(w.confirmedAt) && l.netCents === 253333, l);
  check('the other two lines have nothing withheld', J(['A-1001', 'A-1003'].map((id) => { const x = lineOf(r.run, id); return x && [x.grossCents, x.withheld.length, x.netCents]; })) === J([[500000, 0, 500000], [166667, 0, 166667]]), r.run && r.run.lines);
  const saved = r.saved && (r.saved.runs || []).find((x) => r.run && x.id === r.run.id);
  check('the saved workspace holds the same lines', !!saved && J(saved.lines) === J(r.run.lines));
  if (more) await more({ check, A, fr, run: r.run });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  await A.context.close();
}

/* ---------- helpers of the later parts ---------- */
const rowsOf = (fr, sel) => fr.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()), sel);
const longDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** The change-log entries whose action is `action` (newest last). */
const logged = (fr, action) => fr.evaluate((a) => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === a).map((e) => ({ detail: e.detail, actor: e.actor || '' })), action);
/** Press a draft's line by kind and investor; resolves to whether it was there. */
async function decideLine(fr, kind, investor, how) {
  const s = await screen(fr);
  const x = s.rows.find((r) => r.kind === kind && r.investor === investor && r.confirm);
  if (!x) return false;
  await T.press(fr, `[data-action=wh-${how}][data-key="${x.key}"]`);
  await fr.waitForTimeout(300);
  return true;
}
/** A foreign investor's row: what it says and its two inputs. */
const fxRow = (fr, id) =>
  fr.evaluate((id) => {
    const el = Array.from(document.querySelectorAll('#ds-tax [data-wh-fx]')).find((x) => x.getAttribute('data-wh-fx') === id);
    if (!el) return null;
    return { text: el.innerText.replace(/\s+/g, ' ').trim(), subject: !!el.querySelector('[data-wh-fx-subject]'), rate: !!el.querySelector('[data-wh-fx-rate]'), err: Array.from(el.querySelectorAll('.cs-error')).map((x) => x.innerText.trim()) };
  }, id);
/** Types into one of A foreign row's inputs and leaves it (the value is taken when the field is left). */
async function fxType(fr, id, which, value) {
  const sel = `#ds-tax [data-wh-fx-${which}="${id}"]`;
  await fr.fill(sel, value);
  await fr.dispatchEvent(sel, 'change');
  await fr.waitForTimeout(400);
}
/** History rows of the Distributions page with their Cancel and ACH file buttons. */
async function history(fr) {
  if (await fr.locator('[data-action=hist-all]').count()) await T.press(fr, '[data-action=hist-all]');
  return fr.evaluate(() => {
    const p = Array.from(document.querySelectorAll('.cs-panel')).find((x) => (x.querySelector('.cs-panel-head h2') || {}).innerText === 'History');
    return p ? Array.from(p.querySelectorAll('tbody tr')).map((tr) => ({ text: tr.innerText.replace(/\s+/g, ' ').trim(), cancel: (tr.querySelector('[data-action=dist-cancel]') || { dataset: {} }).dataset.id || '', file: (tr.querySelector('[data-action=dist-load]') || { dataset: {} }).dataset.id || '' })) : [];
  });
}
/** Records example B as drafted now (no tax line decided), for the parts that need a run. */
async function recordPlain(fr) {
  await draftB(fr, '10000.00');
  await fr.waitForFunction(() => !document.querySelector('[data-action=dist-record]').disabled, null, { timeout: 8000 }).catch(() => {});
  return pressRecord(fr);
}
const setReporting = (fr, key) =>
  T.ws(
    fr,
    (w, key) => {
      const o = w.offerings.find((x) => x.id === 'p10-b');
      if (key) o.tax = { reporting: key, setBy: 'Plan 10-07 check', setAt: '2026-11-19T15:00:00.000Z' };
      else delete o.tax;
      return true;
    },
    key
  );

const parts = {
  'propose-phone': (ctx) => proposeAt('phone', ctx),

  'propose-desktop': (ctx) =>
    proposeAt('desktop', ctx, async ({ check, fr }) => {
      // Remove: nothing withheld and both buttons free
      await draftB(fr, '10000.00');
      check('a new draft proposes the line again', await decideLine(fr, 'backup', 'A-1002', 'remove'));
      let s = await screen(fr);
      check('after Remove the line reads Removed, both buttons can be pressed and nothing is withheld', /Removed/.test(s.block) && !proposed(s).length && !s.fileOff && !s.recOff && !s.alloc.some((t) => /\$800\.00/.test(t)) && (s.alloc.find((t) => /A-1002/.test(t)) || '').indexOf('$2,533.33') < 0, s);
      // Confirm, then a new total: the decision goes and the buttons wait again
      await draftB(fr, '10000.00');
      await decideLine(fr, 'backup', 'A-1002', 'confirm');
      await fr.fill('#ds-total', '9000.00');
      await fr.waitForTimeout(400);
      s = await screen(fr);
      const p = proposed(s);
      check('a new total after Confirm drops the decision: a line of $720.00 (24% of $3,000.00) waits and both buttons wait', p.length === 1 && p[0].investor === 'A-1002' && /\$720\.00/.test(p[0].text) && s.fileOff && s.recOff && s.why.some((x) => /waiting/i.test(x)), s);
      // A-1001's W-9 taken off file: a second line with its own reason
      await T.ws(fr, (w) => {
        const i = w.investors.find((x) => x.id === 'A-1001');
        i.taxForm = '';
        delete i.taxCert;
        return true;
      });
      await draftB(fr, '10000.00');
      s = await screen(fr);
      const a = proposed(s).find((r) => r.investor === 'A-1001') || { text: '' };
      check('with A-1001’s W-9 taken off file a second line is proposed: $1,200.00 for A-1001, its reason no tax form on file', proposed(s).length === 2 && /\$1,200\.00/.test(a.text) && /no tax form is on file/.test(a.text) && !/item 2/.test(a.text), s.rows);
    }),

  async type({ check, S }) {
    const { A, fr } = await open(S, 'desktop');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, seedExampleB, { reporting: '' });
    await go(fr, 'console-offering-p10-b', '.cs-split-main');
    const field = await fr.evaluate(() => {
      const el = document.getElementById('of-tax-reporting');
      return el ? { value: el.value, options: Array.from(el.options).map((o) => o.text.trim()) } : null;
    });
    const labels = await fr.evaluate(() => Object.keys(window.CVPortal.withholding.REPORTING).map((k) => window.CVPortal.withholding.REPORTING[k].label));
    check('an admin sees Tax reporting with Not set and the four labels', !!field && field.value === '' && J(field.options) === J(['Not set'].concat(labels)), { field, labels });
    if (field) {
      await fr.selectOption('#of-tax-reporting', 'notes');
      await fr.waitForTimeout(400);
    }
    const saved = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const o = NS.state.ws.offerings.find((x) => x.id === 'p10-b');
      const key = Object.keys(localStorage).find((k) => /ws:kestrel-bay$/.test(k)) || '';
      const s = JSON.parse(localStorage.getItem(key) || 'null');
      return { tax: o.tax || null, actor: NS.app.actor(), stored: s && (s.offerings.find((x) => x.id === 'p10-b') || {}).tax };
    });
    check('choosing Notes saves it with who and when', !!saved.tax && saved.tax.reporting === 'notes' && saved.tax.setBy === saved.actor && /^2026-11-19T/.test(saved.tax.setAt || '') && !!saved.stored && saved.stored.reporting === 'notes', saved);
    const log = await logged(fr, 'Tax reporting type set');
    check('and writes one change-log entry', log.length === 1 && /Notes: Form 1099-INT/.test(log[0].detail) && log[0].actor === saved.actor, log);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    // a team member: the label, no select
    await T.sample(fr, { role: 'team' });
    await go(fr, 'console-offering-p10-b', '.cs-split-main');
    const team = await fr.evaluate(() => ({ select: !!document.getElementById('of-tax-reporting'), text: document.querySelector('.cs-split-main').innerText }));
    check('a team member sees the chosen label and no select', !team.select && /Tax reporting/.test(team.text) && /Notes: Form 1099-INT/.test(team.text), { select: team.select });
    await T.wayOut(check, fr);
    // not set, partnership, other: nothing proposed for the same draft
    await T.sample(fr, { role: 'admin' });
    for (const key of ['', 'partnership', 'other']) {
      await setReporting(fr, key);
      await draftB(fr, '10000.00');
      const s = await screen(fr);
      check(`with the fund ${key ? `set to ${key}` : 'not set'} no backup line is proposed and the buttons do not wait`, !s.rows.some((r) => r.kind === 'backup') && !s.recOff, s.rows);
    }
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async foreign({ check, S }) {
    const { A, fr } = await open(S, 'phone');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, seedExampleB, { reporting: 'notes' });
    await draftB(fr, '10000.00');
    let row = await fxRow(fr, 'A-1003');
    check('A-1003’s row says "W-8BEN valid until Dec 31, 2028" and has the amount subject to withholding and the CPA’s rate', !!row && /W-8BEN valid until Dec 31, 2028/.test(row.text) && row.subject && row.rate && /Amount subject to withholding/.test(row.text) && /Rate from your CPA/.test(row.text), row);
    check('nothing is withheld from A-1003 before an amount is entered', !(await screen(fr)).rows.some((r) => r.investor === 'A-1003'));
    await fxType(fr, 'A-1003', 'subject', '1666.67');
    let s = await screen(fr);
    let f = proposed(s, 'foreign');
    check('$1,666.67 entered proposes $500.00 at 30% for A-1003', f.length === 1 && f[0].investor === 'A-1003' && /\b30%/.test(f[0].text) && /\$500\.00/.test(f[0].text) && !/rate from your CPA/.test(f[0].text), s.rows);
    check('the line waits for Confirm and so do both buttons', s.fileOff && s.recOff, s);
    await fxType(fr, 'A-1003', 'rate', '10');
    s = await screen(fr);
    f = proposed(s, 'foreign');
    check('a rate of 10 entered makes it $166.67, marked as the CPA’s rate', f.length === 1 && /\b10%/.test(f[0].text) && /\$166\.67/.test(f[0].text) && /rate from your CPA/.test(f[0].text), s.rows);
    await fxType(fr, 'A-1003', 'rate', '');
    await fxType(fr, 'A-1003', 'subject', '2000.00');
    row = await fxRow(fr, 'A-1003');
    s = await screen(fr);
    check('an amount above the investor’s share is refused with one line, and no line is proposed', !!row && row.err.length === 1 && /more than the payment/.test(row.err[0]) && !proposed(s, 'foreign').length, row);
    await fxType(fr, 'A-1003', 'subject', '1666.67');
    await A.page.screenshot({ path: path.join(OUT, 'phone-foreign.png') });
    check('Confirm on the 30% line', await decideLine(fr, 'foreign', 'A-1003', 'confirm'));
    s = await screen(fr);
    check('with the backup line still undecided both buttons wait', s.fileOff && s.recOff && proposed(s).length === 1, s.rows);
    await decideLine(fr, 'backup', 'A-1002', 'confirm');
    s = await screen(fr);
    const r3 = s.alloc.find((t) => /A-1003/.test(t)) || '';
    check('with both confirmed the buttons are free and A-1003 shows $500.00 withheld and $1,166.67 net', !s.fileOff && !s.recOff && r3.indexOf('$500.00') >= 0 && r3.indexOf('$1,166.67') >= 0, { r3, s });
    // the W-8 dated so that it has expired
    await T.ws(fr, (w) => {
      w.investors.find((x) => x.id === 'A-1003').taxCert.validUntil = '2025-12-31';
      return true;
    });
    await draftB(fr, '10000.00');
    row = await fxRow(fr, 'A-1003');
    check('with the W-8 expired the row says expired and on what date', !!row && /W-8BEN expired/.test(row.text) && /Dec 31, 2025/.test(row.text) && !/valid until/.test(row.text), row);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async stops({ check, S }) {
    const { A, fr } = await open(S, 'desktop');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, seedExampleB, { reporting: 'partnership' });
    await draftB(fr, '10000.00');
    let s = await screen(fr);
    check('a partnership fund: no backup line even for A-1002', !s.rows.some((r) => r.kind === 'backup'), s.rows);
    check('the block still has A-1003’s foreign row and Add tax withheld', !!(await fxRow(fr, 'A-1003')) && (await fr.locator('#ds-tax [data-action=wh-add-open]').count()) === 1);
    await T.press(fr, '#ds-tax [data-action=wh-add-open]');
    await fr.waitForSelector('#wh-add-kind');
    const kinds = await fr.evaluate(() => {
      const WH = window.CVPortal.withholding;
      const sel = document.getElementById('wh-add-kind');
      return { options: Array.from(sel.options).filter((o) => o.value).map((o) => [o.value, o.text.trim()]), want: ['partnership', 'real-property', 'fatca', 'state'].map((k) => [k, WH.KINDS[k].label]) };
    });
    check('Add tax withheld offers exactly the four kinds the portal never proposes', J(kinds.options) === J(kinds.want), kinds);
    for (const [k] of kinds.want) {
      await fr.selectOption('#wh-add-kind', k);
      await fr.waitForTimeout(300);
      const form = await fr.evaluate((k) => {
        const box = document.querySelector('#ds-tax .wh-add');
        const stops = box ? Array.from(box.querySelectorAll('.tx-stop')).map((x) => x.innerText.trim()) : [];
        const labels = box ? Array.from(box.querySelectorAll('.cs-field > span:first-child')).map((x) => x.innerText.trim()) : [];
        return { stops, want: window.CVPortal.withholding.STOPS[k], labels, investor: !!document.getElementById('wh-add-investor'), amount: !!document.getElementById('wh-add-amount'), why: !!document.getElementById('wh-add-why') };
      }, k);
      check(`${k}: its one stop sentence, the investor, an amount and a reason, and no rate`, form.stops.length === 1 && form.stops[0] === form.want && form.investor && form.amount && form.why && !form.labels.some((l) => /rate/i.test(l)), form);
    }
    await fr.selectOption('#wh-add-kind', 'state');
    await fr.waitForTimeout(300);
    await fr.selectOption('#wh-add-investor', 'A-1001');
    await fr.fill('#wh-add-amount', '150.00');
    await T.press(fr, '#ds-tax [data-action=wh-add]');
    await fr.waitForTimeout(300);
    const err = await fr.evaluate(() => Array.from(document.querySelectorAll('#ds-tax .wh-add .cs-error')).map((x) => x.innerText.trim()));
    check('without a reason the line is refused in one line', err.length === 1 && /reason/i.test(err[0]) && !(await screen(fr)).rows.some((r) => r.kind === 'state'), err);
    await fr.fill('#wh-add-why', 'State withholding worked out by the CPA');
    await T.press(fr, '#ds-tax [data-action=wh-add]');
    await fr.waitForTimeout(300);
    s = await screen(fr);
    const st = proposed(s, 'state');
    check('the entered line is listed for A-1001 at $150.00, entered, waiting for Confirm with both buttons waiting', st.length === 1 && st[0].investor === 'A-1001' && /\$150\.00/.test(st[0].text) && /State withholding/.test(st[0].text) && !/%/.test(st[0].text) && s.fileOff && s.recOff, s.rows);
    await A.page.screenshot({ path: path.join(OUT, 'desktop-stops.png') });
    await decideLine(fr, 'state', 'A-1001', 'confirm');
    s = await screen(fr);
    const r1 = s.alloc.find((t) => /A-1001/.test(t)) || '';
    check('confirmed, it is withheld like any other: A-1001 $150.00 withheld, $4,850.00 net, both buttons free', r1.indexOf('$150.00') >= 0 && r1.indexOf('$4,850.00') >= 0 && !s.recOff, { r1, s });
    const r = await pressRecord(fr);
    const w = (lineOf(r.run, 'A-1001') || { withheld: [] }).withheld[0] || {};
    check('the record stores it: state, 15,000 cents, entered, no rate, the reason, who', w.kind === 'state' && w.cents === 15000 && w.source === 'entered' && w.ratePct === null && /worked out by the CPA/.test(w.why) && w.confirmedBy === r.actor, w);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async netfile({ check, S }) {
    const { A, fr } = await open(S, 'desktop');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, seedExampleB, { reporting: 'notes' });
    await draftB(fr, '10000.00');
    await decideLine(fr, 'backup', 'A-1002', 'confirm');
    await fxType(fr, 'A-1003', 'subject', '1666.67');
    await decideLine(fr, 'foreign', 'A-1003', 'confirm');
    await T.press(fr, '[data-action=nacha-build]');
    await fr.waitForFunction(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file), null, { timeout: 10000 }).catch(() => {});
    const f = await fileOf(fr);
    check('the ACH file’s entries are 500,000, 253,333 and 116,667 cents', !!f && J(['A-1001', 'A-1002', 'A-1003'].map((id) => f.entries[id])) === J([500000, 253333, 116667]), f && f.entries);
    check('its total credits are $8,700.00', !!f && f.credit === 870000 && f.shown === '$8,700.00', f && { credit: f.credit, shown: f.shown });
    const r = await pressRecord(fr);
    const L = (id) => lineOf(r.run, id) || { withheld: [] };
    const full = (w) => !!w && ['kind', 'cents', 'basisCents', 'ratePct', 'source', 'why', 'confirmedBy', 'confirmedAt'].every((k) => k in w) && w.confirmedBy === r.actor && /^2026-11-19T/.test(w.confirmedAt) && !!w.why;
    const b = L('A-1002').withheld[0];
    const x = L('A-1003').withheld[0];
    check('the record stores gross, withheld and net for each investor (500,000; 333,333 less 80,000; 166,667 less 50,000)', J(['A-1001', 'A-1002', 'A-1003'].map((id) => [L(id).grossCents, L(id).withheld.reduce((a, w) => a + w.cents, 0), L(id).netCents])) === J([[500000, 0, 500000], [333333, 80000, 253333], [166667, 50000, 116667]]), r.run && r.run.lines);
    check('each withheld entry holds kind, cents, basis, rate, source, reason, who and when', full(b) && b.kind === 'backup' && b.basisCents === 333333 && b.ratePct === 24 && b.source === 'rule' && full(x) && x.kind === 'foreign' && x.basisCents === 166667 && x.ratePct === 30 && x.source === 'rule', { b, x });
    // A-1002 on their Distributions page
    await T.sample(fr, { role: 'investor', investor: 'A-1002' });
    await go(fr, 'distributions', '.tbl');
    const rows = await rowsOf(fr, '.tbl tbody tr');
    const mine = rows.find((t) => t.indexOf(longDay(TODAY)) >= 0) || '';
    check('A-1002’s Distributions page shows $3,333.33, Tax withheld $800.00 and Amount paid $2,533.33', mine.indexOf('$3,333.33') >= 0 && /Tax withheld \$800\.00/.test(mine) && /Amount paid \$2,533\.33/.test(mine), mine || rows);
    const head = await fr.evaluate(() => {
      const dt = Array.from(document.querySelectorAll('.figs dt')).find((x) => x.innerText.trim() === 'Total received');
      const fig = dt && dt.parentElement;
      return fig ? { value: fig.querySelector('dd').innerText.trim(), under: Array.from(fig.querySelectorAll('span')).map((x) => x.innerText.trim()) } : null;
    });
    check('the headline stays gross ($3,333.33) with one line under it, "Tax withheld $800.00"', !!head && head.value === '$3,333.33' && head.under.filter((t) => /^Tax withheld \$800\.00$/.test(t)).length === 1, head);
    await A.page.screenshot({ path: path.join(OUT, 'desktop-investor.png') });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    // A-1003's position changes; ACH file on that run pays the stored nets
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, (w, a, NS) => {
      w.investors.find((i) => i.id === 'A-1003').positions[0].amount = 200000;
      NS.clearCaches();
      return true;
    });
    await go(fr, 'console-distributions', '[data-action=dist-record]');
    const h = await history(fr);
    const mineRow = h.find((x) => r.run && x.file === r.run.id);
    if (mineRow) await T.press(fr, `[data-action=dist-load][data-id="${r.run.id}"]`);
    await fr.waitForFunction(() => !!(window.CVPortal.state.ui.dist && window.CVPortal.state.ui.dist.file), null, { timeout: 10000 }).catch(() => {});
    const g = await fileOf(fr);
    check('after A-1003’s position is edited, ACH file on that run builds the same three entries', !!g && J(['A-1001', 'A-1002', 'A-1003'].map((id) => g.entries[id])) === J([500000, 253333, 116667]) && g.credit === 870000, g);
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async cancel({ check, S }) {
    const { A, fr } = await open(S, 'phone');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, seedExampleB, { reporting: '' });
    const r = await recordPlain(fr);
    check('a distribution of example B is recorded', r.added === 1 && !!r.run, { added: r.added, said: r.said });
    if (!r.run) return A.context.close();
    let h = (await history(fr)).find((x) => x.file === r.run.id);
    check('an admin has Cancel on its History row', !!h && h.cancel === r.run.id, h);
    if (h && h.cancel) await T.press(fr, `[data-action=dist-cancel][data-id="${r.run.id}"]`);
    await fr.waitForSelector('#dist-cancel-why', { timeout: 5000 }).catch(() => {});
    const asked = await fr.evaluate(() => !!document.getElementById('dist-cancel-why') && !!document.querySelector('#dlg[open]'));
    check('Cancel asks for a reason in a dialog', asked);
    if (asked) {
      await T.press(fr, '[data-action=dist-cancel-go]');
      await fr.waitForTimeout(300);
      const err = await fr.evaluate(() => Array.from(document.querySelectorAll('#dlg .cs-error')).map((x) => x.innerText.trim()));
      const still = await fr.evaluate((id) => !window.CVPortal.state.ws.runs.find((x) => x.id === id).cancelled, r.run.id);
      check('without a reason nothing is cancelled and one line says a reason is needed', still && err.length === 1 && /reason/i.test(err[0]), err);
      await fr.fill('#dist-cancel-why', 'Recorded by mistake');
      await T.press(fr, '[data-action=dist-cancel-go]');
      await fr.waitForTimeout(500);
    }
    const run = await fr.evaluate((id) => {
      const NS = window.CVPortal;
      return { c: NS.state.ws.runs.find((x) => x.id === id).cancelled || null, actor: NS.app.actor() };
    }, r.run.id);
    check('the run is cancelled with the reason and the signed-in person', !!run.c && run.c.why === 'Recorded by mistake' && run.c.by === run.actor, run);
    h = (await history(fr)).find((x) => x.text.indexOf('Example Fund B') >= 0);
    check('its History row reads Cancelled, with no Cancel and no ACH file', !!h && /\bCancelled\b/.test(h.text) && !h.cancel && !h.file, h);
    const log = await logged(fr, 'Distribution cancelled');
    check('the change log has the entry with the reason', log.length === 1 && /Recorded by mistake/.test(log[0].detail) && log[0].actor === run.actor, log);
    await A.page.screenshot({ path: path.join(OUT, 'phone-cancelled.png') });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.sample(fr, { role: 'investor', investor: 'A-1001' });
    await go(fr, 'distributions', '.cs-main, main, .tbl, .figs');
    const rows = await rowsOf(fr, '.tbl tbody tr');
    check('the investor no longer sees that payment', !rows.some((t) => t.indexOf(longDay(TODAY)) >= 0 && t.indexOf('$5,000.00') >= 0), rows);
    // a team member: no Cancel on any row
    await T.sample(fr, { role: 'team' });
    await go(fr, 'console-distributions', '[data-action=dist-record]');
    h = await history(fr);
    check('a team member sees no Cancel on any History row', h.length > 0 && !h.some((x) => x.cancel), h.slice(0, 3));
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  async 'paper-w9'({ check, S }) {
    const { A, fr } = await open(S, 'desktop');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await T.ws(fr, seedExampleB, { reporting: 'notes' });
    // A-1001: a W-9 and the last four on record, no signature record (as an investor added in the console)
    await T.ws(fr, (w) => {
      const i = w.investors.find((x) => x.id === 'A-1001');
      i.taxForm = 'W-9';
      i.tinLast4 = '0101';
      delete i.taxCert;
      return true;
    });
    await draftB(fr, '10000.00');
    let s = await screen(fr);
    const a = proposed(s).find((r) => r.investor === 'A-1001') || { text: '' };
    check('a W-9 with the last four and no signature record draws a 24% line ($1,200.00)', /\b24%/.test(a.text) && /\$1,200\.00/.test(a.text) && /no record of the W-9/.test(a.text), s.rows);
    await go(fr, 'console-investors', 'table');
    const btn = '[data-action=wh-paper][data-id="A-1001"]';
    check('the investor’s tax record offers "W-9 signed on paper"', (await fr.locator(btn).count()) === 1 && /W-9 signed on paper/.test(await fr.locator(btn).innerText()));
    if (await fr.locator(btn).count()) await T.press(fr, btn);
    await fr.waitForTimeout(400);
    const rec = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const i = NS.state.ws.investors.find((x) => x.id === 'A-1001');
      return { cert: i.taxCert || null, actor: NS.app.actor() };
    });
    check('it records the W-9 as signed on paper, with who and when', !!rec.cert && rec.cert.signed === true && rec.cert.source === 'paper' && !!rec.cert.paper && rec.cert.paper.by === rec.actor && /^2026-11-19T/.test(rec.cert.paper.at || ''), rec);
    let log = await logged(fr, 'W-9 recorded as signed on paper');
    check('the change log has the entry', log.length === 1 && /A-1001/.test(log[0].detail) && log[0].actor === rec.actor, log);
    const line = await fr.evaluate(() => {
      const tr = Array.from(document.querySelectorAll('table tbody tr')).find((x) => x.innerText.indexOf('Example investor A-1001') >= 0);
      return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
    });
    check('the row says the W-9 was signed on paper and offers Undo', /W-9 signed on paper/.test(line) && (await fr.locator('[data-action=wh-paper-undo][data-id="A-1001"]').count()) === 1, line);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await draftB(fr, '10000.00');
    s = await screen(fr);
    check('after "W-9 signed on paper" A-1001 draws no line', !s.rows.some((r) => r.investor === 'A-1001'), s.rows);
    // changeable: undo brings the line back
    await go(fr, 'console-investors', 'table');
    if (await fr.locator('[data-action=wh-paper-undo][data-id="A-1001"]').count()) await T.press(fr, '[data-action=wh-paper-undo][data-id="A-1001"]');
    await fr.waitForTimeout(400);
    log = await logged(fr, 'W-9 paper signature removed');
    await draftB(fr, '10000.00');
    s = await screen(fr);
    check('Undo takes the record away (logged) and the 24% line is proposed again', log.length === 1 && proposed(s).some((r) => r.investor === 'A-1001'), { log, rows: s.rows });
    // an uploaded completed W-9 that carries the last four offers the same action
    await T.ws(fr, (w) => {
      const i = w.investors.find((x) => x.id === 'A-1001');
      i.taxCert = { form: 'W-9', uploaded: true, fileId: 'tax-A-1001-abc', fileName: 'w9.pdf', at: '2026-10-01T15:00:00.000Z' };
      return true;
    });
    await go(fr, 'console-investors', 'table');
    check('an uploaded completed W-9 with the last four offers "W-9 signed on paper" too', (await fr.locator(btn).count()) === 1);
    // an IRA is never proposed backup withholding, so its record offers no paper signature (the upload line stays as it was)
    await T.ws(fr, (w) => {
      w.investors.find((x) => x.id === 'A-1001').type = 'ira';
      return true;
    });
    await go(fr, 'console-investors', 'table');
    check('an IRA with the same uploaded W-9 is offered no "W-9 signed on paper"', (await fr.locator(btn).count()) === 0);
    await T.wayOut(check, fr);
    // quiet is read here: switching to the other sample firms below loads each firm's own typefaces from the font host
    await T.quiet(check, A, fr);
    // every sample investor of every firm, every offering set to notes
    const counts = await fr.evaluate(async (today) => {
      const NS = window.CVPortal;
      const out = [];
      const back = NS.state.clientId;
      for (const id of ['kestrel-bay', 'ashwell-ridge', 'greywater', 'pellbrook']) {
        try {
          NS.app.setClient(id, 'console');
        } catch (e) {
          out.push({ id, err: String(e.message || e) });
          continue;
        }
        const w = NS.state.ws;
        if (!w || w.tenant.id !== id) {
          out.push({ id, err: 'not loaded' });
          continue;
        }
        const sampleInv = w.investors.filter((i) => !/^A-100\d$/.test(i.id));
        const drew = new Set();
        w.offerings.forEach((o) => {
          const notes = Object.assign({}, o, { tax: { reporting: 'notes' } });
          const lines = sampleInv.filter((i) => (i.positions || []).some((p) => p.offeringId === o.id)).map((i) => ({ investorId: i.id, grossCents: 100000 }));
          NS.withholding.propose(w, notes, lines, { date: today }).forEach((d) => drew.add(d.investorId));
        });
        const withW9 = Array.from(drew).filter((x) => {
          const i = w.investors.find((y) => y.id === x);
          return i.taxForm === 'W-9' && /^\d{4}$/.test(String((i.taxCert && i.taxCert.tinLast4) || i.tinLast4 || ''));
        });
        out.push({ id, investors: sampleInv.length, drew: drew.size, withW9: withW9.length, noForm: Array.from(drew).filter((x) => !w.investors.find((y) => y.id === x).taxForm).length });
      }
      NS.app.setClient(back, 'console');
      return out;
    }, TODAY);
    counts.forEach((c) => console.log(`MEASURED paper-w9: ${c.id}: ${c.err ? `not measured (${c.err})` : `${c.drew} of ${c.investors} sample investors still draw a backup line with every offering set to notes (${c.noForm} with no tax form, ${c.withW9} with a W-9 and its last four)`}`));
    check('every firm was measured, and no sample investor with a W-9 and its last four draws a line', counts.length === 4 && counts.every((c) => !c.err && c.withW9 === 0), counts);
    const errors = A.errors.slice();
    check('no script error while the firms were measured', errors.length === 0, errors);
    await A.context.close();
  },

  async managed({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { page: 'index.html' });
    const asked = [];
    A.context.on('request', (r) => /\/assets\/js\/withholding(-ui)?\.js$/.test(new URL(r.url()).pathname) && asked.push(r.url()));
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'staff' });
    await go(fr, 'console-distributions', '[data-action=dist-record]');
    check('the Distributions page shows Record distribution', await fr.locator('[data-action=dist-record]').first().isVisible());
    await T.ws(fr, seedExampleB, { reporting: 'notes' });
    await go(fr, 'console-offering-p10-b', '.cs-split-main');
    const off = await fr.evaluate(() => ({ select: !!document.getElementById('of-tax-reporting'), text: document.querySelector('.cs-split-main').innerText }));
    check('an offering’s page has no Tax reporting field', !off.select && !/Tax reporting/.test(off.text), { select: off.select });
    await draftB(fr, '10000.00');
    const s = await screen(fr);
    check('a draft for the fund whose investor has a crossed-out W-9 shows no tax withheld block and nothing waits', !(await fr.locator('#ds-tax').count()) && !s.rows.length && !/Tax withheld/.test(await fr.evaluate(() => document.body.innerText)) && !s.recOff, s);
    const r = await pressRecord(fr);
    check('it records as before: the lines add up to $10,000.00 with nothing withheld', r.added === 1 && J(['A-1001', 'A-1002', 'A-1003'].map((id) => { const x = lineOf(r.run, id); return x && [x.grossCents, x.withheld.length, x.netCents]; })) === J([[500000, 0, 500000], [333333, 0, 333333], [166667, 0, 166667]]), r.run && r.run.lines);
    let h = await history(fr);
    const mine = h.find((x) => r.run && x.file === r.run.id);
    check('History has Cancel for Carrow & Vale staff', !!mine && mine.cancel === r.run.id, mine);
    await T.wayOut(check, fr);
    await T.sample(fr, { role: 'sponsor' });
    await go(fr, 'console-distributions', '[data-action=dist-record]');
    h = await history(fr);
    check('and none for the sponsor’s staff', h.length > 0 && !h.some((x) => x.cancel), h.slice(0, 3));
    const src = await fr.evaluate(() => ({ scripts: Array.from(document.scripts).map((x) => x.src || ''), html: document.documentElement.outerHTML.indexOf('withholding') >= 0 }));
    check('the page names neither withholding.js nor withholding-ui.js and never asked for them', !src.scripts.some((x) => /withholding/.test(x)) && !src.html && asked.length === 0, { scripts: src.scripts.filter((x) => /withholding/.test(x)), asked });
    // index.html: no commit of this plan touches it and the working tree holds no change to it (D6)
    const { spawnSync } = require('child_process');
    const g = (args) => spawnSync('git', args, { cwd: Lib.ROOT, encoding: 'utf8' });
    const base = '6061fce0b5d43bced41eb84c3c7c6375d1d97f27';
    const log = g(['log', '--format=%H', '--no-merges', `${base}..HEAD`, '--', 'index.html']);
    const dirty = g(['diff', '--quiet', 'HEAD', '--', 'index.html']);
    check('git shows index.html unchanged since the plan’s base (no commit of the plan, no change in the working tree)', log.status === 0 && log.stdout.trim() === '' && dirty.status === 0, { log: log.stdout.slice(0, 200), status: log.status, dirty: dirty.status });
    await T.wayOut(check, fr);
    const text = await fr.evaluate(() => document.body.innerText);
    const hits = text.split('\n').map((l) => l.replace(/Carrow\s*&\s*Vale/gi, '')).filter((l) => Lib.VENDORS.test(l) || Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l));
    check('no vendor, model or library name other than the managed firm’s own, and no forbidden word, on screen', hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'WITHHOLDING FLOW', unit: 'parts', flag: '--only', browser: true });
