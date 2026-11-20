// gate: tests 14
// Tax documents delivered to the investor's own device (plan 10-12, C-04, TAX-04 to TAX-06): the console sends one
// document sealed, the investor's link (X-Doc-Token) shows the firm, the title and what is needed, and the document
// opens only with the last four digits of the tax number on record. Every number used here is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';

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

