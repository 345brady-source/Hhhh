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
  // An open-ended fund charges an incentive allocation, not carried interest.
  const NET_OPEN = 'Performance is shown net of fees and incentive allocation. Past performance does not guarantee future results.';
  // A letter to everyone names no investor.
  const NOT_OFFER_ALL = 'This report is for investors in the funds named in it and is not an offer to sell or a solicitation of an offer to buy any security.';
  /** The paragraphs a report type adds: statements and tax summaries also say book capital is not tax capital. */
  function disclosuresFor(type) {
    const list = [UNAUDITED, NET, NOT_OFFER];
    if (type === 'statement' || type === 'tax') list.push(BOOK);
    return list;
  }

  /**
   * Registers one starter. on: the section keys turned on, in the order they print (cover and disclosures are always on;
   * 'chart' is listed where the chart goes). Every other catalogue section of the type is present and off, in catalogue
   * order; the sections on take the catalogue places of those on, in the order listed. x: { cover (style), chart,
   * opts: { key: options }, text: { key: [paragraphs] }, disclosures: [paragraphs] }.
   */
  function starter(id, name, type, fundType, blurb, on, x) {
    x = x || {};
    const chart = x.chart || 'none';
    const queue = on.slice();
    const sections = R.CATALOGUE.filter((c) => c.types.indexOf(type) >= 0).map((c) => {
      const key = on.indexOf(c.key) >= 0 ? queue.shift() : c.key;
      const cat = R.CATALOGUE.find((e) => e.key === key);
      return {
        key,
        on: key === 'cover' || key === 'disclosures' || on.indexOf(key) >= 0,
        opts: Object.assign(JSON.parse(JSON.stringify(cat.opts)), (x.opts && x.opts[key]) || {}),
        text: ((x.text && x.text[key]) || []).map(p)
      };
    });
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
        disclosures: ((x.disclosures || []).length ? x.disclosures : disclosuresFor(type)).map(p)
      }
    });
  }

  /* ---------- Wording shared by several starters ---------- */
  const CONTACT = 'Please contact {firm} with any questions about this report.';
  const COVERS = (what) => `This report covers {investment} for the period ended {period_end}. It sets out ${what}.`;
  const ITD = { capital: { second: 'itd' } };
  const REVIEW = ['letter', 'capital', 'distributions', 'performance', 'holdings', 'fees', 'statements', 'chart', 'outlook'];
  const REVIEW_TEXT = 'the distributions paid, net performance, holdings at fair value, fees and expenses, and the financial statements';

  /* ---------- Statements ---------- */
  starter('st-capital', 'Capital account statement', 'statement', 'any', 'Each investor’s capital account for the period, with commitment, capital activity and distributions.', ['capital', 'commitment', 'distributions', 'chart'], {
    chart: 'dist',
    opts: { capital: { second: 'ytd' }, commitment: { activity: true } }
  });
  starter('st-consolidated', 'Consolidated statement', 'statement', 'any', 'One statement across every fund an investor holds: a summary per currency, then each fund’s capital account.', ['summary', 'capital', 'commitment', 'distributions', 'chart'], {
    chart: 'allocation'
  });
  starter('st-yearend', 'Year-end statement', 'statement', 'any', 'The value of each investor’s interest at year end, with capital since inception, distributions and net performance.', ['letter', 'capital', 'commitment', 'distributions', 'performance'], {
    opts: ITD,
    text: {
      letter: ['Dear {first_name},', 'This statement shows the value of your interest in {investment} at {period_end}, with your capital account, distributions and net performance.', 'Please contact {firm} with any questions about this statement.']
    }
  });

  /* ---------- Distribution notices ---------- */
  starter('dn-notice', 'Distribution notice', 'distribution', 'any', 'One page per investor: amount, tax withheld, net paid and how it was paid.', ['notice'], { cover: 'plain' });
  starter('dn-letter', 'Distribution notice with cover letter', 'distribution', 'any', 'A short letter, then the amount, tax withheld, net paid and how it was paid.', ['letter', 'notice'], {
    text: {
      letter: ['Dear {first_name},', 'A distribution of {distributions_period} from {investment} has been paid to you. The amount, any tax withheld and the payment details are set out below.', 'Please contact {firm} with any questions.']
    }
  });

  /* ---------- Quarterly letters, by fund type ---------- */
  starter('q-realestate', 'Quarterly letter: real estate', 'quarterly', 'realestate', 'For a real estate fund or syndication: capital account, distributions, net performance and room for an update on each property.', ['letter', 'capital', 'distributions', 'performance', 'assets', 'fees', 'chart', 'outlook'], {
    chart: 'dist',
    text: { letter: [COVERS('the distributions paid, net performance, and fees and expenses'), CONTACT] }
  });
  starter('q-credit', 'Quarterly letter: private credit or income', 'quarterly', 'credit', 'For a private credit or income fund: capital account, distributions, net performance and the loans held.', ['letter', 'capital', 'distributions', 'performance', 'holdings', 'fees', 'chart', 'outlook'], {
    chart: 'dist',
    text: { letter: [COVERS('the distributions paid, net performance, holdings at fair value, and fees and expenses'), CONTACT] }
  });
  starter('q-pe', 'Quarterly letter: venture or private equity', 'quarterly', 'pe', 'For a venture or private equity fund: capital account, commitment, net performance and the portfolio at fair value.', ['letter', 'capital', 'commitment', 'performance', 'holdings', 'fees', 'chart', 'outlook'], {
    chart: 'capital',
    text: { letter: [COVERS('net performance, the portfolio at fair value, and fees and expenses'), CONTACT] }
  });
  starter('q-spv', 'Quarterly letter: single asset', 'quarterly', 'spv', 'For an SPV or co-investment in one asset: capital account, distributions, net performance and room for an update on the asset.', ['letter', 'capital', 'distributions', 'assets', 'performance', 'chart'], {
    chart: 'dist',
    text: { letter: [COVERS('the distributions paid and net performance'), CONTACT] }
  });
  starter('q-open', 'Quarterly letter: open-ended fund', 'quarterly', 'open', 'For a hedge, digital asset or multi-strategy fund: capital account, monthly net returns and holdings.', ['letter', 'capital', 'performance', 'holdings', 'fees', 'chart', 'outlook'], {
    chart: 'capital',
    text: { letter: [COVERS('net returns by month and for the year to date, holdings at fair value, and fees and expenses'), CONTACT] },
    disclosures: [UNAUDITED, NET_OPEN, NOT_OFFER]
  });
  starter('q-firm', 'Quarterly letter: every fund', 'quarterly', 'any', 'One letter from the firm covering every fund, with a summary and each fund’s net performance.', ['letter', 'summary', 'capital', 'performance', 'chart', 'outlook'], {
    chart: 'allocation',
    text: { letter: ['This report covers the period ended {period_end} and sets out the net performance of each fund in it.', 'Please contact {firm} with any questions about this report.'] },
    disclosures: [UNAUDITED, NET, NOT_OFFER_ALL]
  });

  /* ---------- Annual reviews ---------- */
  starter('a-review', 'Annual review', 'annual', 'any', 'The year in full: capital since inception, distributions, net performance, holdings, fees and the financial statements.', REVIEW, {
    chart: 'capital',
    opts: ITD,
    text: { letter: [COVERS(REVIEW_TEXT), CONTACT] }
  });
  starter('a-realestate', 'Annual review: real estate', 'annual', 'realestate', 'The annual review with room for an update on each property.', ['letter', 'capital', 'distributions', 'performance', 'holdings', 'assets', 'fees', 'statements', 'chart', 'outlook'], {
    chart: 'capital',
    opts: ITD,
    text: { letter: [COVERS(REVIEW_TEXT), CONTACT] }
  });
  starter('a-rega', 'Annual report to investors (Regulation A)', 'annual', 'any', 'For a Regulation A offering: titled as its annual or semiannual report to investors, noting that the SEC filing is made separately.', REVIEW, {
    chart: 'capital',
    opts: ITD,
    text: { letter: [COVERS(REVIEW_TEXT), CONTACT] }
  });

  /* ---------- Performance ---------- */
  starter('p-summary', 'Performance and holdings summary', 'performance', 'any', 'Net performance, holdings at fair value, fees and expenses, and a chart of the holdings.', ['performance', 'holdings', 'fees', 'chart'], { chart: 'allocation' });
  starter('p-property', 'Property summary', 'performance', 'realestate', 'Each property at fair value, room for an update on each, and the fund’s net performance.', ['holdings', 'assets', 'performance']);

  /* ---------- Tax season ---------- */
  starter('t-season', 'Tax-season summary', 'tax', 'any', 'Cash distributions paid in the tax year and the status of each tax document.', ['letter', 'taxsummary', 'taxdocs'], {
    opts: { taxdocs: { expected: '' } },
    text: {
      letter: ['Dear {first_name},', 'This summary lists the cash distributions paid to you in the tax year shown above and the status of your tax documents. Your tax documents, not this summary, are what to use when you file.', 'Please contact {firm} with any questions.']
    }
  });
  starter('t-documents', 'Tax documents notice', 'tax', 'any', 'A short notice listing each investor’s tax documents for the year and where each one stands.', ['taxdocs']);
})();
