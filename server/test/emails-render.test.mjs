// gate: tests 8
// Plan 13-01 (EM-01, EM-02, EM-05): the one template set. assets/js/emails.js renders every message the server sends;
// server/lib/mail.mjs's builders return exactly what it renders. Goldens in server/test/fixtures/emails/ make every
// wording change a visible diff (written only with EMAILS_WRITE_GOLDEN=1, set by hand).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { withServer } from './helpers.mjs';

const require = createRequire(import.meta.url);
const E = () => require('../../assets/js/emails.js');

const DAY = 864e5;
const T0 = Date.parse('2026-11-10T12:00:00Z');
const API = 'sponsor-api-token-emails-0123456789';
const KEY = randomBytes(32).toString('base64');
const PUBLIC = 'https://api.example';
const PORTAL = 'https://portal.example/portal.html';
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456', accent: '#1F7A8C' }, logo: '', portalName: 'Harbor Ridge Investor Portal', disclaimer: 'Not an offer to sell securities.' };

function start(fn) {
  return withServer({ env: { API_TOKEN: API, DATA_KEY: KEY, PUBLIC_URL: PUBLIC }, now: () => T0 }, fn);
}
async function j(base, method, path, body) {
  const res = await fetch(base + path, { method, headers: Object.assign({ Authorization: `Bearer ${API}` }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

test('tracer: the invitation the server keeps in its outbox is emails.js’s render of the same snapshot', () =>
  start(async (base) => {
    const investor = { id: 'HRC-0101', contact: 'Shah, Anita', title: 'Anita Shah', type: 'individual', email: 'anita@investor.example' };
    const offering = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', currency: 'USD' };
    const invitation = { cents: 25000000, note: 'Glad to have you with us.', expiresAt: new Date(T0 + 30 * DAY).toISOString() };
    const r = await j(base, 'POST', '/v1/invitations', { workspace: 'ws-harbor', sendEmail: true, portalUrl: PORTAL, firm: FIRM, investor, offering, invitation });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.emailStatus, 'outbox');
    const box = (await j(base, 'GET', `/v1/outbox?invitation=${r.body.id}`)).body.messages;
    assert.equal(box.length, 1);
    const [m] = box;
    const out = E().render('invitation', { firm: FIRM, investor, offering, invitation: { cents: 25000000, cls: '', note: invitation.note, senderName: '' }, link: r.body.link, expiresAt: r.body.expiresAt });
    assert.equal(out.subject, 'Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund II');
    assert.ok(out.text.startsWith('Dear Anita,'), out.text.slice(0, 80));
    assert.equal(m.subject, out.subject);
    assert.equal(m.text, out.text);
    assert.equal(m.html, out.html);
  }));
