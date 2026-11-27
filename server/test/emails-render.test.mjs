// gate: tests 8
// Plan 13-01 (EM-01, EM-02, EM-05): the one template set. assets/js/emails.js renders every message the server sends;
// server/lib/mail.mjs's builders return exactly what it renders. Goldens in server/test/fixtures/emails/ make every
// wording change a visible diff (written only with EMAILS_WRITE_GOLDEN=1, set by hand).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withServer } from './helpers.mjs';
import { invitationMessage, resendMessage, notificationMessage, reminderMessage } from '../lib/mail.mjs';

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

/* ---------- Every kind and variant (tests 2 to 8) ---------- */
const GOLD = fileURLToPath(new URL('./fixtures/emails/', import.meta.url));
const WRITE = process.env.EMAILS_WRITE_GOLDEN === '1';
const VARIANTS = {
  invitation: ['new-offering', 'new-account', 'subscribe', 'subscribe-tax', 'access', 'taxRequest-w9', 'taxRequest-w8ben', 'coSign', 'reverify'],
  invitation_resent: ['new-offering', 'new-account', 'subscribe', 'subscribe-tax', 'access', 'taxRequest-w9', 'taxRequest-w8ben', 'coSign', 'reverify', 'started'],
  sponsor_notification: ['onboarding', 'onboarding-account', 'subscription', 'subscription-tax', 'none', 'access', 'coSign-signed', 'coSign-unsigned', 'taxRequest-signed', 'taxRequest-notsigned', 'taxRequest-none', 'reverify-reverified', 'reverify-finished'],
  submission_reminder: ['onboarding', 'subscription', 'taxRequest', 'reverify', 'coSign']
};
const BUILDERS = { invitation: invitationMessage, invitation_resent: resendMessage, sponsor_notification: notificationMessage, submission_reminder: reminderMessage };
const linkOf = (kind, data) => (E().KINDS[kind].audience === 'investor' ? data.link : data.consoleUrl);
/** Every sample of every kind of this plan, rendered. */
function all(firmOver, opts) {
  const out = [];
  for (const kind of Object.keys(VARIANTS)) {
    for (const variant of E().KINDS[kind].variants) {
      const data = E().KINDS[kind].sample(variant);
      if (firmOver) data.firm = Object.assign(data.firm, firmOver);
      out.push({ kind, variant, data, m: E().render(kind, data, opts) });
    }
  }
  return out;
}
const goldText = (m) => `Subject: ${m.subject}\nPreheader: ${m.preheader}\n\n${m.text}\n`;
const count = (hay, needle) => hay.split(needle).length - 1;
const PNG = `data:image/png;base64,${Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')}`;

test('every variant has a golden, and the server’s builders return exactly what emails.js renders', () => {
  for (const kind of Object.keys(VARIANTS)) assert.deepEqual(E().KINDS[kind] && E().KINDS[kind].variants, VARIANTS[kind], kind);
  if (WRITE) mkdirSync(GOLD, { recursive: true });
  for (const { kind, variant, data, m } of all()) {
    const name = `${kind}-${variant}`;
    if (WRITE) {
      writeFileSync(join(GOLD, `${name}.txt`), goldText(m));
      writeFileSync(join(GOLD, `${name}.html`), m.html);
    }
    assert.ok(existsSync(join(GOLD, `${name}.txt`)) && existsSync(join(GOLD, `${name}.html`)), `no golden for ${name}`);
    assert.equal(goldText(m), readFileSync(join(GOLD, `${name}.txt`), 'utf8'), `${name}.txt`);
    assert.equal(m.html, readFileSync(join(GOLD, `${name}.html`), 'utf8'), `${name}.html`);
    const b = BUILDERS[kind](JSON.parse(JSON.stringify(data)));
    assert.deepEqual([b.subject, b.preheader, b.text, b.html], [m.subject, m.preheader, m.text, m.html], `${name}: the builder`);
  }
});

test('sponsor text unchanged: every sponsor variant’s subject and text are the base tree’s builder output', () => {
  const base = JSON.parse(readFileSync(join(GOLD, 'base-sponsor.json'), 'utf8'));
  for (const kind of ['sponsor_notification', 'submission_reminder']) {
    assert.equal(E().KINDS[kind] && E().KINDS[kind].audience, 'sponsor', kind);
    assert.deepEqual(E().KINDS[kind].variants, Object.keys(base[kind]), kind);
    for (const [variant, b] of Object.entries(base[kind])) {
      const data = E().KINDS[kind].sample(variant);
      assert.deepEqual(data, b.input, `${kind} ${variant}: the sample is the base input`);
      const m = E().render(kind, data);
      assert.equal(m.subject, b.subject, `${kind} ${variant}: subject`);
      assert.equal(m.text, b.text, `${kind} ${variant}: text`);
    }
  }
});

test('wording: subjects, the greeting by given name, New link:, one expiry and one support sentence', () => {
  const R = (kind, variant, over) => E().render(kind, Object.assign(E().KINDS[kind].sample(variant), over || {}));
  const SUBJECTS = {
    'new-offering': 'Harbor Ridge Capital: your invitation to invest in Harbor Ridge Fund II',
    'new-account': 'Harbor Ridge Capital: set up your investor account',
    subscribe: 'Harbor Ridge Capital: your subscription to Harbor Ridge Fund II',
    'subscribe-tax': 'Harbor Ridge Capital: your subscription to Harbor Ridge Fund II',
    access: 'Harbor Ridge Capital: your investor portal',
    'taxRequest-w9': 'Harbor Ridge Capital: your Form W-9',
    'taxRequest-w8ben': 'Harbor Ridge Capital: your Form W-8BEN',
    coSign: 'Harbor Ridge Capital: sign the subscription agreement for Anita Shah',
    reverify: 'Harbor Ridge Capital: verify your accredited investor status'
  };
  const BUTTONS = { 'new-offering': 'Start your onboarding', 'new-account': 'Set up your account', subscribe: 'Review and subscribe', 'subscribe-tax': 'Review and subscribe', access: 'Open your portal', 'taxRequest-w9': 'Complete your tax form', 'taxRequest-w8ben': 'Complete your tax form', coSign: 'Review and sign', reverify: 'Verify your accreditation' };
  const label = (html) => (/<a data-button [^>]*>([^<]*)<\/a>/.exec(html) || [])[1];
  for (const [variant, subject] of Object.entries(SUBJECTS)) {
    const m = R('invitation', variant);
    assert.equal(m.subject, subject, variant);
    assert.equal(label(m.html), BUTTONS[variant], `${variant} button`);
    const re = R('invitation_resent', variant);
    assert.equal(re.subject, `New link: ${subject}`, `${variant} resent`);
    assert.equal(label(re.html), BUTTONS[variant], `${variant} resent button`);
  }
  assert.equal(R('invitation_resent', 'started').subject, `New link: ${SUBJECTS['new-offering']}`);
  assert.equal(label(R('invitation_resent', 'started').html), 'Continue your onboarding');
  assert.ok(R('invitation', 'subscribe-tax').text.includes('your tax form'));
  assert.ok(R('invitation', 'reverify').text.includes('asks you to verify your accredited investor status again'));
  assert.ok(R('invitation', 'new-account').text.includes('set up your investor account'));
  // The given name, from either order; "Hello," when there is none; never "Dear investor,".
  for (const n of ['Shah, Anita', 'Anita Shah', ' Anita  Shah ']) assert.equal(E().greeting(n), 'Dear Anita,', n);
  assert.equal(E().greeting(''), 'Hello,');
  assert.equal(E().givenName('Shah, Anita'), 'Anita');
  const nameless = R('invitation', 'new-offering', { investor: { id: 'X-1', contact: '', title: '', email: 'x@investor.example' } });
  assert.ok(nameless.text.startsWith('Hello,\n\n'), nameless.text.slice(0, 40));
  // Who invites: "<sender> at <firm>", unless the sender is the support team.
  const inv = E().KINDS.invitation.sample('new-offering').invitation;
  assert.ok(R('invitation', 'new-offering', { invitation: Object.assign({}, inv, { senderName: 'Maria Ortiz' }) }).text.includes('Maria Ortiz at Harbor Ridge Capital has invited you to invest in Harbor Ridge Fund II'));
  assert.ok(R('invitation', 'new-offering', { invitation: Object.assign({}, inv, { senderName: 'Investor Relations' }) }).text.includes('\n\nHarbor Ridge Capital has invited you to invest in Harbor Ridge Fund II'));
  const expiry = E().expirySentence('2026-12-10T12:00:00.000Z');
  assert.equal(expiry, 'This link is personal to you; please do not forward it. It expires on December 10, 2026.');
  const support = E().supportSentence(E().KINDS.invitation.sample('new-offering').firm);
  assert.equal(support, 'Questions? Contact Investor Relations at ir@harborridge.example or +1 212 555 0100.');
  for (const { kind, variant, m } of all()) {
    assert.ok(!/Dear investor/i.test(m.text + m.html), `${kind} ${variant}`);
    if (E().KINDS[kind].audience !== 'investor') continue;
    assert.ok(/^(Dear [A-Z][a-z]+,|Hello,)\n\n/.test(m.text), `${kind} ${variant}: ${m.text.slice(0, 30)}`);
    assert.ok(!/Reminder:/.test(m.subject), `${kind} ${variant}: ${m.subject}`);
    if (kind === 'invitation_resent') assert.ok(m.subject.startsWith('New link: '), m.subject);
    assert.equal(count(m.text, expiry), 1, `${kind} ${variant}: the expiry sentence once`);
    assert.equal(count(m.text, support), 1, `${kind} ${variant}: the support sentence once`);
  }
});

test('one button, its link also printed (investor messages); at most one, to the console, for the sponsor', () => {
  for (const { kind, variant, data, m } of all()) {
    const buttons = m.html.match(/<a data-button [^>]*>/g) || [];
    const href = (buttons[0] && (/href="([^"]*)"/.exec(buttons[0]) || [])[1]) || '';
    const link = linkOf(kind, data);
    if (E().KINDS[kind].audience === 'investor') assert.equal(buttons.length, 1, `${kind} ${variant}`);
    else assert.ok(buttons.length <= 1, `${kind} ${variant}`);
    if (buttons.length) {
      assert.equal(href, E().esc(link), `${kind} ${variant}`);
      assert.ok(m.text.includes(link), `${kind} ${variant}: the link in the text`);
    }
  }
  for (const kind of ['sponsor_notification', 'submission_reminder']) {
    const m = E().render(kind, Object.assign(E().KINDS[kind].sample(E().KINDS[kind].variants[0]), { consoleUrl: null }));
    assert.equal((m.html.match(/data-button/g) || []).length, 0, `${kind} without a console address has no button`);
  }
});

test('structure: lang, title, color-scheme, presentation tables, a 44 px button cell, the logo’s alt, inline styles, under 100 KB', () => {
  for (const { kind, variant, data, m } of all({ logo: PNG })) {
    const h = m.html;
    const tag = `${kind} ${variant}`;
    assert.ok(/^<!doctype html><html lang="en">/.test(h), tag);
    assert.equal(count(h, '<title>'), 1, tag);
    assert.ok(h.includes('<meta name="color-scheme" content="light dark">'), tag);
    const tables = h.match(/<table\b[^>]*>/g) || [];
    assert.ok(tables.length >= 2 && tables.every((t) => /role="presentation"/.test(t)), tag);
    assert.ok(!/<style\b|<link\b|<script\b|\bclass="/i.test(h), tag);
    assert.ok(h.length < 100000, `${tag}: ${h.length}`);
    assert.ok(h.includes(`<img src="cid:logo@firm" alt="${E().esc(data.firm.name)}"`), tag);
    const cell = /<td\b([^>]*)><a data-button/.exec(h);
    if (cell) {
      const px = Math.max(...[/[^-]height:(\d+)px/, /min-height:(\d+)px/].map((re) => Number((re.exec(cell[1]) || [])[1] || 0)));
      assert.ok(px >= 44, `${tag}: the button cell is ${px} px`);
    } else assert.notEqual(E().KINDS[kind].audience, 'investor', `${tag}: no button cell`);
    assert.ok(m.preheader.length > 0 && h.includes(E().esc(m.preheader)), `${tag}: the preheader`);
  }
});

test('contrast: the button text is white or ink, whichever reads at 4.5:1 or more on the firm’s colour', () => {
  for (const [primary, ink] of [['#FFE066', '#1B1F24'], ['#123456', '#FFFFFF']]) {
    assert.equal(E().contrastText(primary), ink);
    assert.ok(E().contrast(ink, primary) >= 4.5, `${ink} on ${primary}`);
    const data = E().KINDS.invitation.sample('new-offering');
    data.firm.colors.primary = primary;
    const a = /<a data-button [^>]*style="[^"]*[^-]color:(#[0-9A-Fa-f]{6})/.exec(E().render('invitation', data).html);
    assert.equal(a && a[1], ink, primary);
  }
});

test('logos and footer: a PNG logo inline as cid:logo@firm, an SVG or WebP logo as the firm’s name, the postal address in the footer', () => {
  const R = (firm, opts) => {
    const data = E().KINDS.invitation.sample('new-offering');
    Object.assign(data.firm, firm);
    return E().render('invitation', data, opts);
  };
  const png = R({ logo: PNG });
  assert.equal(png.inline.length, 1);
  assert.deepEqual(png.inline[0], { cid: 'logo@firm', contentType: 'image/png', base64: PNG.split(',')[1] });
  for (const logo of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/webp;base64,UklGRg==']) {
    const m = R({ logo });
    assert.equal(m.inline.length, 0, logo.slice(0, 20));
    assert.ok(!/<img\b/.test(m.html) && m.html.includes('>Harbor Ridge Capital</span>'), logo.slice(0, 20));
  }
  const pv = R({ logo: PNG }, { preview: true });
  assert.equal(pv.inline.length, 0);
  assert.ok(pv.html.includes(`<img src="${PNG}" alt="Harbor Ridge Capital"`));
  const addr = '1 Harbor Way, Boston, MA 02110';
  const withAddr = R({ postalAddress: addr });
  assert.ok(withAddr.text.endsWith(`--\nHarbor Ridge Capital Management LLC\n\n${addr}\n\nThis message is not an offer to sell securities.`), withAddr.text.slice(-200));
  const foot = withAddr.html.slice(withAddr.html.lastIndexOf('border-top:1px solid'));
  const [l, a, d] = ['Harbor Ridge Capital Management LLC', addr, 'not an offer to sell'].map((s) => foot.indexOf(s));
  assert.ok(l >= 0 && l < a && a < d, `${l} ${a} ${d}`);
  const without = R({});
  assert.ok(without.text.endsWith('--\nHarbor Ridge Capital Management LLC\n\nThis message is not an offer to sell securities.'), without.text.slice(-200));
  assert.ok(!/\n\n\n/.test(without.text) && !/<p[^>]*><\/p>/.test(without.html));
  assert.ok(!('attachments' in png) && !('attachment' in png), 'no attachment field');
});
