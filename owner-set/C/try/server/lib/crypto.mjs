// Signing helpers shared by the provider adapters.
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

export const hmac = (alg, secret, data, enc = 'hex') => createHmac(alg, secret).update(data).digest(enc);
export const sha256 = (data, enc = 'hex') => createHash('sha256').update(data).digest(enc);
export const id = (prefix) => `${prefix}_${randomBytes(9).toString('base64url')}`;

/** Constant-time comparison of two strings (hex, base64 or plain). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Reject webhook timestamps outside the tolerance (seconds) to stop replays. */
export function fresh(tsSeconds, toleranceSeconds = 300, now = Date.now()) {
  const t = Number(tsSeconds);
  return Number.isFinite(t) && Math.abs(now / 1000 - t) <= toleranceSeconds;
}
