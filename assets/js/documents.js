/*
 * Document previews. Each sample document renders as a page on the client's
 * letterhead, so statements and notices carry the same brand as the portal.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const h = B.esc;
  const money = (n) => (n < 0 ? '(' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US') + (n < 0 ? ')' : '');
  const pct = (n, dp) => (n * 100).toFixed(dp == null ? 1 : dp) + '%';
  function date(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function letterhead(t, docLabel) {
    return `<header class="paper-head">
      <div class="paper-logo">${B.lockup(t)}</div>
      <div class="paper-from"><strong>${h(t.legalName)}</strong><span>${h(t.support.phone)}</span><span>${h(t.support.email)}</span></div>
    </header>
    <div class="paper-rule"></div>
    <p class="paper-kicker">${h(docLabel)}</p>`;
  }
  function addressee(d) {
    return `<div class="paper-to"><span>Prepared for</span><strong>${h(d.investor.entity)}</strong><span>Attn: ${h(d.investor.name)} · Investor ID ${h(d.investor.id)}</span></div>`;
  }
  function footer(t, doc) {
    return `<footer class="paper-foot"><span>${h(t.legalName)} · Confidential</span><span>Page 1 of ${doc.pages}</span></footer>`;
  }

  function statement(doc, t, d) {
    const q3 = doc.id === 'stmt-q3';
    const rk = q3 ? 'roll' : 'rollQ2';
    const cols = d.funds.map((f) => `<th scope="col" class="num">${h(f.short)}</th>`).join('') + '<th scope="col" class="num">Total</th>';
    const line = (label, vals) => `<tr><th scope="row">${label}</th>${vals.map((v) => `<td class="num">${money(v)}</td>`).join('')}<td class="num">${money(vals.reduce((a, b) => a + b, 0))}</td></tr>`;
    const roll = (label, k, sign) => line(label, d.funds.map((f) => f[rk][k] * (sign || 1)));
    // Cumulative figures as of the statement date (Q2 backs out Q3 activity).
    const asOf = (f, key) => {
      if (q3) return f[key];
      if (key === 'contributed') return f.contributed - f.roll.contrib;
      if (key === 'distributed') return f.distributed - f.roll.dist;
      if (key === 'unfunded') return f.commitment - (f.contributed - f.roll.contrib);
      return f[key];
    };
    const summary = (label, key) => line(label, d.funds.map((f) => asOf(f, key)));
    return `${letterhead(t, 'Capital account statement')}
      <h1 class="paper-title">Quarter ended ${q3 ? 'September 30, 2026' : 'June 30, 2026'}</h1>
      ${addressee(d)}
      <div class="paper-table"><table>
        <thead><tr><th scope="col">Capital account</th>${cols}</tr></thead>
        <tbody>
          ${roll('Beginning balance', 'begin')}
          ${roll('Contributions', 'contrib')}
          ${roll('Distributions', 'dist', -1)}
          ${roll('Net income and unrealized gain (loss)', 'gain')}
        </tbody>
        <tfoot>${roll('Ending balance', 'end')}</tfoot>
      </table></div>
      <div class="paper-table"><table>
        <thead><tr><th scope="col">Commitment summary</th>${cols}</tr></thead>
        <tbody>
          ${summary('Commitment', 'commitment')}
          ${summary('Contributed to date', 'contributed')}
          ${summary('Unfunded commitment', 'unfunded')}
          ${summary('Distributions to date', 'distributed')}
        </tbody>
      </table></div>
      <p class="paper-small">Amounts are unaudited and subject to change upon completion of the annual audit. Net income and unrealized gain is shown net of management fees, partnership expenses and accrued carried interest.</p>
      ${footer(t, doc)}`;
  }

  function quarterly(doc, t, d) {
    const f = d.funds[doc.fund];
    const q = doc.id.indexOf('q3') >= 0 ? 'Q3 2026' : 'Q2 2026';
    return `${letterhead(t, 'Quarterly report')}
      <div class="paper-cover">
        <p class="paper-eyebrow">${h(q)}</p>
        <h1 class="paper-title">${h(f.name)}</h1>
        <p class="paper-lede">${h(t.letter.excerpt)}</p>
      </div>
      <div class="paper-stats">
        <div><span>Your capital account</span><strong>${money(f.nav)}</strong></div>
        <div><span>Net TVPI</span><strong>${f.tvpi.toFixed(2)}×</strong></div>
        <div><span>Net IRR</span><strong>${f.irr.toFixed(1)}%</strong></div>
        <div><span>Called</span><strong>${pct(f.calledPct, 0)}</strong></div>
      </div>
      <h2 class="paper-h2">In this report</h2>
      <ol class="paper-toc"><li><span>Letter from the managing partners</span><span>2</span></li><li><span>Portfolio summary and valuation</span><span>5</span></li><li><span>Fund financial statements</span><span>14</span></li><li><span>Your capital account</span><span>21</span></li></ol>
      ${footer(t, doc)}`;
  }

  function monthly(doc, t, d) {
    const month = doc.title.replace(' Monthly Update', '');
    return `${letterhead(t, 'Monthly update')}
      <h1 class="paper-title">${h(month)}</h1>
      ${addressee(d)}
      <h2 class="paper-h2">Highlights</h2>
      <ul class="paper-list">
        <li>Your combined capital account was ${money(d.totals.nav)} at the most recent quarter end.</li>
        <li>${h(d.openCall.fundName)} issued Call No. ${d.openCall.no} for ${money(d.openCall.amount)}, due ${date(d.openCall.due)}.</li>
        <li>Q3 2026 quarterly reports and capital account statements are now in your document vault.</li>
      </ul>
      <h2 class="paper-h2">Upcoming dates</h2>
      <ul class="paper-list">${d.events.map((e) => `<li>${date(e.date)}: ${h(e.title)}</li>`).join('')}</ul>
      ${footer(t, doc)}`;
  }

  function call(doc, t, d) {
    const open = doc.id === 'call-7';
    const c = open ? d.openCall : Object.assign({}, d.calls[0], { fundLong: d.funds[d.calls[0].fund].name, commitment: d.funds[d.calls[0].fund].commitment });
    return `${letterhead(t, 'Capital call notice')}
      <h1 class="paper-title">${h(c.fundLong)}<br>Capital Call No. ${c.no}</h1>
      ${addressee(d)}
      <p>In accordance with the limited partnership agreement, the general partner is calling capital from limited partners. Your share is shown below.</p>
      <div class="paper-table"><table><tbody>
        <tr><th scope="row">Your commitment</th><td class="num">${money(c.commitment)}</td></tr>
        <tr><th scope="row">This call</th><td class="num"><strong>${money(c.amount)}</strong></td></tr>
        <tr><th scope="row">Purpose</th><td class="num">${h(c.purpose)}</td></tr>
        <tr><th scope="row">Notice date</th><td class="num">${date(c.notice)}</td></tr>
        <tr><th scope="row">Due date</th><td class="num"><strong>${date(c.due)}</strong></td></tr>
      </tbody></table></div>
      <h2 class="paper-h2">Wire instructions</h2>
      <div class="paper-table"><table><tbody>
        <tr><th scope="row">Bank</th><td class="num">First Harbor Trust Company</td></tr>
        <tr><th scope="row">Account name</th><td class="num">${h(c.fundLong)}</td></tr>
        <tr><th scope="row">Account number</th><td class="num">•••• 7731</td></tr>
        <tr><th scope="row">Reference</th><td class="num">${h(d.investor.entity)} · Call ${c.no}</td></tr>
      </tbody></table></div>
      <p class="paper-warning"><strong>Wire fraud warning.</strong> ${h(t.shortName)} will never change wire instructions by email. Call ${h(t.support.phone)} to confirm these instructions before sending funds.</p>
      ${footer(t, doc)}`;
  }

  function distribution(doc, t, d) {
    const rows = d.distributions.filter((x) => x.date === '2026-09-24');
    const tot = rows.reduce((a, x) => a + x.amount, 0);
    return `${letterhead(t, 'Distribution notice')}
      <h1 class="paper-title">Distribution of ${money(tot)}</h1>
      ${addressee(d)}
      <p>The following distribution will be paid on ${date('2026-09-24')} by ${h(d.investor.bank.method)} to ${h(d.investor.bank.name)} ${h(d.investor.bank.type)} ending ${h(d.investor.bank.last4)}.</p>
      <div class="paper-table"><table>
        <thead><tr><th scope="col">Investment</th><th scope="col">Type</th><th scope="col" class="num">Amount</th></tr></thead>
        <tbody>${rows.map((x) => `<tr><td>${h(d.funds[x.fund].name)}</td><td>${h(x.type)}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">Total</th><td class="num">${money(tot)}</td></tr></tfoot>
      </table></div>
      ${footer(t, doc)}`;
  }

  function k1(doc, t, d) {
    const f = d.funds[doc.fund];
    const base = f.commitment / 1000;
    const lines = [
      ['1', 'Ordinary business income (loss)', -Math.round(base * 3.1)],
      ['5', 'Interest income', Math.round(base * 1.5)],
      ['6a', 'Ordinary dividends', Math.round(base * 2.2)],
      ['9a', 'Net long-term capital gain (loss)', Math.round(base * (doc.fund === 0 ? 42.6 : doc.fund === 1 ? 6.4 : 0))],
      ['13', 'Other deductions', -Math.round(base * 4.8)],
      ['19', 'Distributions', doc.fund === 0 ? Math.round(base * 136) : doc.fund === 1 ? Math.round(base * 34.7) : 0]
    ];
    return `${letterhead(t, 'Tax document · Tax year 2025')}
      <h1 class="paper-title">Schedule K-1 (Form 1065) summary</h1>
      ${addressee(d)}
      <p><strong>${h(f.name)}</strong></p>
      <div class="paper-table"><table>
        <thead><tr><th scope="col">Box</th><th scope="col">Partner's share of income, deductions and credits</th><th scope="col" class="num">Amount</th></tr></thead>
        <tbody>${lines.map((l) => `<tr><td>${l[0]}</td><td>${l[1]}</td><td class="num">${money(l[2])}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="paper-small">Sample summary page for demonstration. The full package includes federal Schedule K-1, state schedules and footnotes. Consult your tax advisor.</p>
      ${footer(t, doc)}`;
  }

  function cover(doc, t, d, kicker, lede) {
    return `${letterhead(t, kicker)}
      <div class="paper-cover paper-cover-tall">
        <p class="paper-eyebrow">${h(doc.fundName)}</p>
        <h1 class="paper-title">${h(doc.title)}</h1>
        <p class="paper-lede">${lede}</p>
        <p class="paper-small">${date(doc.date)} · ${doc.pages} pages</p>
      </div>
      ${footer(t, doc)}`;
  }

  NS.paper = function (doc, t, d) {
    let inner;
    switch (doc.kind) {
      case 'statement':
        inner = statement(doc, t, d);
        break;
      case 'quarterly':
        inner = quarterly(doc, t, d);
        break;
      case 'monthly':
        inner = monthly(doc, t, d);
        break;
      case 'call':
        inner = call(doc, t, d);
        break;
      case 'distribution':
        inner = distribution(doc, t, d);
        break;
      case 'k1':
        inner = k1(doc, t, d);
        break;
      case 'legal':
        inner = cover(doc, t, d, 'Legal document', 'Executed copy for your records. Contact investor relations if you need a certified copy.');
        break;
      case 'financials':
        inner = cover(doc, t, d, 'Audited financial statements', 'Year ended December 31, 2025, with the report of the independent auditor.');
        break;
      case 'presentation':
        inner = cover(doc, t, d, 'Annual meeting', `Presentation from the ${h(t.shortName)} annual investor meeting.`);
        break;
      case 'offering':
        inner = cover(doc, t, d, 'Confidential · For existing investors', `${h(t.offering.strategy)} This material is not an offer to sell any security.`);
        break;
      default:
        inner = cover(doc, t, d, 'Document', '');
    }
    return `<article class="paper" aria-label="Document preview">${inner}</article>`;
  };
})(window.CVPortal);
