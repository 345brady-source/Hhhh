// gate: tests 8
// The firm's notices, capital calls and e-sign notices from the server (plan 13-04, EM-04, EM-09, C-06): one call of the
// console's POST /v1/messages mails up to 500 of a workspace's investors, each message rendered by assets/js/emails.js
// (the console's own previews), each answered with its own status and logged in the sealed sent log. Everything runs
// against the outbox and the local SMTP stand-in (smtp-fake.mjs); nothing here reaches the outside world. Every address
// and token is made by the test; the numbers the screen must refuse come from ranges never issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { emailHash } from '../lib/maillog.mjs';
import { MAIL_SAYS } from '../lib/mail.mjs';
import { REFUSALS } from '../lib/roles.mjs';
import { fakeSmtp, parts } from './smtp-fake.mjs';
import { stripLinkTokens } from './helpers.mjs';

const E = createRequire(import.meta.url)('../../assets/js/emails.js');
const API = 'shared-api-token-messages-0123456789';
const ADMIN = 'operator-admin-token-messages-0123';
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const WS = 'ws-harbor';
const ADDRESS = '1 Harbor Way, Boston, MA 02110';
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', disclaimer: 'Not an offer to sell securities.' };
const PEOPLE = [
  ['HRC-0001', 'Anita Shah', 'anita@investor.example'],
  ['HRC-0002', 'Daniel Brooks', 'daniel@investor.example'],
  ['HRC-0003', 'Maria Ortiz', 'maria@investor.example']
];
const QUARTERLY = 'The Q3 2026 quarterly report for Harbor Ridge Fund II has been posted to your portal. Sign in and open Documents to read it.';

/** A server on a random port. smtp: true wires the SMTP stand-in; env is laid over the defaults (undefined removes one). */
async function harness({ env = {}, smtp = false, now } = {}) {
  const relay = smtp ? await fakeSmtp({}) : null;
  const store = openStore(null);
  const full = Object.assign({ NODE_ENV: 'test', PUBLIC_URL: PUBLIC, API_TOKEN: API, MAIL_FROM: 'notices@portal-mail.example' }, env);
  if (relay) Object.assign(full, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(relay.port), SMTP_ALLOW_PLAIN: '1' });
  for (const k of Object.keys(full)) if (full[k] === undefined) delete full[k];
  const server = createServer({ env: full, store, now });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    server,
    store,
    relay,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      if (relay) await relay.close();
    }
  };
}

async function call(base, method, path, { bearer = API, body, raw, cookie, origin } = {}) {
  const headers = {};
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = raw !== undefined ? 'application/x-www-form-urlencoded' : 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body: json, text };
}

/** The recipients of a call: one per person, the sponsor's subject and text merged for each. */
const recipients = (n = 2, over = {}) =>
  PEOPLE.slice(0, n).map(([investorId, name, email]) => Object.assign({ investorId, name, email, subject: `Q3 2026 report for Harbor Ridge Fund II is now available`, body: `Dear ${name.split(' ')[0]},\n\n${QUARTERLY}\n\nHarbor Ridge Capital`, data: { activated: true } }, over));
const notice = (over = {}) => Object.assign({ workspace: WS, kind: 'notice', variant: 'quarterly', firm: FIRM, portalUrl: PORTAL, offeringNews: false, recipients: recipients() }, over);
/** What emails.js renders for one recipient of a call: the console's preview of the same message. */
const rendered = (msg, r, extra = {}) => E.render(msg.kind, Object.assign({ variant: msg.variant, firm: Object.assign({}, msg.firm), investor: { id: r.investorId, contact: r.name }, subject: r.subject, body: r.body, portalUrl: msg.portalUrl }, r.data || {}, extra));

test('tracer', async () => {
  // No SMTP_HOST: the messages go to the outbox, in the firm's layout, one per investor, each logged.
  const h = await harness();
  try {
    const msg = notice();
    const r = await call(h.base, 'POST', '/v1/messages', { body: msg });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body, { results: msg.recipients.map((x) => ({ investorId: x.investorId, emailStatus: 'outbox', error: '' })) });
    const box = await call(h.base, 'GET', `/v1/outbox?workspace=${WS}`);
    assert.equal(box.status, 200, box.text);
    assert.equal(box.body.messages.length, 2, box.text);
    for (const x of msg.recipients) {
      const m = box.body.messages.find((y) => y.to === x.email);
      assert.ok(m, `a message to ${x.email}`);
      assert.equal(m.kind, 'notice');
      assert.equal(m.subject, x.subject);
      assert.equal(m.toName, x.name);
      assert.equal(m.from, `"Harbor Ridge Capital" <notices@portal-mail.example>`);
      assert.equal(m.replyTo, FIRM.supportEmail);
      const want = rendered(msg, x);
      assert.equal(m.text, want.text, 'the text is the console preview’s, word for word');
      assert.equal(m.html, want.html);
    }
    const log = await call(h.base, 'GET', `/v1/messages/log?workspace=${WS}`);
    assert.equal(log.status, 200, log.text);
    assert.deepEqual(log.body.entries.map((e) => [e.investorId, e.kind, e.status, e.subject]).sort(), msg.recipients.map((x) => [x.investorId, 'notice', 'outbox', x.subject]).sort());
  } finally {
    await h.close();
  }
});

/* ---------- Task 2: every kind, the refusals, the limits, workspaces and statuses ---------- */

const ESIGN = ['esign_request', 'esign_reminder', 'esign_voided', 'esign_completed'];
const CALLS = { capital_call: 'Capital call 2 for Harbor Ridge Fund II: $25,000.00 due December 10, 2026', capital_call_reminder: 'Reminder: capital call 2 for Harbor Ridge Fund II ($25,000.00) is due December 10, 2026' };
const POSTAL = "Add your firm's postal address before sending invitations to a new offering.";
// A token-shaped string (W8): a run of 32 or more base64url characters, looked for after stripLinkTokens has cut the
// random parts of links out. These messages carry no link but the portal page, so nothing of this shape may be left.
const TOKEN_SHAPE = /[A-Za-z0-9_-]{32,}/;
const hrefs = (html) => Array.from(String(html).matchAll(/href="([^"]*)"/g), (m) => m[1].replace(/&amp;/g, '&'));
const webLinks = (text) => Array.from(String(text).matchAll(/https?:\/\/[^\s"'<>]+/g), (m) => m[0].replace(/&amp;/g, '&'));
const lf = (s) => String(s).replace(/\r\n/g, '\n');
const counts = async (h, ws = WS) => [(await call(h.base, 'GET', `/v1/outbox?workspace=${ws}`)).body.messages.length, (await call(h.base, 'GET', `/v1/messages/log?workspace=${ws}`)).body.entries.length];

test('kinds', async () => {
  const h = await harness({ smtp: true });
  try {
    for (const kind of Object.keys(CALLS).concat(ESIGN)) {
      const isCall = kind in CALLS;
      const variant = kind === 'capital_call' ? 'call' : kind === 'capital_call_reminder' ? 'reminder' : 'portal';
      const text = { subject: isCall ? CALLS[kind] : '', body: isCall ? 'Dear investor,\n\nYour contribution is due December 10, 2026. Wire instructions are in your portal.\n\nHarbor Ridge Capital' : '' };
      const list = recipients(2, text).map((r) => Object.assign(r, { data: { activated: true, envelope: { title: 'Fund II side letter' }, signer: { name: r.name } } }));
      const msg = notice({ kind, variant, recipients: list });
      const before = h.relay.messages.length;
      const r = await call(h.base, 'POST', '/v1/messages', { body: msg });
      assert.equal(r.status, 200, `${kind}: ${r.text}`);
      assert.deepEqual(r.body.results.map((x) => x.emailStatus), ['sent', 'sent'], `${kind}: ${r.text}`);
      const got = h.relay.messages.slice(before);
      assert.equal(got.length, 2, `${kind}: one message per recipient`);
      for (const x of list) {
        const m = got.find((y) => y.to[0] === x.email);
        assert.ok(m, `${kind}: a message to ${x.email}`);
        const want = rendered(msg, x);
        if (isCall) assert.equal(want.subject, CALLS[kind]);
        else assert.ok(want.subject.startsWith('Harbor Ridge Capital: ') && want.subject.includes('Fund II side letter'), want.subject);
        assert.ok(m.data.replace(/\r\n[ \t]+/g, ' ').includes(`\r\nSubject: ${want.subject}\r\n`), `${kind}: the kind's subject`);
        const p = parts(m.data);
        assert.equal(lf(p.text), want.text, `${kind}: the console preview’s text`);
        assert.deepEqual(Array.from(new Set(webLinks(p.text))), [PORTAL], `${kind}: one link, the portal address`);
        assert.deepEqual(Array.from(new Set(hrefs(p.html).filter((u) => !u.startsWith('mailto:')))), [PORTAL], `${kind}: the HTML's only web link is the portal address`);
        assert.equal((p.html.match(/data-button/g) || []).length, 1, `${kind}: one button`);
        assert.ok(!/Content-Disposition: attachment/i.test(m.data) && !/multipart\/mixed/i.test(m.data), `${kind}: no attachment`);
        assert.equal(TOKEN_SHAPE.exec(stripLinkTokens(`${p.text}\n${p.html}`)), null, `${kind}: no token-shaped string`);
      }
    }
  } finally {
    await h.close();
  }
});

test('screen', async () => {
  const h = await harness();
  try {
    const cases = [
      [notice({ recipients: recipients(2).map((r, n) => (n === 1 ? Object.assign(r, { body: `${r.body}\n\nYour number on file: 000-12-3456` }) : r)) }), 'recipients[1].body', '000-12-3456'],
      [notice({ recipients: recipients(2).map((r, n) => (n === 0 ? Object.assign(r, { subject: 'Account 991234567890 statement' }) : r)) }), 'recipients[0].subject', '991234567890'],
      [notice({ kind: 'esign_request', variant: 'portal', recipients: recipients(1, { subject: '', body: '', data: { envelope: { title: 'Side letter password: x' }, signer: { name: 'Anita Shah' } } }) }), 'recipients[0].data.envelope.title', 'password: x']
    ];
    for (const [msg, field, bad] of cases) {
      const r = await call(h.base, 'POST', '/v1/messages', { body: msg });
      assert.equal(r.status, 422, r.text);
      assert.deepEqual(r.body, { error: E.screen(bad).reason, field });
      assert.ok(!r.text.includes(bad), 'the answer does not repeat what it refused');
    }
    assert.deepEqual(await counts(h), [0, 0], 'nothing was sent or logged');
  } finally {
    await h.close();
  }
});

test('postal', async () => {
  const h = await harness({ smtp: true });
  try {
    const news = (firm) => notice({ variant: 'offeringNews', offeringNews: true, firm, recipients: recipients(1, { subject: 'Harbor Ridge Fund III is open for subscriptions', body: 'Dear Anita,\n\nHarbor Ridge Fund III is now accepting subscriptions from our investors.\n\nHarbor Ridge Capital' }) });
    const no = await call(h.base, 'POST', '/v1/messages', { body: news(FIRM) });
    assert.equal(no.status, 422, no.text);
    assert.deepEqual(no.body, { error: POSTAL, field: 'firm.postalAddress' });
    // offeringNews makes a notice offering news whatever variant it names.
    const custom = await call(h.base, 'POST', '/v1/messages', { body: Object.assign(news(FIRM), { variant: 'custom' }) });
    assert.equal(custom.status, 422, custom.text);
    assert.equal(h.relay.messages.length, 0, 'nothing was sent');

    const ok = await call(h.base, 'POST', '/v1/messages', { body: news(Object.assign({}, FIRM, { postalAddress: ADDRESS })) });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.results[0].emailStatus, 'sent', ok.text);
    const raw = h.relay.messages[0].data;
    const header = (/^List-Unsubscribe: <([^>]+)>\r?$/m.exec(raw) || [])[1] || '';
    assert.ok(/^List-Unsubscribe-Post: List-Unsubscribe=One-Click\r?$/m.test(raw), 'the one-click header');
    const token = (/^https:\/\/verify\.example\/unsubscribe\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header) || [])[1];
    assert.ok(token, `the header address is the server's one-click address: ${header}`);
    const p = parts(raw);
    const footer = `${PORTAL}&server=${encodeURIComponent(PUBLIC)}#unsubscribe-${token}`;
    assert.ok(lf(p.text).includes(`To stop invitations to new offerings from Harbor Ridge Capital, use this link: ${footer}`), p.text);
    assert.ok(p.text.includes(ADDRESS), 'the postal address is in the footer');
    assert.ok(hrefs(p.html).includes(footer), 'the footer link in the HTML');
    assert.notEqual(header, footer, 'the one-click address and the footer link differ');
    assert.ok(!p.text.includes(header) && !p.html.includes(header), 'the one-click address is in the header only');
  } finally {
    await h.close();
  }
});

test('limits', async () => {
  let t = Date.parse('2026-11-27T10:00:00Z');
  const h = await harness({ env: { MAIL_RATE_PER_HOUR: '3' }, now: () => t });
  try {
    const many = Array.from({ length: 501 }, (_, n) => ({ investorId: `HRC-${n}`, name: `Investor ${n}`, email: `i${n}@investor.example`, subject: 'Notice', body: 'Dear investor,\n\nA notice.' }));
    const big = await call(h.base, 'POST', '/v1/messages', { body: notice({ recipients: many }) });
    assert.equal(big.status, 400, big.text);
    assert.deepEqual(await counts(h), [0, 0]);
    const first = await call(h.base, 'POST', '/v1/messages', { body: notice() });
    assert.equal(first.status, 200, first.text);
    const second = await call(h.base, 'POST', '/v1/messages', { body: notice() });
    assert.equal(second.status, 429, second.text);
    assert.ok(/at most 3 /.test(second.body.error), second.text);
    assert.deepEqual(await counts(h), [2, 2], 'nothing of the refused call was sent or logged');
    t += 3600e3 + 1;
    const later = await call(h.base, 'POST', '/v1/messages', { body: notice() });
    assert.equal(later.status, 200, later.text);
    assert.deepEqual(await counts(h), [4, 4]);
  } finally {
    await h.close();
  }
});

test('workspaces', async () => {
  const h = await harness({ env: { API_TOKEN: undefined, ADMIN_TOKEN: ADMIN } });
  try {
    const acct = async (workspace, name) => (await call(h.base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name } })).body;
    const a = await acct(WS, 'Harbor Ridge Capital');
    const b = await acct('ws-beta', 'Beta Funds');
    // An account's call naming another workspace acts on its own (no SMTP here: the outbox, under its own workspace).
    const r = await call(h.base, 'POST', '/v1/messages', { bearer: a.token, body: notice({ workspace: 'ws-beta' }) });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.results.map((x) => x.emailStatus), ['outbox', 'outbox']);
    assert.equal((await call(h.base, 'GET', '/v1/messages/log', { bearer: a.token })).body.entries.length, 2);
    assert.equal((await call(h.base, 'GET', '/v1/messages/log', { bearer: b.token })).body.entries.length, 0, 'nothing logged under the other workspace');
    assert.equal((await call(h.base, 'GET', '/v1/outbox', { bearer: b.token })).body.messages.length, 0);
    assert.deepEqual(h.store.list('maillog').map((x) => x.workspace), [WS, WS]);
    // Choices: each account sees its own workspace's only, whatever it asks for.
    h.store.put('mailprefs', { id: 'ws-beta:0000', workspace: 'ws-beta', investorId: 'BF-0001', offering: false, at: '2026-11-27T10:00:00.000Z', how: 'link' });
    h.store.put('mailprefs', { id: `${WS}:1111`, workspace: WS, investorId: 'HRC-0001', offering: false, at: '2026-11-27T10:00:00.000Z', how: 'link' });
    const mine = await call(h.base, 'GET', '/v1/messages/preferences?workspace=ws-beta', { bearer: a.token });
    assert.equal(mine.status, 200, mine.text);
    assert.deepEqual(mine.body, { preferences: [{ investorId: 'HRC-0001', offering: false, at: '2026-11-27T10:00:00.000Z', how: 'link' }] });
    const theirs = await call(h.base, 'GET', '/v1/messages/preferences', { bearer: b.token });
    assert.deepEqual(theirs.body.preferences.map((x) => x.investorId), ['BF-0001']);

    // A signed-in person whose role lacks operate is refused the call (B1); reading the choices needs view only.
    const origin = PUBLIC; // the server's own origin (lib/auth.mjs's browser-write rule)
    const pw = randomBytes(12).toString('base64url');
    const up = await call(h.base, 'POST', '/v1/auth/signup', { bearer: '', origin, body: { firm: 'Cedar Point Partners', name: 'Pat Owner', email: 'pat@cedarpoint.example', password: pw } });
    assert.equal(up.status, 201, up.text);
    const ws = up.body.workspace.id;
    const roPw = randomBytes(12).toString('base64url');
    await h.server.signin.people.create({ workspace: ws, kind: 'team', role: 'readonly', email: 'ro@cedarpoint.example', name: 'Robin Reader', password: roPw });
    const si = await fetch(`${h.base}/v1/auth/signin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: 'ro@cedarpoint.example', password: roPw }) });
    assert.equal(si.status, 200, await si.text());
    const cookie = si.headers.getSetCookie()[0].split(';')[0];
    h.store.put('sessions', { id: createHash('sha256').update(cookie.split('=')[1]).digest('hex'), stage: 'full', mfaAt: new Date().toISOString() });
    const refused = await call(h.base, 'POST', '/v1/messages', { bearer: '', cookie, origin, body: notice() });
    assert.equal(refused.status, 403, refused.text);
    assert.deepEqual(refused.body, { error: REFUSALS.operate, code: 'role' });
    assert.equal(h.store.list('maillog').filter((x) => x.workspace === ws).length, 0, 'nothing sent or logged');
    const seen = await call(h.base, 'GET', '/v1/messages/preferences', { bearer: '', cookie, origin });
    assert.equal(seen.status, 200, seen.text);
    assert.deepEqual(seen.body, { preferences: [] });
  } finally {
    await h.close();
  }
});

test('statuses', async () => {
  const h = await harness({ smtp: true, env: { API_TOKEN: undefined, ADMIN_TOKEN: ADMIN } });
  try {
    const a = (await call(h.base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace: WS, name: 'Harbor Ridge Capital' } })).body;
    // The first address bounced for good earlier; the workspace's own domain is not ready on this accounts server.
    h.store.put('mailsuppress', { id: emailHash(PEOPLE[0][2]), reason: 'bounced', at: '2026-11-01T00:00:00.000Z' });
    const r = await call(h.base, 'POST', '/v1/messages', { bearer: a.token, body: notice() });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.results, [
      { investorId: 'HRC-0001', emailStatus: 'suppressed', error: MAIL_SAYS.bounced },
      { investorId: 'HRC-0002', emailStatus: 'held', error: MAIL_SAYS.notReady }
    ]);
    assert.equal(h.relay.messages.length, 0, 'nothing reached the relay');
    const log = (await call(h.base, 'GET', '/v1/messages/log', { bearer: a.token })).body.entries;
    assert.deepEqual(log.map((e) => [e.investorId, e.status]).sort(), [['HRC-0001', 'suppressed'], ['HRC-0002', 'held']], 'each logged once');
  } finally {
    await h.close();
  }
});

test('bad input', async () => {
  const h = await harness();
  try {
    const bad = [
      notice({ kind: 'tax_notice' }),
      notice({ kind: 'notice', variant: 'weekly' }),
      notice({ recipients: [] }),
      notice({ recipients: recipients(2).map((r, n) => (n === 1 ? Object.assign(r, { email: 'not-an-address' }) : r)) }),
      notice({ portalUrl: 'http://portal.example/portal.html' }),
      notice({ portalUrl: 'javascript:alert(1)' })
    ];
    for (const body of bad) {
      const r = await call(h.base, 'POST', '/v1/messages', { body });
      assert.equal(r.status, 400, `${JSON.stringify({ kind: body.kind, variant: body.variant, n: body.recipients.length, portalUrl: body.portalUrl })}: ${r.text}`);
      assert.ok(typeof r.body.error === 'string' && r.body.error.length > 5, r.text);
    }
    assert.deepEqual(await counts(h), [0, 0]);
  } finally {
    await h.close();
  }
});

