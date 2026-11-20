// gate: tests 5
// The generic adapter (server/mailers/smtp.mjs): the sponsor sends through its own mail server, so this adapter only
// says which DNS records to add and checks them through an injected resolver (ses-fake.mjs's stand-in). No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import smtp from '../mailers/smtp.mjs';
import { pick, MAILERS } from '../mailers/index.mjs';
import { fakeResolver } from './ses-fake.mjs';

const VENDOR = /amazon|aws|\bses\b|google|microsoft|outlook|gmail|postmark|sendgrid|mailgun|zoho/i;
const KEY = `v=DKIM1; k=rsa; p=${'A'.repeat(250)}${'B'.repeat(142)}`;
const full = () => ({
  'harborridge.example': [['v=spf1 include:_spf.mailhost.example ~all'], ['some-site-verification=abc']],
  'k1._domainkey.harborridge.example': [[KEY.slice(0, 255), KEY.slice(255)]], // a 2048-bit key arrives in two pieces
  '_dmarc.harborridge.example': [['v=DMARC1; p=none']]
});

test('guidance: SPF, DKIM and DMARC records that say what to copy from the sponsor\'s own mail provider, no vendor name', async () => {
  const recs = await smtp.records('harborridge.example', {});
  assert.deepEqual(recs.map((r) => r.purpose).sort(), ['dkim', 'dmarc', 'spf']);
  const by = Object.fromEntries(recs.map((r) => [r.purpose, r]));
  assert.equal(by.spf.name, 'harborridge.example');
  assert.match(by.spf.value, /^v=spf1 .*your mail provider/);
  assert.match(by.dkim.name, /\._domainkey\.harborridge\.example$/);
  assert.match(by.dkim.value, /your mail provider/);
  assert.deepEqual([by.dmarc.type, by.dmarc.name, by.dmarc.value], ['TXT', '_dmarc.harborridge.example', 'v=DMARC1; p=none']);
  for (const r of recs) assert.doesNotMatch(`${r.name} ${r.value}`, VENDOR);
  const named = await smtp.records('harborridge.example', { selector: 'k1' });
  assert.equal(named.find((r) => r.purpose === 'dkim').name, 'k1._domainkey.harborridge.example');
  // The registry: smtp when MAIL_PROVIDER is unset, refused when it names something else.
  assert.equal(pick({}), smtp);
  assert.equal(pick({ MAIL_PROVIDER: 'ses' }), MAILERS.ses);
  assert.throws(() => pick({ MAIL_PROVIDER: 'constructor' }), /MAIL_PROVIDER must be smtp or ses/);
});

test('check ready: SPF on the root, DKIM at the given selector (in two pieces) and DMARC give ready', async () => {
  const st = await smtp.status('harborridge.example', { resolver: fakeResolver(full()), selector: 'k1' });
  assert.equal(st.state, 'ready');
  assert.doesNotMatch(st.detail, VENDOR);
  // Pieces split anywhere (some DNS hosts split before "p=" or inside a tag) are joined before comparing.
  const split = full();
  split['k1._domainkey.harborridge.example'] = [['v=DKIM1; k=rsa; ', KEY.slice(16)]];
  split['_dmarc.harborridge.example'] = [['v=DMA', 'RC1; p=none']];
  split['harborridge.example'] = [['v=sp', 'f1 include:_spf.mailhost.example ~all']];
  assert.equal((await smtp.status('harborridge.example', { resolver: fakeResolver(split), selector: 'k1' })).state, 'ready');
  // With no selector given, the common selectors are tried.
  assert.equal((await smtp.status('harborridge.example', { resolver: fakeResolver(full()) })).state, 'ready');
});

test('check pending: each missing record gives pending and a sentence naming that record only', async () => {
  const names = { spf: 'harborridge.example', dkim: 'k1._domainkey.harborridge.example', dmarc: '_dmarc.harborridge.example' };
  const word = { spf: 'SPF', dkim: 'DKIM', dmarc: 'DMARC' };
  for (const miss of Object.keys(names)) {
    const t = full();
    if (miss === 'spf') t[names.spf] = [['some-site-verification=abc']];
    else delete t[names[miss]];
    const st = await smtp.status('harborridge.example', { resolver: fakeResolver(t), selector: 'k1' });
    assert.equal(st.state, 'pending', miss);
    assert.equal(st.detail, `The ${word[miss]} record is not visible yet.`);
    for (const other of Object.keys(word)) if (other !== miss) assert.ok(!st.detail.includes(word[other]), `${miss}: ${st.detail}`);
  }
  const none = await smtp.status('harborridge.example', { resolver: fakeResolver({ 'harborridge.example': [['other']] }), selector: 'k1' });
  assert.equal(none.detail, 'The SPF, DKIM and DMARC records are not visible yet.');
});

test('no events: the generic adapter has no delivery events', async () => {
  assert.deepEqual(await smtp.events({ headers: {} }, Buffer.from('{"Type":"Notification"}'), {}), []);
  assert.deepEqual(await smtp.events({ headers: {} }, Buffer.from('not json'), {}), []);
});

test('resolver errors: a name that does not exist or a timeout gives pending, never a thrown error', async () => {
  for (const code of ['ENOTFOUND', 'ETIMEOUT']) {
    const st = await smtp.status('harborridge.example', { resolver: fakeResolver({}, { fail: code }), selector: 'k1' });
    assert.deepEqual(st, { state: 'pending', detail: 'The DNS records are not visible yet.' }, code);
  }
});
