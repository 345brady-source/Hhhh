/*
 * Turnkey investor onboarding (DIY edition): the sponsor enters an investor's
 * basic details, the portal emails one link, the link walks the investor
 * through every step (onboarding.js, route #invite-<token>), the sponsor is
 * notified when it is finished and the investor is in the portal.
 *
 * NS.invitations is the shared API: invitation records (ws.invitations), the
 * sponsor's notifications (ws.notifications), sending (the integration
 * server's SMTP settings, or the sponsor's own email app), statuses and, in
 * server mode, importing what the investor's browser sent back to the
 * integration server. The console parts are here too: the invite form and
 * invitations list on the Investors page, the notification bell and page,
 * and the rule that accepts a subscription once its agreement is
 * countersigned and the investor is verified.
 *
 * Local mode (no integration server): the invitation lives in this browser's
 * workspace and its link carries ?tenant=<id>, so it opens here (the demo and
 * the published preview). Server mode: the integration server keeps the
 * invitation, emails the link and serves it to the investor on any device;
 * this browser keeps only its id, link and status.
 *
 * Investors never see this module's console pages. Emails carry only the
 * firm's brand: From name = the firm, Reply-To = its support email.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION || {};
  const U = NS.ui;
  const { h, icon, date } = U;
  const B = NS.brand;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const today = () => NS.dates.today();
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const DAY = 864e5;
  const VALID_DAYS = 30;
  const POLL_MS = 60000;
  const MAX_DOCS = 10 * 1024 * 1024;
  const MAX_NOTIFICATIONS = 200;
  const ENDED = ['completed', 'cancelled', 'expired'];
  const OPEN = ['sent', 'opened', 'in_progress'];
  const isEmail = (s) => /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]{2,}$/.test(String(s || ''));
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const CK = () => NS.consoleKit;
  const IV = () => NS.integrations;
  const audit = (ws, action, detail, fund, record) => NS.audit && NS.audit.log(ws, { action, detail, fund: fund || '', record: record || '' });
  /**
   * A copy of an investor with no verification record, for checks that only read it. A legacy investor (approved before
   * verification was connected, so no inv.verify) keeps their record exactly as it is: earlier versions of integrations.js
   * created a blank record when reading one, which then read as unverified.
   */
  const probe = (inv) => (inv && !inv.verify ? Object.assign({}, inv) : inv);
  /** "finished onboarding", or for an investor already on file invited to another offering, "finished their subscription". */
  const finishedWhat = (it) => (it && it.existing ? 'finished their subscription' : 'finished onboarding');
  /** "started onboarding", or for an investor already on file, "started their subscription". */
  const startedWhat = (it) => (it && it.existing ? 'started their subscription' : 'started onboarding');

  /* ---------- Records ---------- */
  const list = (ws) => (ws.invitations = ws.invitations || []);
  const notes = (ws) => (ws.notifications = ws.notifications || []);
  const offOf = (ws, id) => (id ? ws.offerings.find((o) => o.id === id) || null : null);
  const invOf = (ws, id) => ws.investors.find((i) => i.id === id) || null;
  const openClasses = (o) => ((o && o.classes) || []).filter((c) => !c.subscribedBy || today() <= c.subscribedBy);
  const raising = (ws) => ws.offerings.filter((o) => o.status === 'Raising');
  const curOf = (o) => (NS.structures ? NS.structures.curOf(o) : 'USD');
  function money(o, cents) {
    const cur = curOf(o);
    if (!NS.structures) return U.usdc(cents);
    return cents % 100 ? NS.structures.fmt(cents, cur) : NS.structures.fmtWhole(cents / 100, cur);
  }
  /** The minimum commitment in cents: the offering's, or the share class's when higher. */
  function minimumCents(o, clsId) {
    if (!o) return 0;
    const cls = openClasses(o).find((c) => c.id === clsId);
    return Math.round(Math.max(Number(o.minimum) || 0, (cls && Number(cls.minimum)) || 0) * 100);
  }
  /** 32 random bytes, base64url: a local invitation token. */
  function newToken() {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    let s = '';
    b.forEach((x) => (s += String.fromCharCode(x)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const portalPage = () => `${location.origin}${location.pathname}`;
  function nextInvestorId(ws) {
    const nums = ws.investors.map((i) => Number(String(i.id).split('-').pop()) || 0);
    // Letters and digits only: the id travels in links and to the integration server (a firm named "Harbor & Pine" has the prefix "H&").
    const prefix = String(ws.tenant.idPrefix || '').replace(/[^A-Za-z0-9]/g, '') || 'INV';
    return `${prefix}-${Math.max(1000, ...nums) + 1}`;
  }
  /** Is an integration server set up to send invitations (address and access token)? */
  function serverOn(ws) {
    if (!E.diy || !ws || !IV()) return false;
    const s = IV().ensure(ws).server;
    return !!(IV().serverUrl(ws) && s.token);
  }
  /** The person sending, as the invitation names them. */
  function senderName(ws) {
    const team = ws.team || [];
    const role = S().role;
    const me = team.find((m) => m.current && m.role === role) || team.find((m) => m.role === role && m.status !== 'invited') || null;
    return me ? me.name : ws.tenant.support.team;
  }
  function senderEmail(ws) {
    const team = ws.team || [];
    const role = S().role;
    const me = team.find((m) => m.current && m.role === role) || team.find((m) => m.role === role && m.status !== 'invited') || null;
    return me && isEmail(me.email) ? me.email : isEmail(ws.tenant.support.email) ? ws.tenant.support.email : '';
  }
  const expiredNow = (it) => !!it.expiresAt && Date.parse(it.expiresAt) < Date.now();
  /** Local invitations past their date become expired (the server reports its own). */
  function refresh(ws) {
    let changed = false;
    list(ws).forEach((it) => {
      if (ENDED.indexOf(it.status) < 0 && expiredNow(it)) {
        it.status = 'expired';
        changed = true;
      }
    });
    return changed;
  }
  function linkFor(ws, it) {
    if (it.link) return it.link;
    if (!it.token) return '';
    return `${portalPage()}?tenant=${encodeURIComponent(ws.tenant.id)}#invite-${it.token}`;
  }
  function byToken(ws, token) {
    if (!ws || !token) return null;
    return list(ws).find((x) => x.token && x.token === String(token)) || null;
  }
  const forInvestor = (ws, investorId) => list(ws).filter((x) => x.investorId === investorId).pop() || null;
  const byEmail = (ws, email) => ws.investors.find((i) => String(i.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()) || null;
  const active = (inv) => !!(inv && inv.onboarding && inv.onboarding.status === 'complete');
  /** In the portal for good: an active account, or an invitation already finished. */
  const settled = (ws, inv) => active(inv) || list(ws).some((x) => x.investorId === inv.id && x.status === 'completed');
  /** The end of a sentence after a name that may already end with a period ("Fund II, L.P."). */
  const sentence = (s) => String(s).replace(/\.*$/, '.');

  /**
   * The owner's rule: an investor signs the offering's own subscription agreement (the legal document, uploaded on the
   * offering), never a typed form or a summary. So in the self-serve edition nobody is invited to subscribe to an offering
   * until its agreement is there and ready to sign.
   */
  const needsAgreement = (ws, off) => !!(E.diy && off && NS.esign && NS.esign.templateReady && !NS.esign.templateReady(ws, off.id));
  const agreementMissing = (off) => `${String(off.name || '').replace(/\.$/, '')} has no subscription agreement yet. Add it on the offering first: investors sign the agreement itself during onboarding.`;
  /** Field problems for a new invitation, by field: name, email, offering, amount, cls. */
  function validate(ws, o) {
    const e = {};
    const email = String(o.email || '').trim();
    if (!String(o.name || '').trim()) e.name = 'Enter the investor’s first and last name.';
    else if (o.first !== undefined && !String(o.first || '').trim()) e.name = 'Enter the investor’s first name.';
    else if (o.first !== undefined && !String(o.last || '').trim() && !/\s/.test(String(o.name).trim())) e.name = 'Enter the investor’s last name.';
    const off = offOf(ws, o.offeringId);
    if (!isEmail(email)) e.email = 'Enter a valid email address.';
    else {
      // Someone already in the portal: invite them again (after a cancelled invitation) or to a new offering, never twice at once.
      const have = byEmail(ws, email);
      const open = have && list(ws).find((x) => x.investorId === have.id && ['cancelled', 'completed'].indexOf(x.status) < 0);
      if (open) e.email = `${have.title} is already in the portal with an open invitation. ${open.status === 'expired' || expiredNow(open) ? 'Resend it' : 'Resend it or copy its link'} from the invitations list instead.`;
      else if (have && settled(ws, have) && !o.offeringId) e.email = `${have.title} is already in the portal with an active account. Choose an offering to invite them to subscribe.`;
      else if (have && active(have) && off && (ws.requests || []).some((r) => r.investorId === have.id && r.offeringId === off.id && r.type === 'subscription' && r.status === 'pending')) e.offering = `${have.title} already has a subscription to ${off.name} waiting for review.`;
    }
    if (o.offeringId && (!off || off.status !== 'Raising')) e.offering = 'Choose an offering that is raising.';
    else if (needsAgreement(ws, off)) e.offering = agreementMissing(off);
    const cents = Math.round(Number(o.cents) || 0);
    if (o.cents !== '' && o.cents != null && (!isFinite(Number(o.cents)) || Number(o.cents) < 0)) e.amount = 'Enter the commitment as an amount, or leave it blank.';
    else if (cents > 0 && !off) e.amount = 'Choose the offering this commitment is for.';
    else if (cents > 0 && off && cents < minimumCents(off, o.cls)) {
      const cls = openClasses(off).find((c) => c.id === o.cls);
      e.amount = `The minimum for ${off.name}${cls && Number(cls.minimum) > Number(off.minimum || 0) ? ` (${cls.name})` : ''} is ${money(off, minimumCents(off, o.cls))}.`;
    }
    if (off && o.cls && !openClasses(off).some((c) => c.id === o.cls)) e.cls = 'Choose a share class that is open.';
    return e;
  }

  /** Add the investor and their invitation. Nothing is sent yet (send()). */
  function create(ws, o) {
    const name = String(o.name || '').trim();
    const email = String(o.email || '').trim();
    if (!name) throw new Error('Enter the investor’s full name.');
    if (!isEmail(email)) throw new Error('Enter a valid email address.');
    const off = offOf(ws, o.offeringId);
    if (needsAgreement(ws, off)) throw new Error(agreementMissing(off));
    const classes = openClasses(off);
    const cls = off && classes.some((c) => c.id === o.cls) ? o.cls : off && classes.length === 1 ? classes[0].id : '';
    const type = NS.ENTITY_TYPES[o.type] ? o.type : 'individual';
    const at = nowIso();
    const id = uid('invt');
    const token = serverOn(ws) ? '' : newToken();
    const have = byEmail(ws, email);
    const existing = active(have);
    const investor = have || {
      id: nextInvestorId(ws),
      contact: name,
      title: String(o.account || '').trim() || name,
      type,
      email,
      phone: '',
      address: '',
      tinLast4: '',
      accreditation: { basis: '', date: '' },
      taxForm: '',
      edelivery: false,
      onboarding: { status: 'invited', step: 0, invited: today(), completed: '', source: 'invitation', invitationId: id, offeringId: off ? off.id : '' },
      payment: { method: 'check', bank: null },
      positions: []
    };
    if (have && existing) {
      // An active investor invited to a new offering: their account stays as it is; the link covers the subscription.
      have.onboarding = Object.assign({}, have.onboarding, { invitationId: id, offeringId: off ? off.id : '' });
    } else if (have) {
      // Invited again after an earlier invitation was cancelled: the details the sponsor entered now, and a fresh start.
      Object.assign(have, { contact: name, title: String(o.account || '').trim() || have.title || name, type });
      have.onboarding = Object.assign({}, have.onboarding, { status: 'invited', step: 0, invited: today(), completed: '', source: 'invitation', invitationId: id, offeringId: off ? off.id : '' });
    }
    const invitation = {
      id,
      investorId: investor.id,
      offeringId: off ? off.id : '',
      cents: off ? Math.max(0, Math.round(Number(o.cents) || 0)) : 0,
      cls,
      note: String(o.note || '').trim().slice(0, 2000),
      token,
      serverId: '',
      link: '',
      status: 'sent',
      stepKey: '',
      stepLabel: '',
      stepIndex: 0,
      stepCount: 0,
      sentAt: at,
      openedAt: '',
      completedAt: '',
      expiresAt: new Date(Date.now() + VALID_DAYS * DAY).toISOString(),
      emailStatus: 'not_sent',
      emailError: '',
      importedAt: '',
      sentBy: senderName(ws)
    };
    if (existing) invitation.existing = true;
    // An investor added manually (onboarded offline) who is sent a link to their portal: no offering, nothing to fill in.
    if (existing && o.access && !off) invitation.access = true;
    if (token) invitation.link = linkFor(ws, invitation);
    if (!have) ws.investors.push(investor);
    list(ws).push(invitation);
    audit(ws, invitation.access ? 'Portal link sent to investor' : existing ? 'Investor invited to subscribe' : have ? 'Investor invited again' : 'Investor invited', `${investor.title} (${email})${off ? `: ${off.name}${invitation.cents ? `, ${money(off, invitation.cents)} commitment` : ''}` : invitation.access ? ': added manually, account already set up' : ': account only'}`, off ? off.id : '', investor.id);
    return { invitation, investor };
  }

  /* ---------- Email text (the manual path; the server writes its own) ---------- */
  function emailFor(ws, it) {
    const t = ws.tenant;
    const inv = invOf(ws, it.investorId) || { contact: '', title: '', email: '' };
    const off = offOf(ws, it.offeringId);
    // "Anita Shah" or "Shah, Anita": the given name, without stray punctuation.
    const full = String(inv.contact || '').trim();
    const given = full.indexOf(',') > 0 ? full.split(',').slice(1).join(' ').trim() || full : full;
    const first = given.split(/\s+/)[0].replace(/[^\p{L}\p{M}'’.-]/gu, '') || 'there';
    const cls = off && it.cls ? openClasses(off).concat(off.classes || []).find((c) => c.id === it.cls) : null;
    const subject = off ? `${t.name}: your invitation to invest in ${off.name}` : it.access ? `${t.name}: your investor portal` : `${t.name}: set up your investor account`;
    const link = linkFor(ws, it);
    const by = date(String(it.expiresAt || '').slice(0, 10), 'long');
    const amount = off && it.cents ? `, for a commitment of ${money(off, it.cents)}${cls ? ` in ${cls.name}` : ''}` : '';
    const what = off ? `${it.existing ? 'subscribe to' : 'set up your investor account and your subscription to'} ${off.name}${amount}` : it.access ? 'open your investor portal' : 'set up your investor account';
    const lines = [
      `Dear ${first},`,
      sentence(`${it.sentBy && it.sentBy !== t.support.team ? `${it.sentBy} at ${t.name}` : t.name} has invited you to ${what}`)
    ];
    if (it.note) lines.push(it.note);
    if (it.access) lines.push('Your account is already set up from the documents you completed with us, so there is nothing to fill in. The link below opens your portal.');
    else if (it.existing && off) lines.push('The link below takes you through your subscription in one place: the offering documents, your commitment and the subscription agreement, which you sign online. Your account details are already on file.');
    else
      lines.push(
        `The link below takes you through everything in one place, in about 10 to 15 minutes: your login, investor information, identity verification${off ? ', accreditation' : ''}, tax certification, where to send distributions${off ? ', and your subscription documents, which you sign online' : ''}. Your progress is saved, so you can stop and come back.`,
        'Have a government-issued photo ID and your bank account details ready.'
      );
    const tail = [
      `This link is personal to you; please do not forward it. It expires on ${by}.`,
      `Questions? Contact ${t.support.team}${isEmail(t.support.email) ? ` at ${t.support.email}` : ''}${t.support.phone ? ` or ${t.support.phone}` : ''}.`
    ];
    const text = [lines.join('\n\n'), `Start here: ${link}`, tail.join('\n'), t.legalName || t.name].join('\n\n');
    return { subject, lines, tail, link, text, to: inv.email, toName: inv.contact, fromName: t.name, replyTo: isEmail(t.support.email) ? t.support.email : '', button: off ? (it.existing ? 'Review and subscribe' : 'Start your onboarding') : it.access ? 'Open your portal' : 'Set up your account' };
  }
  /** mailto: with the subject and body; CRLF line breaks (RFC 6068). */
  function mailtoFor(ws, it) {
    const m = emailFor(ws, it);
    return `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text.replace(/\r?\n/g, '\r\n'))}`;
  }

  /* ---------- Notifications ---------- */
  const safeRoute = (r) => (/^console[\w-]*$/.test(String(r || '')) ? String(r) : 'console');
  function notify(ws, kind, title, detail, route) {
    const n = { id: uid('ntf'), at: new Date().toISOString(), kind, title: String(title || ''), detail: String(detail || ''), route: safeRoute(route), read: false };
    const all = notes(ws);
    all.push(n);
    if (all.length > MAX_NOTIFICATIONS) all.splice(0, all.length - MAX_NOTIFICATIONS);
    updateBell();
    return n;
  }
  const unread = (ws) => (ws ? notes(ws).filter((n) => !n.read).length : 0);
  /** The step the investor's device reports when it could not send their signed agreement (onboarding.js reportUnsent). */
  const AGREEMENT_UNSENT = 'agreement-unsent';
  const agreementUnsent = (it) => it.stepKey === AGREEMENT_UNSENT && OPEN.indexOf(it.status) >= 0;
  /**
   * The investor's signed agreement could not be sent from their browser: one unread notice of its own (the progress notice
   * only changes its detail), not repeated while the step stays the same (it.unsentNotified), and again only if it happens
   * again after the investor signs once more. Returns true when the invitation changed.
   */
  function unsentAlert(ws, it) {
    if (it.stepKey !== AGREEMENT_UNSENT) {
      if (!it.unsentNotified) return false;
      delete it.unsentNotified;
      return true;
    }
    if (it.unsentNotified || !agreementUnsent(it)) return false;
    const inv = invOf(ws, it.investorId);
    it.unsentNotified = new Date().toISOString();
    Object.assign(notify(ws, 'invite_progress', `${inv ? inv.title : 'An investor'}'s subscription agreement could not be sent`, 'Contact the investor: their signed agreement could not be sent from their browser.', 'console-investors'), { about: it.id });
    return true;
  }

  /* ---------- Progress and completion (local mode; the investor flow reports here) ---------- */
  function progress(ws, it, stepKey, stepLabel, stepIndex, stepCount) {
    if (!ws || !it) return;
    const first = !it.stepKey;
    Object.assign(it, { stepKey: String(stepKey || ''), stepLabel: String(stepLabel || ''), stepIndex: Number(stepIndex) || 0, stepCount: Number(stepCount) || 0 });
    if (it.status !== 'completed' && it.status !== 'cancelled') it.status = 'in_progress';
    if (!it.openedAt) it.openedAt = new Date().toISOString();
    const inv = invOf(ws, it.investorId);
    const detail = stepText(it);
    // One progress notice per invitation, kept current (unread only when they start).
    const have = notes(ws).find((n) => n.kind === 'invite_progress' && n.invitationId === it.id);
    if (have) Object.assign(have, { detail, at: new Date().toISOString() });
    else if (first) Object.assign(notify(ws, 'invite_progress', `${inv ? inv.title : 'An investor'} ${startedWhat(it)}`, detail, 'console-investors'), { invitationId: it.id });
    unsentAlert(ws, it);
    if (inv && inv.onboarding.status === 'invited') inv.onboarding = Object.assign({}, inv.onboarding, { status: 'in_progress' });
  }
  function requestFor(ws, it) {
    return (ws.requests || []).filter((r) => r.investorId === it.investorId && r.type === 'subscription' && (!it.offeringId || r.offeringId === it.offeringId)).pop() || null;
  }
  const envOf = (ws, r) => (r && r.envelopeId ? (ws.envelopes || []).find((e) => e.id === r.envelopeId) || null : null);
  const waitingCountersign = (env) => !!env && env.status === 'sent' && NS.esign && NS.esign.currentSigners(env).some((s) => s.role === 'countersigner');
  /** Who finished, for what, and where things stand: the completion notice and the list. */
  function outcome(ws, it) {
    const inv = invOf(ws, it.investorId);
    const off = offOf(ws, it.offeringId);
    const r = requestFor(ws, it);
    const env = envOf(ws, r);
    const st = inv && IV() && IV().active(ws) ? IV().status(ws, inv) : null;
    const parts = [];
    // A request this invitation's import dropped comes first: an earlier request for the same offering is not this one.
    if (it.requestDropped) parts.push(`${it.existing ? 'Their' : 'Account activated; their'} subscription${off ? ` to ${off.name}` : ''} from their device was not imported (${it.requestDropped}); ask them to subscribe again`);
    else if (r && off) parts.push(`${money(off, r.cents)} subscription to ${off.name}`);
    else if (off && !it.existing) parts.push(`Account activated; no subscription to ${off.name}${off.status !== 'Raising' ? ', which stopped raising before they reached that step' : ''}`);
    else if (off) parts.push(`No subscription to ${off.name}${off.status !== 'Raising' ? ', which stopped raising before they reached that step' : ''}`);
    else parts.push('Account activated');
    if (st) parts.push(st.key === 'approved' ? 'verified' : st.key === 'review' ? 'verification held for your review' : st.key === 'rejected' ? 'verification not approved' : 'verification in progress');
    if (env) parts.push(env.status === 'completed' ? 'agreement fully signed' : waitingCountersign(env) ? 'agreement signed, waiting for your countersignature' : 'agreement not signed yet');
    return { text: parts.join('; '), route: waitingCountersign(env) ? `console-envelope-${env.id}` : st && st.key === 'review' ? 'console-kyc' : 'console-investors', inv, off, r, env };
  }
  function complete(ws, it) {
    if (!ws || !it || it.status === 'completed') return;
    const wasStep = it.stepCount;
    Object.assign(it, { status: 'completed', completedAt: new Date().toISOString(), stepKey: 'done', stepLabel: 'Done', stepIndex: wasStep || it.stepIndex, stepCount: wasStep || it.stepCount });
    const x = outcome(ws, it);
    notify(ws, 'onboarding_completed', `${x.inv ? x.inv.title : 'An investor'} ${finishedWhat(it)}`, x.text, x.route);
    sweep(ws);
  }

  /* ---------- The integration server ---------- */
  async function api(ws, method, path, body) {
    const s = IV().ensure(ws).server;
    const headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (s.token) headers.Authorization = `Bearer ${s.token}`;
    let res;
    try {
      res = await fetch(IV().serverUrl(ws) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('The integration server could not be reached. Check its address on the Integrations page.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const msg = data && typeof data.error === 'string' ? data.error : data && typeof data.message === 'string' ? data.message : res.status === 401 ? 'The integration server did not accept the access token.' : `The integration server answered ${res.status}.`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function blobB64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function b64Blob(b64, type) {
    const bin = atob(String(b64 || ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: type || 'application/pdf' });
  }
  const getFile = async (id) => {
    try {
      return NS.ops && NS.ops.files && id ? await NS.ops.files.get(id) : null;
    } catch (e) {
      return null;
    }
  };
  /** Everything the investor's browser needs, from this workspace (no secrets: verification settings are names and rules). */
  async function snapshot(ws, it) {
    const t = ws.tenant;
    const inv = invOf(ws, it.investorId);
    const off = offOf(ws, it.offeringId);
    let offering = null;
    let esign = { template: null, pdf: null };
    if (off) {
      const docs = [];
      let total = 0;
      for (const d of (ws.docs || []).filter((x) => x.offeringDoc && !x.hidden && x.offeringId === off.id)) {
        const b = await getFile(d.id);
        if (!b || total + b.size > MAX_DOCS) continue;
        total += b.size;
        docs.push({ id: d.id, title: d.title, fileName: d.fileName, base64: await blobB64(b) });
      }
      offering = {
        id: off.id,
        name: off.name,
        shortName: off.shortName || off.name,
        type: off.type,
        summary: off.summary || '',
        minimum: Number(off.minimum) || 0,
        closeDate: off.closeDate || '',
        terms: (off.terms || []).filter((r) => r.show && r.label).map((r) => ({ label: r.label, value: r.value })),
        exemption: (off.structure || {}).exemption || '',
        classes: openClasses(off).map((c) => ({ id: c.id, name: c.name, minimum: c.minimum, currency: c.currency || '', mgmtFee: c.mgmtFee, carry: c.carry, subscribedBy: c.subscribedBy || '' })),
        currency: curOf(off),
        documents: docs
      };
      const tpl = NS.esign && NS.esign.subscriptionTemplate ? NS.esign.subscriptionTemplate(ws, off.id) : null;
      const ready = tpl && (!NS.esign.templateReady || NS.esign.templateReady(ws, off.id));
      const pdf = ready ? await getFile(tpl.docId) : null;
      if (ready && pdf) esign = { template: { id: tpl.id, title: tpl.title, fileName: tpl.fileName, docId: tpl.docId, message: tpl.message || '', roles: tpl.roles, fields: tpl.fields, pages: tpl.pages, pageSizes: tpl.pageSizes, sha256: tpl.sha256 }, pdf: await blobB64(pdf) };
    }
    const logo = t.logo && t.logo.type === 'image' && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(t.logo.image || '') && t.logo.image.length <= 600 * 1024 ? t.logo.image : '';
    const I = IV();
    const c = I.ensure(ws);
    // Whether this invitation needs VERIFIED accreditation, answered here on the whole workspace: the investor's device holds
    // only the invited offering, so its own reading of the firm's rules ("no offering names an exemption") can misfire.
    // Read only (probe): nothing is written on the investor.
    const accreditationRequired = !!(I && I.needsAccreditation && ((off && I.needsAccreditation(ws, probe(inv), off)) || I.needsAccreditation(ws, probe(inv))));
    return {
      workspace: t.id,
      sendEmail: true,
      portalUrl: portalPage(),
      consoleUrl: `${portalPage()}#console-investors`,
      notifyEmail: senderEmail(ws),
      firm: { name: t.name, shortName: t.shortName, legalName: t.legalName, supportTeam: t.support.team, supportEmail: isEmail(t.support.email) ? t.support.email : '', supportPhone: t.support.phone || '', colors: { primary: t.colors.primary, accent: t.colors.accent }, logo, portalName: t.portalName, disclaimer: t.disclaimer || '', onboarding: clone(t.onboarding || {}) },
      investor: Object.assign({ id: inv.id, contact: inv.contact, title: inv.title, type: inv.type, email: inv.email }, it.existing ? { existing: onFileSummary(ws, inv, it) } : {}),
      offering,
      invitation: Object.assign({ cents: it.cents, cls: it.cls, note: it.note, expiresAt: it.expiresAt, senderName: it.sentBy }, it.existing ? { existing: true } : {}),
      verification: { connections: clone(c.connections), use: clone(c.use), rules: clone(c.rules), accreditationRequired },
      esign
    };
  }

  /**
   * What the investor's device needs about an investor already on file: whether their accreditation is current (and until when)
   * and whether they already hold the offering. No personal details: the account stays in this console.
   */
  function onFileSummary(ws, inv, it) {
    const I = IV();
    const a = (I && I.peek ? I.peek(inv).accreditation : inv.verify && inv.verify.accreditation) || {};
    // The link skips accreditation only for a current verification by a third party: a self-certification is enough for
    // Rule 506(b) only, so where the offering needs verified accreditation the investor is still asked to verify.
    // probe(): reading must not leave a blank verification record on a legacy investor (it would read as unverified).
    const self = I && I.selfCertified ? I.selfCertified(a) : a.connection === 'self' || a.how === 'self' || a.provider === 'self';
    const ok = !!(I && I.accreditationValid && I.accreditationValid(ws, probe(inv))) && !self;
    return { accredited: ok, accreditedUntil: ok && /^\d{4}-\d{2}-\d{2}$/.test(String(a.expiresAt || '')) ? a.expiresAt : '', holds: (inv.positions || []).some((p) => p.offeringId === it.offeringId) };
  }
  /** Send (or hand to the sponsor's email app). Resolves to { emailStatus, error? }. */
  async function send(ws, it) {
    if (!it) return { emailStatus: 'failed', error: 'No invitation.' };
    if (!serverOn(ws)) {
      if (!it.token) {
        it.token = newToken();
        it.link = linkFor(ws, Object.assign({}, it, { link: '' }));
      }
      it.emailStatus = 'manual';
      it.emailError = '';
      NS.app.save(true);
      return { emailStatus: 'manual' };
    }
    const inv = invOf(ws, it.investorId);
    try {
      const snap = await snapshot(ws, it);
      const r = await api(ws, 'POST', '/v1/invitations', snap);
      // The agreement template the investor's device was given (or none): an envelope it sends back is checked against it on
      // import, even after the template is replaced or deleted here (merge).
      const tpl = snap.esign && snap.esign.template;
      Object.assign(it, { serverId: String(r.id || ''), link: String(r.link || ''), token: '', emailStatus: r.emailStatus || 'sent', emailError: r.emailError || '', expiresAt: r.expiresAt || it.expiresAt, sentAt: new Date().toISOString(), esignTemplate: tpl ? { id: tpl.id, roles: (tpl.roles || []).slice(), docId: tpl.docId } : null });
      audit(ws, it.emailStatus === 'sent' ? 'Invitation emailed' : 'Invitation saved on the integration server', `${inv ? inv.title : it.investorId}: ${it.emailStatus === 'sent' ? `link emailed to ${inv ? inv.email : ''}` : it.emailStatus === 'outbox' ? 'kept in the server outbox (no SMTP settings)' : it.emailError || it.emailStatus}`, it.offeringId, it.investorId);
      NS.app.save(true);
      return it.emailError ? { emailStatus: it.emailStatus, error: it.emailError } : { emailStatus: it.emailStatus };
    } catch (e) {
      if (e.status === 404 || e.status === 405) {
        // An integration server from before invitations: the sponsor sends the email from their own app meanwhile.
        if (!it.token) it.token = newToken();
        it.link = linkFor(ws, Object.assign({}, it, { link: '' }));
        it.emailStatus = 'manual';
        it.emailError = 'Your integration server does not send invitations yet. Update it to the latest version; until then, send this email from your email app.';
        NS.app.save(true);
        return { emailStatus: 'manual', error: it.emailError };
      }
      it.emailStatus = 'failed';
      it.emailError = e.message || 'The invitation could not be sent.';
      NS.app.save(true);
      return { emailStatus: 'failed', error: it.emailError };
    }
  }
  /** A new email for an open invitation (and 30 more days). */
  async function resend(ws, it) {
    const inv = invOf(ws, it.investorId);
    if (it.status === 'completed' || it.status === 'cancelled') return { emailStatus: it.emailStatus, error: 'This invitation is closed.' };
    if (serverOn(ws) && it.serverId) {
      try {
        const r = await api(ws, 'POST', `/v1/invitations/${encodeURIComponent(it.serverId)}/resend`, { sendEmail: true, portalUrl: portalPage() });
        Object.assign(it, { link: String(r.link || it.link), emailStatus: r.emailStatus || 'sent', emailError: r.emailError || '', expiresAt: r.expiresAt || it.expiresAt, sentAt: new Date().toISOString(), status: it.stepKey ? 'in_progress' : it.openedAt ? 'opened' : 'sent' });
      } catch (e) {
        it.emailError = e.message;
        NS.app.save(true);
        return { emailStatus: 'failed', error: e.message };
      }
    } else if (serverOn(ws)) {
      return send(ws, it);
    } else {
      // A new link: the one sent before stops working (the investor's progress is kept on their record).
      Object.assign(it, { token: newToken(), link: '', expiresAt: new Date(Date.now() + VALID_DAYS * DAY).toISOString(), status: it.stepKey ? 'in_progress' : it.openedAt ? 'opened' : 'sent', emailStatus: 'manual', emailError: '' });
      it.link = linkFor(ws, it);
    }
    audit(ws, 'Invitation resent', `${inv ? inv.title : it.investorId}: link valid until ${date(String(it.expiresAt).slice(0, 10))}`, it.offeringId, it.investorId);
    NS.app.save(true);
    return { emailStatus: it.emailStatus };
  }
  /** A new invitation for the investor of a cancelled one (same offering and commitment while it is still raising). */
  function reinvite(ws, it) {
    const inv = invOf(ws, it.investorId);
    if (!inv || it.status !== 'cancelled') return null;
    const off = offOf(ws, it.offeringId);
    const o = { name: inv.contact, email: inv.email, type: inv.type, account: inv.title, offeringId: off && off.status === 'Raising' ? off.id : '', cents: off && off.status === 'Raising' ? it.cents : 0, cls: it.cls, note: it.note };
    const e = validate(ws, o);
    if (e.amount || e.cls) Object.assign(o, { cents: 0, cls: '' });
    const again = validate(ws, o);
    if (Object.keys(again).length) throw new Error(again.email || again.name || again.offering || 'This investor cannot be invited again.');
    return create(ws, o);
  }
  async function cancel(ws, it) {
    if (it.status === 'completed') return false;
    if (serverOn(ws) && it.serverId) await api(ws, 'POST', `/v1/invitations/${encodeURIComponent(it.serverId)}/cancel`, {});
    it.status = 'cancelled';
    it.cancelledAt = new Date().toISOString();
    const inv = invOf(ws, it.investorId);
    audit(ws, 'Invitation cancelled', `${inv ? inv.title : it.investorId}: the link no longer works`, it.offeringId, it.investorId);
    NS.app.save(true);
    return true;
  }

  /* ---------- Server mode: statuses and importing finished onboardings ---------- */
  const check = { at: '', error: '', busy: null, subscriptions: 0 };
  /** "2 finished onboardings", "1 finished subscription", or both kinds: what the last import brought (check.subscriptions of n were investors on file). */
  function importedText(n) {
    const subs = Math.min(n, check.subscriptions || 0);
    const what = subs === n ? 'subscription' : subs ? 'invitation' : 'onboarding';
    return `${n} finished ${what}${n === 1 ? '' : 's'}`;
  }
  /** Anything on the server still to hear about (an older integration server without invitations is never asked). */
  const awaiting = (ws) => list(ws).some((x) => x.serverId && (OPEN.indexOf(x.status) >= 0 || (x.status === 'completed' && !x.importedAt)));
  function applyRow(ws, it, row) {
    let changed = false;
    const inv = invOf(ws, it.investorId);
    const set = (k, v) => {
      if (v !== undefined && v !== null && it[k] !== v) {
        it[k] = v;
        changed = true;
      }
    };
    const wasOpened = !!it.openedAt;
    const wasStep = it.stepKey;
    if (it.status !== 'cancelled' && !(it.status === 'completed' && it.importedAt)) set('status', String(row.status || it.status));
    ['stepKey', 'stepLabel', 'openedAt', 'completedAt', 'expiresAt', 'emailStatus', 'emailError'].forEach((k) => typeof row[k] === 'string' && (row[k] || k === 'emailError') && set(k, row[k]));
    ['stepIndex', 'stepCount'].forEach((k) => typeof row[k] === 'number' && set(k, row[k]));
    if (!wasOpened && it.openedAt) notify(ws, 'invite_opened', `${inv ? inv.title : 'An investor'} opened the invitation`, offOf(ws, it.offeringId) ? `Invited to ${offOf(ws, it.offeringId).name}` : 'Account invitation', 'console-investors');
    if (it.stepKey && it.stepKey !== wasStep && it.stepKey !== 'done') {
      const have = notes(ws).find((n) => n.kind === 'invite_progress' && n.invitationId === it.id);
      if (have) Object.assign(have, { detail: stepText(it), at: new Date().toISOString() });
      else Object.assign(notify(ws, 'invite_progress', `${inv ? inv.title : 'An investor'} ${startedWhat(it)}`, stepText(it), 'console-investors'), { invitationId: it.id });
    }
    if (unsentAlert(ws, it)) changed = true;
    if (inv && it.stepKey && inv.onboarding.status === 'invited') inv.onboarding = Object.assign({}, inv.onboarding, { status: 'in_progress' });
    return changed;
  }
  const BAD_KEYS = ['id', 'positions', '__proto__', 'constructor', 'prototype'];
  const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** The firm's accreditation validity in days (integrations.js ruleDays: 30 to 365, 90 when not set). */
  const validDays = (ws) => Math.min(365, Math.max(30, Math.round(Number(IV().ensure(ws).rules.validDays)) || 90));
  /** The firm's re-screening interval in days (integrations.js ruleDays: 1 to 365, 30 when not set). */
  const rescreenDays = (ws) => Math.min(365, Math.max(1, Math.round(Number(IV().ensure(ws).rules.rescreenDays)) || 30));
  /**
   * The next sanctions re-screening a new investor's device reports is no later than the firm's interval allows, counted
   * from the day they were screened (the server sets screenedAt from its own records; never a day after today).
   */
  function capRescreen(ws, aml) {
    if (!aml || typeof aml !== 'object' || !IV()) return;
    const t = today();
    const on = isDay(String(aml.screenedAt || '').slice(0, 10)) && String(aml.screenedAt).slice(0, 10) <= t ? String(aml.screenedAt).slice(0, 10) : t;
    const cap = addDays(on, rescreenDays(ws));
    const given = isDay(String(aml.nextScreen || '').slice(0, 10)) ? String(aml.nextScreen).slice(0, 10) : '';
    if (aml.status === 'clear' || aml.nextScreen) aml.nextScreen = given && given < cap ? given : cap;
  }
  /**
   * A verified accreditation from the investor's device lasts no longer than the firm's rule allows, counted from the day
   * it was verified (never a day after today: the device's dates are not the firm's). The earlier of that limit and the
   * result's own expiry wins, exactly as integrations.js complete() sets a fresh result.
   */
  function capAccreditation(ws, inv, a) {
    if (!a || typeof a !== 'object' || a.status !== 'verified' || !IV()) return;
    const t = today();
    const on = /^\d{4}-\d{2}-\d{2}/.test(String(a.verifiedAt || '')) && String(a.verifiedAt).slice(0, 10) <= t ? String(a.verifiedAt).slice(0, 10) : t;
    const cap = addDays(on, validDays(ws));
    const given = /^\d{4}-\d{2}-\d{2}/.test(String(a.expiresAt || '')) ? String(a.expiresAt).slice(0, 10) : '';
    a.verifiedAt = on;
    a.expiresAt = given && given < cap ? given : cap;
    noteAccreditation(inv, a);
  }
  /** The investor's accreditation summary (portal and audit schedules) carries the dates of the verified result behind it. */
  function noteAccreditation(inv, a) {
    if (inv.accreditation && typeof inv.accreditation === 'object' && inv.accreditation.basis) inv.accreditation = Object.assign({}, inv.accreditation, { date: a.verifiedAt, expires: a.expiresAt });
  }
  /** A verification record with no result in it (every check not started, no decision made): earlier versions left one just by reading. */
  function blankOf(v) {
    const blank = (x) => !x || !x.status || x.status === 'not_started';
    return !!v && typeof v === 'object' && blank(v.identity) && blank(v.aml) && blank(v.accreditation) && (!v.decision || (v.decision.status === 'pending' && !v.decision.at));
  }
  /** No verification record of their own: none, or the blank one an earlier version left (integrations.js recorded()). */
  const unrecorded = (inv) => !inv.verify || typeof inv.verify !== 'object' || blankOf(inv.verify);
  /** Approved before automated verification was connected (integrations.js legacy(): KYC cleared, no record of their own). */
  function legacyOf(inv) {
    const I = IV();
    if (!I || !inv) return false;
    return !!I.legacy(inv) || (unrecorded(inv) && !!inv.kyc && inv.kyc.status === 'cleared');
  }
  /**
   * An investor on file without a record of their own: the record starts from their KYC on file (integrations.js seedFromKyc:
   * identity verified, screening and the decision as the KYC record has them: an approval, a potential match under review, a
   * decline), so a new result is judged against what they hold, never against blank checks.
   */
  function seedOnFile(inv, it) {
    const I = IV();
    if (!unrecorded(inv)) return;
    if (typeof I.seedFromKyc === 'function') {
      I.seedFromKyc(inv);
      return;
    }
    // An integrations.js without seedFromKyc (normally the same release): legacy investors only, as before.
    if (legacyOf(inv)) seedLegacy(inv, it);
  }
  /**
   * A legacy investor's verification record (legacyOf), from what they already hold: identity verified, screening clear,
   * approved. A new result is then judged against it like any approved investor's, never against blank checks.
   * integrations.js's seedFromLegacy(inv) does this when it is there; otherwise it is seeded here the same way.
   */
  function seedLegacy(inv, it) {
    const I = IV();
    // Called only for legacyOf() investors: a record here is the blank one an earlier version left, and it goes first.
    if (inv.verify) delete inv.verify;
    if (typeof I.seedFromLegacy === 'function' && I.seedFromLegacy(inv) && inv.verify) return;
    const k = inv.kyc || {};
    const on = isDay(k.verifiedOn) ? k.verifiedOn : isDay(inv.onboarding && inv.onboarding.completed) ? inv.onboarding.completed : '';
    // The approval predates anything this invitation brought back, so a fresh adverse result still counts against it.
    const at = on ? `${on}T00:00:00Z` : String(it.sentAt || nowIso());
    // Without screenedAt the screening dates already on the KYC record (and its next review) stay as they are.
    inv.verify = {
      identity: Object.assign({ status: 'passed' }, k.method ? { method: k.method } : {}, on ? { completedAt: at } : {}),
      aml: { status: 'clear' },
      accreditation: { status: 'not_started' },
      decision: { status: 'approved', at, by: '', reason: 'verified before automated verification was connected' }
    };
  }
  /**
   * The agreement template this invitation carried to the investor's device: recorded when it was sent (send(); null when it
   * carried none) or, for an invitation sent before that was recorded, the offering's subscription agreement template now.
   */
  function carriedTemplate(ws, it) {
    if (it.esignTemplate === null) return null;
    if (it.esignTemplate && typeof it.esignTemplate === 'object' && it.esignTemplate.id) return it.esignTemplate;
    const t = NS.esign && NS.esign.subscriptionTemplate ? NS.esign.subscriptionTemplate(ws, it.offeringId) : null;
    return t ? { id: t.id, roles: (t.roles || []).slice(), docId: t.docId } : null;
  }
  /**
   * An envelope from the investor's device: new to this console, made from the agreement template this invitation carried
   * (the offering's subscription agreement), and signed as that template says: this investor, plus the firm's countersigner
   * exactly when the template has a role besides the investor's. Anything else is not imported: an envelope naming another
   * investor would appear in their portal, one from another template could leave out the firm's signature, and one pointing
   * at another file here would show that file to this investor. Returns { firm } (the firm countersigns) or null.
   */
  function envelopeCheck(ws, it, inv, env) {
    if (!/^[\w.-]{1,70}$/.test(String(env.id)) || ws.envelopes.some((x) => x.id === env.id)) return null;
    const signers = Array.isArray(env.signers) ? env.signers : [];
    if (!signers.every((s) => s && typeof s === 'object' && (s.investorId ? s.investorId === inv.id && s.role === 'investor' : s.role === 'countersigner'))) return null;
    const counters = signers.filter((s) => s.role === 'countersigner').length;
    if (signers.filter((s) => s.role === 'investor').length !== 1 || counters > 1) return null;
    const tpls = ws.esignTemplates || [];
    const given = carriedTemplate(ws, it);
    let roles = null;
    let docId = null;
    if (it.esignTemplate !== undefined || tpls.some((t) => t.id === env.templateId)) {
      // The template it carried: as recorded when it was sent (here, or deleted since), or else a template still here, which
      // must be the offering's subscription agreement.
      if (!given || String(env.templateId || '') !== given.id) return null;
      const tpl = tpls.find((t) => t.id === given.id);
      roles = tpl ? tpl.roles || [] : Array.isArray(given.roles) ? given.roles : null;
      docId = tpl ? tpl.docId : given.docId || null;
    } else if (!env.templateId) return null;
    else {
      // An invitation sent before the template was recorded, from a template deleted since: the envelope and its copies are
      // kept, as an agreement the firm countersigns (nothing here says it is not). Its original points at that template's file
      // only where another envelope from that template here already does.
      docId = ws.envelopes.some((e) => e.templateId && e.templateId === env.templateId && e.docId === env.docId) ? env.docId : null;
    }
    const firm = !roles || roles.some((r) => !/^investor/i.test(String(r)));
    if (firm !== counters > 0) return null;
    // The original is the template's PDF (esign.js createFromTemplate), never a file the device names.
    env.docId = docId;
    return { firm };
  }
  /** Same bytes: the file is already here from an earlier attempt at this same import (never a different file). */
  async function sameFile(a, b) {
    if (!a || !b || a.size !== b.size) return false;
    const x = new Uint8Array(await a.arrayBuffer());
    const y = new Uint8Array(await b.arrayBuffer());
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  /**
   * Why the investor's subscription request cannot be imported ('' when it can): it is for this invitation's offering, for
   * the commitment the sponsor set on the invitation or, when none was set, a whole number of cents at least the offering's
   * minimum (the share class's when higher), and in a share class that is open on the offering (the one the invitation set,
   * if it set one). The investor's form checks the same, and so does the integration server.
   */
  function requestProblem(ws, it, r, off) {
    if (!/^[\w.-]{1,80}$/.test(String(r.id || ''))) return 'it has no valid reference';
    if (!off) return it.offeringId ? 'the offering is no longer in the portal' : 'the invitation was for an account only';
    if (r.offeringId !== off.id) return 'it is not for the offering on this invitation';
    const cls = r.cls === undefined || r.cls === null || r.cls === '' ? String(it.cls || '') : String(r.cls);
    if (it.cls && cls !== it.cls) return 'its share class is not the one set on the invitation';
    if (cls && !openClasses(off).some((c) => c.id === cls)) return 'its share class is not open on this offering';
    const cents = Number(r.cents);
    if (!Number.isInteger(cents) || cents <= 0 || cents > 1e15) return 'the amount is not valid';
    if (it.cents > 0) return cents === it.cents ? '' : `the amount is not the ${money(off, it.cents)} commitment set on the invitation`;
    const min = minimumCents(off, cls);
    return cents < min ? `the amount is below the ${money(off, min)} minimum` : '';
  }
  /** Merge a finished onboarding sent back by the investor's browser into this workspace. */
  async function merge(ws, it, sub) {
    const src = sub && sub.investor && typeof sub.investor === 'object' ? sub.investor : null;
    if (!src) throw new Error('The submission has no investor record.');
    const I = IV();
    let inv = invOf(ws, it.investorId);
    // An invitation to subscribe sent to an investor on file: their record here is the one that counts, whatever its status now.
    const onFile = !!it.existing && !!inv;
    let taken = false;
    let stamped = false;
    if (!inv) {
      inv = { id: it.investorId, contact: '', title: '', type: 'individual', email: '', onboarding: {}, payment: { method: 'check', bank: null }, positions: [] };
      ws.investors.push(inv);
    }
    // An investor already on file (invited to another offering): their details, bank account, tax form and verification stay as
    // this console holds them. Only what the link collected is taken: an accreditation check and the e-sign consent.
    if (onFile) {
      const acc = src.verify && src.verify.accreditation;
      if (acc && typeof acc === 'object' && !acc.onFile && acc.status && acc.status !== 'not_started' && I) {
        // The new result joins the record on file. Without a record of their own, it starts from their KYC on file (an
        // approval, a potential match under review, a decline): never from blank checks, which read as not started.
        seedOnFile(inv, it);
        I.vOf(inv).accreditation = clone(acc);
        taken = true;
        if (src.accreditation && typeof src.accreditation === 'object' && src.accreditation.basis) inv.accreditation = clone(src.accreditation);
      } else if (inv.verify && unrecorded(inv)) {
        // Nothing new to record: a blank record an earlier version left goes, so they read as their KYC on file again.
        delete inv.verify;
      }
      if (src.esignConsent && typeof src.esignConsent === 'object') inv.esignConsent = clone(src.esignConsent);
      if (!inv.onboarding || typeof inv.onboarding !== 'object') inv.onboarding = {};
    } else {
      Object.keys(src).forEach((k) => {
        if (BAD_KEYS.indexOf(k) < 0) inv[k] = clone(src[k]);
      });
      inv.onboarding = Object.assign({}, inv.onboarding, { source: 'invitation', invitationId: it.id, offeringId: it.offeringId });
      // A new investor has no KYC from before automated verification: only a verification record says where they stand. One
      // the device sent without a result gets a dated pending decision, so their KYC record alone never reads as approved
      // (integrations.js reads an investor without a record of their own from their KYC on file).
      if (I && unrecorded(inv)) {
        inv.verify = { identity: { status: 'not_started' }, aml: { status: 'not_started' }, accreditation: { status: 'not_started' }, decision: { status: 'pending', at: nowIso() } };
        stamped = true;
      }
    }
    delete inv.onboarding.flow;
    if (!Array.isArray(inv.positions)) inv.positions = [];
    // Checks this import keeps from the device: every check for a new investor, only a new accreditation for one on file.
    const keptKinds = onFile ? (taken ? ['accreditation'] : []) : ['identity', 'accreditation'];
    if (inv.verify && typeof inv.verify === 'object' && keptKinds.indexOf('accreditation') >= 0) capAccreditation(ws, inv, inv.verify.accreditation);
    // A new investor's screening comes from the device too: its re-screening date follows the firm's interval.
    if (!onFile && inv.verify && typeof inv.verify === 'object') {
      capRescreen(ws, inv.verify.aml);
      const next = inv.verify.aml && inv.verify.aml.nextScreen;
      if (next && inv.kyc && typeof inv.kyc === 'object' && (!inv.kyc.nextReview || String(inv.kyc.nextReview) > next)) inv.kyc.nextReview = next;
    }
    // Their evidence (an ID or a verification letter) may only be this investor's own upload: integrations.js names uploads
    // kyc-<investor id>-<time>. A record pointing at any other file here loses the pointer, so it never shows that file.
    const evidence = [];
    const kycName = new RegExp(`^kyc-${reEsc(inv.id)}-[a-z0-9]+$`);
    keptKinds.forEach((k) => {
      const x = inv.verify && inv.verify[k];
      if (!x || typeof x !== 'object' || !x.fileId) return;
      if (kycName.test(String(x.fileId))) evidence.push(String(x.fileId));
      else delete x.fileId;
    });

    // The investor's request always arrives pending: only the firm accepts it, for the offering this invitation is for, and only
    // for an amount and share class that offering takes (requestProblem). A request that does not pass is not imported (the
    // agreement signed for it is kept only as a voided record), and the change log and the import notification say why.
    const r = sub.request && typeof sub.request === 'object' ? clone(sub.request) : null;
    ws.requests = ws.requests || [];
    const off = offOf(ws, it.offeringId);
    // A request already here is this same import tried before (it stopped after storing the request): not added twice.
    const again = !!(r && r.id && ws.requests.some((x) => x.id === r.id));
    const dropped = r && !again ? requestProblem(ws, it, r, off) : '';
    const rIn = r && !again && !dropped ? r : null;
    if (rIn) {
      const cls = rIn.cls === undefined || rIn.cls === null || rIn.cls === '' ? String(it.cls || '') : String(rIn.cls);
      // Whether they already hold this offering is this console's to say: the device's copy of the record has no positions.
      Object.assign(rIn, { type: 'subscription', investorId: inv.id, offeringId: off.id, status: 'pending', cents: Number(rIn.cents), additional: inv.positions.some((p) => p.offeringId === off.id) });
      if (cls) rIn.cls = cls;
      else delete rIn.cls;
      ['decided', 'note', 'completed', 'paid', 'paidCents', 'waitingFor'].forEach((k) => delete rIn[k]);
    }
    if (dropped) it.requestDropped = dropped;
    else delete it.requestDropped;
    const env = sub.envelope && typeof sub.envelope === 'object' && sub.envelope.id ? clone(sub.envelope) : null;
    ws.envelopes = ws.envelopes || [];
    // The agreement signed for a request that is not imported is kept as a record, voided (below): nobody is asked to sign it.
    const tied = !!(dropped && env && r.envelopeId === env.id);
    const chk = env ? envelopeCheck(ws, it, inv, env) : null;
    const envIn = chk ? env : null;
    if (envIn) {
      if (it.offeringId) envIn.offeringId = it.offeringId;
      // Only the firm countersigns, as the firm (esign.js names its support team): a countersignature never arrives from the
      // investor's device, and the countersigner is never someone the device named.
      let forged = false;
      envIn.signers.forEach((s) => {
        if (s.role !== 'countersigner') return;
        Object.assign(s, { name: ws.tenant.support.team, email: ws.tenant.support.email, account: '' });
        if (s.status === 'signed') {
          Object.assign(s, { status: 'waiting', signedAt: null, signature: null, initials: null });
          forged = true;
        }
      });
      // An agreement the firm countersigns is never complete before the firm signs; one for the investor alone can arrive
      // complete, with the signed copy it produced (checked once the files are stored).
      if (forged || (envIn.status === 'completed' && chk.firm)) Object.assign(envIn, { status: 'sent', completedAt: null });
      if (tied) {
        const why = `the subscription could not be accepted as submitted (${dropped}). Contact ${ws.tenant.support.team} to subscribe again.`;
        Object.assign(envIn, { status: 'voided', completedAt: null, voidedAt: nowIso(), voidReason: why });
        envIn.events = (Array.isArray(envIn.events) ? envIn.events : []).concat([{ at: nowIso(), actor: 'Portal (automatic)', action: 'Voided', detail: why }]);
      }
      // The envelope's copies keep esign.js's names: <envelope id>-work after a signature, <envelope id>-signed once everyone
      // has signed. Any other id would point at a file this envelope did not produce.
      if (envIn.workDocId !== `${envIn.id}-work`) envIn.workDocId = null;
      if (envIn.status !== 'completed' || envIn.signedDocId !== `${envIn.id}-signed`) Object.assign(envIn, { signedDocId: null, sha256Signed: null });
    }
    // Files: only what this submission produced, and never over a file already stored here (whatever workspace stored it):
    // the copies of its envelope and the evidence above. Anything else it sends (the agreement template, another envelope's
    // copies, documents of its own) is not imported.
    const files = sub.files && typeof sub.files === 'object' ? sub.files : {};
    const sent = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(files, id) && typeof files[id] === 'string';
    const allowed = evidence.slice();
    if (envIn) [envIn.workDocId, envIn.signedDocId].forEach((x) => x && allowed.push(x));
    const kept = {}; // id -> size, for each file this submission brought that is now stored here
    for (const id of allowed) {
      if (kept[id] !== undefined || !sent(id) || !/^[\w.-]{1,120}$/.test(id)) continue;
      try {
        const type = /^iVBORw0KGgo/.test(files[id]) ? 'image/png' : /^\/9j\//.test(files[id]) ? 'image/jpeg' : 'application/pdf';
        const blob = b64Blob(files[id], type);
        const have = await getFile(id);
        if (have) {
          if (await sameFile(have, blob)) kept[id] = blob.size;
          continue;
        }
        if (NS.ops && NS.ops.files) {
          await NS.ops.files.put(id, blob);
          kept[id] = blob.size;
        }
      } catch (e) {
        /* a file that cannot be stored is listed as missing where it is used */
      }
    }
    // Evidence for a new result is a new upload: a pointer to an earlier file already stored here (an old letter, say) goes.
    for (const k of keptKinds) {
      const x = inv.verify && inv.verify[k];
      if (x && typeof x === 'object' && x.fileId && kept[x.fileId] === undefined && (await getFile(x.fileId))) delete x.fileId;
    }
    if (envIn) {
      // Complete only with the signed copy this submission brought.
      if (envIn.status === 'completed' && kept[envIn.signedDocId] === undefined) Object.assign(envIn, { status: 'sent', completedAt: null, signedDocId: null, sha256Signed: null });
      // A work copy that did not come with this submission must not be some other file already stored under that id.
      if (envIn.workDocId && kept[envIn.workDocId] === undefined && (await getFile(envIn.workDocId))) envIn.workDocId = null;
      // A completed envelope arrives with its signed copy only (the device does not send the work copy then): no dangling pointer.
      if (envIn.status === 'completed' && envIn.workDocId && kept[envIn.workDocId] === undefined) envIn.workDocId = null;
      envIn.requestId = rIn && rIn.envelopeId === envIn.id ? rIn.id : null;
      ws.envelopes.push(envIn);
    }
    if (rIn) {
      // Signed through the envelope that came with it, or not through an envelope at all: never through another envelope here
      // (automatic acceptance would otherwise take someone else's, or an earlier, signed agreement for this subscription).
      if (rIn.envelopeId && (!envIn || rIn.envelopeId !== envIn.id)) delete rIn.envelopeId;
      ws.requests.push(rIn);
    }
    if (dropped) audit(ws, 'Subscription not imported', `${inv.title || inv.id}: the subscription request from the investor's device was not added to the portal: ${dropped}${tied && envIn ? '; the agreement signed for it is kept, voided' : ''}. Ask them to subscribe again.`, it.offeringId, inv.id);
    // The one document listing the device may add: the investor's signed copy of the agreement, which esign.js publishes when
    // everyone has signed. Built here from the envelope, for this investor alone.
    ws.docs = ws.docs || [];
    const signedId = envIn && envIn.status === 'completed' ? envIn.signedDocId : '';
    const d = signedId && (Array.isArray(sub.docs) ? sub.docs : []).find((x) => x && typeof x === 'object' && x.id === signedId);
    if (d && !ws.docs.some((x) => x.id === signedId)) {
      ws.docs.push({ id: signedId, title: String(d.title || envIn.title || 'Subscription agreement').slice(0, 200), fileName: String(d.fileName || 'Subscription_agreement_signed.pdf').slice(0, 160), type: 'application/pdf', size: kept[signedId], sha256: String(envIn.sha256Signed || ''), cat: 'Legal', offeringId: envIn.offeringId || it.offeringId || null, audience: 'investors', investors: [inv.id], date: isDay(d.date) && d.date <= today() ? d.date : today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'E-sign', envelopeId: envIn.id });
    }
    // The device's own change-log entries: always this investor's, dated between the invitation's sending and now, for this
    // offering and this investor, and marked as coming from their device (never a member of staff, never backdated).
    const from = Date.parse(it.sentAt || '');
    const until = Date.now();
    (Array.isArray(sub.audit) ? sub.audit : []).slice(0, 500).forEach((a) => {
      if (!a || typeof a !== 'object' || !a.action) return;
      const t = Date.parse(a.at || '');
      const at = Math.min(until, Math.max(isFinite(from) ? from : until, isFinite(t) ? t : until));
      NS.audit.log(ws, { at: new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z'), actor: `${inv.title || inv.contact || inv.id} (investor)`, action: String(a.action).slice(0, 200), detail: `${a.detail ? String(a.detail).slice(0, 2000) + ' ' : ''}(from the investor's device)`, fund: it.offeringId || '', record: inv.id });
    });
    (Array.isArray(sub.notifications) ? sub.notifications : []).forEach((n) => {
      if (n && n.title) notes(ws).push({ id: uid('ntf'), at: n.at || new Date().toISOString(), kind: n.kind || 'invite_progress', title: String(n.title), detail: String(n.detail || ''), route: safeRoute(n.route), read: false });
    });
    Object.assign(it, { status: 'completed', completedAt: sub.completedAt || it.completedAt || new Date().toISOString(), stepKey: 'done', stepLabel: 'Done', stepIndex: it.stepCount || it.stepIndex });
    await reconfirm(ws, inv, it);
    // An investor on file is decided again only when the link brought a new result; otherwise their record is as it was.
    if (onFile && taken && I && I.active(ws) && inv.verify) {
      I.decide(ws, inv);
      I.syncKyc(ws, inv);
    }
    // A new investor whose device sent no result: their KYC record says so too.
    if (stamped && I.active(ws)) I.syncKyc(ws, inv);
  }
  /**
   * The integration server holds for review any result from the investor's browser that it has no record of.
   * Some results never have one, and the console applies its own rules to them, exactly as it would in this browser:
   *   self-certified accreditation  the investor's attestation is the record; accepted where the firm's rules accept it
   *   sandbox checks                 simulated wherever they run; accepted while the sandbox is on for that check
   *   screening                      the console screens the investor again with its own connections
   * Anything else (a provider check without a record) stays held for a person to review.
   */
  async function reconfirm(ws, inv, it) {
    const I = IV();
    if (!E.diy || !I || !I.active(ws) || !inv.verify) return;
    const c = I.ensure(ws);
    const v = I.vOf(inv);
    const done = [];
    const a = v.accreditation;
    if (a.connection === 'self' && a.status === 'review' && a.reportedStatus === 'verified' && c.use.accreditation.indexOf('self') >= 0 && !I.needsAccreditation(ws, inv)) {
      // Twelve months from the day they certified, as integrations.js finishOnboarding() records it; never from a day after
      // today (the device's dates are not the firm's).
      const on = isDay(a.verifiedAt) && a.verifiedAt <= today() ? a.verifiedAt : today();
      Object.assign(a, { status: 'verified', verifiedAt: on, expiresAt: NS.dates.addMonths(on, 12) });
      delete a.reportedStatus;
      delete a.note;
      done.push('self-certified accreditation accepted (no third-party verification is required for this offering)');
    }
    if (a.status === 'review' && a.reportedStatus === 'verified' && (a.how === 'sandbox' || a.connection === 'sandbox') && c.use.accreditation.indexOf('sandbox') >= 0) {
      // Valid for the firm's rule from today, as integrations.js complete() records a sandbox result in this browser.
      const on = today();
      Object.assign(a, { status: 'verified', verifiedAt: on, expiresAt: addDays(on, validDays(ws)) });
      delete a.reportedStatus;
      delete a.note;
      noteAccreditation(inv, a);
      done.push('sandbox accreditation check accepted (simulated)');
    }
    const id = v.identity;
    if (id.status === 'review' && id.reportedStatus === 'passed' && (id.how === 'sandbox' || id.connection === 'sandbox') && c.use.identity.indexOf('sandbox') >= 0) {
      id.status = 'passed';
      delete id.reportedStatus;
      delete id.note;
      done.push('sandbox identity check accepted (simulated)');
    }
    const results = v.aml.results || [];
    const unconfirmed = results.some((r) => /not confirmed by the integration server/i.test(r.error || '')) || (v.aml.status === 'pending' && !results.length);
    if (unconfirmed && id.status === 'passed') {
      try {
        await I.screen(ws, inv);
        done.push('screened again from the console');
      } catch (e) {
        done.push(`screening again failed (${e.message}); run it from the AML/KYC page`);
      }
    }
    if (!done.length) return;
    // The server's hold was only for want of a record: decide again on the results now on file (a person's or the rules' other holds stand).
    if (v.decision.status === 'review' && /could not all be confirmed/i.test(v.decision.reason || '')) v.decision = { status: 'pending' };
    I.decide(ws, inv);
    I.syncKyc(ws, inv);
    audit(ws, 'Verification results confirmed', `${inv.title}: ${done.join('; ')}; verification ${I.status(ws, inv).label.toLowerCase()}`, it.offeringId, inv.id);
  }
  /** Poll the integration server: update statuses, import each finished onboarding, then delete it there. Resolves to the number imported. */
  function importCompleted(ws) {
    if (!serverOn(ws)) return Promise.resolve(0);
    if (check.busy) return check.busy;
    check.busy = (async () => {
      let n = 0;
      let changed = false;
      check.subscriptions = 0;
      try {
        const rows = await api(ws, 'GET', `/v1/invitations?workspace=${encodeURIComponent(ws.tenant.id)}`);
        const all = Array.isArray(rows) ? rows : rows && Array.isArray(rows.invitations) ? rows.invitations : [];
        for (const row of all) {
          const it = list(ws).find((x) => x.serverId && x.serverId === row.id);
          if (!it) continue;
          if (applyRow(ws, it, row)) changed = true;
          if (!row.hasSubmission) continue;
          const path = `/v1/invitations/${encodeURIComponent(row.id)}/submission`;
          if (!it.importedAt) {
            const sub = await api(ws, 'GET', path);
            await merge(ws, it, sub);
            it.importedAt = new Date().toISOString();
            const x = outcome(ws, it);
            // An investor already on file finished a subscription only: their account stays as this console holds it.
            if (it.existing) audit(ws, 'Subscription imported', `${x.inv ? x.inv.title : it.investorId}: the subscription from the investor's device added to the portal (${x.text}); the copy on the integration server is deleted`, it.offeringId, it.investorId);
            else audit(ws, 'Onboarding imported', `${x.inv ? x.inv.title : it.investorId}: records from the investor's device added to the portal (${x.text}); the copy on the integration server is deleted`, it.offeringId, it.investorId);
            notify(ws, 'onboarding_completed', `${x.inv ? x.inv.title : 'An investor'} ${finishedWhat(it)}`, x.text, x.route);
            n++;
            if (it.existing) check.subscriptions++;
            changed = true;
            NS.app.save(true);
          }
          await api(ws, 'DELETE', path);
        }
        check.error = '';
      } catch (e) {
        check.error = e.message || 'The integration server could not be reached.';
      }
      check.at = new Date().toISOString();
      if (sweep(ws)) changed = true;
      if (changed) NS.app.save(true);
      return n;
    })().finally(() => {
      check.busy = null;
    });
    return check.busy;
  }

  /* ---------- Accepting subscriptions once countersigned and verified ---------- */
  const rules = (ws) => (ws.invitationRules = Object.assign({ autoAccept: true }, ws.invitationRules || {}));
  /** Apply the rule to every pending subscription with a completed agreement. Returns true when something changed; sweep.accepted counts acceptances. */
  function sweep(ws) {
    sweep.accepted = 0;
    if (!E.diy || !ws || !NS.ops || !IV() || !IV().active(ws) || !rules(ws).autoAccept) return false;
    let changed = false;
    (ws.requests || []).forEach((r) => {
      if (r.type !== 'subscription' || r.status !== 'pending' || !r.envelopeId) return;
      const env = envOf(ws, r);
      if (!env || env.status !== 'completed') return;
      const inv = invOf(ws, r.investorId);
      const o = offOf(ws, r.offeringId);
      if (!inv || !o) return;
      // probe(): checking the gate must not leave a blank verification record on a legacy investor (it would hold them for good).
      const gate = IV().subscribeGate(ws, probe(inv), o);
      const st = IV().status(ws, inv);
      if (gate || st.key !== 'approved') {
        if (!r.waitingFor) {
          // An approved investor held at the gate is waiting on their accreditation (one to start, or one submitted and under
          // review): integrations.js subscribeGate asks about the decision first.
          r.waitingFor = st.key === 'review' ? 'verification held for review' : st.key === 'rejected' ? 'verification not approved' : st.key === 'approved' && gate ? 'accreditation verification' : 'verification';
          audit(ws, 'Automatic acceptance waiting', `${inv.title}: agreement countersigned; the subscription is accepted automatically once ${r.waitingFor === 'verification' ? 'verification is approved' : `the ${r.waitingFor} is resolved`}`, o.id, r.id);
          changed = true;
        }
        return;
      }
      if (!NS.ops.decide(ws, r, true, 'Accepted automatically: agreement countersigned and investor verified')) return;
      delete r.waitingFor;
      if (!NS.ops.isOpen(o)) NS.ops.markFunded(ws, r);
      audit(ws, 'Subscription accepted automatically', `${inv.title}: ${money(o, r.cents)} ${NS.ops.isOpen(o) ? 'subscription approved; record the funding when the wire arrives' : 'commitment added to the investor register'}`, o.id, r.id);
      sweep.accepted++;
      notify(ws, 'subscription_accepted', `${inv.title}'s subscription was accepted`, `${money(o, r.cents)} in ${o.name}${NS.ops.isOpen(o) ? '; record the funding when the wire arrives' : '; the commitment is on the investor register'}`, 'console-requests');
      changed = true;
    });
    return changed;
  }
  function sweepAndShow() {
    const ws = W();
    if (!ws || S().role === 'investor' || S().remote) return;
    if (sweep(ws)) {
      const n = sweep.accepted;
      NS.app.save(true);
      if (NS.app.modeOf(S().route) === 'console') NS.app.render();
      if (n) U.toast(`${n === 1 ? 'Subscription' : `${n} subscriptions`} accepted automatically: the agreement is countersigned and the investor is verified.`);
      else U.toast('Agreement countersigned. The subscription is accepted automatically once the investor’s verification is approved.');
    }
  }

  /* ---------- Status words ---------- */
  const STATUS = { sent: ['mute', 'Sent'], opened: ['adj', 'Opened'], in_progress: ['adj', 'In progress'], completed: ['ok', 'Completed'], cancelled: ['mute', 'Cancelled'], expired: ['bad', 'Expired'] };
  /** Status as the list shows it: an invitation the sponsor has not emailed yet says so. */
  const unsent = (it) => it.status === 'sent' && ['manual', 'not_sent', 'failed'].indexOf(it.emailStatus) >= 0;
  const statusOf = (it) => (unsent(it) ? ['warn', 'Not sent yet'] : agreementUnsent(it) ? ['warn', 'Agreement not sent'] : STATUS[it.status] || ['mute', it.status]);
  const EMAIL = { sent: 'Emailed', outbox: 'In the server outbox', manual: 'Send from your email app', not_sent: 'Not sent yet', failed: 'Could not send' };
  function stepText(it) {
    if (it.status === 'completed') return 'Finished';
    if (it.stepIndex && it.stepCount) return `Step ${it.stepIndex} of ${it.stepCount}: ${it.stepLabel || it.stepKey}`;
    return it.status === 'opened' ? 'Opened, not started' : it.status === 'sent' ? (unsent(it) ? (it.emailStatus === 'failed' ? 'The email could not be sent' : 'Send the email to start') : 'Not opened yet') : '';
  }
  const badge = (cls, text) => `<span class="cs-badge cs-badge-${cls}">${h(text)}</span>`;
  const when = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  function ago(iso) {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (!isFinite(s)) return '';
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return when(iso);
  }
  /** The Investors page's activation column for an invited investor. */
  function activationLabel(ws, inv) {
    if (!E.diy || !inv || inv.onboarding.status === 'complete') return '';
    const it = forInvestor(ws, inv.id);
    if (!it) return '';
    if (it.status === 'in_progress' && it.stepCount) return agreementUnsent(it) ? `<span class="cs-error-text">${h(stepText(it))}</span>` : h(stepText(it));
    if (unsent(it)) return it.emailStatus === 'failed' ? 'Invitation not sent: the email failed' : 'Invitation ready to send from your email app';
    return `${h(STATUS[it.status] ? STATUS[it.status][1] : it.status)}${it.status === 'sent' ? ` ${date(String(it.sentAt).slice(0, 10))}` : ''}`;
  }

  /* ---------- Console: invite form ---------- */
  function draft() {
    const u = S().ui;
    if (!u.inv8) {
      const r = raising(W());
      u.inv8 = { first: '', last: '', name: '', email: '', type: 'individual', account: '', offeringId: r.length === 1 ? r[0].id : '', amount: '', cls: '', note: '', errors: {}, busy: false };
    }
    return u.inv8;
  }
  /** The invite form's optional fields, kept under More options. */
  const MORE_FIELDS = ['type', 'account', 'offeringId', 'amount', 'cls', 'note'];
  NS.actions['inv8-no-offering'] = () => {
    const d = draft();
    Object.assign(d, { offeringId: '', amount: '', cls: '', more: true });
    delete d.errors.offering;
    NS.app.render();
  };
  NS.binders.inv8 = (path, v) => {
    const d = draft();
    d[path] = v;
    if (MORE_FIELDS.indexOf(path) >= 0) d.more = true;
    // First and last name make up the investor's name (one string everywhere else).
    if (path === 'first' || path === 'last') d.name = [d.first, d.last].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
    const k = path === 'offeringId' ? 'offering' : path === 'first' || path === 'last' ? 'name' : path;
    if (d.errors[k]) delete d.errors[k];
    if (path === 'offeringId') {
      d.cls = '';
      NS.app.render();
    }
  };
  const fieldErr = (d, k) => (d.errors[k] ? `<span class="cs-error" id="iv-err-${k}">${h(d.errors[k])}</span>` : '');
  const inval = (d, k) => (d.errors[k] ? ` aria-invalid="true" aria-describedby="iv-err-${k}"` : '');
  function invitePanel() {
    const w = W();
    const d = draft();
    const tab = S().ui.inviteTab || 'single';
    const offs = raising(w);
    const off = offOf(w, d.offeringId);
    const classes = openClasses(off);
    const min = off ? minimumCents(off, d.cls || (classes[0] || {}).id) : 0;
    const cur = off ? curOf(off) : 'USD';
    // Only the name and email are asked for; everything else is optional and stays folded away until it is used or has a problem.
    const dflt = offs.length === 1 ? offs[0].id : '';
    const moreOpen = !!(d.more || d.errors.offering || d.errors.amount || d.errors.cls || /Choose an offering/.test(d.errors.email || '') || d.type !== 'individual' || d.account || d.amount !== '' || d.cls || d.note || (d.offeringId || '') !== dflt);
    const agreement = off && NS.esign && NS.esign.templateReady ? (NS.esign.templateReady(w, off.id) ? 'ready' : 'missing') : '';
    const what = off
      ? agreement === 'missing'
        ? ''
        : `They will be invited to ${h(off.name.replace(/\.$/, ''))}${agreement === 'ready' ? ' and sign its subscription agreement during onboarding' : ''} (change under More options).`
      : offs.length
        ? 'No offering is chosen, so they set up their account only (choose one under More options).'
        : 'They can subscribe once you add an offering.';
    const single = `<form class="cs-form cs-grid inv8-form" data-form="invite-one" novalidate>
      <label class="cs-field" for="iv-contact"><span>First name</span><input id="iv-contact" name="contact" maxlength="60" autocomplete="off" data-bind="inv8:first" value="${h(d.first || '')}"${inval(d, 'name')}></label>
      <label class="cs-field" for="iv-last"><span>Last name</span><input id="iv-last" name="last" maxlength="60" autocomplete="off" data-bind="inv8:last" value="${h(d.last || '')}"${inval(d, 'name')}>${fieldErr(d, 'name')}</label>
      <label class="cs-field cs-wide" for="iv-email"><span>Email</span><input id="iv-email" name="email" type="email" maxlength="120" autocomplete="off" data-bind="inv8:email" value="${h(d.email)}"${inval(d, 'email')}>${fieldErr(d, 'email')}</label>
      <p class="cs-hint cs-wide inv8-what" id="iv-what">They choose how they invest during onboarding. ${what}</p>
      ${agreement === 'missing' ? `<div class="cs-wide inv8-block" id="iv-agreement-warn" role="status"><p><strong>Add the subscription agreement for ${h(off.name.replace(/\.$/, ''))} before you invite investors to it.</strong> Investors sign the agreement itself during onboarding, so it has to be on the offering first. Upload the PDF once and the signing fields are placed for you.</p><div class="cs-row">${NS.app.can('configure') ? `<button class="cs-btn cs-btn-primary" type="button" data-action="es-agreement-new" data-offering="${h(off.id)}">Add the subscription agreement</button>` : '<span class="cs-hint">Ask an admin to add it on the offering.</span>'}<button class="cs-btn" type="button" data-action="inv8-no-offering">Invite without an offering</button></div></div>` : ''}
      <details class="cs-wide inv8-more" id="iv-more"${moreOpen ? ' open' : ''}>
        <summary>More options (optional)</summary>
        <div class="cs-grid inv8-more-body">
          <label class="cs-field" for="iv-type"><span>Investing as <em>Optional</em></span><select id="iv-type" name="type" data-bind="inv8:type">${Object.keys(NS.ENTITY_TYPES).map((k) => `<option value="${k}"${d.type === k ? ' selected' : ''}>${h(NS.ENTITY_TYPES[k].label)}</option>`).join('')}</select><span class="cs-hint">The investor confirms or changes this during onboarding.</span></label>
          <label class="cs-field" for="iv-title"><span>Account name <em>Optional</em></span><input id="iv-title" name="title" maxlength="120" autocomplete="off" placeholder="Defaults to the full name" data-bind="inv8:account" value="${h(d.account)}"><span class="cs-hint">For a trust, company or IRA, its legal name. The investor can correct it.</span></label>
          <label class="cs-field" for="iv-off"><span>Offering <em>Optional</em></span><select id="iv-off" name="offering" data-bind="inv8:offeringId"${inval(d, 'offering')}><option value=""${!off ? ' selected' : ''}>No offering: account only</option>${offs.map((o) => `<option value="${h(o.id)}"${off && off.id === o.id ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select>${offs.length ? '' : '<span class="cs-hint">No offering is raising. The investor sets up their account and can subscribe later.</span>'}${fieldErr(d, 'offering')}</label>
          <label class="cs-field" for="iv-amt"><span>Commitment (${cur === 'USD' ? '$' : h(cur)}) <em>Optional</em></span><input id="iv-amt" name="amount" type="number" min="0" step="1000" inputmode="decimal" data-bind="inv8:amount" value="${h(d.amount)}"${off ? '' : ' disabled'}${inval(d, 'amount')}><span class="cs-hint">${off ? `Minimum ${h(money(off, min))}. Leave blank for the investor to choose; if you set it, they cannot change it.` : 'Choose an offering to set a commitment.'}</span>${fieldErr(d, 'amount')}</label>
          ${classes.length > 1 ? `<label class="cs-field" for="iv-cls"><span>Share class</span><select id="iv-cls" name="cls" data-bind="inv8:cls"${inval(d, 'cls')}><option value="">Investor chooses</option>${classes.map((c) => `<option value="${h(c.id)}"${d.cls === c.id ? ' selected' : ''}>${h(c.name)}${Number(c.minimum) ? `, minimum ${h(money(off, Math.round(Number(c.minimum) * 100)))}` : ''}</option>`).join('')}</select>${fieldErr(d, 'cls')}</label>` : ''}
          <label class="cs-field cs-wide" for="iv-note"><span>Personal note <em>Optional</em></span><textarea id="iv-note" name="note" rows="3" maxlength="2000" data-bind="inv8:note">${h(d.note)}</textarea><span class="cs-hint">Shown in the email and on the investor’s welcome page.</span></label>
        </div>
      </details>
      <p class="cs-error cs-wide" id="iv-error" role="alert"${Object.keys(d.errors).length ? '' : ' hidden'}>${Object.keys(d.errors).length ? 'Check the highlighted fields.' : ''}</p>
      <div class="cs-row cs-wide"><button class="cs-btn cs-btn-primary" type="submit"${d.busy ? ' disabled aria-busy="true"' : ''}>${d.busy ? 'Sending…' : 'Send invitation'}</button></div>
    </form>`;
    const ui = S().ui;
    const eg = h(offs[0] ? offs[0].shortName || offs[0].name : 'Fund I');
    const bulk = `<form class="cs-form" data-form="invite-bulk" novalidate>
      <label class="cs-field" for="iv-file"><span>Upload a CSV or Excel file</span><input id="iv-file" name="file" type="file" accept="${FILE_ACCEPT}" data-change="inv8-file"${ui.bulkFileError ? ' aria-invalid="true" aria-describedby="iv-file-msg"' : ''}><span class="cs-hint">A .csv or .xlsx file with one investor per row. Columns: first name, last name, email, then optionally offering, commitment and how they invest. A header row is recognized; the first worksheet of an Excel file is read.</span>${ui.bulkFileError ? `<span class="cs-error" id="iv-file-msg" role="alert">${h(ui.bulkFileError)}</span>` : ui.bulkFileNote ? `<span class="cs-hint inv8-file-note" id="iv-file-msg" role="status">${h(ui.bulkFileNote)}</span>` : ''}</label>
      <label class="cs-field" for="iv-csv"><span>Or paste a list: first name, last name, email, offering, commitment</span><textarea id="iv-csv" name="csv" rows="6" spellcheck="false" placeholder="first name,last name,email,offering,commitment&#10;Anita,Shah,anita.shah@example.com,${eg},100000&#10;Ravi,Patel,ravi.patel@example.com">${h(ui.bulkText || '')}</textarea><span class="cs-hint">One investor per line. Offering and commitment are optional; the offering can be its short name or full name. Add a last column to say how they invest (individual, joint, trust, entity or IRA); otherwise they choose during onboarding. A list with the full name in one column (name, email, offering, commitment) also works.</span></label>
      ${ui.bulkResult || ''}
      <div class="cs-row"><button class="cs-btn" type="submit">Check list</button>${ui.bulkRows && ui.bulkRows.length ? `<button class="cs-btn cs-btn-primary" type="button" data-action="invite-bulk-add"${ui.bulkBusy ? ' disabled aria-busy="true"' : ''}>${ui.bulkBusy ? 'Sending…' : `Send ${ui.bulkRows.length} invitation${ui.bulkRows.length === 1 ? '' : 's'}`}</button>` : ''}</div>
    </form>`;
    const srvUrl = serverOn(w) ? IV().serverUrl(w) : '';
    const pin = srvUrl && NS.app.publishedServer && !NS.app.publishedServer(srvUrl) ? ` Investors’ links open only on a portal page that lists this server: where you publish the portal, add <code>window.CVPortalConfig = { integrationServers: ['${h(srvUrl)}'] }</code> before its scripts. Until then their links open only in this browser.` : '';
    const how =
      tab === 'manual'
        ? 'An investor added manually is active straight away and is not asked to onboard online. Their documents stay with you on paper; you can publish documents to their portal afterwards.'
        : serverOn(w)
          ? `Your integration server emails each investor from ${h(w.tenant.name)}, with replies going to ${h(w.tenant.support.email)}. You get a notification when they finish.${pin}`
          : `No integration server is connected, so you send the email from your own email app: the portal prepares it with the link. ${NS.app.can('configure') ? '<a href="#console-integrations">Connect your integration server</a>' : 'An admin can connect your integration server'} to send invitations automatically and let investors onboard on any device.`;
    const tabs = [
      ['single', 'One investor'],
      ['bulk', 'Import a list'],
      ['manual', 'Add manually']
    ];
    return CK().panel(
      'Invite an investor',
      `<p class="cs-hint inv8-lede">${
        tab === 'manual'
          ? 'For an investor you onboarded offline on paper documents. They are added to the portal as an active investor without being sent the onboarding link.'
          : 'Enter their name and email. The investor gets one link that walks them through everything: their login, investor information, identity and sanctions checks, accreditation, tax certification, bank details and the subscription documents. They are added to the portal as they go.'
      }</p>
      <div class="cs-tabs cs-tabs-inline" role="group" aria-label="Invite method">${tabs.map(([k, l]) => `<button type="button" class="cs-tab" data-action="invite-tab" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
      ${tab === 'manual' ? manualForm() : tab === 'single' ? single : bulk}
      <p class="cs-hint">${how}</p>`
    );
  }

  /* ---------- Console: adding an investor manually (onboarded offline) ---------- */
  function manualDraft() {
    const u = S().ui;
    if (!u.inv8m) u.inv8m = { first: '', last: '', email: '', phone: '', type: 'individual', account: '', address: '', offeringId: '', amount: '', checked: false, link: false, errors: {}, busy: false };
    return u.inv8m;
  }
  NS.binders.inv8m = (path, v) => {
    const d = manualDraft();
    d[path] = v;
    const k = path === 'offeringId' ? 'offering' : path === 'first' || path === 'last' ? 'name' : path;
    if (d.errors[k]) delete d.errors[k];
    if (path === 'offeringId') NS.app.render();
  };
  function manualForm() {
    const w = W();
    const d = manualDraft();
    const off = offOf(w, d.offeringId);
    const cur = off ? curOf(off) : 'USD';
    const err = (k) => (d.errors[k] ? `<span class="cs-error" id="im-err-${k}">${h(d.errors[k])}</span>` : '');
    const bad = (k) => (d.errors[k] ? ` aria-invalid="true" aria-describedby="im-err-${k}"` : '');
    const open = off && NS.ops && NS.ops.isOpen(off);
    return `<form class="cs-form cs-grid inv8-form inv8-manual" data-form="invite-manual" novalidate>
      <label class="cs-field" for="im-first"><span>First name</span><input id="im-first" name="first" maxlength="60" autocomplete="off" data-bind="inv8m:first" value="${h(d.first)}"${bad('name')}></label>
      <label class="cs-field" for="im-last"><span>Last name</span><input id="im-last" name="last" maxlength="60" autocomplete="off" data-bind="inv8m:last" value="${h(d.last)}"${bad('name')}>${err('name')}</label>
      <label class="cs-field" for="im-email"><span>Email</span><input id="im-email" name="email" type="email" maxlength="120" autocomplete="off" data-bind="inv8m:email" value="${h(d.email)}"${bad('email')}>${err('email')}</label>
      <label class="cs-field" for="im-phone"><span>Phone <em>Optional</em></span><input id="im-phone" name="phone" type="text" inputmode="tel" maxlength="40" autocomplete="off" data-bind="inv8m:phone" value="${h(d.phone)}"></label>
      <label class="cs-field" for="im-type"><span>Investing as <em>Optional</em></span><select id="im-type" name="type" data-bind="inv8m:type">${Object.keys(NS.ENTITY_TYPES).map((k) => `<option value="${k}"${d.type === k ? ' selected' : ''}>${h(NS.ENTITY_TYPES[k].label)}</option>`).join('')}</select></label>
      <label class="cs-field" for="im-title"><span>Account name <em>Optional</em></span><input id="im-title" name="title" maxlength="120" autocomplete="off" placeholder="Defaults to the full name" data-bind="inv8m:account" value="${h(d.account)}"><span class="cs-hint">For a trust, company or IRA, its legal name.</span></label>
      <label class="cs-field cs-wide" for="im-address"><span>Mailing address <em>Optional</em></span><textarea id="im-address" name="address" rows="2" maxlength="300" data-bind="inv8m:address">${h(d.address)}</textarea></label>
      <label class="cs-field" for="im-off"><span>Offering <em>Optional</em></span><select id="im-off" name="offering" data-bind="inv8m:offeringId"${bad('offering')}><option value=""${!off ? ' selected' : ''}>No offering: account only</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${off && off.id === o.id ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select>${err('offering')}</label>
      <label class="cs-field" for="im-amt"><span>Commitment (${cur === 'USD' ? '$' : h(cur)}) <em>Optional</em></span><input id="im-amt" name="amount" type="number" min="0" step="1000" inputmode="decimal" data-bind="inv8m:amount" value="${h(d.amount)}"${bad('amount')}><span class="cs-hint">${off ? (open ? 'Recorded as an approved subscription; record the funding when the wire arrives.' : 'Recorded as an accepted subscription, with the commitment on the investor register.') : 'With an offering, the subscription they signed on paper is recorded.'}</span>${err('amount')}</label>
      <label class="cs-check cs-wide" for="im-checked"><input id="im-checked" name="checked" type="checkbox" data-bind="inv8m:checked"${d.checked ? ' checked' : ''}><span>Identity, sanctions screening and accreditation were checked offline<span class="cs-hint">Ticked: they are recorded as approved by your team, with your name in the change log. Not ticked: they appear on the AML/KYC page to be verified.</span></span></label>
      <label class="cs-check cs-wide" for="im-link"><input id="im-link" name="link" type="checkbox" data-bind="inv8m:link"${d.link ? ' checked' : ''}><span>Send them a link to sign in to their portal<span class="cs-hint">Off: they are added without any email. You can invite them later.</span></span></label>
      <p class="cs-error cs-wide" id="im-error" role="alert"${Object.keys(d.errors).length ? '' : ' hidden'}>${Object.keys(d.errors).length ? 'Check the highlighted fields.' : ''}</p>
      <div class="cs-row cs-wide"><button class="cs-btn cs-btn-primary" type="submit"${d.busy ? ' disabled aria-busy="true"' : ''}>${d.busy ? 'Adding…' : 'Add investor'}</button></div>
    </form>`;
  }
  /** Field problems for an investor added manually, by field: name, email, offering, amount. */
  function validateManual(ws, o) {
    const e = {};
    const first = String(o.first || '').trim();
    const last = String(o.last || '').trim();
    if (!first && !last) e.name = 'Enter the investor’s first and last name.';
    else if (!first) e.name = 'Enter the investor’s first name.';
    else if (!last && !/\s/.test(first)) e.name = 'Enter the investor’s last name.';
    const have = isEmail(o.email) ? byEmail(ws, o.email) : null;
    if (!isEmail(o.email)) e.email = 'Enter a valid email address.';
    else if (have) e.email = `${have.title} is already in the portal with this email address.`;
    const off = offOf(ws, o.offeringId);
    if (o.offeringId && !off) e.offering = 'Choose one of your offerings.';
    const amt = o.amount === '' || o.amount == null ? '' : Number(String(o.amount).replace(/[$,\s]/g, ''));
    if (amt !== '' && !(isFinite(amt) && amt > 0)) e.amount = 'Enter the commitment as an amount, or leave it blank.';
    else if (amt !== '' && !off) e.amount = 'Choose the offering this commitment is for.';
    else if (off && amt === '') e.amount = `Enter their commitment to ${sentence(off.name)}`;
    return e;
  }
  /**
   * Add an investor onboarded offline: an active record (no onboarding link), verification as the team says it stands, and
   * the subscription they signed on paper. o: first, last, email, phone, type, account, address, offeringId, cents, checked.
   */
  async function addManually(ws, o) {
    const first = String(o.first || '').trim();
    const last = String(o.last || '').trim();
    const name = [first, last].filter(Boolean).join(' ');
    const email = String(o.email || '').trim();
    if (!name) throw new Error('Enter the investor’s full name.');
    if (!isEmail(email)) throw new Error('Enter a valid email address.');
    if (byEmail(ws, email)) throw new Error('An investor with this email address is already in the portal.');
    const off = offOf(ws, o.offeringId);
    const cents = off ? Math.max(0, Math.round(Number(o.cents) || 0)) : 0;
    const actor = NS.app.actor();
    const investor = {
      id: nextInvestorId(ws),
      contact: name,
      title: String(o.account || '').trim() || name,
      type: NS.ENTITY_TYPES[o.type] ? o.type : 'individual',
      email,
      phone: String(o.phone || '').trim().slice(0, 40),
      address: String(o.address || '').trim().slice(0, 300),
      tinLast4: '',
      accreditation: { basis: '', date: '' },
      taxForm: '',
      edelivery: false,
      onboarding: { status: 'complete', step: 0, invited: today(), completed: today(), source: 'manual', offeringId: off ? off.id : '', addedBy: actor },
      payment: { method: 'check', bank: null },
      positions: []
    };
    ws.investors.push(investor);
    audit(
      ws,
      'Investor added manually',
      `${investor.title} (${email}): onboarded offline on paper documents, no onboarding link sent; ${o.checked ? 'identity, sanctions screening and accreditation checked offline' : 'verification still to do on the AML/KYC page'}${off && cents ? `; ${off.name}, ${money(off, cents)} ${NS.ops && NS.ops.isOpen(off) ? 'subscription' : 'commitment'}` : ''}`,
      off ? off.id : '',
      investor.id
    );
    const I = IV();
    const note = `Checked offline by ${actor}`;
    if (I && I.vOf) {
      const v = I.vOf(investor);
      const team = ws.tenant.support.team;
      if (o.checked) {
        // The team's own checks, made on paper: recorded as theirs (never as a connection's result), then approved by a person.
        v.identity = { status: 'passed', connection: 'manual', how: 'manual', via: team, method: 'Checked offline', note, recordedBy: actor, completedAt: nowIso() };
        v.aml = { status: 'clear', results: [], note, by: actor };
        I.decideManually(ws, investor, true, note);
        await I.complete(ws, investor, 'accreditation', 'verified', { connection: 'manual', how: 'manual', via: team, method: 'Checked offline', note, recordedBy: actor }, actor);
      } else {
        // Waiting on the team: the AML/KYC page lists them with Record result, which screens them and decides.
        v.identity = { status: 'pending', connection: 'manual', how: 'manual', via: team, method: 'Paper documents on file', startedAt: nowIso() };
        I.syncKyc(ws, investor);
      }
    } else if (o.checked) investor.kyc = { status: 'cleared', risk: 'Low', owners: [{ name, pct: 100 }], verifiedOn: today(), method: note };
    let request = null;
    if (off && cents > 0 && NS.ops) {
      const classes = openClasses(off);
      // additional: the paper documents are already signed, so no agreement is sent for signature (esign.js sends the
      // offering's agreement to a new subscriber only). The request itself is a first subscription.
      request = NS.ops.submitSubscription(ws, investor, off, { cents, signature: `${name} on paper documents (recorded by ${actor})`, cls: classes.length === 1 ? classes[0].id : '', additional: true, offline: true, actor });
      if (request) {
        request.additional = false;
        request.source = 'manual';
        if (NS.ops.decide(ws, request, true, `Subscribed offline on paper documents; recorded by ${actor}`) && !NS.ops.isOpen(off)) NS.ops.markFunded(ws, request);
      }
    }
    NS.app.save(true);
    return { investor, request };
  }
  NS.forms['invite-manual'] = async function (f) {
    if (!E.diy) return;
    if (!NS.app.can('operate')) return U.toast('Only your team can add investors.');
    const w = W();
    const d = manualDraft();
    if (d.busy) return;
    const v = (n) => (f.elements[n] ? String(f.elements[n].value || '').trim() : '');
    Object.assign(d, { first: v('first'), last: v('last'), email: v('email'), phone: v('phone'), type: v('type') || 'individual', account: v('title'), address: v('address'), offeringId: v('offering'), amount: v('amount'), checked: !!f.elements.checked.checked, link: !!f.elements.link.checked });
    d.errors = validateManual(w, d);
    if (Object.keys(d.errors).length) {
      NS.app.render();
      const bad = document.querySelector('.inv8-manual [aria-invalid="true"]');
      if (bad) bad.focus();
      return;
    }
    d.busy = true;
    NS.app.render();
    let made;
    try {
      made = await addManually(w, Object.assign({}, d, { cents: d.amount === '' ? 0 : Math.round(Number(String(d.amount).replace(/[$,\s]/g, '')) * 100) }));
    } catch (err) {
      d.busy = false;
      d.errors = { email: String((err && err.message) || err) };
      NS.app.render();
      return;
    }
    const inv = made.investor;
    let it = null;
    let res = null;
    if (d.link) {
      it = create(w, { name: inv.contact, email: inv.email, type: inv.type, account: inv.title, access: true }).invitation;
      NS.app.save(true);
      res = await send(w, it);
    }
    Object.assign(S().ui, { inv8m: null, inviteOpen: false, invFilter: 'all' });
    NS.app.render();
    U.toast(`${inv.title} added as an active investor${made.request ? `, with their ${made.request.status === 'accepted' ? 'commitment on the register' : 'subscription approved'}` : ''}.${d.checked ? '' : ' Verify them on the AML/KYC page.'}`);
    if (it && res) afterSend(w, it, res);
  };
  function readForm(f) {
    const v = (n) => (f.elements[n] ? String(f.elements[n].value || '') : '');
    const first = v('contact').trim();
    const last = v('last').trim();
    return { first, last, name: [first, last].filter(Boolean).join(' '), email: v('email').trim(), type: v('type') || 'individual', account: v('title').trim(), offeringId: v('offering'), amount: v('amount').trim(), cls: v('cls'), note: v('note').trim() };
  }
  async function submitInvite(f) {
    const w = W();
    const d = draft();
    if (d.busy) return;
    const x = readForm(f);
    Object.assign(d, x);
    const more = f.querySelector('.inv8-more');
    if (more && more.open) d.more = true;
    const dollars = x.amount === '' ? '' : Number(x.amount.replace(/[$,\s]/g, ''));
    const cents = dollars === '' ? '' : isFinite(dollars) ? Math.round(dollars * 100) : NaN;
    const e = validate(w, { name: x.name, first: x.first, last: x.last, email: x.email, offeringId: x.offeringId, cents: cents === '' ? '' : cents, cls: x.cls });
    if (cents !== '' && isNaN(cents)) e.amount = 'Enter the commitment as an amount, or leave it blank.';
    d.errors = e;
    if (Object.keys(e).length) {
      NS.app.render();
      const first = document.querySelector('.inv8-form [aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    const r = create(w, { name: x.name, email: x.email, type: x.type, account: x.account, offeringId: x.offeringId, cents: cents || 0, cls: x.cls, note: x.note });
    NS.app.save(true);
    d.busy = true;
    S().ui.inv8Filter = 'open';
    NS.app.render();
    const res = await send(w, r.invitation);
    S().ui.inv8 = null;
    S().ui.inviteOpen = false;
    NS.app.render();
    afterSend(w, r.invitation, res);
  }
  function afterSend(w, it, res) {
    const inv = invOf(w, it.investorId);
    if (res.emailStatus === 'manual') return showEmail(it.id);
    if (res.emailStatus === 'failed') return U.toast(`The invitation for ${inv.title} could not be sent: ${res.error}`);
    U.toast(res.emailStatus === 'outbox' ? `Invitation for ${inv.title} saved in the integration server outbox (no SMTP settings yet).` : `Invitation emailed to ${inv.contact}.`);
  }
  // The DIY edition's invite form replaces the managed edition's (same form id, so existing links keep working).
  const baseInviteOne = NS.forms['invite-one'];
  NS.forms['invite-one'] = function (f) {
    if (!E.diy) return baseInviteOne && baseInviteOne.apply(this, arguments);
    if (!NS.app.can('operate')) return U.toast('Only your team can invite investors.');
    return submitInvite(f);
  };

  /* ---------- Console: importing a list (pasted, or a CSV or Excel file) ---------- */
  const FILE_ACCEPT = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const MAX_LIST_BYTES = 5 * 1024 * 1024;
  const MAX_LIST_ROWS = 2000;
  /** Delimited text as rows of trimmed cells: quotes, doubled quotes, separators and line breaks inside quotes, CRLF. Empty lines stay as empty rows so row numbers match. */
  function csvRows(text) {
    const s = String(text || '').replace(/^﻿/, '');
    // Commas or tabs; a list exported with semicolons (no comma or tab on its first line) is read with semicolons.
    const head = s.split(/\r?\n/, 1)[0] || '';
    const semi = !/[,\t]/.test(head) && head.indexOf(';') >= 0;
    const sep = (c) => c === ',' || c === '\t' || (semi && c === ';');
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    const endRow = () => {
      row.push(cur.trim());
      rows.push(row.length === 1 && !row[0] ? [] : row);
      row = [];
      cur = '';
    };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"' && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c === '\r' || c === '\n' ? ' ' : c;
      } else if (c === '"') q = true;
      else if (sep(c)) {
        row.push(cur.trim());
        cur = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        endRow();
      } else cur += c;
    }
    if (cur || row.length) endRow();
    return rows;
  }
  /** Rows of cells as the text the paste box holds. */
  const csvText = (rows) =>
    rows
      .map((r) => r.map((c) => (/[",\t\r\n]/.test(c) ? `"${String(c).replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"` : c)).join(','))
      .join('\n');
  const TYPE_WORDS = { individual: 'individual', joint: 'joint', trust: 'trust', entity: 'entity', company: 'entity', llc: 'entity', corporation: 'entity', partnership: 'entity', ira: 'ira' };
  const HEADERS = {
    first: ['first name', 'first', 'firstname', 'given name'],
    last: ['last name', 'last', 'lastname', 'surname', 'family name'],
    email: ['email', 'e mail', 'email address', 'e mail address'],
    name: ['name', 'full name', 'investor', 'investor name'],
    offering: ['offering', 'fund'],
    amount: ['commitment', 'amount', 'commitment amount'],
    type: ['investing as', 'type', 'account type', 'investor type']
  };
  /** The columns a header row names (field: column index), or null when the row is not a header. */
  function headerOf(cells) {
    if (cells.some((c) => c.indexOf('@') >= 0)) return null;
    const map = {};
    cells.forEach((c, i) => {
      const k = String(c).toLowerCase().replace(/[_-]+/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
      const f = Object.keys(HEADERS).find((x) => HEADERS[x].indexOf(k) >= 0);
      if (f && map[f] === undefined) map[f] = i;
    });
    return map.email !== undefined || map.name !== undefined || map.first !== undefined ? map : null;
  }
  /** "Anita Shah" as first and last name: the last word is the last name ("Shah, Anita": the part before the comma). */
  function splitName(full) {
    const t = String(full || '').trim();
    const comma = t.indexOf(',');
    if (comma > 0 && t.slice(comma + 1).trim()) return { first: t.slice(comma + 1).trim(), last: t.slice(0, comma).trim() };
    const parts = t.split(/\s+/).filter(Boolean);
    return parts.length < 2 ? { first: parts[0] || '', last: '' } : { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
  }
  /**
   * Rows of cells as investors to invite. With a header row, its columns; without one, first name, last name, email,
   * offering, commitment, type, or the earlier order with the full name in one column (name, email, offering, commitment,
   * type): the column holding the '@' tells them apart.
   */
  function parseRows(all, word) {
    const w = W();
    const rows = [];
    const errors = [];
    const seen = {};
    let cols = null;
    let started = false;
    all.forEach((cells, idx) => {
      if (!cells || !cells.some((c) => c)) return;
      if (!started) {
        started = true;
        cols = headerOf(cells);
        if (cols) return;
      }
      const at = (k) => (cols[k] === undefined ? '' : String(cells[cols[k]] || '').trim());
      let first, last, email, offName, amt, typ;
      // A full name given in one column stays as it was typed ("Shah, Anita"); the preview shows how it splits.
      let full = '';
      if (cols) {
        first = at('first');
        last = at('last');
        // One name column, or a full name typed under "first name": the last word is the last name.
        if (!first && !last) ({ first, last } = splitName((full = at('name'))));
        else if (first && !last && cols.last === undefined) ({ first, last } = splitName((full = first)));
        [email, offName, amt, typ] = [at('email'), at('offering'), at('amount'), at('type')];
      } else if (String(cells[1] || '').indexOf('@') >= 0) {
        ({ first, last } = splitName((full = String(cells[0] || '').trim())));
        [email, offName, amt, typ] = cells.slice(1);
      } else [first, last, email, offName, amt, typ] = cells;
      email = String(email || '').trim();
      const name = full || [first, last].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
      const o = offName ? w.offerings.find((x) => [x.id, x.shortName, x.name].some((n) => n && n.toLowerCase() === String(offName).toLowerCase())) : null;
      const dollars = amt ? Number(String(amt).replace(/[$,\s]/g, '')) : 0;
      const type = typ ? TYPE_WORDS[String(typ).toLowerCase().replace(/[^a-z]/g, '')] : 'individual';
      let why = '';
      if (!name) why = 'missing name';
      else if (!isEmail(email)) why = `invalid email "${email || ''}"`;
      else if (seen[email.toLowerCase()]) why = `${email} is listed twice`;
      else if (offName && !o) why = `unknown offering "${offName}"`;
      else if (o && o.status !== 'Raising') why = `${o.name} is not raising`;
      else if (amt && !(dollars > 0)) why = `invalid commitment "${amt}"`;
      else if (dollars > 0 && !o) why = 'a commitment needs an offering';
      else if (typ && !type) why = `unknown investor type "${typ}"`;
      else if (!first) why = 'missing first name';
      else if (!last) why = `missing last name for "${name}"`;
      else {
        const e = validate(w, { name, first, last, email, offeringId: o ? o.id : '', cents: Math.round(dollars * 100) });
        why = e.name || (e.email ? (/already/.test(e.email) ? `${email} is already in the portal` : e.email) : e.amount || e.offering || '');
      }
      if (why) errors.push(`${word || 'Line'} ${idx + 1}: ${why}`);
      else {
        seen[email.toLowerCase()] = true;
        rows.push({ first: String(first).trim(), last: String(last).trim(), name, email, offeringId: o ? o.id : '', offeringName: o ? o.shortName || o.name : '', cents: Math.round(dollars * 100), type });
      }
    });
    return { rows, errors };
  }
  const parseBulk = (text) => parseRows(csvRows(text));
  /** Check the list in the paste box and show what would be sent (a pasted list and an uploaded file end up here alike). */
  function checkBulk(text) {
    const ui = S().ui;
    const w = W();
    ui.bulkText = String(text || '');
    const { rows, errors } = parseBulk(ui.bulkText);
    ui.bulkRows = rows;
    ui.bulkResult = `<div class="cs-bulk">${rows.length ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact inv8-bulk-tbl"><thead><tr><th scope="col">First name</th><th scope="col">Last name</th><th scope="col">Email</th><th scope="col">Offering</th><th scope="col" class="num">Commitment</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${h(r.first)}</td><td>${h(r.last)}${r.type !== 'individual' ? `<span class="sub">${h(NS.ENTITY_TYPES[r.type].label)}</span>` : ''}</td><td>${h(r.email)}</td><td>${r.offeringName ? h(r.offeringName) : '<span class="cs-muted">Account only</span>'}</td><td class="num">${r.cents ? h(money(offOf(w, r.offeringId), r.cents)) : '<span class="cs-muted">Investor chooses</span>'}</td></tr>`)
      .join('')}</tbody></table></div>` : ''}${errors.length ? `<ul class="cs-errors">${errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>` : ''}${!rows.length && !errors.length ? '<p class="cs-muted">No rows found.</p>' : ''}</div>`;
    return { rows, errors };
  }
  const baseBulk = NS.forms['invite-bulk'];
  NS.forms['invite-bulk'] = function (f) {
    if (!E.diy) return baseBulk && baseBulk.apply(this, arguments);
    const ui = S().ui;
    ui.bulkFileError = '';
    ui.bulkFileNote = '';
    checkBulk(f.elements.csv.value);
    NS.app.render();
  };

  /* An Excel workbook (.xlsx) is a zip of XML parts: the first worksheet's cells, as rows of text. */
  const xmlOf = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const tags = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
  const colIndex = (ref) => {
    const m = /^([A-Za-z]+)/.exec(String(ref || ''));
    if (!m) return -1;
    let n = 0;
    for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  /** The text of a string item or inline string: its runs joined, phonetic guides left out. */
  const siText = (node) => tags(node, 't').filter((t) => !(t.parentNode && t.parentNode.localName === 'rPh')).map((t) => t.textContent).join('');
  async function xlsxRows(bytes) {
    if (!window.JSZip) {
      // The same zip reader the document reader uses for Word files (intake.js), loaded once.
      if (!NS.loadZip) throw new Error('Excel files cannot be read here. Save the file as .csv and upload it again.');
      try {
        await NS.loadZip();
      } catch (e) {
        throw new Error('The Excel reader could not be loaded (check your connection). Try again, or save the file as .csv.');
      }
    }
    let zip;
    try {
      zip = await window.JSZip.loadAsync(bytes);
    } catch (e) {
      throw new Error('This file is not a readable Excel workbook. Save it as .xlsx or .csv and upload it again.');
    }
    const read = async (p) => (zip.file(p) ? zip.file(p).async('string') : '');
    // The first sheet the workbook lists, through its relationship; sheet1.xml when the workbook does not say.
    let sheetPath = '';
    const wb = await read('xl/workbook.xml');
    const rels = await read('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      const sheet = tags(xmlOf(wb), 'sheet')[0];
      const rid = sheet ? sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || Array.from(sheet.attributes).filter((a) => a.localName === 'id').map((a) => a.value)[0] : '';
      const rel = tags(xmlOf(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid);
      const target = rel ? String(rel.getAttribute('Target') || '') : '';
      if (target) sheetPath = target.charAt(0) === '/' ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    }
    if (!sheetPath || !zip.file(sheetPath)) sheetPath = zip.file('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : (Object.keys(zip.files).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0] || '');
    if (!sheetPath) throw new Error('This Excel file has no worksheet. Save it as .xlsx or .csv and upload it again.');
    const ss = await read('xl/sharedStrings.xml');
    const shared = ss ? tags(xmlOf(ss), 'si').map(siText) : [];
    const rows = [];
    tags(xmlOf(await read(sheetPath)), 'row').forEach((row, i) => {
      const n = Number(row.getAttribute('r')) || i + 1;
      const cells = [];
      let next = 0;
      tags(row, 'c').forEach((c) => {
        const at = colIndex(c.getAttribute('r'));
        const col = at >= 0 ? at : next;
        next = col + 1;
        const t = c.getAttribute('t') || 'n';
        const vEl = tags(c, 'v')[0];
        const raw = vEl ? vEl.textContent : '';
        let val = '';
        if (t === 's') val = shared[Number(raw)] || '';
        else if (t === 'inlineStr') val = siText(c);
        else if (t === 'b') val = raw === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'n') val = raw !== '' && isFinite(Number(raw)) ? String(Number(raw)) : raw;
        else val = raw;
        if (col < 200) cells[col] = String(val).replace(/[\r\n]+/g, ' ').trim();
      });
      for (let k = 0; k < cells.length; k++) if (cells[k] === undefined) cells[k] = '';
      if (n >= 1 && n <= MAX_LIST_ROWS + 1) rows[n - 1] = cells;
    });
    for (let k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
    return rows;
  }
  /** An uploaded list as rows of cells: CSV text, or the first worksheet of an .xlsx workbook. */
  async function fileRows(file) {
    if (!file) throw new Error('Choose a file.');
    if (file.size > MAX_LIST_BYTES) throw new Error('This file is larger than 5 MB. Upload a smaller list.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = String(file.name || '').toLowerCase();
    const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const legacy = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    if (legacy || (/\.xls$/.test(name) && !zipped)) throw new Error('This is an older Excel file (.xls), which cannot be read here. Open it in your spreadsheet app, save it as .xlsx or .csv, and upload that.');
    if (zipped) return xlsxRows(bytes);
    if (/\.xlsx$/.test(name)) throw new Error('This file is not a readable Excel workbook. Save it as .xlsx or .csv and upload it again.');
    if (bytes.subarray(0, 4000).some((b) => b === 0)) throw new Error('This file is not a CSV or Excel list. Upload a .csv or .xlsx file.');
    return csvRows(new TextDecoder('utf-8').decode(bytes));
  }
  NS.changes['inv8-file'] = async (el) => {
    if (!E.diy) return;
    const ui = S().ui;
    const file = el.files && el.files[0];
    if (!file) return;
    if (!NS.app.can('operate')) return U.toast('Only your team can invite investors.');
    ui.bulkFileError = '';
    ui.bulkFileNote = '';
    try {
      let rows = await fileRows(file);
      while (rows.length && !rows[rows.length - 1].some((c) => c)) rows.pop();
      const n = rows.filter((r) => r.some((c) => c)).length;
      if (!n) throw new Error('No rows were found in this file.');
      if (rows.length > MAX_LIST_ROWS) throw new Error(`This list has more than ${MAX_LIST_ROWS} rows. Split it into smaller files.`);
      // The file's rows go into the paste box, so an uploaded file and a pasted list are checked and sent the same way.
      const { rows: ok, errors } = checkBulk(csvText(rows));
      ui.bulkFileNote = `Read ${file.name}: ${ok.length} investor${ok.length === 1 ? '' : 's'} ready to invite${errors.length ? `, ${errors.length} row${errors.length === 1 ? '' : 's'} to fix` : ''}. Check the list below, then send.`;
    } catch (e) {
      ui.bulkFileError = String((e && e.message) || e);
      ui.bulkRows = null;
      ui.bulkResult = '';
    }
    NS.app.render();
  };
  const baseBulkAdd = NS.actions['invite-bulk-add'];
  NS.actions['invite-bulk-add'] = async function () {
    if (!E.diy) return baseBulkAdd && baseBulkAdd.apply(this, arguments);
    const ui = S().ui;
    const w = W();
    if (ui.bulkBusy) return;
    const rows = (ui.bulkRows || []).filter((r) => !Object.keys(validate(w, { name: r.name, email: r.email, offeringId: r.offeringId, cents: r.cents })).length);
    ui.bulkBusy = true;
    NS.app.render();
    const made = rows.map((r) => create(w, { name: r.name, email: r.email, type: r.type, offeringId: r.offeringId, cents: r.cents }).invitation);
    NS.app.save(true);
    const res = [];
    for (const it of made) res.push(await send(w, it));
    Object.assign(ui, { bulkBusy: false, bulkRows: null, bulkResult: '', bulkText: '', bulkFileNote: '', bulkFileError: '', inviteOpen: false, inv8Filter: 'open' });
    NS.app.render();
    const manual = res.filter((r) => r.emailStatus === 'manual').length;
    const failed = res.filter((r) => r.emailStatus === 'failed').length;
    U.toast(manual ? `${made.length} invitation${made.length === 1 ? '' : 's'} ready. Send each one from your email app with Email in the invitations list.` : `${made.length - failed} invitation${made.length - failed === 1 ? '' : 's'} sent${failed ? `; ${failed} could not be sent (see the list)` : ''}.`);
  };

  /* ---------- Console: the email to send from the sponsor's own email app ---------- */
  /** An invitation whose link no longer works: say why, and offer what still makes sense (never the dead link). */
  function closedDialog(w, it) {
    const inv = invOf(w, it.investorId) || { title: '', contact: '' };
    const ops = NS.app.can('operate');
    const newer = forInvestor(w, it.investorId) !== it;
    const why =
      it.status === 'cancelled'
        ? `This invitation was cancelled${it.cancelledAt ? ` on ${h(date(String(it.cancelledAt).slice(0, 10), 'long'))}` : ''}. Its link no longer works.`
        : it.status === 'completed'
          ? `${h(inv.contact)} ${finishedWhat(it)}${it.completedAt ? ` on ${h(date(String(it.completedAt).slice(0, 10), 'long'))}` : ''}. The link now opens their summary only.`
          : `This invitation expired${it.expiresAt ? ` on ${h(date(String(it.expiresAt).slice(0, 10), 'long'))}` : ''}. Its link no longer works.`;
    const act = !ops || newer ? '' : it.status === 'cancelled' ? `<button class="cs-btn cs-btn-primary" type="button" data-action="inv8-reinvite" data-id="${h(it.id)}">Invite again</button>` : it.status === 'expired' ? `<button class="cs-btn cs-btn-primary" type="button" data-action="inv8-resend" data-id="${h(it.id)}">Resend with a new link</button>` : '';
    U.dialog(
      `<div class="dlg-head"><div><h2>Invitation ${it.status === 'completed' ? 'completed' : it.status === 'cancelled' ? 'cancelled' : 'expired'}</h2><p>${h(inv.title)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body"><p>${why}${newer ? ' A newer invitation is in the invitations list.' : ''}</p>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Close</button>${act}</div></div>`
    );
  }
  const live = (it) => OPEN.indexOf(it.status) >= 0 && !expiredNow(it);
  function showEmail(id) {
    const w = W();
    const it = list(w).find((x) => x.id === id);
    if (!it) return;
    if (refresh(w)) NS.app.save();
    if (!live(it)) return closedDialog(w, it);
    const t = w.tenant;
    const m = emailFor(w, it);
    const local = !it.serverId;
    U.dialog(
      `<div class="dlg-head"><div><h2>Invitation email</h2><p>${local ? 'Send it from your email app. The portal prepared it with the investor’s link.' : 'The email your integration server sends.'}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body inv8-email">
        <dl class="inv8-meta">
          <div><dt>From</dt><dd>${h(m.fromName)}${local ? ' <span class="cs-hint">(your own address, from your email app)</span>' : ''}</dd></div>
          ${m.replyTo && !local ? `<div><dt>Reply to</dt><dd>${h(m.replyTo)}</dd></div>` : ''}
          <div><dt>To</dt><dd>${h(m.toName)} &lt;${h(m.to)}&gt;</dd></div>
          <div><dt>Subject</dt><dd class="inv8-subject">${h(m.subject)}</dd></div>
        </dl>
        <article class="email">
          <div class="email-head">${B.lockup(t)}</div>
          <div class="email-body">
            ${m.lines.map((l) => `<p>${h(l).replace(/\n/g, '<br>')}</p>`).join('')}
            <p><span class="email-btn">${h(m.button)}</span></p>
            <p class="inv8-raw">${h(m.link)}</p>
            ${m.tail.map((l) => `<p>${h(l)}</p>`).join('')}
          </div>
          <div class="email-foot">${h(t.legalName || t.name)}</div>
        </article>
        <label class="cs-field inv8-linkfield" for="inv8-link"><span>Invitation link</span><input id="inv8-link" type="text" readonly value="${h(m.link)}"></label>
        ${local && it.emailError ? `<p class="cs-error-text inv8-why">${h(it.emailError)}</p>` : ''}
        ${local ? `<p class="cs-hint">This link opens the portal in this browser only, because no integration server is connected. ${NS.app.can('configure') ? '<a href="#console-integrations" data-action="close-dialog">Connect your integration server</a>' : 'Ask an admin to connect your integration server'} so investors can onboard on their own devices and the email is sent for you.</p>` : ''}
        <div class="cs-row cs-row-end inv8-actions">
          <button class="cs-btn" type="button" data-action="inv8-copy" data-id="${h(it.id)}">${icon('copy')}Copy link</button>
          ${local ? `<a class="cs-btn" id="inv8-mailto" href="${h(mailtoFor(w, it))}" data-action="inv8-mailto" data-id="${h(it.id)}">Open in your email app</a><button class="cs-btn cs-btn-primary" type="button" data-action="inv8-mark-sent" data-id="${h(it.id)}">Mark as sent</button>` : '<button class="cs-btn cs-btn-primary" type="button" data-action="close-dialog">Done</button>'}
        </div>
        ${local && it.token && E.diy && NS.app.config.demo ? `<p class="cs-hint inv8-try">Trying it out? <button class="link-btn" type="button" data-action="inv8-open-link" data-id="${h(it.id)}">Open the investor’s link</button> in this browser, signed in as ${h((invOf(w, it.investorId) || {}).contact || 'the investor')}.</p>` : ''}
      </div>`,
      'dlg-email'
    );
  }
  const itById = (el) => list(W()).find((x) => x.id === el.getAttribute('data-id'));
  NS.actions['inv8-email'] = (el) => showEmail(el.getAttribute('data-id'));
  NS.actions['inv8-copy'] = (el) => {
    const it = itById(el);
    if (!it) return;
    if (!live(it)) return closedDialog(W(), it);
    U.copy(linkFor(W(), it), document.getElementById('inv8-link'));
  };
  NS.actions['inv8-mailto'] = (el) => {
    // The browser hands the link to the email app; the sponsor confirms with Mark as sent once it has gone.
    const it = itById(el);
    if (it) U.toast(`Your email app opens with the invitation to ${(invOf(W(), it.investorId) || {}).contact || 'the investor'}. Send it from there, then choose Mark as sent.`);
  };
  NS.actions['inv8-mark-sent'] = (el) => {
    const w = W();
    const it = itById(el);
    if (!it) return;
    const inv = invOf(w, it.investorId);
    if (!live(it)) {
      U.closeDialog();
      return U.toast('This invitation is closed, so it was not marked as sent.');
    }
    Object.assign(it, { emailStatus: 'sent', emailError: '', sentAt: new Date().toISOString() });
    audit(w, 'Invitation sent', `${inv ? inv.title : it.investorId}: emailed from the sender's own email app`, it.offeringId, it.investorId);
    NS.app.save(true);
    U.closeDialog();
    NS.app.render();
    U.toast(`Invitation to ${inv ? inv.contact : 'the investor'} marked as sent.`);
  };
  NS.actions['inv8-open-link'] = (el) => {
    const w = W();
    const it = itById(el);
    if (!it || !it.token) return;
    U.closeDialog();
    const st = S();
    st.role = 'investor';
    NS.store.set('role', 'investor');
    st.viewer = it.investorId;
    NS.app.go('invite-' + it.token);
    U.toast(`Signed in as ${(invOf(w, it.investorId) || {}).title || 'the investor'} (demo)`);
  };
  NS.actions['inv8-resend'] = async (el) => {
    const w = W();
    const it = itById(el);
    if (!it) return;
    const inv = invOf(w, it.investorId);
    el.disabled = true;
    const r = await resend(w, it);
    NS.app.render();
    if (r.emailStatus === 'manual') return showEmail(it.id);
    U.toast(r.error ? `Could not resend: ${r.error}` : r.emailStatus === 'outbox' ? `New link for ${inv.title} saved in the server outbox.` : `New invitation emailed to ${inv.contact}.`);
  };
  NS.actions['inv8-cancel'] = (el) => {
    const it = itById(el);
    if (!it) return;
    const inv = invOf(W(), it.investorId);
    U.dialog(
      `<div class="dlg-head"><div><h2>Cancel this invitation?</h2><p>${h(inv ? inv.title : '')}</p></div></div>
      <div class="dlg-body"><p>The link stops working${it.stepKey ? ' and what they entered so far is not added to the portal' : ''}. The investor stays on your list; you can invite them again later.</p>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog" autofocus>Keep it</button><button class="cs-btn cs-btn-danger" type="button" data-action="inv8-cancel-yes" data-id="${h(it.id)}">Cancel invitation</button></div></div>`
    );
  };
  NS.actions['inv8-cancel-yes'] = async (el) => {
    const it = itById(el);
    if (!it) return;
    try {
      await cancel(W(), it);
      U.closeDialog();
      NS.app.render();
      U.toast('Invitation cancelled. The link no longer works.');
    } catch (e) {
      U.toast(`Could not cancel: ${e.message}`);
    }
  };
  NS.actions['inv8-reinvite'] = async (el) => {
    const w = W();
    const it = itById(el);
    if (!it || !NS.app.can('operate')) return;
    let r;
    try {
      r = reinvite(w, it);
    } catch (e) {
      U.closeDialog();
      return U.toast(e.message);
    }
    if (!r) return;
    NS.app.save(true);
    U.closeDialog();
    S().ui.inv8Filter = 'open';
    NS.app.render();
    const res = await send(w, r.invitation);
    NS.app.render();
    afterSend(w, r.invitation, res);
  };
  NS.actions['inv8-filter'] = (el) => {
    S().ui.inv8Filter = el.getAttribute('data-f');
    NS.app.render();
  };
  NS.actions['inv8-check'] = async () => {
    const w = W();
    const n = await importCompleted(w);
    NS.app.render();
    U.toast(check.error ? `Could not check: ${check.error}` : n ? `${importedText(n)} added to the portal.` : 'Checked. Nothing new.');
  };
  NS.changes['inv8-rule'] = (el) => {
    const w = W();
    if (!NS.app.can('configure')) {
      el.checked = rules(w).autoAccept;
      return U.toast('Only admins can change this. Ask an admin on your team.');
    }
    rules(w).autoAccept = !!el.checked;
    audit(w, 'Setting changed', `Accept subscriptions automatically once the agreement is countersigned and the investor is verified: ${el.checked ? 'on' : 'off'}`);
    if (el.checked) sweep(w);
    NS.app.save(true);
    NS.app.render();
  };
  NS.actions['inv8-open-invite'] = () => {
    S().ui.inviteOpen = true;
    S().ui.inviteTab = 'single';
  };
  // Investors table buttons for an invited investor: their invitation, and a reminder (a new email).
  const basePreview = NS.actions['invite-preview'];
  NS.actions['invite-preview'] = function (el) {
    const it = E.diy && forInvestor(W(), el.getAttribute('data-id'));
    if (it) return showEmail(it.id);
    return basePreview && basePreview.apply(this, arguments);
  };
  const baseRemind = NS.actions.remind;
  NS.actions.remind = function (el) {
    const it = E.diy && forInvestor(W(), el.getAttribute('data-id'));
    const stub = { getAttribute: () => it.id, set disabled(v) {} };
    if (it && OPEN.concat(['expired']).indexOf(it.status) >= 0) return NS.actions['inv8-resend'](stub);
    if (it && it.status === 'cancelled') return closedDialog(W(), it);
    if (it && it.status === 'completed') return U.toast(`${(invOf(W(), it.investorId) || {}).contact || 'The investor'} already ${finishedWhat(it)}.`);
    return baseRemind && baseRemind.apply(this, arguments);
  };

  /* ---------- Console: invitations list ---------- */
  function listPanel() {
    const w = W();
    if (refresh(w)) NS.app.save();
    const f = S().ui.inv8Filter || 'open';
    const all = list(w).slice().sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    if (!all.length) return '';
    const open = all.filter((x) => OPEN.indexOf(x.status) >= 0);
    const done = all.filter((x) => x.status === 'completed');
    const shown = f === 'open' ? open : f === 'completed' ? done : all;
    const ops = NS.app.can('operate');
    const rows = shown
      .map((it) => {
        const inv = invOf(w, it.investorId) || { title: '(removed)', email: '', contact: '' };
        const off = offOf(w, it.offeringId);
        const x = it.status === 'completed' ? outcome(w, it) : null;
        const st = statusOf(it);
        const em = it.emailStatus === 'failed' ? `<span class="cs-error-text">${h(EMAIL.failed)}${it.emailError ? `: ${h(it.emailError)}` : ''}</span>` : h(EMAIL[it.emailStatus] || it.emailStatus || '');
        const acts = [];
        if (ops && OPEN.indexOf(it.status) >= 0) {
          if (linkFor(w, it)) acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="inv8-copy" data-id="${h(it.id)}">Copy link</button>`);
          if (!it.serverId && it.token) acts.push(`<button class="cs-btn cs-btn-small${it.emailStatus === 'manual' ? ' cs-btn-primary' : ''}" type="button" data-action="inv8-email" data-id="${h(it.id)}">Email</button>`);
          acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="inv8-resend" data-id="${h(it.id)}">Resend</button>`);
          acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="inv8-cancel" data-id="${h(it.id)}">Cancel</button>`);
        } else if (ops && it.status === 'expired') acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="inv8-resend" data-id="${h(it.id)}">Resend</button>`);
        else if (ops && it.status === 'cancelled' && invOf(w, it.investorId) && forInvestor(w, it.investorId) === it) acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="inv8-reinvite" data-id="${h(it.id)}">Invite again</button>`);
        else if (x && waitingCountersign(x.env)) acts.push(`<a class="cs-btn cs-btn-small cs-btn-primary" href="#console-envelope-${h(x.env.id)}">Countersign</a>`);
        else if (x && x.inv && x.inv.onboarding && x.inv.onboarding.status === 'complete') acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="view-as" data-id="${h(x.inv.id)}">View portal</button>`);
        const activity = [[unsent(it) ? 'Created' : 'Sent', it.sentAt], ['Opened', it.openedAt], ['Completed', it.completedAt]].filter((a) => a[1]).map((a) => `<span class="inv8-when">${a[0]} ${h(when(a[1]))}</span>`).join('');
        return `<tr data-invitation="${h(it.id)}">
          <th scope="row"><span class="strong">${h(inv.title)}</span><span class="sub">${h(inv.email)}</span></th>
          <td>${off ? h(off.shortName || off.name) : '<span class="cs-muted">Account only</span>'}<span class="sub">${off ? (it.cents ? h(money(off, it.cents)) : 'Investor chooses') : ''}</span></td>
          <td>${badge(st[0], st[1])}<span class="sub inv8-step${!x && agreementUnsent(it) ? ' cs-error-text' : ''}">${h(x ? x.text : stepText(it))}</span>${it.waitingFor ? `<span class="sub">${h(it.waitingFor)}</span>` : ''}</td>
          <td class="inv8-activity">${activity}</td>
          <td>${em}</td>
          <td class="cs-row-actions">${acts.join('')}</td>
        </tr>`;
      })
      .join('');
    const tabs = [
      ['open', `In progress (${open.length})`],
      ['completed', `Completed (${done.length})`],
      ['all', `All (${all.length})`]
    ];
    const srv = serverOn(w);
    const r = rules(w);
    return CK().panel(
      `Invitations <span class="cs-count">${open.length} in progress</span>`,
      `<div class="cs-tabs cs-tabs-inline" role="group" aria-label="Invitations">${tabs.map(([k, l]) => `<button type="button" class="cs-tab" data-action="inv8-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
      ${shown.length ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact inv8-tbl"><thead><tr><th scope="col">Investor</th><th scope="col">Offering</th><th scope="col">Progress</th><th scope="col">Activity</th><th scope="col">Email</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="cs-muted">${f === 'open' ? 'No invitations in progress.' : f === 'completed' ? 'No completed onboardings yet.' : 'No invitations.'}</p>`}
      <label class="cs-check inv8-rule" for="inv8-rule"><input id="inv8-rule" type="checkbox" data-change="inv8-rule"${r.autoAccept ? ' checked' : ''}${NS.app.can('configure') ? '' : ' disabled'}><span>Accept subscriptions automatically once the agreement is countersigned and the investor is verified<span class="cs-hint">Closed-end offerings: the commitment goes on the investor register. Open-ended funds: approved, then you record the funding when the wire arrives.${NS.app.can('configure') ? '' : ' Only admins can change this.'}</span></span></label>`,
      srv ? `<span class="inv8-check">${check.at ? `<span class="cs-hint">${check.error ? `Last check failed: ${h(check.error)}` : `Checked ${h(ago(check.at)).toLowerCase()}`}</span>` : ''}<button class="cs-btn cs-btn-small" type="button" data-action="inv8-check"${check.busy ? ' disabled' : ''}>Check now</button></span>` : ''
    );
  }

  /* ---------- Console: notifications (bell, panel and page) ---------- */
  const BELL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 10a6 6 0 0 1 12 0c0 4.5 1.4 6.3 2.4 7.2H3.6C4.6 16.3 6 14.5 6 10z"/><path d="M10 20.2a2.1 2.1 0 0 0 4 0"/></svg>';
  const KIND = { invite_opened: 'Opened', invite_progress: 'In progress', verification_review: 'Review', onboarding_completed: 'Finished', agreement_signed: 'Signed', subscription_accepted: 'Accepted' };
  const showBell = () => E.diy && W() && NS.app.can('console') && S().role !== 'investor';
  function bellHTML() {
    if (!showBell()) return '';
    const n = unread(W());
    return `<button class="cs-bell" type="button" data-action="inv8-bell" aria-haspopup="dialog" aria-label="Notifications${n ? `, ${n} unread` : ''}">${BELL}<span class="cs-bell-n"${n ? '' : ' hidden'}>${n > 99 ? '99+' : n}</span></button>`;
  }
  /** Keep the bell and the menu count current without re-rendering the page. */
  function updateBell() {
    const w = W();
    const btn = document.querySelector('.cs-bell');
    if (!btn || !w) return;
    const n = unread(w);
    btn.setAttribute('aria-label', `Notifications${n ? `, ${n} unread` : ''}`);
    const b = btn.querySelector('.cs-bell-n');
    if (b) {
      b.textContent = n > 99 ? '99+' : String(n);
      b.hidden = !n;
    }
  }
  function itemHTML(n) {
    return `<li class="inv8-ntf${n.read ? '' : ' is-unread'}"><button type="button" class="inv8-ntf-btn" data-action="inv8-ntf-open" data-id="${h(n.id)}"><span class="inv8-ntf-top"><span class="inv8-ntf-kind">${h(KIND[n.kind] || 'Update')}</span><span class="inv8-ntf-at">${h(ago(n.at))}</span></span><span class="inv8-ntf-title">${n.read ? '' : '<span class="sr-only">Unread: </span>'}${h(n.title)}</span>${n.detail ? `<span class="inv8-ntf-detail">${h(n.detail)}</span>` : ''}</button></li>`;
  }
  function panelHTML() {
    const w = W();
    const all = notes(w).slice().reverse();
    const n = unread(w);
    return `<div class="dlg-head"><div><h2>Notifications</h2><p>${n ? `${n} unread` : 'All caught up'}</p></div><div class="dlg-actions">${n ? '<button class="cs-btn cs-btn-small" type="button" data-action="inv8-ntf-all">Mark all read</button>' : ''}<button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body inv8-ntf-body">${all.length ? `<ul class="inv8-ntfs">${all.slice(0, 12).map(itemHTML).join('')}</ul>` : '<p class="cs-muted">No notifications yet. You are notified when investors open their invitation, finish onboarding, sign their agreement and when a subscription is accepted.</p>'}
      <p class="inv8-ntf-more"><a href="#console-notifications" data-action="close-dialog">All notifications</a></p></div>`;
  }
  NS.actions['inv8-bell'] = () => U.dialog(panelHTML(), 'dlg-ntf');
  NS.actions['inv8-ntf-open'] = (el) => {
    const w = W();
    const n = notes(w).find((x) => x.id === el.getAttribute('data-id'));
    if (!n) return;
    n.read = true;
    NS.app.save(true);
    U.closeDialog();
    if (location.hash.replace(/^#/, '') === n.route) NS.app.render();
    else NS.app.go(safeRoute(n.route));
  };
  NS.actions['inv8-ntf-all'] = () => {
    const w = W();
    notes(w).forEach((n) => (n.read = true));
    NS.app.save(true);
    const d = document.getElementById('dlg');
    if (d && d.open && d.classList.contains('dlg-ntf')) d.innerHTML = panelHTML();
    NS.app.render();
  };
  NS.hooks.consoleBar = NS.hooks.consoleBar || [];
  NS.hooks.consoleBar.push(() => {
    const w = W();
    if (showBell() && serverOn(w) && awaiting(w) && !check.at && !check.busy) setTimeout(tick, 0);
    return bellHTML();
  });
  NS.navCounts = NS.navCounts || {};
  NS.navCounts['console-notifications'] = (ws) => (E.diy ? unread(ws) : 0);
  if (E.diy) {
    NS.views['console-notifications'] = {
      mode: 'console',
      edition: 'diy',
      render() {
        const w = W();
        const all = notes(w).slice().reverse();
        const f = S().ui.ntfFilter || 'all';
        const shown = f === 'unread' ? all.filter((n) => !n.read) : all;
        const n = unread(w);
        return CK().shell(
          `${CK().head('Notifications', 'Investors opening their invitation, finishing onboarding and signing, verifications held for review and subscriptions accepted.', n ? '<button class="cs-btn" type="button" data-action="inv8-ntf-all">Mark all read</button>' : '')}
          <div class="cs-tabs" role="group" aria-label="Filter"><button type="button" class="cs-tab" data-action="inv8-ntf-filter" data-f="all" aria-pressed="${f === 'all'}">All (${all.length})</button><button type="button" class="cs-tab" data-action="inv8-ntf-filter" data-f="unread" aria-pressed="${f === 'unread'}">Unread (${n})</button></div>
          ${CK().panel('', shown.length ? `<ul class="inv8-ntfs inv8-ntfs-page">${shown.map(itemHTML).join('')}</ul>` : `<p class="cs-muted">${f === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</p>`)}`,
          'console-notifications'
        );
      }
    };
  }
  NS.actions['inv8-ntf-filter'] = (el) => {
    S().ui.ntfFilter = el.getAttribute('data-f');
    NS.app.render();
  };

  /* ---------- Console: overview items ---------- */
  NS.hooks.consoleAttention.push((ws) => {
    if (!E.diy) return '';
    const out = [];
    const finished = list(ws).filter((it) => it.status === 'completed').map((it) => Object.assign(outcome(ws, it), { it })).filter((x) => waitingCountersign(x.env));
    // Investors already on file finished a subscription, not onboarding: the plural says which, or both.
    const subs = finished.filter((x) => x.it.existing).length;
    const many = subs === finished.length ? 'finished their subscriptions' : subs ? 'finished onboarding or their subscriptions' : 'finished onboarding';
    if (finished.length) out.push(`<li><a href="#${finished.length === 1 ? `console-envelope-${h(finished[0].env.id)}` : 'console-esign'}">${finished.length === 1 ? `${h(finished[0].inv ? finished[0].inv.title : 'An investor')} ${finishedWhat(finished[0].it)}; their subscription agreement is` : `${finished.length} investors ${many}; their subscription agreements are`} waiting for your countersignature</a></li>`);
    const waiting = (ws.requests || []).filter((r) => r.type === 'subscription' && r.status === 'pending' && r.waitingFor);
    if (waiting.length) out.push(`<li><a href="#console-kyc">${waiting.length} countersigned subscription${waiting.length === 1 ? ' is' : 's are'} waiting for verification before automatic acceptance</a></li>`);
    const manual = list(ws).filter((it) => it.emailStatus === 'manual' && OPEN.indexOf(it.status) >= 0 && !it.openedAt);
    if (manual.length) out.push(`<li><a href="#console-investors">${manual.length} invitation${manual.length === 1 ? ' is' : 's are'} waiting to be sent from your email app</a></li>`);
    const failed = list(ws).filter((it) => it.emailStatus === 'failed' && OPEN.indexOf(it.status) >= 0);
    if (failed.length) out.push(`<li><a href="#console-investors">${failed.length} invitation${failed.length === 1 ? '' : 's'} could not be emailed</a></li>`);
    return out.join('');
  });

  /* ---------- Watching for work: polling (server mode) and the acceptance rule ---------- */
  function tick() {
    const w = W();
    if (!w || !E.diy || S().remote || S().role === 'investor' || NS.app.modeOf(S().route) !== 'console') return;
    sweepAndShow();
    if (!serverOn(w) || !awaiting(w)) return;
    const before = JSON.stringify([list(w).map((x) => x.status + x.stepKey + x.importedAt + x.emailStatus), unread(w)]);
    importCompleted(w).then((n) => {
      if (W() !== w) return;
      const after = JSON.stringify([list(w).map((x) => x.status + x.stepKey + x.importedAt + x.emailStatus), unread(w)]);
      updateBell();
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      const dlg = document.getElementById('dlg');
      if (before !== after && !typing && !(dlg && dlg.open) && ['console', 'console-investors', 'console-notifications'].indexOf(S().route) >= 0) NS.app.render();
      if (n) U.toast(`${importedText(n)} added to the portal.`);
    });
  }
  if (E.diy) {
    setInterval(tick, POLL_MS);
    window.addEventListener('hashchange', () => setTimeout(sweepAndShow, 0));
    if (NS.esign && NS.esign.onSigned) {
      NS.esign.onSigned((env, signer, done) => {
        if (done && env.requestId) setTimeout(sweepAndShow, 0);
        return false;
      });
    }
    // A person's verification decision or a recorded result can let a waiting subscription through.
    ['decideManually', 'recordResult'].forEach((k) => {
      const fn = IV() && IV()[k];
      if (typeof fn !== 'function') return;
      IV()[k] = function () {
        const out = fn.apply(this, arguments);
        Promise.resolve(out).then(() => setTimeout(sweepAndShow, 0));
        return out;
      };
    });
  }

  /* ---------- The investor's browser in server mode (thin wrappers; onboarding.js calls them) ---------- */
  async function inviteCall(server, token, method, path, body) {
    const headers = { 'X-Invite-Token': token, Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(String(server).replace(/\/+$/, '') + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(data && typeof data.error === 'string' ? data.error : data && typeof data.message === 'string' ? data.message : `The server answered ${res.status}.`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const remote = {
    load: (server, token) => inviteCall(server, token, 'GET', '/v1/invite'),
    progress: (server, token, payload) => inviteCall(server, token, 'PUT', '/v1/invite/progress', payload),
    complete: (server, token, payload) => inviteCall(server, token, 'POST', '/v1/invite/complete', payload)
  };

  NS.invitations = {
    create,
    send,
    resend,
    reinvite,
    cancel,
    linkFor,
    byToken,
    progress,
    complete,
    notify,
    unread,
    importCompleted,
    remote,
    validate,
    emailFor,
    mailtoFor,
    sweep,
    serverOn,
    forInvestor,
    activationLabel,
    invitePanel,
    listPanel,
    showEmail,
    stepText,
    rules,
    addManually,
    parseList: parseBulk,
    readListFile: fileRows
  };
})(window.CVPortal);
