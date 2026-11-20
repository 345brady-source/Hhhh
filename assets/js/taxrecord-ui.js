/*
 * Tax withheld (self-serve console, a section of the Tax documents page; D-04, TAX-17, C-08): for a fund and a year,
 * each kind of tax withheld from the fund's paid distributions, what the sponsor has marked as deposited and what is not
 * yet deposited; the deposits the sponsor marks (kind, amount, date, confirmation number); the fund's foreign investors
 * with their W-8 facts and the worksheet for the CPA (D-03, TAX-13, TAX-16); the IRS notices about a payee that switch
 * backup withholding on and off (TAX-15). Every change goes through NS.withholding (which writes the change log) and is
 * saved with NS.app.save; the worksheet is handed to the portal's own download helper (U.download), as the ACH file is.
 *
 * Every figure is NS.withholding's (withholding.js): the table draws NS.withholding.totals, which reads only the stored
 * lines of paid distributions; this file adds nothing up for the table and never reads the capital-account engine. The
 * portal moves no money and works out no due date: beside backup withholding and beside withholding on a foreign
 * investor it shows the one rule sentence and its source from NS.withholding.DEPOSIT_RULES.
 *
 * Registered with NS.taxUI.part('withheld', ...) (taxdocs-ui.js loads this file from its fixed list), so its address is
 * console-taxdocs-withheld. Values from the workspace are escaped before they are drawn. No network call is made.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.taxUI || !NS.withholding || !NS.ui) return;
  const U = NS.ui;
  const { h } = U;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const WH = () => NS.withholding;
  const today = () => NS.dates.today();
  const money = (c) => U.usdc(c);
  const redraw = () => NS.app.render();

  /** What is picked on the section, kept across redraws and never stored. */
  function ui() {
    const u = S().ui;
    if (!u.txw) u.txw = { offeringId: '', year: '', msg: '' };
    return u.txw;
  }
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  /** The years in which a fund's paid distributions carry tax withheld in their stored lines (read, not added up). */
  function withheldYears(ws, offeringId) {
    const now = today();
    const out = new Set();
    (ws.runs || []).forEach((r) => {
      if (r.offeringId !== offeringId || !NS.data.runPaid(r, now) || !Array.isArray(r.lines)) return;
      if (r.lines.some((l) => (l.withheld || []).length)) out.add(String(r.date).slice(0, 4));
    });
    return Array.from(out).sort().reverse();
  }
  /** The years offered for a fund: this year, every year it has a distribution, and every year it has a deposit marked. */
  function yearsFor(ws, offeringId) {
    const out = new Set([today().slice(0, 4)]);
    (ws.runs || []).forEach((r) => r.offeringId === offeringId && !r.cancelled && /^\d{4}/.test(String(r.date)) && out.add(String(r.date).slice(0, 4)));
    (ws.taxDeposits || []).forEach((d) => d.offeringId === offeringId && out.add(String(d.year)));
    return Array.from(out).sort().reverse();
  }
  /** The fund and year on screen: the ones picked, else the first fund with tax withheld and its latest such year. */
  function current(ws) {
    const u = ui();
    let o = offeringOf(ws, u.offeringId);
    if (!o) o = (ws.offerings || []).find((x) => withheldYears(ws, x.id).length) || (ws.offerings || [])[0] || null;
    if (!o) return { o: null, year: '', years: [] };
    const years = yearsFor(ws, o.id);
    const year = years.indexOf(String(u.year)) >= 0 ? String(u.year) : withheldYears(ws, o.id)[0] || years[0];
    return { o, year, years };
  }

  /* ---------- the summary line on the Tax documents list ---------- */
  function summary(ws) {
    const out = [];
    let any = false;
    const years = new Set();
    (ws.offerings || []).forEach((o) => withheldYears(ws, o.id).forEach((y) => years.add(y)));
    (ws.taxDeposits || []).forEach((d) => years.add(String(d.year)));
    Array.from(years)
      .sort()
      .reverse()
      .forEach((y) => {
        let open = 0;
        (ws.offerings || []).forEach((o) => {
          if (withheldYears(ws, o.id).indexOf(y) < 0 && !(ws.taxDeposits || []).some((d) => d.offeringId === o.id && String(d.year) === y)) return;
          const T = WH().totals(ws, { offeringId: o.id, year: y, today: today() });
          Object.keys(T).forEach((k) => {
            if (T[k].withheldCents) any = true;
            open += T[k].undepositedCents;
          });
        });
        if (open) out.push(`${money(open)} not yet deposited for ${y}`);
      });
    return out.length ? h(out.join(' · ')) : any ? 'Everything withheld is marked deposited' : '';
  }

  /* ---------- the section's page ---------- */
  const runName = (ws, id) => {
    const r = (ws.runs || []).find((x) => x.id === id);
    return r ? U.date(r.date, 'long') : id;
  };
  /** D5: the paid runs of the year saved before the record existed, named in one line. */
  function recomputedLine(ws, ids) {
    if (!ids || !ids.length) return '';
    const names = ids.map((id) => runName(ws, id));
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `<p class="tx-note" data-recomputed>${ids.length === 1 ? `The distribution of ${h(list)} was` : `The distributions of ${h(list)} were`} worked out again from today’s positions; confirm ${ids.length === 1 ? 'its' : 'their'} lines.</p>`;
  }
  function kindHTML(ws, k, t) {
    const K = WH().KINDS[k];
    const rule = WH().DEPOSIT_RULES[k];
    const inv = (id) => {
      const i = (ws.investors || []).find((x) => x.id === id);
      return i ? i.title : id;
    };
    const items = t.items.map((x) => `<tr data-item><td>${h(U.date(x.date))} · ${h(inv(x.investorId))}${x.recomputed ? ' · worked out again' : ''}</td><td class="num">${money(x.cents)}</td></tr>`).join('');
    return `<section class="tx" data-kind="${h(k)}"><h3>${h(K.label)}</h3>
      <table class="tx-fig"><tbody>
        <tr><th scope="row">Withheld</th><td class="num" data-col="withheld">${money(t.withheldCents)}</td></tr>
        <tr><th scope="row">Deposited</th><td class="num" data-col="deposited">${money(t.depositedCents)}</td></tr>
        <tr><th scope="row">Not yet deposited</th><td class="num" data-col="undeposited">${money(t.undepositedCents)}</td></tr>
      </tbody>${items ? `<tbody data-items><tr><th colspan="2">By payment</th></tr>${items}</tbody>` : ''}</table>
      ${rule ? `<p class="tx-note" data-rule>${h(rule.text)} (${h(rule.source)})</p>` : ''}
      ${recomputedLine(ws, t.recomputedRuns)}
    </section>`;
  }
  function render(ws) {
    const c = current(ws);
    if (!c.o) return CK().panel('', '<p class="cs-muted">No fund yet.</p>');
    const picker = CK().panel(
      '',
      `<div class="tx-form">
        <label class="cs-field" for="txw-fund"><span>Fund</span><select id="txw-fund" data-change="txw-fund">${(ws.offerings || []).map((o) => `<option value="${h(o.id)}"${o.id === c.o.id ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
        <label class="cs-field" for="txw-year"><span>Year</span><select id="txw-year" data-change="txw-year">${c.years.map((y) => `<option value="${h(y)}"${y === c.year ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
      </div>`
    );
    const T = WH().totals(ws, { offeringId: c.o.id, year: c.year, today: today() });
    const shown = Object.keys(WH().KINDS).filter((k) => T[k].withheldCents || T[k].depositedCents);
    const anyKind = T[Object.keys(T)[0]] || { recomputedRuns: [] };
    const body = shown.length
      ? `<div class="tx">${shown.map((k) => kindHTML(ws, k, T[k])).join('')}</div>`
      : `<p class="tx-note" data-empty>Nothing was withheld from this fund’s distributions paid in ${h(c.year)}.</p>${recomputedLine(ws, anyKind.recomputedRuns)}`;
    const can = NS.app.can('operate');
    const kinds = Object.keys(WH().KINDS).filter((k) => T[k].withheldCents);
    return `${picker}${CK().panel(`Tax withheld in ${h(c.year)}`, body)}${can && kinds.length ? depositHTML(kinds) : ''}${foreignHTML(ws, c)}${noticesHTML(ws, c, can)}`;
  }

  /* ---------- marking a deposit (the sponsor's statement; the portal moves no money) ---------- */
  const said = (at) => {
    const m = ui().msg;
    return m && m.at === at ? `<p class="tx-note is-stop" role="alert">${h(m.text)}</p>` : '';
  };
  const val = (v) => (v ? ` value="${h(v)}"` : '');
  function depositHTML(kinds) {
    const d = ui().dep || {};
    return CK().panel(
      'Mark deposited',
      `${said('dep')}<div class="tx-form">
        <label class="cs-field" for="txw-dep-kind"><span>Kind</span><select id="txw-dep-kind">${kinds.map((k) => `<option value="${h(k)}"${k === d.kind ? ' selected' : ''}>${h(WH().KINDS[k].label)}</option>`).join('')}</select></label>
        <label class="cs-field" for="txw-dep-amount"><span>Amount</span><input id="txw-dep-amount" type="text" inputmode="decimal" autocomplete="off"${val(d.amount)}></label>
        <label class="cs-field" for="txw-dep-date"><span>Date</span><input id="txw-dep-date" type="date"${val(d.date)}></label>
        <label class="cs-field" for="txw-dep-conf"><span>Confirmation number</span><input id="txw-dep-conf" type="text" autocomplete="off"${val(d.conf)}></label>
      </div>
      <div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="txw-deposit">Mark deposited</button></div>`
    );
  }
  /** Dollars as typed ("1,000.00", "$1000", "1000.5") in whole cents; '' when nothing is typed; NaN when it is not an amount. */
  function centsOf(s) {
    const t = String(s || '').replace(/[$,\s]/g, '');
    if (!t) return '';
    const m = /^(\d{1,11})(?:\.(\d{1,2}))?$/.exec(t);
    return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : NaN;
  }

  /* ---------- the fund's foreign investors and the worksheet for the CPA (D-03, TAX-13, TAX-16) ---------- */
  /** What NS.withholding.w8 says on today's date, in one line. */
  function w8Line(f) {
    const bits = [f.form || 'No W-8 on file'];
    if (f.form) bits.push(f.signed ? 'signed' : 'not signed');
    if (f.validUntil) bits.push(`${f.flags.indexOf('expired') >= 0 ? 'expired, ' : ''}valid until ${U.date(f.validUntil, 'long')}`);
    bits.push(f.ftin === 'on file' ? 'foreign tax number on file' : f.ftin === 'not required' ? 'no foreign tax number required' : 'no foreign tax number on file');
    return bits.join(' · ');
  }
  function foreignHTML(ws, c) {
    const rows = WH().worksheet(ws, { offeringId: c.o.id, year: c.year, today: today() }).rows;
    if (!rows.length) return CK().panel('Foreign investors', '<p class="cs-muted">None in this fund.</p>');
    const list = rows
      .map((r) => {
        const inv = (ws.investors || []).find((i) => i.id === r.investorId);
        return `<li class="tx-row" data-id="${h(r.investorId)}"><div class="tx-what"><span class="tx-title">${h(r.name)} · ${h(r.investorId)}</span><span class="tx-detail">${h(w8Line(WH().w8(inv, today())))}</span></div></li>`;
      })
      .join('');
    return CK().panel('Foreign investors', `<ul class="tx-list" data-list="foreign">${list}</ul><div class="cs-row"><button class="cs-btn" type="button" data-action="txw-worksheet">Download worksheet for your CPA</button></div>`);
  }

  /* ---------- IRS notices about a payee (Publication 1099 part N; TAX-15) ---------- */
  const NOTICE = { 'wrong-number': 'Wrong taxpayer number', underreporting: 'Underreporting' };
  const holdersOf = (ws, offeringId) => (ws.investors || []).filter((i) => (i.positions || []).some((p) => p.offeringId === offeringId));
  function noticesHTML(ws, c, can) {
    const holders = holdersOf(ws, c.o.id)
      .slice()
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
    const n = ui().notice || {};
    const rows = holders
      .filter((i) => i.irsNotice)
      .map((i) => {
        const x = i.irsNotice;
        const what = [NOTICE[x.kind] || x.kind, `arrived ${U.date(x.received, 'long')}`].concat(x.ended ? [`ended ${U.date(x.ended, 'long')}`] : []).join(' · ');
        const end =
          !x.ended && can
            ? `<div class="tx-form"><label class="cs-field" for="txw-end-${h(i.id)}"><span>Ended</span><input id="txw-end-${h(i.id)}" type="date" data-end="${h(i.id)}"></label><button class="cs-btn cs-btn-small" type="button" data-action="txw-notice-end" data-id="${h(i.id)}">Mark ended</button></div>`
            : '';
        return `<li class="tx-row" data-id="${h(i.id)}"><div class="tx-what"><span class="tx-title">${h(i.title)} · ${h(i.id)}</span><span class="tx-detail">${h(what)}</span></div>${end}</li>`;
      })
      .join('');
    const form = can
      ? `<div class="tx-form">
        <label class="cs-field" for="txw-notice-inv"><span>Investor</span><select id="txw-notice-inv"><option value="">Choose</option>${holders.map((i) => `<option value="${h(i.id)}"${i.id === n.inv ? ' selected' : ''}>${h(i.title)} · ${h(i.id)}</option>`).join('')}</select></label>
        <label class="cs-field" for="txw-notice-kind"><span>Notice</span><select id="txw-notice-kind">${Object.keys(NOTICE).map((k) => `<option value="${k}"${k === n.kind ? ' selected' : ''}>${NOTICE[k]}</option>`).join('')}</select></label>
        <label class="cs-field" for="txw-notice-date"><span>Arrived</span><input id="txw-notice-date" type="date"${val(n.date)}></label>
      </div>
      <div class="cs-row"><button class="cs-btn" type="button" data-action="txw-notice">Record notice</button></div>`
      : '';
    return CK().panel('IRS notices', `<p class="tx-stop">${h(WH().STOPS['irs-notice'])}</p>${said('notice')}<ul class="tx-list" data-list="notices">${rows}</ul>${form}`);
  }

  /* ---------- picking and acting ---------- */
  NS.changes['txw-fund'] = (el) => {
    const u = ui();
    u.offeringId = el.value;
    u.year = '';
    u.msg = '';
    redraw();
  };
  NS.changes['txw-year'] = (el) => {
    const u = ui();
    u.year = el.value;
    u.msg = '';
    redraw();
  };
  const typed = (id) => String((document.getElementById(id) || {}).value || '').trim();
  /** One action: refused with one line where it was asked; on success saved (the module writes the change log). */
  function act(at, fn) {
    return (el) => {
      const ws = NS.state.ws;
      if (!NS.app.can('operate')) return;
      const u = ui();
      const c = current(ws);
      if (!c.o) return;
      try {
        fn(ws, c, el, u);
        u.msg = '';
        NS.app.save(true);
      } catch (e) {
        u.msg = { at, text: (e && e.message) || 'That could not be done.' };
      }
      redraw();
    };
  }
  NS.actions['txw-deposit'] = act('dep', (ws, c, el, u) => {
    const d = { kind: typed('txw-dep-kind'), amount: typed('txw-dep-amount'), date: typed('txw-dep-date'), conf: typed('txw-dep-conf') };
    u.dep = d;
    const cents = centsOf(d.amount);
    if (cents === '') throw new Error('Enter the amount deposited.');
    if (Number.isNaN(cents)) throw new Error('Enter the amount in dollars and cents, such as 1000.00.');
    if (!cents) throw new Error('Enter an amount above $0.00.');
    if (!d.date) throw new Error('Enter the date of the deposit.');
    if (!d.conf) throw new Error('Enter the confirmation number.');
    WH().addDeposit(ws, { offeringId: c.o.id, kind: d.kind, year: c.year, cents, date: d.date, confirmation: d.conf, by: NS.app.actor() });
    u.dep = {};
  });
  NS.actions['txw-notice'] = act('notice', (ws, c, el, u) => {
    const n = { inv: typed('txw-notice-inv'), kind: typed('txw-notice-kind'), date: typed('txw-notice-date') };
    u.notice = n;
    if (!n.inv || !holdersOf(ws, c.o.id).some((i) => i.id === n.inv)) throw new Error('Choose the investor.');
    if (!n.date) throw new Error('Enter the date the notice arrived.');
    WH().addNotice(ws, n.inv, { kind: n.kind, received: n.date, by: NS.app.actor() });
    u.notice = {};
  });
  NS.actions['txw-notice-end'] = act('notice', (ws, c, el) => {
    const id = el.getAttribute('data-id');
    const box = Array.from(document.querySelectorAll('[data-end]')).find((x) => x.getAttribute('data-end') === id);
    const ended = String((box && box.value) || '').trim();
    if (!ended) throw new Error('Enter the date the notice ended.');
    WH().endNotice(ws, id, { ended, by: NS.app.actor() });
  });
  NS.actions['txw-worksheet'] = (el) => {
    const ws = NS.state.ws;
    if (!NS.app.can('operate')) return;
    const c = current(ws);
    if (!c.o) return;
    const sheet = WH().worksheet(ws, { offeringId: c.o.id, year: c.year, today: today() });
    const slug = String(c.o.shortName || c.o.name || c.o.id).replace(/<[^>]*>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fund';
    U.download(`${slug}_withholding_worksheet_${c.year}.csv`, sheet.csv, { mime: 'text/csv' });
    CK().audit('Withholding worksheet downloaded', `${c.o.shortName || c.o.name}: ${c.year}, ${sheet.rows.length} foreign investor${sheet.rows.length === 1 ? '' : 's'}`, c.o.id, c.o.id);
    NS.app.save(true);
  };

  NS.taxUI.part('withheld', { order: 20, title: 'Tax withheld', summary, render });
  NS.taxUI.refresh();
})(window.CVPortal);
