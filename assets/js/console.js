/*
 * Sponsor console, both editions (operated by Carrow & Vale in the managed
 * edition, by the sponsor's own admins in the DIY edition): client setup, per-offering
 * configuration, investor roster and invitations, distributions with NACHA
 * file generation, ACH origination settings, and portal branding.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const U = NS.ui;
  const { h, usd, usdc, date, icon } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const T = () => NS.state.ws.tenant;
  const today = () => NS.dates.today();
  /* Adding and configuring offerings, offering intake and branding the portal
     belong to the owner role: Carrow & Vale staff in the managed edition, the
     sponsor's admins in the DIY edition. Everyone else sees offerings
     read-only and never sees the brand page (app.js can / allowed). */
  const E = NS.EDITION;
  /** What a blank offering-level ACH value falls back to. */
  const DEF = E.diy ? 'Firm default' : 'Client default';
  const canConfigure = () => NS.app.can('configure');
  /** Append an entry to the client's change log (see audit.js). */
  const audit = (action, detail, fund, record) => NS.audit && NS.audit.log(W(), { action, detail, fund: fund || '', record: record || '' });
  const short = (x) => {
    const v = x === '' || x == null ? '(blank)' : String(x);
    return v.length > 60 ? v.slice(0, 57) + '…' : v;
  };
  const staffGuard = (fn) => function () {
    if (!canConfigure()) return U.toast(E.managed ? 'Only Carrow & Vale can change this. Contact your Carrow & Vale team.' : 'Only admins can change this. Ask an admin on your team.');
    return fn.apply(this, arguments);
  };

  /* ---------- Shell ---------- */
  // Pages show only when their module is loaded, the edition has them and the role may open them.
  const NAV = [
    ['console', 'Overview'],
    ['console-notifications', 'Notifications'],
    ['console-offerings', 'Offerings'],
    ['console-intake', 'Offering intake'],
    ['console-investors', 'Investors'],
    ['console-esign', 'E-sign'],
    ['console-calls', 'Capital calls'],
    ['console-distributions', 'Distributions'],
    ['console-requests', 'Requests'],
    ['console-notices', 'Notices'],
    ['console-docs', 'Documents'],
    ['console-reports', 'Reports'],
    ['console-audit', 'Audit'],
    ['console-kyc', 'AML/KYC'],
    ['console-integrations', 'Integrations'],
    ['console-ach', 'ACH origination'],
    ['console-brand', 'Portal and brand'],
    ['console-team', 'Team']
  ];
  /** Counts other modules show beside their menu entry: NS.navCounts[key] = (ws) => n. */
  NS.navCounts = NS.navCounts || {};
  /** Items waiting on the manager, shown beside the menu entry. */
  function navCount(k) {
    const w = W();
    if (!NS.ops || !w) return 0;
    if (NS.navCounts[k]) return NS.navCounts[k](w) || 0;
    if (k === 'console-requests') return (w.requests || []).filter((r) => r.status === 'pending').length;
    if (k === 'console-calls') return (w.calls || []).filter((c) => c.items.some((it) => !it.received)).length;
    if (k === 'console-kyc') return w.investors.filter((i) => ['review', 'due'].indexOf(NS.ops.kycLabel(NS.ops.kycOf(i)).key) >= 0).length;
    return 0;
  }
  function shell(inner, active) {
    const t = T();
    return `<div class="cs">
      <aside class="cs-nav" aria-label="Sponsor console">
        <div class="cs-client">${B.lockup(t)}<span class="cs-client-meta">${h(t.domain)}</span></div>
        ${NS.runHooks('consoleBar', W())}
        <nav>${NAV.filter(([k]) => NS.views[k] && NS.app.allowed(k)).map(([k, l]) => {
          const n = navCount(k);
          return `<a href="#${k}"${active === k ? ' aria-current="page"' : ''}>${l}${n ? ` <span class="cs-nav-count" aria-label="${n} need attention">${n}</span>` : ''}</a>`;
        }).join('')}</nav>
      </aside>
      <main class="cs-main" id="main" tabindex="-1">${inner}</main>
    </div>`;
  }
  const head = (title, sub, actions) => `<div class="cs-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="cs-actions">${actions}</div>` : ''}</div>`;
  const panel = (title, body, extra) => `<section class="cs-panel">${title ? `<div class="cs-panel-head"><h2>${title}</h2>${extra || ''}</div>` : ''}${body}</section>`;
  /** Page parts for console pages defined in other files (diy.js, esign.js, integrations.js). */
  NS.consoleKit = { shell, head, panel, audit, short };
  const ok = (good, label) => `<span class="cs-flag ${good ? 'is-ok' : 'is-todo'}">${icon(good ? 'check' : 'alert')}${label}</span>`;

  function raised(oid) {
    return NS.data.holdersAt(W().investors, oid, '9999-12-31').reduce((a, x) => a + x.amount, 0);
  }
  function holdersCount(oid) {
    return new Set(NS.data.holdersAt(W().investors, oid, '9999-12-31').map((x) => x.investor.id)).size;
  }
  function achReady() {
    const a = T().ach;
    return NS.nacha.abaValid(a.odfiRouting) && NS.nacha.abaValid(a.destinationRouting || a.odfiRouting) && /^.{10}$/.test(a.companyId || '') && !!a.companyName && !!a.immediateOrigin;
  }
  function payLabel(inv) {
    const b = inv.payment && inv.payment.method === 'ach' && inv.payment.bank;
    return b ? `ACH · ${b.type === 'savings' ? 'Savings' : 'Checking'} ••${h(U.last4(b.account))}` : 'Check';
  }
  function activation(inv) {
    // DIY: an invited investor's progress through their invitation link (invitations.js).
    const step = E.diy && NS.invitations ? NS.invitations.activationLabel(W(), inv) : '';
    if (step) return step;
    const o = inv.onboarding;
    if (o.status === 'complete') return `Active${o.completed ? ' since ' + date(o.completed) : ''}`;
    if (o.status === 'in_progress') return `In progress · ${o.step || 0} of 6 steps`;
    return `Invited ${date(o.invited)}`;
  }

  /** Net asset value and capital by fund at the last month-end (from the capital accounts in audit.js). */
  function fundsPanel(w) {
    if (!NS.audit || !w.offerings.length) return '';
    const end = NS.audit.lastMonthEnd(today());
    const tot = { nav: 0, inv: 0, paid: 0, dist: 0, unf: 0 };
    const rows = w.offerings
      .map((o) => {
        const L = NS.audit.ledger(w, o);
        const m = L.byKey[end.slice(0, 7)] || (L.exitKey ? null : L.months[L.months.length - 1]);
        const nav = m ? m.endCap + m.gpEnd : 0;
        const holders = w.investors.filter((i) => i.positions.some((p) => p.offeringId === o.id)).length;
        const paid = L.contribs.reduce((a, c) => a + c.cents, 0);
        const dist = L.dists.reduce((a, d) => a + d.cents, 0) + (L.redemptions || []).reduce((a, x) => a + x.cents, 0);
        const unf = NS.ops ? NS.ops.unfunded(w, o) : 0;
        tot.nav += nav;
        tot.inv += holders;
        tot.paid += paid;
        tot.dist += dist;
        tot.unf += unf;
        return `<tr><th scope="row"><a href="#console-offering-${h(o.id)}">${h(o.name)}</a><span class="sub">${h(NS.audit.settings(o).label)}${o.status === 'Raising' ? ' · raising' : o.exit && o.exit.basis === 'exited' ? ' · exited' : ''}</span></th><td class="num">${usdc(nav)}</td><td class="num">${holders}</td><td class="num">${usdc(paid)}</td><td class="num">${usdc(dist)}</td><td class="num">${unf ? usdc(unf) : '—'}</td></tr>`;
      })
      .join('');
    return panel(
      `Funds <span class="cs-count">Net asset value as of ${date(end)}</span>`,
      `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Fund</th><th scope="col" class="num">Net assets</th><th scope="col" class="num">Investors</th><th scope="col" class="num">Contributed</th><th scope="col" class="num">Distributed and redeemed</th><th scope="col" class="num">Unfunded</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th scope="row">Total</th><td class="num">${usdc(tot.nav)}</td><td class="num"></td><td class="num">${usdc(tot.paid)}</td><td class="num">${usdc(tot.dist)}</td><td class="num">${tot.unf ? usdc(tot.unf) : '—'}</td></tr></tfoot></table></div>`,
      '<a class="cs-link" href="#console-audit">Audit schedules</a>'
    );
  }

  /* ---------- Overview and client setup ---------- */
  NS.views.console = {
    mode: 'console',
    render() {
      const w = W();
      const t = T();
      const branded = t.domain && t.domain !== NS.TENANT_TEMPLATE.domain && t.support.email !== NS.TENANT_TEMPLATE.support.email;
      const allSteps = (E.diy
        ? [
            ['Brand the investor portal', 'Logo, colors, domain, support contact and disclosures.', branded, 'console-brand', true],
            ['Plug in your verification providers', 'Connect the identity, sanctions screening and accredited investor services you use, one or several for each check. They run automatically when investors onboard.', !!(NS.integrations && NS.integrations.ready(w)), 'console-integrations', true],
            ['Set up ACH origination', 'The bank and company IDs used to pay distributions by ACH.', achReady(), 'console-ach'],
            ['Add your first offering', 'Upload the PPM or operating agreement and the portal sets the offering up for you to review.', w.offerings.length > 0, 'console-intake', true],
            ['Prepare your subscription agreement', 'On the offering: upload it and check the signature fields once; every investor you invite signs it online during onboarding.', (w.esignTemplates || []).some((t) => t.subscription), (() => { const o = w.offerings.find((x) => x.status === 'Raising') || w.offerings[0]; return o ? `console-offering-${o.id}` : 'console-offerings'; })()],
            ['Invite your team', 'Admins manage everything; team members run day-to-day operations.', (w.team || []).length > 1, 'console-team', true],
            ['Invite your investors', 'Enter a name and email: each investor gets one link that walks them through their account, verification, tax form, bank details and subscription documents. You are notified when they finish.', w.investors.length > 0 || (w.invitations || []).length > 0, 'console-investors', false, 'inv8-open-invite'],
            ['Run the first distribution', 'Allocate a payment pro rata and generate the NACHA file for the bank.', w.runs.length > 0, 'console-distributions']
          ]
        : [
            ['Brand the investor portal', 'Logo, colors, domain, support contact and disclosures.', branded, 'console-brand', true],
            ['Set up ACH origination', 'The bank and company IDs used to pay distributions by ACH.', achReady(), 'console-ach'],
            ['Add offerings', 'Each investment with its own exit timing, distribution schedule and terms.', w.offerings.length > 0, 'console-offerings', true],
            ['Invite investors', 'Add investors one at a time or import a list. Each receives an activation email.', w.investors.length > 0, 'console-investors'],
            ['Run the first distribution', 'Allocate a payment pro rata and generate the NACHA file for the bank.', w.runs.length > 0, 'console-distributions']
          ]
      ).filter((s) => (canConfigure() || !s[4]) && NS.views[s[3]]);
      // Steps the firm removed from its list (kept by name; Restore brings them back).
      const removed = (t.setupRemoved || []).filter((k) => allSteps.some((s) => s[0] === k));
      const steps = allSteps.filter((s) => removed.indexOf(s[0]) < 0);
      const done = steps.filter((s) => s[2]).length;
      const yearAgo = NS.dates.addMonths(today(), -12);
      const paid12 = w.runs.filter((r) => r.status === 'paid' && r.date > yearAgo).reduce((a, r) => a + r.total, 0);
      const pending = w.investors.filter((i) => i.onboarding.status !== 'complete');
      const checks = w.investors.filter((i) => !(i.payment && i.payment.method === 'ach'));
      const soon = w.offerings
        .map((o) => ({ o, x: NS.exitInfo(o) }))
        .filter(({ o }) => {
          const e = o.exit || {};
          const d = e.basis === 'range' ? e.from : e.basis === 'date' || e.basis === 'maturity' ? e.date : '';
          return d && d >= today() && NS.dates.monthsBetween(today(), d) < 12;
        });
      const attention = [];
      if (pending.length) attention.push(`<li><a href="#console-investors" data-action="inv-filter" data-f="onboarding">${pending.length} investor${pending.length === 1 ? ' has' : 's have'} not finished activating</a></li>`);
      if (checks.length) attention.push(`<li><a href="#console-investors" data-action="inv-filter" data-f="nobank">${checks.length} investor${checks.length === 1 ? ' is' : 's are'} paid by check (no bank account on file)</a></li>`);
      soon.forEach(({ o, x }) => attention.push(`<li><a href="#console-offering-${h(o.id)}">${h(o.name)}: ${h(x.label.toLowerCase())} ${h(x.value)} (${h(x.remaining.toLowerCase())})</a></li>`));
      if (!achReady()) attention.push('<li><a href="#console-ach">ACH origination is not complete, so NACHA files cannot be generated</a></li>');
      attention.push(NS.runHooks('consoleAttention', w));
      if (NS.ops) {
        (w.calls || [])
          .filter((c) => c.items.some((it) => !it.received))
          .forEach((c) => {
            const o = w.offerings.find((x) => x.id === c.offeringId);
            const st = NS.ops.callStatus(c);
            attention.push(`<li><a href="#console-calls" data-action="call-open" data-id="${h(c.id)}">${h(o ? o.name : c.offeringId)} call ${c.number}: ${usdc(st.out)} outstanding from ${st.count} investor${st.count === 1 ? '' : 's'}, due ${date(c.due)}${st.overdue ? ' (overdue)' : ''}</a></li>`);
          });
        const reqs = (w.requests || []).filter((r) => r.status === 'pending').length;
        if (reqs) attention.push(`<li><a href="#console-requests">${reqs} investor request${reqs === 1 ? '' : 's'} waiting for approval</a></li>`);
        const kyc = w.investors.map((i) => NS.ops.kycLabel(NS.ops.kycOf(i)).key);
        const rev = kyc.filter((k) => k === 'review').length;
        const due = kyc.filter((k) => k === 'due').length;
        if (rev || due) attention.push(`<li><a href="#console-kyc">${[rev ? `${rev} screening match${rev === 1 ? '' : 'es'} to review` : '', due ? `${due} AML/KYC re-screen${due === 1 ? '' : 's'} due` : ''].filter(Boolean).join('; ')}</a></li>`);
      }
      return shell(
        `${head(h(t.name), `${w.offerings.length} offerings · ${w.investors.length} investors`)}
        ${
          done < steps.length
            ? panel(
                `${E.diy ? 'Setup' : 'Client setup'} <span class="cs-count">${done} of ${steps.length} complete</span>`,
                `<ol class="cs-steps">${steps
                  .map((s, i) => `<li class="${s[2] ? 'is-done' : ''}"><span class="cs-step-n">${s[2] ? icon('check') : i + 1}</span><div><strong>${s[0]}</strong><span>${s[1]}</span></div><div class="cs-step-act"><a class="cs-btn cs-btn-small${s[2] ? '' : ' cs-btn-primary'}" href="#${s[3]}"${s[5] ? ` data-action="${s[5]}"` : ''}>${s[2] ? 'Review' : 'Start'}</a>${canConfigure() ? `<button class="cs-step-rm" type="button" data-action="setup-remove" data-k="${h(s[0])}" aria-label="Remove the step: ${h(s[0])}">Remove</button>` : ''}</div></li>`)
                  .join('')}</ol>${removed.length && canConfigure() ? `<p class="cs-hint cs-steps-removed">${removed.length} step${removed.length === 1 ? '' : 's'} removed. <button class="link-btn" type="button" data-action="setup-restore">Restore</button></p>` : ''}`
              )
            : ''
        }
        <dl class="cs-figs">
          <div><dt>Active offerings</dt><dd>${w.offerings.filter((o) => o.status !== 'Exited').length}</dd></div>
          <div><dt>Investors</dt><dd>${w.investors.length}</dd></div>
          <div><dt>Capital raised</dt><dd>${usd(w.offerings.reduce((a, o) => a + raised(o.id), 0))}</dd></div>
          <div><dt>Distributed, last 12 months</dt><dd>${usdc(paid12)}</dd></div>
        </dl>
        ${fundsPanel(w)}
        ${panel('Needs attention', attention.length ? `<ul class="cs-list">${attention.join('')}</ul>` : '<p class="cs-muted">Nothing needs attention.</p>')}
        ${panel(
          'Recent distributions',
          w.runs.length ? runsTable(w.runs.slice(0, 6), false) : '<p class="cs-muted">No distributions yet. <a href="#console-distributions">Create the first one</a>.</p>',
          '<a class="cs-link" href="#console-distributions">All distributions</a>'
        )}
        ${done === steps.length ? `<p class="cs-muted cs-setup-done">${icon('check')} ${E.diy ? 'Setup' : 'Client setup'} complete.</p>` : ''}`,
        'console'
      );
    }
  };

  NS.views['console-new-client'] = {
    edition: 'managed',
    mode: 'console',
    render() {
      return shell(
        `${head('Add a client', 'Start a new sponsor or investment firm. You can change everything later.')}
        ${panel(
          '',
          `<form class="cs-form" data-form="new-client" novalidate>
            <label class="cs-field" for="nc-name"><span>Firm name</span><input id="nc-name" name="name" required maxlength="60" placeholder="Harrow Point Partners"></label>
            <label class="cs-field" for="nc-domain"><span>Portal domain</span><input id="nc-domain" name="domain" maxlength="80" placeholder="investors.harrowpoint.com" spellcheck="false"><span class="cs-hint">Investors reach the portal here. Requires a DNS record.</span></label>
            <label class="cs-field" for="nc-email"><span>Investor relations email</span><input id="nc-email" name="email" type="email" maxlength="80" placeholder="investors@harrowpoint.com"></label>
            <p class="cs-error" id="nc-error" hidden>Enter the firm name.</p>
            <div class="cs-row"><button class="cs-btn cs-btn-primary" type="submit">Create client</button><a class="cs-btn" href="#console">Cancel</a></div>
          </form>`
        )}`,
        'console'
      );
    }
  };
  NS.forms['new-client'] = (f) => {
    const name = f.name.value.trim();
    if (!name) {
      document.getElementById('nc-error').hidden = false;
      f.name.focus();
      return;
    }
    const ws = NS.workspace.create(name);
    if (f.domain.value.trim()) ws.tenant.domain = f.domain.value.trim();
    if (f.email.value.trim()) ws.tenant.support.email = f.email.value.trim();
    ws.tenant.support.team = `${ws.tenant.shortName} Investor Relations`;
    NS.workspace.save(ws, true);
    NS.app.setClient(ws.tenant.id, 'console');
    U.toast(`${name} created`);
  };

  /* ---------- Offerings ---------- */
  NS.actions['setup-remove'] = (el) => {
    if (!canConfigure()) return;
    const k = el.getAttribute('data-k');
    const t = T();
    t.setupRemoved = (t.setupRemoved || []).filter((x) => x !== k).concat([k]);
    audit('Setup step removed', k, '', t.id);
    NS.app.save();
    NS.app.render();
  };
  NS.actions['setup-restore'] = () => {
    if (!canConfigure()) return;
    const t = T();
    t.setupRemoved = [];
    audit('Setup steps restored', 'All setup steps are listed again', '', t.id);
    NS.app.save();
    NS.app.render();
  };
  NS.views['console-offerings'] = {
    mode: 'console',
    render() {
      const w = W();
      const rows = w.offerings
        .map((o) => {
          const x = NS.exitInfo(o);
          return `<tr>
            <th scope="row"><a href="#console-offering-${h(o.id)}">${h(o.name)}</a><span class="sub">${h(o.summary || '')}</span></th>
            <td>${h(o.type)}</td>
            <td class="nowrap">${date(o.closeDate)}</td>
            <td class="num">${usd(raised(o.id))}</td>
            <td class="num">${holdersCount(o.id)}</td>
            <td>${h((o.distribution || {}).frequency || '')}${nextOf(o) ? `<span class="sub">Next ${date(nextOf(o).date)}</span>` : ''}</td>
            <td>${h(x.value)}<span class="sub">${h(x.label)}</span></td>
            <td>${h(o.status)}</td>
          </tr>`;
        })
        .join('');
      return shell(
        `${canConfigure()
          ? head('Offerings', 'Each investment is configured separately: how exit is defined, how often it pays, and which terms investors see.', '<a class="cs-btn" href="#console-intake">Set up from documents</a><button class="cs-btn cs-btn-primary" type="button" data-action="off-add">Add offering</button>')
          : head('Offerings', E.managed ? 'Your offerings as Carrow &amp; Vale has set them up. To add an offering or change how one is shown to investors, contact your Carrow &amp; Vale team.' : 'Your offerings as your admins have set them up. Only admins can add an offering or change how one is shown to investors.')}
        ${panel(
          '',
          w.offerings.length
            ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Offering</th><th scope="col">Type</th><th scope="col">Closed</th><th scope="col" class="num">Raised</th><th scope="col" class="num">Investors</th><th scope="col">Distributions</th><th scope="col">Exit</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
            : `<p class="cs-muted">${canConfigure() ? 'No offerings yet. Add the first one to start inviting investors.' : (E.managed ? 'No offerings yet. Carrow &amp; Vale adds each offering for you.' : 'No offerings yet. An admin on your team adds each offering.')}</p>`
        )}`,
        'console-offerings'
      );
    }
  };
  NS.actions['off-add'] = staffGuard(() => {
    const type = 'Real estate syndication';
    const d = NS.OFFERING_TYPES[type];
    const id = 'off-' + Date.now().toString(36);
    W().offerings.push({
      id,
      name: 'New offering',
      shortName: 'New offering',
      type,
      status: 'Raising',
      summary: '',
      closeDate: today(),
      minimum: 50000,
      exit: { basis: d.exit, date: NS.dates.addMonths(today(), 60), from: NS.dates.addMonths(today(), 60), to: NS.dates.addMonths(today(), 84), note: '' },
      distribution: { frequency: d.frequency, type: d.distType, target: '' },
      terms: d.terms.map((l) => ({ label: l, value: '', show: true })),
      update: '',
      achOverride: { companyName: '', companyId: '' }
    });
    audit('Offering created', `${id} (${type})`, id, id);
    NS.app.save(true);
    NS.app.go('console-offering-' + id);
  });

  const BASIS = [
    ['date', 'Projected exit date'],
    ['range', 'Projected exit window'],
    ['maturity', 'Maturity date'],
    ['open', 'No set term'],
    ['exited', 'Exited']
  ];
  const curOff = () => W().offerings.find((o) => o.id === S().param);
  const nextOf = (o) => NS.nextDistribution(W(), o);

  function offField(label, path, opts) {
    opts = opts || {};
    const o = curOff();
    const v = NS.app.getPath(o, path);
    const id = 'of-' + path.replace(/\./g, '-');
    if (opts.select) {
      return `<label class="cs-field${opts.wide ? ' cs-wide' : ''}" for="${id}"><span>${label}</span><select id="${id}" data-bind="off:${path}">${opts.select
        .map((x) => (Array.isArray(x) ? x : [x, x]))
        .map(([val, l]) => `<option value="${h(val)}"${String(v) === String(val) ? ' selected' : ''}>${h(l)}</option>`)
        .join('')}</select>${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}</label>`;
    }
    if (opts.textarea) return `<label class="cs-field cs-wide" for="${id}"><span>${label}</span><textarea id="${id}" rows="${opts.rows || 3}" data-bind="off:${path}" maxlength="${opts.max || 600}">${h(v)}</textarea>${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}</label>`;
    return `<label class="cs-field${opts.wide ? ' cs-wide' : ''}" for="${id}"><span>${label}</span><input id="${id}" type="${opts.type || 'text'}" data-bind="off:${path}" value="${h(v == null ? '' : v)}"${opts.placeholder ? ` placeholder="${h(opts.placeholder)}"` : ''}${opts.step ? ` step="${opts.step}"` : ''}${opts.max ? ` maxlength="${opts.max}"` : ''}${opts.upper ? ' data-upper' : ''}${opts.spell === false ? ' spellcheck="false"' : ''}>${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}</label>`;
  }
  /** Exemptions offered on the offering page; a value read from documents that is not in the list stays selectable. */
  const EXEMPTIONS = [
    ['Rule 506(b)', 'Rule 506(b)'],
    ['Rule 506(c)', 'Rule 506(c): verified accredited investors only'],
    ['Regulation A', 'Regulation A'],
    ['Regulation Crowdfunding', 'Regulation Crowdfunding'],
    ['Regulation S', 'Regulation S'],
    ['Section 4(a)(2)', 'Section 4(a)(2)']
  ];
  function exemptionOptions(o) {
    const cur = ((o.structure || {}).exemption || '').trim();
    const known = EXEMPTIONS.some(([v]) => v === cur);
    return [['', 'Not set']].concat(cur && !known ? [[cur, cur]] : [], EXEMPTIONS);
  }
  function offPreview(o) {
    const x = NS.exitInfo(o);
    const terms = (o.terms || []).filter((r) => r.show && r.label);
    return `<div class="pv">
      <p class="pv-label">What investors see</p>
      <div class="pv-portal">
        <h3>${h(o.name)}</h3>
        <p class="pv-sub">${h(o.type)}${o.summary ? ' · ' + h(o.summary) : ''}</p>
        <dl class="pv-figs"><div><dt>Distributions</dt><dd>${h(o.distribution.frequency)}</dd>${nextOf(o) ? `<span>Next ${date(nextOf(o).date)}</span>` : ''}<span>${h(o.distribution.target || '')}</span></div><div><dt>${h(x.label)}</dt><dd>${h(x.value)}</dd></div></dl>
        <div class="pv-hold">${NS.holdBar(x)}</div>
        ${terms.length ? `<dl class="pv-terms">${terms.map((r) => `<div><dt>${h(r.label)}</dt><dd>${h(r.value) || '<em>—</em>'}</dd></div>`).join('')}</dl>` : ''}
      </div>
    </div>`;
  }
  /** The read-only view of an offering for people who cannot configure it. */
  function offReadOnly(o) {
    const n = holdersCount(o.id);
    const x = NS.exitInfo(o);
    const d = o.distribution || {};
    const kv = (rows) => `<dl class="cs-kv">${rows.filter((r) => r[1] !== '' && r[1] != null).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
    const terms = (o.terms || []).filter((r) => r.label);
    const ach = o.achOverride || {};
    return shell(
      `<a class="cs-back" href="#console-offerings">${icon('back')}Offerings</a>
      ${head(h(o.name), `${h(o.type)} · ${n} investor${n === 1 ? '' : 's'} · ${usd(raised(o.id))} raised`, `${E.diy && o.status === 'Raising' ? `<button class="cs-btn" type="button" data-action="join-link" data-id="${h(o.id)}">Investor sign-up link</button>` : ''}${n ? `<button class="cs-btn" type="button" data-action="off-preview">Preview as investor</button>` : ''}`)}
      <p class="cs-muted cs-locked-note">${icon('lock')}${E.managed ? 'Set up and maintained by Carrow &amp; Vale. To change anything on this offering, contact your Carrow &amp; Vale team.' : 'Set up and maintained by your admins. To change anything on this offering, ask an admin on your team.'}</p>
      <div class="cs-split">
        <div class="cs-split-main">
          ${panel('Basics', kv([['Short name', h(o.shortName)], ['Status', h(o.status)], ['Closing date', date(o.closeDate)], ['Minimum investment', usd(o.minimum || 0)], ['Description', h(o.summary || '')]]))}
          ${NS.esign && NS.esign.agreementPanel ? NS.esign.agreementPanel(W(), o, false) : ''}
          ${panel('Exit timing', kv([[h(x.label), h(x.value)], ['How exit is defined', h((BASIS.find((b) => b[0] === (o.exit || {}).basis) || ['', ''])[1])], ['Note shown to investors', h((o.exit || {}).note || '')]]))}
          ${panel('Distributions', kv([['Frequency', h(d.frequency || '')], ['Payment day', periodMonths(d.frequency) && d.day ? NS.data.ordinal(Number(d.day)) + ' of the month' : ''], ['Next payment', nextOf(o) ? date(nextOf(o).date, 'wd') : ''], ['Payment type', h(d.type || '')], ['Target or rate', h(d.target || '')]]))}
          ${panel('Key terms shown to investors', terms.length ? kv(terms.map((r) => [h(r.label) + (r.show ? '' : ' <span class="cs-muted">(hidden)</span>'), h(r.value) || '—'])) : '<p class="cs-muted">No terms.</p>')}
          ${o.update ? panel('Latest update', `<p>${h(o.update)}</p>`) : ''}
          ${(() => {
            const cfg = NS.audit.settings(o);
            const pc = (x) => `${+(x * 100).toFixed(2)}%`;
            return panel('Fund accounting', kv([['Accounting', `${h(cfg.label)}, ${cfg.open ? 'open-ended (monthly NAV)' : 'closed-end (quarterly valuations)'}`], ['Management fee', `${pc(cfg.mgmtFee)} a year on ${h(NS.audit.FEE_BASIS[cfg.feeBasis].split(' (')[0].toLowerCase())}`], [cfg.open ? 'Incentive allocation' : 'Carried interest', cfg.carry ? `${pc(cfg.carry)}${cfg.open ? ' over a high-water mark' : cfg.pref ? ` over a ${pc(cfg.pref)} preferred return` : ''}` : 'None'], ['Auditor', h(cfg.auditor || T().auditor || 'Not set')]]));
          })()}
          ${structurePanel(o)}
          ${panel('ACH originator for this offering', kv([['Company name', h(ach.companyName || T().ach.companyName || DEF)], ['Company ID', h(ach.companyId || DEF)]]))}
        </div>
        <aside class="cs-split-side" id="off-preview">${offPreview(o)}</aside>
      </div>`,
      'console-offerings'
    );
  }
  function accountingDefaults(o) {
    const cfg = NS.audit.settings(Object.assign({}, o, { accounting: {} }));
    const pc = (x) => `${+(x * 100).toFixed(2)}%`;
    const text = `${pc(cfg.mgmtFee)} a year on ${NS.audit.FEE_BASIS[cfg.feeBasis].split(' (')[0].toLowerCase()}${cfg.carry ? `; ${pc(cfg.carry)} ${cfg.open ? 'incentive allocation over a high-water mark' : 'carried interest'}${!cfg.open && cfg.pref ? ` over a ${pc(cfg.pref)} preferred return` : ''}` : '; no carried interest'}`;
    return { cfg, text };
  }
  function fundAccountingPanel(o) {
    const { cfg, text } = accountingDefaults(o);
    return panel(
      'Fund accounting',
      `<p class="cs-hint">Used for the audit package. ${h(o.type)} offerings use ${h(cfg.label.toLowerCase())} accounting: ${cfg.open ? 'open-ended, monthly net asset value' : 'closed-end, quarterly valuations'}. Leave a field blank to use the default (${h(text)}).</p>
      <div class="cs-grid">
        ${offField('Management fee (% a year)', 'accounting.mgmtFee', { type: 'number', step: '0.05', placeholder: String(+(cfg.mgmtFee * 100).toFixed(2)) })}
        ${offField('Fee basis', 'accounting.feeBasis', { select: [['', `Default: ${NS.audit.FEE_BASIS[cfg.feeBasis].split(' (')[0].toLowerCase()}`], ['commitment', 'Commitments'], ['contributed', 'Contributed capital'], ['nav', 'Net asset value']] })}
        ${offField(cfg.open ? 'Incentive allocation (%)' : 'Carried interest (%)', 'accounting.carry', { type: 'number', step: '0.5', placeholder: String(+(cfg.carry * 100).toFixed(2)) })}
        ${cfg.open ? '' : offField('Preferred return (% a year)', 'accounting.pref', { type: 'number', step: '0.25', placeholder: String(+(cfg.pref * 100).toFixed(2)) })}
        ${offField('Auditor', 'accounting.auditor', { placeholder: T().auditor || 'Audit firm', max: 80 })}
      </div>`
    );
  }
  NS.views['console-offering'] = {
    mode: 'console',
    render() {
      const o = curOff();
      if (!o) return shell(`${head('Offering not found')}<p class="cs-muted"><a href="#console-offerings">Back to offerings</a></p>`, 'console-offerings');
      if (!canConfigure()) return offReadOnly(o);
      if (periodMonths(o.distribution.frequency) && !o.distribution.day) o.distribution.day = NS.data.paymentDay(W(), o);
      const e = o.exit;
      const exitFields =
        e.basis === 'range'
          ? `${offField('Window opens', 'exit.from', { type: 'date' })}${offField('Window closes', 'exit.to', { type: 'date' })}`
          : e.basis === 'open'
          ? ''
          : offField(e.basis === 'maturity' ? 'Maturity date' : e.basis === 'exited' ? 'Exit date' : 'Projected exit date', 'exit.date', { type: 'date' });
      const terms = (o.terms || [])
        .map(
          (r, i) => `<div class="term-row">
            <input aria-label="Term ${i + 1} label" type="text" data-bind="off:terms.${i}.label" value="${h(r.label)}" placeholder="Label">
            <input aria-label="Term ${i + 1} value" type="text" data-bind="off:terms.${i}.value" value="${h(r.value)}" placeholder="Value shown to investors">
            <label class="term-show"><input type="checkbox" data-bind="off:terms.${i}.show"${r.show ? ' checked' : ''}><span>Show</span></label>
            <span class="term-btns"><button class="cs-icon" type="button" data-action="term-move" data-i="${i}" data-d="-1" aria-label="Move up"${i === 0 ? ' disabled' : ''}>${icon('up')}</button><button class="cs-icon" type="button" data-action="term-move" data-i="${i}" data-d="1" aria-label="Move down"${i === o.terms.length - 1 ? ' disabled' : ''}>${icon('down')}</button><button class="cs-icon" type="button" data-action="term-del" data-i="${i}" aria-label="Remove term">${icon('x')}</button></span>
          </div>`
        )
        .join('');
      const n = holdersCount(o.id);
      return shell(
        `<a class="cs-back" href="#console-offerings">${icon('back')}Offerings</a>
        ${head(h(o.name), `${h(o.type)} · ${n} investor${n === 1 ? '' : 's'} · ${usd(raised(o.id))} raised`, `${E.diy && o.status === 'Raising' ? `<button class="cs-btn" type="button" data-action="join-link" data-id="${h(o.id)}">Investor sign-up link</button>` : ''}${n ? `<button class="cs-btn" type="button" data-action="off-preview">Preview as investor</button>` : ''}`)}
        <div class="cs-split">
          <div class="cs-split-main">
            ${panel('Basics', `<div class="cs-grid">
              ${offField('Offering name', 'name', { wide: true, max: 90 })}
              ${offField('Short name', 'shortName', { max: 32 })}
              ${offField('Type', 'type', { select: Object.keys(NS.OFFERING_TYPES) })}
              ${offField('Status', 'status', { select: ['Raising', 'Active', 'Exited'] })}
              ${offField('Closing date', 'closeDate', { type: 'date' })}
              ${offField('One-line description', 'summary', { wide: true, max: 100 })}
              ${offField('Minimum investment ($)', 'minimum', { type: 'number' })}
              ${offField('Securities exemption', 'structure.exemption', { select: exemptionOptions(o), hint: E.diy ? 'Rule 506(c) offerings take verified accredited investors only: investors verify their status while they onboard, before they can subscribe.' : '' })}
            </div>`)}
            ${NS.esign && NS.esign.agreementPanel ? NS.esign.agreementPanel(W(), o, true) : ''}
            ${panel('Exit timing', `<div class="cs-grid">
              ${offField('How exit is defined', 'exit.basis', { select: BASIS, wide: true })}
              ${exitFields}
              ${offField('Note shown to investors', 'exit.note', { textarea: true, rows: 2, max: 240 })}
            </div>`)}
            ${panel('Distributions', `<div class="cs-grid">
              ${offField('Frequency', 'distribution.frequency', { select: NS.FREQUENCIES })}
              ${
                periodMonths(o.distribution.frequency)
                  ? offField('Payment day of month', 'distribution.day', {
                      select: Array.from({ length: 28 }, (_, i) => [String(i + 1), NS.data.ordinal(i + 1)]),
                      hint: `If it falls on a weekend or bank holiday, payment goes out the next banking day.${nextOf(o) ? ` Next payment: ${date(nextOf(o).date, 'wd')}.` : ''}`
                    })
                  : ''
              }
              ${offField('Default payment type', 'distribution.type', { select: NS.DIST_TYPES })}
              ${offField('Target or rate shown to investors', 'distribution.target', { wide: true, max: 60, hint: 'For example "6.0% annualized". Leave blank to hide.' })}
            </div>`)}
            ${fundAccountingPanel(o)}
            ${structurePanel(o)}
            ${panel(
              'Key terms shown to investors',
              `<div class="terms-edit">${terms || '<p class="cs-muted">No terms yet.</p>'}</div>
              <div class="cs-row"><button class="cs-btn cs-btn-small" type="button" data-action="term-add">${icon('plus')}Add term</button><button class="cs-btn cs-btn-small" type="button" data-action="term-defaults">Add the standard terms for ${h(o.type)}</button></div>`
            )}
            ${panel('Latest update', `<div class="cs-grid">${offField('Shown on the investment page', 'update', { textarea: true, rows: 3, max: 600 })}</div>`)}
            ${panel(
              'ACH originator for this offering',
              `<div class="cs-grid">
                ${offField('Company name (16)', 'achOverride.companyName', { max: 16, upper: true, hint: `Appears on investors' bank statements. Blank uses ${h(T().ach.companyName || `the ${DEF.toLowerCase()}`)}.` })}
                ${offField('Company ID (10)', 'achOverride.companyId', { max: 10, spell: false, hint: 'Usually 1 followed by the paying entity’s EIN. Blank uses the ' + DEF.toLowerCase() + '.' })}
              </div>`
            )}
            ${n ? '' : panel('Remove offering', `<p class="cs-muted">This offering has no investors yet, so it can be removed.</p><button class="cs-btn cs-btn-danger" type="button" data-action="off-del">${S().ui.offDel ? 'Click again to remove' : 'Remove offering'}</button>`)}
          </div>
          <aside class="cs-split-side" id="off-preview">${offPreview(o)}</aside>
        </div>`,
        'console-offerings'
      );
    }
  };
  const OFF_FIELDS = { name: 'Offering name', shortName: 'Short name', type: 'Type', status: 'Status', closeDate: 'Closing date', summary: 'Description', minimum: 'Minimum investment', 'exit.basis': 'Exit basis', 'exit.date': 'Exit date', 'exit.from': 'Exit window opens', 'exit.to': 'Exit window closes', 'exit.note': 'Exit note', 'distribution.frequency': 'Distribution frequency', 'distribution.day': 'Payment day', 'distribution.type': 'Payment type', 'distribution.target': 'Target shown to investors', update: 'Latest update', 'achOverride.companyName': 'ACH company name', 'achOverride.companyId': 'ACH company ID', 'accounting.mgmtFee': 'Management fee (%)', 'accounting.feeBasis': 'Fee basis', 'accounting.carry': 'Carried interest or incentive (%)', 'accounting.pref': 'Preferred return (%)', 'accounting.auditor': 'Auditor', 'structure.exemption': 'Securities exemption' };
  function logOffEdit(o, path, from, to) {
    const m = /^terms\.(\d+)\.(label|value|show)$/.exec(path);
    const label = m ? `Term ${Number(m[1]) + 1} ${m[2] === 'show' ? 'shown to investors' : m[2]}` : OFF_FIELDS[path] || path;
    if (NS.audit) NS.audit.log(W(), { coalesce: `off:${o.id}:${path}`, action: 'Offering updated', fund: o.id, record: o.id, from, to, detailFor: (a, b) => `${label}: ${short(a)} → ${short(b)}` });
  }
  NS.binders.off = (path, v) => {
    const o = curOff();
    if (!o || !canConfigure()) return;
    const before = NS.app.getPath(o, path);
    if (path === 'minimum') v = Number(v) || 0;
    if (path === 'distribution.day') v = Number(v) || 15;
    if (/^accounting\.(mgmtFee|carry|pref)$/.test(path)) v = v === '' || v == null ? '' : Number(v);
    NS.app.setPath(o, path, v);
    logOffEdit(o, path, before, v);
    if (path === 'exit.basis') {
      // Give the new basis sensible dates so the investor preview always has something to show.
      const base = o.closeDate || today();
      if (v === 'range' && !(o.exit.from && o.exit.to)) {
        o.exit.from = NS.dates.addMonths(base, 60);
        o.exit.to = NS.dates.addMonths(base, 84);
      }
      if ((v === 'date' || v === 'maturity' || v === 'exited') && !o.exit.date) o.exit.date = v === 'exited' ? today() : NS.dates.addMonths(base, 60);
      if (v === 'exited') o.status = 'Exited';
    }
    NS.app.save();
    if (path === 'exit.basis' || path === 'type' || path === 'distribution.day' || path === 'distribution.frequency') NS.app.render();
    else {
      const pv = document.getElementById('off-preview');
      if (pv) pv.innerHTML = offPreview(o);
    }
  };
  NS.actions['term-add'] = staffGuard(() => {
    audit('Offering terms changed', 'Term added', curOff().id, curOff().id);
    curOff().terms.push({ label: '', value: '', show: true });
    NS.app.save();
    NS.app.render();
    const ins = document.querySelectorAll('.term-row input[type="text"]');
    if (ins.length) ins[ins.length - 2].focus();
  });
  NS.actions['term-defaults'] = staffGuard(() => {
    audit('Offering terms changed', 'Standard terms added', curOff().id, curOff().id);
    const o = curOff();
    const have = o.terms.map((r) => r.label.toLowerCase());
    NS.OFFERING_TYPES[o.type].terms.forEach((l) => {
      if (have.indexOf(l.toLowerCase()) < 0) o.terms.push({ label: l, value: '', show: true });
    });
    NS.app.save();
    NS.app.render();
  });
  NS.actions['term-del'] = staffGuard((el) => {
    audit('Offering terms changed', `Term ${Number(el.getAttribute('data-i')) + 1} removed`, curOff().id, curOff().id);
    curOff().terms.splice(Number(el.getAttribute('data-i')), 1);
    NS.app.save();
    NS.app.render();
  });
  NS.actions['term-move'] = staffGuard((el) => {
    audit('Offering terms changed', `Term ${Number(el.getAttribute('data-i')) + 1} moved ${Number(el.getAttribute('data-d')) < 0 ? 'up' : 'down'}`, curOff().id, curOff().id);
    const t = curOff().terms;
    const i = Number(el.getAttribute('data-i'));
    const j = i + Number(el.getAttribute('data-d'));
    if (j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
    NS.app.save();
    NS.app.render();
  });
  NS.actions['off-del'] = staffGuard(() => {
    if (!S().ui.offDel) {
      S().ui.offDel = true;
      NS.app.render();
      return;
    }
    S().ui.offDel = false;
    const gone = curOff();
    if (gone) audit('Offering removed', gone.name, gone.id, gone.id);
    W().offerings = W().offerings.filter((o) => o.id !== S().param);
    NS.app.save(true);
    NS.app.go('console-offerings');
    U.toast('Offering removed');
  });
  NS.actions['off-preview'] = () => {
    const o = curOff();
    const holder = NS.data.holdersAt(W().investors, o.id, '9999-12-31').find((x) => x.investor.onboarding.status === 'complete');
    if (holder) S().viewer = holder.investor.id;
    NS.app.go('investment-' + o.id);
  };

  /* ---------- Investors ---------- */
  /**
   * An investor's total commitment, in cents. A position without a commitment field is fully called, so its commitment is its
   * amount: the rule NS.ops.commitOf applies per offering, summed over the offerings the investor holds.
   */
  const committedCents = (inv) => Array.from(new Set(inv.positions.map((p) => p.offeringId))).reduce((a, id) => a + OPS().commitOf(inv, { id }), 0);
  NS.views['console-investors'] = {
    mode: 'console',
    render() {
      const w = W();
      const ui = S().ui;
      const f = ui.invFilter || 'all';
      const incomplete = w.investors.filter((i) => i.onboarding.status !== 'complete');
      const nobank = w.investors.filter((i) => !(i.payment && i.payment.method === 'ach'));
      const list = f === 'onboarding' ? incomplete : f === 'nobank' ? nobank : w.investors;
      const rows = list
        .map((i) => {
          const invested = i.positions.reduce((a, p) => a + p.amount, 0);
          const committed = committedCents(i);
          const done = i.onboarding.status === 'complete';
          // The committed line shows only while some of the commitment is still to be called (compared in cents).
          return `<tr>
            <th scope="row"><span class="strong">${h(i.title)}</span><span class="sub">${h(i.contact)} · ${h(i.email)}</span></th>
            <td>${h((NS.ENTITY_TYPES[i.type] || {}).label || i.type)}</td>
            <td class="num">${usd(invested)}<span class="sub">${committed > Math.round(invested * 100) ? `${usd(committed / 100)} committed · ` : ''}${i.positions.length} investment${i.positions.length === 1 ? '' : 's'}</span></td>
            <td>${activation(i)}</td>
            <td>${payLabel(i)}</td>
            <td class="cs-row-actions">${
              done
                ? `<button class="cs-btn cs-btn-small" type="button" data-action="view-as" data-id="${h(i.id)}">View portal</button>`
                : `<button class="cs-btn cs-btn-small" type="button" data-action="invite-preview" data-id="${h(i.id)}">Invitation</button><button class="cs-btn cs-btn-small" type="button" data-action="remind" data-id="${h(i.id)}">Send reminder</button>`
            }</td>
          </tr>`;
        })
        .join('');
      const tabs = [
        ['all', `All (${w.investors.length})`],
        ['onboarding', `Not activated (${incomplete.length})`],
        ['nobank', `Paid by check (${nobank.length})`]
      ];
      // DIY: turnkey invitations (invitations.js): the basics only, one link through every step, and their progress.
      const I8 = E.diy && NS.invitations;
      const canInvite = !I8 || NS.app.can('operate');
      return shell(
        `${head('Investors', I8 ? 'Invite investors with one link, follow their progress, and see how each investor is paid.' : 'Activation status and how each investor is paid.', canInvite ? `<button class="cs-btn cs-btn-primary" type="button" data-action="invite-toggle" aria-expanded="${!!ui.inviteOpen}">${ui.inviteOpen ? 'Close' : I8 ? 'Invite an investor' : 'Invite investors'}</button>` : '')}
        ${ui.inviteOpen && canInvite ? (I8 ? I8.invitePanel() : invitePanel()) : ''}
        ${I8 ? I8.listPanel() : ''}
        <div class="cs-tabs" role="group" aria-label="Filter">${tabs.map(([k, l]) => `<button type="button" class="cs-tab" data-action="inv-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
        ${panel(
          '',
          list.length
            ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Investor</th><th scope="col">Type</th><th scope="col" class="num">Invested</th><th scope="col">Activation</th><th scope="col">Paid by</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
            : `<p class="cs-muted">${w.investors.length ? 'No investors match this filter.' : `No investors yet. Use ${I8 ? 'Invite an investor' : 'Invite investors'} to add them.`}</p>`
        )}`,
        'console-investors'
      );
    }
  };

  function invitePanel() {
    const ui = S().ui;
    const w = W();
    const tab = ui.inviteTab || 'single';
    if (!w.offerings.length) return panel('Invite investors', '<p class="cs-muted">Add an offering first. Each investor is invited with the offering they invested in.</p><a class="cs-btn" href="#console-offerings">Go to offerings</a>');
    const offOpts = w.offerings.map((o) => `<option value="${h(o.id)}">${h(o.name)}</option>`).join('');
    const single = `<form class="cs-form cs-grid" data-form="invite-one" novalidate>
      <label class="cs-field" for="iv-contact"><span>First name</span><input id="iv-contact" name="contact" maxlength="60" autocomplete="off" required></label>
      <label class="cs-field" for="iv-last-name"><span>Last name</span><input id="iv-last-name" name="last" maxlength="60" autocomplete="off" required></label>
      <label class="cs-field" for="iv-email"><span>Email</span><input id="iv-email" name="email" type="email" maxlength="80" required></label>
      <label class="cs-field" for="iv-type"><span>Investing as</span><select id="iv-type" name="type">${Object.keys(NS.ENTITY_TYPES).map((k) => `<option value="${k}">${NS.ENTITY_TYPES[k].label}</option>`).join('')}</select></label>
      <label class="cs-field" for="iv-title"><span>Name on the account <em>Optional</em></span><input id="iv-title" name="title" maxlength="80" placeholder="Defaults to the contact name"></label>
      <label class="cs-field" for="iv-off"><span>Offering</span><select id="iv-off" name="offering">${offOpts}</select></label>
      <label class="cs-field" for="iv-amt"><span>Amount invested ($)</span><input id="iv-amt" name="amount" type="number" min="1" step="1000" required></label>
      <label class="cs-field" for="iv-date"><span>Funded on</span><input id="iv-date" name="date" type="date" value="${today()}" required></label>
      <p class="cs-error cs-wide" id="iv-error" hidden></p>
      <div class="cs-row cs-wide"><button class="cs-btn cs-btn-primary" type="submit">Add investor and prepare invitation</button></div>
    </form>`;
    const bulk = `<form class="cs-form" data-form="invite-bulk" novalidate>
      <label class="cs-field" for="iv-csv"><span>Paste a list: name, email, offering, amount</span><textarea id="iv-csv" name="csv" rows="6" spellcheck="false" placeholder="name,email,offering,amount&#10;Anita Shah,anita.shah@example.com,${h(w.offerings[0].shortName)},100000">${h(ui.bulkText || '')}</textarea><span class="cs-hint">Offering can be the short name or the full name. Use one investor per line. Investors are added as individuals; change the type after they activate.</span></label>
      ${ui.bulkResult ? ui.bulkResult : ''}
      <div class="cs-row"><button class="cs-btn" type="submit" name="check" value="1">Check list</button>${ui.bulkRows && ui.bulkRows.length ? `<button class="cs-btn cs-btn-primary" type="button" data-action="invite-bulk-add">Add ${ui.bulkRows.length} investor${ui.bulkRows.length === 1 ? '' : 's'}</button>` : ''}</div>
    </form>`;
    return panel(
      'Invite investors',
      `<div class="cs-tabs cs-tabs-inline" role="group" aria-label="Invite method"><button type="button" class="cs-tab" data-action="invite-tab" data-t="single" aria-pressed="${tab === 'single'}">One investor</button><button type="button" class="cs-tab" data-action="invite-tab" data-t="bulk" aria-pressed="${tab === 'bulk'}">Import a list</button></div>
      ${tab === 'single' ? single : bulk}
      <p class="cs-hint">Each investor receives an email from ${h(T().support.email)} with a link to activate their account. In this demo no email is sent; open the invitation to walk through activation.</p>`
    );
  }
  function nextInvestorId() {
    const w = W();
    const nums = w.investors.map((i) => Number(String(i.id).split('-').pop()) || 0);
    return `${T().idPrefix}-${Math.max(1000, ...nums) + 1}`;
  }
  function addInvestor(r) {
    const inv = {
      id: nextInvestorId(),
      contact: r.contact,
      title: r.title || r.contact,
      type: r.type || 'individual',
      email: r.email,
      phone: '',
      address: '',
      tinLast4: '',
      accreditation: { basis: '', date: '' },
      taxForm: '',
      edelivery: false,
      onboarding: { status: 'invited', step: 0, invited: today(), completed: '' },
      payment: { method: 'check', bank: null },
      positions: [{ offeringId: r.offering, amount: r.amount, date: r.date || today() }]
    };
    const same = W().investors.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
    if (same) {
      same.positions.push(inv.positions[0]);
      audit('Subscription added', `${same.title}: ${usd(r.amount)}`, r.offering, same.id);
      return same;
    }
    W().investors.push(inv);
    audit('Investor invited', `${inv.title} (${inv.email}): ${usd(r.amount)}`, r.offering, inv.id);
    return inv;
  }
  NS.actions['invite-toggle'] = () => {
    S().ui.inviteOpen = !S().ui.inviteOpen;
    NS.app.render();
    const f = document.getElementById('iv-contact');
    if (f) f.focus();
  };
  NS.actions['invite-tab'] = (el) => {
    S().ui.inviteTab = el.getAttribute('data-t');
    NS.app.render();
  };
  NS.actions['inv-filter'] = (el, e) => {
    S().ui.invFilter = el.getAttribute('data-f');
    if (S().route === 'console-investors') {
      e.preventDefault();
      NS.app.render();
    }
  };
  NS.forms['invite-one'] = (f) => {
    const errEl = document.getElementById('iv-error');
    const r = { contact: [f.contact.value.trim(), f.last ? f.last.value.trim() : ''].filter(Boolean).join(' '), email: f.email.value.trim(), type: f.type.value, title: f.title.value.trim(), offering: f.offering.value, amount: Number(f.amount.value), date: f.date.value };
    const problems = [];
    if (!r.contact) problems.push('a contact name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) problems.push('a valid email');
    if (!(r.amount > 0)) problems.push('the amount invested');
    if (!r.date) problems.push('the funding date');
    if (problems.length) {
      errEl.textContent = `Enter ${problems.join(', ')}.`;
      errEl.hidden = false;
      return;
    }
    const inv = addInvestor(r);
    NS.app.save(true);
    S().ui.inviteOpen = false;
    NS.app.render();
    U.toast(`${inv.title} added`);
    showInvitation(inv.id);
  };
  function parseBulk(text) {
    const w = W();
    const rows = [];
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        const cells = line.split(',').map((c) => c.trim());
        if (idx === 0 && /^name$/i.test(cells[0])) return;
        const [contact, email, off, amt] = cells;
        const o = w.offerings.find((x) => [x.id, x.shortName, x.name].some((n) => n && off && n.toLowerCase() === off.toLowerCase()));
        const amount = Number(String(amt || '').replace(/[$,\s]/g, ''));
        const why = !contact ? 'missing name' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') ? 'invalid email' : !o ? `unknown offering "${off || ''}"` : !(amount > 0) ? 'invalid amount' : '';
        if (why) errors.push(`Line ${idx + 1}: ${why}`);
        else rows.push({ contact, email, offering: o.id, offeringName: o.shortName, amount, type: 'individual', date: today() });
      });
    return { rows, errors };
  }
  NS.forms['invite-bulk'] = (f) => {
    const ui = S().ui;
    ui.bulkText = f.csv.value;
    const { rows, errors } = parseBulk(ui.bulkText);
    ui.bulkRows = rows;
    ui.bulkResult = `<div class="cs-bulk">${rows.length ? `<table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Offering</th><th scope="col" class="num">Amount</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${h(r.contact)}</td><td>${h(r.email)}</td><td>${h(r.offeringName)}</td><td class="num">${usd(r.amount)}</td></tr>`)
      .join('')}</tbody></table>` : ''}${errors.length ? `<ul class="cs-errors">${errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>` : ''}${!rows.length && !errors.length ? '<p class="cs-muted">No rows found.</p>' : ''}</div>`;
    NS.app.render();
  };
  NS.actions['invite-bulk-add'] = () => {
    const ui = S().ui;
    const n = (ui.bulkRows || []).length;
    (ui.bulkRows || []).forEach(addInvestor);
    NS.app.save(true);
    ui.bulkRows = null;
    ui.bulkResult = '';
    ui.bulkText = '';
    ui.inviteOpen = false;
    ui.invFilter = 'onboarding';
    NS.app.render();
    U.toast(`${n} investor${n === 1 ? '' : 's'} added and ready to invite`);
  };
  function showInvitation(id) {
    const inv = W().investors.find((x) => x.id === id);
    const t = T();
    const by = U.date(NS.dates.addMonths(today(), 1), 'long');
    U.dialog(
      `<div class="dlg-head"><div><h2>Invitation email</h2><p>To ${h(inv.email)} · From ${h(t.support.email)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body"><article class="email">
        <div class="email-head">${B.lockup(t)}</div>
        <div class="email-body">
          <p class="email-subject">Subject: Activate your ${h(t.shortName)} ${h(t.portalName)}</p>
          <p>Dear ${h(inv.contact.split(' ')[0])},</p>
          <p>${h(t.shortName)} now shares account information through a secure ${h(t.portalName.toLowerCase())}. Once you activate your account you can see each of your investments, the distributions you have received, projected exit timing, and your statements and tax documents.</p>
          <p>Activation takes about five minutes. You will create a login, confirm your investor details${t.onboarding.accreditation ? ' and accreditation' : ''}, and tell us where to send distributions.</p>
          <p><span class="email-btn">Activate your account</span></p>
          <p>This link expires on ${by}. Questions? Contact ${h(t.support.team)} at ${h(t.support.phone)}.</p>
        </div>
        <div class="email-foot">${h(t.legalName)} · ${h(t.domain)}</div>
      </article>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Close</button><button class="cs-btn cs-btn-primary" type="button" data-action="open-activation" data-id="${h(inv.id)}">Open activation as ${h(inv.contact)}</button></div></div>`,
      'dlg-email'
    );
  }
  NS.actions['invite-preview'] = (el) => showInvitation(el.getAttribute('data-id'));
  NS.actions['open-activation'] = (el) => {
    U.closeDialog();
    NS.startOnboarding(el.getAttribute('data-id'));
  };
  NS.actions.remind = (el) => {
    const inv = W().investors.find((x) => x.id === el.getAttribute('data-id'));
    U.toast(`Reminder prepared for ${inv.email}. No email is sent in this demo.`);
  };
  NS.actions['view-as'] = (el) => {
    S().viewer = el.getAttribute('data-id');
    NS.app.go('investments');
  };

  /* ---------- Distributions and NACHA ---------- */
  function runsTable(runs, withFile) {
    const name = (id) => (W().offerings.find((o) => o.id === id) || {}).shortName || id;
    return `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Payment date</th><th scope="col">Offering</th><th scope="col">Type</th><th scope="col" class="num">Amount</th><th scope="col" class="num">Investors</th><th scope="col">Status</th>${withFile ? '<th scope="col"><span class="sr-only">ACH file</span></th>' : ''}</tr></thead><tbody>${runs
      .map((r) => {
        const n = NS.data.allocate(W(), r).filter((a) => a.cents > 0).length;
        return `<tr><td class="nowrap">${date(r.date)}</td><td>${h(name(r.offeringId))}</td><td>${h(r.type)}</td><td class="num">${usdc(r.total)}</td><td class="num">${n}</td><td>${r.status === 'scheduled' ? 'Scheduled' : 'Paid'}</td>${
          withFile ? `<td class="num"><button class="cs-btn cs-btn-small" type="button" data-action="dist-load" data-id="${h(r.id)}">ACH file</button></td>` : ''
        }</tr>`;
      })
      .join('')}</tbody></table></div>`;
  }
  function periodMonths(freq) {
    return NS.data.FREQ_MONTHS[freq] || 0;
  }
  /** The offering's next scheduled payment date, or two banking days out when it has no schedule. */
  function defaultDate(o) {
    const n = o && nextOf(o);
    return n && n.date > today() ? n.date : NS.nacha.nextBankingDay(today(), 2);
  }
  function draft() {
    const ui = S().ui;
    if (!ui.dist) {
      const w = W();
      const o = w.offerings.find((x) => x.status !== 'Exited' && holdersCount(x.id)) || w.offerings[0];
      const m = o && /([\d.]+)\s*%/.exec((o.distribution || {}).target || '');
      ui.dist = {
        offeringId: o ? o.id : '',
        type: o ? o.distribution.type : 'Distribution',
        date: defaultDate(o),
        mode: m && periodMonths(o.distribution.frequency) ? 'rate' : 'total',
        rate: m ? m[1] : '',
        total: '',
        desc: T().ach.entryDescription || 'DISTRIB',
        file: null,
        line: null
      };
    }
    return ui.dist;
  }
  function draftTotalCents(d) {
    const o = W().offerings.find((x) => x.id === d.offeringId);
    if (!o) return 0;
    if (d.mode === 'rate') {
      const months = periodMonths(o.distribution.frequency) || 12;
      return Math.round(NS.data.investedAt(W().investors, o.id, d.date) * (Number(d.rate) || 0) / 100 * months / 12 * 100);
    }
    return Math.round((Number(String(d.total).replace(/[$,\s]/g, '')) || 0) * 100);
  }
  function draftAlloc(d) {
    return NS.data.allocate(W(), { id: 'draft', offeringId: d.offeringId, date: d.date, total: draftTotalCents(d) }).filter((a) => a.amount > 0);
  }
  function companyFor(o) {
    const a = T().ach;
    const ov = (o && o.achOverride) || {};
    return { name: ov.companyName || a.companyName, id: ov.companyId || a.companyId };
  }
  function buildFile(d) {
    const t = T();
    const a = t.ach;
    const o = W().offerings.find((x) => x.id === d.offeringId);
    const rows = draftAlloc(d);
    const entries = rows
      .filter((r) => r.investor.payment && r.investor.payment.method === 'ach' && r.investor.payment.bank && r.cents > 0)
      .map((r) => ({ name: r.investor.payment.bank.holder || r.investor.title, id: r.investor.id, routing: r.investor.payment.bank.routing, account: r.investor.payment.bank.account, accountType: r.investor.payment.bank.type, cents: r.cents, sec: (NS.ENTITY_TYPES[r.investor.type] || { sec: 'PPD' }).sec }));
    const log = (W().achLog = W().achLog || []);
    const todayIso = today();
    const used = log.filter((x) => x.date === todayIso).length;
    const modifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[used % 36];
    const co = companyFor(o);
    const eff = NS.dates.parse(d.date);
    const file = NS.nacha.build({
      origin: { destinationRouting: a.destinationRouting || a.odfiRouting, destinationName: a.destinationName || a.odfiName, immediateOrigin: a.immediateOrigin, originName: a.originName || t.legalName, odfiRouting: a.odfiRouting },
      company: { name: co.name, id: co.id },
      entries,
      effectiveDate: d.date,
      description: d.desc,
      descriptiveDate: eff.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase() + ' ' + String(eff.getUTCFullYear()).slice(2),
      modifier,
      balanced: !!a.balanced,
      offset: a.balanced ? a.offset : null
    });
    const slug = NS.nacha.clean(co.name).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    file.filename = `${slug}_${d.date.replace(/-/g, '')}_${modifier}.ach`;
    file.modifier = modifier;
    file.company = co;
    log.push({ date: todayIso, modifier, filename: file.filename });
    NS.app.save();
    return file;
  }

  function fileSection(d) {
    const f = d.file;
    if (!f) return '';
    const checks = f.checks.map((c) => `<li class="${c.ok ? (c.warn ? 'is-warn' : 'is-ok') : 'is-bad'}">${icon(c.ok ? (c.warn ? 'alert' : 'check') : 'x')}<span>${h(c.label)}</span></li>`).join('');
    const batches = f.batches.map((b) => `<div><dt>Batch ${b.number} · ${b.sec}</dt><dd>${b.entries} entries · ${usdc(b.credit)}</dd></div>`).join('');
    const sel = d.line;
    const lines = f.lines
      .map((l, i) => `<button type="button" class="nl nl-${l[0] === '9' && /^9+$/.test(l) ? 'pad' : l[0]}${sel === i ? ' is-sel' : ''}" data-action="nacha-line" data-i="${i}"><span class="nl-n">${String(i + 1).padStart(2, '0')}</span><span class="nl-t">${h(l)}</span></button>`)
      .join('');
    let breakdown = '';
    if (sel != null && f.lines[sel]) {
      const l = f.lines[sel];
      const lay = /^9+$/.test(l) ? null : NS.nacha.LAYOUT[l[0]];
      breakdown = lay
        ? `<table class="cs-tbl cs-tbl-compact nacha-fields"><caption>Record ${sel + 1} fields</caption><thead><tr><th scope="col">Positions</th><th scope="col">Field</th><th scope="col">Value</th></tr></thead><tbody>${lay
            .map(([a, b, n]) => `<tr><td class="nowrap">${a}${b > a ? '–' + b : ''}</td><td>${n}</td><td><code>${h(l.slice(a - 1, b)).replace(/ /g, '&middot;')}</code></td></tr>`)
            .join('')}</tbody></table>`
        : '<p class="cs-muted">Filler record: pads the file to a multiple of ten records.</p>';
    }
    return panel(
      `ACH file <span class="cs-count">${h(f.filename)}</span>`,
      `<div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="nacha-download">${icon('download')}Download file</button><button class="cs-btn" type="button" data-action="nacha-copy">${icon('copy')}Copy file</button></div>
      <div class="nacha-grid">
        <dl class="cs-kv">
          <div><dt>Company</dt><dd>${h(f.company.name)} · ${h(f.company.id)}</dd></div>
          <div><dt>Effective date</dt><dd>${date(d.date)}</dd></div>
          ${batches}
          <div><dt>Total credits</dt><dd>${usdc(f.totals.credit)}</dd></div>
          ${f.totals.debit ? `<div><dt>Offsetting debit</dt><dd>${usdc(f.totals.debit)}</dd></div>` : ''}
          <div><dt>Entry hash</dt><dd>${String(f.totals.hash).padStart(10, '0')}</dd></div>
          <div><dt>Records</dt><dd>${f.totals.records} in ${f.totals.blocks} block${f.totals.blocks === 1 ? '' : 's'}</dd></div>
        </dl>
        <ul class="cs-checks">${checks}</ul>
      </div>
      ${f.excluded.length ? `<div class="cs-warnbox"><strong>${f.excluded.length} entr${f.excluded.length === 1 ? 'y was' : 'ies were'} left out of the file</strong><ul>${f.excluded.map((x) => `<li>${h(x.entry.name)} (${h(x.entry.id)}): ${h(x.reason)}</li>`).join('')}</ul></div>` : ''}
      <div class="nacha-wrap"><div class="nacha-ruler" aria-hidden="true"><span class="nl-n"></span><span class="nl-t">${'1234567890'.repeat(10).slice(0, 94)}</span></div><div class="nacha" id="nacha-text" role="list" aria-label="File records. Select a record to see its fields.">${lines}</div></div>
      <p class="cs-hint">Select a record to see its fields. Spaces are shown as dots in the field view. Confirm values against your bank's ACH implementation guide before the first upload.</p>
      ${breakdown}`
    );
  }

  NS.views['console-distributions'] = {
    mode: 'console',
    render() {
      const w = W();
      const ui = S().ui;
      if (!w.offerings.length) {
        return shell(`${head('Distributions')}${panel('', '<p class="cs-muted">Add an offering and investors before creating a distribution.</p><a class="cs-btn" href="#console-offerings">Go to offerings</a>')}`, 'console-distributions');
      }
      const d = draft();
      const o = w.offerings.find((x) => x.id === d.offeringId) || w.offerings[0];
      d.offeringId = o.id;
      const rows = draftAlloc(d);
      const total = draftTotalCents(d);
      const ach = rows.filter((r) => r.investor.payment && r.investor.payment.method === 'ach');
      const chk = rows.filter((r) => !(r.investor.payment && r.investor.payment.method === 'ach'));
      const sum = (arr) => arr.reduce((a, r) => a + r.cents, 0);
      const reason = NS.nacha.bankingDayReason(d.date);
      const months = periodMonths(o.distribution.frequency);
      const invested = NS.data.investedAt(w.investors, o.id, d.date);
      const annualized = invested && months ? (total / 100 / invested) * (12 / months) : 0;
      const canFile = ach.length && total > 0 && achReady() && !reason && d.date >= today();
      const why = !achReady() ? 'Complete ACH origination first.' : !total ? 'Enter an amount.' : !ach.length ? 'No investors in this offering have a bank account on file.' : reason ? `The payment date ${reason}.` : d.date < today() ? 'The payment date is in the past.' : '';
      const history = ui.histAll ? w.runs : w.runs.slice(0, 12);
      return shell(
        `${head('Distributions', 'Allocate a payment pro rata by amount invested, then generate the NACHA file for the bank.')}
        ${panel(
          'New distribution',
          `<div class="cs-grid">
            <label class="cs-field" for="ds-off"><span>Offering</span><select id="ds-off" data-bind="dist:offeringId">${w.offerings.map((x) => `<option value="${h(x.id)}"${x.id === d.offeringId ? ' selected' : ''}>${h(x.name)}${x.status === 'Exited' ? ' (exited)' : ''}</option>`).join('')}</select><span class="cs-hint">${holdersCount(o.id)} investors · ${usd(invested)} invested · pays ${h(o.distribution.frequency.toLowerCase())}</span></label>
            <label class="cs-field" for="ds-type"><span>Payment type</span><select id="ds-type" data-bind="dist:type">${NS.DIST_TYPES.map((x) => `<option${x === d.type ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="cs-field" for="ds-date"><span>Payment (effective) date</span><input id="ds-date" type="date" data-bind="dist:date" value="${h(d.date)}" min="${today()}"><span class="${reason ? 'cs-error' : 'cs-hint'}">${reason ? `This date ${reason}. Next banking day: ${date(NS.nacha.nextBankingDay(d.date, 1))}.` : nextOf(o) && nextOf(o).date === d.date ? `Next scheduled payment (${h(nextOf(o).schedule.toLowerCase())}). Most banks need files 1–2 banking days ahead.` : 'Banking days only. Most banks need files 1–2 banking days ahead.'}</span></label>
            <fieldset class="cs-field"><legend>Amount</legend><div class="cs-seg">
              <label><input type="radio" name="ds-mode" value="rate" data-bind="dist:mode"${d.mode === 'rate' ? ' checked' : ''}${months ? '' : ' disabled'}><span>Annualized rate</span></label>
              <label><input type="radio" name="ds-mode" value="total" data-bind="dist:mode"${d.mode === 'total' ? ' checked' : ''}><span>Total amount</span></label>
            </div></fieldset>
            ${
              d.mode === 'rate'
                ? `<label class="cs-field" for="ds-rate"><span>Rate (% per year)</span><input id="ds-rate" type="text" inputmode="decimal" data-bind="dist:rate" value="${h(d.rate)}"><span class="cs-hint" id="ds-calc">${usdc(total)} for this ${h(o.distribution.frequency.toLowerCase())} period</span></label>`
                : `<label class="cs-field" for="ds-total"><span>Total to distribute ($)</span><input id="ds-total" type="text" inputmode="decimal" data-bind="dist:total" value="${h(d.total)}"><span class="cs-hint" id="ds-calc">${annualized ? `Equivalent to ${(annualized * 100).toFixed(2)}% annualized` : '&nbsp;'}</span></label>`
            }
            <label class="cs-field" for="ds-desc"><span>Bank statement description (10)</span><input id="ds-desc" type="text" maxlength="10" data-upper data-bind="dist:desc" value="${h(d.desc)}" spellcheck="false"></label>
          </div>
          ${wfPreview(o, d)}
          <div id="ds-alloc">${allocTable(rows, ach, chk, total)}</div>
          <div class="cs-row">
            <button class="cs-btn cs-btn-primary" type="button" data-action="nacha-build"${canFile ? '' : ' disabled'}>Generate NACHA file</button>
            <button class="cs-btn" type="button" data-action="dist-record"${total > 0 && rows.length ? '' : ' disabled'}>Record distribution</button>
            ${why ? `<span class="cs-hint">${h(why)}</span>` : ''}
          </div>`
        )}
        <div id="ds-file">${fileSection(d)}</div>
        ${panel('History', w.runs.length ? runsTable(history, true) + (w.runs.length > history.length ? `<button class="cs-link link-btn" type="button" data-action="hist-all">Show all ${w.runs.length}</button>` : '') : '<p class="cs-muted">No distributions recorded yet.</p>')}`,
        'console-distributions'
      );
    }
  };
  function allocTable(rows, ach, chk, total) {
    if (!rows.length) return '<p class="cs-muted">No investors hold this offering on the payment date.</p>';
    const sum = (arr) => arr.reduce((a, r) => a + r.cents, 0);
    return `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact">
      <thead><tr><th scope="col">Investor</th><th scope="col">Account</th><th scope="col" class="num">Invested</th><th scope="col" class="num">Share</th><th scope="col" class="num">Amount</th><th scope="col">Paid by</th></tr></thead>
      <tbody>${rows
        .map((r) => `<tr><td>${h(r.investor.title)}</td><td class="nowrap">${h(r.investor.id)}</td><td class="num">${usd(r.amount)}</td><td class="num">${(r.share * 100).toFixed(3)}%</td><td class="num">${usdc(r.cents)}</td><td>${payLabel(r.investor)}${r.investor.payment && r.investor.payment.method === 'ach' ? ` · ${(NS.ENTITY_TYPES[r.investor.type] || {}).sec}` : ''}</td></tr>`)
        .join('')}</tbody>
      <tfoot>
        <tr><th scope="row" colspan="4">ACH (${ach.length})</th><td class="num">${usdc(sum(ach))}</td><td></td></tr>
        <tr><th scope="row" colspan="4">Check (${chk.length})</th><td class="num">${usdc(sum(chk))}</td><td></td></tr>
        <tr class="cs-total"><th scope="row" colspan="4">Total</th><td class="num">${usdc(total)}</td><td></td></tr>
      </tfoot></table></div>`;
  }
  NS.binders.dist = (path, v) => {
    const d = draft();
    if (path === 'gross') {
      d.gross = v;
      const el = document.getElementById('ds-wf-body');
      const o = W().offerings.find((x) => x.id === d.offeringId);
      if (el && o) el.innerHTML = wfBody(o, d);
      return;
    }
    d[path] = v;
    if (path === 'offeringId') {
      d.gross = '';
      d.wf = null;
    }
    d.file = null;
    d.line = null;
    if (path === 'offeringId') {
      const o = W().offerings.find((x) => x.id === v);
      const m = /([\d.]+)\s*%/.exec((o.distribution || {}).target || '');
      d.type = o.distribution.type;
      d.mode = m && periodMonths(o.distribution.frequency) ? 'rate' : 'total';
      d.rate = m ? m[1] : '';
      d.date = defaultDate(o);
    }
    if (path === 'rate' || path === 'total' || path === 'desc') {
      // Keep focus in the field: update only the dependent parts.
      const w = W();
      const o = w.offerings.find((x) => x.id === d.offeringId);
      const rows = draftAlloc(d);
      const total = draftTotalCents(d);
      const ach = rows.filter((r) => r.investor.payment && r.investor.payment.method === 'ach');
      const chk = rows.filter((r) => !(r.investor.payment && r.investor.payment.method === 'ach'));
      const a = document.getElementById('ds-alloc');
      if (a) a.innerHTML = allocTable(rows, ach, chk, total);
      const calc = document.getElementById('ds-calc');
      const months = periodMonths(o.distribution.frequency);
      const inv = NS.data.investedAt(w.investors, o.id, d.date);
      if (calc) calc.innerHTML = d.mode === 'rate' ? `${usdc(total)} for this ${h(o.distribution.frequency.toLowerCase())} period` : inv && months && total ? `Equivalent to ${((total / 100 / inv) * (12 / months) * 100).toFixed(2)}% annualized` : '&nbsp;';
      const file = document.querySelector('[data-action="nacha-build"]');
      const rec = document.querySelector('[data-action="dist-record"]');
      const reason = NS.nacha.bankingDayReason(d.date);
      if (file) file.disabled = !(ach.length && total > 0 && achReady() && !reason && d.date >= today());
      if (rec) rec.disabled = !(total > 0 && rows.length);
      const fs = document.getElementById('ds-file');
      if (fs) fs.innerHTML = '';
      return;
    }
    NS.app.render();
  };
  NS.actions['nacha-build'] = () => {
    const d = draft();
    d.file = buildFile(d);
    d.line = 2;
    audit('NACHA file generated', `${d.file.filename}: ${d.file.batches.reduce((a, b) => a + b.entries, 0)} entries, ${usdc(d.file.batches.reduce((a, b) => a + b.credit, 0))}, effective ${date(d.date)}`, d.offeringId, d.file.filename);
    NS.app.render();
    const p = document.querySelector('.nacha-wrap');
    if (p) p.scrollIntoView({ block: 'nearest' });
    U.toast(`${d.file.filename} generated`);
  };
  NS.actions['nacha-line'] = (el) => {
    draft().line = Number(el.getAttribute('data-i'));
    NS.app.render();
    const b = document.querySelector(`.nl[data-i="${draft().line}"]`);
    if (b) b.focus({ preventScroll: true });
  };
  NS.actions['nacha-download'] = () => {
    const f = draft().file;
    if (f) audit('NACHA file downloaded', f.filename, draft().offeringId, f.filename);
    if (f) U.download(f.filename, f.text, { hostName: f.filename.replace(/\.ach$/i, '.txt') });
  };
  NS.actions['nacha-copy'] = () => {
    const f = draft().file;
    if (f) U.copy(f.text, document.getElementById('nacha-text'));
  };
  NS.actions['dist-record'] = () => {
    const d = draft();
    const total = draftTotalCents(d);
    if (!(total > 0)) return;
    const id = `${d.offeringId}-${d.date}-${Date.now().toString(36)}`;
    const wf = d.wf && d.wf.lp === total ? d.wf : null;
    W().runs.unshift(Object.assign({ id, offeringId: d.offeringId, date: d.date, type: d.type, total, status: d.date > today() ? 'scheduled' : 'paid', source: 'console', file: d.file ? d.file.filename : '' }, wf ? { gp: wf.gp, gross: wf.gross } : {}));
    audit('Distribution recorded', `${d.type}: ${usdc(total)} ${d.date > today() ? 'scheduled for' : 'paid'} ${date(d.date)}${wf ? ` (waterfall: ${usdc(wf.gross)} gross, ${usdc(wf.gp)} to the GP)` : ''}; ${d.file ? d.file.filename : 'no NACHA file'}`, d.offeringId, id);
    W().runs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    NS.app.save(true);
    const o = W().offerings.find((x) => x.id === d.offeringId);
    S().ui.dist = null;
    NS.app.render();
    U.toast(`${usdc(total)} distribution for ${o.shortName} recorded. Investors see it as ${d.date > today() ? 'scheduled' : 'paid'}.`);
  };
  NS.actions['dist-load'] = (el) => {
    const r = W().runs.find((x) => x.id === el.getAttribute('data-id'));
    if (!r) return;
    S().ui.dist = { offeringId: r.offeringId, type: r.type, date: r.date, mode: 'total', rate: '', total: (r.total / 100).toFixed(2), desc: T().ach.entryDescription || 'DISTRIB', file: null, line: null };
    const reason = NS.nacha.bankingDayReason(r.date);
    if (achReady() && !reason) {
      // Rebuilding a past date is allowed for reference; the checks flag the date.
      S().ui.dist.file = buildFile(S().ui.dist);
      S().ui.dist.line = 2;
    }
    NS.app.render();
    window.scrollTo(0, 0);
  };
  NS.actions['hist-all'] = () => {
    S().ui.histAll = true;
    NS.app.render();
  };

  /* ---------- Investor notices (mass email) ---------- */
  function latestQuarter() {
    const d = NS.dates.parse(today());
    let q = Math.floor(d.getUTCMonth() / 3);
    let y = d.getUTCFullYear();
    if (q === 0) {
      q = 4;
      y -= 1;
    }
    return `Q${q} ${y}`;
  }
  function quarterOptions() {
    const out = [];
    let [q, y] = latestQuarter().slice(1).split(' ').map(Number);
    for (let i = 0; i < 6; i++) {
      out.push(`Q${q} ${y}`);
      q -= 1;
      if (q === 0) {
        q = 4;
        y -= 1;
      }
    }
    return out;
  }
  function noticeDraft() {
    const ui = S().ui;
    if (!ui.notice) {
      const o = W().offerings.find((x) => x.status !== 'Exited' && holdersCount(x.id)) || W().offerings[0];
      ui.notice = { kind: 'quarterly', audience: o ? o.id : 'all', investors: [], pickerOpen: false, pickerQuery: '', includePending: true, quarter: latestQuarter(), docName: '', subject: '', body: '', subjectEdited: false, bodyEdited: false, confirm: false };
      applyTemplate(ui.notice);
    }
    return ui.notice;
  }
  function applyTemplate(n) {
    const tpl = NS.NOTICE_TEMPLATES[n.kind];
    if (!n.subjectEdited) n.subject = tpl.subject;
    if (!n.bodyEdited) n.body = tpl.body;
  }
  /** Chosen investors (any offering) take precedence over the Send to group. */
  function noticeRecipients(n) {
    if (n.investors.length) return W().investors.filter((inv) => n.investors.indexOf(inv.id) >= 0);
    return W().investors.filter((inv) => (n.audience === 'all' || inv.positions.some((p) => p.offeringId === n.audience)) && (n.includePending || inv.onboarding.status === 'complete'));
  }
  // {investment} for a recipient, given what the notice is about.
  const investmentFor = (inv, n) => NS.noticeInvestment(W(), inv, n.investors && n.investors.length ? { audience: 'all' } : n);
  function offeringNames(inv) {
    return W()
      .offerings.filter((o) => inv.positions.some((p) => p.offeringId === o.id))
      .map((o) => o.shortName || o.name)
      .join(', ');
  }
  /** Investor picker: search and check any number of investors across offerings. */
  function pickerList(n) {
    const q = String(n.pickerQuery || '').trim().toLowerCase();
    const rows = W()
      .investors.slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .filter((inv) => !q || [inv.title, inv.contact, inv.id, inv.email].join(' ').toLowerCase().indexOf(q) >= 0)
      .map(
        (inv) => `<label class="picker-item"><input type="checkbox" value="${h(inv.id)}" data-change="picker-pick"${n.investors.indexOf(inv.id) >= 0 ? ' checked' : ''}><span><strong>${h(inv.title)}</strong><span>${h(inv.id)} · ${h(offeringNames(inv))}${inv.onboarding.status !== 'complete' ? ' · not activated' : ''}</span></span></label>`
      )
      .join('');
    return rows || '<p class="cs-muted picker-empty">No investors match.</p>';
  }
  function pickerHTML(n) {
    const w = W();
    const chosen = n.investors.map((id) => w.investors.find((i) => i.id === id)).filter(Boolean);
    return `<div class="cs-field cs-wide picker" id="nt-picker">
      <span id="nt-picker-label">Specific investors <em>Optional</em></span>
      <button class="picker-btn" type="button" data-action="picker-toggle" aria-expanded="${!!n.pickerOpen}" aria-controls="nt-picker-panel" aria-describedby="nt-picker-label">${chosen.length ? `${chosen.length} investor${chosen.length === 1 ? '' : 's'} selected` : 'Choose investors'}<span aria-hidden="true">▾</span></button>
      ${
        n.pickerOpen
          ? `<div class="picker-panel" id="nt-picker-panel">
              <input type="search" id="nt-picker-q" placeholder="Search by name, account or email" value="${h(n.pickerQuery || '')}" data-input="picker-search" aria-label="Search investors" autocomplete="off">
              <div class="picker-list" id="nt-picker-list" role="group" aria-label="Investors">${pickerList(n)}</div>
              <div class="picker-foot"><button class="cs-btn cs-btn-small" type="button" data-action="picker-clear">Clear all</button><button class="cs-btn cs-btn-small cs-btn-primary" type="button" data-action="picker-toggle">Done</button></div>
            </div>`
          : ''
      }
      ${chosen.length ? `<ul class="picker-chips">${chosen.map((inv) => `<li>${h(inv.title)}<button type="button" data-action="picker-remove" data-id="${h(inv.id)}" aria-label="Remove ${h(inv.title)}">×</button></li>`).join('')}</ul>` : ''}
      <span class="cs-hint">Choose any investors, in any offering. When investors are chosen, the notice goes only to them.</span>
    </div>`;
  }
  function emailPreview(n, inv) {
    const t = T();
    if (!inv) return '<p class="cs-muted">No investors match this audience.</p>';
    const o = investmentFor(inv, n);
    const subject = NS.mergeNotice(n.subject, inv, t, n, o);
    const paras = NS.mergeNotice(n.body, inv, t, n, o)
      .split(/\n\s*\n/)
      .map((p) => `<p>${h(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
    return `<article class="email">
      <div class="email-head">${B.lockup(t)}</div>
      <div class="email-body">
        <p class="email-subject">To ${h(inv.email)}<br>Subject: ${h(subject) || '<em>No subject</em>'}</p>
        ${paras}
        <p><span class="email-btn">${inv.onboarding.status === 'complete' ? `Sign in to ${h(t.portalName)}` : 'Activate your account'}</span></p>
      </div>
      <div class="email-foot">${h(t.legalName)} · ${h(t.domain)} · You receive this because you are an investor of record.</div>
    </article>`;
  }
  NS.views['console-notices'] = {
    mode: 'console',
    render() {
      const w = W();
      const t = T();
      const n = noticeDraft();
      const list = noticeRecipients(n);
      const pending = list.filter((i) => i.onboarding.status !== 'complete').length;
      const offOpts = w.offerings.map((x) => `<option value="${h(x.id)}"${n.audience === x.id ? ' selected' : ''}>Investors in ${h(x.name)}</option>`).join('');
      const history = (w.notices || [])
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((x) => {
          const xo = x.audience === 'all' ? null : w.offerings.find((k) => k.id === x.audience);
          const sample = w.investors.find((i) => i.id === x.recipients[0]) || { contact: 'Investor', title: '', positions: [] };
          const picked = x.investors && x.investors.length ? x.investors : x.investor ? [x.investor] : [];
          const audience = picked.length ? (picked.length === 1 ? h((w.investors.find((i) => i.id === picked[0]) || { title: picked[0] }).title) : `${picked.length} selected investors`) : xo ? h(xo.shortName || xo.name) : 'All investors';
          return `<tr><td class="nowrap">${date(x.date)}</td><td>${h(NS.mergeNotice(x.subject, sample, t, x, NS.noticeInvestment(w, sample, picked.length ? { audience: 'all' } : x)))}</td><td>${audience}</td><td class="num">${x.recipients.length}</td><td>${x.sentByName ? h(x.sentByName) : x.sentBy === 'staff' ? (E.managed ? 'Carrow &amp; Vale' : `${h(t.shortName)} admin`) : h(t.shortName)}</td></tr>`;
        })
        .join('');
      return shell(
        `${head('Notices', 'Email investors when reports or documents are posted. Each email is personalized and also appears as a notice in the investor’s portal.')}
        <div class="cs-split">
          <div class="cs-split-main">
            ${panel(
              'New notice',
              `<div class="cs-grid">
                <label class="cs-field" for="nt-kind"><span>Template</span><select id="nt-kind" data-bind="notice:kind">${Object.keys(NS.NOTICE_TEMPLATES).map((k) => `<option value="${k}"${n.kind === k ? ' selected' : ''}>${NS.NOTICE_TEMPLATES[k].label}</option>`).join('')}</select></label>
                <label class="cs-field" for="nt-aud"><span>Send to</span><select id="nt-aud" data-bind="notice:audience"${n.investors.length ? ' disabled' : ''}><option value="all"${n.audience === 'all' ? ' selected' : ''}>All investors</option>${offOpts}</select>${n.investors.length ? '<span class="cs-hint">Not used while specific investors are chosen.</span>' : ''}</label>
                ${pickerHTML(n)}
                ${n.kind === 'quarterly' ? `<label class="cs-field" for="nt-q"><span>Quarter</span><select id="nt-q" data-bind="notice:quarter">${quarterOptions().map((q) => `<option${q === n.quarter ? ' selected' : ''}>${q}</option>`).join('')}</select></label>` : ''}
                ${n.kind === 'documents' ? `<label class="cs-field cs-wide" for="nt-docs"><span>What was uploaded</span><input id="nt-docs" type="text" data-bind="notice:docName" value="${h(n.docName)}" maxlength="120" placeholder="2025 Schedule K-1s"><span class="cs-hint">Fills {documents} in the message.</span></label>` : ''}
                ${n.investors.length ? '' : `<label class="cs-check cs-wide" for="nt-pending"><input id="nt-pending" type="checkbox" data-bind="notice:includePending"${n.includePending ? ' checked' : ''}><span>Include investors who have not activated their accounts<span class="cs-hint">Their email links to account activation instead of sign-in.</span></span></label>`}
                <label class="cs-field cs-wide" for="nt-subject"><span>Subject</span><input id="nt-subject" type="text" data-bind="notice:subject" value="${h(n.subject)}" maxlength="140"></label>
                <label class="cs-field cs-wide" for="nt-body"><span>Message</span><textarea id="nt-body" rows="9" data-bind="notice:body" maxlength="4000">${h(n.body)}</textarea><span class="cs-hint">Personalized for each investor: ${NS.MERGE_FIELDS.map((f) => `<code>{${f}}</code>`).join(' ')}</span></label>
              </div>
              <div class="cs-row">
                <button class="cs-btn cs-btn-primary" type="button" data-action="notice-send"${list.length ? '' : ' disabled'}>${n.confirm ? `Confirm: send to ${list.length} investor${list.length === 1 ? '' : 's'}` : `Send to ${list.length} investor${list.length === 1 ? '' : 's'}`}</button>
                ${n.confirm ? '<button class="cs-btn" type="button" data-action="notice-cancel">Cancel</button>' : ''}
                <span class="cs-hint" id="nt-count">${list.length} recipient${list.length === 1 ? '' : 's'}${pending ? `, ${pending} not yet activated` : ''}</span>
              </div>`
            )}
            ${panel('Sent notices', history ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Date</th><th scope="col">Subject</th><th scope="col">Audience</th><th scope="col" class="num">Recipients</th><th scope="col">Sent by</th></tr></thead><tbody>${history}</tbody></table></div>` : '<p class="cs-muted">No notices sent yet.</p>')}
          </div>
          <aside class="cs-split-side" id="nt-preview"><div class="pv"><p class="pv-label">Preview for ${list[0] ? h(list[0].contact) : '—'}</p>${emailPreview(n, list[0])}</div></aside>
        </div>`,
        'console-notices'
      );
    }
  };
  NS.binders.notice = (path, v) => {
    const n = noticeDraft();
    n[path] = v;
    n.confirm = false;
    if (path === 'subject') n.subjectEdited = true;
    if (path === 'body') n.bodyEdited = true;
    if (path === 'kind') {
      n.subjectEdited = false;
      n.bodyEdited = false;
      applyTemplate(n);
      if (v === 'quarterly' && n.audience === 'all') {
        const o = W().offerings.find((x) => x.status !== 'Exited' && holdersCount(x.id));
        if (o) n.audience = o.id;
      }
    }
    if (path === 'subject' || path === 'body' || path === 'docName') {
      // Keep the cursor in the field: refresh only the preview.
      const list = noticeRecipients(n);
      const pv = document.getElementById('nt-preview');
      if (pv) pv.innerHTML = `<div class="pv"><p class="pv-label">Preview for ${list[0] ? h(list[0].contact) : '—'}</p>${emailPreview(n, list[0])}</div>`;
      const btn = document.querySelector('[data-action="notice-send"]');
      if (btn) btn.textContent = `Send to ${list.length} investor${list.length === 1 ? '' : 's'}`;
      return;
    }
    NS.app.render();
  };
  NS.actions['notice-send'] = () => {
    const n = noticeDraft();
    const list = noticeRecipients(n);
    if (!list.length) return;
    if (!String(n.subject).trim() || !String(n.body).trim()) {
      U.toast('Add a subject and a message before sending.');
      return;
    }
    if (!n.confirm) {
      n.confirm = true;
      NS.app.render();
      return;
    }
    const w = W();
    w.notices = w.notices || [];
    const nid = 'n-' + Date.now().toString(36);
    audit('Notice sent', `“${short(n.subject)}” to ${list.length} investor${list.length === 1 ? '' : 's'}`, n.investors.length || n.audience === 'all' ? '' : n.audience, nid);
    w.notices.push({ id: nid, date: today(), kind: n.kind, audience: n.investors.length ? 'all' : n.audience, investors: n.investors.slice(), includePending: n.includePending, quarter: n.quarter, docName: n.docName, subject: n.subject, body: n.body, recipients: list.map((i) => i.id), sentBy: canConfigure() ? 'staff' : 'sponsor', sentByName: NS.app.actor() });
    NS.app.save(true);
    S().ui.notice = null;
    NS.app.render();
    U.toast(`Notice posted to ${list.length} investor portal${list.length === 1 ? '' : 's'}. Email delivery is not connected in this demo.`);
  };
  NS.actions['picker-toggle'] = () => {
    const n = noticeDraft();
    n.pickerOpen = !n.pickerOpen;
    NS.app.render();
    const el = document.getElementById(n.pickerOpen ? 'nt-picker-q' : 'nt-picker');
    if (el && n.pickerOpen) el.focus();
    else {
      const b = document.querySelector('.picker-btn');
      if (b) b.focus();
    }
  };
  NS.changes['picker-search'] = (el) => {
    const n = noticeDraft();
    n.pickerQuery = el.value;
    const list = document.getElementById('nt-picker-list');
    if (list) list.innerHTML = pickerList(n);
  };
  NS.changes['picker-pick'] = (el) => {
    const n = noticeDraft();
    const id = el.value;
    n.investors = el.checked ? n.investors.concat(n.investors.indexOf(id) >= 0 ? [] : [id]) : n.investors.filter((x) => x !== id);
    n.confirm = false;
    NS.app.render();
    const again = document.querySelector(`.picker-item input[value="${id}"]`);
    if (again) again.focus({ preventScroll: true });
  };
  NS.actions['picker-remove'] = (el) => {
    const n = noticeDraft();
    n.investors = n.investors.filter((x) => x !== el.getAttribute('data-id'));
    n.confirm = false;
    NS.app.render();
  };
  NS.actions['picker-clear'] = () => {
    const n = noticeDraft();
    n.investors = [];
    n.confirm = false;
    NS.app.render();
  };
  NS.actions['notice-cancel'] = () => {
    noticeDraft().confirm = false;
    NS.app.render();
  };

  /* ---------- Reports: distributions for any period, investor contacts ---------- */
  /** CSV cell: quoted when needed; text that could run as a spreadsheet formula is neutralized. */
  function csvCell(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const dollars = (c) => Math.round(c) / 100;
  const slug = () => String(T().shortName || T().name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

  function presetRange(preset) {
    const now = today();
    const d = NS.dates.parse(now);
    const y = d.getUTCFullYear();
    const q = Math.floor(d.getUTCMonth() / 3);
    const iso = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const qEnd = (yy, qq) => NS.dates.isoOf(new Date(Date.UTC(yy, qq * 3 + 3, 0)));
    switch (preset) {
      case 'this-quarter':
        return [iso(y, q * 3 + 1, 1), now];
      case 'last-quarter': {
        const lq = q === 0 ? 3 : q - 1;
        const ly = q === 0 ? y - 1 : y;
        return [iso(ly, lq * 3 + 1, 1), qEnd(ly, lq)];
      }
      case 'last-year':
        return [iso(y - 1, 1, 1), iso(y - 1, 12, 31)];
      case 'last-12':
        return [NS.dates.addMonths(now, -12), now];
      case 'inception': {
        const first = W().runs.map((r) => r.date).sort()[0];
        return [first || iso(y, 1, 1), now];
      }
      default:
        return [iso(y, 1, 1), now];
    }
  }
  const PERIODS = [
    ['this-quarter', 'This quarter'],
    ['last-quarter', 'Last quarter'],
    ['ytd', 'Year to date'],
    ['last-year', 'Last calendar year'],
    ['last-12', 'Last 12 months'],
    ['inception', 'Since inception'],
    ['custom', 'Custom dates']
  ];
  function repState() {
    const ui = S().ui;
    if (!ui.rep) {
      const [from, to] = presetRange('ytd');
      ui.rep = { tab: 'dist', preset: 'ytd', from, to, offering: 'all', view: 'investor', scheduled: false, con: { offering: 'all', status: 'all', pay: 'all' } };
    }
    return ui.rep;
  }
  /** Every investor's share of every payment in the period. */
  function distRows(r) {
    const w = W();
    const rows = [];
    w.runs
      .filter((run) => run.date >= r.from && run.date <= r.to && (r.offering === 'all' || run.offeringId === r.offering) && (r.scheduled || run.status === 'paid'))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .forEach((run) => {
        const o = w.offerings.find((x) => x.id === run.offeringId) || { name: run.offeringId, shortName: run.offeringId };
        NS.data.allocate(w, run).forEach((a) => {
          if (a.cents > 0) rows.push({ run, o, inv: a.investor, cents: a.cents });
        });
      });
    return rows;
  }
  const payMethod = (inv) => (inv.payment && inv.payment.method === 'ach' ? 'ACH' : 'Check');
  function distTable(r, rows) {
    const LIMIT = 200;
    if (!rows.length) return { html: '<p class="cs-muted">No distributions in this period.</p>', csv: null };
    let head;
    let body;
    let csvRows;
    let foot;
    const total = rows.reduce((a, x) => a + x.cents, 0);
    if (r.view === 'payment') {
      head = ['Payment date', 'Offering', 'Investor', 'Account', 'Type', 'Paid by', 'Amount'];
      body = rows.map((x) => [date(x.run.date), h(x.o.shortName || x.o.name), h(x.inv.title), h(x.inv.id), h(x.run.type), payMethod(x.inv), usdc(x.cents)]);
      csvRows = [['Payment date', 'Offering', 'Investor', 'Account', 'Contact', 'Type', 'Status', 'Paid by', 'Amount']].concat(
        rows.map((x) => [x.run.date, x.o.name, x.inv.title, x.inv.id, x.inv.contact, x.run.type, x.run.status === 'paid' ? 'Paid' : 'Scheduled', payMethod(x.inv), dollars(x.cents)])
      );
      foot = [`${rows.length} payments`, '', '', '', '', '', usdc(total)];
    } else if (r.view === 'offering') {
      const map = {};
      rows.forEach((x) => {
        const k = x.o.name;
        if (!map[k]) map[k] = { name: k, runs: new Set(), inv: new Set(), cents: 0 };
        map[k].runs.add(x.run.id);
        map[k].inv.add(x.inv.id);
        map[k].cents += x.cents;
      });
      const list = Object.values(map).sort((a, b) => b.cents - a.cents);
      head = ['Offering', 'Payments', 'Investors paid', 'Amount'];
      body = list.map((g) => [h(g.name), g.runs.size, g.inv.size, usdc(g.cents)]);
      csvRows = [['Offering', 'Payments', 'Investors paid', 'Amount']].concat(list.map((g) => [g.name, g.runs.size, g.inv.size, dollars(g.cents)]));
      foot = ['Total', list.reduce((a, g) => a + g.runs.size, 0), new Set(rows.map((x) => x.inv.id)).size, usdc(total)];
    } else {
      const map = {};
      rows.forEach((x) => {
        const k = x.inv.id;
        if (!map[k]) map[k] = { inv: x.inv, offs: new Set(), n: 0, cents: 0 };
        map[k].offs.add(x.o.shortName || x.o.name);
        map[k].n += 1;
        map[k].cents += x.cents;
      });
      const list = Object.values(map).sort((a, b) => a.inv.title.localeCompare(b.inv.title));
      head = ['Investor', 'Account', 'Offerings', 'Payments', 'Paid by', 'Amount'];
      body = list.map((g) => [h(g.inv.title), h(g.inv.id), h(Array.from(g.offs).join(', ')), g.n, payMethod(g.inv), usdc(g.cents)]);
      csvRows = [['Investor', 'Account', 'Contact', 'Email', 'Offerings', 'Payments', 'Paid by', 'Amount']].concat(
        list.map((g) => [g.inv.title, g.inv.id, g.inv.contact, g.inv.email, Array.from(g.offs).join('; '), g.n, payMethod(g.inv), dollars(g.cents)])
      );
      foot = [`${list.length} investors`, '', '', list.reduce((a, g) => a + g.n, 0), '', usdc(total)];
    }
    const numCols = (i) => (typeof body[0][i] === 'number' || /^\$/.test(String(body[0][i])) || head[i] === 'Amount' ? ' class="num"' : '');
    const shown = body.slice(0, LIMIT);
    const html = `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact">
        <thead><tr>${head.map((x, i) => `<th scope="col"${numCols(i)}>${x}</th>`).join('')}</tr></thead>
        <tbody>${shown.map((row) => `<tr>${row.map((c, i) => `<td${numCols(i)}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr class="cs-total">${foot.map((c, i) => `<td${numCols(i)}>${c}</td>`).join('')}</tr></tfoot>
      </table></div>${body.length > LIMIT ? `<p class="cs-hint">Showing the first ${LIMIT} of ${body.length} rows. The CSV includes all of them.</p>` : ''}`;
    return { html, csv: toCsv(csvRows) };
  }
  function contactRows(c) {
    return W()
      .investors.filter(
        (inv) =>
          (c.offering === 'all' || inv.positions.some((p) => p.offeringId === c.offering)) &&
          (c.status === 'all' || (c.status === 'active' ? inv.onboarding.status === 'complete' : inv.onboarding.status !== 'complete')) &&
          (c.pay === 'all' || payMethod(inv).toLowerCase() === c.pay)
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  const statusText = (inv) => (inv.onboarding.status === 'complete' ? 'Active' : inv.onboarding.status === 'in_progress' ? 'Activation in progress' : 'Invited');
  const offeringsOf = (inv) =>
    W()
      .offerings.filter((o) => inv.positions.some((p) => p.offeringId === o.id))
      .map((o) => o.shortName || o.name);

  NS.views['console-reports'] = {
    mode: 'console',
    render() {
      const w = W();
      const r = repState();
      const c = r.con;
      const offSel = (bind, val) => `<select id="${bind.replace(/[:.]/g, '-')}" data-bind="${bind}"><option value="all">All offerings</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${val === o.id ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select>`;
      let body;
      if (r.tab === 'dist') {
        const rows = distRows(r);
        const t = distTable(r, rows);
        S().ui.repCsv = t.csv;
        const total = rows.reduce((a, x) => a + x.cents, 0);
        body = panel(
          '',
          `<div class="cs-grid cs-grid-3">
            <label class="cs-field" for="rep-preset"><span>Period</span><select id="rep-preset" data-bind="rep:preset">${PERIODS.map(([k, l]) => `<option value="${k}"${r.preset === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="cs-field" for="rep-from"><span>From</span><input id="rep-from" type="date" data-bind="rep:from" value="${h(r.from)}"></label>
            <label class="cs-field" for="rep-to"><span>To</span><input id="rep-to" type="date" data-bind="rep:to" value="${h(r.to)}"></label>
            <label class="cs-field" for="rep-offering"><span>Offering</span>${offSel('rep:offering', r.offering)}</label>
            <fieldset class="cs-field"><legend>View</legend><div class="cs-seg">${[['investor', 'By investor'], ['payment', 'By payment'], ['offering', 'By offering']]
              .map(([k, l]) => `<label><input type="radio" name="rep-view" value="${k}" data-bind="rep:view"${r.view === k ? ' checked' : ''}><span>${l}</span></label>`)
              .join('')}</div></fieldset>
            <label class="cs-check" for="rep-sched"><input id="rep-sched" type="checkbox" data-bind="rep:scheduled"${r.scheduled ? ' checked' : ''}><span>Include scheduled payments</span></label>
          </div>
          <div class="cs-row cs-report-bar">
            <p class="cs-report-sum"><strong>${usdc(total)}</strong> in ${new Set(rows.map((x) => x.run.id)).size} payments to ${new Set(rows.map((x) => x.inv.id)).size} investors · ${date(r.from)} to ${date(r.to)}</p>
            <button class="cs-btn cs-btn-primary" type="button" data-action="rep-csv"${t.csv ? '' : ' disabled'}>${icon('download')}Download CSV</button>
          </div>
          ${t.html}`
        );
      } else {
        const list = contactRows(c);
        S().ui.conList = list;
        body = panel(
          '',
          `<div class="cs-grid cs-grid-3">
            <label class="cs-field" for="con-offering"><span>Offering</span>${offSel('con:offering', c.offering)}</label>
            <label class="cs-field" for="con-status"><span>Account status</span><select id="con-status" data-bind="con:status"><option value="all"${c.status === 'all' ? ' selected' : ''}>All investors</option><option value="active"${c.status === 'active' ? ' selected' : ''}>Active accounts</option><option value="pending"${c.status === 'pending' ? ' selected' : ''}>Not yet activated</option></select></label>
            <label class="cs-field" for="con-pay"><span>Paid by</span><select id="con-pay" data-bind="con:pay"><option value="all"${c.pay === 'all' ? ' selected' : ''}>ACH or check</option><option value="ach"${c.pay === 'ach' ? ' selected' : ''}>ACH</option><option value="check"${c.pay === 'check' ? ' selected' : ''}>Check</option></select></label>
          </div>
          <div class="cs-row cs-report-bar">
            <p class="cs-report-sum"><strong>${list.length}</strong> investor${list.length === 1 ? '' : 's'}</p>
            <button class="cs-btn" type="button" data-action="con-emails"${list.length ? '' : ' disabled'}>${icon('copy')}Copy emails</button>
            <button class="cs-btn cs-btn-primary" type="button" data-action="con-csv"${list.length ? '' : ' disabled'}>${icon('download')}Download CSV</button>
          </div>
          ${
            list.length
              ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Investor</th><th scope="col">Contact</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Mailing address</th><th scope="col">Offerings</th><th scope="col">Status</th></tr></thead><tbody>${list
                  .map((inv) => `<tr><td><span class="strong">${h(inv.title)}</span><span class="sub">${h(inv.id)}</span></td><td>${h(inv.contact)}</td><td>${h(inv.email)}</td><td class="nowrap">${h(inv.phone || '—')}</td><td>${h(inv.address || '—')}</td><td>${h(offeringsOf(inv).join(', '))}</td><td>${statusText(inv)}</td></tr>`)
                  .join('')}</tbody></table></div>`
              : '<p class="cs-muted">No investors match these filters.</p>'
          }
          <p class="cs-hint" id="con-emails-text" hidden></p>
          <p class="cs-hint">Bank account numbers and taxpayer IDs are never included in contact exports.</p>`
        );
      }
      return shell(
        `${head('Reports', 'Distribution reports for any period and investor contact lists. Downloads are CSV files that open in Excel.')}
        <div class="cs-tabs" role="group" aria-label="Report"><button type="button" class="cs-tab" data-action="rep-tab" data-t="dist" aria-pressed="${r.tab === 'dist'}">Distributions</button><button type="button" class="cs-tab" data-action="rep-tab" data-t="contacts" aria-pressed="${r.tab === 'contacts'}">Contacts</button></div>
        ${body}`,
        'console-reports'
      );
    }
  };
  NS.binders.rep = (path, v) => {
    const r = repState();
    r[path] = v;
    if (path === 'preset' && v !== 'custom') [r.from, r.to] = presetRange(v);
    if (path === 'from' || path === 'to') {
      r.preset = 'custom';
      if (r.from && r.to && r.from > r.to) [r.from, r.to] = [r.to, r.from];
    }
    NS.app.render();
  };
  NS.binders.con = (path, v) => {
    repState().con[path] = v;
    NS.app.render();
  };
  NS.actions['rep-tab'] = (el) => {
    repState().tab = el.getAttribute('data-t');
    NS.app.render();
  };
  NS.actions['rep-csv'] = () => {
    const r = repState();
    if (!S().ui.repCsv) return;
    const off = r.offering === 'all' ? '' : '_' + String((W().offerings.find((o) => o.id === r.offering) || {}).shortName || r.offering).replace(/[^A-Za-z0-9]+/g, '_');
    U.download(`${slug()}_distributions${off}_${r.view}_${r.from}_to_${r.to}.csv`, S().ui.repCsv, { mime: 'text/csv' });
  };
  NS.actions['con-csv'] = () => {
    const list = S().ui.conList || [];
    const rows = [['Investor', 'Account', 'Contact', 'Email', 'Phone', 'Mailing address', 'Investing as', 'Offerings', 'Invested', 'Committed', 'Account status', 'Paid by']].concat(
      list.map((inv) => [inv.title, inv.id, inv.contact, inv.email, inv.phone || '', inv.address || '', (NS.ENTITY_TYPES[inv.type] || {}).label || inv.type, offeringsOf(inv).join('; '), inv.positions.reduce((a, p) => a + p.amount, 0), committedCents(inv) / 100, statusText(inv), payMethod(inv)])
    );
    U.download(`${slug()}_investor_contacts_${today()}.csv`, toCsv(rows), { mime: 'text/csv' });
  };
  NS.actions['con-emails'] = () => {
    const list = S().ui.conList || [];
    const text = list.map((inv) => inv.email).join('; ');
    const holder = document.getElementById('con-emails-text');
    if (holder) {
      holder.textContent = text;
      holder.hidden = false;
    }
    U.copy(text, holder);
  };

  /* ---------- Capital calls ---------- */
  const OPS = () => NS.ops;
  const invById = (id) => W().investors.find((i) => i.id === id);
  const offById = (id) => W().offerings.find((o) => o.id === id);
  const badge = (cls, text) => `<span class="cs-badge cs-badge-${cls}">${h(text)}</span>`;
  function callState() {
    const u = S().ui;
    if (!u.calls) u.calls = { view: 'list', draft: null };
    return u.calls;
  }
  /** Notice the offering's documents give for capital calls (business days), else the usual 10. */
  const callDays = (o) => Number(((o && o.structure) || {}).callNoticeDays) || 10;
  function callDraft() {
    const c = callState();
    if (!c.draft) {
      const o = OPS().callable(W())[0];
      c.draft = { offeringId: o ? o.id : '', mode: 'pct', pct: 10, amount: '', due: OPS().businessDays(today(), callDays(o)), purpose: 'Portfolio investments and fund expenses', note: '' };
    }
    return c.draft;
  }
  const PURPOSES = ['Portfolio investments and fund expenses', 'New portfolio investment', 'Follow-on investments', 'Management fees', 'Fund expenses', 'Initial closing: investments and organizational expenses'];
  function callBadge(st) {
    return st.key === 'complete' ? badge('ok', 'Fully funded') : st.key === 'overdue' ? badge('bad', `${st.overdue} overdue`) : badge('warn', `${st.count} outstanding`);
  }
  function callList() {
    const w = W();
    const calls = (w.calls || []).slice().sort((a, b) => (a.noticeDate < b.noticeDate ? 1 : a.noticeDate > b.noticeDate ? -1 : b.number - a.number));
    const funds = w.offerings.filter((o) => !OPS().isOpen(o) && OPS().callsFor(w, o).length + (OPS().callable(w).indexOf(o) >= 0 ? 1 : 0) > 0);
    const fundRows = funds
      .map((o) => {
        const hold = w.investors.filter((i) => i.positions.some((p) => p.offeringId === o.id));
        const commit = hold.reduce((a, i) => a + OPS().commitOf(i, o), 0);
        const paid = hold.reduce((a, i) => a + OPS().paidInOf(i, o), 0);
        return `<tr><th scope="row">${h(o.name)}<span class="sub">${h(o.type)}</span></th><td class="num">${usdc(commit)}</td><td class="num">${usdc(paid)}</td><td class="num">${commit ? ((paid / commit) * 100).toFixed(1) + '%' : '—'}</td><td class="num">${usdc(Math.max(0, commit - paid))}</td></tr>`;
      })
      .join('');
    const rows = calls
      .map((c) => {
        const o = offById(c.offeringId);
        const st = OPS().callStatus(c);
        const recv = c.items.filter((it) => it.received).reduce((a, it) => a + it.cents, 0);
        const total = c.items.reduce((a, it) => a + it.cents, 0);
        return `<tr><th scope="row"><button class="link-btn" type="button" data-action="call-open" data-id="${h(c.id)}">${h(o ? o.shortName || o.name : c.offeringId)} · Call ${c.number}</button><span class="sub">${h(c.purpose)}</span></th><td class="nowrap">${date(c.noticeDate)}</td><td class="nowrap">${date(c.due)}</td><td class="num">${usdc(total)}</td><td class="num">${usdc(recv)}<span class="sub">${c.items.filter((it) => it.received).length} of ${c.items.length} investors</span></td><td>${callBadge(st)}</td></tr>`;
      })
      .join('');
    const can = OPS().callable(w).length > 0;
    return shell(
      `${head('Capital calls', 'Call capital from investors in drawdown funds. Each investor’s share is pro rata to their commitment; investors get the notice and wire instructions in their portal, and every payment is tracked until the call is fully funded.', can ? '<button class="cs-btn cs-btn-primary" type="button" data-action="call-new">New capital call</button>' : '')}
      ${funds.length ? panel('Commitments', `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Fund</th><th scope="col" class="num">Commitments</th><th scope="col" class="num">Contributed</th><th scope="col" class="num">Called</th><th scope="col" class="num">Unfunded</th></tr></thead><tbody>${fundRows}</tbody></table></div>`) : ''}
      ${panel('Calls', calls.length ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Call</th><th scope="col">Notice</th><th scope="col">Due</th><th scope="col" class="num">Amount</th><th scope="col" class="num">Received</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="cs-muted">No capital calls yet.${can ? '' : ' Capital calls apply to closed-end funds whose investors have unfunded commitments.'}</p>`)}`,
      'console-calls'
    );
  }
  function callNew() {
    const w = W();
    const d = callDraft();
    const funds = OPS().callable(w);
    const o = offById(d.offeringId) || funds[0];
    if (!o) return callList();
    const pv = OPS().previewCall(w, o, d.mode === 'pct' ? { pct: (Number(d.pct) || 0) / 100 } : { cents: Math.round((Number(d.amount) || 0) * 100) });
    const ok = pv.total > 0 && !pv.over.length && d.due >= today();
    const rows = pv.rows
      .map((r) => `<tr${r.after < 0 ? ' class="is-bad"' : ''}><td>${h(r.inv.title)}<span class="sub">${h(r.inv.id)}</span></td><td class="num">${usdc(r.commit)}</td><td class="num">${usdc(r.before)}</td><td class="num strong">${usdc(r.cents)}</td><td class="num">${r.after < 0 ? `<span class="cs-error">Over by ${usdc(-r.after)}</span>` : usdc(r.after)}</td></tr>`)
      .join('');
    return shell(
      `<button class="cs-back link-btn" type="button" data-action="call-back">${icon('back')}Capital calls</button>
      ${head('New capital call', `${h(o.name)} · unfunded commitments ${usdc(OPS().unfunded(w, o))}`)}
      ${panel(
        '',
        `<div class="cs-grid cs-grid-3">
          <label class="cs-field cs-wide" for="cl-off"><span>Fund</span><select id="cl-off" data-bind="call:offeringId">${funds.map((x) => `<option value="${h(x.id)}"${x.id === o.id ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select></label>
          <fieldset class="cs-field"><legend>Call amount</legend><div class="cs-seg">${[['pct', '% of commitments'], ['amount', 'Dollar amount']].map(([k, l]) => `<label><input type="radio" name="cl-mode" value="${k}" data-bind="call:mode"${d.mode === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
          ${d.mode === 'pct' ? `<label class="cs-field" for="cl-pct"><span>Percent of commitments</span><input id="cl-pct" type="number" min="0" max="100" step="0.5" data-bind="call:pct" value="${h(d.pct)}"></label>` : `<label class="cs-field" for="cl-amt"><span>Total amount ($)</span><input id="cl-amt" type="number" min="0" step="1000" data-bind="call:amount" value="${h(d.amount)}"></label>`}
          <label class="cs-field" for="cl-due"><span>Due date</span><input id="cl-due" type="date" data-bind="call:due" value="${h(d.due)}"><span class="cs-hint">${(() => {
            const oc = W().offerings.find((x) => x.id === d.offeringId);
            return oc && oc.structure && oc.structure.callNoticeDays ? `This offering’s documents give ${oc.structure.callNoticeDays} days’ notice.` : 'Usually 10 business days after the notice.';
          })()}</span></label>
          <label class="cs-field" for="cl-purpose"><span>Purpose</span><select id="cl-purpose" data-bind="call:purpose">${PURPOSES.map((x) => `<option${x === d.purpose ? ' selected' : ''}>${h(x)}</option>`).join('')}</select></label>
          <label class="cs-field cs-wide" for="cl-note"><span>Note to investors <em>Optional</em></span><textarea id="cl-note" rows="2" maxlength="400" data-bind="call:note">${h(d.note)}</textarea></label>
        </div>
        <div class="cs-row cs-report-bar"><p class="cs-report-sum"><strong>${usdc(pv.total)}</strong> from ${pv.rows.filter((r) => r.cents > 0).length} investors · ${(pv.pct * 100).toFixed(2)}% of ${usdc(pv.totalCommit)} committed</p>
          <button class="cs-btn cs-btn-primary" type="button" data-action="call-issue"${ok ? '' : ' disabled'}>Issue call and notify investors</button></div>
        ${pv.over.length ? `<p class="cs-error">This call is larger than ${pv.over.length} investor${pv.over.length === 1 ? '’s' : 's’'} unfunded commitment. Reduce the amount.</p>` : ''}
        ${d.due < today() ? '<p class="cs-error">The due date is in the past.</p>' : ''}`
      )}
      ${panel('Allocation by investor', `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Investor</th><th scope="col" class="num">Commitment</th><th scope="col" class="num">Unfunded before</th><th scope="col" class="num">This call</th><th scope="col" class="num">Unfunded after</th></tr></thead><tbody>${rows}</tbody></table></div>`)}`,
      'console-calls'
    );
  }
  function callDetail(id) {
    const w = W();
    const c = (w.calls || []).find((x) => x.id === id);
    if (!c) return callList();
    const o = offById(c.offeringId);
    const st = OPS().callStatus(c);
    const total = c.items.reduce((a, it) => a + it.cents, 0);
    const recv = c.items.filter((it) => it.received).reduce((a, it) => a + it.cents, 0);
    const sample = invById(c.items[0] && c.items[0].investorId);
    const wi = sample ? OPS().wire(w, o, sample, c) : null;
    const rows = c.items
      .slice()
      .sort((a, b) => (a.received ? 1 : 0) - (b.received ? 1 : 0) || (a.investorId < b.investorId ? -1 : 1))
      .map((it) => {
        const inv = invById(it.investorId);
        const late = !it.received && today() > c.due;
        return `<tr><td>${h(inv ? inv.title : it.investorId)}<span class="sub">${h(it.investorId)}</span></td><td class="num">${usdc(it.cents)}</td><td>${it.received ? badge('ok', `Received ${date(it.received)}`) : late ? badge('bad', 'Overdue') : badge('warn', 'Outstanding')}${it.reminders && it.reminders.length ? `<span class="sub">Reminded ${date(it.reminders[it.reminders.length - 1])}</span>` : ''}</td><td class="num">${it.received ? '' : `<button class="cs-btn cs-btn-small" type="button" data-action="call-receive" data-call="${h(c.id)}" data-inv="${h(it.investorId)}">Record payment</button>`}</td></tr>`;
      })
      .join('');
    return shell(
      `<button class="cs-back link-btn" type="button" data-action="call-back">${icon('back')}Capital calls</button>
      ${head(`${h(o ? o.name : c.offeringId)} · Call ${c.number}`, `${h(c.purpose)} · notice ${date(c.noticeDate)} · due ${date(c.due)}`, st.out ? `<button class="cs-btn" type="button" data-action="call-remind" data-id="${h(c.id)}">Send reminder to ${st.count} investor${st.count === 1 ? '' : 's'}</button><button class="cs-btn" type="button" data-action="call-receive-all" data-id="${h(c.id)}">Record all as received</button>` : '')}
      <dl class="cs-figs">
        <div><dt>Called</dt><dd>${usdc(total)}</dd></div>
        <div><dt>Received</dt><dd>${usdc(recv)}</dd></div>
        <div><dt>Outstanding</dt><dd>${usdc(total - recv)}</dd></div>
        <div><dt>Status</dt><dd>${callBadge(st)}</dd></div>
      </dl>
      ${panel('Payments', `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Investor</th><th scope="col" class="num">Amount</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${rows}</tbody></table></div><p class="cs-hint">Recording a payment adds the contribution to the investor’s capital account and the audit schedules, and writes a change-log entry.</p>`)}
      ${wi ? panel('Wire instructions investors see', `<dl class="cs-kv"><div><dt>Bank</dt><dd>${h(wi.bank)}</dd></div><div><dt>ABA routing</dt><dd>${h(wi.aba)}</dd></div><div><dt>Account</dt><dd>${h(wi.account)}</dd></div><div><dt>Beneficiary</dt><dd>${h(wi.beneficiary)}</dd></div><div><dt>Reference</dt><dd>${h(o.shortName || o.name)} call ${c.number}, investor ID</dd></div></dl><p class="cs-hint">The notice tells investors to confirm instructions by phone before wiring and that instructions are never changed by email.</p>`) : ''}`,
      'console-calls'
    );
  }
  NS.views['console-calls'] = {
    mode: 'console',
    render() {
      const c = callState();
      if (c.view === 'new') return callNew();
      if (c.view && c.view !== 'list') return callDetail(c.view);
      return callList();
    }
  };
  NS.binders.call = (path, v) => {
    const d = callDraft();
    d[path] = v;
    if (path === 'offeringId') d.due = OPS().businessDays(today(), callDays(W().offerings.find((x) => x.id === v)));
    if (path === 'offeringId' || path === 'mode' || path === 'due' || path === 'purpose') NS.app.render();
    else {
      clearTimeout(S().ui.callT);
      S().ui.callT = setTimeout(() => NS.app.render(), 350);
    }
  };
  NS.actions['call-new'] = () => {
    callState().view = 'new';
    callState().draft = null;
    NS.app.render();
  };
  NS.actions['call-back'] = () => {
    callState().view = 'list';
    NS.app.render();
  };
  NS.actions['call-open'] = (el) => {
    callState().view = el.getAttribute('data-id');
    NS.app.render();
  };
  NS.actions['call-issue'] = () => {
    const d = callDraft();
    const o = offById(d.offeringId) || OPS().callable(W())[0];
    if (!o) return;
    const call = OPS().issueCall(W(), o, Object.assign({ due: d.due, purpose: d.purpose, note: d.note }, d.mode === 'pct' ? { pct: (Number(d.pct) || 0) / 100 } : { cents: Math.round((Number(d.amount) || 0) * 100) }));
    if (!call) return U.toast('Check the call amount.');
    callState().view = call.id;
    callState().draft = null;
    NS.app.render();
    U.toast(`Call ${call.number} issued: ${usdc(call.total)} due ${date(call.due)}. Investors see the notice and wire instructions in their portals.`);
  };
  NS.actions['call-receive'] = (el) => {
    const c = (W().calls || []).find((x) => x.id === el.getAttribute('data-call'));
    if (c && OPS().receive(W(), c, el.getAttribute('data-inv'))) NS.app.render();
  };
  NS.actions['call-receive-all'] = (el) => {
    const c = (W().calls || []).find((x) => x.id === el.getAttribute('data-id'));
    if (!c) return;
    c.items.filter((it) => !it.received).forEach((it) => OPS().receive(W(), c, it.investorId));
    NS.app.render();
  };
  NS.actions['call-remind'] = (el) => {
    const c = (W().calls || []).find((x) => x.id === el.getAttribute('data-id'));
    const n = c ? OPS().remind(W(), c) : 0;
    if (n) {
      NS.app.render();
      U.toast(`Reminder posted to ${n} investor portal${n === 1 ? '' : 's'}.`);
    }
  };

  /* ---------- Investor requests: redemptions and subscriptions ---------- */
  function reqLabel(r, o) {
    if (r.type === 'redemption') return `Redemption: ${r.full ? 'full' : usdc(r.cents || 0)}`;
    return `${r.additional ? 'Additional subscription' : OPS().isOpen(o) ? 'Subscription' : 'New commitment'}: ${usdc(r.cents)}`;
  }
  function reqStatus(r) {
    return { pending: badge('warn', 'Pending review'), approved: badge('adj', 'Approved'), rejected: badge('mute', 'Declined'), paid: badge('ok', `Paid ${date(r.paid)}`), funded: badge('ok', 'Funded'), accepted: badge('ok', 'Accepted') }[r.status] || badge('mute', r.status);
  }
  NS.views['console-requests'] = {
    mode: 'console',
    render() {
      const w = W();
      const tab = S().ui.reqTab || 'pending';
      const all = (w.requests || []).slice().sort((a, b) => (a.submitted < b.submitted ? 1 : -1));
      const open = all.filter((r) => r.status === 'pending' || r.status === 'approved');
      const list = tab === 'pending' ? open : all;
      const lastEnd = NS.audit.lastMonthEnd(today());
      const rows = list
        .map((r) => {
          const o = offById(r.offeringId);
          const inv = invById(r.investorId);
          if (!o || !inv) return '';
          let est = '';
          if (r.type === 'redemption') {
            const amt = OPS().redemptionAmount(w, r);
            const cap = OPS().capital(w, inv, o, lastEnd.slice(0, 8) + '01', lastEnd);
            est = amt != null ? usdc(amt) : r.full && cap ? `~${usdc(cap.a.end)}` : '';
          }
          let act = '';
          if (r.status === 'pending') act = `<button class="cs-btn cs-btn-small cs-btn-primary" type="button" data-action="req-approve" data-id="${h(r.id)}">Approve</button> <button class="cs-btn cs-btn-small" type="button" data-action="req-decline" data-id="${h(r.id)}">Decline</button>`;
          else if (r.status === 'approved' && r.type === 'redemption') act = r.dealing <= lastEnd ? `<button class="cs-btn cs-btn-small" type="button" data-action="req-paid" data-id="${h(r.id)}">Record payment</button>` : `<span class="sub">Payable after ${date(r.dealing)}</span>`;
          else if (r.status === 'approved') act = `<button class="cs-btn cs-btn-small" type="button" data-action="req-funded" data-id="${h(r.id)}">${OPS().isOpen(o) ? 'Record funding' : 'Countersign'}</button>`;
          return `<tr><td class="nowrap">${date(r.submitted)}</td><td>${h(inv.title)}<span class="sub">${h(inv.id)}</span></td><td>${h(o.shortName || o.name)}</td><td>${h(reqLabel(r, o))}<span class="sub">E-signed by ${h(r.signedBy || inv.contact)}</span></td><td class="nowrap">${r.dealing ? date(r.dealing) : '—'}<span class="sub">${r.type === 'redemption' ? 'Dealing date' : OPS().isOpen(o) ? 'Effective' : 'Closing'}</span></td><td class="num">${est}</td><td>${reqStatus(r)}</td><td class="num nowrap">${act}</td></tr>`;
        })
        .join('');
      return shell(
        `${head('Investor requests', 'Redemptions and subscriptions investors submit and e-sign in their portal. Approve or decline, then record the payment or the funding: the investor register, capital accounts and audit schedules update automatically.')}
        <div class="cs-tabs" role="group" aria-label="Requests"><button type="button" class="cs-tab" data-action="req-tab" data-t="pending" aria-pressed="${tab === 'pending'}">Open <span class="cs-count">${open.length}</span></button><button type="button" class="cs-tab" data-action="req-tab" data-t="all" aria-pressed="${tab === 'all'}">All <span class="cs-count">${all.length}</span></button></div>
        ${panel('', list.length ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Submitted</th><th scope="col">Investor</th><th scope="col">Fund</th><th scope="col">Request</th><th scope="col">Date</th><th scope="col" class="num">Amount</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div><p class="cs-hint">Redemptions are paid at net asset value on the dealing date, which follows the fund’s notice period and lock-up. Payment can be recorded once that month’s valuation is final.</p>` : '<p class="cs-muted">No open requests.</p>')}`,
        'console-requests'
      );
    }
  };
  NS.actions['req-tab'] = (el) => {
    S().ui.reqTab = el.getAttribute('data-t');
    NS.app.render();
  };
  const reqById = (id) => (W().requests || []).find((r) => r.id === id);
  NS.actions['req-approve'] = (el) => {
    const r = reqById(el.getAttribute('data-id'));
    // DIY: a subscription from an investor who is not verified (or not verified as accredited for Rule 506(c)) needs a second click, which is logged.
    if (r && r.type === 'subscription' && NS.integrations && NS.integrations.active(W())) {
      const inv = W().investors.find((x) => x.id === r.investorId);
      const o = W().offerings.find((x) => x.id === r.offeringId);
      const gate = NS.integrations.subscribeGate(W(), inv, o);
      if (gate && S().ui.reqOverride !== r.id) {
        S().ui.reqOverride = r.id;
        return U.toast(`${inv ? inv.title : 'This investor'} is not fully verified: ${gate.reason} Click Approve again to approve anyway.`);
      }
      if (gate) audit('Subscription approved without full verification', `${inv ? inv.title : r.investorId}: ${gate.reason}`, r.offeringId, r.id);
      S().ui.reqOverride = null;
    }
    if (r && OPS().decide(W(), r, true)) {
      NS.app.render();
      U.toast(r.type === 'redemption' ? `Redemption approved for the ${date(r.dealing)} dealing date.` : 'Subscription approved. Record the funding when the wire arrives.');
    }
  };
  NS.actions['req-decline'] = (el) => {
    const r = reqById(el.getAttribute('data-id'));
    if (r && OPS().decide(W(), r, false, 'Declined by the manager')) NS.app.render();
  };
  NS.actions['req-paid'] = (el) => {
    const r = reqById(el.getAttribute('data-id'));
    if (r && OPS().markPaid(W(), r)) {
      NS.app.render();
      U.toast(`Redemption payment of ${usdc(r.paidCents)} recorded.`);
    } else U.toast('The dealing-date valuation is not final yet.');
  };
  NS.actions['req-funded'] = (el) => {
    const r = reqById(el.getAttribute('data-id'));
    if (r && OPS().markFunded(W(), r)) {
      NS.app.render();
      U.toast(r.status === 'funded' ? `Subscription funded, effective ${date(r.dealing)}.` : 'Subscription countersigned. The commitment is on the investor register.');
    }
  };

  /* ---------- Documents: publish files to investor portals ---------- */
  const DOC_CATS = ['Reports', 'Statements', 'Tax', 'Legal', 'Notices', 'Other'];
  function dupState() {
    const u = S().ui;
    if (!u.dup) u.dup = { files: [], cat: 'Reports', offeringId: '', audience: 'fund', title: '', date: today(), taxYear: String(Number(today().slice(0, 4)) - 1), notify: true, busy: false, errors: [] };
    return u.dup;
  }
  NS.views['console-docs'] = {
    mode: 'console',
    render() {
      const w = W();
      const d = dupState();
      const docs = (w.docs || []).slice().sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
      const matches = d.audience === 'investors' ? d.files.map((f) => ({ f, ids: OPS().matchIds(w, f.name) })) : [];
      const rows = docs
        .map((x) => {
          const o = x.offeringId ? offById(x.offeringId) : null;
          const n = OPS().recipientsOf(w, x).length;
          return `<tr><td class="nowrap">${date(x.date)}</td><td>${h(x.title)}<span class="sub">${h(x.fileName)} · ${(x.size / 1024).toFixed(0)} KB${x.offeringDoc ? ` · offering document${x.hidden ? ', not shown to investors' : ''}` : ''}</span></td><td>${h(o ? o.shortName || o.name : 'All investors')}</td><td>${x.audience === 'investors' ? `${n} matched investor${n === 1 ? '' : 's'}` : `${n} investor${n === 1 ? '' : 's'}`}</td><td>${h(x.cat)}${x.taxYear ? `<span class="sub">Tax year ${h(x.taxYear)}</span>` : ''}</td><td><code title="${h(x.sha256)}">${h(x.sha256.slice(0, 10))}…</code></td><td class="num"><button class="cs-btn cs-btn-small" type="button" data-action="docs-remove" data-id="${h(x.id)}">Remove</button></td></tr>`;
        })
        .join('');
      return shell(
        `${head('Documents', `Publish quarterly reports, capital account statements, tax documents and notices to investor portals. Files named with an investor ID (for example ${h(T().idPrefix)}-1004_K-1_2025.pdf) go only to that investor.`)}
        ${panel(
          'Publish documents',
          `<div class="cs-grid cs-grid-3">
            <label class="cs-field cs-wide" for="dup-files"><span>Files</span><input id="dup-files" type="file" multiple accept=".pdf,.xlsx,.csv,.docx,.zip,application/pdf" data-change="dup-files"><span class="cs-hint">${d.files.length ? `${d.files.length} file${d.files.length === 1 ? '' : 's'} selected: ${h(d.files.map((f) => f.name).join(', '))}` : 'PDF preferred. Up to 25 MB each.'}</span></label>
            <label class="cs-field" for="dup-cat"><span>Type</span><select id="dup-cat" data-bind="dup:cat">${DOC_CATS.map((c) => `<option${c === d.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="cs-field" for="dup-off"><span>Fund</span><select id="dup-off" data-bind="dup:offeringId"><option value="">All investors</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${o.id === d.offeringId ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
            <fieldset class="cs-field cs-wide"><legend>Who receives each file</legend><div class="cs-seg">${[['fund', d.offeringId ? 'Everyone in this fund' : 'All investors'], ['investors', 'Match investor IDs in file names']].map(([k, l]) => `<label><input type="radio" name="dup-aud" value="${k}" data-bind="dup:audience"${d.audience === k ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
            ${d.files.length <= 1 ? `<label class="cs-field cs-wide" for="dup-title"><span>Title</span><input id="dup-title" type="text" maxlength="90" data-bind="dup:title" value="${h(d.title)}" placeholder="${h(d.files[0] ? docTitle(d.files[0].name, d.audience === 'investors' ? OPS().matchIds(w, d.files[0].name) : []) : 'Q3 2026 Investor Update')}"></label>` : ''}
            <label class="cs-field" for="dup-date"><span>Document date</span><input id="dup-date" type="date" data-bind="dup:date" value="${h(d.date)}"></label>
            ${d.cat === 'Tax' ? `<label class="cs-field" for="dup-ty"><span>Tax year</span><input id="dup-ty" type="number" min="2000" max="2100" data-bind="dup:taxYear" value="${h(d.taxYear)}"></label>` : ''}
            <label class="cs-check" for="dup-notify"><input id="dup-notify" type="checkbox" data-bind="dup:notify"${d.notify ? ' checked' : ''}><span>Notify recipients that new documents are in their portal</span></label>
          </div>
          ${matches.length ? `<ul class="cs-list">${matches.map((m) => `<li>${h(m.f.name)}: ${m.ids.length ? `goes to ${h(m.ids.join(', '))}` : '<span class="cs-error">no investor ID found, will not be published</span>'}</li>`).join('')}</ul>` : ''}
          ${d.errors.length ? `<p class="cs-error">${h(d.errors.join(' '))}</p>` : ''}
          <div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="docs-publish"${d.files.length && !d.busy ? '' : ' disabled'}>${d.busy ? 'Publishing…' : 'Publish'}</button></div>`
        )}
        ${panel(`Published <span class="cs-count">${docs.length}</span>`, docs.length ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Date</th><th scope="col">Document</th><th scope="col">Fund</th><th scope="col">Recipients</th><th scope="col">Type</th><th scope="col">SHA-256</th><th scope="col"><span class="sr-only">Remove</span></th></tr></thead><tbody>${rows}</tbody></table></div><p class="cs-hint">Each file’s SHA-256 fingerprint is recorded in the change log when it is published. In this demo, files are kept in this browser; in production they are stored in the document vault.</p>` : '<p class="cs-muted">Nothing published from this page yet. Generated statements and reports already appear in investor portals.</p>')}`,
        'console-docs'
      );
    }
  };
  /** A readable title from a file name, without the investor ID used for matching. */
  function docTitle(name, ids) {
    let t = String(name).replace(/\.[a-z0-9]+$/i, '');
    (ids || []).forEach((id) => (t = t.replace(new RegExp(id, 'ig'), '')));
    t = t.replace(/_+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '').trim();
    return t || name;
  }
  NS.changes['dup-files'] = (el) => {
    const d = dupState();
    d.files = Array.from(el.files || []);
    d.errors = d.files.filter((f) => f.size > 25 * 1024 * 1024).map((f) => `${f.name} is over 25 MB.`);
    NS.app.render();
  };
  NS.binders.dup = (path, v) => {
    dupState()[path] = v;
    if (path !== 'title') NS.app.render();
  };
  NS.actions['docs-publish'] = async () => {
    const w = W();
    const d = dupState();
    if (!d.files.length || d.busy) return;
    d.busy = true;
    NS.app.render();
    const published = [];
    const skipped = [];
    for (const f of d.files) {
      if (f.size > 25 * 1024 * 1024) {
        skipped.push(f.name);
        continue;
      }
      const ids = d.audience === 'investors' ? OPS().matchIds(w, f.name) : [];
      if (d.audience === 'investors' && !ids.length) {
        skipped.push(f.name);
        continue;
      }
      const buf = new Uint8Array(await f.arrayBuffer());
      const id = 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try {
        await OPS().files.put(id, new Blob([buf], { type: f.type || 'application/octet-stream' }));
      } catch (e) {
        skipped.push(f.name);
        continue;
      }
      const title = (d.files.length === 1 && String(d.title).trim()) || docTitle(f.name, ids);
      const doc = { id, title, fileName: f.name, type: f.type || '', size: f.size, sha256: NS.audit.sha256(buf), cat: d.cat, offeringId: d.offeringId || null, audience: d.audience, investors: ids, date: d.date || today(), taxYear: d.cat === 'Tax' ? String(d.taxYear) : '', publishedAt: new Date().toISOString(), publishedBy: NS.app.actor() };
      w.docs = w.docs || [];
      w.docs.push(doc);
      const n = OPS().recipientsOf(w, doc).length;
      audit('Document published', `${doc.title} (${doc.fileName}, ${(doc.size / 1024).toFixed(0)} KB) to ${n} investor${n === 1 ? '' : 's'}; SHA-256 ${doc.sha256}`, doc.offeringId || '', doc.id);
      published.push(doc);
    }
    if (published.length && d.notify) {
      const rec = new Set();
      published.forEach((doc) => OPS().recipientsOf(w, doc).forEach((i) => rec.add(i.id)));
      w.notices = w.notices || [];
      w.notices.push({ id: 'n-' + Date.now().toString(36), date: today(), kind: 'documents', audience: published.every((x) => x.offeringId && x.offeringId === published[0].offeringId) ? published[0].offeringId : 'all', investors: [], includePending: true, quarter: '', docName: published.map((x) => x.title).join(', '), subject: NS.NOTICE_TEMPLATES.documents.subject, body: NS.NOTICE_TEMPLATES.documents.body, recipients: Array.from(rec), sentBy: canConfigure() ? 'staff' : 'sponsor', sentByName: NS.app.actor() });
      audit('Notice sent', `New documents notice to ${rec.size} investors`, '', '');
    }
    NS.app.save(true);
    S().ui.dup = null;
    const nd = dupState();
    nd.errors = skipped.length ? [`Not published: ${skipped.join(', ')}.`] : [];
    NS.app.render();
    U.toast(`${published.length} document${published.length === 1 ? '' : 's'} published${skipped.length ? `, ${skipped.length} skipped` : ''}.`);
  };
  NS.actions['docs-remove'] = (el) => {
    const w = W();
    const doc = (w.docs || []).find((x) => x.id === el.getAttribute('data-id'));
    if (!doc) return;
    w.docs = w.docs.filter((x) => x !== doc);
    OPS().files.del(doc.id).catch(() => {});
    audit('Document removed', `${doc.title} (${doc.fileName}) removed from investor portals`, doc.offeringId || '', doc.id);
    NS.app.save(true);
    NS.app.render();
  };

  /* ---------- AML / KYC ---------- */
  NS.views['console-kyc'] = {
    mode: 'console',
    render() {
      const w = W();
      const tab = S().ui.kycTab || 'attention';
      // DIY edition: checks waiting on the team (integrations.js), counted for every investor with a verification record.
      const IVA = NS.integrations && NS.integrations.active(w) ? NS.integrations : null;
      const rows0 = w.investors.map((i) => ({ i, k: OPS().kycOf(i), lab: OPS().kycLabel(OPS().kycOf(i)), team: IVA && i.verify ? IVA.awaitingTeam(w, i).length : 0 }));
      const count = (key) => rows0.filter((r) => r.lab.key === key).length;
      // A cleared investor stays on Needs attention while a check waits on the team (an accreditation letter can hold a Rule 506(c) subscription).
      const attention = rows0.filter((r) => r.lab.key !== 'cleared' || r.team);
      const list = (tab === 'attention' ? attention : rows0).slice().sort((a, b) => {
        const order = { review: 0, rejected: 1, due: 2, pending: 3, not_started: 4, cleared: 5 };
        const rank = (r) => (r.team && r.lab.key === 'cleared' ? order.pending : order[r.lab.key]);
        return (rank(a) - rank(b)) || (a.i.id < b.i.id ? -1 : 1);
      });
      const open = S().ui.kycOpen;
      const rows = list
        .map(({ i, k, lab, team }) => {
          const st = { cleared: badge('ok', 'Cleared'), review: badge('bad', 'Needs review'), rejected: badge('bad', 'Not approved'), due: badge('warn', 'Re-screening due'), pending: badge('adj', 'In progress'), not_started: badge('mute', 'Not started') }[lab.key];
          // DIY edition: the automated checks behind this investor's status (integrations.js), read without changing the record.
          const ivd = IVA && i.verify ? IVA.peek(i) : null;
          let act = '';
          if (lab.key === 'review' || lab.key === 'rejected') act = `<button class="cs-btn cs-btn-small cs-btn-primary" type="button" data-action="kyc-open" data-id="${h(i.id)}">${k.match ? 'Review match' : 'Review'}</button>`;
          else if (lab.key === 'pending' && k.verifiedOn && !ivd) act = `<button class="cs-btn cs-btn-small" type="button" data-action="kyc-approve" data-id="${h(i.id)}">Approve identity</button>`;
          else if (lab.key === 'cleared' || lab.key === 'due') act = `<button class="cs-btn cs-btn-small" type="button" data-action="kyc-screen" data-id="${h(i.id)}">Re-screen</button>`;
          const IVN = NS.integrations;
          // Which connection ran each check, and result buttons for checks waiting on the team (hosted links, uploads, team screening).
          const rec = ivd ? IVN.recordable(w, i) : [];
          // A cleared investor can still have a check waiting on the team (a team screening after approval): keep the details reachable,
          // and say so plainly when the check is what keeps them on Needs attention.
          if (ivd && rec.length && (lab.key === 'cleared' || lab.key === 'due')) act += ` <button class="cs-btn cs-btn-small${team ? ' cs-btn-primary' : ''}" type="button" data-action="kyc-open" data-id="${h(i.id)}">${team ? 'Record result' : 'Details'}</button>`;
          const ST = { not_started: 'not started', pending: 'waiting for the result', passed: 'verified', verified: 'verified', clear: 'clear', review: 'needs review', potential_match: 'potential match', failed: 'not verified', rejected: 'not accredited', match: 'confirmed match' };
          const recordBtns = (kind, conn) => `<div class="iv-record" role="group" aria-label="Record result"><span>Record result</span>${IVN.RECORD[kind].map(([o, l]) => `<button class="cs-btn cs-btn-small" type="button" data-action="kyc-iv-record" data-id="${h(i.id)}" data-kind="${kind}" data-connection="${h(conn || '')}" data-outcome="${o}">${l}</button>`).join('')}</div>`;
          const canRecord = (kind, conn) => rec.some((r) => r.kind === kind && r.connection === conn);
          const ivLine = (label, x, kind) => `<li><strong>${label}:</strong> ${h(ST[x.status] || x.status)}${IVN.via(w, x, kind) ? ` · ${h(IVN.via(w, x, kind))}` : ''}${x.method ? ` · ${h(x.method)}` : ''}${x.ref ? ` · ref ${h(x.ref)}` : ''}${x.expiresAt ? ` · valid until ${date(x.expiresAt)}` : ''}${x.note ? ` · note: ${h(x.note)}` : ''}${x.recordedBy ? ` · recorded by ${h(x.recordedBy)}` : ''}${x.fileId ? ` · <button class="link-btn" type="button" data-action="kyc-iv-file" data-id="${h(x.fileId)}" data-name="${h(x.fileName || 'file')}">${h(x.fileName || 'View file')}</button>` : ''}${canRecord(kind, x.connection || '') ? recordBtns(kind, x.connection) : ''}</li>`;
          const amlLine = (x) => `<li><strong>Screening:</strong> ${h(ST[x.status] || x.status)}${(x.results || []).length ? `<ul class="iv-results">${x.results.map((r) => `<li>${h(r.via)}: ${h(ST[r.status] || r.status)}${(r.hits || []).length ? ` · ${r.hits.map((x) => `${h(x.name)} on ${h(x.list)}${x.listed ? ` as “${h(x.listed)}”` : ''}${x.score ? `, ${Math.round(x.score * 100)}%` : ''}${x.detail ? ` (${h(x.detail)})` : ''}`).join('; ')}` : ''}${r.ref ? ` · ref ${h(r.ref)}` : ''}${r.error ? ` · ${h(r.error)}` : ''}${r.note ? ` · note: ${h(r.note)}` : ''}${r.by ? ` · recorded by ${h(r.by)}` : ''}${canRecord('aml', r.connection) ? recordBtns('aml', r.connection) : ''}</li>`).join('')}</ul>` : IVN.via(w, x, 'aml') ? ` · ${h(IVN.via(w, x, 'aml'))}` : ''}</li>`;
          if (ivd && !act && lab.key === 'pending') act = `<button class="cs-btn cs-btn-small${rec.length ? ' cs-btn-primary' : ''}" type="button" data-action="kyc-open" data-id="${h(i.id)}">${rec.length ? 'Record result' : 'Details'}</button>`;
          const detail =
            open === i.id && (k.match || ivd)
              ? `<tr class="kyc-detail"><td colspan="8"><div class="kyc-match">${k.match ? `<p><strong>Potential match:</strong> ${h(k.match.list)}, listed name “${h(k.match.name)}”, ${Math.round(k.match.score * 100)}% name similarity. ${h(k.match.detail)}</p>` : ''}
                ${ivd ? `<ul class="cs-list">${ivLine('Identity', ivd.identity, 'identity')}${amlLine(ivd.aml)}${ivLine('Accreditation', ivd.accreditation, 'accreditation')}<li><strong>Decision:</strong> ${h(ivd.decision.status)}${ivd.decision.reason ? ` · ${h(ivd.decision.reason)}` : ''}</li></ul>` : ''}
                <label class="cs-field" for="kyc-note"><span>${rec.length ? 'Note (required to record a result or decide; kept in the change log)' : 'Review note (kept in the change log)'}</span><textarea id="kyc-note" rows="2" maxlength="300" data-input="kyc-note">${h(S().ui.kycNote || '')}</textarea></label>
                <div class="cs-row">${k.match && !ivd ? `<button class="cs-btn cs-btn-primary" type="button" data-action="kyc-clear" data-id="${h(i.id)}">Clear as false positive</button>` : ''}${ivd ? `<button class="cs-btn${rec.length ? '' : ' cs-btn-primary'}" type="button" data-action="kyc-iv-approve" data-id="${h(i.id)}">Approve investor</button><button class="cs-btn" type="button" data-action="kyc-iv-decline" data-id="${h(i.id)}">Decline</button>` : ''}<button class="cs-btn" type="button" data-action="kyc-escalate" data-id="${h(i.id)}">Escalate to compliance officer</button><button class="cs-btn" type="button" data-action="kyc-open" data-id="">Cancel</button></div>${k.escalated ? `<p class="cs-hint">Escalated ${date(k.escalated)}.</p>` : ''}</div></td></tr>`
              : '';
          return `<tr><td>${h(i.title)}<span class="sub">${h(i.id)} · ${h((NS.ENTITY_TYPES[i.type] || {}).label || i.type)}</span></td><td>${h(k.risk || '—')}</td><td>${k.verifiedOn ? `${date(k.verifiedOn)}<span class="sub">${h(k.method || '')}</span>` : '<span class="sub">Not submitted</span>'}</td><td>${k.screenedOn ? `${k.screening === 'potential_match' ? 'Potential match' : k.screening === 'pending' ? 'Waiting for results' : 'No matches'}<span class="sub">${date(k.screenedOn)}</span>` : '—'}</td><td class="nowrap">${k.nextReview ? date(k.nextReview) : '—'}</td><td>${(k.owners || []).map((x) => h(x.name)).join(', ')}</td><td>${st}</td><td class="num nowrap">${act}</td></tr>${detail}`;
        })
        .join('');
      const due = rows0.filter((r) => r.lab.key === 'due');
      if (NS.integrations && NS.integrations.active(w)) NS.integrations.resume(w); // poll open provider checks while this page is open
      return shell(
        `${head('AML/KYC', E.diy ? `Identity verification, sanctions and PEP screening and accredited investor checks run automatically through the connections you plug in: ${h(NS.integrations ? NS.integrations.activeNames(w).join(', ') : 'none yet')} (<a class="cs-link" href="#console-integrations">Integrations</a>). Anything flagged, and any check waiting on your team, waits here.` : 'Identity verification, sanctions and politically exposed person screening, and periodic re-screening for every investor. Potential matches wait here for the compliance officer’s review.', due.length ? `<button class="cs-btn" type="button" data-action="kyc-screen-due">Re-screen ${due.length} due</button>` : '')}
        <dl class="cs-figs">
          <div><dt>Cleared</dt><dd>${count('cleared')}</dd></div>
          <div><dt>Needs review</dt><dd>${count('review')}</dd></div>
          <div><dt>Re-screening due</dt><dd>${count('due')}</dd></div>
          <div><dt>In progress or not started</dt><dd>${count('pending') + count('not_started')}</dd></div>
        </dl>
        <div class="cs-tabs" role="group" aria-label="Filter"><button type="button" class="cs-tab" data-action="kyc-tab" data-t="attention" aria-pressed="${tab === 'attention'}">Needs attention <span class="cs-count">${attention.length}</span></button><button type="button" class="cs-tab" data-action="kyc-tab" data-t="all" aria-pressed="${tab === 'all'}">All investors <span class="cs-count">${rows0.length}</span></button></div>
        ${panel('', list.length ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Investor</th><th scope="col">Risk</th><th scope="col">Identity verified</th><th scope="col">Screening</th><th scope="col">Next review</th><th scope="col">Beneficial owners</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="cs-muted">Every investor is cleared and current.</p>')}
        <p class="cs-hint">${E.diy ? 'Screening runs through every screening connection that is on; any potential match holds the investor for review. Re-screening follows the interval set on the Integrations page.' : 'Screening covers OFAC SDN and consolidated lists, UN, EU and UK HMT sanctions, politically exposed persons and adverse media. Low-risk investors are re-screened every 24 months, medium every 12, high every 6. In production this connects to the screening provider; here results are simulated.'}</p>`,
        'console-kyc'
      );
    }
  };
  NS.actions['kyc-tab'] = (el) => {
    S().ui.kycTab = el.getAttribute('data-t');
    NS.app.render();
  };
  NS.actions['kyc-open'] = (el) => {
    S().ui.kycOpen = el.getAttribute('data-id') || null;
    S().ui.kycNote = '';
    NS.app.render();
  };
  NS.changes['kyc-note'] = (el) => (S().ui.kycNote = el.value);
  NS.actions['kyc-clear'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    const note = String(S().ui.kycNote || '').trim();
    if (!note) return U.toast('Add a review note explaining why the match is a false positive.');
    if (inv && OPS().clearMatch(W(), inv, note)) {
      S().ui.kycOpen = null;
      NS.app.render();
      U.toast(`${inv.title} cleared.`);
    }
  };
  NS.actions['kyc-escalate'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    if (inv && OPS().escalate(W(), inv, String(S().ui.kycNote || '').trim() || 'Escalated for review.')) {
      NS.app.render();
      U.toast('Escalated to the compliance officer.');
    }
  };
  /** DIY investors are re-screened through every screening connection that is on. */
  async function rescreen(inv) {
    const IVN = NS.integrations;
    if (IVN && IVN.active(W()) && inv.verify) {
      const r = await IVN.screen(W(), inv);
      IVN.decide(W(), inv);
      NS.app.save(true);
      return r.status === 'clear' ? 'no matches' : r.status === 'potential_match' ? 'a potential match to review' : 'waiting for results from some screening connections';
    }
    OPS().screen(W(), inv);
    return 'no matches';
  }
  NS.actions['kyc-screen'] = async (el) => {
    const inv = invById(el.getAttribute('data-id'));
    if (inv) {
      const res = await rescreen(inv);
      NS.app.render();
      U.toast(`${inv.title} screened: ${res}.`);
    }
  };
  NS.actions['kyc-screen-due'] = async () => {
    const due = W().investors.filter((i) => OPS().kycLabel(OPS().kycOf(i)).key === 'due');
    for (const i of due) await rescreen(i);
    NS.app.render();
    U.toast(`${due.length} investor${due.length === 1 ? '' : 's'} re-screened.`);
  };
  NS.actions['kyc-iv-approve'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    const note = String(S().ui.kycNote || '').trim();
    if (!note) return U.toast('Add a review note explaining the decision.');
    NS.integrations.decideManually(W(), inv, true, note);
    S().ui.kycOpen = null;
    NS.app.render();
    U.toast(`${inv.title} approved.`);
  };
  NS.actions['kyc-iv-decline'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    const note = String(S().ui.kycNote || '').trim();
    if (!note) return U.toast('Add a review note explaining the decision.');
    NS.integrations.decideManually(W(), inv, false, note);
    S().ui.kycOpen = null;
    NS.app.render();
    U.toast(`${inv.title} declined.`);
  };
  NS.actions['kyc-iv-record'] = async (el) => {
    const inv = invById(el.getAttribute('data-id'));
    const note = String(S().ui.kycNote || '').trim();
    if (!inv) return;
    if (!note) return U.toast('Add a note explaining the result you are recording.');
    const kind = el.getAttribute('data-kind');
    await NS.integrations.recordResult(W(), inv, kind, el.getAttribute('data-connection'), el.getAttribute('data-outcome'), note);
    S().ui.kycNote = '';
    NS.app.render();
    U.toast(`${NS.integrations.SHORT[kind]} result recorded for ${inv.title}.`);
  };
  NS.actions['kyc-iv-file'] = (el) => {
    OPS()
      .files.get(el.getAttribute('data-id'))
      .then((blob) => (blob ? U.download(el.getAttribute('data-name'), blob, { mime: blob.type }) : U.toast('This file was uploaded in a different browser.')));
  };
  NS.actions['kyc-approve'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    if (inv && OPS().approveIdentity(W(), inv)) NS.app.render();
  };

  /* ---------- Offering intake: set an offering up from its documents (owner role) ---------- */
  const IK = () => NS.intake;
  function ikState() {
    const u = S().ui;
    if (!u.intake) u.intake = { step: 'upload', files: [], samples: [], pasted: '', target: '', publish: true, docs: [], progress: '', method: '', profile: null, error: '', trimmed: false, busy: false, done: '' };
    return u.intake;
  }
  const ikVal = (path) => NS.app.getPath(ikState().profile, path);
  function ikChip(path, v) {
    const p = ikState().profile;
    if (v === '' || v == null || v === false || (Array.isArray(v) && !v.length)) return '<span class="ik-chip ik-none">Not found</span>';
    const c = p.confidence[path];
    return c === 'high' ? '<span class="ik-chip ik-high">Stated</span>' : c === 'medium' ? '<span class="ik-chip ik-medium">Inferred</span>' : c === 'low' ? '<span class="ik-chip ik-low">Check</span>' : ikState().method === 'manual' ? '' : '<span class="ik-chip ik-medium">Found</span>';
  }
  function ikSrc(path) {
    const s = ikState().profile.sources[path];
    if (!s) return '';
    const t = String(s);
    return `<span class="ik-src" title="${h(t)}">“${h(t.length > 150 ? t.slice(0, 147) + '…' : t)}”</span>`;
  }
  function ikField(label, path, opts) {
    opts = opts || {};
    const v = ikVal(path);
    const id = 'ik-' + path.replace(/\./g, '-');
    if (opts.check) return `<label class="cs-check" for="${id}"><input id="${id}" type="checkbox" data-bind="ik:${path}"${v ? ' checked' : ''}><span>${label} ${ikChip(path, v)}</span></label>`;
    let input;
    if (opts.select) input = `<select id="${id}" data-bind="ik:${path}">${opts.select.map(([val, l]) => `<option value="${h(val)}"${String(v == null ? '' : v) === String(val) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
    else if (opts.textarea) input = `<textarea id="${id}" rows="${opts.rows || 2}" data-bind="ik:${path}">${h(Array.isArray(v) ? v.join('\n') : v == null ? '' : v)}</textarea>`;
    else input = `<input id="${id}" type="${opts.type || 'text'}"${opts.type === 'number' ? ' step="any"' : ''} data-bind="ik:${path}" value="${h(v == null ? '' : v)}">`;
    return `<label class="cs-field${opts.wide ? ' cs-wide' : ''}" for="${id}"><span>${label} ${ikChip(path, v)}</span>${input}${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}${ikSrc(path)}</label>`;
  }
  const IK_ROWS = {
    classes: () => ({ name: `Class ${'ABCDEFGH'[(ikVal('classes') || []).length] || 'X'}`, mgmtFee: null, carry: null, pref: null, minimum: null, currency: '', eligibility: '' }),
    'structure.feeders': () => ({ name: '', domicile: '', for: '' }),
    'waterfall.tiers': () => ({ kind: 'split', rate: null, simple: false, gp: 20, lp: 80, upTo: null, upToX: null }),
    'providers.others': () => ({ role: '', name: '' }),
    investorTerms: () => ({ label: '', value: '' })
  };
  function ikList(title, list, cols, hint) {
    const arr = ikVal(list) || [];
    const cell = (path, v, t, opt) => {
      const id = 'ik-' + path.replace(/\./g, '-');
      if (t === 'select') return `<select id="${id}" aria-label="${h(path)}" data-bind="ik:${path}">${opt.map(([val, l]) => `<option value="${h(val)}"${String(v == null ? '' : v) === String(val) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>`;
      if (t === 'check') return `<input id="${id}" type="checkbox" aria-label="${h(path)}" data-bind="ik:${path}"${v ? ' checked' : ''}>`;
      return `<input id="${id}" type="${t === 'number' ? 'number' : 'text'}"${t === 'number' ? ' step="any"' : ''} aria-label="${h(path)}" data-bind="ik:${path}" value="${h(v == null ? '' : v)}">`;
    };
    const rows = arr.map((row, i) => `<tr>${cols.map(([k, , t, opt]) => `<td>${cell(`${list}.${i}.${k}`, row[k], t, opt)}</td>`).join('')}<td class="num"><button class="cs-icon" type="button" data-action="ik-row-del" data-list="${list}" data-i="${i}" aria-label="Remove">${icon('x')}</button></td></tr>`).join('');
    return `<div class="ik-list cs-wide"><div class="ik-list-head"><strong>${title}</strong> ${ikChip(list, arr)} ${ikSrc(list)}</div>
      <div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact ik-tbl"><thead><tr>${cols.map((c) => `<th scope="col">${c[1]}</th>`).join('')}<th scope="col"><span class="sr-only">Remove</span></th></tr></thead><tbody>${rows || `<tr><td colspan="${cols.length + 1}" class="cs-muted">None.</td></tr>`}</tbody></table></div>
      <button class="cs-btn cs-btn-small" type="button" data-action="ik-row-add" data-list="${list}">${icon('plus')}Add</button>${hint ? `<p class="cs-hint">${hint}</p>` : ''}</div>`;
  }
  function ikUpload() {
    const st = ikState();
    IK().claudeSample(); // start connecting to Claude now, so reading starts at once
    const w = W();
    const names = st.files.map((f) => f.name).concat(st.samples.map((x) => x.name));
    const ready = st.files.length || st.samples.length || String(st.pasted).trim().length > 40;
    return shell(
      `${head('Offering intake', 'Upload a fund’s offering documents and the portal reads them and sets up the offering: what investors see, fees and waterfall, share classes, feeder funds, side pockets, equalization, currency, liquidity, distributions and service providers. You review every term, with the passage it came from, before anything changes.')}
      ${panel(
        'Documents',
        `<div class="cs-grid">
          <label class="cs-field cs-wide ik-drop" for="ik-files"><span>Private placement memorandum, partnership or operating agreement, subscription documents, term sheet</span><input id="ik-files" type="file" multiple accept=".pdf,.docx,.txt,.md,application/pdf" data-change="ik-files"><span class="cs-hint">${names.length ? `${names.length} document${names.length === 1 ? '' : 's'}: ${h(names.join(', '))}` : 'PDF, Word (.docx) or text. A scanned PDF with no text layer needs OCR first.'}</span></label>
          <label class="cs-field cs-wide" for="ik-paste"><span>Or paste the summary of terms</span><textarea id="ik-paste" rows="4" data-input="ik-paste">${h(st.pasted)}</textarea></label>
        </div>
        <div class="cs-row ik-samples"><span class="cs-hint">No documents to hand? Try a sample:</span><button class="cs-btn cs-btn-small" type="button" data-action="ik-sample" data-s="hedge">Hedge fund: master-feeder, three share classes, side pockets</button><button class="cs-btn cs-btn-small" type="button" data-action="ik-sample" data-s="realestate">Real estate: multi-tier promote waterfall</button></div>
        <div class="cs-grid cs-grid-3">
          <label class="cs-field" for="ik-target"><span>Apply to</span><select id="ik-target" data-bind="ikt:target"><option value="">A new offering</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${st.target === o.id ? ' selected' : ''}>Update ${h(o.name)}</option>`).join('')}</select></label>
          <label class="cs-check" for="ik-publish"><input id="ik-publish" type="checkbox" data-bind="ikt:publish"${st.publish ? ' checked' : ''}><span>Make uploaded documents available to investors in this offering (and on its subscription page)</span></label>
        </div>
        ${st.error ? `<p class="cs-error">${h(st.error)}</p>` : ''}
        <div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="ik-read"${ready ? '' : ' disabled'}>Read documents</button><span class="cs-hint">The documents are read and their terms filled in for you to review (you may be asked to allow reading once).</span></div>`
      )}`,
      'console-intake'
    );
  }
  function ikReading() {
    const st = ikState();
    return shell(
      `${head('Reading the documents')}
      ${panel('', `<ul class="cs-list">${st.docs.map((d) => `<li><strong>${h(d.name)}</strong>: ${d.error ? `<span class="cs-error">${h(d.error)}</span>` : d.text != null ? `${d.pages ? `${d.pages} page${d.pages === 1 ? '' : 's'}, ` : ''}${Number(d.chars).toLocaleString('en-US')} characters${d.scanned ? ' <span class="cs-error">(little or no text: probably scanned; needs OCR)</span>' : ''}` : 'reading…'}</li>`).join('')}</ul>
        <p class="cs-report-sum" id="ik-progress">${h(st.progress)}</p>
        ${st.ctl ? '<button class="cs-btn" type="button" data-action="ik-stop">Stop</button>' : ''}`)}`,
      'console-intake'
    );
  }
  function ikReview() {
    const st = ikState();
    const p = st.profile;
    const w = W();
    const types = Object.keys(NS.OFFERING_TYPES).map((t) => [t, t]);
    const curs = Object.keys(NS.structures.CURRENCIES).map((c) => [c, `${c} (${NS.structures.CURRENCIES[c].name})`]);
    const target = st.target ? w.offerings.find((o) => o.id === st.target) : null;
    const method = st.method === 'manual' ? 'Current setup' : 'Read from the documents';
    const n = IK().filled(p);
    const tiersHint = 'Tiers run in order: return of capital, preferred return (simple or compounding), GP catch-up, then splits that end when investors reach an IRR or a multiple of their capital. Leave empty to use carry and preferred return with a full catch-up.';
    return shell(
      `${head(target && st.method === 'manual' ? `Structure: ${h(target.name)}` : 'Review the setup', st.method === 'manual' ? 'Edit the offering’s structure and terms, then apply.' : `${method} from ${st.docs.filter((d) => d.text != null).length} document${st.docs.filter((d) => d.text != null).length === 1 ? '' : 's'}: ${n} terms found${st.trimmed ? ' (long documents: the cover pages and every passage that mentions terms were read)' : ''}. Check each term against its source, then apply.`, `<button class="cs-btn" type="button" data-action="ik-restart">${st.method === 'manual' ? 'Cancel' : 'Start over'}</button><button class="cs-btn cs-btn-primary" type="button" data-action="ik-apply"${st.busy ? ' disabled' : ''}>${target ? `Apply to ${h(target.shortName || target.name)}` : 'Create the offering'}</button>`)}
      ${p.notes.length ? panel('Notes', `<ul class="cs-list">${p.notes.map((x) => `<li>${h(x)}</li>`).join('')}</ul>`) : ''}
      ${panel('Offering', `<div class="cs-grid cs-grid-3">
        ${ikField('Name', 'offering.name', { wide: true })}
        ${ikField('Short name', 'offering.shortName')}
        ${ikField('Type', 'offering.type', { select: types, hint: 'Sets the accounting: closed-end with carried interest, or open-ended with an incentive allocation.' })}
        ${ikField('Status', 'offering.status', { select: [['Raising', 'Raising (accepting subscriptions)'], ['Active', 'Active']] })}
        ${ikField('First close', 'offering.firstClose', { type: 'date' })}
        ${ikField('Minimum investment', 'offering.minimum', { type: 'number' })}
        ${ikField('Target size', 'offering.targetSize', { type: 'number' })}
        ${ikField('Hard cap', 'structure.hardCap', { type: 'number' })}
        ${ikField('Final close', 'structure.finalClose')}
        ${ikField('Currency', 'offering.currency', { select: curs })}
        ${ikField('One-line description', 'offering.summary', { wide: true })}
      </div>`)}
      ${panel('Structure', `<div class="cs-grid cs-grid-3">
        ${ikField('Vehicle', 'structure.vehicle')}
        ${ikField('Domicile', 'structure.domicile')}
        ${ikField('Securities exemption', 'structure.exemption')}
        ${ikField('Investor eligibility', 'structure.eligibility')}
        ${ikField('General partner or managing member', 'structure.gp')}
        ${ikField('Manager or sponsor', 'structure.manager')}
        ${ikField('GP commitment', 'structure.gpCommitment')}
        ${ikField('Capital call notice (days)', 'structure.callNoticeDays', { type: 'number' })}
        ${ikField('Master fund', 'structure.master', { hint: 'Fill in when investors invest through feeder funds.' })}
        ${ikField('Equalization', 'structure.equalization', { select: [['', 'None'], ['capital accounts', 'Capital accounts'], ['equalization', 'Equalization'], ['series', 'Series of shares']] })}
        ${ikField('Side pockets allowed', 'structure.sidePockets.allowed', { check: true })}
        ${ikField('Side pocket limit (% of NAV)', 'structure.sidePockets.maxPct', { type: 'number' })}
        ${ikList('Feeder funds', 'structure.feeders', [['name', 'Feeder fund', 'text'], ['domicile', 'Domicile', 'text'], ['for', 'For', 'text']])}
      </div>`)}
      ${panel('Share classes', `<div class="cs-grid">${ikList('Classes', 'classes', [['name', 'Class', 'text'], ['mgmtFee', 'Mgmt fee %', 'number'], ['carry', 'Carry or incentive %', 'number'], ['pref', 'Pref %', 'number'], ['minimum', 'Minimum', 'number'], ['currency', 'Currency', 'text'], ['eligibility', 'Eligibility', 'text']], 'Blank fees use the offering’s fees below. Each investor is charged at their class’s rates.')}</div>`)}
      ${panel('Fees and waterfall', `<div class="cs-grid cs-grid-3">
        ${ikField('Management fee (% a year)', 'fees.mgmtFee', { type: 'number' })}
        ${ikField('Fee basis', 'fees.feeBasis', { select: [['', 'Default for the fund type'], ['commitment', 'Commitments'], ['contributed', 'Contributed capital'], ['nav', 'Net asset value']] })}
        ${ikField('Fee after the investment period (% a year)', 'fees.stepDown', { type: 'number', hint: 'Leave blank if the fee does not step down.' })}
        ${ikField('Fee basis after the investment period', 'fees.stepDownBasis', { select: [['', 'Same as above (commitments become contributed capital)'], ['commitment', 'Commitments'], ['contributed', 'Contributed or invested capital'], ['nav', 'Net asset value']] })}
        ${ikField('Carried interest or incentive (%)', 'fees.carry', { type: 'number' })}
        ${ikField('Preferred return (% a year)', 'fees.pref', { type: 'number' })}
        ${ikField('Preferred return', 'fees.prefCompounding', { select: [['', 'Not stated'], ['compound', 'Compounding'], ['simple', 'Simple (non-compounding)']] })}
        ${ikField('GP catch-up (% to the GP)', 'fees.catchUp', { type: 'number' })}
        ${ikField('High-water mark', 'fees.highWaterMark', { check: true })}
        ${ikField('Incentive crystallizes', 'fees.crystallization', { select: [['', 'Not stated'], ['annual', 'Annually'], ['quarterly', 'Quarterly']] })}
        ${ikField('Waterfall', 'waterfall.type', { select: [['', 'Not stated'], ['european', 'Whole fund (European)'], ['american', 'Deal by deal (American)']] })}
        ${ikList('Waterfall tiers', 'waterfall.tiers', [['kind', 'Tier', 'select', [['roc', 'Return of capital'], ['pref', 'Preferred return'], ['catchup', 'GP catch-up'], ['split', 'Split']]], ['rate', 'Pref % a year', 'number'], ['simple', 'Simple', 'check'], ['lp', 'Investors %', 'number'], ['gp', 'GP %', 'number'], ['upTo', 'Until investor IRR %', 'number'], ['upToX', 'Or until multiple (x)', 'number']], tiersHint)}
        ${ikField('Other fees (one per line)', 'fees.other', { textarea: true, rows: 3, wide: true })}
      </div>`)}
      ${panel('Term and liquidity', `<div class="cs-grid cs-grid-3">
        ${ikField('Term', 'term.basis', { select: [['', 'Default for the fund type'], ['date', 'Fixed term (exit date)'], ['range', 'Projected hold window'], ['maturity', 'Maturity date'], ['open', 'No set term (open-ended)']] })}
        ${ikField('Term or hold (years)', 'term.years', { type: 'number' })}
        ${ikField('Shortest hold (years)', 'term.fromYears', { type: 'number' })}
        ${ikField('Exit or maturity date', 'term.date', { type: 'date' })}
        ${ikField('Extensions', 'term.extensions')}
        ${ikField('Investment period (years)', 'term.investmentPeriodYears', { type: 'number' })}
        ${ikField('Note for investors', 'term.note', { wide: true })}
        ${ikField('Redemptions', 'liquidity.frequency', { select: [['', 'None (closed-end)'], ['Monthly', 'Monthly'], ['Quarterly', 'Quarterly'], ['Semi-annual', 'Semi-annual'], ['Annual', 'Annual']] })}
        ${ikField('Notice (days)', 'liquidity.noticeDays', { type: 'number' })}
        ${ikField('Lock-up (months)', 'liquidity.lockupMonths', { type: 'number' })}
        ${ikField('Lock-up type', 'liquidity.lockupType', { select: [['', 'Not stated'], ['hard', 'Hard'], ['soft', 'Soft (with a fee)']] })}
        ${ikField('Early redemption fee (%)', 'liquidity.earlyRedemptionFee', { type: 'number' })}
        ${ikField('Gate (% of NAV)', 'liquidity.gatePct', { type: 'number' })}
      </div>`)}
      ${panel('Distributions', `<div class="cs-grid cs-grid-3">
        ${ikField('Frequency', 'distribution.frequency', { select: [['', 'Default for the fund type']].concat(NS.FREQUENCIES.map((f) => [f, f])) })}
        ${ikField('Payment type', 'distribution.type', { select: [['', 'Default for the fund type']].concat(NS.DIST_TYPES.map((f) => [f, f])) })}
        ${ikField('Target shown to investors', 'distribution.target')}
        ${ikField('Payment day of month', 'distribution.day', { type: 'number' })}
      </div>`)}
      ${panel('What investors see', `<div class="cs-grid">${ikList('Key terms on the investment page', 'investorTerms', [['label', 'Term', 'text'], ['value', 'Shown as', 'text']])}${ikField('Description for investors', 'update', { textarea: true, rows: 3, wide: true })}</div>`)}
      ${panel('Service providers', `<div class="cs-grid cs-grid-3">${ikField('Auditor', 'providers.auditor')}${ikField('Administrator', 'providers.administrator')}${ikField('Legal counsel', 'providers.counsel')}${ikField('Custodian', 'providers.custodian')}${ikField('Prime broker', 'providers.primeBroker')}${ikList('Other service providers', 'providers.others', [['role', 'Role', 'text'], ['name', 'Name', 'text']])}</div>`)}
      <div class="cs-row ik-foot"><button class="cs-btn" type="button" data-action="ik-restart">${st.method === 'manual' ? 'Cancel' : 'Start over'}</button><button class="cs-btn cs-btn-primary" type="button" data-action="ik-apply"${st.busy ? ' disabled' : ''}>${target ? `Apply to ${h(target.shortName || target.name)}` : 'Create the offering'}</button></div>`,
      'console-intake'
    );
  }
  function ikDone() {
    const st = ikState();
    const o = W().offerings.find((x) => x.id === st.done);
    if (!o) return ikUpload();
    const S0 = NS.audit.settings(o);
    const tiers = S0.tiers || (S0.open ? null : NS.structures.defaultTiers(S0.carry, S0.pref, S0.catchUp));
    const items = [
      `${h(o.type)}, ${S0.open ? 'open-ended (monthly NAV, incentive allocation over a high-water mark)' : 'closed-end (quarterly valuations, carried interest through the waterfall)'}; currency ${h(S0.currency)}`,
      `Fees: ${+(S0.mgmtFee * 100).toFixed(2)}% management fee on ${h(NS.audit.FEE_BASIS[S0.feeBasis].split(' (')[0].toLowerCase())}${S0.stepDown != null ? `, ${+(S0.stepDown * 100).toFixed(2)}% after the ${S0.investYears}-year investment period` : ''}${S0.carry ? `, ${+(S0.carry * 100).toFixed(2)}% ${S0.open ? 'incentive' : 'carry'}` : ''}`,
      tiers ? `Waterfall: ${tiers.map((t) => h(NS.structures.tierLabel(t))).join('; ')}` : '',
      S0.classes ? `Share classes: ${S0.classes.map((c) => h(c.name)).join(', ')}` : '',
      S0.feeders ? `Feeder funds: ${S0.feeders.map((f) => h(f.name)).join('; ')}` : '',
      S0.sidePockets ? `Side pockets allowed${S0.sidePockets.maxPct ? ` up to ${S0.sidePockets.maxPct}% of NAV` : ''}` : '',
      S0.equalization ? h(NS.structures.EQUALIZATION[S0.equalization] || `Equalization: ${S0.equalization}`) : '',
      o.liquidity ? `Liquidity: ${h(o.liquidity.frequency)} on ${o.liquidity.notice} days’ notice${o.liquidity.lockup ? `, ${o.liquidity.lockup}-month ${o.liquidity.lockupType || ''} lock-up` : ''}${o.liquidity.gate ? `, ${o.liquidity.gate}% gate` : ''}` : '',
      `${(o.terms || []).filter((t) => t.show).length} key terms shown to investors`,
      (o.sourceDocs || []).length ? `Documents recorded: ${(o.sourceDocs || []).map((d) => h(d.name)).join(', ')} (each SHA-256 is in the change log)` : ''
    ].filter(Boolean);
    return shell(
      `${head(`${h(o.name)} is set up`, o.status === 'Raising' ? 'Investors can now review the terms and subscribe online; capital calls, statements and audit schedules use these terms.' : 'Capital accounts, statements and audit schedules now use these terms.', `<a class="cs-btn" href="#console-intake" data-action="ik-restart">Set up another</a><a class="cs-btn cs-btn-primary" href="#console-offering-${h(o.id)}">Open the offering</a>`)}
      ${NS.esign && NS.esign.agreementPanel && !NS.esign.templateReady(W(), o.id) ? `<p class="cs-hint ik-next">Next: add the subscription agreement, so every investor you invite signs it during onboarding.</p>${NS.esign.agreementPanel(W(), o, true)}` : ''}
      ${panel('What was applied', `<ul class="cs-list">${items.map((x) => `<li>${x}</li>`).join('')}</ul><p class="cs-hint">Valuations and holdings come from the fund’s books once investors are in; until then the offering carries a placeholder portfolio line.</p>`)}`,
      'console-intake'
    );
  }
  NS.views['console-intake'] = {
    mode: 'console',
    render() {
      const st = ikState();
      if (st.step === 'reading') return ikReading();
      if (st.step === 'review' && st.profile) return ikReview();
      if (st.step === 'done') return ikDone();
      return ikUpload();
    }
  };
  NS.changes['ik-files'] = (el) => {
    const st = ikState();
    st.files = Array.from(el.files || []);
    st.error = '';
    NS.app.render();
  };
  NS.changes['ik-paste'] = (el) => {
    const st = ikState();
    const was = String(st.pasted).trim().length > 40;
    st.pasted = el.value;
    if (was !== String(st.pasted).trim().length > 40) {
      const b = document.querySelector('[data-action=ik-read]');
      if (b) b.disabled = !(st.files.length || st.samples.length || String(st.pasted).trim().length > 40);
    }
  };
  NS.actions['ik-sample'] = (el) => {
    const st = ikState();
    const smp = IK().SAMPLES[el.getAttribute('data-s')];
    if (smp && !st.samples.some((x) => x.name === smp.name)) st.samples.push(smp);
    NS.app.render();
  };
  NS.binders.ikt = (path, v) => {
    ikState()[path] = v;
  };
  NS.binders.ik = (path, v) => {
    const st = ikState();
    if (!st.profile) return;
    if (path === 'fees.other') v = String(v).split('\n').map((x) => x.trim()).filter(Boolean);
    NS.app.setPath(st.profile, path, v);
    if (/\.kind$|^offering\.type$|^term\.basis$|^liquidity\.frequency$/.test(path)) NS.app.render();
  };
  NS.actions['ik-row-add'] = (el) => {
    const list = el.getAttribute('data-list');
    const arr = ikVal(list) || [];
    arr.push(IK_ROWS[list] ? IK_ROWS[list]() : {});
    NS.app.setPath(ikState().profile, list, arr);
    NS.app.render();
  };
  NS.actions['ik-row-del'] = (el) => {
    const arr = ikVal(el.getAttribute('data-list')) || [];
    arr.splice(Number(el.getAttribute('data-i')), 1);
    NS.app.render();
  };
  NS.actions['ik-restart'] = () => {
    S().ui.intake = null;
    NS.app.render();
  };
  NS.actions['ik-stop'] = () => {
    const st = ikState();
    if (st.ctl) st.ctl.abort();
  };
  NS.actions['ik-read'] = async () => {
    const st = ikState();
    if (st.step === 'reading') return;
    st.error = '';
    st.step = 'reading';
    st.docs = [];
    st.progress = 'Reading files…';
    NS.app.render();
    for (const f of st.files) {
      const rec = { name: f.name };
      st.docs.push(rec);
      NS.app.render();
      try {
        Object.assign(rec, await IK().readFile(f));
      } catch (e) {
        rec.error = (e && e.message) || 'Could not read this file.';
      }
      NS.app.render();
    }
    st.samples.forEach((x) => st.docs.push({ name: x.name, text: x.text, chars: x.text.length, pages: null, sha256: NS.audit.sha256(x.text), type: 'text/plain', size: new Blob([x.text]).size, file: new Blob([x.text], { type: 'text/plain' }) }));
    if (String(st.pasted).trim()) st.docs.push({ name: 'Pasted terms', text: st.pasted, chars: st.pasted.length, pages: null, sha256: NS.audit.sha256(st.pasted), type: 'text/plain', size: st.pasted.length });
    const good = st.docs.filter((d) => d.text && d.text.trim().length > 40);
    if (!good.length) {
      st.step = 'upload';
      st.error = 'No readable text was found. A scanned PDF needs OCR first, or paste the summary of terms.';
      return NS.app.render();
    }
    const corp = IK().corpus(good, IK().LIMIT);
    st.trimmed = corp.trimmed;
    let raw = null;
    let method = 'rules';
    let why = '';
    const sample = await IK().claudeSample();
    if (sample) {
      st.ctl = new AbortController();
      st.progress = 'Reading the offering. This usually takes one to three minutes.';
      NS.app.render();
      try {
        raw = await IK().readWithClaude(sample, corp.text, {
          signal: st.ctl.signal,
          onText: ({ text }) => {
            const el = document.getElementById('ik-progress');
            if (el) el.textContent = `Reading the offering… ${text.length.toLocaleString('en-US')} characters`;
          }
        });
        method = 'claude';
      } catch (e) {
        const c = e && e.code;
        why = c === 'cancelled' ? 'Reading was stopped. ' : c === 'not_granted' || c === 'sampling_disabled' ? 'Reading was not allowed. ' : c === 'prompt_too_large' ? 'The documents were too long to read at once. ' : c === 'rate_limited' ? 'Reading is busy right now. ' : 'Reading could not finish. ';
      }
      st.ctl = null;
    }
    if (!raw) raw = IK().readWithRules(corp.text);
    const prof = IK().normalize(raw);
    if (why) prof.notes.unshift(`${why}The built-in reader was used instead.`);
    st.profile = prof;
    st.method = method;
    st.step = 'review';
    NS.app.render();
    window.scrollTo(0, 0);
  };
  NS.actions['ik-apply'] = async () => {
    const st = ikState();
    if (!st.profile || st.busy) return;
    if (!String(st.profile.offering.name || '').trim()) return U.toast('Enter the offering name.');
    st.busy = true;
    NS.app.render();
    const docs = st.docs.filter((d) => d.text != null).map((d) => ({ name: d.name, sha256: d.sha256, pages: d.pages, chars: d.chars, size: d.size || (d.text || '').length, type: d.type || '', file: d.file || null }));
    const o = await IK().apply(W(), st.profile, { targetId: st.target, docs, publish: st.publish, method: st.method, fields: IK().filled(st.profile) });
    NS.app.save(true);
    st.busy = false;
    st.done = o.id;
    st.step = 'done';
    NS.app.render();
    window.scrollTo(0, 0);
    U.toast(`${o.name} ${st.target ? 'updated' : 'created'}.`);
  };
  NS.actions['struct-edit'] = (el) => {
    const o = W().offerings.find((x) => x.id === el.getAttribute('data-id'));
    if (!o) return;
    S().ui.intake = { step: 'review', files: [], samples: [], pasted: '', target: o.id, publish: false, docs: [], progress: '', method: 'manual', profile: IK().fromOffering(W(), o), error: '', trimmed: false, busy: false, done: '' };
    NS.app.go('console-intake');
  };
  /** Structure summary on an offering's page (read-only; the owner role can edit it). */
  function structurePanel(o) {
    if (!NS.audit || !NS.structures) return '';
    const S0 = NS.audit.settings(o);
    const X = NS.structures;
    const pc = (x) => `${+(x * 100).toFixed(2)}%`;
    const st = o.structure || {};
    const rows = [
      ['Accounting', `${h(S0.label)}, ${S0.open ? 'open-ended' : 'closed-end'}; currency ${h(S0.currency)}`],
      st.vehicle ? ['Vehicle', h([st.vehicle, st.exemption, st.eligibility].filter(Boolean).join(' · '))] : null,
      st.manager || st.gp ? ['Sponsor', h([st.manager, st.gp ? `${st.gp} (general partner)` : ''].filter(Boolean).join('; '))] : null,
      st.hardCap || st.finalClose ? ['Raise', h([st.targetSize ? `${NS.structures.fmtWhole(st.targetSize, S0.currency)} target` : '', st.hardCap ? `${NS.structures.fmtWhole(st.hardCap, S0.currency)} hard cap` : '', st.finalClose ? `final close ${st.finalClose.charAt(0).toLowerCase()}${st.finalClose.slice(1)}` : ''].filter(Boolean).join('; '))] : null,
      S0.stepDown != null ? ['Fee step-down', `${pc(S0.stepDown)} a year after the ${S0.investYears}-year investment period${S0.stepDownBasis ? ` on ${h(NS.audit.FEE_BASIS[S0.stepDownBasis].split(' (')[0].toLowerCase())}` : ''}`] : null,
      st.gpCommitment || st.callNoticeDays ? ['Commitments', h([st.gpCommitment ? `GP commits ${st.gpCommitment}` : '', st.callNoticeDays ? `capital calls on ${st.callNoticeDays} days’ notice` : ''].filter(Boolean).join('; '))] : null,
      S0.classes ? ['Share classes', S0.classes.map((c) => `${h(c.name)}: ${pc(X.pct(c.mgmtFee, S0.mgmtFee))} / ${pc(X.pct(c.carry, S0.carry))}${c.currency ? ` (${h(c.currency)})` : ''}${c.subscribedBy ? `, founders by ${date(c.subscribedBy)}` : c.note ? `, ${h(c.note)}` : ''}`).join('<br>')] : null,
      S0.feeders ? ['Feeder funds', S0.feeders.map((f) => `${h(f.name)}${f.domicile ? ` (${h(f.domicile)})` : ''}${f.for ? `: ${h(f.for)}` : ''}`).join('<br>')] : null,
      !S0.open ? ['Waterfall', `${S0.waterfallType === 'american' ? 'Deal by deal' : 'Whole fund'}: ${(S0.tiers || X.defaultTiers(S0.carry, S0.pref, S0.catchUp)).map((t) => h(X.tierLabel(t))).join('; ')}`] : ['Incentive', `${pc(S0.carry)} over each investor’s high-water mark, crystallized annually`],
      S0.sidePockets ? ['Side pockets', `${S0.sidePockets.maxPct ? `Up to ${S0.sidePockets.maxPct}% of NAV` : 'Allowed'}${S0.sidePocket ? `; ${h(S0.sidePocket.holding)} since ${date(S0.sidePocket.created)}` : ''}`] : null,
      S0.equalization ? ['Equalization', h(X.EQUALIZATION[S0.equalization] || S0.equalization)] : null,
      o.liquidity ? ['Liquidity', `${h(o.liquidity.frequency)} on ${o.liquidity.notice} days’ notice${o.liquidity.lockup ? `; ${o.liquidity.lockup}-month ${h(o.liquidity.lockupType || '')} lock-up${o.liquidity.fee ? ` (${o.liquidity.fee}% fee)` : ''}` : ''}${o.liquidity.gate ? `; ${o.liquidity.gate}% gate` : ''}`] : null,
      (o.accounting && o.accounting.otherFees && o.accounting.otherFees.length) ? ['Other fees', o.accounting.otherFees.map(h).join('<br>')] : null,
      (() => {
        const pv = Object.assign({}, st.providers || {});
        const a0 = o.accounting || {};
        const list = [['Auditor', a0.auditor || pv.auditor], ['Administrator', a0.administrator || pv.administrator], ['Counsel', pv.counsel], ['Custodian', pv.custodian], ['Prime broker', pv.primeBroker]].filter((x) => x[1]).concat((pv.others || []).map((x) => [x.role, x.name]));
        return list.length ? ['Service providers', list.map(([r, n]) => `${h(r)}: ${h(n)}`).join('<br>')] : null;
      })(),
      (o.sourceDocs || []).length ? ['Set up from', (o.sourceDocs || []).map((d) => `${h(d.name)} (${d.method === 'claude' ? 'read automatically' : d.method === 'manual' ? 'edited' : 'built-in reader'}, ${date(d.readOn)})`).join('<br>')] : null
    ].filter(Boolean);
    return panel('Structure', `<dl class="cs-kv ik-kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`, canConfigure() ? `<button class="cs-btn cs-btn-small" type="button" data-action="struct-edit" data-id="${h(o.id)}">Edit structure</button>` : '');
  }

  /** Distribution waterfall: split gross proceeds between investors and the GP before allocating. */
  function wfBody(o, d) {
    const gross = Math.round((Number(String(d.gross || '').replace(/[^\d.]/g, '')) || 0) * 100);
    if (!(gross > 0)) return '';
    const S0 = NS.audit.settings(o);
    const X = NS.structures;
    const m = (c) => X.fmt(c, S0.currency);
    const L = NS.audit.ledger(W(), o);
    const flows = (L.contribs || []).filter((c) => c.date <= d.date).map((c) => ({ date: c.date, cents: -c.cents })).concat((L.dists || []).filter((x) => x.date <= d.date).map((x) => ({ date: x.date, cents: x.cents })));
    const gpPrior = W().runs.filter((r) => r.offeringId === o.id && r.gp > 0 && r.date <= d.date).reduce((a, r) => a + r.gp, 0);
    const r = X.waterfall(S0.tiers || X.defaultTiers(S0.carry, S0.pref, S0.catchUp), flows, gpPrior, gross, d.date);
    S().ui.wf = { lp: r.lp, gp: r.gp, gross };
    return `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Tier</th><th scope="col" class="num">Investors</th><th scope="col" class="num">GP</th></tr></thead><tbody>${r.tiers.map((t) => `<tr><td>${h(t.label)}</td><td class="num">${m(t.lp)}</td><td class="num">${m(t.gp)}</td></tr>`).join('')}</tbody><tfoot><tr class="cs-total"><th scope="row">Total</th><td class="num">${m(r.lp)}</td><td class="num">${m(r.gp)}</td></tr></tfoot></table></div>
      <div class="cs-row"><button class="cs-btn cs-btn-small" type="button" data-action="dist-use-lp">Distribute the investors’ ${m(r.lp)}</button><span class="cs-hint">The GP’s ${m(r.gp)} is recorded with the distribution as carried interest paid.</span></div>`;
  }
  function wfPreview(o, d) {
    if (!NS.audit || !NS.structures || !o) return '';
    const S0 = NS.audit.settings(o);
    if (S0.open || !(S0.carry > 0 || S0.tiers)) return '';
    return `<div class="wf-box"><label class="cs-field" for="ds-gross"><span>Gross proceeds to split through the waterfall <em>Optional</em></span><input id="ds-gross" type="text" inputmode="decimal" data-bind="dist:gross" value="${h(d.gross || '')}"><span class="cs-hint">${h((S0.tiers || NS.structures.defaultTiers(S0.carry, S0.pref, S0.catchUp)).map((t) => NS.structures.tierLabel(t)).join('; '))}. Uses every contribution and distribution to date.</span></label><div id="ds-wf-body">${wfBody(o, d)}</div></div>`;
  }
  NS.actions['dist-use-lp'] = () => {
    const d = draft();
    const r = S().ui.wf;
    if (!r) return;
    d.mode = 'total';
    d.total = (r.lp / 100).toFixed(2);
    d.wf = { lp: r.lp, gp: r.gp, gross: r.gross };
    NS.app.render();
  };


  /* ---------- Audit: audit-ready schedules for each fund ---------- */
  function audState() {
    const u = S().ui;
    const w = W();
    if (!u.aud || !w.offerings.some((o) => o.id === u.aud.offering)) {
      const o = w.offerings.find((x) => !x.exit || x.exit.basis !== 'exited') || w.offerings[0];
      const pre = o ? NS.audit.presets(w, o)[0] : null;
      u.aud = { offering: o ? o.id : '', preset: 'fy', from: pre ? pre.from : '', to: pre ? pre.to : '', tab: 'rollforward' };
    }
    return u.aud;
  }
  const audOff = () => W().offerings.find((o) => o.id === audState().offering);
  function audApplyPreset(a) {
    const o = audOff();
    const p = o && NS.audit.presets(W(), o).find((x) => x.id === a.preset);
    if (p) {
      a.from = p.from;
      a.to = p.to;
    }
  }
  function audCheck(c) {
    const ic = c.status === 'pass' ? icon('check') : c.status === 'na' ? '<span class="aud-dash" aria-hidden="true">–</span>' : icon('alert');
    const res = c.status === 'pass' ? 'Pass' : c.status === 'na' ? 'Not applicable' : `${c.items.length} exception${c.items.length === 1 ? '' : 's'}`;
    return `<li class="aud-check is-${c.status}">
      <span class="aud-ic">${ic}</span>
      <div class="aud-check-body">
        <div class="aud-check-head"><strong>${h(c.title)}</strong><span class="aud-res">${res}</span></div>
        <p>${h(c.detail)}</p>
        ${c.items.length ? `<details${c.items.length <= 3 ? ' open' : ''}><summary>${c.items.length <= 3 ? 'Exceptions' : `Show ${c.items.length} exceptions`}</summary><ul>${c.items.map((x) => `<li>${h(x)}</li>`).join('')}</ul></details>` : ''}
      </div>
    </li>`;
  }
  function audTable(s, limit) {
    const A = NS.audit;
    const num = (c) => ['money', 'pct', 'ratio', 'price', 'int', 'qty'].indexOf(c.t) >= 0;
    const cell = (c, v, tag) => {
      const txt = A.display(c, v);
      const hash = /hash/i.test(c.h) && txt.length > 16;
      return `<${tag}${num(c) ? ' class="num"' : ''}${hash ? ` title="${h(txt)}"` : ''}>${h(hash ? txt.slice(0, 12) + '…' : txt)}</${tag}>`;
    };
    const body = s.rows.slice(0, limit).map((r) => `<tr>${s.cols.map((c, i) => cell(c, r[i], 'td')).join('')}</tr>`).join('');
    const total = s.total ? `<tfoot><tr>${s.cols.map((c, i) => cell(c, s.total[i], 'td')).join('')}</tr></tfoot>` : '';
    return `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact aud-tbl"><thead><tr>${s.cols.map((c) => `<th scope="col"${num(c) ? ' class="num"' : ''}>${h(c.h)}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${s.cols.length}" class="cs-muted">No rows for this period.</td></tr>`}</tbody>${total}</table></div>${s.rows.length > limit ? `<p class="cs-hint">Showing ${limit} of ${s.rows.length} rows. The CSV has every row.</p>` : ''}`;
  }
  NS.views['console-audit'] = {
    mode: 'console',
    render() {
      const w = W();
      const A = NS.audit;
      if (!w.offerings.length) return shell(`${head('Audit')}${panel('', '<p class="cs-muted">No offerings yet. Audit schedules appear once an offering has investors.</p>')}`, 'console-audit');
      const a = audState();
      const o = audOff();
      const cfg = A.settings(o);
      const B = A.build(w, o, a.from, a.to);
      S().ui.audBuild = B;
      const P = B.P;
      const f = P.fund;
      const exCount = B.chk.filter((c) => c.status === 'exception').reduce((n, c) => n + c.items.length, 0);
      const pass = B.chk.filter((c) => c.status === 'pass').length;
      const applicable = B.chk.filter((c) => c.status !== 'na').length;
      const tab = B.list.find((s) => s.id === a.tab) || B.list[0];
      const lastExport = A.ensureLog(w).filter((e) => e.action === 'Audit package exported' && e.fund === o.id).pop();
      const auditor = cfg.auditor || T().auditor;
      return shell(
        `${head('Audit', 'Audit-ready records for each fund: financial statements, capital accounts, investor register, capital activity, schedule of investments, fees, performance and a tamper-evident change log. Every schedule ties to the others, and the checks list anything to resolve before fieldwork.', `<button class="cs-btn cs-btn-primary" type="button" data-action="aud-zip">${icon('download')}Download audit package</button>`)}
        ${panel(
          '',
          `<div class="cs-grid cs-grid-3">
            <label class="cs-field cs-wide" for="aud-offering"><span>Fund</span><select id="aud-offering" data-bind="aud:offering">${w.offerings.map((x) => `<option value="${h(x.id)}"${x.id === o.id ? ' selected' : ''}>${h(x.name)} · ${h(A.settings(x).label)}</option>`).join('')}</select></label>
            <label class="cs-field" for="aud-preset"><span>Period</span><select id="aud-preset" data-bind="aud:preset">${A.presets(w, o).map((p) => `<option value="${p.id}"${a.preset === p.id ? ' selected' : ''}>${h(p.label)}</option>`).join('')}<option value="custom"${a.preset === 'custom' ? ' selected' : ''}>Custom dates</option></select></label>
            <label class="cs-field" for="aud-from"><span>From</span><input id="aud-from" type="date" data-bind="aud:from" value="${h(a.from)}"></label>
            <label class="cs-field" for="aud-to"><span>To</span><input id="aud-to" type="date" data-bind="aud:to" value="${h(a.to)}"></label>
          </div>
          <p class="cs-hint">${h(o.type)}: ${cfg.open ? 'open-ended, monthly net asset value' : 'closed-end, quarterly valuations'}. Fiscal year ends December 31.${auditor ? ` Auditor: ${h(auditor)}.` : ''} Valuations are month-end, so this package covers ${date(P.from)} to ${date(P.to)}.</p>`
        )}
        <dl class="cs-figs">
          <div><dt>Net assets, ${date(P.to)}</dt><dd>${usdc(f.end + f.gpEnd)}</dd></div>
          <div><dt>Contributions</dt><dd>${usdc(f.contrib)}</dd></div>
          <div><dt>Distributions</dt><dd>${usdc(f.dist)}</dd></div>
          <div><dt>Net increase from operations</dt><dd>${usdc(f.income - f.fee + f.gain)}</dd></div>
        </dl>
        ${panel(`Audit readiness <span class="cs-count">${pass} of ${applicable} checks pass${exCount ? ` · ${exCount} exception${exCount === 1 ? '' : 's'} to resolve` : ''}</span>`, `<ul class="aud-checks">${B.chk.map(audCheck).join('')}</ul>`)}
        ${panel(
          `Audit package <span class="cs-count">${B.list.length + 2} files</span>`,
          `<p class="cs-muted">One .zip with every schedule as a CSV, a README that explains how they tie and the basis of preparation, and a SHA-256 manifest so the auditor can confirm nothing changed after export. Every download is recorded in the change log.</p>
          <div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">File</th><th scope="col">Schedule</th><th scope="col" class="num">Rows</th><th scope="col"><span class="sr-only">Download</span></th></tr></thead><tbody>
          ${B.list.map((s) => `<tr><td class="nowrap"><code>${h(s.file)}</code></td><td>${h(s.title)}</td><td class="num">${s.rows.length}</td><td class="num"><button class="cs-btn cs-btn-small" type="button" data-action="aud-csv" data-id="${s.id}">CSV</button></td></tr>`).join('')}
          </tbody></table></div>
          ${lastExport ? `<p class="cs-hint">Last exported ${date(lastExport.at.slice(0, 10))} by ${h(lastExport.actor)}: <code>${h(lastExport.record)}</code>. ${h(lastExport.detail)}.</p>` : ''}`
        )}
        ${panel(
          'Preview',
          `<div class="cs-tabs aud-tabs" role="group" aria-label="Schedule">${B.list.map((s) => `<button type="button" class="cs-tab" data-action="aud-tab" data-t="${s.id}" aria-pressed="${s.id === tab.id}">${h(s.title)}</button>`).join('')}</div>
          <p class="cs-muted aud-desc">${h(tab.desc)}</p>
          ${audTable(tab, 60)}`
        )}`,
        'console-audit'
      );
    }
  };
  NS.binders.aud = (path, v) => {
    const a = audState();
    if (path === 'offering') {
      a.offering = v;
      if (a.preset !== 'custom') audApplyPreset(a);
    } else if (path === 'preset') {
      a.preset = v;
      if (v !== 'custom') audApplyPreset(a);
    } else if (path === 'from' || path === 'to') {
      if (!v) return;
      a[path] = v;
      a.preset = 'custom';
    }
    NS.app.render();
  };
  NS.actions['aud-tab'] = (el) => {
    audState().tab = el.getAttribute('data-t');
    NS.app.render();
  };
  NS.actions['aud-zip'] = () => {
    const a = audState();
    const o = audOff();
    if (!o) return;
    const pkg = NS.audit.exportPackage(W(), o, a.from, a.to);
    U.download(pkg.name, pkg.bytes, { mime: 'application/zip' });
    NS.app.render();
  };
  NS.actions['aud-csv'] = (el) => {
    const B = S().ui.audBuild;
    const o = audOff();
    const s = B && o && B.list.find((x) => x.id === el.getAttribute('data-id'));
    if (!s) return;
    const fund = String(o.shortName || o.name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    NS.audit.log(W(), { action: 'Audit schedule downloaded', fund: o.id, record: s.file, detail: `${s.title}, ${date(B.P.from)} to ${date(B.P.to)}` });
    U.download(`${slug()}_${fund}_${B.P.from}_to_${B.P.to}_${s.file}`, NS.audit.toCsv(s), { mime: 'text/csv' });
  };

  /* ---------- ACH origination ---------- */
  function achField(label, path, opts) {
    opts = opts || {};
    const v = NS.app.getPath(T().ach, path) || '';
    const id = 'ach-' + path.replace(/\./g, '-');
    let status = '';
    if (opts.routing) status = v ? (NS.nacha.abaValid(v) ? '<span class="cs-ok">Valid routing number</span>' : '<span class="cs-error">Fails the ABA check digit</span>') : '';
    if (opts.max) status += `<span class="cs-hint cs-counter" id="${id}-n">${String(v).length} of ${opts.max}</span>`;
    return `<label class="cs-field${opts.wide ? ' cs-wide' : ''}" for="${id}"><span>${label}</span><input id="${id}" type="text" data-bind="ach:${path}" value="${h(v)}"${opts.max ? ` maxlength="${opts.max}"` : ''}${opts.upper ? ' data-upper' : ''} spellcheck="false" autocomplete="off"${opts.numeric ? ' inputmode="numeric"' : ''}><span class="cs-field-status" id="${id}-s">${status}</span>${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}</label>`;
  }
  NS.views['console-ach'] = {
    mode: 'console',
    render() {
      const a = T().ach;
      const w = W();
      const overrides = w.offerings
        .map((o) => {
          const c = companyFor(o);
          return `<tr><td><a href="#console-offering-${h(o.id)}">${h(o.name)}</a></td><td><code>${h(c.name)}</code></td><td><code>${h(c.id)}</code></td><td>${o.achOverride && (o.achOverride.companyName || o.achOverride.companyId) ? 'Offering' : DEF}</td></tr>`;
        })
        .join('');
      return shell(
        `${head('ACH origination', 'Bank details used to build NACHA files for distributions. Copy these from the bank’s ACH origination agreement.', achReady() ? ok(true, 'Ready to generate files') : ok(false, 'Incomplete'))}
        ${panel('Originating bank (ODFI)', `<div class="cs-grid">
          ${achField('Bank name', 'odfiName', { max: 40 })}
          ${achField('Routing number', 'odfiRouting', { routing: true, numeric: true, max: 9 })}
        </div>`)}
        ${panel('File header', `<div class="cs-grid">
          ${achField('Immediate destination routing', 'destinationRouting', { routing: true, numeric: true, max: 9, hint: 'Usually the same as the ODFI routing number.' })}
          ${achField('Immediate destination name', 'destinationName', { max: 23, upper: true })}
          ${achField('Immediate origin', 'immediateOrigin', { max: 10, hint: 'Assigned by the bank. Often 1 followed by your EIN.' })}
          ${achField('Immediate origin name', 'originName', { max: 23, upper: true })}
        </div>`)}
        ${panel('Batch defaults', `<div class="cs-grid">
          ${achField('Company name', 'companyName', { max: 16, upper: true, hint: 'Shown on investors’ bank statements.' })}
          ${achField('Company ID', 'companyId', { max: 10 })}
          ${achField('Entry description', 'entryDescription', { max: 10, upper: true })}
          <div class="cs-field"><span>SEC codes</span><p class="cs-static">PPD for individuals, joint accounts and trusts. CCD for entities and IRA custodians. Files are split into one batch per code.</p></div>
        </div>`)}
        ${panel('Balanced files', `<div class="cs-grid">
          <label class="cs-check cs-wide" for="ach-balanced"><input id="ach-balanced" type="checkbox" data-bind="ach:balanced"${a.balanced ? ' checked' : ''}><span>Add an offsetting debit to each batch. Some banks require this; most do not.</span></label>
          ${a.balanced ? `${achField('Settlement routing number', 'offset.routing', { routing: true, numeric: true, max: 9 })}${achField('Settlement account number', 'offset.account', { numeric: true, max: 17 })}` : ''}
        </div>`)}
        ${panel('Paying entity by offering', w.offerings.length ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Offering</th><th scope="col">Company name</th><th scope="col">Company ID</th><th scope="col">Source</th></tr></thead><tbody>${overrides}</tbody></table></div><p class="cs-hint">Set a different company name and ID on an offering when it pays from its own bank account.</p>` : '<p class="cs-muted">No offerings yet.</p>')}`,
        'console-ach'
      );
    }
  };
  NS.binders.ach = (path, v) => {
    const before = NS.app.getPath(T().ach, path);
    const mask = (x) => (/account/i.test(path) && x ? `ending ${String(x).slice(-4)}` : short(x));
    if (NS.audit) NS.audit.log(W(), { coalesce: 'ach:' + path, action: 'ACH settings updated', record: 'ach', from: before, to: v, detailFor: (a, b) => `${path}: ${mask(a)} → ${mask(b)}` });
    NS.app.setPath(T().ach, path, v);
    NS.app.save();
    if (path === 'balanced') return NS.app.render();
    const id = 'ach-' + path.replace(/\./g, '-');
    const el = document.getElementById(id);
    const s = document.getElementById(id + '-s');
    if (s && el) {
      const max = el.getAttribute('maxlength');
      let html = '';
      if (/routing/i.test(path)) html = v ? (NS.nacha.abaValid(v) ? '<span class="cs-ok">Valid routing number</span>' : '<span class="cs-error">Fails the ABA check digit</span>') : '';
      if (max) html += `<span class="cs-hint cs-counter">${String(v).length} of ${max}</span>`;
      s.innerHTML = html;
    }
    const flag = document.querySelector('.cs-head .cs-flag');
    if (flag) flag.outerHTML = achReady() ? ok(true, 'Ready to generate files') : ok(false, 'Incomplete');
  };

  /* ---------- Portal and brand ---------- */
  const PRESETS = [
    ['#0F2742', '#1F7A8C', 'Navy and teal'],
    ['#14304F', '#B4873F', 'Navy and brass'],
    ['#7A2E3A', '#B38B59', 'Burgundy and sand'],
    ['#2F5D3A', '#A8622A', 'Forest and copper'],
    ['#1D1D1F', '#9A7B3F', 'Charcoal and gold'],
    ['#3B2F63', '#B0703F', 'Plum and copper'],
    ['#0B5563', '#5C7A8A', 'Deep teal and slate'],
    ['#4A5A6A', '#2E5E8C', 'Slate and blue']
  ];
  function tField(label, path, opts) {
    opts = opts || {};
    const v = NS.app.getPath(T(), path);
    const id = 'tb-' + path.replace(/\./g, '-');
    if (opts.textarea) return `<label class="cs-field cs-wide" for="${id}"><span>${label}</span><textarea id="${id}" rows="${opts.rows || 3}" data-bind="tenant:${path}" maxlength="${opts.max || 600}">${h(v)}</textarea></label>`;
    return `<label class="cs-field${opts.wide ? ' cs-wide' : ''}" for="${id}"><span>${label}</span><input id="${id}" type="text" data-bind="tenant:${path}" value="${h(v == null ? '' : v)}" maxlength="${opts.max || 80}"${opts.spell === false ? ' spellcheck="false"' : ''}${opts.upper ? ' data-upper' : ''}>${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}</label>`;
  }
  function seg(label, path, options) {
    const v = NS.app.getPath(T(), path);
    return `<fieldset class="cs-field"><legend>${label}</legend><div class="cs-seg">${options.map(([val, l]) => `<label><input type="radio" name="tb-${path.replace(/\./g, '-')}" value="${val}" data-bind="tenant:${path}"${v === val ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`;
  }
  function tCheck(label, path, hint) {
    const v = NS.app.getPath(T(), path);
    return `<label class="cs-check cs-wide" for="tb-${path.replace(/\./g, '-')}"><input id="tb-${path.replace(/\./g, '-')}" type="checkbox" data-bind="tenant:${path}"${v ? ' checked' : ''}><span>${label}${hint ? `<span class="cs-hint">${hint}</span>` : ''}</span></label>`;
  }
  function colorField(label, key) {
    const v = B.normHex(T().colors[key]) || '#000000';
    return `<div class="cs-field"><label for="tb-color-${key}">${label}</label><div class="cs-color"><input type="color" id="tb-color-${key}-pick" aria-label="${label} picker" data-bind="tenant:colors.${key}" value="${v.toLowerCase()}"><input type="text" id="tb-color-${key}" data-bind="tenant:colors.${key}" data-hex value="${v}" maxlength="7" spellcheck="false"></div></div>`;
  }
  function reportHTML() {
    return B.derive(T())
      .report.filter((r) => r.key !== 'chart')
      .map((r) => `<li><span>${h(r.label)}</span><span class="cs-num">${r.ratio.toFixed(1)}:1</span>${r.adjusted ? '<span class="cs-badge cs-badge-adj">Adjusted</span>' : r.ratio >= r.target ? '<span class="cs-badge cs-badge-ok">Pass</span>' : '<span class="cs-badge cs-badge-bad">Low</span>'}</li>`)
      .join('');
  }
  function brandPreview() {
    const t = T();
    return `<div class="pv">
      <p class="pv-label">Investor portal preview</p>
      <div class="pv-portal pv-shell">
        <div class="pv-head"><span class="pt-logo">${B.lockup(t)}</span><span class="pv-nav"><span class="is-on">Investments</span><span>Distributions</span><span>Documents</span></span></div>
        <div class="pv-in">
          <h3>Investments</h3>
          <dl class="pv-figs"><div><dt>Invested</dt><dd>$500,000</dd></div><div><dt>Distributions received</dt><dd>$117,625.00</dd></div></dl>
          <div class="pv-row"><a>${h(t.shortName)} Sample Offering</a><span>$250,000</span></div>
          <div class="pv-hold">${NS.holdBar({ progress: 0.62, windowStart: 0.72, remaining: 'Exit window opens in 7 months' })}</div>
          <span class="btn btn-primary pv-btn">Sign in</span>
        </div>
      </div>
      <p class="pv-label">Accessibility check</p>
      <ul class="cs-report" id="tb-report">${reportHTML()}</ul>
      <p class="cs-hint">If a brand color is too light or dark to read as text, the portal uses a deeper or brighter step of the same hue. Buttons keep the exact color.</p>
    </div>`;
  }
  NS.views['console-brand'] = {
    mode: 'console',
    render() {
      const t = T();
      const builtin = NS.workspace.isBuiltin(t.id);
      const marks = Object.keys(B.MARKS)
        .map((k) => `<button type="button" class="cs-mark" data-action="mark" data-mark="${k}" aria-pressed="${t.logo.type === k}"><svg viewBox="0 0 40 40" aria-hidden="true">${B.markBody(k, t.logo.letters, { p: t.colors.primary, a: t.colors.accent, ink: B.onColor(t.colors.primary) }, 'Manrope, sans-serif')}</svg><span>${B.MARKS[k].label}</span></button>`)
        .join('');
      const img = B.safeImage(t.logo.image);
      return shell(
        `${head('Portal and brand', E.diy ? 'How your portal looks to investors, and what onboarding asks of them.' : 'How this client’s portal looks to investors, and what onboarding asks of them.')}
        <div class="cs-split">
          <div class="cs-split-main">
            ${panel('Identity', `<div class="cs-grid">
              ${tField('Firm name', 'name')}
              ${tField('Short name', 'shortName', { max: 32 })}
              ${tField('Logo tagline', 'tagline', { max: 40, hint: 'Small line under the name. Leave blank to hide.' })}
              ${tField('Legal entity', 'legalName', { max: 120 })}
              ${tField('Portal name', 'portalName', { max: 40 })}
              ${tField('Custom domain', 'domain', { spell: false, hint: 'Requires a DNS record pointing to the platform.' })}
            </div>`)}
            ${panel('Logo', `<div class="cs-marks">${marks}${img ? `<button type="button" class="cs-mark" data-action="mark" data-mark="image" aria-pressed="${t.logo.type === 'image'}"><img src="${img}" alt=""><span>Uploaded</span></button>` : ''}</div>
              <div class="cs-grid">
                ${tField('Monogram letters', 'logo.letters', { max: 3, upper: true, spell: false })}
                <div class="cs-field"><span>Logo file</span><label class="cs-btn cs-upload" for="tb-logo">${icon('up')}Upload image<input type="file" id="tb-logo" class="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-change="logo-file"></label><span class="cs-hint">PNG, SVG, JPG or WebP under 400 KB</span><span class="cs-error" id="tb-logo-err" hidden></span></div>
                ${tCheck('Place the logo on a white tile', 'logo.plate', 'Use with a brand-colored header and a dark logo file.')}
              </div>`)}
            ${panel('Color', `<div class="cs-grid">${colorField('Primary', 'primary')}${colorField('Accent', 'accent')}</div>
              <div class="cs-presets">${PRESETS.map((p) => `<button type="button" class="cs-preset" data-action="preset" data-p="${p[0]}" data-a="${p[1]}" aria-label="${p[2]}" title="${p[2]}"><span style="background:${p[0]}"></span><span style="background:${p[1]}"></span></button>`).join('')}</div>`)}
            ${panel('Type and layout', `<div class="cs-grid">
              <fieldset class="cs-field cs-wide"><legend>Typeface</legend><div class="cs-fonts">${Object.keys(B.FONTS)
                .map((k) => `<label class="cs-font"><input type="radio" name="tb-font" value="${k}" data-bind="tenant:font"${t.font === k ? ' checked' : ''}><span><span class="cs-font-aa" style="font-family:${h(B.FONTS[k].display)}">Aa</span><strong>${B.FONTS[k].label}</strong></span></label>`)
                .join('')}</div></fieldset>
              ${seg('Header', 'nav', [['light', 'White'], ['brand', 'Brand color']])}
              ${seg('Corners', 'radius', [['sharp', 'Square'], ['soft', 'Rounded']])}
              ${seg('Appearance', 'appearance', [['system', 'Follow device'], ['light', 'Light'], ['dark', 'Dark']])}
            </div>`)}
            ${panel('Investor onboarding', `<div class="cs-grid">
              ${tCheck('Ask for accreditation', 'onboarding.accreditation', 'Regulation D 506(b) and 506(c) offerings.')}
              ${tCheck('Collect a substitute W-9 certification', 'onboarding.taxForm')}
              ${tCheck('Require consent to electronic delivery', 'onboarding.esign')}
              ${seg('Direct deposit', 'onboarding.ach', [['required', 'Required'], ['optional', 'Optional (check allowed)']])}
            </div>`)}
            ${panel('Support and disclosures', `<div class="cs-grid">
              ${tField('Team name', 'support.team')}
              ${tField('Email', 'support.email', { spell: false })}
              ${tField('Phone', 'support.phone')}
              ${tField('Hours', 'support.hours')}
              ${tField('Sign-in heading', 'signin.headline', { max: 60 })}
              ${tField('Sign-in text', 'signin.sub', { max: 140 })}
              ${tField('Footer disclosure', 'disclaimer', { textarea: true, rows: 4 })}
              ${canConfigure() && E.poweredBy ? tCheck(`Show “Powered by ${E.poweredBy}”`, 'showPoweredBy', E.managed ? 'Off by default. Investors see only the client.' : 'Off by default. Investors see only your firm.') : ''}
            </div>`)}
            ${!canConfigure() ? '' : panel('Configuration', `<p class="cs-hint">${E.diy ? 'Your portal’s configuration as JSON, for backup or to move it.' : 'The client’s full configuration as JSON, for engineering hand-off or to copy a setup to another client.'}</p>
              <div class="cs-row"><button class="cs-btn" type="button" data-action="cfg-copy">Copy JSON</button><button class="cs-btn cs-btn-danger" type="button" data-action="cfg-reset">${S().ui.cfgReset ? 'Click again to confirm' : builtin ? 'Restore sample data' : 'Delete this client'}</button></div>`)}
          </div>
          <aside class="cs-split-side" id="tb-preview">${brandPreview()}</aside>
        </div>`,
        'console-brand'
      );
    }
  };
  NS.binders.tenant = (path, v, el) => {
    if (!canConfigure()) return;
    if (NS.audit) NS.audit.log(W(), { coalesce: 'tenant:' + path, action: 'Portal settings updated', record: 'portal', from: NS.app.getPath(T(), path), to: v, detailFor: (a, b) => `${path}: ${short(a)} → ${short(b)}` });
    if (path.indexOf('colors.') === 0) {
      const hex = B.normHex(v);
      el.classList.toggle('is-invalid', !hex);
      if (!hex) return;
      v = hex;
      const key = path.split('.')[1];
      const other = el.type === 'color' ? document.getElementById(`tb-color-${key}`) : document.getElementById(`tb-color-${key}-pick`);
      if (other && document.activeElement !== other) other.value = el.type === 'color' ? hex : hex.toLowerCase();
    }
    NS.app.setPath(T(), path, v);
    NS.app.applyTenant();
    const pv = document.getElementById('tb-preview');
    if (pv) pv.innerHTML = brandPreview();
    if (path === 'name') {
      const n = document.querySelector('.cs-client-name');
      if (n) n.textContent = v;
      const opt = document.querySelector(`#op-client option[value="${T().id}"]`);
      if (opt) opt.textContent = v;
    }
  };
  NS.actions.mark = staffGuard((el) => {
    audit('Portal settings updated', `Logo mark: ${el.getAttribute('data-mark')}`, '', 'portal');
    T().logo.type = el.getAttribute('data-mark');
    NS.app.applyTenant();
    NS.app.render();
  });
  NS.actions.preset = staffGuard((el) => {
    audit('Portal settings updated', `Colors: ${el.getAttribute('data-p')} and ${el.getAttribute('data-a')}`, '', 'portal');
    T().colors.primary = el.getAttribute('data-p');
    T().colors.accent = el.getAttribute('data-a');
    NS.app.applyTenant();
    NS.app.render();
  });
  NS.changes['logo-file'] = staffGuard((el) => {
    const file = el.files && el.files[0];
    const err = document.getElementById('tb-logo-err');
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 400 * 1024) {
      err.textContent = file.size > 400 * 1024 ? `That file is ${Math.round(file.size / 1024)} KB. Use one under 400 KB.` : 'Use a PNG, SVG, JPG or WebP file.';
      err.hidden = false;
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      if (!B.safeImage(String(r.result))) {
        err.textContent = 'That image could not be read. Export it again as PNG.';
        err.hidden = false;
        return;
      }
      T().logo.image = String(r.result);
      T().logo.type = 'image';
      NS.app.applyTenant();
      NS.app.render();
      U.toast('Logo uploaded');
    };
    r.readAsDataURL(file);
  });
  NS.actions['cfg-copy'] = () => U.copy(JSON.stringify({ tenant: T(), offerings: W().offerings }, null, 2));
  NS.actions['cfg-reset'] = staffGuard(() => {
    if (!S().ui.cfgReset) {
      S().ui.cfgReset = true;
      NS.app.render();
      return;
    }
    const id = T().id;
    const builtin = NS.workspace.isBuiltin(id);
    NS.workspace.reset(id);
    // DIY: a deleted portal goes back to sign-up; sample firms reload fresh.
    if (E.diy && !builtin) {
      NS.store.del('active');
      NS.app.setClient(null, 'diy-start');
    } else NS.app.setClient(builtin ? id : NS.DEFAULT_TENANT, 'console');
    U.toast(builtin ? 'Sample data restored' : E.diy ? 'Portal deleted' : 'Client deleted');
  });
})(window.CVPortal);
