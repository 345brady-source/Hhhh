// Sponsor accounts (plan 08-01): each sponsor's own token pins every sponsor call to that sponsor's workspace; another
// sponsor's records answer 404; tokens are stored only as a SHA-256 hash; the admin routes are off unless ADMIN_TOKEN is
// set and an invitation token never reaches them; the shared API_TOKEN and the open development server work as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';

/** A server with ADMIN_TOKEN, DATA_KEY and a public URL (no shared API_TOKEN unless a test sets one). */
const start = (opts, fn) => withServer({ env: Object.assign({ ADMIN_TOKEN: ADMIN, DATA_KEY: KEY, PUBLIC_URL: PUBLIC }, opts.env), providers: opts.providers, store: opts.store }, fn);

/** One call: bearer is the Authorization token (none when undefined), invite the X-Invite-Token. */
async function j(base, method, path, { bearer, invite, body } = {}) {
  const headers = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, bearer !== undefined ? { Authorization: `Bearer ${bearer}` } : {}, invite !== undefined ? { 'X-Invite-Token': invite } : {});
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/** The operator makes a sponsor account; the token is in the answer once. */
async function account(base, workspace, name) {
  const r = await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name: name || `${workspace} capital` } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

/** What the console posts to invite an investor; `workspace` is whatever the caller claims. */
const invitation = (workspace, over = {}) =>
  Object.assign(
    {
      workspace,
      sendEmail: true,
      portalUrl: PORTAL,
      firm: { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', supportEmail: 'ir@harborridge.example' },
      investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
      offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', shortName: 'Fund II', minimum: 100000, currency: 'USD', documents: [] },
      invitation: { cents: 25000000, cls: 'A' }
    },
    over
  );

test('tracer: a sponsor’s own token creates an invitation in its own workspace, whatever the body says, and lists only its own', () =>
  start({}, async (base, server) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');
    assert.match(alpha.id, /^acct_/);
    assert.match(alpha.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(alpha.workspace, 'alpha');
    assert.notEqual(alpha.token, beta.token);

    // alpha's token, a body that names beta's workspace: the invitation is alpha's.
    const made = await j(base, 'POST', '/v1/invitations', { bearer: alpha.token, body: invitation('beta') });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    assert.equal(server.store.get('invitations', made.body.id).workspace, 'alpha');

    // alpha lists it (a query naming beta changes nothing); beta lists nothing (a query naming alpha changes nothing).
    for (const q of ['', '?workspace=beta']) {
      const mine = await j(base, 'GET', `/v1/invitations${q}`, { bearer: alpha.token });
      assert.equal(mine.status, 200);
      assert.deepEqual(mine.body.map((x) => [x.id, x.workspace]), [[made.body.id, 'alpha']], q);
    }
    for (const q of ['', '?workspace=alpha']) {
      const theirs = await j(base, 'GET', `/v1/invitations${q}`, { bearer: beta.token });
      assert.equal(theirs.status, 200);
      assert.deepEqual(theirs.body, [], q);
    }
  }));
