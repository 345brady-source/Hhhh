/*
 * Tax withheld on the new-distribution screen (plan 10-07, D-04, C-03, TAX-14), self-serve console only (the managed edition
 * does not load this file, and the console behaves exactly as before without it).
 *
 * The screen draws what NS.withholding (withholding.js) proposes and records the person's decision on each line; it works
 * out no amount itself. Nothing is withheld until a person confirms a line, and the ACH file and the record wait while any
 * proposed line is neither confirmed nor removed. Only confirmed lines leave this file (withheld(draft)), in the shape
 * NS.data.buildLines takes, so one set of lines gives the table, the file's entries and the stored record.
 *
 * The decisions live on the console's draft (draft.wh) and are never stored on their own: the record stores each confirmed
 * line with who and when. console.js calls reset(draft) when the offering, the date or the amount changes, because the
 * amounts the lines were confirmed for have changed.
 *
 * NS.withholdingUI:
 *   block(ws, offering, draft, lines) -> html    the tax withheld block under the allocation table ('' with no lines)
 *   withheld(draft) -> { [investorId]: [ w ] }   the confirmed lines of this draft
 *   blocked(ws, offering, draft, lines) -> ''    or one line saying why the file and the record wait
 *   reset(draft)                                  drops every decision
 * lines: the draft's allocation ({ investor, cents } rows) or { investorId, grossCents } lines.
 * Values from the workspace are escaped before they are drawn. No network call is made.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.ui) return;
  const U = NS.ui;
  const { h, usdc } = U;
  const WH = () => NS.withholding;
  const W = () => NS.state.ws;
  const actor = () => NS.app.actor();

  /* ---------- the draft's lines and decisions ---------- */
  const norm = (lines) =>
    (lines || [])
      .map((r) => ({ investorId: r.investorId || (r.investor && r.investor.id) || '', grossCents: r.grossCents != null ? r.grossCents : r.cents }))
      .filter((l) => l.investorId && Number.isInteger(l.grossCents) && l.grossCents > 0);
  /** The decisions on a draft (kept on it, never stored on their own). */
  function state(d) {
    if (!d.wh) d.wh = { dec: {}, lines: [], offeringId: '' };
    return d.wh;
  }
  const keyOf = (x) => [x.kind, x.investorId, x.cents, x.ratePct == null ? '' : x.ratePct].join(':');
  /** Every line the draft has now, each with its key and the person's decision ('' until there is one). */
  function drafts(ws, offering, d, lines) {
    const L = norm(lines);
    const st = state(d);
    let out = [];
    if (offering && d.date) {
      try {
        out = WH().propose(ws, offering, L, { date: d.date });
      } catch (e) {
        out = [];
      }
    }
    return out.map((x) => {
      const key = keyOf(x);
      const dec = st.dec[key];
      return Object.assign(x, { key, decided: dec ? dec.state : '' });
    });
  }
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  /** The current drafts of the console's draft, as the block last drew them. */
  function current(d) {
    const st = state(d);
    const ws = W();
    return drafts(ws, offeringOf(ws, st.offeringId), d, st.lines);
  }

  /* ---------- what console.js asks for ---------- */
  function withheld(d) {
    if (!d || !d.wh) return {};
    const list = Object.keys(d.wh.dec)
      .map((k) => d.wh.dec[k])
      .filter((x) => x.state === 'confirmed' && x.w)
      .map((x) => x.w);
    return WH().toWithheld(list);
  }
  function blocked(ws, offering, d, lines) {
    if (!d || !norm(lines).length) return '';
    return WH().undecided(drafts(ws, offering, d, lines)) ? 'A proposed tax withheld line is waiting: confirm or remove it.' : '';
  }
  function reset(d) {
    if (d) delete d.wh;
  }

  /* ---------- the block ---------- */
  const kindLabel = (k) => (WH().KINDS[k] || {}).label || k;
  const pct = (r) => `${+Number(r).toFixed(4)}%`;
  function rowHTML(ws, x, grossOf) {
    const inv = investorOf(ws, x.investorId);
    const name = inv ? inv.title : x.investorId;
    const how = x.ratePct == null ? `${usdc(x.cents)} entered` : `${pct(x.ratePct)}${x.source === 'entered' ? ' (rate from your CPA)' : ''} of ${usdc(x.basisCents)} · ${usdc(x.cents)}`;
    const pill = x.decided === 'confirmed' ? '<span class="tx-pill is-ok">Confirmed</span>' : x.decided === 'removed' ? '<span class="tx-pill is-off">Removed</span>' : '<span class="tx-pill is-wait">Proposed</span>';
    const acts = x.decided ? '' : `<button type="button" class="cs-btn cs-btn-small cs-btn-primary" data-action="wh-confirm" data-key="${h(x.key)}">Confirm</button><button type="button" class="cs-btn cs-btn-small" data-action="wh-remove" data-key="${h(x.key)}">Remove</button>`;
    return `<li class="tx-row" data-wh="${h(x.key)}" data-investor="${h(x.investorId)}" data-kind="${h(x.kind)}">
      <div class="tx-what"><span class="tx-title">${h(name)} · ${h(x.investorId)}</span><span class="tx-detail">${h(kindLabel(x.kind))} · ${h(how)}${grossOf[x.investorId] ? ` · payment ${usdc(grossOf[x.investorId])}` : ''}</span><span class="tx-detail">${h(x.why || '')}</span></div>
      <div class="tx-when">${pill}</div>
      <div class="tx-acts">${acts}</div>
    </li>`;
  }
  function block(ws, offering, d, lines) {
    const L = norm(lines);
    if (!d || !offering || !L.length) return '';
    const st = state(d);
    st.lines = L;
    st.offeringId = offering.id;
    const list = drafts(ws, offering, d, L);
    if (!list.length) return '';
    const grossOf = {};
    L.forEach((l) => (grossOf[l.investorId] = l.grossCents));
    return `<div class="tx wh"><h3>Tax withheld</h3><ul class="tx-list">${list.map((x) => rowHTML(ws, x, grossOf)).join('')}</ul></div>`;
  }

  /* ---------- the person's decisions ---------- */
  const consoleDraft = () => NS.state.ui.dist || null;
  function decide(el, how) {
    const d = consoleDraft();
    if (!d) return;
    const key = el.getAttribute('data-key');
    const x = current(d).find((y) => y.key === key && !y.decided);
    if (!x) return NS.app.render();
    try {
      if (how === 'confirm') state(d).dec[key] = { state: 'confirmed', w: WH().confirm(x, { by: actor() }) };
      else {
        WH().remove(x, { by: actor() });
        state(d).dec[key] = { state: 'removed', by: x.removedBy, at: x.removedAt };
      }
    } catch (e) {
      return U.toast(String((e && e.message) || e));
    }
    // an ACH file built before this decision paid other amounts
    d.file = null;
    d.line = null;
    NS.app.render();
  }
  NS.actions['wh-confirm'] = (el) => decide(el, 'confirm');
  NS.actions['wh-remove'] = (el) => decide(el, 'remove');

  NS.withholdingUI = { block, withheld, blocked, reset };

  // Loaded after the page was first drawn (taxdocs-ui.js adds this file): draw the screens that use it again.
  const typing = () => {
    const a = document.activeElement;
    return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
  };
  if (NS.state && NS.state.ws && /^console-distributions$/.test(NS.state.route || '') && !typing()) NS.app.render();
})(window.CVPortal);
