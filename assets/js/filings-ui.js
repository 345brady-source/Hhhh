/*
 * Filings tab (self-serve edition): what is due for each offering's Form D and state notices, and when.
 *
 * Every date, count and amount on this page comes from filings.js (NS.filings.facts, due and count), worked out on each
 * render from the record; this file computes none of its own and stores nothing but what the sponsor records here.
 * The page makes no network call on any path. The managed edition does not load this file.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const { h, date } = U;
  const CK = () => NS.consoleKit;
  const W = () => NS.state.ws;
  const FL = () => NS.filings;
  const today = () => NS.dates.today();
  /** The state table of the state notices section, used as soon as its script has loaded. */
  const opts = () => ({ states: NS.blueskyData && NS.blueskyData.table });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  /* ---------- What a reminder says ---------- */
  const LEVEL = { overdue: 'Overdue', due: 'Due', soon: 'Soon', later: 'Later' };
  const CHANGED = { minimumInvestment: 'minimum investment', totalOffering: 'total offering amount', nonAccredited: 'non-accredited investors', commissions: 'sales commissions', findersFees: 'finders’ fees', proceedsToInsiders: 'payments to insiders', relatedPersons: 'related persons', material: 'other information on the notice' };
  const stateName = (code) => FL().stateName(code) || code;
  function titleOf(r) {
    if (r.kind === 'formd-first') return 'First Form D notice';
    if (r.kind === 'formd-annual') return 'Form D annual amendment';
    if (r.kind === 'formd-change') return 'Form D amendment';
    if (r.kind === 'state-renewal') return `State notice renewal: ${stateName(r.state)}`;
    return `State notice: ${stateName(r.state)}`;
  }
  /** Why the reminder is there, from its basis. */
  function reasonOf(r) {
    const b = r.basis || {};
    if (r.kind === 'formd-first') return `15 days after the first sale on ${date(b.firstSale)}`;
    if (r.kind === 'formd-annual') return `One year after the ${b.type === 'D/A' ? 'amendment' : 'notice'} filed on ${date(b.filedOn)}`;
    if (r.kind === 'formd-change') return `Changed since the notice filed on ${date(b.filedOn)}: ${(b.reasons || []).map((x) => CHANGED[x.item] || x.item).join(', ')}`;
    if (r.kind === 'state-renewal') return b.filedOn ? `Notice filed on ${date(b.filedOn)}` : '';
    return `First sale in the state on ${date(b.firstSale)}${b.days != null ? `; due ${plural(b.days, 'day')} after` : ''}`;
  }
  function pillOf(r) {
    if (r.silenced) return ['is-off', 'Silenced'];
    if (r.level === 'due' && !r.due) return ['is-due', 'To file'];
    return [`is-${r.level}`, LEVEL[r.level] || ''];
  }
  function rowHTML(r) {
    const [cls, word] = pillOf(r);
    return `<li class="fl-row ${cls}" data-key="${h(r.key)}">
      <div class="fl-what"><span class="fl-title">${h(titleOf(r))}</span><span class="fl-detail">${h(reasonOf(r))}</span></div>
      <div class="fl-when"><span class="fl-pill ${cls}">${word}</span><span class="fl-date">${r.due ? `Due ${date(r.due)}` : ''}</span></div>
    </li>`;
  }

  /* ---------- The page ---------- */
  function offeringHTML(ws, o, reminders) {
    const f = FL().facts(ws, o);
    const mine = reminders.filter((r) => r.offeringId === o.id);
    const facts = f.firstSale ? `First sale ${date(f.firstSale)} · ${plural(f.investors, 'investor')}` : 'No sale yet: nothing is due.';
    return `<section class="cs-panel fl-off" data-offering="${h(o.id)}">
      <div class="cs-panel-head"><h2>${h(o.name)}</h2></div>
      <p class="cs-muted fl-facts">${facts}</p>
      ${mine.length ? `<ul class="fl-list">${mine.map(rowHTML).join('')}</ul>` : ''}
    </section>`;
  }
  /** With no offering under Rule 506(b) or 506(c), one line and the way to each offering's settings. */
  function noneHTML(ws) {
    const all = ws.offerings || [];
    if (!all.length) return '<p class="fl-note">No offerings yet. <a href="#console-offerings">Add an offering</a></p>';
    return `<p class="fl-note">Filings are tracked for offerings under Rule 506(b) or Rule 506(c). Set the exemption on ${all.map((o) => `<a href="#console-offering-${h(o.id)}">${h(o.shortName || o.name)}</a>`).join(', ')}.</p>`;
  }
  function listHTML() {
    const ws = W();
    const offs = (ws.offerings || []).filter((o) => FL().applies(o));
    const reminders = offs.length ? FL().due(ws, today(), opts()) : [];
    return `<div class="fl">
      <div class="fl-bar"><a class="fl-back" href="#console">${U.icon('back')}Overview</a><h1>Filings</h1></div>
      ${offs.length ? offs.map((o) => offeringHTML(ws, o, reminders)).join('') : noneHTML(ws)}
    </div>`;
  }

  /* ---------- Menu count and the overview's item ---------- */
  /** How many reminders are due or overdue and not silenced (0 when it cannot be told: the menu must never break). */
  function open(ws) {
    try {
      return FL().count(ws, today(), opts());
    } catch (e) {
      if (window.console) console.error(e);
      return 0;
    }
  }
  if (E.diy) {
    NS.navCounts = NS.navCounts || {};
    NS.navCounts['console-filings'] = (ws) => open(ws);
    NS.views['console-filings'] = {
      mode: 'console',
      edition: 'diy',
      render() {
        return CK().shell(listHTML(), 'console-filings');
      }
    };
  }
})(window.CVPortal);
