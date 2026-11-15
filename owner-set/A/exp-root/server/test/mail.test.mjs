// Email: message format (headers, encoded-words, multipart, quoted-printable, dot-stuffing), the SMTP
// client against a fake server (plain relay, AUTH PLAIN and LOGIN, STARTTLS, implicit TLS, refusals,
// timeouts), the outbox, and the firm-branded templates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, dotStuff, encodeWords, headerLine, formatAddress, quotedPrintable, smtpSend, createMailer, invitationMessage, resendMessage, notificationMessage, validAddress } from '../lib/mail.mjs';
import { openStore } from '../lib/store.mjs';
import { openVault } from '../lib/vault.mjs';
import { fakeSmtp, selfSignedCert, decodeQP, parts } from './smtp-fake.mjs';

const FIRM = { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456' }, disclaimer: 'This message is not an offer to sell securities.' };
const INVESTOR = { id: 'HRC-0007', contact: 'Ann Lee', title: 'Ann Lee', type: 'individual', email: 'ann@investor.example' };
const OFFERING = { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', currency: 'USD' };
const decodeWord = (w) => Buffer.from(/^=\?UTF-8\?B\?(.*)\?=$/.exec(w)[1], 'base64').toString('utf8');
const sample = (over = {}) => buildMessage(Object.assign({ from: { name: FIRM.name, address: 'notices@harborridge.example' }, to: { name: 'Ann Lee', address: 'ann@investor.example' }, replyTo: FIRM.supportEmail, subject: 'Your onboarding', text: 'Hello Ann', html: '<p>Hello Ann</p>', date: new Date('2026-11-10T12:00:00Z') }, over));
const header = (raw, name) => (new RegExp(`^${name}: (.*(?:\\r\\n[ \\t].*)*)`, 'mi').exec(raw.split('\r\n\r\n')[0]) || [])[1];

test('encoded-words: non-ASCII headers become UTF-8 words of at most 75 characters that decode back', () => {
  const s = 'Zoë Ångström: votre intégration chez Société Générale d’Investissement — 2026 ✓';
  const words = encodeWords(s);
  assert.ok(words.length > 1);
  for (const w of words) assert.ok(w.length <= 75, w);
  assert.equal(words.map(decodeWord).join(''), s);
  const line = headerLine('Subject', s);
  assert.ok(line.startsWith('Subject: =?UTF-8?B?'));
  assert.ok(line.split('\r\n').slice(1).every((l) => l.startsWith(' ')), 'continuation lines are folded with a space');
  assert.equal(headerLine('Subject', 'Plain subject'), 'Subject: Plain subject');
  // Long ASCII subjects fold at spaces.
  const long = headerLine('Subject', 'word '.repeat(40).trim());
  assert.ok(long.split('\r\n').every((l) => l.length <= 78));
});

test('header injection: line breaks in names and subjects never start a new header', () => {
  const raw = sample({ subject: 'Hi\r\nBcc: evil@attacker.example', from: { name: 'Harbor\r\nBcc: evil@attacker.example', address: 'notices@harborridge.example' } });
  const head = raw.split('\r\n\r\n')[0];
  assert.ok(!/^Bcc:/im.test(head));
  assert.equal(formatAddress('Say "hi" \\ there', 'a@b.example'), '"Say \\"hi\\" \\\\ there" <a@b.example>');
  assert.ok(formatAddress('Zoë Capital', 'a@b.example').startsWith('=?UTF-8?B?'));
  assert.equal(validAddress('ann@investor.example'), true);
  for (const bad of ['ann@investor', 'ann investor@x.example', 'a@b.example\r\nRCPT TO:<x@y.example>', '<a@b.example>', 'ünï@b.example']) assert.equal(validAddress(bad), false, bad);
});

test('message format: Date, From (the firm), To, Reply-To, Subject, Message-ID, MIME-Version, multipart/alternative', () => {
  const raw = sample();
  assert.equal(header(raw, 'Date'), 'Tue, 10 Nov 2026 12:00:00 +0000');
  assert.equal(header(raw, 'From'), '"Harbor Ridge Capital" <notices@harborridge.example>');
  assert.equal(header(raw, 'To'), '"Ann Lee" <ann@investor.example>');
  assert.equal(header(raw, 'Reply-To'), '<ir@harborridge.example>');
  assert.match(header(raw, 'Message-ID'), /^<[0-9a-f]{32}@harborridge\.example>$/);
  assert.equal(header(raw, 'MIME-Version'), '1.0');
  const ct = header(raw, 'Content-Type');
  assert.match(ct, /^multipart\/alternative; boundary="(=_[0-9a-f]{24})"$/);
  const b = /boundary="([^"]+)"/.exec(ct)[1];
  assert.equal(raw.split(`--${b}\r\n`).length - 1, 2, 'two parts');
  assert.ok(raw.includes(`--${b}--`));
  const p = parts(raw);
  assert.equal(p.text, 'Hello Ann');
  assert.equal(p.html, '<p>Hello Ann</p>');
  assert.ok(raw.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(raw), 'every line ends in CRLF');
});

test('quoted-printable keeps UTF-8 and every line at most 76 characters', () => {
  const text = `Commitment: €250,000 — naïve café ${'x'.repeat(200)}\nTrailing space \n= sign and tab\t`;
  const qp = quotedPrintable(text);
  for (const l of qp.split('\r\n')) assert.ok(l.length <= 76, l);
  assert.equal(decodeQP(qp), text.replace(/\n/g, '\r\n'));
  assert.ok(qp.includes('space=20'), 'a space before a line end is encoded');
  const raw = sample({ text, html: `<p>${'é'.repeat(300)}</p>` });
  for (const l of raw.split('\r\n')) assert.ok(l.length <= 998);
  assert.equal(parts(raw).html, `<p>${'é'.repeat(300)}</p>`);
});

test('an inline logo turns the message into multipart/related with a Content-ID image', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const raw = sample({ inline: [{ cid: 'logo@firm', contentType: 'image/png', data: png }, { cid: 'x', contentType: 'image/svg+xml', data: Buffer.from('<svg/>') }] });
  assert.match(header(raw, 'Content-Type'), /^multipart\/related; boundary=/);
  assert.ok(raw.includes('Content-Type: multipart/alternative; boundary='));
  assert.ok(raw.includes('Content-ID: <logo@firm>'));
  assert.ok(raw.includes(png.toString('base64')));
  assert.ok(!raw.includes('image/svg+xml'), 'only raster images are inlined');
});

test('dot-stuffing: lines that start with a dot are doubled and line ends become CRLF', () => {
  assert.equal(dotStuff('.hidden\nmid.dle\r\n..two\n.'), '..hidden\r\nmid.dle\r\n...two\r\n..\r\n');
  assert.equal(dotStuff('a'), 'a\r\n');
});

test('SMTP over a plain local relay (SMTP_ALLOW_PLAIN): AUTH PLAIN, MAIL, RCPT, DATA, QUIT, with dot-stuffing on the wire', async () => {
  const srv = await fakeSmtp({ user: 'relay-user', pass: 'relay-pass-123' });
  try {
    const data = sample({ text: '.starts with a dot\n..two dots\nend' });
    const r = await smtpSend({ host: '127.0.0.1', port: srv.port, user: 'relay-user', pass: 'relay-pass-123', allowPlain: true, name: 'harborridge.example' }, { from: 'notices@harborridge.example', to: ['ann@investor.example'], data });
    assert.match(r.response, /^250/);
    assert.equal(srv.messages.length, 1);
    const m = srv.messages[0];
    assert.equal(m.from, 'notices@harborridge.example');
    assert.deepEqual(m.to, ['ann@investor.example']);
    assert.equal(m.mech, 'PLAIN');
    assert.equal(m.data, data, 'the server receives the exact message after un-stuffing');
    assert.ok(m.wire.includes('\r\n..starts with a dot\r\n'), 'a leading dot is doubled on the wire');
    const cmds = srv.sessions[0].map((x) => x.line.split(' ')[0]);
    assert.deepEqual(cmds, ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);
    assert.equal(srv.sessions[0][0].line, 'EHLO harborridge.example');
  } finally {
    await srv.close();
  }
});

test('SMTP AUTH LOGIN when the server offers only LOGIN', async () => {
  const srv = await fakeSmtp({ user: 'u@x.example', pass: 'pässwörd', mechs: ['LOGIN'] });
  try {
    await smtpSend({ host: '127.0.0.1', port: srv.port, user: 'u@x.example', pass: 'pässwörd', allowPlain: true }, { from: 'a@x.example', to: ['b@y.example'], data: sample() });
    assert.equal(srv.messages[0].mech, 'LOGIN');
    assert.equal(srv.messages[0].authUser, 'u@x.example');
  } finally {
    await srv.close();
  }
});

test('STARTTLS: the client upgrades before AUTH, checks the certificate, and says EHLO again', async () => {
  const pki = selfSignedCert();
  const srv = await fakeSmtp({ tls: pki, starttls: true, user: 'smtp-user', pass: 'smtp-pass-123' });
  try {
    await smtpSend({ host: '127.0.0.1', port: srv.port, user: 'smtp-user', pass: 'smtp-pass-123', tls: { ca: pki.cert } }, { from: 'a@x.example', to: ['b@y.example'], data: sample() });
    const m = srv.messages[0];
    assert.equal(m.secure, true);
    const all = srv.sessions.flat();
    assert.deepEqual(all.map((x) => `${x.line.split(' ')[0]}:${x.secure}`), ['EHLO:false', 'STARTTLS:false', 'EHLO:true', 'AUTH:true', 'MAIL:true', 'RCPT:true', 'DATA:true', 'QUIT:true']);
    // Without trusting the certificate the client refuses and sends nothing.
    await assert.rejects(smtpSend({ host: '127.0.0.1', port: srv.port, user: 'smtp-user', pass: 'smtp-pass-123' }, { from: 'a@x.example', to: ['b@y.example'], data: sample() }), /mail server/);
    assert.equal(srv.messages.length, 1);
    assert.ok(!srv.sessions.flat().some((x) => !x.secure && x.line.startsWith('AUTH')), 'credentials never sent before TLS');
  } finally {
    await srv.close();
  }
});

test('implicit TLS (port 465 style)', async () => {
  const pki = selfSignedCert();
  const srv = await fakeSmtp({ tls: pki, implicit: true, user: 'smtp-user', pass: 'smtp-pass-123' });
  try {
    await smtpSend({ host: '127.0.0.1', port: srv.port, secure: true, user: 'smtp-user', pass: 'smtp-pass-123', tls: { ca: pki.cert } }, { from: 'a@x.example', to: ['b@y.example'], data: sample() });
    assert.equal(srv.messages[0].secure, true);
    assert.equal(srv.sessions[0][0].line.split(' ')[0], 'EHLO');
  } finally {
    await srv.close();
  }
});

test('refusals: no STARTTLS without SMTP_ALLOW_PLAIN, bad credentials (password never echoed), and a silent server times out', async () => {
  const srv = await fakeSmtp({ user: 'smtp-user', pass: 'right-pass' });
  try {
    await assert.rejects(smtpSend({ host: '127.0.0.1', port: srv.port, user: 'smtp-user', pass: 'right-pass' }, { from: 'a@x.example', to: ['b@y.example'], data: sample() }), /does not offer STARTTLS/);
    assert.ok(!srv.sessions.flat().some((x) => x.line.startsWith('AUTH')), 'no credentials over a plain connection');
    const err = await smtpSend({ host: '127.0.0.1', port: srv.port, user: 'smtp-user', pass: 'wrong-pass-secret', allowPlain: true }, { from: 'a@x.example', to: ['b@y.example'], data: sample() }).catch((e) => e);
    assert.match(err.message, /did not accept SMTP_USER and SMTP_PASS \(535\)/);
    assert.ok(!err.message.includes('wrong-pass-secret'));
    assert.equal(srv.messages.length, 0);
  } finally {
    await srv.close();
  }
  const silent = await fakeSmtp({ silent: true });
  try {
    await assert.rejects(smtpSend({ host: '127.0.0.1', port: silent.port, allowPlain: true, timeoutMs: 150 }, { from: 'a@x.example', to: ['b@y.example'], data: sample() }), /did not answer in time/);
  } finally {
    await silent.close();
  }
  await assert.rejects(smtpSend({ host: '127.0.0.1', port: 1, allowPlain: true, timeoutMs: 1000 }, { from: 'a@x.example', to: ['b@y.example'], data: sample() }), /could not be reached/);
});

test('mailer with SMTP settings: From is the firm’s name at MAIL_FROM, Reply-To the firm’s support address', async () => {
  const srv = await fakeSmtp({});
  try {
    const store = openStore(null);
    const mailer = createMailer({ env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(srv.port), SMTP_ALLOW_PLAIN: '1', MAIL_FROM: 'notices@portal-mail.example' }, store, vault: openVault({ NODE_ENV: 'test' }) });
    const msg = invitationMessage({ firm: FIRM, investor: INVESTOR, offering: OFFERING, invitation: { cents: 25000000, note: 'Looking forward to it.' }, link: 'https://portal.example/?server=x#invite-abc', expiresAt: '2026-12-10T12:00:00Z' });
    const r = await mailer.send(Object.assign({ fromName: FIRM.name, replyTo: FIRM.supportEmail, to: INVESTOR.email, toName: INVESTOR.contact }, msg));
    assert.deepEqual(r, { emailStatus: 'sent' });
    const raw = srv.messages[0].data;
    assert.equal(header(raw, 'From'), '"Harbor Ridge Capital" <notices@portal-mail.example>');
    assert.equal(header(raw, 'Reply-To'), '<ir@harborridge.example>');
    assert.equal(srv.messages[0].from, 'notices@portal-mail.example');
    const bad = await mailer.send(Object.assign({ fromName: FIRM.name, to: 'not an address' }, msg));
    assert.equal(bad.emailStatus, 'failed');
    const noFrom = createMailer({ env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(srv.port) }, store, vault: openVault({ NODE_ENV: 'test' }) });
    assert.match((await noFrom.send(Object.assign({ fromName: FIRM.name, to: INVESTOR.email }, msg))).error, /Set MAIL_FROM/);
    const fallback = createMailer({ env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(srv.port), SMTP_ALLOW_PLAIN: '1', MAIL_FROM: 'notices@portal-mail.example', MAIL_REPLY_TO: 'help@portal-mail.example' }, store, vault: openVault({ NODE_ENV: 'test' }) });
    await fallback.send(Object.assign({ fromName: FIRM.name, to: INVESTOR.email }, msg));
    assert.equal(header(srv.messages[1].data, 'Reply-To'), '<help@portal-mail.example>');
  } finally {
    await srv.close();
  }
});

test('outbox: without SMTP_HOST messages are sealed into the store and listed back', async () => {
  const store = openStore(null);
  const vault = openVault({ DATA_KEY: Buffer.alloc(32, 7).toString('base64') });
  let t = Date.parse('2026-11-10T12:00:00Z');
  const mailer = createMailer({ env: {}, store, vault, now: () => t });
  const msg = invitationMessage({ firm: FIRM, investor: INVESTOR, offering: OFFERING, invitation: { cents: 0 }, link: 'https://portal.example/#invite-tok', expiresAt: '2026-12-10T12:00:00Z' });
  assert.deepEqual(await mailer.send(Object.assign({ kind: 'invitation', invitationId: 'ivt_1', workspace: 'ws1', fromName: FIRM.name, replyTo: FIRM.supportEmail, to: INVESTOR.email, toName: INVESTOR.contact }, msg)), { emailStatus: 'outbox' });
  const [m] = mailer.outbox({ workspace: 'ws1' });
  assert.equal(m.to, INVESTOR.email);
  assert.equal(m.subject, msg.subject);
  assert.equal(m.replyTo, FIRM.supportEmail);
  assert.equal(m.from, 'Harbor Ridge Capital');
  assert.equal(mailer.outbox({ workspace: 'other' }).length, 0);
  const stored = JSON.stringify(store.data());
  for (const s of ['Ann Lee', INVESTOR.email, 'invite-tok', 'Harbor Ridge Fund II']) assert.ok(!stored.includes(s), `${s} is not stored in plain text`);
  t += 31 * 864e5;
  assert.equal(mailer.purge(), 1);
  assert.equal(mailer.outbox().length, 0);
});

test('templates are the firm’s alone: brand, note, link, expiry, support; no product names; HTML escaped', () => {
  const note = 'Great to have you <script>alert(1)</script> & welcome';
  const logo = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')}`;
  const firm = Object.assign({}, FIRM, { logo });
  const inv = invitationMessage({ firm, investor: INVESTOR, offering: OFFERING, invitation: { cents: 25000000, note, senderName: 'Maria Ortiz' }, link: 'https://portal.example/diy.html?server=https%3A%2F%2Fv.example#invite-abc', expiresAt: '2026-12-10T12:00:00Z' });
  assert.equal(inv.subject, 'Harbor Ridge Fund II: complete your investor onboarding');
  for (const s of ['Dear Ann Lee,', 'Harbor Ridge Capital has invited you to invest in Harbor Ridge Fund II', 'Commitment: $250,000', 'A note from Maria Ortiz:', '> Great to have you', 'https://portal.example/diy.html?server=https%3A%2F%2Fv.example#invite-abc', 'December 10, 2026', 'government-issued photo ID', '10 to 15 minutes', 'Investor Relations: ir@harborridge.example, +1 212 555 0100', 'Harbor Ridge Capital Management LLC', 'not an offer to sell']) assert.ok(inv.text.includes(s), s);
  assert.ok(inv.html.includes('&lt;script&gt;') && !inv.html.includes('<script>'));
  assert.ok(inv.html.includes('src="cid:logo@firm"'));
  assert.ok(inv.html.includes('#123456'));
  assert.equal(inv.inline.length, 1);
  const re = resendMessage({ firm: FIRM, investor: INVESTOR, offering: null, invitation: { cents: 0 }, link: 'https://portal.example/#invite-new', expiresAt: '2026-12-10T12:00:00Z', started: true });
  assert.equal(re.subject, 'Reminder: complete your investor onboarding with Harbor Ridge Capital');
  assert.ok(re.text.includes('Any earlier link we sent no longer works.') && re.text.includes('pick up where you left off') && re.text.includes('Continue your onboarding'));
  const no = notificationMessage({ firm: FIRM, investor: INVESTOR, offering: OFFERING, completedAt: '2026-11-12T10:00:00Z', consoleUrl: 'https://portal.example/diy.html#console-investors', summary: { rows: [['Investor', 'Ann Lee'], ['Commitment', '$250,000'], ['Identity', 'Verified']], next: 'Next: countersign the subscription agreement in the console.' } });
  assert.equal(no.subject, 'Ann Lee finished onboarding for Harbor Ridge Fund II');
  for (const s of ['completed every onboarding step on November 12, 2026', 'Commitment: $250,000', 'Identity: Verified', 'Open the console:\nhttps://portal.example/diy.html#console-investors', 'countersign']) assert.ok(no.text.includes(s), s);
  for (const m of [inv, re, no]) for (const banned of [/carrow/i, /vale\b/i, /powered by/i, /DIY Portal/i]) assert.ok(!banned.test(m.text + m.html), `${banned} in ${m.subject}`);
});
