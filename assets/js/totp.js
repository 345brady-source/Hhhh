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

  /** Equal strings of the same length, compared over every character (no early exit). */
  function sameCode(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }

  /**
   * The step a typed code belongs to, within window steps either side of time and after lastStep (a step at or before
   * the last one accepted is refused: no replay), or null. Spaces in the code are ignored; anything but six digits is null.
   */
  async function verify({ key, code, time, lastStep = -1, window = WINDOW, hmac }) {
    const typed = String(code == null ? '' : code).replace(/\s+/g, '');
    if (!/^[0-9]{6}$/.test(typed)) return null;
    const now = stepOf(time);
    let hit = null;
    for (let s = now - window; s <= now + window; s++) {
      if (s < 0) continue;
      const want = await hotp({ key, counter: s, digits: DIGITS, hmac });
      const same = sameCode(want, typed);
      if (same && s > lastStep && hit === null) hit = s;
    }
    return hit;
  }

  /** A new 20-byte key from randomBytes(n) (crypto.randomBytes on the server, crypto.getRandomValues in a page). */
  function newKey(randomBytes) {
    const k = bytesOf(randomBytes(20));
    if (k.length !== 20) throw new Error('20 random bytes are needed.');
    return new Uint8Array(k);
  }

  /** A base32 key in groups of four, for typing into an app. */
  function formatKey(base32) {
    const k = String(base32 || '').replace(/[\s-]+/g, '').toUpperCase();
    return (k.match(/.{1,4}/g) || []).join(' ');
  }

  /** The set-up address: the firm's name as issuer, the person's email as label (never the platform's name). */
  function otpauth({ issuer, label, key }) {
    const secret = typeof key === 'string' ? key.replace(/[\s-]+/g, '').toUpperCase() : base32Encode(key);
    const i = encodeURIComponent(String(issuer || ''));
    return 'otpauth://totp/' + i + ':' + encodeURIComponent(String(label || '')) + '?secret=' + secret + '&issuer=' + i + '&algorithm=SHA1&digits=6&period=30';
  }

  // Recovery codes: ten, each 10 characters from an alphabet with no look-alike characters (no 0, 1, i, l, o), shown
  // as xxxxx-xxxxx and accepted with or without the dash, in any case.
  const RECOVERY_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
  const RECOVERY_LEN = 10;

  /** One code's 10 characters, unbiased (random bytes at or above the last whole multiple of the alphabet are drawn again). */
  function recoveryChars(randomBytes) {
    const n = RECOVERY_ALPHABET.length;
    const limit = 256 - (256 % n);
    let out = '';
    while (out.length < RECOVERY_LEN) {
      const b = bytesOf(randomBytes(16));
      for (let i = 0; i < b.length && out.length < RECOVERY_LEN; i++) if (b[i] < limit) out += RECOVERY_ALPHABET[b[i] % n];
    }
    return out;
  }

  /** Ten different recovery codes 'xxxxx-xxxxx'. */
  function newRecoveryCodes(randomBytes) {
    const seen = new Set();
    while (seen.size < 10) seen.add(recoveryChars(randomBytes));
    return Array.from(seen).map((c) => c.slice(0, 5) + '-' + c.slice(5));
  }

  /** The 10 characters of a typed recovery code (lower case, spaces and dashes removed), or '' when it is not one. */
  function normalRecovery(text) {
    const c = String(text == null ? '' : text)
      .replace(/[\s-]+/g, '')
      .toLowerCase();
    if (c.length !== RECOVERY_LEN) return '';
    for (let i = 0; i < c.length; i++) if (RECOVERY_ALPHABET.indexOf(c[i]) < 0) return '';
    return c;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The preview's own HMAC-SHA-1 (FIPS 180-4 SHA-1, RFC 2104 HMAC). It is the PREVIEW'S ONLY fallback, for a page whose
  // frame offers no WebCrypto, so the on-device demo of two-step sign-in still works there. The server never uses it: the
  // server always passes Node's own HMAC. It protects nothing real.
  function sha1(msg) {
    const m = bytesOf(msg);
    const len = m.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const p = new Uint8Array(total);
    p.set(m);
    p[len] = 0x80;
    const bitsHi = Math.floor(len / 536870912);
    const bitsLo = (len * 8) >>> 0;
    p[total - 8] = (bitsHi >>> 24) & 255;
    p[total - 7] = (bitsHi >>> 16) & 255;
    p[total - 6] = (bitsHi >>> 8) & 255;
    p[total - 5] = bitsHi & 255;
    p[total - 4] = (bitsLo >>> 24) & 255;
    p[total - 3] = (bitsLo >>> 16) & 255;
    p[total - 2] = (bitsLo >>> 8) & 255;
    p[total - 1] = bitsLo & 255;
    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;
    const w = new Int32Array(80);
    const rotl = (x, n) => (x << n) | (x >>> (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = (p[off + 4 * i] << 24) | (p[off + 4 * i + 1] << 16) | (p[off + 4 * i + 2] << 8) | p[off + 4 * i + 3];
      for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      for (let i = 0; i < 80; i++) {
        let f;
        let k;
        if (i < 20) {
          f = (b & c) | (~b & d);
          k = 0x5a827999;
        } else if (i < 40) {
          f = b ^ c ^ d;
          k = 0x6ed9eba1;
        } else if (i < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = 0x8f1bbcdc;
        } else {
          f = b ^ c ^ d;
          k = 0xca62c1d6;
        }
        const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
        e = d;
        d = c;
        c = rotl(b, 30);
        b = a;
        a = t;
      }
      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
    }
    const out = new Uint8Array(20);
    [h0, h1, h2, h3, h4].forEach((h, i) => {
      out[4 * i] = (h >>> 24) & 255;
      out[4 * i + 1] = (h >>> 16) & 255;
      out[4 * i + 2] = (h >>> 8) & 255;
      out[4 * i + 3] = h & 255;
    });
    return out;
  }

  /** HMAC-SHA-1 (RFC 2104) on sha1 above: the preview's only fallback, never used by the server. */
  function demoHmacSha1(keyBytes, msgBytes) {
    let k = bytesOf(keyBytes);
    if (k.length > 64) k = sha1(k);
    const ipad = new Uint8Array(64 + bytesOf(msgBytes).length);
    const opad = new Uint8Array(64 + 20);
    for (let i = 0; i < 64; i++) {
      const b = i < k.length ? k[i] : 0;
      ipad[i] = b ^ 0x36;
      opad[i] = b ^ 0x5c;
    }
    ipad.set(bytesOf(msgBytes), 64);
    opad.set(sha1(ipad), 64);
    return sha1(opad);
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
        // falls through to the preview's own HMAC (a frame that refuses WebCrypto, or an empty key it will not import)
      }
    }
    lastWebCrypto = false;
    return demoHmacSha1(keyBytes, msgBytes);
  }

  /** Whether the last browserHmac call used WebCrypto. */
  const usesWebCrypto = () => lastWebCrypto;

  const API = { STEP, DIGITS, WINDOW, base32Encode, base32Decode, hotp, totp, verify, newKey, formatKey, otpauth, RECOVERY_ALPHABET, newRecoveryCodes, normalRecovery, demoHmacSha1, browserHmac, usesWebCrypto };
  if (NS) NS.totp = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? (window.CVPortal = window.CVPortal || {}) : null);
