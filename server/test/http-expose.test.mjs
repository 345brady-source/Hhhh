// The letter's file name reaches the console (08-CONTEXT "After 08-18"): the console runs on another origin, so the browser
// shows it the Content-Disposition header only when the server exposes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withServer } from './helpers.mjs';
import { BUILTINS } from '../providers/index.mjs';

const PORTAL = 'https://portal.example';
const letters = {
  id: 'lettertest',
  name: 'Letter test',
  kind: 'accreditation',
  env: [],
  createSession: async () => ({ ref: 'p-1', url: 'https://reviewer.example/s/p-1' }),
  fetchResult: async () => ({ status: 'pending' }),
  fetchEvidence: async () => ({ body: Buffer.from('%PDF-1.4\n%%EOF\n'), contentType: 'application/pdf', fileName: 'Verification letter 1.pdf' })
};

test('CORS exposes Content-Disposition to the allowed origin', () =>
  withServer({ env: { PORTAL_ORIGIN: PORTAL } }, async (base) => {
    const r = await fetch(`${base}/health`, { headers: { Origin: PORTAL } });
    assert.equal(r.headers.get('access-control-allow-origin'), PORTAL);
    assert.match(r.headers.get('access-control-expose-headers') || '', /(^|,\s*)Content-Disposition(\s*,|$)/);
  }));

test('a letter fetched from another origin carries its file name, exposed to that origin', () =>
  withServer({ env: { PORTAL_ORIGIN: PORTAL }, providers: Object.assign({}, BUILTINS, { lettertest: letters }) }, async (base, server) => {
    const ver = await (await fetch(`${base}/v1/verifications`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: PORTAL }, body: JSON.stringify({ kind: 'accreditation', provider: 'lettertest', investor: { id: 'A-1', name: 'Ann Lee' } }) })).json();
    assert.match(ver.id, /^ver_/);
    server.store.put('verifications', { id: ver.id, status: 'verified', evidence: [{ type: 'letter', label: 'Verification letter' }] });
    const r = await fetch(`${base}/v1/verifications/${ver.id}/evidence/0`, { headers: { Origin: PORTAL } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="Verification_letter_1.pdf"');
    assert.match(r.headers.get('access-control-expose-headers') || '', /(^|,\s*)Content-Disposition(\s*,|$)/);
  }));
