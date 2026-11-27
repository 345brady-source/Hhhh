// gate: tests 8
// The firm's notices, capital calls and e-sign notices from the server (plan 13-04, EM-04, EM-09, C-06): one call of the
// console's POST /v1/messages mails up to 500 of a workspace's investors, each message rendered by assets/js/emails.js
// (the console's own previews), each answered with its own status and logged in the sealed sent log. Everything runs
// against the outbox and the local SMTP stand-in (smtp-fake.mjs); nothing here reaches the outside world. Every address
// and token is made by the test; the numbers the screen must refuse come from ranges never issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
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

