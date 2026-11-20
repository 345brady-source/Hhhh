// gate: browser
// last "TAXLINK FLOW: PASS (parts run: 1)"
// A tax document delivered to the investor's own device through the firm's server (plan 10-12, C-04, TAX-04 to TAX-06).
// The real server code (server/index.mjs) runs in this check's process (P6/lib.js serverPortal); the console is a normal
// page connected to it, and the investor's device is a second browser context at 390x844 with touch and no portal data.
//   open-phone     an investor who has consented, with a tax number ending 6789 on record: Deliver; the row says the link
//                  was sent; the server's outbox holds one message with the section 7.01 subject; the second browser opens
//                  its link: the firm's name, the title and the four-digit field, nothing of the document; with 6789 the
//                  pages are drawn and Save is offered; back on the console, the row reads opened once on their device
//   NODE_PATH=$(npm root -g) node taxlink-flow.js [--only part1,part2]
// Every number is invented. The last line is "TAXLINK FLOW: PASS (parts run: N)" or "TAXLINK FLOW: FAIL (parts run: N) - <parts>".
const path = require('path');
const fs = require('fs');
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
const linkIn = (m) => ((m && (m.text || '')).match(LINK_RE) || [])[1] || '';

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

Lib.runParts(
  {
    'open-phone': ({ check, S }) => openPhone(check, S)
  },
  { name: 'TAXLINK FLOW', unit: 'parts', flag: '--only', browser: true }
);
