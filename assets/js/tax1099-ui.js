/*
 * Form 1099 (self-serve console, a section of the Tax documents page; plan 10-10, D-02, C-01, C-05, TAX-07, TAX-08,
 * TAX-10, TAX-11, TAX-12). For a fund whose tax reporting type is notes and a tax year: each Form 1099-INT's two figures
 * (interest paid, federal income tax withheld) as NS.tax1099.figuresInt gives them from the stored payment lines, each
 * investor left out with the reason, and every stop with its one sentence naming the CPA. The sponsor confirms each form
 * against the bank (NS.tax1099.confirmTotals); a later change to the payments withdraws it (NS.tax1099.confirmed). Nothing
 * is typed into a box: this file draws the module's figures and adds nothing up itself.
 *
 * Taxpayer numbers (C-05): the payer's number is typed each time; each recipient's is read from the signed W-9 in this
 * browser's file store (NS.tax1099.readW9) or typed, and accepted only when it ends in the four on record
 * (NS.tax1099.checkTin). They live in one variable of this file (held) while the file is made, and it is emptied once
 * the file has been made, when the fund or year changes and when the page is left. Nothing with a number in it is
 * passed to NS.app.save, the change log or the browser's storage; the screen says "ending 1234". A field that held a
 * typed number is never drawn again with it.
 *
 * The IRS file (C-01): rows from NS.tax1099.iris.row, checked by iris.validate, built by iris.files (which refuses while a
 * fault stands) and handed to the portal's download helper (U.download), as the ACH file is. The sponsor uploads it on
 * the IRS's own site; the portal keeps only its SHA-256 and row count on the fund's year record.
 *
 * Form 1099-DIV (plan 10-11, D-02, C-07, TAX-09): for a fund whose tax reporting type is corporation or REIT the same
 * section shows, before the forms, each distribution paid in the year with the split the sponsor enters from the CPA
 * (NS.tax1099.setSplit, which refuses a split that breaks a rule and names it; the portal never proposes one), the IRS's
 * whole-payment rule as one line applied only when its button is pressed (NS.tax1099.wholeDividend), and one line naming
 * Form 5452 when a box 3 is above zero. The review, numbers, copies, file and receipt steps are Form 1099-INT's with the
 * form type of the fund (NS.tax1099.formTypeOf).
 *
 * Registered with NS.taxUI.part('1099', ...) (taxdocs-ui.js loads this file from its fixed list): address
 * console-taxdocs-1099. Making the numbers step, the copies and the file is for admins (NS.app.can('configure')); a team
 * member reviews and confirms totals. Values from the workspace are escaped before they are drawn. No network call is
 * made on any path: the form data and the IRS file's rules are loaded as scripts from beside this file.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.taxUI || !NS.tax1099 || !NS.withholding || !NS.ui || !NS.EDITION || !NS.EDITION.diy) return;
  const U = NS.ui;
  const { h } = U;
  const CK = () => NS.consoleKit;
  const S = () => NS.state;
  const X = () => NS.tax1099;
  const WH = () => NS.withholding;
  const today = () => NS.dates.today();
  const money = (c) => U.usdc(c);
  const redraw = () => NS.app.render();
  const actor = () => NS.app.actor();
  const admin = () => NS.app.can('configure');
  const KEY = '1099';
  const ROUTE = 'console-taxdocs-1099';
  /** The form of the fund on screen: '1099-DIV' for corporation or REIT, '1099-INT' for notes. */
  const formOf = (o) => X().formTypeOf(o);
  const isDiv = (c) => !!(c && c.o) && formOf(c.o) === '1099-DIV';

  /* ---------- scripts loaded from beside this file (no fetch) ---------- */
  const HERE = (document.currentScript && document.currentScript.src) || '';
  const near = (rel) => {
    try {
      return HERE ? new URL(rel, HERE).href : new URL(`assets/js/${rel}`, document.baseURI).href;
    } catch (e) {
      return rel;
    }
  };
  const load = (rel, ready) => NS.esignKit.loadScript(near(rel), ready);
  const irisReady = () => !!(NS.tax1099data && NS.tax1099data.IRIS);
  const irisData = () => load('tax1099-data.js', irisReady);

  /* ---------- what is open on the section (never stored) ---------- */
  function ui() {
    const u = S().ui;
    if (!u.t99) u.t99 = { offeringId: '', year: '', msg: null, edit: {} };
    return u.t99;
  }
  /**
   * The numbers, in this file's memory only: { key, payer: { tin, tinType } | null, rec: { [id]: { tin, tinType, from,
   * proposal } }, w9: { [id]: 'failed' }, reading, after }. after: the file was made and the numbers forgotten; the signed
   * W-9s are read again only when a person asks (Check numbers, a copy or a file).
   */
  let held = fresh('');
  function fresh(key, after) {
    return { key, payer: null, rec: {}, w9: {}, reading: null, after: !!after };
  }
  /** Forget every number (the file was made, the fund or year changed, or the page was left). */
  function forget() {
    held = fresh('');
  }
  window.addEventListener('hashchange', () => {
    if (String(location.hash).indexOf('#' + ROUTE) !== 0) forget();
  });

  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  /** The funds this section prepares a form for: notes (Form 1099-INT) and corporation or REIT (Form 1099-DIV). */
  const notesFunds = (ws) => (ws.offerings || []).filter((o) => ['notes', 'corp'].indexOf(WH().reporting(o)) >= 0);
  /** The years offered for a fund: the year before this one and every year it has a payment. */
  function yearsFor(ws, o) {
    const out = new Set([String(Number(today().slice(0, 4)) - 1)]);
    (ws.runs || []).forEach((r) => r.offeringId === o.id && !r.cancelled && /^\d{4}/.test(String(r.date)) && String(r.date) <= today() && out.add(String(r.date).slice(0, 4)));
    return Array.from(out).sort().reverse();
  }
  /** The fund and year on screen: the ones picked, else the first notes fund and the year before this one. */
  function current(ws) {
    const u = ui();
    const funds = notesFunds(ws);
    const o = funds.find((x) => x.id === u.offeringId) || funds[0] || null;
    if (!o) return { o: null, funds, year: '', years: [] };
    const years = yearsFor(ws, o);
    const year = years.indexOf(String(u.year)) >= 0 ? String(u.year) : String(Number(today().slice(0, 4)) - 1);
    const key = `${o.id}|${year}`;
    if (held.key !== key) held = fresh(key);
    return { o, funds, year, years };
  }
  const figures = (ws, c) => X().figuresFor(ws, c.o, c.year, { today: today() });
  const yearRecOf = (o, y) => (((o.tax || {}).years || {})[y] || {});
  const allConfirmed = (ws, c, F) => F.forms.length > 0 && F.forms.every((f) => X().confirmed(ws, c.o, c.year, f));
  const ready = (ws, c, F) => !F.stops.length && allConfirmed(ws, c, F);

  /* ---------- the summary line on the Tax documents list ---------- */
  function summary(ws) {
    const out = [];
    notesFunds(ws).forEach((o) => {
      const year = String(Number(today().slice(0, 4)) - 1);
      const F = X().figuresFor(ws, o, year, { today: today() });
      const n = F.forms.filter((f) => X().confirmed(ws, o, year, f)).length;
      out.push(`${o.shortName || o.name} ${year}: ${F.stops.length ? 'an answer is needed' : `${F.forms.length} form${F.forms.length === 1 ? '' : 's'}, ${n} confirmed`}`);
    });
    return h(out.join(' · '));
  }

  /* ---------- the section's page ---------- */
  const said = (at) => {
    const m = ui().msg;
    return m && m.at === at ? `<p class="tx-note is-stop" role="alert">${h(m.text)}</p>` : '';
  };
  const ending = (l4) => (l4 ? `ending ${h(l4)}` : 'no number on record');
  function pickerHTML(c) {
    return CK().panel(
      '',
      `<div class="tx-form">
        <label class="cs-field" for="t99-fund"><span>Fund</span><select id="t99-fund" data-change="t99-fund">${c.funds.map((o) => `<option value="${h(o.id)}"${o.id === c.o.id ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
        <label class="cs-field" for="t99-year"><span>Tax year</span><select id="t99-year" data-change="t99-year">${c.years.map((y) => `<option value="${h(y)}"${y === c.year ? ' selected' : ''}>${h(y)}</option>`).join('')}</select></label>
      </div>`
    );
  }
  const stopsHTML = (F) =>
    F.stops
      .filter((s) => s.code !== 'split')
      .map((s) => `<p class="tx-stop" data-stop="${h(s.code)}">${h(s.text)}</p>`)
      .join('');
  /**
   * What a person answers so a stop goes: "Is this payment interest?" for a payment whose type does not say (never
   * guessed), and Confirm amounts, with the shares worked out from the positions, for an interest payment saved before
   * amounts were stored (plan 10-01).
   */
  function answersHTML(ws, c) {
    const runs = isDiv(c) ? X().divRuns(ws, c.o, c.year, today()).map((r) => Object.assign({ counts: 'interest' }, r)) : X().interestRuns(ws, c.o, c.year, today());
    const can = NS.app.can('operate');
    const ask = runs
      .filter((r) => r.counts === 'ask')
      .map(({ run }) => `<li class="tx-row" data-id="${h(run.id)}"><div class="tx-what"><span class="tx-title">Is this payment interest?</span><span class="tx-detail">${h(U.date(run.date, 'long'))} · ${h(run.type || 'No type')} · ${money(run.total)}</span></div>${can ? `<div class="tx-acts"><button type="button" class="cs-btn cs-btn-small" data-action="t99-interest" data-run="${h(run.id)}" data-yes="1">Yes</button><button type="button" class="cs-btn cs-btn-small" data-action="t99-interest" data-run="${h(run.id)}" data-yes="0">No</button></div>` : ''}</li>`)
      .join('');
    const unstored = runs
      .filter((r) => r.counts === 'interest' && !r.stored)
      .map(({ run }) => {
        const shares = NS.data
          .runLines(ws, run)
          .lines.map((l) => `${h((investorOf(ws, l.investorId) || {}).title || l.investorId)} · ${h(l.investorId)} ${money(l.grossCents)}`)
          .join('<br>');
        return `<li class="tx-row" data-id="${h(run.id)}"><div class="tx-what"><span class="tx-title">${h(U.date(run.date, 'long'))} · ${h(run.type)} · ${money(run.total)}</span><span class="tx-detail">${shares}</span></div>${can ? `<div class="tx-acts"><button type="button" class="cs-btn cs-btn-small" data-action="t99-lines" data-run="${h(run.id)}">Confirm amounts</button></div>` : ''}</li>`;
      })
      .join('');
    return (ask ? `<ul class="tx-list" data-list="ask">${ask}</ul>` : '') + (unstored ? `<ul class="tx-list" data-list="unstored">${unstored}</ul>` : '');
  }
  /** One form, its values in the form's own order (also what is keyed on the IRS site by hand). */
  function formRow(ws, c, f) {
    const inv = investorOf(ws, f.investorId) || {};
    const ok = X().confirmed(ws, c.o, c.year, f);
    const conf = (yearRecOf(c.o, c.year).confirmed || {})[f.investorId];
    const filed = ok ? filedOn(c.o, c.year, f.investorId) : '';
    const pill = (ok ? `<span class="tx-pill is-ok">Confirmed by ${h(conf.by)}</span>` : '<span class="tx-pill is-wait">Not confirmed</span>') + (filed ? `<span class="tx-pill is-ok">Filed ${h(U.date(filed, 'long'))}</span>` : '');
    const btns = [];
    if (!ok && NS.app.can('operate')) btns.push(`<button type="button" class="cs-btn cs-btn-small cs-btn-primary" data-action="t99-confirm" data-id="${h(f.investorId)}">Confirm</button>`);
    if (admin()) btns.push(`<button type="button" class="cs-btn cs-btn-small" data-action="t99-exempt" data-id="${h(f.investorId)}">Exempt recipient</button>`);
    const acts = btns.length ? `<div class="tx-acts">${btns.join('')}</div>` : '';
    const boxes = f.boxes
      ? DIV_BOXES.filter(([b]) => ALWAYS.indexOf(b) >= 0 || f.boxes[b] > 0)
          .map(([b, label]) => `<dt>${b} ${label}</dt><dd data-box="${b}">${f.boxes[b] ? money(f.boxes[b]) : ''}</dd>`)
          .join('')
      : `<dt>1 Interest income</dt><dd data-box="1">${money(f.box1Cents)}</dd>
        <dt>4 Federal income tax withheld</dt><dd data-box="4">${f.box4Cents ? money(f.box4Cents) : ''}</dd>`;
    return `<li class="tx-row" data-id="${h(f.investorId)}"><div class="tx-what"><span class="tx-title">${h(inv.title || f.investorId)} · ${h(f.investorId)}</span>
      <dl class="tx-review">
        <dt>Recipient’s number</dt><dd>${ending(X().last4Of(inv))}</dd>
        ${boxes}
      </dl></div><div class="tx-when">${pill}</div>${acts}</li>`;
  }
  function formsHTML(ws, c, F) {
    if (!F.forms.length) return '';
    // a return of capital in box 3: the corporation's own filing, one line (Instructions for Form 1099-DIV)
    const f5452 = F.forms.some((f) => f.boxes && f.boxes['3'] > 0) ? `<p class="tx-note" data-notice="5452">${h(X().DIV_TEXT.f5452)}</p>` : '';
    return CK().panel(`Forms <span class="cs-count">${F.forms.length}</span>`, `${said('forms')}${f5452}<ul class="tx-list" data-list="forms">${F.forms.map((f) => formRow(ws, c, f)).join('')}</ul>`);
  }
  function leftHTML(ws, F) {
    if (!F.leftOut.length) return '';
    const rows = F.leftOut
      .map((x) => {
        const inv = investorOf(ws, x.investorId) || {};
        const undo = x.code === 'exempt' && admin() ? `<div class="tx-acts"><button type="button" class="cs-btn cs-btn-small" data-action="t99-unexempt" data-id="${h(x.investorId)}">Not exempt</button></div>` : '';
        return `<li class="tx-row" data-id="${h(x.investorId)}"><div class="tx-what"><span class="tx-title">${h(inv.title || x.investorId)} · ${h(x.investorId)}</span><span class="tx-detail">${h(x.reason)} · ${money(x.cents)}</span></div>${undo}</li>`;
      })
      .join('');
    return CK().panel(`Left out <span class="cs-count">${F.leftOut.length}</span>`, `<ul class="tx-list" data-list="leftout">${rows}</ul>`);
  }

  /* ---------- the numbers step (admins; once every form is confirmed and no stop stands) ---------- */
  const SPLIT = ['nameType', 'first', 'middle', 'last', 'suffix', 'bname', 'address1', 'address2', 'city', 'state', 'zip'];
  const LABEL = { first: 'First name', middle: 'Middle name', last: 'Last name', suffix: 'Suffix', bname: 'Business name', address1: 'Street address', address2: 'Second address line', city: 'City', state: 'State', zip: 'ZIP' };
  /** The investor's own name and address as the IRS file's cells: from the W-9 when it was read, else from the record. */
  function proposal(inv, w9) {
    const indiv = !inv.type || inv.type === 'individual';
    const nameLine = (w9 && w9.name) || inv.title || '';
    const n = X().splitName(nameLine);
    let address1 = '';
    let rest = '';
    if (w9 && w9.address) {
      address1 = w9.address;
      rest = w9.cityStateZip || '';
    } else {
      const parts = String(inv.address || '').split(',');
      address1 = (parts.shift() || '').trim();
      rest = parts.join(',').trim();
    }
    const csz = X().splitCityStateZip(rest);
    const plain = (s) => String(s || '').replace(/[^A-Za-z0-9 /-]/g, ' ').replace(/\s+/g, ' ').trim();
    return { nameType: indiv ? 'I' : 'B', first: n.first, middle: n.middle, last: n.last, suffix: n.suffix, bname: indiv ? '' : plain(nameLine).slice(0, 40), address1: plain(address1), address2: '', city: String(csz.city || '').replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim(), state: csz.state, zip: csz.zip };
  }
  const edit = (id) => ui().edit[id] || {};
  function cells(ws, id) {
    const p = held.rec[id] && held.rec[id].proposal ? held.rec[id].proposal : proposal(investorOf(ws, id) || {}, null);
    return Object.assign({}, p, edit(id));
  }
  /** The signed W-9 of an investor as kept in this browser: its document, or null. */
  function w9Doc(ws, inv) {
    const c = inv && inv.taxCert;
    if (!c || inv.taxForm !== 'W-9' || !c.envelopeId || c.received === false) return null;
    return (ws.docs || []).find((d) => d.envelopeId === c.envelopeId && (d.investors || []).indexOf(inv.id) >= 0) || null;
  }
  let rectsP = null;
  /** The blank W-9's own boxes (pinned file shipped as a script). */
  function w9Boxes() {
    if (!rectsP) {
      rectsP = (async () => {
        const map = NS.taxmaps['W-9 2024-03'];
        await load('../forms/forms-data.js', () => !!(NS.taxformsData && NS.taxformsData[map.file]));
        const L = await NS.esignKit.writer();
        return X().w9Rects(L, NS.esignKit.fromBase64(NS.taxformsData[map.file]), map, { sha256: NS.audit.sha256 });
      })();
      rectsP.catch(() => (rectsP = null));
    }
    return rectsP;
  }
  /** What the signed W-9's first page shows in its boxes (the number is returned to the caller, never kept elsewhere). */
  async function readSigned(doc) {
    const blob = await NS.ops.files.get(doc.id);
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const rects = await w9Boxes();
    const lib = await NS.taxUI.reader();
    const pdf = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
    try {
      const page = await pdf.getPage(1);
      const height = page.getViewport({ scale: 1 }).height;
      const items = X().textItems(height, (await page.getTextContent()).items);
      page.cleanup();
      return X().readW9(items, rects);
    } finally {
      pdf.destroy();
    }
  }
  /** Whether a row reads its number from the signed W-9 kept in this browser (and that reading has not failed). */
  const fromW9 = (ws, id) => !held.w9[id] && !!w9Doc(ws, investorOf(ws, id));
  /** Read the forms' signed W-9s that are not read yet; a number is kept only when it ends in the four on record. */
  function readAll(ws, F) {
    if (held.reading) return held.reading;
    const todo = F.forms.filter((f) => !held.rec[f.investorId] && fromW9(ws, f.investorId));
    if (!todo.length) return Promise.resolve();
    const key = held.key;
    held.reading = (async () => {
      for (const f of todo) {
        const inv = investorOf(ws, f.investorId);
        let ok = false;
        try {
          const r = await readSigned(w9Doc(ws, inv));
          if (held.key !== key) return;
          const t = r && r.tin ? X().checkTin(r.tin, X().last4Of(inv)) : { ok: false };
          if (t.ok) {
            held.rec[f.investorId] = { tin: t.digits, tinType: r.tinType, from: 'w9', proposal: proposal(inv, r) };
            ok = true;
          }
        } catch (e) {
          if (window.console) console.error(e);
        }
        if (!ok) held.w9[f.investorId] = 'failed';
      }
    })().finally(() => {
      if (held.key === key) held.reading = null;
      NS.taxUI.refresh();
    });
    return held.reading;
  }
  function recipientRow(ws, f) {
    const id = f.investorId;
    const inv = investorOf(ws, id) || {};
    const r = held.rec[id];
    const v = cells(ws, id);
    const field = (k) => `<label class="cs-field" for="t99-r-${h(id)}-${k}"><span>${LABEL[k]}</span><input id="t99-r-${h(id)}-${k}" type="text" autocomplete="off" value="${h(v[k] || '')}"></label>`;
    // the name split the IRS file needs (asked); the address is the W-9's or the record's (shown, corrected only when a rule names it)
    const name = v.nameType === 'B' ? field('bname') : ['first', 'last'].map(field).join('');
    const where = [[v.address1, v.address2].filter(Boolean).join(' '), [v.city, [v.state, v.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
    const num = r
      ? `<span class="tx-detail" data-number>Number ${ending(r.tin.slice(5))} · ${r.from === 'w9' ? 'read from the signed W-9' : 'typed'}</span>`
      : fromW9(ws, id)
        ? `<span class="tx-detail" data-number>${held.reading ? 'Reading the signed W-9…' : 'Signed W-9 in this browser'}</span>`
        : `<label class="cs-field" for="t99-tin-${h(id)}"><span>Taxpayer number</span><input id="t99-tin-${h(id)}" type="text" inputmode="numeric" autocomplete="off" spellcheck="false"></label>
         <label class="cs-field" for="t99-tint-${h(id)}"><span>Number type</span><select id="t99-tint-${h(id)}"><option value="SSN">SSN</option><option value="EIN"${inv.type && inv.type !== 'individual' ? ' selected' : ''}>EIN</option></select></label>`;
    const rowSaid = (ui().rowMsg || {})[id] ? `<p class="tx-note is-stop" role="alert">${h(ui().rowMsg[id])}</p>` : '';
    const shown = r || fromW9(ws, id);
    return `<li class="tx-row" data-id="${h(id)}"${r ? ` data-from="${r.from}"` : ''}><div class="tx-what"><span class="tx-title">${h(inv.title || id)} · ${h(id)} · ${ending(X().last4Of(inv))} on record</span>${shown ? num : ''}<span class="tx-detail" data-address>${h(where)}</span></div>
      <div class="tx-form">${shown ? '' : num}
        <label class="cs-field" for="t99-r-${h(id)}-nameType"><span>Name type</span><select id="t99-r-${h(id)}-nameType" data-change="t99-nametype" data-id="${h(id)}"><option value="I"${v.nameType !== 'B' ? ' selected' : ''}>Individual</option><option value="B"${v.nameType === 'B' ? ' selected' : ''}>Business</option></select></label>
        ${name}
      </div>${rowSaid}</li>`;
  }
  function numbersHTML(ws, c, F) {
    if (!held.after) readAll(ws, F);
    const p = held.payer;
    const payer = p
      ? `<p class="tx-detail" data-payer-number>Payer’s number ${ending(p.tin.slice(5))}</p>`
      : `<div class="tx-form">
          <label class="cs-field" for="t99-payer-tin"><span>Payer’s taxpayer number</span><input id="t99-payer-tin" type="text" inputmode="numeric" autocomplete="off" spellcheck="false"></label>
          <label class="cs-field" for="t99-payer-type"><span>Number type</span><select id="t99-payer-type"><option value="EIN">EIN</option><option value="SSN">SSN</option></select></label>
        </div>`;
    const waiting = '';
    const typedLeft = !p || F.forms.some((f) => !held.rec[f.investorId]);
    return CK().panel(
      'Numbers',
      `<div data-panel="numbers">${said('numbers')}${payer}${waiting}<ul class="tx-list" data-list="numbers">${F.forms.map((f) => recipientRow(ws, f)).join('')}</ul>
      <div class="cs-row">${typedLeft ? '<button type="button" class="cs-btn" data-action="t99-check">Check numbers</button>' : ''}</div></div>`
    );
  }

  /* ---------- the payer (admins enter it; a team member reads it) ---------- */
  const PAYER = [['name', 'Payer’s name'], ['name2', 'Second name line'], ['address1', 'Street address'], ['address2', 'Second address line'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['phone', 'Telephone']];
  const BOXES_INT = [['registeredForm', 't99-p-registered', 'These notes are in registered form or of a type offered to the public'], ['paidInMoney', 't99-p-money', 'Interest was paid in money and none was added to principal or issued at a discount']];
  function payerHTML(c) {
    const p = X().payerOf(c.o);
    // the two confirmations are Form 1099-INT's (notes); a corporation's form has none
    const BOXES = isDiv(c) ? [] : BOXES_INT;
    if (!admin()) {
      const rows = PAYER.filter(([k]) => p[k]).map(([k, label]) => `<dt>${label}</dt><dd>${h(p[k])}</dd>`).join('') + BOXES.map(([k, , label]) => `<dt>${label}</dt><dd>${p[k] === true ? 'Yes' : 'Not confirmed'}</dd>`).join('');
      return CK().panel('Payer', `<div data-panel="payer"><dl class="tx-review">${rows}</dl></div>`);
    }
    const f = ([k, label]) => `<label class="cs-field${k === 'name' || k === 'address1' ? ' cs-wide' : ''}" for="t99-p-${k}"><span>${label}</span><input id="t99-p-${k}" type="${k === 'phone' ? 'tel' : 'text'}" autocomplete="off" value="${h(p[k] || '')}"></label>`;
    const box = ([k, id, label]) => `<label class="tx-note" for="${id}"><input id="${id}" type="checkbox"${p[k] === true ? ' checked' : ''}> ${label}</label>`;
    return CK().panel('Payer', `<div data-panel="payer">${said('payer')}<div class="tx-form">${PAYER.map(f).join('')}</div>${BOXES.map(box).join('')}<div class="cs-row"><button type="button" class="cs-btn" data-action="t99-payer">Save</button></div></div>`);
  }

  /* ---------- the recipients' copies (admins), delivered through NS.taxdocs ---------- */
  const copyDocs = (ws, c) => {
    const ids = yearRecOf(c.o, c.year).copyB || {};
    return Object.keys(ids)
      .map((id) => (ws.docs || []).find((d) => d.id === ids[id] && d.tax))
      .filter(Boolean);
  };
  const STATE = { confirmed: ['Not delivered', 'is-wait'], waiting: ['Waiting for consent', 'is-wait'], paper: ['Sent on paper', 'is-off'], delivered: ['Delivered', 'is-ok'], replaced: ['Replaced', 'is-off'], withdrawn: ['Withdrawn', 'is-stop'] };
  const LIVE = ['confirmed', 'waiting', 'delivered', 'paper'];
  /** The forms that have no live copy yet. */
  const needCopy = (ws, c, F) => F.forms.filter((f) => !copyDocs(ws, c).some((d) => d.investors[0] === f.investorId && LIVE.indexOf(d.tax.state) >= 0));
  function copiesHTML(ws, c, F) {
    const docs = copyDocs(ws, c);
    const rows = docs
      .map((d) => {
        const inv = investorOf(ws, d.investors[0]) || {};
        const [label, cls] = STATE[d.tax.state] || [d.tax.state, 'is-off'];
        const until = d.tax.availableUntil && ['delivered', 'replaced'].indexOf(d.tax.state) >= 0 ? `<span class="tx-detail">Available until ${h(U.date(d.tax.availableUntil, 'long'))}</span>` : '';
        return `<li class="tx-row" data-id="${h(d.id)}"><div class="tx-what"><span class="tx-title">${h(inv.title || d.investors[0])} · ${h(d.investors[0])}</span>${until}</div><div class="tx-when"><span class="tx-pill ${cls}">${label}</span></div></li>`;
      })
      .join('');
    const ready1 = docs.filter((d) => d.tax.state === 'confirmed');
    const need = needCopy(ws, c, F).length;
    let deliver = '';
    if (ready1.length && !ui().deliver) deliver = `<button type="button" class="cs-btn cs-btn-primary" data-action="t99-deliver">Deliver ${ready1.length}</button>`;
    else if (ready1.length) {
      const list = ready1.map((d) => `<li class="tx-row" data-id="${h(d.id)}"><div class="tx-what"><span class="tx-title">${h((investorOf(ws, d.investors[0]) || {}).title || d.investors[0])} · ${h(d.investors[0])}</span><span class="tx-detail">${h(d.title)}</span></div></li>`).join('');
      deliver = `<ul class="tx-list" data-list="recipients">${list}</ul><div class="cs-row"><button type="button" class="cs-btn cs-btn-primary" data-action="t99-deliver-go">Deliver to these ${ready1.length}</button><button type="button" class="cs-btn" data-action="t99-deliver-cancel">Cancel</button></div>`;
    }
    const make = need ? `<button type="button" class="cs-btn${docs.length ? '' : ' cs-btn-primary'}" data-action="t99-copies">Create recipient copies</button>` : '';
    return CK().panel(
      'Recipient copies',
      `<div data-panel="copies">${said('copies')}${rows ? `<ul class="tx-list" data-list="copies">${rows}</ul>` : ''}<div class="cs-row">${make}${ui().deliver ? '' : deliver}</div>${ui().deliver ? deliver : ''}</div>`
    );
  }

  /* ---------- the IRS file and its receipt ---------- */
  const IRIS_PAGE = 'https://www.irs.gov/filing/e-file-information-returns-with-iris';
  // the file's cells a person can correct on screen when a rule names them: the recipient's (in this section's memory)
  // and the payer's (saved with the payer's details)
  const FIX_REC = { W: 'bname', Y: 'first', Z: 'middle', AA: 'last', AB: 'suffix', AD: 'address1', AE: 'address2', AF: 'city', AG: 'state', AH: 'zip' };
  const FIX_PAYER = { F: 'name', G: 'name2', M: 'address1', N: 'address2', O: 'city', P: 'state', Q: 'zip', S: 'phone' };
  function faultsHTML(ws) {
    const list = ui().faults || [];
    if (!list.length) return '';
    const rows = list
      .map((x, n) => {
        const inv = investorOf(ws, x.investorId) || {};
        const rec = FIX_REC[x.col];
        const pay = FIX_PAYER[x.col];
        const fix = rec || (pay && admin()) ? `<div class="tx-form"><label class="cs-field cs-wide" for="t99-fix-${n}"><span>${h(x.name)}</span><input id="t99-fix-${n}" type="text" autocomplete="off" data-fix="${rec ? 'r' : 'p'}" data-fix-id="${h(x.investorId)}" data-fix-key="${rec || pay}" value="${h(x.value)}"></label></div>` : '';
        return `<li class="tx-row" data-id="${h(x.investorId)}"><div class="tx-what"><span class="tx-title">Row ${x.row} (${h(inv.title || x.investorId)} · ${h(x.investorId)}), column ${h(x.col)} (${h(x.name)})</span><span class="tx-detail">${h(x.why)}</span></div>${fix}</li>`;
      })
      .join('');
    return `<ul class="tx-list" data-list="faults">${rows}</ul>`;
  }
  /** The day the IRS receipt recorded for a file holding this investor's form, or ''. */
  function filedOn(o, y, investorId) {
    const yr = yearRecOf(o, y);
    const files = yr.files || [];
    const hit = (yr.filed || []).filter((x) => files.some((f) => f.sha256 === x.sha256 && (f.ids || []).indexOf(investorId) >= 0));
    return hit.length ? hit[hit.length - 1].date : '';
  }
  function fileHTML(ws, c) {
    const yr = yearRecOf(c.o, c.year);
    const files = yr.files || [];
    const last = files[files.length - 1];
    const made = last ? `<p class="tx-detail" data-made>Last file: ${h(U.date(String(last.at).slice(0, 10), 'long'))} · ${last.rows} form${last.rows === 1 ? '' : 's'} · ${h(last.by)}</p>` : '';
    const pinned = !!(NS.tax1099data && NS.tax1099data.IRIS && NS.tax1099data.IRIS.headerPinned);
    const notes = `<p class="tx-note" data-notice="code">The IRS’s code for filing can take up to 45 days to arrive: apply early on the <a href="${IRIS_PAGE}" target="_blank" rel="noopener">IRS’s IRIS page</a>.</p>
      <p class="tx-note" data-notice="sheet">Do not open the file in a spreadsheet before you upload it.</p>${pinned ? '' : '<p class="tx-note" data-notice="header">The file’s header has not yet been compared with the IRS’s own template.</p>'}`;
    const receipt = last
      ? `<div class="tx-form">
          <label class="cs-field" for="t99-receipt"><span>IRS receipt number</span><input id="t99-receipt" type="text" autocomplete="off"></label>
          <label class="cs-field" for="t99-receipt-date"><span>Date filed</span><input id="t99-receipt-date" type="date"></label>
        </div>${said('filed')}<div class="cs-row"><button type="button" class="cs-btn" data-action="t99-filed">Record the IRS receipt</button></div>`
      : '';
    return CK().panel('IRS file', `<div data-panel="file">${notes}${said('file')}${faultsHTML(ws)}${made}<div class="cs-row"><button type="button" class="cs-btn cs-btn-primary" data-action="t99-file">Download the IRS file</button></div>${receipt}</div>`);
  }

  function render(ws) {
    const c = current(ws);
    if (!c.o) return `<p class="tx-stop" data-stop="reporting">${h(X().STOP_TEXT.reporting)}</p>`;
    irisData()
      .then(() => {})
      .catch(() => {});
    const F = figures(ws, c);
    const steps = admin() && ready(ws, c, F) ? `${numbersHTML(ws, c, F)}${copiesHTML(ws, c, F)}${fileHTML(ws, c)}` : '';
    const shown = stopsHTML(F) + answersHTML(ws, c);
    const stops = shown || said('answers') ? CK().panel('', `${said('answers')}${shown}`) : '';
    return `${pickerHTML(c)}${payerHTML(c)}${isDiv(c) ? splitsHTML(ws, c) : ''}${stops}${formsHTML(ws, c, F)}${leftHTML(ws, F)}${steps}`;
  }

  /* ---------- picking and acting ---------- */
  NS.changes['t99-fund'] = (el) => {
    const u = ui();
    u.offeringId = el.value;
    u.year = '';
    Object.assign(u, { msg: null, faults: [], deliver: false, rowMsg: {} });
    redraw();
  };
  NS.changes['t99-year'] = (el) => {
    const u = ui();
    u.year = el.value;
    Object.assign(u, { msg: null, faults: [], deliver: false, rowMsg: {} });
    redraw();
  };
  NS.changes['t99-nametype'] = (el) => {
    harvest(NS.state.ws);
    const id = el.getAttribute('data-id');
    ui().edit[id] = Object.assign({}, edit(id), { nameType: el.value === 'B' ? 'B' : 'I' });
    redraw();
  };
  const typed = (id) => String((document.getElementById(id) || {}).value || '').trim();
  /** The name and address cells as they stand on screen (not numbers): kept in the section's memory across redraws. */
  function harvest(ws) {
    document.querySelectorAll('[data-list="numbers"] .tx-row[data-id]').forEach((row) => {
      const id = row.getAttribute('data-id');
      const e = Object.assign({}, edit(id));
      SPLIT.forEach((k) => {
        const el = document.getElementById(`t99-r-${id}-${k}`);
        if (el) e[k] = String(el.value || '').trim();
      });
      ui().edit[id] = e;
    });
    const payerFix = {};
    document.querySelectorAll('[data-list="faults"] input[data-fix]').forEach((el) => {
      const key = el.getAttribute('data-fix-key');
      const v = String(el.value || '').trim();
      if (el.getAttribute('data-fix') === 'r') {
        const id = el.getAttribute('data-fix-id');
        ui().edit[id] = Object.assign({}, edit(id), { [key]: v });
      } else payerFix[key] = v;
    });
    return payerFix;
  }
  /** One action: refused with one line where it was asked; on success saved (the module writes the change log). */
  function act(at, fn, need) {
    return async (el) => {
      const ws = NS.state.ws;
      if (!NS.app.can(need || 'operate')) return;
      const u = ui();
      const c = current(ws);
      if (!c.o) return;
      u.msg = null;
      try {
        await fn(ws, c, el, u);
        NS.app.save(true);
      } catch (e) {
        u.msg = { at, text: (e && e.message) || 'That could not be done.' };
      }
      redraw();
    };
  }
  NS.actions['t99-confirm'] = act('forms', (ws, c, el) => {
    X().confirmTotals(ws, c.o.id, c.year, el.getAttribute('data-id'), { by: actor(), today: today() });
  });
  /** Check the numbers typed on screen; each accepted one is held, each refusal is said on its row. Fields are emptied. */
  function checkTyped(ws, c, F) {
    harvest(ws);
    const u = ui();
    u.rowMsg = {};
    let refused = 0;
    if (!held.payer) {
      const s = typed('t99-payer-tin');
      const type = typed('t99-payer-type') === 'SSN' ? 'SSN' : 'EIN';
      if (!s) {
        refused++;
        u.msg = { at: 'numbers', text: 'Type the payer’s taxpayer number.' };
      } else {
        const d = s.replace(/[\s-]/g, '');
        const stored = X().payerOf(c.o).tinLast4;
        const t = /[^\d\s-]/.test(s) ? { ok: false, why: 'A taxpayer number holds digits only (dashes and spaces may stand between them).' } : d.length !== 9 ? { ok: false, why: `A taxpayer number has nine digits; this one has ${d.length}.` } : stored && d.slice(5) !== stored ? { ok: false, why: 'The payer’s number does not end in the four digits given before; check it.' } : { ok: true, digits: d };
        if (t.ok) held.payer = { tin: t.digits, tinType: type };
        else {
          refused++;
          u.msg = { at: 'numbers', text: t.why };
        }
      }
    }
    F.forms.forEach((f) => {
      const id = f.investorId;
      if (held.rec[id] || fromW9(ws, id)) return;
      const s = typed(`t99-tin-${id}`);
      if (!s) {
        refused++;
        u.rowMsg[id] = 'Type this recipient’s taxpayer number from the signed W-9.';
        return;
      }
      const t = X().checkTin(s, X().last4Of(investorOf(ws, id)));
      if (t.ok) held.rec[id] = { tin: t.digits, tinType: typed(`t99-tint-${id}`) === 'EIN' ? 'EIN' : 'SSN', from: 'typed' };
      else {
        refused++;
        u.rowMsg[id] = t.why;
      }
    });
    return refused;
  }
  NS.actions['t99-check'] = act(
    'numbers',
    async (ws, c) => {
      const F = figures(ws, c);
      if (!ready(ws, c, F)) throw new Error('Confirm every form first.');
      checkTyped(ws, c, F);
      held.after = false;
      await readAll(ws, F);
    },
    'configure'
  );
  /** The payer for one file or copy (the stored details and the typed number); dropped by the caller. */
  function payerObj(c) {
    const p = X().payerOf(c.o);
    return { tinType: held.payer.tinType, tin: held.payer.tin, nameType: 'B', name: p.name, name2: p.name2, country: 'US', address1: p.address1, address2: p.address2, city: p.city, state: p.state, zip: p.zip, phone: p.phone };
  }
  /** One recipient for one file or copy; dropped by the caller. */
  function recipientObj(ws, id) {
    const v = cells(ws, id);
    const r = held.rec[id];
    const indiv = v.nameType !== 'B';
    return { tinType: r.tinType, tin: r.tin, nameType: indiv ? 'I' : 'B', name: indiv ? '' : v.bname, name2: '', first: indiv ? v.first : '', middle: indiv ? v.middle : '', last: indiv ? v.last : '', suffix: indiv ? v.suffix : '', country: 'US', address1: v.address1, address2: v.address2, city: v.city, state: v.state, zip: v.zip };
  }
  /** Every number needed is held (typed ones checked, signed W-9s read). */
  async function numbersReady(ws, c, F) {
    if (!held.payer || F.forms.some((f) => !held.rec[f.investorId])) checkTyped(ws, c, F);
    held.after = false;
    await readAll(ws, F);
    if (!held.payer || F.forms.some((f) => !held.rec[f.investorId])) throw new Error('Every number must be given and accepted first.');
  }
  NS.actions['t99-file'] = act(
    'file',
    async (ws, c) => {
      const F = figures(ws, c);
      if (!ready(ws, c, F)) throw new Error('Confirm every form first.');
      await irisData();
      const payerFix = harvest(ws);
      if (Object.keys(payerFix).length) X().setPayer(ws, c.o.id, payerFix, { by: actor() });
      await numbersReady(ws, c, F);
      const payer = payerObj(c);
      const FORM = formOf(c.o);
      const rows = F.forms.map((f) => X().iris.row(FORM, c.year, f, payer, recipientObj(ws, f.investorId)));
      const faults = X().iris.validate(FORM, rows);
      const cols = NS.tax1099data.IRIS.columns[FORM];
      ui().faults = faults.map((x) => {
        const k = cols.findIndex((cc) => cc.col === x.col);
        return Object.assign({}, x, { investorId: (F.forms[x.row - 1] || {}).investorId || '', value: k >= 0 && /^(W|X|Y|Z|AA|AB|AD|AE|AF|AG|AH|F|G|M|N|O|P|Q|S)$/.test(x.col) ? rows[x.row - 1][k] : '' });
      });
      if (faults.length) throw new Error(`The file cannot be built while ${faults.length} cell${faults.length === 1 ? '' : 's'} break the IRS’s published rules: correct ${faults.length === 1 ? 'it' : 'them'} below.`);
      const files = X().iris.files(FORM, rows);
      const yr = (((c.o.tax = c.o.tax || {}).years = c.o.tax.years || {})[c.year] = c.o.tax.years[c.year] || {});
      yr.files = yr.files || [];
      const at = new Date().toISOString();
      for (const f of files) {
        await U.download(f.name, f.text, { mime: 'text/csv' });
        yr.files.push({ name: f.name, sha256: NS.audit.sha256(f.text), rows: f.rows, ids: F.forms.map((x) => x.investorId), by: actor(), at });
        CK().audit(`Form ${FORM} file downloaded`, `${c.o.shortName || c.o.name}: ${c.year}, ${f.rows} form${f.rows === 1 ? '' : 's'}`, c.o.id, c.o.id);
      }
      if (!X().payerOf(c.o).tinLast4) X().setPayer(ws, c.o.id, { tinLast4: held.payer.tin.slice(5) }, { by: actor() });
      ui().faults = [];
      // the file has been made: every number leaves this page's memory
      held = fresh(held.key, true);
    },
    'configure'
  );

  NS.actions['t99-interest'] = act('answers', (ws, c, el) => {
    X().setInterest(ws, el.getAttribute('data-run'), el.getAttribute('data-yes') === '1', { by: actor() });
    NS.clearCaches();
  });
  NS.actions['t99-lines'] = act('answers', (ws, c, el) => {
    const run = NS.data.confirmLines(ws, el.getAttribute('data-run'), { by: actor() });
    CK().audit('Distribution amounts confirmed', `${c.o.shortName || c.o.name}: the ${run.type} payment of ${run.date}, ${run.lines.length} investors, ${money(run.total)} in all, as worked out from the positions`, c.o.id, run.id);
  });
  NS.actions['t99-exempt'] = act(
    'forms',
    (ws, c, el) => {
      WH().markExempt(ws, el.getAttribute('data-id'), { by: actor() });
    },
    'configure'
  );
  NS.actions['t99-unexempt'] = act(
    'forms',
    (ws, c, el) => {
      WH().unmarkExempt(ws, el.getAttribute('data-id'), { by: actor() });
    },
    'configure'
  );
  NS.actions['t99-payer'] = act(
    'payer',
    (ws, c) => {
      const patch = {};
      PAYER.forEach(([k]) => (patch[k] = typed(`t99-p-${k}`)));
      if (!isDiv(c)) BOXES_INT.forEach(([k, id]) => (patch[k] = !!(document.getElementById(id) || {}).checked));
      X().setPayer(ws, c.o.id, patch, { by: actor() });
    },
    'configure'
  );
  NS.actions['t99-copies'] = act(
    'copies',
    async (ws, c) => {
      const F = figures(ws, c);
      if (!ready(ws, c, F)) throw new Error('Confirm every form first.');
      harvest(ws);
      await numbersReady(ws, c, F);
      const todo = needCopy(ws, c, F);
      if (!todo.length) return;
      const FORM = formOf(c.o);
      const map = await (async () => {
        await irisData();
        return NS.tax1099data.MAPS[X().COPY_B_OF[FORM]];
      })();
      await load('../forms/1099/forms1099-data.js', () => !!(NS.tax1099formsData && NS.tax1099formsData[map.file]));
      const L = await NS.esignKit.writer();
      const font = await NS.esignKit.unicodeFont();
      const blank = NS.esignKit.fromBase64(NS.tax1099formsData[map.file]);
      const payer = payerObj(c);
      const conf = yearRecOf(c.o, c.year).confirmed || {};
      for (const f of todo) {
        const bytes = await X().recipientCopy(L, blank.slice(), map, X().copyBAnswers(f, payer, recipientObj(ws, f.investorId), c.year, FORM), { fontkit: font.fontkit, fontBytes: font.fontBytes, sha256: NS.audit.sha256 });
        const id = 'txd-' + Array.from({ length: 12 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
        await NS.ops.files.put(id, new Blob([bytes], { type: 'application/pdf' }));
        const by = conf[f.investorId];
        const kind = FORM.toLowerCase();
        NS.taxdocs.addGenerated(ws, { kind, year: c.year, offeringId: c.o.id, investorId: f.investorId, id, title: `Form ${FORM} ${c.year}`, fileName: `form-${kind}-${c.year}-${f.investorId}.pdf`, size: bytes.length, sha256: NS.audit.sha256(bytes), confirmedBy: by.by, confirmedAt: by.at });
        const yr = c.o.tax.years[c.year];
        yr.copyB = Object.assign({}, yr.copyB || {}, { [f.investorId]: id });
      }
    },
    'configure'
  );
  NS.actions['t99-deliver'] = act('copies', (ws, c, el, u) => {
    const miss = ['name', 'address', 'phone', 'email'].filter((k) => !((ws.taxdocs || {}).contact || {})[k]);
    if (miss.length) throw new Error('Before delivering, save the Contact for tax documents on the Tax documents page.');
    u.deliver = true;
  }, 'configure');
  NS.actions['t99-deliver-cancel'] = act('copies', (ws, c, el, u) => {
    u.deliver = false;
  }, 'configure');
  NS.actions['t99-deliver-go'] = act('copies', (ws, c, el, u) => {
    u.deliver = false;
    const refused = [];
    copyDocs(ws, c)
      .filter((d) => d.tax.state === 'confirmed')
      .forEach((d) => {
        try {
          NS.taxdocs.deliver(ws, d.id, { by: actor(), how: 'own email' });
        } catch (e) {
          if (refused.indexOf(e.message) < 0) refused.push(e.message);
        }
      });
    if (refused.length) throw new Error(`Not delivered: ${refused.join(' ')}`);
  }, 'configure');
  NS.actions['t99-filed'] = act(
    'filed',
    (ws, c) => {
      const files = yearRecOf(c.o, c.year).files || [];
      const last = files[files.length - 1];
      if (!last) throw new Error('Download the IRS file first.');
      const receiptId = typed('t99-receipt');
      const date = typed('t99-receipt-date');
      if (!receiptId) throw new Error('Type the receipt number the IRS gave.');
      if (!date) throw new Error('Give the date the file was filed.');
      X().markFiled(ws, c.o.id, c.year, { by: actor(), receiptId, date, sha256: last.sha256, rows: last.rows });
    },
    'configure'
  );

  /* ---------- Form 1099-DIV: the split from the CPA (plan 10-11; never proposed by the portal) ---------- */
  // the boxes in the form's own order and words (Form 1099-DIV, Rev. January 2024); 1a, 2a, 3 and 4 are always drawn
  const DIV_BOXES = [['1a', 'Total ordinary dividends'], ['1b', 'Qualified dividends'], ['2a', 'Total capital gain distributions'], ['2b', 'Unrecaptured section 1250 gain'], ['2c', 'Section 1202 gain'], ['2d', 'Collectibles (28%) gain'], ['2e', 'Section 897 ordinary dividends'], ['2f', 'Section 897 capital gain'], ['3', 'Nondividend distributions'], ['4', 'Federal income tax withheld'], ['5', 'Section 199A dividends']];
  const ALWAYS = ['1a', '2a', '3', '4'];
  const MAIN = ['1a', '2a', '3'];
  const MORE = ['1b', '2b', '2c', '2d', '2e', '2f', '5'];
  const splitUi = () => {
    const u = ui();
    u.splitOpen = u.splitOpen || {};
    u.splitEdit = u.splitEdit || {};
    return u;
  };
  /** What a split holds, in dollars: "1a $7,000.00 · 2a $1,000.00 · 3 $2,000.00 · 5 $7,000.00" (boxes above zero). */
  const splitText = (sp) =>
    MAIN.concat(MORE)
      .filter((b) => (MAIN.indexOf(b) >= 0 ? sp.cents[b] : sp.part[b]) > 0)
      .map((b) => `${b} ${money(MAIN.indexOf(b) >= 0 ? sp.cents[b] : sp.part[b])}`)
      .join(' · ');
  const whoSaid = (sp) => (sp.source === 'irs-default' ? `Whole payment as a dividend (IRS rule), chosen by ${h(sp.by)}` : sp.source === 'year' ? `From the year’s split, entered by ${h(sp.by)}` : `Entered by ${h(sp.by)}`);
  function splitForm(id, run) {
    const v = splitUi().splitEdit[id] || {};
    const unit = v.unit === '$' ? '$' : '%';
    const field = (b) => `<label class="cs-field" for="t99-s-${h(id)}-${b}"><span>${b}</span><input id="t99-s-${h(id)}-${b}" type="text" inputmode="decimal" autocomplete="off" value="${h(v[b] || '')}"></label>`;
    const more = MORE.some((b) => v[b]);
    return `<div class="tx-form">
        <label class="cs-field" for="t99-s-${h(id)}-unit"><span>As</span><select id="t99-s-${h(id)}-unit"><option value="%"${unit === '%' ? ' selected' : ''}>Percent</option><option value="$"${unit === '$' ? ' selected' : ''}>Amount</option></select></label>
        ${MAIN.map(field).join('')}
      </div>
      <details data-more="${h(id)}"${more ? ' open' : ''}><summary>More boxes from your CPA</summary><div class="tx-form">${MORE.map(field).join('')}</div></details>
      <label class="tx-note" for="t99-s-${h(id)}-year"><input id="t99-s-${h(id)}-year" type="checkbox"${v.year ? ' checked' : ''}> Use this split for every distribution of the year</label>
      ${said('split:' + id)}
      <div class="cs-row"><button type="button" class="cs-btn cs-btn-primary" data-action="t99-split" data-run="${h(id)}">Save split</button><button type="button" class="cs-btn" data-action="t99-whole" data-run="${h(id)}">Report the whole payment as a dividend</button>${splitUi().splitOpen[id] && run.split ? `<button type="button" class="cs-btn" data-action="t99-split-cancel" data-run="${h(id)}">Cancel</button>` : ''}</div>`;
  }
  function splitsHTML(ws, c) {
    const runs = X().divRuns(ws, c.o, c.year, today()).filter((r) => r.stored);
    if (!runs.length) return '';
    const can = NS.app.can('operate');
    const dy = (yearRecOf(c.o, c.year) || {}).divYear;
    const rows = runs
      .map((r) => {
        const id = r.run.id;
        const sp = r.split;
        const open = can && (!sp || splitUi().splitOpen[id]);
        const pill = sp ? `<span class="tx-pill is-ok">${whoSaid(sp)}</span>` : '<span class="tx-pill is-wait">Split from your CPA</span>';
        const change = sp && can && !open ? `<div class="tx-acts"><button type="button" class="cs-btn cs-btn-small" data-action="t99-split-open" data-run="${h(id)}">Change</button></div>` : '';
        return `<li class="tx-row" data-id="${h(id)}"${sp ? '' : ' data-stop="split"'}><div class="tx-what"><span class="tx-title">${h(U.date(r.run.date, 'long'))} · ${h(r.run.type || 'Distribution')} · ${money(r.run.total)}</span>${sp ? `<span class="tx-detail" data-split>${h(splitText(sp))}</span>` : ''}</div><div class="tx-when">${pill}</div>${change}${open ? splitForm(id, r) : ''}</li>`;
      })
      .join('');
    const year = dy ? `<p class="tx-note" data-year-split>For every distribution of ${h(c.year)}: ${h(MAIN.concat(MORE).filter((b) => Number(dy.pct[b] || dy.partPct[b] || 0) > 0).map((b) => `${b} ${dy.pct[b] || dy.partPct[b]}%`).join(' · '))} · ${h(dy.by)}${can ? ' <button type="button" class="cs-btn cs-btn-small" data-action="t99-year-clear">Remove</button>' : ''}</p>` : '';
    const rule = runs.some((r) => !r.split) && can ? `<p class="tx-note" data-notice="whole">${h(X().DIV_TEXT.whole)}</p>` : '';
    return CK().panel('Split from your CPA', `<div data-panel="splits">${said('splits')}${rule}${year}<ul class="tx-list" data-list="splits">${rows}</ul></div>`);
  }
  /** The split as typed in a distribution's row (kept across redraws; it holds no number of a person). */
  function splitTyped(id) {
    const el = (k) => document.getElementById(`t99-s-${id}-${k}`);
    if (!el('1a')) return null;
    const v = { unit: (el('unit') || {}).value === '$' ? '$' : '%', year: !!(el('year') || {}).checked };
    MAIN.concat(MORE).forEach((b) => (v[b] = String((el(b) || {}).value || '').trim()));
    return v;
  }
  function harvestSplits() {
    document.querySelectorAll('[data-list="splits"] .tx-row[data-id]').forEach((row) => {
      const id = row.getAttribute('data-id');
      const v = splitTyped(id);
      if (v) splitUi().splitEdit[id] = v;
    });
  }
  /** Dollars typed ("1,234.56" or "$1234.56") as whole cents; a minus sign is kept so the module names the rule. */
  function centsTyped(s) {
    const t = String(s || '').replace(/[$,\s]/g, '');
    if (t === '') return 0;
    const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(t);
    if (!m) throw new Error('An amount is dollars and cents, such as 1234.56.');
    const c = Number(m[2]) * 100 + Number((m[3] || '').padEnd(2, '0') || 0);
    return m[1] ? -c : c;
  }
  const pctTyped = (s) => String(s || '').replace(/[%\s]/g, '');
  /** One split action: refused with one line in that distribution's row; on success saved (the module logs it). */
  const splitAct = (fn) => (el) => {
    harvestSplits();
    const id = el.getAttribute('data-run') || '';
    return act(id ? 'split:' + id : 'splits', (ws, c, e, u) => {
      fn(ws, c, id, u);
      NS.clearCaches();
    })(el);
  };
  NS.actions['t99-split'] = splitAct((ws, c, id, u) => {
    const v = splitUi().splitEdit[id] || {};
    const by = actor();
    const pick = (keys) => keys.reduce((a, b) => (v[b] !== '' && v[b] != null ? Object.assign(a, { [b]: v.unit === '$' ? centsTyped(v[b]) : pctTyped(v[b]) }) : a), {});
    if (v.year) {
      if (v.unit === '$') throw new Error('A split for every distribution of the year is given in percents.');
      X().setYearSplit(ws, c.o.id, c.year, { pct: pick(MAIN), partPct: pick(MORE) }, { by });
    } else if (v.unit === '$') X().setSplit(ws, id, { cents: pick(MAIN), part: pick(MORE) }, { by, offeringId: c.o.id });
    else X().setSplit(ws, id, { pct: pick(MAIN), partPct: pick(MORE) }, { by, offeringId: c.o.id });
    delete u.splitOpen[id];
    delete u.splitEdit[id];
  });
  NS.actions['t99-whole'] = splitAct((ws, c, id, u) => {
    X().wholeDividend(ws, id, { by: actor(), offeringId: c.o.id });
    delete u.splitOpen[id];
    delete u.splitEdit[id];
  });
  NS.actions['t99-split-open'] = (el) => {
    harvestSplits();
    splitUi().splitOpen[el.getAttribute('data-run')] = true;
    redraw();
  };
  NS.actions['t99-split-cancel'] = (el) => {
    const u = splitUi();
    const id = el.getAttribute('data-run');
    delete u.splitOpen[id];
    delete u.splitEdit[id];
    u.msg = null;
    redraw();
  };
  NS.actions['t99-year-clear'] = splitAct((ws, c) => {
    X().clearYearSplit(ws, c.o.id, c.year, { by: actor() });
  });

  NS.taxUI.part(KEY, { order: 30, title: 'Form 1099', summary, render, shown: (ws) => notesFunds(ws).length > 0 });
  NS.taxUI.refresh();
})(window.CVPortal);
