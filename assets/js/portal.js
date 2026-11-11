/*
 * Investor portal pages: Home, Investments, Investment detail, Distributions,
 * Documents, Updates, Account and Sign-in. Home leads with the investor's
 * portfolio and investments, with what is open for investment, the firm's own
 * overview and recent documents beside them.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const U = NS.ui;
  const { h, usd, usdc, date, icon } = U;
  /* Offerings in other currencies show amounts in that currency (structures.js). */
  const curOf = (o) => (NS.structures ? NS.structures.curOf(o) : 'USD');
  const money = (amount, o) => (curOf(o) === 'USD' ? usd(amount) : NS.structures.fmtWhole(amount, curOf(o)));
  const moneyc = (cents, o) => (curOf(o) === 'USD' ? usdc(cents) : NS.structures.fmt(cents, curOf(o)));
  /** Share classes open to a new subscription (founders classes close on their date). */
  const openClasses = (o) => (o.classes || []).filter((c) => !c.subscribedBy || NS.dates.today() <= c.subscribedBy);
  const pctTxt = (v, d) => `${+((v === '' || v == null ? d : Number(v) / 100) * 100).toFixed(2)}%`;
  /** Class, feeder fund and side pocket lines for an investor's interest. */
  function structureTerms(inv, o) {
    if (!NS.structures || !NS.audit) return [];
    const X = NS.structures;
    const cfg = NS.audit.settings(o);
    const out = [];
    const cls = cfg.classes && X.classOf(o, inv, cfg.classes);
    if (cls) out.push(['Share class', `${h(cls.name)}: ${pctTxt(cls.mgmtFee, cfg.mgmtFee)} management fee, ${pctTxt(cls.carry, cfg.carry)} ${cfg.open ? 'incentive allocation' : 'carried interest'}`]);
    const f = cfg.feeders && X.feederOf(o, inv, cfg.feeders);
    if (f) out.push(['Invested through', `${h(f.name)}${f.domicile ? ` (${h(f.domicile)})` : ''}, a feeder into the master fund`]);
    if (curOf(o) !== 'USD') out.push(['Currency', `${h(curOf(o))} (${h(X.CURRENCIES[curOf(o)].name)})`]);
    if (cfg.sidePocket) {
      const L = NS.audit.ledger(W(), o);
      const F = L.months && L.months.length ? L.months[L.months.length - 1] : null;
      const a = F && F.rows ? F.rows[inv.id] : null;
      if (a && a.sp > 0) out.push(['Side pocket', `${h(cfg.sidePocket.holding)}: ${moneyc(a.sp, o)} of your capital, held until it is realized; it cannot be redeemed and is not charged incentive until then`]);
    }
    return out;
  }
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
    ['overview', 'Home'],
    ['investments', 'Investments'],
    ['distributions', 'Distributions'],
    ['documents', 'Documents'],
    ['updates', 'Updates'],
    ['account', 'Account']
  ];
  /** The frame of every signed-in page. `opts.banner` is a full-width band shown above the page content (Home). */
  function shell(inner, active, opts) {
    const t = T();
    const inv = viewer();
    const banner = (opts && opts.banner) || '';
    const links = NAV.map(([k, label]) => `<a href="#${k}"${active === k ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    return `<div class="pt${S().navOpen ? ' nav-open' : ''}">
      <header class="pt-head">
        <div class="pt-head-in">
          <a class="pt-logo" href="#overview" aria-label="${h(t.name)} ${h(t.portalName)}">${B.lockup(t)}</a>
          <nav class="pt-nav" id="pt-nav" aria-label="${h(t.portalName)}">${links}<a class="pt-nav-out" href="#sign-in">Sign out</a></nav>
          <div class="pt-user">${inv ? `<span class="pt-user-id"><span class="pt-user-name">${h(inv.contact)}</span>${inv.title && inv.title !== inv.contact ? `<span class="pt-user-acct">${h(inv.title)}</span>` : ''}</span>` : ''}<a class="pt-signout" href="#sign-in">Sign out</a></div>
          <button class="pt-menu" type="button" data-action="nav-toggle" aria-controls="pt-nav" aria-expanded="${S().navOpen}">${icon('menu')}<span>Menu</span></button>
        </div>
      </header>
      <main class="pt-main${banner ? ' pt-main-banner' : ''}" id="main" tabindex="-1">${banner}<div class="pt-wrap">${inner}</div></main>
      ${footer()}
    </div>`;
  }
  function footer() {
    const t = T();
    return `<footer class="pt-foot"><div class="pt-wrap">
      <div class="pt-foot-row"><span>${h(t.support.team)}</span><span>${h(t.support.phone)}</span><span>${h(t.support.email)}</span><span>${h(t.support.hours)}</span></div>
      <p>${h(t.disclaimer)}</p>
      <p class="pt-foot-legal">© ${new Date().getFullYear()} ${h(t.legalName)}${NS.EDITION.poweredBy && t.showPoweredBy ? ` · Powered by ${h(NS.EDITION.poweredBy)}` : ''}</p>
    </div></footer>`;
  }
  NS.portalFooter = footer;
  const title = (t, sub) => `<div class="pt-title"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const fig = (label, value, note) => `<div class="fig"><dt>${label}</dt><dd>${value}</dd>${note ? `<span>${note}</span>` : ''}</div>`;
  const sec = (label, extra) => `<div class="sec-head"><h2>${label}</h2>${extra || ''}</div>`;
  /** Page parts for investor pages defined in other files (esign.js, integrations.js). */
  NS.portalKit = { shell, title, sec, fig, viewer: () => viewer(), footer, openOfferingsHTML: (inv) => openOfferingsHTML(inv) };

  function holdBar(x) {
    if (x.progress == null) return `<span class="hold-text">${h(x.remaining)}</span>`;
    const win = x.windowStart != null ? `<span class="hold-win" style="left:${(x.windowStart * 100).toFixed(1)}%"></span>` : '';
    return `<div class="hold"><span class="hold-bar" role="img" aria-label="${Math.round(x.progress * 100)}% of the projected holding period has elapsed">${win}<span class="hold-fill" style="width:${(x.progress * 100).toFixed(1)}%"></span></span><span class="hold-text">${h(x.remaining)}</span></div>`;
  }
  NS.holdBar = holdBar;

  function noAccount() {
    // Investors who joined from an offering link have no investments yet: show verification status and what is open to them.
    const inv = viewer();
    const open = inv ? openOfferingsHTML(inv) : '';
    // A new subscriber (from an invitation or a sign-up link) sees the subscription they submitted, and can finish setting up.
    const setup = inv && NS.inviteFlow ? NS.inviteFlow.openFor(W(), inv) : null;
    const reqs = inv && myRequests(inv).length ? `<section class="sec">${sec('Your requests')}${requestsHTML(inv, null, true)}</section>` : '';
    const resume = setup ? `<div class="done-box"><p class="lede">Finish setting up your account. Your progress so far is saved.</p><a class="btn btn-primary" href="#invite-${h(setup.token)}">Continue account setup</a></div>` : '';
    return shell(`${title('Investments')}${resume}${inv ? NS.runHooks('investmentsTop', inv) : ''}${reqs}${open}<p class="empty">${open ? 'You have no investments yet. Offerings open for investment are listed above.' : 'No investments are recorded for this account yet. Your investments will appear here once your subscription is accepted and funded.'}</p>`, 'portfolio');
  }

  /* ---------- Notices from the sponsor ---------- */
  function noticesHTML(inv) {
    const list = NS.noticesFor(W(), inv);
    if (!list.length) return '';
    const t = T();
    return `<section class="notices" aria-label="Notices">${list
      .map((n) => {
        const o = n.audience === 'all' ? null : W().offerings.find((x) => x.id === n.audience);
        const subj = NS.mergeNotice(n.subject, inv, t, n, NS.noticeInvestment(W(), inv, n));
        return `<div class="notice">
          <div class="notice-text"><time class="notice-date" datetime="${h(n.date)}">${date(n.date)}</time><strong>${h(subj)}</strong></div>
          <div class="notice-actions">${/^call/.test(n.kind || '') && o ? `<button class="link-btn" type="button" data-action="notice-call" data-id="${h(n.id)}" data-off="${h(o.id)}">View capital call</button>` : `<button class="link-btn" type="button" data-action="notice-open" data-id="${h(n.id)}" data-off="${o ? h(o.id) : 'all'}">View documents</button>`}<button class="link-btn notice-dismiss" type="button" data-action="notice-dismiss" data-id="${h(n.id)}">Dismiss</button></div>
        </div>`;
      })
      .join('')}</section>`;
  }
  function markRead(id) {
    const inv = viewer();
    inv.noticesRead = (inv.noticesRead || []).concat([id]);
    NS.app.save(true);
  }
  NS.actions['notice-dismiss'] = (el) => {
    markRead(el.getAttribute('data-id'));
    NS.app.render();
  };
  NS.actions['notice-call'] = (el) => {
    markRead(el.getAttribute('data-id'));
    NS.app.go('investment-' + el.getAttribute('data-off'));
  };
  NS.actions['notice-open'] = (el) => {
    markRead(el.getAttribute('data-id'));
    S().ui.docOff = el.getAttribute('data-off');
    S().ui.docCat = 'all';
    NS.app.go('documents');
  };

  /* ---------- Capital calls, requests, capital accounts and subscriptions (operations.js, audit.js) ---------- */
  const OPS = () => NS.ops;
  const todayIso = () => NS.dates.today();
  const sameName = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function callsDue(inv) {
    const w = W();
    const out = [];
    if (!OPS()) return out;
    (w.calls || []).forEach((c) =>
      c.items.forEach((it) => {
        const o = w.offerings.find((x) => x.id === c.offeringId);
        if (o && it.investorId === inv.id && !it.received) out.push({ c, it, o });
      })
    );
    return out.sort((a, b) => (a.c.due < b.c.due ? -1 : 1));
  }
  function wireBox(inv, o, c) {
    const wi = OPS().wire(W(), o, inv, c);
    const t = T();
    return `<dl class="wire"><div><dt>Bank</dt><dd>${h(wi.bank)}</dd></div><div><dt>ABA routing number</dt><dd>${h(wi.aba)}</dd></div><div><dt>Account number</dt><dd>${h(wi.accountFull || wi.account)}</dd></div><div><dt>Beneficiary</dt><dd>${h(wi.beneficiary)}</dd></div><div><dt>Reference</dt><dd>${h(wi.reference)}</dd></div></dl>
      <p class="wire-warn">${icon('alert')}<span>Before you send a wire, call ${h(t.support.team)} at ${h(t.support.phone)} to confirm these instructions. ${h(t.shortName)} will never change wire instructions by email.</span></p>`;
  }
  function callsDueHTML(inv) {
    const due = callsDue(inv);
    if (!due.length) return '';
    return `<section class="sec calls-due" aria-label="Capital calls due">${sec('Capital calls due')}${due
      .map(({ c, it, o }) => {
        const late = todayIso() > c.due;
        return `<div class="call-due">
          <div class="call-due-head"><div><strong>${h(o.name)} · Call ${c.number}</strong><span class="sub">${h(c.purpose)} · notice ${date(c.noticeDate)}</span></div><div class="call-due-amt"><span class="num strong">${usdc(it.cents)}</span><span class="status ${late ? 'status-late' : 'status-pending'}">${late ? 'Past due since' : 'Due'} ${date(c.due)}</span></div></div>
          <details><summary>Wire instructions</summary>${wireBox(inv, o, c)}</details>
        </div>`;
      })
      .join('')}</section>`;
  }
  const REQ_STATUS = { pending: 'Received, under review', approved: 'Approved', rejected: 'Declined', paid: 'Paid', funded: 'Funded', accepted: 'Accepted' };
  function myRequests(inv, oid) {
    return (W().requests || []).filter((r) => r.investorId === inv.id && (!oid || r.offeringId === oid)).sort((a, b) => (a.submitted < b.submitted ? 1 : -1));
  }
  function requestsHTML(inv, oid, showFund) {
    const list = myRequests(inv, oid);
    if (!list.length) return '';
    const w = W();
    return `<div class="tbl-scroll"><table class="tbl tbl-stack"><thead><tr><th scope="col">Submitted</th>${showFund ? '<th scope="col">Investment</th>' : ''}<th scope="col">Request</th><th scope="col">Date</th><th scope="col">Status</th></tr></thead><tbody>${list
      .map((r) => {
        const o = w.offerings.find((x) => x.id === r.offeringId);
        const amt = r.type === 'redemption' ? (r.paidCents != null ? usdc(r.paidCents) : r.full ? 'full balance' : usdc(r.cents)) : usdc(r.cents);
        const kind = r.type === 'redemption' ? 'Redemption' : r.additional ? 'Additional subscription' : o && OPS().isOpen(o) ? 'Subscription' : 'Commitment';
        const when = r.dealing ? `${r.type === 'redemption' ? 'Dealing date' : o && OPS().isOpen(o) ? 'Effective' : 'First close'} ${date(r.dealing)}` : '';
        return `<tr><td class="nowrap td-lead">${date(r.submitted)}</td>${showFund ? `<td data-label="Investment">${h(o ? o.name : '')}</td>` : ''}<td data-label="Request">${kind}: ${amt}</td><td data-label="Date">${when}</td><td data-label="Status"><span class="status${r.status === 'pending' ? ' status-pending' : ''}">${REQ_STATUS[r.status] || h(r.status)}</span></td></tr>`;
      })
      .join('')}</tbody></table></div>`;
  }
  /** Offerings this investor can subscribe to now. */
  function openOfferings(inv) {
    const w = W();
    if (!OPS() || !(inv.accreditation && inv.accreditation.basis) || inv.onboarding.status !== 'complete') return [];
    return w.offerings.filter((o) => o.status === 'Raising' && !inv.positions.some((p) => p.offeringId === o.id) && !myRequests(inv, o.id).some((r) => r.status === 'pending' || r.status === 'approved'));
  }
  function openOfferingsHTML(inv, label) {
    const list = openOfferings(inv);
    if (!list.length) return '';
    return `<section class="sec">${sec(label || 'Open for investment')}<div class="offers">${list
      .map((o) => `<div class="offer"><div class="offer-main"><strong>${h(o.name)}</strong><span class="sub">${h(o.type)}${o.summary ? ' · ' + h(o.summary) : ''}</span><span class="sub">Minimum ${usd(o.minimum)} · first close targeted ${date(o.closeDate)}</span></div><a class="btn btn-primary" href="#subscribe-${h(o.id)}">Review and subscribe</a></div>`)
      .join('')}</div></section>`;
  }
  function capitalHTML(inv, o) {
    if (!NS.audit || !OPS()) return '';
    const end = NS.audit.lastMonthEnd(todayIso());
    const cap = OPS().capital(W(), inv, o, '1990-01-01', end);
    if (!cap || (!cap.a.contribCum && !cap.a.end)) return '';
    const a = cap.a;
    const open = cap.P.S.open;
    const paid = a.contribCum;
    const total = a.end + a.distCum;
    const ret = open ? (paid ? (total - paid) / paid : null) : cap.irr;
    const pct = (x) => (x == null ? '—' : `${x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)}%`);
    return `<section class="sec">${sec('Your capital account', `<span class="sec-note">As of ${date(end)}</span>`)}
      <dl class="figs figs-tight">
        ${fig('Capital account', usdc(a.end), open ? 'Net asset value of your interest' : 'Your share of the fund’s net assets')}
        ${fig(open ? 'Net return' : 'Net IRR', pct(ret), open ? 'Since you invested, after fees' : 'Since you invested, after fees and carry')}
        ${fig('Total value', usdc(total), paid ? `${(total / paid).toFixed(2)}x your ${open ? 'subscriptions' : 'contributions'}` : '')}
      </dl>
      <div class="tbl-scroll"><table class="tbl capital-tbl"><tbody>
        <tr><th scope="row">${open ? 'Subscriptions' : 'Contributions'}</th><td class="num">${usdc(a.contrib)}</td></tr>
        <tr><th scope="row">${open ? 'Redemptions' : 'Distributions'}</th><td class="num">${usdc(-a.dist)}</td></tr>
        <tr><th scope="row">Investment income</th><td class="num">${usdc(a.income)}</td></tr>
        <tr><th scope="row">Realized and unrealized gains (losses)</th><td class="num">${usdc(a.gain)}</td></tr>
        <tr><th scope="row">Management fees</th><td class="num">${usdc(-a.fee)}</td></tr>
        ${a.carry ? `<tr><th scope="row">${open ? 'Incentive allocation' : 'Carried interest'}</th><td class="num">${usdc(-a.carry)}</td></tr>` : ''}
        <tr class="row-total"><th scope="row">Capital account</th><td class="num">${usdc(a.end)}</td></tr>
      </tbody></table></div>
      <p class="meta">Values are unaudited estimates based on the latest valuation. Your quarterly capital account statement is in Documents.</p>
    </section>`;
  }
  function callsHTML(inv, o) {
    if (!OPS()) return '';
    const mine = OPS()
      .callsFor(W(), o)
      .map((c) => ({ c, it: c.items.find((x) => x.investorId === inv.id) }))
      .filter((x) => x.it);
    if (!mine.length) return '';
    const commit = OPS().commitOf(inv, o);
    const paid = OPS().paidInOf(inv, o);
    const open = mine.filter((x) => !x.it.received);
    return `<section class="sec">${sec('Capital calls', `<span class="sec-note">${usdc(paid)} of your ${usdc(commit)} commitment contributed · ${usdc(Math.max(0, commit - paid))} unfunded</span>`)}
      <div class="tbl-scroll"><table class="tbl tbl-stack"><thead><tr><th scope="col">Call</th><th scope="col">Notice</th><th scope="col">Due</th><th scope="col" class="num">Amount</th><th scope="col">Status</th></tr></thead><tbody>${mine
        .slice()
        .reverse()
        .map(({ c, it }) => `<tr><td class="td-lead">Call ${c.number}<span class="sub">${h(c.purpose)}</span></td><td class="nowrap" data-label="Notice">${date(c.noticeDate)}</td><td class="nowrap" data-label="Due">${date(c.due)}</td><td class="num" data-label="Amount">${usdc(it.cents)}</td><td data-label="Status">${it.received ? `<span class="status">Received ${date(it.received)}</span>` : `<span class="status ${todayIso() > c.due ? 'status-late' : 'status-pending'}">${todayIso() > c.due ? 'Past due' : 'Due'}</span>`}</td></tr>`)
        .join('')}</tbody></table></div>
      ${open.length ? `<details class="wire-wrap"><summary>Wire instructions for call ${open[0].c.number}</summary>${wireBox(inv, o, open[0].c)}</details>` : ''}
    </section>`;
  }
  function reqForm() {
    return S().ui.reqForm || null;
  }
  function liquidityHTML(inv, o, p) {
    if (!OPS() || !OPS().isOpen(o)) {
      const reqs = requestsHTML(inv, o.id, false);
      return reqs ? `<section class="sec">${sec('Requests')}${reqs}</section>` : '';
    }
    const L = OPS().liquidity(o);
    const first = OPS().firstInvested(inv, o);
    const deal = OPS().dealingDate(o, todayIso(), first);
    const redeemed = p.exit.state === 'exited';
    const f = reqForm() && reqForm().offeringId === o.id ? reqForm() : null;
    const end = NS.audit.lastMonthEnd(todayIso());
    const cap = OPS().capital(W(), inv, o, '1990-01-01', end);
    const pendingRed = myRequests(inv, o.id).some((r) => r.type === 'redemption' && (r.status === 'pending' || r.status === 'approved'));
    const lockEnd = L.lockup && first ? NS.dates.addMonths(first, L.lockup) : '';
    let form = '';
    if (f && f.type === 'redemption') {
      form = `<form class="req-form" data-form="req-submit" novalidate>
        <h3>Request a redemption</h3>
        <fieldset class="field field-wide choice"><legend>Amount</legend>
          <label class="choice-row"><input type="radio" name="rq-full" value="full" data-bind="rq:full"${f.full ? ' checked' : ''}><span><strong>Full redemption</strong><span class="hint">Your entire capital account at the dealing date${cap ? `, about ${usdc(cap.a.end)} today` : ''}</span></span></label>
          <label class="choice-row"><input type="radio" name="rq-full" value="partial" data-bind="rq:full"${f.full ? '' : ' checked'}><span><strong>Partial redemption</strong><span class="hint">A dollar amount; at least $25,000 must remain invested</span></span></label>
        </fieldset>
        ${f.full ? '' : `<label class="field" for="rq-amount"><span>Amount ($)</span><input id="rq-amount" type="number" min="1" step="1000" data-bind="rq:amount" value="${h(f.amount)}"${f.err && f.err.amount ? ' aria-invalid="true"' : ''}>${f.err && f.err.amount ? `<span class="field-error">${h(f.err.amount)}</span>` : ''}</label>`}
        <p class="meta">Paid at net asset value on the ${date(deal)} dealing date (${h(L.frequency.toLowerCase())} dealing, ${L.notice} days’ notice${L.lockup ? `, ${L.lockup}-month lock-up` : ''}), usually within 10 business days after the valuation is final, to your account on file.</p>
        <label class="field field-wide" for="rq-sig"><span>Type your full name to sign</span><input id="rq-sig" type="text" data-bind="rq:signature" value="${h(f.signature)}" autocomplete="off"${f.err && f.err.signature ? ' aria-invalid="true"' : ''}><span class="hint">Signing as ${h(inv.contact)} for ${h(inv.title)} on ${date(todayIso(), 'long')}</span>${f.err && f.err.signature ? `<span class="field-error">${h(f.err.signature)}</span>` : ''}</label>
        <div class="ob-actions"><button class="btn" type="button" data-action="req-cancel">Cancel</button><button class="btn btn-primary" type="submit">Sign and submit request</button></div>
      </form>`;
    } else if (f && f.type === 'subscription') {
      form = `<form class="req-form" data-form="req-submit" novalidate>
        <h3>Add to this investment</h3>
        <label class="field" for="rq-amount"><span>Additional subscription ($)</span><input id="rq-amount" type="number" min="25000" step="5000" data-bind="rq:amount" value="${h(f.amount)}"${f.err && f.err.amount ? ' aria-invalid="true"' : ''}><span class="hint">Minimum $25,000</span>${f.err && f.err.amount ? `<span class="field-error">${h(f.err.amount)}</span>` : ''}</label>
        <p class="meta">Effective ${date(OPS().subscriptionDate(todayIso()))} at that day’s net asset value. After ${h(T().shortName)} approves the request, wire instructions appear here. Your representations in the original subscription agreement apply.</p>
        <label class="field field-wide" for="rq-sig"><span>Type your full name to sign</span><input id="rq-sig" type="text" data-bind="rq:signature" value="${h(f.signature)}" autocomplete="off"${f.err && f.err.signature ? ' aria-invalid="true"' : ''}><span class="hint">Signing as ${h(inv.contact)} for ${h(inv.title)} on ${date(todayIso(), 'long')}</span>${f.err && f.err.signature ? `<span class="field-error">${h(f.err.signature)}</span>` : ''}</label>
        <div class="ob-actions"><button class="btn" type="button" data-action="req-cancel">Cancel</button><button class="btn btn-primary" type="submit">Sign and submit request</button></div>
      </form>`;
    }
    const buttons = redeemed
      ? ''
      : `<div class="req-actions">${pendingRed ? '<span class="meta">You have a redemption request in progress.</span>' : lockEnd && lockEnd > todayIso() && !deal ? '' : `<button class="btn" type="button" data-action="req-form" data-type="redemption" data-off="${h(o.id)}">Request a redemption</button>`}<button class="btn" type="button" data-action="req-form" data-type="subscription" data-off="${h(o.id)}">Add to this investment</button></div>`;
    return `<section class="sec">${sec('Liquidity')}
      <dl class="terms"><div><dt>Dealing</dt><dd>${h(L.frequency)}, on ${L.notice} days’ notice</dd></div><div><dt>Lock-up</dt><dd>${L.lockup ? `${L.lockup} months from each subscription${lockEnd ? ` (yours ${lockEnd > todayIso() ? 'ends' : 'ended'} ${date(lockEnd)})` : ''}` : 'None'}</dd></div>${redeemed ? '' : `<div><dt>Next dealing date for a new request</dt><dd>${deal ? date(deal) : '—'}</dd></div>`}</dl>
      ${f ? form : buttons}
      ${requestsHTML(inv, o.id, false)}
    </section>`;
  }
  NS.actions['req-form'] = (el) => {
    S().ui.reqForm = { type: el.getAttribute('data-type'), offeringId: el.getAttribute('data-off'), full: el.getAttribute('data-type') === 'redemption', amount: '', signature: '', err: null };
    NS.app.render();
    const first = document.querySelector('.req-form input');
    if (first) first.focus();
  };
  NS.actions['req-cancel'] = () => {
    S().ui.reqForm = null;
    NS.app.render();
  };
  NS.binders.rq = (path, v) => {
    const f = reqForm();
    if (!f) return;
    if (path === 'full') {
      f.full = v === 'full';
      NS.app.render();
    } else f[path] = v;
  };
  NS.forms['req-submit'] = () => {
    const f = reqForm();
    const inv = viewer();
    const o = f && W().offerings.find((x) => x.id === f.offeringId);
    if (!f || !inv || !o) return;
    const err = {};
    const cents = Math.round((Number(f.amount) || 0) * 100);
    if (f.type === 'redemption' && !f.full) {
      const cap = OPS().capital(W(), inv, o, '1990-01-01', NS.audit.lastMonthEnd(todayIso()));
      if (!(cents > 0)) err.amount = 'Enter the amount to redeem.';
      else if (cap && cap.a.end - cents < 2500000) err.amount = `At least $25,000 must remain invested. For more, choose a full redemption.`;
    }
    if (f.type === 'subscription' && cents < 2500000) err.amount = 'The minimum additional subscription is $25,000.';
    if (!sameName(f.signature, inv.contact)) err.signature = `Type your name exactly as ${inv.contact}.`;
    f.err = Object.keys(err).length ? err : null;
    if (f.err) return NS.app.render();
    const r = f.type === 'redemption' ? OPS().submitRedemption(W(), inv, o, { full: f.full, cents, signature: f.signature.trim() }) : OPS().submitSubscription(W(), inv, o, { cents, signature: f.signature.trim() });
    S().ui.reqForm = null;
    NS.app.render();
    U.toast(r.type === 'redemption' ? `Redemption request received for the ${date(r.dealing)} dealing date.` : `Subscription request received, effective ${date(r.dealing)} once approved and funded.`);
  };

  /* ---------- Subscribe to an offering that is raising ---------- */
  function subForm(o) {
    const u = S().ui;
    if (!u.sub || u.sub.offeringId !== o.id) u.sub = { offeringId: o.id, amount: String(o.minimum || ''), accredited: false, docs: false, esign: false, signature: '', err: null, done: null };
    return u.sub;
  }
  NS.views.subscribe = {
    mode: 'portal',
    render(id) {
      const inv = viewer();
      const o = W().offerings.find((x) => x.id === id);
      if (!inv || !o || o.status !== 'Raising') return shell(`${title('Not available')}<p class="empty">This offering is not accepting subscriptions. <a href="#investments">Return to your investments</a>.</p>`, 'investments');
      // DIY: an investor still setting up their account subscribes at the end of their invitation flow.
      const setup = NS.inviteFlow ? NS.inviteFlow.openFor(W(), inv) : null;
      // An invitation to subscribe to another offering does not hold up this one.
      if (setup && !(setup.existing && setup.offeringId !== o.id)) return shell(`<a class="back" href="#investments">${icon('back')}Investments</a>${title(`Subscribe to ${h(o.name)}`)}<div class="done-box"><p class="lede">${setup.existing ? `${h(T().shortName)} invited you to subscribe. Your invitation takes you through the documents and the subscription agreement.` : 'Finish setting up your account first. Your subscription is the last step, and your progress so far is saved.'}</p><a class="btn btn-primary" href="#invite-${h(setup.token)}">${setup.existing ? 'Continue your subscription' : 'Continue account setup'}</a></div>`, 'investments');
      // Self-serve edition: the investor signs the offering's own subscription agreement, never a typed form in its place.
      const agr = NS.EDITION && NS.EDITION.diy && NS.esign && NS.esign.templateReady ? NS.esign.templateReady(W(), o.id) : null;
      if (agr === false) return shell(`<a class="back" href="#investments">${icon('back')}Investments</a>${title(`Subscribe to ${h(o.name)}`)}<div class="done-box"><p class="lede">The subscription agreement for ${h(o.name)} is not available to sign online yet. Contact ${h(T().support.team)}${T().support.email ? ` at ${h(T().support.email)}` : ''}.</p></div>`, 'investments');
      const f = subForm(o);
      const cfg = NS.audit ? NS.audit.settings(o) : null;
      if (f.done) {
        // Signed on this form (no agreement envelope): the firm's team reviews it and countersigns the commitment when it
        // accepts it (operations.js). An open-ended fund has no first close: it is funded once accepted.
        const team = h(T().support.team || T().shortName);
        const open = !!(OPS() && OPS().isOpen(o));
        return shell(
          `<a class="back" href="#investments">${icon('back')}Investments</a>
          ${title('Subscription documents signed', h(o.name))}
          <div class="done-box"><p class="lede">${h(T().shortName)} has your signed subscription ${open ? `of ${moneyc(f.done.cents, o)}` : `for a ${moneyc(f.done.cents, o)} commitment`}${f.done.cls && (o.classes || []).find((c) => c.id === f.done.cls) ? ` in ${h(o.classes.find((c) => c.id === f.done.cls).name)}` : ''}. ${open ? `${team} will review it and confirm when it is accepted.` : `${team} will review it and countersign it${o.closeDate ? ` before the first close, targeted for ${date(o.closeDate)}` : ''}.`}</p>
          <p class="lede">${open ? 'No money is due until it is accepted. You will then get wire instructions for funding it before the dealing date.' : 'No money is due now. When the fund calls capital, you will get a capital call notice here with the amount, due date and wire instructions.'}</p>
          <a class="btn btn-primary" href="#investments">Back to your investments</a></div>`,
          'investments'
        );
      }
      const terms = (o.terms || []).filter((r) => r.show && r.label);
      const e = f.err || {};
      const classes = openClasses(o);
      if (classes.length && !classes.some((c) => c.id === f.cls)) f.cls = classes[0].id;
      const feeder = NS.structures && cfg && cfg.feeders ? NS.structures.feederOf(o, inv, cfg.feeders) : null;
      const odocs = (W().docs || []).filter((d) => d.offeringDoc && !d.hidden && d.offeringId === o.id);
      // DIY edition: verified identity, and verified accreditation for Rule 506(c) offerings (integrations.js).
      const gate = NS.integrations ? NS.integrations.subscribeGate(W(), inv, o) : null;
      const cur = curOf(o);
      return shell(
        `<a class="back" href="#investments">${icon('back')}Investments</a>
        ${title(`Subscribe to ${h(o.name)}`, `${h(o.type)}${o.summary ? ' · ' + h(o.summary) : ''}`)}
        <div class="cols">
          <section class="sec">${sec('Offering terms')}<dl class="terms">
            <div><dt>Minimum commitment</dt><dd>${money(o.minimum, o)}</dd></div>
            ${cur !== 'USD' ? `<div><dt>Currency</dt><dd>${h(cur)} (${h(NS.structures.CURRENCIES[cur].name)})</dd></div>` : ''}
            ${feeder ? `<div><dt>You invest through</dt><dd>${h(feeder.name)}${feeder.for ? ` (${h(feeder.for)})` : ''}</dd></div>` : ''}
            <div><dt>First close</dt><dd>${date(o.closeDate)} (targeted)</dd></div>
            ${cfg && classes.length > 1 ? `<div><dt>Fees by share class</dt><dd>${classes.map((c) => `${h(c.name)}: ${pctTxt(c.mgmtFee, cfg.mgmtFee)} management fee, ${pctTxt(c.carry, cfg.carry)} ${cfg.open ? 'incentive' : 'carry'}`).join('<br>')}<br><span class="meta">Management fee on ${h(NS.audit.FEE_BASIS[cfg.feeBasis].split(' (')[0].toLowerCase())}${cfg.open ? ', incentive over a high-water mark' : ''}</span></dd></div>` : cfg ? `<div><dt>Management fee</dt><dd>${+(cfg.mgmtFee * 100).toFixed(2)}% a year on ${h(NS.audit.FEE_BASIS[cfg.feeBasis].split(' (')[0].toLowerCase())}</dd></div><div><dt>${cfg.open ? 'Incentive allocation' : 'Carried interest'}</dt><dd>${cfg.carry ? `${+(cfg.carry * 100).toFixed(2)}%${!cfg.open && cfg.pref ? ` over a ${+(cfg.pref * 100).toFixed(2)}% preferred return` : cfg.open ? ' over a high-water mark' : ''}` : 'None'}</dd></div>` : ''}
            ${terms.filter((r) => !cfg || !/^(minimum (commitment|investment)|management fee|incentive (allocation|fee)|carried interest)$/i.test(r.label.trim())).map((r) => `<div><dt>${h(r.label)}</dt><dd>${h(r.value)}</dd></div>`).join('')}
          </dl></section>
          <section class="sec">${sec('Subscription documents')}${
            odocs.length
              ? `<ul class="doc-list">${odocs.map((d) => `<li><button class="link-btn" type="button" data-action="sub-doc" data-id="${h(d.id)}">${h(d.title)}</button> <span class="meta">${(d.size / 1024).toFixed(0)} KB</span></li>`).join('')}<li>Subscription agreement and investor questionnaire</li></ul>`
              : '<ul class="doc-list"><li>Private placement memorandum</li><li>Limited partnership agreement</li><li>Subscription agreement and investor questionnaire</li></ul>'
          }<p class="meta">Your investor information, tax certification and accreditation from your account are carried into the subscription agreement.</p></section>
        </div>
        ${gate ? `<div class="iv-banner" role="status">${icon('alert')}<span>${h(gate.reason)}</span>${gate.action ? `<button class="btn btn-primary" type="button" data-action="iv-start" data-kind="${gate.action}">Verify my accreditation</button>` : ''}</div>` : ''}
        <form class="ob-form sub-form" data-form="sub-submit" novalidate>
          <div class="form-grid">
            <label class="field" for="sb-amount"><span>${cfg && cfg.open ? 'Subscription' : 'Commitment'} (${cur === 'USD' ? '$' : h(cur)})</span><input id="sb-amount" type="number" min="${o.minimum}" step="5000" data-bind="sb:amount" value="${h(f.amount)}"${e.amount ? ' aria-invalid="true"' : ''}><span class="hint">Minimum ${money(o.minimum, o)}.${cfg && cfg.open ? '' : ' Capital is called over time.'}</span>${e.amount ? `<span class="field-error">${h(e.amount)}</span>` : ''}</label>
            ${classes.length > 1 ? `<label class="field" for="sb-cls"><span>Share class</span><select id="sb-cls" data-bind="sb:cls">${classes.map((c) => `<option value="${h(c.id)}"${c.id === f.cls ? ' selected' : ''}>${h(c.name)}: ${pctTxt(c.mgmtFee, cfg.mgmtFee)} / ${pctTxt(c.carry, cfg.carry)}${c.currency ? ` (${h(c.currency)})` : ''}${c.minimum ? `, minimum ${c.currency && NS.structures.CURRENCIES[c.currency] ? NS.structures.fmtWhole(Number(c.minimum), c.currency) : money(c.minimum, o)}` : ''}</option>`).join('')}</select><span class="hint">Management fee / ${cfg.open ? 'incentive allocation' : 'carried interest'}</span></label>` : ''}
            <label class="field" for="sb-acct"><span>Investing as</span><input id="sb-acct" type="text" value="${h(inv.title)} (${h((NS.ENTITY_TYPES[inv.type] || {}).label || inv.type)})" readonly></label>
            <label class="check field-wide" for="sb-acc"><input id="sb-acc" type="checkbox" data-bind="sb:accredited"${f.accredited ? ' checked' : ''}><span>${h(inv.title)} is an accredited investor (${h(inv.accreditation.basis)}) and this remains accurate.</span></label>${e.accredited ? `<span class="field-error">${h(e.accredited)}</span>` : ''}
            <label class="check field-wide" for="sb-docs"><input id="sb-docs" type="checkbox" data-bind="sb:docs"${f.docs ? ' checked' : ''}><span>I have received and read the private placement memorandum, limited partnership agreement and subscription agreement, and I make the representations in the subscription agreement.</span></label>${e.docs ? `<span class="field-error">${h(e.docs)}</span>` : ''}
            <label class="check field-wide" for="sb-esign"><input id="sb-esign" type="checkbox" data-bind="sb:esign"${f.esign ? ' checked' : ''}><span>I agree to sign these documents electronically.</span></label>${e.esign ? `<span class="field-error">${h(e.esign)}</span>` : ''}
            ${agr ? '<p class="hint field-wide">Next you sign the subscription agreement itself.</p>' : ''}<label class="field field-wide" for="sb-sig"${agr ? ' hidden' : ''}><span>Type your full name to sign</span><input id="sb-sig" type="text" data-bind="sb:signature" value="${h(f.signature)}" autocomplete="off"${e.signature ? ' aria-invalid="true"' : ''}><span class="hint">Signing as ${h(inv.contact)} for ${h(inv.title)} on ${date(todayIso(), 'long')}</span>${e.signature ? `<span class="field-error">${h(e.signature)}</span>` : ''}</label>
          </div>
          <div class="ob-actions"><a class="btn" href="#investments">Cancel</a><button class="btn btn-primary" type="submit">${agr ? 'Continue to the agreement' : 'Sign subscription documents'}</button></div>
        </form>`,
        'investments'
      );
    }
  };
  NS.binders.sb = (path, v) => {
    const u = S().ui.sub;
    if (u) u[path] = v;
  };
  NS.forms['sub-submit'] = () => {
    const u = S().ui.sub;
    const inv = viewer();
    const o = u && W().offerings.find((x) => x.id === u.offeringId);
    if (!u || !inv || !o) return;
    const e = {};
    const gate = NS.integrations ? NS.integrations.subscribeGate(W(), inv, o) : null;
    if (gate) {
      U.toast(gate.reason);
      return;
    }
    const cents = Math.round((Number(u.amount) || 0) * 100);
    const cls = (o.classes || []).find((c) => c.id === u.cls);
    const min = Math.max(Number(o.minimum) || 0, (cls && Number(cls.minimum)) || 0);
    if (cents < Math.round(min * 100)) e.amount = `The minimum ${cls && cls.minimum ? `for ${cls.name} ` : ''}is ${money(min, o)}.`;
    if (!u.accredited) e.accredited = 'Confirm your accreditation to continue.';
    if (!u.docs) e.docs = 'Confirm you have read the offering documents.';
    if (!u.esign) e.esign = 'Agree to electronic signature to continue.';
    const onAgreement = !!(NS.EDITION && NS.EDITION.diy && NS.esign && NS.esign.templateReady && NS.esign.templateReady(W(), o.id));
    if (!onAgreement && !sameName(u.signature, inv.contact)) e.signature = `Type your name exactly as ${inv.contact}.`;
    u.err = Object.keys(e).length ? e : null;
    if (!u.err) u.done = OPS().submitSubscription(W(), inv, o, { cents, signature: onAgreement ? inv.contact : u.signature.trim(), cls: cls ? cls.id : '' });
    NS.app.render();
    window.scrollTo(0, 0);
  };

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

  /* ---------- Home ---------- */
  /** About the firm: its own words and up to three headline figures (Portal and brand), then who to contact. */
  function overviewHTML() {
    const t = T();
    const hm = t.home || {};
    const about = String(hm.about || '').trim();
    const metrics = [[hm.m1v, hm.m1l], [hm.m2v, hm.m2l], [hm.m3v, hm.m3l]].filter((m) => String(m[0] || '').trim());
    const s = t.support || {};
    const has = about || metrics.length;
    return `<section class="sec" aria-label="${has ? 'Company overview' : 'Investor relations'}">
      ${sec(has ? 'Company overview' : 'Investor relations')}
      ${about ? `<p class="ov-text">${h(about)}</p>` : ''}
      ${metrics.length ? `<dl class="ov-metrics">${metrics.map((m) => `<div><dt>${h(m[1] || '')}</dt><dd>${h(m[0])}</dd></div>`).join('')}</dl>` : ''}
      <div class="ov-contact"><strong>${h(has ? s.team : t.name)}</strong>${has ? '' : `<span>${h(s.team)}</span>`}<span>${h(s.phone)}</span>${s.email ? `<a href="mailto:${h(s.email)}">${h(s.email)}</a>` : ''}<span>${h(s.hours)}</span></div>
    </section>`;
  }
  /**
   * The portfolio at a glance, in cents: what was committed and paid in, what has come back, and what the holdings are
   * worth now (the capital account where the fund keeps one, otherwise the amount invested). `byOffering` gives each
   * active investment's value and whether it is at cost.
   */
  function portfolioTotals(v) {
    const inv = v.investor;
    const ops = OPS();
    const end = NS.audit ? NS.audit.lastMonthEnd(todayIso()) : todayIso();
    const out = { commit: 0, paid: 0, dist: v.totals.received, value: 0, atCost: 0, valued: 0, end, byOffering: {} };
    v.positions.forEach((p) => {
      const paid = ops ? ops.paidInOf(inv, p.offering) : Math.round(p.invested * 100);
      out.commit += Math.max(paid, ops ? ops.commitOf(inv, p.offering) : paid);
      out.paid += paid;
      if (p.exit.state === 'exited') return;
      let cap = null;
      try {
        cap = ops && NS.audit ? ops.capital(W(), inv, p.offering, '1990-01-01', end) : null;
      } catch (e) {
        cap = null;
      }
      const valued = !!(cap && (cap.a.contribCum || cap.a.end));
      const value = valued ? cap.a.end : paid;
      out.value += value;
      out[valued ? 'valued' : 'atCost'] += 1;
      out.byOffering[p.offering.id] = { value, atCost: !valued };
    });
    return out;
  }
  /** Headline amounts are shown to the dollar; tables and statements keep the cents. */
  const amt = (c) => usd(Math.round(c / 100));
  function portfolioHTML(v, x) {
    const total = x.dist + x.value;
    const scale = Math.max(x.commit, total, 1);
    const w = (n, d) => `${Math.max(0, Math.min(100, d ? (n / d) * 100 : 0)).toFixed(1)}%`;
    const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '0%');
    const year = todayIso().slice(0, 4);
    const kpi = (key, label, value, note) => `<div><dt><span class="key${key ? ' key-' + key : ''}"></span>${label}</dt><dd>${value}</dd><span class="kpi-note">${note}</span></div>`;
    return `<section class="sec" aria-label="Portfolio">
      ${sec('Portfolio', '<a class="sec-link" href="#investments">View investments</a>')}
      <div class="pf-bars" role="img" aria-label="${usdc(x.paid)} contributed of ${usdc(x.commit)} committed. ${usdc(x.dist)} distributed, and holdings valued at ${usdc(x.value)}.">
        <span class="pf-track" style="width:${w(x.commit, scale)}"><span class="pf-fill" style="width:${w(x.paid, x.commit)}"></span></span>
        <span class="pf-track pf-track-2" style="width:${w(total, scale)}"><span class="pf-fill" style="width:${w(x.dist, total)}"></span></span>
      </div>
      <dl class="kpis">
        ${kpi('', 'Contributed', amt(x.paid), `${pct(x.paid, x.commit)} of commitment`)}
        ${kpi('2', 'Commitment', amt(x.commit), `${v.active.length} active investment${v.active.length === 1 ? '' : 's'}`)}
        ${kpi('3', 'Distributed', amt(x.dist), `${usdc(v.totals.ytd)} in ${year}`)}
        ${kpi('4', 'Current value', amt(x.value), x.valued ? `Unaudited, ${date(x.end)}` : 'At the amount invested')}
      </dl>
      <p class="pf-foot">${x.paid ? `Total value <strong>${amt(total)}</strong>, <strong>${(total / x.paid).toFixed(2)}x</strong> the amount contributed. ` : ''}${x.valued && x.atCost ? 'Investments without a current valuation are shown at the amount invested.' : ''}</p>
    </section>`;
  }
  function investmentsHTML(v, x) {
    const valueCell = (p) => {
      const r = x.byOffering[p.offering.id];
      return r ? `${moneyc(r.value, p.offering)}${r.atCost ? '<span class="sub">At cost</span>' : ''}` : '—';
    };
    return `<section class="sec" aria-label="Your investments">
      ${sec('Investments', '<a class="sec-link" href="#investments">All investments</a>')}
      ${
        v.active.length
          ? `<div class="tbl-scroll"><table class="tbl tbl-stack">
            <thead><tr><th scope="col">Investment</th><th scope="col" class="num">Invested</th><th scope="col" class="num">Distributions</th><th scope="col" class="num">Value</th><th scope="col">Time to exit</th></tr></thead>
            <tbody>${v.active
              .map(
                (p) => `<tr>
                <th scope="row"><a href="#investment-${h(p.offering.id)}">${h(p.offering.name)}</a><span class="sub">${h(p.offering.type)}</span></th>
                <td class="num" data-label="Invested">${money(p.invested, p.offering)}</td>
                <td class="num" data-label="Distributions">${moneyc(p.received, p.offering)}</td>
                <td class="num" data-label="Value">${valueCell(p)}</td>
                <td class="col-hold" data-label="Time to exit">${holdBar(p.exit)}</td>
              </tr>`
              )
              .join('')}</tbody></table></div>`
          : '<p class="empty">No active investments.</p>'
      }
    </section>`;
  }
  function recentDocsHTML(v) {
    const docs = allDocs(v).slice(0, 4);
    const w = W();
    const name = (id) => (id ? (w.offerings.find((x) => x.id === id) || {}).name || '' : 'All investments');
    return `<section class="sec" aria-label="Recent documents">
      ${sec('Recent documents', '<a class="sec-link" href="#documents">All documents</a>')}
      ${docs.length ? `<ul class="list">${docs.map((d) => `<li><button class="link-btn list-title" type="button" data-action="open-doc" data-id="${h(d.id)}">${h(d.title)}</button><span class="list-meta">${date(d.date)} · ${h(d.cat)} · ${h(name(d.offeringId))}</span></li>`).join('')}</ul>` : '<p class="empty">No documents yet.</p>'}
    </section>`;
  }

  /* ---------- Updates ---------- */
  const TOPIC = { call: 'Capital call', documents: 'Documents', quarterly: 'Quarterly report' };
  /** News for one investor, newest first: every notice they were sent, and the latest update on each of their investments. */
  function postsFor(inv, v) {
    const w = W();
    const t = T();
    const out = (w.notices || [])
      .filter((n) => n.recipients.indexOf(inv.id) >= 0)
      .map((n) => {
        const o = n.audience === 'all' ? null : w.offerings.find((x) => x.id === n.audience);
        const about = NS.noticeInvestment(w, inv, n);
        const call = /^call/.test(n.kind || '');
        return { id: n.id, date: n.date, topic: call ? TOPIC.call : TOPIC[n.kind] || (o ? 'Investment update' : 'Firm update'), title: NS.mergeNotice(n.subject, inv, t, n, about), body: NS.mergeNotice(n.body, inv, t, n, about), about: o ? o.name : '', notice: true, call: call && o ? o.id : '', off: o ? o.id : 'all' };
      });
    (v ? v.positions : []).forEach((p) => {
      if (p.offering.update) out.push({ id: 'u-' + p.offering.id, date: '', topic: 'Investment update', title: p.offering.name, body: p.offering.update, about: '', link: p.offering.id });
    });
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function updatesHTML(inv, v) {
    const posts = postsFor(inv, v).slice(0, 4);
    return `<section class="sec" aria-label="Latest updates">
      ${sec('Latest updates', '<a class="sec-link" href="#updates">All updates</a>')}
      ${posts.length ? `<div class="list">${posts.map((x) => `<a href="#updates"><span class="list-title">${h(x.title)}</span><span class="list-meta">${[x.date ? date(x.date) : '', h(x.topic)].filter(Boolean).join(' · ')}</span></a>`).join('')}</div>` : `<p class="empty">No updates from ${h(T().shortName)} yet.</p>`}
    </section>`;
  }
  NS.views.updates = {
    mode: 'portal',
    render() {
      const inv = viewer();
      if (!inv) return noAccount();
      const t = T();
      const posts = postsFor(inv, vm());
      return shell(
        `${title('Updates', `News, notices and reports from ${h(t.name)}`)}
        ${
          posts.length
            ? `<section class="sec feed" aria-label="Updates">${posts
                .map(
                  (x) => `<article class="post">
                    ${x.date ? `<time class="post-date" datetime="${h(x.date)}">${date(x.date, 'long')}</time>` : '<span class="post-date">Latest</span>'}
                    <div class="post-body">
                      <h2>${h(x.title)}</h2>
                      <span class="post-topic">${h(x.topic)}${x.about ? ` · ${h(x.about)}` : ''}</span>
                      ${x.body ? `<p>${h(x.body)}</p>` : ''}
                      <div class="post-foot">${
                        x.notice
                          ? x.call
                            ? `<a href="#investment-${h(x.call)}">View capital call</a>`
                            : `<button class="link-btn" type="button" data-action="notice-open" data-id="${h(x.id)}" data-off="${h(x.off)}">View documents</button>`
                          : `<a href="#investment-${h(x.link)}">View investment</a>`
                      }</div>
                    </div>
                  </article>`
                )
                .join('')}</section>`
            : `<p class="empty">No updates yet. News and notices from ${h(t.shortName)} appear here.</p>`
        }`,
        'updates'
      );
    }
  };

  NS.views.overview = {
    mode: 'portal',
    render() {
      const v = vm();
      const inv = viewer();
      if (!inv) return noAccount();
      const t = T();
      const img = B.safeImage((t.home || {}).hero);
      const banner = img ? `<div class="hm-banner"><img src="${img}" alt=""></div>` : '';
      const typeLabel = (NS.ENTITY_TYPES[inv.type] || {}).label || '';
      const head = (asOf) => `<header class="hm-head"><div><h1>${h(inv.title)}</h1><p>Account ${h(inv.id)}${typeLabel ? ` · ${h(typeLabel)}` : ''}</p></div>${asOf ? `<p class="hm-asof">${asOf}</p>` : ''}</header>`;
      if (!v || !v.positions.length) {
        // A new subscriber: what they have in progress, what is open to them, and the firm.
        const setup = NS.inviteFlow ? NS.inviteFlow.openFor(W(), inv) : null;
        const open = openOfferingsHTML(inv, 'Latest offerings');
        const reqs = myRequests(inv).length ? `<section class="sec">${sec('Your requests')}${requestsHTML(inv, null, true)}</section>` : '';
        const resume = setup ? `<div class="done-box"><p class="lede">Finish setting up your account. Your progress so far is saved.</p><a class="btn btn-primary" href="#invite-${h(setup.token)}">Continue account setup</a></div>` : '';
        return shell(
          `${head('')}<div class="hm-grid"><div class="hm-main">${resume}${NS.runHooks('investmentsTop', inv)}${reqs}${open}<p class="empty">${open ? 'You have no investments yet. Offerings open for investment are listed above.' : 'No investments are recorded for this account yet. Your investments will appear here once your subscription is accepted and funded.'}</p></div><aside class="hm-side">${overviewHTML()}</aside></div>`,
          'overview',
          { banner }
        );
      }
      const x = portfolioTotals(v);
      return shell(
        `${head(`As of ${date(todayIso(), 'long')}`)}
        <div class="hm-grid">
          <div class="hm-main">
            ${callsDueHTML(inv)}${noticesHTML(inv)}${NS.runHooks('investmentsTop', inv)}
            ${portfolioHTML(v, x)}
            ${investmentsHTML(v, x)}
            ${updatesHTML(inv, v)}
          </div>
          <aside class="hm-side">
            ${openOfferingsHTML(inv, 'Latest offerings')}
            ${overviewHTML()}
            ${recentDocsHTML(v)}
          </aside>
        </div>`,
        'overview',
        { banner }
      );
    }
  };

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
        ${noticesHTML(inv)}
        ${callsDueHTML(inv)}
        ${NS.runHooks('investmentsTop', inv)}
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

        ${myRequests(inv).length ? `<section class="sec">${sec('Your requests')}${requestsHTML(inv, null, true)}</section>` : ''}

        ${openOfferingsHTML(inv)}

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
      const docs = allDocs(v).filter((d) => d.offeringId === o.id);
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
          ${fig('Your investment', money(p.invested, o), `Funded ${date(p.date)}`)}
          ${fig('Distributions received', moneyc(p.received, o), `${pays.filter((q) => q.status === 'paid').length} payments`)}
          ${fig('Distributions', h(dist.frequency || '—'), [next ? `Next ${date(next.date)}` : '', h(dist.target || '')].filter(Boolean).join(' · '))}
          ${fig(h(x.label), h(x.value), h(x.state === 'exited' ? '' : NS.holdYear(o)))}
        </dl>

        <section class="sec">${sec(x.state === 'exited' ? 'Holding period' : x.state === 'open' ? 'Term' : 'Time to exit')}${timeline}</section>

        ${capitalHTML(v.investor, o)}
        ${callsHTML(v.investor, o)}
        ${liquidityHTML(v.investor, o, p)}

        <div class="cols">
          <section class="sec">${sec('Key terms')}${(() => {
            const st = structureTerms(v.investor, o);
            return terms.length || st.length ? `<dl class="terms">${st.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('')}${terms.map((r) => `<div><dt>${h(r.label)}</dt><dd>${h(r.value)}</dd></div>`).join('')}</dl>` : '<p class="empty">No terms published.</p>';
          })()}</section>
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
  /** Documents for an investor with no investments yet (a new subscriber): what they signed, and the offering documents they were given. */
  function earlyDocuments() {
    const inv = viewer();
    if (!inv || !NS.EDITION.diy) return noAccount();
    const signing = NS.esign && NS.esign.investorDocsHTML ? NS.esign.investorDocsHTML(inv) : '';
    const offs = myRequests(inv).filter((r) => r.type === 'subscription' && r.status !== 'rejected').map((r) => r.offeringId);
    const docs = (W().docs || []).filter((d) => d.offeringDoc && !d.hidden && offs.indexOf(d.offeringId) >= 0);
    const offered = docs.length
      ? `<section class="sec">${sec('Offering documents', `<span class="hint">${docs.length} document${docs.length === 1 ? '' : 's'}</span>`)}<ul class="doc-list">${docs.map((d) => `<li><button class="link-btn" type="button" data-action="sub-doc" data-id="${h(d.id)}">${h(d.title)}</button> <span class="meta">${h((W().offerings.find((o) => o.id === d.offeringId) || {}).name || '')}</span></li>`).join('')}</ul></section>`
      : '';
    return shell(`${title('Documents', 'Agreements you signed and the documents for your subscription')}${signing}${offered}${signing || offered ? '' : '<p class="empty">No documents yet. Statements, tax documents and agreements appear here once your subscription is accepted.</p>'}`, 'documents');
  }
  NS.views.documents = {
    mode: 'portal',
    render() {
      const v = vm();
      if (!v || !v.positions.length) return earlyDocuments();
      const ui = S().ui;
      const all = allDocs(v);
      const fo = ui.docOff || 'all';
      const fc = ui.docCat || 'all';
      const cats = Array.from(new Set(all.map((d) => d.cat)));
      const list = all.filter((d) => (fo === 'all' || d.offeringId === fo) && (fc === 'all' || d.cat === fc));
      return shell(
        `${title('Documents', 'Reports, tax documents, statements and agreements for your account')}
        ${NS.runHooks('documentsTop', v.investor)}
        <section class="sec" aria-label="Documents">
        <div class="filters">
          <label for="d-off"><span>Investment</span><select id="d-off" data-change="doc-off"><option value="all">All investments</option>${v.positions.map((p) => `<option value="${h(p.offering.id)}"${fo === p.offering.id ? ' selected' : ''}>${h(p.offering.name)}</option>`).join('')}</select></label>
          <label for="d-cat"><span>Type</span><select id="d-cat" data-change="doc-cat"><option value="all">All types</option>${cats.map((c) => `<option${fc === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
          <p class="filters-sum">${list.length} of ${all.length} documents</p>
        </div>
        ${docsTable(list, true)}
        </section>`,
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
  /** Generated statements and reports plus files the manager published (operations.js). */
  function allDocs(v) {
    const up = NS.ops ? NS.ops.docsFor(W(), v.investor).map((d) => ({ id: d.id, title: d.title, date: d.date, cat: d.cat, offeringId: d.offeringId, uploaded: true, fileName: d.fileName, type: d.type, size: d.size })) : [];
    return NS.investorDocs(W(), v)
      .concat(up)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function openUploaded(doc) {
    U.dialog(
      `<div class="dlg-head"><div><h2>${h(doc.title)}</h2><p>${date(doc.date)} · ${h(doc.fileName)} · ${(doc.size / 1024).toFixed(0)} KB</p></div>
        <div class="dlg-actions"><button class="btn btn-small" type="button" data-action="up-download" data-id="${h(doc.id)}">${icon('download')}Download</button><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body"><p class="empty">Loading…</p></div>`,
      'dlg-doc'
    );
    NS.ops.files
      .get(doc.id)
      .then((blob) => {
        const body = document.querySelector('#dlg .dlg-body');
        if (!body) return;
        if (!blob) {
          body.innerHTML = '<p class="empty">This file was published from a different browser. In production, documents are stored in the document vault and open on any device.</p>';
          return;
        }
        if (S().ui.upUrl) URL.revokeObjectURL(S().ui.upUrl);
        const url = (S().ui.upUrl = URL.createObjectURL(blob));
        if (/^text\//.test(blob.type) || /\.(txt|md)$/i.test(doc.fileName)) return blob.text().then((t) => (body.innerHTML = `<pre class="doc-text">${h(t)}</pre>`));
        body.innerHTML = /pdf/i.test(blob.type) || /\.pdf$/i.test(doc.fileName) ? `<iframe class="doc-frame" src="${url}" title="${h(doc.title)}"></iframe>` : '<p class="empty">Preview is not available for this file type. Use Download.</p>';
      })
      .catch(() => {
        const body = document.querySelector('#dlg .dlg-body');
        if (body) body.innerHTML = '<p class="empty">This browser blocked document storage, so the file cannot be opened here.</p>';
      });
  }
  NS.actions['sub-doc'] = (el) => {
    const d = (W().docs || []).find((x) => x.id === el.getAttribute('data-id') && x.offeringDoc && !x.hidden);
    if (d) openUploaded(d);
  };
  NS.actions['up-download'] = (el) => {
    const doc = (W().docs || []).find((d) => d.id === el.getAttribute('data-id'));
    if (!doc) return;
    NS.ops.files.get(doc.id).then((blob) => (blob ? U.download(doc.fileName, blob, { mime: doc.type || 'application/octet-stream' }) : U.toast('This file is stored in a different browser.')));
  };
  NS.actions['open-doc'] = (el) => {
    const v = vm();
    const doc = allDocs(v).find((d) => d.id === el.getAttribute('data-id'));
    if (!doc) return;
    if (doc.uploaded) return openUploaded(doc);
    U.dialog(
      `<div class="dlg-head"><div><h2>${h(doc.title)}</h2><p>${date(doc.date)} · ${doc.pages} page${doc.pages === 1 ? '' : 's'} · PDF</p></div>
        <div class="dlg-actions"><button class="btn btn-small" type="button" data-action="doc-download">${icon('download')}Download</button><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body">${NS.paper(doc, T(), v, W())}</div>`,
      'dlg-doc'
    );
  };
  NS.actions['doc-download'] = () => U.toast('Sample document. No file is attached in this demo portal.');

  /* ---------- Account ---------- */
  /**
   * The owners of a joint account, each by first and last name: as they gave them during onboarding (onboarding.js keeps
   * them on the record), or else as on the account's KYC record. The account title alone may shorten them ("Robert and
   * Ellen Marsh, JTWROS").
   */
  function jointOwners(inv) {
    if (inv.type !== 'joint') return [];
    const given = NS.names ? NS.names.holders(inv) : [];
    const kyc = ((inv.kyc && inv.kyc.owners) || []).map((o) => String((o && o.name) || '').trim()).filter(Boolean);
    return given.length > 1 ? given : kyc.length > 1 ? kyc : [];
  }
  NS.views.account = {
    mode: 'portal',
    render() {
      const inv = viewer();
      if (!inv) return noAccount();
      const t = T();
      const bank = inv.payment && inv.payment.method === 'ach' ? inv.payment.bank : null;
      const typeLabel = (NS.ENTITY_TYPES[inv.type] || {}).label || inv.type;
      const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
      const owners = jointOwners(inv);
      const heldAs = NS.names ? NS.names.tenancyLabel(inv) : '';
      return shell(
        `${title('Account', `${h(inv.title)} · Account ${h(inv.id)}`)}
        <div class="cols">
          <section class="sec">${sec('Investor')}<dl class="terms">
            ${row('Account title', h(inv.title))}
            ${row('Investing as', h(typeLabel))}
            ${owners.length ? row('Account owners', owners.map((n) => h(n)).join('<br>')) : ''}
            ${heldAs ? row('Held as', h(heldAs)) : ''}
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
            ${row('Accreditation', (() => {
              const IVN = NS.integrations;
              if (IVN && IVN.active(W()) && (inv.verify || IVN.peek)) {
                const a = (IVN.peek ? IVN.peek(inv) : IVN.vOf(inv)).accreditation;
                if (a.status === 'verified' && IVN.selfCertified && IVN.selfCertified(a)) return `Self-certified on ${date(a.verifiedAt)} (accepted for Rule 506(b) offerings; Rule 506(c) offerings need a verification)`;
                if (a.status === 'verified') return `Verified by ${h(IVN.via(W(), a, 'accreditation') || 'a third party')} on ${date(a.verifiedAt)}${a.expiresAt ? `, ${a.expiresAt < NS.dates.today() ? 'expired' : 'valid until'} ${date(a.expiresAt)}` : ''}${a.expiresAt && a.expiresAt < NS.dates.today() ? ' <button class="link-btn" type="button" data-action="iv-start" data-kind="accreditation">Verify again</button>' : ''}`;
                return a.status === 'pending' || a.status === 'review' ? 'Verification under review' : 'Not verified <button class="link-btn" type="button" data-action="iv-start" data-kind="accreditation">Verify now</button>';
              }
              return inv.accreditation && inv.accreditation.basis ? 'Verified accredited investor' : 'Not provided';
            })())}
            ${inv.accreditation && inv.accreditation.date ? row('Verified', date(inv.accreditation.date)) : ''}
          </dl></section>
          <section class="sec">${sec('Sign-in and delivery')}<dl class="terms">
            ${row('Electronic delivery', inv.edelivery ? 'Consented. Documents are delivered to this portal.' : 'Paper delivery')}
            ${row('Two-step verification', 'On')}
            ${row('Activated', inv.onboarding.completed ? date(inv.onboarding.completed) : '—')}
          </dl></section>
        </div>
        ${appearanceHTML()}`,
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
  function appearanceHTML() {
    const current = NS.store.get('appearance', null) || T().appearance || 'light';
    return `<section class="sec settings-sec">
          ${sec('Appearance')}
          <fieldset class="choice settings-choice">
            <legend class="sr-only">Appearance</legend>
            ${THEMES.map(([v, label, sub]) => `<label class="choice-row"><input type="radio" name="appearance" value="${v}" data-change="appearance-pref"${current === v ? ' checked' : ''}><span><strong>${label}</strong><span class="hint">${sub}</span></span></label>`).join('')}
          </fieldset>
          <p class="meta">Saved in this browser.</p>
        </section>`;
  }
  NS.views.preferences = {
    mode: 'portal',
    render() {
      return shell(`${title('Settings', 'Preferences for this device')}${appearanceHTML()}`, 'account');
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
      const art = B.safeImage((t.home || {}).hero);
      return `<div class="pt pt-auth">
        <header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span></div></header>
        <main class="pt-main" id="main" tabindex="-1"><div class="auth has-art">
          <div class="auth-card">
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
          </div>
          <div class="auth-art" aria-hidden="true">${art ? `<img src="${art}" alt="">` : '<canvas class="auth-engrave" aria-hidden="true"></canvas>'}</div>
        </div></main>
        ${footer()}
      </div>`;
    },
    after() {
      // Decoration only: the engraved ground is drawn once the page is in place (engrave.js).
      const c = document.querySelector('.auth-engrave');
      if (c && NS.engrave) NS.engrave(c, T().id || T().name);
    }
  };
  NS.forms['sign-in'] = (f) => {
    const ok = f.email.value.trim() && f.password.value;
    document.getElementById('si-error').hidden = !!ok;
    if (!ok) return;
    const inv = W().investors.find((x) => x.email.toLowerCase() === f.email.value.trim().toLowerCase());
    if (inv) S().viewer = inv.id;
    if (inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else NS.app.go('overview');
  };
  NS.actions.forgot = () => U.toast('A password reset link would be emailed to the address on file.');
  NS.actions.activate = (el) => NS.startOnboarding(el.getAttribute('data-id'));
})(window.CVPortal);
