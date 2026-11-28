// gate: tests 14
// Tax documents delivered to the investor's own device (plan 10-12, C-04, TAX-04 to TAX-06): the console sends one
// document sealed, the investor's link (X-Doc-Token) shows the firm, the title and what is needed, and the document
// opens only with the last four digits of the tax number on record. Every number used here is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { withServer } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';

const API = 'sponsor-api-token-taxdocs-0123456789';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const T0 = Date.parse('2027-03-10T15:00:00Z');
const DAY = 864e5;
const LAST4 = '6789';
const CONSENT_LINES = ['Your tax documents are posted on this portal.', 'If you do not consent, they are sent on paper.', 'This consent covers every tax document.', 'You can ask for paper at any time.', 'You can withdraw this consent by writing to us.', 'We stop electronic delivery if you withdraw.', 'Update your contact details on your Account page.', 'You need a current web browser and a PDF reader.'];
const pdf = (marker, pad = 0) => Buffer.concat([Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\n`), Buffer.alloc(pad, 32), Buffer.from('trailer << >>\n%%EOF\n')]);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** What the console posts when it delivers one document. */
function payload(over = {}) {
  const file = over.file || pdf('K1MARKERHARBOR');
  const base = {
    workspace: 'ws-harbor',
    docId: 'doc-k1-zelda',
    kind: 'k1-1065',
    year: '2026',
    title: 'Schedule K-1 (Form 1065) 2026',
    fileName: 'k1-1065-2026-HRC-0007.pdf',
    pdf: file.toString('base64'),
    sha256: sha(file),
    availableUntil: '2027-12-31',
    investor: { id: 'HRC-0007', name: 'Zelda Quixote', email: 'zelda@investor.example', last4: LAST4 },
    firm: { name: 'Harbor Ridge Capital', contact: { name: 'Harbor Ridge Investor Relations', address: '1 Market Street, Wilmington, DE 19801', phone: '(212) 555-0100', email: 'tax@harborridge.example' } },
    consent: { inEffect: true, version: '2026-11-19', lines: CONSENT_LINES },
    portalUrl: PORTAL,
    sendEmail: true
  };
  const out = Object.assign(base, over);
  delete out.file;
  return out;
}

/** A server with an injected clock, API_TOKEN, DATA_KEY and a public URL. */
function start(opts, fn) {
  const clock = { t: (opts && opts.t0) || T0 };
  return withServer({ env: Object.assign({ API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: PUBLIC, PORTAL_ORIGIN: 'https://portal.example' }, (opts && opts.env) || {}), now: () => clock.t, store: opts && opts.store }, (base, server) => fn(base, server, clock));
}
async function call(base, method, path, { body, bearer = API, doc, invite, raw } = {}) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (doc !== undefined) headers['X-Doc-Token'] = doc;
  if (invite !== undefined) headers['X-Invite-Token'] = invite;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
const create = (base, over, opts) => call(base, 'POST', '/v1/taxdocs', Object.assign({ body: payload(over) }, opts || {}));
/** The token at the end of a link: everything after #taxdoc-. */
const tokenOf = (link) => (/#taxdoc-([A-Za-z0-9_-]{43})$/.exec(String(link)) || [])[1] || '';

test('create: the document is stored sealed and the answer has a link to the portal page that ends in taxdoc- and a token', () =>
  start({}, async (base, server) => {
    const file = pdf('K1MARKERHARBOR', 2000);
    const r = await create(base, { file });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.id, /^txd_/);
    const token = tokenOf(r.body.link);
    assert.equal(token.length, 43, r.body.link);
    assert.ok(r.body.link.startsWith(`https://portal.example/portal.html?tenant=harbor&server=${encodeURIComponent(PUBLIC)}#taxdoc-`), r.body.link);
    assert.equal(r.body.emailStatus, 'outbox');
    const rec = server.store.get('taxdocs', r.body.id);
    assert.ok(rec, 'the record is stored');
    assert.equal(rec.status, 'sent');
    assert.equal(rec.workspace, 'ws-harbor');
    assert.equal(rec.sha256, sha(file));
    assert.ok(!JSON.stringify(rec).includes(token), 'the token is not stored');
    assert.ok(!JSON.stringify(rec).includes('Zelda'), 'the name is sealed');
    assert.ok(!JSON.stringify(rec).includes(LAST4), 'the four digits are sealed');
    const blob = server.store.getBlob(rec.blob);
    assert.ok(blob && blob.length > 0, 'the file is stored');
    assert.ok(!blob.includes(Buffer.from('K1MARKERHARBOR')), 'the file is sealed');
  }));

test("the investor's GET with the link's token gives the firm, the title and what is needed, and nothing else", () =>
  start({}, async (base) => {
    const r = await create(base);
    const token = tokenOf(r.body.link);
    const g = await call(base, 'GET', '/v1/taxdoc', { bearer: null, doc: token });
    assert.equal(g.status, 200, JSON.stringify(g.body));
    assert.equal(g.body.firm.name, 'Harbor Ridge Capital');
    assert.equal(g.body.firm.contact.email, 'tax@harborridge.example');
    assert.equal(g.body.doc.title, 'Schedule K-1 (Form 1065) 2026');
    assert.equal(g.body.doc.year, '2026');
    assert.equal(g.body.doc.availableUntil, '2027-12-31');
    assert.deepEqual(g.body.needs, { check: true, consent: false });
    const text = JSON.stringify(g.body);
    for (const no of ['Zelda', 'zelda@investor.example', LAST4, 'pdf"', 'base64']) assert.ok(!text.includes(no), `the answer holds no ${no}`);
  }));

test('open with the right four digits and consent in effect returns the bytes uploaded, and the status becomes opened with one open', () =>
  start({}, async (base, server) => {
    const file = pdf('K1MARKERHARBOR', 5000);
    const r = await create(base, { file });
    const token = tokenOf(r.body.link);
    const o = await call(base, 'POST', '/v1/taxdoc/open', { bearer: null, doc: token, body: { last4: LAST4 } });
    assert.equal(o.status, 200, JSON.stringify(o.body));
    assert.equal(o.body.fileName, 'k1-1065-2026-HRC-0007.pdf');
    assert.equal(sha(Buffer.from(o.body.pdf, 'base64')), sha(file));
    const rec = server.store.get('taxdocs', r.body.id);
    assert.equal(rec.status, 'opened');
    assert.equal(rec.opens.count, 1);
    assert.equal(rec.opens.first, new Date(T0).toISOString());
    const list = await call(base, 'GET', '/v1/taxdocs?workspace=ws-harbor');
    assert.equal(list.status, 200);
    assert.equal(list.body.documents[0].opens.count, 1);
    assert.equal(list.body.documents[0].status, 'opened');
  }));

/* ---------- the server's rules (Task 2) ---------- */
const outbox = async (base, ws = 'ws-harbor') => (await call(base, 'GET', `/v1/outbox?workspace=${ws}`)).body.messages;
const SUBJECT = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
const open = (base, token, body) => call(base, 'POST', '/v1/taxdoc/open', { bearer: null, doc: token, body });
const look = (base, token) => call(base, 'GET', '/v1/taxdoc', { bearer: null, doc: token });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A mail server that accepts the connection and refuses (or, once told, accepts) the recipient. */
async function refusingSmtp() {
  const state = { refuse: true, messages: 0 };
  const sockets = new Set();
  const srv = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    let buf = '';
    let data = false;
    sock.write('220 refuse.test ready\r\n');
    sock.on('data', (c) => {
      buf += c.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') {
            data = false;
            state.messages++;
            sock.write('250 2.0.0 Queued\r\n');
          }
          continue;
        }
        const verb = line.split(' ')[0].toUpperCase();
        if (verb === 'EHLO' || verb === 'HELO') sock.write('250 refuse.test\r\n');
        else if (verb === 'MAIL') sock.write('250 2.1.0 Ok\r\n');
        else if (verb === 'RCPT') sock.write(state.refuse ? '550 5.1.1 Recipient address rejected\r\n' : '250 2.1.5 Ok\r\n');
        else if (verb === 'DATA') {
          data = true;
          sock.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (verb === 'QUIT') {
          sock.write('221 Bye\r\n');
          sock.end();
        } else sock.write('250 Ok\r\n');
      }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    port: srv.address().port,
    state,
    close: () => {
      sockets.forEach((s) => s.destroy());
      return new Promise((r) => srv.close(r));
    }
  };
}

test('sealed: the saved store and every event hold none of the file, its base64, the token, the four digits, the name or the email', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'taxdocs-sealed-'));
  const file = join(dir, 'store.json');
  try {
    await start({ store: openStore(file) }, async (base) => {
      const pdfFile = pdf('SEALEDK1MARKER', 3000);
      const r = await create(base, { file: pdfFile });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const token = tokenOf(r.body.link);
      assert.equal((await open(base, token, { last4: LAST4 })).status, 200);
      await sleep(200);
      const saved = readFileSync(file, 'utf8');
      const blobs = readdirSync(`${file}.blobs`).map((f) => readFileSync(join(`${file}.blobs`, f)));
      const b64 = pdfFile.toString('base64');
      for (const [what, needle] of [['the file', 'SEALEDK1MARKER'], ['its base64', b64.slice(0, 40)], ['the token', token], ['the four digits', `"${LAST4}"`], ['the name', 'Zelda'], ['the email', 'zelda@investor.example'], ['the firm contact', 'tax@harborridge.example']]) {
        assert.ok(!saved.includes(needle), `the saved store holds ${what}`);
        for (const b of blobs) assert.ok(!b.includes(Buffer.from(needle)), `a saved file holds ${what}`);
      }
      const events = JSON.parse(saved).events.filter((e) => /taxdoc/.test(e.type));
      assert.ok(events.length >= 2, 'creating and opening are recorded');
      for (const e of events) assert.deepEqual(Object.keys(e).sort(), ['at', 'id', 'type'], JSON.stringify(e));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('notice: with consent in effect the subject is exactly the section 7.01 words, the text has the link and how to open, save and print; a refused recipient says failed and resend tries again', async () => {
  await start({}, async (base) => {
    const r = await create(base);
    assert.equal(r.body.emailStatus, 'outbox');
    const [m] = await outbox(base);
    assert.equal(m.subject, SUBJECT);
    assert.ok(m.text.includes(r.body.link), 'the link is in the text');
    for (const w of [/open/i, /save/i, /print/i]) assert.match(m.text, w);
    assert.ok(!m.text.includes(LAST4) && !m.html.includes(LAST4), 'no digits of the tax number in the message');
    assert.equal(m.to, 'zelda@investor.example');
  });
  const smtp = await refusingSmtp();
  try {
    await start({ env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_ALLOW_PLAIN: '1', MAIL_FROM: 'notices@portal-mail.example' } }, async (base, server) => {
      const r = await create(base);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.emailStatus, 'failed');
      assert.ok(r.body.emailError, 'the reason is given');
      assert.ok(!String(r.body.emailError).includes('zelda@investor.example'), 'the reason names no address');
      assert.equal(server.store.list('taxdocs').length, 1, 'the document is still created');
      const row = (await call(base, 'GET', '/v1/taxdocs?workspace=ws-harbor')).body.documents[0];
      assert.equal(row.emailStatus, 'failed');
      smtp.state.refuse = false;
      const again = await call(base, 'POST', `/v1/taxdocs/${r.body.id}/resend`, { body: { portalUrl: PORTAL, sendEmail: true } });
      assert.equal(again.status, 200, JSON.stringify(again.body));
      assert.equal(again.body.emailStatus, 'sent');
      assert.equal(smtp.state.messages, 1);
      assert.notEqual(tokenOf(again.body.link), tokenOf(r.body.link));
    });
  } finally {
    await smtp.close();
  }
});

test("tokens: none, a wrong one or another document's give nothing of the document; an invitation's token is refused on both paths; a document's token is refused on an invitation path and on the sponsor's paths", () =>
  start({}, async (base) => {
    const a = await create(base);
    const b = await create(base, { docId: 'doc-1099-other', kind: '1099-int', title: 'Form 1099-INT 2026', investor: { id: 'HRC-0009', name: 'Other Person', email: 'other@investor.example', last4: '0042' } });
    const ta = tokenOf(a.body.link);
    const tb = tokenOf(b.body.link);
    assert.equal((await call(base, 'GET', '/v1/taxdoc', { bearer: null })).status, 401, 'no token');
    assert.equal((await call(base, 'POST', '/v1/taxdoc/open', { bearer: null, body: { last4: LAST4 } })).status, 401, 'no token on open');
    const wrong = randomBytes(32).toString('base64url');
    assert.equal((await look(base, wrong)).status, 404);
    assert.equal((await open(base, wrong, { last4: LAST4 })).status, 404);
    const gb = await look(base, tb);
    assert.equal(gb.body.doc.title, 'Form 1099-INT 2026', "another document's token opens only that document");
    assert.ok(!JSON.stringify(gb.body).includes('Schedule K-1'));
    assert.equal((await open(base, tb, { last4: LAST4 })).status, 403, "the first document's digits do not open the other");
    const invite = randomBytes(32).toString('base64url');
    assert.equal((await call(base, 'GET', '/v1/taxdoc', { bearer: null, invite })).status, 401);
    assert.equal((await call(base, 'POST', '/v1/taxdoc/open', { bearer: null, invite, body: { last4: LAST4 } })).status, 401);
    assert.equal((await call(base, 'GET', '/v1/invite', { bearer: null, doc: ta })).status, 401, 'a document token on an invitation path');
    assert.equal((await call(base, 'GET', '/v1/taxdocs?workspace=ws-harbor', { doc: ta })).status, 401, "a document token on the sponsor's list, even beside the sponsor's token");
    assert.equal((await call(base, 'POST', `/v1/taxdocs/${a.body.id}/withdraw`, { bearer: null, doc: ta, body: {} })).status, 401);
    assert.equal((await call(base, 'GET', '/v1/outbox?workspace=ws-harbor', { bearer: null, doc: ta })).status, 401);
    assert.equal((await look(base, ta)).status, 200, 'the first document still opens for its own token');
  }));

test('digits: wrong digits answer 403 with the tries left and no file; the fifth locks (423) and the right digits then still answer 423; resend gives a new link, the old token answers 404, tries start again', () =>
  start({}, async (base, server) => {
    const r = await create(base);
    const t1 = tokenOf(r.body.link);
    for (let k = 1; k <= 4; k++) {
      const w = await open(base, t1, { last4: '1111' });
      assert.equal(w.status, 403);
      assert.equal(w.body.triesLeft, 5 - k);
      assert.ok(!('pdf' in w.body));
    }
    const fifth = await open(base, t1, { last4: '1111' });
    assert.equal(fifth.status, 423);
    assert.ok(!('pdf' in fifth.body));
    assert.equal((await open(base, t1, { last4: LAST4 })).status, 423, 'locked even with the right digits');
    assert.equal((await look(base, t1)).status, 423);
    assert.equal(server.store.get('taxdocs', r.body.id).status, 'locked');
    assert.equal((await call(base, 'GET', '/v1/taxdocs?workspace=ws-harbor')).body.documents[0].status, 'locked');
    const again = await call(base, 'POST', `/v1/taxdocs/${r.body.id}/resend`, { body: { portalUrl: PORTAL, sendEmail: true } });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const t2 = tokenOf(again.body.link);
    assert.ok(t2 && t2 !== t1);
    assert.equal((await look(base, t1)).status, 404, 'the old link stops');
    const w = await open(base, t2, { last4: '1111' });
    assert.equal(w.body.triesLeft, 4, 'tries start again');
    assert.equal((await open(base, t2, { last4: LAST4 })).status, 200);
  }));

test('consent: the first message asks for consent and is not the notice; the GET says consent is needed with the disclosure lines; open without consent is 409; with consent it opens, stores time and version and sends the notice', () =>
  start({}, async (base, server, clock) => {
    const r = await create(base, { consent: { inEffect: false, version: '2026-11-19', lines: CONSENT_LINES } });
    const first = await outbox(base);
    assert.equal(first.length, 1);
    assert.notEqual(first[0].subject, SUBJECT);
    assert.match(first[0].subject, /consent/i);
    assert.match(first[0].text, /consent/i);
    assert.ok(first[0].text.includes(r.body.link));
    const token = tokenOf(r.body.link);
    const g = await look(base, token);
    assert.equal(g.body.needs.consent, true);
    assert.deepEqual(g.body.consent.lines, CONSENT_LINES);
    assert.equal(g.body.consent.version, '2026-11-19');
    const no = await open(base, token, { last4: LAST4 });
    assert.equal(no.status, 409);
    assert.ok(!('pdf' in no.body));
    assert.equal((await open(base, token, { last4: LAST4, consent: false })).status, 409);
    clock.t += 3600e3;
    const yes = await open(base, token, { last4: LAST4, consent: true });
    assert.equal(yes.status, 200);
    assert.ok(yes.body.pdf);
    const rec = server.store.get('taxdocs', r.body.id);
    assert.deepEqual(rec.consent, { at: new Date(clock.t).toISOString(), version: '2026-11-19' });
    const msgs = await outbox(base);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].subject, SUBJECT, 'the section 7.01 notice is sent when the investor consents');
    assert.equal((await look(base, token)).body.needs.consent, false);
    assert.deepEqual((await call(base, 'GET', '/v1/taxdocs?workspace=ws-harbor')).body.documents[0].consent, rec.consent);
  }));

test("withdrawn: the investor's calls answer 410 and the file is removed from the store", () =>
  start({}, async (base, server) => {
    const r = await create(base);
    const token = tokenOf(r.body.link);
    const key = server.store.get('taxdocs', r.body.id).blob;
    assert.ok(server.store.getBlob(key));
    const w = await call(base, 'POST', `/v1/taxdocs/${r.body.id}/withdraw`, { body: {} });
    assert.equal(w.status, 200);
    assert.deepEqual(w.body, { id: r.body.id, status: 'withdrawn' });
    assert.equal((await look(base, token)).status, 410);
    assert.equal((await open(base, token, { last4: LAST4 })).status, 410);
    assert.equal(server.store.getBlob(key), null, 'the file is gone');
  }));

test('period: created 2027-03-10 with availableUntil 2027-12-31, it opens on 2027-04-10 and on 2027-12-31; on 2028-01-01 it answers 410 and purge removes the record and the file', () =>
  start({}, async (base, server, clock) => {
    const r = await create(base);
    const token = tokenOf(r.body.link);
    const key = server.store.get('taxdocs', r.body.id).blob;
    clock.t = Date.parse('2027-04-10T15:00:00Z');
    assert.equal((await open(base, token, { last4: LAST4 })).status, 200, '31 days after it was sent');
    clock.t = Date.parse('2027-12-31T23:30:00Z');
    assert.equal((await open(base, token, { last4: LAST4 })).status, 200, 'on its last day');
    clock.t = Date.parse('2028-01-01T00:30:00Z');
    const past = await open(base, token, { last4: LAST4 });
    assert.equal(past.status, 410, 'the day after its available-until date');
    assert.ok(!('pdf' in past.body));
    server.taxdocs.purge();
    assert.equal(server.store.get('taxdocs', r.body.id), null, 'the record is removed');
    assert.equal(server.store.getBlob(key), null, 'the file is removed');
    assert.equal((await look(base, token)).status, 404, 'once removed, the link is not known at all');
  }));

test("workspaces: a sponsor account's document is stored in its own workspace whatever the body names; another account cannot list, withdraw or resend it", () =>
  start({ env: { ADMIN_TOKEN: 'admin-token-taxdocs-0123456789' } }, async (base, server) => {
    const mk = async (workspace) => (await call(base, 'POST', '/v1/admin/accounts', { bearer: 'admin-token-taxdocs-0123456789', body: { workspace, name: workspace } })).body;
    const alpha = await mk('alpha');
    const beta = await mk('beta');
    const r = await create(base, { workspace: 'beta' }, { bearer: alpha.token });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(server.store.get('taxdocs', r.body.id).workspace, 'alpha');
    assert.equal((await call(base, 'GET', '/v1/taxdocs?workspace=alpha', { bearer: alpha.token })).body.documents.length, 1);
    assert.equal((await call(base, 'GET', '/v1/taxdocs?workspace=alpha', { bearer: beta.token })).body.documents.length, 0);
    const before = JSON.parse(JSON.stringify(server.store.get('taxdocs', r.body.id)));
    assert.equal((await call(base, 'POST', `/v1/taxdocs/${r.body.id}/withdraw`, { bearer: beta.token, body: {} })).status, 404);
    assert.equal((await call(base, 'POST', `/v1/taxdocs/${r.body.id}/resend`, { bearer: beta.token, body: { portalUrl: PORTAL } })).status, 404);
    assert.deepEqual(server.store.get('taxdocs', r.body.id), before, 'nothing changed');
    assert.equal((await look(base, tokenOf(r.body.link))).status, 200);
  }));

test('limits: over 10 MB answers 413; not a PDF, a different SHA-256, a bad email and a last4 that is not four digits each answer 400 and store nothing', () =>
  start({ env: { RATE_LIMIT_PER_MIN: '0' } }, async (base, server) => {
    const big = pdf('BIG', 10 * 1024 * 1024 + 10);
    assert.equal((await create(base, { file: big })).status, 413);
    const text = Buffer.from('not a pdf at all');
    assert.equal((await create(base, { pdf: text.toString('base64'), sha256: sha(text) })).status, 400);
    assert.equal((await create(base, { sha256: 'a'.repeat(64) })).status, 400);
    for (const email of ['zelda@investor', 'zelda investor@example.com', '']) assert.equal((await create(base, { investor: { id: 'HRC-0007', name: 'Zelda Quixote', email, last4: LAST4 } })).status, 400, email);
    for (const [k, last4] of ['678', '67890', '67a9', '', 6789].entries()) assert.equal((await create(base, { investor: { id: 'HRC-0007', name: 'Zelda Quixote', email: 'zelda@investor.example', last4 } })).status, 400, `bad last4 number ${k + 1}`);
    assert.equal(server.store.list('taxdocs').length, 0, 'nothing stored');
    assert.equal((await outbox(base)).length, 0, 'nothing sent');
  }));

test('list: each document gives id, docId, investorId, status, opens, consent, emailStatus and availableUntil, and never the file, the digits, the token, the name or the email', () =>
  start({}, async (base) => {
    const r = await create(base);
    const l = await call(base, 'GET', '/v1/taxdocs?workspace=ws-harbor');
    assert.equal(l.status, 200);
    assert.equal(l.body.documents.length, 1);
    const d = l.body.documents[0];
    assert.deepEqual(Object.keys(d).sort(), ['availableUntil', 'consent', 'docId', 'emailStatus', 'id', 'investorId', 'opens', 'status']);
    assert.deepEqual(d, { id: r.body.id, docId: 'doc-k1-zelda', investorId: 'HRC-0007', status: 'sent', opens: { first: '', last: '', count: 0 }, consent: null, emailStatus: 'outbox', availableUntil: '2027-12-31' });
    const text = JSON.stringify(l.body);
    for (const no of [LAST4, tokenOf(r.body.link), 'Zelda', 'zelda@investor.example', 'K1MARKER']) assert.ok(!text.includes(no));
    assert.equal((await call(base, 'GET', '/v1/taxdocs?workspace=ws-other')).body.documents.length, 0, "another workspace's list is empty");
  }));

test('opens: two opens give count 2, with first earlier than or equal to last', () =>
  start({}, async (base, server, clock) => {
    const r = await create(base);
    const token = tokenOf(r.body.link);
    assert.equal((await open(base, token, { last4: LAST4 })).status, 200);
    clock.t += 2 * DAY;
    assert.equal((await open(base, token, { last4: LAST4 })).status, 200);
    const o = server.store.get('taxdocs', r.body.id).opens;
    assert.equal(o.count, 2);
    assert.ok(o.first <= o.last);
    assert.equal(o.first, new Date(T0).toISOString());
    assert.equal(o.last, new Date(T0 + 2 * DAY).toISOString());
  }));

