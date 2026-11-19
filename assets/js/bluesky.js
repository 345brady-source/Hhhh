/*
 * State notice filings (self-serve edition): which states an offering's notices go to, what the order costs, the package
 * staff file from by hand in the states' filing system, and each state's result. Nothing here talks to that system: a
 * person files there.
 *
 * Pure parts (they also load under Node, with filings.js for facts):
 *   problems(data)                 [ text ]: every row of the state table (bluesky-data.js) that breaks the rule; empty when
 *                                  none does. A confirmed row has its source, the date it was read and a fee (or says no
 *                                  notice is required); an unconfirmed row holds no fee, deadline or renewal.
 *   pick(facts)                    the states of the offering's sales: Object.keys(facts.byState), sorted
 *   fees(data, states, facts, opts) { lines: [ { label, cents, passThrough: true, state? } ], none: [code], open }
 *                                  one line per state needing a notice and one for the filing system's fee. An amount
 *                                  comes only from a confirmed row with its source and date; otherwise cents is null.
 *   pack(ws, offering, states)     { issuer: { name, cik }, accession, filedOn, offered, states: [ { code, name, firstSale,
 *                                  sold, investors } ] }: what staff need to file by hand, with no investor's name or address
 * The section (part key states of the Filings tab) is registered only where the tab is loaded (NS.filingsUI).
 * An order records each state's quoted fee (quotedCents) on the record and in the package; its pass-through lines stay
 * without an amount until what was paid is recorded.
 */
(function (NS) {
  'use strict';
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  const isCents = (v) => Number.isInteger(v) && v >= 0;

  /* ---------- The table's rule ---------- */
  function feeProblem(fee) {
    if (!fee || typeof fee !== 'object') return 'no fee';
    if (fee.kind === 'fixed') return isCents(fee.cents) ? '' : 'a fixed fee in whole cents';
    if (fee.kind === 'tiered') {
      const tiers = Array.isArray(fee.tiers) ? fee.tiers : [];
      if (fee.basis !== 'offered' && fee.basis !== 'soldInState') return 'a tiered fee names its basis';
      if (!tiers.length || !tiers.every((t) => t && isCents(t.cents) && (t.upTo === null || (typeof t.upTo === 'number' && t.upTo >= 0)))) return 'every tier has whole cents and an upper limit (null for the last)';
      return tiers[tiers.length - 1].upTo === null ? '' : 'the last tier has no upper limit';
    }
    if (fee.kind === 'percent') {
      if (fee.basis !== 'offered' && fee.basis !== 'soldInState') return 'a percent fee names its basis';
      if (!(typeof fee.rate === 'number' && fee.rate >= 0 && fee.rate < 1)) return 'a percent fee has a rate between 0 and 1';
      return [fee.minCents, fee.maxCents].every((c) => c === null || c === undefined || isCents(c)) ? '' : 'a percent fee\'s minimum and maximum are whole cents';
    }
    return 'an unknown kind of fee';
  }
  function problems(data) {
    const out = [];
    const table = (data && data.table) || {};
    Object.keys(table).forEach((code) => {
      const r = table[code] || {};
      if (r.confirmed === true) {
        if (!String(r.source || '').trim()) out.push(`${code}: confirmed with no source`);
        if (!isDay(r.readOn)) out.push(`${code}: confirmed with no date read`);
        if (r.noticeRequired !== false) {
          const p = feeProblem(r.fee);
          if (p) out.push(`${code}: ${p}`);
        }
        if (r.days !== null && r.days !== undefined && !(Number.isInteger(r.days) && r.days >= 0)) out.push(`${code}: days is a whole number`);
        if (r.renewal && r.renewal.fee && feeProblem(r.renewal.fee)) out.push(`${code}: renewal fee: ${feeProblem(r.renewal.fee)}`);
      } else {
        if (r.fee != null) out.push(`${code}: unconfirmed and holding a fee`);
        if (r.days != null) out.push(`${code}: unconfirmed and holding a deadline`);
        if (r.renewal != null) out.push(`${code}: unconfirmed and holding a renewal`);
      }
    });
    const s = (data && data.systemFee) || {};
    if (s.confirmed === true) {
      if (!isCents(s.cents) || !String(s.source || '').trim() || !isDay(s.readOn)) out.push('system fee: confirmed needs whole cents, a source and the date read');
    } else if (s.cents != null) out.push('system fee: unconfirmed and holding an amount');
    return out;
  }
  /** A row an amount may come from: confirmed, with its source and the date it was read. */
  const trusted = (r) => (r && r.confirmed === true && String(r.source || '').trim() && isDay(r.readOn) ? r : null);

  /* ---------- Pick, fees, package ---------- */
  const pick = (facts) => Object.keys((facts && facts.byState) || {}).sort();
  const nameOf = (code) => (NS && NS.blueskyData && NS.blueskyData.table[code] && NS.blueskyData.table[code].name) || (NS && NS.filings && NS.filings.stateName(code)) || code;
  /**
   * A fee's amount for a state, or null when it cannot be worked out from what the table and the facts give: a fee on the
   * amount offered of an Indefinite offering, or any amount of an offering in another currency.
   */
  function amount(fee, facts, code) {
    if (!fee || feeProblem(fee)) return null;
    if (fee.kind === 'fixed') return fee.cents;
    const by = (facts && facts.byState) || {};
    const base = fee.basis === 'offered' ? facts && facts.total : own(by, code) ? by[code].sold : 0;
    if (typeof base !== 'number' || !isFinite(base)) return null;
    if (fee.kind === 'tiered') {
      const tiers = fee.tiers.slice().sort((a, b) => (a.upTo === null ? 1 : b.upTo === null ? -1 : a.upTo - b.upTo));
      const t = tiers.find((x) => x.upTo === null || base <= x.upTo);
      return t ? t.cents : null;
    }
    let c = Math.round(base * 100 * fee.rate);
    if (isCents(fee.minCents)) c = Math.max(c, fee.minCents);
    if (isCents(fee.maxCents)) c = Math.min(c, fee.maxCents);
    return c;
  }
  function fees(data, states, facts, opts) {
    const renewal = !!(opts && opts.renewal);
    const table = (data && data.table) || {};
    const lines = [];
    const none = [];
    (states || []).forEach((code) => {
      const row = trusted(table[code]);
      if (row && row.noticeRequired === false) return none.push(code);
      const fee = renewal ? row && row.renewal && row.renewal.fee : row && row.fee;
      lines.push({ label: `State filing fee, ${(table[code] && table[code].name) || nameOf(code)}`, cents: row ? amount(fee, facts, code) : null, passThrough: true, state: code });
    });
    const sys = data && data.systemFee && trusted(data.systemFee) && isCents(data.systemFee.cents) ? data.systemFee : null;
    // The filing system's fee is charged on the first notice; a renewal carries it only where the table says so.
    if (lines.length && (!renewal || (sys && sys.appliesTo === 'all'))) lines.push({ label: 'Filing system fee', cents: sys ? sys.cents : null, passThrough: true });
    return { lines, none, open: lines.some((l) => l.cents === null) };
  }
  /** The latest Form D notice on file (D or D/A, accepted, with its date). */
  function latestNotice(r) {
    const list = ((r && r.formD) || []).filter((n) => n && n.status === 'accepted' && isDay(n.filedOn));
    return list.length ? list.reduce((a, b) => (b.filedOn >= a.filedOn ? b : a)) : null;
  }
  const stored = (ws, id) => (ws && ws.filings && ws.filings.offerings && own(ws.filings.offerings, id) && ws.filings.offerings[id]) || {};
  function pack(ws, o, states) {
    const f = NS.filings.facts(ws, o);
    const r = stored(ws, o.id);
    const n = latestNotice(r);
    const e = r.edgar || {};
    // The person staff contact about the order: the admin signed in, else the firm's first active admin.
    const team = (ws && ws.team) || [];
    const me = team.find((m) => m && m.role === 'admin' && m.current) || team.find((m) => m && m.role === 'admin' && m.status !== 'invited') || {};
    const sup = (ws && ws.tenant && ws.tenant.support) || {};
    return {
      issuer: { name: String(e.name || o.name || ''), cik: String(e.cik || '') },
      accession: n ? String(n.accession || '') : '',
      filedOn: n ? n.filedOn : '',
      offered: f.total,
      states: (states || []).map((code) => {
        const s = own(f.byState, code) ? f.byState[code] : null;
        return { code, name: nameOf(code), firstSale: s ? s.firstSale : '', sold: s ? s.sold : 0, investors: s ? s.investors : 0 };
      }),
      // With no team list on record (a workspace never opened at Team), the firm's own support contact.
      contact: me.name ? { name: String(me.name), email: String(me.email || sup.email || ''), phone: String(me.phone || sup.phone || '') } : { name: String(sup.team || (ws && ws.tenant && ws.tenant.shortName) || ''), email: String(sup.email || ''), phone: String(sup.phone || '') }
    };
  }

  const API = { problems, pick, fees, pack, latestNotice };
  if (NS) NS.bluesky = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;

  /* ---------- The section of the Filings tab ---------- */
  if (!NS || !NS.filingsUI) return;
  const U = NS.ui;
  const { h, date } = U;
  const FL = () => NS.filings;
  const W = () => NS.state.ws;
  const money = (cents) => NS.eligibility.usd(cents);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const offeringOf = (ws, id) => (ws.offerings || []).find((x) => x && x.id === id) || null;
  const DATA = () => NS.blueskyData || { table: {}, systemFee: {} };
  const redraw = () => NS.app.render();
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;
  /** What is chosen on the page, per offering, kept across redraws and never stored: states un-ticked, states added. */
  function ui(id) {
    const u = NS.state.ui;
    if (!u.bs) u.bs = {};
    if (!u.bs[id]) u.bs[id] = { off: {}, added: [] };
    return u.bs[id];
  }
  /** A state already ordered or filed is shown with its result, not in the picker. */
  const done = (s) => !!(s && (s.filedOn || s.status === 'ordered'));
  /** The states the picker lists: the states of the sales and those added by hand, less those ordered or filed. */
  function candidates(ws, o, f) {
    const r = stored(ws, o.id);
    const table = DATA().table;
    const u = ui(o.id);
    const list = pick(f).concat(u.added.filter((c) => pick(f).indexOf(c) < 0));
    return list.filter((c) => own(table, c) && !done((r.states || {})[c])).sort();
  }
  const ticked = (ws, o, f) => candidates(ws, o, f).filter((c) => !ui(o.id).off[c]);

  function pickerHTML(ws, o, f) {
    const list = candidates(ws, o, f);
    const u = ui(o.id);
    const table = DATA().table;
    const rows = list
      .map((c) => {
        const s = own(f.byState, c) ? f.byState[c] : null;
        const detail = s && s.firstSale ? `First sale ${date(s.firstSale)} · ${plural(s.investors, 'investor')}` : 'No sale on record';
        return `<li class="fl-row" data-state="${h(c)}"><label class="fl-what"><span class="fl-title"><input type="checkbox" name="state" value="${h(c)}" data-change="bs-tick" data-id="${h(o.id)}"${u.off[c] ? '' : ' checked'}> ${h(table[c].name)}</span><span class="fl-detail">${detail}</span></label></li>`;
      })
      .join('');
    const r = stored(ws, o.id);
    const rest = Object.keys(table).filter((c) => list.indexOf(c) < 0 && !done((r.states || {})[c]));
    const add = rest.length ? `<label class="cs-field">Add a state<select name="add" data-change="bs-add" data-id="${h(o.id)}"><option value="">Choose a state</option>${rest.map((c) => `<option value="${h(c)}">${h(table[c].name)}</option>`).join('')}</select></label>` : '';
    return `${rows ? `<ul class="fl-list" data-picker>${rows}</ul>` : ''}<div class="fl-form">${add}</div>`;
  }
  function feesHTML(ws, o, f, codes) {
    const q = fees(DATA(), codes, f);
    const service = FL().orderLines('bluesky').lines[0];
    const known = q.lines.reduce((a, l) => a + (l.cents || 0), 0);
    return `<div class="fl-fees" data-fees>
        <div><span>${h(service.label)}</span><span>${money(service.cents)}</span></div>
        ${q.lines.map((l) => `<div><span>${h(l.label)}</span><span>${l.cents == null ? 'To be confirmed' : money(l.cents)}</span></div>`).join('')}
        <div class="fl-total"><span>Due</span><span class="fl-due">${money(service.cents + known)}${q.open ? ', fees to be confirmed' : ''}</span></div>
      </div>
      ${q.open ? '<p class="fl-note" data-fees-note>State fees and the filing system’s fee are confirmed when the order is reviewed.</p>' : ''}
      ${known && DATA().asOf ? `<p class="cs-muted">State fees as of ${date(DATA().asOf)}</p>` : ''}`;
  }
  /** The Form D the notices are filed from; with none on record (or none with its number), the form that records it. */
  function formDHTML(ws, o) {
    const n = latestNotice(stored(ws, o.id));
    if (n && n.accession) return `<p class="cs-muted" data-formd>Form D filed on ${date(n.filedOn)}, accession number ${h(n.accession)}</p>`;
    const u = ui(o.id);
    const v = u.formD || {};
    return `<p class="fl-note" data-formd>State notices are filed from the filed Form D. Enter the date and accession number of the notice you filed.</p>
      <form class="fl-form" data-form="bs-formd" data-id="${h(o.id)}" novalidate>
        <label class="cs-field">Filed on<input type="date" name="filedOn" value="${h(v.filedOn != null ? v.filedOn : (n && n.filedOn) || '')}" max="${NS.dates.today()}"></label>
        <label class="cs-field">Accession number<input type="text" name="accession" value="${h(v.accession || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <p class="field-error" role="alert">${v.error ? h(v.error) : ''}</p>
        <div class="fl-acts"><button class="cs-btn cs-btn-small cs-btn-primary" type="submit">Save</button></div>
      </form>`;
  }
  /** Investors whose state cannot be told from the address on file: said in one line, never ticked for them. */
  function unplacedHTML(f) {
    const n = f.unplaced ? f.unplaced.investors : 0;
    return n ? `<p class="fl-note" data-unplaced>${plural(n, 'investor')} with no state on file: their state is not ticked. <a href="#console-investors">Investors</a></p>` : '';
  }
  /** One state ordered or filed: its status, and once filed its date and filing ID. */
  function doneHTML(ws, o) {
    const r = stored(ws, o.id);
    const codes = Object.keys(r.states || {})
      .filter((c) => done(r.states[c]))
      .sort();
    if (!codes.length) return '';
    return `<h3>Ordered and filed</h3><ul class="fl-list" data-done>${codes
      .map((c) => {
        const s = r.states[c];
        const what = s.filedOn ? `Filed ${date(s.filedOn)}${s.efdId ? ` · ID ${h(s.efdId)}` : ''}` : 'Ordered';
        return `<li class="fl-row" data-state="${h(c)}"><div class="fl-what"><span class="fl-title">${h(nameOf(c))}</span><span class="fl-detail">${what}</span></div></li>`;
      })
      .join('')}</ul>`;
  }
  /** What staff file from, as the order recorded it. */
  function packHTML(p) {
    if (!p) return '';
    const row = (k, v) => `<dt>${h(k)}</dt><dd>${v}</dd>`;
    const offered = p.offered === 'Indefinite' ? 'Indefinite' : typeof p.offered === 'number' ? money(p.offered * 100) : '';
    return `<dl class="fl-review" data-pack>
        ${row('Issuer', h(p.issuer && p.issuer.name))}
        ${p.issuer && p.issuer.cik ? row('CIK', h(p.issuer.cik)) : ''}
        ${row('Form D', `${p.filedOn ? `Filed ${date(p.filedOn)}, ` : ''}accession number ${h(p.accession || '')}`)}
        ${offered ? row('Amount offered', offered) : ''}
        ${(p.states || []).map((s) => row(s.name || nameOf(s.code), s.firstSale ? `First sale ${date(s.firstSale)} · ${s.sold == null ? '' : `${money(s.sold * 100)} sold · `}${plural(s.investors, 'investor')}` : 'No sale on record')).join('')}
        ${p.contact && p.contact.name ? row('Contact', [p.contact.name, p.contact.email, p.contact.phone].filter(Boolean).map(h).join(' · ')) : ''}
      </dl>`;
  }
  const ORDER = { recorded: 'Recorded', received: 'Received', filed: 'Filed', done: 'Done' };
  function ordersHTML(ws, o) {
    const list = ((ws.filings && ws.filings.orders) || []).filter((x) => x && x.offeringId === o.id && (x.kind === 'bluesky' || x.kind === 'bluesky-renewal') && x.status !== 'cancelled');
    if (!list.length) return '';
    return `<div class="fl-orders"><h3>Orders</h3>${list
      .map(
        (x) => `<div class="fl-order" data-order="${h(x.id)}">
          <div class="fl-fees">
            ${(x.lines || []).map((l) => `<div><span>${h(l.label)}</span><span>${l.cents == null ? 'To be confirmed' : money(l.cents)}</span></div>`).join('')}
            <div class="fl-total"><span>${h(ORDER[x.status] || x.status)} · ${date(String(x.at || '').slice(0, 10))}</span><span class="fl-due">${money(x.dueCents)} due${x.openFees ? ', fees to be confirmed' : ''}</span></div>
          </div>
          ${packHTML(x.package)}
        </div>`
      )
      .join('')}</div>`;
  }
  function render(ws, o) {
    const f = FL().facts(ws, o);
    const n = latestNotice(stored(ws, o.id));
    const codes = ticked(ws, o, f);
    const canOrder = NS.app.can('configure') && n && n.accession;
    return `${unplacedHTML(f)}
      ${formDHTML(ws, o)}
      ${pickerHTML(ws, o, f)}
      ${codes.length ? feesHTML(ws, o, f, codes) : ''}
      ${canOrder && codes.length ? `<div class="fl-acts">${btn('bs-order', `Order state filings (${plural(codes.length, 'state')})`, ` data-id="${h(o.id)}"`, 'cs-btn-primary')}</div>` : ''}
      ${doneHTML(ws, o)}
      ${ordersHTML(ws, o)}`;
  }
  function summary(ws, o) {
    const f = FL().facts(ws, o);
    if (!f.firstSale) return '';
    const r = stored(ws, o.id);
    const states = r.states || {};
    const ordered = Object.keys(states).filter((c) => states[c] && !states[c].filedOn && states[c].status === 'ordered').length;
    const filed = Object.keys(states).filter((c) => states[c] && states[c].filedOn).length;
    return [plural(pick(f).length, 'state') + ' with sales'].concat(ordered ? [`${ordered} ordered`] : [], filed ? [`${filed} filed`] : []).join(' · ');
  }

  /* ---------- Actions ---------- */
  NS.changes['bs-tick'] = (el) => {
    const u = ui(el.getAttribute('data-id'));
    if (el.checked) delete u.off[el.value];
    else u.off[el.value] = true;
    redraw();
  };
  NS.changes['bs-add'] = (el) => {
    const code = el.value;
    if (!own(DATA().table, code)) return;
    const u = ui(el.getAttribute('data-id'));
    if (u.added.indexOf(code) < 0) u.added.push(code);
    delete u.off[code];
    redraw();
  };
  NS.forms['bs-formd'] = (form) => {
    const ws = W();
    const o = offeringOf(ws, form.getAttribute('data-id'));
    if (!o) return;
    const u = ui(o.id);
    const filedOn = String(form.elements.filedOn.value || '').trim();
    const accession = String(form.elements.accession.value || '').trim();
    const today = NS.dates.today();
    let error = '';
    if (!isDay(filedOn)) error = 'Enter the date the notice was filed.';
    else if (filedOn > today) error = 'The date cannot be after today.';
    else if (!/^\d{10}-\d{2}-\d{6}$/.test(accession)) error = 'An accession number has 18 digits, written as 10, 2 and 6 with hyphens between.';
    if (error) {
      u.formD = { filedOn, accession, error };
      return redraw();
    }
    // A notice already on record without its number is completed; otherwise the sponsor's own notice is recorded.
    const n = latestNotice(stored(ws, o.id));
    const saved = n ? FL().recordFiled(ws, o.id, { id: n.id, type: n.type, filedOn, accession }) : FL().recordFiled(ws, o.id, { type: 'D', filedOn, accession, source: 'self' });
    if (!saved) {
      u.formD = { filedOn, accession, error: 'The notice could not be recorded.' };
      return redraw();
    }
    u.formD = null;
    NS.consoleKit.audit(n ? 'Form D accession number recorded' : 'Form D notice recorded as filed', `${o.name}: filed on ${date(filedOn)}, accession number ${accession}`, o.id);
    NS.app.save(true);
    redraw();
  };
  NS.actions['bs-order'] = (el) => {
    if (!NS.app.can('configure')) return;
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    const f = FL().facts(ws, o);
    const n = latestNotice(stored(ws, o.id));
    const codes = ticked(ws, o, f);
    if (!codes.length || !n || !n.accession) return;
    const q = fees(DATA(), codes, f);
    const quoted = {};
    q.lines.forEach((l) => l.state && (quoted[l.state] = l.cents));
    const p = pack(ws, o, codes.filter((c) => q.none.indexOf(c) < 0));
    p.states.forEach((s) => (s.quotedCents = own(quoted, s.code) ? quoted[s.code] : null));
    // The pass-through lines carry no amount until what was paid is recorded; the quoted fee is kept per state.
    const order = FL().addOrder(ws, { kind: 'bluesky', offeringId: o.id, by: NS.app.actor(), passThrough: q.lines.map((l) => Object.assign({ label: l.label, cents: null }, l.state ? { state: l.state } : {})), package: p });
    if (!order) return;
    p.states.forEach((s) => FL().recordState(ws, o.id, s.code, { status: 'ordered', quotedCents: s.quotedCents, source: 'portal' }));
    NS.state.ui.bs[o.id] = { off: {}, added: [] };
    NS.app.save(true);
    redraw();
  };

  NS.filingsUI.part('states', { order: 30, title: 'State filings', summary, render });
  NS.filingsUI.refresh();
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
