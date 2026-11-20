// gate: browser
// last "TAXRECORD FLOW: PASS (parts run: 1)"
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
 * opts.old: also a paid run of 2026-06-15 (600,000 cents) saved before the record existed (no stored lines).
 * Resolves to { offeringId, name, ids: [X-1, X-2, X-3] }.
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
      const ids = people.map(([n, title, amount, tax]) => {
        const inv = JSON.parse(JSON.stringify(tmpl));
        inv.id = `${w.tenant.idPrefix}-${n}`;
        if (w.investors.some((i) => i.id === inv.id)) throw new Error('seatC: id taken ' + inv.id);
        ['taxCert', 'taxW8', 'taxForm', 'taxDelivery', 'irsNotice', 'exempt1099'].forEach((k) => delete inv[k]);
        Object.assign(inv, { title, contact: title, type: 'individual', email: `x${n}@example.com`, positions: [Object.assign(JSON.parse(JSON.stringify(pos0)), { offeringId: o.id, amount, date: '2025-01-02' })] }, tax);
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
    { by: BY, old: !!(opts && opts.old) }
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
  const fund = await seatC(fr, { old: opts.old });
  check('example C is seated: a new fund with three holders, two distributions recorded, one deposit', fund && fund.ids.length === 3, fund);
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

const parts = {
  async ['record-phone']({ check, S }) {
    const { A } = await recordPart(check, S, 'phone');
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'TAXRECORD FLOW', unit: 'parts', flag: '--only', browser: true });
