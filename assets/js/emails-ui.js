/*
 * The Emails page of the self-serve console (plan 13-09, EM-12, EM-05): every message the portal and its integration
 * server send, grouped "To investors" and "To your team", each with its subject in the firm's brand and a preview at
 * phone width, at desktop width and as plain text. A preview is emails.js's own render (NS.emails.render with
 * { preview: true }) of a sample, drawn in the page: no frame, no new window, no request. The filing agent's staff
 * emails are not listed (they go to the filing agent, not the firm).
 *
 * The sample is the message's own sample (NS.emails.KINDS[kind].sample) with the firm taken from the workspace
 * (NS.emails.firmFromTenant): the sample firm's names, portal name, team, phone and email in the sample's text become
 * the firm's, and the sample offering's name becomes the workspace's first offering's, so no other firm's name is ever
 * shown. A logo that is not a PNG, JPEG or GIF is left out, as the sent email leaves it out (the firm's name is shown).
 *
 * The page also says what the firm still needs (its postal address, before invitations to a new offering: C-06, "To be
 * confirmed with counsel") and when its logo appears as its name, and lists the latest 200 emails of the workspace
 * ("Sent", with an investor filter).
 *
 * The sent emails (EM-08): logSection(ws, inv) is the investor's list on their Account record (coinvestor.js), newest
 * first, from the workspace's log (ws.mailLog, NS.emails.log) and, with an integration server connected, the server's
 * log (GET /v1/messages/log?workspace=&investorId=, which also holds what the server sent on its own, such as the tax
 * consent notice), as it answered the last time the record was opened. One message is listed once: a workspace entry
 * the server handled (any status but simulated and manual) and a server entry of the same kind for the same investor,
 * written within ten minutes of each other, are the same message, shown with the server's status and time (each server
 * entry stands for at most one workspace entry, the nearest in time). A refused call shows one sentence (a 403: the
 * role cannot see them; anything else: they could not be loaded) and the workspace's own entries. No request is made
 * without a server; with one, only that GET. Entries are drawn as text (no message text, no link is shown).
 *
 * Loaded after console.js and coinvestor.js on the self-serve pages only (diy.html, portal.html); the managed edition
 * does not load it. Everything drawn from data is escaped (NS.ui.h); the previews are emails.js's escaped output, with
 * their links made inert.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION || {};
  if (!E.diy || !NS.emails || !NS.views) return;
  const U = NS.ui;
  const { h } = U;
  const CK = () => NS.consoleKit;
  const W = () => NS.state.ws;
  const EM = () => NS.emails;
  const ROUTE = 'console-emails';
  const MODES = [
    ['phone', 'Phone'],
    ['desktop', 'Desktop'],
    ['text', 'Text']
  ];
  // C-03: these two go once sign-in accounts are connected; until then the page says so on their rows.
  const NOT_YET = 'Sent once sign-in accounts are connected.';
  const LATER = ['password_reset', 'team_invitation'];
  const RASTER = /^data:image\/(?:png|jpeg|gif);base64,/;
  const LOGO_LINE = "Your logo appears as your firm's name in emails.";
  const POSTAL_LINE = 'Your firm’s postal address is needed before invitations to a new offering: add it under Settings, then Portal and brand. (To be confirmed with counsel)';
  const LOAD_FAILED = 'Sent emails could not be loaded from your integration server.';
  const NO_ROLE = 'Your role cannot see sent emails from your integration server.';
  /** The status of a sent email in plain words. */
  const SAYS = {
    simulated: 'Simulated in this demo',
    manual: 'Sent from your email app',
    outbox: 'Kept on your integration server',
    held: 'Waiting for your domain',
    sent: 'Sent',
    failed: 'Not sent',
    suppressed: 'Not sent',
    unsubscribed: 'Not sent: turned off by the investor',
    delivered: 'Delivered',
    bounced: 'Came back',
    complained: 'Marked as spam'
  };
  const MAX = 200;
  const SAME_MS = 10 * 60 * 1000;

  /* ---------- The sample, in the firm's brand ---------- */
  /** The firm as the sent email has it: firmFromTenant, with a logo that is not a PNG, JPEG or GIF left out. */
  function firmOf(ws) {
    const f = EM().firmFromTenant(ws.tenant);
    if (!RASTER.test(f.logo)) f.logo = '';
    return f;
  }
  const offeringOf = (ws) => (ws.offerings || []).find((o) => o.status === 'Raising') || (ws.offerings || [])[0] || null;
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** Each string of x with the swaps made (whole names only: "Fund II" is not the start of "Fund III"). */
  function swapped(x, swaps) {
    if (typeof x === 'string') return swaps.reduce((s, [re, to]) => s.replace(re, to), x);
    if (Array.isArray(x)) return x.map((v) => swapped(v, swaps));
    if (x && typeof x === 'object') {
      const out = {};
      Object.keys(x).forEach((k) => (out[k] = swapped(x[k], swaps)));
      return out;
    }
    return x;
  }
  /** The data the page renders for one message: the kind's sample, in the firm's brand. */
  function sample(kind, variant, ws) {
    const d = EM().KINDS[kind].sample(variant);
    const base = d.firm || {};
    const firm = firmOf(ws);
    const off = offeringOf(ws);
    const pairs = [
      [base.legalName, firm.legalName || firm.name],
      [base.portalName, firm.portalName || firm.name],
      [d.offering && d.offering.name, off && off.name],
      [base.name, firm.name],
      [base.shortName, firm.shortName || firm.name],
      [base.supportEmail, firm.supportEmail],
      [base.supportPhone, firm.supportPhone],
      [base.supportTeam, firm.supportTeam]
    ].filter(([from, to]) => from && to && from !== to);
    pairs.sort((a, b) => b[0].length - a[0].length);
    const swaps = pairs.map(([from, to]) => [new RegExp(`${reEsc(from)}(?![A-Za-z0-9])`, 'g'), to]);
    const out = swapped(Object.assign({}, d, { firm: null }), swaps);
    out.firm = firm;
    return out;
  }

  /* ---------- The page ---------- */
  /** The rows of the two sections: { kind, variant } in the order emails.js lists the kinds. */
  function rows() {
    const K = EM().KINDS;
    const investors = [];
    const team = [];
    Object.keys(K).forEach((kind) => {
      const k = K[kind];
      if (kind === 'password_reset') {
        if (k.variants.indexOf('investor') >= 0) investors.push({ kind, variant: 'investor' });
        if (k.variants.indexOf('team') >= 0) team.push({ kind, variant: 'team' });
      } else if (k.audience === 'investor') investors.push({ kind, variant: k.variants[0] });
      else if (k.audience === 'sponsor' || k.audience === 'team') team.push({ kind, variant: k.variants[0] });
    });
    return { investors, team };
  }
  const ui = () => {
    const s = NS.state.ui;
    if (!s.eml || typeof s.eml !== 'object') s.eml = { open: null };
    return s.eml;
  };
  const keyOf = (r) => `${r.kind}:${r.variant}`;
  const rendered = (ws, r) => EM().render(r.kind, sample(r.kind, r.variant, ws), { preview: true });

  /**
   * One preview: the message's text as written, or its HTML body drawn in a box as wide as a phone (390 px) or as a
   * desktop reading pane (680 px: the message column is its own 600 px), keeping the body's own background. Links are
   * inert: a preview never leaves the console.
   */
  function previewHTML(m, mode) {
    if (mode === 'text') return `<div class="eml-preview" data-mode="text"><pre class="eml-text" style="margin:0;padding:16px;max-width:100%;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#f7f8fa;border:1px solid #e2e5e9;border-radius:6px">${h(m.text)}</pre></div>`;
    const b = /<body style="([^"]*)">([\s\S]*)<\/body>/.exec(m.html);
    const inner = b ? b[2].replace(/(<a\b[^>]*?)\s+href="[^"]*"/g, '$1') : '';
    const width = mode === 'phone' ? 390 : 680;
    return `<div class="eml-preview" data-mode="${mode}"><div class="eml-frame" style="${b ? b[1] : ''};width:${width}px;max-width:100%;box-sizing:border-box;border:1px solid #e2e5e9;border-radius:6px;overflow-wrap:anywhere">${inner}</div></div>`;
  }
  function rowHTML(ws, r) {
    const K = EM().KINDS[r.kind];
    const m = rendered(ws, r);
    const open = ui().open;
    const mine = open && open.key === keyOf(r) ? open.mode : '';
    return `<li class="eml-row" data-kind="${h(r.kind)}" data-variant="${h(r.variant)}" style="padding:12px 0;border-top:1px solid var(--cs-line, #e2e5e9)">
      <div class="eml-what"><strong class="eml-label">${h(K.label)}</strong><br><span class="eml-subject">${h(m.subject)}</span>${LATER.indexOf(r.kind) >= 0 ? `<br><span class="cs-hint eml-later">${NOT_YET}</span>` : ''}</div>
      <div class="cs-row eml-modes" role="group" aria-label="${h(K.label)}: preview" style="flex-wrap:wrap;margin-top:8px">${MODES.map(([mode, label]) => `<button class="cs-btn cs-btn-small" type="button" data-action="eml-show" data-key="${h(keyOf(r))}" data-mode="${mode}" aria-pressed="${mine === mode}">${label}</button>`).join('')}</div>
      <div class="eml-slot" style="margin-top:12px">${mine ? previewHTML(m, mine) : ''}</div>
    </li>`;
  }
  const listHTML = (ws, list) => `<ul class="eml-list" style="list-style:none;margin:0;padding:0">${list.map((r) => rowHTML(ws, r)).join('')}</ul>`;

  /** An uploaded logo the emails cannot carry (not a PNG, JPEG or GIF, or too large): the firm's name is shown instead. */
  const logoAsName = (ws) => !!(ws.tenant.logo && ws.tenant.logo.type === 'image' && String(ws.tenant.logo.image || '')) && !firmOf(ws).logo;

  /* ---------- The sent emails ---------- */
  const serverOn = (ws) => !!(ws && NS.integrations && NS.integrations.serverUrl && NS.integrations.serverUrl(ws));
  /** GET on the firm's integration server with the console's token (NS.integrations.api when present). */
  async function call(ws, path) {
    if (NS.integrations.api) return NS.integrations.api(ws, 'GET', path);
    const s = NS.integrations.ensure(ws).server;
    const headers = { Accept: 'application/json' };
    if (s.token) headers.Authorization = `Bearer ${s.token}`;
    const res = await fetch(NS.integrations.serverUrl(ws) + path, { method: 'GET', headers });
    if (!res.ok) throw Object.assign(new Error(`The integration server answered ${res.status}.`), { status: res.status });
    return res.json();
  }
  // What the server answered, per workspace and investor ('' for the whole workspace): { entries, error, busy, at }.
  const cache = {};
  const cacheKey = (ws, investorId) => `${ws.tenant.id}|${investorId || ''}`;
  /** Ask the server for its sent log (one GET), then draw the lists that show it again. fresh: ms an answer stays good. */
  function load(ws, investorId, fresh) {
    const key = cacheKey(ws, investorId);
    const c = cache[key] || (cache[key] = { entries: null, error: '', busy: false, at: 0 });
    if (c.busy || (fresh && c.at && Date.now() - c.at < fresh)) return;
    c.busy = true;
    const path = `/v1/messages/log?workspace=${encodeURIComponent(ws.tenant.id)}${investorId ? `&investorId=${encodeURIComponent(investorId)}` : ''}&limit=${MAX}`;
    call(ws, path)
      .then(
        (r) => {
          c.entries = Array.isArray(r && r.entries) ? r.entries : [];
          c.error = '';
        },
        (e) => {
          c.entries = null;
          c.error = e && e.status === 403 ? NO_ROLE : LOAD_FAILED;
        }
      )
      .then(() => {
        c.busy = false;
        c.at = Date.now();
        document.querySelectorAll('[data-eml-log]').forEach((el) => {
          if (el.getAttribute('data-eml-log') === key) el.innerHTML = logBody(ws, investorId, el.hasAttribute('data-eml-page'));
        });
      });
  }
  const SERVER_SIDE = (s) => s !== 'simulated' && s !== 'manual';
  /** The workspace's and the server's entries, one per message (see the head of this file), newest first. */
  function merge(local, server) {
    const used = [];
    const out = server.map((e) => ({ at: String(e.at || ''), kind: String(e.kind || ''), subject: String(e.subject || ''), investorId: String(e.investorId || ''), to: String(e.to || ''), status: String(e.status || '') }));
    local.forEach((l) => {
      if (SERVER_SIDE(l.status)) {
        let best = -1;
        let gap = Infinity;
        out.forEach((s, i) => {
          if (i >= server.length || used.indexOf(i) >= 0 || s.kind !== l.kind || s.investorId !== String(l.investorId || '')) return;
          const g = Math.abs(Date.parse(s.at) - Date.parse(l.at));
          if (g <= SAME_MS && g < gap) {
            best = i;
            gap = g;
          }
        });
        if (best >= 0) return used.push(best);
      }
      out.push({ at: String(l.at || ''), kind: String(l.kind || ''), subject: String(l.subject || ''), investorId: String(l.investorId || ''), to: String(l.to || ''), status: String(l.status || '') });
    });
    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, MAX);
  }
  function entriesFor(ws, investorId) {
    const local = (ws.mailLog || []).filter((e) => e && (!investorId || e.investorId === investorId));
    const c = serverOn(ws) ? cache[cacheKey(ws, investorId)] : null;
    return { list: merge(local, (c && c.entries) || []), note: (c && c.error) || '' };
  }
  const when = (at) => {
    const d = new Date(at);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const nameOf = (ws, e) => {
    const inv = (ws.investors || []).find((i) => i.id === e.investorId);
    return inv ? inv.title || inv.contact : e.to;
  };
  const kindLabel = (k) => (EM().KINDS[k] ? EM().KINDS[k].label : '');
  /** One list of sent emails; page: the whole workspace's, with whom each went to and the page's investor filter. */
  function logBody(ws, investorId, page) {
    const got = entriesFor(ws, investorId);
    const who = page ? ui().who || '' : '';
    const list = got.list.filter((e) => !who || e.investorId === who);
    const note = got.note ? `<p class="cs-hint eml-note">${h(got.note)}</p>` : '';
    if (!list.length) return `${note}<p class="cs-hint eml-none">No emails yet.</p>`;
    return `${note}<ul class="eml-log" style="list-style:none;margin:0;padding:0">${list
      .map(
        (e) =>
          `<li class="eml-item" data-at="${h(e.at)}" style="padding:8px 0;border-top:1px solid #e2e5e9;overflow-wrap:anywhere"><span class="cs-hint eml-when">${h(when(e.at))}</span><br><strong class="eml-subj">${h(e.subject || kindLabel(e.kind))}</strong><br>${page ? `<span class="eml-who">${h(nameOf(ws, e))}</span> · ` : ''}<span class="eml-status" data-status="${h(e.status)}">${h(SAYS[e.status] || SAYS.failed)}</span></li>`
      )
      .join('')}</ul>`;
  }
  /** The investor's sent emails, for their Account record. With a server, its log is asked for again on each open. */
  function logSection(ws, inv) {
    if (!ws || !inv) return '';
    if (serverOn(ws)) setTimeout(() => load(ws, inv.id, 0), 0);
    return `<section class="eml-record" style="margin:16px 0"><h3 style="margin:0 0 4px">Emails</h3><div data-eml-log="${h(cacheKey(ws, inv.id))}">${logBody(ws, inv.id, false)}</div></section>`;
  }
  function sentHTML(ws) {
    const who = ui().who || '';
    const ids = [];
    entriesFor(ws, '').list.forEach((e) => e.investorId && ids.indexOf(e.investorId) < 0 && ids.push(e.investorId));
    if (who && ids.indexOf(who) < 0) ids.push(who);
    const opts = ids
      .map((id) => ({ id, name: nameOf(ws, { investorId: id, to: id }) }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((o) => `<option value="${h(o.id)}"${o.id === who ? ' selected' : ''}>${h(o.name)}</option>`)
      .join('');
    return `<div class="cs-grid"><label class="cs-field" for="eml-who"><span>Investor</span><select id="eml-who" data-change="eml-who"><option value="">All investors</option>${opts}</select></label></div>
      <div data-eml-log="${h(cacheKey(ws, ''))}" data-eml-page>${logBody(ws, '', true)}</div>`;
  }

  NS.views['console-emails'] = {
    mode: 'console',
    render() {
      const ws = W();
      const { investors, team } = rows();
      const needs = String(ws.tenant.postalAddress || '').trim() ? [] : [POSTAL_LINE];
      return CK().shell(
        `${CK().head('Emails', 'Every email your portal sends, in your brand. Open a preview to see it as your investors and your team receive it.')}
        ${logoAsName(ws) ? `<p class="cs-hint eml-logo">${LOGO_LINE}</p>` : ''}
        ${needs.length ? CK().panel('Before you send', `<ul class="eml-needs">${needs.map((l) => `<li>${h(l)}</li>`).join('')}</ul>`) : ''}
        ${CK().panel('To investors', listHTML(ws, investors))}
        ${CK().panel('To your team', listHTML(ws, team))}
        ${CK().panel('Sent', sentHTML(ws))}`,
        ROUTE
      );
    },
    after() {
      const ws = W();
      if (serverOn(ws)) load(ws, '', 5000);
    }
  };
  NS.changes['eml-who'] = (el) => {
    ui().who = el.value;
    const box = document.querySelector('#view [data-eml-page]');
    if (box) box.innerHTML = logBody(W(), '', true);
  };

  /** Phone, Desktop or Text: opens that preview under its row (one open at a time); pressed again, it closes. */
  NS.actions['eml-show'] = (el) => {
    const key = el.getAttribute('data-key');
    const mode = el.getAttribute('data-mode');
    const open = ui().open;
    const same = open && open.key === key && open.mode === mode;
    ui().open = same ? null : { key, mode };
    document.querySelectorAll('#view .eml-slot').forEach((s) => (s.innerHTML = ''));
    document.querySelectorAll('#view [data-action=eml-show]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    if (same) return;
    const [kind, variant] = String(key).split(':');
    if (!EM().KINDS[kind]) return;
    const li = el.closest('.eml-row');
    const slot = li && li.querySelector('.eml-slot');
    if (!slot) return;
    slot.innerHTML = previewHTML(rendered(W(), { kind, variant }), mode);
    el.setAttribute('aria-pressed', 'true');
  };

  NS.emailsUI = { sample, firmOf, rows, logSection, merge, SAYS };
})(window.CVPortal);
