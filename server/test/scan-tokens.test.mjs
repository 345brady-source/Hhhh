// gate: tests 3
// White-label leak scans of emails must not fail on a vendor word that a link's random token holds by chance (seen
// 2026-11-27: invitations-cosign.test.mjs clean() matched "diy" inside a co-investor's sign-in token once in a full suite
// run). stripLinkTokens (helpers.mjs) takes out only the random token parts of links; every other character, the link's
// host and path words included, is still scanned, so a real vendor name anywhere else still fails the scan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { invitationMessage } from '../lib/mail.mjs';
import { stripLinkTokens } from './helpers.mjs';

// The regex of invitations-cosign.test.mjs clean(), unchanged.
const VENDOR = /carrow|powered by|diy|refract|claude|anthropic/i;
const scan = (m) => !VENDOR.test(stripLinkTokens(`${m.subject}\n${m.text}\n${m.html}`));
const firm = { name: 'Lantern Point Partners', supportEmail: 'help@lantern.example' };
const investor = { contact: 'Dana Reyes', title: 'Reyes Family Trust' };
const coSign = (link, note) => invitationMessage({ firm, investor, offering: null, invitation: Object.assign({ existing: true, coSign: true }, note ? { note } : {}), link, expiresAt: '2026-12-11T00:00:00.000Z' });
const link = (host, tail) => `https://${host}/portal.html?tenant=harbor&server=http%3A%2F%2Fverify.test${tail}`;
// 43 characters, as randomBytes(32).toString('base64url') makes them, with a vendor word inside by chance
const TOK_DIY = 'q7Xk2PzR0aWv9DiyTq3mN8bLc4Hs1JfYg6Ue5Ko0RtA';
const TOK_PLAIN = 'Hq3Lm8Zp0Wc7Rt2Yb5Nk9Vd4Jf6Sg1Xa0Ue3Ko7PiQw';

test('a vendor word inside a link token (after #invite-, in t=, sig=, token=, or a random path run) does not fail the scan', () => {
  assert.equal(TOK_DIY.length, 43);
  const plain = coSign(link('portal.example', `#invite-${TOK_PLAIN}`));
  assert.ok(scan(plain), 'the email itself is clean');
  const planted = coSign(link('portal.example', `#invite-${TOK_DIY}`));
  assert.ok(VENDOR.test(`${planted.subject}\n${planted.text}\n${planted.html}`), 'the raw email does match: the token holds "Diy"');
  assert.ok((planted.text + planted.html).includes(TOK_DIY), 'the token is in the email as sent');
  assert.ok(scan(planted), 'scanned with the token taken out, it is clean');
  for (const tail of [`&t=xyDiy`, `&sig=ClaudeX9`, `&token=refractQ`, `&amp;t=AnthropicZ`, `#t=CarrowK`]) assert.ok(scan(coSign(link('portal.example', tail))), tail);
  assert.ok(scan(coSign(`https://portal.example/a/${TOK_DIY}/b`)), 'a random run in the path');
  assert.ok(scan(coSign(`https://portal.example/invite/${TOK_DIY}`)), 'the segment after /invite/');
});

test('a vendor name anywhere else still fails the scan: visible text, subject, the link host, the link path', () => {
  const tok = `#invite-${TOK_PLAIN}`;
  assert.equal(scan(coSign(link('portal.example', tok), 'Sent with Refract.')), false, '"Refract" in the visible text');
  assert.equal(scan(coSign(link('claude-portal.example', tok))), false, 'a vendor word in the link host');
  assert.equal(scan(coSign(link('portal.example/powered-by-carrow-2026', tok))), false, 'a lower-case vendor path word, with a year');
  assert.equal(scan(coSign(link('portal.example/Carrow', tok))), false, 'a short path word');
  assert.equal(scan(coSign(link('portal.example/diy', tok))), false, 'a short path word in small letters');
  const m = coSign(link('portal.example', tok));
  assert.equal(scan(Object.assign({}, m, { subject: m.subject + ' (Anthropic)' })), false, 'the subject');
  assert.equal(scan(coSign(`https://portal.example/?server=https%3A%2F%2Fclaude.example${tok}`)), false, 'a vendor host inside another query value');
});

test('only link tokens are taken out: text outside links is unchanged, and 500 random invite tokens never survive', () => {
  const prose = 'Dear Dana, Lantern Point Partners asks you to sign. Diy onnx Carrow – “quoted” & more.\nSecond line.';
  assert.equal(stripLinkTokens(prose), prose);
  assert.equal(stripLinkTokens(undefined), '');
  const url = link('portal.example', '#invite-');
  for (let i = 0; i < 500; i++) {
    const t = randomBytes(32).toString('base64url');
    const out = stripLinkTokens(`<a href="${url}${t}">${url}${t}</a>\n${url}${t}.`);
    assert.equal(out.includes(t), false, 'the token is gone');
    assert.equal(out, `<a href="${url}~">${url}~</a>\n${url}~.`, 'and nothing else changed');
  }
});
