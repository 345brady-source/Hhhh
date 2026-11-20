// gate: browser
// last "FILINGS SERVER: PASS (parts run: 1)"
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
//   NODE_PATH=$(npm root -g) node filings-server.js [--only send-phone]
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
      NS.filings.setEdgar(ws, oid, { cik, name: d.primaryIssuer.entityName });
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

/** The tracer: sent from the tab on a phone, filed as a TEST by staff, the result back on the tab. */
async function sendPhone({ check, S }) {
  const k = await K();
  const srv = await filingServer(S);
  const F = await opened(S, 'phone', [srv.base]);
  try {
    const p = await prepared(F, srv);
    check('the completed notice passes the rule table in the page', p.errors.length === 0, p.errors);
    const id = p.orderId;
    await F.fr.waitForSelector(`${orderSel(id)} [data-action="flr-send"]`, { timeout: 15000 }).catch(() => {});
    check('the tab shows the order with a Send control', (await F.fr.locator(`${orderSel(id)} [data-action="flr-send"]`).count()) === 1);
    check('no notice about connecting the portal is shown', (await F.fr.locator('.fl-connect').count()) === 0, await L9.text(F, '.fl-connect'));
    await F.A.page.screenshot({ path: path.join(OUT, 'phone-before.png'), fullPage: false });

    await L9.press(F, `${orderSel(id)} [data-action="flr-send"]`);
    const got = await waitOrder(F, id, "o.status === 'received' && o.remote && o.remote.id");
    const line = await remoteText(F, id);
    check('after Send the row says the order was received', got && /Received/.test(line), { line, order: await orderOf(F, id) });
    const o = await orderOf(F, id);
    check('the order keeps the server\'s id and a key of 32 random bytes', !!(o && o.remote && /^fil_/.test(o.remote.id) && /^[A-Za-z0-9_-]{43}$/.test(o.remote.key)), o && o.remote ? { id: o.remote.id, keyLength: String(o.remote.key || '').length } : o);
    await F.A.page.screenshot({ path: path.join(OUT, 'phone-received.png'), fullPage: false });

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
    const answers = ['<entityName>Masked Entity 01</entityName>', `<value>${p.seeded.sales[0].date}</value>`, `<nameOfSigner>${SIGNER.name}</nameOfSigner>`, '<testOrLive>TEST</testOrLive>', `<issuerName>${EDGAR_NAME}</issuerName>`].every((x) => file.text.indexOf(x) >= 0);
    check('the TEST file holds the filer contact the server added and the sponsor\'s answers (issuer, first sale, signer, EDGAR\'s name)', contact && answers, { contact, answers });

    const out = fid ? await srv.staff('POST', `/v1/filings/staff/orders/${fid}/outcome`, { step: 'test', result: 'accepted' }) : { status: 0 };
    check('staff record the test as accepted', out.status === 200 && out.body.formD.status === 'test_passed', out.status);
    await L9.press(F, `${orderSel(id)} [data-action="flr-check"]`);
    const passed = await waitOrder(F, id, "o.remote && o.remote.filing === 'test_passed'");
    const line2 = await remoteText(F, id);
    check('Check now on the tab shows the test passed', passed && /Test filing passed/.test(line2), line2);
    await F.A.page.screenshot({ path: path.join(OUT, 'phone-test-passed.png'), fullPage: false });

    const answered = await Promise.all(F.answers);
    check('the page received answers from the server (sending and checking)', answered.length >= 3, answered.length);
    check('no CCC in any answer the page received', !(await holdsCcc(answered.join('\n'))));
    check('no CCC in the page\'s storage (localStorage, IndexedDB, the workspace)', !(await holdsCcc(await storageText(F))));
    check('no CCC in any other answer staff received, in the stored records or in the outbox', !(await holdsCcc(srv.seen.join('\n') + JSON.stringify(srv.server.store.data()) + JSON.stringify(srv.mail()))));
    noOutside(check, F, [srv], 'send-phone');
    check('no script error in the browser', F.A.errors.length === 0, F.A.errors);
    await L9.leak(check, F, 'the Filings tab with a sent order');
    await L9.wayOut(check, F, 'the Filings tab', { selector: '.fl-bar a.fl-back' });
  } finally {
    await F.A.context.close();
    await srv.close();
  }
}

Lib.runParts({ 'send-phone': sendPhone }, { name: 'FILINGS SERVER', unit: 'parts', flag: '--only', browser: true });
