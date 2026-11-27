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
 * - Self-serve edition (plan 06-37): the co-investor gets their own sign-in, inv.coInvestor.signIn = { token, link, createdAt,
 *   expiresAt, sentAt, openedAt } (plan 06-39 adds serverId, envelopeId, emailStatus, error when the integration server sends
 *   it). The firm sends the link from its own email app (the "Co-investor sign-in email" dialog); the link (#co-<token>) signs
 *   the co-investor in to the account with only their own places (NS.views.co). A changed email gives a new link; removing
 *   the co-investor ends it. NS.coInvestor.hooks lets plan 06-39 send it by the server. The managed edition is unchanged (C-03).
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
  const E = NS.EDITION || {};
  const B = NS.brand;
  const DAY = 864e5;
  const SIGN_IN_DAYS = 30; // as an investor's invitation (invitations.js VALID_DAYS)
  const RETIRED_MAX = 200;
  /** Plan 06-39: added fn(ws, inv, was) after a sign-in is made (true = the server sent it); removed fn(ws, inv, removed). */
  const hooks = { added: [], removed: [] };

  /* ---------- The co-investor's own sign-in (self-serve edition) ---------- */
  /** 32 random bytes, base64url (as invitations.js newToken). */
  function newToken() {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    let s = '';
    b.forEach((x) => (s += String.fromCharCode(x)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const portalPage = () => `${location.origin}${location.pathname}`;
  const signInOf = (inv) => {
    const c = coOf(inv);
    // Plan 06-39: with the integration server the record is the server's kind (server: true), with no link token of its own.
    return c && c.signIn && (c.signIn.token || c.signIn.server) ? c.signIn : null;
  };
  const expired = (si) => !!si && !!si.expiresAt && Date.parse(si.expiresAt) < Date.now();
  const hashOf = (token) => (NS.audit && NS.audit.sha256 ? NS.audit.sha256(String(token)) : String(token));
  /** A link that stops working is remembered by its hash only, so its page says it no longer works (not "not found"). */
  function retire(ws, si) {
    if (!si || !si.token) return;
    const list = (ws.coSignInRetired = ws.coSignInRetired || []);
    list.push({ hash: hashOf(si.token), at: new Date().toISOString() });
    if (list.length > RETIRED_MAX) list.splice(0, list.length - RETIRED_MAX);
  }
  /** A new sign-in for the account's co-investor; the one it replaces stops working. */
  function issue(ws, inv) {
    const c = coOf(inv);
    if (!c) return null;
    retire(ws, signInOf(inv));
    const token = newToken();
    const now = Date.now();
    c.signIn = { token, link: `${portalPage()}?tenant=${encodeURIComponent(ws.tenant.id)}#co-${token}`, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SIGN_IN_DAYS * DAY).toISOString(), sentAt: '', openedAt: '' };
    return c.signIn;
  }
  /** When the co-investor last signed one of the account's agreements, once none waits for them ('' otherwise). */
  function coSignedAt(inv) {
    const ws = W();
    if (!taskOf(ws, inv).signed) return '';
    const mine = (ws.envelopes || []).filter((e) => e.status === 'sent' || e.status === 'completed').map((e) => e.signers.find((s) => s.co && s.investorId === inv.id));
    return mine.filter((s) => s && s.status === 'signed' && s.signedAt).map((s) => String(s.signedAt)).sort().pop() || '';
  }
  /** What the firm sees about the sign-in, in the investors row and the Account window ('' in the managed edition). */
  function signInText(inv) {
    const si = E.diy ? signInOf(inv) : null;
    if (!si) return '';
    const day = (iso) => U.date(String(iso || '').slice(0, 10));
    // Plan 06-39 (integration server): sent for the agreement that waits for the co-investor, once the investor has signed.
    // A server without mail settings keeps the email in its outbox: said as it is.
    if (si.server) {
      if (si.signedAt) return `Signed ${day(si.signedAt)}`;
      if (si.sending) return 'Emailing the sign-in…';
      if (si.error) return `Sign-in not sent: ${si.error}`;
      if (si.serverId && si.sentAt) return si.emailStatus === 'outbox' ? `Sign-in in the server outbox ${day(si.sentAt)}` : `Sign-in emailed ${day(si.sentAt)}`;
      return `Sign-in is emailed once ${inv.contact || inv.title} has signed`;
    }
    if (si.serverId) return si.sentAt ? `Sign-in emailed ${day(si.sentAt)}` : `Sign-in is emailed once ${inv.contact || inv.title} has signed`;
    // The co-investor signed what waited for them on the account (the server's sign-in says the same).
    const signed = coSignedAt(inv);
    if (signed) return `Signed ${day(signed)}`;
    if (expired(si) && !si.openedAt) return 'Sign-in link expired';
    return si.sentAt ? `Sign-in sent ${day(si.sentAt)}` : 'Sign-in link ready to send';
  }
  /** The person sending, as an invitation names them (invitations.js senderName). */
  function senderName(ws) {
    const team = ws.team || [];
    const role = S().role;
    const me = team.find((m) => m.current && m.role === role) || team.find((m) => m.role === role && m.status !== 'invited') || null;
    return me ? me.name : ws.tenant.support.team;
  }
  /** The sign-in email, worded and laid out as the investor's invitation email (invitations.js emailFor). */
  function emailOf(ws, inv) {
    const t = ws.tenant;
    const c = coOf(inv);
    const si = signInOf(inv);
    const by = senderName(ws);
    const sender = by && by !== t.support.team ? `${by} at ${t.name}` : t.name;
    const subject = `${t.name}: sign the subscription agreement for ${inv.title}`;
    const lines = [`Dear ${c.first || c.name},`, `${sender} asks you to sign the subscription agreement for ${inv.title} as co-investor.`, 'The link below opens the agreement with only your places to sign. Nothing else is asked.'];
    const tail = [`This link is personal to you; please do not forward it. It expires on ${U.date(String(si.expiresAt).slice(0, 10), 'long')}.`, `Questions? Contact ${t.support.team}${isEmail(t.support.email) ? ` at ${t.support.email}` : ''}.`];
    const text = [lines.join('\n\n'), `Start here: ${si.link}`, tail.join('\n'), t.legalName || t.name].join('\n\n');
    return { subject, lines, tail, text, link: si.link, to: c.email, toName: c.name, fromName: t.name, button: 'Open the agreement' };
  }
  /** mailto: with the subject and body; CRLF line breaks (RFC 6068). */
  const mailtoOf = (m) => `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text.replace(/\r?\n/g, '\r\n'))}`;
  /** The "Co-investor sign-in email" dialog (the investor invitation email's layout, invitations.js showEmail). */
  function showSignIn(inv) {
    const ws = W();
    const si = signInOf(inv);
    // A server sign-in not created yet (nothing waits for the co-investor, or it could not be sent) has no email to show.
    if (!E.diy || !si || (si.server && !si.serverId)) return openRecord(inv);
    const t = ws.tenant;
    const local = !si.serverId;
    const id = h(inv.id);
    const close = `<button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button>`;
    if (local && expired(si) && !si.openedAt) {
      return U.dialog(
        `<div class="dlg-head"><div><h2>Co-investor sign-in email</h2><p>${h(inv.title)}</p></div><div class="dlg-actions">${close}</div></div>
        <div class="dlg-body"><p>The sign-in link for ${h(coOf(inv).name)} expired on ${h(U.date(String(si.expiresAt).slice(0, 10), 'long'))}. It no longer works.</p>
        <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="co-record" data-id="${id}">Back</button>${canEdit() ? `<button class="cs-btn cs-btn-primary" type="button" data-action="co-link-new" data-id="${id}">Make a new link</button>` : ''}</div></div>`,
        'dlg-email'
      );
    }
    const m = emailOf(ws, inv);
    U.dialog(
      `<div class="dlg-head"><div><h2>Co-investor sign-in email</h2><p>${local ? 'Send it from your email app. The portal prepared it with the co-investor’s link.' : 'The email your integration server sends.'}</p></div><div class="dlg-actions">${close}</div></div>
      <div class="dlg-body inv8-email">
        ${placelessHTML(ws, inv)}
        <dl class="inv8-meta">
          <div><dt>From</dt><dd>${h(m.fromName)}${local ? ' <span class="cs-hint">(your own address, from your email app)</span>' : ''}</dd></div>
          <div><dt>To</dt><dd>${h(m.toName)} &lt;${h(m.to)}&gt;</dd></div>
          <div><dt>Subject</dt><dd class="inv8-subject">${h(m.subject)}</dd></div>
        </dl>
        <article class="email">
          <div class="email-head">${B.lockup(t)}</div>
          <div class="email-body">
            ${m.lines.map((l) => `<p>${h(l)}</p>`).join('')}
            <p><span class="email-btn">${h(m.button)}</span></p>
            <p class="inv8-raw">${h(m.link)}</p>
            ${m.tail.map((l) => `<p>${h(l)}</p>`).join('')}
          </div>
          <div class="email-foot">${h(t.legalName || t.name)}</div>
        </article>
        <label class="cs-field inv8-linkfield" for="co-link"><span>Sign-in link</span><input id="co-link" type="text" readonly value="${h(m.link)}"></label>
        ${local ? '<p class="cs-hint">This link opens the portal in this browser only.</p>' : ''}
        <div class="cs-row cs-row-end inv8-actions">
          <button class="cs-btn" type="button" data-action="co-link-copy" data-id="${id}">${icon('copy')}Copy link</button>
          ${local ? `<a class="cs-btn" id="co-mailto" href="${h(mailtoOf(m))}" data-action="co-link-mailto" data-id="${id}">Open in your email app</a>${canEdit() ? `<button class="cs-btn cs-btn-primary" type="button" data-action="co-link-sent" data-id="${id}">Mark as sent</button>` : ''}` : '<button class="cs-btn cs-btn-primary" type="button" data-action="close-dialog">Done</button>'}
        </div>
        ${local && NS.app.config.demo ? `<p class="cs-hint inv8-try">Trying it out? <button class="link-btn" type="button" data-action="co-link-open" data-id="${id}">Open the co-investor’s link</button> in this browser, signed in as ${h(coOf(inv).name)}.</p>` : ''}
      </div>`,
      'dlg-email'
    );
  }

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
  /**
   * Walkthrough 3 failure 2. The offerings of an account with a co-investor where the co-investor has nothing to sign: the
   * offering's agreement has no place for a co-investor, and the account's agreement for it is still to be made or out for
   * signature without them (one signed by everyone is sealed and stays as it is). Self-serve edition (the managed edition is
   * unchanged, C-03).
   */
  function placeless(ws, inv) {
    if (!E.diy || !CS() || !coOf(inv) || !NS.esign) return [];
    return offeringsOf(ws, inv).filter((o) => {
      if (CS().coPlaces(ws, o.id)) return false;
      const mine = (ws.envelopes || []).filter((e) => e.offeringId === o.id && e.status !== 'voided' && e.status !== 'draft' && e.signers.some((s) => s.investorId === inv.id));
      if (mine.some((e) => e.signers.some((s) => s.investorId === inv.id && s.co))) return false;
      return mine.length ? mine.some((e) => e.status === 'sent') : !!NS.esign.subscriptionTemplate(ws, o.id);
    });
  }
  /** What the firm is told about it, with how to add a place for the co-investor ('' when it does not apply). */
  function placelessHTML(ws, inv) {
    const offs = placeless(ws, inv);
    if (!offs.length) return '';
    const c = coOf(inv);
    const o = offs[0];
    const who = c.first || c.name;
    return `<div class="co-note co-none" role="status"><p><strong>Nothing for ${h(c.name)} to sign yet.</strong> The ${h(o.name)} subscription agreement has no place for a co-investor, so ${h(who)} has nowhere to sign on ${h(inv.contact || inv.title)}’s agreement${offs.length > 1 ? ` (nor on ${offs.length - 1 === 1 ? 'one other offering’s' : `${offs.length - 1} other offerings’`})` : ''}.</p><p>To add one: on the ${h(o.name)} offering, choose Edit fields on the subscription agreement, give a signature field the signer “Co-investor (if any)” and save. ${h(who)} is then added to the agreement, and the sign-in link opens it.</p>${
      canEdit() ? `<div class="cs-row"><button class="cs-btn cs-btn-small" type="button" data-action="co-open-offering" data-id="${h(o.id)}">Open ${h(o.name)}</button></div>` : ''
    }</div>`;
  }
  NS.actions['co-open-offering'] = (el) => {
    const id = el.getAttribute('data-id');
    if (!(W().offerings || []).some((o) => o.id === id)) return;
    U.closeDialog();
    // The offering's page, at its subscription agreement panel (where Edit fields is).
    const toPanel = () =>
      setTimeout(() => {
        const a = document.getElementById('agreement');
        if (a) a.scrollIntoView({ block: 'center' });
      }, 0);
    window.addEventListener('hashchange', toPanel, { once: true });
    NS.app.go('console-offering-' + id);
  };

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
    if (c) {
      const si = signInText(inv);
      return `<span class="sub co-status">Co-investor: ${h(c.name)}${si ? `<span class="co-signin"> · ${h(si)}</span>` : ''}</span>`;
    }
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
      ? `<strong>${h(c.name)}</strong><span class="sub">${h(c.email)}</span><span class="sub">On the account since ${h(U.date(String(c.added || '').slice(0, 10)))}. Signs their own places on this account’s agreements, with their own sign-in.</span>${signInText(inv) ? `<span class="sub co-signin">${h(signInText(inv))}</span>` : ''}`
      : inv.noCoInvestor
        ? `None<span class="sub">You said ${h(inv.contact || inv.title)} has no co-investor.</span>`
        : 'None';
    const acts = !edit
      ? ''
      : c
        ? `${E.diy && signInOf(inv) && (!signInOf(inv).server || signInOf(inv).serverId) && !signInOf(inv).error ? `<button class="cs-btn" type="button" data-action="co-link" data-id="${h(inv.id)}">Sign-in link</button>` : ''}${E.diy && signInOf(inv) && signInOf(inv).server && signInOf(inv).error ? `<button class="cs-btn cs-btn-primary" type="button" data-action="co-signin-retry" data-id="${h(inv.id)}">Send the sign-in again</button>` : ''}<button class="cs-btn" type="button" data-action="co-add" data-id="${h(inv.id)}">Change co-investor</button><button class="cs-btn" type="button" data-action="co-remove" data-id="${h(inv.id)}">Remove co-investor</button>`
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
        ${placelessHTML(ws, inv)}
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
    // Self-serve edition: the sign-in stays with the same email; a new co-investor or a new email gets a new link (an
    // earlier one stops working).
    const moved = !was || String(was.email || '').toLowerCase() !== d.email.toLowerCase();
    if (was && was.signIn) inv.coInvestor.signIn = was.signIn;
    const fresh = E.diy && (moved || !signInOf(inv)) ? issue(ws, inv) : null;
    delete inv.noCoInvestor;
    let said;
    if (was) {
      CS().coUpdate(ws, inv);
      audit('Co-investor changed', `${inv.title}: ${was.name} <${was.email}> is now ${name} <${d.email}>`, inv.id);
      said = `Saved. ${name} is the co-investor on ${inv.title}’s account.`;
    } else {
      const r = CS().coAttach(ws, inv);
      audit('Co-investor added', `${inv.title}: ${name} <${d.email}>`, inv.id);
      const none = placeless(ws, inv);
      said = r.added.length
        ? E.diy
          ? `${name} was added to the account and to ${r.added.length === 1 ? 'the agreement' : `${r.added.length} agreements`} to sign. ${inv.contact || inv.title} does not sign again.`
          : `${name} was added to the account and emailed ${r.added.length === 1 ? 'the agreement' : `${r.added.length} agreements`} to sign (simulated in this demo). ${inv.contact || inv.title} does not sign again.`
        : r.sealed.length
          ? `${name} was added to the account. ${r.sealed[0].title} was already signed by everyone and is sealed with its certificate, so it stays as it is: ${name} is not a signer on it.`
          : none.length
            ? `${name} was added to the account. The ${none[0].name} agreement has no place for a co-investor, so ${d.first} has nothing to sign on it yet.`
            : `${name} was added to the account. They sign their own places on each agreement made for it.`;
    }
    NS.app.save(true);
    // Plan 06-39 sends the sign-in by the integration server: a hook answering true has sent it (nothing to send by hand).
    const byServer = fresh ? hooks.added.some((fn) => fn(ws, inv, was) === true) : false;
    NS.app.render();
    if (fresh && !byServer) showSignIn(inv);
    else openRecord(inv);
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
    hooks.removed.forEach((fn) => fn(ws, inv, c));
    if (E.diy) retire(ws, signInOf(inv));
    delete inv.coInvestor;
    CS().coDetach(ws, inv, c);
    if (S().viewer === inv.id) S().co = false;
    audit('Co-investor removed', `${inv.title}: ${c.name} <${c.email}>`, inv.id);
    NS.app.save(true);
    NS.app.render();
    openRecord(inv);
    U.toast(`${c.name} was removed from the account.`);
  };

  /* ---------- The sign-in email's actions ---------- */
  const signInFor = (el) => {
    const inv = invById(el.getAttribute('data-id'));
    return inv && signInOf(inv) ? inv : null;
  };
  NS.actions['co-link'] = (el) => {
    const inv = signInFor(el);
    if (inv) showSignIn(inv);
  };
  NS.actions['co-link-copy'] = (el) => {
    const inv = signInFor(el);
    if (inv) U.copy(signInOf(inv).link, document.getElementById('co-link'));
  };
  NS.actions['co-link-mailto'] = (el) => {
    // The browser hands the email to the email app; the firm confirms with Mark as sent once it has gone.
    const inv = signInFor(el);
    if (inv) U.toast(`Your email app opens with the sign-in email to ${coOf(inv).name}. Send it from there, then choose Mark as sent.`);
  };
  NS.actions['co-link-sent'] = (el) => {
    const inv = signInFor(el);
    if (!inv || !canEdit()) return;
    signInOf(inv).sentAt = new Date().toISOString();
    audit('Co-investor sign-in sent', `${inv.title}: ${coOf(inv).name} <${coOf(inv).email}>, from the sender's own email app`, inv.id);
    NS.app.save(true);
    U.closeDialog();
    NS.app.render();
    U.toast(`Sign-in email to ${coOf(inv).name} marked as sent.`);
  };
  NS.actions['co-link-new'] = (el) => {
    const inv = signInFor(el);
    if (!inv || !canEdit()) return;
    issue(W(), inv);
    audit('Co-investor sign-in renewed', `${inv.title}: a new link for ${coOf(inv).name} <${coOf(inv).email}>`, inv.id);
    NS.app.save(true);
    NS.app.render();
    showSignIn(inv);
  };
  NS.actions['co-link-open'] = (el) => {
    const inv = signInFor(el);
    if (!inv || !NS.app.config.demo) return;
    U.closeDialog();
    NS.app.go('co-' + signInOf(inv).token);
  };

  /* ---------- The co-investor's link (#co-<token>) ---------- */
  function resolveSignIn(token) {
    const ws = W();
    if (!ws || !token) return { error: 'missing' };
    const inv = (ws.investors || []).find((i) => {
      const si = signInOf(i);
      return !!si && si.token === String(token);
    });
    if (inv) return expired(signInOf(inv)) && !signInOf(inv).openedAt ? { error: 'gone' } : { inv, si: signInOf(inv) };
    const hash = hashOf(token);
    return (ws.coSignInRetired || []).some((r) => r.hash === hash) ? { error: 'gone' } : { error: 'missing' };
  }
  function bare(inner, t) {
    return `<div class="pt pt-auth ivf">${t ? `<header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span></div></header>` : ''}<main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ivf-msg">${inner}</div></main>${t && NS.portalFooter ? NS.portalFooter() : ''}</div>`;
  }
  const contactOf = (t) => `${h(t.support.team)}${t.support.email ? ` at ${h(t.support.email)}` : ''}${t.support.phone ? ` or ${h(t.support.phone)}` : ''}`;
  NS.views.co = {
    standalone: true,
    edition: 'diy',
    get title() {
      const w = W();
      return w ? `${w.tenant.portalName} · ${w.tenant.shortName}` : 'Sign the subscription agreement';
    },
    render(param) {
      const ws = W();
      const t = ws ? ws.tenant : null;
      const x = resolveSignIn(param);
      if (x.error === 'missing') return bare(`<h1>We could not find this sign-in link</h1><p class="lede">Open the link from your email again${t ? `, or contact ${contactOf(t)}` : ', or contact the firm that sent it'}.</p>`, t);
      if (x.error) return bare(`<h1>This sign-in link no longer works</h1><p class="lede">Contact ${contactOf(t)} for a new link.</p>`, t);
      const task = taskOf(ws, x.inv);
      if (!task.due && !task.signed) return bare(nothingHTML(ws, x.inv, task, t), t);
      return bare('<p class="lede ivf-loading" role="status">Opening your agreement…</p>', t);
    },
    after(param) {
      const x = resolveSignIn(param);
      if (x.error) return;
      // Signed in as the account's co-investor: esign.js shows them only their own places (mySigner with state.co).
      const st = S();
      const was = `${st.role}|${st.viewer}|${!!st.co}`;
      st.role = 'investor';
      NS.store.set('role', 'investor');
      st.viewer = x.inv.id;
      st.co = true;
      if (!x.si.openedAt) {
        x.si.openedAt = new Date().toISOString();
        audit('Co-investor sign-in opened', `${x.inv.title}: ${coOf(x.inv).name}`, x.inv.id);
        NS.app.save(true);
      }
      const task = taskOf(W(), x.inv);
      if (task.due || task.signed) {
        // What waits for their signature first (as the demo bar's co-investor choice), else the account's documents.
        const due = NS.esign ? NS.esign.pendingFor(W(), x.inv.id) : [];
        return NS.app.go(due.length ? 'sign-' + due[0].id : 'documents');
      }
      // Nothing to sign now: the page says so (render). Drawn once more as the co-investor's page when this sign-in changed who
      // is signed in (the preview bar then names them); the second time nothing changes, so it stops there.
      if (was !== `investor|${x.inv.id}|true`) NS.app.render();
    }
  };
  /** What the co-investor has to do on the account's agreements (esign.js coTask); without esign.js, as before: to the account. */
  const taskOf = (ws, inv) => (CS() && CS().coTask ? CS().coTask(ws, inv) : { signed: true });
  /**
   * Walkthrough 3 failure 2: the link of a co-investor with nothing to sign now says so, why, whom to ask, and a way on (the
   * account's Documents), instead of staying on "Opening your agreement…".
   */
  function nothingHTML(ws, inv, task, t) {
    const out = `<p><a class="btn btn-primary" href="#documents">Go to Documents</a></p>`;
    const owner = h(inv.contact || inv.title);
    if (task.before) {
      const who = task.who ? h(task.who.name) : owner;
      return `<h1>Not your turn yet</h1><p class="lede">${h(task.before.title)} is signed in order: ${who} signs first. Once they have, this link opens it for your signature.</p><p>Questions? Contact ${contactOf(t)}.</p>${out}`;
    }
    const offs = placeless(ws, inv);
    const why = offs.length
      ? `${owner}’s subscription agreement${offs.length === 1 ? ` for ${h(offs[0].name)}` : 's'} ${offs.length === 1 ? 'has' : 'have'} no place for a co-investor to sign, so nothing on ${offs.length === 1 ? 'it' : 'them'} is waiting for you.`
      : `No agreement on ${h(inv.title)}’s account is waiting for your signature.`;
    return `<h1>Nothing for you to sign</h1><p class="lede">${why}</p><p>If you expected to sign, contact ${contactOf(t)}.${offs.length ? ' Once a place is added for you, this link opens the agreement.' : ''}</p>${out}`;
  }

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

  NS.coInvestor = { need, needing, noticeText, noticeHTML, statusHTML, recordButton, offeringsOf, signInOf, signInText, showSignIn, openRecord, hooks };
  // Plan 06-39: invitations.js loads first and registers its hooks once this file has made them.
  (NS.coInvestorReady || []).splice(0).forEach((fn) => fn(NS.coInvestor));
})(window.CVPortal);
