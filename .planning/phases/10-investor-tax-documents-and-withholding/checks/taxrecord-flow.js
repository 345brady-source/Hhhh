// gate: browser
// last "TAXRECORD FLOW: PASS (parts run: 5)"
// The Tax withheld section of the Tax documents page (plan 10-08, D-03, D-04, TAX-13, TAX-15, TAX-16, TAX-17): what was
// withheld from paid distributions, what the sponsor marked as deposited and what is not yet deposited, per kind, for a
// fund and a year; the deposits the sponsor marks; the fund's foreign investors and the worksheet for the CPA; the IRS
// notices that switch backup withholding on. Every part runs the portal inside a sandboxed frame whose policy refuses every
// connection and allows scripts from the portal's own address only, with the clock on 20 January 2027 (both of example
// C's distributions paid) and the part files of the other plans (NS.taxUI PARTS except withholding.js and
// taxrecord-ui.js) answered 404, so it measures this section alone.
//   record-phone   390x844 with touch: the Tax documents list has a Tax withheld line saying $1,800.00 is not yet
//                  deposited; its page, for the example fund and 2026, shows backup withholding $1,600.00 withheld,
//                  $800.00 deposited, $800.00 not yet deposited and foreign withholding $1,000.00, $0.00, $1,000.00, each
//                  with its one rule sentence and its source
//   record-desktop the same at 1280x800, with a paid 2026 run saved before the record existed: each kind names it in one
//                  line (worked out again; confirm its lines); a year with nothing withheld shows no kind and one line; a
//                  team member sees the section and marks a deposit; an investor cannot open the address
//   deposit        390x844: Mark deposited (foreign, $1,000.00, a date, a confirmation number) brings foreign's not yet
//                  deposited to $0.00 and the list line to $800.00, with a change-log entry; an empty amount, no date or
//                  no confirmation number is refused with one line and nothing stored; a reload keeps the deposit
//   worksheet      390x844: the fund's foreign investors (W-8 on file, signed, valid until or expired with the date,
//                  foreign tax number on file or not); Download worksheet for your CPA saves a .csv whose text is
//                  NS.withholding.worksheet's: one header line, X-3's two payments and two amounts withheld, the run worked
//                  out again marked yes; no U.S. investor in it
//   notices        1280x800: an IRS notice recorded for X-1 (kind, the day it arrived) is listed with the module's one
//                  sentence and NS.withholding.propose then holds a line for X-1; marked ended, the line is gone for a later
//                  payment date; both are in the change log; a notice with no date, or an end with no date, is refused
// Every part: quiet, leak and a way out on screen; the fund's name (with angle brackets) is shown as text.
//   NODE_PATH=$(npm root -g) node taxrecord-flow.js [--only part1,part2]
// The last line is "TAXRECORD FLOW: PASS (parts run: N)" or "TAXRECORD FLOW: FAIL (parts run: N) - <parts>".
//
// Example C (hand-worked, the numbers of plan 10-05's TAX MATH, in one new fund of the Kestrel Bay sample whose only
// holders are three new investors since 2 January 2025: X-1 $300,000, X-2 $200,000, X-3 $100,000, together $600,000).
// The fund is set to notes and pays $10,000.00 (1,000,000 cents) on 2026-09-15 and again on 2026-12-15:
//   shares 1,000,000 x 3/6 = 500,000; x 2/6 = 333,333.33 -> 333,333; x 1/6 = 166,666.67 -> 166,667 (the cent left over).
//   X-2 (signed W-9, item 2 crossed out): backup 24% of 333,333 = 79,999.92 -> 80,000 ($800.00) each time.
//   X-3 (W-8BEN, valid until 2028-12-31): the sponsor enters 166,667 as subject: 30% = 50,000.1 -> 50,000 ($500.00).
//   For 2026: backup withheld 80,000 + 80,000 = 160,000 ($1,600.00); a deposit of 80,000 marked for 2026-10-15:
//   deposited $800.00, not yet deposited 160,000 - 80,000 = 80,000 ($800.00). Foreign withheld 50,000 + 50,000 = 100,000
//   ($1,000.00), deposited $0.00, not yet deposited $1,000.00. Not yet deposited in all: 80,000 + 100,000 = 180,000
//   ($1,800.00).
const path = require('path');
const T = require('./lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'taxrecord-flow');
require('fs').mkdirSync(OUT, { recursive: true });
// The part files of the other plans (NS.taxUI PARTS without withholding.js and taxrecord-ui.js): answered 404.
const OTHERS = /\/assets\/js\/(withholding-ui|taxdocs-investor|tax1099|tax1099-ui|taxlink)\.js$/;
const CLOCK = '2027-01-20';
const BY = 'Dana Reyes (Example admin)';

/* ---------- the frame ---------- */
async function reframe(A) {
  await A.page.reload();
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state));
  fr.p10 = { size: A.p10.size, A };
  await fr.waitForTimeout(500);
  A.errors.length = 0;
  A.p10.outside.length = 0;
  return fr;
}
/** lib10's frame (scripts from the portal only, clock on CLOCK), the other plans' part files answered 404 from the first load on. */
async function open(S, size, opts) {
  const { A } = await T.framed(S, size, Object.assign({ policy: 'self', clock: CLOCK }, opts || {}));
  await A.context.route((u) => u.origin === S.origin && OTHERS.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' }));
  return { A, fr: await reframe(A) };
}
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 20000 });
  await fr.waitForTimeout(300);
}

/* ---------- example C in the sample ---------- */
/**
 * Example C seated in one new fund of the Kestrel Bay sample: the fund (a copy of the sample's first fund, its name with
 * angle brackets), its three holders and their tax facts, the fund set to notes, both distributions recorded through
 * NS.data.recordRun with the two confirmed lines each, and the deposit of 80,000 cents for backup dated 2026-10-15.
 * opts.old: also a paid run of 2026-06-15 (600,000 cents) saved before the record existed (no stored lines): worked out
 * again, 100,000 / 200,000 / 300,000 for X-3 / X-2 / X-1. opts.expired: a fourth, foreign holder whose W-8BEN expired
 * (see below). Resolves to { offeringId, name, ids: [X-1, X-2, X-3(, X-4)] }.
 */
function seatC(fr, opts) {
  return T.ws(
    fr,
    (w, arg, NS) => {
      const W = NS.withholding;
      const o = JSON.parse(JSON.stringify(w.offerings[0]));
      o.id = 'exc-notes';
      o.name = 'Example C <b>Notes</b> Fund';
      o.shortName = 'Example C';
      delete o.tax;
      w.offerings.push(o);
      const tmpl = w.investors.find((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.length);
      const pos0 = tmpl.positions[0];
      const signedW9 = (last4, crossed) => ({ taxType: 'us-individual', taxForm: 'W-9', tinLast4: last4, taxCert: { form: 'W-9', revision: 'March 2024', envelopeId: 'env-w9-x', at: '2025-01-02T10:00:00.000Z', signed: true, signedBy: 'Signer', tinLast4: last4, backupWithholding: !!crossed } });
      const w8ben = { taxType: 'foreign-individual', taxForm: 'W-8BEN', tinLast4: '', taxCert: { form: 'W-8BEN', revision: 'October 2021', envelopeId: 'env-w8-x', at: '2025-03-02T10:00:00.000Z', signed: true, signedBy: 'Signer', country: 'Canada', citizenship: 'Canada', ftinLast4: '5521', noFtin: false, treatyCountry: 'Canada', validUntil: '2028-12-31' } };
      const people = [
        ['9001', 'Harbor Example One', 300000, signedW9('4821', false)],
        ['9002', 'Harbor Example Two', 200000, signedW9('7310', true)],
        ['9003', 'Harbor Example Three', 100000, w8ben]
      ];
      // opts.expired: a fourth holder, foreign, whose W-8BEN was valid until 2026-12-31, holding since 2026-12-20 (after
      // every distribution of the year, so example C's shares do not move)
      if (arg.expired) people.push(['9004', 'Harbor Example Four', 50000, JSON.parse(JSON.stringify(Object.assign({}, w8ben, { taxCert: Object.assign({}, w8ben.taxCert, { country: 'Mexico', ftinLast4: '', noFtin: false, validUntil: '2026-12-31', at: '2023-04-02T10:00:00.000Z' }) }))), '2026-12-20']);
      const ids = people.map(([n, title, amount, tax, since]) => {
        const inv = JSON.parse(JSON.stringify(tmpl));
        inv.id = `${w.tenant.idPrefix}-${n}`;
        if (w.investors.some((i) => i.id === inv.id)) throw new Error('seatC: id taken ' + inv.id);
        ['taxCert', 'taxW8', 'taxForm', 'taxDelivery', 'irsNotice', 'exempt1099'].forEach((k) => delete inv[k]);
        Object.assign(inv, { title, contact: title, type: 'individual', email: `x${n}@example.com`, positions: [Object.assign(JSON.parse(JSON.stringify(pos0)), { offeringId: o.id, amount, date: since || '2025-01-02' })] }, tax);
        delete inv.positions[0].redeemed;
        w.investors.push(inv);
        return inv.id;
      });
      W.setReporting(w, o.id, 'notes', { by: arg.by, at: '2026-09-01T15:00:00.000Z' });
      const SEPT = { offeringId: o.id, date: '2026-09-15', type: 'Interest', total: 1000000 };
      const lines = NS.data.buildLines(w, SEPT);
      const ds = W.propose(w, o, lines, { date: '2026-09-15' });
      if (ds.length !== 1 || ds[0].investorId !== ids[1] || ds[0].cents !== 80000) throw new Error('seatC: the proposal is not example C: ' + JSON.stringify(ds));
      const f = W.foreignDraft(lines.find((l) => l.investorId === ids[2]), { subjectCents: 166667 });
      const held = W.toWithheld(ds.concat([f]).map((d) => W.confirm(d, { by: arg.by, at: '2026-09-10T15:00:00.000Z' })));
      NS.data.recordRun(w, Object.assign({}, SEPT, { withheld: held }), { by: arg.by, today: '2026-09-10', id: 'exc-sep' });
      NS.data.recordRun(w, Object.assign({}, SEPT, { date: '2026-12-15', withheld: held }), { by: arg.by, today: '2026-12-10', id: 'exc-dec' });
      W.addDeposit(w, { offeringId: o.id, kind: 'backup', year: '2026', cents: 80000, date: '2026-10-15', confirmation: 'DEP-OCT-A', by: arg.by, at: '2026-10-15T16:00:00.000Z' });
      if (arg.old) w.runs.push({ id: 'exc-jun', offeringId: o.id, date: '2026-06-15', type: 'Interest', total: 600000, status: 'paid', source: 'history' });
      NS.clearCaches();
      return { offeringId: o.id, name: o.name, ids };
    },
    { by: BY, old: !!(opts && opts.old), expired: !!(opts && opts.expired) }
  );
}

/* ---------- reading the section ---------- */
/** The section's figures as drawn: per kind shown, its label, the three amounts, its rule sentence and the other lines. */
function figures(fr) {
  return fr.evaluate(() =>
    Array.from(document.querySelectorAll('[data-kind]')).map((k) => {
      const cell = (c) => ((k.querySelector(`[data-col="${c}"]`) || {}).innerText || '').trim();
      return {
        kind: k.getAttribute('data-kind'),
        label: ((k.querySelector('h3') || {}).innerText || '').trim(),
        withheld: cell('withheld'),
        deposited: cell('deposited'),
        undeposited: cell('undeposited'),
        rule: ((k.querySelector('[data-rule]') || {}).innerText || '').trim(),
        recomputed: ((k.querySelector('[data-recomputed]') || {}).innerText || '').trim(),
        items: Array.from(k.querySelectorAll('[data-item]')).map((r) => r.innerText.replace(/\s+/g, ' ').trim())
      };
    })
  );
}
/** On the section's page: the fund and the year picked. */
async function pick(fr, offeringId, year) {
  await fr.selectOption('#txw-fund', offeringId);
  await fr.waitForTimeout(300);
  await fr.selectOption('#txw-year', String(year));
  await fr.waitForTimeout(400);
}
/** The fund's name shown as text (it carries angle brackets), never as markup. */
async function escaped(check, fr, label) {
  const r = await fr.evaluate(() => ({ text: (document.querySelector('.tx') || document.body).innerText, tags: document.querySelectorAll('.tx b, .tx i').length }));
  check(`${label}: a fund name with angle brackets is shown as text`, r.text.indexOf('<b>Notes</b>') >= 0 && r.tags === 0, r.tags);
}
const EXPECT = {
  backup: { withheld: '$1,600.00', deposited: '$800.00', undeposited: '$800.00' },
  foreign: { withheld: '$1,000.00', deposited: '$0.00', undeposited: '$1,000.00' }
};

/** The list line, the page for the example fund and 2026, its six amounts and two rule sentences, at one size. */
async function recordPart(check, S, size, opts) {
  opts = opts || {};
  const { A, fr } = await open(S, size);
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  const fund = await seatC(fr, { old: opts.old, expired: opts.expired });
  check('example C is seated: a new fund with three holders, two distributions recorded, one deposit', fund && fund.ids.length === (opts.expired ? 4 : 3), fund);
  await go(fr, 'console-taxdocs', '#tx-files');
  await fr.waitForSelector('[data-list="parts"] a[href="#console-taxdocs-withheld"]', { timeout: 20000 }).catch(() => {});
  const line = await fr.evaluate(() => {
    const a = document.querySelector('[data-list="parts"] a[href="#console-taxdocs-withheld"]');
    const row = a && a.closest('.tx-row');
    return { title: a ? a.innerText.trim() : '', text: row ? row.innerText.replace(/\s+/g, ' ').trim() : '' };
  });
  check('as admin, Tax documents has a Tax withheld line saying $1,800.00 is not yet deposited', line.title === 'Tax withheld' && /\$1,800\.00 not yet deposited/.test(line.text), line);
  if (line.title) await T.press(fr, '[data-list="parts"] a[href="#console-taxdocs-withheld"]');
  await fr.waitForSelector('#txw-fund', { timeout: 20000 }).catch(() => {});
  check('tapping it opens the section at console-taxdocs-withheld', (await fr.evaluate(() => location.hash)) === '#console-taxdocs-withheld' && (await fr.locator('#txw-fund').count()) === 1, await fr.evaluate(() => location.hash));
  if (await fr.locator('#txw-fund').count()) await pick(fr, fund.offeringId, 2026);
  const fig = await figures(fr);
  check('for the example fund and 2026 exactly two kinds are shown: backup, then foreign', fig.map((k) => k.kind).join() === 'backup,foreign', fig.map((k) => k.kind));
  const W = await fr.evaluate(() => ({ rules: window.CVPortal.withholding.DEPOSIT_RULES, kinds: window.CVPortal.withholding.KINDS }));
  ['backup', 'foreign'].forEach((k) => {
    const x = fig.find((f) => f.kind === k) || {};
    const e = EXPECT[k];
    check(`${k}: ${e.withheld} withheld, ${e.deposited} deposited, ${e.undeposited} not yet deposited (example C to the cent)`, x.withheld === e.withheld && x.deposited === e.deposited && x.undeposited === e.undeposited, x);
    check(`${k}: labelled "${W.kinds[k].label}" with its one rule sentence and its source`, x.label === W.kinds[k].label && x.rule.indexOf(W.rules[k].text) >= 0 && x.rule.indexOf(W.rules[k].source) >= 0, x.rule);
  });
  const text = await fr.evaluate(() => document.querySelector('.tx').innerText);
  check('no due date is shown or worked out (C-08)', !/\bdue\b/i.test(text), text.match(/[^.\n]*\bdue\b[^.\n]*/gi));
  await escaped(check, fr, 'the section');
  await A.page.screenshot({ path: path.join(OUT, `record-${size}.png`), fullPage: false });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  return { A, fr, fund, fig };
}

/* ---------- the forms ---------- */
/** How many deposits are stored and how long the change log is. */
const counts = (fr) =>
  fr.evaluate(() => {
    const w = window.CVPortal.state.ws;
    return { deposits: (w.taxDeposits || []).length, log: (w.audit || []).length };
  });
/** The refusal lines on the section now. */
const refusals = (fr) => fr.evaluate(() => Array.from(document.querySelectorAll('.tx .tx-note.is-stop, .tx [role=alert]')).map((x) => x.innerText.trim()).filter((t, k, a) => a.indexOf(t) === k));
/** Mark deposited with the given fields ('' leaves a field empty). */
async function markDeposit(fr, d) {
  if (d.kind) await fr.selectOption('#txw-dep-kind', d.kind);
  await fr.fill('#txw-dep-amount', d.amount);
  await fr.fill('#txw-dep-date', d.date);
  await fr.fill('#txw-dep-conf', d.conf);
  await T.press(fr, '[data-action=txw-deposit]');
  await fr.waitForTimeout(500);
}
/** The change-log entries since index `from`: action, record and detail. */
const logSince = (fr, from) => fr.evaluate((from) => (window.CVPortal.state.ws.audit || []).slice(from).map((e) => ({ action: e.action, record: e.record, detail: e.detail, actor: e.actor })), from);
/** NS.withholding.propose for a new $10,000.00 distribution of the fund paid on `date`: { investorId: cents }. */
const proposal = (fr, offeringId, date) =>
  fr.evaluate(
    ({ offeringId, date }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const o = w.offerings.find((x) => x.id === offeringId);
      const out = {};
      NS.withholding.propose(w, o, NS.data.buildLines(w, { offeringId, date, type: 'Interest', total: 1000000 }), { date }).forEach((d) => (out[d.investorId] = d.cents));
      return out;
    },
    { offeringId, date }
  );
/** A CSV text read back into rows of cells. */
function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (q) {
      if (c === '"' && text[k + 1] === '"') {
        cell += '"';
        k++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[k + 1] === '\n') k++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
async function openSection(fr, fund, year) {
  await go(fr, 'console-taxdocs-withheld', '#txw-fund');
  await pick(fr, fund.offeringId, year);
}
const rowText = (fr, list, id) =>
  fr.evaluate(
    ({ list, id }) => {
      const r = document.querySelector(`[data-list="${list}"] .tx-row[data-id="${id}"]`);
      return r ? r.innerText.replace(/\s+/g, ' ').trim() : '';
    },
    { list, id }
  );

const parts = {
  async ['record-phone']({ check, S }) {
    const { A } = await recordPart(check, S, 'phone');
    await A.context.close();
  },
  async ['record-desktop']({ check, S }) {
    const { A, fr, fund } = await recordPart(check, S, 'desktop', { old: true });
    // D5: the paid run of 2026-06-15 saved before the record existed is named beside each kind; its items carry the mark
    const fig = await figures(fr);
    const want = await fr.evaluate((id) => {
      const T = window.CVPortal.withholding.totals(window.CVPortal.state.ws, { offeringId: id, year: '2026', today: window.CVPortal.dates.today() });
      return { runs: T.backup.recomputedRuns, items: { backup: T.backup.items.length, foreign: T.foreign.items.length }, marked: T.backup.items.concat(T.foreign.items).filter((x) => x.recomputed).length };
    }, fund.offeringId);
    check('the module names the run of 2026-06-15 as worked out again', JSON.stringify(want.runs) === JSON.stringify(['exc-jun']), want);
    check('beside each kind one line names it: "The distribution of June 15, 2026 was worked out again from today’s positions; confirm its lines."', fig.length === 2 && fig.every((k) => /^The distribution of June 15, 2026 was worked out again from today.s positions; confirm its lines\.$/.test(k.recomputed)), fig.map((k) => k.recomputed));
    check('each kind lists one row per item the module gives, and only a recomputed item carries the mark', fig.every((k) => k.items.length === want.items[k.kind] && k.items.filter((t) => /worked out again/.test(t)).length === 0) && want.marked === 0, fig.map((k) => k.items));
    // a year with nothing withheld
    await pick(fr, fund.offeringId, 2027);
    const empty = await fr.evaluate(() => ({ kinds: document.querySelectorAll('[data-kind]').length, lines: Array.from(document.querySelectorAll('.tx [data-empty]')).map((x) => x.innerText.trim()), other: document.querySelectorAll('.tx [data-recomputed], .tx [data-rule]').length }));
    check('2027 (nothing withheld) shows no kind and one line saying so', empty.kinds === 0 && empty.lines.length === 1 && /^Nothing was withheld/.test(empty.lines[0]) && empty.other === 0, empty);
    await T.wayOut(check, fr);
    // a team member sees the section and marks a deposit
    await T.sample(fr, { role: 'team' });
    await openSection(fr, fund, 2026);
    const teamFig = await figures(fr);
    check('a team member sees the section with the same amounts', (teamFig.find((k) => k.kind === 'backup') || {}).undeposited === '$800.00' && (teamFig.find((k) => k.kind === 'foreign') || {}).undeposited === '$1,000.00', teamFig);
    const before = await counts(fr);
    if (await fr.locator('#txw-dep-amount').count()) await markDeposit(fr, { kind: 'backup', amount: '800.00', date: '2027-01-15', conf: 'DEP-JAN-T' });
    const after = await counts(fr);
    const teamDep = await fr.evaluate(() => (window.CVPortal.state.ws.taxDeposits || []).slice(-1)[0] || null);
    const teamB = (await figures(fr)).find((k) => k.kind === 'backup') || {};
    check('a team member marks a deposit: backup not yet deposited $0.00, the deposit stored with who', after.deposits === before.deposits + 1 && teamB.undeposited === '$0.00' && !!teamDep && teamDep.cents === 80000 && !!teamDep.by, { before, after, teamDep, teamB });
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    // an investor cannot open the address
    await T.sample(fr, { role: 'investor', investor: fund.ids[0] });
    await fr.evaluate(() => (location.hash = '#console-taxdocs-withheld'));
    await fr.waitForTimeout(800);
    const inv = await fr.evaluate(() => ({ route: window.CVPortal.state.route, tx: !!document.querySelector('.tx'), fund: !!document.getElementById('txw-fund') }));
    check('an investor cannot open the address', inv.route !== 'console-taxdocs' && !inv.tx && !inv.fund, inv);
    await A.context.close();
  },
  async deposit({ check, S }) {
    const { A, fr } = await open(S, 'phone');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const fund = await seatC(fr);
    await openSection(fr, fund, 2026);
    const kinds = await fr.evaluate(() => Array.from((document.getElementById('txw-dep-kind') || { options: [] }).options).map((o) => o.value));
    check('Mark deposited offers the kinds withheld in the year: backup and foreign', kinds.join() === 'backup,foreign', kinds);
    // refusals: one line each, nothing stored
    const cases = [
      ['an empty amount', { kind: 'foreign', amount: '', date: '2027-01-15', conf: 'DEP-JAN-B' }],
      ['a date left out', { kind: 'foreign', amount: '1000.00', date: '', conf: 'DEP-JAN-B' }],
      ['a confirmation number left out', { kind: 'foreign', amount: '1000.00', date: '2027-01-15', conf: '' }],
      ['an amount with a fraction of a cent', { kind: 'foreign', amount: '10.005', date: '2027-01-15', conf: 'DEP-JAN-B' }]
    ];
    for (const [label, d] of cases) {
      const c0 = await counts(fr);
      if (await fr.locator('#txw-dep-amount').count()) await markDeposit(fr, d);
      const c1 = await counts(fr);
      const said = await refusals(fr);
      check(`${label} is refused with one line and nothing is stored`, said.length === 1 && c1.deposits === c0.deposits && c1.log === c0.log, { said, c0, c1 });
    }
    const before = await counts(fr);
    if (await fr.locator('#txw-dep-amount').count()) await markDeposit(fr, { kind: 'foreign', amount: '1,000.00', date: '2027-01-15', conf: 'DEP-JAN-B' });
    const fig = await figures(fr);
    const f = fig.find((k) => k.kind === 'foreign') || {};
    const b = fig.find((k) => k.kind === 'backup') || {};
    check('foreign: $1,000.00 withheld, $1,000.00 deposited, $0.00 not yet deposited; backup unchanged at $800.00', f.withheld === '$1,000.00' && f.deposited === '$1,000.00' && f.undeposited === '$0.00' && b.undeposited === '$800.00', { f, b });
    check('no refusal line is left on the page', (await refusals(fr)).length === 0, await refusals(fr));
    const dep = await fr.evaluate(() => (window.CVPortal.state.ws.taxDeposits || []).slice(-1)[0] || null);
    check('the deposit is stored: fund, foreign, 2026, 100,000 cents, 2027-01-15, DEP-JAN-B, who and when', !!dep && dep.offeringId === fund.offeringId && dep.kind === 'foreign' && dep.year === '2026' && dep.cents === 100000 && dep.date === '2027-01-15' && dep.confirmation === 'DEP-JAN-B' && !!dep.by && !!dep.at, dep);
    const log = await logSince(fr, before.log);
    check('the change log has the entry', log.length === 1 && log[0].action === 'Tax deposit marked' && log[0].record === (dep || {}).id && /\$1,000\.00 deposited 2027-01-15, confirmation DEP-JAN-B/.test(log[0].detail), log);
    await go(fr, 'console-taxdocs', '[data-list="parts"]');
    const line = await fr.evaluate(() => {
      const a = document.querySelector('[data-list="parts"] a[href="#console-taxdocs-withheld"]');
      return a ? a.closest('.tx-row').innerText.replace(/\s+/g, ' ').trim() : '';
    });
    check('the list line now says $800.00 is not yet deposited', /\$800\.00 not yet deposited for 2026/.test(line) && !/1,800/.test(line), line);
    // a reload keeps it
    const fr2 = await reframe(A);
    await openSection(fr2, fund, 2026);
    const again = (await figures(fr2)).find((k) => k.kind === 'foreign') || {};
    const kept = await fr2.evaluate(() => (window.CVPortal.state.ws.taxDeposits || []).filter((d) => d.confirmation === 'DEP-JAN-B').length);
    check('after a reload the deposit is still there: foreign $0.00 not yet deposited', kept === 1 && again.undeposited === '$0.00', { kept, again });
    await escaped(check, fr2, 'deposit');
    await A.page.screenshot({ path: path.join(OUT, 'deposit-phone.png'), fullPage: false });
    await T.wayOut(check, fr2);
    await T.leak(check, fr2);
    await T.quiet(check, A, fr2);
    await A.context.close();
  },
  async worksheet({ check, S }) {
    const { A, fr } = await open(S, 'phone');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const fund = await seatC(fr, { old: true, expired: true });
    await openSection(fr, fund, 2026);
    const rows = await fr.evaluate(() => Array.from(document.querySelectorAll('[data-list="foreign"] .tx-row')).map((r) => ({ id: r.getAttribute('data-id'), text: r.innerText.replace(/\s+/g, ' ').trim() })));
    const x3 = rows.find((r) => r.id === fund.ids[2]) || { text: '' };
    const x4 = rows.find((r) => r.id === fund.ids[3]) || { text: '' };
    check('the foreign investors are X-3 and X-4 only (no U.S. investor)', rows.map((r) => r.id).sort().join() === [fund.ids[2], fund.ids[3]].sort().join(), rows.map((r) => r.id));
    check('X-3: W-8BEN, signed, valid until December 31, 2028, foreign tax number on file', /W-8BEN/.test(x3.text) && /\bsigned\b/i.test(x3.text) && !/not signed/i.test(x3.text) && /valid until December 31, 2028/.test(x3.text) && /foreign tax number on file/i.test(x3.text) && !/no foreign tax number/i.test(x3.text), x3.text);
    check('X-4 (W-8 expired): expired, with the date December 31, 2026, and no foreign tax number on file', /expired/i.test(x4.text) && /December 31, 2026/.test(x4.text) && /no foreign tax number/i.test(x4.text), x4.text);
    const log0 = (await counts(fr)).log;
    let dl = null;
    if (await fr.locator('[data-action=txw-worksheet]').count()) {
      [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 15000 }).catch(() => null), T.press(fr, '[data-action=txw-worksheet]')]);
    }
    const saved = dl ? require('fs').readFileSync(await dl.path(), 'utf8') : '';
    const name = dl ? dl.suggestedFilename() : '';
    const want = await fr.evaluate((id) => window.CVPortal.withholding.worksheet(window.CVPortal.state.ws, { offeringId: id, year: '2026', today: window.CVPortal.dates.today() }).csv, fund.offeringId);
    check('Download worksheet for your CPA saves a .csv', !!dl && /\.csv$/.test(name), name);
    check("the saved file's text is NS.withholding.worksheet's, exactly", saved.length > 50 && saved === want, { saved: saved.length, want: want.length });
    const t = csvRows(saved);
    const head = t[0] || [];
    const x3rows = t.filter((r) => r[0] === fund.ids[2]);
    const col = (n) => head.indexOf(n);
    check('one header line', t.filter((r) => r[0] === 'Investor ID').length === 1 && head[0] === 'Investor ID', head);
    check("X-3's two payments of 1666.67 with 500.00 withheld each, not worked out again", x3rows.filter((r) => r[col('Amount paid')] === '1666.67' && r[col('Tax withheld')] === '500.00' && r[col('Amount worked out again')] === '').length === 2, x3rows);
    check('the run saved before the record existed reads yes in "Amount worked out again" (2026-06-15, 1000.00)', x3rows.filter((r) => r[col('Date paid')] === '2026-06-15' && r[col('Amount paid')] === '1000.00' && r[col('Amount worked out again')] === 'yes').length === 1, x3rows);
    check('the U.S. investors are not in it', !t.some((r) => r[0] === fund.ids[0] || r[0] === fund.ids[1]), t.map((r) => r[0]));
    check('it holds no number of nine digits or more', !/(?<![0-9a-f])[0-9]{9,}(?![0-9a-f])/.test(saved));
    const log = await logSince(fr, log0);
    check('the download is in the change log', log.length === 1 && log[0].action === 'Withholding worksheet downloaded', log);
    await escaped(check, fr, 'worksheet');
    await A.page.screenshot({ path: path.join(OUT, 'worksheet-phone.png'), fullPage: false });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async notices({ check, S }) {
    const { A, fr } = await open(S, 'desktop');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const fund = await seatC(fr);
    const x1 = fund.ids[0];
    await openSection(fr, fund, 2026);
    const sentence = await fr.evaluate(() => window.CVPortal.withholding.STOPS['irs-notice']);
    const panel = await fr.evaluate(() => {
      const l = document.querySelector('[data-list="notices"]');
      return l && l.closest('.cs-panel') ? l.closest('.cs-panel').innerText : '';
    });
    check("the IRS notices panel holds the module's one sentence", panel.indexOf(sentence) >= 0, panel.slice(0, 300));
    check('before: no backup line for X-1 on a 2027-03-15 payment (signed W-9)', !(await proposal(fr, fund.offeringId, '2027-03-15'))[x1]);
    const has = async (sel) => (await fr.locator(sel).count()) > 0;
    const record = async (date) => {
      if (!(await has('#txw-notice-inv'))) return;
      await fr.selectOption('#txw-notice-inv', x1);
      await fr.selectOption('#txw-notice-kind', 'wrong-number');
      await fr.fill('#txw-notice-date', date);
      await T.press(fr, '[data-action=txw-notice]');
      await fr.waitForTimeout(400);
    };
    const end = async (date) => {
      if (!(await has(`[data-action=txw-notice-end][data-id="${x1}"]`))) return;
      await fr.fill(`[data-end="${x1}"]`, date);
      await T.press(fr, `[data-action=txw-notice-end][data-id="${x1}"]`);
      await fr.waitForTimeout(400);
    };
    const notice = () => fr.evaluate((id) => window.CVPortal.state.ws.investors.find((i) => i.id === id).irsNotice || null, x1);
    // refused: no date
    let c0 = await counts(fr);
    await record('');
    let said = await refusals(fr);
    check('a notice with no date is refused with one line and nothing is stored', said.length === 1 && (await counts(fr)).log === c0.log && !(await notice()), said);
    const start = (await counts(fr)).log;
    await record('2027-01-18');
    const row = await rowText(fr, 'notices', x1);
    check('the notice is listed: X-1, the kind, the day it arrived', /Harbor Example One/.test(row) && /taxpayer number/i.test(row) && /January 18, 2027/.test(row), row);
    const stored = await notice();
    check('stored on the investor: wrong-number, received 2027-01-18, who and when', !!stored && stored.kind === 'wrong-number' && stored.received === '2027-01-18' && !stored.ended && !!stored.by, stored);
    const p1 = await proposal(fr, fund.offeringId, '2027-03-15');
    check('NS.withholding.propose for a new distribution on 2027-03-15 holds a line for X-1: 24% of 500,000 = 120,000', p1[x1] === 120000, p1);
    // refused: an end with no date
    c0 = await counts(fr);
    await end('');
    said = await refusals(fr);
    check('marking it ended with no date is refused with one line and nothing is stored', said.length === 1 && (await counts(fr)).log === c0.log && !((await notice()) || {}).ended, said);
    await end('2027-02-01');
    const row2 = await rowText(fr, 'notices', x1);
    check('the row says it ended February 1, 2027', /ended February 1, 2027/i.test(row2), row2);
    check('ended: no line for X-1 on 2027-03-15; still one on 2027-01-25, while it was in effect', !(await proposal(fr, fund.offeringId, '2027-03-15'))[x1] && (await proposal(fr, fund.offeringId, '2027-01-25'))[x1] === 120000);
    const log = await logSince(fr, start);
    check('the change log has both entries for X-1', log.length === 2 && log.every((e) => e.record === x1) && log[0].action === 'IRS notice recorded' && log[1].action === 'IRS notice ended', log);
    await escaped(check, fr, 'notices');
    await A.page.screenshot({ path: path.join(OUT, 'notices-desktop.png'), fullPage: false });
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'TAXRECORD FLOW', unit: 'parts', flag: '--only', browser: true });
