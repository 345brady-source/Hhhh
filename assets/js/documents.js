/*
 * Document previews on the client's letterhead. Figures are drawn from the
 * same records as the portal, so a statement always matches the screens.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const h = B.esc;
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const usdc = (c) => (c < 0 ? '($' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (c < 0 ? ')' : '');
  const date = (iso) => NS.ui.date(iso, 'long');

  function head(t, kicker) {
    return `<header class="paper-head">
        <div class="paper-logo">${B.lockup(t)}</div>
        <div class="paper-from"><strong>${h(t.legalName)}</strong><span>${h(t.support.phone)}</span><span>${h(t.support.email)}</span></div>
      </header>
      <div class="paper-rule"></div>
      <p class="paper-kicker">${h(kicker)}</p>`;
  }
  function to(inv) {
    return `<div class="paper-to"><span>Prepared for</span><strong>${h(inv.title)}</strong><span>Account ${h(inv.id)} · ${h(inv.address || '')}</span></div>`;
  }
  const foot = (t, doc) => `<footer class="paper-foot"><span>${h(t.legalName)} · Confidential</span><span>Page 1 of ${doc.pages}</span></footer>`;

  function quarterSum(p, from, to) {
    return p.payments.filter((x) => x.status === 'paid' && x.date >= from && x.date <= to).reduce((a, x) => a + x.cents, 0);
  }

  NS.paper = function (doc, t, v, ws) {
    const inv = v.investor;
    const pos = doc.offeringId ? v.positions.find((p) => p.offering.id === doc.offeringId) : null;
    const o = pos ? pos.offering : null;
    const year = NS.dates.today().slice(0, 4);
    let body;
    if (doc.kind === 'statement') {
      const from = `${year}-07-01`;
      const end = `${year}-09-30`;
      const rows = v.positions
        .map((p) => `<tr><td>${h(p.offering.name)}</td><td class="num">${usd(p.invested)}</td><td class="num">${usdc(quarterSum(p, from, end))}</td><td class="num">${usdc(quarterSum(p, `${year}-01-01`, end))}</td><td class="num">${usdc(quarterSum(p, '1900-01-01', end))}</td></tr>`)
        .join('');
      const tot = (f, e) => v.positions.reduce((a, p) => a + quarterSum(p, f, e), 0);
      body = `${head(t, 'Account statement')}
        <h1 class="paper-title">Quarter ended September 30, ${year}</h1>
        ${to(inv)}
        <div class="paper-table"><table>
          <thead><tr><th scope="col">Investment</th><th scope="col" class="num">Invested</th><th scope="col" class="num">Q3 distributions</th><th scope="col" class="num">Year to date</th><th scope="col" class="num">Since inception</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><th scope="row">Total</th><td class="num">${usd(v.totals.investedAll)}</td><td class="num">${usdc(tot(from, end))}</td><td class="num">${usdc(tot(`${year}-01-01`, end))}</td><td class="num">${usdc(tot('1900-01-01', end))}</td></tr></tfoot>
        </table></div>
        <p class="paper-small">Distributions are shown on a cash basis by payment date. Amounts are unaudited.</p>`;
    } else if (doc.kind === 'update') {
      const q = doc.title.slice(0, 2);
      body = `${head(t, 'Investor update')}
        <h1 class="paper-title">${h(o.name)}<br>${h(doc.title.replace(' Investor Update', ''))}</h1>
        ${to(inv)}
        <h2 class="paper-h2">Summary</h2>
        <p>${h(o.update || '')}</p>
        <h2 class="paper-h2">Your position</h2>
        <div class="paper-table"><table><tbody>
          <tr><th scope="row">Amount invested</th><td class="num">${usd(pos.invested)}</td></tr>
          <tr><th scope="row">${q} distributions</th><td class="num">${usdc(quarterSum(pos, q === 'Q3' ? `${year}-07-01` : `${year}-04-01`, q === 'Q3' ? `${year}-09-30` : `${year}-06-30`))}</td></tr>
          <tr><th scope="row">Distributions since inception</th><td class="num">${usdc(pos.received)}</td></tr>
          <tr><th scope="row">${h(pos.exit.label)}</th><td class="num">${h(pos.exit.value)}</td></tr>
        </tbody></table></div>`;
    } else if (doc.kind === 'final') {
      const last = pos.payments.filter((x) => x.status === 'paid')[0];
      body = `${head(t, 'Final distribution notice')}
        <h1 class="paper-title">${h(o.name)}</h1>
        ${to(inv)}
        <p>${h(o.exit.note || 'The investment has been sold.')} Your final distribution was paid on ${date(last ? last.date : o.exit.date)}.</p>
        <div class="paper-table"><table><tbody>
          <tr><th scope="row">Amount invested</th><td class="num">${usd(pos.invested)}</td></tr>
          <tr><th scope="row">Final distribution</th><td class="num">${usdc(last ? last.cents : 0)}</td></tr>
          <tr><th scope="row">Total distributions received</th><td class="num">${usdc(pos.received)}</td></tr>
        </tbody></table></div>
        <p class="paper-small">Your final tax documents will be delivered to this portal.</p>`;
    } else if (doc.kind === 'tax') {
      const ty = Number(year) - 1;
      const paid = pos.payments.filter((x) => x.status === 'paid' && x.date.startsWith(String(ty))).reduce((a, x) => a + x.cents, 0);
      const form = doc.title.replace(/^\d{4} /, '');
      body = `${head(t, `Tax document · Tax year ${ty}`)}
        <h1 class="paper-title">${h(form)}</h1>
        ${to(inv)}
        <p><strong>${h(o.name)}</strong></p>
        <div class="paper-table"><table><tbody>
          <tr><th scope="row">Cash distributions in ${ty}</th><td class="num">${usdc(paid)}</td></tr>
          <tr><th scope="row">Taxpayer ID on file</th><td class="num">ending ${h(inv.tinLast4 || '—')}</td></tr>
        </tbody></table></div>
        <p class="paper-small">Summary cover page for this sample. The full ${h(form)} package includes federal and state schedules. Consult your tax advisor.</p>`;
    } else {
      body = `${head(t, 'Legal document')}
        <div class="paper-cover"><h1 class="paper-title">${h(doc.title)}</h1><p>${h(o ? o.name : '')}</p><p class="paper-small">Executed ${date(doc.date)} · ${doc.pages} pages</p></div>`;
    }
    return `<article class="paper" aria-label="Document preview">${body}${foot(t, doc)}</article>`;
  };
})(window.CVPortal);
