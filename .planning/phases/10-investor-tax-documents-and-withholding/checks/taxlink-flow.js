// gate: browser
// last "TAXLINK FLOW: PASS (parts run: 1)"
// A tax document delivered to the investor's own device through the firm's server (plan 10-12, C-04, TAX-04 to TAX-06).
// The real server code (server/index.mjs) runs in this check's process (P6/lib.js serverPortal); the console is a normal
// page connected to it, and the investor's device is a second browser context at 390x844 with touch and no portal data.
//   open-phone     an investor who has consented, with a tax number ending 6789 on record: Deliver; the row says the link
//                  was sent; the server's outbox holds one message with the section 7.01 subject; the second browser opens
//                  its link: the firm's name, the title and the four-digit field, nothing of the document; with 6789 the
//                  pages are drawn and Save is offered; back on the console, the row reads opened once on their device
//   consent-phone  an investor with no consent: the K-1 waits and its link is still sent; the message asks for consent and
//                  is not the notice; the screen shows every disclosure of NS.taxdocs.CONSENT.lines and no page; the digits
//                  alone open nothing; with the consent the pages are drawn and the section 7.01 notice follows; the
//                  console, opened again, has the consent on the investor (given at the link) and the K-1 delivered
//   wrong          five wrong sets of digits: one plain line each with the tries left, then locked; the sponsor's row
//                  reads locked with Resend; after Resend the new link opens with the right digits and the old one does not
//   withdrawn      Withdraw on the console also withdraws on the server (its file removed); the link then says in one
//                  line that the document is no longer available and shows nothing else
//   notice         an investor with no tax number on record: no call, the row says to send on paper, the paper list keeps
//                  them; a second investor's screen and both messages name no vendor and never the forbidden word and hold
//                  no taxpayer number; a link whose server the page does not trust is refused and nothing is fetched
//   noserver       lib10's frame at 390x844 (every connection refused), no server connected: Deliver works as plan 10-06
//                  left it, with that plan's one line about the sponsor's own email; nothing fetched, nothing refused
//   NODE_PATH=$(npm root -g) node taxlink-flow.js [--only part1,part2]
// Every number is invented. The last line is "TAXLINK FLOW: PASS (parts run: N)" or "TAXLINK FLOW: FAIL (parts run: N) - <parts>".
const T = require('./lib10.js');
const K = require('./k1-build.js');
const Lib = T.Lib;

const SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
const CONTACT = { name: 'Kestrel Bay Investor Relations', address: '1 Market Street, Wilmington, DE 19801', phone: '(212) 555-0148', email: 'tax@example.invalid' };
const LINK_RE = /(https?:\/\/[^\s"<>]+#taxdoc-[A-Za-z0-9_-]{43})/;

/** A small PDF of two text pages standing for one investor's K-1 (invented content). */
async function k1Pdf(label) {
  const L = require(K.libs().write);
  const pdf = await L.PDFDocument.create();
  const font = await pdf.embedFont(L.StandardFonts.Helvetica);
  ['Schedule K-1 (Form 1065) 2025', 'Part III'].forEach((t, k) => {
    const pg = pdf.addPage([612, 792]);
    pg.drawText(`${t} ${label} page ${k + 1}`, { x: 60, y: 720, size: 14, font });
  });
  return Buffer.from(await pdf.save());
}

/** The console: a normal page (diy.html) allowed to reach the check's server, the Kestrel Bay sample signed in as admin. */
async function consoleOf(S, srv) {
  const A = await Lib.open(S, { allow: [srv.base], init: srv.init, context: T.VIEW.desktop });
  await A.page.goto(S.base);
  await A.page.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state));
  await T.sample(A.page, { role: 'admin' });
  const on = await srv.configure(A.page);
  if (!on) throw new Error('the console did not take the server settings');
  await A.page.waitForFunction(() => !!(window.CVPortal.taxUI && window.CVPortal.taxUI.link), null, { timeout: 15000 }).catch(() => {});
  return A;
}

/**
 * One confirmed K-1 for one investor of the first fund: the investor gets the given last four (or none) and email,
 * consent as asked, the firm's contact is set, and the document's file is in the browser's file store.
 * Resolves to { docId, investorId, batchId, sha256 }.
 */
async function seatK1(page, o) {
  const bytes = await k1Pdf(o.label || 'A');
  return page.evaluate(
    async ({ b64, o, contact }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const TD = NS.taxdocs;
      const off = ws.offerings[0];
      const inv = ws.investors.filter((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.some((p) => p.offeringId === off.id))[o.nth || 0];
      ['taxCert', 'taxW8', 'taxForm', 'taxDelivery'].forEach((k) => delete inv[k]);
      inv.tinLast4 = o.last4 || '';
      inv.email = o.email;
      TD.setContact(ws, contact);
      if (o.consent) TD.consent(ws, inv.id, { where: 'portal' });
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const b = TD.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: off.id, fileName: 'k1-2025.pdf', pages: 2, by: 'Check admin', split: { packages: [], loose: [1, 2], scan: false } });
      const p = TD.addPackage(ws, b.id, { first: 1, last: 2, by: 'Check admin' });
      TD.confirm(ws, b.id, p.id, { investorId: inv.id, by: 'Check admin' });
      const id = 'txl' + Math.random().toString(36).slice(2, 10).replace(/[0-9]/g, 'x');
      const sha256 = NS.audit.sha256(u8);
      const doc = TD.toDocument(ws, b.id, p.id, { id, title: 'Schedule K-1 (Form 1065) 2025', fileName: `k1-1065-2025-${inv.id}.pdf`, size: u8.length, sha256, by: 'Check admin' });
      await NS.ops.files.put(doc.id, new Blob([u8], { type: 'application/pdf' }));
      NS.app.save(true);
      return { docId: doc.id, investorId: inv.id, batchId: b.id, sha256 };
    },
    { b64: bytes.toString('base64'), o, contact: CONTACT }
  );
}

async function go(page, route, sel) {
  await page.evaluate((r) => (location.hash = '#' + r), route);
  await page.waitForSelector(sel, { timeout: 20000 });
  await page.waitForTimeout(400);
}
/** Deliver on the import's page (the list of recipients, then Deliver to these). */
async function deliver(page, batchId) {
  await go(page, `console-taxdocs-batch-${batchId}`, '.tx');
  await T.press(page, '[data-action=tx-deliver]');
  await page.waitForTimeout(400);
  await T.press(page, '[data-action=tx-deliver-go]');
  await page.waitForTimeout(600);
}
/** The document's row text on its import's page. */
const rowText = (page, docId) =>
  page.evaluate((id) => {
    const b = window.CVPortal.state.ws.taxdocs.batches.find((x) => x.packages.some((p) => p.docId === id));
    const p = b && b.packages.find((x) => x.docId === id);
    const r = p && document.querySelector(`.tx-row[data-id="${p.id}"]`);
    return r ? r.innerText.replace(/\s+/g, ' ').trim() : '';
  }, docId);
/** The server's outbox for the sample firm, newest first. */
async function outbox(srv) {
  const r = await srv.call('GET', '/v1/outbox?workspace=kestrel-bay');
  return (r.body && r.body.messages) || [];
}
const linkIn = (m) => (String((m && m.text) || '').match(LINK_RE) || [])[1] || '';

/** The investor's device: a fresh context at 390x844 with touch, no portal data, allowed to reach the check's server. */
async function phoneOf(S, srv) {
  const B = await Lib.open(S, { allow: [srv.base], init: srv.init, context: T.VIEW.phone });
  B.page.p10 = { size: 'phone' };
  return B;
}
/** What the investor's screen shows now. */
const screen = (page) =>
  page.evaluate(() => {
    const v = document.querySelector('#view');
    const imgs = Array.from(document.querySelectorAll('.txl img.doc-page'));
    return {
      text: v ? v.innerText : '',
      field: !!document.querySelector('#txl-last4'),
      pages: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      save: !!document.querySelector('[data-action=txl-save]'),
      out: (() => {
        const a = document.querySelector('a.txl-out');
        if (!a) return false;
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })()
    };
  });
async function waitScreen(page, test, ms) {
  await page.waitForFunction(test, null, { timeout: ms || 30000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(300);
  return screen(page);
}
async function typeDigits(page, digits) {
  await page.fill('#txl-last4', digits);
  await T.press(page, '[data-action=txl-open]');
}

/* ---------- parts ---------- */
async function openPhone(check, S) {
  const srv = await Lib.serverPortal(S);
  try {
    const A = await consoleOf(S, srv);
    const page = A.page;
    const k = await seatK1(page, { last4: '6789', email: 'partner1@example.com', consent: true });
    await deliver(page, k.batchId);
    await page.waitForFunction((id) => {
      const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
      return !!(d && d.tax && d.tax.link && d.tax.link.linkId);
    }, k.docId, { timeout: 30000 }).catch(() => {});
    const doc = await page.evaluate((id) => {
      const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
      return { state: d.tax.state, link: d.tax.link || null };
    }, k.docId);
    check('Deliver delivers the K-1 and sends it to the server: the document holds the link id and the email status', doc.state === 'delivered' && !!(doc.link && /^txd_/.test(doc.link.linkId) && doc.link.emailStatus === 'outbox'), doc);
    await go(page, `console-taxdocs-batch-${k.batchId}`, '.tx');
    let row = await rowText(page, k.docId);
    check("the row says the link was sent to the investor's email", /Link sent/i.test(row), row);
    const msgs = await outbox(srv);
    const link = linkIn(msgs[0]);
    check('the server\'s outbox holds one message, with the section 7.01 subject and a link that ends in #taxdoc- and a token', msgs.length === 1 && msgs[0].subject === SUBJECT && !!link && msgs[0].to === 'partner1@example.com', msgs.map((m) => ({ subject: m.subject, to: m.to, link: !!linkIn(m) })));
    check('the message holds no taxpayer number and no four digits of it', msgs.length === 1 && !/6789/.test(`${msgs[0].text}\n${msgs[0].html}`), '');
    check('the message says how to open, save and print the document', msgs.length === 1 && /open/i.test(msgs[0].text) && /save/i.test(msgs[0].text) && /print/i.test(msgs[0].text), (msgs[0] || {}).text);
    // the investor's device
    const B = await phoneOf(S, srv);
    try {
      await B.page.goto(link || `${S.base}#taxdoc-none`);
      let s = await waitScreen(B.page, () => !!document.querySelector('#txl-last4') || /no longer|not work/i.test((document.querySelector('#view') || {}).innerText || ''));
      check("on the investor's device the link opens one screen: the firm's name, the document's title and the four-digit field", s.field && /Kestrel Bay Capital/.test(s.text) && /Schedule K-1 \(Form 1065\) 2025/.test(s.text), s.text.slice(0, 300));
      check('nothing of the document is shown before the four digits', s.pages === 0 && !s.save, s);
      check('a way out to the portal is on screen', s.out, s);
      await typeDigits(B.page, '6789');
      s = await waitScreen(B.page, () => Array.from(document.querySelectorAll('.txl img.doc-page')).some((i) => i.complete && i.naturalWidth > 0), 60000);
      check('with 6789 the pages are drawn in the page and Save is offered', s.pages === 2 && s.save, s);
      check('the way out is still on screen', s.out, s);
      const leak = Lib.leakCheck(s.text);
      check("the investor's screen names no vendor, model or library and never the forbidden word", leak.ok, leak.hits);
      check("no script error on the investor's device", B.errors.length === 0, B.errors);
      check("the investor's device reached nothing outside the portal and the firm's server", B.net.external.length === 0, B.net.external);
    } finally {
      await B.context.close().catch(() => {});
    }
    // back on the console
    await go(page, 'console', '#view');
    await go(page, `console-taxdocs-batch-${k.batchId}`, '.tx');
    await page.waitForFunction((id) => {
      const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
      return !!(d && d.tax.opens && d.tax.opens.count === 1);
    }, k.docId, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    row = await rowText(page, k.docId);
    const opens = await page.evaluate((id) => window.CVPortal.state.ws.docs.find((x) => x.id === id).tax.opens, k.docId);
    check('back on the console, opening Tax documents again shows the row as opened once on their device', opens.count === 1 && /Opened once on their device/i.test(row), { row, opens });
    check('no script error on the console', A.errors.length === 0, A.errors);
    await A.context.close().catch(() => {});
  } finally {
    await srv.close();
  }
}

/** The console with one delivered (or waiting) K-1 and the link the server sent for it. */
async function delivered(S, srv, o) {
  const A = await consoleOf(S, srv);
  const k = await seatK1(A.page, o);
  await deliver(A.page, k.batchId);
  await A.page.waitForFunction((id) => {
    const d = window.CVPortal.state.ws.docs.find((x) => x.id === id);
    return !!(d && d.tax && d.tax.link && (d.tax.link.linkId || d.tax.link.status !== 'sent'));
  }, k.docId, { timeout: 20000 }).catch(() => {});
  const msgs = await outbox(srv);
  return { A, page: A.page, k, msgs, link: linkIn(msgs[0]) };
}
const docOf = (page, id) =>
  page.evaluate((id) => {
    const NS = window.CVPortal;
    const d = NS.state.ws.docs.find((x) => x.id === id);
    const inv = NS.state.ws.investors.find((i) => i.id === d.investors[0]);
    return { state: d.tax.state, link: d.tax.link || null, consent: inv.taxDelivery || null, hidden: d.hidden };
  }, id);
/** The console's Tax documents page opened again (so it reads the server's list), then the import's page. */
async function reopen(page, batchId, test, arg) {
  await go(page, 'console', '#view');
  await go(page, `console-taxdocs-batch-${batchId}`, '.tx');
  if (test) await page.waitForFunction(test, arg, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function consentPhone(check, S) {
  const srv = await Lib.serverPortal(S);
  try {
    const { A, page, k, msgs, link } = await delivered(S, srv, { last4: '6789', email: 'partner2@example.com', consent: false });
    const lines = await page.evaluate(() => window.CVPortal.taxdocs.CONSENT.lines({}).map((l) => l.text));
    let d = await docOf(page, k.docId);
    check('with no consent in effect, Deliver holds the K-1 back (waiting) and still sends it to the server', d.state === 'waiting' && !!(d.link && d.link.linkId), d);
    check('the first message asks for consent and does not carry the section 7.01 subject', msgs.length === 1 && msgs[0].subject !== SUBJECT && /consent/i.test(msgs[0].subject) && /consent/i.test(msgs[0].text) && !!link, msgs.map((m) => m.subject));
    let row = await rowText(page, k.docId);
    check('the row says the link asks for consent first', /asks for consent/i.test(row), row);
    const B = await phoneOf(S, srv);
    try {
      await B.page.goto(link || `${S.base}#taxdoc-none`);
      let s = await waitScreen(B.page, () => !!document.querySelector('#txl-last4'));
      const shown = await B.page.evaluate(() => Array.from(document.querySelectorAll('[data-txl=consent] p')).map((p) => p.innerText.trim()));
      check(`on the investor's device the screen shows the consent's ${lines.length} disclosures as the portal gives them, and the four-digit field`, s.field && shown.length === lines.length && lines.every((l, i) => shown[i] === l.replace(/\s+/g, ' ').trim()), { shown: shown.length, want: lines.length });
      check('no page of the document is shown before the four digits and the consent', s.pages === 0 && !s.save, s);
      await B.page.fill('#txl-last4', '6789');
      await T.press(B.page, '[data-action=txl-open]');
      await B.page.waitForTimeout(800);
      s = await screen(B.page);
      check('the four digits without the consent open nothing and one line says so', s.pages === 0 && /tick the box to consent/i.test(s.text), s.text.slice(0, 400));
      await T.press(B.page, '#txl-consent');
      await typeDigits(B.page, '6789');
      s = await waitScreen(B.page, () => Array.from(document.querySelectorAll('.txl img.doc-page')).some((i) => i.complete && i.naturalWidth > 0), 60000);
      check('after the four digits and the consent the pages are drawn and Save is offered', s.pages === 2 && s.save, s);
      check("no script error on the investor's device", B.errors.length === 0, B.errors);
    } finally {
      await B.context.close().catch(() => {});
    }
    const after = await outbox(srv);
    check('a second message, with the section 7.01 subject, is in the outbox', after.length === 2 && after[0].subject === SUBJECT, after.map((m) => m.subject));
    await reopen(page, k.batchId, (id) => window.CVPortal.state.ws.docs.find((x) => x.id === id).tax.state === 'delivered', k.docId);
    d = await docOf(page, k.docId);
    check('the console, opened again, has the consent on the investor (given at the link) and the K-1 delivered', d.state === 'delivered' && !d.hidden && !!d.consent && d.consent.where === 'link' && !!d.consent.at && !d.consent.withdrawnAt, d);
    const log = await page.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Tax document consent given').map((e) => e.detail));
    check('the change log has the consent, given at the link', log.some((x) => /given in the link/.test(x)), log);
    check('no script error on the console', A.errors.length === 0, A.errors);
    await A.context.close().catch(() => {});
  } finally {
    await srv.close();
  }
}

async function wrongPart(check, S) {
  const srv = await Lib.serverPortal(S);
  try {
    const { A, page, k, link } = await delivered(S, srv, { last4: '6789', email: 'partner3@example.com', consent: true });
    const B = await phoneOf(S, srv);
    try {
      await B.page.goto(link || `${S.base}#taxdoc-none`);
      await waitScreen(B.page, () => !!document.querySelector('#txl-last4'));
      const seen = [];
      for (let n = 1; n <= 5; n++) {
        if (!(await B.page.locator('#txl-last4').count())) break;
        await typeDigits(B.page, '1111');
        await B.page.waitForFunction((n) => {
          const t = (document.querySelector('#view') || {}).innerText || '';
          return /locked/i.test(t) || new RegExp(`${5 - n} tr(y|ies) left`).test(t);
        }, n, { timeout: 10000 }).catch(() => {});
        await B.page.waitForTimeout(200);
        seen.push(await B.page.evaluate(() => ({ alerts: Array.from(document.querySelectorAll('#view [role=alert]')).map((x) => x.innerText.trim()), field: !!document.querySelector('#txl-last4'), pages: document.querySelectorAll('.txl img.doc-page').length })));
      }
      const first4 = seen.slice(0, 4);
      check('each of the first four wrong sets of digits shows one plain line with the tries left, and nothing of the document', first4.length === 4 && first4.every((x, i) => x.alerts.length === 1 && x.alerts[0].indexOf(`${4 - i} ${4 - i === 1 ? 'try' : 'tries'} left`) >= 0 && x.pages === 0), first4);
      const fifth = seen[4] || {};
      check('the fifth says the link is locked; the field is gone and nothing of the document is shown', fifth.alerts && fifth.alerts.length === 1 && /locked/i.test(fifth.alerts[0]) && !fifth.field && fifth.pages === 0, fifth);
    } finally {
      await B.context.close().catch(() => {});
    }
    await reopen(page, k.batchId, (id) => (window.CVPortal.state.ws.docs.find((x) => x.id === id).tax.link || {}).status === 'locked', k.docId);
    const row = await rowText(page, k.docId);
    check("the sponsor's row reads locked, with Resend", /locked/i.test(row) && /Resend/.test(row), row);
    const doc = await page.evaluate((id) => window.CVPortal.state.ws.docs.find((x) => x.id === id), k.docId);
    const rowId = await page.evaluate((id) => {
      const b = window.CVPortal.state.ws.taxdocs.batches.find((x) => x.packages.some((p) => p.docId === id));
      return b.packages.find((p) => p.docId === id).id;
    }, k.docId);
    await T.press(page, `.tx-row[data-id="${rowId}"] [data-action=txl-resend]`);
    await page.waitForFunction(() => true, null);
    await page.waitForTimeout(1500);
    const msgs = await outbox(srv);
    const link2 = linkIn(msgs[0]);
    check('after Resend a new message holds a new link', msgs.length === 2 && !!link2 && link2 !== link && !!doc, msgs.length);
    const C = await phoneOf(S, srv);
    try {
      await C.page.goto(link2 || `${S.base}#taxdoc-none`);
      await waitScreen(C.page, () => !!document.querySelector('#txl-last4'));
      await typeDigits(C.page, '6789');
      const s = await waitScreen(C.page, () => Array.from(document.querySelectorAll('.txl img.doc-page')).some((i) => i.complete && i.naturalWidth > 0), 60000);
      check("the new message's link opens with the right digits: the pages are drawn", s.pages === 2 && s.save, s);
      await C.page.goto(link || `${S.base}#taxdoc-none`);
      const old = await waitScreen(C.page, () => /no longer available|locked/i.test((document.querySelector('#view') || {}).innerText || ''));
      check('the old link no longer opens', /no longer available/i.test(old.text) && !old.field, old.text.slice(0, 200));
    } finally {
      await C.context.close().catch(() => {});
    }
    check('no script error on the console', A.errors.length === 0, A.errors);
    await A.context.close().catch(() => {});
  } finally {
    await srv.close();
  }
}

async function withdrawnPart(check, S) {
  const srv = await Lib.serverPortal(S);
  try {
    const { A, page, k, link } = await delivered(S, srv, { last4: '6789', email: 'partner4@example.com', consent: true });
    await go(page, `console-taxdocs-batch-${k.batchId}`, '.tx');
    const rowId = await page.evaluate((id) => {
      const b = window.CVPortal.state.ws.taxdocs.batches.find((x) => x.packages.some((p) => p.docId === id));
      return b.packages.find((p) => p.docId === id).id;
    }, k.docId);
    await T.press(page, `.tx-row[data-id="${rowId}"] [data-action=tx-withdraw]`);
    await page.waitForSelector('#tx-why', { timeout: 10000 });
    await page.fill('#tx-why', 'Sent to the wrong investor');
    await T.press(page, '[data-action=tx-withdraw-go]');
    await page.waitForTimeout(1500);
    const d = await docOf(page, k.docId);
    const server = (await srv.call('GET', '/v1/taxdocs?workspace=kestrel-bay')).body.documents || [];
    check('Withdraw on the console withdraws the document there and on the server', d.state === 'withdrawn' && server.length === 1 && server[0].status === 'withdrawn' && !!(d.link && d.link.status === 'withdrawn'), { local: d.state, server: server.map((x) => x.status) });
    const blobs = srv.server.store.list('taxdocs').map((r) => r.blob).filter(Boolean);
    check('its file is removed from the server', blobs.length === 0, blobs.length);
    const B = await phoneOf(S, srv);
    try {
      await B.page.goto(link || `${S.base}#taxdoc-none`);
      const s = await waitScreen(B.page, () => /no longer available/i.test((document.querySelector('#view') || {}).innerText || ''));
      const main = await B.page.evaluate(() => {
        const m = document.querySelector('.txl .pt-wrap');
        return m ? Array.from(m.children).filter((c) => !c.classList.contains('txl-way')).map((c) => c.innerText.trim()) : [];
      });
      check("the investor's link says in one line that the document is no longer available and shows nothing else", main.length === 1 && main[0] === 'This document is no longer available.' && !s.field && s.pages === 0 && !s.save && !/Schedule K-1/.test(s.text), { main, text: s.text.slice(0, 200) });
      check("no script error on the investor's device", B.errors.length === 0, B.errors);
    } finally {
      await B.context.close().catch(() => {});
    }
    check('no script error on the console', A.errors.length === 0, A.errors);
    await A.context.close().catch(() => {});
  } finally {
    await srv.close();
  }
}

async function noticePart(check, S) {
  const srv = await Lib.serverPortal(S);
  try {
    // an investor with no tax number on record and no consent: no call, the row says paper, the paper list keeps them
    const { A, page, k, msgs } = await delivered(S, srv, { last4: '', email: 'partner5@example.com', consent: false, nth: 0 });
    const server = (await srv.call('GET', '/v1/taxdocs?workspace=kestrel-bay')).body.documents || [];
    check('for an investor with no tax number on record the console makes no call: the server holds nothing and sent nothing', server.length === 0 && msgs.length === 0, { server: server.length, msgs: msgs.length });
    await go(page, `console-taxdocs-batch-${k.batchId}`, '.tx');
    const row = await rowText(page, k.docId);
    check('the row says to send it on paper', /no tax number on record/i.test(row) && /send it on paper/i.test(row), row);
    await go(page, 'console-taxdocs', '#tx-files');
    const paper = await page.evaluate(() => Array.from(document.querySelectorAll('[data-list="paper"] .tx-row')).map((r) => r.getAttribute('data-id')));
    check("the investor stays on plan 10-06's send-on-paper list", paper.indexOf(k.docId) >= 0, paper);
    // a second investor, with a number and no consent: both messages and the screen, read for names that must not appear
    const k2 = await seatK1(page, { last4: '4321', email: 'partner6@example.com', consent: false, nth: 1, label: 'B' });
    await deliver(page, k2.batchId);
    await page.waitForFunction((id) => !!((window.CVPortal.state.ws.docs.find((x) => x.id === id).tax.link || {}).linkId), k2.docId, { timeout: 20000 }).catch(() => {});
    const first = await outbox(srv);
    const link = linkIn(first[0]);
    const B = await phoneOf(S, srv);
    let texts = [];
    try {
      await B.page.goto(link || `${S.base}#taxdoc-none`);
      let s = await waitScreen(B.page, () => !!document.querySelector('#txl-last4'));
      texts.push(s.text);
      await T.press(B.page, '#txl-consent');
      await typeDigits(B.page, '4321');
      s = await waitScreen(B.page, () => Array.from(document.querySelectorAll('.txl img.doc-page')).some((i) => i.complete && i.naturalWidth > 0), 60000);
      texts.push(s.text);
      check('the second investor opens it after consenting (two messages follow)', s.pages === 2, s);
    } finally {
      await B.context.close().catch(() => {});
    }
    const both = (await outbox(srv)).filter((m) => m.to === 'partner6@example.com');
    check('both messages are there: the request for consent and the section 7.01 notice', both.length === 2 && both.some((m) => m.subject === SUBJECT) && both.some((m) => m.subject !== SUBJECT), both.map((m) => m.subject));
    const all = texts.concat(both.map((m) => `${m.subject}\n${m.text}\n${m.html}`));
    const leak = Lib.leakCheck(all.join('\n'));
    check("the investor's screen and both messages name no vendor, model or library and never the forbidden word", leak.ok, leak.hits);
    check('neither message holds a taxpayer number or its four digits', both.every((m) => !/4321/.test(`${m.text}${m.html}`) && !/\d{3}-\d{2}-\d{4}/.test(`${m.text}${m.html}`)), '');
    // a link whose server is not one the page trusts: refused as an invitation's is, and nothing is fetched
    const C = await Lib.open(S, { allow: [srv.base], context: T.VIEW.phone });
    try {
      await C.page.goto(link || `${S.base}#taxdoc-none`);
      const s = await waitScreen(C.page, () => /does not work here/i.test((document.querySelector('#view') || {}).innerText || ''));
      check('a link to a server the page does not trust is refused with one line, and nothing is fetched from it', /This link does not work here/.test(s.text) && !s.field && C.net.allowed.length === 0, { text: s.text.slice(0, 200), fetched: C.net.allowed });
    } finally {
      await C.context.close().catch(() => {});
    }
    check('no script error on the console', A.errors.length === 0, A.errors);
    await A.context.close().catch(() => {});
  } finally {
    await srv.close();
  }
}

async function noServer(check, S) {
  const { A, fr } = await T.framed(S, 'phone', { policy: 'self' });
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  await fr.waitForFunction(() => !!(window.CVPortal.taxUI && window.CVPortal.taxUI.link), null, { timeout: 15000 }).catch(() => {});
  const loaded = await fr.evaluate(() => !!(window.CVPortal.taxUI && window.CVPortal.taxUI.link) && !window.CVPortal.taxUI.link.connected(window.CVPortal.state.ws));
  check('the link is loaded and, with no server on the Integrations page, not connected', loaded, loaded);
  const k = await seatK1(fr, { last4: '6789', email: 'partner7@example.com', consent: true });
  await deliver(fr, k.batchId);
  const d = await docOf(fr, k.docId);
  check('Deliver works as plan 10-06 left it: the K-1 is delivered and nothing about a link is stored', d.state === 'delivered' && !d.link, d);
  const note = await fr.evaluate(() => Array.from(document.querySelectorAll('.tx-note')).map((x) => x.innerText.trim()).filter((t) => /own email/i.test(t)));
  check("the page shows that plan's one line about the sponsor's own email", note.length === 1, note);
  const row = await rowText(fr, k.docId);
  check('the row has no line about a link', !/link/i.test(row.replace(/Notice/g, '')), row);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  await A.context.close().catch(() => {});
}

Lib.runParts(
  {
    'open-phone': ({ check, S }) => openPhone(check, S),
    'consent-phone': ({ check, S }) => consentPhone(check, S),
    wrong: ({ check, S }) => wrongPart(check, S),
    withdrawn: ({ check, S }) => withdrawnPart(check, S),
    notice: ({ check, S }) => noticePart(check, S),
    noserver: ({ check, S }) => noServer(check, S)
  },
  { name: 'TAXLINK FLOW', unit: 'parts', flag: '--only', browser: true }
);
