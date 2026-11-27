// Sponsor accounts (plan 08-01): each sponsor's own token pins every sponsor call to that sponsor's workspace; another
// sponsor's records answer 404; tokens are stored only as a SHA-256 hash; the admin routes are off unless ADMIN_TOKEN is
// set and an invitation token never reaches them; the shared API_TOKEN and the open development server work as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withServer, keysDeep } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { BUILTINS } from '../providers/index.mjs';

const ADMIN = 'operator-admin-token-0123456789';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/diy.html?tenant=harbor';
const API = 'shared-api-token-0123456789';
const sha = (x) => createHash('sha256').update(x).digest('hex');
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);
const copy = (x) => JSON.parse(JSON.stringify(x));

/** Test providers: an identity check that passes at once with a letter to download, and a screening with no hits. */
function providers() {
  const calls = { evidence: 0 };
  const list = Object.assign({}, BUILTINS, {
    fakeid: {
      id: 'fakeid',
      name: 'Test identity',
      kind: 'identity',
      kinds: ['identity'],
      env: [],
      createSession: async () => ({ ref: 's-1', url: 'https://id.example/s/1', status: 'passed', evidence: [{ type: 'letter', label: 'Letter' }] }),
      fetchEvidence: async () => (calls.evidence++, { body: pdf('LETTERMARKER'), contentType: 'application/pdf', fileName: 'letter.pdf' })
    },
    fakescreen: { id: 'fakescreen', name: 'Test screening', kind: 'aml', kinds: ['aml'], env: [], screen: async () => ({ hits: [] }) }
  });
  return { list, calls };
}
const PERSON = { id: 'INV-9', name: 'Ann Lee', email: 'ann@investor.example' };
/** An agreement to sign on an invitation, and what the investor's page sends back when it is signed. */
const ESIGN = { template: { title: 'Subscription agreement', roles: ['investor', 'countersigner'], fields: [{ id: 'f1', role: 'investor', type: 'signature', page: 1 }], pages: 1, pageSizes: [[612, 792]], sha256: 'abc' }, pdf: pdf('TEMPLATEMARKER').toString('base64') };
const SUBMISSION = {
  investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', email: 'zelda@investor.example', type: 'individual', onboarding: { status: 'complete' } },
  request: { id: 'req-1', type: 'subscription', offeringId: 'hr-fund-ii', investorId: 'HRC-0007', cents: 25000000, status: 'pending', envelopeId: 'env-1' },
  envelope: { id: 'env-1', status: 'sent', requestId: 'req-1', docId: 'tpl-doc-1', workDocId: 'env-1-work' },
  files: { 'env-1-work': pdf('SIGNEDMARKER').toString('base64') },
  docs: [{ id: 'env-1-work', title: 'Subscription agreement (signed by the investor)' }],
  audit: [],
  notifications: []
};

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

test('pinned: checks, screenings and the outbox are the token’s workspace, whatever the request says', () => {
  const p = providers();
  return start({ providers: p.list }, async (base, server) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');

    const ver = await j(base, 'POST', '/v1/verifications', { bearer: alpha.token, body: { kind: 'identity', provider: 'fakeid', investor: Object.assign({ workspace: 'beta' }, PERSON) } });
    assert.equal(ver.status, 200, JSON.stringify(ver.body));
    assert.equal(server.store.get('verifications', ver.body.id).workspace, 'alpha');

    const scr = await j(base, 'POST', '/v1/screenings', { bearer: alpha.token, body: { provider: 'fakescreen', names: ['Ann Lee'], investor: Object.assign({ workspace: 'beta' }, PERSON) } });
    assert.equal(scr.status, 200, JSON.stringify(scr.body));
    assert.equal(server.store.get('screenings', scr.body.id).workspace, 'alpha');

    // Each sponsor's invitation email is kept in the outbox (no SMTP here); each sponsor reads only its own.
    const a = await j(base, 'POST', '/v1/invitations', { bearer: alpha.token, body: invitation('beta') });
    const b = await j(base, 'POST', '/v1/invitations', { bearer: beta.token, body: invitation('alpha') });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    for (const q of ['', '?workspace=beta', `?invitation=${a.body.id}`]) {
      const box = await j(base, 'GET', `/v1/outbox${q}`, { bearer: alpha.token });
      assert.equal(box.status, 200);
      assert.deepEqual(box.body.messages.map((m) => [m.invitationId, m.workspace]), [[a.body.id, 'alpha']], q);
    }
    assert.deepEqual((await j(base, 'GET', `/v1/outbox?invitation=${b.body.id}`, { bearer: alpha.token })).body.messages, []);
    assert.deepEqual((await j(base, 'GET', '/v1/outbox?workspace=alpha', { bearer: beta.token })).body.messages.map((m) => m.invitationId), [b.body.id]);
  });
});

test('foreign records: another sponsor’s invitations, submissions, checks, evidence and screenings answer 404 and nothing changes', () => {
  const p = providers();
  return start({ providers: p.list }, async (base, server) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');

    // alpha's records: an invitation the investor has completed (a signed file is kept), a check with a letter, a screening.
    const inv = await j(base, 'POST', '/v1/invitations', { bearer: alpha.token, body: invitation('alpha', { esign: ESIGN }) });
    assert.equal(inv.status, 200, JSON.stringify(inv.body));
    const done = await j(base, 'POST', '/v1/invite/complete', { invite: inv.body.token, body: SUBMISSION });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const ver = await j(base, 'POST', '/v1/verifications', { bearer: alpha.token, body: { kind: 'identity', provider: 'fakeid', investor: PERSON } });
    const scr = await j(base, 'POST', '/v1/screenings', { bearer: alpha.token, body: { provider: 'fakescreen', names: ['Ann Lee'], investor: PERSON } });
    assert.equal(ver.status, 200, JSON.stringify(ver.body));
    assert.equal(scr.status, 200, JSON.stringify(scr.body));
    // A second invitation, still open, so a resend or a cancel would change it.
    const open = await j(base, 'POST', '/v1/invitations', { bearer: alpha.token, body: invitation('alpha') });
    assert.equal(open.status, 200, JSON.stringify(open.body));

    const rec = server.store.get('invitations', inv.body.id);
    assert.equal(rec.hasSubmission, true);
    assert.ok(rec.submissionBlobs.length > 0, 'the submission kept a file');
    const before = copy(server.store.data());

    const unknown = await j(base, 'GET', '/v1/invitations/ivt_nosuchinvitation', { bearer: beta.token });
    assert.equal(unknown.status, 404);
    const tries = [
      ['GET', `/v1/invitations/${inv.body.id}`],
      ['GET', `/v1/invitations/${inv.body.id}/submission`],
      ['DELETE', `/v1/invitations/${inv.body.id}/submission`],
      ['POST', `/v1/invitations/${open.body.id}/resend`, {}],
      ['POST', `/v1/invitations/${open.body.id}/cancel`, {}],
      ['GET', `/v1/verifications/${ver.body.id}`],
      ['GET', `/v1/verifications/${ver.body.id}/evidence/0`],
      ['GET', `/v1/screenings/${scr.body.id}`]
    ];
    for (const [method, path, body] of tries) {
      const r = await j(base, method, path, { bearer: beta.token, body });
      assert.equal(r.status, 404, `${method} ${path} answered ${r.status} ${JSON.stringify(r.body)}`);
      // The same answer as for an id that does not exist: a 404 never confirms the record is there.
      if (path.startsWith('/v1/invitations/')) assert.deepEqual(r.body, unknown.body, `${method} ${path}`);
      else assert.deepEqual(r.body, { error: 'Not found' }, `${method} ${path}`);
    }
    assert.deepEqual(copy(server.store.data()), before, 'nothing in the store changed');
    assert.equal(p.calls.evidence, 0, 'the letter was not fetched');
    const after = server.store.get('invitations', inv.body.id);
    assert.equal(after.hasSubmission, true);
    for (const key of after.submissionBlobs) assert.ok(server.store.getBlob(key), `blob ${key} is still there`);
    assert.equal(server.store.get('invitations', open.body.id).status, 'sent');

    // The owner of those records reads and changes every one of them.
    assert.equal((await j(base, 'GET', `/v1/invitations/${inv.body.id}`, { bearer: alpha.token })).body.workspace, 'alpha');
    const sub = await j(base, 'GET', `/v1/invitations/${inv.body.id}/submission`, { bearer: alpha.token });
    assert.equal(sub.status, 200, JSON.stringify(sub.body));
    assert.ok(Buffer.from(sub.body.files['env-1-work'], 'base64').includes('SIGNEDMARKER'));
    assert.equal((await j(base, 'GET', `/v1/verifications/${ver.body.id}`, { bearer: alpha.token })).body.status, 'passed');
    const letter = await fetch(`${base}/v1/verifications/${ver.body.id}/evidence/0`, { headers: { Authorization: `Bearer ${alpha.token}` } });
    assert.equal(letter.status, 200);
    assert.ok(Buffer.from(await letter.arrayBuffer()).includes('LETTERMARKER'));
    assert.equal((await j(base, 'GET', `/v1/screenings/${scr.body.id}`, { bearer: alpha.token })).body.status, 'clear');
    assert.equal((await j(base, 'POST', `/v1/invitations/${open.body.id}/resend`, { bearer: alpha.token, body: {} })).status, 200);
    assert.equal((await j(base, 'POST', `/v1/invitations/${open.body.id}/cancel`, { bearer: alpha.token, body: {} })).body.status, 'cancelled');
    assert.deepEqual((await j(base, 'DELETE', `/v1/invitations/${inv.body.id}/submission`, { bearer: alpha.token })).body, { ok: true, deleted: true });
  });
});

test('rotation: after a new token is made the old one answers 401 and the new one works', () =>
  start({}, async (base) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: alpha.token })).status, 200);

    const turned = await j(base, 'POST', `/v1/admin/accounts/${alpha.id}/token`, { bearer: ADMIN });
    assert.equal(turned.status, 200, JSON.stringify(turned.body));
    assert.deepEqual(Object.keys(turned.body).sort(), ['id', 'token']);
    assert.equal(turned.body.id, alpha.id);
    assert.match(turned.body.token, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(turned.body.token, alpha.token);

    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: alpha.token })).status, 401);
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: turned.body.token })).status, 200);
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: beta.token })).status, 200, 'another sponsor’s token is untouched');
    // Still the same account and workspace.
    const made = await j(base, 'POST', '/v1/invitations', { bearer: turned.body.token, body: invitation('beta') });
    assert.equal((await j(base, 'GET', `/v1/invitations/${made.body.id}`, { bearer: turned.body.token })).body.workspace, 'alpha');

    assert.equal((await j(base, 'POST', '/v1/admin/accounts/acct_nosuchaccount/token', { bearer: ADMIN })).status, 404);
    assert.equal((await j(base, 'GET', `/v1/admin/accounts/${alpha.id}/token`, { bearer: ADMIN })).status, 405);
  }));

test('admin: every /v1/admin path answers 404 while ADMIN_TOKEN is not set', () =>
  withServer({ env: { API_TOKEN: API, DATA_KEY: KEY } }, async (base, server) => {
    for (const bearer of [undefined, API, ADMIN]) {
      for (const [method, path, body] of [['POST', '/v1/admin/accounts', { workspace: 'alpha', name: 'Alpha' }], ['GET', '/v1/admin/accounts'], ['POST', '/v1/admin/accounts/acct_abc/token'], ['GET', '/v1/admin'], ['GET', '/v1/admin/anything/else']]) {
        const r = await j(base, method, path, { bearer, body });
        assert.equal(r.status, 404, `${method} ${path} with ${bearer} answered ${r.status}`);
      }
    }
    assert.deepEqual(server.store.list('accounts'), []);
  }));

test('admin: a wrong token answers 401; a used or bad workspace answers 400; the list holds no token and no hash', () =>
  start({ env: { API_TOKEN: API } }, async (base, server) => {
    const alpha = await account(base, 'alpha', `  ${'N'.repeat(150)}`);
    assert.equal(alpha.name, 'N'.repeat(120), 'the name is clipped to 120');

    // Not the operator: no token, a wrong one, the shared API_TOKEN, a sponsor's own token.
    for (const bearer of [undefined, 'wrong-token', `${ADMIN}x`, API, alpha.token]) {
      for (const [method, path, body] of [['POST', '/v1/admin/accounts', { workspace: 'gamma', name: 'Gamma' }], ['GET', '/v1/admin/accounts'], ['POST', `/v1/admin/accounts/${alpha.id}/token`], ['GET', '/v1/admin/anything/else']]) {
        const r = await j(base, method, path, { bearer, body });
        assert.equal(r.status, 401, `${method} ${path} with ${bearer} answered ${r.status}`);
      }
    }
    assert.equal(server.store.list('accounts').length, 1, 'nothing was made');
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: alpha.token })).status, 200, 'the token was not replaced');

    // The operator: a workspace is used once, and is 1 to 120 letters, digits, dots, underscores or hyphens.
    const again = await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace: 'alpha', name: 'Second' } });
    assert.equal(again.status, 400);
    assert.ok(!JSON.stringify(again.body).includes(alpha.id));
    for (const workspace of ['', 'two words', 'a/b', 'x'.repeat(121), 42, null, undefined, ['alpha2']]) {
      const r = await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace, name: 'Bad' } });
      assert.equal(r.status, 400, `workspace ${JSON.stringify(workspace)} answered ${r.status}`);
    }
    assert.equal((await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: ['alpha3'] })).status, 400);
    assert.equal((await j(base, 'POST', '/v1/admin/accounts', { bearer: ADMIN, body: { workspace: 'Fund.II_2026-a' } })).status, 200);
    assert.equal((await j(base, 'GET', '/v1/admin/nothing', { bearer: ADMIN })).status, 404);

    const list = await j(base, 'GET', '/v1/admin/accounts', { bearer: ADMIN });
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.accounts.map((a) => a.workspace), ['alpha', 'Fund.II_2026-a']);
    for (const a of list.body.accounts) assert.deepEqual(Object.keys(a).sort(), ['createdAt', 'id', 'name', 'workspace']);
    const text = JSON.stringify(list.body);
    assert.ok(!text.includes(alpha.token) && !text.includes(sha(alpha.token)));
    // The word runs over the field names at any depth: an account id is random and could hold "token" by chance.
    assert.deepEqual(keysDeep(list.body).filter((k) => /token/i.test(k)), [], 'no token field');
  }));

test('shared token: with API_TOKEN and no account every call works as before (workspace from the body and the query)', () => {
  const p = providers();
  return start({ env: { API_TOKEN: API }, providers: p.list }, async (base, server) => {
    assert.equal((await j(base, 'GET', '/v1/invitations')).status, 401);
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: 'wrong-token' })).status, 401);

    const a = await j(base, 'POST', '/v1/invitations', { bearer: API, body: invitation('ws-a') });
    const b = await j(base, 'POST', '/v1/invitations', { bearer: API, body: invitation('ws-b') });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(server.store.get('invitations', a.body.id).workspace, 'ws-a');
    assert.equal(server.store.get('invitations', b.body.id).workspace, 'ws-b');
    const ids = async (path, bearer) => (await j(base, 'GET', path, { bearer })).body.map((x) => x.id).sort();
    assert.deepEqual(await ids('/v1/invitations?workspace=ws-a', API), [a.body.id]);
    assert.deepEqual(await ids('/v1/invitations', API), [a.body.id, b.body.id].sort());
    assert.deepEqual((await j(base, 'GET', '/v1/outbox?workspace=ws-b', { bearer: API })).body.messages.map((m) => m.invitationId), [b.body.id]);
    assert.equal((await j(base, 'GET', '/v1/outbox', { bearer: API })).body.messages.length, 2);

    const ver = await j(base, 'POST', '/v1/verifications', { bearer: API, body: { kind: 'identity', provider: 'fakeid', investor: Object.assign({ workspace: 'ws-b' }, PERSON) } });
    const scr = await j(base, 'POST', '/v1/screenings', { bearer: API, body: { provider: 'fakescreen', names: ['Ann Lee'], investor: Object.assign({ workspace: 'ws-b' }, PERSON) } });
    assert.equal(server.store.get('verifications', ver.body.id).workspace, 'ws-b');
    assert.equal(server.store.get('screenings', scr.body.id).workspace, 'ws-b');
    assert.equal((await j(base, 'GET', `/v1/verifications/${ver.body.id}`, { bearer: API })).body.status, 'passed');
    assert.equal((await j(base, 'GET', `/v1/screenings/${scr.body.id}`, { bearer: API })).body.status, 'clear');

    // Once accounts exist the shared token is the operator's own: it still reads every workspace. An account made for a
    // workspace that already has records reads those, and only those.
    const acct = await account(base, 'ws-a');
    assert.deepEqual(await ids('/v1/invitations', API), [a.body.id, b.body.id].sort());
    assert.equal((await j(base, 'GET', `/v1/invitations/${b.body.id}`, { bearer: API })).status, 200);
    assert.deepEqual(await ids('/v1/invitations', acct.token), [a.body.id]);
    assert.equal((await j(base, 'GET', `/v1/invitations/${b.body.id}`, { bearer: acct.token })).status, 404);
    assert.equal((await j(base, 'GET', `/v1/verifications/${ver.body.id}`, { bearer: acct.token })).status, 404);
  });
});

test('open server: with no API_TOKEN and no account a call with no token passes as before; once an account exists it answers 401', () => {
  const p = providers();
  return start({ providers: p.list }, async (base, server) => {
    assert.equal((await j(base, 'GET', '/v1/connectors')).status, 200);
    const ver = await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'fakeid', investor: Object.assign({ workspace: 'ws-open' }, PERSON) } });
    assert.equal(ver.status, 200, JSON.stringify(ver.body));
    assert.equal(server.store.get('verifications', ver.body.id).workspace, 'ws-open');
    assert.equal((await j(base, 'GET', `/v1/verifications/${ver.body.id}`)).status, 200);
    // Invitations still need API_TOKEN on a server with no account, with the message they always gave.
    const refused = await j(base, 'GET', '/v1/invitations');
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /^Set API_TOKEN on the integration server/);

    const alpha = await account(base, 'alpha');
    assert.equal((await j(base, 'GET', '/v1/connectors')).status, 401);
    assert.equal((await j(base, 'GET', '/v1/connectors', { bearer: 'wrong-token' })).status, 401);
    assert.equal((await j(base, 'GET', '/v1/connectors', { bearer: randomBytes(32).toString('base64url') })).status, 401);
    assert.equal((await j(base, 'POST', '/v1/verifications', { body: { kind: 'identity', provider: 'fakeid', investor: PERSON } })).status, 401);
    assert.equal((await j(base, 'GET', `/v1/verifications/${ver.body.id}`)).status, 401);
    assert.equal((await j(base, 'GET', '/v1/connectors', { bearer: alpha.token })).status, 200);
    // A sponsor's own token is enough for invitations.
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: alpha.token })).status, 200);
    assert.equal((await j(base, 'GET', '/v1/invitations')).status, 401);
  });
});

test('investor: a call carrying an invitation token answers 401 on every /v1/admin path and makes nothing', () =>
  start({}, async (base, server) => {
    const alpha = await account(base, 'alpha');
    const inv = await j(base, 'POST', '/v1/invitations', { bearer: alpha.token, body: invitation('alpha') });
    assert.equal(inv.status, 200, JSON.stringify(inv.body));
    assert.equal((await j(base, 'GET', '/v1/invite', { invite: inv.body.token })).status, 200, 'the invitation token is a live one');
    const before = copy(server.store.list('accounts'));

    // With the operator's own ADMIN_TOKEN beside it, with a sponsor's token, and alone; a live invitation token and a made-up one.
    for (const invite of [inv.body.token, randomBytes(32).toString('base64url'), '']) {
      for (const bearer of [ADMIN, alpha.token, undefined]) {
        for (const [method, path, body] of [['POST', '/v1/admin/accounts', { workspace: 'gamma', name: 'Gamma' }], ['GET', '/v1/admin/accounts'], ['POST', `/v1/admin/accounts/${alpha.id}/token`], ['GET', '/v1/admin']]) {
          const r = await j(base, method, path, { bearer, invite, body });
          assert.equal(r.status, 401, `${method} ${path} answered ${r.status} ${JSON.stringify(r.body)}`);
          assert.deepEqual(r.body, { error: 'Not authorized' });
        }
      }
    }
    assert.deepEqual(copy(server.store.list('accounts')), before, 'the accounts table is unchanged');
    assert.equal((await j(base, 'GET', '/v1/invitations', { bearer: alpha.token })).status, 200, 'the sponsor’s token was not replaced');
  }));

test('stored secrets: the store holds only each token’s SHA-256, and no token is in any event or the store file', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'accounts-')), 'store.json');
  const store = openStore(file);
  await start({ store }, async (base, server) => {
    const alpha = await account(base, 'alpha');
    const beta = await account(base, 'beta');
    const turned = (await j(base, 'POST', `/v1/admin/accounts/${alpha.id}/token`, { bearer: ADMIN })).body;
    await j(base, 'POST', '/v1/invitations', { bearer: turned.token, body: invitation('alpha') });
    await j(base, 'GET', '/v1/invitations', { bearer: alpha.token }); // the old token, refused

    const rec = server.store.get('accounts', alpha.id);
    assert.deepEqual(Object.keys(rec).sort(), ['createdAt', 'id', 'name', 'tokenHash', 'updatedAt', 'workspace']);
    assert.equal(rec.tokenHash, sha(turned.token));
    assert.equal(server.store.get('accounts', beta.id).tokenHash, sha(beta.token));
    server.store.flush();
    for (const text of [JSON.stringify(server.store.data()), readFileSync(file, 'utf8')]) {
      for (const token of [alpha.token, beta.token, turned.token]) assert.ok(!text.includes(token), 'a token is stored nowhere');
      assert.ok(!text.includes(sha(alpha.token)), 'the replaced token’s hash is gone');
    }
    const events = server.store.data().events;
    assert.deepEqual(events.filter((e) => /^account_/.test(e.type)).map((e) => [e.type, e.workspace]), [['account_created', 'alpha'], ['account_created', 'beta'], ['account_token_replaced', 'alpha']]);
    assert.ok(!/token(Hash)?"/.test(JSON.stringify(events)), 'no event carries a token or a hash');
  });
});

test('a store file written before accounts existed still opens, and an account can be made in it', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'accounts-old-')), 'store.json');
  writeFileSync(file, JSON.stringify({ verifications: {}, screenings: {}, invitations: {}, outbox: {}, events: [{ at: '2026-11-01T00:00:00.000Z', type: 'webhook' }], seen: ['a:1'] }));
  const store = openStore(file);
  await start({ store }, async (base, server) => {
    assert.deepEqual((await j(base, 'GET', '/v1/admin/accounts', { bearer: ADMIN })).body, { accounts: [] });
    const alpha = await account(base, 'alpha');
    assert.equal((await j(base, 'GET', '/v1/connectors', { bearer: alpha.token })).status, 200);
    server.store.flush();
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(saved.accounts), [alpha.id]);
    assert.equal(saved.events[0].type, 'webhook', 'what the file held is kept');
    assert.deepEqual(saved.seen, ['a:1']);
  });
});
