/*
 * The co-investor: a second investor on an investor's account.
 *
 * - The firm adds one co-investor to an account (first name, last name, email), sees them on the investor's record,
 *   changes them and takes them off. The record keeps them as inv.coInvestor: { first, last, name, email, added }.
 * - When an offering's agreement prints places for a co-investor (read by placement.js, kept as the template role
 *   "Investor 2"), the firm is told wherever it looks at that offering's investors: on the agreement panel, on the
 *   investor's record, in the investors list and under Needs attention. The notice for an investor goes once a
 *   co-investor is on the account, or once the firm says the investor has none (inv.noCoInvestor, one click, undone
 *   in one click).
 * - Signing is esign.js: the co-investor is a second investor signer with their own places (NS.coSigning).
 *
 * The only word for this person on screen is "Co-investor": the portal never says why an account has two people.
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const { h, icon } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const CS = () => NS.coSigning;
  const canEdit = () => NS.app.can('operate');
  const invById = (id) => (W().investors || []).find((x) => x.id === id) || null;
  const coOf = (inv) => (CS() ? CS().coOf(inv) : null);
  const tidy = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
  const audit = (action, detail, record) => NS.audit && NS.audit.log(W(), { action, detail, fund: '', record: record || '' });

  /**
   * The offerings an investor is in through the portal: invited to, subscribing to, or with an agreement made for them.
   * A holding recorded with no invitation, subscription or agreement in the portal was signed elsewhere and is not asked about.
   */
  function offeringsOf(ws, inv) {
    const ids = {};
    (ws.invitations || []).forEach((it) => it.investorId === inv.id && it.offeringId && it.status !== 'cancelled' && (ids[it.offeringId] = true));
    (ws.requests || []).forEach((r) => r.investorId === inv.id && r.type === 'subscription' && r.offeringId && (ids[r.offeringId] = true));
    (ws.envelopes || []).forEach((e) => e.offeringId && e.status !== 'voided' && e.status !== 'draft' && e.signers.some((s) => s.investorId === inv.id) && (ids[e.offeringId] = true));
    if (inv.onboarding && inv.onboarding.offeringId) ids[inv.onboarding.offeringId] = true;
    return (ws.offerings || []).filter((o) => ids[o.id]);
  }
  /**
   * The offerings whose agreement has places for a co-investor, for an investor whose account has none and who has
   * not been said to have none: what the firm is told about. Empty when there is nothing to tell.
   */
  function need(ws, inv) {
    if (!CS() || !inv || coOf(inv) || inv.noCoInvestor) return [];
    return offeringsOf(ws, inv).filter((o) => CS().coPlaces(ws, o.id));
  }
  const needing = (ws, offeringId) => (ws.investors || []).filter((inv) => need(ws, inv).some((o) => !offeringId || o.id === offeringId));

  /* ---------- Words ---------- */
  const noticeText = (inv, offs) =>
    `${offs.length === 1 ? `The ${offs[0].name} agreement has` : 'Agreements this investor signs have'} places for a co-investor. If ${inv.contact || inv.title} is investing with a second person, add them to the account so they can sign.`;
  function noticeHTML(ws, inv) {
    const offs = need(ws, inv);
    if (!offs.length) return '';
    return `<div class="co-note" role="status"><p>${h(noticeText(inv, offs))}</p>${
      canEdit() ? `<div class="cs-row"><button class="cs-btn cs-btn-small cs-btn-primary" type="button" data-action="co-add" data-id="${h(inv.id)}">${icon('plus')}Add co-investor</button><button class="cs-btn cs-btn-small" type="button" data-action="co-none" data-id="${h(inv.id)}">This investor has no co-investor</button></div>` : ''
    }</div>`;
  }

  /* ---------- The investors list: a small status, and the way into the record ---------- */
  function statusHTML(ws, inv) {
    const c = coOf(inv);
    if (c) return `<span class="sub co-status">Co-investor: ${h(c.name)}</span>`;
    if (!need(ws, inv).length) return '';
    return `<span class="sub co-status"><span class="cs-badge cs-badge-warn">Agreement has places for a co-investor</span>${canEdit() ? ` <button class="link-btn" type="button" data-action="co-add" data-id="${h(inv.id)}">Add co-investor</button>` : ''}</span>`;
  }
  const recordButton = (inv) => `<button class="cs-btn cs-btn-small" type="button" data-action="co-record" data-id="${h(inv.id)}">Account</button>`;

  /* ---------- The investor's record ---------- */
  function recordHTML(inv) {
    const ws = W();
    const c = coOf(inv);
    const offs = offeringsOf(ws, inv);
    const type = (NS.ENTITY_TYPES[inv.type] || {}).label || inv.type || '';
    const edit = canEdit();
    const co = c
      ? `<strong>${h(c.name)}</strong><span class="sub">${h(c.email)}</span><span class="sub">On the account since ${h(U.date(String(c.added || '').slice(0, 10)))}. Signs their own places on this account’s agreements, with their own sign-in.</span>`
      : inv.noCoInvestor
        ? `None<span class="sub">You said ${h(inv.contact || inv.title)} has no co-investor.</span>`
        : 'None';
    const acts = !edit
      ? ''
      : c
        ? `<button class="cs-btn" type="button" data-action="co-add" data-id="${h(inv.id)}">Change co-investor</button><button class="cs-btn" type="button" data-action="co-remove" data-id="${h(inv.id)}">Remove co-investor</button>`
        : inv.noCoInvestor
          ? `<button class="cs-btn" type="button" data-action="co-add" data-id="${h(inv.id)}">${icon('plus')}Add co-investor</button><button class="cs-btn" type="button" data-action="co-none-undo" data-id="${h(inv.id)}">Undo: ask me again</button>`
          : need(ws, inv).length
            ? ''
            : `<button class="cs-btn" type="button" data-action="co-add" data-id="${h(inv.id)}">${icon('plus')}Add co-investor</button>`;
    return `<div class="dlg-head"><div><h2>${h(inv.title)}</h2><p>Investor account · ${h(inv.id)}</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body co-record" data-investor="${h(inv.id)}">
        <dl class="cs-kv">
          <div><dt>Investor</dt><dd><strong>${h(inv.contact || inv.title)}</strong><span class="sub">${h(inv.email)}</span></dd></div>
          <div><dt>Co-investor</dt><dd class="co-who">${co}</dd></div>
          <div><dt>Account type</dt><dd>${h(type)}</dd></div>
          <div><dt>Offerings</dt><dd>${offs.length ? h(offs.map((o) => o.shortName || o.name).join(', ')) : 'None yet'}</dd></div>
        </dl>
        ${noticeHTML(ws, inv)}
        <div class="cs-row cs-row-end">${acts}<button class="cs-btn" type="button" data-action="close-dialog">Close</button></div>
      </div>`;
  }
  const openRecord = (inv) => U.dialog(recordHTML(inv), 'dlg-es dlg-co');
  NS.actions['co-record'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    if (inv) openRecord(inv);
  };

  /* ---------- Adding and changing ---------- */
  function formHTML(inv, d) {
    const c = coOf(inv);
    const err = (k) => (d.errors[k] ? `<span class="cs-error-text" role="alert">${h(d.errors[k])}</span>` : '');
    const bad = (k) => (d.errors[k] ? ' aria-invalid="true"' : '');
    return `<form class="es-dlg-form" data-form="co-save" data-id="${h(inv.id)}" novalidate><div class="dlg-head"><div><h2>${c ? 'Change co-investor' : 'Add co-investor'}</h2><p>${h(inv.title)}. The co-investor signs their own places on this account’s agreements, signed in with their own email.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-grid">
        <label class="cs-field" for="co-first"><span>First name</span><input id="co-first" name="first" maxlength="60" autocomplete="off" value="${h(d.first)}"${bad('name')} autofocus></label>
        <label class="cs-field" for="co-last"><span>Last name</span><input id="co-last" name="last" maxlength="60" autocomplete="off" value="${h(d.last)}"${bad('name')}>${err('name')}</label>
        <label class="cs-field cs-wide" for="co-email"><span>Email</span><input id="co-email" name="email" type="email" maxlength="120" autocomplete="off" value="${h(d.email)}"${bad('email')}>${err('email')}</label>
      </div>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="co-record" data-id="${h(inv.id)}">Cancel</button><button class="cs-btn cs-btn-primary" type="submit">${c ? 'Save co-investor' : 'Add co-investor'}</button></div></div></form>`;
  }
  NS.actions['co-add'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    if (!inv || !canEdit()) return;
    const c = coOf(inv);
    // An account opened for two people already names the second: offered as a start, to be completed with their email.
    const second = !c && NS.names && NS.names.holders ? (NS.names.holders(inv) || [])[1] : null;
    U.dialog(formHTML(inv, { first: c ? c.first : second ? second.first || '' : '', last: c ? c.last : second ? second.last || '' : '', email: c ? c.email : '', errors: {} }), 'dlg-es dlg-co');
  };
  NS.forms['co-save'] = (form) => {
    const ws = W();
    const inv = invById(form.getAttribute('data-id'));
    if (!inv || !canEdit()) return;
    const d = { first: tidy(form.first.value), last: tidy(form.last.value), email: tidy(form.email.value), errors: {} };
    if (!d.first || !d.last) d.errors.name = !d.first && !d.last ? 'Enter the co-investor’s first and last name.' : !d.first ? 'Enter the co-investor’s first name.' : 'Enter the co-investor’s last name.';
    if (!isEmail(d.email)) d.errors.email = 'Enter a valid email address.';
    else if (d.email.toLowerCase() === String(inv.email || '').toLowerCase()) d.errors.email = `The co-investor signs in with their own email address. This one is ${inv.contact || inv.title}’s.`;
    if (Object.keys(d.errors).length) {
      U.dialog(formHTML(inv, d), 'dlg-es dlg-co');
      const first = document.querySelector('#dlg [aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    const was = coOf(inv);
    const name = `${d.first} ${d.last}`;
    inv.coInvestor = { first: d.first, last: d.last, name, email: d.email, added: was ? was.added : new Date().toISOString() };
    delete inv.noCoInvestor;
    let said;
    if (was) {
      CS().coUpdate(ws, inv);
      audit('Co-investor changed', `${inv.title}: ${was.name} <${was.email}> is now ${name} <${d.email}>`, inv.id);
      said = `Saved. ${name} is the co-investor on ${inv.title}’s account.`;
    } else {
      const r = CS().coAttach(ws, inv);
      audit('Co-investor added', `${inv.title}: ${name} <${d.email}>`, inv.id);
      said = r.added.length
        ? `${name} was added to the account and emailed ${r.added.length === 1 ? 'the agreement' : `${r.added.length} agreements`} to sign (simulated in this demo). ${inv.contact || inv.title} does not sign again.`
        : r.sealed.length
          ? `${name} was added to the account. ${r.sealed[0].title} was already signed by everyone and is sealed with its certificate, so it stays as it is: ${name} is not a signer on it.`
          : `${name} was added to the account. They sign their own places on each agreement made for it.`;
    }
    NS.app.save(true);
    NS.app.render();
    openRecord(inv);
    U.toast(said);
  };

  /* ---------- Taking off ---------- */
  NS.actions['co-remove'] = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    const c = inv && coOf(inv);
    if (!c || !canEdit()) return;
    const held = CS().coHolding(W(), inv);
    const back = `<button class="cs-btn" type="button" data-action="co-record" data-id="${h(inv.id)}" autofocus>Keep them</button>`;
    U.dialog(
      held.length
        ? `<div class="dlg-head"><div><h2>${h(c.name)} still has an agreement to sign</h2><p>${h(held[0].title)} is signed by everyone else and waits for ${h(c.name)} alone. Let them sign it, or void that agreement on the E-sign page, then remove them.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
          <div class="dlg-body"><div class="cs-row cs-row-end"><button class="cs-btn cs-btn-primary" type="button" data-action="co-record" data-id="${h(inv.id)}" autofocus>Back</button></div></div>`
        : `<div class="dlg-head"><div><h2>Remove the co-investor?</h2><p>${h(c.name)} comes off ${h(inv.title)}’s account and off each agreement they have not signed yet. An agreement they already signed keeps their signature.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
          <div class="dlg-body"><div class="cs-row cs-row-end">${back}<button class="cs-btn cs-btn-primary" type="button" data-action="co-remove-yes" data-id="${h(inv.id)}">Remove</button></div></div>`,
      'dlg-es dlg-co'
    );
  };
  NS.actions['co-remove-yes'] = (el) => {
    const ws = W();
    const inv = invById(el.getAttribute('data-id'));
    const c = inv && coOf(inv);
    if (!c || !canEdit() || CS().coHolding(ws, inv).length) return;
    delete inv.coInvestor;
    CS().coDetach(ws, inv, c);
    if (S().viewer === inv.id) S().co = false;
    audit('Co-investor removed', `${inv.title}: ${c.name} <${c.email}>`, inv.id);
    NS.app.save(true);
    NS.app.render();
    openRecord(inv);
    U.toast(`${c.name} was removed from the account.`);
  };

  /* ---------- "This investor has no co-investor": one click, and one click back ---------- */
  const setNone = (el, none) => {
    const inv = invById(el.getAttribute('data-id'));
    if (!inv || !canEdit()) return;
    if (none) inv.noCoInvestor = true;
    else delete inv.noCoInvestor;
    audit(none ? 'Investor marked as having no co-investor' : 'Co-investor question reopened', inv.title, inv.id);
    NS.app.save(true);
    NS.app.render();
    openRecord(inv);
    if (none) U.toast(`Noted: ${inv.contact || inv.title} has no co-investor. You can undo this on their account.`);
  };
  NS.actions['co-none'] = (el) => setNone(el, true);
  NS.actions['co-none-undo'] = (el) => setNone(el, false);

  /* ---------- The offering's agreement panel ---------- */
  if (NS.esign && NS.esign.agreementPanel) {
    const panel = NS.esign.agreementPanel;
    NS.esign.agreementPanel = function (ws, o, edit) {
      const html = panel.apply(this, arguments);
      if (!CS() || !CS().coPlaces(ws, o.id)) return html;
      const who = needing(ws, o.id);
      const list = who.length
        ? `<p>${who.length === 1 ? '1 investor in this offering has' : `${who.length} investors in this offering have`} no co-investor on their account: ${who
            .slice(0, 6)
            .map((inv) => `<button class="link-btn" type="button" data-action="co-record" data-id="${h(inv.id)}">${h(inv.title)}</button>`)
            .join(', ')}${who.length > 6 ? `, and ${who.length - 6} more on the <a href="#console-investors">Investors</a> page` : ''}.</p>`
        : '';
      const note = `<div class="co-note" role="status" id="agreement-co"><p>This agreement has places for a co-investor. If an investor is investing with a second person, add them to the investor’s account so they can sign. With no co-investor on the account, those places are left out of that investor’s agreement.</p>${list}</div>`;
      const at = html.lastIndexOf('<div class="cs-row">');
      const open = '<div class="es-agr-panel" id="agreement">';
      return at >= 0 ? html.slice(0, at) + note + html.slice(at) : html.replace(open, open + note);
    };
  }

  /* ---------- Needs attention ---------- */
  NS.hooks.consoleAttention.push((ws) => {
    const who = needing(ws, '');
    if (!who.length) return '';
    return `<li><a href="#console-investors">${
      who.length === 1 ? `${h(who[0].title)}’s agreement has places for a co-investor: add the co-investor to the account, or say there is none` : `${who.length} investors have an agreement with places for a co-investor: add each co-investor, or say there is none`
    }</a></li>`;
  });

  /* ---------- The firm hears when the co-investor signs ---------- */
  if (NS.esign && NS.esign.onSigned)
    NS.esign.onSigned((env, signer, complete) => {
      if (!signer || !signer.co) return false;
      if (NS.invitations && NS.invitations.notify) {
        const firm = env.signers.some((s) => s.role === 'countersigner' && s.status !== 'signed');
        NS.invitations.notify(W(), 'agreement_signed', `${signer.name} signed the subscription agreement as co-investor`, `${env.title}: ${complete ? 'complete' : firm ? 'waiting for your countersignature' : 'waiting for the other signers'}`, `console-envelope-${env.id}`);
      }
      return false;
    });

  NS.coInvestor = { need, needing, noticeText, noticeHTML, statusHTML, recordButton, offeringsOf };
})(window.CVPortal);
