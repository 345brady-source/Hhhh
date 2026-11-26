/*
 * Two-step sign-in codes from an authenticator app (time-based one-time codes, RFC 6238 on RFC 4226): HMAC-SHA-1,
 * 6 digits, 30-second steps. One file for the browser and the server, so the two can never compute a code differently.
 *
 * It works on bytes only and touches nothing when it loads (window.CVPortal.totp in a page, module.exports under Node).
 * It holds no key: the caller passes the key, the time and the HMAC to use. Every function that hashes takes
 * hmac(keyBytes, msgBytes) -> Uint8Array or a Promise of one (awaited either way). The server always passes Node's own
 * HMAC-SHA-1; a page passes browserHmac.
 *
 *   STEP, DIGITS, WINDOW              30 seconds, 6 digits, one step either side
 *   base32Encode(bytes)               RFC 4648 base32, no padding
 *   base32Decode(text)                Uint8Array; any case, spaces and dashes ignored; throws on any other character
 *   hotp({ key, counter, digits, hmac })          RFC 4226 code for one counter (zero-padded string)
 *   totp({ key, time, step, digits, hmac })       RFC 6238 code for a time in milliseconds
 *   verify({ key, code, time, lastStep, window, hmac })   the step accepted, or null (malformed, wrong, or replayed)
 *   newKey(randomBytes)               a new 20-byte key; formatKey(base32) groups of four for typing into an app
 *   otpauth({ issuer, label, key })   the set-up address an authenticator app reads (QR code or link)
 *   RECOVERY_ALPHABET, newRecoveryCodes(randomBytes), normalRecovery(text)   the ten one-time recovery codes
 *   browserHmac(key, msg), usesWebCrypto()   a page's HMAC-SHA-1: WebCrypto when the page offers it, else the
 *                                     preview's own (demoHmacSha1, below), and which one the last call used
 */
(function (NS) {
  'use strict';

  const STEP = 30;
  const DIGITS = 6;
  const WINDOW = 1;
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const BAD_KEY = 'The key has a character that is not allowed.';

  const bytesOf = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));

  /** RFC 4648 base32 of bytes, upper case, no padding. */
  function base32Encode(bytes) {
    const b = bytesOf(bytes);
    let out = '';
    let acc = 0;
    let bits = 0;
    for (let i = 0; i < b.length; i++) {
      acc = (acc << 8) | b[i];
      bits += 8;
      while (bits >= 5) {
        out += B32[(acc >>> (bits - 5)) & 31];
        bits -= 5;
      }
      acc &= (1 << bits) - 1;
    }
    if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
    return out;
  }

  /** The bytes of a base32 text: any case, spaces and dashes ignored; any other character throws. */
  function base32Decode(text) {
    const clean = String(text == null ? '' : text)
      .replace(/[\s-]+/g, '')
      .toUpperCase();
    const out = [];
    let acc = 0;
    let bits = 0;
    for (let i = 0; i < clean.length; i++) {
      const v = B32.indexOf(clean[i]);
      if (v < 0) throw new Error(BAD_KEY);
      acc = (acc << 5) | v;
      bits += 5;
      if (bits >= 8) {
        out.push((acc >>> (bits - 8)) & 255);
        bits -= 8;
      }
      acc &= (1 << bits) - 1;
    }
    return new Uint8Array(out);
  }

  /** The 8-byte big-endian counter RFC 4226 hashes. */
  function counterBytes(counter) {
    const c = Math.floor(Number(counter));
    if (!(c >= 0) || !Number.isSafeInteger(c)) throw new Error('The counter must be a whole number from 0.');
    const m = new Uint8Array(8);
    let hi = Math.floor(c / 4294967296);
    let lo = c % 4294967296;
    for (let i = 7; i >= 4; i--) {
      m[i] = lo & 255;
      lo = Math.floor(lo / 256);
    }
    for (let i = 3; i >= 0; i--) {
      m[i] = hi & 255;
      hi = Math.floor(hi / 256);
    }
    return m;
  }

  /** RFC 4226 HOTP: dynamic truncation of HMAC-SHA-1(key, counter), zero-padded to digits. */
  async function hotp({ key, counter, digits = DIGITS, hmac }) {
    if (typeof hmac !== 'function') throw new Error('An HMAC function is needed.');
    const h = bytesOf(await hmac(bytesOf(key), counterBytes(counter)));
    const o = h[h.length - 1] & 15;
    const bin = ((h[o] & 0x7f) * 16777216) + (h[o + 1] << 16) + (h[o + 2] << 8) + h[o + 3];
    return String(bin % Math.pow(10, digits)).padStart(digits, '0');
  }

  /** The step a time (milliseconds) falls in. */
  const stepOf = (time, step = STEP) => Math.floor(Number(time) / (1000 * step));

  /** RFC 6238 TOTP for a time in milliseconds. */
  function totp({ key, time, step = STEP, digits = DIGITS, hmac }) {
    return hotp({ key, counter: stepOf(time, step), digits, hmac });
  }

  let lastWebCrypto = false;

  /** A page's HMAC-SHA-1: WebCrypto when the page offers it and it works, otherwise the preview's own (demoHmacSha1). */
  async function browserHmac(keyBytes, msgBytes) {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (c && c.subtle && typeof c.subtle.importKey === 'function') {
      try {
        const k = await c.subtle.importKey('raw', bytesOf(keyBytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const sig = new Uint8Array(await c.subtle.sign('HMAC', k, bytesOf(msgBytes)));
        lastWebCrypto = true;
        return sig;
      } catch (e) {
        lastWebCrypto = false;
        throw e;
      }
    }
    lastWebCrypto = false;
    throw new Error('This page offers no WebCrypto.');
  }

  /** Whether the last browserHmac call used WebCrypto. */
  const usesWebCrypto = () => lastWebCrypto;

  const API = { STEP, DIGITS, WINDOW, base32Encode, base32Decode, hotp, totp, browserHmac, usesWebCrypto };
  if (NS) NS.totp = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? (window.CVPortal = window.CVPortal || {}) : null);
