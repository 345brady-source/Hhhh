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
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 10h4a1 1 0 0 1 1 1v10"/><path d="M3 21h18"/><path d="M8 8h3M8 12h3M8 16h3"/>',
    bars: '<path d="M4 4v16h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    bank: '<path d="m3 10 9-6 9 6"/><path d="M5.5 10v8M10 10v8M14 10v8M18.5 10v8"/><path d="M3 20h18"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>'
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
    if (!d.open && !d.hasAttribute('open')) markDialog();
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
  /*
   * Browser back while a dialog is open closes the dialog instead of changing the page under it (plan 06-29). Opening one
   * adds a history entry with the same address, and marks the entry below it with the same id; back from it closes the
   * dialog. A dialog closed any other way (its X, Escape, an action) leaves that entry behind, spent: it shows the same page
   * as the entry below, so a later back or forward passes over it and one press still moves one page. History is traversed
   * here only in answer to the person's own back or forward, never after the portal's own navigation, so nothing races it.
   */
  let dlgMark = '';
  let skipping = false;
  let lastState = {};
  const histState = () => (history.state && typeof history.state === 'object' ? history.state : {});
  function markDialog() {
    try {
      const st = histState();
      // Opened again on a spent entry: that entry serves this dialog too.
      if (st.dlg) return (dlgMark = st.dlg);
      const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      history.replaceState(Object.assign({}, st, { dlgBase: id }), '');
      history.pushState({ dlg: id }, '');
      dlgMark = id;
      lastState = histState();
    } catch (e) {
      dlgMark = '';
    }
  }
  function onHistory() {
    const st = histState();
    const prev = lastState;
    lastState = st;
    if (skipping) {
      skipping = false;
      return;
    }
    const d = document.getElementById('dlg');
    const open = !!(d && d.open);
    const pass = (dir) => {
      skipping = true;
      setTimeout(() => (skipping = false), 1500);
      if (dir > 0) history.forward();
      else history.back();
    };
    // Back from the open dialog's entry: the dialog closes, the page stays.
    if (open && dlgMark && st.dlgBase === dlgMark) {
      dlgMark = '';
      closeDialog();
      return;
    }
    // A spent dialog entry: passed over in the direction of travel (forward when coming from the entry below it).
    if (st.dlg && !(open && st.dlg === dlgMark)) return pass(prev.dlgBase === st.dlg ? 1 : -1);
    // Back from a spent entry onto the same page below it: one more step, so the press leaves the page.
    if (!open && st.dlgBase && prev.dlg === st.dlgBase) pass(-1);
  }
  /** Offer a generated file: the viewer's save prompt when the page runs inside the host assistant, a normal download elsewhere. */
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
  /** remote: set when an investor opens an invitation from the integration server (DIY), { server }. */
  const state = { clientId: null, ws: null, route: 'overview', param: null, viewer: null, navOpen: false, ui: {}, remote: null };
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
      // An investor's invitation link (or a co-investor's sign-in link, coinvestor.js) opened where its portal is not stored:
      // its page explains (never the sign-up page).
      if (!route && (state.route === 'invite' || state.route === 'co')) return render();
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
  /**
   * Use a workspace that is not one of this browser's portals: the temporary one an invitation from the
   * integration server builds (onboarding.js). It is saved under its own id and never becomes the active portal.
   */
  function useWorkspace(w) {
    state.clientId = w.tenant.id;
    state.ws = w;
    B.apply(w.tenant);
    applyAppearance();
  }
  /** An integration server address as one comparable string (scheme, host, port and path; no trailing slash), or ''. */
  function serverKey(s) {
    try {
      const u = new URL(String(s || '').trim());
      if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.search || u.hash) return '';
      // Plain http only for this computer (testing an integration server locally).
      if (u.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return '';
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch (e) {
      return '';
    }
  }
  /**
   * The integration servers this portal page may load invitations from. Anything else in ?server= is refused,
   * so a link cannot make the firm's own portal page collect an investor's details for someone else's server:
   *   window.CVPortalConfig.integrationServers   the firm's own server(s), set where the portal is published
   *   the portal page's own origin                a server published on the same site
   *   a server set up on the Integrations page of a portal stored in this browser (the sponsor trying a link)
   */
  function trustedServers() {
    const out = [];
    const add = (x) => {
      const k = serverKey(x);
      if (k && out.indexOf(k) < 0) out.push(k);
    };
    const cfg = config.integrationServers || config.integrationServer || [];
    (Array.isArray(cfg) ? cfg : [cfg]).forEach(add);
    try {
      NS.workspace.list().forEach((c) => {
        const w = NS.store.get('ws:' + c.id, null);
        if (w && w.integrations && w.integrations.server) add(w.integrations.server.url);
      });
    } catch (e) {
      /* ignore */
    }
    return out;
  }
  /** Will this portal page, as published, open invitations from this server on any device (not only in this browser)? */
  function publishedServer(url) {
    const k = serverKey(url);
    if (!k) return false;
    const o = location.origin.toLowerCase();
    if (k === o || k.indexOf(o + '/') === 0) return true;
    const cfg = config.integrationServers || config.integrationServer || [];
    return (Array.isArray(cfg) ? cfg : [cfg]).some((x) => serverKey(x) === k);
  }
  /** ?server=<integration server> on an invitation link (DIY): { url, trusted }; the investor's browser loads the invitation from there. */
  function inviteServer() {
    if (!E.diy) return null;
    let s = '';
    try {
      s = new URLSearchParams(location.search).get('server') || '';
    } catch (e) {
      /* ignore */
    }
    if (!s) return null;
    const k = serverKey(s);
    const url = k ? String(s).trim().replace(/\/+$/, '') : '';
    return { url, trusted: !!k && (publishedServer(k) || trustedServers().indexOf(k) >= 0) };
  }
  function applyTenant() {
    B.apply(ws().tenant);
    applyAppearance();
    save();
  }

  /* ---------- Appearance ---------- */
  const rootEl = document.documentElement;
  // What a host frame asked for before the app loaded (the preview). The page's own static light default is not a host's choice.
  const hostTheme = rootEl.hasAttribute('data-theme-static') ? null : rootEl.hasAttribute('data-host-theme') ? rootEl.getAttribute('data-host-theme') || null : rootEl.getAttribute('data-theme');
  /** The viewer's own choice (Settings) wins; otherwise the client's default; otherwise light, the standard look. */
  function applyAppearance() {
    const mine = NS.store.get('appearance', null);
    const pref = mine || (ws() && ws().tenant.appearance) || 'light';
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
    ['console-filings-', 'console-filings'],
    ['console-taxdocs-', 'console-taxdocs'],
    ['sign-', 'sign'],
    ['join-', 'join'],
    ['invite-', 'invite'],
    ['taxdoc-', 'taxdoc'],
    ['co-', 'co']
  ];
  function parseHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    // A page's own name wins over a prefix: "sign-in" is the sign-in page, not the signing page for a document called "in".
    if (NS.views[raw]) return { key: raw, param: null };
    // A prefix applies only where its page is registered: an edition without the page gets the default below.
    for (const [p, key] of PREFIXED) if (raw.indexOf(p) === 0 && NS.views[key]) return { key, param: raw.slice(p.length) };
    return { key: NS.views.overview ? 'overview' : 'investments', param: null };
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
    const moved = prev !== state.route + ':' + state.param;
    press.afterHeld = null;
    // Held under a pending press (see "A press is never lost"): the new page's top and focus follow its drawing.
    if (render() === false) press.afterHeld = moved ? toTop : null;
    else if (moved) toTop();
  }
  function toTop() {
    window.scrollTo(0, 0);
    const m = document.getElementById('main');
    if (m) m.focus({ preventScroll: true });
  }
  const modeOf = (key) => (NS.views[key] && NS.views[key].mode) || 'portal';

  /* ---------- Roles ----------
   * Managed edition (Carrow & Vale):
   *   staff    Carrow & Vale: every client, the operator bar, client setup and offering configuration.
   *   sponsor  the client's own staff: its console and investor previews; offerings read-only.
   * Self-serve edition (internally "diy"):
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
  const homeFor = (role) => (role === 'investor' ? 'overview' : 'console');

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
  /** Sample sponsors the self-serve preview offers beside the visitor's own portal, so there is something to explore. */
  const DEMO_SPONSORS = ['kestrel-bay', 'ashwell-ridge', 'pellbrook'];
  function sponsorPickHTML(current) {
    if (!E.diy) return '';
    const all = NS.workspace.list();
    const mine = all.filter((c) => !c.sample);
    const samples = all.filter((c) => c.sample && (DEMO_SPONSORS.indexOf(c.id) >= 0 || c.id === current)).sort((a, b) => DEMO_SPONSORS.indexOf(a.id) - DEMO_SPONSORS.indexOf(b.id));
    if (!samples.length) return '';
    const opt = (c) => `<option value="${h(c.id)}"${c.id === current ? ' selected' : ''}>${h(c.name)}</option>`;
    return `<label class="demo-role" for="demo-sponsor"><span>Demo · sponsor</span><select id="demo-sponsor" data-change="demo-sponsor">${current ? '' : '<option value="">Choose a sample sponsor</option>'}${mine.length ? `<optgroup label="Your portal">${mine.map(opt).join('')}</optgroup>` : ''}<optgroup label="Sample sponsors">${samples.map(opt).join('')}</optgroup></select></label>`;
  }
  function demoHTML(standalone) {
    if (!config.demo) return '';
    const w = ws();
    // The sign-up page offers the sample sponsors. Other standalone pages (an investor's invitation, a signing link) show no demo controls.
    if (standalone || !w) return E.diy && state.route === 'diy-start' ? `<div class="demo-bar">${sponsorPickHTML('')}</div>` : '';
    const inv = w.investors.find((x) => x.id === state.viewer);
    // An account's co-investor signs in as themselves: offered beside the investor while the account has one.
    const co = inv && inv.coInvestor && inv.coInvestor.email ? inv.coInvestor : null;
    if (!co) state.co = false;
    const opt = (v, label) => `<option value="${v}"${state.role === v && !(v === 'investor' && state.co) ? ' selected' : ''}>${label}</option>${v === 'investor' && co ? `<option value="co-investor"${state.role === 'investor' && state.co ? ' selected' : ''}>Co-investor · ${h(co.name)}</option>` : ''}`;
    const labels = E.diy
      ? { admin: `Admin · ${h(w.tenant.shortName)}`, team: `Team member · ${h(w.tenant.shortName)}`, investor: `Investor · ${inv ? h(inv.title) : 'none yet'}` }
      : { staff: 'Carrow &amp; Vale staff', sponsor: `Sponsor staff · ${h(w.tenant.shortName)}`, investor: `Investor · ${inv ? h(inv.title) : 'none yet'}` };
    return `<div class="demo-bar">${sponsorPickHTML(w.tenant.id)}<label class="demo-role" for="demo-role"><span>${E.diy ? 'Signed in as' : 'Demo · signed in as'}</span><select id="demo-role" data-change="demo-role" title="${state.role === 'investor' && state.co && co ? `Co-investor · ${h(co.name)}` : labels[state.role] || ''}">
      ${ROLES.map((r) => opt(r, labels[r])).join('')}
    </select></label>${E.diy ? '<button class="demo-start" type="button" data-action="diy-start-over">New sign-up</button>' : ''}</div>`;
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
        <a href="#overview"${mode === 'portal' ? ' aria-current="page"' : ''}>Investor portal</a>
        <a href="#console"${mode === 'console' ? ' aria-current="page"' : ''}>Sponsor console</a>
      </nav>
      ${viewer}
    </div>`;
  }

  /**
   * Storage refused is never silent: when this browser will not keep the portal's records or files, the firm's people
   * are told once, at the top of the page, for as long as that is so. The work itself goes on in memory.
   */
  function storageNote() {
    const el = document.getElementById('notes');
    if (!el) return;
    const lost = NS.workspace.saveFailed() || NS.store.refused() || !!(NS.ops && NS.ops.files.refused());
    const html = lost && state.role !== 'investor' && !state.remote ? `<div class="pvbar pvbar-note" role="alert">${icon('alert')}<span><span class="pvbar-label">This browser is not letting the portal save.</span> Your work will be lost when you close this page.</span></div>` : '';
    // Written only when it appears or goes, so a screen reader announces it once and not at every redraw.
    if (!!el.firstChild !== !!html) el.innerHTML = html;
  }

  /* ---------- A press is never lost to a redraw (walkthrough-2 N4) ----------
   * render() rewrites the whole page. When something that finished in the background (page images drawn, a file stored, a
   * navigation queued by the press before) redraws between a finger or mouse button going down and its click, the pressed
   * control is replaced: with a mouse the click then reaches no control at all; with touch it lands on whatever the new page
   * has under the finger. So from a primary pointerdown until that press's click has been dispatched (or pointercancel, or
   * POINTER_UP_WAIT after pointerup with no click, or PRESS_MAX after pointerdown; at pointerup already when the pointer moved
   * more than TAP_SLOP, a drag, or the control pressed was redrawn by the person's own input: no click to keep then) a press
   * is pending, and a render asked for
   * outside a user input event is held. When the press ends the held render runs once, on the next task, unless a render ran
   * since (the click's own handler drew the current state). Renders inside user input events (typing, the field editor's
   * dragging, the signature pad, every data-action handler) run at once, as before. Only trusted events count: a click made
   * by code is not a person's press. */
  const PRESS_MAX = 1000;
  const POINTER_UP_WAIT = 500;
  const TAP_SLOP = 10;
  const USER_INPUT = /^(pointer|mouse|touch|click|dblclick|auxclick|contextmenu|key|input|beforeinput|change|submit|focus|blur)/;
  const press = { pending: false, held: false, heldAt: 0, renders: 0, timer: 0, upTimer: 0, afterHeld: null, x: 0, y: 0, target: null };
  const inUserInput = () => {
    const e = window.event;
    return !!e && USER_INPUT.test(e.type);
  };
  function pressEnd() {
    clearTimeout(press.timer);
    clearTimeout(press.upTimer);
    if (!press.pending) return;
    press.pending = false;
    if (!press.held) return;
    press.held = false;
    const at = press.heldAt;
    // After the click's own handlers (they run in this same dispatch, after these capture listeners).
    setTimeout(() => {
      const after = press.afterHeld;
      press.afterHeld = null;
      if (press.renders === at) {
        if (render() === false) {
          press.afterHeld = after;
          return;
        }
      }
      if (after && press.renders !== at + 1) return; // another navigation drew and placed its own page since
      if (after) after();
    }, 0);
  }
  function pressWatch() {
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!e.isTrusted || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        clearTimeout(press.timer);
        clearTimeout(press.upTimer);
        press.pending = true;
        Object.assign(press, { x: e.clientX, y: e.clientY, target: e.target });
        press.timer = setTimeout(pressEnd, PRESS_MAX);
      },
      true
    );
    document.addEventListener(
      'pointerup',
      (e) => {
        if (!e.isTrusted || !e.isPrimary || !press.pending) return;
        clearTimeout(press.upTimer);
        const dragged = Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP || !(press.target && press.target.isConnected);
        press.target = null;
        if (dragged) return pressEnd();
        press.upTimer = setTimeout(pressEnd, POINTER_UP_WAIT);
      },
      true
    );
    document.addEventListener('pointercancel', (e) => e.isTrusted && e.isPrimary && pressEnd(), true);
    document.addEventListener('click', (e) => e.isTrusted && pressEnd(), true);
  }

  /* ---------- Render ---------- */
  /** Draws the page; false when the drawing is held under a pending press (it runs when the press ends). */
  function render() {
    if (press.pending && !inUserInput()) {
      if (!press.held) {
        press.held = true;
        press.heldAt = press.renders;
      }
      return false;
    }
    press.renders++;
    const w = ws();
    const key = state.route;
    const standalone = NS.views[key] && NS.views[key].standalone;
    if (!w && !standalone) {
      // An investor using an invitation from the integration server goes back to it (never the sign-up page).
      if (state.remote) go('invite-' + (NS.store.get('invite-last', '') || ''));
      else if (E.diy) go('diy-start');
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
    document.body.classList.toggle('has-demo', !!config.demo && !!w && !state.remote);
    document.body.classList.toggle('mode-console', mode === 'console');
    document.body.classList.toggle('mode-portal', mode === 'portal');
    document.body.classList.toggle('mode-standalone', mode === 'standalone');
    document.title = standalone ? view.title || (w ? w.tenant.portalName : 'Investor Portal') : mode === 'console' ? `${w.tenant.shortName} · ${E.diy ? 'Console' : 'Sponsor Console'}` : `${w.tenant.portalName} · ${w.tenant.shortName}`;
    // Carrow & Vale staff get the operator bar; a sponsor's own people get a plain preview bar in the investor view.
    document.getElementById('opbar').innerHTML = !w || standalone ? '' : E.managed && state.role === 'staff' ? opbarHTML() : state.role !== 'investor' && mode === 'portal' ? previewBarHTML() : '';
    document.getElementById('demo').innerHTML = state.remote ? '' : demoHTML(standalone);
    storageNote();
    const el = document.getElementById('view');
    drawKeeping(el, view.render(state.param));
    if (view.after) view.after(state.param);
  }
  /**
   * Walkthrough 3 failure 7 (N4 again): a redraw that comes just before a press (the W-8BEN's page drawn as its Finish
   * appears) replaced the control a finger, or a test, had already found. A control marked data-keep="<key>" (unique on the
   * page) keeps its node through a redraw that draws it again under the same key and tag: the node takes the new drawing's
   * attributes and content, and keeps focus if it had it. Handlers are delegated (data-action), so nothing else changes.
   */
  function drawKeeping(el, html) {
    const kept = {};
    el.querySelectorAll('[data-keep]').forEach((n) => (kept[n.getAttribute('data-keep')] = n));
    const had = document.activeElement;
    el.innerHTML = html;
    if (!Object.keys(kept).length) return;
    el.querySelectorAll('[data-keep]').forEach((n) => {
      const key = n.getAttribute('data-keep');
      const old = kept[key];
      delete kept[key]; // one node for one key, even if a drawing repeated it
      if (!old || old.tagName !== n.tagName) return;
      Array.from(old.attributes).forEach((a) => !n.hasAttribute(a.name) && old.removeAttribute(a.name));
      Array.from(n.attributes).forEach((a) => old.getAttribute(a.name) !== a.value && old.setAttribute(a.name, a.value));
      if (old.innerHTML !== n.innerHTML) old.innerHTML = n.innerHTML;
      n.replaceWith(old);
      if (old === had) old.focus({ preventScroll: true });
    });
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
    pressWatch();
    app.innerHTML = `<div id="notes"></div><div id="opbar"></div><div id="view"></div><dialog id="dlg" class="dlg"></dialog><div id="toasts" class="toasts" role="status" aria-live="polite"></div><div id="demo"></div>`;
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
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', () => (lastState = histState()));

    const r = parseHash();
    state.route = r.key;
    state.param = r.param;
    const remote = inviteServer();
    if (remote) {
      // The invitation page loads the firm's brand, the offering and the investor from the server (onboarding.js).
      // A server this portal is not set up to use is never contacted: the page says the link does not work here.
      state.remote = remote.trusted ? { server: remote.url } : { server: '', refused: true };
      state.role = 'investor';
      B.apply(NS.TENANT_TEMPLATE);
      applyAppearance();
      render();
      return;
    }
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
    setClient(el.value, modeOf(state.route) === 'console' ? 'console' : 'overview');
  };
  NS.changes['demo-sponsor'] = (el) => {
    if (!el.value) return;
    state.role = E.owner;
    NS.store.set('role', state.role);
    setClient(el.value, 'console');
  };
  NS.changes['demo-role'] = (el) => {
    state.co = el.value === 'co-investor';
    state.role = state.co ? 'investor' : el.value;
    NS.store.set('role', state.role);
    const inv = ws().investors.find((x) => x.id === state.viewer);
    if (state.co) {
      // The co-investor goes straight to what waits for their signature; with nothing waiting, to the account's documents.
      const due = NS.esign ? NS.esign.pendingFor(ws(), inv.id) : [];
      go(due.length ? 'sign-' + due[0].id : 'documents');
      return NS.ui.toast(`Signed in as ${inv.coInvestor.name}`);
    }
    if (state.role === 'investor' && inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else go(homeFor(state.role));
    NS.ui.toast(state.role === 'investor' ? `Signed in as ${inv ? inv.title : 'an investor'}` : state.role === 'staff' ? 'Signed in as Carrow & Vale staff' : `Signed in as ${E.roleLabel[state.role].toLowerCase()} of ${ws().tenant.shortName}`);
  };
  NS.changes.viewer = (el) => {
    state.co = false;
    state.viewer = el.value;
    const inv = ws().investors.find((x) => x.id === el.value);
    if (inv && inv.onboarding.status !== 'complete') NS.startOnboarding(inv.id);
    else go('overview');
  };

  /** The signed-in person as the change log names them. */
  function actor() {
    const w = ws();
    const firm = w ? w.tenant.shortName : '';
    if (state.role === 'investor') {
      const inv = w && w.investors.find((i) => i.id === state.viewer);
      if (inv && state.co && inv.coInvestor) return `${inv.coInvestor.name} (co-investor)`;
      return inv ? `${inv.title} (investor)` : 'Investor';
    }
    if (E.managed) return state.role === 'staff' ? 'Carrow & Vale staff' : `${firm || 'Sponsor'} staff`;
    // The person signed in with this role (in the demo, switching to "team" acts as a team member, not the admin flagged current).
    const team = (w && w.team) || [];
    const me = team.find((m) => m.current && m.role === state.role) || team.find((m) => m.role === state.role && m.status !== 'invited') || null;
    const what = state.role === 'admin' ? 'admin' : 'team';
    return me ? `${me.name} (${firm} ${what})` : `${firm} ${what}`;
  }

  NS.actions['diy-start-over'] = () => {
    NS.store.del('active');
    state.role = E.owner;
    NS.store.set('role', state.role);
    setClient(null, 'diy-start');
  };

  NS.app = { state, config, allowed, can, actor, render, go, setClient, useWorkspace, publishedServer, save, applyTenant, applyAppearance, setAppearance, setPath, getPath, ws, modeOf, storageNote };

  // Views register after this file loads, so boot once every script has run.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
