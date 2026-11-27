/*
 * The firm's emails: one template set for the browser and the integration server (plan 13-01, EM-01).
 *
 * Every message a sponsor's investors or the sponsor's team receive is written here, once: the console's previews and
 * the server's outbox say the same words. The file works on plain data only. It touches no page, storage, network or
 * clock when it loads, so it also loads in Node (module.exports), as formd.js does.
 *
 *   render(kind, data, opts)   { kind, variant, subject, preheader, text, html, inline: [ { cid, contentType, base64 } ],
 *                              commercial: false, headers: {} }. opts.preview: the logo is an <img> with its data URL and
 *                              inline is empty (in-page previews); otherwise a PNG, JPEG or GIF logo is cid:logo@firm with
 *                              one inline part, and any other logo gives the firm's name in text. No attachment, ever.
 *   KINDS[kind]                { audience: 'investor' | 'sponsor' | 'staff', label, variants, sample(variant) }
 *   givenName, greeting, expirySentence, supportSentence, senderLine, contrastText, money, longDate
 *   PATTERNS, screen(text)     what a message may never carry (taxpayer numbers, long digit runs, passwords) and the one
 *                              sentence that says what to remove
 *   BANNED                     names and words no message may contain
 *   SIMULATED, redactLink(text, link), log(ws, entry)
 *
 * firm: { name, shortName, legalName, supportTeam, supportEmail, supportPhone, colors: { primary, accent }, logo,
 * portalName, disclaimer, postalAddress }. Message data never has a field for a taxpayer, bank or account number.
 */
(function (NS) {
  'use strict';

  /* ---------- Small helpers ---------- */
  const str = (s) => String(s === undefined || s === null ? '' : s);
  const esc = (s) => str(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const oneLine = (s) => str(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(str(c)) ? c : /^#[0-9a-f]{3}$/i.test(str(c)) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : '');
  const EMAIL = /^[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[^\s@<>()[\]"',;:]+$/;
  const isEmail = (s) => EMAIL.test(str(s));

  function money(cents, currency) {
    const n = Math.round(Number(cents) || 0) / 100;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
    } catch (e) {
      return `${currency || 'USD'} ${n.toLocaleString('en-US')}`;
    }
  }
  function longDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  /* ---------- Colour (the WCAG 2 luminance and contrast of assets/js/brand.js) ---------- */
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  function luminance(h) {
    const n = hex(h) || '#000000';
    const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(n.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const INK = '#1B1F24';
  /** The button's text colour: white or the ink, whichever stands out more against the firm's colour. */
  const contrastText = (bg) => (contrast('#FFFFFF', bg) >= contrast(INK, bg) ? '#FFFFFF' : INK);

  /* ---------- The shared sentences (EM-02) ---------- */
  /** "Anita Shah" or "Shah, Anita": the given name, without stray punctuation ('' when there is none). */
  function givenName(full) {
    const f = str(full).trim();
    const given = f.indexOf(',') > 0 ? f.split(',').slice(1).join(' ').trim() || f : f;
    return given.split(/\s+/)[0].replace(/[^\p{L}\p{M}'’.-]/gu, '');
  }
  function greeting(full) {
    const g = givenName(full);
    return g ? `Dear ${g},` : 'Hello,';
  }
  function expirySentence(iso) {
    const d = longDate(iso);
    return `This link is personal to you; please do not forward it.${d ? ` It expires on ${d}.` : ''}`;
  }
  function supportSentence(firm) {
    const f = firm || {};
    const email = isEmail(f.supportEmail) ? f.supportEmail : '';
    const phone = oneLine(f.supportPhone);
    return `Questions? Contact ${oneLine(f.supportTeam) || oneLine(f.name)}${email ? ` at ${email}` : ''}${phone ? `${email ? ' or' : ' at'} ${phone}` : ''}.`;
  }
  /** Who the message comes from: "<sender> at <firm>" when a person is named and is not the support team, else the firm. */
  function senderLine(firm, invitation) {
    const who = oneLine(invitation && invitation.senderName);
    return who && who !== oneLine(firm.supportTeam) && who !== oneLine(firm.name) ? `${who} at ${firm.name}` : firm.name;
  }

  /* ---------- What a message may never carry (EM-04) ---------- */
  /** Taxpayer-number shapes (two-seven, three-two-four) and runs of 8 or more digits: server/lib/help.mjs NUMBERS; passwords. */
  const PATTERNS = [/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/, /\bpass(word|code)?\s*[:=]/i];
  const TAX_NUMBER = 'Remove the taxpayer number: emails never carry tax numbers.';
  const LONG_NUMBER = 'Remove the long number: emails never carry account or tax numbers.';
  const PASSWORD = 'Remove the password: emails never carry passwords.';
  /** null when the text may go in a message, else { reason } in one sentence. A bare nine-digit run reads as a long number. */
  function screen(text) {
    const s = str(text);
    if (PATTERNS[0].test(s)) return { reason: TAX_NUMBER };
    if (PATTERNS[2].test(s)) return { reason: LONG_NUMBER };
    if (PATTERNS[1].test(s)) return { reason: TAX_NUMBER };
    if (PATTERNS[3].test(s)) return { reason: PASSWORD };
    return null;
  }
  /** No message names the platform, a vendor or a library (white label). */
  const BANNED = [/carrow/i, /\bvale\b/i, /powered by/i, /DIY Portal/i, /amazon/i, /\baws\b/i, /\bses\b/i, /postmark/i, /sendgrid/i, /mailgun/i, /zepto/i, /zoho/i, /\bresend\b/i, /brevo/i, /smtp2go/i, /anthropic/i, /claude/i, /refract/i, /\bbasic\b/i];
  const SIMULATED = '(simulated in this demo)';

  /* ---------- The sent log ---------- */
  const STATUSES = ['simulated', 'manual', 'outbox', 'held', 'sent', 'failed', 'suppressed', 'delivered', 'bounced', 'complained'];
  const LOG_MAX = 2000;
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function redactLink(text, link) {
    const s = str(text);
    return link ? s.replace(new RegExp(reEsc(str(link)), 'g'), '[personal link]') : s;
  }
  /** Keep one message in ws.mailLog (the personal link taken out of its text). The caller saves the workspace. */
  function log(ws, entry) {
    const e = entry || {};
    if (STATUSES.indexOf(e.status) < 0) throw new Error(`Unknown mail status: ${str(e.status)}`);
    if (!Array.isArray(ws.mailLog)) ws.mailLog = [];
    const rec = {
      id: e.id || `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: e.at || new Date().toISOString(),
      kind: str(e.kind),
      subject: str(e.subject),
      to: str(e.to),
      investorId: str(e.investorId),
      status: e.status,
      text: redactLink(e.text, e.link)
    };
    ws.mailLog.push(rec);
    if (ws.mailLog.length > LOG_MAX) ws.mailLog.splice(0, ws.mailLog.length - LOG_MAX);
    return rec;
  }

  /* ---------- The shared layout (EM-03, EM-05) ---------- */
  const RASTER = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=\s]+)$/;
  const ANY_IMAGE = /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/;
  function footerParts(firm) {
    return [firm.legalName || firm.name, oneLine(firm.postalAddress), firm.disclaimer].filter(Boolean);
  }

  /**
   * Text and HTML from the same parts: { greeting, paras, note: { from, text }, rows: [[label, value]], button: { label,
   * href }, after }. The text keeps the order the server has always written (greeting, paras, note, rows, button, after,
   * footer), so the sponsor's messages are word for word what they were.
   */
  function layout(firm, subject, preheader, parts, opts) {
    const o = opts || {};
    const primary = hex(firm.colors && firm.colors.primary) || '#0F2742';
    const onPrimary = contrastText(primary);
    const brandInk = contrast(primary, '#FFFFFF') >= 4.5 ? primary : INK;
    const logoUrl = str(firm.logo);
    const raster = RASTER.exec(logoUrl);
    const inline = [];
    let logoHtml = `<span style="font-size:19px;font-weight:700;color:${brandInk}">${esc(firm.name)}</span>`;
    if (o.preview === true && ANY_IMAGE.test(logoUrl)) logoHtml = `<img src="${esc(logoUrl)}" alt="${esc(firm.name)}" height="44" style="max-height:44px;max-width:220px;border:0;display:block">`;
    else if (o.preview !== true && raster) {
      inline.push({ cid: 'logo@firm', contentType: raster[1], base64: raster[2].replace(/\s+/g, '') });
      logoHtml = `<img src="cid:logo@firm" alt="${esc(firm.name)}" height="44" style="max-height:44px;max-width:220px;border:0;display:block">`;
    }
    const foot = footerParts(firm);

    const text = [];
    if (parts.greeting) text.push(parts.greeting);
    for (const p of parts.paras || []) text.push(p);
    if (parts.note) text.push(`${parts.note.from}:\n${parts.note.text.split('\n').map((l) => `> ${l}`).join('\n')}`);
    if (parts.rows && parts.rows.length) text.push(parts.rows.map(([k, v]) => `${k}: ${oneLine(v)}`).join('\n'));
    if (parts.button) text.push(`${parts.button.label}:\n${parts.button.href}`);
    for (const p of parts.after || []) text.push(p);
    text.push(`--\n${foot.join('\n\n')}`);

    const support = isEmail(firm.supportEmail) ? firm.supportEmail : '';
    const para = (s) => {
      let h = esc(s).replace(/\n/g, '<br>');
      if (support && s === parts.support) h = h.replace(esc(support), `<a href="mailto:${esc(support)}" style="color:${brandInk}">${esc(support)}</a>`);
      return `<p style="margin:0 0 16px">${h}</p>`;
    };
    const button = parts.button
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;border-collapse:separate"><tr><td align="center" bgcolor="${primary}" style="background:${primary};border-radius:5px;height:44px;min-height:44px;padding:0"><a data-button href="${esc(parts.button.href)}" style="display:inline-block;padding:12px 24px;line-height:20px;font-size:16px;font-weight:700;color:${onPrimary};text-decoration:none;border-radius:5px">${esc(parts.button.label)}</a></td></tr></table><p style="margin:0 0 16px;font-size:13px;color:#5b6470">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${esc(parts.button.href)}</span></p>`
      : '';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;color:#1b1f24;font:16px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f4f5f7">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e5e9;border-radius:6px">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${primary}">${logoHtml}</td></tr>
<tr><td style="padding:28px">
${parts.greeting ? para(parts.greeting) : ''}${(parts.paras || []).map(para).join('')}${
      parts.note ? `<p style="margin:0 0 6px;color:#5b6470;font-size:14px">${esc(parts.note.from)}:</p><blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid ${primary};background:#f7f8fa">${esc(parts.note.text).replace(/\n/g, '<br>')}</blockquote>` : ''
    }${
      parts.rows && parts.rows.length
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px;border-collapse:collapse;font-size:15px">${parts.rows.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#5b6470;border-bottom:1px solid #eef0f2;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eef0f2;font-weight:600">${esc(oneLine(v))}</td></tr>`).join('')}</table>`
        : ''
    }${button}${(parts.after || []).map(para).join('')}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e2e5e9;font-size:12px;line-height:1.5;color:#5b6470">${foot.map((s) => `<p style="margin:0 0 8px">${esc(s).replace(/\n/g, '<br>')}</p>`).join('')}</td></tr>
</table></td></tr></table></body></html>`;
    return { subject, preheader, text: text.join('\n\n'), html, inline };
  }

  /* ---------- The investor's messages ---------- */
  const noteOf = (firm, invitation) => (invitation && invitation.note ? { from: `A note from ${invitation.senderName || firm.name}`, text: str(invitation.note) } : null);
  /** The investor's message: greeting, what is asked, the button, one expiry sentence and one support sentence. */
  function investorMessage(firm, d, subject, parts) {
    const support = supportSentence(firm);
    const after = (parts.after || []).concat([expirySentence(d.expiresAt), support]);
    const name = (d.investor && (d.investor.contact || d.investor.title)) || '';
    return layout(firm, subject, parts.preheader || (parts.paras || [])[0] || '', Object.assign({}, parts, { greeting: greeting(name), after, support }), d.opts);
  }

  /** A new investor: the invitation to invest in an offering, or to set up an investor account. */
  function newInvestor(firm, d, again) {
    const off = d.offering && d.offering.name ? d.offering : null;
    const inv = d.invitation || {};
    const rows = [];
    if (off && !again) rows.push(['Offering', off.name]);
    if (inv.cents) rows.push(['Commitment', money(inv.cents, off && off.currency)]);
    const subject = `${again ? 'New link: ' : ''}${off ? `${firm.name}: your invitation to invest in ${off.name}` : `${firm.name}: set up your investor account`}`;
    const paras = again
      ? [
          `Here is a new link to complete your investor onboarding with ${firm.name}${off ? ` for ${off.name}` : ''}. Any earlier link we sent no longer works.`,
          d.started ? 'You can pick up where you left off.' : 'It takes about 10 to 15 minutes. Have a government-issued photo ID and your bank account details ready.'
        ]
      : [
          off ? `${senderLine(firm, inv)} has invited you to invest in ${off.name} and to open your investor account.` : `${senderLine(firm, inv)} has invited you to set up your investor account.`,
          `The link below takes you through everything in one place, in about 10 to 15 minutes: your login, investor information, identity verification${off ? ', accreditation' : ''}, tax certification, where to send distributions${off ? ', and your subscription documents, which you sign online' : ''}. Your progress is saved, so you can stop and come back.`,
          'Have a government-issued photo ID and your bank account details ready.'
        ];
    return investorMessage(firm, d, subject, {
      paras,
      rows,
      note: noteOf(firm, inv),
      button: { label: again && d.started ? 'Continue your onboarding' : off ? 'Start your onboarding' : 'Set up your account', href: d.link }
    });
  }

  /** Which message an invitation is, chosen exactly as the server always has (the invitation and its re-sent link differ). */
  function invitationVariant(d, again) {
    const inv = d.invitation || {};
    const off = !!(d.offering && d.offering.name);
    if (!again) {
      if (inv.existing && inv.coSign && !off) return 'coSign';
      if (inv.existing && off) return 'subscribe';
      if (inv.existing && inv.access) return 'access';
      if (inv.existing && inv.taxRequest) return 'taxRequest';
      if (inv.existing && inv.reverify) return 'reverify';
      return 'new';
    }
    if (inv.existing && inv.coSign && !off) return 'coSign';
    if (inv.existing && inv.access && !off) return 'access';
    if (inv.existing && inv.taxRequest && !off) return 'taxRequest';
    if (inv.existing && inv.reverify && !off) return 'reverify';
    if (inv.existing && off) return 'subscribe';
    return 'new';
  }
  const INVESTOR_BUILDERS = { new: newInvestor };

  /* ---------- Sample data (previews, goldens) ---------- */
  const SAMPLE_FIRM = {
    name: 'Harbor Ridge Capital',
    shortName: 'Harbor Ridge',
    legalName: 'Harbor Ridge Capital Management LLC',
    supportTeam: 'Investor Relations',
    supportEmail: 'ir@harborridge.example',
    supportPhone: '+1 212 555 0100',
    colors: { primary: '#123456', accent: '#1F7A8C' },
    logo: '',
    portalName: 'Harbor Ridge Investor Portal',
    disclaimer: 'This message is not an offer to sell securities.'
  };
  const SAMPLE_LINK = 'https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#invite-sample';
  const SENT = '2026-11-10T12:00:00.000Z';
  const EXPIRES = '2026-12-10T12:00:00.000Z';
  const ANITA = { id: 'HRC-0101', contact: 'Shah, Anita', title: 'Anita Shah', type: 'individual', email: 'anita@investor.example' };
  const FUND = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', currency: 'USD' };
  const copy = (x) => JSON.parse(JSON.stringify(x));
  function invitationSample(variant) {
    const base = { firm: copy(SAMPLE_FIRM), investor: copy(ANITA), offering: copy(FUND), invitation: { cents: 25000000, cls: '', note: '', senderName: '' }, link: SAMPLE_LINK, expiresAt: EXPIRES };
    if (variant === 'new-account') Object.assign(base, { offering: null, invitation: { cents: 0, cls: '', note: '', senderName: '' } });
    return base;
  }

  const KINDS = {
    invitation: { audience: 'investor', label: 'Invitation', variants: ['new-offering', 'new-account'], sample: invitationSample }
  };

  /* ---------- render ---------- */
  function render(kind, data, opts) {
    const d = Object.assign({}, data || {}, { opts: opts || {} });
    const firm = d.firm || {};
    let variant;
    let out;
    if (kind === 'invitation' || kind === 'invitation_resent') {
      const again = kind === 'invitation_resent';
      variant = invitationVariant(d, again);
      const build = INVESTOR_BUILDERS[variant];
      if (!build) throw new Error(`No message for ${kind} ${variant}`);
      out = build(firm, d, again);
    } else throw new Error(`Unknown message kind: ${str(kind)}`);
    return { kind, variant, subject: out.subject, preheader: out.preheader, text: out.text, html: out.html, inline: out.inline, commercial: false, headers: {} };
  }

  const API = { KINDS, render, givenName, greeting, expirySentence, supportSentence, senderLine, screen, PATTERNS, contrastText, contrast, SIMULATED, BANNED, STATUSES, redactLink, log, money, longDate, esc };
  if (NS) NS.emails = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
