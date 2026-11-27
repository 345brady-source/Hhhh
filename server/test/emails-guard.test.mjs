// gate: tests 4
// Plan 13-01 (EM-03, EM-04, EM-14): what no message may carry, over every kind and variant assets/js/emails.js renders:
// taxpayer, bank or account numbers and passwords (one shared list of patterns, and the sentence that says what to
// remove), the platform's, vendors' and libraries' names, and any link but the investor's own and the firm's support
// address. Every number below is one no one is issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { buildMessage } from '../lib/mail.mjs';

const require = createRequire(import.meta.url);
const E = () => require('../../assets/js/emails.js');
const TAX = 'Remove the taxpayer number: emails never carry tax numbers.';
const LONG = 'Remove the long number: emails never carry account or tax numbers.';
const PASS = 'Remove the password: emails never carry passwords.';
const SVG = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
// The model maker's names: banned from every message too, but kept out of assets/js (a file the browser ships may not
// name them; the reference gate's leak step reads every line of assets/js), so they live here, beside the tests.
const MODEL_NAMES = [/anthropic/i, /claude/i];
const banned = () => E().BANNED.concat(MODEL_NAMES);

/** Every sample of every kind, with the sample firm, an SVG-logo firm and a firm whose optional fields are empty. */
function renders() {
  const out = [];
  const firms = [(f) => f, (f) => Object.assign(f, { logo: SVG }), (f) => ({ name: f.name })];
  for (const [kind, k] of Object.entries(E().KINDS)) {
    for (const variant of k.variants) {
      for (const shape of firms) {
        const data = k.sample(variant);
        data.firm = shape(data.firm);
        out.push({ kind, variant, data, m: E().render(kind, data) });
      }
    }
  }
  return out;
}
const parts = (m) => [m.subject, m.preheader, m.text, m.html];
/** The addresses a message may link to (13-11): the personal link, the portal, the console and the stop link. */
const linksOf = (data) => [data.link, data.portalUrl, data.consoleUrl, data.unsubscribeUrl].filter(Boolean);
/** The text with every allowed address taken out (the HTML-escaped form too). */
const without = (s, data) => linksOf(data).reduce((t, l) => t.split(E().esc(l)).join(' ').split(l).join(' '), String(s));
/** Every key of a value, at any depth. */
function keys(x, out = []) {
  if (Array.isArray(x)) x.forEach((v) => keys(v, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) out.push(k), keys(v, out);
  return out;
}
/** A key naming a taxpayer, bank or account number or a password, read word by word ("existing" is not "tin"). */
const words = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const SENSITIVE_KEY = (k) => {
  const w = words(k);
  return w.some((x) => /^(tin|ssn|ein|itin|routing|password|passcode)$/.test(x)) || /account ?number/.test(w.join(' '));
};

test('patterns: screen() refuses taxpayer numbers, long numbers and passwords with one sentence each; the first three are the help desk’s', () => {
  for (const [s, reason] of [['123-45-6789', TAX], ['12-3456789', TAX], ['131000021', LONG], ['000123456789', LONG], ['password: hunter2', PASS], ['passcode=1', PASS], ['Our wire went to account 4455667788 yesterday', LONG], ['SSN 123 45 6789', TAX]]) {
    assert.deepEqual(E().screen(s), { reason }, s);
  }
  for (const s of ['Fund II closes on December 10, 2026', 'Call 212 555 0100', 'Unit 4B', 'Commitment of $250,000.00', '']) assert.equal(E().screen(s), null, s);
  const src = readFileSync(new URL('../lib/help.mjs', import.meta.url), 'utf8');
  const literal = /^const NUMBERS = (\[.*\]);$/m.exec(src);
  assert.ok(literal, 'help.mjs NUMBERS');
  const numbers = new Function(`return ${literal[1]}`)();
  assert.deepEqual(E().PATTERNS.slice(0, 3).map((r) => r.source), numbers.map((r) => r.source));
  assert.equal(E().PATTERNS.length, 4);
});

test('no sensitive data in any render: no pattern in what is sent, no field for one in the data, the note screened', () => {
  for (const { kind, variant, data, m } of renders()) {
    for (const p of parts(m)) {
      const s = without(p, data).replace(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g, ' ');
      for (const re of E().PATTERNS) assert.ok(!re.test(s), `${kind} ${variant}: ${re} in ${(re.exec(s) || [])[0]}`);
    }
    const bad = keys(data).filter(SENSITIVE_KEY);
    assert.deepEqual(bad, [], `${kind} ${variant}: ${bad.join(', ')}`);
    assert.ok(!('attachments' in m) && !('attachment' in m), `${kind} ${variant}: no attachment`);
    assert.deepEqual(m.inline.map((x) => x.cid), m.inline.length ? ['logo@firm'] : [], 'the logo is the only inline part');
  }
  // The key rule reads words: it finds the shapes a taxpayer or bank number would come in, and not "existing".
  for (const k of ['tin', 'ssn', 'investorTin', 'ein', 'routing', 'routingNumber', 'accountNumber', 'account_number', 'password']) assert.ok(SENSITIVE_KEY(k), k);
  for (const k of ['existing', 'taxType', 'being', 'stepKey', 'senderName', 'account']) assert.ok(!SENSITIVE_KEY(k), k);
  // The sponsor's note is the one free text the investor's message echoes: screen() refuses it when it holds a number.
  const data = E().KINDS.invitation.sample('new-offering');
  data.invitation.note = 'Your account 000123456789 is set up.';
  assert.ok(E().render('invitation', data).text.includes(data.invitation.note), 'the note is echoed as typed');
  assert.deepEqual(E().screen(data.invitation.note), { reason: LONG });
  assert.equal(E().screen('We are glad to have you with us.'), null);
});

test('banned words: no platform, vendor or library name, and never the plain-tier word, in any variant or in the headers', () => {
  const all = renders();
  for (const { kind, variant, m } of all) {
    for (const p of parts(m)) for (const re of banned()) assert.ok(!re.test(p), `${kind} ${variant}: ${re}`);
  }
  const { m, data } = all[0];
  const raw = buildMessage({ from: { name: data.firm.name, address: 'notices@harborridge.example' }, to: { name: 'Anita Shah', address: 'anita@investor.example' }, replyTo: data.firm.supportEmail, subject: m.subject, text: m.text, html: m.html, inline: [], headers: m.headers, date: new Date('2026-11-10T12:00:00Z') });
  const head = raw.split('\r\n\r\n')[0];
  for (const re of banned()) assert.ok(!re.test(head), `${re} in the headers`);
  assert.equal(E().SIMULATED, '(simulated in this demo)');
  // The shipped file itself: no line names the model maker (the reference gate's leak rule for assets/js).
  const own = readFileSync(new URL('../../assets/js/emails.js', import.meta.url), 'utf8').split('\n');
  const named = own.map((l, i) => (MODEL_NAMES.some((re) => re.test(l)) ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(named, [], `assets/js/emails.js lines ${named.join(', ')}`);
});

test('links: only the investor’s own link, the portal, the console, the stop link and the firm’s support address; redactLink and log() keep no link', () => {
  const URL_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi;
  const DOMAIN_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:example|com|net|org|io|co|us|app|dev|biz|info)\b/gi;
  for (const { kind, variant, data, m } of renders()) {
    const allowed = linksOf(data).map((l) => E().esc(l));
    const support = data.firm.supportEmail || '';
    const hrefs = (m.html.match(/\bhref="[^"]*"/g) || []).map((h) => h.slice(6, -1));
    for (const h of hrefs) assert.ok(allowed.indexOf(h) >= 0 || (support && h === `mailto:${support}`), `${kind} ${variant}: href ${h}`);
    for (const p of [m.text, m.html]) {
      const rest = without(p, data).split(support || '\u0000').join(' ').split((data.investor && data.investor.email) || '\u0000').join(' ');
      assert.deepEqual(rest.match(URL_RE) || [], [], `${kind} ${variant}: a URL`);
      assert.deepEqual(rest.match(DOMAIN_RE) || [], [], `${kind} ${variant}: a domain`);
    }
    assert.ok(!/src="(?!cid:logo@firm")/.test(m.html), `${kind} ${variant}: no remote image`);
  }
  // A support address that is not a plain address is never made a link (it could carry extra recipients).
  for (const supportEmail of ['ir@harborridge.example?bcc=list@else.example', 'ir@harborridge.example&cc=x', 'not an address']) {
    const data = E().KINDS.invitation.sample('new-offering');
    data.firm.supportEmail = supportEmail;
    const m = E().render('invitation', data);
    assert.ok(!/href="mailto:/.test(m.html), supportEmail);
    assert.ok(!m.text.includes(supportEmail) && !m.html.includes(E().esc(supportEmail)), `${supportEmail} is not printed`);
  }
  const link = 'https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#invite-abc.def';
  assert.equal(E().redactLink(`Start here:\n${link}\nor ${link}`, link), 'Start here:\n[personal link]\nor [personal link]');
  assert.equal(E().redactLink('https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#invite-abcXdef', link), 'https://portal.example/portal.html?server=https%3A%2F%2Fapi.example#invite-abcXdef', 'the dot is not a wildcard');
  const ws = {};
  const m = E().render('invitation', Object.assign(E().KINDS.invitation.sample('new-offering'), { link }));
  const rec = E().log(ws, { kind: 'invitation', subject: m.subject, to: 'anita@investor.example', investorId: 'HRC-0101', status: 'simulated', text: m.text, link, at: '2026-11-10T12:00:00.000Z' });
  assert.equal(ws.mailLog.length, 1);
  assert.equal(ws.mailLog[0], rec);
  assert.deepEqual(Object.keys(rec).sort(), ['at', 'id', 'investorId', 'kind', 'status', 'subject', 'text', 'to']);
  assert.ok(!JSON.stringify(ws).includes('invite-abc') && rec.text.includes('[personal link]'), 'the stored text holds no link');
  assert.throws(() => E().log(ws, { status: 'opened', text: '' }), /status/);
  for (let i = 0; i < 2005; i++) E().log(ws, { kind: 'invitation', status: 'outbox', text: `n${i}` });
  assert.equal(ws.mailLog.length, 2000);
  assert.equal(ws.mailLog[ws.mailLog.length - 1].text, 'n2004');
});
