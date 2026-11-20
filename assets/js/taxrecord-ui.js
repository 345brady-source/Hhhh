/*
 * Tax withheld (self-serve console, a section of the Tax documents page; D-04, TAX-17, C-08): for a fund and a year,
 * each kind of tax withheld from the fund's paid distributions, what the sponsor has marked as deposited and what is not
 * yet deposited.
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
    const u = ui();
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
    const msg = u.msg ? `<p class="tx-note is-stop" role="alert">${h(u.msg)}</p>` : '';
    return `${picker}${msg}${CK().panel(`Tax withheld in ${h(c.year)}`, body)}`;
  }

  /* ---------- picking ---------- */
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

  NS.taxUI.part('withheld', { order: 20, title: 'Tax withheld', summary, render });
  NS.taxUI.refresh();
})(window.CVPortal);
