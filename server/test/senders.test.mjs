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

/** A sender module wired to the provider stand-in. */
const wired = (fake, store = memStore()) => ({ store, senders: createSenders({ store, env: envFor(fake), adapter: ses, ctx: { transport: httpsTransport({ ca: fake.ca }), resolver: fakeResolver({}) } }) });
const statusOf = async (p) => {
  try {
    await p;
  } catch (e) {
    return e.status;
  }
  return 'no error';
};

test('bad address: not an address, a@b or a line break is 400 and nothing is stored or sent', async () => {
  const fake = await fakeSes();
  try {
    const { store, senders } = wired(fake);
    for (const a of ['not an address', 'a@b', 'notices@harborridge.example\r\nBcc: x@y.example', 'notices@harborridge.example\n']) assert.equal(await statusOf(senders.set('ws-harbor', a)), 400, JSON.stringify(a));
    assert.equal(await statusOf(senders.set('bad workspace/../x', 'notices@harborridge.example')), 400);
    assert.equal(store.list('senders').length, 0);
    assert.equal(fake.requests.length, 0);
    assert.equal(senders.get('ws-harbor'), null);
    assert.deepEqual(await senders.check('ws-harbor'), { status: 'not_set_up', detail: 'No sending address is set up yet.', records: [] });
  } finally {
    await fake.close();
  }
});

test('change address: the same domain keeps its records; another domain starts again at pending with new records', async () => {
  const fake = await fakeSes();
  try {
    const { senders } = wired(fake);
    const a = await senders.set('ws-harbor', 'notices@harborridge.example');
    fake.status.set('harborridge.example', 'SUCCESS');
    await senders.check('ws-harbor');
    const b = await senders.set('ws-harbor', 'investors@HarborRidge.example');
    assert.deepEqual(b.records, a.records);
    assert.equal(b.status, 'ready', 'the domain stays ready');
    assert.equal(senders.get('ws-harbor').address, 'investors@HarborRidge.example');
    assert.equal(fake.requests.filter((q) => q.method === 'POST').length, 1, 'no second identity call');
    const c = await senders.set('ws-harbor', 'notices@ridgeline.example');
    assert.equal(c.status, 'pending');
    assert.equal(senders.ready('ws-harbor'), false);
    assert.notDeepEqual(c.records, a.records);
    assert.match(c.records[0].name, /\._domainkey\.ridgeline\.example$/);
    // Back to the first domain: the provider already holds it, so it is given the new key (and the new record).
    const d = await senders.set('ws-harbor', 'notices@harborridge.example');
    assert.equal(d.status, 'pending');
    const put = fake.requests.find((q) => q.method === 'PUT');
    assert.ok(put && put.path === '/v2/email/identities/harborridge.example/dkim/signing', 'the existing identity gets the new key');
    assert.equal(fake.identities.get('harborridge.example').selector, /^([^.]+)\./.exec(d.records[0].name)[1]);
  } finally {
    await fake.close();
  }
});

test('workspaces: two workspaces keep separate records; one never sees the other\'s, nor takes its domain', async () => {
  const fake = await fakeSes();
  try {
    const { senders } = wired(fake);
    const a = await senders.set('ws-harbor', 'notices@harborridge.example');
    const b = await senders.set('ws-ridge', 'notices@ridgeline.example');
    fake.status.set('harborridge.example', 'SUCCESS');
    await senders.check('ws-harbor');
    assert.equal(senders.ready('ws-harbor'), true);
    assert.equal(senders.ready('ws-ridge'), false);
    const ga = senders.get('ws-harbor');
    const gb = senders.get('ws-ridge');
    assert.deepEqual(ga.records, a.records);
    assert.deepEqual(gb.records, b.records);
    assert.ok(!JSON.stringify(gb).includes('harborridge'), 'ws-ridge sees nothing of ws-harbor');
    assert.equal(await statusOf(senders.set('ws-ridge', 'billing@harborridge.example')), 409);
    assert.deepEqual(senders.get('ws-harbor').records, a.records, 'the other workspace\'s domain is untouched');
    assert.equal(senders.get('ws-ridge').domain, 'ridgeline.example');
  } finally {
    await fake.close();
  }
});

test('nothing secret: get, check and the stored record hold no private key, access key or secret', async () => {
  const fake = await fakeSes();
  try {
    const { store, senders } = wired(fake);
    await senders.set('ws-harbor', 'notices@harborridge.example');
    const checked = await senders.check('ws-harbor');
    const pk = fake.identities.get('harborridge.example').privateKey;
    assert.ok(pk && pk.length > 1000, 'the provider received the private key');
    for (const text of [store.dump(), JSON.stringify(senders.get('ws-harbor')), JSON.stringify(checked)]) {
      // private parts only (the first ~380 base64 characters are the modulus, public in the DKIM record)
      for (const s of [pk.slice(400, 460), pk.slice(-70, -10), ACCESS, SECRET]) assert.ok(!text.includes(s), 'no secret in the store or the answers');
      assert.doesNotMatch(text, /PRIVATE KEY/);
    }
  } finally {
    await fake.close();
  }
});
