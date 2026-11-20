/*
 * A tax document on the investor's own device, through the firm's server (plan 10-12, C-04, TAX-04 to TAX-06).
 * Loaded beside taxdocs-ui.js (its fixed PARTS list) in the self-serve edition only. With no server connected nothing
 * here makes a call: connected(ws) is false and the Tax documents page works as plan 10-06 left it.
 *
 * The console's side (NS.taxUI.link): after a delivery, send() posts that one document to the server with the last four
 * digits of the tax number on record (never more), and the server emails the investor a link. An investor with no tax
 * number on record gets no link: the row says to send it on paper. rowLine() is the one status line on the document's
 * row; pull() reads the server's list when the page opens (opens on the investor's device, a consent given at the
 * link, a locked link); withdraw() takes the document off the server.
 *
 * The investor's side (NS.views.taxdoc, the address #taxdoc-<token>): one screen, any device, no portal data needed.
 * The link's ?server= address must pass app.js's test (state.remote), or nothing is fetched. The screen shows the firm's
 * name and the document's title, asks for the four digits, shows the consent's disclosure (NS.taxdocs.CONSENT.lines,
 * as the console sent it, nothing added) when consent is missing, then draws the pages in the page with Save.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.EDITION || !NS.EDITION.diy) return;
  const U = NS.ui;
  const { h } = U;
  const S = () => NS.state;
  const TD = () => NS.taxdocs;
  const IV = () => NS.integrations;
  const KIND = (k) => ((TD() && TD().KINDS[k]) || {}).label || k;
  const day = (iso) => (iso ? U.date(String(iso).slice(0, 10), 'long') : '');
  const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  /* ---------- the console's side ---------- */
  const serverOf = (ws) => {
    try {
      return ws && IV() ? IV().serverUrl(ws) : '';
    } catch (e) {
      return '';
    }
  };
  /** A server is connected on the Integrations page. */
  const connected = (ws) => !!serverOf(ws);
  async function api(ws, method, path, body) {
    const s = IV().ensure(ws).server;
    const headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (s.token) headers.Authorization = `Bearer ${s.token}`;
    let res;
    try {
      res = await fetch(serverOf(ws) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('The server could not be reached.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) throw Object.assign(new Error(data && typeof data.error === 'string' ? data.error : `The server answered ${res.status}.`), { status: res.status });
    return data;
  }
  const investorOf = (ws, id) => (ws.investors || []).find((i) => i.id === id) || null;
  const four = (v) => (/^\d{4}$/.test(String(v || '')) ? String(v) : '');
  /** The last four digits on record: the W-9's, the investor's, or (the only number on record) the foreign number's. */
  const last4Of = (inv) => (inv ? four(inv.taxCert && inv.taxCert.tinLast4) || four(inv.tinLast4) || four(inv.taxW8 && inv.taxW8.ftinLast4) : '');
  const portalPage = () => `${location.origin}${location.pathname}`;
  function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  /** Send one delivered (or waiting) document to the server; the result is kept on doc.tax.link. */
  async function send(ws, doc) {
    const t = doc.tax;
    const inv = investorOf(ws, (doc.investors || [])[0]);
    const last4 = last4Of(inv);
    if (!last4) {
      t.link = { linkId: '', status: 'paper', emailStatus: '', at: stamp() };
      NS.app.save(true);
      return t.link;
    }
    if (!inv.email) {
      t.link = { linkId: '', status: 'noemail', emailStatus: '', at: stamp() };
      NS.app.save(true);
      return t.link;
    }
    try {
      const blob = await NS.ops.files.get(doc.id);
      if (!blob) throw new Error('This browser no longer has the document’s file.');
      const u8 = new Uint8Array(await blob.arrayBuffer());
      const contact = Object.assign({}, TD().ensure(ws).contact);
      const C = TD().CONSENT;
      const r = await api(ws, 'POST', '/v1/taxdocs', {
        workspace: ws.tenant.id,
        docId: doc.id,
        kind: t.kind,
        year: t.year,
        title: `${KIND(t.kind)} ${t.year}`,
        fileName: doc.fileName,
        pdf: b64(u8),
        sha256: NS.audit.sha256(u8),
        availableUntil: t.availableUntil || TD().availableUntil(t.kind, t.year, NS.dates.today()),
        investor: { id: inv.id, name: inv.contact || inv.title, email: inv.email, last4 },
        firm: { name: ws.tenant.name || ws.tenant.shortName, contact },
        consent: { inEffect: TD().inEffect(inv), version: C.version, lines: C.lines(contact).map((l) => l.text) },
        portalUrl: portalPage(),
        sendEmail: true
      });
      t.link = { linkId: r.id, status: 'sent', emailStatus: r.emailStatus, emailError: r.emailError || '', consentNeeded: !TD().inEffect(inv), at: stamp() };
    } catch (e) {
      t.link = { linkId: '', status: 'failed', emailStatus: '', emailError: (e && e.message) || 'The link could not be sent.', at: stamp() };
    }
    NS.app.save(true);
    return t.link;
  }
  const btn = (action, label, doc) => `<button type="button" class="cs-btn cs-btn-small" data-action="${action}" data-doc="${h(doc.id)}">${label}</button>`;
  const ops = () => NS.app.can('operate');
  /** The one status line of the link on a document's row. */
  function rowLine(ws, doc) {
    const l = doc && doc.tax && doc.tax.link;
    if (!l) return '';
    const line = (text, act) => `<span class="tx-detail" data-txl="row">${h(text)}</span>${act && ops() ? `<div class="tx-acts">${act}</div>` : ''}`;
    if (l.status === 'paper') return line('No tax number on record, so no link was sent: send it on paper.');
    if (l.status === 'noemail') return line('No email on record, so no link was sent: send it on paper.');
    if (l.status === 'failed') return line(`The link could not be sent: ${l.emailError}`, btn('txl-resend', 'Send link again', doc));
    if (l.status === 'withdrawn') return line('Link withdrawn: it no longer opens.');
    if (l.status === 'expired') return line('Link ended with the access period.');
    if (l.status === 'locked') return line('Link locked after five wrong tries.', btn('txl-resend', 'Resend', doc));
    if (l.emailStatus === 'failed') return line(`The email with the link could not be sent: ${l.emailError || 'the mail server refused it.'}`, btn('txl-resend', 'Resend', doc));
    const n = (doc.tax.opens || {}).count || 0;
    if (l.status === 'opened' && n) return line(n === 1 ? 'Opened once on their device.' : `Opened ${n} times on their device.`);
    if (l.consentNeeded && !l.consentAt) return line('Link sent by email; it asks for consent to electronic delivery first.');
    return line(`Link sent by email on ${day(l.at)}.`);
  }
  let pulling = null;
  /** The server's list: opens, consent given at the link, statuses. Resolves to whether anything changed. */
  function pull(ws) {
    if (!connected(ws)) return Promise.resolve(false);
    if (pulling) return pulling;
    pulling = (async () => {
      const r = await api(ws, 'GET', `/v1/taxdocs?workspace=${encodeURIComponent(ws.tenant.id)}`);
      let changed = false;
      (r.documents || []).forEach((x) => {
        const doc = (ws.docs || []).find((d) => d.tax && d.tax.link && d.tax.link.linkId === x.id);
        if (!doc) return;
        const l = doc.tax.link;
        const inv = investorOf(ws, doc.investors[0]);
        if (l.status !== x.status || l.emailStatus !== x.emailStatus) {
          l.status = x.status;
          l.emailStatus = x.emailStatus;
          changed = true;
        }
        const o = doc.tax.opens || (doc.tax.opens = { first: '', last: '', count: 0 });
        const so = x.opens || {};
        if ((so.count || 0) > (o.count || 0)) {
          o.first = o.first || so.first;
          o.last = so.last;
          o.count = so.count;
          if (NS.audit && NS.audit.log) NS.audit.log(ws, { action: 'Tax document opened', fund: doc.offeringId, record: doc.id, actor: inv ? `${inv.title} (investor)` : undefined, at: so.last, detail: `${KIND(doc.tax.kind)} ${doc.tax.year}, on their own device through the link, open number ${so.count}` });
          changed = true;
        }
        // A consent given at the link is recorded once, as given there, with its time; it delivers what was waiting.
        if (x.consent && x.consent.at && !l.consentAt) {
          l.consentAt = x.consent.at;
          changed = true;
          if (inv && !TD().inEffect(inv) && x.consent.version === TD().CONSENT.version) {
            try {
              TD().consent(ws, inv.id, { where: 'link', at: x.consent.at });
            } catch (e) {
              if (window.console) console.error(e);
            }
          }
        }
      });
      if (changed) NS.app.save(true);
      return changed;
    })().then(
      (c) => {
        pulling = null;
        return c;
      },
      (e) => {
        pulling = null;
        throw e;
      }
    );
    return pulling;
  }
  /** Take the document off the server: the link stops opening and the file is removed there. */
  async function withdraw(ws, doc) {
    const l = doc && doc.tax && doc.tax.link;
    if (!l || !l.linkId || !connected(ws)) return null;
    await api(ws, 'POST', `/v1/taxdocs/${encodeURIComponent(l.linkId)}/withdraw`, {});
    l.status = 'withdrawn';
    NS.app.save(true);
    return l;
  }
  /** A new link for a locked, lost or unsent one (the old link stops). */
  async function resend(ws, doc) {
    const l = doc.tax.link;
    if (!l || !l.linkId) return send(ws, doc);
    const r = await api(ws, 'POST', `/v1/taxdocs/${encodeURIComponent(l.linkId)}/resend`, { portalUrl: portalPage(), sendEmail: true });
    Object.assign(l, { status: r.status || 'sent', emailStatus: r.emailStatus, emailError: r.emailError || '', at: stamp() });
    NS.app.save(true);
    return l;
  }
  NS.actions['txl-resend'] = async (el) => {
    const ws = S().ws;
    const doc = ws && (ws.docs || []).find((d) => d.id === el.getAttribute('data-doc') && d.tax);
    if (!doc || !ops() || !connected(ws)) return;
    el.disabled = true;
    try {
      await resend(ws, doc);
    } catch (e) {
      doc.tax.link = Object.assign({}, doc.tax.link, { emailStatus: 'failed', emailError: (e && e.message) || 'The link could not be sent.' });
      NS.app.save(true);
    }
    NS.app.render();
  };

  if (NS.taxUI) NS.taxUI.link = { connected, send, rowLine, pull, withdraw, resend, last4Of };

  /* ---------- the investor's side: #taxdoc-<token> ---------- */
  const V = { token: '', load: '', info: null, error: null, msg: '', busy: false, locked: false, file: null, drawn: false };
  const reset = (token) => Object.assign(V, { token, load: '', info: null, error: null, msg: '', busy: false, locked: false, file: null, drawn: false });
  async function docCall(method, path, body) {
    const r = S().remote;
    let res;
    try {
      res = await fetch(r.server + path, { method, headers: Object.assign({ 'X-Doc-Token': V.token, Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw Object.assign(new Error('The connection failed.'), { network: true });
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) throw Object.assign(new Error(data && typeof data.error === 'string' ? data.error : `The server answered ${res.status}.`), { status: res.status, data: data || {} });
    return data;
  }
  const portalHome = () => {
    try {
      const u = new URL(location.href);
      u.searchParams.delete('server');
      u.hash = 'sign-in';
      return u.toString();
    } catch (e) {
      return '#sign-in';
    }
  };
  function page(firm, inner) {
    return `<div class="pt pt-auth txl"><header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${h(firm || '')}</span></div></header><main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ivf-msg">${inner}<p class="txl-way"><a class="txl-out" href="${h(portalHome())}">Go to the investor portal</a></p></div></main></div>`;
  }
  function render(param) {
    const r = S().remote;
    if (V.token !== param) reset(param);
    if (!r || r.refused || !r.server) return page('', '<h1>This link does not work here</h1><p class="lede">The link points to a server this portal is not set up to use, so it was not opened and nothing was sent anywhere.</p>');
    if (V.error) {
      const st = V.error.status;
      const text = st === 404 || st === 410 ? 'This document is no longer available.' : st === 423 ? 'This link is locked after five wrong tries. Ask the firm that sent it for a new link.' : 'We could not open your tax document. Check your connection and try again.';
      return page('', `<h1>${h(text)}</h1>${st === 404 || st === 410 || st === 423 ? '' : '<div class="ob-actions"><button class="btn btn-primary" type="button" data-action="txl-reload">Try again</button></div>'}`);
    }
    if (!V.info) return page('', '<p class="lede" role="status">Opening your tax document…</p>');
    const i = V.info;
    const head = `<h1>${h(i.doc.title)}</h1><p class="lede">From ${h(i.firm.name)}${i.doc.availableUntil ? ` · available until ${h(day(i.doc.availableUntil))}` : ''}</p>`;
    if (V.locked) return page(i.firm.name, `${head}<p class="lede" role="alert">This link is now locked after five wrong tries. Ask ${h(i.firm.name)} to send you a new one.</p>`);
    if (V.file) {
      return page(i.firm.name, `${head}<div class="ob-actions"><button class="btn btn-primary" type="button" data-action="txl-save">Save</button></div><div class="txl-pages" data-txl="pages"><p class="empty">Loading…</p></div>`);
    }
    const need = !!i.needs.consent;
    const consent = need
      ? `<div class="txl-consent" data-txl="consent"><h2>Consent to electronic delivery</h2>${(i.consent.lines || []).map((l) => `<p class="meta">${h(l)}</p>`).join('')}<label class="check" for="txl-consent"><input id="txl-consent" type="checkbox"> <span>I consent to receive my tax documents from ${h(i.firm.name)} electronically.</span></label></div>`
      : '';
    return page(
      i.firm.name,
      `${head}${consent}<form class="ob-form" data-form="txl-open" novalidate><label class="field" for="txl-last4"><span>Last four digits of the tax number you gave ${h(i.firm.name)}</span><input id="txl-last4" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></label>${V.msg ? `<p class="field-error" role="alert">${h(V.msg)}</p>` : ''}<div class="ob-actions"><button class="btn btn-primary" type="submit" data-action="txl-open"${V.busy ? ' disabled' : ''}>${V.busy ? 'Opening…' : 'Open document'}</button></div></form>`
    );
  }
  function load() {
    if (V.load || !S().remote || S().remote.refused || !S().remote.server) return;
    V.load = 'loading';
    const token = V.token;
    docCall('GET', '/v1/taxdoc').then(
      (info) => {
        if (V.token !== token) return;
        V.info = info;
        V.load = 'ready';
        NS.app.render();
      },
      (e) => {
        if (V.token !== token) return;
        V.error = e;
        V.load = 'failed';
        NS.app.render();
      }
    );
  }
  async function open() {
    if (V.busy || !V.info) return;
    const digits = String((document.getElementById('txl-last4') || {}).value || '').trim();
    const box = document.getElementById('txl-consent');
    const consent = !!(box && box.checked);
    if (!/^\d{4}$/.test(digits)) {
      V.msg = 'Enter the last four digits of your tax number.';
      return NS.app.render();
    }
    if (V.info.needs.consent && !consent) {
      V.msg = 'To open it here, tick the box to consent. Without your consent it is sent to you on paper.';
      return NS.app.render();
    }
    V.busy = true;
    V.msg = '';
    NS.app.render();
    try {
      const r = await docCall('POST', '/v1/taxdoc/open', { last4: digits, consent });
      const bin = atob(r.pdf || '');
      const u8 = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      V.file = { name: r.fileName || 'tax-document.pdf', bytes: u8 };
      V.drawn = false;
    } catch (e) {
      if (e.status === 403) V.msg = `Those four digits do not match the tax number on record. ${e.data.triesLeft === 1 ? '1 try left.' : `${e.data.triesLeft} tries left.`}`;
      else if (e.status === 423) V.locked = true;
      else if (e.status === 404 || e.status === 410) V.error = e;
      else V.msg = e.network ? 'The connection failed. Try again.' : e.message;
    }
    V.busy = false;
    NS.app.render();
  }
  function after() {
    load();
    if (V.file && !V.drawn) {
      const body = document.querySelector('[data-txl=pages]');
      if (body && NS.esign && NS.esign.viewPdf) {
        V.drawn = true;
        NS.esign.viewPdf(body, new Blob([V.file.bytes], { type: 'application/pdf' }), V.info.doc.title, true);
      }
    }
  }
  NS.forms = NS.forms || {};
  NS.forms['txl-open'] = () => open();
  NS.actions['txl-open'] = (el, e) => {
    if (e && e.preventDefault) e.preventDefault();
    open();
  };
  NS.actions['txl-save'] = () => {
    if (V.file) U.download(V.file.name, V.file.bytes, { mime: 'application/pdf' });
  };
  NS.actions['txl-reload'] = () => {
    const t = V.token;
    reset(t);
    NS.app.render();
  };
  NS.views.taxdoc = { standalone: true, edition: 'diy', title: 'Your tax document', render, after };
  // The first route may have been read before this file loaded (it loads after the page): read the address again.
  if (/^#taxdoc-/.test(location.hash) && NS.app && NS.app.state) {
    if (S().route === 'taxdoc') NS.app.render();
    else NS.app.go(location.hash.slice(1));
  }
})(window.CVPortal);
