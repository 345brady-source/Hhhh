/*
 * Accounting page (self-serve console, D-01, FA-12): the books' only manual inputs, one door each. Journal entries
 * (accruals, corrections and anything the bank does not show) added and reversed; investments with their cost and value,
 * and a value entered at a date; opening balances once, for a fund that existed before its books started here; closing a
 * month and reopening it. Statements, trial balance, ledger and reconciliation stay on the Audit page.
 *
 * Every figure comes from the ledger (NS.books: books.js, books-post.js, books-hold.js); this page computes none of its
 * own beyond adding up what is typed so far ("Off by"). It brings the books up to date from the records once per drawing
 * (NS.books.sync) before reading them, so the record entries are always there; when that fails one line says so and the
 * rest is still drawn. Roles: a team member adds and reverses entries, investments and values; only an owner enters
 * opening balances, closes and reopens (books-hold.js refuses too); investors never open the page. Each action writes the
 * change log and saves. Money is typed as dollars and read digit by digit into whole cents; anything else is refused with
 * one line. Values from the workspace are escaped. No network call is made on any path. The managed edition does not load
 * this file.
 *
 * Sections later plans add are their own scripts beside this one, registered with NS.booksUI.part(key, { order, title,
 * line, render(ws, offering) -> html }) and drawn above Entries in their order, each with its title and its one line.
 * The scripts are a fixed list (PARTS), each section listed only once its files ship, loaded in that order on the page's
 * first drawing; one that does not load is left out for the visit and nothing is shown for it. No file name comes from data or from the address.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const { h } = U;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const BK = () => NS.books;
  const ROUTE = 'console-books';
  const PAGE = 50;
  /** Accounts whose lines name an investor, and those whose lines name an investment. */
  const INVESTOR = ['3000', '3100', '3900', '2400'];
  const HOLDING = ['1100', '1150', '6000', '6100'];
  /** Of those, the ones a line cannot do without. */
  const NEEDS_INVESTOR = ['3000', '3100', '3900'];
  const NEEDS_HOLDING = ['1100', '1150'];
  const SOURCES = { call: 'Capital call', pos: 'Subscription', run: 'Distribution', req: 'Redemption', reqpaid: 'Redemption paid', fee: 'Management fee', gp: 'General partner', sim: 'Sample figures', bank: 'Bank', mark: 'Value', open: 'Opening balances', man: 'Entered here', rev: 'Reversal' };
  const actor = () => NS.app.actor();
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;

  /* ---------- money and dates ---------- */
  /** Typed dollars as whole cents: an optional $, digits (commas only in groups of three), and up to two decimals. */
  function cents(s) {
    const t = String(s == null ? '' : s).trim();
    if (!t) return { empty: true, cents: 0 };
    const m = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(t);
    if (!m) return { bad: true };
    const digits = m[1].replace(/,/g, '') + (m[2] || '').padEnd(2, '0');
    if (digits.replace(/^0+/, '').length > 15) return { bad: true };
    let c = 0;
    for (let i = 0; i < digits.length; i++) c = c * 10 + (digits.charCodeAt(i) - 48);
    return { cents: c, empty: c === 0 };
  }
  const BAD_AMOUNT = 'type the amount in dollars and cents, for example 2000.00.';
  /** Cents as dollars, by integer arithmetic only. */
  function usd(c) {
    const a = Math.abs(c);
    const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (c < 0 ? '−$' : '$') + whole + '.' + String(a % 100).padStart(2, '0');
  }
  const day = (iso) => (iso ? U.date(iso) : '');
  function shiftDay(iso, n) {
    const d = NS.dates.parse(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return NS.dates.isoOf(d);
  }
  /** Month-ends from the month of `from` through the last one on or before `to`, newest first. */
  function monthEnds(from, to) {
    const out = [];
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    for (let guard = 0; guard < 1200; guard++) {
      const end = NS.dates.isoOf(new Date(Date.UTC(y, m, 0)));
      if (end > to) break;
      out.push(end);
      m++;
      if (m > 12) (m = 1), y++;
    }
    return out.reverse();
  }
  /** A refusal from the ledger as one plain sentence. */
  function sentence(e) {
    if (e && e.code === 'closed') return `The books are closed through ${e.through}; reopen them to enter anything dated on or before that day.`;
    return String((e && e.message) || e || 'That could not be done.');
  }

  /* ---------- what is open on the page (kept across drawings, never stored) ---------- */
  function ui() {
    const u = S().ui;
    if (!u.bk) u.bk = { fund: '', show: PAGE, form: '', entry: null, inv: null, val: null, open: null, close: { through: '', why: '' }, err: {} };
    return u.bk;
  }
  const blankLine = () => ({ acct: '', inv: '', hold: '', dr: '', cr: '' });
  const chosenKey = 'books-fund';
  function fundOf(ws) {
    const u = ui();
    const has = (id) => !!id && ws.offerings.some((o) => o.id === id);
    if (!has(u.fund)) {
      const kept = (NS.store.get(chosenKey, {}) || {})[ws.tenant.id];
      u.fund = has(kept) ? kept : ws.offerings[0].id;
    }
    return ws.offerings.find((o) => o.id === u.fund);
  }
  function chooseFund(id) {
    const ws = W();
    if (!ws.offerings.some((o) => o.id === id)) return;
    const u = ui();
    Object.assign(u, { fund: id, show: PAGE, form: '', entry: null, inv: null, val: null, open: null, close: { through: '', why: '' }, err: {} });
    const all = Object.assign({}, NS.store.get(chosenKey, {}) || {});
    all[ws.tenant.id] = id;
    NS.store.set(chosenKey, all);
  }

  /* ---------- the fund's books, read ---------- */
  const fundBooks = (ws, id) => (ws.books && ws.books.funds && ws.books.funds[id]) || { journal: [], holdings: [], marks: [], closed: [] };
  const list = (f, k) => (f && Array.isArray(f[k]) ? f[k] : []);
  const holdersOf = (ws, id) => (ws.investors || []).filter((i) => (i.positions || []).some((p) => p && p.offeringId === id));
  const idNum = (id) => (/^je-\d+$/.test(id) ? Number(id.slice(3)) : 0);
  const srcKind = (src) => String(src || '').split(':')[0];
  const reversible = (src) => /^(man|bank):/.test(String(src || ''));

  /* ---------- sections other files add (NS.booksUI) ---------- */
  const HERE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  // A section is listed here only when its files ship, so no visit asks for a file that is not there. Plan 11-15 adds
  // bank: ['bankfiles.js', 'books-bank.js', 'books-bank-ui.js'] (the statement reader, the bank decisions, its screen).
  const PARTS = Object.freeze({});
  const parts = {};
  const load = { started: false, settled: false, waiting: false };
  function part(key, spec) {
    if (!/^[a-z][a-z0-9]*$/.test(String(key)) || !spec || typeof spec.render !== 'function') return false;
    parts[key] = { key, order: Number(spec.order) || 0, title: String(spec.title || ''), line: String(spec.line || ''), render: spec.render };
    return true;
  }
  /** One script from beside this file; resolves to whether it loaded. A script already on the page is not added again. */
  function script(name) {
    return new Promise((resolve) => {
      let src = '';
      try {
        src = HERE ? new URL(name, HERE).href : new URL(`assets/js/${name}`, document.baseURI).href;
      } catch (e) {
        return resolve(false);
      }
      if (Array.from(document.scripts).some((s) => s.src === src)) return resolve(true);
      const el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = () => resolve(true);
      el.onerror = () => {
        el.remove();
        resolve(false);
      };
      document.head.appendChild(el);
    });
  }
  function startParts() {
    if (load.started) return;
    load.started = true;
    (async () => {
      for (const k of Object.keys(PARTS)) for (const name of PARTS[k]) await script(name);
      load.settled = true;
      refresh();
    })();
  }
  const typing = () => {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest('.bk') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
  };
  /** Draw the page again (a section calls it after it registers or changes); never while a field on the page has focus. */
  function refresh() {
    if (S().route !== ROUTE) return;
    if (typing()) {
      load.waiting = true;
      return;
    }
    load.waiting = false;
    NS.app.render();
  }
  if (typeof document !== 'undefined')
    document.addEventListener('focusout', () => {
      if (load.waiting) setTimeout(refresh, 0);
    });
  function partsHTML(ws, o) {
    return Object.keys(parts)
      .map((k) => parts[k])
      .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1))
      .map((p) => {
        let body = '';
        try {
          body = p.render(ws, o) || '';
        } catch (e) {
          if (window.console) console.error(e);
          return '';
        }
        return section('part-' + p.key, h(p.title), p.line ? h(p.line) : '', body);
      })
      .join('');
  }

  /* ---------- drawing ---------- */
  function section(key, title, why, body, extra) {
    return `<section class="cs-panel bk-sec" data-bk="${key}"><div class="cs-panel-head"><h2>${title}</h2>${extra || ''}</div>${why ? `<p class="bk-why">${why}</p>` : ''}${body}</section>`;
  }
  const errLine = (k) => {
    const m = ui().err[k];
    return m ? `<p class="bk-err" role="alert">${h(m)}</p>` : '';
  };
  const field = (id, label, input, hint, attrs) => `<label class="cs-field" for="${id}"${attrs || ''}><span>${label}</span>${input}${hint ? `<span class="cs-hint">${hint}</span>` : ''}</label>`;
  const text = (id, bind, v, more) => `<input id="${id}" type="text" data-bind="bk:${bind}" value="${h(v == null ? '' : v)}"${more || ''}>`;
  const money = (id, bind, v) => text(id, bind, v, ' inputmode="decimal" autocomplete="off"');
  const dateIn = (id, bind, v) => `<input id="${id}" type="date" data-bind="bk:${bind}" value="${h(v || '')}">`;
  const select = (id, bind, opts, v, first) => `<select id="${id}" data-bind="bk:${bind}">${first ? `<option value="">${first}</option>` : ''}${opts.map(([val, label]) => `<option value="${h(val)}"${String(val) === String(v) ? ' selected' : ''}>${h(label)}</option>`).join('')}</select>`;

  /** The sum of what is typed so far: debits minus credits (minus capitals), over the amounts that can be read. */
  function offBy(form) {
    const u = ui();
    const d = form === 'open' ? u.open : u.entry;
    if (!d) return 0;
    let total = 0;
    d.lines.forEach((l) => {
      const a = cents(l.dr);
      const b = cents(l.cr);
      if (!a.bad) total += a.cents;
      if (!b.bad) total -= b.cents;
    });
    if (form === 'open') Object.keys(d.caps).forEach((k) => {
      const c = cents(d.caps[k]);
      if (!c.bad) total -= c.cents;
    });
    return total;
  }
  const offByText = (form) => {
    const t = offBy(form);
    return t ? `Off by ${usd(Math.abs(t))}` : 'Debits equal credits.';
  };

  function lineHTML(ws, o, form, l, i) {
    const p = form === 'open' ? 'bk-o' : 'bk-l';
    const bind = (k) => `${form}.lines.${i}.${k}`;
    const accts = BK()
      .accounts(ws, o.id)
      .filter((a) => form !== 'open' || a.type === 'asset' || a.type === 'liability')
      .map((a) => [a.code, `${a.code} ${a.name}`]);
    const holds = list(fundBooks(ws, o.id), 'holdings').map((x) => [x.id, x.name]);
    const invs = holdersOf(ws, o.id).map((x) => [x.id, `${x.title} (${x.id})`]);
    const showInv = form === 'entry' && INVESTOR.indexOf(l.acct) >= 0;
    const showHold = (form === 'open' ? NEEDS_HOLDING : HOLDING).indexOf(l.acct) >= 0;
    return `<li class="bk-fline">
      ${field(`${p}-acct-${i}`, 'Account', select(`${p}-acct-${i}`, bind('acct'), accts, l.acct, 'Choose an account'), '', ' data-w="acct"')}
      ${form === 'entry' ? field(`${p}-inv-${i}`, 'Investor', select(`${p}-inv-${i}`, bind('inv'), invs, l.inv, 'Choose an investor'), '', ` data-w="inv" id="${p}-invw-${i}"${showInv ? '' : ' hidden'}`) : ''}
      ${field(`${p}-hold-${i}`, 'Investment', select(`${p}-hold-${i}`, bind('hold'), holds, l.hold, 'Choose an investment'), '', ` data-w="hold" id="${p}-holdw-${i}"${showHold ? '' : ' hidden'}`)}
      ${field(`${p}-dr-${i}`, 'Debit', money(`${p}-dr-${i}`, bind('dr'), l.dr), '', ' data-w="amt"')}
      ${field(`${p}-cr-${i}`, 'Credit', money(`${p}-cr-${i}`, bind('cr'), l.cr), '', ' data-w="amt"')}
    </li>`;
  }

  function entryForm(ws, o) {
    const d = ui().entry;
    return `<div class="bk-form" data-kind="entry">
      <div class="bk-grid">
        ${field('bk-e-date', 'Date', dateIn('bk-e-date', 'entry.date', d.date), 'The day the entry belongs to.')}
        ${field('bk-e-memo', 'Memo', text('bk-e-memo', 'entry.memo', d.memo, ' maxlength="200"'), 'What it is for, as the CPA will read it.')}
      </div>
      <p class="cs-hint">Each line: an account and a debit or a credit.</p>
      <ol class="bk-flines">${d.lines.map((l, i) => lineHTML(ws, o, 'entry', l, i)).join('')}</ol>
      <p class="bk-offby" id="bk-offby" aria-live="polite">${offByText('entry')}</p>
      ${errLine('entry')}
      <div class="cs-row">${btn('bk-line-add', 'Add line')}${btn('bk-save', 'Save entry', '', 'cs-btn-primary')}${btn('bk-cancel', 'Cancel')}</div>
    </div>`;
  }

  function entriesHTML(ws, o) {
    const u = ui();
    const f = fundBooks(ws, o.id);
    const j = list(f, 'journal').filter((e) => e && typeof e.date === 'string');
    const reversed = new Set();
    j.forEach((e) => e.rev && reversed.add(e.rev));
    const ct = BK().closedThrough(ws, o.id);
    const acc = {};
    BK().accounts(ws, o.id).forEach((a) => (acc[a.code] = a.name));
    const inv = {};
    (ws.investors || []).forEach((i) => (inv[i.id] = i.title));
    const hold = {};
    list(f, 'holdings').forEach((x) => x && (hold[x.id] = x.name));
    const rows = j.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : idNum(b.id) - idNum(a.id)));
    const shown = rows.slice(0, u.show);
    const can = NS.app.can('operate');
    const item = (e) => {
      const kind = srcKind(e.src);
      const tags = [SOURCES[kind] || 'Record'];
      if (reversed.has(e.id)) tags.push('Reversed');
      if (e.rev) tags.push(`Reverses ${e.rev}`);
      const lines = (e.lines || [])
        .map((l) => {
          const c = Number(l[1]) || 0;
          const who = [l[2] ? inv[l[2]] || l[2] : '', l[3] ? hold[l[3]] || l[3] : ''].filter(Boolean).map(h).join(' · ');
          return `<tr><td><span class="bk-code">${h(l[0])}</span> ${h(acc[l[0]] || '')}${who ? `<span class="bk-sub">${who}</span>` : ''}</td><td class="num">${c > 0 ? usd(c) : ''}</td><td class="num">${c < 0 ? usd(-c) : ''}</td></tr>`;
        })
        .join('');
      const rev = can && reversible(e.src) && !e.rev && !reversed.has(e.id) && !(ct && e.date <= ct);
      return `<li class="bk-entry" data-id="${h(e.id)}" data-src="${h(e.src)}">
        <div class="bk-e-head"><span class="bk-e-date">${h(day(e.date))}</span><span class="bk-e-memo">${h(e.memo || '')}</span><span class="bk-tags">${tags.map((t) => `<span class="bk-tag">${h(t)}</span>`).join('')}</span></div>
        <div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact bk-lines"><thead><tr><th scope="col">Account</th><th scope="col" class="num">Debit</th><th scope="col" class="num">Credit</th></tr></thead><tbody>${lines}</tbody></table></div>
        ${rev ? `<div class="cs-row">${btn('bk-reverse', 'Reverse', ` data-id="${h(e.id)}"`)}</div>` : ''}
      </li>`;
    };
    const body = `${u.form === 'entry' ? entryForm(ws, o) : can ? `<div class="cs-row">${btn('bk-add', 'Add entry', '', 'cs-btn-primary')}</div>` : ''}
      ${errLine('list')}
      ${rows.length ? `<ol class="bk-entries">${shown.map(item).join('')}</ol>` : '<p class="cs-muted">No entries yet.</p>'}
      ${rows.length > shown.length ? `<div class="cs-row">${btn('bk-more', 'Show more')}<span class="cs-hint">${shown.length} of ${rows.length} shown</span></div>` : ''}`;
    return section('entries', 'Entries', 'Accruals, corrections and anything the bank does not show.', body, `<span class="cs-count" id="bk-entries-count">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span>`);
  }

  /* ---------- Investments ---------- */
  function holdingFacts(ws, o, x) {
    const f = fundBooks(ws, o.id);
    const cost = BK().balance(ws, o.id, ['1100'], '9999-12-31', { holding: x.id });
    const unreal = BK().balance(ws, o.id, ['1150'], '9999-12-31', { holding: x.id });
    let mark = null;
    list(f, 'marks').forEach((m) => m && m.holding === x.id && (!mark || m.date >= mark.date) && (mark = m));
    // A value posted without its mark record still counts as a value (its entry's date).
    let posted = '';
    list(f, 'journal').forEach((e) => e && /^mark:/.test(String(e.src)) && (e.lines || []).some((l) => l[0] === '1150' && l[3] === x.id) && e.date > posted && (posted = e.date));
    const last = mark && mark.date >= posted ? mark.date : posted;
    return { cost, value: cost + unreal, valued: !!last || unreal !== 0, last, doc: mark && mark.date === last ? mark.doc || '' : '' };
  }
  function holdingsHTML(ws, o) {
    const u = ui();
    const hs = list(fundBooks(ws, o.id), 'holdings').filter(Boolean);
    const can = NS.app.can('operate');
    const tbc = '<span class="bk-tbc">To be confirmed</span>';
    const row = (x) => {
      const F = holdingFacts(ws, o, x);
      const dd = (k, label, v, raw) => `<div><dt>${label}</dt><dd class="bk-h-${k}">${raw ? v : h(v)}</dd></div>`;
      const prop = x.kind === 'property'
        ? dd('address', 'Address', x.address ? h(x.address) : tbc, true) + dd('placed', 'Placed in service', x.placed ? h(day(x.placed)) : tbc, true) + dd('land', 'Land', usd(x.landCents || 0)) + dd('building', 'Building', usd(x.buildingCents || 0))
        : '';
      return `<li class="bk-hold" data-id="${h(x.id)}"><p class="bk-h-name">${h(x.name)}</p><dl class="bk-facts">
        ${dd('kind', 'Kind', x.kind === 'property' ? 'Property' : 'Investment')}${dd('level', 'Level', 'Level ' + x.level)}
        ${dd('cost', 'Cost', usd(F.cost))}${dd('value', 'Value', F.valued ? usd(F.value) : 'At cost (no value entered)')}
        ${dd('date', 'Last value', F.last ? day(F.last) : 'No value entered')}${F.last ? dd('doc', 'Document', F.doc || 'Not named') : ''}${prop}
      </dl></li>`;
    };
    let form = '';
    if (u.form === 'inv') {
      const d = u.inv;
      form = `<div class="bk-form" data-kind="inv">
        <div class="bk-grid">
          ${field('bk-i-name', 'Name', text('bk-i-name', 'inv.name', d.name, ' maxlength="120"'), 'As the statements will name it.')}
          ${field('bk-i-kind', 'Kind', select('bk-i-kind', 'inv.kind', [['investment', 'Investment'], ['property', 'Property']], d.kind), 'A property also needs its cost split.')}
          ${field('bk-i-level', 'Level', select('bk-i-level', 'inv.level', [['1', 'Level 1'], ['2', 'Level 2'], ['3', 'Level 3']], d.level), 'The fair value level the auditor asks for.')}
        </div>
        <div class="bk-grid" id="bk-i-prop"${d.kind === 'property' ? '' : ' hidden'}>
          ${field('bk-i-address', 'Address', text('bk-i-address', 'inv.address', d.address, ' maxlength="200"'), 'Where the property is.')}
          ${field('bk-i-placed', 'Placed in service', dateIn('bk-i-placed', 'inv.placed', d.placed), 'Depreciation starts here.')}
          ${field('bk-i-land', 'Land', money('bk-i-land', 'inv.land', d.land), 'Land is not depreciated.')}
          ${field('bk-i-building', 'Building', money('bk-i-building', 'inv.building', d.building), 'The depreciable part of the cost.')}
        </div>
        ${errLine('inv')}
        <div class="cs-row">${btn('bk-inv-save', 'Save investment', '', 'cs-btn-primary')}${btn('bk-cancel', 'Cancel')}</div>
      </div>`;
    } else if (u.form === 'val') {
      const d = u.val;
      form = `<div class="bk-form" data-kind="val">
        <div class="bk-grid">
          ${field('bk-v-hold', 'Investment', select('bk-v-hold', 'val.hold', hs.map((x) => [x.id, x.name]), d.hold, 'Choose an investment'), 'The one valued.')}
          ${field('bk-v-date', 'Date', dateIn('bk-v-date', 'val.date', d.date), 'The day the value is as of.')}
          ${field('bk-v-fv', 'Fair value', money('bk-v-fv', 'val.fv', d.fv), 'The whole investment, in dollars.')}
          ${field('bk-v-doc', 'Document', text('bk-v-doc', 'val.doc', d.doc, ' maxlength="200"'), 'What the value rests on, for the auditor.')}
        </div>
        ${errLine('val')}
        <div class="cs-row">${btn('bk-val-save', 'Save value', '', 'cs-btn-primary')}${btn('bk-cancel', 'Cancel')}</div>
      </div>`;
    }
    const buttons = can && !form ? `<div class="cs-row">${btn('bk-inv-add', 'Add investment')}${hs.length ? btn('bk-val-open', 'Enter value') : ''}</div>` : '';
    const body = `${form}${buttons}${hs.length ? `<ul class="bk-holds">${hs.map(row).join('')}</ul>` : '<p class="cs-muted">No investments yet.</p>'}`;
    return section('investments', 'Investments', 'Investments stay at cost until a value is entered.', body);
  }

  /* ---------- Opening balances (an owner, a fund that is not a sample, once, before anything is closed) ---------- */
  function openingShown(ws, o) {
    if (!NS.app.can('configure') || (NS.audit && NS.audit.generated && NS.audit.generated(o))) return false;
    const f = fundBooks(ws, o.id);
    return !BK().live(f, 'open:' + o.id) && !BK().closedThrough(ws, o.id);
  }
  function openingHTML(ws, o) {
    const u = ui();
    if (!u.open) {
      const start = fundBooks(ws, o.id).start || '';
      u.open = { date: start ? shiftDay(start, -1) : '', lines: [blankLine(), blankLine()], caps: {} };
    }
    const d = u.open;
    const caps = holdersOf(ws, o.id)
      .map((i) => `<label class="cs-field" for="bk-o-cap-${h(i.id)}"><span>${h(i.title)} (${h(i.id)})</span><input id="bk-o-cap-${h(i.id)}" type="text" inputmode="decimal" autocomplete="off" data-bind="bk:open.cap" data-cap="${h(i.id)}" value="${h(d.caps[i.id] || '')}"></label>`)
      .join('');
    const body = `<div class="bk-form" data-kind="open">
      ${field('bk-o-date', 'Date', dateIn('bk-o-date', 'open.date', d.date), 'The day before the books start.')}
      <p class="cs-hint">Each line: an asset or a liability and its balance as a debit or a credit.</p>
      <ol class="bk-flines">${d.lines.map((l, i) => lineHTML(ws, o, 'open', l, i)).join('')}</ol>
      <h3 class="bk-h3">Capital</h3>
      <p class="cs-hint">Each holder's capital on that day.</p>
      <div class="bk-grid">${caps || '<p class="cs-muted">No investor holds this fund.</p>'}</div>
      <p class="bk-offby" id="bk-o-offby" aria-live="polite">${offByText('open')}</p>
      ${errLine('open')}
      <div class="cs-row">${btn('bk-o-line-add', 'Add line')}${btn('bk-o-save', 'Save opening balances', '', 'cs-btn-primary')}</div>
    </div>`;
    return section('opening', 'Opening balances', 'Only for a fund that existed before its books started here.', body);
  }

  /* ---------- Close ---------- */
  function closeHTML(ws, o) {
    const u = ui();
    const f = fundBooks(ws, o.id);
    const ct = BK().closedThrough(ws, o.id);
    const rec = ct ? list(f, 'closed').filter((r) => r && !r.reopened && r.through === ct).pop() : null;
    const status = rec
      ? `<p class="bk-closed">Closed through ${h(day(rec.through))} by ${h(rec.by)} on ${h(day(String(rec.at || '').slice(0, 10)))}. Trial balance fingerprint <code class="bk-hash">${h(String(rec.tb || '').slice(0, 12))}</code></p>`
      : '<p class="bk-closed">No month is closed.</p>';
    let ctl = '';
    if (NS.app.can('configure')) {
      const dates = list(f, 'journal').map((e) => e && e.date).filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
      const first = [f.start || ''].concat(dates).filter(Boolean).sort()[0] || '';
      const lastEnd = shiftDay(NS.dates.today().slice(0, 8) + '01', -1);
      const ends = first ? monthEnds(first, lastEnd).filter((x) => !ct || x > ct) : [];
      ctl += ends.length
        ? `<div class="bk-grid">${field('bk-c-through', 'Month-end', select('bk-c-through', 'close.through', ends.map((x) => [x, day(x)]), u.close.through, 'Choose a month-end'), 'Everything on or before it is locked.')}</div><div class="cs-row">${btn('bk-close', 'Close through', '', 'cs-btn-primary')}</div>`
        : '<p class="cs-muted">No month-end is ready to close.</p>';
      if (ct) ctl += `<div class="bk-grid">${field('bk-c-why', 'Reason', text('bk-c-why', 'close.why', u.close.why, ' maxlength="200"'), 'Kept in the change log.')}</div><div class="cs-row">${btn('bk-reopen', 'Reopen')}</div>`;
    }
    return section('close', 'Close', 'A closed month cannot change; its trial balance is fingerprinted.', `${status}${ctl}${errLine('close')}`);
  }

  function pageHTML(ws, syncErr) {
    const o = fundOf(ws);
    const fund = `<label class="cs-field bk-fund" for="bk-fund"><span>Fund</span><select id="bk-fund" data-change="bk-fund">${ws.offerings.map((x) => `<option value="${h(x.id)}"${x.id === o.id ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select></label>`;
    return `<div class="bk" data-fund="${h(o.id)}">${CK().head('Accounting')}${fund}
      ${partsHTML(ws, o)}
      ${syncErr ? `<p class="bk-sync" role="alert">The books could not be brought up to date: ${h(syncErr)}</p>` : ''}
      ${entriesHTML(ws, o)}${holdingsHTML(ws, o)}${openingShown(ws, o) ? openingHTML(ws, o) : ''}${closeHTML(ws, o)}</div>`;
  }

  /* ---------- actions ---------- */
  const W0 = () => {
    const ws = W();
    return { ws, o: fundOf(ws), u: ui() };
  };
  /** Run a change; a refusal becomes the section's one line. Saves and draws the page again either way. */
  function act(slot, need, fn) {
    return (el) => {
      const { ws, o, u } = W0();
      if (!NS.app.can(need)) return U.toast('Only an owner can do this. Ask an admin on your team.');
      u.err = {};
      try {
        const done = fn(ws, o, u, el);
        if (done) {
          NS.app.save();
          if (typeof done === 'string') U.toast(done);
        }
      } catch (e) {
        u.err[slot] = sentence(e);
      }
      NS.app.render();
    };
  }
  /** The lines of an entry or opening form as journal lines, or a sentence about the first one that is wrong. */
  function readLines(d, form) {
    const out = [];
    for (let i = 0; i < d.lines.length; i++) {
      const l = d.lines[i];
      const n = i + 1;
      const a = cents(l.dr);
      const b = cents(l.cr);
      if (!l.acct && a.empty && b.empty) continue;
      if (a.bad || b.bad) throw new Error(`Line ${n}: ${BAD_AMOUNT}`);
      if (!l.acct) throw new Error(`Line ${n}: choose the account.`);
      if (a.cents && b.cents) throw new Error(`Line ${n}: enter a debit or a credit, not both.`);
      if (!a.cents && !b.cents) throw new Error(`Line ${n}: enter a debit or a credit.`);
      const needInv = form === 'entry' && NEEDS_INVESTOR.indexOf(l.acct) >= 0;
      if (needInv && !l.inv) throw new Error(`Line ${n}: choose the investor whose capital this is.`);
      if (NEEDS_HOLDING.indexOf(l.acct) >= 0 && !l.hold) throw new Error(`Line ${n}: choose the investment.`);
      const inv = form === 'entry' && INVESTOR.indexOf(l.acct) >= 0 ? l.inv || '' : '';
      const hold = (form === 'open' ? NEEDS_HOLDING : HOLDING).indexOf(l.acct) >= 0 ? l.hold || '' : '';
      out.push([l.acct, a.cents ? a.cents : -b.cents, inv, hold]);
    }
    return out;
  }
  const balanced = (lines) => {
    const t = lines.reduce((s, l) => s + l[1], 0);
    if (t) throw new Error(`Debits and credits must be equal; they are off by ${usd(Math.abs(t))}.`);
  };
  /** A src for a new manual entry: never one used before in this fund, not even by a reversed entry. */
  function manSrc(ws, id) {
    const used = new Set(list(fundBooks(ws, id), 'journal').map((e) => e && e.src));
    let n = list(fundBooks(ws, id), 'journal').filter((e) => e && /^man:/.test(String(e.src))).length + 1;
    while (used.has('man:e-' + n.toString(36))) n++;
    return 'man:e-' + n.toString(36);
  }

  NS.changes['bk-fund'] = (el) => {
    chooseFund(el.value);
    NS.app.render();
  };
  NS.actions['bk-more'] = () => {
    ui().show += PAGE;
    NS.app.render();
  };
  NS.actions['bk-cancel'] = () => {
    const u = ui();
    u.form = '';
    u.err = {};
    NS.app.render();
  };
  const today = () => NS.dates.today();
  NS.actions['bk-add'] = act('list', 'operate', (ws, o, u) => {
    u.form = 'entry';
    u.entry = { date: today(), memo: '', lines: [blankLine(), blankLine()] };
  });
  NS.actions['bk-line-add'] = () => {
    const u = ui();
    if (u.entry) u.entry.lines.push(blankLine());
    NS.app.render();
  };
  NS.actions['bk-save'] = act('entry', 'operate', (ws, o, u) => {
    const d = u.entry;
    if (!d) return false;
    if (!d.date) throw new Error('Choose the date.');
    if (!String(d.memo || '').trim()) throw new Error('Write a memo saying what the entry is for.');
    const lines = readLines(d, 'entry');
    if (lines.length < 2) throw new Error('An entry needs at least two lines.');
    balanced(lines);
    const e = BK().post(ws, o.id, { date: d.date, memo: String(d.memo).trim(), src: manSrc(ws, o.id), lines }, { by: actor() });
    const total = lines.reduce((s, l) => s + (l[1] > 0 ? l[1] : 0), 0);
    CK().audit('Journal entry added', CK().short(`${e.date} ${e.memo}: ${usd(total)}`), o.id, e.id);
    u.form = '';
    u.entry = null;
    return 'Entry saved';
  });
  NS.actions['bk-reverse'] = act('list', 'operate', (ws, o, u, el) => {
    const id = el.getAttribute('data-id');
    const e = list(fundBooks(ws, o.id), 'journal').find((x) => x && x.id === id);
    if (!e || !reversible(e.src)) throw new Error('Only an entry made here or from the bank can be reversed; a record\'s entries follow the record.');
    const r = BK().reverse(ws, o.id, id, { by: actor() });
    CK().audit('Journal entry reversed', CK().short(`${e.date} ${e.memo || ''}`), o.id, id);
    return r ? 'Entry reversed' : false;
  });
  NS.actions['bk-inv-add'] = act('inv', 'operate', (ws, o, u) => {
    u.form = 'inv';
    u.inv = { name: '', kind: 'investment', level: '3', address: '', placed: '', land: '', building: '' };
  });
  NS.actions['bk-inv-save'] = act('inv', 'operate', (ws, o, u) => {
    const d = u.inv;
    if (!d) return false;
    const prop = d.kind === 'property';
    const land = prop ? cents(d.land) : { cents: 0 };
    const bld = prop ? cents(d.building) : { cents: 0 };
    if (land.bad) throw new Error(`Land: ${BAD_AMOUNT}`);
    if (bld.bad) throw new Error(`Building: ${BAD_AMOUNT}`);
    const x = BK().addHolding(ws, o.id, { name: d.name, kind: prop ? 'property' : 'investment', level: Number(d.level), address: prop ? String(d.address || '').trim() : '', placed: prop ? d.placed || '' : '', landCents: land.cents, buildingCents: bld.cents });
    CK().audit('Investment added', CK().short(x.name), o.id, x.id);
    u.form = '';
    u.inv = null;
    return 'Investment added';
  });
  NS.actions['bk-val-open'] = act('val', 'operate', (ws, o, u) => {
    u.form = 'val';
    const hs = list(fundBooks(ws, o.id), 'holdings');
    u.val = { hold: hs.length === 1 ? hs[0].id : '', date: today(), fv: '', doc: '' };
  });
  NS.actions['bk-val-save'] = act('val', 'operate', (ws, o, u) => {
    const d = u.val;
    if (!d) return false;
    if (!d.hold) throw new Error('Choose the investment.');
    const fv = cents(d.fv);
    if (fv.bad) throw new Error(`Fair value: ${BAD_AMOUNT}`);
    if (!String(d.fv || '').trim()) throw new Error('Enter the fair value.');
    const m = BK().value(ws, o.id, { holding: d.hold, date: d.date, fvCents: fv.cents, doc: String(d.doc || '').trim() }, { by: actor() });
    const x = list(fundBooks(ws, o.id), 'holdings').find((y) => y.id === m.holding) || { name: m.holding };
    CK().audit('Value recorded', CK().short(`${x.name}: ${usd(m.fvCents)} at ${m.date}`), o.id, m.id);
    u.form = '';
    u.val = null;
    return 'Value recorded';
  });
  NS.actions['bk-o-line-add'] = () => {
    const u = ui();
    if (u.open) u.open.lines.push(blankLine());
    NS.app.render();
  };
  NS.actions['bk-o-save'] = act('open', 'configure', (ws, o, u) => {
    const d = u.open;
    if (!d) return false;
    if (!d.date) throw new Error('Choose the date: the day before the books start.');
    const lines = readLines(d, 'open');
    holdersOf(ws, o.id).forEach((i) => {
      const c = cents(d.caps[i.id]);
      if (c.bad) throw new Error(`${i.title}: ${BAD_AMOUNT}`);
      if (c.cents) lines.push(['3900', -c.cents, i.id, '']);
    });
    balanced(lines);
    BK().opening(ws, o.id, { date: d.date, lines }, { by: actor() });
    CK().audit('Opening balances recorded', `As of ${d.date}`, o.id, 'open:' + o.id);
    u.open = null;
    return 'Opening balances saved';
  });
  NS.actions['bk-close'] = act('close', 'configure', (ws, o, u) => {
    if (!u.close.through) throw new Error('Choose the month-end to close through.');
    BK().finalize(ws, o.id, u.close.through, { by: actor() });
    u.close = { through: '', why: '' };
    return 'Books closed';
  });
  NS.actions['bk-reopen'] = act('close', 'configure', (ws, o, u) => {
    BK().reopenBooks(ws, o.id, { by: actor(), why: u.close.why });
    u.close = { through: '', why: '' };
    return 'Books reopened';
  });

  /* ---------- typing: kept in the page's state, drawn in place (no drawing, so the keyboard stays) ---------- */
  function showLineFields(form, i) {
    const u = ui();
    const d = form === 'open' ? u.open : u.entry;
    const l = d && d.lines[i];
    if (!l) return;
    const p = form === 'open' ? 'bk-o' : 'bk-l';
    const inv = document.getElementById(`${p}-invw-${i}`);
    const hold = document.getElementById(`${p}-holdw-${i}`);
    const showInv = form === 'entry' && INVESTOR.indexOf(l.acct) >= 0;
    const showHold = (form === 'open' ? NEEDS_HOLDING : HOLDING).indexOf(l.acct) >= 0;
    if (inv) inv.hidden = !showInv;
    if (hold) hold.hidden = !showHold;
    if (!showInv) l.inv = '';
    if (!showHold) l.hold = '';
  }
  NS.binders.bk = (path, v, el) => {
    const u = ui();
    const p = path.split('.');
    if (path === 'open.cap') {
      if (u.open) u.open.caps[el.getAttribute('data-cap')] = v;
    } else {
      let o = u;
      for (const k of p.slice(0, -1)) {
        if (o == null || typeof o !== 'object') return;
        o = o[k];
      }
      if (o == null || typeof o !== 'object') return;
      o[p[p.length - 1]] = v;
    }
    if (/^(entry|open)\.lines\.\d+\.acct$/.test(path)) showLineFields(p[0], Number(p[2]));
    if (path === 'inv.kind') {
      const box = document.getElementById('bk-i-prop');
      if (box) box.hidden = v !== 'property';
    }
    const form = p[0] === 'open' ? 'open' : p[0] === 'entry' ? 'entry' : '';
    if (form) {
      const out = document.getElementById(form === 'open' ? 'bk-o-offby' : 'bk-offby');
      if (out) out.textContent = offByText(form);
    }
  };

  /* ---------- the page ---------- */
  if (E.diy) {
    NS.views[ROUTE] = {
      mode: 'console',
      edition: 'diy',
      render() {
        const ws = W();
        startParts();
        if (!ws.offerings.length) return CK().shell(`${CK().head('Accounting')}${CK().panel('', '<p class="cs-muted">No offerings yet. The books start with the first offering.</p>')}`, ROUTE);
        // The books are brought up to date from the records before anything is read (B2).
        let syncErr = '';
        try {
          const r = BK() && typeof BK().sync === 'function' ? BK().sync(ws) : null;
          if (r && (r.posted || r.reversed)) NS.app.save();
        } catch (e) {
          syncErr = sentence(e);
        }
        return CK().shell(pageHTML(ws, syncErr), ROUTE);
      }
    };
  }
  NS.booksUI = { part, PARTS, refresh };
})(window.CVPortal);
