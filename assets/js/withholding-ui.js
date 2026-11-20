/*
 * Tax withheld at a distribution (plan 10-07, D-04, C-03, TAX-07, TAX-14), self-serve edition only: the managed edition
 * does not load this file, and every screen behaves exactly as before without it.
 *
 * On the new-distribution screen it draws what NS.withholding (withholding.js) proposes and records the person's decision
 * on each line; it works out no amount itself. The portal proposes backup withholding (offerings set to notes or to a
 * corporation or REIT) and, for a foreign investor, 30% of the amount the sponsor enters (or the rate the CPA gave); the four
 * kinds only a CPA can work out are entered as a figure with a reason, under their one stop sentence. Nothing is withheld
 * until a person confirms a line, and the ACH file and the record wait while any line is neither confirmed nor removed.
 * Only confirmed lines leave this file (withheld(draft)), in the shape NS.data.buildLines takes, so one set of lines gives
 * the table, the file's entries and the stored record.
 *
 * The decisions live on the console's draft (draft.wh) and are never stored on their own: the record stores each confirmed
 * line with who and when. console.js calls reset(draft) when the offering, the date or the amount changes, because the
 * amounts the lines were confirmed for have changed.
 *
 * It also gives the offering page its Tax reporting field, the investor's tax record its "W-9 signed on paper" action
 * (plan-check D2, C-10: a W-9 the portal did not sign, recorded as signed by the sponsor, with who and when, logged and
 * changeable), and the investor's Distributions page one line under its headline, "Tax withheld $X", when any is withheld.
 *
 * NS.withholdingUI:
 *   block(ws, offering, draft, lines) -> html    the tax withheld block under the allocation table ('' with no lines)
 *   withheld(draft) -> { [investorId]: [ w ] }   the confirmed lines of this draft
 *   blocked(ws, offering, draft, lines) -> ''    or one line saying why the file and the record wait
 *   reset(draft)                                  drops every decision
 *   reportingField(ws, offering) -> html         the Tax reporting field (a select for an admin, the label for a team member)
 *   paperLine(ws, investor) -> html              the paper-signature line and action of the investor's tax record
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
  const admin = () => NS.app.can('configure');
  const nowIso = () => new Date().toISOString();
  const log = (e) => NS.audit && NS.audit.log(W(), e);
  const STOP_KINDS = ['partnership', 'real-property', 'fatca', 'state'];

  /* ---------- the draft's lines and decisions ---------- */
  const norm = (lines) =>
    (lines || [])
      .map((r) => ({ investorId: r.investorId || (r.investor && r.investor.id) || '', grossCents: r.grossCents != null ? r.grossCents : r.cents }))
      .filter((l) => l.investorId && Number.isInteger(l.grossCents) && l.grossCents > 0);
  /** The decisions and entries on a draft (kept on it, never stored on their own). */
  function state(d) {
    if (!d.wh) d.wh = { dec: {}, lines: [], offeringId: '', fx: {}, entered: [], seq: 0, add: null };
    return d.wh;
  }
  const keyOf = (x) => [x.kind, x.investorId, x.cents, x.ratePct == null ? '' : x.ratePct].concat(x.n ? [x.n] : []).join(':');
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  /** "1,666.67" or "$1666.67" as whole cents; NaN when it is not dollars and cents. */
  function toCents(s) {
    const t = String(s == null ? '' : s).replace(/[$,\s]/g, '');
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
    return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : NaN;
  }
  /** The investors of the draft that the foreign rule asks about: a foreign investor's W-8 facts on the payment date. */
  function foreigners(ws, d, L) {
    return L.map((l) => ({ line: l, inv: investorOf(ws, l.investorId) }))
      .filter((x) => x.inv && x.inv.type !== 'ira')
      .map((x) => Object.assign(x, { facts: WH().w8(x.inv, d.date) }))
      .filter((x) => x.facts.foreign);
  }
  /** The foreign line for one investor from what the sponsor entered, or { err } when it is refused, or null. */
  function foreignOf(st, line) {
    const f = st.fx[line.investorId];
    if (!f || !f.subject) return null;
    const cents = toCents(f.subject);
    if (!Number.isInteger(cents)) return { err: 'Enter the amount in dollars and cents.' };
    if (f.rate !== '' && !/^\d+(\.\d{1,4})?$/.test(f.rate)) return { err: 'Enter the rate as a number from 0 to 100.' };
    try {
      return WH().foreignDraft(line, { subjectCents: cents, ratePct: f.rate === '' ? null : Number(f.rate) });
    } catch (e) {
      return { err: String((e && e.message) || e) };
    }
  }
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
      foreigners(ws, d, L).forEach((x) => {
        const f = foreignOf(st, x.line);
        if (f && !f.err) out.push(f);
      });
      st.entered.forEach((x) => {
        if (L.some((l) => l.investorId === x.investorId)) out.push(Object.assign({}, x));
      });
    }
    return out.map((x) => {
      const key = keyOf(x);
      const dec = st.dec[key];
      return Object.assign(x, { key, decided: dec ? dec.state : '' });
    });
  }
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
  const dateOf = (iso) => (iso ? U.date(iso) : '');
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;
  function rowHTML(ws, x, grossOf) {
    const inv = investorOf(ws, x.investorId);
    const name = inv ? inv.title : x.investorId;
    const how = x.ratePct == null ? `${usdc(x.cents)} entered` : `${pct(x.ratePct)}${x.source === 'entered' ? ' (rate from your CPA)' : ''} of ${usdc(x.basisCents)} · ${usdc(x.cents)}`;
    const pill = x.decided === 'confirmed' ? '<span class="tx-pill is-ok">Confirmed</span>' : x.decided === 'removed' ? '<span class="tx-pill is-off">Removed</span>' : '<span class="tx-pill is-wait">Proposed</span>';
    const acts = x.decided ? '' : `${btn('wh-confirm', 'Confirm', ` data-key="${h(x.key)}"`, 'cs-btn-primary')}${btn('wh-remove', 'Remove', ` data-key="${h(x.key)}"`)}`;
    return `<li class="tx-row" data-wh="${h(x.key)}" data-investor="${h(x.investorId)}" data-kind="${h(x.kind)}">
      <div class="tx-what"><span class="tx-title">${h(name)} · ${h(x.investorId)}</span><span class="tx-detail">${h(kindLabel(x.kind))} · ${h(how)}${grossOf[x.investorId] ? ` · payment ${usdc(grossOf[x.investorId])}` : ''}</span><span class="tx-detail">${h(x.why || '')}</span></div>
      <div class="tx-when">${pill}</div>
      <div class="tx-acts">${acts}</div>
    </li>`;
  }
  /** What the W-8 on file says on the payment date, in a few words. */
  function w8Words(facts) {
    const form = facts.form && /^W-8/.test(facts.form) ? facts.form : '';
    if (!form) return 'No W-8 on file';
    const head = !facts.signed ? `${form} not signed` : facts.valid ? `${form} valid until ${dateOf(facts.validUntil)}` : facts.validUntil ? `${form} expired after ${dateOf(facts.validUntil)}` : `${form} with no date it is valid until`;
    return facts.flags.indexOf('no foreign tax number') >= 0 ? `${head} · no foreign tax number on file` : head;
  }
  function foreignRowHTML(st, x, n) {
    const f = st.fx[x.inv.id] || { subject: '', rate: '' };
    const got = foreignOf(st, x.line);
    const id = (k) => `wh-fx-${k}-${n}`;
    return `<li class="tx-row" data-wh-fx="${h(x.inv.id)}">
      <div class="tx-what"><span class="tx-title">${h(x.inv.title)} · ${h(x.inv.id)}</span><span class="tx-detail">${h(w8Words(x.facts))} · payment ${usdc(x.line.grossCents)}</span>${got && got.err ? `<span class="cs-error">${h(got.err)}</span>` : ''}</div>
      <div class="tx-form">
        <label class="cs-field" for="${id('s')}"><span>Amount subject to withholding ($)</span><input id="${id('s')}" type="text" inputmode="decimal" data-wh-fx-subject="${h(x.inv.id)}" data-change="wh-fx" value="${h(f.subject)}"></label>
        <label class="cs-field" for="${id('r')}"><span>Rate from your CPA (%)</span><input id="${id('r')}" type="text" inputmode="decimal" data-wh-fx-rate="${h(x.inv.id)}" data-change="wh-fx" value="${h(f.rate)}"></label>
      </div>
    </li>`;
  }
  function addHTML(ws, st, L) {
    if (!st.add) return `<div class="cs-row">${btn('wh-add-open', 'Add tax withheld')}</div>`;
    const a = st.add;
    const kinds = STOP_KINDS.map((k) => `<option value="${k}"${a.kind === k ? ' selected' : ''}>${h(kindLabel(k))}</option>`).join('');
    const who = L.map((l) => {
      const inv = investorOf(ws, l.investorId);
      return `<option value="${h(l.investorId)}"${a.investorId === l.investorId ? ' selected' : ''}>${h(inv ? inv.title : l.investorId)} · ${h(l.investorId)}</option>`;
    }).join('');
    return `<div class="wh-add">
      <div class="tx-form"><label class="cs-field" for="wh-add-kind"><span>Kind</span><select id="wh-add-kind" data-change="wh-add-kind"><option value="">Choose</option>${kinds}</select></label></div>
      ${a.kind ? `<p class="tx-stop">${h(WH().STOPS[a.kind])}</p>
      <div class="tx-form">
        <label class="cs-field" for="wh-add-investor"><span>Investor</span><select id="wh-add-investor"><option value="">Choose</option>${who}</select></label>
        <label class="cs-field" for="wh-add-amount"><span>Amount ($)</span><input id="wh-add-amount" type="text" inputmode="decimal" value="${h(a.amount)}"></label>
        <label class="cs-field cs-wide" for="wh-add-why"><span>Reason</span><input id="wh-add-why" type="text" maxlength="200" value="${h(a.why)}"></label>
      </div>` : ''}
      ${a.err ? `<p class="cs-error">${h(a.err)}</p>` : ''}
      <div class="cs-row">${a.kind ? btn('wh-add', 'Add', '', 'cs-btn-primary') : ''}${btn('wh-add-close', 'Close')}</div>
    </div>`;
  }
  function block(ws, offering, d, lines) {
    const L = norm(lines);
    if (!d || !offering || !L.length) return '';
    const st = state(d);
    st.lines = L;
    st.offeringId = offering.id;
    const list = drafts(ws, offering, d, L);
    const fx = foreigners(ws, d, L);
    const grossOf = {};
    L.forEach((l) => (grossOf[l.investorId] = l.grossCents));
    return `<div class="tx wh"><h3>Tax withheld</h3>
      ${list.length ? `<ul class="tx-list">${list.map((x) => rowHTML(ws, x, grossOf)).join('')}</ul>` : ''}
      ${fx.length ? `<ul class="tx-list">${fx.map((x, n) => foreignRowHTML(st, x, n)).join('')}</ul>` : ''}
      ${addHTML(ws, st, L)}
    </div>`;
  }

  /* ---------- the person's decisions ---------- */
  const consoleDraft = () => NS.state.ui.dist || null;
  /** Draw the page again; a field of the block that had focus (by its attribute) gets it back. */
  function redraw() {
    setTimeout(() => {
      const a = document.activeElement;
      const keep = a && a.closest && a.closest('#ds-tax') && a.id ? a.id : '';
      NS.app.render();
      const el = keep && document.getElementById(keep);
      if (el) el.focus();
    }, 0);
  }
  /** An ACH file built before a decision paid other amounts. */
  const dropFile = (d) => {
    d.file = null;
    d.line = null;
  };
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
    dropFile(d);
    NS.app.render();
  }
  NS.actions['wh-confirm'] = (el) => decide(el, 'confirm');
  NS.actions['wh-remove'] = (el) => decide(el, 'remove');
  // A foreign investor's amount or rate: the line for it is worked out again and any decision on it goes.
  NS.changes['wh-fx'] = (el) => {
    const d = consoleDraft();
    if (!d) return;
    const st = state(d);
    const id = el.getAttribute('data-wh-fx-subject') || el.getAttribute('data-wh-fx-rate');
    const f = (st.fx[id] = st.fx[id] || { subject: '', rate: '' });
    f[el.hasAttribute('data-wh-fx-subject') ? 'subject' : 'rate'] = String(el.value || '').trim();
    Object.keys(st.dec).forEach((k) => {
      if (k.indexOf(`foreign:${id}:`) === 0) delete st.dec[k];
    });
    dropFile(d);
    redraw();
  };
  /** The add form's typed values, kept across a redraw. */
  function keepAdd(st) {
    const v = (id) => (document.getElementById(id) || {}).value;
    if (!st.add) return;
    ['investorId:wh-add-investor', 'amount:wh-add-amount', 'why:wh-add-why'].forEach((p) => {
      const [k, id] = p.split(':');
      const x = v(id);
      if (x != null) st.add[k] = String(x);
    });
  }
  NS.actions['wh-add-open'] = () => {
    const d = consoleDraft();
    if (!d) return;
    state(d).add = { kind: '', investorId: '', amount: '', why: '', err: '' };
    NS.app.render();
    const el = document.getElementById('wh-add-kind');
    if (el) el.focus();
  };
  NS.actions['wh-add-close'] = () => {
    const d = consoleDraft();
    if (d) state(d).add = null;
    NS.app.render();
  };
  NS.changes['wh-add-kind'] = (el) => {
    const d = consoleDraft();
    if (!d) return;
    const st = state(d);
    keepAdd(st);
    st.add.kind = STOP_KINDS.indexOf(el.value) >= 0 ? el.value : '';
    st.add.err = '';
    NS.app.render();
    const k = document.getElementById('wh-add-kind');
    if (k) k.focus();
  };
  NS.actions['wh-add'] = () => {
    const d = consoleDraft();
    if (!d) return;
    const st = state(d);
    keepAdd(st);
    const a = st.add;
    const line = st.lines.find((l) => l.investorId === a.investorId);
    const cents = toCents(a.amount);
    let x = null;
    try {
      if (!line) throw new Error('Choose the investor.');
      if (!Number.isInteger(cents)) throw new Error('Enter the amount in dollars and cents.');
      x = WH().enteredDraft(a.kind, { investorId: line.investorId, grossCents: line.grossCents, basisCents: line.grossCents, cents, why: a.why });
    } catch (e) {
      a.err = String((e && e.message) || e);
      return NS.app.render();
    }
    st.seq += 1;
    st.entered.push(Object.assign(x, { n: st.seq }));
    st.add = null;
    dropFile(d);
    NS.app.render();
  };

  /* ---------- the offering's tax reporting (TAX-07) ---------- */
  function reportingField(ws, o) {
    const cur = WH().reporting(o);
    const R = WH().REPORTING;
    if (!admin()) return `<dl class="cs-kv"><div><dt>Tax reporting</dt><dd>${h(cur ? R[cur].label : 'Not set')}</dd></div></dl>`;
    const opts = Object.keys(R).map((k) => `<option value="${k}"${cur === k ? ' selected' : ''}>${h(R[k].label)}</option>`).join('');
    return `<label class="cs-field" for="of-tax-reporting"><span>Tax reporting</span><select id="of-tax-reporting" data-change="wh-reporting" data-id="${h(o.id)}">${cur ? '' : '<option value="" selected>Not set</option>'}${opts}</select></label>`;
  }
  NS.changes['wh-reporting'] = (el) => {
    if (!admin()) return U.toast('Only admins can change this. Ask an admin on your team.');
    try {
      WH().setReporting(W(), el.getAttribute('data-id'), el.value, { by: actor() });
    } catch (e) {
      return U.toast(String((e && e.message) || e));
    }
    NS.app.save(true);
    NS.app.render();
    const s = document.getElementById('of-tax-reporting');
    if (s) s.focus();
  };

  /* ---------- a W-9 signed on paper (plan-check D2, C-10) ---------- */
  const cert = (i) => (i && i.taxCert && typeof i.taxCert === 'object' ? i.taxCert : null);
  const last4 = (i) => /^\d{4}$/.test(String((cert(i) || {}).tinLast4 || i.tinLast4 || ''));
  /**
   * A W-9 on record with the last four that the portal holds no signature record for, and that it did not ask to be signed;
   * never for an IRA or a payee marked exempt, for whom backup withholding is never proposed (withholding.js payee).
   */
  const paperable = (i) => i.type !== 'ira' && !i.exempt1099 && i.taxForm === 'W-9' && last4(i) && (cert(i) || {}).signed !== true && !(cert(i) || {}).envelopeId;
  function paperLine(ws, i) {
    const c = cert(i);
    if (c && c.source === 'paper' && c.signed === true) {
      const p = c.paper || {};
      return `<span class="sub">W-9 signed on paper${p.by ? `, recorded by ${h(p.by)}${p.at ? ` on ${h(dateOf(String(p.at).slice(0, 10)))}` : ''}` : ''}${admin() ? ` · <button class="link-btn" type="button" data-action="wh-paper-undo" data-id="${h(i.id)}">Undo</button>` : ''}</span>`;
    }
    return admin() && paperable(i) ? `<span class="sub"><button class="link-btn" type="button" data-action="wh-paper" data-id="${h(i.id)}">W-9 signed on paper</button></span>` : '';
  }
  NS.actions['wh-paper'] = (el) => {
    if (!admin()) return U.toast('Only admins can change this. Ask an admin on your team.');
    const i = investorOf(W(), el.getAttribute('data-id'));
    if (!i || !paperable(i)) return NS.app.render();
    const by = actor();
    i.taxCert = Object.assign({}, cert(i) || {}, { signed: true, source: 'paper', paper: { by, at: nowIso() } });
    log({ action: 'W-9 recorded as signed on paper', record: i.id, detail: `${i.title} (${i.id})`, actor: by });
    NS.app.save(true);
    NS.app.render();
  };
  NS.actions['wh-paper-undo'] = (el) => {
    if (!admin()) return U.toast('Only admins can change this. Ask an admin on your team.');
    const i = investorOf(W(), el.getAttribute('data-id'));
    const c = i && cert(i);
    if (!c || c.source !== 'paper') return NS.app.render();
    ['signed', 'source', 'paper'].forEach((k) => delete c[k]);
    if (!Object.keys(c).length) delete i.taxCert;
    log({ action: 'W-9 paper signature removed', record: i.id, detail: `${i.title} (${i.id})`, actor: actor() });
    NS.app.save(true);
    NS.app.render();
  };

  /* ---------- the investor's Distributions page: tax withheld under the headline (plan-check D3) ---------- */
  const dv = NS.views && NS.views.distributions;
  if (dv) {
    const before = dv.after;
    dv.after = function () {
      if (before) before.apply(this, arguments);
      const inv = NS.portalKit && NS.portalKit.viewer();
      const v = inv && NS.investorView ? NS.investorView(W(), inv.id) : null;
      const cents = v ? v.payments.filter((p) => p.status === 'paid').reduce((a, p) => a + (p.withheldCents || 0), 0) : 0;
      if (!(cents > 0)) return;
      const dt = Array.from(document.querySelectorAll('#view .figs dt')).find((x) => x.textContent.trim() === 'Total received');
      if (dt && dt.parentElement) dt.parentElement.insertAdjacentHTML('beforeend', `<span>Tax withheld ${h(usdc(cents))}</span>`);
    };
  }

  NS.withholdingUI = { block, withheld, blocked, reset, reportingField, paperLine };

  // Loaded after the page was first drawn (taxdocs-ui.js adds this file): draw the screens that use it again.
  const typing = () => {
    const a = document.activeElement;
    return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
  };
  if (NS.state && NS.state.ws && /^(console-distributions|console-offering|console-investors|distributions)$/.test(String(NS.state.route || '').replace(/^console-offering-.+$/, 'console-offering')) && !typing()) NS.app.render();
})(window.CVPortal);
