// gate: tests 10
// Plan 13-11 (EM-01, EM-09 to EM-12): every other message in assets/js/emails.js (notices, capital calls, tax notices,
// e-sign notices, the investor confirmation, password reset and team invitation, the staff filing order), the possibly
// commercial footer, and dispatch(), the console's one hand-off to the server. Every number below is one no one is issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const E = () => require('../../assets/js/emails.js');

const buttonsOf = (html) => (html.match(/<a data-button [^>]*>[^<]*<\/a>/g) || []).map((a) => ({ href: (/href="([^"]*)"/.exec(a) || [])[1], label: (/>([^<]*)<\/a>$/.exec(a) || [])[1] }));
/** A stand-in for the console's api(method, path, body): records each call and answers with `answer(body)`. */
function standIn(answer) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push([method, path, JSON.parse(JSON.stringify(body))]);
    return answer(body);
  };
  api.calls = calls;
  return api;
}
const SEVEN = { id: 'HRC-0007', contact: 'Lee, Ann', title: 'Ann Lee', email: 'ann@investor.example', onboarding: { status: 'complete' } };
function workspace() {
  return { tenant: { id: 'ws-harbor', name: 'Harbor Ridge Capital' }, investors: [JSON.parse(JSON.stringify(SEVEN))], mailLog: [] };
}

test('tracer: a quarterly notice in the firm’s layout, handed to a stand-in server by dispatch and logged with its status', async () => {
  const data = E().KINDS.notice.sample('quarterly');
  const m = E().render('notice', data);
  assert.equal(m.kind, 'notice');
  assert.equal(m.variant, 'quarterly');
  assert.equal(m.subject, data.subject);
  for (const p of data.body.split(/\n\s*\n/)) assert.ok(m.text.includes(p), p);
  const buttons = buttonsOf(m.html);
  assert.equal(buttons.length, 1);
  assert.deepEqual(buttons[0], { href: E().esc(data.portalUrl), label: `Sign in to ${data.firm.portalName}` });
  assert.ok(m.text.includes('To stop these notices, open Account in your portal and change your email choices.'));
  assert.equal(m.commercial, false);

  const ws = workspace();
  const inv = ws.investors[0];
  const api = standIn(() => ({ results: [{ investorId: 'HRC-0007', emailStatus: 'sent' }] }));
  const out = await E().dispatch({ ws, kind: 'notice', variant: 'quarterly', items: [{ investorId: inv.id, inv, to: { name: inv.title, email: inv.email }, data }], connected: true, api, firm: data.firm, portalUrl: data.portalUrl });
  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.calls[0], [
    'POST',
    '/v1/messages',
    { workspace: 'ws-harbor', kind: 'notice', variant: 'quarterly', firm: data.firm, portalUrl: data.portalUrl, offeringNews: false, recipients: [{ investorId: 'HRC-0007', name: 'Ann Lee', email: 'ann@investor.example', subject: data.subject, body: data.body, data: JSON.parse(JSON.stringify(data)) }] }
  ]);
  assert.deepEqual(out.results, [{ investorId: 'HRC-0007', status: 'sent', error: '' }]);
  assert.equal(out.counts.sent, 1);
  assert.equal(ws.mailLog.length, 1);
  const [entry] = ws.mailLog;
  assert.equal(entry.status, 'sent');
  assert.equal(entry.kind, 'notice');
  assert.equal(entry.investorId, 'HRC-0007');
  assert.equal(entry.to, 'ann@investor.example');
  assert.equal(entry.subject, m.subject);
  assert.equal(entry.text, E().redactLink(m.text, data.link));
});

/* ---------- Tests 2 to 10 ---------- */
const MANAGED = 'managed, unchanged (C-05)';
/** 13-RESEARCH.md 1.1 (server, S-01..S-13) and 1.2 (console, C-01..C-18), plus the investor confirmation (EM-10). */
const INVENTORY = {
  'S-01': ['invitation', 'new-offering'],
  'S-02': ['invitation', 'subscribe'],
  'S-03': ['invitation', 'access'],
  'S-04': ['invitation', 'taxRequest-w9'],
  'S-05': ['invitation', 'coSign'],
  'S-06': ['invitation_resent', 'new-offering'],
  'S-07': ['invitation_resent', 'subscribe'],
  'S-08': ['invitation_resent', 'access'],
  'S-09': ['invitation_resent', 'taxRequest-w9'],
  'S-10': ['invitation_resent', 'coSign'],
  'S-11': ['sponsor_notification', 'onboarding'],
  'S-12': ['submission_reminder', 'onboarding'],
  'S-13': ['filing_order', 'placed'],
  'C-01': ['invitation', 'new-account'],
  'C-02': ['invitation', 'coSign'],
  'C-03': ['invitation', 'coSign'],
  'C-04': MANAGED,
  'C-05': MANAGED,
  'C-06': ['notice', 'quarterly'],
  'C-07': ['notice', 'documents'],
  'C-08': ['notice', 'custom'],
  'C-09': ['capital_call', 'call'],
  'C-10': ['capital_call_reminder', 'reminder'],
  'C-11': ['esign_request', 'portal'],
  'C-12': ['esign_reminder', 'portal'],
  'C-13': ['esign_voided', 'portal'],
  'C-14': ['esign_declined', 'console'],
  'C-15': ['esign_completed', 'portal'],
  'C-16': ['tax_notice', 'portal'],
  'C-17': ['password_reset', 'investor'],
  'C-18': ['team_invitation', 'team'],
  'EM-10': ['confirmation', 'onboarding']
};
const NEW_KINDS = ['confirmation', 'notice', 'capital_call', 'capital_call_reminder', 'tax_notice', 'tax_consent', 'esign_request', 'esign_reminder', 'esign_voided', 'esign_completed', 'esign_declined', 'password_reset', 'team_invitation', 'filing_order'];
const R = (kind, variant, over) => E().render(kind, Object.assign(E().KINDS[kind].sample(variant), over || {}));
/** Every sample of every kind, rendered. */
function everyRender() {
  const out = [];
  for (const [kind, k] of Object.entries(E().KINDS)) for (const variant of k.variants) out.push({ kind, variant, data: k.sample(variant), m: E().render(kind, k.sample(variant)) });
  return out;
}

test('inventory: each of the 31 messages and the confirmation has its kind and variant, which render; only C-04 and C-05 stay as they are', () => {
  const ids = Object.keys(INVENTORY);
  const want = [];
  for (let i = 1; i <= 13; i++) want.push(`S-${String(i).padStart(2, '0')}`);
  for (let i = 1; i <= 18; i++) want.push(`C-${String(i).padStart(2, '0')}`);
  assert.deepEqual(ids, want.concat(['EM-10']));
  assert.deepEqual(ids.filter((id) => INVENTORY[id] === MANAGED), ['C-04', 'C-05']);
  for (const [id, entry] of Object.entries(INVENTORY)) {
    if (entry === MANAGED) continue;
    const [kind, variant] = entry;
    assert.ok(E().KINDS[kind], `${id}: no kind ${kind}`);
    assert.ok(E().KINDS[kind].variants.includes(variant), `${id}: ${kind} has no variant ${variant}`);
    const m = E().render(kind, E().KINDS[kind].sample(variant));
    assert.ok(m.subject && m.text && m.html, `${id}: ${kind} ${variant} renders`);
  }
  for (const kind of NEW_KINDS) assert.ok(E().KINDS[kind] && E().KINDS[kind].variants.length > 0, kind);
  assert.equal(E().KINDS.esign_declined.audience, 'sponsor');
  assert.equal(E().KINDS.team_invitation.audience, 'team');
  assert.equal(E().KINDS.filing_order.audience, 'staff');
  for (const kind of ['confirmation', 'notice', 'capital_call', 'capital_call_reminder', 'tax_notice', 'tax_consent', 'esign_request', 'esign_reminder', 'esign_voided', 'esign_completed', 'password_reset']) assert.equal(E().KINDS[kind].audience, 'investor', kind);
});

test('tax notice: the required words are the subject of both variants, the Questions line never leaves an empty slot, the consent request is not the notice', () => {
  const WORDS = 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE';
  for (const variant of ['portal', 'link']) {
    const data = E().KINDS.tax_notice.sample(variant);
    const m = E().render('tax_notice', data);
    assert.equal(m.subject, WORDS, variant);
    assert.equal(m.variant, variant);
    assert.ok(m.text.includes(`Questions: ${data.contact.name}, ${data.contact.address}, telephone ${data.contact.phone}, email ${data.contact.email}.`), `${variant}: the full Questions line`);
    for (const contact of [Object.assign({}, data.contact, { phone: '', email: '' }), { name: '', address: '', phone: '', email: '' }, { name: 'Investor Relations', address: '', phone: '+1 212 555 0100', email: '' }]) {
      const t = E().render('tax_notice', Object.assign({}, data, { contact })).text;
      const line = t.split('\n').filter((l) => /^Questions/.test(l))[0] || '';
      assert.ok(line, `${variant}: a Questions line`);
      assert.ok(!/telephone ,|telephone \.|email \.|email ,|, ,|: ,|  |,\./.test(line), `${variant}: ${line}`);
    }
    const bare = E().render('tax_notice', Object.assign({}, data, { contact: { name: 'Investor Relations', address: '', phone: '', email: '' } })).text;
    assert.ok(bare.includes('Questions: Investor Relations.'), bare);
  }
  assert.ok(R('tax_notice', 'portal').text.includes('To open it, sign in, go to Documents and tap it. Use Download to save or print it.'));
  const link = E().KINDS.tax_notice.sample('link');
  assert.ok(R('tax_notice', 'link').text.includes(`You will be asked for the last four digits of the tax number you gave ${link.firm.name}.`));
  assert.ok(R('tax_notice', 'portal', { doc: Object.assign({}, E().KINDS.tax_notice.sample('portal').doc, { replaces: true }) }).text.includes(', which replaces the one posted earlier.'));
  for (const variant of E().KINDS.tax_consent.variants) {
    const m = R('tax_consent', variant);
    assert.ok(!m.subject.includes(WORDS) && !m.text.includes(WORDS) && !m.html.includes(WORDS), `consent ${variant}`);
    assert.ok(m.text.includes('If you do not consent, the document will be sent to you on paper.'));
  }
});

test('commercial: offering invitations without a commitment and offering news carry the postal address and a way to stop them; nothing else does', () => {
  const COMMERCIAL = [
    ['invitation', 'subscribe'],
    ['invitation', 'subscribe-tax'],
    ['invitation_resent', 'subscribe'],
    ['invitation_resent', 'subscribe-tax'],
    ['notice', 'offeringNews']
  ];
  const key = (k, v) => `${k} ${v}`;
  const commercial = new Set(COMMERCIAL.map(([k, v]) => key(k, v)));
  for (const { kind, variant, m } of everyRender()) assert.equal(m.commercial, commercial.has(key(kind, variant)), key(kind, variant));
  // A new investor invited to an offering with no commitment, and its new link, are possibly commercial too.
  for (const kind of ['invitation', 'invitation_resent']) {
    const data = E().KINDS[kind].sample('new-offering');
    assert.equal(E().render(kind, data).commercial, false, `${kind} with a commitment`);
    data.invitation.cents = 0;
    assert.equal(E().render(kind, data).commercial, true, `${kind} with no commitment`);
    assert.equal(E().render(kind, Object.assign(data, { offering: null })).commercial, false, `${kind} with no offering`);
  }
  const firm = 'Harbor Ridge Capital';
  const URL1 = 'https://api.example/v1/messages/unsubscribe?t=sample';
  const address = '1 Harbor Way, Boston, MA 02110';
  for (const [kind, variant] of COMMERCIAL) {
    const data = E().KINDS[kind].sample(variant);
    data.firm.postalAddress = address;
    const withLink = E().render(kind, Object.assign({}, data, { unsubscribeUrl: URL1 }));
    assert.ok(withLink.text.includes(`To stop invitations to new offerings from ${firm}, use this link: ${URL1}`), key(kind, variant));
    assert.ok(withLink.text.includes(address) && withLink.html.includes(E().esc(address)), `${key(kind, variant)}: the address`);
    assert.deepEqual(withLink.headers, { 'List-Unsubscribe': `<${URL1}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    assert.deepEqual(withLink.needs, []);
    assert.ok(withLink.html.includes(`href="${E().esc(URL1)}"`), `${key(kind, variant)}: the stop link is a link`);
    const reply = E().render(kind, Object.assign({}, data, { unsubscribeUrl: '' }));
    assert.ok(reply.text.includes(`To stop invitations to new offerings from ${firm}, reply to this email.`), key(kind, variant));
    assert.deepEqual(reply.headers, {});
    data.firm.postalAddress = '';
    assert.deepEqual(E().render(kind, data).needs, ['postalAddress'], `${key(kind, variant)} without an address`);
  }
  for (const { kind, variant, m } of everyRender()) {
    if (commercial.has(key(kind, variant))) continue;
    assert.ok(!/To stop invitations to new offerings/.test(m.text), key(kind, variant));
    assert.deepEqual(m.headers, {}, key(kind, variant));
    assert.deepEqual(m.needs, [], key(kind, variant));
  }
});

test('e-sign and confirmation: no attachment, no signing token, no link but the portal, the console or the support address', () => {
  const TOKEN = /[A-Za-z0-9_-]{43}/;
  const kinds = ['esign_request', 'esign_reminder', 'esign_voided', 'esign_completed', 'esign_declined', 'confirmation'];
  const SUBJECTS = {
    esign_request: 'Harbor Ridge Capital: please sign Fund II side letter',
    esign_reminder: 'Harbor Ridge Capital: reminder to sign Fund II side letter',
    esign_voided: 'Harbor Ridge Capital: Fund II side letter was withdrawn',
    esign_completed: 'Harbor Ridge Capital: Fund II side letter is signed by everyone',
    esign_declined: 'Anita Shah declined to sign Fund II side letter'
  };
  for (const kind of kinds) {
    for (const variant of E().KINDS[kind].variants) {
      const data = E().KINDS[kind].sample(variant);
      const m = E().render(kind, data);
      const tag = `${kind} ${variant}`;
      assert.ok(!('attachments' in m) && !('attachment' in m), tag);
      assert.ok(m.inline.every((x) => x.cid === 'logo@firm'), tag);
      assert.ok(!TOKEN.test(m.text) && !TOKEN.test(m.html.replace(/<head>[\s\S]*?<\/head>/, '')), `${tag}: a token-shaped string`);
      const allowed = [data.portalUrl, data.consoleUrl].filter(Boolean).map((u) => E().esc(u)).concat(data.firm.supportEmail ? [`mailto:${data.firm.supportEmail}`] : []);
      const hrefs = (m.html.match(/\bhref="[^"]*"/g) || []).map((h) => h.slice(6, -1));
      assert.ok(hrefs.length >= 1, tag);
      for (const h of hrefs) assert.ok(allowed.includes(h), `${tag}: href ${h}`);
      assert.ok(!('link' in data), `${tag}: no personal link in the data`);
      if (SUBJECTS[kind]) assert.equal(m.subject, SUBJECTS[kind], tag);
    }
  }
  assert.equal(E().KINDS.esign_declined.audience, 'sponsor');
  assert.equal(buttonsOf(R('esign_declined', 'console').html)[0].label, 'Open the console');
  for (const kind of ['esign_request', 'esign_reminder', 'esign_voided', 'esign_completed']) assert.equal(buttonsOf(R(kind, 'portal').html)[0].label, 'Open your portal', kind);
  const CONF = {
    onboarding: 'Harbor Ridge Capital: we received your onboarding',
    subscription: 'Harbor Ridge Capital: we received your subscription to Harbor Ridge Fund II',
    taxForm: 'Harbor Ridge Capital: we received your Form W-9',
    coSign: 'Harbor Ridge Capital: we received your signature for Anita Shah',
    reverify: 'Harbor Ridge Capital: we received your verification'
  };
  assert.deepEqual(E().KINDS.confirmation.variants, Object.keys(CONF));
  for (const [variant, subject] of Object.entries(CONF)) {
    const m = R('confirmation', variant);
    assert.equal(m.subject, subject, variant);
    assert.equal(m.variant, variant);
    assert.ok(m.text.includes('Nothing is due from you now.'), `${variant}: what happens next`);
    assert.deepEqual(buttonsOf(m.html).map((b) => b.label), ['Open your portal'], variant);
  }
});

test('staff email: the filing order email is the base tree’s, byte for byte, and a placed order puts it in the outbox', async () => {
  const base = JSON.parse(readFileSync(new URL('./fixtures/emails/base-filing.json', import.meta.url), 'utf8'));
  assert.match(base.base, /^[0-9a-f]{40}$/);
  assert.deepEqual(E().KINDS.filing_order.variants, ['placed', 'changed']);
  for (const variant of ['placed', 'changed']) {
    const b = base[variant];
    const m = E().render('filing_order', Object.assign({ variant }, b.input));
    assert.equal(m.subject, b.subject, `${variant}: subject`);
    assert.equal(m.text, b.text, `${variant}: text`);
    assert.equal(m.html, b.html, `${variant}: html`);
    assert.deepEqual(E().KINDS.filing_order.sample(variant), Object.assign({ variant }, b.input), `${variant}: the sample is the base input`);
  }
  const kit = await import('./filings-kit.mjs');
  await kit.start({}, async (url, server) => {
    const placed = await kit.call(url, 'POST', '/v1/filings/orders', { token: kit.API, body: kit.orderBody({ key: kit.newKey() }) });
    assert.equal(placed.status, 201, JSON.stringify(placed.json));
    const mail = server.invitations.mailer.outbox({}).filter((x) => x.kind === 'filing_order');
    assert.equal(mail.length, 1);
    const want = E().render('filing_order', { variant: 'placed', id: placed.json.id, kind: 'formd', firm: { name: 'Harbor Ridge Partners' }, offering: { name: 'Harbor Ridge Fund I' }, dueCents: placed.json.dueCents, openFees: placed.json.openFees });
    assert.equal(mail[0].subject, want.subject);
    assert.equal(mail[0].text, want.text);
    assert.equal(mail[0].html, want.html);
  });
});

test('prefsAllow, applyPrefs and firmFromTenant: each switch turns off only its own messages; required ones always go', () => {
  const inv = (prefs) => ({ id: 'HRC-0007', emailPrefs: prefs });
  const OPTIONAL = { documents: [['notice', 'documents']], quarterly: [['notice', 'quarterly']], offering: [['notice', 'offeringNews'], ['invitation', 'subscribe'], ['invitation_resent', 'subscribe']] };
  for (const [sw, off] of Object.entries(OPTIONAL)) {
    const i = inv({ [sw]: false });
    for (const [kind, variant] of off) assert.equal(E().prefsAllow(i, kind, variant), false, `${sw}: ${kind} ${variant}`);
    for (const [other, list] of Object.entries(OPTIONAL)) if (other !== sw) for (const [kind, variant] of list) assert.equal(E().prefsAllow(i, kind, variant), true, `${sw} off leaves ${kind} ${variant}`);
  }
  assert.equal(E().prefsAllow(inv({ offering: false }), 'invitation', 'new', true), false, 'a commercial new-offering invitation');
  assert.equal(E().prefsAllow(inv({ offering: false }), 'invitation', 'new', false), true, 'an invitation with a commitment');
  const allOff = inv({ documents: false, quarterly: false, offering: false });
  const REQUIRED = [['notice', 'custom'], ['capital_call', 'call'], ['capital_call_reminder', 'reminder'], ['tax_notice', 'portal'], ['tax_notice', 'link'], ['tax_consent', 'link'], ['esign_request', 'portal'], ['esign_reminder', 'portal'], ['esign_voided', 'portal'], ['esign_completed', 'portal'], ['confirmation', 'onboarding'], ['invitation', 'new'], ['invitation', 'taxRequest'], ['password_reset', 'investor']];
  for (const [kind, variant] of REQUIRED) assert.equal(E().prefsAllow(allOff, kind, variant), true, `${kind} ${variant} with every switch off`);
  for (const [kind, variant] of REQUIRED.concat(OPTIONAL.documents, OPTIONAL.quarterly, OPTIONAL.offering)) assert.equal(E().prefsAllow({ id: 'x' }, kind, variant), true, `${kind} ${variant} with no choices`);
  assert.ok(!/\?\./.test(E().prefsAllow.toString()), 'no optional chaining');

  const ws = workspace();
  ws.investors.push({ id: 'HRC-0008', contact: 'Ortiz, Maria', email: 'maria@investor.example' });
  assert.equal(E().applyPrefs(ws, [{ investorId: 'HRC-0007', offering: false }, { investorId: 'HRC-9999', offering: false }]), 1);
  assert.deepEqual(ws.investors[0].emailPrefs, { offering: false });
  assert.ok(!('emailPrefs' in ws.investors[1]));
  assert.equal(E().applyPrefs(ws, [{ investorId: 'HRC-0007', offering: false }]), 0, 'nothing changes the second time');
  assert.equal(E().applyPrefs(ws, [{ investorId: 'HRC-0007', offering: true }]), 1);
  assert.deepEqual(ws.investors[0].emailPrefs, { offering: true });

  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  const tenant = { id: 'ws-harbor', name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', domain: 'harborridge.example', support: { team: 'Investor Relations', email: 'ir@harborridge.example', phone: '+1 212 555 0100' }, colors: { primary: '#123456', accent: '#1F7A8C', ink: '#000000' }, logo: { type: 'image', image: PNG }, portalName: 'Harbor Ridge Investor Portal', disclaimer: 'Not an offer.', postalAddress: '1 Harbor Way, Boston, MA 02110', onboarding: { steps: [] }, idPrefix: 'HRC' };
  assert.deepEqual(E().firmFromTenant(tenant), { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', supportTeam: 'Investor Relations', supportEmail: 'ir@harborridge.example', supportPhone: '+1 212 555 0100', colors: { primary: '#123456', accent: '#1F7A8C' }, logo: PNG, portalName: 'Harbor Ridge Investor Portal', disclaimer: 'Not an offer.', postalAddress: '1 Harbor Way, Boston, MA 02110' });
  const plain = E().firmFromTenant(Object.assign({}, tenant, { logo: { type: 'text', image: PNG }, support: { team: 'IR', email: 'ir@x.example&cc=y', phone: '' } }));
  assert.equal(plain.logo, '');
  assert.equal(plain.supportEmail, '');
});

test('dispatch without a server: no request; every message logged as simulated, and the summary says so', async () => {
  const ws = workspace();
  ws.investors.push({ id: 'HRC-0008', contact: 'Ortiz, Maria', title: 'Maria Ortiz', email: 'maria@investor.example' });
  const api = standIn(() => {
    throw new Error('no request may be made');
  });
  const items = ws.investors.map((inv) => ({ investorId: inv.id, inv, to: { name: inv.title, email: inv.email }, data: E().KINDS.notice.sample('custom') }));
  const out = await E().dispatch({ ws, kind: 'notice', variant: 'custom', items, connected: false, api });
  assert.equal(api.calls.length, 0);
  assert.deepEqual(out.results.map((r) => r.status), ['simulated', 'simulated']);
  assert.deepEqual(ws.mailLog.map((e) => [e.investorId, e.status, e.to]), [['HRC-0007', 'simulated', 'ann@investor.example'], ['HRC-0008', 'simulated', 'maria@investor.example']]);
  assert.equal(E().summary(out.counts, false), 'Email to 2 investors (simulated in this demo).');
  // An investor who turned the optional notice off is logged, not emailed, with or without a server.
  ws.investors[1].emailPrefs = { documents: false };
  const docs = ws.investors.map((inv) => ({ investorId: inv.id, inv, to: { name: inv.title, email: inv.email }, data: E().KINDS.notice.sample('documents') }));
  const two = await E().dispatch({ ws, kind: 'notice', variant: 'documents', items: docs, connected: false, api });
  assert.deepEqual(two.results.map((r) => r.status), ['simulated', 'unsubscribed']);
  assert.equal(E().summary(two.counts, false), 'Email to 1 investor (simulated in this demo). 1 has turned these emails off.');
  // No firm given: the workspace's own, as firmFromTenant reads it.
  ws.tenant = Object.assign({ shortName: 'Harbor Ridge', legalName: 'Harbor Ridge Capital Management LLC', support: { team: 'Investor Relations', email: 'ir@harborridge.example', phone: '' }, colors: { primary: '#123456', accent: '#1F7A8C' }, portalName: 'Harbor Ridge Investor Portal', disclaimer: '' }, ws.tenant);
  const data = E().KINDS.notice.sample('custom');
  delete data.firm;
  const three = await E().dispatch({ ws, kind: 'notice', variant: 'custom', items: [{ investorId: 'HRC-0007', inv: ws.investors[0], to: { name: 'Ann Lee', email: 'ann@investor.example' }, data }], connected: false, api, portalUrl: 'https://portal.example/portal.html' });
  assert.equal(three.results[0].status, 'simulated');
  assert.equal(api.calls.length, 0);
  assert.ok(ws.mailLog[ws.mailLog.length - 1].text.includes('Harbor Ridge Capital Management LLC'));
});

test('dispatch refuses: a taxpayer number, a long number or a password in the text stops the whole send before any request or log entry', async () => {
  const TAX = 'Remove the taxpayer number: emails never carry tax numbers.';
  const LONG = 'Remove the long number: emails never carry account or tax numbers.';
  const PASS = 'Remove the password: emails never carry passwords.';
  for (const [where, s, reason] of [['body', 'Your number on file is 000-12-3456.', TAX], ['body', 'Wire to account 991234567890 today.', LONG], ['subject', 'password: x', PASS]]) {
    const ws = workspace();
    E().log(ws, { kind: 'notice', status: 'simulated', text: 'earlier', at: '2026-11-10T12:00:00.000Z', id: 'mail-earlier' });
    const before = JSON.stringify(ws.mailLog);
    const api = standIn(() => ({ results: [] }));
    const ok = E().KINDS.notice.sample('custom');
    const bad = Object.assign(E().KINDS.notice.sample('custom'), { [where]: where === 'body' ? `Dear Ann,\n\n${s}` : s });
    const items = [ok, bad].map((data, n) => ({ investorId: `HRC-000${n + 7}`, inv: { id: `HRC-000${n + 7}` }, to: { name: 'Ann Lee', email: 'ann@investor.example' }, data }));
    await assert.rejects(E().dispatch({ ws, kind: 'notice', variant: 'custom', items, connected: true, api }), (e) => e.message === reason, s);
    assert.equal(api.calls.length, 0, s);
    assert.equal(JSON.stringify(ws.mailLog), before, s);
  }
  // A possibly commercial message without the firm's postal address is refused the same way.
  const ws = workspace();
  const api = standIn(() => ({ results: [] }));
  const data = E().KINDS.notice.sample('offeringNews');
  data.firm.postalAddress = '';
  await assert.rejects(E().dispatch({ ws, kind: 'notice', variant: 'offeringNews', offeringNews: true, items: [{ investorId: 'HRC-0007', inv: ws.investors[0], to: { name: 'Ann Lee', email: 'ann@investor.example' }, data }], connected: true, api }), /postal address/);
  assert.equal(api.calls.length, 0);
  assert.deepEqual(ws.mailLog, []);
});

test('summary: one sentence for what the server did, in the words the console shows; no banned word', async () => {
  const S = (counts) => E().summary(counts, true);
  assert.equal(S({ sent: 3 }), 'Emailed to 3 investors.');
  assert.equal(S({ sent: 1 }), 'Emailed to 1 investor.');
  assert.equal(S({ sent: 3, held: 1 }), 'Emailed to 3 investors. 1 is waiting: your sending domain is not ready.');
  assert.equal(S({ sent: 3, suppressed: 1 }), 'Emailed to 3 investors. 1 was not sent: an earlier email to that address came back.');
  assert.equal(S({ sent: 3, unsubscribed: 1 }), 'Emailed to 3 investors. 1 has turned these emails off.');
  assert.equal(S({ sent: 2, held: 1, suppressed: 1, unsubscribed: 1 }), 'Emailed to 2 investors. 1 is waiting: your sending domain is not ready. 1 was not sent: an earlier email to that address came back. 1 has turned these emails off.');
  assert.equal(E().summary({ simulated: 3 }, false), 'Email to 3 investors (simulated in this demo).');
  // The same counts from a real hand-off: the server's statuses, one unsubscribed by the investor's own choice.
  const ws = workspace();
  ws.investors.push({ id: 'HRC-0008', email: 'b@investor.example' }, { id: 'HRC-0009', email: 'c@investor.example' }, { id: 'HRC-0010', email: 'd@investor.example', emailPrefs: { quarterly: false } });
  const api = standIn((body) => ({ results: body.recipients.map((r, n) => ({ investorId: r.investorId, emailStatus: ['sent', 'held', 'suppressed'][n] })) }));
  const items = ws.investors.map((inv) => ({ investorId: inv.id, inv, to: { name: '', email: inv.email }, data: E().KINDS.notice.sample('quarterly') }));
  const out = await E().dispatch({ ws, kind: 'notice', variant: 'quarterly', items, connected: true, api });
  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.calls[0][2].recipients.map((r) => r.investorId), ['HRC-0007', 'HRC-0008', 'HRC-0009']);
  assert.deepEqual(out.results.map((r) => r.status), ['sent', 'held', 'suppressed', 'unsubscribed']);
  assert.deepEqual(ws.mailLog.map((e) => e.status), ['sent', 'held', 'suppressed', 'unsubscribed']);
  const said = E().summary(out.counts, true);
  assert.equal(said, 'Emailed to 1 investor. 1 is waiting: your sending domain is not ready. 1 was not sent: an earlier email to that address came back. 1 has turned these emails off.');
  const MODEL_NAMES = [/anthropic/i, /claude/i];
  const sentences = [said, S({ sent: 3, held: 2, suppressed: 2, unsubscribed: 2, outbox: 2, failed: 2 }), S({ outbox: 1, failed: 1 }), E().summary({ simulated: 1, unsubscribed: 2 }, false)];
  for (const s of sentences) for (const re of E().BANNED.concat(MODEL_NAMES)) assert.ok(!re.test(s), `${re}: ${s}`);
});
