/*
 * Investor portal: shell, routing and pages.
 * Every string an investor sees that names the firm comes from the active
 * client config, so the same build serves any number of white-labeled portals.
 */
(function () {
  'use strict';
  const NS = window.CVPortal;
  const B = NS.brand;

  /* ---------- Storage (per-viewer conveniences only) ---------- */
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('cvportal:' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('cvportal:' + k, JSON.stringify(v));
        return true;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem('cvportal:' + k);
      } catch (e) {
        /* ignore */
      }
    }
  };
  NS.store = store;

  /* ---------- Formatting helpers ---------- */
  const h = B.esc;
  const money = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  const mult = (n) => n.toFixed(2) + '×';
  const pct = (n, dp) => (n * 100).toFixed(dp == null ? 0 : dp) + '%';
  function parseISO(iso) {
    const [y, mo, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d));
  }
  function date(iso, style) {
    const opts = style === 'short' ? { month: 'short', day: 'numeric' } : style === 'long' ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
    return parseISO(iso).toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, opts));
  }
  function stamp(isoDT) {
    const [d, t] = isoDT.split('T');
    let [hh, mm] = (t || '00:00').split(':').map(Number);
    const ap = hh >= 12 ? 'p.m.' : 'a.m.';
    hh = hh % 12 || 12;
    return `${date(d)} · ${hh}:${String(mm).padStart(2, '0')} ${ap}`;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function merge(base, over) {
    const out = clone(base);
    (function walk(a, b) {
      Object.keys(b || {}).forEach((k) => {
        if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) walk(a[k], b[k]);
        else a[k] = b[k];
      });
    })(out, over);
    return out;
  }

  /* ---------- Icons ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    pie: '<path d="M12 3v9h9"/><path d="M20.5 15.5A9 9 0 1 1 8.5 3.7"/>',
    swap: '<path d="M7 20V4M3 8l4-4 4 4"/><path d="M17 4v16m-4-4 4 4 4-4"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    download: '<path d="M12 4v11m-5-5 5 5 5-5"/><path d="M5 20h14"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6z"/><path d="m8.8 12.2 2.3 2.3 4.2-4.4"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    send: '<path d="M4 12 20 4l-4 16-4-6.5z"/><path d="m12 13.5 8-9.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    monitor: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
    up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  const icon = (name, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  NS.icon = icon;

  /* ---------- Tenant registry ---------- */
  const builtinIds = NS.TENANTS.map((t) => t.id);
  function edits() {
    return store.get('edits', {});
  }
  function getTenant(id) {
    const e = edits()[id];
    const base = NS.TENANTS.find((t) => t.id === id);
    if (e) return merge(NS.TENANT_TEMPLATE, e);
    if (base) return merge(NS.TENANT_TEMPLATE, base);
    return null;
  }
  function listTenants() {
    const e = edits();
    const custom = Object.keys(e).filter((id) => builtinIds.indexOf(id) < 0).map((id) => merge(NS.TENANT_TEMPLATE, e[id]));
    return builtinIds.map(getTenant).concat(custom);
  }
  let saveTimer = 0;
  function saveTenant(t, now) {
    clearTimeout(saveTimer);
    const run = () => {
      const e = edits();
      e[t.id] = t;
      if (!store.set('edits', e) && NS.studio) NS.studio.saveFailed();
    };
    if (now) run();
    else saveTimer = setTimeout(run, 350);
  }
  function resetTenant(id) {
    const e = edits();
    delete e[id];
    store.set('edits', e);
  }
  NS.tenants = { get: getTenant, list: listTenants, save: saveTenant, reset: resetTenant, isBuiltin: (id) => builtinIds.indexOf(id) >= 0, merge, clone };

  function resolveTenantId() {
    let qs = null;
    try {
      qs = new URLSearchParams(location.search).get('tenant');
    } catch (e) {
      /* ignore */
    }
    const all = listTenants();
    if (qs && all.some((t) => t.id === qs)) return qs;
    const byHost = all.find((t) => t.domain && t.domain === location.hostname);
    if (byHost) return byHost.id;
    const saved = store.get('active');
    if (saved && all.some((t) => t.id === saved)) return saved;
    return NS.DEFAULT_TENANT;
  }

  /* ---------- State ---------- */
  const state = {
    tenant: null,
    data: null,
    route: 'overview',
    signedIn: true,
    signinStep: 'credentials',
    navOpen: false,
    menuOpen: false,
    activityTab: 'calls',
    docFilter: { q: '', cat: 'all', fund: 'all', year: 'all' },
    readDocs: {},
    threads: {},
    thread: null,
    composing: false,
    callRequest: {},
    appearance: store.get('appearance', null)
  };
  NS.state = state;

  const ROUTES = {
    overview: { title: 'Overview', icon: 'home', group: 'Portfolio' },
    investments: { title: 'Investments', icon: 'pie', group: 'Portfolio' },
    activity: { title: 'Calls & distributions', icon: 'swap', group: 'Portfolio', module: 'capitalCalls' },
    documents: { title: 'Documents', icon: 'file', group: 'Documents' },
    'tax-center': { title: 'Tax center', icon: 'receipt', group: 'Documents', module: 'tax' },
    messages: { title: 'Messages', icon: 'chat', group: 'Support', module: 'messages' },
    opportunities: { title: 'Opportunities', icon: 'trend', group: 'Support', module: 'opportunities' },
    profile: { title: 'Profile', icon: 'user', group: null }
  };
  const enabled = (key) => {
    const r = ROUTES[key];
    return !!r && (!r.module || state.tenant.modules[r.module] !== false);
  };

  function routeFromHash() {
    const r = (location.hash || '').replace(/^#/, '');
    if (r === 'sign-in') return 'sign-in';
    return enabled(r) ? r : 'overview';
  }
  function go(route) {
    if (location.hash.replace(/^#/, '') === route) onRoute();
    else location.hash = route;
  }

  /* ---------- Derived per-tenant session data ---------- */
  function threadsFor() {
    const id = state.tenant.id;
    if (!state.threads[id]) state.threads[id] = clone(state.data.threads);
    return state.threads[id];
  }
  function readSet() {
    const id = state.tenant.id;
    if (!state.readDocs[id]) state.readDocs[id] = {};
    return state.readDocs[id];
  }
  const isNew = (doc) => doc.isNew && !readSet()[doc.id];
  const newDocs = () => state.data.docs.filter(isNew);
  const unreadThreads = () => threadsFor().filter((t) => t.unread).length;

  /* ---------- Appearance (light / dark / system) ---------- */
  const rootEl = document.documentElement;
  const hostTheme = rootEl.getAttribute('data-theme');
  function applyAppearance() {
    const pref = state.appearance || state.tenant.appearance || 'system';
    if (pref === 'light' || pref === 'dark') rootEl.setAttribute('data-theme', pref);
    else if (hostTheme) rootEl.setAttribute('data-theme', hostTheme);
    else rootEl.removeAttribute('data-theme');
  }

  /* ---------- Shell ---------- */
  function navHTML() {
    const t = state.tenant;
    const groups = {};
    Object.keys(ROUTES).forEach((k) => {
      const r = ROUTES[k];
      if (!r.group || !enabled(k)) return;
      (groups[r.group] = groups[r.group] || []).push(k);
    });
    const badge = (k) => {
      let n = 0;
      if (k === 'documents') n = newDocs().length;
      if (k === 'messages') n = unreadThreads();
      if (k === 'opportunities') return '<span class="nav-badge nav-badge-text">New</span>';
      return n ? `<span class="nav-badge" aria-label="${n} new">${n}</span>` : '';
    };
    const links = Object.keys(groups)
      .map(
        (g) => `<div class="nav-group"><div class="nav-group-label">${g}</div>${groups[g]
          .map((k) => `<a class="nav-link" href="#${k}"${state.route === k ? ' aria-current="page"' : ''}>${icon(ROUTES[k].icon)}<span>${ROUTES[k].title}</span>${badge(k)}</a>`)
          .join('')}</div>`
      )
      .join('');
    return `<aside class="nav" id="portal-nav" aria-label="${h(t.shortName)} ${h(t.portalName)}">
      <a class="nav-brand" href="#overview" aria-label="${h(t.name)} ${h(t.portalName)} home">${B.lockup(t)}</a>
      <div class="nav-portal-name">${h(t.portalName)}</div>
      <nav class="nav-links" aria-label="Portal">${links}</nav>
      <div class="nav-support">
        <div class="nav-group-label">Questions?</div>
        <div class="nav-support-team">${h(t.support.team)}</div>
        <div class="nav-support-line">${icon('phone')}<span>${h(t.support.phone)}</span></div>
        <div class="nav-support-line">${icon('mail')}<span>${h(t.support.email)}</span></div>
        <div class="nav-support-line nav-muted">${icon('clock')}<span>${h(t.support.hours)}</span></div>
      </div>
    </aside>`;
  }

  function topbarHTML() {
    const t = state.tenant;
    const d = state.data;
    const nd = newDocs().length;
    const pref = state.appearance || t.appearance || 'system';
    const themeIcon = pref === 'dark' ? 'moon' : pref === 'light' ? 'sun' : 'monitor';
    return `<header class="topbar">
      <button class="icon-btn nav-toggle" type="button" data-action="nav-open" aria-label="Open menu" aria-controls="portal-nav" aria-expanded="${state.navOpen}">${icon('menu')}</button>
      <a class="topbar-brand" href="#overview" aria-label="${h(t.name)} home">${B.lockup(t, { compact: true })}</a>
      <div class="topbar-account"><span class="topbar-entity">${h(d.investor.entity)}</span><span class="topbar-id">Investor ID ${h(d.investor.id)}</span></div>
      <div class="topbar-actions">
        <button class="icon-btn" type="button" data-action="cycle-theme" aria-label="Appearance: ${pref}. Change appearance" title="Appearance: ${pref}">${icon(themeIcon)}</button>
        <a class="icon-btn has-dot" href="#documents" aria-label="${nd ? nd + ' new documents' : 'Documents'}">${icon('bell')}${nd ? `<span class="dot">${nd}</span>` : ''}</a>
        <div class="menu-wrap">
          <button class="avatar" type="button" data-action="menu" aria-haspopup="true" aria-expanded="${state.menuOpen}" aria-label="Account menu for ${h(d.investor.name)}">${h(d.investor.initials)}</button>
          <div class="menu" role="menu" ${state.menuOpen ? '' : 'hidden'}>
            <div class="menu-head"><strong>${h(d.investor.name)}</strong><span>${h(d.investor.email)}</span></div>
            <a role="menuitem" href="#profile">${icon('user')}Profile</a>
            <a role="menuitem" href="#documents">${icon('file')}Documents</a>
            <button role="menuitem" type="button" data-action="sign-out">${icon('logout')}Sign out</button>
          </div>
        </div>
      </div>
    </header>`;
  }

  function footerHTML() {
    const t = state.tenant;
    return `<footer class="portal-foot">
      <p>${h(t.disclaimer)}</p>
      <p class="foot-meta"><span>© 2026 ${h(t.legalName)}</span><span>${icon('lock')}${h(t.domain)}</span>${t.showPoweredBy ? '<span>Powered by Carrow &amp; Vale</span>' : ''}</p>
    </footer>`;
  }

  /* ---------- Shared bits ---------- */
  function pageHead(title, sub, eyebrow, actions) {
    return `<div class="page-head"><div class="page-head-text">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
  }
  const pill = (kind, label, ic) => `<span class="pill pill-${kind}">${ic ? icon(ic) : ''}${label}</span>`;
  const asOfLine = () => `Values as of ${date(state.data.asOf, 'long')} · Unaudited`;

  function holdingsTable(withTotals) {
    const d = state.data;
    const rows = d.funds
      .map(
        (f) => `<tr>
        <th scope="row"><span class="cell-title">${h(f.name)}</span><span class="cell-meta">${h(f.strategy)} · ${f.vintage}</span></th>
        <td class="num">${money(f.commitment)}</td>
        <td class="num"><span>${money(f.contributed)}</span><span class="meter-row"><span class="meter" role="img" aria-label="${pct(f.calledPct)} of commitment called"><span style="width:${(f.calledPct * 100).toFixed(1)}%"></span></span><span class="cell-meta">${pct(f.calledPct)}</span></span></td>
        <td class="num">${money(f.distributed)}</td>
        <td class="num strong">${money(f.nav)}</td>
        <td class="num">${mult(f.tvpi)}</td>
        <td class="num">${mult(f.dpi)}</td>
        <td class="num">${f.irr.toFixed(1)}%</td>
      </tr>`
      )
      .join('');
    const tot = d.totals;
    const foot = withTotals
      ? `<tfoot><tr><th scope="row">Total</th><td class="num">${money(tot.commitment)}</td><td class="num">${money(tot.contributed)}</td><td class="num">${money(tot.distributed)}</td><td class="num strong">${money(tot.nav)}</td><td class="num">${mult(tot.tvpi)}</td><td class="num">${mult(tot.dpi)}</td><td class="num">—</td></tr></tfoot>`
      : '';
    return `<div class="table-scroll"><table class="data">
      <thead><tr><th scope="col">Investment</th><th scope="col" class="num">Commitment</th><th scope="col" class="num">Contributed</th><th scope="col" class="num">Distributed</th><th scope="col" class="num">Capital account</th><th scope="col" class="num">TVPI</th><th scope="col" class="num">DPI</th><th scope="col" class="num">Net IRR</th></tr></thead>
      <tbody>${rows}</tbody>${foot}</table></div>`;
  }

  function docRow(doc, compact) {
    const fresh = isNew(doc);
    const cat = state.data.categories.find((c) => c.id === doc.cat);
    return `<li class="doc-row${compact ? ' compact' : ''}">
      <span class="doc-icon">${icon(doc.cat === 'tax' ? 'receipt' : 'file')}</span>
      <span class="doc-main"><span class="doc-title">${h(doc.title)}${fresh ? ' ' + pill('new', 'New') : ''}</span><span class="doc-meta">${h(doc.fundName)} · ${cat ? cat.label : ''}${compact ? '' : ` · PDF, ${doc.size}`}</span></span>
      ${compact ? '' : `<span class="doc-date">${date(doc.date)}</span>`}
      <button class="btn btn-secondary btn-sm" type="button" data-action="open-doc" data-id="${doc.id}" aria-label="View ${h(doc.title)}, ${h(doc.fundName)}">View</button>
    </li>`;
  }

  /* ---------- Pages ---------- */
  function viewOverview() {
    const t = state.tenant;
    const d = state.data;
    const tot = d.totals;
    const oc = d.openCall;
    const change = d.roll.end - d.roll.begin;
    const fresh = newDocs().slice(0, 4);
    const callBanner = t.modules.capitalCalls !== false
      ? `<section class="alert alert-warn" aria-label="Action needed">
          <span class="alert-icon">${icon('alert')}</span>
          <div class="alert-text"><strong>Capital call due ${date(oc.due, 'long')}</strong><span>${h(oc.fundName)} · Call No. ${oc.no} · ${money(oc.amount)}</span></div>
          <a class="btn btn-secondary btn-sm" href="#activity">Review call</a>
        </section>`
      : '';
    return `
      ${pageHead(`Welcome back, ${h(d.investor.first)}`, asOfLine(), `${h(d.investor.entity)}`, `<button class="btn btn-secondary" type="button" data-action="open-doc" data-id="stmt-q3">${icon('file')}Q3 statement</button>${t.modules.messages !== false ? `<a class="btn btn-primary" href="#messages" data-action="compose">${icon('chat')}Message us</a>` : ''}`)}
      ${callBanner}
      <section class="panel summary" aria-label="Account summary">
        <div class="summary-hero">
          <div class="label">Capital account balance</div>
          <div class="hero-num">${money(tot.nav)}</div>
          <div class="delta ${change >= 0 ? 'delta-up' : 'delta-down'}">${icon('up')}<span>${signed(change)} since ${date(d.quarterEnds[10], 'long')}</span></div>
        </div>
        <dl class="summary-stats">
          <div><dt>Total commitment</dt><dd>${money(tot.commitment)}</dd></div>
          <div><dt>Contributed</dt><dd>${money(tot.contributed)}</dd><span class="meta">${pct(tot.calledPct)} of commitment</span></div>
          <div><dt>Distributions</dt><dd>${money(tot.distributed)}</dd><span class="meta">Since inception</span></div>
          <div><dt>Unfunded</dt><dd>${money(tot.unfunded)}</dd><span class="meta">Remaining commitment</span></div>
          <div><dt>TVPI <span class="dt-sep">/</span> DPI</dt><dd>${mult(tot.tvpi)} <span class="dd-sep">/</span> ${mult(tot.dpi)}</dd><span class="meta">Net multiples</span></div>
        </dl>
      </section>

      <div class="grid-main">
        <section class="panel">
          <header class="panel-head">
            <div><h2>Capital account and net contributions</h2><p>Quarter-end values, ${d.quarters[0]} – ${d.quarters[d.quarters.length - 1]}. The gap between the lines is your gain.</p></div>
            <ul class="legend" aria-label="Legend"><li><span class="key-line" style="background:var(--chart-1)"></span>Capital account</li><li><span class="key-line" style="background:var(--chart-muted)"></span>Net contributions</li></ul>
          </header>
          <div class="chart" data-chart="nav"></div>
          <details class="table-view"><summary>View as table</summary><div class="table-scroll"><table class="data compact-table"><thead><tr><th scope="col">Quarter end</th><th scope="col" class="num">Capital account</th><th scope="col" class="num">Net contributions</th></tr></thead><tbody>${d.quarters
            .map((q, i) => `<tr><th scope="row">${q}</th><td class="num">${money(d.navSeries[i])}</td><td class="num">${money(d.netContrib[i])}</td></tr>`)
            .join('')}</tbody></table></div></details>
        </section>

        <section class="panel">
          <header class="panel-head"><div><h2>Q3 2026 rollforward</h2><p>Jul 1 – Sep 30, 2026, all investments</p></div></header>
          <table class="rollforward">
            <tbody>
              <tr><th scope="row">Beginning balance <span>Jun 30</span></th><td>${money(d.roll.begin)}</td></tr>
              <tr><th scope="row">Contributions</th><td>${signed(d.roll.contrib)}</td></tr>
              <tr><th scope="row">Distributions</th><td>${signed(-d.roll.dist)}</td></tr>
              <tr><th scope="row">Net income and unrealized gain</th><td>${signed(d.roll.gain)}</td></tr>
              <tr class="total"><th scope="row">Ending balance <span>Sep 30</span></th><td>${money(d.roll.end)}</td></tr>
            </tbody>
          </table>
          <button class="btn btn-ghost btn-inline" type="button" data-action="open-doc" data-id="stmt-q3">Open the full statement ${icon('arrow')}</button>
        </section>
      </div>

      <div class="grid-main">
        <section class="panel">
          <header class="panel-head"><div><h2>Your investments</h2><p>${d.funds.length} positions with ${h(t.shortName)}</p></div><a class="btn btn-ghost btn-sm" href="#investments">All details ${icon('arrow')}</a></header>
          ${holdingsTable(false)}
        </section>
        <div class="stack">
          <section class="panel">
            <header class="panel-head"><div><h2>New documents</h2><p>${fresh.length ? `${newDocs().length} unread` : 'You are all caught up'}</p></div><a class="btn btn-ghost btn-sm" href="#documents">All ${icon('arrow')}</a></header>
            ${fresh.length ? `<ul class="doc-list">${fresh.map((x) => docRow(x, true)).join('')}</ul>` : '<p class="empty-note">New reports, statements and notices will appear here.</p>'}
          </section>
          <section class="panel">
            <header class="panel-head"><div><h2>Coming up</h2></div></header>
            <ul class="events">${d.events
              .filter((e) => (e.kind === 'due' ? t.modules.capitalCalls !== false : true) && (e.kind === 'tax' ? t.modules.tax !== false : true))
              .map(
                (e) => `<li class="event${e.kind === 'due' ? ' event-due' : ''}"><span class="event-date"><span>${date(e.date, 'short').split(' ')[0]}</span><strong>${date(e.date, 'short').split(' ')[1]}</strong></span><span class="event-text"><strong>${h(e.title)}</strong><span>${h(e.meta)}${e.amount ? ' · ' + money(e.amount) : ''}</span></span></li>`
              )
              .join('')}</ul>
          </section>
        </div>
      </div>

      <section class="panel letter">
        <div class="letter-mark">${B.markSVG(t.logo.type === 'image' ? 'monogram' : t.logo.type, t.logo.letters, 'mark')}</div>
        <div class="letter-body">
          <p class="eyebrow">From ${h(t.shortName)}</p>
          <h2>${h(t.letter.title)}</h2>
          <p>${h(t.letter.excerpt)}</p>
          <button class="btn btn-ghost btn-inline" type="button" data-action="open-doc" data-id="qr-q3-0">Read the Q3 report ${icon('arrow')}</button>
        </div>
      </section>`;
  }

  function viewInvestments() {
    const d = state.data;
    const tot = d.totals;
    const segs = d.funds
      .map((f, i) => `<div class="seg-part" style="flex:${f.nav} 1 0;background:var(--seg-${i + 1});color:var(--seg-${i + 1}-ink)" tabindex="0" aria-label="${h(f.short)}: ${money(f.nav)}, ${pct(f.nav / tot.nav)}" title="${h(f.short)} · ${money(f.nav)} · ${pct(f.nav / tot.nav)}"><span class="seg-label">${pct(f.nav / tot.nav)}</span></div>`)
      .join('');
    return `
      ${pageHead('Investments', `${d.funds.length} positions · ${asOfLine()}`)}
      <section class="panel">
        <header class="panel-head"><div><h2>Allocation by capital account</h2><p>Share of your ${money(tot.nav)} balance</p></div></header>
        <div class="seg" role="group" aria-label="Allocation by capital account">${segs}</div>
        <ul class="legend legend-seg">${d.funds.map((f, i) => `<li><span class="key-box" style="background:var(--seg-${i + 1})"></span>${h(f.short)}</li>`).join('')}</ul>
      </section>
      <section class="panel">
        <header class="panel-head"><div><h2>Positions</h2><p>Commitments, cash flows and performance since inception</p></div></header>
        ${holdingsTable(true)}
        <p class="footnote">TVPI is total value (capital account plus distributions) divided by contributed capital. DPI is distributions divided by contributed capital. Net IRR is calculated from your actual cash flows, net of fees, expenses and carried interest.</p>
      </section>
      <div class="fund-cards">${d.funds
        .map(
          (f) => `<section class="panel fund-card">
          <header class="panel-head"><div><p class="eyebrow">${f.vintage} vintage</p><h2>${h(f.short)}</h2><p>${h(f.name)}</p></div></header>
          <dl class="kv">
            <div><dt>Unfunded commitment</dt><dd>${money(f.unfunded)}</dd></div>
            <div><dt>Q3 net gain</dt><dd>${signed(f.roll.gain)}</dd></div>
            <div><dt>Total value</dt><dd>${money(f.totalValue)}</dd></div>
            <div><dt>Strategy</dt><dd>${h(f.strategy)}</dd></div>
          </dl>
        </section>`
        )
        .join('')}</div>`;
  }

  function viewActivity() {
    const t = state.tenant;
    const d = state.data;
    const oc = d.openCall;
    const tab = state.activityTab;
    const tabs = `<div class="tabs" role="tablist" aria-label="Activity">
      <button class="tab" role="tab" type="button" id="tab-calls" aria-controls="panel-calls" aria-selected="${tab === 'calls'}" data-action="tab" data-tab="calls">Capital calls</button>
      <button class="tab" role="tab" type="button" id="tab-dists" aria-controls="panel-dists" aria-selected="${tab === 'dists'}" data-action="tab" data-tab="dists">Distributions</button>
    </div>`;
    const calls = `<div id="panel-calls" role="tabpanel" aria-labelledby="tab-calls" class="stack">
      <section class="panel call-open">
        <header class="panel-head"><div><p class="eyebrow">Open capital call</p><h2>${h(oc.fundLong)} · Call No. ${oc.no}</h2></div>${pill('warn', `Due ${date(oc.due)}`, 'clock')}</header>
        <dl class="kv kv-4">
          <div><dt>Amount due</dt><dd class="big">${money(oc.amount)}</dd></div>
          <div><dt>Due date</dt><dd>${date(oc.due, 'long')}</dd></div>
          <div><dt>Purpose</dt><dd>${h(oc.purpose)}</dd></div>
          <div><dt>Called after this call</dt><dd>${pct(oc.calledAfterPct, 1)} of ${money(oc.commitment)}</dd></div>
        </dl>
        <div class="callout-security">${icon('shield')}<p><strong>${h(t.shortName)} will never change wire instructions by email.</strong> Before you send funds, confirm the instructions by phone at <span class="nowrap">${h(t.support.phone)}</span>.</p></div>
        <div class="btn-row"><button class="btn btn-primary" type="button" data-action="open-doc" data-id="call-7">${icon('file')}View notice and wire instructions</button>${t.modules.messages !== false ? `<a class="btn btn-secondary" href="#messages" data-action="open-thread" data-id="t1">${icon('chat')}Ask a question</a>` : ''}</div>
      </section>
      <section class="panel">
        <header class="panel-head"><div><h2>Call history</h2><p>${d.calls.length} calls paid · ${money(d.calls.reduce((a, c) => a + c.amount, 0))} since ${date(d.calls[d.calls.length - 1].due)}</p></div></header>
        <div class="table-scroll"><table class="data">
          <thead><tr><th scope="col">Due date</th><th scope="col">Investment</th><th scope="col">Call</th><th scope="col">Purpose</th><th scope="col" class="num">Amount</th><th scope="col">Status</th></tr></thead>
          <tbody>${d.calls.map((c) => `<tr><td class="nowrap">${date(c.due)}</td><td>${h(c.fundName)}</td><td class="nowrap">No. ${c.no}</td><td>${h(c.purpose)}</td><td class="num">${money(c.amount)}</td><td>${pill('good', 'Paid', 'check')}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
    </div>`;
    const dists = `<div id="panel-dists" role="tabpanel" aria-labelledby="tab-dists" class="stack">
      <section class="panel">
        <dl class="kv kv-3">
          <div><dt>Received in 2026</dt><dd class="big">${money(d.ytd)}</dd></div>
          <div><dt>Since inception</dt><dd class="big">${money(d.totals.distributed)}</dd></div>
          <div><dt>Paid to</dt><dd>${h(d.investor.bank.name)} ${h(d.investor.bank.type)} ••••${h(d.investor.bank.last4)}<span class="cell-meta">By ${h(d.investor.bank.method)}</span></dd></div>
        </dl>
      </section>
      <section class="panel">
        <header class="panel-head"><div><h2>Distributions received by quarter</h2><p>${d.quarters[0]} – ${d.quarters[d.quarters.length - 1]}, all investments</p></div></header>
        <div class="chart" data-chart="dist"></div>
        <details class="table-view"><summary>View as table</summary><div class="table-scroll"><table class="data compact-table"><thead><tr><th scope="col">Quarter</th><th scope="col" class="num">Distributions</th></tr></thead><tbody>${d.quarters.map((q, i) => `<tr><th scope="row">${q}</th><td class="num">${money(d.distByQuarter[i])}</td></tr>`).join('')}</tbody></table></div></details>
      </section>
      <section class="panel">
        <header class="panel-head"><div><h2>Distribution history</h2></div></header>
        <div class="table-scroll"><table class="data">
          <thead><tr><th scope="col">Payment date</th><th scope="col">Investment</th><th scope="col">Type</th><th scope="col" class="num">Amount</th></tr></thead>
          <tbody>${d.distributions.map((x) => `<tr><td class="nowrap">${date(x.date)}</td><td>${h(x.fundName)}</td><td>${h(x.type)}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
    </div>`;
    return `${pageHead('Capital calls and distributions', 'Every dollar in and out of your account')}${tabs}${tab === 'calls' ? calls : dists}`;
  }

  function filteredDocs() {
    const f = state.docFilter;
    const q = f.q.trim().toLowerCase();
    return state.data.docs.filter(
      (doc) =>
        (f.cat === 'all' || doc.cat === f.cat) &&
        (f.fund === 'all' || String(doc.fund) === f.fund) &&
        (f.year === 'all' || doc.date.startsWith(f.year)) &&
        (!q || (doc.title + ' ' + doc.fundName).toLowerCase().includes(q))
    );
  }
  function docListHTML() {
    const list = filteredDocs();
    if (!list.length) {
      return `<div class="empty"><p><strong>No documents match these filters.</strong></p><p>Try another category or year, or <button class="link-btn" type="button" data-action="clear-filters">clear all filters</button>.</p></div>`;
    }
    return `<p class="list-count" role="status">${list.length} of ${state.data.docs.length} documents</p><ul class="doc-list">${list.map((x) => docRow(x, false)).join('')}</ul>`;
  }
  function viewDocuments() {
    const d = state.data;
    const f = state.docFilter;
    const years = Array.from(new Set(d.docs.map((x) => x.date.slice(0, 4)))).sort().reverse();
    const cats = [{ id: 'all', label: 'All' }].concat(d.categories);
    return `
      ${pageHead('Documents', `${d.docs.length} documents · ${newDocs().length} new`)}
      <div class="filters" role="search">
        <label class="search-field" for="doc-q">${icon('search')}<span class="sr-only">Search documents</span><input id="doc-q" type="search" placeholder="Search documents" value="${h(f.q)}" data-filter="q" autocomplete="off"></label>
        <div class="chips" role="group" aria-label="Category">${cats.map((c) => `<button class="chip" type="button" data-action="doc-cat" data-cat="${c.id}" aria-pressed="${f.cat === c.id}">${c.label}</button>`).join('')}</div>
        <label class="select-field" for="doc-fund"><span class="sr-only">Investment</span><select id="doc-fund" data-filter="fund"><option value="all">All investments</option>${d.funds.map((x) => `<option value="${x.index}"${f.fund === String(x.index) ? ' selected' : ''}>${h(x.short)}</option>`).join('')}</select></label>
        <label class="select-field" for="doc-year"><span class="sr-only">Year</span><select id="doc-year" data-filter="year"><option value="all">All years</option>${years.map((y) => `<option value="${y}"${f.year === y ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
      </div>
      <section class="panel panel-flush" id="doc-list">${docListHTML()}</section>`;
  }

  function viewTax() {
    const t = state.tenant;
    const d = state.data;
    const k1s = d.docs.filter((x) => x.kind === 'k1');
    return `
      ${pageHead('Tax center', 'Schedule K-1s and tax-season dates for every investment')}
      <div class="grid-main">
        <div class="stack">
          <section class="panel">
            <header class="panel-head"><div><p class="eyebrow">Tax year 2026</p><h2>What to expect</h2></div>${pill('info', 'In progress', 'clock')}</header>
            <ol class="timeline">
              <li class="done"><span class="tl-dot">${icon('check')}</span><div><strong>Q3 capital account statements</strong><span>Delivered ${date('2026-11-03')}</span></div></li>
              <li><span class="tl-dot"></span><div><strong>Estimated taxable income</strong><span>Expected by ${date('2027-02-19')}, for planning and extensions</span></div></li>
              <li><span class="tl-dot"></span><div><strong>Schedule K-1s for all investments</strong><span>Expected by ${date('2027-03-15')}</span></div></li>
            </ol>
          </section>
          <section class="panel">
            <header class="panel-head"><div><p class="eyebrow">Tax year 2025</p><h2>Schedule K-1s</h2></div>${pill('good', 'All delivered', 'check')}</header>
            <div class="table-scroll"><table class="data">
              <thead><tr><th scope="col">Investment</th><th scope="col">Form</th><th scope="col">Delivered</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>${k1s.map((k) => `<tr><td><span class="cell-title">${h(d.funds[k.fund].name)}</span></td><td class="nowrap">Schedule K-1 (Form 1065)</td><td class="nowrap">${date(k.date)}</td><td class="num"><button class="btn btn-secondary btn-sm" type="button" data-action="open-doc" data-id="${k.id}">View</button></td></tr>`).join('')}</tbody>
            </table></div>
          </section>
        </div>
        <div class="stack">
          <section class="panel">
            <header class="panel-head"><div><h2>Tax-season support</h2></div></header>
            <p class="body-copy">Questions about a K-1, state filings or an amended form? ${h(t.support.team)} can help, and replies within ${h(t.support.response)}.</p>
            <ul class="contact-list"><li>${icon('phone')}<span>${h(t.support.phone)}</span></li><li>${icon('mail')}<span>${h(t.support.email)}</span></li><li>${icon('clock')}<span>${h(t.support.hours)}</span></li></ul>
          </section>
          <section class="panel">
            <header class="panel-head"><div><h2>Share with your accountant</h2></div></header>
            <p class="body-copy">${h(d.investor.authorized[0].name)} has access to your tax documents. Add or remove authorized users from your profile.</p>
            <a class="btn btn-secondary btn-sm" href="#profile">Manage authorized users</a>
          </section>
        </div>
      </div>`;
  }

  const STATUS = { replied: ['info', 'Replied'], open: ['warn', 'In progress'], resolved: ['good', 'Resolved'], sent: ['info', 'Sent'] };
  function threadListHTML() {
    const list = threadsFor();
    return list
      .map((th) => {
        const last = th.messages[th.messages.length - 1];
        const st = STATUS[th.status] || STATUS.open;
        return `<li><button class="thread${state.thread === th.id ? ' is-active' : ''}" type="button" data-action="open-thread" data-id="${th.id}" aria-current="${state.thread === th.id}">
          <span class="thread-top"><span class="thread-subject">${th.unread ? '<span class="unread-dot" aria-label="Unread"></span>' : ''}${h(th.subject)}</span><span class="thread-date">${date(last.at, 'short')}</span></span>
          <span class="thread-snippet">${h(last.body)}</span>
          <span class="thread-tags"><span class="tag">${h(th.topic)}</span>${pill(st[0], st[1])}</span>
        </button></li>`;
      })
      .join('');
  }
  function conversationHTML() {
    const t = state.tenant;
    const d = state.data;
    if (state.composing) {
      return `<form class="compose" id="compose-form" novalidate>
        <div class="pane-head"><button class="icon-btn pane-back" type="button" data-action="close-thread" aria-label="Back to messages">${icon('back')}</button><h2>New message to ${h(t.support.team)}</h2></div>
        <div class="compose-body">
          <label class="field" for="msg-topic"><span>Topic</span><select id="msg-topic" name="topic"><option>Account</option><option>Documents</option><option>Capital call</option><option>Distribution</option><option>Tax</option><option>Other</option></select></label>
          <label class="field" for="msg-subject"><span>Subject</span><input id="msg-subject" name="subject" required maxlength="120" value="${h(state.composeSubject || '')}"></label>
          <label class="field" for="msg-body"><span>Message</span><textarea id="msg-body" name="body" rows="7" required maxlength="4000"></textarea></label>
          <p class="field-error" id="compose-error" hidden>Add a subject and a message, then send.</p>
          <p class="fine">Messages are encrypted and kept with your account records. ${h(t.support.team)} replies within ${h(t.support.response)}.</p>
          <div class="btn-row"><button class="btn btn-primary" type="submit">${icon('send')}Send message</button><button class="btn btn-secondary" type="button" data-action="close-thread">Cancel</button></div>
        </div>
      </form>`;
    }
    const th = threadsFor().find((x) => x.id === state.thread);
    if (!th) {
      return `<div class="pane-empty">${icon('chat')}<p><strong>Select a conversation</strong></p><p>Or start a new one. ${h(t.support.team)} replies within ${h(t.support.response)}.</p><button class="btn btn-primary btn-sm" type="button" data-action="compose">${icon('plus')}New message</button></div>`;
    }
    const msgs = th.messages
      .map((msg) => {
        const mine = msg.from === 'investor';
        return `<li class="msg ${mine ? 'msg-mine' : 'msg-theirs'}">
          <div class="msg-meta"><strong>${mine ? h(d.investor.name) : h(msg.name)}</strong><span>${mine ? '' : h(t.support.team) + ' · '}${stamp(msg.at)}</span></div>
          <div class="msg-bubble">${h(msg.body)}</div>
        </li>`;
      })
      .join('');
    return `<div class="conversation">
      <div class="pane-head"><button class="icon-btn pane-back" type="button" data-action="close-thread" aria-label="Back to messages">${icon('back')}</button><div><h2>${h(th.subject)}</h2><p>${h(th.topic)} · ${th.messages.length} messages</p></div></div>
      <ol class="msgs" aria-live="polite">${msgs}</ol>
      <form class="reply" id="reply-form" data-thread="${th.id}">
        <label class="sr-only" for="reply-body">Reply</label>
        <textarea id="reply-body" name="body" rows="2" placeholder="Write a reply" maxlength="4000"></textarea>
        <button class="btn btn-primary" type="submit">${icon('send')}Send</button>
      </form>
    </div>`;
  }
  function viewMessages() {
    const t = state.tenant;
    const hasPane = state.composing || state.thread;
    return `
      ${pageHead('Messages', `Secure messages with ${h(t.support.team)}`, '', `<button class="btn btn-primary" type="button" data-action="compose">${icon('plus')}New message</button>`)}
      <div class="msg-layout${hasPane ? ' has-pane' : ''}">
        <ul class="thread-list" aria-label="Conversations">${threadListHTML()}</ul>
        <section class="msg-pane" id="msg-pane" aria-label="Conversation">${conversationHTML()}</section>
      </div>`;
  }

  function businessDays(n) {
    const out = [];
    const d = parseISO('2026-11-05');
    while (out.length < n) {
      d.setUTCDate(d.getUTCDate() + 1);
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }
  function viewOpportunities() {
    const t = state.tenant;
    const d = state.data;
    const o = t.offering;
    const req = state.callRequest[t.id];
    const days = businessDays(5);
    const form = req
      ? `<div class="confirm">${icon('check', 'confirm-icon')}<div><h3>Request received</h3><p>A licensed representative will call you at ${h(req.phone)} on ${date(req.day, 'long')}, ${h(req.window.toLowerCase())}. You will also see a confirmation in Messages.</p><button class="link-btn" type="button" data-action="reset-call">Change this request</button></div></div>`
      : `<form class="call-form" id="call-form" novalidate>
          <label class="field" for="call-day"><span>Preferred day</span><select id="call-day" name="day">${days.map((x) => `<option value="${x}">${parseISO(x).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</option>`).join('')}</select></label>
          <label class="field" for="call-window"><span>Time of day</span><select id="call-window" name="window"><option>In the morning</option><option>Around midday</option><option>In the afternoon</option></select></label>
          <label class="field" for="call-phone"><span>Phone</span><input id="call-phone" name="phone" type="tel" value="${h(d.investor.phone)}" required></label>
          <label class="field field-wide" for="call-notes"><span>Anything we should prepare? <em>Optional</em></span><textarea id="call-notes" name="notes" rows="3" maxlength="1000"></textarea></label>
          <div class="btn-row field-wide"><button class="btn btn-primary" type="submit">Request a call</button></div>
        </form>`;
    return `
      ${pageHead('Opportunities', `Offerings available to existing ${h(t.shortName)} investors`)}
      <section class="panel offering">
        <div class="offering-band">
          <p class="eyebrow">Now raising · Priority access for existing investors</p>
          <h2>${h(o.name)}</h2>
          <p>${h(o.strategy)}</p>
        </div>
        <dl class="kv kv-4">
          <div><dt>Target fund size</dt><dd>${h(o.target)}</dd></div>
          <div><dt>Minimum commitment</dt><dd>${h(o.minimum)}</dd></div>
          <div><dt>Target first close</dt><dd>${date(o.firstClose, 'long')}</dd></div>
          <div><dt>Eligibility</dt><dd>Accredited investors</dd></div>
        </dl>
        <ul class="ticks">${o.highlights.map((x) => `<li>${icon('check')}<span>${h(x)}</span></li>`).join('')}</ul>
        <div class="btn-row"><button class="btn btn-secondary" type="button" data-action="open-doc" data-id="offer-deck">${icon('file')}${h(o.short)} overview</button><button class="btn btn-secondary" type="button" data-action="open-doc" data-id="offer-summary">${icon('file')}Executive summary</button></div>
      </section>
      <div class="grid-main">
        <section class="panel">
          <header class="panel-head"><div><h2>Talk with a licensed representative</h2><p>Series 7 and Series 63 registered representatives can walk you through the strategy, terms and subscription process.</p></div></header>
          ${form}
        </section>
        <section class="panel disclosure">
          <header class="panel-head"><div><h2>Important information</h2></div></header>
          <p>This page is not an offer to sell, or a solicitation of an offer to buy, any security. Any offer will be made only through the fund's confidential private placement memorandum and subscription documents, and only to qualified investors where permitted.</p>
          <p>[Broker-dealer and registration disclosures to be provided by counsel.]</p>
        </section>
      </div>`;
  }

  function toggle(id, label, desc, on) {
    return `<div class="toggle-row"><div><label for="${id}">${label}</label><span>${desc}</span></div><input class="switch" type="checkbox" role="switch" id="${id}"${on ? ' checked' : ''}></div>`;
  }
  function viewProfile() {
    const t = state.tenant;
    const d = state.data;
    const inv = d.investor;
    const pref = state.appearance || t.appearance || 'system';
    return `
      ${pageHead('Profile', `${h(inv.entity)} · Investor ID ${h(inv.id)}`)}
      <div class="profile-grid">
        <section class="panel">
          <header class="panel-head"><div><h2>Investor details</h2></div>${t.modules.messages !== false ? '<button class="btn btn-ghost btn-sm" type="button" data-action="compose" data-subject="Update my investor details">Request a change</button>' : ''}</header>
          <dl class="kv kv-stack">
            <div><dt>Primary contact</dt><dd>${h(inv.name)}</dd></div>
            <div><dt>Investing entity</dt><dd>${h(inv.entity)}</dd></div>
            <div><dt>Email</dt><dd>${h(inv.email)}</dd></div>
            <div><dt>Phone</dt><dd>${h(inv.phone)}</dd></div>
            <div><dt>Mailing address</dt><dd>${h(inv.address)}</dd></div>
          </dl>
        </section>
        <section class="panel">
          <header class="panel-head"><div><h2>Accreditation</h2></div>${pill('good', inv.accreditation.status, 'check')}</header>
          <dl class="kv kv-stack">
            <div><dt>Status</dt><dd>Accredited investor</dd></div>
            <div><dt>Verified</dt><dd>${date(inv.accreditation.verified, 'long')}</dd></div>
            <div><dt>Renewal due</dt><dd>${date(inv.accreditation.expires, 'long')}</dd></div>
          </dl>
        </section>
        <section class="panel">
          <header class="panel-head"><div><h2>Distribution account</h2></div>${t.modules.messages !== false ? '<button class="btn btn-ghost btn-sm" type="button" data-action="compose" data-subject="Change my distribution bank account">Change account</button>' : ''}</header>
          <div class="bank">${icon('lock')}<div><strong>${h(inv.bank.name)}</strong><span>${h(inv.bank.type)} ••••${h(inv.bank.last4)} · ${h(inv.bank.method)}</span></div></div>
          <p class="fine">For your protection, bank changes are confirmed by phone with ${h(t.support.team)} before they take effect.</p>
        </section>
        <section class="panel">
          <header class="panel-head"><div><h2>Security</h2></div>${pill('good', '2-step on', 'shield')}</header>
          <dl class="kv kv-stack">
            <div><dt>Two-step verification</dt><dd>Authenticator app</dd></div>
            <div><dt>Last sign-in</dt><dd>${h(inv.lastSignIn)}</dd></div>
            <div><dt>Password</dt><dd>Changed Jun 2, 2026</dd></div>
          </dl>
        </section>
        <section class="panel">
          <header class="panel-head"><div><h2>Notifications</h2><p>Email to ${h(inv.email)}</p></div></header>
          <div class="toggles">
            ${toggle('nt-docs', 'New documents', 'Reports, statements and notices', true)}
            ${t.modules.capitalCalls !== false ? toggle('nt-calls', 'Capital calls', 'Email and text message', true) : ''}
            ${toggle('nt-dist', 'Distributions', 'When a payment is sent', true)}
            ${t.modules.messages !== false ? toggle('nt-msgs', 'Message replies', 'When our team responds', true) : ''}
            ${t.modules.opportunities !== false ? toggle('nt-opps', 'New offerings', 'Opportunities for existing investors', false) : ''}
          </div>
        </section>
        <section class="panel">
          <header class="panel-head"><div><h2>Authorized users</h2></div></header>
          <ul class="people">${inv.authorized.map((p) => `<li><span class="avatar avatar-sm" aria-hidden="true">${h(p.name.split(' ').map((x) => x[0]).slice(0, 2).join(''))}</span><div><strong>${h(p.name)}</strong><span>${h(p.role)} · since ${date(p.since)}</span></div></li>`).join('')}</ul>
          ${t.modules.messages !== false ? '<button class="btn btn-secondary btn-sm" type="button" data-action="compose" data-subject="Add an authorized user">Add a user</button>' : ''}
        </section>
        <section class="panel">
          <header class="panel-head"><div><h2>Appearance</h2><p>Saved on this device</p></div></header>
          <div class="segmented" role="radiogroup" aria-label="Appearance">
            ${['system', 'light', 'dark'].map((v) => `<label><input type="radio" name="appearance" value="${v}" data-appearance${pref === v ? ' checked' : ''}><span>${icon(v === 'system' ? 'monitor' : v === 'light' ? 'sun' : 'moon')}${v[0].toUpperCase() + v.slice(1)}</span></label>`).join('')}
          </div>
        </section>
      </div>`;
  }

  function viewSignIn() {
    const t = state.tenant;
    const d = state.data;
    const step = state.signinStep;
    const form =
      step === 'code'
        ? `<form class="signin-form" id="code-form" novalidate>
            <h2>Check your authenticator</h2>
            <p class="sub">Enter the 6-digit code for ${h(t.shortName)} from your authenticator app.</p>
            <label class="field" for="si-code"><span>Verification code</span><input id="si-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" value="482 913"></label>
            <label class="check" for="si-trust"><input id="si-trust" type="checkbox" checked><span>Trust this device for 30 days</span></label>
            <button class="btn btn-primary btn-block" type="submit">Verify and continue</button>
            <button class="link-btn" type="button" data-action="signin-back">Use a different account</button>
          </form>`
        : `<form class="signin-form" id="signin-form" novalidate>
            <h2>Sign in</h2>
            <p class="sub">Use the email address on file with ${h(t.shortName)}.</p>
            <label class="field" for="si-email"><span>Email</span><input id="si-email" name="email" type="email" autocomplete="username" value="${h(d.investor.email)}" required></label>
            <label class="field" for="si-pass"><span>Password</span><input id="si-pass" name="password" type="password" autocomplete="current-password" value="sample-password" required></label>
            <p class="field-error" id="signin-error" hidden>Enter your email and password.</p>
            <button class="btn btn-primary btn-block" type="submit">Sign in</button>
            <div class="signin-links"><button class="link-btn" type="button" data-action="toast" data-msg="We sent a reset link to ${h(d.investor.email)}.">Forgot password?</button><button class="link-btn" type="button" data-action="toast" data-msg="Check your invitation email for an activation link, or call ${h(t.support.phone)}.">First time? Activate your account</button></div>
          </form>`;
    return `<div class="signin">
      <section class="signin-brand">
        <div class="signin-logo">${B.lockup(t)}</div>
        <div class="signin-copy"><p class="eyebrow">${h(t.portalName)}</p><h1>${h(t.signin.headline)}</h1><p>${h(t.signin.sub)}</p></div>
        <p class="signin-domain">${icon('lock')}<span>${h(t.domain)}</span></p>
      </section>
      <section class="signin-side">
        ${form}
        <div class="signin-help"><p>Need help signing in? ${h(t.support.team)}</p><p><span>${h(t.support.phone)}</span> · <span>${h(t.support.email)}</span></p><p class="fine">${h(t.support.hours)}</p></div>
        <p class="signin-legal">© 2026 ${h(t.legalName)}${t.showPoweredBy ? ' · Powered by Carrow &amp; Vale' : ''}</p>
      </section>
    </div>`;
  }

  const VIEWS = {
    overview: viewOverview,
    investments: viewInvestments,
    activity: viewActivity,
    documents: viewDocuments,
    'tax-center': viewTax,
    messages: viewMessages,
    opportunities: viewOpportunities,
    profile: viewProfile
  };

  /* ---------- Render ---------- */
  const root = () => document.getElementById('portal-root');

  function render() {
    const t = state.tenant;
    const el = root();
    if (!el) return;
    document.title = `${t.portalName} · ${t.shortName}`;
    if (state.route === 'sign-in') {
      el.className = 'portal-root is-signin';
      el.innerHTML = viewSignIn();
      return;
    }
    el.className = 'portal-root' + (state.navOpen ? ' nav-open' : '');
    el.innerHTML = `<div class="portal">
      ${navHTML()}
      <div class="nav-scrim" data-action="nav-close" ${state.navOpen ? '' : 'hidden'}></div>
      <div class="workspace">
        ${topbarHTML()}
        <main class="main" id="main" tabindex="-1"><div class="main-inner">${VIEWS[state.route]()}</div></main>
        ${footerHTML()}
      </div>
    </div>`;
    mountCharts();
    fitSegments();
  }

  function mountCharts() {
    const d = state.data;
    document.querySelectorAll('[data-chart]').forEach((host) => {
      const kind = host.getAttribute('data-chart');
      const draw = () => {
        if (kind === 'nav') {
          NS.charts.line(host, {
            labels: d.quarters,
            series: [
              { name: 'Capital account', values: d.navSeries, color: 'var(--chart-1)', area: true },
              { name: 'Net contributions', values: d.netContrib, color: 'var(--chart-muted)' }
            ],
            height: 270,
            ariaLabel: `Line chart. Capital account grew from ${money(d.navSeries[0])} to ${money(d.navSeries[d.navSeries.length - 1])} while net contributions moved from ${money(d.netContrib[0])} to ${money(d.netContrib[d.netContrib.length - 1])}. Use left and right arrow keys to read each quarter.`
          });
        } else if (kind === 'dist') {
          NS.charts.columns(host, {
            labels: d.quarters,
            values: d.distByQuarter,
            color: 'var(--chart-1)',
            seriesName: 'Distributions',
            height: 240,
            ariaLabel: `Column chart of distributions by quarter. Most recent quarter: ${money(d.distByQuarter[d.distByQuarter.length - 1])}. Use left and right arrow keys to read each quarter.`
          });
        }
      };
      draw();
      let w = host.clientWidth;
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (!host.isConnected) return ro.disconnect();
          if (Math.abs(host.clientWidth - w) > 2) {
            w = host.clientWidth;
            draw();
          }
        });
        ro.observe(host);
      }
    });
  }
  function fitSegments() {
    document.querySelectorAll('.seg-part').forEach((p) => {
      const lab = p.querySelector('.seg-label');
      if (!lab) return;
      lab.hidden = false;
      if (lab.offsetWidth + 16 > p.clientWidth) lab.hidden = true;
    });
  }

  function onRoute() {
    const prev = state.route;
    state.route = routeFromHash();
    state.navOpen = false;
    state.menuOpen = false;
    if (state.route === 'sign-in') state.signedIn = false;
    else if (!state.signedIn) state.signedIn = true;
    if (state.route !== 'messages') {
      state.composing = false;
    }
    render();
    if (prev !== state.route) {
      window.scrollTo(0, 0);
      const m = document.getElementById('main');
      if (m && prev) m.focus({ preventScroll: true });
    }
  }

  /* ---------- Tenant switching (used by Brand Studio) ---------- */
  function setTenant(id) {
    const t = getTenant(id) || getTenant(NS.DEFAULT_TENANT);
    state.tenant = t;
    state.data = NS.buildData(t);
    state.thread = null;
    state.composing = false;
    store.set('active', t.id);
    B.apply(t);
    applyAppearance();
    if (!enabled(state.route) && state.route !== 'sign-in') {
      go('overview');
      return;
    }
    render();
  }
  let rerenderQueued = false;
  function updateTenant(t, opts) {
    state.tenant = t;
    if (opts && opts.data) state.data = NS.buildData(t);
    B.apply(t);
    applyAppearance();
    saveTenant(t);
    if (!enabled(state.route) && state.route !== 'sign-in') {
      go('overview');
      return;
    }
    if (rerenderQueued) return;
    rerenderQueued = true;
    requestAnimationFrame(() => {
      rerenderQueued = false;
      render();
    });
  }

  /* ---------- Toasts and dialogs ---------- */
  function toast(msg) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = msg;
    box.appendChild(n);
    setTimeout(() => n.classList.add('out'), 3600);
    setTimeout(() => n.remove(), 4000);
  }

  function openDoc(id) {
    const d = state.data;
    let doc = d.docs.find((x) => x.id === id);
    const o = state.tenant.offering;
    if (!doc && id === 'offer-deck') doc = { id, title: `${o.short} Overview`, cat: 'reports', kind: 'offering', fund: null, fundName: o.name, date: '2026-10-20', pages: 32, size: '5.2 MB' };
    if (!doc && id === 'offer-summary') doc = { id, title: `${o.short} Executive Summary`, cat: 'reports', kind: 'offering', fund: null, fundName: o.name, date: '2026-10-20', pages: 4, size: '720 KB' };
    if (!doc) return;
    readSet()[doc.id] = true;
    const dlg = document.getElementById('doc-dialog');
    dlg.innerHTML = `<div class="dlg-head"><div><h2 id="dlg-title">${h(doc.title)}</h2><p>${h(doc.fundName)} · ${date(doc.date)} · ${doc.pages} pages · PDF, ${doc.size}</p></div>
      <div class="dlg-actions"><button class="btn btn-secondary btn-sm" type="button" data-action="download">${icon('download')}Download</button><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close document">${icon('close')}</button></div></div>
      <div class="dlg-body">${NS.paper(doc, state.tenant, d)}</div>`;
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    // Reflect the read state behind the dialog.
    render();
  }

  /* ---------- Events ---------- */
  function onClick(e) {
    const a = e.target.closest('[data-action]');
    if (!a) {
      if (state.menuOpen && !e.target.closest('.menu-wrap')) {
        state.menuOpen = false;
        render();
      }
      return;
    }
    const act = a.getAttribute('data-action');
    const t = state.tenant;
    switch (act) {
      case 'nav-open':
        state.navOpen = true;
        render();
        setTimeout(() => {
          const l = document.querySelector('.nav .nav-link');
          if (l) l.focus();
        });
        break;
      case 'nav-close':
        state.navOpen = false;
        render();
        break;
      case 'menu':
        state.menuOpen = !state.menuOpen;
        render();
        if (state.menuOpen) {
          const f = document.querySelector('.menu [role="menuitem"]');
          if (f) f.focus();
        }
        break;
      case 'cycle-theme': {
        const order = ['system', 'light', 'dark'];
        const cur = state.appearance || t.appearance || 'system';
        state.appearance = order[(order.indexOf(cur) + 1) % 3];
        store.set('appearance', state.appearance);
        applyAppearance();
        render();
        toast(`Appearance: ${state.appearance === 'system' ? 'matches your device' : state.appearance}`);
        const b = document.querySelector('[data-action="cycle-theme"]');
        if (b) b.focus();
        break;
      }
      case 'sign-out':
        state.signinStep = 'credentials';
        go('sign-in');
        break;
      case 'signin-back':
        state.signinStep = 'credentials';
        render();
        break;
      case 'tab':
        state.activityTab = a.getAttribute('data-tab');
        render();
        document.getElementById('tab-' + state.activityTab).focus();
        break;
      case 'doc-cat':
        state.docFilter.cat = a.getAttribute('data-cat');
        document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === a)));
        document.getElementById('doc-list').innerHTML = docListHTML();
        break;
      case 'clear-filters':
        state.docFilter = { q: '', cat: 'all', fund: 'all', year: 'all' };
        render();
        break;
      case 'open-doc':
        e.preventDefault();
        openDoc(a.getAttribute('data-id'));
        break;
      case 'close-dialog': {
        const dlg = document.getElementById('doc-dialog');
        if (dlg.close) dlg.close();
        else dlg.removeAttribute('open');
        break;
      }
      case 'download':
        toast('Sample document. No file is attached in this demo portal.');
        break;
      case 'compose':
        e.preventDefault();
        state.composing = true;
        state.thread = null;
        state.composeSubject = a.getAttribute('data-subject') || '';
        if (state.route !== 'messages') go('messages');
        else render();
        setTimeout(() => {
          const s = document.getElementById(state.composeSubject ? 'msg-body' : 'msg-subject');
          if (s) s.focus();
        });
        break;
      case 'open-thread': {
        e.preventDefault();
        const id = a.getAttribute('data-id');
        state.thread = id;
        state.composing = false;
        const th = threadsFor().find((x) => x.id === id);
        if (th) th.unread = false;
        if (state.route !== 'messages') go('messages');
        else render();
        break;
      }
      case 'close-thread':
        state.thread = null;
        state.composing = false;
        render();
        break;
      case 'reset-call':
        delete state.callRequest[t.id];
        render();
        break;
      case 'toast':
        toast(a.getAttribute('data-msg'));
        break;
      default:
        break;
    }
  }

  function onInput(e) {
    const el = e.target;
    const key = el.getAttribute('data-filter');
    if (key) {
      state.docFilter[key] = el.value;
      document.getElementById('doc-list').innerHTML = docListHTML();
      return;
    }
    if (el.hasAttribute('data-appearance') && el.checked) {
      state.appearance = el.value;
      store.set('appearance', el.value);
      applyAppearance();
    }
  }

  function staffReply(th, body) {
    const t = state.tenant;
    setTimeout(() => {
      th.messages.push({ from: 'staff', name: 'Dana Whitfield', at: '2026-11-05T' + nowHM(), body });
      th.status = 'replied';
      if (state.route === 'messages' && state.thread === th.id) render();
      else {
        th.unread = true;
        render();
      }
      toast(`New reply from ${t.support.team}`);
    }, 1600);
  }
  function nowHM() {
    const n = new Date();
    return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  }

  function onSubmit(e) {
    const f = e.target;
    const t = state.tenant;
    if (!f.id) return;
    e.preventDefault();
    if (f.id === 'signin-form') {
      const ok = f.email.value.trim() && f.password.value;
      document.getElementById('signin-error').hidden = !!ok;
      if (!ok) return;
      state.signinStep = 'code';
      render();
      const c = document.getElementById('si-code');
      if (c) c.focus();
    } else if (f.id === 'code-form') {
      state.signinStep = 'credentials';
      state.signedIn = true;
      go('overview');
      toast(`Signed in to ${t.shortName} ${t.portalName}`);
    } else if (f.id === 'compose-form') {
      const subject = f.subject.value.trim();
      const body = f.body.value.trim();
      const err = document.getElementById('compose-error');
      if (!subject || !body) {
        err.hidden = false;
        (subject ? f.body : f.subject).focus();
        return;
      }
      const th = { id: 'n' + Date.now(), subject, topic: f.topic.value, status: 'sent', unread: false, messages: [{ from: 'investor', at: '2026-11-05T' + nowHM(), body }] };
      threadsFor().unshift(th);
      state.composing = false;
      state.thread = th.id;
      render();
      toast('Message sent');
      staffReply(th, `Thanks, Jordan. We received your message and a member of our team is on it. You'll hear back within ${t.support.response}.`);
    } else if (f.id === 'reply-form') {
      const body = f.body.value.trim();
      if (!body) {
        f.body.focus();
        return;
      }
      const th = threadsFor().find((x) => x.id === f.getAttribute('data-thread'));
      th.messages.push({ from: 'investor', at: '2026-11-05T' + nowHM(), body });
      th.status = 'sent';
      render();
      const rb = document.getElementById('reply-body');
      if (rb) rb.focus();
      toast('Reply sent');
      staffReply(th, `Thanks for the follow-up. We'll get back to you within ${t.support.response}.`);
    } else if (f.id === 'call-form') {
      if (!f.phone.value.trim()) {
        f.phone.focus();
        return;
      }
      state.callRequest[t.id] = { day: f.day.value, window: f.window.value, phone: f.phone.value.trim() };
      if (t.modules.messages !== false) {
        threadsFor().unshift({
          id: 'c' + Date.now(),
          subject: `Call request: ${t.offering.short}`,
          topic: 'Opportunities',
          status: 'replied',
          unread: true,
          messages: [{ from: 'staff', name: 'Licensed representative team', at: '2026-11-05T' + nowHM(), body: `We have your request for a call about ${t.offering.name} on ${date(f.day.value, 'long')}, ${f.window.value.toLowerCase()}. A Series 7 and Series 63 registered representative will call ${f.phone.value.trim()}.` }]
        });
      }
      render();
      toast('Call requested');
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (state.menuOpen) {
        state.menuOpen = false;
        render();
        const b = document.querySelector('.avatar');
        if (b) b.focus();
      } else if (state.navOpen) {
        state.navOpen = false;
        render();
      }
    }
  }

  /* ---------- Boot ---------- */
  function boot() {
    const app = document.getElementById('app');
    app.innerHTML = `<div id="portal-root" class="portal-root"></div>
      <dialog id="doc-dialog" class="doc-dialog"></dialog>
      <div id="toasts" class="toasts" role="status" aria-live="polite"></div>`;
    state.tenant = getTenant(resolveTenantId()) || getTenant(NS.DEFAULT_TENANT);
    state.data = NS.buildData(state.tenant);
    B.apply(state.tenant);
    applyAppearance();
    state.route = routeFromHash();
    state.signedIn = state.route !== 'sign-in';
    render();
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onRoute);
    const dlg = document.getElementById('doc-dialog');
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg && dlg.close) dlg.close();
    });
    if (NS.studio) NS.studio.init();
  }

  NS.app = { state, render, go, setTenant, updateTenant, toast, boot, money, date, h };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
