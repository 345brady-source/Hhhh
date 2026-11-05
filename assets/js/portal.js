/*
 * Investor portal pages: Investments, Investment detail, Distributions,
 * Documents, Account and Sign-in. Kept deliberately small: what each investor
 * put in, what they have received, and how long until each investment exits.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const U = NS.ui;
  const { h, usd, usdc, date, icon } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const T = () => NS.state.ws.tenant;

  function viewer() {
    const w = W();
    return w.investors.find((x) => x.id === S().viewer) || w.investors[0] || null;
  }
  function vm() {
    const inv = viewer();
    return inv ? NS.investorView(W(), inv.id) : null;
  }

  /* ---------- Shell ---------- */
  const NAV = [
    ['investments', 'Investments'],
    ['distributions', 'Distributions'],
    ['documents', 'Documents'],
    ['account', 'Account'],
    ['preferences', 'Settings']
  ];
  function shell(inner, active) {
    const t = T();
    const inv = viewer();
    const links = NAV.map(([k, label]) => `<a href="#${k}"${active === k ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    return `<div class="pt${S().navOpen ? ' nav-open' : ''}">
      <header class="pt-head">
        <div class="pt-head-in">
          <a class="pt-logo" href="#investments" aria-label="${h(t.name)} ${h(t.portalName)}">${B.lockup(t)}</a>
          <nav class="pt-nav" id="pt-nav" aria-label="${h(t.portalName)}">${links}</nav>
          <div class="pt-user">${inv ? `<span class="pt-user-name">${h(inv.contact)}</span><span class="pt-user-acct">${h(inv.title)}</span>` : ''}<a class="pt-signout" href="#sign-in">Sign out</a></div>
          <button class="pt-menu" type="button" data-action="nav-toggle" aria-controls="pt-nav" aria-expanded="${S().navOpen}">${icon('menu')}<span>Menu</span></button>
        </div>
      </header>
      <main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap">${inner}</div></main>
      ${footer()}
    </div>`;
  }
  function footer() {
    const t = T();
    return `<footer class="pt-foot"><div class="pt-wrap">
      <div class="pt-foot-row"><span>${h(t.support.team)}</span><span>${h(t.support.phone)}</span><span>${h(t.support.email)}</span><span>${h(t.support.hours)}</span></div>
      <p>${h(t.disclaimer)}</p>
      <p class="pt-foot-legal">© ${new Date().getFullYear()} ${h(t.legalName)}${t.showPoweredBy ? ' · Powered by Carrow &amp; Vale' : ''}</p>
    </div></footer>`;
  }
  NS.portalFooter = footer;
  const title = (t, sub) => `<div class="pt-title"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const fig = (label, value, note) => `<div class="fig"><dt>${label}</dt><dd>${value}</dd>${note ? `<span>${note}</span>` : ''}</div>`;
  const sec = (label, extra) => `<div class="sec-head"><h2>${label}</h2>${extra || ''}</div>`;

  function holdBar(x) {
    if (x.progress == null) return `<span class="hold-text">${h(x.remaining)}</span>`;
    const win = x.windowStart != null ? `<span class="hold-win" style="left:${(x.windowStart * 100).toFixed(1)}%"></span>` : '';
    return `<div class="hold"><span class="hold-bar" role="img" aria-label="${Math.round(x.progress * 100)}% of the projected holding period has elapsed">${win}<span class="hold-fill" style="width:${(x.progress * 100).toFixed(1)}%"></span></span><span class="hold-text">${h(x.remaining)}</span></div>`;
  }
  NS.holdBar = holdBar;

  function noAccount() {
    return shell(`${title('Investments')}<p class="empty">No investments are recorded for this account yet. Your investments will appear here once your subscription is accepted and funded.</p>`, 'portfolio');
  }

  /* ---------- Time to redemption ---------- */
  function redemption(o) {
    const now = NS.dates.today();
    const e = o.exit || {};
    const M = NS.dates.monthsBetween;
    const span = NS.dates.span;
    const yrs = (m) => Math.max(1, Math.round(m / 12));
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    switch (e.basis) {
      case 'maturity':
        return now >= e.date ? ['Matured', `Matured ${date(e.date)}`] : [span(M(now, e.date)), `Matures ${date(e.date)}`];
      case 'range': {
        const a = M(now, e.from);
        const b = M(now, e.to);
        const fy = e.from.slice(0, 4);
        const ty = e.to.slice(0, 4);
        const proj = `Projected ${fy === ty ? fy : fy + '–' + ty}`;
        if (b < 0) return ['Past projected window', proj];
        if (a <= 0) return [`Now through ${date(e.to, 'my')}`, proj];
        if (a >= 12 && yrs(a) === yrs(b)) return [`About ${plural(yrs(a), 'year')}`, proj];
        return [a < 12 ? `${plural(a, 'month')} to ${plural(yrs(b), 'year')}` : `${yrs(a)}–${yrs(b)} years`, proj];
      }
      case 'open':
        return ['No set term', 'Open-ended'];
      case 'exited':
        return ['Completed', e.date ? date(e.date) : ''];
      default:
        if (!e.date) return ['Not set', ''];
        return now >= e.date ? ['Past projected date', `Projected ${date(e.date, 'my')}`] : [span(M(now, e.date)), `Projected ${date(e.date, 'my')}`];
    }
  }

  /* ---------- Distributions by investment ---------- */
  /** One row per investment: its last payment and its next distribution date. */
  function byInvestmentTable(positions) {
    if (!positions.length) return '<p class="empty">No active investments.</p>';
    let moved = false;
    const rows = positions
      .map((p) => {
        const last = p.payments.find((x) => x.status === 'paid');
        const n = NS.nextDistribution(W(), p.offering);
        if (n && n.moved) moved = true;
        return `<tr>
          <th scope="row"><a href="#investment-${h(p.offering.id)}">${h(p.offering.name)}</a><span class="sub">${h((p.offering.distribution || {}).frequency || '')}</span></th>
          <td class="nowrap" data-label="Last distribution">${last ? date(last.date) : '—'}</td>
          <td class="num" data-label="Amount">${last ? usdc(last.cents) : '—'}</td>
          <td data-label="Next distribution">${n ? `<span class="strong">${date(n.date)}</span><span class="sub">${n.scheduled ? 'Scheduled payment' : h(n.schedule)}</span>` : '<span class="sub">No set schedule</span>'}</td>
        </tr>`;
      })
      .join('');
    return `<div class="tbl-scroll"><table class="tbl tbl-stack">
      <thead><tr><th scope="col">Investment</th><th scope="col">Last distribution</th><th scope="col" class="num">Amount</th><th scope="col">Next distribution</th></tr></thead>
      <tbody>${rows}</tbody></table></div>${moved ? '<p class="meta">Payments due on a weekend or bank holiday are made the next banking day.</p>' : ''}`;
  }

  /* ---------- Investments ---------- */
  NS.views.investments = {
    mode: 'portal',
    render() {
      const v = vm();
      if (!v || !v.positions.length) return noAccount();
      const inv = v.investor;
      const today = NS.dates.today();
      const activeRows = v.active
        .map(
          (p) => `<tr>
          <th scope="row"><a href="#investment-${h(p.offering.id)}">${h(p.offering.name)}</a><span class="sub">${h(p.offering.type)}</span></th>
          <td class="num" data-label="Invested">${usd(p.invested)}</td>
          <td class="num" data-label="Distributions received">${usdc(p.received)}</td>
          <td class="nowrap" data-label="Date invested">${date(p.date)}</td>
          ${(() => {
            const [time, when] = redemption(p.offering);
            return `<td data-label="Time to redemption"><span class="strong">${h(time)}</span><span class="sub">${h(when)}</span></td>`;
          })()}
        </tr>`
        )
        .join('');
      const activeTotal = v.active.reduce((a, p) => a + p.received, 0);
      const exitedRows = v.exited
        .map(
          (p) => `<tr>
          <th scope="row"><a href="#investment-${h(p.offering.id)}">${h(p.offering.name)}</a><span class="sub">${h(p.offering.type)}</span></th>
          <td class="num" data-label="Invested">${usd(p.invested)}<span class="sub">${date(p.date, 'my')}</span></td>
          <td class="num" data-label="Distributions received">${usdc(p.received)}</td>
          <td data-label="Completed">${h(p.exit.value)}<span class="sub">${h(p.exit.remaining)}</span></td>
        </tr>`
        )
        .join('');
      const scheduled = v.payments.filter((p) => p.status === 'scheduled');
      return shell(
        `${title('Investments', `${h(inv.title)} · Account ${h(inv.id)} · As of ${date(today, 'long')}`)}
        <dl class="figs">
          ${fig('Invested', usd(v.totals.invested), `${v.active.length} active investment${v.active.length === 1 ? '' : 's'}`)}
          ${fig('Distributions received', usdc(v.totals.received), 'All investments, to date')}
          ${fig(`Received in ${today.slice(0, 4)}`, usdc(v.totals.ytd), 'Year to date')}
          ${scheduled.length ? fig('Scheduled', usdc(v.totals.scheduled), `Next payment ${date(scheduled[scheduled.length - 1].date)}`) : ''}
        </dl>

        <section class="sec">
          ${sec('Current investments')}
          <div class="tbl-scroll"><table class="tbl tbl-stack">
            <thead><tr><th scope="col">Investment</th><th scope="col" class="num">Invested</th><th scope="col" class="num">Distributions received</th><th scope="col">Date invested</th><th scope="col">Time to redemption</th></tr></thead>
            <tbody>${activeRows || '<tr><td colspan="5" class="empty-cell">No active investments.</td></tr>'}</tbody>
            ${v.active.length > 1 ? `<tfoot><tr><th scope="row">Total</th><td class="num" data-label="Invested">${usd(v.totals.invested)}</td><td class="num" data-label="Distributions received">${usdc(activeTotal)}</td><td class="empty-td"></td><td class="empty-td"></td></tr></tfoot>` : ''}
          </table></div>
        </section>

        ${
          v.exited.length
            ? `<section class="sec">${sec('Completed investments')}<div class="tbl-scroll"><table class="tbl tbl-stack">
            <thead><tr><th scope="col">Investment</th><th scope="col" class="num">Invested</th><th scope="col" class="num">Distributions received</th><th scope="col">Completed</th></tr></thead>
            <tbody>${exitedRows}</tbody></table></div></section>`
            : ''
        }

        <section class="sec">
          ${sec('Recent distributions', '<a class="sec-link" href="#distributions">All distributions</a>')}
          ${byInvestmentTable(v.active)}
        </section>`,
        'investments'
      );
    }
  };

  function paymentsTable(list, showOffering) {
    if (!list.length) return '<p class="empty">No distributions have been paid yet.</p>';
    const w = W();
    const name = (id) => {
      const o = w.offerings.find((x) => x.id === id);
      return o ? o.name : id;
    };
    return `<div class="tbl-scroll"><table class="tbl tbl-stack">
      <thead><tr><th scope="col">Payment date</th>${showOffering ? '<th scope="col">Investment</th>' : ''}<th scope="col">Type</th><th scope="col" class="num">Amount</th><th scope="col">Status</th></tr></thead>
      <tbody>${list
        .map(
          (p) => `<tr><td class="nowrap td-lead">${date(p.date)}</td>${showOffering ? `<td class="td-full" data-label="Investment">${h(name(p.offeringId))}</td>` : ''}<td data-label="Type">${h(p.type)}</td><td class="num" data-label="Amount">${usdc(p.cents)}</td><td data-label="Status">${p.status === 'scheduled' ? '<span class="status status-pending">Scheduled</span>' : '<span class="status">Paid</span>'}</td></tr>`
        )
        .join('')}</tbody>
    </table></div>`;
  }

  /* ---------- Investment detail ---------- */
  NS.views.investment = {
    mode: 'portal',
    render(id) {
      const v = vm();
      const p = v && v.positions.find((x) => x.offering.id === id);
      if (!p) return shell(`${title('Investment not found')}<p class="empty">This investment is not on your account. <a href="#investments">Return to your investments</a>.</p>`, 'portfolio');
      const o = p.offering;
      const x = p.exit;
      const t = T();
      const terms = (o.terms || []).filter((r) => r.show && r.label);
      const docs = NS.investorDocs(W(), v).filter((d) => d.offeringId === o.id);
      const pays = p.payments;
      const showAll = S().ui.allPays === o.id;
      const shown = showAll ? pays : pays.slice(0, 12);
      const e = o.exit || {};
      const timeline =
        x.progress == null
          ? `<p class="lede">${h(e.note || x.remaining)}</p>`
          : `<div class="tl">
              <div class="tl-bar"><span class="tl-fill" style="width:${(x.progress * 100).toFixed(1)}%"></span>${x.windowStart != null ? `<span class="tl-win" style="left:${(x.windowStart * 100).toFixed(1)}%"></span>` : ''}<span class="tl-now" style="left:${(x.progress * 100).toFixed(1)}%"></span></div>
              <div class="tl-labels"><span>Closed ${date(o.closeDate)}</span><span>${e.basis === 'range' ? `Exit window ${date(e.from, 'my')} – ${date(e.to, 'my')}` : `${h(x.label)} ${h(x.value)}`}</span></div>
              <p class="tl-note"><strong>${h(x.remaining)}.</strong> ${h(e.note || '')}</p>
            </div>`;
      const dist = o.distribution || {};
      const next = NS.nextDistribution(W(), o);
      return shell(
        `<a class="back" href="#investments">${icon('back')}Investments</a>
        ${title(h(o.name), `${h(o.type)}${o.summary ? ' · ' + h(o.summary) : ''}`)}
        <dl class="figs">
          ${fig('Your investment', usd(p.invested), `Funded ${date(p.date)}`)}
          ${fig('Distributions received', usdc(p.received), `${pays.filter((q) => q.status === 'paid').length} payments`)}
          ${fig('Distributions', h(dist.frequency || '—'), [next ? `Next ${date(next.date)}` : '', h(dist.target || '')].filter(Boolean).join(' · '))}
          ${fig(h(x.label), h(x.value), h(x.state === 'exited' ? '' : NS.holdYear(o)))}
        </dl>

        <section class="sec">${sec(x.state === 'exited' ? 'Holding period' : x.state === 'open' ? 'Term' : 'Time to exit')}${timeline}</section>

        <div class="cols">
          <section class="sec">${sec('Key terms')}${
            terms.length ? `<dl class="terms">${terms.map((r) => `<div><dt>${h(r.label)}</dt><dd>${h(r.value)}</dd></div>`).join('')}</dl>` : '<p class="empty">No terms published.</p>'
          }</section>
          <section class="sec">${sec('Latest update')}${o.update ? `<p class="lede">${h(o.update)}</p><p class="meta">${h(t.shortName)}</p>` : '<p class="empty">No update published.</p>'}</section>
        </div>

        <section class="sec">
          ${sec('Distributions from this investment', pays.length > 12 ? `<button class="sec-link link-btn" type="button" data-action="toggle-pays" data-id="${h(o.id)}">${showAll ? 'Show recent' : `Show all ${pays.length}`}</button>` : '')}
          ${paymentsTable(shown, false)}
        </section>

        <section class="sec">${sec('Documents')}${docsTable(docs, false)}</section>`,
        'investments'
      );
    }
  };
  NS.views.portfolio = NS.views.investments;
  NS.actions['toggle-pays'] = (el) => {
    S().ui.allPays = S().ui.allPays === el.getAttribute('data-id') ? null : el.getAttribute('data-id');
    NS.app.render();
  };

  /* ---------- Distributions ---------- */
  NS.views.distributions = {
    mode: 'portal',
    render() {
      const v = vm();
      if (!v || !v.positions.length) return noAccount();
      const ui = S().ui;
      const inv = v.investor;
      const years = Array.from(new Set(v.payments.map((p) => p.date.slice(0, 4)))).sort().reverse();
      const fy = ui.distYear || 'all';
      const fo = ui.distOff || 'all';
      const list = v.payments.filter((p) => (fy === 'all' || p.date.startsWith(fy)) && (fo === 'all' || p.offeringId === fo));
      const shown = ui.distAll ? list : list.slice(0, 40);
      const sum = list.filter((p) => p.status === 'paid').reduce((a, p) => a + p.cents, 0);
      const bank = inv.payment && inv.payment.method === 'ach' && inv.payment.bank;
      const paidTo = bank ? `Paid by ACH to ${bank.type === 'savings' ? 'savings' : 'checking'} account ending ${U.last4(bank.account)}` : 'Paid by check to your mailing address';
      return shell(
        `${title('Distributions', paidTo)}
        <dl class="figs">
          ${fig('Total received', usdc(v.totals.received), 'All investments, to date')}
          ${fig(`Received in ${NS.dates.today().slice(0, 4)}`, usdc(v.totals.ytd), 'Year to date')}
          ${fig('Scheduled', usdc(v.totals.scheduled), v.totals.scheduled ? 'Approved, not yet paid' : 'None scheduled')}
        </dl>
        <section class="sec">
          ${sec('Received by year')}
          <div class="chart" data-chart="annual"></div>
        </section>
        <section class="sec">
          ${sec('Payment history')}
          <div class="filters">
            <label for="f-year"><span>Year</span><select id="f-year" data-change="dist-year"><option value="all">All years</option>${years.map((y) => `<option${fy === y ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
            <label for="f-off"><span>Investment</span><select id="f-off" data-change="dist-off"><option value="all">All investments</option>${v.positions.map((p) => `<option value="${h(p.offering.id)}"${fo === p.offering.id ? ' selected' : ''}>${h(p.offering.name)}</option>`).join('')}</select></label>
            <p class="filters-sum">${list.length} payments · ${usdc(sum)} paid</p>
          </div>
          ${paymentsTable(shown, true)}
          ${list.length > shown.length ? `<button class="link-btn more" type="button" data-action="dist-all">Show all ${list.length} payments</button>` : ''}
        </section>`,
        'distributions'
      );
    },
    after() {
      const host = document.querySelector('[data-chart="annual"]');
      if (!host) return;
      const v = vm();
      const byYear = {};
      v.payments.filter((p) => p.status === 'paid').forEach((p) => {
        const y = p.date.slice(0, 4);
        byYear[y] = (byYear[y] || 0) + p.cents;
      });
      const ys = Object.keys(byYear).sort();
      const cur = NS.dates.today().slice(0, 4);
      if (!ys.length) {
        host.innerHTML = '<p class="empty">No distributions yet.</p>';
        return;
      }
      const draw = () =>
        NS.charts.columns(host, {
          labels: ys.map((y) => (y === cur ? `${y} YTD` : y)),
          values: ys.map((y) => byYear[y] / 100),
          color: 'var(--chart-1)',
          seriesName: 'Distributions received',
          height: 220,
          ariaLabel: `Distributions received by year. ${ys.map((y) => `${y}: ${usdc(byYear[y])}`).join('; ')}.`
        });
      draw();
      NS.charts.watch(host, draw);
    }
  };
  NS.changes['dist-year'] = (el) => {
    S().ui.distYear = el.value;
    S().ui.distAll = false;
    NS.app.render();
  };
  NS.changes['dist-off'] = (el) => {
    S().ui.distOff = el.value;
    S().ui.distAll = false;
    NS.app.render();
  };
  NS.actions['dist-all'] = () => {
    S().ui.distAll = true;
    NS.app.render();
  };

  /* ---------- Documents ---------- */
  function docsTable(docs, showOffering) {
    if (!docs.length) return '<p class="empty">No documents match.</p>';
    const w = W();
    const name = (id) => (id ? (w.offerings.find((x) => x.id === id) || {}).name || '' : 'All investments');
    return `<div class="tbl-scroll"><table class="tbl tbl-mid tbl-stack tbl-docs">
      <thead><tr><th scope="col">Date</th><th scope="col">Document</th>${showOffering ? '<th scope="col">Investment</th>' : ''}<th scope="col">Type</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
      <tbody>${docs
        .map(
          (d) => `<tr><td class="nowrap td-meta">${date(d.date)}</td><td class="td-lead"><button class="link-btn doc-link" type="button" data-action="open-doc" data-id="${h(d.id)}">${h(d.title)}</button></td>${showOffering ? `<td class="td-meta td-sep">${h(name(d.offeringId))}</td>` : ''}<td class="td-meta td-sep">${h(d.cat)}</td><td class="num td-action"><button class="btn btn-small" type="button" data-action="open-doc" data-id="${h(d.id)}">View</button></td></tr>`
        )
        .join('')}</tbody>
    </table></div>`;
  }
  NS.views.documents = {
    mode: 'portal',
    render() {
      const v = vm();
      if (!v || !v.positions.length) return noAccount();
      const ui = S().ui;
      const all = NS.investorDocs(W(), v);
      const fo = ui.docOff || 'all';
      const fc = ui.docCat || 'all';
      const cats = Array.from(new Set(all.map((d) => d.cat)));
      const list = all.filter((d) => (fo === 'all' || d.offeringId === fo) && (fc === 'all' || d.cat === fc));
      return shell(
        `${title('Documents', 'Reports, tax documents, statements and agreements for your account')}
        <div class="filters">
          <label for="d-off"><span>Investment</span><select id="d-off" data-change="doc-off"><option value="all">All investments</option>${v.positions.map((p) => `<option value="${h(p.offering.id)}"${fo === p.offering.id ? ' selected' : ''}>${h(p.offering.name)}</option>`).join('')}</select></label>
          <label for="d-cat"><span>Type</span><select id="d-cat" data-change="doc-cat"><option value="all">All types</option>${cats.map((c) => `<option${fc === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
          <p class="filters-sum">${list.length} of ${all.length} documents</p>
        </div>
        ${docsTable(list, true)}`,
        'documents'
      );
    }
  };
  NS.changes['doc-off'] = (el) => {
    S().ui.docOff = el.value;
    NS.app.render();
  };
  NS.changes['doc-cat'] = (el) => {
    S().ui.docCat = el.value;
    NS.app.render();
  };
  NS.actions['open-doc'] = (el) => {
    const v = vm();
    const doc = NS.investorDocs(W(), v).find((d) => d.id === el.getAttribute('data-id'));
    if (!doc) return;
    U.dialog(
      `<div class="dlg-head"><div><h2>${h(doc.title)}</h2><p>${date(doc.date)} · ${doc.pages} page${doc.pages === 1 ? '' : 's'} · PDF</p></div>
        <div class="dlg-actions"><button class="btn btn-small" type="button" data-action="doc-download">${icon('download')}Download</button><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body">${NS.paper(doc, T(), v, W())}</div>`,
      'dlg-doc'
    );
  };
  NS.actions['doc-download'] = () => U.toast('Sample document. No file is attached in this demo portal.');

  /* ---------- Account ---------- */
  NS.views.account = {
    mode: 'portal',
    render() {
      const inv = viewer();
      if (!inv) return noAccount();
      const t = T();
      const bank = inv.payment && inv.payment.method === 'ach' ? inv.payment.bank : null;
      const typeLabel = (NS.ENTITY_TYPES[inv.type] || {}).label || inv.type;
      const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
      return shell(
        `${title('Account', `${h(inv.title)} · Account ${h(inv.id)}`)}
        <div class="cols">
          <section class="sec">${sec('Investor')}<dl class="terms">
            ${row('Account title', h(inv.title))}
            ${row('Investing as', h(typeLabel))}
            ${row('Primary contact', h(inv.contact))}
            ${row('Email', h(inv.email))}
            ${row('Phone', h(inv.phone || '—'))}
            ${row('Mailing address', h(inv.address || '—'))}
          </dl><p class="meta">To change these details, contact ${h(t.support.team)} at ${h(t.support.phone)}.</p></section>

          <section class="sec">${sec('Distribution payments', '<button class="sec-link link-btn" type="button" data-action="update-bank">Update bank account</button>')}<dl class="terms">
            ${row('Method', bank ? 'Direct deposit (ACH)' : 'Check by mail')}
            ${bank ? row('Account', `${bank.type === 'savings' ? 'Savings' : 'Checking'} ending ${h(U.last4(bank.account))}`) : ''}
            ${bank ? row('Routing number', `ending ${h(U.last4(bank.routing))}`) : ''}
            ${bank ? row('Account holder', h(bank.holder || inv.title)) : row('Mailed to', h(inv.address || '—'))}
          </dl></section>
        </div>
        <div class="cols">
          <section class="sec">${sec('Tax and accreditation')}<dl class="terms">
            ${row('Tax form', inv.taxForm ? `${h(inv.taxForm)} on file` : 'Not provided')}
            ${row('Taxpayer ID', inv.tinLast4 ? `ending ${h(inv.tinLast4)}` : 'Not provided')}
            ${row('Accreditation', inv.accreditation && inv.accreditation.basis ? 'Verified accredited investor' : 'Not provided')}
            ${inv.accreditation && inv.accreditation.date ? row('Verified', date(inv.accreditation.date)) : ''}
          </dl></section>
          <section class="sec">${sec('Sign-in and delivery')}<dl class="terms">
            ${row('Electronic delivery', inv.edelivery ? 'Consented. Documents are delivered to this portal.' : 'Paper delivery')}
            ${row('Two-step verification', 'On')}
            ${row('Activated', inv.onboarding.completed ? date(inv.onboarding.completed) : '—')}
          </dl></section>
        </div>`,
        'account'
      );
    }
  };
  NS.actions['update-bank'] = () => NS.startOnboarding(viewer().id, 'bank');

  /* ---------- Settings ---------- */
  // Route is #preferences: the bare name "settings" is reserved by the Claude artifact viewer.
  const THEMES = [
    ['light', 'Light', 'White background'],
    ['dark', 'Dark', 'Dark background, easier on the eyes in low light'],
    ['system', 'Match this device', 'Switches automatically with your device’s light or dark setting']
  ];
  NS.views.preferences = {
    mode: 'portal',
    render() {
      const t = T();
      const current = NS.store.get('appearance', null) || t.appearance || 'system';
      return shell(
        `${title('Settings', 'Preferences for this device')}
        <section class="sec settings-sec">
          ${sec('Appearance')}
          <fieldset class="choice settings-choice">
            <legend class="sr-only">Appearance</legend>
            ${THEMES.map(([v, label, sub]) => `<label class="choice-row"><input type="radio" name="appearance" value="${v}" data-change="appearance-pref"${current === v ? ' checked' : ''}><span><strong>${label}</strong><span class="hint">${sub}</span></span></label>`).join('')}
          </fieldset>
          <p class="meta">Saved in this browser.</p>
        </section>`,
        'preferences'
      );
    }
  };
  NS.changes['appearance-pref'] = (el) => {
    if (!el.checked) return;
    NS.app.setAppearance(el.value);
    NS.app.render();
    const again = document.querySelector(`input[name="appearance"][value="${el.value}"]`);
    if (again) again.focus();
    U.toast(`Appearance set to ${el.value === 'system' ? 'match this device' : el.value}`);
  };

  /* ---------- Sign-in ---------- */
  NS.views['sign-in'] = {
    mode: 'portal',
    render() {
      const t = T();
      const inv = viewer();
      const pending = W().investors.find((x) => x.onboarding.status !== 'complete');
      return `<div class="pt pt-auth">
        <header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span></div></header>
        <main class="pt-main" id="main" tabindex="-1"><div class="auth">
          <form class="auth-form" data-form="sign-in" novalidate>
            <h1>${h(t.signin.headline || t.portalName)}</h1>
            <p class="lede">${h(t.signin.sub)}</p>
            <label class="field" for="si-email"><span>Email</span><input id="si-email" name="email" type="email" autocomplete="username" value="${inv ? h(inv.email) : ''}"></label>
            <label class="field" for="si-pass"><span>Password</span><input id="si-pass" name="password" type="password" autocomplete="current-password" value="sample-password"></label>
            <p class="field-error" id="si-error" hidden>Enter your email address and password.</p>
            <button class="btn btn-primary btn-block" type="submit">Sign in</button>
            <div class="auth-links"><button class="link-btn" type="button" data-action="forgot">Forgot your password?</button>${
              pending ? `<button class="link-btn" type="button" data-action="activate" data-id="${h(pending.id)}">First time here? Activate your account</button>` : ''
            }</div>
          </form>
          <aside class="auth-help"><h2>Need help signing in?</h2><p>${h(t.support.team)}</p><p>${h(t.support.phone)}</p><p>${h(t.support.email)}</p><p>${h(t.support.hours)}</p></aside>
        </div></main>
        ${footer()}
      </div>`;
    }
  };
  NS.forms['sign-in'] = (f) => {
    const ok = f.email.value.trim() && f.password.value;
    document.getElementById('si-error').hidden = !!ok;
    if (!ok) return;
    const inv = W().investors.find((x) => x.email.toLowerCase() === f.email.value.trim().toLowerCase());
    if (inv) S().viewer = inv.id;
    if (inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else NS.app.go('investments');
  };
  NS.actions.forgot = () => U.toast('A password reset link would be emailed to the address on file.');
  NS.actions.activate = (el) => NS.startOnboarding(el.getAttribute('data-id'));
})(window.CVPortal);
