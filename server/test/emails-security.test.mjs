// gate: tests 2
// Plan 15-14 (SE-02, SE-05, SE-14, D-04): the security notices and the investor's portal sign-in invitation in
// assets/js/emails.js. Every variant renders with its subject, the firm's name and, where it has one, one button; the
// goldens in server/test/fixtures/emails/ are written as 13-01's are (only with EMAILS_WRITE_GOLDEN=1, set by hand); and
// phase 13's guard finds no password, code, taxpayer or bank number in any of them, whatever the data holds. Every number
// below is one no one is issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const E = () => require('../../assets/js/emails.js');
const GOLD = fileURLToPath(new URL('./fixtures/emails/', import.meta.url));
const WRITE = process.env.EMAILS_WRITE_GOLDEN === '1';
// The model maker's names: banned from every message too, kept here beside the tests (as in emails-guard.test.mjs).
const MODEL_NAMES = [/anthropic/i, /claude/i];

const FIRM = 'Harbor Ridge Capital';
const SUBJECTS = {
  passwordChanged: 'your password was changed',
  twoStepChanged: 'two-step sign-in changed',
  recoveryCodesReplaced: 'your recovery codes were replaced',
  recoveryCodeUsed: 'a recovery code was used',
  newDevice: 'a new sign-in to your console',
  locked: 'your account is locked for 15 minutes',
  confirmEmail: 'confirm your email address',
  bankChanged: 'your bank account was changed',
  bankChangedFirm: "an investor's bank account was changed, confirm it before paying"
};
const TEAM_ONLY = ['newDevice', 'confirmEmail', 'bankChangedFirm'];
/** What each notice tells a person to do if it was not them. */
const IF_NOT = {
  bankChanged: 'If you did not make this change, contact us at once and reset your password from the sign-in page.',
  bankChangedFirm: 'Confirm it with the investor first, by a phone number you already hold, never one given in an email.',
  confirmEmail: 'If you did not sign up, ignore this email.',
  locked: 'If these tries were not yours, reset your password from the sign-in page (a new password ends the lock)'
};
const goldText = (m) => `Subject: ${m.subject}\nPreheader: ${m.preheader}\n\n${m.text}\n`;
const buttonsOf = (html) => (html.match(/<a data-button [^>]*>[^<]*<\/a>/g) || []).map((a) => ({ href: (/href="([^"]*)"/.exec(a) || [])[1], label: (/>([^<]*)<\/a>$/.exec(a) || [])[1] }));

/** Every variant of both kinds, the investor variants for an investor and a team person both. */
function every(over = {}) {
  const out = [];
  for (const variant of E().KINDS.security_notice.variants) {
    for (const audience of TEAM_ONLY.includes(variant) ? ['team'] : variant === 'bankChanged' ? ['investor'] : ['investor', 'team']) {
      const data = Object.assign(E().KINDS.security_notice.sample(variant), { audience }, over);
      out.push({ kind: 'security_notice', variant, audience, data, m: E().render('security_notice', data) });
    }
  }
  const data = Object.assign(E().KINDS.portal_access.sample('access'), over);
  out.push({ kind: 'portal_access', variant: 'access', audience: 'investor', data, m: E().render('portal_access', data) });
  return out;
}

test('kinds', () => {
  assert.deepEqual(E().KINDS.security_notice.variants, Object.keys(SUBJECTS));
  assert.deepEqual(E().KINDS.portal_access.variants, ['access']);
  assert.equal(E().KINDS.portal_access.audience, 'investor');
  for (const { kind, variant, audience, data, m } of every()) {
    const tag = `${kind} ${variant} (${audience})`;
    assert.equal(m.subject, kind === 'portal_access' ? `${FIRM}: set up your sign-in to the investor portal` : `${FIRM}: ${SUBJECTS[variant]}`, tag);
    assert.ok(m.text.includes(FIRM) && m.html.includes(FIRM), `${tag}: the firm's name`);
    assert.ok(/^Dear (Anita|Maria),\n\n/.test(m.text), `${tag}: the greeting`);
    const buttons = buttonsOf(m.html);
    if (variant === 'confirmEmail' || kind === 'portal_access') {
      assert.equal(buttons.length, 1, tag);
      assert.deepEqual(buttons[0], { href: E().esc(data.link), label: kind === 'portal_access' ? 'Set up my sign-in' : 'Confirm my email' }, tag);
      assert.ok(m.text.includes(data.link), `${tag}: the link in the text`);
    } else {
      assert.equal(buttons.length, 0, `${tag}: no button`);
      assert.ok(m.text.includes('November 10, 2026 at 12:00 UTC'), `${tag}: when it happened`);
      assert.ok(m.text.includes(IF_NOT[variant] || 'If this was not you, reset your password now from the sign-in page'), `${tag}: what to do if it was not them`);
    }
    // An investor is pointed to the firm's team; a console person to the firm's Owner.
    if (audience === 'investor') assert.ok(m.text.includes(E().supportSentence(data.firm)), `${tag}: the firm's support`);
    else if (variant !== 'confirmEmail' && variant !== 'bankChangedFirm') assert.ok(m.text.includes('tell the Owner of your firm’s console'), tag);
    assert.equal(m.commercial, false, tag);
    assert.deepEqual([m.headers, m.needs, m.inline], [{}, [], []], tag);
  }
  // The device by its type only; the bank account by its last four digits only.
  const N = (over) => E().render('security_notice', Object.assign(E().KINDS.security_notice.sample('newDevice'), over)).text;
  assert.ok(N({ device: 'Phone' }).includes('from a new phone on'));
  assert.ok(N({ device: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }).includes('from a new device on'));
  assert.ok(!N({ device: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }).includes('Mozilla'));
  for (const variant of ['bankChanged', 'bankChangedFirm']) {
    const t = E().render('security_notice', Object.assign(E().KINDS.security_notice.sample(variant), { last4: '000123456789' })).text;
    assert.ok(t.includes('The new account ends in 6789.') && !t.includes('123456789'), variant);
  }
  assert.ok(E().render('security_notice', E().KINDS.security_notice.sample('bankChangedFirm')).text.startsWith('Dear Maria,\n\nAnita Shah’s bank account for payments was changed'));
  assert.ok(E().render('security_notice', E().KINDS.security_notice.sample('recoveryCodeUsed')).text.includes('You have 9 codes left'));

  // The goldens, written only by hand with EMAILS_WRITE_GOLDEN=1 (13-01's step), for each kind's sample.
  if (WRITE) mkdirSync(GOLD, { recursive: true });
  for (const [kind, variants] of [['security_notice', E().KINDS.security_notice.variants], ['portal_access', ['access']]]) {
    for (const variant of variants) {
      const m = E().render(kind, E().KINDS[kind].sample(variant));
      const name = `${kind}-${variant}`;
      if (WRITE) {
        writeFileSync(join(GOLD, `${name}.txt`), goldText(m));
        writeFileSync(join(GOLD, `${name}.html`), m.html);
      }
      assert.ok(existsSync(join(GOLD, `${name}.txt`)) && existsSync(join(GOLD, `${name}.html`)), `no golden for ${name}`);
      assert.equal(goldText(m), readFileSync(join(GOLD, `${name}.txt`), 'utf8'), `${name}.txt`);
      assert.equal(m.html, readFileSync(join(GOLD, `${name}.html`), 'utf8'), `${name}.html`);
    }
  }
});

test('guard', () => {
  // Data that carries every secret a caller could pass by mistake: none of it may reach a message.
  const SECRETS = { password: 'Harbor-Ridge-Horse-9', code: '492817', recoveryCodes: ['k7m2p-q9r4s', 'a2b3c-d4e5f'], tin: '000-12-3456', ein: '00-1234567', routing: '500000005', account: '000123456789', last4: '000123456789' };
  const values = ['Harbor-Ridge-Horse-9', '492817', 'k7m2p-q9r4s', 'a2b3c-d4e5f', '000-12-3456', '00-1234567', '500000005', '000123456789'];
  const banned = E().BANNED.concat(MODEL_NAMES);
  const dates = /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}( at \d{2}:\d{2} UTC)?/g;
  for (const { kind, variant, audience, data, m } of every(SECRETS)) {
    const tag = `${kind} ${variant} (${audience})`;
    for (const part of [m.subject, m.preheader, m.text, m.html]) {
      for (const v of values) assert.ok(!part.includes(v), `${tag}: a secret reached the message`);
      const rest = (data.link ? part.split(E().esc(data.link)).join(' ').split(data.link).join(' ') : part).replace(dates, ' ');
      assert.equal(E().screen(rest), null, `${tag}: phase 13's guard`);
      for (const re of E().PATTERNS) assert.ok(!re.test(rest), `${tag}: ${re}`);
      for (const re of banned) assert.ok(!re.test(part), `${tag}: ${re}`);
    }
    if (audience === 'investor') assert.ok(!/console/i.test(m.text), `${tag}: an investor's message names no console`);
  }
});
