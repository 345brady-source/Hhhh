// gate: node
// last "REPORTS STARTERS: PASS (cases run: 8)"
// Plan 12-05: the starter templates (assets/js/reports-templates.js) run end to end through the real figures
// (NS.reportsData, 12-01), the report model (NS.reports, 12-02) and the page composer (NS.reportsPdf, 12-03), and every
// PDF is read back with pdftotext and pdfinfo. The portal is loaded with lib12.portal (today 2027-01-20) plus the four
// report modules; nothing is fetched. PDFs are written into lib12.work('reports-starters') (under P6_OUT, named with
// this process's id, removed when the run ends, pass or fail).
//   node checks/reports-starters.js [--case fund-a,catalogue,every-sample,rega,words,consolidated,speed,selfcheck]
'use strict';
const path = require('path');
const T = require('./lib12.js');
const { missingIn } = require('./reports-pdf.js');

const TODAY = '2027-01-20';
const WHEN = '2027-01-20T12:00:00.000Z';
const EXTRA = ['reports-data.js', 'reports.js', 'reports-pdf.js', 'reports-templates.js'];
const Q4 = { from: '2026-10-01', to: '2026-12-31' };
const Y2026 = { from: '2026-01-01', to: '2026-12-31' };
const J = (x) => JSON.stringify(x);

/** The portal with the report modules and the starters: { NS, kit, G }. */
function load(opts) {
  const L = T.portal(Object.assign({ today: TODAY, extra: EXTRA }, opts || {}));
  const NS = L.NS;
  if (!NS.reportsData || !NS.reports || !NS.reportsPdf) throw new Error('the report modules did not load (NS.reportsData, NS.reports, NS.reportsPdf)');
  return L;
}

/** Every table cell string and tile value of a model (the figures a reader must find in the PDF). */
function figures(m) {
  const out = [];
  (m.blocks || []).forEach((b) => {
    if (b.k === 'tiles') b.items.forEach((t) => out.push(t.value));
    else if (b.k === 'table') {
      b.rows.forEach((r) => r.forEach((c) => out.push(c.s)));
      (b.total || []).forEach((c) => out.push(c.s));
    }
  });
  return out.map((s) => String(s == null ? '' : s).trim()).filter(Boolean);
}
const flat = (s) => String(s).replace(/\s+/g, ' ');

let seq = 0;
/** Composes the model and reads the PDF back: { file, text, info, pages }. */
async function paper(L, model, name) {
  const bytes = await L.NS.reportsPdf.compose(model, { kit: L.kit, images: {} });
  const file = T.save(T.work('reports-starters'), `${name}-${++seq}.pdf`, bytes);
  return { file, text: T.text(file), info: T.info(file), pages: bytes.pages };
}

/** A stored copy of a starter (B1/B2: the as-built startFrom), or throws naming the starter. */
function template(NS, ws, id) {
  return NS.reports.startFrom(ws, id, { at: '2027-01-20T10:00:00Z', by: 'Check Runner' });
}

/** The PDF of a starter for a recipient: resolve (errors must be empty), compose, read back. */
async function report(L, ws, id, spec, rid, check, what) {
  const t = template(L.NS, ws, id);
  const r = L.NS.reports.resolve(ws, t, Object.assign({ when: WHEN }, spec), rid);
  check(`${what}: resolve gives no error`, r.errors.length === 0 && !!r.model, r.errors);
  if (!r.model) return null;
  const P = await paper(L, r.model, id);
  return Object.assign({ model: r.model }, P);
}

/** Checks that every string is in the PDF text and that none of `absent` is. */
function holds(check, what, P, want, absent) {
  const lost = missingIn(P.text, want);
  check(`${what}: the PDF holds ${want.length} hand-worked strings`, lost.length === 0, lost);
  const fig = missingIn(P.text, figures(P.model));
  check(`${what}: the PDF holds every table cell and tile value of its model (${figures(P.model).length})`, fig.length === 0, fig.slice(0, 10));
  const seen = (absent || []).filter((s) => flat(P.text).indexOf(s) >= 0);
  check(`${what}: no other investor's name in the PDF`, seen.length === 0, seen);
}

/** pdfinfo's Author, Producer and Creator are the firm's legal name (or name), and the text and properties leak nothing. */
function brand(check, what, P, firm) {
  const who = firm.legalName || firm.name;
  check(`${what}: Author, Producer and Creator are the firm's name`, P.info.Author === who && P.info.Producer === who && P.info.Creator === who, { Author: P.info.Author, Producer: P.info.Producer, Creator: P.info.Creator, want: who });
  const lk = T.leak(P.text + '\n' + J(P.info));
  check(`${what}: no vendor, library or model name, never audited or the forbidden word (text and properties)`, lk.ok, lk.hits.slice(0, 5));
}

const parts = {
  /**
   * Task 1 (tracer): fund A's FA-1001 through the real adapters, the model and the composer (12-01-PLAN.md's hand-worked
   * figures, clock 2027-01-20).
   */
  async 'fund-a'({ check }) {
    const L = load();
    const { NS } = L;
    const { ws } = T.fundA(NS);
    const firm = NS.reportsData.firm(ws);
    const AUD = { kind: 'investor', investorId: 'FA-1001', offeringId: 'fund-a' };

    // st-capital, Q4 2026. Begin 334,000.00; distributions −6,000.00 (fa-run-1); gain 2/3 x 30,000 = 20,000.00; fees 3 x
    // 1,000 = −3,000.00; end 345,000.00. Year to date: contributed 300,000.00, income 3,000.00, gain 60,000.00, fees
    // −12,000.00. Commitment 600,000.00, ownership 2/3 = 66.67%.
    const st = await report(L, ws, 'st-capital', Object.assign({ audience: AUD }, Q4), 'FA-1001', check, 'st-capital');
    if (st) {
      holds(
        check,
        'st-capital',
        st,
        ['Quarter ended December 31, 2026', 'Investor One', 'Fund A Sponsor Management, LLC', '$334,000.00', '−$6,000.00', '$20,000.00', '−$3,000.00', '$345,000.00', '$300,000.00', '$3,000.00', '$60,000.00', '−$12,000.00', '$600,000.00', '66.67%', 'Preliminary: the books are not closed for this period.'],
        ['Investor Two']
      );
      const cap = st.model.blocks.find((b) => b.k === 'table' && b.title === 'Your capital account');
      check('st-capital: the capital table has the period and the year to date', !!cap && cap.cols.map((c) => c.h).join('|') === 'Line item|Q4 2026|Year to date', cap && cap.cols);
      check('st-capital: the commitment tiles and the capital activity are there', st.model.blocks.some((b) => b.k === 'tiles' && b.items.some((t) => t.label === 'Commitment' && t.v === 60000000)) && st.model.blocks.some((b) => b.k === 'table' && b.title === 'Capital activity'));
      check('st-capital: one columns chart of the distributions', st.model.blocks.filter((b) => b.k === 'chart').map((b) => b.kind).join() === 'columns', st.model.blocks.filter((b) => b.k === 'chart').map((b) => b.kind));
      brand(check, 'st-capital', st, firm);
    }

    // dn-notice for fa-run-1: 6,000.00 gross, nothing withheld, paid by ACH on December 15, 2026.
    const dn = await report(L, ws, 'dn-notice', { runId: 'fa-run-1', audience: { kind: 'investor', investorId: 'FA-1001' } }, 'FA-1001', check, 'dn-notice');
    if (dn) {
      holds(check, 'dn-notice', dn, ['$6,000.00', '$0.00', 'Realization proceeds', 'ACH', 'Paid December 15, 2026', 'Investor One'], ['Investor Two']);
      check("dn-notice: the cover is the plain style", dn.model.cover.on === true && dn.model.cover.style === 'plain', dn.model.cover);
      brand(check, 'dn-notice', dn, firm);
    }

    // p-summary for 2026: fund paid in 450,000.00, distributed 9,000.00, net asset value 517,500.00; DPI 0.02x, RVPI 1.15x,
    // TVPI 1.17x.
    const ps = await report(L, ws, 'p-summary', Object.assign({ audience: AUD }, Y2026), 'FA-1001', check, 'p-summary');
    if (ps) {
      holds(check, 'p-summary', ps, ['$450,000.00', '$9,000.00', '$517,500.00', '0.02x', '1.15x', '1.17x', 'Year ended December 31, 2026'], ['Investor Two']);
      brand(check, 'p-summary', ps, firm);
    }

    // t-season, tax year 2026: fa-run-1 paid 6,000.00 gross and net, 0.00 withheld.
    const ts = await report(L, ws, 't-season', { year: 2026, audience: { kind: 'investor', investorId: 'FA-1001' } }, 'FA-1001', check, 't-season');
    if (ts) {
      const tax = ts.model.blocks.find((b) => b.k === 'table' && b.title === 'Tax summary');
      check('t-season: the tax summary row is Fund A, $6,000.00 gross, $0.00 withheld, $6,000.00 net', !!tax && J(tax.rows.map((r) => r.map((c) => c.s))) === J([['Fund A, L.P.', '$6,000.00', '$0.00', '$6,000.00']]), tax && tax.rows);
      holds(check, 't-season', ts, ['Tax year 2026', 'Investor One', '$6,000.00', '$0.00'], ['Investor Two']);
      brand(check, 't-season', ts, firm);
    }
  }
};

module.exports = { load, figures, paper, template, report, holds, brand, TODAY, WHEN, Q4, Y2026 };

if (require.main === module) {
  require(path.join(T.P6, 'lib.js')).runParts(parts, { name: 'REPORTS STARTERS', unit: 'cases', flag: '--case' });
}
