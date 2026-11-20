/*
 * The verification package (self-serve edition only): what the sponsor's integration server offers and the state of the
 * one tick box on the invite form.
 *
 * The browser decides nothing here. Whether the package is offered, its price and whether a card is on file all come
 * from the integration server (GET /v1/billing, the sponsor's token); the invitation carries only the sponsor's choice
 * and the server works out what is charged. With no server connected no request is made at all.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const INV = () => NS.invitations;
  const IV = () => NS.integrations;
  const FRESH_MS = 60 * 1000;
  const TIERS = ['identity', 'full', 'reverify'];
  const UNREACHABLE = 'The integration server could not be reached.';
  const NOT_OFFERED = 'The verification package is not offered on this integration server.';
  // The integration server's credit_owed sentence (lib/billing.mjs), word for word: no new package while an amount is owed.
  const CREDIT_OWED = 'A refunded payment left an amount owed. Settle it before adding packages.';

  /* The server's last answer, kept in memory only (never saved with the workspace). */
  let mem = { key: '', status: 'idle', data: null, error: '', code: '', at: 0, promise: null };
  /* While a list is being paid for and sent, the answer is held still: the rows paid for are the rows created with the package. */
  let held = false;

  const on = (ws) => !!(E.diy && ws && INV() && INV().serverOn(ws));
  const keyOf = (ws) => {
    const s = IV().ensure(ws).server;
    return `${IV().serverUrl(ws)}|${s.token}`;
  };

  /**
   * One read of what the server offers. Resolves to info(ws) and never rejects: a failure is kept as a plain sentence.
   * The answer is reused for a minute; force asks again (after the card changed).
   */
  function load(ws, force) {
    if (!on(ws)) return Promise.resolve(null);
    const key = keyOf(ws);
    if (held && mem.key === key) return Promise.resolve(info(ws));
    if (mem.key === key && mem.promise) return mem.promise;
    if (mem.key === key && !force && mem.status !== 'idle' && Date.now() - mem.at < FRESH_MS) return Promise.resolve(info(ws));
    // Asked again of the same server: the last answer stands until the new one arrives (a box in use does not come and go).
    if (mem.key !== key) mem = { key, status: 'loading', data: null, error: '', code: '', at: 0, promise: null };
    const mine = mem;
    const done = (status, data, error, code) => {
      if (mem === mine && held) mem.promise = null;
      else if (mem === mine) Object.assign(mem, { status, data, error, code: code || '', at: Date.now(), promise: null });
      return info(ws);
    };
    // The server's own sentence and code when it refuses (403 account_required: this token is not a sponsor account's).
    const refused = (data) => done('none', null, data && typeof data.error === 'string' && data.error ? data.error : NOT_OFFERED, data && typeof data.code === 'string' ? data.code : '');
    const s = IV().ensure(ws).server;
    mine.promise = fetch(`${IV().serverUrl(ws)}/v1/billing`, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${s.token}` } }).then(
      (res) =>
        res.json().then(
          (data) => (res.ok && data && typeof data === 'object' ? done('ok', data, '') : refused(data)),
          () => refused(null)
        ),
      () => done('unreachable', null, UNREACHABLE)
    );
    return mine.promise;
  }

  /**
   * What is known now, or null with no server: { status, data, error, code }. status: 'idle' (not asked yet), 'loading',
   * 'ok' (data is the server's answer), 'none' (the server does not offer it: error is its sentence, code its code) or
   * 'unreachable'.
   */
  function info(ws) {
    if (!on(ws)) return null;
    if (mem.key !== keyOf(ws)) return { status: 'idle', data: null, error: '', code: '' };
    return { status: mem.status, data: mem.data, error: mem.error, code: mem.code };
  }

  /** The package an invitation to this offering would hold: full when it needs verified accreditation, otherwise identity. */
  function tierFor(ws, offeringId, inv) {
    const off = offeringId ? (ws.offerings || []).find((o) => o.id === offeringId) || null : null;
    return INV() && INV().accreditationRequired(ws, inv || null, off) ? 'full' : 'identity';
  }

  /** Cents as the label shows them: whole dollars, with the cents only when the price has any. '' when it is not a price. */
  function priceLabel(cents) {
    const n = Number(cents);
    if (!isFinite(n) || n <= 0 || Math.round(n) !== n) return '';
    return `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: n % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  }

  const LABEL = 'Add verification package';
  /**
   * The tick box: { show, enabled, label, line, href }. tier: tierFor's answer unless the caller passes one; inv: the
   * investor the invitation is for, when already on file. line is one plain sentence (or ''); href, when set, is where
   * the line leads.
   */
  function box(ws, offeringId, tier, inv) {
    const off = { show: false, enabled: false, label: LABEL, line: '', href: '' };
    if (!E.diy || !ws) return off;
    if (!on(ws)) return Object.assign(off, { show: true, line: 'Checks run once your portal is connected to its server.' });
    const i = info(ws);
    if (i.status === 'unreachable') return Object.assign(off, { show: true, line: UNREACHABLE });
    // The token is not a sponsor account's (the shared token, the operator's own): switched off, with the server's sentence.
    if (i.status === 'none' && i.code === 'account_required') return Object.assign(off, { show: true, line: i.error });
    if (i.status !== 'ok') return off;
    const d = i.data;
    const t = TIERS.indexOf(tier) >= 0 ? tier : tierFor(ws, offeringId, inv);
    const price = priceLabel((d.prices || {})[t]);
    if (!(d.available && d.available[t] === true) || !price) return off;
    const label = `${LABEL} (${price})`;
    // 08-16 (R9): while the account owes an amount (owedCents) the server refuses every new package; switched off, its sentence.
    if (Number(d.owedCents) > 0) return Object.assign(off, { show: true, label, line: CREDIT_OWED });
    // A balance that covers the price pays for it; otherwise a card must be on file.
    if (!d.card && !(Number(d.creditCents) >= Number(d.prices[t]))) return Object.assign(off, { show: true, label, line: 'Add a card on the Integrations page to use it.', href: '#console-integrations' });
    // tier and cents: the package this invitation would be paid for (plan 08-13: a list pays for exactly these).
    return { show: true, enabled: true, label, line: '', href: '', tier: t, cents: Number(d.prices[t]) };
  }


  /* ---------- The panel on the Integrations page (plan 08-13, D-01) ---------- */
  const U = () => NS.ui;
  const TITLE = 'Verification package';
  const NO_SERVER = 'Checks run once your portal is connected to its server.';
  const ACCOUNT_REQUIRED = 'account_required';
  const KINDS = [
    ['identity', 'Identity check and screening'],
    ['full', 'Identity check, screening and accreditation']
  ];
  const BRANDS = { amex: 'American Express', diners: 'Diners Club', discover: 'Discover', jcb: 'JCB', mastercard: 'Mastercard', unionpay: 'UnionPay', visa: 'Visa' };
  const brandOf = (b) => BRANDS[String(b || '').toLowerCase()] || (b ? String(b).charAt(0).toUpperCase() + String(b).slice(1) : 'Card');
  const CHARGE = { card: 'Package', credit: 'Package, paid from credit' };
  const chargeWord = (c) => (c.type === 'package' ? CHARGE[c.by] || CHARGE.card : c.type === 'credit' ? 'Returned as credit' : c.type === 'refund' ? 'Refund' : c.type === 'dispute' ? 'Disputed' : '');
  /** The investor's account name for a charge's invitation (the server's id or the console's own), from the console's records. */
  function accountOf(ws, invitationId) {
    if (!invitationId) return '';
    const it = (ws.invitations || []).find((x) => x.serverId === invitationId || x.id === invitationId);
    const inv = it && (ws.investors || []).find((i) => i.id === it.investorId);
    return inv ? inv.title || inv.contact || '' : '';
  }
  /** A payment the server is still confirming (08-16's unresolved list): one line, or '' when there is none. */
  function unresolvedLine(list) {
    const xs = Array.isArray(list) ? list.filter((x) => x && Number(x.cents) > 0) : [];
    if (!xs.length) return '';
    if (xs.length === 1) return `A payment of ${priceLabel(xs[0].cents)} on ${U().date(String(xs[0].at || '').slice(0, 10))} is being confirmed.`;
    return `${xs.length} payments of ${priceLabel(xs.reduce((n, x) => n + Number(x.cents), 0))} in all are being confirmed.`;
  }

  /** The panel's last action: busy while the server is asked, error one plain sentence. Memory only. */
  let act = { busy: false, error: '' };

  /** The panel's inside, from what is known now (no request made here). '' when it is not shown. */
  function panelBody(ws) {
    const h = U().h;
    const K = NS.consoleKit;
    const line = (t, cls) => K.panel(TITLE, `<p class="${cls || 'cs-hint'}" id="pkg-line">${h(t)}</p>`);
    if (!on(ws)) return line(NO_SERVER);
    const i = info(ws);
    if (i.status === 'unreachable') return line(UNREACHABLE, 'cs-error');
    if (i.status === 'none' && i.code === ACCOUNT_REQUIRED) return line(i.error);
    if (i.status !== 'ok' || !i.data || i.data.ready !== true) return '';
    const d = i.data;
    const prices = KINDS.filter(([t]) => d.available && d.available[t] === true && priceLabel((d.prices || {})[t])).map(([t, name]) => `<div><dt>${h(name)}</dt><dd>${h(priceLabel(d.prices[t]))}</dd></div>`);
    const c = d.card;
    const card = c
      ? `<p id="pkg-card">${h(brandOf(c.brand))} ending ${h(String(c.last4 || ''))} · expires ${h(String(c.expMonth || '').padStart(2, '0'))}/${h(String(c.expYear || ''))}</p>`
      : '';
    const credit = Number(d.creditCents) > 0 ? `<p id="pkg-credit">Credit ${h(priceLabel(d.creditCents))}</p>` : '';
    const waiting = unresolvedLine(d.unresolved);
    const charges = (Array.isArray(d.charges) ? d.charges : []).filter((x) => x && Number(x.cents) > 0);
    const table = charges.length
      ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact" id="pkg-charges"><thead><tr><th scope="col">Date</th><th scope="col">Investor</th><th scope="col">Charge</th><th scope="col" class="num">Amount</th></tr></thead><tbody>${charges
          .map((x) => `<tr><td data-label="Date">${h(U().date(String(x.at || '').slice(0, 10)))}</td><td data-label="Investor">${h(accountOf(ws, x.invitationId))}</td><td data-label="Charge">${h(chargeWord(x))}</td><td class="num" data-label="Amount">${h(priceLabel(x.cents))}</td></tr>`)
          .join('')}</tbody></table></div>`
      : '';
    const buttons = `<div class="cs-row" id="pkg-actions"><button class="cs-btn" type="button" data-action="pkg-card"${act.busy ? ' disabled aria-busy="true"' : ''}>${c ? 'Replace card' : 'Add card'}</button>${c ? ` <button class="cs-btn" type="button" data-action="pkg-card-remove"${act.busy ? ' disabled' : ''}>Remove</button>` : ''}</div>`;
    return K.panel(
      TITLE,
      `${prices.length ? `<dl class="iv-summary" id="pkg-prices">${prices.join('')}</dl>` : ''}${card}${buttons}${act.error ? `<p class="cs-error" id="pkg-error" role="alert">${h(act.error)}</p>` : ''}${credit}${Number(d.owedCents) > 0 ? `<p class="cs-error" id="pkg-owed">Amount owed ${h(priceLabel(d.owedCents))}</p>` : ''}${waiting ? `<p class="cs-hint" id="pkg-unresolved">${h(waiting)}</p>` : ''}${table}`
    );
  }
  /** The panel drawn again in place (no page render: a field on the page may be in use). */
  function redraw(ws) {
    const el = document.getElementById('pkg-panel');
    if (el && NS.state && NS.state.ws === ws) el.innerHTML = panelBody(ws);
  }
  /**
   * The "Verification package" panel for the Integrations page (self-serve edition only). With a server it is drawn from
   * GET /v1/billing, asked once and drawn again when the answer arrives; with none it is one line and nothing is asked.
   */
  function panel(ws) {
    if (!E.diy || !ws) return '';
    if (on(ws)) {
      const i = info(ws);
      if (i.status === 'idle' || i.status === 'loading' || (!held && Date.now() - mem.at >= FRESH_MS)) load(ws).then(() => redraw(ws));
    }
    return `<div id="pkg-panel">${panelBody(ws)}</div>`;
  }

  /* ---------- The card: entered on the integration server's own page, inside the console's dialog ---------- */
  const TOKEN = 'The integration server did not accept the access token.';
  const NO_PAGE = 'The card page could not be opened. Try again.';
  const FAILED = 'The integration server could not do this. Try again.';
  const originOf = (u) => {
    try {
      const x = new URL(String(u));
      return /^https?:$/.test(x.protocol) ? x.origin : '';
    } catch (e) {
      return '';
    }
  };
  /** One call to the server's billing routes with the sponsor's token; a refusal is thrown as one plain sentence. */
  async function call(ws, method, path) {
    const s = IV().ensure(ws).server;
    let res;
    try {
      res = await fetch(`${IV().serverUrl(ws)}${path}`, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${s.token}` } });
    } catch (e) {
      throw new Error(UNREACHABLE);
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (res.status === 401) throw new Error(TOKEN);
    if (!res.ok) throw new Error(data && typeof data.error === 'string' && data.error ? data.error : FAILED);
    return data && typeof data === 'object' ? data : {};
  }
  /** The server is asked again and the panel drawn from its answer (after the card dialog closes, by any way). */
  function refresh(ws) {
    return load(ws, true).then(() => redraw(ws));
  }

  /* The card dialog while it is open: the server's origin it was opened for (only a message from there is believed). */
  let cardDlg = null;
  window.addEventListener('message', (e) => {
    if (!cardDlg || !e.origin || e.origin !== cardDlg.origin) return;
    const fr = document.getElementById('pkg-card-frame');
    if (!fr || e.source !== fr.contentWindow || !e.data || e.data.type !== 'cv-card-saved') return;
    U().closeDialog();
  });
  document.addEventListener(
    'close',
    (e) => {
      const d = e.target;
      if (!d || d.id !== 'dlg' || d.open || !cardDlg) return;
      const ws = cardDlg.ws;
      cardDlg = null;
      refresh(ws);
    },
    true
  );
  NS.actions['pkg-card'] = async () => {
    const ws = NS.state.ws;
    if (!on(ws) || act.busy) return;
    act = { busy: true, error: '' };
    redraw(ws);
    try {
      const r = await call(ws, 'POST', '/v1/billing/card/setup');
      const origin = originOf(IV().serverUrl(ws));
      // Only a card page on the connected server's own origin is opened.
      if (!origin || !r || typeof r.url !== 'string' || originOf(r.url) !== origin) throw new Error(NO_PAGE);
      act = { busy: false, error: '' };
      redraw(ws);
      const h = U().h;
      const had = !!((info(ws) || {}).data || {}).card;
      U().dialog(
        `<div class="dlg-head"><div><h2>${had ? 'Replace card' : 'Add card'}</h2></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${U().icon('close')}</button></div></div>
        <div class="dlg-body"><iframe id="pkg-card-frame" title="Card" src="${h(r.url)}" referrerpolicy="no-referrer" style="display:block;width:100%;height:340px;border:0"></iframe></div>`,
        'dlg-iv dlg-pkg'
      );
      cardDlg = { ws, origin };
    } catch (e) {
      act = { busy: false, error: (e && e.message) || FAILED };
      redraw(ws);
    }
  };
  NS.actions['pkg-card-remove'] = () => {
    const ws = NS.state.ws;
    if (!on(ws) || act.busy) return;
    U().dialog(
      `<div class="dlg-head"><div><h2>Remove the card?</h2></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${U().icon('close')}</button></div></div>
      <div class="dlg-body"><div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="button" data-action="pkg-card-remove-confirm">Remove card</button></div></div>`,
      'dlg-iv'
    );
  };
  NS.actions['pkg-card-remove-confirm'] = async () => {
    const ws = NS.state.ws;
    U().closeDialog();
    if (!on(ws) || act.busy) return;
    act = { busy: true, error: '' };
    redraw(ws);
    try {
      await call(ws, 'DELETE', '/v1/billing/card');
      act = { busy: false, error: '' };
    } catch (e) {
      act = { busy: false, error: (e && e.message) || FAILED };
    }
    refresh(ws);
  };

  /** Hold the server's answer still (on) while a list is paid for and sent; released (off), it is asked again when next needed. */
  function hold(v) {
    held = !!v;
  }

  NS.pkg = { load, info, tierFor, priceLabel, box, panel, hold };
})(window.CVPortal);
