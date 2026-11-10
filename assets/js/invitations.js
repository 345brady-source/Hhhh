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

  /** Field problems for a new invitation, by field: name, email, offering, amount, cls. */
  function validate(ws, o) {
    const e = {};
    const email = String(o.email || '').trim();
    if (!String(o.name || '').trim()) e.name = 'Enter the investor’s full name.';
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
    if (token) invitation.link = linkFor(ws, invitation);
    if (!have) ws.investors.push(investor);
    list(ws).push(invitation);
    audit(ws, existing ? 'Investor invited to subscribe' : have ? 'Investor invited again' : 'Investor invited', `${investor.title} (${email})${off ? `: ${off.name}${invitation.cents ? `, ${money(off, invitation.cents)} commitment` : ''}` : ': account only'}`, off ? off.id : '', investor.id);
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
    const subject = off ? `${t.name}: your invitation to invest in ${off.name}` : `${t.name}: set up your investor account`;
    const link = linkFor(ws, it);
    const by = date(String(it.expiresAt || '').slice(0, 10), 'long');
    const amount = off && it.cents ? `, for a commitment of ${money(off, it.cents)}${cls ? ` in ${cls.name}` : ''}` : '';
    const what = off ? `${it.existing ? 'subscribe to' : 'set up your investor account and your subscription to'} ${off.name}${amount}` : 'set up your investor account';
    const lines = [
      `Dear ${first},`,
      sentence(`${it.sentBy && it.sentBy !== t.support.team ? `${it.sentBy} at ${t.name}` : t.name} has invited you to ${what}`)
    ];
    if (it.note) lines.push(it.note);
    if (it.existing && off) lines.push('The link below takes you through your subscription in one place: the offering documents, your commitment and the subscription agreement, which you sign online. Your account details are already on file.');
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
    return { subject, lines, tail, link, text, to: inv.email, toName: inv.contact, fromName: t.name, replyTo: isEmail(t.support.email) ? t.support.email : '', button: off ? 'Start your onboarding' : 'Set up your account' };
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
    else if (first) Object.assign(notify(ws, 'invite_progress', `${inv ? inv.title : 'An investor'} started onboarding`, detail, 'console-investors'), { invitationId: it.id });
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
    if (r && off) parts.push(`${money(off, r.cents)} subscription to ${off.name}`);
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
    notify(ws, 'onboarding_completed', `${x.inv ? x.inv.title : 'An investor'} finished onboarding`, x.text, x.route);
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
    const c = IV().ensure(ws);
    return {
      workspace: t.id,
      sendEmail: true,
      portalUrl: portalPage(),
      consoleUrl: `${portalPage()}#console-investors`,
      notifyEmail: senderEmail(ws),
      firm: { name: t.name, shortName: t.shortName, legalName: t.legalName, supportTeam: t.support.team, supportEmail: isEmail(t.support.email) ? t.support.email : '', supportPhone: t.support.phone || '', colors: { primary: t.colors.primary, accent: t.colors.accent }, logo, portalName: t.portalName, disclaimer: t.disclaimer || '', onboarding: clone(t.onboarding || {}) },
      investor: { id: inv.id, contact: inv.contact, title: inv.title, type: inv.type, email: inv.email },
      offering,
      invitation: { cents: it.cents, cls: it.cls, note: it.note, expiresAt: it.expiresAt, senderName: it.sentBy },
      verification: { connections: clone(c.connections), use: clone(c.use), rules: clone(c.rules) },
      esign
    };
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
      const r = await api(ws, 'POST', '/v1/invitations', await snapshot(ws, it));
      Object.assign(it, { serverId: String(r.id || ''), link: String(r.link || ''), token: '', emailStatus: r.emailStatus || 'sent', emailError: r.emailError || '', expiresAt: r.expiresAt || it.expiresAt, sentAt: new Date().toISOString() });
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
  const check = { at: '', error: '', busy: null };
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
      else Object.assign(notify(ws, 'invite_progress', `${inv ? inv.title : 'An investor'} started onboarding`, stepText(it), 'console-investors'), { invitationId: it.id });
    }
    if (inv && it.stepKey && inv.onboarding.status === 'invited') inv.onboarding = Object.assign({}, inv.onboarding, { status: 'in_progress' });
    return changed;
  }
  const BAD_KEYS = ['id', 'positions', '__proto__', 'constructor', 'prototype'];
  /** Merge a finished onboarding sent back by the investor's browser into this workspace. */
  async function merge(ws, it, sub) {
    const src = sub && sub.investor && typeof sub.investor === 'object' ? sub.investor : null;
    if (!src) throw new Error('The submission has no investor record.');
    let inv = invOf(ws, it.investorId);
    if (!inv) {
      inv = { id: it.investorId, contact: '', title: '', type: 'individual', email: '', onboarding: {}, payment: { method: 'check', bank: null }, positions: [] };
      ws.investors.push(inv);
    }
    Object.keys(src).forEach((k) => {
      if (BAD_KEYS.indexOf(k) < 0) inv[k] = clone(src[k]);
    });
    inv.onboarding = Object.assign({}, inv.onboarding, { source: 'invitation', invitationId: it.id, offeringId: it.offeringId });
    delete inv.onboarding.flow;
    if (!Array.isArray(inv.positions)) inv.positions = [];
    // The investor's request always arrives pending: only the firm accepts it.
    const r = sub.request && typeof sub.request === 'object' ? clone(sub.request) : null;
    ws.requests = ws.requests || [];
    if (r && r.id && !ws.requests.some((x) => x.id === r.id) && offOf(ws, r.offeringId)) {
      Object.assign(r, { type: 'subscription', investorId: inv.id, status: 'pending' });
      ['decided', 'note', 'completed', 'paid', 'paidCents'].forEach((k) => delete r[k]);
      ws.requests.push(r);
    }
    const env = sub.envelope && typeof sub.envelope === 'object' && sub.envelope.id ? clone(sub.envelope) : null;
    ws.envelopes = ws.envelopes || [];
    if (env && !ws.envelopes.some((x) => x.id === env.id)) {
      // Only the firm countersigns: a countersignature never arrives from the investor's device.
      let forged = false;
      (env.signers || []).forEach((s) => {
        if (s.role === 'countersigner' && s.status === 'signed') {
          Object.assign(s, { status: 'waiting', signedAt: null, signature: null, initials: null });
          forged = true;
        }
      });
      if (forged || env.status === 'completed') Object.assign(env, { status: env.status === 'completed' || forged ? 'sent' : env.status, completedAt: null, signedDocId: null, sha256Signed: null });
      if (r && r.id && !env.requestId) env.requestId = r.id;
      ws.envelopes.push(env);
    }
    const files = sub.files && typeof sub.files === 'object' ? sub.files : {};
    for (const id of Object.keys(files)) {
      if (!/^[\w.-]{1,120}$/.test(id) || typeof files[id] !== 'string') continue;
      try {
        if (NS.ops && NS.ops.files) await NS.ops.files.put(id, b64Blob(files[id], 'application/pdf'));
      } catch (e) {
        /* a file that cannot be stored is listed as missing where it is used */
      }
    }
    ws.docs = ws.docs || [];
    (Array.isArray(sub.docs) ? sub.docs : []).forEach((d) => {
      if (d && d.id && !ws.docs.some((x) => x.id === d.id)) ws.docs.push(clone(d));
    });
    (Array.isArray(sub.audit) ? sub.audit : []).forEach((a) => {
      if (!a || !a.action) return;
      NS.audit.log(ws, { at: a.at || undefined, actor: a.actor || `${inv.title} (investor)`, action: String(a.action), detail: `${a.detail ? String(a.detail) + ' ' : ''}(from the investor's device)`, fund: a.fund || it.offeringId || '', record: a.record || inv.id });
    });
    (Array.isArray(sub.notifications) ? sub.notifications : []).forEach((n) => {
      if (n && n.title) notes(ws).push({ id: uid('ntf'), at: n.at || new Date().toISOString(), kind: n.kind || 'invite_progress', title: String(n.title), detail: String(n.detail || ''), route: safeRoute(n.route), read: false });
    });
    Object.assign(it, { status: 'completed', completedAt: sub.completedAt || it.completedAt || new Date().toISOString(), stepKey: 'done', stepLabel: 'Done', stepIndex: it.stepCount || it.stepIndex });
    await reconfirm(ws, inv, it);
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
      const on = /^\d{4}-\d{2}-\d{2}$/.test(String(a.verifiedAt || '')) ? a.verifiedAt : today();
      Object.assign(a, { status: 'verified', verifiedAt: on, expiresAt: NS.dates.addMonths(on, 12) });
      delete a.reportedStatus;
      delete a.note;
      done.push('self-certified accreditation accepted (no third-party verification is required for this offering)');
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
            audit(ws, 'Onboarding imported', `${x.inv ? x.inv.title : it.investorId}: records from the investor's device added to the portal (${x.text}); the copy on the integration server is deleted`, it.offeringId, it.investorId);
            notify(ws, 'onboarding_completed', `${x.inv ? x.inv.title : 'An investor'} finished onboarding`, x.text, x.route);
            n++;
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
      const gate = IV().subscribeGate(ws, inv, o);
      const st = IV().status(ws, inv);
      if (gate || st.key !== 'approved') {
        if (!r.waitingFor) {
          r.waitingFor = st.key === 'review' ? 'verification held for review' : st.key === 'rejected' ? 'verification not approved' : gate && gate.action === 'accreditation' ? 'accreditation verification' : 'verification';
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
  const statusOf = (it) => (unsent(it) ? ['warn', 'Not sent yet'] : STATUS[it.status] || ['mute', it.status]);
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
    if (it.status === 'in_progress' && it.stepCount) return h(stepText(it));
    if (unsent(it)) return it.emailStatus === 'failed' ? 'Invitation not sent: the email failed' : 'Invitation ready to send from your email app';
    return `${h(STATUS[it.status] ? STATUS[it.status][1] : it.status)}${it.status === 'sent' ? ` ${date(String(it.sentAt).slice(0, 10))}` : ''}`;
  }

  /* ---------- Console: invite form ---------- */
  function draft() {
    const u = S().ui;
    if (!u.inv8) {
      const r = raising(W());
      u.inv8 = { name: '', email: '', type: 'individual', account: '', offeringId: r.length === 1 ? r[0].id : '', amount: '', cls: '', note: '', errors: {}, busy: false };
    }
    return u.inv8;
  }
  NS.binders.inv8 = (path, v) => {
    const d = draft();
    d[path] = v;
    const k = path === 'offeringId' ? 'offering' : path;
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
    const single = `<form class="cs-form cs-grid inv8-form" data-form="invite-one" novalidate>
      <label class="cs-field" for="iv-contact"><span>Full name</span><input id="iv-contact" name="contact" maxlength="80" autocomplete="off" data-bind="inv8:name" value="${h(d.name)}"${inval(d, 'name')}>${fieldErr(d, 'name')}</label>
      <label class="cs-field" for="iv-email"><span>Email</span><input id="iv-email" name="email" type="email" maxlength="120" autocomplete="off" data-bind="inv8:email" value="${h(d.email)}"${inval(d, 'email')}>${fieldErr(d, 'email')}</label>
      <label class="cs-field" for="iv-type"><span>Investing as</span><select id="iv-type" name="type" data-bind="inv8:type">${Object.keys(NS.ENTITY_TYPES).map((k) => `<option value="${k}"${d.type === k ? ' selected' : ''}>${h(NS.ENTITY_TYPES[k].label)}</option>`).join('')}</select></label>
      <label class="cs-field" for="iv-title"><span>Account name <em>Optional</em></span><input id="iv-title" name="title" maxlength="120" autocomplete="off" placeholder="Defaults to the full name" data-bind="inv8:account" value="${h(d.account)}"><span class="cs-hint">For a trust, company or IRA, its legal name. The investor can correct it.</span></label>
      <label class="cs-field" for="iv-off"><span>Offering <em>Optional</em></span><select id="iv-off" name="offering" data-bind="inv8:offeringId"${inval(d, 'offering')}><option value=""${!off ? ' selected' : ''}>No offering: account only</option>${offs.map((o) => `<option value="${h(o.id)}"${off && off.id === o.id ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select>${offs.length ? '' : '<span class="cs-hint">No offering is raising. The investor sets up their account and can subscribe later.</span>'}${fieldErr(d, 'offering')}</label>
      <label class="cs-field" for="iv-amt"><span>Commitment (${cur === 'USD' ? '$' : h(cur)}) <em>Optional</em></span><input id="iv-amt" name="amount" type="number" min="0" step="1000" inputmode="decimal" data-bind="inv8:amount" value="${h(d.amount)}"${off ? '' : ' disabled'}${inval(d, 'amount')}><span class="cs-hint">${off ? `Minimum ${h(money(off, min))}. Leave blank for the investor to choose; if you set it, they cannot change it.` : 'Choose an offering to set a commitment.'}</span>${fieldErr(d, 'amount')}</label>
      ${classes.length > 1 ? `<label class="cs-field" for="iv-cls"><span>Share class</span><select id="iv-cls" name="cls" data-bind="inv8:cls"${inval(d, 'cls')}><option value="">Investor chooses</option>${classes.map((c) => `<option value="${h(c.id)}"${d.cls === c.id ? ' selected' : ''}>${h(c.name)}${Number(c.minimum) ? `, minimum ${h(money(off, Math.round(Number(c.minimum) * 100)))}` : ''}</option>`).join('')}</select>${fieldErr(d, 'cls')}</label>` : ''}
      <label class="cs-field cs-wide" for="iv-note"><span>Personal note <em>Optional</em></span><textarea id="iv-note" name="note" rows="3" maxlength="2000" data-bind="inv8:note">${h(d.note)}</textarea><span class="cs-hint">Shown in the email and on the investor’s welcome page.</span></label>
      <p class="cs-error cs-wide" id="iv-error" role="alert"${Object.keys(d.errors).length ? '' : ' hidden'}>${Object.keys(d.errors).length ? 'Check the highlighted fields.' : ''}</p>
      <div class="cs-row cs-wide"><button class="cs-btn cs-btn-primary" type="submit"${d.busy ? ' disabled aria-busy="true"' : ''}>${d.busy ? 'Sending…' : 'Send invitation'}</button></div>
    </form>`;
    const ui = S().ui;
    const bulk = `<form class="cs-form" data-form="invite-bulk" novalidate>
      <label class="cs-field" for="iv-csv"><span>Paste a list: name, email, offering, commitment</span><textarea id="iv-csv" name="csv" rows="6" spellcheck="false" placeholder="name,email,offering,commitment&#10;Anita Shah,anita.shah@example.com,${h(offs[0] ? offs[0].shortName || offs[0].name : 'Fund I')},100000&#10;Ravi Patel,ravi.patel@example.com">${h(ui.bulkText || '')}</textarea><span class="cs-hint">One investor per line. Offering and commitment are optional; the offering can be its short name or full name. Add a fifth column to say how they invest (individual, joint, trust, entity or IRA); otherwise they start as individuals and can change it.</span></label>
      ${ui.bulkResult || ''}
      <div class="cs-row"><button class="cs-btn" type="submit">Check list</button>${ui.bulkRows && ui.bulkRows.length ? `<button class="cs-btn cs-btn-primary" type="button" data-action="invite-bulk-add"${ui.bulkBusy ? ' disabled aria-busy="true"' : ''}>${ui.bulkBusy ? 'Sending…' : `Send ${ui.bulkRows.length} invitation${ui.bulkRows.length === 1 ? '' : 's'}`}</button>` : ''}</div>
    </form>`;
    const srvUrl = serverOn(w) ? IV().serverUrl(w) : '';
    const pin = srvUrl && NS.app.publishedServer && !NS.app.publishedServer(srvUrl) ? ` Investors’ links open only on a portal page that lists this server: where you publish the portal, add <code>window.CVPortalConfig = { integrationServers: ['${h(srvUrl)}'] }</code> before its scripts. Until then their links open only in this browser.` : '';
    const how = serverOn(w)
      ? `Your integration server emails each investor from ${h(w.tenant.name)}, with replies going to ${h(w.tenant.support.email)}. You get a notification when they finish.${pin}`
      : `No integration server is connected, so you send the email from your own email app: the portal prepares it with the link. ${NS.app.can('configure') ? '<a href="#console-integrations">Connect your integration server</a>' : 'An admin can connect your integration server'} to send invitations automatically and let investors onboard on any device.`;
    return CK().panel(
      'Invite an investor',
      `<p class="cs-hint inv8-lede">Enter the basics. The investor gets one link that walks them through everything: their login, investor information, identity and sanctions checks, accreditation, tax certification, bank details and the subscription documents. They are added to the portal as they go.</p>
      <div class="cs-tabs cs-tabs-inline" role="group" aria-label="Invite method"><button type="button" class="cs-tab" data-action="invite-tab" data-t="single" aria-pressed="${tab === 'single'}">One investor</button><button type="button" class="cs-tab" data-action="invite-tab" data-t="bulk" aria-pressed="${tab === 'bulk'}">Import a list</button></div>
      ${tab === 'single' ? single : bulk}
      <p class="cs-hint">${how}</p>`
    );
  }
  function readForm(f) {
    const v = (n) => (f.elements[n] ? String(f.elements[n].value || '') : '');
    return { name: v('contact').trim(), email: v('email').trim(), type: v('type') || 'individual', account: v('title').trim(), offeringId: v('offering'), amount: v('amount').trim(), cls: v('cls'), note: v('note').trim() };
  }
  async function submitInvite(f) {
    const w = W();
    const d = draft();
    if (d.busy) return;
    const x = readForm(f);
    Object.assign(d, x);
    const dollars = x.amount === '' ? '' : Number(x.amount.replace(/[$,\s]/g, ''));
    const cents = dollars === '' ? '' : isFinite(dollars) ? Math.round(dollars * 100) : NaN;
    const e = validate(w, { name: x.name, email: x.email, offeringId: x.offeringId, cents: cents === '' ? '' : cents, cls: x.cls });
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

  /* ---------- Console: importing a list ---------- */
  function csvCells(line) {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === '\t') {
        out.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  const TYPE_WORDS = { individual: 'individual', joint: 'joint', trust: 'trust', entity: 'entity', company: 'entity', llc: 'entity', corporation: 'entity', partnership: 'entity', ira: 'ira' };
  function parseBulk(text) {
    const w = W();
    const rows = [];
    const errors = [];
    const seen = {};
    String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .forEach((line, idx) => {
        if (!line) return;
        const cells = csvCells(line);
        if (idx === 0 && /^(full )?name$/i.test(cells[0])) return;
        const [name, email, offName, amt, typ] = cells;
        const o = offName ? w.offerings.find((x) => [x.id, x.shortName, x.name].some((n) => n && n.toLowerCase() === offName.toLowerCase())) : null;
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
        else {
          const e = validate(w, { name, email, offeringId: o ? o.id : '', cents: Math.round(dollars * 100) });
          why = e.email ? (/already/.test(e.email) ? `${email} is already in the portal` : e.email) : e.amount || e.offering || '';
        }
        if (why) errors.push(`Line ${idx + 1}: ${why}`);
        else {
          seen[email.toLowerCase()] = true;
          rows.push({ name, email, offeringId: o ? o.id : '', offeringName: o ? o.shortName || o.name : '', cents: Math.round(dollars * 100), type });
        }
      });
    return { rows, errors };
  }
  const baseBulk = NS.forms['invite-bulk'];
  NS.forms['invite-bulk'] = function (f) {
    if (!E.diy) return baseBulk && baseBulk.apply(this, arguments);
    const ui = S().ui;
    ui.bulkText = f.elements.csv.value;
    const { rows, errors } = parseBulk(ui.bulkText);
    const w = W();
    ui.bulkRows = rows;
    ui.bulkResult = `<div class="cs-bulk">${rows.length ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Offering</th><th scope="col" class="num">Commitment</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${h(r.name)}${r.type !== 'individual' ? `<span class="sub">${h(NS.ENTITY_TYPES[r.type].label)}</span>` : ''}</td><td>${h(r.email)}</td><td>${r.offeringName ? h(r.offeringName) : '<span class="cs-muted">Account only</span>'}</td><td class="num">${r.cents ? h(money(offOf(w, r.offeringId), r.cents)) : '<span class="cs-muted">Investor chooses</span>'}</td></tr>`)
      .join('')}</tbody></table></div>` : ''}${errors.length ? `<ul class="cs-errors">${errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>` : ''}${!rows.length && !errors.length ? '<p class="cs-muted">No rows found.</p>' : ''}</div>`;
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
    Object.assign(ui, { bulkBusy: false, bulkRows: null, bulkResult: '', bulkText: '', inviteOpen: false, inv8Filter: 'open' });
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
          ? `${h(inv.contact)} finished onboarding${it.completedAt ? ` on ${h(date(String(it.completedAt).slice(0, 10), 'long'))}` : ''}. The link now opens their summary only.`
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
    U.toast(check.error ? `Could not check: ${check.error}` : n ? `${n} finished onboarding${n === 1 ? '' : 's'} added to the portal.` : 'Checked. Nothing new.');
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
    if (it && it.status === 'completed') return U.toast(`${(invOf(W(), it.investorId) || {}).contact || 'The investor'} already finished onboarding.`);
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
          <td>${badge(st[0], st[1])}<span class="sub inv8-step">${h(x ? x.text : stepText(it))}</span>${it.waitingFor ? `<span class="sub">${h(it.waitingFor)}</span>` : ''}</td>
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
    const finished = list(ws).filter((it) => it.status === 'completed').map((it) => outcome(ws, it)).filter((x) => waitingCountersign(x.env));
    if (finished.length) out.push(`<li><a href="#${finished.length === 1 ? `console-envelope-${h(finished[0].env.id)}` : 'console-esign'}">${finished.length === 1 ? `${h(finished[0].inv ? finished[0].inv.title : 'An investor')} finished onboarding; their subscription agreement is` : `${finished.length} investors finished onboarding; their subscription agreements are`} waiting for your countersignature</a></li>`);
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
      if (n) U.toast(`${n} finished onboarding${n === 1 ? '' : 's'} added to the portal.`);
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
    rules
  };
})(window.CVPortal);
