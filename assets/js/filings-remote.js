/*
 * The Filings tab's link to the filing server (self-serve edition): an admin sends a recorded order to the server the
 * portal is connected to (Integrations), and what staff record there comes back to the order: received, the test filing,
 * the notice filed with its accession number.
 *
 * Nothing is sent on its own: Send is one control on a recorded order, for an admin, and for a Form D order only once its
 * notice is signed off. Orders already sent are checked when the tab opens and with Check now. Every call goes to
 * NS.integrations.serverUrl(ws) with the server's own token, only when a server address is set; every failure is caught
 * and said in one plain line under the order, and the order stays recorded. The order's key (32 random bytes from the
 * browser's crypto) is the only credential kept here, on the order, and it is sent only in request bodies. Nothing the
 * server answers is trusted as it comes: only known statuses are applied, and an answer that is not understood changes
 * nothing.
 *   NS.filingsUI.link = { connected(ws), orderLine(ws, order), send(order), check(order) }
 *   order.remote = { id, key, sentAt, status, checkedAt, messages, filing, accession, filedOn, noticeId }
 * The managed edition never loads this file.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.filingsUI || !NS.filings || !NS.integrations) return;
  const U = NS.ui;
  const { h, date } = U;
  const FL = NS.filings;
  const W = () => NS.state.ws;
  const today = () => NS.dates.today();
  const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const FORMD = ['formd', 'formd-amendment'];
  const STATES = ['bluesky', 'bluesky-renewal'];
  const ORDER_STATUS = ['received', 'done', 'cancelled'];
  const FILING = ['in_review', 'test_passed', 'suspended', 'submitted', 'accepted'];
  const WAIT_MS = 30000;

  /* ---------- What is known about the server, for this visit only (never stored) ---------- */
  /** Per server address: 'asking' | 'on' | 'off' | 'failed'. */
  const probes = {};
  /** Per order id: a call is out. */
  const busy = {};
  /** Per order id: the plain line of the last failure. */
  const said = {};
  /** Orders checked on this visit already (the check made when the tab opens). */
  const checked = {};
  const urlOf = (ws) => NS.integrations.serverUrl(ws);
  const tokenOf = (ws) => String(NS.integrations.ensure(ws).server.token || '');
  const refresh = () => NS.filingsUI.refresh();

  class Refused extends Error {
    constructor(status, body) {
      super(`answered ${status}`);
      this.status = status;
      this.body = body;
    }
  }
  /** One call to the server → its JSON answer; a refusal throws Refused, a failed connection throws its own error. */
  async function call(ws, method, path, body) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    const token = tokenOf(ws);
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), WAIT_MS) : null;
    try {
      const res = await fetch(urlOf(ws) + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined, cache: 'no-store' });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      if (!res.ok) throw new Refused(res.status, data);
      return data && typeof data === 'object' ? data : {};
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Whether the connected server takes filing orders: asked once per address on each visit. */
  function probe(ws) {
    const base = urlOf(ws);
    if (!base || own(probes, base)) return;
    probes[base] = 'asking';
    call(ws, 'GET', '/v1/filings')
      .then(
        (a) => (probes[base] = a.on === true ? 'on' : 'off'),
        (e) => (probes[base] = e instanceof Refused && e.status === 404 ? 'off' : 'failed')
      )
      .then(() => {
        if (probes[base] === 'on') checkOpen(W());
        refresh();
      });
  }
  /**
   * Connected: a server address is set and its filings call has not answered that it takes no filing orders. While the
   * call is out, or when it could not be made, Send stays on offer and its own failure is said under the order.
   */
  function connected(ws) {
    const base = urlOf(ws);
    if (!base) return false;
    probe(ws);
    return probes[base] !== 'off';
  }

  /* ---------- The order's notice ---------- */
  const isFormD = (order) => FORMD.indexOf(order.kind) >= 0;
  const isStates = (order) => STATES.indexOf(order.kind) >= 0;
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o && o.id === id) || null;
  /** The signed-off notice an order files: the latest entry signed off under it (a corrected copy keeps the order). */
  function noticeOf(ws, order) {
    const r = ws.filings && ws.filings.offerings && own(ws.filings.offerings, order.offeringId) ? ws.filings.offerings[order.offeringId] : null;
    const list = (r && Array.isArray(r.formD) ? r.formD : []).filter((n) => n && n.orderId === order.id && n.signoff && n.draft && (n.status === 'ordered' || n.status === 'accepted'));
    return list.length ? list[list.length - 1] : null;
  }
  /** What can be sent: an admin, a connected server, a recorded order with what it files (a signed-off notice, or a package). */
  function sendable(ws, order) {
    if (!NS.app.can('configure') || !connected(ws)) return false;
    if (isFormD(order)) {
      const n = noticeOf(ws, order);
      if (!n || n.status !== 'ordered') return false;
      if (order.status === 'recorded') return true;
      // A corrected notice, signed off after a suspended test, goes under the same order.
      return order.status === 'received' && !!order.remote && order.remote.filing === 'suspended' && n.id !== order.remote.noticeId;
    }
    return isStates(order) && order.status === 'recorded' && !!order.package;
  }

  /** 32 random bytes from the browser's crypto, as base64url. */
  function newKey() {
    const b = new Uint8Array(32);
    window.crypto.getRandomValues(b);
    let s = '';
    b.forEach((x) => (s += String.fromCharCode(x)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* ---------- Failures, in one plain line ---------- */
  function lineFor(e, what) {
    if (!(e instanceof Refused)) return 'The server could not be reached. The order is kept here.';
    return `The server could not ${what} (it answered ${e.status}).`;
  }

  /* ---------- Sending ---------- */
  async function send(order) {
    const ws = W();
    if (!order || busy[order.id] || !sendable(ws, order)) return false;
    const o = offeringOf(ws, order.offeringId);
    if (!o) return false;
    const notice = isFormD(order) ? noticeOf(ws, order) : null;
    // The key is kept before anything is sent: an answer lost on the way is the same order when sent again.
    if (!order.remote || !order.remote.key) order.remote = { id: '', key: newKey(), sentAt: '', status: '', checkedAt: '', messages: [], filing: '', accession: '', filedOn: '', noticeId: '' };
    NS.app.save(true);
    const body = Object.assign(
      { workspace: ws.tenant.id, clientId: order.id, key: order.remote.key, firm: { name: ws.tenant.name || ws.tenant.shortName || '' }, kind: order.kind, offering: { id: o.id, name: o.name }, by: NS.app.actor(), at: order.at },
      notice ? { draft: notice.draft, signoff: notice.signoff } : { package: order.package }
    );
    busy[order.id] = true;
    said[order.id] = '';
    refresh();
    try {
      const a = await call(ws, 'POST', '/v1/filings/orders', body);
      if (typeof a.id !== 'string' || !/^fil_[\w-]{1,40}$/.test(a.id)) throw new Refused(0, null);
      probes[urlOf(ws)] = 'on';
      const r = order.remote;
      r.id = a.id;
      r.sentAt = stamp();
      r.status = 'received';
      if (notice) {
        r.noticeId = notice.id;
        r.filing = 'in_review';
        r.messages = [];
      }
      order.status = 'received';
      copyAmounts(order, a);
      NS.consoleKit.audit('Filing order sent', `${o.name}: sent to be filed`, o.id);
      NS.app.save(true);
      return true;
    } catch (e) {
      said[order.id] = lineFor(e, 'take the order');
      return false;
    } finally {
      busy[order.id] = false;
      refresh();
    }
  }

  /* ---------- What comes back ---------- */
  const isCents = (v) => Number.isInteger(v) && v >= 0;
  /** The server's lines and amounts, when they read as lines; a state line keeps the name the portal gave it. */
  function copyAmounts(order, a) {
    const lines = Array.isArray(a.lines) && a.lines.length <= 200 ? a.lines : null;
    if (!lines || !lines.every((l) => l && typeof l.label === 'string' && (l.cents === null || isCents(l.cents))) || !isCents(a.dueCents) || typeof a.openFees !== 'boolean') return;
    const was = order.lines || [];
    order.lines = lines.map((l) => {
      const mine = l.state ? was.find((x) => x.state === l.state) : was.find((x) => !x.state && !!x.passThrough === !!l.passThrough);
      return Object.assign({ label: String((mine && mine.label) || l.label).slice(0, 200), cents: l.cents, passThrough: !!l.passThrough }, l.state ? { state: String(l.state).slice(0, 2) } : {});
    });
    order.dueCents = a.dueCents;
    order.openFees = a.openFees;
  }
  function apply(ws, order, a) {
    if (!a || a.id !== order.remote.id || ORDER_STATUS.indexOf(a.status) < 0) throw new Refused(0, null);
    const r = order.remote;
    r.status = a.status;
    r.checkedAt = stamp();
    order.status = a.status;
    copyAmounts(order, a);
    const f = a.formD;
    if (isFormD(order) && f && typeof f === 'object' && FILING.indexOf(f.status) >= 0) r.filing = f.status;
  }

  async function check(order) {
    const ws = W();
    if (!order || busy[order.id] || !order.remote || !order.remote.id || !urlOf(ws)) return false;
    busy[order.id] = true;
    said[order.id] = '';
    refresh();
    try {
      const a = await call(ws, 'POST', `/v1/filings/orders/${encodeURIComponent(order.remote.id)}/status`, { key: order.remote.key });
      apply(ws, order, a);
      NS.app.save(true);
      return true;
    } catch (e) {
      said[order.id] = lineFor(e, 'say where the order stands');
      return false;
    } finally {
      busy[order.id] = false;
      refresh();
    }
  }
  /** When the tab opens with the server on: each order sent and still open is checked once. */
  function checkOpen(ws) {
    ((ws.filings && ws.filings.orders) || []).forEach((order) => {
      if (!order || !order.remote || !order.remote.id || checked[order.id] || order.status === 'done' || order.status === 'cancelled') return;
      checked[order.id] = true;
      check(order);
    });
  }

  /* ---------- The line under an order ---------- */
  const btn = (action, label, id, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}" data-id="${h(id)}">${label}</button>`;
  function stateLine(ws, order) {
    const r = order.remote || {};
    if (busy[order.id]) return r.id ? 'Checking…' : 'Sending…';
    if (!r.id) return '';
    if (order.status === 'cancelled') return 'Cancelled by the filing team.';
    if (isFormD(order)) {
      if (r.filing === 'test_passed') return 'Test filing passed.';
      if (r.filing === 'submitted') return 'With EDGAR, waiting for acceptance.';
      return 'Received by the filing team.';
    }
    return order.status === 'done' ? 'Filed.' : 'Received by the filing team.';
  }
  function orderLine(ws, order) {
    if (!order || !connected(ws)) return '';
    const r = order.remote || {};
    const line = stateLine(ws, order);
    const acts = [];
    if (!busy[order.id] && sendable(ws, order)) acts.push(btn('flr-send', 'Send to be filed', order.id, 'cs-btn-primary'));
    if (!busy[order.id] && r.id && order.status !== 'done' && order.status !== 'cancelled') acts.push(btn('flr-check', 'Check now', order.id));
    const fail = said[order.id] || '';
    if (!line && !acts.length && !fail) return '';
    return `<div class="fl-remote" data-remote="${h(order.id)}">
      ${line ? `<p class="fl-note" role="status">${h(line)}</p>` : ''}
      ${acts.length ? `<div class="fl-acts">${acts.join('')}</div>` : ''}
      ${fail ? `<p class="field-error" role="alert">${h(fail)}</p>` : ''}
    </div>`;
  }

  const orderById = (id) => ((W().filings && W().filings.orders) || []).find((x) => x && x.id === id) || null;
  NS.actions['flr-send'] = (el) => {
    if (!NS.app.can('configure')) return;
    send(orderById(el.getAttribute('data-id')));
  };
  NS.actions['flr-check'] = (el) => {
    const ws = W();
    // Check now also asks the server again whether it takes filing orders.
    delete probes[urlOf(ws)];
    probe(ws);
    check(orderById(el.getAttribute('data-id')));
  };

  NS.filingsUI.link = { connected, orderLine, send, check };
  NS.filingsUI.refresh();
})(window.CVPortal);
