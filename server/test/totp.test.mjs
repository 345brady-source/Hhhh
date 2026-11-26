// gate: tests 8
// The two-step code (plan 15-02, SE-02): assets/js/totp.js, the one file the browser and the server both use, checked
// against the RFCs' own published test values. The server always passes node:crypto's HMAC; the keys below are the RFCs'
// published ASCII test secrets or random bytes made here, never a real person's key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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
