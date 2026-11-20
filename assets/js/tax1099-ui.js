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
  const FORM = '1099-INT';

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

  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o.id === id) || null;
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  const notesFunds = (ws) => (ws.offerings || []).filter((o) => WH().reporting(o) === 'notes');
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
  const figures = (ws, c) => X().figuresInt(ws, c.o, c.year, { today: today() });
  const yearRecOf = (o, y) => (((o.tax || {}).years || {})[y] || {});
  const allConfirmed = (ws, c, F) => F.forms.length > 0 && F.forms.every((f) => X().confirmed(ws, c.o, c.year, f));
  const ready = (ws, c, F) => !F.stops.length && allConfirmed(ws, c, F);

  /* ---------- the summary line on the Tax documents list ---------- */
  function summary(ws) {
    const out = [];
    notesFunds(ws).forEach((o) => {
      const year = String(Number(today().slice(0, 4)) - 1);
      const F = X().figuresInt(ws, o, year, { today: today() });
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
  const stopsHTML = (F) => F.stops.map((s) => `<p class="tx-stop" data-stop="${h(s.code)}">${h(s.text)}</p>`).join('');
  /** One form, its values in the form's own order (also what is keyed on the IRS site by hand). */
  function formRow(ws, c, f) {
    const inv = investorOf(ws, f.investorId) || {};
    const ok = X().confirmed(ws, c.o, c.year, f);
    const conf = (yearRecOf(c.o, c.year).confirmed || {})[f.investorId];
    const pill = ok ? `<span class="tx-pill is-ok">Confirmed by ${h(conf.by)}</span>` : '<span class="tx-pill is-wait">Not confirmed</span>';
    const acts = !ok && NS.app.can('operate') ? `<div class="tx-acts"><button type="button" class="cs-btn cs-btn-small cs-btn-primary" data-action="t99-confirm" data-id="${h(f.investorId)}">Confirm</button></div>` : '';
    return `<li class="tx-row" data-id="${h(f.investorId)}"><div class="tx-what"><span class="tx-title">${h(inv.title || f.investorId)} · ${h(f.investorId)}</span>
      <dl class="tx-review">
        <dt>Recipient’s number</dt><dd>${ending(X().last4Of(inv))}</dd>
        <dt>1 Interest income</dt><dd data-box="1">${money(f.box1Cents)}</dd>
        <dt>4 Federal income tax withheld</dt><dd data-box="4">${f.box4Cents ? money(f.box4Cents) : ''}</dd>
      </dl></div><div class="tx-when">${pill}</div>${acts}</li>`;
  }
  function formsHTML(ws, c, F) {
    if (!F.forms.length) return '';
    return CK().panel(`Forms <span class="cs-count">${F.forms.length}</span>`, `${said('forms')}<ul class="tx-list" data-list="forms">${F.forms.map((f) => formRow(ws, c, f)).join('')}</ul>`);
  }
  function leftHTML(ws, F) {
    if (!F.leftOut.length) return '';
    const rows = F.leftOut
      .map((x) => {
        const inv = investorOf(ws, x.investorId) || {};
        return `<li class="tx-row" data-id="${h(x.investorId)}"><div class="tx-what"><span class="tx-title">${h(inv.title || x.investorId)} · ${h(x.investorId)}</span><span class="tx-detail">${h(x.reason)} · ${money(x.cents)}</span></div></li>`;
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

  /* ---------- the IRS file ---------- */
  function fileHTML(ws, c) {
    const yr = yearRecOf(c.o, c.year);
    const files = yr.files || [];
    const last = files[files.length - 1];
    const made = last ? `<p class="tx-detail" data-made>Last file: ${h(U.date(String(last.at).slice(0, 10), 'long'))} · ${last.rows} form${last.rows === 1 ? '' : 's'} · ${h(last.by)}</p>` : '';
    return CK().panel('IRS file', `<div data-panel="file">${said('file')}${made}<div class="cs-row"><button type="button" class="cs-btn cs-btn-primary" data-action="t99-file">Download the IRS file</button></div></div>`);
  }

  function render(ws) {
    const c = current(ws);
    if (!c.o) return `<p class="tx-stop" data-stop="reporting">${h(X().STOP_TEXT.reporting)}</p>`;
    irisData()
      .then(() => {})
      .catch(() => {});
    const F = figures(ws, c);
    const steps = admin() && ready(ws, c, F) ? `${numbersHTML(ws, c, F)}${fileHTML(ws, c)}` : '';
    return `${pickerHTML(c)}${stopsHTML(F)}${formsHTML(ws, c, F)}${leftHTML(ws, F)}${steps}`;
  }

  /* ---------- picking and acting ---------- */
  NS.changes['t99-fund'] = (el) => {
    const u = ui();
    u.offeringId = el.value;
    u.year = '';
    u.msg = null;
    redraw();
  };
  NS.changes['t99-year'] = (el) => {
    const u = ui();
    u.year = el.value;
    u.msg = null;
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
    return ws;
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
      await numbersReady(ws, c, F);
      const payer = payerObj(c);
      const rows = F.forms.map((f) => X().iris.row(FORM, c.year, f, payer, recipientObj(ws, f.investorId)));
      const files = X().iris.files(FORM, rows);
      const yr = (((c.o.tax = c.o.tax || {}).years = c.o.tax.years || {})[c.year] = c.o.tax.years[c.year] || {});
      yr.files = yr.files || [];
      const at = new Date().toISOString();
      for (const f of files) {
        await U.download(f.name, f.text, { mime: 'text/csv' });
        yr.files.push({ name: f.name, sha256: NS.audit.sha256(f.text), rows: f.rows, by: actor(), at });
        CK().audit('Form 1099-INT file downloaded', `${c.o.shortName || c.o.name}: ${c.year}, ${f.rows} form${f.rows === 1 ? '' : 's'}`, c.o.id, c.o.id);
      }
      if (!X().payerOf(c.o).tinLast4) X().setPayer(ws, c.o.id, { tinLast4: held.payer.tin.slice(5) }, { by: actor() });
      // the file has been made: every number leaves this page's memory
      held = fresh(held.key, true);
    },
    'configure'
  );

  NS.taxUI.part(KEY, { order: 30, title: 'Form 1099', summary, render });
  NS.taxUI.refresh();
})(window.CVPortal);
