/*
 * The investor's side of tax document delivery (plan 10-06, TAX-04 to TAX-06, Rev. Proc. 2012-17 sections 4, 5 and 9).
 * Loaded beside taxdocs-ui.js (its fixed PARTS list) in the self-serve edition only.
 *
 * At the top of Documents (the documentsTop hook): the investor's consent to electronic delivery of tax documents. It is
 * asked separately from everything else, is never required, and nothing else on any page waits for it. The disclosure
 * shown with it is NS.taxdocs.CONSENT.lines and nothing more; the text agreed to is stored by NS.taxdocs.consent with its
 * version and date. Without consent in effect the investor sees only that a tax document is waiting, never its title or
 * pages. Withdrawing is one control, and the date is then shown in writing.
 *
 * Where an uploaded document opens (the documentOpened hook portal.js runs): a document with a tax block has its open
 * recorded (NS.taxdocs.opened) and the date it leaves the portal is shown under the title; any other document gets
 * nothing. Only an investor signed in as themselves records an open or a consent; a sponsor's preview never does.
 *
 * Every decision is NS.taxdocs's; this file draws what it returns. No network call is made on any path.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.EDITION || !NS.EDITION.diy || !NS.taxdocs) return;
  const U = NS.ui;
  const { h } = U;
  const TD = () => NS.taxdocs;
  const W = () => NS.state.ws;
  const day = (iso) => U.date(String(iso || '').slice(0, 10), 'long');
  const ui = () => NS.state.ui.txi || (NS.state.ui.txi = { review: false });
  const PARTS = ['name', 'address', 'phone', 'email'];
  const contactOf = (ws) => ((ws && ws.taxdocs) || {}).contact || {};
  const complete = (c) => PARTS.every((k) => !!c[k]);
  const self = () => NS.state.role === 'investor';
  const viewer = () => (NS.portalKit && NS.portalKit.viewer ? NS.portalKit.viewer() : null);
  const sec = (label) => (NS.portalKit && NS.portalKit.sec ? NS.portalKit.sec(label) : `<div class="sec-head"><h2>${label}</h2></div>`);

  /** A replaced document whose access period has ended leaves the list (NS.taxdocs.expire); the page is drawn again once. */
  function tidy(ws) {
    if (!ws || typeof TD().expire !== 'function') return;
    if (TD().expire(ws, NS.dates.today()) > 0) {
      NS.app.save(true);
      setTimeout(() => NS.app.render(), 0);
    }
  }

  function consentHTML(inv) {
    const ws = W();
    tidy(ws);
    const c = contactOf(ws);
    // The disclosure must name the firm's contact (section 5.05); until the firm has given it, nothing is offered.
    if (!inv || !complete(c)) return '';
    const td = inv.taxDelivery || null;
    const on = TD().inEffect(inv);
    const waiting = (ws.docs || []).filter((d) => d.tax && d.tax.state === 'waiting' && (d.investors || [])[0] === inv.id).length;
    const u = ui();
    const lines = [];
    if (on) lines.push(`<p>You consented on ${h(day(td.at))}.</p>`);
    else if (td && td.withdrawnAt) lines.push(`<p>You withdrew consent on ${h(day(td.withdrawnAt))}.</p>`);
    if (!on && waiting) lines.push(`<p><strong>${waiting === 1 ? 'A tax document is' : `${waiting} tax documents are`} waiting for you.</strong></p>`);
    else if (!on && !(td && td.withdrawnAt)) lines.push('<p>Receive your tax documents here instead of on paper.</p>');
    const review = !on && u.review;
    const acts = on
      ? '<button class="btn btn-small" type="button" data-action="txi-withdraw">Withdraw consent</button>'
      : review
        ? ''
        : `<button class="btn btn-primary btn-small" type="button" data-action="txi-review">${td && td.withdrawnAt ? 'Consent again' : 'Review and consent'}</button>`;
    const disclosure = review
      ? `<div class="cert" data-txi="disclosure">${TD()
          .CONSENT.lines(c)
          .map((l) => `<p>${h(l.text)}</p>`)
          .join('')}</div><p><button class="btn btn-primary" type="button" data-action="txi-consent">I consent</button> <button class="btn" type="button" data-action="txi-cancel">Not now</button></p>`
      : '';
    return `<section class="sec txi" aria-label="Electronic delivery of tax documents" data-txi="block">${sec('Electronic delivery of tax documents')}${lines.join('')}${disclosure}${acts ? `<p>${acts}</p>` : ''}</section>`;
  }

  NS.hooks.documentsTop.push((inv) => consentHTML(inv));

  NS.hooks.documentOpened = NS.hooks.documentOpened || [];
  NS.hooks.documentOpened.push((doc) => {
    const ws = W();
    const d = doc && (ws.docs || []).find((x) => x.id === doc.id && x.tax);
    if (!d) return '';
    if (self()) {
      const was = d.tax.opens ? d.tax.opens.count : 0;
      TD().opened(ws, d.id);
      if (d.tax.opens && d.tax.opens.count !== was) NS.app.save(true);
    }
    const replaced = d.tax.state === 'replaced';
    return `<p class="txi-until">${replaced ? 'Replaced by a later document. ' : ''}${d.tax.availableUntil ? `Available in the portal until ${h(day(d.tax.availableUntil))}.` : ''}</p>`;
  });

  NS.actions['txi-review'] = () => {
    ui().review = true;
    NS.app.render();
  };
  NS.actions['txi-cancel'] = () => {
    ui().review = false;
    NS.app.render();
  };
  NS.actions['txi-consent'] = () => {
    const inv = viewer();
    if (!inv || !self()) return;
    try {
      TD().consent(W(), inv.id, { where: 'portal' });
    } catch (e) {
      return U.toast((e && e.message) || 'Your consent could not be recorded.');
    }
    ui().review = false;
    NS.app.save(true);
    NS.app.render();
  };
  NS.actions['txi-withdraw'] = () => {
    const inv = viewer();
    if (!inv || !self()) return;
    try {
      TD().withdrawConsent(W(), inv.id, { where: 'portal' });
    } catch (e) {
      return U.toast((e && e.message) || 'Your withdrawal could not be recorded.');
    }
    NS.app.save(true);
    NS.app.render();
  };

  // Loaded after the page was first drawn: Documents is drawn again so the block is there.
  if (NS.state && NS.state.route === 'documents' && NS.app && NS.app.render) NS.app.render();
})(window.CVPortal);
