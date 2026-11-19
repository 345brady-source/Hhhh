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

  /* The server's last answer, kept in memory only (never saved with the workspace). */
  let mem = { key: '', status: 'idle', data: null, error: '', code: '', at: 0, promise: null };

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
    if (mem.key === key && mem.promise) return mem.promise;
    if (mem.key === key && !force && mem.status !== 'idle' && Date.now() - mem.at < FRESH_MS) return Promise.resolve(info(ws));
    // Asked again of the same server: the last answer stands until the new one arrives (a box in use does not come and go).
    if (mem.key !== key) mem = { key, status: 'loading', data: null, error: '', code: '', at: 0, promise: null };
    const mine = mem;
    const done = (status, data, error, code) => {
      if (mem === mine) Object.assign(mem, { status, data, error, code: code || '', at: Date.now(), promise: null });
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
    return `$${n % 100 ? (n / 100).toFixed(2) : n / 100}`;
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
    if (i.status !== 'ok') return off;
    const d = i.data;
    const t = TIERS.indexOf(tier) >= 0 ? tier : tierFor(ws, offeringId, inv);
    const price = priceLabel((d.prices || {})[t]);
    if (!(d.available && d.available[t] === true) || !price) return off;
    const label = `${LABEL} (${price})`;
    // A balance that covers the price pays for it; otherwise a card must be on file.
    if (!d.card && !(Number(d.creditCents) >= Number(d.prices[t]))) return Object.assign(off, { show: true, label, line: 'Add a card on the Integrations page to use it.', href: '#console-integrations' });
    return { show: true, enabled: true, label, line: '', href: '' };
  }

  NS.pkg = { load, info, tierFor, priceLabel, box };
})(window.CVPortal);
