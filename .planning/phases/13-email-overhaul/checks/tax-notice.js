// gate: browser
// last "TAX NOTICE: PASS (parts run: 4)"
// Plan 13-07 (EM-01, EM-08, EM-09, EM-14; Rev. Proc. 2012-17 sections 7.01 and 7.02): the tax-document notice on the one
// template set (assets/js/emails.js) and a notice that comes back starting the 30 days for paper by itself.
//   bounce-phone    the real integration server in this process, SMTP at a local stand-in relay and the provider's events
//                   signed by a local stand-in key; the console at 390x844 with touch: a K-1 for an investor with consent
//                   and a tax number on record is delivered; the server's notice is posted back as a signed permanent
//                   bounce; the Tax documents page, opened again, lists it under Send on paper as
//                   "Notice came back on <date> · paper due by <date 30 days later>"
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
  }
};

L.runParts(parts, { name: 'TAX NOTICE', unit: 'parts', flag: '--only', browser: true });
