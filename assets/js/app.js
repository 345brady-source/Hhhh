/*
 * App shell: state, routing, the Carrow & Vale operator bar, shared UI helpers
 * and event delegation. Views live in portal.js, onboarding.js and console.js.
 */
(function () {
  'use strict';
  const NS = window.CVPortal;
  const B = NS.brand;

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
    return NS.DEFAULT_TENANT;
  }

  function setClient(id, route) {
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
    ['console-offering-', 'console-offering']
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

  /* ---------- Operator bar (Carrow & Vale only; investors never see it) ---------- */
  function opbarHTML() {
    const mode = modeOf(state.route);
    const clients = NS.workspace.list();
    const w = ws();
    const viewer =
      mode === 'portal' && w.investors.length
        ? `<label class="op-field op-viewer" for="op-viewer"><span>Viewing as</span><select id="op-viewer" data-change="viewer">${w.investors
            .map((inv) => `<option value="${h(inv.id)}"${inv.id === state.viewer ? ' selected' : ''}>${h(inv.title)}${inv.onboarding.status !== 'complete' ? ' (not activated)' : ''}</option>`)
            .join('')}</select></label>`
        : '';
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
    if (!w) return;
    const key = state.route;
    const view = NS.views[key] || NS.views.investments;
    const mode = modeOf(key);
    document.body.classList.toggle('mode-console', mode === 'console');
    document.body.classList.toggle('mode-portal', mode === 'portal');
    document.title = mode === 'console' ? `${w.tenant.shortName} · Sponsor Console` : `${w.tenant.portalName} · ${w.tenant.shortName}`;
    document.getElementById('opbar').innerHTML = opbarHTML();
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
    app.innerHTML = `<div id="opbar"></div><div id="view"></div><dialog id="dlg" class="dlg"></dialog><div id="toasts" class="toasts" role="status" aria-live="polite"></div>`;
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
  NS.changes.viewer = (el) => {
    state.viewer = el.value;
    const inv = ws().investors.find((x) => x.id === el.value);
    if (inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else go('investments');
  };

  NS.app = { state, render, go, setClient, save, applyTenant, applyAppearance, setAppearance, setPath, getPath, ws, modeOf };

  // Views register after this file loads, so boot once every script has run.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
