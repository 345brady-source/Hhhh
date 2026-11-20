// gate: tests 5
// The sponsor's sender (server/lib/senders.mjs): an address becomes a domain with DNS records to add, checked until
// Ready. Run against the local stand-ins in ses-fake.mjs only; nothing here reaches the outside world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSenders } from '../lib/senders.mjs';
import ses, { httpsTransport, signRequest } from '../mailers/ses.mjs';
import { fakeSes, fakeResolver } from './ses-fake.mjs';

const SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYSTANDINKEY';
const ACCESS = 'AKIDSTANDIN0000001';

/** The store's three calls (get, put merging like server/lib/store.mjs, list), backed by a Map. */
function memStore() {
  const data = new Map();
  const kind = (k) => {
    if (!data.has(k)) data.set(k, new Map());
    return data.get(k);
  };
  return {
    data,
    get: (k, id) => kind(k).get(id) || null,
    put(k, rec) {
      const next = Object.assign({}, kind(k).get(rec.id), rec);
      kind(k).set(rec.id, next);
      return next;
    },
    list: (k) => [...kind(k).values()],
    dump: () => JSON.stringify([...data].map(([k, m]) => [k, [...m.values()]]))
  };
}

const envFor = (fake) => ({ MAIL_PROVIDER: 'ses', SES_REGION: 'us-east-1', SES_ACCESS_KEY_ID: ACCESS, SES_SECRET_ACCESS_KEY: SECRET, SES_API_HOST: fake.host });

test('tracer: an address is set up through the provider stand-in with signed calls and reported ready', async () => {
  const fake = await fakeSes();
  try {
    const store = memStore();
    const env = envFor(fake);
    const senders = createSenders({ store, env, adapter: ses, ctx: { transport: httpsTransport({ ca: fake.ca }), resolver: fakeResolver({}) } });
    const r = await senders.set('ws-harbor', 'notices@harborridge.example');
    assert.equal(r.status, 'pending');
    assert.equal(r.domain, 'harborridge.example');
    const dkim = r.records.filter((x) => x.purpose === 'dkim');
    assert.equal(dkim.length, 1);
    assert.equal(dkim[0].type, 'TXT');
    const sel = /^(cv[a-z0-9]{8})\._domainkey\.harborridge\.example$/.exec(dkim[0].name);
    assert.ok(sel, `DKIM record name: ${dkim[0].name}`);
    assert.ok(dkim[0].value.startsWith('v=DKIM1; k=rsa; p='), dkim[0].value.slice(0, 30));
    // The provider stand-in received one signed identity call carrying the selector, signed over what was sent.
    const post = fake.requests.find((q) => q.method === 'POST' && q.path === '/v2/email/identities');
    assert.ok(post, 'POST /v2/email/identities reached the stand-in');
    assert.match(post.headers.authorization, /^AWS4-HMAC-SHA256 Credential=/);
    const body = JSON.parse(post.body);
    assert.equal(body.EmailIdentity, 'harborridge.example');
    assert.equal(body.DkimSigningAttributes.DomainSigningSelector, sel[1]);
    const again = signRequest({ method: 'POST', path: post.path, headers: { host: post.headers.host, 'content-type': post.headers['content-type'], 'x-amz-date': post.headers['x-amz-date'] }, body: post.body, region: 'us-east-1', service: 'ses', accessKeyId: ACCESS, secretAccessKey: SECRET });
    assert.equal(post.headers.authorization, again.headers.authorization, 'the signature covers the bytes and headers the stand-in received');
    // Waiting for DNS, then Ready once the provider sees the record.
    assert.equal((await senders.check('ws-harbor')).status, 'pending');
    assert.equal(senders.ready('ws-harbor'), false);
    fake.status.set('harborridge.example', 'SUCCESS');
    const c = await senders.check('ws-harbor');
    assert.equal(c.status, 'ready');
    assert.equal(senders.ready('ws-harbor'), true);
    assert.equal(senders.get('ws-harbor').address, 'notices@harborridge.example');
  } finally {
    await fake.close();
  }
});
