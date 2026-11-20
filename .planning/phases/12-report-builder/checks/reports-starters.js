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
/** pdftotext -raw: the text in the order it is drawn (a table cell wrapped onto two lines reads as one run). */
function rawText(file) {
  const r = require('child_process').spawnSync('pdftotext', ['-raw', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`pdftotext -raw exited ${r.status}`);
  return r.stdout;
}
/** Composes the model and reads the PDF back: { file, text (-layout), raw (-raw), info, pages }. */
async function paper(L, model, name) {
  const bytes = await L.NS.reportsPdf.compose(model, { kit: L.kit, images: {} });
  const file = T.save(T.work('reports-starters'), `${name}-${++seq}.pdf`, bytes);
  return { file, text: T.text(file), raw: rawText(file), info: T.info(file), pages: bytes.pages };
}
/** The strings found in neither reading of the PDF (layout, or drawing order for cells wrapped inside their column). */
const lostIn = (P, list) => missingIn(P.raw, missingIn(P.text, list));

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
  const lost = lostIn(P, want);
  check(`${what}: the PDF holds ${want.length} hand-worked strings`, lost.length === 0, lost);
  const fig = lostIn(P, figures(P.model));
  check(`${what}: the PDF holds every table cell and tile value of its model (${figures(P.model).length})`, fig.length === 0, fig.slice(0, 10));
  const seen = (absent || []).filter((s) => flat(P.text).indexOf(s) >= 0);
  check(`${what}: no other investor's name in the PDF`, seen.length === 0, seen);
}

/* ---------- The starter list as the plan states it (12-05-PLAN.md interfaces; B1) ---------- */
// id: [type, fundType, sections on in the order given (cover and disclosures are always on), chart]. dn-letter has no
// 'distributions' section: the catalogue offers none for a distribution notice (the notice's 'Distributions to date'
// column carries the total), so it is letter and notice.
const A_REVIEW = ['letter', 'capital', 'distributions', 'performance', 'holdings', 'fees', 'statements', 'chart', 'outlook'];
const EXPECT = {
  'st-capital': ['statement', 'any', ['capital', 'commitment', 'distributions', 'chart'], 'dist'],
  'st-consolidated': ['statement', 'any', ['summary', 'capital', 'commitment', 'distributions', 'chart'], 'allocation'],
  'st-yearend': ['statement', 'any', ['letter', 'capital', 'commitment', 'distributions', 'performance'], 'none'],
  'dn-notice': ['distribution', 'any', ['notice'], 'none'],
  'dn-letter': ['distribution', 'any', ['letter', 'notice'], 'none'],
  'q-realestate': ['quarterly', 'realestate', ['letter', 'capital', 'distributions', 'performance', 'assets', 'fees', 'chart', 'outlook'], 'dist'],
  'q-credit': ['quarterly', 'credit', ['letter', 'capital', 'distributions', 'performance', 'holdings', 'fees', 'chart', 'outlook'], 'dist'],
  'q-pe': ['quarterly', 'pe', ['letter', 'capital', 'commitment', 'performance', 'holdings', 'fees', 'chart', 'outlook'], 'capital'],
  'q-spv': ['quarterly', 'spv', ['letter', 'capital', 'distributions', 'assets', 'performance', 'chart'], 'dist'],
  'q-open': ['quarterly', 'open', ['letter', 'capital', 'performance', 'holdings', 'fees', 'chart', 'outlook'], 'capital'],
  'q-firm': ['quarterly', 'any', ['letter', 'summary', 'capital', 'performance', 'chart', 'outlook'], 'allocation'],
  'a-review': ['annual', 'any', A_REVIEW, 'capital'],
  'a-realestate': ['annual', 'realestate', ['letter', 'capital', 'distributions', 'performance', 'holdings', 'assets', 'fees', 'statements', 'chart', 'outlook'], 'capital'],
  'a-rega': ['annual', 'any', A_REVIEW, 'capital'],
  'p-summary': ['performance', 'any', ['performance', 'holdings', 'fees', 'chart'], 'allocation'],
  'p-property': ['performance', 'realestate', ['holdings', 'assets', 'performance'], 'none'],
  't-season': ['tax', 'any', ['letter', 'taxsummary', 'taxdocs'], 'none'],
  't-documents': ['tax', 'any', ['taxdocs'], 'none']
};
// options the plan sets (every other section keeps the catalogue's defaults)
const OPTS = {
  'st-capital': { capital: { second: 'ytd' }, commitment: { activity: true } },
  'st-yearend': { capital: { second: 'itd' } },
  'a-review': { capital: { second: 'itd' } },
  'a-realestate': { capital: { second: 'itd' } },
  'a-rega': { capital: { second: 'itd' } },
  't-season': { taxdocs: { expected: '' } }
};
// starter fund type -> the sample funds' accounting profiles it is offered for ('any' is every fund)
const MATCH = { realestate: ['realestate'], credit: ['credit'], pe: ['pe', 'vc'], spv: ['spv'], open: ['hedge', 'digital', 'multistrat'] };
const FIRM_FIELDS = ['firm', 'team', 'phone', 'period', 'period_end'];
const BAD_WORDS = [/\baudited\b/i, /ILPA compliant/i, /gross (IRR|return|performance|multiple)/i, /invest more|additional investment|new offering|opportunity to invest/i];

/** The expected section keys in order: the catalogue's order, with the sections on taking their places in the order listed. */
function expectedOrder(R, type, on) {
  const q = on.slice();
  return R.CATALOGUE.filter((c) => c.types.indexOf(type) >= 0).map((c) => (on.indexOf(c.key) >= 0 ? q.shift() : c.key));
}
/** All wording of a template: every section's text and the disclosures. */
const wordingOf = (t) => t.sections.map((s) => s.text).concat([t.disclosures]);
/** Every string anywhere in a value. */
function stringsOf(x, out) {
  out = out || [];
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((y) => stringsOf(y, out));
  else if (x && typeof x === 'object') Object.keys(x).forEach((k) => stringsOf(x[k], out));
  return out;
}
const profileOf = (NS, o) => (NS.OFFERING_TYPES[o.type] || NS.OFFERING_TYPES.Other).profile;
const offeredFor = (st, profile) => st.fundType === 'any' || (MATCH[st.fundType] || []).indexOf(profile) >= 0;
/** The composer's rule for a bar or point height (reports-pdf.js fracs): 0..1 as given, otherwise against the largest. */
function drawnFracs(vals) {
  const v = vals.map(Number);
  const unit = v.every((x) => x >= 0 && x <= 1);
  const most = Math.max(0, ...v);
  return v.map((x) => (unit ? x : most > 0 ? Math.max(0, x) / most : 0));
}
/** The tick scale's height of each value: (v - min) / (max - min), min the lower of zero and the least value. */
function tickFracs(vals) {
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  return vals.map((v) => (max - min ? (v - min) / (max - min) : 0));
}
/** Columns and line charts whose drawn heights do not line up with their ticks: [{ title, values, drawn, ticks }]. */
function misaligned(model) {
  return (model.blocks || [])
    .filter((b) => b.k === 'chart' && (b.kind === 'columns' || b.kind === 'line'))
    .filter((b) => {
      const d = drawnFracs(b.values);
      const t = tickFracs(b.values);
      const top = b.ticks.length ? Math.max(...b.ticks.map((x) => x.at)) : 1;
      return d.some((f, k) => Math.abs(f - t[k]) > 1e-9) || Math.abs(top - 1) > 1e-9;
    })
    .map((b) => ({ title: b.title, values: b.values, drawn: drawnFracs(b.values), ticks: b.ticks }));
}

/**
 * Every report every-sample makes, resolved once per process: for every sample firm, every starter, every fund its fund
 * type matches (distribution starters on each fund's newest paid run, to the first and last investor paid in it; tax
 * starters on 2026; annual starters on the 'fy' preset; the others on 'q'), for the fund's first and last holder, and
 * for st-consolidated and q-firm one investor holding several funds (no offering in the audience: W1).
 */
let SAMPLE = null;
function sample() {
  if (SAMPLE) return SAMPLE;
  const L = load();
  const { NS } = L;
  const R = NS.reports;
  const D = NS.reportsData;
  const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));
  const preset = (id) => {
    const p = NS.audit.presets().find((x) => x.id === id);
    return { from: p.from, to: p.to };
  };
  const list = R.starters().filter((s) => !s.blank);
  const firms = sampleWorkspaces(NS).map((ws) => {
    const jobs = [];
    const tpl = {};
    list.forEach((s) => (tpl[s.id] = template(NS, ws, s.id)));
    const add = (s, o, spec, rid, aud) => {
      const r = R.resolve(ws, tpl[s.id], Object.assign({ when: WHEN, audience: aud }, spec), rid);
      jobs.push({ id: s.id, fund: o ? o.id : '(several)', rid, aud, spec, model: r.model, errors: r.errors, what: `${s.id} ${o ? o.id : 'several funds'} ${rid}` });
    };
    const ends = (ids) => Array.from(new Set([ids[0], ids[ids.length - 1]])).filter(Boolean);
    list.forEach((s) => {
      ws.offerings.forEach((o) => {
        if (!offeredFor(s, profileOf(NS, o))) return;
        if (s.type === 'distribution') {
          const run = D.runs(ws, o.id)[0];
          if (!run) return;
          const spec = { runId: run.id };
          ends(R.recipients(ws, tpl[s.id], spec)).forEach((rid) => add(s, o, spec, rid, { kind: 'investor', investorId: rid, offeringId: o.id }));
          return;
        }
        const spec = s.type === 'tax' ? { year: 2026 } : preset(s.type === 'annual' ? 'fy' : 'q');
        const to = spec.to || '2026-12-31';
        ends(D.holders(ws, o.id, to).map((i) => i.id)).forEach((rid) => add(s, o, spec, rid, { kind: 'investor', investorId: rid, offeringId: o.id }));
      });
      if (s.id === 'st-consolidated' || s.id === 'q-firm') {
        const q = preset('q');
        const many = ws.investors
          .map((i) => i.id)
          .sort()
          .find((id) => ((D.consolidated(ws, id, q.from, q.to) || { funds: [] }).funds || []).length >= 2);
        if (many) add(s, null, q, many, { kind: 'investor', investorId: many });
      }
    });
    return { ws, id: ws.tenant.id, firm: D.firm(ws), tpl, jobs };
  });
  SAMPLE = { L, NS, R, D, list, firms };
  return SAMPLE;
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
  },

  /**
   * Task 2 (B1, B2): at least two starters per type, a quarterly letter for each fund type, 18 unique ids; for every
   * starter, startFrom's copy is normalised already, holds the plan's sections on (all others off) in catalogue order,
   * the plan's options, disclosures last and on, starting with the tenant's disclaimer on every sample firm; merge fields
   * only from MERGE_FIELDS, and q-firm's only firm-level ones.
   */
  async catalogue({ check }) {
    const X = sample();
    const { R, list } = X;
    const ids = list.map((s) => s.id);
    check('18 starters, every id once', ids.length === 18 && new Set(ids).size === 18, ids);
    const src = require('fs').readFileSync(path.join(T.ROOT, 'assets/js/reports-templates.js'), 'utf8');
    const reg = Array.from(src.matchAll(/\bstarter\(\s*'([a-z0-9-]+)'/g)).map((m) => m[1]);
    check('reports-templates.js registers each id once', reg.length === 18 && new Set(reg).size === 18, reg);
    check('the starters are exactly the plan’s list', J(ids.slice().sort()) === J(Object.keys(EXPECT).sort()), { missing: Object.keys(EXPECT).filter((k) => ids.indexOf(k) < 0), extra: ids.filter((k) => !EXPECT[k]) });
    R.TYPES.forEach((ty) => {
      const n = R.starters(ty).filter((s) => !s.blank).length;
      check(`${ty}: at least two starters (${n})`, n >= 2, n);
    });
    ['realestate', 'credit', 'pe', 'spv', 'open'].forEach((ft) => check(`a quarterly letter for fund type ${ft}`, list.some((s) => s.type === 'quarterly' && s.fundType === ft)));
    check('no starter name or blurb says the forbidden word, a vendor or audited', list.every((s) => T.leak(s.name + '\n' + s.blurb).ok), list.filter((s) => !T.leak(s.name + '\n' + s.blurb).ok).map((s) => s.id));
    check('every blurb marks the wording as not read by counsel', list.every((s) => /not yet read by counsel/.test(s.blurb)), list.filter((s) => !/not yet read by counsel/.test(s.blurb)).map((s) => s.id));
    const firstWs = X.firms[0];
    const bad = { norm: [], meta: [], order: [], on: [], opts: [], disc: [], fields: [], firm: [] };
    list.forEach((s) => {
      const e = EXPECT[s.id];
      if (!e) return;
      const t = firstWs.tpl[s.id];
      if (J(R.normalise(t)) !== J(t)) bad.norm.push(s.id);
      if (s.type !== e[0] || s.fundType !== e[1] || t.type !== e[0] || t.chart !== e[3] || t.starter !== s.id) bad.meta.push({ id: s.id, type: s.type, fundType: s.fundType, chart: t.chart });
      const order = expectedOrder(R, e[0], e[2]);
      if (J(t.sections.map((x) => x.key)) !== J(order)) bad.order.push({ id: s.id, got: t.sections.map((x) => x.key), want: order });
      const wantOn = ['cover'].concat(e[2], ['disclosures']);
      const offWrong = t.sections.filter((x) => x.on !== (wantOn.indexOf(x.key) >= 0)).map((x) => x.key);
      if (offWrong.length) bad.on.push({ id: s.id, wrong: offWrong });
      const opts = OPTS[s.id] || {};
      t.sections.forEach((x) => {
        const cat = R.CATALOGUE.find((c) => c.key === x.key);
        const want = Object.assign(JSON.parse(J(cat.opts)), opts[x.key] || {});
        if (J(x.opts) !== J(want)) bad.opts.push({ id: s.id, key: x.key, got: x.opts, want });
      });
      const last = t.sections[t.sections.length - 1];
      if (!last || last.key !== 'disclosures' || last.on !== true) bad.disc.push(s.id);
      const used = R.fields([].concat(...wordingOf(t)));
      if (used.some((k) => R.MERGE_FIELDS.indexOf(k) < 0)) bad.fields.push({ id: s.id, used });
      if (s.id === 'q-firm' && used.some((k) => FIRM_FIELDS.indexOf(k) < 0)) bad.firm.push(used);
    });
    check('startFrom(ws, id) is normalised already for every starter (normalise deep-equals it)', !bad.norm.length, bad.norm);
    check('type, fund type and chart are the plan’s', !bad.meta.length, bad.meta);
    check('every catalogue section of the type is present, in catalogue order (listed sections in the order given)', !bad.order.length, bad.order.slice(0, 3));
    check('the listed sections are on (with cover and disclosures) and every other is off', !bad.on.length, bad.on);
    check('section options are the plan’s (catalogue defaults otherwise)', !bad.opts.length, bad.opts.slice(0, 4));
    check('disclosures last and on', !bad.disc.length, bad.disc);
    check('merge fields only from MERGE_FIELDS', !bad.fields.length, bad.fields);
    check('q-firm’s wording uses firm-level fields only (firm, team, phone, period, period_end)', !bad.firm.length, bad.firm);
    // B2: the tenant's disclaimer stays first for every starter on every sample firm, the starter's paragraphs after it
    X.firms.forEach((F) => {
      const disc = String((F.ws.tenant && F.ws.tenant.disclaimer) || '').trim();
      const wrong = list.filter((s) => {
        const d = F.tpl[s.id].disclosures;
        return !disc || !d[0] || R.plain([d[0]]) !== R.plain([{ t: 'p', runs: [{ s: disc, b: false, i: false }] }]) || d.length < 4;
      });
      check(`${F.id}: every starter's disclosures start with the tenant's disclaimer, then the starter's own paragraphs`, !!disc && !wrong.length, wrong.map((s) => [s.id, F.tpl[s.id].disclosures.length, R.plain(F.tpl[s.id].disclosures.slice(0, 1)).slice(0, 60)]));
    });
  },

  /** Task 2: every starter for every matching fund of every sample firm, read back from the PDF. */
  async 'every-sample'({ check }) {
    const X = sample();
    const { L, R } = X;
    const fs = require('fs');
    let made = 0;
    let total = 0;
    const all = new Set();
    for (const F of X.firms) {
      const bad = { resolve: [], compose: [], figures: [], name: [], others: [], titles: [], leak: [], props: [], charts: [] };
      const who = F.firm.legalName || F.firm.name;
      const covered = new Set();
      for (const j of F.jobs) {
        total++;
        covered.add(j.id);
        if (!j.model) {
          bad.resolve.push({ what: j.what, errors: j.errors });
          continue;
        }
        let P;
        try {
          P = await paper(L, j.model, j.id);
        } catch (e) {
          bad.compose.push({ what: j.what, error: String(e && e.message) });
          continue;
        }
        made++;
        const lost = lostIn(P, figures(j.model));
        if (lost.length) bad.figures.push({ what: j.what, lost: lost.slice(0, 5) });
        const me = F.ws.investors.find((i) => i.id === j.rid);
        const text = flat(P.text) + " | " + flat(P.raw);
        if (!me || text.indexOf(me.title) < 0) bad.name.push(j.what);
        const oth = R.othersIn(F.ws, j.model);
        if (oth.length) bad.others.push({ what: j.what, others: oth });
        const titles = F.ws.investors.filter((i) => i.id !== j.rid && i.title && me && me.title.indexOf(i.title) < 0 && text.indexOf(i.title) >= 0).map((i) => i.title);
        if (titles.length) bad.titles.push({ what: j.what, titles });
        const lk = T.leak(P.text + '\n' + J(P.info));
        if (!lk.ok) bad.leak.push({ what: j.what, hits: lk.hits.slice(0, 3) });
        if (P.info.Author !== who || P.info.Producer !== who || P.info.Creator !== who) bad.props.push({ what: j.what, Author: P.info.Author, Producer: P.info.Producer, Creator: P.info.Creator });
        const mis = misaligned(j.model);
        if (mis.length) bad.charts.push({ what: j.what, mis: mis.slice(0, 1) });
        fs.rmSync(P.file, { force: true });
      }
      const n = F.jobs.length;
      // offered here: a fund of the firm matches the starter's fund type, has a holder, and (for a notice) a paid run
      const offered = X.list.filter((s) => F.ws.offerings.some((o) => offeredFor(s, profileOf(X.NS, o)) && X.D.holders(F.ws, o.id, '2026-12-31').length > 0 && (s.type !== 'distribution' || X.D.runs(F.ws, o.id).length > 0)));
      offered.forEach((s) => all.add(s.id));
      check(`${F.id}: every starter offered for one of its funds was made (${covered.size} of ${offered.length})`, offered.every((s) => covered.has(s.id)), offered.map((s) => s.id).filter((id) => !covered.has(id)));
      check(`${F.id}: ${n} reports resolve with no error`, !bad.resolve.length, bad.resolve.slice(0, 3));
      check(`${F.id}: every report composes`, !bad.compose.length, bad.compose.slice(0, 3));
      check(`${F.id}: every PDF holds every table cell string and tile value of its model`, !bad.figures.length, bad.figures.slice(0, 3));
      check(`${F.id}: every PDF holds its recipient's name`, !bad.name.length, bad.name.slice(0, 3));
      check(`${F.id}: othersIn is empty for every model`, !bad.others.length, bad.others.slice(0, 3));
      check(`${F.id}: no other investor of the firm is named in any PDF`, !bad.titles.length, bad.titles.slice(0, 3));
      check(`${F.id}: lib12 leak passes on every PDF's text and properties`, !bad.leak.length, bad.leak.slice(0, 3));
      check(`${F.id}: Author, Producer and Creator are '${who}' in every PDF`, !bad.props.length, bad.props.slice(0, 3));
      check(`${F.id}: every columns and line chart's heights line up with its ticks`, !bad.charts.length, bad.charts.slice(0, 2));
    }
    console.log(`PDFs made: ${made} of ${total} reports`);
    check(`PDFs made: ${made} (every report of every sample firm)`, made > 0 && made === total, { made, total });
    check(`every one of the ${X.list.length} starters is offered on a sample firm and was made (${all.size})`, X.list.every((s) => all.has(s.id)), X.list.map((s) => s.id).filter((id) => !all.has(id)));
  },

  /** Task 2 (C-09): a Regulation A Tier 2 fund's a-rega is its report to investors, with the SEC note; six months: semiannual. */
  async rega({ check }) {
    const L = load();
    const { NS } = L;
    const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    const o = ws.offerings.find((x) => x.id === 'kb-fund-ii');
    o.structure = Object.assign({}, o.structure, { exemption: 'Regulation A Tier 2' });
    check('kb-fund-ii is Regulation A Tier 2', NS.eligibility.regime(o) === 'regA2', NS.eligibility.regime(o));
    const rid = NS.reportsData.holders(ws, 'kb-fund-ii', '2026-12-31')[0].id;
    const aud = { kind: 'investor', investorId: rid, offeringId: 'kb-fund-ii' };
    const SEC = 'This report is not the offering’s filing with the SEC (Form 1-K or Form 1-SA), which is made separately.';
    const year = await report(L, ws, 'a-rega', Object.assign({ audience: aud }, Y2026), rid, check, 'a-rega 2026');
    if (year) {
      check("2026: titled 'Annual report to investors'", year.model.title === 'Annual report to investors', year.model.title);
      const lost = lostIn(year, ['Annual report to investors', 'Year ended December 31, 2026', SEC]);
      check('2026: the PDF holds the title, the period and the SEC line', lost.length === 0, lost);
    }
    const half = await report(L, ws, 'a-rega', { from: '2026-01-01', to: '2026-06-30', audience: aud }, rid, check, 'a-rega H1 2026');
    if (half) {
      check("2026-01-01 to 2026-06-30: titled 'Semiannual report to investors'", half.model.title === 'Semiannual report to investors', half.model.title);
      const lost = lostIn(half, ['Semiannual report to investors', 'Six months ended June 30, 2026', SEC]);
      check('six months: the PDF holds the title, the period and the SEC line', lost.length === 0, lost);
    }
    const plain = await report(L, ws, 'a-review', Object.assign({ audience: { kind: 'investor', investorId: rid, offeringId: 'kb-harlow' } }, Y2026), rid, check, 'a-review kb-harlow 2026');
    if (plain) check("a fund that is not Regulation A keeps 'Annual review' and no SEC line", plain.model.title === 'Annual review' && flat(plain.text).indexOf('Form 1-K') < 0, plain.model.title);
  },

  /** Task 2 (C-07, C-13): the wording rules over every starter and every model string every-sample makes. */
  async words({ check }) {
    const X = sample();
    const { R, list } = X;
    const L6 = require(path.join(T.P6, 'lib.js'));
    const hit = (s) => L6.WORD_RE.test(s) || BAD_WORDS.some((re) => re.test(s));
    const F0 = X.firms[0];
    const bad = list.filter((s) => {
      const t = F0.tpl[s.id];
      return hit([s.name, s.blurb, R.plain([].concat(...wordingOf(t)))].join('\n'));
    });
    check("no starter's name, blurb or wording says the forbidden word, audited, ILPA compliant, gross performance or asks for more investment", !bad.length, bad.map((s) => s.id));
    const notNet = list.filter((s) => !/\bnet\b/i.test(R.plain(F0.tpl[s.id].disclosures)));
    check("every starter's disclosures say net", !notNet.length, notNet.map((s) => s.id));
    const letters = list.filter((s) => {
      const sec = F0.tpl[s.id].sections.find((x) => x.key === 'letter');
      return sec && sec.text.length > 3;
    });
    check('no letter is longer than three paragraphs', !letters.length, letters.map((s) => s.id));
    let n = 0;
    const found = [];
    X.firms.forEach((F) =>
      F.jobs.forEach((j) => {
        if (!j.model) return;
        stringsOf(j.model).forEach((s) => {
          n++;
          if (hit(s) && found.length < 5) found.push({ what: j.what, s: s.slice(0, 120) });
        });
      })
    );
    check(`none of the ${n} model strings every-sample makes breaks a wording rule`, n > 0 && !found.length, found);
  },

  /** Task 2 (RB-05): one section per fund and one total per currency; a USD and a EUR fund are never added together. */
  async consolidated({ check }) {
    const L = load();
    const { NS } = L;
    const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    ws.offerings.find((x) => x.id === 'kb-harlow').currency = 'EUR'; // before the first engine call
    check('kb-harlow is EUR now', NS.structures.curOf(ws.offerings.find((x) => x.id === 'kb-harlow')) === 'EUR');
    const D = NS.reportsData;
    const end = (oid) => D.statement(ws, 'KBC-1001', oid, Q4.from, Q4.to).period.end;
    const usd = end('kb-fund-ii') + end('kb-note-24a');
    const eur = end('kb-harlow');
    const P = await report(L, ws, 'st-consolidated', Object.assign({ audience: { kind: 'investor', investorId: 'KBC-1001' } }, Q4), 'KBC-1001', check, 'st-consolidated KBC-1001');
    if (!P) return;
    const sum = (cur) => P.model.blocks.find((b) => b.k === 'table' && b.title === `Summary (${cur})`);
    const U = sum('USD');
    const E = sum('EUR');
    const last = (t) => t && t.total && t.total[t.total.length - 1];
    check('Summary (USD) total ending capital = kb-fund-ii + kb-note-24a', !!U && last(U).v === usd, { got: last(U), want: usd });
    check('Summary (EUR) total ending capital = kb-harlow, shown with €', !!E && last(E).v === eur && /^−?€/.test(last(E).s), { got: last(E), want: eur });
    const usdS = NS.reports.fmt.money(usd, 'USD');
    const eurS = NS.reports.fmt.money(eur, 'EUR');
    const lost = lostIn(P, [usdS, eurS, 'Summary (USD)', 'Summary (EUR)']);
    check(`the PDF holds the USD total ${usdS} and the EUR total ${eurS}`, lost.length === 0, lost);
    const names = ['Kestrel Bay Fund II, L.P.', 'Harlow Precision Co-Investment, LLC', 'Kestrel Bay Senior Note 2024-A'];
    const h1 = P.model.blocks.filter((b) => b.k === 'h1').map((b) => b.text);
    check('one heading per fund name', J(h1.slice().sort()) === J(names.slice().sort()), h1);
    check('each fund name is in the PDF', lostIn(P, names).length === 0, lostIn(P, names));
    const all = usd + eur;
    const mixed = ['USD', 'EUR'].map((c) => NS.reports.fmt.money(all, c)).filter((s) => flat(P.text).indexOf(s) >= 0);
    const anyTotal = P.model.blocks.filter((b) => b.k === 'table' && b.total).some((b) => b.total.some((c) => c.v === all));
    check('no single total of all three funds (in the model or the PDF)', !mixed.length && !anyTotal, { mixed, anyTotal });
  },

  /** Task 3: the time to build one report in Node, measured (resolve then compose, one after another; no threshold). */
  async speed({ check }) {
    const L = load();
    const { NS } = L;
    const { sampleWorkspaces } = require(path.join(T.P11, 'checks/load11.js'));
    const ws = sampleWorkspaces(NS).find((w) => w.tenant.id === 'kestrel-bay');
    const ids = NS.reportsData.holders(ws, 'kb-fund-ii', Q4.to).map((i) => i.id);
    const t = template(NS, ws, 'q-pe');
    let made = 0;
    const start = Date.now();
    for (const rid of ids) {
      const r = NS.reports.resolve(ws, t, Object.assign({ when: WHEN, audience: { kind: 'investor', investorId: rid, offeringId: 'kb-fund-ii' } }, Q4), rid);
      if (!r.model) continue;
      const bytes = await NS.reportsPdf.compose(r.model, { kit: L.kit, images: {} });
      if (bytes && bytes.length > 4 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === '%PDF-') made++;
    }
    const total = Date.now() - start;
    const per = ids.length ? Math.round(total / ids.length) : 0;
    console.log(`speed: ${ids.length} reports, ${total} ms, ${per} ms per report`);
    check(`q-pe for every holder of kb-fund-ii: ${made} of ${ids.length} reports made (measured with Date.now(), printed, no threshold)`, ids.length > 0 && made === ids.length, { made, holders: ids.length });
  },

  /** The check itself can fail: an unknown case name and an empty list each exit 1 with a FAIL line. */
  async selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8', env: process.env });
    const u = run(['--case', 'nonesuch']);
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nonesuch/m.test(u.stdout), { status: u.status, out: u.stdout.slice(-300) });
    const e = run(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', e.status === 1 && /^FAIL no cases to run/m.test(e.stdout), { status: e.status, out: e.stdout.slice(-300) });
  }
};

module.exports = { load, figures, paper, template, report, holds, brand, TODAY, WHEN, Q4, Y2026 };

if (require.main === module) {
  require(path.join(T.P6, 'lib.js')).runParts(parts, { name: 'REPORTS STARTERS', unit: 'cases', flag: '--case' });
}
