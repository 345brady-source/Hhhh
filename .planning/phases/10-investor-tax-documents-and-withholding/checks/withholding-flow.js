// gate: browser
// last "WITHHOLDING FLOW: PASS (parts run: 1)"
// Tax withheld at a distribution on screen (plan 10-07, D-04, C-03, TAX-07, TAX-14), the way the owner sees it: the portal
// inside a sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address only, at
// 390x844 with touch or 1280x800, on the Kestrel Bay sample with the page's clock on 19 November 2026 (a Thursday). The
// part files of the other phase 10 plans (NS.taxUI PARTS other than withholding.js and withholding-ui.js) are answered 404
// in every part, so this measures the distribution screen alone.
//   propose-phone   390x844: a fund set to notes; $10,000.00 drafted: one proposed backup line for A-1002 (24%, $800.00,
//                   its reason); both buttons wait with one line; Confirm; the table shows $3,333.33, $800.00 withheld and
//                   $2,533.33 net; the ACH file pays A-1002 253,333 cents, $9,200.00 in all; the recorded run stores the
//                   withheld entry with the signed-in person and the net
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
    return { added: runs.length - before.length, run: runs.find((r) => before.indexOf(r.id) < 0) || null, actor: NS.app.actor(), saved: JSON.parse(localStorage.getItem(key) || 'null') };
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
  check('Record distribution stores one run', r.added === 1, { added: r.added });
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

const parts = {
  'propose-phone': (ctx) => proposeAt('phone', ctx)
};

Lib.runParts(parts, { name: 'WITHHOLDING FLOW', unit: 'parts', flag: '--only', browser: true });
