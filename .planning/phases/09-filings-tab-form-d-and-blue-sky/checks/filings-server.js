// gate: browser
// last "FILINGS SERVER: PASS (parts run: 7)"
// Plan 09-09: the link between the Filings tab and the filing server. The real server (server/index.mjs with the filings
// module on) runs in this check's own process on a free local port, with invented tokens, an invented DATA_KEY, the
// invented CCCs of server/test/fixtures/filings-kit.mjs, a fetch stand-in that records every outside call (none may be
// made) and the recorded EDGAR transport (never asked: staff record each outcome with the outcome call, as C-01 sets out).
// The server's clock is pinned to 15:00 UTC on the latest business day on or before today, so the notice's dates agree
// with the server's own today on any day the check runs. The browser may reach only that server; every other outside
// request is refused, and this process refuses every outside fetch of its own.
//   send-phone   on a 390x844 touch screen: a Rule 506(b) offering with a notice signed off (a masked filed notice,
//                completed) and its order recorded; the tab shows the order with Send and no notice about connecting;
//                Send; the row says received; staff list one order at $100, one email to the staff address; staff record
//                the issuer's CCC and EDGAR name and download the TEST file, which validates against the SEC schema and
//                holds the CCC, the filer contact and the sponsor's answers; staff record the test as accepted; Check now
//                shows the test passed; no CCC in the page's storage or in any answer the page received
//   send-desktop the same path at 1280x800; a team member sees the order's state and has no Send
//   outcome      a server that may file LIVE (outside tests, EDGAR_ALLOW_LIVE=1): staff record the test, then the live
//                filing; Check now shows it filed with its accession number and date; the record holds it with a snapshot;
//                the first Form D reminder is gone, the annual amendment shows its date; the order reads done
//   suspended    a suspended test with an error (angle brackets in it) and a warning: both as plain text under the order
//                with the way to correct; corrected, signed off again and sent: the server holds the same order, received
//   guard        on a test server LIVE is refused and nothing reads as filed; another portal's key changes nothing; a
//                staff cancel reads cancelled; a server with the module off (404) or not set up (on: false): the tab's
//                one line and no Send
//   offline-framed  inside the frame that refuses every connection, at 390x844, with a server address set: Send says in
//                one plain line that the server could not be reached; the order stays recorded; no error is thrown
//   states       a state notice order for New York and California (NS.bluesky.placeOrder) sent with its package; staff
//                record New York's result only: Check now reads "Partly filed (1 of 2)" with California still open (the
//                server still says received); staff record California's: both states filed with date, filing ID and fee
//                paid, New York's renewal reminder with its date, the order done
//   NODE_PATH=$(npm root -g) node filings-server.js [--only send-phone,send-desktop,outcome,suspended,guard,offline-framed,states]
// The last line is "FILINGS SERVER: PASS (parts run: N)" or "FILINGS SERVER: FAIL (parts run: N) - <failed parts>". The
// two marker lines above are read by gate9.sh. A CCC is never printed: every check about one reports only true or false.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const L9 = require('./lib9.js');

const ROOT = Lib.ROOT;
const OUT = path.join(Lib.OUT, 'filings-server');
fs.mkdirSync(OUT, { recursive: true });
Lib.describeShots([
  [/-before\.png$/, 'The Filings tab with a signed-off Form D order, connected to a filing server: the order with its Send control.'],
  [/-received\.png$/, 'The same order once sent: received by the filing team.'],
  [/-test-passed\.png$/, 'After Check now: the test filing passed.'],
  [/-suspended\.png$/, 'After Check now: the test filing was suspended, with EDGAR\'s messages in plain text and the way to correct the notice.'],
  [/-filed\.png$/, 'After Check now: the notice is filed, with its accession number, the filing date and the next annual amendment date.'],
  [/-offline\.png$/, 'Inside the preview frame with a server address that cannot be reached: one plain line under the order, which stays recorded.'],
  [/-states\.png$/, 'A state notice order after Check now: each state filed with its date, filing ID and fee paid.']
]);

const SCHEMA = path.join(ROOT, 'server/test/fixtures/formd/schema/formDSubmission.xsd.xml');
const NOTICE = path.join(ROOT, 'server/test/fixtures/formd/real/real-07-D.xml');
const EDGAR_DIR = path.join(ROOT, 'server/test/fixtures/edgar');
/** A CIK from a range the SEC has never issued (the masked fixture's own). */
const CIK = '9000000001';
const EDGAR_NAME = 'MASKED ENTITY 01';
const SIGNER = { name: 'Dana Reyes', title: 'Managing Member' };
const NAV = '.cs-nav a[href="#console-filings"]';
const FL = require(path.join(ROOT, 'assets/js/filings.js'));
const url = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

/* ---------- The pinned day ---------- */
const pad = (n) => String(n).padStart(2, '0');
/** Today as the page writes it (NS.dates.today: the local calendar day). */
function localToday() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
/** The latest business day (no weekend, no federal holiday) on or before a day. */
function businessOnOrBefore(day) {
  let d = day;
  for (;;) {
    const w = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (w !== 0 && w !== 6 && FL.holidays(Number(d.slice(0, 4))).indexOf(d) < 0) return d;
    d = L9.iso(d, -1);
  }
}
const PINNED = businessOnOrBefore(localToday());
const NOW = Date.parse(`${PINNED}T15:00:00Z`);

/* ---------- Outside calls from this process: none ---------- */
const outsideHere = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (u, init) => {
  let host = '';
  try {
    host = new URL(String(u && u.url ? u.url : u)).hostname;
  } catch (e) {
    host = '';
  }
  if (host !== '127.0.0.1') {
    outsideHere.push(host || 'unknown');
    return Promise.reject(new Error('this check makes no outside call'));
  }
  return realFetch(u, init);
};

let kit = null;
const K = async () => (kit = kit || (await import(url('server/test/filings-kit.mjs'))));
/** Does a text hold any invented CCC? Only true or false ever leaves this function. */
const holdsCcc = async (text) => (await K()).holdsCode(String(text)) >= 0;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = require('net').createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

/**
 * The filing server, the real code, in this process. over.env is laid over kit.ENV plus NODE_ENV test, a random API_TOKEN,
 * PORTAL_ORIGIN (the check's page) and PUBLIC_URL; a value of undefined removes a setting. Every answer the check receives
 * (except the Form D file, where the CCC belongs) is kept in seen for the CCC search.
 */
async function filingServer(S, over) {
  const k = await K();
  const { createServer } = await import(url('server/index.mjs'));
  const { openStore } = await import(url('server/lib/store.mjs'));
  const { recordedTransport } = await import(url('server/filing/edgar.mjs'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const token = crypto.randomBytes(24).toString('hex');
  const env = Object.assign({}, k.ENV, { NODE_ENV: 'test', API_TOKEN: token, PORTAL_ORIGIN: S.origin, PUBLIC_URL: base }, (over && over.env) || {});
  Object.keys(env).forEach((x) => env[x] === undefined && delete env[x]);
  const outside = [];
  const recorder = async (u) => {
    outside.push(String(u).slice(0, 60));
    throw new Error('this check makes no outside call');
  };
  const transport = recordedTransport({ operational: 'operational-open', submit: 'submission-accepted', status: 'status-accepted' }, EDGAR_DIR);
  const server = createServer({ env, store: openStore(null), fetch: recorder, now: () => NOW, edgarTransport: transport });
  await new Promise((r, j) => {
    server.once('error', j);
    server.listen(port, '127.0.0.1', r);
  });
  const seen = [];
  const json = async (method, p, tok, body) => {
    const res = await realFetch(base + p, { method, headers: Object.assign({ Authorization: `Bearer ${tok}` }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    seen.push(text);
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }
    return { status: res.status, body: data };
  };
  return {
    base,
    token,
    server,
    outside,
    transport,
    seen,
    call: (method, p, body) => json(method, p, token, body),
    staff: (method, p, body) => json(method, p, k.STAFF, body),
    /** The staff file call as a command-line tool makes it (no Origin, no Sec-Fetch-Mode). Its text is never kept or printed. */
    file: (id, mode) =>
      new Promise((resolve, reject) => {
        const req = http.request(`${base}/v1/filings/staff/orders/${id}/file?mode=${mode}`, { method: 'GET', headers: { Authorization: `Bearer ${k.STAFF}` } }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.end();
      }),
    mail: () => server.invitations.mailer.outbox({}).filter((m) => m.kind === 'filing_order'),
    /** The console uses this server, as P6/lib.js configure does. */
    configure: (F) =>
      F.fr.evaluate(
        ({ base, token }) => {
          const NS = window.CVPortal;
          const s = NS.integrations.ensure(NS.state.ws).server;
          s.url = base;
          s.token = token;
          NS.app.save(true);
          return NS.integrations.serverUrl(NS.state.ws);
        },
        { base, token }
      ),
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  };
}

/** xmllint against the SEC schema, the file given on standard input (never written to disk). → { ok, out } */
function validates(xml) {
  try {
    const out = execFileSync('xmllint', ['--noout', '--schema', SCHEMA, '-'], { input: xml, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, out: String(out || '').trim() || '- validates' };
  } catch (e) {
    // xmllint's messages name elements and lines, never their text; still, only the last words of each line are kept.
    return { ok: false, out: String(e.stderr || e.message).split('\n').map((l) => l.replace(/^-:\d+: /, '').slice(0, 120)).slice(-3).join(' | ') };
  }
}

/** A page at a size, on the check's origin, allowed to reach only the given servers; every answer from them is kept. */
async function opened(S, size, allow) {
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, L9.VIEW[size]), allow });
  const answers = [];
  A.page.on('response', (r) => {
    if (allow.some((b) => r.url().startsWith(b))) answers.push(r.text().catch(() => ''));
  });
  await A.page.goto(S.base);
  const F = { A, fr: A.page.mainFrame(), size, phone: size === 'phone', origin: S.origin, page: 'diy.html', answers };
  await L9.sample(F);
  return F;
}

/** The tab, with its sections loaded (and the server link set, when its file is there). */
async function openTab(F) {
  await L9.goto(F, 'console-filings', '.fl');
  await F.fr.waitForFunction(() => window.CVPortal.formD && window.CVPortal.filingsUI, null, { timeout: 30000 });
  await F.fr.waitForFunction(() => window.CVPortal.filingsUI.link, null, { timeout: 8000 }).catch(() => {});
  await F.fr.waitForTimeout(600);
}

/**
 * A notice signed off through NS.formD and NS.filings in the page: the masked filed notice read with fromXml and completed
 * (the offering's first sale, the signer, the pinned day as the signature date), stored as formd-ui.js stores a signed-off
 * entry, with its order recorded. → { orderId, entryId, errors }
 */
async function signOff(F, offeringId, firstSale) {
  const xml = fs.readFileSync(NOTICE, 'utf8');
  return F.fr.evaluate(
    ({ xml, oid, firstSale, pinned, cik, signer }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const d = NS.formD.fromXml(xml);
      d.primaryIssuer.cik = cik;
      d.offeringData.typeOfFiling.dateOfFirstSale = { value: firstSale, yetToOccur: false };
      d.offeringData.signatureBlock.signature.forEach((s) => {
        s.signatureDate = pinned;
        s.signatureName = s.nameOfSigner = signer.name;
        s.signatureTitle = signer.title;
      });
      const errors = NS.formD.validate(d, { today: pinned, submission: true }).filter((m) => m.level === 'error').map((m) => m.message);
      NS.filings.setEdgar(ws, oid, { cik });
      const order = NS.filings.addOrder(ws, { kind: 'formd', offeringId: oid, by: NS.app.actor() });
      const r = NS.filings.rec(ws, oid);
      const entryId = `fd-check-${r.formD.length + 1}`;
      r.formD.push({ id: entryId, type: 'D', status: 'ordered', draft: d, signoff: { by: NS.app.actor(), name: signer.name, title: signer.title, at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }, orderId: order.id, touched: [], replaces: '' });
      NS.app.save(true);
      NS.app.render();
      return { orderId: order.id, entryId, errors };
    },
    { xml, oid: offeringId, firstSale, pinned: PINNED, cik: CIK, signer: SIGNER }
  );
}

const orderSel = (id) => `.fl-order[data-order="${id}"]`;
/** The order as stored in the page. */
const orderOf = (F, id) => F.fr.evaluate((oid) => JSON.parse(JSON.stringify(((window.CVPortal.state.ws.filings || {}).orders || []).find((x) => x.id === oid) || null)), id);
/** Wait until the stored order satisfies fn(order) (a function body over o), or the time is up. */
const waitOrder = (F, id, body, ms) =>
  F.fr
    .waitForFunction(
      ([oid, body]) => {
        const o = ((window.CVPortal.state.ws.filings || {}).orders || []).find((x) => x.id === oid);
        return !!o && new Function('o', `return (${body});`)(o);
      },
      [id, body],
      { timeout: ms || 15000 }
    )
    .then(
      () => true,
      () => false
    );
/** Everything the page keeps: localStorage, every IndexedDB store, and the workspace in memory, as one text. */
const storageText = (F) =>
  F.fr.evaluate(async () => {
    const parts = [JSON.stringify(Object.assign({}, localStorage)), JSON.stringify(window.CVPortal.state.ws)];
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const info of dbs) {
      const db = await new Promise((res) => {
        const q = indexedDB.open(info.name);
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(null);
      });
      if (!db) continue;
      for (const name of Array.from(db.objectStoreNames)) {
        const all = await new Promise((res) => {
          const q = db.transaction(name, 'readonly').objectStore(name).getAll();
          q.onsuccess = () => res(q.result);
          q.onerror = () => res([]);
        });
        parts.push(JSON.stringify(all, (k, v) => (v instanceof Blob ? `[blob ${v.size}]` : v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? `[bytes]` : v)));
      }
      db.close();
    }
    return parts.join('\n');
  });
/** No outside call anywhere: this process, the server's fetch, the EDGAR transport, and the browser. */
function noOutside(check, F, srvs, what) {
  check(`no outside call (${what}): none from this process, none through the servers' fetch, the EDGAR transport never asked, none from the browser`, outsideHere.length === 0 && srvs.every((s) => s.outside.length === 0 && s.transport.calls.length === 0) && (!F || F.A.net.external.length === 0), { here: outsideHere, server: srvs.map((s) => s.outside.length), transport: srvs.map((s) => s.transport.calls.length), browser: F ? F.A.net.external : [] });
}
const remoteText = (F, id) => L9.text(F, `${orderSel(id)} .fl-remote`);

/** Seed an offering with two sales, connect the page, open the tab and sign off a notice. */
async function prepared(F, srv, spec) {
  const seeded = await L9.seed(F, Object.assign({ name: 'Harbor Growth Fund, L.P.', sales: [{ daysAgo: 30, state: 'NY', funded: true, amount: 250000 }, { daysAgo: 20, state: 'CA', amount: 150000 }] }, spec || {}));
  if (srv) await srv.configure(F);
  await openTab(F);
  const s = await signOff(F, seeded.offeringId, seeded.sales[0].date);
  await L9.goto(F, 'console-filings', '.fl');
  await F.fr.waitForTimeout(800);
  return Object.assign({ seeded }, s);
}

/* ---------- Parts ---------- */

const sendBtn = (id) => `${orderSel(id)} [data-action="flr-send"]`;
const checkBtn = (id) => `${orderSel(id)} [data-action="flr-check"]`;
/** Send from the tab and wait for the received order → the server's id for it ('' when it did not arrive). */
async function sendIt(F, srv, id) {
  await F.fr.waitForSelector(sendBtn(id), { timeout: 15000 }).catch(() => {});
  if (!(await F.fr.locator(sendBtn(id)).count())) return '';
  await L9.press(F, sendBtn(id));
  await waitOrder(F, id, "o.status === 'received' && o.remote && o.remote.id");
  const list = await srv.staff('GET', '/v1/filings/staff/orders');
  const rows = Array.isArray(list.body) ? list.body : [];
  return rows.length ? rows[rows.length - 1].id : '';
}
/** Check now on the tab, then wait until the stored order satisfies body. */
async function checkNow(F, id, body) {
  await F.fr.waitForSelector(checkBtn(id), { timeout: 15000 }).catch(() => {});
  if (!(await F.fr.locator(checkBtn(id)).count())) return false;
  await L9.press(F, checkBtn(id));
  return waitOrder(F, id, body);
}
const staffOutcome = (srv, fid, body) => srv.staff('POST', `/v1/filings/staff/orders/${fid}/outcome`, body);

/** The tracer's path at a size: sent from the tab, filed as a TEST by staff, the result back on the tab. Desktop adds a team member. */
async function sendPath(size, { check, S }) {
  const k = await K();
  const srv = await filingServer(S);
  const F = await opened(S, size, [srv.base]);
  try {
    const p = await prepared(F, srv);
    check('the completed notice passes the rule table in the page', p.errors.length === 0, p.errors);
    const id = p.orderId;
    if (size === 'desktop') {
      await L9.role(F, 'team');
      await L9.goto(F, 'console-filings', '.fl');
      await F.fr.waitForTimeout(800);
      check('a team member sees the recorded order and has no Send', (await F.fr.locator(orderSel(id)).count()) === 1 && (await F.fr.locator(sendBtn(id)).count()) === 0, await L9.text(F, orderSel(id)));
      await L9.role(F, 'admin');
      await L9.goto(F, 'console-filings', '.fl');
      await F.fr.waitForTimeout(800);
    }
    await F.fr.waitForSelector(sendBtn(id), { timeout: 15000 }).catch(() => {});
    check('the tab shows the order with a Send control', (await F.fr.locator(sendBtn(id)).count()) === 1);
    check('no notice about connecting the portal is shown', (await F.fr.locator('.fl-connect').count()) === 0, await L9.text(F, '.fl-connect'));
    await F.A.page.screenshot({ path: path.join(OUT, `${size}-before.png`), fullPage: false });

    await L9.press(F, sendBtn(id));
    const got = await waitOrder(F, id, "o.status === 'received' && o.remote && o.remote.id");
    const line = await remoteText(F, id);
    check('after Send the row says the order was received', got && /Received/.test(line), { line, order: await orderOf(F, id) });
    const o = await orderOf(F, id);
    check('the order keeps the server\'s id and a key of 32 random bytes', !!(o && o.remote && /^fil_/.test(o.remote.id) && /^[A-Za-z0-9_-]{43}$/.test(o.remote.key)), o && o.remote ? { id: o.remote.id, keyLength: String(o.remote.key || '').length } : o);
    check('W2: while the order is received, Cancel order is not offered', (await F.fr.locator(`${orderSel(id)} [data-kind="cancel"]`).count()) === 0);
    await F.A.page.screenshot({ path: path.join(OUT, `${size}-received.png`), fullPage: false });

    const list = await srv.staff('GET', '/v1/filings/staff/orders');
    const rows = Array.isArray(list.body) ? list.body : [];
    check('the server\'s staff list holds one order for the firm at $100', rows.length === 1 && rows[0].dueCents === 10000 && rows[0].kind === 'formd' && rows[0].status === 'received' && rows[0].offering.id === p.seeded.offeringId, rows);
    const mail = srv.mail();
    check('the outbox holds one message, to the staff address', mail.length === 1 && mail[0].to === k.STAFF_EMAIL, mail.map((m) => m.to));
    const fid = rows[0] && rows[0].id;
    const one = fid ? await srv.staff('GET', `/v1/filings/staff/orders/${fid}`) : { body: null };
    check('staff open the order: the signed-off notice and its sign-off', !!(one.body && one.body.notice && one.body.signoff && one.body.signoff.name === SIGNER.name && one.body.notice.primaryIssuer.cik === CIK), one.body && one.body.signoff);

    const put = await srv.staff('PUT', `/v1/filings/staff/issuers/${CIK}`, { ccc: k.CCCS[0], name: EDGAR_NAME });
    check('staff record the issuer\'s CCC and EDGAR name', put.status === 200, put.status);
    const file = fid ? await srv.file(fid, 'TEST') : { status: 0, text: '' };
    const v = validates(file.text);
    check('the TEST file staff download validates against the SEC schema (xmllint)', file.status === 200 && v.ok, { status: file.status, xmllint: v.out });
    check('the TEST file holds the CCC under the issuer\'s CIK', new RegExp(`<cik>${CIK}</cik>\\s*<ccc>[^<]{8}</ccc>`).test(file.text) && (await holdsCcc(file.text)));
    const contact = [k.ENV.FILINGS_CONTACT_NAME, k.ENV.FILINGS_CONTACT_EMAIL].every((x) => file.text.indexOf(x) >= 0);
    // What is missing is named by the expectation, never by the file's text.
    const phone = (/<issuerPhoneNumber>([^<]+)<\/issuerPhoneNumber>/.exec(fs.readFileSync(NOTICE, 'utf8')) || [])[1];
    const missing = [`<cik>${CIK}</cik>`, `<issuerPhoneNumber>${phone}</issuerPhoneNumber>`, `<value>${p.seeded.sales[0].date}</value>`, `<nameOfSigner>${SIGNER.name}</nameOfSigner>`, '<testOrLive>TEST</testOrLive>', `<issuerName>${EDGAR_NAME}</issuerName>`].filter((x) => file.text.indexOf(x) < 0);
    check('the TEST file holds the filer contact the server added and the sponsor\'s answers (issuer, first sale, signer, EDGAR\'s name)', contact && !missing.length, { contact, missing });

    const out = fid ? await staffOutcome(srv, fid, { step: 'test', result: 'accepted' }) : { status: 0 };
    check('staff record the test as accepted', out.status === 200 && out.body.formD.status === 'test_passed', out.status);
    if (size === 'desktop') {
      await L9.role(F, 'team');
      await L9.goto(F, 'console-filings', '.fl');
      await F.fr.waitForTimeout(800);
    }
    const passed = await checkNow(F, id, "o.remote && o.remote.filing === 'test_passed'");
    const line2 = await remoteText(F, id);
    check(`Check now on the tab shows the test passed${size === 'desktop' ? ' (to a team member, who has no Send)' : ''}`, passed && /Test filing passed/.test(line2) && (await F.fr.locator(sendBtn(id)).count()) === 0, line2);
    await F.A.page.screenshot({ path: path.join(OUT, `${size}-test-passed.png`), fullPage: false });

    const answered = await Promise.all(F.answers);
    check('the page received answers from the server (sending and checking)', answered.length >= 3, answered.length);
    check('no CCC in any answer the page received', !(await holdsCcc(answered.join('\n'))));
    check('no CCC in the page\'s storage (localStorage, IndexedDB, the workspace)', !(await holdsCcc(await storageText(F))));
    check('no CCC in any other answer staff received, in the stored records or in the outbox', !(await holdsCcc(srv.seen.join('\n') + JSON.stringify(srv.server.store.data()) + JSON.stringify(srv.mail()))));
    noOutside(check, F, [srv], `send-${size}`);
    check('no script error in the browser', F.A.errors.length === 0, F.A.errors);
    await L9.leak(check, F, 'the Filings tab with a sent order');
    await L9.wayOut(check, F, 'the Filings tab', { selector: '.fl-bar a.fl-back' });
  } finally {
    await F.A.context.close();
    await srv.close();
  }
}

const ACCESSION = '0009999999-26-000123';
/** B1: filed through the outcome call on a server that may file LIVE (outside tests, EDGAR_ALLOW_LIVE=1, pinned clock). */
async function outcomePart({ check, S }) {
  const srv = await filingServer(S, { env: { NODE_ENV: 'production', EDGAR_ALLOW_LIVE: '1' } });
  const F = await opened(S, 'desktop', [srv.base]);
  try {
    const on = await srv.call('GET', '/v1/filings');
    check('the server takes filing orders and may file live', on.status === 200 && on.body.on === true && on.body.live === true, on.body);
    const p = await prepared(F, srv);
    const id = p.orderId;
    const fid = await sendIt(F, srv, id);
    check('the order was sent and received', !!fid, fid);
    const t = await staffOutcome(srv, fid, { step: 'test', result: 'accepted' });
    const l = await staffOutcome(srv, fid, { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: PINNED });
    check('staff record the test, then the live filing with its accession number and date', t.status === 200 && l.status === 200 && l.body.formD.status === 'accepted' && l.body.status === 'done', { test: t.status, live: l.status, body: l.body && l.body.formD });
    const done = await checkNow(F, id, "o.status === 'done'");
    const line = await remoteText(F, id);
    const annual = FL.businessDay(`${Number(PINNED.slice(0, 4)) + 1}${PINNED.slice(4)}`.replace(/-02-29$/, '-02-28'));
    check('after Check now the tab shows the notice filed, with its accession number and date', done && line.indexOf(`Filed on ${L9.label(PINNED)}`) >= 0 && line.indexOf(ACCESSION) >= 0, line);
    check('the line gives the next annual amendment date (one year on, rolled to a business day)', line.indexOf(`Annual amendment due ${L9.label(annual)}`) >= 0, { line, annual });
    const rec = await F.fr.evaluate((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const r = ws.filings.offerings[oid];
      const due = NS.filings.due(ws, NS.dates.today()).filter((x) => x.offeringId === oid);
      return JSON.parse(JSON.stringify({ formD: r.formD.map((n) => ({ id: n.id, status: n.status, filedOn: n.filedOn, accession: n.accession, snapshot: !!n.snapshot, source: n.source, orderId: n.orderId })), due: due.map((x) => ({ kind: x.kind, due: x.due })) }));
    }, p.seeded.offeringId);
    const filed = rec.formD.find((n) => n.status === 'accepted');
    check('the offering\'s record holds the notice as accepted, with its date, accession number and a snapshot', !!filed && filed.id === p.entryId && filed.filedOn === PINNED && filed.accession === ACCESSION && filed.snapshot && filed.orderId === id, rec.formD);
    check('the first Form D reminder is gone and the annual amendment reminder shows its date', !rec.due.some((x) => x.kind === 'formd-first') && rec.due.some((x) => x.kind === 'formd-annual' && x.due === annual), rec.due);
    const tab = await L9.text(F, `.fl-off[data-offering="${p.seeded.offeringId}"]`);
    check('the tab reads the order as done and lists the annual amendment with its date', /Done/.test(await L9.text(F, `${orderSel(id)} .fl-total`)) && /Form D annual amendment/.test(tab) && tab.indexOf(`Due ${L9.label(annual)}`) >= 0, tab.slice(0, 600));
    await F.A.page.screenshot({ path: path.join(OUT, 'desktop-filed.png'), fullPage: false });
    noOutside(check, F, [srv], 'outcome');
    check('no script error in the browser', F.A.errors.length === 0, F.A.errors);
    await L9.leak(check, F, 'a filed notice');
  } finally {
    await F.A.context.close();
    await srv.close();
  }
}

/** A suspended test: EDGAR's messages as plain text under the order; corrected, signed off again and sent under the same order. */
async function suspendedPart({ check, S }) {
  const srv = await filingServer(S);
  const F = await opened(S, 'phone', [srv.base]);
  try {
    const p = await prepared(F, srv);
    const id = p.orderId;
    const oid = p.seeded.offeringId;
    const fid = await sendIt(F, srv, id);
    const msgs = [{ type: 'error', code: 'E0101', message: 'The issuer name <b>Masked</b> does not match EDGAR' }, { type: 'warning', code: 'W0202', message: 'The phone number looks unusual' }];
    const s = await staffOutcome(srv, fid, { step: 'test', result: 'suspended', messages: msgs });
    check('staff record a suspended test with one error and one warning', s.status === 200 && s.body.formD.status === 'suspended', s.status);
    const got = await checkNow(F, id, "o.remote && o.remote.filing === 'suspended'");
    const box = `${orderSel(id)} .fl-remote`;
    const line = await L9.text(F, box);
    const bold = await F.fr.locator(`${box} b`).count();
    check('after Check now the tab says the test was suspended and shows both messages as plain text (angle brackets as text)', got && /suspended/i.test(line) && line.indexOf('The issuer name <b>Masked</b> does not match EDGAR') >= 0 && line.indexOf('The phone number looks unusual') >= 0 && bold === 0, { line, bold });
    const fix = `${box} a[href="#console-filings-formd-${oid}"]`;
    check('the order offers the way to correct the notice', (await F.fr.locator(fix).count()) === 1);
    await F.A.page.screenshot({ path: path.join(OUT, 'phone-suspended.png'), fullPage: false });

    // The sponsor corrects: Make changes on the signed notice, a new phone number, Review, sign off again.
    if (await F.fr.locator(fix).count()) await L9.press(F, fix);
    await F.fr.waitForSelector('[data-action="fd-edit"]', { timeout: 15000 }).catch(() => {});
    await L9.press(F, '[data-action="fd-edit"]');
    const phoneSel = '.fl-section[data-part="formd"] [data-field="primaryIssuer.issuerPhoneNumber"]';
    await F.fr.waitForSelector(phoneSel, { timeout: 15000 }).catch(() => {});
    const field = F.fr.locator(phoneSel).first();
    await field.scrollIntoViewIfNeeded();
    await field.tap();
    await field.fill('518-555-0199');
    await F.fr.waitForTimeout(200);
    await L9.goto(F, `console-filings-formd-${oid}-review`, '.fl-section');
    await F.fr.waitForSelector('form[data-form="fd-signoff"]', { timeout: 15000 }).catch(() => {});
    const errors = await L9.text(F, '.fl-section .fl-errors');
    check('the corrected notice reviews with nothing to fix and can be signed off', (await F.fr.locator('form[data-form="fd-signoff"]').count()) === 1, errors);
    if (await F.fr.locator('form[data-form="fd-signoff"]').count()) {
      await F.fr.fill('form[data-form="fd-signoff"] input[name="name"]', SIGNER.name);
      await F.fr.fill('form[data-form="fd-signoff"] input[name="title"]', SIGNER.title);
      await L9.press(F, 'form[data-form="fd-signoff"] button[type=submit]');
      await F.fr.waitForTimeout(800);
    }
    const signed = await F.fr.evaluate(([o, order]) => window.CVPortal.state.ws.filings.offerings[o].formD.filter((n) => n.orderId === order && n.status === 'ordered').map((n) => n.id), [oid, id]);
    check('signed off again under the same order (no second order)', signed.length === 2 && (await F.fr.evaluate(([o]) => window.CVPortal.state.ws.filings.orders.filter((x) => x.offeringId === o && x.status !== 'cancelled').length, [oid])) === 1, signed);
    await L9.goto(F, 'console-filings', '.fl');
    await F.fr.waitForTimeout(800);
    const again = await L9.text(F, sendBtn(id));
    check('the tab offers to send the corrected notice', /corrected/i.test(again), again);
    if (again) await L9.press(F, sendBtn(id));
    await waitOrder(F, id, "o.remote && o.remote.filing === 'in_review'");
    const list = await srv.staff('GET', '/v1/filings/staff/orders');
    const one = await srv.staff('GET', `/v1/filings/staff/orders/${fid}`);
    check('the server holds one order, the same id, back at received with the corrected notice', Array.isArray(list.body) && list.body.length === 1 && list.body[0].id === fid && one.body.status === 'received' && one.body.formD.status === 'in_review' && one.body.version === 2 && one.body.notice.primaryIssuer.issuerPhoneNumber === '518-555-0199', { rows: (list.body || []).length, status: one.body && one.body.status, formD: one.body && one.body.formD && one.body.formD.status, version: one.body && one.body.version });
    const line2 = await remoteText(F, id);
    check('the tab says the corrected notice was received; the messages are gone', /Received/.test(line2) && line2.indexOf('does not match EDGAR') < 0, line2);
    noOutside(check, F, [srv], 'suspended');
    check('no script error in the browser', F.A.errors.length === 0, F.A.errors);
  } finally {
    await F.A.context.close();
    await srv.close();
  }
}

/** The guard: LIVE refused on a test server; another portal's key; a staff cancel; a server that takes no filing orders. */
async function guardPart({ check, S }) {
  const k = await K();
  const srv = await filingServer(S);
  const off = await filingServer(S, { env: { FILINGS: undefined } });
  const half = await filingServer(S, { env: { FILINGS_STAFF_EMAIL: undefined } });
  const F = await opened(S, 'desktop', [srv.base, off.base, half.base]);
  try {
    const p = await prepared(F, srv);
    const id = p.orderId;
    const oid = p.seeded.offeringId;
    const fid = await sendIt(F, srv, id);
    await srv.staff('PUT', `/v1/filings/staff/issuers/${CIK}`, { ccc: k.CCCS[0], name: EDGAR_NAME });
    await staffOutcome(srv, fid, { step: 'test', result: 'accepted' });
    const liveFile = await srv.file(fid, 'LIVE');
    const live = await staffOutcome(srv, fid, { step: 'live', result: 'accepted', accession: ACCESSION, filedOn: PINNED });
    check('on the default server (a test) the LIVE file is refused (403) and so is a live outcome (409)', liveFile.status === 403 && live.status === 409, { file: liveFile.status, outcome: live.status });
    await checkNow(F, id, "o.remote && o.remote.filing === 'test_passed'");
    const line = await remoteText(F, id);
    const accepted = await F.fr.evaluate((o) => window.CVPortal.state.ws.filings.offerings[o].formD.filter((n) => n.status === 'accepted').length, oid);
    check('the tab shows the test as passed and nothing as filed', /Test filing passed/.test(line) && !/Filed on/.test(line) && accepted === 0, { line, accepted });

    // Another portal's key: the status call is refused and nothing changes.
    const before = await orderOf(F, id);
    await F.fr.evaluate((oid2) => {
      const o = window.CVPortal.state.ws.filings.orders.find((x) => x.id === oid2);
      o.remote.realKey = o.remote.key;
      o.remote.key = 'A'.repeat(43);
    }, id);
    await L9.press(F, checkBtn(id));
    await F.fr.waitForTimeout(1500);
    const wrong = await L9.text(F, `${orderSel(id)} .fl-remote .field-error`);
    const after = await orderOf(F, id);
    check('with another portal\'s key the tab says the order could not be found, and nothing changes', /could not find this order/i.test(wrong) && after.status === before.status && after.remote.filing === before.remote.filing && after.remote.checkedAt === before.remote.checkedAt, { wrong, before: before.remote.filing, after: after.remote.filing });
    await F.fr.evaluate((oid2) => {
      const o = window.CVPortal.state.ws.filings.orders.find((x) => x.id === oid2);
      o.remote.key = o.remote.realKey;
      delete o.remote.realKey;
    }, id);

    // W2: an order cancelled by staff reads cancelled after Check now.
    const c = await staffOutcome(srv, fid, { cancelled: true });
    check('staff cancel the order', c.status === 200 && c.body.status === 'cancelled', c.status);
    const cancelled = await checkNow(F, id, "o.status === 'cancelled'");
    await L9.goto(F, `console-filings-formd-${oid}`, '.fl-section');
    const sec = await L9.text(F, '.fl-section');
    check('after Check now the order reads cancelled (stored, and on its Form D section)', cancelled && /Cancelled/.test(sec), sec.slice(0, 300));

    // W3: a server that does not take filing orders (404, and on:false): the tab's own one line, no Send, nothing under the order.
    for (const [name, other] of [['the module off (404)', off], ['the module on but not set up (on: false)', half]]) {
      const ans = await other.call('GET', '/v1/filings');
      await other.configure(F);
      const p2 = await prepared(F, null);
      await F.fr.waitForTimeout(1500);
      await L9.goto(F, 'console-filings', '.fl');
      await F.fr.waitForTimeout(800);
      const notes = await F.fr.locator('.fl-connect').count();
      check(`a server with ${name} (it answered ${ans.status}${ans.body && ans.body.on === false ? ', on: false' : ''}): the tab says so in its one line, Send is not offered and nothing is added under the order`, notes === 1 && (await F.fr.locator('[data-action="flr-send"]').count()) === 0 && (await F.fr.locator(`${orderSel(p2.orderId)} .fl-remote`).count()) === 0, { notes, text: await L9.text(F, '.fl-connect') });
    }
    noOutside(check, F, [srv, off, half], 'guard');
    check('no script error in the browser', F.A.errors.length === 0, F.A.errors);
  } finally {
    await F.A.context.close();
    await srv.close();
    await off.close();
    await half.close();
  }
}

/** Inside the frame that refuses every connection, with a server address set: Send says so in one line; nothing is lost. */
async function offlineFramed({ check, S }) {
  const F = await L9.framed(S, 'phone');
  try {
    await L9.proveRefused(check, F);
    await L9.sample(F);
    const port = await freePort(); // nothing listens here, and the frame's policy refuses it before any connection
    const base = `http://127.0.0.1:${port}`;
    const seeded = await L9.seed(F, { name: 'Harbor Growth Fund, L.P.', sales: [{ daysAgo: 30, state: 'NY', funded: true, amount: 250000 }] });
    await F.fr.evaluate((b) => {
      const NS = window.CVPortal;
      const s = NS.integrations.ensure(NS.state.ws).server;
      s.url = b;
      s.token = 'invented-token-for-the-frame';
      NS.app.save(true);
    }, base);
    await openTab(F);
    const s = await signOff(F, seeded.offeringId, seeded.sales[0].date);
    await L9.goto(F, 'console-filings', '.fl');
    await F.fr.waitForTimeout(1200);
    const id = s.orderId;
    const reportsBefore = await F.fr.evaluate(() => (window.__cspv || []).length);
    check('with a server address set, the order offers Send', (await F.fr.locator(sendBtn(id)).count()) === 1);
    if (await F.fr.locator(sendBtn(id)).count()) await L9.press(F, sendBtn(id));
    await F.fr.waitForSelector(`${orderSel(id)} .fl-remote .field-error`, { timeout: 15000 }).catch(() => {});
    await F.fr.waitForTimeout(500);
    const box = await F.fr.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? Array.from(el.querySelectorAll('p')).map((p) => p.innerText.trim()).filter(Boolean) : null;
    }, `${orderSel(id)} .fl-remote`);
    check('Send says in one plain line that the server could not be reached', !!box && box.length === 1 && /could not be reached/.test(box[0]), box);
    check('no other line about connecting is on the tab', (await F.fr.locator('.fl-connect').count()) === 0, await L9.text(F, '.fl-connect'));
    const o = await orderOf(F, id);
    check('the order is still recorded, its key kept and nothing marked as sent', !!o && o.status === 'recorded' && !!o.remote && !!o.remote.key && !o.remote.id, o && { status: o.status, sent: !!(o.remote && o.remote.id) });
    const reports = await F.fr.evaluate(() => (window.__cspv || []).slice());
    check('the only policy reports are the refused connections to the server\'s address (Send added one)', reports.length > reportsBefore && reports.every((r) => r.indexOf('connect-src') === 0 && r.indexOf(base) > 0), reports);
    const errs = F.A.errors.filter((e) => !(/^console: (Refused to connect to|Connecting to|Fetch API cannot load)/.test(e) && e.indexOf(base) > 0));
    check('no error was thrown (the browser\'s console holds only the refused connections)', errs.length === 0, errs);
    check('no request left the check server', F.A.net.external.length === 0, F.A.net.external);
    await F.A.page.screenshot({ path: path.join(OUT, 'phone-offline.png'), fullPage: false });
    await L9.leak(check, F, 'the order that could not be sent');
    await L9.wayOut(check, F, 'the Filings tab in the frame', { selector: '.fl-bar a.fl-back' });
  } finally {
    await F.A.context.close();
  }
}

/** D-03: a state notice order sent with its package; each state's result recorded by staff arrives on the tab. */
async function statesPart({ check, S }) {
  const srv = await filingServer(S);
  const F = await opened(S, 'desktop', [srv.base]);
  try {
    const seeded = await L9.seed(F, { name: 'Harbor Growth Fund, L.P.', sales: [{ daysAgo: 30, state: 'NY', funded: true, amount: 250000 }, { daysAgo: 20, state: 'CA', amount: 150000 }] });
    const oid = seeded.offeringId;
    await srv.configure(F);
    await openTab(F);
    await F.fr.waitForFunction(() => window.CVPortal.bluesky, null, { timeout: 15000 }).catch(() => {});
    const id = await F.fr.evaluate((o) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const order = NS.bluesky.placeOrder(ws, ws.offerings.find((x) => x.id === o), ['NY', 'CA'], { by: NS.app.actor(), data: NS.blueskyData });
      NS.app.save(true);
      NS.app.render();
      return order ? order.id : '';
    }, oid);
    await L9.goto(F, 'console-filings', '.fl');
    await F.fr.waitForTimeout(800);
    check('a state notice order for New York and California is recorded through NS.bluesky.placeOrder', !!id, id);
    const fid = await sendIt(F, srv, id);
    const one = fid ? await srv.staff('GET', `/v1/filings/staff/orders/${fid}`) : { body: null };
    const codes = one.body && one.body.package && Array.isArray(one.body.package.states) ? one.body.package.states.map((x) => x.code).sort() : [];
    check('Send: the server holds the order with its package (both states)', !!fid && one.body.kind === 'bluesky' && codes.join() === 'CA,NY' && /Received/.test(await remoteText(F, id)), { fid, codes });
    const renewsOn = L9.iso(localToday(), 20);
    // New York first: the server still holds the order as received, so the tab must not read filed or done.
    const r0 = await staffOutcome(srv, fid, { states: { NY: { filedOn: PINNED, efdId: 'NY-EFD-1001', feeCents: 30000, renewsOn } } });
    check('staff record New York\'s result only; the server still holds the order as received', r0.status === 200 && r0.body.status === 'received', { status: r0.status, order: r0.body && r0.body.status });
    const partly = await checkNow(F, id, "o.status === 'partly-filed'");
    const total0 = await L9.text(F, `${orderSel(id)} .fl-total`);
    const card0 = await L9.text(F, orderSel(id));
    check('after Check now the order reads "Partly filed (1 of 2)", not filed or done', partly && /Partly filed \(1 of 2\)/.test(total0) && !/\b(Filed|Done)\b/.test(total0.replace(/Partly filed/, '')), { partly, total: total0 });
    check('the state still open (California) is listed on the order', /Still open: California\b/.test(card0) && !/Still open:[^.]*New York/.test(card0), card0.slice(0, 600));
    await F.A.page.screenshot({ path: path.join(OUT, 'desktop-states-partly.png'), fullPage: false });
    const r = await staffOutcome(srv, fid, { states: { CA: { filedOn: PINNED, efdId: 'CA-EFD-2002', feeCents: 25000 } }, systemFeeCents: 15000 });
    check('staff record each state\'s result (date, filing ID, fee paid, a renewal date 20 days ahead for New York)', r.status === 200 && r.body.status === 'done', r.status);
    const done = await checkNow(F, id, "o.status === 'done'");
    const st = await F.fr.evaluate((o) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const rec = ws.filings.offerings[o];
      const order = ws.filings.orders.filter((x) => x.offeringId === o).pop();
      return JSON.parse(JSON.stringify({ states: rec.states, due: NS.filings.due(ws, NS.dates.today(), { states: NS.blueskyData && NS.blueskyData.table }).filter((x) => x.offeringId === o).map((x) => ({ kind: x.kind, state: x.state, due: x.due })), lines: order.lines, dueCents: order.dueCents, openFees: order.openFees }));
    }, oid);
    const ny = st.states.NY || {};
    const ca = st.states.CA || {};
    check('after Check now the record shows both states filed with date, filing ID and fee paid', ny.status === 'filed' && ny.filedOn === PINNED && ny.efdId === 'NY-EFD-1001' && ny.feeCents === 30000 && ny.renewsOn === renewsOn && ca.status === 'filed' && ca.efdId === 'CA-EFD-2002' && ca.feeCents === 25000, st.states);
    check('the order reads done, with the fees paid as its lines', done && st.dueCents === 80000 && st.openFees === false && st.lines.some((l) => l.state === 'NY' && l.cents === 30000 && /New York/.test(l.label)) && st.lines.some((l) => !l.state && l.passThrough && l.cents === 15000), { dueCents: st.dueCents, lines: st.lines });
    check('New York\'s renewal reminder appears with its date; no state is still to file', st.due.some((x) => x.kind === 'state-renewal' && x.state === 'NY' && x.due === renewsOn) && !st.due.some((x) => x.kind === 'state-first'), st.due);
    const tab = await L9.text(F, `.fl-off[data-offering="${oid}"]`);
    const line = await remoteText(F, id);
    check('the tab shows the renewal reminder with its date, the order done and both states filed', /State notice renewal: New York/.test(tab) && tab.indexOf(`Due ${L9.label(renewsOn)}`) >= 0 && /Done/.test(await L9.text(F, `${orderSel(id)} .fl-total`)) && /New York/.test(line) && /California/.test(line), { line, tab: tab.slice(0, 500) });
    await F.A.page.screenshot({ path: path.join(OUT, 'desktop-states.png'), fullPage: false });
    await L9.goto(F, `console-filings-states-${oid}`, '.fl-section');
    await F.fr.waitForTimeout(500);
    const sec = await L9.text(F, '.fl-section');
    check('the State filings section shows each state with its date, filing ID and fee paid', ['NY-EFD-1001', 'CA-EFD-2002', '$300', '$250', `Filed ${L9.label(PINNED)}`].every((x) => sec.indexOf(x) >= 0), sec.slice(0, 800));
    noOutside(check, F, [srv], 'states');
    check('no script error in the browser', F.A.errors.length === 0, F.A.errors);
    await L9.leak(check, F, 'the State filings section with results from the server');
  } finally {
    await F.A.context.close();
    await srv.close();
  }
}

Lib.runParts(
  {
    'send-phone': (ctx) => sendPath('phone', ctx),
    'send-desktop': (ctx) => sendPath('desktop', ctx),
    outcome: outcomePart,
    suspended: suspendedPart,
    guard: guardPart,
    'offline-framed': offlineFramed,
    states: statesPart
  },
  { name: 'FILINGS SERVER', unit: 'parts', flag: '--only', browser: true }
);
