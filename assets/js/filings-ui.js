/*
 * Filings tab (self-serve edition): what is due for each offering's Form D and state notices, and when; reminders
 * silenced and turned back on; what the sponsor filed themselves; the orders recorded with their amount due.
 *
 * Every date, count and amount on this page comes from filings.js (NS.filings.facts, due and count, and the orders it
 * recorded), worked out on each render from the record; this file computes none of its own. It stores only what the
 * sponsor records here, through the record's own writers, saved with the workspace and written to the change log.
 * The page makes no network call on any path, uses no dialog, and asks for nothing: every field is optional.
 * The managed edition does not load this file.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const { h, date } = U;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const FL = () => NS.filings;
  const today = () => NS.dates.today();
  /** The state table of the state notices section, used as soon as its script has loaded. */
  const opts = () => ({ states: NS.blueskyData && NS.blueskyData.table });
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const money = (cents) => NS.eligibility.usd(cents);
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o && o.id === id) || null;
  /** The offering's stored entry for reading (nothing is created by looking). */
  const stored = (ws, id) => (ws.filings && own(ws.filings.offerings, id) && ws.filings.offerings[id]) || {};
  /** What is open on the page now, kept across redraws and never stored: open rows, the one inline form, messages. */
  function ui() {
    const u = S().ui;
    if (!u.fl) u.fl = { open: {}, form: null, err: {} };
    return u.fl;
  }
  const redraw = () => NS.app.render();
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;
  /** A real date that is not after today, or the sentence that says what is wrong. */
  function pastDate(v, what) {
    const d = String(v || '').trim();
    if (!d) return { error: `Enter the date ${what}.` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || NS.dates.isoOf(NS.dates.parse(d)) !== d) return { error: 'Enter a date as year, month and day.' };
    if (d > today()) return { error: 'The date cannot be after today.' };
    return { value: d };
  }

  /* ---------- Sections other files add ----------
   * A section (the Form D, EDGAR access, the state notices, the link to the server) is its own script beside this one.
   * It registers itself with NS.filingsUI.part(key, { order, title, summary(ws, offering) -> html or '',
   * render(ws, offering, rest) -> html }): the tab draws its summary line under the offering with a link to
   * console-filings-<key>-<offeringId>, and that address draws render() under the bar with Back and the offering's name.
   * The scripts are a fixed list, loaded once, on the tab's first render; one that does not load is skipped for that
   * visit and nothing is shown for it. No file name comes from data or from the address.
   */
  const HERE = (document.currentScript && document.currentScript.src) || '';
  const PARTS = Object.freeze({ formd: Object.freeze(['formd.js', 'formd-ui.js']), access: Object.freeze(['edgar-access.js']), states: Object.freeze(['bluesky-data.js', 'bluesky.js']), remote: Object.freeze(['filings-remote.js']) });
  const parts = {};
  const load = { started: false, settled: false, waiting: false };
  function part(key, spec) {
    if (!/^[a-z]+$/.test(String(key)) || !spec || typeof spec.render !== 'function') return false;
    parts[key] = { key, order: Number(spec.order) || 0, title: String(spec.title || ''), summary: typeof spec.summary === 'function' ? spec.summary : null, render: spec.render };
    return true;
  }
  /** One script from beside this file; resolves to whether it loaded. */
  function script(name) {
    return new Promise((resolve) => {
      let src = '';
      try {
        src = HERE ? new URL(name, HERE).href : new URL(`assets/js/${name}`, document.baseURI).href;
      } catch (e) {
        return resolve(false);
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve(true);
      s.onerror = () => {
        s.remove();
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }
  /** Each section's files in their order (the second needs the first); the sections side by side. */
  function start() {
    if (load.started) return;
    load.started = true;
    Promise.all(
      Object.keys(PARTS).map(async (k) => {
        for (const name of PARTS[k]) if (!(await script(name))) break;
      })
    ).then(() => {
      load.settled = true;
      refresh();
    });
  }
  const typing = () => {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest('.fl') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
  };
  /**
   * Redraw the tab after a section has registered or changed. While the sections are loading nothing is redrawn: there
   * is one redraw when loading has settled. Never while a field on the tab has focus: it waits until the field is left.
   */
  function refresh() {
    if (!load.settled || S().route !== 'console-filings') return;
    if (typing()) {
      load.waiting = true;
      return;
    }
    load.waiting = false;
    NS.app.render();
  }
  document.addEventListener('focusout', () => {
    if (load.waiting) setTimeout(refresh, 0);
  });
  const API = { part, PARTS, refresh, link: null };
  /** The link to the server (set by its own script): whether it is connected, and its line under an order. */
  function connected(ws) {
    const l = API.link;
    try {
      return !!(l && typeof l.connected === 'function' && l.connected(ws));
    } catch (e) {
      if (window.console) console.error(e);
      return false;
    }
  }
  /** What a section gives, or '' when it fails: one section's fault never takes the tab down. */
  function from(fn, ...args) {
    try {
      return fn(...args) || '';
    } catch (e) {
      if (window.console) console.error(e);
      return '';
    }
  }
  /** The section an address names: console-filings-<key>-<offeringId>[-<rest>]; null when the key or the offering is not there. */
  function sectionOf(ws, param) {
    const m = /^([a-z]+)-(.+)$/.exec(String(param || ''));
    if (!m || !own(parts, m[1])) return null;
    const o = (ws.offerings || []).filter((x) => x && (m[2] === x.id || m[2].indexOf(`${x.id}-`) === 0)).sort((a, b) => b.id.length - a.id.length)[0];
    return o ? { part: parts[m[1]], offering: o, rest: m[2].slice(o.id.length + 1) } : null;
  }
  const barHTML = (title) => `<div class="fl-bar"><a class="fl-back" href="#console-filings">${U.icon('back')}Back</a>${title ? `<span class="fl-bar-title">${h(title)}</span>` : ''}</div>`;
  function sectionHTML(ws, sec) {
    let body = '';
    try {
      body = sec.part.render(ws, sec.offering, sec.rest) || '';
    } catch (e) {
      if (window.console) console.error(e);
      body = '<p class="fl-note" role="alert">This section could not be shown.</p>';
    }
    // The bar names the section in the tab's own pattern (an h1, as "Filings"), with the offering's name under it
    // (06-WALKTHROUGH-3 failure 10: Form D, EDGAR access and State filings said only the offering's name).
    const bar = sec.part.title
      ? `<div class="fl-bar"><a class="fl-back" href="#console-filings">${U.icon('back')}Back</a><div class="fl-bar-head"><h1>${h(sec.part.title)}</h1><span class="fl-bar-title">${h(sec.offering.name)}</span></div></div>`
      : barHTML(sec.offering.name);
    return `<div class="fl fl-section" data-part="${h(sec.part.key)}">${bar}${body}</div>`;
  }
  /** Each registered section's line under an offering, in the sections' order. */
  function partsHTML(ws, o) {
    const lines = Object.keys(parts)
      .map((k) => parts[k])
      .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1))
      .map((p) => {
        const s = p.summary ? from(p.summary, ws, o) : '';
        return s ? `<li class="fl-row fl-part" data-part="${h(p.key)}"><a class="fl-part-link" href="#console-filings-${h(p.key)}-${h(o.id)}"><span class="fl-what"><span class="fl-title">${h(p.title)}</span><span class="fl-detail">${s}</span></span><span class="fl-chev" aria-hidden="true">${U.icon('arrow')}</span></a></li>` : '';
      })
      .join('');
    return lines ? `<ul class="fl-list fl-parts">${lines}</ul>` : '';
  }

  /* ---------- What a reminder says ---------- */
  const LEVEL = { overdue: 'Overdue', due: 'Due', soon: 'Soon', later: 'Later' };
  const RANK = { overdue: 0, due: 1, soon: 2, later: 3 };
  const CHANGED = { minimumInvestment: 'minimum investment', totalOffering: 'total offering amount', nonAccredited: 'non-accredited investors', commissions: 'sales commissions', findersFees: 'finders’ fees', proceedsToInsiders: 'payments to insiders', relatedPersons: 'related persons', material: 'other information on the notice' };
  const stateName = (code) => FL().stateName(code) || code;
  const isFormD = (r) => r.kind.indexOf('formd-') === 0;
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

  /* ---------- Inline forms (no dialog) ---------- */
  const errorHTML = (msg) => `<p class="field-error" role="alert">${msg ? h(msg) : ''}</p>`;
  const formActs = (label) => `<div class="fl-acts"><button class="cs-btn cs-btn-small cs-btn-primary" type="submit">${label || 'Save'}</button>${btn('fl-form-close', 'Cancel')}</div>`;
  const dateField = (label, name, value) => `<label class="cs-field">${label}<input type="date" name="${name}" value="${h(value || '')}" max="${today()}"></label>`;
  /** The form under a row: a Form D the sponsor filed, or a state notice. */
  function rowFormHTML(r) {
    const f = ui().form;
    if (!f || f.key !== r.key) return '';
    const v = f.values || {};
    if (f.kind === 'filed')
      return `<form class="fl-form" data-form="fl-filed" data-key="${h(r.key)}" novalidate>
        ${dateField('Filed on', 'filedOn', v.filedOn)}
        <label class="cs-field">Accession number <em>(optional)</em><input type="text" name="accession" value="${h(v.accession || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        ${errorHTML(f.error)}${formActs()}
      </form>`;
    return `<form class="fl-form" data-form="fl-state" data-key="${h(r.key)}" novalidate>${dateField('Filed on', 'filedOn', v.filedOn)}${errorHTML(f.error)}${formActs()}</form>`;
  }
  function rowHTML(ws, r) {
    const [cls, word] = pillOf(r);
    const whole = own(ws.filings && ws.filings.silenced, `offering:${r.offeringId}`);
    const key = ` data-key="${h(r.key)}"`;
    const acts = [];
    // Silenced with the whole offering: turned back on with the offering, not one by one.
    if (r.silenced) {
      if (!whole) acts.push(btn('fl-unsilence', 'Turn back on', key));
    } else {
      acts.push(btn('fl-silence', 'Silence', key));
      if (isFormD(r)) acts.push(btn('fl-form', 'I filed this myself', `${key} data-kind="filed"`));
      else if (r.kind === 'state-first') acts.push(btn('fl-form', 'Filed', `${key} data-kind="state"`));
    }
    return `<li class="fl-row ${cls}"${key}>
      <div class="fl-what"><span class="fl-title">${h(titleOf(r))}</span><span class="fl-detail">${h(reasonOf(r))}</span></div>
      <div class="fl-when"><span class="fl-pill ${cls}">${word}</span><span class="fl-date">${r.due ? `Due ${date(r.due)}` : ''}</span></div>
      <div class="fl-acts">${acts.join('')}</div>
      ${rowFormHTML(r)}
    </li>`;
  }
  /** An offering's state reminders: one row for one state; for several, one row that opens to the states. */
  function statesHTML(ws, o, list) {
    if (list.length < 2) return list.map((r) => rowHTML(ws, r)).join('');
    const id = `states:${o.id}`;
    const isOpen = !!ui().open[id];
    const live = list.filter((r) => !r.silenced);
    const worst = live.slice().sort((a, b) => RANK[a.level] - RANK[b.level] || (a.due ? 0 : 1) - (b.due ? 0 : 1))[0];
    const [cls, word] = worst ? pillOf(worst) : ['is-off', 'Silenced'];
    const dates = live.map((r) => r.due).filter(Boolean).sort();
    const first = list.filter((r) => r.kind === 'state-first');
    const f = ui().form;
    const allForm = f && f.kind === 'states' && f.id === o.id ? `<form class="fl-form" data-form="fl-states" data-id="${h(o.id)}" novalidate>${dateField(`${plural(first.length, 'notice')} filed on`, 'filedOn', (f.values || {}).filedOn)}${errorHTML(f.error)}${formActs()}</form>` : '';
    return `<li class="fl-row fl-group ${cls}" data-offering="${h(o.id)}">
      <button type="button" class="fl-group-head" data-action="fl-open" data-id="${h(id)}" aria-expanded="${isOpen}">
        <span class="fl-what"><span class="fl-title">State notices</span><span class="fl-detail">${plural(list.length, 'state')}</span></span>
        <span class="fl-when"><span class="fl-pill ${cls}">${word}</span><span class="fl-date">${dates.length ? `First due ${date(dates[0])}` : ''}</span></span>
        <span class="fl-chev" aria-hidden="true">${U.icon('arrow')}</span>
      </button>
      ${isOpen ? `<div class="fl-group-body">${first.length ? `<div class="fl-acts">${btn('fl-form', 'Record all as filed', ` data-kind="states" data-id="${h(o.id)}"`)}</div>${allForm}` : ''}<ul class="fl-list fl-sub">${list.map((r) => rowHTML(ws, r)).join('')}</ul></div>` : ''}
    </li>`;
  }

  /* ---------- Orders ---------- */
  const ORDER = { recorded: 'Recorded', received: 'Received', filed: 'Filed', done: 'Done' };
  /** A state order reads its results ("Partly filed (1 of 2)" and the states still open); any other order its status. */
  function orderSays(ws, order) {
    const B = NS.bluesky;
    if (B && typeof B.orderStatus === 'function' && (order.kind === 'bluesky' || order.kind === 'bluesky-renewal')) return B.orderStatus(ws, order);
    return { label: ORDER[order.status] || order.status, open: [] };
  }
  API.orderSays = orderSays;
  const openOrders = (ws, id) => ((ws.filings && ws.filings.orders) || []).filter((x) => x && x.status !== 'cancelled' && (!id || x.offeringId === id));
  function orderHTML(ws, order) {
    const f = ui().form;
    const asking = f && f.kind === 'cancel' && f.id === order.id;
    // Orders are placed and cancelled by an admin only.
    const cancel = order.status === 'recorded' && NS.app.can('configure') ? (asking ? `<span class="fl-ask">Cancel this order?</span>${btn('fl-cancel-order', 'Cancel the order', ` data-id="${h(order.id)}"`, 'cs-btn-danger')}${btn('fl-form-close', 'Keep it')}` : btn('fl-form', 'Cancel order', ` data-kind="cancel" data-id="${h(order.id)}"`)) : '';
    const says = orderSays(ws, order);
    return `<div class="fl-order" data-order="${h(order.id)}">
      <div class="fl-fees">
        ${(order.lines || []).map((l) => `<div><span>${h(l.label)}</span><span>${l.cents == null ? 'To be confirmed' : money(l.cents)}</span></div>`).join('')}
        <div class="fl-total"><span>${h(says.label)} · ${date(String(order.at || '').slice(0, 10))}</span><span class="fl-due">${money(order.dueCents)} due${order.openFees ? ', fees to be confirmed' : ''}</span></div>
      </div>
      ${order.status === 'partly-filed' && says.open.length ? `<p class="fl-note" data-open-states>Still open: ${h(says.open.join(', '))}.</p>` : ''}
      ${cancel ? `<div class="fl-acts">${cancel}</div>` : ''}
      ${API.link && typeof API.link.orderLine === 'function' ? from(API.link.orderLine, ws, order) : ''}
    </div>`;
  }
  const ordersHTML = (ws, o) => {
    const list = openOrders(ws, o.id);
    return list.length ? `<div class="fl-orders"><h3>Orders</h3>${list.map((x) => orderHTML(ws, x)).join('')}</div>` : '';
  };

  /* ---------- An offering ---------- */
  /** What is on the record as filed by the sponsor, each with the way to take a mistake back. */
  function onFileHTML(ws, o) {
    const r = stored(ws, o.id);
    const id = ` data-id="${h(o.id)}"`;
    const notices = (r.formD || []).filter((n) => n && n.source === 'self' && n.status === 'accepted').map((n) => `<li><span>Form D ${n.type === 'D/A' ? 'amendment' : 'notice'} filed on ${date(n.filedOn)}${n.accession ? ` · ${h(n.accession)}` : ''}</span>${btn('fl-remove-notice', 'Remove', `${id} data-notice="${h(n.id)}"`)}</li>`);
    const states = Object.keys(r.states || {})
      .sort()
      .filter((c) => r.states[c] && r.states[c].source === 'self' && r.states[c].filedOn)
      .map((c) => `<li><span>${h(stateName(c))} notice filed on ${date(r.states[c].filedOn)}</span>${btn('fl-remove-state', 'Remove', `${id} data-code="${h(c)}"`)}</li>`);
    return notices.length || states.length ? `<div class="fl-onfile"><h3>Recorded as filed</h3><ul>${notices.concat(states).join('')}</ul></div>` : '';
  }
  function optionsHTML(ws, o, f) {
    const key = `options:${o.id}`;
    const isOpen = !!ui().open[key];
    const r = stored(ws, o.id);
    const id = ` data-id="${h(o.id)}"`;
    const err = ui().err;
    const save = '<button class="cs-btn cs-btn-small" type="submit">Save</button>';
    return `<div class="fl-more">
      <button type="button" class="cs-btn cs-btn-small" data-action="fl-open" data-id="${h(key)}" aria-expanded="${isOpen}">Options</button>
      ${
        isOpen
          ? `<div class="fl-options">
        <form class="fl-form" data-form="fl-first"${id} novalidate>${dateField('First sale', 'firstSale', f.firstSale)}${errorHTML(err[`first:${o.id}`])}<div class="fl-acts">${save}${r.firstSale ? btn('fl-first-clear', 'Use the earliest sale on record', id) : ''}</div></form>
        <form class="fl-form" data-form="fl-ended"${id} novalidate>${dateField('Offering ended', 'ended', r.ended)}${errorHTML(err[`ended:${o.id}`])}<div class="fl-acts">${save}${r.ended ? btn('fl-ended-clear', 'Remove the date', id) : ''}</div></form>
        ${onFileHTML(ws, o)}
        <div class="fl-acts">${btn('fl-mode', 'Not filing for this offering', `${id} data-mode="none"`)}</div>
      </div>`
          : ''
      }
    </div>`;
  }
  function offeringHTML(ws, o, reminders) {
    const id = ` data-id="${h(o.id)}"`;
    if (stored(ws, o.id).mode === 'none')
      return `<section class="cs-panel fl-off" data-offering="${h(o.id)}">
        <div class="cs-panel-head"><h2>${h(o.name)}</h2></div>
        <p class="fl-note">Not filing for this offering: its reminders are off. ${btn('fl-mode', 'Turn reminders back on', `${id} data-mode=""`)}</p>
        ${ordersHTML(ws, o)}
      </section>`;
    const f = FL().facts(ws, o);
    const mine = reminders.filter((r) => r.offeringId === o.id);
    const whole = own(ws.filings && ws.filings.silenced, `offering:${o.id}`);
    const all = whole ? btn('fl-unsilence', 'Turn all back on', ` data-key="offering:${h(o.id)}"`) : mine.length > 1 && mine.some((r) => !r.silenced) ? btn('fl-silence', 'Silence all', ` data-key="offering:${h(o.id)}"`) : '';
    const facts = f.firstSale ? `First sale ${date(f.firstSale)} (${stored(ws, o.id).firstSale ? 'the date you confirmed' : 'the earliest sale on record'}) · ${plural(f.investors, 'investor')}` : 'No sale on record yet.';
    const rows = mine.filter(isFormD).map((r) => rowHTML(ws, r)).join('') + statesHTML(ws, o, mine.filter((r) => !isFormD(r)));
    return `<section class="cs-panel fl-off" data-offering="${h(o.id)}">
      <div class="cs-panel-head"><h2>${h(o.name)}</h2>${all}</div>
      <p class="cs-muted fl-facts">${facts}</p>
      ${rows ? `<ul class="fl-list">${rows}</ul>` : f.firstSale ? '<p class="cs-muted">Nothing is due.</p>' : ''}
      ${partsHTML(ws, o)}
      ${ordersHTML(ws, o)}
      ${optionsHTML(ws, o, f)}
    </section>`;
  }

  /* ---------- The page ---------- */
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
    const connect = !connected(ws) && openOrders(ws).some((x) => offs.some((o) => o.id === x.offeringId)) ? '<p class="fl-note fl-connect">Sending an order to be filed needs the portal connected to its server.</p>' : '';
    return `<div class="fl">
      <div class="fl-bar"><a class="fl-back" href="#console">${U.icon('back')}Overview</a><h1>Filings</h1></div>
      ${connect}
      ${offs.length ? offs.map((o) => offeringHTML(ws, o, reminders)).join('') : noneHTML(ws)}
    </div>`;
  }

  /* ---------- Actions ---------- */
  const audit = (action, detail, offeringId) => CK().audit(action, detail, offeringId || '');
  /** What a silence key names, for the change log. */
  function keyLabel(ws, key) {
    const p = String(key).split(':');
    const o = offeringOf(ws, p[1]);
    const name = o ? o.name : p[1];
    if (p[0] === 'offering') return `${name}: all reminders`;
    return `${name}: ${titleOf({ kind: p[0], state: p[2] })}`;
  }
  NS.actions['fl-silence'] = (el) => {
    const ws = W();
    const key = el.getAttribute('data-key');
    if (!FL().silence(ws, key, NS.app.actor())) return;
    audit('Filing reminder silenced', keyLabel(ws, key), key.split(':')[1]);
    NS.app.save(true);
    redraw();
  };
  NS.actions['fl-unsilence'] = (el) => {
    const ws = W();
    const key = el.getAttribute('data-key');
    if (!FL().unsilence(ws, key)) return;
    audit('Filing reminder turned back on', keyLabel(ws, key), key.split(':')[1]);
    NS.app.save(true);
    redraw();
  };
  NS.actions['fl-open'] = (el) => {
    const id = el.getAttribute('data-id');
    ui().open[id] = !ui().open[id];
    redraw();
  };
  NS.actions['fl-form'] = (el) => {
    ui().form = { kind: el.getAttribute('data-kind'), key: el.getAttribute('data-key') || '', id: el.getAttribute('data-id') || '', values: {}, error: '' };
    redraw();
  };
  NS.actions['fl-form-close'] = () => {
    ui().form = null;
    redraw();
  };
  /** A form's answer kept on screen with the sentence that says what is wrong. */
  function refuse(f, error) {
    const form = ui().form;
    if (!form) return;
    form.error = error;
    form.values = { filedOn: f.elements.filedOn ? f.elements.filedOn.value : '', accession: f.elements.accession ? f.elements.accession.value : '' };
    redraw();
  }
  NS.forms['fl-filed'] = (f) => {
    const ws = W();
    const p = String(f.getAttribute('data-key')).split(':');
    const o = offeringOf(ws, p[1]);
    if (!o) return;
    const d = pastDate(f.elements.filedOn.value, 'it was filed');
    if (d.error) return refuse(f, d.error);
    const accession = f.elements.accession.value.trim();
    if (accession && !/^\d{10}-\d{2}-\d{6}$/.test(accession)) return refuse(f, 'An accession number has 18 digits, written as 10, 2 and 6 with hyphens between.');
    // The first notice is a Form D; anything recorded once one is on file is an amendment.
    const type = p[0] === 'formd-first' ? 'D' : 'D/A';
    if (!FL().recordFiled(ws, o.id, { type, filedOn: d.value, accession, source: 'self' })) return refuse(f, 'The notice could not be recorded.');
    audit(type === 'D' ? 'Form D notice recorded as filed' : 'Form D amendment recorded as filed', `${o.name}: filed by the firm on ${date(d.value)}${accession ? `, accession number ${accession}` : ''}`, o.id);
    ui().form = null;
    NS.app.save(true);
    redraw();
  };
  NS.forms['fl-state'] = (f) => {
    const ws = W();
    const p = String(f.getAttribute('data-key')).split(':');
    const o = offeringOf(ws, p[1]);
    if (!o) return;
    const d = pastDate(f.elements.filedOn.value, 'it was filed');
    if (d.error) return refuse(f, d.error);
    if (!FL().recordState(ws, o.id, p[2], { filedOn: d.value, status: 'filed', source: 'self' })) return refuse(f, 'The notice could not be recorded.');
    audit('State notice recorded as filed', `${o.name}: ${stateName(p[2])}, filed by the firm on ${date(d.value)}`, o.id);
    ui().form = null;
    NS.app.save(true);
    redraw();
  };
  NS.forms['fl-states'] = (f) => {
    const ws = W();
    const o = offeringOf(ws, f.getAttribute('data-id'));
    if (!o) return;
    const d = pastDate(f.elements.filedOn.value, 'they were filed');
    if (d.error) return refuse(f, d.error);
    const codes = FL()
      .due(ws, today(), opts())
      .filter((r) => r.offeringId === o.id && r.kind === 'state-first')
      .map((r) => r.state)
      .filter((c) => FL().recordState(ws, o.id, c, { filedOn: d.value, status: 'filed', source: 'self' }));
    if (codes.length) audit('State notices recorded as filed', `${o.name}: ${codes.join(', ')}, filed by the firm on ${date(d.value)}`, o.id);
    ui().form = null;
    NS.app.save(true);
    redraw();
  };
  NS.forms['fl-first'] = (f) => {
    const ws = W();
    const o = offeringOf(ws, f.getAttribute('data-id'));
    if (!o) return;
    const d = pastDate(f.elements.firstSale.value, 'of the first sale');
    ui().err[`first:${o.id}`] = d.error || '';
    if (!d.error) {
      FL().rec(ws, o.id).firstSale = d.value;
      audit('First sale date confirmed', `${o.name}: ${date(d.value)}`, o.id);
      NS.app.save(true);
    }
    redraw();
  };
  NS.actions['fl-first-clear'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    FL().rec(ws, o.id).firstSale = '';
    ui().err[`first:${o.id}`] = '';
    audit('First sale date set back to the earliest sale on record', o.name, o.id);
    NS.app.save(true);
    redraw();
  };
  NS.forms['fl-ended'] = (f) => {
    const ws = W();
    const o = offeringOf(ws, f.getAttribute('data-id'));
    if (!o) return;
    const d = pastDate(f.elements.ended.value, 'the offering ended');
    ui().err[`ended:${o.id}`] = d.error || '';
    if (!d.error) {
      FL().rec(ws, o.id).ended = d.value;
      audit('Offering end date recorded', `${o.name}: ${date(d.value)}`, o.id);
      NS.app.save(true);
    }
    redraw();
  };
  NS.actions['fl-ended-clear'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    FL().rec(ws, o.id).ended = '';
    ui().err[`ended:${o.id}`] = '';
    audit('Offering end date removed', o.name, o.id);
    NS.app.save(true);
    redraw();
  };
  NS.actions['fl-mode'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    const none = el.getAttribute('data-mode') === 'none';
    FL().rec(ws, o.id).mode = none ? 'none' : '';
    audit(none ? 'Offering marked as not filing' : 'Filing reminders turned back on for the offering', o.name, o.id);
    NS.app.save(true);
    redraw();
  };
  NS.actions['fl-remove-notice'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const r = o && FL().rec(ws, o.id);
    const n = r && r.formD.find((x) => x && x.id === el.getAttribute('data-notice') && x.source === 'self');
    if (!n) return;
    r.formD = r.formD.filter((x) => x !== n);
    audit('Filed notice taken off the record', `${o.name}: Form D ${n.type === 'D/A' ? 'amendment' : 'notice'} recorded as filed on ${date(n.filedOn)}`, o.id);
    NS.app.save(true);
    redraw();
  };
  NS.actions['fl-remove-state'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const r = o && FL().rec(ws, o.id);
    const code = el.getAttribute('data-code');
    if (!r || !own(r.states, code) || r.states[code].source !== 'self') return;
    const was = r.states[code].filedOn;
    delete r.states[code];
    audit('State notice taken off the record', `${o.name}: ${stateName(code)}, recorded as filed on ${date(was)}`, o.id);
    NS.app.save(true);
    redraw();
  };
  NS.actions['fl-cancel-order'] = (el) => {
    if (!NS.app.can('configure')) return;
    FL().cancelOrder(W(), el.getAttribute('data-id'));
    ui().form = null;
    NS.app.save(true);
    redraw();
  };

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
    NS.hooks.consoleAttention.push((ws) => {
      const n = open(ws);
      return n ? `<li><a href="#console-filings">${plural(n, 'filing')} due or overdue</a></li>` : '';
    });
    NS.views['console-filings'] = {
      mode: 'console',
      edition: 'diy',
      render(param) {
        start();
        const ws = W();
        const sec = param ? sectionOf(ws, param) : null;
        if (sec) return CK().shell(sectionHTML(ws, sec), 'console-filings');
        // A section's address before its script has loaded: wait for the scripts. Once they have settled, an address
        // that names no section or no offering shows the list.
        if (param && !load.settled) return CK().shell(`<div class="fl">${barHTML('')}<p class="cs-muted" role="status">Loading…</p></div>`, 'console-filings');
        return CK().shell(listHTML(), 'console-filings');
      }
    };
  }
  NS.filingsUI = API;
})(window.CVPortal);
