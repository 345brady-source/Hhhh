/*
 * The firm's emails: one template set for the browser and the integration server (plan 13-01, EM-01).
 *
 * Every message a sponsor's investors or the sponsor's team receive is written here, once: the console's previews and
 * the server's outbox say the same words. The file works on plain data only. It touches no page, storage, network or
 * clock when it loads, so it also loads in Node (module.exports), as formd.js does.
 *
 *   render(kind, data, opts)   { kind, variant, subject, preheader, text, html, inline: [ { cid, contentType, base64 } ],
 *                              commercial, headers, needs }. opts.preview: the logo is an <img> with its data URL and
 *                              inline is empty (in-page previews); otherwise a PNG, JPEG or GIF logo is cid:logo@firm with
 *                              one inline part, and any other logo gives the firm's name in text. No attachment, ever.
 *                              A possibly commercial message (C-02, "To be confirmed with counsel") ends with the firm's
 *                              postal address and a way to stop such messages (List-Unsubscribe headers when
 *                              data.unsubscribeUrl is given); needs is ['postalAddress'] when the firm has none.
 *                              Kinds with named variants (13-11) take data.variant, else their first variant.
 *   KINDS[kind]                { audience: 'investor' | 'sponsor' | 'team' | 'staff', label, variants, sample(variant) }
 *   firmFromTenant, prefsAllow, applyPrefs, dispatch, summary   the console's one hand-off to the server (13-11):
 *                              dispatch({ ws, kind, variant, items, connected, api, firm, portalUrl, offeringNews })
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
  // A plain address (server/lib/mail.mjs ADDRESS, without '&' and '?' in the local part): a support address that is not
  // one is never printed or linked, so it cannot carry extra recipients or a subject into a mailto link.
  const EMAIL = /^[A-Za-z0-9.!#$%'*+/=^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  const isEmail = (s) => str(s).length <= 254 && EMAIL.test(str(s));

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
  /**
   * No message names the platform, a vendor or a library (white label). The model maker's names are banned as well, but
   * no shipped file may spell them, so the server's tests hold those two (server/test/emails-guard.test.mjs MODEL_NAMES).
   */
  const BANNED = [/carrow/i, /\bvale\b/i, /powered by/i, /DIY Portal/i, /amazon/i, /\baws\b/i, /\bses\b/i, /postmark/i, /sendgrid/i, /mailgun/i, /zepto/i, /zoho/i, /\bresend\b/i, /brevo/i, /smtp2go/i, /refract/i, /\bbasic\b/i];
  const SIMULATED = '(simulated in this demo)';

  /* ---------- The sent log ---------- */
  const STATUSES = ['simulated', 'manual', 'outbox', 'held', 'sent', 'failed', 'suppressed', 'unsubscribed', 'delivered', 'bounced', 'complained'];
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
   * Text and HTML from the same parts: { greeting, paras, note: { from, text }, rows: [[label, value]], before, button:
   * { label, href }, after }, in that order, then the footer. The sponsor's messages have no greeting and no before, so
   * their text is word for word what the server has always written.
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
    // A possibly commercial message (C-02) ends with the way to stop such messages; its link, when there is one, is a link.
    const stop = o.stop || null;
    const foot = footerParts(firm).concat(stop ? [stop.line] : []);
    const footHtml = (s) => {
      const h = esc(s).replace(/\n/g, '<br>');
      return stop && stop.url && s === stop.line ? h.replace(esc(stop.url), `<a href="${esc(stop.url)}" style="color:#5b6470">${esc(stop.url)}</a>`) : h;
    };

    const text = [];
    if (parts.greeting) text.push(parts.greeting);
    for (const p of parts.paras || []) text.push(p);
    if (parts.note) text.push(`${parts.note.from}:\n${parts.note.text.split('\n').map((l) => `> ${l}`).join('\n')}`);
    if (parts.rows && parts.rows.length) text.push(parts.rows.map(([k, v]) => `${k}: ${oneLine(v)}`).join('\n'));
    for (const p of parts.before || []) text.push(p);
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
    }${(parts.before || []).map(para).join('')}${button}${(parts.after || []).map(para).join('')}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e2e5e9;font-size:12px;line-height:1.5;color:#5b6470">${foot.map((s) => `<p style="margin:0 0 8px">${footHtml(s)}</p>`).join('')}</td></tr>
</table></td></tr></table></body></html>`;
    return { subject, preheader, text: text.join('\n\n'), html, inline };
  }

  /* ---------- The investor's messages (EM-02) ---------- */
  const noteOf = (firm, invitation) => (invitation && invitation.note ? { from: `A note from ${invitation.senderName || firm.name}`, text: str(invitation.note) } : null);
  /** The official form a tax-form request is for, by the investor type the sponsor chose. */
  const taxFormOf = (investor) => ({ 'foreign-individual': 'W-8BEN', 'foreign-entity': 'W-8BEN-E' })[investor && investor.taxType] || 'W-9';
  /** The investor's message: greeting, what is asked, the button, one expiry sentence and one support sentence. */
  function investorMessage(firm, d, again, subject, parts) {
    const support = supportSentence(firm);
    const after = (parts.after || []).concat([expirySentence(d.expiresAt), support]);
    const name = (d.investor && (d.investor.contact || d.investor.title)) || '';
    const full = `${again ? 'New link: ' : ''}${subject}`;
    return layout(firm, full, (parts.paras || [])[0] || '', Object.assign({}, parts, { greeting: greeting(name), after, support, note: noteOf(firm, d.invitation) }), d.opts);
  }
  const again1 = (again, fresh, renewed) => (again ? renewed : fresh);

  const INVESTOR = {
    /** A new investor: the invitation to invest in an offering, or to set up an investor account. */
    new(firm, d, again) {
      const off = d.offering && d.offering.name ? d.offering : null;
      const inv = d.invitation || {};
      const rows = [];
      if (off && !again) rows.push(['Offering', off.name]);
      if (inv.cents) rows.push(['Commitment', money(inv.cents, off && off.currency)]);
      const steps = ['your login', 'investor information', 'identity verification'].concat(off ? ['accreditation'] : [], ['tax certification', 'where to send distributions'], off ? ['your subscription documents, which you sign online'] : []);
      return investorMessage(firm, d, again, off ? `${firm.name}: your invitation to invest in ${off.name}` : `${firm.name}: set up your investor account`, {
        paras: [
          again
            ? `Here is a new link to complete your investor onboarding with ${firm.name}${off ? ` for ${off.name}` : ''}. Any earlier link we sent no longer works.`
            : off
              ? `${senderLine(firm, inv)} has invited you to invest in ${off.name} and to open your investor account.`
              : `${senderLine(firm, inv)} has invited you to set up your investor account.`
        ],
        rows,
        before: again
          ? [d.started ? 'You can pick up where you left off.' : 'It takes about 10 to 15 minutes. Have a government-issued photo ID and your bank account details ready.']
          : [
              `The link below takes you through everything in one place, in about 10 to 15 minutes: ${steps.slice(0, -1).join(', ')}, and ${steps[steps.length - 1]}. Your progress is saved, so you can stop and come back.`,
              'Have a government-issued photo ID and your bank account details ready.'
            ],
        button: { label: again && d.started ? 'Continue your onboarding' : off ? 'Start your onboarding' : 'Set up your account', href: d.link }
      });
    },
    /** An investor already on file, invited to subscribe to another offering: no ID or bank details needed. */
    subscribe(firm, d, again) {
      const off = d.offering;
      const inv = d.invitation || {};
      const rows = again ? [] : [['Offering', off.name]];
      if (inv.cents) rows.push(['Commitment', money(inv.cents, off.currency)]);
      return investorMessage(firm, d, again, `${firm.name}: your subscription to ${off.name}`, {
        paras: [again ? `Here is a new link to your subscription to ${off.name} with ${firm.name}. Any earlier link we sent no longer works.` : `${senderLine(firm, inv)} has invited you to subscribe to ${off.name}.`],
        rows,
        before: [
          again
            ? d.started
              ? 'You can pick up where you left off.'
              : 'It takes about 5 minutes. Your account details are already on file.'
            : `The link below takes you through your subscription in one place: the offering documents, ${inv.includeTax ? 'your tax form, ' : ''}your commitment and the subscription agreement, which you sign online. Your account details are already on file. It takes about 5 minutes.`
        ],
        button: { label: again && d.started ? 'Continue your subscription' : 'Review and subscribe', href: d.link }
      });
    },
    /** An investor the firm added from paper documents: a link to open their portal. Nothing to fill in. */
    access(firm, d, again) {
      return investorMessage(firm, d, again, `${firm.name}: your investor portal`, {
        paras: [
          again1(again, `${senderLine(firm, d.invitation)} has set up your investor portal.`, `Here is a new link to your investor portal with ${firm.name}. Any earlier link we sent no longer works.`)
        ],
        before: [
          'Your account is already set up from the documents you completed with us, so there is nothing to fill in. The link below lets you create your login and opens your portal, where you will find your investments, statements and documents.'
        ],
        button: { label: 'Open your portal', href: d.link }
      });
    },
    /** An investor already on file asked to complete their tax form again: that form only, nothing else asked. */
    taxRequest(firm, d, again) {
      const form = `Form ${taxFormOf(d.investor)}`;
      return investorMessage(firm, d, again, `${firm.name}: your ${form}`, {
        paras: [
          again1(again, `${senderLine(firm, d.invitation)} asks you to complete your ${form}.`, `Here is a new link to complete your ${form} for ${firm.name}. Any earlier link we sent no longer works.`)
        ],
        before: [
          `The link below opens your ${form}, filled in from the details we hold. You check it and sign it online, or upload a completed form instead. Nothing else is asked.`
        ],
        button: { label: 'Complete your tax form', href: d.link }
      });
    },
    /** An investor already on file asked to verify their accredited investor status again: that step only. */
    reverify(firm, d, again) {
      return investorMessage(firm, d, again, `${firm.name}: verify your accredited investor status`, {
        paras: [
          again1(again, `${senderLine(firm, d.invitation)} asks you to verify your accredited investor status again.`, `Here is a new link to verify your accredited investor status for ${firm.name}. Any earlier link we sent no longer works.`)
        ],
        before: [
          'The link below opens the accreditation step only: you verify your status online. Nothing else is asked.'
        ],
        button: { label: 'Verify your accreditation', href: d.link }
      });
    },
    /** The co-investor of an account on file asked to sign that account's agreement (investor.contact the co-investor, investor.title the account). */
    coSign(firm, d, again) {
      const account = (d.investor && (d.investor.title || d.investor.contact)) || 'your account';
      return investorMessage(firm, d, again, `${firm.name}: sign the subscription agreement for ${account}`, {
        paras: [
          again1(again, `${senderLine(firm, d.invitation)} asks you to sign the subscription agreement for ${account} as co-investor.`, `Here is a new link to sign the subscription agreement for ${account} as co-investor. Any earlier link we sent no longer works.`)
        ],
        before: [
          'The link below opens the agreement with only your places to sign. Nothing else is asked.'
        ],
        button: { label: 'Review and sign', href: d.link }
      });
    }
  };

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

  /* ---------- The sponsor's messages: word for word what the server has always written ---------- */
  const consoleButton = (d) => (d.consoleUrl ? { label: 'Open the console', href: d.consoleUrl } : null);
  function sponsorMessage(firm, d, subject, parts) {
    return layout(firm, subject, (parts.paras || [])[0] || subject, Object.assign({ button: consoleButton(d) }, parts), d.opts);
  }

  /** To the sponsor: who finished, the offering and commitment, verification and agreement status, and a link to the console. */
  function notificationVariant(d) {
    const s = d.summary || {};
    if (s.access) return 'access';
    if (s.coSign) return 'coSign';
    if (s.taxRequest) return 'taxRequest';
    if (s.reverify) return 'reverify';
    if (s.existing && s.requested === false) return 'none';
    return s.existing ? 'subscription' : 'onboarding';
  }
  function notification(firm, d, variant) {
    const investor = d.investor || {};
    const offering = d.offering;
    const summary = d.summary;
    const who = investor.contact || investor.title || 'An investor';
    const on = longDate(d.completedAt);
    const off = offering && offering.name ? offering.name : '';
    if (variant === 'access') {
      return sponsorMessage(firm, d, `${who} opened their investor portal`, { paras: [`${who} used the portal link you sent and created their login on ${on}.`], rows: summary.rows, after: [summary.next] });
    }
    if (variant === 'coSign') {
      const account = summary.account || investor.title || who;
      return sponsorMessage(firm, d, summary.coSigned ? `${who} signed the subscription agreement for ${account}` : `${who} did not sign the subscription agreement for ${account}`, {
        paras: [`${who}, co-investor on ${account}, went through your request to sign the subscription agreement on ${on}.`],
        rows: summary.rows,
        after: [summary.next, 'Nothing else in the account’s investor record changes.']
      });
    }
    if (variant === 'taxRequest') {
      const form = `Form ${summary.taxForm || taxFormOf(investor)}`;
      const back = summary.taxState === 'signed' || summary.taxState === 'uploaded';
      return sponsorMessage(firm, d, back ? `${who} returned their ${form}` : summary.taxState === 'not signed' ? `${who} finished your tax form request without signing` : `${who} finished your tax form request without a form`, {
        paras: [`${who} went through your request for their ${form} on ${on}.`],
        rows: summary.rows,
        after: [summary.next, 'Nothing else in their investor record changes.']
      });
    }
    if (variant === 'reverify') {
      return sponsorMessage(firm, d, summary.reverified ? `${who} verified their accreditation again` : `${who} finished your re-verification request`, {
        paras: [`${who} went through your request to verify their accreditation again on ${on}.`],
        rows: summary.rows,
        after: [summary.next, 'Nothing else in their investor record changes.']
      });
    }
    // An investor on file who reached the end without subscribing (the offering stopped accepting subscriptions first).
    const none = variant === 'none';
    const existing = variant === 'subscription' || none;
    const subject = none ? `${who}: no subscription${off ? ` to ${off}` : ''}` : existing ? `${who} finished their subscription${off ? ` to ${off}` : ''}` : `${who} finished onboarding${off ? ` for ${off}` : ''}`;
    return sponsorMessage(firm, d, subject, {
      paras: [
        none
          ? `${who} went through your invitation on ${on}, but no subscription was submitted: the offering was no longer accepting subscriptions when they reached that step.`
          : existing
            ? `${who} completed the subscription steps on ${on}.`
            : `${who} completed every onboarding step on ${on}.`
      ],
      rows: summary.rows,
      after: [
        summary.next,
        none
          ? 'Nothing is added to their investor record; the details you already hold for them stay as they are.'
          : existing
            ? `Their subscription, signed agreement${summary.includeTax ? ', tax form' : ''} and any new accreditation result are added to your investor records the next time the console is open. The details you already hold for them stay as they are.`
            : 'Their details, verification results, documents and signed agreement are added to your investor records the next time the console is open.'
      ]
    });
  }

  /**
   * To the sponsor, once, before a finished onboarding the console never imported is deleted: open the console (it imports
   * on its own) before the date, or the investor's paperwork is gone.
   */
  function reminderVariant(d) {
    if (d.existing && d.coSign) return 'coSign';
    if (d.existing && d.taxRequest) return 'taxRequest';
    if (d.existing && d.reverify) return 'reverify';
    return d.existing ? 'subscription' : 'onboarding';
  }
  function reminder(firm, d, variant) {
    const investor = d.investor || {};
    const offering = d.offering;
    const who = investor.contact || investor.title || 'An investor';
    const rows = [['Investor', who], ['Email', investor.email]];
    if (offering && offering.name) rows.push(['Offering', offering.name]);
    rows.push(['Finished', longDate(d.completedAt)], ['Deleted on', longDate(d.deleteOn)]);
    const by = longDate(d.deleteOn);
    const on = longDate(d.completedAt);
    if (variant === 'coSign') {
      const account = investor.title || who;
      return sponsorMessage(firm, d, `Waiting in your console: ${who}’s signature for ${account}`, {
        paras: [`${who} went through your request to sign the subscription agreement for ${account} as co-investor on ${on}, but the console has not added it to your records yet.`],
        rows,
        after: [`Open the console before ${by}: it adds the co-investor’s signature as soon as it opens.`, 'After that date the signed copy is deleted from the integration server to protect it, and the co-investor would have to sign again.']
      });
    }
    if (variant === 'taxRequest') {
      return sponsorMessage(firm, d, `Waiting in your console: ${who}’s tax form`, {
        paras: [`${who} finished your request for their Form ${taxFormOf(investor)} on ${on}, but the console has not added it to your records yet.`],
        rows,
        after: [`Open the console before ${by}: it adds the form as soon as it opens.`, 'After that date the form is deleted from the integration server to protect it, and the investor would have to complete it again.']
      });
    }
    if (variant === 'reverify') {
      return sponsorMessage(firm, d, `Waiting in your console: ${who}’s re-verification`, {
        paras: [`${who} finished your request to verify their accreditation again on ${on}, but the console has not added the result to your records yet.`],
        rows,
        after: [`Open the console before ${by}: it adds the result as soon as it opens.`, 'After that date the result is deleted from the integration server to protect it, and the investor would have to verify again.']
      });
    }
    if (variant === 'subscription') {
      return sponsorMessage(firm, d, `Waiting in your console: ${who}’s subscription`, {
        paras: [`${who} finished their subscription${offering && offering.name ? ` to ${offering.name}` : ''} on ${on}, but the console has not added it to your records yet.`],
        rows,
        after: [
          `Open the console before ${by}: it adds the subscription, the signed agreement and any new accreditation result as soon as it opens.`,
          'After that date the submitted subscription and signed documents are deleted from the integration server to protect them, and the investor would have to submit their subscription again.'
        ]
      });
    }
    return sponsorMessage(firm, d, `Waiting in your console: ${who}’s onboarding`, {
      paras: [`${who} finished onboarding on ${on}, but the console has not added them to your investor records yet.`],
      rows,
      after: [
        `Open the console before ${by}: it adds the investor, their verification results, documents and signed agreement as soon as it opens.`,
        'After that date their submitted details and signed documents are deleted from the integration server to protect them, and the investor would have to complete onboarding again.'
      ]
    });
  }

  /* ---------- The firm's notices: the sponsor's own subject and text, in the firm's layout (EM-09) ---------- */
  const STOP_NOTICES = 'To stop these notices, open Account in your portal and change your email choices.';
  const GREETING_LINE = /^(Dear|Hello|Hi)\b[^\n]*,$/;
  /** The sponsor's text as typed (merge fields already filled for this investor), one paragraph per blank line. */
  const paragraphs = (body) => str(body).replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
  const portalButton = (firm, d, signIn) => (d.portalUrl ? { label: signIn ? `Sign in to ${oneLine(firm.portalName) || 'your portal'}` : 'Activate your account', href: d.portalUrl } : null);
  /** A notice or a capital call: no greeting of its own (the sponsor's text has one), one button to the portal. */
  function sponsorText(firm, d, parts) {
    const paras = paragraphs(d.body);
    const subject = oneLine(d.subject);
    const pre = paras.filter((p) => !GREETING_LINE.test(p))[0] || subject;
    return layout(firm, subject, pre, Object.assign({ paras, button: portalButton(firm, d, d.activated !== false) }, parts), d.opts);
  }
  const NOTICE_VARIANTS = ['quarterly', 'documents', 'custom', 'offeringNews'];
  function notice(firm, d, variant) {
    return sponsorText(firm, d, { after: variant === 'quarterly' || variant === 'documents' ? [STOP_NOTICES] : [] });
  }

  /* ---------- Messages to the investor with nothing to fill in: one sentence, the portal, the support line ---------- */
  /** Greeting, what happened, one button, then the support sentence (no expiry: a portal link does not expire). */
  function portalMessage(firm, d, name, subject, parts) {
    const support = supportSentence(firm);
    const paras = parts.paras || [];
    return layout(firm, subject, paras[0] || subject, Object.assign({}, parts, { greeting: greeting(name), after: (parts.after || []).concat([support]), support }), d.opts);
  }
  const portalOpen = (d) => (d.portalUrl ? { label: 'Open your portal', href: d.portalUrl } : null);

  /** EM-10, C-09: what the firm received, what happens next, the portal. Nothing sensitive (no number, no document). */
  const CONFIRMATION_VARIANTS = ['onboarding', 'subscription', 'taxForm', 'coSign', 'reverify'];
  function confirmation(firm, d, variant) {
    const investor = d.investor || {};
    const off = d.offering && d.offering.name ? d.offering.name : '';
    const account = investor.title || investor.contact || 'your account';
    const on = longDate(d.completedAt);
    const form = `Form ${taxFormOf(investor)}`;
    const what = {
      onboarding: [`${firm.name}: we received your onboarding`, `your completed investor onboarding${off ? ` for ${off}` : ''}`],
      subscription: [`${firm.name}: we received your subscription${off ? ` to ${off}` : ''}`, `your subscription${off ? ` to ${off}` : ''} and your signed subscription agreement`],
      taxForm: [`${firm.name}: we received your ${form}`, `your ${form}`],
      coSign: [`${firm.name}: we received your signature for ${account}`, `your signature on the subscription agreement for ${account}`],
      reverify: [`${firm.name}: we received your verification`, 'your accredited investor verification']
    }[variant];
    return portalMessage(firm, d, investor.contact || investor.title, what[0], {
      paras: [`Thank you. ${firm.name} received ${what[1]}${on ? ` on ${on}` : ''}.`],
      before: [`What happens next: ${firm.name} reviews it and will contact you if anything else is needed. Nothing is due from you now.`],
      button: portalOpen(d)
    });
  }

  /** C-11 to C-15 (C-04, C-12): a notice with a portal link. The document is never attached and no signing link is sent. */
  const NOT_ATTACHED = 'The document is not attached to this email.';
  function esign(firm, d, kind) {
    const who = (d.signer && d.signer.name) || '';
    const title = oneLine(d.envelope && d.envelope.title) || 'your document';
    const M = {
      esign_request: [`${firm.name}: please sign ${title}`, `${firm.name} asks you to sign ${title}.`, `Sign in to your portal to read it and sign it online. ${NOT_ATTACHED}`],
      esign_reminder: [`${firm.name}: reminder to sign ${title}`, `${title} is still waiting for your signature.`, `Sign in to your portal to read it and sign it online. ${NOT_ATTACHED}`],
      esign_voided: [`${firm.name}: ${title} was withdrawn`, `${firm.name} has withdrawn ${title}. You no longer need to sign it.`, 'Nothing else is needed from you.'],
      esign_completed: [`${firm.name}: ${title} is signed by everyone`, `Everyone has signed ${title}.`, 'The completed copy is in your portal under Documents, where you can download it. It is not attached to this email, to keep it safe.']
    }[kind];
    return portalMessage(firm, d, who, M[0], { paras: [M[1]], before: [M[2]], button: portalOpen(d) });
  }
  /** C-14: to the sponsor, when a signer declines. */
  function esignDeclined(firm, d) {
    const who = oneLine(d.signer && d.signer.name) || 'A signer';
    const title = oneLine(d.envelope && d.envelope.title) || 'a document';
    const rows = [['Signer', who], ['Document', title]];
    if (oneLine(d.reason)) rows.push(['Reason', d.reason]);
    return sponsorMessage(firm, d, `${who} declined to sign ${title}`, { paras: [`${who} declined to sign ${title}.`], rows, after: ['Open the console to see the envelope and, if needed, send a corrected one.'] });
  }

  /** C-17, C-03: the password reset (investor or team). A template and preview only in this phase. */
  function passwordReset(firm, d, variant) {
    const where = variant === 'team' ? `${firm.name} console` : oneLine(firm.portalName) || `${firm.name} investor portal`;
    const support = supportSentence(firm);
    return layout(firm, `${firm.name}: reset your password`, `We received a request to reset the password for your ${where} account.`, {
      greeting: greeting(d.person && d.person.name),
      paras: [`We received a request to reset the password for your ${where} account.`],
      // Not "Choose a new password": the text twin's "<label>:" would read as a password given in the message.
      button: { label: 'Open the reset page', href: d.link },
      after: ['If you did not ask for this, ignore this email: your password stays as it is.', expirySentence(d.expiresAt), support],
      support
    }, d.opts);
  }
  /** C-18, C-03: a team member invited to the firm's console. A template and preview only in this phase. */
  function teamInvitation(firm, d) {
    const inviter = oneLine(d.inviter);
    const role = oneLine(d.role);
    const support = supportSentence(firm);
    const first = `${inviter ? `${inviter} at ${firm.name}` : firm.name} has invited you to join the ${firm.name} console${role ? ` with the ${role} role` : ''}.`;
    return layout(firm, `${firm.name}: you are invited to the console`, first, {
      greeting: greeting(d.person && d.person.name),
      paras: [first],
      before: ['The console is where the team works with investors, offerings and documents. The link below lets you create your login.'],
      button: { label: 'Accept the invitation', href: d.link },
      after: [expirySentence(d.expiresAt), support],
      support
    }, d.opts);
  }

  /* ---------- Security notices (plan 15-14, SE-02, D-04) and the investor's access invitation (SE-05) ---------- */
  // Each notice says what happened, when, and what to do if it was not the person. No code, password, taxpayer or bank
  // number is ever printed: a bank account is named by its last four digits only, a device by its type only.
  const SECURITY_SUBJECTS = {
    passwordChanged: 'your password was changed',
    twoStepChanged: 'two-step sign-in changed',
    recoveryCodesReplaced: 'your recovery codes were replaced',
    recoveryCodeUsed: 'a recovery code was used',
    newDevice: 'a new sign-in to your console',
    locked: 'your account is locked for 15 minutes',
    confirmEmail: 'confirm your email address',
    bankChanged: 'your bank account was changed',
    bankChangedFirm: "an investor's bank account was changed, confirm it before paying"
  };
  const SECURITY_VARIANTS = Object.keys(SECURITY_SUBJECTS);
  /** The notices only the firm's own console people receive. */
  const TEAM_ONLY = ['newDevice', 'confirmEmail', 'bankChangedFirm'];
  const DEVICE_WORDS = { Computer: 'computer', Phone: 'phone', Tablet: 'tablet' };
  const TWO_STEP_CHANGE = { on: 'was turned on', off: 'was turned off', reset: 'was reset by your firm; you set it up again at your next sign-in' };
  /** "November 10, 2026 at 12:00 UTC", or '' for a time that is not one. */
  function whenText(at) {
    const d = new Date(str(at));
    if (!str(at) || Number.isNaN(d.getTime())) return '';
    const two = (n) => String(n).padStart(2, '0');
    return `${longDate(d.toISOString())} at ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
  }
  /** The last four digits of whatever is given, never more. */
  const lastFour = (v) => str(v).replace(/\D/g, '').slice(-4);
  function securityNotice(firm, d, variant) {
    // An investor's own bank account is the investor's only (the firm hears of it through bankChangedFirm).
    const team = variant !== 'bankChanged' && (d.audience === 'team' || TEAM_ONLY.indexOf(variant) >= 0);
    const where = team ? `${firm.name} console` : oneLine(firm.portalName) || `${firm.name} investor portal`;
    const at = whenText(d.when);
    const on = at ? ` on ${at}` : '';
    const support = team ? '' : supportSentence(firm);
    const notMe = team ? 'If this was not you, reset your password now from the sign-in page and tell the Owner of your firm’s console.' : 'If this was not you, reset your password now from the sign-in page and contact us.';
    const four = lastFour(d.last4);
    const subject = `${firm.name}: ${SECURITY_SUBJECTS[variant]}`;
    let paras;
    let after = [notMe];
    let button = null;
    if (variant === 'passwordChanged') paras = [`The password for your ${where} account was changed${on}.`];
    else if (variant === 'twoStepChanged') paras = [`${at ? `On ${at}, two-step` : 'Two-step'} sign-in for your ${where} account ${TWO_STEP_CHANGE[d.change] || 'was changed'}.`];
    else if (variant === 'recoveryCodesReplaced') paras = [`New recovery codes were made for your ${where} account${on}. The earlier codes no longer work.`];
    else if (variant === 'recoveryCodeUsed') {
      const n = Math.max(0, Math.min(10, Math.floor(Number(d.left) || 0)));
      paras = [`A recovery code was used to sign in to your ${where} account${on}. You have ${n} ${n === 1 ? 'code' : 'codes'} left; each one works once.`];
      if (n <= 2) paras.push('Make new recovery codes in your account settings.');
    } else if (variant === 'newDevice') paras = [`Someone signed in to your ${where} account from a new ${DEVICE_WORDS[d.device] || 'device'}${on}.`, 'If it was you, there is nothing to do.'];
    else if (variant === 'locked') {
      paras = [`${at ? `On ${at}, your` : 'Your'} ${where} account was locked for 15 minutes after too many wrong passwords.`];
      after = [team ? 'If these tries were not yours, reset your password from the sign-in page (a new password ends the lock) and tell the Owner of your firm’s console.' : 'If these tries were not yours, reset your password from the sign-in page (a new password ends the lock) and contact us.'];
    } else if (variant === 'confirmEmail') {
      paras = [`Confirm that this is your email address for the ${firm.name} console. Until you do, the console cannot invite investors.`];
      button = { label: 'Confirm my email', href: d.link };
      after = [expirySentence(d.expiresAt), 'If you did not sign up, ignore this email.'].filter(Boolean);
    } else if (variant === 'bankChanged') {
      paras = [`The bank account for your payments from ${firm.name} was changed${on}.${four ? ` The new account ends in ${four}.` : ''}`, `No payment goes to it until ${firm.name} has confirmed the change.`];
      after = ['If you did not make this change, contact us at once and reset your password from the sign-in page.'];
    } else {
      const who = oneLine(d.investor && (d.investor.contact || d.investor.title || d.investor.name)) || 'An investor';
      paras = [`${who}’s bank account for payments was changed${on}.${four ? ` The new account ends in ${four}.` : ''}`, 'No payment goes to it until someone who can release payments confirms the change in the console. Confirm it with the investor first, by a phone number you already hold, never one given in an email.'];
      after = [];
    }
    if (support) after = after.concat([support]);
    return layout(firm, subject, paras[0], { greeting: greeting(d.person && d.person.name), paras, button, after, support }, d.opts);
  }
  /** An investor already on the firm's books is invited to set up a sign-in of their own (lib/team.mjs, kind investor). */
  function portalAccess(firm, d) {
    const where = oneLine(firm.portalName) || `${firm.name} investor portal`;
    const support = supportSentence(firm);
    const first = `${firm.name} has invited you to set up your own sign-in to the ${where}.`;
    return layout(firm, `${firm.name}: set up your sign-in to the investor portal`, first, {
      greeting: greeting(d.person && d.person.name),
      paras: [first],
      before: ['There you see your investments, your documents and the firm’s messages. The link below lets you choose your password.'],
      button: { label: 'Set up my sign-in', href: d.link },
      after: [expirySentence(d.expiresAt), support],
      support
    }, d.opts);
  }

  /* ---------- Tax documents (Rev. Proc. 2012-17; wording from assets/js/taxdocs.js and server/lib/taxdocs.mjs, 10-12) ---------- */
  const TAX_SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
  const TAX_CONSENT_SUBJECT = 'Your consent to receive tax documents electronically';
  /** A day as 'YYYY-MM-DD' or a timestamp, as a long date; any other text as it was given. */
  function dayText(day) {
    const s = oneLine(day);
    if (!s) return '';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00Z` : s);
    return Number.isNaN(d.getTime()) ? s : longDate(d.toISOString());
  }
  /** "Questions: <name>, <address>, telephone <phone>, email <email>." with only the parts that are there. */
  function questionsLine(firm, contact) {
    const c = contact || {};
    const list = [oneLine(c.name), oneLine(c.address), oneLine(c.phone) ? `telephone ${oneLine(c.phone)}` : '', oneLine(c.email) ? `email ${oneLine(c.email)}` : ''].filter(Boolean);
    return list.length ? `Questions: ${list.join(', ')}.` : supportSentence(firm);
  }
  function taxNotice(firm, d, variant) {
    const doc = d.doc || {};
    const until = dayText(doc.availableUntil);
    const name = d.investor && (d.investor.contact || d.investor.name || d.investor.title);
    if (variant === 'link') {
      const paras = [`${firm.name} has posted a tax document for you: ${oneLine(doc.title)}.`];
      return layout(firm, TAX_SUBJECT, paras[0], {
        greeting: greeting(name),
        paras,
        before: ['To open it on any device, use the link below.'],
        button: { label: 'Open your tax document', href: d.link },
        after: [`You will be asked for the last four digits of the tax number you gave ${firm.name}. Once the document is open, use Save to keep a copy, and print the saved file.`, until ? `It stays available until ${until}.` : '', questionsLine(firm, d.contact)].filter(Boolean)
      }, d.opts);
    }
    const paras = [`A tax document is available for you in the investor portal: ${oneLine(doc.label)} for ${oneLine(doc.year)}${doc.replaces ? ', which replaces the one posted earlier' : ''}.`, 'To open it, sign in, go to Documents and tap it. Use Download to save or print it.'];
    return layout(firm, TAX_SUBJECT, paras[0], {
      greeting: greeting(name),
      paras,
      button: portalButton(firm, d, true),
      after: [until ? `It stays available in the portal until ${until}.` : '', questionsLine(firm, d.contact)].filter(Boolean)
    }, d.opts);
  }
  /** Without consent in effect, the first message asks for it (section 4.01). It is not the notice: never its words. */
  function taxConsent(firm, d) {
    const doc = d.doc || {};
    const name = d.investor && (d.investor.contact || d.investor.name || d.investor.title);
    const first = `${firm.name} has a tax document for you: ${oneLine(doc.title)}. It can be delivered to you electronically only with your consent.`;
    return layout(firm, TAX_CONSENT_SUBJECT, first, {
      greeting: greeting(name),
      paras: [first],
      before: ['To read how electronic delivery works and give your consent, use the link below on any device.'],
      button: { label: 'Review and give your consent', href: d.link },
      after: [`You will be asked for the last four digits of the tax number you gave ${firm.name}. Once you consent, the document opens there; use Save to keep a copy, and print the saved file.`, 'If you do not consent, the document will be sent to you on paper.', questionsLine(firm, d.contact)]
    }, d.opts);
  }

  /* ---------- The filing agent's staff: the order email, word for word as server/lib/filings.mjs has always written it ---------- */
  const FILING_SERVICE = { formd: 'Form D', 'formd-amendment': 'Form D amendment', bluesky: 'State notice filings', 'bluesky-renewal': 'State notice renewals' };
  function filingOrder(d, variant) {
    const service = FILING_SERVICE[d.kind];
    const lines = [`Order: ${d.id}`, `Service: ${service}`, `Firm: ${d.firm && d.firm.name}`, `Offering: ${d.offering && d.offering.name}`, `Amount due: ${money(d.dueCents)}${d.openFees ? ' plus fees still to be confirmed' : ''}`, '', `Open it with the staff call GET /v1/filings/staff/orders/${d.id}`];
    const text = lines.join('\n');
    return { subject: `${variant === 'changed' ? 'Filing order changed' : 'Filing order'} ${d.id}: ${service}`, preheader: lines[0], text, html: `<p>${esc(text).replace(/\n/g, '<br>')}</p>`, inline: [] };
  }

  /* ---------- Sample data (previews, goldens): fixed dates, never-issued numbers, no personal data ---------- */
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
  const SAMPLE_CONSOLE = 'https://portal.example/portal.html#console-investors';
  const SENT = '2026-11-10T12:00:00.000Z';
  const EXPIRES = '2026-12-10T12:00:00.000Z';
  const ANITA = { id: 'HRC-0101', contact: 'Shah, Anita', title: 'Anita Shah', type: 'individual', email: 'anita@investor.example' };
  const CO = { id: 'HRC-0101', contact: 'Shah, Ravi', title: 'Anita Shah', type: 'individual', email: 'ravi@investor.example' };
  const FUND = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', currency: 'USD' };
  const copy = (x) => JSON.parse(JSON.stringify(x));

  const INVITE = {
    'new-offering': [ANITA, FUND, { cents: 25000000, note: 'We are glad to have you with us for Fund II.' }],
    'new-account': [ANITA, null, {}],
    subscribe: [ANITA, FUND, { existing: true, cents: 10000000, senderName: 'Maria Ortiz' }],
    'subscribe-tax': [ANITA, FUND, { existing: true, cents: 10000000, includeTax: true }],
    access: [ANITA, null, { existing: true, access: true }],
    'taxRequest-w9': [Object.assign({ taxType: 'us-individual' }, ANITA), null, { existing: true, taxRequest: true }],
    'taxRequest-w8ben': [Object.assign({ taxType: 'foreign-individual' }, ANITA), null, { existing: true, taxRequest: true }],
    coSign: [CO, null, { existing: true, coSign: true, envelopeId: 'env-sample' }],
    reverify: [ANITA, null, { existing: true, reverify: true }]
  };
  function invitationSample(variant) {
    const [investor, offering, inv] = INVITE[variant === 'started' ? 'new-offering' : variant];
    // An invitation to subscribe to another offering is possibly commercial (C-02): its sample firm has a postal address.
    const firm = /^subscribe/.test(variant) ? Object.assign(copy(SAMPLE_FIRM), { postalAddress: SAMPLE_ADDRESS }) : copy(SAMPLE_FIRM);
    return { firm, investor: copy(investor), offering: copy(offering), invitation: Object.assign({ cents: 0, cls: '', note: '', senderName: '' }, copy(inv)), link: SAMPLE_LINK, expiresAt: EXPIRES, started: variant === 'started' };
  }

  const who = [['Investor', 'Shah, Anita'], ['Email', 'anita@investor.example']];
  const NOTIFY = {
    onboarding: [FUND, { rows: who.concat([['Investing as', 'Individual'], ['Offering', 'Harbor Ridge Fund II'], ['Commitment', '$250,000'], ['Identity', 'Verified'], ['Sanctions screening', 'Clear'], ['Accredited investor', 'Verified'], ['Subscription agreement', 'Signed by the investor; waiting for your countersignature']]), next: 'Next: countersign the subscription agreement in the console.' }],
    'onboarding-account': [null, { rows: who.concat([['Investing as', 'Individual'], ['Commitment', 'Not set'], ['Identity', 'Verified'], ['Sanctions screening', 'Clear'], ['Accredited investor', 'Not required'], ['Subscription agreement', 'No subscription submitted']]), next: 'Next: invite them to an offering when one is open.' }],
    subscription: [FUND, { rows: who.concat([['Offering', 'Harbor Ridge Fund II'], ['Commitment', '$250,000'], ['Accredited investor', 'On file'], ['Subscription agreement', 'Signed by the investor; waiting for your countersignature']]), next: 'Next: countersign the subscription agreement in the console.', existing: true, requested: true }],
    'subscription-tax': [FUND, { rows: who.concat([['Offering', 'Harbor Ridge Fund II'], ['Commitment', '$250,000'], ['Accredited investor', 'On file'], ['Subscription agreement', 'Signed by the investor; waiting for your countersignature'], ['Tax form', 'Form W-9, signed']]), next: 'Next: countersign the subscription agreement in the console.', existing: true, includeTax: true, requested: true }],
    none: [FUND, { rows: who.concat([['Offering', 'Harbor Ridge Fund II'], ['Commitment', '$250,000'], ['Accredited investor', 'On file'], ['Subscription agreement', 'No subscription submitted']]), next: 'Next: nothing to do unless the offering opens again.', existing: true, requested: false }],
    access: [null, { rows: who, next: 'Nothing to do: their record stays as you hold it.', existing: true, access: true, requested: false }],
    'coSign-signed': [null, { rows: [['Co-investor signature', 'Signed']], next: 'Next: countersign the subscription agreement in the console.', existing: true, coSign: true, coSigned: true, account: 'Anita Shah', requested: false }],
    'coSign-unsigned': [null, { rows: [['Co-investor signature', 'Not signed']], next: 'Next: ask the co-investor to sign.', existing: true, coSign: true, coSigned: false, account: 'Anita Shah', requested: false }],
    'taxRequest-signed': [null, { rows: who.concat([['Tax form', 'Form W-9, signed']]), next: 'Next: the console adds the form to the investor’s record the next time it is open.', existing: true, taxRequest: true, taxState: 'signed', taxForm: 'W-9', requested: false }],
    'taxRequest-notsigned': [null, { rows: who.concat([['Tax form', 'Form W-9, not signed']]), next: 'Next: ask the investor for their tax form again if you still need it.', existing: true, taxRequest: true, taxState: 'not signed', taxForm: 'W-9', requested: false }],
    'taxRequest-none': [null, { rows: who.concat([['Tax form', 'Not returned']]), next: 'Next: ask the investor for their tax form again if you still need it.', existing: true, taxRequest: true, taxState: 'not returned', taxForm: 'W-9', requested: false }],
    'reverify-reverified': [null, { rows: who.concat([['Accredited investor', 'Verified']]), next: 'Next: the console adds the result to the investor’s record the next time it is open.', existing: true, reverify: true, reverified: true, requested: false }],
    'reverify-finished': [null, { rows: who.concat([['Accredited investor', 'Not verified again']]), next: 'Next: ask the investor to verify their accreditation again if you still need it.', existing: true, reverify: true, reverified: false, requested: false }]
  };
  function notificationSample(variant) {
    const [offering, summary] = NOTIFY[variant];
    return { firm: copy(SAMPLE_FIRM), investor: copy(/^coSign/.test(variant) ? CO : ANITA), offering: copy(offering), summary: copy(summary), consoleUrl: SAMPLE_CONSOLE, completedAt: SENT };
  }
  const REMIND = { onboarding: [FUND, {}], subscription: [FUND, { existing: true }], taxRequest: [null, { existing: true, taxRequest: true }], reverify: [null, { existing: true, reverify: true }], coSign: [null, { existing: true, coSign: true }] };
  function reminderSample(variant) {
    const [offering, flags] = REMIND[variant];
    return Object.assign({ firm: copy(SAMPLE_FIRM), investor: copy(variant === 'coSign' ? CO : ANITA), offering: copy(offering), consoleUrl: SAMPLE_CONSOLE, completedAt: SENT, deleteOn: EXPIRES, existing: false, taxRequest: false, reverify: false, coSign: false }, flags);
  }

  const SAMPLE_PORTAL = 'https://portal.example/portal.html';
  const SAMPLE_ADDRESS = '1 Harbor Way, Boston, MA 02110';
  const SAMPLE_STOP = 'https://api.example/v1/messages/unsubscribe?t=sample';
  const SIGN_OFF = 'If you have any questions, contact Investor Relations at +1 212 555 0100.\n\nHarbor Ridge Capital';
  const NOTICES = {
    quarterly: ['Q3 2026 report for Harbor Ridge Fund II is now available', 'The Q3 2026 quarterly report for Harbor Ridge Fund II has been posted to your Harbor Ridge Investor Portal. Sign in and open Documents to read it.'],
    documents: ['New documents are available in your Harbor Ridge Investor Portal', 'New documents have been uploaded to your Harbor Ridge Investor Portal: Fund II subscription agreement, countersigned. Sign in and open Documents to view them.'],
    custom: ['Our office moves in January', 'From January 5, 2027 our office is at 1 Harbor Way, Boston. Nothing changes in your portal or in your investments.'],
    offeringNews: ['Harbor Ridge Fund III is open for subscriptions', 'Harbor Ridge Fund III is now accepting subscriptions from our investors. Its offering documents are in your portal under Offerings.']
  };
  function noticeSample(variant) {
    const [subject, para] = NOTICES[variant];
    const out = { variant, firm: copy(SAMPLE_FIRM), investor: copy(ANITA), subject, body: `Dear Anita,\n\n${para}\n\n${SIGN_OFF}`, portalUrl: SAMPLE_PORTAL, activated: true };
    // Offering news is possibly commercial: the sample firm has its postal address, and the server's one-click stop link.
    if (variant === 'offeringNews') Object.assign(out, { firm: Object.assign(copy(SAMPLE_FIRM), { postalAddress: SAMPLE_ADDRESS }), unsubscribeUrl: SAMPLE_STOP });
    return out;
  }
  /** assets/js/operations.js callNotice wording, merged for one investor (call 2 of Fund II, $25,000.00). */
  const CALLS = {
    call: ['Capital call 2 for Harbor Ridge Fund II: $25,000.00 due December 10, 2026', 'Harbor Ridge Fund II is calling capital. Your contribution of $25,000.00 is due December 10, 2026. Sign in to your Harbor Ridge Investor Portal for the wire instructions and the call notice.\n\nBefore sending a wire, call Investor Relations at +1 212 555 0100 to confirm the instructions. We never change wire instructions by email.'],
    reminder: ['Reminder: capital call 2 for Harbor Ridge Fund II ($25,000.00) is due December 10, 2026', 'Our records show that your contribution of $25,000.00 for capital call 2 of Harbor Ridge Fund II is due December 10, 2026 and has not yet been received. Wire instructions are in your Harbor Ridge Investor Portal.\n\nIf you have already sent the wire, please disregard this reminder.']
  };
  const callSample = (variant) => {
    const [subject, para] = CALLS[variant];
    return { variant, firm: copy(SAMPLE_FIRM), investor: copy(ANITA), subject, body: `Dear Anita,\n\n${para}\n\nHarbor Ridge Capital`, portalUrl: SAMPLE_PORTAL, activated: true };
  };
  const CONTACT = { name: 'Investor Relations, Harbor Ridge Capital', address: '1 Harbor Way, Boston, MA 02110', phone: '+1 212 555 0100', email: 'ir@harborridge.example' };
  const TAX_DOC = { label: 'Schedule K-1', year: '2026', title: 'Schedule K-1 for 2026, Harbor Ridge Fund II', replaces: false, availableUntil: '2027-10-15' };
  const SAMPLE_TAX_LINK = 'https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#taxdoc-sample';
  function taxSample(variant) {
    const out = { variant, firm: copy(SAMPLE_FIRM), investor: copy(ANITA), doc: copy(TAX_DOC), contact: copy(CONTACT) };
    if (variant === 'portal') out.portalUrl = SAMPLE_PORTAL;
    else out.link = SAMPLE_TAX_LINK;
    return out;
  }
  const ENVELOPE = { title: 'Fund II side letter' };
  const esignSample = (variant) => ({ variant, firm: copy(SAMPLE_FIRM), signer: { name: 'Anita Shah' }, envelope: copy(ENVELOPE), portalUrl: SAMPLE_PORTAL });
  const declinedSample = (variant) => ({ variant, firm: copy(SAMPLE_FIRM), signer: { name: 'Anita Shah' }, envelope: copy(ENVELOPE), consoleUrl: SAMPLE_CONSOLE, reason: 'The commitment amount is not the one we agreed.' });
  function confirmationSample(variant) {
    const investor = copy(variant === 'coSign' ? CO : Object.assign({ taxType: 'us-individual' }, ANITA));
    return { variant, firm: copy(SAMPLE_FIRM), investor, offering: variant === 'subscription' || variant === 'onboarding' ? copy(FUND) : null, invitation: {}, portalUrl: SAMPLE_PORTAL, completedAt: SENT };
  }
  const SAMPLE_RESET = 'https://portal.example/portal.html#reset-sample';
  const SAMPLE_TEAM = 'https://portal.example/diy.html#team-sample';
  const resetSample = (variant) => ({ variant, firm: copy(SAMPLE_FIRM), person: { name: variant === 'team' ? 'Maria Ortiz' : 'Anita Shah' }, link: variant === 'team' ? SAMPLE_RESET.replace('portal.html', 'diy.html') : SAMPLE_RESET, expiresAt: '2026-11-10T13:00:00.000Z' });
  const teamSample = (variant) => ({ variant, firm: copy(SAMPLE_FIRM), person: { name: 'Daniel Brooks' }, inviter: 'Maria Ortiz', role: 'Operations', link: SAMPLE_TEAM, expiresAt: EXPIRES });
  // Plan 15-14's samples: who each notice goes to in the goldens (the investor variants render for a team person too).
  const SAMPLE_CONFIRM = 'https://portal.example/diy.html#confirm-sample';
  const SAMPLE_ACCESS = 'https://portal.example/portal.html#accept-sample';
  const SECURITY_SAMPLE = {
    passwordChanged: ['investor', {}],
    twoStepChanged: ['team', { change: 'on' }],
    recoveryCodesReplaced: ['team', {}],
    recoveryCodeUsed: ['investor', { left: 9 }],
    newDevice: ['team', { device: 'Phone' }],
    locked: ['team', {}],
    confirmEmail: ['team', { link: SAMPLE_CONFIRM, expiresAt: '2026-11-17T12:00:00.000Z' }],
    bankChanged: ['investor', { last4: '4321' }],
    bankChangedFirm: ['team', { last4: '4321', investor: { name: 'Anita Shah' } }]
  };
  function securitySample(variant) {
    const [audience, extra] = SECURITY_SAMPLE[variant];
    return Object.assign({ variant, audience, firm: copy(SAMPLE_FIRM), person: { name: audience === 'team' ? 'Maria Ortiz' : 'Anita Shah' }, when: SENT }, copy(extra));
  }
  const accessSample = (variant) => ({ variant, firm: copy(SAMPLE_FIRM), person: { name: 'Anita Shah' }, link: SAMPLE_ACCESS, expiresAt: EXPIRES });
  /** The staff email's sample is the record of server/test/fixtures/emails/base-filing.json. */
  const filingSample = (variant) => ({ variant, id: 'fil_sample-order', kind: variant === 'changed' ? 'bluesky' : 'formd', firm: { name: 'Harbor Ridge Capital' }, offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II' }, dueCents: variant === 'changed' ? 125000 : 29900, openFees: variant === 'changed' });

  const INVITE_VARIANTS = Object.keys(INVITE);
  /** Every message kind: who receives it, its name in the console, its sample variants. Later plans add kinds here. */
  const KINDS = {
    invitation: { audience: 'investor', label: 'Invitation', variants: INVITE_VARIANTS, sample: invitationSample },
    invitation_resent: { audience: 'investor', label: 'New link', variants: INVITE_VARIANTS.concat(['started']), sample: invitationSample },
    sponsor_notification: { audience: 'sponsor', label: 'Investor finished', variants: Object.keys(NOTIFY), sample: notificationSample },
    submission_reminder: { audience: 'sponsor', label: 'Waiting in your console', variants: Object.keys(REMIND), sample: reminderSample },
    notice: { audience: 'investor', label: 'Notice', variants: NOTICE_VARIANTS, sample: noticeSample },
    capital_call: { audience: 'investor', label: 'Capital call', variants: ['call'], sample: callSample },
    capital_call_reminder: { audience: 'investor', label: 'Capital call reminder', variants: ['reminder'], sample: callSample },
    confirmation: { audience: 'investor', label: 'We received it', variants: CONFIRMATION_VARIANTS, sample: confirmationSample },
    tax_notice: { audience: 'investor', label: 'Tax document notice', variants: ['portal', 'link'], sample: taxSample },
    tax_consent: { audience: 'investor', label: 'Tax document consent', variants: ['link'], sample: taxSample },
    esign_request: { audience: 'investor', label: 'Signature request', variants: ['portal'], sample: esignSample },
    esign_reminder: { audience: 'investor', label: 'Signature reminder', variants: ['portal'], sample: esignSample },
    esign_voided: { audience: 'investor', label: 'Signature request withdrawn', variants: ['portal'], sample: esignSample },
    esign_completed: { audience: 'investor', label: 'Signed by everyone', variants: ['portal'], sample: esignSample },
    esign_declined: { audience: 'sponsor', label: 'Signer declined', variants: ['console'], sample: declinedSample },
    password_reset: { audience: 'investor', label: 'Password reset', variants: ['investor', 'team'], sample: resetSample },
    team_invitation: { audience: 'team', label: 'Team invitation', variants: ['team'], sample: teamSample },
    // Plan 15-14: the security notices go to the firm's console people and, for the investor variants (data.audience
    // 'investor'), to the investor's own address; the access invitation to an investor already on the firm's books.
    security_notice: { audience: 'team', label: 'Security notice', variants: SECURITY_VARIANTS, sample: securitySample },
    portal_access: { audience: 'investor', label: 'Portal sign-in invitation', variants: ['access'], sample: accessSample },
    filing_order: { audience: 'staff', label: 'Filing order', variants: ['placed', 'changed'], sample: filingSample }
  };
  /** The variant a kind with named variants renders: the data's own, else the kind's first. */
  const variantOf = (kind, d) => (KINDS[kind].variants.indexOf(d.variant) >= 0 ? d.variant : KINDS[kind].variants[0]);

  /* ---------- render ---------- */
  /**
   * C-02 ("To be confirmed with counsel"): an invitation to subscribe to another offering, an invitation to an offering
   * with no commitment yet (and their new links), and a notice the sponsor marks as offering news are possibly
   * commercial. Every other message is transactional.
   */
  function isCommercial(kind, variant, d) {
    if (kind === 'notice') return variant === 'offeringNews';
    if (kind !== 'invitation' && kind !== 'invitation_resent') return false;
    if (variant === 'subscribe') return true;
    return variant === 'new' && !!(d.offering && d.offering.name) && !(Number(d.invitation && d.invitation.cents) > 0);
  }
  function render(kind, data, opts) {
    const d = Object.assign({}, data || {}, { opts: Object.assign({}, opts || {}) });
    const firm = d.firm || {};
    let variant;
    if (kind === 'invitation' || kind === 'invitation_resent') variant = invitationVariant(d, kind === 'invitation_resent');
    else if (kind === 'sponsor_notification') variant = notificationVariant(d);
    else if (kind === 'submission_reminder') variant = reminderVariant(d);
    else if (KINDS[kind]) variant = variantOf(kind, d);
    else throw new Error(`Unknown message kind: ${str(kind)}`);
    const commercial = isCommercial(kind, variant, d);
    const stopUrl = commercial ? oneLine(d.unsubscribeUrl) : '';
    if (commercial) d.opts.stop = { line: `To stop invitations to new offerings from ${firm.name}, ${stopUrl ? `use this link: ${stopUrl}` : 'reply to this email.'}`, url: stopUrl };
    let out;
    if (kind === 'invitation' || kind === 'invitation_resent') out = INVESTOR[variant](firm, d, kind === 'invitation_resent');
    else if (kind === 'sponsor_notification') out = notification(firm, d, variant);
    else if (kind === 'submission_reminder') out = reminder(firm, d, variant);
    else if (kind === 'notice') out = notice(firm, d, variant);
    else if (kind === 'capital_call' || kind === 'capital_call_reminder') out = sponsorText(firm, d, {});
    else if (kind === 'confirmation') out = confirmation(firm, d, variant);
    else if (kind === 'tax_notice') out = taxNotice(firm, d, variant);
    else if (kind === 'tax_consent') out = taxConsent(firm, d);
    else if (kind === 'esign_declined') out = esignDeclined(firm, d);
    else if (/^esign_/.test(kind)) out = esign(firm, d, kind);
    else if (kind === 'password_reset') out = passwordReset(firm, d, variant);
    else if (kind === 'team_invitation') out = teamInvitation(firm, d);
    else if (kind === 'security_notice') out = securityNotice(firm, d, variant);
    else if (kind === 'portal_access') out = portalAccess(firm, d);
    else out = filingOrder(d, variant);
    const headers = stopUrl ? { 'List-Unsubscribe': `<${stopUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {};
    // A possibly commercial message may not go without the firm's postal address: the caller refuses it (13-04, 13-05).
    const needs = commercial && !oneLine(firm.postalAddress) ? ['postalAddress'] : [];
    return { kind, variant, subject: out.subject, preheader: out.preheader, text: out.text, html: out.html, inline: out.inline, commercial, headers, needs };
  }

  /* ---------- The console's one hand-off (dispatch) ---------- */
  /** The firm as the server is sent it: exactly the fields assets/js/invitations.js firmOf sends, and the postal address. */
  function firmFromTenant(tenant) {
    const t = tenant || {};
    const s = t.support || {};
    const c = t.colors || {};
    const image = t.logo && t.logo.type === 'image' ? str(t.logo.image) : '';
    return {
      name: str(t.name),
      shortName: str(t.shortName),
      legalName: str(t.legalName),
      supportTeam: str(s.team),
      supportEmail: isEmail(s.email) ? s.email : '',
      supportPhone: str(s.phone),
      colors: { primary: str(c.primary), accent: str(c.accent) },
      logo: ANY_IMAGE.test(image) && image.length <= 600 * 1024 ? image : '',
      portalName: str(t.portalName),
      disclaimer: str(t.disclaimer),
      postalAddress: str(t.postalAddress)
    };
  }
  /**
   * May this investor be emailed this message? false only for an optional notice they turned off (new documents,
   * quarterly reports) or a possibly commercial message once they turned offering news off. Required messages always go.
   */
  function prefsAllow(inv, kind, variant, commercial) {
    const p = (inv && inv.emailPrefs) || {};
    if (kind === 'notice' && variant === 'documents' && p.documents === false) return false;
    if (kind === 'notice' && variant === 'quarterly' && p.quarterly === false) return false;
    const isCommercial = commercial === true || (kind === 'notice' && variant === 'offeringNews') || ((kind === 'invitation' || kind === 'invitation_resent') && variant === 'subscribe');
    if (isCommercial && p.offering === false) return false;
    return true;
  }
  /**
   * The server's record of who turned offering news off (GET /v1/messages/preferences: [ { investorId, offering } ]) on the
   * workspace's investors. Returns how many investors changed; the caller saves.
   */
  function applyPrefs(ws, preferences) {
    let changed = 0;
    for (const p of preferences || []) {
      if (!p || typeof p.offering !== 'boolean') continue;
      const inv = ((ws && ws.investors) || []).filter((x) => x && x.id === p.investorId)[0];
      if (!inv) continue;
      // Absent means on (13-08): an investor whose choice is already the server's is not counted.
      const now = inv.emailPrefs && typeof inv.emailPrefs.offering === 'boolean' ? inv.emailPrefs.offering : true;
      if (now === p.offering) continue;
      if (!inv.emailPrefs || typeof inv.emailPrefs !== 'object') inv.emailPrefs = {};
      inv.emailPrefs.offering = p.offering;
      changed += 1;
    }
    return changed;
  }
  const POSTAL = 'Add your firm’s postal address to its brand settings first: emails about new offerings must carry it.';
  const plural = (n, one, many) => (n === 1 ? one : many);
  /** One sentence for the sponsor: what happened to the messages dispatch handed over. */
  function summary(counts, connected) {
    const c = counts || {};
    const n = (k) => Number(c[k]) || 0;
    const tail = [];
    const off = n('unsubscribed');
    if (!connected) {
      const all = n('simulated');
      if (off) tail.push(off === 1 ? ' 1 has turned these emails off.' : ` ${off} have turned these emails off.`);
      return `Email to ${all} ${plural(all, 'investor', 'investors')} ${SIMULATED}.${tail.join('')}`;
    }
    const sent = n('sent');
    if (n('outbox')) tail.push(n('outbox') === 1 ? ' 1 is in the server’s outbox: no sending service is set up yet.' : ` ${n('outbox')} are in the server’s outbox: no sending service is set up yet.`);
    if (n('held')) tail.push(n('held') === 1 ? ' 1 is waiting: your sending domain is not ready.' : ` ${n('held')} are waiting: your sending domain is not ready.`);
    if (n('suppressed')) tail.push(n('suppressed') === 1 ? ' 1 was not sent: an earlier email to that address came back.' : ` ${n('suppressed')} were not sent: earlier emails to those addresses came back.`);
    if (off) tail.push(off === 1 ? ' 1 has turned these emails off.' : ` ${off} have turned these emails off.`);
    if (n('failed')) tail.push(n('failed') === 1 ? ' 1 could not be sent; try again later.' : ` ${n('failed')} could not be sent; try again later.`);
    return `${sent ? `Emailed to ${sent} ${plural(sent, 'investor', 'investors')}.` : 'No email was sent.'}${tail.join('')}`;
  }
  const SERVER_STATUSES = ['sent', 'outbox', 'held', 'failed', 'suppressed', 'unsubscribed'];
  /**
   * Hand one message to each investor: with a server, one POST /v1/messages for all of them; without one, no request, and
   * every message is logged as simulated. Free text screen() refuses stops the whole send before anything is logged.
   * The caller saves the workspace. api(method, path, body) is the caller's call to its integration server.
   */
  async function dispatch(o) {
    const ws = o.ws;
    const kind = o.kind;
    const variant = o.variant;
    const items = o.items || [];
    if (!KINDS[kind]) throw new Error(`Unknown message kind: ${str(kind)}`);
    for (const it of items) {
      for (const s of [it.data && it.data.subject, it.data && it.data.body]) {
        const bad = screen(s);
        if (bad) throw new Error(bad.reason);
      }
    }
    const firm = o.firm || firmFromTenant(ws.tenant);
    const rows = items.map((it) => {
      const data = it.data || {};
      const m = render(kind, Object.assign({ firm, portalUrl: o.portalUrl }, data, variant ? { variant } : {}));
      return { it, data, m, allowed: prefsAllow(it.inv, kind, variant || m.variant, m.commercial) };
    });
    // A possibly commercial message without the firm's postal address is refused whole, before any request or log entry.
    if (rows.some((r) => r.m.needs.indexOf('postalAddress') >= 0)) throw new Error(POSTAL);
    const status = {};
    const error = {};
    for (const r of rows) if (!r.allowed) status[r.it.investorId] = 'unsubscribed';
    const go = rows.filter((r) => r.allowed);
    if (o.connected && go.length) {
      const body = {
        workspace: str(ws.tenant && ws.tenant.id),
        kind,
        variant: variant || go[0].m.variant,
        firm,
        portalUrl: o.portalUrl,
        offeringNews: !!o.offeringNews,
        recipients: go.map((r) => ({ investorId: r.it.investorId, name: str(r.it.to && r.it.to.name), email: str(r.it.to && r.it.to.email), subject: str(r.data.subject), body: str(r.data.body), data: r.data }))
      };
      const answer = await o.api('POST', '/v1/messages', body);
      const results = (answer && Array.isArray(answer.results) && answer.results) || [];
      for (const r of go) {
        const got = results.filter((x) => x && x.investorId === r.it.investorId)[0];
        status[r.it.investorId] = got && SERVER_STATUSES.indexOf(got.emailStatus) >= 0 ? got.emailStatus : 'failed';
        error[r.it.investorId] = got ? str(got.error) : 'The integration server did not answer for this investor.';
      }
    } else for (const r of go) status[r.it.investorId] = 'simulated';
    const counts = { total: rows.length };
    const results = rows.map((r) => {
      const s = status[r.it.investorId];
      counts[s] = (counts[s] || 0) + 1;
      log(ws, { kind, subject: r.m.subject, to: str(r.it.to && r.it.to.email), investorId: r.it.investorId, status: s, text: r.m.text, link: r.data.link });
      return { investorId: r.it.investorId, status: s, error: error[r.it.investorId] || '' };
    });
    return { results, counts };
  }

  const API = { KINDS, render, givenName, greeting, expirySentence, supportSentence, senderLine, screen, PATTERNS, contrastText, contrast, SIMULATED, BANNED, STATUSES, redactLink, log, money, longDate, esc, firmFromTenant, prefsAllow, applyPrefs, dispatch, summary, TAX_SUBJECT };
  if (NS) NS.emails = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
