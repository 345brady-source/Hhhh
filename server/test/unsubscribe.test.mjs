// gate: tests 5
// One-click unsubscribe (plan 13-04, EM-11, C-02 "To be confirmed with counsel"): every possibly commercial message (offering
// news, an invitation to a new offering) carries List-Unsubscribe with the server's one-click address and
// List-Unsubscribe-Post, and its footer link opens the firm's own portal page. A POST to the one-click address turns
// offering news off for that investor at once; later offering messages to them answer unsubscribed and are not sent;
// required notices still go. Tokens are signed with this server's own key: a forged, altered or unknown token gets the
// same answer and changes nothing, and a GET never unsubscribes. Everything runs against the local SMTP stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';

const API = 'shared-api-token-unsubscribe-0123456789';
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const WS = 'ws-harbor';
const ADDRESS = '1 Harbor Way, Boston, MA 02110';
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', postalAddress: ADDRESS };
const ANITA = { investorId: 'HRC-0001', name: 'Anita Shah', email: 'anita@investor.example' };
const DANIEL = { investorId: 'HRC-0002', name: 'Daniel Brooks', email: 'daniel@investor.example' };
const POSTAL = "Add your firm's postal address before sending invitations to a new offering.";
const GET_SAYS = 'Use the link in the email to stop these emails.';

async function harness({ store, env = {} } = {}) {
  const relay = await fakeSmtp({});
  const s = store || openStore(null);
  const server = createServer({ env: Object.assign({ NODE_ENV: 'test', PUBLIC_URL: PUBLIC, API_TOKEN: API, MAIL_FROM: 'notices@portal-mail.example', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(relay.port), SMTP_ALLOW_PLAIN: '1' }, env), store: s });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    server,
    store: s,
    relay,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await relay.close();
    }
  };
}
async function call(base, method, path, { bearer = API, body, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (raw !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body: json, text, type: res.headers.get('content-type') || '' };
}
const person = (p, kind) => Object.assign({}, p, kind === 'call' ? { subject: 'Capital call 2 for Harbor Ridge Fund II: $25,000.00 due December 10, 2026', body: `Dear ${p.name.split(' ')[0]},\n\nYour contribution is due December 10, 2026. Wire instructions are in your portal.\n\nHarbor Ridge Capital` } : { subject: 'Harbor Ridge Fund III is open for subscriptions', body: `Dear ${p.name.split(' ')[0]},\n\nHarbor Ridge Fund III is now accepting subscriptions.\n\nHarbor Ridge Capital` }, { data: { activated: true } });
const news = (people, firm = FIRM) => ({ workspace: WS, kind: 'notice', variant: 'offeringNews', offeringNews: true, firm, portalUrl: PORTAL, recipients: people.map((p) => person(p, 'news')) });
const capitalCall = (people) => ({ workspace: WS, kind: 'capital_call', variant: 'call', firm: FIRM, portalUrl: PORTAL, recipients: people.map((p) => person(p, 'call')) });
const sentTo = (h, address) => h.relay.messages.filter((m) => m.to[0] === address);
const oneClick = (raw) => (/^List-Unsubscribe: <([^>]+)>\r?$/m.exec(raw) || [])[1] || '';
const prefs = async (h) => (await call(h.base, 'GET', `/v1/messages/preferences?workspace=${WS}`)).body.preferences;
/** The path of the one-click address the message to `address` carries (its host is PUBLIC_URL). */
async function stopPath(h, address) {
  const r = await call(h.base, 'POST', '/v1/messages', { body: news([{ investorId: 'HRC-0009', name: 'Probe Person', email: address }]) });
  assert.equal(r.status, 200, r.text);
  const raw = sentTo(h, address).slice(-1)[0].data;
  const url = oneClick(raw);
  assert.ok(url.startsWith(`${PUBLIC}/unsubscribe/`), url);
  return url.slice(PUBLIC.length);
}
const invitation = (inv, over = {}) =>
  Object.assign(
    {
      workspace: WS,
      sendEmail: true,
      portalUrl: PORTAL,
      firm: FIRM,
      investor: { id: inv.investorId, contact: inv.name, title: inv.name, type: 'individual', email: inv.email, existing: true },
      offering: { id: 'hr-fund-iii', name: 'Harbor Ridge Fund III', shortName: 'Fund III', minimum: 100000, currency: 'USD', documents: [] },
      invitation: { cents: 0, cls: 'A', existing: true }
    },
    over
  );

test('one click', async () => {
  const h = await harness();
  try {
    const first = await call(h.base, 'POST', '/v1/messages', { body: news([ANITA, DANIEL]) });
    assert.equal(first.status, 200, first.text);
    const url = oneClick(sentTo(h, ANITA.email)[0].data);
    assert.ok(url.startsWith(`${PUBLIC}/unsubscribe/`), url);
    assert.deepEqual(await prefs(h), [], 'nobody has turned anything off yet');
    // The mail client's one-click POST (RFC 8058).
    const r = await call(h.base, 'POST', url.slice(PUBLIC.length), { bearer: '', raw: 'List-Unsubscribe=One-Click' });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, {});
    const p = await prefs(h);
    assert.equal(p.length, 1);
    assert.deepEqual([p[0].investorId, p[0].offering, p[0].how], [ANITA.investorId, false, 'link']);
    assert.ok(Number.isFinite(Date.parse(p[0].at)), 'when it was turned off');
    // The portal page's POST (JSON) with the same token: still off, recorded once.
    assert.equal((await call(h.base, 'POST', url.slice(PUBLIC.length), { bearer: '', body: {} })).status, 200);
    assert.equal((await prefs(h)).length, 1);

    // The next offering news: unsubscribed for her, not sent; still sent to him.
    const before = h.relay.messages.length;
    const next = await call(h.base, 'POST', '/v1/messages', { body: news([ANITA, DANIEL]) });
    assert.equal(next.status, 200, next.text);
    assert.deepEqual(next.body.results.map((x) => [x.investorId, x.emailStatus]), [[ANITA.investorId, 'unsubscribed'], [DANIEL.investorId, 'sent']]);
    assert.deepEqual(h.relay.messages.slice(before).map((m) => m.to[0]), [DANIEL.email], 'nothing was sent to her');
    const log = (await call(h.base, 'GET', `/v1/messages/log?workspace=${WS}&investorId=${ANITA.investorId}`)).body.entries;
    assert.deepEqual(log.map((e) => e.status), ['unsubscribed', 'sent'], 'the unsent message is logged as unsubscribed');
    // A capital call is a required notice: it still goes to her.
    const req = await call(h.base, 'POST', '/v1/messages', { body: capitalCall([ANITA]) });
    assert.deepEqual(req.body.results.map((x) => x.emailStatus), ['sent'], req.text);
    assert.equal(sentTo(h, ANITA.email).length, 2);
    assert.equal(oneClick(sentTo(h, ANITA.email)[1].data), '', 'a required notice carries no unsubscribe header');
  } finally {
    await h.close();
  }
});

test('invitation', async () => {
  const h = await harness();
  try {
    // An invitation to a new offering for an investor on file is possibly commercial: the headers and the footer link.
    const sent = await call(h.base, 'POST', '/v1/invitations', { body: invitation(DANIEL) });
    assert.equal(sent.status, 200, sent.text);
    assert.equal(sent.body.emailStatus, 'sent', sent.text);
    const raw = sentTo(h, DANIEL.email)[0].data;
    const header = oneClick(raw);
    const token = (/\/unsubscribe\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header) || [])[1];
    assert.ok(header.startsWith(`${PUBLIC}/unsubscribe/`) && token, header);
    assert.ok(/^List-Unsubscribe-Post: List-Unsubscribe=One-Click\r?$/m.test(raw));
    const text = parts(raw).text.replace(/\r\n/g, '\n');
    assert.ok(text.includes(`use this link: ${PORTAL}&server=${encodeURIComponent(PUBLIC)}#unsubscribe-${token}`), text);
    assert.ok(!text.includes(header), 'the footer opens the portal page, the header is the one-click address');

    // She turns offering news off; her invitation to a new offering is made, marked unsubscribed, and not sent.
    const path = await stopPath(h, ANITA.email);
    assert.equal((await call(h.base, 'POST', path, { bearer: '', raw: 'List-Unsubscribe=One-Click' })).status, 200);
    const before = h.relay.messages.length;
    const off = await call(h.base, 'POST', '/v1/invitations', { body: invitation(ANITA) });
    assert.equal(off.status, 200, off.text);
    assert.equal(off.body.emailStatus, 'unsubscribed', off.text);
    assert.ok(/^ivt_/.test(off.body.id) && off.body.link, 'the invitation is still made, with its link for the console');
    assert.equal(h.relay.messages.length, before, 'nothing was sent');
    const row = (await call(h.base, 'GET', '/v1/invitations')).body.find((x) => x.id === off.body.id);
    assert.equal(row.emailStatus, 'unsubscribed');
    const entry = (await call(h.base, 'GET', `/v1/messages/log?workspace=${WS}&investorId=${ANITA.investorId}`)).body.entries[0];
    assert.deepEqual([entry.kind, entry.status], ['invitation', 'unsubscribed']);
    // An invitation that is not possibly commercial (a commitment agreed, not an offering to someone on file) still goes.
    const paid = await call(h.base, 'POST', '/v1/invitations', { body: invitation(ANITA, { invitation: { cents: 25000000, cls: 'A' }, offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', minimum: 100000, currency: 'USD', documents: [] }, investor: { id: ANITA.investorId, contact: ANITA.name, title: ANITA.name, type: 'individual', email: ANITA.email } }) });
    assert.equal(paid.body.emailStatus, 'sent', paid.text);
    assert.equal(oneClick(sentTo(h, ANITA.email).slice(-1)[0].data), '', 'and carries no unsubscribe header');

    // C-06 on invitations: once the firm's stored record holds the postal-address field, an empty address refuses a
    // possibly commercial invitation that would be emailed (422, nothing made); one with a commitment still goes.
    const count = h.store.list('invitations').length;
    const noAddress = Object.assign({}, FIRM, { postalAddress: '' });
    const free = await call(h.base, 'POST', '/v1/invitations', { body: invitation(DANIEL, { firm: noAddress }) });
    assert.equal(free.status, 200, 'without the field on the firm record the console’s own rule applies (13-05)');
    h.server.workspaces.put(WS, { tenant: { name: 'Harbor Ridge Capital', postalAddress: '' } }, 0, { id: 'per_test', name: 'Test' });
    const refused = await call(h.base, 'POST', '/v1/invitations', { body: invitation(DANIEL, { firm: noAddress }) });
    assert.equal(refused.status, 422, refused.text);
    assert.deepEqual(refused.body, { error: POSTAL });
    assert.equal(h.store.list('invitations').length, count + 1, 'the refused invitation left nothing behind');
    const manual = await call(h.base, 'POST', '/v1/invitations', { body: invitation(DANIEL, { firm: noAddress, sendEmail: false }) });
    assert.equal(manual.status, 200, 'an invitation the sponsor sends by hand is not emailed by the server');
    const withCommitment = await call(h.base, 'POST', '/v1/invitations', { body: invitation(DANIEL, { firm: noAddress, invitation: { cents: 25000000, cls: 'A' }, investor: { id: 'HRC-0004', contact: 'Lee Park', title: 'Lee Park', type: 'individual', email: 'lee@investor.example' } }) });
    assert.equal(withCommitment.status, 200, withCommitment.text);
  } finally {
    await h.close();
  }
});

test('forged', async () => {
  const h = await harness();
  const other = await harness();
  try {
    const path = await stopPath(h, ANITA.email);
    const token = path.split('/').pop();
    // The same workspace, investor and address, signed by another server's own key.
    const foreign = (await stopPath(other, ANITA.email)).split('/').pop();
    assert.notEqual(foreign, token);
    const flip = (s, at) => s.slice(0, at) + (s[at] === 'A' ? 'B' : 'A') + s.slice(at + 1);
    const tries = [flip(token, token.length - 3), flip(token, 2), foreign, randomBytes(24).toString('base64url'), 'not-a-token', `${token}.x`];
    for (const t of tries) {
      const r = await call(h.base, 'POST', `/unsubscribe/${t}`, { bearer: '', raw: 'List-Unsubscribe=One-Click' });
      assert.equal(r.status, 200, `${t}: ${r.text}`);
      assert.equal(r.text, '{}', 'the same answer as a valid token');
    }
    assert.deepEqual(await prefs(h), [], 'nothing changed');
    assert.equal(h.store.list('mailprefs').filter((x) => x.workspace).length, 0);
    // The signature is compared in constant time (lib/crypto.mjs safeEqual), never with ===.
    const src = readFileSync(new URL('../lib/messages.mjs', import.meta.url), 'utf8');
    assert.ok(/import \{[^}]*\bsafeEqual\b[^}]*\} from '\.\/crypto\.mjs'/.test(src) && /safeEqual\(/.test(src.slice(src.indexOf('function verify'))), 'safeEqual compares the signature');
    // The real token still works.
    assert.equal((await call(h.base, 'POST', path, { bearer: '', raw: 'List-Unsubscribe=One-Click' })).text, '{}');
    assert.equal((await prefs(h)).length, 1);
  } finally {
    await h.close();
    await other.close();
  }
});

test('get', async () => {
  const h = await harness();
  try {
    const path = await stopPath(h, ANITA.email);
    const r = await call(h.base, 'GET', path, { bearer: '' });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.text, GET_SAYS);
    assert.ok(r.type.startsWith('text/plain'), r.type);
    assert.deepEqual(await prefs(h), [], 'a GET (a link scanner, a preview) changes nothing');
    const head = await fetch(`${h.base}${path}`, { method: 'HEAD' });
    assert.ok(head.status === 200 || head.status === 405, String(head.status));
    assert.deepEqual(await prefs(h), []);
  } finally {
    await h.close();
  }
});

test('nothing stored in plain', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'unsub-'));
  const file = join(dir, 'store.json');
  const h = await harness({ store: openStore(file), env: { DATA_KEY: randomBytes(32).toString('base64') } });
  try {
    await call(h.base, 'POST', '/v1/messages', { body: news([ANITA]) });
    const url = oneClick(sentTo(h, ANITA.email)[0].data);
    assert.equal((await call(h.base, 'POST', url.slice(PUBLIC.length), { bearer: '', raw: 'List-Unsubscribe=One-Click' })).status, 200);
    await call(h.base, 'POST', '/v1/messages', { body: news([ANITA]) });
    assert.equal((await prefs(h)).length, 1);
    await new Promise((r) => setTimeout(r, 300)); // the store writes its file shortly after a change
    const text = readFileSync(file, 'utf8');
    for (const s of [ANITA.email, ANITA.email.toUpperCase(), ANITA.name]) assert.ok(!text.includes(s), `the store file holds no ${s}`);
    const data = JSON.parse(text);
    const key = data.mailprefs._key;
    assert.ok(key && key.box && key.box.v === 1 && !('plain' in key.box), 'the signing key is sealed');
    const events = JSON.stringify(data.events);
    assert.ok(data.events.some((e) => e.type === 'unsubscribed' && e.workspace === WS), 'the unsubscribe is an event');
    for (const s of [ANITA.investorId, ANITA.email, ANITA.name]) assert.ok(!events.includes(s), `no event holds ${s}`);
  } finally {
    await h.close();
  }
});
