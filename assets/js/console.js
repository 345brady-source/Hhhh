/*
 * Sponsor console (Carrow & Vale operated): client setup, per-offering
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

  /* ---------- Shell ---------- */
  const NAV = [
    ['console', 'Overview'],
    ['console-offerings', 'Offerings'],
    ['console-investors', 'Investors'],
    ['console-distributions', 'Distributions'],
    ['console-notices', 'Notices'],
    ['console-reports', 'Reports'],
    ['console-ach', 'ACH origination'],
    ['console-brand', 'Portal and brand']
  ];
  function shell(inner, active) {
    const t = T();
    return `<div class="cs">
      <aside class="cs-nav" aria-label="Sponsor console">
        <div class="cs-client">${B.lockup(t)}<span class="cs-client-meta">${h(t.domain)}</span></div>
        <nav>${NAV.map(([k, l]) => `<a href="#${k}"${active === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
      </aside>
      <main class="cs-main" id="main" tabindex="-1">${inner}</main>
    </div>`;
  }
  const head = (title, sub, actions) => `<div class="cs-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="cs-actions">${actions}</div>` : ''}</div>`;
  const panel = (title, body, extra) => `<section class="cs-panel">${title ? `<div class="cs-panel-head"><h2>${title}</h2>${extra || ''}</div>` : ''}${body}</section>`;
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
    const o = inv.onboarding;
    if (o.status === 'complete') return `Active${o.completed ? ' since ' + date(o.completed) : ''}`;
    if (o.status === 'in_progress') return `In progress · ${o.step || 0} of 5 steps`;
    return `Invited ${date(o.invited)}`;
  }

  /* ---------- Overview and client setup ---------- */
  NS.views.console = {
    mode: 'console',
    render() {
      const w = W();
      const t = T();
      const branded = t.domain && t.domain !== NS.TENANT_TEMPLATE.domain && t.support.email !== NS.TENANT_TEMPLATE.support.email;
      const steps = [
        ['Brand the investor portal', 'Logo, colors, domain, support contact and disclosures.', branded, 'console-brand'],
        ['Set up ACH origination', 'The bank and company IDs used to pay distributions by ACH.', achReady(), 'console-ach'],
        ['Add offerings', 'Each investment with its own exit timing, distribution schedule and terms.', w.offerings.length > 0, 'console-offerings'],
        ['Invite investors', 'Add investors one at a time or import a list. Each receives an activation email.', w.investors.length > 0, 'console-investors'],
        ['Run the first distribution', 'Allocate a payment pro rata and generate the NACHA file for the bank.', w.runs.length > 0, 'console-distributions']
      ];
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
      return shell(
        `${head(h(t.name), `${w.offerings.length} offerings · ${w.investors.length} investors`)}
        ${
          done < steps.length
            ? panel(
                `Client setup <span class="cs-count">${done} of ${steps.length} complete</span>`,
                `<ol class="cs-steps">${steps
                  .map((s, i) => `<li class="${s[2] ? 'is-done' : ''}"><span class="cs-step-n">${s[2] ? icon('check') : i + 1}</span><div><strong>${s[0]}</strong><span>${s[1]}</span></div><a class="cs-btn cs-btn-small${s[2] ? '' : ' cs-btn-primary'}" href="#${s[3]}">${s[2] ? 'Review' : 'Start'}</a></li>`)
                  .join('')}</ol>`
              )
            : ''
        }
        <dl class="cs-figs">
          <div><dt>Active offerings</dt><dd>${w.offerings.filter((o) => o.status !== 'Exited').length}</dd></div>
          <div><dt>Investors</dt><dd>${w.investors.length}</dd></div>
          <div><dt>Capital raised</dt><dd>${usd(w.offerings.reduce((a, o) => a + raised(o.id), 0))}</dd></div>
          <div><dt>Distributed, last 12 months</dt><dd>${usdc(paid12)}</dd></div>
        </dl>
        ${panel('Needs attention', attention.length ? `<ul class="cs-list">${attention.join('')}</ul>` : '<p class="cs-muted">Nothing needs attention.</p>')}
        ${panel(
          'Recent distributions',
          w.runs.length ? runsTable(w.runs.slice(0, 6), false) : '<p class="cs-muted">No distributions yet. <a href="#console-distributions">Create the first one</a>.</p>',
          '<a class="cs-link" href="#console-distributions">All distributions</a>'
        )}
        ${done === steps.length ? `<p class="cs-muted cs-setup-done">${icon('check')} Client setup complete.</p>` : ''}`,
        'console'
      );
    }
  };

  NS.views['console-new-client'] = {
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
        `${head('Offerings', 'Each investment is configured separately: how exit is defined, how often it pays, and which terms investors see.', '<button class="cs-btn cs-btn-primary" type="button" data-action="off-add">Add offering</button>')}
        ${panel(
          '',
          w.offerings.length
            ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Offering</th><th scope="col">Type</th><th scope="col">Closed</th><th scope="col" class="num">Raised</th><th scope="col" class="num">Investors</th><th scope="col">Distributions</th><th scope="col">Exit</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
            : '<p class="cs-muted">No offerings yet. Add the first one to start inviting investors.</p>'
        )}`,
        'console-offerings'
      );
    }
  };
  NS.actions['off-add'] = () => {
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
    NS.app.save(true);
    NS.app.go('console-offering-' + id);
  };

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
    return `<label class="cs-field${opts.wide ? ' cs-wide' : ''}" for="${id}"><span>${label}</span><input id="${id}" type="${opts.type || 'text'}" data-bind="off:${path}" value="${h(v == null ? '' : v)}"${opts.max ? ` maxlength="${opts.max}"` : ''}${opts.upper ? ' data-upper' : ''}${opts.spell === false ? ' spellcheck="false"' : ''}>${opts.hint ? `<span class="cs-hint">${opts.hint}</span>` : ''}</label>`;
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
  NS.views['console-offering'] = {
    mode: 'console',
    render() {
      const o = curOff();
      if (!o) return shell(`${head('Offering not found')}<p class="cs-muted"><a href="#console-offerings">Back to offerings</a></p>`, 'console-offerings');
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
        ${head(h(o.name), `${h(o.type)} · ${n} investor${n === 1 ? '' : 's'} · ${usd(raised(o.id))} raised`, n ? `<button class="cs-btn" type="button" data-action="off-preview">Preview as investor</button>` : '')}
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
            </div>`)}
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
            ${panel(
              'Key terms shown to investors',
              `<div class="terms-edit">${terms || '<p class="cs-muted">No terms yet.</p>'}</div>
              <div class="cs-row"><button class="cs-btn cs-btn-small" type="button" data-action="term-add">${icon('plus')}Add term</button><button class="cs-btn cs-btn-small" type="button" data-action="term-defaults">Add the standard terms for ${h(o.type)}</button></div>`
            )}
            ${panel('Latest update', `<div class="cs-grid">${offField('Shown on the investment page', 'update', { textarea: true, rows: 3, max: 600 })}</div>`)}
            ${panel(
              'ACH originator for this offering',
              `<div class="cs-grid">
                ${offField('Company name (16)', 'achOverride.companyName', { max: 16, upper: true, hint: `Appears on investors' bank statements. Blank uses ${h(T().ach.companyName || 'the client default')}.` })}
                ${offField('Company ID (10)', 'achOverride.companyId', { max: 10, spell: false, hint: 'Usually 1 followed by the paying entity’s EIN. Blank uses the client default.' })}
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
  NS.binders.off = (path, v) => {
    const o = curOff();
    if (!o) return;
    if (path === 'minimum') v = Number(v) || 0;
    if (path === 'distribution.day') v = Number(v) || 15;
    NS.app.setPath(o, path, v);
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
  NS.actions['term-add'] = () => {
    curOff().terms.push({ label: '', value: '', show: true });
    NS.app.save();
    NS.app.render();
    const ins = document.querySelectorAll('.term-row input[type="text"]');
    if (ins.length) ins[ins.length - 2].focus();
  };
  NS.actions['term-defaults'] = () => {
    const o = curOff();
    const have = o.terms.map((r) => r.label.toLowerCase());
    NS.OFFERING_TYPES[o.type].terms.forEach((l) => {
      if (have.indexOf(l.toLowerCase()) < 0) o.terms.push({ label: l, value: '', show: true });
    });
    NS.app.save();
    NS.app.render();
  };
  NS.actions['term-del'] = (el) => {
    curOff().terms.splice(Number(el.getAttribute('data-i')), 1);
    NS.app.save();
    NS.app.render();
  };
  NS.actions['term-move'] = (el) => {
    const t = curOff().terms;
    const i = Number(el.getAttribute('data-i'));
    const j = i + Number(el.getAttribute('data-d'));
    if (j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
    NS.app.save();
    NS.app.render();
  };
  NS.actions['off-del'] = () => {
    if (!S().ui.offDel) {
      S().ui.offDel = true;
      NS.app.render();
      return;
    }
    S().ui.offDel = false;
    W().offerings = W().offerings.filter((o) => o.id !== S().param);
    NS.app.save(true);
    NS.app.go('console-offerings');
    U.toast('Offering removed');
  };
  NS.actions['off-preview'] = () => {
    const o = curOff();
    const holder = NS.data.holdersAt(W().investors, o.id, '9999-12-31').find((x) => x.investor.onboarding.status === 'complete');
    if (holder) S().viewer = holder.investor.id;
    NS.app.go('investment-' + o.id);
  };

  /* ---------- Investors ---------- */
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
          const done = i.onboarding.status === 'complete';
          return `<tr>
            <th scope="row"><span class="strong">${h(i.title)}</span><span class="sub">${h(i.contact)} · ${h(i.email)}</span></th>
            <td>${h((NS.ENTITY_TYPES[i.type] || {}).label || i.type)}</td>
            <td class="num">${usd(invested)}<span class="sub">${i.positions.length} investment${i.positions.length === 1 ? '' : 's'}</span></td>
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
      return shell(
        `${head('Investors', 'Activation status and how each investor is paid.', `<button class="cs-btn cs-btn-primary" type="button" data-action="invite-toggle" aria-expanded="${!!ui.inviteOpen}">${ui.inviteOpen ? 'Close' : 'Invite investors'}</button>`)}
        ${ui.inviteOpen ? invitePanel() : ''}
        <div class="cs-tabs" role="group" aria-label="Filter">${tabs.map(([k, l]) => `<button type="button" class="cs-tab" data-action="inv-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
        ${panel(
          '',
          list.length
            ? `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Investor</th><th scope="col">Type</th><th scope="col" class="num">Invested</th><th scope="col">Activation</th><th scope="col">Paid by</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
            : `<p class="cs-muted">${w.investors.length ? 'No investors match this filter.' : 'No investors yet. Use Invite investors to add them.'}</p>`
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
      <label class="cs-field" for="iv-contact"><span>Contact name</span><input id="iv-contact" name="contact" maxlength="60" required></label>
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
      return same;
    }
    W().investors.push(inv);
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
    const r = { contact: f.contact.value.trim(), email: f.email.value.trim(), type: f.type.value, title: f.title.value.trim(), offering: f.offering.value, amount: Number(f.amount.value), date: f.date.value };
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
    d[path] = v;
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
    W().runs.unshift({ id, offeringId: d.offeringId, date: d.date, type: d.type, total, status: d.date > today() ? 'scheduled' : 'paid', source: 'console', file: d.file ? d.file.filename : '' });
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
          return `<tr><td class="nowrap">${date(x.date)}</td><td>${h(NS.mergeNotice(x.subject, sample, t, x, NS.noticeInvestment(w, sample, picked.length ? { audience: 'all' } : x)))}</td><td>${audience}</td><td class="num">${x.recipients.length}</td><td>${x.sentBy === 'staff' ? 'Carrow &amp; Vale' : h(t.shortName)}</td></tr>`;
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
    w.notices.push({ id: 'n-' + Date.now().toString(36), date: today(), kind: n.kind, audience: n.investors.length ? 'all' : n.audience, investors: n.investors.slice(), includePending: n.includePending, quarter: n.quarter, docName: n.docName, subject: n.subject, body: n.body, recipients: list.map((i) => i.id), sentBy: S().role === 'staff' ? 'staff' : 'sponsor' });
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
    const rows = [['Investor', 'Account', 'Contact', 'Email', 'Phone', 'Mailing address', 'Investing as', 'Offerings', 'Invested', 'Account status', 'Paid by']].concat(
      list.map((inv) => [inv.title, inv.id, inv.contact, inv.email, inv.phone || '', inv.address || '', (NS.ENTITY_TYPES[inv.type] || {}).label || inv.type, offeringsOf(inv).join('; '), inv.positions.reduce((a, p) => a + p.amount, 0), statusText(inv), payMethod(inv)])
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
          return `<tr><td><a href="#console-offering-${h(o.id)}">${h(o.name)}</a></td><td><code>${h(c.name)}</code></td><td><code>${h(c.id)}</code></td><td>${o.achOverride && (o.achOverride.companyName || o.achOverride.companyId) ? 'Offering' : 'Client default'}</td></tr>`;
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
        `${head('Portal and brand', 'How this client’s portal looks to investors, and what onboarding asks of them.')}
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
              ${S().role === 'staff' ? tCheck('Show “Powered by Carrow & Vale”', 'showPoweredBy', 'Off by default. Investors see only the client.') : ''}
            </div>`)}
            ${S().role !== 'staff' ? '' : panel('Configuration', `<p class="cs-hint">The client’s full configuration as JSON, for engineering hand-off or to copy a setup to another client.</p>
              <div class="cs-row"><button class="cs-btn" type="button" data-action="cfg-copy">Copy JSON</button><button class="cs-btn cs-btn-danger" type="button" data-action="cfg-reset">${S().ui.cfgReset ? 'Click again to confirm' : builtin ? 'Restore sample data' : 'Delete this client'}</button></div>`)}
          </div>
          <aside class="cs-split-side" id="tb-preview">${brandPreview()}</aside>
        </div>`,
        'console-brand'
      );
    }
  };
  NS.binders.tenant = (path, v, el) => {
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
  NS.actions.mark = (el) => {
    T().logo.type = el.getAttribute('data-mark');
    NS.app.applyTenant();
    NS.app.render();
  };
  NS.actions.preset = (el) => {
    T().colors.primary = el.getAttribute('data-p');
    T().colors.accent = el.getAttribute('data-a');
    NS.app.applyTenant();
    NS.app.render();
  };
  NS.changes['logo-file'] = (el) => {
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
  };
  NS.actions['cfg-copy'] = () => U.copy(JSON.stringify({ tenant: T(), offerings: W().offerings }, null, 2));
  NS.actions['cfg-reset'] = () => {
    if (!S().ui.cfgReset) {
      S().ui.cfgReset = true;
      NS.app.render();
      return;
    }
    const id = T().id;
    const builtin = NS.workspace.isBuiltin(id);
    NS.workspace.reset(id);
    NS.app.setClient(builtin ? id : NS.DEFAULT_TENANT, 'console');
    U.toast(builtin ? 'Sample data restored' : 'Client deleted');
  };
})(window.CVPortal);
