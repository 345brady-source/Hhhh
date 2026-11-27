/*
 * The Bank section of the Accounting page (D-01, C-03, FA-06): the sponsor adds a bank account (its name and the last
 * four digits of its number, nothing more), uploads a statement file downloaded from the bank, accepts the suggested
 * matches, decides every other line once by choosing an account, undoes a decision while its period is open, and
 * reconciles the account to a statement date. Registered with NS.booksUI.part('bank', ...) and loaded by books-ui.js
 * after bankfiles.js (the statement reader) and books-bank.js (the bank decisions).
 *
 * The file is read on this device: its bytes with File.arrayBuffer(), decoded as UTF-8, read by NS.bankFiles.parse.
 * Nothing is sent anywhere (no fetch, no XHR). The bytes are kept in the portal's file store (NS.ops.files) as the
 * import's evidence, never as a Blob in the browser's storage; the books keep the lines. A run of nine or more digits in
 * a file name or a line's text is cut to its last four before anything is stored or shown, so a full account number is
 * never kept, logged or drawn. Every figure comes from books-bank.js; this file adds up only what is being typed ("Off
 * by"). Every value from the workspace or the file is escaped. Each action writes the change log and saves.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.booksUI || !NS.books || !NS.books.bank || !NS.bankFiles) return;
  const U = NS.ui;
  const { h } = U;
  const BK = () => NS.books;
  const BB = () => NS.books.bank;
  const BF = () => NS.bankFiles;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const actor = () => NS.app.actor();
  const LINE = 'Statement files post expenses, income and purchases, and prove the cash.';
  const PAGE = 20;
  /** Accounts whose line names an investor (2000: a returned distribution owed back to one), and an investment. */
  const INVESTOR = ['3000', '3100', '3900', '2400', '2000'];
  const NEEDS_INVESTOR = ['3000', '3100', '3900'];
  const HOLDING = ['1100', '1150', '6000', '6100'];
  const NEEDS_HOLDING = ['1100', '1150'];
  const KIND = { purchase: 'Purchase of an investment', sale: 'Sale of an investment' };
  const NEW = '__new';
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;

  /* ---------- money, dates, text ---------- */
  /** Typed dollars as whole cents: an optional sign or $, digits (commas only in groups of three), up to two decimals. */
  function cents(s) {
    let t = String(s == null ? '' : s).trim();
    if (!t) return { empty: true, cents: 0 };
    let neg = false;
    if (/^[-−]/.test(t)) (neg = true), (t = t.slice(1).trim());
    const m = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(t);
    if (!m) return { bad: true };
    const digits = m[1].replace(/,/g, '') + (m[2] || '').padEnd(2, '0');
    if (digits.replace(/^0+/, '').length > 15) return { bad: true };
    let c = 0;
    for (let i = 0; i < digits.length; i++) c = c * 10 + (digits.charCodeAt(i) - 48);
    return { cents: neg ? -c : c, empty: false };
  }
  const BAD_AMOUNT = 'type the amount in dollars and cents, for example 2000.00.';
  function usd(c) {
    const a = Math.abs(c);
    const whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (c < 0 ? '−$' : '$') + whole + '.' + String(a % 100).padStart(2, '0');
  }
  /** Cents as they are typed back into a field: 35,000.00 or -3,000.00. */
  const typed = (c) => usd(c).replace('−', '-').replace('$', '');
  const day = (iso) => (iso ? U.date(iso) : '');
  /** A run of nine or more digits (an account number) cut to its last four. */
  const mask = (s) => String(s == null ? '' : s).replace(/\d{9,}/g, (m) => '****' + m.slice(-4));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function sentence(e) {
    if (e && e.code === 'closed') return `The books are closed through ${e.through}; reopen them to change anything dated on or before that day.`;
    return mask(String((e && e.message) || e || 'That could not be done.'));
  }
  const NOT_STATEMENT = 'This file cannot be read as a bank statement; download the statement from the bank in one of the kinds named above.';

  /* ---------- what is open in the section (kept across drawings, never stored) ---------- */
  function ui(o) {
    const all = S().ui;
    if (!all.bb || all.bb.fund !== o.id) all.bb = { fund: o.id, acct: '', form: '', a: { name: '', last4: '' }, pending: null, result: '', reads: all.bb ? all.bb.reads : 0, err: {}, dec: {}, notThis: {}, show: PAGE, showDone: PAGE, rec: { date: '', stmt: null, open: '', openEdit: false } };
    return all.bb;
  }
  function resetAccount(u) {
    Object.assign(u, { pending: null, result: '', err: {}, dec: {}, notThis: {}, show: PAGE, showDone: PAGE, rec: { date: '', stmt: null, open: '', openEdit: false } });
  }
  const fundOf = (ws, id) => (ws.books && ws.books.funds && ws.books.funds[id]) || null;
  const bankOf = (ws, id) => {
    const f = fundOf(ws, id);
    const b = (f && f.bank) || {};
    return { accounts: b.accounts || [], imports: b.imports || [], lines: b.lines || [], recs: b.recs || [] };
  };
  const journalOf = (ws, id) => ((fundOf(ws, id) || {}).journal || []).filter(Boolean);
  const holdingsOf = (ws, id) => ((fundOf(ws, id) || {}).holdings || []).filter(Boolean);
  const holdersOf = (ws, id) => (ws.investors || []).filter((i) => (i.positions || []).some((p) => p && p.offeringId === id));
  function accountNow(ws, o, u) {
    const accts = bankOf(ws, o.id).accounts.filter((a) => a && a.id);
    let a = accts.find((x) => x.id === u.acct) || accts[0] || null;
    u.acct = a ? a.id : '';
    return a;
  }
  /** Chart accounts a line may be decided to: every account but the cash accounts (1000 to 1099, one per bank account). */
  const decisionAccounts = (ws, o) => BK().accounts(ws, o.id).filter((a) => !/^10\d\d$/.test(a.code));
  const acctName = (ws, o, code) => {
    const a = BK().accounts(ws, o.id).find((x) => x.code === code);
    return a ? `${a.code} ${a.name}` : code;
  };
  const reversedSet = (j) => {
    const r = new Set();
    j.forEach((e) => e.rev && r.add(e.rev));
    return r;
  };

  /* ---------- drawing ---------- */
  const errLine = (u, k) => (u.err[k] ? `<p class="bk-err" role="alert">${h(u.err[k])}</p>` : '');
  const field = (id, label, input, attrs) => `<label class="cs-field" for="${id}"${attrs || ''}><span>${label}</span>${input}</label>`;
  const textIn = (id, bind, v, more) => `<input id="${id}" type="text" data-bind="bb:${bind}" value="${h(v == null ? '' : v)}"${more || ''}>`;
  const moneyIn = (id, bind, v) => textIn(id, bind, v, ' inputmode="decimal" autocomplete="off"');
  const select = (id, bind, opts, v, first) =>
    `<select id="${id}" data-bind="bb:${bind}">${first ? `<option value="">${first}</option>` : ''}${opts.map(([val, label]) => `<option value="${h(val)}"${String(val) === String(v) ? ' selected' : ''}>${h(label)}</option>`).join('')}</select>`;
  const lineHead = (l) => `<div class="bk-e-head"><span class="bk-e-date">${h(day(l.date))}</span><span class="bk-e-memo">${h(l.text || '(no description)')}</span><span class="bk-tags"><span class="bk-tag">${usd(l.cents)}</span></span></div>`;

  function accountsHTML(ws, o, u, acct, can) {
    const accts = bankOf(ws, o.id).accounts.filter((a) => a && a.id);
    const list = accts.length
      ? `<ul class="bk-holds bb-accts">${accts.map((a) => `<li class="bk-hold bb-acct" data-id="${h(a.id)}"><span class="bk-e-memo">${h(a.name)}</span> <span class="bk-code">ending ${h(a.last4)}</span></li>`).join('')}</ul>`
      : '<p class="cs-muted">No bank account yet.</p>';
    const pick = accts.length > 1 ? `<div class="bk-grid">${field('bb-acct', 'Bank account', `<select id="bb-acct" data-change="bb-acct">${accts.map((a) => `<option value="${h(a.id)}"${a.id === acct.id ? ' selected' : ''}>${h(a.name)} ending ${h(a.last4)}</option>`).join('')}</select>`)}</div>` : '';
    let form = '';
    if (u.form === 'acct')
      form = `<div class="bk-form" data-kind="acct"><div class="bk-grid">
        ${field('bb-a-name', 'Name', textIn('bb-a-name', 'a.name', u.a.name, ' maxlength="80"'))}
        ${field('bb-a-last4', 'Last four digits', textIn('bb-a-last4', 'a.last4', u.a.last4, ' inputmode="numeric" maxlength="4" autocomplete="off"'))}
      </div>${errLine(u, 'acct')}<div class="cs-row">${btn('bb-acct-save', 'Save bank account', '', 'cs-btn-primary')}${btn('bb-cancel', 'Cancel')}</div></div>`;
    else if (can) form = `<div class="cs-row">${btn('bb-acct-add', 'Add bank account')}</div>`;
    return `<h3 class="bk-h3">Bank accounts</h3>${list}${pick}${form}`;
  }

  /* ---------- a CSV's columns, confirmed once per bank account ---------- */
  const ORDERS = [['mdy', 'Month/day/year'], ['dmy', 'Day/month/year'], ['ymd', 'Year-month-day']];
  const colText = (v) => (v === null || v === undefined ? '' : String(v));
  /** The form's fields from a guessed or kept column map (every column an index written as text, '' for none). */
  function formOf(m) {
    return { date: colText(m.date), text: colText(m.text), amount: m.amount !== null && m.amount !== undefined ? colText(m.amount) : m.in !== null && m.in !== undefined ? 'two' : '', in: colText(m.in), out: colText(m.out), balance: colText(m.balance), check: colText(m.check), order: m.order || 'mdy', neg: m.outNegative !== false, header: !!m.header };
  }
  /** The column map the statement reader takes, from the form's fields. */
  function mapOf(f) {
    const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    const two = f.amount === 'two';
    return { date: n(f.date), text: n(f.text), amount: two ? null : n(f.amount), in: two ? n(f.in) : null, out: two ? n(f.out) : null, balance: n(f.balance), check: n(f.check), header: !!f.header, order: f.order, outNegative: two ? true : !!f.neg };
  }
  /**
   * The layout form of a statement in columns, filled from the guess: which column holds the date, the description, the
   * amount (or money in and money out), the balance and the check number, the order the dates are written in, whether
   * money out is shown as negative and whether the first row names the columns; under it, the first five lines read with
   * that layout, as money in and money out. One function, so another screen reading columns can follow it.
   */
  function layoutHTML(p) {
    const f = p.form;
    const first = p.rows[0] || [];
    const width = p.rows.reduce((w, r) => Math.max(w, r.length), 0);
    const cols = [];
    for (let i = 0; i < width; i++) cols.push([String(i), f.header ? first[i] || `Column ${i + 1}` : `Column ${i + 1}${first[i] ? ': ' + first[i] : ''}`]);
    const none = [['', 'None']];
    const two = f.amount === 'two';
    const check = (id, bind, on, label) => `<label class="cs-check" for="${id}"><input id="${id}" type="checkbox" data-bind="bb:${bind}"${on ? ' checked' : ''}><span>${label}</span></label>`;
    let preview;
    try {
      const head = String(p.text).split(/\r\n|\r|\n/).slice(0, f.header ? 6 : 5).join('\n');
      const lines = BF().parse(head, { kind: 'csv', map: mapOf(f) }).lines.slice(0, 5);
      preview = `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact bk-lines bb-preview"><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col" class="num">Money in</th><th scope="col" class="num">Money out</th></tr></thead><tbody>${lines
        .map((l) => `<tr><td>${h(day(l.date))}</td><td>${h(mask(l.text))}</td><td class="num">${l.cents > 0 ? usd(l.cents) : ''}</td><td class="num">${l.cents < 0 ? usd(-l.cents) : ''}</td></tr>`)
        .join('')}</tbody></table></div>`;
    } catch (e) {
      preview = `<p class="bk-err" role="alert">${h(sentence(e))}</p>`;
    }
    return `<div class="bk-form" data-kind="layout">
      <p class="bk-e-memo">${h(p.name)}</p>
      <div class="bk-grid">
        ${field('bb-m-date', 'Date', select('bb-m-date', 'pending.form.date', cols, f.date, 'Choose a column'))}
        ${field('bb-m-text', 'Description', select('bb-m-text', 'pending.form.text', cols, f.text, 'Choose a column'))}
        ${field('bb-m-amount', 'Amount', select('bb-m-amount', 'pending.form.amount', cols.concat([['two', 'Money in and money out columns']]), f.amount, 'Choose a column'))}
        ${two ? field('bb-m-in', 'Money in', select('bb-m-in', 'pending.form.in', cols, f.in, 'Choose a column')) : ''}
        ${two ? field('bb-m-out', 'Money out', select('bb-m-out', 'pending.form.out', cols, f.out, 'Choose a column')) : ''}
        ${field('bb-m-balance', 'Balance', select('bb-m-balance', 'pending.form.balance', none.concat(cols), f.balance))}
        ${field('bb-m-check', 'Check number', select('bb-m-check', 'pending.form.check', none.concat(cols), f.check))}
        ${field('bb-m-order', 'Date order', select('bb-m-order', 'pending.form.order', ORDERS, f.order))}
      </div>
      ${two ? '' : check('bb-m-neg', 'pending.form.neg', f.neg, 'Money out shown as negative')}
      ${check('bb-m-header', 'pending.form.header', f.header, 'First row names the columns')}
      ${preview}
      <div class="cs-row">${btn('bb-layout-use', 'Use this layout', '', 'cs-btn-primary')}${btn('bb-pending-cancel', 'Cancel')}</div>
    </div>`;
  }

  function fileHTML(ws, o, u, acct, can) {
    if (!can) return '';
    const input = `<label class="cs-field bb-file-label" for="bb-file"><span>Statement file (CSV, OFX, QFX, QBO or BAI2)</span><input id="bb-file" type="file" data-change="bb-file"></label>`;
    const p = u.pending && u.pending.acct === acct.id ? u.pending : null;
    let stage = '';
    if (p && p.stage === 'layout') stage = layoutHTML(p);
    if (p && p.stage === 'overlap') {
      const more = p.counts.added ? btn('bb-overlap-new', `Add only the ${plural(p.counts.added, 'other line', 'other lines')}`) : '';
      stage = `<div class="bk-form" data-kind="overlap"><p class="bb-overlap">These lines match lines already imported from another file.</p><div class="cs-row">${btn('bb-overlap-add', 'Add anyway')}${more}${btn('bb-pending-cancel', 'Cancel', '', 'cs-btn-primary')}</div></div>`;
    }
    return `<h3 class="bk-h3">Statements</h3>${input}${u.result ? `<p class="bb-result" role="status">${h(u.result)}</p>` : ''}${errLine(u, 'file')}${stage}`;
  }

  /** The undecided lines of the account with their candidates, split into suggestions and lines to decide. */
  function openLines(ws, o, u, acct) {
    const all = bankOf(ws, o.id).lines;
    const open = [];
    all.forEach((l, k) => l && l.account === acct.id && !l.match && !l.entry && open.push({ l, k, c: u.notThis[k] ? [] : BB().candidates(ws, o.id, l.id) }));
    const uses = new Map();
    open.forEach((x) => x.c.forEach((c) => uses.set(c.entry + '|' + c.line, (uses.get(c.entry + '|' + c.line) || 0) + 1)));
    open.forEach((x) => (x.one = x.c.length === 1 && uses.get(x.c[0].entry + '|' + x.c[0].line) === 1));
    return { sug: open.filter((x) => x.c.length), rest: open.filter((x) => !x.c.length) };
  }
  const candText = (c) => `${c.memo || 'Entry'} · ${day(c.date)}`;

  function suggestionsHTML(ws, o, u, acct, can, L) {
    if (!L.sug.length) return '';
    const n = L.sug.filter((x) => x.one).length;
    const items = L.sug
      .map((x) => {
        const k = x.k;
        const pick = x.one
          ? `<p class="bk-sub">Matches ${h(candText(x.c[0]))}</p>${can ? `<div class="cs-row">${btn('bb-accept', 'Accept', ` data-k="${k}"`, 'cs-btn-primary')}${btn('bb-notthis', 'Not this', ` data-k="${k}"`)}</div>` : ''}`
          : `<ul class="bk-holds">${x.c.map((c) => `<li class="bk-hold"><span class="bk-sub">${h(candText(c))}</span>${can ? `<div class="cs-row">${btn('bb-pick', 'Match', ` data-k="${k}" data-entry="${h(c.entry)}" data-line="${c.line}"`)}</div>` : ''}</li>`).join('')}</ul>${can ? `<div class="cs-row">${btn('bb-notthis', 'None of these', ` data-k="${k}"`)}</div>` : ''}`;
        return `<li class="bk-entry bb-sug" data-k="${k}" data-id="${h(x.l.id)}">${lineHead(x.l)}${pick}${errLine(u, 'line-' + k)}</li>`;
      })
      .join('');
    const all = can && n ? `<div class="cs-row">${btn('bb-accept-all', `Accept all suggestions (${n})`, '', 'cs-btn-primary')}</div>` : '';
    return `<h3 class="bk-h3">Suggestions</h3>${all}<ol class="bk-entries">${items}</ol>`;
  }

  /** The decision being typed for line k. */
  function decOf(u, k) {
    if (!u.dec[k]) u.dec[k] = { acct: '', hold: '', newName: '', inv: '', cost: '', parts: [] };
    return u.dec[k];
  }
  const blankPart = () => ({ acct: '', amt: '', hold: '', inv: '' });
  /** What the split's parts typed so far leave of the bank amount (over the amounts that can be read). */
  function splitLeft(d, l) {
    let t = 0;
    d.parts.forEach((r) => {
      const c = cents(r.amt);
      if (!c.bad) t += c.cents;
    });
    return Math.abs(l.cents) - t;
  }
  const offText = (d, l) => {
    const left = splitLeft(d, l);
    return left ? `Off by ${usd(Math.abs(left))}` : 'The parts add up to the bank amount.';
  };
  function splitHTML(ws, o, u, k, d, l) {
    const opts = decisionAccounts(ws, o).map((a) => [a.code, `${a.code} ${a.name}`]);
    const holds = holdingsOf(ws, o.id).map((y) => [y.id, y.name]);
    const invs = holdersOf(ws, o.id).map((i) => [i.id, `${i.title} (${i.id})`]);
    const rows = d.parts
      .map((r, i) => {
        const id = (w) => `bb-s-${w}-${k}-${i}`;
        const bind = (w) => `dec.${k}.parts.${i}.${w}`;
        const extra = HOLDING.indexOf(r.acct) >= 0 ? field(id('hold'), 'Investment', select(id('hold'), bind('hold'), holds, r.hold, 'Choose an investment'), ' data-w="hold"') : INVESTOR.indexOf(r.acct) >= 0 ? field(id('inv'), 'Investor', select(id('inv'), bind('inv'), invs, r.inv, 'Choose an investor'), ' data-w="inv"') : '';
        return `<li class="bk-fline">${field(id('acct'), 'Account', select(id('acct'), bind('acct'), opts, r.acct, 'Choose an account'), ' data-w="acct"')}${extra}${field(id('amt'), 'Amount', moneyIn(id('amt'), bind('amt'), r.amt), ' data-w="amt"')}</li>`;
      })
      .join('');
    return `<ol class="bk-flines">${rows}</ol><p class="bk-offby" id="bb-offby-${k}" aria-live="polite">${offText(d, l)}</p><div class="cs-row">${btn('bb-split-add', 'Add line', ` data-k="${k}"`)}</div>`;
  }
  function decisionHTML(ws, o, u, x, can) {
    const k = x.k;
    const l = x.l;
    if (!can) return `<li class="bk-entry bb-line" data-k="${k}" data-id="${h(l.id)}">${lineHead(l)}</li>`;
    const d = decOf(u, k);
    const money = l.cents > 0;
    const specials = (money ? [['sale', KIND.sale]] : [['purchase', KIND.purchase]]).concat([['split', 'Split between accounts']]);
    const opts = specials.concat(decisionAccounts(ws, o).map((a) => [a.code, `${a.code} ${a.name}`]));
    const isKind = d.acct === 'purchase' || d.acct === 'sale';
    const showHold = isKind || HOLDING.indexOf(d.acct) >= 0;
    const showInv = INVESTOR.indexOf(d.acct) >= 0;
    const holds = holdingsOf(ws, o.id).map((y) => [y.id, y.name]).concat(d.acct === 'sale' ? [] : [[NEW, 'New investment']]);
    const invs = holdersOf(ws, o.id).map((i) => [i.id, `${i.title} (${i.id})`]);
    return `<li class="bk-entry bb-line" data-k="${k}" data-id="${h(l.id)}">${lineHead(l)}
      <div class="bk-grid">
        ${field(`bb-d-acct-${k}`, 'Account', select(`bb-d-acct-${k}`, `dec.${k}.acct`, opts, d.acct, 'Choose an account'))}
        ${showHold ? field(`bb-d-hold-${k}`, 'Investment', select(`bb-d-hold-${k}`, `dec.${k}.hold`, holds, d.hold, 'Choose an investment')) : ''}
        ${showHold && d.hold === NEW ? field(`bb-d-newname-${k}`, 'New investment', textIn(`bb-d-newname-${k}`, `dec.${k}.newName`, d.newName, ' maxlength="120"')) : ''}
        ${showInv ? field(`bb-d-inv-${k}`, 'Investor', select(`bb-d-inv-${k}`, `dec.${k}.inv`, invs, d.inv, 'Choose an investor')) : ''}
        ${d.acct === 'sale' ? field(`bb-d-cost-${k}`, 'Cost given up', moneyIn(`bb-d-cost-${k}`, `dec.${k}.cost`, d.cost)) : ''}
      </div>
      ${d.acct === 'split' ? splitHTML(ws, o, u, k, d, l) : ''}
      ${errLine(u, 'line-' + k)}
      <div class="cs-row">${btn('bb-post', 'Post', ` data-k="${k}"`, 'cs-btn-primary')}</div>
    </li>`;
  }
  function linesHTML(ws, o, u, acct, can, L) {
    if (!L.rest.length) return '';
    const shown = L.rest.slice(0, u.show);
    return `<h3 class="bk-h3">Lines to decide</h3><ol class="bk-entries">${shown.map((x) => decisionHTML(ws, o, u, x, can)).join('')}</ol>${L.rest.length > shown.length ? `<div class="cs-row">${btn('bb-more', 'Show more')}<span class="cs-hint">${shown.length} of ${L.rest.length} shown</span></div>` : ''}`;
  }

  function doneHTML(ws, o, u, acct, can) {
    const all = bankOf(ws, o.id).lines;
    const done = [];
    all.forEach((l, k) => l && l.account === acct.id && (l.match || l.entry) && done.push({ l, k }));
    if (!done.length) return '';
    done.sort((a, b) => (a.l.date < b.l.date ? 1 : a.l.date > b.l.date ? -1 : b.k - a.k));
    const j = journalOf(ws, o.id);
    const byId = new Map(j.map((e) => [e.id, e]));
    const ct = BK().closedThrough(ws, o.id);
    const shown = done.slice(0, u.showDone);
    const rv = reversedSet(j);
    const item = ({ l, k }) => {
      let what = '';
      let move = '';
      if (l.match) {
        const e = byId.get(l.match.entry);
        what = `Matched: ${e ? `${e.memo || e.id} · ${day(e.date)}` : l.match.entry}`;
        // The record was changed after the match and posted again: offer the new entry.
        if (!e || rv.has(e.id)) {
          const c = BB().candidates(ws, o.id, l.id);
          what = c.length ? 'The matched entry was replaced; move the match to the new one.' : 'The matched entry was replaced and no new entry matches; undo the match.';
          if (can) move = c.map((x) => `<p class="bk-sub">${h(candText(x))}</p><div class="cs-row">${btn('bb-move', 'Move match', ` data-k="${k}" data-entry="${h(x.entry)}" data-line="${x.line}"`, 'cs-btn-primary')}</div>`).join('');
        }
      } else {
        const e = byId.get(l.entry);
        const codes = e ? e.lines.filter((x) => String(x[0]) !== acct.code).map((x) => acctName(ws, o, String(x[0]))) : [];
        what = `Posted: ${Array.from(new Set(codes)).join(', ') || l.entry}`;
      }
      const undo = can && !(ct && l.date <= ct) ? `<div class="cs-row">${btn('bb-undo', 'Undo', ` data-k="${k}"`)}</div>` : '';
      return `<li class="bk-entry bb-done" data-k="${k}" data-id="${h(l.id)}">${lineHead(l)}<p class="bk-sub">${h(what)}</p>${move}${errLine(u, 'line-' + k)}${undo}</li>`;
    };
    return `<h3 class="bk-h3">Decided</h3><ol class="bk-entries">${shown.map(item).join('')}</ol>${done.length > shown.length ? `<div class="cs-row">${btn('bb-more-done', 'Show more')}<span class="cs-hint">${shown.length} of ${done.length} shown</span></div>` : ''}`;
  }

  /* ---------- reconcile ---------- */
  function importsOf(ws, o, acct) {
    return bankOf(ws, o.id).imports.filter((x) => x && x.account === acct.id && typeof x.to === 'string');
  }
  function recDate(ws, o, u, acct) {
    if (u.rec.date) return u.rec.date;
    let to = '';
    importsOf(ws, o, acct).forEach((x) => x.to > to && (to = x.to));
    return to;
  }
  /** The statement balance from the latest import that ends on or before the date, when that file carries one. */
  function fileBalance(ws, o, acct, date) {
    let best = null;
    importsOf(ws, o, acct).forEach((x) => x.to <= date && (!best || x.to >= best.to) && (best = x));
    return best && Number.isSafeInteger(best.closingCents) ? best.closingCents : null;
  }
  function stmtText(ws, o, u, acct, date) {
    if (u.rec.stmt !== null) return u.rec.stmt;
    const c = date ? fileBalance(ws, o, acct, date) : null;
    return c === null ? '' : typed(c);
  }
  function figuresHTML(ws, o, u, acct, can) {
    const date = recDate(ws, o, u, acct);
    if (!date) return '<p class="cs-muted">Choose the statement date.</p>';
    const st = cents(stmtText(ws, o, u, acct, date));
    let r;
    try {
      r = BB().reconcile(ws, o.id, acct.id, date, st.bad || st.empty ? 0 : st.cents);
    } catch (e) {
      return `<p class="bk-err" role="alert">${h(sentence(e))}</p>`;
    }
    const have = !st.bad && !st.empty;
    const sum = (xs) => xs.reduce((t, x) => t + x.cents, 0);
    const dd = (k, label, v) => `<div><dt>${label}</dt><dd class="bb-r-${k}">${v}</dd></div>`;
    // An item with no entry is everything before the opening balance's date that the bank has not shown.
    const outs = r.outstanding.map((x) => `<li>${x.entry ? `${h(day(x.date))} ${h(x.memo || x.entry)}` : h(`Before ${day(r.opening.date)}: in the books, not yet in the bank`)} <span class="bk-code">${usd(x.cents)}</span></li>`).join('');
    let opening = '';
    if (r.opening) {
      const op = acct.opening || null;
      const recs = bankOf(ws, o.id).recs.some((x) => x && x.account === acct.id);
      if (r.opening.cents === null || u.rec.openEdit)
        opening = can
          ? `<div class="bk-grid">${field('bb-r-open', `Opening balance at ${h(day(r.opening.date))}`, moneyIn('bb-r-open', 'rec.open', u.rec.open || ''))}</div><p class="cs-hint">The bank balance when the first statement starts: its beginning balance.</p><div class="cs-row">${btn('bb-open-save', 'Save opening balance', '', 'cs-btn-primary')}</div>`
          : '';
      else
        opening = `<p class="bk-sub bb-r-opening">Opening balance at ${h(day(r.opening.date))}: ${usd(r.opening.cents)}${op ? `, entered by ${h(op.by)} on ${h(day(String(op.at || '').slice(0, 10)))}` : ''}.</p>${can && !recs ? `<div class="cs-row">${btn('bb-open-edit', 'Change opening balance')}</div>` : ''}`;
    }
    let diff;
    if (st.bad) diff = h(`Statement balance: ${BAD_AMOUNT}`);
    else if (!have) diff = 'Type the statement balance.';
    else if (r.differenceCents === null) diff = h(`To be confirmed: opening balance at ${day(r.opening.date)}`);
    else diff = usd(r.differenceCents);
    const ok = have && r.differenceCents === 0;
    return `${opening}<dl class="bk-facts">
        ${dd('statement', 'Statement balance', have ? usd(st.cents) : 'Not typed yet')}
        ${dd('book', 'Book balance', usd(r.bookCents))}
        ${dd('out', 'Outstanding items', `${r.outstanding.length} · ${usd(sum(r.outstanding))}`)}
        ${dd('und', 'Lines not yet decided', `${r.undecided.length} · ${usd(sum(r.undecided))}`)}
        ${dd('diff', 'Difference', diff)}
      </dl>
      ${outs ? `<p class="bk-sub">Outstanding items</p><ul class="bk-holds bb-outs">${outs}</ul>` : ''}
      ${errLine(u, 'rec')}
      ${can ? `<div class="cs-row"><button type="button" class="cs-btn cs-btn-small cs-btn-primary" data-action="bb-mark"${ok ? '' : ' disabled'}>Mark reconciled</button></div>` : ''}`;
  }
  function recHTML(ws, o, u, acct, can) {
    if (!bankOf(ws, o.id).lines.some((l) => l && l.account === acct.id)) return '';
    const date = recDate(ws, o, u, acct);
    let last = null;
    bankOf(ws, o.id).recs.forEach((r) => r && r.account === acct.id && (!last || r.asOf >= last.asOf) && (last = r));
    const lastLine = last ? `<p class="bk-closed bb-r-last">Reconciled through ${h(day(last.asOf))} by ${h(last.by)} on ${h(day(String(last.at || '').slice(0, 10)))}.</p>` : '';
    return `<h3 class="bk-h3">Reconcile</h3>${lastLine}<div class="bk-form bb-rec" data-kind="rec"><div class="bk-grid">
        ${field('bb-r-date', 'Statement date', `<input id="bb-r-date" type="date" data-bind="bb:rec.date" value="${h(date)}">`)}
        ${field('bb-r-stmt', 'Statement balance', moneyIn('bb-r-stmt', 'rec.stmt', stmtText(ws, o, u, acct, date)))}
      </div><div id="bb-r-figs">${figuresHTML(ws, o, u, acct, can)}</div></div>`;
  }

  function render(ws, o) {
    const u = ui(o);
    const can = NS.app.can('operate');
    const acct = accountNow(ws, o, u);
    let body = accountsHTML(ws, o, u, acct, can);
    if (acct) {
      const L = openLines(ws, o, u, acct);
      body += fileHTML(ws, o, u, acct, can) + suggestionsHTML(ws, o, u, acct, can, L) + linesHTML(ws, o, u, acct, can, L) + doneHTML(ws, o, u, acct, can) + recHTML(ws, o, u, acct, can);
    }
    return `<div class="bb" data-reads="${u.reads}">${body}</div>`;
  }

  /* ---------- actions ---------- */
  function ctx() {
    const ws = W();
    const id = S().ui.bk && S().ui.bk.fund;
    const o = ws.offerings.find((x) => x.id === id) || ws.offerings[0];
    const u = ui(o);
    return { ws, o, u, acct: accountNow(ws, o, u) };
  }
  /** Run a change; a refusal becomes the slot's one line. Saves when something was done, and draws the page again. */
  function act(slot, fn) {
    return (el) => {
      const c = ctx();
      if (!NS.app.can('operate')) return U.toast('Only your team can do this.');
      const s = typeof slot === 'function' ? slot(el) : slot;
      c.u.err = {};
      try {
        const done = fn(c, el);
        if (done) {
          NS.app.save();
          if (typeof done === 'string') U.toast(done);
        }
      } catch (e) {
        c.u.err[s] = sentence(e);
      }
      NS.app.render();
    };
  }
  const kOf = (el) => Number(el.getAttribute('data-k'));
  const lineAt = (ws, o, k) => {
    const l = bankOf(ws, o.id).lines[k];
    if (!l) throw new Error('That statement line is no longer there; the page has been drawn again.');
    return l;
  };
  const lineSlot = (el) => 'line-' + kOf(el);

  NS.changes['bb-acct'] = (el) => {
    const { u } = ctx();
    u.acct = el.value;
    resetAccount(u);
    NS.app.render();
  };
  NS.actions['bb-acct-add'] = act('acct', ({ u }) => {
    u.form = 'acct';
    u.a = { name: '', last4: '' };
  });
  NS.actions['bb-cancel'] = () => {
    const { u } = ctx();
    u.form = '';
    u.err = {};
    NS.app.render();
  };
  NS.actions['bb-acct-save'] = act('acct', ({ ws, o, u }) => {
    const name = String(u.a.name || '').trim();
    const last4 = String(u.a.last4 || '').trim();
    if (!name) throw new Error('Give the bank account a name.');
    if (!/^\d{4}$/.test(last4)) throw new Error('Type the last four digits of the account number, and only those.');
    const a = BB().addAccount(ws, o.id, { name, last4 });
    CK().audit('Bank account added', `${a.name} ending ${a.last4}, cash account ${a.code}`, o.id, a.id);
    u.form = '';
    u.acct = a.id;
    resetAccount(u);
    return 'Bank account added';
  });
  NS.actions['bb-more'] = () => {
    ctx().u.show += PAGE;
    NS.app.render();
  };
  NS.actions['bb-more-done'] = () => {
    ctx().u.showDone += PAGE;
    NS.app.render();
  };

  /* ---------- the statement file ---------- */
  /** The parsed statement with every line's text and reference cut to the last four of any account number. */
  const masked = (p) => Object.assign({}, p, { lines: p.lines.map((l) => Object.assign({}, l, { text: mask(l.text), ref: mask(l.ref) })) });
  /**
   * Store the lines and keep the file's bytes; the result in one line. allowOverlap adds lines that match lines already
   * imported from another file (the sponsor said so); without it they are left out and counted as already imported.
   */
  async function commitImport(ws, o, u, p, allowOverlap) {
    const acct = bankOf(ws, o.id).accounts.find((a) => a.id === p.acct);
    if (!acct) throw new Error('That bank account is no longer there.');
    const sha = NS.audit.sha256(new Uint8Array(p.bytes));
    const fileId = `bank-${o.id}-${acct.id}-${sha.slice(0, 16)}`;
    const r = BB().importLines(ws, o.id, acct.id, p.parsed, { allowOverlap: !!allowOverlap, name: p.name, sha256: sha, fileId, by: actor(), at: new Date().toISOString() });
    if (r.added) {
      await NS.ops.files.put(fileId, new Blob([p.bytes], { type: p.type || 'application/octet-stream' }));
      CK().audit('Bank statement imported', `${p.name}, SHA-256 ${sha}: ${plural(r.added, 'line', 'lines')} added to ${acct.name} ending ${acct.last4}.`, o.id, fileId);
    }
    NS.app.save();
    u.pending = null;
    u.result = `${plural(r.added, 'new line', 'new lines')}, ${r.skipped + (allowOverlap ? 0 : r.overlap)} already imported.`;
  }
  /** Import, or first ask when some lines match lines already imported from another file (tried on a copy of the fund). */
  async function offer(ws, o, u, p) {
    const books = ws.books && ws.books.funds ? ws.books : { v: 1, funds: {} };
    const funds = Object.assign({}, books.funds);
    if (funds[o.id]) funds[o.id] = JSON.parse(JSON.stringify(funds[o.id]));
    const dry = Object.assign({}, ws, { books: Object.assign({}, books, { funds }) });
    const r = BB().importLines(dry, o.id, p.acct, p.parsed, {});
    if (r.overlap) {
      p.stage = 'overlap';
      p.counts = r;
      u.pending = p;
      return;
    }
    await commitImport(ws, o, u, p, false);
  }
  /** A statement in columns: read with the account's kept layout, or the layout form when it has none or it no longer fits. */
  async function columns(ws, o, u, acct, p, text) {
    p.text = text;
    p.rows = BF().csvRows(text).filter((r) => r.length);
    if (acct.map) {
      try {
        p.parsed = masked(BF().parse(text, { kind: 'csv', map: acct.map }));
        return offer(ws, o, u, p);
      } catch (e) {
        u.err.file = `${sentence(e)} Check the columns below.`;
      }
    }
    p.form = formOf(acct.map || BF().csvGuess(p.rows));
    p.stage = 'layout';
    u.pending = p;
  }
  NS.changes['bb-file'] = async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const { ws, o, u, acct } = ctx();
    if (!NS.app.can('operate')) return U.toast('Only your team can do this.');
    u.err = {};
    u.result = '';
    u.pending = null;
    try {
      if (!acct) throw new Error('Add the bank account first.');
      const max = BF().LIMITS.bytes;
      if (file.size > max) throw new Error(`This file is larger than ${max / 1000000} MB; download a shorter period from the bank.`);
      const bytes = await file.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(bytes);
      const kind = BF().detect(text);
      if (!kind) throw new Error(NOT_STATEMENT);
      const p = { name: mask(file.name), type: file.type || '', bytes, acct: acct.id, kind };
      if (kind === 'csv') await columns(ws, o, u, acct, p, text);
      else {
        p.parsed = masked(BF().parse(text, { kind }));
        await offer(ws, o, u, p);
      }
    } catch (e) {
      u.err.file = sentence(e);
      u.pending = null;
    }
    try {
      el.value = '';
    } catch (e) {
      /* the next drawing replaces the input anyway */
    }
    u.reads++;
    NS.app.render();
  };
  /** An action on the file waiting for an answer: a refusal becomes the file's one line; the page is drawn again. */
  const pendingAct = (fn) => async () => {
    const c = ctx();
    if (!NS.app.can('operate')) return U.toast('Only your team can do this.');
    const p = c.u.pending;
    c.u.err = {};
    if (p && c.acct && p.acct === c.acct.id) {
      try {
        await fn(c, p);
      } catch (e) {
        c.u.err.file = sentence(e);
      }
    } else c.u.pending = null;
    c.u.reads++;
    NS.app.render();
  };
  NS.actions['bb-layout-use'] = pendingAct(async ({ ws, o, u, acct }, p) => {
    const map = mapOf(p.form);
    p.parsed = masked(BF().parse(p.text, { kind: 'csv', map }));
    BB().setMap(ws, o.id, acct.id, map);
    NS.app.save();
    await offer(ws, o, u, p);
  });
  NS.actions['bb-overlap-add'] = pendingAct(({ ws, o, u }, p) => commitImport(ws, o, u, p, true));
  NS.actions['bb-overlap-new'] = pendingAct(({ ws, o, u }, p) => commitImport(ws, o, u, p, false));
  NS.actions['bb-pending-cancel'] = () => {
    const { u } = ctx();
    u.pending = null;
    u.err = {};
    u.result = '';
    NS.app.render();
  };

  /* ---------- matches and decisions ---------- */
  function logMatch(ws, o, l, target) {
    const e = journalOf(ws, o.id).find((x) => x.id === target.entry);
    CK().audit('Bank line matched', `${l.date} ${l.text}: ${usd(l.cents)} matched to ${e ? e.memo || e.id : target.entry}`, o.id, l.id);
  }
  NS.actions['bb-accept'] = act(lineSlot, ({ ws, o }, el) => {
    const l = lineAt(ws, o, kOf(el));
    const c = BB().candidates(ws, o.id, l.id);
    if (c.length !== 1) throw new Error('This line has more than one possible match; choose one.');
    BB().match(ws, o.id, l.id, c[0]);
    logMatch(ws, o, l, c[0]);
    return 'Matched';
  });
  NS.actions['bb-pick'] = act(lineSlot, ({ ws, o }, el) => {
    const l = lineAt(ws, o, kOf(el));
    const target = { entry: el.getAttribute('data-entry'), line: Number(el.getAttribute('data-line')) };
    BB().match(ws, o.id, l.id, target);
    logMatch(ws, o, l, target);
    return 'Matched';
  });
  NS.actions['bb-notthis'] = (el) => {
    const { u } = ctx();
    u.notThis[kOf(el)] = true;
    NS.app.render();
  };
  NS.actions['bb-accept-all'] = act('file', ({ ws, o, u, acct }) => {
    const L = openLines(ws, o, u, acct);
    let n = 0;
    L.sug.filter((x) => x.one).forEach((x) => {
      BB().match(ws, o.id, x.l.id, x.c[0]);
      logMatch(ws, o, x.l, x.c[0]);
      n++;
    });
    return n ? `${plural(n, 'line', 'lines')} matched` : false;
  });

  /** The decision typed for line l as books-bank.js takes it, or a sentence about what is missing. */
  function decisionOf(ws, o, u, k, l) {
    const d = decOf(u, k);
    if (!d.acct) throw new Error('Choose an account.');
    const holding = () => {
      if (!d.hold) throw new Error('Choose the investment.');
      if (d.hold !== NEW) return d.hold;
      if (!String(d.newName || '').trim()) throw new Error('Name the new investment.');
      return NEW;
    };
    if (d.acct === 'purchase') return { kind: 'purchase', holding: holding() };
    if (d.acct === 'split') {
      const lines = [];
      d.parts.forEach((r, i) => {
        const n = i + 1;
        const c = cents(r.amt);
        if (!r.acct && c.empty) return;
        if (c.bad || c.cents < 0) throw new Error(`Part ${n}: ${BAD_AMOUNT}`);
        if (!r.acct) throw new Error(`Part ${n}: choose the account.`);
        if (c.empty || !c.cents) throw new Error(`Part ${n}: type its amount.`);
        if (NEEDS_HOLDING.indexOf(r.acct) >= 0 && !r.hold) throw new Error(`Part ${n}: choose the investment.`);
        if (NEEDS_INVESTOR.indexOf(r.acct) >= 0 && !r.inv) throw new Error(`Part ${n}: choose the investor whose capital this is.`);
        const it = { account: r.acct, cents: c.cents };
        if (HOLDING.indexOf(r.acct) >= 0 && r.hold) it.holding = r.hold;
        if (INVESTOR.indexOf(r.acct) >= 0 && r.inv) it.partner = r.inv;
        lines.push(it);
      });
      if (!lines.length) throw new Error('Fill in the parts of the split.');
      const left = splitLeft(d, l);
      if (left) throw new Error(`Off by ${usd(Math.abs(left))}: the parts must add up to the bank amount of ${usd(Math.abs(l.cents))}.`);
      return { kind: 'split', lines };
    }
    if (d.acct === 'sale') {
      const c = cents(d.cost);
      if (c.bad || c.cents < 0) throw new Error(`Cost given up: ${BAD_AMOUNT}`);
      if (c.empty) throw new Error('Type the cost given up: the part of the investment’s cost that was sold.');
      return { kind: 'sale', holding: holding(), costCents: c.cents };
    }
    const out = { kind: 'account', account: d.acct };
    if (HOLDING.indexOf(d.acct) >= 0 && (d.hold || NEEDS_HOLDING.indexOf(d.acct) >= 0)) out.holding = holding();
    if (INVESTOR.indexOf(d.acct) >= 0) {
      if (!d.inv && NEEDS_INVESTOR.indexOf(d.acct) >= 0) throw new Error('Choose the investor whose capital this is.');
      if (d.inv) out.partner = d.inv;
    }
    return out;
  }
  NS.actions['bb-post'] = act(lineSlot, ({ ws, o, u }, el) => {
    const k = kOf(el);
    const l = lineAt(ws, o, k);
    const dec = decisionOf(ws, o, u, k, l);
    // A new investment is added only for this post: taken out again when the post is refused.
    let added = null;
    if (dec.holding === NEW) {
      added = BK().addHolding(ws, o.id, { name: String(decOf(u, k).newName).trim(), kind: 'investment', level: 3 });
      dec.holding = added.id;
    }
    let e;
    try {
      e = BB().categorize(ws, o.id, l.id, dec, { by: actor() });
    } catch (err) {
      if (added) {
        const hs = fundOf(ws, o.id).holdings;
        const i = hs.findIndex((x) => x && x.id === added.id);
        if (i >= 0) hs.splice(i, 1);
      }
      throw err;
    }
    if (added) CK().audit('Investment added', CK().short(added.name), o.id, added.id);
    const acct = bankOf(ws, o.id).accounts.find((a) => a.id === l.account);
    const codes = Array.from(new Set(e.lines.filter((x) => String(x[0]) !== acct.code).map((x) => acctName(ws, o, String(x[0])))));
    CK().audit('Bank line posted', `${l.date} ${l.text}: ${usd(l.cents)} posted to ${codes.join(', ')}`, o.id, e.id);
    delete u.dec[k];
    return 'Posted';
  });
  NS.actions['bb-undo'] = act(lineSlot, ({ ws, o }, el) => {
    const l = lineAt(ws, o, kOf(el));
    const ct = BK().closedThrough(ws, o.id);
    if (ct && l.date <= ct) throw new Error(`The books are closed through ${ct}; reopen them to undo a decision dated on or before that day.`);
    if (l.match) BB().unmatch(ws, o.id, l.id);
    else BB().uncategorize(ws, o.id, l.id, { by: actor() });
    CK().audit('Bank decision undone', `${l.date} ${l.text}: ${usd(l.cents)}`, o.id, l.id);
    return 'Undone';
  });
  NS.actions['bb-split-add'] = (el) => {
    const { u } = ctx();
    decOf(u, kOf(el)).parts.push(blankPart());
    NS.app.render();
  };
  /** A match whose entry was replaced (its record changed and was posted again) moved to the new entry. */
  NS.actions['bb-move'] = act(lineSlot, ({ ws, o }, el) => {
    const l = lineAt(ws, o, kOf(el));
    const target = { entry: el.getAttribute('data-entry'), line: Number(el.getAttribute('data-line')) };
    if (!BB().candidates(ws, o.id, l.id).some((c) => c.entry === target.entry && c.line === target.line)) throw new Error('That entry no longer matches this line; the page has been drawn again.');
    if (l.match) BB().unmatch(ws, o.id, l.id);
    BB().match(ws, o.id, l.id, target);
    logMatch(ws, o, l, target);
    return 'Match moved';
  });

  /* ---------- reconcile ---------- */
  NS.actions['bb-mark'] = act('rec', ({ ws, o, u, acct }) => {
    const date = recDate(ws, o, u, acct);
    const st = cents(stmtText(ws, o, u, acct, date));
    if (st.bad) throw new Error(`Statement balance: ${BAD_AMOUNT}`);
    if (st.empty && !String(stmtText(ws, o, u, acct, date)).trim()) throw new Error('Type the statement balance.');
    const r = BB().markReconciled(ws, o.id, acct.id, date, st.cents, { by: actor() });
    CK().audit('Bank account reconciled', `${acct.name} ending ${acct.last4} at ${date}: statement ${usd(r.statementCents)}, book ${usd(r.bookCents)}, ${plural(r.outstanding.length, 'outstanding item', 'outstanding items')}, difference $0.00`, o.id, acct.id);
    return 'Reconciled';
  });
  NS.actions['bb-open-edit'] = () => {
    const { u } = ctx();
    u.rec.openEdit = true;
    NS.app.render();
  };
  NS.actions['bb-open-save'] = act('rec', ({ ws, o, u, acct }) => {
    const c = cents(u.rec.open);
    if (c.bad) throw new Error(`Opening balance: ${BAD_AMOUNT}`);
    if (!String(u.rec.open || '').trim()) throw new Error('Type the opening balance: the bank balance when the first statement starts.');
    const op = BB().setOpening(ws, o.id, acct.id, c.cents, { by: actor() });
    CK().audit('Bank opening balance entered', `${acct.name} ending ${acct.last4}: ${usd(op.cents)} at ${op.date}, the bank balance when the first statement starts`, o.id, acct.id);
    u.rec.open = '';
    u.rec.openEdit = false;
    return 'Opening balance saved';
  });

  /* ---------- typing: kept in the section's state; the figures are drawn again in place ---------- */
  NS.binders.bb = (path, v) => {
    const { ws, o, u, acct } = ctx();
    const p = path.split('.');
    let t = u;
    for (const key of p.slice(0, -1)) {
      if (t[key] == null || typeof t[key] !== 'object') {
        if (key === 'dec') return;
        if (p[0] === 'dec' && t === u.dec) decOf(u, key);
        else return;
      }
      t = t[key];
    }
    t[p[p.length - 1]] = v;
    if (/^dec\.\d+\.acct$/.test(path) && v === 'split') {
      const d = decOf(u, p[1]);
      if (!d.parts.length) d.parts = [blankPart(), blankPart()];
    }
    if (/^dec\.\d+\.(acct|hold|parts\.\d+\.acct)$/.test(path) || /^pending\.form\./.test(path)) return NS.app.render();
    if (/^dec\.\d+\.parts\.\d+\.amt$/.test(path)) {
      const l = bankOf(ws, o.id).lines[Number(p[1])];
      const out = document.getElementById(`bb-offby-${p[1]}`);
      if (l && out) out.textContent = offText(decOf(u, p[1]), l);
      return;
    }
    if (path === 'rec.date') {
      u.rec.stmt = null;
      return NS.app.render();
    }
    if (path === 'rec.stmt' && acct) {
      const box = document.getElementById('bb-r-figs');
      if (box) box.innerHTML = figuresHTML(ws, o, u, acct, NS.app.can('operate'));
    }
  };

  NS.booksUI.part('bank', { order: 1, title: 'Bank', line: LINE, render });
})(window.CVPortal);
