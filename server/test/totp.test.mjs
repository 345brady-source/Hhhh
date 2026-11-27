// gate: tests 8
// The two-step code (plan 15-02, SE-02): assets/js/totp.js, the one file the browser and the server both use, checked
// against the RFCs' own published test values. The server always passes node:crypto's HMAC; the keys below are the RFCs'
// published ASCII test secrets or random bytes made here, never a real person's key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const T = require(fileURLToPath(new URL('../../assets/js/totp.js', import.meta.url)));

/** node:crypto's HMAC-SHA-1, the one the server gives totp.js. */
const hmac = (key, msg) => new Uint8Array(createHmac('sha1', Buffer.from(key)).update(Buffer.from(msg)).digest());
/** The ASCII test secret of RFC 4226 Appendix D and RFC 6238 Appendix B (SHA-1). */
const RFC_SECRET = new TextEncoder().encode('12345678901234567890');

test('rfc 6238', async () => {
  // RFC 6238 Appendix B, "Test Vectors", the SHA1 rows (secret '12345678901234567890', 8 digits, X = 30, T0 = 0):
  // +-------------+--------------+------------------+----------+--------+
  // |  Time (sec) |   UTC Time   | Value of T (hex) |   TOTP   |  Mode  |
  // +-------------+--------------+------------------+----------+--------+
  // |      59     |  1970-01-01  | 0000000000000001 | 94287082 |  SHA1  |
  // |             |   00:00:59   |                  |          |        |
  // |  1111111109 |  2005-03-18  | 00000000023523EC | 07081804 |  SHA1  |
  // |             |   01:58:29   |                  |          |        |
  // |  1111111111 |  2005-03-18  | 00000000023523ED | 14050471 |  SHA1  |
  // |             |   01:58:31   |                  |          |        |
  // |  1234567890 |  2009-02-13  | 000000000273EF07 | 89005924 |  SHA1  |
  // |             |   23:31:30   |                  |          |        |
  // |  2000000000 |  2033-05-18  | 0000000003F940AA | 69279037 |  SHA1  |
  // |             |   03:33:20   |                  |          |        |
  // | 20000000000 |  2603-10-11  | 0000000027BC86AA | 65353130 |  SHA1  |
  // |             |   11:33:20   |                  |          |        |
  // +-------------+--------------+------------------+----------+--------+
  const table = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130']
  ];
  for (const [sec, want] of table) {
    assert.equal(await T.totp({ key: RFC_SECRET, time: sec * 1000, digits: 8, hmac }), want, `T = ${sec}`);
  }
  // the defaults the authenticator apps read: 6 digits, 30-second steps
  assert.equal(T.STEP, 30);
  assert.equal(T.DIGITS, 6);
  assert.equal(T.WINDOW, 1);
  assert.equal(await T.totp({ key: RFC_SECRET, time: 59 * 1000, hmac }), '287082');
});

test('rfc 4226', async () => {
  // RFC 4226 Appendix D, "HOTP Algorithm: Test Values" (secret '12345678901234567890'):
  //   Count    Hexadecimal    Decimal        HOTP
  //   0        4c93cf18       1284755224     755224
  //   1        41397eea       1094287082     287082
  //   2         82fef30        137359152     359152
  //   3        66ef7655       1726969429     969429
  //   4        61c5938a       1640338314     338314
  //   5        33c083d4        868254676     254676
  //   6        7256c032       1918287922     287922
  //   7         4e5b397         82162583     162583
  //   8        2823443f        673399871     399871
  //   9        2679dc69        645520489     520489
  const want = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  for (let c = 0; c < want.length; c++) assert.equal(await T.hotp({ key: RFC_SECRET, counter: c, hmac }), want[c], `count ${c}`);
});

test('base32', () => {
  // RFC 4648 section 10, "Test Vectors", BASE32 (written here without the '=' padding)
  const vectors = [
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI']
  ];
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  for (const [plain, b32] of vectors) {
    assert.equal(T.base32Encode(enc.encode(plain)), b32, `encode '${plain}'`);
    assert.equal(dec.decode(T.base32Decode(b32)), plain, `decode '${b32}'`);
  }
  // as a person types it: lower case, spaces and dashes
  assert.equal(dec.decode(T.base32Decode('mzxw 6ytb-oi')), 'foobar');
  assert.equal(dec.decode(T.base32Decode(' MZXW-6YTB OI ')), 'foobar');
  // a random key goes there and back
  const key = new Uint8Array(randomBytes(20));
  assert.deepEqual(T.base32Decode(T.base32Encode(key)), key);
  // characters outside the RFC 4648 alphabet are refused with the sentence
  for (const bad of ['MZXW1', 'MZXW0', 'MZXW8', 'MZ=Q', 'MZ_Q']) assert.throws(() => T.base32Decode(bad), { message: 'The key has a character that is not allowed.' }, bad);
});

/** A random 20-byte key whose code at step s differs from the codes of the six steps around it (so no test can pass by luck). */
async function keyFor(s) {
  for (;;) {
    const key = T.newKey(randomBytes);
    const code = await T.hotp({ key, counter: s, hmac });
    let alone = true;
    for (let d = -3; d <= 3; d++) if (d && (await T.hotp({ key, counter: s + d, hmac })) === code) alone = false;
    if (alone) return { key, code };
  }
}
const at = (step) => step * 30 * 1000 + 12345; // a time inside the step

test('window', async () => {
  const s = Math.floor(Date.now() / 30000);
  const { key, code } = await keyFor(s);
  assert.equal(key.length, 20);
  for (const now of [s - 1, s, s + 1]) assert.equal(await T.verify({ key, code, time: at(now), hmac }), s, `accepted at step ${now - s}`);
  for (const now of [s - 2, s + 2]) assert.equal(await T.verify({ key, code, time: at(now), hmac }), null, `refused at step ${now - s}`);
  // spaces are ignored; anything that is not six digits is refused
  assert.equal(await T.verify({ key, code: code.slice(0, 3) + ' ' + code.slice(3), time: at(s), hmac }), s);
  for (const bad of ['12345', '1234567', 'abcdef', '', null, '12345a']) assert.equal(await T.verify({ key, code: bad, time: at(s), hmac }), null, String(bad));
  // a wrong code is refused
  const wrong = String((Number(code) + 1) % 1000000).padStart(6, '0');
  if (wrong !== (await T.hotp({ key, counter: s - 1, hmac })) && wrong !== (await T.hotp({ key, counter: s + 1, hmac }))) assert.equal(await T.verify({ key, code: wrong, time: at(s), hmac }), null);
});

test('replay', async () => {
  const s = Math.floor(Date.now() / 30000);
  const { key, code } = await keyFor(s);
  const prev = await T.hotp({ key, counter: s - 1, hmac });
  const next = await T.hotp({ key, counter: s + 1, hmac });
  // once step s was accepted, the code of s and the code of s-1 are refused; the next step's code is accepted
  assert.equal(await T.verify({ key, code, time: at(s), lastStep: s, hmac }), null);
  assert.equal(await T.verify({ key, code: prev, time: at(s), lastStep: s, hmac }), null);
  assert.equal(await T.verify({ key, code: next, time: at(s), lastStep: s, hmac }), s + 1);
  // and with nothing accepted before (lastStep -1 by default) the code of s is accepted
  assert.equal(await T.verify({ key, code, time: at(s), hmac }), s);
  assert.equal(await T.verify({ key, code, time: at(s), lastStep: s - 1, hmac }), s);
});

test('set-up address', () => {
  const key = T.newKey(randomBytes);
  const b32 = T.base32Encode(key);
  assert.match(b32, /^[A-Z2-7]{32}$/);
  assert.equal(
    T.otpauth({ issuer: 'Harbor Ridge', label: 'pat@harborridge.example', key }),
    'otpauth://totp/Harbor%20Ridge:pat%40harborridge.example?secret=' + b32 + '&issuer=Harbor%20Ridge&algorithm=SHA1&digits=6&period=30'
  );
  // the key as typed into an app: 8 groups of 4
  const shown = T.formatKey(b32);
  assert.match(shown, /^[A-Z2-7]{4}( [A-Z2-7]{4}){7}$/);
  assert.equal(shown.replace(/ /g, ''), b32);
  assert.deepEqual(T.base32Decode(shown), key);
});

test('recovery', () => {
  assert.equal(T.RECOVERY_ALPHABET, '23456789abcdefghjkmnpqrstuvwxyz');
  for (const c of '01ilo') assert.equal(T.RECOVERY_ALPHABET.includes(c), false, c);
  const codes = T.newRecoveryCodes(randomBytes);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[2-9a-hjkmnp-z]{5}-[2-9a-hjkmnp-z]{5}$/);
  const one = codes[0];
  const bare = one.replace('-', '');
  assert.equal(T.normalRecovery(one), bare);
  assert.equal(T.normalRecovery(one.toUpperCase()), bare);
  assert.equal(T.normalRecovery(bare), bare);
  assert.equal(T.normalRecovery(' ' + one.slice(0, 3) + ' ' + one.slice(3).toUpperCase() + ' '), bare);
  assert.equal(T.normalRecovery(bare.slice(0, 9)), '');
  assert.equal(T.normalRecovery(bare + 'a'), '');
  for (const look of ['0', '1', 'i', 'l', 'o']) assert.equal(T.normalRecovery(look + bare.slice(1)), '', look);
  assert.equal(T.normalRecovery(''), '');
  assert.equal(T.normalRecovery(null), '');
});

test('fallback hmac', async () => {
  // demoHmacSha1 is the preview's only fallback (a frame with no WebCrypto); it must equal node:crypto's HMAC-SHA-1.
  const hex = (s) => new Uint8Array(Buffer.from(s, 'hex'));
  const txt = (s) => new TextEncoder().encode(s);
  const fill = (n, b) => new Uint8Array(n).fill(b);
  // RFC 2202 section 3, "Test Cases for HMAC-SHA-1"
  const cases = [
    [fill(20, 0x0b), txt('Hi There'), 'b617318655057264e28bc0b6fb378c8ef146be00'],
    [txt('Jefe'), txt('what do ya want for nothing?'), 'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79'],
    [fill(20, 0xaa), fill(50, 0xdd), '125d7342b9ac11cd91a39af48aa17b4f63f175d3'],
    [hex('0102030405060708090a0b0c0d0e0f10111213141516171819'), fill(50, 0xcd), '4c9007f4026250c6bc8414f9bf50c86c2d7235da'],
    [fill(20, 0x0c), txt('Test With Truncation'), '4c1a03424b55e07fe7f27be1d58bb9324a9a5a04'],
    [fill(80, 0xaa), txt('Test Using Larger Than Block-Size Key - Hash Key First'), 'aa4ae5e15272d00e95705637ce8a3b55ed402112'],
    [fill(80, 0xaa), txt('Test Using Larger Than Block-Size Key and Larger Than One Block-Size Data'), 'e8e99d0f45237d786d6bbaa7965c7808bbff1a91']
  ];
  for (const [k, m, want] of cases) {
    assert.equal(Buffer.from(hmac(k, m)).toString('hex'), want, 'node:crypto ' + want);
    assert.equal(Buffer.from(T.demoHmacSha1(k, m)).toString('hex'), want, 'demoHmacSha1 ' + want);
  }
  // 50 random key and message lengths from 0 to 200 bytes (block edges 55, 56, 63, 64, 65 and 0 always among them)
  const lens = [0, 55, 56, 63, 64, 65, 119, 120, 128, 200];
  for (let i = 0; i < 50; i++) {
    const kl = i < lens.length ? lens[i] : randomInt(0, 201);
    const ml = i < lens.length ? lens[lens.length - 1 - i] : randomInt(0, 201);
    const k = new Uint8Array(randomBytes(kl));
    const m = new Uint8Array(randomBytes(ml));
    assert.deepEqual(T.demoHmacSha1(k, m), hmac(k, m), `key ${kl} bytes, message ${ml} bytes`);
  }
  // totp.js names no vendor, library or model, and never the forbidden word; the fallback says it is the preview's only
  const src = readFileSync(fileURLToPath(new URL('../../assets/js/totp.js', import.meta.url)), 'utf8');
  // the white-label patterns of phase 6's check library (VENDORS, VENDOR_RE, WORD_RE), read from its source text
  const lib = readFileSync(fileURLToPath(new URL('../../.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js', import.meta.url)), 'utf8');
  for (const name of ['VENDORS', 'VENDOR_RE', 'WORD_RE']) {
    const m = lib.match(new RegExp('^const ' + name + ' = (/.+/[a-z]*);', 'm'));
    assert.ok(m, `${name} is in phase 6's lib.js`);
    const re = new Function('return ' + m[1])();
    assert.equal(re.test(src), false, `totp.js matches ${name}: ${(src.match(re) || [])[0]}`);
  }
  assert.match(src, /preview's only fallback/i);
});
