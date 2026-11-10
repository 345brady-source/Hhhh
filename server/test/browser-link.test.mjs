// A connector's start link goes only to the investor's browser, so it may carry real names (URL-encoded);
// server-side calls keep refusing values that do not look like ids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeConnector } from '../providers/connector.mjs';
import { fillUrl } from '../lib/template.mjs';

test('start links accept real names, encoded; server URLs still refuse them', async () => {
  const c = makeConnector({ id: 'acmelink', name: 'Acme Link', checks: ['accreditation'], start: { link: 'https://verify.acme.example/start?ref={reference}&name={investor.name}&email={investor.email}' }, statuses: { accreditation: { accredited: 'verified', '*': 'pending' } } });
  const r = await c.createSession({ reference: 'ver_abc', kind: 'accreditation', investor: { id: 'A-1', name: "Ann O'Neil Lee", email: 'ann@example.com' }, settings: {}, env: {}, publicUrl: 'http://verify.test', returnUrl: '', webhookUrl: '', hostedUrl: '', data: {} });
  const u = new URL(r.url);
  assert.equal(u.origin, 'https://verify.acme.example');
  assert.equal(u.searchParams.get('name'), "Ann O'Neil Lee");
  assert.equal(u.searchParams.get('ref'), 'ver_abc');
  assert.throws(() => fillUrl('https://api.acme.example/v1/people/{investor.name}', { investor: { name: "Ann O'Neil Lee" } }));
});
