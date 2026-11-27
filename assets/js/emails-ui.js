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

  NS.views[ROUTE] = {
    mode: 'console',
    render() {
      const ws = W();
      const { investors, team } = rows();
      return CK().shell(
        `${CK().head('Emails', 'Every email your portal sends, in your brand. Open a preview to see it as your investors and your team receive it.')}
        ${CK().panel('To investors', listHTML(ws, investors))}
        ${CK().panel('To your team', listHTML(ws, team))}`,
        ROUTE
      );
    }
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

  NS.emailsUI = { sample, firmOf, rows };
})(window.CVPortal);
