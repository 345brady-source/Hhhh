/*
 * App shell: state, routing, roles and permissions for each edition
 * (edition.js), the Carrow & Vale operator bar (managed edition), shared UI
 * helpers and event delegation. Views live in portal.js, onboarding.js,
 * console.js and diy.js.
 */
(function () {
  'use strict';
  const NS = window.CVPortal;
  const B = NS.brand;
  const E = NS.EDITION;

  /* ---------- Formatting ---------- */
  const h = B.esc;
  const usd = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const usdc = (c) => (c < 0 ? '−$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function date(iso, style) {
    if (!iso) return '';
    const d = NS.dates.parse(iso);
    const o =
      style === 'my' ? { month: 'short', year: 'numeric' } :
      style === 'long' ? { month: 'long', day: 'numeric', year: 'numeric' } :
      style === 'wd' ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } :
      style === 'wdlong' ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } :
      { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, o));
  }
  const last4 = (s) => String(s || '').replace(/\s/g, '').slice(-4);
  const pct = (x, dp) => (x * 100).toFixed(dp == null ? 1 : dp) + '%';

  const ICONS = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    download: '<path d="M12 4v11m-5-5 5 5 5-5"/><path d="M5 20h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7 7 17"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    down: '<path d="M12 5v14m6-6-6 6-6-6"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>'
  };
  const icon = (name, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  const CV_MARK = `<svg class="cv-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M0 0 L100 0 L0 100 Z" fill="#0F2742"/><path d="M100 0 L100 100 L0 100 Z" fill="#1F7A8C"/><line x1="-6" y1="106" x2="106" y2="-6" stroke="#FFFFFF" stroke-width="11"/></svg>`;
  NS.CV_MARK = CV_MARK;

  /* ---------- Toasts, dialogs, files ---------- */
  function toast(msg) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = msg;
    box.appendChild(n);
    setTimeout(() => n.classList.add('out'), 3800);
    setTimeout(() => n.remove(), 4200);
  }
  function dialog(html, cls) {
    const d = document.getElementById('dlg');
    d.className = 'dlg ' + (cls || '');
    d.innerHTML = html;
    if (typeof d.showModal === 'function') {
      if (!d.open) d.showModal();
    } else d.setAttribute('open', '');
    const f = d.querySelector('[autofocus]') || d.querySelector('button');
    if (f) f.focus();
  }
  function closeDialog() {
    const d = document.getElementById('dlg');
    if (d.close) d.close();
    else d.removeAttribute('open');
  }
  /** Offer a generated file: the viewer's save prompt when the page runs inside Claude, a normal download elsewhere. */
  async function download(filename, data, opts) {
    opts = opts || {};
    let dl = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads');
    } catch (e) {
      dl = null;
    }
    if (dl) {
      const name = opts.hostName || filename;
      try {
        await dl.save({ filename: name, data });
        toast(`Saved ${name}`);
      } catch (err) {
        toast(err && err.code === 'declined' ? 'Download cancelled' : 'Downloads are not available here. Use Copy instead.');
      }
      return;
    }
    try {
      const blob = new Blob([data], { type: opts.mime || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Downloading ${filename}`);
    } catch (e) {
      toast('Downloads are not available here. Use Copy instead.');
    }
  }
  function copy(text, fallbackEl) {
    const fb = () => {
      if (fallbackEl) {
        const r = document.createRange();
        r.selectNodeContents(fallbackEl);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        toast('Copy is blocked here. The text is selected; press Ctrl+C or Cmd+C.');
      } else toast('Copy is blocked here.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'), fb);
    else fb();
  }

  NS.ui = { h, usd, usdc, date, last4, pct, icon, toast, dialog, closeDialog, download, copy };

  /* ---------- State ---------- */
  const state = { clientId: null, ws: null, route: 'investments', param: null, viewer: null, navOpen: false, ui: {} };
  NS.state = state;
  const ws = () => state.ws;

  NS.views = {};
  NS.actions = {};
  NS.changes = {};
  NS.forms = {};
  NS.binders = {};
  /**
   * Other modules add sections to shared pages without editing them:
   * NS.hooks.investmentsTop.push((inv) => html), documentsTop (inv),
   * consoleAttention (ws) → '<li>…</li>' items for the overview.
   */
  NS.hooks = { investmentsTop: [], documentsTop: [], consoleAttention: [] };
  NS.runHooks = (name, ...args) =>
    (NS.hooks[name] || [])
      .map((fn) => {
        try {
          return fn(...args) || '';
        } catch (e) {
          if (window.console) console.error(e);
          return '';
        }
      })
      .join('');

  function resolveClient() {
    const list = NS.workspace.list();
    let qs = null;
    try {
      qs = new URLSearchParams(location.search).get('tenant');
    } catch (e) {
      /* ignore */
    }
    if (qs && list.some((c) => c.id === qs)) return qs;
    for (const c of list) {
      const w = NS.workspace.load(c.id);
      if (w && w.tenant.domain === location.hostname) return c.id;
    }
    const saved = NS.store.get('active', null);
    if (saved && list.some((c) => c.id === saved)) return saved;
    // A DIY visitor with no portal yet starts at sign-up.
    return E.diy ? null : NS.DEFAULT_TENANT;
  }

  function setClient(id, route) {
    if (!id && E.diy) {
      state.clientId = null;
      state.ws = null;
      state.ui = {};
      state.viewer = null;
      B.apply(NS.TENANT_TEMPLATE);
      applyAppearance();
      go(route || 'diy-start');
      return;
    }
    const w = NS.workspace.load(id) || NS.workspace.load(NS.DEFAULT_TENANT);
    state.clientId = w.tenant.id;
    state.ws = w;
    state.ui = {};
    state.viewer = w.investors.length ? w.investors[0].id : null;
    NS.store.set('active', w.tenant.id);
    B.apply(w.tenant);
    applyAppearance();
    if (route) go(route);
    else render();
  }
  function save(now) {
    NS.workspace.save(ws(), now);
  }
  function applyTenant() {
    B.apply(ws().tenant);
    applyAppearance();
    save();
  }

  /* ---------- Appearance ---------- */
  const rootEl = document.documentElement;
  const hostTheme = rootEl.getAttribute('data-theme');
  /** The viewer's own choice (Settings) wins; otherwise the client's default; otherwise the device. */
  function applyAppearance() {
    const mine = NS.store.get('appearance', null);
    const pref = mine || (ws() ? ws().tenant.appearance : 'system');
    if (pref === 'light' || pref === 'dark') rootEl.setAttribute('data-theme', pref);
    else if (!mine && hostTheme) rootEl.setAttribute('data-theme', hostTheme);
    else rootEl.removeAttribute('data-theme');
  }
  function setAppearance(pref) {
    NS.store.set('appearance', pref);
    applyAppearance();
  }

  /* ---------- Routing ---------- */
  const PREFIXED = [
    ['investment-', 'investment'],
    ['subscribe-', 'subscribe'],
    ['console-offering-', 'console-offering'],
    ['console-envelope-', 'console-envelope'],
    ['sign-', 'sign'],
    ['join-', 'join']
  ];
  function parseHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    for (const [p, key] of PREFIXED) if (raw.indexOf(p) === 0) return { key, param: raw.slice(p.length) };
    if (NS.views[raw]) return { key: raw, param: null };
    return { key: 'investments', param: null };
  }
  function go(route) {
    if (location.hash.replace(/^#/, '') === route) onRoute();
    else location.hash = route;
  }
  function onRoute() {
    const prev = state.route + ':' + state.param;
    const r = parseHash();
    state.route = r.key;
    state.param = r.param;
    state.navOpen = false;
    render();
    if (prev !== state.route + ':' + state.param) {
      window.scrollTo(0, 0);
      const m = document.getElementById('main');
      if (m) m.focus({ preventScroll: true });
    }
  }
  const modeOf = (key) => (NS.views[key] && NS.views[key].mode) || 'portal';

  /* ---------- Roles ----------
   * Managed edition (Carrow & Vale):
   *   staff    Carrow & Vale: every client, the operator bar, client setup and offering configuration.
   *   sponsor  the client's own staff: its console and investor previews; offerings read-only.
   * DIY edition (Shareholder Desk):
   *   admin    the sponsor's admins: everything, including brand, offerings, integrations and team.
   *   team     the sponsor's team members: operations; offerings, brand and integrations read-only.
   * Both: investor, the client's branded portal only.
   * In production the role comes from sign-in. This build has no server, so in demo
   * mode a small control sets it. Set window.CVPortalConfig = { demo: false } before
   * the scripts load to remove that control.
   */
  const config = Object.assign({ demo: true }, window.CVPortalConfig || {});
  const ROLES = E.roles;
  function initialRole() {
    if (ROLES.indexOf(config.role) >= 0) return config.role;
    const saved = NS.store.get('role', null);
    if (config.demo && ROLES.indexOf(saved) >= 0) return saved;
    return config.demo ? E.owner : 'investor';
  }
  state.role = initialRole();
  /**
   * What the signed-in role may do: 'portal' (investor pages), 'console',
   * 'operate' (distributions, calls, requests, documents, notices), 'configure'
   * (offerings, brand, offering intake, integrations, team) and 'clients'
   * (switch between and add clients: Carrow & Vale only).
   */
  function can(what, role) {
    role = role || state.role;
    if (role === 'investor') return what === 'portal';
    if (what === 'configure') return role === E.owner;
    if (what === 'clients') return E.managed && role === E.owner;
    return what === 'portal' || what === 'console' || what === 'operate';
  }
  /** Pages only the owner role opens (Carrow & Vale staff, or a DIY admin). */
  const OWNER_ONLY = ['console-brand', 'console-intake', 'console-integrations', 'console-team'];
  function allowed(key) {
    const v = NS.views[key];
    if (v && v.edition && v.edition !== E.id) return false;
    if (v && v.standalone) return true;
    if (state.role === 'investor') return modeOf(key) === 'portal';
    if (key === 'console-new-client') return can('clients');
    if (OWNER_ONLY.indexOf(key) >= 0) return can('configure');
    return true;
  }
  const homeFor = (role) => (role === 'investor' ? 'investments' : 'console');

  /* ---------- Operator bar (Carrow & Vale only; investors never see it) ---------- */
  function viewerSelect(id) {
    const w = ws();
    if (!w.investors.length) return '';
    return `<label class="op-field op-viewer" for="${id}"><span>Viewing as</span><select id="${id}" data-change="viewer">${w.investors
      .map((inv) => `<option value="${h(inv.id)}"${inv.id === state.viewer ? ' selected' : ''}>${h(inv.title)}${inv.onboarding.status !== 'complete' ? ' (not activated)' : ''}</option>`)
      .join('')}</select></label>`;
  }
  /** Sponsor staff previewing their investors' view: plain bar, no Carrow & Vale branding. */
  function previewBarHTML() {
    return `<div class="pvbar" role="region" aria-label="Investor preview"><span class="pvbar-label">Investor preview</span>${viewerSelect('pv-viewer')}<a class="pvbar-back" href="#console">Back to console</a></div>`;
  }
  function demoHTML() {
    if (!config.demo) return '';
    const w = ws();
    if (!w) return '';
    const inv = w.investors.find((x) => x.id === state.viewer);
    const opt = (v, label) => `<option value="${v}"${state.role === v ? ' selected' : ''}>${label}</option>`;
    const labels = E.diy
      ? { admin: `Admin · ${h(w.tenant.shortName)}`, team: `Team member · ${h(w.tenant.shortName)}`, investor: `Investor · ${inv ? h(inv.title) : 'none yet'}` }
      : { staff: 'Carrow &amp; Vale staff', sponsor: `Sponsor staff · ${h(w.tenant.shortName)}`, investor: `Investor · ${inv ? h(inv.title) : 'none yet'}` };
    return `<label class="demo-role" for="demo-role"><span>Demo · signed in as</span><select id="demo-role" data-change="demo-role">
      ${ROLES.map((r) => opt(r, labels[r])).join('')}
    </select></label>${E.diy ? '<button class="demo-start" type="button" data-action="diy-start-over">New sign-up</button>' : ''}`;
  }
  function opbarHTML() {
    const mode = modeOf(state.route);
    const clients = NS.workspace.list();
    const viewer = mode === 'portal' ? viewerSelect('op-viewer') : '';
    return `<div class="op" role="region" aria-label="Carrow &amp; Vale operator controls">
      <div class="op-brand">${CV_MARK}<span class="op-word">CARROW <span>&amp;</span> VALE</span></div>
      <label class="op-field" for="op-client"><span>Client</span><select id="op-client" data-change="client">${clients
        .map((c) => `<option value="${h(c.id)}"${c.id === state.clientId ? ' selected' : ''}>${h(c.name)}</option>`)
        .join('')}<option value="__new">Add a client…</option></select></label>
      <nav class="op-modes" aria-label="View">
        <a href="#investments"${mode === 'portal' ? ' aria-current="page"' : ''}>Investor portal</a>
        <a href="#console"${mode === 'console' ? ' aria-current="page"' : ''}>Sponsor console</a>
      </nav>
      ${viewer}
    </div>`;
  }

  /* ---------- Render ---------- */
  function render() {
    const w = ws();
    const key = state.route;
    const standalone = NS.views[key] && NS.views[key].standalone;
    if (!w && !standalone) {
      if (E.diy) go('diy-start');
      return;
    }
    if (!allowed(key)) {
      go(homeFor(state.role));
      return;
    }
    const view = NS.views[key] || NS.views.investments;
    const mode = standalone ? 'standalone' : modeOf(key);
    ROLES.forEach((r) => document.body.classList.toggle('role-' + r, state.role === r));
    document.body.classList.toggle('edition-diy', E.diy);
    document.body.classList.toggle('has-demo', !!config.demo && !!w);
    document.body.classList.toggle('mode-console', mode === 'console');
    document.body.classList.toggle('mode-portal', mode === 'portal');
    document.body.classList.toggle('mode-standalone', mode === 'standalone');
    document.title = standalone ? view.title || E.product : mode === 'console' ? `${w.tenant.shortName} · ${E.diy ? 'Shareholder Desk' : 'Sponsor Console'}` : `${w.tenant.portalName} · ${w.tenant.shortName}`;
    // Carrow & Vale staff get the operator bar; a sponsor's own people get a plain preview bar in the investor view.
    document.getElementById('opbar').innerHTML = !w || standalone ? '' : E.managed && state.role === 'staff' ? opbarHTML() : state.role !== 'investor' && mode === 'portal' ? previewBarHTML() : '';
    document.getElementById('demo').innerHTML = standalone ? '' : demoHTML();
    const el = document.getElementById('view');
    el.innerHTML = view.render(state.param);
    if (view.after) view.after(state.param);
  }

  /* ---------- Two-way binding for editors ---------- */
  function setPath(obj, path, v) {
    const ks = path.split('.');
    let o = obj;
    ks.slice(0, -1).forEach((k) => {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    });
    o[ks[ks.length - 1]] = v;
  }
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  const isTextual = (el) => el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['checkbox', 'radio', 'file', 'date', 'color'].indexOf(el.type) < 0);
  function onBind(el, evtType) {
    const spec = el.getAttribute('data-bind');
    const i = spec.indexOf(':');
    const scope = spec.slice(0, i);
    const path = spec.slice(i + 1);
    if (el.type === 'color') {
      if (evtType !== 'input') return;
    } else if (isTextual(el) ? evtType !== 'input' : evtType !== 'change') return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'radio') {
      if (!el.checked) return;
      v = el.value;
    } else if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
    else v = el.value;
    if (el.hasAttribute('data-upper')) v = String(v).toUpperCase();
    const fn = NS.binders[scope];
    if (fn) fn(path, v, el);
  }

  /* ---------- Events ---------- */
  function boot() {
    const app = document.getElementById('app');
    app.innerHTML = `<div id="opbar"></div><div id="view"></div><dialog id="dlg" class="dlg"></dialog><div id="toasts" class="toasts" role="status" aria-live="polite"></div><div id="demo"></div>`;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (a && NS.actions[a.getAttribute('data-action')]) NS.actions[a.getAttribute('data-action')](a, e);
    });
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-bind')) onBind(el, 'input');
      const k = el.getAttribute && el.getAttribute('data-input');
      if (k && NS.changes[k]) NS.changes[k](el, e);
    });
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-bind')) onBind(el, 'change');
      const k = el.getAttribute && el.getAttribute('data-change');
      if (k && NS.changes[k]) NS.changes[k](el, e);
    });
    document.addEventListener('submit', (e) => {
      const f = e.target;
      const k = f.getAttribute('data-form');
      if (k && NS.forms[k]) {
        e.preventDefault();
        NS.forms[k](f, e);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.navOpen) {
        state.navOpen = false;
        render();
      }
    });
    const dlg = document.getElementById('dlg');
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeDialog();
    });
    window.addEventListener('hashchange', onRoute);

    const r = parseHash();
    state.route = r.key;
    state.param = r.param;
    setClient(resolveClient());
  }

  NS.actions['close-dialog'] = () => closeDialog();
  NS.actions['nav-toggle'] = () => {
    state.navOpen = !state.navOpen;
    render();
  };
  NS.changes.client = (el) => {
    if (el.value === '__new') {
      el.value = state.clientId;
      go('console-new-client');
      return;
    }
    setClient(el.value, modeOf(state.route) === 'console' ? 'console' : 'investments');
  };
  NS.changes['demo-role'] = (el) => {
    state.role = el.value;
    NS.store.set('role', state.role);
    const inv = ws().investors.find((x) => x.id === state.viewer);
    if (state.role === 'investor' && inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else go(homeFor(state.role));
    NS.ui.toast(state.role === 'investor' ? `Signed in as ${inv ? inv.title : 'an investor'}` : state.role === 'staff' ? 'Signed in as Carrow & Vale staff' : `Signed in as ${E.roleLabel[state.role].toLowerCase()} of ${ws().tenant.shortName}`);
  };
  NS.changes.viewer = (el) => {
    state.viewer = el.value;
    const inv = ws().investors.find((x) => x.id === el.value);
    if (inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else go('investments');
  };

  /** The signed-in person as the change log names them. */
  function actor() {
    const w = ws();
    const firm = w ? w.tenant.shortName : '';
    if (state.role === 'investor') {
      const inv = w && w.investors.find((i) => i.id === state.viewer);
      return inv ? `${inv.title} (investor)` : 'Investor';
    }
    if (E.managed) return state.role === 'staff' ? 'Carrow & Vale staff' : `${firm || 'Sponsor'} staff`;
    const me = w && (w.team || []).find((m) => m.current) || (w && (w.team || []).find((m) => m.role === state.role));
    const what = state.role === 'admin' ? 'admin' : 'team';
    return me ? `${me.name} (${firm} ${what})` : `${firm} ${what}`;
  }

  NS.actions['diy-start-over'] = () => {
    NS.store.del('active');
    state.role = E.owner;
    NS.store.set('role', state.role);
    setClient(null, 'diy-start');
  };

  NS.app = { state, config, allowed, can, actor, render, go, setClient, save, applyTenant, applyAppearance, setAppearance, setPath, getPath, ws, modeOf };

  // Views register after this file loads, so boot once every script has run.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
