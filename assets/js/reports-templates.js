/*
 * Investor reports: the starter templates (phase 12, plan 12-05).
 *
 * Each starter is registered with NS.reports.addStarter at load. A starter names the sections it turns on; every other
 * catalogue section of its type is present and off, in catalogue order, the cover first and the disclosures last.
 * Starters carry only the disclosure paragraphs they add: NS.reports.startFrom puts the tenant's own disclaimer first.
 *
 * The wording is default text the sponsor edits before sending. Neither the owner nor any counsel has read it (each
 * starter's blurb says so). Rules it follows: every sentence is true for any fund of the starter's type with the figures
 * the report shows; no market claim, forecast or promise; no request to invest more and no offering; merge fields only
 * from NS.reports.MERGE_FIELDS (a letter meant for everyone uses firm-level fields only); performance is net only.
 */
(function () {
  'use strict';
  const NS = (window.CVPortal = window.CVPortal || {});
  const R = NS.reports;
  if (!R || typeof R.addStarter !== 'function') return;

  const p = (s) => ({ t: 'p', runs: [{ s, b: false, i: false }] });
  const UNREAD = 'Default wording, not yet read by counsel.';

  /* ---------- Disclosures (added after the tenant's disclaimer) ---------- */
  const UNAUDITED = 'Figures are unaudited and prepared from the fund’s books as of the date shown.';
  const NET = 'Performance is shown net of fees and carried interest. Past performance does not guarantee future results.';
  const NOT_OFFER = 'This report is for the investor named on it and is not an offer to sell or a solicitation of an offer to buy any security.';
  const BOOK = 'Book capital, not tax capital. Your tax documents are authoritative for tax purposes.';
  /** The paragraphs a report type adds: statements and tax summaries also say book capital is not tax capital. */
  function disclosuresFor(type) {
    const list = [UNAUDITED, NET, NOT_OFFER];
    if (type === 'statement' || type === 'tax') list.push(BOOK);
    return list.map(p);
  }

  /**
   * Registers one starter. on: the section keys turned on (cover and disclosures are always on). x: { cover (style),
   * chart, opts: { key: options }, text: { key: [paragraphs] }, disclosures: [paragraphs] }.
   */
  function starter(id, name, type, fundType, blurb, on, x) {
    x = x || {};
    const chart = x.chart || 'none';
    const keys = on.concat(chart !== 'none' ? ['chart'] : []);
    const sections = R.CATALOGUE.filter((c) => c.types.indexOf(type) >= 0).map((c) => ({
      key: c.key,
      on: c.key === 'cover' || c.key === 'disclosures' || keys.indexOf(c.key) >= 0,
      opts: Object.assign(JSON.parse(JSON.stringify(c.opts)), (x.opts && x.opts[c.key]) || {}),
      text: ((x.text && x.text[c.key]) || []).map(p)
    }));
    R.addStarter({
      id,
      name,
      type,
      fundType,
      blurb: `${blurb} ${UNREAD}`,
      template: {
        cover: { style: x.cover || 'band', accent: '', photoId: '' },
        chart,
        sections,
        disclosures: (x.disclosures || []).length ? x.disclosures.map(p) : disclosuresFor(type)
      }
    });
  }

  /* ---------- Statements ---------- */
  starter('st-capital', 'Capital account statement', 'statement', 'any', 'Each investor’s capital account for the period, with commitment, capital activity and distributions.', ['capital', 'commitment', 'distributions'], {
    chart: 'dist',
    opts: { capital: { second: 'ytd' }, commitment: { activity: true } }
  });

  /* ---------- Distribution notices ---------- */
  starter('dn-notice', 'Distribution notice', 'distribution', 'any', 'One page per investor: amount, tax withheld, net paid and how it was paid.', ['notice'], { cover: 'plain' });

  /* ---------- Performance ---------- */
  starter('p-summary', 'Performance and holdings summary', 'performance', 'any', 'Net performance, holdings at fair value, fees and expenses, and a chart of the holdings.', ['performance', 'holdings', 'fees'], { chart: 'allocation' });

  /* ---------- Tax season ---------- */
  starter('t-season', 'Tax-season summary', 'tax', 'any', 'Cash distributions paid in the tax year and the status of each tax document.', ['letter', 'taxsummary', 'taxdocs'], {
    opts: { taxdocs: { expected: '' } },
    text: {
      letter: ['Dear {first_name},', 'This summary lists the cash distributions paid to you in the tax year shown above and the status of your tax documents. Your tax documents, not this summary, are what to use when you file.', 'Please contact {firm} with any questions.']
    }
  });
})();
