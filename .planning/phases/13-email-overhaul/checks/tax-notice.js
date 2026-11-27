// gate: browser
// last "TAX NOTICE: PASS (parts run: 4)"
// Plan 13-07 (EM-01, EM-08, EM-09, EM-14; Rev. Proc. 2012-17 sections 7.01 and 7.02): the tax-document notice on the one
// template set (assets/js/emails.js) and a notice that comes back starting the 30 days for paper by itself.
//   bounce-phone    the real integration server in this process, SMTP at a local stand-in relay and the provider's events
//                   signed by a local stand-in key; the console at 390x844 with touch: a K-1 for an investor with consent
//                   and a tax number on record is delivered; the server's notice is posted back as a signed permanent
//                   bounce; the Tax documents page, opened again, lists it under Send on paper as
//                   "Notice came back on <date> · paper due by <date 30 days later>"
//   mailto-desktop  no server, the console in the sandboxed frame that refuses every connection, 1280x800: a delivered
//                   K-1's Notice shows the section 7.01 subject and a body equal to emails.js tax_notice (portal
//                   variant) for the same data; its Email link opens the sponsor's own email with that subject and text;
//                   no request is made
//   empty-slots     no server: the firm's contact with no telephone and no email: the notice's Questions line lists only
//                   the name and the address (no 'telephone ,', no 'email .', no double space)
//   log-noserver    no server: Copy on the notice leaves no sent-log entry and the page keeps plan 10-06's line about the
//                   sponsor's own email; with the server connected, the delivery's notice leaves one workspace sent-log
//                   entry with the server's status and the server's text, its personal link replaced
//   NODE_PATH=$(npm root -g) node tax-notice.js [--only bounce-phone,...]
// Every number is invented; the last four digits on record are 4721. The last line is "TAX NOTICE: PASS (parts run: N)"
// or "TAX NOTICE: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const T = require('./lib13.js');
const L = T.L;
const L10 = T.L10;

const SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
const LAST4 = '4721';
const CONTACT = { name: 'Kestrel Bay Investor Relations', address: '1 Market Street, Wilmington, DE 19801', phone: '(212) 555-0148', email: 'tax@example.invalid' };
const TOPIC = 'arn:aws:sns:us-east-1:000000000000:mail-events';
const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0000000000000000000000000000000.pem';
const mod = (rel) => import(pathToFileURL(path.join(L.ROOT, rel)).href);

/** A one-page PDF file's bytes (the server checks the %PDF- header and the hash; nothing here draws it). */
const tinyPdf = (label) => Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);

/**
 * One confirmed K-1 for one investor of the first fund: the investor gets the given last four (or none) and email, consent
 * as asked; the firm's contact is set (contact: the parts to set); the document's file is in the browser's file store.
 * Resolves to { docId, investorId, batchId }.
 */
async function seatK1(fr, o) {
  const bytes = tinyPdf(o.label || 'K1MARKER');
  return fr.evaluate(
    async ({ b64, o }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const TD = NS.taxdocs;
      const off = ws.offerings[0];
      const inv = ws.investors.filter((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.some((p) => p.offeringId === off.id))[o.nth || 0];
      ['taxCert', 'taxW8', 'taxForm', 'taxDelivery'].forEach((k) => delete inv[k]);
      inv.tinLast4 = o.last4 || '';
      inv.email = o.email;
      TD.setContact(ws, o.contact);
      if (o.consent) TD.consent(ws, inv.id, { where: 'portal' });
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const b = TD.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: off.id, fileName: 'k1-2025.pdf', pages: 1, by: 'Check admin', split: { packages: [], loose: [1], scan: false } });
      const p = TD.addPackage(ws, b.id, { first: 1, last: 1, by: 'Check admin' });
      TD.confirm(ws, b.id, p.id, { investorId: inv.id, by: 'Check admin' });
      const id = 'txn' + Math.random().toString(36).slice(2, 10).replace(/[0-9]/g, 'x');
      const doc = TD.toDocument(ws, b.id, p.id, { id, title: 'Schedule K-1 (Form 1065) 2025', fileName: `k1-1065-2025-${inv.id}.pdf`, size: u8.length, sha256: NS.audit.sha256(u8), by: 'Check admin' });
      await NS.ops.files.put(doc.id, new Blob([u8], { type: 'application/pdf' }));
      NS.app.save(true);
      return { docId: doc.id, investorId: inv.id, batchId: b.id };
    },
    { b64: bytes.toString('base64'), o }
  );
}

async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 20000 });
  await fr.waitForTimeout(400);
}
/** Deliver on the import's page (the list of recipients, then Deliver to these), tapped on the phone. */
async function deliver(fr, batchId) {
  await go(fr, `console-taxdocs-batch-${batchId}`, '.tx');
  await L10.press(fr, '[data-action=tx-deliver]');
  await fr.waitForTimeout(400);
  await L10.press(fr, '[data-action=tx-deliver-go]');
  await fr.waitForTimeout(600);
}
const taxOf = (fr, id) =>
  fr.evaluate((id) => {
    const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
    return d ? JSON.parse(JSON.stringify(d.tax)) : null;
  }, id);

/** The day n calendar days after a YYYY-MM-DD day. */
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** The stand-ins of the mail path (13-02, 13-03): SMTP relay, the provider's API, the event signer. */
async function mailStandIns() {
  const smtp = await mod('server/test/smtp-fake.mjs');
  const sesFake = await mod('server/test/ses-fake.mjs');
  const ses = await mod('server/mailers/ses.mjs');
  const relay = await smtp.fakeSmtp({});
  const api = await sesFake.fakeSes();
  const signer = sesFake.rsaCert();
  const env = {
    DATA_KEY: crypto.randomBytes(32).toString('base64'),
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(relay.port),
    SMTP_ALLOW_PLAIN: '1',
    MAIL_FROM: 'notices@kestrelbay.example',
    MAIL_PROVIDER: 'ses',
    SES_REGION: 'us-east-1',
    SES_ACCESS_KEY_ID: 'AKIDSTANDIN0000713',
    SES_SECRET_ACCESS_KEY: 'standin-secret-for-tax-notice-check-00',
    SES_API_HOST: api.host,
    MAIL_EVENTS_TOPIC_ARN: TOPIC
  };
  const opts = { mailCtx: { transport: ses.httpsTransport({ ca: api.ca }), resolver: sesFake.fakeResolver({}), fetchCert: async () => signer.cert } };
  /** A signed permanent (or transient) bounce of the message with this Message-ID, at the given time. */
  const bounce = (messageId, at, type) => {
    const mail = { messageId: 'relay-not-known', commonHeaders: { messageId } };
    const event = { eventType: 'Bounce', bounce: { bounceType: type || 'Permanent', bouncedRecipients: [{ emailAddress: 'kept@investor.example' }], timestamp: at } };
    const m = { Type: 'Notification', MessageId: `n-${crypto.randomBytes(6).toString('hex')}`, TopicArn: TOPIC, Message: JSON.stringify(Object.assign({ mail }, event)), Timestamp: new Date().toISOString(), SigningCertURL: CERT_URL };
    return JSON.stringify(sesFake.snsSign(m, signer.privateKey, '2'));
  };
  return {
    env,
    opts,
    relay,
    bounce,
    parts: smtp.parts,
    close: async () => {
      await relay.close();
      await api.close();
    }
  };
}
const messageIdOf = (data) => (/^Message-ID: (<[^>]+>)$/m.exec(data) || [])[1] || '';
const subjectOf = (data) => (/^Subject: (.*)$/m.exec(data) || [])[1] || '';

/** The notice on the document's row (Notice pressed): what it shows, its Email link and the data it was made from. */
async function noticeOf(fr, k) {
  await go(fr, `console-taxdocs-batch-${k.batchId}`, '.tx');
  await L10.press(fr, `[data-action=tx-notice][data-doc="${k.docId}"]`);
  await fr.waitForSelector(`.tx-notice[data-doc="${k.docId}"]`, { timeout: 10000 });
  return fr.evaluate((id) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const doc = ws.docs.find((d) => d.id === id);
    const inv = ws.investors.find((i) => i.id === doc.investors[0]);
    const box = document.querySelector(`.tx-notice[data-doc="${id}"]`);
    const dd = Array.from(box.querySelectorAll('.tx-review dd')).map((x) => x.textContent);
    const email = Array.from(box.querySelectorAll('a')).find((a) => /^mailto:/.test(a.getAttribute('href') || ''));
    return {
      subject: dd[1] || '',
      shown: Array.from(box.querySelectorAll(':scope > p.tx-detail')).map((p) => p.textContent).join('\n\n'),
      mailto: email ? email.getAttribute('href') : '',
      emailAction: email ? email.getAttribute('data-action') || '' : 'none',
      data: {
        tenant: JSON.parse(JSON.stringify(ws.tenant)),
        investor: { name: inv.contact || inv.title },
        doc: { label: NS.taxdocs.KINDS[doc.tax.kind].label, year: doc.tax.year, replaces: !!doc.tax.replaces, availableUntil: doc.tax.availableUntil },
        contact: JSON.parse(JSON.stringify(ws.taxdocs.contact))
      }
    };
  }, k.docId);
}
/** emails.js tax_notice, portal variant, run in Node for the data the page holds. */
const portalNotice = (d) => T.renderNode('tax_notice', { variant: 'portal', firm: T.emails().firmFromTenant(d.tenant), investor: d.investor, doc: d.doc, contact: d.contact });
const mailLogOf = (fr, investorId) => fr.evaluate((id) => (window.CVPortal.state.ws.mailLog || []).filter((e) => e.investorId === id).map((e) => Object.assign({}, e)), investorId);
const LINK_RE = /(https?:\/\/[^\s"<>]+#taxdoc-[A-Za-z0-9_-]{43})/;

const parts = {
  'bounce-phone': async ({ check, S }) => {
    const M = await mailStandIns();
    let sc = null;
    try {
      sc = await T.serverConsole(S, { env: M.env, opts: M.opts, context: L10.VIEW.phone });
      const fr = sc.page;
      fr.p10 = { size: 'phone' };
      check('the console took the server settings', !!sc.on, sc.on);
      const email = 'partner.bounce@investor.example';
      const k = await seatK1(fr, { last4: LAST4, email, consent: true, contact: CONTACT });
      await deliver(fr, k.batchId);
      await fr.waitForFunction((id) => {
        const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
        return !!(d && d.tax && d.tax.link && (d.tax.link.linkId || d.tax.link.status !== 'sent'));
      }, k.docId, { timeout: 30000 }).catch(() => {});
      const t0 = await taxOf(fr, k.docId);
      check('Deliver delivers the K-1 and the server emails its notice (emailStatus sent)', !!t0 && t0.state === 'delivered' && !!t0.link && /^txd_/.test(t0.link.linkId) && t0.link.emailStatus === 'sent', t0 && { state: t0.state, link: t0.link });
      const raw = (M.relay.messages[0] || {}).data || '';
      const mid = messageIdOf(raw);
      check('the relay received one message: the section 7.01 subject, to the investor', M.relay.messages.length === 1 && subjectOf(raw) === SUBJECT && (M.relay.messages[0].to || [])[0] === email && !!mid, { n: M.relay.messages.length, subject: subjectOf(raw) });
      // the bounce comes back at noon UTC today, so its calendar day is the same in the browser's time zone
      const day = new Date().toISOString().slice(0, 10);
      const at = `${day}T12:00:00.000Z`;
      const ev = await fetch(`${sc.srv.base}/v1/mail/events`, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=UTF-8' }, body: M.bounce(mid, at) });
      const evBody = await ev.json().catch(() => null);
      check('the signed permanent bounce is taken by the server (received 1)', ev.status === 200 && !!evBody && evBody.received === 1, { status: ev.status, body: evBody });
      const list = await sc.srv.call('GET', '/v1/taxdocs?workspace=kestrel-bay');
      const row = ((list.body && list.body.documents) || []).find((x) => x.id === t0.link.linkId) || {};
      check("the server's list says the notice bounced, with when", row.emailStatus === 'bounced' && row.bouncedAt === at, row);
      // the sponsor opens Tax documents again: the page reads the server's list
      await go(fr, 'console', '#view');
      await go(fr, 'console-taxdocs', '.tx');
      await fr.waitForFunction((id) => {
        const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
        return !!(d && d.tax.notice && d.tax.notice.bounced);
      }, k.docId, { timeout: 20000 }).catch(() => {});
      await fr.waitForTimeout(500);
      const t1 = await taxOf(fr, k.docId);
      const due = addDays(day, 30);
      check(`the notice is marked as came back on ${day}, paper due by ${due} (30 calendar days, section 7.02)`, !!t1 && !!t1.notice && t1.notice.bounced === day && t1.notice.paperBy === due && !t1.paper, t1 && t1.notice);
      const shown = await fr.evaluate(
        ({ id, day, due }) => {
          const U = window.CVPortal.ui;
          const r = document.querySelector(`[data-list=paper] .tx-row[data-id="${id}"]`);
          return { text: r ? r.innerText.replace(/\s+/g, ' ').trim() : '', want: `Notice came back on ${U.date(day, 'long')} · paper due by ${U.date(due, 'long')}`, wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
        },
        { id: k.docId, day, due }
      );
      check(`the Send on paper list has the row "${shown.want}"`, !!shown.text && shown.text.indexOf(shown.want) >= 0, shown.text);
      check('the page has no horizontal overflow at 390 wide', !shown.wide, shown);
      const logged = await fr.evaluate((id) => (window.CVPortal.state.ws.audit || []).filter((e) => e.record === id && e.action === 'Tax document notice came back').length, k.docId);
      check('one change-log entry records that the notice came back', logged === 1, logged);
      // opened again: nothing is marked twice
      await go(fr, 'console', '#view');
      await go(fr, 'console-taxdocs', '.tx');
      await fr.waitForTimeout(1200);
      const again = await fr.evaluate((id) => (window.CVPortal.state.ws.audit || []).filter((e) => e.record === id && e.action === 'Tax document notice came back').length, k.docId);
      check('opening the page again marks nothing twice', again === 1, again);
      const nv = T.noVendor(await fr.evaluate(() => document.body.innerText));
      check('no vendor, model or library name and no forbidden word on the page', nv.ok, nv.hits);
      check('no script error on the console', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      if (sc) await sc.close();
      await M.close();
    }
  },
  'mailto-desktop': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      const to = 'partner.mailto@investor.example';
      const k = await seatK1(fr, { last4: LAST4, email: to, consent: true, contact: CONTACT });
      await deliver(fr, k.batchId);
      const t = await taxOf(fr, k.docId);
      check("with no server, Deliver delivers the K-1 with the notice by the sponsor's own email", !!t && t.state === 'delivered' && !!t.notice && t.notice.how === 'own email' && !t.link, t && { state: t.state, notice: t.notice, link: t.link });
      const n = await noticeOf(fr, k);
      const want = portalNotice(n.data);
      check('the notice shows the section 7.01 subject, exactly', n.subject === SUBJECT && want.subject === SUBJECT, n.subject);
      check('the notice shows emails.js tax_notice (portal variant) for the same data, block for block', n.shown === want.text, { shown: n.shown.slice(0, 400), render: want.text.slice(0, 400) });
      const mt = T.mailtoParts(n.mailto);
      check("its Email link opens the sponsor's own email with that subject and the render's text, byte for byte", !!mt && mt.to === to && mt.subject === SUBJECT && mt.body === want.text, mt && { to: mt.to, subject: mt.subject, body: mt.body.slice(0, 300) });
      check('the Email link runs no code of the page (a plain mailto: link)', n.emailAction === '', n.emailAction);
      check("the notice says how to open and print it and names the firm's contact", /open/i.test(want.text) && /print/i.test(want.text) && [CONTACT.name, CONTACT.address, CONTACT.phone, CONTACT.email].every((x) => want.text.indexOf(x) >= 0), want.text);
      check('the notice holds no digits of the tax number on record', want.text.indexOf(LAST4) < 0 && n.shown.indexOf(LAST4) < 0, '');
      const nv = T.noVendor(`${want.subject}\n${want.text}`);
      check('the notice names no vendor, model or library and never the forbidden word', nv.ok, nv.hits);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'empty-slots': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      const k = await seatK1(fr, { last4: LAST4, email: 'partner.slots@investor.example', consent: true, contact: CONTACT });
      await deliver(fr, k.batchId);
      // the firm's contact changes after the delivery: no telephone and no email any more
      await L10.ws(fr, (w, a, NS) => NS.taxdocs.setContact(w, { phone: '', email: '' }));
      const n = await noticeOf(fr, k);
      const q = n.shown.split('\n\n').find((x) => /^Questions/.test(x)) || '';
      check(`the Questions line lists only what is there: "Questions: ${CONTACT.name}, ${CONTACT.address}."`, q === `Questions: ${CONTACT.name}, ${CONTACT.address}.`, q);
      check("no empty slot anywhere in the notice: no 'telephone ,', no 'email .', no double space", !/telephone\s*[,.]|email\s*[,.]/.test(q) && n.shown.indexOf('telephone ,') < 0 && n.shown.indexOf('email .') < 0 && n.shown.indexOf('  ') < 0 && !/,\s*[,.]/.test(n.shown), n.shown);
      check('the Email link carries the same text', (T.mailtoParts(n.mailto) || {}).body === n.shown, '');
      check('and it is the render for the same data', n.shown === portalNotice(n.data).text, n.shown.slice(0, 300));
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'log-noserver': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      const k = await seatK1(fr, { last4: LAST4, email: 'partner.copy@investor.example', consent: true, contact: CONTACT });
      await deliver(fr, k.batchId);
      const note = await fr.evaluate(() => (document.querySelector('.tx') || {}).innerText || '');
      check("the page keeps plan 10-06's line: no server, so the sponsor sends each notice from their own email", note.indexOf('No server is connected, so you send each notice from your own email: choose Notice on its row.') >= 0, note.slice(0, 400));
      await noticeOf(fr, k);
      await L10.press(fr, `[data-action=tx-notice-copy][data-doc="${k.docId}"]`);
      await fr.waitForTimeout(400);
      const log = await mailLogOf(fr, k.investorId);
      check('Copy on the notice leaves no sent-log entry (the sponsor sends it from their own email)', log.length === 0, log);
      const row = await fr.evaluate((id) => {
        const box = document.querySelector(`.tx-notice[data-doc="${id}"]`);
        const r = box && box.closest('.tx-row');
        return r ? r.innerText : '';
      }, k.docId);
      check('the row claims no sent link', !!row && !/Link sent|sent by email/i.test(row), row.slice(0, 300));
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
    const sc = await T.serverConsole(S);
    try {
      const fr2 = sc.page;
      const to = 'partner.log@investor.example';
      const k = await seatK1(fr2, { last4: LAST4, email: to, consent: true, contact: CONTACT });
      await deliver(fr2, k.batchId);
      await fr2.waitForFunction((id) => {
        const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
        return !!(d && d.tax && d.tax.link && (d.tax.link.linkId || d.tax.link.status !== 'sent'));
      }, k.docId, { timeout: 30000 }).catch(() => {});
      await fr2.waitForTimeout(400);
      const t = await taxOf(fr2, k.docId);
      const log = await mailLogOf(fr2, k.investorId);
      const msgs = await T.outbox(sc.srv, { workspace: 'kestrel-bay' });
      const m = msgs[msgs.length - 1] || {};
      const link = (String(m.text || '').match(LINK_RE) || [])[1] || '';
      const e = log[0] || {};
      check("with the server, the delivery's notice leaves one workspace sent-log entry with the server's status", log.length === 1 && !!t.link && e.status === t.link.emailStatus && e.status === 'outbox' && e.kind === 'tax_notice' && e.subject === SUBJECT && e.to === to, { log, link: t.link });
      check("its text is the server's message with the personal link replaced by [personal link]", !!link && msgs.length === 1 && e.text === String(m.text).split(link).join('[personal link]'), { entry: String(e.text || '').slice(0, 300), server: String(m.text || '').slice(0, 300) });
      check('the entry holds no link token and no digits of the tax number', String(e.text || '').indexOf('#taxdoc-') < 0 && String(e.text || '').indexOf(LAST4) < 0, '');
      check('no script error on the console', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  }
};

L.runParts(parts, { name: 'TAX NOTICE', unit: 'parts', flag: '--only', browser: true });
