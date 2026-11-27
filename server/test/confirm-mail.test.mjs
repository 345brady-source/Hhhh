// gate: tests 4
// The investor's confirmation (plan 13-04, EM-10, C-09): when an onboarding, a subscription, a tax form request, a
// co-investor's signature or a re-verification is completed, the investor (the co-investor for their signature) gets one
// email from the firm saying what it received, logged in the sent log, beside the sponsor's notification. It holds
// nothing sensitive (no taxpayer, bank or account number, no date of birth, no address), a mail failure never fails the
// completion, and a suppressed address is not mailed. Runs against the outbox and a local SMTP stand-in; the numbers
// in the submissions come from ranges never issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { emailHash } from '../lib/maillog.mjs';
import { stripLinkTokens } from './helpers.mjs';

const T0 = Date.parse('2026-11-10T12:00:00Z');
const DAY = 864e5;
const API = 'sponsor-api-token-confirm-mail-0123456789';
const PUBLIC = 'https://verify.example';
const PORTAL = 'https://portal.example/portal.html?tenant=harbor';
const WS = 'ws-harbor';
const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', onboarding: { accreditation: false } };
const FUND = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', shortName: 'Fund II', minimum: 100000, currency: 'USD', exemption: 'Rule 506(b)', documents: [] };
const ANITA = { id: 'HRC-0001', contact: 'Anita Shah', title: 'Anita Shah', type: 'individual', email: 'anita@investor.example', taxType: 'us-individual' };
// What the investor's device sends back that must never reach an email: never-issued numbers, a date of birth, an address.
const TIN = '000-12-3456';
const ACCOUNT_NO = '991234567890';
const DOB = '1970-01-02';
const STREET = '2287 Willow Bend Drive';
const SECRETS = [TIN, ACCOUNT_NO, DOB, STREET, 'First Example Bank'];
const pdf = (marker) => Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n`);

async function harness({ env = {}, smtp } = {}) {
  const store = openStore(null);
  const full = Object.assign({ NODE_ENV: 'test', PUBLIC_URL: PUBLIC, API_TOKEN: API, DATA_KEY: randomBytes(32).toString('base64'), MAIL_FROM: 'notices@portal-mail.example' }, env);
  if (smtp) Object.assign(full, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_ALLOW_PLAIN: '1' });
  const server = createServer({ env: full, store, now: () => T0 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    server,
    store,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  };
}
async function j(base, method, path, { body, token, auth = true } = {}) {
  const h = Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, auth ? { Authorization: `Bearer ${API}` } : {}, token !== undefined ? { 'X-Invite-Token': token } : {});
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text), text };
  } catch {
    return { status: res.status, body: text, text };
  }
}
async function invite(base, over = {}) {
  const r = await j(base, 'POST', '/v1/invitations', { body: Object.assign({ workspace: WS, sendEmail: true, portalUrl: PORTAL, notifyEmail: 'ops@harborridge.example', firm: FIRM, investor: ANITA, offering: FUND, invitation: { cents: 25000000, cls: '' }, verification: { connections: [], use: {}, rules: {} } }, over) });
  assert.equal(r.status, 200, r.text);
  return r.body;
}
/** A finished onboarding: the investor's details (with the numbers no email may carry) and, with an offering, the request. */
const finished = (over = {}) =>
  Object.assign(
    {
      investor: { id: ANITA.id, contact: ANITA.contact, title: ANITA.title, email: ANITA.email, type: 'individual', tin: TIN, dob: DOB, address: { street: STREET, city: 'Boise', state: 'ID', zip: '83706' }, payment: { method: 'ach', bank: 'First Example Bank', account: ACCOUNT_NO }, onboarding: { status: 'complete' } },
      request: { id: 'req-1', type: 'subscription', offeringId: FUND.id, investorId: ANITA.id, cents: 25000000, status: 'pending', signedBy: 'Anita Shah' },
      envelope: null,
      files: {},
      docs: [],
      audit: [],
      notifications: []
    },
    over
  );
const complete = (base, token, body) => j(base, 'POST', '/v1/invite/complete', { token, auth: false, body });
const outbox = async (base) => (await j(base, 'GET', `/v1/outbox?workspace=${WS}`)).body.messages;
const log = async (base) => (await j(base, 'GET', `/v1/messages/log?workspace=${WS}`)).body.entries;
const webLinks = (text) => Array.from(String(text).matchAll(/https?:\/\/[^\s"'<>]+/g), (m) => m[0].replace(/&amp;/g, '&'));

test('onboarding and subscription', async () => {
  const h = await harness();
  try {
    const r = await invite(h.base);
    const c = await complete(h.base, r.token, finished());
    assert.equal(c.status, 200, c.text);
    const box = await outbox(h.base);
    const conf = box.filter((m) => m.kind === 'confirmation');
    assert.equal(conf.length, 1, 'one confirmation');
    assert.ok(box.some((m) => m.kind === 'sponsor_notification' && m.to === 'ops@harborridge.example'), 'beside the sponsor’s notification');
    const [m] = conf;
    assert.equal(m.to, ANITA.email);
    assert.equal(m.subject, 'Harbor Ridge Capital: we received your subscription to Harbor Ridge Fund II');
    assert.equal(m.from, '"Harbor Ridge Capital" <notices@portal-mail.example>');
    assert.ok(m.text.startsWith('Dear Anita,\n\n'), m.text.slice(0, 40));
    assert.ok(m.text.includes('on November 10, 2026'), m.text);
    assert.deepEqual(Array.from(new Set(webLinks(m.text))), [PORTAL], 'one link, the portal address');
    assert.deepEqual(Array.from(new Set(webLinks(m.html.replace(/href="mailto:[^"]*"/g, '')))), [PORTAL]);
    assert.ok(!/carrow|powered by|refract|\bbasic\b/i.test(stripLinkTokens(`${m.subject}\n${m.text}\n${m.html}`)), 'white label');
    const entry = (await log(h.base)).find((e) => e.kind === 'confirmation');
    assert.deepEqual([entry.status, entry.refId, entry.investorId], ['outbox', r.id, ANITA.id], 'logged');

    // A new investor's onboarding with no offering: "we received your onboarding".
    const o = await invite(h.base, { investor: Object.assign({}, ANITA, { id: 'HRC-0002', email: 'anita.two@investor.example' }), offering: null, invitation: { cents: 0, cls: '' } });
    const c2 = await complete(h.base, o.token, finished({ investor: Object.assign({}, finished().investor, { id: 'HRC-0002', email: 'anita.two@investor.example' }), request: null }));
    assert.equal(c2.status, 200, c2.text);
    const m2 = (await outbox(h.base)).find((x) => x.kind === 'confirmation' && x.to === 'anita.two@investor.example');
    assert.equal(m2 && m2.subject, 'Harbor Ridge Capital: we received your onboarding');
  } finally {
    await h.close();
  }
});

/** The agreement a co-investor signs (assets/js/esign.js's shape, as server/test/invitations-cosign.test.mjs holds it). */
function agreement(coStatus) {
  return {
    id: 'env-a7',
    title: 'Subscription Agreement - Harbor Ridge Fund II - Marlow Ashby',
    status: 'sent',
    docId: 'env-a7-orig',
    workDocId: 'env-a7-work',
    agreementFor: FUND.id,
    signers: [
      { id: 'sg-1', role: 'investor', investorId: 'HRC-0107', name: 'Marlow Ashby', email: 'marlow@investor.example', status: 'signed', signedAt: '2026-11-09T15:00:00Z', signature: { kind: 'typed', text: 'Marlow Ashby' } },
      { id: 'sg-2', role: 'investor', co: true, investorId: 'HRC-0107', name: 'Rowan Ashby', email: 'rowan@coinvestor.example', account: 'Marlow and Rowan Ashby JTWROS', status: coStatus, signedAt: coStatus === 'signed' ? '2026-11-10T11:30:00Z' : null, signature: coStatus === 'signed' ? { kind: 'typed', text: 'Rowan Ashby' } : null },
      { id: 'sg-3', role: 'countersigner', investorId: null, name: 'Avery Lane', email: 'avery@harborridge.example', status: 'waiting', signedAt: null, signature: null }
    ],
    fields: [
      { id: 'fd-1', signerId: 'sg-1', type: 'signature', page: 3, x: 0.1, y: 0.7, w: 0.3, h: 0.03, value: 'adopted' },
      { id: 'fd-4', signerId: 'sg-2', type: 'signature', page: 3, x: 0.5, y: 0.7, w: 0.3, h: 0.03, value: coStatus === 'signed' ? 'adopted' : null },
      { id: 'fd-5', signerId: 'sg-3', type: 'signature', page: 4, x: 0.1, y: 0.7, w: 0.3, h: 0.03, value: null }
    ],
    events: [{ at: '2026-11-09T15:00:00Z', action: 'signed', by: 'Marlow Ashby' }]
  };
}

test('tax form and co-investor', async () => {
  const h = await harness();
  try {
    // A tax form request for an investor on file: the signed Form W-9 came back.
    const t = await invite(h.base, { offering: null, investor: Object.assign({}, ANITA, { existing: { accredited: false, accreditedUntil: '', holds: false } }), invitation: { cents: 0, cls: '', existing: true, taxRequest: true } });
    const taxEnvelope = { id: 'env-t1', kind: 'tax', title: 'Form W-9 - Anita Shah', fileName: 'Form_W-9.pdf', taxForm: { form: 'W-9', revision: 'Rev. March 2024' }, status: 'completed', completedAt: '2026-11-10T11:15:00Z', docId: 'env-t1-orig', workDocId: 'env-t1-work', signedDocId: 'env-t1-signed', sha256Signed: 'f'.repeat(64), signers: [{ id: 'sg-1', role: 'investor', investorId: ANITA.id, name: 'Anita Shah', email: ANITA.email, status: 'signed', signedAt: '2026-11-10T11:15:00Z' }], fields: [] };
    const tax = finished({ request: null, investor: Object.assign({}, finished().investor, { taxForm: 'W-9', taxCert: { form: 'W-9', revision: 'Rev. March 2024', envelopeId: 'env-t1', at: '2026-11-10T11:15:00Z', signed: true, signedBy: 'Anita Shah', backupWithholding: false } }), taxEnvelope, files: { 'env-t1-signed': pdf('W9 SIGNED').toString('base64') } });
    const ct = await complete(h.base, t.token, tax);
    assert.equal(ct.status, 200, ct.text);
    const mt = (await outbox(h.base)).filter((x) => x.kind === 'confirmation');
    assert.deepEqual(mt.map((x) => [x.to, x.subject]), [[ANITA.email, 'Harbor Ridge Capital: we received your Form W-9']]);

    // A co-investor's signature: confirmed to the co-investor's address, never the account investor's.
    const co = await invite(h.base, { investor: { id: 'HRC-0107', contact: 'Rowan Ashby', title: 'Marlow and Rowan Ashby JTWROS', email: 'rowan@coinvestor.example', type: 'joint' }, offering: null, invitation: { cents: 0, existing: true, coSign: true, envelopeId: 'env-a7' }, esign: { template: agreement('waiting'), pdf: pdf('WORK COPY').toString('base64') } });
    const cc = await complete(h.base, co.token, { investor: { id: 'HRC-0107' }, request: null, envelope: agreement('signed'), files: { 'env-a7-work': pdf('WORK COPY SIGNED BY BOTH').toString('base64') }, docs: [], audit: [], notifications: [] });
    assert.equal(cc.status, 200, cc.text);
    const box = await outbox(h.base);
    const mc = box.filter((x) => x.kind === 'confirmation' && x.subject.includes('signature'));
    assert.deepEqual(mc.map((x) => [x.to, x.subject]), [['rowan@coinvestor.example', 'Harbor Ridge Capital: we received your signature for Marlow and Rowan Ashby JTWROS']]);
    assert.ok(!box.some((x) => x.to === 'marlow@investor.example'), 'nothing to the account investor');
    assert.ok(!webLinks(mc[0].text).length, 'a co-investor with no portal sign-in gets no portal button');
    // A co-investor who did not sign gets no confirmation: nothing was received.
    const co2 = await invite(h.base, { investor: { id: 'HRC-0107', contact: 'Rowan Ashby', title: 'Marlow and Rowan Ashby JTWROS', email: 'rowan@coinvestor.example', type: 'joint' }, offering: null, invitation: { cents: 0, existing: true, coSign: true, envelopeId: 'env-a7' }, esign: { template: agreement('waiting'), pdf: pdf('WORK COPY').toString('base64') } });
    assert.equal((await complete(h.base, co2.token, { investor: { id: 'HRC-0107' }, request: null, envelope: agreement('waiting'), files: {}, docs: [], audit: [], notifications: [] })).status, 200);
    assert.equal((await outbox(h.base)).filter((x) => x.kind === 'confirmation' && x.subject.includes('signature')).length, 1);
  } finally {
    await h.close();
  }
});

test('nothing sensitive', async () => {
  const h = await harness();
  try {
    const r = await invite(h.base);
    assert.equal((await complete(h.base, r.token, finished())).status, 200);
    const [m] = (await outbox(h.base)).filter((x) => x.kind === 'confirmation');
    assert.ok(m, 'the confirmation');
    for (const s of SECRETS) assert.ok(!m.text.includes(s) && !m.html.includes(s) && !m.subject.includes(s), `the confirmation holds no ${s}`);
    // The account number's last four (7890) appear in no date, phone or colour of this firm, so they may be looked for.
    assert.ok(!m.text.includes('7890') && !m.html.includes('7890'), 'nor the account number’s last four');
    assert.ok(!/\b\d{3}-\d{2}-\d{4}\b|\d{8,}/.test(`${m.text}\n${m.html}`), 'no taxpayer-number shape and no long number');
    const entry = (await log(h.base)).find((e) => e.kind === 'confirmation');
    for (const s of SECRETS) assert.ok(!entry.text.includes(s), `the log holds no ${s}`);
  } finally {
    await h.close();
  }
});

/** An SMTP stand-in that refuses the addresses it is given (550) and accepts everything else. */
async function refusingSmtp(refuse) {
  const rcpt = [];
  const accepted = [];
  const sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    let buf = '';
    let inData = false;
    let to = [];
    const w = (s) => sock.write(`${s}\r\n`);
    w('220 stand-in ready');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            accepted.push(to);
            to = [];
            w('250 Ok queued');
          }
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') w('250 stand-in');
        else if (cmd === 'RCPT') {
          const a = (/<([^>]*)>/.exec(line) || [])[1] || '';
          rcpt.push(a);
          if (refuse.includes(a)) w('550 5.1.1 Recipient refused');
          else {
            to.push(a);
            w('250 Ok');
          }
        } else if (cmd === 'DATA') {
          inData = true;
          w('354 End data with <CR><LF>.<CR><LF>');
        } else if (cmd === 'QUIT') {
          w('221 Bye');
          sock.end();
        } else w('250 Ok');
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    port: server.address().port,
    rcpt,
    accepted,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    }
  };
}

test('failure does not fail', async () => {
  const relay = await refusingSmtp([ANITA.email]);
  const h = await harness({ smtp: relay });
  try {
    // The relay refuses the investor's address (the sponsor sent the link by hand): the completion still answers 200, the
    // sponsor's notification goes, and the confirmation is logged failed.
    const f = await invite(h.base, { investor: Object.assign({}, ANITA, { id: 'HRC-0003' }), sendEmail: false });
    const cf = await complete(h.base, f.token, finished({ investor: Object.assign({}, finished().investor, { id: 'HRC-0003' }), request: Object.assign({}, finished().request, { investorId: 'HRC-0003' }) }));
    assert.equal(cf.status, 200, cf.text);
    assert.deepEqual(cf.body, { ok: true });
    const row = (await j(h.base, 'GET', `/v1/invitations/${f.id}`)).body;
    assert.equal(row.status, 'completed');
    const failed = (await log(h.base)).filter((e) => e.kind === 'confirmation' && e.investorId === 'HRC-0003');
    assert.deepEqual(failed.map((e) => e.status), ['failed'], 'logged failed');
    assert.ok(relay.rcpt.includes(ANITA.email), 'it was tried');
    assert.ok(relay.accepted.some((to) => to.includes('ops@harborridge.example')), 'the sponsor’s notification went');
    assert.ok(!JSON.stringify(h.store.list('maillog')).includes(ANITA.email), 'the address is not kept in the clear');

    // A suppressed address (it bounced for good before): not mailed, logged suppressed.
    const s = await invite(h.base, { investor: Object.assign({}, ANITA, { id: 'HRC-0004', email: 'gone@investor.example' }), sendEmail: false });
    h.store.put('mailsuppress', { id: emailHash('gone@investor.example'), reason: 'bounced', at: new Date(T0 - DAY).toISOString() });
    const cs = await complete(h.base, s.token, finished({ investor: Object.assign({}, finished().investor, { id: 'HRC-0004', email: 'gone@investor.example' }), request: Object.assign({}, finished().request, { investorId: 'HRC-0004' }) }));
    assert.equal(cs.status, 200, cs.text);
    assert.ok(!relay.rcpt.includes('gone@investor.example'), 'never tried');
    assert.deepEqual((await log(h.base)).filter((e) => e.kind === 'confirmation' && e.investorId === 'HRC-0004').map((e) => e.status), ['suppressed']);
  } finally {
    await h.close();
    await relay.close();
  }
});
